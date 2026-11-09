/* Kingdom Clash: the main menu. A top bar (account level, wallet, sound), a sidebar of tabs, the Battle
   stage (the Training Grounds, the trainer path, the Battle button) and side panels.

   The Training Grounds have no trophies: you beat Trainer Owen, then Romeo, then Luc, and beating all
   three opens the Trophy Road. Progress, your name, account experience and your record against each
   trainer are kept in this browser's local storage. The wallet (coins and diamonds), the Kingdom Pass,
   chests, the Shop, clans and events are shown in their locked or "coming" states until they exist. */
'use strict';

const KCMenu = (() => {
  const $ = q => document.querySelector(q), $$ = q => document.querySelectorAll(q);
  const KEY = 'kc.progress';
  const XP_PER_LEVEL = 100;
  const XP = { win: 20, draw: 10, loss: 6, firstWin: 30 };
  const imgs = {};
  let P = null, opts = {}, tabNow = 'battle';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: progress lasts this visit */ } },
  };
  const blank = () => ({ name: 'Player', xp: 0, beaten: {}, records: {}, roadSeen: false, opp: null });
  function load() {
    P = Object.assign(blank(), store.get(KEY, {}));
    const old = store.get('kc.record', null); // the record kept before there were three trainers
    if (old && !P.records.owen) { P.records.owen = old; if (old.w > 0) P.beaten.owen = true; }
    for (const t of KC_TRAINERS) P.records[t.id] = Object.assign({ w: 0, l: 0, d: 0 }, P.records[t.id]);
  }
  const save = () => store.set(KEY, P);

  const cardImg = id => imgs[id] || (imgs[id] = KCArt.portrait(id, 200, 240).toDataURL());
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  /* ---------- progress ---------- */
  const unlocked = id => { const i = KC_TRAINERS.findIndex(t => t.id === id); return i === 0 || !!P.beaten[KC_TRAINERS[i - 1].id]; };
  const nextTrainer = () => KC_TRAINERS.find(t => !P.beaten[t.id]) || null;
  const roadOpen = () => KC_TRAINERS.every(t => P.beaten[t.id]);
  function opponent() {
    if (P.opp && KC_TRAINER[P.opp] && unlocked(P.opp)) return KC_TRAINER[P.opp];
    return nextTrainer() || KC_TRAINERS[KC_TRAINERS.length - 1];
  }
  const level = () => 1 + Math.floor(P.xp / XP_PER_LEVEL);

  // Called by the game when a match ends. Returns what changed, for the result screen.
  function recordResult(id, winner) {
    const r = P.records[id], before = { level: level() };
    let xp = winner === 0 ? XP.win : winner === 1 ? XP.loss : XP.draw;
    if (winner === 0) r.w++; else if (winner === 1) r.l++; else r.d++;
    let unlockedNext = null, opened = false, firstWin = false;
    if (winner === 0 && !P.beaten[id]) {
      firstWin = true;
      xp += XP.firstWin;
      P.beaten[id] = true;
      const i = KC_TRAINERS.findIndex(t => t.id === id);
      unlockedNext = KC_TRAINERS[i + 1] || null;
      opened = !unlockedNext && roadOpen();
      if (unlockedNext) P.opp = unlockedNext.id;
    }
    P.xp += xp;
    save();
    return { xp, firstWin, unlockedNext, roadOpened: opened, levelUp: level() > before.level ? level() : 0 };
  }

  /* ---------- tabs ---------- */
  function tab(name) {
    tabNow = name;
    for (const b of $$('.nav-btn')) b.classList.toggle('on', b.dataset.tab === name);
    for (const s of $$('.stage .tab')) s.hidden = s.id !== 'tab-' + name;
    if (name === 'road' && roadOpen() && !P.roadSeen) { P.roadSeen = true; save(); }
    if (name === 'battle') requestAnimationFrame(drawHero);
    refresh();
  }

  /* ---------- the Battle tab ---------- */
  function buildPath() {
    const ol = $('#trainerPath');
    ol.innerHTML = '';
    KC_TRAINERS.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'node';
      li.dataset.id = t.id;
      li.innerHTML = `<button type="button" class="node-btn"><canvas width="132" height="132"></canvas><span class="node-mark" aria-hidden="true"></span></button>
        <b>${esc(t.short)}</b><small>Level ${t.level} &middot; ${esc(t.tier)}</small>`;
      li.querySelector('button').addEventListener('click', () => {
        if (!unlocked(t.id)) { pulse(li); return; }
        P.opp = t.id; save(); refresh();
      });
      ol.appendChild(li);
      if (i < KC_TRAINERS.length) {
        const link = document.createElement('li');
        link.className = 'link'; link.setAttribute('aria-hidden', 'true');
        ol.appendChild(link);
      }
    });
    const road = document.createElement('li');
    road.className = 'node road-node';
    road.innerHTML = `<button type="button" class="node-btn"><span class="road-icon" aria-hidden="true"></span><span class="node-mark" aria-hidden="true"></span></button><b>Trophy Road</b><small id="roadSmall">Beat all 3</small>`;
    road.querySelector('button').addEventListener('click', () => tab('road'));
    ol.appendChild(road);
  }
  function pulse(el) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }

  function buildOpp() {
    const sel = $('#oppSel');
    sel.innerHTML = KC_TRAINERS.map(t => `<option value="${t.id}">${esc(t.short)} · ${esc(t.tier)}</option>`).join('');
    sel.addEventListener('change', () => { P.opp = sel.value; save(); refresh(); });
  }

  // The arena under the title: the battlefield with its six towers, tilted back in 3D by CSS.
  function drawHero() {
    const cv = $('#heroArena'), box = $('#hero');
    if (!cv || !box || box.offsetParent === null) return;
    const H = box.clientHeight, B = 0.6, k = Math.max(6, (H * 1.42) / (KCSim.H + 2 * B));
    const w = Math.round((KCSim.W + 2 * B) * k), h = Math.round((KCSim.H + 2 * B) * k), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.dataset.size === `${w}x${h}@${dpr}`) return;
    cv.dataset.size = `${w}x${h}@${dpr}`;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    KCArt.arena(c, k, B);
    const towers = [[3.5, 6.5, 1, 'archer'], [14.5, 6.5, 1, 'archer'], [9, 3, 1, 'king'], [3.5, 25.5, 0, 'archer'], [14.5, 25.5, 0, 'archer'], [9, 29, 0, 'king']];
    for (const [x, y, team, sub] of towers) {
      c.save(); c.translate((x + B) * k, (y + B) * k);
      (sub === 'king' ? KCArt.kingTower : KCArt.archerTower)(c, k, { team, view: team ? 'front' : 'back', active: true, face: 1, t: 0 });
      c.restore();
    }
  }

  /* ---------- the Cards tab ---------- */
  function buildDeck() {
    const grid = $('#deckGrid');
    grid.innerHTML = '';
    for (const id of KC_STARTER_DECK) {
      const c = KC_CARDS[id], b = document.createElement('button');
      b.type = 'button'; b.className = 'deck-card'; b.dataset.id = id;
      b.innerHTML = `<img src="${cardImg(id)}" alt=""><span class="cost">${c.cost}</span><span class="nm">${esc(c.name)}</span>`;
      b.addEventListener('click', () => showInfo(id));
      grid.appendChild(b);
    }
    showInfo('rhino');
    $('#deckThumbs').innerHTML = KC_STARTER_DECK.slice(0, 3).map(id => `<img src="${cardImg(id)}" alt="">`).join('');
  }
  function showInfo(id) {
    const c = KC_CARDS[id];
    for (const b of $$('.deck-card')) b.classList.toggle('on', b.dataset.id === id);
    const tgt = { buildings: 'Towers only', ground: 'Ground', both: 'Air & ground' }[c.targets];
    const sp = s => (s >= 1.8 ? 'Very fast' : s >= 1.4 ? 'Fast' : s >= 1 ? 'Medium' : 'Slow');
    const stats = c.kind === 'spell'
      ? [['Damage', c.dmg], ['Tower damage', Math.round(c.dmg * c.towerPct)], ['Radius', c.area + ' tiles']]
      : [['Health', c.hp], ['Damage', c.dmg], ['Hit speed', c.hit + ' s'], ['Range', c.range < 1 ? 'Melee' : c.range + ' tiles'],
        ['Speed', sp(c.speed)], ['Targets', tgt]].concat(c.count > 1 ? [['Count', '×' + c.count]] : []);
    $('#cardInfo').innerHTML = `<h4>${esc(c.name)}</h4>
      <div class="meta">${c.rarity} &middot; ${esc(c.role)} &middot; ${c.cost} energy${c.air ? ' &middot; flying' : ''}</div>
      <p>${esc(c.blurb)}</p>
      <div class="stats">${stats.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>
      <div class="evo">Evolution (unlocks later): ${esc(c.evo)}</div>`;
  }

  /* ---------- keeping everything current ---------- */
  function refresh() {
    if (!P) return;
    const beaten = KC_TRAINERS.filter(t => P.beaten[t.id]).length, opp = opponent(), next = nextTrainer(), open = roadOpen();
    $('#playerName').textContent = P.name;
    const lv = level(), into = P.xp % XP_PER_LEVEL;
    $('#lvlNum').textContent = lv;
    $('#xpFill').style.width = (into / XP_PER_LEVEL * 100).toFixed(1) + '%';
    $('#xpText').textContent = `${into} / ${XP_PER_LEVEL}`;
    $('#trainersBeaten').textContent = open ? 'All 3 trainers beaten' : `${beaten} of ${KC_TRAINERS.length} trainers beaten`;
    $('#apFill').style.width = (beaten / KC_TRAINERS.length * 100) + '%';
    $('#nextGoal').textContent = next ? `Beat ${next.name}` : 'Trophy Road unlocked';
    $('#battleSub').textContent = `vs ${opp.name}`;
    const sel = $('#oppSel');
    for (const o of sel.options) { o.disabled = !unlocked(o.value); o.textContent = `${KC_TRAINER[o.value].short} · ${o.disabled ? 'Locked' : P.beaten[o.value] ? 'Beaten' : KC_TRAINER[o.value].tier}`; }
    sel.value = opp.id;
    for (const li of $$('#trainerPath .node[data-id]')) {
      const t = KC_TRAINER[li.dataset.id], lock = !unlocked(t.id);
      li.classList.toggle('beaten', !!P.beaten[t.id]);
      li.classList.toggle('locked', lock);
      li.classList.toggle('current', t.id === opp.id);
      const cvs = li.querySelector('canvas');
      if (cvs.dataset.state !== String(lock)) { cvs.dataset.state = String(lock); KCArt.trainer(cvs, t.look, lock); }
      li.querySelector('button').setAttribute('aria-label', `${t.name}, ${lock ? 'locked' : P.beaten[t.id] ? 'beaten' : 'not beaten yet'}`);
    }
    const links = $$('#trainerPath .link');
    links.forEach((l, i) => l.classList.toggle('done', !!P.beaten[KC_TRAINERS[i].id]));
    const rn = $('#trainerPath .road-node');
    if (rn) { rn.classList.toggle('locked', !open); rn.classList.toggle('beaten', open); $('#roadSmall').textContent = open ? 'Unlocked' : `Beat all ${KC_TRAINERS.length}`; }
    // Trophy Road tab and its sidebar tag
    const tag = $('#roadTag');
    tag.textContent = open ? (P.roadSeen ? 'Open' : 'New!') : 'Locked';
    tag.className = 'nav-tag' + (open ? (P.roadSeen ? ' open' : ' new') : '');
    $('#tab-road').classList.toggle('open', open);
    $('#roadTitle').textContent = open ? 'Trophy Road unlocked!' : 'Trophy Road is locked';
    $('#roadText').textContent = open
      ? 'You beat every trainer in the Training Grounds. Trophy battles, new arenas and chests arrive in the next update.'
      : `Beat all three Training Grounds trainers to open it. ${next ? `Next up: ${next.name}.` : ''}`;
    $('#roadList').innerHTML = KC_TRAINERS.map(t => `<li class="${P.beaten[t.id] ? 'done' : ''}"><span>${esc(t.name)}</span><b>${P.beaten[t.id] ? 'Beaten' : unlocked(t.id) ? 'Not yet' : 'Locked'}</b></li>`).join('');
    // records
    $('#records').innerHTML = KC_TRAINERS.map(t => {
      const r = P.records[t.id], n = r.w + r.l + r.d;
      return `<li class="${unlocked(t.id) ? '' : 'dim'}"><span>${esc(t.short)}</span><b>${n ? `${r.w}W &middot; ${r.l}L${r.d ? ` &middot; ${r.d}D` : ''}` : unlocked(t.id) ? 'No matches yet' : 'Locked'}</b></li>`;
    }).join('');
    $('#soundBtn').setAttribute('aria-label', KCSound.on ? 'Sound on' : 'Sound off');
    $('#soundBtn').classList.toggle('off', !KCSound.on);
  }

  function init(o) {
    opts = o || {};
    load();
    buildPath(); buildOpp(); buildDeck();
    const L = KCScenery.SRC;
    $('#heroL').style.backgroundImage = `url("${L.left}")`;
    $('#heroR').style.backgroundImage = `url("${L.right}")`;
    for (const b of $$('[data-tab]')) b.addEventListener('click', () => tab(b.dataset.tab));
    $('#battleBtn').addEventListener('click', () => opts.onBattle && opts.onBattle(opponent().id));
    $('#deckBtn').addEventListener('click', () => tab('cards'));
    $('#soundBtn').addEventListener('click', () => { KCSound.on = !KCSound.on; refresh(); });
    $('#editName').addEventListener('click', () => {
      $('#nameForm').hidden = false; $('#editName').hidden = true;
      const i = $('#nameInput'); i.value = P.name; i.focus(); i.select();
    });
    $('#nameForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 16);
      if (v) P.name = v;
      save();
      $('#nameForm').hidden = true; $('#editName').hidden = false;
      refresh();
    });
    window.addEventListener('keydown', e => {
      if ($('#home').hidden || e.repeat || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
      const n = '123456'.indexOf(e.key);
      if (n >= 0) { tab(['battle', 'cards', 'road', 'shop', 'clan', 'events'][n]); e.preventDefault(); }
      else if (e.key === 'Enter' && tabNow === 'battle' && document.activeElement === document.body) { opts.onBattle && opts.onBattle(opponent().id); e.preventDefault(); }
    });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawHero, 150); });
    refresh();
    requestAnimationFrame(drawHero);
  }

  return {
    init, refresh, recordResult, opponent, cardImg, tab,
    get name() { return P ? P.name : 'Player'; },
    show() { refresh(); requestAnimationFrame(drawHero); },
  };
})();
