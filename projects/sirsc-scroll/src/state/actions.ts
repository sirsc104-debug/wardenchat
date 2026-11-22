// Every state change in the app goes through here.
import type {
  AccountState,
  ActivityEntry,
  AppNotification,
  Category,
  Comment,
  Draft,
  FeedItem,
  FeedKind,
  ModalState,
  Persisted,
  Session,
  Settings,
  SortKey,
  Video,
} from './types';
import { getState, setAcct, setBoth, setP, setS } from './store';
import { clearStorage, freshPersisted } from './persist';
import { seedAccount } from '../data/seeds';
import { DEMO_IDS, FRIENDS_OF, HANDLE_MAP, USER_MAP } from '../data/users';
import { getVideo, getUser, shareLink } from '../lib/catalog';
import { applyFilters, applySignal, INTEREST_MAX, INTEREST_MIN, rankFollowing, rankForYou, rankFriends, rankTrending, type SignalKind } from '../lib/recommend';
import { between, rng, uid } from '../lib/rng';
import { clamp } from '../lib/format';

/* ---------------------------------------------------------------- toasts & modals */

let toastId = 0;
export function toast(text: string, actionLabel?: string, action?: () => void) {
  const id = ++toastId;
  setS((s) => ({ ...s, toasts: [...s.toasts.slice(-2), { id, text, actionLabel, action }] }));
}

export function dismissToast(id: number) {
  setS((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function openModal(modal: ModalState) {
  setS((s) => ({ ...s, modal }));
}

export function closeModal() {
  setS((s) => (s.modal ? { ...s, modal: null } : s));
}

export function confirmAction(title: string, body: string, confirm: string, action: () => void, danger = true) {
  openModal({ type: 'confirm', title, body, confirm, action, danger });
}

export function openSheet(sheet: Session['sheet']) {
  setS((s) => ({ ...s, sheet }));
}

export function focusSearch() {
  setS((s) => ({ ...s, searchFocus: s.searchFocus + 1 }));
}



/* ---------------------------------------------------------------- playback */

export function setPlaying(playing: boolean) {
  setS((s) => (s.playing === playing ? s : { ...s, playing }));
}

export function togglePlay() {
  setS((s) => ({ ...s, playing: !s.playing }));
}

export function toggleMute() {
  setS((s) => ({ ...s, muted: !s.muted }));
}

export function setMuted(muted: boolean) {
  setS((s) => ({ ...s, muted }));
}

/* ---------------------------------------------------------------- feeds */

function rank(kind: FeedKind, p: Persisted): FeedItem[] {
  if (kind === 'foryou') return rankForYou(p);
  if (kind === 'following') return rankFollowing(p);
  if (kind === 'trending') return rankTrending(p);
  if (kind === 'friends') return rankFriends(p);
  return [];
}

const RANKED: FeedKind[] = ['foryou', 'following', 'trending', 'friends'];

function rebuilt(p: Persisted, s: Session, kinds: FeedKind[] = RANKED, keepCurrent = false): Session {
  const feeds = { ...s.feeds };
  for (const kind of kinds) {
    const prev = feeds[kind];
    let items = applyFilters(p, rank(kind, p), s.category, s.sort);
    let index = 0;
    if (keepCurrent && prev.items[prev.index]) {
      // Keep what's on screen (and what came before it) and re-rank only what comes after.
      const head = prev.items.slice(0, prev.index + 1);
      const headIds = new Set(head.map((i) => i.id));
      items = [...head, ...items.filter((i) => !headIds.has(i.id))];
      index = prev.index;
    }
    feeds[kind] = { ...prev, items, index };
  }
  return { ...s, feeds };
}

/** Rebuild every ranked feed from scratch (account switch, filter change, refresh). */
export function rebuildFeeds(keepCurrent = false) {
  setBoth((st) => ({ ...st, s: rebuilt(st.p, st.s, RANKED, keepCurrent) }));
}

export function setActiveFeed(kind: FeedKind) {
  setS((s) => (s.activeFeed === kind ? s : { ...s, activeFeed: kind }));
}

/** Re-rank the For You tail after the next item, so new signals shape what comes up. */
function retune(st: { p: Persisted; s: Session }): Session {
  const f = st.s.feeds.foryou;
  const head = f.items.slice(0, f.index + 2);
  const headIds = new Set(head.map((i) => i.id));
  const tail = applyFilters(st.p, rankForYou(st.p, headIds), st.s.category, st.s.sort);
  // Endless: when everything has been shown, start another (re-shuffled) lap.
  return { ...st.s, feeds: { ...st.s.feeds, foryou: { ...f, items: [...head, ...tail] } } };
}

export function go(delta: number) {
  setBoth((st) => {
    const kind = st.s.activeFeed;
    const f = st.s.feeds[kind];
    let p = st.p;
    let s = st.s;
    let items = f.items;
    if (kind === 'foryou' && delta > 0) {
      s = retune({ p, s });
      items = s.feeds.foryou.items;
      if (items.length - (f.index + delta) < 4) {
        // Ran out: append another lap with a new shuffle (recently shown clips held back).
        const acct = p.accounts[p.activeId];
        p = { ...p, accounts: { ...p.accounts, [p.activeId]: { ...acct, nonce: acct.nonce + 1 } } };
        const recent = new Set(items.slice(-30).map((i) => i.id));
        items = [...items, ...applyFilters(p, rankForYou(p, recent), s.category, s.sort)];
      }
    }
    const index = clamp(f.index + delta, 0, Math.max(0, items.length - 1));
    if (index === f.index && items === f.items) return st;
    s = { ...s, feeds: { ...s.feeds, [kind]: { ...s.feeds[kind], items, index } } };
    return { p, s };
  });
}

export function goTo(index: number) {
  const { s } = getState();
  go(index - s.feeds[s.activeFeed].index);
}

/** Jump to a video already in the active feed, or insert it right after the current one. */
export function playInFeed(videoId: string) {
  setBoth((st) => {
    const kind = st.s.activeFeed;
    const f = st.s.feeds[kind];
    const at = f.items.findIndex((i) => i.id === videoId);
    if (at >= 0) return { ...st, s: { ...st.s, playing: true, feeds: { ...st.s.feeds, [kind]: { ...f, index: at } } } };
    const items = f.items.slice();
    items.splice(f.index + 1, 0, { id: videoId, reason: 'You picked this' });
    return { ...st, s: { ...st.s, playing: true, feeds: { ...st.s.feeds, [kind]: { ...f, items, index: Math.min(f.index + 1, items.length - 1) } } } };
  });
}

/** Watch a list (profile grid, search results, saved...) starting from one video. */
export function openList(ids: string[], startId: string, label: string, back: string) {
  setS((s) => ({
    ...s,
    activeFeed: 'list',
    playing: true,
    feeds: { ...s.feeds, list: { kind: 'list', items: ids.map((id) => ({ id, reason: label })), index: Math.max(0, ids.indexOf(startId)), label, back } },
  }));
}

/** Deep link: the video first, then For You. */
export function openVideo(id: string) {
  const { p, s } = getState();
  const rest = s.feeds.foryou.items.length ? s.feeds.foryou.items : rankForYou(p);
  openList([id, ...rest.filter((i) => i.id !== id).map((i) => i.id)], id, 'Shared with you', '#/');
}

export function setCategory(category: Category | 'all') {
  setBoth((st) => {
    const s = { ...st.s, category };
    return { ...st, s: rebuilt(st.p, s) };
  });
}

export function setSort(sort: SortKey) {
  setBoth((st) => ({ ...st, s: rebuilt(st.p, { ...st.s, sort }) }));
}

export function refreshFeed() {
  setBoth((st) => {
    const acct = st.p.accounts[st.p.activeId];
    const p = { ...st.p, accounts: { ...st.p.accounts, [st.p.activeId]: { ...acct, nonce: acct.nonce + 1 } } };
    return { p, s: rebuilt(p, st.s) };
  });
  toast('Feed refreshed with new picks');
}

/** Drop videos from every feed after what's on screen (Not Interested, Hide Creator, Report). */
function prune(test: (v: Video) => boolean) {
  setBoth((st) => {
    const feeds = { ...st.s.feeds };
    for (const kind of Object.keys(feeds) as FeedKind[]) {
      const f = feeds[kind];
      const items = f.items.filter((it, i) => {
        const v = getVideo(st.p, it.id);
        return !v || i < f.index || !test(v);
      });
      feeds[kind] = { ...f, items, index: clamp(f.index, 0, Math.max(0, items.length - 1)) };
    }
    return { ...st, s: { ...st.s, feeds } };
  });
}

/* ---------------------------------------------------------------- helpers */

function now() {
  return Date.now();
}

function activity(a: AccountState, entry: Omit<ActivityEntry, 'id' | 'at'>): AccountState {
  return { ...a, activity: [{ ...entry, id: uid('a'), at: now() }, ...a.activity].slice(0, 200) };
}

function signal(a: AccountState, videoId: string, kind: SignalKind): AccountState {
  const v = getVideo(getState().p, videoId);
  return v ? applySignal(a, v, kind) : a;
}

/** Deliver a notification to another demo account on this device. */
function notify(accountId: string, n: Omit<AppNotification, 'id' | 'read' | 'at'> & { at?: number }) {
  if (accountId === getState().p.activeId) return;
  setP((p) => {
    const acct = p.accounts[accountId];
    if (!acct) return p;
    const note: AppNotification = { ...n, at: n.at ?? now(), id: uid('n'), read: false };
    return { ...p, accounts: { ...p.accounts, [accountId]: { ...acct, notifications: [note, ...acct.notifications].slice(0, 150) } } };
  });
}

function me() {
  const { p } = getState();
  return { p, id: p.activeId, acct: p.accounts[p.activeId] };
}

/* ---------------------------------------------------------------- likes, saves, follows */

export function toggleLike(videoId: string) {
  const { acct, id } = me();
  const liked = acct.liked.includes(videoId);
  setAcct((a) => {
    const next = { ...a, liked: liked ? a.liked.filter((x) => x !== videoId) : [videoId, ...a.liked] };
    return activity(signal(next, videoId, liked ? 'unlike' : 'like'), { type: liked ? 'unlike' : 'like', videoId });
  });
  const v = getVideo(getState().p, videoId);
  if (!liked && v && DEMO_IDS.includes(v.creatorId)) notify(v.creatorId, { type: 'like', actorId: id, videoId, text: 'liked your video' });
}

export function likeOnly(videoId: string) {
  if (!me().acct.liked.includes(videoId)) toggleLike(videoId);
}

export function toggleSave(videoId: string) {
  const saved = me().acct.saved.includes(videoId);
  setAcct((a) => {
    const next: AccountState = saved
      ? { ...a, saved: a.saved.filter((x) => x !== videoId), collections: a.collections.map((c) => (c.videoIds.includes(videoId) ? { ...c, videoIds: c.videoIds.filter((x) => x !== videoId) } : c)) }
      : { ...a, saved: [videoId, ...a.saved] };
    const s = signal(next, videoId, saved ? 'unsave' : 'save');
    return saved ? s : activity(s, { type: 'save', videoId });
  });
  if (saved) toast('Removed from Saved');
  else toast('Saved', 'Add to collection', () => openModal({ type: 'collection', videoId }));
}

export function toggleFollow(userId: string) {
  const { acct, id } = me();
  if (userId === id) return;
  const following = acct.following.includes(userId);
  const user = USER_MAP.get(userId);
  setAcct((a) => {
    let next: AccountState = { ...a, following: following ? a.following.filter((x) => x !== userId) : [userId, ...a.following] };
    if (!following && user) {
      const interests = { ...next.interests };
      user.categories.forEach((c, i) => (interests[c] = clamp(interests[c] + (i === 0 ? 0.3 : 0.12), INTEREST_MIN, INTEREST_MAX)));
      next = { ...next, interests, signals: { ...next.signals, follows: next.signals.follows + 1 } };
    }
    return activity(next, { type: following ? 'unfollow' : 'follow', userId });
  });
  if (!following && DEMO_IDS.includes(userId)) notify(userId, { type: 'follow', actorId: id, text: 'started following you' });
  setBoth((st) => ({ ...st, s: rebuilt(st.p, st.s, ['following'], st.s.activeFeed === 'following') }));
  const name = getUser(getState().p, userId)?.handle ?? userId;
  toast(following ? `Unfollowed @${name}` : `Following @${name}`);
}

/* ---------------------------------------------------------------- collections */

export function createCollection(name: string, videoId?: string): string {
  const col = { id: uid('col'), name: name.trim().slice(0, 40) || 'Untitled', videoIds: videoId ? [videoId] : [], createdAt: now() };
  setAcct((a) => {
    const next = { ...a, collections: [...a.collections, col], saved: videoId && !a.saved.includes(videoId) ? [videoId, ...a.saved] : a.saved };
    return activity(next, { type: 'collection', detail: col.name, videoId });
  });
  toast(videoId ? `Saved to “${col.name}”` : `Created “${col.name}”`);
  return col.id;
}

export function toggleInCollection(colId: string, videoId: string) {
  let added = false;
  let name = '';
  setAcct((a) => ({
    ...a,
    saved: a.saved.includes(videoId) ? a.saved : [videoId, ...a.saved],
    collections: a.collections.map((c) => {
      if (c.id !== colId) return c;
      name = c.name;
      added = !c.videoIds.includes(videoId);
      return { ...c, videoIds: added ? [videoId, ...c.videoIds] : c.videoIds.filter((x) => x !== videoId) };
    }),
  }));
  toast(added ? `Added to “${name}”` : `Removed from “${name}”`);
}

export function moveToCollection(fromId: string | null, toId: string, videoId: string) {
  let name = '';
  setAcct((a) => ({
    ...a,
    saved: a.saved.includes(videoId) ? a.saved : [videoId, ...a.saved],
    collections: a.collections.map((c) => {
      if (c.id === toId) {
        name = c.name;
        return c.videoIds.includes(videoId) ? c : { ...c, videoIds: [videoId, ...c.videoIds] };
      }
      if (c.id === fromId) return { ...c, videoIds: c.videoIds.filter((x) => x !== videoId) };
      return c;
    }),
  }));
  toast(`Moved to “${name}”`);
}

export function renameCollection(colId: string, name: string) {
  setAcct((a) => ({ ...a, collections: a.collections.map((c) => (c.id === colId ? { ...c, name: name.trim().slice(0, 40) || c.name } : c)) }));
}

export function deleteCollection(colId: string) {
  setAcct((a) => ({ ...a, collections: a.collections.filter((c) => c.id !== colId) }));
  toast('Collection deleted (videos stay in Saved)');
}

/* ---------------------------------------------------------------- comments */

export function addComment(videoId: string, text: string, parentId?: string): Comment | null {
  const clean = text.trim().slice(0, 300);
  if (!clean) return null;
  const { p, id } = me();
  const c: Comment = { id: uid('c'), videoId, authorId: id, text: clean, at: now(), likes: 0, parentId, local: true };
  setP((pp) => ({ ...pp, userComments: [...pp.userComments, c] }));
  setAcct((a) => activity(signal(a, videoId, 'comment'), { type: parentId ? 'reply' : 'comment', videoId, detail: clean.slice(0, 80) }));
  const v = getVideo(p, videoId);
  const notified = new Set<string>();
  if (parentId) {
    const parent = p.userComments.find((x) => x.id === parentId);
    if (parent && DEMO_IDS.includes(parent.authorId) && parent.authorId !== id) {
      notify(parent.authorId, { type: 'reply', actorId: id, videoId, text: 'replied to your comment', quote: clean });
      notified.add(parent.authorId);
    }
  }
  for (const m of clean.matchAll(/@([a-z0-9._]+)/gi)) {
    const u = HANDLE_MAP.get(m[1].toLowerCase());
    if (u && DEMO_IDS.includes(u.id) && !notified.has(u.id)) {
      notify(u.id, { type: 'mention', actorId: id, videoId, text: 'mentioned you in a comment', quote: clean });
      notified.add(u.id);
    }
  }
  if (v && DEMO_IDS.includes(v.creatorId) && !notified.has(v.creatorId)) notify(v.creatorId, { type: 'comment', actorId: id, videoId, text: 'commented on your video', quote: clean });
  return c;
}

export function deleteComment(commentId: string) {
  setP((p) => ({ ...p, userComments: p.userComments.filter((c) => c.id !== commentId && c.parentId !== commentId) }));
  toast('Comment deleted');
}

export function toggleCommentLike(commentId: string) {
  setAcct((a) => ({ ...a, likedComments: a.likedComments.includes(commentId) ? a.likedComments.filter((x) => x !== commentId) : [commentId, ...a.likedComments] }));
}

/* ---------------------------------------------------------------- sharing */

export async function copyLink(videoId: string) {
  const link = shareLink(videoId);
  let ok = false;
  try {
    await navigator.clipboard.writeText(link);
    ok = true;
  } catch {
    // Clipboard API blocked (e.g. inside an embed): fall back to a hidden textarea.
    const ta = document.createElement('textarea');
    ta.value = link;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
  }
  recordShare(videoId, 'link');
  toast(ok ? 'Link copied to clipboard' : `Copy this link: ${link}`);
}

export function recordShare(videoId: string, to: string) {
  setAcct((a) => activity(signal({ ...a, shares: [{ videoId, to, at: now() }, ...a.shares].slice(0, 200) }, videoId, 'share'), { type: 'share', videoId, userId: USER_MAP.has(to) ? to : undefined, detail: to }));
}

export function shareTo(videoId: string, targets: string[], note: string) {
  const { id } = me();
  for (const t of targets) {
    recordShare(videoId, t);
    if (DEMO_IDS.includes(t)) notify(t, { type: 'share', actorId: id, videoId, text: 'sent you a video', quote: note.trim() || undefined });
  }
}

/* ---------------------------------------------------------------- feed controls */

export function notInterested(videoId: string) {
  setAcct((a) => activity(signal({ ...a, notInterested: [videoId, ...a.notInterested] }, videoId, 'not-interested'), { type: 'not-interested', videoId }));
  prune((v) => v.id === videoId);
  goNextIfCurrent(videoId);
  toast("Got it. You'll see fewer videos like this", 'Undo', () => {
    setAcct((a) => ({ ...a, notInterested: a.notInterested.filter((x) => x !== videoId) }));
  });
}

function goNextIfCurrent(videoId: string) {
  const { s } = getState();
  const f = s.feeds[s.activeFeed];
  if (f.items[f.index]?.id === videoId) {
    if (f.index < f.items.length - 1) go(1);
    // Drop it now that it's behind us.
    setS((ss) => {
      const ff = ss.feeds[ss.activeFeed];
      const at = ff.items.findIndex((i) => i.id === videoId);
      if (at < 0 || at === ff.index) return ss;
      const items = ff.items.filter((_, i) => i !== at);
      return { ...ss, feeds: { ...ss.feeds, [ss.activeFeed]: { ...ff, items, index: at < ff.index ? ff.index - 1 : ff.index } } };
    });
  }
}

export function hideCreator(userId: string) {
  const handle = USER_MAP.get(userId)?.handle ?? userId;
  const { s } = getState();
  const cur = s.feeds[s.activeFeed].items[s.feeds[s.activeFeed].index];
  setAcct((a) => activity({ ...a, hiddenCreators: [userId, ...a.hiddenCreators.filter((x) => x !== userId)], following: a.following.filter((x) => x !== userId) }, { type: 'hide-creator', userId }));
  prune((v) => v.creatorId === userId);
  const cv = cur && getVideo(getState().p, cur.id);
  if (cv && cv.creatorId === userId) goNextIfCurrent(cv.id);
  toast(`Hidden @${handle} from your feeds`, 'Undo', () => unhideCreator(userId));
}

export function unhideCreator(userId: string) {
  setAcct((a) => ({ ...a, hiddenCreators: a.hiddenCreators.filter((x) => x !== userId) }));
  rebuildFeeds(true);
}

export function reportVideo(videoId: string, reason: string) {
  setAcct((a) => activity({ ...a, reported: [videoId, ...a.reported] }, { type: 'report', videoId, detail: reason }));
  prune((v) => v.id === videoId);
  goNextIfCurrent(videoId);
  toast('Thanks. Report recorded (demo only, nothing was sent)');
}

/* ---------------------------------------------------------------- watching */

export function startWatch(videoId: string) {
  setAcct((a) => {
    if (a.historyPaused) return a;
    const prev = a.history.find((h) => h.videoId === videoId);
    if (a.history[0]?.videoId === videoId) return { ...a, history: [{ ...a.history[0], at: now() }, ...a.history.slice(1)] };
    return { ...a, history: [{ videoId, at: now(), progress: prev?.progress ?? 0, completions: prev?.completions ?? 0 }, ...a.history.filter((h) => h.videoId !== videoId)].slice(0, 300) };
  });
}

/** Called when a video leaves the screen: progress, completions and replays become signals. */
export function endWatch(videoId: string, progress: number, completions: number, watchedMs: number) {
  setAcct((a) => {
    let next = a;
    if (!a.historyPaused) {
      next = {
        ...a,
        history: a.history.map((h) => (h.videoId === videoId ? { ...h, progress: Math.max(h.progress, Number(Math.min(1, progress).toFixed(2))), completions: h.completions + completions } : h)),
      };
    }
    if (completions > 1) next = signal(next, videoId, 'replay');
    if (completions > 0) next = signal(next, videoId, 'complete');
    else if (progress < 0.2 && watchedMs > 400) next = signal(next, videoId, 'skip');
    return next;
  });
}

export function removeHistory(videoId: string) {
  setAcct((a) => ({ ...a, history: a.history.filter((h) => h.videoId !== videoId) }));
}

export function clearHistory() {
  setAcct((a) => ({ ...a, history: [] }));
  toast('Watch history cleared');
}

export function setHistoryPaused(paused: boolean) {
  setAcct((a) => ({ ...a, historyPaused: paused }));
  toast(paused ? 'Watch history paused' : 'Watch history is on');
}

/* ---------------------------------------------------------------- interests */

export function setInterest(category: Category, value: number) {
  setAcct((a) => ({ ...a, interests: { ...a.interests, [category]: clamp(Number(value.toFixed(2)), INTEREST_MIN, INTEREST_MAX) } }));
}

export function nudgeInterest(category: Category, delta: number) {
  setInterest(category, me().acct.interests[category] + delta);
}

export function applyInterestChanges() {
  rebuildFeeds(true);
  toast('Feed updated with your preferences');
}

export function resetRecommendations() {
  const seed = seedAccount(getState().p.activeId);
  setAcct((a) => ({ ...a, interests: seed.interests, tagAffinity: {}, notInterested: [], signals: seed.signals, nonce: a.nonce + 1 }));
  rebuildFeeds();
  toast('Recommendations reset to this account’s starting interests');
}

/* ---------------------------------------------------------------- notifications */

export function markRead(id: string) {
  setAcct((a) => (a.notifications.some((n) => n.id === id && !n.read) ? { ...a, notifications: a.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) } : a));
}

export function markAllRead() {
  const t = now();
  setAcct((a) => ({ ...a, notifications: a.notifications.map((n) => (n.at <= t ? { ...n, read: true } : n)) }));
}

export function toggleRead(id: string) {
  setAcct((a) => ({ ...a, notifications: a.notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n)) }));
}

/* ---------------------------------------------------------------- search */

export function addRecentSearch(q: string) {
  const query = q.trim();
  if (!query) return;
  setAcct((a) => ({ ...a, recentSearches: [query, ...a.recentSearches.filter((x) => x.toLowerCase() !== query.toLowerCase())].slice(0, 8) }));
}

export function removeRecentSearch(q: string) {
  setAcct((a) => ({ ...a, recentSearches: a.recentSearches.filter((x) => x !== q) }));
}

export function clearRecentSearches() {
  setAcct((a) => ({ ...a, recentSearches: [] }));
}

/* ---------------------------------------------------------------- accounts & settings */

export function switchAccount(id: string) {
  if (!DEMO_IDS.includes(id)) return;
  setBoth((st) => {
    if (st.p.activeId === id) return st;
    const p = { ...st.p, activeId: id };
    const s: Session = { ...st.s, activeFeed: st.s.activeFeed === 'list' ? 'foryou' : st.s.activeFeed, category: 'all', sort: 'recommended', sheet: null, modal: null, customizeOpen: false };
    return { p, s: rebuilt(p, s) };
  });
  toast(`Switched to ${getState().p.accounts[id].profile.name}`);
}

export function updateProfile(edits: Partial<AccountState['profile']>) {
  setAcct((a) => ({ ...a, profile: { ...a.profile, ...edits, name: (edits.name ?? a.profile.name).trim().slice(0, 30) || a.profile.name, bio: (edits.bio ?? a.profile.bio).slice(0, 160) } }));
}

export function resetAccount(id = getState().p.activeId) {
  setP((p) => ({
    ...p,
    accounts: { ...p.accounts, [id]: seedAccount(id) },
    userComments: p.userComments.filter((c) => c.authorId !== id),
    userVideos: p.userVideos.filter((v) => v.creatorId !== id),
  }));
  rebuildFeeds();
  toast(`${getState().p.accounts[id].profile.name}’s demo data was reset`);
}

export function resetAll() {
  clearStorage();
  setBoth((st) => {
    const p = { ...freshPersisted(st.p.activeId), settings: st.p.settings };
    return { p, s: rebuilt(p, { ...st.s, activeFeed: 'foryou', category: 'all', sort: 'recommended', modal: null }) };
  });
  toast('All demo data reset');
}

export function updateSettings(patch: Partial<Settings>) {
  setP((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
}

/* ---------------------------------------------------------------- studio */

export function saveDraft(d: Draft) {
  setAcct((a) => ({ ...a, drafts: [{ ...d, updatedAt: now() }, ...a.drafts.filter((x) => x.id !== d.id)] }));
}

export function deleteDraft(id: string) {
  setAcct((a) => ({ ...a, drafts: a.drafts.filter((x) => x.id !== id) }));
}

export function publishDraft(d: Draft): Video {
  const { id } = me();
  const r = rng(`${d.id}:${d.title}`);
  const followers = USER_MAP.get(id)?.followers ?? 1000;
  const views = Math.round(followers * between(r, 0.6, 2.2) + between(r, 200, 900));
  const likes = Math.round(views * between(r, 0.07, 0.13));
  const video: Video = {
    id: uid('u'),
    creatorId: id,
    title: d.title.trim() || 'Untitled clip',
    description: d.caption.trim(),
    hashtags: d.hashtags.length ? d.hashtags : [d.category],
    category: d.category,
    duration: d.duration,
    views,
    likes,
    comments: Math.round(likes * between(r, 0.02, 0.05)),
    shares: Math.round(likes * between(r, 0.03, 0.07)),
    saves: Math.round(likes * between(r, 0.02, 0.06)),
    uploadedAt: now(),
    template: d.template,
    palette: d.palette,
    caption: d.caption.trim() ? (d.title.trim() || d.caption).toUpperCase().slice(0, 28) : (d.title || 'MY CLIP').toUpperCase().slice(0, 28),
    glyph: d.glyph,
    variant: d.variant,
    frame: d.frame,
    sound: `Original sound — @${USER_MAP.get(id)?.handle ?? id}`,
    meta: { quality: 0.8, momentum: 0.7, alsoFor: [] },
    local: true,
    visibility: d.visibility,
    allowComments: d.allowComments,
  };
  setP((p) => ({ ...p, userVideos: [video, ...p.userVideos] }));
  setAcct((a) => {
    // The simulated audience arrives over the next few minutes.
    const t = now();
    const strangers = [...USER_MAP.values()].filter((u) => u.kind !== 'demo');
    const pickU = () => strangers[Math.floor(r() * strangers.length)].id;
    const incoming: AppNotification[] = [
      { id: uid('n'), type: 'system', actorId: 'sirsc', videoId: video.id, text: `Your video “${video.title}” is live`, at: t, read: false },
      { id: uid('n'), type: 'like', actorId: pickU(), videoId: video.id, text: 'liked your video', at: t + 25_000, read: false },
      { id: uid('n'), type: 'comment', actorId: pickU(), videoId: video.id, text: 'commented on your video', quote: 'okay this is actually so good', at: t + 70_000, read: false },
      { id: uid('n'), type: 'follow', actorId: pickU(), text: 'started following you', at: t + 120_000, read: false },
      { id: uid('n'), type: 'trending', actorId: id, videoId: video.id, text: 'Your video is picking up views (simulated)', at: t + 240_000, read: false },
    ];
    return activity({ ...a, drafts: a.drafts.filter((x) => x.id !== d.id), notifications: [...incoming, ...a.notifications] }, { type: 'publish', videoId: video.id, detail: video.title });
  });
  // Friends who follow this account hear about it.
  if (d.visibility !== 'private') {
    for (const other of DEMO_IDS) {
      if (other === id) continue;
      const follows = getState().p.accounts[other].following.includes(id);
      const isFriend = (FRIENDS_OF[id] ?? []).includes(other);
      if ((follows || isFriend) && (d.visibility === 'public' || isFriend)) notify(other, { type: 'post', actorId: id, videoId: video.id, text: 'posted a new video' });
    }
  }
  rebuildFeeds(true);
  return video;
}

export function deleteUserVideo(videoId: string) {
  setP((p) => ({ ...p, userVideos: p.userVideos.filter((v) => v.id !== videoId), userComments: p.userComments.filter((c) => c.videoId !== videoId) }));
  prune((v) => v.id === videoId);
  toast('Video deleted');
}

export function setVideoVisibility(videoId: string, visibility: Video['visibility']) {
  setP((p) => ({ ...p, userVideos: p.userVideos.map((v) => (v.id === videoId ? { ...v, visibility } : v)) }));
}
