# Connecting SirSC Scroll to the real catalog

**Status: done.** SirSC Scroll now plays real videos by default; see "Real videos" in `projects/sirsc-scroll/README.md`.

The client files moved into the app as `src/lib/scrollCatalog.ts` and `src/lib/videoSource.ts`, alongside new code:
- `src/lib/remoteCatalog.ts` (the video pool)
- `src/lib/youtube.ts`
- `src/components/player/YouTubeScreen.tsx`
- `src/components/common/VideoArt.tsx`

It follows the plan below, with two additions:
- **Preview key:** an owner preview key (`scroll_preview_key` in Vault, migration `scroll_preview_access`) lets the owner's browser see videos still pending review. "Approved" keeps meaning approved for students.
- **Lookup by ID:** `scroll_videos_lookup` reloads saved, liked and history items that aren't in the loaded pages.

The plan, as written before the work:

## Connection details

The frontend needs only these two values. Both are public by design:

```ts
const CATALOG = {
  url: 'https://djmyvnaragfwoaljzexn.supabase.co',
  publishableKey: 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni',
};
```

That key can only read approved, active videos and call `scroll_feed` / `scroll_categories`. It can't write anything or start a search. Never put the YouTube API key or any service key in the frontend.

The client in `client/scrollCatalog.ts` is plain `fetch`, with no supabase-js needed:

```ts
const page = await fetchFeed(CATALOG, { feed: 'for_you', limit: 20, boostCategories: ['gaming', 'animals'] });
const next = await fetchFeed(CATALOG, { feed: 'for_you', cursor: page.next_cursor, exclude: seenIds });
```

Feeds: `for_you`, `trending`, `newest`, `category` (with `category`) and `random`. Pages come 1–50 at a time through an opaque cursor. `exclude` drops IDs the app has already shown.

## How the app works today

| Concern | Where | Notes |
| --- | --- | --- |
| Video and user shapes | `src/state/types.ts` (`Video`, `User`) | Every component speaks these. |
| Where videos come from | `src/lib/catalog.ts` `refresh()`, `allVideos()`, `getVideo()` | Returns `p.userVideos` + `SEED_VIDEOS` (`src/data/videos.ts`). The file already says: "When a backend arrives, these are the functions to point at an API." |
| Users | `getUser()` → `USER_MAP` (`src/data/users.ts`) | Fictional creators of the demo clips, sample commenters, and the signed-in Warden Chat account. |
| Feeds | `src/lib/recommend.ts` `rankForYou`, `rankFollowing`, `rankTrending`, `rankFriends`, called from `src/state/actions.ts:82-85` | They rank whatever `allVideos()` returns. |
| The track | `src/components/player/FeedTrack.tsx` | Mounts the current clip and its two neighbours. |
| The picture | `src/components/player/Stage.tsx:107` `<Placeholder …/>` | The animated fake video. |
| The clock | `src/components/player/usePlayback.ts` | A simulated timer drives the progress bar, auto-advance and watch analytics (`startWatch` / `endWatch`). |
| Sound | `synth.start(...)` in `Stage.tsx` | A generated soundtrack for the fake clips. |
| Comments | `commentsFor()` → `seedComments()` (`src/data/comments.ts`) | Generated comments for seed videos. |

## The seam

`client/videoSource.ts` type-checks against the app's real `Video` and `User` types. It provides:

- **`VideoSource`**: `{ kind: 'demo' }` or `{ kind: 'youtube', youtubeId, host, thumbnailUrl, orientation, aspectRatio, channelTitle }`.
- **`RealVideo = Video & { source }`**: a real video is an ordinary `Video`, so likes, saves, comments, shares, history, widgets, Focus Mode and the four feeds work on it unchanged.
- **`toSirscVideo(record, host)`**: turns a catalog record into a `Video`. The ID becomes `yt-<videoId>`, so it can't clash with demo IDs.
  - Views are YouTube's.
  - Likes, comments, shares and saves start at 0 and grow only from SirSC Scroll's own actions. No counts are invented.
  - The catalog's 11 categories map onto the app's: `viral` and `trending_entertainment` → `trending`, `internet_humor` → `memes`.
- **`channelToUser(record)`**: turns a YouTube channel into a creator `User` with ID `yt:<channelId>`, so follow and profile work. Follower counts start at 0.
- **`PlaybackClock`**: the interface both players expose: `currentTime`, `duration`, `play`, `pause`, `seek`, `setMuted` and `onEnded`.

## Steps, in order

1. **Move the client in.** Copy `client/scrollCatalog.ts` and `client/videoSource.ts` to `src/lib/`. In `videoSource.ts`, change the imports to `'../state/types'` and `'./scrollCatalog'`.
2. **Add a source to `Video`:** `source?: VideoSource` in `types.ts`. It's optional, so the 150+ demo videos, local uploads and saved state keep working with no migration.
3. **Add a setting** `videoSource: 'demo' | 'catalog'`, defaulting to `'demo'`, in Settings and `DEFAULT_SETTINGS`. Everything below only applies with `'catalog'`, so the demo build stays exactly as it is.
4. **Add a catalog pool** in a new `src/lib/remoteCatalog.ts`:
   - It keeps a `Map` of `RealVideo` and a `Map` of channel `User`s.
   - `ensure(n)` loads pages of `fetchFeed('for_you', { boostCategories: topInterests(active account) })` and `fetchFeed('trending')`, passing `exclude` for IDs it already holds.
   - It keeps cursors per feed, and holds about 200 videos in memory.
   - It's a small external store, like `state/store.ts`, so components re-render when pages arrive.
5. **Point `catalog.ts` at it.** In `refresh()`, when `videoSource === 'catalog'`, build `lastAll` from `p.userVideos` + the pool, in place of `SEED_VIDEOS`. `getUser()` falls back to the pool's channel users. Everything that calls `allVideos` / `getVideo` (feeds, search, Explore, modals, notifications) then sees real videos without changes.
6. **Top up when the feed runs low.** Where `actions.ts` extends the For You list (around lines 123 and 143), call `remoteCatalog.ensure(...)` when the track is within about 10 videos of the end.
7. **Choose the player in `Stage.tsx`.**
   - `video.source?.kind === 'youtube'` renders a new `<YouTubeStage>`; otherwise the existing `<Placeholder>`.
   - Skip `synth.start` for YouTube videos.
   - `usePlayback` takes its time from a `PlaybackClock`. The current timer becomes the demo clock; the YouTube player provides the other. The progress bar, auto-advance, loop and watch analytics then stay as they are.
8. **Build `<YouTubeStage>` from what the playback test found** (`projects/youtube-playback-test`):
   - Use the official IFrame API only.
   - Create **a new player per video**. Reusing one player with `loadVideoById` silently kept the previous video playing at school.
   - Use host `youtube-nocookie.com` only if the school approves it (`source.host`); otherwise `youtube.com`.
   - Start with muted autoplay. Unmute after the first tap.
   - Show `thumbnailUrl` as the poster until the player reports PLAYING (switches took about 1.5 s with new players at school).
   - After PLAYING, check `getVideoUrl()` and treat a different ID as a failed load.
   - On `onError`, skip to the next video and remember the ID locally so it isn't shown again.
   - **Only the active slot may create an iframe.** `FeedTrack` mounts two neighbours, and they should show their thumbnails, not players.
   - Scrolling over the iframe goes to YouTube. Keep SirSC Scroll's scroll and keys on the surrounding UI, and check YouTube's embedded-player policies before covering the player.
9. **Comments on real videos:** `commentsFor()` should return only comments made in SirSC Scroll, with no `seedComments` for `yt-` IDs.
10. **Categories with no real content:** `school` and `community` have no catalog source. Either keep demo clips there or hide them in catalog mode.
11. **Creator Studio** analytics only covers local uploads, so it's unaffected.

## Done when

- With `videoSource: 'demo'`, the app behaves exactly as now. The existing V1.1 acceptance tests 1–10 pass.
- With `videoSource: 'catalog'`, on a school Chromebook through Google Sites:
  - The feeds fill from approved videos only.
  - Every like, save, comment, follow, widget, Focus Mode and feed switch works.
  - No YouTube search is made by the browser; the network log shows only `rest/v1/rpc/scroll_feed` and YouTube's own player traffic.
  - A video that fails to play is skipped, not shown as a broken player.
- The school has approved both the video list and, if it's used, the youtube-nocookie.com address.
