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
    this.els = new Map(); this.size = 0; this.theme = o.theme || 'walnut';
    (BoardView.all || (BoardView.all = [])).push(this);
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
    this.sizeFog();
  }

  drawWood(dpr) {
    paintBoard(this.wood.getContext('2d'), this.size * dpr, this.theme, this.seed, dpr);
  }
  setTheme(id) {
    if (!BOARD_THEMES[id] || id === this.theme) return;
    this.theme = id;
    if (this.size) { this.drawWood(Math.min(window.devicePixelRatio || 1, 2)); this.drawCoords(); }
  }

  drawCoords() {
    if (!this.showCoords) { this.coordEl.innerHTML = ''; return; }
    let h = '';
    for (let y = 0; y < 8; y++) {
      const rank = this.flip ? y + 1 : 8 - y, light = y % 2 === 0, ink = (BOARD_THEMES[this.theme] || BOARD_THEMES.walnut).ink;
      h += `<span style="left:1.1%;top:${y * 12.5 + 0.6}%;color:${light ? ink[0] : ink[1]}">${rank}</span>`;
    }
    for (let x = 0; x < 8; x++) {
      const file = 'abcdefgh'[this.flip ? 7 - x : x], light = (x + 7) % 2 === 0, ink = (BOARD_THEMES[this.theme] || BOARD_THEMES.walnut).ink;
      h += `<span style="left:${x * 12.5 + 10.2}%;top:${7 * 12.5 + 9.2}%;color:${light ? ink[0] : ink[1]}">${file}</span>`;
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
      const key = p.t + p.c + (this.pieceSet || PIECE_SET);
      if (!el) {
        el = document.createElement('div');
        el.className = 'pc';
        el._key = '';
        this.place(el, q, true);
        this.pcEl.appendChild(el);
        this.els.set(p.id, el);
        if (opts.anim) {
          // a piece that was already in the game is stepping out of the fog; a new one is being born
          const cls = opts.existed && opts.existed.has(p.id) ? 'fogin' : 'born';
          el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 600);
        }
      }
      if (el._key !== key) {
        if (el._key && opts.anim) { el.classList.add('recolor'); setTimeout(() => el.classList.remove('recolor'), 700); }
        el.innerHTML = pieceSVG(p.t, p.c, this.pieceSet || PIECE_SET);
        el._key = key;
        const w = WILD[p.t];
        el.classList.toggle('wild', !!w);
        el.classList.toggle('legend', !!(w && w.legendary));
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
      // still alive but out of sight: it fades into the fog instead of dying
      if (opts.anim && opts.alive && opts.alive.has(id)) { el.classList.add('fogout'); setTimeout(() => el.remove(), 420); }
      else if (opts.anim) { el.classList.add('dying'); setTimeout(() => el.remove(), 460); }
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
  /* Fog Mode: cover every square not in vis (a Set), or clear the fog (null). The fog is a canvas of
     soft drifting cloud puffs: each square's density eases toward its target, so fog billows in from
     the edges when a square is lost from sight and thins out and drifts apart when it is seen again. */
  setFog(vis) {
    if (!this.fogCv) {
      this.fogCv = document.createElement('canvas');
      this.fogCv.className = 'fog';
      this.root.insertBefore(this.fogCv, this.pcEl);
      this.fogDen = new Float32Array(64); this.fogTgt = new Float32Array(64);
      const rnd = mulberry32(this.seed * 7 + 3);
      this.fogPuffs = [];
      for (let q = 0; q < 64; q++) for (let i = 0; i < 4; i++)
        this.fogPuffs.push({ q, ox: (rnd() - 0.5) * 0.7, oy: (rnd() - 0.5) * 0.7, r: 0.5 + rnd() * 0.35, ph: rnd() * 6.28, sp: 0.25 + rnd() * 0.35, light: rnd() < 0.35 });
      this.sizeFog();
    }
    for (let q = 0; q < 64; q++) this.fogTgt[q] = vis && !vis.has(q) ? 1 : 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.fogDen.set(this.fogTgt);
    if (!this.fogRun) { this.fogRun = true; requestAnimationFrame(() => this.fogTick()); }
  }
  sizeFog() {
    if (!this.fogCv || !this.size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.fogCv.width = Math.round(this.size * dpr); this.fogCv.height = Math.round(this.size * dpr);
    this.fogDpr = dpr;
    // one soft puff, drawn once and stamped many times
    const P = 128, sp = document.createElement('canvas'); sp.width = sp.height = P;
    const c = sp.getContext('2d'), gr = c.createRadialGradient(P / 2, P / 2, 0, P / 2, P / 2, P / 2);
    gr.addColorStop(0, 'rgba(64,70,84,1)'); gr.addColorStop(0.5, 'rgba(58,63,76,.85)'); gr.addColorStop(1, 'rgba(50,55,66,0)');
    c.fillStyle = gr; c.fillRect(0, 0, P, P);
    this.fogSprite = sp;
    const lp = document.createElement('canvas'); lp.width = lp.height = P;
    const l = lp.getContext('2d'), lg = l.createRadialGradient(P / 2, P / 2, 0, P / 2, P / 2, P / 2);
    lg.addColorStop(0, 'rgba(176,184,200,.55)'); lg.addColorStop(1, 'rgba(176,184,200,0)');
    l.fillStyle = lg; l.fillRect(0, 0, P, P);
    this.fogLight = lp;
  }
  fogTick() {
    const c = this.fogCv.getContext('2d'), S = this.fogCv.width, s = S / 8, t = performance.now() / 1000;
    let live = false;
    for (let q = 0; q < 64; q++) {
      const d = this.fogTgt[q] - this.fogDen[q];
      if (Math.abs(d) > 0.002) { this.fogDen[q] += d * 0.07; live = true; } else this.fogDen[q] = this.fogTgt[q];
      if (this.fogTgt[q] > 0) live = true;
    }
    c.clearRect(0, 0, S, S);
    // a solid core under each fully hidden square, so the fog never shows gaps
    for (let q = 0; q < 64; q++) {
      const den = this.fogDen[q];
      if (den < 0.01) continue;
      const p = this.disp(q), cx = (p.x + 0.5) * s, cy = (p.y + 0.5) * s, r = s * 0.95 * (0.55 + 0.45 * den);
      c.globalAlpha = Math.min(1, den * 1.05);
      c.drawImage(this.fogSprite, cx - r, cy - r, r * 2, r * 2);
    }
    // drifting puffs: they spread out and thin as a square clears, and roll in as it fogs over
    for (const f of this.fogPuffs) {
      const den = this.fogDen[f.q];
      if (den < 0.01) continue;
      const p = this.disp(f.q), spread = 1 + (1 - den) * 1.4;
      const x = (p.x + 0.5 + f.ox * spread + Math.sin(t * f.sp + f.ph) * 0.18) * s;
      const y = (p.y + 0.5 + f.oy * spread + Math.cos(t * f.sp * 0.8 + f.ph) * 0.14) * s;
      const r = f.r * s * (0.6 + 0.4 * den);
      c.globalAlpha = den * (f.light ? 0.7 : 0.8);
      c.drawImage(f.light ? this.fogLight : this.fogSprite, x - r, y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
    if (live) requestAnimationFrame(() => this.fogTick());
    else { this.fogRun = false; c.clearRect(0, 0, S, S); }
  }
  /* Redraw every piece in a piece set (the equipped one, or a preview's). */
  repaint(set) {
    this.pieceSet = set || null;
    for (const el of this.els.values()) {
      if (!el._piece) continue;
      el.innerHTML = pieceSVG(el._piece.t, el._piece.c, set || PIECE_SET);
      el._key = el._piece.t + el._piece.c + (set || PIECE_SET);
    }
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
