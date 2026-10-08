/* Brain Rocket — the Elevator world: a glass elevator climbing a tower that never ends, with
   rooms on every floor that get stranger the higher you go (same API as the other scenes).
   The building reacts to the elevator's power: lights dim and flicker, emergency lights spin,
   people pull out torches, sparks fly and the floor numbers glitch. */
'use strict';

const ElevScene = (function () {
  const W = 1600, H = 900;
  const K = 3;              // screen pixels per point
  const CX = 580;           // shaft centre
  const SY = 470;           // elevator car centre
  const BAND = 60;          // points per floor band on screen
  const FH = BAND * K;      // 180px per floor band
  const BL = 150, BR = 1010; // building edges
  const SH = 70;            // half the shaft width
  const TAU = Math.PI * 2;

  let canvas, ctx, pxScale = 1;
  const st = {
    cam: 0, target: 0, vel: 0, t: 0, dead: false, deadT: 0, shake: 0, streak: 0, flash: 0, kick: 0,
    ignite: 0, power: 1, flick: 1, flickT: 0, crash: null
  };
  const parts = [];
  const fx = [];
  let onMilestone = null;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixc = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; };
  const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const poly = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };

  const stopAt = a => { let s = ELEV_STOPS[0]; for (const x of ELEV_STOPS) if (a >= x.alt) s = x; return s; };
  // floor number at a point, like the HUD counter (grows faster and faster up the tower)
  function floorAt(a) {
    const M = ELEV_STOPS;
    if (a <= 0) return 1;
    for (let i = 0; i < M.length - 1; i++) {
      const s = M[i], e = M[i + 1];
      if (a <= e.alt) return Math.exp(Math.log(s.km) + (Math.log(e.km) - Math.log(s.km)) * (a - s.alt) / (e.alt - s.alt));
    }
    const L = M[M.length - 1];
    return L.km * Math.exp((a - L.alt) / 2500);
  }
  const slabY = b => SY + 75 + (st.cam - b * BAND) * K;   // bottom of floor band b
  const dim = () => (st.dead ? 0.2 : st.power) * st.flick;  // how lit the building is

  // ---- Sky outside the tower -----------------------------------------------
  const SKY = [
    [0, '#6fc0ff', '#d6f0ff'], [3000, '#8fb8f0', '#f4f8ff'], [8000, '#3c4fa8', '#9db4f0'],
    [14500, '#0b1030', '#2a2f6a'], [21000, '#2a0f3a', '#5a2a7a'], [25000, '#0a2a3a', '#1a5a6a']
  ];
  function skyCols(a) {
    if (a >= 30000) { const h = (a * 0.02 + st.t * 20) % 360; return [`hsl(${h},60%,18%)`, `hsl(${(h + 60) % 360},70%,35%)`]; }
    let i = 0; while (i < SKY.length - 2 && a > SKY[i + 1][0]) i++;
    const s = SKY[i], e = SKY[i + 1], t = clamp((a - s[0]) / (e[0] - s[0]), 0, 1);
    return [mixc(s[1], e[1], t), mixc(s[2], e[2], t)];
  }
  function drawSky() {
    const [top, bot] = skyCols(st.cam);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    rect(-30, -30, W + 60, H + 60, g);
    const a = st.cam;
    // stars from the edge of space up
    const starA = clamp((a - 9000) / 4000, 0, 1);
    if (starA > 0) {
      ctx.fillStyle = `rgba(255,255,255,${starA})`;
      for (let i = 0; i < 120; i++) { const y = ((hash(i) * 2000 + a * K * 0.05) % 1000) - 50; ctx.fillRect(hash(i + 9) * W, y, 2, 2); }
    }
    // clouds drifting past lower down
    const cloudA = clamp(1 - Math.abs(a - 2500) / 3000, 0, 1);
    if (cloudA > 0) {
      for (let i = 0; i < 8; i++) {
        const x = ((hash(i) * 2200 + st.t * (10 + i * 3)) % (W + 400)) - 200;
        const y = ((hash(i + 4) * 1800 + a * K * 0.3) % 1100) - 100;
        for (const [dx, dy, r] of [[0, 0, 50], [50, 10, 40], [-46, 12, 38], [16, -26, 38]]) blob(x + dx, y + dy, r, `rgba(255,255,255,${0.85 * cloudA})`);
      }
    }
    // crazy things floating by out in space
    if (a > 14000) {
      const kinds = a > 25000 ? ['duck', 'duck', 'planet'] : a > 21000 ? ['candy', 'planet', 'candy'] : ['planet', 'astro', 'planet'];
      for (let i = 0; i < 6; i++) {
        const x = ((hash(i + 20) * 2600 + st.t * (14 + i * 4)) % (W + 300)) - 150;
        const y = ((hash(i + 30) * 2400 + a * K * 0.2) % 1100) - 100;
        const k = kinds[i % kinds.length], s = 0.6 + hash(i + 40) * 0.8;
        if (k === 'planet') { blob(x, y, 40 * s, `hsl(${(i * 70 + a * 0.01) % 360},60%,55%)`); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 64 * s, 14 * s, -0.3, 0, TAU); ctx.stroke(); }
        if (k === 'candy') { blob(x, y, 34 * s, `hsl(${(i * 50) % 360},80%,70%)`); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(x, y, 22 * s, 0, 4); ctx.stroke(); }
        if (k === 'duck') drawDuck(x, y, s * 1.3, i);
        if (k === 'astro') drawPerson(x, y, s, '#f4f4f8', true, i);
      }
    }
  }

  // ---- Little people and things --------------------------------------------
  function drawPerson(x, y, s, shirt, floaty, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (floaty) ctx.rotate(Math.sin(st.t + seed) * 0.4);
    const wave = Math.sin(st.t * 6 + seed) * 0.6;
    rect(-9, -38, 18, 26, shirt);
    rect(-8, -12, 6, 16, '#3a3d46'); rect(2, -12, 6, 16, '#3a3d46');
    blob(0, -48, 10, '#ffd7a8');
    ctx.strokeStyle = shirt; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, -34); ctx.lineTo(-18, -18); ctx.stroke();
    // waving at the elevator, or holding up a torch when the power is low
    if (dim() < 0.45 && !floaty) {
      ctx.beginPath(); ctx.moveTo(8, -34); ctx.lineTo(20, -36); ctx.stroke();
      rect(18, -40, 12, 7, '#555');
      ctx.fillStyle = 'rgba(255,240,180,0.35)'; ctx.beginPath(); ctx.moveTo(30, -38); ctx.lineTo(110, -70); ctx.lineTo(110, -6); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(8, -34); ctx.lineTo(18 + wave * 4, -52 - wave * 6); ctx.stroke();
    }
    blob(-3.5, -50, 1.4, '#222'); blob(3.5, -50, 1.4, '#222');
    ctx.restore();
  }
  function drawDuck(x, y, s, seed) {
    ctx.save(); ctx.translate(x, y + Math.sin(st.t * 2 + seed) * 4); ctx.scale(s, s);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 18, 0, 0, TAU); ctx.fill();
    blob(18, -18, 13, '#ffd23f'); poly([[28, -20], [42, -16], [28, -12]], '#ff8a1a'); blob(21, -21, 2.4, '#222');
    ctx.restore();
  }
  function drawCat(x, y, s, col, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -12, 18, 12, 0, 0, TAU); ctx.fill();
    blob(16, -24, 10, col); poly([[9, -31], [12, -42], [17, -32]], col); poly([[17, -32], [22, -42], [25, -30]], col);
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16, -14); ctx.quadraticCurveTo(-30, -30 + Math.sin(st.t * 3 + seed) * 8, -24, -40); ctx.stroke();
    blob(13, -26, 1.6, '#222'); blob(20, -26, 1.6, '#222');
    ctx.restore();
  }

  // ---- Rooms --------------------------------------------------------------------
  // Each draws inside its box (x, y = top-left, w, h); `k` is a per-room random seed.
  const ROOMS = {
    lobby(x, y, w, h, k) {
      rect(x, y, w, h, '#efe3c8');
      rect(x, y + h - 14, w, 14, '#b8946a');
      rect(x + w * 0.2, y + h - 64, w * 0.5, 50, '#8a5a3a'); rect(x + w * 0.2, y + h - 70, w * 0.5, 8, '#c9a06a');
      blob(x + w * 0.85, y + h - 46, 22, '#3d8a45'); rect(x + w * 0.85 - 10, y + h - 30, 20, 16, '#b05a2a');
      blob(x + w / 2, y + 22, 14, '#ffe9a0');
      drawPerson(x + w * 0.45, y + h - 64, 1, '#c0392b', false, k);
    },
    cafe(x, y, w, h, k) {
      rect(x, y, w, h, '#f6e4d0');
      rect(x, y + h - 12, w, 12, '#8a6a4a');
      for (let i = 0; i < 2; i++) { const tx = x + w * (0.3 + i * 0.4); rect(tx - 30, y + h - 50, 60, 6, '#6b4a2a'); rect(tx - 3, y + h - 46, 6, 34, '#6b4a2a'); rect(tx - 8, y + h - 62, 16, 12, '#fff'); ctx.strokeStyle = 'rgba(200,200,200,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, y + h - 64); ctx.quadraticCurveTo(tx + 6 * Math.sin(st.t * 3 + i), y + h - 80, tx, y + h - 94); ctx.stroke(); }
      drawPerson(x + w * 0.5, y + h - 12, 0.9, '#2f7bff', false, k);
    },
    office(x, y, w, h, k) {
      rect(x, y, w, h, '#dfe6ee');
      rect(x, y + h - 12, w, 12, '#7d8596');
      for (let i = 0; i < 2; i++) {
        const dx = x + w * (0.25 + i * 0.45);
        rect(dx - 40, y + h - 52, 80, 6, '#8a6a4a'); rect(dx - 36, y + h - 46, 6, 34, '#6b4a2a'); rect(dx + 30, y + h - 46, 6, 34, '#6b4a2a');
        rect(dx - 18, y + h - 84, 36, 26, '#2a2f3a'); rect(dx - 15, y + h - 81, 30, 20, Math.sin(st.t * 2 + i + k) > 0 ? '#5fb4ff' : '#7fd3ff');
        drawPerson(dx + 22, y + h - 12, 0.85, ['#7a5cff', '#2f9a5a', '#e8364f'][(i + Math.floor(k * 3)) % 3], false, k + i);
      }
    },
    gym(x, y, w, h, k) {
      rect(x, y, w, h, '#e8eef6');
      rect(x, y + h - 12, w, 12, '#3a3d46');
      rect(x + w * 0.2, y + h - 30, 110, 14, '#555'); rect(x + w * 0.2 + 96, y + h - 80, 8, 54, '#777');
      ctx.save(); ctx.translate(x + w * 0.2 + 50, y + h - 30); ctx.translate(0, Math.abs(Math.sin(st.t * 8)) * -4); drawPerson(0, 0, 0.9, '#ff8a1a', false, k); ctx.restore();
      rect(x + w * 0.7, y + h - 26, 60, 6, '#888'); blob(x + w * 0.7, y + h - 23, 12, '#333'); blob(x + w * 0.7 + 60, y + h - 23, 12, '#333');
    },
    jungle(x, y, w, h, k) {
      rect(x, y, w, h, '#3f8a4a');
      for (let i = 0; i < 6; i++) blob(x + (i / 5) * w, y + h - 10, 40, '#2f6a3a');
      ctx.strokeStyle = '#5a7a30'; ctx.lineWidth = 5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + w * (0.15 + i * 0.25), y); ctx.quadraticCurveTo(x + w * (0.2 + i * 0.25), y + h * 0.4, x + w * (0.15 + i * 0.25), y + h * 0.7); ctx.stroke(); }
      const sw = Math.sin(st.t * 2 + k * 6) * 0.6, mx = x + w * 0.5;
      ctx.save(); ctx.translate(mx, y); ctx.rotate(sw);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, h * 0.45); ctx.stroke();
      blob(0, h * 0.5, 14, '#7a5030'); blob(0, h * 0.5 - 16, 10, '#7a5030'); blob(0, h * 0.5 - 16, 6, '#d9b080');
      ctx.restore();
    },
    aquarium(x, y, w, h, k) {
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#4fc3e8'); g.addColorStop(1, '#1677b8');
      rect(x, y, w, h, g);
      for (let i = 0; i < 5; i++) {
        const fx2 = x + ((hash(i + k * 10) * w + st.t * (30 + i * 10)) % w), fy = y + 20 + hash(i + 3) * (h - 50);
        ctx.fillStyle = ['#ff8a1a', '#ffd23f', '#ff5d73', '#c77dff', '#7ddc6f'][i];
        ctx.beginPath(); ctx.ellipse(fx2, fy, 14, 8, 0, 0, TAU); ctx.fill(); poly([[fx2 - 12, fy], [fx2 - 22, fy - 7], [fx2 - 22, fy + 7]], ctx.fillStyle);
      }
      const sx = x + ((st.t * 60 + k * 300) % (w + 200)) - 100, sy2 = y + h * 0.6;
      ctx.fillStyle = '#7d8a9c'; ctx.beginPath(); ctx.ellipse(sx, sy2, 50, 16, 0, 0, TAU); ctx.fill();
      poly([[sx - 6, sy2 - 14], [sx + 10, sy2 - 36], [sx + 16, sy2 - 12]], '#7d8a9c'); poly([[sx - 46, sy2], [sx - 68, sy2 - 16], [sx - 64, sy2 + 14]], '#7d8a9c');
      blob(sx + 34, sy2 - 4, 2.4, '#111');
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 6; i++) { const by = y + h - ((st.t * 40 + i * 30) % h); blob(x + 20 + i * w / 6, by, 3, 'rgba(255,255,255,0.5)'); }
    },
    dino(x, y, w, h, k) {
      rect(x, y, w, h, '#e9dcc0');
      rect(x, y + h - 12, w, 12, '#a88a5a');
      const dx = x + w * 0.5 + Math.sin(st.t * 0.8 + k) * w * 0.2, dy = y + h - 12, step = Math.sin(st.t * 4) * 6;
      ctx.fillStyle = '#5a9a4a';
      ctx.beginPath(); ctx.ellipse(dx, dy - 50, 46, 26, -0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(dx - 40, dy - 50); ctx.quadraticCurveTo(dx - 90, dy - 40, dx - 110, dy - 60); ctx.lineTo(dx - 40, dy - 40); ctx.fill();
      ctx.beginPath(); ctx.ellipse(dx + 50, dy - 92, 30, 18, -0.2, 0, TAU); ctx.fill();
      rect(dx + 30, dy - 86, 14, 30, '#5a9a4a');
      rect(dx - 20 + step, dy - 30, 14, 30, '#4a8a3a'); rect(dx + 10 - step, dy - 30, 14, 30, '#4a8a3a');
      blob(dx + 62, dy - 98, 3, '#111');
      ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) poly([[dx + 52 + i * 7, dy - 82], [dx + 55 + i * 7, dy - 76], [dx + 58 + i * 7, dy - 82]], '#fff');
    },
    cats(x, y, w, h, k) {
      rect(x, y, w, h, '#ffe4ef');
      rect(x, y + h - 12, w, 12, '#c98aa8');
      const cols = ['#ff9a3c', '#3a3d46', '#f4f4f0', '#9aa2b4', '#d9a440'];
      for (let i = 0; i < 5; i++) drawCat(x + 30 + i * (w - 60) / 4, y + h - 12 - (i % 2) * 40, 0.9, cols[(i + Math.floor(k * 5)) % 5], i + k);
      blob(x + w * 0.5 + Math.sin(st.t * 2) * 30, y + h - 22, 10, '#e8364f');
      rect(x + w * 0.1, y + h * 0.35, 60, 8, '#8a5a3a');
    },
    ballpit(x, y, w, h, k) {
      rect(x, y, w, h, '#fff6e0');
      const cols = ['#e8364f', '#2f7bff', '#ffd23f', '#7ddc6f', '#c77dff', '#ff8a1a'];
      for (let i = 0; i < 70; i++) { const bx = x + 8 + hash(i + k * 7) * (w - 16), by = y + h - 10 - hash(i * 3 + k) * 60 + Math.sin(st.t * 3 + i) * 2; blob(bx, by, 9, cols[i % 6]); }
      const jy = y + h - 80 - Math.abs(Math.sin(st.t * 3 + k)) * 50;
      drawPerson(x + w * 0.4, jy, 0.9, '#2f9a5a', false, k);
    },
    disco(x, y, w, h, k) {
      rect(x, y, w, h, '#1a1030');
      for (let i = 0; i < 8; i++) { const cx = x + (i + 0.5) * w / 8; rect(cx - w / 16 + 1, y + h - 16, w / 8 - 2, 16, `hsl(${(i * 45 + st.t * 200) % 360},80%,60%)`); }
      blob(x + w / 2, y + 26, 18, '#ccd'); ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { const a = st.t * 2 + i * 1.3; ctx.fillStyle = `hsla(${i * 70},90%,60%,0.25)`; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 26); ctx.lineTo(x + w / 2 + Math.cos(a) * w, y + h); ctx.lineTo(x + w / 2 + Math.cos(a + 0.2) * w, y + h); ctx.fill(); }
      ctx.restore();
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(x + w * (0.25 + i * 0.25), y + h - 16 - Math.abs(Math.sin(st.t * 5 + i)) * 10); drawPerson(0, 0, 0.85, `hsl(${i * 120},70%,55%)`, false, i + k); ctx.restore(); }
    },
    clouds(x, y, w, h, k) {
      rect(x, y, w, h, '#bfe4ff');
      for (let i = 0; i < 4; i++) { const cx = x + ((hash(i + k) * w + st.t * 20) % w), cy = y + 30 + i * 30; for (const [dx, dy, r] of [[0, 0, 26], [26, 6, 20], [-24, 6, 20]]) blob(cx + dx, cy + dy, r, '#fff'); }
      ctx.save(); ctx.translate(x + w * 0.5, y + h - 30 + Math.sin(st.t * 2) * 8); drawPerson(0, 0, 0.9, '#7a5cff', true, k); ctx.restore();
    },
    rain(x, y, w, h, k) {
      rect(x, y, w, h, '#7d8ea4');
      for (const [dx, dy, r] of [[0.3, 20, 30], [0.5, 14, 36], [0.7, 22, 28]]) blob(x + w * dx, y + dy, r, '#5a6676');
      ctx.strokeStyle = 'rgba(210,230,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 26; i++) { const rx = x + hash(i + k) * w, ry = y + 40 + ((st.t * 300 + i * 37) % (h - 50)); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 12); }
      ctx.stroke();
      const px = x + w * 0.55; drawPerson(px, y + h - 6, 0.9, '#ffd23f', false, k);
      ctx.fillStyle = '#e8364f'; ctx.beginPath(); ctx.arc(px, y + h - 66, 30, Math.PI, 0); ctx.fill();
      rect(x, y + h - 8, w, 8, 'rgba(120,170,230,0.7)');
    },
    sideways(x, y, w, h, k) {
      rect(x, y, w, h, '#f0e6ff');
      // everything is stuck to the left wall
      ctx.save(); ctx.translate(x + 14, y + h / 2); ctx.rotate(Math.PI / 2);
      rect(-50, -20, 100, 8, '#8a6a4a'); rect(-30, -60, 60, 40, '#5fb4ff');
      ctx.restore();
      ctx.save(); ctx.translate(x + 12, y + h * 0.7); ctx.rotate(Math.PI / 2); drawPerson(0, 0, 0.9, '#2f9a5a', false, k); ctx.restore();
      ctx.save(); ctx.translate(x + w * 0.6, y + h / 2); ctx.rotate(st.t * 0.6); rect(-26, -18, 52, 36, '#c9a06a'); rect(-20, -12, 40, 24, '#7fd3ff'); ctx.restore();
      blob(x + w * 0.85, y + 30 + Math.sin(st.t * 2) * 40, 12, '#ff8a1a');
    },
    pirate(x, y, w, h, k) {
      rect(x, y, w, h, '#9fd3ff');
      for (let i = 0; i < 6; i++) blob(x + i * w / 5, y + h - 4 + Math.sin(st.t * 2 + i) * 4, 26, '#2f7fc4');
      const bx = x + w * 0.5, by = y + h - 30 + Math.sin(st.t * 1.6) * 4;
      poly([[bx - 90, by - 20], [bx + 90, by - 20], [bx + 64, by + 14], [bx - 64, by + 14]], '#7a4a2a');
      rect(bx - 3, by - 120, 6, 100, '#5a3a20');
      poly([[bx + 3, by - 112], [bx + 70, by - 70], [bx + 3, by - 40]], '#f4f0e6');
      rect(bx - 3, by - 130, 30, 16, '#222'); blob(bx + 12, by - 122, 4, '#fff');
      drawPerson(bx - 40, by - 20, 0.8, '#e8364f', false, k);
    },
    islands(x, y, w, h, k) {
      rect(x, y, w, h, '#9fd8ff');
      for (let i = 0; i < 2; i++) {
        const ix = x + w * (0.3 + i * 0.4), iy = y + h * (0.55 + i * 0.1) + Math.sin(st.t * 1.4 + i * 2) * 8;
        poly([[ix - 50, iy], [ix + 50, iy], [ix + 10, iy + 40], [ix - 14, iy + 34]], '#8a6a4a');
        rect(ix - 50, iy - 8, 100, 10, '#5fae4f');
        rect(ix - 2, iy - 60, 5, 54, '#8a6a3a'); for (let f = 0; f < 4; f++) { ctx.strokeStyle = '#3d8a3a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ix, iy - 60); ctx.quadraticCurveTo(ix + (f - 1.5) * 18, iy - 74, ix + (f - 1.5) * 30, iy - 54); ctx.stroke(); }
      }
    },
    dragon(x, y, w, h, k) {
      rect(x, y, w, h, '#4a2a3a');
      for (let i = 0; i < 10; i++) blob(x + hash(i + k) * w, y + h - 6, 10, '#ffd23f');
      const dx = x + w * 0.35, dy = y + h * 0.55 + Math.sin(st.t * 2) * 6;
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(dx, dy, 44, 26, 0.1, 0, TAU); ctx.fill();
      poly([[dx + 30, dy - 10], [dx + 80, dy - 2], [dx + 30, dy + 14]], '#c0392b');
      poly([[dx - 10, dy - 24], [dx - 4, dy - 44], [dx + 6, dy - 24]], '#ffd23f');
      blob(dx + 20, dy - 8, 3, '#fff');
      const fl = 60 + Math.sin(st.t * 12) * 14;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(dx + 80, 0, dx + 80 + fl * 2, 0); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.4, '#ff9a1f'); g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(dx + 80, dy); ctx.lineTo(dx + 80 + fl * 2, dy - 30); ctx.lineTo(dx + 80 + fl * 2, dy + 30); ctx.fill();
      ctx.restore();
    },
    books(x, y, w, h, k) {
      rect(x, y, w, h, '#5a3a2a');
      for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) rect(x + 10 + i * (w - 20) / 12, y + 20 + r * 60, (w - 20) / 12 - 3, 44, `hsl(${(i * 37 + r * 90) % 360},50%,45%)`);
      for (let i = 0; i < 4; i++) {
        const bx = x + ((hash(i + k * 4) * w + st.t * (40 + i * 10)) % w), by = y + h * 0.5 + Math.sin(st.t * 3 + i) * 20, f = Math.sin(st.t * 10 + i) * 14;
        ctx.fillStyle = `hsl(${i * 80},60%,55%)`;
        poly([[bx, by], [bx - 18, by - f], [bx - 18, by + 10 - f], [bx, by + 10]], ctx.fillStyle);
        poly([[bx, by], [bx + 18, by - f], [bx + 18, by + 10 - f], [bx, by + 10]], ctx.fillStyle);
      }
    },
    space(x, y, w, h, k) {
      rect(x, y, w, h, '#0b1030');
      ctx.fillStyle = '#fff'; for (let i = 0; i < 30; i++) ctx.fillRect(x + hash(i + k) * w, y + hash(i + 50 + k) * h, 2, 2);
      blob(x + w * 0.8, y + h * 0.35, 26, '#4f9ad1'); blob(x + w * 0.8 - 6, y + h * 0.35 - 6, 10, '#7ddc6f');
      ctx.save(); ctx.translate(x + w * 0.35, y + h * 0.7 + Math.sin(st.t * 1.5 + k) * 12); drawPerson(0, 0, 1, '#f4f4f8', true, k);
      ctx.strokeStyle = 'rgba(160,220,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -48, 15, 0, TAU); ctx.stroke(); ctx.restore();
    },
    moon(x, y, w, h, k) {
      rect(x, y, w, h, '#14182e');
      rect(x, y + h - 30, w, 30, '#b8b8c0');
      for (let i = 0; i < 5; i++) { ctx.fillStyle = '#9a9aa4'; ctx.beginPath(); ctx.ellipse(x + 30 + i * (w - 60) / 4, y + h - 16, 18, 5, 0, 0, TAU); ctx.fill(); }
      rect(x + w * 0.6, y + h - 90, 3, 60, '#ddd'); rect(x + w * 0.6 + 3, y + h - 90, 34, 20, '#e8364f');
      // a car parked on the moon
      rect(x + w * 0.15, y + h - 54, 80, 24, '#2f7bff'); blob(x + w * 0.15 + 16, y + h - 30, 9, '#333'); blob(x + w * 0.15 + 64, y + h - 30, 9, '#333');
    },
    candy(x, y, w, h, k) {
      rect(x, y, w, h, '#ffd6ec');
      for (let i = 0; i < 4; i++) {
        const lx = x + 30 + i * (w - 60) / 3, ly = y + h - 70;
        rect(lx - 2, ly, 5, 70, '#fff');
        blob(lx, ly, 22, `hsl(${(i * 90 + st.t * 30) % 360},80%,65%)`);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lx, ly, 13, st.t * 2, st.t * 2 + 4); ctx.stroke();
      }
      for (let i = 0; i < 12; i++) blob(x + hash(i + k) * w, y + 10 + hash(i + 7) * 40, 4, ['#ff5d73', '#7ddc6f', '#4fd1ff'][i % 3]);
    },
    ducks(x, y, w, h, k) {
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9fe0ff'); g.addColorStop(1, '#4fb3ff');
      rect(x, y, w, h, g);
      for (let i = 0; i < 6; i++) drawDuck(x + 30 + ((i * (w - 40) / 5 + st.t * 15) % (w - 40)), y + h - 26 - (i % 2) * 10, 0.8 + (i % 3) * 0.15, i + k);
      const big = 1.6 + Math.sin(st.t) * 0.1; drawDuck(x + w * 0.5, y + h * 0.45, big, k);
    },
    mirrors(x, y, w, h, k) {
      // the elevator, reflected forever
      for (let i = 0; i < 7; i++) {
        const s = Math.pow(0.78, i), rw = w * s, rh = h * s;
        rect(x + (w - rw) / 2, y + (h - rh) / 2, rw, rh, `hsl(${(i * 40 + st.t * 40 + k * 60) % 360},60%,${30 + i * 6}%)`);
      }
      const s = 0.4; rect(x + w / 2 - 30 * s * 2, y + h / 2 - 40 * s * 2, 60 * s * 2, 80 * s * 2, 'rgba(200,230,255,0.6)');
    }
  };

  // ---- The tower -------------------------------------------------------------------
  function bandRoom(b, side) {
    const s = stopAt(b * BAND);
    return s.rooms[Math.floor(hash(b * 2 + side * 7.3) * s.rooms.length)];
  }
  function wallCol(b) {
    const a = b * BAND;
    if (a < 3000) return '#c9bfae';
    if (a < 8000) return '#b8c3d8';
    if (a < 14500) return '#a99ac9';
    const h = (b * 23) % 360; return `hsl(${h},35%,55%)`;
  }
  function drawTower() {
    const b0 = Math.floor((st.cam * K - (H - SY - 75)) / FH / K * K) - 1;
    const first = Math.floor((st.cam - (H - SY) / K) / BAND) - 1, last = Math.floor((st.cam + (SY + 75) / K) / BAND) + 1;
    // the street and the city around the base
    const groundY = slabY(0);
    if (groundY < H + 40) {
      for (let i = 0; i < 12; i++) { const bh = 80 + hash(i) * 200, bx = i < 6 ? i * 26 : BR + 20 + (i - 6) * 100; rect(bx - 20, groundY - bh, i < 6 ? 24 : 80, bh, '#8494b8'); }
      rect(-30, groundY, W + 60, H, '#5a5d66');
      rect(-30, groundY, W + 60, 8, '#9aa0ad');
      ctx.fillStyle = '#f4f4f0'; for (let x = 0; x < W; x += 120) ctx.fillRect(x, groundY + 50, 60, 6);
    }
    for (let b = Math.max(0, first); b <= last; b++) {
      const yb = slabY(b), yt = yb - FH;
      if (yt > H || yb < -20) continue;
      rect(BL, yt, BR - BL, FH, wallCol(b));
      // two rooms each side of the shaft
      const rooms = [[BL + 12, yt + 12, CX - SH - BL - 24, FH - 26], [CX + SH + 12, yt + 12, BR - CX - SH - 24, FH - 26]];
      rooms.forEach(([rx, ry, rw, rh], side) => {
        ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
        ROOMS[bandRoom(b, side)](rx, ry, rw, rh, hash(b + side * 3.1));
        // the lights in the room go with the power
        const dark = clamp(1 - dim(), 0, 1) * 0.75;
        if (dark > 0.01) rect(rx, ry, rw, rh, `rgba(5,5,20,${dark})`);
        ctx.restore();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.strokeRect(rx, ry, rw, rh);
      });
      // the floor slab with its number by the shaft doors
      rect(BL - 6, yb - 14, BR - BL + 12, 14, '#6b6f7a');
      const n = Math.round(floorAt(b * BAND));
      const glitch = dim() < 0.25 && Math.random() < 0.3;
      ctx.fillStyle = '#1d2030'; ctx.beginPath(); ctx.roundRect(CX + SH + 14, yt + 10, 78, 26, 6); ctx.fill();
      ctx.fillStyle = dim() < 0.3 ? '#ff5d5d' : '#7dffb0'; ctx.font = '700 16px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(glitch ? String(Math.floor(Math.random() * 99999)) : n >= 1e6 ? '∞?' : n.toLocaleString(), CX + SH + 53, yt + 29);
    }
    // the roof is never reached: the tower just keeps going
  }

  function drawShaft() {
    rect(CX - SH, -30, SH * 2, H + 60, '#2a2d38');
    rect(CX - SH, -30, 6, H + 60, '#4a4f5c'); rect(CX + SH - 6, -30, 6, H + 60, '#4a4f5c');
    // guide rails with bolts scrolling past
    ctx.fillStyle = '#6b7080';
    const off = ((st.cam * K) % 40 + 40) % 40;
    for (let y = -40 + off; y < H + 40; y += 40) { ctx.fillRect(CX - SH + 10, y, 6, 4); ctx.fillRect(CX + SH - 16, y, 6, 4); }
    // the counterweight goes down as you go up
    const cwY = ((-st.cam * K * 0.5) % (H + 400) + H + 400) % (H + 400) - 200;
    rect(CX + SH - 30, cwY, 18, 90, '#8a8f9a');
    // emergency lights spin when the power is low
    if (dim() < 0.35) {
      for (let y = 60; y < H; y += 220) {
        const on = Math.sin(st.t * 8 + y) > 0;
        blob(CX - SH + 14, y, 7, on ? '#ff3b3b' : '#5a1a1a');
        if (on) blob(CX - SH + 14, y, 24, 'rgba(255,40,40,0.25)');
      }
    }
  }

  function carPose() {
    let x = CX, y = SY, tilt = 0;
    if (dim() < 0.3 && !st.crash) { x += (Math.random() - 0.5) * 4; y += (Math.random() - 0.5) * 3; }
    if (st.dead) { y += Math.min(st.deadT * 60, 40); tilt = Math.sin(st.t * 20) * 0.01; }
    if (st.crash && st.crash.boom) { tilt = Math.min(st.crash.since * 0.8, 0.25); }
    return { x, y, tilt };
  }
  function drawCar() {
    const p = carPose();
    // cables up to the top of the shaft (snapped and whipping if the cable broke)
    ctx.strokeStyle = '#9aa0ad'; ctx.lineWidth = 3;
    if (st.crash) { ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 80); ctx.quadraticCurveTo(p.x + 30 * Math.sin(st.t * 10), p.y - 160, p.x - 20, p.y - 240); ctx.stroke(); }
    else for (const dx of [-8, 8]) { ctx.beginPath(); ctx.moveTo(p.x + dx, -30); ctx.lineTo(p.x + dx, p.y - 80); ctx.stroke(); }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt);
    // the car: steel frame, glass sides, light inside that follows the power
    const lit = clamp(dim(), 0.08, 1);
    rect(-62, -80, 124, 160, '#55596a');
    const g = ctx.createLinearGradient(0, -74, 0, 74);
    g.addColorStop(0, mixc('#2a2a3a', '#fff3c8', lit)); g.addColorStop(1, mixc('#1a1a28', '#f0d89a', lit));
    rect(-56, -74, 112, 148, g);
    rect(-56, -74, 112, 6, 'rgba(255,255,255,0.4)');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-44, -60); ctx.lineTo(-20, -20); ctx.moveTo(30, -64); ctx.lineTo(48, -36); ctx.stroke();
    // the operator in a bellhop hat
    const bob = Math.sin(st.t * 3) * 1.5;
    rect(-20, 0 + bob, 40, 50, '#c0392b'); rect(-20, 50, 16, 24, '#2a2a3a'); rect(4, 50, 16, 24, '#2a2a3a');
    rect(-6, 4 + bob, 12, 30, '#ffd23f');
    blob(0, -16 + bob, 16, '#ffd7a8');
    rect(-14, -36 + bob, 28, 10, '#c0392b'); rect(-16, -28 + bob, 32, 4, '#a02a20');
    blob(-5, -18 + bob, 2, '#222'); blob(5, -18 + bob, 2, '#222');
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath();
    if (st.dead || st.crash || dim() < 0.3) ctx.arc(0, -6 + bob, 4, 1.15 * Math.PI, 1.85 * Math.PI); else ctx.arc(0, -10 + bob, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // button panel
    rect(36, -20, 14, 40, '#33363f');
    for (let i = 0; i < 5; i++) blob(43, -14 + i * 8, 2.5, i === Math.floor(st.t * 2) % 5 && lit > 0.3 ? '#ffd23f' : '#777');
    // the floor counter above the doors
    rect(-36, -100, 72, 22, '#111');
    const n = Math.round(floorAt(st.cam));
    ctx.fillStyle = lit < 0.3 ? '#ff5d5d' : '#ffb52e'; ctx.font = '700 16px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(dim() < 0.2 && Math.random() < 0.4 ? '--' : (n >= 1e9 ? '∞' : n.toLocaleString()), 0, -84);
    poly([[-44, -92], [-38, -98], [-38, -86]], st.vel > 5 ? '#7dffb0' : '#444'); poly([[44, -92], [38, -98], [38, -86]], st.vel < -5 ? '#ff5d5d' : '#444');
    ctx.restore();
  }

  // ---- Particles -----------------------------------------------------------------------
  function emit(dt) {
    const p = carPose();
    // sparks from the cables when the power is failing
    if ((dim() < 0.25 || st.dead) && Math.random() < dt * 12) {
      for (let i = 0; i < 6; i++) parts.push({ k: 'spark', x: p.x + rand(-10, 10), y: p.y - 80, vx: rand(-160, 160), vy: rand(-200, 40), g: 600, life: rand(0.3, 0.7), max: 0.7, size: rand(1.5, 3), color: Math.random() < 0.5 ? '#ffd23f' : '#fff6c0' });
    }
    // speed streaks in the shaft
    if (Math.abs(st.vel) > 200 && Math.random() < dt * 30) parts.push({ k: 'line', x: CX + rand(-SH + 10, SH - 10), y: st.vel > 0 ? -20 : H + 20, vx: 0, vy: st.vel > 0 ? 1600 : -1600, g: 0, life: 0.8, max: 0.8, size: 2, color: 'rgba(255,255,255,0.4)' });
  }

  // ---- Crash (a bad word): the cable snaps and the elevator plunges to the lobby ----------
  function updateCrash(dt) {
    const c = st.crash;
    c.t += dt;
    if (c.boom) { c.since += dt; return; }
    if (c.t < 0.5) { st.shake = Math.max(st.shake, 0.5); return; }
    c.p = Math.min(1, (c.t - 0.5) / c.dur);
    st.cam = c.top * (1 - Math.pow(c.p, 3));
    if (c.p >= 1) {
      c.boom = true; c.since = 0; st.cam = 0; st.flash = 1; st.shake = 1.5;
      for (let i = 0; i < 50; i++) { const a = rand(Math.PI, TAU), sp = rand(100, 500); parts.push({ k: 'dust', x: CX + rand(-60, 60), y: SY + 70, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, g: 300, life: rand(0.8, 1.6), max: 1.6, size: rand(10, 24), color: '#b8a890' }); }
      for (let i = 0; i < 40; i++) { const a = rand(0, TAU), sp = rand(150, 500); parts.push({ k: 'spark', x: CX, y: SY + 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 500, life: rand(0.4, 0.9), max: 0.9, size: rand(2, 4), color: '#ffd23f' }); }
      fx.push({ k: 'ring', x: CX, y: SY + 60, r: 420, life: 0.7, max: 0.7, color: '#ffe7b0' });
    }
  }

  // ---- Update / draw ---------------------------------------------------------------------
  function update(dt) {
    st.t += dt;
    const prev = st.cam;
    if (st.crash) updateCrash(dt);
    else if (!st.dead) {
      st.cam += (st.target - st.cam) * (1 - Math.exp(-dt * 2.4));
      if (Math.abs(st.target - st.cam) < 0.02) st.cam = st.target;
    } else st.deadT += dt;
    st.vel = dt > 0 ? (st.cam - prev) * K / dt : 0;
    st.kick = Math.max(0, st.kick - dt * 1.2);
    st.shake = Math.max(0, st.shake - dt * 2.5);
    if (dim() < 0.2 && !st.dead) st.shake = Math.max(st.shake, 0.08);
    st.flash = Math.max(0, st.flash - dt * 2);
    // lights flicker when the power gets low, more the lower it is
    st.flickT -= dt;
    if (st.flickT <= 0) {
      const p = st.dead ? 0 : st.power;
      st.flick = p < 0.4 && Math.random() < (0.4 - p) * 2 ? rand(0.2, 0.7) : 1;
      st.flickT = rand(0.05, 0.25);
    }
    emit(dt);
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += (q.g || 0) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt + (st.cam - prev) * K * (q.k === 'line' ? 0 : 1);
      if (q.k === 'dust') q.size += 20 * dt;
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      if (f.k === 'confetti') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 200 * dt; f.rot += f.vr * dt; }
    }
    if (onMilestone) for (const s of ELEV_STOPS) if (s.alt > 0 && prev < s.alt && st.cam >= s.alt) onMilestone(s);
  }

  function draw() {
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    if (st.shake) ctx.translate((Math.random() - 0.5) * st.shake * 16, (Math.random() - 0.5) * st.shake * 16);
    drawSky();
    drawTower();
    drawShaft();
    // building edge shadows
    rect(BL - 10, -30, 10, H + 60, 'rgba(0,0,0,0.2)'); rect(BR, -30, 10, H + 60, 'rgba(0,0,0,0.2)');
    for (const q of parts) {
      const a = q.life / q.max;
      if (q.k === 'dust') { ctx.globalAlpha = a * 0.6; blob(q.x, q.y, q.size, q.color); }
      else if (q.k === 'line') { ctx.globalAlpha = a; rect(q.x, q.y, 2, 60, q.color); }
    }
    ctx.globalAlpha = 1;
    if (!(st.crash && st.crash.boom && st.crash.since > 1.4)) drawCar();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of parts) if (q.k === 'spark') { ctx.globalAlpha = q.life / q.max; blob(q.x, q.y, q.size, q.color); }
    ctx.restore(); ctx.globalAlpha = 1;
    // LOW POWER warning on the whole building
    if (dim() < 0.3 && !st.crash && Math.sin(st.t * 6) > 0) {
      ctx.fillStyle = 'rgba(255,60,60,0.9)'; ctx.font = '700 26px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(st.dead ? '⚠ POWER OUT ⚠' : '⚠ LOW POWER ⚠', CX, 160);
    }
    if (st.dead) rect(-30, -30, W + 60, H + 60, `rgba(0,0,10,${Math.min(0.55, st.deadT * 0.5)})`);
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
    if (st.flash > 0) rect(-30, -30, W + 60, H + 60, `rgba(255,255,255,${st.flash * 0.5})`);
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
      st.cam = 0; st.target = 0; st.dead = false; st.deadT = 0; st.kick = 0; st.ignite = 0;
      st.streak = 0; st.crash = null; st.power = 1; st.flick = 1;
      parts.length = 0; fx.length = 0;
    },
    get alt() { return st.cam; },
    setIgnite(v) { st.ignite = v; },
    setStreak(n) { st.streak = n; },
    setTarget(d) { st.target = d; },
    // 0..1: the building dims, flickers and panics as this drops
    setPower(p) { st.power = clamp(p, 0, 1); },
    boostTo(d, power) {
      st.target = d;
      st.kick = Math.min(1.2, 0.5 + power * 0.15);
      st.shake = Math.max(st.shake, 0.15 + power * 0.08);
      if (power >= 4) st.flash = 0.4;
      fx.push({ k: 'ring', x: CX, y: SY, r: 160 + power * 40, life: 0.6, max: 0.6, color: '#ffe9a0' });
    },
    sputter() {
      st.shake = 0.5; st.flick = 0.3; st.flickT = 0.15;
      const p = carPose();
      for (let i = 0; i < 12; i++) parts.push({ k: 'spark', x: p.x + rand(-20, 20), y: p.y - 80, vx: rand(-200, 200), vy: rand(-220, 0), g: 600, life: rand(0.3, 0.6), max: 0.6, size: rand(1.5, 3), color: '#ffd23f' });
    },
    die() { st.dead = true; st.deadT = 0; st.shake = 0.8; },
    crash() {
      const top = st.cam;
      const dur = 0.8 + Math.min(1.6, Math.log10(1 + top) * 0.4);
      st.crash = { t: 0, p: 0, top, dur, boom: false, since: 0 };
      st.shake = Math.max(st.shake, 0.6);
    },
    get crashDone() { return !!(st.crash && st.crash.boom && st.crash.since > 1.8); },
    get crashBoom() { return !!(st.crash && st.crash.boom); },
    confetti(n = 160) {
      const cols = ['#ff5d73', '#ffd23f', '#4fd1ff', '#7ddc6f', '#b04dff', '#ff9a3c'];
      for (let i = 0; i < n; i++) fx.push({ k: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-80, 80), vy: rand(60, 220), rot: rand(0, TAU), vr: rand(-6, 6), w: rand(8, 14), h: rand(10, 18), life: rand(2.5, 4), color: cols[i % cols.length] });
    },
    burst(x, y, color, n = 30) {
      for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(100, 360); parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 4), color }); }
    },
    rocketScreen() { const p = carPose(); return { x: p.x, y: p.y - 40 }; },
    onMilestone(fn) { onMilestone = fn; }
  };
})();
