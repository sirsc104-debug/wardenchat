'use strict';
/* Claude Code Clicker: hidden developer cheats. Type 0 9 8 7 anywhere (outside a text box) to toggle the Dev tab. */

const DEV_CODE = '0987';

const Dev = {
  typed: '',
  init() {
    window.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      this.typed = (this.typed + e.key).slice(-DEV_CODE.length);
      if (this.typed === DEV_CODE) { this.typed = ''; this.toggle(); }
    });
    this.build();
    this.sync();
    setInterval(() => { if (Panels.tab === 'dev' && Panels.visible()) this.refresh(); }, 500);
  },
  toggle(force) {
    G.dev.on = force != null ? force : !G.dev.on;
    recompute();
    this.sync();
    if (G.dev.on) {
      document.body.dataset.view = 'mid';
      document.querySelectorAll('#mobileNav [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === 'mid')));
      Panels.show('dev');
      toast({ icon: GLYPH.prompt, kicker: 'Developer mode', title: 'Dev tab unlocked', text: 'Cheats are on the Dev tab. Type 0987 again to hide it.' });
    } else {
      if (Panels.tab === 'dev') Panels.show('workspace');
      toast({ icon: GLYPH.prompt, kicker: 'Developer mode', title: 'Dev tab hidden', text: 'Cheat toggles are paused until you type 0987 again.' });
    }
    UI.refreshStore(true);
  },
  sync() {
    $('#tabDev').hidden = !G.dev.on;
    document.body.classList.toggle('dev-on', G.dev.on);
    if (!G.dev.on && Panels.tab === 'dev') Panels.show('workspace');
    this.refresh();
  },
  done(text) {
    recompute();
    UI.refreshStore(true);
    Panels.achDirty = true;
    toast({ icon: GLYPH.bolt, kicker: 'Cheat applied', title: text, life: 2200 });
    this.refresh();
  },

  // Each cheat: [label, action]. Actions return the confirmation text.
  groups() {
    const every = n => { for (let i = 0; i < N; i++) G.owned[i] += n; return `+${n} of every building`; };
    return [
      ['Tokens', [
        ['+1 million', () => (earn(1e6), '+1 million tokens')],
        ['+1 billion', () => (earn(1e9), '+1 billion tokens')],
        ['+1 trillion', () => (earn(1e12), '+1 trillion tokens')],
        ['+1 quadrillion', () => (earn(1e15), '+1 quadrillion tokens')],
        ['Bank ×10', () => (earn(G.tokens * 9), 'Bank multiplied by 10')],
        ['Empty bank', () => { G.tokens = 0; return 'Bank emptied'; }],
      ]],
      ['Time warp', [
        ['Skip 1 minute', () => this.warp(60)],
        ['Skip 1 hour', () => this.warp(3600)],
        ['Skip 1 day', () => this.warp(86400)],
      ]],
      ['Buildings', [
        ['+1 of each', () => every(1)],
        ['+10 of each', () => every(10)],
        ['+100 of each', () => every(100)],
        ['+500 of each', () => every(500)],
        ['Remove all', () => { G.owned.fill(0); return 'All buildings removed'; }],
      ]],
      ['Upgrades', [
        ['Install unlocked', () => { const l = visibleUpgrades(); l.forEach(u => G.upgrades.add(u.id)); return `Installed ${l.length} upgrades for free`; }],
        ['Install every upgrade', () => { UPGRADES.forEach(u => G.upgrades.add(u.id)); return `All ${UPGRADES.length} upgrades installed`; }],
        ['Remove all', () => { G.upgrades.clear(); return 'All upgrades removed'; }],
      ]],
      ['Achievements', [
        ['Unlock all', () => { ACHIEVEMENTS.forEach(a => G.achievements.add(a.id)); return `All ${ACHIEVEMENTS.length} achievements unlocked`; }],
        ['Reset', () => { G.achievements.clear(); return 'Achievements reset'; }],
        ['Next Flow tide', () => {
          const want = tideTier() + 1;
          if (want >= TIDES.length) return 'Already on the last tide';
          for (const a of ACHIEVEMENTS) { if (D.flow >= want * TIDE_STEP) break; if (!G.achievements.has(a.id)) { G.achievements.add(a.id); recompute(); } }
          return tideTier() >= want ? `Flow ${Math.round(D.flow * 100)}%: ${TIDES[tideTier()].name}` : 'Not enough achievements left for the next tide';
        }],
      ]],
      ['Eureka and bugs', [
        ['Spawn Eureka token', () => { FX.spawnEureka(true); return 'A Eureka token appeared'; }],
        ['Spawn rare Eureka', () => { FX.spawnEureka(true, 2); return 'A rare (5%) Eureka token appeared'; }],
        ['Spawn legendary Eureka', () => { FX.spawnEureka(true, 3); return 'A legendary (2%) Eureka token appeared'; }],
        ['Token Rain', () => { FX.tokenRain(16); return 'Token Rain started'; }],
        ['Spawn bug', () => { FX.spawnBug(false); return 'A bug is crawling'; }],
        ['Spawn golden bug', () => { FX.spawnBug(true); return 'A golden bug is crawling'; }],
        ['Clear all effects', () => { G.buffs = []; return 'All active effects cleared'; }],
      ]],
      ['Prestige', [
        ['+10 prestige levels', () => { G.prestige += 10; G.memories += 10; return '+10 prestige levels and memories'; }],
        ['+1,000 memories', () => { G.memories += 1000; return '+1,000 memories'; }],
        ['Learn all memories', () => { MEMORY.forEach(m => G.mem.add(m.id)); return 'Every CLAUDE.md upgrade learned'; }],
        ['Play black hole event', () => { BlackHole.start(); return 'Black hole event started'; }],
        ['Reset black hole event', () => { G.blackhole = false; G.theme = 'classic'; applyTheme(); Panels.syncOptions(); return 'Black hole event reset (it plays on your next click once you are past 1 trillion all-time tokens)'; }],
        ['Unlock Terminal', () => { if (!G.owned[5]) G.owned[5] = 1; recompute(); G.focus = D.focusMax; return 'Terminal unlocked with full Focus'; }],
        ['Complete current challenge', () => { if (!G.challenge) return 'No challenge running'; G.earned = Math.max(G.earned, CHALLENGES.find(c => c.id === G.challenge).goal); return 'Challenge goal reached (completes within a second)'; }],
      ]],
      ['Toolbox', [
        ['Unlock all tools', () => { for (const i of [2, 3, 4, 5, 6]) if (!G.owned[i]) G.owned[i] = 1; return 'Garden, Exchange, Models, Missions and Duck unlocked'; }],
        ['Grow all plants', () => { G.garden.plots.forEach(p => { if (p) p.at = Math.min(p.at, Date.now() - Garden.growSec(p.seed) * 1000 - 1000); }); Garden.stateSig = ''; return 'Every plant is mature'; }],
        ['Discover all seeds', () => { G.garden.known = Object.keys(SEEDS); return 'Every package can be planted'; }],
        ['Next market tick', () => { G.market.next = Date.now(); return 'Prices update now'; }],
        ['Refill model swaps', () => { G.models.swaps = MAX_SWAPS; return 'Model swaps refilled'; }],
        ['Finish all missions', () => { G.missions.active.forEach(a => { a.end = Date.now() - 1; }); return 'Every mission is ready to collect'; }],
        ['Duck +1 level', () => { if (G.duck.level < 10) G.duck.level++; return `Duck is level ${G.duck.level}`; }],
        ['+10 compute credits', () => { G.credits += 10; return '+10 compute credits'; }],
      ]],
      ['Events', [
        ['Pull request', () => { if (!Events.pr) Events.pullRequest(); return 'A pull request popped up'; }],
        ['Rate Limited', () => { Events.rateLimit(); return 'Rate limited for 10 seconds'; }],
        ['Spawn memory leak', () => { G.leaks.list.push({ a: rand(0, 6.28), ate: 0, born: 0 }); return 'A memory leak appeared'; }],
        ['Seasonal item', () => { Events.season = currentSeason(); Events.spawnItem(); return Events.season ? 'A seasonal item is flying by' : 'No season active (pick one in Toggles)'; }],
      ]],
    ];
  },
  warp(sec) {
    const gain = D.tps * sec;
    earn(gain);
    for (const b of G.buffs) b.t -= sec;
    G.buffs = G.buffs.filter(b => b.t > 0);
    T.eureka -= sec;
    T.bug -= sec;
    if (D.focusMax) G.focus = Math.min(D.focusMax, G.focus + D.focusRegen * sec);
    return `Skipped ${fmtTime(sec)}: +${fmt(gain)} tokens`;
  },

  build() {
    const groups = this.groups();
    this.actions = groups.flatMap(g => g[1]);
    let k = 0;
    const check = (id, label) => `<label class="check" for="${id}"><input type="checkbox" id="${id}"> ${label}</label>`;
    $('#panel-dev').innerHTML =
      `<div class="dev-head"><div><h3 class="sec">Developer cheats</h3><p class="muted">For testing the whole game. Type <code>0987</code> again to hide this tab. Cheated progress saves like normal progress, so export a clean save first if you want to keep one.</p></div>` +
      `<button type="button" class="btn" id="devHide">Hide Dev tab</button></div>` +
      `<div class="dev-grid">` +
      groups.map(([title, items]) => `<section class="dev-card"><h4>${title}</h4><div class="dev-btns">` +
        items.map(([label]) => `<button type="button" class="btn" data-cheat="${k++}">${label}</button>`).join('') + `</div></section>`).join('') +
      `<section class="dev-card"><h4>Set exact amounts</h4>` +
      `<label class="dev-field" for="devTokens">Tokens <input id="devTokens" type="text" inputmode="decimal" placeholder="e.g. 5e12"></label>` +
      `<label class="dev-field" for="devBuilding">Building <select id="devBuilding">${BUILDINGS.map((b, i) => `<option value="${i}">${esc(b.name)}</option>`).join('')}</select></label>` +
      `<label class="dev-field" for="devCount">Owned <input id="devCount" type="number" min="0" step="1" placeholder="e.g. 250"></label>` +
      `<div class="dev-btns"><button type="button" class="btn" id="devSet">Apply</button></div><p class="muted dev-msg" id="devMsg"></p></section>` +
      `<section class="dev-card"><h4>Trigger a Eureka effect</h4>` +
      `<label class="dev-field" for="devEffect">Effect <select id="devEffect">${EUREKA.map(e => `<option value="${e.id}">${esc(e.name)} (${e.w}%)</option>`).join('')}</select></label>` +
      `<div class="dev-btns"><button type="button" class="btn" id="devRunEffect">Trigger</button></div></section>` +
      `<section class="dev-card"><h4>Toggles</h4><div class="opt-col">` +
      `<label class="check" for="devMult">Production <select id="devMult"><option value="1">×1</option><option value="10">×10</option><option value="100">×100</option><option value="1000">×1,000</option><option value="1000000">×1,000,000</option></select></label>` +
      check('devFree', 'Free shopping (buildings and upgrades cost nothing)') +
      check('devFast', 'A Eureka token every 5 seconds') +
      check('devFocus', 'Infinite Focus for slash commands') +
      `<label class="check" for="devSeason">Season <select id="devSeason"><option value="auto">Calendar</option><option value="hackathon">Hackathon Week</option><option value="launch">Launch Week</option><option value="none">No season</option></select></label>` +
      `</div></section></div>`;

    const panel = $('#panel-dev');
    panel.addEventListener('click', e => {
      const b = e.target.closest('[data-cheat]');
      if (b) this.done(this.actions[+b.dataset.cheat][1]());
    });
    $('#devHide').addEventListener('click', () => this.toggle(false));
    $('#devSet').addEventListener('click', () => this.applyExact());
    $('#devRunEffect').addEventListener('click', () => {
      const eff = EUREKA.find(x => x.id === $('#devEffect').value);
      if (eff.ok && !safe(eff.ok)) return this.msg(`${eff.name} can't happen yet in this save.`, true);
      const [title, text] = eff.run(D.effDur);
      recompute();
      UI.refreshStore(true);
      Sound.eureka();
      toast({ icon: GLYPH.gold, kicker: 'Eureka (dev)', title, text, kind: 'gold' });
    });
    $('#devMult').addEventListener('change', e => { G.dev.mult = +e.target.value; this.done(`Production ×${(+e.target.value).toLocaleString('en-US')}`); });
    const bind = (id, key, label) => $(id).addEventListener('change', e => { G.dev[key] = e.target.checked; this.done(`${label} ${e.target.checked ? 'on' : 'off'}`); });
    bind('#devFree', 'free', 'Free shopping');
    bind('#devFast', 'fastEureka', 'Fast Eureka tokens');
    bind('#devFocus', 'infFocus', 'Infinite Focus');
    $('#devSeason').addEventListener('change', e => { G.dev.season = e.target.value; this.done(`Season: ${e.target.selectedOptions[0].textContent}`); });
  },
  msg(text, bad) {
    const el = $('#devMsg');
    el.textContent = text;
    el.classList.toggle('bad', !!bad);
  },
  applyExact() {
    const tokRaw = $('#devTokens').value.trim(), cntRaw = $('#devCount').value.trim();
    const done = [];
    if (tokRaw) {
      const v = Number(tokRaw.replace(/,/g, ''));
      if (!Number.isFinite(v) || v < 0) return this.msg('Tokens must be a number like 5000000 or 5e12.', true);
      G.tokens = v;
      if (G.earned < v) G.earned = v;
      done.push(`tokens set to ${fmt(v)}`);
    }
    if (cntRaw) {
      const n = Math.floor(Number(cntRaw));
      if (!Number.isFinite(n) || n < 0 || n > 5000) return this.msg('Owned must be a whole number from 0 to 5,000.', true);
      const i = +$('#devBuilding').value;
      G.owned[i] = n;
      done.push(`${BUILDINGS[i].plural} set to ${n}`);
    }
    if (!done.length) return this.msg('Enter a token amount, an owned count, or both.', true);
    this.msg('');
    this.done(done.join(', ').replace(/^./, c => c.toUpperCase()));
  },
  refresh() {
    if (!$('#devMult')) return;
    $('#devMult').value = String(G.dev.mult);
    $('#devFree').checked = G.dev.free;
    $('#devFast').checked = G.dev.fastEureka;
    $('#devFocus').checked = G.dev.infFocus;
    $('#devSeason').value = G.dev.season || 'auto';
  },
};
