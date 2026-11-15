/* Putt Club online: 2 to 4 signed-in players in a room, on the same holes at the same time.
   One player creates a room on a course and gets a 5-letter code; friends join with it; the host
   starts, and the server deals the holes (docs/ONLINE-PUTT.md). Everyone plays their own ball in
   their own copy of the hole; each putt is sent once it has finished rolling (where it was hit from,
   the physics step it was hit on, its angle, strength and where it ended up) and every other player's
   game replays it in a copy of the hole, so friends show as ghost balls just like the rivals do. The
   replay follows the same physics; if a device's maths ever drifts, the ghost is put where the ball
   really stopped. Hole scores are reported when each player holes out. Moves travel by polling. */
'use strict';

const Online = (() => {
  const q = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const POLL_MS = 1200;
  const SEAT_COLORS = ['#4fd1c5', '#ff6b3d', '#b58cff', '#ffd23f'];
  let room = null;           // the latest state of the room you're in
  let since = 0, timer = 0, polling = false, token = 0, holes = 9, msg = '';
  const shotsSeen = new Set();
  let onShots = null, onState = null;
  const ERR = {
    putt_no_such_game: 'No room has that code. Check it with your friend.',
    putt_game_full: 'That room already has 4 players.',
    putt_game_started: 'That room has already teed off.',
    putt_too_many_games: 'You’re already in 3 rooms. Leave one first.',
    putt_need_players: 'You need at least one friend in the room to start.',
    putt_not_host: 'Only the player who made the room can start it.',
    putt_bad_setup: 'That room setup isn’t possible.',
    not_deployed: 'Online play isn’t switched on yet on Warden Chat.',
    offline: 'Can’t reach Warden Chat. Check your connection.',
  };
  const err = e => ERR[e && e.code] || 'Something went wrong. Try again in a moment.';
  const call = (fn, p) => Account.rpc(fn, p);
  const available = () => Account.status !== 'unavailable' && Account.status !== 'checking';
  const me = () => (room ? room.players.find(p => p.seat === room.you) : null);
  const colorOf = seat => SEAT_COLORS[seat % SEAT_COLORS.length];

  /* ---------- the Play online tab of the menu ---------- */
  function menuCards(DIFFS, ORDER, COURSE) {
    if (!available()) return `<div class="ol-panel"><p class="ol-note">Online play opens when Warden Chat accounts are switched on for Putt Club.</p></div>`;
    if (Account.status !== 'signedIn') return `<div class="ol-panel"><p class="ol-note">Sign in with your Warden Chat account to play friends online.</p><button type="button" class="btn primary" data-shop="signin">Sign in</button></div>`;
    const seg = `<div class="ol-seg" role="group" aria-label="Holes">${[9, 18].map(n => `<button type="button" data-ol-holes="${n}" class="${holes === n ? 'on' : ''}">${n} holes</button>`).join('')}</div>`;
    return ORDER.map(id => {
      const m = DIFFS[id];
      return `<button class="mode-card ${m.cls}" type="button" data-ol-create="${id}"><span class="mode-icon">${m.icon}</span><span class="mode-name">${m.name}</span><span class="mode-tag">The ${COURSE[m.course]}</span><span class="mode-info">Make a room<br><small>${holes} holes, up to 4 players</small></span><span class="mode-best">Create room</span></button>`;
    }).join('') + `<div class="ol-side">${seg}<form class="ol-join" id="olJoin"><input id="olCodeIn" maxlength="5" autocomplete="off" spellcheck="false" placeholder="CODE" aria-label="Room code"><button class="btn primary" type="submit">Join</button></form>${msg ? `<p class="ol-err" role="alert">${esc(msg)}</p>` : ''}</div>`;
  }

  /* ---------- the room (waiting to tee off) ---------- */
  function renderRoom() {
    const el = q('#room');
    if (!room || room.status !== 'waiting') { el.hidden = true; return; }
    el.hidden = false;
    const host = room.you === room.host, n = room.players.filter(p => !p.left).length;
    const D = PC.game.DIFFS[room.diff];
    q('#roomBody').innerHTML = `
      <span class="eyebrow">Online room · ${D.name} · The ${PC.game.COURSE[D.course]} · ${room.holes} holes</span>
      <h2>Room code</h2>
      <div class="ol-code" id="olCode">${room.code}</div>
      <button type="button" class="btn small" data-ol="copy">Copy code</button>
      <ul class="ol-players">${[0, 1, 2, 3].map(seat => {
        const p = room.players.find(x => x.seat === seat && !x.left);
        return p ? `<li><i style="background:${colorOf(seat)}"></i><span class="av">${avatarIcon(p.avatar)}</span><b>${esc(p.username)}${p.member ? SIRSC_BADGE_SVG : ''}</b>${seat === room.host ? '<span class="tag">Host</span>' : ''}${seat === room.you ? '<span class="tag you">You</span>' : ''}</li>`
          : '<li class="empty"><i></i><span class="av">·</span><b>Waiting for a friend…</b></li>';
      }).join('')}</ul>
      <p class="ol-note">${host ? (n < 2 ? 'Send the code to up to three friends. They choose <b>Play online</b> and type it in.' : 'Tee off when everyone is here.') : 'Waiting for the host to tee off.'}<span class="thinking"><i></i><i></i><i></i></span></p>
      <div class="sc-actions">${host ? `<button type="button" class="btn primary" data-ol="start" ${n < 2 ? 'disabled' : ''}>Tee off</button>` : ''}<button type="button" class="btn" data-ol="leave">Leave room</button></div>
      <p class="ol-note small">Online rounds don’t earn coins yet. Everyone plays their own ball; friends show as ghost balls.</p>
      ${msg ? `<p class="ol-err" role="alert">${esc(msg)}</p>` : ''}`;
  }

  /* ---------- talking to the server ---------- */
  function take(st) {
    if (!st) return;
    const was = room && room.status;
    room = st;
    for (const s of st.shots || []) {
      if (s.seq > since) since = s.seq;
      const k = s.seat + ':' + s.hole + ':' + s.stroke;
      if (shotsSeen.has(k)) continue;
      shotsSeen.add(k);
      if (s.seat !== st.you && onShots) onShots(s);
    }
    if (onState) onState(st);
    if (was === 'waiting' && st.status === 'playing') { q('#room').hidden = true; PC.game.startOnline(st); }
    renderRoom();
    if (st.status === 'cancelled') { stop(); room = null; msg = 'The host closed the room.'; PC.game.renderMenu(); }
  }
  function begin(st) {
    since = 0; shotsSeen.clear(); msg = '';
    take(st);
    startPolling();
  }
  function create(diff) {
    msg = '';
    call('putt_online_create', { diff, holes, avatar: Look.worn().avatar, ball: Look.worn().ball }).then(begin, e => { msg = err(e); PC.game.renderMenu(); });
  }
  function join(code) {
    msg = '';
    call('putt_online_join', { code: code.trim().toUpperCase(), avatar: Look.worn().avatar, ball: Look.worn().ball }).then(begin, e => { msg = err(e); PC.game.renderMenu(); });
  }
  function startPolling() {
    stop();
    const my = ++token;
    polling = true;
    const tick = () => {
      if (my !== token || !room) return;
      call('putt_online_state', { room_id: room.room_id, since }).then(st => { if (my === token) take(st); }, () => {}).finally(() => { if (my === token && polling) timer = setTimeout(tick, POLL_MS); });
    };
    timer = setTimeout(tick, POLL_MS);
  }
  function stop() { polling = false; token++; clearTimeout(timer); }
  function leave() {
    if (!room) return Promise.resolve();
    const id = room.room_id;
    stop(); room = null; q('#room').hidden = true;
    return call('putt_online_leave', { room_id: id }).catch(() => null);
  }

  /* During a round: report each putt once it stops, and each hole once it's holed. */
  function shot(s) {
    if (!room) return;
    call('putt_online_shot', Object.assign({ room_id: room.room_id }, s)).catch(() => null);
  }
  function hole(idx, strokes) {
    if (!room) return;
    call('putt_online_hole', { room_id: room.room_id, hole: idx, strokes }).then(take, () => null);
  }

  /* ---------- wiring ---------- */
  function init() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-ol],[data-ol-create],[data-ol-holes]');
      if (!t) return;
      PC.game.sfx('click');
      if (t.dataset.olHoles) { holes = +t.dataset.olHoles; PC.game.renderMenu(); return; }
      if (t.dataset.olCreate) { create(t.dataset.olCreate); return; }
      const a = t.dataset.ol;
      if (a === 'copy') { try { navigator.clipboard.writeText(room.code); PC.game.toast('Copied', room.code, 'good'); } catch (x) { /* clipboard blocked */ } }
      if (a === 'start') call('putt_online_start', { room_id: room.room_id }).then(take, x => { msg = err(x); renderRoom(); });
      if (a === 'leave') leave().then(() => PC.game.renderMenu());
    });
    document.addEventListener('submit', e => {
      if (e.target.id !== 'olJoin') return;
      e.preventDefault();
      const code = q('#olCodeIn').value;
      if (code.trim().length === 5) join(code); else { msg = 'Room codes have 5 letters.'; PC.game.renderMenu(); }
    });
    Account.on(() => { if (Account.status !== 'signedIn' && room) leave(); });
  }

  return {
    init, menuCards, leave, shot, hole, colorOf,
    get room() { return room; },
    onShots(fn) { onShots = fn; }, onState(fn) { onState = fn; },
  };
})();

/* Friends' balls in a round: each one replays the putts its player reports, in its own copy of the
   hole, with the same interface the rivals have (setHole, stepPhysics, update, allDone…). */
PC.Remote = class Remote {
  constructor() { this.list = []; this.hole = null; }
  setHole(hole, roster, opts) {
    this.hole = hole; this.opts = opts; this.max = PC.maxStrokes(hole);
    const [tx, ty] = hole.tee, a = Math.atan2(hole.cup[1] - ty, hole.cup[0] - tx);
    const spots = [[0.5, -0.1], [-0.5, -0.1], [0, -0.55]];
    this.list = roster.map((p, i) => {
      const r = { name: p.name, color: p.color, icon: p.icon, seat: p.seat, sim: new PC.Sim(hole, opts), strokes: 0, done: false, picked: false, away: false, queue: [], cur: null, lostAt: -1, reported: null, events: [] };
      const [side, back] = spots[i % spots.length];
      const x = tx + Math.cos(a + Math.PI / 2) * side + Math.cos(a) * back, y = ty + Math.sin(a + Math.PI / 2) * side + Math.sin(a) * back;
      if (r.sim.ground(x, y).kind === 'floor') r.sim.place(x, y);
      r.rest = r.sim.snapshot();
      return r;
    });
    return this.list;
  }
  clear() { this.list = []; }
  byseat(seat) { return this.list.find(r => r.seat === seat); }
  // A putt someone made on this hole (or a later one, kept for when you get there).
  addShot(s) { const r = this.byseat(s.seat); if (r && !r.done) { r.queue.push(s); r.queue.sort((a, b) => a.stroke - b.stroke); } }
  setReported(seat, strokes) { const r = this.byseat(seat); if (r) r.reported = strokes; }
  setAway(seat, away) { const r = this.byseat(seat); if (r) r.away = away; }
  stepPhysics(dt) {
    const LOST_STEPS = Math.round(1.3 / PC.C.DT);
    for (const r of this.list) {
      if (r.done) continue;
      const s = r.sim;
      if (!r.cur && r.queue.length) {
        const shot = r.queue.shift();
        // Start the putt on the step it was hit: catch up from the last rest if we're behind.
        if (shot.step < s.steps) { r.sim = new PC.Sim(this.hole, this.opts).load(r.rest); }
        const sim = r.sim;
        let guard = 0;
        while (sim.steps < shot.step && guard++ < 240 * 180) sim.step(PC.C.DT);
        sim.events.length = 0;
        if (Math.hypot(sim.ball.x - shot.x, sim.ball.y - shot.y) > 0.03 || sim.ball.mode !== 'roll') sim.place(shot.x, shot.y);
        sim.shoot(shot.angle, shot.power);
        r.cur = shot; r.strokes = Math.max(r.strokes, shot.stroke);
        continue;
      }
      s.step(dt);
      if (!r.cur) continue;
      const b = s.ball;
      if (b.mode === 'lost' && r.lostAt < 0) { r.lostAt = s.steps; r.events.push({ type: 'lost', rival: r, kind: b.lostKind, x: b.x, y: b.y }); }
      if (r.lostAt >= 0 && s.steps - r.lostAt >= LOST_STEPS) { s.restore(); r.lostAt = -1; this.endShot(r); continue; }
      if (b.mode === 'sunk' && b.timer > 0.4) { this.endShot(r); continue; }
      if (b.mode === 'roll' && s.t > 0 && s.resting() && r.lostAt < 0) this.endShot(r);
    }
  }
  // A replayed putt has finished: put the ball where it really stopped.
  endShot(r) {
    const shot = r.cur, s = r.sim;
    r.cur = null;
    if (shot.result === 'sunk') { if (s.ball.mode !== 'sunk') { s.ball.mode = 'sunk'; s.ball.timer = 9; } r.sunk = true; }
    else if (shot.result === 'rest' && (s.ball.mode !== 'roll' || Math.hypot(s.ball.x - shot.ex, s.ball.y - shot.ey) > 0.05)) s.place(shot.ex, shot.ey);
    else if (shot.result === 'lost' && s.ball.mode !== 'roll') s.restore();
    s.events.length = 0;
    r.rest = s.snapshot();
  }
  update() {
    const events = [];
    for (const r of this.list) {
      events.push(...r.events); r.events = [];
      if (r.done) continue;
      if (r.reported != null && !r.cur && !r.queue.length) {
        r.done = true; r.strokes = r.reported; r.picked = r.reported >= this.max && !r.sunk;
        events.push({ type: r.picked ? 'pickup' : 'sink', rival: r });
      }
    }
    return events;
  }
  allDone() { return this.list.every(r => r.done || r.away); }
  forceFinish() { this.list.forEach(r => { if (!r.done) { r.done = true; r.picked = true; r.strokes = r.reported != null ? r.reported : this.max; } }); }
};
