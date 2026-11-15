/* Putt Club: The Abyss. 18 temple holes for Ultra, every one par 6 or more.
   Ancient stone platforms float over a lava abyss with no rails at all: roll off an edge and the ball is gone.
   The holes are built so a perfect player still needs several putts: corners with nothing to bank off,
   ledges you can only drop through a narrow window, platforms you must land on and stop.
   Lava pools are set into the platforms (kind 'lava', over: true) and follow the platform's height. */
(function (mod) { const PC = window.PC = window.PC || {}; mod(PC); (PC.SRC = PC.SRC || []).push(mod); })(function (PC) {
  'use strict';
  const U = PC.U, DEG = Math.PI / 180;
  const rect = U.rect, rp = U.roundPoly, circ = (x, y, r) => U.circle(x, y, r, Math.max(28, Math.ceil(r * 16)));
  const lava = (x, y, r) => ({ kind: 'lava', over: true, poly: U.circle(x, y, r, 28) });
  const LOOK = (extra) => Object.assign({ theme: 'abyss', light: 'abyss', flag: '#ff5a1a', flowers: ['#ff5a1f', '#ffb000', '#ff2d2d', '#ffe27a'] }, extra || {});

  // An axis-aligned causeway through waypoints, w wide, with a square pad at every corner.
  function causeway(pts, w, pad) {
    const out = [], h = w / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      if (ax === bx) out.push(rect(ax - h, Math.min(ay, by) - h, ax + h, Math.max(ay, by) + h));
      else out.push(rect(Math.min(ax, bx) - h, ay - h, Math.max(ax, bx) + h, ay + h));
    }
    for (let i = 1; i < pts.length - 1; i++) out.push(rect(pts[i][0] - pad / 2, pts[i][1] - pad / 2, pts[i][0] + pad / 2, pts[i][1] + pad / 2));
    return out;
  }
  // Part of a ring (for lava around a cup or down a volcano), angles in degrees.
  function sector(cx, cy, r0, r1, a0, a1) {
    const out = [], n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 6));
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; out.push([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]); }
    for (let i = n; i >= 0; i--) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; out.push([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]); }
    return out;
  }
  const lavaSector = (cx, cy, r0, r1, a0, a1) => ({ kind: 'lava', over: true, poly: sector(cx, cy, r0, r1, a0, a1) });
  // Half a ring of lava whose straight ends run exactly along a ramp hw either side of the east-west line,
  // so no sliver of floor is left between them to trap a ball.
  function lavaHalfRing(cx, cy, r0, r1, hw, south) {
    const k = south ? -1 : 1, out = [];
    const ao = Math.asin(hw / r1) / DEG, ai = Math.asin(hw / r0) / DEG;
    const n = 24;
    for (let i = 0; i <= n; i++) { const a = (ao + ((180 - 2 * ao) * i) / n) * DEG; out.push([cx + Math.cos(a) * r1, cy + k * Math.sin(a) * r1]); }
    for (let i = n; i >= 0; i--) { const a = (ai + ((180 - 2 * ai) * i) / n) * DEG; out.push([cx + Math.cos(a) * r0, cy + k * Math.sin(a) * r0]); }
    return { kind: 'lava', over: true, poly: out, level: -0.6 };
  }
  const teePad = (w = 3, l = 4) => rp(rect(-w / 2, 0, w / 2, l), [0.6, 0.6, 0.2, 0.2]);

  const A = [];

  // 1. Four legs, each with an iron gate across it; nothing to stop a ball at the corners.
  A.push({
    id: 'gates-of-dis', name: 'Gates of Dis', par: 8,
    special: 'Iron gates on a winding causeway',
    tip: 'Four iron gates rise and slam across a narrow causeway that turns at every corner. Stop on each corner pad, then time the next gate. Red springs on two corners fling the ball into the abyss.',
    look: LOOK(), tee: [0, 1.3], cup: [1, 28.9],
    floors: [teePad(2.6, 3.4), ...causeway([[0, 2.6], [0, 10], [8, 10], [8, 19], [1, 19], [1, 26.6]], 1.8, 3.0), circ(1, 28.4, 2.0)],
    hazards: [lava(0.05, 19.95, 0.42), lava(-0.1, 29.7, 0.36), lava(2.2, 28.0, 0.36)],
    features: [
      { type: 'spring', x: 8.85, y: 10.85, r: 0.38, dir: 45 * DEG, speed: 7, vz: 5 },
      { type: 'spring', x: 8.85, y: 19.85, r: 0.38, dir: 45 * DEG, speed: 7, vz: 5 },
      { type: 'gates', list: [
      { a: [-0.95, 6.2], b: [0.95, 6.2], period: 3.4, phase: 0 },
      { a: [4, 9.05], b: [4, 10.95], period: 3.0, phase: 0.4 },
      { a: [7.05, 14.5], b: [8.95, 14.5], period: 2.8, phase: 0.75 },
      { a: [4.5, 18.05], b: [4.5, 19.95], period: 2.6, phase: 0.2 },
    ] },
    ],
  });

  // 2. Two blade discs joined by thin bridges at right angles.
  A.push({
    id: 'reapers-mill', name: "Reaper's Mill", par: 7,
    special: 'Two discs of reaper blades',
    tip: 'Thin bridges join two round platforms where iron blades sweep. The bridges leave at right angles, so stop on each disc, between the blades.',
    look: LOOK(), tee: [0, 1.3], cup: [5.6, 23.4],
    floors: [teePad(2.6, 4), rect(-0.5, 3.8, 0.5, 9.2), circ(0, 12.5, 3.6), rect(3.4, 12, 10.1, 13), circ(13.5, 12.5, 3.6), ...causeway([[13.5, 15.8], [13.5, 23], [8, 23]], 0.9, 2.2), circ(5.9, 23, 1.8)],
    hazards: [lava(-2.3, 14.8, 0.45), lava(15.8, 10.2, 0.45), lava(14.3, 23.8, 0.36), lava(5.2, 24.3, 0.34), lava(6.9, 22.0, 0.34)],
    features: [
      { type: 'spinner', x: 0, y: 12.5, arms: 3, len: 3.2, w: 0.16, omega: 1.1, h: 1.2 },
      { type: 'spinner', x: 13.5, y: 12.5, arms: 3, len: 3.2, w: 0.16, omega: -1.3, h: 1.2, phase: 0.6 },
    ],
  });

  // 3. Six narrow legs, an imp pacing across every one.
  A.push({
    id: 'imp-patrol', name: 'Imp Patrol', par: 9,
    special: 'Imps on a zigzag causeway',
    tip: 'Six narrow legs with no edges, and imps pacing across them. A bump from an imp knocks the ball over the side. A wall blocks the sixth leg: roll over the gold spring to jump it.',
    look: LOOK(), tee: [0, 1.3], cup: [7, 29.8],
    floors: [teePad(2.6, 3.4), ...causeway([[0, 2.6], [0, 8], [7, 8], [7, 15], [0, 15], [0, 22], [7, 22], [7, 27.6]], 2.0, 2.8), circ(7, 29.4, 1.9)],
    walls: [{ pts: [[4.0, 21.0], [4.0, 23.0]], w: 0.36, h: 0.7, style: 'obsidian' }],
    zones: [{ type: 'tar', poly: rect(5.3, 21.0, 7.0, 23.0) }],
    features: [
      { type: 'spring', x: 2.2, y: 22, r: 0.42, vz: 6.5, minSpeed: 4.6, maxSpeed: 5.8, land: [6.2, 22] },
      { type: 'patrol', sound: 'bonk', imps: true, movers: [
      { a: [-0.75, 5.2], b: [0.75, 5.2], period: 3.4, r: 0.34, h: 0.8 },
      { a: [6.25, 11.5], b: [7.75, 11.5], period: 3.2, phase: 0.6, r: 0.34, h: 0.8 },
      { a: [3.5, 14.25], b: [3.5, 15.75], period: 3.0, phase: 0.15, r: 0.34, h: 0.8 },
      { a: [-0.75, 18.5], b: [0.75, 18.5], period: 3.3, phase: 0.5, r: 0.34, h: 0.8 },
      { a: [6.25, 25.2], b: [7.75, 25.2], period: 3.1, phase: 0.35, r: 0.34, h: 0.8 },
    ] }],
  });

  // 4. Two boulder arenas whose bridges leave at different angles from where you came in.
  A.push({
    id: 'magma-pinball', name: 'Magma Pinball', par: 7,
    special: 'Magma boulders in open arenas',
    tip: 'Each arena is full of magma boulders that fling the ball, and its way out is nowhere near its way in. Keep clear of the red springs near the edges.',
    look: LOOK(), tee: [0, 1.3], cup: [1.6, 28.0],
    floors: [teePad(2.6, 4), rect(-0.55, 3.8, 0.55, 5.4), circ(0, 9.2, 4.2), U.ribbon([[2.2, 11.8], [6.7, 16.9]], 0.55), circ(9, 19.6, 4.0), U.ribbon([[6.3, 22.2], [3.1, 26.4]], 0.55), circ(2.0, 27.6, 1.9)],
    hazards: [lava(-2.6, 7.3, 0.55), lava(2.9, 7.6, 0.5), lava(-1.6, 11.9, 0.45), lava(11.6, 18.5, 0.55), lava(8.2, 22.8, 0.45), lava(6.6, 17.9, 0.4), lava(3.1, 28.6, 0.34)],
    features: [
      { type: 'spring', x: -3.1, y: 10.7, r: 0.4, dir: 160 * DEG, speed: 7, vz: 5 },
      { type: 'spring', x: 11.7, y: 21.3, r: 0.4, dir: 30 * DEG, speed: 7, vz: 5 },
      { type: 'bumpers', rocks: true, list: [
      { x: 0, y: 8.4, r: 0.5, kick: 2.8 }, { x: -2.1, y: 9.8, r: 0.45, kick: 2.8 }, { x: 1.9, y: 10.2, r: 0.45, kick: 2.8 }, { x: -0.6, y: 11.6, r: 0.4, kick: 2.8 }, { x: 1.2, y: 6.6, r: 0.38, kick: 2.4 },
      { x: 9, y: 18.6, r: 0.5, kick: 2.8 }, { x: 7.2, y: 20.4, r: 0.45, kick: 2.8 }, { x: 10.6, y: 20.9, r: 0.45, kick: 2.8 }, { x: 9.4, y: 21.9, r: 0.38, kick: 2.6 },
    ] },
    ],
  });

  // 5. Four separate platforms: each geyser throws the ball the way it was rolling.
  A.push({
    id: 'geyser-leap', name: 'Geyser Leap', par: 7,
    special: 'Lava geysers between floating slabs',
    tip: 'Four slabs with nothing between them. A geyser throws the ball the way it is rolling, and the next slab is always off to one side.',
    look: LOOK(), tee: [0, 1.3], cup: [-1.2, 32.0],
    floors: [rp(rect(-1.6, 0, 1.6, 6.6), 0.4), rp(rect(-2, 10, 2, 16.6), 0.4), rp(rect(2.4, 18.8, 7, 25.2), 0.4), rp(rect(-3.4, 27.0, 2.0, 33.8), 0.5)],
    zones: [{ type: 'cinder', poly: rect(-2, 10, 2, 15.2) }, { type: 'cinder', poly: rect(2.4, 18.8, 7, 23.4) }, { type: 'cinder', poly: rect(-3.4, 27.0, 2.0, 30.4) }],
    features: [
      { type: 'launch', x: 0, y: 5.4, r: 0.55, vz: 7, minSpeed: 6.2, maxSpeed: 7.0, geyser: true, land: [0, 12] },
      { type: 'launch', x: 1.2, y: 15.4, r: 0.55, vz: 7, minSpeed: 6.2, maxSpeed: 7.0, geyser: true, land: [4.4, 21.0] },
      { type: 'launch', x: 3.4, y: 24.0, r: 0.55, vz: 7, minSpeed: 6.2, maxSpeed: 7.0, geyser: true, land: [-0.4, 28.8] },
    ],
  });

  // 6. Three rafts across a lava lake, each running a different way.
  A.push({
    id: 'raft-of-charon', name: 'Raft of Charon', par: 9,
    special: 'Three rafts across a lava lake',
    tip: 'Ride a raft to the first island, a second raft east to the next, and a third north to the far shore. Each raft waits a moment at each end.',
    look: LOOK(), tee: [0, 1.3], cup: [2.2, 24.2],
    floors: [rp(rect(-2, 0, 2, 5), [0.7, 0.7, 0, 0]), circ(0, 13.2, 1.8), circ(10.2, 13.2, 1.8), rp(rect(7.6, 21.4, 12.8, 26.6), [0, 0, 0.6, 0.6]), rect(3.6, 23.5, 8, 24.7), circ(2.2, 24.1, 1.7)],
    hazards: [{ kind: 'lava', poly: rp(rect(-3.6, 4.4, 14.2, 22.6), 2.2), top: -0.25, bed: -0.6 }, lava(1.2, 25.1, 0.34), lava(3.2, 23.0, 0.32)],
    features: [
      { type: 'ferry', a: [0, 6.1], b: [0, 10.4], r: 1.0, travel: 2.8, pause: 1.6, raft: true },
      { type: 'ferry', a: [2.9, 13.2], b: [7.3, 13.2], r: 1.0, travel: 2.6, pause: 1.5, phase: 1.1, raft: true },
      { type: 'ferry', a: [10.2, 16.1], b: [10.2, 20.4], r: 1.0, travel: 2.6, pause: 1.5, phase: 2.0, raft: true },
    ],
  });

  // 7. Floating slabs joined only by portals; the easy-looking one sends you back.
  A.push({
    id: 'portal-maze', name: 'Portal Maze', par: 6,
    special: 'Paired portals and a lava ring',
    tip: 'No slab touches another. Portals of the same colour are linked, and one of them sends you back to the tee. The cup sits in a ring of lava, open only at the back.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 22.6],
    floors: [rp(rect(-2.2, 0, 2.2, 6), 0.6), rp(rect(-10, 8, -5, 13.4), 0.6), rp(rect(5, 8, 10, 13.4), 0.6), rp(rect(-2.4, 8.6, 2.4, 13.6), 0.6), rp(rect(-2.6, 16.8, 2.6, 26.2), 0.8)],
    hazards: [lava(8.2, 10.7, 0.45), lava(0.1, 11.2, 0.55), lava(-1.0, 12.7, 0.4), lavaSector(0, 22.6, 0.75, 1.35, 120, 420), lava(-1.9, 19.4, 0.4), lava(1.9, 19.4, 0.4)],
    features: [{ type: 'tunnels', r: 0.34, portals: true, pairs: [
      { a: [-1.2, 4.6], b: [-7.5, 9.0], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      { a: [1.2, 4.6], b: [7.5, 9.0], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      { a: [-7.5, 12.3], b: [1.7, 1.0], dirA: -Math.PI / 2, dirB: Math.PI },
      { a: [8.9, 12.3], b: [1.6, 9.6], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      { a: [-1.7, 12.6], b: [0, 17.6], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
    ] }],
  });

  // 8. An L-shaped bridge with four spiked pendulums.
  A.push({
    id: 'doom-pendulum', name: 'Doom Pendulum', par: 7,
    special: 'Spiked pendulums on a narrow bridge',
    tip: 'Four spiked iron balls swing across a narrow bridge that turns once, and a wall blocks the middle. Hit the gold spring dead straight to jump it.',
    look: LOOK(), tee: [0, 1.3], cup: [9, 29.5],
    floors: [teePad(2.6, 3.4), ...causeway([[0, 2.6], [0, 15], [9, 15], [9, 27.4]], 1.2, 2.6), circ(9, 29.2, 1.9)],
    hazards: [lava(0.85, 15.85, 0.4), lava(9.85, 14.15, 0.4), lava(8.1, 30.2, 0.34)],
    walls: [{ pts: [[5.2, 14.3], [5.2, 15.7]], w: 0.36, h: 0.7, style: 'obsidian' }],
    zones: [{ type: 'tar', poly: rect(6.5, 14.4, 8.3, 15.6) }],
    features: [
      { type: 'spring', x: 3.4, y: 15, r: 0.42, vz: 6.5, minSpeed: 4.6, maxSpeed: 5.8, land: [7.4, 15] },
      { type: 'swing', x: 0, y: 6, len: 4.95, zp: 5.4, amp: 0.39, period: 3.0, rt: 0.5, spiked: true },
      { type: 'swing', x: 0, y: 11, len: 4.95, zp: 5.4, amp: 0.39, period: 2.5, phase: 1.4, rt: 0.5, spiked: true },
      { type: 'swing', x: 9, y: 19.5, len: 4.95, zp: 5.4, amp: 0.39, period: 2.8, phase: 0.7, rt: 0.5, spiked: true },
      { type: 'swing', x: 9, y: 24, len: 4.95, zp: 5.4, amp: 0.39, period: 2.3, phase: 2.1, rt: 0.5, spiked: true },
    ],
  });

  // 9. The great rune wheel: three bridges leave it and only one goes anywhere.
  A.push({
    id: 'rune-wheel', name: 'Rune Wheel', par: 6,
    special: 'Two turning rune wheels',
    tip: 'The great rune wheel turns with you on it. Three bridges leave it and only the east one leads on, to a second wheel turning the other way.',
    look: LOOK(), tee: [0, 1.3], cup: [4.4, 21.2],
    floors: [teePad(2.6, 4), rect(-0.5, 3.8, 0.5, 6.6), circ(0, 10, 3.9), rect(-9, 9.55, -3.6, 10.45), rect(-0.45, 13.6, 0.45, 18), rect(3.6, 9.55, 8.6, 10.45), circ(11.6, 10, 3.3), ...causeway([[11.6, 13.0], [11.6, 21], [6.0, 21]], 0.9, 2.2), circ(4.6, 21, 1.8)],
    hazards: [lava(-8.4, 10, 0.45), lava(0, 17.4, 0.45), lava(12.4, 21.8, 0.36), lava(3.8, 22.2, 0.34), lava(5.6, 19.9, 0.34)],
    features: [
      { type: 'turntable', x: 0, y: 10, r: 3.6, omega: 0.8, runes: true, big: true, pots: [{ a: 0, d: 2.0, r: 0.32 }, { a: Math.PI, d: 2.0, r: 0.32 }] },
      { type: 'turntable', x: 11.6, y: 10, r: 3.0, omega: -1.0, runes: true, pots: [{ a: Math.PI / 2, d: 1.6, r: 0.3 }] },
    ],
  });

  // 10. Glassy obsidian legs: the ball slides five times further than on stone.
  A.push({
    id: 'obsidian-slide', name: 'Obsidian Slide', par: 8,
    special: 'Polished obsidian legs',
    tip: 'Most of this causeway is polished obsidian, as slippery as ice, and it turns five times. Putt soft or slide straight off the end.',
    look: LOOK(), tee: [0, 1.3], cup: [-2, 30.2],
    floors: [teePad(2.6, 3.4), ...causeway([[0, 2.6], [0, 10], [-8, 10], [-8, 18], [0, 18], [0, 24], [-2, 24], [-2, 27.8]], 2.2, 3.0), circ(-2, 29.8, 1.9)],
    zones: [{ type: 'glass', poly: rect(-1.1, 4.5, 1.1, 8.4) }, { type: 'glass', poly: rect(-6.4, 8.9, -1.6, 11.1) }, { type: 'glass', poly: rect(-9.1, 11.6, -6.9, 16.4) }, { type: 'glass', poly: rect(-6.4, 16.9, -1.6, 19.1) }],
    hazards: [lava(-1.2, 30.8, 0.34)],
  });

  // 11. A slalom between tar and lava, to a cup ringed with lava.
  A.push({
    id: 'tar-pits', name: 'Tar Pits', par: 7,
    special: 'A slalom of tar and lava',
    tip: 'Rows of lava pools leave one gap each, and a wall runs right across the middle: only the gold spring gets you over it. The red one throws you off the side. The cup sits in a lava ring open only at the back.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 26],
    floors: [rp(rect(-3.2, 0, 3.2, 29.6), 1.0)],
    zones: [{ type: 'tar', poly: U.blob(1.6, 4.6, 0.9, 21) }, { type: 'tar', poly: U.blob(-1.8, 10.0, 0.8, 22) }, { type: 'tar', poly: U.blob(0.5, 16.0, 1.25, 23) }, { type: 'tar', poly: U.blob(-2.2, 22, 0.8, 24) }],
    walls: [{ pts: [[-3.2, 13.2], [3.2, 13.2]], w: 0.36, h: 0.7, style: 'obsidian' }],
    features: [
      { type: 'spring', x: 0.4, y: 11.4, r: 0.42, vz: 6.5, minSpeed: 4.6, maxSpeed: 5.8, land: [0.4, 15.4] },
      { type: 'spring', x: -2.5, y: 10.8, r: 0.38, dir: 180 * DEG, speed: 7, vz: 5 },
    ],
    hazards: [
      lava(-2.6, 7.2, 0.6), lava(-1.3, 7.2, 0.6), lava(0.0, 7.2, 0.6), lava(1.1, 7.2, 0.5),
      lava(-2.6, 19.2, 0.6), lava(-1.3, 19.2, 0.6), lava(0.0, 19.2, 0.6), lava(1.1, 19.2, 0.5),
      lava(0.2, 22.4, 0.6),
      lavaSector(0, 26, 0.75, 1.4, 125, 415), lava(-2.6, 26, 0.45), lava(2.6, 26, 0.45),
    ],
  });

  // 12. The ash river runs back toward the tee and crosses the whole platform four times.
  A.push({
    id: 'ash-river', name: 'Ash River', par: 8,
    special: 'A river of ash flowing the wrong way',
    tip: 'A river of hot ash runs down the whole winding causeway, flowing back toward the tee. Stay out of it where you can, and watch the lava at the bends.',
    look: LOOK(), tee: [0, 1.3], cup: [1.5, 30.2],
    floors: [teePad(3.4, 3.4), ...causeway([[0, 2.6], [0, 10], [-7, 10], [-7, 19], [0, 19], [0, 26], [1.5, 26], [1.5, 28.4]], 3.0, 3.4), circ(1.5, 30, 1.8)],
    hazards: [lava(1.2, 11.2, 0.42), lava(-8.2, 8.8, 0.42), lava(-8.2, 20.2, 0.42), lava(1.2, 17.8, 0.42), lava(0.6, 31.0, 0.34), lava(2.6, 30.6, 0.32)],
    features: [{ type: 'brook', ash: true, line: [[1.5, 28.6], [1.2, 26.4], [0.2, 25.4], [0, 20], [-1, 19], [-6, 19], [-7, 18], [-7, 11], [-6, 10], [-1, 10], [0, 9], [0, 3.6]], width: 1.5, depth: 0.2, flow: 5 }],
  });

  // 13. A volcano you can only climb by two narrow ridges, from a ledge around its base.
  const volc = [0, 18];
  const vh = (x, y) => { const d = Math.hypot(x - volc[0], y - volc[1]); return 1.5 * (1 - U.smooth(0.9, 5.0, d)) - 0.3 * (1 - U.smooth(0.2, 0.9, d)); };
  A.push({
    id: 'volcano-summit', name: 'Volcano Summit', par: 7,
    special: 'Two ridges up a volcano',
    tip: 'Lava runs down every slope of the volcano but two narrow ridges at the back. Work round the ledge at its base, then climb a ridge to the cup in the crater.',
    look: LOOK(), tee: [0, 1.3], cup: volc,
    floors: [teePad(2.6, 4), rect(-0.6, 3.8, 0.6, 11.8), circ(volc[0], volc[1], 6.6)],
    height: vh,
    hazards: [lavaSector(volc[0], volc[1], 1.0, 5.0, 44, 136), lavaSector(volc[0], volc[1], 1.0, 5.0, 164, 376)],
    posts: [200, 250, 290, 340].map(deg => ({ x: Math.cos(deg * DEG) * 5.8, y: volc[1] + Math.sin(deg * DEG) * 5.8, r: 0.32, h: 0.5, style: 'basalt' })),
    features: [{ type: 'rockery', x: volc[0], y: volc[1], volcano: true }],
  });

  // 14. A crater whose floor is lava, with the cup on a mesa reached by two steep ramps.
  const crat = [0, 20];
  A.push({
    id: 'the-crater', name: 'The Crater', par: 8,
    special: 'A mesa in a crater of lava',
    tip: 'A thin, crooked bridge leads into a crater that slopes down into a lake of lava. The cup sits on a mesa in the middle, reached only by two steep ramps from the east and west.',
    look: LOOK({ cell: 0.1 }), tee: [0, 1.3], cup: [crat[0], crat[1] + 0.55],
    floors: [teePad(2.6, 4), ...causeway([[0, 3.6], [0, 9], [3, 9], [3, 15.1]], 0.9, 2.0), circ(crat[0], crat[1], 6)],
    height: (x, y) => {
      const dx = x - crat[0], dy = y - crat[1], d = Math.hypot(dx, dy);
      if (d <= 1.1) return 0;
      if (Math.abs(dy) < 0.28 && Math.abs(dx) < 2.9) return -0.6 * (Math.abs(dx) - 1.1) / 1.8;
      if (d <= 2.8) return -0.6;
      return d <= 6 ? -0.6 * (1 - U.smooth(2.8, 6, d)) : 0;
    },
    hazards: [lavaHalfRing(crat[0], crat[1], 1.1, 2.86, 0.28, false), lavaHalfRing(crat[0], crat[1], 1.1, 2.86, 0.28, true)],
    features: [{ type: 'patrol', sound: 'bonk', imps: true, movers: [
      { a: [-4.2, 23.4], b: [4.2, 23.4], period: 4.6, r: 0.34, h: 0.8 },
      { a: [4.4, 17], b: [-4.4, 17], period: 3.8, phase: 0.4, r: 0.34, h: 0.8 },
    ] }],
  });

  // 15. Three lava channels: a bone bridge, a rocking slab, and a second bone bridge.
  A.push({
    id: 'bone-bridge', name: 'Bone Bridge', par: 7,
    special: 'Bone bridges and a rocking slab',
    tip: 'Roll over a rune to raise a bone bridge for a few seconds. The first channel has one, the second a slab that rocks, and the third a rune right in front of a narrower bridge: roll over it and keep going.',
    look: LOOK(), tee: [-1.2, 1.3], cup: [0.8, 31.8],
    floors: [rp(rect(-2.6, 0, 2.6, 7), [0.7, 0.7, 0, 0]), rect(-2.6, 10, 2.6, 16), rect(-2.6, 19, 2.6, 25), rp(rect(-2.6, 28, 2.6, 34), [0, 0, 0.9, 0.9])],
    hazards: [
      { kind: 'lava', poly: rect(-2.6, 6.95, 2.6, 10.05), top: -0.25, bed: -0.6 },
      { kind: 'lava', poly: rect(-2.6, 15.95, 2.6, 19.05), top: -0.25, bed: -0.6 },
      { kind: 'lava', poly: rect(-2.6, 24.95, 2.6, 28.05), top: -0.25, bed: -0.6 },
      lava(-0.4, 31.4, 0.34), lava(1.9, 32.6, 0.34),
    ],
    features: [
      { type: 'beanstalk', bones: true, button: [2.0, 4.6], br: 0.45, rect: [-0.7, 6.8, 0.7, 10.2], duration: 14, grow: 1.2 },
      { type: 'seesaw', slab: true, x0: -1.9, x1: -0.5, y0: 15.8, y1: 19.2, amp: 0.15, period: 3.2 },
      { type: 'beanstalk', bones: true, button: [1.5, 20.6], br: 0.45, rect: [0.8, 24.8, 2.2, 28.2], duration: 13, grow: 0.6 },
    ],
  });

  // 16. Fire jets blast across a narrow L of bridges; the cup rides on a cart.
  A.push({
    id: 'soul-cart', name: 'Soul Cart', par: 7,
    special: 'Fire jets and a moving cup',
    tip: 'Turning fire jets blast a rolling ball sideways off the narrow bridges. At the end the cup rides back and forth on an iron cart between lava pools.',
    look: LOOK(), tee: [0, 1.3], cup: [10, 23],
    floors: [teePad(2.6, 3.4), ...causeway([[0, 2.6], [0, 9], [-4, 9], [-4, 14], [10, 14], [10, 19.2]], 1.1, 2.4), circ(-1.5, 6, 0.6), circ(3, 15.5, 0.6), circ(11.5, 17, 0.55), rp(rect(6.4, 19.4, 13.6, 25.6), 0.8)],
    hazards: [lava(10, 20.4, 0.42), lava(6.9, 25.1, 0.36), lava(13.1, 25.1, 0.36), lava(10, 25.1, 0.34)],
    features: [
      { type: 'sprinkler', fire: true, x: -1.5, y: 6, omega: 1.1, range: 3.4, power: 10, spread: 0.26 },
      { type: 'sprinkler', fire: true, x: 3, y: 15.5, omega: -1.3, range: 3.6, power: 10, spread: 0.26, phase: 1.5 },
      { type: 'sprinkler', fire: true, x: 11.5, y: 17, omega: 1.5, range: 2.6, power: 9, spread: 0.3, phase: 0.6 },
      { type: 'movingCup', cart: true, a: [7.4, 23], b: [12.6, 23], period: 6.0 },
    ],
  });

  // 17. Gusts across thin legs.
  A.push({
    id: 'sulfur-winds', name: 'Sulfur Winds', par: 11,
    special: 'Gusts across thin causeways',
    tip: 'Hot gusts blow across thin legs with no edges, pushing the ball east. A wall blocks the fourth leg: jump it with the gold spring, between gusts.',
    look: LOOK(), tee: [0, 1.3], cup: [-1, 30.6],
    floors: [teePad(2.6, 3.4), ...causeway([[0, 2.6], [0, 9], [7, 9], [7, 17], [-1, 17], [-1, 23], [5, 23], [5, 26.4], [-1, 26.4], [-1, 28.4]], 1.5, 2.6), circ(-1, 30.2, 1.8)],
    hazards: [lava(-0.2, 31.2, 0.32)],
    walls: [{ pts: [[2.6, 16.1], [2.6, 17.9]], w: 0.36, h: 0.7, style: 'obsidian' }],
    zones: [{ type: 'tar', poly: rect(-0.6, 16.25, 1.3, 17.75) }],
    features: [
      { type: 'wind', ash: true, dir: [1, 0], power: 3.0, period: 5.6, gust: 2.2 },
      { type: 'spring', x: 4.4, y: 17, r: 0.42, vz: 6.5, minSpeed: 4.6, maxSpeed: 5.8, land: [0.6, 17] },
    ],
  });

  // 18. Five ledges down, each dropping through a narrow window off to one side.
  const descH = (x, y) => (y < 7 ? 2.4 : y < 13 ? 1.8 : y < 19 ? 1.2 : y < 25 ? 0.6 : 0);
  A.push({
    id: 'the-descent', name: 'The Descent', par: 7,
    special: 'Ledges down into the abyss',
    tip: 'Five ledges step down toward the lava. Each one only meets the next for a short stretch, off to one side, so stop on every ledge and drop through the gap. A red spring on the third ledge throws the ball off the edge.',
    look: LOOK(), tee: [0, 1.3], cup: [1.6, 29.6],
    floors: [rp(rect(-1.2, 0, 1.2, 7), [0.5, 0.5, 0, 0]), rect(0.4, 7, 4.0, 13), rect(2.8, 13, 6.4, 19), rect(-0.2, 19, 3.6, 25), circ(1.6, 27.4, 2.8)],
    height: descH,
    walls: [
      { pts: [[-1.2, 7], [4.0, 7]], w: 0.04, h: 0, top: () => 2.4, style: 'none' },
      { pts: [[0.4, 13], [6.4, 13]], w: 0.04, h: 0, top: () => 1.8, style: 'none' },
      { pts: [[-0.2, 19], [6.4, 19]], w: 0.04, h: 0, top: () => 1.2, style: 'none' },
      { pts: [[-1.2, 25], [4.4, 25]], w: 0.04, h: 0, top: () => 0.6, style: 'none' },
    ],
    hazards: [lava(3.3, 9.0, 0.4), lava(5.6, 15.4, 0.4), lava(0.6, 21.6, 0.4)],
    features: [
      { type: 'spinner', x: 1.6, y: 27.2, arms: 3, len: 1.9, w: 0.16, omega: 1.2, h: 1.0 },
      { type: 'spring', x: 5.8, y: 17.4, r: 0.4, dir: 0, speed: 7, vz: 5 },
    ],
  });

  A.forEach((h, i) => { h.num = i + 1; h.course = 'abyss'; });
  PC.ABYSS = A;
});
