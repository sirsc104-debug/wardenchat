// A small, transparent, local recommendation engine. No machine learning: weighted interests,
// hashtag affinity, follows, friends' activity, freshness and watch history, plus a seeded shuffle.
import type { AccountState, Category, FeedItem, HistoryEntry, Persisted, SortKey, Video } from '../state/types';
import { CATEGORY_IDS, categoryLabel } from '../data/categories';
import { FRIENDS_OF, USER_MAP } from '../data/users';
import { allVideos, canSee, friendActivity, getVideo, likeCount } from './catalog';
import { clamp } from './format';
import { hash01 } from './rng';

const DAY = 86_400_000;

export type SignalKind =
  | 'like'
  | 'unlike'
  | 'save'
  | 'unsave'
  | 'follow'
  | 'comment'
  | 'share'
  | 'complete'
  | 'replay'
  | 'skip'
  | 'not-interested';

const WEIGHTS: Record<SignalKind, [cat: number, tag: number]> = {
  like: [0.32, 0.3],
  unlike: [-0.2, -0.2],
  save: [0.42, 0.35],
  unsave: [-0.15, -0.1],
  follow: [0.3, 0.1],
  comment: [0.25, 0.2],
  share: [0.3, 0.25],
  complete: [0.1, 0.06],
  replay: [0.18, 0.12],
  skip: [-0.07, -0.05],
  'not-interested': [-0.9, -0.6],
};

const COUNTER: Partial<Record<SignalKind, keyof AccountState['signals']>> = {
  like: 'likes',
  save: 'saves',
  follow: 'follows',
  comment: 'comments',
  share: 'shares',
  complete: 'completions',
  replay: 'replays',
  skip: 'skips',
  'not-interested': 'notInterested',
};

export const INTEREST_MIN = 0.1;
export const INTEREST_MAX = 5;

/** Nudge category and hashtag weights after an interaction. Returns a new account object. */
export function applySignal(acct: AccountState, v: Video, kind: SignalKind): AccountState {
  const [cw, tw] = WEIGHTS[kind];
  const interests = { ...acct.interests };
  interests[v.category] = clamp(interests[v.category] + cw, INTEREST_MIN, INTEREST_MAX);
  for (const c of v.meta.alsoFor) interests[c] = clamp(interests[c] + cw * 0.25, INTEREST_MIN, INTEREST_MAX);
  const tagAffinity = { ...acct.tagAffinity };
  for (const t of v.hashtags) tagAffinity[t] = clamp((tagAffinity[t] ?? 0) + tw, -2, 3);
  const key = COUNTER[kind];
  const signals = key ? { ...acct.signals, [key]: acct.signals[key] + 1 } : acct.signals;
  return { ...acct, interests, tagAffinity, signals };
}

export function topInterests(acct: AccountState): { category: Category; weight: number; share: number }[] {
  const total = CATEGORY_IDS.reduce((s, c) => s + acct.interests[c], 0) || 1;
  return CATEGORY_IDS.map((c) => ({ category: c, weight: acct.interests[c], share: acct.interests[c] / total })).sort((a, b) => b.weight - a.weight);
}

interface Ctx {
  p: Persisted;
  acct: AccountState;
  mean: number;
  following: Set<string>;
  blocked: Set<string>;
  hidden: Set<string>;
  friendLikes: Map<string, string[]>;
  seen: Map<string, HistoryEntry>;
  now: number;
}

function context(p: Persisted): Ctx {
  const acct = p.accounts[p.activeId];
  const mean = CATEGORY_IDS.reduce((s, c) => s + acct.interests[c], 0) / CATEGORY_IDS.length || 1;
  const friendLikes = new Map<string, string[]>();
  for (const a of friendActivity(p)) {
    if (a.type === 'post') continue;
    const list = friendLikes.get(a.videoId) ?? [];
    if (!list.includes(a.friendId)) list.push(a.friendId);
    friendLikes.set(a.videoId, list);
  }
  return {
    p,
    acct,
    mean,
    following: new Set(acct.following),
    blocked: new Set([...acct.notInterested, ...acct.reported]),
    hidden: new Set(acct.hiddenCreators),
    friendLikes,
    seen: new Map(acct.history.map((h) => [h.videoId, h])),
    now: Date.now(),
  };
}

function eligible(ctx: Ctx, v: Video): boolean {
  return !ctx.blocked.has(v.id) && !ctx.hidden.has(v.creatorId) && canSee(ctx.p, v);
}

function firstName(id: string, p: Persisted): string {
  const acct = p.accounts[id];
  return (acct?.profile.name ?? USER_MAP.get(id)?.name ?? id).split(' ')[0];
}

export function friendsPhrase(p: Persisted, ids: string[], verb = 'Liked'): string {
  if (!ids.length) return '';
  const names = ids.map((id) => firstName(id, p));
  if (names.length === 1) return `${verb} by ${names[0]}`;
  if (names.length === 2) return `${verb} by ${names[0]} and ${names[1]}`;
  return `${verb} by ${names[0]} and ${names.length - 1} friends`;
}

function score(ctx: Ctx, v: Video, nonce: number): { s: number; reason: string } {
  const { acct, mean } = ctx;
  const norm = acct.interests[v.category] / mean;
  const parts: [number, string][] = [];
  const cat = 1.8 * Math.log2(1 + norm);
  parts.push([cat - 1.8, `Because you watch ${categoryLabel(v.category)}`]);
  const also = v.meta.alsoFor.length ? (0.3 * v.meta.alsoFor.reduce((s, c) => s + Math.log2(1 + acct.interests[c] / mean), 0)) / v.meta.alsoFor.length : 0;
  let tag = 0;
  let bestTag = '';
  let bestTagW = 0;
  for (const t of v.hashtags) {
    const w = acct.tagAffinity[t] ?? 0;
    tag += w;
    if (w > bestTagW) {
      bestTagW = w;
      bestTag = t;
    }
  }
  tag = clamp(tag, -2, 2) * 0.6;
  if (bestTag) parts.push([tag, `Because you liked #${bestTag}`]);
  const creator = USER_MAP.get(v.creatorId);
  const follow = ctx.following.has(v.creatorId) ? 1.1 : 0;
  if (follow) parts.push([follow, `From @${creator?.handle ?? v.creatorId}, who you follow`]);
  const friends = ctx.friendLikes.get(v.id);
  const social = friends?.length ? 0.5 + 0.15 * Math.min(3, friends.length) : 0;
  if (friends?.length) parts.push([social, friendsPhrase(ctx.p, friends)]);
  const ageDays = (ctx.now - v.uploadedAt) / DAY;
  const fresh = 0.6 * Math.exp(-ageDays / 7);
  if (fresh > 0.4) parts.push([fresh, `New from @${creator?.handle ?? v.creatorId}`]);
  const pop = 0.25 * (Math.log10(likeCount(ctx.p, v) + 10) / 6) + 0.5 * v.meta.momentum;
  if (v.meta.momentum > 0.6) parts.push([pop, `Trending in ${categoryLabel(v.category)}`]);
  const seen = ctx.seen.get(v.id);
  const seenPenalty = seen ? 1.2 + seen.progress * 1.3 + Math.min(2, seen.completions) * 0.5 : 0;
  const jitter = (hash01(`${nonce}:${ctx.p.activeId}:${v.id}`) - 0.5) * 1.6;
  const s = cat + also + tag + follow + social + fresh + pop + 0.4 * v.meta.quality - seenPenalty + jitter;
  parts.sort((a, b) => b[0] - a[0]);
  let reason = parts[0] && parts[0][0] > 0.05 ? parts[0][1] : '';
  if (!reason) reason = norm < 0.8 ? `Something new: ${categoryLabel(v.category)}` : `Popular in ${categoryLabel(v.category)}`;
  return { s, reason };
}

/** Greedy re-rank so the same creator or category doesn't repeat back to back. */
function diversify<T extends { v: Video }>(list: T[]): T[] {
  const pool = list.slice();
  const out: T[] = [];
  while (pool.length) {
    const last = out[out.length - 1]?.v;
    const prev = out[out.length - 2]?.v;
    let idx = pool.findIndex((x, i) => i < 8 && x.v.creatorId !== last?.creatorId && !(x.v.category === last?.category && x.v.category === prev?.category));
    if (idx < 0) idx = 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function rankForYou(p: Persisted, exclude: Set<string> = new Set()): FeedItem[] {
  const ctx = context(p);
  const nonce = ctx.acct.nonce;
  const scored = allVideos(p)
    .filter((v) => eligible(ctx, v) && v.creatorId !== p.activeId && !exclude.has(v.id))
    .map((v) => ({ v, ...score(ctx, v, nonce) }))
    .sort((a, b) => b.s - a.s);
  return diversify(scored).map((x) => ({ id: x.v.id, reason: x.reason }));
}

export function rankFollowing(p: Persisted): FeedItem[] {
  const ctx = context(p);
  return allVideos(p)
    .filter((v) => ctx.following.has(v.creatorId) && eligible(ctx, v))
    .map((v) => ({ v, seen: ctx.seen.has(v.id) }))
    .sort((a, b) => Number(a.seen) - Number(b.seen) || b.v.uploadedAt - a.v.uploadedAt)
    .map(({ v, seen }) => {
      const u = USER_MAP.get(v.creatorId);
      const fresh = ctx.now - v.uploadedAt < 3 * DAY;
      return { id: v.id, reason: `${fresh && !seen ? 'New from' : 'From'} @${u?.handle ?? v.creatorId}` };
    });
}

export function trendingScore(p: Persisted, v: Video, now = Date.now()): number {
  const hours = (now - v.uploadedAt) / 3_600_000;
  const engagement = likeCount(p, v) + 4 * v.comments + 6 * v.shares + 2 * v.saves;
  return (engagement / Math.pow(hours + 8, 0.55)) * (1 + v.meta.momentum) * (v.category === 'trending' ? 1.25 : 1);
}

export function rankTrending(p: Persisted): FeedItem[] {
  const ctx = context(p);
  return allVideos(p)
    .filter((v) => eligible(ctx, v) && (v.visibility ?? 'public') === 'public')
    .map((v) => ({ v, s: trendingScore(p, v, ctx.now) }))
    .sort((a, b) => b.s - a.s)
    .map((x, i) => ({ id: x.v.id, reason: `#${i + 1} on Trending · ${categoryLabel(x.v.category)}` }));
}

export function rankFriends(p: Persisted): FeedItem[] {
  const ctx = context(p);
  const acts = friendActivity(p);
  const byVideo = new Map<string, { likes: string[]; shares: string[]; posts: string[]; at: number }>();
  for (const a of acts) {
    const e = byVideo.get(a.videoId) ?? { likes: [], shares: [], posts: [], at: 0 };
    const list = a.type === 'like' ? e.likes : a.type === 'share' ? e.shares : e.posts;
    if (!list.includes(a.friendId)) list.push(a.friendId);
    e.at = Math.max(e.at, a.at);
    byVideo.set(a.videoId, e);
  }
  const out: FeedItem[] = [];
  const sorted = [...byVideo.entries()].sort((a, b) => b[1].at + b[1].likes.length * 3_600_000 - (a[1].at + a[1].likes.length * 3_600_000));
  for (const [id, e] of sorted) {
    const v = getVideo(p, id);
    if (!v || !eligible(ctx, v) || v.creatorId === p.activeId) continue;
    const reason = e.posts.length ? `Posted by ${firstName(e.posts[0], p)}` : e.shares.length ? friendsPhrase(p, e.shares, 'Shared') : friendsPhrase(p, e.likes);
    out.push({ id, reason });
  }
  return out;
}

export function applyFilters(p: Persisted, items: FeedItem[], category: Category | 'all', sort: SortKey): FeedItem[] {
  let list = items;
  if (category !== 'all') list = list.filter((it) => getVideo(p, it.id)?.category === category);
  if (sort === 'recommended') return list;
  const val = (it: FeedItem): number => {
    const v = getVideo(p, it.id)!;
    if (sort === 'newest') return -v.uploadedAt;
    if (sort === 'liked') return -likeCount(p, v);
    if (sort === 'viewed') return -v.views;
    return v.duration;
  };
  return list.slice().sort((a, b) => val(a) - val(b));
}

/** Videos like this one: same topic, shared hashtags, same creator. */
export function relatedTo(p: Persisted, v: Video, n = 8, exclude: Set<string> = new Set()): Video[] {
  const acct = p.accounts[p.activeId];
  const hidden = new Set(acct.hiddenCreators);
  const blocked = new Set(acct.notInterested);
  const tags = new Set(v.hashtags);
  return allVideos(p)
    .filter((x) => x.id !== v.id && !exclude.has(x.id) && !hidden.has(x.creatorId) && !blocked.has(x.id) && canSee(p, x))
    .map((x) => {
      let s = 0;
      if (x.category === v.category) s += 2;
      if (x.creatorId === v.creatorId) s += 1.2;
      for (const t of x.hashtags) if (tags.has(t)) s += 1;
      for (const c of x.meta.alsoFor) if (c === v.category) s += 0.4;
      s += hash01(`${v.id}:${x.id}`) * 0.8 + x.meta.quality * 0.3;
      return { x, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((r) => r.x);
}

/** Creators the active account doesn't follow yet, best matches first. */
export function recommendedCreators(p: Persisted, n = 5, focus?: Category): string[] {
  const acct = p.accounts[p.activeId];
  const following = new Set(acct.following);
  const hidden = new Set(acct.hiddenCreators);
  return [...USER_MAP.values()]
    .filter((u) => u.kind === 'creator' && !following.has(u.id) && !hidden.has(u.id))
    .map((u) => {
      let s = u.categories.reduce((sum, c, i) => sum + acct.interests[c] * (i === 0 ? 1 : 0.4), 0);
      if (focus && u.categories.includes(focus)) s += 3;
      s += Math.log10(u.followers) * 0.15 + hash01(`${p.activeId}:${u.id}:${acct.nonce}`) * 0.5;
      return { id: u.id, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.id);
}

export function trendingHashtags(p: Persisted, n = 10): { tag: string; count: number; views: number }[] {
  const map = new Map<string, { count: number; views: number; heat: number }>();
  const now = Date.now();
  for (const v of allVideos(p)) {
    if (!canSee(p, v)) continue;
    const heat = trendingScore(p, v, now);
    for (const t of v.hashtags) {
      const e = map.get(t) ?? { count: 0, views: 0, heat: 0 };
      e.count++;
      e.views += v.views;
      e.heat += heat;
      map.set(t, e);
    }
  }
  return [...map.entries()]
    .filter(([, e]) => e.count >= 2)
    .sort((a, b) => b[1].heat - a[1].heat)
    .slice(0, n)
    .map(([tag, e]) => ({ tag, count: e.count, views: e.views }));
}

export function friendsOf(id: string): string[] {
  return FRIENDS_OF[id] ?? [];
}
