# Brain Rocket – Evolved

The sequel to [Brain Rocket](../brain-rocket/). The core is the same: name something in a
category, and the rarer your answer, the further your rocket flies. What changed:

- **One answer per prompt.** You get 25 seconds and one shot. An answer that isn't on the list
  doesn't use up your shot, so you can try another. The first real answer locks in.
- **Part of a name counts.** One distinctive word of an answer is enough ("pops" for Corn Pops,
  "hairless" for Sphynx, "zealand" for New Zealand), unless lots of answers share it ("terrier").
  Categories can also list nicknames and slang that Wikidata doesn't have (Chevy, Frenchie, Cali).
- **Very forgiving spelling.** Up to about a third of a long name can be wrong, and spellings that
  sound right count too ("chiwawa", "rotwiler", "phillipines"). The game shows what it read your
  answer as.
- **Much bigger answer lists.** The lists are built from Wikidata and Wikipedia instead of being
  written by hand, so real niche answers count. Brain Rocket's own lists are merged in, so
  everything that counted there still counts.
- **Clear-cut prompts only.** Every category has a definite set of answers: dog breeds, countries,
  Pokémon, Best Picture winners. There are no letter rules and no fuzzy "a type of…" prompts.
- **Rarity worked out from data, not guessed.** An answer's tier comes from how many language
  editions of Wikipedia cover it, nudged by its Brain Rocket tier when it had one.
- **Answers that didn't count are kept** (in the browser), and "📝 Didn't count" on the home screen
  and the results lists them with a Copy button, so they can be sent in and added to
  `tools/categories.py` (as `add` answers or `nick` names).
- **New art and music.** The rocket is the same, but everything around it is new: a dusk spaceport
  with a striped setting sun and a glowing grid, then flat "poster" planets with hard shadows, on a
  route of 16 stops to the Edge of the Universe. The music is a synthwave loop.

Plain HTML, CSS and JavaScript with no build step. Open `brain-rocket-evolved/index.html` in a
browser, or serve the folder with `python3 -m http.server`.

## Ways to play

- **🌅 Daily Launch.** 10 prompts a day, the same for everyone, with a fresh set at midnight in the
  player's own time zone. Launch #1 is November 13, 2026 (`EPOCH` in `js/game.js`). One go a day:
  leaving part-way still counts, with the rest as misses. 50,000 points (5,000 a prompt) reaches the
  Edge of the Universe. After each prompt you see your tier, the prompt's Supernova and the most
  common answers. The results show a share grid (📋 Share copies it, or opens the phone's share
  sheet), every prompt with your answer, and a day streak.
  - The order works through every category before any comes back. The categories are sorted by
    id, shuffled once per cycle, and each day takes the next ten (`Quiz.daily` in `js/quiz.js`).
    Adding or removing a category changes future days (and past ones in the archive).
- **∞ Endless.** Prompts back to back, never the same category twice until all of them have come
  up. A timeout or a skip burns a fuel cell, and three end the run. Your best is saved.
- **⟲ Archive.** Play any past Daily Launch. It doesn't change your streak or that day's score.

## Tiers

| | Tier | Points | Meaning |
| --- | --- | --- | --- |
| 🏁 | Launch Pad | 500 | The answer everyone blurts out: the best-known few in each list |
| 🛰️ | Space Junk | 750 | The famous "obscure" pick that everyone reaches for (picked by hand) |
| 🚀 | Orbiter | 1,500 | The next fifth by familiarity |
| 🌙 | Moonshot | 3,000 | The next quarter |
| 🪐 | Deep Space | 4,250 | Everything rarer |
| 🌟 | Supernova | 5,000 | One gem per prompt (picked by hand) |

A timeout scores 0 (⬛). A swear word crashes the rocket and ends the run with 0, as in Brain Rocket.

## Coins, diamonds, membership and the Shop

Evolved uses the **SirSC wallet** that Downhill Death Run and Wildcard Chess use: the same Warden Chat
accounts, 🪙 coins (earned), 💎 diamonds (paid: 5 💎 for $1, 1 💎 = 5,000 coins) and 👑 SirSC Membership
($3 a month), through the same `sirsc_*` functions with `game = 'bre'`. **Sign in** (top right of the
home screen) uses a Warden Chat account, and creating one here creates a Warden Chat account. What
this game adds on the server is in [`docs/ECONOMY-BRE.md`](docs/ECONOMY-BRE.md), with a ready-to-paste
Codex prompt in [`docs/CODEX-PROMPT-BRE.md`](docs/CODEX-PROMPT-BRE.md): `bre_ping`, `bre_reward` and the
`bre` catalog rows. The server works every number out; the game only shows what it says.

**Earning coins**

| | Pays | Limit |
| --- | --- | --- |
| 🌅 Daily Launch | 10,000 for finishing + 0.6 per point: 10,000 to **40,000** (a perfect 50,000) | Once per launch |
| ∞ Endless | 0.4 per point, up to **20,000** a run (a 50,000-point run) | 80,000 a day from Endless, 20 runs an hour |

Members get ×1.5 on both. Archive launches, crashes and Dailies left part-way don't pay. Players who
aren't signed in see what the run would have paid.

**The Shop** (🛒 SirSC Shop on the home screen, or the account chip) sells cosmetics only, never an
advantage, with a live preview of the rocket:

| Kind | What it changes | Items (free default first) |
| --- | --- | --- |
| 🚀 Rockets | The rocket's body | Classic; Midnight, Sunset, Mint (15,000 🪙 / 4 💎); Retro (22,500 / 6); Solid Gold (30,000 / 8); Chrome (12 💎); Galaxy (15 💎) |
| 🔥 Flames | The engine's colours | Classic (hotter with a streak); Plasma, Toxic (7,500 / 2); Candy (15,000 / 4); Inferno (22,500 / 6); Rainbow (10 💎) |
| ✨ Trails | What streams out behind | Smoke; Stardust (7,500 / 2); Hearts, Music, Bubbles (15,000 / 4); Gold Rush (12 💎) |

**Members** get 1.5× coins, 5 💎 a month, the SirSC Diamond by their name, that month's members'
rocket to keep (November 2026: Royal Velvet), and, while they're members, the SirSC Diamond rocket,
Diamond Fire and Diamond Shards. The Diamonds tab sends SirSC a "please add my diamonds" request after
paying in person, as in the other games. Equipped items are remembered on the device and in the
wallet, and only count for things the account owns.

**Until the server has `bre_ping`**, accounts stay hidden and the game works exactly as before.
`python3 tools/build_page.py OUT --wallet-demo` adds a pretend back end (`js/wallet-mock.js`,
labelled "Demo wallet" in the game) so the whole thing can be tried now: any username and password,
40,000 coins and 10 diamonds to start, and a button to try membership. (Real accounts need the page
to reach Warden Chat's server, so they work on the game's own site, not inside a claude.ai artifact.)

## The answer lists

`js/answers.js` is generated: don't edit it by hand. To change a category, edit
`tools/categories.py` and rebuild:

```
node tools/export_br.js > tools/cache/br-topics.json   # once, or when Brain Rocket's lists change
python3 tools/build_answers.py --report                # fetches what isn't cached, then writes js/answers.js
python3 tools/build_cached.py                          # the same from what's already downloaded (no fetching)
```

- **`tools/categories.py`** holds the categories: the prompt, its Wikidata sources, which Brain
  Rocket lists to merge in, words players add that should be ignored ("beagle dog"), the Space
  Junk picks and the Supernova, and anything to leave out.
- **`tools/wiki.py`** asks the Wikidata Query Service for every item in a source. For each item it
  gets the English Wikipedia title, the label, the aliases and the number of Wikipedia editions
  that cover it. Answers without an English Wikipedia article are left out.
  - The query service only allows this connection about one request a minute, so sources of the
    same shape share one query. Everything is cached in `tools/cache/wd/`, so a rebuild with
    nothing new makes no requests. The cache isn't committed.
- **`tools/build_answers.py`** merges, ranks and tiers the answers (see the docstring for the
  rules). `--report` prints each category's tiers so you can check them, and warns when a Space
  Junk or Supernova pick wasn't found.

No AI is used anywhere: not to build the lists, and not while playing.

## Files

- `index.html`: the page. The SirSC104 intro block at the top of `<body>` is copied unchanged
  from Brain Rocket: don't edit it.
- `css/style.css`: the look.
- `js/quiz.js`: the categories, answer matching (Brain Rocket's accents, plurals, filler words and
  answers inside a phrase, plus generous typo and sound-alike matching), and the daily and Endless order.
- `js/scene.js`: the world and the rocket (the rocket, flame, smoke and crash are Brain Rocket's).
- `js/audio.js`: Brain Rocket's sound effects with the Evolved music.
- `js/badwords.js`: Brain Rocket's rude-word check, unchanged.
- `js/game.js`: screens, the Daily Launch, Endless, the archive, saving.
- `js/catalog.js`: what the shop sells and how each rocket, flame and trail looks.
- `js/wallet.js`: Warden Chat sign-in and the SirSC wallet (from Wildcard Chess).
- `js/shop.js`: what's equipped, the account chip, signing in, the shop, and the coins on the results.
- `js/wallet-mock.js`: a pretend wallet, only in `--wallet-demo` builds.
- `docs/ECONOMY-BRE.md`, `docs/CODEX-PROMPT-BRE.md`: the back end for coins and the shop.
- `tools/build_page.py`: builds one self-contained HTML file (for an artifact link, or
  `--google-sites` for Google Sites' Embed box).

Progress is saved in the browser under `brEvolved.*` keys, separate from Brain Rocket's. Daily
streaks and Endless bests stay on the device; the wallet (coins, diamonds, what you own and have
equipped) is on the server.
