# SirSC Scroll (V1.1)

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

## Layout (V1.1)

The desktop layout is built around the screen, not a stretched phone:

| Area | What's in it |
| --- | --- |
| Sidebar (196px, or 64px collapsed) | Brand, For You / Following / Trending / Friends / Explore, Saved, History, Notifications (unread badge), Creator Studio, Profile, Settings, the Collapse control and the demo account switcher. Collapsing animates; icons stay put while labels fold away, and tooltips appear on hover or keyboard focus. The choice is remembered, with a separate setting for screens under 1100px (collapsed by default there, still expandable). `[` toggles it. |
| Player column | The **feed bar** (For You / Following / Trending / Friends, with a cyan pill that glides to the active feed), and beside it **Focus Mode** and **Customize widgets**. Under it, the 9:16 player sized from the available height, and the action rail: creator, like, comments, save, share, statistics, more, and previous / position / next. The feed bar can't be closed or hidden. |
| Widget area | Search and Upload, category chips and sort, then the **widgets**: Creator, Video information, Comments, Video statistics, Up next, Related videos, Friends' activity and Discovery. Each has a header with expand, an options menu (more room, move up/down, customize, hide) and close. |

### How the widgets share space

- Widgets are laid out in up to three columns, depending on how wide the area is (one under ~610px, two up to ~1000px, three beyond). At 1366×768 that's two: Video information above Comments, and Creator above Up next and Related.
- Small widgets (Creator, Video information, Statistics) take the height they need, capped so they can't crowd the rest. Comments, Up next, Related, Friends and Discovery share whatever is left, and Comments gets the biggest share.
- Close a widget and it folds away while its neighbours grow into the space. A column left with only small widgets merges into its neighbour, and an empty column collapses, so no blank box or column is ever left behind.
- The area is only as wide as its columns can use (about 500px each). On a wide screen with few widgets, the player and widgets are centered together instead of stretching.
- **Focus Mode** (the target button above the player, or `V`) hides every widget at once. The widget area collapses completely and the player centers. Pressing it again brings the previous layout back.
- Controls bring widgets back without a trip to Settings: the title on the video opens Video information (with the full description), the creator's avatar or @handle opens Creator, the comments button (or `C`) opens Comments and puts the cursor in the box, the statistics button opens Video statistics, the position counter opens Up next, and the rail's More menu has Related videos. A widget that's already open is scrolled into view and highlighted instead of duplicated.
- **Customize widgets** (beside Focus Mode, and in Settings → Widgets) has a switch per widget plus Show all, Hide all, Previous layout and Default layout.
- The layout is saved in localStorage (separately from the demo accounts) and comes back after a refresh. Opening and closing widgets never restarts the video.

### Switching feeds

Each feed keeps its own position. Switching feeds slides the new feed in from the side of its tab while the old one slides out (about 240ms), the pill glides across, and the widgets update to the new video. Only the video area changes; the sidebar, feed bar and widget layout stay put. Rapid switching settles on the last tab clicked, with one playing clip.

On phones nothing changes: full-screen swipe feed, feed tabs on top, and slide-up sheets for comments and creator info.

## Motion

Everything you can click answers with movement, from one shared layer (`src/lib/motion.ts` + `src/styles/motion.css`) instead of per-component code:

- **Press:** every button, link, tab, chip, card, menu item, checkbox and toggle squishes and springs back, scaled to its size (small icons more, big cards barely). Icons react to what they mean: refresh, reset and shuffle spin, send flies forward, arrows nudge their way, hearts, bookmarks, checks and close icons pop.
- **State changes:** toggles pop when they switch on or off, swapped icons (play/pause, mute, expand) pop in, and counters (likes, comments, badges, stats, percentages) roll to their new number. Liking bursts a ring around the heart, unliking deflates it, saving drops the bookmark in, following spins the check in.
- **Selection:** highlights glide instead of jumping: the sidebar's active item, the feed pill, category and filter chips, every segmented control (sorts, ranges, theme, density, speed), profile and Studio tabs, Saved and Settings navigation, upload steps, clip styles, covers, stickers, colour swatches, visibility cards, and on phones the feed-tab underline and bottom-nav marker.
- **Opening and closing:** modals, menus, popovers, the search dropdown, toasts and phone sheets all animate out as well as in. "More/Less" and reply threads ease their height. New comments, replies, notifications, grid cards, up-next rows and chips rise in, staggered. Removed items fold away and the rest glide into the gap (history, recent searches, saved videos, drafts, uploads, comments, hashtags, hidden creators).
- **Bigger changes:** pages and tabs ease in, the feed fades in, a filter, sort or Up Next pick cross-fades the video, charts draw their line and grow their bars, the seek bar glides to where you click, and switching account, theme or density cross-fades the whole app (View Transitions, where the browser supports them).
- **Hover:** buttons, cards and chips lift slightly, icons grow, close buttons turn, and list rows lean in.
- **Reduced animations** (Settings, or the system setting) turns all of this off, along with the placeholder animations.

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
- **Settings**: playback (autoplay, auto-advance, loop, start muted, speed, volume, reduced animations), appearance (Dark, Dim, High contrast; Compact, Standard, Expanded; collapsed sidebar for wide and small screens), widgets, feed (interests, reset, hidden creators, Not interested, history pause and clear), demo data (switch, reset one account, reset all) and the shortcut reference.

## Keyboard

| Key | Action |
| --- | --- |
| ↓ / J / Page Down | Next video |
| ↑ / K / Page Up | Previous video |
| Space | Play / pause |
| ← / → | Seek 5 seconds |
| L | Like |
| C | Show comments and start typing |
| S | Save |
| F | Follow creator |
| M | Mute / unmute |
| V | Focus Mode: hide or bring back every widget |
| [ | Collapse or expand the sidebar |
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
  state/widgets.ts      the widget manager: show, hide, expand, focus, Focus Mode, presets, order
  state/widgetDefaults.ts  widget ids, labels, sizing roles and the default layout
  data/                 fictional catalog: categories, users, 162 videos, comments, account seeds
  lib/catalog.ts        read helpers over seeded + local data (counts, visibility, friend activity)
  lib/recommend.ts      scoring, feeds, related videos, trending, creator suggestions
  lib/search.ts         local search and suggestions
  lib/analytics.ts      simulated Studio statistics
  lib/audio.ts          generated soundtrack for unmuted clips
  lib/router.ts         hash router (#/explore, #/profile/alex, #/video/v010, ...)
  lib/widgetLayout.ts   plans the widget columns and how wide the widget area should be
  components/placeholders/  the 11 animated clip templates
  components/player/    feed track (wheel/touch), feed stack (switch animation), stage + playback clock, action rail
  components/widgets/   widget frame, widget area (columns + fold/unfold), customize popover
  components/panel/     comments and the sections the widgets are built from
  components/shell/     sidebar, feed bar, top bar + search, feed controls, mobile nav
  components/modals/    upload, share, collections, report, preferences, confirm
  pages/                feed (desktop + mobile), Explore, Profile, Saved, History, Notifications, Studio, Settings
  styles/               tokens/themes, shell, feed, panel, placeholders, pages, modals, mobile
```

The fake data and demo logic live in `data/`, `lib/` and `state/`, separate from the components. To connect a backend later, replace `persist.ts` and the functions in `lib/catalog.ts` and `state/actions.ts`; the placeholder renderer can be swapped for a `<video>` element inside `Stage.tsx`.

## Checked

Tested in headless Chromium at 1366×657, 1280×720, 1024×700, 1920×1080 and a Pixel/iPhone viewport: no console errors and no horizontal overflow; one wheel notch and one 40-event trackpad gesture each move exactly one clip; touch swipes work both ways; likes, saves, follows, comments (with a mention notifying another account), collections, sharing, Not interested, account switching, upload → publish → watch, deep links, themes, reset and persistence after reload all work; after 80 clip changes and several page visits, DOM nodes and event listeners stay flat and only the visible clip animates.

V1.1 adds the widget workspace, Focus Mode, the permanent feed bar, animated feed switching and the animated sidebar. The acceptance checks for it (closing Video information grows Comments with no gap and no video restart; Comments alone fills the area; Focus Mode with a collapsed sidebar leaves only the player, feed bar, rail and icon sidebar, centered, with scrolling intact; the title and comments button bring their widgets back; rapid feed switching keeps the bar still, each feed's position and the widget layout; rapid sidebar toggling causes no overflow; widgets and sidebar survive a refresh with account data intact; 1280×720, 1366×768, 1920×1080, tablet and phone) all pass in headless Chromium, along with the V1 feature checks. Notifications created in the last few seconds now show immediately (they used to wait for the next 15-second clock tick).
