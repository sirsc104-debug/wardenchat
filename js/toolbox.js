'use strict';
/* Claude Code Clicker: the Toolbox tab, home of the bigger systems (garden, exchange, models, missions, duck).
   Each tool registers { id, name, need: [buildingIndex, count], render(body), update(body), fast?(body), badge?() }. */

const TOOLS = [];
const Toolbox = {
  cur: null, navSig: '',
  add(tool) { TOOLS.push(tool); },
  unlocked: t => G.owned[t.need[0]] >= t.need[1] || (t.ever && t.ever()),
  anyUnlocked() { return TOOLS.some(t => this.unlocked(t)); },
  needsAttention() { return TOOLS.some(t => this.unlocked(t) && t.badge && safe(t.badge)); },
  init() {
    const panel = $('#panel-toolbox');
    panel.innerHTML = '<nav class="tb-nav" id="tbNav" aria-label="Toolbox"></nav><div class="tb-body" id="tbBody"></div>';
    panel.addEventListener('click', e => {
      const b = e.target.closest('[data-tool]');
      if (!b) return;
      this.cur = b.dataset.tool;
      Tip.hide();
      this.refresh(true);
    });
  },
  tool() { return TOOLS.find(t => t.id === this.cur); },
  refresh(force) {
    if (!this.cur) this.cur = (TOOLS.find(t => this.unlocked(t)) || TOOLS[0]).id;
    const sig = TOOLS.map(t => `${t.id}${this.unlocked(t) ? 1 : 0}${t.badge && safe(t.badge) ? 1 : 0}${t.id === this.cur ? 1 : 0}`).join();
    if (force || sig !== this.navSig) {
      this.navSig = sig;
      $('#tbNav').innerHTML = TOOLS.map(t => {
        const open = this.unlocked(t), dot = open && t.badge && safe(t.badge);
        return `<button type="button" data-tool="${t.id}" aria-pressed="${t.id === this.cur}" class="${open ? '' : 'locked'}">` +
          `${esc(t.name)}${dot ? '<span class="tb-dot" aria-label="needs attention"></span>' : ''}</button>`;
      }).join('');
    }
    const t = this.tool(), body = $('#tbBody');
    if (!this.unlocked(t)) {
      const key = 'locked-' + t.id;
      if (body.dataset.tool !== key) {
        body.dataset.tool = key;
        const [i, n] = t.need;
        body.innerHTML = `<div class="tb-locked">${svgIcon(BUILDINGS[i].icon)}<div><div class="ws-title">${esc(t.name)}</div>` +
          `<p>${esc(t.blurb)}</p><p class="muted">Unlocks when you own ${n === 1 ? 'a' : n} ${esc(n === 1 ? BUILDINGS[i].name : BUILDINGS[i].plural)}.</p></div></div>`;
      }
      return;
    }
    if (force || body.dataset.tool !== t.id) {
      body.dataset.tool = t.id;
      t.render(body);
    }
    t.update(body);
  },
  fast() {
    const t = this.tool();
    if (t && t.fast && this.unlocked(t) && $('#tbBody').dataset.tool === t.id) t.fast($('#tbBody'));
  },
};

// Small shared helpers for the tools.
const bar = (pct, cls = '') => `<div class="meter ${cls}"><span style="width:${clamp(pct, 0, 100).toFixed(1)}%"></span></div>`;
const fmtDur = s => (s >= 3600 ? `${+(s / 3600).toFixed(1)}h` : s >= 60 ? `${Math.round(s / 60)}m` : `${Math.ceil(s)}s`);
