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
    evo: 'Pack Howl: they bite about 50% faster while two or more are close together.',
  },
  gladiator: {
    id: 'gladiator', name: 'Gladiator', cost: 3, rarity: 'common', kind: 'troop', role: 'Mini tank', count: 1,
    hp: 900, dmg: 80, hit: 1.2, range: 0.5, speed: 1.0, targets: 'ground', air: false,
    radius: 0.55, mass: 4,
    blurb: 'An arena fighter with a round shield. Tough for its cost.',
    evo: 'Shield Bash: arrives with a shield, and bashes the enemies round it when the shield breaks.',
  },
  hawks: {
    id: 'hawks', name: 'Hawks', cost: 3, rarity: 'common', kind: 'troop', role: 'Air', count: 2,
    hp: 180, dmg: 40, hit: 1.1, range: 2.0, speed: 1.5, targets: 'both', air: true,
    radius: 0.42, mass: 1,
    blurb: 'Two hawks that dive from above. Ground troops with swords can’t reach them.',
    evo: 'Dive: each hawk\'s first strike on a new target does double damage.',
  },
  archers: {
    id: 'archers', name: 'Archers', cost: 3, rarity: 'common', kind: 'troop', role: 'Ranged', count: 2,
    hp: 230, dmg: 60, hit: 0.9, range: 4.5, speed: 1.0, targets: 'both', air: false,
    radius: 0.42, mass: 1.5, proj: 'arrow', projSpeed: 13,
    blurb: 'Two archers that shoot ground and air troops from a safe distance.',
    evo: 'Ricochet: each arrow bounces on to another enemy nearby for 45% damage.',
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
    id: 'bees', name: 'Bees', cost: 2, rarity: 'common', kind: 'troop', role: 'Air swarm', count: 5,
    hp: 50, dmg: 40, hit: 0.75, range: 0.4, speed: 2.0, targets: 'both', air: true,
    radius: 0.28, mass: 0.5,
    blurb: 'A buzzing swarm of five angry bees. Fast, cheap and fragile: they sting anything, in the air or on the ground.',
    evo: 'Hive: one bee comes back once the swarm is gone.',
  },
  owl: {
    id: 'owl', name: 'Owl', cost: 4, rarity: 'rare', kind: 'troop', role: 'Air ranged', count: 1,
    hp: 640, dmg: 135, hit: 1.1, range: 6, speed: 0.9, targets: 'both', air: true,
    radius: 0.55, mass: 3, proj: 'quill', projSpeed: 14,
    blurb: 'An armored battle owl that fires steel-tipped quills from high up, at troops and towers alike. Slow, but it hits from far away.',
    evo: 'Night Vision: its first quill at each target does double damage.',
  },
  thundercloud: {
    id: 'thundercloud', name: 'Thunder Cloud', cost: 5, rarity: 'epic', kind: 'troop', role: 'Win condition', count: 1,
    hp: 1050, dmg: 480, hit: 2.6, range: 0.3, speed: 0.85, targets: 'buildings', air: true,
    radius: 0.8, mass: 6, strike: 1.2, deathBlast: { r: 2.2, dmg: 150 },
    blurb: 'A slow storm cloud that drifts straight for buildings and calls down lightning on them. When it is destroyed it bursts in a final thunderclap.',
    evo: 'Downpour: rain slows ground troops under it.',
  },
  griffin: {
    id: 'griffin', name: 'Griffin', cost: 4, rarity: 'legendary', kind: 'troop', role: 'Tank killer', count: 1,
    hp: 950, dmg: 40, hit: 0.2, range: 3.5, speed: 1.0, targets: 'both', air: true,
    radius: 0.65, mass: 4, beam: { dps: [40, 120, 360], stage: 2 },
    blurb: 'A storm griffin that locks a lightning beam on one target. The longer the beam holds, the harder it hits; it starts over when it changes target or is knocked away.',
    evo: 'Static: the beam jumps to a second target at full power.',
  },

  /* Arenas 5 to 10. Each works like a well-known card from the genre; its numbers are the reference card's
     tournament-level stats brought to this game's level-1 scale (health x0.69, damage x0.46, buildings a
     little sturdier), so they sit beside the cards above. Units a card brings with it are hidden cards. */
  // Arena 5: Frostfang Keep
  frostsprite: {
    id: 'frostsprite', name: 'Frost Sprite', cost: 1, rarity: 'common', kind: 'troop', role: 'Freeze', count: 1,
    hp: 160, dmg: 51, hit: 0.3, range: 2.5, speed: 2.0, targets: 'both', air: false,
    radius: 0.32, mass: 0.6, leap: { r: 1.5, stun: 1.2, speed: 7 },
    blurb: 'A tiny ice creature that leaps onto the first enemy it sees and bursts, freezing everything around it for a moment.',
  },
  icegiant: {
    id: 'icegiant', name: 'Icebound Giant', cost: 2, rarity: 'rare', kind: 'troop', role: 'Mini tank', count: 1,
    hp: 830, dmg: 39, hit: 2.5, range: 0.75, speed: 0.75, targets: 'buildings', air: false,
    radius: 0.7, mass: 7, deathBlast: { r: 2.0, dmg: 39, air: true, slow: 0.35, slowDur: 1 },
    blurb: 'A slow giant of packed ice that only walks for buildings, soaking up hits. When it shatters it slows everything around it.',
  },
  wintersage: {
    id: 'wintersage', name: 'Winter Sage', cost: 3, rarity: 'legendary', kind: 'troop', role: 'Slow splash', count: 1,
    hp: 475, dmg: 42, hit: 1.7, range: 5.5, speed: 1.0, targets: 'both', air: false,
    radius: 0.48, mass: 2.5, proj: 'frostbolt', projSpeed: 9, splash: 1.0, slowHit: { f: 0.35, dur: 2.5 },
    deployBlast: { r: 3, dmg: 42 },
    blurb: 'A frost-bearded sage whose icy bolts hit a small area and slow everything they touch. He arrives in a gust of frost.',
  },
  flashfreeze: {
    id: 'flashfreeze', name: 'Flash Freeze', cost: 4, rarity: 'epic', kind: 'spell', role: 'Freeze', count: 1,
    dmg: 53, area: 3.0, towerPct: 0.35, instant: true, stun: 4,
    blurb: 'Freezes every enemy troop, building and tower in the area solid for 4 seconds: nothing frozen moves or attacks.',
  },
  // Arena 6: Blackwater Harbor
  dockraiders: {
    id: 'dockraiders', name: 'Dock Raiders', cost: 3, rarity: 'common', kind: 'troop', role: 'Swarm', count: 5,
    squad: [{ card: 'raider', n: 3 }, { card: 'raidergun', n: 2 }], hp: 140, dmg: 55, hit: 1.1, range: 0.5, speed: 2.0, targets: 'ground', air: false, radius: 0.36, mass: 1,
    blurb: 'Three cutlass pirates rush in while two more throw harpoons from behind, at ground and air alike.',
  },
  raider: {
    id: 'raider', name: 'Dock Raider', cost: 0, rarity: 'common', kind: 'troop', role: 'Melee', count: 1, hidden: true,
    hp: 140, dmg: 55, hit: 1.1, range: 0.5, speed: 2.0, targets: 'ground', air: false, radius: 0.36, mass: 1,
    blurb: 'A quick pirate with a cutlass.',
  },
  raidergun: {
    id: 'raidergun', name: 'Harpoon Raider', cost: 0, rarity: 'common', kind: 'troop', role: 'Ranged', count: 1, hidden: true,
    hp: 92, dmg: 37, hit: 1.7, range: 5, speed: 2.0, targets: 'both', air: false, radius: 0.34, mass: 1, proj: 'harpoonlet', projSpeed: 12,
    blurb: 'A pirate who throws small harpoons.',
  },
  barrel: {
    id: 'barrel', name: 'Boarding Barrel', cost: 3, rarity: 'epic', kind: 'spell', role: 'Win condition', count: 1,
    dmg: 0, area: 0, towerPct: 0, projSpeed: 8, projKind: 'barrel', barrel: { card: 'raider', n: 3 },
    blurb: 'A barrel flung from your King Tower to anywhere in the arena. It smashes open on landing and three pirates jump out.',
  },
  harpoon: {
    id: 'harpoon', name: 'Harpoon Captain', cost: 3, rarity: 'legendary', kind: 'troop', role: 'Puller', count: 1,
    hp: 670, dmg: 98, hit: 1.3, range: 1.2, speed: 1.0, targets: 'ground', air: false,
    radius: 0.6, mass: 5, hook: { min: 3.5, max: 7, speed: 12, cd: 3, slow: 0.35, slowDur: 1.5, windup: 0.4 },
    blurb: 'A burly captain who throws his harpoon at a ground enemy 3.5 to 7 tiles away and reels it in. Thrown at a building, he pulls himself to it.',
  },
  broadside: {
    id: 'broadside', name: 'Broadside Cart', cost: 5, rarity: 'epic', kind: 'troop', role: 'Ranged', count: 1,
    hp: 720, dmg: 80, hit: 0.9, range: 5.5, speed: 1.5, targets: 'ground', air: false,
    radius: 0.7, mass: 6, proj: 'cannon', projSpeed: 12, shield: 560, turret: { lifetime: 30, half: 0.9 },
    blurb: 'A ship\'s cannon on a wooden cart, rolling forward behind a plank shield and firing at ground troops. Break the shield and the cart stops for good, becoming a cannon that crumbles over 30 seconds.',
  },
  // Arena 7: Gearforge Citadel
  coil: {
    id: 'coil', name: 'Coil Tower', cost: 4, rarity: 'common', kind: 'building', role: 'Defense', count: 1,
    hp: 980, dmg: 76, hit: 1.1, range: 5.5, targets: 'both', air: false,
    radius: 0.9, half: 0.9, lifetime: 30, proj: 'arc', projSpeed: 40, hide: { rise: 0.6, idle: 1.0 },
    blurb: 'An electric coil that waits hidden in the ground, where troops can\'t touch it, and springs up to zap ground and air enemies in range.',
  },
  sparkbots: {
    id: 'sparkbots', name: 'Sparkbots', cost: 4, rarity: 'rare', kind: 'troop', role: 'Stun', count: 3,
    hp: 365, dmg: 54, hit: 2.1, range: 4.5, speed: 1.0, targets: 'both', air: false,
    radius: 0.45, mass: 2.5, proj: 'spark', projSpeed: 16, stunHit: 0.5,
    blurb: 'Three little robots with sparking antennas. Every shot stuns its target for half a second, interrupting charges and beams.',
  },
  titan: {
    id: 'titan', name: 'Steel Titan', cost: 8, rarity: 'epic', kind: 'troop', role: 'Win condition', count: 1,
    hp: 2940, dmg: 119, hit: 2.5, range: 0.75, speed: 0.75, targets: 'buildings', air: false,
    radius: 1.0, mass: 20, heavy: true, deathBlast: { r: 2.0, dmg: 119 }, onEnd: { card: 'titanling', count: 2 },
    blurb: 'An enormous clockwork titan that marches only for buildings. When it falls it bursts and splits into two smaller titans that carry on.',
  },
  titanling: {
    id: 'titanling', name: 'Titanling', cost: 0, rarity: 'epic', kind: 'troop', role: 'Tank', count: 1, hidden: true,
    hp: 590, dmg: 24, hit: 2.5, range: 0.75, speed: 0.75, targets: 'buildings', air: false,
    radius: 0.6, mass: 8, deathBlast: { r: 1.5, dmg: 24 },
    blurb: 'A small piece of the Steel Titan.',
  },
  arccannon: {
    id: 'arccannon', name: 'Arc Cannon', cost: 6, rarity: 'legendary', kind: 'troop', role: 'Splash', count: 1,
    hp: 1000, dmg: 612, hit: 4, range: 5, speed: 0.75, targets: 'ground', air: false,
    radius: 0.8, mass: 8, proj: 'arcblast', projSpeed: 18, splash: 1.8, charge: 4,
    blurb: 'A rolling engine with a huge electric cannon. It takes 4 seconds to charge each blast, which wipes out ground troops in an area. Any stun or freeze drains the charge.',
  },
  // Arena 8: Crystal Chasm
  gemflash: {
    id: 'gemflash', name: 'Gem Flash', cost: 2, rarity: 'common', kind: 'spell', role: 'Spell', count: 1,
    dmg: 88, area: 2.5, towerPct: 0.3, instant: true, stun: 0.5,
    blurb: 'An instant burst of crystal light: it damages and stuns troops and buildings in the area for half a second.',
  },
  shardguards: {
    id: 'shardguards', name: 'Shard Guards', cost: 3, rarity: 'epic', kind: 'troop', role: 'Swarm', count: 3,
    hp: 62, dmg: 41, hit: 1.0, range: 1.6, speed: 1.5, targets: 'ground', air: false,
    radius: 0.4, mass: 1.2, shield: 137,
    blurb: 'Three guards in crystal armor with long spears. Each crystal shield takes the next blow, however hard, before it shatters.',
  },
  drill: {
    id: 'drill', name: 'Crystal Drill', cost: 4, rarity: 'epic', kind: 'building', role: 'Win condition', count: 1,
    hp: 850, dmg: 0, hit: 3, range: 0, targets: 'ground', air: false,
    radius: 0.85, half: 0.85, lifetime: 10, anywhere: true, burrow: { speed: 5, surface: 0.5 }, emerge: { r: 2, dmg: 24 },
    spawner: { card: 'imp', every: 3, first: 1, onDeath: 2 },
    blurb: 'A crystal-powered drill that bores from your King Tower to anywhere, even beside an enemy tower. It bursts up, then sends out a crystal imp every 3 seconds, and two more when it breaks.',
  },
  imp: {
    id: 'imp', name: 'Crystal Imp', cost: 0, rarity: 'epic', kind: 'troop', role: 'Melee', count: 1, hidden: true,
    hp: 140, dmg: 55, hit: 1.1, range: 0.5, speed: 2.0, targets: 'ground', air: false, radius: 0.34, mass: 1,
    blurb: 'A quick little imp of living crystal.',
  },
  prism: {
    id: 'prism', name: 'Prism Archer', cost: 4, rarity: 'legendary', kind: 'troop', role: 'Ranged', count: 1,
    hp: 367, dmg: 62, hit: 1.1, range: 7, speed: 1.0, targets: 'both', air: false,
    radius: 0.45, mass: 2, proj: 'prismray', projSpeed: 12, pierce: { width: 0.3, extra: 4 },
    blurb: 'A crystal archer who shoots from very far away. Each bolt flies on through its target and hits every enemy in a straight line.',
  },
  // Arena 9: Skyward Sanctuary
  sunsprite: {
    id: 'sunsprite', name: 'Sun Sprite', cost: 1, rarity: 'rare', kind: 'troop', role: 'Healer', count: 1,
    hp: 160, dmg: 24, hit: 0.3, range: 2.5, speed: 2.0, targets: 'both', air: false,
    radius: 0.32, mass: 0.6, leap: { r: 1.5, speed: 7, heal: { r: 2.5, amount: 90, dur: 1 } },
    blurb: 'A tiny glowing sprite that leaps at an enemy and bursts into warm light, healing every friendly troop nearby.',
  },
  guardian: {
    id: 'guardian', name: 'Celestial Guardian', cost: 4, rarity: 'rare', kind: 'troop', role: 'Healer tank', count: 1,
    hp: 1185, dmg: 68, hit: 1.5, range: 0.75, speed: 1.0, targets: 'ground', air: false,
    radius: 0.62, mass: 6, healHit: { r: 4, amount: 44 }, selfHeal: { dps: 7, after: 1 },
    blurb: 'A guardian in radiant armor. Every swing of her hammer heals the friendly troops around her, and she mends herself while she isn\'t fighting.',
  },
  drake: {
    id: 'drake', name: 'Cloud Drake', cost: 4, rarity: 'epic', kind: 'troop', role: 'Air splash', count: 1,
    hp: 795, dmg: 74, hit: 1.5, range: 3.5, speed: 1.5, targets: 'both', air: true,
    radius: 0.6, mass: 4, proj: 'cloudpuff', projSpeed: 10, splash: 1.5,
    blurb: 'A young flying drake that breathes bursts of stormy cloud, splashing everything near its target in the air and on the ground.',
  },
  phoenix: {
    id: 'phoenix', name: 'Dawn Phoenix', cost: 4, rarity: 'legendary', kind: 'troop', role: 'Air', count: 1,
    hp: 690, dmg: 94, hit: 1.0, range: 1.6, speed: 1.5, targets: 'both', air: true,
    radius: 0.6, mass: 3, deathBlast: { r: 2.0, dmg: 100, air: true }, egg: { card: 'phoenixegg', hatch: 4.3 },
    blurb: 'A golden firebird that strikes air and ground. When it falls it bursts in flame and leaves an egg; if the egg survives, the Phoenix is reborn.',
  },
  phoenixegg: {
    id: 'phoenixegg', name: 'Phoenix Egg', cost: 0, rarity: 'legendary', kind: 'troop', role: 'Egg', count: 1, hidden: true,
    hp: 137, dmg: 0, hit: 1, range: 0, speed: 0, targets: 'none', air: false, radius: 0.45, mass: 30,
    blurb: 'A glowing egg. If it survives, the Phoenix is reborn.',
  },
  // Arena 10: Eclipse Throne
  wraiths: {
    id: 'wraiths', name: 'Wraith Army', cost: 3, rarity: 'epic', kind: 'troop', role: 'Swarm', count: 15,
    hp: 40, dmg: 40, hit: 1.0, range: 0.4, speed: 1.5, targets: 'ground', air: false,
    radius: 0.3, mass: 0.8,
    blurb: 'A horde of fifteen spectral swordsmen. They shred any single big troop but scatter before splash damage.',
  },
  wraith: {
    id: 'wraith', name: 'Wraith', cost: 0, rarity: 'legendary', kind: 'troop', role: 'Melee', count: 1, hidden: true,
    hp: 40, dmg: 40, hit: 1.0, range: 0.4, speed: 1.5, targets: 'ground', air: false, radius: 0.3, mass: 0.8,
    blurb: 'A spectral swordsman.',
  },
  meteor: {
    id: 'meteor', name: 'Doom Meteor', cost: 6, rarity: 'rare', kind: 'spell', role: 'Spell', count: 1,
    dmg: 683, area: 2.0, towerPct: 0.25, projSpeed: 8, projKind: 'meteor', knockback: 1.2,
    blurb: 'Calls down a slow, enormous dark meteor. It crushes everything in a small area, even towers.',
  },
  abyss: {
    id: 'abyss', name: 'Abyss Gate', cost: 5, rarity: 'legendary', kind: 'spell', role: 'Win condition', count: 1,
    dmg: 0, area: 4, towerPct: 0, gate: { card: 'wraith', n: 13, first: 2.2, every: 0.55, dur: 10 },
    blurb: 'Opens a dark portal over any spot for 10 seconds. Thirteen wraiths climb out of it, one after another, somewhere inside the circle.',
  },
  dreadknight: {
    id: 'dreadknight', name: 'Dread Knight', cost: 7, rarity: 'legendary', kind: 'troop', role: 'Splash tank', count: 1,
    hp: 2280, dmg: 102, hit: 1.7, range: 1.2, speed: 1.0, targets: 'ground', air: false,
    radius: 0.85, mass: 18, heavy: true, meleeSplash: 1.3, deployBlast: { r: 2.2, dmg: 204 },
    jump: { min: 3.5, max: 5, dmg: 204, r: 2.2, time: 0.9, cd: 1.0 },
    blurb: 'A towering knight in black armor. He lands with a shockwave, every swing hits all ground troops around his target, and he leaps onto enemies 3.5 to 5 tiles away.',
  },

  /* The expansion: 24 more cards, 14 spells, 9 buildings and a troop, spread over all ten arenas. Each
     works like a well-known card of the genre, brought to this game's scale the same way (troops and
     spells: health x0.69, damage x0.46; buildings: health x0.85, damage x0.33, as the Cannon and the Coil
     Tower are; the two siege buildings, made to hit towers, take the troops' x0.46 for damage). Spell damage grows with the card's level; durations, radii, lifetimes and energy don't. */
  // Arena 1: Cinder Keep
  magmaquake: {
    id: 'magmaquake', name: 'Magma Quake', cost: 3, rarity: 'rare', kind: 'spell', role: 'Building killer', count: 1,
    dmg: 100, area: 3.5, towerPct: 0.35, zone: { dur: 3, every: 1, targets: 'ground', bldMult: 4.5, slow: 0.5 },
    blurb: 'The ground splits open in volcanic cracks for 3 seconds. Three tremors hurt ground troops and slow them, and hit buildings four and a half times as hard. Flying troops float above it.',
  },
  ashfall: {
    id: 'ashfall', name: 'Ashfall', cost: 4, rarity: 'epic', kind: 'spell', role: 'Damage over time', count: 1,
    dmg: 305, area: 3.5, towerPct: 0.3, zone: { dur: 8, every: 1, targets: 'both' },
    blurb: 'A cloud of burning volcanic ash hangs over an area for 8 seconds, searing every enemy troop and building under it, on the ground or in the air.',
  },
  magmaturret: {
    id: 'magmaturret', name: 'Magma Turret', cost: 4, rarity: 'rare', kind: 'building', role: 'Splash defense', count: 1,
    hp: 1150, dmg: 73, hit: 1.8, range: 6, targets: 'ground', air: false, splash: 1.5,
    radius: 0.9, half: 0.95, lifetime: 30, proj: 'magmarock', projSpeed: 9, deathBlast: { r: 2.5, dmg: 73 },
    blurb: 'A forge turret that lobs exploding molten rocks at ground troops, splashing everything near where they land. When it is destroyed or burns out, it erupts one last time.',
  },
  // Arena 2: Briar Hollow
  thornroller: {
    id: 'thornroller', name: 'Thornroller', cost: 2, rarity: 'legendary', kind: 'spell', role: 'Spell', count: 1, ownSide: true,
    dmg: 133, area: 1.95, towerPct: 0.2, roll: { dist: 10.1, speed: 7.5, knock: 0.9 },
    blurb: 'A huge thorn-covered log rolls forward from where you place it, flattening ground troops in its path and knocking them back. It grazes towers for less. Placed on your side, like a troop.',
  },
  briarbind: {
    id: 'briarbind', name: 'Briar Bind', cost: 3, rarity: 'epic', kind: 'spell', role: 'Control', count: 1,
    dmg: 90, area: 2.5, towerPct: 0, bind: { n: 3, dur: 2 },
    blurb: 'Enchanted vines burst from the ground and seize the three toughest enemy troops or buildings in the area for 2 seconds: they can\'t move or attack, and flying troops are dragged down where ground troops can reach them.',
  },
  bramblenest: {
    id: 'bramblenest', name: 'Bramble Nest', cost: 4, rarity: 'rare', kind: 'building', role: 'Spawner', count: 1,
    hp: 935, dmg: 0, hit: 1, range: 0, targets: 'ground', air: false,
    radius: 0.9, half: 0.95, lifetime: 29, spawner: { card: 'thornling', every: 4.5, first: 1, onDeath: 0, n: 1 },
    blurb: 'A hut of living briars. Every few seconds a thornling scurries out and throws thorns at ground and air troops alike.',
  },
  thornling: {
    id: 'thornling', name: 'Thornling', cost: 0, rarity: 'rare', kind: 'troop', role: 'Ranged', count: 1, hidden: true,
    hp: 92, dmg: 37, hit: 1.7, range: 5, speed: 2.0, targets: 'both', air: false, radius: 0.34, mass: 1, proj: 'thorn', projSpeed: 12,
    blurb: 'A little forest creature that throws thorns.',
  },
  // Arena 3: Sunstone Arena
  scarabshrine: {
    id: 'scarabshrine', name: 'Scarab Shrine', cost: 3, rarity: 'rare', kind: 'building', role: 'Spawner', count: 1,
    hp: 430, dmg: 0, hit: 1, range: 0, targets: 'ground', air: false,
    radius: 0.85, half: 0.9, lifetime: 30, spawner: { card: 'scarab', every: 4, first: 1, onDeath: 4, n: 2 },
    blurb: 'An old sandstone tomb. Scarab warriors crawl out of it two at a time, and four more spill out when it crumbles.',
  },
  scarab: {
    id: 'scarab', name: 'Scarab', cost: 0, rarity: 'rare', kind: 'troop', role: 'Swarm', count: 1, hidden: true,
    hp: 40, dmg: 40, hit: 1.0, range: 0.4, speed: 1.5, targets: 'ground', air: false, radius: 0.3, mass: 0.8,
    blurb: 'A fragile scarab warrior.',
  },
  dunemortar: {
    id: 'dunemortar', name: 'Dune Mortar', cost: 4, rarity: 'common', kind: 'building', role: 'Siege', count: 1,
    hp: 1250, dmg: 110, hit: 5, range: 11.5, minRange: 3.5, targets: 'ground', air: false, siege: true, splash: 2,
    radius: 0.95, half: 1.0, lifetime: 30, deployTime: 3.5, proj: 'mortarshell', projSpeed: 5, lob: true,
    blurb: 'A sandstone siege cannon that lobs huge stones at ground troops, buildings and towers up to 11.5 tiles away, even from your own side. It can\'t hit anything closer than 3.5 tiles, and it takes a while to set up.',
  },
  // Arena 4: Stormspire
  judgment: {
    id: 'judgment', name: 'Judgment Bolt', cost: 6, rarity: 'epic', kind: 'spell', role: 'Spell', count: 1,
    dmg: 486, area: 3.5, towerPct: 0.3, bolts: { n: 3, every: 0.3, stun: 0.5 },
    blurb: 'Three bolts of lightning strike the three toughest enemies in the area, troops, buildings or towers, one after another, stunning each for a moment.',
  },
  cyclone: {
    id: 'cyclone', name: 'Cyclone', cost: 3, rarity: 'epic', kind: 'spell', role: 'Control', count: 1,
    dmg: 135, area: 5.5, towerPct: 0.3, zone: { dur: 1.5, every: 0.1, targets: 'both', pull: 3.5 },
    blurb: 'A howling storm spins for a second and a half, dragging enemy troops on the ground and in the air toward its eye and buffeting them. Heavy troops resist the pull; buildings don\'t move.',
  },
  conductor: {
    id: 'conductor', name: 'Storm Conductor', cost: 5, rarity: 'rare', kind: 'building', role: 'Tank killer', count: 1,
    hp: 1490, dmg: 33, hit: 0.4, range: 6, targets: 'both', air: false,
    radius: 0.9, half: 0.95, lifetime: 30, beam: { dps: [36, 115, 400], stage: 2 },
    blurb: 'A tall tower of glowing storm crystals that locks a lightning beam onto one ground or flying enemy. The longer the beam holds, the harder it hits; it starts over on a new target or when stunned.',
  },
  // Arena 5: Frostfang Keep
  glacierslam: {
    id: 'glacierslam', name: 'Glacier Slam', cost: 2, rarity: 'common', kind: 'spell', role: 'Spell', count: 1,
    dmg: 88, area: 2.5, towerPct: 0.3, projSpeed: 9, projKind: 'glacier', knockback: 1.5, slowHit: { f: 0.35, dur: 2.5 },
    blurb: 'A great ball of magic ice hurled from your King Tower. It hits everything in the area, air and ground, knocks them back and slows them for 2.5 seconds.',
  },
  cage: {
    id: 'cage', name: 'Frostfang Cage', cost: 4, rarity: 'rare', kind: 'building', role: 'Defense', count: 1,
    hp: 890, dmg: 0, hit: 1, range: 0, targets: 'ground', air: false,
    radius: 0.9, half: 0.95, lifetime: 20, spawner: { card: 'frostbrute', every: 0, first: 0, onDeath: 1, n: 1 },
    blurb: 'An ice prison that draws enemy troops to it. When it breaks or melts, the Frost Brute locked inside bursts out and fights.',
  },
  frostbrute: {
    id: 'frostbrute', name: 'Frost Brute', cost: 0, rarity: 'rare', kind: 'troop', role: 'Melee', count: 1, hidden: true,
    hp: 704, dmg: 116, hit: 1.2, range: 0.6, speed: 1.5, targets: 'ground', air: false, radius: 0.55, mass: 4,
    blurb: 'A hulking brawler of the frozen north.',
  },
  // Arena 6: Blackwater Harbor
  powderkeg: {
    id: 'powderkeg', name: 'Powder Keg', cost: 2, rarity: 'epic', kind: 'spell', role: 'Spell', count: 1, ownSide: true,
    dmg: 111, area: 1.3, towerPct: 0, roll: { dist: 4.5, speed: 6, knock: 0, spawn: 'buccaneer' },
    blurb: 'A gunpowder keg rolls forward from where you place it, bowling over ground troops in its way, then bursts and a pirate jumps out. Placed on your side, like a troop.',
  },
  barracks: {
    id: 'barracks', name: 'Pirate Barracks', cost: 6, rarity: 'rare', kind: 'building', role: 'Spawner', count: 1,
    hp: 1250, dmg: 0, hit: 1, range: 0, targets: 'ground', air: false,
    radius: 1.0, half: 1.05, lifetime: 35, spawner: { card: 'buccaneer', every: 14, first: 1, onDeath: 1, n: 2 },
    blurb: 'A fort built from shipwreck timber. Every 14 seconds two cutlass pirates march out, and one more when it falls.',
  },
  buccaneer: {
    id: 'buccaneer', name: 'Buccaneer', cost: 0, rarity: 'rare', kind: 'troop', role: 'Melee', count: 1, hidden: true,
    hp: 470, dmg: 88, hit: 1.4, range: 0.6, speed: 1.0, targets: 'ground', air: false, radius: 0.5, mass: 3,
    blurb: 'A burly pirate with a cutlass.',
  },
  // Arena 7: Gearforge Citadel
  overclock: {
    id: 'overclock', name: 'Overclock', cost: 2, rarity: 'epic', kind: 'spell', role: 'Boost', count: 1,
    dmg: 40, area: 3, towerPct: 0.3, rage: { dur: 6, boost: 1.35, linger: 1 },
    blurb: 'A field of humming gears and sparks. For 6 seconds your troops and buildings inside move and attack 35% faster (for a second after they leave, too). It jolts enemies a little as it lands.',
  },
  foundry: {
    id: 'foundry', name: 'Energy Foundry', cost: 6, rarity: 'rare', kind: 'building', role: 'Economy', count: 1,
    hp: 910, dmg: 0, hit: 1, range: 0, targets: 'ground', air: false,
    radius: 0.9, half: 0.95, lifetime: 70, produce: { every: 9 },
    blurb: 'A clanking generator that makes 1 battle energy every 9 seconds for 70 seconds, up to your energy limit. It only adds energy in this battle.',
  },
  smelter: {
    id: 'smelter', name: 'Walking Smelter', cost: 4, rarity: 'rare', kind: 'troop', role: 'Spawner', count: 1,
    hp: 775, dmg: 0, hit: 1, range: 0.6, speed: 0.6, targets: 'buildings', air: false,
    radius: 0.7, mass: 9, spawner: { card: 'emberling', every: 5, first: 1, n: 2 },
    blurb: 'A furnace on iron legs that clanks slowly toward enemy buildings. Every 5 seconds it spits out two little emberlings that leap onto enemies and burst.',
  },
  emberling: {
    id: 'emberling', name: 'Emberling', cost: 0, rarity: 'rare', kind: 'troop', role: 'Splash', count: 1, hidden: true,
    hp: 159, dmg: 95, hit: 0.3, range: 2.5, speed: 2.0, targets: 'both', air: false, radius: 0.3, mass: 0.6, leap: { r: 1.25, speed: 7 },
    blurb: 'A little flame that leaps at enemies and bursts.',
  },
  // Arena 8: Crystal Chasm
  prismecho: {
    id: 'prismecho', name: 'Prism Echo', cost: 3, rarity: 'epic', kind: 'spell', role: 'Boost', count: 1,
    dmg: 0, area: 3, towerPct: 0, clone: true,
    blurb: 'A flash of mirrored crystal makes a copy of each of your troops in the area. The copies fight just like the real ones, but have only 1 health. Buildings aren\'t copied.',
  },
  // Arena 9: Skyward Sanctuary
  heavensguard: {
    id: 'heavensguard', name: 'Heaven\'s Guard', cost: 3, rarity: 'common', kind: 'spell', role: 'Spell', count: 1, ownSide: true,
    dmg: 200, area: 3, towerPct: 0.3, delivery: { delay: 2, card: 'sentinel' },
    blurb: 'A golden capsule falls from the sky onto your side of the arena. After 2 seconds it lands, hurting enemies around it, and a shielded Heavenly Sentinel steps out.',
  },
  sentinel: {
    id: 'sentinel', name: 'Heavenly Sentinel', cost: 0, rarity: 'common', kind: 'troop', role: 'Melee', count: 1, hidden: true,
    hp: 304, dmg: 51, hit: 1.3, range: 1.6, speed: 1.0, targets: 'ground', air: false, radius: 0.5, mass: 3, shield: 137,
    blurb: 'A guardian in golden armor with a spear and a shield.',
  },
  reflection: {
    id: 'reflection', name: 'Divine Reflection', cost: 1, rarity: 'epic', kind: 'spell', role: 'Copy', count: 1, mirror: true,
    dmg: 0, area: 0, towerPct: 0,
    blurb: 'Plays the last card you used again, one level higher, for 1 more energy than it cost. Its cost in your hand changes with every card you play. It can\'t copy itself.',
  },
  ballista: {
    id: 'ballista', name: 'Golden Ballista', cost: 6, rarity: 'epic', kind: 'building', role: 'Siege', count: 1,
    hp: 1250, dmg: 12, hit: 0.3, range: 11.5, targets: 'ground', air: false, siege: true,
    radius: 0.95, half: 1.0, lifetime: 30, deployTime: 3.5, proj: 'bolt', projSpeed: 22,
    blurb: 'A great golden crossbow on a marble stand that fires a rapid stream of bolts at ground troops, buildings and towers up to 11.5 tiles away, even from your own side. It takes a while to set up.',
  },
  // Arena 10: Eclipse Throne
  soulblight: {
    id: 'soulblight', name: 'Soulblight', cost: 2, rarity: 'epic', kind: 'spell', role: 'Curse', count: 1,
    dmg: 90, area: 3, towerPct: 0.3, zone: { dur: 6, every: 0.5, targets: 'both' }, curse: { amp: 1.2, card: 'wraith' },
    blurb: 'A sinister curse hangs over an area for 6 seconds. Cursed enemies wither, take 20% more damage from your side, and any enemy troop that falls under it rises again as a wraith on your side.',
  },
  collapse: {
    id: 'collapse', name: 'Abyssal Collapse', cost: 5, rarity: 'epic', kind: 'spell', role: 'Spell', count: 1,
    dmg: 400, area: 2.5, towerPct: 0.25, void: { pulses: 3, every: 1, first: 0.6, tiers: [[1, 1], [4, 0.48], [99, 0.21]] },
    blurb: 'A rift of dark energy opens over an area and strikes three times. The fewer enemies inside, the harder each strike hits: one enemy takes it all, a crowd shares much less.',
  },
};

// Evolutions: each has its own unlock (shards) and how often it comes round in a battle (every
// cycle-th play of the card is the evolved one). Only the Snowman's is built so far.
const KC_EVOS = {
  snowman: { shards: 6, cycle: 3, name: 'Snowman Evolution', projSpeed: 1.5, splash: 1.5, size: 1.5,
    blurb: 'Every third Snowman you play is evolved: its snowballs are 1.5x the size and 1.5x as fast, for the same damage.' },
  // the starter deck's evolutions (js/sim.js: spawn, attack, projStep, damage, spellHit)
  archers: { shards: 6, cycle: 3, name: 'Archers Evolution', ricochet: { r: 2.5, f: 0.45 },
    blurb: 'Every third Archers you play are evolved: each arrow bounces on to another enemy nearby for 45% of its damage.' },
  wolves: { shards: 6, cycle: 2, name: 'Wolves Evolution', pack: { n: 2, r: 3, f: 0.65 },
    blurb: 'Every second Wolves you play are evolved: while two or more of the pack are close together, they bite about 50% faster.' },
  gladiator: { shards: 6, cycle: 3, name: 'Gladiator Evolution', bash: { shield: 0.22, r: 2, f: 1 },
    blurb: 'Every third Gladiator you play is evolved: it arrives with a shield worth a fifth of its health, and when the shield breaks it bashes every ground enemy round it.' },
  hawks: { shards: 6, cycle: 2, name: 'Hawks Evolution', dive: 2,
    blurb: 'Every second Hawks you play are evolved: each hawk dives on every new target, for double damage on the first strike.' },
  gorilla: { shards: 6, cycle: 2, name: 'Gorilla Evolution', pound: { every: 3, f: 2 },
    blurb: 'Every second Gorilla you play is evolved: every third hit is a Chest Pound for double damage.' },
  fireball: { shards: 6, cycle: 2, name: 'Fireball Evolution', burn: { dur: 2, f: 0.15, r: 0.85 },
    blurb: 'Every second Fireball you cast is evolved: it leaves the ground burning for 2 seconds.' },
};

// The level a card of each rarity starts at when it is found (it can never be lower): a Rare starts at
// level 3, an Epic at 6, a Legendary at 9. Every level adds the same 8%, so a level-9 Common and a
// level-9 Legendary are as strong as each other.
const KC_RARITY_START = { common: 1, rare: 3, epic: 6, legendary: 9 };
const KC_MIN_LEVEL = id => (KC_CARDS[id] && KC_RARITY_START[KC_CARDS[id].rarity]) || 1;

// Every card in collection order: the starter deck, then cards found on the Trophy Road.
const KC_ALL_CARDS = ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball', 'skeletons', 'cannon', 'spears', 'footmen', 'flail', 'pots',
  'sandstorm', 'ramcart', 'mole', 'camel', 'bees', 'owl', 'thundercloud', 'griffin',
  'frostsprite', 'icegiant', 'flashfreeze', 'wintersage', 'dockraiders', 'barrel', 'broadside', 'harpoon',
  'coil', 'sparkbots', 'titan', 'arccannon', 'gemflash', 'shardguards', 'drill', 'prism',
  'sunsprite', 'guardian', 'drake', 'phoenix', 'wraiths', 'meteor', 'abyss', 'dreadknight',
  // the expansion, by arena
  'magmaquake', 'ashfall', 'magmaturret', 'thornroller', 'briarbind', 'bramblenest', 'scarabshrine', 'dunemortar',
  'judgment', 'cyclone', 'conductor', 'glacierslam', 'cage', 'powderkeg', 'barracks', 'overclock', 'foundry', 'smelter',
  'prismecho', 'heavensguard', 'reflection', 'ballista', 'soulblight', 'collapse'];

const KC_STARTER_DECK = ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'];
