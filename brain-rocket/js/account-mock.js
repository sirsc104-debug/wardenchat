/* Brain Rocket — a pretend Warden Chat / Supabase, for the accounts preview build and for testing the
   account screens before the real back end exists. NOT loaded by index.html. It answers the same
   Supabase Auth calls and br_* database functions that ACCOUNTS-API.md specifies, but keeps
   everything in this browser's localStorage, and adds a small DEMO bar (go offline, have a friend
   answer, start over). Load it after js/account.js and before js/accountui.js. */
'use strict';

(function () {
  const KEY = 'brainRocket.mockServer', DELAY = 400;
  const rid = p => p + Math.random().toString(36).slice(2, 10);
  const day = () => Daily.dayNumber();
  const doc = (today, streak) => ({ schema: 1, bests: {}, daily: today ? { [day()]: Object.assign({ day: day(), done: true, crashed: false, marks: [] }, today) } : {}, dailyStreak: streak ? { last: day(), count: streak } : null });
  function seed() {
    const users = [
      { id: 'u-demo', username: 'demo', password: 'rocket12345' },
      { id: 'u-sam', username: 'Sam_W', password: 'x' }, { id: 'u-luna', username: 'luna', password: 'x' },
      { id: 'u-owen', username: 'Owen.K', password: 'x' }, { id: 'u-mia', username: 'mia-r', password: 'x' }, { id: 'u-jay', username: 'jaybird', password: 'x' }
    ];
    return {
      users, tokens: {}, offline: false,
      progress: {
        'u-demo': { rev: 1, doc: { schema: 1, bests: { hard: { score: 48210, place: 'Mars', icon: '🔴' }, 'sub:medium': { score: 3120, place: 'Midnight Zone', icon: '🦑' } }, daily: {}, dailyStreak: null } },
        'u-sam': { rev: 1, doc: doc({ score: 1240, marks: [0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 0, 3, 0, 1] }, 6) },
        'u-luna': { rev: 1, doc: doc(null, 0) },
        'u-jay': { rev: 1, doc: doc({ score: 860, marks: [0, 1, 1, 2, -1, 0, 0, 1, 2, 0, 1, 3, 0, 1, -1] }, 2) }
      },
      friendships: [['u-demo', 'u-sam'], ['u-demo', 'u-luna'], ['u-demo', 'u-jay']],
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
    if (fn === 'br_ping') return R(200, true);
    if (!me) return R(401, { code: 'PGRST301', message: 'JWT expired' });
    if (fn === 'br_get_progress') { const p = db.progress[me]; return R(200, { doc: p ? p.doc : null, rev: p ? p.rev : 0 }); }
    if (fn === 'br_save_progress') {
      const p = db.progress[me] || { rev: 0, doc: null };
      if ((body.base_rev || 0) !== p.rev) return R(200, { ok: false, conflict: true, doc: p.doc, rev: p.rev });
      db.progress[me] = { rev: p.rev + 1, doc: body.doc }; save(db);
      return R(200, { ok: true, rev: p.rev + 1 });
    }
    if (fn === 'br_friends') {
      const d = body.day;
      const today = id => { const p = db.progress[id], r = p && p.doc && p.doc.daily && p.doc.daily[d]; return r ? { score: r.crashed ? 0 : r.score, bulls: (r.marks || []).filter(m => m === 0).length, done: !!r.done, crashed: !!r.crashed } : null; };
      const streak = id => { const s = db.progress[id] && db.progress[id].doc && db.progress[id].doc.dailyStreak; return s && s.last >= d - 1 ? s.count : 0; };
      return R(200, {
        friends: friendsOf(db, me).map(id => ({ user_id: id, username: byId(db, id).username, today: today(id), streak: streak(id) })),
        incoming: db.requests.filter(r => r.to === me).map(r => ({ request_id: r.id, username: byId(db, r.from).username })),
        outgoing: db.requests.filter(r => r.from === me).map(r => ({ request_id: r.id, username: byId(db, r.to).username }))
      });
    }
    if (fn === 'br_friend_request') {
      const t = byName(db, body.target_username);
      if (!t) return fail('br_user_not_found');
      if (t.id === me) return fail('br_self');
      if (friendsOf(db, me).includes(t.id)) return fail('br_already_friends');
      if (db.requests.some(r => r.from === me && r.to === t.id)) return fail('br_already_requested');
      const back = db.requests.find(r => r.from === t.id && r.to === me);
      if (back) { db.requests = db.requests.filter(r => r !== back); db.friendships.push([me, t.id]); save(db); return R(200, { status: 'accepted' }); }
      db.requests.push({ id: rid('r-'), from: me, to: t.id }); save(db);
      return R(200, { status: 'sent' });
    }
    if (fn === 'br_friend_respond') {
      const r = db.requests.find(x => x.id === body.request_id && x.to === me);
      if (!r) return fail('br_request_not_found');
      db.requests = db.requests.filter(x => x !== r);
      if (body.accept) db.friendships.push([r.from, me]);
      save(db); return R(204);
    }
    if (fn === 'br_friend_cancel') {
      const r = db.requests.find(x => x.id === body.request_id && x.from === me);
      if (!r) return fail('br_request_not_found');
      db.requests = db.requests.filter(x => x !== r); save(db); return R(204);
    }
    if (fn === 'br_friend_remove') { db.friendships = db.friendships.filter(f => !(f.includes(me) && f.includes(body.friend_id))); save(db); return R(204); }
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
  bar.innerHTML = '<b>DEMO</b> <span class="mk-hint">Pretend Warden Chat accounts ·</span> try <code>demo</code> / <code>rocket12345</code>' +
    ' <button type="button" data-m="offline"></button> <button type="button" data-m="friend">👥 A friend answers</button> <button type="button" data-m="wipe">↺ Start over</button>';
  const style = document.createElement('style');
  style.textContent = '#mockBar{position:fixed;left:0;right:0;bottom:4px;margin:0 auto;width:max-content;z-index:40;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;' +
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
    if (m === 'offline') { db.offline = !db.offline; save(db); paint(); window.dispatchEvent(new Event(db.offline ? 'offline' : 'online')); }
    if (m === 'friend') {
      // someone you asked says yes, or else someone new asks you
      const me = Account.user && byName(db, Account.user.username);
      if (!me) { AccountUI.toast('Sign in first, then try this.', 'warn'); return; }
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
    }
    if (m === 'wipe') {
      ['brainRocket.mockServer', 'brainRocket.session', 'brainRocket.lastSync', 'brainRocket.bests', 'brainRocket.daily', 'brainRocket.dailyStreak'].forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  });
})();
