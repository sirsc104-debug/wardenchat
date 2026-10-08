// Game data: buildings, troops, level tables and the names of rival players.
(function (G) {
  'use strict';

  const MAX_PH = 11;     // Pyramid levels 1-11
  const MAP = 44;        // map is MAP x MAP tiles
  const EDGE = 2;        // tiles at the map edge where nothing may be built

  // Seconds to build (level 1) or upgrade to level n.
  const BUILD_TIME = [0, 5, 30, 120, 300, 900, 1800, 3600, 5400, 9000, 14400, 21600];
  // Typical cost of one upgrade at each Pyramid level. Building costs scale off this
  // (times the building's `cf` cost factor) so late buildings never cost billions.
  const PH_COST = [0, 200, 600, 1500, 4000, 10000, 22000, 45000, 80000, 130000, 200000, 300000];

  // Materials: every level of every building is drawn in a different stone.
  const MATERIALS = [
    null,
    { name: 'Mud brick',        base: '#9a6b43', trim: '#6e4a2c', accent: '#c9a27a', glow: null },
    { name: 'Adobe',            base: '#bf8650', trim: '#8a5a32', accent: '#e2b98a', glow: null },
    { name: 'Sandstone',        base: '#dcb36d', trim: '#a97f3d', accent: '#f3d79f', glow: null },
    { name: 'Limestone',        base: '#ebe0c4', trim: '#b8a782', accent: '#fff6df', glow: null },
    { name: 'Red granite',      base: '#b55a4a', trim: '#7d3428', accent: '#e39a85', glow: null },
    { name: 'Painted limestone',base: '#f2ebd9', trim: '#2f6fb3', accent: '#c8423a', glow: null },
    { name: 'Gilded sandstone', base: '#e3c47e', trim: '#d9a520', accent: '#fff1b8', glow: null },
    { name: 'Lapis',            base: '#2f55a8', trim: '#e2b23a', accent: '#8fb1ff', glow: null },
    { name: 'Basalt',           base: '#3b3a45', trim: '#e2b23a', accent: '#7a7890', glow: '#ffb84a' },
    { name: 'Electrum',         base: '#e0cc72', trim: '#fff7cf', accent: '#a98c2a', glow: '#fff1a0' },
    { name: 'Obsidian',         base: '#261f33', trim: '#3fe0d0', accent: '#e2b23a', glow: '#3fe0d0' },
  ];

  // How many of each building a Pyramid level allows (index 0 = Pyramid 1).
  const B = {};
  function def(id, o) { o.id = id; B[id] = o; return o; }

  // ---------- Core and economy ----------
  def('pyramid', {
    name: 'Pyramid', size: 4, cat: 'core', costRes: 'gold', cf: 4, hp: 1600,
    counts: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    storage: [1000, 2500, 10000, 30000, 60000, 100000, 150000, 200000, 250000, 300000, 400000],
    desc: 'The heart of your town. Upgrade it to unlock new buildings, troops and levels. Destroying it earns a star.',
  });
  def('builderHut', {
    name: "Builder's Hut", size: 2, cat: 'core', costRes: 'gold', cf: 0.8, hp: 300,
    counts: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], noShop: true,
    desc: 'Home of one builder. Each builder works on one building at a time.',
  });
  def('goldMine', {
    name: 'Gold Mine', size: 3, cat: 'resource', costRes: 'goop', cf: 0.6, hp: 420,
    counts: [1, 2, 3, 4, 5, 6, 6, 6, 7, 7, 7], produces: 'gold',
    rate: [600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9200],
    desc: 'Digs gold out of the desert cliffs. Tap it to collect.',
  });
  def('goopWell', {
    name: 'Goop Well', size: 3, cat: 'resource', costRes: 'gold', cf: 0.6, hp: 420,
    counts: [1, 2, 3, 4, 5, 6, 6, 6, 7, 7, 7], produces: 'goop',
    rate: [600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9200],
    desc: 'Pumps sacred green goop up from the Nile mud. Tap it to collect.',
  });
  def('treasury', {
    name: 'Treasury', size: 3, cat: 'resource', costRes: 'goop', cf: 1, hp: 800,
    counts: [1, 1, 2, 2, 2, 2, 2, 3, 4, 4, 4], stores: 'gold',
    storage: [1500, 4500, 12000, 30000, 70000, 150000, 300000, 500000, 750000, 1000000, 1500000],
    desc: 'Stores gold. Raiders steal from it, so protect it with walls.',
  });
  def('goopJar', {
    name: 'Goop Jar', size: 3, cat: 'resource', costRes: 'gold', cf: 1, hp: 800,
    counts: [1, 1, 2, 2, 2, 2, 2, 3, 4, 4, 4], stores: 'goop',
    storage: [1500, 4500, 12000, 30000, 70000, 150000, 300000, 500000, 750000, 1000000, 1500000],
    desc: 'A huge clay jar of goop. Raiders steal from it, so protect it with walls.',
  });

  // ---------- Army ----------
  def('barracks', {
    name: 'Barracks', size: 3, cat: 'army', costRes: 'goop', cf: 0.9, hp: 500,
    counts: [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
    desc: 'Trains troops. Each level unlocks new troops; more barracks train faster.',
  });
  def('armyCamp', {
    name: 'Army Camp', size: 4, cat: 'army', costRes: 'goop', cf: 1, hp: 300,
    counts: [1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 4],
    housing: [20, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
    desc: 'Your trained troops wait here. Upgrade it to hold a bigger army.',
  });
  def('temple', {
    name: 'Temple of Ra', size: 3, cat: 'army', costRes: 'goop', cf: 1.5, hp: 600,
    counts: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    desc: 'Priests research stronger troops here. Its level limits how far troops can be upgraded.',
  });
  def('royalHall', {
    name: 'Royal Hall', size: 3, cat: 'army', costRes: 'gold', cf: 1.5, hp: 1000,
    counts: [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    guards: [3, 5, 7, 9, 11, 13, 15, 18, 21, 24, 28],
    desc: 'Royal guards burst out to defend your town when raiders come close.',
  });

  // ---------- Defenses ----------
  // dmg is per hit at level 1, rate is seconds between hits. grows 22% per level.
  def('ballista', {
    name: 'Ballista', size: 3, cat: 'defense', costRes: 'gold', cf: 1, hp: 420,
    counts: [2, 2, 2, 3, 3, 4, 5, 5, 6, 7, 7],
    range: 9, dmg: 8, rate: 0.8, ground: true, air: false, proj: 'bolt',
    desc: 'A giant crossbow that shoots ground troops.',
  });
  def('archerTower', {
    name: 'Archer Tower', size: 3, cat: 'defense', costRes: 'gold', cf: 1.1, hp: 400,
    counts: [0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 8],
    range: 10, dmg: 11, rate: 1.0, ground: true, air: true, proj: 'arrow',
    desc: 'Long-range archers that hit ground and air troops.',
  });
  def('catapult', {
    name: 'Catapult', size: 3, cat: 'defense', costRes: 'gold', cf: 1.4, hp: 400,
    counts: [0, 0, 1, 1, 1, 2, 3, 3, 4, 4, 4],
    range: 11, minRange: 4, dmg: 22, rate: 5, splash: 1.5, ground: true, air: false, proj: 'stone',
    desc: 'Hurls boulders that crush groups of ground troops. It cannot hit troops right next to it.',
  });
  def('falconPerch', {
    name: 'Falcon Perch', size: 3, cat: 'defense', costRes: 'gold', cf: 1.5, hp: 800,
    counts: [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4],
    range: 10, dmg: 80, rate: 1.0, ground: false, air: true, proj: 'falcon',
    desc: 'Sacred falcons dive at flying troops. Deadly to air, harmless to ground.',
  });
  def('brazier', {
    name: 'Fire Brazier', size: 2, cat: 'defense', costRes: 'gold', cf: 1.5, hp: 500,
    counts: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3],
    range: 5, dmg: 28, rate: 1.0, splash: 1.3, ground: true, air: true, proj: 'flame',
    desc: 'Sprays fire at everything close by.',
  });
  def('eyeHorus', {
    name: 'Eye of Horus', size: 3, cat: 'defense', costRes: 'gold', cf: 1.6, hp: 600,
    counts: [0, 0, 0, 0, 1, 2, 2, 3, 3, 4, 4],
    range: 7, dmg: 24, rate: 1.3, splash: 1.1, ground: true, air: true, proj: 'orb',
    desc: 'A magic eye that blasts groups of ground and air troops.',
  });
  def('obelisk', {
    name: 'Obelisk of Ra', size: 2, cat: 'defense', costRes: 'gold', cf: 1.8, hp: 700,
    counts: [0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3],
    range: 9, dmg: 150, rate: 2.5, ground: true, air: true, proj: 'beam',
    desc: 'Gathers sunlight and fires a scorching beam at one troop.',
  });
  def('anubis', {
    name: 'Anubis Statue', size: 2, cat: 'defense', costRes: 'gold', cf: 1.9, hp: 900,
    counts: [0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 3],
    range: 3.5, dmg: 90, rate: 1.6, splash: 2, ground: true, air: false, proj: 'slam',
    desc: 'A guardian statue that wakes and smashes ground troops that come too close.',
  });
  def('sphinx', {
    name: 'Sphinx', size: 3, cat: 'defense', costRes: 'gold', cf: 2.4, hp: 1500,
    counts: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2],
    range: 9, dmg: 6, rate: 0.1, ramp: true, ground: true, air: true, proj: 'ray',
    desc: 'Its stare burns hotter the longer it locks onto one troop.',
  });
  def('sunDisk', {
    name: 'Sun Disk Tower', size: 3, cat: 'defense', costRes: 'gold', cf: 3, hp: 3500,
    counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    range: 14, minRange: 5, dmg: 200, rate: 6, splash: 2, shots: 3, ground: true, air: true, proj: 'sun',
    desc: 'Calls down three blazing sun strikes at a time, anywhere in its huge range.',
  });
  def('wall', {
    name: 'Wall', size: 1, cat: 'wall', costRes: 'gold', cf: 0.12, hp: 300,
    counts: [0, 25, 50, 75, 100, 125, 175, 225, 250, 275, 300],
    desc: 'Keeps ground troops out. Troops have to break through or walk around.',
  });

  // ---------- Traps ----------
  def('scarabTrap', {
    name: 'Scarab Trap', size: 1, cat: 'trap', costRes: 'gold', cf: 0.4, hp: 0,
    counts: [0, 0, 2, 2, 4, 4, 6, 6, 6, 6, 6],
    trigger: 1.5, dmg: 35, splash: 1.6, ground: true, air: false,
    desc: 'Hidden. A swarm of scarabs erupts and bites every ground troop nearby.',
  });
  def('quicksand', {
    name: 'Quicksand', size: 1, cat: 'trap', costRes: 'gold', cf: 0.5, hp: 0,
    counts: [0, 0, 0, 1, 2, 2, 3, 3, 4, 4, 4],
    trigger: 1.2, dmg: 12, splash: 2, slow: 0.5, duration: 6, ground: true, air: false,
    desc: 'Hidden. Sinks ground troops, slowing them down and hurting them for 6 seconds.',
  });
  def('falconNet', {
    name: 'Falcon Net', size: 1, cat: 'trap', costRes: 'gold', cf: 0.6, hp: 0,
    counts: [0, 0, 0, 0, 1, 2, 2, 3, 4, 4, 4],
    trigger: 4, dmg: 300, ground: false, air: true,
    desc: 'Hidden. Snares one flying troop and hits it hard.',
  });
  def('cobraPit', {
    name: 'Cobra Pit', size: 1, cat: 'trap', costRes: 'gold', cf: 0.7, hp: 0,
    counts: [0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3],
    trigger: 1, dmg: 600, ground: true, air: false,
    desc: 'Hidden. A giant cobra strikes the first ground troop that steps on it.',
  });

  const BUILDING_ORDER = Object.keys(B);
  const SHOP_CATS = [
    { id: 'resource', name: 'Resources' },
    { id: 'army', name: 'Army' },
    { id: 'defense', name: 'Defenses' },
    { id: 'wall', name: 'Walls' },
    { id: 'trap', name: 'Traps' },
  ];

  // Derived tables -----------------------------------------------------------
  for (const id of BUILDING_ORDER) {
    const b = B[id];
    b.unlock = b.counts.findIndex((c) => c > 0) + 1;
    b.isDefense = b.cat === 'defense';
    b.isTrap = b.cat === 'trap';
    b.isWall = b.cat === 'wall';
    b.isResource = !!(b.produces || b.stores || id === 'pyramid');
  }

  function countAllowed(id, ph) { return B[id].counts[Math.min(ph, MAX_PH) - 1] || 0; }

  // Every building gains new levels each time the Pyramid levels up, and all
  // of them reach level 11 at Pyramid 11.
  function maxLevel(id, ph) {
    if (id === 'pyramid') return MAX_PH;
    const u = B[id].unlock;
    if (ph < u) return 0;
    return Math.min(11, Math.ceil((ph - u + 1) * 11 / (12 - u)));
  }
  // The Pyramid level needed to reach a building level.
  function pyramidFor(id, level) {
    for (let ph = 1; ph <= MAX_PH; ph++) if (maxLevel(id, ph) >= level) return ph;
    return 99;
  }

  function niceRound(n) {
    if (n < 100) return Math.round(n);
    const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return Math.round(n / p) * p;
  }
  // Pyramid level a building level belongs to (for the Pyramid: the level being built from).
  function tierOf(id, level) { return id === 'pyramid' ? Math.max(1, level - 1) : pyramidFor(id, level); }
  // Upgrades within the same Pyramid tier cost a little more each step.
  function stepInTier(id, level) {
    let i = 0;
    for (let l = level - 1; l >= 1 && tierOf(id, l) === tierOf(id, level); l--) i++;
    return i;
  }
  function upgradeCost(id, level) { // cost to build (level 1) or upgrade to `level`
    if (id === 'pyramid' && level === 1) return 0;
    const t = tierOf(id, level);
    return niceRound(PH_COST[t] * B[id].cf * (1 + 0.25 * stepInTier(id, level)));
  }
  function upgradeTime(id, level) {
    const b = B[id];
    if (b.isWall) return 0;
    const t = id === 'pyramid' ? level : tierOf(id, level);
    const base = BUILD_TIME[t] * (1 + 0.2 * stepInTier(id, level));
    if (b.isTrap) return Math.round(base * 0.3);
    if (id === 'pyramid') return Math.round(base * 1.5);
    return Math.round(base);
  }
  // Strength grows with the Pyramid tier a level belongs to, so a building
  // unlocked late does not get eleven full levels of growth on top of its
  // already-strong base stats.
  function powerLevel(id, level) {
    if (id === 'pyramid') return level;
    return Math.max(1, tierOf(id, level) - B[id].unlock + 1 + 0.4 * stepInTier(id, level));
  }
  function buildingHp(id, level) {
    const b = B[id];
    if (!b.hp) return 0;
    const g = b.isWall ? 1.32 : id === 'pyramid' ? 1.3 : 1.18;
    return Math.round(b.hp * Math.pow(g, powerLevel(id, level) - 1));
  }
  function defenseDmg(id, level) { return B[id].dmg * Math.pow(B[id].isTrap ? 1.2 : 1.17, powerLevel(id, level) - 1); }
  function storageOf(id, level) { return B[id].storage ? B[id].storage[level - 1] : 0; }
  function rateOf(id, level) { return B[id].rate ? B[id].rate[level - 1] : 0; }
  function mineCap(id, level) { return Math.round(rateOf(id, level) * 4); }

  // ---------- Troops ----------
  // target: any | defense | resource | wall. hitsAir: can damage flying troops.
  const T = {};
  const TROOP_ORDER = [];
  function troop(id, o) { o.id = id; T[id] = o; TROOP_ORDER.push(id); return o; }

  troop('spearman', { name: 'Spearman', barracks: 1, housing: 1, hp: 50, dmg: 9, rate: 1, range: 0.6, speed: 1.6, target: 'any', train: 4, cost: 25,
    desc: 'Cheap, brave and quick to train. Attacks whatever is closest.' });
  troop('archer', { name: 'Archer', barracks: 1, housing: 1, hp: 24, dmg: 8, rate: 1, range: 3.5, speed: 1.6, target: 'any', hitsAir: true, train: 5, cost: 50, proj: 'arrow',
    desc: 'Shoots from behind walls. Fragile, so keep her behind tougher troops.' });
  troop('tombRobber', { name: 'Tomb Robber', barracks: 2, housing: 1, hp: 32, dmg: 12, rate: 1, range: 0.6, speed: 2.6, target: 'resource', resMult: 2, train: 5, cost: 40,
    desc: 'Runs straight for gold and goop and does double damage to them.' });
  troop('shieldBearer', { name: 'Shield Bearer', barracks: 2, housing: 5, hp: 340, dmg: 13, rate: 2, range: 0.8, speed: 1.0, target: 'defense', train: 20, cost: 250,
    desc: 'A walking wall with a huge bronze shield. Goes for defenses and soaks up damage.' });
  troop('ramCrew', { name: 'Ram Crew', barracks: 3, housing: 2, hp: 28, dmg: 8, rate: 1, range: 0.5, speed: 2.2, target: 'wall', wallMult: 40, splash: 1.3, suicide: true, train: 12, cost: 300,
    desc: 'Charges the nearest wall with a log ram and smashes it open (breaks the ram too).' });
  troop('falcon', { name: 'Falcon', barracks: 3, housing: 2, hp: 55, dmg: 30, rate: 1, range: 2, speed: 2.6, target: 'any', air: true, hitsAir: true, train: 10, cost: 200, proj: 'feather',
    desc: 'A trained hunting falcon. Flies over walls but is fragile.' });
  troop('sandMage', { name: 'Sand Mage', barracks: 4, housing: 4, hp: 80, dmg: 55, rate: 1.5, range: 3, speed: 1.4, target: 'any', hitsAir: true, splash: 0.9, train: 25, cost: 600, proj: 'sandball',
    desc: 'Hurls whirling sand blasts that hit everything in a small area.' });
  troop('priestess', { name: 'Priestess of Isis', barracks: 4, housing: 10, hp: 480, heal: 38, rate: 1, range: 4, speed: 1.3, target: 'heal', splash: 2, train: 50, cost: 2500,
    desc: 'Heals ground troops around her. She never attacks.' });
  troop('chariot', { name: 'War Chariot', barracks: 5, housing: 5, hp: 280, dmg: 50, rate: 1, range: 0.7, speed: 2.4, target: 'defense', jumpsWalls: true, train: 30, cost: 800,
    desc: 'Races straight for defenses and leaps over walls.' });
  troop('camelArcher', { name: 'Camel Archer', barracks: 5, housing: 3, hp: 115, dmg: 32, rate: 1, range: 4.5, speed: 2.3, target: 'any', hitsAir: true, train: 20, cost: 450, proj: 'arrow',
    desc: 'Fast archer with long range, riding a grumpy camel.' });
  troop('phoenix', { name: 'Phoenix', barracks: 6, housing: 20, hp: 1900, dmg: 150, rate: 1.4, range: 3, speed: 1.9, target: 'any', air: true, hitsAir: true, splash: 0.9, train: 120, cost: 7000, proj: 'fire',
    desc: 'A blazing firebird that burns everything below it.' });
  troop('mummy', { name: 'Mummy', barracks: 6, housing: 6, hp: 420, dmg: 42, rate: 1.2, range: 0.7, speed: 1.3, target: 'any', splitOnDeath: 2, train: 40, cost: 1400,
    desc: 'Shambles forward and splits into two small mummies when it falls.' });
  troop('warElephant', { name: 'War Elephant', barracks: 7, housing: 25, hp: 4600, dmg: 36, rate: 2, range: 1, speed: 0.9, target: 'defense', deathBlast: 160, splash: 2, train: 160, cost: 8000,
    desc: 'An enormous armoured elephant. Takes huge punishment and tramples when it falls.' });
  troop('anubisWarrior', { name: 'Anubis Warrior', barracks: 8, housing: 25, hp: 2900, dmg: 380, rate: 1.8, range: 0.9, speed: 1.3, target: 'any', train: 170, cost: 9000,
    desc: 'A jackal-headed champion whose khopesh splits stone.' });
  troop('skyBarge', { name: 'Sky Barge', barracks: 9, housing: 6, hp: 420, dmg: 160, rate: 2.5, range: 0.5, speed: 1.3, target: 'defense', air: true, splash: 1.2, train: 45, cost: 1800, proj: 'bomb',
    desc: 'A flying reed boat that drops fire pots on defenses.' });
  troop('sobekBrute', { name: 'Sobek Brute', barracks: 10, housing: 15, hp: 2100, dmg: 140, rate: 1.4, range: 1.1, speed: 1.4, target: 'any', splash: 1.5, train: 110, cost: 5000,
    desc: 'A crocodile-headed giant whose tail sweeps a wide arc.' });
  troop('champion', { name: "Pharaoh's Champion", barracks: 11, housing: 30, hp: 4200, dmg: 220, rate: 1, range: 1, speed: 1.6, target: 'any', aura: 0.25, auraRange: 5, train: 240, cost: 12000,
    desc: 'Leads from the front. Every troop near him hits 25% harder.' });

  // Not trainable: spawned when a mummy falls, and used by the Royal Hall guards.
  const MINI_MUMMY = { id: 'miniMummy', name: 'Small Mummy', housing: 0, hp: 130, dmg: 16, rate: 1, range: 0.6, speed: 1.6, target: 'any' };

  const TROOP_LEVEL_GROWTH = 1.15;
  function troopStat(t, level, stat) {
    const base = (T[t] || MINI_MUMMY)[stat];
    if (base == null) return 0;
    return base * Math.pow(TROOP_LEVEL_GROWTH, level - 1);
  }
  function troopCost(t, level) { return niceRound(T[t].cost * Math.pow(1.08, level - 1)); }
  function troopMaxLevel(templeLevel) { return Math.min(11, 1 + templeLevel); }
  function researchCost(t, level) {
    const tier = Math.min(11, Math.max(T[t].barracks, level - 1));
    return niceRound(PH_COST[tier] * (0.8 + T[t].housing / 25) * (1 + 0.1 * Math.max(0, level - 1 - T[t].barracks)));
  }
  function researchTime(t, level) { return Math.round(BUILD_TIME[Math.min(11, Math.max(T[t].barracks, level - 1))] * 0.8); }

  // ---------- Loot ----------
  const LOOT = [190, 600, 1500, 3500, 7000, 13000, 22000, 35000, 55000, 80000, 110000];
  function lootFor(myPh, targetPh, friendly) {
    const d = targetPh - myPh;
    let mult = d >= 0 ? 1 + 0.2 * d : Math.max(0.1, 1 + 0.25 * d);
    const amount = Math.round(LOOT[targetPh - 1] * mult);
    let gems = friendly ? 0 : d >= 0 ? 3 + 2 * d : d === -1 ? 1 : 0;
    return { gold: amount, goop: amount, gems };
  }
  const NEXT_COST = [10, 25, 60, 120, 200, 300, 450, 600, 800, 1000, 1200];

  const BUILDER_GEM_COST = [0, 0, 75, 150, 250]; // 3rd, 4th and 5th builders
  const START = { gold: 1000, goop: 1000, gems: 25 };

  // ---------- Rival player names ----------
  const NAMES = [
    'Thomas Quirk', 'Amanda Abbott', 'William Emerson', '柯老师',
    'Priya Raman', 'Lucas Moreau', 'Hannah Becker', 'Mateo Alvarez', 'Sofia Lindqvist',
    'Kenji Watanabe', 'Olivia Hartley', 'Noah Fitzgerald', 'Amara Okafor', 'Ethan Caldwell',
    'Isabella Rossi', "Liam O'Connell", 'Yuki Tanaka', 'Chloe Dubois', 'Benjamin Strand',
    'Fatima Haddad', 'Jack Pemberton', 'Mia Novak', 'Daniel Kowalski', 'Grace Whitfield',
    'Omar Saleh', 'Zoe Marchetti', 'Samuel Okoye', 'Lily Thornton', 'Arjun Mehta',
    'Emma Vasquez', 'Henry Lockwood', 'Ava Petrov', 'Leo Brandt', 'Nora Lindgren',
    'Ravi Kapoor', 'Ella Montgomery', 'Oscar Nilsson', 'Layla Rahman', 'Felix Wagner',
    'Ruby Callahan', 'Hugo Laurent', 'Aisha Bello', 'Max Hoffmann', 'Clara Jensen',
    'Diego Navarro', 'Ivy Sinclair', 'Tariq Aziz', 'Freya Holm', 'Gabriel Costa',
    'Maya Goldberg', 'Theo Ramsay', 'Leah Brennan', 'Wei Zhang', 'Sara Eriksen',
    '王芳', '李娜', '陈静', '刘洋', '佐藤 健',
    '김민준', '이서연', 'Nguyen Van An', 'Tran Thi Mai', 'Ahmed Mansour',
    'Youssef El-Masry', 'Nadia Farouk', 'Kwame Mensah', 'Chidi Nwosu', 'Ingrid Solberg',
    'Pierre Lefèvre', 'Giulia Bianchi', 'Andrei Popescu', 'Katarzyna Wiśniewska', 'Mehmet Yılmaz',
    'Elif Demir', 'Rafael Mendes', 'Camila Ortiz', 'Santiago Herrera', 'Valentina Cruz',
    'Aleksandr Volkov', 'Anya Sokolova', 'Lars Pedersen', 'Sanne de Vries', 'Ruairi Doyle',
    'Siobhan Kelly', 'Malik Johnson', 'Jasmine Carter', 'Tyler Brooks', 'Megan Foster',
    'Connor Hughes', 'Abigail Turner', 'Marcus Bennett', 'Harper Quinn', 'Declan Ward',
    'Poppy Harrington', 'Rohan Desai', 'Ananya Iyer', 'Tomás Ferreira', 'Beatriz Santos',
    'Kai Nakamura', 'Leilani Kahale', 'Ezra Whitman', 'Rosalind Fairweather', 'Desmond Okeke',
  ];
  const CLAN_NAMES = ['Sons of Set', 'Nile Raiders', 'Golden Scarabs', 'Desert Falcons', 'Children of Ra',
    'Lotus Guard', 'Sand Serpents', 'Thebes United', 'Memphis Elite', 'Jackals of Anubis', 'Eye of Horus',
    'Ibis Order', 'Red Land Clan', 'Black Land Clan', 'Sphinx Watch', 'Papyrus Club'];

  const LEAGUES = [
    { min: 0, name: 'Unranked' }, { min: 100, name: 'Bronze Scarab' }, { min: 400, name: 'Silver Ibis' },
    { min: 800, name: 'Gold Falcon' }, { min: 1400, name: 'Lapis' }, { min: 2000, name: 'Electrum' },
    { min: 2800, name: 'Pharaoh League' },
  ];
  function leagueOf(trophies) {
    let l = LEAGUES[0];
    for (const x of LEAGUES) if (trophies >= x.min) l = x;
    return l.name;
  }

  G.D = {
    MAX_PH, MAP, EDGE, MATERIALS, B, BUILDING_ORDER, SHOP_CATS, T, TROOP_ORDER, MINI_MUMMY,
    countAllowed, maxLevel, pyramidFor, upgradeCost, upgradeTime, buildingHp, defenseDmg,
    storageOf, rateOf, mineCap, troopStat, troopCost, troopMaxLevel, researchCost, researchTime,
    lootFor, NEXT_COST, PH_COST, BUILDER_GEM_COST, START, NAMES, CLAN_NAMES, leagueOf, BUILD_TIME, niceRound,
  };
})(globalThis.SOTP = globalThis.SOTP || {});
