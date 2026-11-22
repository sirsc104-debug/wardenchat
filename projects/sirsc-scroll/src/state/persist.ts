// Local persistence layer. Everything the demo accounts do is kept in localStorage under one key.
// Swap load/save for API calls when a backend exists.
import type { AccountState, Persisted } from './types';
import { DEMO_IDS } from '../data/users';
import { DEFAULT_SETTINGS, seedAccount } from '../data/seeds';

export const STORAGE_KEY = 'sirsc-scroll:v1';
const VERSION = 1;

export function freshPersisted(activeId = 'alex'): Persisted {
  const accounts: Record<string, AccountState> = {};
  for (const id of DEMO_IDS) accounts[id] = seedAccount(id);
  return { v: VERSION, activeId, accounts, userVideos: [], userComments: [], settings: { ...DEFAULT_SETTINGS } };
}

export function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshPersisted();
    const data = JSON.parse(raw) as Persisted;
    if (!data || data.v !== VERSION || typeof data.accounts !== 'object') return freshPersisted();
    const base = freshPersisted(DEMO_IDS.includes(data.activeId) ? data.activeId : 'alex');
    for (const id of DEMO_IDS) {
      const saved = data.accounts[id];
      // Fill in any fields added since the save was written.
      base.accounts[id] = saved ? { ...base.accounts[id], ...saved, signals: { ...base.accounts[id].signals, ...saved.signals } } : base.accounts[id];
    }
    return {
      ...base,
      userVideos: Array.isArray(data.userVideos) ? data.userVideos : [],
      userComments: Array.isArray(data.userComments) ? data.userComments : [],
      settings: { ...base.settings, ...data.settings },
    };
  } catch {
    return freshPersisted();
  }
}

let timer: number | undefined;
let pending: Persisted | null = null;

function flush() {
  if (!pending) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    /* Storage full or blocked (private window): the demo keeps working for this visit. */
  }
  pending = null;
}

/** Debounced save; also flushed when the page is hidden. */
export function save(p: Persisted) {
  pending = p;
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, 300);
}

export function flushNow() {
  window.clearTimeout(timer);
  flush();
}

export function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
