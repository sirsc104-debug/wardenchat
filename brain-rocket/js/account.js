/* Brain Rocket — accounts, the front-end half. Players sign in with their Warden Chat account
   (chat.sirsc104.com), and creating an account here creates a Warden Chat account. Brain Rocket
   talks straight to Warden Chat's Supabase project: Supabase Auth for signing in, and a few
   Brain Rocket database functions (br_*) for progress and friends. Those functions are the
   back-end half, specified in ACCOUNTS-API.md. Until they exist (br_ping answers), Account.status
   stays 'unavailable', the account button stays hidden and the game saves on this device only.

   Changing a password and deleting an account happen on Warden Chat, not here. An account an admin
   has suspended or banned on Warden Chat gets status 'restricted' (with the admin's reason), and
   the account screens show a "you've been banned" screen instead of signing it out.

   What syncs: best scores (brainRocket.bests), today's Bullseye (brainRocket.daily, so one go a
   day holds across devices) and the Bullseye day streak. Sound, music, the last tab and the topic
   memory stay per device. */
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
  }, window.BR_ACCOUNTS || {});
  const SCHEMA = 1;
  const KEEP_DAYS = 120;                         // Bullseye days kept in the synced copy
  const SESSION_KEY = 'brainRocket.session';     // { access_token, refresh_token, expires_at, user: { id, username } }
  const SYNC_KEY = 'brainRocket.lastSync';
  const BESTS_KEY = 'brainRocket.bests', DAILY_KEY = 'brainRocket.daily', STREAK_KEY = 'brainRocket.dailyStreak';
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
      if (msg === 'br_not_signed_in') return 'unauthorized';
      if (/^br_[a-z_]+$/.test(msg)) return msg;                        // our own functions name their errors
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
    return call('POST', '/auth/v1/token?grant_type=' + grant, body).then(r => {
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
  // Call one of the br_* database functions as the signed-in player (or anonymously).
  function rpc(fn, params, anon) {
    const go = force => (anon ? Promise.resolve(null) : token(force)).then(t => call('POST', '/rest/v1/rpc/' + fn, params || {}, t)).then(r => {
      if (r.status >= 200 && r.status < 300) return r.data;
      const code = errorCode(r, 'rpc');
      if (code === 'unauthorized' && !anon && !force) return go(true);      // token went stale: refresh once
      throw new ApiError(code, r.status, (r.data && r.data.message) || '');
    });
    return go(false).catch(e => {
      if (e.code === 'unauthorized' && !anon) return refused().then(() => { throw e; });
      throw e;
    });
  }
  // The br_* functions refuse a suspended or banned account the same way as an expired sign-in, so
  // ask Warden Chat which it is (my_account_state works for restricted accounts too).
  function accountState() {
    if (!sess) return Promise.resolve(null);
    return call('POST', '/rest/v1/rpc/my_account_state', {}, sess.access_token)
      .then(r => (r.status === 200 && r.data && r.data.active === false ? r.data : null));
  }
  let refusing = null;   // several calls refused at once share one check
  function refused() {
    if (st.status === 'restricted') return Promise.resolve();
    if (!refusing) refusing = accountState().then(info => (info ? restricted(info) : expired()), e => { if (!e.offline) expired(); })
      .finally(() => { refusing = null; });
    return refusing;
  }
  let onRestricted = null;
  function restricted(info) {
    clearTimeout(pushTimer);
    Object.assign(st, { status: 'restricted', sync: 'idle', error: null, friends: null,
      restriction: { status: info.status || 'suspended', reason: info.reason || '', until: info.restrictedUntil || null } });
    emit();
    if (onRestricted) onRestricted(st.restriction);
  }
  // "Check again": back to normal if an admin has lifted it.
  function recheck() {
    if (st.status !== 'restricted' || !sess) return Promise.resolve(st.status);
    return token(true).then(() => accountState()).then(info => {
      if (info) { restricted(info); return 'restricted'; }
      st.restriction = null;
      return signedIn(sess.user).then(() => st.status);
    });
  }

  // ---- The synced progress document ---------------------------------------------------
  const num = v => (typeof v === 'number' && isFinite(v) ? v : -Infinity);
  // How "far along" a day's Bullseye record is: finished beats unfinished, then more shots taken,
  // then the higher score.
  const dayRank = r => (r ? [r.done ? 1 : 0, Array.isArray(r.marks) ? r.marks.length : 0, num(r.score)] : [-1, 0, 0]);
  const ahead = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  function norm(p) {
    p = p && typeof p === 'object' ? p : {};
    return {
      bests: p.bests && typeof p.bests === 'object' ? p.bests : {},
      daily: p.daily && typeof p.daily === 'object' ? p.daily : {},
      dailyStreak: p.dailyStreak && typeof p.dailyStreak === 'object' ? p.dailyStreak : null
    };
  }
  // Combine two copies of someone's progress without losing anything: the higher score for every
  // best, the furthest-along record for every Bullseye day, and the most recent day streak.
  // Pure and order-independent; ACCOUNTS-API.md has the same rules in words.
  function merge(x, y) {
    const a = norm(x), b = norm(y), out = { schema: SCHEMA, bests: {}, daily: {}, dailyStreak: null };
    for (const k of new Set([...Object.keys(a.bests), ...Object.keys(b.bests)])) {
      const p = a.bests[k], q = b.bests[k];
      out.bests[k] = !q ? p : !p ? q : num(q.score) > num(p.score) ? q : p;
    }
    const days = [...new Set([...Object.keys(a.daily), ...Object.keys(b.daily)])].map(Number).filter(d => d > 0).sort((m, n) => n - m).slice(0, KEEP_DAYS);
    for (const d of days) {
      const p = a.daily[d], q = b.daily[d];
      out.daily[d] = !q ? p : !p ? q : ahead(dayRank(q), dayRank(p)) ? q : p;
    }
    const s = a.dailyStreak, t = b.dailyStreak;
    out.dailyStreak = !t ? s : !s ? t : num(t.last) > num(s.last) || (t.last === s.last && num(t.count) > num(s.count)) ? t : s;
    return out;
  }
  const same = (p, q) => JSON.stringify(merge(p, {})) === JSON.stringify(merge(q, {}));

  function localProgress() {
    const today = load(DAILY_KEY);
    return { schema: SCHEMA, bests: load(BESTS_KEY) || {}, daily: today && today.day ? { [today.day]: today } : {}, dailyStreak: load(STREAK_KEY) };
  }
  // Write the merged copy back to this device. Only today's Bullseye is kept locally (that's all
  // the game looks at); older days live in the synced copy.
  function applyLocal(p) {
    const before = JSON.stringify(localProgress());
    save(BESTS_KEY, p.bests);
    const d = typeof Daily !== 'undefined' ? Daily.dayNumber() : 0;
    if (d && p.daily[d]) save(DAILY_KEY, p.daily[d]);
    if (p.dailyStreak) save(STREAK_KEY, p.dailyStreak);
    if (JSON.stringify(localProgress()) !== before) window.dispatchEvent(new CustomEvent('br-progress'));
  }

  // ---- Syncing --------------------------------------------------------------------
  let syncing = null, again = false, pushTimer = 0;
  function setSync(s, err) { st.sync = s; st.error = err || null; emit(); }
  function sync() {
    if (st.status !== 'signedIn') return Promise.resolve(false);
    if (syncing) { again = true; return syncing; }
    setSync('syncing');
    const attempt = n => rpc('br_get_progress').then(r => {
      r = r || {};
      const merged = merge(r.doc, localProgress());
      applyLocal(merged);
      if (r.doc && same(merged, r.doc)) return true;
      return rpc('br_save_progress', { doc: merged, base_rev: r.rev || 0 }).then(w => {
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
  // The game calls this whenever it saves progress; a few saves in a row become one sync.
  function changed() {
    if (st.status !== 'signedIn') return;
    if (st.sync !== 'syncing' && st.sync !== 'pending') setSync('pending');   // "Saving to your account…"
    schedule(3000);
  }

  // ---- Friends ----------------------------------------------------------------------
  // { friends: [{ user_id, username, today, streak }], incoming: [{ request_id, username }], outgoing: [...] }
  let friendsLoading = null;
  function loadFriends() {
    if (st.status !== 'signedIn') return Promise.resolve(null);
    if (!friendsLoading) {
      const day = typeof Daily !== 'undefined' ? Daily.dayNumber() : 0;
      friendsLoading = rpc('br_friends', { day }).then(f => {
        st.friends = Object.assign({ friends: [], incoming: [], outgoing: [] }, f || {}); emit(); return st.friends;
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
  // br_ping says Brain Rocket's part of the database is there. If it isn't (not deployed yet, or no
  // network), accounts stay hidden, unless this device was already signed in: then it stays signed
  // in, shows "offline" and syncs once the server is back.
  function init() {
    if (!CONFIG.enabled || !CONFIG.supabaseUrl) { st.status = 'unavailable'; emit(); return Promise.resolve(st); }
    return rpc('br_ping', {}, true).then(() => {
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
    // call any br_* function as the signed-in player (the race uses this)
    rpc: (fn, params) => rpc(fn, params),
    pictureUrls(usernames) {
      const go = force => token(force).then(t => call('POST', '/functions/v1/br-avatars', { usernames }, t)).then(r => {
        if (r.status === 401 && !force) return go(true);
        if (r.status !== 200 || !Array.isArray(r.data && r.data.pictures)) throw new ApiError('pictures_unavailable', r.status);
        return r.data.pictures;
      });
      return go(false);
    },
    signIn: (username, password) => auth('password', { email: identity(username), password }).then(signedIn),
    // Creates a Warden Chat account (Warden Chat's database makes the profile from the username).
    signUp(username, password) {
      return call('POST', '/auth/v1/signup', { email: identity(username), password, data: { username: username.trim() } }).then(r => {
        if (r.status >= 200 && r.status < 300 && r.data && r.data.access_token) return signedIn(keep(r.data));
        if (r.status >= 200 && r.status < 300) throw new ApiError('confirm_enabled', r.status);   // project still wants email confirmation
        throw new ApiError(errorCode(r, 'auth'), r.status);
      });
    },
    // Sign out of Brain Rocket on this device only (Warden Chat tabs and other devices stay signed in).
    // clearDevice also removes the synced progress from this device, for shared computers.
    signOut(clearDevice) {
      const t = sess && sess.access_token;
      const done = () => {
        signedOut();
        if (clearDevice) { [BESTS_KEY, DAILY_KEY, STREAK_KEY].forEach(k => save(k, null)); window.dispatchEvent(new CustomEvent('br-progress')); }
      };
      return sync().then(() => t && call('POST', '/auth/v1/logout?scope=local', {}, t)).then(done, done);
    },
    addFriend: username => thenReload(rpc('br_friend_request', { target_username: username.trim() })),
    answerFriend: (requestId, accept) => thenReload(rpc('br_friend_respond', { request_id: requestId, accept: !!accept })),
    cancelFriend: requestId => thenReload(rpc('br_friend_cancel', { request_id: requestId })),
    removeFriend: userId => thenReload(rpc('br_friend_remove', { friend_id: userId }))
  };
})();
