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

// 7b. The Shop: five offers from the cards you have found and their levels.
{
  const day1 = new Date(2026, 10, 11, 9, 0, 0).getTime(), day2 = new Date(2026, 10, 12, 0, 0, 5).getTime();
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, coins: 300, cards: { wolves: { level: 2, count: 3 }, rhino: { level: 3, count: 0 }, gladiator: { level: 1, count: 1 } } }) }));
  const P3 = G.state;
  assert.strictEqual(P3.diamonds, 0, 'old saves start with no diamonds');
  const sh = G.shop(day1, KCSim.mulberry(5)), o = sh.offers;
  assert.strictEqual(o.length, 5);
  assert.deepStrictEqual(o.map(x => x.currency), ['coins', 'coins', 'coins', 'diamonds', 'diamonds']);
  const cardsOffered = o.filter(x => x.kind === 'card').map(x => x.card);
  assert.strictEqual(new Set(cardsOffered).size, 4, 'four different cards');
  assert(cardsOffered.every(id => P3.found.includes(id)), 'only cards you have found');
  assert(!cardsOffered.includes('skeletons') && !cardsOffered.includes('cannon'), 'no Arena 1 cards before they are found');
  // 1: closest to upgrade is wolves (needs 4, has 3) or gladiator (needs 2, has 1): one copy short each
  assert(['wolves', 'gladiator'].includes(o[0].card) && o[0].qty === 1 && o[0].price === 10, JSON.stringify(o[0]));
  assert.strictEqual(KC_CARDS[o[1].card].rarity, 'rare');
  assert.strictEqual(o[1].price, o[1].qty * 50);
  assert.strictEqual(P3.cards[o[2].card].level, 1, 'catch-up offer is a lowest-level card');
  assert(o[3].price === 1 && o[3].qty === (KC_CARDS[o[3].card].rarity === 'rare' ? 100 : 500), 'mega bundle: 5,000 coins of copies for 1 diamond');
  assert.deepStrictEqual([o[4].kind, o[4].qty, o[4].price], ['coins', 5000, 1]);
  assert.strictEqual(G.shop(day1 + 3600e3).offers, o, 'same offers all day');
  // buying
  const before = P3.cards[o[0].card].count;
  let r = G.buy(0, day1);
  assert(r.ok && P3.coins === 290 && P3.cards[o[0].card].count === before + 1);
  assert.strictEqual(G.buy(0, day1).error, 'sold');
  assert.strictEqual(G.buy(3, day1).error, 'diamonds', 'no diamonds yet');
  P3.coins = 0; assert.strictEqual(G.buy(1, day1).error, 'coins');
  G.grantTest();
  assert(P3.coins === 1000000 && P3.diamonds === 1000000);
  r = G.buy(4, day1); assert(r.ok && P3.diamonds === 999999 && P3.coins === 1005000);
  r = G.buy(4, day1); assert(r.ok && P3.coins === 1010000, 'the coin bundle can be bought again');
  r = G.buy(3, day1); assert(r.ok && P3.diamonds === 999997 && r.cards[0].n === o[3].qty);
  // offers follow your cards: find the Skeleton Pack, level things up, next day
  P3.trophies = 60; G.claim(40);
  for (const id of ['hawks', 'archers', 'snowman', 'gorilla', 'fireball', 'gladiator', 'wolves', 'rhino']) P3.cards[id].level = 4;
  const o2 = G.shop(day2, KCSim.mulberry(6)).offers;
  assert.notStrictEqual(o2, o);
  assert.strictEqual(o2[2].card, 'skeletons', 'the new, lowest-level card is the catch-up offer');
  assert.deepStrictEqual(G.state.shop.bought, {}, 'a new day clears what was bought');
  assert(G.shopEnds(day1) === new Date(2026, 10, 12, 0, 0, 0).getTime());
  // a maxed card is never offered
  for (const id of KC_STARTER_DECK) P3.cards[id].level = 15;
  const o3 = G.refreshShop(KCSim.mulberry(7), day2).offers;
  assert(o3.filter(x => x.kind === 'card').every(x => x.card === 'skeletons'), 'only the card that can still level up');
  // the chest row: coins only, one of each a day, contents shown and exactly what you get
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, coins: 400, diamonds: 50 }) }));
  const P4 = G.state, ch = G.shop(day1, KCSim.mulberry(9)).chests;
  assert.deepStrictEqual(ch.map(c => [c.type, c.price]), [['wooden', 80], ['silver', 280], ['gold', 800]]);
  assert(ch.every(c => c.contents.coins < c.price && c.contents.cards.length > 0), 'a chest never pays back its price in coins');
  const total = id => P4.cards[id].count, w = ch[0], before4 = Object.fromEntries(w.contents.cards.map(x => [x.id, total(x.id)]));
  let rc = G.buyChest(0, day1);
  assert(rc.ok && rc.chest === 'wooden' && P4.coins === 400 - 80 + w.contents.coins && P4.diamonds === 50, 'paid in coins, diamonds untouched');
  for (const x of w.contents.cards) assert.strictEqual(total(x.id), before4[x.id] + x.n, 'you get exactly what was shown');
  assert.deepStrictEqual(rc.cards.map(x => [x.id, x.n]), w.contents.cards.map(x => [x.id, x.n]));
  assert.strictEqual(G.buyChest(0, day1).error, 'sold');
  assert.strictEqual(G.buyChest(2, day1).error, 'coins', 'the gold chest costs more coins than they have');
  assert.strictEqual(P4.chests.filter(Boolean).length, 0, 'shop chests do not use the chest slots');
  assert.notDeepStrictEqual(G.shop(day2, KCSim.mulberry(10)).chests.map(c => c.contents), ch.map(c => c.contents), 'new chests the next day');
  delete P4.shop.chests; assert.strictEqual(G.shop(day2).chests.length, 3, 'an older saved shop gains the chest row');
  console.log('shop offers, prices, buying, daily change, chests for coins: ok');
}

// 8. Opponents level their cards one at a time as their trophies rise, and they have no lines.
for (const [t, want] of [[0, 0], [49, 0], [50, 1], [62, 1], [63, 2], [137, 7], [138, 8], [149, 8], [150, 9], [250, 17], [1437, 111], [1438, 112], [9999, 112]]) assert.strictEqual(G.foeUpgrades(t), want, `upgrades at ${t}`);
const tally = l => Object.values(l).sort().join('');
const ids8 = KC_STARTER_DECK;
assert.strictEqual(tally(G.spreadLevels(0, ids8)), '11111111');
assert.strictEqual(tally(G.spreadLevels(1, ids8)), '11111112');
assert.strictEqual(tally(G.spreadLevels(8, ids8)), '22222222');
assert.strictEqual(tally(G.spreadLevels(9, ids8)), '22222223');
assert.strictEqual(tally(G.spreadLevels(13, ids8)), '22233333');
assert.strictEqual(Object.values(G.spreadLevels(112, ids8)).join(), Array(8).fill(15).join());
const seenAhead = new Set();
for (const t of [0, 50, 100, 130, 150, 200, 265]) {
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: t }) }));
  for (let i = 0; i < 30; i++) {
    const foe = G.trophyFoe(KCSim.mulberry(i + 1 + t)), lv = Object.values(foe.cardLevels), n = G.foeUpgrades(foe.trophies);
    assert.strictEqual(foe.lines, null);
    assert.deepStrictEqual(Object.keys(foe.cardLevels).sort(), foe.deck.slice().sort(), 'a level for every card in their deck');
    assert.strictEqual(lv.reduce((a, l) => a + l - 1, 0), n, 'total upgrades match their trophies');
    assert(Math.max(...lv) - Math.min(...lv) <= 1, 'levels are at most one apart');
    if (t === 50 && n === 1) seenAhead.add(Object.keys(foe.cardLevels).find(id => foe.cardLevels[id] === 2));
  }
}
assert(seenAhead.size >= 3, 'different opponents upgrade different cards first');
console.log('opponent cards level up one at a time with trophies; no lines: ok');

// 9. Matchmaking: the win rate of a steady player who keeps their cards level with their trophies, and
//    of one who never upgrades.
const N = +process.argv[2] || 120;
for (const [label, skill, upgrades] of [['good player, upgrades as they climb', 'normal', true], ['sloppy player, upgrades as they climb', 'trainer', true], ['good player, never upgrades', 'normal', false]]) {
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true } }) }));
  let wins = 0, late = 0, lateWins = 0;
  for (let i = 0; i < N; i++) {
    if (upgrades) {
      const lv = G.spreadLevels(G.foeUpgrades(G.state.best), G.state.deck, KCSim.mulberry(11));
      for (const id of G.state.deck) G.state.cards[id].level = lv[id];
    }
    const foe = G.trophyFoe(KCSim.mulberry(700 + i));
    const s = KCSim.create({ seed: 3000 + i, towerDamage: [1, foe.towerDamage], decks: [G.state.deck, foe.deck], cardLevels: [G.cardLevels(), foe.cardLevels] });
    const me = KCBot.create(0, { skill, seed: i }), bot = KCBot.create(1, { skill: foe.skill, seed: 50 + i });
    while (!s.result) { KCSim.step(s); KCBot.update(me, s); KCBot.update(bot, s); s.events.length = 0; }
    const w = s.result.winner;
    G.recordTrophy(w);
    if (w === 0) wins++;
    if (i >= N / 3) { late++; if (w === 0) lateWins++; }
  }
  console.log(`${label}: won ${wins}/${N} overall, ${(lateWins / late * 100).toFixed(0)}% after settling; difficulty ${G.state.diff.toFixed(2)}, ${G.state.trophies} trophies (best ${G.state.best})`);
}
