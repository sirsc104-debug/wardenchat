# Kingdom Clash

A real-time card battler for desktop browsers (built for school Chromebooks). Two players each defend two Archer Towers and a King Tower; you play troops and spells from a hand of four, paying with Energy that refills over time, and knock down towers for crowns.

The Training Grounds have three trainers, played in order: **Trainer Owen** (the tutorial, built to lose), **Trainer Romeo** (mid tier) and **Trainer Luc** (hard). Beating all three unlocks the Trophy Road. The lobby is built as the full game's lobby, with the parts that don't exist yet (wallet, Kingdom Pass, chests, Shop, clans, events) shown in their locked or coming states. After the trainers comes the **Trophy Road**: trophy battles against bots in Arena 1 (Cinder Keep), road rewards, chests, two new cards (Skeleton Pack and Cannon) and card levels up to 15. The SirSC wallet, evolutions and online 1v1 come later.

Plain HTML, CSS and JavaScript with no build step and no dependencies. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

## Screens

| Screen | What's on it |
| --- | --- |
| Lobby | A top bar (your name, level and experience, coins and diamonds with + buttons, sound, settings with name and sound), the tab, and a bottom navigation bar (Shop · Cards · **Battle** · Clan · Trophy Road; keys `1`–`5`; switching tabs slides the screen toward the button you picked, and a gold-trimmed highlight glides behind the selected tab). The Battle tab is built around the Training Grounds centerpiece (`img/training-grounds.webp`, transparent): its empty bar is filled live from your progress ("1 / 3 Trainers Defeated", turning green at 3/3). Under it: the opponent ("Next Opponent: Trainer Romeo", or "Trophy Road Unlocked!"; **Trainers** opens a panel of all three with portraits, status and records, to pick a rematch), the **Battle** button (`Enter`) and four chest slots (locked until the Trophy Road; the slots also support empty, chest, unlocking and ready states). On wide screens, stone plaques at the sides show the Kingdom Pass, what's coming up and the Training Grounds rewards. Everything fits a 1280×720 or larger screen without scrolling; under 1080 px wide the side plaques go; under 760 px the lobby scrolls with the navigation fixed at the bottom. |
| Cards | Your 8-card Battle Deck in one row with the average energy cost, and the Card Collection grid (name, rarity, level, energy, *In deck*). Click any card for its details: stats, description and its evolution. |
| Battle | Five columns, following the desktop layout concept: the Royal Grandstands (King statue, stands, banners, torches) · your 4 cards and the next one · the arena · the Energy bar · the Royal Waterfall with the timer and crown score over its sky. The spectators in both stands are animated and react to the match. Below 1000 px wide the scenery is dropped and the clock moves onto the arena. |
| Result | Victory / Defeat / Draw, both sides' crowns, the trainer's comment, anything you unlocked (next trainer, Trophy Road, a new level), why it ended and the experience earned, then **Battle *next trainer*** (after a first win), **Play Again** or **Home**. |

## How a match works

- **Energy**: start with 5, max 10, +1 every 2.8 seconds; double speed in the last minute and in overtime.
- **Deploying**: drag a card onto the arena, or press `1`–`4` and click. Troops go on your side of the river; once an enemy Archer Tower falls you can also deploy in that lane on their side, up to 4 tiles past the river. Fireball goes anywhere. `Esc` cancels.
- **Hand**: 4 cards plus the next one shown below; a played card goes to the back of the queue.
- **Towers**: Archer Towers (1,400 HP) shoot from the start; the King Tower (2,400 HP) sleeps until it is hit or one of its Archer Towers falls.
- **Winning**: an Archer Tower is 1 crown, the King Tower is all 3 and ends the match. After 3:00 the side with more crowns wins; if tied, 1:00 of overtime where the next tower wins; if still tied, the side whose weakest tower has more health wins.

## Arena art (js/arenas.js)

Every arena's images are listed in one place, `js/arenas.js`: the lobby **centerpiece** (with where its empty progress bar sits), the two battle **scenery** panels (with the rows the animated spectators sit on and where the lights are), and the playable **battlefield**. Nothing else names an arena image.

| Arena | Centerpiece | Left scenery | Right scenery | Battlefield |
| --- | --- | --- | --- | --- |
| Training Grounds | `training-grounds.webp` | `grounds-left.webp` | `grounds-right.webp` | drawn in code (grass, water, wooden bridges) |
| Cinder Keep | `cinder_keep_volcanic_arena_badge.webp` | `cinder_keep_volcanic_grandstand.webp` | `cinder_keep_lavafall_arena.webp` | `cinder_keep_molten_battle_arena.webp` |

A battlefield image is only art under the live game; the 18 × 32 tile simulation never changes. It is laid under the grid by anchor pairs (image pixel → tile), stretched piecewise so the tower pads sit under the Archer Towers (tiles 6.5 and 25.5), the lava edges on the river (tiles 15 and 17) and the bridges on the lanes (3.5 and 14.5). Cinder Keep's border is 1.4 tiles instead of 0.6 so its battlements and corner braziers show. If an image fails to load, the battlefield falls back to the drawn palette, the scenery to a plain gradient (the crowd still plays) and the lobby to the arena's name on a plaque. The bundler bakes every image into the single-page build.

## The Trophy Road and Arena 1

Rules live in `js/progress.js` (no screen code; tested by `tools/progress-test.js`).

- **Opening it**: beat Owen, Romeo and Luc. The Battle button then plays trophy battles in **Arena 1: Cinder Keep** (trainers can still be replayed from the Trainers panel, for no trophies).
- **Trophies**: a win is +30, a loss is −20, never below the arena's floor (0 in Arena 1). Arena 2 is at 300 trophies and is marked *coming soon*.
- **Opponents**: computer players with ordinary player names and portraits (nothing in the game labels them). They don't talk: no speech bubbles and no line on the result screen (trainers still do). Their **cards level up one at a time with their trophies**: all level 1 below 50 trophies; at 50 one card is level 2, and another card goes up every 12.5 trophies (two at about 60, all eight level 2 by about 140), then the first level 3 at 150, and so on, a full level per 100 trophies, until every card is level 15 at about 1,440. Which cards are ahead differs from opponent to opponent, and levels show on their units' health bars. Their skill follows your results: a step harder after a win, a step easier after a loss. In the headless test (150 matches), a good player who kept their cards level with their trophies won 51% once settled and a sloppy one 52%; a good player who never upgraded won 42% and slid back to about 300 trophies with the opponents near their easiest.
- **Road rewards** (claimed on the Trophy Road tab): 20 trophies 50 coins · 40 **Skeleton Pack** ×6 · 60 Silver Chest · 90 100 coins · 120 **Cannon** ×4 · 160 Silver Chest · 200 200 coins · 250 Gold Chest · 300 Arena 2 (coming soon).
- **Chests**: a trophy win puts a chest in the first free slot (four slots), in a fixed repeating order (wooden, wooden, silver, wooden, silver, wooden, wooden, gold, wooden, silver). Its contents are decided when it is won. One chest unlocks at a time on a real-time timer (wooden 1 minute, silver 15 minutes, gold 1 hour), then opens with coins and copies of cards you have found. Skipping a timer with diamonds will come with the SirSC wallet.
- **Card levels**: copies plus coins level a card up, to 15 at most. Commons need 2, 4, 10, 20, 40… copies; rares 1, 2, 4, 8, 15…; coins 5, 20, 50, 150, 400… Each level adds 8% health and damage. Units in battle show their level on their health bar.
- **Arena cards stay in Arena 1**: Skeleton Pack and Cannon are only found on the Trophy Road. Trainers never use them, and in a Training Grounds match your deck goes back to the eight starter cards (each Arena 1 card swaps for a starter card you left out).
- **Coins** are kept on this device for now and move to the SirSC wallet when it is connected. Diamonds show "–" until then.
- **Arena 1 art**: Cinder Keep has its own four illustrations: the lobby badge, the volcanic grandstand (left) and the lavafall (right) battle scenery, and the molten battlefield itself (dark stone, lava river, reinforced bridges, corner braziers), with ember, lava-glow, heat-shimmer and fiery-explosion effects on top.

| New card | Energy | Rarity | What it does |
| --- | --- | --- | --- |
| Skeleton Pack | 1 | Common | Three skeletons (40 HP, 40 damage each), fast, ground only |
| Cannon | 3 | Common | A building: 700 HP, 70 damage every 0.9 s at ground troops within 5.5 tiles, lasts 30 seconds. Rhinos go for it before towers. |

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

## The trainers

Defined in `js/trainers.js` (name, tier, bot skill, how hard their troops hit your towers, portrait, what they say). Every trainer plays the starter deck with the same rules and information a player has (`js/bot.js`); they differ in how fast they react, how long they wait between cards, how well they defend and place cards, and how hard their troops hit your towers.

| Trainer | Tier | Bot | Tower damage | Over 60–80 test matches, the trainer won against… |
| --- | --- | --- | --- | --- |
| Owen | Tutorial | reacts 2.6–4.2 s late, 4–7 s between cards, barely defends, no Fireball | 25% | a good player 0%, a sloppy player 0%, a random clicker 2% |
| Romeo | Mid tier | reacts 1.7–2.9 s, 2–3.4 s between cards, defends about half of pushes | 45% | a good player 22%, a sloppy player 18%, a random clicker 63% |
| Luc | Hard | reacts 1.4–2.5 s, 1.7–2.9 s between cards, defends most pushes, fireballs clumps | 60% | a good player 48%, a sloppy player 40%, a random clicker 88% |

`node tools/trainers-test.js 100` reruns those numbers (add `romeo` or `luc` to test one trainer). Any trainer beats a player who never plays a card.

Progress is saved in this browser: which trainers you have beaten, your record against each, your name and your account experience (a win is 20 XP, a draw 10, a loss 6, plus 30 for the first win against each trainer; 100 XP per level). Losing to a trainer costs nothing; you can replay any trainer you have unlocked from the opponent picker or the path.

## Files

| File | What it does |
| --- | --- |
| `js/cards.js` | The 8 cards and the starter deck |
| `js/trainers.js` | Owen, Romeo and Luc |
| `js/arenas.js` | Arena art: each arena's centerpiece, scenery panels (with crowd rows and lights) and battlefield image with its tile mapping; loads each image once |
| `js/progress.js` | Progress and its rules: trainers, trophies, bots, chests, road rewards, card levels, the deck |
| `js/menu.js` | The lobby, the Cards screen (deck, collection, upgrades), chest opening, the Trophy Road tab |
| `js/sim.js` | The battle: fixed 30 steps a second, no DOM, seeded, so it runs the same in the page, in Node and later on both ends of an online match |
| `js/bot.js` | The trainers' AI (one bot with a skill setting per trainer) |
| `js/art.js` | Every troop, tower, card portrait and the arena, drawn in code. Each troop and tower has two views: your side is seen from behind (facing up the arena, toward the enemy) and the enemy faces you; cards use the front view |
| `js/scenery.js` | The Training Grounds side panels. Each draws its illustrated background (`img/grounds-left.webp`, `img/grounds-right.webp`) once into a cache cropped to cover the panel, then each frame the animated spectators seated on the illustrated benches (team-coloured outfits, flags; they jump for the side that takes a tower, celebrate the winner and slump if their side lost), torch glow, embers, twinkling stars and waterfall mist. Bench positions are in `LAYOUT`, in image coordinates |
| `js/audio.js` | Sound effects made with Web Audio (no sound files) |
| `js/game.js` | Screens, the game loop, drawing the battle, input |
| `tools/path-test.js` | `node tools/path-test.js` places every ground troop behind and beside each tower, for both teams, and checks it walks around instead of getting stuck |
| `tools/trainers-test.js` | `node tools/trainers-test.js 100 [trainer]` plays each trainer against a good player, a sloppy player, a random clicker and a player who does nothing, and prints how often the trainer wins |
| `tools/cards-test.js` | `node tools/cards-test.js` checks the Cannon (pulls a Rhino, lasts 30 s, placement rules), the Skeleton Pack and card levels |
| `tools/progress-test.js` | `node tools/progress-test.js [matches]` checks old saves, trophies, chests and timers, road rewards, upgrades, the deck and the Training Grounds deck rule, then plays trophy matches to check the 52% target |
| `tools/sim-test.js` | `node tools/sim-test.js 40` plays 40 bot-vs-bot matches headless and checks they end cleanly (no NaNs, no troops in the river) |
| `img/` | Arena art (see *Arena art*): the Training Grounds and Cinder Keep centerpieces (transparent), scenery panels (793 × 1983) and the Cinder Keep battlefield (1024 × 1536) |
| `build-artifact.py` | Bundles everything into one page, with the images baked in as data URIs: `python3 build-artifact.py OUT.html` (claude.ai Artifact) or `--standalone` (a complete page) |

Built copies are in `dist/`: `kingdom-clash.html` (Artifact bundle) and `kingdom-clash-standalone.html` (open anywhere, works offline apart from the Google font, which falls back to a system font).

The game saves your progress (trainers beaten, records, name, experience) and the sound setting in the browser's local storage only.
