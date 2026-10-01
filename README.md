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
| Buildings | 14 types from Autocomplete (15 tokens) to Multiverse Fork (2.1 quadrillion), each 15% pricier per purchase. Buy or sell in batches of 1, 10 or 100. |
| Upgrades | About 200: 11 tiers per building, Autocomplete multi-cursor upgrades, click upgrades, global production boosts, Flow engineers, Eureka and bug upgrades. |
| Eureka tokens | Golden sparkles appear at random with 18 possible effects. Common (10% each): Vibe Coding, Lucky Commit, Hot Reload, Pair Programming, Green Build. Uncommon (5% each): Keyboard on Fire, Building Hyperfocus, Token Rain, Bug Report, Code Review Approved, Deep Thought, Focus Restored, Hiring Spree. Rare (2% each): Singularity Spike, Time Skip, Golden Chain, Double Down, Full Send. The odds are listed on the Stats tab. |
| Bugs | Bugs crawl across the screen. Squash them for a minute of production. |
| Achievements | 139 in total, some hidden. Each adds 4% **Flow**, which Engineer upgrades turn into production. Flow rises as a tide under the sparkle. |
| Terminal | Owning a Subagent unlocks slash commands (`/ship-it`, `/ultrathink`, `/eureka`, `/init`) that spend regenerating Focus and can backfire. |
| Memory (prestige) | `/compact` resets the run for prestige levels based on all-time tokens (+1% production each) and memories to spend on a permanent CLAUDE.md upgrade tree. |
| Presentation | Canvas-rendered sparkle with shine, orbiting cursors, code rain that thickens with production, click particles, floating numbers, a workspace view of every building at work, a news ticker, and a Claude Code-style status spinner. |
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
js/main.js        boot, main loop, autosave
```

This is a fan-made game and is not an official Anthropic product.
