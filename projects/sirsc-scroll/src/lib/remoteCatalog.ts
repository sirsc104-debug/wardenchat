// The in-memory pool of real videos loaded from the SirSC Scroll catalog, as a tiny external store.
// lib/catalog.ts reads it through catalogVideos(); App configures it from Settings and rebuilds the feeds
// whenever it grows. YouTube channels are registered as creators in the app's user maps so captions,
// profiles, follows and recommendations work without changes.

import { useSyncExternalStore } from 'react';
import type { Category } from '../state/types';
import { HANDLE_MAP, USER_MAP } from '../data/users';
import { fetchFeed, lookupVideos, type CatalogCategory, type CatalogConfig, type CatalogFeed, type CatalogVideo } from './scrollCatalog';
import { catalogCategoriesFor, channelToUser, toSirscVideo, YT_PREFIX, type RealVideo } from './videoSource';

/** Public by design: the publishable key can only read approved videos (or pending ones with the preview key). */
export const CATALOG: CatalogConfig = {
  url: 'https://djmyvnaragfwoaljzexn.supabase.co',
  publishableKey: 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni',
};

export type CatalogStatus = 'off' | 'loading' | 'ready' | 'empty' | 'error';

export interface CatalogSnapshot {
  status: CatalogStatus;
  /** Videos in the pool that can be shown. */
  count: number;
  /** The preview key was accepted, so pending (unreviewed) videos are included. */
  preview: boolean;
  /** A preview key is set but the server didn't accept it. */
  keyRejected: boolean;
  error: string | null;
  /** Every feed has been read to the end. */
  exhausted: boolean;
  loadingMore: boolean;
  version: number;
}

const FAILED_KEY = 'sirsc-scroll:yt-unplayable';
const PAGE = 50;

let snap: CatalogSnapshot = { status: 'off', count: 0, preview: false, keyRejected: false, error: null, exhausted: false, loadingMore: false, version: 0 };
const listeners = new Set<() => void>();

let conf = { enabled: false, previewKey: '' };
let gen = 0;
let pool: RealVideo[] = [];
let visible: RealVideo[] = [];
const byId = new Map<string, RealVideo>();
const addedUsers: string[] = [];
const cursors: Partial<Record<CatalogFeed, string | null>> = {};
let boost: CatalogCategory[] = [];
const failed = loadFailed();

function emit(patch: Partial<CatalogSnapshot>) {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeCatalog(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function catalogSnapshot(): CatalogSnapshot {
  return snap;
}

export function useCatalog(): CatalogSnapshot {
  return useSyncExternalStore(subscribeCatalog, catalogSnapshot, catalogSnapshot);
}

/** Real videos to show, or null while the catalog isn't in use. Empty while it's loading. */
export function catalogVideos(): RealVideo[] | null {
  return snap.status === 'off' ? null : visible;
}

export function catalogVersion(): number {
  return snap.version;
}

export function catalogVideo(id: string): RealVideo | undefined {
  const v = byId.get(id);
  return v && !failed.has(id) ? v : undefined;
}

function loadFailed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAILED_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveFailed() {
  try {
    localStorage.setItem(FAILED_KEY, JSON.stringify([...failed].slice(-500)));
  } catch {
    /* storage blocked */
  }
}

function recompute() {
  visible = pool.filter((v) => !failed.has(v.id));
}

function add(items: CatalogVideo[]): number {
  let n = 0;
  for (const c of items) {
    if (!c || typeof c.video_id !== 'string') continue;
    const v = toSirscVideo(c);
    if (byId.has(v.id)) continue;
    byId.set(v.id, v);
    pool.push(v);
    n++;
    const u = channelToUser(c, (h) => HANDLE_MAP.has(h));
    if (u && !USER_MAP.has(u.id)) {
      USER_MAP.set(u.id, u);
      HANDLE_MAP.set(u.handle, u);
      addedUsers.push(u.id);
    }
  }
  if (n) recompute();
  return n;
}

function reset() {
  gen++;
  for (const id of addedUsers) {
    const u = USER_MAP.get(id);
    if (u) HANDLE_MAP.delete(u.handle);
    USER_MAP.delete(id);
  }
  addedUsers.length = 0;
  pool = [];
  visible = [];
  byId.clear();
  for (const k of Object.keys(cursors)) delete cursors[k as CatalogFeed];
}

/** Turn the catalog on or off, or change the preview key. Reloads only when something changed. */
export function configureCatalog(opts: { enabled: boolean; previewKey: string; interests: Category[] }) {
  const next = { enabled: opts.enabled, previewKey: opts.previewKey.trim() };
  if (next.enabled === conf.enabled && next.previewKey === conf.previewKey && snap.status !== 'error') return;
  reset();
  conf = next;
  if (!conf.enabled) {
    emit({ status: 'off', count: 0, preview: false, keyRejected: false, error: null, exhausted: false, loadingMore: false, version: snap.version + 1 });
    return;
  }
  boost = catalogCategoriesFor(opts.interests);
  void loadInitial(gen);
}

/** Load the catalog again from scratch (after review changes, so rejected videos leave the feed). */
export function reloadCatalog(interests: Category[]) {
  if (!conf.enabled) return;
  const previewKey = conf.previewKey;
  conf = { enabled: false, previewKey };
  configureCatalog({ enabled: true, previewKey, interests });
}

/** Retry after an error (for example when the network comes back). */
export function retryCatalog(interests: Category[]) {
  conf = { enabled: false, previewKey: conf.previewKey };
  configureCatalog({ enabled: true, previewKey: conf.previewKey, interests });
}

async function loadInitial(g: number) {
  emit({ status: 'loading', count: 0, error: null, exhausted: false, version: snap.version + 1 });
  try {
    const [forYou, trending] = await Promise.all([
      fetchFeed(CATALOG, { feed: 'for_you', limit: PAGE, boostCategories: boost, previewKey: conf.previewKey }),
      fetchFeed(CATALOG, { feed: 'trending', limit: PAGE, previewKey: conf.previewKey }),
    ]);
    if (g !== gen) return;
    cursors.for_you = forYou.next_cursor;
    cursors.trending = trending.next_cursor;
    add(forYou.items);
    add(trending.items);
    emit({
      status: visible.length ? 'ready' : 'empty',
      count: visible.length,
      preview: forYou.preview,
      keyRejected: !!conf.previewKey && !forYou.preview,
      version: snap.version + 1,
    });
  } catch (e) {
    if (g !== gen) return;
    emit({ status: 'error', error: e instanceof Error ? e.message : String(e), version: snap.version + 1 });
  }
}

/** Fetch the next page: For You first, then newest, then trending, until every feed is exhausted. */
export async function loadMoreCatalog(): Promise<number> {
  if (snap.status !== 'ready' || snap.loadingMore || snap.exhausted) return 0;
  const order: CatalogFeed[] = ['for_you', 'newest', 'trending'];
  const feed = order.find((f) => cursors[f] !== null);
  if (!feed) {
    emit({ exhausted: true });
    return 0;
  }
  const g = gen;
  emit({ loadingMore: true });
  try {
    const page = await fetchFeed(CATALOG, {
      feed,
      limit: PAGE,
      cursor: cursors[feed] ?? null,
      boostCategories: feed === 'for_you' ? boost : [],
      previewKey: conf.previewKey,
    });
    if (g !== gen) return 0;
    cursors[feed] = page.next_cursor;
    const n = add(page.items);
    emit({ loadingMore: false, count: visible.length, exhausted: order.every((f) => cursors[f] === null), version: snap.version + (n ? 1 : 0) });
    // A page of nothing new (everything already loaded): try the next feed straight away.
    if (!n && !snap.exhausted) return loadMoreCatalog();
    return n;
  } catch {
    if (g === gen) emit({ loadingMore: false });
    return 0;
  }
}

/** Load details for real videos the account refers to (saved, liked, history...) that aren't in the pool yet. */
export async function lookupCatalogIds(appIds: string[]): Promise<void> {
  if (snap.status !== 'ready' && snap.status !== 'empty') return;
  const want = [...new Set(appIds.filter((id) => id.startsWith(YT_PREFIX) && !byId.has(id) && !failed.has(id)).map((id) => id.slice(YT_PREFIX.length)))];
  const g = gen;
  for (let i = 0; i < want.length; i += 200) {
    try {
      const res = await lookupVideos(CATALOG, want.slice(i, i + 200), conf.previewKey);
      if (g !== gen) return;
      if (add(res.items)) emit({ status: 'ready', count: visible.length, version: snap.version + 1 });
    } catch {
      return;
    }
  }
}

/** A video YouTube wouldn't play here: hide it on this device from now on. */
export function markUnplayable(appId: string) {
  if (failed.has(appId)) return;
  failed.add(appId);
  saveFailed();
  recompute();
  emit({ count: visible.length, version: snap.version + 1 });
}

export function unplayableCount(): number {
  return failed.size;
}

export function clearUnplayable() {
  failed.clear();
  saveFailed();
  recompute();
  emit({ count: visible.length, version: snap.version + 1 });
}
