// Likes, comments and notifications, kept in Warden Chat's database (scroll_* functions) and cached here.
// Only approved catalog videos are "open": the server leaves everything else out of scroll_social_counts,
// and the app shows their numbers read-only (demo clips keep their made-up counts and sample comments).
import { useEffect, useSyncExternalStore } from 'react';
import { ApiError, refreshStanding, rpc } from './warden';
import { YT_PREFIX } from './videoSource';
import { SEED_VIDEO_MAP } from '../data/videos';

/* ---------------------------------------------------------------- types */

export interface VideoSocial {
  likes: number;
  comments: number;
  liked: boolean;
}

export interface RemoteComment {
  id: number;
  videoId: string;
  /** The top-level comment for a reply. */
  parentId: number | null;
  author: { id: string; username: string };
  /** A reply to a reply: whose reply it answers. */
  replyTo: string | null;
  body: string;
  at: number;
  likes: number;
  liked: boolean;
  /** Top-level comments: how many replies. */
  replies: number;
  mine: boolean;
}

interface CommentRow {
  id: number;
  video_id: string;
  parent_id: number | null;
  author: { id: string; username: string };
  reply_to: string | null;
  body: string;
  created_at: string;
  likes: number;
  liked: boolean;
  replies: number;
  mine: boolean;
}

export type CommentSort = 'top' | 'new';

export interface ThreadState {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'closed';
  items: RemoteComment[];
  /** Every visible comment on the video, replies included. */
  total: number;
  /** Top-level comments. */
  topLevel: number;
  error: string | null;
  loadingMore: boolean;
}

export interface RepliesState {
  status: 'loading' | 'ready' | 'error';
  items: RemoteComment[];
}

export interface Notice {
  kind: 'reply' | 'mention' | 'comment_like';
  at: number;
  actor: { id: string; username: string };
  /** App video id. */
  videoId: string;
  commentId: number;
  threadId: number;
  text: string;
}

export interface NoticesState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: Notice[];
  /** Notices newer than this are unread (ms). */
  seenAt: number;
  loadedAt: number;
}

/* ---------------------------------------------------------------- store */

let version = 0;
const listeners = new Set<() => void>();
function changed() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Re-render when anything social changes. */
export function useSocialVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

const counts = new Map<string, VideoSocial>();
const closed = new Set<string>();
const askedAt = new Map<string, number>();
const threads = new Map<string, ThreadState>();
const replies = new Map<number, RepliesState>();
let notices: NoticesState = { status: 'idle', items: [], seenAt: 0, loadedAt: 0 };

/** Server video id ("abc123") for an app id ("yt-abc123"); demo clip ids pass through unchanged. */
function serverId(appId: string): string {
  return appId.startsWith(YT_PREFIX) ? appId.slice(YT_PREFIX.length) : appId;
}
function appId(serverVideoId: string, like: string): string {
  return like.startsWith(YT_PREFIX) ? YT_PREFIX + serverVideoId : serverVideoId;
}
/** App id for a server video id when there's nothing to go by (the demo build also opens demo clips). */
function fromServer(serverVideoId: string): string {
  return SEED_VIDEO_MAP.has(serverVideoId) ? serverVideoId : YT_PREFIX + serverVideoId;
}

/** Forget everything (sign-out, or someone else signed in). */
export function resetSocial() {
  counts.clear();
  closed.clear();
  askedAt.clear();
  threads.clear();
  replies.clear();
  pending.clear();
  notices = { status: 'idle', items: [], seenAt: 0, loadedAt: 0 };
  changed();
}

/** Errors the screens explain, as one line. */
export function socialErrorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'error';
  switch (code) {
    case 'offline':
      return 'Couldn’t reach Warden Chat. Check your connection and try again.';
    case 'rate_limited':
    case 'scroll_rate_limited':
      return 'You’re going a bit fast. Wait a minute and try again.';
    case 'scroll_banned':
      return 'Your account can’t like or comment on SirSC Scroll right now.';
    case 'scroll_muted':
      return 'A Warden Chat admin muted your account, so you can’t comment right now.';
    case 'scroll_blocked':
      return 'You can’t reply to someone you’ve blocked, or who blocked you, on Warden Chat.';
    case 'scroll_comment_gone':
      return 'That comment isn’t there anymore.';
    case 'scroll_video_unavailable':
      return 'Likes and comments are open on approved videos only.';
    case 'scroll_duplicate':
      return 'You just posted that.';
    case 'scroll_comment_empty':
      return 'Write something first.';
    case 'scroll_comment_too_long':
      return 'Comments can be up to 300 characters.';
    case 'unauthorized':
      return 'Sign in again to keep going.';
    case 'not_deployed':
      return 'Likes and comments aren’t switched on yet.';
    default:
      return 'Something went wrong. Try again.';
  }
}

function afterError(e: unknown) {
  if (e instanceof ApiError && (e.code === 'scroll_banned' || e.code === 'scroll_muted')) void refreshStanding();
}

/* ---------------------------------------------------------------- counts */

const pending = new Set<string>();
let flushTimer: number | undefined;
const FRESH_MS = 60_000;

/** Ask for counts for these videos (batched; skipped when fetched in the last minute). */
export function requestCounts(ids: string[]) {
  const t = Date.now();
  for (const id of ids) {
    if (!id || pending.has(id)) continue;
    const at = askedAt.get(id);
    if (at && t - at < FRESH_MS) continue;
    pending.add(id);
  }
  if (!pending.size) return;
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(flushCounts, 40);
}

interface CountRow {
  video_id: string;
  likes: number;
  comments: number;
  liked: boolean;
}

/** Liked state the server reported, so the account's local "liked" list can follow along. */
let likedSync: ((liked: Map<string, boolean>) => void) | null = null;
export function onLikedFromServer(fn: (liked: Map<string, boolean>) => void) {
  likedSync = fn;
}

async function flushCounts() {
  const ids = [...pending].slice(0, 200);
  ids.forEach((id) => pending.delete(id));
  const t = Date.now();
  ids.forEach((id) => askedAt.set(id, t));
  try {
    const rows = await rpc<CountRow[]>('scroll_social_counts', { p_ids: ids.map(serverId) });
    const open = new Map(rows.map((r) => [r.video_id, r]));
    const liked = new Map<string, boolean>();
    for (const id of ids) {
      const r = open.get(serverId(id));
      if (r) {
        counts.set(id, { likes: Number(r.likes) || 0, comments: Number(r.comments) || 0, liked: !!r.liked });
        closed.delete(id);
        liked.set(id, !!r.liked);
      } else {
        counts.delete(id);
        closed.add(id);
      }
    }
    likedSync?.(liked);
    changed();
  } catch {
    ids.forEach((id) => askedAt.delete(id)); // try again next time
  }
  if (pending.size) flushTimer = window.setTimeout(flushCounts, 40);
}

/** Server counts for a video, 'closed' if it isn't open for likes and comments, null until known. */
export function socialFor(videoId: string): VideoSocial | 'closed' | null {
  if (closed.has(videoId)) return 'closed';
  return counts.get(videoId) ?? null;
}

/** Subscribe to one video's counts, asking for them if needed. */
export function useVideoSocial(videoId: string | undefined): VideoSocial | 'closed' | null {
  useSocialVersion();
  useEffect(() => {
    if (videoId) requestCounts([videoId]);
  }, [videoId]);
  return videoId ? socialFor(videoId) : null;
}

/** Like or unlike. Updates the count at once and undoes it if the server says no. */
export async function setVideoLiked(videoId: string, liked: boolean): Promise<void> {
  const before = counts.get(videoId);
  if (before) counts.set(videoId, { ...before, liked, likes: Math.max(0, before.likes + (liked === before.liked ? 0 : liked ? 1 : -1)) });
  changed();
  try {
    const r = await rpc<{ liked: boolean; likes: number }>('scroll_like_set', { p_video: serverId(videoId), p_liked: liked });
    const cur = counts.get(videoId) ?? { likes: 0, comments: 0, liked };
    counts.set(videoId, { ...cur, liked: r.liked, likes: Number(r.likes) || 0 });
    changed();
  } catch (e) {
    if (before) counts.set(videoId, before);
    if (e instanceof ApiError && e.code === 'scroll_video_unavailable') {
      counts.delete(videoId);
      closed.add(videoId);
    }
    changed();
    afterError(e);
    throw e;
  }
}

/** The videos this account liked (newest first), as app ids. */
export async function fetchMyLikes(): Promise<string[]> {
  const r = await rpc<{ items: { video_id: string }[] }>('scroll_my_likes', { p_limit: 1000 });
  return r.items.map((x) => fromServer(x.video_id));
}

function bumpCount(videoId: string, delta: number) {
  const c = counts.get(videoId);
  if (c) counts.set(videoId, { ...c, comments: Math.max(0, c.comments + delta) });
}

/* ---------------------------------------------------------------- comments */

function toComment(r: CommentRow, like: string): RemoteComment {
  return {
    id: Number(r.id),
    videoId: appId(r.video_id, like),
    parentId: r.parent_id == null ? null : Number(r.parent_id),
    author: r.author,
    replyTo: r.reply_to ?? null,
    body: r.body,
    at: Date.parse(r.created_at) || Date.now(),
    likes: Number(r.likes) || 0,
    liked: !!r.liked,
    replies: Number(r.replies) || 0,
    mine: !!r.mine,
  };
}

const PAGE = 30;
const threadKey = (videoId: string, sort: CommentSort) => `${videoId}|${sort}`;
const EMPTY_THREAD: ThreadState = { status: 'idle', items: [], total: 0, topLevel: 0, error: null, loadingMore: false };

export function threadFor(videoId: string, sort: CommentSort): ThreadState {
  if (closed.has(videoId)) return { ...EMPTY_THREAD, status: 'closed' };
  return threads.get(threadKey(videoId, sort)) ?? EMPTY_THREAD;
}

/** Load (or reload) the first page of comments. */
export async function loadThread(videoId: string, sort: CommentSort, more = false): Promise<void> {
  const key = threadKey(videoId, sort);
  const cur = threads.get(key);
  if (more && (!cur || cur.status !== 'ready' || cur.loadingMore || cur.items.length >= cur.topLevel)) return;
  if (!more && cur?.status === 'loading') return;
  threads.set(key, more ? { ...cur!, loadingMore: true } : { ...(cur ?? EMPTY_THREAD), status: cur?.status === 'ready' ? 'ready' : 'loading', error: null });
  changed();
  try {
    const r = await rpc<{ items: CommentRow[]; total: number; top_level: number }>('scroll_comments_list', {
      p_video: serverId(videoId),
      p_sort: sort,
      p_offset: more ? cur!.items.length : 0,
      p_limit: PAGE,
    });
    const items = r.items.map((x) => toComment(x, videoId));
    const prev = threads.get(key);
    const merged = more && prev ? [...prev.items, ...items.filter((c) => !prev.items.some((p) => p.id === c.id))] : items;
    threads.set(key, { status: 'ready', items: merged, total: Number(r.total) || 0, topLevel: Number(r.top_level) || 0, error: null, loadingMore: false });
    const c = counts.get(videoId);
    if (c) counts.set(videoId, { ...c, comments: Number(r.total) || 0 });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'scroll_video_unavailable') {
      closed.add(videoId);
      counts.delete(videoId);
      threads.delete(key);
    } else {
      const prev = threads.get(key) ?? EMPTY_THREAD;
      threads.set(key, more ? { ...prev, loadingMore: false } : { ...prev, status: prev.items.length ? 'ready' : 'error', error: socialErrorText(e), loadingMore: false });
    }
  }
  changed();
}

/** Comments on a video: loads the first page when first needed, and again after a minute away. */
export function useThread(videoId: string, sort: CommentSort, enabled = true): ThreadState {
  useSocialVersion();
  useEffect(() => {
    if (!enabled) return;
    requestCounts([videoId]);
    const t = threads.get(threadKey(videoId, sort));
    if (!t || t.status === 'error' || (t.status === 'ready' && Date.now() - (loadedAt.get(threadKey(videoId, sort)) ?? 0) > FRESH_MS)) {
      loadedAt.set(threadKey(videoId, sort), Date.now());
      void loadThread(videoId, sort);
    }
  }, [videoId, sort, enabled]);
  return threadFor(videoId, sort);
}
const loadedAt = new Map<string, number>();

export function repliesFor(parentId: number): RepliesState | undefined {
  return replies.get(parentId);
}

export async function loadReplies(parentId: number, videoId: string): Promise<void> {
  if (replies.get(parentId)?.status === 'loading') return;
  replies.set(parentId, { status: 'loading', items: replies.get(parentId)?.items ?? [] });
  changed();
  try {
    const r = await rpc<{ items: CommentRow[] }>('scroll_comment_replies', { p_parent: parentId, p_limit: 100 });
    replies.set(parentId, { status: 'ready', items: r.items.map((x) => toComment(x, videoId)) });
  } catch (e) {
    replies.set(parentId, { status: 'error', items: replies.get(parentId)?.items ?? [] });
    if (e instanceof ApiError && e.code === 'scroll_comment_gone') dropFromThreads(parentId, videoId);
  }
  changed();
}

/** Every cached copy of a comment (both sort orders and reply lists). */
function patchComment(id: number, fn: (c: RemoteComment) => RemoteComment) {
  for (const [k, t] of threads) if (t.items.some((c) => c.id === id)) threads.set(k, { ...t, items: t.items.map((c) => (c.id === id ? fn(c) : c)) });
  for (const [k, r] of replies) if (r.items.some((c) => c.id === id)) replies.set(k, { ...r, items: r.items.map((c) => (c.id === id ? fn(c) : c)) });
}

function dropFromThreads(id: number, videoId: string) {
  let removed = 0;
  for (const [k, t] of threads) {
    const hit = t.items.find((c) => c.id === id);
    if (hit) {
      removed = 1 + hit.replies;
      threads.set(k, { ...t, items: t.items.filter((c) => c.id !== id), topLevel: Math.max(0, t.topLevel - 1), total: Math.max(0, t.total - removed) });
    }
  }
  for (const [k, r] of replies) {
    if (r.items.some((c) => c.id === id)) {
      removed = Math.max(removed, 1);
      replies.set(k, { ...r, items: r.items.filter((c) => c.id !== id) });
      for (const [tk, t] of threads) {
        if (t.items.some((c) => c.id === k)) threads.set(tk, { ...t, total: Math.max(0, t.total - 1), items: t.items.map((c) => (c.id === k ? { ...c, replies: Math.max(0, c.replies - 1) } : c)) });
      }
    }
  }
  replies.delete(id);
  bumpCount(videoId, -removed);
}

/** Post a comment, or reply to one (any comment in a thread; the reply joins that thread). */
export async function postComment(videoId: string, text: string, replyTo?: RemoteComment | null): Promise<RemoteComment> {
  try {
    const r = await rpc<CommentRow>('scroll_comment_post', { p_video: serverId(videoId), p_body: text, p_parent: replyTo?.id ?? null });
    const c = toComment(r, videoId);
    if (c.parentId == null) {
      for (const sort of ['top', 'new'] as CommentSort[]) {
        const key = threadKey(videoId, sort);
        const t = threads.get(key);
        if (t) threads.set(key, { ...t, items: [c, ...t.items], topLevel: t.topLevel + 1, total: t.total + 1 });
      }
    } else {
      const rep = replies.get(c.parentId);
      replies.set(c.parentId, { status: rep?.status === 'ready' ? 'ready' : 'ready', items: [...(rep?.items ?? []), c] });
      for (const [k, t] of threads) {
        if (t.items.some((x) => x.id === c.parentId)) threads.set(k, { ...t, total: t.total + 1, items: t.items.map((x) => (x.id === c.parentId ? { ...x, replies: x.replies + 1 } : x)) });
      }
    }
    bumpCount(videoId, 1);
    changed();
    return c;
  } catch (e) {
    afterError(e);
    if (e instanceof ApiError && e.code === 'scroll_comment_gone' && replyTo) {
      dropFromThreads(replyTo.id, videoId);
      changed();
    }
    throw e;
  }
}

export async function deleteComment(c: RemoteComment): Promise<void> {
  const ok = await rpc<boolean>('scroll_comment_delete', { p_id: c.id });
  if (ok !== false) {
    dropFromThreads(c.id, c.videoId);
    changed();
  }
}

export async function setCommentLiked(c: RemoteComment, liked: boolean): Promise<void> {
  patchComment(c.id, (x) => ({ ...x, liked, likes: Math.max(0, x.likes + (liked === x.liked ? 0 : liked ? 1 : -1)) }));
  changed();
  try {
    const r = await rpc<{ liked: boolean; likes: number }>('scroll_comment_like_set', { p_id: c.id, p_liked: liked });
    patchComment(c.id, (x) => ({ ...x, liked: r.liked, likes: Number(r.likes) || 0 }));
    changed();
  } catch (e) {
    patchComment(c.id, (x) => ({ ...x, liked: c.liked, likes: c.likes }));
    if (e instanceof ApiError && e.code === 'scroll_comment_gone') dropFromThreads(c.id, c.videoId);
    changed();
    afterError(e);
    throw e;
  }
}

export type ReportReason = 'bullying' | 'hate' | 'inappropriate' | 'spam' | 'other';

export async function reportComment(commentId: number, reason: ReportReason): Promise<void> {
  await rpc<boolean>('scroll_comment_report', { p_id: commentId, p_reason: reason });
}

/* ---------------------------------------------------------------- notifications */

interface NoticeRow {
  kind: Notice['kind'];
  at: string;
  actor: { id: string; username: string };
  video_id: string;
  comment_id: number;
  thread_id: number;
  text: string;
}

export function noticesSnapshot(): NoticesState {
  return notices;
}

export async function loadNotices(): Promise<void> {
  if (notices.status === 'loading') return;
  notices = { ...notices, status: notices.status === 'ready' ? 'ready' : 'loading' };
  changed();
  try {
    const r = await rpc<{ seen_at: string | null; items: NoticeRow[] }>('scroll_notifications', { p_limit: 60 });
    notices = {
      status: 'ready',
      seenAt: r.seen_at ? Date.parse(r.seen_at) : 0,
      loadedAt: Date.now(),
      items: r.items.map((n) => ({
        kind: n.kind,
        at: Date.parse(n.at) || 0,
        actor: n.actor,
        videoId: fromServer(n.video_id),
        commentId: Number(n.comment_id),
        threadId: Number(n.thread_id),
        text: n.text,
      })),
    };
  } catch {
    notices = { ...notices, status: notices.items.length ? 'ready' : 'error' };
  }
  changed();
}

export function unreadNotices(): number {
  return notices.items.filter((n) => n.at > notices.seenAt).length;
}

/** Mark everything loaded so far as seen. */
export async function markNoticesSeen(): Promise<void> {
  const newest = notices.items.reduce((m, n) => Math.max(m, n.at), 0);
  if (!newest || newest <= notices.seenAt) return;
  notices = { ...notices, seenAt: newest };
  changed();
  try {
    await rpc('scroll_notifications_seen', { p_at: new Date(newest).toISOString() });
  } catch {
    /* it'll be marked next time */
  }
}

/** Keep the unread badge current: now, then every two minutes while the page is visible. */
export function startNoticePolling(): () => void {
  void loadNotices();
  const id = window.setInterval(() => {
    if (document.visibilityState === 'visible') void loadNotices();
  }, 120_000);
  const onVis = () => {
    if (document.visibilityState === 'visible' && Date.now() - notices.loadedAt > 60_000) void loadNotices();
  };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onVis);
  };
}

/** How many notifications haven't been seen (re-renders when that changes). */
export function useUnreadNotices(): number {
  useSocialVersion();
  return unreadNotices();
}
