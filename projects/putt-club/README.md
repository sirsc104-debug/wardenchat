# SirSC's Putt Club

Garden mini golf in 3D. There are 27 holes, each built around its own garden trick, and every round deals a random handful of them: 3, 9 or 18. The Course book lists all 27 and lets you practise any one of them.

Plain HTML, CSS and JavaScript with three.js r128 from cdnjs. There is no build step for playing locally: serve the folder with `python3 -m http.server` and open `index.html`. All textures are painted on canvases and all sound is synthesised, so there are no image or audio files.

## Playing

| Control | What it does |
| --- | --- |
| Drag back and let go | Putt. Press anywhere, pull away from where you want the ball to go, and release. Further means harder. |
| Arrows or WASD, then Space | Aim left and right, set power up and down, Space putts. Hold Shift to aim finely. |
| C or *Whole hole* | Toggle between the ball camera and a view of the whole hole. |
| Q / E or the ⟲ ⟳ buttons, right-drag | Turn the camera. Scroll or pinch to zoom. |
| Esc or *Menu* | Pause, with the how-to and sound toggles. M toggles music, N toggles sound. |

Water and flowerbeds cost one penalty stroke and put the ball back where it was putted from. Eight strokes is the most on any hole. After each hole a scorecard is filled in, golf style: birdies are circled, eagles double circled, bogeys boxed. Best rounds for 3, 9 and 18 holes, your best on each hole and holes in one are kept in the browser.

## The 27 holes

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

## Testing the holes

`node tools/test-holes.js` plays every hole with a search bot (it tries hundreds of putts per stroke and keeps the one that gets closest along the course) and reports how many strokes it needed and how often a random putt from the tee is a hole in one. Pass hole ids or numbers to test just those. It fails if a hole can't be finished in 8 strokes or if the tee, cup or a post is off the green.

## Single-file build

`python3 build-artifact.py dist/putt-club.html` inlines the CSS and scripts into one page for publishing as an artifact (three.js still loads from cdnjs). Add `--standalone` for a complete page to open anywhere.

## Files

```
index.html          page shell and screens
css/style.css       all styling
js/util.js          math and 2D geometry
js/physics.js       ball physics (no three.js; also runs in Node)
js/features.js      the moving and special parts of each hole (physics)
js/holes.js         the 27 hole layouts
js/textures.js      canvas-painted textures
js/world.js         the three.js scene: greens, rails, water, cup, ball, effects
js/vis.js           the garden around each hole and how each feature looks
js/audio.js         synthesised sound effects and music
js/game.js          rounds, scoring, camera, controls and screens
tools/test-holes.js the hole-testing bot
```
