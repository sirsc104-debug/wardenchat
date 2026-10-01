# Claude Code Clicker

An idle/incremental game in the spirit of Cookie Clicker, themed around coding with Claude Code. Click the sparkle to generate tokens, hire a workforce of Autocompletes, Interns, Rubber Ducks and Subagents, and scale all the way up to Multiverse Forks.

It is plain HTML, CSS and JavaScript with no build step and no dependencies.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Progress saves to `localStorage` every 30 seconds and when you leave the page. Use **Options → Export** to back up a save code.

## What's in it

| System | Details |
| --- | --- |
| Buildings | 19 types from Autocomplete (15 tokens) through Multiverse Fork to Infinite Context, Agent Civilization, Token Nebula, Reality Refactor and Claude Prime (1.9 sextillion), each 15% pricier per purchase. Buy or sell in batches of 1, 10 or 100. |
| Upgrades | About 250: 11 tiers per building, Autocomplete multi-cursor upgrades, click upgrades, global production boosts, Flow engineers, Eureka and bug upgrades. |
| Eureka tokens | Rare sparkles (roughly one every 10-20 minutes) that vanish after 3 seconds, with 18 possible effects. The effect is rolled when the token appears, and the token shows its tier: gold for 10% effects, an ice-blue ringed token for 5%, and a large violet-and-gold legendary token for 2%. Common (10% each): Vibe Coding, Lucky Commit, Hot Reload, Green Build, and the bad **Bug Infestation** (hungry bugs eat your tokens until you squash them). Uncommon (5% each): Keyboard on Fire, Building Hyperfocus, Token Rain, Bug Report, Code Review Approved, Deep Thought, Focus Restored, Hiring Spree. Rare (2% each): Singularity Spike, Time Skip, Golden Chain, Double Down, Full Send. Hover an active effect, or a row in the Stats odds table, to see what it does. |
| Bugs | Bugs crawl across the screen. Squash them for a minute of production. |
| Achievements & Flow | 162 achievements, some hidden. Each adds 4% **Flow**, the tide under the sparkle. Flow gives +0.25% production per 1%, Engineer upgrades multiply that, and Flow bubbles rise from the tide (more often with more Flow); pop one for 15 seconds of production times your Flow. Hover the Flow badge in the corner to see your numbers. |
| Terminal | Owning a Subagent unlocks slash commands (`/ship-it`, `/ultrathink`, `/eureka`, `/init`) that spend regenerating Focus and can backfire. |
| Memory (prestige) | `/compact` resets the run for prestige levels based on all-time tokens (+1% production each) and memories to spend on a permanent CLAUDE.md upgrade tree. |
| Presentation | Canvas-rendered sparkle with shine, orbiting pointing hands (from 100 Autocompletes on, each gold hand is 10, with 25 per circle and up to 3 circles, and from then on every mouse pointer gets a gold skin and each click on the sparkle lands with a quick gold tap and shockwave), code rain that thickens with production, click particles, floating numbers, a workspace view of every building at work (from 100 of a building on, each all-gold icon stands for 10, with the remaining 1-9 shown normally), a news ticker, and a Claude Code-style status spinner. |
| Rainbow tier | From 500 of a building, every 50 show as one shimmering rainbow icon in the workspace (then gold tens, then single icons). From 500 Autocompletes, rainbow hands (50 each) take over the circles with a harder spin-slam and rainbow shockwaves (the circles only ever show the highest hand type you have), every pointer skin turns into an animated rainbow, and clicking the sparkle sets off a rainbow burst. |
| Event Horizon | The first time all-time tokens reach 1 trillion (including saves already past it), the sparkle collapses into a black hole, the whole screen gets sucked in, and a fullscreen Event Horizon tab shows every building you own spiralling into the singularity before it all explodes back out. Afterwards the game switches to a black, orange and grey Event Horizon style with a black-hole sparkle and accretion disk. It changes the look only; switch styles any time in Options. |
| Quality of life | Offline production, save export/import, number formats, optional synthesized sound, reduced-motion support, keyboard play (focus the sparkle, press Enter), and a phone layout. |

## Developer cheats

Type `0987` anywhere on the page (outside a text box) to show a **Dev** tab, and type it again to hide it. It has 27 one-click cheats (tokens, time warp, buildings, upgrades, achievements, Eureka tokens, bugs, prestige), fields to set exact token and building counts, a picker that triggers any of the 18 Eureka effects, and toggles for a production multiplier, free shopping, a Eureka token every 5 seconds and infinite Focus. A DEV badge shows next to the title while it's on.

## Files

```
index.html        page shell
css/style.css     all styling
js/data.js        formatting helpers, icons, buildings, upgrade definitions
js/content.js     achievements, news, spinner verbs, slash commands, memory tree
js/engine.js      game state, economy, buffs, prestige, save/load
js/render.js      canvas: sparkle stage and workspace lanes
js/ui.js          store, tooltips, toasts, Eureka tokens, bugs, ticker, spinner, sound
js/panels.js      Stats, Achievements, Terminal, Memory and Options tabs
js/dev.js         hidden Dev tab with cheats (type 0987)
js/blackhole.js   the one-time Event Horizon event and style
js/main.js        boot, main loop, autosave
```

This is a fan-made game and is not an official Anthropic product.
