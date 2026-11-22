# SirSC Scroll (V1.2)

**Your Feed. Your Way.** A short-form video app for the SirSC ecosystem (SirSC Games, Warden Chat, SirSC AI), built for school Chromebooks and desktop browsers first, with a proper phone layout too.

**Live demo:** [claude.ai Artifact](https://claude.ai/artifact/QfMUocCP4F4Pt7ttW4h4ii) (private until shared from its Share menu). The Artifact build signs in against a pretend Warden Chat: any username and a password of 4 or more characters.

**Real videos.** By default SirSC Scroll plays real YouTube videos from the SirSC Scroll catalog (`projects/sirsc-scroll-catalog`). They play through YouTube's official embedded player, and no video files are downloaded or hosted. See [Real videos](#real-videos) below.

**Sign in with Warden Chat.** Nobody sees anything until they sign in with their Warden Chat username and password. Likes, comments and notifications are saved with that account in Warden Chat's database, so they're real and shared by everyone; follows, saves, collections, history and feed preferences stay in each browser, per account. See [Accounts](#accounts-sign-in-with-warden-chat) and [Likes and comments](#likes-and-comments).

There are no uploads and no sharing: both were simulated, and they're gone. The 162 animated placeholder clips are still there as **Demo clips** (Settings › Videos). They also stand in automatically whenever the catalog can't be reached or has nothing to show; their counts and sample comments are made up and read-only.

React 19 + TypeScript + Vite. Runtime dependencies are React, `lucide-react` (tree-shaken icons) and one locally bundled font (Manrope, latin subset). The SirSC logo is `src/assets/sirsc-logo.webp` (256 px, 20 KB) and the tab icon is a 64 px PNG inlined in `index.html`.

## Accounts: sign in with Warden Chat

- **The sign-in screen** comes first, with the SirSC logo: Warden Chat username and password. It signs in against Warden Chat's Supabase project the same way Warden Chat, Brain Rocket and Apples to Oranges do (`<username>@warden.invalid` with Supabase Auth's password grant), and the password goes only to Supabase Auth.
- **No account yet?** The screen links to Warden Chat (chat.sirsc104.com). Warden Chat's sign-up needs a one-time permission from its own sign-up page, so accounts can't be created from SirSC Scroll. Passwords, profile pictures and deleting an account are also on Warden Chat.
- **Staying signed in:** the session is kept in localStorage (`sirsc-scroll:session`) and refreshed about 90 seconds before it expires. Signing out in one tab signs out the others. If Warden Chat can't be reached when the page opens, a saved sign-in still opens the app.
- **Suspended or banned on Warden Chat:** SirSC Scroll's functions refuse the account, the app asks Warden Chat's `my_account_state`, and a screen shows the reason and the end date, with **Check again** and **Sign out**. Nothing of the app shows meanwhile.
- **An expired sign-in** returns to the sign-in screen with a note.
- **Signing out** (account menu at the bottom of the sidebar, or Settings › Account) ends the session on this browser only (`/auth/v1/logout?scope=local`). **Sign out and remove data from this browser** also deletes that account's follows, saves, collections and history here, for shared computers.
- **First sign-in on a browser** opens the feed preferences, so For You has something to go on.
- **Your profile** is `#/profile/me`: liked videos and collections, plus links to Warden Chat for the picture and password.

## Likes and comments

- **Where they live:** Warden Chat's database, through the `scroll_*` functions in `projects/sirsc-scroll-catalog/supabase/migrations/20261122210000_scroll_social.sql`. The tables sit in a private schema the API can't reach, and every rule is enforced there. Counts on real videos are the real numbers from SirSC Scroll's own users; views are YouTube's.
- **Sample comments:** every approved video starts with 7 to 20 comments from sample accounts (460 made-up usernames that exist only in SirSC Scroll, not on Warden Chat), so no video looks empty. **Real comments always come first**, in both Top and Newest; sample ones follow. Sample comments never send notifications, can be liked, replied to and reported like any other, and newly approved videos get theirs automatically. To remove them all: `delete from scroll_private.comments where seed_author is not null;` (details in the catalog README).
- **Which videos:** approved catalog videos only. Videos still waiting for review (owner preview) show "Likes and comments open once this video is approved", and demo clips keep their made-up counts and read-only sample comments.
- **Comments:**
  - Up to 300 characters; Top or Newest; replies are one level deep, and a reply to a reply joins the thread with "@name" in front.
  - Like comments, delete your own (its replies go with it), and **Report** anyone else's (bullying, hateful, not appropriate for school, spam, something else).
  - At most 6 comments a minute and 150 a day; the same comment twice within two minutes is refused.
- **Warden Chat's rules carry over:**
  - People who blocked each other on Warden Chat don't see each other's comments and can't reply to each other.
  - An account a Warden Chat admin muted can't comment (it can still like).
  - Comments from suspended or banned accounts are hidden.
- **Notifications** (sidebar, top bar and phone Inbox badges): replies to your comments, @mentions of your username and likes on your comments, from the last 30 days. Opening the page marks them seen; the badge checks every two minutes.

### Moderating comments (owner only)

**Review videos › Comments** (`#/review/comments`) uses the same review key as the video review page:
- **Reported** first, with how many reports and why; **All comments**; **Removed**.
- **Remove** hides a comment from everyone (and closes its reports). **Restore** undoes it. **Keep it** closes the reports and leaves the comment up.
- **Stop account** blocks an account from liking and commenting on SirSC Scroll and hides its comments, until **Allow again**. Its Warden Chat account isn't affected.
- Deleted and removed comments are kept in the database (hidden), so you can still see what was said. Every moderation action is logged.

## Real videos

- **Catalog:** the app reads it from Supabase with the project URL and its public publishable key, through `scroll_feed` and `scroll_videos_lookup`. It never searches YouTube or holds an API key.
- **Who sees what:**
  - Only videos marked **approved** in the catalog are served to everyone. Today none are, because the list goes to the school first.
  - Until then, the owner previews everything with the **preview key**. Get it in the Supabase SQL editor with `select decrypted_secret from vault.decrypted_secrets where name = 'scroll_preview_key';` and paste it into **Settings › Videos**. It's saved in that browser only and appears nowhere in the code.
  - With the key, the feed also includes videos still waiting for review, never rejected ones. A notice says so.
- **Playing:**
  - Only the video on screen has a player. Each video gets a new one, because switching videos inside one player kept the previous video playing on school Chromebooks.
  - The thumbnail shows until YouTube reports PLAYING. The app's own play/pause, mute, volume, speed, loop, auto-advance, progress bar and watch history all follow the YouTube player.
- **Player address:** **Settings › Videos › Player address** chooses `youtube-nocookie.com` (default) or `youtube.com`. Standard `youtube.com` embeds failed with error 152-4 on the school Chromebooks; youtube-nocookie.com worked. The school reviews that choice before the site is public.
- **Errors:**
  - A video YouTube refuses (gone, private, embedding off) is reported, skipped after 1.6 s, and hidden on that device. **Settings › Videos** can bring hidden videos back.
  - Errors that look like the network or device (152, 153, the player script not loading) don't hide anything. After three in a row the app stops skipping and shows Next / Try again / Settings.
- **Counts:** likes, comments, shares and saves on real videos start at 0 and come only from SirSC Scroll's own actions. Views are YouTube's, and no comments are generated for real videos.
- **Channels:** they appear as creators, so you can follow them and open their profile, which links to the channel on YouTube.

### Reviewing videos (owner only)

Open **Settings › Videos › Review videos** (`#/review`). It needs the **review key**, a second random value in Vault. Get it with `select decrypted_secret from vault.decrypted_secrets where name = 'scroll_review_key';`.
- **Why a separate key:** approving makes videos public, so the preview key can't approve anything. The review key also works as a preview key, and is saved as one when none is set.

**The flow:**
1. **To review:** most-watched first, filterable by category and searchable by title or channel. Shortlist what you'd put on the school's list, and reject the rest.
2. **Shortlisted:** only you can see these.
   - **List for the school** gives a copyable list by category, each video with its YouTube link, plus a CSV download.
   - When the school agrees, **The school approved these** approves the whole shortlist. It asks first, because approved videos are public.
3. **Approved:** public. **Unapprove** sends a video back to the shortlist.
4. **Rejected:** never shown. **Back to review** undoes a rejection.

**Ways to work:**
- Every card has its own buttons. You can also tick several cards and use the actions in the selection row, which stays at the top while you scroll.
- **Review one by one** plays each video with YouTube's embed. Keys: **A** shortlist, **R** reject, **J** or **→** skip, **K** or **←** back, **Esc** close.
- Single changes can be undone from the notice that appears.
- Every change is logged in the database.
- When you leave the page, the feed reloads so rejected videos leave it.
- **More videos:** they load in pages as you watch, so the browser never asks YouTube for anything except the player.
- **Not covered:** scrolling or clicking over the video goes to YouTube's player, as with any embed. Use the keyboard, the rail or the area beside the video to move between videos.

## Run it

```sh
cd projects/sirsc-scroll
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + multi-file build in dist/app
npm run build:single   # type-check + one self-contained file: dist/sirsc-scroll.html
npm run build:artifact # the same, shaped for a claude.ai Artifact: dist/sirsc-scroll-artifact.html
npx vite build --mode demo   # the multi-file app with the pretend Warden Chat, in dist/demo (for tests)
```

The Artifact and demo builds use `src/lib/demoBackend.ts`, a pretend Warden Chat that answers the same requests in the browser: any username with a password of 4+ characters, `banned` shows the banned screen, and made-up classmates comment, like and reply so notifications have something in them. The normal and single-file builds don't include it.

`dist/sirsc-scroll-artifact.html` is what the Artifact link above serves. It differs from the single file in three ways: no `<html>`/`<head>`/`<body>` (the host adds them), routes live in memory instead of `#/paths` (the frame only passes plain `#names`; `#video-v010`, `#explore`, `#trending` and similar still work as entry points), and share links use the app-style `sirsc-scroll://video/…` form since the page can't know its public URL. The app's own theme setting is stored on `data-look` so it never clashes with the host's `data-theme`.

`dist/sirsc-scroll.html` (about 670 KB) is the whole app in one file and can be pasted into a Google Sites embed. Progress is saved per browser.
- **Network requests:** it calls the catalog on Supabase and loads YouTube's player script and embeds. It needs an http(s) page for YouTube to accept the embeds.
- **Opened from disk (`file://`):** catalog calls still work, but YouTube will mostly refuse to play.
- **Artifact build:** it stays on demo clips, because the Artifact runs sandboxed.

## Layout (V1.1)

The desktop layout is built around the screen, not a stretched phone:

| Area | What's in it |
| --- | --- |
| Sidebar (196px, or 64px collapsed) | The SirSC logo and wordmark, For You / Following / Trending / Explore, Saved, History, Notifications (unread badge), Profile, Settings, the Collapse control and the account menu (your profile, account settings, Warden Chat, sign out). Collapsing animates; icons stay put while labels fold away, and tooltips appear on hover or keyboard focus. The choice is remembered, with a separate setting for screens under 1100px (collapsed by default there, still expandable). `[` toggles it. |
| Player column | The **feed bar** (For You / Following / Trending, with a cyan pill that glides to the active feed), and beside it **Focus Mode** and **Customize widgets**. Under it, the 9:16 player sized from the available height, and the action rail: creator, like, comments, save, statistics, more, and previous / position / next. The feed bar can't be closed or hidden. |
| Widget area | Search, category chips and sort, then the **widgets**: Creator, Video information, Comments, Video statistics, Up next, Related videos and Discovery. Each has a header with expand, an options menu (more room, move up/down, customize, hide) and close. |

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

- **Feeds**: For You (local recommendations, endless, re-ranked after every swipe), Following, Trending (engagement over time), plus lists opened from any grid (profile, search, hashtag, saved, history) with a Back button. Category filter and sort (recommended, newest, most liked, most viewed, shortest) apply to every feed.
- **Scrolling**: mouse wheel, trackpad, ↑/↓, J/K, Page Up/Down, touch swipe and on-screen buttons. A trackpad or wheel gesture moves exactly one clip, however much momentum it carries. Only the current clip and its two neighbours are mounted, and only the current one animates or runs a timer.
- **Playback (simulated)**: progress, seeking, ±5s with ←/→, speed 0.5–2×, loop, auto-advance, autoplay on/off, replay screen. Unmuting plays a quiet procedurally generated loop (Web Audio) so Mute and Volume do something real.
- **Social**: like (button, `L`, or double-click/double-tap with a heart burst) and comments, both saved with your Warden Chat account (see [Likes and comments](#likes-and-comments)); follow, save, collections (create, rename, delete, add, move between), Not interested, Hide creator (undo from the toast or Settings), Report video (removes it from your feeds; kept in this browser).
- **Explore & search**: categories, trending hashtags, popular creators, recommended and popular videos, recent searches and a top 10. Search covers titles, descriptions, captions, hashtags, creators and sounds, with live suggestions, `@handle` and `#tag` queries, and result tabs.
- **Profiles**: creators and YouTube channels (stats, follow, videos, a link to the channel); your own at `#/profile/me` (liked videos, collections, interests).
- **Notifications**: replies, @mentions and likes on your comments (from the server), filters, a weekly summary and your own activity history.
- **Recommendations**: category weights and hashtag affinity move with likes, saves, follows, comments, full watches, replays, quick skips and Not interested. Every clip shows why it was picked. Feed preferences show your strongest interests and let you raise or lower any category, or reset. This is transparent weighted scoring, not machine learning.
- **Settings**: playback (autoplay, auto-advance, loop, start muted, speed, volume, reduced animations), appearance (Dark, Dim, High contrast; Compact, Standard, Expanded; collapsed sidebar for wide and small screens), widgets, feed (interests, reset, hidden creators, Not interested, history pause and clear), account (who's signed in, sign out, sign out and remove data from this browser, clear this browser's data) and the shortcut reference.

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
  state/actions.ts      every mutation: feeds, likes, collections, signing in and out of an account's data
  state/widgets.ts      the widget manager: show, hide, expand, focus, Focus Mode, presets, order
  state/widgetDefaults.ts  widget ids, labels, sizing roles and the default layout
  data/                 demo clips: categories, fictional creators, 162 videos, sample comments, a fresh account
  lib/config.ts         Warden Chat's Supabase URL and publishable key
  lib/warden.ts         Sign in with Warden Chat: password grant, refresh, sign out, banned check, rpc()
  lib/accounts.ts       ties a sign-in to that account's data in this browser
  lib/social.ts         likes, comments, replies, reports and notifications from the scroll_* functions
  lib/demoBackend.ts    the pretend Warden Chat for the Artifact and demo builds
  lib/catalog.ts        read helpers over the videos on show (counts, creators)
  lib/recommend.ts      scoring, feeds, related videos, trending, creator suggestions
  lib/search.ts         local search and suggestions
  lib/audio.ts          generated soundtrack for unmuted clips
  lib/router.ts         hash router (#/explore, #/profile/me, #/video/yt-…, ...)
  lib/widgetLayout.ts   plans the widget columns and how wide the widget area should be
  components/placeholders/  the 11 animated clip templates
  components/player/    feed track (wheel/touch), feed stack (switch animation), stage + playback clock, action rail
  components/widgets/   widget frame, widget area (columns + fold/unfold), customize popover
  components/panel/     comments and the sections the widgets are built from
  components/shell/     sidebar, feed bar, top bar + search, feed controls, mobile nav
  components/modals/    collections, report video, report comment, preferences, confirm
  pages/                sign-in, feed (desktop + mobile), Explore, Profile, Saved, History, Notifications, Settings, Review, ModerateComments
  styles/               tokens/themes, shell, feed, panel, placeholders, pages, modals, mobile
```

Follows, saves, collections, history and interests are still per browser (`state/persist.ts`); moving them to the server would follow the same pattern as `lib/social.ts`.

## Checked

V1.2 (Warden Chat sign-in, real likes and comments, no uploads or sharing), in headless Chromium:
- **Demo build, 43 checks:** sign-in errors; signing in; first-run preferences; logo; no Friends, Upload, Share or Creator Studio; like count; post, duplicate refused, reply, report, delete; classmates' like and reply show as notifications; still signed in after a reload; `#/profile/me`; sign out; the banned screen; phone layout and comments sheet; no page errors.
- **Real build against a stand-in Supabase, 28 checks:** the exact sign-in request (lowercased `@warden.invalid`, publishable key, no Authorization), every call with the person's token, YouTube ids without the `yt-` prefix, server counts, a not-yet-approved video refusing likes without sending anything, rate-limit message, an expired token refreshed before the first call, suspended screen with reason and date, Check again, expired sign-in, offline start, sign out with `scope=local`.
- **Comment moderation, 10 checks** with the review key; sample comments show "sample" there and can't be "stopped".
- **Sample comments:** all 1,054 approved videos have 7 to 20 (14,078 in all, 1,556 of them replies; median 37 likes); a real comment with no likes sorts above a sample one with 1,116, in Top and Newest; liking, replying to and reporting a sample comment work; samples never notify anyone and stay out of the moderation page's "All comments"; approving a video seeds it (checked in a rolled-back transaction).
- **Database, run inside transactions that always roll back** (throwaway accounts created the way Warden Chat's sign-up does): likes, comments, replies to replies, cleanup of control characters, duplicates, length, closed videos, notifications (reply, mention, comment like), blocks both ways, muted, suspended (signed out, comments hidden), owner remove, restore, stop and allow, a stopped account can still unlike, 6-a-minute limit, and anon can't call any signed-in function.
- The earlier catalog (34/35) and review (33/34) suites still pass, run with a saved sign-in. The one failure in each expects the old behaviour: liking saved in the browser, and a stand-in API without the new functions.

Tested in headless Chromium at 1366×657, 1280×720, 1024×700, 1920×1080 and a Pixel/iPhone viewport: no console errors and no horizontal overflow; one wheel notch and one 40-event trackpad gesture each move exactly one clip; touch swipes work both ways; likes, saves, follows, comments (with a mention notifying another account), collections, sharing, Not interested, account switching, upload → publish → watch, deep links, themes, reset and persistence after reload all work; after 80 clip changes and several page visits, DOM nodes and event listeners stay flat and only the visible clip animates.

V1.1 adds the widget workspace, Focus Mode, the permanent feed bar, animated feed switching and the animated sidebar. The acceptance checks for it (closing Video information grows Comments with no gap and no video restart; Comments alone fills the area; Focus Mode with a collapsed sidebar leaves only the player, feed bar, rail and icon sidebar, centered, with scrolling intact; the title and comments button bring their widgets back; rapid feed switching keeps the bar still, each feed's position and the widget layout; rapid sidebar toggling causes no overflow; widgets and sidebar survive a refresh with account data intact; 1280×720, 1366×768, 1920×1080, tablet and phone) all pass in headless Chromium, along with the V1 feature checks. Notifications created in the last few seconds now show immediately (they used to wait for the next 15-second clock tick).
