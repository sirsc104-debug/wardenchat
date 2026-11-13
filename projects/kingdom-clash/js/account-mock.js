/* Kingdom Clash: a pretend Warden Chat back end, for the demo build only
   (python3 build-artifact.py demo.html --standalone --accounts-demo). It answers the same requests the
   real Supabase project will (Supabase Auth and the kc_* / sirsc_* functions in BACKEND_HANDOFF.md), from
   this browser's localStorage (kc.mock), so the account, cloud save, friends, invites and the SirSC
   wallet can all be tried before the back end exists. Battles with friends use a BroadcastChannel
   between tabs of this browser, and each tab keeps its own session, so two tabs can be two players.

   Accounts to try: demo / kingdom12345 (60 diamonds, 25,000 coins, friends with pal, a friend request
   from sam), pal / kingdom12345, sam / kingdom12345. It follows the contract closely, so it is also a
   reference for the expected JSON. */
'use strict';

(() => {
  const KEY = 'kc.mock';
  const day = () => new Date().toISOString().slice(0, 10);
  const id = p => p + '-' + Math.random().toString(36).slice(2, 10);
  function db() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    if (d && d.v === 1) return d;
    d = { v: 1, users: {}, progress: {}, friendships: [], requests: [], presence: {}, invites: [], spends: {}, exchanged: {}, tokens: {} };
    const add = (uid, username, diamonds, coins) => { d.users[uid] = { id: uid, username, password: 'kingdom12345', diamonds, coins, member: false }; };
    add('u-demo', 'demo', 60, 25000); add('u-pal', 'pal', 10, 5000); add('u-sam', 'sam', 0, 0);
    d.friendships.push(['u-demo', 'u-pal']);
    d.requests.push({ id: 'r-sam', from: 'u-sam', to: 'u-demo', created_at: new Date().toISOString() });
    return d;
  }
  const keep = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* full */ } };
  const ok = data => ({ status: 200, data });
  const fail = (code, status = 400) => ({ status, data: { code: 'P0001', message: code } });
  const authFail = (code, msg, status = 400) => ({ status, data: { error_code: code, msg } });
  function session(d, u) {
    const access = id('at'), refresh = id('rt');
    d.tokens[access] = { user: u.id, kind: 'access', exp: Date.now() + 3600e3 };
    d.tokens[refresh] = { user: u.id, kind: 'refresh' };
    return { access_token: access, refresh_token: refresh, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: u.id, email: u.username + '@warden.invalid', user_metadata: { username: u.username } } };
  }
  const byName = (d, n) => Object.values(d.users).find(u => u.username.toLowerCase() === String(n || '').trim().toLowerCase());
  const friendsOf = (d, uid) => d.friendships.filter(f => f.includes(uid)).map(f => (f[0] === uid ? f[1] : f[0]));
  const me = (d, u) => ({ coins: u.coins, diamonds: u.diamonds, member: u.member, member_until: null, owned: [], catalog: [] });
  const online = (d, uid) => { const p = d.presence[uid]; return p && Date.now() - p.seen < 90e3 ? p : null; };
  const SPEND = { pass: [10, 10], skip: [1, 144], offer: [1, 2], deal: [1, 18], magic: [1, 25], cards: [1, 10], emote: [1, 1] };
  const CAP = { 1: 500, 2: 1000, 3: 2000, 4: 4000, 5: 6000, 6: 7000, 7: 8000, 8: 9000, 9: 10000, 10: 10000 };
  const ARENA_AT = [0, 300, 600, 900, 2000, 2600, 3300, 4100, 5000, 6000];

  const RPC = {
    kc_ping: () => ok(true),
    my_account_state: () => ok({ active: true }),
    kc_get_progress: (d, u) => { const r = d.progress[u.id]; return ok({ doc: r ? r.doc : null, rev: r ? r.rev : 0 }); },
    kc_save_progress(d, u, a) {
      const doc = a.doc;
      if (!doc || typeof doc !== 'object' || Array.isArray(doc) || JSON.stringify(doc).length > 131072) return fail('kc_bad_progress');
      const r = d.progress[u.id], base = a.base_rev | 0;
      if (!r && base === 0) { d.progress[u.id] = { doc, rev: 1, history: [] }; return ok({ ok: true, rev: 1 }); }
      if (r && r.rev === base) { r.history = (r.history || []).concat({ doc: r.doc, rev: r.rev }).slice(-10); r.doc = doc; r.rev++; return ok({ ok: true, rev: r.rev }); }
      return ok({ ok: false, conflict: true, rev: r ? r.rev : 0 });
    },
    kc_friends(d, u) {
      const friends = friendsOf(d, u.id).map(fid => { const f = d.users[fid], p = online(d, fid); return { user_id: fid, username: f.username, online: !!p, in_game: !!(p && p.status === 'battle') }; });
      const req = r => ({ request_id: r.id, username: d.users[r.from === u.id ? r.to : r.from].username, created_at: r.created_at });
      return ok({ friends, incoming: d.requests.filter(r => r.to === u.id).map(req), outgoing: d.requests.filter(r => r.from === u.id).map(req) });
    },
    kc_friend_request(d, u, a) {
      const t = byName(d, a.target_username);
      if (!t) return fail('kc_user_not_found');
      if (t.id === u.id) return fail('kc_self');
      if (friendsOf(d, u.id).includes(t.id)) return fail('kc_already_friends');
      if (d.requests.some(r => r.from === u.id && r.to === t.id)) return fail('kc_already_requested');
      const back = d.requests.find(r => r.from === t.id && r.to === u.id);
      if (back) { d.requests = d.requests.filter(r => r !== back); d.friendships.push([u.id, t.id]); return ok({ status: 'accepted' }); }
      d.requests.push({ id: id('r'), from: u.id, to: t.id, created_at: new Date().toISOString() });
      return ok({ status: 'sent' });
    },
    kc_friend_respond(d, u, a) {
      const r = d.requests.find(x => x.id === a.request_id && x.to === u.id);
      if (!r) return fail('kc_request_not_found');
      d.requests = d.requests.filter(x => x !== r);
      if (a.accept) d.friendships.push([r.from, r.to]);
      return ok(null);
    },
    kc_poll(d, u, a) {
      d.presence[u.id] = { status: a.status === 'battle' ? 'battle' : 'lobby', seen: Date.now() };
      const invites = d.invites.filter(i => i.to === u.id && i.status === 'pending' && Date.now() - Date.parse(i.created_at) < 120e3)
        .map(i => ({ invite_id: i.id, from: { user_id: i.from, username: d.users[i.from].username }, code: i.code, created_at: i.created_at }));
      return ok({ invites, requests: d.requests.filter(r => r.to === u.id).length });
    },
    kc_invite(d, u, a) {
      if (!friendsOf(d, u.id).includes(a.friend_id)) return fail('kc_not_friends');
      if (!/^[a-z0-9]{5}$/.test(String(a.code || ''))) return fail('kc_bad_code');
      for (const i of d.invites) if (i.from === u.id && i.to === a.friend_id && i.status === 'pending') i.status = 'cancelled';
      const inv = { id: id('i'), from: u.id, to: a.friend_id, code: a.code, status: 'pending', created_at: new Date().toISOString() };
      d.invites.push(inv);
      return ok({ invite_id: inv.id });
    },
    kc_invite_respond(d, u, a) {
      const i = d.invites.find(x => x.id === a.invite_id && x.to === u.id);
      if (!i) return fail('kc_invite_not_found');
      if (i.status === 'pending') i.status = a.accept ? 'accepted' : 'declined';
      return ok(null);
    },
    sirsc_me: (d, u) => ok(me(d, u)),
    sirsc_member_claim: (d, u) => ok({ me: me(d, u), diamonds_added: 0, claimed: [] }),
    kc_spend(d, u, a) {
      const lim = SPEND[a.kind], n = a.diamonds;
      if (!lim || !Number.isInteger(n) || n < lim[0] || n > lim[1] || typeof a.ref !== 'string' || !a.ref || a.ref.length > 64) return fail('kc_bad_spend');
      const done = d.spends[u.id] = d.spends[u.id] || {};
      if (done[a.ref]) return ok({ ok: true, spent: 0, repeated: true, me: me(d, u) });
      if (u.diamonds < n) return fail('kc_not_enough_diamonds');
      u.diamonds -= n; done[a.ref] = { kind: a.kind, n, at: Date.now() };
      return ok({ ok: true, spent: n, me: me(d, u) });
    },
    kc_exchange(d, u, a) {
      const n = a.coins;
      if (!Number.isInteger(n) || n <= 0) return fail('kc_bad_amount');
      const best = (d.progress[u.id] && d.progress[u.id].doc && d.progress[u.id].doc.best) | 0;
      const arena = ARENA_AT.filter(t => best >= t).length || 1, cap = CAP[arena];
      const x = d.exchanged[u.id] && d.exchanged[u.id].day === day() ? d.exchanged[u.id] : { day: day(), n: 0 };
      if (x.n + n > cap) return fail('kc_exchange_cap');
      if (u.coins < n) return fail('kc_not_enough_coins');
      u.coins -= n; x.n += n; d.exchanged[u.id] = x;
      return ok({ ok: true, coins: n, rubies: n, used: x.n, cap, me: me(d, u) });
    },
  };

  function mock(method, url, headers, body) {
    return new Promise(res => setTimeout(() => {
      const d = db(), u0 = new URL(url), path = u0.pathname, a = body || {};
      let out;
      if (path === '/auth/v1/token') {
        const g = u0.searchParams.get('grant_type');
        if (g === 'password') {
          const u = byName(d, String(a.email || '').split('@')[0]);
          out = u && u.password === a.password ? ok(session(d, u)) : authFail('invalid_credentials', 'Invalid login credentials');
        } else {
          const t = d.tokens[a.refresh_token];
          out = t && t.kind === 'refresh' ? ok(session(d, d.users[t.user])) : authFail('refresh_token_not_found', 'Invalid Refresh Token');
        }
      } else if (path === '/auth/v1/signup') {
        const name = String((a.data && a.data.username) || '').trim();
        if (byName(d, name)) out = authFail('user_already_exists', 'User already registered', 422);
        else if (String(a.password || '').length < 10) out = authFail('weak_password', 'Password should be at least 10 characters', 422);
        else { const u = { id: id('u'), username: name, password: a.password, diamonds: 0, coins: 0, member: false }; d.users[u.id] = u; out = ok(session(d, u)); }
      } else if (path === '/auth/v1/logout') {
        out = { status: 204, data: null };
      } else if (path.startsWith('/rest/v1/rpc/')) {
        const fn = path.slice('/rest/v1/rpc/'.length), f = RPC[fn];
        const tok = String(headers.Authorization || '').replace(/^Bearer /, ''), t = d.tokens[tok];
        const u = t && t.kind === 'access' && t.exp > Date.now() ? d.users[t.user] : null;
        if (!f) out = { status: 404, data: { code: 'PGRST202', message: 'Could not find the function' } };
        else if (fn !== 'kc_ping' && fn !== 'my_account_state' && !u) out = fail('kc_not_signed_in');
        else out = f(d, u, a);
      } else out = { status: 404, data: { message: 'not found' } };
      keep(d);
      res(out);
    }, 60));
  }
  KCAccount.configure({ realtime: 'local', sessionStore: 'session', pollSeconds: 3 });
  KCAccount.useTransport(mock);
  window.KCMock = { reset() { localStorage.removeItem(KEY); }, db };
})();
