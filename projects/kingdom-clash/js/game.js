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
      evos: [KCProgress.evoList(), T.evos || []],
    });
    G.bot = KCBot.create(1, { skill: T.skill, seed: Math.floor(Math.random() * 1e9) });
    const where = trophy ? `${arenaNow.name} · ${T.tier}` : `Training Grounds · ${T.tier}`;
    for (const [sel, text] of [['#foeName', T.name], ['#foeTier', where], ['#scoreFoe', T.name], ['#introFoeName', T.name],
      ['#introFoeTier', trophy ? T.tier : `Level ${T.level} · ${T.tier}`], ['#resFoeName', T.name], ['#introYou', KCMenu.name]]) $(sel).textContent = text;
    A.trainer($('#introFoe'), T.look);
    Object.assign(G, { fx: [], embers: [], sel: -1, hover: null, acc: 0, ended: 0, lastSec: -1, handKey: '', zoneKey: '', idleHint: false, ui: {}, shake: 0 });
    $('#result').hidden = true; $('#leaveAsk').hidden = true; $('#bubble').hidden = true; $('#countdown').hidden = true;
    KCScenery.reset();
    KCEmotes.reset();
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
    setTimeout(() => speak('start'), 900);
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
    const s = G.s, hand = s.hands[0], evoKey = hand.concat(s.queues[0][0]).map(id => { const e = S.evoCharge(s, 0, id); return e ? e.n : ''; }).join();
    const key = hand.join() + '|' + s.queues[0][0] + '|' + evoKey;
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
      // an evolution's charge: a pip for each play counted, and the evolved card when the next is it
      const ev = S.evoCharge(s, 0, id);
      if (ev && ev.ready) b.classList.add('evo-ready');
      const pips = ev ? `<span class="evo-pips">${Array.from({ length: ev.cycle - 1 }, (_, j) => `<i class="${j < ev.n ? 'on' : ''}"></i>`).join('')}</span>` : '';
      b.innerHTML = `<img src="${ev && ev.ready ? KCMenu.cardImg(id, true) : cardImg(id)}" alt="${c.name}${ev && ev.ready ? ' (evolved)' : ''}"><span class="ready"></span><span class="key">${i + 1}</span><span class="cost">${c.cost}</span>${pips}`;
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
    const p = snap(w), c = KC_CARDS[id];
    if (!c || c.kind === 'spell' || S.canDeploy(G.s, 0, id, p.x, p.y)) return p;
    const key = `${id}|${p.x},${p.y}|${G.zoneKey}|${G.s.ents.filter(e => e.kind === 'building').map(e => e.id).join()}`;
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
  const SHOOT = { arrow: 'arrow', cannon: 'cannon', snowball: 'snow', bigsnow: 'snow', pot: 'potThrow' };
  function handleEvents() {
    const s = G.s;
    for (const e of s.events) {
      switch (e.type) {
        case 'deploy':
          KCSound.play('deploy');
          ring(e.x, e.y, e.team, 1.4);
          dust(e.x, e.y, 8);
          if (e.evo) {
            // an evolution arrives: a violet burst
            KCSound.play('evo');
            G.fx.push({ kind: 'evo', x: e.x, y: e.y, life: 0.9, max: 0.9 });
            sparks(e.x, e.y, 18, '#c9a8ff', 4); sparks(e.x, e.y, 10, '#7ff0ff', 3);
          }
          break;
        case 'cast': KCSound.play(e.card === 'spears' ? 'spearsCast' : e.card === 'sandstorm' ? 'sandstorm' : 'spell'); break;
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
        case 'charge':
          KCSound.play('smash'); G.shake = Math.max(G.shake, 0.22);
          sparks(e.x, e.y, 10, '#fff3c4', 4); puff(e.x, e.y, 8, '#e0c08a', 0.8);
          break;
        case 'shoot': KCSound.play(SHOOT[e.kind] || 'arrow'); break;
        case 'hit':
          if (e.card === 'gorilla' || e.card === 'rhino') { KCSound.play('smash'); G.shake = Math.max(G.shake, e.card === 'rhino' ? 0.12 : 0.18); sparks(e.x, e.y, 6, '#fff3c4'); }
          else if (e.kind === 'cannon') sparks(e.x, e.y, 5, '#ffd27a');
          else { KCSound.play('hit'); sparks(e.x, e.y, 3, '#ffffff'); }
          break;
        case 'splash':
          if (e.kind === 'pot') { KCSound.play('potBreak'); sparks(e.x, e.y, 10, '#d07a45', 3); puff(e.x, e.y, 6, '#c9a07a', e.r * 0.7); }
          else puff(e.x, e.y, 9, '#ffffff', e.r);
          break;
        case 'spin':
          KCSound.play('spin');
          G.fx.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, team: e.team, life: 0.3, max: 0.3 });
          sparks(e.x, e.y, 6, '#e4e9f0', 3);
          break;
        case 'death': KCSound.play('death'); puff(e.x, e.y - (e.air ? 1.1 : 0.3), 7, '#d9d4e8', 0.5); break;
        case 'boom':
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
      if (e.sub !== 'king') speak('youTower');
    } else {
      G.fx.push({ kind: 'crown', x: e.x, y: e.y, life: 1.6, max: 1.6, team: 1 });
      if (e.sub !== 'king') { speak('myTower'); KCEmotes.foeTookTower(); }
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
    G.res = KCMenu.recordResult(G.trainer, e.winner, G.s.crowns[0]);
    $('#countdown').hidden = true;
    if (e.winner === 0) { banner('Victory!'); setTimeout(() => KCSound.play('win'), 300); }
    else if (e.winner === 1) { banner('Defeat'); setTimeout(() => KCSound.play('lose'), 300); KCEmotes.foeWon(); }
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
    const notes = [res.unlockedNext ? `${res.unlockedNext.name} unlocked!` : '', res.roadOpened ? 'Trophy Road unlocked!' : '',
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
    if (e.tunnel) { tunnel(c, e, x, y, t); return; }
    if (e.card === 'mole' && e.deploy > 0) { surfacing(c, e, x, y, t); return; }
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
    const o = { team: e.team, t: t + e.id * 0.37, walk: e.moving, atk: Math.max(0, e.atk / 0.28), face: e.face, id: e.id, view: e.team === 0 ? 'back' : 'front', evo: e.evo };
    if (e.ram) o.power = Math.max(0, Math.min(1, (e.speed - e.baseSpeed) / (e.maxSpeed - e.baseSpeed)));
    if (e.rider) o.ratk = Math.max(0, e.rider.atk / 0.4);
    if (e.chargeHit) o.charged = e.run >= e.chargeHit;
    A.troop(c, e.card, k, o);
    c.restore();
    // dust behind a rolling cart and a galloping camel
    if (e.moving && e.deploy <= 0 && (e.ram || e.chargeHit) && Math.random() < (e.ram ? 0.25 + o.power * 0.5 : 0.4)) {
      const back = e.team === 0 ? 0.6 : -0.6;
      G.fx.push({ kind: 'puff', x: e.x + (Math.random() - 0.5) * 0.9, y: e.y + back * 0.5, vx: (Math.random() - 0.5) * 0.6, vy: back * 0.8, r: 0.16 + Math.random() * 0.2, col: 'rgba(226,196,138,0.75)', life: 0.5, max: 0.5 });
    }
    // a slowed troop: sand swirling round it, or the lasso round its legs
    if (e.slowEnd > G.s.time) {
      if (e.slowKind === 'lasso') {
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
    if (e.hp >= e.maxHp || e.deploy > 0) return;
    const lift = e.air ? k * 1.1 : 0, top = { rhino: 1.45, gorilla: 1.75, gladiator: 1.95, snowman: e.evo ? 2.35 : 2.0, archers: 1.55, wolves: 1.05, hawks: 0.75, skeletons: 1.2, footmen: 1.6, flail: 1.95, pots: 1.6, ramcart: 1.95, ramsoldier: 1.45, mole: 1.45, camel: 2.45 }[e.card] || 1.4;
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
  // Broken pottery on the ground: shards fading out as the damage ends.
  function drawZone2(c, z, k, t) {
    if (z.kind === 'sandstorm') { storm(c, z, k, t); return; }
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
  function drawProj(c, p, alpha, t) {
    const k = G.k, px = p.px === undefined ? p.x : p.px + (p.x - p.px) * alpha, py = p.py === undefined ? p.y : p.py + (p.y - p.py) * alpha;
    const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, done = Math.min(1, Math.hypot(px - p.sx, py - p.sy) / total);
    const arcH = p.kind === 'snowball' || p.kind === 'bigsnow' || p.kind === 'pot' ? 1.6 : p.kind === 'lasso' ? 1 : p.kind === 'fireball' ? 2.2 : p.kind === 'spears' ? 3 : p.kind === 'cannon' ? 0.8 : 0.5;
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
    if (p.kind === 'spears') {
      const r = KC_CARDS.spears.area;
      A.ell(c, SX(p.tx), SY(p.ty), r * k, r * k * 0.6);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.stroke();
      // the volley drops onto the area as it arrives
      c.save(); c.translate(SX(p.tx), SY(p.ty) - (1 - done) * k * 5);
      c.globalAlpha = Math.min(1, done * 3);
      A.spearsArt(c, k * 1.6, done);
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
    if (p.kind === 'arrow') {
      const ang = Math.atan2((p.ty - p.sy) * k, (p.tx - p.sx) * k);
      c.save(); c.translate(x, y); c.rotate(ang);
      A.line(c, -k * 0.35, 0, k * 0.25, 0, '#5a3a1f', Math.max(1.5, k * 0.06));
      A.poly(c, [k * 0.35, 0, k * 0.2, -k * 0.08, k * 0.2, k * 0.08]); c.fillStyle = '#dfe6ee'; c.fill();
      A.line(c, -k * 0.35, 0, -k * 0.45, -k * 0.07, '#fff', Math.max(1, k * 0.04));
      c.restore();
    } else if (p.kind === 'cannon') {
      A.circ(c, x, y, k * 0.2); A.paint(c, '#2a2c35', k * 0.05);
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
    const s = G.s, k = G.k, card = KC_CARDS[id], p = card.kind === 'spell' ? snap(G.hover) : placeAt(id, G.hover);
    const ok = S.canDeploy(s, 0, id, p.x, p.y), x = SX(p.x), y = SY(p.y);
    if (card.kind === 'spell') {
      A.ell(c, x, y, card.area * k, card.area * k * 0.62);
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
      c.save(); c.translate(x, y); A.troop(c, id, k, { team: 0, t, walk: false, atk: 0, face: 1, id: 1, view: 'back' }); c.restore();
      c.globalAlpha = 1;
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
    // emotes (js/emotes.js): a bubble beside each King Tower, placed in the arena box's pixels
    KCEmotes.mount($('#arenaBox'), {
      spot: team => { const cvs = $('#arena'); return { x: cvs.offsetLeft + SX(11.6), y: cvs.offsetTop + SY(team ? 3.4 : 28.4) }; },
      canEmote: () => !$('#battle').hidden && (G.phase === 'play' || G.phase === 'end') && $('#result').hidden,
      foeCanEmote: () => !$('#battle').hidden && $('#result').hidden && !!G.s,
      ended: () => G.phase === 'end',
      toast,
    });
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
