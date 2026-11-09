// Tests the progression rules (js/progress.js) without a browser: node tools/progress-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
for (const f of ['cards.js', 'trainers.js', 'sim.js', 'bot.js', 'progress.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const mem = data => { const m = new Map(Object.entries(data || {})); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };
const G = KCProgress;

// 1. An old save (trainer era) keeps everything and gains the new fields.
let st = mem({ 'kc.progress': JSON.stringify({ name: 'Old', xp: 130, beaten: { owen: true, romeo: true }, records: { owen: { w: 3, l: 1, d: 0 } }, opp: 'luc' }) });
let P = G.load(st);
assert.strictEqual(P.name, 'Old'); assert.strictEqual(P.xp, 130); assert.strictEqual(P.records.owen.w, 3);
assert.strictEqual(P.trophies, 0); assert.deepStrictEqual(P.deck, KC_STARTER_DECK); assert.strictEqual(G.roadOpen(), false);
assert.strictEqual(G.mode(), 'trainer'); assert.strictEqual(G.trainer().id, 'luc');
console.log('old save carried over: ok');

// 2. Beating Luc opens the road, switches to trophy battles and opens Arena 1.
let r = G.recordTrainer('luc', 0);
assert(r.roadOpened && G.roadOpen() && G.mode() === 'trophy');
assert.strictEqual(G.arena().id, 'cinder'); assert.strictEqual(G.roadState(G.ROAD[0]), 'claimed');
console.log('road opens after Luc: ok');

// 3. Trophy wins and losses, chests into slots, slots full.
r = G.recordTrophy(0);
assert.strictEqual(r.delta, 30); assert.strictEqual(r.chest.type, 'wooden'); assert.strictEqual(P.chests[0].type, 'wooden');
r = G.recordTrophy(1); assert.strictEqual(r.delta, -20); assert.strictEqual(r.chest, null);
r = G.recordTrophy(1); assert.strictEqual(P.trophies, 0, 'never below the arena floor');
for (let i = 0; i < 4; i++) G.recordTrophy(0);
assert.strictEqual(P.chests.filter(Boolean).length, 4);
r = G.recordTrophy(0); assert(r.slotsFull && !r.chest);
assert.deepStrictEqual(P.chests.map(c => c.type), ['wooden', 'wooden', 'silver', 'wooden']);
console.log('trophies and chest slots: ok', P.trophies, 'trophies');

// 4. Chest timers: one at a time, real time, then open.
const t0 = 1_000_000;
assert.strictEqual(G.startUnlock(0, t0), 'ok');
assert.strictEqual(G.startUnlock(1, t0), 'busy');
assert.strictEqual(G.chestState(0, t0 + 59_000), 'unlocking');
assert.strictEqual(G.openChest(0, t0 + 59_000), null);
const coinsBefore = P.coins, countsBefore = KC_ALL_CARDS.reduce((a, id) => a + P.cards[id].count, 0);
const got = G.openChest(0, t0 + 60_000);
assert(got && got.coins >= 18 && got.coins <= 26 && got.cards.reduce((a, c) => a + c.n, 0) === 6);
assert.strictEqual(P.coins, coinsBefore + got.coins);
assert.strictEqual(KC_ALL_CARDS.reduce((a, id) => a + P.cards[id].count, 0), countsBefore + 6);
assert(got.cards.every(c => KC_STARTER_DECK.includes(c.id)), 'only found cards drop');
assert.strictEqual(P.chests[0], null);
console.log('chest unlock and open: ok', JSON.stringify(got));

// 5. Road rewards: claim in order as trophies allow; the Skeleton Pack is found at 40.
P.trophies = 130; P.best = 130;
const claimed = G.claimable().map(m => m.at);
assert.deepStrictEqual(claimed, [20, 40, 60, 90, 120]);
for (const at of claimed) assert(G.claim(at));
assert(P.found.includes('skeletons') && P.found.includes('cannon'));
assert.strictEqual(G.claim(160), null, 'not reached yet');
console.log('road rewards: ok, coins', P.coins);

// 6. Upgrades need copies and coins; the deck takes found cards and swaps.
P.coins = 1000; P.cards.wolves.count = 5;
let u = G.upgradeInfo('wolves'); assert(u.can && u.need === 2 && u.cost === 5);
assert.strictEqual(G.upgrade('wolves').level, 2);
assert.strictEqual(P.cards.wolves.count, 3); assert.strictEqual(P.coins, 995);
assert.strictEqual(G.upgradeInfo('wolves').need, 4);
assert(G.setDeck(1, 'skeletons')); assert.strictEqual(P.deck[1], 'skeletons'); assert(!P.deck.includes('wolves'));
assert(G.setDeck(0, 'skeletons')); assert.strictEqual(P.deck[0], 'skeletons'); assert.strictEqual(P.deck[1], 'rhino');
assert.strictEqual(new Set(P.deck).size, 8);
const td = G.trainingDeck();
assert.deepStrictEqual([...td].sort(), [...KC_STARTER_DECK].sort(), 'training deck is the starter cards');
assert(!td.includes('skeletons') && !td.includes('cannon'));
assert.strictEqual(td[1], P.deck[1], 'starter cards keep their slots');
for (const t of KC_TRAINERS) assert(!(t.deck || KC_STARTER_DECK).includes('cannon'));
console.log('upgrades and deck: ok; Arena 1 cards stay out of the Training Grounds');

// 7. Saved and reloaded the same.
const P2 = G.load(st);
assert.strictEqual(P2.trophies, 130); assert.strictEqual(P2.cards.wolves.level, 2); assert.strictEqual(P2.deck[0], 'skeletons');
console.log('save and reload: ok');

// 8. Matchmaking settles near the target win rate against a steady player.
st = mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true } }) });
G.load(st);
const N = +process.argv[2] || 120;
for (const [label, skill] of [['good player', 'normal'], ['sloppy player', 'trainer']]) {
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true } }) }));
  let wins = 0, late = 0, lateWins = 0;
  for (let i = 0; i < N; i++) {
    const foe = G.trophyFoe(KCSim.mulberry(700 + i));
    const s = KCSim.create({ seed: 3000 + i, towerDamage: [1, foe.towerDamage], decks: [G.state.deck, foe.deck], cardLevels: [G.cardLevels(), foe.cardLevels] });
    const me = KCBot.create(0, { skill, seed: i }), bot = KCBot.create(1, { skill: foe.skill, seed: 50 + i });
    while (!s.result) { KCSim.step(s); KCBot.update(me, s); KCBot.update(bot, s); s.events.length = 0; }
    const w = s.result.winner;
    G.recordTrophy(w);
    if (w === 0) wins++;
    if (i >= N / 3) { late++; if (w === 0) lateWins++; }
  }
  console.log(`${label}: won ${wins}/${N} overall, ${(lateWins / late * 100).toFixed(0)}% after settling; difficulty ${G.state.diff.toFixed(2)}, ${G.state.trophies} trophies`);
}
