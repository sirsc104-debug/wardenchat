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
| Upgrades | About 270: 11 tiers per building, Autocomplete multi-cursor upgrades, click upgrades, global production boosts, Flow engineers, Eureka and bug upgrades, 13 **synergy** upgrades (unlock at 15 of each of two related buildings; the first gets +1% per copy of the second, the second +0.2% per copy of the first) and 4 limited-time seasonal upgrades. |
| Eureka tokens | Rare sparkles (roughly one every 10-20 minutes) that vanish after 3 seconds, with 18 possible effects. The effect is rolled when the token appears, and the token shows its tier: gold for 10% effects, an ice-blue ringed token for 5%, and a large violet-and-gold legendary token for 2%. Common (10% each): Vibe Coding, Lucky Commit, Hot Reload, Green Build, and the bad **Bug Infestation**: a red pulsing alert while 10 bugs run in from the screen edges to the sparkle; each bug that reaches it eats 1/9 of your tokens per second (9 bugs = zero, 10 = negative and your bank drains). Squashing them stops the drain but refunds nothing, and leftovers leave after 45 seconds. Uncommon (5% each): Keyboard on Fire, Building Hyperfocus, Token Rain, Bug Report, Code Review Approved, Deep Thought, Focus Restored, Hiring Spree. Rare (2% each): Singularity Spike, Time Skip, Golden Chain, Double Down, Full Send. Hover an active effect, or a row in the Stats odds table, to see what it does. |
| Bugs | Bugs (and the occasional golden bug) crawl across the screen. Squash them for a minute of production. |
| Toolbox | A tab of side systems that unlock as you buy buildings. **Dependency Garden** (1 Linter): plant packages in a 3×3 plot (4×4 at 50 Linters) that grow in real time; ripe plants harvest for tokens, buffs or a free building, mature plants give passive bonuses, wilt if left too long, and empty plots next to two parents can breed hybrids (is-even, typescript, next.js, rust and the rare CLAUDE.md). **Token Exchange** (1 CI Pipeline): six goods whose prices move every minute with sparkline charts; $1 is worth one second of your best base production and every CI Pipeline raises how much you can hold. **Model Picker** (1 MCP Server): slot eight models with trade-offs into 100% / 50% / 25% slots; swaps refill one every 10 minutes. **Subagent Missions** (1 Subagent): send Subagents away on 5-minute to 8-hour jobs for about 3× their output, free upgrades and 8 rare items with permanent bonuses. **Pet Rubber Duck** (1 Rubber Duck): feed it buildings to level it to 10, gaining accessories and auras (pick one, or two at level 10). |
| Events | Every few minutes: **Rate Limited** (a 429 box, clicks do nothing for 10 seconds) or a **Pull Request** pop-up with 5 seconds to approve or reject (judge it right for 3 minutes of production, merge a bad one and you lose 5% of your bank plus a 30-second Production Incident). **Memory leaks** cling to the sparkle and each soaks up 5% of production; pop one to get back 110% of what it took. **Seasonal events** rotate weekly (Hackathon Week, Launch Day): themed decorations, flying pizza or rocket tokens worth 2 minutes of production, and two limited-time upgrades each. |
| Compute credits | You get 1 credit per real day (they bank while you're away). Spend them in the Store's **Level** mode to level a building: +1% production per level, and each level costs one more credit than the last. |
| Diamond tier | From 5,000 of a building, every 500 show as one icy diamond icon with glints and a coin-flip shimmer; from 5,000 Autocompletes, diamond hands take over the circles with a crystal slam, and every pointer gets a diamond skin. |
| Achievements & Flow | 162 achievements, some hidden. Each adds 4% **Flow**, the tide under the sparkle. Flow gives +0.25% production per 1%, Engineer upgrades multiply that, and Flow bubbles rise from the tide (more often with more Flow); pop one for 15 seconds of production times your Flow. The tide rises through each 100% of Flow, then surges, splashes and starts again at the bottom as a stronger tide: Clay, Gold, Mint, Lilac, Crystal, Ember and finally Prism, each with more going on (crests, glints, glow, embers, shifting colours), and each new tide makes Flow bubbles worth 10% more. Hover the Flow badge in the corner to see your numbers. |
| Terminal | Owning a Subagent unlocks slash commands (`/ship-it`, `/ultrathink`, `/eureka`, `/init`) that spend regenerating Focus and can backfire. |
| Memory (prestige) | `/compact` resets the run for prestige levels based on all-time tokens (the first at 1 billion; +1% production each) and the same number of memories to spend in **CLAUDE.md**, a skill tree with four routes from a shared root: **Architect** (production: Clean Architecture, Monolith or Microservices, Compound Interest, Deep Context, Eternal Context), **Hands-on** (clicking: up to ×45 click power, Ghost Clicker or Combo Chain critical clicks, In the Zone), **Serendipity** (Eureka, Flow and bugs: up to Eureka tokens 2× as often, Golden or Tidal Memory, Foam Party) and **Operations** (100% offline production, starting kits, 10% cheaper buildings and upgrades, and Warm/Hot Cache to keep 10-25% of your buildings through /compact). Each route has one fork where you choose one of two nodes, and **Rewrite CLAUDE.md** refunds every memory spent so you can try another path. Click a node to inspect it, then learn it. **Challenge runs** (Memory tab) start a fresh `/compact` with a rule (no clicking, no upgrades, or rate limited) and a token goal; finish one for a permanent reward. | |
| Presentation | Canvas-rendered sparkle with shine, orbiting pointing hands (from 100 Autocompletes on, each gold hand is 10, with 25 per circle and up to 3 circles, and from then on every mouse pointer gets a gold skin and each click on the sparkle lands with a quick gold tap and shockwave), code rain that thickens with production, click particles, floating numbers, a workspace view of every building at work (from 100 of a building on, each all-gold icon stands for 10, with the remaining 1-9 shown normally), a news ticker, and a Claude Code-style status spinner. |
| Black hole tier | From 500 of a building, every 50 show as one black hole icon in the workspace: a dark, orange-glowing silhouette over a black core with a spinning accretion ring (then gold tens, then single icons). From 500 Autocompletes, black hole hands (50 each) take over the circles with a harder spin-slam and orange-and-grey shockwaves (the circles only ever show the highest hand type you have), every pointer skin turns dark with orange outlines and a sweeping glint, and clicking the sparkle collapses rings inward before an orange flash. |
| Event Horizon | On your first click after all-time tokens reach 1 trillion (including saves already past it), the sparkle collapses into a black hole, the screen shakes and gets sucked in, and a fullscreen Event Horizon tab shows every building you own spiralling (with motion trails) through nebula clouds, gravitational waves, lensing arcs and twin jets into a Doppler-bright accretion disk, before a supernova blasts it all back out. Afterwards the game switches to a black, orange and grey Event Horizon style with a black-hole sparkle and accretion disk. It changes the look only; switch styles any time in Options. |
| Full screen | The **Full screen** button under the sparkle opens a view where the sparkle fills the window and every building you own (not just the Autocomplete hands) runs its own workstation on a ring around it: its crew hops at work in its tier (single, gold, black hole or diamond icons), streams tokens into the sparkle along glowing links, and reports what each 3-second work cycle made. The sparkle stays clickable; press Esc or Exit full screen to go back. |
| Supernova | On your first click after all-time tokens reach 100 quadrillion (always after the Event Horizon), the sparkle overheats and swells into a red giant that engulfs the page. A fullscreen Supernova tab shows every building you own orbiting the star as it grows, fused into heavier elements (H → He → C → O → Ne → Si → Fe) as the star swallows its orbit. Then the iron core collapses, the star explodes in a nebula of magenta, cyan and gold filaments that blasts your buildings back out, and a pulsar is born. Afterwards the game switches to the Supernova style: deep navy panels, magenta and cyan accents, and a pulsar sparkle with sweeping beams. Like the Event Horizon it changes the look only; switch styles any time in Options. |
| Quality of life | A **New window** button (top right) opens the game in its own window and carries your save over; the original window pauses so the two never overwrite each other, receives the new window's progress every few seconds, and picks up again when you close it (or click Play here instead). Offline production, save export/import, number formats, optional synthesized sound, reduced-motion support, keyboard play (focus the sparkle, press Enter), and a phone layout. |

## Developer cheats

Type `0987` anywhere on the page (outside a text box) to show a **Dev** tab, and type it again to hide it. It has 48 one-click cheats (tokens, time warp, buildings, upgrades, achievements, Eureka tokens, bugs, Flow tides, prestige, both one-time events, challenges, every Toolbox system, compute credits, and each event), fields to set exact token and building counts, a picker that triggers any of the 18 Eureka effects, and a season picker, and toggles for a production multiplier, free shopping, a Eureka token every 5 seconds and infinite Focus. A DEV badge shows next to the title while it's on.

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
js/toolbox.js     Toolbox tab framework
js/garden.js      Dependency Garden
js/market.js      Token Exchange
js/models.js      Model Picker
js/missions.js    Subagent Missions
js/duck.js        Pet Rubber Duck
js/events.js      Rate Limited, Pull Requests, memory leaks, seasons
js/fullview.js    full-screen view of every building at work
js/dev.js         hidden Dev tab with cheats (type 0987)
js/blackhole.js   the one-time Event Horizon event and style
js/supernova.js   the one-time Supernova event at 100 quadrillion
js/popout.js      the New window handoff
js/main.js        boot, main loop, autosave
```

This is a fan-made game and is not an official Anthropic product.
