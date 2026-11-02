/* Wildcard Chess: screens, the deal, the game against the computer, the Codex. */
'use strict';

const E = ChessEngine();
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const opp = c => (c === 'w' ? 'b' : 'w');
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem('wildcard-chess:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('wildcard-chess:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

const LEVELS = {
  easy: { name: 'Easy', who: 'The Pawn Pusher', icon: 'P', color: 'var(--lv-easy)' },
  medium: { name: 'Medium', who: 'The Club Regular', icon: 'N', color: 'var(--lv-medium)' },
  pro: { name: 'Pro', who: 'The Tactician', icon: 'Q', color: 'var(--lv-pro)' },
  xtreme: { name: 'Xtreme', who: 'The Unhinged', icon: 'void', color: 'var(--lv-xtreme)' },
};

const settings = { level: store.get('level', 'medium'), color: store.get('color', 'w'), count: store.get('count', 1) };
if (!LEVELS[settings.level]) settings.level = 'medium';
Sound.on = store.get('sound', true);
const discovered = new Set(store.get('codex', []));
function discover(t) { if (discovered.has(t)) return false; discovered.add(t); store.set('codex', [...discovered]); updateCodexCount(); return true; }
function updateCodexCount() { $('#codexCount').textContent = `${discovered.size} / 30 discovered`; }

let current = 'menu';
function show(id) {
  current = id;
  for (const s of $$('.screen')) s.classList.toggle('on', s.id === id);
  if (id === 'menu') Showcase.start(); else Showcase.stop();
  if (id === 'codex') renderCodex();
  if (id === 'game') requestAnimationFrame(() => G.board && G.board.resize());
  hideTip(); hideChooser();
}

/* ---------- AI in a Web Worker (falls back to the main thread) ---------- */
const AI = {
  worker: null, cb: new Map(), id: 0,
  init() {
    try {
      const src = ChessEngine.toString() + '\nconst E = ChessEngine();\n' +
        'onmessage = function (e) { var d = e.data, idx = -1; try { idx = E.think(d.s, d.level); } catch (err) { idx = -1; } postMessage({ id: d.id, idx: idx }); };';
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      this.worker = new Worker(url);
      this.worker.onmessage = e => { const f = this.cb.get(e.data.id); if (f) { this.cb.delete(e.data.id); f(e.data.idx); } };
      this.worker.onerror = () => this.fail();
    } catch (e) { this.worker = null; }
  },
  fail() {
    this.worker = null;
    for (const [id, f] of this.cb) { this.cb.delete(id); f(null); }
  },
  think(s, level) {
    return new Promise(res => {
      const local = () => setTimeout(() => res(E.think(s, level)), 20);
      if (!this.worker) return local();
      const id = ++this.id;
      this.cb.set(id, idx => (idx == null ? local() : res(idx)));
      try { this.worker.postMessage({ id, s, level }); } catch (e) { this.cb.delete(id); local(); }
    });
  },
};

/* ---------- tooltip, chooser, toast ---------- */
function tipHTML(p, mine) {
  if (p.t === 'WALL') return `<h5>Stone wall</h5><p>${STD_DESC.WALL}</p>`;
  const w = WILD[p.t], side = p.c === 'w' ? 'White' : 'Black';
  if (w) {
    if (mine) return `<div class="tip-k" style="--acc:${w.accent}">Your wildcard · ${esc(w.moves)}</div><h5>${w.name}</h5><p>${w.desc}</p>`;
    return `<div class="tip-k" style="--acc:${w.accent}">${side}'s wildcard</div><h5>${w.name}</h5><p class="unk">What does it do? Nobody's telling. Watch it closely.</p>`;
  }
  return `<div class="tip-k">${side}</div><h5>${STD_NAMES[p.t]}</h5><p>${STD_DESC[p.t]}</p>`;
}
let tipTimer = 0;
function showTip(html, x, y, ms) {
  const t = $('#tip');
  t.innerHTML = html; t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = x + 16, top = y + 16;
  if (left + r.width > innerWidth - 8) left = x - r.width - 16;
  if (top + r.height > innerHeight - 8) top = y - r.height - 16;
  t.style.left = Math.max(8, left) + 'px'; t.style.top = Math.max(8, top) + 'px';
  clearTimeout(tipTimer);
  if (ms) tipTimer = setTimeout(hideTip, ms);
}
function hideTip() { $('#tip').hidden = true; }

let chooserCb = null;
function showChooser(items, x, y, cb) {
  const ch = $('#chooser');
  ch.innerHTML = items.map((it, i) => `<button data-i="${i}">${it.icon}<span>${esc(it.label)}</span></button>`).join('');
  ch.hidden = false;
  const r = ch.getBoundingClientRect();
  ch.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + 'px';
  ch.style.top = Math.max(8, Math.min(innerHeight - r.height - 8, y - r.height / 2)) + 'px';
  chooserCb = cb;
}
function hideChooser() { $('#chooser').hidden = true; chooserCb = null; }
$('#chooser').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]');
  if (!b || !chooserCb) return;
  const f = chooserCb; hideChooser(); f(+b.dataset.i);
});

let toastTimer = 0;
function toast(html, acc) {
  const t = $('#toast');
  t.innerHTML = html; t.style.setProperty('--acc', acc || 'var(--gold)');
  t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1700);
}

function modal(html) { $('#modalCard').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }

/* ---------- setup screen ---------- */
function initSetup() {
  for (const el of $$('.diff-ico')) el.innerHTML = pieceSVG(el.dataset.piece, el.dataset.piece === 'void' ? 'b' : 'w');
  const sync = () => {
    for (const d of $$('.diff')) { const on = d.dataset.level === settings.level; d.classList.toggle('sel', on); d.setAttribute('aria-checked', on); }
    for (const b of $$('#segColor button')) b.classList.toggle('on', b.dataset.v === settings.color);
    for (const b of $$('#segCount button')) b.classList.toggle('on', +b.dataset.v === settings.count);
    store.set('level', settings.level); store.set('color', settings.color); store.set('count', settings.count);
  };
  for (const d of $$('.diff')) d.addEventListener('click', () => { settings.level = d.dataset.level; Sound.init(); Sound.play('select'); sync(); });
  for (const b of $$('#segColor button')) b.addEventListener('click', () => { settings.color = b.dataset.v; sync(); });
  for (const b of $$('#segCount button')) b.addEventListener('click', () => { settings.count = +b.dataset.v; sync(); });
  $('#dealBtn').addEventListener('click', deal);
  sync();
}

/* ---------- the deal ---------- */
const Draft = { mine: [], theirs: [], pool: [], rerolls: 1, human: 'w' };
function deal() {
  Sound.init();
  const n = settings.count, nThem = n + (settings.level === 'xtreme' ? 1 : 0);
  const pool = shuffle(WILD_IDS.slice());
  Draft.mine = pool.splice(0, n); Draft.theirs = pool.splice(0, nThem); Draft.pool = pool;
  Draft.rerolls = 1;
  Draft.human = settings.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.color;
  show('draft');
  renderDraftSide('#draftMine', Draft.mine, false, Draft.human, 250);
  renderDraftSide('#draftTheirs', Draft.theirs, true, opp(Draft.human), 650);
  syncReroll();
}
function cardHTML(t, secret, color) {
  const w = WILD[t];
  return `<div class="card ${secret ? 'secret' : ''}" style="--acc:${w.accent}"><div class="card-in">
    <div class="card-face"><div class="card-art">${pieceSVG(t, color)}${secret ? '<span class="q-mark">?</span>' : ''}</div>
      <div class="card-name">${w.name}</div>
      <div class="card-moves">${secret ? 'Ability unknown' : esc(w.moves)}</div>
      <div class="card-desc">${secret ? 'Its rules stay hidden until the game is over. Watch what it does.' : w.desc}</div></div>
    <div class="card-back"></div></div></div>`;
}
function renderDraftSide(sel, types, secret, color, delay) {
  const box = $(sel);
  box.innerHTML = types.map(t => cardHTML(t, secret, color)).join('');
  [...box.children].forEach((c, i) => setTimeout(() => { c.classList.add('up'); Sound.play('deal'); }, delay + i * 260));
}
function syncReroll() {
  const b = $('#rerollBtn');
  b.textContent = Draft.rerolls ? 'Reroll mine (1 left)' : 'No rerolls left';
  b.disabled = !Draft.rerolls;
}
$('#rerollBtn').addEventListener('click', () => {
  if (!Draft.rerolls) return;
  Draft.rerolls--;
  Draft.pool.push(...Draft.mine);
  Draft.mine = Draft.pool.splice(0, Draft.mine.length);
  renderDraftSide('#draftMine', Draft.mine, false, Draft.human, 60);
  syncReroll();
});
$('#startBtn').addEventListener('click', () => {
  const h = Draft.human, a = opp(h);
  const wild = { [h]: Draft.mine.slice(), [a]: Draft.theirs.slice() };
  Draft.mine.forEach(discover);
  G.start({ wild, human: h, level: settings.level });
  show('game');
});

/* ---------- the game ---------- */
const G = {
  board: null, s: null, hist: [], log: [], human: 'w', ai: 'b', level: 'medium', wild: null,
  legal: [], sel: -1, selMoves: [], busy: false, over: null, token: 0, hover: -1,
  start(cfg) {
    this.token++;
    this.human = cfg.human; this.ai = opp(cfg.human); this.level = cfg.level; this.wild = cfg.wild;
    const pick = n => shuffle(n === 1 ? [2, 3, 4, 5] : [1, 2, 3, 4, 5, 6]).slice(0, n).sort((x, y) => x - y);
    const files = { w: pick(cfg.wild.w.length), b: pick(cfg.wild.b.length) };
    this.s = cfg.state || E.newGame({ wild: cfg.wild, files });
    this.hist = cfg.hist || [{ s: this.s }];
    this.log = cfg.log || [];
    this.over = null; this.sel = -1; this.busy = false;
    this.board.setFlip(this.human === 'b');
    this.board.setPieces(this.s, { anim: false, frozen: frozenSquares(this.s) });
    this.legal = E.legalMoves(this.s);
    const lv = LEVELS[this.level];
    $('#game').style.setProperty('--lv', lv.color);
    $('#modeChip').textContent = `vs ${lv.name} · ${lv.who}`;
    renderWildInfo(); renderLog(); this.render();
    if (this.s.turn === this.ai) aiTurn();
  },
  render() {
    renderBars(); renderStatus(); renderMarks();
    const canUndo = this.level !== 'xtreme' && !this.over && this.hist.some((h, i) => i > 0 && this.hist[i - 1].s.turn === this.human);
    $('#undoBtn').disabled = !canUndo;
    $('#undoBtn').title = this.level === 'xtreme' ? 'No take-backs in Xtreme' : '';
    $('#resignBtn').disabled = !!this.over;
  },
};

function frozenSquares(s) {
  const out = new Set();
  for (let q = 0; q < 64; q++) {
    const p = s.b[q];
    if (!p || p.t !== 'frost') continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const f = (q & 7) + dx, r = (q >> 3) + dy;
      if ((!dx && !dy) || f < 0 || f > 7 || r < 0 || r > 7) continue;
      const a = s.b[r * 8 + f];
      if (a && a.c !== p.c && a.c !== 'n' && a.t !== 'K') out.add(r * 8 + f);
    }
  }
  return out;
}

function material(s, c) { let v = 0; for (const p of s.b) if (p && p.c === c && p.t !== 'K') v += E.value(p); return v; }

function renderBars() {
  const top = G.board.flip ? 'w' : 'b';
  for (const [id, c] of [['#barTop', top], ['#barBot', opp(top)]]) {
    const el = $(id), human = c === G.human, lv = LEVELS[G.level];
    const lost = G.s.lost[opp(c)].filter(t => t !== 'K').slice().sort((a, b) => E.value({ t: b, d: { k: 0, ch: 1 } }) - E.value({ t: a, d: { k: 0, ch: 1 } }));
    const diff = Math.round((material(G.s, c) - material(G.s, opp(c))) / 100);
    const chips = (G.wild[c] || []).map(t => `<button class="chip" data-wild="${t}" data-c="${c}" aria-label="${WILD[t].name}">${pieceSVG(t, c)}${human ? '' : '<span class="qm">?</span>'}</button>`).join('');
    el.classList.toggle('turn', !G.over && G.s.turn === c);
    el.innerHTML = `<div class="avatar">${pieceSVG(human ? 'K' : lv.icon, c)}</div>
      <div class="pname"><b>${human ? 'You' : lv.name + ' AI'}${!human && G.busy ? '<span class="thinking"><i></i><i></i><i></i></span>' : ''}</b>
      <span>${c === 'w' ? 'White' : 'Black'}${human ? '' : ` · <span class="lvl">${lv.who}</span>`}</span></div>
      <div class="chips">${chips}</div>
      <div class="capt">${lost.map(t => pieceSVG(t, opp(c))).join('')}${diff > 0 ? `<span class="adv">+${diff}</span>` : ''}</div>`;
  }
}

function renderStatus() {
  let t;
  if (G.over) t = G.over.winner === G.human ? 'You won' : G.over.winner ? 'You lost' : 'Draw';
  else if (G.s.turn === G.human) t = E.inCheck(G.s, G.human) ? 'Check! Your move' : (G.s.extra ? 'Extra turn!' : 'Your move');
  else t = G.busy ? 'Thinking…' : 'Their move';
  $('#status').textContent = t;
}

function renderWildInfo() {
  const row = (t, c, mine) => {
    const w = WILD[t];
    return `<div class="wi ${mine ? '' : 'theirs'}" style="--acc:${w.accent}"><div class="wi-art">${pieceSVG(t, c)}</div>
      <div><h4>${w.name}<small>${mine ? 'Yours' : 'Theirs'}</small></h4><p>${mine ? w.desc : 'Unknown. Watch what it does.'}</p></div></div>`;
  };
  $('#wildInfo').innerHTML = G.wild[G.human].map(t => row(t, G.human, true)).join('') + G.wild[G.ai].map(t => row(t, G.ai, false)).join('');
}

function renderLog() {
  const ol = $('#log');
  ol.innerHTML = G.log.map((e, i) => `<li class="${e.special ? 'special' : ''} ${i === G.log.length - 1 ? 'last' : ''}"><span class="n">${e.n}${e.c === 'w' ? '.' : '…'}</span>${pieceSVG(e.t, e.c)}<span class="t">${e.text}</span></li>`).join('');
  const sc = ol.closest('.side-scroll');
  if (sc && getComputedStyle(sc).overflowY === 'auto') sc.scrollTop = sc.scrollHeight;
}

function kingSq(s, c) { return E.findKing(s, c); }

function renderMarks() {
  const s = G.s, last = s.last;
  const o = { last: last ? [last.o, last.t] : null, sel: G.sel, check: -1, marks: [], xprev: null, hover: -1 };
  if (!G.over && E.inCheck(s, s.turn)) o.check = kingSq(s, s.turn);
  if (G.sel >= 0) {
    const pc = s.b[G.sel], w = pc && WILD[pc.t], acc = w ? w.accent : '#ffd98e';
    const byT = new Map();
    for (const m of G.selMoves) { if (!byT.has(m.t)) byT.set(m.t, []); byT.get(m.t).push(m); }
    for (const [t, ms] of byT) {
      if (t === G.sel) { o.marks.push({ q: t, cls: 'self', acc }); continue; }
      const cap = ms.some(m => m.x && m.x.length), spec = ms.some(m => (m.k !== 'n' && m.k !== 'castle' && m.k !== 'ep') || m.tele);
      o.marks.push({ q: t, cls: spec ? 'spec' + (cap ? ' cap' : '') : cap ? 'ring' : 'dot', acc });
    }
    if (G.hover >= 0 && byT.has(G.hover)) {
      const xs = new Set();
      for (const m of byT.get(G.hover)) if (m.x) for (const q of m.x) if (q !== G.hover || m.x.length > 1) xs.add(q);
      if (xs.size) o.xprev = [...xs];
      o.hover = G.hover;
    }
  }
  G.board.setMarks(o);
}

function select(q) {
  G.sel = q;
  G.selMoves = G.legal.filter(m => m.o === q);
  if (q >= 0) Sound.play('select');
  renderMarks();
}

const LABEL = {
  boom: 'Detonate', shoot: 'Shoot', strike: 'Strike', swap: 'Swap places', gust: 'Blow a gust', crush: 'Charge',
  charm: 'Charm it', spawn: 'Lay a pawn', wall: 'Raise a wall', hex: 'Hex into a pawn', launch: 'Fling', jump: 'Jump', castle: 'Castle', ep: 'En passant',
};
function moveLabel(m, s) {
  if (m.promo) return 'Promote to ' + pieceName(m.promo);
  if (m.k === 'raise') return 'Raise a ' + pieceName(m.rt);
  if (m.k === 'n') return m.tele ? 'Teleport' : m.x ? 'Capture' : 'Move here';
  if (m.k === 'launch') return 'Fling the ' + pieceName(s.b[m.f].t);
  return LABEL[m.k] || 'Move';
}

function tryMove(ms, x, y) {
  if (!ms.length) return false;
  if (ms.length === 1) { humanMove(ms[0]); return true; }
  const s = G.s, pc = s.b[ms[0].o];
  showChooser(ms.map(m => ({
    label: moveLabel(m, s),
    icon: pieceSVG(m.promo || (m.k === 'raise' ? m.rt : m.k === 'spawn' ? 'P' : m.k === 'wall' ? 'WALL' : pc.t), G.human),
  })), x, y, i => humanMove(ms[i]));
  return true;
}

function humanMove(m) {
  if (G.busy || G.over || G.s.turn !== G.human) return;
  hideTip();
  G.sel = -1; G.selMoves = []; G.hover = -1;
  applyMove(m);
}

/* ---------- pointer input on the board ---------- */
let drag = null, hoverSq = -1, hoverTimer = 0;
function initBoardInput() {
  const root = G.board.root;
  root.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    Sound.init(); hideChooser(); hideTip(); clearTimeout(hoverTimer);
    const q = G.board.sqAt(e.clientX, e.clientY);
    if (q < 0) return;
    const p = G.s.b[q];
    const myTurn = !G.busy && !G.over && G.s.turn === G.human;
    if (myTurn && G.sel >= 0 && q !== G.sel) {
      const ms = G.selMoves.filter(m => m.t === q && m.t !== m.o);
      if (ms.length) { tryMove(ms, e.clientX, e.clientY); return; }
    }
    if (myTurn && p && p.c === G.human) {
      const wasSel = q === G.sel;
      if (!wasSel) select(q);
      const el = G.board.elAt(q);
      drag = { q, el, x0: e.clientX, y0: e.clientY, moved: false, wasSel, id: e.pointerId };
      root.setPointerCapture(e.pointerId);
      return;
    }
    if (p) showTip(tipHTML(p, p.c === G.human), e.clientX, e.clientY, 2600);
    if (G.sel >= 0) select(-1);
  });
  root.addEventListener('pointermove', e => {
    if (drag && drag.id === e.pointerId) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) { drag.moved = true; if (drag.el) drag.el.classList.add('drag'); hideTip(); }
      if (drag.moved && drag.el) {
        const r = root.getBoundingClientRect(), sq = r.width / 8;
        drag.el.style.transform = `translate(${e.clientX - r.left - sq / 2}px, ${e.clientY - r.top - sq / 2}px)`;
      }
    }
    const q = G.board.sqAt(e.clientX, e.clientY);
    if (G.sel >= 0 && q !== G.hover) { G.hover = q; renderMarks(); }
    if (!drag && e.pointerType === 'mouse' && q !== hoverSq) {
      hoverSq = q; hideTip(); clearTimeout(hoverTimer);
      const p = q >= 0 ? G.s.b[q] : null;
      if (p && G.sel < 0) { const x = e.clientX, y = e.clientY; hoverTimer = setTimeout(() => showTip(tipHTML(p, p.c === G.human), x, y), 420); }
    }
  });
  const end = e => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag; drag = null;
    if (d.el) d.el.classList.remove('drag');
    if (d.moved) {
      const q = G.board.sqAt(e.clientX, e.clientY);
      const ms = q >= 0 ? G.selMoves.filter(m => m.t === q && m.t !== m.o) : [];
      if (!ms.length || !tryMove(ms, e.clientX, e.clientY)) { if (d.el) G.board.place(d.el, d.q, true); }
      else if (ms.length > 1 && d.el) G.board.place(d.el, d.q, true);
      return;
    }
    if (d.wasSel) {
      const self = G.selMoves.filter(m => m.t === d.q);
      if (self.length) tryMove(self, e.clientX, e.clientY);
      else select(-1);
    } else if (!G.selMoves.length) {
      const p = G.s.b[d.q];
      if (p) showTip(tipHTML(p, true) + '<p class="unk" style="margin-top:6px">It has no legal moves right now.</p>', e.clientX, e.clientY, 2400);
    }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', e => { if (drag && drag.el) G.board.place(drag.el, drag.q, true); drag = null; });
  root.addEventListener('pointerleave', () => { if (G.hover !== -1) { G.hover = -1; renderMarks(); } hoverSq = -1; clearTimeout(hoverTimer); hideTip(); });
}

/* ---------- moves, effects and the log ---------- */
const VERB = {
  boom: 'detonates!', shoot: 'fires!', strike: 'strikes and vanishes', swap: 'swaps places', raise: 'raises the dead', gust: 'blows a gale',
  crush: 'tramples through', charm: 'charms a piece', spawn: 'lays a pawn', wall: 'raises a wall', hex: 'casts a hex', launch: 'flings a piece', jump: 'jumps',
};

function moveText(s, m, ns) {
  const sq = E.sqName, code = q => `<code>${sq(q)}</code>`, p = s.b[m.f], tgt = s.b[m.t];
  let t;
  switch (m.k) {
    case 'castle': t = m.t > m.f ? 'castles short' : 'castles long'; break;
    case 'n': t = `${code(m.f)}${m.x ? '×' : '–'}${code(m.t)}`; if (m.promo) t += ` promotes to ${pieceName(m.promo)}`; if (m.tele) t += ', teleporting'; break;
    case 'ep': t = `${code(m.f)}×${code(m.t)} en passant`; break;
    case 'boom': t = `detonates on ${code(m.t)}, ${m.x.length} destroyed`; break;
    case 'shoot': t = `shoots ${code(m.t)} from ${code(m.o)}`; break;
    case 'strike': t = `strikes ${code(m.t)} and returns to ${code(m.o)}`; break;
    case 'swap': t = `swaps ${code(m.o)} with the ${pieceName(tgt.t)} on ${code(m.t)}`; break;
    case 'raise': t = `raises a ${pieceName(m.rt)} on ${code(m.t)}`; break;
    case 'gust': t = `blows a gust from ${code(m.o)}${m.x ? `, ${m.x.length} blown off the board` : ''}`; break;
    case 'crush': t = `${code(m.f)}–${code(m.t)}, crushing ${m.x.length}`; break;
    case 'charm': t = `charms the ${pieceName(tgt.t)} on ${code(m.t)}`; break;
    case 'spawn': t = `lays a pawn on ${code(m.t)}`; break;
    case 'wall': t = `raises a wall on ${code(m.t)}`; break;
    case 'hex': t = `turns the ${pieceName(tgt.t)} on ${code(m.t)} into a pawn`; break;
    case 'launch': t = `flings the ${pieceName(p.t)} ${code(m.f)}–${code(m.t)}${m.x ? ', capturing' : ''}`; break;
    case 'jump': t = `${code(m.f)}–${code(m.t)}, jumping ${m.x.length}`; break;
    default: t = `${code(m.f)}–${code(m.t)}`;
  }
  for (const e of ns.events || []) {
    if (e.k === 'venom') t += '. The capturer is poisoned';
    if (e.k === 'void') t += '. Swallowed by the Void';
    if (e.k === 'reborn') t += '. A Phoenix is reborn';
    if (e.k === 'extra') t += '. Extra turn';
  }
  if (!ns.dead && E.inCheck(ns, ns.turn)) t += ' +';
  return t;
}

const CHIPS = { w: ['#ffffff', '#e8e6e2', '#cfccc7'], b: ['#6d6b68', '#4b4946', '#2a2826'] };

function playEffects(board, s, m, ns, quiet) {
  const actor = s.b[m.o], mover = s.b[m.f];
  const aw = actor && WILD[actor.t], acc = aw ? aw.accent : '#ffd98e';
  const before = new Map(), after = new Set();
  for (let q = 0; q < 64; q++) { const p = s.b[q]; if (p) before.set(p.id, { p, q }); }
  for (const p of ns.b) if (p) after.add(p.id);
  const deaths = [...before.values()].filter(v => !after.has(v.p.id) && v.p.c !== 'n');
  const instant = new Set(), fly = new Set();
  let snd = deaths.length ? 'capture' : 'move', shake = 0, msg = null;

  switch (m.k) {
    case 'boom': {
      const c = m.t;
      board.burstAt(c, { n: 60, color: ['#fff3b0', '#ffb347', '#ff6a1a', '#ff3b1a'], kind: 'spark', speed: 2.4, size: 0.09, life: 46, gravity: 0.02 });
      board.burstAt(c, { n: 26, color: ['#3a332c', '#5a5048'], kind: 'smoke', speed: 0.8, size: 0.16, life: 70, gravity: -0.03 });
      board.ringAt(c, '#ffcf6b', 1.9, 12, 30); board.ringAt(c, '#ff6a1a', 1.3, 8, 22);
      snd = 'boom'; shake = 2; msg = 'boom'; break;
    }
    case 'shoot': board.beam(m.o, m.t, acc, 16); snd = 'zap'; msg = 'shoot'; break;
    case 'strike': board.beam(m.o, m.t, '#ff2d55', 12); board.burstAt(m.t, { n: 16, color: ['#ff2d55', '#fff'], kind: 'spark', speed: 1.4 }); snd = 'whoosh'; msg = 'strike'; break;
    case 'swap': board.ringAt(m.o, acc, 0.8); board.ringAt(m.t, acc, 0.8); snd = 'magic'; msg = 'swap'; break;
    case 'raise': board.burstAt(m.t, { n: 30, color: ['#6dff8a', '#2f7d45', '#b8ffc6'], kind: 'smoke', speed: 0.6, size: 0.12, life: 60, gravity: -0.04 }); snd = 'magic'; msg = 'raise'; break;
    case 'gust':
      board.ringAt(m.o, '#cfeeff', 1.6, 10, 28); board.ringAt(m.o, '#8fd3ff', 1.1, 6, 20);
      board.burstAt(m.o, { n: 30, color: ['#e6f7ff', '#8fd3ff'], kind: 'spark', speed: 2, size: 0.04, gravity: 0 });
      snd = 'whoosh'; shake = 1; msg = 'gust'; break;
    case 'crush': for (const q of m.x) board.burstAt(q, { n: 14, color: ['#8a7a66', '#c9b79c'], kind: 'smoke', speed: 0.7, size: 0.1, life: 40 }); shake = 1; msg = 'crush'; break;
    case 'charm': board.burstAt(m.t, { n: 16, color: ['#ff8fc8', '#ffc2e2'], kind: 'heart', speed: 0.7, size: 0.09, life: 60, gravity: -0.05 }); snd = 'magic'; msg = 'charm'; break;
    case 'spawn': board.burstAt(m.t, { n: 18, color: ['#ff3b3b', '#ffd1d1'], kind: 'spark', speed: 1 }); snd = 'magic'; msg = 'spawn'; break;
    case 'wall': board.burstAt(m.t, { n: 22, color: ['#8d8476', '#b3aa9b'], kind: 'smoke', speed: 0.6, size: 0.12, life: 45 }); snd = 'stone'; shake = 1; msg = 'wall'; break;
    case 'hex': board.burstAt(m.t, { n: 34, color: ['#a96bff', '#e2ccff', '#6b2fd6'], kind: 'spark', speed: 1.2, gravity: -0.02 }); board.ringAt(m.t, '#a96bff', 0.9); snd = 'magic'; msg = 'hex'; break;
    case 'launch': fly.add(mover.id); snd = 'whoosh'; msg = 'launch'; break;
    case 'jump': fly.add(mover.id); msg = 'jump'; break;
  }
  if (m.tele) {
    instant.add(mover.id);
    for (const q of [m.f, m.t]) { board.burstAt(q, { n: 26, color: ['#b57bff', '#e5d2ff', '#7a3cff'], kind: 'spark', speed: 1.3, gravity: 0 }); board.ringAt(q, '#b57bff', 0.9); }
    snd = 'magic'; msg = 'tele';
  }
  for (const d of deaths) {
    if (m.k === 'boom') continue;
    board.burstAt(d.q, { n: 22, color: CHIPS[d.p.c], kind: 'chip', speed: 1.2, size: 0.07, life: 38 });
  }
  let evMsg = null;
  for (const e of ns.events || []) {
    if (e.k === 'venom') { board.burstAt(e.q, { n: 28, color: ['#7dff6a', '#2c8a22'], kind: 'smoke', speed: 0.8, size: 0.1, life: 50 }); evMsg = ['viper', 'Poisoned!']; }
    if (e.k === 'void') { board.ringAt(e.q, '#c084fc', 0.9, 8, 24); board.burstAt(e.q, { n: 26, color: ['#c084fc', '#2a1840'], kind: 'spark', speed: 0.9, gravity: 0, drag: 0.85 }); snd = 'zap'; evMsg = ['void', 'Swallowed by the Void']; }
    if (e.k === 'reborn') { board.burstAt(e.q, { n: 40, color: ['#ffb347', '#ff7a1a', '#fff3b0'], kind: 'spark', speed: 1.3, gravity: -0.05, life: 50 }); evMsg = ['phoenix', 'Reborn from the ashes']; }
    if (e.k === 'extra') { board.ringAt(e.q, '#ffc94a', 1.6, 10, 34); evMsg = ['chrono', 'Time bends: extra turn']; }
    if (e.k === 'grow') { board.burstAt(e.q, { n: 18, color: ['#ff3048', '#8a0a1c'], kind: 'spark', speed: 1 }); evMsg = ['vampire', 'The Vampire grows stronger']; }
    if (e.k === 'crumble') board.burstAt(e.q, { n: 16, color: ['#8d8476', '#b3aa9b'], kind: 'chip', speed: 0.8, size: 0.06 });
  }
  board.setPieces(ns, { anim: true, instant, fly, frozen: frozenSquares(ns) });
  if (shake) board.shake(shake > 1);
  if (quiet) return;
  Sound.play(snd);
  if (evMsg) toast(`${pieceSVG(evMsg[0], 'w')}<span>${evMsg[1]}</span>`, WILD[evMsg[0]].accent);
  else if (msg && aw) toast(`${pieceSVG(actor.t, actor.c)}<span>${aw.name} ${msg === 'tele' ? 'teleports' : VERB[msg]}</span>`, acc);
}

function posKey(s) { return s.b.map(p => (p ? p.t + p.c : '.')).join(',') + s.turn; }

function applyMove(m) {
  const s = G.s, ns = E.makeMove(s, m), actor = s.b[m.o];
  G.s = ns;
  G.log.push({ n: Math.floor(s.ply / 2) + 1, c: s.turn, t: actor.t, text: moveText(s, m, ns), special: m.k !== 'n' && m.k !== 'castle' || !!m.tele || !!(ns.events && ns.events.length) });
  G.hist.push({ s: ns });
  playEffects(G.board, s, m, ns);
  G.legal = E.legalMoves(ns);
  let st = E.status(ns, G.legal);
  if (!st.over) {
    const k = posKey(ns);
    if (G.hist.filter(h => posKey(h.s) === k).length >= 3) st = { over: true, winner: null, reason: 'repetition' };
  }
  if (!st.over && E.inCheck(ns, ns.turn)) setTimeout(() => Sound.play('check'), 120);
  renderLog();
  if (st.over) { G.over = st; G.render(); setTimeout(() => endGame(st), 1100); return; }
  G.render();
  if (ns.turn === G.ai) aiTurn();
}

function aiTurn() {
  G.busy = true; G.render();
  const token = ++G.token, s = G.s, t0 = performance.now();
  AI.think(s, G.level).then(idx => {
    if (token !== G.token) return;
    const wait = Math.max(0, 650 - (performance.now() - t0));
    setTimeout(() => {
      if (token !== G.token) return;
      G.busy = false;
      const m = G.legal[idx] || G.legal[0];
      if (m) applyMove(m);
      else G.render();
    }, wait);
  });
}

function undo() {
  if (G.level === 'xtreme' || G.over) return;
  G.token++; G.busy = false;
  while (G.hist.length > 1) {
    const mover = G.hist[G.hist.length - 2].s.turn;
    G.hist.pop(); G.log.pop();
    if (mover === G.human && G.hist[G.hist.length - 1].s.turn === G.human) break;
  }
  G.s = G.hist[G.hist.length - 1].s;
  G.legal = E.legalMoves(G.s); G.sel = -1; G.selMoves = [];
  G.board.setPieces(G.s, { anim: true, frozen: frozenSquares(G.s) });
  renderLog(); G.render();
  if (G.s.turn === G.ai) aiTurn();
}

const REASONS = {
  mate: w => (w ? 'Checkmate. Their king has nowhere to go.' : 'Checkmate. Your king has nowhere to go.'),
  king: w => (w ? 'Their king was destroyed outright.' : 'Your king was destroyed outright.'),
  resign: () => 'You resigned.',
  stalemate: () => 'Stalemate: no legal moves, but no check either.',
  fifty: () => '50 moves passed without a capture or pawn move.',
  repetition: () => 'The same position came up three times.',
  material: () => 'Only the kings are left standing.',
};
function endGame(st) {
  const won = st.winner === G.human, draw = !st.winner;
  Sound.play(won ? 'win' : draw ? 'move' : 'lose');
  const theirs = G.wild[G.ai].map(t => {
    const fresh = discover(t), w = WILD[t];
    return `<div class="wi" style="--acc:${w.accent}"><div class="wi-art">${pieceSVG(t, G.ai)}</div><div>
      <h4>${w.name}<small>Their wildcard</small></h4>${fresh ? '<div class="new">New in your Codex</div>' : ''}<p>${w.desc}</p></div></div>`;
  }).join('');
  modal(`<h2 class="${won ? 'win' : draw ? 'draw' : 'lose'}">${won ? 'Victory' : draw ? 'Draw' : 'Defeat'}</h2>
    <p class="why">${REASONS[st.reason](won)}</p>
    <div class="reveal">${theirs}</div>
    <div class="modal-btns"><button class="btn primary" data-act="rematch"><span>Play again</span></button>
    <button class="btn" data-act="look"><span>See the board</span></button><button class="btn ghost" data-act="menu"><span>Main menu</span></button></div>`);
}
function confirmBox(title, text, yes, cb) {
  modal(`<h2 class="draw" style="font-size:40px">${title}</h2><p class="why">${text}</p>
    <div class="modal-btns"><button class="btn primary" data-act="yes"><span>${yes}</span></button><button class="btn" data-act="look"><span>Keep playing</span></button></div>`);
  confirmCb = cb;
}
let confirmCb = null;
$('#modal').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) { if (e.target.id === 'modal') closeModal(); return; }
  const a = b.dataset.act;
  closeModal();
  if (a === 'rematch') deal();
  else if (a === 'menu') show('menu');
  else if (a === 'yes' && confirmCb) { const f = confirmCb; confirmCb = null; f(); }
});

$('#undoBtn').addEventListener('click', undo);
$('#flipBtn').addEventListener('click', () => { G.board.setFlip(!G.board.flip); G.render(); });
$('#resignBtn').addEventListener('click', () => {
  if (G.over) return;
  confirmBox('Resign?', 'The game ends and their wildcard is revealed.', 'Resign', () => {
    G.token++; G.busy = false; G.over = { over: true, winner: G.ai, reason: 'resign' }; G.render(); endGame(G.over);
  });
});
$('#leaveBtn').addEventListener('click', () => {
  if (G.over || G.hist.length < 2) { G.token++; show('menu'); return; }
  confirmBox('Leave the game?', 'This game will be abandoned.', 'Leave', () => { G.token++; G.busy = false; show('menu'); });
});
document.addEventListener('click', e => {
  const c = e.target.closest('.chip[data-wild]');
  if (c) {
    const t = c.dataset.wild, p = { t, c: c.dataset.c };
    const r = c.getBoundingClientRect();
    showTip(tipHTML(p, p.c === G.human), r.left, r.bottom, 3200);
    return;
  }
  const g = e.target.closest('[data-go]');
  if (g) { Sound.init(); show(g.dataset.go); }
});
document.addEventListener('pointerdown', e => {
  if (!$('#chooser').hidden && !e.target.closest('#chooser') && !e.target.closest('.board')) hideChooser();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#chooser').hidden) hideChooser();
  else if (!$('#modal').hidden) closeModal();
  else if (current === 'game' && G.sel >= 0) select(-1);
});

/* ---------- the menu's exhibition match ---------- */
const Showcase = {
  board: null, s: null, timer: 0,
  start() {
    if (!this.board) this.board = new BoardView($('#showBoard'), { coords: false, seed: 5 });
    if (!this.s) this.newGame();
    if (!this.timer) this.timer = setInterval(() => this.step(), 1450);
  },
  stop() { clearInterval(this.timer); this.timer = 0; },
  newGame() {
    const [a, b] = shuffle(WILD_IDS.slice());
    const f = () => 2 + Math.floor(Math.random() * 4);
    this.s = E.newGame({ wild: { w: [a], b: [b] }, files: { w: [f()], b: [f()] } });
    this.board.setPieces(this.s, { anim: false });
    this.board.setMarks({});
    $('#showCap').textContent = `Exhibition match · ${WILD[a].name} vs ${WILD[b].name}`;
  },
  step() {
    if (document.hidden || !this.board) return;
    const st = E.status(this.s);
    if (st.over || this.s.ply > 140) { this.newGame(); return; }
    const L = E.legalMoves(this.s), m = L[E.quickPick(this.s)];
    if (!m) { this.newGame(); return; }
    const before = this.s;
    this.s = E.makeMove(before, m);
    playEffects(this.board, before, m, this.s, true);
    this.board.setMarks({ last: [m.o, m.t] });
  },
};

/* ---------- codex ---------- */
function miniBoard(t) {
  const { s, moves } = E.demo(t);
  const mark = new Map();
  for (const m of moves) {
    const cap = m.x && m.x.length, spec = (m.k !== 'n' && m.k !== 'castle') || m.tele;
    const cls = spec ? 'ms' : cap ? 'mc' : 'mq', prev = mark.get(m.t);
    if (!prev || cls === 'ms' || (cls === 'mc' && prev === 'mq')) mark.set(m.t, cls);
  }
  let h = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const q = (7 - y) * 8 + x, p = s.b[q];
    h += `<i class="${(x + y) % 2 ? 'd' : 'l'} ${mark.get(q) || ''}">${p ? pieceSVG(p.t, p.c) : ''}</i>`;
  }
  return `<div class="mini" title="Sample moves from d4">${h}</div>`;
}
function renderCodex() {
  const spoil = $('#spoilers').checked;
  $('#codexLede').textContent = `You've discovered ${discovered.size} of 30 wildcards. A wildcard joins your Codex when you play with it, or when a game against it ends. The small boards show sample moves from d4: dots are moves, red rings are captures, stars are special abilities.`;
  $('#codexGrid').innerHTML = WILD_IDS.map(t => {
    const w = WILD[t], known = discovered.has(t) || spoil;
    return `<div class="cx ${known ? '' : 'locked'}" style="--acc:${w.accent}">
      <div class="cx-l"><div class="cx-art">${pieceSVG(t, 'w')}</div>${known ? miniBoard(t) : ''}</div>
      <div><h4>${w.name}</h4><div class="cx-moves">${known ? esc(w.moves) : 'Undiscovered'}</div>
      <p>${known ? w.desc : 'Not discovered yet. Play with it or face it to learn what it does.'}</p></div></div>`;
  }).join('');
}
$('#spoilers').addEventListener('change', renderCodex);

/* ---------- boot ---------- */
function initMenu() {
  const sync = () => { $('#soundState').textContent = Sound.on ? 'On' : 'Off'; store.set('sound', Sound.on); };
  $('#soundBtn').addEventListener('click', () => { Sound.on = !Sound.on; Sound.init(); Sound.play('select'); sync(); });
  sync(); updateCodexCount();
  const drift = $('#drift');
  const ids = shuffle(WILD_IDS.slice()).slice(0, 14);
  drift.innerHTML = ids.map((t, i) => `<i style="left:${(i * 7.3 + Math.random() * 4) % 100}%;animation-duration:${38 + Math.random() * 30}s;animation-delay:-${Math.random() * 60}s;width:${50 + Math.random() * 50}px;height:${50 + Math.random() * 50}px">${pieceSVG(t, i % 2 ? 'b' : 'w')}</i>`).join('');
}

function boot(data) {
  installPieceDefs();
  AI.init();
  initMenu(); initSetup();
  G.board = new BoardView($('#mainBoard'), { seed: 11 });
  initBoardInput();
  const g = data && data.game;
  if (g && g.hist && g.hist.length) {
    G.start({ wild: g.wild, human: g.human, level: g.level, state: g.hist[g.hist.length - 1].s, hist: g.hist, log: g.log });
    show('game');
  } else show(data && data.screen && data.screen !== 'game' && data.screen !== 'draft' ? data.screen : 'menu');
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
  window.claude.hot.snapshot(() => ({
    screen: current,
    game: current === 'game' && G.s && !G.over ? { wild: G.wild, human: G.human, level: G.level, hist: G.hist, log: G.log } : null,
  }));
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
