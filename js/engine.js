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

// ---------- systems registry ----------
// Bigger systems (garden, exchange, models, missions, duck, events) register here. Each may keep its own
// saved state (key/fresh/load) and may adjust the economy through optional hooks read by recompute():
//   each(eachArray), prod(), click(), costOf(i), upgCost(), eureka(), effDur(), flow(), away(i), drain(), offline()
const SYSTEMS = [];
function registerSystem(sys) {
  SYSTEMS.push(sys);
  if (sys.key && !(sys.key in G)) G[sys.key] = sys.fresh();
}
const modProduct = (fn, ...a) => SYSTEMS.reduce((p, m) => p * (m[fn] ? m[fn](...a) : 1), 1);
const modSum = (fn, ...a) => SYSTEMS.reduce((t, m) => t + (m[fn] ? m[fn](...a) : 0), 0);
const awayOf = i => modSum('away', i); // buildings busy elsewhere (Subagents on missions) do not produce

// ---------- challenge runs (/compact with a rule) ----------
const CHALLENGES = [
  { id: 'noclick', name: 'Hands Off', rule: 'Clicking the sparkle gives nothing.', goal: 1e9,
    reward: 'Idle Mastery', perk: 'Production +10% forever.' },
  { id: 'noupgrade', name: 'Vanilla Only', rule: 'You cannot buy upgrades.', goal: 1e9,
    reward: 'Raw Talent', perk: 'Buildings cost 5% less forever.' },
  { id: 'halfspeed', name: 'Rate Limited Run', rule: 'All production is halved.', goal: 1e10,
    reward: 'Throughput', perk: 'Clicking +25% and production +5% forever.' },
];
const inChallenge = id => G.challenge === id;
const challengeDone = id => G.challengesDone.includes(id);

// ---------- daily compute credits and building levels ----------
const DAY_MS = 86400000;
const levelCost = i => G.levels[i] + 1;
function levelUp(i) {
  const cost = levelCost(i);
  if (!G.owned[i] || G.credits < cost) return false;
  G.credits -= cost;
  G.levels[i]++;
  recompute();
  return true;
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
    prevEarned: 0, clicks: 0, achievements: new Set(), goldenClicks: 0, bugsSquashed: 0, spellsCast: 0, bubbles: 0,
    compacts: 0, prestige: 0, memories: 0, memSpent: 0, mem: new Set(), gameStart: Date.now(),
    settings: { numbers: 'words', particles: true, floaters: true, sound: false, motion: true },
    stats: { maxTps: 0 },
    dev: { on: false, mult: 1, free: false, fastEureka: false, infFocus: false, season: 'auto' },
    blackhole: false, theme: 'classic', // the one-time Event Horizon event and the clicker style it unlocks
    challenge: null, challengesDone: [],
    credits: 1, creditAt: Date.now(), levels: Array(N).fill(0),
  });
}
let G = freshGame();

// Derived values, rebuilt by recompute() whenever something that affects them changes.
const D = {
  each: Array(N).fill(0), mult: 1, raw: 0, tpsBase: 0, tpsGross: 0, bugsEating: 0, tps: 0, click: 1, clickBase: 1, clickPct: 0,
  flow: 0, flowMult: 1, flowBonus: 0, gpct: 0, prestigeBonus: 0, memProd: 1, ghost: 0, buffProd: 1, buffClick: 1,
  eurekaFreq: 1, eurekaLife: 1, effDur: 1, bugMult: 1, bugFreq: 1,
  bldDiscount: 1, upgDiscount: 1, buffCost: 1, offline: 0.1, focusMax: 0, focusRegen: 0,
};

// Countdown timers (seconds).
// Eureka tokens are rare: the first one takes about 4-10 minutes.
const EUREKA_RARITY = 5;
const T = { eureka: rand(45, 120) * EUREKA_RARITY, bug: rand(120, 240), ach: 1 };

// ---------- Flow ----------
const FLOW_PROD = 0.25;            // production bonus per 100% Flow
const bubbleDelay = () => (clamp(45 / (1 + D.flow), 6, 45) * rand(0.7, 1.3)) / memMul(['foam', 2]); // seconds between Flow bubbles
// The tide rises through each 100% of Flow, then drops back to the bottom as the next, stronger kind of tide.
const TIDE_STEP = 1;
const TIDES = [
  { name: 'Clay Tide', dot: '#D97757' }, { name: 'Gold Tide', dot: '#F2C57C' }, { name: 'Mint Tide', dot: '#8FD3B6' },
  { name: 'Lilac Tide', dot: '#B79CFF' }, { name: 'Crystal Tide', dot: '#9FE3FF' }, { name: 'Ember Tide', dot: '#FF8A3D' },
  { name: 'Prism Tide', dot: '#FF9AD5' },
];
const tideTier = () => clamp(Math.floor(D.flow / TIDE_STEP + 1e-9), 0, TIDES.length - 1);
const tideFrac = () => clamp((D.flow - tideTier() * TIDE_STEP) / TIDE_STEP, 0, 1); // how full the current tide is
const bubbleValue = () => Math.max(D.tpsGross * 15, 10) * (1 + D.flow) * (1 + 0.1 * tideTier()) * memMul(['tidal', 1.5], ['foam', 2]); // 15 s of production, times Flow, +10% per tide
function popBubble() {
  const gain = bubbleValue();
  earn(gain);
  G.bubbles++;
  return gain;
}

// Bugs currently eating at the sparkle (set by the bug layer).
const INFEST_ZERO_AT = 9;
let bugsEating = 0;
function setBugsEating(n) {
  if (n === bugsEating) return;
  bugsEating = n;
  recompute();
}

const hasUpg = id => G.upgrades.has(id);
const hasMem = id => G.mem.has(id);
const memMul = (...pairs) => pairs.reduce((v, [id, k]) => (hasMem(id) ? v * k : v), 1);
const totalOwned = () => G.owned.reduce((a, b) => a + b, 0);
const allTimeEarned = () => G.prevEarned + G.earned;
const safe = fn => { try { return fn(); } catch (e) { return false; } };

function recompute() {
  D.flow = G.achievements.size * 0.04;
  let x2 = 0, fingers = 0, fm = 1, clickPct = 0, gpct = 0, flowMult = 1;
  const doubles = Array(N).fill(0);
  D.eurekaFreq = 1; D.eurekaLife = 1; D.effDur = 1; D.bugMult = 1; D.bugFreq = 1;

  const synergies = [];
  let upClick = 1;
  for (const id of G.upgrades) {
    const u = UPG[id];
    if (!u) continue;
    switch (u.kind) {
      case 'synergy': synergies.push(u); break;
      case 'clickmult': upClick *= u.m; break;
      case 'tier': doubles[u.b]++; break;
      case 'cursor': if (u.x2) x2++; fingers += u.fingers; fm *= u.fm; break;
      case 'click': clickPct += 1; break;
      case 'global': gpct += u.pct; break;
      case 'flow': flowMult *= 1 + D.flow * u.k; break;
      case 'golden': D.eurekaFreq *= u.freq || 1; D.eurekaLife *= u.life || 1; D.effDur *= u.dur || 1; break;
      case 'bug': D.bugMult *= u.bugMult || 1; D.bugFreq *= u.bugFreq || 1; break;
    }
  }
  // CLAUDE.md memories.
  D.eurekaFreq *= memMul(['instinct', 1.15], ['clover', 1.15], ['golden', 1.2], ['serendip', 2]);
  D.eurekaLife *= hasMem('linger') ? (EUREKA_LIFE + 2) / EUREKA_LIFE : 1;
  D.effDur *= memMul(['streak', 1.2]);
  D.bugMult *= memMul(['bugnet', 2]);
  D.bldDiscount = memMul(['discount', 0.9]);
  D.upgDiscount = memMul(['coupons', 0.9]);
  D.offline = hasMem('background') ? 1 : hasMem('resume') ? 0.5 : 0.1;

  // Multi-cursor: +X per non-Autocomplete building, for each Autocomplete and each click.
  const add = fingers * fm * (totalOwned() - G.owned[0]);
  D.each[0] = 0.1 * Math.pow(2, x2) + add;
  for (let i = 1; i < N; i++) {
    D.each[i] = BUILDINGS[i].tps * Math.pow(2, doubles[i]);
  }
  D.each[0] *= memMul(['tap', 1.5]);
  D.each[1] *= memMul(['mentor', 2]);
  D.each[2] *= memMul(['duck', 2]);
  if (hasMem('mono')) {
    // Monolith: the building type you own the most of (the later one on a tie) produces 3x.
    let top = -1;
    for (let i = 0; i < N; i++) if (G.owned[i] && (top < 0 || G.owned[i] >= G.owned[top])) top = i;
    if (top >= 0) D.each[top] *= 3;
  }
  // Synergies: building A +1% per B owned, B +0.2% per A owned.
  for (const u of synergies) {
    D.each[u.a] *= 1 + 0.01 * G.owned[u.b];
    D.each[u.b] *= 1 + 0.002 * G.owned[u.a];
  }
  // Building levels from compute credits: +1% each.
  for (let i = 0; i < N; i++) if (G.levels[i]) D.each[i] *= 1 + 0.01 * G.levels[i];
  for (const m of SYSTEMS) if (m.each) m.each(D.each);
  D.costMul = BUILDINGS.map((_, i) => modProduct('costOf', i) * (challengeDone('noupgrade') ? 0.95 : 1));
  D.upgDiscount *= modProduct('upgCost');
  D.eurekaFreq *= modProduct('eureka');
  D.effDur *= modProduct('effDur');
  D.bugMult *= modProduct('bugMult');
  D.offline = Math.min(1, D.offline + modSum('offline'));

  D.prestigeBonus = G.prestige * (hasMem('eternal') ? 0.03 : hasMem('deep') ? 0.02 : 0.01);
  const types = G.owned.filter(n => n > 0).length;
  D.memProd = memMul(['arch1', 1.1], ['arch2', 1.15]) * (hasMem('micro') ? 1 + 0.03 * types : 1) * (hasMem('compound') ? 1 + 0.04 * G.compacts : 1);
  D.gpct = gpct;
  D.flowMult = flowMult;
  // Flow itself: +0.25% production for every 1% Flow (4% Flow per achievement), on top of the Engineer upgrades.
  D.flowBonus = D.flow * FLOW_PROD * modProduct('flow') * memMul(['tidal', 1.5]);
  const challengeMult = (inChallenge('halfspeed') ? 0.5 : 1) * (challengeDone('noclick') ? 1.1 : 1) * (challengeDone('halfspeed') ? 1.05 : 1);
  D.mult = (1 + gpct / 100) * flowMult * (1 + D.flowBonus) * (1 + D.prestigeBonus) * D.memProd * challengeMult * modProduct('prod') * (G.dev.on ? G.dev.mult : 1);

  let raw = 0;
  for (let i = 0; i < N; i++) raw += Math.max(0, G.owned[i] - awayOf(i)) * D.each[i];
  D.raw = raw;
  D.tpsBase = raw * D.mult;

  let bp = 1, bc = 1, bcost = 1;
  for (const b of G.buffs) { bp *= b.prod || 1; bc *= b.click || 1; bcost *= b.cost || 1; }
  D.buffCost = bcost;
  D.buffProd = bp;
  D.buffClick = bc;
  // Bugs clinging to the sparkle each eat 1/9 of production: 9 bugs = 0 per second, 10 = negative.
  D.tpsGross = D.tpsBase * bp;
  D.bugsEating = bugsEating;
  D.drain = modSum('drain');
  D.tps = D.tpsGross * (1 - bugsEating / INFEST_ZERO_AT - D.drain);

  D.clickBase = Math.pow(2, x2) + add;
  clickPct += (hasMem('carpal') ? 1 : 0) + (hasMem('godhand') ? 2 : 0);
  D.clickPct = clickPct;
  D.click = (D.clickBase + (D.tpsGross * clickPct) / 100) * bc * upClick * memMul(['muscle', 1.5], ['ten', 2], ['thousand', 3], ['godhand', 5]) *
    (challengeDone('halfspeed') ? 1.25 : 1) * modProduct('click');

  const s = G.owned[5];
  D.focusMax = s > 0 ? Math.floor(10 + 4 * Math.pow(s, 0.7)) : 0;
  D.focusRegen = (0.1 + D.focusMax * 0.004) * memMul(['quiet', 1.5]);
  // Ghost Clicker: three clicks a second, counted as production.
  D.ghost = hasMem('ghost') && !inChallenge('noclick') ? D.click * 3 : 0;
  D.tps += D.ghost;
  G.focus = Math.min(G.focus, D.focusMax);
}

// ---------- economy ----------
function earn(n) {
  if (!(n > 0)) return;
  G.tokens = Math.min(Number.MAX_VALUE, G.tokens + n);
  G.earned = Math.min(Number.MAX_VALUE, G.earned + n);
}

const devFree = () => G.dev.on && G.dev.free;
function bulkCost(i, n) {
  if (devFree()) return 0;
  const base = BUILDINGS[i].cost * D.bldDiscount * D.buffCost * (D.costMul ? D.costMul[i] : 1), o = G.owned[i];
  return Math.ceil((base * (Math.pow(1.15, o + n) - Math.pow(1.15, o))) / 0.15);
}
function sellValue(i, n) {
  const o = G.owned[i];
  n = Math.min(n, o);
  const base = BUILDINGS[i].cost * D.bldDiscount;
  return Math.floor(((base * (Math.pow(1.15, o) - Math.pow(1.15, o - n))) / 0.15) * 0.25);
}
const upgCost = u => (devFree() ? 0 : Math.ceil(u.cost * D.upgDiscount));

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
  n = Math.min(n, G.owned[i] - awayOf(i));
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
  if (!u || hasUpg(id) || !safe(u.unlock) || inChallenge('noupgrade')) return false;
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
// Rate Limited event: the sparkle ignores clicks until this time (performance.now()).
let clickBlockedUntil = 0;
const rateLimited = () => performance.now() < clickBlockedUntil;
let lastCrit = false;
function clickSparkle() {
  if (rateLimited()) { emit('blockedClick'); return 0; }
  let v = inChallenge('noclick') ? 0 : D.click;
  // Combo Chain: every 25th click is critical. In the Zone: clicks triple during a good Eureka effect.
  lastCrit = hasMem('combo') && (G.clicks + 1) % 25 === 0;
  if (lastCrit) v *= 25;
  if (hasMem('zone') && G.buffs.some(b => !b.bad && (b.prod > 1 || b.click > 1))) v *= 3;
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
    G.buffs.push({ key, name, t: dur, dur, prod: eff.prod || 1, click: eff.click || 1, cost: eff.cost || 1, desc: eff.desc || '', bad: !!eff.bad });
  }
  recompute();
}

// ---------- Eureka tokens (golden) and bugs ----------
const eurekaDelay = () => (rand(90, 240) * EUREKA_RARITY) / D.eurekaFreq;
const EUREKA_LIFE = 3; // seconds on screen before it vanishes (Lucky Day and Serendipity extend it)
const bugDelay = () => rand(180, 360) / D.bugFreq;

// Every Eureka effect with its weight. Weights are percentages: five at 10%, eight at 5%, five at 2%.
// An effect whose `ok` check fails right now is skipped and the rest are re-weighted.
const secs = d => `${Math.round(d)} seconds`;
const INFEST_BUGS = 10, INFEST_TIME = 45; // bugs per infestation, seconds before leftover bugs give up
const luckMult = () => memMul(['golden', 1.5]);
const EUREKA = [
  // ----- common (10% each) -----
  { id: 'frenzy', name: 'Vibe Coding', desc: 'Production ×7 for 77 seconds.', w: 10, run(d) {
    addBuff('frenzy', 'Vibe Coding', 77 * d, { prod: 7 });
    return ['Vibe Coding!', `Production <b>×7</b> for ${secs(77 * d)}.`];
  } },
  { id: 'lucky', name: 'Lucky Commit', desc: 'Instantly gain 15 minutes of production, up to 15% of your bank.', w: 10, run() {
    const g = (Math.min(G.tokens * 0.15, D.tpsGross * 900) + 13) * luckMult();
    earn(g);
    return ['Lucky Commit!', `<b>+${fmt(g)}</b> tokens.`];
  } },
  { id: 'hotreload', name: 'Hot Reload', desc: 'Production ×3 for 2 minutes.', w: 10, run(d) {
    addBuff('hotreload', 'Hot Reload', 120 * d, { prod: 3 });
    return ['Hot Reload!', `Production <b>×3</b> for ${secs(120 * d)}.`];
  } },
  { id: 'infest', name: 'Bug Infestation', desc: 'Bad luck: 10 bugs run from the screen edges to the sparkle. Each one that reaches it eats 1/9 of your production (9 bugs = nothing, 10 = your bank drains). Squashing a bug stops it, but you get nothing back. Leftover bugs leave after 45 seconds.', w: 10, bad: true, run() {
    emit('infestation', INFEST_BUGS);
    addBuff('infest', 'Bug Infestation', INFEST_TIME, { bad: true });
    return ['Bug Infestation!', `${INFEST_BUGS} bugs are running for the sparkle. Each one that reaches it eats <b>1/9</b> of your production. <b>Squash them!</b>`];
  } },
  { id: 'greenbuild', name: 'Green Build', desc: 'Buildings cost 20% less for 60 seconds.', w: 10, run(d) {
    addBuff('greenbuild', 'Green Build', 60 * d, { cost: 0.8 });
    return ['Green Build!', `Buildings cost <b>20% less</b> for ${secs(60 * d)}.`];
  } },
  // ----- uncommon (5% each) -----
  { id: 'clickfrenzy', name: 'Keyboard on Fire', desc: 'Clicking power ×777 for 13 seconds.', w: 5, run(d) {
    addBuff('clickfrenzy', 'Keyboard on Fire', 13 * d, { click: 777 });
    return ['Keyboard on Fire!', `Clicking power <b>×777</b> for ${secs(13 * d)}.`];
  } },
  { id: 'hyper', name: 'Building Hyperfocus', desc: 'A building type you own at least 10 of boosts production by +10% per building for 30 seconds.', w: 5, ok: () => G.owned.some(n => n >= 10), run(d) {
    const i = pick(BUILDINGS.map((_, k) => k).filter(k => G.owned[k] >= 10)), n = G.owned[i];
    addBuff('hyper' + i, `${BUILDINGS[i].name} Hyperfocus`, 30 * d, { prod: 1 + n * 0.1, desc: `Your ${n} ${BUILDINGS[i].plural} boost production by +${n * 10}%.` });
    return [`${BUILDINGS[i].name} Hyperfocus!`, `Your ${n} ${BUILDINGS[i].plural} boost production by <b>+${n * 10}%</b> for ${secs(30 * d)}.`];
  } },
  { id: 'rain', name: 'Token Rain', desc: '16 golden tokens fall down the screen. Each one you catch is worth 20 seconds of production.', w: 5, run() {
    emit('tokenRain', 16);
    return ['Token Rain!', 'Golden tokens are falling. Click them before they hit the floor.'];
  } },
  { id: 'goldbug', name: 'Bug Report', desc: 'A golden bug crawls across the screen. Squash it for 10 minutes of production.', w: 5, run() {
    emit('spawnBug', true);
    return ['Bug Report!', 'A golden bug is loose. Squash it for <b>10 minutes</b> of production.'];
  } },
  { id: 'review', name: 'Code Review Approved', desc: 'Your cheapest available upgrade is installed for free.', w: 5, ok: () => visibleUpgrades().length > 0, run() {
    const u = visibleUpgrades()[0];
    G.upgrades.add(u.id);
    recompute();
    return ['Code Review Approved!', `<b>${u.name}</b> was installed for free.`];
  } },
  { id: 'deepthought', name: 'Deep Thought', desc: 'Production ×2 for 3 minutes.', w: 5, run(d) {
    addBuff('deepthought', 'Deep Thought', 180 * d, { prod: 2 });
    return ['Deep Thought!', `Production <b>×2</b> for ${secs(180 * d)}.`];
  } },
  { id: 'focus', name: 'Focus Restored', desc: 'Refills your slash command Focus.', w: 5, ok: () => D.focusMax > 0 && G.focus < D.focusMax - 1, run() {
    G.focus = D.focusMax;
    return ['Focus Restored!', 'Your slash command Focus is <b>full</b> again.'];
  } },
  { id: 'hiring', name: 'Hiring Spree', desc: 'One free building of every type you already own.', w: 5, ok: () => totalOwned() > 0, run() {
    let k = 0;
    for (let i = 0; i < N; i++) if (G.owned[i] > 0) { G.owned[i]++; k++; }
    recompute();
    return ['Hiring Spree!', `<b>One free building</b> of each of your ${k} building type${k === 1 ? '' : 's'}.`];
  } },
  // ----- rare (2% each) -----
  { id: 'spike', name: 'Singularity Spike', desc: 'Production ×666 for 6 seconds.', w: 2, run(d) {
    addBuff('spike', 'Singularity Spike', 6 * d, { prod: 666 });
    return ['Singularity Spike!', `Production <b>×666</b> for ${secs(6 * d)}.`];
  } },
  { id: 'timeskip', name: 'Time Skip', desc: 'Instantly gain 2 hours of production.', w: 2, run() {
    const g = (D.tpsGross * 7200 + 13) * luckMult();
    earn(g);
    return ['Time Skip!', `The Git Time Machine fetched <b>2 hours</b> of production: <b>+${fmt(g)}</b> tokens.`];
  } },
  { id: 'chain', name: 'Golden Chain', desc: 'Three more Eureka tokens appear, one after another.', w: 2, run() {
    emit('eurekaChain', 3);
    return ['Golden Chain!', '<b>Three more</b> Eureka tokens are on their way.'];
  } },
  { id: 'double', name: 'Double Down', desc: 'Your bank grows by its own size, up to 2 hours of production.', w: 2, run() {
    const g = (Math.min(G.tokens, D.tpsGross * 7200) + 13) * luckMult();
    earn(g);
    return ['Double Down!', `Your bank grew by <b>+${fmt(g)}</b> tokens (up to 2 hours of production).`];
  } },
  { id: 'fullsend', name: 'Full Send', desc: 'Vibe Coding (production ×7) and Keyboard on Fire (clicking ×777) at the same time.', w: 2, run(d) {
    addBuff('frenzy', 'Vibe Coding', 77 * d, { prod: 7 });
    addBuff('clickfrenzy', 'Keyboard on Fire', 13 * d, { click: 777 });
    return ['Full Send!', '<b>Vibe Coding</b> and <b>Keyboard on Fire</b> at the same time.'];
  } },
];

// Rarity tier from an effect's weight: 1 = common (10%), 2 = rare (5%), 3 = legendary (2%).
const eurekaTier = e => (e.w >= 10 ? 1 : e.w >= 5 ? 2 : 3);
const EUREKA_TIERS = { 1: 'Common', 2: 'Rare', 3: 'Legendary' };

// The effect is rolled when the token appears, so the token can show how rare it is.
function eurekaRoll() {
  const pool = EUREKA.filter(e => !e.ok || safe(e.ok));
  let r = Math.random() * pool.reduce((sum, e) => sum + e.w, 0), eff = pool[0];
  for (const e of pool) { if ((r -= e.w) < 0) { eff = e; break; } }
  return eff;
}

// Roll an effect from one rarity tier only (used by the Dev tab).
function eurekaRollTier(tier) {
  const pool = EUREKA.filter(e => eurekaTier(e) === tier && (!e.ok || safe(e.ok)));
  return pool.length ? pick(pool) : eurekaRoll();
}

function eurekaEffect(eff) {
  G.goldenClicks++;
  // If the rolled effect stopped being possible while the token was up, roll again.
  if (!eff || (eff.ok && !safe(eff.ok))) eff = eurekaRoll();
  const [title, text] = eff.run(D.effDur);
  recompute();
  return { title, text, id: eff.id, bad: !!eff.bad, tier: eurekaTier(eff) };
}

function bugReward(golden) {
  G.bugsSquashed++;
  const gain = Math.max(D.tpsGross * 60, 25) * D.bugMult * (golden ? 10 : 1);
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
const PRESTIGE_BASE = 1e9; // all-time tokens for the first level; level n needs n^3 times this
const prestigeFor = total => Math.floor(Math.cbrt(total / PRESTIGE_BASE));
const pendingPrestige = () => Math.max(0, prestigeFor(allTimeEarned()) - G.prestige);

function compact() {
  const gain = pendingPrestige();
  G.prestige += gain;
  G.memories += gain;
  G.compacts++;
  G.prevEarned += G.earned;
  const keep = hasMem('hotcache') ? 0.25 : hasMem('cache') ? 0.1 : 0, kept = G.owned.map(n => Math.floor(n * keep));
  Object.assign(G, freshRun());
  G.owned = kept;
  const atLeast = (i, n) => { G.owned[i] = Math.max(G.owned[i], n); };
  if (hasMem('starter')) atLeast(0, 25);
  if (hasMem('onboarding')) { atLeast(1, 15); atLeast(2, 10); }
  recompute();
  T.eureka = rand(45, 120) * EUREKA_RARITY;
  emit('reset');
  return gain;
}

// Start a challenge: /compact as normal, then play the new run under the challenge rule.
function startChallenge(id) {
  if (!CHALLENGES.some(c => c.id === id) || G.challenge) return 0;
  const gain = compact();
  G.challenge = id;
  recompute();
  return gain;
}
function abandonChallenge() {
  G.challenge = null;
  recompute();
}

// Where a memory stands: owned, open (can be learned now or once you have the memories), locked, or excluded by a fork choice.
function memState(m) {
  if (hasMem(m.id)) return 'owned';
  if (m.excl && MEMORY.some(o => o.excl === m.excl && o.id !== m.id && hasMem(o.id))) return 'excluded';
  if (!m.req.every(hasMem) || (m.any.length && !m.any.some(hasMem))) return 'locked';
  return G.memories >= m.cost ? 'can' : 'poor';
}
function buyMemory(id) {
  const m = MEM[id];
  if (!m || memState(m) !== 'can') return false;
  G.memories -= m.cost;
  G.memSpent += m.cost;
  G.mem.add(id);
  recompute();
  return true;
}
// Rewrite CLAUDE.md: forget every memory and get back everything spent on them.
function rewriteMemories() {
  const back = G.memSpent;
  G.memories += back;
  G.memSpent = 0;
  G.mem.clear();
  recompute();
  return back;
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
  if (!Number.isFinite(G.tokens) || !Number.isFinite(G.earned)) {
    G.tokens = Number.isNaN(G.tokens) ? 0 : Math.min(G.tokens, Number.MAX_VALUE);
    G.earned = Number.isNaN(G.earned) ? G.tokens : Math.min(G.earned, Number.MAX_VALUE);
  }
  if (D.tps < 0) G.tokens = Math.max(0, G.tokens + D.tps * dt); // a full infestation drains the bank
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
  if (G.dev.on && G.dev.infFocus) G.focus = D.focusMax;
  if (G.dev.on && G.dev.fastEureka) T.eureka = Math.min(T.eureka, 5);

  T.eureka -= dt;
  if (T.eureka <= 0) { T.eureka = eurekaDelay(); emit('spawnEureka', false); }
  T.bug -= dt;
  if (T.bug <= 0) { T.bug = bugDelay(); if (G.earned >= 500) emit('spawnBug'); }
  for (const m of SYSTEMS) if (m.tick) m.tick(dt);
  T.ach -= dt;
  if (T.ach <= 0) {
    T.ach = 1;
    // One compute credit per real day, even while the game is closed.
    while (Date.now() - G.creditAt >= DAY_MS) { G.credits++; G.creditAt += DAY_MS; emit('credit'); }
    if (G.challenge) {
      const c = CHALLENGES.find(x => x.id === G.challenge);
      if (c && G.earned >= c.goal) {
        G.challenge = null;
        if (!G.challengesDone.includes(c.id)) G.challengesDone.push(c.id);
        recompute();
        emit('challengeDone', c);
      }
    }
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
  for (const k of ['tokens', 'earned', 'handmade', 'prevEarned', 'clicks', 'goldenClicks', 'bugsSquashed', 'spellsCast', 'bubbles',
    'compacts', 'prestige', 'memories', 'memSpent', 'focus', 'runStart', 'gameStart']) g[k] = num(o[k], g[k]);
  g.owned = BUILDINGS.map((_, i) => Math.max(0, Math.floor(num(o.owned[i]))));
  g.producedBy = BUILDINGS.map((_, i) => num((o.producedBy || [])[i]));
  g.upgrades = new Set((o.upgrades || []).filter(id => UPG[id]));
  g.achievements = new Set((o.achievements || []).filter(id => ACH[id]));
  g.mem = new Set((o.mem || []).filter(id => MEM[id]));
  // Saves from before the tree was rebuilt did not track spending: count it at the old prices.
  if (typeof o.memSpent !== 'number') g.memSpent = [...g.mem].reduce((t, id) => t + (LEGACY_MEM_COST[id] || MEM[id].cost), 0);
  g.buffs = (Array.isArray(o.buffs) ? o.buffs : [])
    .filter(b => b && typeof b.key === 'string' && num(b.t) > 0)
    .map(b => ({ key: b.key, name: String(b.name || ''), t: num(b.t), dur: num(b.dur, num(b.t)), prod: num(b.prod, 1), click: num(b.click, 1), cost: num(b.cost, 1), desc: String(b.desc || ''), bad: !!b.bad }));
  Object.assign(g.settings, o.settings || {});
  Object.assign(g.stats, o.stats || {});
  Object.assign(g.dev, o.dev || {});
  g.challenge = CHALLENGES.some(c => c.id === o.challenge) ? o.challenge : null;
  g.challengesDone = (Array.isArray(o.challengesDone) ? o.challengesDone : []).filter(id => CHALLENGES.some(c => c.id === id));
  g.credits = Math.max(0, Math.floor(num(o.credits, 1)));
  g.creditAt = num(o.creditAt, Date.now());
  g.levels = BUILDINGS.map((_, i) => Math.max(0, Math.floor(num((o.levels || [])[i]))));
  for (const sys of SYSTEMS) {
    if (!sys.key) continue;
    try { g[sys.key] = o[sys.key] ? sys.load(o[sys.key]) : sys.fresh(); } catch (e) { console.warn('Reset', sys.key, e); g[sys.key] = sys.fresh(); }
  }
  g.blackhole = !!o.blackhole;
  g.theme = g.blackhole && o.theme === 'horizon' ? 'horizon' : 'classic';
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
  for (const sys of SYSTEMS) if (sys.key) G[sys.key] = sys.fresh();
  recompute();
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
  emit('reset');
}
