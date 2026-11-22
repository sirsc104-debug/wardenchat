// The seam between catalog metadata and the app. A real video is an ordinary `Video` with a YouTube
// `source`, so likes, saves, comments, follows, widgets, Focus Mode and the four feeds work on it unchanged.
// Counts SirSC Scroll can't know are not invented: likes, comments, shares and saves start at 0 and grow
// only from this app's own actions. Views are YouTube's.

import type { Category, TemplateKind, User, Video, YouTubeSource } from '../state/types';
import type { CatalogCategory, CatalogVideo } from './scrollCatalog';
import { hash } from './rng';

export type RealVideo = Video & { source: YouTubeSource };

/** Catalog discovery category -> SirSC Scroll category (the app has no 'viral' or 'internet humor'). */
export const CATEGORY_MAP: Record<CatalogCategory, Category> = {
  gaming: 'gaming',
  memes: 'memes',
  comedy: 'comedy',
  sports: 'sports',
  technology: 'technology',
  animals: 'animals',
  science: 'science',
  music: 'music',
  viral: 'trending',
  internet_humor: 'memes',
  trending_entertainment: 'trending',
};

/** App categories -> the catalog categories that feed them (used to boost For You). */
export function catalogCategoriesFor(cats: Category[]): CatalogCategory[] {
  const out: CatalogCategory[] = [];
  for (const [cc, app] of Object.entries(CATEGORY_MAP) as [CatalogCategory, Category][]) if (cats.includes(app)) out.push(cc);
  return out;
}

const TEMPLATE_FOR: Record<Category, TemplateKind> = {
  gaming: 'gaming', memes: 'meme', sports: 'sports', comedy: 'comedy', school: 'school', technology: 'tech',
  music: 'music', animals: 'animals', science: 'science', trending: 'trend', community: 'sirsc',
};

export const YT_PREFIX = 'yt-';

/** Channel IDs become creator users with an id prefix that can never clash with the demo users. */
export function channelUserId(channelId: string): string {
  return 'yt:' + channelId;
}

export function isRealVideo(v: Video | undefined): v is RealVideo {
  return !!v && v.source?.kind === 'youtube';
}

export function toSirscVideo(c: CatalogVideo): RealVideo {
  const category = CATEGORY_MAP[c.category] ?? 'trending';
  const h = hash(c.video_id);
  const published = c.published_at ? Date.parse(c.published_at) : Date.now();
  const perDay = c.view_count ? c.view_count / Math.max(1, (Date.now() - published) / 86_400_000) : 0;
  return {
    id: YT_PREFIX + c.video_id,
    creatorId: c.channel_id ? channelUserId(c.channel_id) : 'yt:unknown',
    title: c.title,
    description: c.description ?? '',
    hashtags: c.hashtags ?? [],
    category,
    duration: c.duration_seconds && c.duration_seconds > 0 ? c.duration_seconds : 30,
    views: c.view_count ?? 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    uploadedAt: published,
    template: TEMPLATE_FOR[category],
    // Placeholder look, used only if the thumbnail can't load.
    palette: { h1: h % 360, h2: (h >>> 9) % 360, ac: (h >>> 18) % 360 },
    caption: c.title,
    glyph: '▶',
    variant: h % 4,
    frame: 0.5,
    sound: c.channel_title ? 'Original audio · ' + c.channel_title : 'Original audio',
    meta: {
      quality: 0.6,
      // 0-1 from views per day on a log scale (about 1 at 1M views a day).
      momentum: Math.min(1, Math.log10(1 + perDay) / 6),
      alsoFor: [],
    },
    source: {
      kind: 'youtube',
      youtubeId: c.video_id,
      thumbnailUrl: c.thumbnail_url,
      orientation: c.orientation,
      aspectRatio: c.aspect_ratio,
      channelId: c.channel_id,
      channelTitle: c.channel_title,
    },
  };
}

/** A YouTube channel as an app creator `User`. Follower numbers are unknown, so they start at 0. */
export function channelToUser(c: CatalogVideo, handleTaken: (h: string) => boolean): User | null {
  if (!c.channel_id) return null;
  const h = hash(c.channel_id);
  const name = c.channel_title?.trim() || 'YouTube channel';
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 18) || 'channel';
  let handle = slug;
  for (let n = 4; handleTaken(handle) && n <= 24; n += 4) handle = `${slug}.${c.channel_id.slice(-n).toLowerCase()}`;
  return {
    id: channelUserId(c.channel_id),
    handle,
    name,
    bio: 'YouTube channel. Videos and details come from YouTube.',
    avatar: { h1: h % 360, h2: (h >>> 9) % 360 },
    followers: 0,
    following: 0,
    likes: 0,
    categories: [CATEGORY_MAP[c.category] ?? 'trending'],
    kind: 'creator',
    joined: 0,
  };
}

export function youtubeWatchUrl(id: string): string {
  return 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
}

export function youtubeChannelUrl(channelId: string): string {
  return 'https://www.youtube.com/channel/' + encodeURIComponent(channelId);
}
