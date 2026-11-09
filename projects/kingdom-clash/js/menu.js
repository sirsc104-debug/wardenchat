/* Kingdom Clash: the lobby. A top bar (name, level and experience, coins and diamonds, sound,
   settings), the tabs (Battle, Cards, Trophy Road, Shop, Clan) and a bottom navigation bar.

   The Battle tab is built around the Training Grounds centerpiece image (img/training-grounds.webp,
   transparent). Its empty bar is filled here, over the image, from the player's progress: the Training
   Grounds have no trophies, you beat Trainer Owen, then Romeo, then Luc, and beating all three opens
   the Trophy Road. Under it are the opponent (with a panel of all three trainers and your records),
   the Battle button and four chest slots.

   Progress, your name, account experience and your record against each trainer are kept in this
   browser's local storage under kc.progress. The wallet, Kingdom Pass, chests, Shop and clans are shown
   locked or "coming" until they exist. */
'use strict';

const KCMenu = (() => {
  const $ = q => document.querySelector(q), $$ = q => document.querySelectorAll(q);
  const KEY = 'kc.progress';
  const CENTERPIECE = 'img/training-grounds.webp';
  const XP_PER_LEVEL = 100;
  const XP = { win: 20, draw: 10, loss: 6, firstWin: 30 };
  const TABS = ['shop', 'cards', 'battle', 'clan', 'road'];
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
  const beatenCount = () => KC_TRAINERS.filter(t => P.beaten[t.id]).length;
  function opponent() {
    if (P.opp && KC_TRAINER[P.opp] && unlocked(P.opp)) return KC_TRAINER[P.opp];
    return nextTrainer() || KC_TRAINERS[KC_TRAINERS.length - 1];
  }
  const level = () => 1 + Math.floor(P.xp / XP_PER_LEVEL);
  const recText = r => (r.w + r.l + r.d ? `${r.w}W · ${r.l}L${r.d ? ` · ${r.d}D` : ''}` : 'No matches yet');

  // Called by the game when a match ends. Returns what changed, for the result screen.
  function recordResult(id, winner) {
    const r = P.records[id], before = level();
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
    return { xp, firstWin, unlockedNext, roadOpened: opened, levelUp: level() > before ? level() : 0 };
  }

  /* ---------- tabs and popovers ---------- */
  function tab(name) {
    if (!TABS.includes(name)) return;
    tabNow = name;
    closePops();
    for (const b of $$('.nb')) { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); }
    for (const s of $$('.lobby-main .tab')) s.hidden = s.id !== 'tab-' + name;
    if (name === 'road' && roadOpen() && !P.roadSeen) { P.roadSeen = true; save(); }
    refresh();
  }
  function closePops() {
    $('#oppPanel').hidden = true; $('#oppChange').setAttribute('aria-expanded', 'false');
    $('#settings').hidden = true; $('#settingsBtn').setAttribute('aria-expanded', 'false');
  }
  function toggle(panel, btn) {
    const open = $(panel).hidden;
    closePops();
    $(panel).hidden = !open;
    $(btn).setAttribute('aria-expanded', String(open));
    return open;
  }

  /* ---------- the Battle tab ---------- */
  function choose(id) {
    if (!unlocked(id)) return;
    P.opp = id; save(); closePops(); refresh();
  }
  // Four chest slots. Each slot is { state: 'locked' | 'empty' | 'chest' | 'unlocking' | 'ready', name, time }.
  // Chests don't exist yet, so every slot stays locked until the Trophy Road brings them.
  function chestSlots() { return [0, 1, 2, 3].map(() => ({ state: 'locked' })); }
  const CHEST_SVG = '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M6 22h52v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#a8632c" stroke="#1c1530" stroke-width="3"/><path d="M6 22c0-11 8-18 26-18s26 7 26 18z" fill="#c97a36" stroke="#1c1530" stroke-width="3"/><path d="M6 22h52v6H6z" fill="#ffcf3f" stroke="#1c1530" stroke-width="3"/><rect x="27" y="22" width="10" height="13" rx="2" fill="#ffcf3f" stroke="#1c1530" stroke-width="3"/></svg>';
  function renderChests() {
    const slots = chestSlots();
    $('#chests').innerHTML = slots.map((sl, i) => {
      const label = { locked: 'Locked', empty: 'Empty slot', chest: 'Tap to unlock', unlocking: sl.time || 'Unlocking', ready: 'Open!' }[sl.state];
      const inner = sl.state === 'locked' ? '<span class="slot-lock" aria-hidden="true"></span>' : sl.state === 'empty' ? '' : CHEST_SVG;
      return `<div class="slot ${sl.state}" aria-label="Chest slot ${i + 1}: ${label}">${inner}<small>${label}</small></div>`;
    }).join('') + '<p class="chest-note">Chests unlock with the Trophy Road</p>';
  }

  /* ---------- the Cards tab ---------- */
  function buildCards() {
    const deck = KC_STARTER_DECK;
    const avg = deck.reduce((a, id) => a + KC_CARDS[id].cost, 0) / deck.length;
    $('#avgCost').textContent = avg.toFixed(1);
    $('#deckRow').innerHTML = deck.map(id => {
      const c = KC_CARDS[id];
      return `<button type="button" class="mini-card ${c.rarity}" data-id="${id}" title="${esc(c.name)}"><img src="${cardImg(id)}" alt="${esc(c.name)}"><span class="cost">${c.cost}</span><span class="lvl-strip">Level 1</span></button>`;
    }).join('');
    const all = Object.keys(KC_CARDS);
    $('#foundCount').textContent = `${all.length} / ${all.length} found`;
    $('#collGrid').innerHTML = all.map(id => {
      const c = KC_CARDS[id];
      return `<button type="button" class="coll-card ${c.rarity}" data-id="${id}"><span class="cc-art"><img src="${cardImg(id)}" alt=""><span class="cost">${c.cost}</span>${deck.includes(id) ? '<span class="in-deck" title="In your deck">In deck</span>' : ''}</span>
        <b>${esc(c.name)}</b><span class="rar">${c.rarity}</span><span class="lvl-strip">Level 1</span></button>`;
    }).join('');
    for (const b of $$('.mini-card, .coll-card')) b.addEventListener('click', () => openCard(b.dataset.id));
  }
  let lastFocus = null;
  function openCard(id) {
    const c = KC_CARDS[id];
    lastFocus = document.activeElement;
    $('#mImg').src = cardImg(id);
    $('#mCost').textContent = c.cost;
    $('#mName').textContent = c.name;
    $('#mTags').innerHTML = [`<span class="rar ${c.rarity}">${c.rarity}</span>`, `<span>${esc(c.role)}</span>`, `<span>${c.kind === 'spell' ? 'Spell' : c.air ? 'Flying troop' : 'Troop'}</span>`, '<span>Level 1</span>'].join('');
    $('#mBlurb').textContent = c.blurb;
    const tgt = { buildings: 'Towers only', ground: 'Ground', both: 'Air & ground' }[c.targets];
    const sp = s => (s >= 1.8 ? 'Very fast' : s >= 1.4 ? 'Fast' : s >= 1 ? 'Medium' : 'Slow');
    const stats = c.kind === 'spell'
      ? [['Damage', c.dmg], ['Tower damage', Math.round(c.dmg * c.towerPct)], ['Radius', c.area + ' tiles'], ['Energy', c.cost]]
      : [['Health', c.hp], ['Damage', c.dmg], ['Hit speed', c.hit + ' s'], ['Range', c.range < 1 ? 'Melee' : c.range + ' tiles'],
        ['Speed', sp(c.speed)], ['Targets', tgt], ['Energy', c.cost]].concat(c.count > 1 ? [['Count', '×' + c.count]] : []);
    $('#mStats').innerHTML = stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    $('#mEvo').textContent = c.evo;
    $('#cardModal').hidden = false;
    $('#modalX').focus();
  }
  function closeCard() {
    if ($('#cardModal').hidden) return;
    $('#cardModal').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- keeping everything current ---------- */
  function refresh() {
    if (!P) return;
    const n = beatenCount(), total = KC_TRAINERS.length, opp = opponent(), next = nextTrainer(), open = roadOpen();
    // top bar
    $('#playerName').textContent = P.name;
    const into = P.xp % XP_PER_LEVEL;
    $('#lvlNum').textContent = level();
    $('#xpFill').style.width = (into / XP_PER_LEVEL * 100).toFixed(1) + '%';
    $('#xpText').textContent = `${into} / ${XP_PER_LEVEL}`;
    $('#soundBtn').setAttribute('aria-label', KCSound.on ? 'Sound on' : 'Sound off');
    $('#soundBtn').classList.toggle('off', !KCSound.on);
    $('#soundToggle').checked = KCSound.on;
    // the centerpiece's bar
    $('#cpFill').style.width = (n / total * 100).toFixed(1) + '%';
    $('#cpText').textContent = `${n} / ${total} Trainers Defeated`;
    $('#cpBar').setAttribute('aria-valuenow', String(n));
    $('#cpBar').classList.toggle('full', open);
    // opponent
    const rec = P.records[opp.id];
    $('#oppLabel').textContent = open ? 'Trophy Road Unlocked!' : next && opp.id === next.id ? 'Next Opponent' : 'Rematch';
    $('#opp').classList.toggle('done', open);
    $('#oppName').textContent = opp.name;
    $('#oppMeta').textContent = `Level ${opp.level} · ${opp.tier} · ${recText(rec)}`;
    const pic = $('#oppPic');
    if (pic.dataset.id !== opp.id) { pic.dataset.id = opp.id; KCArt.trainer(pic, opp.look); }
    $('#battleSub').textContent = `vs ${opp.name}`;
    $('#oppList').innerHTML = KC_TRAINERS.map(t => {
      const lock = !unlocked(t.id), st = lock ? 'Locked' : P.beaten[t.id] ? 'Beaten' : 'Not beaten yet';
      return `<li><button type="button" class="opp-item${t.id === opp.id ? ' on' : ''}${lock ? ' locked' : ''}" data-id="${t.id}" ${lock ? 'aria-disabled="true"' : ''}>
        <canvas width="88" height="88" data-look="${t.id}" aria-hidden="true"></canvas>
        <span class="oi-text"><b>${esc(t.name)}</b><small>Level ${t.level} · ${esc(t.tier)} · ${st}</small><small>${lock ? esc(`Beat ${KC_TRAINERS[KC_TRAINERS.indexOf(t) - 1].name} to unlock`) : esc(recText(P.records[t.id]))}</small></span>
        ${P.beaten[t.id] ? '<span class="oi-check" aria-hidden="true"></span>' : lock ? '<span class="oi-lock" aria-hidden="true"></span>' : ''}</button></li>`;
    }).join('');
    for (const cvs of $$('#oppList canvas')) KCArt.trainer(cvs, KC_TRAINER[cvs.dataset.look].look, !unlocked(cvs.dataset.look));
    for (const b of $$('#oppList .opp-item')) b.addEventListener('click', () => choose(b.dataset.id));
    // side plaques
    $('#rewards').innerHTML = KC_TRAINERS.map((t, i) => {
      const prize = KC_TRAINERS[i + 1] ? `Unlocks ${KC_TRAINERS[i + 1].short}` : 'Opens the Trophy Road';
      return `<li class="${P.beaten[t.id] ? 'done' : unlocked(t.id) ? 'now' : 'later'}"><span class="rw-mark" aria-hidden="true"></span><span><b>Beat ${esc(t.short)}</b><small>${prize} · +30 XP</small></span></li>`;
    }).join('');
    const ups = [
      next ? [`Trainer ${next.short}`, KC_TRAINERS.indexOf(next) === 0 ? 'Ready now' : 'Ready now'] : null,
      ...KC_TRAINERS.filter(t => !unlocked(t.id)).map(t => [t.name, `Beat ${KC_TRAINERS[KC_TRAINERS.indexOf(t) - 1].short}`]),
      ['Trophy Road', open ? 'Unlocked' : 'Beat all 3 trainers'],
      ['Chests & Kingdom Pass', 'On the Trophy Road'],
      ['Shop & Clans', 'Coming soon'],
    ].filter(Boolean);
    $('#unlocks').innerHTML = ups.map(([a, b]) => `<li><b>${esc(a)}</b><small>${esc(b)}</small></li>`).join('');
    // Trophy Road tab and its nav tag
    const tag = $('#roadTag');
    tag.textContent = open ? (P.roadSeen ? 'Open' : 'New!') : 'Locked';
    tag.className = 'nb-tag' + (open ? (P.roadSeen ? ' open' : ' new') : ' lock');
    $('#tab-road').classList.toggle('open', open);
    $('#roadTitle').textContent = open ? 'Trophy Road unlocked!' : 'Trophy Road is locked';
    $('#roadText').textContent = open
      ? 'You beat every trainer in the Training Grounds. Trophy battles, new arenas and chests arrive in the next update.'
      : `Beat all three Training Grounds trainers to open it.${next ? ` Next up: ${next.name}.` : ''}`;
    $('#roadList').innerHTML = KC_TRAINERS.map(t => `<li class="${P.beaten[t.id] ? 'done' : ''}"><span>${esc(t.name)}</span><b>${P.beaten[t.id] ? 'Beaten' : unlocked(t.id) ? 'Not yet' : 'Locked'}</b></li>`).join('');
  }

  function init(o) {
    opts = o || {};
    load();
    $('#cpImg').src = CENTERPIECE;
    buildCards();
    renderChests();
    for (const b of $$('[data-tab]')) b.addEventListener('click', () => tab(b.dataset.tab));
    $('#battleBtn').addEventListener('click', () => opts.onBattle && opts.onBattle(opponent().id));
    $('#oppChange').addEventListener('click', e => { e.stopPropagation(); toggle('#oppPanel', '#oppChange'); });
    $('#settingsBtn').addEventListener('click', e => {
      e.stopPropagation();
      if (toggle('#settings', '#settingsBtn')) { const i = $('#nameInput'); i.value = P.name; }
    });
    $('#whoBtn').addEventListener('click', e => {
      e.stopPropagation();
      if ($('#settings').hidden) toggle('#settings', '#settingsBtn');
      const i = $('#nameInput'); i.value = P.name; i.focus(); i.select();
    });
    for (const el of ['#settings', '#oppPanel']) $(el).addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => closePops());
    $('#soundBtn').addEventListener('click', () => { KCSound.on = !KCSound.on; refresh(); });
    $('#soundToggle').addEventListener('change', e => { KCSound.on = e.target.checked; refresh(); });
    $('#nameForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 16);
      if (v) P.name = v;
      save(); closePops(); refresh();
    });
    $('#modalX').addEventListener('click', closeCard);
    $('#cardModal').addEventListener('click', e => { if (e.target.id === 'cardModal') closeCard(); });
    window.addEventListener('keydown', e => {
      if ($('#home').hidden || e.repeat) return;
      if (e.key === 'Escape') { closeCard(); closePops(); return; }
      if (!$('#cardModal').hidden || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
      const n = '12345'.indexOf(e.key);
      if (n >= 0) { tab(TABS[n]); e.preventDefault(); }
      else if (e.key === 'Enter' && tabNow === 'battle' && (document.activeElement === document.body || !document.activeElement)) { opts.onBattle && opts.onBattle(opponent().id); e.preventDefault(); }
    });
    refresh();
  }

  return {
    init, refresh, recordResult, opponent, cardImg, tab,
    get name() { return P ? P.name : 'Player'; },
    show() { refresh(); },
  };
})();
