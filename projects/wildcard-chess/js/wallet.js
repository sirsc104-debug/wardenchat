/* Wildcard Chess: Warden Chat accounts and the SirSC wallet (coins, diamonds, membership, owned items).
   Ported from Downhill Death Run's src/account.js and src/wallet.js (sirsc104-debug/claude). The game
   talks straight to Warden Chat's Supabase project: Supabase Auth to sign in, the shared sirsc_*
   functions for the wallet (docs/ECONOMY-API.md in that repo), and wcc_ping / wcc_reward for this game
   (docs/ECONOMY-WCC.md here). The server decides every balance, price and reward; this file only asks
   and remembers the latest answer.

   Until wcc_ping answers, Account.status stays 'unavailable' and the game hides accounts: everything
   else works exactly as before. The demo build swaps in a pretend back end (js/wallet-mock.js). */
'use strict';

const WCC_CONFIG = Object.assign({
  enabled: true,
  // Warden Chat's project URL and publishable key are public by design (Warden Chat ships the same
  // values to every browser); every access decision is made by row level security in the database.
  supabaseUrl: 'https://djmyvnaragfwoaljzexn.supabase.co',
  anonKey: 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni',
  identityDomain: 'warden.invalid',
  chatUrl: 'https://chat.sirsc104.com/',
}, window.WCC_ACCOUNTS || {});

const Account = (() => {
  const SESSION_KEY = 'wcc.session';
  const RULES = { nameMin: 3, nameMax: 24, nameRe: /^[a-zA-Z0-9_.-]+$/, passwordMin: 10 };
  const st = { status: 'checking', user: null, restriction: null };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(st); } catch (e) { console.error(e); } });
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const save = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const now = () => Date.now() / 1000;

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
      const own = /^(wcc|sirsc)_[a-z_]+$/.test(msg) ? msg : '';
      if (own === 'wcc_not_signed_in' || own === 'sirsc_not_signed_in') return 'unauthorized';
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
    const headers = { apikey: WCC_CONFIG.anonKey, Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return transport(method, WCC_CONFIG.supabaseUrl + path, headers, body).then(r => r, () => { throw new ApiError('offline'); });
  }
  const identity = name => `${String(name).trim().toLowerCase()}@${WCC_CONFIG.identityDomain}`;

  let sess = load(SESSION_KEY), epoch = 0, refreshing = null;
  function keep(r) {
    const u = r.user || (sess && sess.user) || {}, meta = u.user_metadata || {};
    sess = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(now() + (r.expires_in || 3600)),
      user: { id: u.id, username: meta.username || u.username || String(u.email || '').split('@')[0] } };
    save(SESSION_KEY, sess);
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
  function signedOut() { epoch++; sess = null; save(SESSION_KEY, null); Object.assign(st, { status: 'signedOut', user: null, restriction: null }); emit(); }

  function init() {
    if (!WCC_CONFIG.enabled || !WCC_CONFIG.supabaseUrl) { st.status = 'unavailable'; emit(); return Promise.resolve(st); }
    return rpc('wcc_ping', {}, true).then(() => {
      if (!sess) { st.status = 'signedOut'; emit(); return; }
      return token().then(() => signedIn(sess.user), e => { if (e.offline) throw e; signedOut(); });
    }).catch(e => {
      if (sess && e.offline) signedIn(sess.user);
      else if (st.status === 'checking') { st.status = 'unavailable'; emit(); }
    }).then(() => st);
  }
  window.addEventListener('online', () => { if (st.status === 'unavailable') { st.status = 'checking'; init(); } });

  return {
    RULES, ApiError,
    get status() { return st.status; }, get user() { return st.user; }, get restriction() { return st.restriction; },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    useTransport(fn) { transport = fn; },
    init, rpc: (fn, p) => rpc(fn, p),
    signIn: (username, password) => auth('password', { email: identity(username), password }).then(signedIn),
    signUp(username, password) {
      const at = ++epoch;
      return call('POST', '/auth/v1/signup', { email: identity(username), password, data: { username: username.trim() } }).then(r => {
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
})();

/* The SirSC wallet as this game sees it. Game id 'wcc'. */
const Wallet = (() => {
  const GAME = 'wcc';
  const listeners = new Set();
  let me = null, loading = null, onClaim = null;
  const emit = () => listeners.forEach(fn => { try { fn(me); } catch (e) { console.error(e); } });
  const keep = m => { if (m && typeof m === 'object' && 'coins' in m) { me = m; emit(); } return me; };
  const call = (fn, p) => Account.rpc(fn, p);
  function load() {
    if (Account.status !== 'signedIn') { me = null; emit(); return Promise.resolve(null); }
    if (loading) return loading;
    loading = call('sirsc_me', { game: GAME }).then(m => {
      keep(m);
      return m && m.member ? call('sirsc_member_claim', { game: GAME }).then(c => {
        keep(c && c.me);
        if (c && onClaim && (c.diamonds_added > 0 || (c.claimed && c.claimed.length))) onClaim(c);
        return me;
      }, () => me) : me;
    }).catch(() => me).finally(() => { loading = null; });
    return loading;
  }
  Account.on(() => {
    if (Account.status === 'signedIn' && !me && !loading) load();
    if (Account.status !== 'signedIn' && me) { me = null; emit(); }
  });
  return {
    GAME,
    get me() { return me; },
    get coins() { return me ? me.coins : 0; },
    get diamonds() { return me ? me.diamonds : 0; },
    get member() { return !!(me && me.member); },
    get memberUntil() { return me && me.member_until; },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onClaim(fn) { onClaim = fn; },
    load,
    owns: item => !!me && (me.owned || []).some(o => o.item_id === item),
    price: item => (me && (me.catalog || []).find(c => c.item_id === item)) || WCC_CATALOG.find(c => c.item_id === item) || null,
    buy: (item, currency) => call('sirsc_buy', { game: GAME, item_id: item, target: '', currency }).then(keep),
    requestDiamonds: (diamonds, note) => call('sirsc_request_diamonds', { diamonds, note: note || '' }).then(keep),
    cancelRequest: id => call('sirsc_cancel_request', { request_id: id }).then(keep),
    /* A finished game against the computer: the server works out the coins and returns the breakdown. */
    reward(r) {
      return call('wcc_reward', { level: r.level, result: r.result, plies: r.plies | 0, duration_ms: Math.round(r.durationMs), draft: !!r.draft, codex: r.codex || [] })
        .then(x => { keep(x && x.me); return x; });
    },
  };
})();

/* The badge's gradient lives once in the page (installBadgeDefs), so every copy of the badge shares it. */
function installBadgeDefs() {
  if (document.getElementById('sirsc-badge-defs')) return;
  const d = document.createElement('div');
  d.innerHTML = '<svg id="sirsc-badge-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="sirsc-badge-grad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#e9fbff"/><stop offset=".5" stop-color="#7fd8ff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs></svg>';
  document.body.appendChild(d.firstChild);
}
/* The SirSC Diamond, the badge SirSC Members wear by their name (drawn here rather than copied from
   Downhill Death Run's PNG, so this file stays small). */
const SIRSC_BADGE_SVG = '<svg class="sirsc-badge" viewBox="0 0 24 24" role="img" aria-label="SirSC Member"><title>SirSC Member</title>' +
  '<path d="M6 3 H18 L22.5 9 L12 21.5 L1.5 9 Z" fill="url(#sirsc-badge-grad)" stroke="#1e3a8a" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M1.5 9 H22.5 M6 3 L9 9 L12 21.5 L15 9 L18 3 M9 9 L12 3 L15 9" fill="none" stroke="#1e3a8a" stroke-width=".8" stroke-linejoin="round" opacity=".7"/></svg>';
