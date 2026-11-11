/* Kingdom Clash: the cards. Stats are level 1; every level adds 8% to HP and damage (level 15 is
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
    evo: 'Frostbite: targets are slowed 15% for 3 seconds.',
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
};

// Every card in collection order: the starter deck, then cards found on the Trophy Road.
const KC_ALL_CARDS = ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball', 'skeletons', 'cannon', 'spears', 'footmen', 'flail', 'pots'];

const KC_STARTER_DECK = ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'];
