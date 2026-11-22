// Read-only client for the SirSC Scroll catalog (Supabase). No dependencies: plain fetch to PostgREST.
// Needs only the project URL and the public publishable key; the database only ever returns approved,
// active videos to this key (Row Level Security), and it cannot write anything.

export interface CatalogConfig {
  /** e.g. https://djmyvnaragfwoaljzexn.supabase.co */
  url: string;
  /** The project's publishable key (sb_publishable_...). Safe to ship in browser code. */
  publishableKey: string;
}

export type CatalogFeed = 'for_you' | 'trending' | 'newest' | 'category' | 'random';

/** Discovery categories stored in public.scroll_videos.category. */
export type CatalogCategory =
  | 'gaming' | 'memes' | 'comedy' | 'sports' | 'technology' | 'animals'
  | 'science' | 'music' | 'viral' | 'internet_humor' | 'trending_entertainment';

/** One item from scroll_feed. Metadata comes from the YouTube Data API and is refreshed by the server. */
export interface CatalogVideo {
  video_id: string;
  title: string;
  /** First 300 characters. */
  description: string | null;
  channel_title: string | null;
  channel_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  view_count: number | null;
  category: CatalogCategory;
  hashtags: string[];
  /** From the embed size YouTube reports. Vertical does not prove the video is a YouTube Short. */
  orientation: 'vertical' | 'horizontal' | 'square' | null;
  aspect_ratio: number | null;
  made_for_kids: boolean | null;
}

export interface FeedPage {
  feed: CatalogFeed;
  category: CatalogCategory | null;
  items: CatalogVideo[];
  /** Opaque. Pass it back to get the next page; null when there are no more. */
  next_cursor: string | null;
}

export interface FeedRequest {
  feed: CatalogFeed;
  /** Required for feed = 'category'. */
  category?: CatalogCategory;
  cursor?: string | null;
  /** 1-50, default 20. */
  limit?: number;
  /** IDs already shown, so they aren't returned again (max 1000 are used). */
  exclude?: string[];
  /** for_you only: categories to favour, e.g. the local recommender's top interests. */
  boostCategories?: CatalogCategory[];
  signal?: AbortSignal;
}

export class CatalogError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function rpc<T>(cfg: CatalogConfig, fn: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      /* not JSON */
    }
    throw new CatalogError(res.status, message);
  }
  return (await res.json()) as T;
}

/** One page of a feed. The server never runs a YouTube search for this; it only reads the catalog. */
export function fetchFeed(cfg: CatalogConfig, req: FeedRequest): Promise<FeedPage> {
  return rpc<FeedPage>(cfg, 'scroll_feed', {
    p_feed: req.feed,
    p_category: req.category ?? null,
    p_cursor: req.cursor ?? null,
    p_limit: req.limit ?? 20,
    p_exclude: req.exclude ?? [],
    p_boost_categories: req.boostCategories ?? [],
  }, req.signal);
}

/** Approved video counts per category. */
export function fetchCategories(cfg: CatalogConfig, signal?: AbortSignal): Promise<{ category: CatalogCategory; videos: number }[]> {
  return rpc(cfg, 'scroll_categories', {}, signal);
}
