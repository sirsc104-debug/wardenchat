/* Wildcard Chess: screens, the deal, games against the computer or a friend (pass & play), the Codex. */
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

const settings = { mode: 'ai', level: store.get('level', 'medium'), color: store.get('color', 'w'), count: store.get('count', 1),
  privacy: store.get('privacy', true), autoflip: store.get('autoflip', true), deal: store.get('deal', 'classic') };
if (!LEVELS[settings.level]) settings.level = 'medium';
Sound.on = store.get('sound', true);
const discovered = new Set(store.get('codex', []));
function discover(t) { if (discovered.has(t)) return false; discovered.add(t); store.set('codex', [...discovered]); updateCodexCount(); return true; }
function updateCodexCount() { $('#codexCount').textContent = `${discovered.size} / ${WILD_IDS.length} discovered`; }

let current = 'menu';
function show(id) {
  current = id;
  for (const s of $$('.screen')) s.classList.toggle('on', s.id === id);
  if (id === 'menu') Showcase.start(); else Showcase.stop();
  Embers.toggle(id !== 'game');
  if (id === 'codex') renderCodex();
  if (id === 'game') requestAnimationFrame(() => G.board && G.board.resize());
  if (id !== 'game' && id !== 'draft' && id !== 'pick') { $('#curtain').hidden = true; curtainCb = null; }
  if (id !== 'pick') PD.token++;
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
const sideName = c => (c === 'w' ? 'White' : 'Black');
function tipHTML(p, mine) {
  if (p.t === 'WALL') return `<h5>Stone wall</h5><p>${STD_DESC.WALL}</p>`;
  const w = WILD[p.t], side = sideName(p.c);
  if (w) {
    const owner = G.over || G.mode === 'local' ? `${side}'s wildcard` : p.c === G.human ? 'Your wildcard' : seenInDraft(p.c, p.t) ? 'Their wildcard, seen in the draft' : 'Their wildcard, read by your Oracle';
    if (mine) return `<div class="tip-k" style="--acc:${w.accent}">${owner} · ${esc(w.moves)}</div><h5>${w.name}</h5><p>${w.desc}</p>`;
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
let syncSetup = () => {};
function initSetup() {
  for (const el of $$('.diff-ico')) el.innerHTML = pieceSVG(el.dataset.piece, el.dataset.piece === 'void' ? 'b' : 'w');
  const sync = () => {
    for (const d of $$('.diff')) { const on = d.dataset.level === settings.level; d.classList.toggle('sel', on); d.setAttribute('aria-checked', on); }
    for (const b of $$('#segColor button')) b.classList.toggle('on', b.dataset.v === settings.color);
    for (const b of $$('#segCount button')) b.classList.toggle('on', +b.dataset.v === settings.count);
    for (const b of $$('#segMode button')) b.classList.toggle('on', b.dataset.v === settings.mode);
    for (const b of $$('#segPrivacy button')) b.classList.toggle('on', !!+b.dataset.v === settings.privacy);
    for (const b of $$('#segFlip button')) b.classList.toggle('on', !!+b.dataset.v === settings.autoflip);
    $('#setup').classList.toggle('local', settings.mode === 'local');
    for (const b of $$('#segDeal button')) b.classList.toggle('on', b.dataset.v === settings.deal);
    $('#setup').classList.toggle('draft', settings.deal === 'draft');
    $('#dealLabel').textContent = settings.deal === 'draft' ? 'Start the draft' : 'Deal the wildcards';
    $('#dealNote').textContent = settings.deal === 'draft'
      ? 'Draft: pick one card from each of 8 pairs; the cards you skip go to your opponent. Armies are built entirely from the draft, kings included.'
      : 'Classic: the normal army, with random wildcards taking the place of some of your pieces.';
    store.set('deal', settings.deal);
    $('#setupTitle').textContent = settings.mode === 'local' ? 'Pass & Play' : 'Pick your opponent';
    store.set('level', settings.level); store.set('color', settings.color); store.set('count', settings.count);
    store.set('privacy', settings.privacy); store.set('autoflip', settings.autoflip);
  };
  syncSetup = sync;
  $('#localIntro .duel').innerHTML = `<div class="duel-p">${pieceSVG('K', 'w')}</div><span>vs</span><div class="duel-p">${pieceSVG('K', 'b')}</div>`;
  for (const b of $$('#segMode button')) b.addEventListener('click', () => { settings.mode = b.dataset.v; sync(); });
  for (const b of $$('#segDeal button')) b.addEventListener('click', () => { settings.deal = b.dataset.v; sync(); });
  for (const b of $$('#segPrivacy button')) b.addEventListener('click', () => { settings.privacy = !!+b.dataset.v; sync(); });
  for (const b of $$('#segFlip button')) b.addEventListener('click', () => { settings.autoflip = !!+b.dataset.v; sync(); });
  for (const b of $$('[data-mode]')) b.addEventListener('click', () => {
    Sound.init(); settings.mode = b.dataset.mode; if (b.dataset.deal) settings.deal = b.dataset.deal; sync(); show('setup');
  });
  for (const d of $$('.diff')) d.addEventListener('click', () => { settings.level = d.dataset.level; Sound.init(); Sound.play('select'); sync(); });
  for (const b of $$('#segColor button')) b.addEventListener('click', () => { settings.color = b.dataset.v; sync(); });
  for (const b of $$('#segCount button')) b.addEventListener('click', () => { settings.count = +b.dataset.v; sync(); });
  $('#dealBtn').addEventListener('click', deal);
  sync();
}

/* ---------- the deal ---------- */
const Draft = { wild: { w: [], b: [] }, slots: { w: [], b: [] }, pool: [], rerolls: { w: 1, b: 1 }, human: 'w', mode: 'ai', viewer: 'w' };
function deal() {
  Sound.init();
  if (settings.deal === 'draft') return startDraft();
  const local = settings.mode === 'local';
  const n = settings.count;
  Draft.mode = settings.mode;
  Draft.human = local ? 'w' : settings.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.color;
  const nOf = c => n + (!local && settings.level === 'xtreme' && c !== Draft.human ? 1 : 0);
  const pool = shuffle(WILD_IDS.slice());
  Draft.wild = { w: pool.splice(0, nOf('w')), b: pool.splice(0, nOf('b')) };
  Draft.slots = { w: E.pickSlots('w', Draft.wild.w.length), b: E.pickSlots('b', Draft.wild.b.length) };
  Draft.pool = pool;
  Draft.rerolls = { w: 1, b: 1 };
  show('draft');
  if (local) {
    $('#draftMine').innerHTML = ''; $('#draftTheirs').innerHTML = '';
    passCurtain('w', 'Your deal, White', "Black, look away. White's wildcards and their rules are about to be shown.", "Show White's cards", () => renderDraft('w', true));
  } else renderDraft(Draft.human, true);
}
function slotText(c, q, own) {
  const name = STD_NAMES[E.startType(q)].toLowerCase();
  return `${own ? 'Replaces your' : 'Replaces their'} ${name} on ${E.sqName(q)}`;
}
function cardHTML(t, secret, color, q) {
  const w = WILD[t];
  return `<div class="card ${secret ? 'secret' : ''}" style="--acc:${w.accent}"><div class="card-in">
    <div class="card-face"><div class="card-art">${pieceSVG(t, color)}${secret ? '<span class="q-mark">?</span>' : ''}</div>
      <div class="card-name">${w.name}</div>
      <div class="card-moves">${secret ? 'Ability unknown' : esc(w.moves)}</div>
      ${q == null ? '' : `<div class="card-slot">${slotText(color, q, !secret)}</div>`}
      <div class="card-desc">${secret ? 'Its rules stay hidden until the game is over. Watch what it does.' : w.desc}</div></div>
    <div class="card-back"></div></div></div>`;
}
function renderDraftSide(sel, c, secret, delay) {
  const box = $(sel);
  box.innerHTML = Draft.wild[c].map((t, i) => cardHTML(t, secret, c, Draft.slots[c][i])).join('');
  [...box.children].forEach((el, i) => setTimeout(() => { el.classList.add('up'); Sound.play('deal'); }, delay + i * 260));
}
/* Show the deal from one side's point of view: its own cards face up, the other side's as secrets. */
function renderDraft(viewer, fresh) {
  Draft.viewer = viewer;
  const local = Draft.mode === 'local', other = opp(viewer);
  $('#draftMineTitle').textContent = local ? `${sideName(viewer)} · yours` : 'Yours';
  $('#draftTheirsTitle').textContent = local ? `${sideName(other)} · theirs` : 'Theirs';
  renderDraftSide('#draftMine', viewer, false, fresh ? 250 : 60);
  if (fresh) renderDraftSide('#draftTheirs', other, true, 650);
  $('#startLabel').textContent = local && viewer === 'w' ? 'Done. Pass to Black' : 'Start the game';
  syncReroll();
}
function syncReroll() {
  const b = $('#rerollBtn'), left = Draft.rerolls[Draft.viewer];
  b.textContent = left ? 'Reroll mine (1 left)' : 'No rerolls left';
  b.disabled = !left;
}
$('#rerollBtn').addEventListener('click', () => {
  const c = Draft.viewer;
  if (!Draft.rerolls[c]) return;
  Draft.rerolls[c]--;
  Draft.pool.push(...Draft.wild[c]);
  Draft.wild[c] = Draft.pool.splice(0, Draft.wild[c].length);
  renderDraft(c, false);
});
$('#startBtn').addEventListener('click', () => {
  if (Draft.mode === 'local' && Draft.viewer === 'w') {
    passCurtain('b', 'Your deal, Black', "White, look away. Black's wildcards and their rules are about to be shown.", "Show Black's cards", () => renderDraft('b', true));
    return;
  }
  const cfg = { mode: Draft.mode, wild: { w: Draft.wild.w.slice(), b: Draft.wild.b.slice() }, slots: Draft.slots, human: Draft.human, level: settings.level,
    privacy: settings.privacy, autoflip: settings.autoflip };
  if (Draft.mode === 'ai') Draft.wild[Draft.human].forEach(discover);
  show('game');
  G.start(cfg);
});

/* ---------- the pass-the-device curtain ---------- */
let curtainCb = null;
function passCurtain(c, title, text, btn, cb) {
  $('#curtainIco').innerHTML = pieceSVG('K', c);
  $('#curtainIco').classList.toggle('dark', c === 'b');
  $('#curtainK').textContent = 'Pass the device';
  $('#curtainTitle').textContent = title;
  $('#curtainText').textContent = text;
  $('#curtainBtnLabel').textContent = btn;
  $('#curtain').hidden = false;
  hideTip(); hideChooser();
  curtainCb = cb;
}
$('#curtainBtn').addEventListener('click', () => {
  Sound.init(); Sound.play('deal');
  $('#curtain').hidden = true;
  const f = curtainCb; curtainCb = null;
  if (f) f();
});

/* ---------- the draft: 16 pairs, take one, the other goes to your opponent ---------- */
const DRAFT_STD = ['P', 'P', 'P', 'P', 'P', 'P', 'N', 'N', 'B', 'B', 'R', 'R', 'Q'];
const PD = { pairs: [], order: [], i: 0, army: { w: [], b: [] }, gift: { w: [], b: [] }, shown: new Set(), revealTimer: 0, known: { w: new Set(), b: new Set() }, mode: 'ai', human: 'w', viewer: 'w', busy: false, token: 0 };
function makePairs() {
  const wilds = shuffle(WILD_IDS.slice());
  let wi = 0;
  const card = () => (Math.random() < 0.4 ? wilds[wi++ % wilds.length] : DRAFT_STD[Math.floor(Math.random() * DRAFT_STD.length)]);
  const pairs = [];
  for (let i = 0; i < 15; i++) {
    const a = card();
    let b = card();
    while (b === a) b = card();
    pairs.push(Math.random() < 0.5 ? [a, b] : [b, a]);
  }
  pairs.splice(Math.floor(Math.random() * 16), 0, ['K', 'K']);
  return pairs;
}
function startDraft() {
  Sound.init();
  const local = settings.mode === 'local';
  PD.token++;
  PD.mode = settings.mode; PD.pairs = makePairs(); PD.i = 0; PD.busy = false;
  PD.army = { w: [], b: [] }; PD.gift = { w: [], b: [] }; PD.shown = new Set(); clearTimeout(PD.revealTimer); PD.known = { w: new Set(), b: new Set() };
  PD.human = local ? 'w' : settings.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.color;
  if (local) PD.order = PD.pairs.map((_, i) => (i < 8 ? 'w' : 'b'));
  else { const first = Math.random() < 0.5 ? PD.human : opp(PD.human); PD.order = PD.pairs.map((_, i) => (i % 2 ? opp(first) : first)); }
  PD.viewer = local ? 'w' : PD.human;
  show('pick');
  renderArmies(); renderDots();
  $('#pair').innerHTML = '';
  if (local) passCurtain('w', 'Your picks, White', "Black, look away. White is about to see White's 8 pairs.", "Show White's pairs", () => nextPick());
  else nextPick();
}
function cardFace(t, color, secret) {
  if (WILD[t]) return cardHTML(t, secret, color, null);
  return `<div class="card ${t === 'K' ? 'king' : ''}" style="--acc:var(--gold)"><div class="card-in">
    <div class="card-face"><div class="card-art">${pieceSVG(t, color)}</div>
      <div class="card-name">${STD_NAMES[t]}</div><div class="card-moves">Standard piece</div>
      <div class="card-desc">${STD_DESC[t]}</div></div><div class="card-back"></div></div></div>`;
}
function renderDots() {
  $('#pickDots').innerHTML = PD.pairs.map((pr, i) => {
    const mine = PD.order[i] === PD.viewer;
    return `<i class="${i < PD.i ? (mine ? 'me' : 'them') : ''} ${i === PD.i ? 'now' : ''} ${pr[0] === 'K' && (i < PD.i || mine) ? 'king' : ''}"></i>`;
  }).join('');
}
function renderArmies(fresh, flip) {
  const v = PD.viewer, o = opp(v), local = PD.mode === 'local';
  $('#armyMineT').textContent = `${local ? sideName(v) + "'s" : 'Your'} army · ${PD.army[v].length} / 16`;
  $('#armyTheirsT').textContent = `${local ? sideName(o) + "'s" : 'Their'} army · ${PD.army[o].length} / 16`;
  const row = (c, mine) => {
    let h = '';
    for (let i = 0; i < 16; i++) {
      const t = PD.army[c][i];
      if (!t) { h += `<div class="tile ${c === 'b' ? 'dark' : ''}"></div>`; continue; }
      const isNew = fresh && fresh.has(c + i) ? 'new' : '';
      if (!PD.shown.has(c + i)) {
        h += `<div class="tile mystery ${isNew}" title="Face down until the reveal at the end of the draft"></div>`; continue;
      }
      const unk = !mine && WILD[t] && !PD.known[v].has(t);
      const rev = flip && flip.has(c + i) ? 'reveal' : '';
      h += `<div class="tile full ${c === 'b' ? 'dark' : ''} ${rev} ${rev && WILD[t] ? 'wildrev' : ''}" title="${pieceName(t)}">${pieceSVG(t, c)}${unk ? '<span class="qm">?</span>' : ''}</div>`;
    }
    return h;
  };
  $('#armyMine').innerHTML = row(v, true);
  $('#armyTheirs').innerHTML = row(o, false);
}
function nextPick() {
  const token = PD.token;
  if (PD.i >= PD.pairs.length) return finishDraft();
  const c = PD.order[PD.i], local = PD.mode === 'local';
  if (local && PD.i === 8 && PD.viewer !== 'b') {
    $('#pair').innerHTML = '';
    passCurtain('b', 'Your picks, Black', "White, look away. Black is about to see Black's 8 pairs. Both armies stay face down until the reveal at the end.", "Show Black's pairs", () => {
      PD.viewer = 'b'; renderArmies(); renderDots(); nextPick();
    });
    return;
  }
  renderDots();
  const mine = c === PD.viewer, pair = PD.pairs[PD.i];
  const n = PD.order.slice(0, PD.i + 1).filter(x => x === c).length;
  if (mine) {
    $('#pickWho').textContent = `${local ? sideName(c) + "'s" : 'Your'} pick · ${n} of 8${pair[0] === 'K' ? ' · the king pair' : ''}`;
    $('#pickNote').textContent = pair[0] === 'K' ? 'Two kings. Take one; the other crowns your opponent.' : 'Take one. The other goes to your opponent. Both armies stay face down until the reveal.';
    $('#pair').innerHTML = cardFace(pair[0], c) + '<span class="or">or</span>' + cardFace(pair[1], c);
    const cards = $$('#pair .card');
    cards.forEach((el, k) => {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Take the ' + pieceName(pair[k]));
      setTimeout(() => { if (token === PD.token) { el.classList.add('up'); Sound.play('deal'); } }, 80 + k * 160);
      const choose = () => { if (!PD.busy && token === PD.token) takeCard(k, el, cards[1 - k]); };
      el.addEventListener('click', choose);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    });
  } else {
    $('#pickWho').textContent = `${LEVELS[settings.level].name} AI is picking…`;
    $('#pickNote').textContent = "You can't see what they were offered. One of the two comes to you, face down.";
    $('#pair').innerHTML = '<div class="card hidden-pick"><div class="card-in"><div class="card-face"></div><div class="card-back"></div></div></div><span class="or">or</span><div class="card hidden-pick"><div class="card-in"><div class="card-face"></div><div class="card-back"></div></div></div>';
    PD.busy = true;
    setTimeout(() => {
      if (token !== PD.token) return;
      const k = aiChoose(pair);
      const cards = $$('#pair .card');
      record(k);
      cards[k].classList.add('give'); cards[1 - k].classList.add('take');
      Sound.play('whoosh');
      setTimeout(() => { if (token === PD.token) { PD.busy = false; afterPick(); } }, 560);
    }, 900);
  }
}
function aiChoose(pair) {
  const noise = { easy: 400, medium: 160, pro: 30, xtreme: 0 }[settings.level] || 100;
  const v = pair.map(t => E.cardValue(t) + (Math.random() * 2 - 1) * noise);
  return v[1] > v[0] ? 1 : 0;
}
let lastAdded = null;
function record(k) {
  const c = PD.order[PD.i], pair = PD.pairs[PD.i];
  PD.army[c].push(pair[k]); PD.army[opp(c)].push(pair[1 - k]);
  PD.gift[c].push(false); PD.gift[opp(c)].push(true);
  for (const t of pair) if (WILD[t]) PD.known[c].add(t);
  lastAdded = new Set([c + (PD.army[c].length - 1), opp(c) + (PD.army[opp(c)].length - 1)]);
}
function takeCard(k, el, other) {
  PD.busy = true;
  record(k);
  el.classList.add('take'); other.classList.add('give');
  Sound.play('select');
  const token = PD.token;
  setTimeout(() => { if (token === PD.token) { PD.busy = false; afterPick(); } }, 560);
}
function afterPick() {
  PD.i++;
  renderArmies(lastAdded); renderDots();
  Sound.play('deal');
  nextPick();
}

/* Lay a drafted army out: king on e1, rooks in the corners, queen beside the king, knights and bishops in
   their usual places, pawns across the front, and whatever is left wherever it fits. */
function autoArrange(list, c) {
  const back = c === 'w' ? 0 : 7, front = c === 'w' ? 1 : 6, sq = (f, r) => r * 8 + f, map = {};
  const rest = list.slice();
  rest.splice(rest.indexOf('K'), 1);
  map[sq(4, back)] = 'K';
  const pawns = rest.filter(t => t === 'P'), others = rest.filter(t => t !== 'P').sort((a, b) => E.cardValue(b) - E.cardValue(a));
  const frontT = [];
  while (frontT.length < 8 && pawns.length) frontT.push(pawns.pop());
  while (frontT.length < 8) frontT.push(others.pop());
  const pref = { R: [0, 7], Q: [3], N: [1, 6], B: [2, 5] }, free = new Set([0, 1, 2, 3, 5, 6, 7]), leftovers = [];
  for (const t of others.concat(pawns)) {
    const f = (pref[t] || []).find(x => free.has(x));
    if (f != null) { map[sq(f, back)] = t; free.delete(f); } else leftovers.push(t);
  }
  [3, 5, 2, 1, 6, 0, 7].filter(f => free.has(f)).forEach((f, i) => { map[sq(f, back)] = leftovers[i]; });
  [3, 4, 2, 5, 1, 6, 0, 7].forEach((f, i) => { map[sq(f, front)] = frontT[i]; });
  return map;
}
/* The draft is over: flip all 32 cards one at a time (about 20 seconds), alternating sides, then start. */
const REVEAL_MS = 20000;
function finishDraft() {
  const v = PD.viewer, o = opp(v), local = PD.mode === 'local', token = PD.token;
  const army = { w: autoArrange(PD.army.w, 'w'), b: autoArrange(PD.army.b, 'b') };
  const wild = { w: [...new Set(PD.army.w.filter(t => WILD[t]))], b: [...new Set(PD.army.b.filter(t => WILD[t]))] };
  if (!local) wild[PD.human].forEach(discover);
  const known = { w: [...PD.known.w], b: [...PD.known.b] };
  const state = E.newGame({ wild, army });
  const order = [];
  for (let i = 0; i < 16; i++) order.push([v, i], [o, i]);
  const step = REVEAL_MS / order.length;
  let n = 0, finished = false;
  const begin = () => {
    if (finished || token !== PD.token) return;
    finished = true;
    clearTimeout(PD.revealTimer);
    for (const [c, i] of order) PD.shown.add(c + i);
    renderArmies();
    $('#pickWho').textContent = 'The armies are set';
    $('#pickNote').textContent = 'The game starts in a moment.';
    setTimeout(() => {
      if (token !== PD.token) return;
      show('game');
      G.start({ mode: PD.mode, human: PD.human, level: settings.level, wild, state, known, privacy: settings.privacy, autoflip: settings.autoflip,
        arrange: local ? ['w', 'b'] : [PD.human] });
    }, 1300);
  };
  const tick = () => {
    if (finished || token !== PD.token) return;
    if (n >= order.length) { begin(); return; }
    const [c, i] = order[n++], t = PD.army[c][i], mine = c === v;
    PD.shown.add(c + i);
    renderArmies(null, new Set([c + i]));
    const secret = !mine && WILD[t] && !PD.known[v].has(t);
    $('#pickWho').textContent = `The reveal · ${n} of ${order.length} · ${mine ? (local ? sideName(v) + "'s" : 'yours') : (local ? sideName(o) + "'s" : 'theirs')}`;
    $('#pair').innerHTML = cardFace(t, c, secret);
    const card = $('#pair .card');
    card.classList.add('fast', mine ? 'from-mine' : 'from-theirs');
    if (WILD[t]) card.classList.add('wildrev');
    requestAnimationFrame(() => card.classList.add('up'));
    Sound.play(WILD[t] ? 'magic' : t === 'K' ? 'check' : 'deal');
    PD.revealTimer = setTimeout(tick, step);
  };
  renderDots();
  $('#pair').innerHTML = '';
  $('#pickWho').textContent = 'Draft complete · the reveal';
  $('#pickNote').innerHTML = '<button class="btn ghost small" id="skipReveal"><span>Skip the reveal</span></button>';
  $('#skipReveal').addEventListener('click', begin);
  PD.revealTimer = setTimeout(tick, 900);
}
$('#pickBack').addEventListener('click', () => { PD.token++; PD.busy = false; clearTimeout(PD.revealTimer); show('setup'); });

/* ---------- setting up a drafted army: tap two of your pieces to swap them ---------- */
function showArrangeBar(c) {
  $('#arrangeText').textContent = `${G.mode === 'local' ? sideName(c) + ', set' : 'Set'} up your army: tap two pieces to swap them. The king stays put.`;
  $('#arrangeBar').hidden = false;
}
function hideArrangeBar() { $('#arrangeBar').hidden = true; }
function arrangeSeq(colors) {
  if (!colors.length) {
    G.arranging = null; hideArrangeBar();
    G.hist = [{ s: G.s }]; G.legal = E.legalMoves(G.s);
    if (G.mode === 'local') {
      if (G.privacy) { handTo(G.s.turn, afterIntro, true); return; }
      G.view = G.s.turn; if (G.autoflip) G.board.setFlip(G.s.turn === 'b');
    }
    toast(`${pieceSVG('K', G.s.turn)}<span>Armies ready. ${G.mode === 'local' ? sideName(G.s.turn) + ' to move' : G.s.turn === G.human ? 'Your move' : 'Their move'}</span>`, 'var(--gold)');
    afterIntro();
    return;
  }
  const c = colors[0];
  const go = () => {
    G.arranging = c; G.arrSel = -1;
    if (G.mode === 'local') { G.view = c; if (G.autoflip) G.board.setFlip(c === 'b'); }
    showArrangeBar(c); G.render();
    arrangeDone = () => { G.arranging = null; hideArrangeBar(); arrangeSeq(colors.slice(1)); };
  };
  if (G.mode === 'local' && G.privacy) {
    G.arranging = c; hideArrangeBar(); G.render();
    passCurtain(c, `${sideName(c)}, set up your army`, `${sideName(opp(c))}, look away while ${sideName(c)} arranges their pieces.`, `I'm ${sideName(c)}. Show my army`, go);
  } else go();
}
let arrangeDone = null;
$('#arrangeDone').addEventListener('click', () => { if (arrangeDone) { const f = arrangeDone; arrangeDone = null; Sound.play('select'); f(); } });
function arrangeTap(q) {
  const p = G.s.b[q];
  if (!p || p.c !== G.arranging) { G.arrSel = -1; renderMarks(); return; }
  if (p.t === 'K') { G.arrSel = -1; renderMarks(); toast(`${pieceSVG('K', p.c)}<span>The king stays on its own square</span>`, 'var(--gold)'); return; }
  if (G.arrSel < 0 || G.arrSel === q) { G.arrSel = G.arrSel === q ? -1 : q; Sound.play('select'); renderMarks(); return; }
  const a = G.arrSel, b = G.s.b.slice();
  [b[a], b[q]] = [b[q], b[a]];
  for (const k of [a, q]) if (b[k].t === 'phoenix') b[k] = { ...b[k], d: { ...b[k].d, home: k } };
  G.s = { ...G.s, b };
  G.arrSel = -1;
  G.board.setPieces(G.s, { anim: true });
  Sound.play('move');
  renderMarks();
}

/* ---------- the game ---------- */
const G = {
  board: null, s: null, hist: [], log: [], mode: 'ai', human: 'w', ai: 'b', level: 'medium', wild: null,
  privacy: true, autoflip: true, view: 'w', intro: false, passing: false, arranging: null, arrSel: -1, known: null, drafted: false,
  legal: [], sel: -1, selMoves: [], busy: false, over: null, token: 0, hover: -1,
  start(cfg) {
    this.token++;
    this.mode = cfg.mode || 'ai'; this.privacy = cfg.privacy !== false; this.autoflip = cfg.autoflip !== false;
    this.human = cfg.human; this.ai = this.mode === 'ai' ? opp(cfg.human) : null; this.level = cfg.level; this.wild = cfg.wild;
    const fresh = !cfg.state;
    this.s = cfg.state || E.newGame({ wild: cfg.wild, slots: cfg.slots });
    this.hist = cfg.hist || [{ s: this.s }];
    this.log = cfg.log || [];
    this.over = null; this.sel = -1; this.busy = false; this.intro = fresh; this.passing = false; this.arranging = null; this.arrSel = -1;
    this.known = cfg.known || null; this.drafted = !!cfg.known;
    this.view = this.mode === 'local' ? this.s.turn : this.human;
    this.board.setFlip(this.mode === 'local' ? (this.autoflip && this.s.turn === 'b') : this.human === 'b');
    this.legal = E.legalMoves(this.s);
    const lv = LEVELS[this.level];
    $('#game').style.setProperty('--lv', this.mode === 'local' ? 'var(--gold)' : lv.color);
    $('#modeChip').textContent = this.mode === 'local' ? 'Pass & Play · 2 players' : `vs ${lv.name} · ${lv.who}`;
    if (cfg.arrange) { this.board.clear(); this.board.setPieces(this.s, { anim: true }); Sound.play('deal'); }
    else if (fresh) this.board.setPieces(startingArmy(this.s, cfg.slots), { anim: false });
    else this.board.setPieces(this.s, { anim: false, frozen: frozenSquares(this.s) });
    this.board.resetEnd();
    renderWildInfo(); renderLog(); this.render();
    if (cfg.arrange) { arrangeSeq(cfg.arrange); return; }
    const go = () => (fresh ? runIntro(cfg.slots) : afterIntro());
    if (this.mode === 'local' && this.privacy) handTo(this.s.turn, go, true);
    else go();
  },
  render() {
    renderBars(); renderStatus(); renderMarks();
    renderWildInfo();
    const canUndo = this.mode === 'local' ? !this.over && this.hist.length > 1
      : this.level !== 'xtreme' && !this.over && this.hist.some((h, i) => i > 0 && this.hist[i - 1].s.turn === this.human);
    $('#undoBtn').disabled = !canUndo || this.intro || this.passing || !!this.arranging;
    $('#undoBtn').title = this.mode === 'ai' && this.level === 'xtreme' ? 'No take-backs in Xtreme' : '';
    $('#resignBtn').disabled = !!this.over || this.intro || this.passing || !!this.arranging;
  },
};
/* Who is looking at the screen: whose wildcard rules may be shown. */
function viewerSide() { return G.mode === 'local' ? G.view : G.human; }
function hasOracle(c) { return !!(G.s && G.s.b.some(p => p && p.t === 'oracle' && p.c === c)); }
/* Can the viewer read the rules of side c's wildcard type t? Own pieces, the Oracle, and (in a draft)
   every card that was offered to you, including the ones you passed to your opponent. */
function seenInDraft(c, t) { const v = viewerSide(); return !!(G.known && G.known[v] && G.known[v].includes(t)) && v !== c; }
function knowsType(c, t) { const v = viewerSide(); return !!G.over || v === c || hasOracle(v) || seenInDraft(c, t); }
function canAct() {
  return !G.busy && !G.over && !G.intro && !G.passing && !G.arranging && $('#curtain').hidden &&
    (G.mode === 'local' ? G.view === G.s.turn : G.s.turn === G.human);
}

/* The regular army the wildcards are about to replace, for the opening swap animation. */
function startingArmy(s, slots) {
  const b = s.b.slice();
  let id = 100000;
  for (const c of ['w', 'b']) for (const q of slots[c]) b[q] = { t: E.startType(q), c, id: id++, m: false, d: null };
  return { ...s, b };
}
function runIntro(slots) {
  G.intro = true; G.render();
  const list = [];
  for (const c of [G.s.turn, opp(G.s.turn)]) slots[c].forEach(q => list.push(q));
  const shown = startingArmy(G.s, slots);
  const token = G.token;
  list.forEach((q, i) => setTimeout(() => {
    if (token !== G.token) return;
    shown.b = shown.b.slice(); shown.b[q] = G.s.b[q];
    const w = WILD[G.s.b[q].t];
    G.board.burstAt(q, { n: 34, color: [w.accent, '#fff3d0', '#ffffff'], kind: 'spark', speed: 1.5, gravity: -0.02, life: 44 });
    G.board.ringAt(q, w.accent, 1.2, 8, 28);
    G.board.setPieces(shown, { anim: true });
    Sound.play('magic');
  }, 650 + i * 420));
  setTimeout(() => {
    if (token !== G.token) return;
    G.board.setPieces(G.s, { anim: true, frozen: frozenSquares(G.s) });
    toast(`${pieceSVG('K', G.s.turn)}<span>Wildcards in. ${G.mode === 'local' ? sideName(G.s.turn) + ' to move' : 'Your move'}</span>`, 'var(--gold)');
    afterIntro();
  }, 650 + list.length * 420 + 250);
}
function afterIntro() {
  G.intro = false;
  G.render();
  if (G.mode === 'ai' && G.s.turn === G.ai) aiTurn();
}
/* Local games: hand the device to side c behind the privacy curtain. */
function handTo(c, cb, first) {
  const other = sideName(opp(c));
  passCurtain(c, `${sideName(c)}'s turn`, first
    ? `${other}, look away. ${sideName(c)} moves first.`
    : `Hand the device to ${sideName(c)}. ${other}, no peeking at the board.`, `I'm ${sideName(c)}. Show the board`, () => {
    G.view = c;
    if (G.autoflip) G.board.setFlip(c === 'b');
    G.render();
    if (cb) cb();
  });
}

function frozenSquares(s) {
  const out = new Set();
  for (let q = 0; q < 64; q++) { const p = s.b[q]; if (p && p.d && p.d.st > s.ply) out.add(q + 100); }
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
    const el = $(id), local = G.mode === 'local', human = local || c === G.human, lv = LEVELS[G.level];
    const lost = G.s.lost[opp(c)].filter(t => t !== 'K').slice().sort((a, b) => E.value({ t: b, d: { k: 0, ch: 1 } }) - E.value({ t: a, d: { k: 0, ch: 1 } }));
    const diff = Math.round((material(G.s, c) - material(G.s, opp(c))) / 100);
    const chips = (G.wild[c] || []).map(t => `<button class="chip" data-wild="${t}" data-c="${c}" aria-label="${WILD[t].name}">${pieceSVG(t, c)}${knowsType(c, t) ? '' : '<span class="qm">?</span>'}</button>`).join('');
    el.classList.toggle('turn', !G.over && G.s.turn === c);
    const name = local ? sideName(c) : human ? 'You' : lv.name + ' AI';
    const sub = local ? (c === 'w' ? 'Player 1' : 'Player 2') + (!G.over && G.s.turn === c ? ' · to move' : '') : sideName(c) + (human ? '' : ` · <span class="lvl">${lv.who}</span>`);
    el.innerHTML = `<div class="avatar">${pieceSVG(human ? 'K' : lv.icon, c)}</div>
      <div class="pname"><b>${name}${!human && G.busy ? '<span class="thinking"><i></i><i></i><i></i></span>' : ''}</b>
      <span>${sub}</span></div>
      <div class="chips">${chips}</div>
      <div class="capt">${lost.map(t => pieceSVG(t, opp(c))).join('')}${diff > 0 ? `<span class="adv">+${diff}</span>` : ''}</div>`;
  }
}

function renderStatus() {
  let t;
  if (G.mode === 'local') {
    const c = G.s.turn, n = sideName(c);
    if (G.over) t = G.over.winner ? `${sideName(G.over.winner)} wins` : 'Draw';
    else if (G.arranging) t = `${sideName(G.arranging)} sets up`;
    else if (G.intro) t = 'Dealing the wildcards…';
    else if (G.passing) t = `Passing to ${sideName(c)}…`;
    else t = E.inCheck(G.s, c) ? `Check by the ${checkText(G.s, c)}! ${n} to move` : G.s.extra ? `Extra turn! ${n} again` : `${n} to move`;
    $('#status').textContent = t;
    return;
  }
  if (G.over) t = G.over.winner === G.human ? 'You won' : G.over.winner ? 'You lost' : 'Draw';
  else if (G.arranging) t = 'Set up your army';
  else if (G.intro) t = 'Dealing the wildcards…';
  else if (G.s.turn === G.human) t = E.inCheck(G.s, G.human) ? `Check by the ${checkText(G.s, G.human)}!` : (G.s.extra ? 'Extra turn!' : 'Your move');
  else t = G.busy ? 'Thinking…' : 'Their move';
  $('#status').textContent = t;
}

function renderWildInfo() {
  const local = G.mode === 'local';
  const row = (t, c) => {
    const w = WILD[t], k = knowsType(c, t), tag = (local || G.over ? sideName(c) : c === G.human ? 'Yours' : 'Theirs') +
      (k && !G.over && c !== viewerSide() ? (seenInDraft(c, t) ? ' · seen in draft' : ' · Oracle') : '');
    return `<div class="wi ${k ? '' : 'theirs'}" style="--acc:${w.accent}"><div class="wi-art">${pieceSVG(t, c)}</div>
      <div><h4>${w.name}<small>${tag}</small></h4><p>${k ? w.desc : 'Unknown. Watch what it does.'}</p></div></div>`;
  };
  const first = local ? G.view : G.human;
  const html = [first, opp(first)].map(c => G.wild[c].map(t => row(t, c)).join('')).join('');
  if ($('#wildInfo').innerHTML !== html) $('#wildInfo').innerHTML = html;
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
  if (G.arranging) { G.board.setMarks({ sel: G.arrSel }); return; }
  const k = kingSq(s, s.turn);
  if (k >= 0 && (!G.over || G.over.reason === 'mate') && E.inCheck(s, s.turn)) {
    o.check = k; o.checkers = E.checkers(s, s.turn); o.arrows = o.checkers.map(q => [q, k]);
  }
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
  zap: 'Discharge', march: 'Beat the march', split: 'Split in two', infect: 'Bite it', stone: 'Petrify it',
};
function moveLabel(m, s) {
  if (m.promo) return 'Promote to ' + pieceName(m.promo);
  if (m.k === 'raise') return 'Raise a ' + pieceName(m.rt);
  if (m.k === 'transmute') return 'Transmute into a ' + pieceName(m.rt);
  if (m.k === 'pull') return m.t === m.o ? 'Magnetize' : 'Hook it in';
  if (m.k === 'crush' && s.b[m.o].t === 'rampage') return `Rampage (${m.x.length} captures)`;
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
    icon: pieceSVG(m.promo || (m.k === 'raise' || m.k === 'transmute' ? m.rt : m.k === 'spawn' || m.k === 'infect' ? 'P' : m.k === 'wall' ? 'WALL' : pc.t), G.s.turn),
  })), x, y, i => humanMove(ms[i]));
  return true;
}

function humanMove(m) {
  if (!canAct()) return;
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
    if (G.arranging) { if ($('#curtain').hidden) arrangeTap(q); return; }
    const myTurn = canAct();
    if (myTurn && G.sel >= 0 && q !== G.sel) {
      const ms = G.selMoves.filter(m => m.t === q && m.t !== m.o);
      if (ms.length) { tryMove(ms, e.clientX, e.clientY); return; }
    }
    if (myTurn && p && p.c === G.s.turn) {
      const wasSel = q === G.sel;
      if (!wasSel) select(q);
      const el = G.board.elAt(q);
      drag = { q, el, x0: e.clientX, y0: e.clientY, moved: false, wasSel, id: e.pointerId };
      root.setPointerCapture(e.pointerId);
      return;
    }
    if (p) showTip(tipHTML(p, knowsType(p.c, p.t)), e.clientX, e.clientY, 2600);
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
      if (p && G.sel < 0) { const x = e.clientX, y = e.clientY; hoverTimer = setTimeout(() => showTip(tipHTML(p, knowsType(p.c, p.t)), x, y), 420); }
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
  pull: 'drags them in', zap: 'discharges!', march: 'beats the march', split: 'splits in two', infect: 'bites!', stone: 'turns a piece to stone', transmute: 'transmutes a pawn', swapE: 'trades places with an enemy',
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
    case 'pull': t = m.t === m.o ? `magnetizes from ${code(m.o)}, pulling ${m.pushes.length / 2} in` : `hooks the ${pieceName(tgt.t)} on ${code(m.t)} and drags it to ${code(m.pushes[1])}`; break;
    case 'zap': t = `discharges at ${code(m.o)}, frying ${m.x.length} pawn${m.x.length > 1 ? 's' : ''}`; break;
    case 'march': t = `beats the march: ${m.pushes.length / 2} pawn${m.pushes.length > 2 ? 's' : ''} advance`; break;
    case 'split': t = `splits, a new Amoeba on ${code(m.t)}`; break;
    case 'infect': t = `bites the ${pieceName(tgt.t)} on ${code(m.t)}, turning it into a pawn`; break;
    case 'stone': t = `turns the ${pieceName(tgt.t)} on ${code(m.t)} to stone`; break;
    case 'transmute': t = `transmutes the pawn on ${code(m.t)} into a ${pieceName(m.rt)}`; break;
    default: t = `${code(m.f)}–${code(m.t)}`;
  }
  for (const e of ns.events || []) {
    if (e.k === 'venom') t += '. The capturer is poisoned';
    if (e.k === 'void') t += '. Swallowed by the Void';
    if (e.k === 'reborn') t += '. A Phoenix is reborn';
    if (e.k === 'extra') t += '. Extra turn';
    if (e.k === 'echo') t += '. An echo pawn stays behind';
    if (e.k === 'morph') t += `. It becomes a ${pieceName(ns.b[e.q].t)}`;
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
    case 'swap': board.ringAt(m.o, acc, 0.8); board.ringAt(m.t, acc, 0.8); snd = 'magic'; msg = s.b[m.t] && s.b[m.t].c !== actor.c ? 'swapE' : 'swap'; break;
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
    case 'pull':
      for (let i = 0; i < m.pushes.length; i += 2) board.beam(m.o, m.pushes[i], acc, 14);
      board.ringAt(m.o, acc, 1, 6, 22); snd = 'zap'; msg = 'pull'; break;
    case 'zap':
      for (const q of m.x) { board.beam(m.o, q, '#7df9ff', 16); board.burstAt(q, { n: 18, color: ['#7df9ff', '#ffffff'], kind: 'spark', speed: 1.6, gravity: 0 }); }
      board.ringAt(m.o, '#7df9ff', 1.3, 8, 22); snd = 'zap'; shake = 1; msg = 'zap'; break;
    case 'march': for (let i = 1; i < m.pushes.length; i += 2) board.burstAt(m.pushes[i], { n: 6, color: ['#ff8c42', '#ffd0a8'], kind: 'spark', speed: 0.6 }); snd = 'stone'; msg = 'march'; break;
    case 'split': board.burstAt(m.t, { n: 26, color: ['#9cff6e', '#d9ffc6'], kind: 'smoke', speed: 0.7, size: 0.1, life: 50 }); snd = 'magic'; msg = 'split'; break;
    case 'infect': board.burstAt(m.t, { n: 26, color: ['#a3e635', '#3f6212'], kind: 'smoke', speed: 0.6, size: 0.1, life: 55 }); snd = 'capture'; msg = 'infect'; break;
    case 'stone': board.beam(m.o, m.t, '#34d399', 18); board.burstAt(m.t, { n: 22, color: ['#9a958c', '#cfcac0'], kind: 'chip', speed: 0.7 }); snd = 'stone'; msg = 'stone'; break;
    case 'transmute': board.burstAt(m.t, { n: 30, color: ['#6ee7b7', '#ffffff', '#ffd98e'], kind: 'spark', speed: 1.1, gravity: -0.03 }); board.ringAt(m.t, '#6ee7b7', 0.9); snd = 'magic'; msg = 'transmute'; break;
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
    if (e.k === 'echo') { board.ringAt(e.q, '#a5b4fc', 0.8, 5, 22); }
    if (e.k === 'morph') { board.burstAt(e.q, { n: 26, color: ['#e879f9', '#fff'], kind: 'spark', speed: 1.1 }); evMsg = ['changeling', `The Changeling becomes a ${pieceName(ns.b[e.q].t)}`]; }
    if (e.k === 'crumble') board.burstAt(e.q, { n: 16, color: ['#8d8476', '#b3aa9b'], kind: 'chip', speed: 0.8, size: 0.06 });
  }
  board.setPieces(ns, { anim: true, instant, fly, frozen: frozenSquares(ns) });
  if (shake) board.shake(shake > 1);
  if (quiet) return;
  Sound.play(snd);
  if (evMsg) toast(`${pieceSVG(evMsg[0], 'w')}<span>${evMsg[1]}</span>`, WILD[evMsg[0]].accent);
  else if (msg && aw) toast(`${pieceSVG(actor.t, actor.c)}<span>${aw.name} ${msg === 'tele' ? 'teleports' : VERB[msg]}</span>`, acc);
}

/* Who is giving check, as words: 'Rook on e8' or 'Bomber on d5 and Knight on f3'. */
function checkText(s, c) { return E.checkers(s, c).map(q => `${pieceName(s.b[q].t)} on ${E.sqName(q)}`).join(' and the '); }

function checkFX() {
  const s = G.s, c = s.turn, k = E.findKing(s, c), b = G.board;
  if (k < 0 || G.over) return;
  Sound.play('check');
  b.stamp('Check!', 'check');
  b.flash('red');
  b.ringAt(k, '#ff3b20', 1.2, 9, 28);
  for (const q of E.checkers(s, c)) { b.ringAt(q, '#ff6a4a', 0.8, 5, 22); b.burstAt(q, { n: 12, color: ['#ff3b20', '#ffb199'], kind: 'spark', speed: 0.8, gravity: 0 }); }
  const el = b.elAt(k);
  if (el) { el.classList.remove('checked'); void el.offsetWidth; el.classList.add('checked'); setTimeout(() => el.classList.remove('checked'), 800); }
}

/* The finale before the result card. Returns how long to wait before showing it. */
function endFX(st, prev) {
  const b = G.board;
  if (st.reason === 'mate' || st.reason === 'king') {
    const loser = opp(st.winner), lose = G.mode === 'ai' && loser === G.human;
    const k = st.reason === 'mate' ? E.findKing(G.s, loser) : E.findKing(prev, loser);
    const tk = G.token;
    if (st.reason === 'mate') setTimeout(() => { if (tk === G.token) Sound.play('check'); }, 150);
    setTimeout(() => {
      if (tk !== G.token) return;
      if (k >= 0) {
        b.spotlight(k);
        b.ringAt(k, '#ffcf6b', 2.6, 14, 44); b.ringAt(k, lose ? '#ff5a3c' : '#ffd98e', 1.7, 10, 32);
        b.burstAt(k, { n: 70, color: lose ? ['#ff8a6a', '#ff3b20', '#fff'] : ['#ffd98e', '#ff9a3c', '#ffffff'], kind: 'spark', speed: 2.4, life: 64, gravity: 0.03 });
        b.burstAt(k, { n: 20, color: ['#3a332c', '#5a5048'], kind: 'smoke', speed: 0.6, size: 0.16, life: 70, gravity: -0.03 });
        const el = st.reason === 'mate' ? b.elAt(k) : null;
        if (el) el.classList.add('toppled');
      }
      b.shake(true); b.flash(lose ? 'red' : 'gold');
      Sound.play('mate');
      const sub = G.mode === 'local' ? `${sideName(st.winner)} wins` : lose ? 'You lose' : 'You win';
      b.stamp(`${st.reason === 'mate' ? 'Checkmate' : 'King down!'}<small>${sub}</small>`, 'mate' + (lose ? ' lose' : ''), 0);
    }, 550);
    return 3100;
  }
  if (st.reason === 'resign') return 0;
  setTimeout(() => b.stamp(st.reason === 'stalemate' ? 'Stalemate' : 'Draw', 'draw', 0), 400);
  return 2100;
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
  const check = !st.over && E.inCheck(ns, ns.turn);
  if (st.over && st.reason === 'mate') { const l = G.log[G.log.length - 1]; l.text = l.text.replace(/ \+$/, '') + ' #'; }
  renderLog();
  if (st.over) {
    G.over = st; renderWildInfo(); G.render();
    const tk = G.token, wait = endFX(st, s);
    setTimeout(() => { if (tk === G.token) endGame(st); }, wait);
    return;
  }
  if (G.mode === 'local' && ns.turn !== s.turn) {
    if (G.privacy) {
      G.passing = true; G.render();
      const token = G.token;
      setTimeout(() => { if (token !== G.token) return; G.passing = false; handTo(ns.turn, check ? () => setTimeout(checkFX, 150) : null); }, 900);
      return;
    }
    G.view = ns.turn;
    if (G.autoflip) setTimeout(() => { if (G.s === ns) { G.board.setFlip(ns.turn === 'b'); G.render(); } }, 700);
  }
  G.render();
  if (check) setTimeout(() => { if (G.s === ns) checkFX(); }, 260);
  if (G.mode === 'ai' && ns.turn === G.ai) aiTurn();
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
  if (G.over || G.intro || G.passing) return;
  if (G.mode === 'local') {
    if (G.hist.length < 2) return;
    G.token++;
    G.hist.pop(); G.log.pop();
    G.s = G.hist[G.hist.length - 1].s;
    G.legal = E.legalMoves(G.s); G.sel = -1; G.selMoves = [];
    G.board.setPieces(G.s, { anim: true, frozen: frozenSquares(G.s) });
    renderLog();
    if (G.view !== G.s.turn) { if (G.privacy) { G.render(); handTo(G.s.turn); return; } G.view = G.s.turn; if (G.autoflip) G.board.setFlip(G.view === 'b'); }
    G.render();
    return;
  }
  if (G.level === 'xtreme') return;
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
  mate: (w, l) => `Checkmate. ${l} has nowhere to go.`,
  king: (w, l) => `${l} was destroyed outright.`,
  resign: (w, l) => (G.mode === 'local' ? `${l.replace(/'s king$/, '')} resigned.` : 'You resigned.'),
  stalemate: () => 'Stalemate: no legal moves, but no check either.',
  fifty: () => '50 moves passed without a capture or pawn move.',
  repetition: () => 'The same position came up three times.',
  material: () => 'Only the kings are left standing.',
};
function endGame(st) {
  for (const el of G.board.root.querySelectorAll('.stamp')) el.remove();
  const local = G.mode === 'local', draw = !st.winner, won = !local && st.winner === G.human;
  Sound.play(local ? (draw ? 'move' : 'win') : won ? 'win' : draw ? 'move' : 'lose');
  const loser = st.winner ? opp(st.winner) : null;
  const loserName = !loser ? '' : local ? `${sideName(loser)}'s king` : loser === G.human ? 'Your king' : 'Their king';
  const sides = local ? ['w', 'b'] : [G.ai];
  const reveal = sides.map(c => G.wild[c].map(t => {
    const fresh = discover(t), w = WILD[t];
    return `<div class="wi" style="--acc:${w.accent}"><div class="wi-art">${pieceSVG(t, c)}</div><div>
      <h4>${w.name}<small>${local ? sideName(c) + "'s wildcard" : 'Their wildcard'}</small></h4>${fresh ? '<div class="new">New in your Codex</div>' : ''}<p>${w.desc}</p></div></div>`;
  }).join('')).join('');
  const title = local ? (draw ? 'Draw' : `${sideName(st.winner)} wins`) : won ? 'Victory' : draw ? 'Draw' : 'Defeat';
  const cls = local ? (draw ? 'draw' : 'win') : won ? 'win' : draw ? 'draw' : 'lose';
  modal(`<h2 class="${cls}">${title}</h2>
    <p class="why">${REASONS[st.reason](st.winner, loserName)}</p>
    <div class="reveal">${reveal}</div>
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
  if (a === 'rematch') { settings.mode = G.mode; deal(); }
  else if (a === 'menu') show('menu');
  else if (a === 'yes' && confirmCb) { const f = confirmCb; confirmCb = null; f(); }
});

$('#undoBtn').addEventListener('click', undo);
$('#flipBtn').addEventListener('click', () => { G.board.setFlip(!G.board.flip); G.render(); });
$('#resignBtn').addEventListener('click', () => {
  if (G.over) return;
  if (G.intro || G.passing || !$('#curtain').hidden) return;
  const local = G.mode === 'local', who = local ? G.s.turn : G.human;
  confirmBox(local ? `Resign as ${sideName(who)}?` : 'Resign?', local ? 'The game ends and both sides\' wildcards are revealed.' : 'The game ends and their wildcard is revealed.', 'Resign', () => {
    G.token++; G.busy = false; G.over = { over: true, winner: opp(who), reason: 'resign' }; renderWildInfo(); G.render(); endGame(G.over);
  });
});
$('#leaveBtn').addEventListener('click', () => {
  if (!$('#curtain').hidden) return;
  if (G.over || (G.hist.length < 2 && !G.arranging)) { G.token++; hideArrangeBar(); show('menu'); return; }
  confirmBox('Leave the game?', 'This game will be abandoned.', 'Leave', () => { G.token++; G.busy = false; G.intro = false; G.passing = false; G.arranging = null; hideArrangeBar(); show('menu'); });
});
document.addEventListener('click', e => {
  const c = e.target.closest('.chip[data-wild]');
  if (c) {
    const t = c.dataset.wild, p = { t, c: c.dataset.c };
    const r = c.getBoundingClientRect();
    showTip(tipHTML(p, knowsType(p.c, p.t)), r.left, r.bottom, 3200);
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
  if (!$('#curtain').hidden) return;
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
    this.s = E.newGame({ wild: { w: [a], b: [b] }, slots: { w: E.pickSlots('w', 1), b: E.pickSlots('b', 1) } });
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
  $('#codexLede').textContent = `You've discovered ${discovered.size} of ${WILD_IDS.length} wildcards. A wildcard joins your Codex when you play with it, or when a game against it ends. The small boards show sample moves from d4: dots are moves, red rings are captures, stars are special abilities.`;
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
/* Rising embers behind the menus. */
const Embers = {
  cv: null, cx: null, parts: [], on: false, raf: 0,
  init() {
    this.cv = $('#embers'); this.cx = this.cv.getContext('2d');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    addEventListener('resize', () => this.size());
    this.size();
    for (let i = 0; i < 70; i++) this.parts.push(this.spawn(true));
  },
  size() { const d = Math.min(devicePixelRatio || 1, 2); this.w = innerWidth; this.h = innerHeight; this.cv.width = this.w * d; this.cv.height = this.h * d; this.cx.setTransform(d, 0, 0, d, 0, 0); },
  spawn(any) {
    return { x: Math.random() * this.w, y: any ? Math.random() * this.h : this.h + 10, r: 0.6 + Math.random() * 2.2,
      vy: 0.2 + Math.random() * 0.7, ph: Math.random() * 6.28, sw: 0.3 + Math.random() * 0.8, hue: 30 + Math.random() * 18, a: 0.25 + Math.random() * 0.55 };
  },
  toggle(on) {
    if (!this.parts.length) return;
    if (on && !this.on) { this.on = true; this.tick(); }
    if (!on) { this.on = false; cancelAnimationFrame(this.raf); this.cx.clearRect(0, 0, this.w, this.h); }
  },
  tick() {
    if (!this.on) return;
    const c = this.cx, t = performance.now() / 1000;
    c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      p.y -= p.vy; p.x += Math.sin(t * p.sw + p.ph) * 0.35;
      if (p.y < -10) this.parts[i] = this.spawn(false);
      const fl = p.a * (0.6 + 0.4 * Math.sin(t * 3 + p.ph * 2));
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `hsla(${p.hue},100%,70%,${fl})`); g.addColorStop(1, `hsla(${p.hue},100%,50%,0)`);
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r * 4, 0, 6.29); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    this.raf = requestAnimationFrame(() => this.tick());
  },
};

function splitLetters(el, offset) {
  el.innerHTML = [...el.textContent].map((ch, i) => `<span class="ch" style="--i:${i + offset}"><span>${esc(ch)}</span></span>`).join('');
}
function initFloatCards() {
  const cards = $$('.fcard');
  let pool = [];
  const face = el => {
    if (!pool.length) pool = shuffle(WILD_IDS.slice());
    const t = pool.pop(), w = WILD[t];
    el.style.setProperty('--acc', w.accent);
    el.querySelector('.fcard-in').innerHTML = `<div class="fa">${pieceSVG(t, Math.random() < 0.5 ? 'w' : 'b')}<b>?</b></div><div class="fn">${w.name}</div>`;
  };
  cards.forEach(face);
  let i = 0;
  setInterval(() => {
    if (current !== 'menu' || document.hidden) return;
    const el = cards[i++ % cards.length];
    el.classList.add('turn');
    setTimeout(() => { face(el); el.classList.remove('turn'); }, 330);
  }, 2600);
}

function initMenu() {
  splitLetters($('.logo-a'), 0); splitLetters($('.logo-b'), 8);
  initFloatCards();
  Embers.init();
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
    show('game');
    G.start({ mode: g.mode, privacy: g.privacy, autoflip: g.autoflip, wild: g.wild, human: g.human, level: g.level, state: g.hist[g.hist.length - 1].s, hist: g.hist, log: g.log, known: g.known });
  } else show(data && data.screen && data.screen !== 'game' && data.screen !== 'draft' ? data.screen : 'menu');
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
  window.claude.hot.snapshot(() => ({
    screen: current,
    game: current === 'game' && G.s && !G.over && !G.intro && !G.arranging ? { mode: G.mode, privacy: G.privacy, autoflip: G.autoflip, wild: G.wild, human: G.human, level: G.level, hist: G.hist, log: G.log, known: G.known } : null,
  }));
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
