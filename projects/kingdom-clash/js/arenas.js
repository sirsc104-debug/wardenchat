/* Kingdom Clash: arena art, in one place. Each arena lists its lobby centerpiece, its two battle
   scenery panels (with where the spectators sit and where the lights are), and its playable
   battlefield. This is the only file that names arena image paths; the bundler bakes every
   'img/...' path in the scripts into the single-page build as a data URI.

   Coordinates in a scenery layout are fractions of that image (0 to 1). A battlefield image is laid
   under the live game by anchor pairs: [image pixel, arena tile]. The game's 18 x 32 tile grid never
   changes; the image is stretched piecewise so its tower pads sit under the towers (tiles 6.5 and
   25.5), its lava under the river (tiles 15 to 17) and its bridges on the lanes (x 3.5 and 14.5).
   A battlefield without an image is drawn in code from a palette (KCArt.THEMES). */
'use strict';

const KCArenas = (() => {
  const ART = {
    training: {
      name: 'Training Grounds',
      centerpiece: { src: 'img/training-grounds.webp', w: 1448, h: 1086, bar: { left: 26.4, top: 87.9, width: 47.2, height: 5 } },
      field: null, palette: 'training', margin: 0.6, fx: 'water',
      scenery: {
        left: {
          src: 'img/grounds-left.webp', w: 793, h: 1983, anchor: [0.55, 0.72], stars: 26,
          rows: [
            { y: 0.586, slope: 0.012, size: 0.82, spans: [[0.365, 0.575], [0.69, 0.985]] },
            { y: 0.615, slope: 0.012, size: 0.87, spans: [[0.47, 0.63], [0.745, 0.985]] },
            { y: 0.645, slope: 0.012, size: 0.92, spans: [[0.51, 0.71], [0.815, 0.985]] },
            { y: 0.676, slope: 0.012, size: 0.97, spans: [[0.5, 0.79], [0.9, 0.985]] },
            { y: 0.707, slope: 0.012, size: 1.02, spans: [[0.505, 0.86]] },
            { y: 0.737, slope: 0.012, size: 1.07, spans: [[0.6, 0.92]] },
            { y: 0.766, slope: 0.01, size: 1.12, spans: [[0.62, 0.72], [0.78, 0.93]] },
          ],
          glows: [[0.07, 0.725, 1.3], [0.548, 0.735, 1.2], [0.523, 0.528, 0.7], [0.958, 0.551, 0.7], [0.093, 0.462, 0.6], [0.405, 0.512, 0.6]],
        },
        right: {
          src: 'img/grounds-right.webp', w: 793, h: 1983, anchor: [0.35, 0.72], stars: 26,
          rows: [
            { y: 0.590, slope: 0, size: 0.78, spans: [[0.005, 0.105], [0.22, 0.44]] },
            { y: 0.606, slope: 0, size: 0.8, spans: [[0.005, 0.12], [0.24, 0.455]] },
            { y: 0.622, slope: 0, size: 0.82, spans: [[0.005, 0.135], [0.26, 0.47]] },
            { y: 0.672, slope: 0, size: 0.9, spans: [[0.005, 0.15], [0.29, 0.43]] },
            { y: 0.689, slope: 0, size: 0.93, spans: [[0.005, 0.17], [0.31, 0.445]] },
            { y: 0.706, slope: 0, size: 0.96, spans: [[0.005, 0.19], [0.33, 0.46]] },
          ],
          glows: [[0.067, 0.528, 0.7], [0.305, 0.551, 0.7], [0.178, 0.646, 0.45], [0.455, 0.646, 0.45], [0.052, 0.835, 1.3], [0.935, 0.845, 1.3]],
          mist: [0.44, 0.9, 0.855],
        },
      },
    },

    cinder: {
      name: 'Cinder Keep',
      centerpiece: { src: 'img/cinder_keep_volcanic_arena_badge.webp', w: 1254, h: 1254, bar: { left: 23.6, top: 86.7, width: 52.8, height: 4.1 } },
      palette: 'cinder', margin: 1.4, fx: 'lava',
      field: {
        src: 'img/cinder_keep_molten_battle_arena.webp', w: 1024, h: 1536,
        // tower pads at x 286 / 737 px over lanes 3.5 / 14.5
        x: [[286, 3.5], [737, 14.5]],
        // top pads, the lava's edges, bottom pads
        y: [[348, 6.5], [728, 15], [815, 17], [1115, 25.5]],
        // the bridge decks over the lava, in tiles, redrawn on top of the lava effects
        bridges: [[1.3, 14.3, 5.4, 17.7], [12.6, 14.3, 16.9, 17.7]],
        // the four corner braziers, in tiles (outside the play area)
        braziers: [[-0.8, 1.6], [18.8, 1.6], [-0.8, 30.7], [18.8, 30.7]],
      },
      scenery: {
        left: {
          src: 'img/cinder_keep_volcanic_grandstand.webp', w: 793, h: 1983, anchor: [0.6, 0.58], stars: 10, embers: true,
          rows: [
            { y: 0.508, slope: 0.05, size: 0.66, spans: [[0.47, 0.665], [0.77, 0.9]] },
            { y: 0.532, slope: 0.05, size: 0.72, spans: [[0.43, 0.97]] },
            { y: 0.556, slope: 0.05, size: 0.78, spans: [[0.42, 0.98]] },
            { y: 0.580, slope: 0.05, size: 0.84, spans: [[0.41, 0.98]] },
            { y: 0.604, slope: 0.05, size: 0.9, spans: [[0.40, 0.98]] },
            { y: 0.627, slope: 0.05, size: 0.95, spans: [[0.40, 0.575], [0.745, 0.86]] },
          ],
          glows: [[0.09, 0.265, 0.8], [0.39, 0.33, 0.7], [0.705, 0.395, 0.7], [0.955, 0.435, 0.6], [0.06, 0.885, 0.7], [0.21, 0.89, 0.7]],
        },
        right: {
          src: 'img/cinder_keep_lavafall_arena.webp', w: 793, h: 1983, anchor: [0.62, 0.52], stars: 14, embers: true,
          rows: [
            { y: 0.432, slope: 0, size: 0.6, spans: [[0.50, 0.68], [0.80, 0.97]] },
            { y: 0.452, slope: 0, size: 0.63, spans: [[0.50, 0.645], [0.74, 0.9]] },
            { y: 0.472, slope: 0, size: 0.66, spans: [[0.50, 0.595], [0.70, 0.95]] },
            { y: 0.492, slope: 0, size: 0.69, spans: [[0.50, 0.575], [0.69, 0.92]] },
            { y: 0.512, slope: 0, size: 0.72, spans: [[0.64, 0.88]] },
            { y: 0.532, slope: 0, size: 0.75, spans: [[0.60, 0.85]] },
            { y: 0.552, slope: 0, size: 0.78, spans: [[0.56, 0.82], [0.93, 0.995]] },
            { y: 0.572, slope: 0, size: 0.81, spans: [[0.53, 0.74], [0.88, 0.99]] },
          ],
          glows: [[0.07, 0.31, 0.8], [0.39, 0.33, 0.8], [0.845, 0.665, 1.1], [0.27, 0.6, 1.4], [0.33, 0.73, 1.2]],
          lavafall: [0.2, 0.36, 0.705],
        },
      },
    },
  };

  // Arena 2: Briar Hollow: mossy ruins in a forest, a stream for the river, lanterns on the walls.
  ART.briar = {
    name: 'Briar Hollow',
    centerpiece: { src: 'img/briar_hollow_badge.webp', w: 1254, h: 1254, bar: { left: 24.3, top: 86, width: 51.4, height: 4.3 } },
    palette: 'briar', margin: 1.4, fx: 'water',
    field: {
      src: 'img/briar_hollow_battlefield.webp', w: 1024, h: 1536,
      // tower pads at x 272 / 752 px over lanes 3.5 / 14.5
      x: [[272, 3.5], [752, 14.5]],
      // king pad, princess pads, the stream's edges, princess pads, king pad
      y: [[232, 3], [393, 6.5], [725, 15], [818, 17], [1098, 25.5], [1275, 29]],
      // the plank bridges, in tiles, redrawn over the moving water
      bridges: [[2.0, 14.4, 5.6, 17.6], [13.4, 14.4, 16.9, 17.6]],
      // the four wall lanterns, in tiles, which flicker
      lanterns: [[0.25, 3.1], [17.55, 3.1], [0.25, 28.3], [17.55, 28.3]],
    },
    scenery: {
      // the king's statue and the high stands
      left: {
        src: 'img/briar_hollow_left.webp', w: 793, h: 1983, anchor: [0.58, 0.56], stars: 8,
        rows: [
          { y: 0.392, slope: 0.01, size: 0.66, spans: [[0.1, 0.44]] },
          { y: 0.428, slope: 0.01, size: 0.7, spans: [[0.1, 0.47]] },
          { y: 0.454, slope: 0.01, size: 0.72, spans: [[0.53, 0.92]] },
          { y: 0.476, slope: 0.01, size: 0.74, spans: [[0.56, 0.96]] },
          { y: 0.555, slope: 0.01, size: 0.84, spans: [[0.18, 0.55], [0.66, 0.99]] },
          { y: 0.595, slope: 0.01, size: 0.9, spans: [[0.14, 0.66], [0.78, 0.99]] },
          { y: 0.633, slope: 0.01, size: 0.96, spans: [[0.36, 0.8]] },
          { y: 0.668, slope: 0.01, size: 1.02, spans: [[0.37, 0.8]] },
        ],
        glows: [[0.66, 0.135, 0.9], [0.155, 0.392, 1.1], [0.96, 0.7, 1.0]],
      },
      // the stands beside the waterfall
      right: {
        src: 'img/briar_hollow_right.webp', w: 793, h: 1983, anchor: [0.38, 0.5], stars: 10,
        rows: [
          { y: 0.298, slope: 0, size: 0.6, spans: [[0.31, 0.62]] },
          { y: 0.334, slope: 0, size: 0.64, spans: [[0.25, 0.6]] },
          { y: 0.396, slope: 0, size: 0.7, spans: [[0.17, 0.58]] },
          { y: 0.426, slope: 0, size: 0.74, spans: [[0.1, 0.54]] },
          { y: 0.452, slope: 0, size: 0.77, spans: [[0.04, 0.49]] },
          { y: 0.539, slope: 0, size: 0.86, spans: [[0.17, 0.48]] },
          { y: 0.566, slope: 0, size: 0.9, spans: [[0.09, 0.43]] },
          { y: 0.592, slope: 0, size: 0.94, spans: [[0.29, 0.41]] },
        ],
        glows: [[0.75, 0.207, 1.0], [0.26, 0.29, 0.9], [0.78, 0.81, 1.3]],
        mist: [0.52, 0.72, 0.665],
      },
    },
  };

  // Arena 3: Sunstone Arena: a sandstone desert fortress with an oasis channel for the river.
  ART.sunstone = {
    name: 'Sunstone Arena',
    centerpiece: { src: 'img/sunstone_arena_badge.webp', w: 1122, h: 1402, bar: { left: 23.6, top: 84.1, width: 52.8, height: 4.4 } },
    palette: 'sunstone', margin: 1.4, fx: 'water',
    field: {
      src: 'img/sunstone_arena_battlefield.webp', w: 1024, h: 1536,
      // tower pads at x 262 / 762 px over lanes 3.5 / 14.5
      x: [[262, 3.5], [762, 14.5]],
      // king pad, princess pads, the oasis channel's edges, princess pads, king pad
      y: [[275, 3], [390, 6.5], [722, 15], [805, 17], [1067, 25.5], [1205, 29]],
      // the plank bridges, in tiles, redrawn over the moving water
      bridges: [[1.8, 13.1, 5.25, 17.8], [12.75, 13.1, 16.2, 17.8]],
      // the four corner fire bowls, in tiles, which flicker
      lanterns: [[0.4, -1.8], [17.6, -1.9], [0.85, 31.5], [17.2, 31.4]],
    },
    scenery: {
      // the sundial, the lion statues and the great stairs
      left: {
        src: 'img/sunstone_arena_left.webp', w: 793, h: 1983, anchor: [0.6, 0.5], stars: 0,
        rows: [
          { y: 0.365, slope: 0, size: 0.7, spans: [[0.36, 0.6]] },
          { y: 0.39, slope: 0, size: 0.73, spans: [[0.37, 0.65]] },
          { y: 0.415, slope: 0, size: 0.76, spans: [[0.37, 0.7]] },
          { y: 0.44, slope: 0, size: 0.79, spans: [[0.37, 0.74]] },
          { y: 0.465, slope: 0, size: 0.82, spans: [[0.45, 0.79]] },
          { y: 0.49, slope: 0, size: 0.85, spans: [[0.5, 0.84]] },
          { y: 0.515, slope: 0, size: 0.88, spans: [[0.6, 0.88]] },
          { y: 0.54, slope: 0, size: 0.92, spans: [[0.62, 0.93]] },
        ],
        glows: [[0.65, 0.29, 0.7], [0.81, 0.31, 0.7], [0.95, 0.33, 0.6], [0.81, 0.555, 0.9], [0.16, 0.665, 1.3]],
        mist: [0.58, 0.68, 0.76],
      },
      // the stands by the waterfall, with the market stalls
      right: {
        src: 'img/sunstone_arena_right.webp', w: 793, h: 1983, anchor: [0.45, 0.5], stars: 0,
        rows: [
          { y: 0.305, slope: 0, size: 0.6, spans: [[0.42, 0.98]] },
          { y: 0.33, slope: 0, size: 0.63, spans: [[0.38, 0.98]] },
          { y: 0.355, slope: 0, size: 0.66, spans: [[0.35, 0.98]] },
          { y: 0.53, slope: 0, size: 0.8, spans: [[0.3, 0.56]] },
          { y: 0.555, slope: 0.02, size: 0.84, spans: [[0.33, 0.78]] },
          { y: 0.58, slope: 0.02, size: 0.88, spans: [[0.35, 0.9]] },
          { y: 0.605, slope: 0.02, size: 0.92, spans: [[0.4, 0.92]] },
          { y: 0.63, slope: 0.02, size: 0.96, spans: [[0.46, 0.78]] },
          { y: 0.655, slope: 0.02, size: 1.0, spans: [[0.55, 0.78]] },
        ],
        glows: [[0.52, 0.2, 0.6], [0.73, 0.21, 0.6], [0.535, 0.43, 0.6], [0.18, 0.525, 0.9], [0.87, 0.625, 1.2], [0.65, 0.865, 0.8]],
        mist: [0.0, 0.18, 0.53],
      },
    },
  };

  // Arena 4: Stormspire: a storm-wrapped stone fortress with gold trim, blue gems and waterfalls.
  ART.stormspire = {
    name: 'Stormspire',
    centerpiece: { src: 'img/stormspire_badge.webp', w: 1122, h: 1402, bar: { left: 24.1, top: 82.9, width: 53.5, height: 4.4 } },
    palette: 'stormspire', margin: 1.4, fx: 'water',
    field: {
      src: 'img/stormspire_battlefield.webp', w: 1024, h: 1536,
      // tower pads at x 262 / 762 px over lanes 3.5 / 14.5
      x: [[262, 3.5], [762, 14.5]],
      // king pad, princess pads, the stream's edges, princess pads, king pad
      y: [[395, 3], [497, 6.5], [745, 15], [830, 17], [1068, 25.5], [1180, 29]],
      // the plank bridges, in tiles, redrawn over the moving water
      bridges: [[1.9, 13.1, 5.1, 18.0], [12.9, 13.1, 16.1, 18.0]],
      // the four corner fire bowls, in tiles, which flicker
      lanterns: [[0.27, -3.3], [17.65, -3.3], [0.6, 32.4], [17.1, 32.4]],
    },
    scenery: {
      // the left stands: lanterns in the arches, a fire bowl, waterfalls through the arches below
      left: {
        src: 'img/stormspire_left.webp', w: 793, h: 1983, anchor: [0.55, 0.5], stars: 0,
        rows: [
          { y: 0.372, slope: 0.11, size: 0.66, spans: [[0.26, 0.64]] },
          { y: 0.392, slope: 0.11, size: 0.69, spans: [[0.28, 0.66]] },
          { y: 0.528, slope: 0.04, size: 0.82, spans: [[0.33, 0.85]] },
          { y: 0.552, slope: 0.04, size: 0.86, spans: [[0.35, 0.88]] },
          { y: 0.578, slope: 0.04, size: 0.9, spans: [[0.36, 0.9]] },
        ],
        glows: [[0.29, 0.27, 0.7], [0.51, 0.33, 0.6], [0.7, 0.32, 0.6], [0.88, 0.35, 0.6], [0.18, 0.53, 1.3], [0.9, 0.43, 1.0]],
        mist: [0.3, 0.45, 0.82],
      },
      // the right stands, beside the waterfall
      right: {
        src: 'img/stormspire_right.webp', w: 793, h: 1983, anchor: [0.45, 0.5], stars: 0,
        rows: [
          { y: 0.378, slope: -0.065, size: 0.66, spans: [[0.22, 0.78]] },
          { y: 0.405, slope: -0.065, size: 0.69, spans: [[0.2, 0.78]] },
          { y: 0.432, slope: -0.065, size: 0.72, spans: [[0.2, 0.75]] },
          { y: 0.522, slope: 0, size: 0.82, spans: [[0.16, 0.62]] },
          { y: 0.552, slope: 0, size: 0.86, spans: [[0.14, 0.62]] },
          { y: 0.582, slope: 0, size: 0.9, spans: [[0.14, 0.6]] },
        ],
        glows: [[0.39, 0.31, 0.7], [0.73, 0.26, 0.7]],
        mist: [0.75, 0.95, 0.68],
      },
    },
  };

  /* ---------- images: each loaded once ---------- */
  const imgs = {}, waiting = {};
  function image(src) {
    if (imgs[src]) return imgs[src];
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { (waiting[src] || []).splice(0).forEach(fn => { try { fn(im); } catch (e) { console.error(e); } }); };
    im.onerror = () => { im.failed = true; waiting[src] = []; };
    im.src = src;
    imgs[src] = im;
    return im;
  }
  const ready = im => !!im && im.complete && im.naturalWidth > 0;
  // Calls fn once the image is ready (now, if it already is). A failed image never calls back: callers
  // keep their fallback (a drawn battlefield, a plain gradient behind the crowd).
  function whenReady(src, fn) {
    const im = image(src);
    if (ready(im)) fn(im);
    else if (!im.failed) (waiting[src] = waiting[src] || []).push(fn);
  }
  const get = id => ART[id] || ART.training;
  // Start loading an arena's art before it is needed.
  function preload(id) {
    const a = get(id);
    image(a.centerpiece.src);
    if (a.field) image(a.field.src);
    image(a.scenery.left.src); image(a.scenery.right.src);
  }

  /* ---------- battlefield mapping ---------- */
  // Piecewise-linear map between image pixels and tiles along one axis, extended past the end anchors.
  function axis(pairs) {
    const at = (t, i) => pairs[i][0] + (t - pairs[i][1]) * (pairs[i + 1][0] - pairs[i][0]) / (pairs[i + 1][1] - pairs[i][1]);
    return t => {
      let i = 0;
      while (i < pairs.length - 2 && t > pairs[i + 1][1]) i++;
      return at(t, i);
    };
  }
  // Draws the battlefield image covering tiles [-m, W+m] x [-m, H+m] at k pixels per tile, the arena
  // canvas's own frame (tile (x, y) is at ((x + m) k, (y + m) k)). Returns false if not ready.
  function drawField(c, id, k, m, W, H) {
    const f = get(id).field;
    if (!f) return false;
    const im = image(f.src);
    if (!ready(im)) return false;
    const px = axis(f.x), py = axis(f.y);
    const perTile = (f.x[1][0] - f.x[0][0]) / (f.x[1][1] - f.x[0][1]);
    const sx0 = Math.max(0, px(-m)), sx1 = Math.min(f.w, px(W + m));
    const dx0 = (sx0 - px(-m)) / perTile * k, dx1 = dx0 + (sx1 - sx0) / perTile * k;
    c.fillStyle = '#2a1d22'; c.fillRect(0, 0, (W + 2 * m) * k, (H + 2 * m) * k);
    // vertical bands between anchors, each its own scale
    const ys = [-m, ...f.y.map(p => p[1]), H + m];
    c.imageSmoothingQuality = 'high';
    for (let i = 0; i < ys.length - 1; i++) {
      let t0 = ys[i], t1 = ys[i + 1];
      let s0 = py(t0), s1 = py(t1);
      if (s0 < 0) { t0 += (0 - s0) / (s1 - s0) * (t1 - t0); s0 = 0; }
      if (s1 > f.h) { t1 -= (s1 - f.h) / (s1 - s0) * (t1 - t0); s1 = f.h; }
      if (s1 - s0 < 0.5) continue;
      // overlap each band by a pixel so no seam shows between them
      c.drawImage(im, sx0, s0, sx1 - sx0, s1 - s0, dx0, (t0 + m) * k - 0.5, dx1 - dx0, (t1 - t0) * k + 1);
    }
    return true;
  }

  return { ART, get, image, ready, whenReady, preload, drawField, axis };
})();
