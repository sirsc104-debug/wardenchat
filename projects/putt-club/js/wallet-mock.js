/* Putt Club: a pretend Warden Chat back end, for the demo build only (build-artifact.py --wallet-demo).
   It answers the same Supabase Auth and database calls the real one will (docs/ECONOMY-PUTT.md,
   docs/ONLINE-PUTT.md and the SirSC wallet's docs/ECONOMY-API.md), keeps the wallet in this browser's
   storage, and starts every new demo account with coins and diamonds to spend. Online rooms are filled
   by pretend friends who really play each hole (in a Web Worker, with the same physics and aiming as
   the rivals) and report their putts the way a real player's game would. Nothing here touches a real
   account. Loaded right after wallet.js, so it only reads the other files' globals when called. */
'use strict';
(() => {
  const KEY = 'puttclub-demo-db';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const mem = load() || { users: {}, wallets: {}, owned: {}, requests: [], rewards: [] };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* storage blocked: in memory only */ } };
  const R = (status, data) => Promise.resolve({ status, data });
  const fail = code => R(400, { code: 'P0001', message: code });
  const uid = name => 'demo-' + name.toLowerCase();
  const day = () => new Date().toISOString().slice(0, 10);
  const catalog = () => PUTT_CATALOG;

  function tokenFor(u) {
    return { access_token: 'demo.' + u.id + '.' + Date.now(), refresh_token: 'demo-refresh.' + u.id, expires_in: 3600,
      user: { id: u.id, email: u.name.toLowerCase() + '@warden.invalid', user_metadata: { username: u.name } } };
  }
  function userOf(headers) {
    const m = /^Bearer demo\.(demo-[^.]+)\./.exec(headers.Authorization || '');
    return m && mem.users[m[1]] ? mem.users[m[1]] : null;
  }
  function wallet(id) {
    if (!mem.wallets[id]) mem.wallets[id] = { coins: 40000, diamonds: 10, member_until: null, member_month: null };
    return mem.wallets[id];
  }
  const isMember = w => !!(w.member_until && Date.parse(w.member_until) > Date.now());
  function meOf(id) {
    const w = wallet(id);
    return { coins: w.coins, diamonds: w.diamonds, member: isMember(w), member_until: w.member_until, admin: false,
      owned: (mem.owned[id] || []).map(item_id => ({ item_id, target: '' })), catalog: catalog(),
      requests: mem.requests.filter(r => r.user_id === id).slice(-10).reverse(), server_now: new Date().toISOString() };
  }
  const owns = (id, item) => (mem.owned[id] || []).includes(item);
  const give = (id, item) => { (mem.owned[id] = mem.owned[id] || []).push(item); };

  /* ---------- the wallet (sirsc_*) and putt_reward ---------- */
  const BASE = { owen: 400, medium: 800, hard: 1500, ultra: 3000 }, PLACE = [1, 0.6, 0.4, 0.25];
  function reward(b, id, w) {
    const base = BASE[b.diff], holes = b.holes | 0;
    const ok = base && (holes === 9 || holes === 18) && b.strokes >= holes && b.strokes <= holes * 16 && b.par >= holes * 2 && b.par <= holes * 11 &&
      b.place >= 1 && b.place <= 4 && b.aces >= 0 && b.aces <= holes && b.duration_ms >= holes * 20000 && b.duration_ms <= 4 * 3600e3;
    if (!ok) return fail('sirsc_bad_reward');
    if (mem.rewards.filter(r => r.user_id === id && Date.now() - r.at < 3600e3).length >= 12) return fail('sirsc_rate_limited');
    const today = day(), mine = mem.rewards.filter(r => r.user_id === id && r.day === today);
    const holesM = holes === 18 ? 2 : 1, placeM = PLACE[b.place - 1], memberM = isMember(w) ? 1.5 : 1;
    const under = Math.min(3000, 150 * Math.max(0, b.par - b.strokes)), aces = 500 * Math.min(3, b.aces);
    const first = b.place === 1 && !mine.some(r => r.win) ? 1500 : 0;
    let coins = Math.floor(base * holesM * placeM * memberM) + under + aces + first;
    const earned = mine.reduce((t, r) => t + r.coins, 0), left = Math.max(0, 25000 - earned), capped = coins > left;
    coins = Math.min(coins, left);
    w.coins += coins;
    mem.rewards.push({ user_id: id, day: today, at: Date.now(), coins, win: b.place === 1 });
    save();
    return R(200, { coins, base, holes_mult: holesM, place_mult: placeM, member_mult: memberM, under_par_bonus: under, ace_bonus: aces,
      first_win_bonus: first, capped, today: earned + coins, daily_cap: 25000, me: meOf(id) });
  }
  function rpc(fn, b, u) {
    if (fn === 'putt_ping') return R(200, true);
    if (fn === 'my_account_state') return R(200, { active: true });
    if (!u) return fail(fn.startsWith('putt_') ? 'putt_not_signed_in' : 'sirsc_not_signed_in');
    const id = u.id, w = wallet(id);
    if (fn === 'sirsc_me') return R(200, meOf(id));
    if (fn === 'sirsc_member_claim') {
      const out = { diamonds_added: 0, claimed: [] };
      if (isMember(w)) {
        const month = new Date().toISOString().slice(0, 7);
        if (w.member_month !== month) { w.member_month = month; w.diamonds += 5; out.diamonds_added = 5; }
        const t = Date.now();
        for (const c of catalog()) {
          if (!c.member_only || owns(id, c.item_id)) continue;
          if (c.claim_from && !(Date.parse(c.claim_from) <= t && t < Date.parse(c.claim_until))) continue;
          give(id, c.item_id); out.claimed.push(c.item_id);
        }
        save();
      }
      out.me = meOf(id);
      return R(200, out);
    }
    if (fn === 'sirsc_buy') {
      const c = catalog().find(x => x.item_id === b.item_id);
      if (!c || b.game !== 'putt') return fail('sirsc_unknown_item');
      if (c.member_only) return fail('sirsc_member_only');
      const cost = b.currency === 'coins' ? c.coins : b.currency === 'diamonds' ? c.diamonds : null;
      if (!cost) return fail('sirsc_wrong_currency');
      if (owns(id, c.item_id)) return fail('sirsc_owned');
      if ((b.currency === 'coins' ? w.coins : w.diamonds) < cost) return fail('sirsc_not_enough');
      if (b.currency === 'coins') w.coins -= cost; else w.diamonds -= cost;
      give(id, c.item_id); save();
      return R(200, meOf(id));
    }
    if (fn === 'sirsc_request_diamonds') {
      const n = b.diamonds | 0;
      if (n < 5 || n > 500 || n % 5) return fail('sirsc_bad_request');
      if (mem.requests.filter(r => r.user_id === id && r.status === 'pending').length >= 3) return fail('sirsc_too_many_requests');
      mem.requests.push({ id: 'req-' + Date.now(), user_id: id, diamonds: n, note: b.note || '', status: 'pending', created_at: new Date().toISOString() });
      save(); return R(200, meOf(id));
    }
    if (fn === 'sirsc_cancel_request') {
      const r = mem.requests.find(x => x.id === b.request_id && x.user_id === id);
      if (!r || r.status !== 'pending') return fail('sirsc_request_closed');
      r.status = 'cancelled'; save(); return R(200, meOf(id));
    }
    // demo only: pretend SirSC gave this account a month of membership
    if (fn === 'demo_membership') { w.member_until = new Date(Date.now() + 30 * 864e5).toISOString(); save(); return R(200, meOf(id)); }
    if (fn === 'putt_reward') return reward(b, id, w);
    if (fn.startsWith('putt_online_')) return online(fn, b, u);
    return R(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  }

  /* ---------- online rooms (docs/ONLINE-PUTT.md) with pretend friends ---------- */
  const FRIENDS = [
    { username: 'Putt_Pal', member: true, avatar: 'fox', ball: 'sunny', skill: 0.62 },
    { username: 'BirdieBea', member: false, avatar: 'penguin', ball: 'ruby', skill: 0.5 },
    { username: 'Chip_Shot', member: false, avatar: 'cactus', ball: 'classic', skill: 0.42 },
  ];
  const rooms = {};   // in memory only: a demo room lasts as long as the page
  const code = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
  const POOLS = { garden: () => PC.HOLES, canyon: () => PC.CANYON, winter: () => PC.WINTER, abyss: () => PC.ABYSS };
  const ASSIST = { owen: 1.7, medium: 1, hard: 1, ultra: 1 };
  const COURSE_OF = { owen: 'garden', medium: 'canyon', hard: 'winter', ultra: 'abyss' };
  const ownedOr = (id, kind, v, def) => (v && v !== def && owns(id, kind + ':' + v) ? v : def);

  // The friends think in a worker built from the same physics source as the page.
  let worker = null, wreq = 0;
  const wcb = new Map();
  function friendMain(PC) {
    const prepared = {}, fields = {};
    const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    self.onmessage = e => {
      const m = e.data;
      try {
        const H = prepared[m.holeId] || (prepared[m.holeId] = PC.prepareHole(PC.holeById(m.holeId)));
        const F = fields[m.holeId] || (fields[m.holeId] = {});
        const DT = PC.C.DT, sim = new PC.Sim(H, m.opts), rnd = PC.U.rng(m.seed), max = PC.maxStrokes(H), k = 1 - m.skill;
        if (sim.ground(m.x, m.y).kind === 'floor') sim.place(m.x, m.y);
        const shots = [];
        let strokes = 0, sunk = false;
        while (strokes < max && !sunk) {
          const think = Math.round((1.4 + rnd() * 2.4) / DT);
          for (let i = 0; i < think; i++) sim.step(DT);
          const plan = PC.Nav.choose(sim, PC.Nav.fieldFor(H, sim, F), { n: Math.round(10 + m.skill * 16), seed: Math.floor(rnd() * 1e9), waits: [0], maxT: 7,
            wobble: 0.012 + k * 0.05, pwobble: 0.02 + k * 0.08, check: 4 }) || { ang: rnd() * Math.PI * 2, p: 0.3 };
          const angle = plan.ang + gauss(rnd) * k * 0.1, power = Math.min(1, Math.max(0.03, plan.p * (1 + gauss(rnd) * k * 0.16)));
          const shot = { stroke: strokes + 1, step: sim.steps, angle: +angle.toFixed(6), power: +power.toFixed(6), x: +sim.ball.x.toFixed(4), y: +sim.ball.y.toFixed(4) };
          sim.events.length = 0;
          sim.shoot(shot.angle, shot.power);
          strokes++;
          let result = 'rest';
          for (let g = 0; g < 60 / DT; g++) {
            sim.step(DT);
            if (sim.ball.mode === 'sunk') { result = 'sunk'; break; }
            if (sim.ball.mode === 'lost') { result = 'lost'; break; }
            if (sim.resting()) break;
          }
          if (result === 'sunk') { const cp = sim.cupPos(); shot.ex = +cp[0].toFixed(4); shot.ey = +cp[1].toFixed(4); sunk = true; for (let i = 0; i < 0.5 / DT; i++) sim.step(DT); }
          else if (result === 'lost') {
            strokes++;
            const lostSteps = Math.round(1.3 / DT);
            for (let i = 0; i < lostSteps; i++) sim.step(DT);
            sim.restore();
            shot.ex = +sim.ball.x.toFixed(4); shot.ey = +sim.ball.y.toFixed(4);
          } else { shot.ex = +sim.ball.x.toFixed(4); shot.ey = +sim.ball.y.toFixed(4); }
          shot.result = result;
          shot.end = sim.steps;
          shots.push(shot);
        }
        self.postMessage({ id: m.id, shots, strokes: sunk ? Math.max(1, strokes) : max, end: sim.steps });
      } catch (err) { self.postMessage({ id: m.id, error: String((err && err.message) || err) }); }
    };
  }
  function playHole(msg, cb) {
    if (!worker) {
      try {
        const src = 'self.window = self;\nconst PC = {};\n' + PC.SRC.map(f => '(' + f.toString() + ')(PC);').join('\n') + '\n(' + friendMain.toString() + ')(PC);';
        worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        worker.onmessage = e => { const f = wcb.get(e.data.id); wcb.delete(e.data.id); if (f) f(e.data); };
      } catch (e) { worker = null; }
    }
    if (!worker) { cb({ shots: [], strokes: 3, end: 2400 }); return; }
    const id = ++wreq;
    wcb.set(id, cb);
    worker.postMessage(Object.assign({ id }, msg));
  }

  // Where each friend's ball starts: the same spots the game gives ghost balls (online.js, PC.Remote).
  function startSpot(holeId, i) {
    const h = PC.holeById(holeId), [tx, ty] = h.tee, a = Math.atan2(h.cup[1] - ty, h.cup[0] - tx);
    const [side, back] = [[0.5, -0.1], [-0.5, -0.1], [0, -0.55]][i % 3];
    return [tx + Math.cos(a + Math.PI / 2) * side + Math.cos(a) * back, ty + Math.sin(a + Math.PI / 2) * side + Math.sin(a) * back];
  }
  function newRoom(diff, holes, seatYou, hostSeat) {
    const r = { room_id: 'room-' + Date.now() + '-' + Math.floor(Math.random() * 1e4), code: code(), diff, holes, status: 'waiting', host: hostSeat, you: seatYou,
      created: Date.now(), players: [], shots: [], scores: [], seq: 0, hole_ids: null, friends: [], joinAt: [], startAt: 0, holeStart: {} };
    rooms[r.room_id] = r;
    return r;
  }
  function addFriend(r, f) {
    const seat = [0, 1, 2, 3].find(s => !r.players.some(p => p.seat === s));
    r.players.push({ seat, username: f.username, member: f.member, avatar: f.avatar, ball: f.ball, left: false, seen: 0 });
    r.friends.push({ seat, skill: f.skill, holes: {} });
  }
  function deal(r) {
    const pool = POOLS[COURSE_OF[r.diff]]().map(h => h.id).sort(() => Math.random() - 0.5);
    r.hole_ids = pool.slice(0, r.holes);
    r.status = 'playing';
    r.holeStart[0] = Date.now() + 2500;
    r.friends.forEach(f => planHole(r, f, 0));
  }
  // A friend plays hole idx in the worker; its putts are released as their balls stop, in real time.
  function planHole(r, f, idx) {
    if (f.holes[idx]) return;
    f.holes[idx] = { pending: true };
    const order = r.players.filter(p => p.seat !== r.you && !p.left).sort((a, b) => a.seat - b.seat).findIndex(p => p.seat === f.seat);
    const [x, y] = startSpot(r.hole_ids[idx], Math.max(0, order));
    playHole({ holeId: r.hole_ids[idx], opts: { assist: ASSIST[r.diff] }, skill: f.skill, seed: Math.floor(Math.random() * 1e9), x, y },
      res => { f.holes[idx] = { shots: res.shots || [], strokes: res.strokes || PC.maxStrokes(PC.holeById(r.hole_ids[idx])), end: res.end || 0, sent: 0, scored: false }; });
  }
  function tick(r) {
    const now = Date.now();
    if (r.status === 'waiting') {
      while (r.joinAt.length && now >= r.joinAt[0]) {
        r.joinAt.shift();
        const f = FRIENDS.find(x => !r.players.some(p => p.username === x.username));
        if (f && r.players.length < 4) addFriend(r, f);
      }
      if (r.startAt && now >= r.startAt) deal(r);
      return;
    }
    if (r.status !== 'playing') return;
    const DT = PC.C.DT;
    for (const f of r.friends) {
      for (const k of Object.keys(f.holes)) {
        const idx = +k, h = f.holes[idx], t0 = r.holeStart[idx];
        if (h.pending || t0 == null || now < t0) continue;
        while (h.sent < h.shots.length && now >= t0 + h.shots[h.sent].end * DT * 1000 + 250) {
          const s = h.shots[h.sent++];
          r.shots.push({ seq: ++r.seq, seat: f.seat, hole: idx, stroke: s.stroke, step: s.step, angle: s.angle, power: s.power, x: s.x, y: s.y, ex: s.ex, ey: s.ey, result: s.result });
        }
        if (!h.scored && h.sent >= h.shots.length && now >= t0 + h.end * DT * 1000 + 600) {
          h.scored = true;
          r.scores.push({ seat: f.seat, hole: idx, strokes: h.strokes });
          maybeNext(r, idx);
        }
      }
    }
  }
  // Everyone has finished hole idx: the friends start the next one when you would (after the scorecard).
  function maybeNext(r, idx) {
    const active = r.players.filter(p => !p.left);
    if (!active.every(p => r.scores.some(s => s.seat === p.seat && s.hole === idx))) return;
    if (idx + 1 >= r.holes) { r.status = 'finished'; return; }
    if (r.holeStart[idx + 1] == null) r.holeStart[idx + 1] = Date.now() + 4500;
    r.friends.forEach(f => planHole(r, f, idx + 1));
  }
  function stateOf(r, since) {
    return { room_id: r.room_id, code: r.code, status: r.status, diff: r.diff, holes: r.holes, host: r.host, you: r.you, hole_ids: r.hole_ids,
      players: r.players.map(p => ({ seat: p.seat, username: p.username, member: p.member, avatar: p.avatar, ball: p.ball, left: p.left, seen: p.seen })),
      shots: r.shots.filter(s => s.seq > (since || 0)), scores: r.scores.slice(), server_now: new Date().toISOString() };
  }
  function online(fn, b, u) {
    const id = u.id, me = { username: u.name, member: isMember(wallet(id)), avatar: ownedOr(id, 'avatar', b.avatar, 'golfer'), ball: ownedOr(id, 'ball', b.ball, 'classic'), left: false, seen: 0 };
    const mine = Object.values(rooms).filter(r => r.status !== 'finished' && r.status !== 'cancelled' && r.players.some(p => p.username === u.name && !p.left));
    if (fn === 'putt_online_create') {
      if (!BASE[b.diff] || (b.holes !== 9 && b.holes !== 18)) return fail('putt_bad_setup');
      if (mine.length >= 3) return fail('putt_too_many_games');
      const r = newRoom(b.diff, b.holes, 0, 0);
      r.players.push(Object.assign({ seat: 0 }, me));
      r.joinAt = [Date.now() + 2500, Date.now() + 6500];
      return R(200, stateOf(r, 0));
    }
    if (fn === 'putt_online_join') {
      // Any code joins a room a pretend friend has just made; the friend tees off a few seconds later.
      if (!/^[A-Z]{5}$/.test(String(b.code || ''))) return fail('putt_no_such_game');
      if (mine.length >= 3) return fail('putt_too_many_games');
      const diffs = ['owen', 'medium', 'hard'];
      const r = newRoom(diffs[Math.floor(Math.random() * diffs.length)], 9, 1, 0);
      r.code = b.code;
      addFriend(r, FRIENDS[0]);
      r.players.push(Object.assign({ seat: 1 }, me));
      r.joinAt = [Date.now() + 2000];
      r.startAt = Date.now() + 5500;
      return R(200, stateOf(r, 0));
    }
    const r = rooms[b.room_id];
    const you = r && r.players.find(p => p.seat === r.you);
    if (!r || !you || you.username !== u.name) return fail('putt_no_such_game');
    if (fn === 'putt_online_state') { tick(r); return R(200, stateOf(r, b.since)); }
    if (fn === 'putt_online_start') {
      if (r.host !== r.you) return fail('putt_not_host');
      if (r.status !== 'waiting') return fail('putt_game_started');
      if (r.players.filter(p => !p.left).length < 2) return fail('putt_need_players');
      r.joinAt = [];
      deal(r);
      return R(200, stateOf(r, 0));
    }
    if (fn === 'putt_online_shot') {
      if (r.status !== 'playing') return fail('putt_game_over');
      if (!(b.hole >= 0 && b.hole < r.holes) || !(b.stroke >= 1 && b.stroke <= 20) || !['rest', 'sunk', 'lost'].includes(b.result)) return fail('putt_bad_shot');
      if (r.shots.some(s => s.seat === r.you && s.hole === b.hole && s.stroke === b.stroke)) return R(200, { ok: true });
      r.shots.push({ seq: ++r.seq, seat: r.you, hole: b.hole, stroke: b.stroke, step: b.step, angle: b.angle, power: b.power, x: b.x, y: b.y, ex: b.ex, ey: b.ey, result: b.result });
      return R(200, { ok: true });
    }
    if (fn === 'putt_online_hole') {
      if (r.status !== 'playing') return fail('putt_game_over');
      if (!(b.hole >= 0 && b.hole < r.holes) || !(b.strokes >= 1 && b.strokes <= 20)) return fail('putt_bad_shot');
      if (!r.scores.some(s => s.seat === r.you && s.hole === b.hole)) r.scores.push({ seat: r.you, hole: b.hole, strokes: b.strokes });
      maybeNext(r, b.hole);
      return R(200, stateOf(r, 0));
    }
    if (fn === 'putt_online_leave') {
      you.left = true;
      if (r.status === 'waiting' && r.host === r.you) r.status = 'cancelled';
      return R(200, stateOf(r, 0));
    }
    return R(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  }

  function handle(method, url, headers, body) {
    const path = url.replace(PUTT_CONFIG.supabaseUrl, '');
    if (path.startsWith('/auth/v1/token?grant_type=password') || path === '/auth/v1/signup') {
      const name = String((body.data && body.data.username) || body.email.split('@')[0]).trim();
      if (!Account.RULES.nameRe.test(name) || name.length < 3) return R(400, { msg: 'Database error saving new user' });
      if (String(body.password || '').length < 10) return R(400, { msg: 'Invalid login credentials' });
      const id = uid(name);
      if (!mem.users[id]) { mem.users[id] = { id, name }; save(); }
      return R(200, tokenFor(mem.users[id]));
    }
    if (path.startsWith('/auth/v1/token?grant_type=refresh_token')) {
      const id = String(body.refresh_token || '').replace('demo-refresh.', '');
      return mem.users[id] ? R(200, tokenFor(mem.users[id])) : R(400, { error_code: 'refresh_token_not_found' });
    }
    if (path.startsWith('/auth/v1/logout')) return R(204, null);
    const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
    if (m) return rpc(m[1], body || {}, userOf(headers));
    return R(404, { message: 'not found' });
  }

  window.PUTT_DEMO = true;
  Account.useTransport((method, url, headers, body) => new Promise(res => setTimeout(() => res(handle(method, url, headers, body)), 120)));
})();
