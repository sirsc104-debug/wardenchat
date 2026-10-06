/* Brain Rocket — the animated world behind the quiz (one 1600×900 canvas). */
'use strict';

const Scene = (function () {
  const W = 1600, H = 900;
  const K = 3;            // screen pixels per point of altitude
  const P_BODY = 0.6;     // parallax for planets
  const RX = 560;         // rocket x
  const BASE = 700;       // rocket nozzle y while on the pad / cruising
  const TAU = Math.PI * 2;

  let canvas, ctx, pxScale = 1;
  const st = {
    cam: 0, target: 0, vel: 0, t: 0, thrust: 0, onPad: true, ignite: 0,
    dead: false, deadT: 0, shake: 0, sputter: 0, dip: 0, dipV: 0, streak: 0,
    emitF: 0, emitS: 0, kick: 0, armAngle: 0, flash: 0
  };
  const parts = [];   // flame, smoke, sparks (world-anchored)
  const fx = [];      // screen-space: confetti, shooting stars, rings
  const lines = [];   // speed lines
  let onMilestone = null;

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

  // ---- Sky colours by altitude -----------------------------------------
  const SKY = [
    [0,     '#5fb4ff', '#d4f0ff'],
    [120,   '#3a8be6', '#a2d8ff'],
    [300,   '#1d4ea8', '#4d86d6'],
    [420,   '#0c1c55', '#1f3a86'],
    [540,   '#050a24', '#0b1640'],
    [900,   '#03040f', '#080b22'],
    [1500,  '#14060b', '#200a12'],
    [2300,  '#0b0907', '#17110b'],
    [3600,  '#140d05', '#22160a'],
    [5000,  '#100c06', '#1b1409'],
    [6600,  '#03111a', '#072232'],
    [8200,  '#020a1e', '#071838'],
    [10000, '#09080e', '#14111b'],
    [12500, '#060912', '#0c1424'],
    [15500, '#22073a', '#3a0d4a'],
    [19500, '#241503', '#3a2407'],
    [24500, '#0b0526', '#1c0c44'],
    [31000, '#030008', '#0a0420']
  ];
  function skyAt(a) {
    if (a >= SKY[SKY.length - 1][0]) {
      const h = (a * 0.01 + st.t * 6) % 360;
      return [`hsl(${h},55%,7%)`, `hsl(${(h + 50) % 360},60%,14%)`];
    }
    let i = 0;
    while (i < SKY.length - 2 && a > SKY[i + 1][0]) i++;
    const s0 = SKY[i], s1 = SKY[i + 1];
    const t = clamp((a - s0[0]) / (s1[0] - s0[0]), 0, 1);
    return [mix(s0[1], s1[1], t), mix(s0[2], s1[2], t)];
  }

  // ---- Decoration zones ------------------------------------------------
  const ZONES = [
    { to: 330,      d: 1.5, types: { cloud: 6, birds: 2.2, balloon: 1.2, plane: 1, blimp: 0.4, glider: 0.6 } },
    { to: 470,      d: 1.1, types: { wisp: 2, jet: 1, wballoon: 1.2, aurora: 0.7 } },
    { to: 1000,     d: 1.0, types: { sat: 3, junk: 1.5, astro: 0.8, cow: 0.35, asteroid: 0.5 } },
    { to: 2300,     d: 1.1, types: { asteroid: 2, comet: 0.8, ufo: 0.45, sat: 0.3, astro: 0.3, duck: 0.15 } },
    { to: 3300,     d: 3.4, types: { asteroid: 9, comet: 0.3, ufo: 0.2 } },
    { to: 10000,    d: 0.9, types: { ice: 2, comet: 1, probe: 0.4, ufo: 0.4, asteroid: 0.6 } },
    { to: 14000,    d: 1.0, types: { ice: 3, comet: 1, probe: 0.3 } },
    { to: 19000,    d: 1.7, types: { gas: 4, jelly: 1.2, cluster: 1 } },
    { to: 27000,    d: 1.4, types: { cluster: 2, galaxy: 1.2, whale: 0.5, gas: 1 } },
    { to: Infinity, d: 1.6, types: { whale: 1, ring: 0.8, crystal: 1, galaxy: 1, duck: 0.3, jelly: 0.6, gas: 1 } }
  ];
  const zoneAt = a => ZONES.find(z => a < z.to);

  const CHUNK = 100;
  const chunkCache = new Map();
  function chunk(ci) {
    if (chunkCache.has(ci)) return chunkCache.get(ci);
    if (chunkCache.size > 260) chunkCache.clear();
    const rng = mulberry32(ci * 7919 + 13);
    const zone = zoneAt(ci * CHUNK + 50);
    const out = [];
    const n = Math.floor(zone.d + rng() * 1.2);
    const pairs = Object.entries(zone.types);
    const total = pairs.reduce((s, p) => s + p[1], 0);
    for (let i = 0; i < n; i++) {
      const alt = ci * CHUNK + rng() * CHUNK;
      if (alt < 40) continue;
      let r = rng() * total, type = pairs[0][0];
      for (const [t, w] of pairs) { if ((r -= w) <= 0) { type = t; break; } }
      out.push(makeObj(type, alt, rng));
    }
    chunkCache.set(ci, out);
    return out;
  }

  function makeObj(type, alt, rng) {
    const o = {
      type, alt, x: rng() * W, s: 0.7 + rng() * 0.6, p: 1, seed: rng() * 1000,
      vx: (rng() < 0.5 ? -1 : 1) * (5 + rng() * 15), hue: Math.floor(rng() * 360), rot: (rng() - 0.5) * 0.8
    };
    switch (type) {
      case 'cloud':
        o.p = 0.75 + rng() * 0.5; o.s = 0.7 + rng() * 0.9; o.vx = 6 + rng() * 10;
        o.puffs = Array.from({ length: 5 + Math.floor(rng() * 4) }, (_, i) => ({ dx: (i - 3) * 34 + rng() * 20, dy: -rng() * 30, r: 28 + rng() * 26 }));
        break;
      case 'wisp': o.p = 0.85; o.vx = 10 + rng() * 10; break;
      case 'birds': o.vx = (rng() < 0.5 ? -1 : 1) * (50 + rng() * 40); o.n = 3 + Math.floor(rng() * 4); break;
      case 'plane': o.vx = (rng() < 0.5 ? -1 : 1) * (110 + rng() * 60); break;
      case 'jet': o.vx = (rng() < 0.5 ? -1 : 1) * (240 + rng() * 120); o.s = 0.6 + rng() * 0.3; break;
      case 'blimp': o.vx = (rng() < 0.5 ? -1 : 1) * 18; break;
      case 'glider': o.vx = (rng() < 0.5 ? -1 : 1) * 25; break;
      case 'balloon': o.vx = 8 + rng() * 10; break;
      case 'aurora': o.p = 0.7; o.vx = 0; break;
      case 'asteroid': case 'ice': case 'junk':
        o.verts = Array.from({ length: 9 + Math.floor(rng() * 4) }, () => 0.72 + rng() * 0.4);
        o.r = type === 'junk' ? 8 + rng() * 6 : 14 + rng() * 34;
        o.vx = (rng() - 0.5) * 30;
        o.craters = Array.from({ length: 3 }, () => ({ x: (rng() - 0.5) * 0.9, y: (rng() - 0.5) * 0.9, r: 0.12 + rng() * 0.15 }));
        break;
      case 'comet': o.vx = (rng() < 0.5 ? -1 : 1) * (60 + rng() * 60); break;
      case 'gas': o.p = 0.7 + rng() * 0.3; o.r = 140 + rng() * 180; o.vx = (rng() - 0.5) * 8; o.hue = [300, 330, 200, 270, 180, 20][Math.floor(rng() * 6)]; break;
      case 'cluster': o.p = 0.8; o.vx = (rng() - 0.5) * 4; o.stars = Array.from({ length: 16 }, () => ({ x: (rng() + rng() - 1) * 70, y: (rng() + rng() - 1) * 70, r: 0.8 + rng() * 2 })); break;
      case 'galaxy': o.p = 0.75; o.vx = (rng() - 0.5) * 4; o.tilt = rng() * Math.PI; break;
      case 'whale': o.vx = (rng() < 0.5 ? -1 : 1) * (25 + rng() * 15); o.s = 0.8 + rng() * 0.6; break;
      case 'ufo': o.vx = (rng() < 0.5 ? -1 : 1) * (40 + rng() * 80); break;
    }
    return o;
  }

  // ---- Stars ------------------------------------------------------------
  const STAR_LAYERS = [
    { p: 0.04, n: 110, r: [0.5, 1.2] },
    { p: 0.12, n: 55,  r: [0.8, 1.8] },
    { p: 0.3,  n: 22,  r: [1.4, 2.6] }
  ];
  const starTiles = new Map();
  function starTile(layer, i) {
    const id = layer * 100000 + i;
    if (starTiles.has(id)) return starTiles.get(id);
    if (starTiles.size > 60) starTiles.clear();
    const L = STAR_LAYERS[layer], rng = mulberry32(id * 31 + 7);
    const stars = Array.from({ length: L.n }, () => ({
      x: rng() * W, y: rng() * H, r: lerp(L.r[0], L.r[1], rng()), ph: rng() * TAU, sp: 1 + rng() * 3,
      c: ['#ffffff', '#cfe3ff', '#fff2c9', '#ffd6e8'][Math.floor(rng() * 4)]
    }));
    starTiles.set(id, stars);
    return stars;
  }
  function drawStars(alpha) {
    if (alpha <= 0) return;
    for (let li = 0; li < STAR_LAYERS.length; li++) {
      const L = STAR_LAYERS[li];
      const s = st.cam * K * L.p;
      const i0 = Math.floor((s + BASE - H) / H), i1 = Math.floor((s + BASE) / H);
      for (let i = i0; i <= i1; i++) {
        for (const star of starTile(li, i)) {
          const y = BASE - (i * H + star.y - s);
          if (y < -5 || y > H + 5) continue;
          const tw = 0.55 + 0.45 * Math.sin(st.t * star.sp + star.ph);
          ctx.globalAlpha = alpha * tw;
          ctx.fillStyle = star.c;
          ctx.beginPath(); ctx.arc(star.x, y, star.r, 0, TAU); ctx.fill();
          if (li === 2 && star.r > 2.2) {
            ctx.globalAlpha = alpha * tw * 0.5;
            ctx.fillRect(star.x - star.r * 3, y - 0.5, star.r * 6, 1);
            ctx.fillRect(star.x - 0.5, y - star.r * 3, 1, star.r * 6);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Ground -----------------------------------------------------------
  const groundRng = mulberry32(42);
  const CITY = Array.from({ length: 34 }, (_, i) => ({ x: i * 50 + groundRng() * 20 - 40, w: 34 + groundRng() * 30, h: 50 + groundRng() * 130, lit: groundRng() }));
  const TREES = [70, 150, 215, 320, 400, 880, 960, 1040, 1180, 1460, 1540].map(x => ({ x, s: 0.8 + groundRng() * 0.5, c: groundRng() }));

  function drawGround() {
    const gy = BASE + 40 + st.cam * K;
    if (gy - 420 > H) return;
    // far mountains
    const my = BASE - 40 + st.cam * K * 0.35;
    if (my - 260 < H) {
      ctx.fillStyle = '#8fa6d8';
      ctx.beginPath(); ctx.moveTo(-20, H + 2000);
      for (let x = -20; x <= W + 40; x += 40) ctx.lineTo(x, my - 120 - 90 * Math.abs(Math.sin(x * 0.004 + 1)) - 40 * Math.sin(x * 0.013));
      ctx.lineTo(W + 40, H + 2000); ctx.fill();
      ctx.fillStyle = '#eef4ff';
      for (let x = 60; x < W; x += 260) {
        const top = my - 120 - 90 * Math.abs(Math.sin(x * 0.004 + 1)) - 40 * Math.sin(x * 0.013);
        ctx.beginPath(); ctx.moveTo(x - 30, top + 26); ctx.lineTo(x, top - 2); ctx.lineTo(x + 30, top + 26); ctx.fill();
      }
    }
    // city
    const cy = BASE + 10 + st.cam * K * 0.55;
    if (cy - 200 < H) {
      for (const b of CITY) {
        ctx.fillStyle = '#5d6fa6';
        ctx.fillRect(b.x, cy - b.h, b.w, b.h + 1200);
        ctx.fillStyle = 'rgba(255,233,150,0.75)';
        for (let wy = cy - b.h + 10; wy < cy - 8; wy += 16) {
          for (let wx = b.x + 6; wx < b.x + b.w - 8; wx += 10) {
            if (((wx * 13 + wy * 7) % 10) / 10 < b.lit * 0.6) ctx.fillRect(wx, wy, 4, 6);
          }
        }
      }
    }
    // near hills
    const hy = BASE + 22 + st.cam * K * 0.8;
    ctx.fillStyle = '#66c35f';
    ctx.beginPath(); ctx.moveTo(-20, H + 2000);
    for (let x = -20; x <= W + 40; x += 30) ctx.lineTo(x, hy - 30 - 26 * Math.sin(x * 0.006 + 2) - 12 * Math.sin(x * 0.017));
    ctx.lineTo(W + 40, H + 2000); ctx.fill();
    // ground
    ctx.fillStyle = '#4caf50'; ctx.fillRect(-20, gy, W + 40, 30);
    ctx.fillStyle = '#3d8f42'; ctx.fillRect(-20, gy + 30, W + 40, 18);
    ctx.fillStyle = '#7a5537'; ctx.fillRect(-20, gy + 48, W + 40, 1600);
    // trees
    for (const tr of TREES) {
      const sw = Math.sin(st.t * 1.5 + tr.x) * 2;
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(tr.x - 5 * tr.s, gy - 40 * tr.s, 10 * tr.s, 42 * tr.s);
      ctx.fillStyle = tr.c > 0.5 ? '#2e8b3e' : '#3a9d4a';
      ctx.beginPath();
      ctx.arc(tr.x + sw, gy - 58 * tr.s, 26 * tr.s, 0, TAU);
      ctx.arc(tr.x - 16 * tr.s + sw, gy - 42 * tr.s, 18 * tr.s, 0, TAU);
      ctx.arc(tr.x + 16 * tr.s + sw, gy - 42 * tr.s, 18 * tr.s, 0, TAU);
      ctx.fill();
    }
    // mission control
    const mx = 1250;
    ctx.fillStyle = '#e8ecf5'; ctx.fillRect(mx, gy - 90, 170, 90);
    ctx.fillStyle = '#c3cadb'; ctx.fillRect(mx, gy - 96, 170, 8);
    ctx.fillStyle = '#4fa3ff';
    for (let i = 0; i < 5; i++) ctx.fillRect(mx + 14 + i * 31, gy - 70, 20, 22);
    ctx.save(); ctx.translate(mx + 140, gy - 96);
    ctx.fillStyle = '#9aa3b8'; ctx.fillRect(-3, -40, 6, 40);
    ctx.rotate(Math.sin(st.t * 0.6) * 0.6 - 0.4);
    ctx.fillStyle = '#f4f6fb'; ctx.beginPath(); ctx.ellipse(0, -44, 30, 12, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
    // launch pad
    ctx.fillStyle = '#8c94a6'; ctx.fillRect(RX - 120, gy - 40, 240, 40);
    ctx.fillStyle = '#6e7586'; ctx.fillRect(RX - 120, gy - 40, 240, 8);
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(RX - 34, gy - 32, 68, 32);
    ctx.fillStyle = '#f2c94c';
    for (let i = 0; i < 6; i++) ctx.fillRect(RX - 116 + i * 40, gy - 8, 20, 6);
    // tower
    const tx = RX + 105, top = gy - 300;
    ctx.strokeStyle = '#d9534f'; ctx.lineWidth = 4;
    ctx.strokeRect(tx - 18, top, 36, gy - 40 - top);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = top; y < gy - 50; y += 30) { ctx.moveTo(tx - 18, y); ctx.lineTo(tx + 18, y + 30); ctx.moveTo(tx + 18, y); ctx.lineTo(tx - 18, y + 30); }
    ctx.stroke();
    ctx.save(); ctx.translate(tx - 18, top + 70); ctx.rotate(-st.armAngle);
    ctx.fillStyle = '#b8bfcc'; ctx.fillRect(-58, -6, 58, 12);
    ctx.restore();
    ctx.fillStyle = '#ff4040';
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(st.t * 4);
    ctx.beginPath(); ctx.arc(tx, top - 6, 6, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // flags
    for (const fx0 of [RX - 200, RX + 200]) {
      ctx.fillStyle = '#ddd'; ctx.fillRect(fx0, gy - 110, 4, 110);
      ctx.fillStyle = fx0 < RX ? '#ff5d73' : '#4fa3ff';
      ctx.beginPath(); ctx.moveTo(fx0 + 4, gy - 110);
      for (let i = 0; i <= 8; i++) ctx.lineTo(fx0 + 4 + i * 6, gy - 110 + Math.sin(st.t * 6 + i * 0.8) * 3);
      for (let i = 8; i >= 0; i--) ctx.lineTo(fx0 + 4 + i * 6, gy - 84 + Math.sin(st.t * 6 + i * 0.8) * 3);
      ctx.fill();
    }
  }

  // ---- Earth seen from orbit ------------------------------------------
  function drawEarth() {
    const e = clamp((st.cam - 280) / (1150 - 280), 0, 1);
    if (e <= 0 || e >= 1) return;
    const ee = e * e * (3 - 2 * e);
    const R = lerp(2600, 70, Math.sqrt(ee));
    const topY = lerp(H - 150, H + 10, ee);
    const cx = lerp(W * 0.4, RX, ee), cy = topY + R;
    const glow = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.08);
    glow.addColorStop(0, 'rgba(120,200,255,0.65)'); glow.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    g.addColorStop(0, '#3fa0ff'); g.addColorStop(1, '#0b3a8a');
    ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = '#4caf62';
    const spin = st.t * 0.02;
    for (let i = 0; i < 7; i++) {
      const a = spin + i * 0.9;
      const px = cx + Math.cos(a) * R * 0.75, py = cy - R * 0.55 + Math.sin(i * 2.1) * R * 0.35;
      ctx.beginPath(); ctx.ellipse(px, py, R * 0.22, R * 0.12, i, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 9; i++) {
      const a = spin * 1.6 + i * 0.7;
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * R * 0.85, cy - R * 0.7 + Math.sin(i) * R * 0.2, R * 0.12, R * 0.03, 0.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---- Sun --------------------------------------------------------------
  function drawSun() {
    const r = 55 / (1 + st.cam / 1500);
    const a = st.cam > 12000 ? clamp(1 - (st.cam - 12000) / 3000, 0, 1) : 1;
    if (a <= 0) return;
    const x = 880, y = 110;
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, 'rgba(255,250,210,0.9)'); g.addColorStop(0.25, 'rgba(255,220,120,0.45)'); g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- Planets and other big things ---------------------------------
  function sphere(x, y, r, c1, c2) {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function shade(x, y, r) {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,0.55)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function halo(x, y, r, color, size = 1.35) {
    const g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * size);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * size, 0, TAU); ctx.fill();
  }

  const BODY = {
    iss(x, y, r) {
      ctx.save(); ctx.translate(x + Math.sin(st.t * 0.2) * 30, y); ctx.rotate(Math.sin(st.t * 0.15) * 0.08);
      ctx.fillStyle = '#c9ced8'; ctx.fillRect(-r, -4, r * 2, 8);
      for (const px of [-r, -r * 0.55, r * 0.55 - 26, r - 26]) {
        for (const pyy of [-50, 10]) {
          ctx.fillStyle = '#2d4f9e'; ctx.fillRect(px, pyy, 26, 40);
          ctx.strokeStyle = '#7fa3ff'; ctx.lineWidth = 1; ctx.strokeRect(px, pyy, 26, 40);
          ctx.beginPath(); ctx.moveTo(px + 13, pyy); ctx.lineTo(px + 13, pyy + 40); ctx.stroke();
        }
      }
      ctx.fillStyle = '#eef1f6';
      ctx.fillRect(-46, -14, 92, 28);
      ctx.fillRect(-14, -34, 28, 68);
      ctx.fillStyle = '#d0a64a'; ctx.fillRect(-40, -10, 18, 20);
      ctx.fillStyle = st.t % 1.4 < 0.15 ? '#ff4a4a' : '#552222';
      ctx.beginPath(); ctx.arc(46, 0, 3, 0, TAU); ctx.fill();
      ctx.restore();
    },
    moon(x, y, r) {
      // The cow that jumped over the moon: it leaps over the top from left to right,
      // then loops back round behind the moon, so its path never jumps.
      const a = Math.PI - st.t * 0.9;
      const behind = Math.sin(a) < 0;
      const cow = () => drawCow(
        x + Math.cos(a) * r * 1.35,
        y - Math.sin(a) * r * (behind ? 0.5 : 1.35),
        0.625 + 0.075 * Math.sin(a),
        -a + Math.PI / 2
      );
      if (behind) cow();
      halo(x, y, r, 'rgba(230,230,255,0.25)');
      sphere(x, y, r, '#f4f4f0', '#9a9aa4');
      ctx.fillStyle = 'rgba(110,110,125,0.45)';
      [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12], [0.4, -0.35, 0.1], [-0.5, 0.25, 0.08], [0.05, -0.5, 0.09]].forEach(c => {
        ctx.beginPath(); ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, TAU); ctx.fill();
      });
      shade(x, y, r);
      if (!behind) cow();
      // flag
      ctx.fillStyle = '#ddd'; ctx.fillRect(x + r * 0.2, y - r * 0.98 - 30, 2, 30);
      ctx.fillStyle = '#ff5d73'; ctx.fillRect(x + r * 0.2 + 2, y - r * 0.98 - 30, 18, 11);
    },
    mars(x, y, r) {
      halo(x, y, r, 'rgba(255,120,60,0.3)');
      sphere(x, y, r, '#ff9a5c', '#a3341b');
      ctx.fillStyle = 'rgba(120,30,10,0.35)';
      [[-0.3, 0, 0.3, 0.12], [0.2, 0.3, 0.25, 0.1], [0.1, -0.25, 0.2, 0.08]].forEach(c => {
        ctx.beginPath(); ctx.ellipse(x + c[0] * r, y + c[1] * r, c[2] * r, c[3] * r, 0.3, 0, TAU); ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.9, r * 0.32, r * 0.1, 0, 0, TAU); ctx.fill();
      shade(x, y, r);
      // Phobos and Deimos
      const a1 = st.t * 0.5, a2 = st.t * 0.3 + 2;
      sphere(x + Math.cos(a1) * r * 1.5, y + Math.sin(a1) * r * 0.35, 12, '#b7a08e', '#5d4a3e');
      sphere(x + Math.cos(a2) * r * 1.9, y + Math.sin(a2) * r * 0.45, 8, '#c4ad98', '#6a5444');
      // rover
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x - 18, y - r - 14, 36, 10);
      ctx.fillStyle = '#333'; [-14, 0, 14].forEach(d => { ctx.beginPath(); ctx.arc(x + d, y - r - 2, 4, 0, TAU); ctx.fill(); });
    },
    jupiter(x, y, r) {
      halo(x, y, r, 'rgba(255,190,120,0.25)');
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
      const bands = ['#f3d9b1', '#d9a46c', '#f0d2a4', '#b97a4a', '#ecc896', '#c98d5a', '#f5ddb8', '#b5774a', '#e7c393'];
      bands.forEach((c, i) => {
        ctx.fillStyle = c;
        const by = y - r + (i * 2 * r) / bands.length;
        ctx.beginPath(); ctx.moveTo(x - r, by);
        for (let bx = -r; bx <= r; bx += 20) ctx.lineTo(x + bx, by + Math.sin(bx * 0.03 + st.t * 0.4 + i) * 5);
        ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.fill();
      });
      ctx.fillStyle = '#c2462e';
      ctx.beginPath(); ctx.ellipse(x + r * 0.3, y + r * 0.35, r * 0.2, r * 0.11, 0, 0, TAU); ctx.fill();
      ctx.restore();
      shade(x, y, r);
    },
    saturn(x, y, r) {
      halo(x, y, r, 'rgba(255,230,160,0.2)');
      ringHalf(x, y, r, true, ['rgba(222,200,150,0.8)', 'rgba(190,165,120,0.6)', 'rgba(240,220,170,0.7)'], -0.25);
      sphere(x, y, r, '#f6e2ae', '#b08a4e');
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(170,130,70,0.25)';
      for (let i = -3; i <= 3; i++) ctx.fillRect(x - r, y + i * r * 0.22, r * 2, r * 0.07);
      ctx.restore();
      shade(x, y, r);
      ringHalf(x, y, r, false, ['rgba(222,200,150,0.85)', 'rgba(190,165,120,0.65)', 'rgba(240,220,170,0.75)'], -0.25);
    },
    uranus(x, y, r) {
      halo(x, y, r, 'rgba(140,240,255,0.25)');
      ringHalf(x, y, r, true, ['rgba(200,240,255,0.5)'], 1.2);
      sphere(x, y, r, '#c9f7ff', '#3fa7b8');
      shade(x, y, r);
      ringHalf(x, y, r, false, ['rgba(200,240,255,0.55)'], 1.2);
    },
    neptune(x, y, r) {
      halo(x, y, r, 'rgba(80,130,255,0.3)');
      sphere(x, y, r, '#6aa0ff', '#1b2f9e');
      ctx.fillStyle = 'rgba(20,30,110,0.6)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.2, y + r * 0.1, r * 0.2, r * 0.1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.ellipse(x + r * 0.15, y - r * 0.2, r * 0.22, r * 0.03, 0, 0, TAU); ctx.fill();
      shade(x, y, r);
    },
    pluto(x, y, r) {
      halo(x, y, r, 'rgba(255,230,210,0.2)', 1.5);
      sphere(x, y, r, '#f1dcc6', '#8a6a55');
      // the heart
      ctx.fillStyle = '#fbf3ea';
      const hx = x + r * 0.15, hy = y + r * 0.1, hs = r * 0.32;
      ctx.beginPath();
      ctx.moveTo(hx, hy + hs * 0.9);
      ctx.bezierCurveTo(hx - hs * 1.4, hy, hx - hs * 0.6, hy - hs, hx, hy - hs * 0.35);
      ctx.bezierCurveTo(hx + hs * 0.6, hy - hs, hx + hs * 1.4, hy, hx, hy + hs * 0.9);
      ctx.fill();
      shade(x, y, r);
      const a = st.t * 0.4;
      sphere(x + Math.cos(a) * r * 2.2, y + Math.sin(a) * r * 0.6, r * 0.45, '#c9c3bd', '#5e5752');
    },
    helio(x, y) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `hsla(${190 + k * 40},90%,65%,${0.35 - k * 0.08})`;
        ctx.lineWidth = 18 - k * 5;
        ctx.beginPath();
        for (let px = -40; px <= W + 40; px += 20) {
          const yy = y + Math.sin(px * 0.006 + st.t * 0.8 + k) * 40 + (px - W / 2) * (px - W / 2) * 0.0002;
          px === -40 ? ctx.moveTo(px, yy) : ctx.lineTo(px, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
    },
    nebula(x, y, r) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const blobs = [[0, 0, 1, 320], [0.6, -0.3, 0.7, 290], [-0.5, 0.35, 0.8, 200], [0.9, 0.4, 0.6, 180], [-0.2, -0.6, 0.6, 260]];
      blobs.forEach((b, i) => {
        const bx = x + b[0] * r + Math.sin(st.t * 0.2 + i) * 20, by = y + b[1] * r;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, r * b[2]);
        g.addColorStop(0, `hsla(${b[3]},90%,65%,0.45)`); g.addColorStop(1, `hsla(${b[3]},90%,50%,0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, r * b[2], 0, TAU); ctx.fill();
      });
      ctx.restore();
      for (let i = 0; i < 4; i++) twinkleStar(x + (i - 1.5) * 90, y + Math.sin(i * 2) * 60, 4, '#fff');
    },
    core(x, y, r) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,250,220,0.95)'); g.addColorStop(0.2, 'rgba(255,200,90,0.6)'); g.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r, 0, 0, TAU); ctx.fill();
      spiral(x, y, r * 1.5, 0.4, st.t * 0.05, 'rgba(255,220,150,0.8)', 260);
      ctx.restore();
    },
    andromeda(x, y, r) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.5);
      g.addColorStop(0, 'rgba(255,240,255,0.9)'); g.addColorStop(1, 'rgba(180,140,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill();
      spiral(x, y, r, -0.5, st.t * 0.04, 'rgba(190,170,255,0.85)', 320);
      ctx.restore();
    },
    edge(x, y, r) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = `hsla(${(st.t * 40 + i * 50) % 360},90%,65%,0.5)`;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.ellipse(x, y, r * (1 - i * 0.12), r * 0.45 * (1 - i * 0.12), st.t * 0.1 + i * 0.2, 0, TAU); ctx.stroke();
      }
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.3);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.fill();
      ctx.restore();
    }
  };

  function ringHalf(x, y, r, back, colors, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    colors.forEach((c, i) => {
      ctx.strokeStyle = c; ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (1.45 + i * 0.16), r * (0.32 + i * 0.035), 0, back ? Math.PI : 0, back ? TAU : Math.PI);
      ctx.stroke();
    });
    ctx.restore();
  }
  function spiral(x, y, r, tilt, spin, color, n) {
    ctx.fillStyle = color;
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < n / 2; i++) {
        const f = i / (n / 2);
        const a = f * 7 + arm * Math.PI + spin;
        const rr = f * r;
        for (let k = 0; k < 3; k++) {
          const h = Math.sin((i * 3 + k) * 12.9898 + arm * 78.233) * 43758.5453;
          const j = (h - Math.floor(h) - 0.5) * (8 + rr * 0.35);
          const px = Math.cos(a) * rr + j, py = (Math.sin(a) * rr + j * 0.7) * 0.42;
          const qx = px * Math.cos(tilt) - py * Math.sin(tilt), qy = px * Math.sin(tilt) + py * Math.cos(tilt);
          ctx.globalAlpha = (1 - f * 0.8) * (k ? 0.5 : 1);
          ctx.beginPath(); ctx.arc(x + qx, y + qy, (k ? 1 : 1.5) + (1 - f) * 2, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  function twinkleStar(x, y, r, c) {
    const tw = 0.6 + 0.4 * Math.sin(st.t * 3 + x);
    ctx.fillStyle = c; ctx.globalAlpha = tw;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillRect(x - r * 4, y - 0.75, r * 8, 1.5); ctx.fillRect(x - 0.75, y - r * 4, 1.5, r * 8);
    ctx.globalAlpha = 1;
  }

  function drawBodies() {
    for (const m of MILESTONES) {
      if (!m.body) continue;
      const p = m.body === 'iss' ? 1 : P_BODY;
      const y = sy(m.alt, p) - 95;
      const r = m.r || 100;
      if (y < -r * 2 - 200 || y > H + r * 2 + 200) continue;
      BODY[m.body](m.bx || 300, y, r);
    }
  }

  // ---- Small decorations ------------------------------------------------
  function drawCow(x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-8, -4, 7, 0, TAU); ctx.arc(12, 6, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(32, -10, 12, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f7a8b8'; ctx.beginPath(); ctx.ellipse(40, -6, 6, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(32, -13, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    [-18, -6, 8, 20].forEach((lx, i) => ctx.fillRect(lx, 12, 5, 14 + Math.sin(st.t * 5 + i) * 3));
    ctx.strokeStyle = 'rgba(180,230,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(32, -10, 17, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawObj(o, x, y) {
    const t = st.t, s = o.s;
    ctx.save(); ctx.translate(x, y);
    switch (o.type) {
      case 'cloud': {
        const a = clamp(1 - (o.alt - 250) / 120, 0.15, 0.95);
        ctx.scale(s, s);
        ctx.fillStyle = `rgba(190,210,240,${a})`;
        for (const pf of o.puffs) { ctx.beginPath(); ctx.arc(pf.dx, pf.dy + 10, pf.r, 0, TAU); ctx.fill(); }
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        for (const pf of o.puffs) { ctx.beginPath(); ctx.arc(pf.dx, pf.dy, pf.r, 0, TAU); ctx.fill(); }
        break;
      }
      case 'wisp':
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.ellipse(0, 0, 220 * s, 14 * s, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(60, 14, 160 * s, 9 * s, 0, 0, TAU); ctx.fill();
        break;
      case 'birds': {
        ctx.strokeStyle = '#2a2d3e'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        const dir = Math.sign(o.vx);
        for (let i = 0; i < o.n; i++) {
          const bx = -dir * i * 26, by = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 16;
          const f = Math.sin(t * 10 + i * 1.3 + o.seed) * 7;
          ctx.beginPath();
          ctx.moveTo(bx - 12 * s, by - f);
          ctx.quadraticCurveTo(bx - 5 * s, by - 6, bx, by);
          ctx.quadraticCurveTo(bx + 5 * s, by - 6, bx + 12 * s, by - f);
          ctx.stroke();
        }
        break;
      }
      case 'balloon': {
        ctx.translate(0, Math.sin(t * 0.8 + o.seed) * 8);
        ctx.scale(s, s);
        const R = 40;
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 0.8, Math.PI * 0.2); ctx.lineTo(R * 0.25, R * 1.25); ctx.lineTo(-R * 0.25, R * 1.25); ctx.closePath();
        ctx.clip();
        for (let i = -3; i <= 3; i++) {
          ctx.fillStyle = `hsl(${(o.hue + (i & 1 ? 0 : 50)) % 360},85%,${i & 1 ? 55 : 62}%)`;
          ctx.fillRect(i * 14 - 7, -R, 14, R * 2.4);
        }
        ctx.restore();
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-9, R * 1.25); ctx.lineTo(-7, R * 1.55); ctx.moveTo(9, R * 1.25); ctx.lineTo(7, R * 1.55); ctx.stroke();
        ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-9, R * 1.55, 18, 13);
        break;
      }
      case 'plane': {
        const d = Math.sign(o.vx); ctx.scale(d * s, s);
        const g = ctx.createLinearGradient(-60, 0, -380, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(-380, -3, 320, 6);
        ctx.fillStyle = '#f5f7fb'; ctx.beginPath(); ctx.ellipse(0, 0, 55, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e2475e'; ctx.beginPath(); ctx.moveTo(-48, -3); ctx.lineTo(-62, -26); ctx.lineTo(-40, -4); ctx.fill();
        ctx.fillStyle = '#9fa8bd'; ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(-25, 20); ctx.lineTo(10, 3); ctx.fill();
        ctx.fillStyle = '#4c78c9'; for (let i = 0; i < 6; i++) ctx.fillRect(-28 + i * 10, -4, 5, 4);
        ctx.fillStyle = '#4c78c9'; ctx.beginPath(); ctx.ellipse(46, -2, 6, 4, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'jet': {
        const d = Math.sign(o.vx); ctx.scale(d * s, s);
        const g = ctx.createLinearGradient(-20, 0, -500, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(-500, -2, 480, 4);
        ctx.fillStyle = '#c8cedb';
        ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-20, -6); ctx.lineTo(-24, 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-14, -18); ctx.lineTo(-10, 0); ctx.fill();
        break;
      }
      case 'blimp': {
        const d = Math.sign(o.vx); ctx.scale(d * s, s);
        ctx.fillStyle = '#b7bfcf'; ctx.beginPath(); ctx.ellipse(0, 0, 80, 26, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e2475e'; ctx.fillRect(-30, -5, 70, 10);
        ctx.fillStyle = '#8e97aa';
        ctx.beginPath(); ctx.moveTo(-70, -6); ctx.lineTo(-92, -24); ctx.lineTo(-84, 0); ctx.lineTo(-92, 24); ctx.lineTo(-70, 6); ctx.fill();
        ctx.fillRect(-12, 24, 24, 8);
        break;
      }
      case 'glider': {
        ctx.translate(0, Math.sin(t + o.seed) * 10);
        ctx.fillStyle = `hsl(${o.hue},85%,58%)`;
        ctx.beginPath(); ctx.ellipse(0, 0, 42 * s, 14 * s, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(40,40,60,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-40 * s, 0); ctx.lineTo(0, 40 * s); ctx.lineTo(40 * s, 0); ctx.stroke();
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 44 * s, 5 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'wballoon': {
        ctx.translate(0, Math.sin(t * 0.7 + o.seed) * 6);
        sphere(0, 0, 20 * s, '#ffffff', '#c9d2e3');
        ctx.strokeStyle = '#dfe5ef'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 20 * s); ctx.lineTo(0, 60 * s); ctx.stroke();
        ctx.fillStyle = '#f2a541'; ctx.fillRect(-5, 60 * s, 10, 8);
        break;
      }
      case 'aurora': {
        ctx.restore(); ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp((st.cam - 330) / 120, 0, 1);
        for (let i = 0; i < 44; i++) {
          const ax = i * 38 - 20;
          const top = y - 120 + Math.sin(i * 0.35 + t * 0.9 + o.seed) * 40;
          const g = ctx.createLinearGradient(0, top, 0, top + 170);
          const hue = 130 + Math.sin(i * 0.2 + t * 0.5) * 50;
          g.addColorStop(0, `hsla(${hue},90%,60%,0)`); g.addColorStop(0.5, `hsla(${hue},90%,60%,0.22)`); g.addColorStop(1, `hsla(${hue},90%,60%,0)`);
          ctx.fillStyle = g; ctx.fillRect(ax, top, 40, 170);
        }
        break;
      }
      case 'sat': {
        ctx.rotate(t * 0.25 + o.seed); ctx.scale(s, s);
        ctx.fillStyle = '#2d4f9e';
        ctx.fillRect(-60, -8, 42, 16); ctx.fillRect(18, -8, 42, 16);
        ctx.strokeStyle = '#86a8ff'; ctx.lineWidth = 1;
        for (const px of [-60, 18]) for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(px + i * 10.5, -8); ctx.lineTo(px + i * 10.5, 8); ctx.stroke(); }
        ctx.fillStyle = '#9aa3b8'; ctx.fillRect(-18, -1.5, 36, 3);
        ctx.fillStyle = '#d4a73a'; ctx.fillRect(-11, -13, 22, 26);
        ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.ellipse(0, -18, 9, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = (t + o.seed) % 1.2 < 0.15 ? '#ff4a4a' : '#5a2020';
        ctx.beginPath(); ctx.arc(0, 15, 2.5, 0, TAU); ctx.fill();
        break;
      }
      case 'astro': {
        ctx.rotate(Math.sin(t * 0.4 + o.seed) * 0.6 + t * 0.15); ctx.scale(s, s);
        ctx.fillStyle = '#d6dbe6'; ctx.fillRect(-14, -14, 28, 30);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-12, -16, 24, 32);
        ctx.fillStyle = '#ffffff';
        ctx.save(); ctx.translate(-12, -10); ctx.rotate(-1.2 + Math.sin(t * 4 + o.seed) * 0.6); ctx.fillRect(-4, 0, 8, 22); ctx.restore();
        ctx.save(); ctx.translate(12, -10); ctx.rotate(0.5); ctx.fillRect(-4, 0, 8, 22); ctx.restore();
        ctx.fillRect(-11, 14, 9, 18); ctx.fillRect(2, 14, 9, 18);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -26, 15, 0, TAU); ctx.fill();
        const g = ctx.createLinearGradient(-10, -34, 10, -18);
        g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#c47a1a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -26, 10, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-4, -29, 3, 2, -0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e2475e'; ctx.fillRect(-5, -6, 10, 6);
        break;
      }
      case 'cow': ctx.restore(); drawCow(x, y, s, t * 0.3 + o.seed); return;
      case 'duck': {
        ctx.rotate(Math.sin(t * 0.6 + o.seed) * 0.4); ctx.scale(s, s);
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 8, 26, 17, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(14, -12, 13, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.ellipse(28, -9, 9, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(18, -15, 2.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(180,230,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(14, -12, 20, 0, TAU); ctx.stroke();
        break;
      }
      case 'junk': case 'asteroid': case 'ice': {
        ctx.rotate(t * o.rot + o.seed);
        const r = o.r * (o.type === 'junk' ? 1 : s);
        ctx.beginPath();
        o.verts.forEach((v, i) => { const a = (i / o.verts.length) * TAU; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * v, Math.sin(a) * r * v); });
        ctx.closePath();
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.1);
        if (o.type === 'ice') { g.addColorStop(0, '#f2fbff'); g.addColorStop(1, '#5d8fb5'); }
        else if (o.type === 'junk') { g.addColorStop(0, '#d0d4dc'); g.addColorStop(1, '#5c6270'); }
        else { g.addColorStop(0, '#b29a86'); g.addColorStop(1, '#4b3a30'); }
        ctx.fillStyle = g; ctx.fill();
        if (o.type !== 'junk') {
          ctx.fillStyle = o.type === 'ice' ? 'rgba(255,255,255,0.35)' : 'rgba(40,28,22,0.4)';
          for (const c of o.craters) { ctx.beginPath(); ctx.arc(c.x * r, c.y * r, c.r * r, 0, TAU); ctx.fill(); }
        }
        if (o.type === 'ice') { ctx.restore(); twinkleStar(x - r * 0.3, y - r * 0.3, 1.5, '#fff'); return; }
        break;
      }
      case 'comet': {
        const d = Math.sign(o.vx);
        ctx.rotate(d > 0 ? 0.25 : Math.PI - 0.25);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, 0, -300 * s, 0);
        g.addColorStop(0, 'rgba(160,220,255,0.8)'); g.addColorStop(1, 'rgba(160,220,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.lineTo(-300 * s, -40 * s); ctx.lineTo(-300 * s, 40 * s); ctx.lineTo(0, 10 * s); ctx.fill();
        const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * s);
        hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, 'rgba(160,220,255,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 22 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'ufo': {
        ctx.translate(0, Math.sin(t * 2 + o.seed) * 10); ctx.rotate(Math.sin(t * 1.5 + o.seed) * 0.1); ctx.scale(s, s);
        if (Math.sin(t * 0.7 + o.seed) > 0.6) {
          const bg = ctx.createLinearGradient(0, 0, 0, 160);
          bg.addColorStop(0, 'rgba(180,255,170,0.5)'); bg.addColorStop(1, 'rgba(180,255,170,0)');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(14, 6); ctx.lineTo(50, 160); ctx.lineTo(-50, 160); ctx.fill();
        }
        ctx.fillStyle = 'rgba(150,240,255,0.55)'; ctx.beginPath(); ctx.ellipse(0, -10, 20, 18, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#7ddc6f'; ctx.beginPath(); ctx.arc(0, -12, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-3, -13, 2, 3, 0, 0, TAU); ctx.ellipse(3, -13, 2, 3, 0, 0, TAU); ctx.fill();
        const g = ctx.createLinearGradient(0, -10, 0, 10);
        g.addColorStop(0, '#e9edf5'); g.addColorStop(1, '#7c8597');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 46, 11, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = `hsl(${(t * 200 + i * 60) % 360},100%,65%)`;
          ctx.beginPath(); ctx.arc(-35 + i * 14, 2, 3, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'probe': {
        ctx.rotate(Math.sin(t * 0.2 + o.seed) * 0.3); ctx.scale(s, s);
        ctx.strokeStyle = '#aab3c5'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(90, 30); ctx.moveTo(0, 0); ctx.lineTo(-50, 26); ctx.stroke();
        ctx.fillStyle = '#d4a73a'; ctx.fillRect(-10, -6, 20, 14);
        ctx.fillStyle = '#f0f2f7'; ctx.beginPath(); ctx.ellipse(0, -16, 26, 9, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#666'; ctx.fillRect(-54, 22, 10, 10);
        break;
      }
      case 'gas': {
        ctx.globalCompositeOperation = 'lighter';
        const r = o.r * (1 + 0.05 * Math.sin(t * 0.5 + o.seed));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `hsla(${o.hue},85%,60%,0.22)`); g.addColorStop(1, `hsla(${o.hue},85%,50%,0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        break;
      }
      case 'jelly': {
        const pulse = 1 + 0.1 * Math.sin(t * 2.5 + o.seed);
        ctx.translate(0, Math.sin(t * 0.8 + o.seed) * 14); ctx.scale(s * pulse, s / pulse);
        ctx.globalCompositeOperation = 'lighter';
        const hue = (o.hue % 2) ? 300 : 185;
        ctx.strokeStyle = `hsla(${hue},90%,70%,0.55)`; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath(); ctx.moveTo(-26 + i * 10.5, 0);
          for (let j = 1; j <= 10; j++) ctx.lineTo(-26 + i * 10.5 + Math.sin(t * 3 + j * 0.6 + i) * 6, j * 8);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(0, -6, 2, 0, -6, 36);
        g.addColorStop(0, `hsla(${hue},100%,85%,0.9)`); g.addColorStop(1, `hsla(${hue},90%,60%,0.15)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 34, 30, 0, Math.PI, 0); ctx.fill();
        break;
      }
      case 'cluster': {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
        g.addColorStop(0, 'rgba(200,220,255,0.25)'); g.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 90, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        o.stars.forEach((sr, i) => { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2 + i); ctx.beginPath(); ctx.arc(sr.x, sr.y, sr.r, 0, TAU); ctx.fill(); });
        break;
      }
      case 'galaxy':
        ctx.globalCompositeOperation = 'lighter';
        spiral(0, 0, 90 * s, o.tilt, t * 0.15 + o.seed, `hsla(${o.hue},80%,80%,0.9)`, 120);
        break;
      case 'whale': {
        const d = Math.sign(o.vx); ctx.translate(0, Math.sin(t * 0.6 + o.seed) * 12); ctx.scale(d * s, s);
        ctx.globalCompositeOperation = 'lighter';
        const tail = Math.sin(t * 1.6 + o.seed) * 14;
        const g = ctx.createLinearGradient(0, -40, 0, 40);
        g.addColorStop(0, 'rgba(90,140,255,0.75)'); g.addColorStop(1, 'rgba(200,120,255,0.6)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(90, 0);
        ctx.bezierCurveTo(90, -42, 10, -46, -60, -14);
        ctx.quadraticCurveTo(-100, -4 + tail, -125, -26 + tail);
        ctx.quadraticCurveTo(-118, 0 + tail, -128, 22 + tail);
        ctx.quadraticCurveTo(-100, 8 + tail, -60, 12);
        ctx.bezierCurveTo(10, 40, 90, 34, 90, 0);
        ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, 22); ctx.quadraticCurveTo(-5, 50 + tail * 0.5, -25, 46); ctx.quadraticCurveTo(-10, 34, -6, 22); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(62, -6, 3.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(70 - i * 22, 18 - i); ctx.lineTo(56 - i * 22, 24 - i); ctx.stroke(); }
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 7; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i); ctx.beginPath(); ctx.arc(-40 + i * 17, -8 + Math.sin(i * 3) * 10, 1.6, 0, TAU); ctx.fill(); }
        break;
      }
      case 'ring': {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = `hsla(${(t * 60 + i * 40 + o.hue) % 360},95%,65%,${0.6 - i * 0.1})`;
          ctx.lineWidth = 5;
          ctx.setLineDash([18, 10]); ctx.lineDashOffset = t * 40 * (i % 2 ? 1 : -1);
          ctx.beginPath(); ctx.ellipse(0, 0, 70 * s - i * 10, 28 * s - i * 4, 0, 0, TAU); ctx.stroke();
        }
        ctx.setLineDash([]);
        break;
      }
      case 'crystal': {
        ctx.rotate(t * 0.3 + o.seed); ctx.scale(s, s);
        ctx.globalCompositeOperation = 'lighter';
        [[0, 0, 1], [26, 14, 0.6], [-22, 18, 0.5]].forEach((c, i) => {
          ctx.fillStyle = `hsla(${(o.hue + i * 40) % 360},90%,70%,0.55)`;
          ctx.beginPath(); ctx.moveTo(c[0], c[1] - 40 * c[2]); ctx.lineTo(c[0] + 14 * c[2], c[1]); ctx.lineTo(c[0], c[1] + 40 * c[2]); ctx.lineTo(c[0] - 14 * c[2], c[1]); ctx.closePath(); ctx.fill();
        });
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
        const x = o.type === 'aurora' ? 0 : wrapX(o.x + o.vx * st.t, o.type === 'whale' || o.type === 'plane' || o.type === 'jet' ? 420 : 260);
        drawObj(o, x, y);
      }
    }
  }

  // ---- Rocket -----------------------------------------------------------
  const FLAMES = [
    ['#ff6a00', '#ffd23f'],
    ['#ff3d00', '#ffe066'],
    ['#2f7bff', '#9fe6ff'],
    ['#b04dff', '#ff9cf5']
  ];
  const flameSet = () => FLAMES[st.streak >= 8 ? 3 : st.streak >= 5 ? 2 : st.streak >= 3 ? 1 : 0];

  function rocketPose() {
    let x = RX, y = BASE, tilt = 0;
    if (!st.onPad) {
      x += Math.sin(st.t * 1.3) * 5;
      y += Math.sin(st.t * 2.1) * 7;
      tilt = Math.sin(st.t * 1.7) * 0.035;
    } else if (st.ignite > 0) {
      x += (Math.random() - 0.5) * 3 * st.ignite;
    }
    y += st.dip;
    if (st.dead && !st.onPad) {
      tilt += Math.min(st.deadT * 0.9, 2.2);
      y += st.deadT * st.deadT * 60;
      x += st.deadT * 40;
    }
    return { x, y, tilt };
  }

  function nozzleOf(pose) {
    // rocket rotates around its middle (95px above the nozzle)
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
    const pose = rocketPose();
    ctx.save();
    ctx.translate(pose.x, pose.y - 95);
    ctx.rotate(pose.tilt);
    ctx.translate(0, 95);
    // flame
    if (st.thrust > 0.02) {
      const sput = st.sputter > 0 && Math.random() < 0.5 ? 0.2 : 1;
      drawFlame((30 + st.thrust * 150) * sput, 15 + st.thrust * 8);
    }
    // fins
    const fin = (d) => {
      ctx.fillStyle = '#e8364f';
      ctx.beginPath(); ctx.moveTo(d * 32, -70); ctx.lineTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 30, -16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8243b';
      ctx.beginPath(); ctx.moveTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 56, 2); ctx.closePath(); ctx.fill();
    };
    fin(-1); fin(1);
    // nozzle
    const ng = ctx.createLinearGradient(-26, 0, 26, 0);
    ng.addColorStop(0, '#4a5060'); ng.addColorStop(0.5, '#9aa2b4'); ng.addColorStop(1, '#3e4352');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(18, -18); ctx.lineTo(25, 0); ctx.lineTo(-25, 0); ctx.closePath(); ctx.fill();
    // body
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
    // window
    ctx.fillStyle = '#7b8499'; ctx.beginPath(); ctx.arc(0, -105, 19, 0, TAU); ctx.fill();
    const wg = ctx.createRadialGradient(-5, -110, 2, 0, -105, 15);
    wg.addColorStop(0, '#7fd3ff'); wg.addColorStop(1, '#173a8a');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, -105, 14, 0, TAU); ctx.fill();
    // little pilot
    ctx.fillStyle = '#ffd7a8'; ctx.beginPath(); ctx.arc(0, -101, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-2.3, -102, 1.1, 0, TAU); ctx.arc(2.3, -102, 1.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (st.dead || st.sputter > 0) ctx.arc(0, -96.5, 2, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(0, -100.5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-6, -112, 4, 2.5, -0.6, 0, TAU); ctx.fill();
    // centre fin
    ctx.fillStyle = '#c62a42'; ctx.fillRect(-4, -60, 8, 66);
    // rivets
    ctx.fillStyle = 'rgba(80,90,110,0.5)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-22 + i * 11, -24, 1.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---- Particles --------------------------------------------------------
  function emit(dt) {
    const pose = rocketPose();
    const nz = nozzleOf(pose);
    const fs = flameSet();
    const inAir = st.cam < 420;
    if (st.thrust > 0.05 && !(st.sputter > 0 && Math.random() < 0.5)) {
      st.emitF += st.thrust * 130 * dt;
      while (st.emitF >= 1) {
        st.emitF--;
        parts.push({
          k: 'flame', x: nz.x + rand(-8, 8), y: nz.y + rand(0, 10),
          vx: nz.dx * 260 + rand(-40, 40), vy: nz.dy * (220 + st.thrust * 260) + rand(-20, 20),
          life: rand(0.25, 0.55), max: 0.55, size: rand(8, 16) * (0.7 + st.thrust * 0.5),
          color: Math.random() < 0.5 ? fs[0] : fs[1]
        });
        if (st.streak >= 8 && Math.random() < 0.4) {
          parts.push({ k: 'spark', x: nz.x, y: nz.y + 10, vx: rand(-120, 120), vy: rand(150, 380), life: 0.8, max: 0.8, size: 3, color: `hsl(${Math.random() * 360},100%,65%)` });
        }
      }
    }
    if (inAir && (st.thrust > 0.1 || st.ignite > 0)) {
      st.emitS += ((st.onPad ? 0 : st.thrust * 26) + st.ignite * 40) * dt;
      while (st.emitS >= 1) {
        st.emitS--;
        const pad = st.onPad;
        parts.push({
          k: 'smoke', x: nz.x + rand(-15, 15), y: nz.y + (pad ? 30 : 20),
          vx: pad ? rand(-320, 320) : rand(-50, 50), vy: pad ? rand(-40, 10) : rand(60, 160),
          life: rand(1.6, 2.6), max: 2.6, size: rand(18, 30), grow: rand(30, 60), color: '#ffffff'
        });
      }
    }
    if (st.dead && Math.random() < dt * 20) {
      parts.push({ k: 'smoke', x: nz.x, y: nz.y, vx: rand(-30, 30), vy: rand(-80, -20), life: 1.8, max: 1.8, size: 14, grow: 40, color: '#3a3a44' });
    }
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
        ctx.globalAlpha = a * 0.45 * (p.color === '#ffffff' ? clamp(1 - st.cam / 450, 0.1, 1) : 1);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
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

  // ---- Main update / draw ----------------------------------------------
  function update(dt) {
    st.t += dt;
    const prev = st.cam;
    if (!st.dead) {
      st.cam += (st.target - st.cam) * (1 - Math.exp(-dt * 2.1));
      if (Math.abs(st.target - st.cam) < 0.02) st.cam = st.target;
    }
    const dy = (st.cam - prev) * K;
    st.vel = dt > 0 ? dy / dt : 0;
    if (st.cam > 0.3) st.onPad = false;
    st.armAngle += ((st.onPad && st.ignite <= 0 ? 0 : 1.3) - st.armAngle) * Math.min(1, dt * 3);

    st.kick = Math.max(0, st.kick - dt * 1.2);
    const want = st.dead ? 0 : (st.onPad ? st.ignite * 0.45 : 0.32) + clamp(st.vel / 650, 0, 1.3) + st.kick * 0.6;
    st.thrust += (want - st.thrust) * Math.min(1, dt * 8);
    if (st.sputter > 0) st.sputter -= dt;
    if (st.dead) st.deadT += dt;

    // dip spring (when hit by a timeout)
    st.dipV += (-st.dip * 30 - st.dipV * 6) * dt;
    st.dip += st.dipV * dt;

    st.shake = Math.max(0, st.shake - dt * 2.5);
    st.flash = Math.max(0, st.flash - dt * 2);

    emit(dt);
    updateParts(dt, dy);

    const lineV = Math.max(st.vel, st.kick * 900);
    if (lineV > 250) {
      const n = Math.min(6, lineV / 300);
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.5) lines.push({ x: rand(0, W), y: rand(-200, H), len: 80 + lineV * 0.12, w: rand(1, 3), a: clamp(lineV / 2500, 0.08, 0.5), life: 0.6 });
      }
    }

    const starA = clamp((st.cam - 260) / 320, 0, 1);
    if (starA > 0.6 && Math.random() < dt * 0.5) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      fx.push({ k: 'shoot', x: rand(200, W - 200), y: rand(20, 400), vx: dir * rand(600, 900), vy: rand(250, 450), life: 0.9 });
    }

    if (onMilestone) {
      for (const m of MILESTONES) {
        if (m.alt > 0 && prev < m.alt && st.cam >= m.alt) onMilestone(m);
      }
    }
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

    drawStars(clamp((st.cam - 260) / 320, 0, 1));
    drawSun();
    drawBodies();
    drawEarth();
    drawDecor();
    drawGround();
    drawParts('smoke');
    drawLines();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawParts('flame'); ctx.restore();
    drawRocket();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawParts('spark'); ctx.restore();
    drawFx();

    if (st.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${st.flash * 0.5})`;
      ctx.fillRect(-30, -30, W + 60, H + 60);
    }
  }

  // ---- Public API -------------------------------------------------------
  return {
    W, H, RX, BASE,
    init(c) { canvas = c; ctx = c.getContext('2d'); },
    resize(stageScale) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pxScale = stageScale * dpr;
      canvas.width = Math.round(W * pxScale);
      canvas.height = Math.round(H * pxScale);
    },
    update, draw,
    reset() {
      st.cam = 0; st.target = 0; st.onPad = true; st.ignite = 0; st.dead = false; st.deadT = 0;
      st.thrust = 0; st.streak = 0; st.dip = 0; st.dipV = 0; st.sputter = 0;
      parts.length = 0; fx.length = 0; lines.length = 0;
    },
    get alt() { return st.cam; },
    get target() { return st.target; },
    setIgnite(v) { st.ignite = v; if (v) st.shake = Math.max(st.shake, 0.2); },
    setStreak(n) { st.streak = n; },
    boostTo(alt, power) {
      st.target = alt;
      st.ignite = 0;
      st.kick = Math.min(1.2, 0.5 + power * 0.15);
      st.shake = Math.max(st.shake, 0.25 + power * 0.12);
      if (power >= 4) st.flash = 0.6;
      const nz = nozzleOf(rocketPose());
      fx.push({ k: 'ring', x: nz.x, y: nz.y, r: 120 + power * 40, life: 0.6, max: 0.6, color: flameSet()[1] });
    },
    sputter() { st.sputter = 0.9; st.shake = 0.6; st.dipV = 260; },
    die() { st.dead = true; st.deadT = 0; st.shake = 0.8; },
    confetti(n = 160) {
      const cols = ['#ff5d73', '#ffd23f', '#4fd1ff', '#7ddc6f', '#b04dff', '#ff9a3c'];
      for (let i = 0; i < n; i++) {
        fx.push({ k: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-80, 80), vy: rand(80, 300), rot: rand(0, TAU), vr: rand(-8, 8), w: rand(8, 14), h: rand(10, 18), life: rand(2.5, 4), color: cols[i % cols.length] });
      }
    },
    burst(x, y, color, n = 30) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), sp = rand(120, 420);
        parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.4, 0.9), max: 0.9, size: rand(2, 4), color });
      }
    },
    rocketScreen() { const p = rocketPose(); return { x: p.x, y: p.y - 100 }; },
    onMilestone(fn) { onMilestone = fn; }
  };
})();
