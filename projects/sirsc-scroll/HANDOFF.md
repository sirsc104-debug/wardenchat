# Handoff: SirSC Scroll (for a Claude Code session on the owner's computer)

Written 2026-11-22, about 21:15 UTC, at the end of a long cloud session. Read this first, then
`projects/sirsc-scroll/README.md` (the app) and `projects/sirsc-scroll-catalog/README.md` (the back end).

## Where things are

- **Repo:** `sirsc104-debug/wardenchat`. **All this work is on branch `claude/sirsc-scroll-v1-d60v4k`.** It isn't merged and there's no PR (the owner hasn't asked for one). The repo root is an unrelated game (Claude Code Clicker).
- **Projects on the branch:**

| Folder | What |
| --- | --- |
| `projects/sirsc-scroll` | The app: a short-video feed (React 19 + TypeScript + Vite). The owner runs it on a private Google Site by pasting `dist/sirsc-scroll.html` into an Embed. |
| `projects/sirsc-scroll-catalog` | Its back end in Supabase: YouTube video discovery (Edge Function + pg_cron), the review/approval flow, likes and comments for Warden Chat accounts, sample comments. SQL migrations and the Edge Function source. |
| `projects/youtube-playback-test` | A standalone page used to test YouTube embeds on school Chromebooks. It's how the owner found that `youtube-nocookie.com` embeds play there and `youtube.com` ones fail (error 152-4). |

- **Get started locally:**

```sh
git fetch origin claude/sirsc-scroll-v1-d60v4k && git checkout claude/sirsc-scroll-v1-d60v4k
cd projects/sirsc-scroll && npm install
npm run dev              # http://localhost:5173 (signs in against the real Warden Chat)
npm run build:single     # dist/sirsc-scroll.html: what goes on the Google Site
```

## The owner and the rules they've set

- **Context:**
  - Student-facing, school context. The owner is building SirSC Scroll for their school community: SirSC Games, Warden Chat, SirSC AI.
  - **The site is private.** Nothing goes public until the school has approved it.
  - The school approves the video list. The school also allowed the owner, privately, to use `youtube-nocookie.com` embeds.
- **What the owner said:**
  - The goal is **not** to get around the district's YouTube blocking.
  - "Never invent video IDs."
  - "Do not use proxies, video downloaders, account spoofing, blocked-site workarounds, or attempts to disable school restrictions."
  - "Label timing measurements accurately."
- **Working style:**
  - Explain in plain language. They test on a school Chromebook and on the Google Site.
  - They dislike being asked to approve every small step. The committed `.claude/settings.json` allows the Supabase MCP tools without prompts.
- **After any change to the app:** rebuild `npm run build:single` and give them the new `dist/sirsc-scroll.html` to paste into the Google Site Embed. The **catalog and comments are data**, so they need no new HTML.
- **Commits:** so far they went on the branch above with descriptive messages, pushed when the work was done.

## Current state (2026-11-22)

| | |
| --- | --- |
| Catalog | **1,937 approved** videos in 11 categories, **0 pending**, 1 rejected (`PvpWKeizo6Y`, a Hitman kill clip the school rejected) |
| Comments | 25,760 **sample** comments (7–20 per approved video), **0 real comments, 0 real likes** so far |
| YouTube quota | `daily_unit_limit` 7,500 (raised from 3,000 on request); 4,242 used on 2026-11-22; resets at midnight Pacific |
| Schedule (pg_cron) | `scroll-discover-daily` 10:17 UTC (15 searches → new **pending** videos), `scroll-refresh-daily` 10:47 UTC (refresh metadata, deactivate gone videos) |
| Google Site | Private; the owner has signed in there with their Warden Chat account, and the sidebar fix (below) was the last thing shipped |
| claude.ai Artifact (README "Live demo") | **Stale (V1.1)**: not republished since sign-in was added. `npm run build:artifact` makes a current one (pretend Warden Chat) if wanted |

## Supabase: be careful

- **The project is shared:** Warden Chat (`djmyvnaragfwoaljzexn`), a **shared production database**. Warden Chat itself lives there, plus other SirSC apps (`warden_private`, `sirsc_*`, `br_*` Brain Rocket, `a2o_*` Apples to Oranges, chess, casino…).
- **Only touch `scroll_*` objects.** Never change Warden Chat's tables, triggers or Auth settings.
- **Access:**
  - The cloud session used the claude.ai Supabase connector (`mcp__Supabase__*` tools).
  - Locally, add Supabase's MCP server, or work in the Supabase dashboard's SQL editor and CLI.
  - The allow rules in `.claude/settings.json` name the tools `mcp__Supabase__…`. A server registered under another name gets other tool names; adjust the rules if prompts get annoying.
  - The cloud container couldn't reach `*.supabase.co` over HTTP; your computer can.

**Applied migrations** (DB version → repo file in `projects/sirsc-scroll-catalog/supabase/migrations/`):

| DB name | Repo file | What |
| --- | --- | --- |
| scroll_video_catalog | 20261122170000_scroll_video_catalog.sql | `public.scroll_videos`, `public.scroll_import_runs`, `scroll_private` settings/quota/search queries, `scroll_admin_*` functions for the Edge Function |
| scroll_feed | 20261122174500_scroll_feed.sql | first read-only feed (later replaced) |
| scroll_schedule | 20261122180000_scroll_schedule.sql | pg_cron jobs, `scroll_private.run_discovery/run_refresh` (pg_net → Edge Function) |
| scroll_preview_access | 20261122190000_scroll_preview_access.sql | `scroll_feed` / `scroll_categories` / `scroll_videos_lookup` with the owner's preview key |
| scroll_review | 20261122200000_scroll_review.sql | review statuses (pending → shortlisted → approved / rejected), `scroll_review_list/set/export` with the review key |
| scroll_social + scroll_social_unlike_when_stopped | 20261122210000_scroll_social.sql | likes, comments, replies, reports, notifications, owner moderation (file already includes the fix) |
| scroll_sample_comments + scroll_sample_comment_data | 20261122220000_scroll_sample_comments.sql | sample accounts and lines, seeding function, trigger, "real comments first" ordering |

- **Secrets:** don't print them or put them in code.
  - Edge Function secret `YOUTUBE_API_KEY`.
  - Vault entries `scroll_discovery_trigger_secret` (pg_net → Edge Function), `scroll_preview_key` (owner sees pending videos) and `scroll_review_key` (review and moderation pages; also works as a preview key).
  - The owner fetches a key with `select decrypted_secret from vault.decrypted_secrets where name = '…';` and pastes it into the app's Settings, where it's stored in that browser only.
  - The publishable key in `src/lib/config.ts` is public by design.
- **Edge Function:** `scroll-discover-videos` is deployed with `verify_jwt=false`. The database checks its `x-scroll-trigger-secret` header.
  - Modes: `discover`, `refresh`, `probe`.
  - Before every YouTube call it reserves quota in `scroll_private.quota_usage` and stops at `daily_unit_limit`.
  - It runs `search.list` (100 units) and then `videos.list` (1 unit per 50 IDs) to validate: embeddable, not age-restricted, at most 180 s, and so on.

**Everyday SQL:**

```sql
select * from scroll_private.quota_today;                                     -- today's YouTube units
select scroll_private.run_discovery(20, 'manual');                            -- 20 searches now (~2,020 units); runs in the background
select row_to_json(r) from (select * from public.scroll_import_runs order by id desc limit 1) r;  -- how it went
select review_status, count(*) from public.scroll_videos group by 1;          -- catalog status
select scroll_private.set_review_status(array['<id>', …], 'approved', 'Approved by the school');  -- or use #/review in the app
update scroll_private.settings set daily_unit_limit = 7500;                   -- quota cap
delete from scroll_private.comments where seed_author is not null;            -- remove every sample comment
```

## How sign-in and the social back end work

- **Sign-in:** everyone signs in with **Warden Chat** before seeing anything.
  - It uses Supabase Auth's password grant with email `<username lowercased>@warden.invalid`, the same scheme as Warden Chat, Brain Rocket and Apples to Oranges.
  - The session is stored in `localStorage['sirsc-scroll:session']`, refreshed about 90 s before expiry, and signing out uses `scope=local`.
  - Code: `src/lib/warden.ts`, `src/lib/accounts.ts`, `src/pages/SignIn.tsx`.
- **New accounts can't be created from SirSC Scroll.** Warden Chat's signup trigger requires a ticket from its own sign-up page (`warden_private.signup_policy.require_ticket = true`), so the sign-in screen links to https://chat.sirsc104.com/.
- **Every `scroll_*` social function checks `warden_private.game_session_valid()`.** That's an active account (not suspended or banned) with a live session.
  - On `scroll_not_signed_in`, the app asks Warden Chat's `my_account_state()` whether the account is suspended or banned, and shows that screen if so; otherwise it signs out ("sign-in expired").
- **Warden Chat rules that apply:**
  - `pair_blocked` hides comments both ways and blocks replies.
  - `muted_by_admin` can't comment.
  - Comments from suspended or banned accounts are hidden.
- **Moderation:** the owner moderates with the **review key** at `#/review/comments`. Warden Chat's `is_site_admin` needs a Warden-native session, so it can't be used from here.
- **Avatars:** Warden Chat's avatars bucket is private (only people who share a conversation can see a picture), so SirSC Scroll shows coloured letter avatars.
- **Where data lives:** likes, comments and notifications are on the server. Follows, saves, collections, history and interests are per browser, per account (`localStorage['sirsc-scroll:v1']`, version 2).
- **Sample comments:**
  - They're written by 460 made-up `scroll_private.seed_authors`, which are **not** Warden Chat accounts.
  - They sort after real comments, never notify anyone, and are hidden from moderation's "All comments".
  - A trigger on `scroll_videos` seeds a video when it becomes approved.
  - Nothing in the UI says they're fake. Worth reminding the owner to tell the school.

## The app in brief

- **Builds:**
  - `npm run build` → `dist/app`.
  - `build:single` → `dist/sirsc-scroll.html` (Google Site).
  - `build:artifact` → claude.ai Artifact (memory router + pretend Warden Chat).
  - `vite build --mode demo` → `dist/demo` (tests). The pretend back end is `src/lib/demoBackend.ts`, compiled out of normal builds.
- **Google Sites embed:**
  - Google Sites runs embed code in `about:srcdoc`, where `#/…` links resolve against the Google Sites page.
  - `src/lib/router.ts` detects a frame with no address of its own and routes in memory, intercepting in-app link clicks. That's the last fix shipped: before it, the sidebar did nothing on the Google Site.
  - The browser's Back button doesn't move between pages inside the embed.
- **Videos:** real ones from the catalog (`src/lib/remoteCatalog.ts`, `scrollCatalog.ts`) play in YouTube's IFrame player.
  - A new player is created per video, because reusing one kept playing the old video on Chromebooks.
  - The player uses `youtube-nocookie.com` by default (`src/components/player/YouTubeScreen.tsx`).
  - 162 animated **demo clips** stand in when the catalog can't be reached. They have made-up counts and read-only sample comments.
- **Removed on request:** uploads (Creator Studio), sharing, the four demo accounts, and the Friends feed and widget (they were fed only by the demo accounts).
- **Logo:** `src/assets/sirsc-logo.webp` (sidebar, sign-in screen) and a 64 px PNG favicon inlined in `index.html`. The owner's original transparent PNG isn't in the repo.

## Tests

- **Where:** `projects/sirsc-scroll/tests/e2e/`. See its README for setup and the expected counts.
- **Last results:** demo build 43/43, real build against a stand-in Supabase 28/28, moderation 10/10, sample-comment ordering 2/2, embed sidebar OK.
- **Database changes** were tested inside `DO` blocks that end with `raise exception 'RESULT %', …`, so everything rolls back.
  - Throwaway Warden Chat accounts can be made inside such a block: insert a `warden_private.browser_devices` row holding a signup ticket hash, insert `auth.users` with `warden_signup_ticket` in `raw_user_meta_data`, then an `auth.sessions` row.
  - Then switch with `set local role authenticated` and `set_config('request.jwt.claims', …)`.
  - The cloud session's queries for this are in its transcript, not the repo. Write it again if needed, and never leave test data behind.

## Not done / ideas the owner may raise

1. **Merge the branch** (or open a PR) when the owner asks.
2. **Check the real thing end to end from this computer.** Sign in, like, comment, reply and report against live Supabase; check `#/review/comments`. The cloud session could only test against stand-ins, though the owner has signed in on the Google Site.
3. **Republish the claude.ai Artifact** (stale), if the owner wants the preview link current.
4. **Friends feed with real data**, using Warden Chat friendships. Brain Rocket's `br_friendships` are shared by Brain Rocket and Apples to Oranges. Think about privacy before showing friends' likes.
5. **Video reports** ("Report video") only hide the video in that browser. They aren't sent to the server; comment reports are.
6. **Sync follows, saves, history and interests to the server** (today they're per browser), following the `lib/social.ts` pattern.
7. **Old test expectations:** `catalog-e2e` and `review-e2e` each have one stale check (see the tests README).
8. **Daily discovery:** every morning the 15 scheduled searches add new **pending** videos (several hundred at first, fewer as the catalog fills up). The owner reviews them at `#/review`, sends the shortlist to the school, then approves; approving seeds sample comments automatically.
