/* Brain Rocket — the dive world for Submarine mode (same API as Scene). */
'use strict';

const SubScene = (function () {
  const W = 1600, H = 900;
  const K = 3;            // screen pixels per point of depth
  const SX = 560;         // submarine x
  const SY = 300;         // submarine y (high on screen so you can see what's coming)
  const TAU = Math.PI * 2;

  let canvas, ctx, pxScale = 1;
  const st = {
    cam: 0, target: 0, vel: 0, t: 0, thrust: 0, ignite: 0, dead: false, deadT: 0,
    shake: 0, streak: 0, kick: 0, prop: 0, emitB: 0, flash: 0
  };
  const parts = [];   // bubbles, debris, sparks (world-anchored)
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
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; };
  const wrapX = (x, m = 260) => { const span = W + m * 2; return ((((x + m) % span) + span) % span) - m; };
  const sy = d => SY + (d - st.cam - 8) * K;   // depth -> screen y (the sub sits 8 below the camera)

  // Past the centre of the Earth the world mirrors back out, so every depth maps to 0..7000.
  function mirror(d) {
    if (d <= 7000) return Math.max(0, d);
    const x = ((d - 7000) * 3.5) % 14000;
    return x <= 7000 ? 7000 - x : x - 7000;
  }

  // ---- Colours by depth ----------------------------------------------
  const WATER = [
    [0,    '#4fc3e8', '#2a9fd0'],
    [60,   '#2a9fd0', '#1677b8'],
    [150,  '#0f4f8f', '#0a3a73'],
    [400,  '#061f45', '#04152f'],
    [1000, '#020a1c', '#01060f'],
    [1699, '#01050c', '#010308'],
    [1700, '#5a3e2b', '#4a3222'],
    [2600, '#4a2c1c', '#5e2e16'],
    [2700, '#7a2e12', '#a33d12'],
    [3500, '#b8431a', '#d4561c'],
    [4500, '#e07a1f', '#f0a030'],
    [5600, '#ffd36b', '#fff0b0'],
    [7000, '#fff7e0', '#ffffff']
  ];
  function colorsAt(m) {
    let i = 0;
    while (i < WATER.length - 2 && m > WATER[i + 1][0]) i++;
    const a = WATER[i], b = WATER[i + 1];
    const t = clamp((m - a[0]) / (b[0] - a[0]), 0, 1);
    return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
  }
  const inRock = m => m >= 1700;
  const darkness = m => (inRock(m) ? (m < 2700 ? 0.55 : 0) : clamp((m - 120) / 400, 0, 1));

  // ---- Decorations ------------------------------------------------------
  const ZONES = [
    { to: 150,  d: 1.4, types: { fish: 5, jelly: 1.2, turtle: 0.8, dolphin: 0.6, ray: 0.6, bubbles: 1 } },
    { to: 400,  d: 1.2, types: { fish: 1.5, squid: 1.5, lantern: 2, jelly: 1.5, shark: 1, swordfish: 0.6 } },
    { to: 1000, d: 1.1, types: { angler: 2, lantern: 2, jelly: 1.5, eel: 1, squid: 1, octopus: 0.6 } },
    { to: 1700, d: 1.0, types: { octopus: 1.2, cucumber: 1.5, snailfish: 1.5, angler: 0.8, amphipod: 1.5, jelly: 0.8 } },
    { to: 2700, d: 1.4, types: { fossil: 2, bone: 1.5, crystal: 1.5, nugget: 1.2, chest: 0.3, pocket: 0.8 } },
    { to: 4500, d: 1.6, types: { magma: 3, diamond: 1, crystal: 0.8, pocket: 1.5 } },
    { to: 5600, d: 1.6, types: { swirl: 3, droplet: 2 } },
    { to: 1e9,  d: 1.4, types: { ironcrystal: 2, droplet: 1.5, swirl: 1 } }
  ];
  const zoneAt = m => ZONES.find(z => m < z.to);

  const CHUNK = 100;
  const chunkCache = new Map();
  function chunk(ci) {
    if (chunkCache.has(ci)) return chunkCache.get(ci);
    if (chunkCache.size > 260) chunkCache.clear();
    const rng = mulberry32(ci * 6151 + 29);
    const zone = zoneAt(mirror(ci * CHUNK + 50));
    const out = [];
    const n = Math.floor(zone.d + rng() * 1.2);
    const pairs = Object.entries(zone.types);
    const total = pairs.reduce((s, p) => s + p[1], 0);
    for (let i = 0; i < n; i++) {
      const d = ci * CHUNK + rng() * CHUNK;
      if (d < 20) continue;
      let r = rng() * total, type = pairs[0][0];
      for (const [t, w] of pairs) { if ((r -= w) <= 0) { type = t; break; } }
      out.push({
        type, d, x: rng() * W, s: 0.7 + rng() * 0.6, seed: rng() * 1000, hue: Math.floor(rng() * 360),
        vx: (rng() < 0.5 ? -1 : 1) * (12 + rng() * 40), n: 4 + Math.floor(rng() * 6), rot: (rng() - 0.5)
      });
    }
    chunkCache.set(ci, out);
    return out;
  }

  function fishShape(len, h, color, dir) {
    ctx.save(); ctx.scale(dir, 1);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, len, h, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-len * 0.8, 0); ctx.lineTo(-len * 1.6, -h * 1.1); ctx.lineTo(-len * 1.6, h * 1.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(len * 0.55, -h * 0.2, Math.max(1.2, h * 0.28), 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(len * 0.6, -h * 0.2, Math.max(0.7, h * 0.14), 0, TAU); ctx.fill();
    ctx.restore();
  }
  function glowDot(x, y, r, color, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }

  function drawObj(o, x, y) {
    const t = st.t, s = o.s, dir = Math.sign(o.vx) || 1;
    ctx.save(); ctx.translate(x, y);
    switch (o.type) {
      case 'fish':
        for (let i = 0; i < o.n; i++) {
          const fx0 = -dir * i * 26 + Math.sin(i * 7.3) * 14, fy = Math.sin(i * 3.1) * 26 + Math.sin(t * 2 + i) * 4;
          ctx.save(); ctx.translate(fx0, fy);
          fishShape(10 * s, 5 * s, `hsl(${(o.hue + i * 8) % 360},85%,60%)`, dir);
          ctx.restore();
        }
        break;
      case 'jelly': {
        const pulse = 1 + 0.12 * Math.sin(t * 2.5 + o.seed);
        ctx.translate(0, Math.sin(t * 0.8 + o.seed) * 10); ctx.scale(s * pulse, s / pulse);
        const hue = o.hue % 2 ? 310 : 190;
        const glow = darkness(mirror(o.d)) > 0.4;
        if (glow) { ctx.globalCompositeOperation = 'lighter'; glowDot(0, 0, 50, `hsla(${hue},100%,70%,0.35)`); }
        ctx.strokeStyle = `hsla(${hue},90%,75%,0.6)`; ctx.lineWidth = 2.5;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath(); ctx.moveTo(-22 + i * 9, 0);
          for (let j = 1; j <= 9; j++) ctx.lineTo(-22 + i * 9 + Math.sin(t * 3 + j * 0.6 + i) * 5, j * 7);
          ctx.stroke();
        }
        ctx.fillStyle = `hsla(${hue},90%,${glow ? 75 : 85}%,0.65)`;
        ctx.beginPath(); ctx.ellipse(0, 0, 28, 24, 0, Math.PI, 0); ctx.fill();
        break;
      }
      case 'turtle': {
        ctx.scale(dir * s, s);
        const f = Math.sin(t * 3 + o.seed) * 0.5;
        ctx.fillStyle = '#7cc47a';
        ctx.save(); ctx.translate(18, 10); ctx.rotate(0.6 + f); ctx.fillRect(0, -4, 26, 8); ctx.restore();
        ctx.save(); ctx.translate(-18, 10); ctx.rotate(2.4 - f); ctx.fillRect(0, -4, 20, 8); ctx.restore();
        ctx.beginPath(); ctx.ellipse(42, -2, 12, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4d8c3e'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 22, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3a6e2e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(-6, 0); ctx.lineTo(-14, 18); ctx.moveTo(14, -18); ctx.lineTo(6, 0); ctx.lineTo(14, 18); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(48, -5, 2, 0, TAU); ctx.fill();
        break;
      }
      case 'dolphin': {
        ctx.scale(dir * s, s); ctx.rotate(Math.sin(t * 2 + o.seed) * 0.12);
        ctx.fillStyle = '#8ea9c4';
        ctx.beginPath(); ctx.moveTo(70, 0); ctx.quadraticCurveTo(40, -24, -30, -14); ctx.quadraticCurveTo(-60, -6, -70, 0); ctx.quadraticCurveTo(-40, 14, 40, 12); ctx.quadraticCurveTo(60, 8, 70, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-14, -36); ctx.lineTo(-18, -14); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-66, 0); ctx.lineTo(-86, -14); ctx.lineTo(-80, 0); ctx.lineTo(-86, 14); ctx.fill();
        ctx.fillStyle = '#c9d8e6'; ctx.beginPath(); ctx.ellipse(10, 6, 34, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(46, -4, 2.5, 0, TAU); ctx.fill();
        break;
      }
      case 'ray': {
        ctx.scale(s, s);
        const f = Math.sin(t * 2 + o.seed) * 10;
        ctx.fillStyle = '#3b4d6b';
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(60, -10 + f, 70, 10 + f); ctx.quadraticCurveTo(20, 10, 0, 30); ctx.quadraticCurveTo(-20, 10, -70, 10 + f); ctx.quadraticCurveTo(-60, -10 + f, 0, -20); ctx.fill();
        ctx.strokeStyle = '#3b4d6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(10 * Math.sin(t), 60, 0, 90); ctx.stroke();
        ctx.fillStyle = '#e8eef7'; ctx.beginPath(); ctx.arc(-8, -6, 2, 0, TAU); ctx.arc(8, -6, 2, 0, TAU); ctx.fill();
        break;
      }
      case 'bubbles':
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
          const by = ((t * 30 + i * 30 + o.seed) % 240) - 120;
          ctx.beginPath(); ctx.arc(Math.sin(i * 2 + t) * 10, -by, 3 + (i % 3) * 2, 0, TAU); ctx.stroke();
        }
        break;
      case 'squid': {
        ctx.scale(s, s); ctx.rotate(dir * 1.4);
        ctx.fillStyle = '#e07a7a';
        ctx.beginPath(); ctx.moveTo(0, -50); ctx.quadraticCurveTo(16, -10, 10, 10); ctx.lineTo(-10, 10); ctx.quadraticCurveTo(-16, -10, 0, -50); ctx.fill();
        ctx.strokeStyle = '#e07a7a'; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 3, 10); ctx.quadraticCurveTo(-8 + i * 3 + Math.sin(t * 4 + i) * 8, 30, -10 + i * 4, 48); ctx.stroke(); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, 2, 3, 0, TAU); ctx.arc(5, 2, 3, 0, TAU); ctx.fill();
        break;
      }
      case 'lantern':
        for (let i = 0; i < Math.min(o.n, 6); i++) {
          const lx = -dir * i * 30, ly = Math.sin(i * 2.7) * 24;
          ctx.save(); ctx.translate(lx, ly);
          fishShape(9 * s, 4 * s, '#1c2a40', dir);
          ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 3; k++) glowDot(dir * (-4 + k * 4) * s, 3 * s, 6, 'rgba(120,220,255,0.9)', 0.6 + 0.4 * Math.sin(t * 3 + i + k));
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
        }
        break;
      case 'shark': {
        ctx.scale(dir * s, s);
        ctx.fillStyle = '#6d7f94';
        ctx.beginPath(); ctx.moveTo(90, 4); ctx.quadraticCurveTo(50, -26, -40, -14); ctx.lineTo(-80, -2); ctx.quadraticCurveTo(-30, 18, 50, 16); ctx.quadraticCurveTo(80, 12, 90, 4); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, -20); ctx.lineTo(-6, -50); ctx.lineTo(-22, -16); ctx.fill();
        const tail = Math.sin(t * 4 + o.seed) * 8;
        ctx.beginPath(); ctx.moveTo(-78, -2); ctx.lineTo(-108, -30 + tail); ctx.lineTo(-96, 0); ctx.lineTo(-104, 22 + tail); ctx.fill();
        ctx.fillStyle = '#dfe6ee'; ctx.beginPath(); ctx.ellipse(30, 10, 40, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(66, -2, 2.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4b5a6b'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(44 - i * 6, -6); ctx.lineTo(42 - i * 6, 4); ctx.stroke(); }
        break;
      }
      case 'swordfish': {
        ctx.scale(dir * s, s);
        fishShape(40, 12, '#4a6ea0', 1);
        ctx.strokeStyle = '#4a6ea0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(38, -2); ctx.lineTo(95, -4); ctx.stroke();
        ctx.fillStyle = '#4a6ea0'; ctx.beginPath(); ctx.moveTo(4, -10); ctx.lineTo(-8, -34); ctx.lineTo(-18, -8); ctx.fill();
        break;
      }
      case 'angler': {
        ctx.scale(dir * s, s);
        ctx.globalCompositeOperation = 'lighter';
        glowDot(46, -40, 40, 'rgba(160,255,220,0.6)', 0.7 + 0.3 * Math.sin(t * 4 + o.seed));
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#3a3f52'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(10, -24); ctx.quadraticCurveTo(30, -60, 46, -40); ctx.stroke();
        ctx.fillStyle = '#e6fff6'; ctx.beginPath(); ctx.arc(46, -40, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a2e3d'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 26, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-52, -16); ctx.lineTo(-52, 16); ctx.fill();
        ctx.fillStyle = '#0c0d14'; ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(8, 6); ctx.lineTo(30, 18); ctx.fill();
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(12 + i * 4, 6 + i * 2); ctx.lineTo(14 + i * 4, 12 + i * 2); ctx.lineTo(16 + i * 4, 6 + i * 2); ctx.fill(); }
        ctx.fillStyle = '#d0ffe8'; ctx.beginPath(); ctx.arc(18, -8, 4, 0, TAU); ctx.fill();
        break;
      }
      case 'eel': {
        ctx.scale(dir * s, s);
        ctx.strokeStyle = '#272b3a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let i = 1; i <= 20; i++) ctx.lineTo(-i * 8, Math.sin(t * 3 - i * 0.5 + o.seed) * 10);
        ctx.stroke();
        ctx.fillStyle = '#272b3a'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(40, -24); ctx.lineTo(44, 20); ctx.lineTo(0, 6); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        glowDot(-160, Math.sin(t * 3 - 10 + o.seed) * 10, 12, 'rgba(255,90,140,0.9)');
        break;
      }
      case 'octopus': {
        ctx.translate(0, Math.sin(t + o.seed) * 10); ctx.scale(s, s);
        ctx.fillStyle = '#f2a0b8';
        const e = Math.sin(t * 3 + o.seed) * 0.4;
        ctx.save(); ctx.translate(-26, -6); ctx.rotate(-0.4 + e); ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, TAU); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(26, -6); ctx.rotate(0.4 - e); ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, TAU); ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.arc(0, 0, 24, Math.PI, 0); ctx.lineTo(24, 14);
        for (let i = 0; i < 6; i++) ctx.quadraticCurveTo(20 - i * 8, 30, 16 - i * 8, 14);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-8, -2, 3, 0, TAU); ctx.arc(8, -2, 3, 0, TAU); ctx.fill();
        break;
      }
      case 'cucumber':
        ctx.rotate(o.rot); ctx.scale(s, s);
        ctx.fillStyle = '#c96a7a'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 11, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8a0aa'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 10, -9, 3, 0, TAU); ctx.fill(); }
        break;
      case 'snailfish':
        ctx.scale(dir * s, s);
        ctx.fillStyle = 'rgba(255,214,224,0.85)';
        ctx.beginPath(); ctx.ellipse(10, 0, 22, 14, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(-40, Math.sin(t * 3 + o.seed) * 8, -60, 0); ctx.quadraticCurveTo(-40, 6, -6, 10); ctx.fill();
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(22, -4, 2.5, 0, TAU); ctx.fill();
        break;
      case 'amphipod':
        ctx.scale(dir * s, s);
        ctx.fillStyle = '#f0e6d2';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-i * 9, Math.sin(i) * 2, 7, 6, 0, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#f0e6d2'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(22, -14); ctx.moveTo(6, 0); ctx.lineTo(24, -6); ctx.stroke();
        break;
      case 'fossil':
        ctx.rotate(o.rot); ctx.scale(s, s);
        ctx.strokeStyle = '#d9c4a0'; ctx.lineWidth = 4;
        ctx.beginPath();
        for (let a = 0; a < 14; a += 0.2) { const r = 2 + a * 2.2; ctx[a ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
        ctx.stroke();
        break;
      case 'bone':
        ctx.rotate(o.rot); ctx.scale(s, s);
        ctx.fillStyle = '#efe4cc';
        ctx.fillRect(-36, -6, 72, 12);
        for (const bx of [-36, 36]) for (const by of [-7, 7]) { ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.fill(); }
        break;
      case 'crystal':
        ctx.rotate(o.rot * 0.5); ctx.scale(s, s);
        ctx.globalCompositeOperation = 'lighter';
        [[0, 0, 1, 0], [-16, 8, 0.6, -0.4], [16, 8, 0.7, 0.4]].forEach(([cx, cy, k, r], i) => {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(r);
          ctx.fillStyle = `hsla(${(o.hue + i * 30) % 360},80%,65%,0.7)`;
          ctx.beginPath(); ctx.moveTo(0, -40 * k); ctx.lineTo(10 * k, -10 * k); ctx.lineTo(8 * k, 14 * k); ctx.lineTo(-8 * k, 14 * k); ctx.lineTo(-10 * k, -10 * k); ctx.closePath(); ctx.fill();
          ctx.restore();
        });
        break;
      case 'nugget':
        ctx.scale(s, s);
        ctx.fillStyle = '#e8b53a'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 10, o.rot, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(-4, -3, 3, 0, TAU); ctx.fill();
        break;
      case 'chest':
        ctx.scale(s, s);
        ctx.fillStyle = '#7a4a22'; ctx.fillRect(-30, -10, 60, 30);
        ctx.fillStyle = '#9b6230'; ctx.beginPath(); ctx.ellipse(0, -10, 30, 14, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#e8b53a'; ctx.fillRect(-30, -2, 60, 4); ctx.fillRect(-4, -6, 8, 12);
        ctx.globalCompositeOperation = 'lighter'; glowDot(0, -14, 40, 'rgba(255,220,100,0.5)', 0.5 + 0.3 * Math.sin(t * 3));
        break;
      case 'pocket': {
        ctx.globalCompositeOperation = 'lighter';
        const r = 40 * s * (1 + 0.1 * Math.sin(t + o.seed));
        glowDot(0, 0, r * 2, 'rgba(255,120,30,0.5)');
        ctx.fillStyle = 'rgba(255,90,20,0.7)'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, o.rot, 0, TAU); ctx.fill();
        break;
      }
      case 'magma': {
        ctx.globalCompositeOperation = 'lighter';
        const r = 30 * s;
        ctx.translate(0, Math.sin(t * 0.7 + o.seed) * 12);
        glowDot(0, 0, r * 2.4, 'rgba(255,170,60,0.55)');
        ctx.fillStyle = 'rgba(255,210,120,0.8)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.fill();
        break;
      }
      case 'diamond':
        ctx.rotate(t * 0.5 + o.seed); ctx.scale(s, s);
        ctx.fillStyle = 'rgba(220,250,255,0.9)';
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(16, -6); ctx.lineTo(0, 22); ctx.lineTo(-16, -6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(120,200,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(16, -6); ctx.stroke();
        break;
      case 'swirl':
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `hsla(${30 + (o.hue % 30)},100%,70%,0.35)`; ctx.lineWidth = 8;
        ctx.beginPath();
        for (let a = 0; a < 10; a += 0.2) { const r = a * 9 * s; ctx[a ? 'lineTo' : 'moveTo'](Math.cos(a + t * 0.6) * r, Math.sin(a + t * 0.6) * r * 0.6); }
        ctx.stroke();
        break;
      case 'droplet':
        ctx.globalCompositeOperation = 'lighter';
        glowDot(0, Math.sin(t + o.seed) * 14, 26 * s, 'rgba(255,240,180,0.7)');
        break;
      case 'ironcrystal':
        ctx.rotate(o.rot + t * 0.1); ctx.scale(s, s);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,240,0.6)';
        for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillRect(-4, 0, 8, 44); }
        break;
    }
    ctx.restore();
  }

  function drawDecor() {
    const c0 = Math.floor((st.cam - 140) / CHUNK), c1 = Math.floor((st.cam + 320) / CHUNK);
    for (let ci = c0; ci <= c1; ci++) {
      if (ci < 0) continue;
      for (const o of chunk(ci)) {
        const y = sy(o.d);
        if (y < -200 || y > H + 200) continue;
        drawObj(o, wrapX(o.x + o.vx * st.t, 300), y);
      }
    }
  }

  // ---- Big features at the stops ---------------------------------------
  const FEATURE = {
    reef(y) {
      for (const side of [0, 1]) {
        const x0 = side ? W - 40 : 40;
        for (let i = 0; i < 9; i++) {
          const cx = side ? x0 - i * 34 : x0 + i * 34, base = y + 160 - Math.abs(Math.sin(i * 1.7)) * 120;
          const hue = [10, 330, 280, 40, 190][i % 5];
          ctx.fillStyle = `hsl(${hue},75%,58%)`;
          if (i % 3 === 0) {
            ctx.beginPath(); ctx.arc(cx, base, 26, Math.PI, 0); ctx.fill();
          } else if (i % 3 === 1) {
            ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 7; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx, base + 30); ctx.lineTo(cx, base - 40);
            ctx.moveTo(cx, base - 10); ctx.lineTo(cx - 18, base - 34); ctx.moveTo(cx, base); ctx.lineTo(cx + 16, base - 26); ctx.stroke();
          } else {
            for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cx + Math.sin(st.t * 1.5 + k) * 3, base - k * 14, 10, 18, Math.sin(st.t + k) * 0.2, 0, TAU); ctx.fill(); }
          }
        }
        ctx.fillStyle = '#d9c28a';
        ctx.beginPath(); ctx.ellipse(side ? W - 120 : 120, y + 230, 300, 80, 0, Math.PI, 0); ctx.fill();
      }
      // a few clownfish
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.translate(150 + i * 40 + Math.sin(st.t * 2 + i) * 20, y + 40 + i * 18);
        fishShape(12, 7, '#ff8a2a', i % 2 ? 1 : -1); ctx.restore();
      }
    },
    diver(y) {
      const x = 240 + Math.sin(st.t * 0.5) * 30;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3 + Math.sin(st.t) * 0.05);
      ctx.fillStyle = '#222'; ctx.fillRect(-40, -8, 70, 18);
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(-30, -20, 44, 12);
      const k = Math.sin(st.t * 4) * 8;
      ctx.fillStyle = '#222'; ctx.fillRect(-70, -4 + k, 32, 6); ctx.fillRect(-70, 6 - k, 32, 6);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-70, -6 + k); ctx.lineTo(-96, -14 + k); ctx.lineTo(-96, 4 + k); ctx.fill();
      ctx.fillStyle = '#ffd7a8'; ctx.beginPath(); ctx.arc(40, 0, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(140,220,255,0.8)'; ctx.fillRect(40, -7, 12, 8);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { const by = (st.t * 40 + i * 30) % 150; ctx.beginPath(); ctx.arc(x + 46 + Math.sin(i + st.t) * 4, y - by, 3 + i % 2, 0, TAU); ctx.stroke(); }
    },
    spermwhale(y) {
      const x = 260 + Math.sin(st.t * 0.3) * 40;
      ctx.save(); ctx.translate(x, y); ctx.scale(1.4, 1.4);
      ctx.fillStyle = '#4b5566';
      ctx.beginPath(); ctx.moveTo(110, -30); ctx.lineTo(110, 22); ctx.quadraticCurveTo(40, 34, -40, 18); ctx.quadraticCurveTo(-100, 6, -130, 0);
      const tl = Math.sin(st.t * 1.4) * 12;
      ctx.lineTo(-160, -24 + tl); ctx.lineTo(-150, 0); ctx.lineTo(-160, 24 + tl); ctx.lineTo(-130, 4); ctx.quadraticCurveTo(-60, -40, 20, -38); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e9edf2'; ctx.beginPath(); ctx.arc(70, -8, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#363e4b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(110, 16); ctx.lineTo(40, 22); ctx.stroke();
      ctx.restore();
    },
    vents(y) {
      for (let i = 0; i < 3; i++) {
        const x = 90 + i * 110, top = y - 60 + i * 30;
        ctx.fillStyle = '#2b2522';
        ctx.beginPath(); ctx.moveTo(x - 40, y + 300); ctx.lineTo(x - 14, top); ctx.lineTo(x + 14, top); ctx.lineTo(x + 40, y + 300); ctx.fill();
        for (let k = 0; k < 7; k++) {
          const p = (st.t * 0.6 + k / 7 + i * 0.3) % 1;
          ctx.fillStyle = `rgba(30,25,25,${0.6 * (1 - p)})`;
          ctx.beginPath(); ctx.arc(x + Math.sin(p * 6 + k) * 18 * p, top - p * 260, 14 + p * 40, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter'; glowDot(x, top, 30, 'rgba(255,120,40,0.5)'); ctx.globalCompositeOperation = 'source-over';
        for (let k = 0; k < 5; k++) {
          const wx = x - 30 + k * 14, wy = y + 120 - Math.abs(Math.sin(k)) * 20;
          ctx.fillStyle = '#f2f2f2'; ctx.fillRect(wx - 2, wy, 5, 60);
          ctx.fillStyle = '#e8303f'; ctx.beginPath(); ctx.arc(wx + 0.5, wy, 6 + Math.sin(st.t * 3 + k), 0, TAU); ctx.fill();
        }
      }
    },
    titanic(y) {
      ctx.save(); ctx.translate(80, y); ctx.rotate(-0.12);
      ctx.fillStyle = '#3d2a20';
      ctx.beginPath(); ctx.moveTo(-200, 60); ctx.lineTo(330, 60); ctx.lineTo(380, -40); ctx.lineTo(-200, -40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5c3a26'; ctx.fillRect(-200, -40, 560, 14);
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-120, -40, 300, -36);
      ctx.fillStyle = '#6b2f1a'; ctx.beginPath(); ctx.moveTo(40, -76); ctx.lineTo(90, -76); ctx.lineTo(84, -150); ctx.lineTo(46, -150); ctx.fill();
      ctx.fillStyle = '#1b1210'; ctx.fillRect(46, -150, 38, 12);
      ctx.fillStyle = '#e8c27a';
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(-160 + i * 40, 0, 5, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(200,120,60,0.5)'; ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-180 + i * 60, -26); ctx.lineTo(-176 + i * 60, 20 + (i % 3) * 10); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '600 18px Fredoka, sans-serif'; ctx.fillText('R.M.S. TITANIC', 130, y + 100);
    },
    seabed(y) {
      ctx.fillStyle = '#3a3a3e';
      ctx.beginPath(); ctx.moveTo(-20, y);
      for (let x = -20; x <= W + 40; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.02) * 8);
      ctx.lineTo(W + 40, y + 60); ctx.lineTo(-20, y + 60); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '600 20px Fredoka, sans-serif';
      ctx.fillText('📍 10,935 m — the deepest point in the ocean', 960, y - 16);
    },
    borehole(y) {
      ctx.fillStyle = '#9aa0aa'; ctx.fillRect(196, y - 2000, 10, 2000);
      ctx.fillStyle = '#c7ccd4'; ctx.beginPath(); ctx.moveTo(190, y); ctx.lineTo(212, y); ctx.lineTo(201, y + 24); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '600 18px Fredoka, sans-serif'; ctx.fillText('Kola Superdeep Borehole · 12,262 m', 226, y + 10);
    },
    diamonds(y) {
      for (let i = 0; i < 9; i++) {
        const x = 120 + i * 90 + Math.sin(i * 3) * 30, yy = y + Math.sin(i * 2.3) * 80;
        ctx.save(); ctx.translate(x, yy); ctx.rotate(st.t * 0.4 + i);
        ctx.globalCompositeOperation = 'lighter'; glowDot(0, 0, 40, 'rgba(200,240,255,0.6)'); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(235,252,255,0.95)';
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(18, -6); ctx.lineTo(0, 24); ctx.lineTo(-18, -6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    },
    centre(y) {
      ctx.globalCompositeOperation = 'lighter';
      const r = 260 + Math.sin(st.t * 2) * 20;
      glowDot(W / 2 - 200, y, r * 2, 'rgba(255,255,255,0.9)');
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12 + st.t * 0.2;
        ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(W / 2 - 200 + Math.cos(a) * 60, y + Math.sin(a) * 60); ctx.lineTo(W / 2 - 200 + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  function drawFeatures() {
    for (const m of DEPTHS) {
      if (!m.body) continue;
      const y = sy(m.alt);
      if (y < -500 || y > H + 400) continue;
      FEATURE[m.body](y);
    }
  }

  // Trench walls close in through the hadal zone.
  function drawTrench() {
    const ys = [];
    for (let y = -20; y <= H + 20; y += 20) {
      const d = st.cam + 8 + (y - SY) / K;
      const m = mirror(d);
      const w = m > 1000 && m < 1700 ? Math.pow((m - 1000) / 700, 0.8) * 360 : 0;
      ys.push([y, w, d]);
    }
    if (!ys.some(p => p[1] > 0)) return;
    for (const side of [0, 1]) {
      ctx.fillStyle = '#0c1018';
      ctx.beginPath(); ctx.moveTo(side ? W + 20 : -20, -20);
      for (const [y, w, d] of ys) { const j = Math.sin(d * 0.3 + side * 2) * 12; ctx.lineTo(side ? W - w - j : w + j, y); }
      ctx.lineTo(side ? W + 20 : -20, H + 20); ctx.fill();
    }
  }

  // Rock strata lines underground.
  function drawStrata(m) {
    if (!inRock(m) || m > 2700) return;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3;
    const off = ((st.cam * K) % 60 + 60) % 60;
    for (let y = -off; y < H + 60; y += 60) {
      ctx.beginPath(); ctx.moveTo(-20, y);
      for (let x = 0; x <= W + 40; x += 80) ctx.lineTo(x, y + Math.sin(x * 0.01 + y * 0.05) * 10);
      ctx.stroke();
    }
  }

  // ---- Surface and sky ---------------------------------------------------
  function drawSurface() {
    const yS = sy(0);
    if (yS < -40) return;
    const g = ctx.createLinearGradient(0, yS - 500, 0, yS);
    g.addColorStop(0, '#5fb4ff'); g.addColorStop(1, '#cfeeff');
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, yS + 30);
    // sun and clouds
    ctx.fillStyle = 'rgba(255,248,210,0.95)'; ctx.beginPath(); ctx.arc(1300, yS - 230, 50, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [cx, cy, s] of [[200, 170, 1], [820, 110, 0.8], [1460, 150, 0.9]]) {
      const x = wrapX(cx + st.t * 12 * s, 200), y = yS - 330 + cy;
      [[0, 0, 34], [36, 6, 28], [-34, 8, 26], [10, -18, 26]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill(); });
    }
    // a little boat and a gull
    const bx = 1150;
    ctx.fillStyle = '#e8364f'; ctx.beginPath(); ctx.moveTo(bx - 60, yS - 18); ctx.lineTo(bx + 60, yS - 18); ctx.lineTo(bx + 40, yS + 6); ctx.lineTo(bx - 40, yS + 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 4, yS - 90, 4, 72);
    ctx.beginPath(); ctx.moveTo(bx + 2, yS - 88); ctx.lineTo(bx + 50, yS - 24); ctx.lineTo(bx + 2, yS - 24); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5;
    const gx = wrapX(400 + st.t * 40), gy = yS - 200, f = Math.sin(st.t * 8) * 6;
    ctx.beginPath(); ctx.moveTo(gx - 12, gy - f); ctx.quadraticCurveTo(gx - 5, gy - 6, gx, gy); ctx.quadraticCurveTo(gx + 5, gy - 6, gx + 12, gy - f); ctx.stroke();
    // waves
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(-20, yS + 10);
    for (let x = -20; x <= W + 40; x += 20) ctx.lineTo(x, yS + Math.sin(x * 0.03 + st.t * 2) * 5);
    ctx.lineTo(W + 40, yS + 10); ctx.fill();
  }

  function drawRays(m) {
    const a = clamp(1 - m / 160, 0, 1);
    if (a <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = 100 + i * 230 + Math.sin(st.t * 0.3 + i) * 40;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(255,255,255,${0.12 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 250, H); ctx.lineTo(x + 100, H); ctx.fill();
    }
    ctx.restore();
  }

  // Marine snow / rock grit drifting past.
  const snowTiles = new Map();
  function drawSnow(m) {
    const a = inRock(m) ? 0.35 : clamp((m - 100) / 300, 0, 0.8);
    if (a <= 0) return;
    const color = inRock(m) ? (m > 2700 ? '#ffd27a' : '#c9b597') : '#ffffff';
    const s = st.cam * K;
    const i0 = Math.floor((s - SY) / H) - 1, i1 = i0 + 2;
    ctx.fillStyle = color;
    for (let i = i0; i <= i1; i++) {
      if (!snowTiles.has(i)) {
        if (snowTiles.size > 20) snowTiles.clear();
        const r = mulberry32(i * 97 + 3);
        snowTiles.set(i, Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * H, r: 0.8 + r() * 1.8, ph: r() * TAU })));
      }
      for (const p of snowTiles.get(i)) {
        const y = p.y + i * H - s + SY;
        if (y < -5 || y > H + 5) continue;
        ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(st.t + p.ph));
        ctx.beginPath(); ctx.arc(p.x + Math.sin(st.t * 0.5 + p.ph) * 6, y, p.r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Submarine -------------------------------------------------------------
  const HULLS = ['#ffd23f', '#ffb52e', '#4fd1ff', '#c77dff'];
  const hullColor = () => HULLS[st.streak >= 8 ? 3 : st.streak >= 5 ? 2 : st.streak >= 3 ? 1 : 0];

  function subPose() {
    let x = SX, y = SY, tilt = 0;
    x += Math.sin(st.t * 1.1) * 6;
    y += Math.sin(st.t * 1.7) * 6;
    tilt = Math.sin(st.t * 1.3) * 0.03 + clamp(st.vel / 1500, 0, 0.35);
    if (st.dead) { tilt = Math.sin(st.t * 2) * 0.05; y += -Math.min(st.deadT * 15, 40); }
    return { x, y, tilt };
  }

  function drawSub(m) {
    const p = subPose();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt);
    const dark = darkness(m);
    // headlight
    if (dark > 0.05 && !st.dead) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(110, 0, 520, 0);
      g.addColorStop(0, `rgba(255,250,200,${0.45 * dark})`); g.addColorStop(1, 'rgba(255,250,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(112, -6); ctx.lineTo(520, -110); ctx.lineTo(520, 150); ctx.lineTo(112, 10); ctx.fill();
      ctx.restore();
    }
    const hull = hullColor();
    // tail fins and propeller
    ctx.fillStyle = '#e8364f';
    ctx.beginPath(); ctx.moveTo(-100, -6); ctx.lineTo(-132, -40); ctx.lineTo(-118, -6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-100, 6); ctx.lineTo(-132, 40); ctx.lineTo(-118, 6); ctx.fill();
    ctx.fillStyle = '#6e7586'; ctx.fillRect(-140, -5, 30, 10);
    const pw = Math.abs(Math.sin(st.prop)) * 26 + 3;
    ctx.fillStyle = '#c8ccd6';
    ctx.beginPath(); ctx.ellipse(-142, -14, 5, pw * 0.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-142, 14, 5, (29 - pw) * 0.5 + 2, 0, 0, TAU); ctx.fill();
    // body
    const bg = ctx.createLinearGradient(0, -46, 0, 46);
    bg.addColorStop(0, '#fff3b8'); bg.addColorStop(0.35, hull); bg.addColorStop(1, '#c47a00');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, 0, 120, 46, 0, 0, TAU); ctx.fill();
    // conning tower + periscope
    ctx.fillStyle = hull; ctx.fillRect(-36, -76, 62, 40);
    ctx.beginPath(); ctx.ellipse(-5, -76, 31, 9, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#7b8499'; ctx.fillRect(4, -116, 7, 42); ctx.fillRect(4, -116, 24, 7);
    // drill when underground
    if (inRock(m) && !st.dead) {
      ctx.save(); ctx.translate(112, 0);
      ctx.fillStyle = '#9aa3b8';
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(70, 0); ctx.lineTo(0, 30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5c6478'; ctx.lineWidth = 4;
      const sp = (st.t * 400) % 20;
      for (let i = -1; i < 4; i++) { const x = i * 20 + sp; ctx.beginPath(); ctx.moveTo(x, -30 + x * 0.43); ctx.lineTo(x + 10, 30 - (x + 10) * 0.43); ctx.stroke(); }
      ctx.restore();
    } else {
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(116, 0, 7, 0, TAU); ctx.fill();
    }
    // portholes with the pilot in the front one
    [[-60, 0], [-12, 0], [40, 2]].forEach(([wx, wy], i) => {
      ctx.fillStyle = '#7b8499'; ctx.beginPath(); ctx.arc(wx, wy, 16, 0, TAU); ctx.fill();
      const wg = ctx.createRadialGradient(wx - 4, wy - 4, 2, wx, wy, 12);
      wg.addColorStop(0, '#9fe0ff'); wg.addColorStop(1, '#1d4fa0');
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(wx, wy, 12, 0, TAU); ctx.fill();
      if (i === 2) {
        ctx.fillStyle = '#ffd7a8'; ctx.beginPath(); ctx.arc(wx, wy + 3, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(wx - 2, wy + 2, 1, 0, TAU); ctx.arc(wx + 2, wy + 2, 1, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(wx, wy + 4, 2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(wx - 5, wy - 5, 3, 2, -0.6, 0, TAU); ctx.fill();
    });
    // rivets
    ctx.fillStyle = 'rgba(120,80,0,0.5)';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-90 + i * 22, 30, 2, 0, TAU); ctx.fill(); }
    // running lights
    if (!st.dead || Math.sin(st.t * 8) > 0) {
      ctx.fillStyle = Math.sin(st.t * 3) > 0 ? '#ff4a4a' : '#5a2020';
      ctx.beginPath(); ctx.arc(-30, -80, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---- Particles ---------------------------------------------------------
  function emit(dt, m) {
    const p = subPose();
    const tailX = p.x - 150 * Math.cos(p.tilt), tailY = p.y - 150 * Math.sin(p.tilt);
    const rate = (st.dead ? 2 : 6 + st.thrust * 50 + st.ignite * 30);
    st.emitB += rate * dt;
    while (st.emitB >= 1) {
      st.emitB--;
      const rock = inRock(m);
      parts.push(rock
        ? { k: 'debris', x: p.x + 160 + rand(-20, 20), y: p.y + rand(-30, 30), vx: rand(-200, -40), vy: rand(-140, 140), life: rand(0.5, 1), max: 1, size: rand(2, 6), color: m > 2700 ? '#ffb347' : '#8a6a4a' }
        : { k: 'bubble', x: tailX + rand(-6, 6), y: tailY + rand(-10, 10), vx: rand(-60, -10), vy: rand(-80, -30), life: rand(1.2, 2.4), max: 2.4, size: rand(2, 7) });
    }
  }

  function update(dt) {
    st.t += dt;
    const prev = st.cam;
    if (!st.dead) {
      st.cam += (st.target - st.cam) * (1 - Math.exp(-dt * 2.4));
      if (Math.abs(st.target - st.cam) < 0.02) st.cam = st.target;
    } else st.deadT += dt;
    const dy = (st.cam - prev) * K;
    st.vel = dt > 0 ? dy / dt : 0;
    st.kick = Math.max(0, st.kick - dt * 1.2);
    st.thrust += ((st.dead ? 0 : 0.3 + clamp(st.vel / 600, 0, 1.2) + st.kick * 0.6 + st.ignite) - st.thrust) * Math.min(1, dt * 6);
    st.prop += dt * (st.dead ? 0.5 : 4 + st.thrust * 30);
    st.shake = Math.max(0, st.shake - dt * 2.5);
    st.flash = Math.max(0, st.flash - dt * 2);

    const m = mirror(st.cam);
    emit(dt, m);
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt - dy;
      if (q.k === 'bubble') { q.vx *= 0.97; q.x += Math.sin(st.t * 4 + q.size) * 0.4; }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.k === 'confetti') { f.vy += 200 * dt; f.vx *= 0.99; f.rot += f.vr * dt; }
    }
    const lineV = Math.max(st.vel, st.kick * 900);
    if (lineV > 250) {
      for (let i = 0; i < Math.min(6, lineV / 300); i++) {
        if (Math.random() < 0.5) lines.push({ x: rand(0, W), y: rand(0, H + 200), len: 80 + lineV * 0.12, w: rand(1, 3), a: clamp(lineV / 2500, 0.08, 0.45), life: 0.6 });
      }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      l.y -= dy * 1.8 + 300 * dt; l.life -= dt;
      if (l.life <= 0 || l.y + l.len < 0) lines.splice(i, 1);
    }
    if (onMilestone) for (const s of DEPTHS) if (s.alt > 0 && prev < s.alt && st.cam >= s.alt) onMilestone(s);
  }

  function draw() {
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    if (st.shake) ctx.translate((Math.random() - 0.5) * st.shake * 16, (Math.random() - 0.5) * st.shake * 16);
    const m = mirror(st.cam);
    const [top, bot] = colorsAt(m);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);

    drawStrata(m);
    drawRays(m);
    drawSnow(m);
    drawTrench();
    drawFeatures();
    drawDecor();
    drawSurface();

    // bubbles and debris
    for (const q of parts) {
      const a = q.life / q.max;
      if (q.k === 'bubble') {
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * a})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.stroke();
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = q.color;
        ctx.fillRect(q.x, q.y, q.size, q.size); ctx.globalAlpha = 1;
      }
    }
    if (lines.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const l of lines) {
        const lg = ctx.createLinearGradient(0, l.y, 0, l.y + l.len);
        lg.addColorStop(0, `rgba(255,255,255,${l.a})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = lg; ctx.fillRect(l.x, l.y, l.w, l.len);
      }
      ctx.restore();
    }
    drawSub(m);

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
      st.streak = 0; st.kick = 0;
      parts.length = 0; fx.length = 0; lines.length = 0;
    },
    get alt() { return st.cam; },
    setIgnite(v) { st.ignite = v; },
    setStreak(n) { st.streak = n; },
    boostTo(d, power) {
      st.target = d;
      st.ignite = 0;
      st.kick = Math.min(1.2, 0.5 + power * 0.15);
      st.shake = Math.max(st.shake, 0.2 + power * 0.1);
      if (power >= 4) st.flash = 0.5;
      const p = subPose();
      fx.push({ k: 'ring', x: p.x, y: p.y, r: 140 + power * 40, life: 0.7, max: 0.7, vx: 0, vy: 0, color: '#bff4ff' });
    },
    sputter() { st.shake = 0.4; },
    die() { st.dead = true; st.deadT = 0; },
    confetti(n = 160) {
      const cols = ['#ff5d73', '#ffd23f', '#4fd1ff', '#7ddc6f', '#b04dff', '#ff9a3c'];
      for (let i = 0; i < n; i++) {
        fx.push({ k: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-80, 80), vy: rand(60, 220), rot: rand(0, TAU), vr: rand(-6, 6), w: rand(8, 14), h: rand(10, 18), life: rand(2.5, 4), color: cols[i % cols.length] });
      }
    },
    burst(x, y, color, n = 30) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), sp = rand(80, 300);
        parts.push({ k: 'bubble', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rand(0.6, 1.2), max: 1.2, size: rand(2, 6) });
      }
    },
    rocketScreen() { const p = subPose(); return { x: p.x, y: p.y - 40 }; },
    onMilestone(fn) { onMilestone = fn; }
  };
})();
