/* Putt Club: The Canyon. 27 desert holes for Medium, each built around cacti and tumbleweeds.
   A cactus pops the ball on contact (a penalty stroke, back to where you putted from).
   Tumbleweeds blow round each hole on fixed routes that speed up and slow down like gusts; balls bounce off them. */
(function (mod) { const PC = window.PC = window.PC || {}; mod(PC); (PC.SRC = PC.SRC || []).push(mod); })(function (PC) {
  'use strict';
  const U = PC.U, K = PC.Kit, DEG = Math.PI / 180;
  const rect = U.rect, rp = U.roundPoly;
  const LOOK = (extra) => Object.assign({ theme: 'canyon', light: 'canyon', rail: 'plank', flag: '#d9482b', flowers: ['#ffd23f', '#ff7a3a', '#ff5d8f', '#ffffff'] }, extra || {});

  // Cactus kinds: how wide they are to the ball, and how tall.
  const KIND = { saguaro: [0.3, 2.2], barrel: [0.34, 0.55], pear: [0.42, 0.7], cholla: [0.3, 0.9] };
  const cac = (kind, x, y, r) => ({ kind, x, y, r: r || KIND[kind][0], h: KIND[kind][1] });
  const cacti = list => ({ type: 'cacti', list });
  const weeds = list => ({ type: 'tumbleweeds', list });
  const across = (y, x0, x1, bend = 0.5) => [[x0, y], [(x0 + x1) / 2, y + bend], [x1, y]];
  const ring = (cx, cy, r, n = 10) => { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92]); } return out; };
  // Cacti along a line from a to b, every `step`, skipping any that fall in [gap0, gap1] of the way along.
  const rowOf = (kind, a, b, step, gap0 = 2, gap1 = 2) => {
    const out = [], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) { const t = i / n; if (t > gap0 && t < gap1) continue; out.push(cac(kind, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); }
    return out;
  };
  // A point along a curved line, pushed sideways by `off` (for cacti in the bends of a slot canyon).
  const along = (line, f, off) => {
    const i = Math.min(line.length - 2, Math.floor(f * (line.length - 1))), a = line[i], b = line[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [a[0] - (dy / l) * off, a[1] + (dx / l) * off];
  };

  const H = [];

  // 1
  H.push({
    id: 'saguaro-gate', name: 'Saguaro Gate', par: 3,
    special: 'Two saguaros and a tumbleweed',
    tip: 'Two tall saguaros stand guard in the middle with barrels beside them. Thread the gap between them, then dodge the tumbleweed blowing across behind.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 13.4],
    floors: [rp(rect(-2.4, 0, 2.4, 15.5), 0.9)],
    features: [
      cacti([cac('saguaro', -0.75, 7.6), cac('saguaro', 0.75, 7.6), cac('barrel', -1.85, 7.6), cac('barrel', 1.85, 7.6), cac('barrel', 1.4, 12.4)]),
      weeds([{ path: across(9.9, -1.95, 1.95), speed: 1.5, gust: 0.5 }]),
    ],
  });

  // 2
  H.push({
    id: 'prickly-slalom', name: 'Prickly Slalom', par: 3,
    special: 'Rows of prickly pear',
    tip: 'Three rows of prickly pear each leave one gap, always on the other side. A tumbleweed loops between the rows.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 16.6],
    floors: [rp(rect(-2.6, 0, 2.6, 18.5), 1.0)],
    features: [
      cacti([-2.1, -1.25, -0.4, 0.45].map(x => cac('pear', x, 5)).concat([2.1, 1.25, 0.4, -0.45].map(x => cac('pear', x, 9.5)), [-2.1, -1.25, -0.4, 0.45].map(x => cac('pear', x, 14)))),
      weeds([{ path: [[-1.6, 7.2], [1.7, 7.0], [1.6, 11.8], [-1.7, 12.0]], loop: true, speed: 0.9, gust: 0.6 }]),
    ],
  });

  // 3
  H.push({
    id: 'tumbleweed-alley', name: 'Tumbleweed Alley', par: 3,
    special: 'Three tumbleweeds blowing across',
    tip: 'Three tumbleweeds blow back and forth across a long alley, each in its own rhythm. A bounce off one can send the ball into the barrels along the sides.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 18],
    floors: [rp(rect(-2.2, 0, 2.2, 20), 0.8)],
    features: [
      cacti([cac('barrel', -1.85, 8.2), cac('barrel', 1.85, 8.2), cac('barrel', -1.85, 12.6), cac('barrel', 1.85, 12.6), cac('barrel', 1.5, 16.6)]),
      weeds([
        { path: across(6, -1.75, 1.75), speed: 1.6, gust: 0.7 },
        { path: across(10.4, 1.75, -1.75, -0.4), speed: 1.2, gust: 0.6, phase: 0.4 },
        { path: across(14.6, -1.75, 1.75), speed: 2.0, gust: 0.5, phase: 0.8 },
      ]),
    ],
  });

  // 4
  const ringBarrels = (cx, cy, r, skip) => { const out = []; for (let a = 0; a < 360; a += 20) { if (skip.some(s => Math.abs(((a - s + 540) % 360) - 180) < 25)) continue; out.push(cac('barrel', cx + Math.cos(a * DEG) * r, cy + Math.sin(a * DEG) * r, 0.3)); } return out; };
  H.push({
    id: 'barrel-ring', name: 'Barrel Ring', par: 3,
    special: 'A ring of barrel cacti round the cup',
    tip: 'The cup sits inside a ring of barrel cacti, open only to the east and west. A tumbleweed circles outside the ring.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 10],
    floors: [K.laneCircle(1.6, 0, 10, 4.3)],
    features: [
      cacti(ringBarrels(0, 10, 1.75, [0, 180])),
      weeds([{ path: ring(0, 10, 3.25, 12), loop: true, speed: 1.1, gust: 0.5 }]),
    ],
  });

  // 5
  H.push({
    id: 'cholla-corner', name: 'Cholla Corner', par: 3,
    special: 'Cholla on the inside of a dogleg',
    tip: 'Cholla crowd the inside of the bend, so you cannot cut the corner. One tumbleweed loops in the bend, another blows along the arm to the cup.',
    look: LOOK(), tee: [0, 1.3], cup: [9.4, 9.8],
    floors: [rp([[-2, 0], [2, 0], [2, 7.6], [11, 7.6], [11, 12], [-2, 12]], [0.7, 0.7, 0.9, 0.9, 0.9, 1.6])],
    features: [
      cacti([cac('cholla', 2.5, 8.2), cac('cholla', 3.3, 8.25), cac('cholla', 2.4, 9.0), cac('barrel', 6.2, 11.6)]),
      weeds([
        { path: [[-1.2, 9.2], [0.6, 11.3], [3.6, 10.8], [1.2, 9.6]], loop: true, speed: 1.0, gust: 0.6 },
        { path: across(10.4, 5, 10.2, 0.3), speed: 1.3, gust: 0.6, phase: 0.5 },
      ]),
    ],
  });

  // 6
  H.push({
    id: 'mesa-top', name: 'Mesa Top', par: 3,
    special: 'A mesa with cacti up the ramp',
    tip: 'Putt up the ramp onto the mesa. Barrel cacti line both sides of the ramp, and a tumbleweed blows across the top.',
    look: LOOK(), tee: [0, 1.3], cup: [0.9, 14.6],
    floors: [rp(rect(-2.4, 0, 2.4, 16.5), 0.9)],
    height: (x, y) => 0.6 * U.smooth(6, 9, y),
    features: [
      cacti([cac('barrel', -1.6, 7.4), cac('barrel', 1.6, 7.4), cac('barrel', -2.0, 8.6), cac('barrel', 2.0, 8.6), cac('saguaro', -1.5, 11.6), cac('barrel', -0.6, 14.9)]),
      weeds([{ path: across(12.5, -2.0, 2.0, 0.4), speed: 1.3, gust: 0.6 }]),
    ],
  });

  // 7
  const washH = (x, y) => (y > 6.5 && y < 10.5 ? -0.35 * Math.sin((Math.PI * (y - 6.5)) / 4) : 0);
  H.push({
    id: 'dry-wash', name: 'Dry Wash', par: 3,
    special: 'A dry riverbed full of tumbleweeds',
    tip: 'A dry wash cuts across the hole. Tumbleweeds roll up and down its bed, and cacti wait on both banks.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 15],
    floors: [rp(rect(-3, 0, 3, 17), 1.0)],
    height: washH,
    zones: [{ type: 'sand', poly: rect(-3, 7.4, 3, 9.6) }],
    features: [
      cacti([cac('barrel', -2.2, 6.0), cac('barrel', 0.9, 6.1), cac('barrel', 2.3, 10.9), cac('barrel', -1.0, 11.0), cac('pear', 2.4, 5.4)]),
      weeds([
        { path: [[-2.5, 8.4], [0, 8.7], [2.5, 8.4]], speed: 1.6, gust: 0.6 },
        { path: [[2.5, 8.1], [0, 8.9], [-2.5, 8.9]], speed: 1.0, gust: 0.7, phase: 0.5, r: 0.36 },
      ]),
    ],
  });

  // 8
  H.push({
    id: 'sand-trap-flats', name: 'Sand Trap Flats', par: 3,
    special: 'Sand traps with cacti in them',
    tip: 'Three sand traps, each with a cactus growing in the middle. Sand slows the ball, so a ball that stops short in one may be right next to a cactus.',
    look: LOOK(), tee: [0, 1.3], cup: [1.4, 14.4],
    floors: [rp(rect(-3.4, 0, 3.4, 16.5), 1.2)],
    zones: [{ type: 'sand', poly: U.blob(-1.4, 6, 1.4, 41) }, { type: 'sand', poly: U.blob(1.6, 9.6, 1.5, 42) }, { type: 'sand', poly: U.blob(-1.2, 12.8, 1.2, 43) }],
    features: [
      cacti([cac('saguaro', -1.4, 6), cac('saguaro', 1.6, 9.6), cac('barrel', -1.2, 12.8), cac('pear', 2.6, 5.2), cac('pear', -2.6, 10)]),
      weeds([{ path: [[0, 3.8], [2.6, 7.2], [0.2, 11.2], [-2.4, 8.4]], loop: true, speed: 1.0, gust: 0.6 }]),
    ],
  });

  // 9
  H.push({
    id: 'dust-devil', name: 'Dust Devil', par: 3,
    special: 'Gusts toward a cactus patch',
    tip: 'Every few seconds a gust of dust blows east, toward a patch of cholla along the right. The tumbleweeds blow with it.',
    look: LOOK({ light: 'mesa' }), tee: [0, 1.3], cup: [-1.2, 15],
    floors: [rp(rect(-3, 0, 3, 17), 1.0)],
    features: [
      { type: 'wind', dust: true, dir: [1, 0], power: 2.4, period: 6.0, gust: 2.4 },
      cacti([cac('cholla', 2.4, 5), cac('cholla', 2.5, 7.6), cac('cholla', 2.3, 10.2), cac('cholla', 2.5, 12.8), cac('pear', 1.5, 6.4), cac('pear', 1.6, 11.4)]),
      weeds([
        { path: across(8.8, -2.4, 1.2, 0.3), speed: 1.8, gust: 0.8 },
        { path: across(13.6, -2.4, 1.2, -0.3), speed: 1.5, gust: 0.8, phase: 0.6 },
      ]),
    ],
  });

  // 10
  const slot = U.catmull([[0, 0.6], [0, 4], [2.6, 7.5], [3, 11], [0.6, 14.5], [0, 17.5], [0, 20.6]], 8);
  H.push({
    id: 'rattlesnake-slot', name: 'Rattlesnake Slot', par: 4,
    special: 'A winding slot canyon',
    tip: 'A narrow slot canyon winds back and forth, with cacti tucked into its bends. A tumbleweed rolls up and down the whole slot.',
    look: LOOK({ rail: 'sandstone' }), tee: [0, 1.8], cup: [0, 19.2],
    floors: [U.ribbon(slot, 1.25)],
    features: [
      cacti([along(slot, 0.2, -0.75), along(slot, 0.38, 0.8), along(slot, 0.53, -0.8), along(slot, 0.7, 0.8), along(slot, 0.86, -0.75)].map((p, i) => cac(i % 2 ? 'barrel' : 'cholla', p[0], p[1]))),
      weeds([{ path: slot.filter((p, i) => i % 4 === 0 && p[1] > 5 && p[1] < 17.5), speed: 1.4, gust: 0.6, r: 0.38 }]),
    ],
  });

  // 11
  H.push({
    id: 'saloon-doors', name: 'Saloon Doors', par: 3,
    special: 'Swinging saloon doors',
    tip: 'The only way through the fence is a pair of saloon doors that swing open and shut. Two barrel cacti stand just behind them, and a tumbleweed blows past.',
    look: LOOK(), tee: [0, 1.3], cup: [0.6, 14.4],
    floors: [rp(rect(-2.6, 0, 2.6, 16.5), 0.9)],
    walls: [{ pts: [[-2.6, 8], [-0.6, 8]], w: 0.24, h: 0.55, style: 'plank' }, { pts: [[0.6, 8], [2.6, 8]], w: 0.24, h: 0.55, style: 'plank' }],
    features: [
      { type: 'gates', list: [{ a: [-0.6, 8], b: [0.6, 8], period: 2.8, phase: 0 }] },
      cacti([cac('barrel', -0.95, 9.3), cac('barrel', 0.95, 9.3), cac('pear', -2.0, 12.6)]),
      weeds([{ path: across(11.5, -2.1, 2.1, 0.3), speed: 1.4, gust: 0.6 }]),
    ],
  });

  // 12
  H.push({
    id: 'mine-shaft', name: 'Mine Shaft', par: 3,
    special: 'Mine shafts under a ridge',
    tip: 'A rock ridge blocks the way. Two old mine shafts run under it, but one of them comes out facing a barrel cactus.',
    look: LOOK(), tee: [0, 1.3], cup: [0.8, 14.2],
    floors: [rp(rect(-3, 0, 3, 16.5), 1.0)],
    walls: [{ pts: [[-3, 8], [3, 8]], w: 0.6, h: 0.9, style: 'sandstone' }],
    features: [
      { type: 'tunnels', r: 0.32, mine: true, pairs: [
        { a: [-1.8, 6.4], b: [1.9, 9.6], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
        { a: [1.8, 6.4], b: [-1.9, 9.6], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      ] },
      cacti([cac('barrel', -1.9, 11.0), cac('cholla', 2.5, 12.2), cac('pear', -0.6, 13.4)]),
      weeds([{ path: [[-2.2, 11.8], [0, 13.0], [2.0, 11.4], [0.2, 10.6]], loop: true, speed: 0.9, gust: 0.6, r: 0.38 }]),
    ],
  });

  // 13
  const gNear = rp(rect(-2.4, 0, 2.4, 6.6), [0.7, 0.7, 0, 0]), gFar = rp(rect(-2.4, 11.4, 2.4, 18), [0, 0, 0.9, 0.9]);
  H.push({
    id: 'gulch-bridge', name: 'Gulch Bridge', par: 3,
    special: 'A tumbleweed on a gulch bridge',
    tip: 'A narrow plank bridge crosses a deep gulch, and a tumbleweed rolls back and forth along it. Saguaros wait at the far end.',
    look: LOOK(), tee: [0, 1.3], cup: [0.9, 16.2],
    floors: [gNear, { poly: rect(-0.65, 6.5, 0.65, 11.5), mat: 'planks' }, gFar],
    rails: [{ pts: K.openRail(gNear, [-2.4, 6.6], [2.4, 6.6]) }, { pts: K.openRail(gFar, [2.4, 11.4], [-2.4, 11.4]) }],
    walls: [{ pts: [[-0.65, 6.6], [-0.65, 11.4]], w: 0.1, h: 0.22, style: 'plank' }, { pts: [[0.65, 11.4], [0.65, 6.6]], w: 0.1, h: 0.22, style: 'plank' }],
    hazards: [{ kind: 'chasm', poly: rect(-18, 6.6, 18, 11.4) }],
    features: [
      cacti([cac('saguaro', -1.4, 13), cac('saguaro', 1.4, 13), cac('barrel', -0.8, 15.3), cac('pear', 2.0, 16.9)]),
      weeds([{ path: [[0, 7.0], [0.05, 9], [0, 11.0]], speed: 1.2, gust: 0.6, r: 0.36 }]),
    ],
  });

  // 14
  H.push({
    id: 'rock-arch', name: 'Rock Arch', par: 3,
    special: 'A natural rock arch',
    tip: 'A sandstone arch spans the lane, and prickly pear fill the gaps beside its legs, so the only way is under it. A tumbleweed drifts in and out of the arch.',
    look: LOOK({ light: 'mesa' }), tee: [0, 1.3], cup: [0.3, 14.2],
    floors: [rp(rect(-2.6, 0, 2.6, 16.5), 0.9)],
    posts: [{ x: -1.5, y: 8, r: 0.55, h: 0.9, style: 'sandrock' }, { x: 1.5, y: 8, r: 0.55, h: 0.9, style: 'sandrock' }],
    features: [
      { type: 'arch', x: 0, y: 8, span: 3.0 },
      cacti([cac('pear', -2.25, 8.1), cac('pear', 2.25, 8.1), cac('barrel', -1.2, 13.2), cac('barrel', 1.5, 13.6), cac('barrel', -0.5, 15.4)]),
      weeds([{ path: [[-0.7, 6.4], [0.3, 8], [-0.2, 10.2]], speed: 0.8, gust: 0.7, r: 0.38 }]),
    ],
  });

  // 15
  H.push({
    id: 'cactus-garden', name: 'Cactus Garden', par: 4,
    special: 'Slanting rows of cactus',
    tip: 'Three slanting rows of cactus, each with its gap at the high end. Two tumbleweeds weave through the open ground between them.',
    look: LOOK(), tee: [0, 1.3], cup: [2.2, 19],
    floors: [rp(rect(-3.6, 0, 3.6, 21), 1.2)],
    features: [
      cacti([].concat(rowOf('cholla', [-3.2, 4], [1.2, 6.8], 0.62), rowOf('pear', [3.2, 9.2], [-1.2, 12], 0.8), rowOf('cholla', [-3.2, 14.2], [1.2, 17], 0.62))),
      weeds([
        { path: [[-2.4, 7.4], [0.6, 8.4], [2.6, 7.0], [-0.2, 6.6]], loop: true, speed: 1.0, gust: 0.6, r: 0.38 },
        { path: [[2.6, 13.2], [-0.4, 14.4], [-2.6, 12.0], [0.4, 12.4]], loop: true, speed: 1.1, gust: 0.6, phase: 0.5, r: 0.38 },
      ]),
    ],
  });

  // 16
  H.push({
    id: 'hoodoo-pinball', name: 'Hoodoo Pinball', par: 3,
    special: 'Bouncy hoodoos among cacti',
    tip: 'Springy hoodoo rocks fling the ball about, and barrel cacti stand between them. Bounce off the rocks, never the cacti.',
    look: LOOK({ light: 'mesa' }), tee: [0, 1.3], cup: [0, 12.8],
    floors: [rp([[-2.4, 0], [2.4, 0], [3.6, 3], [3.6, 12], [2.4, 14.5], [-2.4, 14.5], [-3.6, 12], [-3.6, 3]], [0.6, 0.6, 1, 1, 1.2, 1.2, 1, 1])],
    features: [
      { type: 'bumpers', hoodoo: true, list: [{ x: 0, y: 5.6, r: 0.5 }, { x: -1.9, y: 7.8, r: 0.45 }, { x: 1.9, y: 7.8, r: 0.45 }, { x: 0, y: 10.0, r: 0.42 }, { x: -2.3, y: 11.2, r: 0.4 }, { x: 2.3, y: 11.2, r: 0.4 }] },
      cacti([cac('barrel', -1.05, 9.3), cac('barrel', 2.8, 5.0), cac('barrel', -2.9, 4.6), cac('barrel', 2.7, 13.0)]),
      weeds([{ path: [[-2.0, 2.6], [0, 3.6], [2.0, 2.6]], speed: 1.1, gust: 0.6, r: 0.36 }]),
    ],
  });

  // 17
  H.push({
    id: 'dune-ridge', name: 'Dune Ridge', par: 3,
    special: 'Sand dunes and a rolling tumbleweed',
    tip: 'Three dunes ripple across the lane, with prickly pear in the hollows. A tumbleweed rolls up and down over the dunes toward you.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 16.8],
    floors: [rp(rect(-2.6, 0, 2.6, 18.5), 0.9)],
    height: (x, y) => (y > 3.5 && y < 14.9 ? 0.3 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (y - 3.5)) / 3.8)) : 0),
    features: [
      cacti([cac('pear', -1.8, 5.4), cac('pear', 1.9, 9.2), cac('pear', -1.7, 13.0), cac('barrel', 1.6, 5.6), cac('barrel', -1.6, 9.4)]),
      weeds([{ path: [[0.4, 4.0], [-0.3, 9.5], [0.3, 15.0]], speed: 1.4, gust: 0.6 }]),
    ],
  });

  // 18
  H.push({
    id: 'wagon-wheel', name: 'Wagon Wheel', par: 3,
    special: 'A turning wagon-wheel turnstile',
    tip: 'An old wagon wheel turns like a turnstile in the middle. Barrel cacti wait in the side bays where a bounce off a spoke would send you.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 13.6],
    floors: [rp([[-1.9, 0], [1.9, 0], [1.9, 5], [3.4, 6.4], [3.4, 10], [1.9, 11.4], [1.9, 15], [-1.9, 15], [-1.9, 11.4], [-3.4, 10], [-3.4, 6.4], [-1.9, 5]], [0.7, 0.7, 0.5, 0.9, 0.9, 0.5, 0.9, 0.9, 0.5, 0.9, 0.9, 0.5])],
    features: [
      { type: 'spinner', x: 0, y: 8.2, arms: 4, len: 2.45, w: 0.14, omega: 1.1, h: 0.9, wagon: true },
      cacti([cac('barrel', -2.95, 8.2), cac('barrel', 2.95, 8.2), cac('barrel', -1.5, 4.4), cac('barrel', 1.5, 12.0)]),
      weeds([{ path: across(12.6, -1.5, 1.5, 0.3), speed: 1.0, gust: 0.6, r: 0.36 }]),
    ],
  });

  // 19
  const bowlC = [0, 10];
  H.push({
    id: 'coyote-bowl', name: 'Coyote Bowl', par: 2,
    special: 'A bowl with cacti on its slopes',
    tip: 'The green is a bowl that runs down to the cup, but barrel cacti sit on its slopes right where a ball rolls in. A tumbleweed circles the rim.',
    look: LOOK({ light: 'mesa' }), tee: [0, 1.3], cup: bowlC,
    floors: [K.laneCircle(1.6, 0, bowlC[1], 4.4)],
    height: (x, y) => { const d = Math.hypot(x - bowlC[0], y - bowlC[1]); return d < 4.0 ? -0.42 * Math.pow(1 - d / 4.0, 2) : 0; },
    features: [
      cacti([cac('barrel', 0.0, 8.0), cac('barrel', -1.6, 10.9), cac('barrel', 1.7, 10.6), cac('barrel', 0.5, 12.3)]),
      weeds([{ path: ring(0, 10, 3.5, 12), loop: true, speed: 1.2, gust: 0.5 }]),
    ],
  });

  // 20
  const sNear = rp(rect(-2.2, 0, 2.2, 6.6), [0.6, 0.6, 0, 0]), sFar = rp(rect(-2.2, 10.4, 2.2, 17), [0, 0, 0.8, 0.8]);
  H.push({
    id: 'plank-seesaw', name: 'Plank Seesaw', par: 3,
    special: 'A rocking plank over a gulch',
    tip: 'The only way over the gulch is a plank that rocks from side to side. Barrel cacti flank where it lands, and a tumbleweed blows across beyond.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 15.2],
    floors: [sNear, sFar],
    rails: [{ pts: K.openRail(sNear, [-2.2, 6.6], [2.2, 6.6]) }, { pts: K.openRail(sFar, [2.2, 10.4], [-2.2, 10.4]) }],
    hazards: [{ kind: 'chasm', poly: rect(-18, 6.6, 18, 10.4) }],
    features: [
      { type: 'seesaw', x0: -0.75, x1: 0.75, y0: 6.45, y1: 10.55, amp: 0.14, period: 3.6 },
      cacti([cac('barrel', -1.25, 11.4), cac('barrel', 1.25, 11.4), cac('pear', 1.6, 15.8)]),
      weeds([{ path: across(13.3, -1.8, 1.8, 0.3), speed: 1.3, gust: 0.6, r: 0.38 }]),
    ],
  });

  // 21
  const swH = (x, y) => (y < 6.5 ? 1.0 : y < 12.5 ? 0.5 : 0);
  H.push({
    id: 'switchback-trail', name: 'Switchback Trail', par: 4,
    special: 'Ledges with cactus fences',
    tip: 'The trail steps down two ledges. A fence of barrel cacti lines each ledge, with the way down at alternate ends, and a tumbleweed patrols each level.',
    look: LOOK(), tee: [0, 1.3], cup: [-1.2, 17],
    floors: [rp(rect(-2.8, 0, 2.8, 19), 1.0)],
    height: swH,
    walls: [
      { pts: [[-2.8, 6.5], [2.8, 6.5]], w: 0.04, h: 0, top: () => 1.0, style: 'none' },
      { pts: [[-2.8, 12.5], [2.8, 12.5]], w: 0.04, h: 0, top: () => 0.5, style: 'none' },
    ],
    features: [
      cacti([].concat(rowOf('barrel', [-2.45, 6.1], [0.95, 6.1], 0.62), rowOf('barrel', [-0.95, 12.1], [2.45, 12.1], 0.62))),
      weeds([
        { path: across(9.4, -2.3, 2.3, 0.4), speed: 1.3, gust: 0.6, r: 0.38 },
        { path: across(15.2, 2.3, -2.3, 0.3), speed: 1.1, gust: 0.6, phase: 0.4, r: 0.38 },
      ]),
    ],
  });

  // 22
  const twin = [0, 11];
  const eight = [[0, 11], [2.2, 13], [3.3, 11], [2.2, 9], [0, 11], [-2.2, 13], [-3.3, 11], [-2.2, 9]];
  H.push({
    id: 'tumble-twins', name: 'Tumble Twins', par: 3,
    special: 'Two tumbleweeds in a figure of eight',
    tip: 'Four prickly pears guard the cup, leaving gaps on the diagonals, and two tumbleweeds trace a figure of eight right over it.',
    look: LOOK(), tee: [0, 1.3], cup: twin,
    floors: [K.laneCircle(1.8, 0, 11, 4.8)],
    features: [
      cacti([cac('pear', 1.35, 11), cac('pear', -1.35, 11), cac('pear', 0, 12.35), cac('pear', 0, 9.65)]),
      weeds([{ path: eight, loop: true, speed: 1.1, gust: 0.5, r: 0.36 }, { path: eight, loop: true, speed: 1.1, gust: 0.5, phase: 1.9, r: 0.36 }]),
    ],
  });

  // 23
  H.push({
    id: 'box-canyon', name: 'Box Canyon', par: 3,
    special: 'A cactus wall with one gap',
    tip: 'A wall of barrel cacti cuts across the box canyon with one narrow gap at the right, and a tumbleweed patrols right in front of it.',
    look: LOOK({ rail: 'sandstone' }), tee: [0, 1.3], cup: [-2.2, 12.4],
    floors: [rp(rect(-4, 0, 4, 14.5), 0.8)],
    features: [
      cacti([].concat(rowOf('barrel', [-3.65, 9], [1.45, 9], 0.6), [cac('barrel', 3.2, 9), cac('barrel', 3.72, 9), cac('saguaro', -3.3, 13.6)])),
      weeds([{ path: [[0.6, 7.7], [2.2, 7.4], [3.6, 7.7]], speed: 1.4, gust: 0.7 }]),
    ],
  });

  // 24
  H.push({
    id: 'oasis', name: 'Oasis', par: 3,
    special: 'An oasis pool among cacti',
    tip: 'A spring-fed pool fills the middle of the green, with palms beyond and cacti on its banks. A tumbleweed blows round the water.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 14.2],
    floors: [K.laneCircle(1.8, 0, 10.5, 5.0)],
    hazards: [{ kind: 'water', over: true, poly: U.blob(0, 10.4, 1.9, 31, 0.14) }],
    features: [
      { type: 'oasis', x: 0, y: 10.4 },
      cacti([cac('pear', -2.5, 8.0), cac('pear', 2.6, 12.4), cac('barrel', 2.7, 8.4), cac('barrel', -2.3, 12.9)]),
      weeds([{ path: ring(0, 10.4, 3.0, 12), loop: true, speed: 1.0, gust: 0.6, r: 0.38 }]),
    ],
  });

  // 25
  H.push({
    id: 'ghost-town', name: 'Ghost Town', par: 4,
    special: 'Fences and saloon doors down main street',
    tip: 'Main street is fenced into three stretches: saloon doors through the first fence, an open gap in the second with a tumbleweed rolling past, and doors again in the third.',
    look: LOOK(), tee: [0, 1.3], cup: [1.8, 19.4],
    floors: [rp(rect(-3.4, 0, 3.4, 21), 1.0)],
    walls: [
      { pts: [[-3.4, 6], [1.4, 6]], w: 0.24, h: 0.55, style: 'plank' }, { pts: [[2.6, 6], [3.4, 6]], w: 0.24, h: 0.55, style: 'plank' },
      { pts: [[-1.4, 12], [3.4, 12]], w: 0.24, h: 0.55, style: 'plank' },
      { pts: [[-3.4, 17], [-0.6, 17]], w: 0.24, h: 0.55, style: 'plank' }, { pts: [[0.6, 17], [3.4, 17]], w: 0.24, h: 0.55, style: 'plank' },
    ],
    features: [
      { type: 'gates', list: [{ a: [1.4, 6], b: [2.6, 6], period: 3.0, phase: 0 }, { a: [-0.6, 17], b: [0.6, 17], period: 2.6, phase: 0.5 }] },
      cacti([cac('barrel', 1.3, 7.3), cac('barrel', 3.0, 7.6), cac('barrel', -3.0, 13.2), cac('pear', 1.6, 14.2), cac('barrel', -0.95, 18.2), cac('barrel', 3.0, 17.9)]),
      weeds([
        { path: across(9.2, -2.9, 2.9, 0.4), speed: 1.6, gust: 0.7 },
        { path: [[-2.0, 10.6], [-2.2, 12], [-1.8, 13.6]], speed: 1.0, gust: 0.6, phase: 0.3, r: 0.38 },
        { path: across(15.0, 2.9, -2.9, 0.3), speed: 1.3, gust: 0.6, phase: 0.7 },
      ]),
      { type: 'town' },
    ],
  });

  // 26
  const rim = rect(-1.6, 0, 1.6, 18.5);
  H.push({
    id: 'canyon-rim', name: 'Canyon Rim', par: 3,
    special: 'A lane along a cliff edge',
    tip: 'The left side of this lane is the edge of the canyon, with no rail. Cacti line the safe side, and tumbleweeds keep blowing toward the drop.',
    look: LOOK({ light: 'mesa' }), tee: [0.4, 1.3], cup: [0.3, 16.6],
    floors: [rim],
    rails: [{ pts: K.openRail(rim, [-1.6, 0], [-1.6, 18.5]) }],
    hazards: [{ kind: 'chasm', poly: rect(-20, -6, -1.6, 26) }],
    features: [
      cacti([cac('pear', 1.15, 4.2), cac('cholla', 1.2, 6.4), cac('pear', 1.15, 8.8), cac('cholla', 1.2, 11.2), cac('pear', 1.1, 13.4)]),
      weeds([
        { path: [[1.0, 5.4], [-0.2, 5.6], [-1.3, 5.3]], speed: 1.2, gust: 0.7, r: 0.36 },
        { path: [[1.0, 10.0], [-0.2, 10.2], [-1.3, 9.9]], speed: 1.0, gust: 0.7, phase: 0.5, r: 0.36 },
        { path: [[1.0, 14.6], [-0.2, 14.8], [-1.3, 14.5]], speed: 1.3, gust: 0.7, phase: 0.2, r: 0.36 },
      ]),
    ],
  });

  // 27
  const mesaH = (x, y) => {
    if (y >= 14) return 0.7;
    if (y > 11 && Math.abs(x) < 1.0) return 0.7 * (y - 11) / 3;
    return 0;
  };
  H.push({
    id: 'sunset-mesa', name: 'Sunset Mesa', par: 4,
    special: 'A mesa climb at sunset',
    tip: 'The finale: one narrow ramp climbs the mesa between barrel cacti, with a tumbleweed rolling up and down it. On top, saguaros and another tumbleweed guard the cup.',
    look: LOOK({ light: 'mesa', cell: 0.12 }), tee: [0, 1.3], cup: [1, 20.4],
    floors: [rp(rect(-3.6, 0, 3.6, 22), 1.2)],
    height: mesaH,
    walls: [
      { pts: [[-3.6, 14], [-1.0, 14]], w: 0.04, h: 0, top: () => 0.7, style: 'none' },
      { pts: [[1.0, 14], [3.6, 14]], w: 0.04, h: 0, top: () => 0.7, style: 'none' },
      { pts: [[-1.0, 11], [-1.0, 14]], w: 0.04, h: 0, top: (x, y) => 0.7 * (y - 11) / 3, style: 'none' },
      { pts: [[1.0, 14], [1.0, 11]], w: 0.04, h: 0, top: (x, y) => 0.7 * (y - 11) / 3, style: 'none' },
    ],
    features: [
      { type: 'mesa', y0: 11, y1: 14, hw: 1.0, top: 0.7 },
      cacti([cac('barrel', -1.5, 10.5), cac('barrel', 1.5, 10.5), cac('pear', -2.6, 6.2), cac('saguaro', -2.0, 17), cac('saguaro', 2.4, 18.4), cac('pear', -0.9, 19.8)]),
      weeds([
        { path: across(7, -3.0, 3.0, 0.5), speed: 1.6, gust: 0.7 },
        { path: [[0, 9.2], [0.1, 12.5], [0, 15.6]], speed: 1.0, gust: 0.6, phase: 0.4, r: 0.36 },
        { path: [[-2.6, 16.2], [0, 17.6], [2.8, 16.4], [0.4, 15.4]], loop: true, speed: 1.1, gust: 0.6, phase: 0.8, r: 0.38 },
      ]),
    ],
  });

  H.forEach((h, i) => { h.num = i + 1; h.course = 'canyon'; });
  PC.CANYON = H;
});
