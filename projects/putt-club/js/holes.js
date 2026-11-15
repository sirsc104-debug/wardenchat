/* Putt Club: the 27 garden holes. Laid out on paper in (x, y), with the tee near y = 0 and the cup up the page.
   Each one has a garden thing of its own (`special`). A round deals a random handful of them. */
(function (PC) {
  'use strict';
  const U = PC.U, TAU = U.TAU;
  const rect = U.rect, rp = U.roundPoly;

  // The part of polygon P from point `from` to point `to`, following its order (used for rails with an open side).
  function openRail(P, from, to) {
    const near = q => P.findIndex(p => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6);
    const i0 = near(from), i1 = near(to);
    if (i0 < 0 || i1 < 0) throw new Error('openRail: point not on polygon');
    const out = [];
    for (let i = i0; ; i = (i + 1) % P.length) { out.push(P[i]); if (i === i1) break; }
    return out;
  }

  // A lane from the tee that opens into a round green (and optionally carries on beyond it).
  function laneCircle(hw, cx, cy, r, top) {
    const dy = Math.sqrt(r * r - hw * hw), yj = cy - dy, yk = cy + dy;
    const P = [], R = [];
    const add = (p, rad) => { P.push(p); R.push(rad); };
    add([-hw, 0], 0.6); add([hw, 0], 0.6); add([hw, yj], 0.45);
    const a0 = Math.atan2(-dy, hw);
    if (!top) {
      U.arc(cx, cy, r, a0, Math.atan2(-dy, -hw) + TAU).slice(1, -1).forEach(p => add(p, 0));
      add([-hw, yj], 0.45);
    } else {
      U.arc(cx, cy, r, a0, Math.atan2(dy, hw)).slice(1, -1).forEach(p => add(p, 0));
      add([hw, yk], 0.45); add([hw, top], 0.8); add([-hw, top], 0.8); add([-hw, yk], 0.45);
      U.arc(cx, cy, r, Math.atan2(dy, -hw), Math.atan2(-dy, -hw) + TAU).slice(1, -1).forEach(p => add(p, 0));
      add([-hw, yj], 0.45);
    }
    return rp(P, R);
  }

  const H = [];

  // 1
  H.push({
    id: 'pinwheel', name: 'Pinwheel Patch', par: 2,
    special: 'Spinning pinwheel',
    tip: 'Four striped vanes turn in the middle. Wait for a gap, or slip around the tips at the sides.',
    look: { rail: 'timber', light: 'day', flowers: ['#ff7aa8', '#ffd23f', '#ffffff', '#b58cff'] },
    tee: [0, 1.3], cup: [0, 13.1],
    floors: [rp([[-1.9, 0], [1.9, 0], [1.9, 5], [3.2, 6.2], [3.2, 9.6], [1.9, 10.8], [1.9, 14.6], [-1.9, 14.6], [-1.9, 10.8], [-3.2, 9.6], [-3.2, 6.2], [-1.9, 5]],
      [0.7, 0.7, 0.5, 0.9, 0.9, 0.5, 0.9, 0.9, 0.5, 0.9, 0.9, 0.5])],
    features: [{ type: 'spinner', x: 0, y: 7.9, arms: 4, len: 2.45, w: 0.14, omega: 1.25, h: 1.1 }],
  });

  // 2
  H.push({
    id: 'sprinkler', name: 'Sprinkler Sweep', par: 3,
    special: 'Turning sprinklers',
    tip: 'Two sprinklers spray across the corner. Their jets shove a rolling ball sideways.',
    look: { rail: 'white', light: 'day', flowers: ['#ff5d73', '#ffb3c6', '#ffffff', '#7ec8ff'] },
    tee: [0, 1.2], cup: [8.6, 9.2],
    floors: [rp([[-2, 0], [2, 0], [2, 7], [10.2, 7], [10.2, 11.4], [-2, 11.4]], [0.7, 0.7, 1.0, 0.9, 0.9, 1.6])],
    features: [
      { type: 'sprinkler', x: 0, y: 9.2, omega: 1.05, range: 4.4, power: 9, spread: 0.26 },
      { type: 'sprinkler', x: 5.6, y: 9.2, omega: -1.5, range: 2.4, power: 7, spread: 0.3, phase: 1.3 },
    ],
  });

  // 3
  const lilyNear = rp(rect(-2.2, 0, 2.2, 5.8), [0.6, 0.6, 0, 0]);
  const lilyFar = rp(rect(-2.2, 11.2, 2.2, 17), [0, 0, 0.7, 0.7]);
  H.push({
    id: 'lilypad', name: 'Lily Pad Ferry', par: 3,
    special: 'A lily pad ferry',
    tip: 'A big lily pad drifts across the pond and waits at each shore. Roll on, ride it over, roll off.',
    look: { rail: 'stone', light: 'spring', flowers: ['#ff9ecf', '#ffffff', '#ffd6e8', '#c9a7ff'] },
    tee: [0, 1.4], cup: [0.9, 15.3],
    floors: [lilyNear, lilyFar],
    rails: [{ pts: openRail(lilyNear, [-2.2, 5.8], [2.2, 5.8]) }, { pts: openRail(lilyFar, [2.2, 11.2], [-2.2, 11.2]) }],
    hazards: [{ kind: 'water', poly: rp(rect(-4.6, 4.6, 4.6, 12.4), 2.0) }],
    features: [{ type: 'ferry', a: [0, 6.85], b: [0, 10.15], r: 1.05, travel: 2.8, pause: 1.9 }],
  });

  // 4
  H.push({
    id: 'moles', name: 'Mole Tunnels', par: 3,
    special: 'Mole tunnels',
    tip: 'A hedge blocks the way. Roll into a molehill and you pop out of its partner on the other side.',
    look: { rail: 'timber', light: 'day', flowers: ['#ffcf3f', '#ff8a3d', '#ffffff', '#9ad0ff'] },
    tee: [0, 1.3], cup: [0, 14.6],
    floors: [rp(rect(-3.4, 0, 3.4, 16.6), 1.0)],
    walls: [{ pts: [[-3.4, 8.2], [3.4, 8.2]], w: 0.42, h: 0.75, style: 'hedge' }],
    features: [{
      type: 'tunnels', r: 0.32, pairs: [
        { a: [-2.0, 5.6], b: [2.3, 10.3], dirA: -Math.PI / 2, dirB: Math.PI / 2 - 0.1 },
        { a: [0, 6.3], b: [-2.4, 10.6], dirA: -Math.PI / 2, dirB: Math.PI / 2 + 0.12 },
        { a: [2.0, 5.6], b: [0, 10.1], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      ],
    }],
  });

  // 5
  H.push({
    id: 'gnomes', name: 'Gnome Parade', par: 3,
    special: 'Marching gnomes',
    tip: 'Three garden gnomes march across the lane. Bump one and it knocks your ball away.',
    look: { rail: 'brick', light: 'day', flowers: ['#ff4d4d', '#ffffff', '#3d8bff', '#ffd23f'] },
    tee: [0, 1.3], cup: [0, 16.6],
    floors: [rp([[-2.2, 0], [2.2, 0], [2.2, 4], [2.7, 5.4], [2.7, 13.6], [2.2, 15], [2.2, 18.2], [-2.2, 18.2], [-2.2, 15], [-2.7, 13.6], [-2.7, 5.4], [-2.2, 4]],
      [0.7, 0.7, 0.6, 0.6, 0.6, 0.6, 0.9, 0.9, 0.6, 0.6, 0.6, 0.6])],
    features: [{
      type: 'patrol', sound: 'bonk', movers: [
        { a: [-2.25, 6.2], b: [2.25, 6.2], period: 4.4, phase: 0, r: 0.34, h: 0.9 },
        { a: [2.25, 9.6], b: [-2.25, 9.6], period: 3.4, phase: 0.3, r: 0.34, h: 0.9 },
        { a: [-2.25, 13], b: [2.25, 13], period: 5.2, phase: 0.6, r: 0.34, h: 0.9 },
      ],
    }],
  });

  // 6
  H.push({
    id: 'pumpkins', name: 'Pumpkin Pinball', par: 2,
    special: 'Bouncy pumpkins',
    tip: 'The pumpkins are springy. Bounce off one and your ball comes away faster than it went in.',
    look: { rail: 'timber', light: 'autumn', flowers: ['#ff8c1a', '#ffd23f', '#c2410c', '#fff1c1'] },
    tee: [0, 1.2], cup: [0, 11.5],
    floors: [rp([[-2.4, 0], [2.4, 0], [3.6, 3], [3.6, 11], [2.2, 12.9], [-2.2, 12.9], [-3.6, 11], [-3.6, 3]], [0.6, 0.6, 1, 1, 1.2, 1.2, 1, 1])],
    features: [{
      type: 'bumpers', list: [
        { x: 0, y: 5.4, r: 0.52 }, { x: -1.6, y: 7.8, r: 0.45 }, { x: 1.6, y: 7.8, r: 0.45 }, { x: 0, y: 9.8, r: 0.3, kick: 1.8, small: true },
      ],
    }],
  });

  // 7
  H.push({
    id: 'mushroom', name: 'Mushroom Hop', par: 3,
    special: 'A springy mushroom',
    tip: 'Roll over the big red mushroom and it bounces your ball over the hedge. Or take the long way round on the right.',
    look: { rail: 'timber', light: 'spring', flowers: ['#ffffff', '#ff6b6b', '#ffe066', '#b2f2bb'] },
    tee: [-0.6, 1.3], cup: [-1.2, 14.6],
    floors: [rp(rect(-2.6, 0, 2.6, 17), [0.8, 0.8, 1, 1])],
    walls: [
      { pts: [[-2.6, 8.6], [1.7, 8.6]], w: 0.4, h: 0.42, style: 'hedge' },
      { pts: [[1.7, 8.6], [1.7, 12.2]], w: 0.3, h: 0.42, style: 'hedge' },
    ],
    features: [{ type: 'launch', x: -0.6, y: 6.4, r: 0.5, vz: 6.2, minSpeed: 3.2 }],
  });

  // 8
  const rampH = (x, y) => (Math.abs(x) < 0.75 && y > 5 && y < 7.2 ? (0.5 * (y - 5)) / 2.2 : 0);
  H.push({
    id: 'wheelbarrow', name: 'Wheelbarrow Jump', par: 3,
    special: 'A wheelbarrow ramp',
    tip: 'Hit it hard up the wheelbarrow to fly over the tulip bed. Too soft and you land in the flowers.',
    look: { rail: 'timber', light: 'day', flowers: ['#ff3b6b', '#ffd23f', '#ff8fc7', '#ffffff'] },
    tee: [0, 1.3], cup: [0.6, 14.2],
    floors: [rp(rect(-2.2, 0, 2.2, 7.2), [0.6, 0.6, 0, 0]), rp(rect(-2.2, 9.2, 2.2, 17), [0, 0, 0.8, 0.8])],
    rails: [{ pts: rp(rect(-2.2, 0, 2.2, 17), [0.6, 0.6, 0.8, 0.8]), closed: true }],
    hazards: [{ kind: 'flowers', poly: rect(-2.3, 7.15, 2.3, 9.25), top: -0.12, bed: -0.4 }],
    height: rampH,
    walls: [
      { pts: [[-0.75, 5], [-0.75, 7.2]], w: 0.06, h: 0, top: (x, y) => rampH(0, y), style: 'none' },
      { pts: [[0.75, 7.2], [0.75, 5]], w: 0.06, h: 0, top: (x, y) => rampH(0, y), style: 'none' },
    ],
    features: [{ type: 'wheelbarrow', x: 0, y0: 5, y1: 7.2, w: 1.5, h: 0.5 }],
  });

  // 9
  H.push({
    id: 'maze', name: 'Hedge Maze', par: 3,
    special: 'A hedge maze',
    tip: 'Wind through the box hedges, or squeeze through the two narrow arches for a shortcut.',
    look: { rail: 'hedge', light: 'day', flowers: ['#ffffff', '#ffb3d1', '#d0bfff', '#fff3a3'] },
    tee: [-3, 1.3], cup: [3.0, 9.1],
    floors: [rp(rect(-4.5, 0, 4.5, 10.6), 0.9)],
    walls: [
      { pts: [[-4.5, 3.5], [-0.95, 3.5]], w: 0.38, h: 0.62, style: 'hedge' },
      { pts: [[-0.2, 3.5], [1.6, 3.5], [1.6, 5.0]], w: 0.38, h: 0.62, style: 'hedge' },
      { pts: [[-1.6, 8.6], [-1.6, 7.0], [0.9, 7.0]], w: 0.38, h: 0.62, style: 'hedge' },
      { pts: [[1.65, 7.0], [4.5, 7.0]], w: 0.38, h: 0.62, style: 'hedge' },
    ],
    features: [{ type: 'maze' }],
  });

  // 10
  const rockeryC = [0, 10.6];
  H.push({
    id: 'rockery', name: 'Rockery Summit', par: 3,
    special: 'A cup on a hilltop',
    tip: 'The cup sits on top of a rockery mound. Too soft rolls back down; too hard rolls off the far side.',
    look: { rail: 'stone', light: 'day', flowers: ['#c084fc', '#f0abfc', '#ffffff', '#fde68a'] },
    tee: [0, 1.3], cup: rockeryC,
    floors: [laneCircle(1.8, 0, rockeryC[1], 4.2)],
    height: (x, y) => 0.6 * (1 - U.smooth(0.45, 2.7, Math.hypot(x - rockeryC[0], y - rockeryC[1]))),
    posts: [-40, -140, 15, 165, 90, 55, 125].map((deg, i) => {
      const a = (deg * Math.PI) / 180;
      return { x: Math.cos(a) * 3.15, y: rockeryC[1] + Math.sin(a) * 3.15, r: [0.4, 0.4, 0.34, 0.34, 0.38, 0.3, 0.3][i], h: 0.45, style: 'rock' };
    }),
    features: [{ type: 'rockery', x: rockeryC[0], y: rockeryC[1] }],
  });

  // 11
  const sunC = [0, 9.8];
  H.push({
    id: 'sunflower', name: 'Sunflower Bowl', par: 2,
    special: 'A sunflower funnel',
    tip: 'The green is a giant sunflower that dips toward the middle. Get it rolling round the seeds and it finds the cup.',
    look: { rail: 'petal', light: 'golden', flowers: ['#ffd60a', '#ffb703', '#fb8500', '#ffffff'] },
    tee: [0, 1.2], cup: sunC,
    floors: [laneCircle(1.6, 0, sunC[1], 4.0)],
    zones: [{ type: 'seeds', poly: U.circle(sunC[0], sunC[1], 3.55, 64) }],
    height: (x, y) => { const d = Math.hypot(x - sunC[0], y - sunC[1]); return d < 3.6 ? -0.4 * Math.pow(1 - d / 3.6, 2) : 0; },
    features: [{ type: 'sunflower', x: sunC[0], y: sunC[1], r: 3.55 }],
  });

  // 12
  H.push({
    id: 'brook', name: 'Babbling Brook', par: 3,
    special: 'A flowing brook',
    tip: 'A shallow brook winds across the green. Drop your ball in and the current carries it downstream toward the cup.',
    look: { rail: 'stone', light: 'spring', flowers: ['#93c5fd', '#ffffff', '#fbcfe8', '#a7f3d0'] },
    tee: [2.0, 1.3], cup: [1.7, 15.2],
    floors: [rp(rect(-3.6, 0, 3.6, 17.2), 1.3)],
    features: [{ type: 'brook', line: [[-2.7, 0.6], [-2.3, 3.0], [1.6, 5.0], [2.5, 7.6], [-1.4, 10.0], [-2.0, 12.5], [0.2, 14.2], [0.9, 14.6]], width: 1.2, depth: 0.14, flow: 3.2 }],
  });

  // 13
  const koiNear = rp(rect(-2.2, 0, 2.2, 6), [0.6, 0.6, 0, 0]);
  const koiFar = rp(rect(-2.4, 11.4, 2.4, 17), [0, 0, 0.8, 0.8]);
  const arch = y => 0.55 * Math.sin((Math.PI * (y - 6)) / 5.4);
  H.push({
    id: 'koi', name: 'Koi Bridge', par: 3,
    special: 'An arched bridge',
    tip: 'Cross the koi pond over the humped bridge. Give it enough to climb the arch, and keep it straight.',
    look: { rail: 'timber', light: 'spring', flowers: ['#ffb7c5', '#ffffff', '#ff8fab', '#e9d5ff'] },
    tee: [0, 1.3], cup: [1.0, 15.0],
    floors: [koiNear, { poly: rect(-0.6, 5.9, 0.6, 11.5), mat: 'planks' }, koiFar],
    rails: [
      { pts: openRail(koiNear, [-2.2, 6], [2.2, 6]) },
      { pts: openRail(koiFar, [2.4, 11.4], [-2.4, 11.4]) },
    ],
    walls: [
      { pts: [[-0.6, 6.0], [-0.6, 11.4]], w: 0.08, h: 0.3, top: (x, y) => arch(y) + 0.3, style: 'none' },
      { pts: [[0.6, 11.4], [0.6, 6.0]], w: 0.08, h: 0.3, top: (x, y) => arch(y) + 0.3, style: 'none' },
    ],
    hazards: [{ kind: 'water', poly: rp(rect(-5, 4.8, 5, 12.6), 2.2) }],
    height: (x, y) => (Math.abs(x) <= 0.62 && y > 6 && y < 11.4 ? arch(y) : 0),
    features: [{ type: 'koi', y0: 6, y1: 11.4, hw: 0.6 }],
  });

  // 14
  H.push({
    id: 'tire', name: 'Tire Swing', par: 3,
    special: 'A swinging tire',
    tip: 'An old tire swings across the lane from the oak tree. Go when it has swung out of the way.',
    look: { rail: 'timber', light: 'golden', flowers: ['#fde047', '#fb7185', '#ffffff', '#86efac'] },
    tee: [0, 1.3], cup: [0, 14.8],
    floors: [rp(rect(-2.2, 0, 2.2, 16.6), [0.7, 0.7, 0.9, 0.9])],
    features: [{ type: 'swing', x: 0, y: 8.4, len: 4.95, zp: 5.4, amp: 0.39, period: 3.6, rt: 0.45 }],
  });

  // 15
  H.push({
    id: 'snail', name: 'Snail Trail', par: 3,
    special: 'A slippery slime trail',
    tip: 'The snail left a glossy trail around the bend. Your ball slides on it much farther than on the grass.',
    look: { rail: 'stone', light: 'spring', flowers: ['#a3e635', '#ffffff', '#f9a8d4', '#fde68a'] },
    tee: [0, 1.2], cup: [-5.9, 10.3],
    floors: [rp([[-1.8, 0], [1.8, 0], [1.8, 12.2], [-7.2, 12.2], [-7.2, 8.4], [-1.8, 8.4]], [0.6, 0.6, 1.6, 0.9, 0.9, 0.9])],
    zones: [{ type: 'slime', poly: U.ribbon(U.catmull([[0.2, 2.2], [0.5, 5.5], [0.2, 8.8], [-1.2, 10.4], [-3.6, 10.6], [-5.0, 10.1]], 8), 0.5) }],
    features: [{ type: 'patrol', sound: 'squish', snail: true, movers: [{ a: [-1.0, 10.3], b: [-3.8, 10.55], period: 16, r: 0.28, h: 0.5 }] }],
  });

  // 16
  H.push({
    id: 'honey', name: 'Honey Pots', par: 3,
    special: 'Sticky honey',
    tip: 'Spilled honey stops a ball dead. Find a line between the puddles.',
    look: { rail: 'timber', light: 'golden', flowers: ['#fbbf24', '#ffffff', '#fb923c', '#fde68a'] },
    tee: [0, 1.3], cup: [1.3, 14.1],
    floors: [rp(rect(-3.4, 0, 3.4, 15.6), 1.1)],
    zones: [
      { type: 'honey', poly: U.blob(0, 6.2, 1.45, 11) },
      { type: 'honey', poly: U.blob(-2.1, 10.1, 1.0, 12) },
      { type: 'honey', poly: U.blob(2.0, 9.7, 1.05, 13) },
      { type: 'honey', poly: U.blob(0.3, 12.4, 0.85, 14) },
    ],
    posts: [{ x: -1.4, y: 13.4, r: 0.46, h: 0.9, style: 'hive' }],
    features: [{ type: 'hive', x: -1.4, y: 13.4 }],
  });

  // 17
  const gustFloor = rp([[-2.2, 0], [2.2, 0], [2.2, 4.4], [1.4, 5.4], [1.4, 12], [2.4, 13], [2.4, 17], [-2.2, 17]], [0.6, 0.6, 0.4, 0, 0, 0.4, 0.8, 0.8]);
  H.push({
    id: 'gust', name: 'Autumn Gust', par: 3,
    special: 'Gusts of wind',
    tip: 'Every few seconds a gust blows leaves across toward the pond. Watch the windsock and putt between gusts.',
    look: { rail: 'timber', light: 'autumn', flowers: ['#f97316', '#facc15', '#dc2626', '#fef3c7'] },
    tee: [0, 1.2], cup: [-0.4, 15.2],
    floors: [gustFloor],
    rails: [{ pts: openRail(gustFloor, [1.4, 12], [1.4, 5.4]) }],
    hazards: [{ kind: 'water', poly: rp(rect(1.3, 4.6, 6.2, 12.8), 1.5) }],
    features: [{ type: 'wind', dir: [1, 0], power: 3.0, period: 6.2, gust: 2.4 }],
  });

  // 18
  H.push({
    id: 'carrots', name: 'Carrot Rows', par: 3,
    special: 'Ridged vegetable rows',
    tip: 'The ball has to cross a dug-over carrot patch. The ridges slow it and steer it along the rows.',
    look: { rail: 'timber', light: 'day', flowers: ['#fb923c', '#ffffff', '#fde047', '#c4b5fd'] },
    tee: [1.2, 1.2], cup: [-1.2, 14.4],
    floors: [rp(rect(-3.2, 0, 3.2, 16.2), 1.0)],
    zones: [{ type: 'soil', poly: rect(-3.25, 4, 3.25, 12) }],
    height: (x, y) => {
      if (y < 4 || y > 12) return 0;
      const a = 0.45, u = y * Math.cos(a) + x * Math.sin(a);
      const fade = U.smooth(4, 4.5, y) * (1 - U.smooth(11.5, 12, y));
      return 0.085 * (0.5 - 0.5 * Math.cos((TAU * u) / 1.15)) * fade;
    },
    features: [{ type: 'carrots', y0: 4, y1: 12, a: 0.45, pitch: 1.15 }],
  });

  // 19
  H.push({
    id: 'daisy', name: 'Lazy Daisy', par: 3,
    special: 'A turning flowerbed',
    tip: 'The daisy in the middle turns slowly and carries your ball round with it. Two pots ride on it too.',
    look: { rail: 'white', light: 'day', flowers: ['#ffffff', '#fde047', '#f472b6', '#93c5fd'] },
    tee: [0, 1.2], cup: [0, 14.8],
    floors: [laneCircle(1.7, 0, 8.0, 3.3, 16.6)],
    features: [{ type: 'turntable', x: 0, y: 8.0, r: 2.6, omega: 0.75, pots: [{ a: 0, d: 1.55, r: 0.3 }, { a: Math.PI, d: 1.55, r: 0.3 }] }],
  });

  // 20
  H.push({
    id: 'pot', name: 'Roving Flowerpot', par: 3,
    special: 'A moving cup',
    tip: 'The cup is set in a flowerpot that slides along a rail. Lead it, so the pot arrives as your ball does.',
    look: { rail: 'brick', light: 'day', flowers: ['#f43f5e', '#ffffff', '#fb7185', '#fde68a'] },
    tee: [0, 1.2], cup: [0, 13.5],
    floors: [rp([[-1.8, 0], [1.8, 0], [1.8, 6], [3.4, 8], [3.4, 15.6], [-3.4, 15.6], [-3.4, 8], [-1.8, 6]], [0.6, 0.6, 0.6, 0.6, 1, 1, 0.6, 0.6])],
    posts: [{ x: -1.7, y: 10.2, r: 0.3, h: 0.6, style: 'pot' }, { x: 1.7, y: 10.2, r: 0.3, h: 0.6, style: 'pot' }],
    features: [{ type: 'movingCup', a: [-2.4, 13.5], b: [2.4, 13.5], period: 7.5 }],
  });

  // 21
  H.push({
    id: 'seesaw', name: 'Seesaw Plank', par: 3,
    special: 'A rocking plank',
    tip: 'The only way over the rain ditch is a plank that rocks side to side. Cross while it is level.',
    look: { rail: 'timber', light: 'day', flowers: ['#60a5fa', '#ffffff', '#facc15', '#f472b6'] },
    tee: [0, 1.3], cup: [0, 15.0],
    floors: [rp(rect(-2.2, 0, 2.2, 6.6), [0.6, 0.6, 0, 0]), rp(rect(-2.2, 10.4, 2.2, 17), [0, 0, 0.8, 0.8])],
    rails: [{ pts: rp(rect(-2.2, 0, 2.2, 17), [0.6, 0.6, 0.8, 0.8]), closed: true }],
    hazards: [{ kind: 'water', poly: rect(-2.3, 6.55, 2.3, 10.45) }],
    features: [{ type: 'seesaw', x0: -0.75, x1: 0.75, y0: 6.45, y1: 10.55, amp: 0.14, period: 3.8 }],
  });

  // 22
  H.push({
    id: 'beanstalk', name: 'Beanstalk Bridge', par: 3,
    special: 'A beanstalk that grows',
    tip: 'Roll over the seed packet and a beanstalk grows across the pond. It only lasts about 14 seconds.',
    look: { rail: 'stone', light: 'day', flowers: ['#86efac', '#ffffff', '#fde047', '#f9a8d4'] },
    tee: [1.4, 1.3], cup: [0.9, 14.6],
    floors: [rp(rect(-3, 0, 3, 6.8), [0.7, 0.7, 0, 0]), rp(rect(-3, 10.2, 3, 16.6), [0, 0, 0.8, 0.8])],
    rails: [{ pts: rp(rect(-3, 0, 3, 16.6), [0.7, 0.7, 0.8, 0.8]), closed: true }],
    hazards: [{ kind: 'water', poly: rect(-3.1, 6.75, 3.1, 10.25) }],
    features: [{ type: 'beanstalk', button: [-2.1, 4.4], br: 0.45, rect: [-0.7, 6.6, 0.7, 10.4], duration: 14, grow: 1.3 }],
  });

  // 23
  H.push({
    id: 'tulips', name: 'Tulip Gates', par: 3,
    special: 'Opening tulip gates',
    tip: 'Each hedge row has one leafy gate that swings open and shut. Time your putt through all three.',
    look: { rail: 'white', light: 'spring', flowers: ['#ef4444', '#f9a8d4', '#facc15', '#ffffff'] },
    tee: [0, 1.2], cup: [0, 16.5],
    floors: [rp(rect(-2.6, 0, 2.6, 18.2), 1.0)],
    walls: [
      { pts: [[-2.6, 5], [-0.6, 5]] }, { pts: [[0.6, 5], [2.6, 5]] },
      { pts: [[-2.6, 9], [0.7, 9]] }, { pts: [[1.9, 9], [2.6, 9]] },
      { pts: [[-2.6, 13], [-1.9, 13]] }, { pts: [[-0.7, 13], [2.6, 13]] },
    ].map(w => Object.assign(w, { w: 0.36, h: 0.55, style: 'hedge' })),
    features: [{
      type: 'gates', list: [
        { a: [-0.6, 5], b: [0.6, 5], period: 3.0, phase: 0 },
        { a: [0.7, 9], b: [1.9, 9], period: 3.6, phase: 0.35 },
        { a: [-1.9, 13], b: [-0.7, 13], period: 2.6, phase: 0.7 },
      ],
    }],
  });

  // 24
  const pegs = [];
  [[5.0, [-2, -0.67, 0.67, 2]], [6.5, [-1.33, 0, 1.33]], [8.0, [-2, -0.67, 0.67, 2]], [9.5, [-1.33, 0, 1.33]], [11.0, [-2, -0.67, 0.67, 2]]]
    .forEach(([y, xs]) => xs.forEach(x => pegs.push({ x, y, r: 0.24, h: 0.6, style: 'pot' })));
  H.push({
    id: 'greenhouse', name: 'Greenhouse Pegs', par: 3,
    special: 'A field of potted plants',
    tip: 'Inside the greenhouse the floor runs downhill through rows of potted plants. Your ball pinballs between them.',
    look: { rail: 'glass', light: 'day', flowers: ['#f472b6', '#ffffff', '#a78bfa', '#fde047'] },
    tee: [0, 1.2], cup: [0.9, 13.6],
    floors: [rp(rect(-3.0, 0, 3.0, 15.4), 0.6)],
    height: (x, y) => 0.7 - 0.045 * U.clamp(y, 0, 15.4),
    posts: pegs,
    features: [{ type: 'greenhouse', x0: -3, x1: 3, y0: 0, y1: 15.4 }],
  });

  // 25
  const trellisFloor = rp(rect(-3.2, 0, 3.2, 11.2), 0.45);
  H.push({
    id: 'trellis', name: 'Trellis Bank', par: 2,
    special: 'Springy rose trellises',
    tip: 'The cup hides behind a rose trellis. The trellis walls are springy, so bank it off the right side.',
    look: { rail: 'trellis', light: 'golden', flowers: ['#e11d48', '#fda4af', '#ffffff', '#fb7185'] },
    tee: [-1.6, 1.2], cup: [-1.9, 9.5],
    floors: [trellisFloor],
    rails: [{ pts: trellisFloor, closed: true, e: 0.93, h: 0.7, style: 'trellis' }],
    walls: [{ pts: [[-3.2, 7.3], [0.1, 7.3]], w: 0.16, h: 0.8, style: 'trellis', e: 0.93 }],
    features: [{ type: 'trellis' }],
  });

  // 26
  H.push({
    id: 'falls', name: 'Terrace Falls', par: 3,
    special: 'Stepped terraces',
    tip: 'Three stone terraces step down beside a waterfall. Your ball drops off each ledge, so allow for the bounce.',
    look: { rail: 'stone', light: 'day', flowers: ['#38bdf8', '#ffffff', '#c4b5fd', '#fda4af'] },
    tee: [0, 1.3], cup: [-0.8, 14.6],
    floors: [rp(rect(-2.8, 0, 2.8, 5.5), [0.9, 0.9, 0, 0]), rect(-2.8, 5.5, 2.8, 11), rp(rect(-2.8, 11, 2.8, 17), [0, 0, 1, 1])],
    rails: [{ pts: rp(rect(-2.8, 0, 2.8, 17), [0.9, 0.9, 1, 1]), closed: true }],
    height: (x, y) => (y < 5.5 ? 1.0 : y < 11 ? 0.5 : 0),
    walls: [
      { pts: [[-2.8, 5.5], [2.8, 5.5]], w: 0.04, h: 0, top: () => 1.0, style: 'none' },
      { pts: [[-2.8, 11], [2.8, 11]], w: 0.04, h: 0, top: () => 0.5, style: 'none' },
    ],
    posts: [{ x: -1.3, y: 8.0, r: 0.36, h: 0.5 }, { x: 1.4, y: 7.2, r: 0.32, h: 0.5 }, { x: 0.2, y: 9.6, r: 0.28, h: 0.5 }],
    features: [{ type: 'falls', steps: [5.5, 11] }],
  });

  // 27
  H.push({
    id: 'dandelion', name: 'Dandelion Boost', par: 3,
    special: 'Dandelion boosters',
    tip: 'Roll over a dandelion clock and its puff blows your ball off the way it points. Chain them up the zigzag.',
    look: { rail: 'timber', light: 'golden', flowers: ['#fde047', '#ffffff', '#facc15', '#a3e635'] },
    tee: [0, 1.2], cup: [0.5, 19.3],
    floors: [rp([[-2, 0], [2, 0], [2, 5], [5.5, 8], [5.5, 12], [2.5, 15], [2.5, 21], [-1.5, 21], [-1.5, 14], [1.5, 11], [1.5, 9], [-2, 6]],
      [0.7, 0.7, 0.9, 0.9, 0.9, 0.9, 1, 1, 0.9, 0.9, 0.9, 0.9])],
    features: [{
      type: 'boost', pads: [
        { x: 0.3, y: 3.6, dir: [3.3, 5.8], power: 8.5 },
        { x: 3.7, y: 10.2, dir: [-2.7, 5.8], power: 8.5 },
        { x: 0.9, y: 16.4, dir: [-0.15, 1], power: 4.5 },
      ],
    }],
  });

  H.forEach((h, i) => { h.num = i + 1; });
  PC.HOLES = H;
  PC.holeById = id => H.find(h => h.id === id);
})(window.PC = window.PC || {});
