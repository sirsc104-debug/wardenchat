// Read-side helpers over the seeded catalog plus everything created on this device.
// When a backend arrives, these are the functions to point at an API.
import type { Comment, Persisted, User, Video } from '../state/types';
import { SEED_VIDEOS, SEED_VIDEO_MAP } from '../data/videos';
import { DEMO_IDS, FRIENDS_OF, HANDLE_MAP, USER_MAP } from '../data/users';
import { seedComments } from '../data/comments';
import { lurkerLikeTime, lurkerLikes } from '../data/seeds';

let lastUser: Video[] | null = null;
let lastAll: Video[] = SEED_VIDEOS;
let lastMap = SEED_VIDEO_MAP;

function refresh(p: Persisted) {
  if (p.userVideos === lastUser) return;
  lastUser = p.userVideos;
  lastAll = [...p.userVideos, ...SEED_VIDEOS];
  lastMap = new Map(lastAll.map((v) => [v.id, v]));
}

/** Every video, newest local uploads first. */
export function allVideos(p: Persisted): Video[] {
  refresh(p);
  return lastAll;
}

export function getVideo(p: Persisted, id: string): Video | undefined {
  refresh(p);
  return lastMap.get(id);
}

/** Can the active account see this video (private / friends-only local uploads)? */
export function canSee(p: Persisted, v: Video, viewer = p.activeId): boolean {
  if (!v.local || v.visibility === 'public' || !v.visibility) return true;
  if (v.creatorId === viewer) return true;
  if (v.visibility === 'friends') return (FRIENDS_OF[v.creatorId] ?? []).includes(viewer);
  return false;
}

export function visibleVideos(p: Persisted): Video[] {
  return allVideos(p).filter((v) => canSee(p, v));
}

export function getUser(p: Persisted, id: string): User | undefined {
  const u = USER_MAP.get(id);
  if (!u) return undefined;
  const acct = p.accounts[id];
  if (!acct) return u;
  // Demo accounts show their edited profile.
  return { ...u, name: acct.profile.name, bio: acct.profile.bio, avatar: acct.profile.avatar };
}

export function userByHandle(p: Persisted, handle: string): User | undefined {
  const u = HANDLE_MAP.get(handle.replace(/^@/, '').toLowerCase());
  return u ? getUser(p, u.id) : undefined;
}

/** Local uploads gain their (simulated) audience over the first hour or so. */
export function growth(v: Video, now = Date.now()): number {
  if (!v.local) return 1;
  return 1 - Math.exp(-Math.max(0, now - v.uploadedAt) / 1_200_000);
}

export function viewCount(_p: Persisted, v: Video): number {
  return Math.round(v.views * growth(v));
}

function demoCount(p: Persisted, test: (id: string) => boolean): number {
  let n = 0;
  for (const id of DEMO_IDS) if (p.accounts[id] && test(id)) n++;
  return n;
}

export function likeCount(p: Persisted, v: Video): number {
  return Math.round(v.likes * growth(v)) + demoCount(p, (id) => p.accounts[id].liked.includes(v.id));
}

export function saveCount(p: Persisted, v: Video): number {
  return Math.round(v.saves * growth(v)) + demoCount(p, (id) => p.accounts[id].saved.includes(v.id));
}

export function shareCount(p: Persisted, v: Video): number {
  let n = Math.round(v.shares * growth(v));
  for (const id of DEMO_IDS) n += p.accounts[id]?.shares.filter((s) => s.videoId === v.id).length ?? 0;
  return n;
}

export function commentCount(p: Persisted, v: Video): number {
  return Math.round(v.comments * growth(v)) + p.userComments.filter((c) => c.videoId === v.id).length;
}

export function followerCount(p: Persisted, u: User): number {
  return u.followers + demoCount(p, (id) => id !== u.id && p.accounts[id].following.includes(u.id));
}

export function followingCount(p: Persisted, u: User): number {
  return p.accounts[u.id] ? p.accounts[u.id].following.length + Math.max(0, u.following - 10) : u.following;
}

export function totalLikes(p: Persisted, u: User): number {
  const own = allVideos(p).filter((v) => v.creatorId === u.id);
  const extra = own.reduce((s, v) => s + likeCount(p, v) - Math.round(v.likes * growth(v)), 0);
  const local = own.filter((v) => v.local).reduce((s, v) => s + Math.round(v.likes * growth(v)), 0);
  return u.likes + extra + local;
}

export function videosBy(p: Persisted, userId: string): Video[] {
  return allVideos(p)
    .filter((v) => v.creatorId === userId && canSee(p, v))
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

/** Top-level comments and replies for a video, seeded plus local. */
export function commentsFor(p: Persisted, v: Video): Comment[] {
  const local = p.userComments.filter((c) => c.videoId === v.id);
  return local.length ? [...seedComments(v), ...local] : seedComments(v);
}

export function commentLikes(p: Persisted, c: Comment): number {
  return c.likes + demoCount(p, (id) => p.accounts[id].likedComments.includes(c.id));
}

export interface FriendAct {
  friendId: string;
  videoId: string;
  type: 'like' | 'share' | 'post';
  at: number;
}

/** What the active account's friends have liked, shared or posted, newest first. */
export function friendActivity(p: Persisted, accountId = p.activeId): FriendAct[] {
  const out: FriendAct[] = [];
  for (const f of FRIENDS_OF[accountId] ?? []) {
    const acct = p.accounts[f];
    if (acct) {
      // Demo friends: real activity on this device, plus their seeded likes.
      const recentActs = acct.activity.filter((a) => a.videoId && (a.type === 'like' || a.type === 'share'));
      const seen = new Set<string>();
      for (const a of recentActs) {
        if (seen.has(a.videoId!)) continue;
        if (a.type === 'like' && !acct.liked.includes(a.videoId!)) continue;
        seen.add(a.videoId!);
        out.push({ friendId: f, videoId: a.videoId!, type: a.type as 'like' | 'share', at: a.at });
      }
      acct.liked.slice(0, 14).forEach((vid, i) => {
        if (!seen.has(vid)) out.push({ friendId: f, videoId: vid, type: 'like', at: lurkerLikeTime(f, vid) - i * 600_000 });
      });
    } else {
      lurkerLikes(f).forEach((vid, i) => out.push({ friendId: f, videoId: vid, type: i % 6 === 2 ? 'share' : 'like', at: lurkerLikeTime(f, vid) }));
    }
    for (const v of allVideos(p)) {
      if (v.creatorId === f && canSee(p, v, accountId)) out.push({ friendId: f, videoId: v.id, type: 'post', at: v.uploadedAt });
    }
  }
  return out.filter((a) => {
    const v = getVideo(p, a.videoId);
    return v && canSee(p, v, accountId);
  }).sort((a, b) => b.at - a.at);
}

export function shareLink(videoId: string): string {
  const base = typeof location !== 'undefined' && location.protocol.startsWith('http') ? location.origin + location.pathname : 'https://scroll.sirsc.app/';
  return `${base}#/video/${videoId}`;
}
