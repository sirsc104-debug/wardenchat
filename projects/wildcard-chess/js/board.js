/* Wildcard Chess: the board view. Paints procedural wood squares on a canvas, keeps one element
   per piece (keyed by piece id, so pieces slide when they move), and draws highlights and effects. */
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class BoardView {
  constructor(root, o = {}) {
    this.root = root; this.flip = false; this.seed = o.seed || 11; this.showCoords = o.coords !== false;
    this.els = new Map(); this.size = 0;
    root.classList.add('board');
    this.uid = 'b' + (BoardView.n = (BoardView.n || 0) + 1);
    root.innerHTML = '<canvas class="wood"></canvas><div class="coords"></div><div class="hl"></div><div class="pieces"></div>' +
      `<svg class="arrows" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="${this.uid}-ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">` +
      '<path d="M0 0 L10 5 L0 10 Z" fill="#ff3b20"/></marker></defs><g></g></svg>' +
      '<div class="marks"></div><canvas class="fx"></canvas>';
    this.wood = root.querySelector('.wood');
    this.coordEl = root.querySelector('.coords');
    this.hlEl = root.querySelector('.hl');
    this.pcEl = root.querySelector('.pieces');
    this.markEl = root.querySelector('.marks');
    this.arrowEl = root.querySelector('.arrows g');
    this.fx = new FXLayer(root.querySelector('.fx'));
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(root); }
    else window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setFlip(f) { if (this.flip === f) return; this.flip = f; this.drawCoords(); for (const el of this.els.values()) this.place(el, el._q, true); }
  disp(q) { const f = q & 7, r = q >> 3; return this.flip ? { x: 7 - f, y: r } : { x: f, y: 7 - r }; }
  center(q) { const d = this.disp(q), s = this.size / 8; return { x: (d.x + 0.5) * s, y: (d.y + 0.5) * s }; }
  sqAt(cx, cy) {
    const r = this.root.getBoundingClientRect();
    const x = Math.floor(((cx - r.left) / r.width) * 8), y = Math.floor(((cy - r.top) / r.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    return this.flip ? y * 8 + (7 - x) : (7 - y) * 8 + x;
  }

  resize() {
    const size = this.root.offsetWidth;
    if (!size || size === this.size) return;
    this.size = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.root.style.setProperty('--sq', size / 8 + 'px');
    this.wood.width = Math.round(size * dpr); this.wood.height = Math.round(size * dpr);
    this.fx.resize(size, size, dpr);
    this.drawWood(dpr);
    this.drawCoords();
  }

  drawWood(dpr) {
    const c = this.wood.getContext('2d'), S = this.size * dpr, s = S / 8, rnd = mulberry32(this.seed);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const light = (x + y) % 2 === 0;
      const base = light ? [225, 197, 150] : [157, 109, 66];
      const v = (rnd() - 0.5) * 14;
      const x0 = x * s, y0 = y * s;
      c.save();
      c.beginPath(); c.rect(x0, y0, s, s); c.clip();
      c.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.9},${base[2] + v * 0.7})`;
      c.fillRect(x0, y0, s, s);
      const vertical = rnd() < 0.72;
      c.translate(x0 + s / 2, y0 + s / 2);
      if (!vertical) c.rotate(Math.PI / 2);
      c.translate(-s / 2, -s / 2);
      // broad soft bands
      for (let i = 0; i < 5; i++) {
        c.fillStyle = rnd() < 0.5 ? `rgba(110,60,20,${0.03 + rnd() * 0.05})` : `rgba(255,240,205,${0.03 + rnd() * 0.05})`;
        const bx = rnd() * s, bw = s * (0.08 + rnd() * 0.22);
        c.fillRect(bx, 0, bw, s);
      }
      // fine grain lines
      const lines = 22 + Math.floor(rnd() * 14);
      for (let i = 0; i < lines; i++) {
        const px = rnd() * s, amp = s * (0.004 + rnd() * 0.02), k = 0.6 + rnd() * 1.8, ph = rnd() * 6.28;
        const dark = rnd() < 0.7;
        c.strokeStyle = dark ? `rgba(${light ? '120,72,30' : '70,38,14'},${0.05 + rnd() * 0.14})` : `rgba(255,236,200,${0.04 + rnd() * 0.08})`;
        c.lineWidth = (0.4 + rnd() * 1.5) * dpr * (s / (90 * dpr));
        c.beginPath();
        for (let t = 0; t <= 12; t++) {
          const yy = (t / 12) * s, xx = px + Math.sin((t / 12) * Math.PI * k + ph) * amp;
          t ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
        }
        c.stroke();
      }
      if (rnd() < 0.07) {
        const kx = s * (0.2 + rnd() * 0.6), ky = s * (0.2 + rnd() * 0.6);
        for (let r = 1; r <= 4; r++) {
          c.strokeStyle = `rgba(90,50,20,${0.16 - r * 0.03})`; c.lineWidth = dpr;
          c.beginPath(); c.ellipse(kx, ky, s * 0.02 * r, s * 0.06 * r, 0, 0, Math.PI * 2); c.stroke();
        }
      }
      c.restore();
    }
  }

  drawCoords() {
    if (!this.showCoords) { this.coordEl.innerHTML = ''; return; }
    let h = '';
    for (let y = 0; y < 8; y++) {
      const rank = this.flip ? y + 1 : 8 - y, light = y % 2 === 0;
      h += `<span style="left:1.1%;top:${y * 12.5 + 0.6}%;color:${light ? '#9c6c41' : '#ead4ad'}">${rank}</span>`;
    }
    for (let x = 0; x < 8; x++) {
      const file = 'abcdefgh'[this.flip ? 7 - x : x], light = (x + 7) % 2 === 0;
      h += `<span style="left:${x * 12.5 + 10.2}%;top:${7 * 12.5 + 9.2}%;color:${light ? '#9c6c41' : '#ead4ad'}">${file}</span>`;
    }
    this.coordEl.innerHTML = h;
  }

  place(el, q, instant) {
    const d = this.disp(q);
    el._q = q;
    if (instant) el.classList.add('instant');
    el.style.transform = `translate(${d.x * 100}%, ${d.y * 100}%)`;
    if (instant) { void el.offsetWidth; el.classList.remove('instant'); }
  }

  /* Bring the piece elements in line with a position. opts: anim, instant (Set of ids), fly (Set), frozen (Set of squares). */
  setPieces(s, opts = {}) {
    const seen = new Set();
    for (let q = 0; q < 64; q++) {
      const p = s.b[q];
      if (!p) continue;
      seen.add(p.id);
      let el = this.els.get(p.id);
      const key = p.t + p.c;
      if (!el) {
        el = document.createElement('div');
        el.className = 'pc';
        el._key = '';
        this.place(el, q, true);
        this.pcEl.appendChild(el);
        this.els.set(p.id, el);
        if (opts.anim) { el.classList.add('born'); setTimeout(() => el.classList.remove('born'), 600); }
      }
      if (el._key !== key) {
        if (el._key && opts.anim) { el.classList.add('recolor'); setTimeout(() => el.classList.remove('recolor'), 700); }
        el.innerHTML = pieceSVG(p.t, p.c);
        el._key = key;
        const w = WILD[p.t];
        el.classList.toggle('wild', !!w);
        if (w) el.style.setProperty('--acc', w.accent);
      }
      el._piece = p;
      el.classList.toggle('frozen', !!(opts.frozen && opts.frozen.has(q)));
      el.classList.toggle('stoned', !!(opts.frozen && opts.frozen.has(q + 100)));
      if (el._q !== q || opts.force) {
        const inst = opts.instant && opts.instant.has(p.id);
        this.place(el, q, inst || !opts.anim);
        if (opts.fly && opts.fly.has(p.id)) { el.classList.add('fly'); setTimeout(() => el.classList.remove('fly'), 420); }
      }
    }
    for (const [id, el] of this.els) {
      if (seen.has(id)) continue;
      this.els.delete(id);
      if (opts.anim) { el.classList.add('dying'); setTimeout(() => el.remove(), 460); }
      else el.remove();
    }
  }
  /* Show the pieces on these squares as face-down cards (everything else face up). */
  setFacedown(set) {
    let i = 0;
    for (const el of this.els.values()) {
      const down = set.has(el._q);
      el.classList.toggle('facedown', down);
      if (down) el.style.setProperty('--dd', (i++ * 18) + 'ms');
    }
  }
  flipUp(q) {
    const el = this.elAt(q);
    if (!el) return;
    el.classList.remove('facedown');
    el.classList.add('flipup');
    setTimeout(() => el.classList.remove('flipup'), 520);
  }
  clear() { for (const el of this.els.values()) el.remove(); this.els.clear(); }
  elAt(q) { for (const el of this.els.values()) if (el._q === q && !el.classList.contains('dying')) return el; return null; }

  cell(q, cls, style = '') { const d = this.disp(q); return `<div class="${cls}" style="left:${d.x * 12.5}%;top:${d.y * 12.5}%;${style}"></div>`; }

  /* o: { last: [from, to], sel, check, marks: [{q, cls, acc}], xprev: [squares] } */
  setMarks(o = {}) {
    let h = '';
    if (o.last) for (const q of o.last) if (q >= 0) h += this.cell(q, 'last');
    if (o.sel >= 0) h += this.cell(o.sel, 'sel');
    if (o.check >= 0) h += this.cell(o.check, 'check');
    if (o.checkers) for (const q of o.checkers) h += this.cell(q, 'checker');
    if (o.xprev) for (const q of o.xprev) h += this.cell(q, 'xprev');
    this.hlEl.innerHTML = h;
    let a = '';
    if (o.arrows) for (const [from, to] of o.arrows) {
      const p = this.disp(from), q = this.disp(to);
      const x1 = p.x * 100 + 50, y1 = p.y * 100 + 50, x2 = q.x * 100 + 50, y2 = q.y * 100 + 50;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      a += `<line x1="${x1 + ux * 22}" y1="${y1 + uy * 22}" x2="${x2 - ux * 40}" y2="${y2 - uy * 40}" stroke="#ff3b20" stroke-opacity=".78" stroke-width="15" stroke-linecap="round" marker-end="url(#${this.uid}-ah)"/>`;
    }
    this.arrowEl.innerHTML = a;
    for (const el of this.els.values()) el.classList.toggle('checking', !!(o.checkers && o.checkers.includes(el._q)));
    let m = '';
    if (o.marks) for (const k of o.marks) m += this.cell(k.q, k.cls, k.acc ? `--acc:${k.acc}` : '');
    if (o.hover >= 0) m += this.cell(o.hover, 'hover');
    this.markEl.innerHTML = m;
  }

  burstAt(q, o) { const c = this.center(q); this.fx.burst(c.x, c.y, o); }
  ringAt(q, color, r, w, life) { const c = this.center(q); this.fx.ring(c.x, c.y, color, r, w, life); }
  beam(a, b, color, life) { const p = this.center(a), q = this.center(b); this.fx.beam(p.x, p.y, q.x, q.y, color, life); }
  /* A big word slammed onto the board: 'Check!', 'Checkmate' and friends. */
  stamp(text, cls, ms = 1500) {
    const el = document.createElement('div');
    el.className = 'stamp ' + (cls || '');
    el.innerHTML = `<span>${text}</span>`;
    this.root.appendChild(el);
    if (ms) setTimeout(() => el.remove(), ms);
    return el;
  }
  flash(cls = 'red') {
    const el = document.createElement('div');
    el.className = 'flash ' + cls;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  /* Darken the board around one square (the fallen king) at the end of a game. */
  spotlight(q) {
    const d = this.disp(q);
    this.root.style.setProperty('--kx', (d.x + 0.5) * 12.5 + '%');
    this.root.style.setProperty('--ky', (d.y + 0.5) * 12.5 + '%');
    this.root.classList.add('ended');
  }
  resetEnd() {
    this.root.classList.remove('ended');
    for (const el of this.root.querySelectorAll('.stamp, .flash')) el.remove();
    for (const el of this.els.values()) el.classList.remove('toppled', 'checked');
  }
  shake(big) {
    const cls = big ? 'big-shake' : 'shake';
    this.root.classList.remove('shake', 'big-shake'); void this.root.offsetWidth; this.root.classList.add(cls);
    setTimeout(() => this.root.classList.remove(cls), 650);
  }
}
