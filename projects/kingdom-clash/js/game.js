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
    fx: [], bg: null, zone: null, zoneKey: '', handKey: '', ui: {},
    intro: 0, ended: 0, shake: 0, lastSec: -1, idleHint: false, trainer: null, res: null,
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
    $('#result').hidden = true; $('#leaveAsk').hidden = true;
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
    const trophy = T.kind === 'trophy', arenaNow = KCProgress.arena();
    G.theme = trophy ? arenaNow.theme : 'training';
    G.art = KCArenas.get(G.theme);
    B = G.art.margin;
    KCScenery.setArena(G.theme);
    G.embers = [];
    G.s = S.create({
      seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, towerDamage: [1, T.towerDamage],
      decks: [trophy ? KCProgress.state.deck : KCProgress.trainingDeck(), T.deck || KC_STARTER_DECK], cardLevels: [KCProgress.cardLevels(), T.cardLevels || {}],
    });
    G.bot = KCBot.create(1, { skill: T.skill, seed: Math.floor(Math.random() * 1e9) });
    const where = trophy ? `${arenaNow.name} · ${T.tier}` : `Training Grounds · ${T.tier}`;
    for (const [sel, text] of [['#foeName', T.name], ['#foeTier', where], ['#scoreFoe', T.name], ['#introFoeName', T.name],
      ['#introFoeTier', trophy ? T.tier : `Level ${T.level} · ${T.tier}`], ['#resFoeName', T.name], ['#introYou', KCMenu.name]]) $(sel).textContent = text;
    A.trainer($('#introFoe'), T.look);
    Object.assign(G, { fx: [], embers: [], sel: -1, hover: null, acc: 0, ended: 0, lastSec: -1, handKey: '', zoneKey: '', idleHint: false, ui: {}, shake: 0 });
    $('#result').hidden = true; $('#leaveAsk').hidden = true; $('#bubble').hidden = true; $('#countdown').hidden = true;
    KCScenery.reset();
    show('battle');
    layout();
    G.phase = 'intro'; G.intro = 1.7;
    $('#intro').hidden = false;
  }
  function begin() {
    $('#intro').hidden = true;
    G.phase = 'play';
    banner('FIGHT!');
    KCSound.play('fight');
    setTimeout(() => say(pick(G.trainer.lines.start)), 900);
  }

  /* ---------- layout ---------- */
  function layout() {
    if (!cv) return;
    const narrow = innerWidth < 1000;
    $('#battle').classList.toggle('narrow', narrow);
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

  /* ---------- the hand ---------- */
  function renderHand() {
    const s = G.s, hand = s.hands[0], key = hand.join() + '|' + s.queues[0][0];
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
      b.title = `${c.name} (${c.cost} energy)`;
      b.innerHTML = `<img src="${cardImg(id)}" alt="${c.name}"><span class="ready"></span><span class="key">${i + 1}</span><span class="cost">${c.cost}</span>`;
      b.addEventListener('pointerdown', e => cardDown(e, i));
      el.appendChild(b);
    });
    $('#nextImg').src = cardImg(s.queues[0][0]);
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
  function tryPlay(w) {
    const s = G.s;
    if (!s || G.sel < 0 || G.phase !== 'play') return;
    const p = snap(w), slot = G.sel, id = s.hands[0][slot];
    const r = S.play(s, 0, slot, p.x, p.y);
    if (r === 'ok') { select(-1); G.idleHint = true; return; }
    KCSound.play('error');
    if (r === 'energy') {
      toast(`Not enough energy for ${KC_CARDS[id].name}`);
      const bar = $('#ebar'); bar.classList.remove('flash'); void bar.offsetWidth; bar.classList.add('flash');
      const card = document.querySelector(`.card[data-slot="${slot}"]`);
      if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    } else if (r === 'zone') toast('Place troops on your side of the river');
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
  const SHOOT = { arrow: 'arrow', cannon: 'cannon', snowball: 'snow' };
  function handleEvents() {
    const s = G.s;
    for (const e of s.events) {
      switch (e.type) {
        case 'deploy':
          KCSound.play('deploy');
          ring(e.x, e.y, e.team, 1.4);
          dust(e.x, e.y, 8);
          break;
        case 'cast': KCSound.play('spell'); break;
        case 'shoot': KCSound.play(SHOOT[e.kind] || 'arrow'); break;
        case 'hit':
          if (e.card === 'gorilla' || e.card === 'rhino') { KCSound.play('smash'); G.shake = Math.max(G.shake, e.card === 'rhino' ? 0.12 : 0.18); sparks(e.x, e.y, 6, '#fff3c4'); }
          else if (e.kind === 'cannon') sparks(e.x, e.y, 5, '#ffd27a');
          else { KCSound.play('hit'); sparks(e.x, e.y, 3, '#ffffff'); }
          break;
        case 'splash': puff(e.x, e.y, 9, '#ffffff', e.r); break;
        case 'death': KCSound.play('death'); puff(e.x, e.y - (e.air ? 1.1 : 0.3), 7, '#d9d4e8', 0.5); break;
        case 'boom':
          KCSound.play('boom'); G.shake = Math.max(G.shake, 0.3);
          G.fx.push({ kind: 'blast', x: e.x, y: e.y, r: e.r, life: 0.5, max: 0.5 });
          if (G.art.fx === 'lava') G.fx.push({ kind: 'flash', x: e.x, y: e.y, r: e.r * 2.2, life: 0.45, max: 0.45 });
          sparks(e.x, e.y, 18, '#ffb030', 4);
          break;
        case 'tower': towerFx(e); break;
        case 'double': banner('×2 Energy!', 'Last minute'); KCSound.play('double'); say(G.trainer.lines.double); break;
        case 'overtime': banner('Overtime!', 'Next tower wins'); KCSound.play('double'); say(G.trainer.lines.overtime); break;
        case 'end': endBattle(e); break;
      }
    }
    s.events.length = 0;
  }
  function towerFx(e) {
    KCSound.play('tower');
    G.shake = Math.max(G.shake, 0.55);
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
      G.fx.push({ kind: 'crown', x: e.x, y: e.y, life: 1.6, max: 1.6, team: 0 });
      setTimeout(() => KCSound.play('crown'), 250);
      if (e.sub !== 'king') say(pick(G.trainer.lines.youTower));
    } else {
      G.fx.push({ kind: 'crown', x: e.x, y: e.y, life: 1.6, max: 1.6, team: 1 });
      if (e.sub !== 'king') say(pick(G.trainer.lines.myTower));
    }
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
    for (const f of G.fx) {
      f.life -= dt;
      if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; }
      if (f.kind === 'rock') { f.vz -= 18 * dt; f.z = Math.max(0, f.z + f.vz * dt); if (f.z === 0) { f.vx *= 0.8; f.vy *= 0.8; } }
    }
    G.fx = G.fx.filter(f => f.life > 0);
    G.shake = Math.max(0, G.shake - dt);
  }

  /* ---------- the end ---------- */
  function endBattle(e) {
    G.phase = 'end';
    G.ended = 1.8;
    if (e.winner >= 0) KCScenery.celebrate(e.winner);
    select(-1);
    G.res = KCMenu.recordResult(G.trainer, e.winner);
    $('#countdown').hidden = true;
    if (e.winner === 0) { banner('Victory!'); setTimeout(() => KCSound.play('win'), 300); }
    else if (e.winner === 1) { banner('Defeat'); setTimeout(() => KCSound.play('lose'), 300); }
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
    $('#resLine').textContent = (w === 0 && r.crowns[0] === 3 ? 'Three crowns! ' : '') + (w === 0 ? pick(L.youWin) : w === 1 ? pick(L.youLose) : L.draw);
    const un = $('#resUnlock'), tr = $('#resTrophy');
    const notes = [res.unlockedNext ? `${res.unlockedNext.name} unlocked!` : '', res.roadOpened ? 'Trophy Road unlocked!' : '',
      res.chest ? `${res.chest.name} earned!` : '', res.slotsFull ? 'Chest slots full: open one to make room' : '',
      res.newArena ? `${res.newArena.name} reached!` : '', res.newRewards ? 'Trophy Road reward ready!' : '', res.levelUp ? `Level ${res.levelUp}!` : ''].filter(Boolean);
    un.hidden = !notes.length;
    un.textContent = notes.join('  ·  ');
    tr.hidden = res.kind !== 'trophy';
    if (res.kind === 'trophy') {
      tr.className = 'res-trophy' + (res.delta > 0 ? ' up' : res.delta < 0 ? ' down' : '');
      tr.innerHTML = `<i class="trophy-i" aria-hidden="true"></i><b>${res.delta > 0 ? '+' : ''}${res.delta}</b><small>${res.trophies} trophies</small>`;
    }
    $('#nextBtn').hidden = !res.unlockedNext;
    $('#againBtn').className = res.unlockedNext ? 'pill' : 'big-btn';
    if (res.unlockedNext) $('#nextBtnText').textContent = `Battle ${res.unlockedNext.name}`;
    const why = { king: 'King Tower down.', time: 'More crowns when time ran out.', overtime: 'First tower in overtime.', tiebreak: 'Tiebreak: the side whose weakest tower had more health wins.', draw: 'Every tower ended with the same health.', test: 'Simulated win (test button).' }[r.reason];
    const m = Math.floor(r.time / 60), sec = String(Math.floor(r.time % 60)).padStart(2, '0');
    $('#resSmall').textContent = `${why} ${m}:${sec} played, ${s.played[0]} cards from you, +${res.xp || 0} XP${res.firstWin ? ' (first win bonus)' : ''}.`;
    $('#result').hidden = false;
    setTimeout(() => (res.unlockedNext ? $('#nextBtn') : $('#againBtn')).focus(), 50);
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
    if (selId && KC_CARDS[selId].kind === 'troop') drawZone(c);

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
    for (const p of s.projs) drawProj(c, p, alpha, t);
    for (const d of air) drawEnt(c, d, t);
    drawFx(c, t);
    for (const d of ground.concat(air)) bars(c, d);
    if (selId && G.hover) ghost(c, selId, t);
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
    // corner braziers
    for (const [bx, by] of f.braziers) {
      const x = SX(bx), y = SY(by) - k * 0.4, r = k * (1.9 + Math.sin(t * 13 + bx) * 0.12 + Math.sin(t * 7.1 + by) * 0.1);
      const bg = c.createRadialGradient(x, y, 0, x, y, r);
      bg.addColorStop(0, 'rgba(255,190,90,0.4)'); bg.addColorStop(1, 'rgba(255,120,40,0)');
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
        ? { x: br[0] + (Math.random() - 0.5) * 0.5, y: br[1] - 0.6, vy: -1.4 - Math.random(), life: 1.6, max: 1.6, ph: Math.random() * 6 }
        : { x: Math.random() * S.W, y: 15.2 + Math.random() * 1.6, vy: -0.6 - Math.random() * 0.8, life: 2.5 + Math.random() * 2, max: 4.5, ph: Math.random() * 6 });
    }
    for (const e of E) {
      e.life -= 1 / 60; e.y += e.vy / 60; e.x += Math.sin(t * 2 + e.ph) * 0.006;
      c.globalAlpha = Math.max(0, Math.min(1, e.life / e.max * 2)) * (0.55 + 0.45 * Math.sin(t * 10 + e.ph));
      c.fillStyle = '#ffb347';
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
    for (const b of S.BRIDGES) {
      const x0 = SX(b - 1.1), w = 2.2 * k, y0 = SY(S.RIVER_TOP - 0.35), h = 2.7 * k;
      c.drawImage(G.bg, x0 * G.dpr, y0 * G.dpr, w * G.dpr, h * G.dpr, x0, y0, w, h);
    }
  }
  function drawZone(c) {
    const s = G.s, key = s.ents.filter(e => e.kind === 'tower' && e.dead).map(e => e.id).join();
    if (key !== G.zoneKey || !G.zone) {
      G.zoneKey = key;
      const z = document.createElement('canvas');
      z.width = G.bg.width; z.height = G.bg.height;
      const zc = z.getContext('2d');
      zc.scale(G.dpr, G.dpr);
      zc.fillStyle = 'rgba(229,65,75,0.3)';
      for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
        const okHere = S.canDeploy(s, 0, 'gladiator', x + 0.5, y + 0.5) || (y >= S.RIVER_BOT);
        if (!okHere) zc.fillRect(SX(x), SY(y), G.k + 0.5, G.k + 0.5);
      }
      G.zone = z;
    }
    c.drawImage(G.zone, 0, 0, G.zone.width / G.dpr, G.zone.height / G.dpr);
  }
  function shadow(c, x, y, r) { A.ell(c, x, y, r, r * 0.42); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill(); }
  function drawEnt(c, d, t) {
    const e = d.e, k = G.k, x = SX(d.x), y = SY(d.y);
    if (e.kind === 'tower') {
      const target = e.target && G.s.ents.find(u => u.id === e.target);
      const face = target ? (target.x >= e.x ? 1 : -1) : (e.team === 0 ? 1 : -1);
      c.save(); c.translate(x, y);
      if (e.dead) A.rubble(c, k, { team: e.team, sub: e.sub });
      else {
        if (e.flash > 0) c.filter = 'brightness(1.5)';
        (e.sub === 'king' ? A.kingTower : A.archerTower)(c, k, { team: e.team, face, active: e.active, t, view: e.team === 0 ? 'back' : 'front', atk: Math.max(0, e.cd / e.hit - 0.6) * 2.5 });
      }
      c.restore();
      return;
    }
    if (e.kind === 'building') {
      c.save(); c.translate(x, y);
      if (e.deploy > 0) { const sc = Math.max(0.3, 1 - Math.max(0, e.deploy - 0.6) * 2); c.globalAlpha = 0.7; c.scale(sc, sc); }
      if (e.flash > 0) c.filter = 'brightness(1.6)';
      A.cannon(c, k, { team: e.team, angle: e.angle, atk: Math.max(0, e.atk / 0.25) });
      c.restore();
      return;
    }
    const lift = e.air ? k * 1.1 : 0;
    if (!e.air) shadow(c, x, y, e.radius * k * 1.05);
    A.ell(c, x, y, e.radius * k * 1.0, e.radius * k * 0.42);
    c.strokeStyle = e.team === 0 ? 'rgba(80,160,255,0.85)' : 'rgba(255,90,100,0.85)'; c.lineWidth = k * 0.07; c.stroke();
    c.save();
    c.translate(x, y - lift);
    let sc = 1;
    if (e.deploy > 0) { sc = 1 - Math.max(0, e.deploy - 0.75) * 2; c.globalAlpha = 0.65; }
    if (sc < 1) c.scale(Math.max(0.2, sc), Math.max(0.2, sc));
    if (e.flash > 0) c.filter = 'brightness(1.8)';
    const o = { team: e.team, t: t + e.id * 0.37, walk: e.moving, atk: Math.max(0, e.atk / 0.28), face: e.face, id: e.id, view: e.team === 0 ? 'back' : 'front' };
    A.troop(c, e.card, k, o);
    c.restore();
    if (e.deploy > 0) {
      const p = 1 - e.deploy / 1.0, r = k * 0.32, cy = y - lift - k * 1.6;
      A.circ(c, x, cy, r); c.fillStyle = 'rgba(20,12,40,0.7)'; c.fill();
      c.beginPath(); c.moveTo(x, cy); c.arc(x, cy, r * 0.8, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); c.closePath();
      c.fillStyle = e.team === 0 ? '#8cc4ff' : '#ff9ea4'; c.fill();
    }
  }
  function bars(c, d) {
    const e = d.e, k = G.k;
    if (e.dead) return;
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
    if (e.hp >= e.maxHp || e.deploy > 0) return;
    const lift = e.air ? k * 1.1 : 0, top = { rhino: 1.45, gorilla: 1.75, gladiator: 1.95, snowman: 2.0, archers: 1.55, wolves: 1.05, hawks: 0.75, skeletons: 1.2 }[e.card] || 1.4;
    const w = Math.max(0.8, e.radius * 1.9) * k, h = Math.max(5, k * 0.2), by = y - lift - top * k, bx = x - w / 2;
    A.rr(c, bx, by, w, h, h / 2); c.fillStyle = '#1b1430'; c.fill();
    A.rr(c, bx + 1, by + 1, Math.max(0, (w - 2) * e.hp / e.maxHp), h - 2, (h - 2) / 2); c.fillStyle = blue ? '#5aa9ff' : '#ff5f69'; c.fill();
    levelBadge(c, bx - h * 0.6, by + h / 2, h * 0.95, e.team, e.level);
  }
  function levelBadge(c, x, y, r, team, level) {
    A.rr(c, x - r, y - r, r * 2, r * 2, r * 0.45); c.fillStyle = team === 0 ? '#1a4ba8' : '#9e1f29'; c.fill();
    c.lineWidth = Math.max(1.5, r * 0.22); c.strokeStyle = A.OUT; c.stroke();
    c.font = `${Math.round(r * 1.5)}px "Lilita One", "Arial Black", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
    c.fillText(String(level || 1), x, y + 1);
  }
  function drawProj(c, p, alpha, t) {
    const k = G.k, px = p.px === undefined ? p.x : p.px + (p.x - p.px) * alpha, py = p.py === undefined ? p.y : p.py + (p.y - p.py) * alpha;
    const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, done = Math.min(1, Math.hypot(px - p.sx, py - p.sy) / total);
    const arcH = p.kind === 'snowball' ? 1.6 : p.kind === 'fireball' ? 2.2 : p.kind === 'cannon' ? 0.8 : 0.5;
    const lift = Math.sin(done * Math.PI) * arcH * Math.min(1, total / 6) + (p.air ? 1.1 : 0.6) * (1 - done);
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
    if (p.kind === 'arrow') {
      const ang = Math.atan2((p.ty - p.sy) * k, (p.tx - p.sx) * k);
      c.save(); c.translate(x, y); c.rotate(ang);
      A.line(c, -k * 0.35, 0, k * 0.25, 0, '#5a3a1f', Math.max(1.5, k * 0.06));
      A.poly(c, [k * 0.35, 0, k * 0.2, -k * 0.08, k * 0.2, k * 0.08]); c.fillStyle = '#dfe6ee'; c.fill();
      A.line(c, -k * 0.35, 0, -k * 0.45, -k * 0.07, '#fff', Math.max(1, k * 0.04));
      c.restore();
    } else if (p.kind === 'cannon') {
      A.circ(c, x, y, k * 0.2); A.paint(c, '#2a2c35', k * 0.05);
    } else if (p.kind === 'snowball') {
      shadow(c, SX(px), SY(py), k * 0.2);
      A.circ(c, x, y, k * 0.24); A.paint(c, '#ffffff', k * 0.06);
      A.circ(c, x - k * 0.07, y - k * 0.07, k * 0.07); c.fillStyle = '#dfe9f7'; c.fill();
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
        c.strokeStyle = f.team === 0 ? '#8cc4ff' : '#ff9ea4'; c.lineWidth = k * 0.12; c.stroke();
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
      } else if (f.kind === 'rock') {
        c.globalAlpha = Math.min(1, a * 2); A.circ(c, SX(f.x), SY(f.y) - f.z * k * 0.3, f.r * k); A.paint(c, f.col, k * 0.04);
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
    const s = G.s, k = G.k, p = snap(G.hover), card = KC_CARDS[id];
    const ok = S.canDeploy(s, 0, id, p.x, p.y), x = SX(p.x), y = SY(p.y);
    if (card.kind === 'spell') {
      A.ell(c, x, y, card.area * k, card.area * k * 0.62);
      c.fillStyle = 'rgba(255,140,40,0.22)'; c.fill(); c.strokeStyle = 'rgba(255,220,150,0.95)'; c.lineWidth = 2.5; c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]);
      return;
    }
    if (card.kind === 'building') {
      const hf = card.half;
      A.rr(c, SX(p.x - hf), SY(p.y - hf), hf * 2 * k, hf * 2 * k, k * 0.2);
      c.fillStyle = ok ? 'rgba(255,255,255,0.3)' : 'rgba(229,65,75,0.5)'; c.fill();
      c.globalAlpha = ok ? 0.65 : 0.35;
      c.save(); c.translate(x, y); A.cannon(c, k, { team: 0, angle: -Math.PI / 2 }); c.restore();
      c.globalAlpha = 1;
      A.ell(c, x, y, (card.range + card.radius) * k, (card.range + card.radius) * k);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.5; c.setLineDash([5, 6]); c.stroke(); c.setLineDash([]);
      return;
    }
    A.rr(c, SX(p.x - 0.5), SY(p.y - 0.5), k, k, k * 0.15);
    c.fillStyle = ok ? 'rgba(255,255,255,0.35)' : 'rgba(229,65,75,0.5)'; c.fill();
    c.globalAlpha = ok ? 0.6 : 0.35;
    const offs = card.count === 4 ? [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]] : card.count === 3 ? [[-0.55, 0.3], [0.55, 0.3], [0, -0.45]] : card.count === 2 ? [[-0.5, 0], [0.5, 0]] : [[0, 0]];
    for (const [ox, oy] of offs) {
      c.save(); c.translate(x + ox * k, y + oy * k - (card.air ? k * 1.1 : 0));
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
    if (u.fill !== fill) { u.fill = fill; $('#efill').style.height = fill; }
    const n = Math.floor(en);
    if (u.n !== n) { u.n = n; $('#enum').textContent = n; }
    const dbl = s.double || s.phase === 'overtime';
    if (u.dbl !== dbl) { u.dbl = dbl; $('#x2').hidden = !dbl; }
    document.querySelectorAll('.card').forEach(b => {
      const id = s.hands[0][+b.dataset.slot], cost = KC_CARDS[id].cost, p = Math.min(1, en / cost);
      b.classList.toggle('poor', en < cost);
      b.style.setProperty('--p', p.toFixed(3));
    });
    const left = Math.max(0, Math.ceil(s.timeLeft)), tl = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const ot = s.phase === 'overtime';
    if (u.tl !== tl || u.ot !== ot) {
      u.tl = tl; u.ot = ot;
      $('#timerVal').textContent = tl;
      $('#timerLabel').textContent = ot ? 'Overtime' : 'Time left';
      $('#timer').classList.toggle('ot', ot);
      $('#timer').classList.toggle('low', !ot && left <= 30);
      $('#miniTimer').innerHTML = `${ot ? 'Overtime' : 'Time'}<br>${tl}`;
    }
    const cr = s.crowns.join();
    if (u.cr !== cr) { u.cr = cr; $('#crownYou').textContent = s.crowns[0]; $('#crownFoe').textContent = s.crowns[1]; }
    if (G.phase === 'play' && left <= 10 && left > 0 && left !== G.lastSec) {
      G.lastSec = left;
      const cd = $('#countdown');
      cd.textContent = left; cd.hidden = false;
      cd.classList.remove('tick'); void cd.offsetWidth; cd.classList.add('tick');
      KCSound.play('tick');
    } else if (left > 10 && !$('#countdown').hidden) $('#countdown').hidden = true;
    if (G.phase === 'play' && !G.idleHint && s.time > 7 && s.played[0] === 0) {
      G.idleHint = true;
      say('Tip: drag a card from the left onto your side of the arena.', 4000);
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
      if (G.intro <= 0) begin();
    } else if (G.phase === 'play') {
      G.acc += dt;
      let n = 0;
      while (G.acc >= S.DT && n < 6 && G.phase === 'play') {
        S.step(G.s);
        KCBot.update(G.bot, G.s);
        handleEvents();
        G.acc -= S.DT; n++;
      }
      if (n === 6) G.acc = 0;
    } else if (G.phase === 'end') {
      G.ended -= dt;
      if (G.ended <= 0 && $('#result').hidden) showResult();
    }
    updateFx(dt);
    draw(G.phase === 'play' ? G.acc / S.DT : 1, now / 1000);
    ui();
  }

  function boot() {
    cv = $('#arena'); ctx = cv.getContext('2d');
    KCMenu.init({ onBattle: startBattle });
    KCScenery.make($('#sceneL'), 'left');
    KCScenery.make($('#sceneR'), 'right');
    bindInput();
    $('#againBtn').addEventListener('click', () => startBattle(G.trainer.kind === 'trophy' ? KCMenu.nextFoe('trophy') : G.trainer));
    $('#nextBtn').addEventListener('click', () => startBattle(G.res.unlockedNext));
    $('#homeBtn').addEventListener('click', goHome);
    $('#leaveBtn').addEventListener('click', () => { if (G.phase === 'play') { $('#leaveAsk').hidden = false; G.phase = 'paused'; } });
    // TEMPORARY test button: ends the match as a win, with the same rewards as a real one.
    $('#simWinBtn').addEventListener('click', () => {
      if (G.phase !== 'play' || !G.s || G.s.result) return;
      S.forceEnd(G.s, 0);
      handleEvents();
    });
    $('#leaveNo').addEventListener('click', () => { $('#leaveAsk').hidden = true; G.phase = 'play'; G.last = performance.now(); });
    $('#leaveYes').addEventListener('click', goHome);
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!$('#battle').hidden) layout(); }, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!$('#battle').hidden) layout(); });
    window.KingdomClash = { get state() { return G.s; }, G, startBattle };
    requestAnimationFrame(frame);
  }
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
