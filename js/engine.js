'use strict';
/* Claude Code Clicker: game state, economy, events, prestige and saving. */

const N = BUILDINGS.length;
const UPG = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
const ACH = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
const MEM = Object.fromEntries(MEMORY.map(m => [m.id, m]));
const SAVE_KEY = 'claude-code-clicker/v1';
const SESSION_START = Date.now();
const sessionSeconds = () => (Date.now() - SESSION_START) / 1000;

// ---------- tiny event bus ----------
const bus = {};
function on(ev, fn) { (bus[ev] = bus[ev] || []).push(fn); }
function emit(ev, ...args) {
  for (const fn of bus[ev] || []) {
    try { fn(...args); } catch (e) { console.error(e); }
  }
}

// ---------- state ----------
function freshRun() {
  return {
    tokens: 0, earned: 0, handmade: 0,
    owned: Array(N).fill(0), producedBy: Array(N).fill(0),
    upgrades: new Set(), buffs: [], focus: 0, runStart: Date.now(),
  };
}
function freshGame() {
  return Object.assign(freshRun(), {
    prevEarned: 0, clicks: 0, achievements: new Set(), goldenClicks: 0, bugsSquashed: 0, spellsCast: 0,
    compacts: 0, prestige: 0, memories: 0, mem: new Set(), gameStart: Date.now(),
    settings: { numbers: 'words', particles: true, floaters: true, sound: false, motion: true },
    stats: { maxTps: 0 },
  });
}
let G = freshGame();

// Derived values, rebuilt by recompute() whenever something that affects them changes.
const D = {
  each: Array(N).fill(0), mult: 1, raw: 0, tpsBase: 0, tps: 0, click: 1, clickBase: 1, clickPct: 0,
  flow: 0, flowMult: 1, gpct: 0, prestigeBonus: 0, buffProd: 1, buffClick: 1,
  eurekaFreq: 1, eurekaLife: 1, effDur: 1, bugMult: 1, bugFreq: 1,
  bldDiscount: 1, upgDiscount: 1, offline: 0.1, focusMax: 0, focusRegen: 0,
};

// Countdown timers (seconds).
const T = { eureka: rand(45, 120), bug: rand(120, 240), ach: 1 };

const hasUpg = id => G.upgrades.has(id);
const hasMem = id => G.mem.has(id);
const totalOwned = () => G.owned.reduce((a, b) => a + b, 0);
const allTimeEarned = () => G.prevEarned + G.earned;
const safe = fn => { try { return fn(); } catch (e) { return false; } };

function recompute() {
  D.flow = G.achievements.size * 0.04;
  let x2 = 0, fingers = 0, fm = 1, clickPct = 0, gpct = 0, flowMult = 1;
  const doubles = Array(N).fill(0);
  D.eurekaFreq = 1; D.eurekaLife = 1; D.effDur = 1; D.bugMult = 1; D.bugFreq = 1;

  for (const id of G.upgrades) {
    const u = UPG[id];
    if (!u) continue;
    switch (u.kind) {
      case 'tier': doubles[u.b]++; break;
      case 'cursor': if (u.x2) x2++; fingers += u.fingers; fm *= u.fm; break;
      case 'click': clickPct += 1; break;
      case 'global': gpct += u.pct; break;
      case 'flow': flowMult *= 1 + D.flow * u.k; break;
      case 'golden': D.eurekaFreq *= u.freq || 1; D.eurekaLife *= u.life || 1; D.effDur *= u.dur || 1; break;
      case 'bug': D.bugMult *= u.bugMult || 1; D.bugFreq *= u.bugFreq || 1; break;
    }
  }
  if (hasMem('instinct')) D.eurekaFreq *= 1.1;
  if (hasMem('golden')) D.eurekaFreq *= 1.1;
  if (hasMem('streak')) D.effDur *= 1.1;
  D.bldDiscount = hasMem('discount') ? 0.95 : 1;
  D.upgDiscount = hasMem('coupons') ? 0.95 : 1;
  D.offline = hasMem('background') ? 0.9 : hasMem('resume') ? 0.5 : 0.1;

  // Multi-cursor: +X per non-Autocomplete building, for each Autocomplete and each click.
  const add = fingers * fm * (totalOwned() - G.owned[0]);
  D.each[0] = 0.1 * Math.pow(2, x2) + add;
  for (let i = 1; i < N; i++) {
    D.each[i] = BUILDINGS[i].tps * Math.pow(2, doubles[i]) * (i === 2 && hasMem('duck') ? 1.5 : 1);
  }

  D.prestigeBonus = G.prestige * 0.01 * (hasMem('deep') ? 1.5 : 1);
  D.gpct = gpct;
  D.flowMult = flowMult;
  D.mult = (1 + gpct / 100) * flowMult * (1 + D.prestigeBonus);

  let raw = 0;
  for (let i = 0; i < N; i++) raw += G.owned[i] * D.each[i];
  D.raw = raw;
  D.tpsBase = raw * D.mult;

  let bp = 1, bc = 1;
  for (const b of G.buffs) { bp *= b.prod || 1; bc *= b.click || 1; }
  D.buffProd = bp;
  D.buffClick = bc;
  D.tps = D.tpsBase * bp;

  D.clickBase = Math.pow(2, x2) + add;
  D.clickPct = clickPct;
  D.click = (D.clickBase + (D.tps * clickPct) / 100) * bc * (hasMem('muscle') ? 1.25 : 1);

  const s = G.owned[5];
  D.focusMax = s > 0 ? Math.floor(10 + 4 * Math.pow(s, 0.7)) : 0;
  D.focusRegen = (0.1 + D.focusMax * 0.004) * (hasMem('quiet') ? 1.25 : 1);
  G.focus = Math.min(G.focus, D.focusMax);
}

// ---------- economy ----------
function earn(n) {
  if (!(n > 0)) return;
  G.tokens += n;
  G.earned += n;
}

function bulkCost(i, n) {
  const base = BUILDINGS[i].cost * D.bldDiscount, o = G.owned[i];
  return Math.ceil((base * (Math.pow(1.15, o + n) - Math.pow(1.15, o))) / 0.15);
}
function sellValue(i, n) {
  const o = G.owned[i];
  n = Math.min(n, o);
  const base = BUILDINGS[i].cost * D.bldDiscount;
  return Math.floor(((base * (Math.pow(1.15, o) - Math.pow(1.15, o - n))) / 0.15) * 0.25);
}
const upgCost = u => Math.ceil(u.cost * D.upgDiscount);

function buyBuilding(i, n) {
  const cost = bulkCost(i, n);
  if (G.tokens < cost) return false;
  G.tokens -= cost;
  G.owned[i] += n;
  recompute();
  emit('bought', i);
  return true;
}
function sellBuilding(i, n) {
  n = Math.min(n, G.owned[i]);
  if (n <= 0) return false;
  G.tokens += sellValue(i, n);
  G.owned[i] -= n;
  recompute();
  grant('sold');
  emit('bought', i);
  return true;
}
function buyUpgrade(id) {
  const u = UPG[id];
  if (!u || hasUpg(id) || !safe(u.unlock)) return false;
  const cost = upgCost(u);
  if (G.tokens < cost) return false;
  G.tokens -= cost;
  G.upgrades.add(id);
  recompute();
  emit('upgraded', u);
  return true;
}
const visibleUpgrades = () =>
  UPGRADES.filter(u => !G.upgrades.has(u.id) && safe(u.unlock)).sort((a, b) => a.cost - b.cost);

// ---------- clicking ----------
const recentClicks = [];
function clickSparkle() {
  const v = D.click;
  earn(v);
  G.handmade += v;
  G.clicks++;
  const now = performance.now();
  recentClicks.push(now);
  while (recentClicks.length && now - recentClicks[0] > 1000) recentClicks.shift();
  if (recentClicks.length >= 15) grant('rage');
  return v;
}

// ---------- buffs ----------
function addBuff(key, name, dur, eff) {
  const ex = G.buffs.find(b => b.key === key);
  if (ex) {
    ex.t = Math.max(ex.t, dur);
    ex.dur = Math.max(ex.dur, dur);
  } else {
    G.buffs.push({ key, name, t: dur, dur, prod: eff.prod || 1, click: eff.click || 1 });
  }
  recompute();
}

// ---------- Eureka tokens (golden) and bugs ----------
const eurekaDelay = () => rand(90, 240) / D.eurekaFreq;
const bugDelay = () => rand(180, 360) / D.bugFreq;

function eurekaEffect() {
  G.goldenClicks++;
  const pool = [['frenzy', 45], ['lucky', 45], ['clickfrenzy', 8]];
  const big = BUILDINGS.map((_, i) => i).filter(i => G.owned[i] >= 10);
  if (big.length) pool.push(['hyper', 8]);
  let r = Math.random() * pool.reduce((s, p) => s + p[1], 0), kind = pool[0][0];
  for (const [k, w] of pool) { if ((r -= w) < 0) { kind = k; break; } }

  let out;
  if (kind === 'frenzy') {
    addBuff('frenzy', 'Vibe Coding', 77 * D.effDur, { prod: 7 });
    out = { title: 'Vibe Coding!', text: `Production <b>×7</b> for ${Math.round(77 * D.effDur)} seconds.` };
  } else if (kind === 'clickfrenzy') {
    addBuff('clickfrenzy', 'Keyboard on Fire', 13 * D.effDur, { click: 777 });
    out = { title: 'Keyboard on Fire!', text: `Clicking power <b>×777</b> for ${Math.round(13 * D.effDur)} seconds.` };
  } else if (kind === 'hyper') {
    const i = pick(big), n = G.owned[i];
    addBuff('hyper' + i, `${BUILDINGS[i].name} Hyperfocus`, 30 * D.effDur, { prod: 1 + n * 0.1 });
    out = { title: `${BUILDINGS[i].name} Hyperfocus!`, text: `Your ${n} ${BUILDINGS[i].plural} boost production by <b>+${n * 10}%</b> for ${Math.round(30 * D.effDur)} seconds.` };
  } else {
    const gain = (Math.min(G.tokens * 0.15, D.tps * 900) + 13) * (hasMem('golden') ? 1.1 : 1);
    earn(gain);
    out = { title: 'Lucky Commit!', text: `<b>+${fmt(gain)}</b> tokens.` };
  }
  recompute();
  return out;
}

function bugReward() {
  G.bugsSquashed++;
  const gain = Math.max(D.tps * 60, 25) * D.bugMult;
  earn(gain);
  return gain;
}

// ---------- slash commands ----------
const spellCost = sp => Math.floor(sp.base + sp.pct * D.focusMax);
function castSpell(id) {
  const sp = SPELLS.find(s => s.id === id);
  if (!sp || !D.focusMax) return null;
  const cost = spellCost(sp);
  if (G.focus < cost) return null;
  G.focus -= cost;
  G.spellsCast++;
  const res = sp.run(Math.random() < SPELL_FAIL);
  res.cmd = sp.cmd;
  return res;
}

// ---------- prestige (/compact) ----------
const prestigeFor = total => Math.floor(Math.cbrt(total / 1e12));
const pendingPrestige = () => Math.max(0, prestigeFor(allTimeEarned()) - G.prestige);

function compact() {
  const gain = pendingPrestige();
  G.prestige += gain;
  G.memories += gain;
  G.compacts++;
  G.prevEarned += G.earned;
  Object.assign(G, freshRun());
  if (hasMem('starter')) G.owned[0] = 10;
  if (hasMem('onboarding')) G.owned[1] = 5;
  recompute();
  T.eureka = rand(45, 120);
  emit('reset');
  return gain;
}

function buyMemory(id) {
  const m = MEM[id];
  if (!m || hasMem(id) || G.memories < m.cost || !m.req.every(hasMem)) return false;
  G.memories -= m.cost;
  G.mem.add(id);
  recompute();
  return true;
}

// ---------- achievements ----------
function grant(id) {
  if (!ACH[id] || G.achievements.has(id)) return;
  G.achievements.add(id);
  recompute();
  emit('achievement', ACH[id]);
}
function checkAchievements() {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (!G.achievements.has(a.id) && safe(a.check)) { G.achievements.add(a.id); got.push(a); }
  }
  if (got.length) { recompute(); got.forEach(a => emit('achievement', a)); }
}

// ---------- simulation step ----------
function update(dt) {
  if (D.tps > 0) {
    earn(D.tps * dt);
    const k = D.mult * D.buffProd * dt;
    for (let i = 0; i < N; i++) if (G.owned[i]) G.producedBy[i] += G.owned[i] * D.each[i] * k;
  }
  if (G.buffs.length) {
    for (const b of G.buffs) b.t -= dt;
    if (G.buffs.some(b => b.t <= 0)) { G.buffs = G.buffs.filter(b => b.t > 0); recompute(); }
  }
  if (D.focusMax) G.focus = Math.min(D.focusMax, G.focus + D.focusRegen * dt);

  T.eureka -= dt;
  if (T.eureka <= 0) { T.eureka = eurekaDelay(); emit('spawnEureka', false); }
  T.bug -= dt;
  if (T.bug <= 0) { T.bug = bugDelay(); if (G.earned >= 500) emit('spawnBug'); }
  T.ach -= dt;
  if (T.ach <= 0) {
    T.ach = 1;
    if (D.clickPct) recompute(); // click value follows tps
    G.stats.maxTps = Math.max(G.stats.maxTps, D.tps);
    checkAchievements();
  }
}

// ---------- saving ----------
function serialize() {
  return JSON.stringify({
    v: 1, ...G,
    upgrades: [...G.upgrades], achievements: [...G.achievements], mem: [...G.mem],
    lastSave: Date.now(), timers: { eureka: T.eureka, bug: T.bug },
  });
}

// Loads a JSON save. Returns {away, gain} when offline production was applied.
function load(str, applyOffline) {
  const o = JSON.parse(str);
  if (!o || typeof o !== 'object' || !Array.isArray(o.owned)) throw new Error('That is not a Claude Code Clicker save.');
  const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const g = freshGame();
  for (const k of ['tokens', 'earned', 'handmade', 'prevEarned', 'clicks', 'goldenClicks', 'bugsSquashed', 'spellsCast',
    'compacts', 'prestige', 'memories', 'focus', 'runStart', 'gameStart']) g[k] = num(o[k], g[k]);
  g.owned = BUILDINGS.map((_, i) => Math.max(0, Math.floor(num(o.owned[i]))));
  g.producedBy = BUILDINGS.map((_, i) => num((o.producedBy || [])[i]));
  g.upgrades = new Set((o.upgrades || []).filter(id => UPG[id]));
  g.achievements = new Set((o.achievements || []).filter(id => ACH[id]));
  g.mem = new Set((o.mem || []).filter(id => MEM[id]));
  g.buffs = (Array.isArray(o.buffs) ? o.buffs : [])
    .filter(b => b && typeof b.key === 'string' && num(b.t) > 0)
    .map(b => ({ key: b.key, name: String(b.name || ''), t: num(b.t), dur: num(b.dur, num(b.t)), prod: num(b.prod, 1), click: num(b.click, 1) }));
  Object.assign(g.settings, o.settings || {});
  Object.assign(g.stats, o.stats || {});
  G = g;
  if (o.timers) { T.eureka = num(o.timers.eureka, T.eureka); T.bug = num(o.timers.bug, T.bug); }
  recompute();

  const away = (Date.now() - num(o.lastSave, Date.now())) / 1000;
  if (!applyOffline || away < 60) return null;
  for (const b of G.buffs) b.t -= away;
  G.buffs = G.buffs.filter(b => b.t > 0);
  recompute();
  const gain = D.tpsBase * away * D.offline;
  earn(gain);
  if (D.focusMax) G.focus = Math.min(D.focusMax, G.focus + D.focusRegen * away);
  return { away, gain };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, serialize()); return true; } catch (e) { return false; }
}
function readSave() {
  try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
}
function exportSave() {
  return btoa(unescape(encodeURIComponent(serialize())));
}
function importSave(text) {
  const raw = text.trim();
  let json = raw;
  if (!raw.startsWith('{')) {
    try { json = decodeURIComponent(escape(atob(raw))); } catch (e) { throw new Error('That save code is incomplete or damaged.'); }
  }
  load(json, false);
  save();
  emit('reset');
}
function wipeSave() {
  G = freshGame();
  recompute();
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
  emit('reset');
}
