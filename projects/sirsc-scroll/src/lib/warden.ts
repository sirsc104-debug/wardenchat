// Signing in with Warden Chat. SirSC Scroll has no accounts of its own: people sign in with their
// Warden Chat username and password against Warden Chat's Supabase project (the same project the video
// catalog lives in), and SirSC Scroll's database functions (scroll_*) check that session. Nothing but
// the sign-in screen shows until someone is signed in.
//
// - Sign in:   POST /auth/v1/token?grant_type=password  { email: "<username>@warden.invalid", password }
// - Stay in:   POST /auth/v1/token?grant_type=refresh_token, about 90 s before the access token expires
// - Sign out:  POST /auth/v1/logout?scope=local (this browser only, so Warden Chat stays signed in elsewhere)
// - Banned?    POST /rest/v1/rpc/my_account_state (Warden Chat's own function) when a scroll_* call says
//              scroll_not_signed_in, to tell a suspended or banned account from an expired sign-in.
//
// Creating an account, changing a password or picture and deleting an account all happen on Warden Chat:
// its sign-up needs a one-time permission from Warden Chat's own sign-up page, so the screen links there.
import { useSyncExternalStore } from 'react';
import { SUPABASE } from './config';

export const WARDEN_CHAT_URL = 'https://chat.sirsc104.com/';
const IDENTITY_DOMAIN = 'warden.invalid';
const SESSION_KEY = 'sirsc-scroll:session';
/** Warden Chat's username rules, checked before asking the server. */
export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;

export interface WardenUser {
  /** Supabase Auth user id. */
  id: string;
  username: string;
}

export interface Restriction {
  status: 'suspended' | 'banned' | string;
  reason: string;
  until: string | null;
}

/** What SirSC Scroll itself says about the account (from scroll_me). */
export interface ScrollStanding {
  /** The owner stopped this account liking and commenting here. */
  banned: boolean;
  banReason: string | null;
  /** A Warden Chat admin muted the account: it can't comment. */
  muted: boolean;
}

export type AuthStatus = 'checking' | 'signed-out' | 'signed-in' | 'restricted';

export interface AuthSnapshot {
  status: AuthStatus;
  user: WardenUser | null;
  restriction: Restriction | null;
  standing: ScrollStanding | null;
  /** Shown on the sign-in screen: why you were signed out. */
  notice: string | null;
  /** The last attempt to reach Warden Chat failed (the app keeps working on the saved sign-in). */
  offline: boolean;
}

interface StoredSession {
  access_token: string;
  refresh_token: string;
  /** Seconds since epoch. */
  expires_at: number;
  user: WardenUser;
}

/* ---------------------------------------------------------------- transport */

export interface HttpResult {
  status: number;
  data: unknown;
}

/** (method, url, headers, body) → { status, data }; rejects only when the server can't be reached. */
export type Transport = (method: string, url: string, headers: Record<string, string>, body: unknown) => Promise<HttpResult>;

const httpTransport: Transport = async (method, url, headers, body) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal, cache: 'no-store', credentials: 'omit' });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
};

let transport: Transport = httpTransport;

/** The demo build swaps in a pretend Warden Chat (lib/demoBackend.ts). */
export function setTransport(t: Transport) {
  transport = t;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super(code);
  }
  get offline() {
    return this.code === 'offline';
  }
}

/** Supabase's many error shapes, boiled down to the codes the screens explain. */
function errorCode(r: HttpResult, kind: 'auth' | 'rpc'): string {
  const d = (r.data ?? {}) as Record<string, unknown>;
  const msg = String(d.msg ?? d.message ?? d.error_description ?? d.error ?? '');
  const code = String(d.error_code ?? d.code ?? d.error ?? '');
  if (r.status === 429 || /rate limit/i.test(msg)) return 'rate_limited';
  if (kind === 'rpc') {
    if (msg === 'scroll_not_signed_in') return 'unauthorized';
    if (/^scroll_[a-z_]+$/.test(msg)) return msg;
    if (code === 'PGRST202' || r.status === 404) return 'not_deployed';
    if (r.status === 401 || /JWT/i.test(msg)) return 'unauthorized';
  }
  if (code === 'invalid_credentials' || code === 'invalid_grant' || /invalid login credentials/i.test(msg)) return 'bad_credentials';
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || code === 'session_not_found' || /refresh token/i.test(msg)) return 'unauthorized';
  if (r.status >= 500) return 'server_error';
  return 'error';
}

async function call(method: string, path: string, body?: unknown, token?: string | null): Promise<HttpResult> {
  // The publishable key goes in apikey; a signed-in call adds the person's own token.
  const headers: Record<string, string> = { apikey: SUPABASE.publishableKey, Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await transport(method, SUPABASE.url + path, headers, body);
  } catch {
    throw new ApiError('offline');
  }
}

/* ---------------------------------------------------------------- the store */

let snap: AuthSnapshot = { status: 'checking', user: null, restriction: null, standing: null, notice: null, offline: false };
const listeners = new Set<() => void>();
const signInListeners = new Set<(u: WardenUser) => void>();

function emit(patch: Partial<AuthSnapshot>) {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function authSnapshot(): AuthSnapshot {
  return snap;
}

export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(subscribe, authSnapshot, authSnapshot);
}

/** Runs whenever someone signs in (or the saved sign-in is confirmed on page load). */
export function onSignedIn(fn: (u: WardenUser) => void): () => void {
  signInListeners.add(fn);
  return () => {
    signInListeners.delete(fn);
  };
}

/* ---------------------------------------------------------------- the session */

function loadSession(): StoredSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as StoredSession | null;
    return s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' && s.user?.id ? s : null;
  } catch {
    return null;
  }
}

function saveSession(s: StoredSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked: the sign-in lasts for this visit only */
  }
}

let sess: StoredSession | null = null;
/** Bumped on every sign-in and sign-out, so a slow answer for an old session is ignored. */
let epoch = 0;
let refreshTimer: number | undefined;
const now = () => Date.now() / 1000;

function keep(r: Record<string, unknown>): StoredSession {
  const u = (r.user ?? {}) as { id?: string; email?: string; user_metadata?: { username?: string } };
  sess = {
    access_token: String(r.access_token),
    refresh_token: String(r.refresh_token),
    expires_at: Number(r.expires_at) || Math.floor(now() + (Number(r.expires_in) || 3600)),
    user: {
      id: u.id ?? sess?.user.id ?? '',
      username: u.user_metadata?.username ?? sess?.user.username ?? String(u.email ?? '').split('@')[0],
    },
  };
  saveSession(sess);
  scheduleRefresh();
  return sess;
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  if (!sess) return;
  const ms = Math.max(5_000, (sess.expires_at - 90 - now()) * 1000);
  refreshTimer = window.setTimeout(() => void token(true).catch(() => {}), Math.min(ms, 2_000_000_000));
}

let refreshing: Promise<StoredSession> | null = null;

async function refresh(): Promise<StoredSession> {
  if (!sess) throw new ApiError('unauthorized');
  // Another tab may have refreshed already (refresh tokens are single-use): take its tokens.
  const stored = loadSession();
  if (stored && stored.user.id === sess.user.id && stored.refresh_token !== sess.refresh_token && stored.expires_at - 90 > now()) {
    sess = stored;
    scheduleRefresh();
    return sess;
  }
  if (!refreshing) {
    const e = epoch;
    refreshing = (async () => {
      const r = await call('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: sess!.refresh_token });
      if (e !== epoch) throw new ApiError('session_changed');
      const d = r.data as Record<string, unknown> | null;
      if (r.status === 200 && d?.access_token) return keep(d);
      throw new ApiError(errorCode(r, 'auth'), r.status);
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function token(force = false): Promise<string> {
  if (!sess) throw new ApiError('unauthorized');
  if (force || sess.expires_at - 90 < now()) await refresh();
  return sess!.access_token;
}

/** Call a SirSC Scroll database function as the signed-in person. */
export async function rpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const e = epoch;
  const go = async (force: boolean): Promise<T> => {
    const t = await token(force);
    const r = await call('POST', `/rest/v1/rpc/${fn}`, params, t);
    if (r.status >= 200 && r.status < 300) {
      if (snap.offline) emit({ offline: false });
      return r.data as T;
    }
    const code = errorCode(r, 'rpc');
    if (code === 'unauthorized' && !force) return go(true); // the token went stale: refresh once
    throw new ApiError(code, r.status);
  };
  try {
    return await go(false);
  } catch (err) {
    const ae = err instanceof ApiError ? err : new ApiError('error');
    if (ae.offline && !snap.offline) emit({ offline: true });
    if (ae.code === 'unauthorized' && e === epoch) await refused();
    throw ae;
  }
}

/** Call a function with the publishable key only (no sign-in): the owner's review and moderation tools. */
export async function anonRpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const r = await call('POST', `/rest/v1/rpc/${fn}`, params, null);
  if (r.status >= 200 && r.status < 300) return r.data as T;
  throw new ApiError(errorCode(r, 'rpc'), r.status);
}

/* ---------------------------------------------------------------- signing in and out */

interface MeRow {
  id: string;
  username: string;
  banned: boolean;
  ban_reason: string | null;
  muted: boolean;
}

function standingFrom(me: MeRow): ScrollStanding {
  return { banned: !!me.banned, banReason: me.ban_reason ?? null, muted: !!me.muted };
}

/** Confirm the session with SirSC Scroll's database, then let the person in. */
async function enter(e: number): Promise<void> {
  const me = await rpc<MeRow>('scroll_me');
  if (e !== epoch || !sess) return;
  if (me.username && me.username !== sess.user.username) {
    sess = { ...sess, user: { ...sess.user, username: me.username } };
    saveSession(sess);
  }
  emit({ status: 'signed-in', user: sess.user, standing: standingFrom(me), restriction: null, notice: null, offline: false });
  signInListeners.forEach((l) => l(sess!.user));
}

export async function signIn(username: string, password: string): Promise<void> {
  const name = username.trim();
  if (!USERNAME_RE.test(name)) throw new ApiError('bad_username');
  if (!password) throw new ApiError('bad_credentials');
  const e = ++epoch;
  const r = await call('POST', '/auth/v1/token?grant_type=password', { email: `${name.toLowerCase()}@${IDENTITY_DOMAIN}`, password });
  if (e !== epoch) throw new ApiError('session_changed');
  const d = r.data as Record<string, unknown> | null;
  if (r.status !== 200 || !d?.access_token) throw new ApiError(errorCode(r, 'auth'), r.status);
  keep(d);
  try {
    await enter(e);
  } catch (err) {
    // A suspended or banned account lands on the restricted screen (refused() already moved there);
    // anything else undoes the half-finished sign-in.
    if (snap.status !== 'restricted') {
      await dropSession(false);
      throw err;
    }
  }
}

/** Sign out on this browser only. */
export async function signOut(notice: string | null = null): Promise<void> {
  await dropSession(true);
  emit({ status: 'signed-out', user: null, restriction: null, standing: null, notice, offline: false });
}

async function dropSession(tellServer: boolean) {
  epoch++;
  window.clearTimeout(refreshTimer);
  const t = sess?.access_token;
  sess = null;
  saveSession(null);
  if (tellServer && t) {
    try {
      await call('POST', '/auth/v1/logout?scope=local', {}, t);
    } catch {
      /* offline: the token simply expires */
    }
  }
}

/** A scroll_* call said "not signed in": find out whether the account is suspended or the sign-in expired. */
let refusing: Promise<void> | null = null;
function refused(): Promise<void> {
  if (snap.status === 'restricted') return Promise.resolve();
  if (!refusing) {
    const e = epoch;
    refusing = (async () => {
      let info: Record<string, unknown> | null = null;
      try {
        if (sess) {
          const r = await call('POST', '/rest/v1/rpc/my_account_state', {}, sess.access_token);
          const d = r.data as Record<string, unknown> | null;
          if (r.status === 200 && d && d.active === false) info = d;
        }
      } catch {
        return; // offline: leave things as they are
      }
      if (e !== epoch) return;
      if (info) {
        emit({
          status: 'restricted',
          restriction: { status: String(info.status ?? 'suspended'), reason: String(info.reason ?? ''), until: (info.restrictedUntil as string | null) ?? null },
          offline: false,
        });
      } else {
        await signOut('Your sign-in expired. Sign in again to keep going.');
      }
    })().finally(() => {
      refusing = null;
    });
  }
  return refusing;
}

/** "Check again" on the restricted screen: back in if an admin lifted it. */
export async function recheck(): Promise<AuthStatus> {
  if (snap.status !== 'restricted' || !sess) return snap.status;
  const e = epoch;
  try {
    await token(true);
    snap = { ...snap, status: 'checking' };
    await enter(e);
  } catch {
    if (snap.status === 'checking') emit({ status: 'restricted' });
  }
  return snap.status;
}

/** Ask again what SirSC Scroll says about the account (after a scroll_banned or scroll_muted answer). */
export async function refreshStanding(): Promise<void> {
  if (snap.status !== 'signed-in') return;
  try {
    const me = await rpc<MeRow>('scroll_me');
    emit({ standing: standingFrom(me) });
  } catch {
    /* handled by rpc() */
  }
}

/** On page load: pick up a saved sign-in. */
export async function startAuth(): Promise<void> {
  sess = loadSession();
  if (!sess) {
    emit({ status: 'signed-out' });
    return;
  }
  const e = epoch;
  scheduleRefresh();
  try {
    await enter(e);
  } catch (err) {
    if (e !== epoch || snap.status === 'restricted' || snap.status === 'signed-out') return;
    if (err instanceof ApiError && (err.offline || err.code === 'server_error' || err.code === 'not_deployed' || err.code === 'rate_limited')) {
      // Can't check right now: keep the saved sign-in and try again later.
      emit({ status: 'signed-in', user: sess.user, offline: err.offline });
      signInListeners.forEach((l) => l(sess!.user));
      window.setTimeout(() => void refreshStanding(), 30_000);
    } else {
      await signOut('Your sign-in expired. Sign in again to keep going.');
    }
  }
}

if (typeof window !== 'undefined') {
  // Signed out (or in as someone else) in another tab: follow along.
  window.addEventListener('storage', (ev) => {
    if (ev.key !== SESSION_KEY) return;
    const other = loadSession();
    if (!other && sess) {
      epoch++;
      window.clearTimeout(refreshTimer);
      sess = null;
      emit({ status: 'signed-out', user: null, restriction: null, standing: null, notice: 'You signed out in another tab.' });
    } else if (other && sess && other.user.id === sess.user.id) {
      sess = other; // refreshed in another tab
      scheduleRefresh();
    } else if (other && other.user.id !== sess?.user.id) {
      window.location.reload();
    }
  });
  // Coming back to a tab after a long sleep: refresh before the next call needs it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sess && sess.expires_at - 90 < now()) void token(true).catch(() => {});
  });
}
