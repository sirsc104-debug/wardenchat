/* Kingdom Clash: the player's progress and the rules for it, with no screen code (so it can be
   tested in Node: tools/progress-test.js).

   - The Training Grounds: beat Trainer Owen, Romeo and Luc in order to open the Trophy Road.
   - The Trophy Road: trophy battles against bots matched to your trophies. A win is +30 trophies
     and earns a chest if a slot is free; a loss is -20 (never below the arena's floor). Milestones on
     the road give fixed rewards you claim: coins, chests, new cards and arenas.
   - Opponents: their cards level up one at a time with their trophies (all level 1 below 50, then one
     card up a level every 12.5 trophies); their skill follows your recent results (up a step
     after a win, down a step after a loss), settling at about 52% wins for everyone.
   - Chests: six tiers (wooden, silver, gold, platinum, legendary, mythic) and four slots. A chest is
     rolled the moment you win it; one chest unlocks at a time, on a real-time timer. Opening gives coins
     and copies of cards you have found; how much grows with the account level. Each arena allows higher
     tiers (CHEST_RULES; switched off for now, so every tier can drop anywhere).
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
    { id: 'briar', number: 2, name: 'Briar Hollow', min: 300, theme: 'briar', cards: ['spears', 'pots', 'footmen', 'flail'],
      blurb: 'An overgrown forest of ancient stone ruins, giant tree roots, thorny vines and glowing lanterns.' },
    { id: 'sunstone', number: 3, name: 'Sunstone Arena', min: 600, theme: 'sunstone', cards: ['sandstorm', 'ramcart', 'mole', 'camel'],
      blurb: 'A sun-baked desert fortress of sandstone walls and an oasis channel. Evolutions and the Diamond Pass open here.' },
    { id: 'stormspire', number: 4, name: 'Stormspire', min: 900, theme: 'stormspire', cards: ['bees', 'owl', 'thundercloud', 'griffin'],
      blurb: 'A fortress on a mountain peak above the clouds, crackling with storms. Online battles are coming here.' },
    { id: 'arena5', number: 5, name: 'Arena 5', min: 1200, soon: true, blurb: 'Coming in a later update.' },
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
    { at: 300, kind: 'arena', arena: 'briar' },
    { at: 330, kind: 'card', card: 'spears', copies: 6 },
    { at: 370, kind: 'coins', amount: 300 },
    { at: 400, kind: 'card', card: 'pots', copies: 6 },
    { at: 440, kind: 'chest', chest: 'gold' },
    { at: 480, kind: 'card', card: 'footmen', copies: 6 },
    { at: 520, kind: 'coins', amount: 400 },
    { at: 560, kind: 'card', card: 'flail', copies: 3 },
    { at: 600, kind: 'arena', arena: 'sunstone' },
    { at: 630, kind: 'card', card: 'sandstorm', copies: 6 },
    { at: 670, kind: 'coins', amount: 500 },
    { at: 710, kind: 'card', card: 'ramcart', copies: 3 },
    { at: 750, kind: 'chest', chest: 'gold' },
    { at: 790, kind: 'card', card: 'mole', copies: 3 },
    { at: 830, kind: 'coins', amount: 600 },
    { at: 870, kind: 'card', card: 'camel', copies: 1 },
    { at: 900, kind: 'arena', arena: 'stormspire' },
    { at: 930, kind: 'card', card: 'bees', copies: 6 },
    { at: 970, kind: 'coins', amount: 700 },
    { at: 1010, kind: 'card', card: 'owl', copies: 3 },
    { at: 1050, kind: 'chest', chest: 'platinum' },
    { at: 1090, kind: 'card', card: 'thundercloud', copies: 1 },
    { at: 1130, kind: 'coins', amount: 800 },
    { at: 1170, kind: 'card', card: 'griffin', copies: 1 },
    { at: 1200, kind: 'arena', arena: 'arena5' },
  ];
  const CHESTS = {
    wooden: { name: 'Wooden Chest', seconds: 60, coins: [18, 26], cards: 6, kinds: 2 },
    silver: { name: 'Silver Chest', seconds: 15 * 60, coins: [60, 85], cards: 18, kinds: 3 },
    gold: { name: 'Gold Chest', seconds: 60 * 60, coins: [190, 250], cards: 45, kinds: 4 },
    platinum: { name: 'Platinum Chest', seconds: 3 * 3600, coins: [450, 600], cards: 100, kinds: 5 },
    legendary: { name: 'Legendary Chest', seconds: 8 * 3600, coins: [1100, 1400], cards: 220, kinds: 6 },
    mythic: { name: 'Mythic Chest', seconds: 12 * 3600, coins: [2600, 3200], cards: 450, kinds: 8 },
  };
  // Chest tiers, lowest first.
  const TIERS = ['wooden', 'silver', 'gold', 'platinum', 'legendary', 'mythic'];
  // Which chests each arena can give: a tier starts at the arena number listed (so Arena 1 gives only
  // wooden and silver, Arena 2 adds gold, and so on). Anything above the player's arena is given as the
  // highest tier they have reached instead. allUnlocked turns the gate off: every tier everywhere.
  // TEMPORARY: allUnlocked is on until more arenas exist; set it to false to switch the gate on.
  const CHEST_RULES = { allUnlocked: true, arena: { wooden: 1, silver: 1, gold: 2, platinum: 3, legendary: 4, mythic: 5 } };
  // The order chests are won in, repeating (before the arena gate is applied).
  const CYCLE = ['wooden', 'wooden', 'silver', 'wooden', 'silver', 'wooden', 'wooden', 'gold', 'wooden', 'silver',
    'wooden', 'silver', 'gold', 'wooden', 'platinum', 'silver', 'wooden', 'gold', 'silver', 'wooden', 'legendary', 'silver', 'gold', 'mythic'];
  // Copies and coins to go from level L to L+1 (index 0 is level 1 to 2).
  const UPGRADE = {
    copies: {
      common: [2, 4, 10, 20, 40, 80, 150, 250, 400, 600, 800, 1000, 1500, 2000],
      rare: [1, 2, 4, 8, 15, 30, 50, 80, 120, 160, 200, 250, 300, 400],
      epic: [1, 2, 4, 6, 10, 20, 30, 50, 70, 100, 130, 160, 200, 250],
      legendary: [1, 2, 3, 4, 6, 10, 15, 20, 25, 30, 40, 50, 60, 80],
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
    mode: null, trophies: 0, best: 0, coins: 0, diamonds: 0, shop: null, freeChestDay: null, magic: {}, cards: {}, evos: [], pass: null, member: false, king: 1, emotes: [], found: KC_STARTER_DECK.slice(), deck: KC_STARTER_DECK.slice(),
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
    P.magic = Object.assign({}, P.magic);
    P.evos = Array.isArray(P.evos) ? P.evos.filter(id => KC_EVOS[id]) : [];
    P.king = Math.max(1, Math.min(MAX_LEVEL, P.king | 0 || 1));
    P.emotes = Array.isArray(P.emotes) ? P.emotes.filter(id => EMOTES.some(e => e.id === id)) : [];
    P.pass = Object.assign({ season: 1, points: 0, premium: false, free: {}, paid: {} }, P.pass);
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
      const type = capChest(m.chest), c = roll(type);
      apply(c);
      out = Object.assign({ kind: 'chest', chest: type }, c);
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
    // Briar Hollow cards, as they unlock on the road
    if (t >= 330) swap('spears', 0.5);
    if (t >= 400) swap('pots', 0.5);
    if (t >= 480) swap('footmen', 0.5);
    if (t >= 560) swap('flail', 0.5);
    // Sunstone Arena cards
    if (t >= 630) swap('sandstorm', 0.5);
    if (t >= 710) swap('ramcart', 0.5);
    if (t >= 790) swap('mole', 0.5);
    if (t >= 870) swap('camel', 0.45);
    // Stormspire cards
    if (t >= 930) swap('bees', 0.5);
    if (t >= 1010) swap('owl', 0.5);
    if (t >= 1090) swap('thundercloud', 0.45);
    if (t >= 1170) swap('griffin', 0.4);
    const name = FOE_NAMES[Math.floor(rand() * FOE_NAMES.length)];
    const foeTrophies = Math.max(0, t + Math.round((rand() - 0.5) * 30));
    const cardLevels = spreadLevels(foeUpgrades(foeTrophies), deck, rand);
    const lvl = Math.min(...Object.values(cardLevels));
    // their King Tower level: the average level of their cards
    const kingLevel = Math.max(1, Math.min(MAX_LEVEL, Math.round(Object.values(cardLevels).reduce((a, v) => a + v, 0) / deck.length)));
    return {
      id: 'trophy', kind: 'trophy', name, short: name, level: lvl, tier: `${foeTrophies} trophies`,
      look: foeLook(rand), lines: null, skill, towerDamage: lerp(0.5, 1, d), deck, cardLevels, trophies: foeTrophies, kingLevel,
      // past 700 trophies about half the opponents with a Snowman have its evolution
      evos: foeTrophies >= 700 && deck.includes('snowman') && rand() < 0.5 ? ['snowman'] : [],
    };
  }
  function recordTrophy(winner, crowns) {
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
        const type = capChest(CYCLE[P.cycle % CYCLE.length]);
        P.cycle++;
        P.chests[slot] = { type, state: 'locked', contents: roll(type) };
        chest = { type, slot, name: CHESTS[type].name };
      }
    }
    const xp = winner === 0 ? XP.win : winner === 1 ? XP.loss : XP.draw, levelUp = addXp(xp);
    const newArena = arena().id !== beforeArena ? arena() : null;
    const pass = passAdd(crowns || 0);
    save();
    return { kind: 'trophy', delta: P.trophies - before, trophies: P.trophies, chest, slotsFull, xp, levelUp, newArena, newRewards: claimable().length, pass };
  }

  /* ---------- chests ---------- */
  // The cards a chest can give: every card you have found, and every card of the arenas you have
  // reached (even before its Trophy Road reward), so a chest can be the first place you find one.
  function chestPool() {
    const open = roadOpen() ? ARENAS.filter(a => !a.soon && a.min <= P.trophies).flatMap(a => a.cards || []) : [];
    return KC_ALL_CARDS.filter(id => KC_CARDS[id] && (P.found.includes(id) || open.includes(id)));
  }
  const LEGENDARY_IN = { wooden: 0.03, silver: 0.06, gold: 0.15, platinum: 0.3, legendary: 1, mythic: 1 };
  // Chest contents grow with the account level (not trophies): 15% more coins and cards per level.
  const chestMult = (lv = level()) => 1 + 0.15 * (Math.max(1, lv) - 1);
  function chestOdds(type, lv) {
    const C = CHESTS[type], m = chestMult(lv);
    return { cards: Math.round(C.cards * m), coins: [Math.round(C.coins[0] * m), Math.round(C.coins[1] * m)], kinds: C.kinds };
  }
  const chestAllowed = (type, n = arena().number) => CHEST_RULES.allUnlocked || (CHEST_RULES.arena[type] || 99) <= n;
  // The tier actually given: the asked-for tier, or the highest one below it the arena allows.
  function capChest(type, n) {
    let i = Math.max(0, TIERS.indexOf(type));
    while (i > 0 && !chestAllowed(TIERS[i], n)) i--;
    return TIERS[i];
  }
  function roll(type, rand = Math.random) {
    // a legendary card only turns up now and then, more often in the bigger chests
    const C = chestOdds(type), pool = chestPool().filter(id => KC_CARDS[id].rarity !== 'legendary' || rand() < (LEGENDARY_IN[type] || 0));
    const coins = Math.round(lerp(C.coins[0], C.coins[1], rand()));
    const kinds = Math.min(C.kinds, pool.length), picks = [];
    const bag = pool.slice();
    for (let i = 0; i < kinds; i++) picks.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
    // rares come in smaller stacks
    const weight = id => ({ rare: 0.35, epic: 0.15, legendary: 0.04 }[KC_CARDS[id].rarity] || 1);
    const total = picks.reduce((a, id) => a + weight(id), 0);
    let left = C.cards;
    const cards = picks.map((id, i) => {
      const n = i === picks.length - 1 ? left : Math.max(1, Math.round(C.cards * weight(id) / total * (0.8 + rand() * 0.4)));
      left -= n;
      return { id, n: Math.max(1, n) };
    }).filter(c => c.n > 0);
    return { coins, cards, items: rollItems(type, rand) };
  }
  function apply(c) {
    P.coins += c.coins;
    // a card that came out before you reached it on the Trophy Road is found now
    if (c.cards.some(x => !P.found.includes(x.id))) P.found = KC_ALL_CARDS.filter(id => P.found.includes(id) || c.cards.some(x => x.id === id));
    for (const { id, n } of c.cards) P.cards[id].count += n;
    for (const { id, n } of c.items || []) P.magic[id] = magicCount(id) + n;
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
  // Chests are sold for coins only, one of each a day, with their contents shown before you buy.
  const SHOP = { perCopy: { common: 10, rare: 50, epic: 400, legendary: 4000 }, coinsPerDiamond: 5000, maxQty: 250, chests: { wooden: 80, silver: 280, gold: 800, platinum: 1800, legendary: 4200, mythic: 9500 } };
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
  // Shop chests cost coins only, as many as you like. What is inside is rolled at purchase and stays
  // hidden until the chest is opened (the tile shows the card count and coin range). The price grows with
  // the account level like the contents, so the coins inside are always less than the price.
  const chestPrice = (type, lv) => Math.round(SHOP.chests[type] * chestMult(lv) / 5) * 5;
  function buyChest(type, rand) {
    if (!CHESTS[type] || !SHOP.chests[type]) return { error: 'none' };
    if (!chestAllowed(type)) return { error: 'locked' };
    const price = chestPrice(type);
    if (P.coins < price) return { error: 'coins' };
    P.coins -= price;
    const c = roll(type, rand), before = P.found.slice();
    apply(c);
    save();
    return { ok: true, chest: type, price, coins: c.coins, cards: c.cards.map(x => Object.assign({ isNew: !before.includes(x.id) }, x)), items: c.items };
  }
  // One free Wooden Chest a day (local days, like the offers).
  const freeChestReady = (now = Date.now()) => P.freeChestDay !== dayKey(now);
  function claimFreeChest(now = Date.now(), rand) {
    if (!freeChestReady(now)) return { error: 'claimed' };
    P.freeChestDay = dayKey(now);
    const c = roll('wooden', rand), before = P.found.slice();
    apply(c);
    save();
    return { ok: true, chest: 'wooden', coins: c.coins, cards: c.cards.map(x => Object.assign({ isNew: !before.includes(x.id) }, x)), items: c.items };
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
  /* ---------- emotes in the Shop ----------
     Fifteen emotes to buy, three of them on sale each day (the same three all day, a new set at
     midnight; ones you own are skipped). Each costs coins and is yours for good: bought emotes join
     the eight everyone has in the battle emote panel. The art is in js/emotes.js. */
  const EMOTES = [
    { id: 'love', name: 'Love Struck' }, { id: 'cool', name: 'Too Cool' }, { id: 'party', name: 'Party Time' },
    { id: 'dizzy', name: 'Dizzy' }, { id: 'nervous', name: 'Nervous' }, { id: 'facepalm', name: 'Facepalm' },
    { id: 'kiss', name: 'Blow a Kiss' }, { id: 'wave', name: 'Hello!' }, { id: 'clap', name: 'Applause' },
    { id: 'shush', name: 'Shh!' }, { id: 'popcorn', name: 'Popcorn' }, { id: 'trophy', name: 'Champion' },
    { id: 'mindblown', name: 'Mind Blown' }, { id: 'smug', name: 'Smug' }, { id: 'salute', name: 'Salute' },
    // and one for every card: the card's character with its name
  ].concat(KC_ALL_CARDS.map(id => ({ id: 'card_' + id, name: KC_CARDS[id].name, card: id })));
  // each emote costs 5,000 coins or 1 diamond (the same at the exchange rate)
  const EMOTE_SHOP = { perDay: 3, coins: 5000, diamonds: 1 };
  // Today's three: a shuffle seeded by the date, skipping emotes you own.
  function emoteOffers(now = Date.now()) {
    const day = dayKey(now), seed = [...day].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const r = KCSim.mulberry(seed), order = EMOTES.map(e => e.id);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // the day's three are kept, so one you buy stays on show (as owned) until the next set
    if (!P.emoteShop || P.emoteShop.day !== day) {
      const open = order.filter(id => !P.emotes.includes(id));
      P.emoteShop = { day, ids: (open.length >= EMOTE_SHOP.perDay ? open : order).slice(0, EMOTE_SHOP.perDay) };
    }
    return P.emoteShop.ids.filter(id => EMOTES.some(e => e.id === id))
      .map(id => { const e = EMOTES.find(x => x.id === id); return { id, name: e.name, card: e.card || null, coins: EMOTE_SHOP.coins, diamonds: EMOTE_SHOP.diamonds, owned: P.emotes.includes(id) }; });
  }
  // currency: 'coins' (5,000) or 'diamonds' (1)
  function buyEmote(id, currency = 'coins', now = Date.now()) {
    const o = emoteOffers(now).find(x => x.id === id);
    if (!o) return { error: 'none' };
    if (o.owned) return { error: 'owned' };
    const wallet = currency === 'diamonds' ? 'diamonds' : 'coins', price = o[wallet];
    if (P[wallet] < price) return { error: wallet };
    P[wallet] -= price;
    P.emotes.push(id);
    save();
    return { ok: true, id, price, currency: wallet };
  }

  // TEMPORARY: the test button's 1,000,000 coins and diamonds.
  function grantTest() { P.coins = 1000000; P.diamonds = 1000000; save(); }


  /* ---------- magic items ----------
     Wild cards count as copies of any card of their rarity. A book fills every copy a card still needs
     for its next level (the Book of Books works on any rarity). The Hammer of Books upgrades a card one
     level for free: it fills any missing copies and pays the coins. Evolution shards have a place but nothing
     gives them yet. Wild cards come from chests from Arena 2 on; books and the hammer are rare finds in
     silver chests and up (0.1% in silver to 1% in mythic, never in wooden). */
  const MAGIC = {
    wild_common: { name: 'Common Wild Card', kind: 'wild', rarity: 'common', blurb: 'Counts as a copy of any common card. Use it on a common card to add copies toward its next level.' },
    wild_rare: { name: 'Rare Wild Card', kind: 'wild', rarity: 'rare', blurb: 'Counts as a copy of any rare card.' },
    wild_epic: { name: 'Epic Wild Card', kind: 'wild', rarity: 'epic', blurb: 'Counts as a copy of any epic card.' },
    wild_legendary: { name: 'Legendary Wild Card', kind: 'wild', rarity: 'legendary', blurb: 'Counts as a copy of any legendary card.' },
    book_common: { name: 'Book of Common', kind: 'book', rarity: 'common', blurb: 'Use on a common card to fill all the copies it still needs for its next level.' },
    book_rare: { name: 'Book of Rare', kind: 'book', rarity: 'rare', blurb: 'Use on a rare card to fill all the copies it still needs for its next level.' },
    book_epic: { name: 'Book of Epic', kind: 'book', rarity: 'epic', blurb: 'Use on an epic card to fill all the copies it still needs for its next level.' },
    book_legendary: { name: 'Book of Legendary', kind: 'book', rarity: 'legendary', blurb: 'Use on a legendary card to fill all the copies it still needs for its next level.' },
    book_books: { name: 'Book of Books', kind: 'book', rarity: 'any', blurb: 'Works on a card of any rarity: fills all the copies it still needs for its next level.' },
    hammer_books: { name: 'Hammer of Books', kind: 'hammer', rarity: 'any', blurb: 'Upgrades a card one level for free: it fills any copies the card is missing and needs no coins.' },
    shards: { name: 'Evolution Shards', kind: 'shard', rarity: 'any', blurb: 'Collect 6 and use them on a card that has an evolution to unlock it. Evolutions open in Sunstone Arena (Arena 3); the Snowman\'s is the first.' },
  };
  const MAGIC_ORDER = ['wild_common', 'wild_rare', 'wild_epic', 'wild_legendary', 'book_common', 'book_rare', 'book_epic', 'book_legendary', 'book_books', 'hammer_books', 'shards'];
  const MAGIC_RULES = {
    wildFromArena: 2,
    // wild cards per chest at account level 1: [min, max] copies, or a chance of one
    wild: {
      wooden: {},
      silver: { common: [2, 4], rare: 0.3 },
      gold: { common: [4, 7], rare: [1, 2], epic: 0.05 },
      platinum: { common: [8, 12], rare: [2, 4], epic: 0.2, legendary: 0.01 },
      legendary: { common: [15, 22], rare: [4, 7], epic: [1, 1], legendary: 0.04 },
      mythic: { common: [30, 40], rare: [8, 12], epic: [2, 3], legendary: 0.1 },
    },
    // the chance of a book or the hammer in a chest, and how often each one is the find
    chance: { wooden: 0, silver: 0.001, gold: 0.002, platinum: 0.004, legendary: 0.007, mythic: 0.01 },
    weights: { book_common: 34, book_rare: 26, book_epic: 14, book_legendary: 8, book_books: 6, hammer_books: 12 },
  };
  const wildActive = () => arena().number >= MAGIC_RULES.wildFromArena;
  function rollItems(type, rand) {
    const items = [];
    if (wildActive()) {
      const W = MAGIC_RULES.wild[type] || {}, m = chestMult();
      for (const r of ['common', 'rare', 'epic', 'legendary']) {
        const w = W[r];
        if (w === undefined) continue;
        const n = Array.isArray(w) ? Math.round((w[0] + rand() * (w[1] - w[0])) * m) : rand() < w ? 1 : 0;
        if (n > 0) items.push({ id: 'wild_' + r, n });
      }
    }
    if (rand() < (MAGIC_RULES.chance[type] || 0)) {
      const ws = Object.entries(MAGIC_RULES.weights), total = ws.reduce((a, [, w]) => a + w, 0);
      let x = rand() * total;
      for (const [id, w] of ws) { x -= w; if (x <= 0) { items.push({ id, n: 1 }); break; } }
    }
    return items;
  }
  const magicCount = id => (P.magic && P.magic[id]) || 0;
  // Can this item be used on this card, and what would it do?
  function magicFor(item, id) {
    const M = MAGIC[item], card = KC_CARDS[id];
    if (!M || !card || M.soon) return { ok: false, reason: 'none' };
    if (!magicCount(item)) return { ok: false, reason: 'none-held' };
    if (!P.found.includes(id)) return { ok: false, reason: 'not-found' };
    if (M.kind === 'shard') {
      const E = KC_EVOS[id];
      if (!E) return { ok: false, reason: 'no-evo' };
      if (hasEvo(id)) return { ok: false, reason: 'evo-owned' };
      if (!evoOpen()) return { ok: false, reason: 'evo-locked' };
      if (magicCount(item) < E.shards) return { ok: false, reason: 'shards', missing: E.shards - magicCount(item) };
      return { ok: true, evo: true, uses: E.shards };
    }
    if (M.rarity !== 'any' && M.rarity !== card.rarity) return { ok: false, reason: 'rarity' };
    const c = P.cards[id];
    if (c.level >= MAX_LEVEL) return { ok: false, reason: 'max' };
    const need = UPGRADE.copies[card.rarity][c.level - 1], missing = need - c.count;
    // the hammer fills whatever copies are missing and pays the coins: one level up, whatever the card has
    if (M.kind === 'hammer') return { ok: true, level: c.level + 1, fills: Math.max(0, missing) };
    if (missing <= 0) return { ok: false, reason: 'full' };
    return { ok: true, gives: M.kind === 'wild' ? Math.min(magicCount(item), missing) : missing, uses: M.kind === 'wild' ? Math.min(magicCount(item), missing) : 1 };
  }
  function useMagic(item, id) {
    const r = magicFor(item, id);
    if (!r.ok) return r;
    const M = MAGIC[item], c = P.cards[id];
    if (M.kind === 'shard') {
      P.magic[item] -= r.uses;
      P.evos.push(id);
      save();
      return { ok: true, item, card: id, evo: true };
    }
    if (M.kind === 'hammer') {
      // the copies it has go toward the level; whatever is missing the hammer fills
      c.count = Math.max(0, c.count - UPGRADE.copies[KC_CARDS[id].rarity][c.level - 1]);
      c.level++;
      P.magic[item]--;
      const levelUp = addXp(4 * c.level);
      save();
      return { ok: true, item, card: id, level: c.level, levelUp };
    }
    c.count += r.gives;
    P.magic[item] -= r.uses;
    save();
    return { ok: true, item, card: id, gives: r.gives };
  }
  // TEMPORARY: the test button fills the Magic Items tab.
  function grantMagic() {
    const add = { wild_common: 300, wild_rare: 60, wild_epic: 10, wild_legendary: 2, book_common: 3, book_rare: 3, book_epic: 1, book_legendary: 1, book_books: 2, hammer_books: 3 };
    for (const [k, v] of Object.entries(add)) P.magic[k] = magicCount(k) + v;
    save();
  }

  /* ---------- the King Tower ----------
     Its level (1 to 15) sets the health and damage of all three of your towers in battle (8% a level,
     like card levels). To take it to level L you need L cards at level L or higher: 2 cards at level
     2 for level 2, 3 at level 3 for level 3, and so on up to 15 cards at level 15. Upgrading is free
     once you meet that. */
  function kingInfo() {
    const level = P.king, max = level >= MAX_LEVEL, next = level + 1;
    const have = max ? 0 : P.found.filter(id => P.cards[id].level >= next).length;
    return { level, max, next, need: max ? 0 : next, have, can: !max && have >= next };
  }
  function upgradeKing() {
    const k = kingInfo();
    if (!k.can) return null;
    P.king++;
    const levelUp = addXp(10 * P.king);
    save();
    return { level: P.king, xp: 10 * P.king, levelUp };
  }

  /* ---------- evolutions ----------
     An evolution is unlocked once with Evolution Shards (6 for the Snowman) or from the Diamond Pass,
     and then works in every battle: every cycle-th play of the card is the evolved one (js/sim.js).
     Evolutions open when you first reach Sunstone Arena (Arena 3). */
  const EVO_ARENA = 600;
  const evoOpen = () => P.best >= EVO_ARENA;
  const hasEvo = id => P.evos.includes(id);
  const evoList = () => P.evos.filter(id => KC_EVOS[id] && P.found.includes(id));
  function evoInfo(id) {
    const E = KC_EVOS[id];
    if (!E) return null;
    return { has: hasEvo(id), open: evoOpen(), shards: magicCount('shards'), need: E.shards, name: E.name, blurb: E.blurb, can: !hasEvo(id) && evoOpen() && magicCount('shards') >= E.shards };
  }

  /* ---------- the Diamond Pass ----------
     A season pass, open from Sunstone Arena (Arena 3). Every crown you win in a trophy battle is a pass
     point; each tier takes crownsPerTier of them. Every tier has a free reward, and a Diamond Pass
     reward for players who bought this season's pass in the Shop (members get it as part of their
     membership). The free path gives 2 Evolution Shards in all; the Diamond Pass gives the Snowman
     Evolution at tier 1. Rewards are fixed and shown in full before buying. */
  const PASS = {
    name: 'Diamond Pass', season: 1, price: 10, crownsPerTier: 8,
    tiers: [
      { free: { kind: 'coins', n: 300 }, paid: { kind: 'evo', card: 'snowman' } },
      { free: { kind: 'item', item: 'wild_common', n: 20 }, paid: { kind: 'chest', chest: 'gold' } },
      { free: { kind: 'chest', chest: 'gold' }, paid: { kind: 'coins', n: 1000 } },
      { free: { kind: 'coins', n: 400 }, paid: { kind: 'item', item: 'wild_rare', n: 6 } },
      { free: { kind: 'item', item: 'shards', n: 1 }, paid: { kind: 'chest', chest: 'gold' } },
      { free: { kind: 'item', item: 'wild_rare', n: 3 }, paid: { kind: 'item', item: 'book_common', n: 1 } },
      { free: { kind: 'coins', n: 500 }, paid: { kind: 'coins', n: 1500 } },
      { free: { kind: 'chest', chest: 'gold' }, paid: { kind: 'item', item: 'shards', n: 2 } },
      { free: { kind: 'item', item: 'wild_common', n: 30 }, paid: { kind: 'chest', chest: 'platinum' } },
      { free: { kind: 'item', item: 'shards', n: 1 }, paid: { kind: 'item', item: 'wild_epic', n: 1 } },
      { free: { kind: 'coins', n: 600 }, paid: { kind: 'chest', chest: 'gold' } },
      { free: { kind: 'chest', chest: 'gold' }, paid: { kind: 'coins', n: 2000 } },
      { free: { kind: 'item', item: 'wild_rare', n: 5 }, paid: { kind: 'item', item: 'shards', n: 2 } },
      { free: { kind: 'coins', n: 800 }, paid: { kind: 'item', item: 'book_rare', n: 1 } },
      { free: { kind: 'chest', chest: 'gold' }, paid: { kind: 'chest', chest: 'legendary' } },
    ],
  };
  const passOpen = () => P.best >= EVO_ARENA;
  // Online battles open when you first reach Stormspire (Arena 4).
  const ONLINE_AT = 900;
  const onlineOpen = () => P.best >= ONLINE_AT;
  const passPremium = () => !!(P.pass.premium || P.member);
  const passMax = () => PASS.tiers.length * PASS.crownsPerTier;
  // tiers reached (0 to the number of tiers), and the points toward the next one
  const passTier = () => Math.min(PASS.tiers.length, Math.floor(P.pass.points / PASS.crownsPerTier));
  const passInto = () => (passTier() >= PASS.tiers.length ? PASS.crownsPerTier : P.pass.points % PASS.crownsPerTier);
  function passAdd(crowns) {
    if (!passOpen() || crowns <= 0) return null;
    const before = passTier();
    P.pass.points = Math.min(passMax(), P.pass.points + crowns);
    return { points: crowns, tierUp: passTier() > before ? passTier() : 0 };
  }
  // 'claimed' | 'ready' | 'locked' (tier not reached) | 'premium' (reached, but needs the Diamond Pass)
  function passState(i, track) {
    if (P.pass[track][i]) return 'claimed';
    if (!passOpen() || i >= passTier()) return 'locked';
    if (track === 'paid' && !passPremium()) return 'premium';
    return 'ready';
  }
  const passClaimable = () => PASS.tiers.reduce((n, _, i) => n + (passState(i, 'free') === 'ready') + (passState(i, 'paid') === 'ready'), 0);
  // Claim a tier's reward. Returns what it gave, in the same shape as a chest (coins, cards, items).
  function claimPass(i, track) {
    if (passState(i, track) !== 'ready') return null;
    const R = PASS.tiers[i][track];
    P.pass[track][i] = true;
    let out = { reward: R, coins: 0, cards: [], items: [] };
    if (R.kind === 'coins') { P.coins += R.n; out.coins = R.n; }
    else if (R.kind === 'item') { P.magic[R.item] = magicCount(R.item) + R.n; out.items = [{ id: R.item, n: R.n }]; }
    else if (R.kind === 'chest') {
      const before = P.found.slice(), c = roll(R.chest);
      apply(c);
      out = Object.assign(out, c, { chest: R.chest, cards: c.cards.map(x => Object.assign({ isNew: !before.includes(x.id) }, x)) });
    } else if (R.kind === 'evo') {
      // an evolution you already have comes as its shards instead
      if (hasEvo(R.card)) { const n = KC_EVOS[R.card].shards; P.magic.shards = magicCount('shards') + n; out.items = [{ id: 'shards', n }]; }
      else { P.evos.push(R.card); out.evo = R.card; }
    }
    save();
    return out;
  }
  function buyPass() {
    if (!passOpen()) return { error: 'locked' };
    if (passPremium()) return { error: 'owned' };
    if (P.diamonds < PASS.price) return { error: 'diamonds' };
    P.diamonds -= PASS.price;
    P.pass.premium = true;
    save();
    return { ok: true, price: PASS.price };
  }

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
    MAX_LEVEL, XP_PER_LEVEL, TROPHIES, ARENAS, ROAD, CHESTS, CYCLE, UPGRADE, TIERS, CHEST_RULES,
    chestAllowed, capChest, chestOdds, chestPrice, freeChestReady, claimFreeChest,
    load, save, get state() { return P; },
    level, unlocked, nextTrainer, roadOpen, beatenCount, trainer, mode, setMode, recordTrainer,
    arena, nextArena, roadState, claimable, claim,
    trophyFoe, foeUpgrades, spreadLevels, recordTrophy,
    roll, chestState, unlockingSlot, startUnlock, openChest,
    SHOP, shop, shopEnds, refreshShop, buy, buyChest, grantTest,
    upgradeInfo, upgradable, upgrade, cardLevels, trainingDeck, setDeck, unlockAt,
    MAGIC, MAGIC_ORDER, MAGIC_RULES, wildActive, magicCount, magicFor, useMagic, grantMagic,
    EVO_ARENA, evoOpen, hasEvo, evoList, evoInfo,
    kingInfo, upgradeKing, ONLINE_AT, onlineOpen, EMOTES, EMOTE_SHOP, emoteOffers, buyEmote, chestPool,
    PASS, passOpen, passPremium, passTier, passInto, passMax, passState, passClaimable, claimPass, buyPass,
  };
})();
