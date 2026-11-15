/* Putt Club: The Abyss. 18 hellscape holes for Ultra, every one par 6 or more.
   Stone platforms float over a sea of lava with no rails at all: roll off an edge and the ball is gone.
   Lava pools are set into the platforms (kind 'lava', over: true) and follow the platform's height. */
(function (mod) { const PC = window.PC = window.PC || {}; mod(PC); (PC.SRC = PC.SRC || []).push(mod); })(function (PC) {
  'use strict';
  const U = PC.U, K = PC.Kit, TAU = U.TAU;
  const rect = U.rect, rp = U.roundPoly, circ = (x, y, r) => U.circle(x, y, r, Math.max(28, Math.ceil(r * 16)));
  const lava = (x, y, r) => ({ kind: 'lava', over: true, poly: U.circle(x, y, r, 28) });
  const LOOK = (extra) => Object.assign({ theme: 'abyss', light: 'abyss', flag: '#14080a', flowers: ['#ff5a1f', '#ffb000', '#ff2d2d', '#ffe27a'] }, extra || {});
  const wallsAcross = (ys, gap) => ys.flatMap(y => [
    { pts: [[-1.6, y], [-gap, y]], w: 0.36, h: 0.7, style: 'obsidian' },
    { pts: [[gap, y], [1.6, y]], w: 0.36, h: 0.7, style: 'obsidian' },
  ]);

  const A = [];

  A.push({
    id: 'gates-of-dis', name: 'Gates of Dis', par: 6,
    special: 'Iron gates that slam shut',
    tip: 'Three obsidian walls cross the causeway, each with an iron gate that rises and slams. Lava pools wait beside them.',
    look: LOOK(), tee: [0, 1.3], cup: [0.8, 29.6],
    floors: [K.laneCircle(1.6, 0, 29, 3.2)],
    walls: wallsAcross([7, 13, 19], 0.6),
    hazards: [lava(-1.0, 10, 0.55), lava(1.0, 16, 0.55), lava(-0.9, 22.4, 0.55)],
    features: [{ type: 'gates', list: [
      { a: [-0.6, 7], b: [0.6, 7], period: 3.2, phase: 0 },
      { a: [-0.6, 13], b: [0.6, 13], period: 2.7, phase: 0.4 },
      { a: [-0.6, 19], b: [0.6, 19], period: 2.2, phase: 0.75 },
    ] }],
  });

  A.push({
    id: 'reapers-mill', name: "Reaper's Mill", par: 6,
    special: 'Spinning reaper blades',
    tip: 'Thin bridges lead on and off a round platform where three iron blades sweep. Miss the bridge and you fall.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 29.6],
    floors: [rp(rect(-2, 0, 2, 6.3), [0.8, 0.8, 0, 0]), rect(-0.9, 6, 0.9, 12.6), circ(0, 16, 4), rect(-0.9, 19.6, 0.9, 27.1), circ(0, 29, 2.6)],
    features: [{ type: 'spinner', x: 0, y: 16, arms: 3, len: 3.3, w: 0.16, omega: 1.05, h: 1.2 }],
  });

  A.push({
    id: 'imp-patrol', name: 'Imp Patrol', par: 7,
    special: 'Marching imps',
    tip: 'A zigzag causeway with no edges, and an imp pacing across every leg. A bump from one can knock you over the side.',
    look: LOOK(), tee: [0, 1.3], cup: [0.6, 25.4],
    floors: [rp(rect(-1.6, 0, 1.6, 10), [0.6, 0.6, 0, 0]), rect(-1.6, 7, 9, 10), rect(5.8, 7, 9, 20), rect(-1, 17, 9, 20), rp(rect(-1, 17, 2.2, 27), [0, 0, 0.8, 0.8])],
    features: [{ type: 'patrol', sound: 'bonk', imps: true, movers: [
      { a: [-1.4, 4.5], b: [1.4, 4.5], period: 3.6, r: 0.34, h: 0.8 },
      { a: [3.6, 7.2], b: [3.6, 9.8], period: 2.6, phase: 0.3, r: 0.34, h: 0.8 },
      { a: [6.0, 13.5], b: [8.8, 13.5], period: 3.2, phase: 0.6, r: 0.34, h: 0.8 },
      { a: [3.8, 17.2], b: [3.8, 19.8], period: 2.4, phase: 0.15, r: 0.34, h: 0.8 },
      { a: [-0.8, 23], b: [2.0, 23], period: 3.0, phase: 0.5, r: 0.34, h: 0.8 },
    ] }],
  });

  A.push({
    id: 'magma-pinball', name: 'Magma Pinball', par: 6,
    special: 'Magma boulders',
    tip: 'Glowing magma boulders fling the ball away faster than it arrived, and the arenas have no walls to catch it.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 25.0],
    floors: [rp(rect(-1.5, 0, 1.5, 5.9), [0.6, 0.6, 0, 0]), circ(0, 10.5, 5.2), rect(-0.9, 15.3, 0.9, 20.7), circ(0, 24.6, 4.2)],
    hazards: [lava(-3.5, 9, 0.7), lava(3.5, 9, 0.7), lava(0, 21.6, 0.42)],
    features: [{ type: 'bumpers', rocks: true, list: [
      { x: 0, y: 8.6, r: 0.55, kick: 2.8 }, { x: -2.4, y: 10.6, r: 0.5, kick: 2.8 }, { x: 2.4, y: 10.6, r: 0.5, kick: 2.8 },
      { x: -1.2, y: 12.8, r: 0.45, kick: 2.8 }, { x: 1.2, y: 12.8, r: 0.45, kick: 2.8 }, { x: 0, y: 6.8, r: 0.38, kick: 2.4 },
      { x: -1.9, y: 23.8, r: 0.45, kick: 2.6 }, { x: 1.9, y: 23.8, r: 0.45, kick: 2.6 }, { x: 0, y: 27.2, r: 0.4, kick: 2.4 },
    ] }],
  });

  A.push({
    id: 'geyser-leap', name: 'Geyser Leap', par: 6,
    special: 'Lava geysers',
    tip: 'Three platforms with nothing between them. Roll over a geyser vent and it hurls the ball across the gap.',
    look: LOOK(), tee: [0, 1.3], cup: [-0.6, 26.4],
    floors: [rp(rect(-1.8, 0, 1.8, 7), [0.6, 0.6, 0.3, 0.3]), rp(rect(-2, 10, 2, 18), 0.4), rp(rect(-2.2, 21, 2.2, 31), [0.3, 0.3, 1, 1])],
    walls: [{ pts: [[-1.6, 30.5], [1.6, 30.5]], w: 0.3, h: 0.5, style: 'obsidian' }],
    zones: [{ type: 'ash', poly: rect(-2, 10.1, 2, 15.6) }, { type: 'ash', poly: rect(-2.2, 21.1, 2.2, 25) }],
    features: [
      { type: 'launch', x: 0, y: 6.3, r: 0.55, vz: 7, minSpeed: 6.2, maxSpeed: 7.0, geyser: true, land: [0, 11.2] },
      { type: 'launch', x: 0.8, y: 17.2, r: 0.55, vz: 7, minSpeed: 6.2, maxSpeed: 7.0, geyser: true, land: [0.6, 22.4] },
    ],
  });

  A.push({
    id: 'raft-of-charon', name: 'Raft of Charon', par: 7,
    special: 'Basalt rafts on a lava lake',
    tip: 'Two stone rafts drift across the lava lake, with a rocky island between them. Ride one, then the other.',
    look: LOOK(), tee: [0, 1.3], cup: [0.7, 27.4],
    floors: [rp(rect(-2, 0, 2, 6), [0.7, 0.7, 0, 0]), circ(0, 14.5, 2.2), rp(rect(-2.4, 23, 2.4, 30), [0, 0, 1, 1])],
    hazards: [{ kind: 'lava', poly: rp(rect(-5, 4.6, 5, 24.4), 2.2), top: -0.25, bed: -0.6 }],
    features: [
      { type: 'ferry', a: [0, 7.05], b: [0, 11.25], r: 1.05, travel: 2.8, pause: 1.8, raft: true },
      { type: 'ferry', a: [0, 17.75], b: [0, 21.95], r: 1.05, travel: 2.6, pause: 1.6, phase: 1.3, raft: true },
    ],
  });

  A.push({
    id: 'portal-maze', name: 'Portal Maze', par: 6,
    special: 'Hell portals',
    tip: 'The platforms are not joined at all. Portals of the same colour are linked. One of them sends you back to the start.',
    look: LOOK(), tee: [0, 1.3], cup: [0.7, 21.4],
    floors: [rp(rect(-2.2, 0, 2.2, 6), 0.6), rp(rect(-8.2, 8, -2.8, 13.4), 0.6), rp(rect(2.8, 8, 8.2, 13.4), 0.6), rp(rect(-2.6, 16.5, 2.6, 23.5), 0.8)],
    features: [{ type: 'tunnels', r: 0.34, portals: true, pairs: [
      { a: [-1.2, 4.6], b: [-5.5, 9.0], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      { a: [1.2, 4.6], b: [5.5, 9.0], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      { a: [-5.5, 12.2], b: [0, 17.4], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      { a: [5.5, 12.2], b: [1.6, 1.6], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
    ] }],
  });

  A.push({
    id: 'doom-pendulum', name: 'Doom Pendulum', par: 6,
    special: 'Swinging spiked balls',
    tip: 'Two spiked iron balls swing across the causeway on chains. Time your putt between the swings.',
    look: LOOK(), tee: [0, 1.3], cup: [-0.7, 29.4],
    floors: [K.laneCircle(1.6, 0, 29, 3)],
    hazards: [lava(-1.05, 12.5, 0.5), lava(1.05, 12.5, 0.5), lava(0, 22.5, 0.5)],
    features: [
      { type: 'swing', x: 0, y: 8, len: 4.95, zp: 5.4, amp: 0.39, period: 3.2, rt: 0.5, spiked: true },
      { type: 'swing', x: 0, y: 17, len: 4.95, zp: 5.4, amp: 0.39, period: 2.6, phase: 1.4, rt: 0.5, spiked: true },
    ],
  });

  A.push({
    id: 'rune-wheel', name: 'Rune Wheel', par: 6,
    special: 'A turning rune circle',
    tip: 'The exit is off to the right. Ride the turning rune circle round until it points the way, then go.',
    look: LOOK(), tee: [0, 1.3], cup: [13.1, 10.4],
    floors: [rp(rect(-1.5, 0, 1.5, 6.8), [0.6, 0.6, 0, 0]), circ(0, 10, 3.7), rect(3.2, 8.6, 10.6, 11.4), circ(12.6, 10, 2.6)],
    features: [{ type: 'turntable', x: 0, y: 10, r: 3.2, omega: 0.8, runes: true, pots: [{ a: 0, d: 1.9, r: 0.32 }, { a: Math.PI, d: 1.9, r: 0.32 }] }],
  });

  A.push({
    id: 'obsidian-slide', name: 'Obsidian Slide', par: 6,
    special: 'Glassy obsidian',
    tip: 'The corners are polished obsidian, as slippery as ice. Putt soft or slide straight off the edge.',
    look: LOOK(), tee: [0, 1.3], cup: [-8.6, 20.4],
    floors: [rp(rect(-1.8, 0, 1.8, 12.6), [0.6, 0.6, 0, 0]), rect(-10.4, 9, 1.8, 12.6), rp(rect(-10.4, 9, -6.8, 22.5), [0, 0, 0.9, 0.9])],
    zones: [{ type: 'glass', poly: rect(-1.8, 4.5, 1.8, 12.6) }, { type: 'glass', poly: rect(-6.8, 9, -1.8, 12.6) }, { type: 'glass', poly: rect(-10.4, 9, -6.8, 16) }],
  });

  A.push({
    id: 'tar-pits', name: 'Tar Pits', par: 6,
    special: 'Sticky tar and lava',
    tip: 'Black tar stops a ball dead and lava pools swallow it. Thread the gaps between them.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 26.3],
    floors: [rp(rect(-3.2, 0, 3.2, 28), 1.0)],
    zones: [
      { type: 'tar', poly: U.blob(0, 6.5, 1.6, 21) }, { type: 'tar', poly: U.blob(-1.9, 12.5, 1.2, 22) }, { type: 'tar', poly: U.blob(1.9, 13.2, 1.2, 23) },
      { type: 'tar', poly: U.blob(0, 18.8, 1.5, 24) }, { type: 'tar', poly: U.blob(-2, 23.6, 0.9, 25) }, { type: 'tar', poly: U.blob(2.1, 23.2, 0.9, 26) },
    ],
    hazards: [lava(-2.6, 9.4, 0.45), lava(2.6, 9.4, 0.45), lava(0, 15.8, 0.5), lava(-2.5, 20.8, 0.45), lava(2.5, 20.8, 0.45)],
  });

  A.push({
    id: 'ash-river', name: 'Ash River', par: 7,
    special: 'A river of glowing ash',
    tip: 'A river of hot ash winds down the platform and its current carries the ball. Lava sits outside every bend.',
    look: LOOK(), tee: [2.6, 1.3], cup: [1.4, 28.0],
    floors: [rp(rect(-4, 0, 4, 30), 1.4)],
    hazards: [lava(3.1, 4, 0.55), lava(-3.2, 9.5, 0.55), lava(3.2, 15, 0.55), lava(-3.1, 20.5, 0.6), lava(3.0, 25.5, 0.5)],
    features: [{ type: 'brook', ash: true, line: [[-3, 1], [-2.4, 4], [2, 6.5], [2.8, 9.5], [-2, 12.5], [-2.8, 15.5], [1.8, 18.5], [2.6, 21.5], [-1, 24.5], [0.6, 27.2]], width: 1.2, depth: 0.14, flow: 3.4 }],
  });

  const volc = [0, 17];
  A.push({
    id: 'volcano-summit', name: 'Volcano Summit', par: 6,
    special: 'A volcano with the cup in its crater',
    tip: 'Putt up the side of a volcano to the cup in its crater. Lava runs down its slopes and the base drops away into nothing.',
    look: LOOK(), tee: [0, 1.3], cup: volc,
    floors: [K.laneCircle(1.7, 0, volc[1], 5.6)],
    height: (x, y) => { const d = Math.hypot(x - volc[0], y - volc[1]); return 1.1 * (1 - U.smooth(0.7, 4.4, d)) - 0.14 * (1 - U.smooth(0.25, 0.7, d)); },
    hazards: [25, 155, 225, 315].map(deg => {
      const a = (deg * Math.PI) / 180;
      return { kind: 'lava', over: true, poly: U.ribbon([[Math.cos(a) * 1.2, volc[1] + Math.sin(a) * 1.2], [Math.cos(a) * 2.6, volc[1] + Math.sin(a) * 2.6 + 0.1], [Math.cos(a) * 4.0, volc[1] + Math.sin(a) * 4.0]], 0.22) };
    }),
    posts: [0, 60, 120, 180].map(deg => { const a = (deg * Math.PI) / 180; return { x: Math.cos(a) * 4.9, y: volc[1] + Math.sin(a) * 4.9, r: 0.38, h: 0.5, style: 'basalt' }; }),
    features: [{ type: 'rockery', x: volc[0], y: volc[1], volcano: true }],
  });

  const crat = [0, 19.4];
  A.push({
    id: 'the-crater', name: 'The Crater', par: 6,
    special: 'A crater full of imps',
    tip: 'Cross the long thin bridge into a crater. The ball runs down toward the cup, but imps and lava pools are in the way.',
    look: LOOK(), tee: [0, 1.3], cup: crat,
    floors: [rp(rect(-2, 0, 2, 4), [0.6, 0.6, 0, 0]), rect(-0.8, 3.8, 0.8, 14.4), circ(crat[0], crat[1], 5.4)],
    height: (x, y) => { const d = Math.hypot(x - crat[0], y - crat[1]); return d < 5 ? -0.7 * Math.pow(1 - d / 5, 2) : 0; },
    hazards: [90, 210, 330].map(deg => { const a = (deg * Math.PI) / 180; return lava(crat[0] + Math.cos(a) * 2.6, crat[1] + Math.sin(a) * 2.6, 0.55); }),
    features: [{ type: 'patrol', sound: 'bonk', imps: true, movers: [
      { a: [-3.6, 17.2], b: [3.6, 17.2], period: 4.6, r: 0.34, h: 0.8 },
      { a: [3.6, 21.6], b: [-3.6, 21.6], period: 3.8, phase: 0.4, r: 0.34, h: 0.8 },
    ] }],
  });

  A.push({
    id: 'bone-bridge', name: 'Bone Bridge', par: 7,
    special: 'A bone bridge and a rocking slab',
    tip: 'Roll over the rune to raise a bone bridge over the first lava channel. The second channel has a slab that rocks side to side.',
    look: LOOK(), tee: [-1.2, 1.3], cup: [0.6, 24.6],
    floors: [rp(rect(-2.6, 0, 2.6, 7), [0.7, 0.7, 0, 0]), rect(-2.6, 10, 2.6, 17), rp(rect(-2.6, 20, 2.6, 27), [0, 0, 0.9, 0.9])],
    hazards: [{ kind: 'lava', poly: rect(-2.6, 6.95, 2.6, 10.05), top: -0.25, bed: -0.6 }, { kind: 'lava', poly: rect(-2.6, 16.95, 2.6, 20.05), top: -0.25, bed: -0.6 }],
    features: [
      { type: 'beanstalk', bones: true, button: [2.0, 4.6], br: 0.45, rect: [-0.7, 6.8, 0.7, 10.2], duration: 12, grow: 1.2 },
      { type: 'seesaw', slab: true, x0: -0.75, x1: 0.75, y0: 16.8, y1: 20.2, amp: 0.14, period: 3.4 },
    ],
  });

  A.push({
    id: 'soul-cart', name: 'Soul Cart', par: 6,
    special: 'Fire jets and a moving cup',
    tip: 'Turning fire jets blast a rolling ball sideways, and the cup rides back and forth on an iron cart at the far end.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 22],
    floors: [rp(rect(-2.4, 0, 2.4, 20), [0.7, 0.7, 0, 0]), rp(rect(-4, 18, 4, 25), [0, 0, 1.1, 1.1])],
    hazards: [lava(0, 17.2, 0.45)],
    features: [
      { type: 'sprinkler', fire: true, x: -1.2, y: 7, omega: 1.1, range: 3.6, power: 9, spread: 0.26 },
      { type: 'sprinkler', fire: true, x: 1.2, y: 13, omega: -1.3, range: 3.6, power: 9, spread: 0.26, phase: 1.5 },
      { type: 'movingCup', cart: true, a: [-3, 22], b: [3, 22], period: 6.5 },
    ],
  });

  A.push({
    id: 'sulfur-winds', name: 'Sulfur Winds', par: 7,
    special: 'Gusts of sulfur',
    tip: 'Hot gusts blow across a winding causeway with no edges. Watch the tattered banner and putt between gusts.',
    look: LOOK(), tee: [0, 1.3], cup: [-0.6, 26],
    floors: [rp(rect(-1.3, 0, 1.3, 11), [0.5, 0.5, 0, 0]), rect(-1.3, 8.4, 7, 11), rect(4.4, 8.4, 7, 22), rect(-2, 19.4, 7, 22), rp(rect(-2, 19.4, 0.8, 28), [0, 0, 0.7, 0.7])],
    hazards: [lava(5.7, 15.2, 0.4)],
    features: [{ type: 'wind', ash: true, dir: [1, 0], power: 3.0, period: 5.8, gust: 2.4 }],
  });

  A.push({
    id: 'the-descent', name: 'The Descent', par: 8,
    special: 'Ledges down into the abyss',
    tip: 'Four ledges step down toward the lava. Fire runes blast you forward, and blades guard the last platform.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 32.3],
    floors: [rp(rect(-2.4, 0, 2.4, 7), [0.8, 0.8, 0, 0]), rect(-2.4, 7, 2.4, 14), rect(-2.4, 14, 2.4, 21), rect(-2.4, 21, 2.4, 27.2), circ(0, 30, 3.2)],
    height: (x, y) => (y < 7 ? 1.8 : y < 14 ? 1.2 : y < 21 ? 0.6 : 0),
    walls: [
      { pts: [[-2.4, 7], [2.4, 7]], w: 0.04, h: 0, top: () => 1.8, style: 'none' },
      { pts: [[-2.4, 14], [2.4, 14]], w: 0.04, h: 0, top: () => 1.2, style: 'none' },
      { pts: [[-2.4, 21], [2.4, 21]], w: 0.04, h: 0, top: () => 0.6, style: 'none' },
    ],
    features: [
      { type: 'boost', fire: true, pads: [{ x: 0, y: 10.5, dir: [0, 1], power: 6 }, { x: -1, y: 17.5, dir: [0.3, 1], power: 6 }] },
      { type: 'spinner', x: 0, y: 30, arms: 3, len: 2.0, w: 0.16, omega: 1.2, h: 1.0 },
      { type: 'falls', steps: [7, 14, 21], lava: true },
    ],
  });

  A.forEach((h, i) => { h.num = i + 1; h.course = 'abyss'; });
  PC.ABYSS = A;
});
