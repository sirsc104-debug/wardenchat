/* Putt Club: rounds, difficulties, rivals, scoring, the camera, controls and the screens around the 3D view. */
(function (PC) {
  'use strict';
  const U = PC.U, C = PC.C;
  const $ = id => document.getElementById(id);
  const KEY = 'puttclub.v1';

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = Object.assign({ best: {}, holeBest: {}, aces: 0, rounds: 0, sfx: true, music: true }, load());
  // Bests from before difficulties existed were played on what is now Medium.
  ['3', '9', '18'].forEach(n => { if (save.best[n] && !save.best[n + '-medium']) save.best[n + '-medium'] = save.best[n]; delete save.best[n]; });
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } };

  // The four difficulties, each on its own course: Owen in the Garden, Medium in the Canyon, Hard in the Winter Wonderland, Ultra in the Abyss.
  const DIFFS = {
    owen: { id: 'owen', name: 'OWEN', icon: '🐣', cls: 'mode-easy', course: 'garden', guide: 'full', assist: 1.7, rivals: ['Owen', 'Clover', 'Fern'], info: 'See the whole putt<br>and a friendlier cup' },
    medium: { id: 'medium', name: 'MEDIUM', icon: '🌵', cls: 'mode-medium', course: 'canyon', guide: 'bounce', assist: 1, rivals: ['Fern', 'Bramble', 'Blaze'], info: 'Cacti pop your ball,<br>aim to the 1st bounce' },
    hard: { id: 'hard', name: 'HARD', icon: '❄️', cls: 'mode-hard', course: 'winter', guide: 'short', assist: 1, rivals: ['Bramble', 'Blaze', 'Thorn'], info: 'Ice and thin ice,<br>a short aim line' },
    ultra: { id: 'ultra', name: 'ULTRA', icon: '👹', cls: 'mode-ultra', course: 'abyss', guide: 'none', assist: 1, rivals: ['Thorn', 'Cinder', 'SirSC'], info: 'No guide, no rails,<br>par 6 and up' },
  };
  const ORDER = ['owen', 'medium', 'hard', 'ultra'];
  const COURSE = { garden: 'Garden', canyon: 'Canyon', winter: 'Wonderland', abyss: 'Abyss' };
  const poolOf = course => ({ abyss: PC.ABYSS, canyon: PC.CANYON, winter: PC.WINTER })[course] || PC.HOLES;

  const world = new PC.World($('view'));
  const audio = new PC.Audio(save);
  const rivals = new PC.Rivals();
  const raycaster = new THREE.Raycaster();

  let state = 'title';
  let round = null;            // { ids, idx, diff, practice, players: [{ name, you, color, skill, scores }] }
  let sim = null, hole = null, D = DIFFS.medium;
  let strokes = 0, shotLive = false, finished = false;
  let waitT = 0, timeScale = 1;
  let aim = null;
  const kb = { on: false, angle: Math.PI / 2, power: 0.45, rot: 0, pw: 0, fine: false };
  const pointers = new Map();
  let orbit = null;
  const cam = { mode: 'follow', aimAz: Math.PI / 2, overAz: Math.PI / 2, zoom: 1, cur: null, t0: 0 };
  let clock = 0, acc = 0, last = performance.now();
  let gustWas = 0, hudT = 0;
  let menuTab = (() => { try { return localStorage.getItem('puttclub.tab') || '9'; } catch (e) { return '9'; } })();
  if (!['9', '18', 'online'].includes(menuTab)) menuTab = '9';
  let timers = [];
  const later = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // ---------- holes ----------
  function loadHole(spec, diff) {
    hole = PC.prepareHole(spec);
    D = diff || DIFFS.medium;
    sim = new PC.Sim(hole, { assist: D.assist });
    world.build(hole, sim);
    strokes = 0; shotLive = false; finished = false; waitT = 0; timeScale = 1;
    aim = null; kb.on = false; world.hideAim();
    cam.aimAz = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    kb.angle = cam.aimAz;
    cam.overAz = cam.aimAz;
    cam.mode = 'follow';
    guideCache = null;
  }

  function newPlayers(diff) {
    return [{ name: 'You', you: true, color: '#ffffff', scores: [] }].concat(DIFFS[diff].rivals.map(n => ({ name: n, color: PC.RIVALS[n].color, skill: PC.RIVALS[n].skill, scores: [] })));
  }

  function startRound(n, diff) {
    const pool = poolOf(DIFFS[diff].course);
    const ids = U.shuffle(pool.map(h => h.id)).slice(0, n);
    round = { ids, idx: 0, diff, practice: false, players: newPlayers(diff) };
    beginHole();
  }

  function startPractice(id) {
    const spec = PC.holeById(id);
    round = { ids: [id], idx: 0, diff: spec.course === 'abyss' ? 'ultra' : spec.course === 'winter' ? 'hard' : 'medium', practice: true, players: [{ name: 'You', you: true, color: '#ffffff', scores: [] }] };
    beginHole();
  }

  function beginHole() {
    clearTimers();
    show(null);
    round.waiting = false;
    const spec = PC.holeById(round.ids[round.idx]);
    loadHole(spec, DIFFS[round.diff]);
    if (!round.practice) {
      const roster = round.players.filter(p => !p.you).map(p => ({ name: p.name, color: p.color, skill: p.skill }));
      world.setGhosts(rivals.setHole(hole, roster, { assist: 1 }));
    } else rivals.clear();
    cam.cur = overviewCam();
    cam.cur.el = 1.25; cam.cur.dist *= 1.25;
    cam.t0 = clock;
    state = 'intro';
    $('hud').hidden = false;
    $('waitBar').hidden = true;
    $('feed').innerHTML = '';
    document.body.classList.toggle('abyss', hole.course === 'abyss');
    document.body.classList.toggle('canyon', hole.course === 'canyon');
    document.body.classList.toggle('winter', hole.course === 'winter');
    updateHud();
    const it = $('intro');
    $('introNo').textContent = round.practice ? `Practice · ${COURSE[hole.course] || 'Garden'} hole ${hole.num}` : `Hole ${round.idx + 1} of ${round.ids.length} · ${DIFFS[round.diff].name}`;
    $('introName').textContent = hole.name;
    $('introSpecial').textContent = hole.special;
    $('introTip').textContent = hole.tip;
    $('introPar').textContent = 'Par ' + hole.par;
    $('introRivals').textContent = round.practice ? '' : 'Against ' + listNames(round.players.filter(p => !p.you).map(p => p.name));
    it.hidden = false;
    it.classList.remove('out');
    later(6500, () => { if (state === 'intro') go(); });
  }

  function listNames(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  function go() {
    if (state !== 'intro') return;
    state = 'play';
    $('intro').classList.add('out');
    later(350, () => { $('intro').hidden = true; });
    $('hint').classList.toggle('gone', save.rounds > 0 && round.idx > 0);
  }

  // ---------- scoring ----------
  function label(s, par) {
    if (s === 1) return 'Hole in one!';
    const d = s - par;
    return d <= -3 ? 'Albatross!' : d === -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : d === 3 ? 'Triple bogey' : '+' + d;
  }
  const vsPar = d => (d === 0 ? 'E' : d > 0 ? '+' + d : '−' + Math.abs(d));
  function totalsFor(p, upto) {
    let s = 0, par = 0;
    const n = upto === undefined ? p.scores.length : upto;
    for (let i = 0; i < n; i++) if (p.scores[i] !== undefined) { s += p.scores[i]; par += PC.holeById(round.ids[i]).par; }
    return { s, p: par, d: s - par };
  }
  const you = () => round.players[0];

  function holeOut(picked) {
    if (finished) return;
    finished = true;
    const max = PC.maxStrokes(hole);
    const score = picked ? max : Math.max(1, strokes);
    you().scores[round.idx] = score;
    const prev = save.holeBest[hole.id];
    if (!picked && (!prev || score < prev)) save.holeBest[hole.id] = score;
    if (score === 1) save.aces = (save.aces || 0) + 1;
    persist();
    const d = score - hole.par;
    const cp = sim.cupPos(), h = sim.floorHeight(cp[0], cp[1]);
    if (!picked) world.burst(score === 1 ? 'ace' : 'sink', cp[0], cp[1], h);
    audio.play(score === 1 ? 'ace' : d < 0 ? 'good' : d === 0 ? 'par' : 'meh');
    toast(picked ? 'Picked up' : label(score, hole.par), picked ? `${max} strokes is the most on this hole` : `${score} stroke${score === 1 ? '' : 's'} · ${vsPar(d)}${!picked && prev && score < prev ? ' · your best here' : ''}`, score === 1 || d < 0 ? 'good' : d === 0 ? 'even' : 'bad');
    updateHud();
    if (round.practice || rivals.allDone()) later(score === 1 ? 2600 : 1900, showCard);
    else { round.waiting = true; later(1600, () => { if (state === 'play' && round.waiting) { timeScale = 3; showWaiting(); } }); }
  }

  function showWaiting() {
    const left = rivals.list.filter(r => !r.done).map(r => r.name);
    if (!left.length) { $('waitBar').hidden = true; return; }
    $('waitText').textContent = `Waiting for ${listNames(left)}…`;
    $('waitBar').hidden = false;
  }

  // Was the ball lost through a sheet of thin ice?
  function throughIce(e) { const f = sim && sim.feats.find(q => q.type === 'thinice'); return !!(f && e && f.spec.list.some(q => U.inPoly(e.x, e.y, U.ccw(q.poly || q)))); }
  function lostMsg(kind, e) {
    if (kind === 'water' && throughIce(e)) return 'Through the ice!';
    return kind === 'water' ? 'Splash!' : kind === 'flowers' ? 'Into the flowers!' : kind === 'lava' ? 'Melted!' : kind === 'cactus' ? 'Popped!' : kind === 'chasm' && hole.course === 'canyon' ? 'Into the gulch!' : kind === 'chasm' && hole.course === 'winter' ? 'Over the edge!' : hole.course === 'abyss' ? 'Into the abyss!' : 'Off the course!';
  }

  function lost(e) {
    const kind = e.kind;
    if (kind === 'water') { world.burst('splash', e.x, e.y, C.WATER_TOP); audio.play('splash'); }
    else if (kind === 'lava') { world.burst('spark', e.x, e.y, sim.floorHeight(e.x, e.y), { color: '#ff8a2a', n: 40 }); audio.play('splash'); }
    else if (kind === 'cactus') { const h = sim.ball.z; world.burst('spark', e.x, e.y, h, { color: '#ffffff', n: 30 }); world.burst('puff', e.x, e.y, h - 0.1, { color: '#f4f0dc', n: 12 }); audio.play('pop'); }
    else if (kind === 'chasm' && hole.course === 'canyon') { world.burst('puff', e.x, e.y, -0.4, { color: '#d8b88a', n: 20 }); audio.play('flowers'); }
    else { world.burst('puff', e.x, e.y, -0.2, { color: kind === 'flowers' ? '#ffb3c6' : '#e9e1cf', n: 20 }); audio.play('flowers'); }
    strokes += 1;
    updateHud();
    toast(lostMsg(kind, e), 'One penalty stroke. Back to where you putted from.', 'bad');
    later(1300, () => {
      if (finished) return;
      sim.restore();
      shotLive = false;
      if (strokes >= PC.maxStrokes(hole)) holeOut(true);
    });
  }

  function onRest() {
    shotLive = false;
    const b = sim.ball;
    const cp = sim.cupPos();
    cam.aimAz = Math.atan2(cp[1] - b.y, cp[0] - b.x);
    kb.angle = cam.aimAz;
    if (strokes >= PC.maxStrokes(hole) && !finished) holeOut(true);
  }

  // Rivals' news down the left of the screen.
  function feed(text, colr) {
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `<i style="background:${colr}"></i><span></span>`;
    el.querySelector('span').textContent = text;
    $('feed').prepend(el);
    while ($('feed').children.length > 4) $('feed').lastChild.remove();
    setTimeout(() => el.classList.add('fade'), 4200);
    setTimeout(() => el.remove(), 5000);
  }

  // ---------- HUD and screens ----------
  function updateHud() {
    if (!round) return;
    $('hudNo').textContent = round.practice ? 'Practice' : `Hole ${round.idx + 1} of ${round.ids.length} · ${DIFFS[round.diff].name}`;
    $('hudName').textContent = hole.name;
    $('hudSpecial').textContent = hole.special;
    $('hudPar').textContent = hole.par;
    $('hudStrokes').textContent = strokes;
    const t = totalsFor(you(), round.idx);
    const live = t.d + (finished ? you().scores[round.idx] - hole.par : strokes ? strokes - hole.par : 0);
    $('hudTotal').textContent = round.practice ? '–' : round.idx || strokes || finished ? vsPar(live) : 'E';
    renderRivalsHud();
  }

  function renderRivalsHud() {
    const box = $('hudRivals');
    if (!round || round.practice || !rivals.list.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = rivals.list.map(r => {
      const tot = totalsFor(round.players.find(p => p.name === r.name), round.idx).d + (r.done ? r.strokes - hole.par : 0);
      return `<div class="rv${r.done ? ' done' : ''}"><i style="background:${r.color}"></i><b>${r.name}</b><span>${r.done ? (r.picked ? 'picked up' : 'in ' + r.strokes) : r.strokes ? r.strokes + (r.strokes === 1 ? ' stroke' : ' strokes') : 'lining up'}</span><em>${vsPar(tot)}</em></div>`;
    }).join('');
  }

  let toastTimer = 0;
  function toast(big, small, tone) {
    const el = $('toast');
    $('toastBig').textContent = big;
    $('toastSmall').textContent = small || '';
    el.dataset.tone = tone || 'even';
    el.hidden = false;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2300);
  }

  function show(id) { ['title', 'book', 'card', 'pause'].forEach(k => { $(k).hidden = k !== id; }); }

  function mark(score, par) {
    const d = score - par;
    return score === 1 ? 'ace' : d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 1 ? 'bogey' : d >= 2 ? 'double' : '';
  }

  function cardTable(ids, offset, title) {
    const head = ids.map((id, i) => `<th scope="col">${offset + i + 1}</th>`).join('');
    const names = ids.map(id => `<td class="nm" title="${PC.holeById(id).name}">${PC.holeById(id).name.split(' ')[0]}</td>`).join('');
    let parT = 0;
    const pars = ids.map(id => { const p = PC.holeById(id).par; parT += p; return `<td>${p}</td>`; }).join('');
    const rows = round.players.map(pl => {
      let tot = 0, any = false;
      const cells = ids.map((id, i) => {
        const s = pl.scores[offset + i];
        if (s === undefined) return '<td class="sc"></td>';
        tot += s; any = true;
        return `<td class="sc"><span class="pencil ${mark(s, PC.holeById(id).par)}">${s}</span></td>`;
      }).join('');
      return `<tr class="${pl.you ? 'you' : ''}"><th scope="row"><i class="dot" style="background:${pl.color}"></i>${pl.name}</th>${cells}<td class="tot"><span class="pencil">${any ? tot : ''}</span></td></tr>`;
    }).join('');
    return `<table class="sheet"><thead><tr><th scope="row">Hole</th>${head}<th scope="col">${title}</th></tr></thead>
      <tbody><tr class="names"><th scope="row">${COURSE[hole.course] || 'Garden'}</th>${names}<td></td></tr>
      <tr class="par"><th scope="row">Par</th>${pars}<td class="tot">${parT}</td></tr>${rows}</tbody></table>`;
  }

  function standings() {
    return round.players.map(pl => { const t = totalsFor(pl); return { p: pl, s: t.s, par: t.p, d: t.d }; }).sort((a, b) => a.s - b.s || (a.p.you ? -1 : 1));
  }
  const ordinal = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

  function showCard() {
    if (!round) return;
    state = 'card';
    timeScale = 1;
    $('waitBar').hidden = true;
    world.hideAim();
    const lastHole = round.idx >= round.ids.length - 1;
    const ids = round.ids;
    $('cardSheet').innerHTML = ids.length > 9 ? cardTable(ids.slice(0, 9), 0, 'Out') + cardTable(ids.slice(9), 9, 'In') : cardTable(ids, 0, 'Tot');
    const sc = you().scores[round.idx];
    const tY = totalsFor(you());
    const board = standings();
    $('cardBoard').innerHTML = round.practice ? '' : board.map((r, i) => `<li class="${r.p.you ? 'you' : ''}"><b>${i + 1}</b><i style="background:${r.p.color}"></i>${r.p.name}<span>${r.s} · ${vsPar(r.d)}</span></li>`).join('');
    if (round.practice) {
      $('cardEyebrow').textContent = 'Practice';
      $('cardTitle').textContent = hole.name;
      $('cardSummary').textContent = `${label(sc, hole.par)} in ${sc} stroke${sc === 1 ? '' : 's'}. Your best here: ${save.holeBest[hole.id] || sc}.`;
      $('cardNext').textContent = 'Play it again';
      $('cardAlt').textContent = 'Course book';
      $('cardAlt').hidden = false;
    } else if (!lastHole) {
      $('cardEyebrow').textContent = `After ${round.idx + 1} of ${ids.length} · ${DIFFS[round.diff].name}`;
      $('cardTitle').textContent = `${vsPar(tY.d)} so far`;
      const nx = PC.holeById(ids[round.idx + 1]);
      const place = board.findIndex(r => r.p.you) + 1;
      $('cardSummary').textContent = `You're ${ordinal(place)} of ${board.length}. Next up: ${nx.name}, par ${nx.par}.`;
      $('cardNext').textContent = 'Next hole';
      $('cardAlt').hidden = true;
    } else {
      const n = ids.length, key = n + '-' + round.diff;
      const prev = save.best[key];
      const better = !prev || tY.s < prev.s;
      if (better) save.best[key] = { s: tY.s, d: tY.d };
      save.rounds = (save.rounds || 0) + 1;
      persist();
      const place = board.findIndex(r => r.p.you) + 1;
      $('cardEyebrow').textContent = `${n}-hole round · ${DIFFS[round.diff].name}`;
      $('cardTitle').textContent = place === 1 ? `You win! ${vsPar(tY.d)}` : `${ordinal(place)} place · ${vsPar(tY.d)}`;
      const aces = you().scores.filter(s => s === 1).length;
      $('cardSummary').textContent = `${tY.s} strokes. ` + (better ? (prev ? `A new best for ${n} holes on ${DIFFS[round.diff].name} (was ${prev.s}).` : `Your first ${n}-hole round on ${DIFFS[round.diff].name} is on the board.`) : `Your best for ${n} holes on ${DIFFS[round.diff].name} is ${prev.s} (${vsPar(prev.d)}).`) + (aces ? ` ${aces} hole${aces > 1 ? 's' : ''} in one!` : '');
      $('cardNext').textContent = 'New round';
      $('cardAlt').textContent = 'Menu';
      $('cardAlt').hidden = false;
      round.finished = true;
    }
    show('card');
    $('cardNext').focus();
  }

  function cardNext() {
    audio.play('click');
    if (round.practice) { beginHole(); return; }
    if (round.finished) { startRound(round.ids.length, round.diff); return; }
    round.idx++;
    beginHole();
  }
  function cardAlt() { audio.play('click'); if (round.practice) openBook(); else toTitle(); }

  // ---------- title menu (the same layout as Bigger Fish and Brain Rocket) ----------
  const TAG = {
    9: 'Mini golf with a trick on every hole. Putt against three rivals over a fresh 9. Medium heads out to the Canyon, Hard to the Winter Wonderland.',
    18: 'The full round: 18 holes, three rivals, one scorecard. Ultra takes you down into the Abyss.',
    online: 'Putt against your friends on the same holes at the same time. Online play is coming soon.',
  };
  const HOW = `<div><b>⛳ Drag back to putt.</b> Press anywhere, pull back and let go. The further you pull, the harder you hit.</div>
    <div><b>👻 Beat your rivals.</b> They play the same hole at the same time as see-through ghost balls.</div>
    <div><b>🌵 Cacti, water, lava and edges</b> cost a stroke and put you back where you putted from.</div>
    <div><b>🎥 C shows the whole hole.</b> Q and E turn the camera. Arrow keys aim and Space putts.</div>`;
  const HOW_ONLINE = `<div><b>🌐 Rooms with friends.</b> Share a code, everyone plays the same holes, and your friends show as ghost balls.</div>
    <div><b>🏆 One scorecard.</b> The lowest total after the round wins. Online play is coming soon.</div>`;

  function bestText(n, d) { const b = save.best[n + '-' + d]; return b ? `Best: ${b.s} (${vsPar(b.d)})` : 'Not played yet'; }
  function modeCards() {
    if (menuTab === 'online') return ORDER.map(id => { const m = DIFFS[id]; return `<div class="mode-card ${m.cls} locked"><span class="mode-lock">🔒</span><span class="mode-icon">${m.icon}</span><span class="mode-name">${m.name}</span><span class="mode-tag">Coming soon</span><span class="mode-info">Play friends<br>in the ${COURSE[m.course]}</span><span class="mode-best"></span></div>`; }).join('');
    return ORDER.map(id => {
      const m = DIFFS[id];
      return `<button class="mode-card ${m.cls}" type="button" data-diff="${id}"><span class="mode-icon">${m.icon}</span><span class="mode-name">${m.name}</span><span class="mode-tag">The ${COURSE[m.course]}</span><span class="mode-info">${m.info}<br><small>vs ${m.rivals.join(', ')}</small></span><span class="mode-best">${bestText(menuTab, id)}</span></button>`;
    }).join('');
  }
  function renderMenu(animate) {
    document.querySelectorAll('.type-btn[data-tab]').forEach(b => { const on = b.dataset.tab === menuTab; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    $('tagline').textContent = TAG[menuTab];
    $('modes').innerHTML = modeCards();
    const how = $('how');
    if (animate) { how.classList.add('switching'); setTimeout(() => { how.innerHTML = menuTab === 'online' ? HOW_ONLINE : HOW; how.classList.remove('switching'); }, 220); }
    else how.innerHTML = menuTab === 'online' ? HOW_ONLINE : HOW;
    how.classList.toggle('one', menuTab === 'online');
    moveGlider(animate);
  }
  function setTab(t) {
    if (t === menuTab) return;
    menuTab = t;
    try { localStorage.setItem('puttclub.tab', t); } catch (e) { /* ok */ }
    audio.play('click');
    renderMenu(true);
  }
  function moveGlider(animate) {
    const gl = $('typeGlider'), btn = document.querySelector('.type-btn.active[data-tab]');
    if (!gl || !btn || !btn.offsetWidth) return;
    gl.classList.toggle('instant', !animate);
    gl.style.width = btn.offsetWidth + 'px';
    gl.style.transform = `translateX(${btn.offsetLeft}px)`;
  }
  // The menu is laid out on a fixed stage and scaled to fit, wide or tall.
  function fitMenu() {
    const w = window.innerWidth, h = window.innerHeight;
    const tall = w / h < 0.95;
    const cw = tall ? 900 : 1600, ch = tall ? 1500 : 900;
    const k = Math.min(w / cw, h / ch);
    const st = $('menuStage');
    st.classList.toggle('tall', tall);
    st.style.width = w / k + 'px'; st.style.height = h / k + 'px'; st.style.transform = `scale(${k})`;
    moveGlider(false);
  }

  function toTitle() {
    clearTimers();
    round = null;
    rivals.clear();
    $('hud').hidden = true; $('intro').hidden = true; $('toast').hidden = true; $('waitBar').hidden = true;
    const spec = PC.HOLES[Math.floor(Math.random() * PC.HOLES.length)];
    loadHole(spec, DIFFS.medium);
    document.body.classList.remove('abyss', 'canyon', 'winter');
    cam.cur = null;
    state = 'title';
    show('title');
    renderMenu(false);
    fitMenu();
  }

  function openBook() {
    clearTimers();
    rivals.clear();
    $('hud').hidden = true; $('intro').hidden = true; $('waitBar').hidden = true;
    const fill = (gridId, list) => {
      const grid = $(gridId);
      if (!grid.dataset.built) {
        grid.dataset.built = '1';
        list.forEach(h => {
          const btn = document.createElement('button');
          btn.className = 'hole-card' + (h.course === 'garden' ? '' : ' ' + h.course);
          btn.type = 'button';
          btn.innerHTML = `<canvas width="240" height="300" aria-hidden="true"></canvas><span class="hc-no">${h.num}</span><span class="hc-name">${h.name}</span><span class="hc-sp">${h.special}</span><span class="hc-meta">Par ${h.par} · <span data-best="${h.id}"></span></span>`;
          btn.addEventListener('click', () => { audio.unlock(); audio.play('click'); startPractice(h.id); });
          grid.appendChild(btn);
          drawMap(btn.querySelector('canvas'), PC.prepareHole(h));
        });
      }
    };
    fill('bookGrid', PC.HOLES);
    fill('canyonGrid', PC.CANYON);
    fill('winterGrid', PC.WINTER);
    fill('abyssGrid', PC.ABYSS);
    document.querySelectorAll('[data-best]').forEach(el => { const v = save.holeBest[el.dataset.best]; el.textContent = v ? `your best ${v}` : 'not played yet'; });
    show('book');
  }

  // A little top-down plan of a hole for the course book.
  function drawMap(cv, h) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    // Frame the greens themselves (a gulch or drop can reach far beyond them).
    const fx = [], fy = [];
    h.floors.forEach(f => f.poly.forEach(p => { fx.push(p[0]); fy.push(p[1]); }));
    const x0 = Math.min(...fx) - 0.6, x1 = Math.max(...fx) + 0.6, y0 = Math.min(...fy) - 0.6, y1 = Math.max(...fy) + 0.6;
    const b = { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }, pad = 18;
    const s = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h);
    const ox = W / 2 - b.cx * s, oy = H / 2 + b.cy * s;
    const P = (x, y) => [ox + x * s, oy - y * s];
    const path = (pts, close = true) => { g.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); if (close) g.closePath(); };
    const hell = h.course === 'abyss', desert = h.course === 'canyon', winter = h.course === 'winter';
    g.clearRect(0, 0, W, H);
    h.hazards.filter(z => !z.over).forEach(z => { path(z.poly); g.fillStyle = z.kind === 'water' ? (z.cold ? '#3a7a9a' : '#7cc3dd') : z.kind === 'lava' ? '#ff6a1a' : z.kind === 'chasm' ? (winter ? '#9fb4cc' : '#5a2a14') : '#f3a6c3'; g.fill(); });
    h.floors.forEach(f => { path(f.poly); g.fillStyle = hell ? '#5a4a4c' : f.mat === 'planks' ? '#b0773f' : desert ? '#d9b27a' : winter ? '#3f8f63' : '#6fbf4f'; g.fill(); if (hell) { g.strokeStyle = '#ff7a2a'; g.lineWidth = 1.5; g.stroke(); } });
    h.zones.forEach(z => { path(z.poly); g.fillStyle = { slime: '#c7f06b', honey: '#f2b236', soil: '#8a5f3a', seeds: '#6b4220', glass: '#1a1420', tar: '#0d0a0b', ash: '#7a6e6a', sand: '#f0d9a4', cinder: '#3a2a2a', ice: '#bfe6f7', snow: '#ffffff' }[z.type] || '#999'; g.fill(); });
    h.hazards.filter(z => z.over).forEach(z => { path(z.poly); g.fillStyle = z.kind === 'water' ? (z.cold ? '#3a7a9a' : '#4aa8c8') : '#ff6a1a'; g.fill(); });
    g.lineCap = 'round'; g.lineJoin = 'round';
    h.rails.forEach(r => { if (r.style === 'none') return; path(r.pts, r.closed); g.strokeStyle = r.style === 'hedge' ? '#2f6b2a' : r.style === 'obsidian' ? '#120e16' : '#7a4a26'; g.lineWidth = Math.max(2, (r.side === 'center' ? r.w : 0.2) * s); g.stroke(); });
    h.posts.forEach(p => { const q = P(p.x, p.y); g.beginPath(); g.arc(q[0], q[1], p.r * s, 0, 7); g.fillStyle = hell ? '#2a2124' : desert ? '#c0784a' : '#8f897d'; g.fill(); });
    (h.features || []).forEach(f => {
      if (f.type === 'cacti') f.list.forEach(c => { const q = P(c.x, c.y); g.beginPath(); g.arc(q[0], q[1], Math.max(2.5, (c.r || 0.3) * s), 0, 7); g.fillStyle = '#2f7a34'; g.fill(); g.strokeStyle = '#f4f0dc'; g.lineWidth = 1; g.stroke(); });
      if (f.type === 'tumbleweeds') f.list.forEach(w => { g.setLineDash([3, 3]); path(w.path, !!w.loop); g.strokeStyle = 'rgba(122,82,40,0.75)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]); const q = P(w.path[0][0], w.path[0][1]); g.beginPath(); g.arc(q[0], q[1], (w.r || 0.42) * s, 0, 7); g.fillStyle = '#a8844e'; g.fill(); });
      if (f.type === 'thinice') f.list.forEach(q => { path(q.poly || q); g.fillStyle = 'rgba(220,242,255,0.85)'; g.fill(); g.setLineDash([3, 3]); g.strokeStyle = '#3a7a9a'; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]); });
      if (f.type === 'snowballs') f.list.forEach(w => { g.setLineDash([2, 3]); path(w.path, false); g.strokeStyle = 'rgba(80,110,150,0.8)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]); const q = P(w.path[0][0], w.path[0][1]); g.beginPath(); g.arc(q[0], q[1], 3.5, 0, 7); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#6a8ab0'; g.stroke(); });
      if (f.type === 'patrol' && f.penguins) f.movers.forEach(m => { path([m.a, m.b], false); g.setLineDash([2, 2]); g.strokeStyle = 'rgba(28,34,48,0.7)'; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]); const q = P((m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2); g.beginPath(); g.arc(q[0], q[1], 3.5, 0, 7); g.fillStyle = '#1c2230'; g.fill(); });
      if (f.type === 'spring') { const q = P(f.x, f.y); g.beginPath(); g.arc(q[0], q[1], Math.max(3, f.r * s), 0, 7); g.fillStyle = f.dir !== undefined ? '#e0332a' : '#f2b81f'; g.fill(); }
    });
    const t = P(h.tee[0], h.tee[1]); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(t[0], t[1], 4, 0, 7); g.fill();
    const c = P(h.cup[0], h.cup[1]); g.fillStyle = hell ? '#ffffff' : '#1b2a22'; g.beginPath(); g.arc(c[0], c[1], 4.5, 0, 7); g.fill();
    g.strokeStyle = hell ? '#ffffff' : '#1b2a22'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[0], c[1] - 16); g.stroke();
    g.fillStyle = '#e2463b'; g.beginPath(); g.moveTo(c[0], c[1] - 16); g.lineTo(c[0] + 11, c[1] - 12.5); g.lineTo(c[0], c[1] - 9); g.fill();
  }

  function pause() {
    if (state !== 'play' && state !== 'intro') return;
    world.hideAim(); aim = null;
    state = 'pause';
    show('pause');
  }
  function resume() { show(null); state = 'play'; last = performance.now(); }

  // ---------- camera ----------
  function overviewCam() {
    const b = hole.box;
    const asp = world.camera.aspect;
    const az = cam.overAz;
    const along = Math.abs(Math.cos(az)) * b.w + Math.abs(Math.sin(az)) * b.h;
    const across = Math.abs(Math.sin(az)) * b.w + Math.abs(Math.cos(az)) * b.h;
    const fov = (world.camera.fov * Math.PI) / 180;
    const need = Math.max(along * 0.62, (across / Math.max(0.6, asp)) * 0.95);
    const dist = (need / Math.tan(fov / 2)) * 0.7 + 3.5;
    return { tx: b.cx - Math.cos(az) * along * 0.06, ty: b.cy - Math.sin(az) * along * 0.06, th: 0, az, el: 1.02, dist };
  }

  function camWant() {
    const b = sim.ball;
    if (state === 'title') {
      const o = overviewCam();
      return { tx: o.tx, ty: o.ty, th: 0, az: clock * 0.07 + 1.2, el: 0.72, dist: o.dist * 0.95 };
    }
    if (state === 'intro' && clock - cam.t0 < 1.3) return overviewCam();
    if (cam.mode === 'overview') { const o = overviewCam(); o.dist *= cam.zoom; return o; }
    let bx = b.x, by = b.y, bz = b.z;
    if (b.mode === 'sunk') { bx = b.cupX; by = b.cupY; bz = sim.floorHeight(bx, by); }
    if (b.mode === 'tunnel') { bx = b.exit.x; by = b.exit.y; }
    if (b.mode === 'lost') bz = Math.max(bz, -0.5);
    const moving = shotLive || !sim.resting();
    if (moving) return { tx: bx, ty: by, th: bz, az: cam.cur ? cam.cur.az : cam.aimAz, el: 0.7, dist: 6.6 * cam.zoom };
    const az = kb.on ? kb.angle : cam.aimAz;
    return { tx: bx + Math.cos(az) * 1.5, ty: by + Math.sin(az) * 1.5, th: bz, az, el: 0.6, dist: 6.2 * cam.zoom };
  }

  function updateCam(dt) {
    const w = camWant();
    if (!cam.cur) cam.cur = Object.assign({}, w);
    const c = cam.cur;
    const k = 1 - Math.exp(-dt * (state === 'intro' ? 2.2 : 3.2));
    c.tx += (w.tx - c.tx) * k; c.ty += (w.ty - c.ty) * k; c.th += (w.th - c.th) * k;
    c.az += U.wrapAngle(w.az - c.az) * k;
    c.el += (w.el - c.el) * k; c.dist += (w.dist - c.dist) * k;
    const hd = Math.cos(c.el) * c.dist;
    const camera = world.camera;
    camera.position.set(c.tx - Math.cos(c.az) * hd, c.th + Math.sin(c.el) * c.dist + 0.2, -(c.ty - Math.sin(c.az) * hd));
    camera.lookAt(c.tx, c.th + 0.15, -c.ty);
  }

  // ---------- aiming ----------
  function groundPoint(ev) {
    const r = world.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(v, world.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(sim.ball.z - C.R));
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, p)) return null;
    return [p.x, -p.z];
  }

  function canAim() { return state === 'play' && !finished && sim.resting() && !sim.ball.hidden && sim.ball.mode === 'roll'; }

  // Medium: a straight run to the first wall, then a short bounce. Hard: just the first stretch.
  function lineGuide(angle, power, short) {
    const b = sim.ball;
    let v = 0.5 + (C.MAXV - 0.5) * Math.pow(power, 1.15), d = 0;
    while (v > 0.05) { v -= (C.FRIC + C.LIN * v) / 60; d += v / 60; }
    let len = short ? Math.min(d, 1.4) : Math.min(d, 11), x = b.x, y = b.y, dx = Math.cos(angle), dy = Math.sin(angle);
    const pts = [], step = 0.05;
    let travelled = 0, bounced = false, nextDot = 0.3;
    while (travelled < len) {
      x += dx * step; y += dy * step; travelled += step;
      let hit = null;
      for (const s of hole.segs) {
        if (s.top && s.h === 0) continue;
        const q = U.closestOnSeg(x, y, s.ax, s.ay, s.bx, s.by);
        const dd = Math.hypot(x - q[0], y - q[1]);
        if (dd < s.r + C.R) { hit = [(x - q[0]) / (dd || 1), (y - q[1]) / (dd || 1)]; break; }
      }
      if (!hit) for (const p of hole.posts) { const dd = Math.hypot(x - p.x, y - p.y); if (dd < p.r + C.R) { hit = [(x - p.x) / dd, (y - p.y) / dd]; break; } }
      if (hit) {
        if (bounced || short) break;
        bounced = true;
        const vn = dx * hit[0] + dy * hit[1];
        dx -= 2 * vn * hit[0]; dy -= 2 * vn * hit[1];
        x += dx * step * 2; y += dy * step * 2;
        len = Math.min(len, travelled + Math.max(0.8, (len - travelled) * 0.55));
      }
      if (travelled >= nextDot) {
        nextDot += 0.3;
        const g = sim.ground(x, y);
        pts.push([x, y, (g.kind === 'floor' || g.kind === 'platform' ? g.h : C.WATER_TOP) + 0.01]);
      }
    }
    return pts;
  }

  // Owen: play the putt out in a copy of the hole and show exactly where it goes.
  let guideCache = null;
  function fullGuide(angle, power) {
    if (guideCache && Math.abs(U.wrapAngle(angle - guideCache.a)) < 0.003 && Math.abs(power - guideCache.p) < 0.004 && clock - guideCache.t < 0.25) return guideCache.pts;
    if (guideCache && clock - guideCache.t < 0.06) return guideCache.pts;
    const s = sim.clone();
    s.shoot(angle, power);
    const pts = [];
    let px = s.ball.x, py = s.ball.y, acc = 0;
    const dt = C.DT;   // the same step as the real putt, so the preview is exact
    for (let i = 0; i < 6 / dt; i++) {
      s.step(dt);
      const b = s.ball;
      if (b.mode === 'sunk' || b.mode === 'lost' || b.mode === 'tunnel') { pts.push([b.x, b.y, b.z - C.R + 0.01]); break; }
      acc += Math.hypot(b.x - px, b.y - py); px = b.x; py = b.y;
      if (acc >= 0.28) { acc = 0; pts.push([b.x, b.y, b.z - C.R + 0.01]); }
      if (i > 80 && s.resting()) break;
    }
    guideCache = { a: angle, p: power, t: clock, pts };
    return pts;
  }

  function showAim(angle, power) {
    const b = sim.ball;
    const g = D.guide;
    const pts = g === 'full' ? fullGuide(angle, power) : g === 'bounce' ? lineGuide(angle, power, false) : g === 'short' ? lineGuide(angle, power, true) : [];
    world.showAim(b.x, b.y, b.z, angle, power, pts);
    const pw = $('power');
    pw.hidden = false;
    pw.style.setProperty('--p', power.toFixed(3));
    $('powerVal').textContent = Math.round(power * 100) + '%';
  }
  function hideAim() { world.hideAim(); $('power').hidden = true; }

  function shoot(angle, power) {
    if (!canAim()) return;
    audio.unlock();
    sim.shoot(angle, power);
    strokes++;
    shotLive = true;
    kb.on = false; aim = null;
    hideAim();
    $('hint').classList.add('gone');
    updateHud();
  }

  const canvas = world.renderer.domElement;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    audio.unlock();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state === 'intro') { go(); return; }
    if (state !== 'play') return;
    if (e.button === 2 || pointers.size > 1) { aim = null; hideAim(); orbit = { x: e.clientX, y: e.clientY, d: pinchDist() }; return; }
    if (!canAim()) return;
    const g = groundPoint(e);
    if (!g) return;
    aim = { sx: e.clientX, sy: e.clientY, g0: g, angle: kb.angle, power: 0, live: false };
    kb.on = false;
  });
  function pinchDist() { const p = [...pointers.values()]; return p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; }
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (orbit) {
      const dx = e.clientX - orbit.x;
      orbit.x = e.clientX; orbit.y = e.clientY;
      if (pointers.size > 1) { const pd = pinchDist(); if (orbit.d && pd) cam.zoom = U.clamp(cam.zoom * (orbit.d / pd), 0.5, 2.4); orbit.d = pd; }
      if (cam.mode === 'overview') cam.overAz -= dx * 0.006; else { cam.aimAz -= dx * 0.006; kb.angle = cam.aimAz; }
      return;
    }
    if (!aim) return;
    if (!canAim()) { aim = null; hideAim(); return; }
    const g = groundPoint(e);
    if (!g) return;
    const sd = Math.hypot(e.clientX - aim.sx, e.clientY - aim.sy);
    const r = canvas.getBoundingClientRect();
    aim.power = U.clamp(sd / (Math.min(r.width, r.height) * 0.32), 0, 1);
    const dx = aim.g0[0] - g[0], dy = aim.g0[1] - g[1];
    if (sd > 8 && Math.hypot(dx, dy) > 1e-4) { aim.angle = Math.atan2(dy, dx); aim.live = true; }
    if (aim.live) showAim(aim.angle, aim.power); else hideAim();
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (orbit && pointers.size === 0) orbit = null;
    if (!aim) return;
    const a = aim; aim = null;
    if (a.live && a.power > 0.035 && e.type === 'pointerup') shoot(a.angle, a.power);
    else hideAim();
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = U.clamp(cam.zoom * Math.exp(e.deltaY * 0.0012), 0.5, 2.4); }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key;
    if (k === 'm' || k === 'M') { toggleMusic(); return; }
    if (k === 'n' || k === 'N') { toggleSound(); return; }
    if (state === 'intro' && (k === ' ' || k === 'Enter')) { e.preventDefault(); go(); return; }
    if (state === 'pause' && k === 'Escape') { resume(); return; }
    if (state !== 'play') return;
    if (k === 'Escape') { pause(); return; }
    if (k === 'c' || k === 'C') { toggleView(); return; }
    if (k === 'q' || k === 'Q') { cam.aimAz += 0.3; kb.angle = cam.aimAz; if (cam.mode === 'overview') cam.overAz += 0.3; return; }
    if (k === 'e' || k === 'E') { cam.aimAz -= 0.3; kb.angle = cam.aimAz; if (cam.mode === 'overview') cam.overAz -= 0.3; return; }
    const dirKeys = { ArrowLeft: 1, a: 1, A: 1, ArrowRight: -1, d: -1, D: -1 };
    const pwKeys = { ArrowUp: 1, w: 1, W: 1, ArrowDown: -1, s: -1, S: -1 };
    if (k in dirKeys || k in pwKeys) {
      e.preventDefault();
      if (!canAim()) return;
      if (!kb.on) { kb.on = true; kb.angle = cam.aimAz; }
      if (k in dirKeys) kb.rot = dirKeys[k];
      if (k in pwKeys) kb.pw = pwKeys[k];
      kb.fine = e.shiftKey;
      return;
    }
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (!canAim()) return;
      if (!kb.on) { kb.on = true; kb.angle = cam.aimAz; return; }
      shoot(kb.angle, kb.power);
    }
  });
  window.addEventListener('keyup', e => {
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(k)) kb.rot = 0;
    if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(k)) kb.pw = 0;
    kb.fine = e.shiftKey;
  });

  function toggleView() {
    cam.mode = cam.mode === 'overview' ? 'follow' : 'overview';
    if (cam.mode === 'overview') cam.overAz = cam.aimAz;
    $('btnView').setAttribute('aria-pressed', String(cam.mode === 'overview'));
    $('btnViewLabel').textContent = cam.mode === 'overview' ? 'Ball view' : 'Whole hole';
  }
  function toggleSound() { save.sfx = !save.sfx; audio.setSfx(save.sfx); persist(); syncSoundUi(); }
  function toggleMusic() { save.music = !save.music; audio.unlock(); audio.setMusic(save.music); persist(); syncSoundUi(); }
  function syncSoundUi() {
    document.querySelectorAll('[data-sfx]').forEach(el => { el.querySelector('span') ? (el.querySelector('span').textContent = 'Sound') : (el.textContent = save.sfx ? 'Sound on' : 'Sound off'); el.setAttribute('aria-pressed', String(save.sfx)); el.classList.toggle('off', !save.sfx); });
    document.querySelectorAll('[data-music]').forEach(el => { el.querySelector('span') ? (el.querySelector('span').textContent = 'Music') : (el.textContent = save.music ? 'Music on' : 'Music off'); el.setAttribute('aria-pressed', String(save.music)); el.classList.toggle('off', !save.music); });
  }

  // ---------- main loop ----------
  const SOUND = { wall: 'wall', post: 'post', paddle: 'paddle', gate: 'gate', bonk: 'bonk', squish: 'squish', tire: 'tire', tumble: 'tumble', snowball: 'snowball' };
  function handleEvents() {
    for (const e of sim.events) {
      if (state === 'title') continue;
      if (SOUND[e.type]) audio.play(SOUND[e.type], { k: (e.speed || 2) / 2.5 });
      else if (e.type === 'bumper') { audio.play('bumper'); world.burst('spark', e.x, e.y, 0.3, { color: hole.course === 'abyss' ? '#ff8a2a' : '#ffd27a', n: 12 }); }
      else if (e.type === 'launch') { audio.play('launch'); world.burst('puff', sim.ball.x, sim.ball.y, 0.1, { color: '#ffffff' }); }
      else if (e.type === 'tunnel') { audio.play('tunnel'); world.burst('puff', sim.ball.x, sim.ball.y, 0, { color: hole.course === 'abyss' ? '#ff3df2' : '#8a6a4a', n: 16 }); }
      else if (e.type === 'popout') { audio.play('popout'); world.burst('puff', e.x, e.y, 0, { color: hole.course === 'abyss' ? '#ff3df2' : '#8a6a4a', n: 16 }); }
      else if (e.type === 'spring') { audio.play('boing'); world.burst('spark', e.x, e.y, sim.floorHeight(e.x, e.y) + 0.1, { color: e.trap ? '#ff6a4a' : '#ffe27a', n: 14 }); }
      else if (e.type === 'crack') { audio.play('crack'); world.burst('spark', e.x, e.y, sim.floorHeight(e.x, e.y) + 0.03, { color: '#e8f6ff', n: 10 }); }
      else if (e.type === 'icebreak') { audio.play('shatter'); world.burst('splash', e.x, e.y, sim.floorHeight(e.x, e.y)); }
      else if (e.type === 'boost') audio.play('boost');
      else if (e.type === 'switch') audio.play('switch');
      else if (e.type === 'lip') audio.play('lip');
      else if (e.type === 'land' && e.speed > 0.8) { audio.play('land', { k: e.speed / 2 }); world.burst('puff', sim.ball.x, sim.ball.y, sim.ball.z - C.R, { n: 6 }); }
      else if (e.type === 'sink') { audio.play('sink'); holeOut(false); }
      else if (e.type === 'lost') lost(e);
    }
    sim.events.length = 0;
  }

  function handleRivals(dt) {
    if (!round || round.practice) return;
    const evs = rivals.update(dt, timeScale);
    evs.forEach(ev => {
      const r = ev.rival, pl = round.players.find(p => p.name === r.name);
      if (ev.type === 'sink' || ev.type === 'pickup') {
        pl.scores[round.idx] = r.strokes;
        if (ev.type === 'sink') {
          const cp = r.sim.cupPos();
          world.burst('spark', cp[0], cp[1], sim.floorHeight(cp[0], cp[1]), { color: r.color, n: 18 });
          audio.play('lip');
          feed(`${r.name}: ${label(r.strokes, hole.par).replace('!', '')} (${r.strokes})`, r.color);
        } else feed(`${r.name} picked up`, r.color);
      } else if (ev.type === 'lost') {
        if (ev.kind === 'water') world.burst('splash', ev.x, ev.y, C.WATER_TOP);
        else world.burst('puff', ev.x, ev.y, 0, { n: 10, color: ev.kind === 'lava' ? '#ff8a2a' : ev.kind === 'cactus' ? '#ffffff' : '#e9e1cf' });
        feed(`${r.name}: ${lostMsg(ev.kind).replace('!', '')}`, r.color);
      }
    });
    hudT += dt;
    if (evs.length || hudT > 0.5) { hudT = 0; renderRivalsHud(); }
    if (finished && state === 'play') {
      waitT += dt;
      if (!$('waitBar').hidden) showWaiting();
      if (waitT > 40) rivals.forceFinish();
      if (round.waiting && rivals.allDone()) {
        round.waiting = false;
        rivals.list.forEach(r => { round.players.find(p => p.name === r.name).scores[round.idx] = r.strokes; });
        renderRivalsHud();
        timeScale = 1;
        later(900, showCard);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!sim) return;
    if (state !== 'pause') {
      const sdt = dt * timeScale;
      clock += sdt;
      acc += sdt;
      let n = 0;
      while (acc >= C.DT && n < 90) { sim.step(C.DT); if (state === 'play' || state === 'intro') rivals.stepPhysics(C.DT); acc -= C.DT; n++; }
      if (n >= 90) acc = 0;
      handleEvents();
      if (state === 'play' || state === 'intro') handleRivals(dt);
    }
    if (kb.on && canAim()) {
      kb.angle += kb.rot * (kb.fine ? 0.25 : 1.1) * dt;
      kb.power = U.clamp(kb.power + kb.pw * 0.6 * dt, 0.03, 1);
      cam.aimAz = kb.angle;
      showAim(kb.angle, kb.power);
    } else if (!aim && $('power').hidden === false && !kb.on) hideAim();
    if (kb.on && !canAim()) { kb.on = false; hideAim(); }
    if (aim && !canAim()) { aim = null; hideAim(); }
    if (state === 'play' && shotLive && sim.resting() && !finished) onRest();
    const wind = sim.feats.find(f => f.type === 'wind');
    if (wind && state !== 'title') { if (wind.gust > 0.05 && gustWas <= 0.05) audio.play('gust'); gustWas = wind.gust; }
    if (state !== 'title') audio.ambient(clock);
    updateCam(dt);
    world.update(clock, dt * timeScale, sim);
    world.updateGhosts(dt * timeScale);
    world.render();
  }

  // ---------- wiring ----------
  function bind(id, fn) { const el = $(id); if (el) el.addEventListener('click', e => { audio.unlock(); fn(e); }); }
  document.querySelectorAll('.type-btn[data-tab]').forEach(b => b.addEventListener('click', () => { audio.unlock(); setTab(b.dataset.tab); }));
  $('modes').addEventListener('click', e => {
    const card = e.target.closest('[data-diff]');
    audio.unlock();
    if (!card) { if (e.target.closest('.mode-card')) { audio.play('click'); toast('Coming soon', 'Online play with friends is on its way.', 'even'); } return; }
    audio.play('click');
    startRound(+menuTab, card.dataset.diff);
  });
  bind('openBook', () => { audio.play('click'); openBook(); });
  bind('bookBack', () => { audio.play('click'); toTitle(); });
  bind('cardNext', cardNext);
  bind('cardAlt', cardAlt);
  bind('btnView', toggleView);
  bind('btnMenu', pause);
  bind('resume', resume);
  bind('quit', () => { audio.play('click'); toTitle(); });
  bind('introGo', go);
  bind('skipWait', () => { rivals.forceFinish(); });
  document.querySelectorAll('[data-sfx]').forEach(el => el.addEventListener('click', toggleSound));
  document.querySelectorAll('[data-music]').forEach(el => el.addEventListener('click', toggleMusic));
  bind('rotL', () => { if (cam.mode === 'overview') cam.overAz += 0.35; else { cam.aimAz += 0.35; kb.angle = cam.aimAz; } });
  bind('rotR', () => { if (cam.mode === 'overview') cam.overAz -= 0.35; else { cam.aimAz -= 0.35; kb.angle = cam.aimAz; } });
  window.addEventListener('resize', () => { world.resize(); fitMenu(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !finished) pause(); });

  // When the published page is updated while someone is mid-round, keep their round: the holes dealt,
  // the difficulty and everyone's scores so far. The hole in play starts again from the tee.
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => (round && !round.finished ? { round: { ids: round.ids, idx: round.idx, diff: round.diff, practice: round.practice, players: round.players } } : {}));

  function boot(data) {
    syncSoundUi();
    requestAnimationFrame(t => { last = t; frame(t); });
    document.body.classList.add('ready');
    const r = data && data.round;
    if (r && Array.isArray(r.ids) && r.ids.every(id => PC.holeById(id)) && DIFFS[r.diff] && Array.isArray(r.players)) {
      round = { ids: r.ids, idx: Math.min(r.idx, r.ids.length - 1), diff: r.diff, practice: !!r.practice, players: r.players.map(p => Object.assign({}, p, { scores: (p.scores || []).slice(0, r.idx) })) };
      beginHole();
    } else toTitle();
  }
  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(() => { if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {}); });

  // for tests
  PC.game = { startRound, startPractice, get state() { return state; }, get sim() { return sim; }, get round() { return round; }, rivals, go, shoot, cam, world, toTitle, openBook, showCard, setTab };
})(window.PC = window.PC || {});
