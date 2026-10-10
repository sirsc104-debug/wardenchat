/* Brain Rocket — the Play With Friends world: a drill boring through the Earth to its centre
   (same API as Scene and SubScene). */
'use strict';

const DrillScene = (function () {
  const W = 1600, H = 900;
  const K = 3;            // screen pixels per point of depth
  const SX = 560;         // drill x
  const SY = 290;         // drill body centre
  const TIP = SY + 105;   // tip of the bit; the ground sits here at the start
  const CENTRE = 4200;    // depth of the centre of the Earth (matches DRILL_STOPS)
  const TAU = Math.PI * 2;

  let canvas, ctx, pxScale = 1;
  const st = {
    cam: 0, target: 0, vel: 0, t: 0, thrust: 0, ignite: 0, dead: false, deadT: 0,
    shake: 0, streak: 0, kick: 0, spin: 0, emitD: 0, emitS: 0, flash: 0,
    crash: null   // bad word: flip round and shoot back out of the ground
  };
  const parts = [];   // rock chips, sparks, smoke (world-anchored)
  const fx = [];      // confetti, rings (screen space)
  const lines = [];   // speed streaks
  let onMilestone = null;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const wrapX = (x, m = 260) => { const span = W + m * 2; return ((((x + m) % span) + span) % span) - m; };
  const sy = d => TIP + (d - st.cam) * K;          // depth -> screen y
  const dAt = y => st.cam + (y - TIP) / K;         // screen y -> depth

  // Past the centre you start coming up the other side, so the layers run backwards.
  function mirror(d) {
    if (d <= CENTRE) return Math.max(0, d);
    const x = ((d - CENTRE) * (CENTRE / 1800)) % (CENTRE * 2);
    return x <= CENTRE ? CENTRE - x : x - CENTRE;
  }

  // ---- Layers ------------------------------------------------------------
  // [from depth, top colour, bottom colour, banded?]
  const LAYERS = [
    [0,    '#6b4426', '#4e2f19', 1],   // topsoil
    [110,  '#9a6440', '#7f5030', 1],   // clay (pipes, subway)
    [270,  '#c58f55', '#a8743f', 1],   // sandstone (fossils)
    [390,  '#8d8578', '#6c665c', 1],   // limestone (caves)
    [540,  '#55505c', '#3f3a46', 1],   // slate (gold mine)
    [700,  '#7d6e75', '#625660', 1],   // granite bedrock
    [1080, '#7c2f16', '#9b3d1b', 0],   // upper mantle
    [1650, '#a5421b', '#b94c1c', 0],   // diamond zone
    [2050, '#9a2c12', '#c2481b', 0],   // lower mantle
    [2650, '#ff7b14', '#ffab2e', 0],   // liquid outer core
    [3350, '#ffd84a', '#fff1b0', 0],   // solid inner core
    [CENTRE + 1, '#ffffff', '#ffffff', 0]
  ].map(([d, a, b, band]) => ({ d, a: hex(a), b: hex(b), band }));
  const layerIndex = m => { let i = 0; while (i < LAYERS.length - 2 && m >= LAYERS[i + 1].d) i++; return i; };
  function rowColour(m) {
    const i = layerIndex(m), L = LAYERS[i], N = LAYERS[i + 1];
    const t = clamp((m - L.d) / (N.d - L.d), 0, 1);
    let f = 1;
    if (L.band) f += (hash(Math.floor(m / 7)) - 0.5) * 0.16;              // sediment bands
    else f += Math.sin(m * 0.08 + st.t * (m > 2650 ? 1.5 : 0.4)) * 0.05;  // slow churning heat
    const c = k => Math.round(clamp(lerp(L.a[k], L.b[k], t) * f, 0, 255));
    return `rgb(${c(0)},${c(1)},${c(2)})`;
  }
  const isRock = m => m >= 540 && m < 1080;
  const isHot = m => m >= 1080;

  // ---- Decorations -------------------------------------------------------
  const ZONES = [
    { to: 110,  d: 2.4, types: { worm: 3, root: 2.5, pebble: 3, bone: 0.6, ant: 1.2, mole: 0.35 } },
    { to: 270,  d: 1.8, types: { pipe: 2.4, cable: 1.4, pebble: 2, rat: 0.5, coin: 0.7 } },
    { to: 390,  d: 1.8, types: { ammonite: 2.5, trilobite: 2, dinobone: 1.5, skull: 0.5, pebble: 1 } },
    { to: 540,  d: 1.6, types: { stalactite: 1.6, mushroom: 1.6, geode: 1.5, bat: 1, pool: 0.6 } },
    { to: 700,  d: 1.6, types: { goldvein: 2.5, nugget: 2, lantern: 1.2, beam: 1.2, pickaxe: 0.5 } },
    { to: 1080, d: 2.4, types: { quartz: 2.5, speckle: 3, crack: 1 } },
    { to: 1650, d: 3, types: { lava: 3, olivine: 2, crack: 1.5, plume: 0.6 } },
    { to: 2050, d: 3, types: { diamond: 3, lava: 1.5, olivine: 1 } },
    { to: 2650, d: 3, types: { lava: 3, crack: 2, plume: 1 } },
    { to: 3350, d: 3, types: { current: 3, irondrop: 2.5, field: 0.7 } },
    { to: 1e9,  d: 3, types: { ironcrystal: 3, sparkle: 2.5 } }
  ];
  const zoneAt = m => ZONES.find(z => m < z.to);
  const CHUNK = 100;
  const chunkCache = new Map();
  function chunk(ci) {
    if (chunkCache.has(ci)) return chunkCache.get(ci);
    if (chunkCache.size > 260) chunkCache.clear();
    const rng = mulberry32(ci * 7919 + 13);
    const zone = zoneAt(mirror(ci * CHUNK + 50));
    const out = [];
    const n = Math.floor(zone.d + rng() * 1.4);
    const pairs = Object.entries(zone.types);
    const total = pairs.reduce((s, p) => s + p[1], 0);
    for (let i = 0; i < n; i++) {
      const d = ci * CHUNK + rng() * CHUNK;
      if (d < 8) continue;
      let r = rng() * total, type = pairs[0][0];
      for (const [t, w] of pairs) { if ((r -= w) <= 0) { type = t; break; } }
      let x = rng() * W;
      if (Math.abs(x - SX) < 110) x += x < SX ? -130 : 130;   // keep clear of the shaft
      out.push({ type, d, x, s: 0.7 + rng() * 0.6, seed: rng() * 1000, dir: rng() < 0.5 ? -1 : 1, rot: (rng() - 0.5) * 1.2, n: 3 + Math.floor(rng() * 4) });
    }
    chunkCache.set(ci, out);
    return out;
  }

  const blob = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  function glow(x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  // A rough-edged hollow in the rock (so caves don't look like neat ovals).
  function cavity(cx, cy, rx, ry, seed, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = i / 24 * TAU, r = 0.78 + hash(seed + i * 1.7) * 0.32;
      const px = cx + Math.cos(a) * rx * r, py = cy + Math.sin(a) * ry * r * (Math.sin(a) > 0 ? 0.7 : 1);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawObj(o, x, y) {
    const s = o.s, t = st.t + o.seed;
    ctx.save(); ctx.translate(x, y);
    switch (o.type) {
      case 'worm': {
        ctx.strokeStyle = '#e88a8a'; ctx.lineWidth = 9 * s; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) { const px = (i - 3) * 9 * s * o.dir, py = Math.sin(t * 3 + i) * 6 * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        ctx.strokeStyle = '#c96a6a'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(-3 * s, -5 * s); ctx.lineTo(-3 * s, 5 * s); ctx.stroke();
        break;
      }
      case 'root': {
        ctx.strokeStyle = '#3b2412'; ctx.lineCap = 'round';
        const grow = (len, ang, w, depth) => {
          if (depth > 3) return;
          ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0);
          const ex = Math.sin(ang) * len, ey = Math.cos(ang) * len;
          ctx.quadraticCurveTo(ex * 0.4 + 6, ey * 0.5, ex, ey); ctx.stroke();
          ctx.save(); ctx.translate(ex, ey);
          grow(len * 0.6, ang + 0.5, w * 0.6, depth + 1); grow(len * 0.55, ang - 0.6, w * 0.6, depth + 1);
          ctx.restore();
        };
        ctx.translate(0, -60 * s); grow(55 * s, o.rot * 0.4, 7 * s, 0);
        break;
      }
      case 'pebble': case 'speckle': {
        const r = mulberry32(o.seed * 1000);
        for (let i = 0; i < (o.type === 'speckle' ? 9 : 4); i++) {
          const px = (r() - 0.5) * 90 * s, py = (r() - 0.5) * 50 * s, pr = (o.type === 'speckle' ? 3 : 6 + r() * 7) * s;
          ctx.fillStyle = o.type === 'speckle' ? ['#d9c8cf', '#2d2730', '#b7a4ad'][i % 3] : ['#8a8378', '#a49c90', '#6f685d'][i % 3];
          ctx.beginPath(); ctx.ellipse(px, py, pr * 1.3, pr, r() * 3, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'bone': case 'dinobone': {
        const L = (o.type === 'dinobone' ? 70 : 40) * s;
        ctx.rotate(o.rot); ctx.fillStyle = '#f2e8d0';
        ctx.fillRect(-L / 2, -5 * s, L, 10 * s);
        for (const e of [-1, 1]) { blob(e * L / 2, -6 * s, 8 * s, '#f2e8d0'); blob(e * L / 2, 6 * s, 8 * s, '#f2e8d0'); }
        break;
      }
      case 'ant': {
        const px = wrapX(o.x + o.dir * st.t * 30) - x;
        ctx.translate(px, 0);
        for (let i = 0; i < 3; i++) blob(i * 7 * o.dir, 0, (i === 1 ? 3 : 4) * s, '#1a0f08');
        ctx.strokeStyle = '#1a0f08'; ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) { const lx = 7 * o.dir + (i - 1) * 3, k = Math.sin(t * 20 + i) * 2; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx - 3 + k, 6); ctx.moveTo(lx, 0); ctx.lineTo(lx + 3 - k, 6); ctx.stroke(); }
        break;
      }
      case 'mole': {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 70 * s, 36 * s, 0, 0, TAU); ctx.fill();
        ctx.scale(o.dir, 1);
        ctx.fillStyle = '#3d3029'; ctx.beginPath(); ctx.ellipse(0, 6 * s, 36 * s, 24 * s, 0, 0, TAU); ctx.fill();
        blob(30 * s, 4 * s, 7 * s, '#f29bb0');
        ctx.fillStyle = '#f29bb0'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(16 * s, 26 * s, 8 * s, 4 * s, k * 0.4, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(14 * s, -2 * s, 3 * s, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
        break;
      }
      case 'pipe': {
        const col = ['#5f7e8f', '#8a6d3b', '#4d6b4f'][Math.floor(o.seed) % 3];
        const len = 260 * s;
        ctx.fillStyle = col; ctx.fillRect(-len / 2, -14 * s, len, 28 * s);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-len / 2, -10 * s, len, 6 * s);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (const jx of [-len / 2, -len / 6, len / 6, len / 2 - 14 * s]) ctx.fillRect(jx, -18 * s, 14 * s, 36 * s);
        if (o.n > 4) { ctx.fillStyle = 'rgba(120,200,255,0.8)'; const k = (t * 40) % 40; ctx.beginPath(); ctx.ellipse(len / 2 + 6, -2 + k * 0.3, 3, 5, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'cable': {
        ctx.strokeStyle = ['#e8364f', '#2f7bff', '#ffd23f'][Math.floor(o.seed) % 3]; ctx.lineWidth = 5 * s;
        ctx.beginPath(); ctx.moveTo(-180 * s, 0);
        ctx.bezierCurveTo(-60 * s, 30 * s, 60 * s, -30 * s, 180 * s, 6 * s); ctx.stroke();
        break;
      }
      case 'rat': {
        const px = wrapX(o.x + o.dir * st.t * 50, 300) - x;
        ctx.translate(px, 0); ctx.scale(o.dir, 1);
        ctx.fillStyle = '#777'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 10, 0, 0, TAU); ctx.fill();
        blob(16, -2, 8, '#777'); blob(14, -10, 4, '#e8a0a8'); blob(22, -3, 1.6, '#111');
        ctx.strokeStyle = '#d58a92'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 2); ctx.quadraticCurveTo(-34, 2 + Math.sin(t * 8) * 6, -40, -6); ctx.stroke();
        break;
      }
      case 'coin': {
        const w = Math.abs(Math.cos(t * 2)) * 11 * s + 2;
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 0, w, 11 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c99a10'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.6, 7 * s, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'ammonite': {
        ctx.strokeStyle = '#6e4a2a'; ctx.lineWidth = 4 * s; ctx.fillStyle = '#e3c391';
        ctx.beginPath(); ctx.arc(0, 0, 26 * s, 0, TAU); ctx.fill();
        ctx.beginPath();
        for (let a = 0; a < 14; a += 0.2) { const r = 2 + a * 1.75 * s; const px = Math.cos(a) * r, py = Math.sin(a) * r; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        break;
      }
      case 'trilobite': {
        ctx.rotate(o.rot); ctx.fillStyle = '#d8b680';
        ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 28 * s, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 2;
        for (let i = -3; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(-15 * s, i * 6 * s); ctx.lineTo(15 * s, i * 6 * s); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(0, -26 * s); ctx.lineTo(0, 26 * s); ctx.stroke();
        break;
      }
      case 'skull': {
        ctx.scale(o.dir * s, s);
        ctx.fillStyle = '#efe4c8';
        ctx.beginPath(); ctx.moveTo(-50, -10); ctx.quadraticCurveTo(-40, -45, 10, -40); ctx.quadraticCurveTo(60, -32, 62, 0); ctx.lineTo(40, 18); ctx.lineTo(-30, 22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a4026'; blob(-18, -18, 9, '#5a4026');
        ctx.fillStyle = '#efe4c8';
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 11, 18); ctx.lineTo(-15 + i * 11, 30); ctx.lineTo(-10 + i * 11, 18); ctx.fill(); }
        break;
      }
      case 'stalactite': {
        cavity(0, 0, 120 * s, 46 * s, o.seed, '#2a2530');
        ctx.fillStyle = '#a99f8e';
        // a few icicle-like stalactites hanging from the roof, at uneven spacing
        for (let i = 0; i < o.n; i++) {
          const px = (hash(o.seed + i * 5) - 0.5) * 170 * s, h = (12 + hash(o.seed + i) * 26) * s, w = (5 + hash(o.seed + i * 2) * 5) * s;
          const roof = -36 * s * Math.sqrt(Math.max(0, 1 - (px / (120 * s)) ** 2));
          ctx.beginPath(); ctx.moveTo(px - w, roof - 4); ctx.quadraticCurveTo(px - w * 0.4, roof + h * 0.6, px, roof + h); ctx.quadraticCurveTo(px + w * 0.4, roof + h * 0.6, px + w, roof - 4); ctx.fill();
        }
        // one or two stubby stalagmites on the floor
        for (let i = 0; i < 2; i++) {
          const px = (hash(o.seed + i * 9 + 3) - 0.5) * 140 * s, h = (10 + hash(o.seed + i * 4) * 14) * s;
          ctx.beginPath(); ctx.moveTo(px - 9 * s, 28 * s); ctx.quadraticCurveTo(px - 3 * s, 28 * s - h * 0.6, px, 28 * s - h); ctx.quadraticCurveTo(px + 3 * s, 28 * s - h * 0.6, px + 9 * s, 28 * s); ctx.fill();
        }
        if (o.n > 4) { const k = (st.t * 0.8 + o.seed) % 1; blob(0, -10 * s + k * 34 * s, 2.2, `rgba(170,220,255,${1 - k})`); }
        break;
      }
      case 'mushroom': {
        cavity(0, 4 * s, 70 * s, 32 * s, o.seed, 'rgba(25,20,30,0.8)');
        for (let i = 0; i < 3; i++) {
          const px = (i - 1) * 28 * s, h = (14 + i * 7) * s, hue = [170, 290, 120][i];
          glow(px, 20 * s - h, 26 * s, `hsla(${hue},100%,60%,A)`, 0.45 + Math.sin(t * 2 + i) * 0.15);
          ctx.fillStyle = '#e8f0f0'; ctx.fillRect(px - 2.5 * s, 20 * s - h, 5 * s, h);
          ctx.fillStyle = `hsl(${hue},100%,65%)`; ctx.beginPath(); ctx.ellipse(px, 20 * s - h, 12 * s, 7 * s, 0, Math.PI, 0); ctx.fill();
        }
        break;
      }
      case 'geode': {
        ctx.fillStyle = '#4a4440'; ctx.beginPath(); ctx.ellipse(0, 0, 40 * s, 30 * s, o.rot, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a1b5c'; ctx.beginPath(); ctx.ellipse(0, 0, 32 * s, 23 * s, o.rot, 0, TAU); ctx.fill();
        const hue = 260 + (o.seed % 60);
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * TAU, r = 20 * s;
          ctx.fillStyle = `hsl(${hue},80%,${55 + (i % 3) * 10}%)`;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r); ctx.lineTo(Math.cos(a + 0.25) * 6, Math.sin(a + 0.25) * 4); ctx.lineTo(Math.cos(a - 0.25) * 6, Math.sin(a - 0.25) * 4); ctx.fill();
        }
        break;
      }
      case 'bat': {
        const px = wrapX(o.x + o.dir * st.t * 70, 300) - x, f = Math.sin(t * 14);
        ctx.translate(px, Math.sin(t * 2) * 20);
        ctx.fillStyle = '#211a26';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-20, -18 * f, -36, -4 * f); ctx.quadraticCurveTo(-20, 0, 0, 6);
        ctx.quadraticCurveTo(20, 0, 36, -4 * f); ctx.quadraticCurveTo(20, -18 * f, 0, 0); ctx.fill();
        blob(0, 2, 6, '#211a26'); blob(-2, 0, 1.2, '#ff5050'); blob(2, 0, 1.2, '#ff5050');
        break;
      }
      case 'pool': {
        cavity(0, 0, 110 * s, 44 * s, o.seed, '#2a2530');
        const g = ctx.createLinearGradient(0, 0, 0, 30 * s); g.addColorStop(0, '#5fd4e8'); g.addColorStop(1, '#1d6f8f');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 12 * s, 90 * s, 22 * s, 0, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-70 * s, 12 * s); ctx.lineTo(70 * s, 12 * s); ctx.stroke();
        break;
      }
      case 'goldvein': {
        ctx.rotate(o.rot); ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = 6 * s; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(-120 * s, 0);
        for (let i = 1; i <= 6; i++) ctx.lineTo(-120 * s + i * 40 * s, (hash(o.seed + i) - 0.5) * 40 * s);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,170,0.7)'; ctx.lineWidth = 2; ctx.stroke();
        break;
      }
      case 'nugget': {
        glow(0, 0, 26 * s, 'rgba(255,210,63,A)', 0.35 + Math.sin(t * 3) * 0.15);
        ctx.fillStyle = '#ffc928'; ctx.beginPath(); ctx.moveTo(-12 * s, 6 * s); ctx.lineTo(-8 * s, -9 * s); ctx.lineTo(6 * s, -11 * s); ctx.lineTo(14 * s, 2 * s); ctx.lineTo(4 * s, 11 * s); ctx.fill();
        ctx.fillStyle = '#fff2a8'; ctx.beginPath(); ctx.moveTo(-6 * s, -6 * s); ctx.lineTo(2 * s, -8 * s); ctx.lineTo(-1 * s, -2 * s); ctx.fill();
        break;
      }
      case 'lantern': {
        glow(0, 0, 70 * s, 'rgba(255,190,90,A)', 0.4 + Math.sin(t * 6) * 0.05);
        ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -40 * s); ctx.lineTo(0, -16 * s); ctx.stroke();
        ctx.fillStyle = '#2a2018'; ctx.fillRect(-9 * s, -16 * s, 18 * s, 5 * s); ctx.fillRect(-9 * s, 10 * s, 18 * s, 5 * s);
        ctx.fillStyle = '#ffd77a'; ctx.fillRect(-7 * s, -11 * s, 14 * s, 21 * s);
        break;
      }
      case 'beam': {
        ctx.fillStyle = '#7a5530'; ctx.fillRect(-90 * s, -40 * s, 14 * s, 80 * s); ctx.fillRect(76 * s, -40 * s, 14 * s, 80 * s); ctx.fillRect(-96 * s, -48 * s, 192 * s, 14 * s);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-76 * s, -34 * s, 152 * s, 74 * s);
        break;
      }
      case 'pickaxe': {
        ctx.rotate(o.rot - 0.6);
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-3 * s, -30 * s, 6 * s, 60 * s);
        ctx.fillStyle = '#9aa3b8'; ctx.beginPath(); ctx.moveTo(-30 * s, -22 * s); ctx.quadraticCurveTo(0, -38 * s, 30 * s, -22 * s); ctx.quadraticCurveTo(0, -30 * s, -30 * s, -22 * s); ctx.fill();
        break;
      }
      case 'quartz': {
        ctx.rotate(o.rot);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = `rgba(${235 - i * 10},${225 - i * 8},255,0.85)`;
          const px = (i - 1.5) * 12 * s, h = (24 + i % 2 * 14) * s;
          ctx.beginPath(); ctx.moveTo(px - 6 * s, 10 * s); ctx.lineTo(px - 6 * s, 10 * s - h); ctx.lineTo(px, 4 * s - h - 8 * s); ctx.lineTo(px + 6 * s, 10 * s - h); ctx.lineTo(px + 6 * s, 10 * s); ctx.fill();
        }
        break;
      }
      case 'crack': {
        ctx.rotate(o.rot);
        const hot = isHot(mirror(o.d));
        if (hot) glow(0, 0, 90 * s, 'rgba(255,140,40,A)', 0.25 + Math.sin(t * 2) * 0.1);
        ctx.strokeStyle = hot ? '#ffb347' : 'rgba(20,10,20,0.6)'; ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.moveTo(-100 * s, 0);
        for (let i = 1; i <= 8; i++) ctx.lineTo(-100 * s + i * 25 * s, (hash(o.seed + i * 3) - 0.5) * 34 * s);
        ctx.stroke();
        break;
      }
      case 'lava': {
        const rise = ((st.t * 12 + o.seed) % 80) - 40;
        ctx.translate(0, -rise);
        glow(0, 0, 60 * s, 'rgba(255,120,30,A)', 0.4);
        const g = ctx.createRadialGradient(-6 * s, -8 * s, 2, 0, 0, 28 * s);
        g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ff9a1f'); g.addColorStop(1, '#d4401a');
        ctx.fillStyle = g; ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, r = (22 + Math.sin(a * 3 + t * 2) * 4) * s; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.fill();
        break;
      }
      case 'olivine': {
        ctx.rotate(o.rot);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = ['#7fc04a', '#5ea03a', '#a8d860'][i];
          ctx.beginPath(); ctx.moveTo(i * 12 * s - 18 * s, 10 * s); ctx.lineTo(i * 12 * s - 12 * s, -14 * s); ctx.lineTo(i * 12 * s, -18 * s); ctx.lineTo(i * 12 * s + 4 * s, 8 * s); ctx.fill();
        }
        break;
      }
      case 'diamond': {
        const tw = 0.5 + Math.sin(t * 4) * 0.5;
        glow(0, 0, 40 * s, 'rgba(180,240,255,A)', 0.3 + tw * 0.3);
        ctx.fillStyle = '#d8f6ff'; ctx.beginPath(); ctx.moveTo(-16 * s, -6 * s); ctx.lineTo(-8 * s, -16 * s); ctx.lineTo(8 * s, -16 * s); ctx.lineTo(16 * s, -6 * s); ctx.lineTo(0, 18 * s); ctx.fill();
        ctx.fillStyle = '#8fdcf5'; ctx.beginPath(); ctx.moveTo(-16 * s, -6 * s); ctx.lineTo(16 * s, -6 * s); ctx.lineTo(0, 18 * s); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.globalAlpha = tw; ctx.fillRect(-1, -24 * s, 2, 14 * s); ctx.fillRect(-7 * s, -17 * s, 14 * s, 2); ctx.globalAlpha = 1;
        break;
      }
      case 'plume': {
        const g = ctx.createLinearGradient(0, 120 * s, 0, -120 * s);
        g.addColorStop(0, 'rgba(255,200,80,0)'); g.addColorStop(0.5, 'rgba(255,170,60,0.35)'); g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-30 * s, 120 * s);
        for (let yy = 120; yy >= -120; yy -= 20) ctx.lineTo(-30 * s + Math.sin(yy * 0.03 + t) * 16, yy * s);
        for (let yy = -120; yy <= 120; yy += 20) ctx.lineTo(30 * s + Math.sin(yy * 0.03 + t) * 16, yy * s);
        ctx.fill();
        break;
      }
      case 'current': {
        ctx.strokeStyle = 'rgba(255,240,180,0.55)'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
        const off = (st.t * 60 * o.dir) % 40;
        ctx.setLineDash([24, 16]); ctx.lineDashOffset = -off;
        ctx.beginPath(); ctx.moveTo(-200 * s, 0); ctx.bezierCurveTo(-80 * s, -40 * s, 80 * s, 40 * s, 200 * s, 0); ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'irondrop': {
        const bob = Math.sin(t * 1.5) * 10;
        const g = ctx.createRadialGradient(-4, bob - 4, 1, 0, bob, 14 * s);
        g.addColorStop(0, '#fff8d8'); g.addColorStop(1, '#c86a10');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, bob, 12 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'field': {
        // Earth's magnetic field is made by the swirling liquid iron out here.
        ctx.strokeStyle = 'rgba(90,170,255,0.45)'; ctx.lineWidth = 3;
        for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 60 * i * s, 26 * i * s, 0, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = 'rgba(160,210,255,0.9)'; ctx.font = `700 ${16 * s}px Fredoka, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('N', 0, -10 * s); ctx.fillText('S', 0, 22 * s);
        break;
      }
      case 'ironcrystal': {
        ctx.rotate(o.rot + st.t * 0.1);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(255,250,220,0.35)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(Math.cos(a) * 26 * s, Math.sin(a) * 26 * s); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 26 * s, Math.sin(a) * 26 * s); ctx.lineTo(-Math.cos(a) * 26 * s, -Math.sin(a) * 26 * s); ctx.stroke(); }
        break;
      }
      case 'sparkle': {
        const a = 0.4 + Math.sin(t * 5) * 0.4;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.moveTo(0, -14 * s); ctx.lineTo(3, -3); ctx.lineTo(14 * s, 0); ctx.lineTo(3, 3); ctx.lineTo(0, 14 * s); ctx.lineTo(-3, 3); ctx.lineTo(-14 * s, 0); ctx.lineTo(-3, -3); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function drawDecor() {
    const c0 = Math.floor(dAt(-200) / CHUNK), c1 = Math.floor(dAt(H + 200) / CHUNK);
    for (let ci = c0; ci <= c1; ci++) {
      if (ci < 0) continue;
      for (const o of chunk(ci)) {
        const y = sy(o.d);
        if (y < -200 || y > H + 200) continue;
        drawObj(o, o.x, y);
      }
    }
  }

  // ---- Big features at the stops --------------------------------------------
  const FEATURE = {
    subway(y) {
      // a train tunnel crossing the whole screen
      ctx.fillStyle = '#26221f'; ctx.fillRect(-20, y - 70, W + 40, 120);
      ctx.fillStyle = '#3a3430'; ctx.fillRect(-20, y - 78, W + 40, 10); ctx.fillRect(-20, y + 50, W + 40, 10);
      ctx.fillStyle = '#5a5048'; ctx.fillRect(-20, y + 40, W + 40, 6);
      for (let x = 40; x < W; x += 200) { glow(x, y - 60, 60, 'rgba(255,230,160,A)', 0.35); ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x - 12, y - 68, 24, 6); }
      const tx = wrapX(st.t * 340, 900) - 300;
      for (let c = 0; c < 3; c++) {
        const cx = tx - c * 250;
        ctx.fillStyle = '#d8dde6'; ctx.beginPath(); ctx.roundRect(cx - 115, y - 40, 230, 78, 16); ctx.fill();
        ctx.fillStyle = '#e8364f'; ctx.fillRect(cx - 115, y + 12, 230, 10);
        ctx.fillStyle = '#7fd3ff';
        for (let w = 0; w < 4; w++) ctx.fillRect(cx - 98 + w * 52, y - 28, 38, 26);
        ctx.fillStyle = '#333'; blob(cx - 70, y + 40, 9, '#333'); blob(cx + 70, y + 40, 9, '#333');
      }
    },
    dino(y) {
      // a T. rex skeleton lying in the rock
      ctx.save(); ctx.translate(250, y + 40); ctx.strokeStyle = '#f0e6cc'; ctx.fillStyle = '#f0e6cc'; ctx.lineCap = 'round';
      ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-180, 10); ctx.quadraticCurveTo(-60, -40, 60, -30); ctx.quadraticCurveTo(140, -24, 170, -70); ctx.stroke();
      ctx.lineWidth = 5;
      for (let i = 0; i < 9; i++) { const x = -110 + i * 18; ctx.beginPath(); ctx.moveTo(x, -28 - Math.sin(i / 9 * Math.PI) * 12); ctx.quadraticCurveTo(x + 8, 10, x - 4, 34); ctx.stroke(); }
      ctx.lineWidth = 9;
      for (const [x, k] of [[-40, 1], [30, -1]]) { ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + 14 * k, 50); ctx.lineTo(x - 4 * k, 96); ctx.lineTo(x + 26, 100); ctx.stroke(); }
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(120, -30); ctx.lineTo(140, 0); ctx.lineTo(150, -6); ctx.stroke();
      ctx.save(); ctx.translate(190, -86); ctx.rotate(-0.3);
      ctx.beginPath(); ctx.moveTo(-30, -6); ctx.quadraticCurveTo(10, -36, 70, -14); ctx.lineTo(74, 6); ctx.lineTo(-24, 16); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18, 18); ctx.lineTo(64, 10); ctx.lineTo(56, 26); ctx.lineTo(-10, 30); ctx.closePath(); ctx.fill();
      blob(4, -8, 7, '#7a5530');
      ctx.restore();
      ctx.restore();
    },
    cave(y) {
      // a big glowing cavern on the right
      ctx.save();
      cavity(1250, y + 10, 340, 150, 77, '#1d1a24');
      glow(1250, y + 30, 300, 'rgba(120,90,255,A)', 0.25);
      ctx.fillStyle = '#8f86a3';
      for (let i = 0; i < 11; i++) {
        const x = 980 + hash(i * 3.3) * 540, w = 7 + hash(i + 2) * 9, h = 24 + hash(i) * 70;
        const roof = y + 10 - 125 * Math.sqrt(Math.max(0, 1 - ((x - 1250) / 330) ** 2));
        ctx.beginPath(); ctx.moveTo(x - w, roof - 6); ctx.quadraticCurveTo(x - w * 0.4, roof + h * 0.6, x, roof + h); ctx.quadraticCurveTo(x + w * 0.4, roof + h * 0.6, x + w, roof - 6); ctx.fill();
        if (i % 3 === 0) { const k = (st.t * 0.6 + i * 0.37) % 1; blob(x, roof + h + k * 120, 2.5, `rgba(170,220,255,${1 - k})`); }
      }
      for (let i = 0; i < 9; i++) {
        const x = 1020 + i * 55, h = 40 + hash(i + 9) * 50, hue = 180 + i * 18;
        glow(x, y + 100 - h / 2, 50, `hsla(${hue},100%,65%,A)`, 0.35);
        ctx.fillStyle = `hsl(${hue},90%,70%)`;
        ctx.beginPath(); ctx.moveTo(x - 12, y + 120); ctx.lineTo(x - 5, y + 120 - h); ctx.lineTo(x + 5, y + 120 - h - 10); ctx.lineTo(x + 12, y + 120); ctx.fill();
      }
      ctx.restore();
    },
    mine(y) {
      // a mine level with rails and a minecart rolling along
      ctx.fillStyle = '#1e1a18'; ctx.fillRect(-20, y - 60, W + 40, 110);
      ctx.fillStyle = '#7a5530';
      for (let x = 20; x < W; x += 170) { ctx.fillRect(x, y - 60, 14, 110); ctx.fillRect(x - 10, y - 66, 34, 12); }
      ctx.fillStyle = '#8a8f99'; ctx.fillRect(-20, y + 40, W + 40, 4);
      ctx.fillStyle = '#5a3a22'; for (let x = 0; x < W; x += 30) ctx.fillRect(x, y + 44, 18, 6);
      for (let x = 100; x < W; x += 340) { glow(x, y - 36, 70, 'rgba(255,200,110,A)', 0.4); ctx.fillStyle = '#ffd77a'; ctx.fillRect(x - 6, y - 44, 12, 16); }
      const cx = wrapX(-st.t * 120 + 900, 300);
      ctx.fillStyle = '#6e7586'; ctx.beginPath(); ctx.moveTo(cx - 60, y - 20); ctx.lineTo(cx + 60, y - 20); ctx.lineTo(cx + 48, y + 30); ctx.lineTo(cx - 48, y + 30); ctx.fill();
      for (let i = 0; i < 5; i++) blob(cx - 40 + i * 20, y - 22 - (i % 2) * 8, 13, '#ffcf3a');
      blob(cx - 30, y + 34, 9, '#333'); blob(cx + 30, y + 34, 9, '#333');
    },
    borehole(y) {
      // the real Kola Superdeep Borehole stopped here, 12.2 km down
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(1150, -40); ctx.lineTo(1150, y); ctx.stroke();
      ctx.fillStyle = '#2c2a30'; ctx.beginPath(); ctx.arc(1150, y, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(14,20,48,0.85)'; ctx.beginPath(); ctx.roundRect(1170, y - 30, 300, 58, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '600 20px Fredoka, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Kola Superdeep Borehole', 1186, y - 6);
      ctx.fillStyle = '#b9c3e6'; ctx.font = '500 16px Fredoka, sans-serif';
      ctx.fillText('the deepest hole ever dug · 12,262 m', 1186, y + 16);
    },
    diamonds(y) {
      for (let i = 0; i < 7; i++) {
        const x = 150 + i * 60 + (i % 2) * 20, yy = y + Math.sin(i * 2.1) * 50, s = 1.4 + (i % 3) * 0.4;
        drawObj({ type: 'diamond', s, seed: i * 3, d: 0 }, x, yy);
      }
    },
    centre(y) {
      const pulse = 1 + Math.sin(st.t * 3) * 0.05;
      glow(SX, y, 520 * pulse, 'rgba(255,255,230,A)', 0.9);
      glow(SX, y, 220 * pulse, 'rgba(255,255,255,A)', 1);
      ctx.fillStyle = 'rgba(14,20,48,0.85)'; ctx.beginPath(); ctx.roundRect(140, y - 40, 280, 80, 16); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 26px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🎯 CENTRE OF', 280, y - 6); ctx.fillText('THE EARTH', 280, y + 26);
    }
  };
  function drawFeatures() {
    for (const m of DRILL_STOPS) {
      if (!m.body) continue;
      const y = sy(m.alt);
      if (y < -400 || y > H + 400) continue;
      FEATURE[m.body](y);
    }
  }

  // ---- Ground, sky and the shaft ------------------------------------------------
  function drawRock() {
    const top = Math.max(0, Math.floor(sy(0)));
    if (top >= H) return;
    let prev = -1;
    for (let y = top; y < H + 4; y += 4) {
      const m = mirror(dAt(y));
      ctx.fillStyle = rowColour(m);
      ctx.fillRect(-30, y, W + 60, 5);
      const li = layerIndex(m);
      if (prev >= 0 && li !== prev) {
        // a wavy line where one layer meets the next
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath(); ctx.moveTo(-30, y - 3);
        for (let x = -30; x <= W + 30; x += 40) ctx.lineTo(x, y - 3 + Math.sin(x * 0.012 + li) * 6);
        for (let x = W + 30; x >= -30; x -= 40) ctx.lineTo(x, y + 3 + Math.sin(x * 0.012 + li) * 6);
        ctx.fill();
      }
      prev = li;
    }
  }

  function drawSky() {
    const g0 = sy(0);
    if (g0 <= -40) return;
    const g = ctx.createLinearGradient(0, g0 - 600, 0, g0);
    g.addColorStop(0, '#5fb4ff'); g.addColorStop(1, '#cfeeff');
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, g0 + 34);
    blob(1340, g0 - 300, 50, 'rgba(255,248,210,0.95)');
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [cx, cy, s] of [[180, 120, 1], [760, 70, 0.8], [1450, 140, 0.9]]) {
      const x = wrapX(cx + st.t * 10 * s, 200), y = g0 - 380 + cy;
      [[0, 0, 34], [36, 6, 28], [-34, 8, 26], [10, -18, 26]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill(); });
    }
    // hills, a farmhouse, a tree and the drilling rig
    ctx.fillStyle = '#7cc46a';
    ctx.beginPath(); ctx.moveTo(-30, g0);
    for (let x = -30; x <= W + 30; x += 30) ctx.lineTo(x, g0 - 60 - Math.sin(x * 0.004 + 1) * 40);
    ctx.lineTo(W + 30, g0); ctx.fill();
    ctx.fillStyle = '#4fa84a'; ctx.fillRect(-30, g0 - 14, W + 60, 20);
    ctx.fillStyle = '#3d8c3a';
    for (let x = 0; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, g0 - 14); ctx.lineTo(x + 5, g0 - 24 - (x % 3) * 3); ctx.lineTo(x + 9, g0 - 14); ctx.fill(); }
    // farmhouse
    const hx = 1230;
    ctx.fillStyle = '#e8364f'; ctx.fillRect(hx - 90, g0 - 120, 180, 106);
    ctx.fillStyle = '#7a2230'; ctx.beginPath(); ctx.moveTo(hx - 104, g0 - 118); ctx.lineTo(hx, g0 - 190); ctx.lineTo(hx + 104, g0 - 118); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(hx - 22, g0 - 70, 44, 56); ctx.fillRect(hx - 70, g0 - 100, 34, 30); ctx.fillRect(hx + 36, g0 - 100, 34, 30);
    ctx.fillStyle = '#7a2230'; ctx.fillRect(hx - 2, g0 - 70, 4, 56);
    // tree
    ctx.fillStyle = '#7a5530'; ctx.fillRect(196, g0 - 110, 18, 100);
    blob(205, g0 - 140, 56, '#3d9a45'); blob(170, g0 - 118, 40, '#46a84f'); blob(244, g0 - 116, 42, '#46a84f');
    // the rig over the hole
    if (!st.crash || !st.crash.breach) {
      ctx.strokeStyle = '#d23a2a'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(SX - 120, g0 - 10); ctx.lineTo(SX - 18, g0 - 330); ctx.lineTo(SX + 18, g0 - 330); ctx.lineTo(SX + 120, g0 - 10); ctx.stroke();
      ctx.lineWidth = 4;
      for (let i = 1; i < 5; i++) {
        const f = i / 5, y = g0 - 10 - 320 * f, w = 120 - 102 * f;
        ctx.beginPath(); ctx.moveTo(SX - w, y); ctx.lineTo(SX + w, y); ctx.stroke();
        if (i < 4) { const y2 = g0 - 10 - 320 * (i + 1) / 5, w2 = 120 - 102 * (i + 1) / 5; ctx.beginPath(); ctx.moveTo(SX - w, y); ctx.lineTo(SX + w2, y2); ctx.stroke(); }
      }
      ctx.fillStyle = '#333'; blob(SX, g0 - 334, 14, '#333');
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX, g0 - 330); ctx.lineTo(SX, Math.min(g0 - 10, SY - 110)); ctx.stroke();
    }
  }

  // The hole the drill has dug, from the surface down to the drill.
  function drawShaft() {
    const top = Math.max(-20, sy(0) - 4);
    const bottom = st.crash ? H + 20 : SY;
    if (bottom <= top) return;
    const hot = isHot(mirror(st.cam));
    ctx.fillStyle = '#140d09';
    ctx.beginPath();
    const edge = (y, side) => SX + side * (60 + hash(Math.floor(dAt(y) / 3) + side * 50) * 10);
    ctx.moveTo(edge(top, -1), top);
    for (let y = top; y <= bottom; y += 10) ctx.lineTo(edge(y, -1), y);
    for (let y = bottom; y >= top; y -= 10) ctx.lineTo(edge(y, 1), y);
    ctx.fill();
    const g = ctx.createLinearGradient(SX - 60, 0, SX + 60, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g; ctx.fillRect(SX - 70, top, 140, bottom - top);
    if (hot) {
      ctx.strokeStyle = 'rgba(255,150,40,0.7)'; ctx.lineWidth = 3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (let y = top; y <= bottom; y += 10) { const x = edge(y, side); y === top ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
    } else {
      // wooden rings holding the shaft open
      ctx.fillStyle = 'rgba(122,85,48,0.85)';
      const step = 40 * K, off = ((st.cam * K) % step + step) % step;
      for (let y = top - off + step; y < bottom; y += step) if (mirror(dAt(y)) < 1080) ctx.fillRect(SX - 66, y, 132, 8);
    }
  }

  // ---- Rivals in a live race: their own hole and a smaller drill, each in its own lane -----------
  // Lanes sit either side of your drill, inside the part of the world the window shows (between the
  // depth track and the question card), farthest from your drill first. Each rival keeps its lane
  // number for the whole race; the lanes themselves move if the window is resized.
  let view = { xMin: 0, xMax: W, cardLeft: 970, trackRight: 110 };
  let LANES = [];
  function layLanes() {
    const gap = 115, out = [];
    for (let x = SX + 130; x <= view.cardLeft - 60; x += gap) out.push(x);
    for (let x = SX - 130; x >= view.trackRight + 60; x -= gap) out.push(x);
    LANES = out.sort((a, b) => Math.abs(b - SX) - Math.abs(a - SX)).slice(0, 4);
  }
  layLanes();
  function setView(v) { view = v; layLanes(); }
  const RIVAL_COLOURS = [['#3f8cff', '#9fd0ff'], ['#2fbf71', '#a8f0c8'], ['#b04dff', '#e3b8ff'], ['#ff5d8f', '#ffc2d6']];
  const R_SCALE = 0.62;
  let rivals = [];           // { id, name, depth, shown, label, crashed, finished, lane, colour }
  function setRivals(list) {
    const keep = new Map(rivals.map(r => [r.id, r]));
    const used = new Set(list.map(x => keep.get(x.id)).filter(Boolean).map(r => r.lane));
    rivals = list.slice(0, 4).map(x => {
      let r = keep.get(x.id);
      if (!r) {
        const lane = [0, 1, 2, 3].find(i => !used.has(i));
        used.add(lane);
        r = { id: x.id, lane, shown: x.depth, colour: RIVAL_COLOURS[lane % RIVAL_COLOURS.length] };
      }
      return Object.assign(r, { name: x.name, depth: x.depth, label: x.label, crashed: !!x.crashed, finished: !!x.finished });
    }).filter(r => r.lane !== undefined);
  }
  function updateRivals(dt) {
    // ease toward the latest depth from the server, so a rival glides down instead of jumping
    for (const r of rivals) {
      const goal = r.crashed ? 0 : r.depth;
      r.shown += (goal - r.shown) * (1 - Math.exp(-dt * (r.crashed ? 3 : 1.6)));
    }
  }
  function rivalShaft(x, bottom) {
    const top = Math.max(-20, sy(0) - 4);
    if (bottom <= top) return;
    const half = 60 * R_SCALE;
    ctx.fillStyle = '#140d09';
    ctx.beginPath();
    const edge = (y, side) => x + side * (half + hash(Math.floor(dAt(y) / 3) + side * 50 + x) * 7);
    ctx.moveTo(edge(top, -1), top);
    for (let y = top; y <= bottom; y += 10) ctx.lineTo(edge(y, -1), y);
    for (let y = bottom; y >= top; y -= 10) ctx.lineTo(edge(y, 1), y);
    ctx.fill();
    const g = ctx.createLinearGradient(x - half, 0, x + half, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g; ctx.fillRect(x - half - 6, top, half * 2 + 12, bottom - top);
  }
  function rivalDrill(r, x, tipY) {
    const [c1, c2] = r.colour;
    ctx.save();
    ctx.translate(x + (r.finished || r.crashed ? 0 : (Math.random() - 0.5) * 0.8), tipY - 105 * R_SCALE + Math.sin(st.t * 2.2 + r.lane) * 2);
    if (r.crashed) ctx.rotate(Math.PI * 0.5);
    ctx.scale(R_SCALE, R_SCALE);
    const bg = ctx.createLinearGradient(-48, 0, 48, 0);
    bg.addColorStop(0, c1); bg.addColorStop(0.4, c2); bg.addColorStop(1, c1);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-48, -112, 96, 124, 18); ctx.fill();
    ctx.fillStyle = '#2b2f3a'; ctx.beginPath(); ctx.roundRect(-30, -96, 60, 44, 11); ctx.fill();
    const wg = ctx.createLinearGradient(0, -92, 0, -56);
    wg.addColorStop(0, '#9fe0ff'); wg.addColorStop(1, '#1d4fa0');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.roundRect(-25, -91, 50, 34, 8); ctx.fill();
    blob(0, -68, 8, '#ffd7a8');
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(0, -72, 9.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#3e4352'; ctx.beginPath(); ctx.roundRect(-56, 10, 112, 16, 6); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-50, 24); ctx.lineTo(50, 24); ctx.lineTo(0, 105); ctx.closePath();
    ctx.fillStyle = '#9aa2b4'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = '#6b7385'; ctx.lineWidth = 7;
    const sp = r.finished || r.crashed ? 0 : (st.t * 40 * 3) % 22;
    for (let i = -2; i < 7; i++) { const yy = 24 + i * 22 + sp; ctx.beginPath(); ctx.moveTo(-60, yy - 18); ctx.lineTo(60, yy + 12); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }
  function tag(x, y, text, colour, arrow) {
    ctx.font = '700 17px Fredoka, Nunito, sans-serif';
    const w = ctx.measureText(text).width + 22, h = 28;
    ctx.fillStyle = 'rgba(14,20,48,0.86)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 14); ctx.fill();
    ctx.strokeStyle = colour; ctx.lineWidth = 2.5; ctx.stroke();
    if (arrow) {
      ctx.fillStyle = colour; ctx.beginPath();
      const ay = arrow > 0 ? y + h / 2 + 2 : y - h / 2 - 2;
      ctx.moveTo(x - 9, ay); ctx.lineTo(x + 9, ay); ctx.lineTo(x, ay + arrow * 11); ctx.fill();
    }
    ctx.fillStyle = '#f4f7ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  }
  function drawRivals() {
    if (!rivals.length) return;
    const byX = LANES.slice().sort((a, b) => a - b);
    for (const r of rivals) {
      if (r.lane >= LANES.length) continue;   // a narrow window has fewer lanes: the board still shows them
      const x = LANES[r.lane], tipY = sy(r.shown), name = r.name.length > 12 ? r.name.slice(0, 11) + '…' : r.name;
      const mark = r.crashed ? ' 💥' : r.finished ? ' ✓' : '';
      if (r.crashed) {
        // blasted back out: lying on its side on the surface
        const gy = sy(0);
        if (gy > -60 && gy < H + 60) { rivalDrill(r, x, gy - 20); tag(x, gy - 110, name + mark, r.colour[0]); }
        continue;
      }
      rivalShaft(x, Math.min(H + 20, tipY - 4));
      const stag = byX.indexOf(x) % 2 ? 38 : 0;    // neighbouring lanes' tags sit one above the other
      if (tipY > H + 10) tag(x, H - 90 - stag, `▼ ${name} · ${r.label}${mark}`, r.colour[0]);           // deeper than you can see
      else if (tipY < 80) { if (sy(0) < 60) tag(x, 150 + stag, `▲ ${name} · ${r.label}${mark}`, r.colour[0]); } // behind you
      else { rivalDrill(r, x, tipY); tag(x, tipY - 105 * R_SCALE - 92 * R_SCALE - 26, `${name} · ${r.label}${mark}`, r.colour[0], 1); }
    }
  }

  // ---- The drill --------------------------------------------------------------
  const BITS = [['#c9d0dc', '#7d8596'], ['#ffd76a', '#c99a10'], ['#bff4ff', '#4fb3ff'], ['#e6b3ff', '#9b4dff']];
  const bitColours = () => BITS[st.streak >= 8 ? 3 : st.streak >= 5 ? 2 : st.streak >= 3 ? 1 : 0];

  const FLIP = 0.8, BREACH_V = 760, BREACH_G = 1800, LAND_T = 2 * BREACH_V / BREACH_G;
  function drillPose() {
    let x = SX, y = SY, tilt = 0;
    const buzz = st.dead ? 0 : 0.6 + st.thrust * 1.6;
    x += (Math.random() - 0.5) * buzz;
    y += Math.sin(st.t * 2.2) * 3;
    tilt = Math.sin(st.t * 1.4) * 0.02;
    if (st.dead) { tilt = Math.min(st.deadT * 0.3, 0.25); y += Math.min(st.deadT * 12, 20); }
    if (st.crash) {
      const c = st.crash;
      const f = clamp(c.t / FLIP, 0, 1);
      tilt = (f * f * (3 - 2 * f)) * Math.PI;
      if (c.breach && !c.landed) {
        // out of the hole, up, and over to land on its side
        y += -BREACH_V * c.since + 0.5 * BREACH_G * c.since * c.since + 70 * (c.since / LAND_T);
        x += 180 * (c.since / LAND_T);
        tilt = Math.PI + (c.since / LAND_T) * Math.PI * 0.5;
      } else if (c.landed) {
        x += 180; y += 70; tilt = Math.PI * 1.5 + Math.sin(st.t * 3) * 0.01;
      }
    }
    return { x, y, tilt };
  }

  function drawDrill() {
    const p = drillPose();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt);
    const [b1, b2] = bitColours();
    // hot tip glow
    const m = mirror(st.cam);
    if (isHot(m) || isRock(m)) glow(0, 100, isHot(m) ? 90 : 50, isHot(m) ? 'rgba(255,140,40,A)' : 'rgba(255,220,160,A)', 0.35 + st.thrust * 0.2);
    // exhaust pipe
    ctx.fillStyle = '#4a5060'; ctx.fillRect(20, -140, 14, 34); ctx.fillStyle = '#2b2f3a'; ctx.fillRect(17, -144, 20, 6);
    // side pistons
    ctx.fillStyle = '#8a92a4';
    for (const k of [-1, 1]) { ctx.fillRect(k * 52 - 5, -86, 10, 92); ctx.fillStyle = '#5c6478'; ctx.fillRect(k * 52 - 7, -40, 14, 10); ctx.fillStyle = '#8a92a4'; }
    // body
    const bg = ctx.createLinearGradient(-48, 0, 48, 0);
    bg.addColorStop(0, '#e89a00'); bg.addColorStop(0.35, '#ffd23f'); bg.addColorStop(1, '#d88a00');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-48, -112, 96, 124, 18); ctx.fill();
    // hazard stripes
    ctx.save(); ctx.beginPath(); ctx.rect(-48, -10, 96, 18); ctx.clip();
    ctx.fillStyle = '#222'; ctx.fillRect(-48, -10, 96, 18);
    ctx.fillStyle = '#ffd23f';
    for (let i = -6; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * 16, -10); ctx.lineTo(i * 16 + 8, -10); ctx.lineTo(i * 16 - 2, 8); ctx.lineTo(i * 16 - 10, 8); ctx.fill(); }
    ctx.restore();
    // cockpit and pilot in a hard hat
    ctx.fillStyle = '#5c6478'; ctx.beginPath(); ctx.roundRect(-32, -98, 64, 48, 12); ctx.fill();
    const wg = ctx.createLinearGradient(0, -94, 0, -54);
    wg.addColorStop(0, '#9fe0ff'); wg.addColorStop(1, '#1d4fa0');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.roundRect(-27, -93, 54, 38, 9); ctx.fill();
    blob(0, -66, 9, '#ffd7a8');
    ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(0, -70, 10.5, Math.PI, 0); ctx.fill(); ctx.fillRect(-13, -71, 26, 3);
    blob(0, -80, 3, '#fff8c0');
    ctx.fillStyle = '#222'; blob(-3.2, -66, 1.2, '#222'); blob(3.2, -66, 1.2, '#222');
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath();
    if (st.dead || st.crash) ctx.arc(0, -59.5, 2.4, 1.15 * Math.PI, 1.85 * Math.PI);
    else ctx.arc(0, -63, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-16, -86, 5, 3, -0.6, 0, TAU); ctx.fill();
    // collar
    ctx.fillStyle = '#3e4352'; ctx.beginPath(); ctx.roundRect(-56, 10, 112, 16, 6); ctx.fill();
    // the bit, with spiral grooves that scroll as it spins
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-50, 24); ctx.lineTo(50, 24); ctx.lineTo(0, 105); ctx.closePath();
    const cg = ctx.createLinearGradient(-50, 0, 50, 0);
    cg.addColorStop(0, b2); cg.addColorStop(0.45, b1); cg.addColorStop(1, b2);
    ctx.fillStyle = cg; ctx.fill(); ctx.clip();
    ctx.strokeStyle = b2; ctx.lineWidth = 7;
    const sp = (st.spin * 40) % 22;
    for (let i = -2; i < 7; i++) { const yy = 24 + i * 22 + sp; ctx.beginPath(); ctx.moveTo(-60, yy - 18); ctx.lineTo(60, yy + 12); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }

  // ---- Particles ------------------------------------------------------------------
  function emit(dt) {
    if (st.crash && st.crash.breach) return;
    const p = drillPose();
    const m = mirror(st.cam);
    const moving = !st.dead && !st.crash;
    if (moving && st.cam > 0.5) {
      st.emitD += (4 + st.thrust * 60) * dt;
      while (st.emitD >= 1) {
        st.emitD--;
        const side = Math.random() < 0.5 ? -1 : 1;
        if (isHot(m) && Math.random() < 0.5) {
          parts.push({ k: 'spark', x: p.x + side * rand(10, 40), y: p.y + rand(60, 100), vx: side * rand(80, 260), vy: rand(-260, -60), g: 500, life: rand(0.4, 0.9), max: 0.9, size: rand(2, 4), color: Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a' });
        } else {
          parts.push({ k: 'chip', x: p.x + side * rand(10, 40), y: p.y + rand(60, 100), vx: side * rand(60, 240), vy: rand(-280, -60), g: 900, life: rand(0.5, 1), max: 1, size: rand(3, 7), color: rowColour(m), rot: rand(0, 3) });
          if (isRock(m) && Math.random() < 0.3) parts.push({ k: 'spark', x: p.x, y: p.y + 104, vx: rand(-200, 200), vy: rand(-200, -40), g: 400, life: 0.4, max: 0.4, size: 2, color: '#fff2b0' });
        }
      }
    }
    // exhaust puffs
    st.emitS += (st.dead ? 3 : 2 + st.thrust * 5) * dt;
    while (st.emitS >= 1) {
      st.emitS--;
      const ex = p.x + Math.cos(p.tilt) * 27 + Math.sin(p.tilt) * 144, ey = p.y + Math.sin(p.tilt) * 27 - Math.cos(p.tilt) * 144;
      parts.push({ k: 'smoke', x: ex, y: ey, vx: rand(-15, 15), vy: rand(-60, -30), g: 0, life: rand(1, 1.6), max: 1.6, size: rand(6, 10), grow: 18, color: st.dead ? '#3a3a44' : '#c8c8d0' });
    }
  }

  // ---- Crash (a bad word) ----------------------------------------------------------
  // Flip round, race back up the shaft faster and faster, and pop out of the ground.
  function updateCrash(dt) {
    const c = st.crash;
    c.t += dt;
    if (c.breach) {
      c.since += dt;
      if (!c.landed && c.since > LAND_T) { c.landed = true; c.landT = c.since; burstDirt(SX + 180, TIP - 20, 0.6); st.shake = 0.8; }
      return;
    }
    if (c.t < FLIP) return;
    c.p = Math.min(1, (c.t - FLIP) / c.dur);
    st.cam = c.top * (1 - Math.pow(c.p, 3));
    if (c.p >= 1) { st.cam = 0; c.breach = true; c.since = 0; burstDirt(SX, TIP - 10, 1); st.shake = 1.3; st.flash = 0.4; }
  }
  function burstDirt(x, y, power) {
    const cols = ['#6b4426', '#4e2f19', '#4fa84a', '#8a6a4a'];
    for (let i = 0; i < 110 * power; i++) {
      const a = rand(Math.PI * 1.1, Math.PI * 1.9), sp = rand(150, 750) * power;
      parts.push({ k: 'chip', x: x + rand(-50, 50), y, vx: Math.cos(a) * sp * 0.7, vy: Math.sin(a) * sp, g: 1200, life: rand(0.8, 1.6), max: 1.6, size: rand(3, 9), color: cols[i % cols.length], rot: rand(0, 3) });
    }
    for (let i = 0; i < 20 * power; i++) parts.push({ k: 'smoke', x: x + rand(-60, 60), y: y - rand(0, 30), vx: rand(-90, 90), vy: rand(-90, -20), g: 0, life: rand(1.2, 2), max: 2, size: rand(14, 26), grow: 40, color: '#a08a70' });
    fx.push({ k: 'ring', x, y, r: 360 * power, life: 0.7, max: 0.7, vx: 0, vy: 0, color: '#ffe7b0' });
  }

  // ---- Update / draw -----------------------------------------------------------------
  function update(dt) {
    updateRivals(dt);
    st.t += dt;
    const prev = st.cam;
    if (st.crash) updateCrash(dt);
    else if (!st.dead) {
      st.cam += (st.target - st.cam) * (1 - Math.exp(-dt * 2.4));
      if (Math.abs(st.target - st.cam) < 0.02) st.cam = st.target;
    } else st.deadT += dt;
    const dy = (st.cam - prev) * K;
    st.vel = dt > 0 ? dy / dt : 0;
    st.kick = Math.max(0, st.kick - dt * 1.2);
    const want = st.crash ? (st.crash.breach ? 0 : 1.4) : st.dead ? 0 : 0.25 + clamp(Math.abs(st.vel) / 600, 0, 1.2) + st.kick * 0.6 + st.ignite;
    st.thrust += (want - st.thrust) * Math.min(1, dt * 6);
    st.spin += dt * (st.dead ? 0 : 1 + st.thrust * 6);
    st.shake = Math.max(st.shake, isHot(mirror(st.cam)) && !st.dead ? 0.05 : 0);
    st.shake = Math.max(0, st.shake - dt * 2.5);
    st.flash = Math.max(0, st.flash - dt * 2);

    emit(dt);
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += (q.g || 0) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt - dy;
      if (q.k === 'smoke') { q.size += q.grow * dt; q.vx *= 0.98; }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.k === 'confetti') { f.vy += 220 * dt; f.vx *= 0.99; f.rot += f.vr * dt; }
    }
    const lineV = Math.max(Math.abs(st.vel), st.kick * 900);
    if (lineV > 250) {
      for (let i = 0; i < Math.min(6, lineV / 300); i++) {
        if (Math.random() < 0.5) lines.push({ x: rand(0, W), y: rand(0, H + 200), len: 80 + lineV * 0.12, w: rand(1, 3), a: clamp(lineV / 2500, 0.08, 0.4), life: 0.6 });
      }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      l.y -= dy * 1.8 + 300 * dt * Math.sign(st.vel || 1); l.life -= dt;
      if (l.life <= 0 || l.y + l.len < -50 || l.y > H + 50) lines.splice(i, 1);
    }
    if (onMilestone) for (const s of DRILL_STOPS) if (s.alt > 0 && prev < s.alt && st.cam >= s.alt) onMilestone(s);
  }

  function draw() {
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    if (st.shake) ctx.translate((Math.random() - 0.5) * st.shake * 16, (Math.random() - 0.5) * st.shake * 16);
    ctx.fillStyle = '#4e2f19'; ctx.fillRect(-30, -30, W + 60, H + 60);
    drawRock();
    drawDecor();
    drawFeatures();
    drawSky();
    drawShaft();
    drawRivals();

    // heat haze deep down
    const m = mirror(st.cam);
    if (isHot(m)) {
      const a = clamp((m - 1080) / 2500, 0, 0.35);
      const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1000);
      g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(1, `rgba(255,120,30,${a})`);
      ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
    }

    for (const q of parts) {
      const a = q.life / q.max;
      if (q.k === 'smoke') {
        ctx.globalAlpha = a * 0.5; blob(q.x, q.y, q.size, q.color);
      } else if (q.k === 'spark') {
        ctx.globalAlpha = a; blob(q.x, q.y, q.size, q.color);
      } else {
        ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = q.color;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + q.life * 6); ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (lines.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const l of lines) {
        const lg = ctx.createLinearGradient(0, l.y, 0, l.y + l.len);
        lg.addColorStop(0, `rgba(255,240,220,${l.a})`); lg.addColorStop(1, 'rgba(255,240,220,0)');
        ctx.fillStyle = lg; ctx.fillRect(l.x, l.y, l.w, l.len);
      }
      ctx.restore();
    }
    drawDrill();

    for (const f of fx) {
      if (f.k === 'confetti') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color;
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h * Math.abs(Math.cos(f.rot * 2)));
        ctx.restore();
      } else if (f.k === 'ring') {
        const a = f.life / f.max;
        ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = 5 * a;
        ctx.beginPath(); ctx.arc(f.x, f.y, (1 - a) * f.r + 10, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (st.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${st.flash * 0.5})`; ctx.fillRect(-30, -30, W + 60, H + 60); }
  }

  return {
    W, H,
    init(c) { canvas = c; ctx = c.getContext('2d'); },
    resize(stageScale) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pxScale = stageScale * dpr;
      if (canvas) { canvas.width = Math.round(W * pxScale); canvas.height = Math.round(H * pxScale); }
    },
    update, draw,
    reset() {
      st.cam = 0; st.target = 0; st.dead = false; st.deadT = 0; st.thrust = 0; st.ignite = 0;
      st.streak = 0; st.kick = 0; st.crash = null;
      parts.length = 0; fx.length = 0; lines.length = 0;
      rivals = [];
    },
    setRivals, setView,
    get alt() { return st.cam; },
    setIgnite(v) { st.ignite = v; if (v) st.shake = Math.max(st.shake, 0.15); },
    setStreak(n) { st.streak = n; },
    setTarget(d) { st.target = d; },
    boostTo(d, power) {
      st.target = d;
      st.ignite = 0;
      st.kick = Math.min(1.2, 0.5 + power * 0.15);
      st.shake = Math.max(st.shake, 0.25 + power * 0.1);
      if (power >= 4) st.flash = 0.5;
      fx.push({ k: 'ring', x: SX, y: TIP - 10, r: 140 + power * 40, life: 0.7, max: 0.7, vx: 0, vy: 0, color: bitColours()[0] });
    },
    sputter() { st.shake = 0.4; },
    die() { st.dead = true; st.deadT = 0; },
    crash() {
      const top = st.cam;
      const dur = 0.8 + Math.min(1.4, Math.log10(1 + top) * 0.4);
      st.crash = { t: 0, p: 0, top, dur, breach: false, landed: false, since: 0, landT: 0 };
      st.ignite = 0;
      st.shake = Math.max(st.shake, 0.4);
    },
    get crashDone() { return !!(st.crash && st.crash.landed && st.crash.since - st.crash.landT > 1.2); },
    get crashBoom() { return !!(st.crash && st.crash.breach); },
    confetti(n = 160) {
      const cols = ['#ff5d73', '#ffd23f', '#4fd1ff', '#7ddc6f', '#b04dff', '#ff9a3c'];
      for (let i = 0; i < n; i++) {
        fx.push({ k: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-80, 80), vy: rand(60, 220), rot: rand(0, TAU), vr: rand(-6, 6), w: rand(8, 14), h: rand(10, 18), life: rand(2.5, 4), color: cols[i % cols.length] });
      }
    },
    burst(x, y, color, n = 30) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), sp = rand(100, 360);
        parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: rand(0.5, 1), max: 1, size: rand(2, 4), color });
      }
    },
    rocketScreen() { const p = drillPose(); return { x: p.x, y: p.y + 40 }; },
    onMilestone(fn) { onMilestone = fn; }
  };
})();
