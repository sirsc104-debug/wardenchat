# SirSC's Brain Rocket

A 16:9 quiz game where your rocket only climbs when you answer. Start on the launch pad and fly past the clouds, the Moon, Mars, the outer planets, nebulae and galaxies, all the way to the edge of the universe.

Plain HTML, CSS and JavaScript with no build step. Open `brain-rocket/index.html` in a browser (or serve the folder with `python3 -m http.server`). The stage scales to any window size and keeps a 16:9 shape; the ⛶ button goes fullscreen.

## Two ways to play

Pick one with the switch on the home screen; each has its own Owen (Easy), Medium and Hard modes and its own best scores.

- **🚀 Rocket.** Fly from the launch pad past the Moon, Mars and the outer planets to the edge of the universe. Every question has its own timer; running out of time burns a fuel cell, and the game ends when they're gone.
- **🌊 Submarine.** A timed dive: pick 30, 60 or 120 seconds next to the switch (each length keeps its own best scores). There are no lives and skips are unlimited, so it's all about how deep you get before the clock runs out: past the coral reef, the Titanic, hydrothermal vents and Challenger Deep, then drilling through the crust, the mantle and the core to the other side of the world. The speed bonus counts seconds per question (Owen ×2 within 6 s, ×1.5 within 12 s; Medium 5/10 s; Hard 4/8 s), and the game moves straight on after each answer because the clock never stops. Skipping jumps straight to the next question (and resets your streak).

**💀 Ultra Hard** is a fourth mode for both. Click its card to pick the question difficulty (Easy, Medium or Hard questions, each with its own best scores). It pays ×2.5 points, but while each question is on screen the rocket falls back down and the submarine floats back up, and the drift gets faster the further you've gone (12 points a second plus 3% of your score). Rocket keeps your highest point as your result; Submarine counts where you are when the clock runs out.

## How it plays

- **159 question topics, in three styles.**
  - *Topic questions* (most of the game): *What's a breed of dog?*, *Name a type of home security system*, *Name a job that involves operating a vehicle*, *Name a country in Africa*.
  - *Letter questions* (about a quarter): *Name a breed of dog that starts with B and has an N in it.*
  - *Year questions* (rare on Owen, about a third of Hard): *Name an animated movie released between 1990 and 2005*, *Name a US president in office at any time between 1880 and 1890*. They use movies, video games, consoles, inventions, TV shows, books, bands, toys, board games, Olympic host cities and US presidents. A wrong-year answer tells you its year.
- **No spoilers.** A correct answer never shows you the rarer ones you missed. After a skip or a timeout you see one Common answer that would have worked.
- **Fresh games.** The game remembers which topics you've had recently (in this browser), so a new game starts with ones you haven't seen.
- **Niche answers score more.** Every answer has a rarity: Common 10, Uncommon 25, Rare 50, Epic 100, Legendary 200 points. "Labrador" is Common; "Xoloitzcuintli" is Epic.
- **Speed multiplier:** answer in the first quarter of the timer for ×2, in the first half for ×1.5.
- **Streak multiplier:** each correct answer in a row adds ×0.25, up to ×5. Your rocket's flame changes colour at streaks of 3, 5 and 8.
- **Deepest cut:** give one of the rarest possible answers to a question (Rare or better) for an extra ×1.5.
- **Hints on Owen (Easy).** The 💡 Hint button shows the first letter of a Common answer with blanks for the rest (P _ _ _ _); press again for another letter, up to half the word. Each letter costs 20% of that answer's points (one hint ×0.8, two ×0.64…) and ends your streak.
- Wrong guesses are free. Running out of time burns a fuel cell; run out of fuel cells and the game ends. Skips are limited and reset your streak.
- Reusing an answer you already gave this run scores half.
- **No rude words.** Type a swear word or slur as an answer and the run is over: the rocket flips nose-down and speeds up all the way into the Earth (boom), or the submarine turns round and shoots back up out of the sea. You score 0 and no best is saved. Real answers are never treated as rude, so "Blue tit" for a bird, "Ass" for an animal or "Moby Dick" for a book all count as normal.
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
| `js/data.js` | The topic format, the original six topics, and the stops for each journey (`MILESTONES` for Rocket, `DEPTHS` for Submarine) |
| `js/topics-everyday.js`, `js/topics-mixed.js`, `js/topics-expert.js`, `js/topics-more.js` | The other topics with their answers and rarity tiers |
| `js/topics-years.js` | Topics whose answers carry years, for year questions (`Toy Story @1995`) |
| `js/questions.js` | Picks topic, letter and year questions and checks answers |
| `js/scene.js` | The Rocket world: sky, ground, planets, decorations, rocket, particles |
| `js/subscene.js` | The Submarine world: ocean zones, sea life, wrecks, the trench, rock, mantle and core |
| `js/badwords.js` | The rude-word check (lists are ROT13-encoded; only runs after an answer is rejected) |
| `js/game.js` | Game flow, scoring, HUD, popups and screens for both ways to play |
| `js/audio.js` | Synthesized sound effects (no audio files) |

To change how rare an answer is, move it to a different tier line in its topic. To add a topic, copy any `topic({...})` block. To rename a mode, edit `MODES` in `js/game.js` and its card in `index.html`.
