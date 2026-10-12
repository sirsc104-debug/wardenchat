# SirSC's Apples to Oranges

A number game where the two numbers have nothing to do with each other: a blue whale's weight against Jersey Mike's locations in New Jersey. Four ways to play, each with its own vehicle, world and music, picked from a tab bar on the home screen.

Plain HTML, CSS and JavaScript with no build step. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`. Like Brain Rocket, it's a 1600×900 layout that stretches to fill the window, and phones play it sideways.

## Picking a mode

The home screen keeps the logo, tagline and tab bar in the same place in every mode. Switching tabs works like Brain Rocket's: the yellow highlight glides to the new tab while the world slides across in the same direction (the old picture is captured and pushed out one side as the new world comes in from the other), and the rules box blurs, changes its text while blurred, then sharpens. The tagline, the four difficulty cards and their best scores change to the new mode. The game remembers your last tab, and on the title screen ← and → switch tabs too.

| Tab | Vehicle | The question |
| --- | --- | --- |
| 🎈 **Classic** | A hot-air balloon, up through the sky | Is the number on the right higher or lower? |
| 🐉 **Real Size** | A dragon, up from a castle valley | Same kind of thing, different units: which is really bigger? |
| 🐿️ **Guess the Number** | A squirrel, up a tree that never ends | What's the hidden number? |
| 🎃 **Halloween** (limited time) | A jack-o'-lantern balloon, sideways, chased by a ghost | Higher or lower, before the ghost catches you |

Every mode has Owen (Easy), Medium (×1.5 points), Hard (×2) and Ultra (×2.5), and its own best score for each.

## 🎈 Classic

- **Two cards.** The left card shows its number; the right card shows what it counts and the unit, but the number is hidden. Pick **▲ Higher** or **▼ Lower** (or ↑/↓). The hidden number counts up, the right card slides over to the left, and a new card comes in.
- **Totally unrelated.** Two facts from the same category never meet. The one exception is years: Toy Story against the first Pokémon games is a fair fight.
- **Difficulty is closeness**, the bigger number divided by the smaller:

| | Time per pick | Lives | Numbers |
| --- | --- | --- | --- |
| Owen | 15 s | 3 | 1.6× to 8× apart |
| Medium | 10 s | 2 | 1.25× to 5× apart |
| Hard | 7 s | 1 | 1.05× to 4× apart |
| Ultra | 5 s | 1 | Always within 10 of each other |

- **Ultra** is every matchup 1 to 10 apart (Wayne Gretzky's 99 against 100 US senators, 1886 against 1889). Both numbers must be exact, or a measurement converted from an exact fact (rounding can make two numbers look equal but never changes which is bigger). No ties, and every card that comes up has another close partner waiting, so the chain never runs dry.
- **Closer calls score more:** Common 10 (10× apart or more), Uncommon 25 (3–10×), Rare 50 (1.5–3×), Epic 100 (closer), Legendary 200 (photo finish).
- **📸 Photo finish.** Now and then the two numbers tie or are a few apart: 168 hours in a week against 169 towns in Connecticut. The reveal crawls the last few numbers one at a time with a drum roll. A tie counts as right whichever way you pick.
- **Streaks** add ×0.25 a step, up to ×5. **Speed:** the first quarter of the timer gives ×2, the first half ×1.5.
- **Altitude** goes up 40 to 200 m per right answer by how close it was, plus 8% for each answer in your streak (up to +80%). Stops: Treetops, Rooftops, Kite Height, the Birds, Burj Khalifa Height, the Clouds, the Mountain Peaks, Mount Everest, the Jet Planes, the Stratosphere, the Balloon World Record (21,027 m), the Weather Balloons and the Edge of Space.

## 🐉 Real Size: the dragon ride

- Both cards measure the same kind of thing (two heights, two weights, two speeds, two temperatures, two lengths of time or two amounts of liquid) in **different units**. Pick **▲ Bigger** or **▼ Smaller**: is the right one *actually* bigger? 555 feet looks bigger than 330 meters, but it isn't.
- After the number counts up, a tag converts it into the left card's unit ("= 169 meters"), and the result says why, in words that fit: "…is longer than", "…is heavier than", "…is hotter than", "…holds more than".
- **🪤 Traps** are matchups where the smaller thing has the bigger number. A right answer on a trap pays ×1.5.

| | Time per pick | Lives (🔥) | Real sizes | Traps |
| --- | --- | --- | --- | --- |
| Owen | 15 s | 3 | 2× apart or more | about 1 in 3 |
| Medium | 10 s | 2 | 1.4× to 4× | about half |
| Hard | 7 s | 1 | 1.1× to 2× | about 3 in 5 |
| Ultra | 5 s | 1 | within 10% | over half |

- Scoring goes by how close the real sizes are; within 10% is Legendary. A right answer makes the dragon breathe fire and climb; a wrong one makes it sneeze smoke and dip.
- Stops: the Village Rooftops, the Castle Towers, the Waterfall Cliffs, the Mountain Pass, the Floating Islands, the Clouds, the Sky Castle, Above the Storm, the Dragon's Peak, the Northern Lights and the Stars. On the way: floating islands with waterfalls, storm clouds with lightning, a castle in the clouds and the northern lights.

## 🐿️ Guess the Number: the endless tree

- One card at a time. The number is hidden; guess it.
  - **Owen:** pick from four answers (keys 1–4). The wrong ones are at least a quarter away.
  - **Medium:** a slider. Its ends never give the answer away (it's never in the middle), and it works on a "times" scale for big numbers.
  - **Hard:** type the number.
  - **Ultra:** type the number; only within 5% counts.
- **How close:** within 1% is a 🎯 **Bullseye** (200, and the squirrel finds a golden acorn), within 5% 100, 10% 50, 25% 25, 50% 10. Years count in years off (exact, 1, 3, 5, 10). On Owen a right pick is worth 100.
- **🌰 Acorns are lives:** 3 on Owen, 2 on Medium, 1 on Hard and Ultra. A guess more than 50% off, or running out of time (20 s, 15 s on Ultra), drops an acorn.
- After each guess a track shows where your guess landed next to the answer. Any fact can come up, in any of its units.
- Stops: the Bird Feeder, the First Branch, the Owl's Hollow, the Woodpecker's Door, Above the Forest, the Autumn Leaves, Into the Fog, the Cloud Branches, the Sky Nest, the Jet Stream and the Edge of Space, and the tree keeps going. Leaves turn from green to autumn colours to frost the higher you climb.

## 🎃 Halloween: the jack-o'-lantern balloon (limited time)

Follows Brain Rocket's Haunted Flight. The jack-o'-lantern balloon flies right across a Halloween night with a ghost coming from behind, and the cards run along the bottom so the chase gets the whole width.

- **No timer and no lives:** you survive until the ghost catches you, and your result is how far you flew.
- **The chase.** You start 60 m ahead. While a matchup is up, the ghost closes in at 2.5 m/s, speeding up 0.9 m/s every minute, and the balloon flies 12 m a second. A right answer pushes you ahead by how close it was (Common +8 m up to Legendary +77 m, times the difficulty and your streak), up to 150 m ahead.
- **Wrong answers:** the ghost lunges closer: 15 m on Owen, 20 on Medium, 25 on Hard, 30 on Ultra. There are no skips.
- **The danger shows.** The "Ghost behind" readout and the bar under the cards go green, orange, then red. Inside 40 m the night darkens, the ghost's eyes glow, its hands reach for the basket, a heartbeat speeds up and the music fades. A right answer under 10 m is a 😱 close escape; a Legendary answer blasts the ghost into wisps.
- **Caught:** the ghost wraps around the balloon and the candle inside goes out. The results show distance, survival time, right answers and your closest escape.
- **Fair:** the chase freezes while an answer plays out, and you get one pause per run (switching away from the tab always pauses).
- **Ultra:** matchups within 10, the chase never freezes, and every 8 to 13 seconds the ghost lunges 10 m after a 1.5-second red-eyed warning. A right answer during the warning dodges it (🛡️).
- **Halloween facts.** Every matchup puts one of 115 Halloween facts (candy, spooky movies, monsters and myths, spooky shows and games, pumpkins and haunts, creepy critters) against a regular fact. They never come up in the other modes.
- Stops along the way: the Pumpkin Patch, the Corn Maze, the Graveyard, the Dark Forest, the Witch's Hollow, the Bat Caves, the Haunted Mansion, the Blood Moon, the Spirit Realm and Beyond the Veil. The tab has a **LIMITED TIME** badge that fades from orange into a sliding rainbow.
- **The event ends on its own:** once November 1, 2026 is over (midnight in the player's time zone), the tab disappears and anyone who last played it lands on Classic. Change `HAUNT_ENDS` in `js/game.js` to move the date.

## Music and sound

Every mode has its own loop, made on the fly with Web Audio like Brain Rocket's (no music files): **Breeze** (a ukulele strum) and **Sky** (floaty pads above 5,000 m) for Classic, an adventure theme with harp, timpani and a horn for the dragon, a skippy plucked tune with a woodblock and flute for the squirrel, and a spooky E-minor loop (music box, organ, bells and a wobbly theremin) for Halloween. The music follows the tab you've chosen, starts on the first click or key press, drops back for drum rolls and the ghost's heartbeat, and goes quieter while paused. **🎵** on the home screen or in the pause menu turns it off; **🔊** mutes everything.

## The facts

There are 657 facts in 26 categories, making 1,633 cards once every measurement is shown in its other units.

| File | Facts |
| --- | --- |
| `js/facts.js` | The first 189: animals, the body, food, games, movies, places, space, sports, years and more |
| `js/facts-close.js` | 240 that sit close together (Pokédex and jersey numbers, famous numbers, game rules, sports clocks, years): Ultra's main supply |
| `js/facts-more.js` | 113 more, mostly measurements (buildings, mountains, animals, speeds, temperatures, how long things last): Real Size's main supply |
| `js/facts-halloween.js` | 115 Halloween facts, only for the Halloween event |

**Same question, different units.** Every measurement comes up in every unit that reads sensibly: the Empire State Building is 1,454 feet, but also 443 meters, 44,318 centimeters, 485 yards or 0.28 miles. Converted numbers are rounded to what the card shows (approximate facts to three significant figures) and the game judges the numbers as shown.

**Accuracy matters more here than in a normal quiz.** The number is the whole question.

- **Never put the number in the question.** "The number of Route 66" answers itself.
- `x: 1` marks a fact as exact and unchanging. Only exact facts meet in photo finishes and Ultra.
- Approximate facts say so ("About", "As of 2025") and only meet numbers at least 10% away.
- `src` records where a number came from when it was looked up.

Checked online: Big Mac 580 calories, Jersey Mike's about 145 New Jersey locations (2025), blue whales up to about 330,000 lb (NOAA), a can of Coke (140 calories, 39 g sugar), Krispy Kreme Original Glazed (about 190 calories), Minnesota's 11,842 lakes (DNR), the 2023 record pumpkin (2,749 lb), the most lit jack-o'-lanterns (30,581, Keene, 2013), the Tower of Terror (199 ft) and the Parker Solar Probe (about 430,000 mph). Everything else is written from memory, so **read through the list** before sharing it widely.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The screens: home with the mode picker, game, pause, results |
| `css/style.css` | Styles in Brain Rocket's look, the tab bar and its glider, the Guess the Number box and the Halloween strip |
| `js/facts*.js` | The facts (above) |
| `js/cards.js` | Turns facts into cards (each measurement in its other units) and knows each one's real size |
| `js/pairs.js` | Picks matchups for every mode: difficulty bands, Ultra's within-10 chains, photo finishes, Real Size traps, Guess the Number choices, slider and scoring |
| `js/scene.js` | The four worlds on a canvas, and the slide between them |
| `js/audio.js` | Sound effects and the music loops |
| `js/game.js` | The mode picker, every mode's rounds and reveals, the Halloween chase, scoring, results and sharing |
| `build-artifact.py` | Bundles everything into one page for publishing as an Artifact |

`python3 build-artifact.py OUT.html` makes that page: the CSS and every script inlined, without the `<html>`/`<head>`/`<body>` tags the Artifact host adds. In an Artifact, **📋 Share** copies the results.

## Easter egg

Every so often, the rocket from Brain Rocket launches up through the sky behind Classic, Real Size and Guess the Number, with the little pilot in its window. It always shows up when you get 10 in a row.

## Not built yet

A daily mode with a share grid, a local Madison/DHHS fact pack, and racing friends through Warden Chat.
