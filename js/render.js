'use strict';
/* Claude Code Clicker: canvas rendering for the sparkle stage and the workspace. */

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const motionQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const stillMode = () => !G.settings.motion || (motionQuery && motionQuery.matches);

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawParts(ctx, parts, size) {
  ctx.save();
  ctx.scale(size / 32, size / 32);
  for (const p of parts) {
    const path = p._p || (p._p = new Path2D(p.d));
    if (p.f) { ctx.fillStyle = p.f; ctx.fill(path); }
    if (p.s) {
      ctx.strokeStyle = p.s; ctx.lineWidth = p.w || 1.5;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
  }
  ctx.restore();
}
// The browser may silently discard a canvas's pixels (GPU memory pressure, long background tabs).
// Offscreen caches keep their context so we can notice and rebuild them.
const lostCanvas = c => !c || !c.width || (c._ctx && typeof c._ctx.isContextLost === 'function' && c._ctx.isContextLost());

function makeSprite(parts, size) {
  const r = dpr(), c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * r);
  const x = c.getContext('2d');
  c._ctx = x;
  x.scale(r, r);
  drawParts(x, parts, size);
  return c;
}
// Offscreen canvas with its origin at the centre; `paint(ctx, R)` draws into it.
function centredCache(R, paint) {
  const r = dpr(), s = Math.ceil(R * 2 + 8), c = document.createElement('canvas');
  c.width = c.height = Math.ceil(s * r);
  const x = c.getContext('2d');
  c._ctx = x;
  x.scale(r, r);
  x.translate(s / 2, s / 2);
  paint(x, R);
  c.size = s;
  return c;
}

const HAND_GROUP_AT = 100; // start grouping hands at this many Autocompletes
const HAND_GROUP = 10;     // Autocompletes per big hand
const HANDS_PER_RING = 25;
const HAND_RINGS = 3;
const BIG_HAND = [
  { ...BUILDINGS[0].icon[0], _p: null, f: '#F2C57C', s: '#4A2F10' },
  { ...BUILDINGS[0].icon[1], _p: null, s: '#B9853A' },
];

// Gold-hand tap curve for one cycle (phase 0..1): offset outward in sparkle radii, size, and tilt in radians.
const GOLD_SLAM = 0.11;
function goldTap(p) {
  if (p < 0.08) { // wind up: lean back and tilt
    const e = Math.sin((p / 0.08) * Math.PI / 2);
    return { off: e * 0.12, scale: 1 - e * 0.06, tilt: -e * 0.35 };
  }
  if (p < GOLD_SLAM) { // slam in
    const e = (p - 0.08) / (GOLD_SLAM - 0.08);
    return { off: 0.12 - e * 0.3, scale: 0.94 + e * 0.26, tilt: -0.35 + e * 0.35 };
  }
  if (p < 0.32) { // recoil with a wobble
    const e = (p - GOLD_SLAM) / (0.32 - GOLD_SLAM), ease = 1 - Math.pow(1 - e, 3);
    return { off: -0.18 * (1 - ease), scale: 1.2 - 0.2 * ease, tilt: Math.sin(e * Math.PI * 3) * 0.1 * (1 - e) };
  }
  return { off: 0, scale: 1, tilt: 0 };
}

const RAY_LENS = [1, 0.8, 0.93, 0.76, 0.98, 0.84, 0.9, 0.78, 1, 0.82, 0.95, 0.8];
function paintSparkle(ctx, R) {
  const g = ctx.createRadialGradient(0, 0, R * 0.08, 0, 0, R);
  g.addColorStop(0, '#FBC3A6');
  g.addColorStop(0.55, '#DF7D5A');
  g.addColorStop(1, '#B4502F');
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  RAY_LENS.forEach((len, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 12 + (i % 2 ? 0.035 : -0.02);
    const w = R * (i % 3 === 0 ? 0.19 : 0.165);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.1, Math.sin(a) * R * 0.1);
    ctx.lineTo(Math.cos(a) * (len * R - w / 2), Math.sin(a) * (len * R - w / 2));
    ctx.stroke();
  });
  ctx.fillStyle = '#E2825F';
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.21, 0, Math.PI * 2);
  ctx.fill();
  // A soft sheen across the upper-left rays.
  ctx.globalCompositeOperation = 'source-atop';
  const s = ctx.createLinearGradient(-R, -R, R * 0.5, R * 0.5);
  s.addColorStop(0, 'rgba(255,240,225,.38)');
  s.addColorStop(0.55, 'rgba(255,240,225,0)');
  ctx.fillStyle = s;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.globalCompositeOperation = 'source-over';
}
function paintShine(ctx, R) {
  const n = 14;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, 'rgba(242,197,124,.34)');
  g.addColorStop(1, 'rgba(242,197,124,0)');
  ctx.fillStyle = g;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, a, a + (Math.PI / n) * 0.55);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------- the sparkle stage (left pane) ----------
const Stage = {
  init(cv) {
    Object.assign(this, { cv, ctx: cv.getContext('2d'), t: 0, w: 0, h: 0, squish: 0, hover: false, hs: 1, spin: 0, parts: [], floats: [], rain: [], waves: [], goldPrev: new Float32Array(HANDS_PER_RING * HAND_RINGS).fill(-1) });
    new ResizeObserver(() => this.resize()).observe(cv);
    cv.addEventListener('contextrestored', () => this.resize());
    this.resize();
    cv.addEventListener('pointerdown', e => {
      const p = this.local(e);
      if (this.hit(p.x, p.y)) { e.preventDefault(); this.clickAt(p.x, p.y); }
    });
    cv.addEventListener('pointermove', e => {
      const p = this.local(e);
      this.hover = this.hit(p.x, p.y);
      cv.style.cursor = this.hover ? 'pointer' : 'default';
    });
    cv.addEventListener('pointerleave', () => { this.hover = false; });
    cv.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); this.clickAt(this.cx, this.cy - this.R * 0.3); }
    });
  },
  local(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  },
  hit(x, y) { return Math.hypot(x - this.cx, y - this.cy) < this.R * 0.95; },
  clickAt(x, y) {
    const v = clickSparkle();
    Spinner.made += v;
    this.squish = 1;
    this.pop(x, y, v);
    Sound.click();
    emit('clicked');
  },
  resize() {
    const r = dpr(), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (!w || !h) return;
    Object.assign(this, { w, h, cx: w / 2, cy: h * 0.52 });
    this.cv.width = Math.round(w * r);
    this.cv.height = Math.round(h * r);
    this.ctx.setTransform(r, 0, 0, r, 0, 0);
    this.R = Math.max(52, Math.min(w * 0.25, h * 0.215));
    this.sparkle = centredCache(this.R * 1.02, paintSparkle);
    this.shine = centredCache(this.R * 2.7, paintShine);
    this.cursorSize = clamp(this.R * 0.23, 16, 26);
    this.cursor = makeSprite(BUILDINGS[0].icon, this.cursorSize);
    // From 100 Autocompletes on, each gold hand stands for 10 of them.
    this.bigSize = Math.round(this.cursorSize * 1.45);
    this.bigCursor = makeSprite(BIG_HAND, this.bigSize);
  },
  pop(x, y, v) {
    if (G.settings.particles) {
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 220;
        this.parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0, max: 0.6 + Math.random() * 0.5,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, size: 4 + Math.random() * 5,
          col: Math.random() < 0.25 ? '#F2C57C' : '#E88B68',
        });
      }
      if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);
    }
    if (G.settings.floaters) {
      this.floats.push({ x: x + (Math.random() - 0.5) * 24, y: y - 12, text: '+' + fmt(v), life: 0, max: 1.1 });
      if (this.floats.length > 40) this.floats.splice(0, this.floats.length - 40);
    }
  },
  newDrop(anywhere) {
    return {
      x: Math.random() * this.w, y: anywhere ? Math.random() * this.h : -20, vy: 25 + Math.random() * 55,
      rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 0.4, size: Math.round(10 + Math.random() * 9),
      a: 0.05 + Math.random() * 0.12, g: pick(RAIN_GLYPHS), col: Math.random() < 0.3 ? '#D97757' : '#F3E9DF',
    };
  },
  frame(dt) {
    if (!this.cv.clientWidth) return;
    if (this.cv.clientWidth !== this.w || this.cv.clientHeight !== this.h) this.resize();
    if (this.ctx.isContextLost && this.ctx.isContextLost()) return;
    // Make sure the cached images still exist; rebuild them if the browser dropped them.
    if (lostCanvas(this.sparkle) || lostCanvas(this.shine) || lostCanvas(this.cursor) || lostCanvas(this.bigCursor)) this.resize();
    if (!Number.isFinite(this.spin)) this.spin = 0;
    const c = this.ctx, still = stillMode();
    this.t += dt;
    const t = this.t;
    c.clearRect(0, 0, this.w, this.h);

    this.drawRain(dt, still);

    // Warm glow behind the sparkle; it swells during production buffs.
    const boost = D.buffProd > 1 ? 1 : 0;
    const glowR = this.R * (1.9 + boost * 0.25 + (still ? 0 : Math.sin(t * 1.3) * 0.06));
    const g = c.createRadialGradient(this.cx, this.cy, this.R * 0.2, this.cx, this.cy, glowR);
    g.addColorStop(0, boost ? 'rgba(242,197,124,.5)' : 'rgba(217,119,87,.42)');
    g.addColorStop(0.5, 'rgba(217,119,87,.12)');
    g.addColorStop(1, 'rgba(217,119,87,0)');
    c.fillStyle = g;
    c.fillRect(this.cx - glowR, this.cy - glowR, glowR * 2, glowR * 2);

    const sh = this.shine, ss = sh.size;
    c.save();
    c.translate(this.cx, this.cy);
    c.globalAlpha = 0.55 + boost * 0.35;
    c.rotate(still ? 0 : t * 0.12);
    c.drawImage(sh, -ss / 2, -ss / 2, ss, ss);
    c.rotate(still ? 0.3 : -t * 0.32);
    c.globalAlpha *= 0.6;
    c.drawImage(sh, -ss * 0.4, -ss * 0.4, ss * 0.8, ss * 0.8);
    c.restore();

    this.drawCursors(t, still);

    // The sparkle itself: breathes, squishes on click, grows on hover, spins faster with production.
    this.squish *= Math.exp(-dt * 10);
    this.hs += ((this.hover ? 1.04 : 1) - this.hs) * Math.min(1, dt * 10);
    const sc = this.hs + (still ? 0 : Math.sin(t * 1.6) * 0.012) - this.squish * 0.07;
    if (!still) this.spin += dt * (0.05 + Math.min(0.5, Math.log10(D.tps + 1) * 0.03)) * (1 + boost);
    const sp = this.sparkle, s2 = sp.size * sc;
    c.save();
    c.translate(this.cx, this.cy);
    c.rotate(this.spin);
    c.drawImage(sp, -s2 / 2, -s2 / 2, s2, s2);
    c.restore();

    this.drawWaves(dt);
    this.drawParticles(dt);
    this.drawFlow(t, still);
    this.drawFloats(dt);
  },
  drawRain(dt, still) {
    const want = still ? 0 : Math.min(60, Math.floor(Math.log10(D.tps + 1) * 9));
    const r = this.rain;
    while (r.length < want) r.push(this.newDrop(true));
    if (r.length > want) r.length = want;
    if (!r.length) return;
    const c = this.ctx;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const d of r) {
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      if (d.y > this.h + 20) Object.assign(d, this.newDrop(false));
      c.save();
      c.globalAlpha = d.a;
      c.fillStyle = d.col;
      c.font = `500 ${d.size}px 'Martian Mono', ui-monospace, monospace`;
      c.translate(d.x, d.y);
      c.rotate(d.rot);
      c.fillText(d.g, 0, 0);
      c.restore();
    }
  },
  // Hands orbiting the sparkle. Under 100 Autocompletes: one small hand each, 50 per circle.
  // From 100 on: one big gold hand per 10 (25 per circle, up to 3 circles), plus the remaining 0-9 as small hands.
  drawCursors(t, still) {
    const owned = G.owned[0];
    if (!owned) return;
    let perRing, big, small;
    if (owned < HAND_GROUP_AT) {
      perRing = 50; big = 0; small = owned;
    } else {
      perRing = HANDS_PER_RING;
      big = Math.min(HANDS_PER_RING * HAND_RINGS, Math.floor(owned / HAND_GROUP));
      small = Math.min(owned % HAND_GROUP, HANDS_PER_RING * HAND_RINGS - big);
    }
    const n = big + small, rings = Math.ceil(n / perRing);
    const c = this.ctx, biggest = big ? this.bigSize : this.cursorSize;
    // Spread the circles over the space around the sparkle so the outer one never leaves the panel.
    const r0 = this.R * 1.12;
    const room = Math.min(this.cx, this.h - this.cy, this.cy - 24) - biggest * 0.95;
    const gap = rings > 1 ? clamp((room - r0) / (rings - 1), this.R * 0.13, this.R * 0.3) : 0;
    for (let i = 0; i < n; i++) {
      const isBig = i < big, size = isBig ? this.bigSize : this.cursorSize, spr = isBig ? this.bigCursor : this.cursor;
      const ring = Math.floor(i / perRing), k = i % perRing;
      const a = (k / perRing) * Math.PI * 2 + ring * (Math.PI / perRing) + (still ? 0 : t * 0.04 * (ring % 2 ? -1 : 1));
      let rad = r0 + ring * gap, scale = 1, tilt = 0;
      if (!still && isBig) {
        // Gold hands: wind up, slam, wobble back. The taps roll around each circle as a wave every 6 seconds.
        const phase = (t / 6 + k / perRing + ring * 0.33) % 1, m = goldTap(phase);
        rad += m.off * this.R;
        scale = m.scale;
        tilt = m.tilt;
        const prev = this.goldPrev[i];
        if (prev >= 0 && prev < GOLD_SLAM && phase >= GOLD_SLAM && phase - prev < 0.5) this.slam(a, rad, ring);
        this.goldPrev[i] = phase;
      } else if (!still) {
        // Small hands tap once every ten seconds, staggered around the circle.
        const phase = (t / 10 + k / perRing + ring * 0.33) % 1;
        if (phase < 0.06) rad -= Math.sin((phase / 0.06) * Math.PI) * this.R * 0.08;
      }
      const sz = size * scale;
      c.save();
      c.translate(this.cx + Math.cos(a) * rad, this.cy + Math.sin(a) * rad);
      c.rotate(a - Math.PI / 2 + tilt);
      c.drawImage(spr, -sz * (12.5 / 32), -sz * (2 / 32), sz, sz); // fingertip touches the circle
      c.restore();
    }
  },
  // A gold hand just landed its tap: shockwave ring plus a few sparks at the fingertip.
  slam(a, rad, ring) {
    const x = this.cx + Math.cos(a) * rad, y = this.cy + Math.sin(a) * rad;
    this.waves.push({ x, y, life: 0, max: 0.55, big: ring === 0 ? 1 : 0.85 });
    if (this.waves.length > 60) this.waves.shift();
    if (!G.settings.particles) return;
    for (let j = 0; j < 3; j++) {
      const ang = a + Math.PI + (Math.random() - 0.5) * 1.6, sp = 70 + Math.random() * 90;
      this.parts.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40, life: 0, max: 0.45 + Math.random() * 0.25,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, size: 2.5 + Math.random() * 2.5, col: '#F2C57C',
      });
    }
  },
  drawWaves(dt) {
    if (!this.waves.length) return;
    const c = this.ctx;
    this.waves = this.waves.filter(w => (w.life += dt) < w.max);
    for (const w of this.waves) {
      const p = w.life / w.max, ease = 1 - Math.pow(1 - p, 3);
      const r = (3 + ease * this.R * 0.2) * w.big;
      c.globalAlpha = (1 - p) * 0.9;
      c.strokeStyle = '#F2C57C';
      c.lineWidth = 3 * (1 - p) + 0.6;
      c.beginPath();
      c.arc(w.x, w.y, r, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = (1 - p) * 0.35;
      c.fillStyle = '#FFE7B8';
      c.beginPath();
      c.arc(w.x, w.y, r * 0.45, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  },
  drawParticles(dt) {
    const c = this.ctx;
    c.lineCap = 'round';
    this.parts = this.parts.filter(p => (p.life += dt) < p.max);
    for (const p of this.parts) {
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      c.save();
      c.globalAlpha = 1 - p.life / p.max;
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.strokeStyle = p.col;
      c.lineWidth = p.size * 0.42;
      c.beginPath();
      c.moveTo(-p.size, 0); c.lineTo(p.size, 0);
      c.moveTo(0, -p.size); c.lineTo(0, p.size);
      c.stroke();
      c.restore();
    }
  },
  drawFloats(dt) {
    const c = this.ctx;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = "600 15px 'Martian Mono', ui-monospace, monospace";
    c.lineJoin = 'round';
    this.floats = this.floats.filter(f => (f.life += dt) < f.max);
    for (const f of this.floats) {
      f.y -= 55 * dt;
      c.globalAlpha = 1 - Math.pow(f.life / f.max, 2);
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(20,12,16,.85)';
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = '#F3E9DF';
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  },
  // "Flow" rises from the bottom as you unlock achievements.
  drawFlow(t, still) {
    const c = this.ctx, w = this.w, h = this.h;
    const level = h * (0.035 + Math.min(1, D.flow / 5) * 0.16);
    const layer = (amp, len, speed, off, col) => {
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w + 10; x += 10) {
        const tt = still ? 0 : t * speed;
        c.lineTo(x, h - level - off + Math.sin(x / len + tt) * amp + Math.sin(x / (len * 0.43) - tt * 1.7) * amp * 0.4);
      }
      c.lineTo(w, h);
      c.closePath();
      c.fillStyle = col;
      c.fill();
    };
    layer(6, 60, 1.1, 7, 'rgba(242,197,124,.13)');
    layer(5, 48, -1.4, 0, 'rgba(217,119,87,.30)');
  },
};

// ---------- the workspace (middle pane): one lane per building type ----------
const Workspace = {
  ROW: 78,
  init(cv) {
    Object.assign(this, { cv, ctx: cv.getContext('2d'), sprites: {}, bits: [], t: 0, sig: '' });
    cv.addEventListener('contextrestored', () => this.refresh());
  },
  refresh() { this.sprites = {}; this.sig = ''; },
  sprite(i) {
    const r = dpr(), s = this.sprites[i];
    if (s && s.r === r && !lostCanvas(s.c)) return s.c;
    const c = makeSprite(BUILDINGS[i].icon, 30);
    this.sprites[i] = { c, r };
    return c;
  },
  layout() {
    const list = [];
    for (let i = 0; i < N; i++) if (G.owned[i] > 0) list.push(i);
    const w = this.cv.clientWidth, r = dpr();
    const sig = `${list.length}|${w}|${r}`;
    if (sig !== this.sig) {
      this.sig = sig;
      this.w = w;
      this.h = list.length * this.ROW;
      this.cv.style.height = this.h + 'px';
      this.cv.width = Math.round(w * r);
      this.cv.height = Math.round(this.h * r);
      this.ctx.setTransform(r, 0, 0, r, 0, 0);
      document.getElementById('wsEmpty').hidden = list.length > 0;
    }
    return list;
  },
  frame(dt) {
    const list = this.layout();
    if (!list.length || !this.w || (this.ctx.isContextLost && this.ctx.isContextLost())) return;
    const c = this.ctx, W = this.w, R = this.ROW, still = stillMode();
    const t = (this.t += dt);
    c.clearRect(0, 0, W, this.h);

    list.forEach((i, row) => {
      const b = BUILDINGS[i], y0 = row * R, n = G.owned[i];
      const g = c.createLinearGradient(0, y0, W, y0);
      g.addColorStop(0, hexA(b.color, 0.2));
      g.addColorStop(1, hexA(b.color, 0.03));
      c.fillStyle = g;
      c.fillRect(0, y0, W, R - 2);
      c.fillStyle = hexA(b.color, 0.1);
      c.fillRect(0, y0 + R - 18, W, 16);
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fillRect(0, y0 + R - 2, W, 2);

      const spr = this.sprite(i), size = 30, shown = Math.min(n, 140);
      const step = Math.max(5, Math.min(34, (W - 48) / Math.max(1, shown)));
      for (let j = 0; j < shown; j++) {
        const h1 = hash(i * 1000 + j), h2 = hash(i * 7 + j * 13);
        const bob = still ? 0 : Math.sin(t * 2.2 + j * 1.7 + i) * 1.6;
        const hop = still ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.9 + h1 * 40)), 30) * 7;
        const x = 14 + j * step + (h1 - 0.5) * Math.min(step, 8);
        const y = y0 + 30 + (h2 - 0.5) * 14 - bob - hop;
        c.drawImage(spr, x, y, size, size);
      }

      // Little sparks of output drifting up from the lane.
      if (!still && Math.random() < dt * Math.min(n, 30) * 0.12) {
        this.bits.push({ x: 20 + Math.random() * Math.min(W - 40, shown * step), y: y0 + 34, life: 0, col: b.color });
      }

      const label = `${n === 1 ? b.name : b.plural} × ${n.toLocaleString('en-US')}`;
      const rate = `${fmt(n * D.each[i] * D.mult * D.buffProd)}/s`;
      c.font = "600 10.5px 'Martian Mono', ui-monospace, monospace";
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      const lw = c.measureText(label).width, rw = c.measureText(rate).width;
      c.fillStyle = 'rgba(19,13,16,.78)';
      c.beginPath();
      c.roundRect ? c.roundRect(8, y0 + 6, lw + rw + 30, 19, 6) : c.rect(8, y0 + 6, lw + rw + 30, 19);
      c.fill();
      c.fillStyle = '#F3E9DF';
      c.fillText(label, 16, y0 + 16);
      c.fillStyle = b.color;
      c.fillText(rate, 28 + lw, y0 + 16);
    });

    c.textAlign = 'center';
    c.font = "600 12px 'Martian Mono', ui-monospace, monospace";
    this.bits = this.bits.filter(p => (p.life += dt) < 1.2);
    for (const p of this.bits) {
      c.globalAlpha = 1 - p.life / 1.2;
      c.fillStyle = p.col;
      c.fillText('✻', p.x, p.y - p.life * 26);
    }
    c.globalAlpha = 1;
  },
};
