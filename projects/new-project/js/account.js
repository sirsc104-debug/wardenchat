/* Apples to Oranges — accounts, the front-end half. Players sign in with their Warden Chat account
   (chat.sirsc104.com), the same way Brain Rocket does, and creating an account here creates a
   Warden Chat account. The game talks straight to Warden Chat's Supabase project: Supabase Auth for
   signing in, and a few Apples to Oranges database functions (a2o_*) for best scores and friends.
   Those functions are the back-end half, specified in ACCOUNTS-API.md. Until they exist (a2o_ping
   answers), Account.status stays 'unavailable', the account button stays hidden and the game saves
   on this device only.

   Changing a password and deleting an account happen on Warden Chat, not here. An account an admin
   has suspended or banned on Warden Chat gets status 'restricted' (with the admin's reason), and
   the account screens show a "you've been banned" screen instead of signing it out.

   What syncs: the best score for every mode and difficulty (a2o.best2). Sound, music, the last tab
   and your favourite Fruit Dash fruit stay per device. Friends are shared with Brain Rocket: a
   friend there is a friend here. */
'use strict';

const Account = (function () {
  // Warden Chat's project URL and anon key are public by design (Warden Chat ships the same values
  // to every browser); every access decision is made by row level security in the database.
  const CONFIG = Object.assign({
    enabled: true,
    supabaseUrl: 'https://djmyvnaragfwoaljzexn.supabase.co',
    anonKey: 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni',
    identityDomain: 'warden.invalid',     // Warden Chat signs in as <username>@warden.invalid (no real email)
    chatUrl: 'https://chat.sirsc104.com/'
  }, window.A2O_ACCOUNTS || {});
  const SCHEMA = 1;
  const SESSION_KEY = 'a2o.session';     // { access_token, refresh_token, expires_at, user: { id, username } }
  const SYNC_KEY = 'a2o.lastSync';
  const BESTS_KEY = 'a2o.best2';         // { classic: { owen: 1234, … }, race: { … }, … }
  // Warden Chat's own rules, so mistakes are caught before asking the server
  const RULES = { nameMin: 3, nameMax: 24, nameRe: /^[a-zA-Z0-9_.-]+$/, passwordMin: 10 };

  const st = { status: 'checking', user: null, sync: 'idle', lastSync: 0, error: null, friends: null, restriction: null };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(st); } catch (e) { /* a listener's problem */ } });

  const load = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const save = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const now = () => Date.now() / 1000;

  // ---- Talking to Supabase -------------------------------------------------------
  // A transport takes (method, url, headers, body) and resolves to { status, data }; it rejects only
  // when the server can't be reached. The demo build swaps in a pretend Supabase (js/account-mock.js).
  function httpTransport(method, url, headers, body) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), 15000);
    return fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl && ctl.signal, cache: 'no-store', credentials: 'omit' })
      .then(res => res.text().then(t => {
        let data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = { message: t }; }
        return { status: res.status, data };
      })).finally(() => timer && clearTimeout(timer));
  }
  let transport = httpTransport;

  class ApiError extends Error {
    constructor(code, status, detail) { super(code); this.code = code; this.status = status || 0; this.detail = detail || ''; this.offline = code === 'offline'; }
  }
  // Supabase's many error shapes, boiled down to the handful the screens know how to explain
  function errorCode(r, kind) {
    const d = r.data || {}, msg = String(d.msg || d.message || d.error_description || d.error || '');
    const code = String(d.error_code || d.code || d.error || '');
    if (r.status === 429 || /rate limit/i.test(msg)) return 'rate_limited';
    if (kind === 'rpc') {
      // our own functions name their errors; friends are shared with Brain Rocket, so its br_ codes
      // (from the friendship functions the a2o_ ones can reuse) mean the same thing
      const own = /^(a2o|br)_[a-z_]+$/.test(msg) ? msg.replace(/^br_/, 'a2o_') : '';
      if (own === 'a2o_not_signed_in') return 'unauthorized';
      if (own) return own;
      if (code === 'PGRST202' || r.status === 404) return 'not_deployed';
      if (r.status === 401 || /JWT/i.test(msg)) return 'unauthorized';
    }
    if (code === 'invalid_credentials' || code === 'invalid_grant' || /invalid login credentials/i.test(msg)) return 'bad_credentials';
    if (code === 'user_already_exists' || /already registered|already exists|duplicate key/i.test(msg)) return 'username_taken';
    if (code === 'weak_password' || (/password/i.test(msg) && /weak|short|at least/i.test(msg))) return 'weak_password';
    if (code === 'refresh_token_not_found' || code === 'session_not_found' || /refresh token/i.test(msg)) return 'unauthorized';
    if (/database error saving new user/i.test(msg)) return 'signup_rejected';
    if (r.status >= 500) return 'server_error';
    return 'error';
  }
  function call(method, path, body, token) {
    // the publishable key goes in apikey only; a signed-in call adds the player's own token
    const headers = { apikey: CONFIG.anonKey, Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return transport(method, CONFIG.supabaseUrl + path, headers, body).then(r => r, () => { throw new ApiError('offline'); });
  }
  const identity = name => `${String(name).trim().toLowerCase()}@${CONFIG.identityDomain}`;

  // ---- The Warden Chat session -------------------------------------------------------
  let sess = load(SESSION_KEY);
  let sessionEpoch = 0;
  function keep(r) {
    const u = r.user || (sess && sess.user) || {};
    const meta = u.user_metadata || {};
    sess = {
      access_token: r.access_token, refresh_token: r.refresh_token,
      expires_at: r.expires_at || Math.floor(now() + (r.expires_in || 3600)),
      user: { id: u.id, username: meta.username || u.username || String(u.email || '').split('@')[0] }
    };
    save(SESSION_KEY, sess);
    return sess.user;
  }
  function auth(grant, body) {
    if (grant === 'password') sessionEpoch++;
    const boundary = sessionEpoch;
    return call('POST', '/auth/v1/token?grant_type=' + grant, body).then(r => {
      if (boundary !== sessionEpoch) throw new ApiError('session_changed');
      if (r.status === 200 && r.data && r.data.access_token) return keep(r.data);
      throw new ApiError(errorCode(r, 'auth'), r.status);
    });
  }
  // Access tokens last about an hour; swap the refresh token for a new pair shortly before then.
  let refreshing = null;
  function refresh() {
    if (!sess) return Promise.reject(new ApiError('unauthorized'));
    if (!refreshing) refreshing = auth('refresh_token', { refresh_token: sess.refresh_token }).finally(() => { refreshing = null; });
    return refreshing;
  }
  function token(force) {
    if (!sess) return Promise.reject(new ApiError('unauthorized'));
    return force || sess.expires_at - 90 < now() ? refresh().then(() => sess.access_token) : Promise.resolve(sess.access_token);
  }
  // Call one of the a2o_* database functions as the signed-in player (or anonymously).
  function rpc(fn, params, anon) {
    const boundary = sessionEpoch;
    const go = force => (anon ? Promise.resolve(null) : token(force)).then(t => call('POST', '/rest/v1/rpc/' + fn, params || {}, t)).then(r => {
      if (r.status >= 200 && r.status < 300) return r.data;
      const code = errorCode(r, 'rpc');
      if (code === 'unauthorized' && !anon && !force) return go(true);      // token went stale: refresh once
      throw new ApiError(code, r.status, (r.data && r.data.message) || '');
    });
    return go(false).catch(e => {
      if (e.code === 'unauthorized' && !anon && boundary === sessionEpoch) return refused().then(() => { throw e; });
      throw e;
    });
  }
  // The a2o_* functions refuse a suspended or banned account the same way as an expired sign-in, so
  // ask Warden Chat which it is (my_account_state works for restricted accounts too).
  function accountState() {
    if (!sess) return Promise.resolve(null);
    return call('POST', '/rest/v1/rpc/my_account_state', {}, sess.access_token)
      .then(r => (r.status === 200 && r.data && r.data.active === false ? r.data : null));
  }
  let refusing = null;   // several calls refused at once share one check
  function refused() {
    if (st.status === 'restricted') return Promise.resolve();
    if (!refusing) {
      const boundary = sessionEpoch;
      const task = accountState().then(info => { if (boundary === sessionEpoch) return info ? restricted(info) : expired(); },
        e => { if (boundary === sessionEpoch && !e.offline) expired(); }).finally(() => { if (refusing === task) refusing = null; });
      refusing = task;
    }
    return refusing;
  }
  let onRestricted = null;
  function restricted(info) {
    if (!sess || !st.user) return;
    clearTimeout(pushTimer);
    Object.assign(st, { status: 'restricted', sync: 'idle', error: null, friends: null,
      restriction: { status: info.status || 'suspended', reason: info.reason || '', until: info.restrictedUntil || null } });
    emit();
    if (onRestricted) onRestricted(st.restriction);
  }
  // "Check again": back to normal if an admin has lifted it.
  function recheck() {
    if (st.status !== 'restricted' || !sess) return Promise.resolve(st.status);
    const boundary = sessionEpoch;
    return token(true).then(() => boundary === sessionEpoch ? accountState() : null).then(info => {
      if (boundary !== sessionEpoch) return st.status;
      if (info) { restricted(info); return 'restricted'; }
      st.restriction = null;
      return signedIn(sess.user).then(() => st.status);
    }).catch(e => { if (boundary !== sessionEpoch) return st.status; throw e; });
  }

  // ---- The synced progress document ---------------------------------------------------
  // { schema: 1, bests: { <mode>: { <difficulty>: <score> } } }
  const MAX_SCORE = 1e9;
  const okScore = v => typeof v === 'number' && isFinite(v) && v > 0 && v <= MAX_SCORE;
  function normBests(b) {
    const out = {};
    if (!b || typeof b !== 'object') return out;
    for (const [mode, diffs] of Object.entries(b)) {
      if (!/^[a-z]{1,16}$/.test(mode) || !diffs || typeof diffs !== 'object') continue;
      for (const [d, v] of Object.entries(diffs)) if (/^[a-z]{1,16}$/.test(d) && okScore(v)) (out[mode] = out[mode] || {})[d] = Math.round(v);
    }
    return out;
  }
  // Combine two copies of someone's progress without losing anything: the higher score for every
  // mode and difficulty. Pure and order-independent; ACCOUNTS-API.md has the same rule in words.
  function merge(x, y) {
    const a = normBests(x && x.bests), b = normBests(y && y.bests), out = { schema: SCHEMA, bests: {} };
    for (const mode of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const p = a[mode] || {}, q = b[mode] || {}, m = {};
      for (const d of [...new Set([...Object.keys(p), ...Object.keys(q)])].sort()) m[d] = Math.max(p[d] || 0, q[d] || 0);
      out.bests[mode] = m;
    }
    return out;
  }
  const same = (p, q) => JSON.stringify(merge(p, {})) === JSON.stringify(merge(q, {}));

  const localProgress = () => ({ schema: SCHEMA, bests: load(BESTS_KEY) || {} });
  // Write the merged copy back to this device and tell the game, so the home screen shows it.
  function applyLocal(p) {
    const mine = load(BESTS_KEY) || {};
    const before = JSON.stringify(merge({ bests: mine }, {}));
    if (JSON.stringify(p) === before) return;
    // keep any mode the game knows about that has nothing in it yet
    save(BESTS_KEY, Object.assign({}, mine, p.bests));
    window.dispatchEvent(new CustomEvent('a2o-progress'));
  }

  // ---- Syncing --------------------------------------------------------------------
  let syncing = null, again = false, pushTimer = 0;
  function setSync(s, err) { st.sync = s; st.error = err || null; emit(); }
  function sync() {
    if (st.status !== 'signedIn') return Promise.resolve(false);
    if (syncing) { again = true; return syncing; }
    setSync('syncing');
    const attempt = n => rpc('a2o_get_progress').then(r => {
      r = r || {};
      const merged = merge(r.doc, localProgress());
      applyLocal(merged);
      if (r.doc && same(merged, r.doc)) return true;
      return rpc('a2o_save_progress', { doc: merged, base_rev: r.rev || 0 }).then(w => {
        if (w && w.conflict && n < 3) return attempt(n + 1);    // another device saved first: merge again
        if (w && w.conflict) throw new ApiError('conflict');
        return true;
      });
    });
    syncing = attempt(0).then(() => {
      st.lastSync = Date.now(); save(SYNC_KEY, st.lastSync); setSync('synced'); loadFriends(); return true;
    }, e => {
      if (st.status === 'signedIn') setSync(e.offline ? 'offline' : 'error', e);
      return false;
    }).then(ok => {
      syncing = null;
      if (again) { again = false; schedule(1500); }
      return ok;
    });
    return syncing;
  }
  function schedule(ms) { clearTimeout(pushTimer); pushTimer = setTimeout(sync, ms); }
  // The game calls this whenever it saves a new best; a few saves in a row become one sync.
  function changed() {
    if (st.status !== 'signedIn') return;
    if (st.sync !== 'syncing' && st.sync !== 'pending') setSync('pending');   // "Saving to your account…"
    schedule(3000);
  }

  // ---- Friends ----------------------------------------------------------------------
  // { friends: [{ user_id, username, bests, race_wins }], incoming: [{ request_id, username }], outgoing: [...] }
  let friendsLoading = null;
  function loadFriends() {
    if (st.status !== 'signedIn') return Promise.resolve(null);
    if (!friendsLoading) {
      friendsLoading = rpc('a2o_friends').then(f => {
        st.friends = Object.assign({ friends: [], incoming: [], outgoing: [] }, f || {});
        st.friends.friends.forEach(x => { x.bests = normBests(x.bests); x.race_wins = x.race_wins | 0; });
        emit(); return st.friends;
      }, () => st.friends).finally(() => { friendsLoading = null; });
    }
    return friendsLoading;
  }
  const thenReload = p => p.then(r => loadFriends().then(() => r));

  // ---- Signing in and out ---------------------------------------------------------------
  function signedIn(user) {
    st.status = 'signedIn'; st.user = user; st.lastSync = load(SYNC_KEY) || 0; emit();
    return sync().then(ok => ({ user, synced: ok, restricted: st.status === 'restricted' }));
  }
  function signedOut() {
    sessionEpoch++; refusing = null;
    clearTimeout(pushTimer);
    sess = null; save(SESSION_KEY, null); save(SYNC_KEY, null);
    Object.assign(st, { status: 'signedOut', user: null, lastSync: 0, sync: 'idle', error: null, friends: null, restriction: null });
    emit();
  }
  let onExpired = null;
  function expired() {
    if (st.status !== 'signedIn') return;
    signedOut();
    if (onExpired) onExpired();
  }

  // ---- Starting up --------------------------------------------------------------------
  // a2o_ping says Apples to Oranges' part of the database is there. If it isn't (not deployed yet, or
  // no network), accounts stay hidden, unless this device was already signed in: then it stays signed
  // in, shows "offline" and syncs once the server is back.
  function init() {
    if (!CONFIG.enabled || !CONFIG.supabaseUrl) { st.status = 'unavailable'; emit(); return Promise.resolve(st); }
    return rpc('a2o_ping', {}, true).then(() => {
      if (!sess) { st.status = 'signedOut'; emit(); return; }
      return token().then(() => signedIn(sess.user), e => {
        if (e.offline) throw e;
        signedOut(); if (onExpired) onExpired();
      });
    }).catch(e => {
      if (sess && e.offline) { st.status = 'signedIn'; st.user = sess.user; st.lastSync = load(SYNC_KEY) || 0; setSync('offline'); }
      else if (st.status === 'checking') { st.status = 'unavailable'; emit(); }
    }).then(() => st);
  }
  // Coming back online or back to the tab: catch up.
  window.addEventListener('online', () => { if (st.status === 'signedIn') sync(); else if (st.status === 'unavailable') { st.status = 'checking'; init(); } });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && st.status === 'restricted') { recheck().catch(() => {}); return; }
    if (document.hidden || st.status !== 'signedIn') return;
    if (st.sync !== 'synced' || Date.now() - st.lastSync > 60000) sync(); else loadFriends();
  });

  return {
    CONFIG, RULES, ApiError, merge,
    get status() { return st.status; }, get user() { return st.user; }, get sync() { return st.sync; },
    get lastSync() { return st.lastSync; }, get error() { return st.error; }, get friends() { return st.friends; },
    get restriction() { return st.restriction; },
    onRestricted(fn) { onRestricted = fn; }, recheck,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onExpired(fn) { onExpired = fn; },
    useTransport(fn) { transport = fn; },
    init, changed, syncNow: sync, loadFriends,
    // call any a2o_* function as the signed-in player (the race uses this)
    rpc: (fn, params) => rpc(fn, params),
    signIn: (username, password) => auth('password', { email: identity(username), password }).then(signedIn),
    // Creates a Warden Chat account (Warden Chat's database makes the profile from the username).
    signUp(username, password) {
      const boundary = ++sessionEpoch;
      return call('POST', '/auth/v1/signup', { email: identity(username), password, data: { username: username.trim() } }).then(r => {
        if (boundary !== sessionEpoch) throw new ApiError('session_changed');
        if (r.status >= 200 && r.status < 300 && r.data && r.data.access_token) return signedIn(keep(r.data));
        if (r.status >= 200 && r.status < 300) throw new ApiError('confirm_enabled', r.status);   // project still wants email confirmation
        throw new ApiError(errorCode(r, 'auth'), r.status);
      });
    },
    // Sign out of Apples to Oranges on this device only (Warden Chat tabs and other devices stay
    // signed in). clearDevice also removes the synced bests from this device, for shared computers.
    signOut(clearDevice) {
      const t = sess && sess.access_token;
      const done = () => {
        signedOut();
        if (clearDevice) { save(BESTS_KEY, null); window.dispatchEvent(new CustomEvent('a2o-progress')); }
      };
      return sync().then(() => t && call('POST', '/auth/v1/logout?scope=local', {}, t)).then(done, done);
    },
    addFriend: username => thenReload(rpc('a2o_friend_request', { target_username: username.trim() })),
    answerFriend: (requestId, accept) => thenReload(rpc('a2o_friend_respond', { request_id: requestId, accept: !!accept })),
    cancelFriend: requestId => thenReload(rpc('a2o_friend_cancel', { request_id: requestId })),
    removeFriend: userId => thenReload(rpc('a2o_friend_remove', { friend_id: userId }))
  };
})();
