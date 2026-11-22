// Read-side helpers over the videos the app can show: the real catalog, or (in demo mode, or when the
// catalog can't be reached) the seeded demo clips. Like and comment counts for real videos come from
// Warden Chat's database (lib/social.ts); demo clips keep their made-up numbers.
import type { Comment, Persisted, User, Video } from '../state/types';
import { SEED_VIDEOS, SEED_VIDEO_MAP } from '../data/videos';
import { HANDLE_MAP, USER_MAP } from '../data/users';
import { seedComments } from '../data/comments';
import { catalogSnapshot, catalogVersion, catalogVideos } from './remoteCatalog';
import { socialFor } from './social';

let lastAll: Video[] = SEED_VIDEOS;
let lastMap = SEED_VIDEO_MAP;
let lastMode: VideoMode = 'demo';
let lastVersion = -1;

export type VideoMode = 'catalog' | 'demo';

/**
 * Real videos when the catalog is switched on and is loading or has videos. Demo clips when it's off,
 * can't be reached, or has nothing to show (so the app is never empty by accident).
 */
export function videoMode(p: Persisted): VideoMode {
  if (p.settings.videoSource !== 'catalog') return 'demo';
  const st = catalogSnapshot().status;
  return st === 'loading' || st === 'ready' ? 'catalog' : 'demo';
}

function refresh(p: Persisted) {
  const mode = videoMode(p);
  const version = catalogVersion();
  if (mode === lastMode && (mode === 'demo' || version === lastVersion)) return;
  lastMode = mode;
  lastVersion = version;
  lastAll = mode === 'catalog' ? catalogVideos() ?? [] : SEED_VIDEOS;
  lastMap = new Map(lastAll.map((v) => [v.id, v]));
}

export function allVideos(p: Persisted): Video[] {
  refresh(p);
  return lastAll;
}

export function getVideo(p: Persisted, id: string): Video | undefined {
  refresh(p);
  return lastMap.get(id);
}

export function visibleVideos(p: Persisted): Video[] {
  return allVideos(p);
}

export function getUser(_p: Persisted, id: string): User | undefined {
  return USER_MAP.get(id);
}

export function userByHandle(p: Persisted, handle: string): User | undefined {
  const u = HANDLE_MAP.get(handle.replace(/^@/, '').toLowerCase());
  return u ? getUser(p, u.id) : undefined;
}

export function viewCount(_p: Persisted, v: Video): number {
  return v.views;
}

/** Likes: the real count for open videos; a demo clip's made-up count (plus yours). */
export function likeCount(p: Persisted, v: Video): number {
  const s = socialFor(v.id);
  if (s && s !== 'closed') return s.likes;
  return v.likes + (p.accounts[p.activeId].liked.includes(v.id) && !v.source ? 1 : 0);
}

export function commentCount(_p: Persisted, v: Video): number {
  const s = socialFor(v.id);
  if (s && s !== 'closed') return s.comments;
  return v.comments;
}

/** Saves stay in each browser, so this is the made-up base (0 for real videos) plus yours. */
export function saveCount(p: Persisted, v: Video): number {
  return v.saves + (p.accounts[p.activeId].saved.includes(v.id) ? 1 : 0);
}

export function followerCount(p: Persisted, u: User): number {
  return u.followers + (p.accounts[p.activeId].following.includes(u.id) ? 1 : 0);
}

export function followingCount(p: Persisted, u: User): number {
  return u.id === p.activeId ? p.accounts[p.activeId].following.length : u.following;
}

export function totalLikes(_p: Persisted, u: User): number {
  return u.likes;
}

export function videosBy(p: Persisted, userId: string): Video[] {
  return allVideos(p)
    .filter((v) => v.creatorId === userId)
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

/** Sample comments on a demo clip (read-only). Real videos have real comments (lib/social.ts). */
export function sampleComments(v: Video): Comment[] {
  return v.source ? [] : seedComments(v);
}
