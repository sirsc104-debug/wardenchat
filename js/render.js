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
function makeSprite(parts, size) {
  const r = dpr(), c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * r);
  const x = c.getContext('2d');
  x.scale(r, r);
  drawParts(x, parts, size);
  return c;
}
// Offscreen canvas with its origin at the centre; `paint(ctx, R)` draws into it.
function centredCache(R, paint) {
  const r = dpr(), s = Math.ceil(R * 2 + 8), c = document.createElement('canvas');
  c.width = c.height = Math.ceil(s * r);
  const x = c.getContext('2d');
  x.scale(r, r);
  x.translate(s / 2, s / 2);
  paint(x, R);
  c.size = s;
  return c;
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
    Object.assign(this, { cv, ctx: cv.getContext('2d'), t: 0, w: 0, h: 0, squish: 0, hover: false, hs: 1, spin: 0, parts: [], floats: [], rain: [] });
    new ResizeObserver(() => this.resize()).observe(cv);
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
    this.R = Math.max(56, Math.min(w * 0.29, h * 0.23));
    this.sparkle = centredCache(this.R * 1.02, paintSparkle);
    this.shine = centredCache(this.R * 2.7, paintShine);
    this.cursorSize = clamp(this.R * 0.23, 16, 26);
    this.cursor = makeSprite(BUILDINGS[0].icon, this.cursorSize);
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
  drawCursors(t, still) {
    const n = Math.min(G.owned[0], 150);
    if (!n) return;
    const c = this.ctx, s = this.cursorSize, spr = this.cursor;
    for (let i = 0; i < n; i++) {
      const ring = Math.floor(i / 50), k = i % 50;
      const a = (k / 50) * Math.PI * 2 + ring * 0.063 + (still ? 0 : t * 0.04);
      // Each cursor taps the sparkle once every ten seconds, staggered around the ring.
      const phase = (t / 10 + k / 50 + ring * 0.33) % 1;
      const push = still ? 0 : phase < 0.06 ? Math.sin((phase / 0.06) * Math.PI) * this.R * 0.08 : 0;
      const rad = this.R * (1.2 + ring * 0.19) - push;
      c.save();
      c.translate(this.cx + Math.cos(a) * rad, this.cy + Math.sin(a) * rad);
      c.rotate(a - Math.PI / 2);
      c.drawImage(spr, -s * (12.5 / 32), -s * (2 / 32), s, s); // fingertip touches the ring
      c.restore();
    }
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
  },
  sprite(i) {
    const r = dpr(), s = this.sprites[i];
    if (s && s.r === r) return s.c;
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
    if (!list.length || !this.w) return;
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
