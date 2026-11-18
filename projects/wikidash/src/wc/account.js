// WikiDash on Warden Chat: accounts. Ported from Wildcard Chess's js/wallet.js (itself from Downhill
// Death Run). The game talks straight to Warden Chat's Supabase project: Supabase Auth to sign in, and
// the wkd_* / sirsc_* database functions (docs/ACCOUNTS-WKD.md, docs/ECONOMY-WKD.md,
// docs/PARTIES-WKD.md). The server decides everything; this file only asks and remembers the answer.
//
// Until wkd_ping answers, Account.status stays "unavailable" and the game hides accounts: everything
// else works as before. Demo builds swap in a pretend back end (wc/mock.js) with useTransport().

export const CONFIG = Object.assign(
  {
    enabled: true,
    // Warden Chat's project URL and publishable key are public by design (Warden Chat ships the same
    // values to every browser); every access decision is made by row level security in the database.
    supabaseUrl: "https://djmyvnaragfwoaljzexn.supabase.co",
    anonKey: "sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni",
    identityDomain: "warden.invalid",
    chatUrl: "https://chat.sirsc104.com/",
  },
  window.WKD_ACCOUNTS || {},
);

export const RULES = { nameMin: 3, nameMax: 24, nameRe: /^[a-zA-Z0-9_.-]+$/, passwordMin: 10 };
const SESSION_KEY = "wkd.session";

export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status || 0;
    this.offline = code === "offline";
  }
}

const st = { status: "checking", user: null, restriction: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(st); } catch (e) { console.error(e); } });
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const save = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const now = () => Date.now() / 1000;

function httpTransport(method, url, headers, body) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl && setTimeout(() => ctl.abort(), 15000);
  return fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl && ctl.signal, cache: "no-store", credentials: "omit" })
    .then((res) => res.text().then((t) => { let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = { message: t }; } return { status: res.status, data }; }))
    .finally(() => timer && clearTimeout(timer));
}
let transport = httpTransport;

function errorCode(r, kind) {
  const d = r.data || {};
  const msg = String(d.msg || d.message || d.error_description || d.error || "");
  const code = String(d.error_code || d.code || d.error || "");
  if (r.status === 429 || /rate limit/i.test(msg)) return "rate_limited";
  if (kind === "rpc") {
    // A br_* code (from the friendship functions the wkd_ ones reuse) means the same as the wkd_* one.
    const own = /^(wkd|sirsc|br)_[a-z_]+$/.test(msg) ? msg.replace(/^br_/, "wkd_") : "";
    if (own === "wkd_not_signed_in" || own === "sirsc_not_signed_in") return "unauthorized";
    if (own) return own;
    if (code === "PGRST202" || r.status === 404) return "not_deployed";
    if (r.status === 401 || /JWT/i.test(msg)) return "unauthorized";
  }
  if (code === "invalid_credentials" || code === "invalid_grant" || /invalid login credentials/i.test(msg)) return "bad_credentials";
  if (code === "user_already_exists" || /already registered|already exists|duplicate key/i.test(msg)) return "username_taken";
  if (code === "weak_password" || (/password/i.test(msg) && /weak|short|at least/i.test(msg))) return "weak_password";
  if (code === "refresh_token_not_found" || code === "session_not_found" || /refresh token/i.test(msg)) return "unauthorized";
  if (/database error saving new user/i.test(msg)) return "signup_rejected";
  if (r.status >= 500) return "server_error";
  return "error";
}

function call(method, path, body, token) {
  const headers = { apikey: CONFIG.anonKey, Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return transport(method, CONFIG.supabaseUrl + path, headers, body).then((r) => r, () => { throw new ApiError("offline"); });
}
const identity = (name) => `${String(name).trim().toLowerCase()}@${CONFIG.identityDomain}`;

let sess = load(SESSION_KEY);
let epoch = 0;
let refreshing = null;

function keep(r) {
  const u = r.user || (sess && sess.user) || {};
  const meta = u.user_metadata || {};
  sess = {
    access_token: r.access_token, refresh_token: r.refresh_token,
    expires_at: r.expires_at || Math.floor(now() + (r.expires_in || 3600)),
    user: { id: u.id, username: meta.username || u.username || String(u.email || "").split("@")[0] },
  };
  save(SESSION_KEY, sess);
  return sess.user;
}
function auth(grant, body) {
  if (grant === "password") epoch++;
  const at = epoch;
  return call("POST", "/auth/v1/token?grant_type=" + grant, body).then((r) => {
    if (at !== epoch) throw new ApiError("session_changed");
    if (r.status === 200 && r.data && r.data.access_token) return keep(r.data);
    throw new ApiError(errorCode(r, "auth"), r.status);
  });
}
function refresh() {
  if (!sess) return Promise.reject(new ApiError("unauthorized"));
  if (!refreshing) refreshing = auth("refresh_token", { refresh_token: sess.refresh_token }).finally(() => { refreshing = null; });
  return refreshing;
}
function token(force) {
  if (!sess) return Promise.reject(new ApiError("unauthorized"));
  return force || sess.expires_at - 90 < now() ? refresh().then(() => sess.access_token) : Promise.resolve(sess.access_token);
}
function rpc(fn, params, anon) {
  const at = epoch;
  const go = (force) => (anon ? Promise.resolve(null) : token(force)).then((t) => call("POST", "/rest/v1/rpc/" + fn, params || {}, t)).then((r) => {
    if (r.status >= 200 && r.status < 300) return r.data;
    const code = errorCode(r, "rpc");
    if (code === "unauthorized" && !anon && !force) return go(true);
    throw new ApiError(code, r.status);
  });
  return go(false).catch((e) => {
    if (e.code === "unauthorized" && !anon && at === epoch) return refused().then(() => { throw e; });
    throw e;
  });
}
// A refused call: banned or suspended on Warden Chat, or just signed out somewhere else?
function refused() {
  if (!sess) return Promise.resolve();
  return call("POST", "/rest/v1/rpc/my_account_state", {}, sess.access_token).then((r) => {
    if (r.status === 200 && r.data && r.data.active === false) {
      st.status = "restricted";
      st.restriction = { status: r.data.status || "suspended", reason: r.data.reason || "", until: r.data.restrictedUntil || null };
      emit();
    } else signedOut();
  }, () => {});
}
function signedIn(user) {
  st.status = "signedIn";
  st.user = user;
  st.restriction = null;
  emit();
  return user;
}
function signedOut() {
  epoch++;
  sess = null;
  save(SESSION_KEY, null);
  Object.assign(st, { status: "signedOut", user: null, restriction: null });
  emit();
}

function init() {
  if (!CONFIG.enabled || !CONFIG.supabaseUrl) {
    st.status = "unavailable";
    emit();
    return Promise.resolve(st);
  }
  return rpc("wkd_ping", {}, true)
    .then(() => {
      if (!sess) {
        st.status = "signedOut";
        emit();
        return;
      }
      return token().then(() => signedIn(sess.user), (e) => { if (e.offline) throw e; signedOut(); });
    })
    .catch((e) => {
      if (sess && e.offline) signedIn(sess.user);
      else if (st.status === "checking") {
        st.status = "unavailable";
        emit();
      }
    })
    .then(() => st);
}
window.addEventListener("online", () => {
  if (st.status === "unavailable") {
    st.status = "checking";
    init();
  }
});

export const Account = {
  RULES,
  get status() { return st.status; },
  get user() { return st.user; },
  get restriction() { return st.restriction; },
  get demo() { return Boolean(window.WKD_DEMO); },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  useTransport(fn) { transport = fn; },
  init,
  rpc: (fn, p) => rpc(fn, p),
  signIn: (username, password) => auth("password", { email: identity(username), password }).then(signedIn),
  signUp(username, password) {
    const at = ++epoch;
    return call("POST", "/auth/v1/signup", { email: identity(username), password, data: { username: username.trim() } }).then((r) => {
      if (at !== epoch) throw new ApiError("session_changed");
      if (r.status >= 200 && r.status < 300 && r.data && r.data.access_token) return signedIn(keep(r.data));
      if (r.status >= 200 && r.status < 300) throw new ApiError("confirm_enabled", r.status);
      throw new ApiError(errorCode(r, "auth"), r.status);
    });
  },
  signOut() {
    const t = sess && sess.access_token;
    const done = () => signedOut();
    return (t ? call("POST", "/auth/v1/logout?scope=local", {}, t) : Promise.resolve()).then(done, done);
  },
};

/** The messages a player sees for each code. */
export const ERRORS = {
  bad_credentials: "That username and password don’t match a Warden Chat account.",
  username_taken: "That username is taken on Warden Chat. Try another.",
  weak_password: "Warden Chat needs a longer password: at least 10 characters.",
  signup_rejected: "Warden Chat didn’t accept that username. Use 3 to 24 letters, numbers, dots, dashes or underscores.",
  confirm_enabled: "Warden Chat isn’t taking new accounts right now.",
  rate_limited: "Too many tries. Wait a minute and try again.",
  offline: "Can’t reach Warden Chat. Check your connection and try again.",
  not_deployed: "That part of Warden Chat isn’t switched on yet.",
  sirsc_not_enough: "Not enough in your wallet for that.",
  sirsc_owned: "You already own that.",
  sirsc_member_only: "That one is for SirSC Members.",
  sirsc_wrong_currency: "That can’t be bought with that currency.",
  sirsc_unknown_item: "That item isn’t in the shop any more.",
  sirsc_too_many_requests: "You already have 3 requests waiting for SirSC.",
  sirsc_bad_request: "Diamonds come in fives, from 5 to 500.",
  sirsc_request_closed: "That request has already been answered.",
  sirsc_bad_reward: "That run doesn’t count for coins.",
  sirsc_rate_limited: "That’s a lot of races this hour. Coins come back shortly.",
  wkd_user_not_found: "There’s no Warden Chat account with that name. Check the spelling.",
  wkd_self: "That’s you.",
  wkd_already_friends: "You’re already friends.",
  wkd_already_requested: "You’ve already sent them a request.",
  wkd_too_many: "You’ve reached the friend limit.",
  wkd_rate_limited: "Slow down a little and try again.",
  wkd_request_not_found: "That request isn’t there any more.",
  wkd_no_such_party: "There’s no party with that code. Check it, or start your own.",
  wkd_party_full: "That party is full.",
  wkd_not_friends: "You can only invite friends.",
  wkd_not_host: "Only the host can do that.",
  wkd_too_many_parties: "You’re already in 3 parties. Leave one first.",
};
export const errText = (e) => ERRORS[e && e.code] || (e && e.offline ? ERRORS.offline : "Something went wrong. Try again in a moment.");
