// Read-only client for the SirSC Scroll catalog (Supabase). No dependencies: plain fetch to PostgREST.
// It needs only the project URL and the public publishable key. With that key the database returns
// approved, active videos only and accepts no writes; the owner's preview key (typed into Settings,
// kept in this browser) also lets pending videos through. YouTube is never searched from here.

export interface CatalogConfig {
  url: string;
  /** The project's publishable key (sb_publishable_...). Safe to ship in browser code. */
  publishableKey: string;
}

export type CatalogFeed = 'for_you' | 'trending' | 'newest' | 'category' | 'random';

/** Discovery categories stored in public.scroll_videos.category. */
export type CatalogCategory =
  | 'gaming' | 'memes' | 'comedy' | 'sports' | 'technology' | 'animals'
  | 'science' | 'music' | 'viral' | 'internet_humor' | 'trending_entertainment';

/** One catalog record. Metadata comes from the YouTube Data API and is refreshed by the server. */
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
  /** True when the preview key was accepted (pending videos included). */
  preview: boolean;
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
  /** for_you only: categories to favour (pass the same list for every page of one feed). */
  boostCategories?: CatalogCategory[];
  previewKey?: string;
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
    throw new CatalogError(res.status, message || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** One page of a feed. The server only reads the stored catalog. */
export function fetchFeed(cfg: CatalogConfig, req: FeedRequest): Promise<FeedPage> {
  return rpc<FeedPage>(cfg, 'scroll_feed', {
    p_feed: req.feed,
    p_category: req.category ?? null,
    p_cursor: req.cursor ?? null,
    p_limit: req.limit ?? 20,
    p_exclude: req.exclude ?? [],
    p_boost_categories: req.boostCategories ?? [],
    p_preview_key: req.previewKey || null,
  }, req.signal);
}

/** Details for specific YouTube IDs (at most 200 per call), with the same visibility rule. */
export function lookupVideos(cfg: CatalogConfig, ids: string[], previewKey?: string, signal?: AbortSignal): Promise<{ preview: boolean; items: CatalogVideo[] }> {
  return rpc(cfg, 'scroll_videos_lookup', { p_ids: ids.slice(0, 200), p_preview_key: previewKey || null }, signal);
}

/** Video counts per category. */
export function fetchCategories(cfg: CatalogConfig, previewKey?: string, signal?: AbortSignal): Promise<{ category: CatalogCategory; videos: number }[]> {
  return rpc(cfg, 'scroll_categories', { p_preview_key: previewKey || null }, signal);
}
