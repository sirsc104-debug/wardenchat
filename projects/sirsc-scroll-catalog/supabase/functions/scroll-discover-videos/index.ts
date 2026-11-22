// scroll-discover-videos: finds short YouTube videos for SirSC Scroll with the official YouTube Data API v3
// and keeps the catalog's metadata fresh. It never scrapes YouTube or downloads video files.
//
// Callers: pg_cron and admin SQL only (scroll_private.run_discovery / run_refresh). Every request must carry
// the x-scroll-trigger-secret header; the database checks it against the secret in Vault. There is no
// browser access (no CORS headers) and the publishable key is not accepted.
//
// Body: { mode: "discover" | "refresh" | "probe", searches?: number, trigger?: "manual" | "schedule" | "test",
//         check?: boolean (probe only: also make one 1-unit videos.list call to confirm the key works) }
//
// discover / refresh respond 202 with the run id and continue in the background (EdgeRuntime.waitUntil);
// results are in public.scroll_import_runs.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const YT = "https://www.googleapis.com/youtube/v3";
const SEARCH_COST = 100;
const VIDEOS_COST = 1;
const MAX_ERRORS = 50;

type Json = Record<string, unknown>;
type Settings = {
  discovery_enabled: boolean;
  daily_unit_limit: number;
  scheduled_searches_per_day: number;
  max_searches_per_run: number;
  max_results_per_search: number;
  max_duration_seconds: number;
  preferred_max_seconds: number;
  region_code: string;
  relevance_language: string;
  refresh_batch_limit: number;
};
type Query = {
  id: number;
  category: string;
  query: string;
  order_by: string;
  published_within_days: number | null;
  next_page_token: string | null;
  last_searched_at: string | null;
  weight: number;
};
type VideoRow = {
  video_id: string;
  title: string;
  description: string | null;
  channel_title: string | null;
  channel_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  published_at: string | null;
  view_count: number | null;
  youtube_category_id: string | null;
  hashtags: string[];
  embeddable: boolean;
  made_for_kids: boolean | null;
  orientation: "vertical" | "horizontal" | "square" | null;
  aspect_ratio: number | null;
};

class QuotaStop extends Error {
  constructor(public reason: "safety_limit" | "google_quota_exceeded") {
    super(reason);
  }
}
class ApiError extends Error {
  constructor(public status: number, public reason: string, message: string) {
    super(message);
  }
}

function json(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "server is not configured" });
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Authorization: the trigger secret, checked by the database (it lives only in Vault).
  const candidate = req.headers.get("x-scroll-trigger-secret") ?? "";
  if (!/^[0-9a-f]{64}$/.test(candidate)) return json(401, { error: "unauthorized" });
  const { data: authorized, error: authError } = await db.rpc("scroll_admin_verify_trigger", { p_candidate: candidate });
  if (authError) {
    console.error(JSON.stringify({ event: "auth_check_failed", message: authError.message }));
    return json(500, { error: "authorization check failed" });
  }
  if (authorized !== true) return json(401, { error: "unauthorized" });

  let body: Json = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mode = String(body.mode ?? "discover");
  const trigger = ["manual", "schedule", "test"].includes(String(body.trigger)) ? String(body.trigger) : "manual";
  const apiKey = Deno.env.get("YOUTUBE_API_KEY") ?? "";
  const yt = new YouTube(apiKey, db);

  if (mode === "probe") {
    const result: Json = { ok: true, youtubeKeyPresent: apiKey.length > 0 };
    if (apiKey && body.check === true) {
      try {
        // "Me at the zoo": 1 unit, only to confirm the key is accepted.
        const data = await yt.get("videos", { part: "id", id: "jNQXAC9IVRw" }, "videos");
        result.youtubeKeyWorks = Array.isArray(data.items);
        result.unitsUsed = yt.units;
      } catch (e) {
        result.youtubeKeyWorks = false;
        result.error = describe(e, apiKey);
      }
    }
    return json(200, result);
  }
  if (mode !== "discover" && mode !== "refresh") return json(400, { error: "unknown mode" });
  if (!apiKey) return json(500, { error: "YOUTUBE_API_KEY is not set" });

  const { data: settingsData, error: settingsError } = await db.rpc("scroll_admin_get_settings");
  if (settingsError || !settingsData) return json(500, { error: "could not read settings" });
  const settings = settingsData as Settings;
  if (mode === "discover" && !settings.discovery_enabled) return json(409, { error: "discovery is disabled in settings" });

  const requested = Number(body.searches);
  const searches = mode === "discover"
    ? Math.max(1, Math.min(settings.max_searches_per_run,
      Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : settings.scheduled_searches_per_day))
    : 0;

  const { data: runId, error: runError } = await db.rpc("scroll_admin_start_run", {
    p_mode: mode,
    p_trigger: trigger,
    p_params: { searches, requested: Number.isFinite(requested) ? requested : null },
  });
  if (runError) return json(500, { error: "could not start run" });
  if (runId == null) return json(409, { error: "another run is in progress" });

  const work = (mode === "discover" ? discover(db, yt, settings, Number(runId), searches) : refresh(db, yt, settings, Number(runId)))
    .catch(async (e) => {
      console.error(JSON.stringify({ event: "run_crashed", run: runId, message: describe(e, apiKey) }));
      await db.rpc("scroll_admin_finish_run", {
        p_run_id: runId,
        p_status: "failed",
        p_stats: { errors: [{ stage: "run", message: describe(e, apiKey) }], api_units_used: yt.units },
      });
    });
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
    return json(202, { ok: true, runId, mode, searches });
  }
  await work;
  return json(200, { ok: true, runId, mode, searches });
});

// ------------------------------------------------------------------ YouTube client

class YouTube {
  units = 0;
  searchCalls = 0;
  videosCalls = 0;
  constructor(private apiKey: string, private db: SupabaseClient) {}

  // Reserves quota in the database before every request (and every retry), then calls the API.
  // The key goes in the x-goog-api-key header, so it is never part of a URL or an error message.
  async get(path: "search" | "videos", params: Record<string, string>, kind: "search" | "videos"): Promise<Json> {
    const cost = kind === "search" ? SEARCH_COST : VIDEOS_COST;
    let last = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: reservation, error } = await this.db.rpc("scroll_admin_reserve_units", { p_units: cost, p_kind: kind });
      if (error) throw new Error("quota reservation failed: " + error.message);
      if (!(reservation as Json).ok) throw new QuotaStop((reservation as Json).reason as QuotaStop["reason"]);
      this.units += cost;
      if (kind === "search") this.searchCalls++;
      else this.videosCalls++;

      let res: Response;
      try {
        res = await fetch(`${YT}/${path}?${new URLSearchParams(params)}`, {
          headers: { "x-goog-api-key": this.apiKey, accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        });
      } catch (e) {
        last = "network: " + redact(String(e), this.apiKey);
        await sleep(backoff(attempt));
        continue;
      }
      if (res.ok) return await res.json();
      const errBody = await res.json().catch(() => ({})) as Json;
      const err = (errBody.error ?? {}) as Json;
      const reason = String(((err.errors as Json[] | undefined)?.[0]?.reason) ?? "");
      const message = redact(String(err.message ?? res.statusText), this.apiKey);
      if (res.status === 403 && (reason === "quotaExceeded" || reason === "dailyLimitExceeded")) {
        await this.db.rpc("scroll_admin_mark_quota_exceeded");
        throw new QuotaStop("google_quota_exceeded");
      }
      if (res.status >= 500 || res.status === 429 || reason === "rateLimitExceeded" || reason === "userRateLimitExceeded") {
        last = `${res.status} ${reason} ${message}`.trim();
        await sleep(backoff(attempt));
        continue;
      }
      throw new ApiError(res.status, reason, message);
    }
    throw new ApiError(0, "retries_exhausted", last);
  }
}

function backoff(attempt: number): number {
  return Math.round(1000 * 2 ** attempt + Math.random() * 400);
}

function redact(text: string, apiKey: string): string {
  let t = text;
  if (apiKey) t = t.split(apiKey).join("[redacted]");
  return t.replace(/([?&]key=)[^&\s)"']+/gi, "$1[redacted]").slice(0, 500);
}

function describe(e: unknown, apiKey: string): string {
  if (e instanceof ApiError) return redact(`${e.status} ${e.reason} ${e.message}`.trim(), apiKey);
  if (e instanceof QuotaStop) return "quota stop: " + e.reason;
  return redact(e instanceof Error ? e.message : String(e), apiKey);
}

// ------------------------------------------------------------------ discovery

// Weighted round-robin: each slot goes to the category with the highest weight / (slots so far + 1);
// ties go to the category searched least recently. Within a category, the least recently searched query.
function pickQueries(all: Query[], n: number): Query[] {
  const byCat = new Map<string, Query[]>();
  for (const q of all) {
    if (!(q.weight > 0)) continue;
    if (!byCat.has(q.category)) byCat.set(q.category, []);
    byCat.get(q.category)!.push(q); // already ordered least recently searched first
  }
  const lastUse = (c: string) => {
    const t = byCat.get(c)?.[0]?.last_searched_at;
    return t ? Date.parse(t) : 0;
  };
  const used = new Map<string, number>();
  const picked: Query[] = [];
  for (let i = 0; i < n; i++) {
    let best: string | null = null;
    let bestScore = -1;
    for (const [cat, list] of byCat) {
      if (!list.length) continue;
      const score = list[0].weight / ((used.get(cat) ?? 0) + 1);
      if (score > bestScore || (score === bestScore && best && lastUse(cat) < lastUse(best))) {
        best = cat;
        bestScore = score;
      }
    }
    if (!best) break;
    picked.push(byCat.get(best)!.shift()!);
    used.set(best, (used.get(best) ?? 0) + 1);
  }
  return picked;
}

async function discover(db: SupabaseClient, yt: YouTube, settings: Settings, runId: number, searches: number) {
  const errors: Json[] = [];
  const addError = (e: Json) => { if (errors.length < MAX_ERRORS) errors.push(e); };
  const rejected: Record<string, number> = {};
  let quotaStop: string | null = null;
  let candidates = 0;

  const { data: queryData, error: qErr } = await db.rpc("scroll_admin_get_queries");
  if (qErr) throw new Error("could not read search queries: " + qErr.message);
  const plan = pickQueries((queryData ?? []) as Query[], searches);

  // 1. search.list: candidate IDs. Every result is a video, embeddable, syndicated, under 4 minutes, strict SafeSearch.
  const found = new Map<string, Query>(); // id -> query that found it first
  let searchesDone = 0;
  for (const q of plan) {
    const params: Record<string, string> = {
      part: "id",
      type: "video",
      q: q.query,
      maxResults: String(settings.max_results_per_search),
      videoEmbeddable: "true",
      videoSyndicated: "true",
      videoDuration: "short",
      safeSearch: "strict",
      regionCode: settings.region_code,
      relevanceLanguage: settings.relevance_language,
      order: q.order_by,
    };
    if (q.published_within_days) {
      params.publishedAfter = new Date(Date.now() - q.published_within_days * 86400000).toISOString();
    }
    if (q.next_page_token) params.pageToken = q.next_page_token;
    try {
      let data: Json;
      try {
        data = await yt.get("search", params, "search");
      } catch (e) {
        // A stored page token can expire: start that query from the first page again.
        if (e instanceof ApiError && e.status === 400 && params.pageToken && /page.?token/i.test(e.reason + " " + e.message)) {
          delete params.pageToken;
          data = await yt.get("search", params, "search");
        } else throw e;
      }
      searchesDone++;
      const ids = ((data.items ?? []) as Json[])
        .map((it) => ((it.id ?? {}) as Json).videoId)
        .filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id));
      candidates += ids.length;
      for (const id of ids) if (!found.has(id)) found.set(id, q);
      await db.rpc("scroll_admin_record_search", {
        p_query_id: q.id,
        p_next_page_token: typeof data.nextPageToken === "string" ? data.nextPageToken : null,
        p_result_count: ids.length,
      });
    } catch (e) {
      if (e instanceof QuotaStop) {
        quotaStop = e.reason;
        break;
      }
      addError({ stage: "search", query: q.query, message: describe(e, "") });
    }
  }
  const duplicatesInRun = candidates - found.size;

  // 2. Skip IDs already in the catalog.
  const ids = [...found.keys()];
  const { data: existingData } = await db.rpc("scroll_admin_existing_ids", { p_ids: ids });
  const existing = new Set((existingData ?? []) as string[]);
  const toCheck = ids.filter((id) => !existing.has(id));

  // 3. videos.list: validate and collect metadata, 50 IDs per call (1 unit each).
  const rows: (VideoRow & { category: string; discovered_query: string; discovered_run_id: number })[] = [];
  let validatedCount = 0;
  for (let i = 0; i < toCheck.length && !quotaStop; i += 50) {
    const chunk = toCheck.slice(i, i + 50);
    try {
      const items = await videosList(yt, chunk);
      for (const id of chunk) {
        const item = items.get(id);
        const verdict = validate(item, settings);
        if (typeof verdict === "string") {
          rejected[verdict] = (rejected[verdict] ?? 0) + 1;
          continue;
        }
        validatedCount++;
        const q = found.get(id)!;
        rows.push({ ...verdict, category: q.category, discovered_query: q.query, discovered_run_id: runId });
      }
    } catch (e) {
      if (e instanceof QuotaStop) {
        quotaStop = e.reason;
        break;
      }
      addError({ stage: "videos", message: describe(e, "") });
    }
  }

  // 4. Insert. The primary key plus "on conflict do nothing" prevents duplicates.
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await db.rpc("scroll_admin_insert_videos", { p_rows: rows.slice(i, i + 200) });
    if (error) addError({ stage: "insert", message: error.message });
    else inserted += Number(data ?? 0);
  }

  const rejectedTotal = Object.values(rejected).reduce((a, b) => a + b, 0);
  const status = errors.length || quotaStop ? (searchesDone || inserted ? "partial" : "failed") : "succeeded";
  const stats = {
    searches_planned: plan.length,
    searches_done: searchesDone,
    videos_list_calls: yt.videosCalls,
    api_units_used: yt.units,
    candidates_found: candidates,
    duplicates_in_run: duplicatesInRun,
    already_in_catalog: existing.size,
    validated: validatedCount,
    rejected: rejectedTotal,
    rejected_by_reason: rejected,
    inserted,
    quota_stop_reason: quotaStop,
    errors,
  };
  await db.rpc("scroll_admin_finish_run", { p_run_id: runId, p_status: status, p_stats: stats });
  console.log(JSON.stringify({ event: "discover_finished", run: runId, status, ...stats, errors: errors.length }));
}

// ------------------------------------------------------------------ refresh (retention)

async function refresh(db: SupabaseClient, yt: YouTube, settings: Settings, runId: number) {
  const errors: Json[] = [];
  const rejected: Record<string, number> = {};
  let quotaStop: string | null = null;
  let refreshed = 0;
  let removed = 0;

  const { data: idData, error } = await db.rpc("scroll_admin_refresh_candidates", { p_limit: settings.refresh_batch_limit });
  if (error) throw new Error("could not read refresh candidates: " + error.message);
  const ids = (idData ?? []) as string[];

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const items = await videosList(yt, chunk);
      const keep: VideoRow[] = [];
      const drop: string[] = [];
      for (const id of chunk) {
        const verdict = validate(items.get(id), settings);
        if (typeof verdict === "string") {
          rejected[verdict] = (rejected[verdict] ?? 0) + 1;
          drop.push(id);
        } else keep.push(verdict);
      }
      if (keep.length) {
        const { data, error: e1 } = await db.rpc("scroll_admin_apply_refresh", { p_rows: keep });
        if (e1) errors.push({ stage: "refresh", message: e1.message });
        else refreshed += Number(data ?? 0);
      }
      if (drop.length) {
        const { data, error: e2 } = await db.rpc("scroll_admin_remove_videos", { p_ids: drop });
        if (e2) errors.push({ stage: "remove", message: e2.message });
        else removed += Number(data ?? 0);
      }
    } catch (e) {
      if (e instanceof QuotaStop) {
        quotaStop = e.reason;
        break;
      }
      if (errors.length < MAX_ERRORS) errors.push({ stage: "videos", message: describe(e, "") });
    }
  }

  // Anything whose metadata is now older than the retention limit is blanked and hidden.
  const { data: expired, error: e3 } = await db.rpc("scroll_admin_expire_stale");
  if (e3) errors.push({ stage: "expire", message: e3.message });

  const status = errors.length || quotaStop ? (refreshed || removed ? "partial" : "failed") : "succeeded";
  const stats = {
    videos_list_calls: yt.videosCalls,
    api_units_used: yt.units,
    validated: refreshed,
    rejected: Object.values(rejected).reduce((a, b) => a + b, 0),
    rejected_by_reason: { ...rejected, metadata_expired: Number(expired ?? 0) },
    refreshed,
    removed,
    quota_stop_reason: quotaStop,
    errors,
  };
  await db.rpc("scroll_admin_finish_run", { p_run_id: runId, p_status: status, p_stats: stats });
  console.log(JSON.stringify({ event: "refresh_finished", run: runId, status, ...stats, errors: errors.length }));
}

// ------------------------------------------------------------------ validation

async function videosList(yt: YouTube, ids: string[]): Promise<Map<string, Json>> {
  // part=player with maxHeight makes YouTube report embed dimensions that follow the video's aspect ratio.
  const data = await yt.get("videos", {
    part: "snippet,contentDetails,status,statistics,player",
    id: ids.join(","),
    maxHeight: "640",
  }, "videos");
  const map = new Map<string, Json>();
  for (const item of (data.items ?? []) as Json[]) if (typeof item.id === "string") map.set(item.id, item);
  return map;
}

function parseDuration(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!m) return null;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Math.round(Number(m[4] ?? 0));
}

function bestThumbnail(thumbs: Json | undefined): string | null {
  if (!thumbs) return null;
  for (const k of ["maxres", "standard", "high", "medium", "default"]) {
    const t = thumbs[k] as Json | undefined;
    if (t && typeof t.url === "string") return t.url;
  }
  return null;
}

function hashtags(...texts: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.matchAll(/#([\p{L}\p{N}_]{2,50})/gu)) {
      out.add(m[1].toLowerCase());
      if (out.size >= 15) return [...out];
    }
  }
  return [...out];
}

// Returns the row to store, or the rejection reason.
function validate(item: Json | undefined, settings: Settings): VideoRow | string {
  if (!item) return "unavailable"; // deleted, private, or otherwise not returned
  const snippet = (item.snippet ?? {}) as Json;
  const status = (item.status ?? {}) as Json;
  const details = (item.contentDetails ?? {}) as Json;
  const stats = (item.statistics ?? {}) as Json;
  const player = (item.player ?? {}) as Json;

  if (status.privacyStatus !== "public") return "not_public";
  if (status.uploadStatus && status.uploadStatus !== "processed") return "not_processed";
  if (status.embeddable !== true) return "not_embeddable";
  if (((details.contentRating ?? {}) as Json).ytRating === "ytAgeRestricted") return "age_restricted";
  if (snippet.liveBroadcastContent && snippet.liveBroadcastContent !== "none") return "live_or_upcoming";
  const region = (details.regionRestriction ?? {}) as Json;
  const rc = settings.region_code;
  if ((Array.isArray(region.blocked) && region.blocked.includes(rc)) || (Array.isArray(region.allowed) && !region.allowed.includes(rc))) {
    return "region_blocked";
  }
  const duration = parseDuration(details.duration);
  if (!duration) return "no_duration";
  if (duration > settings.max_duration_seconds) return "too_long";
  if (typeof snippet.title !== "string" || !snippet.title.trim()) return "no_title";

  const w = Number(player.embedWidth);
  const h = Number(player.embedHeight);
  let orientation: VideoRow["orientation"] = null;
  let aspect: number | null = null;
  if (w > 0 && h > 0) {
    aspect = Math.round((w / h) * 1000) / 1000;
    orientation = aspect < 0.9 ? "vertical" : aspect > 1.1 ? "horizontal" : "square";
  }
  const description = typeof snippet.description === "string" ? snippet.description : "";
  const views = stats.viewCount != null ? Number(stats.viewCount) : null;
  return {
    video_id: String(item.id),
    title: String(snippet.title).slice(0, 300),
    description: description ? description.slice(0, 2000) : null,
    channel_title: typeof snippet.channelTitle === "string" ? snippet.channelTitle : null,
    channel_id: typeof snippet.channelId === "string" ? snippet.channelId : null,
    thumbnail_url: bestThumbnail(snippet.thumbnails as Json | undefined),
    duration_seconds: duration,
    published_at: typeof snippet.publishedAt === "string" ? snippet.publishedAt : null,
    view_count: views != null && Number.isFinite(views) ? views : null,
    youtube_category_id: typeof snippet.categoryId === "string" ? snippet.categoryId : null,
    hashtags: hashtags(String(snippet.title), description),
    embeddable: true,
    made_for_kids: typeof status.madeForKids === "boolean" ? status.madeForKids : null,
    orientation,
    aspect_ratio: aspect,
  };
}
