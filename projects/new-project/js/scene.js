/* Apples to Oranges — the animated world behind the game: a hot-air balloon rising from an
 * orchard, past kites and birds, through the clouds, past jet planes, up into the stratosphere.
 * One canvas, redrawn every frame. Height on screen grows with the square root of the altitude,
 * so the first few answers lift off the ground quickly and the balloon still moves later on. */
'use strict';

const Scene = (function () {
  const TAU = Math.PI * 2;
  const PER = 25;                   // world pixels per √metre
  const wy = alt => PER * Math.sqrt(Math.max(0, alt));
  const altOf = w => (Math.max(0, w) / PER) ** 2;

  let canvas, ctx;
  let W = 1600, H = 900, BASE = 780, BX = 330;
  const st = { cam: 0, target: 0, t: 0, burn: 0, dipY: 0, dipV: 0, shake: 0, sway: 0 };
  const fx = [];      // screen-space confetti and smoke
  let trees = [], city = [], stars = [];

  // ---- Helpers -----------------------------------------------------------
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
  const sy = w => BASE - (w - st.cam);

  // ---- Sky colours by altitude (metres): [alt, top, bottom] ----------------
  const SKY = [
    [0,      '#5fb4ff', '#d4f0ff'],
    [2000,   '#4f9ff2', '#bfe6ff'],
    [8000,   '#3479d6', '#93c8f6'],
    [13000,  '#1d4ea8', '#5a92dc'],
    [20000,  '#0f2668', '#2b4f9c'],
    [32000,  '#060c2c', '#14275e'],
    [60000,  '#03040f', '#0a1030']
  ];
  function skyAt(a) {
    let i = 0;
    while (i < SKY.length - 2 && a > SKY[i + 1][0]) i++;
    const s0 = SKY[i], s1 = SKY[i + 1];
    const t = clamp((a - s0[0]) / (s1[0] - s0[0]), 0, 1);
    return [mix(s0[1], s1[1], t), mix(s0[2], s1[2], t)];
  }

  // ---- Things in the sky, by altitude --------------------------------------
  const ZONES = [
    { to: 45,       d: 0,   types: {} },
    { to: 400,      d: 1.3, types: { kite: 1.4, birds: 2, cloud: 0.8, balloon: 1 } },
    { to: 2500,     d: 1.6, types: { cloud: 4, birds: 1.2, balloon: 0.9, blimp: 0.4, prop: 0.5 } },
    { to: 8000,     d: 1.5, types: { cloud: 3.5, prop: 0.7, geese: 0.5 } },
    { to: 13000,    d: 1.3, types: { jet: 2, wisp: 2, cloud: 0.5 } },
    { to: 32000,    d: 1.1, types: { wballoon: 1.5, wisp: 1.2, jet: 0.3 } },
    { to: Infinity, d: 1.2, types: { meteor: 1, sat: 1, wballoon: 0.4 } }
  ];
  const zoneAt = a => ZONES.find(z => a < z.to);

  const CHUNK = 210;
  const chunkCache = new Map();
  function chunk(ci) {
    if (chunkCache.has(ci)) return chunkCache.get(ci);
    if (chunkCache.size > 300) chunkCache.clear();
    const rng = mulberry32(ci * 7919 + 17);
    const zone = zoneAt(altOf(ci * CHUNK + CHUNK / 2));
    const out = [];
    const n = Math.floor(zone.d + rng() * 1.2);
    const types = Object.entries(zone.types);
    const total = types.reduce((s, p) => s + p[1], 0);
    for (let i = 0; i < n && total > 0; i++) {
      let r = rng() * total, type = types[0][0];
      for (const [k, wgt] of types) { if ((r -= wgt) <= 0) { type = k; break; } }
      out.push({
        type, w: ci * CHUNK + rng() * CHUNK, x: rng() * 1600, s: 0.7 + rng() * 0.6, seed: rng() * 1000,
        vx: (rng() < 0.5 ? -1 : 1) * (6 + rng() * 18), hue: Math.floor(rng() * 360)
      });
    }
    chunkCache.set(ci, out);
    return out;
  }

  // ---- Fixed scenery, laid out for the current width ----------------------
  function layout() {
    const rng = mulberry32(42);
    trees = [];
    for (let x = 40; x < W; x += 70 + rng() * 90) {
      if (Math.abs(x - BX) < 150) continue;                 // keep the launch field clear
      if (x > W * 0.78 - 40 && x < W * 0.78 + 230) continue; // and the barn
      trees.push({ x, s: 0.8 + rng() * 0.5, kind: rng() < 0.5 ? 'apple' : 'orange', seed: rng() * 100 });
    }
    city = [];
    for (let x = -20; x < W + 40;) {
      const w = 40 + rng() * 70;
      city.push({ x, w, h: 60 + rng() * 150, lit: rng() });
      x += w + 6 + rng() * 20;
    }
    stars = [];
    for (let i = 0; i < 160; i++) stars.push({ x: rng() * W, y: rng() * H, r: 0.6 + rng() * 1.6, p: rng() * TAU });
  }

  // ---- Drawing -------------------------------------------------------------
  function drawSky() {
    const [top, bot] = skyAt(altOf(st.cam));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawStars() {
    const a = clamp((altOf(st.cam) - 12000) / 18000, 0, 1);
    if (a <= 0) return;
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(st.t * 2 + s.p));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSun() {
    const r = 58;
    const x = W * 0.55, y = 112 + Math.min(80, st.cam * 0.01);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, 'rgba(255,250,210,0.9)'); g.addColorStop(0.25, 'rgba(255,220,120,0.4)'); g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function drawFruitTree(tr, gy) {
    const s = tr.s, sw = Math.sin(st.t * 1.4 + tr.seed) * 2;
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(tr.x - 5 * s, gy - 40 * s, 10 * s, 42 * s);
    ctx.fillStyle = tr.seed > 50 ? '#2e8b3e' : '#3a9d4a';
    ctx.beginPath();
    ctx.arc(tr.x + sw, gy - 60 * s, 27 * s, 0, TAU);
    ctx.arc(tr.x - 17 * s + sw, gy - 44 * s, 19 * s, 0, TAU);
    ctx.arc(tr.x + 17 * s + sw, gy - 44 * s, 19 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tr.kind === 'apple' ? '#ff4d5e' : '#ff9a1f';
    const spots = [[-12, -62], [8, -70], [16, -48], [-20, -44], [0, -50], [-4, -76]];
    for (const [dx, dy] of spots) { ctx.beginPath(); ctx.arc(tr.x + dx * s + sw, gy + dy * s, 4.2 * s, 0, TAU); ctx.fill(); }
  }

  function drawBarn(x, gy) {
    ctx.fillStyle = '#d64545'; ctx.fillRect(x, gy - 110, 190, 110);
    ctx.fillStyle = '#a83232';
    ctx.beginPath(); ctx.moveTo(x - 14, gy - 108); ctx.lineTo(x + 95, gy - 170); ctx.lineTo(x + 204, gy - 108); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4e0';
    ctx.fillRect(x + 70, gy - 70, 50, 70);
    ctx.strokeStyle = '#d64545'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 70, gy - 70); ctx.lineTo(x + 120, gy); ctx.moveTo(x + 120, gy - 70); ctx.lineTo(x + 70, gy); ctx.stroke();
    ctx.fillStyle = '#fff4e0'; ctx.fillRect(x + 82, gy - 140, 26, 22);
    // fruit crates
    for (let i = 0; i < 3; i++) {
      const cx = x - 70 + i * 34;
      ctx.fillStyle = '#b07a3e'; ctx.fillRect(cx, gy - 22, 30, 22);
      ctx.fillStyle = i === 1 ? '#ff9a1f' : '#ff4d5e';
      for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(cx + 7 + j * 8, gy - 24, 5, 0, TAU); ctx.fill(); }
    }
  }

  function drawGround() {
    const gy = BASE + 14 + st.cam;     // the basket sits on the platform, 14px above the grass
    if (gy - 460 > H) return;
    // far mountains
    const my = BASE - 40 + st.cam * 0.35;
    if (my - 280 < H) {
      ctx.fillStyle = '#8fa6d8';
      ctx.beginPath(); ctx.moveTo(-20, H + 2000);
      const mtn = x => my - 120 - 90 * Math.abs(Math.sin(x * 0.004 + 1)) - 40 * Math.sin(x * 0.013);
      for (let x = -20; x <= W + 40; x += 40) ctx.lineTo(x, mtn(x));
      ctx.lineTo(W + 40, H + 2000); ctx.fill();
      ctx.fillStyle = '#eef4ff';
      for (let x = 60; x < W; x += 260) {
        const top = mtn(x);
        ctx.beginPath(); ctx.moveTo(x - 30, top + 26); ctx.lineTo(x, top - 2); ctx.lineTo(x + 30, top + 26); ctx.fill();
      }
    }
    // city
    const cy = BASE + 6 + st.cam * 0.55;
    if (cy - 220 < H) {
      for (const b of city) {
        ctx.fillStyle = '#5d6fa6';
        ctx.fillRect(b.x, cy - b.h, b.w, b.h + 1200);
        ctx.fillStyle = 'rgba(255,233,150,0.75)';
        for (let y = cy - b.h + 10; y < cy - 8; y += 16) {
          for (let x = b.x + 6; x < b.x + b.w - 8; x += 10) {
            if (((x * 13 + y * 7) % 10) / 10 < b.lit * 0.6) ctx.fillRect(x, y, 4, 6);
          }
        }
      }
    }
    // near hills
    const hy = BASE + 18 + st.cam * 0.8;
    ctx.fillStyle = '#66c35f';
    ctx.beginPath(); ctx.moveTo(-20, H + 2000);
    for (let x = -20; x <= W + 40; x += 30) ctx.lineTo(x, hy - 30 - 26 * Math.sin(x * 0.006 + 2) - 12 * Math.sin(x * 0.017));
    ctx.lineTo(W + 40, H + 2000); ctx.fill();
    // ground
    ctx.fillStyle = '#4caf50'; ctx.fillRect(-20, gy, W + 40, 30);
    ctx.fillStyle = '#3d8f42'; ctx.fillRect(-20, gy + 30, W + 40, 18);
    ctx.fillStyle = '#7a5537'; ctx.fillRect(-20, gy + 48, W + 40, 1600);
    for (const tr of trees) drawFruitTree(tr, gy);
    drawBarn(W * 0.78, gy);
    // launch platform
    ctx.fillStyle = '#9c6b3c'; ctx.fillRect(BX - 80, gy - 14, 160, 14);
    ctx.fillStyle = '#7d522b'; ctx.fillRect(BX - 80, gy - 14, 160, 4);
    ctx.fillStyle = '#c9a26b';
    for (const dx of [-70, 58]) { ctx.beginPath(); ctx.ellipse(BX + dx + 6, gy - 22, 12, 9, 0, 0, TAU); ctx.fill(); }
    // windsock
    const wx = BX + 170;
    ctx.fillStyle = '#ddd'; ctx.fillRect(wx, gy - 120, 4, 120);
    ctx.save(); ctx.translate(wx + 4, gy - 116); ctx.rotate(Math.sin(st.t * 2) * 0.12);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#ff6b3d';
      ctx.beginPath(); ctx.moveTo(i * 16, -10 + i * 1.5); ctx.lineTo(i * 16 + 16, -9 + i * 2); ctx.lineTo(i * 16 + 16, 9 - i * 2); ctx.lineTo(i * 16, 10 - i * 1.5); ctx.fill();
    }
    ctx.restore();
  }

  // -- sky things --
  function cloud(x, y, s, a = 0.95) {
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e3eefb';
    ctx.beginPath();
    ctx.arc(x - 50 * s, y + 10 * s, 34 * s, 0, TAU); ctx.arc(x + 50 * s, y + 12 * s, 30 * s, 0, TAU);
    ctx.arc(x, y + 14 * s, 36 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 50 * s, y, 34 * s, 0, TAU); ctx.arc(x - 8 * s, y - 22 * s, 46 * s, 0, TAU);
    ctx.arc(x + 44 * s, y - 4 * s, 36 * s, 0, TAU); ctx.arc(x, y + 6 * s, 40 * s, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function birds(x, y, s, n, seed) {
    ctx.strokeStyle = '#2b3550'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = x + i * 26 * s - (i % 2) * 8, by = y + Math.abs(i - n / 2) * 12 * s;
      const f = Math.sin(st.t * 9 + seed + i) * 6 * s;
      ctx.beginPath(); ctx.moveTo(bx - 10 * s, by - f); ctx.quadraticCurveTo(bx - 4 * s, by - 6 * s, bx, by);
      ctx.quadraticCurveTo(bx + 4 * s, by - 6 * s, bx + 10 * s, by - f); ctx.stroke();
    }
  }
  function kite(x, y, s, hue, seed) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(st.t * 1.5 + seed) * 0.15);
    ctx.fillStyle = `hsl(${hue},85%,60%)`;
    ctx.beginPath(); ctx.moveTo(0, -30 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(0, 36 * s); ctx.lineTo(-20 * s, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `hsl(${(hue + 60) % 360},85%,65%)`;
    ctx.beginPath(); ctx.moveTo(0, -30 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 36 * s);
    for (let i = 1; i <= 6; i++) ctx.lineTo(Math.sin(st.t * 4 + i + seed) * 8 * s, 36 * s + i * 12 * s);
    ctx.stroke();
    ctx.restore();
  }
  function smallBalloon(x, y, s, hue) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * 0.45, s * 0.45);
    envelope(0, 0, [`hsl(${hue},80%,60%)`, `hsl(${(hue + 40) % 360},85%,62%)`, '#fff3c4']);
    ctx.fillStyle = '#9c6b3c'; ctx.fillRect(-18, 40, 36, 28);
    ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-18, 16); ctx.lineTo(-16, 40); ctx.moveTo(18, 16); ctx.lineTo(16, 40); ctx.stroke();
    ctx.restore();
  }
  function blimp(x, y, s, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    ctx.fillStyle = '#c9d2e3'; ctx.beginPath(); ctx.ellipse(0, 0, 90, 30, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff9a1f'; ctx.fillRect(-60, -6, 110, 12);
    ctx.fillStyle = '#9aa6bd';
    ctx.beginPath(); ctx.moveTo(-78, -10); ctx.lineTo(-108, -32); ctx.lineTo(-96, 0); ctx.lineTo(-108, 32); ctx.lineTo(-78, 10); ctx.fill();
    ctx.fillStyle = '#596580'; ctx.fillRect(-14, 28, 30, 10);
    ctx.restore();
  }
  function plane(x, y, s, dir, jet) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    if (jet) {
      const g = ctx.createLinearGradient(-500, 0, -40, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.75)');
      ctx.fillStyle = g; ctx.fillRect(-500, -3, 460, 6);
    }
    ctx.fillStyle = '#f4f6fb';
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#dfe5f1';
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-22, 26); ctx.lineTo(-12, 26); ctx.lineTo(14, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-46, -22); ctx.lineTo(-38, -22); ctx.lineTo(-24, 0); ctx.fill();
    ctx.fillStyle = jet ? '#4fa3ff' : '#ff5d73'; ctx.fillRect(-30, -2, 60, 3);
    ctx.fillStyle = '#2b3550';
    for (let i = 0; i < 6; i++) ctx.fillRect(-18 + i * 8, -4, 4, 3);
    if (!jet) {
      ctx.fillStyle = 'rgba(80,90,110,0.6)';
      ctx.fillRect(44, -12 * Math.abs(Math.sin(st.t * 30)), 3, 24 * Math.abs(Math.sin(st.t * 30)));
    }
    ctx.restore();
  }
  function wisp(x, y, s) {
    const g = ctx.createLinearGradient(x - 160 * s, 0, x + 160 * s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 160 * s, 7 * s, 0, 0, TAU); ctx.fill();
  }
  function wballoon(x, y, s) {
    ctx.fillStyle = '#f2f4fa';
    ctx.beginPath(); ctx.arc(x, y, 26 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,175,205,0.6)';
    ctx.beginPath(); ctx.arc(x + 8 * s, y + 6 * s, 18 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + 26 * s); ctx.lineTo(x, y + 70 * s); ctx.stroke();
    ctx.fillStyle = '#ff9a1f'; ctx.fillRect(x - 6 * s, y + 70 * s, 12 * s, 10 * s);
  }
  function meteor(x, y, s) {
    const g = ctx.createLinearGradient(x - 140 * s, y - 70 * s, x, y);
    g.addColorStop(0, 'rgba(255,220,150,0)'); g.addColorStop(1, 'rgba(255,240,200,0.9)');
    ctx.strokeStyle = g; ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(x - 140 * s, y - 70 * s); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff6da'; ctx.beginPath(); ctx.arc(x, y, 4 * s, 0, TAU); ctx.fill();
  }
  function sat(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(st.t * 0.4) * 0.3); ctx.scale(s, s);
    ctx.fillStyle = '#d9dee9'; ctx.fillRect(-12, -10, 24, 20);
    ctx.fillStyle = '#e8b83c'; ctx.fillRect(-10, -8, 20, 16);
    ctx.fillStyle = '#3a63c9'; ctx.fillRect(-54, -8, 38, 16); ctx.fillRect(16, -8, 38, 16);
    ctx.restore();
  }

  // ---- Easter egg: the rocket from Brain Rocket, flying past ------------------
  // Same shapes and colours as Brain Rocket's rocket, drawn nose-up around its nozzle at (0, 0).
  function brainRocket() {
    // flame
    const L = 70 * (1 + Math.sin(st.t * 40) * 0.08 + Math.sin(st.t * 23) * 0.06);
    const layer = (w, l, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(-w * 1.1, l * 0.45, 0, l);
      ctx.quadraticCurveTo(w * 1.1, l * 0.45, w, 0); ctx.closePath(); ctx.fill();
    };
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    layer(17, L, '#ff7a1a'); layer(11, L * 0.72, '#ffd23f'); layer(5, L * 0.4, '#ffffff');
    ctx.restore();
    // fins
    for (const d of [-1, 1]) {
      ctx.fillStyle = '#e8364f';
      ctx.beginPath(); ctx.moveTo(d * 32, -70); ctx.lineTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 30, -16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8243b';
      ctx.beginPath(); ctx.moveTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 56, 2); ctx.closePath(); ctx.fill();
    }
    // nozzle
    const ng = ctx.createLinearGradient(-26, 0, 26, 0);
    ng.addColorStop(0, '#4a5060'); ng.addColorStop(0.5, '#9aa2b4'); ng.addColorStop(1, '#3e4352');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(18, -18); ctx.lineTo(25, 0); ctx.lineTo(-25, 0); ctx.closePath(); ctx.fill();
    // body, with the red nose cone and stripes
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-31, -16); ctx.lineTo(-35, -110);
    ctx.quadraticCurveTo(-35, -165, 0, -200); ctx.quadraticCurveTo(35, -165, 35, -110);
    ctx.lineTo(31, -16); ctx.closePath();
    const bg = ctx.createLinearGradient(-35, 0, 35, 0);
    bg.addColorStop(0, '#b9c1d4'); bg.addColorStop(0.35, '#ffffff'); bg.addColorStop(1, '#a7b0c4');
    ctx.fillStyle = bg; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#e8364f'; ctx.fillRect(-40, -210, 80, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-20, -210, 10, 62);
    ctx.fillStyle = '#e8364f'; ctx.fillRect(-40, -46, 80, 10);
    ctx.fillStyle = '#2a3350'; ctx.fillRect(-40, -34, 80, 4);
    ctx.restore();
    // window and its little pilot, waving hello
    ctx.fillStyle = '#7b8499'; ctx.beginPath(); ctx.arc(0, -105, 19, 0, TAU); ctx.fill();
    const wg = ctx.createRadialGradient(-5, -110, 2, 0, -105, 15);
    wg.addColorStop(0, '#7fd3ff'); wg.addColorStop(1, '#173a8a');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, -105, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd7a8'; ctx.beginPath(); ctx.arc(0, -101, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-2.3, -102, 1.1, 0, TAU); ctx.arc(2.3, -102, 1.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -100.5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-6, -112, 4, 2.5, -0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c62a42'; ctx.fillRect(-4, -60, 8, 66);
  }

  // It shows up rarely on its own (and the game sends it when you hit a 10 streak).
  let egg = null, eggWait = rand(40, 90);
  function launchEgg() {
    if (egg) return;
    // it launches up through the open sky on the left, where the matchup panel doesn't cover it
    // (and to one side of the balloon, so its smoke trail doesn't cross it)
    const right = Math.min(540, W * 0.33);
    const x = Math.random() < 0.5 ? rand(50, Math.max(60, BX - 160)) : rand(Math.min(right - 10, BX + 160), right);
    egg = { x, y: H + 60, vx: (x < BX ? 1 : -1) * rand(20, 90), vy: -rand(330, 420), s: rand(0.4, 0.5), trail: 0 };
  }
  function drawEgg(dt) {
    eggWait -= dt;
    if (eggWait <= 0) { eggWait = rand(70, 160); if (Math.random() < 0.45) launchEgg(); }
    if (!egg) return;
    egg.x += egg.vx * dt; egg.y += egg.vy * dt;
    const ang = Math.atan2(egg.vy, egg.vx) + Math.PI / 2;    // the nose points along its path
    egg.trail += dt;
    while (egg.trail > 0.03) {
      egg.trail -= 0.03;
      fx.push({ kind: 'puff', x: egg.x - Math.sin(ang) * -6, y: egg.y + Math.cos(ang) * 6, vx: rand(-15, 15), vy: rand(-15, 15), life: 1.2, max: 1.2, r: rand(5, 9) * egg.s * 2 });
    }
    ctx.save(); ctx.translate(egg.x, egg.y); ctx.rotate(ang); ctx.scale(egg.s, egg.s);
    brainRocket();
    ctx.restore();
    if (egg.x < -300 || egg.x > W + 300 || egg.y < -400) egg = null;
  }

  function drawDecor() {
    const top = st.cam + (BASE + 200), bot = st.cam - (H - BASE) - 200;
    for (let ci = Math.max(1, Math.floor(bot / CHUNK)); ci <= Math.floor(top / CHUNK); ci++) {
      for (const o of chunk(ci)) {
        const y = sy(o.w);
        if (y < -200 || y > H + 200) continue;
        const x = wrapX(o.x * (W / 1600) + o.vx * st.t);
        const dir = o.vx > 0 ? 1 : -1;
        switch (o.type) {
          case 'cloud': cloud(x, y, o.s); break;
          case 'birds': birds(x, y, o.s, 3 + Math.floor(o.seed) % 3, o.seed); break;
          case 'geese': birds(x, y, o.s * 0.8, 7, o.seed); break;
          case 'kite': kite(x, y, o.s, o.hue, o.seed); break;
          case 'balloon': smallBalloon(x, y, o.s, o.hue); break;
          case 'blimp': blimp(x, y, o.s, dir); break;
          case 'prop': plane(x, y, o.s * 0.8, dir, false); break;
          case 'jet': plane(wrapX(o.x * (W / 1600) + o.vx * 6 * st.t, 600), y, o.s, dir, true); break;
          case 'wisp': wisp(x, y, o.s); break;
          case 'wballoon': wballoon(x, y, o.s); break;
          case 'meteor': meteor(wrapX(o.x + st.t * 220 + o.seed), y + ((st.t * 110 + o.seed) % 300), o.s); break;
          case 'sat': sat(x, y, o.s); break;
        }
      }
    }
  }

  // The balloon's envelope, drawn around (cx, mouthY): the mouth sits at mouthY,
  // the envelope rises about 260px above it.
  function envelope(cx, mouthY, colors) {
    const R = 108, cy = mouthY - 140;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 22, mouthY);
    ctx.bezierCurveTo(cx - 60, mouthY - 22, cx - R * 1.04, cy + 60, cx - R, cy);
    ctx.arc(cx, cy, R, Math.PI, 0);
    ctx.bezierCurveTo(cx + R * 1.04, cy + 60, cx + 60, mouthY - 22, cx + 22, mouthY);
    ctx.closePath();
    ctx.clip();
    // curved stripes: narrowing ellipses, alternating colours
    const N = 7;
    for (let k = N; k >= 1; k--) {
      ctx.fillStyle = colors[k % colors.length];
      ctx.beginPath(); ctx.ellipse(cx, cy + 30, R * 1.1 * (k / N), R * 1.9, 0, 0, TAU); ctx.fill();
    }
    // light from the top left, shade on the right
    const g = ctx.createRadialGradient(cx - 40, cy - 50, 10, cx, cy, R * 1.5);
    g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(40,0,40,0.3)');
    ctx.fillStyle = g; ctx.fillRect(cx - R - 10, cy - R - 10, R * 2 + 20, R * 3);
    ctx.restore();
  }

  const BALLOON_COLORS = ['#ff9a1f', '#ff4d6d', '#ffd23f', '#ff4d6d'];

  function drawBalloon() {
    const air = st.cam > 4 || st.target > 0;
    const bob = air ? Math.sin(st.t * 1.6) * 6 : 0;
    const shake = st.shake > 0 ? Math.sin(st.t * 70) * 6 * st.shake : 0;
    const cx = BX + shake + (air ? Math.sin(st.t * 0.7) * 4 : 0);
    const by = BASE + bob + st.dipY;      // bottom of the basket
    const mouth = by - 108;

    ctx.save();
    ctx.translate(cx, by); ctx.rotate(Math.sin(st.t * 0.9) * (air ? 0.025 : 0) + st.sway * 0.08); ctx.translate(-cx, -by);

    // flame (behind the envelope's mouth)
    const burn = st.burn > 0 ? Math.min(1, st.burn) : 0;
    const flick = 0.75 + 0.25 * Math.sin(st.t * 40);
    const fl = 10 + 52 * burn * flick;
    const fg = ctx.createLinearGradient(0, by - 92, 0, by - 92 - fl);
    fg.addColorStop(0, 'rgba(120,180,255,0.95)'); fg.addColorStop(0.3, 'rgba(255,230,120,0.95)'); fg.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(cx - 9, by - 92); ctx.quadraticCurveTo(cx, by - 92 - fl * 1.2, cx + 9, by - 92); ctx.fill();

    envelope(cx, mouth, BALLOON_COLORS);
    // skirt
    ctx.fillStyle = '#c23a52';
    ctx.beginPath(); ctx.moveTo(cx - 22, mouth); ctx.lineTo(cx + 22, mouth); ctx.lineTo(cx + 17, mouth + 14); ctx.lineTo(cx - 17, mouth + 14); ctx.fill();
    // ropes
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [a, b] of [[-17, -28], [-6, -10], [6, 10], [17, 28]]) { ctx.moveTo(cx + a, mouth + 14); ctx.lineTo(cx + b, by - 46); }
    ctx.stroke();
    // burner
    ctx.fillStyle = '#9aa3b8'; ctx.fillRect(cx - 10, by - 96, 20, 10);
    ctx.fillStyle = '#6e7586'; ctx.fillRect(cx - 10, by - 88, 20, 3);
    // pilot
    ctx.fillStyle = '#ffd3a1'; ctx.beginPath(); ctx.arc(cx + 9, by - 54, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.arc(cx + 9, by - 58, 11, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = '#2b3550';
    ctx.beginPath(); ctx.arc(cx + 6, by - 54, 1.8, 0, TAU); ctx.arc(cx + 13, by - 54, 1.8, 0, TAU); ctx.fill();
    // basket
    ctx.fillStyle = '#b07a3e'; ctx.fillRect(cx - 30, by - 46, 60, 46);
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = by - 36; y < by; y += 10) { ctx.moveTo(cx - 30, y); ctx.lineTo(cx + 30, y); }
    for (let x = cx - 20; x < cx + 30; x += 12) { ctx.moveTo(x, by - 46); ctx.lineTo(x, by); }
    ctx.stroke();
    ctx.fillStyle = '#7d522b'; ctx.fillRect(cx - 33, by - 50, 66, 7);
    // sandbags
    ctx.fillStyle = '#c9a26b';
    ctx.beginPath(); ctx.ellipse(cx - 36, by - 22, 7, 10, 0, 0, TAU); ctx.ellipse(cx + 36, by - 22, 7, 10, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // sparks while the burner roars
    if (burn > 0.2 && Math.random() < 0.6) {
      fx.push({ kind: 'spark', x: cx + rand(-6, 6), y: by - 96, vx: rand(-30, 30), vy: rand(-160, -60), life: 0.5, max: 0.5, c: Math.random() < 0.5 ? '#ffd23f' : '#ff9a1f', r: rand(2, 3.5) });
    }
  }

  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.life -= dt;
      if (p.life <= 0) { fx.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'confetti') {
        p.vy += 260 * dt; p.vx *= 0.99; p.rot += p.vr * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore();
      } else if (p.kind === 'puff') {
        p.r += 14 * dt;
        ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.kind === 'smoke') {
        p.r += 30 * dt;
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = '#7d8597';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Loop ----------------------------------------------------------------
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    st.t += dt;
    st.cam += (st.target - st.cam) * Math.min(1, dt * 2.2);
    st.burn = Math.max(0, st.burn - dt);
    st.shake = Math.max(0, st.shake - dt * 1.5);
    // dip: a spring pulling the balloon back to its place
    st.dipV += (-60 * st.dipY - 7 * st.dipV) * dt;
    st.dipY += st.dipV * dt;
    st.sway *= Math.pow(0.1, dt);

    drawSky();
    drawStars();
    drawSun();
    drawDecor();
    drawEgg(dt);
    drawGround();
    drawBalloon();
    drawFx(dt);
    requestAnimationFrame(frame);
  }

  return {
    init(cv) {
      canvas = cv; ctx = canvas.getContext('2d');
      requestAnimationFrame(t => { last = t; frame(t); });
    },
    // w, h: stage size in game pixels; scale: game pixels to CSS pixels
    resize(w, h, scale) {
      W = w; H = h; BASE = H - 118; BX = Math.max(230, Math.min(340, W * 0.2));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      layout();
    },
    setAlt(alt, instant) { st.target = wy(alt); if (instant) st.cam = st.target; },
    burn(sec = 1.3) { st.burn = sec; },
    dip() {
      st.dipV = 260; st.shake = 0.6; st.sway = (Math.random() < 0.5 ? -1 : 1);
      for (let i = 0; i < 8; i++) fx.push({ kind: 'smoke', x: BX + rand(-12, 12), y: BASE - 100 + st.dipY, vx: rand(-40, 40), vy: rand(-70, -30), life: 1.1, max: 1.1, r: rand(6, 12) });
    },
    confetti(n = 120, x = null) {
      const cols = ['#ff5d73', '#ffd23f', '#4fd1ff', '#7ddc6f', '#c77dff', '#ff9a1f'];
      for (let i = 0; i < n; i++) {
        fx.push({ kind: 'confetti', x: x == null ? rand(0, W) : x + rand(-100, 100), y: x == null ? rand(-60, -10) : H * 0.4, vx: rand(-160, 160), vy: x == null ? rand(40, 180) : rand(-520, -200), rot: rand(0, TAU), vr: rand(-8, 8), life: 2.6, max: 2.6, c: cols[i % cols.length], r: rand(4, 7) });
      }
    },
    rocket: launchEgg,
    balloonX: () => BX
  };
})();
