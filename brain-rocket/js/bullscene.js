/* Brain Rocket — the Bullseye world: a sunny medieval archery range. Bunting across the sky, a
   castle on the hill, striped tents, and one big straw target that collects the day's 15 arrows.
   The game calls shoot(ring) for each answer: ring 0 is the bullseye, 1-4 are the rings further
   out (one per rarity tier off), and -1 is a miss. Same public API as the other worlds. */
'use strict';

const BullScene = (function () {
  const W = 1600, H = 900, TAU = Math.PI * 2;
  const TX = 440, TY = 395, R = 180, RING = R / 5;   // the target, in world coordinates
  const GROUND = 650;
  // inside to out: gold, red, blue, black, white, like a real archery target
  const RING_COLS = ['#ffd23f', '#e8364f', '#2f8fe8', '#2b2b38', '#f6f2e6'];
  const RING_EDGE = ['#d9a400', '#b8243b', '#1f6cbc', '#111118', '#cfc6ad'];

  let canvas, ctx, pxScale = 1, onMilestone = null;
  const st = { t: 0, arrows: [], flights: [], shake: 0, flash: 0, flashCol: '255,255,255', tilt: 0, crash: null, dead: false, title: false, wobble: 0 };
  const parts = [], fx = [];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const poly = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };

  // Where an arrow lands: a random spot inside its ring, or off the face for a miss.
  function landing(ring) {
    const a = rand(0, TAU);
    if (ring < 0) {
      // a miss thuds into the straw rim, or flies wide and sticks in the grass
      if (Math.random() < 0.6) { const r = R + rand(8, 26); return [TX + Math.cos(a) * r, TY + Math.sin(a) * r, false]; }
      return [TX + rand(-320, 260), GROUND + rand(20, 120), true];
    }
    const r = (ring + rand(0.18, 0.82)) * RING;
    return [TX + Math.cos(a) * r, TY + Math.sin(a) * r, false];
  }

  // ---- Drawing ----------------------------------------------------------------------------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#7cc6ff'); g.addColorStop(1, '#e6f6ff');
    rect(-30, -30, W + 60, GROUND + 30, g);
    // sun
    const sg = ctx.createRadialGradient(1260, 150, 10, 1260, 150, 160);
    sg.addColorStop(0, 'rgba(255,248,200,0.9)'); sg.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(1260, 150, 160, 0, TAU); ctx.fill();
    blob(1260, 150, 58, '#fff6c8');
    // drifting clouds
    for (let i = 0; i < 5; i++) {
      const x = ((hash(i) * W + st.t * (8 + i * 3)) % (W + 400)) - 200, y = 90 + hash(i + 9) * 170, s = 0.7 + hash(i + 3) * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [dx, dy, r] of [[0, 0, 34], [36, -14, 40], [76, 0, 32], [38, 10, 30]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill(); }
    }
  }
  function drawHills() {
    // far hill with a castle on it
    const farY = x => GROUND - 150 - 60 * Math.sin(x / 260) - 30 * Math.sin(x / 97 + 1);
    ctx.fillStyle = '#9fd48a'; ctx.beginPath(); ctx.moveTo(-30, GROUND);
    for (let x = -30; x <= W + 30; x += 30) ctx.lineTo(x, farY(x));
    ctx.lineTo(W + 30, GROUND); ctx.fill();
    // stand the castle on the lowest point of the hill under it, then bank grass up around its foot
    const cx = 205;
    let base = 0;
    for (let x = cx - 100; x <= cx + 110; x += 10) base = Math.max(base, farY(x));
    drawCastle(cx, base + 4);
    ctx.fillStyle = '#9fd48a'; ctx.beginPath(); ctx.ellipse(cx + 5, base + 6, 135, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7cc56a'; ctx.beginPath(); ctx.moveTo(-30, GROUND);
    for (let x = -30; x <= W + 30; x += 30) ctx.lineTo(x, GROUND - 70 - 30 * Math.sin(x / 180 + 2));
    ctx.lineTo(W + 30, GROUND); ctx.fill();
  }
  function drawCastle(x, y) {
    const c = '#b9b2c9', d = '#9d95b0';
    rect(x - 70, y - 70, 140, 70, c);
    for (let i = 0; i < 7; i++) rect(x - 70 + i * 20, y - 82, 12, 12, c);
    for (const tx of [-90, 70]) {
      rect(x + tx, y - 120, 30, 120, d);
      poly([[x + tx - 6, y - 120], [x + tx + 15, y - 168], [x + tx + 36, y - 120]], '#6c5fa3');
      // pennant on the tower, rippling
      ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + tx + 15, y - 168); ctx.lineTo(x + tx + 15, y - 192); ctx.stroke();
      poly([[x + tx + 15, y - 192], [x + tx + 40, y - 186 + Math.sin(st.t * 4 + tx) * 3], [x + tx + 15, y - 180]], '#e8364f');
    }
    rect(x - 14, y - 40, 28, 40, '#6c6185');
    ctx.fillStyle = '#6c6185'; ctx.beginPath(); ctx.arc(x, y - 40, 14, Math.PI, 0); ctx.fill();
    for (const wx of [-48, 34]) rect(x + wx, y - 56, 12, 18, '#6c6185');
  }
  function drawTent(x, y, s, a, b) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (let i = 0; i < 6; i++) poly([[-80 + i * 26.6, 0], [-80 + (i + 1) * 26.6, 0], [0, -120]], i % 2 ? a : b);
    poly([[-90, -70], [90, -70], [80, -40], [-80, -40]], a);
    for (let i = 0; i < 6; i++) poly([[-80 + i * 30, -40], [-50 + i * 30, -40], [-65 + i * 30, -24]], b);
    poly([[-14, 0], [14, 0], [0, -46]], '#5a3a20');
    ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(0, -150); ctx.stroke();
    poly([[0, -150], [30, -143 + Math.sin(st.t * 3 + x) * 3], [0, -136]], b);
    ctx.restore();
  }
  function drawGround() {
    const g = ctx.createLinearGradient(0, GROUND, 0, H);
    g.addColorStop(0, '#6ec24d'); g.addColorStop(1, '#4fa23a');
    rect(-30, GROUND, W + 60, H - GROUND + 30, g);
    // mowed stripes
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 220 - 120, H); ctx.lineTo(i * 220 - 20, H); ctx.lineTo(i * 180 + 60, GROUND); ctx.lineTo(i * 180 - 10, GROUND); ctx.fill(); }
    // a wooden fence along the back of the range
    for (let x = -10; x < W + 40; x += 64) { rect(x, GROUND - 46, 10, 52, '#8a5a32'); rect(x + 2, GROUND - 50, 6, 6, '#a06a3c'); }
    rect(-20, GROUND - 38, W + 60, 8, '#9a6a3c'); rect(-20, GROUND - 18, W + 60, 8, '#9a6a3c');
  }
  function drawBunting() {
    const y0 = 34, sag = 46, n = 26;
    ctx.strokeStyle = '#6b4b2a'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const x = -20 + i * (W + 40) / 60, f = i / 60; const y = y0 + sag * 4 * f * (1 - f); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    const cols = ['#e8364f', '#ffd23f', '#2f8fe8', '#7ddc6f', '#ff9a3c', '#b04dff'];
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, x = -20 + f * (W + 40), y = y0 + sag * 4 * f * (1 - f), sw = Math.sin(st.t * 2.4 + i) * 4;
      poly([[x - 16, y], [x + 16, y], [x + sw, y + 34]], cols[i % cols.length]);
    }
  }
  function drawStand() {
    // a wooden easel behind the straw boss
    ctx.strokeStyle = '#7a4a24'; ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(TX - 110, TY + 120); ctx.lineTo(TX - 170, GROUND + 70); ctx.moveTo(TX + 110, TY + 120); ctx.lineTo(TX + 170, GROUND + 70); ctx.stroke();
    ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(TX, TY + 100); ctx.lineTo(TX, GROUND + 50); ctx.stroke();
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(TX - 140, TY + 230); ctx.lineTo(TX + 140, TY + 230); ctx.stroke();
    // its shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(TX, GROUND + 74, 210, 20, 0, 0, TAU); ctx.fill();
  }
  function drawTarget() {
    // the straw boss
    blob(TX, TY, R + 32, '#d7a84a');
    ctx.strokeStyle = 'rgba(120,80,20,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, r1 = R + 6, r2 = R + 30; ctx.beginPath(); ctx.moveTo(TX + Math.cos(a) * r1, TY + Math.sin(a) * r1); ctx.lineTo(TX + Math.cos(a + 0.05) * r2, TY + Math.sin(a + 0.05) * r2); ctx.stroke(); }
    // the face, outside in
    for (let i = 4; i >= 0; i--) {
      blob(TX, TY, (i + 1) * RING, RING_COLS[i]);
      ctx.strokeStyle = RING_EDGE[i]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(TX, TY, (i + 1) * RING, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(TX - 6, TY); ctx.lineTo(TX + 6, TY); ctx.moveTo(TX, TY - 6); ctx.lineTo(TX, TY + 6); ctx.stroke();
  }
  // An arrow stuck in the target: the hole, then the shaft pointing back toward the archer.
  function drawStuck(a) {
    blob(a.x, a.y, 4, 'rgba(30,20,10,0.75)');
    const dx = -Math.cos(a.ang) * a.len, dy = -Math.sin(a.ang) * a.len;
    ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + dx, a.y + dy); ctx.stroke();
    fletch(a.x + dx, a.y + dy, a.ang, a.col, 1);
  }
  function fletch(x, y, ang, col, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    poly([[0, 0], [-18, -10], [-24, -8], [-8, 0]], col);
    poly([[0, 0], [-18, 10], [-24, 8], [-8, 0]], col);
    poly([[2, -2], [-16, -1], [-16, 1], [2, 2]], '#fff');
    ctx.restore();
  }
  function drawFlight(f) {
    const k = clamp(f.t / f.dur, 0, 1), e = 1 - Math.pow(1 - k, 2);
    const x = f.x0 + (f.x - f.x0) * e, y = f.y0 + (f.y - f.y0) * e - Math.sin(Math.PI * k) * 120;
    const k2 = Math.min(1, k + 0.02), e2 = 1 - Math.pow(1 - k2, 2);
    const x2 = f.x0 + (f.x - f.x0) * e2, y2 = f.y0 + (f.y - f.y0) * e2 - Math.sin(Math.PI * k2) * 120;
    const ang = Math.atan2(y2 - y, x2 - x), s = 1.7 - 0.7 * k;   // big when near, smaller as it flies away
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(10, 0); ctx.stroke();
    poly([[10, -5], [22, 0], [10, 5]], '#8a8f9a');
    ctx.restore();
    fletch(x - Math.cos(ang) * 60 * s, y - Math.sin(ang) * 60 * s, ang, f.col, s);
  }

  // ---- Update -------------------------------------------------------------------------------
  function update(dt) {
    st.t += dt;
    st.shake = Math.max(0, st.shake - dt * 3);
    st.flash = Math.max(0, st.flash - dt * 2);
    st.wobble = Math.max(0, st.wobble - dt * 2.5);
    for (let i = st.flights.length - 1; i >= 0; i--) {
      const f = st.flights[i];
      f.t += dt;
      if (f.t >= f.dur) {
        st.flights.splice(i, 1);
        st.arrows.push({ x: f.x, y: f.y, ang: Math.atan2(f.y - f.y0 + 60, f.x - f.x0) * 0.35 + 0.55, len: f.ground ? 34 : 46, col: f.col, ring: f.ring, ground: f.ground });
        st.wobble = 1; st.shake = Math.max(st.shake, f.ring === 0 ? 0.35 : 0.15);
        const n = f.ring === 0 ? 30 : 14;
        for (let k = 0; k < n; k++) { const a = rand(0, TAU), sp = rand(60, 260); parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 500, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 4), color: f.ring < 0 ? '#c9a24a' : f.ring === 0 ? '#ffe27a' : '#e2c57a' }); }
        if (f.ring === 0) { st.flash = 0.6; st.flashCol = '255,236,150'; fx.push({ k: 'ring', x: f.x, y: f.y, r: 260, life: 0.7, max: 0.7, color: '#ffd23f' }); }
        else if (f.ring > 0) fx.push({ k: 'ring', x: f.x, y: f.y, r: 120, life: 0.5, max: 0.5, color: RING_COLS[f.ring] === '#f6f2e6' ? '#ffffff' : RING_COLS[f.ring] });
        if (f.cb) f.cb();
      }
    }
    if (st.crash) {
      const c = st.crash; c.t += dt;
      st.tilt = Math.min(1.5, c.t * c.t * 2.4);
      if (!c.boom && st.tilt >= 1.5) {
        c.boom = true; c.since = 0; st.shake = 1.2; st.flash = 0.5; st.flashCol = '255,255,255';
        for (let k = 0; k < 40; k++) { const a = rand(Math.PI, TAU), sp = rand(100, 420); parts.push({ x: TX + rand(-200, 200), y: GROUND + 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, g: 300, life: rand(0.8, 1.4), max: 1.4, size: rand(8, 18), color: '#c9b48a', dust: true }); }
      }
      if (c.boom) c.since += dt;
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.dust) q.size += 16 * dt;
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      if (f.k === 'confetti') { f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; f.vx *= 0.99; }
    }
  }

  function draw() {
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    if (st.shake) ctx.translate((Math.random() - 0.5) * st.shake * 14, (Math.random() - 0.5) * st.shake * 14);
    drawSky();
    drawHills();
    drawTent(1010, GROUND - 4, 1, '#e8364f', '#fff4e0');
    drawTent(1390, GROUND - 4, 0.8, '#2f8fe8', '#fff4e0');
    drawTent(760, GROUND - 4, 0.62, '#7d4dd8', '#ffd23f');
    drawGround();
    drawStand();
    // the target (and its arrows) wobble when hit, and topple over in a crash
    ctx.save();
    ctx.translate(TX, GROUND + 60); ctx.rotate(st.tilt * 0.9 + Math.sin(st.t * 40) * 0.012 * st.wobble); ctx.translate(-TX, -(GROUND + 60));
    drawTarget();
    for (const a of st.arrows) if (!a.ground) drawStuck(a);
    ctx.restore();
    for (const a of st.arrows) if (a.ground) drawStuck(a);
    for (const f of st.flights) drawFlight(f);
    for (const q of parts) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1) * (q.dust ? 0.6 : 1); blob(q.x, q.y, q.size, q.color); }
    ctx.globalAlpha = 1;
    drawBunting();
    for (const f of fx) {
      if (f.k === 'confetti') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color;
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h * Math.abs(Math.cos(f.rot * 2))); ctx.restore();
      } else if (f.k === 'ring') {
        const a = f.life / f.max;
        ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = 6 * a;
        ctx.beginPath(); ctx.arc(f.x, f.y, (1 - a) * f.r + 10, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    if (st.flash > 0) rect(-30, -30, W + 60, H + 60, `rgba(${st.flashCol},${st.flash * 0.45})`);
  }

  // a few arrows already in the target on the title screen, so it looks like the range is in use
  function decorate() {
    st.arrows = [[0, 0.4], [1, 2.2], [2, 4.1]].map(([ring, a]) => {
      const r = (ring + 0.5) * RING;
      return { x: TX + Math.cos(a) * r, y: TY + Math.sin(a) * r, ang: 0.62, len: 46, col: ['#e8364f', '#2f8fe8', '#ffd23f'][ring], ring };
    });
  }

  return {
    W, H,
    init(c) { canvas = c; ctx = c.getContext('2d'); decorate(); },
    resize(stageScale) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pxScale = stageScale * dpr;
      if (canvas) { canvas.width = Math.round(W * pxScale); canvas.height = Math.round(H * pxScale); }
    },
    update, draw,
    reset() { st.arrows = []; st.flights = []; st.crash = null; st.tilt = 0; st.dead = false; parts.length = 0; fx.length = 0; decorate(); },
    // a fresh target for a new day's game
    clear() { st.arrows = []; },
    get alt() { return 0; },
    setIgnite() {}, setStreak() {}, setTarget() {}, boostTo() {},
    // ring: 0 bullseye … 4 outer ring, -1 a miss. cb runs when the arrow lands.
    shoot(ring, cb) {
      const [x, y, ground] = landing(ring);
      const cols = ['#e8364f', '#2f8fe8', '#7ddc6f', '#ff9a3c', '#b04dff', '#ffd23f'];
      st.flights.push({ x0: -80, y0: 820, x, y, ground, t: 0, dur: 0.55, ring, cb, col: cols[st.arrows.length % cols.length] });
    },
    sputter() { st.shake = 0.3; },
    die() { st.dead = true; },
    crash() { st.crash = { t: 0, boom: false, since: 0 }; },
    get crashDone() { return !!(st.crash && st.crash.boom && st.crash.since > 1.4); },
    get crashBoom() { return !!(st.crash && st.crash.boom); },
    confetti(n = 160) {
      const cols = ['#e8364f', '#ffd23f', '#2f8fe8', '#7ddc6f', '#ff9a3c', '#b04dff'];
      for (let i = 0; i < n; i++) fx.push({ k: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-80, 80), vy: rand(60, 220), rot: rand(0, TAU), vr: rand(-6, 6), w: rand(8, 14), h: rand(10, 18), life: rand(2.5, 4), color: cols[i % cols.length] });
    },
    burst(x, y, color, n = 30) {
      for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(100, 360); parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 4), color }); }
    },
    rocketScreen() { return { x: TX, y: TY }; },
    onMilestone(fn) { onMilestone = fn; },
    TX, TY, R
  };
})();
