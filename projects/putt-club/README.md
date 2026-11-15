# SirSC's Putt Club

Mini golf in 3D, played against three rivals. There are two courses: **the Garden**, 27 holes each built around its own garden trick, and **the Abyss**, 18 hellscape holes of par 6 and up that float over a sea of lava with no rails at all. Every round deals a random 9 or 18 from one course. The Course book lists all 45 holes and lets you practise any one of them.

Plain HTML, CSS and JavaScript with three.js r128 from cdnjs. There is no build step for playing locally: serve the folder with `python3 -m http.server` and open `index.html`. All textures are painted on canvases and all sound is synthesised, so there are no image or audio files.

## The menu

The title screen copies the SirSC games' menu (Bigger Fish, Tower Defense, Brain Rocket): the SirSC's logo, a three-tab toggle (**9 holes**, **18 holes**, **Play online**, which is coming soon), one card per difficulty, and a rules panel. The Course book sits beside the tabs. Each length and difficulty keeps its own best score.

## Difficulties

| Difficulty | Course | Aim guide | Rivals |
| --- | --- | --- | --- |
| Owen | Garden | The whole putt, played out in a copy of the hole, so it shows every bounce, slope and current exactly. The cup also pulls a little harder. | Owen, Clover, Fern |
| Medium | Garden | A line to the first wall and one bounce. | Fern, Bramble, Blaze |
| Hard | Garden | A short line that only shows direction. | Bramble, Blaze, Thorn |
| Ultra | The Abyss | None: just the arrow. No rails anywhere, so any edge is a drop. Par 6 to 8, and you pick up at par + 5. | Thorn, Cinder, SirSC |

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

Water, flowerbeds, lava and the edges of the Abyss cost one penalty stroke and put the ball back where it was putted from. Eight strokes is the most on a Garden hole and par + 5 in the Abyss. After each hole a scorecard is filled in, golf style: birdies are circled, eagles double circled, bogeys boxed. Best rounds for each length and difficulty, your best on each hole and holes in one are kept in the browser.

## The Garden: 27 holes

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

## The Abyss: 18 holes (Ultra)

| # | Hole | Par | Its trick |
| --- | --- | --- | --- |
| 1 | Gates of Dis | 6 | Three obsidian walls, each with an iron gate that rises and slams. |
| 2 | Reaper's Mill | 6 | Thin bridges on and off a platform where three iron blades sweep. |
| 3 | Imp Patrol | 7 | A zigzag causeway with an imp pacing across every leg. |
| 4 | Magma Pinball | 6 | Glowing magma boulders fling the ball, and nothing catches it. |
| 5 | Geyser Leap | 6 | Three separate platforms; geysers hurl the ball across the gaps. |
| 6 | Raft of Charon | 7 | Two basalt rafts ferry the ball over a lava lake via an island. |
| 7 | Portal Maze | 6 | Unconnected platforms joined by paired portals; one sends you back. |
| 8 | Doom Pendulum | 6 | Two spiked iron balls swing across the causeway. |
| 9 | Rune Wheel | 6 | Ride a turning rune circle round until it points at the exit. |
| 10 | Obsidian Slide | 6 | Corners of polished obsidian, as slippery as ice. |
| 11 | Tar Pits | 6 | Tar stops the ball dead and lava pools swallow it. |
| 12 | Ash River | 7 | A river of hot ash carries the ball, with lava outside every bend. |
| 13 | Volcano Summit | 6 | Putt up a volcano to the cup in its crater. |
| 14 | The Crater | 6 | A long thin bridge into a crater full of imps and lava. |
| 15 | Bone Bridge | 7 | A rune raises a bone bridge; a slab rocks over the second channel. |
| 16 | Soul Cart | 6 | Fire jets blast the ball sideways; the cup rides on a cart. |
| 17 | Sulfur Winds | 7 | Gusts across a winding causeway with no edges. |
| 18 | The Descent | 8 | Four ledges down, fire runes that blast you on, blades at the end. |

## Testing the holes

`node tools/test-holes.js` (add `garden` or `abyss` to test one course) plays every hole with a search bot (it tries hundreds of putts per stroke and keeps the one that gets closest along the course) and reports how many strokes it needed and how often a random putt from the tee is a hole in one. Pass hole ids or numbers to test just those. It fails if a hole can't be finished within its stroke limit or if the tee, cup or a post is off the green. `node tools/test-rivals.js abyss 0.97` plays each hole three times with the rivals' own shot search at a given skill and reports their strokes.

## Single-file build

`python3 build-artifact.py dist/putt-club.html` inlines the CSS and scripts into one page for publishing as an artifact (three.js still loads from cdnjs). Add `--standalone` for a complete page to open anywhere.

## Files

```
index.html          page shell and screens
css/style.css       all styling
js/util.js          math and 2D geometry
js/physics.js       ball physics (no three.js; also runs in Node)
js/features.js      the moving and special parts of each hole (physics)
js/holes.js         the 27 Garden holes
js/abyss.js         the 18 Abyss holes
js/nav.js           the rivals' course map and shot search (also runs in their workers)
js/bots.js          the rivals: workers, timing, skill
js/textures.js      canvas-painted textures
js/world.js         the three.js scene: greens, rails, water, cup, ball, effects
js/vis.js           the garden around each hole and how each feature looks
js/vis-abyss.js     the hellscape and the Abyss versions of each feature
js/audio.js         synthesised sound effects and music
js/game.js          menu, difficulties, rounds, rivals, scoring, camera, controls and screens
tools/test-holes.js the hole-testing bot
tools/test-rivals.js the rivals' shot search on every hole
```
