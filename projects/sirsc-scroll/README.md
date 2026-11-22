# SirSC Scroll

**Your Feed. Your Way.** A short-form video app for the SirSC ecosystem (SirSC Games, Warden Chat, SirSC AI), built for school Chromebooks and desktop browsers first, with a proper phone layout too.

**Live demo:** [claude.ai Artifact](https://claude.ai/artifact/QfMUocCP4F4Pt7ttW4h4ii) (private until shared from its Share menu).

V1 is a frontend demo. There are no real videos, accounts, uploads or servers: 162 fictional clips are animated CSS placeholders, four demo accounts stand in for sign-in, and everything you do is saved in the browser's localStorage.

React 19 + TypeScript + Vite. Runtime dependencies are React, `lucide-react` (tree-shaken icons) and one locally bundled font (Manrope, latin subset). No backend, no Supabase, no Warden Chat sign-in, no video files.

## Run it

```sh
cd projects/sirsc-scroll
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + multi-file build in dist/app
npm run build:single   # type-check + one self-contained file: dist/sirsc-scroll.html
npm run build:artifact # the same, shaped for a claude.ai Artifact: dist/sirsc-scroll-artifact.html
```

`dist/sirsc-scroll-artifact.html` is what the Artifact link above serves. It differs from the single file in three ways: no `<html>`/`<head>`/`<body>` (the host adds them), routes live in memory instead of `#/paths` (the frame only passes plain `#names`; `#video-v010`, `#explore`, `#trending` and similar still work as entry points), and share links use the app-style `sirsc-scroll://video/…` form since the page can't know its public URL. The app's own theme setting is stored on `data-look` so it never clashes with the host's `data-theme`.

`dist/sirsc-scroll.html` (about 600 KB) is the whole app in one file. It opens straight from disk (`file://`), makes no network requests, and can be pasted into a Google Sites embed. Progress is saved per browser.

## Layout

The desktop layout is built around the screen, not a stretched phone:

| Column | What's in it |
| --- | --- |
| Left (196px, or 64px collapsed) | Brand, For You / Following / Trending / Friends / Explore, Saved, History, Notifications (unread badge), Creator Studio, Profile, Settings, and the demo account switcher. Collapses to icons with tooltips; forced to icons under 1100px. |
| Center | The 9:16 player sized from the available **height** (a ResizeObserver works out the width), with an overlay timeline (seek by click or drag), play/pause, time, speed, loop and volume. Beside it is the action rail: creator (follow +), like, comments, save, share, more, and previous/next with the position (`12/160`). |
| Right (everything left over) | A top bar (search with suggestions, feed tabs, Upload), category filter chips + sort + refresh + feed preferences, then a panel tied to the current clip. When it's 600px or wider it splits in two: **Now playing** (creator card, title, description, hashtags, views/date/category, sound, exact likes/comments/saves/shares, why it was recommended, share row, and a comment preview that expands to the full thread in place with `C`) and **Discover** (Up next with reasons, related videos, friends' activity, more from the creator, trending hashtags, creators you might like, categories). Narrower, it becomes tabs: Overview, Comments, Up next, Discover. |

At 1366×768 (about 1366×657 inside Chrome) the player is ~358px wide at full height and the right column gets ~710px. At 1920×1080 the player is ~590px and the discovery grid goes to three columns; the comment preview also grows with screen height. On phones (under 720px) it switches to a full-screen swipe feed with overlay actions, creator info and sound, top feed tabs, bottom navigation, and slide-up sheets for comments and creator info.

## Features

- **Feeds**: For You (local recommendations, endless, re-ranked after every swipe), Following, Trending (engagement over time), Friends (what each account's friends liked, shared or posted), plus lists opened from any grid (profile, search, hashtag, saved, history) with a Back button. Category filter and sort (recommended, newest, most liked, most viewed, shortest) apply to every feed.
- **Scrolling**: mouse wheel, trackpad, ↑/↓, J/K, Page Up/Down, touch swipe and on-screen buttons. A trackpad or wheel gesture moves exactly one clip, however much momentum it carries. Only the current clip and its two neighbours are mounted, and only the current one animates or runs a timer.
- **Playback (simulated)**: progress, seeking, ±5s with ←/→, speed 0.5–2×, loop, auto-advance, autoplay on/off, replay screen. Unmuting plays a quiet procedurally generated loop (Web Audio) so Mute and Volume do something real.
- **Social**: like (button, `L`, or double-click/double-tap with a heart burst), comments (post, reply, like, delete your own, Top/Newest, @mentions and #tags become links), follow, save, collections (create, rename, delete, add, move between), share (copy link, send to friends, simulated Warden Chat conversations), Not interested, Hide creator (undo from the toast or Settings), Report (demo only).
- **Demo accounts**: Alex (gaming, memes, tech), Jordan (sports, comedy, gaming), Sam (music, trends, comedy), Taylor (school, science, memes). Each has its own profile, avatar, interests, follows, likes, saves, collections, comments, history, notifications, drafts and recommendations. Actions reach the other accounts on the same device: like Jordan's video, follow Sam, reply to Taylor, mention `@alex`, or send a clip, and that account gets the notification.
- **Explore & search**: categories, trending hashtags, popular creators, recommended and popular videos, recent searches and a top 10. Search covers titles, descriptions, captions, hashtags, creators and sounds, with live suggestions, `@handle` and `#tag` queries, and result tabs.
- **Profiles**: stats, follow, share, videos, liked videos (demo accounts), collections and profile settings (name, bio, avatar colours) for your own account.
- **Notifications**: followers, likes, comments and replies, mentions, shares, trending alerts, new posts; filters, read/unread per item, mark all read, timestamps, a weekly summary and your own activity history.
- **Creator Studio**: a 4-step upload dialog (clip style, sticker, colour, length; title, caption, category, hashtag editor; cover frame; visibility and comments) with a live preview, drafts, a simulated publishing flow, and analytics labelled as simulated (views per day with hover and table view, audience retention per video, engagement, traffic sources, audience interests, top videos). Published clips appear on your profile, in Explore and search, and in followers' feeds, and their (fake) audience arrives over the next few minutes.
- **Recommendations**: category weights and hashtag affinity move with likes, saves, follows, comments, shares, full watches, replays, quick skips and Not interested. Every clip shows why it was picked. Feed preferences show your strongest interests and let you raise or lower any category, or reset. This is transparent weighted scoring, not machine learning.
- **Settings**: playback (autoplay, auto-advance, loop, start muted, speed, volume, reduced animations), appearance (Dark, Dim, High contrast; Compact, Standard, Expanded; collapsed sidebar; discovery column), feed (interests, reset, hidden creators, Not interested, history pause and clear), demo data (switch, reset one account, reset all) and the shortcut reference.

## Keyboard

| Key | Action |
| --- | --- |
| ↓ / J / Page Down | Next video |
| ↑ / K / Page Up | Previous video |
| Space | Play / pause |
| ← / → | Seek 5 seconds |
| L | Like |
| C | Open / close comments |
| S | Save |
| F | Follow creator |
| M | Mute / unmute |
| / | Search |
| ? | Shortcut overlay |
| Esc | Close dialog, menu, sheet or comments |

Shortcuts are ignored while typing in a field.

## Code map

```
src/
  state/types.ts        every data shape (Video, User, AccountState, Settings, ...)
  state/persist.ts      localStorage load/save (the layer to swap for an API)
  state/store.ts        tiny external store + selector hooks (useSyncExternalStore)
  state/actions.ts      every mutation: feeds, likes, comments, collections, studio, accounts
  data/                 fictional catalog: categories, users, 162 videos, comments, account seeds
  lib/catalog.ts        read helpers over seeded + local data (counts, visibility, friend activity)
  lib/recommend.ts      scoring, feeds, related videos, trending, creator suggestions
  lib/search.ts         local search and suggestions
  lib/analytics.ts      simulated Studio statistics
  lib/audio.ts          generated soundtrack for unmuted clips
  lib/router.ts         hash router (#/explore, #/profile/alex, #/video/v010, ...)
  components/placeholders/  the 11 animated clip templates
  components/player/    feed track (wheel/touch), stage + playback clock, action rail
  components/panel/     side panel, comments, discovery sections
  components/shell/     sidebar, top bar + search, feed controls, mobile nav
  components/modals/    upload, share, collections, report, preferences, confirm
  pages/                feed (desktop + mobile), Explore, Profile, Saved, History, Notifications, Studio, Settings
  styles/               tokens/themes, shell, feed, panel, placeholders, pages, modals, mobile
```

The fake data and demo logic live in `data/`, `lib/` and `state/`, separate from the components. To connect a backend later, replace `persist.ts` and the functions in `lib/catalog.ts` and `state/actions.ts`; the placeholder renderer can be swapped for a `<video>` element inside `Stage.tsx`.

## Checked

Tested in headless Chromium at 1366×657, 1280×720, 1024×700, 1920×1080 and a Pixel/iPhone viewport: no console errors and no horizontal overflow; one wheel notch and one 40-event trackpad gesture each move exactly one clip; touch swipes work both ways; likes, saves, follows, comments (with a mention notifying another account), collections, sharing, Not interested, account switching, upload → publish → watch, deep links, themes, reset and persistence after reload all work; after 80 clip changes and several page visits, DOM nodes and event listeners stay flat and only the visible clip animates.
