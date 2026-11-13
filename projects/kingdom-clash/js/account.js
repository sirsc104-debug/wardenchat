/* Kingdom Clash: the WardenChat account, the front-end half. Players sign in with their Warden Chat
   account (chat.sirsc104.com), as in Apples to Oranges and Wildcard Chess, and the game talks straight
   to Warden Chat's Supabase project:
     - Supabase Auth to sign in or create an account (<username>@warden.invalid, as Warden Chat does);
     - the kc_* database functions for the cloud save, friends, presence and battle invites;
     - the SirSC wallet's sirsc_me / sirsc_member_claim, and kc_spend / kc_exchange, for diamonds, coins
       and membership (the server decides every balance; the game shows what it says);
     - Supabase Realtime (private channels kc-<code>) for battles with friends;
     - the kc-battle Edge Function for trophy battles: the server picks each opponent and the seeds,
       replays the battle from the player's plays (server/verify.js) and keeps the trophies.
   The back-end half is BACKEND_HANDOFF.md. Until kc_ping answers, accounts stay switched off and the
   game works exactly as before, saving on this device only. The demo build swaps in a pretend back end
   (js/account-mock.js). All of it reaches the game through js/backend.js (KCBackend.connect). */
'use strict';

const KCAccount = (() => {
  const CFG = {
    enabled: true,
    // Warden Chat's project URL and publishable key are public by design (Warden Chat ships the same values
    // to every browser); every access decision is made by row level security in the database.
    supabaseUrl: 'https://djmyvnaragfwoaljzexn.supabase.co',
    anonKey: 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni',
    identityDomain: 'warden.invalid',
    chatUrl: 'https://chat.sirsc104.com/',
    // supabase-js, loaded only when a battle with a friend starts (Supabase Realtime)
    supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
    realtime: 'supabase',   // 'local': the demo's stand-in, other tabs of this browser
    sessionStore: 'local',  // 'session': one session per tab (the demo, so two tabs can be two players)
    pollSeconds: 8,
  };
  const GAME = 'kc';
  const SESSION_KEY = 'kc.session', LINK_KEY = 'kc.cloud';
  const RULES = { nameMin: 3, nameMax: 24, nameRe: /^[a-zA-Z0-9_.-]+$/, passwordMin: 10 };
  const st = { status: 'checking', user: null, restriction: null };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(st); } catch (e) { console.error(e); } });
  const store = () => { try { return CFG.sessionStore === 'session' ? sessionStorage : localStorage; } catch (e) { return null; } };
  const load = (k, s) => { try { return JSON.parse((s || localStorage).getItem(k) || 'null'); } catch (e) { return null; } };
  const keepIn = (k, v, s) => { try { if (v == null) (s || localStorage).removeItem(k); else (s || localStorage).setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const now = () => Date.now() / 1000;

  /* ---------- talking to Supabase ----------
     A transport takes (method, url, headers, body) and resolves to { status, data }; it rejects only when
     the server can't be reached. The demo swaps in a pretend Supabase (js/account-mock.js). */
  function httpTransport(method, url, headers, body) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), 15000);
    return fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl && ctl.signal, cache: 'no-store', credentials: 'omit' })
      .then(res => res.text().then(t => { let data = null; try { data = t ? JSON.parse(t) : null; } catch (e) { data = { message: t }; } return { status: res.status, data }; }))
      .finally(() => timer && clearTimeout(timer));
  }
  let transport = httpTransport;
  class ApiError extends Error {
    constructor(code, status) { super(code); this.code = code; this.status = status || 0; this.offline = code === 'offline'; }
  }
  function errorCode(r, kind) {
    const d = r.data || {}, msg = String(d.msg || d.message || d.error_description || d.error || ''), code = String(d.error_code || d.code || d.error || '');
    if (r.status === 429 || /rate limit/i.test(msg)) return 'rate_limited';
    if (kind === 'rpc') {
      const own = /^(kc|sirsc|br)_[a-z_]+$/.test(msg) ? msg : '';
      if (/^(kc|sirsc|br)_not_signed_in$/.test(own)) return 'unauthorized';
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
  function call(method, path, body, tok) {
    const headers = { apikey: CFG.anonKey, Accept: 'application/json' };
    if (tok) headers.Authorization = 'Bearer ' + tok;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return transport(method, CFG.supabaseUrl + path, headers, body).then(r => r, () => { throw new ApiError('offline'); });
  }
  const identity = name => `${String(name).trim().toLowerCase()}@${CFG.identityDomain}`;

  let sess = null, epoch = 0, refreshing = null;
  function keep(r) {
    const u = r.user || (sess && sess.user) || {}, meta = u.user_metadata || {};
    sess = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(now() + (r.expires_in || 3600)),
      user: { id: u.id, username: meta.username || u.username || String(u.email || '').split('@')[0] } };
    keepIn(SESSION_KEY, sess, store());
    return sess.user;
  }
  function auth(grant, body) {
    if (grant === 'password') epoch++;
    const at = epoch;
    return call('POST', '/auth/v1/token?grant_type=' + grant, body).then(r => {
      if (at !== epoch) throw new ApiError('session_changed');
      if (r.status === 200 && r.data && r.data.access_token) return keep(r.data);
      throw new ApiError(errorCode(r, 'auth'), r.status);
    });
  }
  function refresh() {
    if (!sess) return Promise.reject(new ApiError('unauthorized'));
    if (!refreshing) refreshing = auth('refresh_token', { refresh_token: sess.refresh_token }).finally(() => { refreshing = null; });
    return refreshing;
  }
  function token(force) {
    if (!sess) return Promise.reject(new ApiError('unauthorized'));
    return force || sess.expires_at - 90 < now() ? refresh().then(() => sess.access_token) : Promise.resolve(sess.access_token);
  }
  function rpc(fn, params, anon) {
    const at = epoch;
    const go = force => (anon ? Promise.resolve(null) : token(force)).then(t => call('POST', '/rest/v1/rpc/' + fn, params || {}, t)).then(r => {
      if (r.status >= 200 && r.status < 300) return r.data;
      const code = errorCode(r, 'rpc');
      if (code === 'unauthorized' && !anon && !force) return go(true);
      throw new ApiError(code, r.status);
    });
    return go(false).catch(e => {
      if (e.code === 'unauthorized' && !anon && at === epoch) return refused().then(() => { throw e; });
      throw e;
    });
  }
  // an Edge Function (POST /functions/v1/<name>): errors come back as { error: '<code>' }
  function fn(name, body) {
    const at = epoch;
    const go = force => token(force).then(t => call('POST', '/functions/v1/' + name, body, t)).then(r => {
      if (r.status >= 200 && r.status < 300) return r.data;
      const d = r.data || {}, own = typeof d.error === 'string' && /^(kc|sirsc)_[a-z_]+$/.test(d.error) ? d.error : '';
      const code = own === 'kc_not_signed_in' ? 'unauthorized' : own || (r.status === 404 ? 'not_deployed' : r.status === 401 ? 'unauthorized' : r.status === 429 ? 'rate_limited' : r.status >= 500 ? 'server_error' : 'error');
      if (code === 'unauthorized' && !force) return go(true);
      throw new ApiError(code, r.status);
    });
    return go(false).catch(e => {
      if (e.code === 'unauthorized' && at === epoch) return refused().then(() => { throw e; });
      throw e;
    });
  }
  // A refused call: banned or suspended on Warden Chat, or just signed out somewhere else?
  function refused() {
    if (!sess) return Promise.resolve();
    return call('POST', '/rest/v1/rpc/my_account_state', {}, sess.access_token).then(r => {
      if (r.status === 200 && r.data && r.data.active === false) {
        st.status = 'restricted';
        st.restriction = { status: r.data.status || 'suspended', reason: r.data.reason || '', until: r.data.restrictedUntil || null };
        emit();
      } else signedOut();
    }, () => {});
  }
  function signedIn(user) { st.status = 'signedIn'; st.user = user; st.restriction = null; emit(); return user; }
  function signedOut() { epoch++; sess = null; keepIn(SESSION_KEY, null, store()); Object.assign(st, { status: 'signedOut', user: null, restriction: null }); emit(); }

  function init() {
    sess = load(SESSION_KEY, store());
    if (!CFG.enabled || !CFG.supabaseUrl) { st.status = 'unavailable'; emit(); return Promise.resolve(st); }
    return rpc('kc_ping', {}, true).then(() => {
      if (!sess) { st.status = 'signedOut'; emit(); return; }
      return token().then(() => signedIn(sess.user), e => { if (e.offline) throw e; signedOut(); });
    }).catch(e => {
      if (sess && e.offline) signedIn(sess.user);
      else if (st.status === 'checking') { st.status = 'unavailable'; emit(); }
    }).then(() => st);
  }
  if (typeof window !== 'undefined') window.addEventListener('online', () => { if (st.status === 'unavailable') { st.status = 'checking'; init(); } });

  const account = {
    RULES, ApiError,
    get status() { return st.status; }, get user() { return st.user; }, get restriction() { return st.restriction; },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    init, rpc: (fn, p) => rpc(fn, p), token: () => token(),
    signIn: (username, password) => auth('password', { email: identity(username), password }).then(signedIn),
    signUp(username, password) {
      const at = ++epoch;
      return call('POST', '/auth/v1/signup', { email: identity(username), password, data: { username: String(username).trim() } }).then(r => {
        if (at !== epoch) throw new ApiError('session_changed');
        if (r.status >= 200 && r.status < 300 && r.data && r.data.access_token) return signedIn(keep(r.data));
        if (r.status >= 200 && r.status < 300) throw new ApiError('confirm_enabled', r.status);
        throw new ApiError(errorCode(r, 'auth'), r.status);
      });
    },
    signOut() {
      const t = sess && sess.access_token;
      const done = () => signedOut();
      return (t ? call('POST', '/auth/v1/logout?scope=local', {}, t) : Promise.resolve()).then(done, done);
    },
  };

  /* ---------- the battle screen is up (nothing is swapped under a running battle) ---------- */
  const inBattle = () => { const b = typeof document !== 'undefined' && document.getElementById('battle'); return !!(b && !b.hidden); };
  const whenIdle = fn => new Promise(res => { const go = () => { if (inBattle()) setTimeout(go, 1500); else { fn(); res(); } }; go(); });
  const toast = msg => { if (typeof KCMenu !== 'undefined' && KCMenu.toast) KCMenu.toast(msg); };
  const me = () => (st.status === 'signedIn' ? st.user : null);

  /* ---------- the cloud save ----------
     The save is the game's own progress object (kc.progress), less what stays on each device: the battle
     log (replays), a battle in progress, and the wallet's balances (the wallet keeps those). One row per
     player, with a revision number: a save based on an old revision is refused, so two devices can't
     overwrite each other without one of them seeing the other's progress first. Which copy wins is
     decided here: the one with more progress (experience, then best trophies, then card levels, then
     copies, then Rubies). The server keeps the copies it replaces (BACKEND_HANDOFF.md), and a copy this
     device gives up is kept in kc.progress.backup, so nothing is ever lost. A device that held another
     account's progress keeps it for them (kc.progress.of.<id>) and gets it back when they sign in. */
  const LOCAL_ONLY = ['log', 'live', 'abandoned', 'passRolled', 'forfeit', 'diamonds', 'wallet', 'member'];
  const MAX_DOC = 120000;
  function docOf(p) {
    const d = {};
    for (const k of Object.keys(p || {})) if (!LOCAL_ONLY.includes(k)) d[k] = p[k];
    d.kcSchema = 1;
    return JSON.parse(JSON.stringify(d));
  }
  function score(p) {
    const cards = p && p.cards && typeof p.cards === 'object' ? Object.values(p.cards) : [];
    return [p.xp | 0, p.best | 0, cards.reduce((a, c) => a + ((c && c.level) | 0), 0), cards.reduce((a, c) => a + ((c && c.count) | 0), 0), p.rubies | 0];
  }
  const cmp = (a, b) => { const x = score(a || {}), y = score(b || {}); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  const fresh = p => !p || ((p.xp | 0) === 0 && (p.trophies | 0) === 0 && !(p.beaten && Object.keys(p.beaten).length));
  let ready = false, lastPushed = '', chain = Promise.resolve(), pulls = 0;
  const link = () => load(LINK_KEY);
  const setLink = (user, rev) => keepIn(LINK_KEY, { user, rev: rev | 0 });
  function restoreDoc(doc, log) {
    const data = Object.assign({}, doc || {});
    delete data.kcSchema;
    const P = KCProgress.state;
    if (Array.isArray(log)) data.log = log;
    // the wallet's balances stay as the wallet says
    data.diamonds = P.diamonds; data.wallet = P.wallet; data.member = P.member;
    KCBackend.restore(data);
    lastPushed = JSON.stringify(docOf(KCProgress.state));
  }
  async function pull() {
    const u = me();
    if (!u) return;
    ready = false;
    try {
      const r = await rpc('kc_get_progress');
      if (me() !== u) return;
      const cloud = r && r.doc && typeof r.doc === 'object' ? r.doc : null, rev = r ? r.rev | 0 : 0, L = link(), P = KCProgress.state;
      // the server keeps the trophies (checked trophy battles) when it answers with them
      rankedOn = !!r && Object.prototype.hasOwnProperty.call(r, 'trophies');
      if (L && L.user && L.user !== u.id) {
        // another account's progress is on this device: kept for them, and this account's comes in
        if (!fresh(P)) keepIn('kc.progress.of.' + L.user, P);
        const mine = load('kc.progress.of.' + u.id);
        await whenIdle(() => restoreDoc(cloud || mine || {}, mine && mine.log));
        keepIn('kc.progress.of.' + u.id, null);
        setLink(u.id, cloud ? rev : 0);
        if (cloud) toast(`Welcome back, ${u.username}! Your progress is loaded.`);
      } else if (!cloud) {
        setLink(u.id, 0);   // a first save for this account: this device's progress goes up
      } else if (L && L.user === u.id && L.rev === rev) {
        // nothing new in the account; whatever changed here since goes up
      } else if (fresh(P) || cmp(cloud, P) >= 0) {
        const same = L && L.user === u.id;
        if (!fresh(P) && !same) keepIn('kc.progress.backup', P);
        await whenIdle(() => restoreDoc(cloud, same || !L ? P.log : null));
        setLink(u.id, rev);
        if (!fresh(P)) toast(same ? 'Loaded your progress from your other device.' : 'Your WardenChat account had more progress: it is loaded.');
      } else {
        setLink(u.id, rev);   // this device has more progress: it goes up (the account keeps the copy it replaces)
      }
      ready = true;
      if (r && r.trophies && KCProgress.setTrophies(r.trophies) && typeof KCMenu !== 'undefined') KCMenu.refresh();
      await push();
      if (rankedOn) flushFinishes().catch(() => {});
    } catch (e) { if (!e.offline) console.error('cloud save', e); } finally { ready = true; }
  }
  // send this device's progress up (one at a time)
  function push() {
    chain = chain.then(async () => {
      const u = me(), L = link();
      if (!u || !ready || !L || L.user !== u.id) return;
      const doc = docOf(KCProgress.state), body = JSON.stringify(doc);
      if (body === lastPushed) return;
      if (body.length > MAX_DOC) { console.warn('cloud save: too big', body.length); return; }
      const r = await rpc('kc_save_progress', { doc, base_rev: L.rev | 0 });
      if (me() !== u) return;
      if (r && r.ok) { setLink(u.id, r.rev); lastPushed = body; pulls = 0; return; }
      // another device saved first: look again, and the copy with more progress wins
      if (r && r.conflict && pulls++ < 3) setTimeout(pull, 0);
    }).catch(e => { if (!e.offline) console.error('cloud save', e); });
    return chain;
  }

  /* ---------- trophy battles checked by the server (the kc-battle Edge Function) ----------
     start: the server settles any battle left open (a loss), picks the opponent and the seeds, and reads
     the player's cards from their saved progress (sent up first). finish: the player's plays; the server
     replays the battle and answers with the trophies. A finish that can't be sent (no connection) waits
     here and goes before the next battle starts, so a dropped connection never costs a battle. */
  let rankedOn = false;
  const FINISH_KEY = () => 'kc.battleFinish.' + ((me() && me().id) || '');
  const pending = () => { const a = load(FINISH_KEY()); return Array.isArray(a) ? a : []; };
  const setPending = a => keepIn(FINISH_KEY(), a.length ? a.slice(-5) : null);
  async function sendFinish(job) {
    try {
      const r = await fn('kc-battle', Object.assign({ action: 'finish' }, job));
      setPending(pending().filter(j => j.battle_id !== job.battle_id));
      if (r && r.trophies && KCProgress.setTrophies(r.trophies) && typeof KCMenu !== 'undefined') KCMenu.refresh();
      return r;
    } catch (e) {
      // a refusal stays a refusal (the battle was closed); only a lost connection is worth another try
      if (!e.offline && e.code !== 'server_error' && e.code !== 'rate_limited') setPending(pending().filter(j => j.battle_id !== job.battle_id));
      throw e;
    }
  }
  async function flushFinishes() {
    // a checked battle this device left (the page was reloaded or closed mid-battle): the server hears it now
    const P = KCProgress.state, left = P.forfeit;
    if (left && !pending().some(j => j.battle_id === left)) setPending(pending().concat({ battle_id: left, plays: [], end: { reason: 'left' }, claimed: null }));
    if (left) { delete P.forfeit; KCProgress.save(); }
    for (const job of pending()) { try { await sendFinish(job); } catch (e) { if (e.offline) throw e; } }
  }
  const battles = {
    async start(rules) {
      await flushFinishes();
      KCBackend.flush(); await push();
      const r = await fn('kc-battle', { action: 'start', rules: String(rules || '') });
      if (r && r.trophies && KCProgress.setTrophies(r.trophies) && typeof KCMenu !== 'undefined') KCMenu.refresh();
      return r;
    },
    finish(battleId, plays, end, claimed) {
      const job = { battle_id: battleId, plays, end: end || null, claimed: claimed || null };
      setPending(pending().filter(j => j.battle_id !== battleId).concat(job));
      return sendFinish(job);
    },
  };

  /* ---------- the SirSC wallet ---------- */
  let wal = null, walletLoad = null;
  function loadWallet() {
    if (!me()) return Promise.resolve(null);
    if (walletLoad) return walletLoad;
    walletLoad = rpc('sirsc_me', { game: GAME }).then(m => {
      if (m && m.member) return rpc('sirsc_member_claim', { game: GAME }).then(c => (c && c.me) || m, () => m);
      return m;
    }).then(m => {
      if (m && typeof m === 'object' && 'diamonds' in m && me()) { wal = m; if (KCProgress.setWallet(m) && typeof KCMenu !== 'undefined') KCMenu.refresh(); }
      return wal;
    }).catch(() => wal).finally(() => { walletLoad = null; });
    return walletLoad;
  }
  const wallet = {
    spend: (kind, diamonds, ref) => rpc('kc_spend', { kind, diamonds: diamonds | 0, ref: String(ref) }).then(r => { if (r && r.me) wal = r.me; return r; }),
    exchange: coins => rpc('kc_exchange', { coins: coins | 0 }).then(r => { if (r && r.me) wal = r.me; return r; }),
    get me() { return wal; },
  };

  /* ---------- friends, presence and battle invites ----------
     Friends are the player's Warden Chat friends (kc_friends). Every few seconds the game says it is open
     (in the lobby or in a battle) and picks up invites (kc_poll); friends see who is online. */
  let lists = { friends: [], incoming: [], outgoing: [] }, inviteFn = null, pollT = 0, polls = 0;
  const seen = new Set();
  const friends = {
    async list() {
      const r = await rpc('kc_friends');
      lists = { friends: (r && r.friends) || [], incoming: (r && r.incoming) || [], outgoing: (r && r.outgoing) || [] };
      signal(lists.incoming.length);
      return lists.friends.map(f => ({ id: f.user_id, name: f.username, online: !!f.online, inGame: !!f.in_game }));
    },
    requests: () => ({ incoming: lists.incoming.map(x => ({ id: x.request_id, name: x.username })), outgoing: lists.outgoing.map(x => ({ id: x.request_id, name: x.username })) }),
    add: username => rpc('kc_friend_request', { target_username: String(username).trim() }),
    respond: (id, accept) => rpc('kc_friend_respond', { request_id: id, accept: !!accept }),
    invite: (friendId, code) => rpc('kc_invite', { friend_id: friendId, code }),
    onInvite(fn) { inviteFn = fn; return () => { if (inviteFn === fn) inviteFn = null; }; },
    accept: id => rpc('kc_invite_respond', { invite_id: id, accept: true }),
    decline: id => rpc('kc_invite_respond', { invite_id: id, accept: false }),
  };
  function signal(n) { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kc-friend-requests', { detail: { count: n | 0 } })); }
  async function poll() {
    clearTimeout(pollT);
    if (!me()) return;
    try {
      const r = await rpc('kc_poll', { status: inBattle() ? 'battle' : 'lobby' });
      for (const inv of (r && r.invites) || []) {
        if (!inv || seen.has(inv.invite_id)) continue;
        seen.add(inv.invite_id);
        if (inviteFn) inviteFn({ id: inv.invite_id, from: { id: inv.from && inv.from.user_id, name: (inv.from && inv.from.username) || 'A friend' }, code: inv.code });
      }
      if (r && typeof r.requests === 'number') signal(r.requests);
      if (++polls % 8 === 0) loadWallet();   // diamonds bought on Warden Chat show up here
      if (rankedOn && polls % 4 === 0 && pending().length) flushFinishes().catch(() => {});
    } catch (e) { /* offline for a moment */ }
    if (me()) pollT = setTimeout(poll, (document.hidden ? 30 : CFG.pollSeconds) * 1000);
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden && me()) { poll(); loadWallet(); } });

  /* ---------- battles with friends: Supabase Realtime ----------
     A room is a private Realtime channel, kc-<code>: presence for the two players' setups, broadcast for
     the battle's messages (js/net.js, js/game.js). The server only has to let signed-in players use those
     channels (BACKEND_HANDOFF.md). */
  let sbLoad = null, sbClient = null, localLobby = null;
  function loadSupabase() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    if (!sbLoad) sbLoad = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = CFG.supabaseJs; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (window.supabase && window.supabase.createClient ? res(window.supabase) : rej(new Error('supabase-js')));
      s.onerror = () => { sbLoad = null; rej(new Error('supabase-js')); };
      document.head.appendChild(s);
    });
    return sbLoad;
  }
  async function realtimeJoin(name) {
    const lib = await loadSupabase();
    if (!sbClient) sbClient = lib.createClient(CFG.supabaseUrl, CFG.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const sb = sbClient;
    sb.realtime.setAuth(await token());
    const self = ((me() && me().id) || 'p') + '.' + Math.random().toString(36).slice(2, 8);
    const ch = sb.channel(name, { config: { private: true, broadcast: { self: false, ack: false }, presence: { key: self } } });
    const handlers = {}, peerFns = [];
    let mine = {}, last = [{ peer: self, isMe: true, sameTab: true, presence: {} }], left = false;
    const snap = () => {
      const state = ch.presenceState() || {}, out = [];
      for (const [key, metas] of Object.entries(state)) { const m = Array.isArray(metas) ? metas[metas.length - 1] : null; out.push({ peer: key, isMe: key === self, sameTab: key === self, presence: (m && m.p) || {} }); }
      if (!out.some(p => p.isMe)) out.unshift({ peer: self, isMe: true, sameTab: true, presence: mine });
      return out;
    };
    const deliver = (topic, msg) => { for (const f of (handlers[topic] || []).slice()) try { f(msg); } catch (e) { console.error(e); } };
    for (const t of KCNet.TOPICS) ch.on('broadcast', { event: t }, m => { const p = (m && m.payload) || {}; if (typeof p.f === 'string') deliver(t, { peer: p.f, isMe: p.f === self, sameTab: false, topic: t, data: p.d }); });
    ch.on('presence', { event: 'sync' }, () => { last = snap(); for (const f of peerFns.slice()) try { f({ peers: last }); } catch (e) { console.error(e); } });
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), 15000);
      ch.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') { clearTimeout(t); res(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { clearTimeout(t); rej(err || new Error(status)); }
      });
    }).catch(e => { sb.removeChannel(ch).catch(() => {}); throw e; });
    return {
      name, kind: 'backend',
      emit(topic, data) { return left ? Promise.resolve() : ch.send({ type: 'broadcast', event: topic, payload: { f: self, d: data } }).then(() => {}); },
      on(topic, fn) { (handlers[topic] = handlers[topic] || []).push(fn); return () => { handlers[topic] = (handlers[topic] || []).filter(f => f !== fn); }; },
      presence(patch) { mine = Object.assign({}, mine, patch); for (const k of Object.keys(mine)) if (mine[k] === null) delete mine[k]; return ch.track({ p: mine }).then(() => {}); },
      peers: () => last,
      onPeers(fn) { peerFns.push(fn); setTimeout(() => fn({ peers: last }), 0); return () => { const i = peerFns.indexOf(fn); if (i >= 0) peerFns.splice(i, 1); }; },
      connected: () => !left,
      leave() { left = true; return sb.removeChannel(ch).then(() => {}, () => {}); },
    };
  }
  // the lobby KCNet sees: rooms only (friends come from the account, not from who is in a lobby)
  const lobby = {
    peers: () => [], onPeers: () => () => {}, presence: () => Promise.resolve(), emit: () => Promise.resolve(), on: () => () => {},
    join(name) {
      if (CFG.realtime === 'local') { localLobby = localLobby || KCNet.localTransport(); return localLobby.join(name); }
      return realtimeJoin(name);
    },
  };

  /* ---------- connecting it all to the game (js/backend.js) ---------- */
  const impl = {
    status: () => st.status,
    account: () => (st.status === 'signedIn' && st.user ? { id: st.user.id, name: st.user.username } : null),
    restriction: () => st.restriction,
    login: (name, password, create) => (create ? account.signUp(name, password) : account.signIn(name, password)),
    signOut: () => { KCBackend.flush(); return push().then(() => account.signOut()); },
    save: () => push(),
    friends, transport: lobby, wallet, rules: RULES, get chatUrl() { return CFG.chatUrl; },
    ranked: () => rankedOn && st.status === 'signedIn', battles,
  };
  let lastKey = '';
  account.on(s => {
    if (s.status === 'checking' || s.status === 'unavailable') return;
    const key = s.status + ':' + (s.user ? s.user.id : '');
    if (key === lastKey) return;
    lastKey = key;
    if (!KCBackend.connected()) KCBackend.connect(impl); else KCBackend.changed();
    if (s.status === 'signedIn') { pull(); loadWallet(); seen.clear(); poll(); }
    else {
      clearTimeout(pollT); wal = null; ready = false; rankedOn = false; lists = { friends: [], incoming: [], outgoing: [] }; signal(0);
      // signed out: the wallet's diamonds and coins are the account's, not this device's
      if (KCProgress.setWallet(null) && typeof KCMenu !== 'undefined') KCMenu.refresh();
    }
  });
  let started = false;
  function start() { if (started) return; started = true; init(); }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0));
    else setTimeout(start, 0);
  }

  return Object.assign(account, {
    CFG, GAME, start, pull, push, loadWallet, docOf, cmp,
    configure(patch) { Object.assign(CFG, patch || {}); },
    useTransport(fn) { transport = fn; },
  });
})();
