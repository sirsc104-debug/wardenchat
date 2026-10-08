/* Brain Rocket — the Elevator world: a glass elevator riding up the outside of a tower that never
   ends, in an open sky like the Rocket's. The strangeness happens around the tower: things leaning
   out of windows, sitting on ledges and floating past, with a big set piece at every milestone.
   The tower reacts to the elevator's power: windows go dark, warning lights blink, sparks fly. */
'use strict';

const ElevScene = (function () {
  const W = 1600, H = 900;
  const K = 3;               // screen pixels per point
  const SY = 520;            // elevator car centre (screen y)
  const TL = 360, TR = 560;  // the tower's left and right walls
  const CX = TR + 62;        // the car rides the tower's right-hand wall
  const ROW = 30;            // window rows, in pixels
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
  const wrapX = (x, m = 260) => { const span = W + m * 2; return ((((x + m) % span) + span) % span) - m; };
  const sy = (a, p = 1) => SY + (st.cam - a) * K * p;     // a point's screen y (p = parallax)
  const dim = () => (st.dead ? 0.15 : st.power) * st.flick; // how lit the tower is

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

  // ---- Sky --------------------------------------------------------------------
  const SKY = [
    [0, '#5fb4ff', '#cfeeff'], [2500, '#7fc0ff', '#f2f8ff'], [6000, '#5a7ad8', '#c4d4ff'],
    [10000, '#2a3a8a', '#7a8ad8'], [14500, '#0b1030', '#262c66'], [21000, '#2a0f3a', '#5a2a7a'], [25000, '#081f2e', '#18506a']
  ];
  function skyCols(a) {
    if (a >= 30000) { const h = (a * 0.02 + st.t * 20) % 360; return [`hsl(${h},55%,16%)`, `hsl(${(h + 60) % 360},65%,32%)`]; }
    let i = 0; while (i < SKY.length - 2 && a > SKY[i + 1][0]) i++;
    const s = SKY[i], e = SKY[i + 1], t = clamp((a - s[0]) / (e[0] - s[0]), 0, 1);
    return [mixc(s[1], e[1], t), mixc(s[2], e[2], t)];
  }
  function drawStars() {
    const a = clamp((st.cam - 9000) / 4000, 0, 1);
    if (a <= 0) return;
    for (let i = 0; i < 140; i++) {
      const y = ((hash(i) * 2400 + st.cam * K * 0.05) % 1000) - 50;
      ctx.fillStyle = `rgba(255,255,255,${a * (0.5 + 0.5 * Math.sin(st.t * 2 + i))})`;
      ctx.fillRect(hash(i + 9) * W, y, i % 7 ? 2 : 3, i % 7 ? 2 : 3);
    }
  }
  function drawSun() {
    const y = sy(-80, 0.04);
    if (y < -200) return;
    blob(1300, y - 330, 60, `rgba(255,248,210,${clamp(1 - st.cam / 8000, 0, 1) * 0.95})`);
  }

  // ---- The city at the bottom -----------------------------------------------------
  function drawCity() {
    const gy = sy(0) + 80;
    if (gy - 400 > H) return;
    // far skyline, then near buildings, then the street
    const fy = SY + 80 + st.cam * K * 0.35;
    for (let i = 0; i < 16; i++) { const h = 120 + hash(i) * 220, x = i * 110 - 40; rect(x, fy - h, 90, h + 600, '#9fb4d8'); }
    const ny = SY + 80 + st.cam * K * 0.7;
    for (let i = 0; i < 12; i++) {
      const h = 90 + hash(i + 30) * 160, x = i * 150 - 60;
      if (x > TL - 140 && x < TR + 160) continue;
      rect(x, ny - h, 120, h + 600, '#6b7fae');
      ctx.fillStyle = 'rgba(255,233,150,0.7)';
      for (let r = 0; r < h / 26 - 1; r++) for (let c = 0; c < 4; c++) if (hash(i * 31 + r * 7 + c) > 0.45) ctx.fillRect(x + 12 + c * 26, ny - h + 14 + r * 26, 12, 14);
    }
    rect(-30, gy, W + 60, H, '#5a5d66');
    rect(-30, gy, W + 60, 8, '#9aa0ad');
    ctx.fillStyle = '#f4f4f0'; for (let x = 0; x < W; x += 120) ctx.fillRect(x, gy + 50, 60, 6);
    for (const tx of [120, 260, 1080, 1220]) { rect(tx - 4, gy - 60, 8, 60, '#6b4a2a'); blob(tx, gy - 76, 28, '#3d8a45'); }
  }

  // ---- The tower ----------------------------------------------------------------
  function towerColour() {
    const a = st.cam;
    if (a < 6000) return ['#7f93b8', '#a9bbd8'];
    if (a < 14500) return ['#6f6aa8', '#9a94d0'];
    if (a < 30000) return ['#4a4f7a', '#7a80b8'];
    const h = (a * 0.03) % 360; return [`hsl(${h},35%,45%)`, `hsl(${(h + 40) % 360},45%,62%)`];
  }
  function drawTower() {
    const base = sy(0) + 80;
    const top = -40, bottom = Math.min(H + 40, base);
    if (bottom <= top) return;
    const [c1, c2] = towerColour();
    const g = ctx.createLinearGradient(TL, 0, TR, 0);
    g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, c1);
    rect(TL, top, TR - TL, bottom - top, g);
    // window rows scroll past as the elevator climbs; how many are lit follows the power
    const off = ((st.cam * K) % ROW + ROW) % ROW;
    const rowBase = Math.floor(st.cam * K / ROW);
    const lit = dim();
    for (let y = top - ROW + off, r = 0; y < bottom; y += ROW, r++) {
      const row = rowBase - r + Math.floor((SY - top) / ROW);
      for (let c = 0; c < 5; c++) {
        const on = hash(row * 13.1 + c * 7.7) < lit * 0.95 + 0.02;
        const x = TL + 14 + c * 37;
        rect(x, y + 6, 26, 18, on ? (hash(row + c) > 0.85 ? '#fff3c0' : '#ffe08a') : '#24304a');
        if (on && lit > 0.5) rect(x, y + 6, 26, 4, 'rgba(255,255,255,0.35)');
      }
    }
    // the edges of the tower, and a rail for the elevator
    rect(TL - 6, top, 8, bottom - top, 'rgba(0,0,0,0.25)');
    rect(TR - 2, top, 10, bottom - top, '#3a3f52');
    rect(TR + 8, top, 6, bottom - top, '#8a8f9a');
    ctx.fillStyle = '#5c6478';
    for (let y = top - 40 + ((st.cam * K) % 40 + 40) % 40; y < bottom; y += 40) ctx.fillRect(TR + 6, y, 10, 4);
    // red warning lights on the tower's corner; they blink fast when the power is low
    const fast = dim() < 0.35;
    for (let y = top + (((st.cam * K) % 260) + 260) % 260; y < bottom; y += 260) {
      const on = Math.sin(st.t * (fast ? 12 : 3) + y) > 0;
      blob(TL, y, 5, on ? '#ff3b3b' : '#5a1a1a');
      if (on) blob(TL, y, fast ? 22 : 14, 'rgba(255,50,50,0.3)');
    }
    // the entrance at the bottom
    if (base < H + 100) {
      rect(TL + 50, base - 70, 100, 70, '#2a2f3a');
      rect(TL + 56, base - 64, 40, 64, '#bfe4ff'); rect(TL + 104, base - 64, 40, 64, '#bfe4ff');
      rect(TL + 30, base - 84, 140, 14, '#c0392b');
      ctx.fillStyle = '#fff'; ctx.font = '700 12px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SKY TOWER', TL + 100, base - 73);
    }
  }

  // ---- Little characters ---------------------------------------------------------
  function drawPerson(x, y, s, shirt, floaty, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (floaty) ctx.rotate(Math.sin(st.t + seed) * 0.4);
    const wave = Math.sin(st.t * 6 + seed) * 0.6;
    rect(-9, -38, 18, 26, shirt);
    rect(-8, -12, 6, 16, '#3a3d46'); rect(2, -12, 6, 16, '#3a3d46');
    blob(0, -48, 10, '#ffd7a8');
    ctx.strokeStyle = shirt; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, -34); ctx.lineTo(-18, -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -34); ctx.lineTo(18 + wave * 4, -52 - wave * 6); ctx.stroke();
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

  // ---- Things around the tower ----------------------------------------------------
  // Like the Rocket's sky: each zone has its own mix of things drifting past or clinging to the tower.
  const ZONES = [
    { to: 300,   d: 1.2, types: { birds: 3, balloon: 1.5, washer: 1, flag: 1 } },
    { to: 600,   d: 1.2, types: { monkey: 3, vine: 2, parrot: 2 } },
    { to: 1000,  d: 1.2, types: { fish: 3, bubbles: 2, jelly: 1 } },
    { to: 1500,  d: 1.0, types: { ptero: 3, bone: 1.5 } },
    { to: 2200,  d: 1.2, types: { cat: 4, yarn: 1.5 } },
    { to: 3000,  d: 1.4, types: { ball: 4, balloon: 2 } },
    { to: 4000,  d: 1.3, types: { cloud: 4, birds: 1 } },
    { to: 5200,  d: 1.2, types: { raincloud: 3, umbrella: 2 } },
    { to: 6600,  d: 1.2, types: { furniture: 4 } },
    { to: 8200,  d: 1.0, types: { gull: 2, barrel: 2, cloud: 1 } },
    { to: 10000, d: 1.0, types: { island: 3, cloud: 1 } },
    { to: 12000, d: 1.0, types: { ember: 3, island: 1 } },
    { to: 14500, d: 1.3, types: { book: 4 } },
    { to: 17500, d: 1.0, types: { sat: 3, astro: 2 } },
    { to: 21000, d: 1.0, types: { astro: 2, rock: 2, sat: 1 } },
    { to: 25000, d: 1.2, types: { candy: 4 } },
    { to: 30000, d: 1.4, types: { duck: 4 } },
    { to: 1e12,  d: 1.4, types: { shard: 3, duck: 1, candy: 1 } }
  ];
  const zoneAt = a => ZONES.find(z => a < z.to);
  const CHUNK = 120;
  const chunkCache = new Map();
  function chunk(ci) {
    if (chunkCache.has(ci)) return chunkCache.get(ci);
    if (chunkCache.size > 300) chunkCache.clear();
    const seed = ci * 9173 + 7;
    const zone = zoneAt(ci * CHUNK + CHUNK / 2);
    const pairs = Object.entries(zone.types), total = pairs.reduce((s, p) => s + p[1], 0);
    const out = [];
    const n = Math.floor(zone.d + hash(seed) * 1.5);
    for (let i = 0; i < n; i++) {
      const h = k => hash(seed + i * 17 + k);
      let r = h(1) * total, type = pairs[0][0];
      for (const [t, w] of pairs) { if ((r -= w) <= 0) { type = t; break; } }
      // keep things clear of the tower and elevator; most go out in the open sky
      const side = h(2) < 0.22 ? 'left' : 'right';
      // most of the right-hand sky sits under the question card while playing, so favour the strip beside the car
      const x = type === 'washer' ? TL + 50 + h(3) * (TR - TL - 100)
        : side === 'left' ? 30 + h(3) * (TL - 120)
        : h(9) < 0.6 ? CX + 130 + h(3) * 220 : CX + 130 + h(3) * (W - CX - 150);
      out.push({ type, a: ci * CHUNK + h(4) * CHUNK, x, s: 0.7 + h(5) * 0.6, seed: h(6) * 100, dir: h(7) < 0.5 ? -1 : 1, p: 0.75 + h(8) * 0.3 });
    }
    chunkCache.set(ci, out);
    return out;
  }

  function drawThing(o, x, y) {
    const s = o.s, t = st.t + o.seed;
    ctx.save(); ctx.translate(x, y);
    switch (o.type) {
      case 'birds':
        ctx.strokeStyle = '#3a3d46'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { const bx = i * 26 * s, by = (i % 2) * 12, f = Math.sin(t * 8 + i) * 6; ctx.beginPath(); ctx.moveTo(bx - 10, by - f); ctx.quadraticCurveTo(bx - 4, by - 6, bx, by); ctx.quadraticCurveTo(bx + 4, by - 6, bx + 10, by - f); ctx.stroke(); }
        break;
      case 'balloon': {
        const col = `hsl(${(o.seed * 37) % 360},80%,60%)`;
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 20 * s); ctx.quadraticCurveTo(6, 40 * s, 0, 60 * s); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 22 * s, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'washer':
        ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, -200); ctx.lineTo(-40, 0); ctx.moveTo(40, -200); ctx.lineTo(40, 0); ctx.stroke();
        rect(-50, 0, 100, 10, '#8a8f9a'); drawPerson(0, 0, 0.9, '#2f7bff', false, o.seed);
        break;
      case 'flag':
        rect(0, -60, 4, 60, '#ddd'); poly([[4, -60], [40 + Math.sin(t * 6) * 4, -52], [4, -42]], `hsl(${(o.seed * 50) % 360},70%,55%)`);
        break;
      case 'monkey': {
        ctx.strokeStyle = '#5a7a30'; ctx.lineWidth = 4;
        const sw = Math.sin(t * 2) * 0.6;
        ctx.rotate(sw); ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(0, 0); ctx.stroke();
        blob(0, 10, 14, '#7a5030'); blob(0, -6, 10, '#7a5030'); blob(0, -6, 6, '#d9b080');
        break;
      }
      case 'vine':
        ctx.strokeStyle = '#3d8a3a'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(0, -150); ctx.quadraticCurveTo(20 * Math.sin(t), -60, 0, 0); ctx.stroke();
        for (let i = 0; i < 5; i++) { ctx.fillStyle = '#4fae57'; ctx.beginPath(); ctx.ellipse(6, -140 + i * 30, 10, 5, 0.5, 0, TAU); ctx.fill(); }
        break;
      case 'parrot': {
        const f = Math.sin(t * 10) * 10;
        ctx.scale(o.dir, 1);
        ctx.fillStyle = '#e8364f'; ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 9 * s, 0, 0, TAU); ctx.fill();
        poly([[-4, 0], [-14, -14 - f], [8, -4]], '#2f7bff'); poly([[14, -4], [24, 0], [14, 4]], '#ffd23f');
        break;
      }
      case 'fish': {
        const fx2 = Math.sin(t * 0.5) * 40;
        ctx.fillStyle = ['#ff8a1a', '#ffd23f', '#4fd1ff', '#c77dff'][Math.floor(o.seed) % 4];
        ctx.beginPath(); ctx.ellipse(fx2, 0, 24 * s, 12 * s, 0, 0, TAU); ctx.fill();
        poly([[fx2 - 20 * s, 0], [fx2 - 36 * s, -12 * s], [fx2 - 36 * s, 12 * s]], ctx.fillStyle);
        blob(fx2 + 12 * s, -3, 2.5, '#222');
        break;
      }
      case 'bubbles':
        for (let i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.sin(t + i) * 10, -((t * 30 + i * 20) % 120), 4 + i, 0, TAU); ctx.stroke(); }
        break;
      case 'jelly':
        ctx.fillStyle = 'rgba(255,150,220,0.7)'; ctx.beginPath(); ctx.arc(0, 0, 22 * s, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(255,150,220,0.7)'; ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, 0); ctx.quadraticCurveTo(i * 8 + Math.sin(t * 3 + i) * 6, 20, i * 8, 40 * s); ctx.stroke(); }
        break;
      case 'ptero': {
        const f = Math.sin(t * 5) * 18;
        ctx.scale(o.dir * s, s);
        poly([[0, 0], [-60, -10 - f], [-20, 6]], '#8a6a4a'); poly([[0, 0], [60, -10 - f], [20, 6]], '#8a6a4a');
        poly([[10, -6], [44, -14], [14, 4]], '#9a7a5a'); poly([[-6, -4], [-24, -18], [-4, 2]], '#9a7a5a');
        break;
      }
      case 'bone':
        ctx.rotate(t * 0.5); rect(-22, -4, 44, 8, '#f2e8d0'); for (const e of [-1, 1]) { blob(e * 22, -5, 6, '#f2e8d0'); blob(e * 22, 5, 6, '#f2e8d0'); }
        break;
      case 'cat':
        drawCat(0, 0, 1.1 * s, ['#ff9a3c', '#3a3d46', '#f4f4f0', '#9aa2b4'][Math.floor(o.seed) % 4], o.seed);
        if (o.seed % 2 < 1) { ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -120); ctx.stroke(); blob(0, -130, 16, '#ff5d73'); }
        break;
      case 'yarn':
        blob(0, 0, 16 * s, '#e8364f'); ctx.strokeStyle = '#a0202f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 10 * s, t, t + 3); ctx.stroke();
        break;
      case 'ball':
        blob(0, -Math.abs(Math.sin(t * 2)) * 40, 18 * s, ['#e8364f', '#2f7bff', '#ffd23f', '#7ddc6f', '#c77dff'][Math.floor(o.seed) % 5]);
        break;
      case 'cloud':
        for (const [dx, dy, r] of [[0, 0, 44], [48, 8, 36], [-44, 10, 34], [14, -24, 34]]) blob(dx * s, dy * s, r * s, 'rgba(255,255,255,0.92)');
        break;
      case 'raincloud':
        for (const [dx, dy, r] of [[0, 0, 40], [44, 6, 32], [-40, 8, 30]]) blob(dx * s, dy * s, r * s, '#7a8696');
        ctx.strokeStyle = 'rgba(200,220,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const rx = -50 + i * 10, ry = 30 + ((t * 200 + i * 23) % 90); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 10); }
        ctx.stroke();
        break;
      case 'umbrella':
        ctx.rotate(Math.sin(t) * 0.3); ctx.fillStyle = `hsl(${(o.seed * 60) % 360},70%,55%)`;
        ctx.beginPath(); ctx.arc(0, 0, 28 * s, Math.PI, 0); ctx.fill(); rect(-1.5, 0, 3, 34 * s, '#555');
        break;
      case 'furniture':
        ctx.rotate(t * 0.6 * o.dir);
        if (o.seed % 3 < 1) { rect(-30, -6, 60, 8, '#8a6a4a'); rect(-26, 2, 6, 24, '#6b4a2a'); rect(20, 2, 6, 24, '#6b4a2a'); }
        else if (o.seed % 3 < 2) { rect(-22, -16, 44, 32, '#c9a06a'); rect(-16, -10, 32, 20, '#7fd3ff'); }
        else { rect(-14, -30, 28, 30, '#e8364f'); rect(-14, 0, 28, 8, '#a0202f'); }
        break;
      case 'gull':
        ctx.strokeStyle = '#f4f4f0'; ctx.lineWidth = 3; const f = Math.sin(t * 7) * 8;
        ctx.beginPath(); ctx.moveTo(-16, -f); ctx.quadraticCurveTo(-6, -8, 0, 0); ctx.quadraticCurveTo(6, -8, 16, -f); ctx.stroke();
        break;
      case 'barrel':
        ctx.rotate(t * 0.8); rect(-14, -18, 28, 36, '#8a5a2a'); rect(-14, -10, 28, 4, '#555'); rect(-14, 6, 28, 4, '#555');
        break;
      case 'island': {
        const bob = Math.sin(t * 1.4) * 8;
        ctx.translate(0, bob); ctx.scale(s, s);
        poly([[-60, 0], [60, 0], [14, 50], [-18, 40]], '#8a6a4a'); rect(-60, -10, 120, 12, '#5fae4f');
        rect(-3, -70, 6, 60, '#8a6a3a');
        for (let k = 0; k < 4; k++) { ctx.strokeStyle = '#3d8a3a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -70); ctx.quadraticCurveTo((k - 1.5) * 20, -86, (k - 1.5) * 34, -62); ctx.stroke(); }
        break;
      }
      case 'ember':
        blob(0, -((t * 40) % 200), 5 * s, '#ffb52e'); blob(20, -((t * 50 + 60) % 200), 4 * s, '#ff6a1a');
        break;
      case 'book': {
        const f = Math.sin(t * 10) * 14;
        ctx.fillStyle = `hsl(${(o.seed * 40) % 360},60%,55%)`;
        poly([[0, 0], [-22 * s, -f], [-22 * s, 12 - f], [0, 12]], ctx.fillStyle);
        poly([[0, 0], [22 * s, -f], [22 * s, 12 - f], [0, 12]], ctx.fillStyle);
        rect(-1, 0, 2, 12, '#fff');
        break;
      }
      case 'sat':
        ctx.rotate(t * 0.3); rect(-12, -10, 24, 20, '#d9dce6'); rect(-50, -6, 34, 12, '#2f5fa0'); rect(16, -6, 34, 12, '#2f5fa0');
        break;
      case 'astro':
        drawPerson(0, 0, 1.1 * s, '#f4f4f8', true, o.seed);
        ctx.strokeStyle = 'rgba(160,220,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -53 * s, 16 * s, 0, TAU); ctx.stroke();
        break;
      case 'rock':
        ctx.rotate(t * 0.4); poly([[-20, -6], [-8, -20], [14, -16], [22, 4], [6, 18], [-16, 14]], '#9a9aa4');
        break;
      case 'candy':
        blob(0, 0, 30 * s, `hsl(${(o.seed * 47 + st.t * 10) % 360},80%,68%)`);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(0, 0, 18 * s, t, t + 4); ctx.stroke();
        break;
      case 'duck':
        drawDuck(0, 0, 1.2 * s, o.seed);
        break;
      case 'shard':
        ctx.rotate(t * 0.5 * o.dir);
        poly([[0, -30 * s], [18 * s, 10 * s], [-16 * s, 20 * s]], `hsla(${(o.seed * 50 + st.t * 60) % 360},80%,70%,0.85)`);
        break;
    }
    ctx.restore();
  }
  // onTower: the window washers hang on the tower itself, so they draw after it, at its speed
  function drawThings(onTower) {
    const c0 = Math.floor((st.cam - 260) / CHUNK), c1 = Math.floor((st.cam + 260) / CHUNK);
    for (let ci = c0; ci <= c1; ci++) {
      if (ci < 0) continue;
      for (const o of chunk(ci)) {
        if ((o.type === 'washer') !== onTower) continue;
        const y = sy(o.a, onTower ? 1 : o.p);
        if (y < -220 || y > H + 220) continue;
        const drift = ['birds', 'balloon', 'parrot', 'fish', 'jelly', 'ptero', 'cloud', 'raincloud', 'gull', 'island', 'book', 'sat', 'astro', 'candy', 'duck', 'shard', 'furniture', 'umbrella', 'barrel', 'rock'].includes(o.type);
        const x = drift ? wrapX(o.x + o.dir * st.t * 20 * o.s, 300) : o.x;
        if (!onTower && x > TL - 80 && x < CX + 120) continue;
        drawThing(o, x, y);
      }
    }
  }

  // ---- Big set pieces at the milestones (they lean out of the tower or float beside it) -------
  const FEATURE = {
    "The Jungle Floor"(y) {
      ctx.strokeStyle = '#3d8a3a'; ctx.lineWidth = 6;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(TL + 20 + i * 40, y - 140); ctx.quadraticCurveTo(TL + 30 + i * 40 + Math.sin(st.t + i) * 10, y - 60, TL + 20 + i * 40, y + 10); ctx.stroke(); }
      for (let i = 0; i < 8; i++) blob(TL + 20 + i * 25, y - 140, 22, '#4fae57');
    },
    "The Aquarium Floor"(y) {
      // a whole floor of the tower is one giant fish tank
      const g = ctx.createLinearGradient(0, y - 120, 0, y);
      g.addColorStop(0, '#4fc3e8'); g.addColorStop(1, '#1677b8');
      rect(TL + 6, y - 120, TR - TL - 12, 120, g);
      const sx = TL + 30 + ((st.t * 40) % (TR - TL - 60));
      ctx.fillStyle = '#7d8a9c'; ctx.beginPath(); ctx.ellipse(sx, y - 60, 40, 13, 0, 0, TAU); ctx.fill();
      poly([[sx - 4, y - 72], [sx + 8, y - 92], [sx + 14, y - 70]], '#7d8a9c'); blob(sx + 26, y - 63, 2, '#111');
      for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#ff8a1a', '#ffd23f', '#ff5d73', '#c77dff'][i]; ctx.beginPath(); ctx.ellipse(TL + 30 + ((st.t * (30 + i * 12) + i * 50) % (TR - TL - 60)), y - 100 + i * 22, 9, 5, 0, 0, TAU); ctx.fill(); }
    },
    "Dinosaur Museum"(y) {
      // a T. rex leaning out of a window
      const x = TL - 10, bob = Math.sin(st.t * 1.6) * 6;
      ctx.fillStyle = '#5a9a4a';
      ctx.beginPath(); ctx.ellipse(x - 40, y - 80 + bob, 70, 34, -0.2, 0, TAU); ctx.fill();
      rect(x - 10, y - 70 + bob, 40, 26, '#5a9a4a');
      blob(x - 70, y - 92 + bob, 5, '#111');
      for (let i = 0; i < 6; i++) poly([[x - 100 + i * 12, y - 56 + bob], [x - 95 + i * 12, y - 44 + bob], [x - 90 + i * 12, y - 56 + bob]], '#fff');
      ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 30, y - 50 + bob); ctx.lineTo(x - 40, y - 30 + bob); ctx.stroke();
    },
    "The Cat Kingdom"(y) {
      rect(TL - 40, y - 10, TR - TL + 80, 10, '#8a8f9a');
      const cols = ['#ff9a3c', '#3a3d46', '#f4f4f0', '#9aa2b4', '#d9a440'];
      for (let i = 0; i < 6; i++) drawCat(TL - 20 + i * 44, y - 10, 1, cols[i % 5], i);
      // a king cat with a crown
      drawCat(TL + 90, y - 140, 2, '#ff9a3c', 9); poly([[TL + 104, y - 214], [TL + 112, y - 234], [TL + 120, y - 218], [TL + 128, y - 236], [TL + 136, y - 214]], '#ffd23f');
    },
    "Ball Pit Floor"(y) {
      const cols = ['#e8364f', '#2f7bff', '#ffd23f', '#7ddc6f', '#c77dff'];
      for (let i = 0; i < 26; i++) { const t2 = (st.t * 0.8 + i * 0.13) % 1.6; blob(TL - 10 - t2 * 120 * hash(i), y - 60 + t2 * t2 * 180 - t2 * 160, 12, cols[i % 5]); }
    },
    "Inside a Cloud"(y) {
      for (const [dx, dy, r] of [[-60, 0, 90], [60, -10, 100], [180, 0, 80], [0, -70, 80], [120, -80, 70]]) blob(TL + dx, y + dy, r, 'rgba(255,255,255,0.95)');
    },
    "The Rain Room"(y) {
      for (const [dx, dy, r] of [[-30, -160, 60], [60, -170, 70], [150, -160, 60]]) blob(TL + dx, y + dy, r, '#6f7c8e');
      ctx.strokeStyle = 'rgba(200,220,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 30; i++) { const rx = TL - 80 + i * 10, ry = y - 120 + ((st.t * 300 + i * 37) % 200); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 14); }
      ctx.stroke();
    },
    "Sideways Gravity"(y) {
      // a whole room tipped out of the tower, sideways
      ctx.save(); ctx.translate(TL - 110, y - 80); ctx.rotate(Math.PI / 2 + Math.sin(st.t) * 0.05);
      rect(-70, -50, 140, 100, '#f0e6ff'); rect(-60, 20, 80, 8, '#8a6a4a'); rect(-30, -30, 40, 30, '#5fb4ff');
      drawPerson(30, 40, 1, '#2f9a5a', false, 3);
      ctx.restore();
    },
    "Pirate Sky Dock"(y) {
      const bx = TL - 170, by = y - 40 + Math.sin(st.t * 1.4) * 8;
      poly([[bx - 130, by - 24], [bx + 120, by - 24], [bx + 90, by + 20], [bx - 100, by + 20]], '#7a4a2a');
      rect(bx - 4, by - 170, 8, 146, '#5a3a20');
      poly([[bx + 4, by - 160], [bx + 100, by - 100], [bx + 4, by - 50]], '#f4f0e6');
      rect(bx - 4, by - 186, 40, 20, '#222'); blob(bx + 16, by - 176, 5, '#fff');
      drawPerson(bx - 60, by - 24, 0.9, '#e8364f', false, 1);
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + 120, by - 20); ctx.lineTo(TL, by - 40); ctx.stroke();
    },
    "Floating Islands"(y) {
      for (const [dx, dy, s] of [[-200, -60, 1.4], [-60, -180, 1], [900, -100, 1.3]]) drawThing({ type: 'island', s, seed: dx, dir: 1 }, TL + dx > TR ? CX + dx : TL + dx, y + dy);
    },
    "Dragon's Roost"(y) {
      // a dragon circling the tower
      const a = st.t * 0.9, dx = TL - 160 + Math.cos(a) * 120, dy = y - 80 + Math.sin(a) * 40;
      ctx.save(); ctx.translate(dx, dy); ctx.scale(Math.sin(a) > 0 ? 1 : -1, 1);
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(0, 0, 60, 24, 0, 0, TAU); ctx.fill();
      const f = Math.sin(st.t * 6) * 30;
      poly([[-10, -10], [-50, -60 - f], [30, -12]], '#a02a20');
      poly([[50, -6], [90, -14], [56, 10]], '#c0392b'); blob(76, -10, 3, '#fff');
      poly([[-56, 0], [-110, -16], [-100, 14]], '#c0392b');
      ctx.restore();
    },
    "The Flying Library"(y) {
      for (let i = 0; i < 12; i++) drawThing({ type: 'book', s: 1, seed: i * 7, dir: 1 }, TL - 60 - (i % 4) * 60 + Math.sin(st.t + i) * 20, y - 40 - Math.floor(i / 4) * 60);
    },
    "Edge of Space"(y) {
      drawThing({ type: 'astro', s: 1.4, seed: 1, dir: 1 }, TL - 120, y - 60);
      rect(TL - 2, y - 400, 4, 400, 'rgba(200,220,255,0.3)');
    },
    "Moon Parking"(y) {
      // the Moon, parked right next to the tower
      const mx = TL - 260, my = y - 80;
      blob(mx, my, 210, '#d9d9e0');
      for (const [dx, dy, r] of [[-60, -40, 30], [40, 30, 44], [70, -70, 20], [-40, 90, 26]]) blob(mx + dx, my + dy, r, '#b8b8c4');
      rect(mx + 150, my - 210, 4, 60, '#ddd'); rect(mx + 154, my - 210, 30, 18, '#e8364f');
      rect(mx + 40, my - 230, 70, 22, '#2f7bff'); blob(mx + 54, my - 208, 8, '#333'); blob(mx + 96, my - 208, 8, '#333');
    },
    "Candy Planets"(y) {
      blob(TL - 200, y - 60, 120, '#ff9ad5');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(TL - 200, y - 60, 80, st.t * 0.5, st.t * 0.5 + 4); ctx.stroke();
      ctx.strokeStyle = '#7ddc6f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(TL - 200, y - 60, 180, 30, -0.3, 0, TAU); ctx.stroke();
    },
    "Rubber Duck Galaxy"(y) {
      drawDuck(TL - 200, y - 80, 5, 1);
      for (let i = 0; i < 6; i++) drawDuck(TL - 300 + i * 50, y + 40 + (i % 2) * 20, 0.9, i);
    },
    "Hall of Mirrors"(y) {
      // mirrors on both sides of the tower, each showing the elevator again, smaller and smaller
      const panes = [[TL - 100, 0.62], [TL - 190, 0.5], [TL - 262, 0.4], [TL - 320, 0.32], [CX + 120, 0.62], [CX + 210, 0.5], [CX + 282, 0.4], [CX + 340, 0.32]];
      panes.forEach(([x, s], i) => {
        const w = 150 * s, h = 220 * s, top = y - 80 - h / 2;
        ctx.fillStyle = '#e8c45a'; ctx.beginPath(); ctx.roundRect(x - w / 2 - 6, top - 6, w + 12, h + 12, 10); ctx.fill();
        const g = ctx.createLinearGradient(x - w / 2, top, x + w / 2, top + h);
        const hue = (i * 45 + st.t * 40) % 360;
        g.addColorStop(0, `hsl(${hue},60%,82%)`); g.addColorStop(1, `hsl(${(hue + 80) % 360},55%,62%)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - w / 2, top, w, h, 6); ctx.fill();
        ctx.save(); ctx.translate(x, y - 80 + Math.sin(st.t * 2 + i) * 3); ctx.scale(s * 0.8 * (i < 4 ? -1 : 1), s * 0.8);
        drawCapsule(clamp(dim(), 0.08, 1), false); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.moveTo(x - w * 0.3, top + h * 0.15); ctx.lineTo(x - w * 0.05, top + h * 0.02); ctx.stroke();
      });
    }
  };
  function drawFeatures() {
    for (const s of ELEV_STOPS) {
      const f = FEATURE[s.name];
      if (!f) continue;
      const y = sy(s.alt);
      if (y < -400 || y > H + 400) continue;
      f(y);
    }
  }

  // ---- The elevator --------------------------------------------------------------------
  function carPose() {
    let x = CX, y = SY, tilt = 0;
    if (dim() < 0.3 && !st.crash && !st.dead) { x += (Math.random() - 0.5) * 3; y += (Math.random() - 0.5) * 3; }
    if (st.dead) y += Math.min(st.deadT * 50, 30);
    if (st.crash && st.crash.boom) tilt = Math.min(st.crash.since * 0.8, 0.25);
    return { x, y, tilt };
  }
  // a rounded glass capsule with its operator, drawn at the origin
  function drawCapsule(lit, sad) {
    // a rounded glass capsule
    ctx.fillStyle = '#c9d0dc'; ctx.beginPath(); ctx.roundRect(-58, -82, 116, 164, 22); ctx.fill();
    const g = ctx.createLinearGradient(-50, 0, 50, 0);
    g.addColorStop(0, mixc('#24304a', '#bfe9ff', lit)); g.addColorStop(0.5, mixc('#2a3654', '#eaf8ff', lit)); g.addColorStop(1, mixc('#24304a', '#9fd8ff', lit));
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-50, -74, 100, 148, 16); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.roundRect(-44, -68, 14, 120, 7); ctx.fill();
    rect(-58, 10, 116, 10, '#8a92a4');
    // the operator in a bellhop hat
    const bob = Math.sin(st.t * 3) * 1.5;
    rect(-16, -10 + bob, 32, 44, '#c0392b'); rect(-5, -6 + bob, 10, 26, '#ffd23f');
    rect(-16, 34, 13, 30, '#2a2a3a'); rect(3, 34, 13, 30, '#2a2a3a');
    blob(0, -26 + bob, 15, '#ffd7a8');
    rect(-13, -46 + bob, 26, 9, '#c0392b'); rect(-15, -38 + bob, 30, 4, '#a02a20');
    blob(-5, -28 + bob, 2, '#222'); blob(5, -28 + bob, 2, '#222');
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath();
    if (sad) ctx.arc(0, -16 + bob, 4, 1.15 * Math.PI, 1.85 * Math.PI); else ctx.arc(0, -20 + bob, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  function drawCar() {
    const p = carPose();
    // the cable up the side of the tower (whipping loose if it snapped)
    ctx.strokeStyle = '#3a3f52'; ctx.lineWidth = 3;
    if (st.crash) { ctx.beginPath(); ctx.moveTo(p.x, p.y - 82); ctx.quadraticCurveTo(p.x + 40 * Math.sin(st.t * 10), p.y - 180, p.x - 20, p.y - 280); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(p.x, -40); ctx.lineTo(p.x, p.y - 82); ctx.stroke(); }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt);
    const lit = clamp(dim(), 0.08, 1);
    drawCapsule(lit, st.dead || st.crash || dim() < 0.3);
    // the floor counter on top of the car
    ctx.fillStyle = '#1d2030'; ctx.beginPath(); ctx.roundRect(-40, -110, 80, 24, 8); ctx.fill();
    const n = Math.round(floorAt(st.cam));
    ctx.fillStyle = lit < 0.3 ? '#ff5d5d' : '#ffb52e'; ctx.font = '700 16px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(dim() < 0.2 && Math.random() < 0.4 ? '--' : (n >= 1e9 ? '∞' : n.toLocaleString()), 0, -92);
    poly([[-48, -98], [-42, -106], [-42, -90]], st.vel > 5 ? '#7dffb0' : '#444');
    ctx.restore();
  }

  // ---- Particles ---------------------------------------------------------------------------
  function emit(dt) {
    const p = carPose();
    if ((dim() < 0.25 || st.dead) && Math.random() < dt * 12) {
      for (let i = 0; i < 6; i++) parts.push({ k: 'spark', x: p.x + rand(-10, 10), y: p.y - 82, vx: rand(-160, 160), vy: rand(-200, 40), g: 600, life: rand(0.3, 0.7), max: 0.7, size: rand(1.5, 3), color: Math.random() < 0.5 ? '#ffd23f' : '#fff6c0' });
    }
    if (Math.abs(st.vel) > 220 && Math.random() < dt * 30) parts.push({ k: 'line', x: rand(0, W), y: st.vel > 0 ? -60 : H + 60, vx: 0, vy: st.vel > 0 ? 1800 : -1800, g: 0, life: 0.7, max: 0.7, size: 2, color: 'rgba(255,255,255,0.35)' });
  }

  // ---- Crash (a bad word): the cable snaps and the elevator plunges to the street ------------
  function updateCrash(dt) {
    const c = st.crash;
    c.t += dt;
    if (c.boom) { c.since += dt; return; }
    if (c.t < 0.5) { st.shake = Math.max(st.shake, 0.5); return; }
    c.p = Math.min(1, (c.t - 0.5) / c.dur);
    st.cam = c.top * (1 - Math.pow(c.p, 3));
    if (c.p >= 1) {
      c.boom = true; c.since = 0; st.cam = 0; st.flash = 1; st.shake = 1.5;
      for (let i = 0; i < 50; i++) { const a = rand(Math.PI, TAU), sp = rand(100, 500); parts.push({ k: 'dust', x: CX + rand(-60, 60), y: SY + 80, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, g: 300, life: rand(0.8, 1.6), max: 1.6, size: rand(10, 24), color: '#b8a890' }); }
      for (let i = 0; i < 40; i++) { const a = rand(0, TAU), sp = rand(150, 500); parts.push({ k: 'spark', x: CX, y: SY + 70, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 500, life: rand(0.4, 0.9), max: 0.9, size: rand(2, 4), color: '#ffd23f' }); }
      fx.push({ k: 'ring', x: CX, y: SY + 70, r: 420, life: 0.7, max: 0.7, color: '#ffe7b0' });
    }
  }

  // ---- Update / draw --------------------------------------------------------------------------
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
    if (dim() < 0.2 && !st.dead) st.shake = Math.max(st.shake, 0.06);
    st.flash = Math.max(0, st.flash - dt * 2);
    // lights flicker when the power gets low, more the lower it is
    st.flickT -= dt;
    if (st.flickT <= 0) {
      const p = st.dead ? 0 : st.power;
      st.flick = p < 0.4 && Math.random() < (0.4 - p) * 2 ? rand(0.2, 0.7) : 1;
      st.flickT = rand(0.05, 0.25);
    }
    emit(dt);
    const dy = (st.cam - prev) * K;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += (q.g || 0) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt + (q.k === 'line' ? 0 : dy);
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
    const [top, bot] = skyCols(st.cam);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    rect(-30, -30, W + 60, H + 60, g);
    drawStars();
    drawSun();
    drawCity();
    drawThings(false);
    drawTower();
    drawThings(true);
    drawFeatures();
    for (const q of parts) {
      const a = q.life / q.max;
      if (q.k === 'dust') { ctx.globalAlpha = a * 0.6; blob(q.x, q.y, q.size, q.color); }
      else if (q.k === 'line') { ctx.globalAlpha = a; rect(q.x, q.y, 2, 70, q.color); }
    }
    ctx.globalAlpha = 1;
    if (!(st.crash && st.crash.boom && st.crash.since > 1.4)) drawCar();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of parts) if (q.k === 'spark') { ctx.globalAlpha = q.life / q.max; blob(q.x, q.y, q.size, q.color); }
    ctx.restore(); ctx.globalAlpha = 1;
    // a neon LOW POWER sign flickers on the tower
    if (dim() < 0.3 && !st.crash && Math.sin(st.t * 6) > -0.2) {
      ctx.fillStyle = '#1d2030'; ctx.beginPath(); ctx.roundRect(TL + 10, 150, TR - TL - 20, 40, 10); ctx.fill();
      ctx.fillStyle = '#ff4a4a'; ctx.font = '700 22px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(st.dead ? '⚠ POWER OUT' : '⚠ LOW POWER', (TL + TR) / 2, 178);
    }
    if (st.dead) rect(-30, -30, W + 60, H + 60, `rgba(0,0,10,${Math.min(0.5, st.deadT * 0.5)})`);
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
    // 0..1: the tower dims, flickers and panics as this drops
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
      for (let i = 0; i < 12; i++) parts.push({ k: 'spark', x: p.x + rand(-20, 20), y: p.y - 82, vx: rand(-200, 200), vy: rand(-220, 0), g: 600, life: rand(0.3, 0.6), max: 0.6, size: rand(1.5, 3), color: '#ffd23f' });
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
