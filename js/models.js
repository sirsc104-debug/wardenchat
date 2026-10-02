'use strict';
/* Claude Code Clicker: the Model Picker. Three slots (100%, 50% and 25% strength); each model has a trade-off.
   Placing a model uses a swap; swaps refill over time. */

const SLOT_POWER = [1, 0.5, 0.25];
const SLOT_NAMES = ['Primary', 'Secondary', 'Tertiary'];
const MAX_SWAPS = 3, SWAP_REFILL = 10 * 60; // seconds per swap

const MODELS = [
  { id: 'swift', name: 'Swift Model', blurb: 'Answers instantly. Thinks a little less.',
    fx: s => ({ click: 1 + 1.0 * s, prod: 1 - 0.1 * s }), text: s => `Clicking +${pct(1.0 * s)}, production −${pct(0.1 * s)}` },
  { id: 'balanced', name: 'Balanced Model', blurb: 'Good at everything, great at nothing in particular.',
    fx: s => ({ prod: 1 + 0.1 * s }), text: s => `Production +${pct(0.1 * s)}` },
  { id: 'deep', name: 'Deep Thinker', blurb: 'Starts slow. Gets very, very good.',
    fx: (s, k) => ({ prod: 1 + Models.charge(k) * 0.6 * s }), text: (s, k) => `Production +${pct(Models.charge(k) * 0.6 * s)} (charges to +${pct(0.6 * s)} over 30 minutes; resets when moved)` },
  { id: 'longctx', name: 'Long-Context Model', blurb: 'Reads every invoice before it pays.',
    fx: s => ({ cost: 1 - 0.06 * s, eureka: 1 - 0.1 * s }), text: s => `Buildings −${pct(0.06 * s)} cost, Eureka tokens −${pct(0.1 * s)} as often` },
  { id: 'coder', name: 'Code Specialist', blurb: 'Lives in the terminal.',
    fx: s => ({ coder: 1 + 0.3 * s, prod: 1 - 0.05 * s }), text: s => `Linters, CI Pipelines and Subagents +${pct(0.3 * s)}, everything else −${pct(0.05 * s)}` },
  { id: 'creative', name: 'Creative Writer', blurb: 'Every effect becomes a story.',
    fx: s => ({ effDur: 1 + 0.25 * s, click: 1 - 0.1 * s }), text: s => `Eureka effects last +${pct(0.25 * s)}, clicking −${pct(0.1 * s)}` },
  { id: 'reasoner', name: 'Reasoner', blurb: 'Shows its work, all of it.',
    fx: s => ({ flow: 1 + 1.0 * s, prod: 1 - 0.05 * s }), text: s => `Flow bonus +${pct(1.0 * s)}, production −${pct(0.05 * s)}` },
  { id: 'tools', name: 'Tool User', blurb: 'Knows exactly which tool to call.',
    fx: s => ({ missions: 1 - 0.25 * s }), text: s => `Subagent missions finish ${pct(0.25 * s)} faster` },
];
const pct = v => `${Math.round(v * 100)}%`;

const Models = {
  key: 'models',
  fresh: () => ({ slots: [null, null, null], since: [0, 0, 0], swaps: MAX_SWAPS, swapAt: Date.now() }),
  load(o) {
    const m = this.fresh();
    m.slots = [0, 1, 2].map(k => (MODELS.some(x => x.id === (o.slots || [])[k]) ? o.slots[k] : null));
    m.since = [0, 1, 2].map(k => +((o.since || [])[k]) || Date.now());
    m.swaps = clamp(Math.floor(+o.swaps || 0), 0, MAX_SWAPS);
    m.swapAt = +o.swapAt || Date.now();
    return m;
  },
  charge(k) { if (k == null) return 1; return clamp((Date.now() - G.models.since[k]) / 1000 / 1800, 0, 1); },
  effect(key) {
    let v = 1;
    G.models.slots.forEach((id, k) => {
      if (!id) return;
      const e = MODELS.find(m => m.id === id).fx(SLOT_POWER[k], k)[key];
      if (e) v *= e;
    });
    return v;
  },
  prod() { return this.effect('prod'); },
  click() { return this.effect('click'); },
  costOf() { return this.effect('cost'); },
  eureka() { return this.effect('eureka'); },
  effDur() { return this.effect('effDur'); },
  flow() { return this.effect('flow'); },
  each(each) {
    const c = this.effect('coder'); // Linters, CI Pipelines and Subagents
    if (c !== 1) for (const i of [3, 4, 5]) each[i] *= c;
  },
  missionSpeed() { return this.effect('missions'); },
  tick(dt) {
    const m = G.models;
    while (m.swaps < MAX_SWAPS && Date.now() - m.swapAt >= SWAP_REFILL * 1000) { m.swaps++; m.swapAt += SWAP_REFILL * 1000; }
    if (m.swaps >= MAX_SWAPS) m.swapAt = Date.now();
    // The Deep Thinker keeps charging, so refresh production every few seconds while it is slotted.
    if (m.slots.includes('deep') && (this.acc = (this.acc || 0) + dt) > 5) { this.acc = 0; recompute(); }
  },
  place(k, id) {
    const m = G.models;
    if (m.swaps <= 0 || m.slots[k] === id) return false;
    const from = m.slots.indexOf(id);
    if (from >= 0) { m.slots[from] = null; }
    m.slots[k] = id;
    m.since[k] = Date.now();
    if (m.swaps === MAX_SWAPS) m.swapAt = Date.now();
    m.swaps--;
    recompute();
    return true;
  },
  remove(k) { G.models.slots[k] = null; recompute(); },
};
registerSystem(Models);

const ModelsUI = {
  id: 'models', name: 'Models', need: [6, 1], sel: null,
  blurb: 'Slot models into three slots. Each one helps in one way and costs you in another.',
  render(body) {
    body.innerHTML =
      `<div class="tb-head"><h3 class="sec">Model Picker</h3><span class="chip" id="mdSwaps"></span></div>` +
      `<p class="tb-note">Pick a model, then click a slot to place it there (uses a swap). The Primary slot gives the full effect, Secondary half, Tertiary a quarter. ` +
      `Click a filled slot with nothing picked to empty it for free.</p>` +
      `<div class="md-slots" id="mdSlots"></div><h3 class="sec">Models</h3><div class="md-roster" id="mdRoster"></div>`;
    body.querySelector('#mdRoster').addEventListener('click', e => {
      const b = e.target.closest('[data-model]');
      if (b) { this.sel = this.sel === b.dataset.model ? null : b.dataset.model; this.update(body, true); }
    });
    body.querySelector('#mdSlots').addEventListener('click', e => {
      const b = e.target.closest('[data-slot]');
      if (!b) return;
      const k = +b.dataset.slot;
      if (this.sel) {
        if (Models.place(k, this.sel)) { Sound.buy(); this.sel = null; }
        else toast({ icon: GLYPH.clock, title: 'No swaps left', text: 'Swaps refill one every 10 minutes.', kind: 'bad', life: 2600 });
      } else if (G.models.slots[k]) Models.remove(k);
      this.update(body, true);
    });
  },
  update(body, force) {
    const m = G.models, next = SWAP_REFILL - (Date.now() - m.swapAt) / 1000;
    body.querySelector('#mdSwaps').textContent = `Swaps ${m.swaps}/${MAX_SWAPS}${m.swaps < MAX_SWAPS ? ` · +1 in ${fmtDur(next)}` : ''}`;
    const slots = SLOT_NAMES.map((n, k) => {
      const id = m.slots[k], mod = id && MODELS.find(x => x.id === id);
      return `<button type="button" class="md-slot tb-card ${this.sel ? 'target' : ''}" data-slot="${k}"><span class="chip gold">${n} · ${SLOT_POWER[k] * 100}%</span>` +
        (mod ? `<b>${esc(mod.name)}</b><span class="mem-desc">${esc(mod.text(SLOT_POWER[k], k))}</span>` : `<b class="muted">Empty</b><span class="mem-desc">${this.sel ? 'Click to place the picked model.' : 'Pick a model below.'}</span>`) + '</button>';
    }).join('');
    const sEl = body.querySelector('#mdSlots');
    if (force || sEl.dataset.sig !== slots) { sEl.dataset.sig = slots; sEl.innerHTML = slots; }
    const roster = MODELS.map(x => {
      const at = m.slots.indexOf(x.id);
      return `<button type="button" class="md-model tb-card ${this.sel === x.id ? 'sel' : ''}" data-model="${x.id}"><b>${esc(x.name)}</b>` +
        `<span class="mem-desc">${esc(x.blurb)}</span><span class="md-fx">${esc(x.text(1))} at full strength</span>${at >= 0 ? `<span class="chip good">In ${SLOT_NAMES[at]}</span>` : ''}</button>`;
    }).join('');
    const rEl = body.querySelector('#mdRoster');
    if (force || rEl.dataset.sig !== roster) { rEl.dataset.sig = roster; rEl.innerHTML = roster; }
  },
};
Toolbox.add(ModelsUI);
