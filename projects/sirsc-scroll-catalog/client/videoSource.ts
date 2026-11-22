// The seam between video metadata and playback in SirSC Scroll.
//
// Everything social (likes, saves, comments, follows, widgets, the four feeds, Focus Mode, demo accounts)
// keeps working on the app's existing `Video` and `User` records. A real video is a normal `Video` with an
// extra `source` saying how to play it; Stage picks the player by `source.kind`, and both players report
// time through the same `PlaybackClock` shape that usePlayback already produces.
//
// When integrating, move this file into projects/sirsc-scroll/src/lib/ and change the two imports below
// to '../state/types' and './scrollCatalog' (see ../INTEGRATION.md).

import type { Category, TemplateKind, User, Video } from '../../sirsc-scroll/src/state/types';
import type { CatalogCategory, CatalogVideo } from './scrollCatalog';

/** How a video is played. Demo videos keep the animated placeholder. */
export type VideoSource =
  | { kind: 'demo' }
  | {
      kind: 'youtube';
      youtubeId: string;
      /**
       * Which embed address to use. 'nocookie' worked on the school Chromebooks in the playback test, and
       * is pending the school's approval; see projects/youtube-playback-test/README.md, "For the school".
       */
      host: 'youtube' | 'nocookie';
      thumbnailUrl: string | null;
      orientation: 'vertical' | 'horizontal' | 'square' | null;
      aspectRatio: number | null;
      channelTitle: string | null;
    };

export type RealVideo = Video & { source: VideoSource };

/** What the progress bar, auto-advance and watch analytics need, whichever player is running. */
export interface PlaybackClock {
  /** Seconds into the clip. */
  currentTime(): number;
  /** Seconds; for YouTube, the player's getDuration() once known, else the catalog duration. */
  duration(): number;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setMuted(muted: boolean): void;
  /** Called once when the clip finishes (YouTube state ENDED, or the fake clock reaching the end). */
  onEnded(cb: () => void): () => void;
}

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

const TEMPLATE_FOR: Record<Category, TemplateKind> = {
  gaming: 'gaming', memes: 'meme', sports: 'sports', comedy: 'comedy', school: 'school', technology: 'tech',
  music: 'music', animals: 'animals', science: 'science', trending: 'trend', community: 'sirsc',
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Channel IDs become creator users with an id prefix that can never clash with the demo users. */
export function channelUserId(channelId: string): string {
  return 'yt:' + channelId;
}

/**
 * A catalog record as an app `Video`. Counts SirSC Scroll can't know are not invented: likes, comments,
 * shares and saves start at 0 and grow only from this app's own (local) social actions. Views are YouTube's.
 */
export function toSirscVideo(c: CatalogVideo, host: 'youtube' | 'nocookie'): RealVideo {
  const category = CATEGORY_MAP[c.category] ?? 'trending';
  const h = hash(c.video_id);
  const perDay = c.view_count && c.published_at
    ? c.view_count / Math.max(1, (Date.now() - Date.parse(c.published_at)) / 86_400_000)
    : 0;
  return {
    id: 'yt-' + c.video_id,
    creatorId: c.channel_id ? channelUserId(c.channel_id) : 'yt:unknown',
    title: c.title,
    description: c.description ?? '',
    hashtags: c.hashtags,
    category,
    duration: c.duration_seconds ?? 30,
    views: c.view_count ?? 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    uploadedAt: c.published_at ? Date.parse(c.published_at) : Date.now(),
    template: TEMPLATE_FOR[category],
    // Placeholder look, used only as the loading poster behind the thumbnail.
    palette: { h1: h % 360, h2: (h >>> 9) % 360, ac: (h >>> 18) % 360 },
    caption: c.title,
    glyph: '▶',
    variant: h % 4,
    frame: 0.5,
    sound: c.channel_title ? 'Original audio · ' + c.channel_title : 'Original audio',
    meta: {
      quality: 0.6,
      // 0-1 from views per day on a log scale (about 1 at 1M views/day).
      momentum: Math.min(1, Math.log10(1 + perDay) / 6),
      alsoFor: [],
    },
    source: {
      kind: 'youtube',
      youtubeId: c.video_id,
      host,
      thumbnailUrl: c.thumbnail_url,
      orientation: c.orientation,
      aspectRatio: c.aspect_ratio,
      channelTitle: c.channel_title,
    },
  };
}

/** A YouTube channel as an app creator `User`. Follower numbers are unknown, so they start at 0. */
export function channelToUser(c: CatalogVideo): User | null {
  if (!c.channel_id) return null;
  const h = hash(c.channel_id);
  const name = c.channel_title ?? 'YouTube channel';
  return {
    id: channelUserId(c.channel_id),
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24) || 'channel',
    name,
    bio: 'YouTube channel',
    avatar: { h1: h % 360, h2: (h >>> 9) % 360 },
    followers: 0,
    following: 0,
    likes: 0,
    categories: [CATEGORY_MAP[c.category] ?? 'trending'],
    kind: 'creator',
    joined: 0,
  };
}
