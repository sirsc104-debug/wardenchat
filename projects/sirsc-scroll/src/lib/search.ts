// Local search over the mock dataset: videos, creators and hashtags.
import type { Persisted, User, Video } from '../state/types';
import { USERS } from '../data/users';
import { CATEGORIES } from '../data/categories';
import { allVideos, canSee, getUser, likeCount } from './catalog';

export interface TagHit {
  tag: string;
  count: number;
  views: number;
}

export interface SearchResults {
  query: string;
  videos: Video[];
  creators: User[];
  tags: TagHit[];
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function tokens(q: string): string[] {
  return norm(q)
    .split(/[^a-z0-9#@$]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function fieldScore(text: string, toks: string[], weight: number): number {
  const t = norm(text);
  let s = 0;
  for (const tok of toks) {
    const bare = tok.replace(/^[#@]/, '');
    if (!bare) continue;
    if (t === bare) s += weight * 3;
    else if (new RegExp(`(^|[^a-z0-9])${bare.replace(/[$]/g, '\\$')}`).test(t)) s += weight * 1.6;
    else if (bare.length > 2 && t.includes(bare)) s += weight * 0.8;
  }
  return s;
}

export function allTags(p: Persisted): TagHit[] {
  const map = new Map<string, TagHit>();
  for (const v of allVideos(p)) {
    if (!canSee(p, v)) continue;
    for (const tag of v.hashtags) {
      const e = map.get(tag) ?? { tag, count: 0, views: 0 };
      e.count++;
      e.views += v.views;
      map.set(tag, e);
    }
  }
  return [...map.values()].sort((a, b) => b.views - a.views);
}

export function search(p: Persisted, query: string): SearchResults {
  const q = query.trim();
  const toks = tokens(q);
  if (!toks.length) return { query: q, videos: [], creators: [], tags: [] };
  const hidden = new Set(p.accounts[p.activeId].hiddenCreators);
  const onlyTag = q.startsWith('#');
  const onlyUser = q.startsWith('@');

  const users = USERS.filter((u) => u.kind !== 'friend' || p.accounts[u.id]).map((u) => getUser(p, u.id)!);
  const creators = onlyTag
    ? []
    : users
        .map((u) => ({ u, s: fieldScore(u.handle, toks, 4) + fieldScore(u.name, toks, 3) + fieldScore(u.bio, toks, 0.6) + u.categories.reduce((a, c) => a + fieldScore(c, toks, 0.8), 0) }))
        .filter((x) => x.s > 0 && !hidden.has(x.u.id))
        .sort((a, b) => b.s - a.s || b.u.followers - a.u.followers)
        .slice(0, 12)
        .map((x) => x.u);

  const tags = onlyUser
    ? []
    : allTags(p)
        .map((t) => ({ t, s: fieldScore(t.tag, toks, 3) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.t.views - a.t.views)
        .slice(0, 12)
        .map((x) => x.t);

  const catMatch = CATEGORIES.filter((c) => toks.some((t) => norm(c.label).startsWith(t.replace(/^#/, '')) && t.length > 2)).map((c) => c.id);
  const videos = allVideos(p)
    .filter((v) => canSee(p, v) && !hidden.has(v.creatorId))
    .map((v) => {
      const creator = users.find((u) => u.id === v.creatorId);
      let s = onlyUser
        ? fieldScore(creator?.handle ?? '', toks, 4)
        : fieldScore(v.title, toks, 3) + v.hashtags.reduce((a, t) => a + fieldScore(t, toks, onlyTag ? 4 : 2), 0) + (onlyTag ? 0 : fieldScore(v.description, toks, 0.7) + fieldScore(v.caption, toks, 1) + fieldScore(creator?.handle ?? '', toks, 1.5) + fieldScore(creator?.name ?? '', toks, 1.2) + fieldScore(v.sound, toks, 0.6));
      if (catMatch.includes(v.category)) s += 1.5;
      return { v, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || likeCount(p, b.v) - likeCount(p, a.v))
    .map((x) => x.v);

  return { query: q, videos, creators, tags };
}

export interface Suggestion {
  kind: 'query' | 'creator' | 'tag' | 'video';
  label: string;
  sub?: string;
  value: string;
}

export function suggestions(p: Persisted, query: string): Suggestion[] {
  const r = search(p, query);
  const out: Suggestion[] = [];
  for (const u of r.creators.slice(0, 3)) out.push({ kind: 'creator', label: u.name, sub: `@${u.handle}`, value: u.handle });
  for (const t of r.tags.slice(0, 3)) out.push({ kind: 'tag', label: `#${t.tag}`, sub: `${t.count} videos`, value: t.tag });
  for (const v of r.videos.slice(0, 4)) out.push({ kind: 'video', label: v.title, sub: `@${getUser(p, v.creatorId)?.handle ?? ''}`, value: v.id });
  return out;
}
