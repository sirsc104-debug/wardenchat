// Tests the progression rules (js/progress.js) without a browser: node tools/progress-test.js
'use strict';
let st0;
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
G.setMode('trainer', 'owen');
assert.strictEqual(G.mode(), 'trophy', 'no going back to the trainers once the road is open');
{ const st2 = mem({ 'kc.progress': JSON.stringify(Object.assign({}, G.state, { mode: 'trainer' })) }); G.load(st2); assert.strictEqual(G.mode(), 'trophy', 'an old save left on a trainer plays trophy battles'); G.load(st); P = G.state; }
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
const rubiesBefore = P.rubies, countsBefore = KC_ALL_CARDS.reduce((a, id) => a + P.cards[id].count, 0);
const got = G.openChest(0, t0 + 60_000);
assert(got && got.rubies >= G.chestOdds('wooden', { trophies: 0, level: 1 }).rubies[0] && got.cards.reduce((a, c) => a + c.n, 0) >= G.chestOdds('wooden', { trophies: 0, level: 1 }).cards, 'at least an Arena 1 wooden chest');
assert.strictEqual(P.rubies, rubiesBefore + got.rubies);
assert.strictEqual(KC_ALL_CARDS.reduce((a, id) => a + P.cards[id].count, 0), countsBefore + got.cards.reduce((a, c) => a + c.n - (c.isNew ? 1 : 0), 0), 'a new card\'s first copy unlocks it');
assert(got.cards.every(c => KC_STARTER_DECK.includes(c.id) || G.ARENAS[0].cards.includes(c.id)), 'only found cards and cards of your arena drop');
assert.strictEqual(P.chests[0], null);
console.log('chest unlock and open: ok', JSON.stringify(got));

// 5. Road rewards: claim in order as trophies allow; the Skeleton Pack is found at 40.
P.trophies = 130; P.best = 130;
const claimed = G.claimable().map(m => m.at);
assert.deepStrictEqual(claimed, [20, 40, 60, 90, 120]);
for (const at of claimed) assert(G.claim(at));
assert(P.found.includes('skeletons') && P.found.includes('cannon'));
assert.strictEqual(G.claim(160), null, 'not reached yet');
console.log('road rewards: ok, rubies', P.rubies);

// 6. Upgrades need copies and rubies; the deck takes found cards and swaps.
P.rubies = 1000; P.cards.wolves.count = 5;
let u = G.upgradeInfo('wolves'); assert(u.can && u.need === 2 && u.cost === 5);
assert.strictEqual(G.upgrade('wolves').level, 2);
assert.strictEqual(P.cards.wolves.count, 3); assert.strictEqual(P.rubies, 995);
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
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, rubies: 300, cards: { wolves: { level: 2, count: 3 }, rhino: { level: 3, count: 0 }, gladiator: { level: 1, count: 1 } } }) }));
  const P3 = G.state;
  assert.strictEqual(P3.diamonds, 0, 'old saves start with no diamonds');
  const sh = G.shop(day1, KCSim.mulberry(5)), o = sh.offers;
  assert.strictEqual(o.length, 5);
  assert.deepStrictEqual(o.map(x => x.currency), ['rubies', 'rubies', 'rubies', 'diamonds', 'diamonds']);
  const cardsOffered = o.filter(x => x.kind === 'card').map(x => x.card);
  assert.strictEqual(new Set(cardsOffered).size, 4, 'four different cards');
  assert(cardsOffered.every(id => P3.found.includes(id)), 'only cards you have found');
  assert(!cardsOffered.includes('skeletons') && !cardsOffered.includes('cannon'), 'no Arena 1 cards before they are found');
  // 1: closest to upgrade is wolves (needs 4, has 3) or gladiator (needs 2, has 1): one copy short each
  assert(['wolves', 'gladiator'].includes(o[0].card) && o[0].qty === 1 && o[0].price === 20, JSON.stringify(o[0]));
  assert.strictEqual(KC_CARDS[o[1].card].rarity, 'rare');
  assert.strictEqual(o[1].price, o[1].qty * 200);
  assert.strictEqual(P3.cards[o[2].card].level, 1, 'catch-up offer is a lowest-level card');
  assert(o[3].price === 1 && o[3].qty === G.ECONOMY.shop.megaQty[KC_CARDS[o[3].card].rarity], 'mega bundle: 100 commons or 20 rares for 1 diamond');
  assert.deepStrictEqual([o[4].kind, o[4].qty, o[4].price], ['rubies', 5000, 1]);
  assert.strictEqual(G.shop(day1 + 3600e3).offers, o, 'same offers all day');
  // buying
  const before = P3.cards[o[0].card].count;
  let r = G.buy(0, day1);
  assert(r.ok && P3.rubies === 280 && P3.cards[o[0].card].count === before + 1);
  assert.strictEqual(G.buy(0, day1).error, 'sold');
  assert.strictEqual(G.buy(3, day1).error, 'diamonds', 'no diamonds yet');
  P3.rubies = 0; assert.strictEqual(G.buy(1, day1).error, 'rubies');
  G.grantTest();
  assert(P3.rubies === 1000000 && P3.diamonds === 1000000);
  r = G.buy(4, day1); assert(r.ok && P3.diamonds === 999999 && P3.rubies === 1005000);
  r = G.buy(4, day1); assert(r.ok && P3.rubies === 1010000, 'the ruby bundle can be bought again');
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
  // the chest row: rubies only, one of each a day, bigger chests from later arenas, free wooden chest daily
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, rubies: 2000, diamonds: 50 }) }));
  const P4 = G.state;
  const prices = G.TIERS.map(t => G.chestPrice(t));
  assert(prices.every((v, i) => i === 0 || v > prices[i - 1]), 'better chests cost more ' + prices);
  for (const lv of [1, 5, 12, 30, 80]) for (const tr of [0, 400, 900, 4000]) for (const t of G.TIERS)
    assert(G.chestOdds(t, { level: lv, trophies: tr }).rubies[1] < G.chestPrice(t, { level: lv, trophies: tr }), `a ${t} chest never pays back its price (level ${lv}, ${tr} trophies)`);
  const silverPrice = G.chestPrice('silver');
  let rc = G.buyChest('silver', KCSim.mulberry(1));
  assert(rc.ok && P4.rubies === 2000 - silverPrice + rc.rubies && P4.diamonds === 50, 'paid in rubies, diamonds untouched');
  assert(rc.cards.reduce((a, c) => a + c.n, 0) >= G.chestOdds('silver').cards);
  const rubiesNow = P4.rubies;
  assert(G.buyChest('silver').error === 'sold' && P4.rubies === rubiesNow && G.chestBuyLeft('silver') === 0, 'one silver chest a day');
  assert(G.chestBuyLeft('silver', Date.now() + 86400e3) === 1, 'another tomorrow');
  assert(G.buyChest('silver', KCSim.mulberry(2), Date.now() + 86400e3).ok, 'bought the next day');
  assert.strictEqual(G.buyChest('gold').error, 'locked', 'gold chests are sold from Arena 2');
  assert(!G.chestShopOpen('platinum') && !G.chestShopOpen('mythic'));
  P4.best = 950; P4.trophies = 950; P4.rubies = 100;
  assert(G.chestShopOpen('mythic') && G.buyChest('mythic').error === 'rubies', 'mythic in the Shop from Arena 4, priced high');
  assert(G.chestPrice('mythic') > 20000, 'a bought mythic costs tens of thousands of rubies ' + G.chestPrice('mythic'));
  P4.best = 0; P4.trophies = 0;
  assert.strictEqual(P4.chests.filter(Boolean).length, 0, 'shop chests do not use the chest slots');
  // free wooden chest, once a day
  assert(G.freeChestReady(day1));
  rc = G.claimFreeChest(day1); assert(rc.ok && rc.chest === 'wooden');
  assert.strictEqual(G.claimFreeChest(day1 + 3600e3).error, 'claimed');
  assert(G.freeChestReady(day2) && G.claimFreeChest(day2).ok, 'a new free chest the next day');
  // contents follow trophies first, then account level; a new arena is a clear step up
  const odds = (lv, tr) => G.chestOdds('gold', { level: lv, trophies: tr });
  assert.strictEqual(odds(1, 0).cards, Math.round(40 * G.ECONOMY.arenaCards[1]));
  assert(odds(1, 300).cards > odds(1, 299).cards * 1.15 && odds(1, 300).rubies[0] > odds(1, 299).rubies[0] * 1.15, 'reaching an arena is a step up');
  for (const a of G.ARENAS.slice(1)) assert(odds(1, a.min).cards > odds(1, a.min - 1).cards * 1.15 && odds(1, a.min).rubies[0] > odds(1, a.min - 1).rubies[0] * 1.15, `a step up at Arena ${a.number}`);
  assert(odds(1, 1999).rubies[0] > odds(1, 900).rubies[0] * 1.8, 'Stormspire climbs steeply toward Arena 5');
  assert(odds(1, 6000).cards > odds(1, 2000).cards * 3, 'the late arenas pay far more');
  assert(odds(12, 100).cards > odds(2, 100).cards && odds(12, 100).rubies[0] > odds(2, 100).rubies[0], 'account level adds more in the same arena');
  assert(odds(12, 4000).rubies[0] > odds(2, 100).rubies[0] * 3 && odds(12, 4000).cards > odds(2, 100).cards * 2.5, 'level 12 at 4,000 trophies far beyond level 2 at 100');
  assert.strictEqual(odds(40, 900).rubies[0], odds(400, 900).rubies[0], 'the level bonus stops at the cap');
  assert(odds(1, 1e9).rubies[0] === odds(1, 6000 + 500 * 100).rubies[0] && odds(1, 9000).rubies[0] > odds(1, 6000).rubies[0], 'past the last arena a little more, then it stops');
  assert(odds(-5, -100).cards === odds(1, 0).cards && Number.isFinite(odds('x', NaN).cards), 'bad numbers are treated as the lowest');
  // a high account level alone never brings cards of arenas you haven't reached
  P4.xp = 99999; P4.trophies = 0; P4.best = 0;
  assert(!G.chestPool().some(id => ['spears', 'mole', 'owl', 'camel', 'thundercloud'].includes(id)));
  P4.xp = 0;
  // the arena gate (switched on just for this test): Arena 1 gives wooden and silver only
  G.CHEST_RULES.allUnlocked = false;
  P4.trophies = 0; P4.cycle = 7; P4.chests = [null, null, null, null];
  assert(!G.chestAllowed('gold') && G.chestAllowed('silver'));
  assert.strictEqual(G.capChest('mythic'), 'silver');
  assert.strictEqual(G.capChest('gold', 2), 'gold');
  assert.strictEqual(G.capChest('mythic', 3), 'platinum');
  assert.strictEqual(G.buyChest('gold').error, 'locked');
  let wr = G.recordTrophy(0); assert.strictEqual(wr.chest.type, 'silver', 'the gold chest in the cycle becomes silver in Arena 1');
  P4.trophies = 250; P4.claimed = { 0: true };
  for (const at of [20, 40, 60, 90, 120, 160, 200]) G.claim(at);
  assert.strictEqual(G.claim(250).chest, 'silver', 'the Trophy Road gold chest is given as silver in Arena 1');
  G.CHEST_RULES.allUnlocked = true;
  assert.strictEqual(G.capChest('mythic'), 'mythic', 'with the gate off every tier is allowed');
  for (const t of G.TIERS) assert(G.chestAllowed(t));
  console.log('chests: tiers, gate, level scaling, repeat buys, free daily: ok');
  // Arena 2: Briar Hollow at 300 trophies, its cards on the road, wild cards from Arena 2 on
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 290, claimed: { 0: true } }) }));
  const P5 = G.state;
  assert.strictEqual(G.arena().id, 'cinder');
  assert(!G.wildActive());
  const noWild = Array.from({ length: 200 }, (_, i) => G.roll('mythic', KCSim.mulberry(i + 1)).items).flat().filter(x => x.id.startsWith('wild_'));
  assert.strictEqual(noWild.length, 0, 'no wild cards in Arena 1');
  let wr2 = G.recordTrophy(0);
  assert(wr2.newArena && wr2.newArena.id === 'briar' && G.arena().number === 2, 'Briar Hollow at 300');
  assert(G.wildActive());
  const silver = G.roll('silver', KCSim.mulberry(3)).items;
  assert(silver.some(x => x.id === 'wild_common' && x.n >= 1), 'silver chests give common wild cards in Arena 2');
  assert.strictEqual(G.roll('wooden', KCSim.mulberry(3)).items.filter(x => x.id.startsWith('wild_')).length, 0);
  P5.trophies = 600; G.claim(300);
  for (const at of [330, 400, 480, 560]) { const r = G.claim(at); assert(r && r.cards[0].isNew, `card at ${at}`); }
  for (const id of ['spears', 'pots', 'footmen', 'flail']) assert(P5.found.includes(id));
  assert.strictEqual(G.roadState(G.ROAD.find(m => m.at === 600)), 'ready', 'Arena 3, Sunstone Arena, opens at 600');
  assert.deepStrictEqual([...G.trainingDeck()].sort(), [...KC_STARTER_DECK].sort(), 'Briar cards stay out of the Training Grounds too');
  const late = G.trophyFoe(KCSim.mulberry(4));
  P5.trophies = 600; let sawBriar = 0; for (let i = 0; i < 40; i++) if (G.trophyFoe(KCSim.mulberry(i + 9)).deck.some(id => ['spears', 'pots', 'footmen', 'flail'].includes(id))) sawBriar++;
  assert(sawBriar > 20, 'opponents at 600 trophies play Briar Hollow cards');
  console.log('Arena 2 Briar Hollow, its road cards, wild cards from Arena 2: ok');


  // Books and the hammer: never in wooden, about 0.1% in silver, about 1% in mythic
  const finds = (type, n) => { let k = 0; const r = KCSim.mulberry(77); for (let i = 0; i < n; i++) if (G.roll(type, r).items.some(x => !x.id.startsWith('wild_'))) k++; return k / n; };
  const fw = finds('wooden', 20000), fs = finds('silver', 40000), fm = finds('mythic', 20000);
  assert.strictEqual(fw, 0, 'no books or hammers in wooden chests');
  assert(fs > 0.0003 && fs < 0.002, `silver ${fs}`);
  assert(fm > 0.007 && fm < 0.013, `mythic ${fm}`);
  console.log(`magic finds: wooden ${fw}, silver ${(fs * 100).toFixed(2)}%, mythic ${(fm * 100).toFixed(2)}%: ok`);

  // Using magic items
  P5.cards.wolves.level = 3; P5.cards.wolves.count = 1;           // needs 10 for level 4
  P5.cards.rhino.level = 3; P5.cards.rhino.count = 0;              // rare, from level 3: needs 2
  P5.rubies = 0; P5.magic = { wild_common: 4, book_common: 1, book_rare: 1, book_books: 1, hammer_books: 1 };
  assert.strictEqual(G.magicFor('wild_rare', 'wolves').reason, 'none-held');
  assert.strictEqual(G.magicFor('book_rare', 'wolves').reason, 'rarity');
  let mu = G.useMagic('wild_common', 'wolves'); assert(mu.ok && mu.gives === 4 && P5.cards.wolves.count === 5 && P5.magic.wild_common === 0, 'wild cards add up to what is held');
  assert(G.magicFor('hammer_books', 'wolves').ok && G.magicFor('hammer_books', 'wolves').fills === 5, 'the hammer fills missing copies');
  mu = G.useMagic('book_common', 'wolves'); assert(mu.ok && P5.cards.wolves.count === 10 && P5.magic.book_common === 0, 'a book fills the rest');
  assert.strictEqual(G.magicFor('book_books', 'wolves').reason, 'full');
  mu = G.useMagic('hammer_books', 'wolves'); assert(mu.ok && P5.cards.wolves.level === 4 && P5.cards.wolves.count === 0 && P5.rubies === 0, 'the hammer upgrades without rubies');
  mu = G.useMagic('book_books', 'rhino'); assert(mu.ok && P5.cards.rhino.count === 2, 'the Book of Books works on a rare');
  assert.strictEqual(G.magicFor('shards', 'rhino').reason, 'none-held');
  const P6 = G.load(st0 = mem({ 'kc.progress': JSON.stringify(P5) }));
  assert.strictEqual(P6.cards.wolves.level, 4); assert.strictEqual(G.magicCount('book_books'), 0);
  console.log('wild cards, books, Book of Books and the Hammer of Books: ok');
  console.log('shop offers, prices, buying, daily change, chests for rubies: ok');
}

// 8. Opponents level their cards one at a time as their trophies rise, and they have no lines.
// the curve: average card level (before rares are raised) 1 at 50, 4.5 at 300, 6.5 at 600, 7.5 at 900, 8.5 at 1,200, 12 at 2,000, 15 at 4,000
for (const [t, want] of [[0, 0], [49, 0], [50, 0], [300, 28], [600, 44], [900, 52], [1200, 60], [1500, 72], [2000, 88], [3000, 100], [4000, 108], [5000, 112], [9999, 112], [-5, 0]]) assert.strictEqual(G.foeUpgrades(t), want, `upgrades at ${t}`);
for (let t = 0; t < 4500; t += 10) assert(G.foeUpgrades(t + 10) >= G.foeUpgrades(t), 'never fewer upgrades with more trophies');
// their King Tower uses the players' rule (N cards at level N), counting their collection along with the deck past 8
assert.strictEqual(G.foeKing([3, 3, 3, 3, 2, 2, 1, 1]), 3);
assert.strictEqual(G.foeKing([9, 9, 9, 9, 8, 8, 8, 8]), 8);
assert.strictEqual(G.foeKing([9, 9, 9, 9, 9, 9, 9, 9]), 9);
assert.strictEqual(G.foeKing(Array(8).fill(15)), 15);
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
    // levels spread one at a time, then rares, epics and legendaries are raised to where their rarity starts
    assert(foe.deck.every(id => foe.cardLevels[id] >= KC_MIN_LEVEL(id)), 'no card below its rarity start');
    const low = foe.deck.filter(id => foe.cardLevels[id] > KC_MIN_LEVEL(id) || KC_MIN_LEVEL(id) === 1).map(id => foe.cardLevels[id]);
    assert(lv.reduce((a, l) => a + l - 1, 0) >= n, 'at least as many upgrades as their trophies give');
    assert(!low.length || Math.max(...low) - Math.min(...low) <= 1, 'spread levels are at most one apart');
    if (t === 50 && n === 1) seenAhead.add(Object.keys(foe.cardLevels).find(id => foe.cardLevels[id] === 2));
  }
}
assert(seenAhead.size >= 3, 'different opponents upgrade different cards first');
console.log('opponent cards level up one at a time with trophies; no lines: ok');

  // Arena 3, Sunstone Arena: its four cards, evolutions and the Diamond Pass
  {
    G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 590, best: 590, claimed: { 0: true }, rubies: 0, diamonds: 20 }) }));
    const P6 = G.state;
    assert(!G.passOpen() && !G.evoOpen(), 'pass and evolutions wait for Arena 3');
    assert.strictEqual(G.recordTrophy(1, 1).pass, null, 'no pass crowns before Arena 3');
    P6.trophies = 590; G.recordTrophy(0, 3);
    assert.strictEqual(G.arena().id, 'sunstone', 'Sunstone Arena at 600');
    assert(G.passOpen() && G.evoOpen());
    P6.trophies = 900; P6.best = 900;
    for (const at of [630, 710, 790, 870]) { const r = G.claim(at); assert(r && r.cards[0].isNew, `card at ${at}`); }
    for (const id of ['sandstorm', 'ramcart', 'mole', 'camel']) assert(P6.found.includes(id), id);
    assert.strictEqual(G.roadState(G.ROAD.find(m => m.at === 900)), 'ready', 'Arena 4, Stormspire, opens at 900');
    assert(G.onlineOpen(), 'online battles open at Stormspire');
    P6.trophies = 1200; P6.best = 1200;
    for (const at of [930, 1010, 1090, 1170]) { const r = G.claim(at); assert(r && r.cards[0].isNew, `card at ${at}`); }
    for (const id of ['bees', 'owl', 'thundercloud', 'griffin']) assert(P6.found.includes(id), id);
    assert.strictEqual(G.roadState(G.ROAD.find(m => m.at === 2000)), 'locked', 'Arena 5 waits for 2,000 trophies');
    let sawStorm = 0; for (let i = 0; i < 40; i++) if (G.trophyFoe(KCSim.mulberry(i + 77)).deck.some(id => ['bees', 'owl', 'thundercloud', 'griffin'].includes(id))) sawStorm++;
    assert(sawStorm > 20, 'opponents at 1,200 trophies play Stormspire cards');
    assert(!KC_ALL_CARDS.includes('ramsoldier'), 'the cart soldiers are not a card');
    let sawSun = 0; for (let i = 0; i < 40; i++) if (G.trophyFoe(KCSim.mulberry(i + 31)).deck.some(id => ['sandstorm', 'ramcart', 'mole', 'camel'].includes(id))) sawSun++;
    assert(sawSun > 14, 'opponents at 1,200 trophies still play Sunstone cards');
    // every opponent's deck follows the deck rules (bot.js buildDeck): eight different cards, one or two
    // win conditions, two or three spells, three that hit air, no more than three flyers, a cheap card
    const styles = new Set();
    for (const t of [0, 300, 900, 1500, 2500, 4000, 6500]) {
      P6.trophies = t;
      for (let i = 0; i < 30; i++) {
        const f = G.trophyFoe(KCSim.mulberry(t * 7 + i)), d = f.deck;
        styles.add(f.style);
        assert.strictEqual(new Set(d).size, 8, `eight different cards at ${t}: ${d}`);
        const wins = d.filter(id => KCBot.WIN_CARDS.has(id)).length, spells = d.filter(id => KC_CARDS[id].kind === 'spell').length;
        assert(wins >= 1 && wins <= 3, `win conditions at ${t}: ${d}`);
        assert(spells >= 1 && spells <= 3, `spells at ${t}: ${d}`);
        assert(d.filter(KCBot.hitsAir).length >= 2, `cards that hit air at ${t}: ${d}`);
        assert(d.filter(id => KC_CARDS[id].air).length <= 3, `flyers at ${t}: ${d}`);
        assert(d.some(id => KC_CARDS[id].cost <= 3), `a cheap card at ${t}: ${d}`);
        assert(f.name && f.mood, 'a name and a temperament');
        // nothing far beyond the Trophy Road at their trophies
        for (const id of d) { const m = G.ROAD.find(r => r.card === id); assert(!m || m.at <= f.trophies + 160, `${id} at ${f.trophies}`); }
      }
    }
    assert(styles.size >= 5, `several play styles: ${[...styles]}`);
    P6.trophies = 1200;
    // the free path's shards: exactly 2; the Diamond Pass's tier 1 is the Snowman Evolution
    const freeShards = G.PASS.tiers.reduce((n, t) => n + (t.free.kind === 'item' && t.free.item === 'shards' ? t.free.n : 0), 0);
    assert.strictEqual(freeShards, 2, 'the free path gives 2 shards');
    assert.deepStrictEqual(G.PASS.tiers[0].paid, { kind: 'evo', card: 'snowman' });
    assert(G.PASS.tiers.some(t => t.free.kind === 'chest' && t.free.chest === 'gold') && G.PASS.tiers.some(t => t.paid.kind === 'chest' && t.paid.chest === 'gold'), 'gold chests on the pass');
    // crowns move you up; the paid track needs the pass
    P6.pass.points = 0;
    const per = G.PASS.crownsPerTier;
    G.recordTrophy(0, per);
    assert.strictEqual(G.passTier(), 1);
    assert.strictEqual(G.passState(0, 'free'), 'ready');
    assert.strictEqual(G.passState(0, 'paid'), 'premium');
    assert(G.claimPass(0, 'free').rubies === 375);
    assert.strictEqual(G.claimPass(0, 'free'), null, 'a reward is claimed once');
    assert.strictEqual(G.buyPass().ok, true); assert.strictEqual(P6.diamonds, 20 - G.PASS.price);
    assert.strictEqual(G.buyPass().error, 'owned');
    assert(G.claimPass(0, 'paid').evo === 'snowman' && G.hasEvo('snowman'), 'the pass gives the Snowman Evolution');
    assert.deepStrictEqual(G.evoList(), ['snowman']);
    // shards: 6 unlock an evolution (the Snowman's is already owned here, so it can't be used again)
    P6.magic.shards = 6;
    assert.strictEqual(G.magicFor('shards', 'snowman').reason, 'evo-owned');
    assert.strictEqual(G.magicFor('shards', 'archers').reason, 'no-evo');
    P6.evos = []; P6.magic.shards = 5;
    assert.strictEqual(G.magicFor('shards', 'snowman').reason, 'shards');
    P6.magic.shards = 6;
    assert(G.useMagic('shards', 'snowman').evo && G.hasEvo('snowman') && G.magicCount('shards') === 0, 'six shards unlock it');
    // free path: two shards over the whole pass
    P6.pass.points = G.passMax();
    let got = 0; for (let i = 0; i < G.PASS.tiers.length; i++) { const r = G.claimPass(i, 'free'); if (r) got += (r.items || []).filter(x => x.id === 'shards').reduce((a, x) => a + x.n, 0); }
    assert.strictEqual(got, 2);
    // legendaries are rare in small chests
    const leg = type => { let k = 0; const r = KCSim.mulberry(5); for (let i = 0; i < 4000; i++) if (G.roll(type, r).cards.some(c => c.id === 'camel')) k++; return k / 4000; };
    const lw = leg('wooden'), lm = leg('mythic');
    assert(lw < 0.05 && lm > 0.3, `camel in wooden ${lw}, mythic ${lm}`);
    console.log(`Arena 3 Sunstone Arena, its cards, evolutions and the Diamond Pass: ok (camel in wooden ${(lw * 100).toFixed(1)}%, mythic ${(lm * 100).toFixed(0)}%)`);
  }

// The economy tables: exact upgrade costs, rarity start levels, chest floors, win gold, safe loading
{
  const E = G.ECONOMY, sum = a => a.reduce((x, v) => x + (v || 0), 0);
  assert.deepStrictEqual(E.upgradeGold, [5, 20, 50, 150, 400, 1000, 2000, 4000, 10000, 15000, 25000, 40000, 60000, 100000]);
  const start = { common: 1, rare: 3, epic: 6, legendary: 9 };
  const want = { common: [15586, 257625], rare: [3386, 257600], epic: [416, 257000], legendary: [47, 250000] };
  for (const r of Object.keys(start)) {
    assert.strictEqual(KC_RARITY_START[r], start[r]);
    const c = E.upgradeCopies[r];
    assert(c.slice(0, start[r] - 1).every(v => v === null), `${r}: no costs below level ${start[r]}`);
    assert.strictEqual(sum(c), want[r][0], `${r} copies to level 15`);
    assert.strictEqual(sum(E.upgradeGold.slice(start[r] - 1)), want[r][1], `${r} gold to level 15`);
    assert(want[r][1] >= 250000, 'level 15 costs at least 250,000 gold');
  }
  for (const id of KC_ALL_CARDS) assert.strictEqual(KC_MIN_LEVEL(id), start[KC_CARDS[id].rarity], id);
  // an old save with a level-1 legendary, bad numbers and a hacked level is repaired, not reset
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 1300, best: 900, rubies: -50, diamonds: 'lots', xp: 4000,
    found: ['wolves', 'rhino', 'griffin'], cards: { wolves: { level: 99, count: -3 }, rhino: { level: 1, count: 7 }, griffin: { level: 2, count: 1.7 } } }) }));
  const Q = G.state;
  assert(Q.rubies === 0 && Q.diamonds === 0 && Q.xp === 4000 && Q.best === 1300, 'bad wallets go to 0; best is at least the trophies');
  assert(Q.cards.wolves.level === 15 && Q.cards.wolves.count === 0, 'levels above 15 are capped, negative copies cleared');
  assert(Q.cards.rhino.level === 3 && Q.cards.rhino.count === 7 && Q.cards.griffin.level === 9 && Q.cards.griffin.count === 1, 'rarities lifted to their start, copies kept');
  // upgrade costs come straight from the tables
  Q.cards.rhino.count = 2; Q.rubies = 50;
  let u = G.upgradeInfo('rhino'); assert(u.need === 2 && u.cost === 50 && u.can, JSON.stringify(u));
  assert(G.upgrade('rhino') && Q.cards.rhino.level === 4 && Q.rubies === 0 && Q.cards.rhino.count === 0, 'upgrading takes the copies and the gold');
  u = G.upgradeInfo('rhino'); assert(u.need === 4 && u.cost === 150 && !u.can);
  // a new card: the first copy unlocks it and isn't a duplicate
  Q.found = ['wolves', 'rhino']; Q.cards.owl.count = 0;
  const before = Q.cards.wolves.count;
  G.load(mem({ 'kc.progress': JSON.stringify(Q) }));
  const c = { rubies: 0, cards: [{ id: 'owl', n: 3 }, { id: 'wolves', n: 5 }], items: [] };
  G.state.chests = [{ type: 'wooden', state: 'unlocking', ends: 0, contents: c }, null, null, null];
  G.openChest(0, 1);
  assert(G.state.found.includes('owl') && G.state.cards.owl.count === 2 && G.state.cards.wolves.count === before + 5, 'first copy unlocks');
  // chest floors: rares every silver and better, epics guaranteed from legendary chests, a legendary in every mythic
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 1300, best: 1300, claimed: { 0: true } }) }));
  const rr = KCSim.mulberry(9), cnt = (x, r) => x.cards.filter(k => KC_CARDS[k.id].rarity === r).reduce((a, k) => a + k.n, 0);
  for (let i = 0; i < 300; i++) {
    for (const t of G.TIERS) {
      const x = G.roll(t, rr), o = G.chestOdds(t);
      assert(x.cards.reduce((a, k) => a + k.n, 0) >= o.cards, `${t} gives all its cards`);
      assert(cnt(x, 'rare') >= o.rares, `${t} rare floor`);
      assert(cnt(x, 'epic') >= o.epicMin && cnt(x, 'legendary') >= o.legendaryMin, `${t} epic and legendary floors`);
      assert(x.rubies >= o.rubies[0] && x.rubies <= o.rubies[1]);
    }
    assert(cnt(G.roll('wooden', rr), 'legendary') === 0, 'no legendaries from wooden chests');
  }
  assert(G.chestOdds('silver').rares >= 1 && G.chestOdds('legendary').epicMin >= 1 && G.chestOdds('mythic').legendaryMin >= 1);
  // only cards of arenas you've reached (by best trophies) drop
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 150, best: 150, xp: 999999, claimed: { 0: true } }) }));
  for (let i = 0; i < 200; i++) assert(G.roll('mythic', rr).cards.every(k => G.chestPool().includes(k.id)));
  assert(!G.chestPool().some(id => ['bees', 'owl', 'thundercloud', 'griffin', 'camel'].includes(id)), 'level alone opens no arena cards');
  // win gold: a few per win, for the first 20 wins of a day only
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 100, best: 100, claimed: { 0: true }, rubies: 0 }) }));
  let paid = 0, last;
  for (let i = 0; i < 25; i++) { const g = G.winGold(); last = G.recordTrophy(0, 1); if (last.gold) { paid++; assert(last.gold >= g && last.gold < g * 1.5); } }
  assert.strictEqual(paid, 20, 'twenty paid wins a day');
  assert(last.gold === 0 && last.goldLeft === 0);
  assert.strictEqual(G.recordTrophy(1, 0).gold, 0, 'no gold for a loss');
  G.state.winDay.day = 'old'; assert(G.recordTrophy(0, 1).gold > 0, 'a new day pays again');
  console.log(`economy tables, start levels, floors, first copies, win gold (${G.winGold()} a win, 20 a day), safe loading: ok`);
}

// Diamonds skip a chest's timer: 1 per 5 minutes left, rounded up
{
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 100, best: 100, claimed: { 0: true }, diamonds: 200, rubies: 0 }) }));
  const Q = G.state, t0 = 1e12, mk = type => ({ type, state: 'locked', contents: { rubies: 10, cards: [{ id: 'wolves', n: 2 }], items: [] } });
  Q.chests = [mk('wooden'), mk('silver'), mk('mythic'), mk('gold')];
  assert.deepStrictEqual([0, 1, 2, 3].map(i => G.skipCost(i, t0)), [1, 3, 144, 12], 'whole timers: 1 min, 15 min, 12 h, 1 h');
  G.startUnlock(3, t0);
  assert.strictEqual(G.skipCost(3, t0 + 44 * 60e3), 4, '16 minutes left costs 4');
  assert.strictEqual(G.skipCost(3, t0 + 55 * 60e3 + 1), 1, 'under 5 minutes left costs 1');
  assert.strictEqual(G.skipCost(3, t0 + 3600e3), 0, 'nothing to skip once it is ready');
  const w = Q.cards.wolves.count;
  let r = G.skipChest(1, t0 + 60e3);
  assert(r.chest === 'silver' && r.cost === 3 && Q.diamonds === 197 && Q.chests[1] === null && Q.rubies === 10 && Q.cards.wolves.count === w + 2, 'pays and opens at once');
  assert.strictEqual(G.chestState(3, t0 + 60e3), 'unlocking', 'the chest already unlocking carries on');
  Q.diamonds = 100;
  r = G.skipChest(2, t0); assert(r.error === 'diamonds' && r.cost === 144 && Q.diamonds === 100 && Q.chests[2], 'not enough diamonds: nothing changes');
  assert.strictEqual(G.skipChest(1, t0).error, 'none', 'an empty slot has nothing to skip');
  console.log('skipping chest timers with diamonds (1 per 5 minutes): ok');
}

// Rubies: an older save's coins become rubies (in its chests and Shop offers too); wallet Coins swap
// one way for rubies, up to a daily cap set by the highest arena reached
{
  const old = { beaten: { owen: true, romeo: true, luc: true }, trophies: 950, best: 950, coins: 12345, diamonds: 7,
    chests: [{ type: 'silver', state: 'locked', contents: { coins: 40, cards: [{ id: 'wolves', n: 3 }], items: [] } }, null, null, null],
    shop: { day: 'x', offers: [{ id: 'o4', kind: 'coins', qty: 5000, currency: 'diamonds', price: 1 }], bought: {} } };
  G.load(mem({ 'kc.progress': JSON.stringify(old) }));
  const Q = G.state;
  assert(Q.rubies === 12345 && Q.coins === undefined && Q.wallet === 0 && Q.diamonds === 7, 'coins became rubies one for one');
  assert(Q.chests[0].contents.rubies === 40 && Q.chests[0].contents.coins === undefined && Q.shop.offers[0].kind === 'rubies', 'in chests and offers too');
  const t0 = new Date(2026, 10, 12, 10).getTime();
  assert.deepStrictEqual([G.exchangeInfo(t0).cap, G.exchangeInfo(t0).left], [4000, 4000], 'Arena 4: 4,000 a day');
  assert.strictEqual(G.exchange(10, t0).error, 'coins', 'no coins yet');
  Q.wallet = 1e6;
  for (const bad of [0, -5, 'x', NaN]) assert.strictEqual(G.exchange(bad, t0).error, 'amount');
  let x = G.exchange(2500.7, t0);
  assert(x.ok && x.coins === 2500 && Q.wallet === 1e6 - 2500 && Q.rubies === 12345 + 2500, 'whole coins, one ruby each');
  assert.strictEqual(G.exchange(1501, t0).error, 'cap', 'only 1,500 left today');
  assert(G.exchange(1500, t0 + 3600e3).ok && G.exchangeInfo(t0).left === 0);
  assert(G.exchangeInfo(t0 + 86400e3).left === 4000, 'a new limit the next day');
  const caps = [[0, 500], [300, 1000], [600, 2000], [900, 4000], [1999, 4000], [2000, 6000], [2600, 7000], [3300, 8000], [4100, 9000], [5000, 10000], [9000, 10000]].map(([b, c]) => { Q.best = b; return [b, G.exchangeInfo(t0).cap === c]; });
  assert(caps.every(c => c[1]), 'caps by arena ' + JSON.stringify(caps));
  Q.best = 1500; Q.trophies = 200; assert.strictEqual(G.exchangeInfo(t0).cap, 4000);
  assert.strictEqual(G.exchangeInfo(t0 + 86400e3).cap, 4000, 'the cap follows the best trophies, not a drop'); Q.best = 2700; assert.strictEqual(G.exchangeInfo(t0 + 86400e3).cap, 7000);
  G.load(mem({ 'kc.progress': JSON.stringify(Object.assign({}, Q, { wallet: -9, walletDay: 'junk' })) }));
  assert(G.state.wallet === 0 && G.state.walletDay.n === 0, 'bad wallet values are cleared');
  assert(G.state.rubies === 12345 + 4000, 'rubies carried over');
  console.log('rubies from old coins, wallet Coins to Rubies with daily caps by arena: ok');
}

// The diamond-only Shop sections: Daily Deals, the Magic Shop, the Card Shop
{
  const day = new Date(2026, 10, 12, 10).getTime();
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 100, best: 100, claimed: { 0: true }, diamonds: 100, rubies: 0 }) }));
  const Q = G.state, sh = G.shop(day, KCSim.mulberry(4));
  // deals: two, wild cards and rubies, always worth over twice their price
  assert.strictEqual(sh.deals.length, 2);
  // (epic wild cards only once an epic card can drop: Arena 1 has one since the expansion, Ashfall)
  const epicHere = G.chestPool().some(id => KC_CARDS[id].rarity === 'epic');
  for (const d of sh.deals) assert(d.rubies > 0 && d.wild.common > 0 && d.wild.rare > 0 && (epicHere || !d.wild.epic) && d.worth > 2, JSON.stringify(d));
  // magic: four different usable items, cheapest first; the hammer costs 25 and nothing costs more
  const M = G.ECONOMY.diamondShop.magic;
  assert.strictEqual(sh.magicItems.length, 4);
  assert.strictEqual(new Set(sh.magicItems.map(m => m.item)).size, 4);
  assert(sh.magicItems.every(m => G.magicUsable(m.item)) && !sh.magicItems.some(m => m.item === 'shards' || (!epicHere && m.item.endsWith('_epic')) || m.item.endsWith('_legendary')), 'only items you can use');
  assert(M.hammer_books.price === 25 && Object.values(M).every(m => m.price <= 25), 'the Hammer of Books costs the most');
  const order = ['wild_common', 'wild_rare', 'wild_epic', 'wild_legendary'], bk = ['book_common', 'book_rare', 'book_epic', 'book_legendary', 'book_books', 'hammer_books'];
  for (const list of [order, bk]) for (let i = 1; i < list.length; i++) assert(M[list[i]].price > M[list[i - 1]].price, 'rarer costs more: ' + list[i]);
  // cards: the three best cards the arena can give, rarest first (Ashfall, the one epic, then rares here)
  assert.strictEqual(sh.cardShop.length, 3);
  const RK = { common: 0, rare: 1, epic: 2, legendary: 3 }, best = Math.max(...G.chestPool().map(id => RK[KC_CARDS[id].rarity]));
  assert(sh.cardShop.every(c => G.chestPool().includes(c.card)) && RK[KC_CARDS[sh.cardShop[0].card].rarity] === best
    && sh.cardShop.every((c, i) => !i || RK[KC_CARDS[c.card].rarity] <= RK[KC_CARDS[sh.cardShop[i - 1].card].rarity]), JSON.stringify(sh.cardShop));
  // buying: diamonds only, once a day each, a confirm-free rule call here
  let r = G.buyDiamond('deals', 0, day);
  const d0 = sh.deals[0];
  assert(r.ok && Q.diamonds === 100 - d0.price && Q.rubies === d0.rubies && Q.magic.wild_common === d0.wild.common && Q.magic.wild_rare === d0.wild.rare, 'the deal pays out');
  assert.strictEqual(G.buyDiamond('deals', 0, day).error, 'sold', 'once a day');
  const hm = sh.magicItems[0], had = Q.magic[hm.item] || 0;
  r = G.buyDiamond('magic', 0, day); assert(r.ok && Q.magic[hm.item] === had + hm.qty, 'a magic item');
  const c0 = sh.cardShop[0], cnt = Q.cards[c0.card].count, wasFound = Q.found.includes(c0.card);
  // (a card not found yet: its first copy unlocks it and isn't counted as a duplicate)
  r = G.buyDiamond('cards', 0, day); assert(r.ok && Q.cards[c0.card].count === cnt + c0.qty - (wasFound ? 0 : 1) && r.cards[0].n === c0.qty && Q.found.includes(c0.card), 'a card pack');
  Q.diamonds = 0; assert.strictEqual(G.buyDiamond('cards', 1, day).error, 'diamonds');
  Q.rubies = 1e6; assert.strictEqual(G.buyDiamond('cards', 1, day).error, 'diamonds', 'rubies never buy these');
  // the same items all day, new ones tomorrow; a saved day's sections survive a reload
  assert.deepStrictEqual(G.shop(day + 3600e3).magicItems, sh.magicItems);
  G.load(mem({ 'kc.progress': JSON.stringify(Q) }));
  assert(G.shop(day).dBought['deals:d0'] && G.buyDiamond('deals', 0, day).error === 'sold', 'bought stays bought after a reload');
  const tomorrow = G.shop(day + 86400e3, KCSim.mulberry(9));
  assert(!Object.keys(tomorrow.dBought).length, 'a new day, nothing bought');
  // later arenas: legendaries and epics in the Card Shop; deals grow with price, still over 2x
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 1300, best: 1300, claimed: { 0: true }, diamonds: 100 }) }));
  const hi = G.shop(day, KCSim.mulberry(5));
  assert(hi.cardShop.every(c => KC_CARDS[c.card].rarity === 'legendary'), JSON.stringify(hi.cardShop)); // Camel, Griffin, Thornroller
  assert(hi.deals.every(d => d.worth > 2) && hi.deals[1].wild.epic > 0 && hi.deals[0].price > sh.deals[0].price, 'bigger deals later');
  for (let k = 0; k < 40; k++) { G.state.shop = null; const m = G.shop(day, KCSim.mulberry(100 + k)).magicItems; assert(m.length === 4 && m.every(x => G.magicUsable(x.item))); }
  console.log(`diamond Shop sections: deals worth ${sh.deals.map(d => d.worth + 'x').join(' and ')}, magic items 1 to 25 diamonds, the three best cards: ok`);
}

// Arenas 5 to 10: their trophies, four cards each, the road, chest pools by best trophies, opponents
{
  const A = [['frostfang', 5, 2000, ['frostsprite', 'icegiant', 'wintersage', 'flashfreeze']], ['blackwater', 6, 2600, ['dockraiders', 'barrel', 'harpoon', 'broadside']],
    ['gearforge', 7, 3300, ['coil', 'sparkbots', 'titan', 'arccannon']], ['crystal', 8, 4100, ['gemflash', 'shardguards', 'drill', 'prism']],
    ['skyward', 9, 5000, ['sunsprite', 'guardian', 'drake', 'phoenix']], ['eclipse', 10, 6000, ['wraiths', 'meteor', 'abyss', 'dreadknight']]];
  assert.deepStrictEqual(G.ARENAS.map(a => a.name).slice(0, 4), ['Cinder Keep', 'Briar Hollow', 'Sunstone Arena', 'Stormspire'], 'Arenas 1 to 4 unchanged');
  assert.strictEqual(G.ARENAS.length, 10);
  for (const [id, n, min, cards] of A) {
    const a = G.ARENAS.find(x => x.id === id);
    assert(a && a.number === n && a.min === min && !a.soon, id);
    assert(cards.every(c => a.cards.includes(c)), id + ' cards (its first four; the expansion adds more, see tools/expansion-test.js)');
    assert(G.ROAD.some(m => m.kind === 'arena' && m.arena === id && m.at === min), id + ' on the road');
    for (const c of cards) { const m = G.ROAD.find(r => r.kind === 'card' && r.card === c); assert(m && m.at > min && m.at < (G.ARENAS.find(x => x.number === n + 1) || { min: 1e9 }).min, c + ' on the road in its arena'); }
  }
  // the road climbs in order and every reward is claimable once
  for (let i = 1; i < G.ROAD.length; i++) assert(G.ROAD[i].at > G.ROAD[i - 1].at, 'road in order at ' + G.ROAD[i].at);
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 7100, best: 7100, claimed: { 0: true }, rubies: 0 }) }));
  const Z = G.state;
  let got = 0;
  for (const m of G.ROAD) if (G.roadState(m) === 'ready') { const r = G.claim(m.at); assert(r, 'claim ' + m.at); got++; }
  assert(G.ROAD.every(m => G.roadState(m) === 'claimed'), 'all claimed');
  for (const [, , , cards] of A) for (const c of cards) assert(Z.found.includes(c) && Z.cards[c].level === KC_MIN_LEVEL(c), c + ' found at its rarity level');
  assert.strictEqual(G.arena().number, 10);
  // chest pools by best trophies: a card only drops once its arena is reached
  for (const [, n, min, cards] of A) {
    G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: min - 1, best: min - 1, claimed: { 0: true }, xp: 99999 }) }));
    assert(!cards.some(c => G.chestPool().includes(c)), `Arena ${n} cards not before ${min}`);
    G.state.best = min; G.state.trophies = min;
    assert(cards.every(c => G.chestPool().includes(c)), `Arena ${n} cards from ${min}`);
    const r = KCSim.mulberry(n); let seen = new Set();
    for (let i = 0; i < 200; i++) for (const x of G.roll('mythic', r).cards) seen.add(x.id);
    assert(cards.some(c => seen.has(c)), `Arena ${n} cards come out of chests`);
    const next = G.ARENAS.find(x => x.number === n + 1);
    if (next) assert(!next.cards.some(c => seen.has(c)), `no Arena ${n + 1} cards yet`);
  }
  // high up, opponents play the new cards and are at full strength
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 6800, best: 6800, claimed: { 0: true } }) }));
  const newer = A.flatMap(a => a[3]);
  let withNew = 0;
  for (let i = 0; i < 60; i++) { const f = G.trophyFoe(KCSim.mulberry(400 + i)); if (f.deck.some(c => newer.includes(c))) withNew++; assert(new Set(f.deck).size === 8); }
  assert(withNew > 50, 'opponents at 6,800 trophies play the new cards ' + withNew);
  console.log(`Arenas 5 to 10: road (${got} rewards to 7,000), chest pools by arena, opponents use the new cards: ok`);
}

// King Tower levels, emotes in the Shop, and chests giving cards of your arena before the road does
{
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 320, best: 320, claimed: { 0: true }, rubies: 10000 }) }));
  const P7 = G.state;
  assert.strictEqual(G.kingInfo().level, 1);
  assert(P7.found.filter(id => KC_MIN_LEVEL(id) > 1).every(id => P7.cards[id].level === KC_MIN_LEVEL(id)), 'rares arrive at level 3');
  const keepFound = P7.found.slice(); P7.found = P7.found.filter(id => KC_MIN_LEVEL(id) === 1);   // commons only, to test the rule
  assert(!G.kingInfo().can, 'level 2 needs two level-2 cards');
  P7.cards.hawks.level = 2; assert(!G.kingInfo().can);
  P7.cards.wolves.level = 3; assert(G.kingInfo().can && G.kingInfo().have === 2);
  assert.strictEqual(G.upgradeKing().level, 2);
  assert(!G.kingInfo().can && G.kingInfo().need === 3, 'level 3 needs three level-3 cards');
  P7.cards.hawks.level = 3; P7.cards.gladiator.level = 3;
  P7.found = keepFound;
  assert.strictEqual(G.upgradeKing().level, 3);
  P7.king = 14; for (const id of KC_ALL_CARDS) P7.cards[id].level = 15; P7.found = KC_ALL_CARDS.slice(0, 14);
  assert(!G.kingInfo().can, 'level 15 needs fifteen level-15 cards');
  P7.found = KC_ALL_CARDS.slice(0, 15);
  assert.strictEqual(G.upgradeKing().level, 15); assert(G.kingInfo().max && G.upgradeKing() === null);
  const foe = G.trophyFoe(KCSim.mulberry(3));
  assert(foe.kingLevel >= 1 && foe.kingLevel <= 15, 'opponents have a King Tower level');
  // emotes: 15 in all, the same 3 all day, a new set tomorrow, bought for rubies
  assert.strictEqual(G.EMOTES.length, 15 + KC_ALL_CARDS.length, '15 emotes and one for every card');
  for (const id of KC_ALL_CARDS) assert(G.EMOTES.some(e => e.id === 'card_' + id && e.name === KC_CARDS[id].name), 'a card emote for ' + id);
  const day = new Date(2026, 10, 11, 9).getTime(), later = new Date(2026, 10, 11, 21).getTime(), next = new Date(2026, 10, 12, 9).getTime();
  const today = G.emoteOffers(day);
  assert.strictEqual(today.length, 3);
  assert.deepStrictEqual(today.map(o => o.id), G.emoteOffers(later).map(o => o.id), 'the same three all day');
  let changed = 0; for (let d = 0; d < 10; d++) if (G.emoteOffers(next + d * 864e5).map(o => o.id).join() !== today.map(o => o.id).join()) changed++;
  assert(changed >= 8, 'a new set on other days');
  P7.rubies = 10000;
  assert(G.EMOTE_SHOP.rubies === 5000 && G.EMOTE_SHOP.diamonds === 1, '5,000 rubies or 1 diamond');
  P7.diamonds = 1;
  assert(G.buyEmote(today[0].id, 'rubies', day).ok && P7.emotes.includes(today[0].id) && P7.rubies === 10000 - 5000);
  assert.strictEqual(G.buyEmote(today[0].id, 'rubies', day).error, 'owned');
  assert(G.buyEmote(today[1].id, 'diamonds', day).ok && P7.diamonds === 0 && P7.rubies === 5000, 'or one diamond');
  assert.strictEqual(G.buyEmote(today[2].id, 'diamonds', day).error, 'diamonds');
  assert.strictEqual(G.buyEmote(G.EMOTES.find(e => !today.some(o => o.id === e.id)).id, 'rubies', day).error, 'none', 'only today\'s three are for sale');
  let sawCard = 0; for (let d = 0; d < 30; d++) { P7.emoteShop = null; if (G.emoteOffers(next + d * 864e5).some(o => o.card)) sawCard++; }
  assert(sawCard > 15, 'card emotes come up in the daily three');
  // chests: Briar Hollow cards can come out in Briar Hollow before the road gives them
  P7.found = KC_STARTER_DECK.slice(); P7.trophies = 320;
  assert(['spears', 'pots', 'footmen', 'flail', 'skeletons', 'cannon'].every(id => G.chestPool().includes(id)));
  assert(!G.chestPool().includes('mole'), 'not cards of an arena you have not reached');
  let early = null; const r = KCSim.mulberry(8);
  for (let i = 0; i < 60 && !early; i++) { const c = G.roll('gold', r); if (c.cards.some(x => !P7.found.includes(x.id))) early = c; }
  assert(early, 'a chest gave a card not found yet');
  P7.chests[0] = { type: 'gold', state: 'unlocking', ends: 0, contents: early };
  const opened = G.openChest(0, 1);
  const fresh = opened.cards.filter(x => x.isNew).map(x => x.id);
  assert(fresh.length && fresh.every(id => P7.found.includes(id)), 'and it is found now');
  console.log(`King Tower levels (L cards at level L), ${G.EMOTES.length} emotes with 3 a day for 5,000 rubies or 1 diamond, chests give arena cards early (${fresh.join(', ')}): ok`);
}

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
