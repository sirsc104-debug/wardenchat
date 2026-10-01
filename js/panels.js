'use strict';
/* Claude Code Clicker: middle-pane tabs (workspace, stats, achievements, terminal, memory, options). */

const Panels = {
  tab: 'workspace', achDirty: true, memSig: '', armed: null,
  init() {
    document.querySelectorAll('#tabs [data-tab]').forEach(btn => btn.addEventListener('click', () => this.show(btn.dataset.tab)));
    this.buildTerminal();
    this.buildOptions();
    bindTips($('#panel-achievements'), '.ach', el => this.achTip(ACH[el.dataset.id]));
    $('#panel-memory').addEventListener('click', e => this.onMemoryClick(e));
    this.refresh(true);
  },
  show(tab) {
    this.tab = tab;
    document.querySelectorAll('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== `panel-${tab}`; });
    Tip.hide();
    this.refresh(true);
  },
  visible() { return $('#paneMid').getClientRects().length > 0; },
  workspaceVisible() { return this.tab === 'workspace' && this.visible(); },
  refresh(force) {
    $('#achCount').textContent = `${G.achievements.size}/${ACHIEVEMENTS.length}`;
    const term = $('#tabTerminal');
    const termOn = G.owned[5] > 0;
    if (term.hidden === termOn) term.hidden = !termOn;
    if (!termOn && this.tab === 'terminal') return this.show('workspace');
    if (!force && !this.visible()) return;
    if (this.tab === 'stats') this.stats();
    else if (this.tab === 'achievements' && (force || this.achDirty)) this.achievements();
    else if (this.tab === 'memory') this.memory(force);
  },
  fastRefresh() {
    if (this.tab === 'terminal' && this.visible()) this.terminalTick();
  },

  // ---------- stats ----------
  stats() {
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    const general = [
      ['Tokens in the bank', fmtLong(G.tokens)],
      ['Generated this run', fmtLong(G.earned)],
      ['Generated all time', fmtLong(allTimeEarned())],
      ['Run started', `${fmtTime((Date.now() - G.runStart) / 1000)} ago`],
      ['Buildings owned', totalOwned().toLocaleString('en-US')],
      ['Tokens per second', fmt(D.tps) + (D.buffProd !== 1 ? ` (×${+D.buffProd.toFixed(2)} from effects)` : '')],
      ['Best tokens per second', fmt(G.stats.maxTps)],
      ['Tokens per click', fmt(D.click)],
      ['Sparkle clicks', G.clicks.toLocaleString('en-US')],
      ['Tokens from clicking', fmtLong(G.handmade)],
      ['Eureka tokens clicked', G.goldenClicks.toLocaleString('en-US')],
      ['Bugs squashed', G.bugsSquashed.toLocaleString('en-US')],
      ['Slash commands run', G.spellsCast.toLocaleString('en-US')],
      ['Upgrades installed', `${G.upgrades.size} of ${UPGRADES.length}`],
    ].map(r => row(...r)).join('');
    const mults = [
      ['Upgrades', `+${D.gpct}%`],
      ['Flow', `${Math.round(D.flow * 100)}% → ×${D.flowMult.toFixed(2)}`],
      ['Prestige', `level ${G.prestige} → +${Math.round(D.prestigeBonus * 100)}%`],
      ['Total multiplier', `×${D.mult.toFixed(2)}`],
    ].map(r => row(...r)).join('');
    const rows = BUILDINGS.map((b, i) => {
      if (!G.owned[i] && !G.producedBy[i]) return '';
      const each = D.each[i] * D.mult * D.buffProd, tot = each * G.owned[i];
      return `<tr><td>${svgIcon(b.icon)}${esc(b.name)}</td><td>${G.owned[i]}</td><td>${fmt(each)}</td><td>${fmt(tot)}</td>` +
        `<td>${D.tps ? ((tot / D.tps) * 100).toFixed(1) : '0.0'}%</td><td>${fmt(G.producedBy[i])}</td></tr>`;
    }).join('');
    $('#panel-stats').innerHTML =
      `<h3 class="sec">General</h3><dl class="stat-list">${general}</dl>` +
      `<h3 class="sec">Multipliers</h3><dl class="stat-list">${mults}</dl>` +
      `<h3 class="sec">Eureka effects</h3><div class="tbl-wrap"><table class="bt odds"><thead><tr><th>Effect</th><th>Chance</th><th>Available now</th></tr></thead><tbody>` +
      EUREKA.map(e => `<tr><td>${esc(e.name)}</td><td>${e.w}%</td><td>${!e.ok || safe(e.ok) ? 'Yes' : 'Not yet'}</td></tr>`).join('') +
      `</tbody></table></div><p class="muted odds-note">If an effect is not available yet, the others share its chance.</p>` +
      `<h3 class="sec">Buildings</h3>` +
      (rows ? `<div class="tbl-wrap"><table class="bt"><thead><tr><th>Building</th><th>Owned</th><th>Each/s</th><th>Total/s</th><th>Share</th><th>Made</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<p class="muted">Buy your first building from the Store to see its numbers here.</p>');
  },

  // ---------- achievements ----------
  achievements() {
    this.achDirty = false;
    const n = G.achievements.size, pct = Math.round(D.flow * 100);
    const tiles = ACHIEVEMENTS.map(a => {
      const got = G.achievements.has(a.id);
      return `<button type="button" class="ach ${got ? 'got' : ''}" data-id="${a.id}" aria-label="${got || !a.hidden ? esc(a.name) : 'Hidden achievement'}">${got ? svgIcon(iconParts(a.icon)) : '<span class="q">?</span>'}</button>`;
    }).join('');
    $('#panel-achievements').innerHTML =
      `<div class="ach-head"><div class="ach-count"><b>${n}</b> of ${ACHIEVEMENTS.length} unlocked</div>` +
      `<div class="meter"><span style="width:${((n / ACHIEVEMENTS.length) * 100).toFixed(1)}%"></span></div>` +
      `<p class="muted">Flow <b>${pct}%</b>. Every achievement adds 4% Flow, which the rising tide under the sparkle shows. Engineer upgrades turn Flow into production.</p></div>` +
      `<div class="ach-grid">${tiles}</div>`;
  },
  achTip(a) {
    const got = G.achievements.has(a.id), secret = a.hidden && !got;
    return tipHead(got ? svgIcon(iconParts(a.icon)) : svgIcon(GLYPH.star, 'dim'), secret ? '???' : a.name, got ? 'Achievement · unlocked' : 'Achievement · locked') +
      `<div class="tip-desc">${secret ? 'A hidden achievement. Keep playing to find it.' : a.desc}</div>`;
  },

  // ---------- terminal (slash commands) ----------
  buildTerminal() {
    $('#panel-terminal').innerHTML =
      `<div class="term"><div class="term-top"><span>~/workspace <span class="c-clay">›</span> slash commands</span><span>Focus <b id="focusV">0</b></span></div>` +
      `<div class="meter lilac"><span id="focusBar"></span></div>` +
      `<p class="term-note">Focus refills over time, and more Subagents make the pool bigger. Every command has a ${Math.round(SPELL_FAIL * 100)}% chance to backfire.</p>` +
      `<div class="cmds">${SPELLS.map(sp => `<div class="cmd"><div><code>${sp.cmd}</code><span class="cmd-desc">${esc(sp.desc)}</span></div>` +
        `<button type="button" class="btn run" data-spell="${sp.id}">Run · <span class="cmd-cost"></span></button></div>`).join('')}</div>` +
      `<div class="term-log" id="termLog" aria-live="polite"><div class="log-line muted">$ claude --slash-commands</div><div class="log-line muted">Ready. Pick a command.</div></div></div>`;
    $('#panel-terminal').addEventListener('click', e => {
      const btn = e.target.closest('[data-spell]');
      if (!btn) return;
      const res = castSpell(btn.dataset.spell);
      if (!res) return;
      res.ok ? Sound.eureka() : Sound.fail();
      this.log(`> ${res.cmd}`, 'cmdl');
      this.log(`${res.ok ? '✓' : '✗'} ${res.msg}`, res.ok ? 'ok' : 'bad');
      UI.refreshStore();
      this.terminalTick();
    });
  },
  log(text, cls) {
    const box = $('#termLog'), el = document.createElement('div');
    el.className = `log-line ${cls}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 40) box.firstElementChild.remove();
    box.scrollTop = box.scrollHeight;
  },
  terminalTick() {
    $('#focusV').textContent = `${G.focus.toFixed(1)} / ${D.focusMax}`;
    $('#focusBar').style.width = D.focusMax ? `${(G.focus / D.focusMax) * 100}%` : '0%';
    document.querySelectorAll('[data-spell]').forEach(btn => {
      const cost = spellCost(SPELLS.find(s => s.id === btn.dataset.spell));
      btn.querySelector('.cmd-cost').textContent = `${cost} focus`;
      btn.disabled = G.focus < cost;
    });
  },

  // ---------- memory (prestige) ----------
  memory(force) {
    const pending = pendingPrestige();
    const sig = [G.prestige, G.memories, pending, [...G.mem].join(), this.armed].join('|');
    if (force || sig !== this.memSig) {
      this.memSig = sig;
      const cards = MEMORY.map(m => {
        const owned = hasMem(m.id), reqOk = m.req.every(hasMem);
        const state = owned ? 'owned' : !reqOk ? 'locked' : G.memories >= m.cost ? 'can' : 'poor';
        const label = owned ? 'Remembered' : !reqOk ? `Requires ${m.req.map(r => MEM[r].name).join(' + ')}` : state === 'can' ? 'Click to learn' : 'Not enough memories';
        return `<button type="button" class="mem-card ${state}" data-mem="${m.id}" ${state === 'can' ? '' : 'aria-disabled="true"'}>` +
          `<span class="mem-name">${esc(m.name)}</span><span class="mem-cost">${m.cost.toLocaleString('en-US')} memor${m.cost === 1 ? 'y' : 'ies'}</span>` +
          `<span class="mem-desc">${esc(m.desc)}</span><span class="mem-state">${label}</span></button>`;
      }).join('');
      $('#panel-memory').innerHTML =
        `<div class="mem-hero">` +
        `<div class="mem-stat"><div class="mem-num">${G.prestige.toLocaleString('en-US')}</div><div class="mem-lab">Prestige level</div><div class="mem-sub">+${Math.round(D.prestigeBonus * 100)}% production</div></div>` +
        `<div class="mem-stat"><div class="mem-num">${G.memories.toLocaleString('en-US')}</div><div class="mem-lab">Memories to spend</div><div class="mem-sub">One per level gained</div></div>` +
        `<div class="mem-stat"><div class="mem-num gain">+${pending.toLocaleString('en-US')}</div><div class="mem-lab">Levels from /compact</div><div class="mem-sub" id="memNext"></div></div></div>` +
        `<div class="meter lilac"><span id="memBar"></span></div>` +
        `<div class="compact-box"><div><h3 class="sec">Compact the conversation</h3><p>Running <code>/compact</code> summarizes this run into memories. Prestige levels come from all-time tokens: the first needs 1 trillion, and each level after that needs more. ` +
        `You keep achievements, prestige and memories. Tokens, buildings and upgrades start over.</p></div>` +
        `<button type="button" class="btn compact ${this.armed ? 'armed' : ''}" id="btnCompact">${this.armed ? `Confirm: compact for +${pending}` : '/compact'}</button></div>` +
        `<h3 class="sec">CLAUDE.md</h3><p class="muted">Memories you learn here stay with you across every compaction.</p><div class="mem-grid">${cards}</div>`;
    }
    const lvl = prestigeFor(allTimeEarned()), lo = Math.pow(lvl, 3) * 1e12, hi = Math.pow(lvl + 1, 3) * 1e12;
    const bar = $('#memBar'), next = $('#memNext');
    if (bar) bar.style.width = `${clamp(((allTimeEarned() - lo) / (hi - lo)) * 100, 0, 100)}%`;
    if (next) next.textContent = `Next level at ${fmt(hi)} all-time tokens`;
  },
  onMemoryClick(e) {
    if (e.target.closest('#btnCompact')) {
      if (!this.armed) {
        this.armed = setTimeout(() => { this.armed = null; this.memory(true); }, 5000);
        return this.memory(true);
      }
      clearTimeout(this.armed);
      this.armed = null;
      const gain = compact();
      toast({ icon: GLYPH.compress, kicker: 'Conversation compacted', title: gain ? `+${gain} prestige level${gain === 1 ? '' : 's'}` : 'Fresh start', text: gain ? `You now have ${G.memories} memories to spend.` : 'No levels gained this time, but the slate is clean.', kind: 'lilac', life: 6000 });
      return this.memory(true);
    }
    const card = e.target.closest('[data-mem]');
    if (card && buyMemory(card.dataset.mem)) {
      Sound.ach();
      toast({ icon: GLYPH.compress, kicker: 'Added to CLAUDE.md', title: esc(MEM[card.dataset.mem].name), text: esc(MEM[card.dataset.mem].desc), kind: 'lilac' });
      this.memory(true);
      UI.refreshStore(true);
    }
  },

  // ---------- options ----------
  buildOptions() {
    const check = (id, label) => `<label class="check" for="${id}"><input type="checkbox" id="${id}"> ${label}</label>`;
    $('#panel-options').innerHTML =
      `<section class="opt"><h3 class="sec">Save</h3><div class="opt-row"><button type="button" class="btn" id="optSave">Save now</button><span class="muted" id="optSaved">Saves automatically every 30 seconds in this browser.</span></div>` +
      `<h3 class="sec">Export and import</h3><label class="muted" for="saveText">Save code</label>` +
      `<textarea id="saveText" rows="4" spellcheck="false" placeholder="Export puts your save code here. Paste a code here to import it."></textarea>` +
      `<div class="opt-row"><button type="button" class="btn" id="optExport">Export</button><button type="button" class="btn" id="optCopy">Copy code</button><button type="button" class="btn" id="optImport">Import code</button><span class="muted" id="optMsg"></span></div>` +
      `<h3 class="sec">Display</h3><div class="opt-col">${check('optParticles', 'Click particles')}${check('optFloaters', 'Floating numbers')}${check('optMotion', 'Background motion')}${check('optSound', 'Sound effects')}` +
      `<label class="check" for="optNumbers">Big numbers <select id="optNumbers"><option value="words">Words (1.234 million)</option><option value="short">Short (1.23M)</option><option value="sci">Scientific (1.23e6)</option></select></label></div>` +
      `<h3 class="sec">Start over</h3><div class="opt-row"><button type="button" class="btn danger" id="optWipe">Wipe save</button><span class="muted">Deletes everything, including prestige.</span></div>` +
      `<p class="about">Claude Code Clicker is a fan-made idle game about working with Claude Code. It is not an official Anthropic product.</p></section>`;
    const msg = t => { $('#optMsg').textContent = t; };
    $('#optSave').addEventListener('click', () => { $('#optSaved').textContent = save() ? `Saved at ${new Date().toLocaleTimeString()}.` : 'This browser is blocking storage. Export a code instead.'; });
    $('#optExport').addEventListener('click', () => { $('#saveText').value = exportSave(); msg('Save code ready.'); });
    $('#optCopy').addEventListener('click', () => {
      const ta = $('#saveText');
      if (!ta.value) ta.value = exportSave();
      navigator.clipboard.writeText(ta.value).then(() => msg('Copied.'), () => { ta.focus(); ta.select(); msg('Press Ctrl+C or ⌘C to copy.'); });
    });
    $('#optImport').addEventListener('click', () => {
      try { importSave($('#saveText').value); msg('Save imported.'); } catch (e) { msg(e.message || 'That save code could not be read.'); }
    });
    const wipe = $('#optWipe');
    wipe.addEventListener('click', () => {
      if (!wipe.classList.contains('armed')) {
        wipe.classList.add('armed');
        wipe.textContent = 'Click again to wipe everything';
        setTimeout(() => { wipe.classList.remove('armed'); wipe.textContent = 'Wipe save'; }, 5000);
        return;
      }
      wipe.classList.remove('armed');
      wipe.textContent = 'Wipe save';
      wipeSave();
      toast({ icon: GLYPH.prompt, title: 'Save wiped', text: 'A brand new workspace. Click the sparkle to begin.' });
    });
    const bindCheck = (id, key, after) => $(id).addEventListener('change', e => { G.settings[key] = e.target.checked; if (after) after(); });
    bindCheck('#optParticles', 'particles');
    bindCheck('#optFloaters', 'floaters');
    bindCheck('#optMotion', 'motion');
    bindCheck('#optSound', 'sound', () => { if (G.settings.sound) Sound.ensure(); UI.refreshSoundButton(); });
    $('#optNumbers').addEventListener('change', e => { G.settings.numbers = e.target.value; });
    this.syncOptions();
  },
  syncOptions() {
    $('#optParticles').checked = G.settings.particles;
    $('#optFloaters').checked = G.settings.floaters;
    $('#optMotion').checked = G.settings.motion;
    $('#optSound').checked = G.settings.sound;
    $('#optNumbers').value = G.settings.numbers;
  },
};
