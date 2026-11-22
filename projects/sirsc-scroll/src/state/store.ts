// A tiny external store with selector hooks (useSyncExternalStore), so a like only re-renders
// the components that read the changed slice.
import { useSyncExternalStore } from 'react';
import type { AccountState, FeedKind, FeedState, Persisted, RootState, Session } from './types';
import { flushNow, load, save } from './persist';

type Listener = () => void;

const EMPTY_FEED = (kind: FeedKind): FeedState => ({ kind, items: [], index: 0 });

function initialSession(p: Persisted): Session {
  return {
    feeds: {
      foryou: EMPTY_FEED('foryou'),
      following: EMPTY_FEED('following'),
      trending: EMPTY_FEED('trending'),
      list: EMPTY_FEED('list'),
    },
    activeFeed: 'foryou',
    category: 'all',
    sort: 'recommended',
    playing: p.settings.autoplay,
    muted: p.settings.startMuted,
    widgetFocus: null,
    customizeOpen: false,
    sheet: null,
    modal: null,
    toasts: [],
    searchFocus: 0,
    composerFocus: 0,
  };
}

const p0 = load();
let state: RootState = { p: p0, s: initialSession(p0) };
const listeners = new Set<Listener>();

export function getState(): RootState {
  return state;
}

function emit(next: RootState) {
  const persistChanged = next.p !== state.p;
  state = next;
  if (persistChanged) save(next.p);
  listeners.forEach((l) => l());
}

export function setP(fn: (p: Persisted) => Persisted) {
  const p = fn(state.p);
  if (p !== state.p) emit({ ...state, p });
}

export function setS(fn: (s: Session) => Session) {
  const s = fn(state.s);
  if (s !== state.s) emit({ ...state, s });
}

export function setBoth(fn: (st: RootState) => RootState) {
  const next = fn(state);
  if (next !== state) emit(next);
}

/** Replace the active account's state. */
export function setAcct(fn: (a: AccountState) => AccountState) {
  setP((p) => {
    const cur = p.accounts[p.activeId];
    const next = fn(cur);
    return next === cur ? p : { ...p, accounts: { ...p.accounts, [p.activeId]: next } };
  });
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Select a stable slice of state (return state references or primitives, not new objects). */
export function useApp<T>(sel: (st: RootState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

export function useP<T>(sel: (p: Persisted) => T): T {
  return useApp((st) => sel(st.p));
}

export function useS<T>(sel: (s: Session) => T): T {
  return useApp((st) => sel(st.s));
}

export function useAcct<T>(sel: (a: AccountState) => T): T {
  return useApp((st) => sel(st.p.accounts[st.p.activeId]));
}

export function usePersisted(): Persisted {
  return useApp((st) => st.p);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
}
