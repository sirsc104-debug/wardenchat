# Sands of the Pharaoh

A Clash of Clans–style strategy game set in Ancient Egypt. Build a town around your Pyramid, mine gold, pump goop, train an army and raid rival towns. It is plain HTML, CSS and JavaScript with no build step and no dependencies, and it lives beside the clicker game without touching it.

## Play

Open `pharaoh/index.html` in a browser, or serve the repository and visit `/pharaoh/`:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/pharaoh/
```

Your town saves in the browser and keeps running while the game is closed: mines fill up, builders finish, troops train and rivals attack.

## How it works

| System | Details |
| --- | --- |
| Resources | **Gold** builds and upgrades most buildings, **Goop** trains troops, pays for research and builds army buildings, and **Gems** speed things up and hire builders. Gems cannot be bought. You earn them by beating rival players (a level 1 beating a level 1 gets 190 gold, 190 goop and 3 gems), clearing palms, rocks and ruins, and finishing goals. |
| Builders | You start with 2 builders. Hire a 3rd, 4th and 5th for 75, 150 and 250 gems. Each builder works on one building at a time. |
| Pyramid | Your town hall, levels 1 to 11. Each level unlocks new buildings, raises how many of each you can build, and adds a new level to every building. |
| Buildings | 25 types: Pyramid, Builder's Hut, Gold Mine, Goop Well, Treasury, Goop Jar, Barracks, Army Camp, Temple of Ra, Royal Hall, Ballista, Archer Tower, Catapult, Falcon Perch, Fire Brazier, Eye of Horus, Obelisk of Ra, Anubis Statue, Sphinx, Sun Disk Tower, Wall, Scarab Trap, Quicksand, Falcon Net and Cobra Pit. Every one reaches level 11 at Pyramid 11, and every level is built from a different material (mud brick, adobe, sandstone, limestone, red granite, painted limestone, gilded sandstone, lapis, basalt, electrum and obsidian), with extra details as it grows. |
| Troops | 17 types unlocked by Barracks levels 1 to 11: Spearman, Archer, Tomb Robber, Shield Bearer, Ram Crew, Falcon, Sand Mage, Priestess of Isis, War Chariot, Camel Archer, Phoenix, Mummy, War Elephant, Anubis Warrior, Sky Barge, Sobek Brute and Pharaoh's Champion. Each has its own targets and behaviour: some go for defenses or loot, smash walls, fly, jump walls, heal, split when they fall, or boost nearby troops. |
| Troop upgrades | Research in the Temple of Ra. Each level adds 15% hitpoints and damage and changes the troop's armour colour (bronze, silver, gold, then lapis). The Temple's level caps how far troops can go. |
| Battles | Scout the town for 30 seconds, then send troops in anywhere outside the red zone (tap, or hold to keep sending). Three minutes, three stars: 50% destruction, the Pyramid, and 100%. Win to take the whole loot pile and gems; lose and you keep only what your troops grabbed. Royal Hall guards come out to defend. Hidden traps go off. |
| Rival players | 104 made-up players (including Thomas Quirk, Amanda Abbott, William Emerson and 柯老师) with generated towns that match your Pyramid level. They also raid you every 30 to 70 minutes, even while you are away. If they win you lose some gold and goop. Watch the replay from the Raids menu, then take revenge. |
| Friends | Every town has a 10-symbol code. Enter a friend's code to attack their town. Beating a friend earns gold and goop but no gems, and your friend loses nothing. |

### Friend codes across devices

A static web page has no server, so friends can only find each other's towns when the game is opened from its published Claude link, where towns are shared through the link's database. Opened as a local file, codes only find towns played in the same browser.

## Files

| File | What it does |
| --- | --- |
| `js/data.js` | Buildings, troops, level tables, costs, loot and the rival names |
| `js/battle.js` | The battle simulation: path finding around walls, targeting, defenses, traps, guards and AI army planning. Fixed time step with a seeded random generator, so raids replay exactly. |
| `js/basegen.js` | Generates rival towns for each Pyramid level |
| `js/state.js` | Your town: economy, builders, training, research, raids and goals |
| `js/sprites.js` | Draws every building at every level in code and caches the result |
| `js/render.js` | The isometric view: ground, the Nile, live animations, troops, projectiles and effects |
| `js/ui.js`, `js/main.js` | Menus, HUD, input and the game loop |
| `js/net.js` | Friend codes |
| `js/sound.js` | Synthesized sound effects |

## Developer tools

```sh
node pharaoh/tools/simtest.js        # AI raids against generated towns at every Pyramid level
node pharaoh/tools/statetest.js      # economy, training, research and builders, headless
node pharaoh/tools/debugbattle.js 8  # trace one battle at Pyramid 8
node pharaoh/tools/build-artifact.js out.html   # bundle into one self-contained page
```

`tools/sheet.html` shows every building at all 11 levels side by side.
