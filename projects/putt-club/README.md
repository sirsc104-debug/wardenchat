# SirSC's Putt Club

Mini golf in 3D, played against three rivals. Each difficulty has its own course: **the Garden** (Owen), 27 holes each built around its own garden trick; **the Canyon** (Medium), 27 desert holes built around cacti that pop the ball and tumbleweeds that blow across the green; **the Winter Wonderland** (Hard), 27 snowy holes among gingerbread houses and candy canes, with ice, thin ice, snowdrifts, sliding penguins and rolling snowballs; and **the Abyss** (Ultra), 18 holes of par 6 and up in an underground volcanic temple, floating over a lava abyss with no rails at all. Every round deals a random 9 or 18 from one course. Training lists all 99 holes and lets you practise any one of them. Rounds pay SirSC coins into the shared SirSC wallet, the Shop sells looks (balls, trails, hole-out celebrations, flags, scenery and avatars) for coins or diamonds, and friends can play the same holes together online.

Plain HTML, CSS and JavaScript with three.js r128 from cdnjs. There is no build step for playing locally: serve the folder with `python3 -m http.server` and open `index.html`. All textures are painted on canvases and all sound is synthesised, so there are no image or audio files.

## The menu

The title screen copies the SirSC games' menu (Bigger Fish, Tower Defense, Brain Rocket): the SirSC's logo, a three-tab toggle (**9 holes**, **18 holes**, **Play online**), one card per difficulty, and a rules panel. The top-left corner holds your Warden Chat account (or *Sign in*), your coins and diamonds, the SirSC Member badge if you're a member, the **Shop** and **Training** (every hole, to practise on its own). Each length and difficulty keeps its own best score.

## Difficulties

| Difficulty | Course | Aim guide | Rivals |
| --- | --- | --- | --- |
| Owen | Garden | The whole putt, played out in a copy of the hole, so it shows every bounce, slope and current exactly. The cup also pulls a little harder. | Owen, Clover, Fern |
| Medium | Canyon | A line to the first wall and one bounce. Cacti pop the ball. | Fern, Bramble, Blaze |
| Hard | Winter Wonderland | A short line that only shows direction. Ice, thin ice, snowdrifts, penguins and snowballs. | Bramble, Blaze, Thorn |
| Ultra | The Abyss | None: just the arrow. No rails anywhere, so any edge is a drop. Springs: gold ones jump walls, red ones throw you off the edge. Par 6 to 11, and you pick up at par + 5. | Thorn, Cinder, SirSC |

## Rivals

Rivals play the same hole at the same time as you, each in its own copy of the hole, and show as see-through ghost balls with name tags (the tags fade near your ball). A panel under the score shows how each is doing, and a feed reports their putts. They choose putts the way the hole-testing bot does: a map of the distance along the course to the cup, a spread of candidate putts, each one played out in a copy of the hole, and the best few checked again with small mistakes added so they avoid knife-edge shots. Each rival then misses by an amount set by its skill. The thinking runs in Web Workers, one per rival, built from the same physics source as the page. If you finish first, the game speeds up 3× while they finish (Skip ends the wait), and the scorecard has a row for everyone plus the standings.

## Playing

| Control | What it does |
| --- | --- |
| Drag back and let go | Putt. Press anywhere, pull away from where you want the ball to go, and release. Further means harder. |
| Arrows or WASD, then Space | Aim left and right, set power up and down, Space putts. Hold Shift to aim finely. |
| C or *Whole hole* | Toggle between the ball camera and a view of the whole hole. |
| Q / E or the ⟲ ⟳ buttons, right-drag | Turn the camera. Scroll or pinch to zoom. |
| Esc or *Menu* | Pause, with the how-to and sound toggles. M toggles music, N toggles sound. |

Water, flowerbeds, cacti, gulches, thin ice that gives way, lava, fire pits and the edges of the Abyss cost one penalty stroke and put the ball back where it was putted from. Eight strokes is the most on a Garden hole and par + 5 in the Abyss. After each hole a scorecard is filled in, golf style: birdies are circled, eagles double circled, bogeys boxed. Best rounds for each length and difficulty, your best on each hole and holes in one are kept in the browser.

## The Garden: 27 holes (Owen)

| # | Hole | Par | Its garden trick |
| --- | --- | --- | --- |
| 1 | Pinwheel Patch | 2 | Striped pinwheel vanes turn like a revolving door in the middle. |
| 2 | Sprinkler Sweep | 3 | Two turning sprinklers on a dogleg; their jets shove a rolling ball. |
| 3 | Lily Pad Ferry | 3 | A lily pad drifts across the pond and waits at each shore. Ride it over. |
| 4 | Mole Tunnels | 3 | A hedge blocks the way; molehills tunnel to partners on the other side. |
| 5 | Gnome Parade | 3 | Three garden gnomes march back and forth across the lane. |
| 6 | Pumpkin Pinball | 2 | Springy pumpkins kick the ball away faster than it arrived. |
| 7 | Mushroom Hop | 3 | A red mushroom bounces the ball over a hedge; the long way round costs a stroke. |
| 8 | Wheelbarrow Jump | 3 | Hit it up a tipped wheelbarrow to fly a tulip bed. |
| 9 | Hedge Maze | 3 | A box-hedge maze with two narrow arches for a shortcut. |
| 10 | Rockery Summit | 3 | The cup sits on top of a mound ringed with rocks. |
| 11 | Sunflower Bowl | 2 | A giant sunflower that dips toward the cup in the middle. |
| 12 | Babbling Brook | 3 | A shallow brook whose current carries the ball downstream. |
| 13 | Koi Bridge | 3 | A humped bridge over a koi pond. |
| 14 | Tire Swing | 3 | A tire swings across the lane from an oak. |
| 15 | Snail Trail | 3 | A slick slime trail round a dogleg, and the snail that left it. |
| 16 | Honey Pots | 3 | Honey puddles stop a ball dead, by a buzzing hive. |
| 17 | Autumn Gust | 3 | Gusts blow leaves and the ball toward a pond. Watch the windsock. |
| 18 | Carrot Rows | 3 | Ridged carrot rows slow the ball and steer it along them. |
| 19 | Lazy Daisy | 3 | A turning daisy flowerbed carries the ball round, pots and all. |
| 20 | Roving Flowerpot | 3 | The cup rides back and forth in a flowerpot. |
| 21 | Seesaw Plank | 3 | A plank over a ditch rocks from side to side. |
| 22 | Beanstalk Bridge | 3 | Roll over the seed packet and a beanstalk bridges the pond for 14 seconds. |
| 23 | Tulip Gates | 3 | Three hedge rows, each with a leafy gate that opens and shuts. |
| 24 | Greenhouse Pegs | 3 | Downhill through rows of potted plants inside a greenhouse. |
| 25 | Trellis Bank | 2 | The cup hides behind springy rose trellises: bank it. |
| 26 | Terrace Falls | 3 | Three stone terraces step down beside a waterfall. |
| 27 | Dandelion Boost | 3 | Dandelion clocks blow the ball along a zigzag. |

## The Canyon: 27 holes (Medium)

A desert of red sandstone: mesas, buttes and spires on the horizon, saguaros dotted over the plain, and vultures circling overhead. The greens are terracotta felt inside plank or sandstone rails. Every hole is built around two things:

- **Cacti** pop the ball on contact: a penalty stroke, back to where you putted from. Saguaros are tall and thin, barrel cacti short and round, prickly pear wide, cholla fuzzy. A ball can fly over the short ones but never through a saguaro.
- **Tumbleweeds** blow round each hole on fixed routes, speeding up and slowing down like gusts of wind, and the ball bounces off them. Their routes are always the same, so you can learn their timing.

| # | Hole | Par | Its trick |
| --- | --- | --- | --- |
| 1 | Saguaro Gate | 3 | Two tall saguaros guard the middle; thread the gap, then dodge the tumbleweed behind. |
| 2 | Prickly Slalom | 3 | Three rows of prickly pear, each with one gap on alternate sides. |
| 3 | Tumbleweed Alley | 3 | Three tumbleweeds blow back and forth across a long alley, each in its own rhythm. |
| 4 | Barrel Ring | 3 | The cup sits in a ring of barrel cacti, open only to the east and west. |
| 5 | Cholla Corner | 3 | Cholla crowd the inside of a dogleg, so you can't cut the corner. |
| 6 | Mesa Top | 3 | Up a ramp onto a mesa, barrel cacti either side. |
| 7 | Dry Wash | 3 | A dry wash cuts across the hole, tumbleweeds rolling along its bed and cacti on both banks. |
| 8 | Sand Trap Flats | 3 | Sand traps with a cactus growing in each. |
| 9 | Dust Devil | 3 | Gusts of dust blow the ball toward a patch of cholla; a windpump spins with each gust. |
| 10 | Rattlesnake Slot | 4 | A narrow slot canyon winds back and forth, cacti tucked into its bends. |
| 11 | Saloon Doors | 3 | The only way through the fence is a pair of saloon doors swinging open and shut. |
| 12 | Mine Shaft | 3 | Two mine shafts run under a rock ridge; one comes out facing a cactus. |
| 13 | Gulch Bridge | 3 | A plank bridge over a deep gulch, with a tumbleweed rolling along it. |
| 14 | Rock Arch | 3 | A natural sandstone arch, prickly pear beside its legs. |
| 15 | Cactus Garden | 4 | Slanting rows of cactus, each with its gap at the high end. |
| 16 | Hoodoo Pinball | 3 | Springy hoodoo rocks fling the ball about between barrel cacti. |
| 17 | Dune Ridge | 3 | Dunes ripple across the lane, prickly pear in the hollows. |
| 18 | Wagon Wheel | 3 | An old wagon wheel turns like a turnstile; cacti wait in the side bays. |
| 19 | Coyote Bowl | 2 | A bowl running down to the cup, with barrel cacti on its slopes. |
| 20 | Plank Seesaw | 3 | The only way over the gulch is a plank that rocks from side to side. |
| 21 | Switchback Trail | 4 | A trail stepping down two ledges, each lined with barrel cacti and the way down at alternate ends. |
| 22 | Tumble Twins | 3 | Two tumbleweeds trace a figure of eight right over the cup. |
| 23 | Box Canyon | 3 | A wall of barrel cacti with one narrow gap, and a tumbleweed patrolling it. |
| 24 | Oasis | 3 | A spring-fed pool among palms, cacti on its banks. |
| 25 | Ghost Town | 4 | Main street between false-front shops, fenced into three stretches with saloon doors and a tumbleweed. |
| 26 | Canyon Rim | 3 | A lane along the canyon edge with no rail, and tumbleweeds blowing toward the drop. |
| 27 | Sunset Mesa | 4 | One narrow ramp up a mesa at sunset, a tumbleweed rolling up and down it. |

## The Winter Wonderland: 27 holes (Hard)

A snowy valley ringed by white-capped mountains, with snow falling, snow-laden pines, gingerbread houses with iced roofs and glowing windows, giant candy canes, lollipops and snowmen. The greens are evergreen felt inside candy-cane rails, and the tee is a knitted mat. Every hole uses some of these:

- **Ice** keeps the ball sliding long after it would stop on felt.
- **Thin ice** sits over freezing water. The moment any ball rolls onto it, it starts to crack, and exactly 4 seconds later it breaks, whatever happens: a ball still on it falls through (a penalty stroke), and that sheet stays broken for the rest of the hole. Each player has their own copy of the hole, so your ice only breaks under your ball. There is always another way round, and if the spot you putted from has gone, the ball goes back to the nearest solid green.
- **Snowdrifts** stop the ball dead.
- **Penguins** belly-slide back and forth across the lanes and knock the ball away.
- **Snowballs** roll down slopes toward you, speeding up and growing as they come, then burst at the bottom while the next one sets off.
- Winter versions of the moving parts: a peppermint turnstile, gumdrop bumpers, candy cane gates, gingerbread houses you tunnel between, a giant bauble swinging over an ice bridge, an ice floe ferry, a ski jump, a turning ice rink, a sleigh carrying the cup, a gift-box spring and blizzard gusts.

Each par is the test bot's strokes plus one, so Hard is tight: five holes are par 2.

| # | Hole | Par | Its trick |
| --- | --- | --- | --- |
| 1 | Candy Cane Lane | 3 | A dogleg across slick ice with a candy cane slalom and a penguin in the corner. |
| 2 | Penguin Parade | 3 | Three penguins sliding across, between gingerbread fences with gaps on opposite sides. |
| 3 | Thin Ice Crossing | 3 | Thin ice across a frozen pond, or the long way through a drift; the cup hides behind a snowbank. |
| 4 | Gingerbread Village | 4 | Tunnel through gingerbread houses under a wall, then past a penguin in the gap of a snowbank. |
| 5 | Snowball Slope | 3 | Putt uphill while snowballs roll down three lanes at you. |
| 6 | Gumdrop Pinball | 3 | Springy gumdrops on ice, and a fence across the front of the cup. |
| 7 | Peppermint Twist | 3 | A peppermint turnstile with snowdrifts in the side bays. |
| 8 | Frozen Pond | 2 | Snowmen on a skating pond, with the cup out on the ice. |
| 9 | Ice Floe Ferry | 3 | Ride an ice floe across freezing water. |
| 10 | Ski Jump | 3 | Hit the jump fast enough to fly a deep snowdrift. |
| 11 | Blizzard Pass | 4 | Gusts blow toward an unrailed drop, and snowbanks force you along the edge. |
| 12 | Snowman Alley | 3 | A crowd of snowmen, then a fence gap with a penguin sliding across it. |
| 13 | Ornament Swing | 3 | A giant bauble swinging over a narrow, railless ice bridge. |
| 14 | Toboggan Run | 3 | A winding downhill run, icy on its straights. |
| 15 | Ice Rink | 3 | A turning ice rink carries the ball round, with snowmen riding on it. |
| 16 | Sleigh Ride | 2 | The cup rides in a sleigh behind a fence open only at its ends. |
| 17 | Cracking Shortcut | 3 | Straight across a thin-ice lake, or up, across and back down. |
| 18 | Avalanche | 3 | Four lanes of snowballs down a steep slope, with two drifts to shelter in. |
| 19 | Candy Cane Gates | 4 | Three gingerbread fences, each with a swinging candy cane gate. |
| 20 | Present Hop | 3 | A wall of presents you hop with a gold gift-box spring. |
| 21 | Penguin Slide | 2 | Penguins sliding diagonally down an ice chute. |
| 22 | Frosty's Maze | 4 | A snowbank switchback with an icy middle run. |
| 23 | Snow Globe | 2 | An icy bowl with snowmen in the middle and the cup on the far rim. |
| 24 | Snowdrift Dunes | 3 | Rows of snowdrifts, each with one gap, and a penguin. |
| 25 | Lift Line | 3 | Three ledges under a running chairlift, with a penguin and a snowball. |
| 26 | Hockey Rink | 2 | A penguin goalie in the goal mouth, with snowman defenders. |
| 27 | Gingerbread Summit | 4 | Two ramps up to a gingerbread house, past a penguin, a snowball and thin ice. |

## The Abyss: 18 holes (Ultra)

An underground volcanic temple suspended over a lava abyss. The small pits in the platforms are fire pits, with flames licking up out of glowing coals. The platforms are ancient flagstones on stone columns with a thin bronze inlay along every drop. Around them: obsidian cliffs and a stalactite roof, lava falls pouring down the cliff walls, a temple facade carved into the rock ahead, giant pillars with carved bands of glowing runes, ruined islands drifting in the dark, smoke and embers rising, and light falling through cracks in the roof. A colossal rune wheel turns slowly in the abyss below the course, chained to the cliffs; runes appear only on the pillars, the facade and the wheels.

Every hole is built so that even perfect aim needs several putts: corners with nothing to bank off, ledges that only meet for a short stretch, slabs you must land on and stop. Springs come in two kinds: a gold spring throws the ball up and on, over a wall it could never get past otherwise (it only fires if you roll onto it heading for the far side, and its landing spot is ringed in gold), and a red spring flings the ball off the edge the way its arrow points. Each par is the strokes the test bot needed, plus two (the bot never misses).

| # | Hole | Par | Its trick |
| --- | --- | --- | --- |
| 1 | Gates of Dis | 8 | A narrow causeway turning at every corner, with an iron gate slamming across each leg and red springs on two corners. |
| 2 | Reaper's Mill | 7 | Two discs of sweeping blades, joined by thin bridges that leave at right angles. |
| 3 | Imp Patrol | 9 | Seven legs with no edges, an imp pacing across most of them, and a wall you jump with a gold spring. |
| 4 | Magma Pinball | 7 | Two arenas of magma boulders whose exits are nowhere near their entrances, with red springs by the edges. |
| 5 | Geyser Leap | 7 | Four floating slabs; each geyser throws the ball the way it rolls, and the next slab is off to one side. |
| 6 | Raft of Charon | 9 | Three rafts across a lava lake, north, then east, then north again. |
| 7 | Portal Maze | 6 | Slabs joined only by paired portals (one sends you back to the tee); the cup sits in a lava ring open at the back. |
| 8 | Doom Pendulum | 7 | Four spiked balls on chains from the roof, swinging across a narrow L-shaped bridge, and a wall to spring over. |
| 9 | Rune Wheel | 6 | The great rune wheel: three bridges leave it and only one leads on, to a second wheel turning the other way. |
| 10 | Obsidian Slide | 8 | A causeway that turns five times, much of it polished obsidian as slippery as ice. |
| 11 | Tar Pits | 7 | Rows of lava pools with one gap each, a wall only a gold spring gets you over (the red one throws you off), and a lava ring round the cup. |
| 12 | Ash River | 8 | A winding causeway with a river of ash running down it, against you. |
| 13 | Volcano Summit | 7 | Lava down every slope but two narrow ridges; work round the base, then climb to the crater. |
| 14 | The Crater | 8 | A crooked bridge into a crater sloping down to lava, with the cup on a mesa reached by two steep ramps. |
| 15 | Bone Bridge | 7 | Runes raise bone bridges over two lava channels; a rocking slab crosses the one between. |
| 16 | Soul Cart | 7 | Fire jets blast across thin bridges with three turns; the cup rides on a cart between lava pools. |
| 17 | Sulfur Winds | 11 | Gusts blowing across thin causeways with no edges, and a wall to spring over between gusts. |
| 18 | The Descent | 7 | Five ledges down, each meeting the next only for a short stretch off to one side, and a red spring on the third. |

## SirSC accounts, coins, diamonds and the Shop

Putt Club signs in with the same Warden Chat accounts as SirSC's other games and uses the shared SirSC wallet (the one Downhill Death Run and Wildcard Chess use): coins, diamonds and membership are the same everywhere. The back end is Warden Chat's Supabase project; the game only asks, the server decides every balance, price and reward. Until the server answers `putt_ping` (the Putt Club back end isn't deployed yet), accounts stay hidden and everything else works as before: the Shop can be browsed and previewed but not bought from.

- **Coins** are paid at the end of every round against the rivals: 400 for 9 holes on Owen, 800 on Medium, 1,500 on Hard, 3,000 on Ultra, doubled for 18 holes, ×0.6 for 2nd, ×0.4 for 3rd and ×0.25 for 4th, plus 150 for every stroke under par (up to 3,000), 500 for each hole in one (up to 3) and 1,500 for the first win each day. Members get 1.5×. Up to 25,000 coins a day from Putt Club. Training and online rounds don't pay.
- **Diamonds** are bought from SirSC (5 for $1, paid in person): the Shop's Diamonds tab sends a request and SirSC adds them. 1 💎 = 5,000 coins; anything sold for coins costs 75% of its diamond price in coins, and the best things are diamonds only.
- **SirSC Membership** ($3 a month, across all SirSC games): 1.5× coins, 5 💎 a month, the SirSC Diamond badge by your name, each month's members' scenery to keep (November 2026: Harvest Moon), and the SirSC Diamond ball, Diamond Dust trail, SirSC Standard flag and SirSC Royalty avatar while a member.
- **The Shop** shows a live practice green beside the panel: pick anything and the ball putts in wearing it, scenery included. Balls (Sunny Yellow to Galaxy), trails (Sparkle, Bubbles, Petals, Rainbow, Fire, Stardust), hole-outs (Balloons, Bubble Burst, Fireworks, Snow Globe, Thunderstrike, Gold Rush), flags, scenery that changes the sky and light on every course except the Abyss (Golden Sunset, Cherry Blossom with falling petals, Starry Night with lanterns, Northern Lights, Fireworks Night, Harvest Moon) and avatars. Four picks are featured each week. It's all looks: nothing changes how a ball plays.

The contract for the back end is `docs/ECONOMY-PUTT.md` (with `docs/CODEX-PROMPT-PUTT.md`, the prompt for building it in `sirsc104-debug/warden-chat`).

## Playing online

Signed-in players pick **Play online**, make a room on any course (9 or 18 holes) and send friends the 5-letter code; up to 4 players, and the host tees off. The server deals the holes. Everyone plays their own ball on their own device; each putt is sent once the ball stops (where it was hit from, the physics step, angle and strength, and where it ended), and every other device replays it with the same physics, so friends show as ghost balls with their avatars, exactly like the rivals. Each hole score is reported when the player holes out, and the scorecard fills in for everyone. If someone drops out, the round goes on without them. Online rounds don't pay coins yet. The contract is `docs/ONLINE-PUTT.md` (prompt: `docs/CODEX-PROMPT-ONLINE-PUTT.md`).

## The demo build

`python3 build-artifact.py dist/putt-club-demo.html --wallet-demo` adds `js/wallet-mock.js`, a pretend back end that follows both contracts and keeps everything in the browser: any username with a 10-character password signs in, new accounts start with 40,000 coins and 10 diamonds, the Membership tab has a button to try a month of membership, and online rooms fill with pretend friends who really play each hole (in a Web Worker, with the rivals' aiming) and send their putts the way a real player's game would. Any 5-letter code joins a room a pretend friend has made.

## Testing the holes

`node tools/test-holes.js` (add `garden`, `canyon`, `winter` or `abyss` to test one course) plays every hole with a search bot (it tries hundreds of putts per stroke and keeps the one that gets closest along the course) and reports how many strokes it needed and how often a random putt from the tee is a hole in one. Pass hole ids or numbers to test just those. It fails if a hole can't be finished within its stroke limit or if the tee, cup or a post is off the green. `node tools/test-rivals.js abyss 0.97` plays each hole three times with the rivals' own shot search at a given skill and reports their strokes.

## Single-file build

`python3 build-artifact.py dist/putt-club.html` inlines the CSS and scripts into one page for publishing as an artifact (three.js still loads from cdnjs). Add `--standalone` for a complete page to open anywhere, and `--wallet-demo` for the demo build.

## Files

```
index.html          page shell and screens
css/style.css       all styling
js/util.js          math and 2D geometry
js/physics.js       ball physics (no three.js; also runs in Node)
js/features.js      the moving and special parts of each hole (physics)
js/holes.js         the 27 Garden holes
js/canyon.js        the 27 Canyon holes
js/winter.js        the 27 Winter Wonderland holes
js/abyss.js         the 18 Abyss holes
js/nav.js           the rivals' course map and shot search (also runs in their workers)
js/bots.js          the rivals: workers, timing, skill
js/textures.js      canvas-painted textures
js/world.js         the three.js scene: greens, rails, water, cup, ball, effects
js/vis.js           the garden around each hole and how each feature looks
js/vis-abyss.js     the volcanic temple and the Abyss versions of each feature
js/vis-canyon.js    the desert, cacti, tumbleweeds, springs and the Canyon versions of each feature
js/vis-winter.js    the wonderland, thin ice, snowballs, penguins and the winter versions of each feature
js/vis-cosmetics.js how the Shop's balls, trails, hole-outs, flags and scenery look
js/audio.js         synthesised sound effects and music
js/wallet.js        Warden Chat sign-in and the SirSC wallet (ported from Wildcard Chess)
js/wallet-mock.js   the pretend back end, demo builds only
js/cosmetics.js     the catalog, names and which cosmetics this device wears
js/shop.js          the account pills, sign-in, the Shop and the coins after a round
js/online.js        online rooms, and the friends' ghost balls that replay their putts
js/game.js          menu, difficulties, rounds, rivals, scoring, camera, controls and screens
docs/               the back-end contracts and the prompts for building them
tools/test-holes.js the hole-testing bot
tools/test-rivals.js the rivals' shot search on every hole
```
