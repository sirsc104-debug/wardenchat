/* Apples to Oranges — a pretend Warden Chat / Supabase, for the accounts demo build and for testing
   the account and race screens before the real back end exists. NOT loaded by index.html (the
   demo build, `build-artifact.py --accounts-demo`, adds it). It answers the same Supabase Auth
   calls and a2o_* database functions that ACCOUNTS-API.md and RACES-API.md specify, but keeps
   everything in this browser's localStorage, and adds a small DEMO bar (go offline, have a friend
   answer, get a race invite, add a racer, start over). Load it after js/account.js and before
   js/accountui.js. Ported from Brain Rocket's js/account-mock.js. */
'use strict';

(function () {
  const KEY = 'a2o.mockServer', DELAY = 350;
  const rid = p => p + Math.random().toString(36).slice(2, 10);
  const DIFFS = ['owen', 'medium', 'hard', 'ultra'];
  function seed() {
    const users = [
      { id: 'u-demo', username: 'demo', password: 'oranges12345' },
      { id: 'u-sam', username: 'Sam_W', password: 'x' }, { id: 'u-luna', username: 'luna', password: 'x' },
      { id: 'u-owen', username: 'Owen.K', password: 'x' }, { id: 'u-mia', username: 'mia-r', password: 'x' }, { id: 'u-jay', username: 'jaybird', password: 'x' },
      { id: 'u-pip', username: 'pip_squeak', password: 'x' }, { id: 'u-zed', username: 'zed', password: 'x' }
    ];
    const doc = bests => ({ schema: 1, bests });
    return {
      users, tokens: {}, offline: false, races: [], raceInvites: [],
      progress: {
        'u-demo': { rev: 1, doc: doc({ classic: { owen: 4210, medium: 1980 }, race: { medium: 2140 } }) },
        'u-sam': { rev: 1, doc: doc({ classic: { owen: 6120, medium: 3305, hard: 900 }, race: { medium: 2875, hard: 3610 } }) },
        'u-luna': { rev: 1, doc: doc({ classic: { owen: 2280 }, guess: { owen: 1400 } }) },
        'u-jay': { rev: 1, doc: doc({ classic: { owen: 3900, ultra: 12450 }, race: { medium: 1760, ultra: 6020 } }) }
      },
      wins: { 'u-sam': 3, 'u-jay': 1 },
      friendships: [['u-demo', 'u-sam'], ['u-demo', 'u-luna'], ['u-demo', 'u-jay'], ['u-demo', 'u-pip'], ['u-demo', 'u-zed']],
      requests: [{ id: 'r-1', from: 'u-owen', to: 'u-demo' }, { id: 'r-2', from: 'u-demo', to: 'u-mia' }]
    };
  }
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { return seed(); } };
  const save = db => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } };
  const R = (status, data) => ({ status, data: data === undefined ? null : data });
  const byName = (db, s) => db.users.find(u => u.username.toLowerCase() === String(s).trim().toLowerCase());
  const byId = (db, id) => db.users.find(u => u.id === id);
  const fail = msg => R(400, { code: 'P0001', message: msg, details: null, hint: null });
  function session(db, u) {
    const at = rid('at-'), rt = rid('rt-');
    db.tokens[at] = u.id; db.tokens[rt] = u.id;
    return { access_token: at, refresh_token: rt, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: u.id, email: u.username.toLowerCase() + '@warden.invalid', user_metadata: { username: u.username } } };
  }
  const friendsOf = (db, id) => db.friendships.filter(f => f.includes(id)).map(f => (f[0] === id ? f[1] : f[0]));

  function handle(method, url, headers, body) {
    const db = load(), u = new URL(url), path = u.pathname;
    body = body || {};
    if (path === '/auth/v1/token') {
      if (u.searchParams.get('grant_type') === 'password') {
        const usr = byName(db, String(body.email || '').split('@')[0]);
        if (!usr || usr.password !== body.password) return R(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        const s = session(db, usr); save(db); return R(200, s);
      }
      const id = db.tokens[body.refresh_token];
      if (!id) return R(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
      delete db.tokens[body.refresh_token];
      const s = session(db, byId(db, id)); save(db); return R(200, s);
    }
    if (path === '/auth/v1/signup') {
      const name = (body.data && body.data.username) || '';
      if (byName(db, name)) return R(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      if (String(body.password).length < 10) return R(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 10 characters.' });
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(name)) return R(500, { code: 500, error_code: 'unexpected_failure', msg: 'Database error saving new user' });
      const usr = { id: rid('u-'), username: name, password: body.password };
      db.users.push(usr);
      const s = session(db, usr); save(db); return R(200, s);
    }
    if (path === '/auth/v1/logout') { delete db.tokens[(headers.Authorization || '').slice(7)]; save(db); return R(204); }

    const fn = path.replace('/rest/v1/rpc/', ''), me = db.tokens[(headers.Authorization || '').slice(7)];
    if (fn === 'a2o_ping') return R(200, true);
    if (!me) return R(401, { code: 'PGRST301', message: 'JWT expired' });
    // Warden Chat's own function: works for suspended accounts too
    if (fn === 'my_account_state') {
      const usr = byId(db, me), sus = usr.restricted;
      return R(200, { active: !sus, status: sus ? sus.status : 'active', reason: sus ? sus.reason : null, restrictedUntil: sus ? sus.until : null });
    }
    // a suspended or banned account is refused as not signed in
    if (byId(db, me).restricted) return fail('a2o_not_signed_in');
    if (fn === 'a2o_get_progress') { const p = db.progress[me]; return R(200, { doc: p ? p.doc : null, rev: p ? p.rev : 0 }); }
    if (fn === 'a2o_save_progress') {
      const p = db.progress[me] || { rev: 0, doc: null };
      if ((body.base_rev || 0) !== p.rev) return R(200, { ok: false, conflict: true, doc: p.doc, rev: p.rev });
      db.progress[me] = { rev: p.rev + 1, doc: body.doc }; save(db);
      return R(200, { ok: true, rev: p.rev + 1 });
    }
    if (fn === 'a2o_friends') {
      return R(200, {
        friends: friendsOf(db, me).map(id => ({ user_id: id, username: byId(db, id).username, bests: (db.progress[id] && db.progress[id].doc && db.progress[id].doc.bests) || {}, race_wins: db.wins[id] || 0 })),
        incoming: db.requests.filter(r => r.to === me).map(r => ({ request_id: r.id, username: byId(db, r.from).username })),
        outgoing: db.requests.filter(r => r.from === me).map(r => ({ request_id: r.id, username: byId(db, r.to).username }))
      });
    }
    if (fn === 'a2o_friend_request') {
      const t = byName(db, body.target_username);
      if (!t) return fail('a2o_user_not_found');
      if (t.id === me) return fail('a2o_self');
      if (friendsOf(db, me).includes(t.id)) return fail('a2o_already_friends');
      if (db.requests.some(r => r.from === me && r.to === t.id)) return fail('a2o_already_requested');
      const back = db.requests.find(r => r.from === t.id && r.to === me);
      if (back) { db.requests = db.requests.filter(r => r !== back); db.friendships.push([me, t.id]); save(db); return R(200, { status: 'accepted' }); }
      db.requests.push({ id: rid('r-'), from: me, to: t.id }); save(db);
      return R(200, { status: 'sent' });
    }
    if (fn === 'a2o_friend_respond') {
      const r = db.requests.find(x => x.id === body.request_id && x.to === me);
      if (!r) return fail('a2o_request_not_found');
      db.requests = db.requests.filter(x => x !== r);
      if (body.accept) db.friendships.push([r.from, me]);
      save(db); return R(204);
    }
    if (fn === 'a2o_friend_cancel') {
      const r = db.requests.find(x => x.id === body.request_id && x.from === me);
      if (!r) return fail('a2o_request_not_found');
      db.requests = db.requests.filter(x => x !== r); save(db); return R(204);
    }
    if (fn === 'a2o_friend_remove') { db.friendships = db.friendships.filter(f => !(f.includes(me) && f.includes(body.friend_id))); save(db); return R(204); }
    if (fn.startsWith('a2o_race_')) return race(db, me, fn, body);
    return R(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  }

  // ---- Pretend live races. Everyone in a race except you is a pretend racer: invited friends join
  // after a moment, a lobby a pretend friend hosts starts on its own, and pretend racers answer at
  // a pace of their own, a few points at a time.
  const CODE = '23456789ABCDEFGHJKMNPQRSTVWXYZ', LEN = 60;
  const newCode = db => { let c; do { c = Array.from({ length: 6 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join(''); } while (db.races.some(r => r.code === c && /lobby|racing/.test(r.status))); return c; };
  const iso = t => (t ? new Date(t).toISOString() : null);
  const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  // a pretend racer answers every 2 to 3.5 seconds, for more points as its streak grows
  function pretendScore(id, round, secs) {
    const h = Math.abs(hash(id + '#' + round)), every = 2 + (h % 16) / 10, base = 12 + (h % 23);
    const answers = Math.floor(secs / every);
    let s = 0;
    for (let i = 0; i < answers; i++) s += Math.round(base * (1 + 0.25 * Math.min(16, i % 9)) * (((h >> (i % 13)) & 3) ? 1 : 0));   // about one in four is wrong
    return { score: s, correct: answers - Math.floor(answers / 4) };
  }
  const freeFruit = r => { const used = new Set(r.players.filter(p => !p.left).map(p => p.fruit)); for (let i = 0; i < 8; i++) if (!used.has(i)) return i; return 0; };
  const addPlayer = (r, id) => r.players.push({ user_id: id, fruit: freeFruit(r), score: 0, correct: 0, finished: false, left: false, joined: Date.now() });
  function settleRace(db, r, human) {
    const t = Date.now();
    if (r.status === 'lobby') {
      db.raceInvites.filter(i => i.race_id === r.id && i.joinAt && i.joinAt <= t && i.to_id !== human).forEach(i => {
        if (r.players.length < 8 && !r.players.some(p => p.user_id === i.to_id)) addPlayer(r, i.to_id);
        db.raceInvites = db.raceInvites.filter(x => x !== i);
      });
      if (r.autoStartAt && r.autoStartAt <= t && r.players.length >= 2) startRace(db, r);
    }
    if (r.status === 'racing') {
      const el = Math.max(0, (Math.min(t, r.ends_at) - r.starts_at) / 1000);
      r.players.forEach(p => {
        if (p.user_id === human || p.left || p.finished) return;
        Object.assign(p, pretendScore(p.user_id, r.round || 1, el));
        if (t >= r.ends_at + 800) p.finished = true;
      });
      const active = r.players.filter(p => !p.left);
      if (active.every(p => p.finished) || t > r.ends_at + 15000) {
        r.status = 'finished';
        active.forEach(p => { p.finished = true; });
        const top = active.slice().sort((a, b) => b.score - a.score)[0];
        if (top && active.length >= 2) db.wins[top.user_id] = (db.wins[top.user_id] || 0) + 1;
        // pretend racers vote to play again after a moment
        r.players.forEach(p => { if (p.user_id !== human && !p.left) p.voteAt = t + 1500 + Math.random() * 2500; });
      }
    }
    if (r.status === 'finished') {
      r.players.forEach(p => { if (p.voteAt && p.voteAt <= t) { p.voted = true; delete p.voteAt; } });
      nextRound(db, r);
    }
  }
  // everyone still in has voted yes: the next round, with new matchups
  function nextRound(db, r) {
    const still = r.players.filter(p => !p.left);
    if (still.length < 2 || !still.every(p => p.voted)) return;
    r.round = (r.round || 1) + 1; r.seed = Math.floor(Math.random() * 2 ** 31);
    r.players = still;
    still.forEach(p => Object.assign(p, { score: 0, correct: 0, finished: false, voted: false }));
    r.status = 'racing'; r.starts_at = Date.now() + 6000; r.ends_at = r.starts_at + LEN * 1000;
  }
  function startRace(db, r) { r.status = 'racing'; r.starts_at = Date.now() + 6000; r.ends_at = r.starts_at + LEN * 1000; db.raceInvites = db.raceInvites.filter(i => i.race_id !== r.id); }
  function stateOf(db, r, human) {
    settleRace(db, r, human);
    return {
      race_id: r.id, code: r.code, host_id: r.host_id, diff: r.diff, len: LEN, seed: r.seed, round: r.round || 1, status: r.status,
      starts_at: iso(r.starts_at), ends_at: iso(r.ends_at), server_now: new Date().toISOString(),
      players: r.players.map(p => ({ user_id: p.user_id, username: byId(db, p.user_id).username, fruit: p.fruit, is_host: p.user_id === r.host_id, score: p.score, correct: p.correct, finished: p.finished, left: p.left, voted: !!p.voted })),
      invited: r.status === 'lobby' ? db.raceInvites.filter(i => i.race_id === r.id).map(i => ({ user_id: i.to_id, username: byId(db, i.to_id).username })) : []
    };
  }
  function leaveAll(db, me, except) {
    db.races.filter(r => r.id !== except && /lobby|racing|finished/.test(r.status) && r.players.some(p => p.user_id === me)).forEach(r => leaveRace(db, r, me));
  }
  function leaveRace(db, r, me) {
    if (r.status === 'lobby') {
      r.players = r.players.filter(p => p.user_id !== me);
      if (!r.players.length) r.status = 'closed';
      else if (r.host_id === me) r.host_id = r.players[0].user_id;
    } else { const p = r.players.find(x => x.user_id === me); if (p) { p.left = true; p.voted = false; } nextRound(db, r); }
  }
  function makeRace(db, host, diff) {
    const r = { id: rid('race-'), code: newCode(db), host_id: host, diff, seed: Math.floor(Math.random() * 2 ** 31), status: 'lobby', created: Date.now(), players: [] };
    addPlayer(r, host);
    db.races.push(r);
    return r;
  }
  function race(db, me, fn, b) {
    const find = id => db.races.find(r => r.id === id && r.players.some(p => p.user_id === me));
    const out = r => { const st = stateOf(db, r, me); save(db); return R(200, st); };
    if (fn === 'a2o_race_create') {
      if (!DIFFS.includes(b.diff)) return fail('a2o_bad_race');
      leaveAll(db, me);
      return out(makeRace(db, me, b.diff));
    }
    if (fn === 'a2o_race_join') {
      const r = db.races.slice().reverse().find(x => x.code === String(b.code || '').trim().toUpperCase());
      if (!r) return fail('a2o_race_not_found');
      settleRace(db, r, me);
      if (r.players.some(p => p.user_id === me && !p.left) && r.status !== 'closed') return out(r);
      if (r.status === 'racing') return fail('a2o_race_started');
      if (r.status !== 'lobby') return fail('a2o_race_closed');
      if (r.players.length >= 8) return fail('a2o_race_full');
      leaveAll(db, me, r.id);
      addPlayer(r, me);
      db.raceInvites = db.raceInvites.filter(i => !(i.race_id === r.id && i.to_id === me));
      if (r.host_id !== me && !r.autoStartAt) r.autoStartAt = Date.now() + 8000;   // a pretend host starts once you're in
      return out(r);
    }
    if (fn === 'a2o_race_invites') {
      const list = db.raceInvites.filter(i => i.to_id === me).map(i => ({ i, r: db.races.find(x => x.id === i.race_id) })).filter(x => x.r && x.r.status === 'lobby' && x.r.players.length < 8);
      return R(200, list.reverse().map(({ i, r }) => ({ race_id: r.id, code: r.code, from_username: byId(db, i.from_id).username, diff: r.diff, players: r.players.length, created_at: iso(i.at) })));
    }
    if (fn === 'a2o_race_decline') { db.raceInvites = db.raceInvites.filter(i => !(i.race_id === b.race_id && i.to_id === me)); save(db); return R(204); }
    const r = find(b.race_id);
    if (!r) return fn === 'a2o_race_leave' ? R(204) : fail('a2o_race_not_found');
    settleRace(db, r, me);
    if (fn === 'a2o_race_state') return out(r);
    if (fn === 'a2o_race_leave') { leaveRace(db, r, me); save(db); return R(204); }
    if (fn === 'a2o_race_fruit') {
      if (r.status !== 'lobby') return fail('a2o_race_started');
      const f = b.fruit | 0;
      if (f < 0 || f > 7) return fail('a2o_bad_race');
      if (r.players.some(p => p.user_id !== me && !p.left && p.fruit === f)) return fail('a2o_fruit_taken');
      r.players.find(p => p.user_id === me).fruit = f;
      return out(r);
    }
    if (fn === 'a2o_race_invite') {
      if (r.status !== 'lobby') return fail('a2o_race_started');
      if (!friendsOf(db, me).includes(b.friend_id)) return fail('a2o_not_friends');
      if (!r.players.some(p => p.user_id === b.friend_id) && !db.raceInvites.some(i => i.race_id === r.id && i.to_id === b.friend_id))
        db.raceInvites.push({ race_id: r.id, from_id: me, to_id: b.friend_id, at: Date.now(), joinAt: Date.now() + 2500 });
      save(db); return R(204);
    }
    if (fn === 'a2o_race_start') {
      if (r.host_id !== me) return fail('a2o_not_host');
      if (r.status !== 'lobby') return fail('a2o_race_started');
      if (r.players.length < 2) return fail('a2o_need_players');
      startRace(db, r); return out(r);
    }
    if (fn === 'a2o_race_progress' || fn === 'a2o_race_finish') {
      const p = r.players.find(x => x.user_id === me), t = Date.now();
      if (r.status === 'racing' && p && !p.finished && !p.left && t >= r.starts_at && t <= r.ends_at + 15000) {
        p.score = Math.max(p.score, Math.min(250000, Math.round(b.score) || 0)); p.correct = Math.max(p.correct, Math.min(200, b.correct | 0));
        if (fn === 'a2o_race_finish') p.finished = true;
      }
      return out(r);
    }
    if (fn === 'a2o_race_vote') {
      if (r.status === 'racing') return fail('a2o_race_started');
      if (r.status !== 'finished') return fail('a2o_race_not_found');
      if (!b.again) { leaveRace(db, r, me); return out(r); }
      if (r.players.filter(p => !p.left).length < 2) return fail('a2o_need_players');
      r.players.find(x => x.user_id === me).voted = true;
      nextRound(db, r);
      return out(r);
    }
    return R(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  }

  Account.useTransport((method, url, headers, body) => new Promise((resolve, reject) => {
    setTimeout(() => {
      if (load().offline) reject(new TypeError('Failed to fetch'));
      else resolve(handle(method, url, headers, body === undefined ? undefined : JSON.parse(JSON.stringify(body))));
    }, DELAY);
  }));

  // ---- The DEMO bar ----
  const bar = document.createElement('div');
  bar.id = 'mockBar';
  bar.innerHTML = '<b>DEMO</b> <span class="mk-hint">Pretend Warden Chat accounts ·</span> try <code>demo</code> / <code>oranges12345</code>' +
    ' <button type="button" data-m="offline"></button> <button type="button" data-m="friend">👥 A friend answers</button> <button type="button" data-m="invite">📨 Get a race invite</button> <button type="button" data-m="racer">🍉 Add a racer</button> <button type="button" data-m="ban">🚫 Suspend me</button> <button type="button" data-m="wipe">↺ Start over</button>';
  const style = document.createElement('style');
  style.textContent = '#mockBar{position:fixed;left:0;right:0;bottom:4px;margin:0 auto;width:max-content;z-index:60;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;' +
    'max-width:calc(100% - 16px);padding:6px 10px;border-radius:12px;background:rgba(10,14,34,.92);border:1px solid #ffd23f;color:#f4f7ff;font:13px/1.3 system-ui,sans-serif}' +
    '@media (max-width:1000px){#mockBar .mk-hint{display:none}#mockBar{font-size:11px;padding:4px 8px}}#mockBar b{color:#ffd23f}#mockBar code{background:rgba(255,255,255,.12);padding:0 4px;border-radius:4px}' +
    '#mockBar button{font:inherit;color:inherit;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:3px 8px;cursor:pointer}';
  document.head.appendChild(style);
  document.body.appendChild(bar);
  const paint = () => { bar.querySelector('[data-m="offline"]').textContent = load().offline ? '📶 Back online' : '✈️ Go offline'; };
  paint();
  bar.addEventListener('click', e => {
    const m = e.target.dataset.m;
    if (!m) return;
    const db = load();
    if (m === 'offline') { db.offline = !db.offline; save(db); paint(); window.dispatchEvent(new Event(db.offline ? 'offline' : 'online')); return; }
    const me = Account.user && byName(db, Account.user.username);
    if (m !== 'wipe' && !me) { AccountUI.toast('Sign in first (<code>demo</code> / <code>oranges12345</code>), then try this.', 'warn'); return; }
    if (m === 'friend') {
      // someone you asked says yes, or else someone new asks you
      const out = db.requests.find(r => r.from === me.id);
      if (out) {
        db.requests = db.requests.filter(r => r !== out); db.friendships.push([me.id, out.to]);
        AccountUI.toast(`<b>${byId(db, out.to).username}</b> accepted your friend request.`, 'good');
      } else {
        let other = db.users.find(u => u.id !== me.id && !friendsOf(db, me.id).includes(u.id) && !db.requests.some(r => r.from === u.id && r.to === me.id));
        if (!other) { other = { id: rid('u-'), username: 'player' + Math.floor(Math.random() * 900 + 100), password: 'x' }; db.users.push(other); }
        db.requests.push({ id: rid('r-'), from: other.id, to: me.id });
        AccountUI.toast(`<b>${other.username}</b> sent you a friend request.`, 'good');
      }
      save(db); Account.loadFriends();
    } else if (m === 'invite') {
      // a pretend friend hosts a lobby with someone else in it, and invites you
      const others = db.users.filter(u => u.id !== me.id).sort(() => Math.random() - 0.5);
      const r = makeRace(db, others[0].id, DIFFS[Math.floor(Math.random() * 3)]);
      addPlayer(r, others[1].id);
      db.raceInvites.push({ race_id: r.id, from_id: others[0].id, to_id: me.id, at: Date.now() });
      save(db); AccountUI.toast(`Done: <b>${others[0].username}</b> will invite you within 10 seconds (or open the Fruit Dash tab).`, 'good');
    } else if (m === 'racer') {
      const r = db.races.find(x => x.status === 'lobby' && x.players.some(p => p.user_id === me.id));
      if (!r) { AccountUI.toast('Open a race lobby first (Fruit Dash → Host a race), then add pretend racers.', 'warn'); return; }
      const who = db.users.find(u => u.id !== me.id && !r.players.some(p => p.user_id === u.id));
      if (!who || r.players.length >= 8) { AccountUI.toast('The race is full: 8 fruits.', 'warn'); return; }
      addPlayer(r, who.id);
      save(db);
    } else if (m === 'ban') {
      // what an admin does on Warden Chat: suspend (with a reason) or lift it
      const usr = byId(db, me.id);
      usr.restricted = usr.restricted ? null : { status: 'suspended', reason: 'Sending rude messages in group chats.', until: null };
      save(db);
      e.target.textContent = usr.restricted ? '✅ Unsuspend me' : '🚫 Suspend me';
      AccountUI.toast(usr.restricted ? 'An admin suspended you. Apples to Oranges notices on its next sync.' : 'Suspension lifted. Press “Check again”.', 'warn');
      Account.syncNow();
    } else if (m === 'wipe') {
      ['a2o.mockServer', 'a2o.session', 'a2o.lastSync'].forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  });
})();
