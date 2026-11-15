/* Putt Club: the Winter Wonderland. 27 snowy holes for Hard, among gingerbread houses and candy canes.
   Ice keeps the ball sliding, snowdrifts stop it dead, and thin ice breaks 4 seconds after a ball first rolls onto it
   (and stays broken). Penguins slide across the lanes and snowballs roll downhill, growing as they go. */
(function (mod) { const PC = window.PC = window.PC || {}; mod(PC); (PC.SRC = PC.SRC || []).push(mod); })(function (PC) {
  'use strict';
  const U = PC.U, K = PC.Kit, DEG = Math.PI / 180;
  const rect = U.rect, rp = U.roundPoly;
  const LOOK = (extra) => Object.assign({ theme: 'winter', light: 'winter', rail: 'candy', flag: '#d42a3a', flowers: ['#d42a3a', '#ffffff', '#2f9a5a', '#f2c94c'] }, extra || {});

  const ice = poly => ({ type: 'ice', poly });
  const drift = poly => ({ type: 'snow', poly });
  const cane = (x, y) => ({ x, y, r: 0.14, h: 1.1, style: 'cane' });
  const snowman = (x, y, r = 0.34) => ({ x, y, r, h: 1.2, style: 'snowman' });
  const penguins = movers => ({ type: 'patrol', penguins: true, sound: 'bonk', movers: movers.map(m => Object.assign({ r: 0.28, h: 0.6 }, m)) });
  const across = (y, x0, x1, period, phase = 0) => ({ a: [x0, y], b: [x1, y], period, phase });
  const snowballs = list => ({ type: 'snowballs', list: list.map(w => Object.assign({ r0: 0.12, r1: 0.42, travel: 4, rest: 1.4 }, w)) });
  // Thin ice: a sheet over cold water. Returns the water to add to hazards and the feature that holds it up.
  const thin = polys => ({ water: polys.map(p => ({ kind: 'water', over: true, cold: true, poly: p })), feat: { type: 'thinice', list: polys.map(p => ({ poly: p })) } });

  const H = [];

  // 1
  H.push({
    id: 'candy-cane-lane', name: 'Candy Cane Lane', par: 3,
    special: 'A candy cane slalom on ice',
    tip: 'The lane turns right across a slick patch of ice, so the ball keeps sliding long after you expect, and candy canes stand in a slalom on both legs. A penguin slides across the corner.',
    look: LOOK(), tee: [0, 1.3], cup: [3.8, 14.8],
    floors: [rp([[-2.2, 0], [2.2, 0], [2.2, 7], [6, 7], [6, 16.6], [1.6, 16.6], [1.6, 10.8], [-2.2, 10.8]], [0.8, 0.8, 0, 0.9, 0.9, 0.9, 0, 0.9])],
    zones: [ice(rect(-2.2, 7.0, 6.0, 10.8))],
    posts: [cane(-1.2, 4.2), cane(1.1, 5.6), cane(4.6, 11.8), cane(2.9, 12.8), cane(4.9, 13.6)],
    features: [penguins([across(9.0, 2.6, 5.5, 2.6)])],
  });

  // 2
  H.push({
    id: 'penguin-parade', name: 'Penguin Parade', par: 3,
    special: 'Three sliding penguins',
    tip: 'Three penguins belly-slide across the lane, each at its own pace, and two gingerbread fences leave gaps on opposite sides with ice between them. Time each gap.',
    look: LOOK(), tee: [0, 1.3], cup: [-0.8, 15.6],
    floors: [rp(rect(-2.6, 0, 2.6, 17.5), 1.0)],
    walls: [{ pts: [[-1.0, 7.0], [2.6, 7.0]], w: 0.26, h: 0.6, style: 'gingerbread' }, { pts: [[-2.6, 11.0], [1.0, 11.0]], w: 0.26, h: 0.6, style: 'gingerbread' }],
    zones: [ice(rect(-2.6, 7.2, 2.6, 10.8))],
    posts: [snowman(1.5, 15.4)],
    features: [penguins([across(5.2, -2.15, 2.15, 3.0), across(9.0, 2.15, -2.15, 2.4, 0.3), across(12.8, -2.15, 2.15, 3.6, 0.6)])],
  });

  // 3
  const crossPond = rp(rect(-3.6, 6.2, 1.8, 10.8), [0, 0.8, 0.8, 0]);
  const crossIce = thin([crossPond]);
  H.push({
    id: 'thin-ice-crossing', name: 'Thin Ice Crossing', par: 3,
    special: 'Thin ice across a frozen pond',
    tip: 'A frozen pond fills most of the lane. Its ice holds a ball for 4 seconds after it first rolls on, then breaks for good: cross in one go, or take the snowy path on the right and wade through its drift. A snowbank hides the cup, so come round its right end.',
    look: LOOK(), tee: [0, 1.3], cup: [-2.0, 14.8],
    floors: [rp(rect(-3.6, 0, 3.6, 17), 1.0)],
    hazards: crossIce.water,
    walls: [{ pts: [[-3.6, 12.6], [1.0, 12.6]], w: 0.45, h: 0.55, style: 'snowbank' }],
    zones: [drift(rect(2.0, 7.6, 3.6, 9.4))],
    posts: [snowman(2.6, 15.4)],
    features: [crossIce.feat],
  });

  // 4
  H.push({
    id: 'gingerbread-village', name: 'Gingerbread Village', par: 4,
    special: 'Tunnels through gingerbread houses',
    tip: 'A gingerbread wall blocks the way. Roll in at the door of a gingerbread house and you come out of the one across the wall, but one of them opens right in front of a snowman. Then thread the gap in the snowbank while the penguin slides across it.',
    look: LOOK(), tee: [0, 1.3], cup: [-1.6, 14.8],
    floors: [rp(rect(-3, 0, 3, 16.5), 1.0)],
    walls: [{ pts: [[-3, 8], [3, 8]], w: 0.7, h: 1.0, style: 'gingerbread' }, { pts: [[-3, 12.2], [-0.6, 12.2]], w: 0.45, h: 0.55, style: 'snowbank' }, { pts: [[0.6, 12.2], [3, 12.2]], w: 0.45, h: 0.55, style: 'snowbank' }],
    posts: [snowman(1.9, 10.6)],
    features: [
      { type: 'tunnels', r: 0.32, ginger: true, pairs: [
        { a: [-1.8, 6.4], b: [1.9, 9.7], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
        { a: [1.8, 6.4], b: [-1.9, 9.7], dirA: -Math.PI / 2, dirB: Math.PI / 2 },
      ] },
      penguins([across(13.1, -1.2, 1.2, 2.6)]),
      { type: 'village' },
    ],
  });

  // 5
  H.push({
    id: 'snowball-slope', name: 'Snowball Slope', par: 3,
    special: 'Snowballs rolling down at you',
    tip: 'Putt uphill while snowballs roll down three lanes toward you, speeding up and growing as they come. One will knock the ball right back down.',
    look: LOOK(), tee: [0, 1.3], cup: [0.9, 16.6],
    floors: [rp(rect(-2.6, 0, 2.6, 18.5), 1.0)],
    height: (x, y) => 1.1 * U.smooth(3, 15, y),
    features: [snowballs([
      { path: [[-1.4, 17.6], [-1.4, 2.2]], travel: 4.2, rest: 1.2 },
      { path: [[0.2, 17.6], [0.2, 2.2]], travel: 3.6, rest: 1.8, phase: 0.4 },
      { path: [[1.7, 17.0], [1.7, 2.2]], travel: 4.8, rest: 0.8, phase: 0.7 },
    ])],
  });

  // 6
  H.push({
    id: 'gumdrop-pinball', name: 'Gumdrop Pinball', par: 3,
    special: 'Bouncy gumdrops on ice',
    tip: 'Springy gumdrops fling the ball about, and the ice under the first ones means nothing slows it down. Candy canes stand between them, and a gingerbread fence guards the front of the cup.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 12.8],
    floors: [rp([[-2.4, 0], [2.4, 0], [3.6, 3], [3.6, 12], [2.4, 14.5], [-2.4, 14.5], [-3.6, 12], [-3.6, 3]], [0.6, 0.6, 1, 1, 1.2, 1.2, 1, 1])],
    zones: [ice(rect(-3.6, 4.4, 3.6, 8.8))],
    walls: [{ pts: [[-1.1, 11.9], [1.1, 11.9]], w: 0.24, h: 0.5, style: 'gingerbread' }],
    posts: [cane(-1.05, 9.3), cane(-2.9, 4.4)],
    features: [{ type: 'bumpers', gumdrop: true, list: [{ x: 0, y: 5.6, r: 0.5 }, { x: -1.9, y: 7.8, r: 0.45 }, { x: 1.9, y: 7.8, r: 0.45 }, { x: 0, y: 10.0, r: 0.42 }, { x: -2.3, y: 11.2, r: 0.4 }, { x: 2.3, y: 11.2, r: 0.4 }] }],
  });

  // 7
  H.push({
    id: 'peppermint-twist', name: 'Peppermint Twist', par: 3,
    special: 'A peppermint turnstile',
    tip: 'A giant peppermint turns like a turnstile in the middle. Snowdrifts fill the side bays, so a bounce off a vane can leave you stuck in the snow.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 13.6],
    floors: [rp([[-1.9, 0], [1.9, 0], [1.9, 5], [3.4, 6.4], [3.4, 10], [1.9, 11.4], [1.9, 15], [-1.9, 15], [-1.9, 11.4], [-3.4, 10], [-3.4, 6.4], [-1.9, 5]], [0.7, 0.7, 0.5, 0.9, 0.9, 0.5, 0.9, 0.9, 0.5, 0.9, 0.9, 0.5])],
    zones: [drift(rect(-3.4, 6.6, -2.5, 9.8)), drift(rect(2.5, 6.6, 3.4, 9.8))],
    posts: [cane(-1.5, 4.4), cane(1.5, 12.0)],
    features: [{ type: 'spinner', x: 0, y: 8.2, arms: 4, len: 2.45, w: 0.14, omega: 1.1, h: 0.9, peppermint: true }],
  });

  // 8
  H.push({
    id: 'frozen-pond', name: 'Frozen Pond', par: 2,
    special: 'A skating pond with snowmen',
    tip: 'A frozen pond fills the round green, with snowmen standing on the ice and a penguin skating past the far side. The cup sits out on the ice behind a snowman, and the ice carries the ball a long way.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 13.3],
    floors: [K.laneCircle(1.8, 0, 10.5, 5.0)],
    zones: [ice(U.circle(0, 10.2, 3.6))],
    posts: [snowman(0, 8.0), snowman(-1.7, 10.4), snowman(1.6, 11.2), snowman(0, 11.7, 0.3)],
    features: [penguins([across(12.6, -2.6, 2.6, 4.0)]), { type: 'rink' }],
  });

  // 9
  const floeNear = rp(rect(-2.2, 0, 2.2, 5.8), [0.6, 0.6, 0, 0]), floeFar = rp(rect(-2.2, 11.2, 2.2, 17), [0, 0, 0.7, 0.7]);
  H.push({
    id: 'ice-floe-ferry', name: 'Ice Floe Ferry', par: 3,
    special: 'An ice floe across freezing water',
    tip: 'An ice floe drifts across the freezing water and waits at each bank. Roll on, ride it over, roll off, past the penguin on the far side.',
    look: LOOK(), tee: [0, 1.3], cup: [0.9, 15.3],
    floors: [floeNear, floeFar],
    rails: [{ pts: K.openRail(floeNear, [-2.2, 5.8], [2.2, 5.8]) }, { pts: K.openRail(floeFar, [2.2, 11.2], [-2.2, 11.2]) }],
    hazards: [{ kind: 'water', cold: true, poly: rp(rect(-4.6, 4.6, 4.6, 12.4), 2.0) }],
    posts: [snowman(-1.3, 15.9)],
    features: [{ type: 'ferry', a: [0, 6.85], b: [0, 10.15], r: 1.05, travel: 2.8, pause: 1.9, floe: true }, penguins([across(13.4, -1.7, 1.7, 3.0)])],
  });

  // 10
  H.push({
    id: 'ski-jump', name: 'Ski Jump', par: 3,
    special: 'A ski jump over a snowdrift',
    tip: 'Putt up the ski jump fast enough to fly the deep snowdrift beyond it. Too soft and the ball drops into the snow and stops dead.',
    look: LOOK(), tee: [0, 1.3], cup: [0.2, 15.6],
    floors: [rp(rect(-2.4, 0, 2.4, 18), 0.9)],
    height: (x, y) => (y < 3 ? 0 : y < 7.4 ? 0.6 * (y - 3) / 4.4 : 0),
    walls: [{ pts: [[-2.4, 7.4], [2.4, 7.4]], w: 0.04, h: 0, top: () => 0.6, style: 'none' }],
    zones: [drift(rect(-2.4, 7.6, 2.4, 10.0))],
    posts: [cane(-1.3, 12.6), cane(1.4, 13.4)],
    features: [{ type: 'launch', x: 0, y: 7.0, r: 0.6, vz: 5.0, minSpeed: 3.6, maxSpeed: 4.8, land: [0, 11], ski: true }],
  });

  // 11
  const pass = rect(-1.8, 0, 1.8, 19);
  H.push({
    id: 'blizzard-pass', name: 'Blizzard Pass', par: 4,
    special: 'Gusts toward a snowy drop',
    tip: 'The left side of the pass drops away with no rail, and every few seconds a blizzard gust blows toward the edge. Snowbanks jut out from the safe side, so the only way past each is right along the edge. Shelter in the drifts, or putt between gusts.',
    look: LOOK(), tee: [0.4, 1.3], cup: [0.4, 17.4],
    floors: [pass],
    rails: [{ pts: K.openRail(pass, [-1.8, 0], [-1.8, 19]) }],
    hazards: [{ kind: 'chasm', poly: rect(-20, -6, -1.8, 26) }],
    walls: [{ pts: [[1.8, 6.4], [-0.5, 6.4]], w: 0.45, h: 0.55, style: 'snowbank' }, { pts: [[1.8, 12.4], [-0.5, 12.4]], w: 0.45, h: 0.55, style: 'snowbank' }],
    zones: [drift(rect(0.9, 4.2, 1.8, 5.8)), drift(rect(0.9, 10.2, 1.8, 11.8))],
    features: [{ type: 'wind', snow: true, dir: [-1, 0], power: 2.6, period: 5.5, gust: 2.2 }],
  });

  // 12
  H.push({
    id: 'snowman-alley', name: 'Snowman Alley', par: 3,
    special: 'A crowd of snowmen',
    tip: 'Snowmen stand all over the alley, so there is no straight line to the cup, then a gingerbread fence with one gap in the middle and a penguin sliding across it.',
    look: LOOK(), tee: [0, 1.3], cup: [-1.7, 15.4],
    floors: [rp(rect(-2.8, 0, 2.8, 17), 1.0)],
    walls: [{ pts: [[-2.8, 12.6], [-0.7, 12.6]], w: 0.26, h: 0.6, style: 'gingerbread' }, { pts: [[0.7, 12.6], [2.8, 12.6]], w: 0.26, h: 0.6, style: 'gingerbread' }],
    posts: [snowman(-1.6, 5.0), snowman(0.3, 5.8), snowman(1.9, 7.2), snowman(-0.9, 8.8), snowman(1.1, 10.2), snowman(-1.8, 11.2)],
    features: [penguins([across(13.4, -1.2, 1.2, 2.4)])],
  });

  // 13
  const swNear = rp(rect(-2.2, 0, 2.2, 5.6), [0.6, 0.6, 0, 0]), swFar = rp(rect(-2.2, 11.4, 2.2, 17), [0, 0, 0.7, 0.7]);
  H.push({
    id: 'ornament-swing', name: 'Ornament Swing', par: 3,
    special: 'A giant bauble over an ice bridge',
    tip: 'A narrow bridge of slick ice crosses freezing water with no rails, and a giant Christmas bauble swings across it from a candy cane arch.',
    look: LOOK(), tee: [0, 1.3], cup: [0.8, 15.2],
    floors: [swNear, rect(-0.7, 5.5, 0.7, 11.5), swFar],
    rails: [{ pts: K.openRail(swNear, [-2.2, 5.6], [2.2, 5.6]) }, { pts: K.openRail(swFar, [2.2, 11.4], [-2.2, 11.4]) }],
    hazards: [{ kind: 'water', cold: true, poly: rp(rect(-4.6, 4.4, 4.6, 12.6), 1.6) }],
    zones: [ice(rect(-0.7, 5.6, 0.7, 11.4))],
    posts: [snowman(-1.3, 14.0)],
    features: [{ type: 'swing', x: 0, y: 8.5, len: 4.95, zp: 5.4, amp: 0.39, period: 3.4, rt: 0.45, bauble: true }],
  });

  // 14
  const run = [[0, 0.6], [0, 5], [2.5, 8], [2.5, 11], [-0.5, 14], [-0.5, 17], [1.5, 20], [1.5, 22.6]];
  H.push({
    id: 'toboggan-run', name: 'Toboggan Run', par: 3,
    special: 'A winding icy toboggan run',
    tip: 'A toboggan run winds downhill all the way, icy on its straights, so the ball picks up speed. Bank it round each bend without flying into the next.',
    look: LOOK(), tee: [0, 1.3], cup: [1.5, 21.6],
    floors: [U.ribbon(run, 1.3)],
    height: (x, y) => 1.5 * (1 - U.smooth(1, 22, y)),
    zones: [ice(rect(-1.4, 1.5, 1.4, 4.6)), ice(rect(-1.9, 14.2, 0.9, 16.8))],
    features: [],
  });

  // 15
  H.push({
    id: 'ice-rink', name: 'Ice Rink', par: 3,
    special: 'A turning ice rink',
    tip: 'The rink in the middle turns slowly and carries the ball round with it, and two snowmen ride on it too. Beyond it a snowbank leaves a way through on the right only.',
    look: LOOK(), tee: [0, 1.2], cup: [-1.0, 14.8],
    floors: [K.laneCircle(1.7, 0, 8.0, 3.3, 16.6)],
    walls: [{ pts: [[-3.3, 11.8], [0.6, 11.8]], w: 0.45, h: 0.55, style: 'snowbank' }],
    features: [{ type: 'turntable', x: 0, y: 8.0, r: 2.6, omega: 0.75, rink: true, pots: [{ a: 0, d: 1.55, r: 0.3 }, { a: Math.PI, d: 1.55, r: 0.3 }] }],
  });

  // 16
  H.push({
    id: 'sleigh-ride', name: 'Sleigh Ride', par: 2,
    special: 'The cup rides on a sleigh',
    tip: 'The cup is set in a sleigh that glides from side to side. The approach is icy, and a gingerbread fence leaves gaps only at the two ends, so come in at an angle, lead the sleigh and putt softer than you think.',
    look: LOOK(), tee: [0, 1.2], cup: [0, 13.5],
    floors: [rp([[-1.8, 0], [1.8, 0], [1.8, 6], [3.4, 8], [3.4, 15.6], [-3.4, 15.6], [-3.4, 8], [-1.8, 6]], [0.6, 0.6, 0.6, 0.6, 1, 1, 0.6, 0.6])],
    zones: [ice(rect(-1.8, 3.6, 1.8, 7.4))],
    walls: [{ pts: [[-2.0, 11.4], [2.0, 11.4]], w: 0.26, h: 0.6, style: 'gingerbread' }],
    posts: [cane(-1.7, 9.6), cane(1.7, 9.6)],
    features: [{ type: 'movingCup', a: [-2.4, 13.5], b: [2.4, 13.5], period: 7.5, sleigh: true }],
  });

  // 17
  const uFloor = [[-2.2, 0], [1.4, 0], [1.4, 10.4], [5.6, 10.4], [5.6, 0], [9.2, 0], [9.2, 14.5], [-2.2, 14.5]];
  H.push({
    id: 'cracking-shortcut', name: 'Cracking Shortcut', par: 3,
    special: 'A thin ice shortcut',
    tip: 'The course goes up, across and back down round a frozen lake. Straight across the lake is far shorter, but the thin ice breaks 4 seconds after your ball first touches it and never comes back.',
    look: LOOK(), tee: [-0.4, 1.3], cup: [7.4, 1.9],
    floors: [uFloor],
    rails: [{ pts: K.openRail(uFloor, [5.6, 0], [1.4, 0]) }],
    hazards: [{ kind: 'water', cold: true, poly: rect(1.4, -1.2, 5.6, 10.4) }],
    posts: [snowman(-0.4, 12.2), snowman(7.4, 12.2)],
    features: [{ type: 'thinice', list: [{ poly: rect(1.4, 0, 5.6, 10.4) }] }, penguins([across(12.4, 1.6, 5.4, 3.4)])],
  });

  // 18
  H.push({
    id: 'avalanche', name: 'Avalanche', par: 3,
    special: 'Four lanes of snowballs',
    tip: 'Snowballs pour down four lanes of a steep slope. Two snowdrifts give you somewhere to stop on the way up, if you can get out of them again.',
    look: LOOK(), tee: [0, 1.3], cup: [-0.4, 17.6],
    floors: [rp(rect(-3.4, 0, 3.4, 19), 1.1)],
    height: (x, y) => 1.3 * U.smooth(2.5, 16, y),
    zones: [drift(rect(-2.0, 7.0, -1.2, 8.2)), drift(rect(1.2, 11.0, 2.0, 12.2))],
    features: [snowballs([
      { path: [[-2.3, 18.3], [-2.3, 2.0]], travel: 3.6, rest: 1.0 },
      { path: [[-0.75, 18.3], [-0.75, 2.0]], travel: 4.4, rest: 0.6, phase: 0.35 },
      { path: [[0.8, 18.3], [0.8, 2.0]], travel: 3.4, rest: 1.4, phase: 0.6 },
      { path: [[2.3, 18.3], [2.3, 2.0]], travel: 4.6, rest: 0.8, phase: 0.15 },
    ])],
  });

  // 19
  H.push({
    id: 'candy-cane-gates', name: 'Candy Cane Gates', par: 4,
    special: 'Candy cane gates in gingerbread fences',
    tip: 'Three gingerbread fences cross the lane, each with a candy cane gate that swings open and shut, never in line. Ice between the last two fences makes it hard to stop and wait.',
    look: LOOK(), tee: [0, 1.3], cup: [1.2, 18.2],
    floors: [rp(rect(-3, 0, 3, 20), 1.0)],
    walls: [
      { pts: [[-3, 5.5], [-2.3, 5.5]], w: 0.26, h: 0.6, style: 'gingerbread' }, { pts: [[-1.1, 5.5], [3, 5.5]], w: 0.26, h: 0.6, style: 'gingerbread' },
      { pts: [[-3, 10.5], [0.6, 10.5]], w: 0.26, h: 0.6, style: 'gingerbread' }, { pts: [[1.8, 10.5], [3, 10.5]], w: 0.26, h: 0.6, style: 'gingerbread' },
      { pts: [[-3, 15.5], [-0.6, 15.5]], w: 0.26, h: 0.6, style: 'gingerbread' }, { pts: [[0.6, 15.5], [3, 15.5]], w: 0.26, h: 0.6, style: 'gingerbread' },
    ],
    zones: [ice(rect(-3, 10.7, 3, 15.3))],
    features: [{ type: 'gates', candy: true, list: [{ a: [-2.3, 5.5], b: [-1.1, 5.5], period: 3.0, phase: 0 }, { a: [0.6, 10.5], b: [1.8, 10.5], period: 2.6, phase: 0.35 }, { a: [-0.6, 15.5], b: [0.6, 15.5], period: 3.4, phase: 0.7 }] }],
  });

  // 20
  H.push({
    id: 'present-hop', name: 'Present Hop', par: 3,
    special: 'A wall of presents and a spring',
    tip: 'A wall of wrapped presents blocks the lane. Roll over the gold spring to hop it, then watch out for the penguin on the other side.',
    look: LOOK(), tee: [0, 1.3], cup: [0.8, 14.6],
    floors: [rp(rect(-2.6, 0, 2.6, 17), 1.0)],
    walls: [{ pts: [[-2.6, 8.5], [2.6, 8.5]], w: 0.5, h: 0.7, style: 'present' }],
    features: [
      { type: 'spring', x: 0, y: 6.6, r: 0.45, vz: 6.5, minSpeed: 4.6, maxSpeed: 5.6, land: [0, 10.4], gift: true },
      penguins([across(12.4, -2.1, 2.1, 3.0)]),
    ],
  });

  // 21
  H.push({
    id: 'penguin-slide', name: 'Penguin Slide', par: 2,
    special: 'Penguins sliding down an ice chute',
    tip: 'The middle of the lane is a chute of ice, and three penguins slide down it on their bellies, crossing your line on the diagonal. A snowbank shields the cup, open only on the right.',
    look: LOOK(), tee: [0, 1.3], cup: [-1.2, 17],
    floors: [rp(rect(-3, 0, 3, 19), 1.0)],
    walls: [{ pts: [[-3, 15.2], [0.6, 15.2]], w: 0.45, h: 0.55, style: 'snowbank' }],
    zones: [ice(rect(-3, 5, 3, 14))],
    features: [penguins([
      { a: [-2.5, 6.0], b: [2.5, 9.0], period: 2.8 },
      { a: [2.5, 9.6], b: [-2.5, 12.6], period: 3.4, phase: 0.4 },
      { a: [-2.5, 13.4], b: [2.5, 14.6], period: 3.0, phase: 0.7 },
    ])],
  });

  // 22
  H.push({
    id: 'frosty-maze', name: "Frosty's Maze", par: 4,
    special: 'A maze of snowbanks',
    tip: 'Snowbanks turn the green into a switchback, with slick ice on the long middle run and snowmen standing at the turns.',
    look: LOOK({ rail: 'snowbank' }), tee: [-2.6, 1.3], cup: [-2.8, 14.4],
    floors: [rp(rect(-4, 0, 4, 16), 1.0)],
    walls: [
      { pts: [[-4, 4.5], [1.6, 4.5]], w: 0.5, h: 0.6, style: 'snowbank' },
      { pts: [[-1.6, 8.5], [4, 8.5]], w: 0.5, h: 0.6, style: 'snowbank' },
      { pts: [[-4, 12], [1.6, 12]], w: 0.5, h: 0.6, style: 'snowbank' },
    ],
    zones: [ice(rect(-4, 4.8, 4, 8.2))],
    posts: [snowman(3.0, 6.5), snowman(-3.0, 10.3)],
  });

  // 23
  const globe = [0, 10];
  H.push({
    id: 'snow-globe', name: 'Snow Globe', par: 2,
    special: 'An icy bowl',
    tip: 'The green is an icy bowl with four snowmen in its middle, and the cup sits up on the far rim. Too soft and the ball slides back down to the snowmen; too hard and it flies past.',
    look: LOOK(), tee: [0, 1.3], cup: [0, 13.6],
    floors: [K.laneCircle(1.6, 0, globe[1], 4.4)],
    height: (x, y) => { const d = Math.hypot(x - globe[0], y - globe[1]); return d < 4.0 ? -0.45 * Math.pow(1 - d / 4.0, 2) : 0; },
    zones: [ice(U.circle(0, 10, 3.6))],
    posts: [45, 135, 225, 315].map(a => snowman(Math.cos(a * DEG) * 1.15, 10 + Math.sin(a * DEG) * 1.15, 0.3)),
  });

  // 24
  H.push({
    id: 'snowdrift-dunes', name: 'Snowdrift Dunes', par: 3,
    special: 'Rows of snowdrifts',
    tip: 'Three rows of deep snowdrifts each leave one gap, never in line. Land in a drift and the ball stops dead. A penguin slides across behind the second row.',
    look: LOOK(), tee: [0, 1.3], cup: [0.4, 16.6],
    floors: [rp(rect(-2.6, 0, 2.6, 18.5), 1.0)],
    zones: [
      drift(rect(-2.6, 4.6, 0.5, 5.8)), drift(rect(1.7, 4.6, 2.6, 5.8)),
      drift(rect(-2.6, 9.0, -1.6, 10.2)), drift(rect(-0.4, 9.0, 2.6, 10.2)),
      drift(rect(-2.6, 13.4, -0.2, 14.6)), drift(rect(1.0, 13.4, 2.6, 14.6)),
    ],
    features: [penguins([across(11.8, -2.1, 2.1, 2.8)])],
  });

  // 25
  const liftH = (x, y) => (y < 6.5 ? 1.0 : y < 12.5 ? 0.5 : 0);
  H.push({
    id: 'lift-line', name: 'Lift Line', par: 3,
    special: 'Ledges under the ski lift',
    tip: 'Three ledges step down under the ski lift, each with a snowbank and the way down at alternate ends. A penguin patrols the middle ledge and a snowball rolls across the bottom.',
    look: LOOK(), tee: [0, 1.3], cup: [-1.2, 17],
    floors: [rp(rect(-2.8, 0, 2.8, 19), 1.0)],
    height: liftH,
    walls: [
      { pts: [[-2.8, 6.5], [2.8, 6.5]], w: 0.04, h: 0, top: () => 1.0, style: 'none' },
      { pts: [[-2.8, 12.5], [2.8, 12.5]], w: 0.04, h: 0, top: () => 0.5, style: 'none' },
      { pts: [[-2.8, 6.1], [0.8, 6.1]], w: 0.4, h: 0.5, style: 'snowbank' },
      { pts: [[-0.8, 12.1], [2.8, 12.1]], w: 0.4, h: 0.5, style: 'snowbank' },
    ],
    features: [
      penguins([across(9.4, -2.3, 2.3, 3.0)]),
      snowballs([{ path: [[2.4, 15.0], [-2.4, 15.2]], travel: 3.2, rest: 1.6, r1: 0.36 }]),
      { type: 'lift' },
    ],
  });

  // 26
  H.push({
    id: 'hockey-rink', name: 'Hockey Rink', par: 2,
    special: 'A penguin goalie',
    tip: 'An ice hockey rink with the cup in the goal mouth, and a penguin goalie sliding back and forth in front of it. The boards close off the goal line except for the mouth, and two snowman defenders and a penguin skating across centre ice stand in the way.',
    look: LOOK({ rail: 'ice' }), tee: [0, 1.4], cup: [0, 15.0],
    floors: [rp(rect(-3.6, 0, 3.6, 16.4), 2.2)],
    zones: [ice(rect(-3.6, 0, 3.6, 16.4))],
    walls: [{ pts: [[-3.6, 14.4], [-0.6, 14.4]], w: 0.2, h: 0.5, style: 'ice' }, { pts: [[0.6, 14.4], [3.6, 14.4]], w: 0.2, h: 0.5, style: 'ice' }],
    posts: [cane(-0.62, 14.4), cane(0.62, 14.4), snowman(-1.3, 9.0), snowman(1.3, 10.6)],
    features: [penguins([{ a: [-0.75, 13.8], b: [0.75, 13.8], period: 1.9 }, { a: [-2.8, 7.0], b: [2.8, 7.0], period: 3.0, phase: 0.3 }]), { type: 'rink' }],
  });

  // 27
  const sumH = (x, y) => {
    if (y >= 17) return 1.0;
    if (y > 15 && x > 0.6) return 0.5 + 0.5 * (y - 15) / 2;
    if (y >= 9) return 0.5;
    if (y > 7 && x < -0.6) return 0.5 * (y - 7) / 2;
    return 0;
  };
  H.push({
    id: 'gingerbread-summit', name: 'Gingerbread Summit', par: 4,
    special: 'A climb to a gingerbread house',
    tip: 'The finale: climb two ramps to the summit, where the cup waits by a gingerbread house. A penguin patrols the middle terrace, snowballs roll down the top ramp, and the corner above the first ramp is thin ice over freezing water.',
    look: LOOK({ cell: 0.12 }), tee: [-1.6, 1.3], cup: [-1.0, 21.4],
    floors: [rp(rect(-3.4, 0, 3.4, 23.4), 1.2)],
    height: sumH,
    walls: [
      { pts: [[-0.6, 9], [3.4, 9]], w: 0.04, h: 0, top: () => 0.5, style: 'none' },
      { pts: [[-0.6, 9], [-0.6, 7]], w: 0.04, h: 0, top: (x, y) => 0.5 * (y - 7) / 2, style: 'none' },
      { pts: [[-3.4, 17], [0.6, 17]], w: 0.04, h: 0, top: () => 1.0, style: 'none' },
      { pts: [[0.6, 15], [0.6, 17]], w: 0.04, h: 0, top: (x, y) => 0.5 + 0.5 * (y - 15) / 2, style: 'none' },
    ],
    hazards: [{ kind: 'water', over: true, cold: true, poly: rect(-3.4, 13.4, -1.4, 15.4) }],
    features: [
      { type: 'thinice', list: [{ poly: rect(-3.4, 13.4, -1.4, 15.4) }] },
      penguins([across(11.6, -1.6, 2.6, 3.2)]),
      snowballs([{ path: [[2.0, 22.4], [2.0, 17.6], [2.0, 14.6]], travel: 3.0, rest: 1.8, r1: 0.36 }]),
      { type: 'village', summit: true },
    ],
  });

  H.forEach((h, i) => { h.num = i + 1; h.course = 'winter'; });
  PC.WINTER = H;
});
