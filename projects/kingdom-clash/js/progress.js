/* Kingdom Clash: the player's progress and the rules for it, with no screen code (so it can be
   tested in Node: tools/progress-test.js).

   - The Training Grounds: beat Trainer Owen, Romeo and Luc in order to open the Trophy Road.
   - The Trophy Road: trophy battles against bots matched to your trophies. A win is +30 trophies
     and earns a chest if a slot is free; a loss is -20 (never below the arena's floor). Milestones on
     the road give fixed rewards you claim: rubies, chests, new cards and arenas.
   - Opponents: their cards level up one at a time with their trophies (all level 1 below 50, then one
     card up a level every 12.5 trophies); their skill follows your recent results (up a step
     after a win, down a step after a loss), settling at about 52% wins for everyone.
   - Chests: six tiers (wooden, silver, gold, platinum, legendary, mythic) and four slots. A chest is
     rolled the moment you win it; one chest unlocks at a time, on a real-time timer. Opening gives rubies
     and copies of cards you have found; how much grows with the account level. Each arena allows higher
     tiers (CHEST_RULES; switched off for now, so every tier can drop anywhere).
   - Card levels: copies plus rubies upgrade a card, up to level 15.
   - Arena cards (Skeleton Pack, Cannon) are found on the Trophy Road in Arena 1 only. Trainers never
     use them, and in a Training Grounds match your deck goes back to the starter cards.

   - The Shop: five offers a day built from the cards you have found and their levels, for rubies
     or diamonds (1 diamond = 5,000 rubies). Each offer lists exactly what it gives.

   Rubies and diamonds are kept on this device for now. When the SirSC wallet is connected they move
   to it, and prices and purchases must then be decided by the server.
   Everything is saved in localStorage under kc.progress; older saves are upgraded in place. */
'use strict';

const KCProgress = (() => {
  const KEY = 'kc.progress';
  const MAX_LEVEL = 15;
  const XP_PER_LEVEL = 100;
  const XP = { win: 20, draw: 10, loss: 6, firstWin: 30 };
  const TROPHIES = { win: 30, loss: 20 };

  /* ---------- the economy: every number that sets costs and rewards ----------
     Currency: Rubies (P.rubies) are the game's own and never leave it; "gold" below means Rubies. Wallet
     Coins (P.wallet, the SirSC currency) only come in, through the capped exchange. Copies are what limit
     progress, since a big wallet can pay Rubies but can't make copies, so rewards start small and grow
     steeply past Arena 4 (beyond), aiming at cards of about 7-8 entering Arena 4.
     Upgrades: the same gold for every rarity at each level; copies by rarity. A card starts at its
     rarity's level (KC_RARITY_START): 1 Common, 3 Rare, 6 Epic, 9 Legendary; the first copy finds it
     and is not counted. To level 15: 15,586 / 3,386 / 416 / 47 copies and 257,625 / 257,600 / 257,000
     / 250,000 gold.
     Rewards scale by two things the game already tracks:
       - trophies, the main one: the arena you are in (you can't fall below its floor) sets a tier,
         climbing through the arena adds up to `withinArena` more, and past the last arena every
         `beyond.every` trophies adds `beyond.add` (up to `beyond.max`);
       - account level, on top: +`levelStep` a level up to `levelCap`.
     Gold and cards have their own arena tiers, so gold grows a little faster than cards, as each copy
     costs more gold at higher levels. Epic and Legendary amounts grow more slowly than the multiplier
     (`epicPow`, `legendaryPow`), so the best drops stay uncommon. Change these numbers to rebalance;
     tools/economy-report.js prints what each player profile earns. */
  const ECONOMY = {
    upgradeGold: [5, 20, 50, 150, 400, 1000, 2000, 4000, 10000, 15000, 25000, 40000, 60000, 100000],
    upgradeCopies: {
      common: [2, 4, 10, 20, 50, 100, 200, 400, 800, 1000, 1500, 2500, 3500, 5500],
      rare: [null, null, 2, 4, 10, 20, 50, 100, 200, 300, 400, 550, 750, 1000],
      epic: [null, null, null, null, null, 2, 4, 10, 20, 30, 50, 70, 100, 130],
      legendary: [null, null, null, null, null, null, null, null, 2, 4, 6, 9, 12, 14],
    },
    arenaGold: { 1: 0.26, 2: 0.33, 3: 0.42, 4: 0.53, 5: 1.33, 6: 1.86, 7: 2.65, 8: 3.18, 9: 3.95, 10: 4.8 },
    arenaCards: { 1: 0.3, 2: 0.37, 3: 0.45, 4: 0.55, 5: 1.375, 6: 1.925, 7: 2.75, 8: 3.3, 9: 4.1, 10: 5.0 },
    // inside an arena rewards climb toward the next arena's, stopping `arenaJump` short of it, so reaching
    // the next arena is always a clear step up (at least `withinArena` of climbing in a short arena)
    arenaJump: 1.2,
    nextArenaGrowth: 1.35, // for arenas past the table
    withinArena: 0.04,
    beyond: { every: 500, add: 0.05, max: 0.3 },
    levelStep: 0.015, levelCap: 40,
    epicPow: 0.5, legendaryPow: 0.25,
    // each chest at tier 1, level 1: gold range, total cards, and the rarer cards among them
    // (rare: a share of the cards with a floor, plus a chance of one more; epic and legendary: a floor
    // plus a chance of one more). A floor with no eligible card of that rarity is paid in the rarity below.
    chests: {
      wooden: { gold: [15, 25], cards: 6, kinds: 2, rare: { share: 0, min: 0, chance: 0.12 } },
      silver: { gold: [40, 60], cards: 16, kinds: 3, rare: { share: 0.08, min: 1 }, epic: { chance: 0.01 } },
      gold: { gold: [120, 170], cards: 40, kinds: 4, rare: { share: 0.11, min: 3 }, epic: { chance: 0.04 }, legendary: { chance: 0.003 } },
      platinum: { gold: [320, 420], cards: 90, kinds: 5, rare: { share: 0.13, min: 8 }, epic: { chance: 0.3 }, legendary: { chance: 0.02 } },
      legendary: { gold: [800, 1000], cards: 200, kinds: 6, rare: { share: 0.15, min: 20 }, epic: { min: 1, chance: 0.5 }, legendary: { chance: 0.08 } },
      mythic: { gold: [1800, 2300], cards: 420, kinds: 8, rare: { share: 0.16, min: 45 }, epic: { min: 2, chance: 0.5 }, legendary: { min: 1 } },
    },
    // what a missing rarity is paid in instead
    fallback: { legendary: ['epic', 3], epic: ['rare', 5] },
    // gold for each trophy-battle win (times the gold tier), for the first `dailyCap` wins of a day
    winGold: { base: 10, dailyCap: 20 },
    // the free daily chest: a wooden chest with this many times its usual contents
    freeChest: { type: 'wooden', bonus: 3 },
    // diamonds can skip a chest's timer: 1 diamond for every 5 minutes left (rounded up)
    skip: { secondsPerDiamond: 300 },
    // the Shop: rubies per copy, the most copies in one offer, and chest prices (times the chest's average gold)
    // the Shop, in Rubies: the value of a copy, the most copies in a daily card offer (no legendaries are
    // offered) and in the 1-diamond mega bundle. Chests: one of each a day, priced at `chestPriceScale` x
    // (their rubies plus `chestCardShare` of the value of the cards inside), from the arena in `chestArena`.
    shop: { perCopy: { common: 20, rare: 200, epic: 2000, legendary: 40000 }, maxQty: { common: 50, rare: 10, epic: 1, legendary: 0 },
      megaQty: { common: 100, rare: 20, epic: 2, legendary: 0 }, chestCardShare: 0.5, chestPriceScale: 2, chestsPerDay: 1,
      chestArena: { wooden: 1, silver: 1, gold: 2, platinum: 3, legendary: 4, mythic: 4 } },
    // the three diamond-only Shop sections, made fresh each day:
    //  - deals: two bundles of wild cards and rubies, always worth over twice their price. Contents and
    //    price grow together with the arena (`dealScale`: card tier / Arena 4's, between min and max); epic
    //    wild cards only once an epic card can drop.
    //  - magic: `magicPerDay` different magic items, each with its own price (rarer items cost more; the
    //    Hammer of Books the most); only items you can use are offered.
    //  - cards: the three best cards your arena can give (highest rarity first, maxed cards skipped), a
    //    pack of each: `cardPacks` copies for a price by rarity.
    //  Each item sells once a day.
    diamondShop: {
      deals: [
        { tag: 'Daily deal', price: 2, rubies: 4000, wild: { common: 300, rare: 20 } },
        { tag: 'Big deal', price: 6, rubies: 15000, wild: { common: 800, rare: 80, epic: 2 } },
      ],
      dealScale: { min: 0.5, max: 3 },
      magicPerDay: 4,
      magic: {
        wild_common: { qty: 40, price: 1, weight: 10 }, wild_rare: { qty: 8, price: 2, weight: 8 }, wild_epic: { qty: 1, price: 4, weight: 5 },
        wild_legendary: { qty: 1, price: 12, weight: 2 }, book_common: { qty: 1, price: 6, weight: 6 }, book_rare: { qty: 1, price: 9, weight: 5 },
        book_epic: { qty: 1, price: 13, weight: 3 }, book_legendary: { qty: 1, price: 17, weight: 2 }, book_books: { qty: 1, price: 21, weight: 1.5 },
        hammer_books: { qty: 1, price: 25, weight: 1 }, shards: { qty: 1, price: 6, weight: 3 },
      },
      cardPacks: { common: { qty: 150, price: 2 }, rare: { qty: 25, price: 3 }, epic: { qty: 3, price: 6 }, legendary: { qty: 1, price: 10 } },
      // what each counts as when the deals' value is shown, in diamonds (the mega bundle's and the ruby bundle's rates)
      worth: { common: 1 / 100, rare: 1 / 20, epic: 1 / 2, legendary: 8, ruby: 1 / 5000 },
    },
    // wallet Coins (SirSC) to Rubies, one way: `rate` rubies a coin, up to a daily cap set by the highest
    // arena reached; past the last arena the cap grows by `beyond.add` every `beyond.every` trophies.
    exchange: { rate: 1, cap: { 1: 500, 2: 1000, 3: 2000, 4: 4000, 5: 6000, 6: 7000, 7: 8000, 8: 9000, 9: 10000, 10: 10000 }, beyond: { every: 500, add: 0, max: 10000 } },
    // opponents' card levels by trophies (straight lines between the points), matched to what a player
    // has at those trophies (tools/economy-report.js); rares, epics and legendaries are then raised to
    // where their rarity starts
    foeLevels: [[0, 1], [50, 1], [300, 4.5], [600, 6.5], [900, 7.5], [1200, 8.5], [1500, 10], [2000, 12], [3000, 13.5], [4000, 14.5], [5000, 15]],
  };

  const ARENAS = [
    { id: 'cinder', number: 1, name: 'Cinder Keep', min: 0, theme: 'cinder', cards: ['skeletons', 'cannon', 'magmaquake', 'ashfall', 'magmaturret'],
      blurb: 'A ruined fortress of forges and ash, where old cannons still guard the walls.' },
    { id: 'briar', number: 2, name: 'Briar Hollow', min: 300, theme: 'briar', cards: ['spears', 'pots', 'footmen', 'flail', 'thornroller', 'briarbind', 'bramblenest'],
      blurb: 'An overgrown forest of ancient stone ruins, giant tree roots, thorny vines and glowing lanterns.' },
    { id: 'sunstone', number: 3, name: 'Sunstone Arena', min: 600, theme: 'sunstone', cards: ['sandstorm', 'ramcart', 'mole', 'camel', 'scarabshrine', 'dunemortar'],
      blurb: 'A sun-baked desert fortress of sandstone walls and an oasis channel. Evolutions and the Diamond Pass open here.' },
    { id: 'stormspire', number: 4, name: 'Stormspire', min: 900, theme: 'stormspire', cards: ['bees', 'owl', 'thundercloud', 'griffin', 'judgment', 'cyclone', 'conductor'],
      blurb: 'A fortress on a mountain peak above the clouds, crackling with storms. Online battles are coming here.' },
    { id: 'frostfang', number: 5, name: 'Frostfang Keep', min: 2000, theme: 'frostfang', cards: ['frostsprite', 'icegiant', 'wintersage', 'flashfreeze', 'glacierslam', 'cage'],
      blurb: 'A frozen mountain fortress of ice and snow. Its cards freeze, slow and hold the line.' },
    { id: 'blackwater', number: 6, name: 'Blackwater Harbor', min: 2600, theme: 'blackwater', cards: ['dockraiders', 'barrel', 'harpoon', 'broadside', 'powderkeg', 'barracks'],
      blurb: 'A pirate harbor of ships, docks and dark water, full of surprise attacks and siege guns.' },
    { id: 'gearforge', number: 7, name: 'Gearforge Citadel', min: 3300, theme: 'gearforge', cards: ['coil', 'sparkbots', 'titan', 'arccannon', 'overclock', 'foundry', 'smelter'],
      blurb: 'An industrial fortress of bronze machinery, turning gears and crackling electricity.' },
    { id: 'crystal', number: 8, name: 'Crystal Chasm', min: 4100, theme: 'crystal', cards: ['gemflash', 'shardguards', 'drill', 'prism', 'prismecho'],
      blurb: 'An underground cavern of glowing crystals and old mining machines.' },
    { id: 'skyward', number: 9, name: 'Skyward Sanctuary', min: 5000, theme: 'skyward', cards: ['sunsprite', 'guardian', 'drake', 'phoenix', 'heavensguard', 'reflection', 'ballista'],
      blurb: 'A kingdom of white marble and gold floating above the clouds, where healers and firebirds live.' },
    { id: 'eclipse', number: 10, name: 'Eclipse Throne', min: 6000, theme: 'eclipse', cards: ['wraiths', 'meteor', 'abyss', 'dreadknight', 'soulblight', 'collapse'],
      blurb: 'The obsidian fortress of a fallen king under an endless eclipse. Its cards are the most powerful of all.' },
  ];
  // Fixed rewards along the road, claimed by the player.
  const ROAD = [
    { at: 0, kind: 'arena', arena: 'cinder' },
    { at: 20, kind: 'rubies', amount: 10 },
    { at: 40, kind: 'card', card: 'skeletons', copies: 6 },
    { at: 60, kind: 'chest', chest: 'silver' },
    { at: 90, kind: 'rubies', amount: 30 },
    { at: 120, kind: 'card', card: 'cannon', copies: 4 },
    { at: 140, kind: 'card', card: 'magmaquake', copies: 3 },
    { at: 160, kind: 'chest', chest: 'silver' },
    { at: 180, kind: 'card', card: 'magmaturret', copies: 3 },
    { at: 200, kind: 'rubies', amount: 60 },
    { at: 230, kind: 'card', card: 'ashfall', copies: 1 },
    { at: 250, kind: 'chest', chest: 'gold' },
    { at: 300, kind: 'arena', arena: 'briar' },
    { at: 330, kind: 'card', card: 'spears', copies: 6 },
    { at: 370, kind: 'rubies', amount: 145 },
    { at: 400, kind: 'card', card: 'pots', copies: 6 },
    { at: 420, kind: 'card', card: 'bramblenest', copies: 3 },
    { at: 440, kind: 'chest', chest: 'gold' },
    { at: 480, kind: 'card', card: 'footmen', copies: 6 },
    { at: 500, kind: 'card', card: 'briarbind', copies: 1 },
    { at: 520, kind: 'rubies', amount: 240 },
    { at: 560, kind: 'card', card: 'flail', copies: 3 },
    { at: 580, kind: 'card', card: 'thornroller', copies: 1 },
    { at: 600, kind: 'arena', arena: 'sunstone' },
    { at: 630, kind: 'card', card: 'sandstorm', copies: 6 },
    { at: 670, kind: 'rubies', amount: 420 },
    { at: 690, kind: 'card', card: 'scarabshrine', copies: 3 },
    { at: 710, kind: 'card', card: 'ramcart', copies: 3 },
    { at: 750, kind: 'chest', chest: 'gold' },
    { at: 770, kind: 'card', card: 'dunemortar', copies: 6 },
    { at: 790, kind: 'card', card: 'mole', copies: 3 },
    { at: 830, kind: 'rubies', amount: 600 },
    { at: 870, kind: 'card', card: 'camel', copies: 1 },
    { at: 900, kind: 'arena', arena: 'stormspire' },
    { at: 930, kind: 'card', card: 'bees', copies: 6 },
    { at: 970, kind: 'rubies', amount: 900 },
    { at: 1010, kind: 'card', card: 'owl', copies: 3 },
    { at: 1050, kind: 'chest', chest: 'platinum' },
    { at: 1090, kind: 'card', card: 'thundercloud', copies: 1 },
    { at: 1130, kind: 'rubies', amount: 1200 },
    { at: 1170, kind: 'card', card: 'griffin', copies: 1 },
    // the rest of Stormspire
    { at: 1210, kind: 'card', card: 'judgment', copies: 1 },
    { at: 1250, kind: 'chest', chest: 'gold' },
    { at: 1290, kind: 'card', card: 'cyclone', copies: 1 },
    { at: 1340, kind: 'rubies', amount: 1500 },
    { at: 1380, kind: 'card', card: 'conductor', copies: 3 },
    { at: 1430, kind: 'chest', chest: 'platinum' },
    { at: 1530, kind: 'rubies', amount: 1800 },
    { at: 1630, kind: 'chest', chest: 'legendary' },
    { at: 1730, kind: 'rubies', amount: 2200 },
    { at: 1830, kind: 'chest', chest: 'platinum' },
    { at: 1920, kind: 'rubies', amount: 2600 },
    // Arena 5: Frostfang Keep
    { at: 2000, kind: 'arena', arena: 'frostfang' },
    { at: 2060, kind: 'card', card: 'frostsprite', copies: 6 },
    { at: 2100, kind: 'card', card: 'glacierslam', copies: 6 },
    { at: 2140, kind: 'rubies', amount: 3000 },
    { at: 2220, kind: 'card', card: 'icegiant', copies: 3 },
    { at: 2300, kind: 'chest', chest: 'platinum' },
    { at: 2380, kind: 'card', card: 'flashfreeze', copies: 1 },
    { at: 2420, kind: 'card', card: 'cage', copies: 3 },
    { at: 2460, kind: 'rubies', amount: 3500 },
    { at: 2540, kind: 'card', card: 'wintersage', copies: 1 },
    // Arena 6: Blackwater Harbor
    { at: 2600, kind: 'arena', arena: 'blackwater' },
    { at: 2670, kind: 'card', card: 'dockraiders', copies: 6 },
    { at: 2720, kind: 'card', card: 'powderkeg', copies: 1 },
    { at: 2760, kind: 'rubies', amount: 4000 },
    { at: 2850, kind: 'card', card: 'barrel', copies: 1 },
    { at: 2940, kind: 'chest', chest: 'legendary' },
    { at: 2990, kind: 'card', card: 'barracks', copies: 3 },
    { at: 3030, kind: 'card', card: 'broadside', copies: 1 },
    { at: 3120, kind: 'rubies', amount: 4500 },
    { at: 3210, kind: 'card', card: 'harpoon', copies: 1 },
    // Arena 7: Gearforge Citadel
    { at: 3300, kind: 'arena', arena: 'gearforge' },
    { at: 3380, kind: 'card', card: 'coil', copies: 6 },
    { at: 3430, kind: 'card', card: 'overclock', copies: 1 },
    { at: 3480, kind: 'rubies', amount: 5000 },
    { at: 3580, kind: 'card', card: 'sparkbots', copies: 3 },
    { at: 3630, kind: 'card', card: 'foundry', copies: 3 },
    { at: 3680, kind: 'chest', chest: 'legendary' },
    { at: 3780, kind: 'card', card: 'titan', copies: 1 },
    { at: 3830, kind: 'card', card: 'smelter', copies: 3 },
    { at: 3880, kind: 'rubies', amount: 6000 },
    { at: 3980, kind: 'card', card: 'arccannon', copies: 1 },
    // Arena 8: Crystal Chasm
    { at: 4100, kind: 'arena', arena: 'crystal' },
    { at: 4200, kind: 'card', card: 'gemflash', copies: 6 },
    { at: 4310, kind: 'rubies', amount: 7000 },
    { at: 4420, kind: 'card', card: 'shardguards', copies: 1 },
    { at: 4530, kind: 'chest', chest: 'legendary' },
    { at: 4640, kind: 'card', card: 'drill', copies: 1 },
    { at: 4750, kind: 'rubies', amount: 8000 },
    { at: 4860, kind: 'card', card: 'prism', copies: 1 },
    // Arena 9: Skyward Sanctuary
    { at: 4930, kind: 'card', card: 'prismecho', copies: 1 },
    { at: 5000, kind: 'arena', arena: 'skyward' },
    { at: 5110, kind: 'card', card: 'sunsprite', copies: 3 },
    { at: 5170, kind: 'card', card: 'heavensguard', copies: 6 },
    { at: 5230, kind: 'rubies', amount: 9000 },
    { at: 5350, kind: 'card', card: 'guardian', copies: 3 },
    { at: 5470, kind: 'chest', chest: 'mythic' },
    { at: 5590, kind: 'card', card: 'drake', copies: 1 },
    { at: 5650, kind: 'card', card: 'reflection', copies: 1 },
    { at: 5710, kind: 'rubies', amount: 10000 },
    { at: 5830, kind: 'card', card: 'phoenix', copies: 1 },
    // Arena 10: Eclipse Throne
    { at: 5900, kind: 'card', card: 'ballista', copies: 1 },
    { at: 6000, kind: 'arena', arena: 'eclipse' },
    { at: 6100, kind: 'card', card: 'wraiths', copies: 1 },
    { at: 6150, kind: 'card', card: 'soulblight', copies: 1 },
    { at: 6200, kind: 'chest', chest: 'legendary' },
    { at: 6300, kind: 'card', card: 'meteor', copies: 3 },
    { at: 6400, kind: 'rubies', amount: 12000 },
    { at: 6450, kind: 'card', card: 'collapse', copies: 1 },
    { at: 6500, kind: 'card', card: 'abyss', copies: 1 },
    { at: 6600, kind: 'chest', chest: 'mythic' },
    { at: 6700, kind: 'card', card: 'dreadknight', copies: 1 },
    { at: 6850, kind: 'rubies', amount: 15000 },
    { at: 7000, kind: 'chest', chest: 'mythic' },
  ];
  // Names and unlock times; what each holds is in ECONOMY.chests.
  const CHESTS = {
    wooden: { name: 'Wooden Chest', seconds: 60 },
    silver: { name: 'Silver Chest', seconds: 15 * 60 },
    gold: { name: 'Gold Chest', seconds: 60 * 60 },
    platinum: { name: 'Platinum Chest', seconds: 3 * 3600 },
    legendary: { name: 'Legendary Chest', seconds: 8 * 3600 },
    mythic: { name: 'Mythic Chest', seconds: 12 * 3600 },
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
  // Copies and rubies to go from level L to L+1 (index 0 is level 1 to 2).
  // Copies and rubies to go from level L to L+1 (index 0 is level 1 to 2); from the economy above.
  const UPGRADE = { copies: ECONOMY.upgradeCopies, rubies: ECONOMY.upgradeGold };

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
    mode: null, trophies: 0, best: 0, rubies: 0, wallet: 0, walletDay: null, diamonds: 0, shop: null, freeChestDay: null, magic: {}, cards: {}, evos: [], pass: null, member: false, king: 1, emotes: [], found: KC_STARTER_DECK.slice(), deck: KC_STARTER_DECK.slice(),
    chests: [null, null, null, null], cycle: 0, claimed: {}, diff: 0.35, trophyRecord: { w: 0, l: 0, d: 0 },
  });

  function load(st) {
    storage = st === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : st;
    const raw = store.get() || {};
    // Rubies used to be called coins: an older save's coins become Rubies one for one, in its chests and
    // Shop offers too. (Coins now mean the SirSC wallet's currency: `wallet`, never paid out by the game.)
    if (raw.rubies === undefined && raw.coins !== undefined) raw.rubies = raw.coins;
    delete raw.coins;
    for (const c of raw.chests || []) if (c && c.contents && c.contents.rubies === undefined) { c.contents.rubies = c.contents.coins || 0; delete c.contents.coins; }
    if (raw.shop && Array.isArray(raw.shop.offers)) for (const o of raw.shop.offers) { if (o.kind === 'coins') o.kind = 'rubies'; if (o.currency === 'coins') o.currency = 'rubies'; }
    P = Object.assign(blank(), raw);
    let old = null; // the record kept before there were three trainers
    try { old = storage && JSON.parse(storage.getItem('kc.record') || 'null'); } catch (e) { old = null; }
    if (old && !P.records.owen) { P.records.owen = old; if (old.w > 0) P.beaten.owen = true; }
    for (const t of KC_TRAINERS) P.records[t.id] = Object.assign({ w: 0, l: 0, d: 0 }, P.records[t.id]);
    // every card at least its rarity's starting level; no negative, fractional or junk numbers
    const nn = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    for (const id of KC_ALL_CARDS) {
      const c = Object.assign({ level: 1, count: 0 }, P.cards[id]);
      P.cards[id] = { level: Math.max(KC_MIN_LEVEL(id), Math.min(MAX_LEVEL, nn(c.level) || 1)), count: nn(c.count) };
    }
    P.rubies = nn(P.rubies); P.wallet = nn(P.wallet); P.diamonds = nn(P.diamonds);
    P.walletDay = P.walletDay && typeof P.walletDay.day === 'string' ? { day: P.walletDay.day, n: nn(P.walletDay.n) } : { day: '', n: 0 }; P.xp = nn(P.xp); P.trophies = nn(P.trophies); P.best = Math.max(nn(P.best), P.trophies);
    P.winDay = P.winDay && typeof P.winDay.day === 'string' ? { day: P.winDay.day, n: nn(P.winDay.n) } : { day: '', n: 0 };
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
  // Once the Trophy Road is open there is no going back to the trainers: every battle is a trophy battle.
  const mode = () => (roadOpen() ? 'trophy' : 'trainer');
  function setMode(m, id) { if (roadOpen()) m = 'trophy'; P.mode = m; if (id && m === 'trainer') P.opp = id; save(); }

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
  // Claim a road reward. Returns what it gave (rubies, a card, or a chest's contents opened on the spot).
  function claim(at) {
    const m = ROAD.find(r => r.at === at);
    if (!m || roadState(m) !== 'ready') return null;
    P.claimed[at] = true;
    let out = { kind: m.kind };
    if (m.kind === 'rubies') { P.rubies += m.amount; out.rubies = m.amount; }
    else if (m.kind === 'card') {
      const isNew = !P.found.includes(m.card);
      if (isNew) P.found = KC_ALL_CARDS.filter(id => id === m.card || P.found.includes(id));
      P.cards[m.card].count += m.copies - (isNew ? 1 : 0);      // the first copy unlocks it; it isn't a duplicate
      out = { kind: 'card', cards: [{ id: m.card, n: m.copies, isNew }], rubies: 0 };
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
  // Opponents level their cards one at a time as their trophies rise, along ECONOMY.foeLevels (the
  // average card level a player has at those trophies): every card level 1 below 50 trophies, about 7
  // in Arena 3, 7 to 8 entering Arena 4, 8 to 9 at 1,200, 12 at 2,000 and 15 at 4,000.
  const DECK = 8;
  function foeUpgrades(t) {
    const C = ECONOMY.foeLevels;
    t = Math.max(0, +t || 0);
    let lv = C[C.length - 1][1];
    for (let i = 1; i < C.length; i++) if (t < C[i][0]) { lv = C[i - 1][1] + (C[i][1] - C[i - 1][1]) * (t - C[i - 1][0]) / (C[i][0] - C[i - 1][0]); break; }
    return Math.max(0, Math.min((MAX_LEVEL - 1) * DECK, Math.floor((lv - 1) * DECK)));
  }
  // Spread n single-card upgrades over a deck: everyone gets floor(n / 8) levels, and n % 8 cards
  // (picked with rand, so each opponent differs) are one level ahead.
  function spreadLevels(n, ids, rand = Math.random) {
    const base = 1 + Math.floor(n / ids.length), order = ids.slice();
    let extra = n % ids.length;
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return Object.fromEntries(order.map(id => [id, Math.min(MAX_LEVEL, base + (extra-- > 0 ? 1 : 0))]));
  }
  function foeKing(levels) {
    let k = 1;
    for (let n = 2; n <= MAX_LEVEL; n++) if (levels.filter(v => v >= n).length >= Math.min(n, levels.length)) k = n; else break;
    return k;
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
    if (t >= 140) swap('magmaquake', 0.35);
    if (t >= 180) swap('magmaturret', 0.4);
    if (t >= 230) swap('ashfall', 0.35);
    // Briar Hollow cards, as they unlock on the road
    if (t >= 330) swap('spears', 0.5);
    if (t >= 400) swap('pots', 0.5);
    if (t >= 480) swap('footmen', 0.5);
    if (t >= 560) swap('flail', 0.5);
    if (t >= 420) swap('bramblenest', 0.35);
    if (t >= 500) swap('briarbind', 0.35);
    if (t >= 580) swap('thornroller', 0.4);
    // Sunstone Arena cards
    if (t >= 630) swap('sandstorm', 0.5);
    if (t >= 710) swap('ramcart', 0.5);
    if (t >= 790) swap('mole', 0.5);
    if (t >= 870) swap('camel', 0.45);
    if (t >= 690) swap('scarabshrine', 0.35);
    if (t >= 770) swap('dunemortar', 0.3);
    // Stormspire cards
    if (t >= 930) swap('bees', 0.5);
    if (t >= 1010) swap('owl', 0.5);
    if (t >= 1090) swap('thundercloud', 0.45);
    if (t >= 1170) swap('griffin', 0.4);
    if (t >= 1210) swap('judgment', 0.3);
    if (t >= 1290) swap('cyclone', 0.35);
    if (t >= 1380) swap('conductor', 0.4);
    // Arenas 5 to 10: troops take a middle slot; win conditions can take the Rhino's, spells the Fireball's
    const swapAt = (id, i, p) => { if (rand() <= p && !deck.includes(id)) deck[i] = id; };
    const NEWER = [[2060, 'frostsprite', 0.45], [2220, 'icegiant', 0.4, 0], [2380, 'flashfreeze', 0.35, 7], [2540, 'wintersage', 0.45],
      [2670, 'dockraiders', 0.45], [2850, 'barrel', 0.4, 0], [3030, 'broadside', 0.4], [3210, 'harpoon', 0.45],
      [3380, 'coil', 0.4], [3580, 'sparkbots', 0.45], [3780, 'titan', 0.4, 0], [3980, 'arccannon', 0.4],
      [4200, 'gemflash', 0.4, 7], [4420, 'shardguards', 0.45], [4640, 'drill', 0.4, 0], [4860, 'prism', 0.45],
      [5110, 'sunsprite', 0.35], [5350, 'guardian', 0.4], [5590, 'drake', 0.45], [5830, 'phoenix', 0.45],
      [6100, 'wraiths', 0.45], [6300, 'meteor', 0.35, 7], [6500, 'abyss', 0.4, 0], [6700, 'dreadknight', 0.45],
      // the expansion's cards from Arena 5 on
      [2100, 'glacierslam', 0.35], [2420, 'cage', 0.35], [2720, 'powderkeg', 0.35], [2990, 'barracks', 0.3],
      [3430, 'overclock', 0.3], [3630, 'foundry', 0.25], [3830, 'smelter', 0.35], [4930, 'prismecho', 0.25],
      [5170, 'heavensguard', 0.35], [5650, 'reflection', 0.3], [5900, 'ballista', 0.3, 0], [6150, 'soulblight', 0.35], [6450, 'collapse', 0.35, 7]];
    for (const [at, id, pr, slot] of NEWER) if (t >= at) { if (slot !== undefined) swapAt(id, slot, pr); else swap(id, pr); }
    const name = FOE_NAMES[Math.floor(rand() * FOE_NAMES.length)];
    const foeTrophies = Math.max(0, t + Math.round((rand() - 0.5) * 30));
    const cardLevels = spreadLevels(foeUpgrades(foeTrophies), deck, rand);
    for (const id of deck) cardLevels[id] = Math.max(KC_MIN_LEVEL(id), cardLevels[id]);
    const lvl = Math.min(...Object.values(cardLevels));
    // their King Tower: the players' rule (level N needs N cards at level N), counting the rest of their
    // collection as levelled with their deck once all eight are past 8
    const kingLevel = foeKing(Object.values(cardLevels));
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
    // gold for a win, for the first few wins each day
    let gold = 0;
    if (winner === 0) {
      const today = dayKey(Date.now());
      if (P.winDay.day !== today) P.winDay = { day: today, n: 0 };
      if (P.winDay.n < ECONOMY.winGold.dailyCap) { P.winDay.n++; gold = winGold(); P.rubies += gold; }
    }
    const xp = winner === 0 ? XP.win : winner === 1 ? XP.loss : XP.draw, levelUp = addXp(xp);
    const newArena = arena().id !== beforeArena ? arena() : null;
    const pass = passAdd(crowns || 0);
    save();
    return { kind: 'trophy', delta: P.trophies - before, trophies: P.trophies, chest, slotsFull, xp, levelUp, newArena, newRewards: claimable().length, pass, gold,
      goldLeft: Math.max(0, ECONOMY.winGold.dailyCap - P.winDay.n) };
  }

  /* ---------- chests ---------- */
  // The cards a chest can give: every card you have found, and every card of the arenas you have ever
  // reached (by your best trophies, so dropping trophies never takes cards away), even before its
  // Trophy Road reward. Never cards of an arena you haven't reached, whatever your account level.
  function chestPool() {
    const open = roadOpen() ? ARENAS.filter(a => !a.soon && a.min <= P.best).flatMap(a => a.cards || []) : [];
    return KC_ALL_CARDS.filter(id => KC_CARDS[id] && (P.found.includes(id) || open.includes(id)));
  }
  // The reward tier for a player: { gold, cards } multipliers from trophies and account level.
  // opts can stand in for the player ({ trophies, level }) to price other profiles.
  function rewardTier(opts = {}) {
    const t = Math.max(0, Math.floor(opts.trophies !== undefined ? opts.trophies : P.trophies) || 0);
    const lv = Math.max(1, Math.floor(opts.level !== undefined ? opts.level : level()) || 1);
    const real = ARENAS.filter(a => !a.soon), here = real.filter(a => t >= a.min).pop() || real[0], next = real.find(a => a.min > t);
    const E = ECONOMY, top = Math.max(...Object.keys(E.arenaGold).map(Number));
    const at = (tab, n) => (tab[n] || tab[top] * Math.pow(E.nextArenaGrowth, n - top));
    // climbing through the arena, or past the last one
    const f = next ? Math.min(1, (t - here.min) / (next.min - here.min)) : 0;
    const rise = tab => (next ? 1 + f * Math.max(E.withinArena, at(tab, next.number) / (at(tab, here.number) * E.arenaJump) - 1)
      : 1 + Math.min(E.beyond.max, E.beyond.add * Math.floor((t - here.min) / E.beyond.every)));
    const climb = rise(E.arenaCards), climbG = rise(E.arenaGold);
    const lvl = 1 + E.levelStep * (Math.min(lv, E.levelCap) - 1);
    const bonus = Math.min(10, Math.max(1, Number(opts.bonus) || 1));
    return { arena: here.number, gold: at(E.arenaGold, here.number) * climbG * lvl * bonus, cards: at(E.arenaCards, here.number) * climb * lvl * bonus, climb, level: lvl };
  }
  // kept for older callers: the card multiplier
  const chestMult = lv => rewardTier(lv ? { level: lv } : {}).cards;
  // What a chest holds for this player, on average: shown on Shop tiles, used by roll().
  function chestOdds(type, opts) {
    const T = ECONOMY.chests[type], M = rewardTier(opts), cards = Math.round(T.cards * M.cards);
    const rareN = Math.max(Math.round((T.rare.min || 0) * M.cards), Math.round(cards * (T.rare.share || 0)));
    const ex = (r, pow) => { const e = T[r] || {}; return ((e.min || 0) + (e.chance || 0)) * Math.pow(M.cards, pow); };
    return { cards, rubies: [Math.round(T.gold[0] * M.gold), Math.round(T.gold[1] * M.gold)], kinds: T.kinds, rares: rareN, rareChance: T.rare.chance || 0,
      epics: ex('epic', ECONOMY.epicPow), legendaries: ex('legendary', ECONOMY.legendaryPow),
      epicMin: (T.epic && T.epic.min) || 0, legendaryMin: (T.legendary && T.legendary.min) || 0, tier: M };
  }
  const chestAllowed = (type, n = arena().number) => CHEST_RULES.allUnlocked || (CHEST_RULES.arena[type] || 99) <= n;
  // The tier actually given: the asked-for tier, or the highest one below it the arena allows.
  function capChest(type, n) {
    let i = Math.max(0, TIERS.indexOf(type));
    while (i > 0 && !chestAllowed(TIERS[i], n)) i--;
    return TIERS[i];
  }
  // A chest's contents, rolled once (when it is won, bought or claimed) and stored, so nothing can be
  // rerolled by reopening the game.
  function roll(type, rand = Math.random, opts) {
    const O = chestOdds(type, opts), pool = chestPool();
    const by = r => pool.filter(id => KC_CARDS[id].rarity === r);
    const whole = x => Math.floor(x) + (rand() < x - Math.floor(x) ? 1 : 0);
    // how many of each rarity
    const n = { rare: O.rares + (rand() < O.rareChance ? 1 : 0), epic: Math.max(O.epicMin, whole(O.epics)), legendary: Math.max(O.legendaryMin, whole(O.legendaries)) };
    n.common = Math.max(0, O.cards - n.rare - n.epic - n.legendary);
    // a rarity with nothing eligible is paid in the one below
    for (const r of ['legendary', 'epic']) if (n[r] && !by(r).length) { const [to, k] = ECONOMY.fallback[r]; n[to] += n[r] * k; n[r] = 0; }
    if (n.rare && !by('rare').length) { n.common += n.rare * 10; n.rare = 0; }
    // spread each rarity over a few different cards
    const cards = [];
    const spread = (r, count, kinds) => {
      if (count <= 0) return;
      const bag = by(r).slice(), picks = [];
      for (let i = 0; i < Math.min(kinds, count, bag.length); i++) picks.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
      const w = picks.map(() => 0.7 + rand() * 0.6), tw = w.reduce((a, x) => a + x, 0);
      let left = count;
      picks.forEach((id, i) => { const k = i === picks.length - 1 ? left : Math.max(1, Math.min(left - (picks.length - 1 - i), Math.round(count * w[i] / tw))); left -= k; if (k > 0) cards.push({ id, n: k }); });
    };
    spread('common', n.common, O.kinds);
    spread('rare', n.rare, Math.ceil(O.kinds / 2));
    spread('epic', n.epic, 2);
    spread('legendary', n.legendary, 1);
    const rubies = Math.round(lerp(O.rubies[0], O.rubies[1], rand()));
    return { rubies: Math.max(0, rubies), cards, items: rollItems(type, rand, opts) };
  }
  // gold for one trophy-battle win
  const winGold = opts => Math.round(ECONOMY.winGold.base * rewardTier(opts).gold);
  function apply(c) {
    P.rubies += c.rubies;
    // a card that came out before you reached it on the Trophy Road is found now
    const fresh = c.cards.filter(x => !P.found.includes(x.id)).map(x => x.id);
    if (fresh.length) P.found = KC_ALL_CARDS.filter(id => P.found.includes(id) || fresh.includes(id));
    // the first copy of a new card unlocks it and isn't counted as a duplicate
    for (const { id, n } of c.cards) P.cards[id].count += Math.max(0, n - (fresh.includes(id) ? 1 : 0));
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
  // Diamonds to open chest i now: 1 per 5 minutes of its timer still to run (a locked chest's whole
  // timer, an unlocking one's time left), rounded up. 0 when there is nothing to skip.
  function skipCost(i, now = Date.now()) {
    const st = chestState(i, now), c = P.chests[i];
    if (st !== 'locked' && st !== 'unlocking') return 0;
    const left = st === 'locked' ? CHESTS[c.type].seconds : Math.max(0, (c.ends - now) / 1000);
    return Math.max(1, Math.ceil(left / ECONOMY.skip.secondsPerDiamond));
  }
  // Pay the diamonds and open chest i at once. Another chest that is unlocking carries on.
  // Returns the opened contents (as openChest does) plus { cost }, or { error: 'none' | 'diamonds', cost }.
  function skipChest(i, now = Date.now()) {
    const cost = skipCost(i, now);
    if (!cost) return { error: 'none', cost: 0 };
    if (P.diamonds < cost) return { error: 'diamonds', cost };
    P.diamonds -= cost;
    P.chests[i].state = 'unlocking'; P.chests[i].ends = now;
    return Object.assign(openChest(i, now), { cost });
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
  // what it gives. Prices: a copy is worth 10 rubies (common) or 50 (rare); 1 diamond = 5,000 rubies.
  // Chests are sold for rubies only, one of each a day, with their contents shown before you buy.
  const SHOP = { perCopy: ECONOMY.shop.perCopy, rubiesPerDiamond: 5000, maxQty: ECONOMY.shop.maxQty, chests: ECONOMY.chests };
  const maxQty = id => Math.max(1, SHOP.maxQty[KC_CARDS[id].rarity] || 0);
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = now => { const d = new Date(now); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  // When today's offers are replaced: the next local midnight.
  const shopEnds = (now = Date.now()) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime(); };
  const copiesNeed = id => UPGRADE.copies[KC_CARDS[id].rarity][P.cards[id].level - 1];
  function copiesToMax(id) {
    const c = P.cards[id], list = UPGRADE.copies[KC_CARDS[id].rarity];
    let n = 0;
    for (let l = c.level; l < MAX_LEVEL; l++) n += list[l - 1] || 0;
    return Math.max(0, n - c.count);
  }
  // the gold still to pay to take a card to level 15
  function goldToMax(id) {
    let n = 0;
    for (let l = P.cards[id].level; l < MAX_LEVEL; l++) n += UPGRADE.rubies[l - 1] || 0;
    return n;
  }
  function makeOffers(rand = Math.random) {
    const open = P.found.filter(id => P.cards[id].level < MAX_LEVEL && SHOP.maxQty[KC_CARDS[id].rarity] > 0);
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
        price: currency === 'diamonds' ? Math.max(1, Math.ceil(value / SHOP.rubiesPerDiamond)) : value });
    };
    if (open.length) {
      // 1. the card closest to its next upgrade: exactly the copies it is missing
      let pool = free().filter(id => missing(id) > 0).sort((a, b) => missing(a) - missing(b) || inDeck(b) - inDeck(a));
      let id = pool[0] || free()[0];
      add(id, Math.min(maxQty(id), missing(id) > 0 ? missing(id) : copiesNeed(id)), 'Closest to upgrade', 'rubies');
      // 2. a rare card (a common if every rare is taken or maxed): one level's worth
      pool = free().filter(c => KC_CARDS[c].rarity === 'rare');
      id = pool[0] || free()[0];
      add(id, Math.min(maxQty(id), copiesNeed(id)), KC_CARDS[id].rarity === 'rare' ? 'Rare pick' : 'Card pick', 'rubies');
      // 3. your lowest-level card (cards found on the Trophy Road first): one level's worth
      pool = free().sort((a, b) => lvl(a) - lvl(b) || (KC_STARTER_DECK.includes(a) ? 1 : 0) - (KC_STARTER_DECK.includes(b) ? 1 : 0));
      id = pool[0];
      add(id, Math.min(maxQty(id), copiesNeed(id)), 'Catch up', 'rubies');
      // 4. a big bundle of your highest-level deck card: 5,000 rubies' worth of copies for 1 diamond
      pool = free().filter(c => ECONOMY.shop.megaQty[KC_CARDS[c].rarity] > 0).sort((a, b) => inDeck(b) - inDeck(a) || lvl(b) - lvl(a));
      id = pool[0];
      if (id) add(id, ECONOMY.shop.megaQty[KC_CARDS[id].rarity], 'Mega bundle', 'diamonds');
    }
    // 5. rubies for a diamond, at the exchange rate
    offers.push({ id: 'o' + offers.length, kind: 'rubies', qty: SHOP.rubiesPerDiamond, tag: 'Ruby bundle', currency: 'diamonds', price: 1, repeat: true });
    return offers;
  }
  /* ---------- the diamond-only sections: Daily Deals, the Magic Shop and the Card Shop ---------- */
  const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const poolHas = r => chestPool().some(id => KC_CARDS[id].rarity === r);
  function dealWorth(d) {
    const W = ECONOMY.diamondShop.worth;
    return d.rubies * W.ruby + Object.entries(d.wild).reduce((a, [r, n]) => a + n * W[r], 0);
  }
  function makeDeals() {
    const D = ECONOMY.diamondShop, S = D.dealScale;
    const k = Math.max(S.min, Math.min(S.max, rewardTier().cards / ECONOMY.arenaCards[4]));
    return D.deals.map((d, i) => {
      const wild = {};
      for (const [r, n] of Object.entries(d.wild)) if (poolHas(r)) wild[r] = Math.max(1, Math.round(n * k));
      // contents and price grow together, so a deal is always worth about the same multiple of its price
      const price = Math.max(1, Math.round(d.price * k)), kk = price / d.price;
      for (const r of Object.keys(wild)) wild[r] = Math.max(1, Math.round(d.wild[r] * kk));
      const deal = { id: 'd' + i, tag: d.tag, price, rubies: Math.round(d.rubies * kk / 100) * 100, wild };
      deal.worth = Math.round(dealWorth(deal) / price * 10) / 10;   // how many times its price it is worth
      return deal;
    });
  }
  function magicUsable(id) {
    const M = MAGIC[id];
    if (!M) return false;
    if (M.kind === 'shard') return evoOpen();
    return M.rarity === 'any' || P.found.some(c => KC_CARDS[c].rarity === M.rarity);
  }
  function makeMagic(rand = Math.random) {
    const D = ECONOMY.diamondShop, bag = Object.entries(D.magic).filter(([id]) => magicUsable(id)), out = [];
    while (out.length < D.magicPerDay && bag.length) {
      let x = rand() * bag.reduce((a, [, m]) => a + m.weight, 0), i = 0;
      for (; i < bag.length - 1; i++) { x -= bag[i][1].weight; if (x <= 0) break; }
      const [id, m] = bag.splice(i, 1)[0];
      out.push({ id: 'm' + out.length, item: id, qty: m.qty, price: m.price });
    }
    return out.sort((a, b) => a.price - b.price);
  }
  function makeCardShop(rand = Math.random) {
    const pool = chestPool().filter(id => P.cards[id].level < MAX_LEVEL);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    pool.sort((a, b) => RARITY_RANK[KC_CARDS[b].rarity] - RARITY_RANK[KC_CARDS[a].rarity]);
    return pool.slice(0, 3).map((id, i) => { const pk = ECONOMY.diamondShop.cardPacks[KC_CARDS[id].rarity]; return { id: 'c' + i, card: id, qty: pk.qty, price: pk.price }; });
  }
  // Today's offers (made the first time they are asked for each day), and today's diamond sections.
  function shop(now = Date.now(), rand) {
    const day = dayKey(now);
    if (!P.shop || P.shop.day !== day || !Array.isArray(P.shop.offers)) { P.shop = { day, offers: makeOffers(rand), bought: {} }; save(); }
    if (!P.shop.deals || !P.shop.magicItems || !P.shop.cardShop) {
      P.shop.deals = makeDeals(); P.shop.magicItems = makeMagic(rand); P.shop.cardShop = makeCardShop(rand);
      P.shop.dBought = P.shop.dBought || {};
      save();
    }
    return P.shop;
  }
  // Buy from a diamond section: 'deals', 'magic' or 'cards', item i. Diamonds only, once each a day.
  // Returns what it gave (like a chest: { rubies, cards, items }) or { error: 'none' | 'sold' | 'diamonds' | 'max' }.
  function buyDiamond(section, i, now = Date.now()) {
    const s = shop(now), list = { deals: s.deals, magic: s.magicItems, cards: s.cardShop }[section], o = list && list[i];
    if (!o) return { error: 'none' };
    const key = section + ':' + o.id;
    if (s.dBought[key]) return { error: 'sold' };
    if (o.card && P.cards[o.card].level >= MAX_LEVEL) return { error: 'max' };
    if (P.diamonds < o.price) return { error: 'diamonds' };
    P.diamonds -= o.price;
    const before = P.found.slice();
    const got = section === 'deals' ? { rubies: o.rubies, cards: [], items: Object.entries(o.wild).map(([r, n]) => ({ id: 'wild_' + r, n })) }
      : section === 'magic' ? { rubies: 0, cards: [], items: [{ id: o.item, n: o.qty }] }
        : { rubies: 0, cards: [{ id: o.card, n: o.qty }], items: [] };
    apply(got);
    s.dBought[key] = true;
    save();
    return Object.assign({ ok: true, price: o.price }, got, { cards: got.cards.map(x => Object.assign({ isNew: !before.includes(x.id) }, x)) });
  }
  // Shop chests cost rubies, one of each a day, from the arena in ECONOMY.shop.chestArena (by the highest
  // trophies reached). What is inside is rolled at purchase and stays hidden until the chest is opened
  // (the tile shows the card count and ruby range). The price is twice (the rubies inside plus half the
  // value of its cards), so it always costs more than it pays back and the bigger chests cost tens of thousands.
  function chestPrice(type, opts) {
    const o = chestOdds(type, opts), v = ECONOMY.shop.perCopy, avg = (o.rubies[0] + o.rubies[1]) / 2;
    const commons = Math.max(0, o.cards - o.rares - o.epics - o.legendaries);
    const cards = commons * v.common + (o.rares + o.rareChance) * v.rare + o.epics * v.epic + o.legendaries * v.legendary;
    return Math.max(5, Math.round((avg + cards * ECONOMY.shop.chestCardShare) * ECONOMY.shop.chestPriceScale / 5) * 5);
  }
  const bestArena = () => (ARENAS.filter(a => !a.soon && P.best >= a.min).pop() || ARENAS[0]).number;
  const chestShopOpen = type => bestArena() >= (ECONOMY.shop.chestArena[type] || 99);
  const chestsBought = (now = Date.now()) => (P.chestBuys && P.chestBuys.day === dayKey(now) ? P.chestBuys.n : {});
  const chestBuyLeft = (type, now = Date.now()) => Math.max(0, ECONOMY.shop.chestsPerDay - (chestsBought(now)[type] || 0));
  function buyChest(type, rand, now = Date.now()) {
    if (!CHESTS[type] || !SHOP.chests[type]) return { error: 'none' };
    if (!chestAllowed(type) || !chestShopOpen(type)) return { error: 'locked' };
    if (!chestBuyLeft(type, now)) return { error: 'sold' };
    const price = chestPrice(type);
    if (P.rubies < price) return { error: 'rubies' };
    P.rubies -= price;
    P.chestBuys = { day: dayKey(now), n: Object.assign({}, chestsBought(now), { [type]: (chestsBought(now)[type] || 0) + 1 }) };
    const c = roll(type, rand), before = P.found.slice();
    apply(c);
    save();
    return { ok: true, chest: type, price, rubies: c.rubies, cards: c.cards.map(x => Object.assign({ isNew: !before.includes(x.id) }, x)), items: c.items };
  }
  // Wallet Coins to Rubies, one way, up to a daily cap by the highest arena reached. TEMPORARY: the wallet
  // balance is kept on this device; once the SirSC wallet is connected the server must take the coins and
  // enforce the cap, and the game never pays coins out.
  function exchangeCap() {
    const X = ECONOMY.exchange, top = Math.max(...Object.keys(X.cap).map(Number)), n = bestArena();
    if (n < top) return X.cap[n] || X.cap[1];
    const last = ARENAS.filter(a => !a.soon).find(a => a.number === top), over = Math.max(0, P.best - (last ? last.min : 0));
    return Math.min(X.beyond.max, X.cap[top] + X.beyond.add * Math.floor(over / X.beyond.every));
  }
  function exchangeInfo(now = Date.now()) {
    const used = P.walletDay.day === dayKey(now) ? P.walletDay.n : 0, cap = exchangeCap();
    return { rate: ECONOMY.exchange.rate, cap, used, left: Math.max(0, cap - used), coins: P.wallet, ends: shopEnds(now) };
  }
  // Swap n coins for rubies. Returns { ok, coins, rubies } or { error: 'amount' | 'cap' | 'coins' }.
  function exchange(n, now = Date.now()) {
    n = Math.floor(+n);
    const x = exchangeInfo(now);
    if (!Number.isFinite(n) || n <= 0) return { error: 'amount' };
    if (n > x.left) return { error: 'cap', left: x.left };
    if (n > P.wallet) return { error: 'coins', have: P.wallet };
    P.wallet -= n;
    P.rubies += n * x.rate;
    P.walletDay = { day: dayKey(now), n: x.used + n };
    save();
    return { ok: true, coins: n, rubies: n * x.rate };
  }
  // One free Wooden Chest a day (local days, like the offers).
  const freeChestReady = (now = Date.now()) => P.freeChestDay !== dayKey(now);
  function claimFreeChest(now = Date.now(), rand) {
    if (!freeChestReady(now)) return { error: 'claimed' };
    P.freeChestDay = dayKey(now);
    const F = ECONOMY.freeChest, c = roll(F.type, rand, { bonus: F.bonus }), before = P.found.slice();
    apply(c);
    save();
    return { ok: true, chest: F.type, rubies: c.rubies, cards: c.cards.map(x => Object.assign({ isNew: !before.includes(x.id) }, x)), items: c.items };
  }
  function refreshShop(rand, now = Date.now()) { P.shop = null; return shop(now, rand); }
  // Buy offer i. Returns { ok, rubies, cards } or { error: 'sold' | 'rubies' | 'diamonds' | 'none' }.
  function buy(i, now = Date.now()) {
    const s = shop(now), o = s.offers[i];
    if (!o) return { error: 'none' };
    if (s.bought[o.id] && !o.repeat) return { error: 'sold' };
    if (o.card && P.cards[o.card] && P.cards[o.card].level >= MAX_LEVEL) return { error: 'max' };   // no paying for copies a maxed card can't use
    const wallet = o.currency === 'diamonds' ? 'diamonds' : 'rubies';
    if (P[wallet] < o.price) return { error: wallet };
    P[wallet] -= o.price;
    let out;
    if (o.kind === 'rubies') { P.rubies += o.qty; out = { rubies: o.qty, cards: [] }; }
    else { P.cards[o.card].count += o.qty; out = { rubies: 0, cards: [{ id: o.card, n: o.qty, isNew: false }] }; }
    s.bought[o.id] = (s.bought[o.id] || 0) + 1;
    save();
    return Object.assign({ ok: true, offer: o }, out);
  }
  /* ---------- emotes in the Shop ----------
     Fifteen emotes to buy, three of them on sale each day (the same three all day, a new set at
     midnight; ones you own are skipped). Each costs rubies and is yours for good: bought emotes join
     the eight everyone has in the battle emote panel. The art is in js/emotes.js. */
  const EMOTES = [
    { id: 'love', name: 'Love Struck' }, { id: 'cool', name: 'Too Cool' }, { id: 'party', name: 'Party Time' },
    { id: 'dizzy', name: 'Dizzy' }, { id: 'nervous', name: 'Nervous' }, { id: 'facepalm', name: 'Facepalm' },
    { id: 'kiss', name: 'Blow a Kiss' }, { id: 'wave', name: 'Hello!' }, { id: 'clap', name: 'Applause' },
    { id: 'shush', name: 'Shh!' }, { id: 'popcorn', name: 'Popcorn' }, { id: 'trophy', name: 'Champion' },
    { id: 'mindblown', name: 'Mind Blown' }, { id: 'smug', name: 'Smug' }, { id: 'salute', name: 'Salute' },
    // and one for every card: the card's character with its name
  ].concat(KC_ALL_CARDS.map(id => ({ id: 'card_' + id, name: KC_CARDS[id].name, card: id })));
  // each emote costs 5,000 rubies or 1 diamond (the same at the exchange rate)
  const EMOTE_SHOP = { perDay: 3, rubies: 5000, diamonds: 1 };
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
      .map(id => { const e = EMOTES.find(x => x.id === id); return { id, name: e.name, card: e.card || null, rubies: EMOTE_SHOP.rubies, diamonds: EMOTE_SHOP.diamonds, owned: P.emotes.includes(id) }; });
  }
  // currency: 'rubies' (5,000) or 'diamonds' (1)
  function buyEmote(id, currency = 'rubies', now = Date.now()) {
    const o = emoteOffers(now).find(x => x.id === id);
    if (!o) return { error: 'none' };
    if (o.owned) return { error: 'owned' };
    const wallet = currency === 'diamonds' ? 'diamonds' : 'rubies', price = o[wallet];
    if (P[wallet] < price) return { error: wallet };
    P[wallet] -= price;
    P.emotes.push(id);
    save();
    return { ok: true, id, price, currency: wallet };
  }

  // TEMPORARY: the test button's 1,000,000 rubies and diamonds.
  function grantTest() { P.rubies = 1000000; P.diamonds = 1000000; P.wallet = 1000000; save(); }


  /* ---------- magic items ----------
     Wild cards count as copies of any card of their rarity. A book fills every copy a card still needs
     for its next level (the Book of Books works on any rarity). The Hammer of Books upgrades a card one
     level for free: it fills any missing copies and pays the rubies. Evolution shards have a place but nothing
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
    hammer_books: { name: 'Hammer of Books', kind: 'hammer', rarity: 'any', blurb: 'Upgrades a card one level for free: it fills any copies the card is missing and needs no rubies.' },
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
  function rollItems(type, rand, opts) {
    const items = [];
    if (wildActive()) {
      const W = MAGIC_RULES.wild[type] || {}, m = rewardTier(opts).cards;
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
    // the hammer fills whatever copies are missing and pays the rubies: one level up, whatever the card has
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
      { free: { kind: 'rubies', n: 375 }, paid: { kind: 'evo', card: 'snowman' } },
      { free: { kind: 'item', item: 'wild_common', n: 20 }, paid: { kind: 'chest', chest: 'gold' } },
      { free: { kind: 'chest', chest: 'gold' }, paid: { kind: 'rubies', n: 1125 } },
      { free: { kind: 'rubies', n: 525 }, paid: { kind: 'item', item: 'wild_rare', n: 6 } },
      { free: { kind: 'item', item: 'shards', n: 1 }, paid: { kind: 'chest', chest: 'gold' } },
      { free: { kind: 'item', item: 'wild_rare', n: 3 }, paid: { kind: 'item', item: 'book_common', n: 1 } },
      { free: { kind: 'rubies', n: 675 }, paid: { kind: 'rubies', n: 1500 } },
      { free: { kind: 'chest', chest: 'gold' }, paid: { kind: 'item', item: 'shards', n: 2 } },
      { free: { kind: 'item', item: 'wild_common', n: 30 }, paid: { kind: 'chest', chest: 'platinum' } },
      { free: { kind: 'item', item: 'shards', n: 1 }, paid: { kind: 'item', item: 'wild_epic', n: 1 } },
      { free: { kind: 'rubies', n: 825 }, paid: { kind: 'chest', chest: 'gold' } },
      { free: { kind: 'chest', chest: 'gold' }, paid: { kind: 'rubies', n: 2250 } },
      { free: { kind: 'item', item: 'wild_rare', n: 5 }, paid: { kind: 'item', item: 'shards', n: 2 } },
      { free: { kind: 'rubies', n: 1050 }, paid: { kind: 'item', item: 'book_rare', n: 1 } },
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
  // Claim a tier's reward. Returns what it gave, in the same shape as a chest (rubies, cards, items).
  function claimPass(i, track) {
    if (passState(i, track) !== 'ready') return null;
    const R = PASS.tiers[i][track];
    P.pass[track][i] = true;
    let out = { reward: R, rubies: 0, cards: [], items: [] };
    if (R.kind === 'rubies') { P.rubies += R.n; out.rubies = R.n; }
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
    const need = UPGRADE.copies[card.rarity][c.level - 1], cost = UPGRADE.rubies[c.level - 1];
    const reason = c.count < need ? 'copies' : P.rubies < cost ? 'rubies' : '';
    return { found: true, level: c.level, count: c.count, need, cost, can: !reason, reason };
  }
  const upgradable = () => P.found.filter(id => upgradeInfo(id).can);
  function upgrade(id) {
    const u = upgradeInfo(id);
    if (!u.can) return null;
    P.cards[id].count -= u.need;
    P.rubies -= u.cost;
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
    chestAllowed, capChest, chestOdds, chestPrice, freeChestReady, claimFreeChest, ECONOMY, rewardTier, winGold, chestMult, copiesToMax, goldToMax, skipCost, skipChest, exchangeInfo, exchange, chestShopOpen, chestBuyLeft, foeKing, buyDiamond, magicUsable,
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
