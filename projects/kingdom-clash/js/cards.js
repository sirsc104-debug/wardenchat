/* Kingdom Clash: the cards. Stats are level 1; every level adds 8% to HP and damage (level 15 is
   about 2.9x level 1). Distances are in arena tiles, speeds in tiles per second, times in seconds. */
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
};

const KC_STARTER_DECK = ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'];
