'use strict';
/* Claude Code Clicker: achievements, news, spinner verbs, slash commands and memory upgrades. */

// ---------- achievements ----------
const ACHIEVEMENTS = [];
function ach(id, name, desc, icon, check, hidden = false) {
  ACHIEVEMENTS.push({ id, name, desc, icon, check, hidden });
}
const plural = (n, word) => `${n === 1 ? 'one' : fmtWords(n)} ${word}${n === 1 ? '' : 's'}`;

[
  [1, 'Hello, World'], [1e3, 'First Commit'], [1e5, 'Pull Request'], [1e6, 'Merged'], [1e7, 'Release Candidate'],
  [1e8, 'Shipped'], [1e9, 'Viral Repo'], [1e10, 'Ten Thousand Stars'], [1e11, 'Trending'], [1e12, 'Industry Standard'],
  [1e13, 'Legacy Code'], [1e14, 'Load-bearing Library'], [1e15, 'Critical Infrastructure'], [1e16, 'Civilization Dependency'],
  [1e18, 'Tokenomics'], [1e20, 'Heat Death Postponed'], [1e22, 'The Great Autocomplete'], [1e24, 'Everything Is Tokens'],
  [1e27, 'Token Omniverse'], [1e30, 'Beyond Numbers'],
].forEach(([n, name], k) => ach(`tok${k}`, name, `Generate <b>${plural(n, 'token')}</b> in a single run.`, { g: 'sparkle' }, () => G.earned >= n));

[
  [1, 'Warm Start'], [10, 'Tokens on Tap'], [100, 'Streaming Response'], [1e3, 'Firehose'], [1e4, 'Rate Limit Who?'],
  [1e5, 'High Throughput'], [1e6, 'Megastream'], [1e7, 'Token Tsunami'], [1e8, 'Bandwidth Bandit'], [1e9, 'Gigathought'],
  [1e10, 'Torrent of Thought'], [1e12, 'Teraflop Tokens'], [1e14, 'Unmetered'], [1e16, 'Unbounded'],
].forEach(([n, name], k) => ach(`tps${k}`, name, `Reach <b>${plural(n, 'token')}</b> per second.`, { g: 'bolt' }, () => D.tps >= n));

[[1, 'Click'], [100, 'Clicky'], [1e3, 'Clickbait'], [1e4, 'Carpal Tunnel'], [5e4, 'Keyboard Warrior'], [1e5, 'Click Singularity']]
  .forEach(([n, name], k) => ach(`clk${k}`, name, `Click the sparkle <b>${n === 1 ? 'once' : fmtWords(n) + ' times'}</b>.`, { b: 0 }, () => G.clicks >= n));

[[1e3, 'Hand-written'], [1e5, 'Artisanal Code'], [1e7, 'Bespoke Bytes'], [1e9, 'Handcrafted'], [1e11, 'Human in the Loop'], [1e13, 'Manual Override'], [1e15, 'Fingers of Legend']]
  .forEach(([n, name], k) => ach(`hand${k}`, name, `Generate <b>${plural(n, 'token')}</b> by clicking in one run.`, { g: 'key' }, () => G.handmade >= n));

[[1, 'Eureka!'], [7, 'Lucky Seven'], [27, 'Serendipitous'], [77, 'Golden Hour'], [777, 'Midas Prompt']]
  .forEach(([n, name], k) => ach(`gold${k}`, name, `Click <b>${plural(n, 'Eureka token')}</b>.`, { g: 'gold' }, () => G.goldenClicks >= n));

[[1, 'Squash'], [10, 'Bug Hunter'], [50, 'Exterminator'], [200, 'Zero Known Issues']]
  .forEach(([n, name], k) => ach(`bug${k}`, name, `Squash <b>${plural(n, 'bug')}</b>.`, { g: 'bug' }, () => G.bugsSquashed >= n));

[[10, 'Upgrade Available'], [25, 'Dependency Bump'], [50, 'Major Version'], [100, 'Rewrite It in Rust'], [200, 'Ship of Theseus']]
  .forEach(([n, name], k) => ach(`upg${k}`, name, `Buy <b>${n}</b> upgrades in one run.`, { g: 'up' }, () => G.upgrades.size >= n));

[[100, 'Small Team'], [500, 'Startup'], [1000, 'Scale-up'], [2000, 'Enterprise'], [4000, 'Megacorp']]
  .forEach(([n, name], k) => ach(`own${k}`, name, `Own <b>${fmtWords(n)}</b> buildings at once.`, { g: 'stack' }, () => totalOwned() >= n));

[[1, 'Context Compacted'], [5, 'Summarized Again'], [25, 'Infinite Context']]
  .forEach(([n, name], k) => ach(`cmp${k}`, name, `Run <b>/compact</b> ${n === 1 ? 'once' : n + ' times'}.`, { g: 'compress' }, () => G.compacts >= n));

[[1, 'First Command'], [50, 'Power User'], [200, 'Shell Wizard']]
  .forEach(([n, name], k) => ach(`cmd${k}`, name, `Run <b>${plural(n, 'slash command')}</b>.`, { g: 'prompt' }, () => G.spellsCast >= n));

BUILDINGS.forEach((b, i) => [1, 50, 100, 200].forEach((n, k) =>
  ach(`b${i}_${k}`, b.ach[k], `Own <b>${n === 1 ? 'one' : n}</b> ${n === 1 ? b.name : b.plural}.`, { b: i }, () => G.owned[i] >= n)));

[[1, 'In the Flow'], [50, 'Bubble Wrap'], [250, 'Flow State']]
  .forEach(([n, name], k) => ach(`bub${k}`, name, `Pop <b>${plural(n, 'Flow bubble')}</b>.`, { g: 'people' }, () => G.bubbles >= n));
ach('fullstack', 'Full Stack', 'Own at least <b>one</b> of every building.', { g: 'stack' }, () => G.owned.every(x => x >= 1));
ach('crossfn', 'Cross-functional Team', 'Own at least <b>50</b> of every building.', { g: 'people' }, () => G.owned.every(x => x >= 50));
ach('vanilla', 'Vanilla JS', 'Generate <b>one million</b> tokens in a run without buying any upgrades.', { g: 'star' }, () => G.earned >= 1e6 && G.upgrades.size === 0);
ach('combo', 'Combo Breaker', 'Have <b>Vibe Coding</b> and <b>Keyboard on Fire</b> active at the same time.', { g: 'bolt' },
  () => G.buffs.some(b => b.key === 'frenzy') && G.buffs.some(b => b.key === 'clickfrenzy'));
ach('cache', 'Cache Hit', 'Hold <b>one hour</b> of production in the bank (at 10+ tokens per second).', { g: 'stack' }, () => D.tps >= 10 && G.tokens >= D.tps * 3600);
ach('marathon', 'Long Session', 'Keep the game open for <b>one hour</b>.', { g: 'clock' }, () => sessionSeconds() >= 3600);
ach('rage', 'Rage Clicking', 'Click the sparkle <b>15 times</b> within one second.', { b: 0 }, () => false, true);
ach('sold', "Buyer's Remorse", 'Sell a building.', { g: 'up' }, () => false, true);
ach('news', 'Read the Changelog', 'Click the news ticker.', { g: 'star' }, () => false, true);
ach('interrupt', 'Interrupted', 'Press <b>Esc</b> while Claude is working.', { g: 'prompt' }, () => false, true);
ach('night', 'Night Shift', 'Play between midnight and 4 a.m.', { g: 'clock' }, () => new Date().getHours() < 4, true);

// ---------- news ticker ----------
const owns = (i, n = 1) => () => G.owned[i] >= n;
const NEWS = [
  [null, 'Local developer asks Claude to "make it pop". Claude makes it pop.'],
  [null, 'Study finds most TODO comments are older than the interns reading them.'],
  [null, 'Tabs versus spaces debate enters its sixth decade. Both sides claim victory.'],
  [null, 'Senior engineer spotted reading the documentation. Colleagues concerned.'],
  [null, 'Area side project now has more dependencies than users.'],
  [null, '"It works on my machine," says machine.'],
  [null, 'Developer promises this is the last refactor. Sources doubt it.'],
  [null, 'Commit message "fix" voted most descriptive message of the year.'],
  [null, 'Scientists confirm 80% of debugging is adding print statements.'],
  [() => G.earned < 1000, 'Tip: the sparkle is clickable. Very clickable.'],
  [() => G.earned > 1e4 && G.goldenClicks === 0, 'Rumours spread of golden sparkles that appear when nobody is looking.'],
  [owns(0), 'Autocomplete finishes developer\'s sentence. Developer did not like the ending.'],
  [owns(1), 'Intern discovers git push --force. Office goes very quiet.'],
  [owns(1, 50), 'Intern union demands free pizza on Fridays, and also Wednesdays.'],
  [owns(2), 'Rubber duck sales surge as developers explain bugs out loud.'],
  [owns(2, 50), 'Ducks now outnumber developers three to one. Nobody minds.'],
  [owns(3), 'Linter flags 12,000 issues. 11,998 are trailing whitespace.'],
  [owns(4), 'CI pipeline turns green on the first try. Engineers suspicious.'],
  [owns(4, 50), 'Build queue now longer than the line for the office coffee machine.'],
  [owns(5), 'Subagent returns from mission with a 400-line summary and a haiku.'],
  [owns(5, 25), 'Subagents form a subcommittee of subagents.'],
  [owns(6), 'New MCP server connects Claude to the office kettle. Morale up 40%.'],
  [owns(7), 'GPU cluster heats office to 31°C. Meetings moved to the walk-in fridge.'],
  [owns(8), 'Datacenter cooling water now warm enough for a municipal spa.'],
  [owns(9), 'Astronomers notice a star dimming. Unrelated: a build finished early.'],
  [owns(10), 'Quantum compiler both passes and fails the test suite until observed.'],
  [owns(11), 'Developer receives a code review from next Tuesday. Approves.'],
  [owns(12), 'The Singularity has arrived. It would like to schedule a quick sync.'],
  [owns(13), 'Multiverse fork finds a timeline where the meeting was an email.'],
  [owns(14), 'Infinite Context finally remembers where you left your keys.'],
  [owns(15), 'Agent Civilization holds its first election. All candidates promise better docs.'],
  [owns(16), 'Astronomers name a new nebula after a missing semicolon.'],
  [owns(17), 'Reality Refactor renames gravity to downwardAttraction. Nothing falls over.'],
  [owns(18), 'Claude Prime awakens, reads the whole codebase, and says it is honestly pretty good.'],
  [() => G.earned >= 1e6, 'Your repository trends online. Comments are mostly about the font.'],
  [() => G.earned >= 1e9, 'Economists propose replacing the gold standard with the token standard.'],
  [() => G.earned >= 1e12, 'Tokens now classified as a renewable resource.'],
  [() => G.goldenClicks >= 1, 'Witnesses report a golden sparkle. Productivity spikes follow.'],
  [() => G.bugsSquashed >= 1, 'Bug population in decline. Entomologists and QA teams alarmed.'],
  [() => G.compacts >= 1, 'Claude compacts its memories and keeps the good parts, plus your CLAUDE.md.'],
];

// ---------- spinner verbs (what Claude is doing right now) ----------
const VERBS = ['Accomplishing', 'Actualizing', 'Baking', 'Brewing', 'Churning', 'Clauding', 'Cogitating', 'Combobulating',
  'Concocting', 'Conjuring', 'Crafting', 'Deliberating', 'Discombobulating', 'Divining', 'Elucidating', 'Finagling', 'Forging',
  'Germinating', 'Hatching', 'Herding', 'Honking', 'Hustling', 'Ideating', 'Imagining', 'Incubating', 'Inferring', 'Manifesting',
  'Marinating', 'Moseying', 'Mulling', 'Musing', 'Noodling', 'Percolating', 'Pondering', 'Puttering', 'Reticulating', 'Ruminating',
  'Schlepping', 'Shucking', 'Simmering', 'Smooshing', 'Spinning', 'Stewing', 'Synthesizing', 'Thinking', 'Transmuting', 'Unfurling',
  'Vibing', 'Whirring', 'Wrangling'];
const SPIN_FRAMES = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const RAIN_GLYPHS = ['{', '}', '()', '=>', '</>', ';', '0', '1', 'fn', 'if', '✻', '[]', '&&', '//', 'λ', '#', '::', '$', '++', '!='];

// ---------- slash commands (unlocked by owning a Subagent) ----------
const SPELL_FAIL = 0.15;
const SPELLS = [
  {
    id: 'ship', cmd: '/ship-it', base: 2, pct: 0.4,
    desc: 'Deploy right now: gain 30 minutes of production, up to 15% of your bank.',
    run(fail) {
      if (fail) {
        const loss = Math.min(G.tokens * 0.15, D.tpsGross * 900);
        G.tokens -= loss;
        return { ok: false, msg: `Deploy rolled back. Lost ${fmt(loss)} tokens.` };
      }
      const gain = Math.min(G.tokens * 0.15, D.tpsGross * 1800) + 7;
      earn(gain);
      return { ok: true, msg: `Shipped to production. +${fmt(gain)} tokens.` };
    },
  },
  {
    id: 'think', cmd: '/ultrathink', base: 5, pct: 0.3,
    desc: 'Think harder: production ×2 for 60 seconds.',
    run(fail) {
      if (fail) {
        addBuff('overthink', 'Overthinking', 30, { prod: 0.5, desc: 'A /ultrathink backfired: production is halved.' });
        return { ok: false, msg: 'Overthought it. Production halved for 30 seconds.' };
      }
      addBuff('ultrathink', 'Ultrathink', 60, { prod: 2, desc: 'From /ultrathink: production ×2.' });
      return { ok: true, msg: 'Thinking very hard. Production ×2 for 60 seconds.' };
    },
  },
  {
    id: 'eureka', cmd: '/eureka', base: 10, pct: 0.6,
    desc: 'Summon a Eureka token immediately.',
    run(fail) {
      if (fail) return { ok: false, msg: 'Hallucinated a Eureka token. Very confident, not actually there.' };
      emit('spawnEureka', true);
      return { ok: true, msg: 'A Eureka token appears. Quick, click it.' };
    },
  },
  {
    id: 'init', cmd: '/init', base: 20, pct: 0.75,
    desc: 'Scaffold one free building of a random type you already own.',
    run(fail) {
      const owned = BUILDINGS.map((_, i) => i).filter(i => G.owned[i] > 0);
      if (!owned.length) return { ok: false, msg: 'Nothing to scaffold yet.' };
      const i = pick(owned);
      if (fail) {
        G.owned[i]--;
        recompute();
        return { ok: false, msg: `Oops, rm -rf. Lost one ${BUILDINGS[i].name}.` };
      }
      G.owned[i]++;
      recompute();
      return { ok: true, msg: `Scaffolded a free ${BUILDINGS[i].name}.` };
    },
  },
];

// ---------- memory upgrades (bought with memories earned from /compact) ----------
const MEMORY = [
  { id: 'resume', name: 'Session Resume', cost: 1, req: [], desc: 'Earn 50% of your production while the game is closed, up from 10%.' },
  { id: 'batch', name: 'Batch Mode', cost: 3, req: [], desc: 'Adds a "Buy all" button to the upgrade shelf.' },
  { id: 'starter', name: 'Starter Kit', cost: 5, req: [], desc: 'Start every run with 10 free Autocompletes.' },
  { id: 'instinct', name: 'Eureka Instinct', cost: 7, req: [], desc: 'Eureka tokens appear 10% more often.' },
  { id: 'muscle', name: 'Muscle Memory', cost: 10, req: [], desc: 'Clicking is 25% more powerful.' },
  { id: 'duck', name: 'Heirloom Duck', cost: 20, req: ['starter'], desc: 'Rubber Ducks produce 50% more.' },
  { id: 'discount', name: 'Bulk Discount', cost: 25, req: [], desc: 'All buildings cost 5% less.' },
  { id: 'onboarding', name: 'Onboarding Docs', cost: 50, req: ['starter'], desc: 'Start every run with 5 free Interns.' },
  { id: 'quiet', name: 'Quiet Terminal', cost: 50, req: [], desc: 'Focus for slash commands refills 25% faster.' },
  { id: 'streak', name: 'Lucky Streak', cost: 77, req: ['instinct'], desc: 'Eureka effects last 10% longer.' },
  { id: 'background', name: 'Background Agents', cost: 100, req: ['resume'], desc: 'Earn 90% of your production while the game is closed.' },
  { id: 'coupons', name: 'Upgrade Coupons', cost: 100, req: ['discount'], desc: 'All upgrades cost 5% less.' },
  { id: 'golden', name: 'Golden Memory', cost: 777, req: ['streak'], desc: 'Eureka tokens appear 10% more often and Lucky Commits pay 10% more.' },
  { id: 'deep', name: 'Deep Context', cost: 1000, req: ['background', 'coupons'], desc: 'Each prestige level counts 50% more toward production.' },
];
