/* Kingdom Clash: the screens, the game loop, drawing the battle and reading the player's input.
   The battle itself is KCSim (sim.js), the trainers are KCBot (bot.js) set up from KC_TRAINERS
   (trainers.js), and the main menu is KCMenu (menu.js). */
'use strict';

(() => {
  const S = KCSim, A = KCArt, $ = q => document.querySelector(q);
  // The border drawn around the 18 x 32 field, in tiles; each arena sets its own (js/arenas.js), so
  // Cinder Keep shows its battlements and corner braziers.
  let B = 0.6;
  const G = {
    phase: 'home', s: null, bot: null, theme: 'training', art: KCArenas.get('training'), embers: [], acc: 0, last: 0, k: 20, dpr: 1,
    sel: -1, hover: null, drag: false, dragMoved: false, toggle: false,
    fx: [], bg: null, zone: null, zoneKey: '', handKey: '', ui: {}, beamStage: {}, online: null, sim: null,
    intro: 0, ended: 0, shake: 0, lastSec: -1, idleHint: false, trainer: null, res: null,
    // a tower falling: its collapse (seconds since, by tower id), a moment of slow motion, a white flash,
    // and fireworks when a King Tower falls
    falls: {}, slowmo: 0, flash: 0, fireworks: 0,
  };
  let cv, ctx;
  const cardImg = id => KCMenu.cardImg(id);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- screens ---------- */
  function show(id) {
    for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
  }
  function goHome() {
    G.phase = 'home'; G.s = null;
    $('#result').hidden = true;
    show('home');
    KCMenu.show();
  }

  /* ---------- starting a battle ---------- */
  // Each trainer brings a bot skill and how hard their troops hit your towers (Owen, the tutorial,
  // hits at a quarter so new players nearly always win).
  // A foe is a trainer (KC_TRAINERS) or a trophy bot (KCProgress.trophyFoe). You play your saved deck at
  // your card levels; trophy bots bring their own deck and levels, trainers play the starter deck.
  function startBattle(foe) {
    KCSound.unlock();
    if (typeof foe === 'string') foe = KC_TRAINER[foe];
    const T = G.trainer = foe || KCMenu.nextFoe();
    G.online = null;
    const trophy = T.kind === 'trophy', arenaNow = KCProgress.arena();
    G.theme = trophy ? arenaNow.theme : 'training';
    G.art = KCArenas.get(G.theme);
    B = G.art.margin;
    KCScenery.setArena(G.theme);
    G.embers = [];
    G.s = S.create({
      seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, towerDamage: [1, T.towerDamage],
      decks: [trophy ? KCProgress.state.deck : KCProgress.trainingDeck(), T.deck || KC_STARTER_DECK], cardLevels: [KCProgress.cardLevels(), T.cardLevels || {}],
      evos: [KCProgress.evoList(), T.evos || []],
      // tower levels: your King Tower's level; a trophy opponent's from its cards; trainers stay at 1
      levels: [KCProgress.kingInfo().level, trophy ? T.kingLevel || 1 : 1],
    });
    G.sim = G.s;
    G.bot = KCBot.create(1, { skill: T.skill, seed: Math.floor(Math.random() * 1e9), style: T.style });
    const where = trophy ? `${arenaNow.name} · ${T.tier}` : `Training Grounds · ${T.tier}`;
    for (const [sel, text] of [['#foeName', T.name], ['#foeTier', where], ['#scoreFoe', T.name], ['#introFoeName', T.name],
      ['#introFoeTier', trophy ? T.tier : `Level ${T.level} · ${T.tier}`], ['#resFoeName', T.name], ['#introYou', KCMenu.name],
      ['#introFoeClan', T.clan || ''], ['#introYouTier', trophy ? `${KCProgress.state.trophies} trophies` : 'Training'],
      ['#introStakes', trophy && T.stakes ? `Win +${T.stakes.win} · Loss −${T.stakes.loss}` : '']]) $(sel).textContent = text;
    introYou();
    A.trainer($('#introFoe'), T.look);
    Object.assign(G, { fx: [], embers: [], sel: -1, hover: null, acc: 0, ended: 0, lastSec: -1, handKey: '', zoneKey: '', idleHint: false, ui: {}, shake: 0, beamStage: {}, views: {},
      falls: {}, slowmo: 0, flash: 0, fireworks: 0 });
    for (const el of document.querySelectorAll('.fly-crown')) el.remove();
    $('#simWinBtn').hidden = false; $('#netWait').hidden = true;
    $('#leaveBtn').hidden = false; $('#leaveBtn').classList.remove('ask');
    $('#result').hidden = true; $('#bubble').hidden = true; $('#countdown').hidden = true;
    KCScenery.reset();
    KCEmotes.reset(T.mood);
    show('battle');
    layout();
    // a trophy battle first looks for an opponent for a moment
    G.phase = 'intro'; G.intro = trophy ? 2.7 : 1.7; G.finding = trophy;
    $('#intro').classList.toggle('finding', trophy);
    $('#intro').hidden = false;
  }
  // your side of the VS screen: your King, in blue
  function introYou() {
    const el = $('#introYouPic');
    if (el) el.innerHTML = KCEmotes.face('thumbs', 0);
  }
  function begin() {
    $('#intro').hidden = true;
    G.phase = 'play';
    // a trophy battle left before it ends (reload, closed tab) counts as a loss next time the game loads
    if (!G.online) {
      KCProgress.battleStarted(G.trainer);
      if (G.trainer.kind === 'trophy') KCEmotes.foeGreet();
    }
    banner('FIGHT!');
    KCSound.play('fight');
    setTimeout(() => speak('start'), 900);
  }

  /* ---------- layout ---------- */
  function layout() {
    if (!cv) return;
    // a phone held upright: the arena on top, the cards and the energy bar along the bottom
    const phone = innerWidth < 700 && innerHeight > innerWidth * 1.2;
    $('#battle').classList.toggle('phone', phone);
    const narrow = !phone && innerWidth < 1000;
    $('#battle').classList.toggle('narrow', narrow);
    if (phone) { layoutPhone(); return; }
    const gap = narrow ? 8 : 12, enw = narrow ? 50 : 92;
    const avH = innerHeight - 24;
    let cardH = Math.min(150, (avH - 44 - 128 - 36) / 4);
    let cardW = cardH * 5 / 6;
    if (narrow) { cardW = Math.min(cardW, innerWidth * 0.15); cardH = cardW * 1.2; }
    const cardCol = Math.round(cardW + (narrow ? 10 : 26));
    const sides = narrow ? 0 : 2 * 180 + 2 * gap;
    const aspect = (S.W + 2 * B) / (S.H + 2 * B);
    const aw = Math.max(160, Math.min(avH * aspect, innerWidth - 32 - cardCol - enw - 2 * gap - sides));
    G.k = aw / (S.W + 2 * B);
    const ah = G.k * (S.H + 2 * B);
    const root = $('#battle').style;
    root.setProperty('--gap', gap + 'px');
    root.setProperty('--cardw', Math.round(cardW) + 'px');
    root.setProperty('--cardh', Math.round(cardH) + 'px');
    root.setProperty('--cardcol', cardCol + 'px');
    root.setProperty('--enw', enw + 'px');
    root.setProperty('--arenaw', Math.round(aw) + 'px');
    root.setProperty('--arenah', Math.round(ah) + 'px');
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = Math.round(aw) + 'px'; cv.style.height = Math.round(ah) + 'px';
    cv.width = Math.round(aw * G.dpr); cv.height = Math.round(ah * G.dpr);
    G.bg = document.createElement('canvas');
    G.bg.width = cv.width; G.bg.height = cv.height;
    const b = G.bg.getContext('2d');
    b.scale(G.dpr, G.dpr);
    A.arena(b, G.k, B, G.theme);
    // If the battlefield image is still loading, it is drawn from its palette now and swapped in once
    // it arrives.
    if (G.art.field && !KCArenas.ready(KCArenas.image(G.art.field.src))) {
      const theme = G.theme;
      KCArenas.whenReady(G.art.field.src, () => { if (!$('#battle').hidden && G.theme === theme) layout(); });
    }
    G.zoneKey = '';
    requestAnimationFrame(() => KCScenery.resize());
  }
  function layoutPhone() {
    const pad = 8, gap = 6, W = innerWidth - 2 * pad;
    // the next card is a little smaller than the four in hand
    // the hand row (padding 8 and a 3 px border each side) and the energy row span the screen
    const cardW = Math.min(92, (W - 22 - 4 * gap) / 4.6), cardH = cardW * 1.2, nextW = cardW * 0.6;
    const bottom = (cardH + 22) + 48 + 2 * gap;
    const aspect = (S.W + 2 * B) / (S.H + 2 * B);
    const aw = Math.max(160, Math.min(W, (innerHeight - 2 * pad - bottom) * aspect));
    $('#battle').style.setProperty('--barw', Math.round(W) + 'px');
    sizeArena(aw, { cardW, cardH, nextW, gap });
  }
  // Size the arena canvas to aw pixels wide and draw its battlefield (and set the card sizes).
  function sizeArena(aw, o) {
    G.k = aw / (S.W + 2 * B);
    const ah = G.k * (S.H + 2 * B), root = $('#battle').style;
    root.setProperty('--gap', o.gap + 'px');
    root.setProperty('--cardw', Math.round(o.cardW) + 'px');
    root.setProperty('--cardh', Math.round(o.cardH) + 'px');
    root.setProperty('--nextw', Math.round(o.nextW) + 'px');
    root.setProperty('--arenaw', Math.round(aw) + 'px');
    root.setProperty('--arenah', Math.round(ah) + 'px');
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = Math.round(aw) + 'px'; cv.style.height = Math.round(ah) + 'px';
    cv.width = Math.round(aw * G.dpr); cv.height = Math.round(ah * G.dpr);
    G.bg = document.createElement('canvas');
    G.bg.width = cv.width; G.bg.height = cv.height;
    const b = G.bg.getContext('2d');
    b.scale(G.dpr, G.dpr);
    A.arena(b, G.k, B, G.theme);
    if (G.art.field && !KCArenas.ready(KCArenas.image(G.art.field.src))) {
      const theme = G.theme;
      KCArenas.whenReady(G.art.field.src, () => { if (!$('#battle').hidden && G.theme === theme) layout(); });
    }
    G.zoneKey = '';
  }

  /* ---------- the hand ---------- */
  function renderHand() {
    const s = G.s, hand = s.hands[0], evoKey = hand.concat(s.queues[0][0]).map(id => { const e = S.evoCharge(s, 0, id); return e ? e.n : ''; }).join();
    const pend = G.online ? G.online.mine.filter(q => !q.applied).map(q => q.card) : [];
    const key = hand.join() + '|' + s.queues[0][0] + '|' + evoKey + '|' + pend.join() + '|' + ((s.last && s.last[0]) || '');
    if (key === G.handKey) return;
    const prev = G.handKey ? G.handKey.split('|')[0].split(',') : [];
    G.handKey = key;
    const el = $('#hand');
    el.innerHTML = '';
    hand.forEach((id, i) => {
      const c = KC_CARDS[id], b = document.createElement('button');
      b.type = 'button';
      b.className = 'card' + (prev.length && prev[i] !== id ? ' enter' : '') + (G.sel === i ? ' sel' : '');
      b.dataset.slot = i;
      const cost = S.costOf(s, 0, id), costTxt = Number.isFinite(cost) ? cost : '?';
      b.title = c.mirror ? (s.last[0] ? `${c.name}: plays ${KC_CARDS[s.last[0]].name} again, a level higher (${cost} energy)` : `${c.name}: play another card first`) : `${c.name} (${c.cost} energy)`;
      // an evolution's charge: a pip for each play counted, and the evolved card when the next is it
      const ev = S.evoCharge(s, 0, id);
      if (ev && ev.ready) b.classList.add('evo-ready');
      if (pend.includes(id)) b.classList.add('pending');
      const pips = ev ? `<span class="evo-pips">${Array.from({ length: ev.cycle - 1 }, (_, j) => `<i class="${j < ev.n ? 'on' : ''}"></i>`).join('')}</span>` : '';
      b.innerHTML = `<img src="${ev && ev.ready ? KCMenu.cardImg(id, true) : cardImg(id)}" alt="${c.name}${ev && ev.ready ? ' (evolved)' : ''}"><span class="ready"></span><span class="key">${i + 1}</span><span class="cost${c.mirror ? ' mirror' : ''}">${c.mirror ? costTxt : c.cost}</span>${pips}${c.mirror && s.last[0] ? `<span class="mirror-of"><img src="${cardImg(s.last[0])}" alt=""></span>` : ''}`;
      if (ev && ev.ready) b.title = `${c.name}: evolved (${c.cost} energy)`;
      b.addEventListener('pointerdown', e => cardDown(e, i));
      el.appendChild(b);
    });
    const nx = s.queues[0][0], nev = S.evoCharge(s, 0, nx);
    $('#nextImg').src = nev && nev.ready ? KCMenu.cardImg(nx, true) : cardImg(nx);
  }
  function select(i) {
    G.sel = i;
    document.querySelectorAll('.card').forEach((b, j) => b.classList.toggle('sel', j === i));
    if (i >= 0) KCSound.play('select');
  }
  function cardDown(e, i) {
    if (G.phase !== 'play') return;
    e.preventDefault();
    G.toggle = G.sel === i;
    select(i);
    G.drag = true; G.dragMoved = false;
  }
  function overArena(e) {
    const r = cv.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / G.k - B, y: (e.clientY - r.top) / G.k - B };
  }
  const snap = w => ({ x: Math.max(0.5, Math.min(S.W - 0.5, Math.floor(w.x) + 0.5)), y: Math.max(0.5, Math.min(S.H - 0.5, Math.floor(w.y) + 0.5)) });
  // Where a troop or building actually goes: the tile under the pointer if it can be placed there,
  // otherwise the nearest tile it can be placed on (so a card dragged into the red area sticks at its
  // edge). Spells go anywhere.
  let placeKey = '', placeHit = null;
  function placeAt(id, w) {
    const p = snap(w), c = KC_CARDS[S.resolve(G.s, 0, id) || id];
    if (!c || (c.kind === 'spell' && !c.ownSide) || S.canDeploy(G.s, 0, id, p.x, p.y)) return p;
    const key = `${id}|${(G.s.last && G.s.last[0]) || ''}|${p.x},${p.y}|${G.zoneKey}|${G.s.ents.filter(e => e.kind === 'building').map(e => e.id).join()}`;
    if (key === placeKey) return placeHit;
    let best = p, bd = Infinity;
    for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
      const tx = x + 0.5, ty = y + 0.5, d = (tx - w.x) ** 2 + (ty - w.y) ** 2;
      if (d < bd && S.canDeploy(G.s, 0, id, tx, ty)) { bd = d; best = { x: tx, y: ty }; }
    }
    placeKey = key; placeHit = best;
    return best;
  }
  function tryPlay(w) {
    const s = G.s;
    if (!s || G.sel < 0 || G.phase !== 'play') return;
    const slot = G.sel, id = s.hands[0][slot], p = placeAt(id, w);
    if (G.online) { onlinePlay(slot, id, p); return; }
    const r = S.play(s, 0, slot, p.x, p.y);
    if (r === 'ok') { select(-1); G.idleHint = true; return; }
    KCSound.play('error');
    if (r === 'energy') {
      toast(`Not enough energy for ${KC_CARDS[id].name}`);
      const bar = $('#ebar'); bar.classList.remove('flash'); void bar.offsetWidth; bar.classList.add('flash');
      const card = document.querySelector(`.card[data-slot="${slot}"]`);
      if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    } else if (r === 'zone') toast('Place troops on your side of the river');
    else if (r === 'card' && KC_CARDS[id].mirror) toast(`${KC_CARDS[id].name} copies your last card: play another card first`);
  }
  function bindInput() {
    cv.addEventListener('pointermove', e => { G.hover = toWorld(e); });
    cv.addEventListener('pointerleave', () => { if (!G.drag) G.hover = null; });
    cv.addEventListener('pointerdown', e => {
      if (G.drag || G.phase !== 'play') return;
      e.preventDefault();
      G.hover = toWorld(e);
      if (G.sel >= 0) tryPlay(G.hover);
      else toast('Pick a card first, then click the arena');
    });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('pointermove', e => {
      if (!G.drag) return;
      if (overArena(e)) { G.hover = toWorld(e); G.dragMoved = true; }
      else if (G.dragMoved) G.hover = null;
    });
    window.addEventListener('pointerup', e => {
      if (!G.drag) return;
      G.drag = false;
      if (G.dragMoved && overArena(e)) tryPlay(toWorld(e));
      else if (!G.dragMoved && G.toggle) select(-1);
    });
    window.addEventListener('keydown', e => {
      if (G.phase !== 'play' || e.repeat) return;
      const n = '1234'.indexOf(e.key);
      if (n >= 0) { select(G.sel === n ? -1 : n); e.preventDefault(); }
      else if (e.key === 'Escape') select(-1);
    });
  }

  /* ---------- messages ---------- */
  let bubbleT = 0, toastT = 0;
  // The opponent says one of their lines, if they have any (trainers do, trophy opponents don't).
  function speak(key) {
    const L = G.trainer && G.trainer.lines, line = L && L[key];
    if (line) say(Array.isArray(line) ? pick(line) : line);
  }
  function say(text, ms) {
    const b = $('#bubble');
    b.textContent = text; b.hidden = false;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(bubbleT);
    bubbleT = setTimeout(() => { b.hidden = true; }, ms || 2800);
  }
  function toast(text) {
    const t = $('#toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 1600);
  }
  function banner(text, sub) {
    const b = $('#banner');
    b.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    b.hidden = false;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(b._t);
    b._t = setTimeout(() => { b.hidden = true; }, 1700);
  }

  /* ---------- sim events become sound and effects ---------- */
  const SHOOT = { arrow: 'arrow', cannon: 'cannon', snowball: 'snow', bigsnow: 'snow', pot: 'potThrow', quill: 'quill',
    frostbolt: 'frostShot', harpoonlet: 'arrow', arc: 'coilZap', spark: 'sparkShot', arcblast: 'arcBlast', prismray: 'prism', cloudpuff: 'puffShot',
    magmarock: 'potThrow', mortarshell: 'cannon', bolt: 'arrow', thorn: 'arrow' };
  // how high each flyer floats (in tiles)
  const LIFT = { thundercloud: 1.7, griffin: 1.3, owl: 1.25, drake: 1.3, phoenix: 1.25 };
  // a colored ring that spreads out (shockwaves, healing pulses, freezes)
  const shock = (x, y, r, col, life) => G.fx.push({ kind: 'ring', x, y, r, col, life: life || 0.45, max: life || 0.45 });
  const debris = (x, y, n, cols, v) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = (v || 3) * (0.4 + Math.random()); G.fx.push({ kind: 'rock', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, z: 0, vz: 3 + Math.random() * 4, r: 0.07 + Math.random() * 0.12, life: 0.9, max: 0.9, col: cols[i % cols.length] }); } };
  const liftOf = e => (e.air ? LIFT[e.card] || 1.1 : 0);
  function handleEvents() {
    const s = G.s;
    for (const e of s.events) {
      switch (e.type) {
        case 'deploy':
          KCSound.play('deploy');
          if (e.card === 'bees') KCSound.play('buzz');
          ring(e.x, e.y, e.team, 1.4);
          dust(e.x, e.y, 8);
          if (e.evo) {
            // an evolution arrives: a violet burst
            KCSound.play('evo');
            G.fx.push({ kind: 'evo', x: e.x, y: e.y, life: 0.9, max: 0.9 });
            sparks(e.x, e.y, 18, '#c9a8ff', 4); sparks(e.x, e.y, 10, '#7ff0ff', 3);
          }
          break;
        case 'cast':
          KCSound.play({ spears: 'spearsCast', sandstorm: 'sandstorm', flashfreeze: 'freezeCast', gemflash: 'gemFlash', meteor: 'meteorCast', barrel: 'barrelThrow', abyss: 'portal',
            magmaquake: 'slam', ashfall: 'sandstorm', thornroller: 'dig', briarbind: 'dig', cyclone: 'sandstorm', powderkeg: 'barrelThrow', overclock: 'coilRise',
            prismecho: 'chime', heavensguard: 'chime', soulblight: 'portal', collapse: 'portal' }[e.card] || 'spell');
          if (e.card === 'overclock') { shock(e.x, e.y, KC_CARDS.overclock.area, '#ffb52e', 0.5); sparks(e.x, e.y, 14, '#ffd27a', 3.5); }
          if (e.card === 'briarbind') debris(e.x, e.y, 10, ['#6a8a3a', '#5a4020', '#a8c46a'], 3);
          break;
        // the expansion's spells and buildings
        case 'pulse':
          if (e.card === 'magmaquake') { KCSound.play('slam'); G.shake = Math.max(G.shake, 0.22); shock(e.x, e.y, e.r, '#ff8a2a', 0.45); debris(e.x, e.y, 12, ['#4a4256', '#ff8a2a', '#2f2a38'], 3.5); }
          else if (e.card === 'ashfall') puff(e.x, e.y - 0.4, 5, 'rgba(120,105,100,0.7)', e.r * 0.6);
          else if (e.card === 'soulblight') { puff(e.x, e.y, 4, 'rgba(130,230,130,0.55)', e.r * 0.5); }
          break;
        case 'bolt':
          KCSound.play('thunder'); G.shake = Math.max(G.shake, 0.3);
          G.fx.push({ kind: 'bolt', x: e.x, y: e.y - 0.4, fx: e.x + (Math.random() - 0.5) * 2, fy: e.y - 9, seed: Math.random() * 1000, life: 0.4, max: 0.4 });
          G.fx.push({ kind: 'zap', x: e.x, y: e.y - 0.4, r: 1.5, life: 0.45, max: 0.45 });
          sparks(e.x, e.y - 0.5, 14, '#fff6c8', 4);
          break;
        case 'land':
          KCSound.play('slam'); G.shake = Math.max(G.shake, 0.25);
          G.fx.push({ kind: 'flash', x: e.x, y: e.y - 0.4, r: e.r * 0.9, life: 0.5, max: 0.5 });
          shock(e.x, e.y, e.r, '#ffe27a', 0.55); sparks(e.x, e.y, 18, '#fff6c8', 4); debris(e.x, e.y, 10, ['#ffcd33', '#ffffff', '#e09f12'], 3);
          break;
        case 'voidstrike':
          KCSound.play('thunder');
          shock(e.x, e.y, e.r, '#b48cff', 0.4); shock(e.x, e.y, e.r * 0.5, '#ffffff', 0.3);
          sparks(e.x, e.y - 0.4, 10 + Math.min(10, e.n * 2), '#d8b8ff', 3.5);
          break;
        case 'energy':
          KCSound.play('pop');
          G.fx.push({ kind: 'txt', x: e.x, y: e.y - 1.6, txt: '+1', col: e.team === 0 ? '#ff8ad8' : '#ffb0b8', life: 1.1, max: 1.1 });
          sparks(e.x + 0.5, e.y - 0.9, 6, '#ff8ad8', 2);
          break;
        case 'clone':
          KCSound.play('chime');
          shock(e.x, e.y, e.r, '#9fe6ff', 0.55); sparks(e.x, e.y, 18, '#e8fbff', 3.5);
          break;
        case 'bind': KCSound.play('snare'); break;
        case 'mirror':
          KCSound.play('chime');
          shock(e.x, e.y, 1.6, '#ffe27a', 0.5); sparks(e.x, e.y, 12, '#fff6c8', 3);
          break;
        case 'rollend': puff(e.x, e.y, 8, e.card === 'thornroller' ? '#a07850' : '#d8c0a0', 0.8); debris(e.x, e.y, 8, ['#8a5a34', '#a8c46a', '#5a3a1e'], 3); break;
        case 'stun':
          if (e.kind === 'freeze') { if (e.dur < 2) sparks(e.x, e.y, 5, '#cfeeff', 2); }
          else { KCSound.play('stunZap'); sparks(e.x, e.y - 0.6, 5, '#bff4ff', 2.5); }
          break;
        case 'shieldbreak':
          KCSound.play('shieldBreak');
          debris(e.x, e.y - 0.5, 10, e.card === 'broadside' ? ['#a8743e', '#835628', '#5a5f6a'] : ['#e4d2ff', '#a882f0', '#ffffff'], 3);
          break;
        case 'transform': KCSound.play('clunk'); puff(e.x, e.y, 8, '#c9a070', 0.8); break;
        case 'rise':
          if (e.card === 'coil') { KCSound.play('coilRise'); puff(e.x, e.y, 6, '#8a8590', 0.6); }
          else { KCSound.play('wraithRise'); puff(e.x, e.y, 6, 'rgba(150,90,230,0.8)', 0.5); }
          break;
        case 'hide': KCSound.play('coilHide'); break;
        case 'hookthrow': KCSound.play('hookThrow'); break;
        case 'hooked': KCSound.play('hookHit'); shock(e.x, e.y, 0.8, '#d8b880', 0.35); break;
        case 'jump': KCSound.play('jump'); dust(e.x, e.y, 10); break;
        case 'slam':
          // a landing knight, an arriving sage, a drill bursting up: a shockwave on the ground
          if (e.card === 'wintersage') { KCSound.play('freeze'); shock(e.x, e.y, e.r, '#cfeeff', 0.5); sparks(e.x, e.y, 14, '#e9f8ff', 3); break; }
          KCSound.play('slam'); G.shake = Math.max(G.shake, e.card === 'dreadknight' ? 0.35 : 0.18);
          shock(e.x, e.y, e.r, e.card === 'dreadknight' ? '#ff4a5a' : '#c9a8ff', 0.5);
          debris(e.x, e.y, 14, e.card === 'dreadknight' ? ['#3a3346', '#c0283a', '#6a6070'] : ['#6e5a90', '#c9a8ff', '#4a3e66'], 4);
          break;
        case 'egg': KCSound.play('egg'); sparks(e.x, e.y, 10, '#ffcd33', 3); break;
        case 'hatch': KCSound.play('rebirth'); G.fx.push({ kind: 'flash', x: e.x, y: e.y - 0.5, r: 2.2, life: 0.6, max: 0.6 }); sparks(e.x, e.y, 22, '#ffd23f', 4); break;
        case 'leap': KCSound.play(e.card === 'sunsprite' ? 'chime' : 'leap'); break;
        case 'barrel': KCSound.play('barrelBreak'); debris(e.x, e.y, 14, ['#b4733c', '#8c5427', '#5a5f6a'], 3.5); puff(e.x, e.y, 8, '#d8c0a0', 0.7); break;
        case 'healpulse': KCSound.play('heal'); shock(e.x, e.y, e.r, '#ffe27a', 0.5); break;
        case 'spawn': KCSound.play('pop'); puff(e.x, e.y, 4, 'rgba(200,170,255,0.8)', 0.4); break;
        case 'burrow': KCSound.play('dig'); puff(e.x, e.y, 10, '#a07850', 0.6); break;
        case 'surface':
          KCSound.play('surface'); G.shake = Math.max(G.shake, 0.12);
          puff(e.x, e.y, 14, '#a07850', 0.9);
          for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, v = 1.5 + Math.random() * 3; G.fx.push({ kind: 'rock', x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 0, vz: 3 + Math.random() * 5, r: 0.08 + Math.random() * 0.12, life: 0.9, max: 0.9, col: Math.random() < 0.5 ? '#8a6440' : '#c9a070' }); }
          break;
        case 'ram':
          KCSound.play('ramHit'); G.shake = Math.max(G.shake, 0.2 + 0.25 * (e.power - 1));
          sparks(e.x, e.y, 14, '#ffd25a', 4);
          G.fx.push({ kind: 'blast', x: (e.x + e.cx) / 2, y: (e.y + e.cy) / 2, r: 1.2, life: 0.4, max: 0.4 });
          for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 4; G.fx.push({ kind: 'rock', x: e.cx, y: e.cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 0, vz: 4 + Math.random() * 6, r: 0.08 + Math.random() * 0.14, life: 1.1, max: 1.1, col: Math.random() < 0.3 ? '#ffcd33' : '#9a6a3a' }); }
          break;
        case 'breakup': puff(e.x, e.y, 8, '#c9a070', 0.7); break;
        case 'lasso': KCSound.play('lasso'); break;
        case 'snare': KCSound.play('snare'); G.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 0.7, team: 1 - e.team, life: 0.35, max: 0.35 }); break;
        case 'strike': {
          // a lightning bolt from the cloud down onto the building
          KCSound.play('thunder'); G.shake = Math.max(G.shake, 0.25);
          G.fx.push({ kind: 'bolt', x: e.x, y: e.y, fx: e.fx, fy: e.fy - LIFT.thundercloud + 0.3, seed: Math.random() * 1000, life: 0.35, max: 0.35 });
          G.fx.push({ kind: 'zap', x: e.x, y: e.y, r: 1.6, life: 0.4, max: 0.4 });
          sparks(e.x, e.y, 16, '#cfe6ff', 4);
          break;
        }
        case 'thunderclap':
          // a death burst: the Icebound Giant shatters, the Steel Titan bursts, the Phoenix goes up in flame
          if (e.card === 'icegiant') { KCSound.play('iceShatter'); shock(e.x, e.y, e.r, '#cfeeff', 0.55); debris(e.x, e.y - 0.6, 18, ['#cfeeff', '#9fd4f0', '#ffffff'], 4); break; }
          if (e.card === 'titan' || e.card === 'titanling') { KCSound.play('smash'); G.shake = Math.max(G.shake, e.card === 'titan' ? 0.45 : 0.2); G.fx.push({ kind: 'blast', x: e.x, y: e.y, r: e.r, life: 0.45, max: 0.45 }); debris(e.x, e.y - 0.8, e.card === 'titan' ? 20 : 10, ['#d39a48', '#a8712a', '#6a5a48'], 4.5); break; }
          if (e.card === 'magmaturret') { KCSound.play('fireBurst'); G.shake = Math.max(G.shake, 0.3); G.fx.push({ kind: 'flash', x: e.x, y: e.y - 0.6, r: e.r * 1.2, life: 0.55, max: 0.55 }); debris(e.x, e.y - 0.6, 18, ['#ff8a2a', '#4a4256', '#ffe27a'], 4.5); break; }
          if (e.card === 'phoenix') { KCSound.play('fireBurst'); G.fx.push({ kind: 'flash', x: e.x, y: e.y - 1.1, r: e.r * 1.6, life: 0.5, max: 0.5 }); sparks(e.x, e.y - 1.1, 18, '#ffb52e', 4); break; }
          KCSound.play('thunderclap'); G.shake = Math.max(G.shake, 0.4);
          G.fx.push({ kind: 'zap', x: e.x, y: e.y, r: e.r * 1.6, life: 0.6, max: 0.6 });
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; G.fx.push({ kind: 'bolt', x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r * 0.6, fx: e.x, fy: e.y - 1.4, seed: Math.random() * 1000, life: 0.4, max: 0.4 }); }
          puff(e.x, e.y - 1.2, 14, '#5a4c92', 1.6);
          break;
        case 'charge':
          KCSound.play('smash'); G.shake = Math.max(G.shake, 0.22);
          sparks(e.x, e.y, 10, '#fff3c4', 4); puff(e.x, e.y, 8, '#e0c08a', 0.8);
          break;
        case 'shoot': KCSound.play(SHOOT[e.kind] || 'arrow'); break;
        case 'hit':
          if (e.card === 'gorilla' || e.card === 'rhino') { KCSound.play('smash'); G.shake = Math.max(G.shake, e.card === 'rhino' ? 0.12 : 0.18); sparks(e.x, e.y, 6, '#fff3c4'); }
          else if (e.kind === 'cannon') sparks(e.x, e.y, 5, '#ffd27a');
          else if (e.kind === 'prismray') sparks(e.x, e.y - 0.5, 4, '#efe2ff', 2.5);
          else if (e.r) { KCSound.play('smash'); shock(e.x, e.y, e.r, '#ff6a7a', 0.3); }
          else { KCSound.play('hit'); sparks(e.x, e.y, 3, '#ffffff'); }
          break;
        case 'splash':
          if (e.kind === 'pot') { KCSound.play('potBreak'); sparks(e.x, e.y, 10, '#d07a45', 3); puff(e.x, e.y, 6, '#c9a07a', e.r * 0.7); }
          else if (e.kind === 'frostbolt' || e.kind === 'frostleap') { KCSound.play('iceHit'); shock(e.x, e.y, e.r, '#cfeeff', 0.35); sparks(e.x, e.y, 8, '#e9f8ff', 2.5); }
          else if (e.kind === 'sunleap') { shock(e.x, e.y, e.r, '#ffe27a', 0.4); sparks(e.x, e.y, 10, '#fff1a6', 3); }
          else if (e.kind === 'arcblast') { KCSound.play('thunder'); G.shake = Math.max(G.shake, 0.3); G.fx.push({ kind: 'zap', x: e.x, y: e.y, r: e.r * 1.2, life: 0.45, max: 0.45 }); sparks(e.x, e.y, 18, '#cfe6ff', 4.5); }
          else if (e.kind === 'cloudpuff') puff(e.x, e.y, 8, 'rgba(230,240,255,0.9)', e.r * 0.8);
          else if (e.kind === 'magmarock') { KCSound.play('fireBurst'); G.fx.push({ kind: 'flash', x: e.x, y: e.y - 0.2, r: e.r * 1.1, life: 0.35, max: 0.35 }); debris(e.x, e.y, 8, ['#ff8a2a', '#4a4256'], 2.5); }
          else if (e.kind === 'mortarshell') { KCSound.play('smash'); G.shake = Math.max(G.shake, 0.18); G.fx.push({ kind: 'blast', x: e.x, y: e.y, r: e.r * 0.8, life: 0.4, max: 0.4 }); debris(e.x, e.y, 10, ['#c4a264', '#8a6a4a', '#e6c98e'], 3.5); }
          else if (e.kind === 'emberleap') { KCSound.play('fireBurst'); G.fx.push({ kind: 'flash', x: e.x, y: e.y - 0.3, r: e.r * 1.2, life: 0.35, max: 0.35 }); sparks(e.x, e.y, 8, '#ffb52e', 3); }
          else puff(e.x, e.y, 9, '#ffffff', e.r);
          break;
        case 'spin':
          KCSound.play('spin');
          G.fx.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, team: e.team, life: 0.3, max: 0.3 });
          sparks(e.x, e.y, 6, '#e4e9f0', 3);
          break;
        case 'death': KCSound.play('death'); puff(e.x, e.y - (e.air ? 1.1 : 0.3), 7, '#d9d4e8', 0.5); break;
        case 'boom':
          if (e.card === 'glacierslam') { KCSound.play('iceShatter'); G.shake = Math.max(G.shake, 0.2); shock(e.x, e.y, e.r, '#cfeeff', 0.55); debris(e.x, e.y, 16, ['#e8f8ff', '#9fd4f0', '#ffffff'], 4); break; }
          if (e.card === 'flashfreeze') {
            KCSound.play('freeze'); shock(e.x, e.y, e.r, '#cfeeff', 0.7); shock(e.x, e.y, e.r * 0.6, '#ffffff', 0.5);
            for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, d = Math.random() * e.r; sparks(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.6, 1, '#e9f8ff', 1.5); }
            break;
          }
          if (e.card === 'gemflash') { KCSound.play('gemBoom'); shock(e.x, e.y, e.r, '#c9a8ff', 0.4); G.fx.push({ kind: 'zap', x: e.x, y: e.y, r: e.r, life: 0.35, max: 0.35 }); sparks(e.x, e.y, 16, '#efe2ff', 4); break; }
          if (e.card === 'meteor') {
            KCSound.play('meteor'); G.shake = Math.max(G.shake, 0.6);
            G.fx.push({ kind: 'blast', x: e.x, y: e.y, r: e.r * 1.2, life: 0.6, max: 0.6 }); shock(e.x, e.y, e.r * 1.4, '#ff4a5a', 0.6);
            debris(e.x, e.y, 22, ['#3a2e3e', '#ff4a5a', '#241c2a'], 5); sparks(e.x, e.y, 20, '#ff6a5a', 5);
            break;
          }
          if (e.card === 'spears') {
            KCSound.play('spears'); G.shake = Math.max(G.shake, 0.12);
            for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, d = Math.random() * e.r; puff(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.6, 1, 'rgba(220,200,170,0.9)', 0.2); }
            break;
          }
          KCSound.play('boom'); G.shake = Math.max(G.shake, 0.3);
          G.fx.push({ kind: 'blast', x: e.x, y: e.y, r: e.r, life: 0.5, max: 0.5 });
          if (G.art.fx === 'lava') G.fx.push({ kind: 'flash', x: e.x, y: e.y, r: e.r * 2.2, life: 0.45, max: 0.45 });
          sparks(e.x, e.y, 18, '#ffb030', 4);
          break;
        case 'tower': towerFx(e); break;
        case 'double': banner('×2 Energy!', 'Last minute'); KCSound.play('double'); speak('double'); break;
        case 'overtime': banner('Overtime!', 'Next tower wins'); KCSound.play('double'); speak('overtime'); break;
        case 'sudden': banner('Sudden Death!', 'Every tower is crumbling: the weakest falls first'); KCSound.play('thunderclap'); G.shake = Math.max(G.shake, 0.4); break;
        case 'end': endBattle(e); break;
      }
    }
    s.events.length = 0;
  }
  function towerFx(e) {
    KCSound.play('tower');
    const king = e.sub === 'king';
    // the collapse, a beat of slow motion (not online, where both screens keep the same clock), a white
    // flash and a hard shake; the crown flies to the score
    if (e.id) G.falls[e.id] = 0;
    if (!e.chain) {
      if (!G.online) G.slowmo = Math.max(G.slowmo, king ? 0.9 : 0.45);
      G.flash = Math.max(G.flash, king ? 0.55 : 0.3);
      G.shake = Math.max(G.shake, king ? 1.0 : 0.8);
      flyCrown(e);
      if (king) { G.fireworks = 2.4; setTimeout(() => KCSound.play('crown'), 450); setTimeout(() => KCSound.play('crown'), 800); }
    }
    KCScenery.cheer(1 - e.team);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
      G.fx.push({ kind: 'rock', x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 0, vz: 4 + Math.random() * 6, r: 0.12 + Math.random() * 0.2, life: 1.2, max: 1.2, col: Math.random() < 0.3 ? A.TEAM[e.team].cloth : G.art.fx === 'lava' && Math.random() < 0.4 ? '#ff8a2a' : '#b8b2a8' });
    }
    if (G.art.fx === 'lava') {
      // a fiery collapse: a bright flash and a spray of embers
      G.fx.push({ kind: 'flash', x: e.x, y: e.y, r: 4, life: 0.7, max: 0.7 });
      sparks(e.x, e.y, 22, '#ffb030', 5);
    }
    puff(e.x, e.y, 16, '#cfc8dc', 1.6);
    if (e.team === 1) {
      setTimeout(() => KCSound.play('crown'), 250);
      if (e.sub !== 'king') { speak('youTower'); if (!G.online && G.trainer.kind === 'trophy') KCEmotes.foeLostTower(); }
    } else {
      if (e.sub !== 'king') { speak('myTower'); if (!G.online) KCEmotes.foeTookTower(); }
    }
  }
  // A crown leaves the fallen tower and flies to the score (the side panel, or the clock on small screens),
  // which bumps as it lands.
  function flyCrown(e) {
    const box = $('#arena').getBoundingClientRect(), side = e.team === 1 ? '#crownYou' : '#crownFoe';
    let to = $(side);
    if (!to || !to.offsetParent) to = $('#miniTimer');
    if (!to || !to.offsetParent) return;
    const tr = to.getBoundingClientRect(), el = document.createElement('i');
    el.className = 'fly-crown' + (e.team === 1 ? ' you' : ' foe');
    const x0 = box.left + SX(e.x), y0 = box.top + SY(e.y) - G.k * 2.2;
    el.style.left = x0 - 20 + 'px'; el.style.top = y0 - 18 + 'px';
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('go');
      el.style.transform = `translate(${tr.left + tr.width / 2 - x0}px, ${tr.top + tr.height / 2 - y0}px) scale(0.6)`;
    }));
    setTimeout(() => {
      el.remove();
      const row = to.closest('.score-row') || to;
      row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump');
    }, 1150);
  }
  function ring(x, y, team, r) { G.fx.push({ kind: 'ring', x, y, r, team, life: 0.45, max: 0.45 }); }
  function dust(x, y, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; G.fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 0.9, r: 0.18, col: 'rgba(230,215,180,0.8)', life: 0.45, max: 0.45 }); }
  }
  function sparks(x, y, n, col, sp) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = (sp || 2) * (0.5 + Math.random()); G.fx.push({ kind: 'dot', x, y: y - 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0.08 + Math.random() * 0.08, col, life: 0.3, max: 0.3 }); }
  }
  function puff(x, y, n, col, spread) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, d = Math.random() * (spread || 0.6); G.fx.push({ kind: 'puff', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.4 - 0.4, r: 0.25 + Math.random() * 0.3, col, life: 0.6, max: 0.6 }); }
  }
  function updateFx(dt) {
    // a King Tower down: fireworks bursting over the arena for a couple of seconds
    if (G.fireworks > 0) {
      G.fireworks -= dt;
      if (Math.random() < dt * 7) {
        const x = 2 + Math.random() * (S.W - 4), y = 3 + Math.random() * (S.H - 10), cols = ['#ffe27a', '#ff8ad8', '#8cf0ff', '#9be07a', '#ffb052', '#c9a8ff'];
        const col = cols[Math.floor(Math.random() * cols.length)], n = 18;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, v = 3 + Math.random() * 1.5; G.fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0.1, col, life: 0.9, max: 0.9 }); }
        G.fx.push({ kind: 'flash', x, y, r: 1.4, life: 0.35, max: 0.35 });
        KCSound.play('pop');
      }
    }
    for (const id in G.falls) G.falls[id] += dt;
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt);
    for (const f of G.fx) {
      f.life -= dt;
      if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; }
      if (f.kind === 'rock') { f.vz -= 18 * dt; f.z = Math.max(0, f.z + f.vz * dt); if (f.z === 0) { f.vx *= 0.8; f.vy *= 0.8; } }
    }
    G.fx = G.fx.filter(f => f.life > 0);
    G.shake = Math.max(0, G.shake - dt);
  }


  /* ---------- online battles ----------
     Both players run the same simulation from the same seed and swap only their card plays (lockstep).
     The host is team 0 and sees the battle as it is; the guest is team 1 and sees a mirror image of it
     (top and bottom swapped, teams swapped), so each player's side is at the bottom. A play made at
     tick t happens at tick t + DELAY on both screens; a player can only run tick t once it knows the
     other has sent every play up to t, so the faster screen waits for the slower one. Every message
     carries all plays the other side hasn't confirmed, so a dropped message loses nothing. Every two
     seconds both compare a checksum of the battle; if they ever differ the battle stops as out of
     sync. Nothing here is recorded: online battles give no trophies, chests or experience. */
  const DELAY = 9;
  const FLIPY = ['y', 'py', 'ty', 'sy', 'cy', 'fy'];
  function flipObj(o) {
    const c = Object.assign({}, o);
    for (const key of FLIPY) if (typeof c[key] === 'number') c[key] = S.H - c[key];
    if (typeof c.team === 'number') c.team = 1 - c.team;
    if (typeof c.aimY === 'number') c.aimY = -c.aimY;
    if (c.tunnel) c.tunnel = { tx: c.tunnel.tx, ty: S.H - c.tunnel.ty };
    if (c.type === 'end' && c.winner >= 0) c.winner = 1 - c.winner;
    return c;
  }
  // The battle as the guest sees it.
  function mirrorState(s) {
    const sw = a => [a[1], a[0]];
    return Object.assign({}, s, {
      ents: s.ents.map(flipObj), projs: s.projs.map(flipObj), zones: s.zones.map(flipObj), events: s.events.map(flipObj),
      energy: sw(s.energy), crowns: sw(s.crowns), hands: sw(s.hands), queues: sw(s.queues), levels: sw(s.levels), cardLevels: sw(s.cardLevels),
      towerDamage: sw(s.towerDamage), evos: sw(s.evos), evoPlays: sw(s.evoPlays), played: sw(s.played),
      result: s.result && Object.assign({}, s.result, { winner: s.result.winner >= 0 ? 1 - s.result.winner : s.result.winner, crowns: sw(s.result.crowns) }),
    });
  }
  const viewOf = s => (G.online && G.online.team === 1 ? mirrorState(s) : s);
  function hashState(s) {
    let h = s.tick | 0;
    for (const e of s.ents) h = (Math.imul(h, 31) + e.id * 7 + Math.round(e.hp * 8) * 13 + Math.round(e.x * 512) * 17 + Math.round(e.y * 512) * 19 + (e.dead ? 1 : 0)) | 0;
    return (Math.imul(h, 31) + Math.round(s.energy[0] * 64) * 3 + Math.round(s.energy[1] * 64) * 5) | 0;
  }
  function startOnline(m) {
    KCSound.unlock();
    const st = m.start, team = m.role === 'host' ? 0 : 1, foe = team === 0 ? st.guest : st.host;
    const lv = x => Object.fromEntries(x.deck.map((id, i) => [id, x.levels[i]]));
    let hseed = 7; for (const ch of foe.name) hseed = (Math.imul(hseed, 31) + ch.charCodeAt(0)) >>> 0;
    const T = G.trainer = { id: 'online', kind: 'online', name: foe.name, short: foe.name, level: foe.king, tier: `${foe.trophies} trophies`,
      look: KCProgress.trophyFoe(KCSim.mulberry(hseed)).look, lines: null, deck: foe.deck };
    G.theme = st.theme;
    G.art = KCArenas.get(G.theme);
    B = G.art.margin;
    KCScenery.setArena(G.theme);
    G.sim = S.create({ seed: st.seed, towerDamage: [1, 1], decks: [st.host.deck, st.guest.deck], cardLevels: [lv(st.host), lv(st.guest)],
      levels: [st.host.king, st.guest.king], evos: [st.host.evos, st.guest.evos] });
    G.bot = null;
    const O = G.online = { room: m.room, team, peer: m.peer, foeDeck: foe.deck, mine: [], theirs: new Map(), mySeq: 0, myAck: 0, theirAck: 0,
      theirUpTo: -1, lastHeard: performance.now(), sentAt: 0, hashes: {}, theirHashes: {}, lastHash: null, stalledAt: 0, stalled: false, bye: false, leftAt: 0,
      emotesIn: [], stopStart: m.stopStart, unsub: [], done: false };
    G.s = viewOf(G.sim);
    O.unsub.push(m.room.on('mp.step', msg => { if (msg.peer === O.peer && G.online === O) onStep(O, msg.data); }));
    O.unsub.push(m.room.on('mp.emote', msg => {
      if (msg.peer !== O.peer || G.online !== O) return;
      const now = performance.now(), id = msg.data && msg.data.id;
      O.emotesIn = O.emotesIn.filter(t => now - t < 3000);
      if (O.emotesIn.length >= 3 || typeof id !== 'string') return;
      O.emotesIn.push(now);
      KCEmotes.send(1, id);
    }));
    O.unsub.push(m.room.on('mp.bye', msg => { if (msg.peer === O.peer) O.bye = true; }));
    O.unsub.push(m.room.onPeers(ch => { if ((ch.left || []).some(p => p.peer === O.peer)) O.leftAt = O.leftAt || performance.now(); if ((ch.joined || []).some(p => p.peer === O.peer)) O.leftAt = 0; }));
    for (const [sel, text] of [['#foeName', T.name], ['#foeTier', `Online · ${T.tier}`], ['#scoreFoe', T.name], ['#introFoeName', T.name],
      ['#introFoeTier', `Online battle · King Tower ${foe.king}`], ['#resFoeName', T.name], ['#introYou', KCMenu.name],
      ['#introFoeClan', ''], ['#introYouTier', `${KCProgress.state.trophies} trophies`], ['#introStakes', '']]) $(sel).textContent = text;
    introYou();
    A.trainer($('#introFoe'), T.look);
    Object.assign(G, { fx: [], embers: [], sel: -1, hover: null, acc: 0, ended: 0, lastSec: -1, handKey: '', zoneKey: '', idleHint: true, ui: {}, shake: 0, beamStage: {},
      views: {}, falls: {}, slowmo: 0, flash: 0, fireworks: 0, finding: false });
    for (const el of document.querySelectorAll('.fly-crown')) el.remove();
    $('#intro').classList.remove('finding');
    $('#leaveBtn').hidden = false; $('#leaveBtn').classList.remove('ask');
    $('#result').hidden = true; $('#bubble').hidden = true; $('#countdown').hidden = true; $('#simWinBtn').hidden = true; $('#netWait').hidden = true;
    KCScenery.reset();
    KCEmotes.reset();
    show('battle');
    layout();
    G.phase = 'intro'; G.intro = 1.7;
    $('#intro').hidden = false;
    sendStep(O, true);
  }
  function onStep(O, d) {
    if (!d || typeof d !== 'object') return;
    O.lastHeard = performance.now(); O.leftAt = 0;
    if (O.stopStart) { O.stopStart(); O.stopStart = null; }
    if (Array.isArray(d.p)) for (const q of d.p) {
      if (!Array.isArray(q) || q.length !== 5) continue;
      const [seq, at, card, x, y] = q;
      if (!Number.isInteger(seq) || seq < 1 || !Number.isInteger(at) || at < 0 || !O.foeDeck.includes(card)) continue;
      if (typeof x !== 'number' || typeof y !== 'number' || !(x >= 0 && x <= S.W && y >= 0 && y <= S.H)) continue;
      if (O.theirs.has(seq)) continue;
      if (at < G.sim.tick) { desync(O); return; }
      O.theirs.set(seq, { seq, at, card, x, y, team: 1 - O.team, applied: false });
    }
    while (O.theirs.has(O.myAck + 1)) O.myAck++;
    if (Number.isInteger(d.u)) O.theirUpTo = Math.max(O.theirUpTo, d.u);
    if (Number.isInteger(d.a)) O.theirAck = Math.max(O.theirAck, d.a);
    if (Array.isArray(d.h) && Number.isInteger(d.h[0]) && Number.isInteger(d.h[1])) { O.theirHashes[d.h[0]] = d.h[1]; checkHash(O, d.h[0]); }
  }
  function sendStep(O, now) {
    if (!O || O.done) return;
    const plays = O.mine.filter(p => p.seq > O.theirAck).map(p => [p.seq, p.at, p.card, p.x, p.y]);
    O.sentAt = performance.now();
    O.room.emit('mp.step', { u: G.sim.tick + DELAY - 1, p: plays, a: O.myAck, h: O.lastHash }).catch(() => {});
  }
  function checkHash(O, tick) {
    const a = O.hashes[tick], b = O.theirHashes[tick];
    if (a !== undefined && b !== undefined && a !== b) desync(O);
  }
  function desync(O) {
    if (G.sim.result) return;
    S.forceEnd(G.sim, -1, 'desync');
    G.s = viewOf(G.sim); handleEvents(); G.sim.events.length = 0;
  }
  // The plays due at tick t, both players' (the host's first), in the order they were made.
  function applyPlays(O, t) {
    const due = O.mine.filter(p => !p.applied && p.at === t).concat([...O.theirs.values()].filter(p => !p.applied && p.at === t))
      .sort((a, b) => a.team - b.team || a.seq - b.seq);
    for (const p of due) {
      p.applied = true;
      const slot = G.sim.hands[p.team].indexOf(p.card);
      const r = slot >= 0 ? S.play(G.sim, p.team, slot, p.x, p.y) : 'card';
      if (p.team === O.team && r !== 'ok') { KCSound.play('error'); toast(r === 'energy' ? `Not enough energy for ${KC_CARDS[p.card].name}` : `${KC_CARDS[p.card].name} couldn't be played there`); }
    }
  }
  function onlineTick(dt, now) {
    const O = G.online;
    G.acc = Math.min(G.acc + dt, S.DT * 8);
    let n = 0;
    while (G.acc >= S.DT && n < 8 && G.phase === 'play') {
      const t = G.sim.tick;
      if (O.theirUpTo < t) { if (!O.stalled) { O.stalled = true; O.stalledAt = now; } break; }
      O.stalled = false;
      applyPlays(O, t);
      S.step(G.sim);
      if (G.sim.tick % 60 === 0) { const h = hashState(G.sim); O.hashes[G.sim.tick] = h; O.lastHash = [G.sim.tick, h]; checkHash(O, G.sim.tick); }
      G.s = viewOf(G.sim);
      handleEvents(); G.sim.events.length = 0;
      G.acc -= S.DT; n++;
    }
    if (now - O.sentAt > (O.stalled ? 120 : 66)) sendStep(O);
    $('#netWait').hidden = !(O.stalled && now - O.stalledAt > 600);
    // the opponent left: once their last plays are used up, the battle ends as a win
    const gone = O.bye || (O.leftAt && now - O.leftAt > 3000) || now - O.lastHeard > 12000;
    if (gone && O.stalled && !G.sim.result) {
      S.forceEnd(G.sim, O.team, 'left');
      G.s = viewOf(G.sim); handleEvents(); G.sim.events.length = 0;
    }
  }
  function onlinePlay(slot, id, p) {
    const O = G.online, c = KC_CARDS[id];
    if (O.mine.some(q => !q.applied && q.card === id)) { toast(`${c.name} is on its way`); return; }
    const pending = O.mine.filter(q => !q.applied).reduce((a, q) => a + S.costOf(G.s, 0, q.card), 0);
    if (c.mirror && !S.resolve(G.s, 0, id)) { KCSound.play('error'); toast(`${c.name} copies your last card: play another card first`); return; }
    if (G.s.energy[0] - pending < S.costOf(G.s, 0, id)) { KCSound.play('error'); toast(`Not enough energy for ${c.name}`); return; }
    if (!S.canDeploy(G.s, 0, id, p.x, p.y)) { KCSound.play('error'); toast('Place troops on your side of the river'); return; }
    O.mine.push({ seq: ++O.mySeq, at: G.sim.tick + DELAY, card: id, x: p.x, y: O.team === 0 ? p.y : S.H - p.y, team: O.team, vx: p.x, vy: p.y, applied: false });
    select(-1); G.idleHint = true; G.handKey = '';
    KCSound.play('select');
    sendStep(O);
  }
  // Where my plays are about to land: a ring that fills as the moment comes.
  function drawPending(c, t) {
    const O = G.online;
    if (!O) return;
    for (const q of O.mine) {
      if (q.applied) continue;
      const left = Math.max(0, (q.at - G.sim.tick) / DELAY), x = SX(q.vx), y = SY(q.vy), r = G.k * 0.8;
      A.ell(c, x, y, r, r * 0.5); c.fillStyle = 'rgba(120,180,255,0.25)'; c.fill();
      c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + (1 - left) * Math.PI * 2); c.strokeStyle = '#8cc4ff'; c.lineWidth = G.k * 0.12; c.stroke();
    }
  }
  function endOnline() {
    const O = G.online;
    if (!O || O.done) return;
    // keep telling the other side where we are for a moment, so they finish too, then leave
    setTimeout(() => { O.done = true; for (const u of O.unsub) try { u(); } catch (e) { /* gone */ } KCNet.cancel(); }, 4000);
  }

  /* ---------- the end ---------- */
  function endBattle(e) {
    G.phase = 'end';
    G.ended = e.reason === 'king' || e.reason === 'sudden' ? 2.6 : 1.8;
    if (e.winner >= 0) KCScenery.celebrate(e.winner);
    select(-1);
    G.res = G.online ? { kind: 'online' } : KCMenu.recordResult(G.trainer, e.winner, G.s.crowns[0]);
    if (G.online) endOnline();
    $('#countdown').hidden = true;
    if (e.winner === 0) { banner('Victory!'); setTimeout(() => KCSound.play('win'), 300); if (!G.online && G.trainer.kind === 'trophy') KCEmotes.foeLost(); }
    else if (e.winner === 1) { banner('Defeat'); setTimeout(() => KCSound.play('lose'), 300); if (!G.online) KCEmotes.foeWon(); }
    else banner('Draw');
  }
  function showResult() {
    const s = G.s, r = s.result, w = r.winner;
    const h = $('#resTitle');
    h.textContent = w === 0 ? 'Victory!' : w === 1 ? 'Defeat' : 'Draw';
    h.className = w === 0 ? '' : w === 1 ? 'lose' : 'draw';
    const crowns = n => [0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.25}s"></i>`).join('');
    $('#resFoe').innerHTML = crowns(r.crowns[1]);
    $('#resYou').innerHTML = crowns(r.crowns[0]);
    const L = G.trainer.lines, res = G.res || {};
    const quote = L ? (w === 0 ? pick(L.youWin) : w === 1 ? pick(L.youLose) : L.draw) : '';
    $('#resLine').textContent = ((w === 0 && r.crowns[0] === 3 ? 'Three crowns! ' : '') + quote).trim();
    $('#resLine').hidden = !$('#resLine').textContent;
    const un = $('#resUnlock'), tr = $('#resTrophy');
    const goldNote = res.gold ? `+${res.gold} rubies${res.goldLeft === 0 ? ' (the last paid win today)' : ''}` : '';
    const notes = [goldNote, res.unlockedNext ? `${res.unlockedNext.name} unlocked!` : '', res.roadOpened ? 'Trophy Road unlocked!' : '',
      res.chest ? `${res.chest.name} earned!` : '', res.slotsFull ? 'Chest slots full: open one to make room' : '',
      res.newArena ? `${res.newArena.name} reached!` : '', res.newRewards ? 'Trophy Road reward ready!' : '', res.levelUp ? `Level ${res.levelUp}!` : '',
      res.pass ? `+${res.pass.points} Diamond Pass crown${res.pass.points === 1 ? '' : 's'}${res.pass.tierUp ? ` · tier ${res.pass.tierUp} reached!` : ''}` : ''].filter(Boolean);
    un.hidden = !notes.length;
    un.textContent = notes.join('  ·  ');
    tr.hidden = res.kind !== 'trophy';
    if (res.kind === 'trophy') {
      tr.className = 'res-trophy' + (res.delta > 0 ? ' up' : res.delta < 0 ? ' down' : '');
      tr.innerHTML = `<i class="trophy-i" aria-hidden="true"></i><b>${res.delta > 0 ? '+' : ''}${res.delta}</b><small>${res.trophies} trophies</small>`;
    }
    // a trainer's chest, opened on the spot
    $('#chestNowBtn').hidden = !res.chestNow;
    if (res.chestNow) { $('#chestNowText').textContent = `Open ${res.chestNow.name}`; res.chestShown = false; }
    $('#nextBtn').hidden = !res.unlockedNext;
    $('#nextBtn').className = res.chestNow ? 'pill' : 'big-btn';
    $('#againBtn').className = res.unlockedNext || res.chestNow ? 'pill' : 'big-btn';
    if (res.unlockedNext) $('#nextBtnText').textContent = `Battle ${res.unlockedNext.name}`;
    if (res.kind === 'online') { un.hidden = false; un.textContent = 'Online battle · no trophies won or lost'; }
    $('#againBtn').hidden = res.kind === 'online';
    const why = { left: 'Your opponent left the battle.', desync: 'The battle fell out of step between the two screens, so it stopped.', king: 'King Tower down.', time: 'More crowns when time ran out.', overtime: 'First tower in overtime.', tiebreak: 'Tiebreak: the side whose weakest tower had more health wins.', sudden: w === 0 ? 'Sudden death: their tower crumbled first.' : 'Sudden death: your tower crumbled first.', draw: 'Every tower ended with the same health.', test: 'Simulated win (test button).', surrender: 'You surrendered.' }[r.reason];
    const m = Math.floor(r.time / 60), sec = String(Math.floor(r.time % 60)).padStart(2, '0');
    $('#resSmall').textContent = res.kind === 'online' ? `${why} ${m}:${sec} played, ${s.played[0]} cards from you.` : `${why} ${m}:${sec} played, ${s.played[0]} cards from you, +${res.xp || 0} XP${res.firstWin ? ' (first win bonus)' : ''}.`;
    $('#result').hidden = false;
    setTimeout(() => (res.chestNow ? $('#chestNowBtn') : res.unlockedNext ? $('#nextBtn') : $('#againBtn')).focus(), 50);
  }
  // open the trainer's chest: back to the lobby, where the chest opening plays
  function openChestNow() {
    const res = G.res;
    if (!res || !res.chestNow || res.chestShown) return;
    res.chestShown = true;
    goHome();
    KCMenu.showChest(res.chestNow.chest, res.chestNow, res.chestNow.name);
  }

  /* ---------- drawing ---------- */
  const SX = x => (x + B) * G.k, SY = y => (y + B) * G.k;
  function draw(alpha, t) {
    const s = G.s, k = G.k, c = ctx;
    if (!s) return;
    c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    const sh = G.shake > 0 ? G.shake * k * 0.35 : 0;
    c.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    c.drawImage(G.bg, 0, 0, G.bg.width / G.dpr, G.bg.height / G.dpr);
    if (G.art.fx === 'lava') lava(c, k, t); else water(c, k, t);
    const selId = G.sel >= 0 ? s.hands[0][G.sel] : null;
    if (selId && KC_CARDS[selId].kind !== 'spell' && !KC_CARDS[selId].anywhere) drawZone(c, t);

    const lerp = (e, a) => [e.px + (e.x - e.px) * a, e.py + (e.y - e.py) * a];
    const ground = [], air = [];
    for (const e of s.ents) {
      const [x, y] = e.kind === 'tower' ? [e.x, e.y] : lerp(e, alpha);
      (e.air ? air : ground).push({ e, x, y, z: e.kind === 'tower' ? y + e.half * 0.4 : y });
    }
    ground.sort((a, b) => a.z - b.z);
    air.sort((a, b) => a.z - b.z);
    for (const d of air) shadow(c, SX(d.x), SY(d.y), d.e.radius * k * 1.1);
    for (const d of ground) drawEnt(c, d, t);
    for (const z of s.zones) drawZone2(c, z, k, t);
    for (const p of s.projs) drawProj(c, p, alpha, t);
    for (const d of air) drawEnt(c, d, t);
    drawFx(c, t);
    for (const d of ground.concat(air)) bars(c, d);
    drawPending(c, t);
    if (selId && G.hover) ghost(c, selId, t);
    const W2 = (S.W + 2 * B) * k, H2 = (S.H + 2 * B) * k;
    if (s.phase === 'sudden' && !s.result) {
      // sudden death: a red pulse round the edge of the arena
      const a = 0.35 + 0.2 * Math.sin(t * 9), g = c.createRadialGradient(W2 / 2, H2 / 2, Math.min(W2, H2) * 0.35, W2 / 2, H2 / 2, Math.max(W2, H2) * 0.62);
      g.addColorStop(0, 'rgba(200,20,40,0)'); g.addColorStop(1, `rgba(200,20,40,${a})`);
      c.fillStyle = g; c.fillRect(0, 0, W2, H2);
    }
    if (G.flash > 0) { c.fillStyle = `rgba(255,250,235,${Math.min(0.75, G.flash * 1.6)})`; c.fillRect(0, 0, W2, H2); }
  }
  // Cinder Keep: the lava breathes, heat shimmers above it, embers rise off it and the corner braziers
  // flicker. All light, and cheap: one pass of a few shapes per frame.
  function lava(c, k, t) {
    const f = G.art.field, y0 = SY(S.RIVER_TOP), y1 = SY(S.RIVER_BOT);
    c.save();
    c.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    const g = c.createLinearGradient(0, y0 - k * 0.8, 0, y1 + k * 0.8);
    g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(0.5, `rgba(255,140,40,${0.1 + pulse * 0.1})`); g.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = g; c.fillRect(SX(-B), y0 - k * 0.8, (S.W + 2 * B) * k, y1 - y0 + k * 1.6);
    // slow bright blobs drifting along the river
    for (let i = 0; i < 7; i++) {
      const x = SX(((t * 0.35 + i * 2.9) % (S.W + 4)) - 2), y = SY(15.5 + ((i * 37) % 10) / 10), r = k * (0.6 + 0.3 * Math.sin(t * 2 + i));
      const bg = c.createRadialGradient(x, y, 0, x, y, r);
      bg.addColorStop(0, 'rgba(255,230,120,0.35)'); bg.addColorStop(1, 'rgba(255,160,40,0)');
      c.fillStyle = bg; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // corner braziers (orange fire, or the arena's own colour: Eclipse Throne's are violet)
    const BG = f.brazierGlow || ['255,190,90', '255,120,40'];
    for (const [bx, by] of f.braziers) {
      const x = SX(bx), y = SY(by) - k * 0.4, r = k * (1.9 + Math.sin(t * 13 + bx) * 0.12 + Math.sin(t * 7.1 + by) * 0.1);
      const bg = c.createRadialGradient(x, y, 0, x, y, r);
      bg.addColorStop(0, `rgba(${BG[0]},0.4)`); bg.addColorStop(1, `rgba(${BG[1]},0)`);
      c.fillStyle = bg; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';
    // heat shimmer: faint wavering lines just above the lava
    c.strokeStyle = 'rgba(255,220,170,0.13)'; c.lineWidth = Math.max(1, k * 0.05);
    for (let i = 0; i < 4; i++) {
      const y = y0 - k * (0.3 + i * 0.35) - ((t * 6 + i * 9) % 10) * 0.02 * k;
      c.beginPath();
      for (let x = 0; x <= S.W + 2 * B; x += 0.5) {
        const yy = y + Math.sin(x * 1.3 + t * 3 + i) * k * 0.06;
        if (x === 0) c.moveTo(x * k, yy); else c.lineTo(x * k, yy);
      }
      c.stroke();
    }
    c.restore();
    // the bridges go back on top, so the glow and shimmer stay on the lava
    for (const [bx0, by0, bx1, by1] of f.bridges) {
      const x0 = SX(bx0), y = SY(by0), w = (bx1 - bx0) * k, h = (by1 - by0) * k;
      c.drawImage(G.bg, x0 * G.dpr, y * G.dpr, w * G.dpr, h * G.dpr, x0, y, w, h);
    }
    // embers rising off the lava (and a few off the braziers)
    const E = G.embers;
    if (E.length < 34 && Math.random() < 0.5) {
      const fromBrazier = Math.random() < 0.25, br = f.braziers[Math.floor(Math.random() * 4)];
      E.push(fromBrazier
        ? { x: br[0] + (Math.random() - 0.5) * 0.5, y: br[1] - 0.6, vy: -1.4 - Math.random(), life: 1.6, max: 1.6, ph: Math.random() * 6, col: f.brazierEmber }
        : { x: Math.random() * S.W, y: 15.2 + Math.random() * 1.6, vy: -0.6 - Math.random() * 0.8, life: 2.5 + Math.random() * 2, max: 4.5, ph: Math.random() * 6 });
    }
    for (const e of E) {
      e.life -= 1 / 60; e.y += e.vy / 60; e.x += Math.sin(t * 2 + e.ph) * 0.006;
      c.globalAlpha = Math.max(0, Math.min(1, e.life / e.max * 2)) * (0.55 + 0.45 * Math.sin(t * 10 + e.ph));
      c.fillStyle = e.col || '#ffb347';
      c.fillRect(SX(e.x), SY(e.y), Math.max(1.5, k * 0.08), Math.max(1.5, k * 0.08));
    }
    c.globalAlpha = 1;
    G.embers = E.filter(e => e.life > 0);
  }
  function water(c, k, t) {
    c.save();
    c.beginPath(); c.rect(SX(0), SY(S.RIVER_TOP + 0.22), S.W * k, (2 - 0.44) * k); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = k * 0.06; c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const y = S.RIVER_TOP + 0.45 + (i % 3) * 0.5, x = ((t * 0.9 + i * 1.7) % (S.W + 2)) - 1;
      c.beginPath(); c.moveTo(SX(x), SY(y)); c.quadraticCurveTo(SX(x + 0.3), SY(y - 0.12), SX(x + 0.6), SY(y)); c.stroke();
    }
    c.restore();
    // the bridges go back on top of the ripples: an illustrated arena lists its bridge decks
    const f = G.art.field && KCArenas.ready(KCArenas.image(G.art.field.src)) ? G.art.field : null;
    const decks = f && f.bridges ? f.bridges : S.BRIDGES.map(b => [b - 1.1, S.RIVER_TOP - 0.35, b + 1.1, S.RIVER_BOT + 0.35]);
    for (const [bx0, by0, bx1, by1] of decks) {
      const x0 = SX(bx0), y0 = SY(by0), w = (bx1 - bx0) * k, h = (by1 - by0) * k;
      c.drawImage(G.bg, x0 * G.dpr, y0 * G.dpr, w * G.dpr, h * G.dpr, x0, y0, w, h);
    }
    // Briar Hollow: the wall lanterns flicker
    if (f && f.lanterns) {
      c.save(); c.globalCompositeOperation = 'lighter';
      f.lanterns.forEach(([lx, ly], i) => {
        const fl = 0.75 + 0.15 * Math.sin(t * 7.3 + i * 2.1) + 0.1 * Math.sin(t * 13.1 + i), r = k * 1.5 * fl;
        const g = c.createRadialGradient(SX(lx), SY(ly), 0, SX(lx), SY(ly), r);
        g.addColorStop(0, `rgba(255,210,120,${0.42 * fl})`); g.addColorStop(1, 'rgba(255,160,60,0)');
        c.fillStyle = g; c.beginPath(); c.arc(SX(lx), SY(ly), r, 0, Math.PI * 2); c.fill();
      });
      c.restore();
    }
  }
  // The area you can't place troops on, drawn while a troop or building card is picked up: a strong red
  // tint with a faint grid, outlined in bright red. Cached until a tower falls (which opens more ground).
  function drawZone(c, t) {
    const s = G.s, key = s.ents.filter(e => e.kind === 'tower' && e.dead).map(e => e.id).join(), k = G.k;
    if (key !== G.zoneKey || !G.zone) {
      G.zoneKey = key;
      const z = document.createElement('canvas');
      z.width = G.bg.width; z.height = G.bg.height;
      const zc = z.getContext('2d');
      zc.scale(G.dpr, G.dpr);
      const red = [];
      for (let y = 0; y < S.H; y++) { red[y] = []; for (let x = 0; x < S.W; x++) red[y][x] = !(S.canDeploy(s, 0, 'gladiator', x + 0.5, y + 0.5) || y >= S.RIVER_BOT); }
      // the river is never red on a lane whose tower is down (the water stays closed, but a card
      // dropped there lands on the nearer bank, and the bridge is open); elsewhere it is red with the
      // ground beyond it
      for (let y = S.RIVER_TOP; y < S.RIVER_BOT; y++) for (let x = 0; x < S.W; x++) red[y][x] = red[S.RIVER_TOP - 1][x];
      const isRed = (x, y) => x >= 0 && y >= 0 && x < S.W && y < S.H && red[y][x];
      zc.fillStyle = 'rgba(255,70,95,0.55)';
      for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (red[y][x]) zc.fillRect(SX(x), SY(y), k + 0.5, k + 0.5);
      // the faint grid
      zc.strokeStyle = 'rgba(255,225,230,0.35)'; zc.lineWidth = Math.max(1, k * 0.045);
      zc.beginPath();
      for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
        if (!red[y][x]) continue;
        if (isRed(x + 1, y)) { zc.moveTo(SX(x + 1), SY(y)); zc.lineTo(SX(x + 1), SY(y + 1)); }
        if (isRed(x, y + 1)) { zc.moveTo(SX(x), SY(y + 1)); zc.lineTo(SX(x + 1), SY(y + 1)); }
      }
      zc.stroke();
      // the outline: every edge between a red tile and a tile you can use (or the arena's edge)
      const edges = new Path2D();
      for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
        if (!red[y][x]) continue;
        if (!isRed(x, y - 1)) { edges.moveTo(SX(x), SY(y)); edges.lineTo(SX(x + 1), SY(y)); }
        if (!isRed(x, y + 1)) { edges.moveTo(SX(x), SY(y + 1)); edges.lineTo(SX(x + 1), SY(y + 1)); }
        if (!isRed(x - 1, y)) { edges.moveTo(SX(x), SY(y)); edges.lineTo(SX(x), SY(y + 1)); }
        if (!isRed(x + 1, y)) { edges.moveTo(SX(x + 1), SY(y)); edges.lineTo(SX(x + 1), SY(y + 1)); }
      }
      zc.lineCap = 'square'; zc.lineJoin = 'miter';
      zc.strokeStyle = 'rgba(70,0,12,0.65)'; zc.lineWidth = k * 0.34; zc.stroke(edges);
      zc.strokeStyle = '#ff2b45'; zc.lineWidth = k * 0.2; zc.stroke(edges);
      zc.strokeStyle = 'rgba(255,215,220,0.95)'; zc.lineWidth = k * 0.05; zc.stroke(edges);
      G.zone = z;
    }
    c.globalAlpha = 0.9 + 0.1 * Math.sin((t || 0) * 5);
    c.drawImage(G.zone, 0, 0, G.zone.width / G.dpr, G.zone.height / G.dpr);
    c.globalAlpha = 1;
  }
  // Overclock: a ring of orange energy under a sped-up troop or building
  function raged(c, e, x, y, k, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    A.ell(c, x, y, (e.radius + 0.2) * k, (e.radius + 0.2) * k * 0.42);
    c.strokeStyle = `rgba(255,170,60,${0.55 + 0.25 * Math.sin(t * 10)})`; c.lineWidth = k * 0.1; c.stroke();
    c.restore();
  }
  // Briar Bind: thorny vines wrapped round a held enemy
  function vines(c, e, x, y, k, t) {
    const r = e.radius * k * 1.05;
    for (let i = 0; i < 3; i++) {
      const h = k * (0.25 + i * 0.35);
      A.ell(c, x, y - h, r * (1 - i * 0.12), r * 0.32);
      c.strokeStyle = A.OUT; c.lineWidth = k * 0.13; c.stroke(); c.strokeStyle = i % 2 ? '#7aaa3a' : '#5a8a2a'; c.lineWidth = k * 0.08; c.stroke();
    }
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + e.id; A.poly(c, [x + Math.cos(a) * r, y - k * 0.4, x + Math.cos(a) * r * 1.25, y - k * 0.5, x + Math.cos(a) * r, y - k * 0.55]); c.fillStyle = '#c4d88a'; c.fill(); }
  }
  // a soft shadow under a troop: dark in the middle, fading out at the edge
  function shadow(c, x, y, r) {
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r * 1.1));
    g.addColorStop(0, 'rgba(0,0,0,0.34)'); g.addColorStop(0.65, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save(); c.translate(x, y); c.scale(1, 0.42); c.translate(-x, -y);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, Math.max(1, r * 1.1), 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // A damaged tower: cracks from half health, smoke below a quarter; in sudden death every tower
  // crumbles, with pebbles falling off it.
  function towerWear(c, e, k, t) {
    const hurt = 1 - e.hp / e.maxHp, h = e.sub === 'king' ? 2.4 : 2.0, w = e.half * 0.8;
    if (hurt > 0.45) {
      c.strokeStyle = 'rgba(30,18,40,0.75)'; c.lineWidth = Math.max(1.2, k * 0.07); c.lineCap = 'round';
      const n = hurt > 0.75 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const sx = ((i * 0.37 + e.id * 0.13) % 1 - 0.5) * w * 1.6, sy = -h * (0.35 + 0.15 * (i % 3));
        c.beginPath(); c.moveTo(sx * k, sy * k);
        c.lineTo((sx + 0.18) * k, (sy + 0.22) * k); c.lineTo((sx + 0.05) * k, (sy + 0.42) * k); c.lineTo((sx + 0.24) * k, (sy + 0.62) * k);
        c.stroke();
      }
    }
    const sudden = G.s && G.s.phase === 'sudden';
    if ((hurt > 0.75 && Math.random() < 0.06) || (sudden && Math.random() < 0.35)) {
      G.fx.push({ kind: 'puff', x: e.x + (Math.random() - 0.5) * w, y: e.y - h * 0.7, vx: 0, vy: -0.8, r: 0.25, col: sudden ? 'rgba(200,180,190,0.7)' : 'rgba(70,64,80,0.55)', life: 0.9, max: 0.9 });
      if (sudden) G.fx.push({ kind: 'rock', x: e.x + (Math.random() - 0.5) * w * 2, y: e.y, vx: (Math.random() - 0.5) * 1.5, vy: 0.3, z: h * 3, vz: 0, r: 0.07 + Math.random() * 0.08, life: 0.8, max: 0.8, col: '#b8b2a8' });
    }
  }
  // A hit flash: the sprite drawn a second time on top, added to itself, so it brightens for a moment.
  // (A canvas filter did this before, but filters are slow: every dropped frame landed on a hit.)
  function lit(c, flash, f, alpha) {
    f();
    if (flash > 0) {
      const a = c.globalAlpha, op = c.globalCompositeOperation;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * (alpha || 0.5) * Math.min(1, flash / 0.08);
      f();
      c.globalCompositeOperation = op; c.globalAlpha = a;
    }
  }
  function drawEnt(c, d, t) {
    const e = d.e, k = G.k, x = SX(d.x), y = SY(d.y);
    if (e.kind === 'tower') {
      const target = e.target && G.s.ents.find(u => u.id === e.target);
      const face = target ? (target.x >= e.x ? 1 : -1) : (e.team === 0 ? 1 : -1);
      c.save(); c.translate(x, y);
      const o = { team: e.team, face, active: e.active, t, view: e.team === 0 ? 'back' : 'front', atk: Math.max(0, e.cd / e.hit - 0.6) * 2.5, hurt: 1 - e.hp / e.maxHp };
      const draw = () => (e.sub === 'king' ? A.kingTower : A.archerTower)(c, k, o);
      const fall = G.falls[e.id];
      if (e.dead && fall !== undefined && fall < 0.9) {
        // collapsing: the tower shakes and sinks into its own dust, the rubble rising in its place
        const p = fall / 0.9;
        c.globalAlpha = Math.min(1, p * 1.6); A.rubble(c, k, { team: e.team, sub: e.sub }); c.globalAlpha = 1;
        c.save(); c.beginPath(); c.rect(-k * 4, -k * 8, k * 8, k * 8 + e.half * k * 0.5); c.clip();
        c.translate(Math.sin(fall * 70) * k * 0.12 * (1 - p), p * p * k * 3.4); c.rotate((e.x < 9 ? -1 : 1) * p * 0.12);
        c.globalAlpha = 1 - p * 0.5; draw();
        c.restore();
        if (Math.random() < 0.7) puff(e.x + (Math.random() - 0.5) * e.half * 2, e.y + 0.2, 1, 'rgba(210,200,225,0.8)', 0.4);
      } else if (e.dead) A.rubble(c, k, { team: e.team, sub: e.sub });
      else {
        lit(c, e.flash, draw, 0.35);
        towerWear(c, e, k, t);
      }
      c.restore();
      return;
    }
    if (e.kind === 'building' && e.tunnel) { tunnel(c, e, x, y, t); return; }
    if (e.kind === 'building') {
      c.save(); c.translate(x, y);
      if (e.deploy > 0) { const sc = Math.max(0.3, 1 - Math.max(0, e.deploy - 0.6) * 2); c.globalAlpha = 0.7; c.scale(sc, sc); }
      const bo = { team: e.team, angle: Math.atan2(e.aimY, e.aimX), atk: Math.max(0, e.atk / 0.25 + (e.beamOn ? 0.6 : 0)), hidden: e.hidden, rise: e.rise, t: t + e.id * 0.37 };
      lit(c, e.flash, () => A.building(c, e.card, k, bo), 0.45);
      c.restore();
      if (e.beam && e.beamOn) {
        const tg = G.s.ents.find(u => u.id === e.beamOn);
        if (tg && !tg.dead) {
          const stage = Math.min(e.beam.length - 1, Math.floor(e.beamTime / e.beamStage));
          if (stage !== G.beamStage[e.id]) { G.beamStage[e.id] = stage; if (stage) KCSound.play('beamUp'); }
          beamTo(c, x, y - k * 2.0, SX(tg.x), SY(tg.y) - liftOf(tg) * k - k * 0.4, stage, t, e.team);
        }
      } else if (e.beam) G.beamStage[e.id] = -1;
      if (e.rageEnd > G.s.time) raged(c, e, x, y, k, t);
      frozen(c, e, x, y, k * 1.1, t);
      return;
    }
    if (e.tunnel) { tunnel(c, e, x, y, t); return; }
    if (e.card === 'mole' && e.deploy > 0) { surfacing(c, e, x, y, t); return; }
    // the Dread Knight mid-leap rises in an arc; a troop on the end of a harpoon rope is off the ground
    const leapF = e.leap ? Math.min(1, e.leap.t / e.leap.dur) : 0;
    const cheer = G.phase === 'end' && G.s.result && G.s.result.winner === e.team ? Math.abs(Math.sin(t * 7 + e.id)) * 0.35 : 0;
    const lift = (liftOf(e) + (e.leap ? Math.sin(leapF * Math.PI) * 2.2 : 0) + (e.pulled ? 0.35 : 0) + cheer) * k;
    if (!e.air) shadow(c, x, y, e.radius * k * 1.05);
    ropes(c, e, x, y - lift);
    // the Griffin's beam: a crackling line of storm light to its target, thicker as it powers up
    if (e.beam && e.beamOn) {
      const tg = G.s.ents.find(u => u.id === e.beamOn);
      if (tg && !tg.dead) {
        const stage = Math.min(e.beam.length - 1, Math.floor(e.beamTime / e.beamStage));
        if (stage !== G.beamStage[e.id]) { G.beamStage[e.id] = stage; if (stage) KCSound.play('beamUp'); }
        beamTo(c, x, y - lift + k * 0.2, SX(tg.x), SY(tg.y) - liftOf(tg) * k - k * 0.4, stage, t, e.team);
      }
    } else if (e.beam) G.beamStage[e.id] = -1;
    A.ell(c, x, y, e.radius * k * 1.0, e.radius * k * 0.42);
    c.strokeStyle = e.team === 0 ? 'rgba(80,160,255,0.85)' : 'rgba(255,90,100,0.85)'; c.lineWidth = k * 0.07; c.stroke();
    c.save();
    c.translate(x, y - lift);
    let sc = 1;
    if (e.deploy > 0) { sc = 1 - Math.max(0, e.deploy - 0.75) * 2; c.globalAlpha = 0.65; }
    if (sc < 1) c.scale(Math.max(0.2, sc), Math.max(0.2, sc));
    // a Prism Echo copy: a shimmering, see-through crystal double (a cyan glow behind it, the troop drawn
    // faint, then added over itself so it shines)
    if (e.clone) {
      const g = c.createRadialGradient(0, -k * 0.6, 0, 0, -k * 0.6, k * 1.1);
      g.addColorStop(0, 'rgba(150,240,255,0.45)'); g.addColorStop(1, 'rgba(150,240,255,0)');
      c.fillStyle = g; c.fillRect(-k * 1.1, -k * 1.7, k * 2.2, k * 2.2);
      c.globalAlpha *= 0.55;
    }
    const o = { team: e.team, t: t + e.id * 0.37, walk: e.moving, atk: Math.max(0, e.atk / 0.28), face: e.face, id: e.id, view: facingOf(e), evo: e.evo };
    if (e.ram) o.power = Math.max(0, Math.min(1, (e.speed - e.baseSpeed) / (e.maxSpeed - e.baseSpeed)));
    if (e.rider) o.ratk = Math.max(0, e.rider.atk / 0.4);
    if (e.chargeHit) o.charged = e.run >= e.chargeHit;
    if (e.maxShield) o.shield = e.shield > 0 ? 1 : 0;
    if (e.chargeT !== undefined) o.charge = e.chargeT / KC_CARDS[e.card].charge;
    if (e.hookT) o.hook = 1;
    if (e.hatch !== undefined) o.hatch = 1 - e.hatch / KC_CARDS.phoenix.egg.hatch;
    if (e.beam) o.beam = e.beamOn ? 1 + Math.min(2, Math.floor(e.beamTime / e.beamStage)) : 0;
    if (e.rageEnd > G.s.time) raged(c, e, 0, lift, k, t);
    lit(c, e.clone ? Math.max(e.flash, 0.08) : e.flash, () => A.troop(c, e.card, k, o), e.clone ? 0.6 : 0.6);
    c.restore();
    frozen(c, e, x, y - lift, e.radius * k * 1.25, t);
    if (e.boundEnd > G.s.time) vines(c, e, x, y, k, t);
    if (e.curse && e.curse.card && e.curse.end > G.s.time) {
      for (let i = 0; i < 3; i++) { const a = t * 2.5 + i * 2.1 + e.id; A.circ(c, x + Math.cos(a) * e.radius * k, y - lift - k * (0.6 + 0.3 * Math.sin(a * 1.3)), k * 0.06); c.fillStyle = 'rgba(140,255,140,0.85)'; c.fill(); }
    }
    // dust behind a rolling cart and a galloping camel
    if (e.moving && e.deploy <= 0 && (e.ram || e.chargeHit) && Math.random() < (e.ram ? 0.25 + o.power * 0.5 : 0.4)) {
      const back = e.team === 0 ? 0.6 : -0.6;
      G.fx.push({ kind: 'puff', x: e.x + (Math.random() - 0.5) * 0.9, y: e.y + back * 0.5, vx: (Math.random() - 0.5) * 0.6, vy: back * 0.8, r: 0.16 + Math.random() * 0.2, col: 'rgba(226,196,138,0.75)', life: 0.5, max: 0.5 });
    }
    // a slowed troop: sand swirling round it, or the lasso round its legs
    if (e.slowEnd > G.s.time) {
      if (e.slowKind === 'frost') {
        for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1 + e.id; A.circ(c, x + Math.cos(a) * e.radius * k, y - lift - k * 0.4 + Math.sin(a) * k * 0.2, k * 0.06); c.fillStyle = 'rgba(200,240,255,0.95)'; c.fill(); }
      } else if (e.slowKind === 'lasso') {
        A.ell(c, x, y - k * 0.2, e.radius * k * 0.9, e.radius * k * 0.35);
        c.strokeStyle = A.OUT; c.lineWidth = k * 0.12; c.stroke(); c.strokeStyle = '#c8a070'; c.lineWidth = k * 0.07; c.stroke();
      } else {
        for (let i = 0; i < 4; i++) {
          const a = t * 5 + i * 1.57 + e.id;
          A.circ(c, x + Math.cos(a) * e.radius * k * 1.1, y - lift - k * 0.5 + Math.sin(a) * k * 0.25, k * 0.06); c.fillStyle = 'rgba(214,170,96,0.9)'; c.fill();
        }
      }
    }
    if (e.deploy > 0) {
      const p = 1 - e.deploy / 1.0, r = k * 0.32, cy = y - lift - k * 1.6;
      A.circ(c, x, cy, r); c.fillStyle = 'rgba(20,12,40,0.7)'; c.fill();
      c.beginPath(); c.moveTo(x, cy); c.arc(x, cy, r * 0.8, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); c.closePath();
      c.fillStyle = e.team === 0 ? '#8cc4ff' : '#ff9ea4'; c.fill();
    }
  }
  // Which way a troop faces: away from you (its back) while it heads up the arena, toward you (its front)
  // while it heads down, so a troop that turns round to chase something coming at your towers turns to
  // face it. Moving, it faces the way it walks; standing, the way its target is. Small sideways moves
  // keep the last facing, so it doesn't flicker.
  function facingOf(e) {
    const mem = G.views || (G.views = {});
    let v = mem[e.id] || (e.team === 0 ? 'back' : 'front');
    let dy = e.moving ? e.y - e.py : 0;
    if (Math.abs(dy) < 0.004) {
      const t = e.target && G.s.ents.find(u => u.id === e.target);
      dy = t ? (Math.abs(t.y - e.y) > 0.35 ? (t.y - e.y) * 0.01 : 0) : 0;
    }
    if (dy > 0.004) v = 'front'; else if (dy < -0.004) v = 'back';
    mem[e.id] = v;
    return v;
  }
  // Frozen: a block of ice around it; stunned: crackling sparks over it.
  function frozen(c, e, x, y, r, t) {
    if (!(e.stunEnd > G.s.time)) return;
    if (e.stunKind === 'freeze') {
      c.save(); c.globalAlpha = 0.55;
      A.rr(c, x - r, y - r * 1.7, r * 2, r * 1.9, r * 0.3); c.fillStyle = 'rgba(190,235,255,0.6)'; c.fill();
      c.lineWidth = Math.max(1.5, G.k * 0.06); c.strokeStyle = 'rgba(240,252,255,0.95)'; c.stroke();
      A.line(c, x - r * 0.6, y - r * 1.4, x - r * 0.2, y - r * 1.0, 'rgba(255,255,255,0.9)', Math.max(1, G.k * 0.05));
      c.restore();
    } else for (let i = 0; i < 3; i++) {
      const a = t * 20 + i * 2.1 + e.id, x0 = x + Math.cos(a) * r * 0.6, y0 = y - r * 1.3 + Math.sin(a * 1.3) * r * 0.3;
      A.line(c, x0, y0, x0 + r * 0.25, y0 - r * 0.2, '#bff4ff', Math.max(1, G.k * 0.05));
    }
  }
  // The Harpoon Captain's rope: to a troop he is reeling in, or to the building he is pulling himself to.
  function ropes(c, e, x, y) {
    const k = G.k, by = e.pulled ? G.s.ents.find(u => u.id === e.pulled.by) : e.reel ? G.s.ents.find(u => u.id === e.reel.to) : null;
    if (!by) return;
    const bx = SX(by.x), byy = SY(by.y) - (by.kind === 'troop' ? k * 1.1 : k * 0.8);
    c.beginPath(); c.moveTo(bx, byy); c.lineTo(x, y - k * 0.5);
    c.strokeStyle = A.OUT; c.lineWidth = k * 0.1; c.stroke(); c.strokeStyle = '#d8b880'; c.lineWidth = k * 0.06; c.stroke();
  }
  // A storm beam from (x0, y0) to (x1, y1): jagged, flickering, brighter and thicker each stage.
  function beamTo(c, x0, y0, x1, y1, stage, t, team) {
    const k = G.k, n = 8, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const pts = [[x0, y0]];
    for (let i = 1; i < n; i++) { const j = Math.sin(t * 40 + i * 2.3) * k * (0.1 + stage * 0.04); pts.push([x0 + dx * i / n + nx * j, y0 + dy * i / n + ny * j]); }
    pts.push([x1, y1]);
    const path = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const [px, py] of pts.slice(1)) c.lineTo(px, py); };
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.globalCompositeOperation = 'lighter';
    path(); c.strokeStyle = team === 0 ? 'rgba(90,170,255,0.45)' : 'rgba(255,110,140,0.45)'; c.lineWidth = k * (0.32 + stage * 0.18); c.stroke();
    path(); c.strokeStyle = 'rgba(170,240,255,0.95)'; c.lineWidth = k * (0.1 + stage * 0.06); c.stroke();
    path(); c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, k * 0.04); c.stroke();
    A.circ(c, x1, y1, k * (0.25 + stage * 0.12)); c.fillStyle = 'rgba(200,245,255,0.7)'; c.fill();
    c.restore();
  }
  // The Mole underground: a mound of earth moving along, leaving a trail of dirt.
  function tunnel(c, e, x, y, t) {
    const k = G.k, wob = Math.sin(t * 18 + e.id) * k * 0.04;
    A.ell(c, x, y, k * 0.55, k * 0.24); c.fillStyle = 'rgba(0,0,0,0.22)'; c.fill();
    A.ell(c, x, y - k * 0.12 + wob, k * 0.45, k * 0.24); A.paint(c, '#8a6440', k * 0.06);
    for (let i = 0; i < 4; i++) { A.circ(c, x + (i - 1.5) * k * 0.2, y - k * 0.22 + Math.sin(t * 20 + i) * k * 0.05, k * 0.09); c.fillStyle = i % 2 ? '#a07850' : '#6e4e32'; c.fill(); }
    if (Math.random() < 0.7) G.fx.push({ kind: 'puff', x: e.x + (Math.random() - 0.5) * 0.5, y: e.y + (Math.random() - 0.5) * 0.3, vx: 0, vy: 0, r: 0.14 + Math.random() * 0.14, col: 'rgba(138,100,64,0.7)', life: 0.9, max: 0.9 });
  }
  // The Mole bursting out: a hole, a ring of earth, and the Mole climbing up out of it.
  function surfacing(c, e, x, y, t) {
    const k = G.k, p = 1 - e.deploy / KC_CARDS.mole.burrow.surface;
    A.ell(c, x, y, k * 0.62, k * 0.26); c.fillStyle = '#3a2716'; c.fill();
    c.save(); c.beginPath(); c.rect(x - k * 2, y - k * 3, k * 4, k * 3 + k * 0.05); c.clip();
    c.translate(x, y + (1 - Math.min(1, p * 1.4)) * k * 1.3);
    A.troop(c, 'mole', k, { team: e.team, t, walk: false, atk: 0, face: e.face, id: e.id, view: e.team === 0 ? 'back' : 'front' });
    c.restore();
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; A.circ(c, x + Math.cos(a) * k * 0.6, y + Math.sin(a) * k * 0.26, k * 0.12); c.fillStyle = i % 2 ? '#a07850' : '#7a5636'; c.fill(); }
  }
  function bars(c, d) {
    const e = d.e, k = G.k;
    if (e.dead || e.tunnel) return;
    const x = SX(d.x), y = SY(d.y), blue = e.team === 0, T = A.TEAM[e.team];
    if (e.kind === 'tower') {
      const king = e.sub === 'king', w = (king ? 3.0 : 2.4) * k, h = Math.max(10, k * 0.5);
      // Your bars sit under your towers; the enemy's sit above theirs, the King's beside its crown.
      const by = blue ? y + (king ? 1.62 : 1.26) * k : y - (king ? 3.05 : 3.12) * k;
      const bx = (!blue && king ? x + 2.65 * k : x) - w / 2 + h * 0.6;
      A.rr(c, bx, by, w, h, h / 2); c.fillStyle = '#1b1430'; c.fill();
      A.rr(c, bx + 2, by + 2, Math.max(0, (w - 4) * e.hp / e.maxHp), h - 4, (h - 4) / 2); c.fillStyle = T.main; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(bx + h / 2, by + 3, Math.max(0, (w - h) * e.hp / e.maxHp), Math.max(1, h * 0.15));
      levelBadge(c, bx - h * 0.25, by + h / 2, h * 0.75, e.team, G.s.levels[e.team]);
      c.font = `${Math.round(h * 0.82)}px "Lilita One", "Arial Black", sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = Math.max(2, h * 0.2); c.strokeStyle = A.OUT; c.strokeText(String(Math.ceil(e.hp)), bx + w / 2, by + h / 2 + 1);
      c.fillStyle = '#fff'; c.fillText(String(Math.ceil(e.hp)), bx + w / 2, by + h / 2 + 1);
      return;
    }
    if (e.kind === 'building') {
      if (e.deploy > 0) return;
      const w = 1.7 * k, h = Math.max(6, k * 0.24), by = y - 1.05 * k, bx = x - w / 2;
      A.rr(c, bx, by, w, h, h / 2); c.fillStyle = '#1b1430'; c.fill();
      A.rr(c, bx + 1, by + 1, Math.max(0, (w - 2) * e.hp / e.maxHp), h - 2, (h - 2) / 2); c.fillStyle = blue ? '#5aa9ff' : '#ff5f69'; c.fill();
      levelBadge(c, bx - h * 0.6, by + h / 2, h * 0.95, e.team, e.level);
      return;
    }
    const shieldHit = e.maxShield && e.shield < e.maxShield;
    if ((e.hp >= e.maxHp && !shieldHit) || e.deploy > 0) return;
    const lift = liftOf(e) * k, top = { rhino: 1.45, gorilla: 1.75, gladiator: 1.95, snowman: e.evo ? 2.35 : 2.0, archers: 1.55, wolves: 1.05, hawks: 0.75, skeletons: 1.2, footmen: 1.6, flail: 1.95, pots: 1.6, ramcart: 1.95, ramsoldier: 1.45, mole: 1.45, camel: 2.45, bees: 0.55, owl: 1.15, thundercloud: 0.85, griffin: 1.2,
      frostsprite: 1.0, icegiant: 1.4, wintersage: 1.85, raider: 1.15, raidergun: 1.15, harpoon: 1.85, broadside: 1.3, sparkbots: 1.2, titan: 2.2, titanling: 1.4, arccannon: 1.75, shardguards: 1.5, imp: 1.0,
      prism: 1.7, sunsprite: 1.0, guardian: 1.85, drake: 0.95, phoenix: 1.0, phoenixegg: 1.0, wraiths: 1.4, wraith: 1.4, dreadknight: 2.3,
      thornling: 1.05, scarab: 0.8, frostbrute: 1.95, buccaneer: 1.6, sentinel: 1.75, emberling: 0.95, smelter: 2.15 }[e.card] || 1.4;
    const w = Math.max(0.8, e.radius * 1.9) * k, h = Math.max(5, k * 0.2), by = y - lift - top * k, bx = x - w / 2;
    A.rr(c, bx, by, w, h, h / 2); c.fillStyle = '#1b1430'; c.fill();
    A.rr(c, bx + 1, by + 1, Math.max(0, (w - 2) * e.hp / e.maxHp), h - 2, (h - 2) / 2); c.fillStyle = blue ? '#5aa9ff' : '#ff5f69'; c.fill();
    if (e.maxShield && e.shield > 0) {
      // a shield: a white bar over the health bar, emptying as the shield takes damage
      A.rr(c, bx, by - h - 1, w, h, h / 2); c.fillStyle = '#1b1430'; c.fill();
      A.rr(c, bx + 1, by - h, Math.max(0, (w - 2) * e.shield / e.maxShield), h - 2, (h - 2) / 2); c.fillStyle = '#e8edf5'; c.fill();
    }
    levelBadge(c, bx - h * 0.6, by + h / 2, h * 0.95, e.team, e.level);
  }
  function levelBadge(c, x, y, r, team, level) {
    A.rr(c, x - r, y - r, r * 2, r * 2, r * 0.45); c.fillStyle = team === 0 ? '#1a4ba8' : '#9e1f29'; c.fill();
    c.lineWidth = Math.max(1.5, r * 0.22); c.strokeStyle = A.OUT; c.stroke();
    c.font = `${Math.round(r * 1.5)}px "Lilita One", "Arial Black", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
    c.fillText(String(level || 1), x, y + 1);
  }
  // Broken pottery on the ground: shards fading out as the damage ends.
  function drawZone2(c, z, k, t) {
    if (z.kind === 'sandstorm') { storm(c, z, k, t); return; }
    if (NEWZ[z.kind]) { NEWZ[z.kind](c, z, k, t); return; }
    if (z.kind === 'gate') {
      // the Abyss Gate: a dark swirling portal over the circle it lets wraiths out of
      const x = SX(z.x), y = SY(z.y), fade = Math.min(1, z.left / 0.6, (z.dur - z.left) / 0.4 + 0.2);
      c.save(); c.globalAlpha = 0.85 * fade;
      A.ell(c, x, y, z.r * k, z.r * k * 0.6); c.fillStyle = 'rgba(40,10,60,0.35)'; c.fill();
      c.strokeStyle = 'rgba(190,120,255,0.8)'; c.lineWidth = Math.max(2, k * 0.08); c.setLineDash([k * 0.4, k * 0.3]); c.lineDashOffset = -t * k * 2; c.stroke(); c.setLineDash([]);
      c.translate(x, y - k * 1.6); A.portalArt(c, k * 1.4, t * 2, z.team);
      c.restore();
      return;
    }
    if (z.kind === 'heal') {
      const x = SX(z.x), y = SY(z.y), a = Math.max(0, z.left / z.dur);
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 * a;
      const g = c.createRadialGradient(x, y, 0, x, y, z.r * k);
      g.addColorStop(0, 'rgba(255,230,140,0.7)'); g.addColorStop(1, 'rgba(255,200,80,0)');
      c.fillStyle = g; A.ell(c, x, y, z.r * k, z.r * k * 0.6); c.fill();
      c.restore();
      if (Math.random() < 0.6) G.fx.push({ kind: 'dot', x: z.x + (Math.random() - 0.5) * z.r * 1.4, y: z.y + (Math.random() - 0.5) * z.r * 0.8, vx: 0, vy: -1.2, r: 0.08, col: 'rgba(255,240,170,0.95)', life: 0.6, max: 0.6 });
      return;
    }
    const a = Math.max(0, z.left / z.dur), x = SX(z.x), y = SY(z.y);
    c.globalAlpha = 0.35 * a;
    A.ell(c, x, y, z.r * k, z.r * k * 0.55); c.fillStyle = '#7a3e1e'; c.fill();
    c.globalAlpha = Math.min(1, a * 1.5);
    for (let i = 0; i < 7; i++) {
      const ang = i * 0.9 + z.x * 3, d = (0.25 + (i % 3) * 0.22) * z.r;
      const sx = x + Math.cos(ang) * d * k, sy = y + Math.sin(ang) * d * k * 0.55;
      c.save(); c.translate(sx, sy); c.rotate(ang);
      A.poly(c, [-k * 0.1, 0, 0, -k * 0.07, k * 0.11, k * 0.02, k * 0.02, k * 0.06]); A.paint(c, i % 2 ? '#d07a45' : '#a8582c', k * 0.03);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  // The expansion's lingering spells on the field.
  const fadeOf = z => Math.max(0, Math.min(1, (z.dur - z.left) / 0.3 + 0.15, z.left / 0.4));
  const disc = (c, z, k, fill, stroke, dash, t) => {
    A.ell(c, SX(z.x), SY(z.y), z.r * k, z.r * k * 0.6); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = Math.max(2, k * 0.08); if (dash) { c.setLineDash([k * 0.4, k * 0.3]); c.lineDashOffset = -t * k * 2; } c.stroke(); c.setLineDash([]); }
  };
  const NEWZ = {
    magmaquake(c, z, k, t) {
      c.save(); c.globalAlpha = 0.9 * fadeOf(z);
      disc(c, z, k, 'rgba(70,40,40,0.35)', 'rgba(255,140,60,0.8)', true, t);
      c.translate(SX(z.x), SY(z.y)); c.scale(1, 0.6); A.setLw(Math.max(1, k * 0.06)); KCArt5.quakeArt(c, z.r * k * 0.75, t);
      c.restore();
    },
    ashfall(c, z, k, t) {
      c.save(); c.globalAlpha = 0.85 * fadeOf(z);
      disc(c, z, k, 'rgba(90,70,70,0.3)', 'rgba(255,150,80,0.6)', true, t);
      c.translate(SX(z.x), SY(z.y) - k * 2.4); A.setLw(Math.max(1, k * 0.06)); KCArt5.ashArt(c, z.r * k * 0.8, t);
      c.restore();
      if (Math.random() < 0.7) G.fx.push({ kind: 'dot', x: z.x + (Math.random() - 0.5) * z.r * 1.6, y: z.y - 1.8 + Math.random() * 0.4, vx: 0, vy: 2.2, r: 0.07, col: Math.random() < 0.4 ? '#ff8a2a' : '#8a7e7e', life: 0.8, max: 0.8 });
    },
    cyclone(c, z, k, t) {
      c.save(); c.globalAlpha = 0.9 * fadeOf(z);
      disc(c, z, k, 'rgba(170,210,240,0.22)', 'rgba(220,240,255,0.8)', true, t);
      c.translate(SX(z.x), SY(z.y)); A.setLw(Math.max(1, k * 0.06)); KCArt5.cycloneArt(c, k * 2.0, t * 2);
      c.restore();
    },
    soulblight(c, z, k, t) {
      c.save(); c.globalAlpha = 0.8 * fadeOf(z);
      disc(c, z, k, 'rgba(40,80,40,0.3)', 'rgba(140,255,140,0.75)', true, t);
      c.translate(SX(z.x), SY(z.y) - k * 0.3); c.scale(1, 0.6); A.setLw(Math.max(1, k * 0.05)); KCArt5.curseArt(c, z.r * k * 0.7, t);
      c.restore();
    },
    briarbind(c, z, k, t) {
      // vines wrap each held enemy (drawn on them, see drawEnt); a ring of roots on the ground
      c.save(); c.globalAlpha = 0.6 * fadeOf(z);
      disc(c, z, k, 'rgba(90,64,32,0.25)', 'rgba(170,200,110,0.6)', true, t);
      c.restore();
    },
    judgment(c, z, k, t) {
      c.save(); c.globalAlpha = 0.5 * fadeOf(z);
      disc(c, z, k, 'rgba(255,240,150,0.12)', 'rgba(255,240,150,0.7)', true, t);
      c.restore();
    },
    overclock(c, z, k, t) {
      c.save(); c.globalAlpha = 0.75 * fadeOf(z);
      disc(c, z, k, 'rgba(255,170,60,0.16)', 'rgba(255,200,90,0.85)', true, t);
      c.translate(SX(z.x), SY(z.y)); c.scale(1, 0.6); c.globalAlpha *= 0.55; A.setLw(Math.max(1, k * 0.05)); KCArt5.gearArt(c, z.r * k * 0.55, t);
      c.restore();
    },
    heavensguard(c, z, k, t) {
      // the capsule falls from high above onto its spot, a beam of light marking where
      const f = Math.min(1, z.age / z.delay), x = SX(z.x), y = SY(z.y);
      c.save();
      disc(c, z, k, 'rgba(255,230,140,0.15)', 'rgba(255,230,140,0.85)', true, t);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35;
      const g = c.createLinearGradient(x, y - k * 9, x, y); g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(1, 'rgba(255,240,180,0.8)');
      c.fillStyle = g; c.fillRect(x - k * 0.7, y - k * 9, k * 1.4, k * 9);
      c.restore();
      shadow(c, x, y, k * (0.4 + f * 0.6));
      c.save(); c.translate(x, y - k * (0.8 + (1 - f * f) * 9)); A.setLw(Math.max(1, k * 0.06)); KCArt5.capsuleArt(c, k * 0.8, t, z.team); c.restore();
    },
    collapse(c, z, k, t) {
      c.save(); c.globalAlpha = 0.9 * fadeOf(z);
      disc(c, z, k, 'rgba(30,10,50,0.35)', 'rgba(180,120,255,0.75)', true, t);
      c.translate(SX(z.x), SY(z.y) - k * 2.6); A.setLw(Math.max(1, k * 0.05)); KCArt5.riftArt(c, z.r * k * 0.6, t);
      c.restore();
    },
  };
  // A sandstorm: a tinted circle of blowing sand, rings of sand turning, dust clouds and pebbles.
  function storm(c, z, k, t) {
    const age = z.dur - z.left, fade = Math.min(1, age / 0.3, z.left / 0.4), x = SX(z.x), y = SY(z.y), r = z.r * k;
    c.globalAlpha = 0.85 * fade;
    A.ell(c, x, y, r, r * 0.6); c.fillStyle = 'rgba(214,170,96,0.3)'; c.fill();
    c.strokeStyle = 'rgba(255,230,170,0.75)'; c.lineWidth = Math.max(2, k * 0.08); c.setLineDash([k * 0.5, k * 0.3]); c.lineDashOffset = -t * k * 2; c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const rr = r * (0.3 + i * 0.2), a = t * (2.4 - i * 0.3) * (i % 2 ? -1 : 1) + i * 1.3;
      c.beginPath(); c.ellipse(x, y - k * (0.3 + i * 0.25), rr, rr * 0.45, 0, a, a + Math.PI * 1.3);
      c.strokeStyle = i % 2 ? 'rgba(232,194,122,0.85)' : 'rgba(200,150,80,0.8)'; c.lineWidth = k * (0.22 - i * 0.03); c.lineCap = 'round'; c.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const a = t * 3.2 + i * 0.63, d = r * (0.25 + (i % 4) * 0.2);
      A.circ(c, x + Math.cos(a) * d, y - k * 0.6 + Math.sin(a) * d * 0.45, k * (0.05 + (i % 3) * 0.03)); c.fillStyle = i % 2 ? '#8a6440' : '#c9a070'; c.fill();
    }
    c.globalAlpha = 1;
    if (Math.random() < 0.5) {
      const a = Math.random() * 6.28, d = Math.random() * z.r;
      G.fx.push({ kind: 'puff', x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d * 0.6, vx: Math.cos(a + 1.6) * 1.2, vy: Math.sin(a + 1.6) * 0.6 - 0.2, r: 0.3 + Math.random() * 0.3, col: 'rgba(222,190,130,0.55)', life: 0.8, max: 0.8 });
    }
  }
  const ARCS = new WeakSet();
  function drawProj(c, p, alpha, t) {
    const k = G.k, px = p.px === undefined ? p.x : p.px + (p.x - p.px) * alpha, py = p.py === undefined ? p.y : p.py + (p.y - p.py) * alpha;
    const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, done = Math.min(1, Math.hypot(px - p.sx, py - p.sy) / total);
    if (p.kind === 'prismray') {
      // the Prism Archer's bolt flies straight and level: a bright crystal streak
      const x = SX(px), y = SY(py) - k * 0.9, ex = x - p.dx * k * 1.1, ey = y - p.dy * k * 1.1;
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(x, y); c.strokeStyle = 'rgba(200,160,255,0.55)'; c.lineWidth = k * 0.28; c.stroke();
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(x, y); c.strokeStyle = '#ffffff'; c.lineWidth = k * 0.08; c.stroke();
      c.restore();
      return;
    }
    const arcH = { snowball: 1.6, bigsnow: 1.6, pot: 1.6, lasso: 1, fireball: 2.2, spears: 3, cannon: 0.8, frostleap: 1.0, sunleap: 1.0, frostbolt: 0.8, hook: 0.7,
      spark: 0.3, arcblast: 0.6, cloudpuff: 0.3, barrel: 2.6, meteor: 3.5, arc: 0, glacier: 2.4, magmarock: 2.0, mortarshell: 4.5, bolt: 0.15, thorn: 0.5, emberleap: 1.0 }[p.kind];
    if (p.roll) {
      // Thornroller and Powder Keg roll along the ground toward the enemy
      const x = SX(px), y = SY(py);
      shadow(c, x, y, k * p.width * 0.9);
      c.save(); c.translate(x, y - k * 0.5); A.setLw(Math.max(1, k * 0.06));
      if (p.kind === 'thornroller') KCArt5.logArt(c, k * 0.62, t * (p.dy < 0 ? 1 : -1), p.width / 0.62 * 0.86);
      else { c.rotate(Math.PI / 2 + t * 12 * (p.dy < 0 ? -1 : 1)); KCArt5.kegArt(c, k * 0.6, t, p.team); }
      c.restore();
      if (Math.random() < 0.6) G.fx.push({ kind: 'puff', x: p.x + (Math.random() - 0.5) * p.width * 1.6, y: p.y - p.dy * 0.4, vx: 0, vy: -p.dy * 0.4, r: 0.18, col: 'rgba(200,170,120,0.6)', life: 0.5, max: 0.5 });
      return;
    }
    if (p.kind === 'arc') {
      // the Coil Tower's lightning: a jagged bolt from the coil's sphere to the target
      // (drawn once per shot, as a short-lived bolt; the shot itself is not changed)
      if (!ARCS.has(p)) {
        ARCS.add(p);
        const from = G.s.ents.find(u => u.id === p.from);
        if (from) G.fx.push({ kind: 'bolt', x: p.tx, y: p.ty - 0.5, fx: from.x, fy: from.y - 1.5, seed: Math.random() * 1000, life: 0.18, max: 0.18 });
      }
      return;
    }
    const lift = Math.sin(done * Math.PI) * (arcH === undefined ? 0.5 : arcH) * Math.min(1, total / 6) + (p.air ? 1.1 : 0.6) * (1 - done) + (p.kind === 'meteor' ? (1 - done) * 6 : 0);
    const x = SX(px), y = SY(py) - lift * k;
    if (p.kind === 'fireball') {
      A.ell(c, SX(p.tx), SY(p.ty), KC_CARDS.fireball.area * k, KC_CARDS.fireball.area * k * 0.6);
      c.fillStyle = 'rgba(255,120,40,0.12)'; c.fill(); c.strokeStyle = 'rgba(255,170,80,0.6)'; c.lineWidth = 2; c.stroke();
      shadow(c, SX(px), SY(py), k * 0.4);
      c.save(); c.translate(x, y);
      const ang = Math.atan2(p.ty - p.sy, p.tx - p.sx);
      c.rotate(ang + Math.PI * 0.75);
      A.fireballArt(c, k * 0.9, t * 4);
      c.restore();
      if (Math.random() < 0.6) G.fx.push({ kind: 'dot', x: px, y: py - lift, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), r: 0.18, col: 'rgba(255,150,40,0.8)', life: 0.3, max: 0.3 });
      return;
    }
    if (p.kind === 'spears') {
      const r = KC_CARDS.spears.area;
      A.ell(c, SX(p.tx), SY(p.ty), r * k, r * k * 0.6);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.stroke();
      // the volley is thrown from the King Tower: it climbs in an arc, pointing the way it flies, and
      // fans out as it comes down over the area
      const at = d => [SX(p.sx + (p.tx - p.sx) * d), SY(p.sy + (p.ty - p.sy) * d) - (Math.sin(d * Math.PI) * arcH * Math.min(1, total / 6) + 0.6 * (1 - d)) * k];
      const [hx, hy] = at(Math.min(1, done + 0.03)), ang = Math.atan2(hy - y, hx - x);
      shadow(c, SX(px), SY(py), k * (0.4 + done * r * 0.5));
      const fan = 0.25 + done * done * r * 0.75;
      const volley = [[0, 0], [-0.55, -0.35], [0.55, -0.35], [-1, -0.75], [1, -0.75], [-0.3, -1.05], [0.3, -1.05]];
      c.save(); c.translate(x, y); c.rotate(ang); c.scale(1.3, 1.3);
      for (const [side, back] of volley) {
        c.save(); c.translate(back * k * 0.55, side * fan * k / 1.3);
        // one spear, pointing along +x: shaft, steel head, red fletching
        A.line(c, -k * 0.75, 0, k * 0.45, 0, A.OUT, k * 0.13);
        A.line(c, -k * 0.75, 0, k * 0.45, 0, '#9a6a3a', k * 0.07);
        A.poly(c, [k * 0.72, 0, k * 0.42, -k * 0.11, k * 0.42, k * 0.11]); A.paint(c, '#e4e9f0', Math.max(1, k * 0.05));
        A.poly(c, [-k * 0.72, 0, -k * 0.88, -k * 0.12, -k * 0.8, 0, -k * 0.88, k * 0.12]); A.paint(c, '#dc3640', Math.max(1, k * 0.04));
        c.restore();
      }
      c.restore();
      return;
    }
    if (p.kind === 'pot') {
      shadow(c, SX(px), SY(py), k * 0.18);
      c.save(); c.translate(x, y); c.rotate(done * 7);
      A.ell(c, 0, 0, k * 0.2, k * 0.17); A.paint(c, '#d07a45', k * 0.05);
      A.rr(c, -k * 0.1, -k * 0.24, k * 0.2, k * 0.08, k * 0.03); A.paint(c, '#a8582c', k * 0.03);
      c.restore();
      return;
    }
    if (p.kind === 'glacier') {
      shadow(c, SX(px), SY(py), k * 0.5 * (0.4 + done));
      c.save(); c.translate(x, y); c.rotate(t * 4); A.setLw(Math.max(1, k * 0.05)); KCArt5.glacierArt(c, k * 0.7, t); c.restore();
      A.ell(c, SX(p.tx), SY(p.ty), KC_CARDS.glacierslam.area * k, KC_CARDS.glacierslam.area * k * 0.6); c.strokeStyle = 'rgba(200,240,255,0.6)'; c.lineWidth = 2; c.stroke();
      return;
    }
    if (p.kind === 'magmarock' || p.kind === 'mortarshell') {
      const lava = p.kind === 'magmarock';
      shadow(c, SX(px), SY(py), k * 0.3);
      A.circ(c, x, y, k * (lava ? 0.2 : 0.26)); A.paint(c, lava ? '#4a4256' : '#8a6a4a', k * 0.05);
      if (lava) { A.circ(c, x, y, k * 0.11); c.fillStyle = '#ff9a2a'; c.fill(); if (Math.random() < 0.5) G.fx.push({ kind: 'dot', x: px, y: py - lift, vx: 0, vy: -0.4, r: 0.08, col: 'rgba(255,140,40,0.8)', life: 0.3, max: 0.3 }); }
      else { A.circ(c, x - k * 0.08, y - k * 0.08, k * 0.07); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fill(); A.ell(c, SX(p.tx), SY(p.ty), k * 1.6, k * 0.95); c.strokeStyle = 'rgba(255,220,160,0.5)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.stroke(); c.setLineDash([]); }
      return;
    }
    if (p.kind === 'bolt' || p.kind === 'thorn') {
      const ang = Math.atan2((p.ty - p.sy) * k, (p.tx - p.sx) * k), L = p.kind === 'bolt' ? 0.5 : 0.25;
      c.save(); c.translate(x, y); c.rotate(ang);
      A.line(c, -k * L, 0, k * L * 0.6, 0, A.OUT, Math.max(2, k * 0.1)); A.line(c, -k * L, 0, k * L * 0.6, 0, p.kind === 'bolt' ? '#ffcd33' : '#6a4a2a', Math.max(1, k * 0.05));
      A.poly(c, [k * L, 0, k * L * 0.55, -k * 0.08, k * L * 0.55, k * 0.08]); c.fillStyle = p.kind === 'bolt' ? '#fff6c8' : '#e8f0c8'; c.fill();
      c.restore();
      return;
    }
    if (p.kind === 'emberleap') {
      c.save(); c.translate(x, y + k * 0.3); A.setLw(Math.max(1, k * 0.05)); KCArt5.flame(c, 0, 0, k * 0.55, t); c.restore();
      return;
    }
    if (p.kind === 'arrow') {
      const ang = Math.atan2((p.ty - p.sy) * k, (p.tx - p.sx) * k);
      c.save(); c.translate(x, y); c.rotate(ang);
      A.line(c, -k * 0.35, 0, k * 0.25, 0, '#5a3a1f', Math.max(1.5, k * 0.06));
      A.poly(c, [k * 0.35, 0, k * 0.2, -k * 0.08, k * 0.2, k * 0.08]); c.fillStyle = '#dfe6ee'; c.fill();
      A.line(c, -k * 0.35, 0, -k * 0.45, -k * 0.07, '#fff', Math.max(1, k * 0.04));
      c.restore();
    } else if (p.kind === 'cannon') {
      A.circ(c, x, y, k * 0.2); A.paint(c, '#2a2c35', k * 0.05);
    } else if (p.kind === 'quill') {
      // a steel-tipped quill from the Owl
      const ang = Math.atan2((p.ty - p.sy) * k, (p.tx - p.sx) * k);
      c.save(); c.translate(x, y); c.rotate(ang);
      A.poly(c, [-k * 0.4, 0, -k * 0.15, -k * 0.1, k * 0.2, -k * 0.03, k * 0.2, k * 0.03, -k * 0.15, k * 0.1]); A.paint(c, '#a87a4a', Math.max(1, k * 0.04));
      A.poly(c, [k * 0.38, 0, k * 0.18, -k * 0.06, k * 0.18, k * 0.06]); c.fillStyle = '#dfe6ee'; c.fill();
      c.restore();
    } else if (p.kind === 'lasso') {
      // the rope runs back to the rider; a loop flies at the end
      const from = G.s.ents.find(u => u.id === p.from);
      if (from) {
        const fx = SX(from.x), fy = SY(from.y) - k * 1.8;
        c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo((fx + x) / 2, Math.min(fy, y) - k * 0.6, x, y);
        c.strokeStyle = A.OUT; c.lineWidth = k * 0.1; c.stroke(); c.strokeStyle = '#c8a070'; c.lineWidth = k * 0.06; c.stroke();
      }
      A.ell(c, x, y, k * 0.26, k * 0.14); c.strokeStyle = A.OUT; c.lineWidth = k * 0.1; c.stroke(); c.strokeStyle = '#c8a070'; c.lineWidth = k * 0.06; c.stroke();
    } else if (p.kind === 'bigsnow') {
      // the evolved Snowman's giant snowball, with a frosty trail
      shadow(c, SX(px), SY(py), k * 0.32);
      A.circ(c, x, y, k * 0.36); A.paint(c, '#ffffff', k * 0.07);
      A.circ(c, x - k * 0.1, y - k * 0.1, k * 0.1); c.fillStyle = '#dfe9f7'; c.fill();
      A.circ(c, x + k * 0.12, y + k * 0.08, k * 0.07); c.fillStyle = '#c9a8ff'; c.fill();
      if (Math.random() < 0.7) G.fx.push({ kind: 'dot', x: px, y: py - lift, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), r: 0.12, col: Math.random() < 0.5 ? 'rgba(180,230,255,0.9)' : 'rgba(200,170,255,0.9)', life: 0.4, max: 0.4 });
    } else if (p.kind === 'snowball') {
      shadow(c, SX(px), SY(py), k * 0.2);
      A.circ(c, x, y, k * 0.24); A.paint(c, '#ffffff', k * 0.06);
      A.circ(c, x - k * 0.07, y - k * 0.07, k * 0.07); c.fillStyle = '#dfe9f7'; c.fill();
    } else if (p.kind === 'frostleap' || p.kind === 'sunleap') {
      // a sprite in mid-leap
      shadow(c, SX(px), SY(py), k * 0.25);
      c.save(); c.translate(x, y + k * 0.3); A.troop(c, p.card, k, { team: p.team, t, walk: false, atk: 0, face: 1, id: 1, view: p.team === 0 ? 'back' : 'front' }); c.restore();
    } else if (p.kind === 'frostbolt') {
      A.glow(c, x, y, k * 0.5, 'rgb(170,230,255)', 0.6);
      A.circ(c, x, y, k * 0.16); A.paint(c, '#e9f8ff', k * 0.05);
      if (Math.random() < 0.6) G.fx.push({ kind: 'dot', x: px, y: py - lift, vx: 0, vy: 0, r: 0.08, col: 'rgba(200,240,255,0.9)', life: 0.3, max: 0.3 });
    } else if (p.kind === 'harpoonlet' || p.kind === 'hook') {
      const ang = Math.atan2((p.ty - p.sy) * k, (p.tx - p.sx) * k);
      if (p.kind === 'hook') {
        const from = G.s.ents.find(u => u.id === p.hook);
        if (from) { c.beginPath(); c.moveTo(SX(from.x), SY(from.y) - k * 1.2); c.lineTo(x, y); c.strokeStyle = A.OUT; c.lineWidth = k * 0.1; c.stroke(); c.strokeStyle = '#d8b880'; c.lineWidth = k * 0.06; c.stroke(); }
      }
      c.save(); c.translate(x, y); c.rotate(ang);
      const L = p.kind === 'hook' ? 0.5 : 0.35;
      A.line(c, -k * L, 0, k * 0.2, 0, '#6a4a2a', Math.max(1.5, k * 0.06));
      A.poly(c, [k * 0.36, 0, k * 0.18, -k * 0.1, k * 0.18, k * 0.1]); A.paint(c, '#dfe6ee', Math.max(1, k * 0.04));
      if (p.kind === 'hook') { A.line(c, k * 0.22, -k * 0.1, k * 0.12, -k * 0.2, A.OUT, k * 0.05); A.line(c, k * 0.22, k * 0.1, k * 0.12, k * 0.2, A.OUT, k * 0.05); }
      c.restore();
    } else if (p.kind === 'spark') {
      A.glow(c, x, y, k * 0.45, 'rgb(150,230,255)', 0.8);
      A.circ(c, x, y, k * 0.1); c.fillStyle = '#ffffff'; c.fill();
    } else if (p.kind === 'arcblast') {
      A.glow(c, x, y, k * 1.1, 'rgb(140,220,255)', 0.8);
      A.circ(c, x, y, k * 0.3); A.paint(c, '#e8fbff', k * 0.06);
      for (let i = 0; i < 4; i++) { const a = t * 30 + i * 1.6; A.line(c, x, y, x + Math.cos(a) * k * 0.6, y + Math.sin(a) * k * 0.6, '#cfeeff', Math.max(1, k * 0.04)); }
    } else if (p.kind === 'cloudpuff') {
      for (let i = 0; i < 3; i++) { A.circ(c, x + (i - 1) * k * 0.14, y + Math.sin(t * 9 + i) * k * 0.05, k * (0.16 + (i === 1 ? 0.06 : 0))); c.fillStyle = 'rgba(235,245,255,0.95)'; c.fill(); }
    } else if (p.kind === 'barrel') {
      A.ell(c, SX(p.tx), SY(p.ty), k * 1.0, k * 0.6); c.strokeStyle = 'rgba(255,220,150,0.7)'; c.lineWidth = 2; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
      shadow(c, SX(px), SY(py), k * 0.4);
      c.save(); c.translate(x, y); A.barrelArt(c, k * 0.75, t * 8, p.team); c.restore();
    } else if (p.kind === 'meteor') {
      const r = KC_CARDS.meteor.area;
      A.ell(c, SX(p.tx), SY(p.ty), r * k, r * k * 0.6); c.fillStyle = 'rgba(255,40,70,0.12)'; c.fill(); c.strokeStyle = 'rgba(255,90,110,0.7)'; c.lineWidth = 2; c.stroke();
      shadow(c, SX(px), SY(py), k * 0.6 * (0.4 + done));
      c.save(); c.translate(x, y); c.rotate(-0.6); A.meteorArt(c, k * 1.1, t); c.restore();
      if (Math.random() < 0.8) G.fx.push({ kind: 'dot', x: px, y: py - lift, vx: (Math.random() - 0.5), vy: -0.5, r: 0.2, col: Math.random() < 0.5 ? 'rgba(255,70,90,0.8)' : 'rgba(80,60,90,0.8)', life: 0.4, max: 0.4 });
    }
  }
  function drawFx(c, t) {
    const k = G.k;
    for (const f of G.fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.kind === 'dot') { c.globalAlpha = a; A.circ(c, SX(f.x), SY(f.y), f.r * k); c.fillStyle = f.col; c.fill(); }
      else if (f.kind === 'puff') { c.globalAlpha = a * 0.8; A.circ(c, SX(f.x), SY(f.y), f.r * k * (1.6 - a * 0.6)); c.fillStyle = f.col; c.fill(); }
      else if (f.kind === 'ring') {
        c.globalAlpha = a; A.ell(c, SX(f.x), SY(f.y), f.r * k * (1.2 - a * 0.6), f.r * k * 0.5 * (1.2 - a * 0.6));
        c.strokeStyle = f.col || (f.team === 0 ? '#8cc4ff' : '#ff9ea4'); c.lineWidth = k * 0.12; c.stroke();
      } else if (f.kind === 'flash') {
        const r = f.r * k * (0.6 + (1 - a) * 0.6), x = SX(f.x), y = SY(f.y);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,220,140,0.75)'); g.addColorStop(0.5, 'rgba(255,130,40,0.35)'); g.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
        c.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'blast') {
        const p = 1 - a;
        c.globalAlpha = a; A.ell(c, SX(f.x), SY(f.y), f.r * k * (0.4 + p), f.r * k * 0.6 * (0.4 + p));
        c.fillStyle = 'rgba(255,170,60,0.45)'; c.fill(); c.strokeStyle = '#ffe08a'; c.lineWidth = k * 0.18; c.stroke();
        A.circ(c, SX(f.x), SY(f.y) - k * 0.4, f.r * k * 0.5 * a); c.fillStyle = 'rgba(255,240,180,0.8)'; c.fill();
      } else if (f.kind === 'txt') {
        c.globalAlpha = Math.min(1, a * 2);
        c.font = `${Math.round(k * 0.8)}px "Lilita One", "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const ty = SY(f.y) - (1 - a) * k * 1.2;
        c.lineWidth = Math.max(2, k * 0.12); c.strokeStyle = A.OUT; c.strokeText(f.txt, SX(f.x), ty); c.fillStyle = f.col; c.fillText(f.txt, SX(f.x), ty);
      } else if (f.kind === 'rock') {
        c.globalAlpha = Math.min(1, a * 2); A.circ(c, SX(f.x), SY(f.y) - f.z * k * 0.3, f.r * k); A.paint(c, f.col, k * 0.04);
      } else if (f.kind === 'bolt') {
        // a jagged lightning bolt, fading
        const x0 = SX(f.fx), y0 = SY(f.fy), x1 = SX(f.x), y1 = SY(f.y), n = 7;
        const pts = [[x0, y0]];
        for (let i = 1; i < n; i++) { const r = Math.sin(f.seed + i * 12.9898) * 43758.5453; const j = (r - Math.floor(r) - 0.5) * k * 0.9; pts.push([x0 + (x1 - x0) * i / n + j, y0 + (y1 - y0) * i / n]); }
        pts.push([x1, y1]);
        c.save(); c.globalAlpha = a; c.lineCap = 'round'; c.lineJoin = 'round'; c.globalCompositeOperation = 'lighter';
        for (const [w, col] of [[k * 0.45, 'rgba(110,160,255,0.5)'], [k * 0.16, '#cfe6ff'], [k * 0.05, '#ffffff']]) {
          c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const [px, py] of pts.slice(1)) c.lineTo(px, py); c.strokeStyle = col; c.lineWidth = w; c.stroke();
        }
        c.restore();
      } else if (f.kind === 'zap') {
        const p = 1 - a, x = SX(f.x), y = SY(f.y), r = f.r * k * (0.5 + p);
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(240,248,255,0.9)'); g.addColorStop(0.5, 'rgba(130,180,255,0.45)'); g.addColorStop(1, 'rgba(120,140,255,0)');
        c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
        c.restore();
      } else if (f.kind === 'evo') {
        const p = 1 - a, x = SX(f.x), y = SY(f.y);
        c.globalAlpha = a; c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(x, y - k * 0.6, 0, x, y - k * 0.6, k * (1 + p * 2));
        g.addColorStop(0, 'rgba(220,190,255,0.8)'); g.addColorStop(1, 'rgba(140,80,255,0)');
        c.fillStyle = g; A.circ(c, x, y - k * 0.6, k * (1 + p * 2)); c.fill();
        c.globalCompositeOperation = 'source-over';
        A.ell(c, x, y, k * (0.6 + p * 1.8), k * (0.25 + p * 0.8)); c.strokeStyle = '#c9a8ff'; c.lineWidth = k * 0.14 * a; c.stroke();
      } else if (f.kind === 'crown') {
        const p = 1 - a, x = SX(f.x), y = SY(f.y) - k * (1.5 + p * 3);
        c.globalAlpha = Math.min(1, a * 3);
        c.save(); c.translate(x, y); c.scale(1 + Math.sin(p * 8) * 0.06, 1 + Math.sin(p * 8) * 0.06);
        A.crownIcon(c, 0, 0, k * 0.8, f.team === 0 ? '#ffcf3f' : '#ff8d94');
        c.restore();
      }
      c.globalAlpha = 1;
    }
  }
  function ghost(c, id, t) {
    const s = G.s, k = G.k, orig = id;
    id = S.resolve(s, 0, id) || id;
    const card = KC_CARDS[id], p = card.kind === 'spell' && !card.ownSide ? snap(G.hover) : placeAt(orig, G.hover);
    const ok = S.canDeploy(s, 0, orig, p.x, p.y), x = SX(p.x), y = SY(p.y);
    if (card.roll) {
      // Thornroller, Powder Keg: the strip it will roll along, from the spot toward the enemy
      const len = card.roll.dist, w = card.area;
      A.rr(c, SX(p.x - w), SY(p.y - len), w * 2 * k, len * k, k * 0.4);
      c.fillStyle = ok ? 'rgba(255,220,150,0.16)' : 'rgba(229,65,75,0.3)'; c.fill();
      c.strokeStyle = ok ? 'rgba(255,220,150,0.9)' : 'rgba(229,65,75,0.9)'; c.lineWidth = 2.5; c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, SY(p.y - len) + k * 0.6); c.lineTo(x - k * 0.4, SY(p.y - len) + k * 1.1); c.moveTo(x, SY(p.y - len) + k * 0.6); c.lineTo(x + k * 0.4, SY(p.y - len) + k * 1.1);
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; c.stroke();
      return;
    }
    if (card.kind === 'spell') {
      const ar = card.area || 1;
      if (card.ownSide && !ok) { A.ell(c, x, y, ar * k, ar * k * 0.62); c.fillStyle = 'rgba(229,65,75,0.35)'; c.fill(); return; }
      A.ell(c, x, y, ar * k, ar * k * 0.62);
      c.fillStyle = card.storm ? 'rgba(214,170,96,0.3)' : 'rgba(255,140,40,0.22)'; c.fill(); c.strokeStyle = 'rgba(255,220,150,0.95)'; c.lineWidth = 2.5; c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]);
      return;
    }
    if (card.anywhere) {
      // the Mole: a dotted tunnel from your King Tower to the spot
      const kx = SX(9), ky = SY(26.4);
      c.beginPath(); c.moveTo(kx, ky); c.lineTo(x, y);
      c.strokeStyle = ok ? 'rgba(160,120,80,0.9)' : 'rgba(229,65,75,0.8)'; c.lineWidth = k * 0.16; c.setLineDash([k * 0.25, k * 0.25]); c.stroke(); c.setLineDash([]);
      A.ell(c, x, y, k * 0.62, k * 0.3); c.fillStyle = ok ? 'rgba(90,60,35,0.55)' : 'rgba(229,65,75,0.5)'; c.fill();
      c.globalAlpha = ok ? 0.6 : 0.35;
      c.save(); c.translate(x, y);
      if (card.kind === 'building') A.building(c, id, k, { team: 0, t, angle: -Math.PI / 2 }); else A.troop(c, id, k, { team: 0, t, walk: false, atk: 0, face: 1, id: 1, view: 'back' });
      c.restore();
      c.globalAlpha = 1;
      return;
    }
    if (card.kind === 'building') {
      const hf = card.half;
      A.rr(c, SX(p.x - hf), SY(p.y - hf), hf * 2 * k, hf * 2 * k, k * 0.2);
      c.fillStyle = ok ? 'rgba(255,255,255,0.3)' : 'rgba(229,65,75,0.5)'; c.fill();
      c.globalAlpha = ok ? 0.65 : 0.35;
      c.save(); c.translate(x, y); A.building(c, id, k, { team: 0, angle: -Math.PI / 2, t }); c.restore();
      c.globalAlpha = 1;
      A.ell(c, x, y, (card.range + card.radius) * k, (card.range + card.radius) * k);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.5; c.setLineDash([5, 6]); c.stroke(); c.setLineDash([]);
      return;
    }
    A.rr(c, SX(p.x - 0.5), SY(p.y - 0.5), k, k, k * 0.15);
    c.fillStyle = ok ? 'rgba(255,255,255,0.35)' : 'rgba(229,65,75,0.5)'; c.fill();
    c.globalAlpha = ok ? 0.6 : 0.35;
    const offs = card.count === 5 ? [[0, -0.5], [-0.5, -0.1], [0.5, -0.1], [-0.3, 0.45], [0.3, 0.45]] : card.count === 4 ? [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]] : card.count === 3 ? [[-0.55, 0.3], [0.55, 0.3], [0, -0.45]] : card.count === 2 ? [[-0.5, 0], [0.5, 0]] : [[0, 0]];
    for (const [ox, oy] of offs) {
      c.save(); c.translate(x + ox * k, y + oy * k - (card.air ? (LIFT[id] || 1.1) * k : 0));
      A.troop(c, id, k, { team: 0, t, walk: false, atk: 0, face: 1, id: 1, view: 'back' });
      c.restore();
    }
    c.globalAlpha = 1;
    if (card.range >= 2) {
      A.ell(c, x, y, (card.range + card.radius) * k, (card.range + card.radius) * k);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.5; c.setLineDash([5, 6]); c.stroke(); c.setLineDash([]);
    }
  }

  /* ---------- the panels around the arena ---------- */
  function ui() {
    const s = G.s, u = G.ui;
    if (!s) return;
    renderHand();
    const en = s.energy[0];
    const fill = (en / S.MAX_ENERGY * 100).toFixed(1) + '%';
    // the bar fills upward beside the arena, and left to right along the bottom on a phone
    const across = $('#battle').classList.contains('phone');
    if (u.fill !== fill || u.across !== across) { u.fill = fill; u.across = across; $('#efill').style.height = across ? '' : fill; $('#efill').style.width = across ? fill : ''; }
    const n = Math.floor(en);
    if (u.n !== n) { u.n = n; $('#enum').textContent = n; }
    const dbl = s.double || s.phase === 'overtime';
    if (u.dbl !== dbl) { u.dbl = dbl; $('#x2').hidden = !dbl; }
    document.querySelectorAll('.card').forEach(b => {
      const id = s.hands[0][+b.dataset.slot], cost = S.costOf(s, 0, id), p = Number.isFinite(cost) ? Math.min(1, en / cost) : 0;
      b.classList.toggle('poor', en < cost);
      b.style.setProperty('--p', p.toFixed(3));
    });
    const left = Math.max(0, Math.ceil(s.timeLeft)), tl = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const ot = s.phase === 'overtime' || s.phase === 'sudden';
    // who is ahead when overtime ends: the side whose weakest tower has the bigger share of its health
    const lb = $('#leadBar');
    if (ot && !s.result) {
      const a = S.lowestTower(s, 0), f = S.lowestTower(s, 1), key = `${Math.round(a * 100)}|${Math.round(f * 100)}|${s.phase}`;
      if (u.lead !== key) {
        u.lead = key;
        const who = a > f + 0.004 ? 'You lead' : f > a + 0.004 ? 'They lead' : 'Level';
        lb.innerHTML = `<small>${s.phase === 'sudden' ? 'Sudden death' : 'If time runs out'}: weakest tower</small><span class="lb-row"><b class="y">${Math.round(a * 100)}%</b><span class="lb-bar"><i class="y" style="width:${(a / (a + f || 1) * 100).toFixed(1)}%"></i></span><b class="f">${Math.round(f * 100)}%</b></span><em class="${who === 'You lead' ? 'y' : who === 'They lead' ? 'f' : ''}">${who}</em>`;
      }
      lb.hidden = false;
    } else if (!lb.hidden) lb.hidden = true;
    if (u.tl !== tl || u.ot !== ot) {
      u.tl = tl; u.ot = ot;
      $('#timerVal').textContent = tl;
      $('#timerLabel').textContent = s.phase === 'sudden' ? 'Sudden death' : ot ? 'Overtime' : 'Time left';
      $('#timer').classList.toggle('ot', ot);
      $('#timer').classList.toggle('low', !ot && left <= 30);
      $('#miniTimer').classList.toggle('low', !ot && left <= 30);
    }
    const cr = s.crowns.join();
    if (u.cr !== cr) { u.cr = cr; $('#crownYou').textContent = s.crowns[0]; $('#crownFoe').textContent = s.crowns[1]; }
    // on small screens the clock sits on the arena with the crown score under it
    const mt = `${tl}|${ot}|${cr}|${s.phase}`;
    if (u.mt !== mt) { u.mt = mt; $('#miniTimer').innerHTML = `${s.phase === 'sudden' ? 'Sudden' : ot ? 'Overtime' : 'Time'}<br><b>${tl}</b><span class="mt-cr" aria-label="Crowns: you ${s.crowns[0]}, opponent ${s.crowns[1]}"><span class="y">${s.crowns[0]}</span> – <span class="f">${s.crowns[1]}</span></span>`; }
    if (G.phase === 'play' && left <= 10 && left > 0 && left !== G.lastSec) {
      G.lastSec = left;
      const cd = $('#countdown');
      cd.textContent = left; cd.hidden = false;
      cd.classList.remove('tick'); void cd.offsetWidth; cd.classList.add('tick');
      KCSound.play('tick');
    } else if (left > 10 && !$('#countdown').hidden) $('#countdown').hidden = true;
    if (G.phase === 'play' && !G.idleHint && s.time > 7 && s.played[0] === 0) {
      G.idleHint = true;
      if (G.trainer.lines) say('Tip: drag a card from the left onto your side of the arena.', 4000);
      else toast('Tip: drag a card from the left onto your side of the arena.');
    }
  }

  /* ---------- the loop ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - (G.last || now)) / 1000));
    G.last = now;
    if (G.phase === 'home') return;
    KCScenery.frame(now);
    if (G.phase === 'intro') {
      G.intro -= dt;
      if (G.finding && G.intro <= 1.7) { G.finding = false; $('#intro').classList.remove('finding'); KCSound.play('select'); }
      if (G.intro <= 0) begin();
    } else if (G.phase === 'play' && G.online) {
      onlineTick(dt, now);
    } else if (G.phase === 'play') {
      // a moment of slow motion as a tower falls
      const slow = G.slowmo > 0 ? 0.3 : 1;
      if (G.slowmo > 0) G.slowmo -= dt;
      G.acc += dt * slow;
      let n = 0;
      while (G.acc >= S.DT && n < 6 && G.phase === 'play') {
        S.step(G.s);
        KCBot.update(G.bot, G.s);
        handleEvents();
        G.acc -= S.DT; n++;
      }
      if (n === 6) G.acc = 0;
    } else if (G.phase === 'end') {
      if (G.online && !G.online.done && now - G.online.sentAt > 150) sendStep(G.online);
      G.ended -= dt;
      if (G.ended <= 0 && $('#result').hidden) showResult();
    }
    updateFx(dt * (G.slowmo > 0 ? 0.4 : 1));
    draw(G.phase === 'play' ? Math.min(1, G.acc / S.DT) : 1, now / 1000);
    ui();
  }

  function boot() {
    cv = $('#arena'); ctx = cv.getContext('2d');
    KCMenu.init({ onBattle: startBattle, onOnline: startOnline });
    KCScenery.make($('#sceneL'), 'left');
    KCScenery.make($('#sceneR'), 'right');
    bindInput();
    // emotes (js/emotes.js): a bubble beside each King Tower, placed in the arena box's pixels
    KCEmotes.mount($('#arenaBox'), {
      spot: team => { const cvs = $('#arena'); return { x: cvs.offsetLeft + SX(11.6), y: cvs.offsetTop + SY(team ? 3.4 : 28.4) }; },
      canEmote: () => !$('#battle').hidden && (G.phase === 'play' || G.phase === 'end') && $('#result').hidden,
      foeCanEmote: () => !$('#battle').hidden && $('#result').hidden && !!G.s,
      ended: () => G.phase === 'end',
      toast,
      // online: emotes go to the other player, and nobody replies automatically
      online: () => !!G.online,
      onSend: id => { if (G.online && !G.online.done) G.online.room.emit('mp.emote', { id }).catch(() => {}); },
    });
    $('#againBtn').addEventListener('click', () => startBattle(G.trainer.kind === 'trophy' ? KCMenu.nextFoe('trophy') : G.trainer));
    $('#nextBtn').addEventListener('click', () => startBattle(G.res.unlockedNext));
    $('#homeBtn').addEventListener('click', () => { if (G.res && G.res.chestNow && !G.res.chestShown) openChestNow(); else goHome(); });
    $('#chestNowBtn').addEventListener('click', openChestNow);
    // Surrender: tap once to ask, again within 3 s to give up the battle (a loss, as if the King fell).
    // Online it tells the other player, who wins.
    let leaveT = 0;
    $('#leaveBtn').addEventListener('click', () => {
      const b = $('#leaveBtn');
      if (G.phase !== 'play' || !G.s || G.s.result) return;
      if (!b.classList.contains('ask')) { b.classList.add('ask'); KCSound.play('select'); clearTimeout(leaveT); leaveT = setTimeout(() => b.classList.remove('ask'), 3000); return; }
      b.classList.remove('ask'); clearTimeout(leaveT);
      if (G.online) { try { Promise.resolve(G.online.room.emit('mp.bye', {})).catch(() => {}); } catch (e) { /* gone */ } S.forceEnd(G.sim, 1 - G.online.team, 'surrender'); G.s = viewOf(G.sim); }
      else S.forceEnd(G.s, 1, 'surrender');
      handleEvents();
    });
    // TEMPORARY test button: ends the match as a win, with the same rewards as a real one.
    $('#simWinBtn').addEventListener('click', () => {
      if (G.phase !== 'play' || !G.s || G.s.result) return;
      if (G.online) return;
      S.forceEnd(G.s, 0);
      handleEvents();
    });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!$('#battle').hidden) layout(); }, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!$('#battle').hidden) layout(); });
    window.KingdomClash = { get state() { return G.s; }, get sim() { return G.sim; }, G, startBattle, startOnline, mirrorState, hashState };
    requestAnimationFrame(frame);
  }
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
