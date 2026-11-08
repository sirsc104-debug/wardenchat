# Kingdom Clash

A real-time card battler for desktop browsers (built for school Chromebooks). Two players each defend two Archer Towers and a King Tower; you play troops and spells from a hand of four, paying with Energy that refills over time, and knock down towers for crowns.

This first version has one opponent, **Trainer Owen**, a gentle computer player. Wallet, trophies, chests, upgrades, evolutions and online 1v1 come later.

Plain HTML, CSS and JavaScript with no build step and no dependencies. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

## Screens

| Screen | What's on it |
| --- | --- |
| Home | The Kingdom Clash logo, Trainer Owen with a **Battle** button and your record against him, your 8-card deck (click a card for its stats), how to play, and a sound toggle. |
| Battle | Five columns, following the desktop layout concept: arena scenery (statue, crowd, banners, torches) · your 4 cards and the next one · the arena · the Energy bar · the timer, crown score and more scenery (waterfall). Below 1000 px wide the scenery is dropped and the clock moves onto the arena. |
| Result | Victory / Defeat / Draw, both sides' crowns, why it ended, and **Play Again** or **Home**. |

## How a match works

- **Energy**: start with 5, max 10, +1 every 2.8 seconds; double speed in the last minute and in overtime.
- **Deploying**: drag a card onto the arena, or press `1`–`4` and click. Troops go on your side of the river; once an enemy Archer Tower falls you can also deploy in that lane on their side, up to 4 tiles past the river. Fireball goes anywhere. `Esc` cancels.
- **Hand**: 4 cards plus the next one shown below; a played card goes to the back of the queue.
- **Towers**: Archer Towers (1,400 HP) shoot from the start; the King Tower (2,400 HP) sleeps until it is hit or one of its Archer Towers falls.
- **Winning**: an Archer Tower is 1 crown, the King Tower is all 3 and ends the match. After 3:00 the side with more crowns wins; if tied, 1:00 of overtime where the next tower wins; if still tied, the side whose weakest tower has more health wins.

## The starter deck (level 1)

| Card | Energy | Role | Notes |
| --- | --- | --- | --- |
| Rhino | 5 | Tank | 2,000 HP, only attacks towers, can't be knocked back |
| Wolves | 2 | Swarm ×4 | Very fast, 80 HP each |
| Gladiator | 3 | Mini tank | 900 HP |
| Hawks | 3 | Air ×2 | Fly over the river; ground melee troops can't hit them |
| Archers | 3 | Ranged ×2 | Range 4.5, hit air and ground |
| Snowman | 4 | Splash | Range 5.5, snowballs hit everything they land near |
| Gorilla | 4 | Tank killer | 300 damage a hit |
| Fireball | 4 | Spell | 320 damage in a 2.5-tile circle (30% to towers), knocks back light troops |

Every level adds 8% to HP and damage. Stats live in `js/cards.js`; tower stats, timings and energy are at the top of `js/sim.js`.

## Trainer Owen

`js/bot.js` plays with the same rules and information a player has: its own hand and energy and the troops on the field. It fireballs clumps, defends the lane under the most pressure with a fitting counter (Gorilla or Wolves for a Rhino, Archers or Snowman for air, Snowman for swarms), backs up its own Rhino pushes and starts a push when its energy is nearly full. The `trainer` skill reacts slowly (1.8 to 3.2 seconds), misplaces about half its cards slightly, under-defends and sometimes sits on full energy; in headless tests a `normal` bot beats it about 3 to 1. The bot can play either side, which is what the tests use.

## Files

| File | What it does |
| --- | --- |
| `js/cards.js` | The 8 cards and the starter deck |
| `js/sim.js` | The battle: fixed 30 steps a second, no DOM, seeded, so it runs the same in the page, in Node and later on both ends of an online match |
| `js/bot.js` | Trainer Owen |
| `js/art.js` | Every troop, tower, card portrait and the arena, drawn in code. Each troop and tower has two views: your side is seen from behind (facing up the arena, toward the enemy) and the enemy faces you; cards use the front view |
| `js/scenery.js` | The animated scenery panels; the crowd cheers when a tower falls |
| `js/audio.js` | Sound effects made with Web Audio (no sound files) |
| `js/game.js` | Screens, the game loop, drawing the battle, input |
| `tools/path-test.js` | `node tools/path-test.js` places every ground troop behind and beside each tower, for both teams, and checks it walks around instead of getting stuck |
| `tools/sim-test.js` | `node tools/sim-test.js 40` plays 40 bot-vs-bot matches headless and checks they end cleanly (no NaNs, no troops in the river) |
| `build-artifact.py` | Bundles everything into one page: `python3 build-artifact.py OUT.html` (claude.ai Artifact) or `--standalone` (a complete page) |

Built copies are in `dist/`: `kingdom-clash.html` (Artifact bundle) and `kingdom-clash-standalone.html` (open anywhere, works offline apart from the Google font, which falls back to a system font).

The only thing the game saves is your win/loss record against Owen and the sound setting, in the browser's local storage.
