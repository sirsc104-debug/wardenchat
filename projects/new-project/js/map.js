/* Apples to Oranges — the maps. One list per mode, shared by the game (names, icons, the rail)
 * and the scene (the art you see there).
 *
 * The rules:
 *   - Every mode has exactly 20 locations.
 *   - Your score is where you are on the map. The 20th location sits at 50,000 points, the target.
 *     Reaching it starts infinite mode: the map keeps going, first through the 20th location, then
 *     (from 55,000) into its own endless art, one more band every 5,000 points.
 *   - You can always see where you are. Every location lists the things drawn there (decor, with
 *     how often each turns up), so at "The Bird Flocks" the sky around you is full of birds.
 *
 * at      the score where the location starts (the same 20 steps in every mode)
 * decor   what's drawn in the sky there, and how much (for Halloween: the props along the ground)
 * mark    a one-off landmark drawn in the middle of the location
 * feature what grows on the tree there (Guess the Number)
 */
'use strict';

const MAP_TARGET = 50000;
const MAP_ENDLESS = 55000;   // where the endless art takes over from the 20th location
const MAP_BAND = 5000;       // points per band once you're past the target
// The 20 steps: close together at first, further apart later, ending at the target.
const MAP_AT = [0, 350, 1100, 2200, 3500, 5200, 7000, 9000, 11500, 14000, 17000, 20000, 23000, 26000, 30000, 33500, 37500, 41500, 45500, 50000];

const MAPS = (function () {
  const build = (list, infinite) => {
    if (list.length !== 20) throw new Error('Every map needs 20 locations');
    const stops = list.map(([name, ic, decor, extra], i) => Object.assign({ at: MAP_AT[i], name, ic, decor }, extra || {}));
    return { stops, infinite: Object.assign({ at: MAP_ENDLESS }, infinite) };
  };
  return {
    // 🎈 Classic: the hot-air balloon, from the orchard up to the edge of space
    classic: build([
      ['The Orchard',          '🍎', { birds: 0.6, butterfly: 0.8 }],
      ['The Kite Festival',    '🪁', { kite: 4, birds: 0.4 }],
      ['The Bird Flocks',      '🐦', { birds: 3, geese: 2 }],
      ['The Balloon Festival', '🎈', { balloon: 4, cloud: 0.4 }],
      ['The Skyscraper Tops',  '🏙️', { spire: 2.6, birds: 0.6 }],
      ['The Burj Khalifa',     '🗼', { cloud: 1, birds: 0.6 }, { mark: 'burj' }],
      ['The Fluffy Clouds',    '☁️', { cloud: 5 }],
      ['The Rainbow',          '🌈', { cloud: 1.4 }, { mark: 'rainbow' }],
      ['The Blimp Lane',       '🛩️', { blimp: 2.4, cloud: 1 }],
      ['The Thunderstorm',     '⛈️', { storm: 3 }],
      ['The Eagle’s Sky',  '🦅', { eagle: 2.6, cloud: 0.8 }],
      ['The Mountain Peaks',   '🏔️', { peak: 2.2, cloud: 0.8 }],
      ['Mount Everest',        '🗻', { wisp: 1, cloud: 0.6 }, { mark: 'everest' }],
      ['The Jet Planes',       '✈️', { jet: 3, wisp: 1.4 }],
      ['The Fighter Jets',     '💨', { fighter: 3, wisp: 1 }],
      ['The Weather Balloons', '🌡️', { wballoon: 3, wisp: 1 }],
      ['The Northern Lights',  '🌌', { aurora: 3 }],
      ['The Satellites',       '🛰️', { sat: 3, meteor: 0.5 }],
      ['The Space Station',    '🧑‍🚀', { sat: 1, meteor: 0.6 }, { mark: 'iss' }],
      ['The Edge of Space',    '🚀', { meteor: 2, planet: 0.5 }]
    ], { name: 'The Endless Sky', ic: '♾️', decor: { planet: 1, meteor: 1.5, sat: 0.5 } }),

    // 🐉 Real Size: the dragon, from its rock in the castle valley up into the stars
    size: build([
      ['The Dragon’s Rock',   '🐉', { birds: 1 }],
      ['The Castle Flags',       '🏰', { castletop: 2.6, birds: 0.5 }],
      ['The Waterfall Cliffs',   '💧', { cliff: 1.8, birds: 0.6 }],
      ['The Eagle Nests',        '🦅', { eagle: 2.6, cliff: 0.5 }],
      ['The Floating Islands',   '🏝️', { island: 3 }],
      ['The Rainbow Bridge',     '🌈', { island: 0.8, cloud: 1 }, { mark: 'rainbow' }],
      ['The Cloud Sheep',        '🐑', { sheep: 3, cloud: 1.4 }],
      ['The Wind Spirits',       '🌀', { swirl: 3, cloud: 0.8 }],
      ['The Sky Castle',         '🏯', { cloud: 1.6, island: 0.5 }, { mark: 'skycastle' }],
      ['The Crystal Spires',     '💎', { crystal: 3 }],
      ['The Storm Front',        '⛈️', { storm: 3 }],
      ['Above the Storm',        '⚡', { storm: 1.2, cloud: 2.6 }],
      ['The Dragon Roost',       '🐲', { minidragon: 2.6, island: 0.7 }],
      ['The Sunset Sky',         '🌅', { birds: 1.6, cloud: 1.4 }],
      ['The Moonrise',           '🌙', { cloud: 1, swirl: 0.5 }, { mark: 'moon' }],
      ['The Northern Lights',    '🌌', { aurora: 3 }],
      ['The Shooting Stars',     '🌠', { meteor: 3 }],
      ['The Star Bridge',        '✨', { constellation: 2.6 }],
      ['The Moon’s Doorstep',  '🌕', { meteor: 0.8, constellation: 0.6 }, { mark: 'bigmoon' }],
      ['The Dragon Star',        '🌟', { constellation: 1 }, { mark: 'bigstar' }]
    ], { name: 'The Endless Night', ic: '♾️', decor: { constellation: 1, meteor: 1, aurora: 0.6 } }),

    // 🐿️ Guess the Number: the squirrel, from the roots up a tree that never ends
    guess: build([
      ['The Roots',              '🌱', { butterfly: 1, leaf: 1 }, { feature: ['mushroom'] }],
      ['The Bird Feeder',        '🐦', { birds: 1.6, leaf: 1 }, { feature: ['feeder'] }],
      ['The Mushroom Shelves',   '🍄', { butterfly: 1, leaf: 1 }, { feature: ['mushroom'] }],
      ['The Owl’s Hollow',    '🦉', { leaf: 1.5, birds: 0.5 }, { feature: ['hollow'] }],
      ['The Woodpecker’s Door', '🚪', { leaf: 1.5, birds: 0.4 }, { feature: ['door', 'woodpecker'] }],
      ['The Bird Nests',         '🪺', { birds: 2 }, { feature: ['nest'] }],
      ['The Butterfly Garden',   '🦋', { butterfly: 4 }, { feature: ['flowers'] }],
      ['Above the Forest',       '🌲', { canopy: 1.8, birds: 1 }, { feature: ['nest'] }],
      ['The Lantern Branches',   '🏮', { firefly: 3 }, { feature: ['lantern'] }],
      ['The Autumn Leaves',      '🍂', { leaf: 4 }, { feature: ['mushroom', 'hollow'] }],
      ['The Squirrel Village',   '🏡', { leaf: 1.5 }, { feature: ['treehouse', 'door'] }],
      ['Into the Fog',           '🌫️', { fog: 3 }, { feature: ['lantern'] }],
      ['The Cloud Branches',     '☁️', { cloud: 4 }, { feature: ['nest'] }],
      ['The Kite Tangle',        '🪁', { kite: 3, cloud: 1 }, { feature: ['kite'] }],
      ['The Sky Nest',           '🥚', { birds: 1, cloud: 1.4 }, { feature: ['bignest'] }],
      ['The Jet Stream',         '✈️', { jet: 3, wisp: 1 }, { feature: ['lantern'] }],
      ['The Frozen Branches',    '❄️', { snow: 4 }, { feature: ['icicles'] }],
      ['The Northern Lights',    '🌌', { aurora: 3 }, { feature: ['lantern'] }],
      ['The Satellite Branch',   '🛰️', { sat: 3, meteor: 0.6 }, { feature: ['dish'] }],
      ['The Moon Acorn',         '🌕', { meteor: 1 }, { mark: 'moonacorn', feature: ['lantern'] }]
    ], { name: 'The Tree That Never Ends', ic: '♾️', decor: { meteor: 1, aurora: 1, sat: 0.4 }, feature: ['lantern', 'door', 'nest'] }),

    // 🎃 Halloween: the jack-o'-lantern balloon, sideways across a Halloween night.
    // decor here is the props along the ground; sky is [top, middle, horizon].
    haunt: build([
      ['The Pumpkin Patch',   '🎃', { pumpkin: 3, hay: 1, fence: 1 },           { sky: ['#2a1b4d', '#5a2a55', '#c8642e'] }],
      ['The Corn Maze',       '🌽', { corn: 3, scarecrow: 1 },                  { sky: ['#2a1b4d', '#5a2a55', '#c8642e'] }],
      ['The Scarecrow Field', '🧑‍🌾', { scarecrow: 3, hay: 1, pumpkin: 1 },       { sky: ['#2a1a48', '#55284f', '#bb5e2e'] }],
      ['The Haunted Hayride', '🚜', { wagon: 2, hay: 2, pumpkin: 1 },           { sky: ['#281944', '#50264c', '#b45a30'] }],
      ['The Graveyard',       '🪦', { tomb: 3, fence: 1, deadtree: 1 },         { sky: ['#231a44', '#4a2a55', '#b45a30'] }],
      ['The Crypts',          '⚰️', { crypt: 2, tomb: 2 },                       { sky: ['#201840', '#43284f', '#a4522c'] }],
      ['The Dark Forest',     '🌲', { deadtree: 4 },                            { sky: ['#1c1638', '#3a2448', '#9a4a2a'] }],
      ['The Spider Woods',    '🕸️', { web: 2, deadtree: 2 },                    { sky: ['#1a1434', '#352244', '#8e4628'] }],
      ['The Witch’s Hollow', '🧙', { cauldron: 2, deadtree: 1, house: 1 },  { sky: ['#2a1747', '#4f2660', '#a8582e'] }],
      ['The Potion Shop',     '🧪', { shop: 2, cauldron: 1, pumpkin: 1 },       { sky: ['#1f2447', '#2f4a5a', '#5aa07a'] }],
      ['The Bat Caves',       '🦇', { rock: 3 },                                { sky: ['#1d1430', '#3a2240', '#8a4a2a'], bats: 26 }],
      ['The Wolf Hill',       '🐺', { wolf: 2, rock: 1, deadtree: 1 },          { sky: ['#1a1b40', '#2f3060', '#6a6aa0'] }],
      ['The Haunted Mansion', '🏚️', { mansion: 2, fence: 1, tomb: 1 },          { sky: ['#24173f', '#4a2550', '#b05a2a'] }],
      ['The Ghost Lake',      '🌊', { lake: 2, deadtree: 1 },                   { sky: ['#14203f', '#22405a', '#5a8aa0'] }],
      ['The Skeleton Dance',  '💀', { skeleton: 3, tomb: 1 },                   { sky: ['#22163e', '#44265a', '#9a5a3a'] }],
      ['The Blood Moon',      '🌕', { tomb: 1, deadtree: 1, pumpkin: 1 },       { sky: ['#2a0f22', '#5a1a2a', '#c43a2a'], redMoon: true }],
      ['The Mummy Tomb',      '🏺', { pyramid: 2, tomb: 1 },                    { sky: ['#2a1a30', '#5a3a3a', '#c88a3a'] }],
      ['The Vampire Castle',  '🧛', { vcastle: 2, fence: 1, deadtree: 1 },      { sky: ['#1a0c26', '#3a1238', '#8a1a3a'], bats: 18 }],
      ['The Spirit Realm',    '👻', { spirit: 3, tomb: 1 },                     { sky: ['#1b1640', '#3a2a66', '#7a5ab0'] }],
      ['Beyond the Veil',     '🌀', { floatlantern: 3, spirit: 1 },             { sky: ['#0f1a3d', '#24406e', '#5ab0c8'] }]
    ], { name: 'The Endless Night', ic: '♾️', decor: { pumpkin: 1, tomb: 1, deadtree: 1, spirit: 1, floatlantern: 1 }, sky: ['#0a0a24', '#1e1e4a', '#4a4a8a'] })
  };
})();

// Where a score is on a mode's map: the location (or the endless one) and its index (0..19, 20 = endless).
function mapPlace(mode, score) {
  const M = MAPS[mode];
  if (score >= MAP_ENDLESS) return { i: 20, stop: M.infinite };
  let i = 0;
  while (i < 19 && score >= M.stops[i + 1].at) i++;
  return { i, stop: M.stops[i] };
}

// The same, as one smooth number for the scene: 0 at the start, 1 at the 2nd location, … 19 at the
// target, then one more for every 5,000 points.
function mapBand(score) {
  score = Math.max(0, score);
  if (score >= MAP_TARGET) return 19 + (score - MAP_TARGET) / MAP_BAND;
  let i = 0;
  while (i < 18 && score >= MAP_AT[i + 1]) i++;
  return i + (score - MAP_AT[i]) / (MAP_AT[i + 1] - MAP_AT[i]);
}
