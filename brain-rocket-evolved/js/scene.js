/* Brain Rocket – Evolved: the world behind the quiz (one 1600×900 canvas).
 *
 * The rocket, its flame, smoke, crash and confetti are Brain Rocket's own (copied unchanged).
 * Everything around it is new: a dusk spaceport with a striped setting sun and a glowing grid,
 * then flat "poster" planets with hard shadows and rim light, on a route of 16 stops where
 * 50,000 points reaches the Edge of the Universe.
 */
'use strict';

/* Places the rocket passes. `pts` is the score needed to get there; `alt` is where it sits in the
 * scene. Score maps to altitude in straight lines between these pairs (and on past the last one). */
const STOPS = [
  { pts: 0,     alt: 0,    name: 'Launch Pad',           icon: '🏁' },
  { pts: 1500,  alt: 160,  name: 'Cloud Tops',           icon: '☁️' },
  { pts: 3000,  alt: 360,  name: 'Kármán Line',          icon: '🌌' },
  { pts: 5000,  alt: 560,  name: 'Low Orbit',            icon: '🛰️', body: 'station', bx: 1040, r: 110, by: 250 },
  { pts: 8000,  alt: 900,  name: 'The Moon',             icon: '🌕', body: 'moon', bx: 250, r: 165 },
  { pts: 12000, alt: 1500, name: 'Mars',                 icon: '🔴', body: 'mars', bx: 290, r: 150 },
  { pts: 16000, alt: 2100, name: 'Asteroid Belt',        icon: '🪨' },
  { pts: 20000, alt: 2700, name: 'Jupiter',              icon: '🟠', body: 'jupiter', bx: 210, r: 245 },
  { pts: 24000, alt: 3300, name: 'Saturn',               icon: '🪐', body: 'saturn', bx: 270, r: 150 },
  { pts: 28000, alt: 3900, name: 'Uranus',               icon: '🧊', body: 'uranus', bx: 260, r: 120 },
  { pts: 32000, alt: 4500, name: 'Neptune',              icon: '🔵', body: 'neptune', bx: 270, r: 120 },
  { pts: 36000, alt: 5100, name: 'Kuiper Belt',          icon: '❄️', body: 'pluto', bx: 300, r: 70 },
  { pts: 40000, alt: 5700, name: 'Oort Cloud',           icon: '☄️' },
  { pts: 43500, alt: 6300, name: 'Crab Nebula',          icon: '🌸', body: 'nebula', bx: 360, r: 400 },
  { pts: 47000, alt: 6900, name: 'Galactic Core',        icon: '✨', body: 'core', bx: 400, r: 360 },
  { pts: 50000, alt: 7500, name: 'Edge of the Universe', icon: '♾️', body: 'edge', bx: 460, r: 360 }
];

const Scene = (function () {
  const W = 1600, H = 900;
  const K = 3;            // screen pixels per unit of altitude
  const P_BODY = 0.6;     // parallax for planets
  const RX = 560;         // rocket x
  const BASE = 700;       // rocket nozzle y while on the pad / cruising
  const TAU = Math.PI * 2;

  let canvas, ctx, pxScale = 1;
  const st = {
    cam: 0, target: 0, vel: 0, t: 0, thrust: 0, onPad: true, ignite: 0,
    dead: false, deadT: 0, shake: 0, sputter: 0, dip: 0, dipV: 0, streak: 0,
    emitF: 0, emitS: 0, kick: 0, armAngle: 0, flash: 0,
    crash: null
  };
  const parts = [];   // flame, smoke, sparks (world-anchored)
  const fx = [];      // screen-space: confetti, shooting stars, rings
  const lines = [];   // speed lines
  let onStop = null;

  // ---- Helpers ----------------------------------------------------------
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
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; };
  const wrapX = (x, m = 260) => { const span = W + m * 2; return ((((x + m) % span) + span) % span) - m; };
  const sy = (alt, p = 1) => BASE - (alt - st.cam) * K * p;

  // ---- Sky: dusk at the pad, violet up high, then deep space that shifts hue stop by stop ----
  const SKY = [
    [0,    '#2a1458', '#ff8a5c'],
    [100,  '#251a6b', '#e2587a'],
    [220,  '#1a1c6e', '#8a3c8f'],
    [360,  '#0d1150', '#3a2470'],
    [520,  '#070a2c', '#141a4a'],
    [900,  '#05061c', '#0d1030'],
    [1500, '#14081a', '#2a0f22'],
    [2100, '#0c0a10', '#1d1518'],
    [2700, '#160c06', '#2b1a0d'],
    [3300, '#0f0d06', '#221c0c'],
    [3900, '#031416', '#062a2c'],
    [4500, '#030a22', '#071a44'],
    [5100, '#0a0b14', '#161826'],
    [5700, '#060812', '#0e1322'],
    [6300, '#1c0630', '#3c0c40'],
    [6900, '#1e1004', '#3a2208'],
    [7500, '#04020c', '#0c0626']
  ];
  function skyAt(a) {
    if (a >= SKY[SKY.length - 1][0]) {
      const h = (a * 0.02 + st.t * 5) % 360;
      return [`hsl(${h},60%,6%)`, `hsl(${(h + 60) % 360},65%,13%)`];
    }
    let i = 0;
    while (i < SKY.length - 2 && a > SKY[i + 1][0]) i++;
    const s0 = SKY[i], s1 = SKY[i + 1];
    const t = clamp((a - s0[0]) / (s1[0] - s0[0]), 0, 1);
    return [mix(s0[1], s1[1], t), mix(s0[2], s1[2], t)];
  }

  // ---- Decoration, by altitude ------------------------------------------
  const ZONES = [
    { to: 300,      d: 1.3, types: { cloud: 6, birds: 1.4, jet: 1, kite: 0.4 } },
    { to: 520,      d: 1.0, types: { wisp: 3, jet: 0.6, aurora: 0.8 } },
    { to: 1200,     d: 1.0, types: { sat: 3, junk: 1.2, rock: 0.6, astro: 0.4 } },
    { to: 2000,     d: 0.9, types: { rock: 1.5, comet: 0.8, sat: 0.3, ufo: 0.25 } },
    { to: 2400,     d: 3.0, types: { rock: 9, comet: 0.3 } },
    { to: 5100,     d: 0.9, types: { ice: 1.5, comet: 1, probe: 0.4, rock: 0.5 } },
    { to: 6000,     d: 1.6, types: { ice: 3, comet: 2.2 } },
    { to: 7200,     d: 1.4, types: { gas: 3, cluster: 1.2, galaxy: 0.6 } },
    { to: Infinity, d: 1.5, types: { galaxy: 1.4, gas: 1, cluster: 1, crystal: 1, ufo: 0.2 } }
  ];
  const zoneAt = a => ZONES.find(z => a < z.to);
  const CHUNK = 100;
  const chunkCache = new Map();
  function chunk(ci) {
    if (chunkCache.has(ci)) return chunkCache.get(ci);
    if (chunkCache.size > 260) chunkCache.clear();
    const rng = mulberry32(ci * 7919 + 101);
    const zone = zoneAt(ci * CHUNK + 50);
    const out = [];
    const n = Math.floor(zone.d + rng() * 1.2);
    const pairs = Object.entries(zone.types);
    const total = pairs.reduce((s, p) => s + p[1], 0);
    for (let i = 0; i < n; i++) {
      const alt = ci * CHUNK + rng() * CHUNK;
      if (alt < 50) continue;
      let r = rng() * total, type = pairs[0][0];
      for (const [t, w] of pairs) { if ((r -= w) <= 0) { type = t; break; } }
      out.push(makeObj(type, alt, rng));
    }
    chunkCache.set(ci, out);
    return out;
  }
  function makeObj(type, alt, rng) {
    const o = { type, alt, x: rng() * W, s: 0.7 + rng() * 0.6, p: 1, seed: rng() * 1000, vx: (rng() < 0.5 ? -1 : 1) * (5 + rng() * 15), hue: Math.floor(rng() * 360), rot: (rng() - 0.5) * 0.8 };
    switch (type) {
      case 'cloud': o.p = 0.75 + rng() * 0.5; o.w = 220 + rng() * 260; o.h = 26 + rng() * 22; o.vx = 6 + rng() * 10; o.tiers = 2 + Math.floor(rng() * 2); break;
      case 'wisp': o.p = 0.85; o.vx = 10 + rng() * 10; o.w = 300 + rng() * 300; break;
      case 'birds': o.vx = (rng() < 0.5 ? -1 : 1) * (50 + rng() * 40); o.n = 3 + Math.floor(rng() * 4); break;
      case 'jet': o.vx = (rng() < 0.5 ? -1 : 1) * (200 + rng() * 120); o.s = 0.6 + rng() * 0.3; break;
      case 'kite': o.vx = 12; break;
      case 'aurora': o.p = 0.7; o.vx = 0; break;
      case 'rock': case 'ice': case 'junk':
        o.verts = Array.from({ length: 6 + Math.floor(rng() * 3) }, () => 0.7 + rng() * 0.4);
        o.r = type === 'junk' ? 7 + rng() * 6 : 14 + rng() * 34;
        o.vx = (rng() - 0.5) * 30; break;
      case 'comet': o.vx = (rng() < 0.5 ? -1 : 1) * (60 + rng() * 60); break;
      case 'gas': o.p = 0.7 + rng() * 0.3; o.r = 140 + rng() * 180; o.vx = (rng() - 0.5) * 8; o.hue = [300, 330, 200, 270, 180, 20][Math.floor(rng() * 6)]; break;
      case 'cluster': o.p = 0.8; o.vx = (rng() - 0.5) * 4; o.stars = Array.from({ length: 14 }, () => ({ x: (rng() + rng() - 1) * 70, y: (rng() + rng() - 1) * 70, r: 0.8 + rng() * 2 })); break;
      case 'galaxy': o.p = 0.75; o.vx = (rng() - 0.5) * 4; o.tilt = rng() * Math.PI; break;
      case 'crystal': o.vx = (rng() - 0.5) * 12; o.r = 16 + rng() * 22; break;
      case 'ufo': o.vx = (rng() < 0.5 ? -1 : 1) * (40 + rng() * 80); break;
    }
    return o;
  }

  // ---- Stars ------------------------------------------------------------
  const STAR_LAYERS = [{ p: 0.04, n: 120, r: [0.5, 1.2] }, { p: 0.12, n: 60, r: [0.8, 1.8] }, { p: 0.3, n: 20, r: [1.4, 2.6] }];
  const starTiles = new Map();
  function starTile(layer, i) {
    const id = layer * 100000 + i;
    if (starTiles.has(id)) return starTiles.get(id);
    if (starTiles.size > 60) starTiles.clear();
    const L = STAR_LAYERS[layer], rng = mulberry32(id * 31 + 7);
    const stars = Array.from({ length: L.n }, () => ({ x: rng() * W, y: rng() * H, r: lerp(L.r[0], L.r[1], rng()), ph: rng() * TAU, sp: 1 + rng() * 3, c: ['#ffffff', '#d6e4ff', '#ffe9c9', '#ffd1f0', '#c9fff6'][Math.floor(rng() * 5)] }));
    starTiles.set(id, stars);
    return stars;
  }
  function drawStars(alpha) {
    if (alpha <= 0) return;
    for (let li = 0; li < STAR_LAYERS.length; li++) {
      const L = STAR_LAYERS[li], s = st.cam * K * L.p;
      const i0 = Math.floor((s + BASE - H) / H), i1 = Math.floor((s + BASE) / H);
      for (let i = i0; i <= i1; i++) for (const star of starTile(li, i)) {
        const y = BASE - (i * H + star.y - s);
        if (y < -5 || y > H + 5) continue;
        const tw = 0.55 + 0.45 * Math.sin(st.t * star.sp + star.ph);
        ctx.globalAlpha = alpha * tw; ctx.fillStyle = star.c;
        if (li === 2) {   // the near stars are little four-pointed sparkles
          const r = star.r * 2.2;
          ctx.beginPath(); ctx.moveTo(star.x, y - r); ctx.lineTo(star.x + r * 0.25, y); ctx.lineTo(star.x, y + r); ctx.lineTo(star.x - r * 0.25, y); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(star.x - r, y); ctx.lineTo(star.x, y + r * 0.25); ctx.lineTo(star.x + r, y); ctx.lineTo(star.x, y - r * 0.25); ctx.closePath(); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(star.x, y, star.r, 0, TAU); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- The spaceport at dusk --------------------------------------------
  const groundRng = mulberry32(2026);
  const RIDGES = [
    { p: 0.25, base: -150, amp: 150, f: [0.0032, 0.011], col: '#5b2a7a', snow: '#c48bd8' },
    { p: 0.4,  base: -80,  amp: 110, f: [0.0047, 0.016], col: '#3f1d63', snow: null },
    { p: 0.6,  base: -20,  amp: 60,  f: [0.0071, 0.021], col: '#2a1248', snow: null }
  ];
  const ridgeY = (R, x, top) => top - R.amp * (0.55 + 0.45 * Math.sin(x * R.f[0] + R.p * 9)) - R.amp * 0.3 * Math.sin(x * R.f[1] + 1.3);
  // the launch complex, left to right (world x): dishes, water tower, pad, gantry, assembly building
  const DISHES = [{ x: 120, s: 1, ph: 0 }, { x: 255, s: 0.78, ph: 2.1 }];
  const PALMS = [{ x: 40, s: 1.05 }, { x: 1545, s: 0.95 }];
  const VAB = { x: 800, w: 190, h: 250 };
  const RIM = '#ff9a7a';       // sunset rim light (the sun is to the right)
  const SIL = '#1c0b34', SIL2 = '#2a1350', SIL3 = '#120624';
  function drawSunset() {
    const top = BASE - 70 + st.cam * K * 0.18;
    const fade = clamp(1 - (st.cam - 260) / 220, 0, 1);   // gone by the Kármán Line
    if (top - 460 > H || fade <= 0) return;
    ctx.save(); ctx.globalAlpha = fade;
    const x = 980, r = 230, y = top - 80;
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6);
    glow.addColorStop(0, 'rgba(255,150,90,0.55)'); glow.addColorStop(1, 'rgba(255,90,120,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, '#ffe66b'); g.addColorStop(0.5, '#ff8a4c'); g.addColorStop(1, '#ff3f8e');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    // the stripes cut out of its lower half, scrolling slowly down
    const sky = skyAt(st.cam)[1];
    ctx.fillStyle = sky;
    for (let i = 0; i < 7; i++) {
      const sy0 = y + ((i * 26 + st.t * 8) % 182) - 6;
      const hgt = 3 + (sy0 - y) * 0.06;
      if (sy0 > y - 4) ctx.fillRect(x - r, sy0, r * 2, Math.max(2, hgt));
    }
    ctx.restore();
    ctx.restore();
  }
  // a lattice: two legs from (x0,w0 at y0) to (x1,w1 at y1), braced every `step`
  function lattice(xb, wb, yb, xt, wt, yt, step, col, lw) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(xb - wb / 2, yb); ctx.lineTo(xt - wt / 2, yt);
    ctx.moveTo(xb + wb / 2, yb); ctx.lineTo(xt + wt / 2, yt);
    const n = Math.max(1, Math.round((yb - yt) / step));
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n;
      const ya = lerp(yb, yt, f0), yb2 = lerp(yb, yt, f1);
      const xa = lerp(xb, xt, f0), wa = lerp(wb, wt, f0), xc = lerp(xb, xt, f1), wc = lerp(wb, wt, f1);
      ctx.moveTo(xa - wa / 2, ya); ctx.lineTo(xc + wc / 2, yb2);
      ctx.moveTo(xa + wa / 2, ya); ctx.lineTo(xc - wc / 2, yb2);
      ctx.moveTo(xc - wc / 2, yb2); ctx.lineTo(xc + wc / 2, yb2);
    }
    ctx.stroke();
  }
  const blink = (rate, ph = 0) => (st.t * rate + ph) % 1 < 0.18;

  function drawDish(d, hz) {
    const s = d.s, x = d.x, base = hz + 6, top = base - 120 * s;
    lattice(x, 34 * s, base, x, 10 * s, top + 10 * s, 22 * s, SIL2, 2.5 * s);
    ctx.fillStyle = SIL; ctx.fillRect(x - 22 * s, base - 6, 44 * s, 6);
    // the dish turns slowly to track something, tipped back toward the sky
    const a = -0.55 + Math.sin(st.t * 0.25 + d.ph) * 0.35;
    ctx.save(); ctx.translate(x, top); ctx.rotate(a);
    const R = 62 * s;
    ctx.fillStyle = SIL2;
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.quadraticCurveTo(0, R * 0.75, R, 0); ctx.closePath(); ctx.fill();   // the back of the bowl
    ctx.fillStyle = '#3b1d66';
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.22, 0, 0, TAU); ctx.fill();                                  // the face
    ctx.strokeStyle = RIM; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.22, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.strokeStyle = SIL2; ctx.lineWidth = 2.5 * s;                                                        // feed struts and receiver
    ctx.beginPath(); ctx.moveTo(-R * 0.7, -2); ctx.lineTo(0, -R * 0.7); ctx.lineTo(R * 0.7, -2); ctx.stroke();
    ctx.fillStyle = blink(0.5, d.ph) ? '#ff4d8d' : '#5a1838';
    ctx.beginPath(); ctx.arc(0, -R * 0.72, 4 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawWaterTower(x, hz) {
    const base = hz + 4, top = base - 150;
    lattice(x, 70, base, x, 46, top + 30, 30, SIL2, 3);
    ctx.fillStyle = SIL;
    ctx.beginPath(); ctx.ellipse(x, top + 6, 46, 34, 0, 0, TAU); ctx.fill();
    ctx.fillRect(x - 46, top + 6, 92, 22);
    ctx.beginPath(); ctx.ellipse(x, top + 28, 46, 14, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = RIM; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, top + 6, 46, -Math.PI * 0.45, 0.05); ctx.stroke();
    ctx.fillStyle = 'rgba(255,154,122,0.85)'; ctx.font = '700 15px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SirSC', x, top + 22); ctx.textAlign = 'start';
  }

  function drawVab(hz) {
    const { x, w, h } = VAB, base = hz + 8, top = base - h;
    // a big assembly building: front face, a lit side face, a tall door with a glowing seam
    ctx.fillStyle = SIL; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = SIL2; ctx.beginPath(); ctx.moveTo(x + w, top); ctx.lineTo(x + w + 34, top + 14); ctx.lineTo(x + w + 34, base); ctx.lineTo(x + w, base); ctx.fill();
    ctx.fillStyle = RIM; ctx.fillRect(x + w, top, 2.5, h);
    ctx.fillStyle = SIL3; ctx.fillRect(x + w * 0.32, top + 34, w * 0.36, h - 34);
    ctx.fillStyle = 'rgba(255,122,217,0.65)'; ctx.fillRect(x + w * 0.5 - 1, top + 34, 2, h - 34);
    ctx.fillStyle = 'rgba(255,233,170,0.75)';
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
      if (((r * 7 + c * 3) % 5) === 0) continue;
      ctx.fillRect(x + 10 + c * 13, top + 44 + r * 30, 7, 9);
      ctx.fillRect(x + w - 59 + c * 13, top + 44 + r * 30, 7, 9);
    }
    // a big stripe flag and the name across the top
    ctx.fillStyle = '#ff5fb0'; ctx.fillRect(x + 10, top + 12, w - 20, 5);
    ctx.fillStyle = '#ffd84d'; ctx.fillRect(x + 10, top + 20, w - 20, 3);
    ctx.fillStyle = SIL2; ctx.fillRect(x + w - 30, top - 40, 4, 40);
    ctx.fillStyle = blink(0.6, 0.3) ? '#ff3355' : '#551122';
    ctx.beginPath(); ctx.arc(x + w - 28, top - 42, 4, 0, TAU); ctx.fill();
  }

  function drawPalm(pm, hz) {
    const bx = pm.x, by = hz + 6, s = pm.s, sw = Math.sin(st.t * 1.2 + bx) * 3;
    ctx.strokeStyle = SIL3; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 14 * s, by - 80 * s, bx + 6 * s + sw, by - 150 * s); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = SIL3;
    const tx = bx + 6 * s + sw, ty = by - 150 * s;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(st.t + i) * 0.04;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40 * s, -14 * s, 78 * s, 10 * s); ctx.quadraticCurveTo(40 * s, -2 * s, 0, 4 * s); ctx.fill();
      ctx.restore();
    }
  }

  function drawFloodlight(x, pt, ph) {
    const top = pt - 210;
    ctx.fillStyle = SIL; ctx.fillRect(x - 3, top, 6, pt - top + 30);
    ctx.fillRect(x - 18, top - 6, 36, 12);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#fff2d8'; ctx.fillRect(x - 15 + i * 11, top - 4, 8, 7); }
    // its beam sweeps the sky slowly
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const a = -Math.PI / 2 + Math.sin(st.t * 0.3 + ph) * 0.32;
    const g = ctx.createLinearGradient(x, top, x + Math.cos(a) * 760, top + Math.sin(a) * 760);
    g.addColorStop(0, 'rgba(255,215,235,0.2)'); g.addColorStop(1, 'rgba(255,215,235,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, top);
    ctx.lineTo(x + Math.cos(a - 0.07) * 820, top + Math.sin(a - 0.07) * 820);
    ctx.lineTo(x + Math.cos(a + 0.07) * 820, top + Math.sin(a + 0.07) * 820);
    ctx.fill(); ctx.restore();
  }

  function drawGantry(pt) {
    const tx = RX + 118, top = pt - 380;
    // lightning wire from the mast down to the ground on the far side
    ctx.strokeStyle = 'rgba(30,12,56,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx, top - 70); ctx.quadraticCurveTo(tx - 260, top + 120, RX - 300, pt + 4); ctx.stroke();
    // the tower: four legs, cross-braced, a little narrower at the top
    ctx.fillStyle = 'rgba(28,11,52,0.92)';
    ctx.beginPath(); ctx.moveTo(tx - 30, pt); ctx.lineTo(tx - 22, top); ctx.lineTo(tx + 22, top); ctx.lineTo(tx + 30, pt); ctx.fill();
    lattice(tx, 60, pt, tx, 44, top, 34, '#4b2378', 2.5);
    ctx.fillStyle = RIM; ctx.beginPath(); ctx.moveTo(tx + 29, pt); ctx.lineTo(tx + 21, top); ctx.lineTo(tx + 23.5, top); ctx.lineTo(tx + 31.5, pt); ctx.fill();
    // service floors with little lights, every few braces
    for (let y = pt - 60, i = 0; y > top + 10; y -= 68, i++) {
      const hw = lerp(30, 22, (pt - y) / (pt - top)) + 10;
      ctx.fillStyle = '#2a1350'; ctx.fillRect(tx - hw, y - 4, hw * 2, 6);
      ctx.fillStyle = (Math.floor(st.t * 2) + i) % 4 ? '#ffd9a0' : '#ff9ad5';
      ctx.fillRect(tx - hw + 4, y - 9, 4, 4); ctx.fillRect(tx + hw - 8, y - 9, 4, 4);
    }
    // crew access arm (swings away at ignition) with its white room at the end
    ctx.save(); ctx.translate(tx - 26, pt - 160); ctx.rotate(-st.armAngle);
    ctx.fillStyle = '#2a1350'; ctx.fillRect(-64, -7, 64, 14);
    ctx.fillStyle = '#d9d2ee'; ctx.fillRect(-76, -12, 16, 24);
    ctx.strokeStyle = RIM; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-64, -7); ctx.lineTo(0, -7); ctx.stroke();
    ctx.restore();
    // a lower fuel arm
    ctx.save(); ctx.translate(tx - 26, pt - 70); ctx.rotate(-st.armAngle * 0.8);
    ctx.fillStyle = '#2a1350'; ctx.fillRect(-52, -4, 52, 8);
    ctx.restore();
    // the lightning mast and a crane jib on top
    ctx.fillStyle = '#2a1350'; ctx.fillRect(tx - 3, top - 70, 6, 70);
    ctx.save(); ctx.translate(tx, top - 8); ctx.rotate(-0.08 + Math.sin(st.t * 0.2) * 0.04);
    ctx.fillRect(-10, -6, 110, 7); ctx.fillRect(-40, -6, 30, 12);
    ctx.strokeStyle = '#2a1350'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(90, 60 + Math.sin(st.t) * 6); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = blink(0.8) ? '#ff3355' : '#661122';
    ctx.beginPath(); ctx.arc(tx, top - 74, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = blink(0.8, 0.5) ? '#ff3355' : '#661122';
    ctx.beginPath(); ctx.arc(tx + 22, top + 4, 4, 0, TAU); ctx.fill();
  }

  function drawPad(gy, pt) {
    // the apron: a slab of concrete running toward you, in the grid's perspective
    const ag = ctx.createLinearGradient(0, gy - 8, 0, gy + 420);
    ag.addColorStop(0, '#2c1452'); ag.addColorStop(1, 'rgba(30,12,60,0.15)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.moveTo(RX - 230, gy - 8); ctx.lineTo(RX + 290, gy - 8); ctx.lineTo(RX + 900, gy + 600); ctx.lineTo(RX - 840, gy + 600); ctx.fill();
    ctx.strokeStyle = 'rgba(255,154,122,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(RX - 230, gy - 8); ctx.lineTo(RX + 290, gy - 8); ctx.stroke();
    // painted lines on the apron
    ctx.strokeStyle = 'rgba(255,216,77,0.25)'; ctx.lineWidth = 3; ctx.setLineDash([18, 16]);
    ctx.beginPath(); ctx.moveTo(RX + 30, gy + 30); ctx.lineTo(RX + 40, gy + 600); ctx.stroke(); ctx.setLineDash([]);
    // the launch mount: a raised block with a flame trench under the rocket
    ctx.fillStyle = '#2c1452';
    ctx.beginPath(); ctx.moveTo(RX - 170, gy + 4); ctx.lineTo(RX - 150, pt); ctx.lineTo(RX + 150, pt); ctx.lineTo(RX + 170, gy + 4); ctx.fill();
    ctx.fillStyle = '#3d1c6e'; ctx.fillRect(RX - 150, pt, 300, 7);
    ctx.fillStyle = RIM; ctx.fillRect(RX + 120, pt, 30, 2.5);
    ctx.fillStyle = '#0b0418'; ctx.beginPath(); ctx.moveTo(RX - 44, gy + 4); ctx.lineTo(RX - 34, pt + 10); ctx.lineTo(RX + 34, pt + 10); ctx.lineTo(RX + 44, gy + 4); ctx.fill();
    // glow from the trench while the engine lights
    if (st.onPad && st.ignite > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(RX, pt + 24, 4, RX, pt + 24, 90);
      g.addColorStop(0, `rgba(255,170,90,${0.6 * st.ignite})`); g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g; ctx.fillRect(RX - 100, pt - 70, 200, 170); ctx.restore();
    }
    // hazard stripes along the front, and hold-down posts either side of the nozzle
    ctx.save(); ctx.beginPath(); ctx.rect(RX - 150, pt + 14, 300, 9); ctx.clip();
    for (let x = RX - 160; x < RX + 160; x += 16) {
      ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.moveTo(x, pt + 23); ctx.lineTo(x + 8, pt + 14); ctx.lineTo(x + 14, pt + 14); ctx.lineTo(x + 6, pt + 23); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#4b2378'; ctx.fillRect(RX - 58, pt - 16, 10, 16); ctx.fillRect(RX + 48, pt - 16, 10, 16);
    // a row of deck lights that chase toward the rocket on the pad
    for (let i = 0; i < 7; i++) {
      const on = st.onPad && Math.floor(st.t * 5 - Math.abs(i - 3)) % 4 === 0;
      ctx.fillStyle = on ? '#fff2a8' : '#ff8a4c';
      ctx.globalAlpha = on ? 1 : 0.6;
      ctx.beginPath(); ctx.arc(RX - 132 + i * 44, pt + 4, 3.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // runway lights leading in along the grid
    for (let k = 1; k <= 6; k++) {
      const y = gy + 30 + k * k * 9, spread = 340 + k * 70;
      ctx.fillStyle = (Math.floor(st.t * 3) - k) % 6 === 0 ? '#fff2a8' : 'rgba(255,138,76,0.7)';
      ctx.beginPath(); ctx.arc(RX - spread, y, 2 + k * 0.5, 0, TAU); ctx.arc(RX + spread + 40, y, 2 + k * 0.5, 0, TAU); ctx.fill();
    }
  }

  function drawGround() {
    const gy = BASE + 40 + st.cam * K;
    if (gy - 560 > H) return;
    // three ridges of violet mountains
    for (const R of RIDGES) {
      const top = BASE + R.base + st.cam * K * R.p;
      if (top - R.amp * 1.4 > H) continue;
      ctx.fillStyle = R.col;
      ctx.beginPath(); ctx.moveTo(-20, H + 2400);
      for (let x = -20; x <= W + 40; x += 24) ctx.lineTo(x, ridgeY(R, x, top));
      ctx.lineTo(W + 40, H + 2400); ctx.fill();
      if (R.snow) {
        ctx.fillStyle = R.snow;
        for (let x = 140; x < W; x += 330) {
          const t0 = ridgeY(R, x, top);
          ctx.beginPath(); ctx.moveTo(x - 26, t0 + 22); ctx.lineTo(x, t0 - 1); ctx.lineTo(x + 26, t0 + 22); ctx.lineTo(x + 8, t0 + 14); ctx.lineTo(x - 6, t0 + 20); ctx.closePath(); ctx.fill();
        }
      }
    }
    // the plain, with a glowing perspective grid running to the horizon
    const hz = gy - 46, pt = gy - 40;
    const pg = ctx.createLinearGradient(0, hz, 0, gy + 260);
    pg.addColorStop(0, '#1b0b36'); pg.addColorStop(1, '#090418');
    ctx.fillStyle = pg; ctx.fillRect(-20, hz, W + 40, 2400);
    ctx.save();
    ctx.beginPath(); ctx.rect(-20, hz, W + 40, H + 2400); ctx.clip();
    ctx.strokeStyle = 'rgba(255,90,200,0.42)'; ctx.lineWidth = 1.5;
    const vx = RX + 40;
    ctx.beginPath();
    for (let i = -18; i <= 18; i++) { ctx.moveTo(vx + i * 30, hz); ctx.lineTo(vx + i * 260, hz + 600); }
    for (let k = 0; k < 14; k++) {
      const d = ((k + (st.t * 0.6) % 1) / 14);
      const yy = hz + Math.pow(d, 2.2) * 600;
      ctx.moveTo(-20, yy); ctx.lineTo(W + 40, yy);
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,120,220,0.9)'; ctx.fillRect(-20, hz - 1, W + 40, 2);
    // a strip of low buildings with lit windows along the horizon
    ctx.fillStyle = SIL3;
    for (let x = 340; x < 1500; x += 70) {
      if (x > RX - 220 && x < RX + 250) continue;
      const h = 16 + ((x * 13) % 22);
      ctx.fillRect(x, hz - h, 56, h + 2);
      ctx.fillStyle = 'rgba(255,220,160,0.7)';
      for (let k = 0; k < 3; k++) if ((x + k) % 3) ctx.fillRect(x + 8 + k * 16, hz - h + 6, 5, 4);
      ctx.fillStyle = SIL3;
    }
    for (const pm of PALMS) drawPalm(pm, hz);
    for (const d of DISHES) drawDish(d, hz);
    drawWaterTower(RX - 190, hz);
    drawVab(hz);
    drawFloodlight(RX - 260, pt, 0);
    drawFloodlight(RX + 215, pt, 2);
    drawPad(gy, pt);
    drawGantry(pt);
  }

  // ---- The planet below, seen from orbit --------------------------------
  function drawHomeworld() {
    const e = clamp((st.cam - 330) / (1300 - 330), 0, 1);
    if (e <= 0 || e >= 1) return;
    const ee = e * e * (3 - 2 * e);
    const R = lerp(2600, 70, Math.sqrt(ee));
    const topY = lerp(H - 140, H + 10, ee);
    const cx = lerp(W * 0.4, RX, ee), cy = topY + R;
    halo(cx, cy, R, 'rgba(255,120,200,0.45)', 1.07);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = '#1d3b8c'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = '#2f9f8a';
    const spin = st.t * 0.02;
    for (let i = 0; i < 7; i++) {
      const a = spin + i * 0.9, px = cx + Math.cos(a) * R * 0.75, py = cy - R * 0.55 + Math.sin(i * 2.1) * R * 0.35;
      ctx.beginPath(); ctx.ellipse(px, py, R * 0.22, R * 0.11, i, 0, TAU); ctx.fill();
    }
    // the night side, with city lights
    ctx.fillStyle = 'rgba(8,4,30,0.55)'; ctx.beginPath(); ctx.arc(cx + R * 0.55, cy - R * 0.1, R * 1.05, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,170,230,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  }

  // ---- Planets: flat colour, posterised bands, a hard shadow and rim light ----
  function halo(x, y, r, color, size = 1.35) {
    const g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * size);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * size, 0, TAU); ctx.fill();
  }
  // a disc in flat bands (clip to it first), then the night-side crescent and a lit rim
  function poster(x, y, r, base, bands, rim, extra) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.fillStyle = base; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (bands) bands.forEach(([off, h, col, wob]) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x - r, y + off * r);
      for (let bx = -r; bx <= r; bx += 16) ctx.lineTo(x + bx, y + off * r + Math.sin(bx * 0.03 + st.t * 0.3 + off * 9) * (wob || 0));
      for (let bx = r; bx >= -r; bx -= 16) ctx.lineTo(x + bx, y + (off + h) * r + Math.sin(bx * 0.025 + st.t * 0.3 + off * 7) * (wob || 0));
      ctx.closePath(); ctx.fill();
    });
    if (extra) extra();
    ctx.fillStyle = 'rgba(6,2,24,0.5)';
    ctx.beginPath(); ctx.arc(x + r * 0.45, y + r * 0.3, r * 1.08, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(6,2,24,0.35)';
    ctx.beginPath(); ctx.arc(x + r * 0.8, y + r * 0.55, r * 0.95, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(2, r * 0.025);
    ctx.beginPath(); ctx.arc(x, y, r - 1, Math.PI * 0.95, Math.PI * 1.75); ctx.stroke();
  }
  // half a ring: the back half is drawn before the planet, the front half after
  function ring(x, y, r, back, cols, tilt, w = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    cols.forEach((c, i) => {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.07 * w;
      ctx.beginPath(); ctx.ellipse(0, 0, r * (1.45 + i * 0.16), r * (0.3 + i * 0.035), 0, back ? Math.PI : 0, back ? TAU : Math.PI); ctx.stroke();
    });
    ctx.restore();
  }
  const BODY = {
    station(x, y, r) {
      ctx.save(); ctx.translate(x + Math.sin(st.t * 0.2) * 30, y); ctx.rotate(Math.sin(st.t * 0.15) * 0.08 - 0.12);
      // a ring station turning slowly, with two solar wings
      ctx.fillStyle = '#2c3570';
      for (const s of [-1, 1]) { ctx.fillRect(s * r - (s > 0 ? 0 : 70), -24, 70, 48); }
      ctx.strokeStyle = '#7fe8ff'; ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const px = s * r - (s > 0 ? 0 : 70) + i * 17.5; ctx.beginPath(); ctx.moveTo(px, -24); ctx.lineTo(px, 24); ctx.stroke(); }
      ctx.fillStyle = '#d9dcf0'; ctx.fillRect(-r, -3, r * 2, 6);
      ctx.strokeStyle = '#e8eaff'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.55 * 0.35, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -st.t * 20;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.55 * 0.35, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = st.t % 1.4 < 0.15 ? '#ff4a8a' : '#552244'; ctx.beginPath(); ctx.arc(r, 0, 3, 0, TAU); ctx.fill();
      ctx.restore();
    },
    moon(x, y, r) {
      halo(x, y, r, 'rgba(220,210,255,0.25)');
      poster(x, y, r, '#e9e4f2', null, '#ffffff', () => {
        ctx.fillStyle = '#c4bdd6';
        [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.42, 0.12], [0.4, -0.35, 0.1], [-0.52, 0.25, 0.08], [0.05, -0.55, 0.09]].forEach(c => {
          ctx.beginPath(); ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, TAU); ctx.fill();
        });
      });
      // a lander with a blinking light
      ctx.fillStyle = '#ffd36b'; ctx.fillRect(x - r * 0.35 - 10, y - r * 0.92 - 16, 20, 14);
      ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - r * 0.35 - 10, y - r * 0.92 - 2); ctx.lineTo(x - r * 0.35 - 16, y - r * 0.92 + 6); ctx.moveTo(x - r * 0.35 + 10, y - r * 0.92 - 2); ctx.lineTo(x - r * 0.35 + 16, y - r * 0.92 + 6); ctx.stroke();
      ctx.fillStyle = st.t % 1.2 < 0.2 ? '#ff4a8a' : '#663344'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.92 - 20, 3, 0, TAU); ctx.fill();
    },
    mars(x, y, r) {
      halo(x, y, r, 'rgba(255,110,70,0.3)');
      poster(x, y, r, '#e8643c', [[-0.15, 0.22, '#c94a2c', 6], [0.3, 0.14, '#f07a4a', 4]], '#ffb08a', () => {
        ctx.fillStyle = '#fff3ea'; ctx.beginPath(); ctx.ellipse(x, y - r * 0.92, r * 0.34, r * 0.12, 0, 0, TAU); ctx.fill();
      });
      const a1 = st.t * 0.5, a2 = st.t * 0.3 + 2;
      ctx.fillStyle = '#a38a7a'; ctx.beginPath(); ctx.arc(x + Math.cos(a1) * r * 1.5, y + Math.sin(a1) * r * 0.35, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b89c88'; ctx.beginPath(); ctx.arc(x + Math.cos(a2) * r * 1.9, y + Math.sin(a2) * r * 0.45, 7, 0, TAU); ctx.fill();
    },
    jupiter(x, y, r) {
      halo(x, y, r, 'rgba(255,180,110,0.25)');
      poster(x, y, r, '#f0cf9c', [[-0.85, 0.16, '#c98a52', 5], [-0.5, 0.12, '#e3b07a', 4], [-0.22, 0.16, '#b56f3e', 6], [0.1, 0.1, '#e8bb86', 5], [0.32, 0.18, '#c07a46', 6], [0.66, 0.12, '#dca474', 4]], '#ffe6c2', () => {
        ctx.fillStyle = '#d2482c'; ctx.beginPath(); ctx.ellipse(x - r * 0.25, y + r * 0.4, r * 0.2, r * 0.1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f08a62'; ctx.beginPath(); ctx.ellipse(x - r * 0.25, y + r * 0.4, r * 0.1, r * 0.045, 0, 0, TAU); ctx.fill();
      });
    },
    saturn(x, y, r) {
      halo(x, y, r, 'rgba(255,225,150,0.2)');
      ring(x, y, r, true, ['rgba(240,215,160,0.85)', 'rgba(200,170,120,0.7)', 'rgba(255,235,190,0.75)'], -0.25);
      poster(x, y, r, '#f2dca4', [[-0.6, 0.12, '#d8b678'], [-0.2, 0.1, '#e6c58c'], [0.2, 0.14, '#cfa968']], '#fff2cc');
      ring(x, y, r, false, ['rgba(240,215,160,0.9)', 'rgba(200,170,120,0.75)', 'rgba(255,235,190,0.8)'], -0.25);
    },
    uranus(x, y, r) {
      halo(x, y, r, 'rgba(120,240,255,0.25)');
      ring(x, y, r, true, ['rgba(190,245,255,0.5)'], 1.25, 0.5);
      poster(x, y, r, '#a6eff5', [[-0.3, 0.2, '#8fe2ea']], '#e6ffff');
      ring(x, y, r, false, ['rgba(190,245,255,0.6)'], 1.25, 0.5);
    },
    neptune(x, y, r) {
      halo(x, y, r, 'rgba(80,120,255,0.3)');
      poster(x, y, r, '#3d6ef0', [[-0.45, 0.14, '#5a86ff', 3], [0.2, 0.1, '#2f58d0', 3]], '#a8c4ff', () => {
        ctx.fillStyle = '#1e3ea8'; ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.1, r * 0.18, r * 0.09, 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x - r * 0.05, y - r * 0.24, r * 0.12, r * 0.025, 0.1, 0, TAU); ctx.fill();
      });
    },
    pluto(x, y, r) {
      halo(x, y, r, 'rgba(255,220,200,0.2)');
      poster(x, y, r, '#c9a88c', null, '#ffe6d2', () => {
        ctx.fillStyle = '#f2e2d2'; ctx.beginPath();
        ctx.moveTo(x - r * 0.1, y + r * 0.05);
        ctx.bezierCurveTo(x - r * 0.5, y - r * 0.45, x - r * 0.05, y - r * 0.65, x + r * 0.1, y - r * 0.2);
        ctx.bezierCurveTo(x + r * 0.25, y - r * 0.6, x + r * 0.7, y - r * 0.3, x + r * 0.1, y + r * 0.45);
        ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = '#9b8f88'; ctx.beginPath(); ctx.arc(x + Math.cos(st.t * 0.4) * r * 1.8, y + Math.sin(st.t * 0.4) * r * 0.4, r * 0.45, 0, TAU); ctx.fill();
    },
    nebula(x, y, r) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cols = ['rgba(255,80,170,0.16)', 'rgba(120,90,255,0.15)', 'rgba(255,170,90,0.12)', 'rgba(80,220,255,0.12)'];
      for (let i = 0; i < 11; i++) {
        const a = i * 1.7 + st.t * 0.03, d = (i % 4) * 0.18 + 0.1;
        const px = x + Math.cos(a) * r * d, py = y + Math.sin(a * 1.3) * r * d * 0.7, rr = r * (0.35 + (i % 3) * 0.12);
        const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
        g.addColorStop(0, cols[i % 4]); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
      }
      // filaments
      ctx.strokeStyle = 'rgba(255,150,220,0.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + 0.3;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * r * 0.5, y + Math.sin(a + 0.4) * r * 0.4, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 6 + Math.sin(st.t * 6) * 2, 0, TAU); ctx.fill();
      ctx.restore();
    },
    core(x, y, r) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,245,210,0.95)'); g.addColorStop(0.2, 'rgba(255,190,110,0.5)'); g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      for (let arm = 0; arm < 3; arm++) {
        ctx.fillStyle = 'rgba(255,220,170,0.5)';
        for (let i = 0; i < 70; i++) {
          const t = i / 70, a = arm * TAU / 3 + t * 5 + st.t * 0.05, d = t * r * 1.25;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.45, 1.5 + (1 - t) * 2.5, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    },
    edge(x, y, r) {
      // the edge: a shimmering wall of colour, cracked open with light
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const h = (st.t * 20 + i * 60) % 360;
        ctx.strokeStyle = `hsla(${h},90%,65%,0.35)`; ctx.lineWidth = 18 - i * 2;
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) {
          const px = -40 + (k / 40) * (W + 80);
          const py = y + Math.sin(k * 0.5 + st.t * (0.8 + i * 0.2) + i) * 24 + (i - 3) * 22;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
  };
  function drawBodies() {
    for (const m of STOPS) {
      if (!m.body) continue;
      const y = sy(m.alt, P_BODY) - (BASE - (m.by || 300)) ;
      const r = m.r;
      if (y - r * 2 > H || y + r * 2 < 0) continue;
      BODY[m.body](m.bx, y, r);
    }
    // The asteroid belt and the Oort cloud are scenery bands rather than bodies (see ZONES).
  }

  // ---- Decoration drawing ------------------------------------------------
  function drawObj(o, x, y) {
    ctx.save();
    switch (o.type) {
      case 'cloud': {
        // flat layered cloud bank, lit pink from below by the sunset
        const s = o.s;
        for (let i = 0; i < o.tiers; i++) {
          const w = o.w * s * (1 - i * 0.28), h = o.h * s, yy = y - i * h * 0.8;
          ctx.fillStyle = i === 0 ? 'rgba(255,150,190,0.55)' : 'rgba(255,210,225,0.6)';
          ctx.beginPath(); ctx.roundRect(x - w / 2 + i * 18, yy - h / 2, w, h, h / 2); ctx.fill();
        }
        break;
      }
      case 'wisp': {
        ctx.strokeStyle = 'rgba(200,170,255,0.25)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - o.w / 2, y + i * 10); ctx.quadraticCurveTo(x, y + i * 10 - 14, x + o.w / 2, y + i * 10); ctx.stroke(); }
        break;
      }
      case 'birds': {
        ctx.strokeStyle = '#2a1040'; ctx.lineWidth = 2.5;
        for (let i = 0; i < o.n; i++) {
          const bx = x + i * 26 * Math.sign(o.vx) * -1, by = y + Math.abs(i - o.n / 2) * 10, f = Math.sin(st.t * 8 + i) * 5;
          ctx.beginPath(); ctx.moveTo(bx - 9, by - f); ctx.quadraticCurveTo(bx - 4, by - 4, bx, by); ctx.quadraticCurveTo(bx + 4, by - 4, bx + 9, by - f); ctx.stroke();
        }
        break;
      }
      case 'jet': {
        const d = Math.sign(o.vx);
        const g = ctx.createLinearGradient(x, y, x - d * 420, y);
        g.addColorStop(0, 'rgba(255,240,255,0.6)'); g.addColorStop(1, 'rgba(255,240,255,0)');
        ctx.fillStyle = g; ctx.fillRect(Math.min(x, x - d * 420), y - 2, 420, 4);
        ctx.fillStyle = '#1e0e36';
        ctx.beginPath(); ctx.moveTo(x + d * 22 * o.s, y); ctx.lineTo(x - d * 18 * o.s, y - 5 * o.s); ctx.lineTo(x - d * 18 * o.s, y + 5 * o.s); ctx.fill();
        break;
      }
      case 'kite': {
        ctx.translate(x, y); ctx.rotate(Math.sin(st.t + o.seed) * 0.2);
        ctx.fillStyle = '#ff5fa2'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(16, 0); ctx.lineTo(0, 30); ctx.lineTo(-16, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(-20, 80, 10, 130); ctx.stroke();
        break;
      }
      case 'aurora': {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const g = ctx.createLinearGradient(0, y - 120, 0, y + 40);
          g.addColorStop(0, 'rgba(80,255,200,0)'); g.addColorStop(0.7, `rgba(${i ? 160 : 80},255,${i ? 255 : 200},0.18)`); g.addColorStop(1, 'rgba(80,255,200,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, y + 40);
          for (let k = 0; k <= W; k += 40) ctx.lineTo(k, y - 80 - Math.sin(k * 0.006 + st.t * 0.5 + i) * 40);
          ctx.lineTo(W, y + 40); ctx.fill();
        }
        break;
      }
      case 'sat': {
        ctx.translate(x, y); ctx.rotate(o.rot + st.t * 0.1);
        ctx.fillStyle = '#2c3570'; ctx.fillRect(-36, -8, 24, 16); ctx.fillRect(12, -8, 24, 16);
        ctx.fillStyle = '#e8eaff'; ctx.fillRect(-12, -10, 24, 20);
        ctx.fillStyle = '#ff7ad9'; ctx.fillRect(-12, -10, 24, 4);
        break;
      }
      case 'astro': {
        ctx.translate(x, y); ctx.rotate(st.t * 0.3 + o.seed);
        ctx.fillStyle = '#f4f2ff'; ctx.beginPath(); ctx.roundRect(-11, -14, 22, 28, 8); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -20, 11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8a5c'; ctx.beginPath(); ctx.arc(0, -20, 7, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#f4f2ff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(-22, 4); ctx.moveTo(11, -6); ctx.lineTo(22, -12); ctx.moveTo(-6, 14); ctx.lineTo(-8, 28); ctx.moveTo(6, 14); ctx.lineTo(10, 26); ctx.stroke();
        break;
      }
      case 'rock': case 'ice': case 'junk': {
        ctx.translate(x, y); ctx.rotate(o.rot + st.t * 0.2 * (o.seed % 2 ? 1 : -1));
        const base = o.type === 'ice' ? '#9fd8ff' : o.type === 'junk' ? '#8a86a8' : '#6b4f66';
        const lit = o.type === 'ice' ? '#e4f6ff' : o.type === 'junk' ? '#c9c6e0' : '#a77e95';
        ctx.fillStyle = base; ctx.beginPath();
        o.verts.forEach((v, i) => { const a = i / o.verts.length * TAU; const px = Math.cos(a) * o.r * v, py = Math.sin(a) * o.r * v; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.closePath(); ctx.fill();
        // flat lit facet on the upper left
        ctx.fillStyle = lit; ctx.beginPath();
        const n = o.verts.length;
        ctx.moveTo(0, 0);
        for (let i = Math.floor(n * 0.45); i <= Math.floor(n * 0.8); i++) { const a = i / n * TAU; ctx.lineTo(Math.cos(a) * o.r * o.verts[i % n], Math.sin(a) * o.r * o.verts[i % n]); }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'comet': {
        const d = Math.sign(o.vx);
        const g = ctx.createLinearGradient(x, y, x - d * 180, y - 40);
        g.addColorStop(0, 'rgba(160,240,255,0.8)'); g.addColorStop(1, 'rgba(160,240,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x - d * 180, y - 46); ctx.lineTo(x - d * 170, y - 30); ctx.lineTo(x, y + 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
        break;
      }
      case 'probe': {
        ctx.translate(x, y); ctx.rotate(o.rot);
        ctx.fillStyle = '#ffd36b'; ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = '#e8eaff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -16, 14, 0, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(40, 6); ctx.stroke();
        break;
      }
      case 'gas': {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, o.r);
        g.addColorStop(0, `hsla(${o.hue},90%,60%,0.16)`); g.addColorStop(1, `hsla(${o.hue},90%,60%,0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, o.r, 0, TAU); ctx.fill();
        break;
      }
      case 'cluster': {
        ctx.fillStyle = '#fff6e0';
        for (const s of o.stars) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(st.t * 2 + s.x); ctx.beginPath(); ctx.arc(x + s.x, y + s.y, s.r, 0, TAU); ctx.fill(); }
        break;
      }
      case 'galaxy': {
        ctx.translate(x, y); ctx.rotate(o.tilt + st.t * 0.02); ctx.scale(1, 0.4);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          ctx.strokeStyle = `hsla(${o.hue + i * 40},80%,70%,0.4)`; ctx.lineWidth = 5;
          ctx.beginPath();
          for (let k = 0; k < 40; k++) { const t = k / 40, a = i * Math.PI + t * 4.5, d = t * 70; k ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(0, 0); }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,230,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
        break;
      }
      case 'crystal': {
        ctx.translate(x, y); ctx.rotate(st.t * 0.4 + o.seed);
        ctx.fillStyle = `hsla(${o.hue},90%,70%,0.85)`;
        ctx.beginPath(); ctx.moveTo(0, -o.r); ctx.lineTo(o.r * 0.5, 0); ctx.lineTo(0, o.r); ctx.lineTo(-o.r * 0.5, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(0, -o.r); ctx.lineTo(o.r * 0.5, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        break;
      }
      case 'ufo': {
        ctx.translate(x, y + Math.sin(st.t * 2 + o.seed) * 6);
        ctx.fillStyle = 'rgba(160,255,220,0.5)'; ctx.beginPath(); ctx.arc(0, -8, 14, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#c9c6e0'; ctx.beginPath(); ctx.ellipse(0, 0, 32, 9, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 5; i++) { ctx.fillStyle = (Math.floor(st.t * 6) + i) % 5 ? '#ff7ad9' : '#ffffff'; ctx.beginPath(); ctx.arc(-22 + i * 11, 1, 2.5, 0, TAU); ctx.fill(); }
        break;
      }
    }
    ctx.restore();
  }
  function drawDecor() {
    const c0 = Math.floor((st.cam - 280) / CHUNK), c1 = Math.floor((st.cam + 480) / CHUNK);
    for (let ci = c0; ci <= c1; ci++) {
      if (ci < 0) continue;
      for (const o of chunk(ci)) {
        const y = sy(o.alt, o.p);
        if (y < -320 || y > H + 320) continue;
        const x = o.type === 'aurora' ? 0 : wrapX(o.x + o.vx * st.t, o.type === 'jet' ? 460 : 260);
        drawObj(o, x, y);
      }
    }
  }

  // ---- Rocket (Brain Rocket's own) ----------------------------------------
  const FLAMES = [['#ff6a00', '#ffd23f'], ['#ff3d00', '#ffe066'], ['#2f7bff', '#9fe6ff'], ['#b04dff', '#ff9cf5']];
  const flameSet = () => FLAMES[st.streak >= 8 ? 3 : st.streak >= 5 ? 2 : st.streak >= 3 ? 1 : 0];
  function rocketPose() {
    let x = RX, y = BASE, tilt = 0;
    if (!st.onPad) {
      x += Math.sin(st.t * 1.3) * 5;
      y += Math.sin(st.t * 2.1) * 7;
      tilt = Math.sin(st.t * 1.7) * 0.035 + (st.vel < -8 ? Math.sin(st.t * 9) * 0.06 : 0);
    } else if (st.ignite > 0) {
      x += (Math.random() - 0.5) * 3 * st.ignite;
    }
    y += st.dip;
    if (st.crash) {
      const c = st.crash, f = clamp(c.t / FLIP, 0, 1);
      tilt += (f * f * (3 - 2 * f)) * Math.PI;
      y += Math.pow(clamp(c.p, 0, 1), 3) * 34;
      x += (Math.random() - 0.5) * 4 * clamp(c.p * 2, 0, 1);
    }
    if (st.dead && !st.onPad) {
      tilt += Math.min(st.deadT * 0.9, 2.2);
      y += st.deadT * st.deadT * 60;
      x += st.deadT * 40;
    }
    return { x, y, tilt };
  }
  function nozzleOf(pose) {
    const c = { x: pose.x, y: pose.y - 95 };
    return { x: c.x - Math.sin(pose.tilt) * 95, y: c.y + Math.cos(pose.tilt) * 95, dx: -Math.sin(pose.tilt), dy: Math.cos(pose.tilt) };
  }
  function drawFlame(len, w) {
    const [outer, inner] = flameSet();
    const f = 1 + Math.sin(st.t * 40) * 0.08 + Math.sin(st.t * 23) * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const L = len * f;
    const gl = ctx.createRadialGradient(0, L * 0.3, 0, 0, L * 0.3, L * 0.9);
    gl.addColorStop(0, outer + '88'); gl.addColorStop(1, outer + '00');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, L * 0.3, L * 0.9, 0, TAU); ctx.fill();
    const layer = (ww, ll, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-ww, 0);
      ctx.quadraticCurveTo(-ww * 1.1, ll * 0.45, 0, ll);
      ctx.quadraticCurveTo(ww * 1.1, ll * 0.45, ww, 0);
      ctx.closePath(); ctx.fill();
    };
    layer(w, L, outer);
    layer(w * 0.65, L * 0.72, inner);
    layer(w * 0.3, L * 0.4, '#ffffff');
    ctx.restore();
  }
  function drawRocket() {
    if (st.crash && st.crash.boom) return;
    const pose = rocketPose();
    ctx.save();
    ctx.translate(pose.x, pose.y - 95);
    ctx.rotate(pose.tilt);
    ctx.translate(0, 95);
    if (st.thrust > 0.02) {
      const sput = st.sputter > 0 && Math.random() < 0.5 ? 0.2 : 1;
      drawFlame((30 + st.thrust * 150) * sput, 15 + st.thrust * 8);
    }
    const fin = (d) => {
      ctx.fillStyle = '#e8364f';
      ctx.beginPath(); ctx.moveTo(d * 32, -70); ctx.lineTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 30, -16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8243b';
      ctx.beginPath(); ctx.moveTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 56, 2); ctx.closePath(); ctx.fill();
    };
    fin(-1); fin(1);
    const ng = ctx.createLinearGradient(-26, 0, 26, 0);
    ng.addColorStop(0, '#4a5060'); ng.addColorStop(0.5, '#9aa2b4'); ng.addColorStop(1, '#3e4352');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(18, -18); ctx.lineTo(25, 0); ctx.lineTo(-25, 0); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-31, -16);
    ctx.lineTo(-35, -110);
    ctx.quadraticCurveTo(-35, -165, 0, -200);
    ctx.quadraticCurveTo(35, -165, 35, -110);
    ctx.lineTo(31, -16);
    ctx.closePath();
    const bg = ctx.createLinearGradient(-35, 0, 35, 0);
    bg.addColorStop(0, '#b9c1d4'); bg.addColorStop(0.35, '#ffffff'); bg.addColorStop(1, '#a7b0c4');
    ctx.fillStyle = bg; ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#e8364f'; ctx.fillRect(-40, -210, 80, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-20, -210, 10, 62);
    ctx.fillStyle = '#e8364f'; ctx.fillRect(-40, -46, 80, 10);
    ctx.fillStyle = '#2a3350'; ctx.fillRect(-40, -34, 80, 4);
    ctx.restore();
    ctx.fillStyle = '#7b8499'; ctx.beginPath(); ctx.arc(0, -105, 19, 0, TAU); ctx.fill();
    const wg = ctx.createRadialGradient(-5, -110, 2, 0, -105, 15);
    wg.addColorStop(0, '#7fd3ff'); wg.addColorStop(1, '#173a8a');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, -105, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd7a8'; ctx.beginPath(); ctx.arc(0, -101, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-2.3, -102, 1.1, 0, TAU); ctx.arc(2.3, -102, 1.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (st.dead || st.sputter > 0 || st.crash) ctx.arc(0, -96.5, 2, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(0, -100.5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-6, -112, 4, 2.5, -0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c62a42'; ctx.fillRect(-4, -60, 8, 66);
    ctx.fillStyle = 'rgba(80,90,110,0.5)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-22 + i * 11, -24, 1.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---- Particles ----------------------------------------------------------
  function emit(dt) {
    const pose = rocketPose(), nz = nozzleOf(pose), fs = flameSet();
    const inAir = st.cam < 520;
    if (st.thrust > 0.05 && !(st.sputter > 0 && Math.random() < 0.5)) {
      st.emitF += st.thrust * 130 * dt;
      while (st.emitF >= 1) {
        st.emitF--;
        parts.push({ k: 'flame', x: nz.x + rand(-8, 8), y: nz.y + rand(0, 10), vx: nz.dx * 260 + rand(-40, 40), vy: nz.dy * (220 + st.thrust * 260) + rand(-20, 20), life: rand(0.25, 0.55), max: 0.55, size: rand(8, 16) * (0.7 + st.thrust * 0.5), color: Math.random() < 0.5 ? fs[0] : fs[1] });
        if (st.streak >= 8 && Math.random() < 0.4) parts.push({ k: 'spark', x: nz.x, y: nz.y + 10, vx: rand(-120, 120), vy: rand(150, 380), life: 0.8, max: 0.8, size: 3, color: `hsl(${Math.random() * 360},100%,65%)` });
      }
    }
    if (inAir && (st.thrust > 0.1 || st.ignite > 0)) {
      st.emitS += ((st.onPad ? 0 : st.thrust * 26) + st.ignite * 40) * dt;
      while (st.emitS >= 1) {
        st.emitS--;
        const pad = st.onPad;
        parts.push({ k: 'smoke', x: nz.x + rand(-15, 15), y: nz.y + (pad ? 30 : 20), vx: pad ? rand(-320, 320) : rand(-50, 50), vy: pad ? rand(-40, 10) : rand(60, 160), life: rand(1.6, 2.6), max: 2.6, size: rand(18, 30), grow: rand(30, 60), color: '#ffe2f2' });
      }
    }
    if (st.crash && st.crash.boom && st.crash.since < 2.5 && Math.random() < dt * 30) parts.push({ k: 'smoke', x: RX + rand(-30, 30), y: BASE + 30, vx: rand(-25, 25), vy: rand(-180, -90), life: 2.4, max: 2.4, size: rand(16, 26), grow: 50, color: '#2c2a30' });
    if (st.dead && Math.random() < dt * 20) parts.push({ k: 'smoke', x: nz.x, y: nz.y, vx: rand(-30, 30), vy: rand(-80, -20), life: 1.8, max: 1.8, size: 14, grow: 40, color: '#3a3a44' });
  }
  function updateParts(dt, dy) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt + dy;
      if (p.k === 'smoke') { p.vx *= 0.97; p.vy *= 0.97; p.size += p.grow * dt; }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.k === 'confetti') { f.vy += 260 * dt; f.vx *= 0.99; f.rot += f.vr * dt; }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      l.y += dy * 1.8 + 300 * dt; l.life -= dt;
      if (l.life <= 0 || l.y - l.len > H) lines.splice(i, 1);
    }
  }
  function drawParts(kind) {
    for (const p of parts) {
      if (p.k !== kind) continue;
      const a = p.life / p.max;
      if (kind === 'smoke') {
        ctx.globalAlpha = a * 0.45 * (p.color === '#ffe2f2' ? clamp(1 - st.cam / 550, 0.1, 1) : 1);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (kind === 'flame' ? a : 1), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawFx() {
    for (const f of fx) {
      if (f.k === 'confetti') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.globalAlpha = clamp(f.life, 0, 1);
        ctx.fillStyle = f.color; ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h * Math.abs(Math.cos(f.rot * 2)));
        ctx.restore();
      } else if (f.k === 'shoot') {
        const a = clamp(f.life / 0.4, 0, 1);
        const g = ctx.createLinearGradient(f.x, f.y, f.x - f.vx * 0.15, f.y - f.vy * 0.15);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.15, f.y - f.vy * 0.15); ctx.stroke();
      } else if (f.k === 'ring') {
        const a = f.life / f.max;
        ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = 6 * a;
        ctx.beginPath(); ctx.arc(f.x, f.y, (1 - a) * f.r + 10, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawLines() {
    if (!lines.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of lines) {
      const g = ctx.createLinearGradient(0, l.y - l.len, 0, l.y);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${l.a})`);
      ctx.fillStyle = g; ctx.fillRect(l.x, l.y - l.len, l.w, l.len);
    }
    ctx.restore();
  }

  // ---- Crash (a rude word): flip nose-down, dive into the pad, boom ---------
  const FLIP = 0.8;
  function updateCrash(dt) {
    const c = st.crash;
    c.t += dt;
    if (c.boom) { c.since += dt; return; }
    if (c.t < FLIP) { st.cam = c.from + c.hop * Math.sin((c.t / FLIP) * Math.PI / 2); return; }
    c.p = Math.min(1, (c.t - FLIP) / c.dur);
    st.cam = c.top * (1 - Math.pow(c.p, 3));
    if (c.p >= 1) boom();
  }
  function boom() {
    const c = st.crash;
    c.boom = true; c.since = 0;
    st.cam = 0; st.thrust = 0; st.flash = 1; st.shake = 1.6;
    const x = RX, y = BASE + 20, fire = ['#ff3d00', '#ff8a00', '#ffd23f', '#ffffff'];
    for (let i = 0; i < 140; i++) { const a = rand(Math.PI, TAU), sp = rand(80, 620); parts.push({ k: 'flame', x: x + rand(-20, 20), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.9, life: rand(0.5, 1.2), max: 1.2, size: rand(16, 40), color: fire[i % fire.length] }); }
    for (let i = 0; i < 70; i++) { const a = rand(Math.PI * 1.05, Math.PI * 1.95), sp = rand(200, 700); parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.6, 1.3), max: 1.3, size: rand(2, 5), color: Math.random() < 0.5 ? '#ffd23f' : '#ff6a00' }); }
    for (let i = 0; i < 40; i++) parts.push({ k: 'smoke', x: x + rand(-80, 80), y: y - rand(0, 60), vx: rand(-160, 160), vy: rand(-160, -30), life: rand(1.8, 3), max: 3, size: rand(24, 44), grow: rand(40, 80), color: '#33303a' });
    fx.push({ k: 'ring', x, y, r: 520, life: 0.7, max: 0.7, color: '#ffd23f' });
    fx.push({ k: 'ring', x, y, r: 300, life: 0.5, max: 0.5, color: '#ffffff' });
  }

  // ---- Main update / draw ------------------------------------------------
  function update(dt) {
    st.t += dt;
    const prev = st.cam;
    if (st.crash) updateCrash(dt);
    else if (!st.dead) {
      st.cam += (st.target - st.cam) * (1 - Math.exp(-dt * 2.1));
      if (Math.abs(st.target - st.cam) < 0.02) st.cam = st.target;
    }
    const dy = (st.cam - prev) * K;
    st.vel = dt > 0 ? dy / dt : 0;
    if (st.cam > 0.3) st.onPad = false;
    st.armAngle += ((st.onPad && st.ignite <= 0 ? 0 : 1.3) - st.armAngle) * Math.min(1, dt * 3);
    st.kick = Math.max(0, st.kick - dt * 1.2);
    const falling = st.vel < -8;
    const want = st.crash ? (st.crash.boom ? 0 : st.crash.t < FLIP * 0.6 ? 0.15 : 1.5) : st.dead ? 0 : falling ? 0.1 + Math.random() * 0.1 : (st.onPad ? st.ignite * 0.45 : 0.32) + clamp(st.vel / 650, 0, 1.3) + st.kick * 0.6;
    st.thrust += (want - st.thrust) * Math.min(1, dt * 8);
    if (st.sputter > 0) st.sputter -= dt;
    if (st.dead) st.deadT += dt;
    st.dipV += (-st.dip * 30 - st.dipV * 6) * dt;
    st.dip += st.dipV * dt;
    st.shake = Math.max(0, st.shake - dt * 2.5);
    st.flash = Math.max(0, st.flash - dt * 2);
    emit(dt);
    updateParts(dt, dy);
    const lineV = Math.max(Math.abs(st.vel), st.kick * 900);
    if (lineV > 250) {
      const n = Math.min(6, lineV / 300);
      for (let i = 0; i < n; i++) if (Math.random() < 0.5) lines.push({ x: rand(0, W), y: rand(-200, H), len: 80 + lineV * 0.12, w: rand(1, 3), a: clamp(lineV / 2500, 0.08, 0.5), life: 0.6 });
    }
    if (clamp((st.cam - 300) / 320, 0, 1) > 0.6 && Math.random() < dt * 0.5) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      fx.push({ k: 'shoot', x: rand(200, W - 200), y: rand(20, 400), vx: dir * rand(600, 900), vy: rand(250, 450), life: 0.9 });
    }
    if (onStop) for (const m of STOPS) if (m.alt > 0 && prev < m.alt && st.cam >= m.alt) onStop(m);
  }
  function draw() {
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    const shx = st.shake ? (Math.random() - 0.5) * st.shake * 16 : 0;
    const shy = st.shake ? (Math.random() - 0.5) * st.shake * 16 : 0;
    ctx.translate(shx, shy);
    const [top, bot] = skyAt(st.cam);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
    drawStars(clamp((st.cam - 60) / 360, 0, 1) * (0.35 + 0.65 * clamp((st.cam - 250) / 300, 0, 1)));
    drawSunset();
    drawBodies();
    drawHomeworld();
    drawDecor();
    drawGround();
    drawParts('smoke');
    drawLines();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawParts('flame'); ctx.restore();
    drawRocket();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawParts('spark'); ctx.restore();
    drawFx();
    if (st.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${st.flash * 0.5})`; ctx.fillRect(-30, -30, W + 60, H + 60); }
  }

  // ---- Public API -----------------------------------------------------------
  // score -> altitude, in straight lines between the stops and on past the last one
  function altFor(score) {
    for (let i = 1; i < STOPS.length; i++) {
      const a = STOPS[i - 1], b = STOPS[i];
      if (score <= b.pts) return a.alt + (b.alt - a.alt) * (score - a.pts) / (b.pts - a.pts);
    }
    const a = STOPS[STOPS.length - 2], b = STOPS[STOPS.length - 1];
    return b.alt + (score - b.pts) * (b.alt - a.alt) / (b.pts - a.pts);
  }
  return {
    W, H, RX, BASE, altFor,
    init(c) { canvas = c; ctx = c.getContext('2d'); },
    resize(stageScale) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pxScale = stageScale * dpr;
      canvas.width = Math.round(W * pxScale);
      canvas.height = Math.round(H * pxScale);
    },
    update, draw,
    reset() {
      st.cam = 0; st.target = 0; st.onPad = true; st.ignite = 0; st.dead = false; st.deadT = 0; st.crash = null;
      st.thrust = 0; st.streak = 0; st.dip = 0; st.dipV = 0; st.sputter = 0;
      parts.length = 0; fx.length = 0; lines.length = 0;
    },
    get alt() { return st.cam; },
    // jump straight to an altitude (for the title screen's slow drift and for tests)
    set alt(v) { st.cam = st.target = v; st.onPad = v <= 0.3; },
    setIgnite(v) { st.ignite = v; if (v) st.shake = Math.max(st.shake, 0.2); },
    setStreak(n) { st.streak = n; },
    setTarget(alt) { st.target = alt; },
    boostTo(alt, power) {
      st.target = alt; st.ignite = 0;
      st.kick = Math.min(1.2, 0.5 + power * 0.15);
      st.shake = Math.max(st.shake, 0.25 + power * 0.12);
      if (power >= 4) st.flash = 0.6;
      const nz = nozzleOf(rocketPose());
      fx.push({ k: 'ring', x: nz.x, y: nz.y, r: 120 + power * 40, life: 0.6, max: 0.6, color: flameSet()[1] });
    },
    sputter() { st.sputter = 0.9; st.shake = 0.6; st.dipV = 260; },
    die() { st.dead = true; st.deadT = 0; st.shake = 0.8; },
    crash() {
      const hop = Math.max(0, 70 - st.cam), top = st.cam + hop;
      const dur = 0.9 + Math.min(1.5, Math.log10(1 + top) * 0.4);
      st.crash = { t: 0, p: 0, from: st.cam, hop, top, dur, boom: false, since: 0 };
      st.onPad = false; st.ignite = 0; st.sputter = 0; st.dip = 0; st.dipV = 0;
      st.shake = Math.max(st.shake, 0.4);
    },
    get crashDone() { return !!(st.crash && st.crash.boom && st.crash.since > 1.8); },
    get crashBoom() { return !!(st.crash && st.crash.boom); },
    confetti(n = 160) {
      const cols = ['#ff5d9e', '#ffd23f', '#4fd1ff', '#7ddc6f', '#b04dff', '#ff9a3c'];
      for (let i = 0; i < n; i++) fx.push({ k: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-80, 80), vy: rand(80, 300), rot: rand(0, TAU), vr: rand(-8, 8), w: rand(8, 14), h: rand(10, 18), life: rand(2.5, 4), color: cols[i % cols.length] });
    },
    burst(x, y, color, n = 30) {
      for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(120, 420); parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.4, 0.9), max: 0.9, size: rand(2, 4), color }); }
    },
    rocketScreen() { const p = rocketPose(); return { x: p.x, y: p.y - 100 }; },
    onStop(fn) { onStop = fn; }
  };
})();
