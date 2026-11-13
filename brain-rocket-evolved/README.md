# Brain Rocket – Evolved

The sequel to [Brain Rocket](../brain-rocket/). The core is the same: name something in a
category, and the rarer your answer, the further your rocket flies. What changed:

- **One answer per prompt.** You get 25 seconds and one shot. An answer that isn't on the list
  doesn't use up your shot, so you can try another. A near-miss spelling asks to be confirmed
  first ("Did you mean Xoloitzcuintle? Press Enter again"). The first real answer locks in.
- **Much bigger answer lists.** The lists are built from Wikidata and Wikipedia instead of being
  written by hand, so real niche answers count. Brain Rocket's own lists are merged in, so
  everything that counted there still counts.
- **Clear-cut prompts only.** Every category has a definite set of answers: dog breeds, countries,
  Pokémon, Best Picture winners. There are no letter rules and no fuzzy "a type of…" prompts.
- **Rarity worked out from data, not guessed.** An answer's tier comes from how many language
  editions of Wikipedia cover it, nudged by its Brain Rocket tier when it had one.
- **Every answer is shown** after each prompt, and on the results. You can search them and filter
  them by tier.
- **New art and music.** The rocket is the same, but everything around it is new: a dusk spaceport
  with a striped setting sun and a glowing grid, then flat "poster" planets with hard shadows, on a
  route of 16 stops to the Edge of the Universe. The music is a synthwave loop.

Plain HTML, CSS and JavaScript with no build step. Open `brain-rocket-evolved/index.html` in a
browser, or serve the folder with `python3 -m http.server`.

## Ways to play

- **🌅 Daily Launch.** 10 prompts a day, the same for everyone, with a fresh set at midnight in the
  player's own time zone. Launch #1 is November 13, 2026 (`EPOCH` in `js/game.js`). One go a day:
  leaving part-way still counts, with the rest as misses. 50,000 points (5,000 a prompt) reaches the
  Edge of the Universe. The results show a share grid (📋 Share copies it, or opens the phone's
  share sheet), every prompt with your answer, and a day streak.
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

## The answer lists

`js/answers.js` is generated: don't edit it by hand. To change a category, edit
`tools/categories.py` and rebuild:

```
node tools/export_br.js > tools/cache/br-topics.json   # once, or when Brain Rocket's lists change
python3 tools/build_answers.py --report                # fetches what isn't cached, then writes js/answers.js
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
- `js/quiz.js`: the categories, answer matching (Brain Rocket's: accents, plurals, filler words,
  answers inside a phrase, small typos), and the daily and Endless order.
- `js/scene.js`: the world and the rocket (the rocket, flame, smoke and crash are Brain Rocket's).
- `js/audio.js`: Brain Rocket's sound effects with the Evolved music.
- `js/badwords.js`: Brain Rocket's rude-word check, unchanged.
- `js/game.js`: screens, the Daily Launch, Endless, the archive, the answer browser, saving.
- `tools/build_page.py`: builds one self-contained HTML file (for an artifact link, or
  `--google-sites` for Google Sites' Embed box).

Progress is saved in the browser under `brEvolved.*` keys, separate from Brain Rocket's. There are
no accounts yet. Syncing through Warden Chat would need its own progress document on the server.
