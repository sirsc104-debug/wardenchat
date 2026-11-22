# SirSC Scroll · Real video catalog

The backend that finds real YouTube videos for SirSC Scroll and serves them to the app. It stores **video IDs and metadata only**. Videos play through YouTube's official embeds, and nothing is downloaded or hosted.

It lives in the existing Supabase project **Warden Chat** (`djmyvnaragfwoaljzexn`). Everything is new and prefixed `scroll_`, and no other app's tables, functions or jobs were changed. SirSC Scroll is now connected to it; see [INTEGRATION.md](INTEGRATION.md).

```
pg_cron (daily) ──► scroll-discover-videos (Edge Function) ──► YouTube Data API v3
                         │  search.list → candidate IDs
                         │  videos.list → validate + metadata
                         ▼
                 public.scroll_videos  (review_status: pending → approved by a person)
                         │
SirSC Scroll ──► scroll_feed / scroll_categories (read-only, approved + active rows only)
                         │
                 YouTube IFrame player plays the ID
```

## What's deployed

| Piece | What it is |
| --- | --- |
| `public.scroll_videos` | One row per YouTube video. The columns are: ID (primary key), title, description, channel name and ID, thumbnail, duration, published date, views, category, hashtags, embeddable, made-for-kids, orientation and aspect ratio, active flag, review status, trend score, discovered and last-refreshed dates. |
| `public.scroll_import_runs` | One row per run: searches, API units, candidates, duplicates, rejections by reason, inserts, refreshes, removals, errors, duration. |
| `scroll_private` schema | Settings, the daily quota ledger, the search queries (28, across 11 categories), admin helpers, and the `review_queue` and `quota_today` views. Not exposed through the API. |
| `scroll-discover-videos` | Edge Function with modes `discover`, `refresh` and `probe`. Source: `supabase/functions/scroll-discover-videos/index.ts`. |
| `scroll_feed`, `scroll_categories` | Read-only feed API for the app. |
| pg_cron | `scroll-discover-daily` (10:17 UTC) and `scroll-refresh-daily` (10:47 UTC). |
| Vault | `scroll_discovery_trigger_secret`, a random value created inside the database. |
| Extension | `pg_net` (added; the documented way for pg_cron to call an Edge Function). |

The migrations in `supabase/migrations/` are exactly what was applied, in order: `scroll_video_catalog`, `scroll_feed`, `scroll_schedule` and `scroll_preview_access`.

`scroll_preview_access` adds the owner **preview key**: a random value in Vault named `scroll_preview_key`.
- **With the key:** `scroll_feed`, `scroll_categories` and the new `scroll_videos_lookup` (details for up to 200 IDs) also return pending videos, never rejected or inactive ones.
- **Without it:** they return approved videos only.
- **Why security definer:** the three functions are security definer so they can apply that rule, and each filters explicitly. The advisor will list them as security-definer functions callable by `anon`; that's intended.
- **Direct table reads** still go through RLS (approved only).
- **To read the key:** `select decrypted_secret from vault.decrypted_secrets where name = 'scroll_preview_key';`
- **Tested:** no key or a wrong key returned 0 videos with `preview: false`; the real key returned pending videos with `preview: true`.

## Who can do what

- **Visitors (publishable key, signed in or not):**
  - They can read approved, active videos only. That's enforced by Row Level Security plus column grants. Review notes and internal columns can't be read.
  - They can call `scroll_feed` and `scroll_categories`.
  - They can't insert, update or delete anything, read the run log, or call any `scroll_admin_*` function.
- **Starting a run:**
  - Only callers that send the trigger secret can start one. The Edge Function asks the database to check it against Vault.
  - The secret never appears in code, the browser or logs. It isn't in this repository, and the person who built this never saw it.
  - pg_cron and the `scroll_private.run_*` helpers read it from Vault.
  - The function has no CORS headers and rejects the publishable and legacy anon keys.
- **The YouTube key:** `YOUTUBE_API_KEY` is read only by the Edge Function. It's sent in the `x-goog-api-key` header, never in a URL, and any error text is redacted before it's logged.

## Review before anything is public

Every discovered video starts as **`pending`** and is invisible to the app until someone approves it.

**List what's waiting.** Run this in the Supabase SQL editor; the result can be downloaded as CSV for the school:

```sql
select * from scroll_private.review_queue;
```

**Approve or reject IDs:**

```sql
select scroll_private.set_review_status(array['VIDEO_ID_1', 'VIDEO_ID_2'], 'approved');
select scroll_private.set_review_status(array['VIDEO_ID_3'], 'rejected', 'reason');
```

Rejected videos stay in the table, so later searches don't add them again.

Strict SafeSearch and the age-restriction filter are not enough on their own. The first import included things a school may well not want, such as a Hitman "kill" clip. Review is the real filter.

## Discovery

- **Searching:**
  - `search.list` runs with `type=video`, `videoEmbeddable=true`, `videoSyndicated=true`, `videoDuration=short` (under 4 minutes) and `safeSearch=strict`. It uses region US, language English, and up to 50 results per search.
  - Queries rotate by category weight; the least recently searched query in a category goes first.
  - Each query remembers its next page token, so repeat searches go deeper instead of returning the same results.
- **Validation** (`videos.list`, 50 IDs per call). A video is rejected if any of these apply:
  - It's missing (deleted or private), not public, or not fully processed.
  - It isn't embeddable or is age-restricted.
  - It's live or upcoming.
  - It's blocked in the US.
  - It has no duration, or is longer than `max_duration_seconds` (180).
- **Preference for short videos:** videos up to 90 seconds are ranked higher in For You.
- **Orientation:**
  - `videos.list` is asked for `part=player` with `maxHeight=640`. YouTube then reports embed dimensions that follow the video's aspect ratio, which is where `orientation` and `aspect_ratio` come from.
  - It's left null when YouTube doesn't report a size.
  - **Vertical is not treated as proof that a video is a YouTube Short.** The API doesn't say that, so the catalog never claims it.
- **Duplicates:**
  - IDs repeated within a run are counted once.
  - IDs already in the catalog are skipped before validation.
  - The insert uses the primary key with `on conflict do nothing`.

## Quota protection

| Protection | How |
| --- | --- |
| Costs | `search.list` costs 100 units; `videos.list` costs 1 unit per call of up to 50 IDs. |
| Safety limit | `daily_unit_limit` = 3,000 units per Pacific-time day (Google's default allowance is 10,000; YouTube resets at midnight Pacific). Every call, including retries, reserves its units in the database first and is refused once the limit would be passed. |
| Google's quota | A `quotaExceeded` or `dailyLimitExceeded` response stops the run and blocks further calls for the rest of that day. |
| Overlap | A unique index allows only one `running` run. A second request gets `409` and is logged as `skipped`. A run older than 15 minutes is marked `abandoned`. |
| Retries | Network errors, 5xx, 429 and rate-limit reasons are retried up to 3 times with exponential backoff and jitter. |
| Logging | Each run writes counts and up to 50 errors to `scroll_import_runs`. |
| Browser | The website never triggers a search. `scroll_feed` only reads the stored catalog. |

## Retention

Every day, `scroll-refresh-daily` handles stored metadata:
- **Refreshing:** metadata older than `refresh_after_days` (14) is re-fetched with `videos.list`, up to 1,000 videos (20 units).
- **Removing:** videos that are gone or now fail validation are deleted.
- **Expiring:** anything still not refreshed after `max_metadata_age_days` (30) is blanked and hidden until a later refresh succeeds. Its ID and review decision are kept.

This follows the YouTube API Services Developer Policies' limits on keeping API data without refreshing it, as I understand them. Check the current policy text before relying on this.

## Operating it (Supabase SQL editor)

```sql
-- Run now (asynchronous; the result shows up in scroll_import_runs)
select scroll_private.run_discovery(10);          -- 10 searches
select scroll_private.run_refresh();

-- Watch
select * from public.scroll_import_runs order by id desc limit 10;
select * from scroll_private.quota_today;

-- Tune (Phase 4)
update scroll_private.settings set scheduled_searches_per_day = 10;           -- 10–20 recommended
update scroll_private.settings set category_weights = category_weights || '{"science": 2, "memes": 0.5}';
update scroll_private.settings set daily_unit_limit = 2000;
update scroll_private.settings set discovery_enabled = false;                 -- pause discovery
insert into scroll_private.search_queries (category, query) values ('animals', 'baby goats #shorts');
update scroll_private.search_queries set active = false where query = 'meme #shorts';
select cron.alter_job((select jobid from cron.job where jobname = 'scroll-discover-daily'), schedule := '17 11 * * *');
```

The schedule does 15 searches a day by default, about 1,515 units, well under the 3,000 safety limit.

## Verification (2026-11-22)

Every check ran against the live project. The HTTP checks were made with `pg_net` from the database to the project's public URLs, using the same publishable key a browser would.

| # | Check | Result |
| --- | --- | --- |
| 1 | Edge Function can read `YOUTUBE_API_KEY` | `probe` with a 1-unit `videos.list`: `youtubeKeyPresent: true, youtubeKeyWorks: true`. The key is sent as a header. |
| 2 | Small test search | Run 1: 1 search returned 50 candidates in 1.2 s, using 101 units. |
| 3 | Discovered videos validated | 50 of 50 passed. In the first import, 955 of 964 passed; 9 were rejected as `too_long`. |
| 4 | Inserted into the database | Run 1 inserted 50; the first import (run 2) inserted 955. |
| 5 | Public read of approved videos | 30 videos were approved temporarily. The publishable key could read exactly those 30, never pending ones. `scroll_feed` paged 12 + 12 + 6 with no repeats and ended with no cursor; trending, newest, category and random worked; excluded IDs never came back. All 30 were then set back to pending, after which the public API returned `[]`. |
| 6 | Anonymous clients can't change the catalog | With the publishable key, REST insert and delete returned `401 permission denied`. So did reading `review_note` or `scroll_import_runs`, and calling `scroll_admin_insert_videos` or `scroll_admin_verify_trigger`. `anon` and `authenticated` have no UPDATE, DELETE or INSERT privilege. |
| 7 | Unauthorized clients can't start discovery | Requests with no secret, a wrong secret, the publishable key or the legacy anon key all got `401`, and GET got `405`. None of them created a run. |
| 8 | No duplicates | Run 2 hit 27 repeats within the run and 9 IDs already stored, and none were stored twice. Re-inserting 5 existing rows inserted 0 and changed nothing. All 1,055 rows have distinct IDs. |
| 9 | API usage | 2,224 units: 22 searches (2,200) and 24 `videos.list` calls (24). Details below. |
| 10 | Usable catalog entries | 1,055 videos from 746 channels: 1,031 vertical, 1,008 at 90 seconds or less, 992 both. 18 are marked made-for-kids. **All 1,055 are pending review, so 0 are public today.** |

Also tested:
- **Overlap:** a run was refused with `409` while another was marked running, using 0 units (run 6, `skipped`).
- **Refresh:** 5 backdated videos were refreshed for 1 unit (run 8).
- **Expiry:** tested inside a rolled-back transaction. It blanked the metadata and hid the video, and kept the review status.
- **Security advisor:** nothing new apart from the expected "RLS enabled, no policy" notes on the deny-all internal tables.

API usage by run: probe 1 unit, run 1 = 101, run 2 = 2,020, run 3 = 101, run 8 = 1.

Run 3 was a mistake. It was meant to test the overlap lock but started after run 2 had already finished, so it ran a real search. The lock was then tested properly without API cost (run 6). Run 4 is the placeholder used for that test, marked `abandoned`.

## Not established

- **Playback on school Chromebooks.** "Embeddable" only means YouTube allows embedding. In the playback test, standard embeds failed on the school Chromebook with error 152-4, and youtube-nocookie.com worked. Whether to use that address is the school's decision (see `projects/youtube-playback-test/README.md`, "For the school"). Every video still needs to be tested where it will be watched.
- **Whether each video suits students.** That's what review is for.
