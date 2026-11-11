/* Kingdom Clash: the player's progress and the rules for it, with no screen code (so it can be
   tested in Node: tools/progress-test.js).

   - The Training Grounds: beat Trainer Owen, Romeo and Luc in order to open the Trophy Road.
   - The Trophy Road: trophy battles against bots matched to your trophies. A win is +30 trophies
     and earns a chest if a slot is free; a loss is -20 (never below the arena's floor). Milestones on
     the road give fixed rewards you claim: coins, chests, new cards and arenas.
   - Opponents: their cards level up one at a time with their trophies (all level 1 below 50, then one
     card up a level every 12.5 trophies); their skill follows your recent results (up a step
     after a win, down a step after a loss), settling at about 52% wins for everyone.
   - Chests: four slots. A chest is rolled the moment you win it; one chest unlocks at a time, on a
     real-time timer. Opening gives coins and copies of cards you have found.
   - Card levels: copies plus coins upgrade a card, up to level 15.
   - Arena cards (Skeleton Pack, Cannon) are found on the Trophy Road in Arena 1 only. Trainers never
     use them, and in a Training Grounds match your deck goes back to the starter cards.

   - The Shop: five offers a day built from the cards you have found and their levels, for coins
     or diamonds (1 diamond = 5,000 coins). Each offer lists exactly what it gives.

   Coins and diamonds are kept on this device for now. When the SirSC wallet is connected they move
   to it, and prices and purchases must then be decided by the server.
   Everything is saved in localStorage under kc.progress; older saves are upgraded in place. */
'use strict';

const KCProgress = (() => {
  const KEY = 'kc.progress';
  const MAX_LEVEL = 15;
  const XP_PER_LEVEL = 100;
  const XP = { win: 20, draw: 10, loss: 6, firstWin: 30 };
  const TROPHIES = { win: 30, loss: 20 };

  const ARENAS = [
    { id: 'cinder', number: 1, name: 'Cinder Keep', min: 0, theme: 'cinder', cards: ['skeletons', 'cannon'],
      blurb: 'A ruined fortress of forges and ash, where old cannons still guard the walls.' },
    { id: 'arena2', number: 2, name: 'Arena 2', min: 300, soon: true, blurb: 'Coming in a later update.' },
  ];
  // Fixed rewards along the road, claimed by the player.
  const ROAD = [
    { at: 0, kind: 'arena', arena: 'cinder' },
    { at: 20, kind: 'coins', amount: 50 },
    { at: 40, kind: 'card', card: 'skeletons', copies: 6 },
    { at: 60, kind: 'chest', chest: 'silver' },
    { at: 90, kind: 'coins', amount: 100 },
    { at: 120, kind: 'card', card: 'cannon', copies: 4 },
    { at: 160, kind: 'chest', chest: 'silver' },
    { at: 200, kind: 'coins', amount: 200 },
    { at: 250, kind: 'chest', chest: 'gold' },
    { at: 300, kind: 'arena', arena: 'arena2' },
  ];
  const CHESTS = {
    wooden: { name: 'Wooden Chest', seconds: 60, coins: [18, 26], cards: 6, kinds: 2 },
    silver: { name: 'Silver Chest', seconds: 15 * 60, coins: [60, 85], cards: 18, kinds: 3 },
    gold: { name: 'Gold Chest', seconds: 60 * 60, coins: [190, 250], cards: 45, kinds: 4 },
  };
  // The order chests are won in, repeating.
  const CYCLE = ['wooden', 'wooden', 'silver', 'wooden', 'silver', 'wooden', 'wooden', 'gold', 'wooden', 'silver'];
  // Copies and coins to go from level L to L+1 (index 0 is level 1 to 2).
  const UPGRADE = {
    copies: {
      common: [2, 4, 10, 20, 40, 80, 150, 250, 400, 600, 800, 1000, 1500, 2000],
      rare: [1, 2, 4, 8, 15, 30, 50, 80, 120, 160, 200, 250, 300, 400],
    },
    coins: [5, 20, 50, 150, 400, 1000, 2000, 4000, 6000, 9000, 14000, 20000, 30000, 50000],
  };
  // Trophy opponents look like any other player. They don't talk (no speech bubbles or result lines).
  const FOE_NAMES = ['EmberFox', 'Kestrel', 'MossKnight', 'Juno77', 'BrickTop', 'Lumen', 'NovaRae', 'Quillon', 'RowanK', 'Tidebreaker',
    'Sable', 'PixelPike', 'Hollis', 'Marigold', 'Vexa', 'Orrin22', 'CrimsonOwl', 'Tamsin', 'Bramble', 'Ashgrove', 'Kaito', 'Wren', 'Delphine', 'Grit'];
  const FOE_BG = [['#ffcf6b', '#ea8b2b'], ['#c99bff', '#7440cf'], ['#9fc0e0', '#3c5d8c'], ['#9fe6b8', '#2c8a5a'], ['#ffa3b5', '#c03a5a'], ['#a8e4ff', '#2f7cb8']];
  const FOE_SKIN = ['#f2c4a0', '#d9a27a', '#b87a52', '#8a5636', '#efc19c'];
  const FOE_HAIR = ['#2a1d18', '#6b4426', '#c58a3c', '#1e1e26', '#9a3b2a', '#c9ccd6'];
  const FOE_SHIRT = ['#dc3640', '#2fb36b', '#3d4459', '#2f6fe4', '#9b6bd6', '#f08a4b'];
  function foeLook(rand) {
    const pick = a => a[Math.floor(rand() * a.length)];
    const hair = pick(['cap', 'curly', 'beard', 'curly', 'cap']);
    const hat = pick(['#2f6fe4', '#dc3640', '#2fb36b', '#3d4459']);
    return { bg: pick(FOE_BG), hair, hat, hairCol: pick(FOE_HAIR), band: pick(['#ffcd33', '#ffffff', '#5fc4d9']),
      shirt: pick(FOE_SHIRT), skin: pick(FOE_SKIN), extra: pick(['', 'scarf', 'armor', '']), mouth: pick(['smile', 'smirk', 'flat']) };
  }

  let P = null, storage = null;
  const store = {
    get() { try { const v = storage && storage.getItem(KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(v) { try { storage && storage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage blocked: progress lasts this visit */ } },
  };
  const blank = () => ({
    name: 'Player', xp: 0, beaten: {}, records: {}, roadSeen: false, opp: null,
    mode: null, trophies: 0, best: 0, coins: 0, diamonds: 0, shop: null, cards: {}, found: KC_STARTER_DECK.slice(), deck: KC_STARTER_DECK.slice(),
    chests: [null, null, null, null], cycle: 0, claimed: {}, diff: 0.35, trophyRecord: { w: 0, l: 0, d: 0 },
  });

  function load(st) {
    storage = st === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : st;
    P = Object.assign(blank(), store.get() || {});
    let old = null; // the record kept before there were three trainers
    try { old = storage && JSON.parse(storage.getItem('kc.record') || 'null'); } catch (e) { old = null; }
    if (old && !P.records.owen) { P.records.owen = old; if (old.w > 0) P.beaten.owen = true; }
    for (const t of KC_TRAINERS) P.records[t.id] = Object.assign({ w: 0, l: 0, d: 0 }, P.records[t.id]);
    for (const id of KC_ALL_CARDS) P.cards[id] = Object.assign({ level: 1, count: 0 }, P.cards[id]);
    P.found = KC_ALL_CARDS.filter(id => P.found.includes(id));
    if (!Array.isArray(P.deck) || P.deck.length !== 8 || new Set(P.deck).size !== 8 || P.deck.some(id => !P.found.includes(id))) P.deck = KC_STARTER_DECK.slice();
    while (P.chests.length < 4) P.chests.push(null);
    if (roadOpen() && !P.claimed[0]) P.claimed[0] = true; // the first arena opens with the road
    return P;
  }
  const save = () => store.set(P);

  /* ---------- account ---------- */
  const level = () => 1 + Math.floor(P.xp / XP_PER_LEVEL);
  function addXp(n) { const before = level(); P.xp += n; return level() > before ? level() : 0; }

  /* ---------- the Training Grounds ---------- */
  const unlocked = id => { const i = KC_TRAINERS.findIndex(t => t.id === id); return i === 0 || !!P.beaten[KC_TRAINERS[i - 1].id]; };
  const nextTrainer = () => KC_TRAINERS.find(t => !P.beaten[t.id]) || null;
  const roadOpen = () => KC_TRAINERS.every(t => P.beaten[t.id]);
  const beatenCount = () => KC_TRAINERS.filter(t => P.beaten[t.id]).length;
  function trainer() {
    if (P.opp && KC_TRAINER[P.opp] && unlocked(P.opp)) return KC_TRAINER[P.opp];
    return nextTrainer() || KC_TRAINERS[KC_TRAINERS.length - 1];
  }
  // What the Battle button plays: a trophy battle once the road is open (unless a trainer was picked).
  const mode = () => (roadOpen() && P.mode !== 'trainer' ? 'trophy' : 'trainer');
  function setMode(m, id) { P.mode = m; if (id) P.opp = id; save(); }

  function recordTrainer(id, winner) {
    const r = P.records[id];
    let xp = winner === 0 ? XP.win : winner === 1 ? XP.loss : XP.draw;
    if (winner === 0) r.w++; else if (winner === 1) r.l++; else r.d++;
    let unlockedNext = null, opened = false, firstWin = false;
    if (winner === 0 && !P.beaten[id]) {
      firstWin = true;
      xp += XP.firstWin;
      P.beaten[id] = true;
      const i = KC_TRAINERS.findIndex(t => t.id === id);
      unlockedNext = KC_TRAINERS[i + 1] || null;
      opened = !unlockedNext && roadOpen();
      if (unlockedNext) P.opp = unlockedNext.id;
      if (opened) { P.mode = 'trophy'; P.claimed[0] = true; }
    }
    const levelUp = addXp(xp);
    save();
    return { kind: 'trainer', xp, firstWin, unlockedNext, roadOpened: opened, levelUp };
  }

  /* ---------- arenas and the road ---------- */
  const arena = (t = P.trophies) => ARENAS.filter(a => !a.soon && t >= a.min).pop() || ARENAS[0];
  const nextArena = (t = P.trophies) => ARENAS.find(a => a.min > t) || null;
  const arenaFloor = () => arena().min;
  function roadState(m) {
    if (P.claimed[m.at]) return 'claimed';
    if (!roadOpen() || P.trophies < m.at) return 'locked';
    if (m.kind === 'arena' && ARENAS.find(a => a.id === m.arena).soon) return 'soon';
    return 'ready';
  }
  const claimable = () => ROAD.filter(m => roadState(m) === 'ready');
  // Claim a road reward. Returns what it gave (coins, a card, or a chest's contents opened on the spot).
  function claim(at) {
    const m = ROAD.find(r => r.at === at);
    if (!m || roadState(m) !== 'ready') return null;
    P.claimed[at] = true;
    let out = { kind: m.kind };
    if (m.kind === 'coins') { P.coins += m.amount; out.coins = m.amount; }
    else if (m.kind === 'card') {
      const isNew = !P.found.includes(m.card);
      if (isNew) P.found = KC_ALL_CARDS.filter(id => id === m.card || P.found.includes(id));
      P.cards[m.card].count += m.copies;
      out = { kind: 'card', cards: [{ id: m.card, n: m.copies, isNew }], coins: 0 };
    } else if (m.kind === 'chest') {
      const c = roll(m.chest);
      apply(c);
      out = Object.assign({ kind: 'chest', chest: m.chest }, c);
    } else if (m.kind === 'arena') out.arena = m.arena;
    save();
    return out;
  }

  /* ---------- trophy battles ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  // Opponents level their cards one at a time as their trophies rise. Below 50 trophies every card is
  // level 1. From 50, one card goes up a level every 12.5 trophies: one level-2 card at 50, two at
  // 62.5 ... all eight at 137.5; then the first level 3 at 150, and so on (a full level per 100
  // trophies) until every card is level 15 at 1,437.5.
  const FOE_FIRST = 50, FOE_STEP = 12.5, DECK = 8;
  const foeUpgrades = t => (t < FOE_FIRST ? 0 : Math.min((MAX_LEVEL - 1) * DECK, 1 + Math.floor((t - FOE_FIRST) / FOE_STEP)));
  // Spread n single-card upgrades over a deck: everyone gets floor(n / 8) levels, and n % 8 cards
  // (picked with rand, so each opponent differs) are one level ahead.
  function spreadLevels(n, ids, rand = Math.random) {
    const base = 1 + Math.floor(n / ids.length), order = ids.slice();
    let extra = n % ids.length;
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return Object.fromEntries(order.map(id => [id, Math.min(MAX_LEVEL, base + (extra-- > 0 ? 1 : 0))]));
  }
  // The opponent for the next trophy battle: card levels follow their trophies, skill follows P.diff.
  function trophyFoe(rand = Math.random) {
    const d = Math.max(0, Math.min(1, P.diff)), t = P.trophies;
    const skill = {
      react: [lerp(2.2, 0.6, d), lerp(3.6, 1.2, d)], sloppy: lerp(0.5, 0.12, d), attackAt: lerp(9.8, 8, d), idle: lerp(0.45, 0.08, d),
      fireballValue: lerp(8, 5, d), defend: lerp(0.4, 1, d), gap: [lerp(2.6, 0.5, d), lerp(4.2, 1.1, d)],
    };
    const deck = KC_STARTER_DECK.slice();
    const swap = (id, p) => {
      if (rand() > p) return;
      const i = 1 + Math.floor(rand() * 6); // keep the Rhino (0) and Fireball (7)
      if (!deck.includes(id)) deck[i] = id;
    };
    if (t >= 40) swap('skeletons', 0.6);
    if (t >= 120) swap('cannon', 0.6);
    const name = FOE_NAMES[Math.floor(rand() * FOE_NAMES.length)];
    const foeTrophies = Math.max(0, t + Math.round((rand() - 0.5) * 30));
    const cardLevels = spreadLevels(foeUpgrades(foeTrophies), deck, rand);
    const lvl = Math.min(...Object.values(cardLevels));
    return {
      id: 'trophy', kind: 'trophy', name, short: name, level: lvl, tier: `${foeTrophies} trophies`,
      look: foeLook(rand), lines: null, skill, towerDamage: lerp(0.5, 1, d), deck, cardLevels, trophies: foeTrophies,
    };
  }
  function recordTrophy(winner) {
    const r = P.trophyRecord, before = P.trophies, beforeArena = arena().id;
    if (winner === 0) { r.w++; P.trophies += TROPHIES.win; P.diff += 0.05; }
    else if (winner === 1) { r.l++; P.trophies = Math.max(arenaFloor(), P.trophies - TROPHIES.loss); P.diff -= 0.055; }
    else r.d++;
    P.diff = Math.max(0, Math.min(1, P.diff));
    P.best = Math.max(P.best, P.trophies);
    let chest = null, slotsFull = false;
    if (winner === 0) {
      const slot = P.chests.findIndex(c => !c);
      if (slot < 0) slotsFull = true;
      else {
        const type = CYCLE[P.cycle % CYCLE.length];
        P.cycle++;
        P.chests[slot] = { type, state: 'locked', contents: roll(type) };
        chest = { type, slot, name: CHESTS[type].name };
      }
    }
    const xp = winner === 0 ? XP.win : winner === 1 ? XP.loss : XP.draw, levelUp = addXp(xp);
    const newArena = arena().id !== beforeArena ? arena() : null;
    save();
    return { kind: 'trophy', delta: P.trophies - before, trophies: P.trophies, chest, slotsFull, xp, levelUp, newArena, newRewards: claimable().length };
  }

  /* ---------- chests ---------- */
  function roll(type, rand = Math.random) {
    const C = CHESTS[type], pool = P.found.filter(id => KC_CARDS[id]);
    const coins = Math.round(lerp(C.coins[0], C.coins[1], rand()));
    const kinds = Math.min(C.kinds, pool.length), picks = [];
    const bag = pool.slice();
    for (let i = 0; i < kinds; i++) picks.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
    // rares come in smaller stacks
    const weight = id => (KC_CARDS[id].rarity === 'rare' ? 0.35 : 1);
    const total = picks.reduce((a, id) => a + weight(id), 0);
    let left = C.cards;
    const cards = picks.map((id, i) => {
      const n = i === picks.length - 1 ? left : Math.max(1, Math.round(C.cards * weight(id) / total * (0.8 + rand() * 0.4)));
      left -= n;
      return { id, n: Math.max(1, n) };
    }).filter(c => c.n > 0);
    return { coins, cards };
  }
  function apply(c) {
    P.coins += c.coins;
    for (const { id, n } of c.cards) P.cards[id].count += n;
  }
  function chestState(i, now = Date.now()) {
    const c = P.chests[i];
    if (!c) return 'empty';
    if (c.state === 'unlocking') return now >= c.ends ? 'ready' : 'unlocking';
    return 'locked';
  }
  const unlockingSlot = (now = Date.now()) => P.chests.findIndex((c, i) => chestState(i, now) === 'unlocking');
  function startUnlock(i, now = Date.now()) {
    if (chestState(i, now) !== 'locked') return 'not-locked';
    if (unlockingSlot(now) >= 0) return 'busy';
    const c = P.chests[i];
    c.state = 'unlocking';
    c.ends = now + CHESTS[c.type].seconds * 1000;
    save();
    return 'ok';
  }
  function openChest(i, now = Date.now()) {
    if (chestState(i, now) !== 'ready') return null;
    const c = P.chests[i];
    P.chests[i] = null;
    const before = P.found.slice();
    apply(c.contents);
    save();
    return Object.assign({ chest: c.type }, c.contents, { cards: c.contents.cards.map(x => Object.assign({ isNew: !before.includes(x.id) }, x)) });
  }

  /* ---------- the Shop ---------- */
  // Five offers a day, made from the cards you have found and their levels. Every offer says exactly
  // what it gives. Prices: a copy is worth 10 coins (common) or 50 (rare); 1 diamond = 5,000 coins.
  const SHOP = { perCopy: { common: 10, rare: 50 }, coinsPerDiamond: 5000, maxQty: 250 };
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = now => { const d = new Date(now); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  // When today's offers are replaced: the next local midnight.
  const shopEnds = (now = Date.now()) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime(); };
  const copiesNeed = id => UPGRADE.copies[KC_CARDS[id].rarity][P.cards[id].level - 1];
  function copiesToMax(id) {
    const c = P.cards[id], list = UPGRADE.copies[KC_CARDS[id].rarity];
    let n = 0;
    for (let l = c.level; l < MAX_LEVEL; l++) n += list[l - 1];
    return Math.max(0, n - c.count);
  }
  function makeOffers(rand = Math.random) {
    const open = P.found.filter(id => P.cards[id].level < MAX_LEVEL);
    for (let i = open.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [open[i], open[j]] = [open[j], open[i]]; }
    const used = new Set(), offers = [];
    const lvl = id => P.cards[id].level, inDeck = id => (P.deck.includes(id) ? 1 : 0);
    const missing = id => copiesNeed(id) - P.cards[id].count;
    const free = () => { const f = open.filter(id => !used.has(id)); return f.length ? f : open.slice(); };
    const add = (id, qty, tag, currency) => {
      if (!id) return;
      used.add(id);
      qty = Math.max(1, Math.min(qty, copiesToMax(id) || 1));
      const value = qty * SHOP.perCopy[KC_CARDS[id].rarity];
      offers.push({ id: 'o' + offers.length, kind: 'card', card: id, qty, tag, currency,
        price: currency === 'diamonds' ? Math.max(1, Math.ceil(value / SHOP.coinsPerDiamond)) : value });
    };
    if (open.length) {
      // 1. the card closest to its next upgrade: exactly the copies it is missing
      let pool = free().filter(id => missing(id) > 0).sort((a, b) => missing(a) - missing(b) || inDeck(b) - inDeck(a));
      let id = pool[0] || free()[0];
      add(id, Math.min(SHOP.maxQty, missing(id) > 0 ? missing(id) : copiesNeed(id)), 'Closest to upgrade', 'coins');
      // 2. a rare card (a common if every rare is taken or maxed): one level's worth
      pool = free().filter(c => KC_CARDS[c].rarity === 'rare');
      id = pool[0] || free()[0];
      add(id, Math.min(SHOP.maxQty, copiesNeed(id)), KC_CARDS[id].rarity === 'rare' ? 'Rare pick' : 'Card pick', 'coins');
      // 3. your lowest-level card (cards found on the Trophy Road first): one level's worth
      pool = free().sort((a, b) => lvl(a) - lvl(b) || (KC_STARTER_DECK.includes(a) ? 1 : 0) - (KC_STARTER_DECK.includes(b) ? 1 : 0));
      id = pool[0];
      add(id, Math.min(SHOP.maxQty, copiesNeed(id)), 'Catch up', 'coins');
      // 4. a big bundle of your highest-level deck card: 5,000 coins' worth of copies for 1 diamond
      pool = free().sort((a, b) => inDeck(b) - inDeck(a) || lvl(b) - lvl(a));
      id = pool[0];
      add(id, Math.floor(SHOP.coinsPerDiamond / SHOP.perCopy[KC_CARDS[id].rarity]), 'Mega bundle', 'diamonds');
    }
    // 5. coins for a diamond, at the exchange rate
    offers.push({ id: 'o' + offers.length, kind: 'coins', qty: SHOP.coinsPerDiamond, tag: 'Coin bundle', currency: 'diamonds', price: 1, repeat: true });
    return offers;
  }
  // Today's offers (made the first time they are asked for each day).
  function shop(now = Date.now(), rand) {
    const day = dayKey(now);
    if (!P.shop || P.shop.day !== day || !Array.isArray(P.shop.offers)) { P.shop = { day, offers: makeOffers(rand), bought: {} }; save(); }
    return P.shop;
  }
  function refreshShop(rand, now = Date.now()) { P.shop = null; return shop(now, rand); }
  // Buy offer i. Returns { ok, coins, cards } or { error: 'sold' | 'coins' | 'diamonds' | 'none' }.
  function buy(i, now = Date.now()) {
    const s = shop(now), o = s.offers[i];
    if (!o) return { error: 'none' };
    if (s.bought[o.id] && !o.repeat) return { error: 'sold' };
    const wallet = o.currency === 'diamonds' ? 'diamonds' : 'coins';
    if (P[wallet] < o.price) return { error: wallet };
    P[wallet] -= o.price;
    let out;
    if (o.kind === 'coins') { P.coins += o.qty; out = { coins: o.qty, cards: [] }; }
    else { P.cards[o.card].count += o.qty; out = { coins: 0, cards: [{ id: o.card, n: o.qty, isNew: false }] }; }
    s.bought[o.id] = (s.bought[o.id] || 0) + 1;
    save();
    return Object.assign({ ok: true, offer: o }, out);
  }
  // TEMPORARY: the test button's 1,000,000 coins and diamonds.
  function grantTest() { P.coins = 1000000; P.diamonds = 1000000; save(); }

  /* ---------- cards ---------- */
  function upgradeInfo(id) {
    const c = P.cards[id], card = KC_CARDS[id];
    if (!P.found.includes(id)) return { found: false };
    if (c.level >= MAX_LEVEL) return { found: true, max: true, level: c.level, count: c.count };
    const need = UPGRADE.copies[card.rarity][c.level - 1], cost = UPGRADE.coins[c.level - 1];
    const reason = c.count < need ? 'copies' : P.coins < cost ? 'coins' : '';
    return { found: true, level: c.level, count: c.count, need, cost, can: !reason, reason };
  }
  const upgradable = () => P.found.filter(id => upgradeInfo(id).can);
  function upgrade(id) {
    const u = upgradeInfo(id);
    if (!u.can) return null;
    P.cards[id].count -= u.need;
    P.coins -= u.cost;
    P.cards[id].level++;
    const xp = 4 * P.cards[id].level, levelUp = addXp(xp);
    save();
    return { level: P.cards[id].level, xp, levelUp };
  }
  const cardLevels = () => Object.fromEntries(KC_ALL_CARDS.map(id => [id, P.cards[id].level]));
  // Arena cards can't be used in the Training Grounds: for a trainer match, each one in your deck is
  // swapped for a starter card you left out, so you always bring the eight starter cards there.
  function trainingDeck() {
    const spare = KC_STARTER_DECK.filter(id => !P.deck.includes(id));
    return P.deck.map(id => (KC_STARTER_DECK.includes(id) ? id : spare.shift()));
  }
  // Put a found card into a deck slot; if it was already in the deck, the two swap places.
  function setDeck(slot, id) {
    if (!P.found.includes(id) || slot < 0 || slot > 7) return false;
    const was = P.deck.indexOf(id);
    if (was === slot) return true;
    if (was >= 0) P.deck[was] = P.deck[slot];
    P.deck[slot] = id;
    save();
    return true;
  }
  const unlockAt = id => { const m = ROAD.find(r => r.kind === 'card' && r.card === id); return m ? m.at : null; };

  return {
    MAX_LEVEL, XP_PER_LEVEL, TROPHIES, ARENAS, ROAD, CHESTS, CYCLE, UPGRADE,
    load, save, get state() { return P; },
    level, unlocked, nextTrainer, roadOpen, beatenCount, trainer, mode, setMode, recordTrainer,
    arena, nextArena, roadState, claimable, claim,
    trophyFoe, foeUpgrades, spreadLevels, recordTrophy,
    roll, chestState, unlockingSlot, startUnlock, openChest,
    SHOP, shop, shopEnds, refreshShop, buy, grantTest,
    upgradeInfo, upgradable, upgrade, cardLevels, trainingDeck, setDeck, unlockAt,
  };
})();
