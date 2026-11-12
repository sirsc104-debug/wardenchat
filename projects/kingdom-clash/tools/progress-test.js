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
assert(got && got.coins >= 18 && got.cards.reduce((a, c) => a + c.n, 0) >= 6, 'at least a level-1 wooden chest');
assert.strictEqual(P.coins, coinsBefore + got.coins);
assert.strictEqual(KC_ALL_CARDS.reduce((a, id) => a + P.cards[id].count, 0), countsBefore + got.cards.reduce((a, c) => a + c.n, 0));
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
  // the chest row: coins only, any number of times, contents hidden until opened, free wooden chest daily
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, coins: 2000, diamonds: 50 }) }));
  const P4 = G.state;
  assert.deepStrictEqual(G.TIERS.map(t => [t, G.chestPrice(t)]), [['wooden', 80], ['silver', 280], ['gold', 800], ['platinum', 1800], ['legendary', 4200], ['mythic', 9500]]);
  for (const lv of [1, 5, 12, 30, 80]) for (const t of G.TIERS) assert(G.chestOdds(t, lv).coins[1] < G.chestPrice(t, lv), `a ${t} chest never pays back its price at level ${lv}`);
  let rc = G.buyChest('silver', KCSim.mulberry(1));
  assert(rc.ok && P4.coins === 2000 - 280 + rc.coins && P4.diamonds === 50, 'paid in coins, diamonds untouched');
  assert.strictEqual(rc.cards.reduce((a, c) => a + c.n, 0), G.chestOdds('silver').cards);
  const coinsNow = P4.coins; rc = G.buyChest('silver');
  assert(rc.ok && P4.coins === coinsNow - 280 + rc.coins, 'the same chest can be bought again');
  assert.strictEqual(G.buyChest('mythic').error, 'coins');
  assert.strictEqual(P4.chests.filter(Boolean).length, 0, 'shop chests do not use the chest slots');
  // free wooden chest, once a day
  assert(G.freeChestReady(day1));
  rc = G.claimFreeChest(day1); assert(rc.ok && rc.chest === 'wooden');
  assert.strictEqual(G.claimFreeChest(day1 + 3600e3).error, 'claimed');
  assert(G.freeChestReady(day2) && G.claimFreeChest(day2).ok, 'a new free chest the next day');
  // contents follow the account level, not trophies
  assert.strictEqual(G.chestOdds('gold', 1).cards, 45);
  assert.strictEqual(G.chestOdds('gold', 11).cards, Math.round(45 * 2.5));
  P4.xp = 0; P4.trophies = 5000; const low = G.chestOdds('gold');
  P4.xp = 1000; P4.trophies = 0; const high = G.chestOdds('gold');
  assert(low.cards === 45 && high.cards > low.cards && high.coins[0] > low.coins[0], 'level 11 beats level 1 whatever the trophies');
  assert.strictEqual(G.chestPrice('gold'), Math.round(800 * 2.5 / 5) * 5);
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
  assert(silver.some(x => x.id === 'wild_common' && x.n >= 2), 'silver chests give common wild cards in Arena 2');
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
  P5.cards.rhino.level = 2; P5.cards.rhino.count = 0;              // rare: needs 2
  P5.coins = 0; P5.magic = { wild_common: 4, book_common: 1, book_rare: 1, book_books: 1, hammer_books: 1 };
  assert.strictEqual(G.magicFor('wild_rare', 'wolves').reason, 'none-held');
  assert.strictEqual(G.magicFor('book_rare', 'wolves').reason, 'rarity');
  let mu = G.useMagic('wild_common', 'wolves'); assert(mu.ok && mu.gives === 4 && P5.cards.wolves.count === 5 && P5.magic.wild_common === 0, 'wild cards add up to what is held');
  assert(G.magicFor('hammer_books', 'wolves').ok && G.magicFor('hammer_books', 'wolves').fills === 5, 'the hammer fills missing copies');
  mu = G.useMagic('book_common', 'wolves'); assert(mu.ok && P5.cards.wolves.count === 10 && P5.magic.book_common === 0, 'a book fills the rest');
  assert.strictEqual(G.magicFor('book_books', 'wolves').reason, 'full');
  mu = G.useMagic('hammer_books', 'wolves'); assert(mu.ok && P5.cards.wolves.level === 4 && P5.cards.wolves.count === 0 && P5.coins === 0, 'the hammer upgrades without coins');
  mu = G.useMagic('book_books', 'rhino'); assert(mu.ok && P5.cards.rhino.count === 2, 'the Book of Books works on a rare');
  assert.strictEqual(G.magicFor('shards', 'rhino').reason, 'none-held');
  const P6 = G.load(st0 = mem({ 'kc.progress': JSON.stringify(P5) }));
  assert.strictEqual(P6.cards.wolves.level, 4); assert.strictEqual(G.magicCount('book_books'), 0);
  console.log('wild cards, books, Book of Books and the Hammer of Books: ok');
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

  // Arena 3, Sunstone Arena: its four cards, evolutions and the Diamond Pass
  {
    G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 590, best: 590, claimed: { 0: true }, coins: 0, diamonds: 20 }) }));
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
    assert.strictEqual(G.roadState(G.ROAD.find(m => m.at === 1200)), 'soon', 'Arena 5 is coming soon');
    let sawStorm = 0; for (let i = 0; i < 40; i++) if (G.trophyFoe(KCSim.mulberry(i + 77)).deck.some(id => ['bees', 'owl', 'thundercloud', 'griffin'].includes(id))) sawStorm++;
    assert(sawStorm > 20, 'opponents at 1,200 trophies play Stormspire cards');
    assert(!KC_ALL_CARDS.includes('ramsoldier'), 'the cart soldiers are not a card');
    let sawSun = 0; for (let i = 0; i < 40; i++) if (G.trophyFoe(KCSim.mulberry(i + 31)).deck.some(id => ['sandstorm', 'ramcart', 'mole', 'camel'].includes(id))) sawSun++;
    assert(sawSun > 20, 'opponents at 900 trophies play Sunstone cards');
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
    assert(G.claimPass(0, 'free').coins === 300);
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

// King Tower levels, emotes in the Shop, and chests giving cards of your arena before the road does
{
  G.load(mem({ 'kc.progress': JSON.stringify({ beaten: { owen: true, romeo: true, luc: true }, trophies: 320, best: 320, claimed: { 0: true }, coins: 10000 }) }));
  const P7 = G.state;
  assert.strictEqual(G.kingInfo().level, 1);
  assert(!G.kingInfo().can, 'level 2 needs two level-2 cards');
  P7.cards.rhino.level = 2; assert(!G.kingInfo().can);
  P7.cards.wolves.level = 3; assert(G.kingInfo().can && G.kingInfo().have === 2);
  assert.strictEqual(G.upgradeKing().level, 2);
  assert(!G.kingInfo().can && G.kingInfo().need === 3, 'level 3 needs three level-3 cards');
  P7.cards.rhino.level = 3; P7.cards.gladiator.level = 3;
  assert.strictEqual(G.upgradeKing().level, 3);
  P7.king = 14; for (const id of KC_ALL_CARDS) P7.cards[id].level = 15; P7.found = KC_ALL_CARDS.slice(0, 14);
  assert(!G.kingInfo().can, 'level 15 needs fifteen level-15 cards');
  P7.found = KC_ALL_CARDS.slice(0, 15);
  assert.strictEqual(G.upgradeKing().level, 15); assert(G.kingInfo().max && G.upgradeKing() === null);
  const foe = G.trophyFoe(KCSim.mulberry(3));
  assert(foe.kingLevel >= 1 && foe.kingLevel <= 15, 'opponents have a King Tower level');
  // emotes: 15 in all, the same 3 all day, a new set tomorrow, bought for coins
  assert.strictEqual(G.EMOTES.length, 15 + KC_ALL_CARDS.length, '15 emotes and one for every card');
  for (const id of KC_ALL_CARDS) assert(G.EMOTES.some(e => e.id === 'card_' + id && e.name === KC_CARDS[id].name), 'a card emote for ' + id);
  const day = new Date(2026, 10, 11, 9).getTime(), later = new Date(2026, 10, 11, 21).getTime(), next = new Date(2026, 10, 12, 9).getTime();
  const today = G.emoteOffers(day);
  assert.strictEqual(today.length, 3);
  assert.deepStrictEqual(today.map(o => o.id), G.emoteOffers(later).map(o => o.id), 'the same three all day');
  let changed = 0; for (let d = 0; d < 10; d++) if (G.emoteOffers(next + d * 864e5).map(o => o.id).join() !== today.map(o => o.id).join()) changed++;
  assert(changed >= 8, 'a new set on other days');
  P7.coins = 10000;
  assert(G.EMOTE_SHOP.coins === 5000 && G.EMOTE_SHOP.diamonds === 1, '5,000 coins or 1 diamond');
  P7.diamonds = 1;
  assert(G.buyEmote(today[0].id, 'coins', day).ok && P7.emotes.includes(today[0].id) && P7.coins === 10000 - 5000);
  assert.strictEqual(G.buyEmote(today[0].id, 'coins', day).error, 'owned');
  assert(G.buyEmote(today[1].id, 'diamonds', day).ok && P7.diamonds === 0 && P7.coins === 5000, 'or one diamond');
  assert.strictEqual(G.buyEmote(today[2].id, 'diamonds', day).error, 'diamonds');
  assert.strictEqual(G.buyEmote(G.EMOTES.find(e => !today.some(o => o.id === e.id)).id, 'coins', day).error, 'none', 'only today\'s three are for sale');
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
  console.log(`King Tower levels (L cards at level L), ${G.EMOTES.length} emotes with 3 a day for 5,000 coins or 1 diamond, chests give arena cards early (${fresh.join(', ')}): ok`);
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
