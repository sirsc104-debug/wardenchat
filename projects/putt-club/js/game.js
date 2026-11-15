/* Putt Club: rounds, scoring, the camera, controls and the screens around the 3D view. */
(function (PC) {
  'use strict';
  const U = PC.U, C = PC.C;
  const $ = id => document.getElementById(id);
  const MAX_STROKES = 8;
  const KEY = 'puttclub.v1';

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = Object.assign({ best: {}, holeBest: {}, aces: 0, rounds: 0, sfx: true, music: true }, load());
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } };

  const world = new PC.World($('view'));
  const audio = new PC.Audio(save);
  const raycaster = new THREE.Raycaster();

  let state = 'title';
  let round = null;            // { ids, idx, scores, practice }
  let sim = null, hole = null;
  let strokes = 0, shotLive = false, finished = false, lastRest = true;
  let aim = null;              // pointer aim in progress
  const kb = { on: false, angle: Math.PI / 2, power: 0.45, rot: 0, pw: 0, fine: false };
  const pointers = new Map();
  let orbit = null;
  const cam = { mode: 'follow', aimAz: Math.PI / 2, overAz: Math.PI / 2, zoom: 1, cur: null, t0: 0 };
  let clock = 0, acc = 0, last = performance.now();
  let gustWas = 0;
  let timers = [];
  const later = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // ---------- holes ----------
  function loadHole(spec) {
    hole = PC.prepareHole(spec);
    sim = new PC.Sim(hole);
    world.build(hole, sim);
    strokes = 0; shotLive = false; finished = false; lastRest = true;
    aim = null; kb.on = false; world.hideAim();
    cam.aimAz = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    kb.angle = cam.aimAz;
    cam.overAz = cam.aimAz;
    cam.mode = 'follow';
  }

  function startRound(n) {
    const ids = U.shuffle(PC.HOLES.map(h => h.id)).slice(0, n);
    round = { ids, idx: 0, scores: [], practice: false };
    beginHole();
  }

  function startPractice(id) {
    round = { ids: [id], idx: 0, scores: [], practice: true };
    beginHole();
  }

  function beginHole() {
    clearTimers();
    show(null);
    const spec = PC.holeById(round.ids[round.idx]);
    loadHole(spec);
    // the camera starts high over the hole and swoops down to the tee
    cam.cur = overviewCam();
    cam.cur.el = 1.25; cam.cur.dist *= 1.25;
    cam.t0 = clock;
    state = 'intro';
    $('hud').hidden = false;
    updateHud();
    const it = $('intro');
    $('introNo').textContent = round.practice ? `Practice · Hole ${hole.num} of 27` : `Hole ${round.idx + 1} of ${round.ids.length}`;
    $('introName').textContent = hole.name;
    $('introSpecial').textContent = hole.special;
    $('introTip').textContent = hole.tip;
    $('introPar').textContent = 'Par ' + hole.par;
    it.hidden = false;
    it.classList.remove('out');
    later(6500, () => { if (state === 'intro') go(); });
  }

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
  function totals() {
    let s = 0, p = 0;
    round.scores.forEach((sc, i) => { s += sc; p += PC.holeById(round.ids[i]).par; });
    return { s, p, d: s - p };
  }

  function holeOut(picked) {
    if (finished) return;
    finished = true;
    const score = picked ? MAX_STROKES : strokes;
    round.scores[round.idx] = score;
    const prev = save.holeBest[hole.id];
    if (!picked && (!prev || score < prev)) save.holeBest[hole.id] = score;
    if (score === 1) save.aces = (save.aces || 0) + 1;
    persist();
    const d = score - hole.par;
    const cp = sim.cupPos(), h = sim.floorHeight(cp[0], cp[1]);
    if (!picked) world.burst(score === 1 ? 'ace' : 'sink', cp[0], cp[1], h);
    audio.play(score === 1 ? 'ace' : d < 0 ? 'good' : d === 0 ? 'par' : 'meh');
    toast(picked ? 'Picked up' : label(score, hole.par), picked ? `${MAX_STROKES} strokes is the most on any hole` : `${score} stroke${score === 1 ? '' : 's'} · ${vsPar(d)}${!picked && prev && score < prev ? ' · your best here' : ''}`, score === 1 || d < 0 ? 'good' : d === 0 ? 'even' : 'bad');
    updateHud();
    later(score === 1 ? 2600 : 1900, showCard);
  }

  function lost(e) {
    const kind = e.kind;
    const b = sim.ball;
    if (kind === 'water') { world.burst('splash', e.x, e.y, C.WATER_TOP); audio.play('splash'); }
    else { world.burst('puff', e.x, e.y, -0.2, { color: kind === 'flowers' ? '#ffb3c6' : '#e9e1cf', n: 20 }); audio.play('flowers'); }
    strokes += 1;
    updateHud();
    toast(kind === 'water' ? 'Splash!' : kind === 'flowers' ? 'Into the flowers!' : 'Off the course!', 'One penalty stroke. Back to where you putted from.', 'bad');
    void b;
    later(1300, () => {
      if (finished) return;
      sim.restore();
      shotLive = false;
      if (strokes >= MAX_STROKES) holeOut(true);
    });
  }

  function onRest() {
    shotLive = false;
    const b = sim.ball;
    const cp = sim.cupPos();
    cam.aimAz = Math.atan2(cp[1] - b.y, cp[0] - b.x);
    kb.angle = cam.aimAz;
    if (strokes >= MAX_STROKES && !finished) holeOut(true);
  }

  // ---------- HUD and screens ----------
  function updateHud() {
    if (!round) return;
    $('hudNo').textContent = round.practice ? 'Practice' : `Hole ${round.idx + 1} of ${round.ids.length}`;
    $('hudName').textContent = hole.name;
    $('hudSpecial').textContent = hole.special;
    $('hudPar').textContent = hole.par;
    $('hudStrokes').textContent = strokes;
    const t = totals();
    const live = finished ? t.d : t.d + (strokes ? strokes - hole.par : 0);
    $('hudTotal').textContent = round.practice ? '–' : (round.scores.length || strokes ? vsPar(live) : 'E');
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

  function show(id) {
    ['title', 'book', 'card', 'pause'].forEach(k => { $(k).hidden = k !== id; });
  }

  function mark(score, par) {
    const d = score - par;
    return score === 1 ? 'ace' : d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 1 ? 'bogey' : d >= 2 ? 'double' : '';
  }

  function cardTable(ids, scores, offset, title) {
    let par = 0, tot = 0, done = true;
    const head = ids.map((id, i) => `<th scope="col">${offset + i + 1}</th>`).join('');
    const names = ids.map(id => `<td class="nm" title="${PC.holeById(id).name}">${PC.holeById(id).name.split(' ')[0]}</td>`).join('');
    const pars = ids.map(id => { const p = PC.holeById(id).par; par += p; return `<td>${p}</td>`; }).join('');
    const sc = ids.map((id, i) => {
      const s = scores[offset + i];
      if (s === undefined) { done = false; return '<td class="sc"></td>'; }
      tot += s;
      return `<td class="sc"><span class="pencil ${mark(s, PC.holeById(id).par)}">${s}</span></td>`;
    }).join('');
    return `<table class="sheet"><thead><tr><th scope="row">Hole</th>${head}<th scope="col">${title}</th></tr></thead>
      <tbody><tr class="names"><th scope="row">Garden</th>${names}<td></td></tr>
      <tr><th scope="row">Par</th>${pars}<td class="tot">${par}</td></tr>
      <tr><th scope="row">Score</th>${sc}<td class="tot"><span class="pencil">${done || tot ? tot : ''}</span></td></tr></tbody></table>`;
  }

  function showCard() {
    if (!round) return;
    state = 'card';
    world.hideAim();
    const last = round.idx >= round.ids.length - 1;
    const t = totals();
    const ids = round.ids;
    let html = '';
    if (ids.length > 9) html = cardTable(ids.slice(0, 9), round.scores, 0, 'Out') + cardTable(ids.slice(9), round.scores, 9, 'In');
    else html = cardTable(ids, round.scores, 0, 'Tot');
    $('cardSheet').innerHTML = html;
    const sc = round.scores[round.idx];
    if (round.practice) {
      $('cardEyebrow').textContent = 'Practice';
      $('cardTitle').textContent = hole.name;
      $('cardSummary').textContent = `${label(sc, hole.par)} in ${sc} stroke${sc === 1 ? '' : 's'}. Your best here: ${save.holeBest[hole.id] || sc}.`;
      $('cardNext').textContent = 'Play it again';
      $('cardAlt').textContent = 'Course book';
      $('cardAlt').hidden = false;
    } else if (!last) {
      $('cardEyebrow').textContent = `After ${round.idx + 1} of ${ids.length}`;
      $('cardTitle').textContent = `${vsPar(t.d)} so far`;
      const nx = PC.holeById(ids[round.idx + 1]);
      $('cardSummary').textContent = `Next up: ${nx.name}, par ${nx.par}.`;
      $('cardNext').textContent = 'Next hole';
      $('cardAlt').hidden = true;
    } else {
      const n = ids.length;
      const prev = save.best[n];
      const better = !prev || t.s < prev.s;
      if (better) save.best[n] = { s: t.s, d: t.d };
      save.rounds = (save.rounds || 0) + 1;
      persist();
      $('cardEyebrow').textContent = `${n}-hole round complete`;
      $('cardTitle').textContent = `${t.s} strokes · ${vsPar(t.d)}`;
      const aces = round.scores.filter(s => s === 1).length;
      $('cardSummary').textContent = (better ? (prev ? `A new best for ${n} holes (was ${prev.s}).` : `Your first ${n}-hole round is on the board.`) : `Your best for ${n} holes is ${prev.s} (${vsPar(prev.d)}).`) + (aces ? ` ${aces} hole${aces > 1 ? 's' : ''} in one!` : '');
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
    if (round.finished) { startRound(round.ids.length); return; }
    round.idx++;
    beginHole();
  }
  function cardAlt() {
    audio.play('click');
    if (round.practice) openBook(); else toTitle();
  }

  function toTitle() {
    clearTimers();
    round = null;
    $('hud').hidden = true; $('intro').hidden = true; $('toast').hidden = true;
    const spec = PC.HOLES[Math.floor(Math.random() * PC.HOLES.length)];
    loadHole(spec);
    cam.cur = null;
    state = 'title';
    renderBests();
    show('title');
  }

  function renderBests() {
    const b = save.best;
    const f = n => (b[n] ? `${b[n].s} (${vsPar(b[n].d)})` : '—');
    $('bests').innerHTML = `<span>Best 3: <b>${f(3)}</b></span><span>Best 9: <b>${f(9)}</b></span><span>Best 18: <b>${f(18)}</b></span>` + (save.aces ? `<span>Holes in one: <b>${save.aces}</b></span>` : '');
  }

  function openBook() {
    clearTimers();
    state = state === 'title' ? 'title' : 'book';
    $('hud').hidden = true; $('intro').hidden = true;
    const grid = $('bookGrid');
    if (!grid.dataset.built) {
      grid.dataset.built = '1';
      PC.HOLES.forEach(h => {
        const btn = document.createElement('button');
        btn.className = 'hole-card';
        btn.type = 'button';
        btn.innerHTML = `<canvas width="240" height="300" aria-hidden="true"></canvas><span class="hc-no">${h.num}</span><span class="hc-name">${h.name}</span><span class="hc-sp">${h.special}</span><span class="hc-meta">Par ${h.par} · <span data-best="${h.id}"></span></span>`;
        btn.addEventListener('click', () => { audio.unlock(); audio.play('click'); startPractice(h.id); });
        grid.appendChild(btn);
        drawMap(btn.querySelector('canvas'), PC.prepareHole(h));
      });
    }
    grid.querySelectorAll('[data-best]').forEach(el => { const v = save.holeBest[el.dataset.best]; el.textContent = v ? `your best ${v}` : 'not played yet'; });
    show('book');
  }

  // A little top-down plan of a hole for the course book.
  function drawMap(cv, h) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const b = h.box, pad = 18;
    const s = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h);
    const ox = W / 2 - b.cx * s, oy = H / 2 + b.cy * s;
    const P = (x, y) => [ox + x * s, oy - y * s];
    const path = (pts, close = true) => { g.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); if (close) g.closePath(); };
    g.clearRect(0, 0, W, H);
    h.hazards.forEach(z => { path(z.poly); g.fillStyle = z.kind === 'water' ? '#7cc3dd' : '#f3a6c3'; g.fill(); });
    h.floors.forEach(f => { path(f.poly); g.fillStyle = f.mat === 'planks' ? '#b0773f' : '#6fbf4f'; g.fill(); });
    h.zones.forEach(z => { path(z.poly); g.fillStyle = { slime: '#c7f06b', honey: '#f2b236', soil: '#8a5f3a', seeds: '#6b4220' }[z.type] || '#999'; g.fill(); });
    g.lineCap = 'round'; g.lineJoin = 'round';
    h.rails.forEach(r => { if (r.style === 'none') return; path(r.pts, r.closed); g.strokeStyle = r.style === 'hedge' ? '#2f6b2a' : '#7a4a26'; g.lineWidth = Math.max(2, (r.side === 'center' ? r.w : 0.2) * s); g.stroke(); });
    h.posts.forEach(p => { const q = P(p.x, p.y); g.beginPath(); g.arc(q[0], q[1], p.r * s, 0, 7); g.fillStyle = '#8f897d'; g.fill(); });
    const t = P(h.tee[0], h.tee[1]); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(t[0], t[1], 4, 0, 7); g.fill();
    const c = P(h.cup[0], h.cup[1]); g.fillStyle = '#1b2a22'; g.beginPath(); g.arc(c[0], c[1], 4.5, 0, 7); g.fill();
    g.strokeStyle = '#1b2a22'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[0], c[1] - 16); g.stroke();
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
    // fit the hole: its extent along and across the view direction
    const along = Math.abs(Math.cos(az)) * b.w + Math.abs(Math.sin(az)) * b.h;
    const across = Math.abs(Math.sin(az)) * b.w + Math.abs(Math.cos(az)) * b.h;
    const fov = (world.camera.fov * Math.PI) / 180;
    const need = Math.max(along * 0.62, across / Math.max(0.6, asp) * 0.95);
    const dist = (need / Math.tan(fov / 2)) * 0.7 + 3.5;
    // nudge the aim point toward the near end so the tee clears the bottom of the screen
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
    const moving = shotLive || !sim.resting();
    if (moving) {
      return { tx: bx, ty: by, th: bz, az: cam.cur ? cam.cur.az : cam.aimAz, el: 0.7, dist: 6.6 * cam.zoom };
    }
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

  // The dotted guide: a straight run to the first wall, then a short bounce.
  function guide(angle, power) {
    const b = sim.ball;
    let v = 0.5 + (C.MAXV - 0.5) * Math.pow(power, 1.15), d = 0;
    while (v > 0.05) { v -= (C.FRIC + C.LIN * v) / 60; d += v / 60; }
    let len = Math.min(d, 11), x = b.x, y = b.y, dx = Math.cos(angle), dy = Math.sin(angle);
    const pts = [], step = 0.05;
    let travelled = 0, bounced = false, nextDot = 0.3;
    while (travelled < len) {
      x += dx * step; y += dy * step; travelled += step;
      let hit = null;
      for (const s of hole.segs) {
        if (s.r === 0.03 && s.h === 0) continue;
        const q = U.closestOnSeg(x, y, s.ax, s.ay, s.bx, s.by);
        const dd = Math.hypot(x - q[0], y - q[1]);
        if (dd < s.r + C.R) { hit = [(x - q[0]) / (dd || 1), (y - q[1]) / (dd || 1)]; break; }
      }
      if (!hit) for (const p of hole.posts) { const dd = Math.hypot(x - p.x, y - p.y); if (dd < p.r + C.R) { hit = [(x - p.x) / dd, (y - p.y) / dd]; break; } }
      if (hit) {
        if (bounced) break;
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

  function showAim(angle, power) {
    const b = sim.ball;
    world.showAim(b.x, b.y, b.z, angle, power, guide(angle, power));
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
    shotLive = true; lastRest = false;
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
    if (e.button === 2 || pointers.size > 1) {
      aim = null; hideAim();
      orbit = { x: e.clientX, y: e.clientY, d: pinchDist() };
      return;
    }
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
      if (pointers.size > 1) {
        const pd = pinchDist();
        if (orbit.d && pd) cam.zoom = U.clamp(cam.zoom * (orbit.d / pd), 0.5, 2.4);
        orbit.d = pd;
      }
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
    document.querySelectorAll('[data-sfx]').forEach(el => { el.textContent = save.sfx ? 'Sound on' : 'Sound off'; el.setAttribute('aria-pressed', String(save.sfx)); });
    document.querySelectorAll('[data-music]').forEach(el => { el.textContent = save.music ? 'Music on' : 'Music off'; el.setAttribute('aria-pressed', String(save.music)); });
  }

  // ---------- main loop ----------
  const SOUND = { wall: 'wall', post: 'post', paddle: 'paddle', gate: 'gate', bonk: 'bonk', squish: 'squish', tire: 'tire' };
  function handleEvents() {
    for (const e of sim.events) {
      if (state === 'title') continue;
      if (SOUND[e.type]) audio.play(SOUND[e.type], { k: (e.speed || 2) / 2.5 });
      else if (e.type === 'bumper') { audio.play('bumper'); world.burst('spark', e.x, e.y, 0.3, { color: '#ffd27a', n: 12 }); }
      else if (e.type === 'launch') { audio.play('launch'); world.burst('puff', sim.ball.x, sim.ball.y, 0.1, { color: '#ffffff' }); }
      else if (e.type === 'tunnel') { audio.play('tunnel'); world.burst('puff', sim.ball.x, sim.ball.y, 0, { color: '#8a6a4a', n: 16 }); }
      else if (e.type === 'popout') { audio.play('popout'); world.burst('puff', e.x, e.y, 0, { color: '#8a6a4a', n: 16 }); }
      else if (e.type === 'boost') audio.play('boost');
      else if (e.type === 'switch') audio.play('switch');
      else if (e.type === 'lip') audio.play('lip');
      else if (e.type === 'land' && e.speed > 0.8) { audio.play('land', { k: e.speed / 2 }); world.burst('puff', sim.ball.x, sim.ball.y, sim.ball.z - C.R, { n: 6 }); }
      else if (e.type === 'sink') { audio.play('sink'); holeOut(false); }
      else if (e.type === 'lost') lost(e);
    }
    sim.events.length = 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!sim) return;
    if (state !== 'pause') {
      clock += dt;
      acc += dt;
      let n = 0;
      while (acc >= C.DT && n < 30) { sim.step(C.DT); acc -= C.DT; n++; }
      if (n >= 30) acc = 0;
      handleEvents();
    }
    // keyboard aiming
    if (kb.on && canAim()) {
      kb.angle += kb.rot * (kb.fine ? 0.25 : 1.1) * dt;
      kb.power = U.clamp(kb.power + kb.pw * 0.6 * dt, 0.03, 1);
      cam.aimAz = kb.angle;
      showAim(kb.angle, kb.power);
    } else if (!aim && $('power').hidden === false && !kb.on) hideAim();
    if (kb.on && !canAim()) { kb.on = false; hideAim(); }
    if (aim && !canAim()) { aim = null; hideAim(); }
    // the ball has stopped after a putt
    const resting = sim.resting();
    if (state === 'play' && shotLive && resting && !finished) onRest();
    lastRest = resting;
    // wind gusts get a sound
    const wind = sim.feats.find(f => f.type === 'wind');
    if (wind && state !== 'title') { if (wind.gust > 0.05 && gustWas <= 0.05) audio.play('gust'); gustWas = wind.gust; }
    if (state !== 'title') audio.ambient(clock);
    updateCam(dt);
    world.update(clock, dt, sim);
    world.render();
  }

  // ---------- wiring ----------
  function bind(id, fn) { const el = $(id); if (el) el.addEventListener('click', e => { audio.unlock(); fn(e); }); }
  bind('play9', () => { audio.play('click'); startRound(9); });
  bind('play3', () => { audio.play('click'); startRound(3); });
  bind('play18', () => { audio.play('click'); startRound(18); });
  bind('openBook', () => { audio.play('click'); openBook(); });
  bind('bookBack', () => { audio.play('click'); toTitle(); });
  bind('cardNext', cardNext);
  bind('cardAlt', cardAlt);
  bind('btnView', toggleView);
  bind('btnMenu', pause);
  bind('resume', resume);
  bind('quit', () => { audio.play('click'); toTitle(); });
  bind('introGo', go);
  document.querySelectorAll('[data-sfx]').forEach(el => el.addEventListener('click', toggleSound));
  document.querySelectorAll('[data-music]').forEach(el => el.addEventListener('click', toggleMusic));
  bind('rotL', () => { if (cam.mode === 'overview') cam.overAz += 0.35; else { cam.aimAz += 0.35; kb.angle = cam.aimAz; } });
  bind('rotR', () => { if (cam.mode === 'overview') cam.overAz -= 0.35; else { cam.aimAz -= 0.35; kb.angle = cam.aimAz; } });
  window.addEventListener('resize', () => world.resize());
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });

  // When the published page is updated while someone is mid-round, keep their round:
  // the holes dealt and the scores so far. The hole in play starts again from the tee.
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => (round && !round.finished ? { round: { ids: round.ids, idx: round.idx, scores: round.scores, practice: round.practice } } : {}));

  function boot(data) {
    syncSoundUi();
    requestAnimationFrame(t => { last = t; frame(t); });
    document.body.classList.add('ready');
    const r = data && data.round;
    if (r && Array.isArray(r.ids) && r.ids.every(id => PC.holeById(id))) {
      round = { ids: r.ids, idx: Math.min(r.idx, r.ids.length - 1), scores: (r.scores || []).slice(0, r.idx), practice: !!r.practice };
      beginHole();
    } else toTitle();
  }
  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(() => { if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {}); });

  // for tests
  PC.game = { startRound, startPractice, get state() { return state; }, get sim() { return sim; }, go, shoot, cam, world, toTitle, openBook, showCard };
})(window.PC = window.PC || {});
