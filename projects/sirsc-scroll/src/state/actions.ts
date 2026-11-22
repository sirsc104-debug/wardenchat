// Every state change in the app goes through here.
import type { AccountState, ActivityEntry, Category, FeedItem, FeedKind, ModalState, Persisted, Session, Settings, SortKey, Video } from './types';
import { getState, setAcct, setBoth, setP, setS } from './store';
import { SIGNED_OUT } from './persist';
import { freshAccount } from '../data/seeds';
import { USER_MAP, memberUser, setSignedInUser } from '../data/users';
import { getVideo, getUser, videoMode } from '../lib/catalog';
import { catalogVideos, loadMoreCatalog } from '../lib/remoteCatalog';
import { applyFilters, applySignal, INTEREST_MAX, INTEREST_MIN, rankFollowing, rankForYou, rankTrending, type SignalKind } from '../lib/recommend';
import { uid } from '../lib/rng';
import { clamp } from '../lib/format';
import { fetchMyLikes, onLikedFromServer, resetSocial, setVideoLiked, socialErrorText, socialFor } from '../lib/social';
import type { WardenUser } from '../lib/warden';

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
  return [];
}

const RANKED: FeedKind[] = ['foryou', 'following', 'trending'];

function rebuilt(p: Persisted, s: Session, kinds: FeedKind[] = RANKED, keepCurrent = false): Session {
  const feeds = { ...s.feeds };
  for (const kind of kinds) {
    const prev = feeds[kind];
    let items = applyFilters(p, rank(kind, p), s.category, s.sort);
    let index = 0;
    if (keepCurrent && prev.items[prev.index]) {
      // Keep what's on screen (and what came before it) and re-rank only what comes after. Entries whose
      // video is gone (a real video hidden as unplayable, say) drop out.
      const head = prev.items.slice(0, prev.index + 1).filter((i) => getVideo(p, i.id));
      const headIds = new Set(head.map((i) => i.id));
      items = [...head, ...items.filter((i) => !headIds.has(i.id))];
      index = Math.max(0, head.length - 1);
    }
    feeds[kind] = { ...prev, items, index };
  }
  return { ...s, feeds };
}

/** Rebuild every ranked feed from scratch (sign-in, filter change, refresh). */
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
  if (delta > 0) topUpCatalog();
}

/** Real videos: fetch another catalog page once fewer than 25 loaded videos are still unwatched. */
function topUpCatalog() {
  const { p } = getState();
  if (videoMode(p) !== 'catalog') return;
  const pool = catalogVideos();
  if (!pool) return;
  const seen = new Set(p.accounts[p.activeId].history.map((h) => h.videoId));
  let unseen = 0;
  for (const v of pool) if (!seen.has(v.id) && ++unseen >= 25) return;
  void loadMoreCatalog();
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
  openList([id, ...rest.filter((i) => i.id !== id).map((i) => i.id)], id, 'Opened from a link', '#/');
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

function me() {
  const { p } = getState();
  return { p, id: p.activeId, acct: p.accounts[p.activeId] };
}

/* ---------------------------------------------------------------- likes, saves, follows */

/** Why a video can't be liked or commented on, or null if it can. */
export function socialClosedReason(v: Video): string | null {
  if (socialFor(v.id) !== 'closed') return null;
  return v.source ? 'Likes and comments open once this video is approved.' : 'This is a demo clip. Likes and comments work on real videos.';
}

function setLikedLocally(videoId: string, liked: boolean) {
  setAcct((a) => {
    if (a.liked.includes(videoId) === liked) return a;
    const next = { ...a, liked: liked ? [videoId, ...a.liked] : a.liked.filter((x) => x !== videoId) };
    return activity(signal(next, videoId, liked ? 'like' : 'unlike'), { type: liked ? 'like' : 'unlike', videoId });
  });
}

/** Like or unlike. Saved in Warden Chat's database; the account's own list follows for recommendations. */
export function toggleLike(videoId: string) {
  const { acct, p } = me();
  const v = getVideo(p, videoId);
  if (!v) return;
  const closedWhy = socialClosedReason(v);
  if (closedWhy) {
    toast(closedWhy);
    return;
  }
  const s = socialFor(videoId);
  const liked = s && s !== 'closed' ? s.liked : acct.liked.includes(videoId);
  setLikedLocally(videoId, !liked);
  setVideoLiked(videoId, !liked).catch((e) => {
    setLikedLocally(videoId, liked);
    toast(socialErrorText(e));
  });
}

export function likeOnly(videoId: string) {
  const s = socialFor(videoId);
  const liked = s && s !== 'closed' ? s.liked : me().acct.liked.includes(videoId);
  if (!liked) toggleLike(videoId);
}

// What the server says you liked (counts for videos on screen) keeps the local list in step, e.g. after
// liking on another device.
onLikedFromServer((map) => {
  setAcct((a) => {
    let liked = a.liked;
    for (const [id, on] of map) {
      const has = liked.includes(id);
      if (on && !has) liked = [id, ...liked];
      else if (!on && has) liked = liked.filter((x) => x !== id);
    }
    return liked === a.liked ? a : { ...a, liked };
  });
});

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

/** A comment was posted: it teaches recommendations like any other interaction. */
export function notePosted(videoId: string, reply: boolean, text: string) {
  setAcct((a) => activity(signal(a, videoId, 'comment'), { type: reply ? 'reply' : 'comment', videoId, detail: text.slice(0, 80) }));
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
  const seed = freshAccount();
  setAcct((a) => ({ ...a, interests: seed.interests, tagAffinity: {}, notInterested: [], signals: seed.signals, nonce: a.nonce + 1 }));
  rebuildFeeds();
  toast('Recommendations reset: every topic counts the same again');
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

/** Signed in with Warden Chat: switch to that account's data on this browser (new accounts start empty). */
export function enterAccount(u: WardenUser) {
  const id = `w:${u.id}`;
  setSignedInUser(memberUser(u.id, u.username));
  const isNew = !getState().p.accounts[id];
  setBoth((st) => {
    if (st.p.activeId === id && !isNew) return st;
    const accounts = isNew ? { ...st.p.accounts, [id]: freshAccount() } : st.p.accounts;
    const p = { ...st.p, activeId: id, accounts };
    const s: Session = { ...st.s, activeFeed: 'foryou', category: 'all', sort: 'recommended', sheet: null, modal: null, customizeOpen: false };
    return { p, s: rebuilt(p, s) };
  });
  // Real likes from the server, so recommendations and "Liked" match every device.
  fetchMyLikes()
    .then((ids) => {
      setAcct((a) => {
        const local = a.liked.filter((x) => !x.startsWith('yt-'));
        return { ...a, liked: [...ids, ...local.filter((x) => !ids.includes(x))] };
      });
    })
    .catch(() => {});
  if (isNew) openModal({ type: 'interests', welcome: true });
}

/** Signed out: show nothing of the account behind the sign-in screen. */
export function leaveAccount(forget = false) {
  resetSocial();
  setSignedInUser(null);
  setBoth((st) => {
    const old = st.p.activeId;
    const accounts: Record<string, AccountState> = { ...st.p.accounts, [SIGNED_OUT]: freshAccount() };
    if (forget && old !== SIGNED_OUT) delete accounts[old];
    const p = { ...st.p, activeId: SIGNED_OUT, accounts };
    const s: Session = { ...st.s, activeFeed: 'foryou', category: 'all', sort: 'recommended', sheet: null, modal: null, customizeOpen: false, toasts: [] };
    return { p, s: rebuilt(p, s) };
  });
}

/** Clear this account's follows, saves, collections, history and interests on this browser. */
export function resetAccount() {
  setAcct(() => freshAccount());
  rebuildFeeds();
  toast('This account’s data on this browser was cleared');
}

export function updateSettings(patch: Partial<Settings>) {
  setP((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
}
