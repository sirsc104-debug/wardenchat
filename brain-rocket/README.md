# Brain Rocket

A 16:9 quiz game where your rocket only climbs when you answer. Start on the launch pad and fly past the clouds, the Moon, Mars, the outer planets, nebulae and galaxies, all the way to the edge of the universe.

Plain HTML, CSS and JavaScript with no build step. Open `brain-rocket/index.html` in a browser (or serve the folder with `python3 -m http.server`). The stage scales to any window size and keeps a 16:9 shape; the ⛶ button goes fullscreen.

## How it plays

- **92 question topics.** Most questions name a topic: *What's a breed of dog?*, *Name a type of home security system*, *Name a job that involves operating a vehicle*, *Name a way of scoring in sports*. About a third are letter questions that add clues to a big topic: *Name a breed of dog that starts with B and has an N in it.*
- **Niche answers score more.** Every answer has a rarity: Common 10, Uncommon 25, Rare 50, Epic 100, Legendary 200 points. "Labrador" is Common; "Xoloitzcuintli" is Epic.
- **Speed multiplier:** answer in the first quarter of the timer for ×2, in the first half for ×1.5.
- **Streak multiplier:** each correct answer in a row adds ×0.25, up to ×3. Your rocket's flame changes colour at streaks of 3, 5 and 8.
- **Deepest cut:** give one of the rarest possible answers to a question (Rare or better) for an extra ×1.5.
- Wrong guesses are free. Running out of time burns a fuel cell; run out of fuel cells and the game ends. Skips are limited and reset your streak.
- Reusing an answer you already gave this run scores half. Topics don't repeat until you've seen them all.
- Answers are forgiving: small typos ("Chihuahuha"), plurals ("touchdowns"), extra words ("golden retriever dog", "oak tree") and answers inside a phrase ("a big golden retriever") all count.

| Mode | Time per question | Fuel cells | Skips | Points | Topics |
| --- | --- | --- | --- | --- | --- |
| Owen (Easy) | 30 s | 5 | 5 | ×1 | Everyday: animals, colours, pizza toppings, toys, the beach… |
| Medium | 20 s | 3 | 3 | ×1.5 | Mixed: jobs, superheroes, cheeses, landmarks, Pokémon… |
| Hard | 12 s | 3 | 2 | ×2 | Mostly expert: constellations, bones, composers, knots… |

Keys: **Enter** submits, **Esc** pauses. Best scores per mode are saved in the browser.

## Files

| File | What it does |
| --- | --- |
| `js/data.js` | The topic format, the original six topics, and the milestones (score needed, place in the scene, real distance) |
| `js/topics-everyday.js`, `js/topics-mixed.js`, `js/topics-expert.js` | The other 86 topics with their answers and rarity tiers |
| `js/questions.js` | Picks topic and letter questions and checks answers |
| `js/scene.js` | The canvas world: sky, ground, planets, decorations, rocket, particles |
| `js/game.js` | Game flow, scoring, HUD, popups and screens |
| `js/audio.js` | Synthesized sound effects (no audio files) |

To change how rare an answer is, move it to a different tier line in its topic. To add a topic, copy any `topic({...})` block. To rename a mode, edit `MODES` in `js/game.js` and its card in `index.html`.
