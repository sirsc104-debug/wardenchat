# SirSC's Apples to Oranges

A number game where the two numbers have nothing to do with each other: a blue whale's weight against Jersey Mike's locations in New Jersey. Four ways to play, each with its own vehicle, world and music, picked from a tab bar on the home screen, including **🏃 Fruit Dash**, a 60-second race against your friends where every player is a different fruit. Sign in with your **Warden Chat** account to keep your best scores on every device and to race.

Plain HTML, CSS and JavaScript with no build step. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`. Like Brain Rocket, it's a 1600×900 layout that stretches to fill the window, and phones play it sideways.

## The intro

Every visit starts with the SirSC104 producer tag from `sirsc-intro-eyes.html`: two glowing eyes in the dark and **PRESS ANY KEY** (**TAP TO START** on phones). The press is always needed, even when the browser would let sound play on its own, so the signature's sound and the game's music always start together. Then the pen draws the logo, it stamps down, "SirSC104" writes in, and it fades into the game; the music starts as it ends. A press during the signature skips it, and the game can't be clicked until it's gone. The intro is the `<script id="sirsc104-intro">` block at the top of `index.html`'s `<body>`; the one change from the original is that its start screen always shows.

## Picking a mode

The home screen keeps the logo, tagline and tab bar in the same place in every mode. Switching tabs works like Brain Rocket's: the yellow highlight glides to the new tab while the world slides across in the same direction (the old picture is captured and pushed out one side as the new world comes in from the other), and the rules box blurs, changes its text while blurred, then sharpens. The tagline, the four difficulty cards and their best scores change to the new mode. The game remembers your last tab, and on the title screen ← and → switch tabs too. Going home or hitting **↻ Play again** both take you back to the start the same way: the world glides back down to the ground (on Halloween the night scrolls back and the ghost drops back), and with Play again the new run starts as it goes.

| Tab | Vehicle | The question |
| --- | --- | --- |
| 🎈 **Classic** | A hot-air balloon, up through the sky | Is the number on the right higher or lower? |
| 🐿️ **Guess the Number** | A squirrel, up a tree that never ends | What's the hidden number? |
| 🏃 **Fruit Dash** (new) | A running fruit, across a giant kitchen | Classic's higher or lower, as many as you can in 60 seconds, racing friends live |
| 🎃 **Halloween** (limited time) | A jack-o'-lantern balloon, sideways, chased by a ghost | Higher or lower, before the ghost catches you |

Every mode has Owen (Easy) 🧒, Medium (×1.25 points), Hard (×1.5) and Ultra (×1.75) 💀, and its own best score for each. Medium and Hard wear each mode's own emoji: 🍎 and 🍊 in Classic, 🌰 and 🐿️ in Guess the Number, 🍓 and 🍉 in Fruit Dash, 🎃 and 👻 on Halloween.

**🐉 Real Size** (the dragon ride, two lengths in centimeters) has left the menu to make room for Fruit Dash. Its code, map, music and bests are all still there; adding `'size'` back to `TYPE_ORDER` in `js/game.js` and its tab to `index.html` brings it back. (On Halloween a right answer also pushes the ghost back harder on the higher difficulties: ×1.5 on Medium, ×2 on Hard, ×2.5 on Ultra.)

## 🎈 Classic

- **The first question.** In a brand-new browser (nothing saved yet), the very first Classic question is the one the game is built around: Jersey Mike's locations in New Jersey against a blue whale's weight in tons.
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
- **📸 Photo finish.** Any matchup within 5 of each other or within 3% is always a photo finish (and Legendary): 168 hours in a week against 169 towns in Connecticut. Only trustworthy numbers (exact facts, or measurements converted from them) ever meet that close, and only two exact facts can tie. The reveal crawls the last few numbers one at a time with a drum roll. On an exact tie, ▲ Higher and ▼ Lower are both wrong: only Tie! is right.
- **Tie!** (or T / =) is a third button, here and in Fruit Dash and Halloween, that **only appears when the two numbers are within 5% of each other or within 10**; the rest of the time it's hidden. It's **only right on an exact tie**, and on an exact tie ▲ Higher and ▼ Lower are both wrong. On a close pair that isn't an exact tie, Tie! is wrong and Higher or Lower is judged as usual. Calling a tie right sets off the biggest celebration in the game: a rainbow **TIE CALLED!** banner, a fanfare, flashes and confetti from the sky and the balloon.
- **Streaks** add ×0.25 a step, up to ×5. **Speed:** the first quarter of the timer gives ×2, the first half ×1.5.
- **The balloon is fruit.** Each time the page loads it's an apple or an orange, 50/50, and 1 apple in 20 has a worm poking out of its side. (Add `?fruit=apple`, `?fruit=orange` or `?fruit=worm` to the address to pick one when testing.)
- **Your score is your height:** the balloon rises along Classic's map, from the Orchard to the Edge of Space (see **The maps**).

## 🐿️ Guess the Number: the endless tree

- One card at a time. The number is hidden; guess it.
  - **Owen:** pick from four answers (keys 1–4). The wrong ones are at least a quarter away.
  - **Medium:** a slider. Its ends never give the answer away (it's never in the middle), and it works on a "times" scale for big numbers.
  - **Hard:** type the number.
  - **Ultra:** type the number; only within 5% counts.
- **How close:** within 1% is a 🎯 **Bullseye** (200, and the squirrel finds a golden acorn), within 5% 100, 10% 50, 25% 25, 50% 10. Years count in years off (exact, 1, 3, 5, 10). On Owen a right pick is worth 100.
- **🌰 Acorns are lives:** 3 on Owen, 2 on Medium, 1 on Hard and Ultra. A guess more than 50% off, or running out of time (20 s, 15 s on Ultra), drops an acorn.
- After each guess a track shows where your guess landed next to the answer. Any fact can come up, in any of its units.
- Your score climbs the squirrel up its map, from the Roots to the Moon Acorn, and the tree keeps going. What grows on the trunk changes with the location (bird feeders, owls, a woodpecker, flower boxes, lanterns, a squirrel village, a giant egg, icicles, a satellite dish), and the leaves turn from green to autumn colours, pale cloud leaves, frost, then violet.

## 🏃 Fruit Dash: the kitchen race

- **60 seconds of Classic.** The same higher or lower, Tie! and photo finishes as Classic, against one clock instead of a timer per pick. **No lives:** a wrong answer (or a wrong Tie!) just trips your fruit over and ends your streak. Reveals are quicker, so you can fit in more.
- **Speed pays.** Answer within 1.5 seconds for ×2, within 3 for ×1.5. Streaks add ×0.25 a step up to ×5, and the difficulty multiplies as everywhere else.
- **Every player is a different fruit:** 🍎 apple, 🍊 orange, 🍌 banana, 🍓 strawberry, 🍉 watermelon, 🍍 pineapple, 🍇 grapes or 🍋 lemon, each drawn with little running legs and a face. A right answer gives your fruit a burst of speed with speed lines; a wrong one makes it stumble with dizzy stars.
- **The kitchen.** Your score is how far along the counter you've run, on Fruit Dash's map of 20 kitchen locations (the Fruit Bowl, the Toaster, the Kitchen Sink, the Cookie Jar… out to the Farmers' Market at 50,000), each with its own things on the back counter, its own wall tiles and a hanging sign. On the title screen the eight fruits run along the counter as the kitchen rolls by.
- **Practice solo** works for everyone, signed in or not: pick a difficulty and your fruit (the button next to "60-second dash") and go. Practice can be paused.
- **Race your friends live** (needs a Warden Chat account and the race server):
  - **Host a race** to get a 6-letter code. Tick friends to invite them as it's made, invite more from the lobby, or share the code. Up to 8 fruits.
  - **Join a race** with a code, or from an invite (invites pop up on the home screen and show as a red badge on the Fruit Dash tab).
  - **The lobby** shows everyone as their fruit. Pick any fruit nobody else has; you're given your favourite if it's free.
  - **The race:** everyone counts down 3, 2, 1, GO together on the server's clock and gets **the same matchups in the same order** (one shared seed). The other fruits run along their own lanes, a live board shows the top four (plus you), and rivals who are off the screen show as tags at its edge. No pausing in a live race.
  - **The results:** a podium of fruits, your place, right answers, best streak and photo finishes. **🔁 Play again** is a vote: when everyone still there says yes, the next round starts for all of you with new matchups.
- Your best score on each difficulty is kept, from races and practice alike.

## 🎃 Halloween: the jack-o'-lantern balloon (limited time)

Follows Brain Rocket's Haunted Flight. The jack-o'-lantern balloon flies right across a Halloween night with a ghost coming from behind, and the cards run along the bottom so the chase gets the whole width.

- **No timer and no lives:** you survive until the ghost catches you. You score 12 points for every second you stay ahead, plus the points for each right answer (no speed bonus), and your score takes you along the Halloween map.
- **The chase.** You start 60 m ahead. While a matchup is up, the ghost closes in at 2.5 m/s, speeding up 0.9 m/s every minute. The balloon flies 12 m a second the whole time. A right answer pushes you ahead by how close it was (Common +8 m up to Legendary +77 m, times the difficulty and your streak), up to 150 m ahead.
- **Wrong answers:** the ghost lunges closer: 25 m on Owen, 30 on Medium, 35 on Hard, 40 on Ultra. There are no skips.
- **The danger shows.** The "Ghost behind" readout and the bar under the cards go green, orange, then red. Inside 40 m the night darkens, the ghost's eyes glow, its hands reach for the basket, a heartbeat speeds up and the music fades. A right answer under 10 m is a 😱 close escape; a Legendary answer blasts the ghost into wisps.
- **Caught:** the ghost wraps around the balloon and the candle inside goes out. The results show your score, where you got to, survival time, right answers and your closest escape.
- **Fair:** while an answer plays out, the ghost keeps its distance. Nothing stops moving: the balloon flies on and the night keeps scrolling. You get one pause per run (switching away from the tab always pauses).
- **Ultra:** matchups within 10, the ghost never lets up, not even while an answer plays out, and every 8 to 13 seconds the ghost lunges 20 m after a 1.5-second red-eyed warning. A right answer during the warning dodges it (🛡️).
- **Halloween facts.** Every matchup puts one of 115 Halloween facts (candy, spooky movies, monsters and myths, spooky shows and games, pumpkins and haunts, creepy critters) against a regular fact. They never come up in the other modes.
- The tab has a **LIMITED TIME** badge that fades from orange into a sliding rainbow.
- **The event ends on its own:** once November 1, 2026 is over (midnight in the player's time zone), the tab disappears and anyone who last played it lands on Classic. Change `HAUNT_ENDS` in `js/game.js` to move the date. Fruit Dash's **New** badge goes away the same way once October 18, 2026 is over (`DASH_NEW_ENDS`).

## 🐉 Real Size: the dragon ride (retired from the menu)

- **Everything is in centimeters.** Both cards are a length (a height, a length or a distance) measured in cm, so there are no units to convert: pick **▲ Bigger** or **▼ Smaller**. A mountain or a road trip in centimeters gets huge, so read every digit.
- Real Size uses the 226 length facts. Weights, speeds, temperatures, times and volumes can't be shown in cm, so they only come up in the other modes.

| | Time per pick | Lives (🔥) | Sizes |
| --- | --- | --- | --- |
| Owen | 15 s | 3 | 2× apart or more |
| Medium | 10 s | 2 | 1.4× to 4× |
| Hard | 7 s | 1 | 1.1× to 2× |
| Ultra | 5 s | 1 | within 25% (as close as the facts allow) |

- Scoring goes by how close the two are; within 10% is Legendary, and the results count your close calls. A right answer makes the dragon breathe fire and climb; a wrong one makes it sneeze smoke and dip.
- Your score flies the dragon along its map, from the Dragon's Rock past castle flags, cliffs, floating islands, a sky castle, storms and a sunset to the Dragon Star.

## Accounts: sign in with Warden Chat

Like Brain Rocket, Apples to Oranges signs in with **Warden Chat** accounts (chat.sirsc104.com): the **Sign in** button sits next to the sound buttons on the home screen. Creating an account here creates a Warden Chat account (no email, so the password can't be reset: the screen says so). Signed in:

- **Your best scores sync** to every device: the best for every mode and difficulty, merged so nothing is ever lost (the higher score always wins). The button shows a green dot when you're synced.
- **Friends** are the same friends as Brain Rocket's. Add them by Warden Chat username; requests show as a red badge. Your account screen shows each friend's best Classic and Fruit Dash scores and race wins, and the results screen shows your friends' bests on the mode and difficulty you just played.
- **Fruit Dash races** (above).
- **Sign out** on this device only, optionally removing your scores from it (for shared computers). Pictures, passwords and deleting an account are on Warden Chat.
- An account an admin has **suspended or banned** on Warden Chat gets a "you've been banned" screen with the reason, and can keep playing as a guest.

**The back end isn't built yet** ([CODEX-HANDOFF.md](CODEX-HANDOFF.md) lists what's done and what isn't): Codex builds it from [ACCOUNTS-API.md](ACCOUNTS-API.md) and [RACES-API.md](RACES-API.md), as `a2o_*` database functions in Warden Chat's Supabase project. Until they exist, the game checks once per page load (`a2o_ping`), finds nothing and hides accounts completely: everything else works as before, and Fruit Dash offers practice only. To try accounts and races now, build the demo with a pretend back end: `python3 build-artifact.py demo.html --standalone --accounts-demo`, then sign in as `demo` / `oranges12345` and use the **DEMO** bar (add pretend racers, get an invite, have a friend answer, go offline, get suspended).

## The maps

Three rules hold in every mode:

1. **Every mode has exactly 20 locations.**
2. **Your score is where you are, and 50,000 is the target.** The 20th location is at 50,000 points. Reaching it is announced (🏆 50,000!) and starts **♾️ infinite mode**: the map keeps going, through the 20th location and then, from 55,000, into the mode's own endless art, with the side rail glowing.
3. **You see where you are.** Each location has its own sky colours and its own things drawn around you, and some have a landmark. At the Bird Flocks the sky is full of birds; at the Burj Khalifa the tower rises past you; at Mount Everest you pass the summit with its prayer flags.

| # | Points | 🎈 Classic | 🐿️ Guess the Number | 🏃 Fruit Dash | 🎃 Halloween |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 🍎 The Orchard | 🌱 The Roots | 🍇 The Fruit Bowl | 🎃 The Pumpkin Patch |
| 2 | 350 | 🪁 The Kite Festival | 🐦 The Bird Feeder | 🪵 The Cutting Board | 🌽 The Corn Maze |
| 3 | 1,100 | 🐦 The Bird Flocks | 🍄 The Mushroom Shelves | 🍞 The Toaster | 🧑‍🌾 The Scarecrow Field |
| 4 | 2,200 | 🎈 The Balloon Festival | 🦉 The Owl's Hollow | 🚰 The Kitchen Sink | 🚜 The Haunted Hayride |
| 5 | 3,500 | 🏙️ The Skyscraper Tops | 🚪 The Woodpecker's Door | 🧂 The Spice Rack | 🪦 The Graveyard |
| 6 | 5,200 | 🗼 The Burj Khalifa | 🪺 The Bird Nests | 🍪 The Cookie Jar | ⚰️ The Crypts |
| 7 | 7,000 | ☁️ The Fluffy Clouds | 🦋 The Butterfly Garden | 🥄 The Stand Mixer | 🌲 The Dark Forest |
| 8 | 9,000 | 🌈 The Rainbow | 🌲 Above the Forest | 🥣 The Cereal Boxes | 🕸️ The Spider Woods |
| 9 | 11,500 | 🛩️ The Blimp Lane | 🏮 The Lantern Branches | 🍳 The Stovetop | 🧙 The Witch's Hollow |
| 10 | 14,000 | ⛈️ The Thunderstorm | 🍂 The Autumn Leaves | 🧊 The Fridge | 🧪 The Potion Shop |
| 11 | 17,000 | 🦅 The Eagle's Sky | 🏡 The Squirrel Village | 🥫 The Pantry Shelves | 🦇 The Bat Caves |
| 12 | 20,000 | 🏔️ The Mountain Peaks | 🌫️ Into the Fog | 🎂 The Cake Stand | 🐺 The Wolf Hill |
| 13 | 23,000 | 🗻 Mount Everest | ☁️ The Cloud Branches | 🌀 The Blender | 🏚️ The Haunted Mansion |
| 14 | 26,000 | ✈️ The Jet Planes | 🪁 The Kite Tangle | 🥖 The Bread Bin | 🌊 The Ghost Lake |
| 15 | 30,000 | 💨 The Fighter Jets | 🥚 The Sky Nest | 🫖 The Teapot | 💀 The Skeleton Dance |
| 16 | 33,500 | 🌡️ The Weather Balloons | ✈️ The Jet Stream | 🌿 The Herb Garden | 🌕 The Blood Moon |
| 17 | 37,500 | 🌌 The Northern Lights | ❄️ The Frozen Branches | 🍽️ The Dish Rack | 🏺 The Mummy Tomb |
| 18 | 41,500 | 🛰️ The Satellites | 🌌 The Northern Lights | 🍕 The Pizza Oven | 🧛 The Vampire Castle |
| 19 | 45,500 | 🧑‍🚀 The Space Station | 🛰️ The Satellite Branch | 🧃 The Juice Bar | 👻 The Spirit Realm |
| 20 | 50,000 | 🚀 The Edge of Space | 🌕 The Moon Acorn | 🧺 The Farmers' Market | 🌀 Beyond the Veil |
| ♾️ | 55,000+ | ♾️ The Endless Sky | ♾️ The Endless Kitchen | ♾️ The Tree That Never Ends | ♾️ The Endless Night |

Real Size's map (the Dragon's Rock up to the Dragon Star) is still in `js/map.js` for when it comes back. In 60 seconds Fruit Dash rarely gets past the first half of its kitchen; the 50,000 at the Farmers' Market is there for a legendary Ultra dash.

In the climbing modes every location gets the same height on screen, so the climb moves at the same pace however far apart the points are, and the sky changes colour on the way (Classic goes from morning blue to the black of space with the Earth's curve below; Real Size has a stormy noon and a sunset before the night; Guess the Number has a lantern-lit dusk, autumn, fog and frost). The HUD shows the location you're in and the next one, the rail on the left has all 20, and each new location gets a banner. In Fruit Dash the kitchen runs sideways: the things on the back counter change at each location, with the wall tiles fading over and a hanging sign where each location starts. On Halloween the props along the ground change as you get to each location (new ones come in from the right) and the sky fades over; the Bat Caves and the Vampire Castle fill the sky with bats, and the Blood Moon turns the moon red.

Everything about the maps is in `js/map.js`: the 20 points, the locations, their icons, what's drawn at each and the landmarks. The scene and the game both read it.

## Music and sound

Every mode has its own loop, made on the fly with Web Audio like Brain Rocket's (no music files): **Breeze** (a ukulele strum) and **Sky** (floaty pads from the Fluffy Clouds up) for Classic, an adventure theme with harp, timpani and a horn for the dragon, a skippy plucked tune with a woodblock and flute for the squirrel, a spooky E-minor loop (music box, organ, bells and a wobbly theremin) for Halloween, and a quick, bouncy kitchen loop (marimba, slap bass, snare and a whistled tune) for Fruit Dash, which counts down with beeps and ends on a referee's whistle. The music follows the tab you've chosen, starts on the first click or key press, drops back for drum rolls and the ghost's heartbeat, and goes quieter while paused. **🎵** on the home screen or in the pause menu turns it off; **🔊** mutes everything.

## The facts

There are 1,157 facts in 34 categories (plus the Years Ago category the year facts also come up in), making about 3,800 cards once every measurement is shown in its other units and every year as years ago and days ago.

| File | Facts |
| --- | --- |
| `js/facts.js` | The first 189: animals, the body, food, games, movies, places, space, sports, years and more |
| `js/facts-close.js` | 240 that sit close together (Pokédex and jersey numbers, famous numbers, game rules, sports clocks, years): Ultra's main supply |
| `js/facts-more.js` | 113 more, mostly measurements (buildings, mountains, animals, speeds, temperatures, how long things last); its lengths are Real Size's main supply |
| `js/facts-halloween.js` | 115 Halloween facts, only for the Halloween event |
| `js/facts-500.js` | 500 more facts across the old categories and eight new ones (Bugs & Insects, Science, Books & Comics, Countries & Flags, History, Plants & Trees, World Records, Art & Museums), plus many more lengths for Real Size. Researched online with each source in `src`; the few textbook or definitional values that weren't say so |

**Same question, different units.** Every measurement comes up in every unit that reads sensibly: the Empire State Building is 1,454 feet, but also 443 meters, 44,318 centimeters, 485 yards or 0.28 miles. Converted numbers are rounded to what the card shows (approximate facts to three significant figures) and the game judges the numbers as shown.

**Metric prefixes.** Lengths, weights, times and amounts also come in pico- (a trillionth), micro- (a millionth) and tera- (a trillion): picometers, micrometers and terameters; picograms, micrograms and teragrams; picoseconds, microseconds and teraseconds; picoliters, microliters and teraliters. Like every unit, one only comes up when its number reads sensibly (0.1 up to a trillion), so a hair can be micrometers and the distance to the Sun 0.15 terameters, but a skyscraper is never picometers. They show up in Classic, Guess the Number and Halloween (Real Size is always centimeters).

**Years ago and days ago.** Every fact whose answer is a year also comes up two more ways, worked out from the day you play: "how many years ago the first iPhone came out" (this year minus that year, exact) and "how many days ago" (counted from the exact date when the fact has one, otherwise from the middle of that year and marked About). They're the same facts, not new ones, and they never meet a plain year (19 against 1996 would give it away).

**Accuracy matters more here than in a normal quiz.** The number is the whole question.

- **Never put the number in the question.** "The number of Route 66" answers itself.
- `x: 1` marks a fact as exact and unchanging. Only exact facts meet in photo finishes and Ultra.
- Approximate facts say so ("About", "As of 2025") and only meet numbers at least 10% away.
- `src` records where a number came from when it was looked up.

Checked online: Big Mac 580 calories, Jersey Mike's about 145 New Jersey locations (2025), blue whales up to about 330,000 lb (NOAA), a can of Coke (140 calories, 39 g sugar), Krispy Kreme Original Glazed (about 190 calories), Minnesota's 11,842 lakes (DNR), the 2023 record pumpkin (2,749 lb), the most lit jack-o'-lanterns (30,581, Keene, 2013), the Tower of Terror (199 ft) and the Parker Solar Probe (about 430,000 mph). Everything else is written from memory, so **read through the list** before sharing it widely.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The SirSC104 intro, then the screens: home with the mode picker, game, pause, results |
| `css/style.css` | Styles in Brain Rocket's look, the tab bar and its glider, the Guess the Number box and the Halloween strip |
| `js/facts*.js` | The facts (above) |
| `js/cards.js` | Turns facts into cards (each measurement in its other units) and knows each one's real size |
| `js/pairs.js` | Picks matchups for every mode: difficulty bands, Ultra's within-10 chains, photo finishes, Real Size's centimeter matchups, Guess the Number choices, slider and scoring |
| `js/map.js` | The four maps: 20 locations each, the 50,000 target, infinite mode, and what's drawn at each location |
| `js/scene.js` | The worlds on a canvas (every location's sky, decor and landmarks), and the slide between them; other files can add a world (`Scene.addWorld`) |
| `js/kitchen.js` | Fruit Dash's world: the eight running fruits, the kitchen and its 36 kinds of props, the lanes, name tags and the camera that follows your fruit |
| `js/account.js` | Signing in with Warden Chat, syncing best scores, friends (talks to the back end in ACCOUNTS-API.md) |
| `js/accountui.js` | The Sign in button, the account dialog (sign in, create account, profile, friends, sign out), notices, friends' bests on the results, the banned screen |
| `js/race.js` | Fruit Dash's home panel, the fruit picker, the race lobby, the live board, the race results and the play-again vote (talks to the back end in RACES-API.md) |
| `js/account-mock.js` | A pretend back end for the demo build only (not loaded by `index.html`) |
| `js/audio.js` | Sound effects and the music loops |
| `js/game.js` | The mode picker, every mode's rounds and reveals, the Halloween chase, Fruit Dash's clock, scoring, results and sharing |
| `ACCOUNTS-API.md`, `RACES-API.md` | The back-end contracts for Codex |
| `build-artifact.py` | Bundles everything into one page for publishing as an Artifact |

`dist/apples-to-oranges.html` is the whole game in one file, ready to download and open in any browser; rebuild it with `python3 build-artifact.py dist/apples-to-oranges.html --standalone`. `python3 build-artifact.py OUT.html` makes the Artifact version: the CSS and every script inlined, without the `<html>`/`<head>`/`<body>` tags the Artifact host adds. In an Artifact, **📋 Share** copies the results.

## Easter egg

Every so often, the rocket from Brain Rocket launches up through the sky behind Classic and Guess the Number, with the little pilot in its window. It always shows up when you get 10 in a row.

## Not built yet

The back end for accounts and races (Codex, from ACCOUNTS-API.md and RACES-API.md), Warden Chat profile pictures (the letter avatars stand in for now), a daily mode with a share grid, and a local Madison/DHHS fact pack.
