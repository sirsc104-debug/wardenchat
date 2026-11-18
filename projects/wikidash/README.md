# WikiDash (artifact edition)

A Wikipedia race game: everyone starts on the same article and races to a target using only the links.
It's a port of [GBrodie6/wikidash](https://github.com/GBrodie6/wikidash), a Cloudflare Workers game, to a
single claude.ai artifact, with SirSC's home screen, Warden Chat accounts, friends, and a Shop on the
SirSC wallet.

Published at https://claude.ai/artifact/E89M8ThWGL9WuTeCnVnFnz (demo wallet build).

## What's in it

| Part | Notes |
| --- | --- |
| Intro | The SirSC104 × GDog collab intro (`src/intro.html`), unchanged, first in the page. |
| Home | SirSC's home layout (Putt Club, Uphill Golf, Tower Defense): a 1600×900 stage (900×1500 on tall screens) scaled over a live scene of real articles and their links, account and wallet pills top left, Sound and page theme top right, a Solo / Party toggle with four mode cards each, a rules box, and the daily challenge on a paper card. |
| Solo | Easy, Medium and Hard start a race straight away on a route whose **shortest** length is 2, 3 or 4+ clicks. Custom opens the full lobby (start, target, all host rules). |
| Daily | One route a day for everyone, built from a seed of the date, so no server is needed. Leaderboard in the artifact's shared store (`lb/<user id>`); friends' results from Warden Chat. |
| Parties | The original four modes, rounds, host rules, co-hosts, suggestions, reactions. Signed in with Warden Chat, a party runs on Warden Chat (invite friends from your list); signed out, it runs on the artifact's own room (anyone with access joins by code). In both, the host's browser runs `logic.js`. |
| Accounts | Sign in or create a Warden Chat account, profile, wallet, sign out, restricted-account screen. |
| Friends | Shared with the other SirSC games: add, accept, decline, cancel, remove; friends' daily results, wins and badges; Race / Invite into a party; party invites. |
| Shop | 34 items in five kinds (pages, link styles, avatars, finishes, click effects): 22 for coins or diamonds, 8 diamonds only, 4 members only (November 2026's members' page, Diamond links, SirSC Royalty avatar, Diamond rain). Featured this week, a live preview, two-step buying, Membership and Diamonds tabs. Equipped looks apply in the race (pages, links, click effects, finishes) and to everyone in a party (avatars, member badge). |
| Coins | Solo and daily wins pay through `wkd_reward` (perfect runs 1.5×, members 1.5×, a daily bonus, a 20,000-a-day cap). Party races don't pay. |
| Articles | 3,526 articles (the 1,000 Level 3 vital articles, the daily start pages, and the 2,450 articles they link to most), cleaned to text with their links, about 62 playable links a page. Links to anything outside the set are plain text. |

## Back end (not built yet)

The front end is built against three contracts, like Wildcard Chess and Apples to Oranges:

- [docs/ACCOUNTS-WKD.md](docs/ACCOUNTS-WKD.md): `wkd_ping`, `wkd_friends` and the friend wrappers
- [docs/ECONOMY-WKD.md](docs/ECONOMY-WKD.md): `wkd_reward` and the `wkd` catalog rows on the SirSC wallet
- [docs/PARTIES-WKD.md](docs/PARTIES-WKD.md): parties on Warden Chat (`wkd_party_*`)

Until `wkd_ping` answers, the live builds hide accounts and everything else works. An artifact can't reach
Warden Chat at all, so the published artifact uses `src/wc/mock.js`, a pretend back end that follows the
contracts in browser storage ("Demo wallet"): any username, 🪙 40,000 and 💎 10 to start, a button to try
membership, two pretend friends and a friend request waiting. The pretend friends accept invites, join
your party and race (they follow shortest routes with the odd wrong turn).

## Build

```sh
npm install                 # esbuild
node build.mjs              # dist/wikidash.html: the artifact page, demo wallet
node build.mjs --live       # the same page talking to Warden Chat (for a host that can reach it)
node build.mjs --standalone # a complete page, live
```

The page loads its articles from `data/index.json` and `data/a/<n>.txt` next to it (base64 of gzipped
JSON, 16 articles a file; artifacts only serve a few file types). That data (83 MB) isn't in git. To
rebuild it:

```sh
python3 tools/fetch2.py titles.txt crawl/pages 3          # article pages from en.wikipedia.org/wiki/...
python3 tools/build_data.py crawl/pages dist/data <wikidash>/src/wiki.ts 2026-11-18
```

`titles.txt` is the seed list (Level 3 vital articles plus the daily starts) and then the most-linked
titles from it; see `tools/build_data.py` for the cleaning, aliases and the link graph. Article text is
from Wikipedia under CC BY-SA 4.0.

## Files

```
src/app.js          boot, screens, accounts and invites wiring
src/home.js         the home screen; src/scene.js its live background
src/shop.js         the Shop; src/look.js what you're wearing; src/fx.js finishes and click effects
src/acct.js         sign in, account, friends, restricted
src/reward.js       coins on the results card
src/wc/account.js   Warden Chat accounts (Supabase Auth, wkd_* calls)
src/wc/wallet.js    the SirSC wallet (sirsc_*, wkd_reward)
src/wc/friends.js   friends and party invites
src/wc/party.js     parties on Warden Chat, shaped like the artifact room
src/wc/catalog.js   every Shop item and the catalog rows
src/wc/mock.js      the pretend back end (demo builds)
src/net.js          solo / host / guest sessions; src/engine.js the host's trusted half
src/logic.js        the game rules, from the original repo (plus avatar and badge on players)
src/wiki.js         the bundled Wikipedia: search, articles, link checks, routes
src/lobby.js, race.js, results.js, mapview.js, replay.js   the original screens, adapted
src/style.css       the original stylesheet; artifact.css and sirsc.css on top
tools/              crawler, cleaner, data builder, Playwright tests (with a room/db mock)
```
