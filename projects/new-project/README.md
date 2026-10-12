# SirSC's Apples to Oranges

A higher-or-lower game where the two numbers have nothing to do with each other: a blue whale's weight against Jersey Mike's locations in New Jersey. Ignore the units and say whether the number on the right is higher or lower. Every right answer lifts a hot-air balloon higher into the sky.

Plain HTML, CSS and JavaScript with no build step. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`. Like Brain Rocket, it's a 1600×900 layout that stretches to fill the window, and phones play it sideways.

## How it plays

- **Two cards.** The left card shows its number. The right card shows what it counts and the unit, but the number is hidden. Pick **▲ Higher** or **▼ Lower** (or the ↑/↓ keys). The hidden number counts up, the right card slides over to the left, and a new card comes in.
- **Totally unrelated.** Two facts from the same category never meet, so it's always apples to oranges. The one exception is years: Toy Story against the first Pokémon games is a fair fight.
- **Difficulty is closeness.** How far apart the numbers are decides how hard a matchup is: the bigger one divided by the smaller.

| Mode | Time per pick | Lives | Numbers | Points |
| --- | --- | --- | --- | --- |
| Owen (Easy) | 15 s | 3 | At least 3× apart | ×1 |
| Medium | 10 s | 2 | 1.3× to 40× apart | ×1.5 |
| Hard | 7 s | 1 | 1.05× to 4× apart | ×2 |

- **Closer calls score more:** Common 10 (10× apart or more), Uncommon 25 (3–10×), Rare 50 (1.5–3×), Epic 100 (closer than 1.5×), Legendary 200 (photo finish).
- **📸 Photo finish.** Now and then (about 1 in 16 matchups on Owen, 1 in 12 on Medium, 1 in 8 on Hard), the two numbers tie or are only a few apart: 168 hours in a week against 169 towns in Connecticut. The reveal races up, then crawls the last few numbers one at a time with a drum roll. Win and it's confetti and Legendary points; lose and it's a sad trombone and "Lost by ONE." A tie counts as right whichever way you pick.
- **Streaks:** each right answer in a row adds ×0.25, up to ×5. **Speed:** picking in the first quarter of the timer gives ×2, in the first half ×1.5.
- A wrong pick or running out of time costs a life (🎈). When they're gone, the results show your altitude, right answers, best streak, photo finishes and the matchup that got you. **📋 Share** copies it.
- **Altitude** is your score × 3 metres, with stops on the rail: Treetops, Rooftops, Kite Height, the Birds, Burj Khalifa Height, the Clouds, the Mountain Peaks, Mount Everest, the Jet Planes, the Stratosphere, the Balloon World Record (21,027 m), the Weather Balloons and the Edge of Space.
- Best scores per mode are saved in the browser. **Esc** pauses.

**Background music**, made on the fly with Web Audio the way Brain Rocket does it (no music files). **Breeze** plays on the launch field and in the lower sky: an F–Dm–B♭–C ukulele strum with a bouncy bass, a shaker and a whistled tune every other time round. **Sky** fades in once the balloon passes the jet planes (11 km): slow, floaty pads with twinkles. The music starts on the first click or key press, drops back for a photo finish's drum roll, goes quieter while paused, and follows the 🔊 mute button. Turn it off with **🎵** on the home screen or **🎵 Music** in the pause menu; that choice is remembered in the browser.

## The facts

`js/facts.js` has 110 facts in 12 categories. That makes over 5,000 possible matchups, 35 of them photo finishes.

**Accuracy matters more here than in a normal quiz.** The number is the whole question, so one wrong fact makes a player lose unfairly. The rules:

- **Never put the number in the question.** "The number of Route 66" or "Dalmatians in 101 Dalmatians" answers itself.
- Every fact gets the most natural unit, always shown on the card, and one fixed number (a blue whale's weight is always 165 tons).
- `x: 1` marks a fact as **exact and unchanging** (88 piano keys, 206 bones). Only exact facts can meet in a photo finish, because when the gap is 1, a slightly-off number would flip the answer.
- Facts that are approximate or can change (store counts, speeds, calories) say so in their note ("About", "As of 2025"). They only meet numbers at least 10% away from them.
- `src` records where a number came from when it was looked up.

Facts checked online for this version: Big Mac 580 calories (McDonald's US), Jersey Mike's about 145 locations in New Jersey (2025 reports), blue whale up to about 330,000 lb (NOAA), a can of Coke 140 calories and 39 g sugar, Krispy Kreme Original Glazed about 190 calories, Minnesota 11,842 lakes (Minnesota DNR). The rest are well-established facts, but **read through the list** before sharing it widely. McDonald's fries were left out because sources disagreed.

To add a fact, add a line to `js/facts.js` in the right category. If two exact facts land within a few of each other, they become a photo finish automatically.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The screens: home, game, pause, results |
| `css/style.css` | Styles, in Brain Rocket's look (Fredoka, navy panels, bright cards) |
| `js/facts.js` | The facts and categories |
| `js/pairs.js` | Picks matchups: difficulty bands, photo finishes, scoring tiers |
| `js/scene.js` | The balloon world on a canvas: orchard, barn, kites, birds, clouds, planes, stratosphere |
| `js/audio.js` | Sound effects and the two music loops, made with Web Audio (no sound files) |
| `js/game.js` | The game: rounds, the count-up reveal, scoring, lives, the rail, music switching, results and sharing |
| `build-artifact.py` | Bundles everything into one page for publishing as an Artifact |

## Publishing as an Artifact

`python3 build-artifact.py OUT.html` bundles the game into one page for a claude.ai Artifact: the CSS and every script inlined, without the `<html>`/`<head>`/`<body>` tags the Artifact host adds itself. Rebuild and republish after changing anything. In an Artifact, **📋 Share** copies the results (the phone share sheet only opens when the game runs on its own page).

## Not built yet

A daily mode with a share grid, more facts (and a local Madison/DHHS set), and racing friends through Warden Chat.
