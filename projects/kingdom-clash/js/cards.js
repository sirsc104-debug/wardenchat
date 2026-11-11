/* Kingdom Clash: the cards. A card with `art` has an illustrated card picture (img/card_*.webp); the
   rest are drawn in code (js/art.js). Either way the troops in battle are drawn in code.
   Kingdom Clash: the cards. Stats are level 1; every level adds 8% to HP and damage (level 15 is
   about 2.9x level 1). Kinds: troop, spell and building (a building stays where it is placed, attacks
   what comes in range and loses health over its lifetime). Distances are in arena tiles, speeds in tiles per second, times in seconds. */
'use strict';

const KC_CARDS = {
  rhino: {
    id: 'rhino', name: 'Rhino', cost: 5, rarity: 'rare', kind: 'troop', role: 'Tank', count: 1,
    hp: 2000, dmg: 120, hit: 1.5, range: 0.7, speed: 0.75, targets: 'buildings', air: false,
    radius: 0.8, mass: 10, heavy: true,
    blurb: 'A big armored rhino. It ignores troops and charges straight for towers.',
    evo: 'Trample: damages small troops it runs through.',
  },
  wolves: {
    id: 'wolves', name: 'Wolves', cost: 2, rarity: 'common', kind: 'troop', role: 'Swarm', count: 4,
    hp: 80, dmg: 45, hit: 1.0, range: 0.4, speed: 1.8, targets: 'ground', air: false,
    radius: 0.36, mass: 1,
    blurb: 'A pack of four fast wolves. Great for swarming one big troop.',
    evo: 'Pack Howl: they bite faster while 2 or more are alive.',
  },
  gladiator: {
    id: 'gladiator', name: 'Gladiator', cost: 3, rarity: 'common', kind: 'troop', role: 'Mini tank', count: 1,
    hp: 900, dmg: 80, hit: 1.2, range: 0.5, speed: 1.0, targets: 'ground', air: false,
    radius: 0.55, mass: 4,
    blurb: 'An arena fighter with a round shield. Tough for its cost.',
    evo: 'Taunt, and a shield that bounces the first hit back.',
  },
  hawks: {
    id: 'hawks', name: 'Hawks', cost: 3, rarity: 'common', kind: 'troop', role: 'Air', count: 2,
    hp: 180, dmg: 40, hit: 1.1, range: 2.0, speed: 1.5, targets: 'both', air: true,
    radius: 0.42, mass: 1,
    blurb: 'Two hawks that dive from above. Ground troops with swords can’t reach them.',
    evo: 'Dive: the first attack does double damage.',
  },
  archers: {
    id: 'archers', name: 'Archers', cost: 3, rarity: 'common', kind: 'troop', role: 'Ranged', count: 2,
    hp: 230, dmg: 60, hit: 0.9, range: 4.5, speed: 1.0, targets: 'both', air: false,
    radius: 0.42, mass: 1.5, proj: 'arrow', projSpeed: 13,
    blurb: 'Two archers that shoot ground and air troops from a safe distance.',
    evo: 'Ricochet: arrows bounce to a second target.',
  },
  snowman: {
    id: 'snowman', name: 'Snowman', cost: 4, rarity: 'rare', kind: 'troop', role: 'Splash', count: 1,
    hp: 420, dmg: 110, hit: 1.6, range: 5.5, speed: 1.0, targets: 'both', air: false,
    radius: 0.55, mass: 3, proj: 'snowball', projSpeed: 8, splash: 1.1,
    blurb: 'Throws big snowballs that hit everything they land near, in the air or on the ground.',
    evo: 'Giant Snowballs: every third Snowman you play throws snowballs 1.5x the size, 1.5x as fast, for the same damage.',
  },
  gorilla: {
    id: 'gorilla', name: 'Gorilla', cost: 4, rarity: 'rare', kind: 'troop', role: 'Tank killer', count: 1,
    hp: 900, dmg: 300, hit: 1.4, range: 0.6, speed: 1.5, targets: 'ground', air: false,
    radius: 0.65, mass: 5,
    blurb: 'A silverback that hits incredibly hard. The best answer to a Rhino.',
    evo: 'Chest Pound: every third hit does double damage.',
  },
  fireball: {
    id: 'fireball', name: 'Fireball', cost: 4, rarity: 'rare', kind: 'spell', role: 'Spell', count: 1,
    dmg: 320, area: 2.5, towerPct: 0.3, projSpeed: 15, knockback: 1.0,
    blurb: 'Launches a fireball from your King Tower. Damages and knocks back everything in the area.',
    evo: 'Leaves burning ground for 2 seconds.',
  },
  // Arena 1 (Cinder Keep) cards, found on the Trophy Road.
  skeletons: {
    id: 'skeletons', name: 'Skeleton Pack', cost: 1, rarity: 'common', kind: 'troop', role: 'Swarm', count: 3,
    hp: 40, dmg: 40, hit: 1.0, range: 0.4, speed: 1.5, targets: 'ground', air: false,
    radius: 0.3, mass: 0.8,
    blurb: 'Three rattling skeletons for just 1 energy. Great for distracting a big troop or finishing one off.',
    evo: 'Reassemble: one skeleton rises again a second after the last one falls.',
  },
  cannon: {
    id: 'cannon', name: 'Cannon', cost: 3, rarity: 'common', kind: 'building', role: 'Defense', count: 1,
    hp: 700, dmg: 70, hit: 0.9, range: 5.5, targets: 'ground', air: false,
    radius: 0.9, half: 0.95, lifetime: 30, proj: 'cannon', projSpeed: 12,
    blurb: 'A sturdy cannon that guards your side. Rhinos go for it before your towers. It crumbles after 30 seconds.',
    evo: 'Overcharge: its first shot at each new target does double damage.',
  },
  // Arena 2 (Briar Hollow) cards, found on the Trophy Road.
  spears: {
    id: 'spears', name: 'Spears', cost: 3, rarity: 'common', kind: 'spell', role: 'Spell', count: 1,
    dmg: 185, area: 3.5, towerPct: 0.3, projSpeed: 19, projKind: 'spears',
    blurb: 'A volley of spears rains down on a wide area, hitting ground and flying troops. Clears swarms in one go.',
    evo: 'Second Volley: a lighter second wave lands a moment later.',
  },
  footmen: {
    id: 'footmen', name: 'Footmen', cost: 5, rarity: 'common', kind: 'troop', role: 'Group', count: 4,
    hp: 420, dmg: 85, hit: 1.3, range: 0.55, speed: 1.0, targets: 'ground', air: false,
    radius: 0.5, mass: 3,
    blurb: 'Four armored soldiers with swords and small shields. They chop down tanks but fear splash damage.',
    evo: 'Shield Wall: the front two block the first hit each takes.',
  },
  flail: {
    id: 'flail', name: 'Flail Knight', cost: 4, rarity: 'rare', kind: 'troop', role: 'Splash tank', count: 1,
    hp: 1150, dmg: 150, hit: 1.7, range: 0.9, speed: 1.0, targets: 'ground', air: false,
    radius: 0.62, mass: 5, spin: 1.6,
    blurb: 'A sturdy knight who swings a spiked ball in a full circle, hitting every ground enemy around him.',
    evo: 'Whirlwind: every third swing pulls nearby enemies in.',
  },
  pots: {
    id: 'pots', name: 'Pot Thrower', cost: 2, rarity: 'common', kind: 'troop', role: 'Splash', count: 1,
    hp: 150, dmg: 88, hit: 2.2, range: 4.5, speed: 1.0, targets: 'ground', air: false,
    radius: 0.42, mass: 1.5, proj: 'pot', projSpeed: 7, splash: 1.1, zone: { r: 1.0, dps: 40, dur: 0.5 },
    blurb: 'Throws clay pots that shatter on ground troops. The broken pottery keeps hurting the spot for half a second.',
    evo: 'Fire Pots: every other pot leaves burning oil instead.',
  },
  // Arena 3 (Sunstone Arena) cards, found on the Trophy Road.
  sandstorm: {
    id: 'sandstorm', name: 'Sandstorm', cost: 3, rarity: 'common', kind: 'spell', role: 'Spell', count: 1,
    dmg: 180, area: 3.0, towerPct: 0.35, storm: { dur: 3, slow: 0.25 },
    blurb: 'A swirling sandstorm over an area for 3 seconds. It wears down enemy troops on the ground and in the air, and slows them by 25%.',
    evo: 'Dune: the storm grows a little each second.',
  },
  ramcart: {
    id: 'ramcart', name: 'Ram Cart', cost: 4, rarity: 'rare', kind: 'troop', role: 'Win condition', count: 1,
    hp: 1100, dmg: 200, hit: 1, range: 0.6, speed: 1.0, targets: 'buildings', air: false,
    radius: 0.75, mass: 8, ram: { max: 2.3, accel: 0.75 }, onEnd: { card: 'ramsoldier', count: 2 },
    blurb: 'Two soldiers push a battering ram with a golden ram\'s head. It speeds up as it rolls and hits the first building it reaches for up to double damage, then the soldiers jump out and fight on.',
    evo: 'Second Wind: the soldiers come out with a shield each.',
  },
  // the two soldiers who push the Ram Cart (not a card of their own)
  ramsoldier: {
    id: 'ramsoldier', name: 'Cart Soldier', cost: 0, rarity: 'rare', kind: 'troop', role: 'Melee', count: 1, hidden: true,
    hp: 340, dmg: 80, hit: 1.2, range: 0.5, speed: 1.2, targets: 'ground', air: false,
    radius: 0.42, mass: 2,
    blurb: 'A soldier from the Ram Cart.', evo: '',
  },
  mole: {
    id: 'mole', name: 'Mole', cost: 3, rarity: 'rare', kind: 'troop', role: 'Tunneler', count: 1,
    hp: 380, dmg: 75, hit: 1.2, range: 0.55, speed: 1.0, targets: 'ground', air: false,
    radius: 0.48, mass: 3, anywhere: true, burrow: { speed: 5, surface: 0.7 }, towerDmg: 0.25,
    blurb: 'Place it anywhere, even on the other side. It digs from your King Tower to the spot, can\'t be hit while tunneling, then bursts out and fights. Hits towers for less.',
    evo: 'Cave-in: surfacing stuns enemies around it for half a second.',
  },
  camel: {
    id: 'camel', name: 'Camel Jockey', cost: 5, rarity: 'legendary', kind: 'troop', role: 'Win condition', count: 1,
    hp: 1150, dmg: 150, hit: 1.8, range: 0.7, speed: 1.5, targets: 'buildings', air: false,
    radius: 0.75, mass: 8, chargeHit: 2.5,
    rider: { dmg: 45, hit: 1.3, range: 5, slow: 0.5, slowDur: 1.6, slowCd: 4 },
    blurb: 'A camel gallops for buildings and hits hard, double on the first hit after a run. Its rider lassos troops along the way, slowing them for a moment (once every 4 seconds).',
    evo: 'Mirage: the first lasso of the match pulls its target in.',
  },
  // Arena 4 (Stormspire) cards, found on the Trophy Road.
  bees: {
    id: 'bees', name: 'Bees', cost: 2, rarity: 'common', kind: 'troop', role: 'Air swarm', count: 5, art: 'img/card_bees.webp',
    hp: 50, dmg: 40, hit: 0.75, range: 0.4, speed: 2.0, targets: 'both', air: true,
    radius: 0.28, mass: 0.5,
    blurb: 'A buzzing swarm of five angry bees. Fast, cheap and fragile: they sting anything, in the air or on the ground.',
    evo: 'Hive: one bee comes back once the swarm is gone.',
  },
  owl: {
    id: 'owl', name: 'Owl', cost: 4, rarity: 'rare', kind: 'troop', role: 'Air ranged', count: 1, art: 'img/card_owl.webp',
    hp: 640, dmg: 135, hit: 1.1, range: 6, speed: 0.9, targets: 'both', air: true,
    radius: 0.55, mass: 3, proj: 'quill', projSpeed: 14,
    blurb: 'An armored battle owl that fires steel-tipped quills from high up, at troops and towers alike. Slow, but it hits from far away.',
    evo: 'Night Vision: its first quill at each target does double damage.',
  },
  thundercloud: {
    id: 'thundercloud', name: 'Thunder Cloud', cost: 5, rarity: 'epic', kind: 'troop', role: 'Win condition', count: 1, art: 'img/card_thundercloud.webp',
    hp: 1050, dmg: 480, hit: 2.6, range: 0.3, speed: 0.85, targets: 'buildings', air: true,
    radius: 0.8, mass: 6, strike: 1.2, deathBlast: { r: 2.2, dmg: 150 },
    blurb: 'A slow storm cloud that drifts straight for buildings and calls down lightning on them. When it is destroyed it bursts in a final thunderclap.',
    evo: 'Downpour: rain slows ground troops under it.',
  },
  griffin: {
    id: 'griffin', name: 'Griffin', cost: 4, rarity: 'legendary', kind: 'troop', role: 'Tank killer', count: 1, art: 'img/card_griffin.webp',
    hp: 950, dmg: 40, hit: 0.2, range: 3.5, speed: 1.0, targets: 'both', air: true,
    radius: 0.65, mass: 4, beam: { dps: [40, 120, 360], stage: 2 },
    blurb: 'A storm griffin that locks a lightning beam on one target. The longer the beam holds, the harder it hits; it starts over when it changes target or is knocked away.',
    evo: 'Static: the beam jumps to a second target at full power.',
  },
};

// Evolutions: each has its own unlock (shards) and how often it comes round in a battle (every
// cycle-th play of the card is the evolved one). Only the Snowman's is built so far.
const KC_EVOS = {
  snowman: { shards: 6, cycle: 3, name: 'Snowman Evolution', projSpeed: 1.5, splash: 1.5, size: 1.5,
    blurb: 'Every third Snowman you play is evolved: its snowballs are 1.5x the size and 1.5x as fast, for the same damage.' },
};

// Every card in collection order: the starter deck, then cards found on the Trophy Road.
const KC_ALL_CARDS = ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball', 'skeletons', 'cannon', 'spears', 'footmen', 'flail', 'pots',
  'sandstorm', 'ramcart', 'mole', 'camel', 'bees', 'owl', 'thundercloud', 'griffin'];

const KC_STARTER_DECK = ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'];
