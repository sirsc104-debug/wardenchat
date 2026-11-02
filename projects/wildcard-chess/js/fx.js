/* Wildcard Chess: particle effects drawn over the board, and synthesized sound. */
'use strict';

class FXLayer {
  constructor(canvas) {
    this.cv = canvas; this.cx = canvas.getContext('2d');
    this.parts = []; this.rings = []; this.lines = []; this.running = false;
    this.w = 0; this.h = 0;
  }
  resize(w, h, dpr) {
    this.w = w; this.h = h;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  burst(x, y, o = {}) {
    const n = o.n || 18, sq = this.w / 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed || 1) * sq * (0.02 + Math.random() * 0.06);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0) * sq * 0.03,
        life: 0, max: (o.life || 40) * (0.6 + Math.random() * 0.6), size: (o.size || 0.06) * sq * (0.5 + Math.random()),
        color: Array.isArray(o.color) ? o.color[i % o.color.length] : (o.color || '#fff'),
        g: (o.gravity == null ? 0.12 : o.gravity) * sq * 0.01, kind: o.kind || 'chip', spin: Math.random() * 6, drag: o.drag || 0.96,
      });
    }
    this.go();
  }
  ring(x, y, color, maxR = 1.2, width = 6, life = 26) {
    this.rings.push({ x, y, color, r: 0, max: maxR * this.w / 8, life: 0, lifeMax: life, width });
    this.go();
  }
  beam(x1, y1, x2, y2, color, life = 18) { this.lines.push({ x1, y1, x2, y2, color, life: 0, max: life }); this.go(); }
  go() { if (!this.running) { this.running = true; requestAnimationFrame(() => this.tick()); } }
  tick() {
    const c = this.cx;
    c.clearRect(0, 0, this.w, this.h);
    for (const r of this.rings) {
      r.life++;
      const t = r.life / r.lifeMax;
      r.r = r.max * (1 - Math.pow(1 - t, 3));
      c.globalAlpha = Math.max(0, 1 - t);
      c.strokeStyle = r.color; c.lineWidth = r.width * (1 - t) + 1;
      c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2); c.stroke();
    }
    for (const l of this.lines) {
      l.life++;
      const t = l.life / l.max;
      c.globalAlpha = Math.max(0, 1 - t);
      c.strokeStyle = l.color; c.lineWidth = 5 * (1 - t) + 1; c.lineCap = 'round';
      c.shadowColor = l.color; c.shadowBlur = 14;
      c.beginPath(); c.moveTo(l.x1, l.y1); c.lineTo(l.x2, l.y2); c.stroke();
      c.shadowBlur = 0;
    }
    for (const p of this.parts) {
      p.life++;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      p.x += p.vx; p.y += p.vy; p.spin += 0.2;
      const t = p.life / p.max;
      c.globalAlpha = Math.max(0, 1 - t);
      c.fillStyle = p.color;
      if (p.kind === 'spark') {
        c.shadowColor = p.color; c.shadowBlur = 10;
        c.beginPath(); c.arc(p.x, p.y, p.size * (1 - t * 0.6), 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
      } else if (p.kind === 'smoke') {
        c.globalAlpha = Math.max(0, 0.5 * (1 - t));
        c.beginPath(); c.arc(p.x, p.y, p.size * (1 + t * 2.5), 0, Math.PI * 2); c.fill();
      } else if (p.kind === 'heart') {
        c.save(); c.translate(p.x, p.y); c.scale(p.size / 10, p.size / 10);
        c.beginPath(); c.moveTo(0, 3); c.bezierCurveTo(-8, -4, -4, -10, 0, -5); c.bezierCurveTo(4, -10, 8, -4, 0, 3); c.fill(); c.restore();
      } else {
        c.save(); c.translate(p.x, p.y); c.rotate(p.spin);
        c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); c.restore();
      }
    }
    c.globalAlpha = 1;
    this.parts = this.parts.filter(p => p.life < p.max);
    this.rings = this.rings.filter(r => r.life < r.lifeMax);
    this.lines = this.lines.filter(l => l.life < l.max);
    if (this.parts.length || this.rings.length || this.lines.length) requestAnimationFrame(() => this.tick());
    else { this.running = false; c.clearRect(0, 0, this.w, this.h); }
  }
}

const Sound = {
  ctx: null, on: true, noise: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch (e) { this.ctx = null; }
  },
  _env(node, t, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  },
  _noise(t, dur, freq, q, peak, type = 'bandpass') {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    this._env(g, t, 0.003, peak, dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    return f;
  },
  _tone(t, freq, dur, peak, type = 'sine', to) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    this._env(g, t, 0.005, peak, dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  },
  play(kind) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    switch (kind) {
      case 'move': this._noise(t, 0.07, 1500, 1.4, 0.5); this._tone(t, 190, 0.08, 0.25, 'triangle', 120); break;
      case 'capture': this._noise(t, 0.1, 1100, 1.1, 0.7); this._tone(t, 150, 0.12, 0.35, 'triangle', 80); this._noise(t + 0.03, 0.06, 3000, 2, 0.25); break;
      case 'boom': {
        const f = this._noise(t, 0.9, 900, 0.7, 0.9, 'lowpass'); f.frequency.exponentialRampToValueAtTime(80, t + 0.8);
        this._tone(t, 90, 0.7, 0.6, 'sine', 30); break;
      }
      case 'magic': [660, 880, 1320].forEach((fr, i) => this._tone(t + i * 0.06, fr, 0.3, 0.12, 'sine')); break;
      case 'whoosh': { const f = this._noise(t, 0.4, 400, 0.8, 0.4); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35); break; }
      case 'zap': this._tone(t, 1400, 0.15, 0.15, 'sawtooth', 300); this._noise(t, 0.12, 4000, 3, 0.2); break;
      case 'check': this._tone(t, 740, 0.12, 0.18, 'square'); this._tone(t + 0.12, 988, 0.18, 0.16, 'square'); break;
      case 'select': this._tone(t, 520, 0.05, 0.06, 'sine'); break;
      case 'win': [523, 659, 784, 1047].forEach((fr, i) => this._tone(t + i * 0.12, fr, 0.4, 0.16, 'triangle')); break;
      case 'lose': [392, 330, 262, 196].forEach((fr, i) => this._tone(t + i * 0.16, fr, 0.45, 0.16, 'triangle')); break;
      case 'deal': this._noise(t, 0.08, 2600, 1.6, 0.3); break;
      case 'stone': this._noise(t, 0.3, 300, 0.9, 0.6, 'lowpass'); this._tone(t, 70, 0.25, 0.4, 'sine', 40); break;
    }
  },
};
