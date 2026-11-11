# Kingdom Clash

A real-time card battler for desktop browsers (built for school Chromebooks). Two players each defend two Archer Towers and a King Tower; you play troops and spells from a hand of four, paying with Energy that refills over time, and knock down towers for crowns.

The Training Grounds have three trainers, played in order: **Trainer Owen** (the tutorial, built to lose), **Trainer Romeo** (mid tier) and **Trainer Luc** (hard). Beating all three unlocks the Trophy Road. The lobby is built as the full game's lobby, with the parts that don't exist yet (wallet, clans, events) shown in their locked or coming states. After the trainers comes the **Trophy Road**: trophy battles against bots in Arena 1 (Cinder Keep), road rewards, chests, two new cards (Skeleton Pack and Cannon) and card levels up to 15. The SirSC wallet, evolutions and online 1v1 come later.

Plain HTML, CSS and JavaScript with no build step and no dependencies. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

## Screens

| Screen | What's on it |
| --- | --- |
| Lobby | A top bar (your name, level and experience, coins and diamonds with + buttons, sound, settings with name and sound), the tab, and a bottom navigation bar (Shop · Cards · **Battle** · Clan · Trophy Road; keys `1`–`5`; switching tabs slides the screen toward the button you picked, and a gold-trimmed highlight glides behind the selected tab). The Battle tab is built around the Training Grounds centerpiece (`img/training-grounds.webp`, transparent): its empty bar is filled live from your progress ("1 / 3 Trainers Defeated", turning green at 3/3). Under it: the opponent ("Next Opponent: Trainer Romeo", or "Trophy Road Unlocked!"; **Trainers** opens a panel of all three with portraits, status and records, to pick a rematch), the **Battle** button (`Enter`) and four chest slots (locked until the Trophy Road; the slots also support empty, chest, unlocking and ready states). On wide screens, stone plaques at the sides show the Diamond Pass, what's coming up and the Training Grounds rewards. Everything fits a 1280×720 or larger screen without scrolling; under 1080 px wide the side plaques go; under 760 px the lobby scrolls with the navigation fixed at the bottom. |
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

## Arena 2: Briar Hollow

Reached at **300 trophies** (Arena 1's floor stays 0; Briar Hollow's is 300). An overgrown forest of stone ruins, roots, thorny vines and lanterns. Its four cards come from the Trophy Road: **Spears** at 330, **Pot Thrower** at 400, **Footmen** at 480 and **Flail Knight** at 560 (between them: 300 coins at 370, a Gold Chest at 440, 400 coins at 520). Arena 3, Sunstone Arena, follows at 600. Like the Arena 1 cards, they stay out of Training Grounds matches. Opponents add them to their decks as their trophies pass those marks.

**Art:** `img/briar_hollow_badge.webp` (lobby centerpiece), `img/briar_hollow_battlefield.webp` (the battlefield, laid onto the tile grid by its pads, stream edges and bridges), `img/briar_hollow_left.webp` (the king's statue and high stands) and `img/briar_hollow_right.webp` (the stands by the waterfall). All their measurements (bar, anchors, bridges, the four flickering wall lanterns, bench rows, lights, waterfall mist) are in the `briar` entry of `js/arenas.js`.

| Card | Energy | Rarity | What it does (level 1) |
| --- | --- | --- | --- |
| Spears | 3 | Common | Spell: a volley over a 3.5-tile area, 185 damage to ground and air (30% to towers), no knockback |
| Footmen | 5 | Common | Four armored soldiers, 420 HP and 85 damage every 1.3 s each; melt tanks, weak to splash |
| Flail Knight | 4 | Rare | 1,150 HP; each swing (150 damage every 1.7 s) hits every ground enemy within 1.6 tiles, towers included |
| Pot Thrower | 2 | Common | 150 HP, range 4.5, ground only; 88 splash damage in 1.1 tiles, then broken pottery deals 40 damage a second for 0.5 s |

`node tools/balance-test.js [matches]` plays the same bot with each new card swapped in for a card with the same job against the starter deck. At 100 matches: Spears 52%, Footmen 47%, Flail Knight 48%, Pot Thrower 58%, all four together 51%. It also times one-on-one trades (Flail Knight clears four Wolves in one swing; Footmen beat a Gorilla; a Snowman beats Footmen).

## Arena 3: Sunstone Arena

Reached at **600 trophies**: a sun-baked desert fortress of sandstone walls with an oasis channel for the river. **Art:** `img/sunstone_arena_badge.webp` (lobby centerpiece), `img/sunstone_arena_left.webp` (the sundial, lion statues and great stairs) and `img/sunstone_arena_right.webp` (the stands by the waterfall, with market stalls); their bar, bench rows, lights and waterfall mist are in the `sunstone` entry of `js/arenas.js`. The battlefield is `img/sunstone_arena_battlefield.webp`, laid onto the tile grid by its pads, the oasis channel's edges and the bridges, with its four corner fire bowls flickering. Arena 4 at 900 is marked *coming soon*.

Its four cards come from the Trophy Road: **Sandstorm** at 630, **Ram Cart** at 710, **Mole** at 790 and **Camel Jockey** at 870 (500 coins at 670, a Gold Chest at 750, 600 coins at 830 between them). Opponents add them as their trophies pass those marks, and they stay out of Training Grounds matches.

| Card | Cost | Rarity | What it does |
|---|---|---|---|
| Sandstorm | 3 | Common spell | A 3-second storm (radius 3) over enemy ground and air troops: 180 damage over its length at level 1 (35% on towers) and a 25% slow while they're in it. Never slows your own troops. Swirling sand rings, dust clouds and pebbles. |
| Ram Cart | 4 | Rare | Two soldiers push a wheeled ram with a golden ram's head (1,100 HP). It goes for buildings only and speeds up as it rolls (1 to 2.3 tiles a second); the first building it reaches takes 200 damage, up to double at full speed. Then it breaks apart and its two **Cart Soldiers** (340 HP, 80 damage each) fight on, hitting ground troops and buildings. If it's destroyed on the way, the soldiers jump out there. Spinning wheels, dust trail, impact burst. |
| Mole | 3 | Rare | Placed **anywhere** except the river or a tower, even on the enemy side. It digs out from in front of your King Tower and tunnels straight to the spot (a moving mound and a dirt trail), and nothing can hit it underground. It bursts out (a hole, flying dirt) and fights by the normal rules, troops and buildings; it hits towers for a quarter of its damage. |
| Camel Jockey | 5 | Legendary | Two attacks at once. The **camel** (1,150 HP) gallops for buildings and hits for 150, double on the first hit after a run of 2.5 tiles. The **rider** throws a lasso at the nearest enemy troop in 5 tiles every 1.3 s (45 damage), and one lasso in every 4 seconds also slows its target by 50% for 1.6 s, so nothing stays slowed for long. Galloping legs, sand kicked up, a rope flying out. |

Balance (`node tools/balance-test.js 120 <name>`; each new card takes a like-for-like slot in the starter deck, the same bot on both sides, sides swapped every match): Sandstorm 47%, Ram Cart 55%, Mole 57%, Camel Jockey 49% of decided matches. The bot plays all four: it casts Sandstorm on clumps, starts pushes with the Camel Jockey from the back and the Ram Cart at the bridge, and tunnels the Mole to just behind the weakest tower.

## Arena 4: Stormspire

Reached at **900 trophies**: a fortress on a mountain peak above the clouds. **Its art is placeholder for now** (`img/stormspire_badge.webp`, `img/stormspire_left.webp`, `img/stormspire_right.webp`, labelled "placeholder art", made in code); the battlefield is drawn in code from the `stormspire` palette. Swap in real art the same way as the other arenas (the `stormspire` entry in `js/arenas.js`, plus a `field` entry for a battlefield illustration). Arena 5 at 1,200 is marked *coming soon*. **Online battles will open here** (their front end is built; live play is coming).

Their card pictures are illustrations (`img/card_bees.webp`, `img/card_owl.webp`, `img/card_thundercloud.webp`, `img/card_griffin.webp`; any card can have one through its `art` field in `js/cards.js`, with the code-drawn picture standing in while it loads), and the troops in battle are drawn in code in the same style: a gold-helmed owl in blue armor, a purple storm cloud with glowing yellow eyes and blue-white lightning, a golden griffin in gold armor with blue gems and blue eyes. Its four cards are all flyers, on the Trophy Road: **Bees** at 930, **Owl** at 1,010, **Thunder Cloud** at 1,090 and **Griffin** at 1,170 (700 coins at 970, a Platinum Chest at 1,050, 800 coins at 1,130). Opponents add them as their trophies pass those marks.

| Card | Cost | Rarity | Role | What it does (level 1) |
|---|---|---|---|---|
| Bees | 2 | Common | like Bats | Five tiny flyers (50 HP, 40 damage every 0.75 s) that sting ground and air. Fast, cheap, fragile. Wings a blur. |
| Owl | 4 | Rare | like the Flying Machine | One armored battle owl (640 HP) that flies slowly and fires steel-tipped quills (135 damage) from 6 tiles at ground and air. |
| Thunder Cloud | 5 | Epic | like the Balloon | A slow storm cloud (1,050 HP) that only goes for buildings and calls down a lightning bolt on them (480 damage, splashing ground troops round it). When destroyed it bursts in a final thunderclap (150 damage to ground troops within 2.2 tiles). Glowing eyes, rain, flickering electricity. |
| Griffin | 4 | Legendary | like the Inferno Dragon | A flying griffin (950 HP) that locks a lightning beam on one target, ground or air: 40 damage a second, then 120, then 360, stepping up every 2 seconds on the same target. The beam starts over on a new target, or when the Griffin is knocked back. |

Balance (`node tools/balance-test.js 120 <name>`): Bees 56%, Owl 46%, Thunder Cloud 53%, Griffin 53%. The bot plays all four: Bees and the Griffin defend, the Owl backs up pushes, and the Thunder Cloud starts pushes from behind the King Tower; it answers a Thunder Cloud with air-hitters.

## Online battles (front end only, not live yet)

From Stormspire on, the **Online** button beside *Trainers* in the lobby opens the online panel, which for now says **Online battles are coming soon** and shows what will be there (greyed out): **Quick match** (battle the next player who's looking) and **Friendly battle** (make a room and share its five-letter code, or type a friend's). Online battles will use each player's own deck, card levels, King Tower level and evolutions, and no trophies will be won or lost.

**What is built** (the front end, waiting for a multiplayer backend):
- The screens: the Online panel with its states (looking for a match, a room code to share, joining, starting), the *Waiting for your opponent…* note in battle, and the online result screen.
- The battle side (`js/game.js`, the online part): both players run the same simulation from the same seed and send each other only their card plays (lockstep): a play made at tick *t* happens at tick *t* + 9 on both screens, a screen runs a tick only once it has every play the other made for it, each message repeats every play the other side hasn't confirmed, the second player sees the battle mirrored so each has their own side at the bottom, checksums are compared every two seconds (*out of sync* stops the battle), and a player who leaves loses. The simulation uses only exact arithmetic so two browsers compute the same battle (`tools/cards-test.js` checks both).
- Matchmaking and room codes (`js/net.js`), written against a small transport: a lobby with `emit`, `on`, `presence`, `peers`, `onPeers` and `join(name)` for a room per battle. Everything a player sends (their setup and plays) is checked before use.

**Live play is switched off**: `LIVE = false` at the top of `js/net.js`, so nothing connects. To go live, connect the backend there as a transport with those calls and set `LIVE` to true. Messages it must relay between the two players in a room: `mp.start` (from the host: the seed and both players' setups), `mp.step` (each player's plays, about 15 a second), `mp.emote`, `mp.bye`, plus `mp.invite` in the lobby for quick match.

## Evolutions

Evolutions open in Sunstone Arena. An evolution is unlocked once, with **6 Evolution Shards** (Magic Items, or the Evolution part of the card's window) or from the Diamond Pass, and then works in every battle: **every third play of that card is the evolved one**. A card in your hand shows a violet pip for each play counted; when the next play will be evolved, the card turns into its violet evolved card and glows. Only the **Snowman's** is built (`KC_EVOS` in `js/cards.js`): its snowballs are **1.5x the size (splash radius) and 1.5x as fast, for the same damage**, and the evolved Snowman stands a little taller with an ice crown, frost shards and a violet glow. Past 700 trophies about half the opponents with a Snowman have its evolution too. Unlocking one plays its own scene: shards swirl into the card, it shakes and glows, then bursts into its evolved card. The evolution as specified is a small upgrade: in a direct test (the same Snowman against swarms) it killed exactly as many as the normal one, since it changes size and speed, not damage.

## The Diamond Pass

A season pass in the lobby (the Diamond Pass plaque; a small button under the chests on narrow screens), open from Sunstone Arena. Every **crown** you take in a trophy battle is a pass point, and every 8 make a tier (15 tiers). Each tier has a **free** reward and a **Diamond Pass** reward, all shown before you buy:

- Free path: coins, wild cards, **4 Gold Chests**, and **2 Evolution Shards** in all (tiers 5 and 10).
- Diamond Pass path: the **Snowman Evolution at tier 1**, Gold, Platinum and Legendary Chests, coins, wild cards, books and 4 more shards.

The Diamond Pass is bought in the **Shop** (first tile in Daily Offers) for **10 diamonds** (`PASS.price` in `js/progress.js`), with a second click to confirm. Members get it as part of their membership (`member` in the save; the membership itself comes with the wallet). An evolution you already own comes as its 6 shards instead. The result screen shows the crowns you earned and any new tier.

## The King Tower

A **King Tower** button in the top bar shows its level (1 to 15). The level sets the health and damage of all three of your towers in battle (8% a level, like card levels; level 1 is a 2,400 HP King Tower and 1,400 HP Archer Towers). To reach level L you need **L cards at level L or higher**: 2 cards at level 2 for level 2, 3 at level 3 for level 3, and so on up to 15 cards at level 15. Upgrading is then free and plays its own scene. Its window shows the towers' stats now and after, how many cards qualify (each card shown, greyed out until it is high enough), and the Upgrade button; the button in the top bar gets a green dot when an upgrade is ready, and upgrading a card that makes it ready says so. Trophy opponents' towers follow the average level of their cards; trainers stay at level 1. Rules in `kingInfo` and `upgradeKing` in `js/progress.js`.

## Emotes in the Shop

The Shop has an **Emotes** section (and buttons at the top to jump to Daily Offers, Chests or Emotes). There are **33 emotes** to buy. Fifteen are the game's own King: Love Struck, Too Cool, Party Time, Dizzy, Nervous, Facepalm, Blow a Kiss, Hello!, Applause, Shh!, Popcorn, Champion, Mind Blown, Smug and Salute, each animated with its own sound. The other 18 are **card emotes**, one starring each card: its character in the sender's colours, with a move and an effect of its own (the Rhino charges and snorts steam, the Wolves howl musical notes, the Gorilla pounds its chest, the Skeletons rattle with bones flying, the Snowman stands proud in falling snow, the Archers hit a target, the Cannon fires, the Fireball blazes, the Mole peeks out of its hole, the Camel Jockey gallops with its lasso spinning, and so on), drawn from the card art (`portrait(id, w, h, { bare: true, team })` in `js/art.js`). **Three are on sale each day** from all 33 (the same three all day, a new set at midnight, skipping ones you own), each for **5,000 coins or 1 diamond** (a diamond takes a second click to confirm; `EMOTE_SHOP` in `js/progress.js`). A bought emote is yours for good and joins the eight everyone has in the battle emote panel, which turns pages (an arrow button) once you have more than eight. Each opponent has four of the Shop's emotes of its own to use.

## Cards from chests before the Trophy Road

A chest can give **any card of the arenas you have reached**, found or not, not just the cards you have found. So in Briar Hollow a chest can hold Spears or a Flail Knight before the Trophy Road gets there, and it is found the moment it comes out (shown as *New card!*). Cards of arenas you haven't reached never drop. The Trophy Road still gives its card if you already have it (as copies).

## Emotes

In battle, the speech-bubble button at the bottom left of the arena (or **E**) opens the emote panel over the bottom of the arena: a mute button for the opponent's emotes, eight picture emotes of the game's own King (laughing, crying, angry, thumbs up, amazed, yawning, cheeky, thinking), and six phrases (*Good luck!*, *Nice play!*, *Whoa!*, *Thanks!*, *Good game!*, *Oops!*). An emote pops up beside its player's King Tower, animated, with its own sound, for under three seconds. Three emotes in a row and the panel rests for 3.5 seconds.

The opponent emotes back about a third of the time (more often to *Good game!* after the match), with a fitting reply, and about 40% of the time after taking one of your towers or winning. Muting hides its emotes for that battle. Everything lives in `js/emotes.js`; `KCEmotes.send(team, id)` is the one way an emote goes up, ready for an online opponent later. Chances are in `CHANCE` at the top.

## Magic items

A **Magic Items** tab sits beside the card collection (Cards → Magic Items). Pick an item to see the cards it can be used on, or use it from a card's details window.

- **Wild cards** (common, rare, epic, legendary) count as copies of any card of that rarity and fill up to the copies the card needs for its next level. They come from chests **from Arena 2 on**: none in wooden chests, from 2–4 common in silver up to 30–40 common, 8–12 rare, 2–3 epic and a 10% chance of a legendary in mythic (more with account level).
- **Book of Common / Rare / Epic / Legendary** fill all the copies a card of that rarity still needs for its next level; the **Book of Books** works on any rarity. The **Hammer of Books** upgrades a card one level without spending coins (it still needs its copies, so a book plus the hammer is a free level).
- Books and the hammer are rare finds: never in wooden chests, 0.1% in silver, 0.2% gold, 0.4% platinum, 0.7% legendary and 1% mythic (one roll per chest). Tested over 20,000–40,000 rolls.
- **Evolution shards** have a slot in the tab; nothing gives them yet.
- Item art is drawn in SVG (`js/items.js`), each item built from separate parts. In a chest reveal the parts fly in from every side, each trailing a comet, over a turning magic circle, and snap together; then the item flashes, a shockwave rolls out and its name appears. Books, the hammer and epic or legendary wild cards form more slowly and get a *Rare find!* tag.
- The **Hammer of Books** has a living texture: its head shifts colour, runes scroll across it, a sheen sweeps over it and the book in its face glows, everywhere it is shown. Every item has a passing sheen. With reduced motion, none of it moves.
- **Growing a card has its own scene** (`js/upgrades.js`), over everything, for every way a card grows:
  - *Upgrade with coins*: copies stream out of the card's bar and coins pour in from below, the card charges up and shakes, then bursts; the level number slams to the new one, Health and Damage count up, and the XP (and any account level-up) shows.
  - *Hammer of Books*: the hammer swings in and strikes the card three times (sparks, cracks of light, the screen shakes); the third strike bursts it into a rainbow level-up, *No coins spent!*
  - *Wild cards*: the wild cards fly in one after another and melt into the card, each counting into its bar.
  - *Books and the Book of Books*: the book drops in, shakes and falls open, its pages turn and fly into the card as light, filling its bar; *Upgrade ready!* if it can now level.
  A click (or Space or Enter) skips to the end, another click closes it, Escape closes it. With reduced motion it opens on the end.
- Rules and drop tables are `MAGIC` and `MAGIC_RULES` in `js/progress.js`.

## The Trophy Road and Arena 1

Rules live in `js/progress.js` (no screen code; tested by `tools/progress-test.js`).

- **Opening it**: beat Owen, Romeo and Luc. The Battle button then plays trophy battles in **Arena 1: Cinder Keep** (trainers can still be replayed from the Trainers panel, for no trophies).
- **Trophies**: a win is +30, a loss is −20, never below the arena's floor (0 in Arena 1). Arena 2 is at 300 trophies and is marked *coming soon*.
- **Opponents**: computer players with ordinary player names and portraits (nothing in the game labels them). They don't talk: no speech bubbles and no line on the result screen (trainers still do). Their **cards level up one at a time with their trophies**: all level 1 below 50 trophies; at 50 one card is level 2, and another card goes up every 12.5 trophies (two at about 60, all eight level 2 by about 140), then the first level 3 at 150, and so on, a full level per 100 trophies, until every card is level 15 at about 1,440. Which cards are ahead differs from opponent to opponent, and levels show on their units' health bars. Their skill follows your results: a step harder after a win, a step easier after a loss. In the headless test (150 matches), a good player who kept their cards level with their trophies won 51% once settled and a sloppy one 52%; a good player who never upgraded won 42% and slid back to about 300 trophies with the opponents near their easiest.
- **Road rewards** (claimed on the Trophy Road tab): 20 trophies 50 coins · 40 **Skeleton Pack** ×6 · 60 Silver Chest · 90 100 coins · 120 **Cannon** ×4 · 160 Silver Chest · 200 200 coins · 250 Gold Chest · 300 Arena 2 (coming soon).
- **Chests**: six tiers: Wooden, Silver, Gold, Platinum, Legendary and Mythic (Legendary and Mythic are animated: a pulsing halo, sparkles circling and, on the Mythic, a colour shimmer and float). A trophy win puts a chest in the first free slot (four slots), in a fixed repeating order of 24 that includes every tier. **Arena gate**: each arena allows higher tiers (Arena 1 wooden and silver, Arena 2 adds gold, Arena 3 platinum, Arena 4 legendary, Arena 5 mythic); a chest above the player's arena is given as the highest tier they have reached, in wins, Trophy Road rewards and the Shop. The gate is in `CHEST_RULES` in `js/progress.js` and is **switched off for now** (`allUnlocked: true`), so every tier drops everywhere. Its contents are decided when it is won. One chest unlocks at a time on a real-time timer (wooden 1 minute, silver 15 minutes, gold 1 hour, platinum 3 hours, legendary 8, mythic 12). **Opening** is a scene of its own: the chest (wooden planks and iron, steel with a blue gem, or gold with a crown) drops in and rattles; a click cracks the lid open in a burst of light rays and sparkles; then each reward comes out one at a time. Coins count up with a coin shower. A card flies out face down, glowing in its rarity's colour (rares and new cards shake and take longer), flips over, and its copies count into its level bar, ending on *Upgrade ready!* when it fills. A click during a reveal finishes it, a click after moves on; a badge on the chest counts what's left; a summary closes the scene. Every step has its own sound. Trophy Road cards and Shop purchases use the same reveal without a chest.
- **The Shop** (Shop tab): five offers a day, made from the cards you have found and their levels, each showing exactly what you get. (1) *Closest to upgrade*: the copies your nearest card is missing. (2) *Rare pick*: a rare, one level's worth. (3) *Catch up*: your lowest-level card, cards found on the Trophy Road first. (4) *Mega bundle*: 5,000 coins' worth of copies of a deck card for 1 diamond. (5) *Coin bundle*: 5,000 coins for 1 diamond, buyable any number of times. A copy is priced at 10 coins (common) or 50 (rare); 1 diamond = 5,000 coins. Card offers sell once a day; offers change at local midnight (the clock on the tab is real). Cards you haven't found and cards at level 15 are never offered. Diamond purchases take a second click to confirm. A second row sells **chests for coins only**, any number of times, with what is inside hidden until opened (each tile shows the card count and coin range): a **free Wooden Chest** once a day, then Wooden, Silver, Gold, Platinum, Legendary and Mythic. A bought chest opens on the spot (no slot, no timer). **Contents and prices grow with the account level** (15% more per level), not trophies, and a chest's coins are always less than its price. Diamonds are a number saved on the device for now (0 unless the test button is used); there is no way to buy them in the game. When the SirSC wallet is connected, prices and purchases must be decided by the server.
- **Test buttons (temporary)**: *Simulate Win* (in the lobby and in a battle), *1,000,000 coins & diamonds* (lobby), *New offers* (Shop) and *Give magic items* (Magic Items). Each is marked `TEMPORARY` in the code.
- **Card levels**: copies plus coins level a card up, to 15 at most. Commons need 2, 4, 10, 20, 40… copies; rares 1, 2, 4, 8, 15…; coins 5, 20, 50, 150, 400… Each level adds 8% health and damage. Units in battle show their level on their health bar.
- **Arena cards stay in Arena 1**: Skeleton Pack and Cannon are only found on the Trophy Road. Trainers never use them, and in a Training Grounds match your deck goes back to the eight starter cards (each Arena 1 card swaps for a starter card you left out).
- **Coins and diamonds** are kept on this device for now and move to the SirSC wallet when it is connected.
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
| `js/net.js` | Online battles (front end, live play off): quick match, room codes, checking what the other player sends, and where a backend connects |
| `js/emotes.js` | Battle emotes: the panel, the King's faces, the bubbles, and when the opponent emotes |
| `js/upgrades.js` | The full-screen scenes for upgrading a card and using a magic item on it |
| `js/items.js` | Magic item art (SVG built from parts that fly together in a chest reveal) |
| `js/menu.js` | The lobby, the Cards screen (deck, collection, upgrades), chest opening, the Trophy Road tab |
| `js/sim.js` | The battle: fixed 30 steps a second, no DOM, seeded, so it runs the same in the page, in Node and later on both ends of an online match |
| `js/bot.js` | The trainers' AI (one bot with a skill setting per trainer) |
| `js/art.js` | Every troop, tower, card portrait and the arena, drawn in code. Each troop and tower has two views: your side is seen from behind (facing up the arena, toward the enemy) and the enemy faces you; cards use the front view |
| `js/scenery.js` | The Training Grounds side panels. Each draws its illustrated background (`img/grounds-left.webp`, `img/grounds-right.webp`) once into a cache cropped to cover the panel, then each frame the animated spectators seated on the illustrated benches (team-coloured outfits, flags; they jump for the side that takes a tower, celebrate the winner and slump if their side lost), torch glow, embers, twinkling stars and waterfall mist. Bench positions are in `LAYOUT`, in image coordinates |
| `js/audio.js` | Sound effects made with Web Audio (no sound files) |
| `js/game.js` | Screens, the game loop, drawing the battle, input |
| `tools/path-test.js` | `node tools/path-test.js` places every ground troop behind and beside each tower, for both teams, and checks it walks around instead of getting stuck |
| `tools/trainers-test.js` | `node tools/trainers-test.js 100 [trainer]` plays each trainer against a good player, a sloppy player, a random clicker and a player who does nothing, and prints how often the trainer wins |
| `tools/cards-test.js` | `node tools/cards-test.js` checks the Cannon (pulls a Rhino, lasts 30 s, placement rules), the Skeleton Pack, card levels, the Briar Hollow cards, and the Sunstone cards (Mole tunneling and placement, Sandstorm slows, the Ram Cart's charge and soldiers, the Camel Jockey's lasso cooldown) and the Snowman's evolution |
| `tools/progress-test.js` | `node tools/progress-test.js [matches]` checks old saves, trophies, chests and timers, road rewards, upgrades, the deck and the Training Grounds deck rule, the Shop's offers and purchases, Sunstone Arena, evolutions and the Diamond Pass (2 free shards, the Snowman Evolution at tier 1, claiming, buying), then plays trophy matches to check the 52% target |
| `tools/balance-test.js` | `node tools/balance-test.js [matches]` plays decks with the Briar Hollow cards against the starter deck and times one-on-one trades |
| `tools/sim-test.js` | `node tools/sim-test.js 40` plays 40 bot-vs-bot matches headless and checks they end cleanly (no NaNs, no troops in the river) |
| `img/` | Arena art (see *Arena art*): the Training Grounds and Cinder Keep centerpieces (transparent), scenery panels (793 × 1983) and the Cinder Keep battlefield (1024 × 1536) |
| `build-artifact.py` | Bundles everything into one page, with the images baked in as data URIs: `python3 build-artifact.py OUT.html` (claude.ai Artifact) or `--standalone` (a complete page) |

Built copies are in `dist/`: `kingdom-clash.html` (Artifact bundle) and `kingdom-clash-standalone.html` (open anywhere, works offline apart from the Google font, which falls back to a system font).

The game saves your progress (trainers beaten, records, name, experience) and the sound setting in the browser's local storage only.
