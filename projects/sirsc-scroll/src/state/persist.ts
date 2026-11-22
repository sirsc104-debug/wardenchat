// Local persistence. Settings, the widget layout, and each Warden Chat account's own follows, saves,
// collections, history and interests are kept in localStorage under one key. Likes and comments are
// not: they live in Warden Chat's database (lib/social.ts).
import type { AccountState, Persisted } from './types';
import { DEFAULT_SETTINGS, freshAccount } from '../data/seeds';
import { DEFAULT_WIDGETS, normalizeWidgets } from './widgetDefaults';

export const STORAGE_KEY = 'sirsc-scroll:v1';
const VERSION = 2;
/** The account shown behind the sign-in screen: always empty, never saved with anything in it. */
export const SIGNED_OUT = 'signed-out';

export function freshPersisted(): Persisted {
  return { v: VERSION, activeId: SIGNED_OUT, accounts: { [SIGNED_OUT]: freshAccount() }, settings: { ...DEFAULT_SETTINGS }, widgets: normalizeWidgets(DEFAULT_WIDGETS) };
}

export function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshPersisted();
    const data = JSON.parse(raw) as Partial<Persisted> & { v?: number };
    if (!data || typeof data !== 'object') return freshPersisted();
    const base = freshPersisted();
    const settings = { ...base.settings, ...data.settings };
    const widgets = normalizeWidgets(data.widgets);
    // Version 1 held the four demo accounts: keep the settings and layout, drop the demo data.
    if (data.v !== VERSION || typeof data.accounts !== 'object' || !data.accounts) return { ...base, settings, widgets };
    const accounts: Record<string, AccountState> = { [SIGNED_OUT]: freshAccount() };
    for (const [id, saved] of Object.entries(data.accounts)) {
      if (!id.startsWith('w:') || !saved) continue;
      const fresh = freshAccount();
      // Fill in any fields added since the save was written.
      accounts[id] = { ...fresh, ...saved, signals: { ...fresh.signals, ...saved.signals } };
    }
    // Start signed out; the saved Warden Chat sign-in (lib/warden.ts) picks the account again.
    return { ...base, accounts, settings, widgets };
  } catch {
    return freshPersisted();
  }
}

let timer: number | undefined;
let pending: Persisted | null = null;

function flush() {
  if (!pending) return;
  try {
    // The signed-out placeholder is never worth saving.
    const { [SIGNED_OUT]: _placeholder, ...accounts } = pending.accounts;
    void _placeholder;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...pending, activeId: SIGNED_OUT, accounts }));
  } catch {
    /* Storage full or blocked (private window): everything keeps working for this visit. */
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
