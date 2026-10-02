'use strict';
/* Claude Code Clicker: middle-pane tabs (workspace, stats, achievements, terminal, memory, options). */

const Panels = {
  tab: 'workspace', achDirty: true, memSig: '', armed: null,
  init() {
    document.querySelectorAll('#tabs [data-tab]').forEach(btn => btn.addEventListener('click', () => this.show(btn.dataset.tab)));
    this.buildTerminal();
    this.buildOptions();
    bindTips($('#panel-achievements'), '.ach', el => this.achTip(ACH[el.dataset.id]));
    bindTips($('#panel-stats'), '.odds-row', el => eurekaTip(el.dataset.eff));
    $('#panel-memory').addEventListener('click', e => this.onMemoryClick(e));
    // Hovering a node previews it in the inspector; leaving the board shows the selected node again.
    $('#panel-memory').addEventListener('pointerover', e => { const n = e.target.closest('.mt-node'); if (n) this.showInspect(n.dataset.mem); });
    $('#panel-memory').addEventListener('pointerout', e => { if (e.target.closest('#mtBoard') && !e.relatedTarget?.closest?.('#mtBoard')) this.showInspect(this.memSel); });
    $('#panel-memory').addEventListener('focusin', e => { const n = e.target.closest('.mt-node'); if (n) this.showInspect(n.dataset.mem); });
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
    const tb = $('#tabToolbox'), tbOn = Toolbox.anyUnlocked();
    if (tb.hidden === tbOn) tb.hidden = !tbOn;
    tb.classList.toggle('attn', Toolbox.needsAttention());
    if (!force && !this.visible()) return;
    if (this.tab === 'stats') this.stats();
    else if (this.tab === 'achievements' && (force || this.achDirty)) this.achievements();
    else if (this.tab === 'memory') this.memory(force);
    else if (this.tab === 'toolbox') Toolbox.refresh(force);
    else if (this.tab === 'options' && $('#optThemeRow').hidden === G.blackhole) this.syncOptions();
  },
  fastRefresh() {
    if (this.tab === 'terminal' && this.visible()) this.terminalTick();
    if (this.tab === 'toolbox' && this.visible()) Toolbox.fast();
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
      ['Flow', `${Math.round(D.flow * 100)}% → +${+(D.flowBonus * 100).toFixed(1)}%, engineers ×${D.flowMult.toFixed(2)}`],
      ['Flow bubbles popped', G.bubbles.toLocaleString('en-US')],
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
      EUREKA.map(e => `<tr class="odds-row ${e.bad ? 'bad' : ''}" data-eff="${e.id}" tabindex="0"><td>${esc(e.name)}${e.bad ? ' <span class="bad-tag">bad</span>' : ''}</td><td>${e.w}%</td><td>${!e.ok || safe(e.ok) ? 'Yes' : 'Not yet'}</td></tr>`).join('') +
      `</tbody></table></div><p class="muted odds-note">Hover over an effect to see what it does. If one is not available yet, the others share its chance.</p>` +
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
      `<p class="muted">Flow <b>${pct}%</b>. Every achievement adds 4% Flow, shown as the rising tide under the sparkle. Each 1% Flow gives +0.25% production, Engineer upgrades multiply that, and Flow bubbles rise from the tide more often the higher it gets. Pop them for tokens.</p></div>` +
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
    const sig = [G.prestige, G.memories, pending, [...G.mem].join(), this.armed, this.armedRewrite, this.memSel, G.challenge, G.challengesDone.join(), this.armedChallenge].join('|');
    if (force || sig !== this.memSig) {
      this.memSig = sig;
      if (!MEM[this.memSel]) this.memSel = (MEMORY.find(m => memState(m) === 'can') || MEMORY.find(m => memState(m) === 'poor') || MEMORY[0]).id;
      const keepScroll = $('#panel-memory').scrollTop;
      $('#panel-memory').innerHTML =
        `<div class="mem-hero">` +
        `<div class="mem-stat"><div class="mem-num">${G.prestige.toLocaleString('en-US')}</div><div class="mem-lab">Prestige level</div><div class="mem-sub">+${Math.round(D.prestigeBonus * 100).toLocaleString('en-US')}% production</div></div>` +
        `<div class="mem-stat"><div class="mem-num">${G.memories.toLocaleString('en-US')}</div><div class="mem-lab">Memories to spend</div><div class="mem-sub">One per level gained</div></div>` +
        `<div class="mem-stat"><div class="mem-num gain">+${pending.toLocaleString('en-US')}</div><div class="mem-lab">Levels from /compact</div><div class="mem-sub" id="memNext"></div></div></div>` +
        `<div class="meter lilac"><span id="memBar"></span></div>` +
        `<div class="compact-box"><div><h3 class="sec">Compact the conversation</h3><p>Running <code>/compact</code> summarizes this run into memories. Prestige levels come from all-time tokens: the first needs ${fmtWords(PRESTIGE_BASE)}, and each level after that needs more. ` +
        `You keep achievements, prestige and memories. Tokens, buildings and upgrades start over.</p></div>` +
        `<button type="button" class="btn compact ${this.armed ? 'armed' : ''}" id="btnCompact">${this.armed ? `Confirm: compact for +${pending.toLocaleString('en-US')}` : '/compact'}</button></div>` +
        this.treeHtml() + this.challengeHtml();
      $('#panel-memory').scrollTop = keepScroll;
      this.drawEdges();
      if (!this.treeObs && window.ResizeObserver) {
        this.treeObs = new ResizeObserver(() => this.drawEdges());
        this.treeObs.observe($('#panel-memory'));
      }
    }
    const lvl = prestigeFor(allTimeEarned()), lo = Math.pow(lvl, 3) * PRESTIGE_BASE, hi = Math.pow(lvl + 1, 3) * PRESTIGE_BASE;
    const bar = $('#memBar'), next = $('#memNext');
    if (bar) bar.style.width = `${clamp(((allTimeEarned() - lo) / (hi - lo)) * 100, 0, 100)}%`;
    const cbar = $('#chalBar'), c = CHALLENGES.find(x => x.id === G.challenge);
    if (cbar && c) {
      cbar.style.width = `${clamp((G.earned / c.goal) * 100, 0, 100)}%`;
      $('#chalText').textContent = `${fmt(G.earned)} of ${fmt(c.goal)} tokens this run`;
    }
    if (next) next.textContent = `Next level at ${fmt(hi)} all-time tokens`;
  },
  memIcon(m) { return svgIcon(typeof m.icon === 'number' ? BUILDINGS[m.icon].icon : GLYPH[m.icon]); },
  treeHtml() {
    const rows = Math.max(...MEMORY.map(m => m.row));
    const routes = ROUTES.map((r, k) => {
      const all = MEMORY.filter(m => m.route === r.id), have = all.filter(m => hasMem(m.id)).length;
      return `<div class="mt-route" style="--rc:${r.color}"><span class="mt-route-name">${esc(r.name)}</span>` +
        `<span class="mt-route-blurb">${esc(r.blurb)}</span><span class="mt-route-count">${have}/${all.length}</span></div>`;
    }).join('');
    const nodes = MEMORY.map(m => {
      const r = ROUTES.findIndex(x => x.id === m.route), st = memState(m);
      return `<button type="button" class="mt-node ${st}${m.cap ? ' cap' : ''}${this.memSel === m.id ? ' sel' : ''}" data-mem="${m.id}" ` +
        `style="--route:${r};--col:${m.col};--row:${m.row};--rc:${ROUTES[r].color}" aria-label="${esc(m.name)}: ${esc(m.desc)}" aria-pressed="${this.memSel === m.id}">` +
        `${this.memIcon(m)}${st === 'owned' ? '' : `<span class="mt-tag">${fmtShort(m.cost)}</span>`}</button>`;
    }).join('');
    // An "or" marker sits between the two sides of each fork.
    const forks = ROUTES.map((r, k) => {
      const pair = MEMORY.filter(m => m.route === r.id && m.excl);
      return pair.length ? `<span class="mt-or" style="--route:${k};--row:${pair[0].row}">or</span>` : '';
    }).join('');
    const spent = G.memSpent;
    return `<section class="mt" aria-label="CLAUDE.md memory tree">` +
      `<div class="mt-head"><div><h3 class="sec">CLAUDE.md</h3><p class="muted">What you learn here stays through every /compact. Each route forks once, so pick a side; ` +
      `rewriting CLAUDE.md gives back every memory you spent so you can try another path.</p></div>` +
      `<button type="button" class="btn tiny ${this.armedRewrite ? 'armed' : ''}" id="btnRewrite" ${spent ? '' : 'disabled'}>${this.armedRewrite ? `Confirm: refund ${spent.toLocaleString('en-US')}` : 'Rewrite CLAUDE.md'}</button></div>` +
      `<div class="mt-routes">${routes}</div>` +
      `<div class="mt-board" id="mtBoard" style="--rows:${rows}"><div class="mt-lanes" aria-hidden="true">${ROUTES.map(r => `<span style="--rc:${r.color}"></span>`).join('')}</div>` +
      `<svg class="mt-edges" id="mtEdges" aria-hidden="true"></svg>` +
      `<div class="mt-root" id="mtRoot">${svgIcon(GLYPH.sparkle)}<span>CLAUDE.md</span></div>${forks}${nodes}</div>` +
      `<div class="mt-inspect" id="mtInspect" aria-live="polite">${this.inspectHtml(this.memSel)}</div></section>`;
  },
  inspectHtml(id) {
    const m = MEM[id];
    if (!m) return '';
    const r = ROUTES.find(x => x.id === m.route), st = memState(m);
    const names = ids => ids.map(x => MEM[x].name);
    const fork = m.excl ? MEMORY.find(o => o.excl === m.excl && o.id !== m.id) : null;
    const kicker = [r.name, `Tier ${m.row}`, m.cap ? 'Capstone' : m.excl ? `Fork: this or ${fork.name}` : ''].filter(Boolean).join(' · ');
    let foot;
    if (st === 'owned') foot = `<span class="mt-status good">In your CLAUDE.md</span>`;
    else if (st === 'excluded') foot = `<span class="mt-status">You took ${esc(fork.name)} on this fork. Rewrite CLAUDE.md to switch.</span>`;
    else if (st === 'locked') {
      const need = [...names(m.req.filter(x => !hasMem(x)))];
      if (m.any.length && !m.any.some(hasMem)) need.push(names(m.any).join(' or '));
      foot = `<span class="mt-status">Requires ${esc(need.join(' and '))}</span>`;
    } else if (st === 'poor') foot = `<span class="mt-status">Need ${(m.cost - G.memories).toLocaleString('en-US')} more memor${m.cost - G.memories === 1 ? 'y' : 'ies'}</span>`;
    else foot = `<button type="button" class="btn mt-learn" data-learn="${m.id}">Learn for ${m.cost.toLocaleString('en-US')} memor${m.cost === 1 ? 'y' : 'ies'}</button>`;
    return `<div class="mt-insp ${st}" style="--rc:${r.color}"><div class="mt-insp-icon">${this.memIcon(m)}</div><div class="mt-insp-body">` +
      `<div class="mt-kicker">${esc(kicker)}</div><div class="mt-insp-name">${esc(m.name)}</div><p class="mt-insp-desc">${esc(m.desc)}</p>` +
      `<div class="mt-insp-foot"><span class="mt-cost">${m.cost.toLocaleString('en-US')} memor${m.cost === 1 ? 'y' : 'ies'}</span>${foot}</div></div></div>`;
  },
  // Connect each node to its parents, measured from the laid-out board so the lines fit at any width.
  drawEdges() {
    const board = $('#mtBoard'), svg = $('#mtEdges');
    if (!board || !svg || !board.offsetWidth) return;
    const b = board.getBoundingClientRect();
    const at = el => { const r = el.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; };
    const pos = { root: at($('#mtRoot')) };
    board.querySelectorAll('.mt-node').forEach(el => { pos[el.dataset.mem] = at(el); });
    svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    let out = '';
    for (const m of MEMORY) {
      const parents = [...m.req, ...m.any];
      if (!parents.length) parents.push('root');
      const col = ROUTES.find(r => r.id === m.route).color, st = memState(m);
      for (const pid of parents) {
        const p = pos[pid], q = pos[m.id];
        if (!p || !q) continue;
        const pOwned = pid === 'root' || hasMem(pid);
        const cls = st === 'owned' && pOwned ? 'on' : pOwned && st !== 'excluded' ? 'open' : 'off';
        const my = (p.y + q.y) / 2;
        out += `<path class="${cls}" d="M${p.x.toFixed(1)} ${p.y.toFixed(1)} C${p.x.toFixed(1)} ${my.toFixed(1)} ${q.x.toFixed(1)} ${my.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}" style="--rc:${col}"/>`;
      }
    }
    svg.innerHTML = out;
  },
  showInspect(id) {
    const box = $('#mtInspect');
    if (box && MEM[id] && box.dataset.id !== id) { box.dataset.id = id; box.innerHTML = this.inspectHtml(id); }
  },
  challengeHtml() {
    const active = CHALLENGES.find(c => c.id === G.challenge);
    const cards = CHALLENGES.map(c => {
      const done = challengeDone(c.id), on = G.challenge === c.id, armed = this.armedChallenge === c.id;
      const btn = on ? `<button type="button" class="btn" data-chal-abandon>Abandon challenge</button>`
        : G.challenge ? '' : `<button type="button" class="btn compact ${armed ? 'armed' : ''}" data-chal="${c.id}">${armed ? `Confirm: /compact into ${esc(c.name)}` : 'Start challenge'}</button>`;
      return `<div class="chal-card ${done ? 'done' : ''} ${on ? 'on' : ''}"><div class="mem-name">${esc(c.name)}</div>` +
        `<div class="mem-desc"><b>Rule:</b> ${esc(c.rule)}<br><b>Goal:</b> generate ${fmtWords(c.goal)} tokens in the challenge run.</div>` +
        `<div class="mem-cost">${done ? 'Completed · ' : 'Reward · '}${esc(c.reward)}: ${esc(c.perk)}</div>${btn}</div>`;
    }).join('');
    return `<h3 class="sec">Challenge runs</h3><p class="muted">Starting a challenge runs /compact (you still get your prestige) and starts a new run under a rule. ` +
      `Reach the goal to earn a special memory with a permanent perk.</p>` +
      (active ? `<div class="chal-progress"><div class="meter"><span id="chalBar"></span></div><div class="mem-sub" id="chalText"></div></div>` : '') +
      `<div class="mem-grid">${cards}</div>`;
  },
  onMemoryClick(e) {
    const ab = e.target.closest('[data-chal-abandon]');
    if (ab) { abandonChallenge(); toast({ icon: GLYPH.compress, title: 'Challenge abandoned', text: 'The run continues with normal rules.' }); return this.memory(true); }
    const cb = e.target.closest('[data-chal]');
    if (cb) {
      const id = cb.dataset.chal;
      if (this.armedChallenge !== id) {
        clearTimeout(this.chalTimer);
        this.armedChallenge = id;
        this.chalTimer = setTimeout(() => { this.armedChallenge = null; this.memory(true); }, 5000);
        return this.memory(true);
      }
      clearTimeout(this.chalTimer);
      this.armedChallenge = null;
      const gain = startChallenge(id), c = CHALLENGES.find(x => x.id === id);
      toast({ icon: GLYPH.compress, kicker: 'Challenge started', title: esc(c.name), text: `${esc(c.rule)} Goal: ${fmtWords(c.goal)} tokens.${gain ? ` (+${gain} prestige from the compaction.)` : ''}`, kind: 'lilac', life: 7000 });
      UI.refreshStore(true);
      return this.memory(true);
    }
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
    if (e.target.closest('#btnRewrite')) {
      if (!this.armedRewrite) {
        this.armedRewrite = setTimeout(() => { this.armedRewrite = null; this.memory(true); }, 5000);
        return this.memory(true);
      }
      clearTimeout(this.armedRewrite);
      this.armedRewrite = null;
      const back = rewriteMemories();
      toast({ icon: GLYPH.compress, kicker: 'CLAUDE.md rewritten', title: `${back.toLocaleString('en-US')} memories refunded`, text: 'Every route is open again. Pick a new path.', kind: 'lilac' });
      UI.refreshStore(true);
      return this.memory(true);
    }
    const learn = e.target.closest('[data-learn]');
    if (learn && buyMemory(learn.dataset.learn)) {
      const m = MEM[learn.dataset.learn];
      Sound.ach();
      toast({ icon: GLYPH.compress, kicker: 'Added to CLAUDE.md', title: esc(m.name), text: esc(m.desc), kind: 'lilac' });
      UI.refreshStore(true);
      return this.memory(true);
    }
    const node = e.target.closest('.mt-node');
    if (node) { this.memSel = node.dataset.mem; this.memory(true); }
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
      `<label class="check" for="optTheme" id="optThemeRow" hidden>Clicker style <select id="optTheme"><option value="classic">Classic</option><option value="horizon">Event Horizon</option></select></label>` +
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
    $('#optTheme').addEventListener('change', e => { if (G.blackhole) { G.theme = e.target.value; applyTheme(); save(); } });
    this.syncOptions();
  },
  syncOptions() {
    $('#optParticles').checked = G.settings.particles;
    $('#optFloaters').checked = G.settings.floaters;
    $('#optMotion').checked = G.settings.motion;
    $('#optSound').checked = G.settings.sound;
    $('#optNumbers').value = G.settings.numbers;
    $('#optThemeRow').hidden = !G.blackhole;
    $('#optTheme').value = G.theme;
  },
};
