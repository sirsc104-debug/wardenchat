# Brain Rocket

A 16:9 quiz game where your rocket only climbs when you answer. Start on the launch pad and fly past the clouds, the Moon, Mars, the outer planets, nebulae and galaxies, all the way to the edge of the universe.

Plain HTML, CSS and JavaScript with no build step. Open `brain-rocket/index.html` in a browser (or serve the folder with `python3 -m http.server`). The stage scales to any window size and keeps a 16:9 shape; the ⛶ button goes fullscreen.

## How it plays

- Each question gives you letter clues, for example: *Name a country that starts with A and has an I in it.*
- **Niche answers score more.** Every answer has a rarity: Common 10, Uncommon 25, Rare 50, Epic 100, Legendary 200 points. "America" is Common; "Kyrgyzstan" is Epic.
- **Speed multiplier:** answer in the first quarter of the timer for ×2, in the first half for ×1.5.
- **Streak multiplier:** each correct answer in a row adds ×0.25, up to ×3. Your rocket's flame changes colour at streaks of 3, 5 and 8.
- **Deepest cut:** give one of the rarest possible answers to a question (Rare or better) for an extra ×1.5.
- Wrong guesses are free. Running out of time burns a fuel cell; run out of fuel cells and the game ends. Skips are limited and reset your streak.
- Reusing an answer you already gave this run scores half.
- Small typos are forgiven ("Albaina" counts as Albania), and plurals work.

| Mode | Time per question | Fuel cells | Skips | Points | Clues |
| --- | --- | --- | --- | --- | --- |
| Owen (Easy) | 30 s | 5 | 5 | ×1 | One or two (starts with, has a letter, ends with) |
| Medium | 20 s | 3 | 3 | ×1.5 | Two (adds "has no E", length, double letters) |
| Hard | 12 s | 3 | 2 | ×2 | Two or three, including exact letter counts |

Categories: countries, animals, fruit & veg, sports, capital cities (Medium and Hard) and chemical elements (Medium and Hard). Each question is generated so it has enough valid answers for its mode.

Keys: **Enter** submits, **Esc** pauses. Best scores per mode are saved in the browser.

## Files

| File | What it does |
| --- | --- |
| `js/data.js` | Answer lists with rarity tiers, and the milestones (score needed, place in the scene, real distance) |
| `js/questions.js` | Builds questions from letter rules and checks answers |
| `js/scene.js` | The canvas world: sky, ground, planets, decorations, rocket, particles |
| `js/game.js` | Game flow, scoring, HUD, popups and screens |
| `js/audio.js` | Synthesized sound effects (no audio files) |

To change how rare an answer is, edit the number at the start of its line in `js/data.js`. To rename a mode, edit `MODES` in `js/game.js` and its card in `index.html`.
