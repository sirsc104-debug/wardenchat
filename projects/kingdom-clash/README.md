# Kingdom Clash

A real-time card battler for desktop browsers (built for school Chromebooks). Two players each defend two Archer Towers and a King Tower; you play troops and spells from a hand of four, paying with Energy that refills over time, and knock down towers for crowns.

The Training Grounds have three trainers, played in order: **Trainer Owen** (the tutorial, built to lose), **Trainer Romeo** (mid tier) and **Trainer Luc** (hard). Beating all three unlocks the Trophy Road. The lobby is built as the full game's lobby, with the parts that don't exist yet (wallet, clans, events) shown in their locked or coming states. After the trainers comes the **Trophy Road**: trophy battles against bots in Arena 1 (Cinder Keep), road rewards, chests, two new cards (Skeleton Pack and Cannon) and card levels up to 15. The SirSC wallet, evolutions and online 1v1 come later.

Plain HTML, CSS and JavaScript with no build step and no dependencies. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

## Screens

| Screen | What's on it |
| --- | --- |
| Lobby | A top bar (your name, level and experience, rubies and diamonds with + buttons, sound, settings with name and sound), the tab, and a bottom navigation bar (Shop · Cards · **Battle** · Clan · Trophy Road; keys `1`–`5`; switching tabs slides the screen toward the button you picked, and a gold-trimmed highlight glides behind the selected tab). The Battle tab is built around the Training Grounds centerpiece (`img/training-grounds.webp`, transparent): its empty bar is filled live from your progress ("1 / 3 Trainers Defeated", turning green at 3/3). Under it: the opponent ("Next Opponent: Trainer Romeo", or "Trophy Road Unlocked!"; **Trainers** opens a panel of all three with portraits, status and records, to pick a rematch), the **Battle** button (`Enter`) and four chest slots (locked until the Trophy Road; the slots also support empty, chest, unlocking and ready states). On wide screens, stone plaques at the sides show the Diamond Pass, what's coming up and the Training Grounds rewards. Everything fits a 1280×720 or larger screen without scrolling; under 1080 px wide the side plaques go; under 760 px the lobby scrolls with the navigation fixed at the bottom. |
| Cards | Your 8-card Battle Deck in one row with the average energy cost, and the Card Collection grid (name, rarity, level, energy, *In deck*). Click any card for its details: stats, description and its evolution. |
| Battle | Five columns, following the desktop layout concept: the Royal Grandstands (King statue, stands, banners, torches) · your 4 cards and the next one · the arena · the Energy bar · the Royal Waterfall with the timer and crown score over its sky. The spectators in both stands are animated and react to the match. Below 1000 px wide the scenery is dropped and the clock moves onto the arena. |
| Result | Victory / Defeat / Draw, both sides' crowns, the trainer's comment, anything you unlocked (next trainer, Trophy Road, a new level), why it ended and the experience earned, then **Battle *next trainer*** (after a first win), **Play Again** or **Home**. |

## The Trophy Road screen

Your trophies, arena and record at the top, then a bar with the next reward (its trophy count, how far to go and a *Find me* button), or how many rewards are waiting to claim (*Show me*). The road below is one gold track running under every reward, filled up to a marker with your trophy count; each reward sits above the track in its own card, tinted for its arena, with its trophy count below, so the track never crosses a card. Each arena starts with a large gate showing its badge. Arrows at the sides and the mouse wheel scroll it. On phones the header is compact so the road fits on screen.

## Phones

On a phone held upright the battle switches layout: the arena fills the top of the screen, and the hand (the next card, then the four you can play) and a horizontal energy bar run along the bottom, full width. The lobby keeps its centre column inside the screen (the opponent row wraps its Trainers and Online buttons onto their own line), and the Shop's offers are two to a row.

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

Reached at **300 trophies** (Arena 1's floor stays 0; Briar Hollow's is 300). An overgrown forest of stone ruins, roots, thorny vines and lanterns. Its four cards come from the Trophy Road: **Spears** at 330, **Pot Thrower** at 400, **Footmen** at 480 and **Flail Knight** at 560 (between them: 300 rubies at 370, a Gold Chest at 440, 400 rubies at 520). Arena 3, Sunstone Arena, follows at 600. Like the Arena 1 cards, they stay out of Training Grounds matches. Opponents add them to their decks as their trophies pass those marks.

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

Its four cards come from the Trophy Road: **Sandstorm** at 630, **Ram Cart** at 710, **Mole** at 790 and **Camel Jockey** at 870 (500 rubies at 670, a Gold Chest at 750, 600 rubies at 830 between them). Opponents add them as their trophies pass those marks, and they stay out of Training Grounds matches.

| Card | Cost | Rarity | What it does |
|---|---|---|---|
| Sandstorm | 3 | Common spell | A 3-second storm (radius 3) over enemy ground and air troops: 180 damage over its length at level 1 (35% on towers) and a 25% slow while they're in it. Never slows your own troops. Swirling sand rings, dust clouds and pebbles. |
| Ram Cart | 4 | Rare | Two soldiers push a wheeled ram with a golden ram's head (1,100 HP). It goes for buildings only and speeds up as it rolls (1 to 2.3 tiles a second); the first building it reaches takes 200 damage, up to double at full speed. Then it breaks apart and its two **Cart Soldiers** (340 HP, 80 damage each) fight on, hitting ground troops and buildings. If it's destroyed on the way, the soldiers jump out there. Spinning wheels, dust trail, impact burst. |
| Mole | 3 | Rare | Placed **anywhere** except the river or a tower, even on the enemy side. It digs out from in front of your King Tower and tunnels straight to the spot (a moving mound and a dirt trail), and nothing can hit it underground. It bursts out (a hole, flying dirt) and fights by the normal rules, troops and buildings; it hits towers for a quarter of its damage. |
| Camel Jockey | 5 | Legendary | Two attacks at once. The **camel** (1,150 HP) gallops for buildings and hits for 150, double on the first hit after a run of 2.5 tiles. The **rider** throws a lasso at the nearest enemy troop in 5 tiles every 1.3 s (45 damage), and one lasso in every 4 seconds also slows its target by 50% for 1.6 s, so nothing stays slowed for long. Galloping legs, sand kicked up, a rope flying out. |

Balance (`node tools/balance-test.js 120 <name>`; each new card takes a like-for-like slot in the starter deck, the same bot on both sides, sides swapped every match): Sandstorm 47%, Ram Cart 55%, Mole 57%, Camel Jockey 49% of decided matches. The bot plays all four: it casts Sandstorm on clumps, starts pushes with the Camel Jockey from the back and the Ram Cart at the bridge, and tunnels the Mole to just behind the weakest tower.

## Arena 4: Stormspire

Reached at **900 trophies**: a fortress on a mountain peak above the clouds. **Art:** `img/stormspire_badge.webp` (lobby centerpiece), `img/stormspire_battlefield.webp` (the battlefield, laid onto the tile grid by its pads, the stream's edges and the bridges, with flickering corner fire bowls), and `img/stormspire_left.webp` / `img/stormspire_right.webp` (the stands, with lanterns, fire bowls and waterfall mist); all measured in the `stormspire` entry of `js/arenas.js`. Arena 5 at 1,200 is marked *coming soon*. **Online battles will open here** (their front end is built; live play is coming).

Their cards and troops are drawn in code, styled after concept art: a gold-helmed owl in blue armor, a purple storm cloud with glowing yellow eyes and blue-white lightning, a golden griffin in gold armor with blue gems and blue eyes. Its four cards are all flyers, on the Trophy Road: **Bees** at 930, **Owl** at 1,010, **Thunder Cloud** at 1,090 and **Griffin** at 1,170 (700 rubies at 970, a Platinum Chest at 1,050, 800 rubies at 1,130). Opponents add them as their trophies pass those marks.

| Card | Cost | Rarity | Role | What it does (level 1) |
|---|---|---|---|---|
| Bees | 2 | Common | like Bats | Five tiny flyers (50 HP, 40 damage every 0.75 s) that sting ground and air. Fast, cheap, fragile. Wings a blur. |
| Owl | 4 | Rare | like the Flying Machine | One armored battle owl (640 HP) that flies slowly and fires steel-tipped quills (135 damage) from 6 tiles at ground and air. |
| Thunder Cloud | 5 | Epic | like the Balloon | A slow storm cloud (1,050 HP) that only goes for buildings and calls down a lightning bolt on them (480 damage, splashing ground troops round it). When destroyed it bursts in a final thunderclap (150 damage to ground troops within 2.2 tiles). Glowing eyes, rain, flickering electricity. |
| Griffin | 4 | Legendary | like the Inferno Dragon | A flying griffin (950 HP) that locks a lightning beam on one target, ground or air: 40 damage a second, then 120, then 360, stepping up every 2 seconds on the same target. The beam starts over on a new target, or when the Griffin is knocked back. |

Balance (`node tools/balance-test.js 120 <name>`): Bees 56%, Owl 46%, Thunder Cloud 53%, Griffin 53%. The bot plays all four: Bees and the Griffin defend, the Owl backs up pushes, and the Thunder Cloud starts pushes from behind the King Tower; it answers a Thunder Cloud with air-hitters.

## Arenas 5 to 10

Six more arenas follow Stormspire on the Trophy Road, four cards each (24 in all). Every card works like a well-known card of the genre (the *Works like* column) with Kingdom Clash's own name, look, sounds and description; its numbers are that card's tournament-level stats brought to this game's level-1 scale (health ×0.69, damage ×0.46, buildings a little sturdier), so they sit beside the older cards. Rarity sets the starting level as for every card (Rare 3, Epic 6, Legendary 9), and they use the same Level 15 upgrade tables and Ruby costs. Cards are in `js/cards.js`, their mechanics in `js/sim.js`, their art in `js/art2.js`, and `node tools/arenas5-10-test.js` checks every mechanic below.

| Arena | Trophies | Theme |
| --- | --- | --- |
| 5 Frostfang Keep | 2,000 | ice and snow |
| 6 Blackwater Harbor | 2,600 | pirates and ocean |
| 7 Gearforge Citadel | 3,300 | machinery and electricity |
| 8 Crystal Chasm | 4,100 | underground crystals |
| 9 Skyward Sanctuary | 5,000 | floating islands and healing |
| 10 Eclipse Throne | 6,000 | dark magic and a fallen kingdom |

| Card | Energy | Rarity | Works like | What it does in the game |
| --- | --- | --- | --- | --- |
| Frost Sprite | 1 | Common | Ice Spirit | Very fast; leaps at the first enemy within 2.5 tiles (air or ground) and bursts, freezing everything within 1.5 tiles for 1.2 s. Used up by the leap. |
| Icebound Giant | 2 | Rare | Ice Golem | Slow, cheap tank that only walks for buildings; when it shatters it damages and slows (35%, 1 s) air and ground in 2 tiles. |
| Winter Sage | 3 | Legendary | Ice Wizard | Range 5.5, small splash, every hit slows 35% for 2.5 s; a frost blast (3 tiles) as he lands. |
| Flash Freeze | 4 | Epic | Freeze | Instant: freezes every enemy troop, building and tower within 3 tiles for 4 s (no moving, no attacking, reloads start over), with a little damage. |
| Dock Raiders | 3 | Common | Goblin Gang | Three very fast cutlass pirates (ground) and two harpoon throwers (range 5, air and ground). |
| Boarding Barrel | 3 | Epic | Goblin Barrel | Thrown from your King Tower to anywhere; breaks on landing and lets out three cutlass pirates. |
| Harpoon Captain | 3 | Legendary | Fisherman | Melee; throws his harpoon at a ground enemy 3.5 to 7 tiles away (0.4 s wind-up, 3 s between throws): a troop is reeled in to him and slowed; a building or tower can't move, so he pulls himself to it. Pulled troops cross the river on the rope. |
| Broadside Cart | 5 | Epic | Cannon Cart | Fast, range 5.5, ground only, behind a plank shield that takes every hit; when the shield breaks it stops and becomes a cannon building (its full health) that crumbles over 30 s. |
| Coil Tower | 4 | Common | Tesla | A building hidden underground (troops and towers can't target it; spells can) until an enemy comes within 5.5 tiles; it rises (0.6 s), zaps air and ground, and sinks again after 1 s with nothing in range. Lasts 30 s. |
| Sparkbots | 4 | Rare | Zappies | Three robots, range 4.5, air and ground; every shot stuns for 0.5 s. |
| Steel Titan | 8 | Epic | Golem | Huge, slow, buildings only; when destroyed it bursts (2 tiles) and splits into two Titanlings, which also go for buildings and burst when they fall. |
| Arc Cannon | 6 | Legendary | Sparky | Slow; charges for 4 s (while moving too) and fires only with a full charge: a 1.8-tile ground splash for very high damage. Any stun or freeze drains the charge. |
| Gem Flash | 2 | Common | Zap | Instant: damage and a 0.5 s stun on troops, buildings and towers within 2.5 tiles. |
| Shard Guards | 3 | Epic | Guards | Three fragile spearmen (range 1.6) with crystal shields: a shield takes the whole of the next hit, however big, before it shatters. |
| Crystal Drill | 4 | Epic | Goblin Drill | A building placed anywhere: it bores from your King Tower (untouchable underground), bursts up (damage in 2 tiles), sends out a Crystal Imp every 3 s and two more when it breaks. Lasts 10 s. |
| Prism Archer | 4 | Legendary | Magic Archer | Range 7; each bolt flies on in a straight line past its target and hits every enemy in its way once. |
| Sun Sprite | 1 | Rare | Heal Spirit | Leaps at an enemy, a small burst of damage, then a glow that heals friendly troops within 2.5 tiles for a second. |
| Celestial Guardian | 4 | Rare | Battle Healer | Melee tank; every swing heals friendly troops within 4 tiles (herself too); she mends herself while not fighting. |
| Cloud Drake | 4 | Epic | Baby Dragon | Flying, range 3.5, splash on air and ground. |
| Dawn Phoenix | 4 | Legendary | Phoenix | Flying melee on air and ground; when destroyed it bursts in flame and leaves an egg; if the egg lasts 4.3 s the Phoenix is reborn (once). |
| Wraith Army | 3 | Epic | Skeleton Army | Fifteen fragile spectral swordsmen. |
| Doom Meteor | 6 | Rare | Rocket | A slow meteor from your King Tower; huge damage in a 2-tile area, a quarter of it on towers, with a knockback. |
| Abyss Gate | 5 | Legendary | Graveyard | A portal over any spot (4 tiles) for 10 s: 13 wraiths climb out at random spots inside it, from 2.2 s on. |
| Dread Knight | 7 | Legendary | Mega Knight | Heavy; a shockwave as he lands (2.2 tiles), every swing splashes ground troops around his target, and he leaps onto a ground enemy 3.5 to 5 tiles away (untouchable in the air), landing with the same shockwave. |

**Rules the engine gained** (all in the deterministic simulation, so they work online too): stuns and freezes (towers and buildings too; a stun resets the reload, drains a charge, breaks a beam, cancels a half-thrown hook), shields that absorb a whole hit, healing (pulses and zones), mixed squads, units that spawn units (on a timer, on death, out of a barrel or a portal), a troop that turns into a building, hidden buildings, piercing straight-line bolts, a hook that pulls troops or its thrower, leaps that cross the river, and an egg that hatches. Old cards are untouched.

**Unlocking:** each card is on the Trophy Road in its arena, and from the moment your best trophies reach an arena its cards are in your chests (never before). Opponents pick them up as their trophies pass where they unlock, and computer players use every one: spells on clumps (Gem Flash and Flash Freeze value stopping a charge or a beam), the Doom Meteor on a tower it would finish, the barrel and portal on the weakest tower, the drill beside it, the Steel Titan from the back, the Sun Sprite to heal hurt defenders.

**Balance** (`node tools/balance-test.js 40 ": "`, each new card in place of a starter card with the same job, both decks at level 9): most new cards win 40 to 68% of decided games against the starter deck. The outliers come down to how the computer plays them: the Coil Tower (23%) and Gem Flash (28%) replace a troop the computer attacks with; the Doom Meteor (90%) finishes towers; the Phoenix was trimmed a little.

**Arena art:** none of the six arenas has its images yet. Each is set up in `js/arenas.js` for the same four images as the arenas before it (a lobby centerpiece with the name, a battlefield on the game's grid with its tower pads, river and two bridges, and two side panels). Until they arrive the battlefield is drawn in code in the arena's own colours, the lobby and the Trophy Road show the arena's name and number on a plaque, and the side panels are a plain gradient in its colours. No other arena's art is used.

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

- Free path: rubies, wild cards, **4 Gold Chests**, and **2 Evolution Shards** in all (tiers 5 and 10).
- Diamond Pass path: the **Snowman Evolution at tier 1**, Gold, Platinum and Legendary Chests, rubies, wild cards, books and 4 more shards.

The Diamond Pass is bought in the **Shop** (first tile in Daily Offers) for **10 diamonds** (`PASS.price` in `js/progress.js`), with a second click to confirm. Members get it as part of their membership (`member` in the save; the membership itself comes with the wallet). An evolution you already own comes as its 6 shards instead. The result screen shows the crowns you earned and any new tier.

## The King Tower

A **King Tower** button in the top bar shows its level (1 to 15). The level sets the health and damage of all three of your towers in battle (8% a level, like card levels; level 1 is a 2,400 HP King Tower and 1,400 HP Archer Towers). To reach level L you need **L cards at level L or higher**: 2 cards at level 2 for level 2, 3 at level 3 for level 3, and so on up to 15 cards at level 15. Upgrading is then free and plays its own scene. Its window shows the towers' stats now and after, how many cards qualify (each card shown, greyed out until it is high enough), and the Upgrade button; the button in the top bar gets a green dot when an upgrade is ready, and upgrading a card that makes it ready says so. Trophy opponents' King Towers use the same rule (counting their collection along with their deck past level 8); trainers stay at level 1. Rules in `kingInfo` and `upgradeKing` in `js/progress.js`.

## Emotes in the Shop

The Shop has an **Emotes** section (and buttons at the top to jump to Daily Offers, Chests or Emotes). There are **33 emotes** to buy. Fifteen are the game's own King: Love Struck, Too Cool, Party Time, Dizzy, Nervous, Facepalm, Blow a Kiss, Hello!, Applause, Shh!, Popcorn, Champion, Mind Blown, Smug and Salute, each animated with its own sound. The other 18 are **card emotes**, one starring each card: its character in the sender's colours, with a move and an effect of its own (the Rhino charges and snorts steam, the Wolves howl musical notes, the Gorilla pounds its chest, the Skeletons rattle with bones flying, the Snowman stands proud in falling snow, the Archers hit a target, the Cannon fires, the Fireball blazes, the Mole peeks out of its hole, the Camel Jockey gallops with its lasso spinning, and so on), drawn from the card art (`portrait(id, w, h, { bare: true, team })` in `js/art.js`). **Three are on sale each day** from all 33 (the same three all day, a new set at midnight, skipping ones you own), each for **5,000 rubies or 1 diamond** (a diamond takes a second click to confirm; `EMOTE_SHOP` in `js/progress.js`). A bought emote is yours for good and joins the eight everyone has in the battle emote panel, which turns pages (an arrow button) once you have more than eight. Each opponent has four of the Shop's emotes of its own to use.

## Cards from chests before the Trophy Road

A chest can give **any card of the arenas you have reached**, found or not, not just the cards you have found. So in Briar Hollow a chest can hold Spears or a Flail Knight before the Trophy Road gets there, and it is found the moment it comes out (shown as *New card!*). Cards of arenas you haven't reached never drop. The Trophy Road still gives its card if you already have it (as copies).

## Emotes

In battle, the speech-bubble button at the bottom left of the arena (or **E**) opens the emote panel over the bottom of the arena: a mute button for the opponent's emotes, eight picture emotes of the game's own King (laughing, crying, angry, thumbs up, amazed, yawning, cheeky, thinking), and six phrases (*Good luck!*, *Nice play!*, *Whoa!*, *Thanks!*, *Good game!*, *Oops!*). An emote pops up beside its player's King Tower, animated, with its own sound, for under three seconds. Three emotes in a row and the panel rests for 3.5 seconds.

The opponent emotes back about a third of the time (more often to *Good game!* after the match), with a fitting reply, and about 40% of the time after taking one of your towers or winning. Muting hides its emotes for that battle. Everything lives in `js/emotes.js`; `KCEmotes.send(team, id)` is the one way an emote goes up, ready for an online opponent later. Chances are in `CHANCE` at the top.

## Magic items

A **Magic Items** tab sits beside the card collection (Cards → Magic Items). Pick an item to see the cards it can be used on, or use it from a card's details window.

- **Wild cards** (common, rare, epic, legendary) count as copies of any card of that rarity and fill up to the copies the card needs for its next level. They come from chests **from Arena 2 on**: none in wooden chests, from 2–4 common in silver up to 30–40 common, 8–12 rare, 2–3 epic and a 10% chance of a legendary in mythic (more with account level).
- **Book of Common / Rare / Epic / Legendary** fill all the copies a card of that rarity still needs for its next level; the **Book of Books** works on any rarity. The **Hammer of Books** upgrades a card one level for free: it fills any copies the card is missing and needs no rubies.
- Books and the hammer are rare finds: never in wooden chests, 0.1% in silver, 0.2% gold, 0.4% platinum, 0.7% legendary and 1% mythic (one roll per chest). Tested over 20,000–40,000 rolls.
- **Evolution shards** have a slot in the tab; nothing gives them yet.
- Item art is drawn in SVG (`js/items.js`), each item built from separate parts. In a chest reveal the parts fly in from every side, each trailing a comet, over a turning magic circle, and snap together; then the item flashes, a shockwave rolls out and its name appears. Books, the hammer and epic or legendary wild cards form more slowly and get a *Rare find!* tag.
- The **Hammer of Books** has a living texture: its head shifts colour, runes scroll across it, a sheen sweeps over it and the book in its face glows, everywhere it is shown. Every item has a passing sheen. With reduced motion, none of it moves.
- **Growing a card has its own scene** (`js/upgrades.js`), over everything, for every way a card grows:
  - *Upgrade with rubies*: copies stream out of the card's bar and rubies pour in from below, the card charges up and shakes, then bursts; the level number slams to the new one, Health and Damage count up, and the XP (and any account level-up) shows.
  - *Hammer of Books*: the hammer swings in and strikes the card three times (sparks, cracks of light, the screen shakes); the third strike bursts it into a rainbow level-up, *Free upgrade!*
  - *Wild cards*: the wild cards fly in one after another and melt into the card, each counting into its bar.
  - *Books and the Book of Books*: the book drops in, shakes and falls open, its pages turn and fly into the card as light, filling its bar; *Upgrade ready!* if it can now level.
  A click (or Space or Enter) skips to the end, another click closes it, Escape closes it. With reduced motion it opens on the end.
- Rules and drop tables are `MAGIC` and `MAGIC_RULES` in `js/progress.js`.

## The economy

Every number is in `ECONOMY` at the top of `js/progress.js`; `tools/economy-report.js` estimates what players earn with them, and `tools/progress-test.js` checks the rules. The aim: cards around **level 7–8 entering Arena 4** and 8–9 at 1,200 trophies, a full deck at level 15 in about a year of regular play.

**Three currencies.**
- **Rubies** (red gems) are the game's own currency: chests, battle wins, the Trophy Road and the Pass pay them; card upgrades, the Shop's card offers and chests, and emotes cost them. They never leave the game, so Kingdom Clash can't be farmed for SirSC Coins. Older saves' coins became Rubies one for one (in their chest slots and Shop offers too); nothing was reset.
- **Coins** are the SirSC wallet's currency (the gold coin chip with ⇄ in the top bar). The game never pays Coins out. They can be swapped one way for Rubies, **1 Coin = 1 Ruby**, up to a **daily limit set by the highest arena reached**: 500 in Arena 1, 1,000 in Arena 2, 2,000 in Arena 3, 4,000 in Arena 4, 6,000 in Arena 5, then 7,000, 8,000, 9,000 and 10,000 from Arena 9. A player with a big wallet gets a head start on Rubies, but copies still hold them back (see the *wallet-rich* column below). **TEMPORARY:** the Coin balance is kept on the device; when the wallet is connected the server must take the Coins and enforce the limit.
- **Diamonds** are the premium currency: the Diamond Pass, chest skips, the mega bundle, emotes, and the 5,000-Ruby bundle. Rubies and Coins never buy Diamonds.

**Upgrades.** Rubies per level are the same for every rarity: 5, 20, 50, 150, 400, 1,000, 2,000, 4,000, 10,000, 15,000, 25,000, 40,000, 60,000, 100,000 (level 1→2 first). A card starts at its rarity's level and pays only the steps from there:

| Rarity | Starts at | Copies per level | Copies to 15 | Rubies to 15 |
| --- | --- | --- | --- | --- |
| Common | 1 | 2, 4, 10, 20, 50, 100, 200, 400, 800, 1,000, 1,500, 2,500, 3,500, 5,500 | 15,586 | 257,625 |
| Rare | 3 | 2, 4, 10, 20, 50, 100, 200, 300, 400, 550, 750, 1,000 | 3,386 | 257,600 |
| Epic | 6 | 2, 4, 10, 20, 30, 50, 70, 100, 130 | 416 | 257,000 |
| Legendary | 9 | 2, 4, 6, 9, 12, 14 | 47 | 250,000 |

The first copy of a card unlocks it and isn't counted as a duplicate. The card window shows the level, copies and Rubies for the next level, what's still missing, the health and damage now and at the next level, and what's left to level 15; the collection shows each card's copies and Ruby cost. Levels 13, 14 and 15 get a grander upgrade scene (level 15 is rainbow and says *Max level!*).

**Rewards scale with trophies first, then account level.** Copies are what limit progress (a big wallet can pay Rubies; it can't make copies), so rewards start small and grow late. The arena your trophies put you in sets the base: cards ×0.30, 0.37, 0.45, 0.55, 1.375, 1.925, 2.75, 3.3, 4.1 and 5.0 for Arenas 1 to 10 (Rubies a little less). Inside an arena rewards climb toward the next arena's, stopping 20% short, so every new arena is a clear step up (at least +15%); the long Stormspire stretch (900 to 2,000) climbs the most, so the late game pays what level 15 costs. Past Eclipse Throne, +5% every 500 trophies up to +30%. The account level multiplies that by 1.5% a level, up to level 40. Which cards can drop depends only on the **highest trophies you've reached**, so a high account level never brings cards of an arena you haven't reached. Values loaded from a save are checked: negative or broken numbers become 0, levels stay between the rarity's start and 15, best trophies are never below current trophies.

**Chests** keep their names, looks and timers. Their base contents (multiplied by the scaling above):

| Chest | Rubies | Cards | Rares | Epics | Legendaries |
| --- | --- | --- | --- | --- | --- |
| Wooden | 15–25 | 6 | 12% chance of one | – | – |
| Silver | 40–60 | 16 | at least 1 | 1% | – |
| Gold | 120–170 | 40 | at least 3 (11%) | 4% | 0.3% |
| Platinum | 320–420 | 90 | at least 8 (13%) | 30% | 2% |
| Legendary | 800–1,000 | 200 | at least 20 (15%) | at least 1, +50% | 8% |
| Mythic | 1,800–2,300 | 420 | at least 45 (16%) | at least 2, +50% | at least 1 |

Epic and legendary chances grow more slowly than the scaling. Floors are shown on the Shop's chest tiles. A rarity with nothing eligible yet is paid in the rarity below (a legendary as 3 epics, an epic as 5 rares). A chest's contents are rolled once, when it is won, bought or claimed, and saved with it, so reopening the game can't reroll them.

**Skipping a chest timer.** Under every waiting chest a blue button opens it now for diamonds: 1 for every 5 minutes of timer left, rounded up (`ECONOMY.skip`). A locked chest costs its whole timer (wooden 1, silver 3, gold 12, platinum 36, legendary 96, mythic 144); an unlocking one gets cheaper as it runs. The first click asks (*Open?*), the second pays and opens it at once; a chest already unlocking in another slot carries on. With too few diamonds it says how many are needed and nothing is spent.

**The Shop.** Card offers hold at most 50 commons, 10 rares or 1 epic (legendaries aren't offered); the 1-diamond mega bundle is 100 commons, 20 rares or 2 epics. Chests for Rubies: **one of each a day**, Wooden and Silver from Arena 1, Gold from Arena 2, Platinum from Arena 3, Legendary and Mythic from Arena 4 (by best trophies). A chest's price is twice its Rubies plus half the value of its cards (a copy is valued at 20 / 200 / 2,000 / 40,000 Rubies by rarity; `ECONOMY.shop.chestPriceScale`), so a bought Mythic costs about 57,000 Rubies in Arena 4. The free daily Wooden Chest holds 3× a normal one.

**Diamond-only sections** (made fresh at midnight; each item sells once a day; `ECONOMY.diamondShop`):
- **Daily Deals**: always two bundles of wild cards and Rubies, each worth over twice its price (the tile shows how much, counting copies at the mega bundle's rate and Rubies at the Ruby bundle's). *Daily deal*: 300 common and 20 rare wild cards and 4,000 Rubies for 2 diamonds in Arenas 2–4; *Big deal*: 800 common, 80 rare and 2 epic wild cards and 15,000 Rubies for 6. Contents and price grow together with the arena (half in Arena 1, up to 3× late), so the value stays the same; epic wild cards appear once an epic card can drop.
- **Magic Shop**: four different magic items a day, only ones you can use, rarer ones less often. Prices: Common Wild Cards ×40 1, Rare Wild Cards ×8 2, Epic Wild Card 4, Legendary Wild Card 12, Evolution Shard 6 (from Arena 3), Book of Common 6, Book of Rare 9, Book of Epic 13, Book of Legendary 17, Book of Books 21, and the **Hammer of Books 25**, the most.
- **Card Shop**: the three best cards your arena can give (highest rarity first, by best trophies; maxed cards skipped): a legendary ×1 for 10 diamonds, an epic ×3 for 6, a rare ×25 for 3 (a common ×150 for 2). A card you haven't found yet is unlocked by its first copy.

**Other sources.** A trophy win pays 10 Rubies × the Ruby scaling for the first 20 wins of each day. Trophy Road Rubies: 10, 30, 60, 145, 240, 420, 600, 900, 1,200. Diamond Pass Rubies: 375 to 1,050 on the free path, 1,125 to 2,250 on the paid one. **There are no daily quests or achievements in the game.**

**Opponents** follow the same curve as players (`ECONOMY.foeLevels`): average card level 1 below 50 trophies, about 4.5 at 300, 6.5 at 600, 7.5 at 900, 8.5 at 1,200, 10 at 1,500, 12 at 2,000, 13.5 at 3,000, 14.5 at 4,000 and 15 from 5,000 (rares, epics and legendaries are then raised to where their rarity starts). Their King Tower uses the players' rule (level N needs N cards at level N), counting the rest of their collection as levelled with their deck once all eight are past 8.

**Estimates** (`node tools/economy-report.js`; it uses the game's own chest rolls; the assumptions are at the top of the file). A day for five kinds of player:

| Player | Trophies | Level | Wins | Chests | Rubies | (of it from wins) | Commons | Rares | Epics | Legendaries | Per common card | Per rare card |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| New player, low trophies | 60 | 2 | 6 | 5.21 | 278 | 18 | 63 | 14.5 | 0.00 | 0.00 | 10.6 | 3.63 |
| Early Arena 1 | 200 | 6 | 8 | 7.99 | 456 | 24 | 104 | 24.3 | 0.00 | 0.00 | 17.3 | 6.07 |
| Mid game, Arena 3 to 4 | 850 | 18 | 10 | 10.0 | 1,095 | 50 | 228 | 42.6 | 0.00 | 0.43 | 22.8 | 6.09 |
| Advanced, high trophies | 2,000 | 32 | 12 | 12.0 | 4,633 | 228 | 942 | 138.8 | 3.18 | 0.68 | 85.7 | 17.4 |
| Late game, chasing level 15 | 4,000 | 40 | 15 | 15.0 | 15,109 | 750 | 3,047 | 445.0 | 6.46 | 0.97 | 277.0 | 55.6 |

A whole career with the starter deck (wild cards and Shop purchases left out; trophies follow a fixed schedule):

| Milestone | Spreading rubies over the deck | Focusing one card first | Casual: half the play, trophies 1.6x slower | Wallet-rich: swaps the daily Coin limit every day |
|---|---|---|---|---|
| first card at 7 | day 10 | day 10 | day 20 | day 7 |
| cards at 600 trophies | day 12: 7 6 7 7 6 7 7 6 | day 12: 7 7 7 7 6 7 6 6 | day 20: 6 6 6 7 7 7 7 7 | day 12: 6 6 6 7 7 8 7 7 |
| deck levels after 2 weeks | 7 7 7 7 6 7 7 7 | 7 7 7 7 7 7 7 7 | 5 5 6 6 6 6 6 5 | 7 6 7 7 7 8 7 7 |
| whole deck at 7 | day 16 | day 14 | day 30 | day 15 |
| cards at 900 trophies | day 21: 8 8 8 7 7 7 8 7 | day 21: 8 8 7 7 7 7 8 8 | day 34: 7 7 7 7 7 8 7 8 | day 21: 8 7 8 8 7 8 8 7 |
| first card at 9 | day 26 | day 26 | day 53 | day 24 |
| cards at 1200 trophies | day 35: 9 9 8 9 8 8 9 8 | day 35: 8 9 9 9 8 8 9 9 | day 56: 8 8 9 8 8 9 8 8 | day 35: 8 8 9 9 9 9 8 9 |
| whole deck at 10 | day 71 (about 2.3 months) | day 70 (about 2.3 months) | day 126 (about 4.1 months) | day 62 (about 2.0 months) |
| first card at 11 | day 75 (about 2.5 months) | day 74 (about 2.4 months) | day 133 (about 4.4 months) | day 67 (about 2.2 months) |
| deck levels after 3 months | 11 11 11 11 10 10 10 10 | 11 11 11 11 10 10 10 10 | 9 9 10 9 9 9 9 9 | 11 11 11 11 11 11 11 11 |
| cards at 2000 trophies | day 132: 12 12 12 12 11 11 11 11 | day 132: 12 12 12 12 11 11 11 11 | day 212: 11 12 12 11 11 11 11 11 | day 132: 12 13 13 13 13 12 12 12 |
| whole deck at 12 | day 150 (about 4.9 months) | day 149 (about 4.9 months) | day 263 (about 8.7 months) | day 118 (about 3.9 months) |
| first card at 13 | day 156 (about 5.1 months) | day 156 (about 5.1 months) | day 277 (about 9.1 months) | day 127 (about 4.2 months) |
| first card at 14 | day 208 (about 6.8 months) | day 208 (about 6.8 months) | day 374 (about 12.3 months) | day 161 (about 5.3 months) |
| whole deck at 14 | day 264 (about 8.7 months) | day 264 (about 8.7 months) | day 477 (about 15.7 months) | day 188 (about 6.2 months) |
| first card at 15 | day 276 (about 9.1 months) | day 277 (about 9.1 months) | day 498 (about 16.4 months) | day 206 (about 6.8 months) |
| whole deck at 15 | day 356 (about 11.7 months) | day 356 (about 11.7 months) | day 641 (about 21.1 months) | day 234 (about 7.7 months) |
| deck levels after 1 year | all at 15 already | all at 15 already | 13 13 13 13 13 13 13 13 | all at 15 already |

## The Trophy Road and Arena 1

Rules live in `js/progress.js` (no screen code; tested by `tools/progress-test.js`).

- **Opening it**: beat Owen, Romeo and Luc. The Battle button then plays trophy battles in **Arena 1: Cinder Keep** (trainers can still be replayed from the Trainers panel, for no trophies).
- **Trophies**: a win is +30, a loss is −20, never below the arena's floor (0 in Arena 1). Arena 2 is at 300 trophies and is marked *coming soon*.
- **Opponents**: computer players with ordinary player names and portraits (nothing in the game labels them). They don't talk: no speech bubbles and no line on the result screen (trainers still do). Their **cards level up one at a time with their trophies**, along the same curve as a player's cards (see *The economy*: about 7–8 entering Arena 4, 15 at 4,000 trophies). Which cards are ahead differs from opponent to opponent, and levels show on their units' health bars. Their skill follows your results: a step harder after a win, a step easier after a loss. In the headless test (150 matches), a good player who kept their cards level with their trophies won 51% once settled and a sloppy one 52%; a good player who never upgraded won 42% and slid back to about 300 trophies with the opponents near their easiest.
- **Road rewards** (claimed on the Trophy Road tab): 20 trophies 50 rubies · 40 **Skeleton Pack** ×6 · 60 Silver Chest · 90 100 rubies · 120 **Cannon** ×4 · 160 Silver Chest · 200 200 rubies · 250 Gold Chest · 300 Arena 2 (coming soon).
- **Chests**: six tiers: Wooden, Silver, Gold, Platinum, Legendary and Mythic (Legendary and Mythic are animated: a pulsing halo, sparkles circling and, on the Mythic, a colour shimmer and float). A trophy win puts a chest in the first free slot (four slots), in a fixed repeating order of 24 that includes every tier. **Arena gate**: each arena allows higher tiers (Arena 1 wooden and silver, Arena 2 adds gold, Arena 3 platinum, Arena 4 legendary, Arena 5 mythic); a chest above the player's arena is given as the highest tier they have reached, in wins, Trophy Road rewards and the Shop. The gate is in `CHEST_RULES` in `js/progress.js` and is **switched off for now** (`allUnlocked: true`), so every tier drops everywhere. Its contents are decided when it is won. One chest unlocks at a time on a real-time timer (wooden 1 minute, silver 15 minutes, gold 1 hour, platinum 3 hours, legendary 8, mythic 12). **Opening** is a scene of its own: the chest (wooden planks and iron, steel with a blue gem, or gold with a crown) drops in and rattles; a click cracks the lid open in a burst of light rays and sparkles; then each reward comes out one at a time. Rubies count up with a ruby shower. A card flies out face down, glowing in its rarity's colour (rares and new cards shake and take longer), flips over, and its copies count into its level bar, ending on *Upgrade ready!* when it fills. A click during a reveal finishes it, a click after moves on; a badge on the chest counts what's left; a summary closes the scene. Every step has its own sound. Trophy Road cards and Shop purchases use the same reveal without a chest.
- **The Shop** (Shop tab): five offers a day, made from the cards you have found and their levels, each showing exactly what you get. (1) *Closest to upgrade*: the copies your nearest card is missing. (2) *Rare pick*: a rare, one level's worth. (3) *Catch up*: your lowest-level card, cards found on the Trophy Road first. (4) *Mega bundle*: 100 commons, 20 rares or 2 epics of a deck card for 1 diamond. (5) *Ruby bundle*: 5,000 rubies for 1 diamond, buyable any number of times. Card offers hold at most 50 commons, 10 rares or 1 epic; legendaries aren't offered. A copy is priced at 20 rubies (common), 200 (rare), 2,000 (epic) or 40,000 (legendary); 1 diamond = 5,000 rubies (diamonds buy rubies; rubies never buy diamonds). Card offers sell once a day; offers change at local midnight (the clock on the tab is real). Cards you haven't found and cards at level 15 are never offered. Diamond purchases take a second click to confirm. Three more sections sell for diamonds only: **Daily Deals**, the **Magic Shop** and the **Card Shop** (see *The economy*). A second row sells **chests for rubies only**, one of each a day (bigger chests from later arenas), with what is inside hidden until opened (each tile shows the card count and ruby range): a **free Wooden Chest** once a day, then Wooden, Silver, Gold, Platinum, Legendary and Mythic. A bought chest opens on the spot (no slot, no timer). **Contents and prices follow the same reward scaling as won chests** (trophies first, then account level; see *The economy*), and a chest's price is twice its rubies plus half the value of its cards. The free daily Wooden Chest holds 3× a normal wooden chest. Diamonds are a number saved on the device for now (0 unless the test button is used); there is no way to buy them in the game. When the SirSC wallet is connected, prices and purchases must be decided by the server.
- **Test buttons (temporary)**: *Simulate Win* (in the lobby and in a battle), *1,000,000 rubies, coins & diamonds* (lobby), *New offers* (Shop) and *Give magic items* (Magic Items). Each is marked `TEMPORARY` in the code.
- **Card levels**: copies plus rubies level a card up, to 15 at most; rares start at level 3, epics at 6, legendaries at 9 (the tables are in *The economy*). Each level adds 8% health and damage. Units in battle show their level on their health bar.
- **Arena cards stay in Arena 1**: Skeleton Pack and Cannon are only found on the Trophy Road. Trainers never use them, and in a Training Grounds match your deck goes back to the eight starter cards (each Arena 1 card swaps for a starter card you left out).
- **Rubies** are the game's own currency and stay in the game. **Coins** are the SirSC wallet's, swapped one way for Rubies with a daily limit (see *The economy*). Both, and Diamonds, are kept on this device for now; when the wallet is connected the server must decide Coin and Diamond spending.
- **Arena 1 art**: Cinder Keep has its own four illustrations: the lobby badge, the volcanic grandstand (left) and the lavafall (right) battle scenery, and the molten battlefield itself (dark stone, lava river, reinforced bridges, corner braziers), with ember, lava-glow, heat-shimmer and fiery-explosion effects on top.

| New card | Energy | Rarity | What it does |
| --- | --- | --- | --- |
| Skeleton Pack | 1 | Common | Three skeletons (40 HP, 40 damage each), fast, ground only |
| Cannon | 3 | Common | A building: 700 HP, 70 damage every 0.9 s at ground troops within 5.5 tiles, lasts 30 seconds. Rhinos go for it before towers. |

## Unlocking a new card

Every time a card comes out of a chest, the Trophy Road, the Shop or the Diamond Pass, it gets the show for its rarity (`unlock` in `js/menu.js`), each with its own sound and banner (*New …!* the first time, then *Rare!*, *Epic!* or *Legendary!*; commons show no banner once found):

- **Common** (*New card!*): a blue sparkle burst, then the card flips with a shine.
- **Rare** (*New Rare!*): the card shakes as embers rise off it, then it flips over in a double flash and a small burst of gold rays turns behind it.
- **Epic** (*New Epic!*): the screen dims, a violet vortex turns behind the shaking card and lightning streaks into it, then the vortex implodes and the card flips in a shockwave.
- **Legendary** (*Legendary!*): the screen goes dark, rainbow beams sweep, the card comes down slowly inside a spinning rainbow halo while rainbow comets pour into it, the screen rumbles, a white-out, then the card flips to rainbow fireworks and a shimmering banner.

A click skips to the end.

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
| `js/art2.js` | The troops, buildings, card pictures and spell art of Arenas 5 to 10, drawn in code in the style of `js/art.js` and added to it |
| `tools/arenas5-10-test.js` | `node tools/arenas5-10-test.js` deploys all 24 new cards, checks each one's energy and rarity and every special mechanic (freeze, stun, shields, splitting, charging, hooks, hiding, piercing, healing, the egg, the portal, the jump), and has the computer play every card in full battles |
| `tools/economy-report.js` | `node tools/economy-report.js` prints a day's rubies and copies for five kinds of player and the days to each upgrade milestone, using `ECONOMY` and the game's chest rolls |
| `tools/progress-test.js` | `node tools/progress-test.js [matches]` checks old saves, trophies, chests and timers, road rewards, upgrades, the deck and the Training Grounds deck rule, the Shop's offers and purchases, Sunstone Arena, evolutions and the Diamond Pass (2 free shards, the Snowman Evolution at tier 1, claiming, buying), then plays trophy matches to check the 52% target |
| `tools/balance-test.js` | `node tools/balance-test.js [matches]` plays decks with the Briar Hollow cards against the starter deck and times one-on-one trades |
| `tools/sim-test.js` | `node tools/sim-test.js 40` plays 40 bot-vs-bot matches headless and checks they end cleanly (no NaNs, no troops in the river) |
| `img/` | Arena art (see *Arena art*): the Training Grounds and Cinder Keep centerpieces (transparent), scenery panels (793 × 1983) and the Cinder Keep battlefield (1024 × 1536) |
| `build-artifact.py` | Bundles everything into one page, with the images baked in as data URIs: `python3 build-artifact.py OUT.html` (claude.ai Artifact) or `--standalone` (a complete page) |

Built copies are in `dist/`: `kingdom-clash.html` (Artifact bundle) and `kingdom-clash-standalone.html` (open anywhere, works offline apart from the Google font, which falls back to a system font).

The game saves your progress (trainers beaten, records, name, experience) and the sound setting in the browser's local storage only.
