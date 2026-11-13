// Estimates what players earn under the economy in js/progress.js (ECONOMY), using the game's own
// chest rolls. Run: node tools/economy-report.js
// Part 1: a day's income for five kinds of player, held at fixed trophies and account level.
// Part 2: a whole career, day by day, with upgrades, to see when milestones arrive.
// Assumptions are in PROFILES and CAREER below; change them and run again.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['cards.js', 'trainers.js', 'sim.js', 'bot.js', 'progress.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const G = KCProgress;
const mem = data => { const m = new Map(Object.entries(data || {})); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
const rand = KCSim.mulberry(2026);
const xpForLevel = lv => (lv - 1) * G.XP_PER_LEVEL;

// wins a day, and how many hours a day a chest is unlocking (a chest is always unlocking while
// the player is around; long chests run overnight)
const PROFILES = [
  { name: 'New player, low trophies', trophies: 60, level: 2, wins: 6, battles: 11, unlockHours: 6 },
  { name: 'Early Arena 1', trophies: 200, level: 6, wins: 8, battles: 15, unlockHours: 10 },
  { name: 'Mid game, Arena 3 to 4', trophies: 850, level: 18, wins: 10, battles: 19, unlockHours: 16 },
  { name: 'Advanced, high trophies', trophies: 2000, level: 32, wins: 12, battles: 23, unlockHours: 20 },
  { name: 'Late game, chasing level 15', trophies: 4000, level: 40, wins: 15, battles: 28, unlockHours: 22 },
];

// One day of chests: wins earn chests in the cycle (while a slot is free); the unlock hours limit
// how many open. The chests left over carry to the next day.
function dayOfChests(st, wins, unlockHours) {
  const opened = [];
  const open = () => {
    while (st.slots.length) {
      const i = st.slots.reduce((b, t, k) => (G.CHESTS[t].seconds < G.CHESTS[st.slots[b]].seconds ? k : b), 0);  // shortest first
      const need = G.CHESTS[st.slots[i]].seconds;
      if (need > st.budget) break;
      st.budget -= need; opened.push(st.slots.splice(i, 1)[0]);
    }
  };
  // the day's unlock time arrives between the wins, so slots empty as the player plays
  for (let w = 0; w < wins; w++) {
    st.budget += unlockHours * 3600 / wins;
    if (st.slots.length < 4) { st.slots.push(G.capChest(G.CYCLE[st.cycle % G.CYCLE.length])); st.cycle++; }
    open();
  }
  st.budget = Math.min(st.budget, 12 * 3600);   // unused time carries over, at most a night's worth
  return opened;
}

const rarityOf = id => KC_CARDS[id].rarity;
function daily(p) {
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: p.trophies, best: p.trophies, xp: xpForLevel(p.level), claimed: { 0: true } }) }));
  const st = { slots: [], cycle: 0, budget: 0 }, DAYS = 120;
  const sum = { gold: 0, winGold: 0, chests: 0, common: 0, rare: 0, epic: 0, legendary: 0 };
  const pool = G.chestPool();
  for (let d = 0; d < DAYS; d++) {
    for (const t of dayOfChests(st, p.wins, p.unlockHours)) {
      const c = G.roll(t, rand); sum.chests++; sum.gold += c.rubies;
      for (const x of c.cards) sum[rarityOf(x.id)] += x.n;
    }
    const f = G.roll(G.ECONOMY.freeChest.type, rand, { bonus: G.ECONOMY.freeChest.bonus });
    sum.gold += f.rubies; for (const x of f.cards) sum[rarityOf(x.id)] += x.n;
    sum.winGold += Math.min(p.wins, G.ECONOMY.winGold.dailyCap) * G.winGold();
  }
  const per = k => sum[k] / DAYS, n = r => pool.filter(id => rarityOf(id) === r).length || 1;
  return { chests: per('chests'), gold: per('gold') + per('winGold'), winGold: per('winGold'),
    common: per('common'), rare: per('rare'), epic: per('epic'), legendary: per('legendary'),
    perCard: { common: per('common') / n('common'), rare: per('rare') / n('rare'), epic: per('epic') / n('epic'), legendary: per('legendary') / n('legendary') } };
}

const f0 = x => Math.round(x).toLocaleString('en-US'), f1 = x => (x < 10 ? x.toFixed(2) : x.toFixed(1));
console.log('Part 1: one day for each kind of player (average of 120 days, free daily chest and win gold included)\n');
console.log('| Player | Trophies | Level | Wins | Chests | Rubies | (of it from wins) | Commons | Rares | Epics | Legendaries | Per common card | Per rare card |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const p of PROFILES) {
  const r = daily(p);
  console.log(`| ${p.name} | ${f0(p.trophies)} | ${p.level} | ${p.wins} | ${f1(r.chests)} | ${f0(r.gold)} | ${f0(r.winGold)} | ${f0(r.common)} | ${f1(r.rare)} | ${f1(r.epic)} | ${f1(r.legendary)} | ${f1(r.perCard.common)} | ${f1(r.perCard.rare)} |`);
}

// Part 2: a career. Trophies follow CAREER.trophies (day -> trophies, straight lines between points);
// wins and unlock hours follow the profile for those trophies. Road rewards are claimed as reached,
// the free pass path once. Rubies go into the deck: the lowest card first (spread), or one favourite
// card first (focused). Wild cards and the Shop aren't counted, so real players go a little faster.
const CAREER = { trophies: [[0, 0], [5, 300], [12, 600], [21, 900], [35, 1200], [90, 1700], [200, 2500], [400, 3500], [700, 4500], [900, 5500], [1100, 6200]], days: 1100 };
const trophiesOn = d => { const T = CAREER.trophies; for (let i = 1; i < T.length; i++) if (d <= T[i][0]) return Math.round(T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (d - T[i - 1][0]) / (T[i][0] - T[i - 1][0])); return T[T.length - 1][1]; };
const profileFor = t => PROFILES.slice().reverse().find(p => t >= p.trophies) || PROFILES[0];

function career(focused, pace = 1, slow = 1, rich = false) {
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 0, best: 0, claimed: { 0: true } }) }));
  const P = G.state, st = { slots: [], cycle: 0, budget: 0 }, deck = KC_STARTER_DECK.slice(), fav = 'wolves';
  const marks = {}, mark = (k, d) => { if (marks[k] === undefined) marks[k] = d; };
  let passDone = false;
  for (let d = 1; d <= CAREER.days; d++) {
    const t = trophiesOn(Math.floor(d / slow)), q = profileFor(t), p = Object.assign({}, q, { wins: Math.max(1, Math.round(q.wins * pace)), battles: Math.round(q.battles * pace), unlockHours: q.unlockHours * pace });
    P.trophies = t; P.best = Math.max(P.best, t);
    P.xp += p.wins * 20 + (p.battles - p.wins) * 6;
    for (const m of G.ROAD) if (G.roadState(m) === 'ready') G.claim(m.at);
    if (!passDone && G.passOpen()) { for (const x of G.PASS.tiers) if (x.free.kind === 'rubies') P.rubies += x.free.n; passDone = true; }
    for (const type of dayOfChests(st, p.wins, p.unlockHours)) { const c = G.roll(type, rand); P.rubies += c.rubies; for (const x of c.cards) P.cards[x.id].count += x.n; }
    const f = G.roll(G.ECONOMY.freeChest.type, rand, { bonus: G.ECONOMY.freeChest.bonus }); P.rubies += f.rubies; for (const x of f.cards) P.cards[x.id].count += x.n;
    P.rubies += Math.min(p.wins, G.ECONOMY.winGold.dailyCap) * G.winGold();
    if (rich) { P.wallet = 1e9; G.exchange(G.exchangeInfo(d * 86400e3).left, d * 86400e3); }   // swaps the daily limit every day
    // spend
    for (let guard = 0; guard < 200; guard++) {
      const order = deck.filter(id => G.upgradeInfo(id).can).sort((a, b) => (focused ? (b === fav) - (a === fav) : 0) || P.cards[a].level - P.cards[b].level);
      if (!order.length) break;
      G.upgrade(order[0]);
    }
    const lv = deck.map(id => P.cards[id].level), top = Math.max(...lv), avg = lv.reduce((a, v) => a + v, 0) / lv.length;
    for (const k of [7, 9, 11, 13, 14, 15]) if (top >= k) mark('first card at ' + k, d);
    for (const k of [7, 10, 12, 14]) if (Math.min(...lv) >= k) mark('whole deck at ' + k, d);
    if (Math.min(...lv) >= 15) { mark('whole deck at 15', d); break; }
    for (const T of [600, 900, 1200, 2000]) if (t >= T && !marks['cards at ' + T + ' trophies']) marks['cards at ' + T + ' trophies'] = `day ${d}: ${lv.join(' ')}`;
    if (d === 14) marks['deck levels after 2 weeks'] = lv.join(' ');
    if (d === 90) marks['deck levels after 3 months'] = lv.join(' ');
    if (d === 365) marks['deck levels after 1 year'] = lv.join(' ');
  }
  return marks;
}
const asTime = d => (typeof d !== 'number' ? d : d < 60 ? `day ${d}` : d < 730 ? `day ${d} (about ${(d / 30.4).toFixed(1)} months)` : `day ${d} (about ${(d / 365).toFixed(1)} years)`);
console.log('\nPart 2: one career (starter deck; trophies ' + CAREER.trophies.map(([d, t]) => `${t} by day ${d}`).join(', ') + ')\n');
const spread = career(false), focus = career(true), casual = career(false, 0.5, 1.6), rich = career(false, 1, 1, true);
console.log('| Milestone | Spreading rubies over the deck | Focusing one card first | Casual: half the play, trophies 1.6x slower | Wallet-rich: swaps the daily Coin limit every day |');
console.log('|---|---|---|---|---|');
const keys = new Set([...Object.keys(spread), ...Object.keys(focus), ...Object.keys(casual), ...Object.keys(rich)]);
for (const k of keys) console.log(`| ${k} | ${[spread, focus, casual, rich].map(m => asTime(m[k]) || (k.startsWith('deck levels') ? 'all at 15 already' : 'not within 3 years')).join(' | ')} |`);

// Part 3: careers on the ladder. Trophies now come from battles instead of CAREER: each opponent is found
// the way the game finds them (G.MATCH: a little below you, a breather after losses in a row), their cards
// follow ECONOMY.foeLevels, and a battle is won with a chance that follows the gap between your average
// card level and theirs (a logistic curve, LADDER.slope a level) plus how well you play (`edge`, in the
// same units: 1 is about one card level). Trophies change by G.stakes, never below the arena floor.
// Chests, rubies and upgrades are as in Part 2 (spreading rubies over the deck).
// Assumptions: an average player plays even with an opponent of their own trophies whose cards are as
// good as theirs; past 4,000 trophies (where cards reach 15) the opponents' better play (G.FOE_SKILL) is
// worth up to `topPlay` levels at 7,000; and players get a little better with practice (`learn` a year, at
// most `learnMax`).
const LADDER = {
  slope: 1.1, topPlay: 1.2, learn: 0.4, learnMax: 0.8,
  players: [['average', 'An average player', 0, 1], ['strong', 'A strong player (plays about a level above their cards)', 1, 1],
    ['casual', 'A casual player (half the battles, plays a little worse)', -0.5, 0.5]],
  days: 1100,
};
const G_curve = (C, x) => { if (x <= C[0][0]) return C[0][1]; for (let i = 1; i < C.length; i++) if (x < C[i][0]) return C[i - 1][1] + (C[i][1] - C[i - 1][1]) * (x - C[i - 1][0]) / (C[i][0] - C[i - 1][0]); return C[C.length - 1][1]; };
function ladder(edge, pace) {
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 0, best: 0, claimed: { 0: true } }) }));
  const P = G.state, st = { slots: [], cycle: 0, budget: 0 }, deck = KC_STARTER_DECK.slice(), M = G.MATCH, r = KCSim.mulberry(77);
  const marks = {}, foeAvg = t => { const base = 1 + G.foeUpgrades(t) / 8; return deck.reduce((a, id) => a + Math.max(KC_MIN_LEVEL(id), base), 0) / deck.length; };
  let T = 0, streak = 0, n = 0, w = 0, best = 0, passDone = false, gap = 0;
  for (let d = 1; d <= LADDER.days; d++) {
    const q = profileFor(T), battles = Math.max(1, Math.round(q.battles * pace));
    const my = deck.reduce((a, id) => a + P.cards[id].level, 0) / deck.length;
    let wins = 0;
    for (let i = 0; i < battles; i++) {
      const off = streak <= -3 ? M.lost3 : streak === -2 ? M.lost2 : streak >= 3 ? M.won3 : M.offset;
      const foeT = Math.max(0, T + off + Math.round((r() - 0.5) * M.spread));
      const play = Math.max(0, G_curve(G.FOE_SKILL.curve, foeT) - 0.6) / 0.4 * LADDER.topPlay, learnt = Math.min(LADDER.learnMax, LADDER.learn * d / 365);
      const g = my - foeAvg(foeT), p = 1 / (1 + Math.exp(-(LADDER.slope * (g + edge + learnt - play))));
      const s = G.stakes(T, foeT), floor = G.ARENAS.filter(a => !a.soon && T >= a.min).pop().min;
      if (r() < p) { T += s.win; wins++; streak = Math.max(1, streak + 1); } else { T = Math.max(floor, T - s.loss); streak = Math.min(-1, streak - 1); }
      n++; gap += g;
    }
    w += wins;
    best = Math.max(best, T);
    P.trophies = T; P.best = best;
    P.xp += wins * 20 + (battles - wins) * 6;
    for (const m of G.ROAD) if (G.roadState(m) === 'ready') G.claim(m.at);
    if (!passDone && G.passOpen()) { for (const x of G.PASS.tiers) if (x.free.kind === 'rubies') P.rubies += x.free.n; passDone = true; }
    for (const type of dayOfChests(st, wins, q.unlockHours * pace)) { const c = G.roll(type, rand); P.rubies += c.rubies; for (const x of c.cards) P.cards[x.id].count += x.n; }
    const f = G.roll(G.ECONOMY.freeChest.type, rand, { bonus: G.ECONOMY.freeChest.bonus }); P.rubies += f.rubies; for (const x of f.cards) P.cards[x.id].count += x.n;
    P.rubies += Math.min(wins, G.ECONOMY.winGold.dailyCap) * G.winGold();
    for (let guard = 0; guard < 200; guard++) {
      const order = deck.filter(id => G.upgradeInfo(id).can).sort((a, b) => P.cards[a].level - P.cards[b].level);
      if (!order.length) break;
      G.upgrade(order[0]);
    }
    for (const k of [300, 600, 900, 1200, 1500, 2000, 2600, 3300, 4100, 5000, 6000, 7000]) if (best >= k && !marks[k]) {
      marks[k] = { d, rate: w / n, gap: gap / n, lv: deck.map(id => P.cards[id].level).join(' ') };
      w = 0; n = 0; gap = 0;
    }
    if (d === 30 || d === 90 || d === 365 || d === 730) marks['day ' + d] = { trophies: T };
  }
  return marks;
}
console.log('\nPart 3: careers on the ladder (trophies from battles; opponents found as the game finds them)\n');
const runs = LADDER.players.map(([, , edge, pace]) => ladder(edge, pace));
console.log('| Trophies | ' + LADDER.players.map(p => p[1]).join(' | ') + ' |');
console.log('|---|' + LADDER.players.map(() => '---').join('|') + '|');
for (const k of [300, 600, 900, 1200, 1500, 2000, 2600, 3300, 4100, 5000, 6000, 7000]) {
  console.log(`| ${f0(k)} | ${runs.map(m => (m[k] ? `${asTime(m[k].d)}; won ${Math.round(m[k].rate * 100)}% on the way; cards ${m[k].gap >= 0 ? '+' : ''}${m[k].gap.toFixed(1)} vs theirs` : 'not within 3 years')).join(' | ')} |`);
}
for (const d of [30, 90, 365, 730]) console.log(`| after ${d} days | ${runs.map(m => `${f0(m['day ' + d].trophies)} trophies`).join(' | ')} |`);
