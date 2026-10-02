'use strict';
/* Claude Code Clicker: the Dependency Garden. Plant packages, let them grow in real time, harvest them for
   rewards, and keep mature ones around for passive bonuses. Two different mature packages next to an empty
   plot can cross-breed into a new one. */

const SEEDS = {
  leftpad: { name: 'left-pad', color: '#8FD3B6', grow: 10, cost: 30, harvest: { tokens: 120 }, passive: {}, note: 'Tiny, fast and somehow load-bearing.' },
  lodash: { name: 'lodash', color: '#6FA8DC', grow: 30, cost: 120, harvest: { tokens: 600 }, passive: { prod: 0.02 }, note: 'Utility belt for every occasion.' },
  express: { name: 'express', color: '#C9B79C', grow: 45, cost: 180, harvest: { tokens: 900 }, passive: { cost: 0.01 }, note: 'Minimal, unopinionated, everywhere.' },
  react: { name: 'react', color: '#7FD1E8', grow: 60, cost: 240, harvest: { buff: 2 }, passive: { click: 0.05 }, note: 'Re-renders when you look at it.' },
  iseven: { name: 'is-even', color: '#F2C57C', grow: 20, parents: ['leftpad', 'leftpad'], harvest: { lucky: true }, passive: {}, note: 'Depends on is-odd. Naturally.' },
  typescript: { name: 'typescript', color: '#5E8FD9', grow: 90, parents: ['lodash', 'express'], harvest: { tokens: 3600 }, passive: { eureka: 0.1 }, note: 'Types, so you sleep at night.' },
  nextjs: { name: 'next.js', color: '#E9E6E1', grow: 120, parents: ['react', 'express'], harvest: { tokens: 4800 }, passive: { prod: 0.05 }, note: 'React, but it decided where the files go.' },
  rust: { name: 'rust', color: '#E0823A', grow: 240, parents: ['typescript', 'nextjs'], harvest: { building: true }, passive: { prod: 0.1 }, note: 'The crab has entered the codebase.' },
  claudemd: { name: 'CLAUDE.md', color: '#D97757', grow: 480, parents: ['rust', 'typescript'], harvest: { tokens: 28800 }, passive: { prod: 0.15, click: 0.15 }, note: 'The rarest package: perfect project memory.' },
};
const BASIC_SEEDS = ['leftpad', 'lodash', 'express', 'react'];
const WITHER_AFTER = 3; // mature plants wilt after three times their grow time
const BREED_CHANCE = 0.06; // per empty plot, per minute

const Garden = {
  key: 'garden',
  fresh: () => ({ plots: Array(16).fill(null), known: [...BASIC_SEEDS], harvests: 0, checkAt: Date.now() }),
  load(o) {
    const g = this.fresh();
    g.plots = Array.from({ length: 16 }, (_, k) => {
      const p = (o.plots || [])[k];
      return p && SEEDS[p.seed] && typeof p.at === 'number' ? { seed: p.seed, at: p.at } : null;
    });
    g.known = [...new Set([...BASIC_SEEDS, ...(o.known || []).filter(s => SEEDS[s])])];
    g.harvests = +o.harvests || 0;
    g.checkAt = typeof o.checkAt === 'number' ? o.checkAt : Date.now();
    return g;
  },
  size: () => (G.owned[3] >= 50 ? 4 : 3),
  growSec: id => SEEDS[id].grow * 60,
  // 0..1 while growing, 1..WITHER_AFTER+1 while mature, beyond that the plant has wilted.
  age(p) { return (Date.now() - p.at) / 1000 / this.growSec(p.seed); },
  mature(p) { const a = this.age(p); return a >= 1 && a < 1 + WITHER_AFTER; },
  seedCost: id => Math.ceil(Math.max(D.tpsGross * (SEEDS[id].cost || 60), 50 * (SEEDS[id].cost || 60) / 30)),
  // Passive bonuses from every mature plant in the visible plots.
  passive() {
    const t = { prod: 0, click: 0, cost: 0, eureka: 0 };
    const n = this.size();
    for (let k = 0; k < 16; k++) {
      const p = G.garden.plots[k];
      if (!p || !this.inGrid(k, n) || !this.mature(p)) continue;
      for (const [key, v] of Object.entries(SEEDS[p.seed].passive)) t[key] += v;
    }
    return t;
  },
  inGrid: (k, n) => k % 4 < n && Math.floor(k / 4) < n,
  neighbours(k) {
    const x = k % 4, y = Math.floor(k / 4), out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < 4 && ny < 4) out.push(ny * 4 + nx);
    }
    return out;
  },
  // Economy hooks.
  prod() { return 1 + this.cache.prod; },
  click() { return 1 + this.cache.click; },
  costOf() { return 1 - Math.min(0.2, this.cache.cost); },
  eureka() { return 1 + this.cache.eureka; },
  cache: { prod: 0, click: 0, cost: 0, eureka: 0 },
  stateSig: '',
  tick(dt) {
    // Re-evaluate once a second: maturing or wilting plants change the bonuses.
    if ((this.acc = (this.acc || 0) + dt) < 1) return;
    this.acc = 0;
    const n = this.size();
    let sig = '';
    G.garden.plots.forEach((p, k) => {
      if (!p) return;
      const a = this.age(p);
      if (a >= 1 + WITHER_AFTER) { G.garden.plots[k] = null; sig += 'w'; return; }
      sig += a >= 1 ? 'm' : 'g';
    });
    if (sig !== this.stateSig) { this.stateSig = sig; this.cache = this.passive(); recompute(); }
    // Cross-breeding: catch up on every whole minute that passed (including time away, up to 8 hours).
    let mins = Math.min(480, Math.floor((Date.now() - G.garden.checkAt) / 60000));
    if (mins > 0) G.garden.checkAt += mins * 60000;
    while (mins-- > 0) this.breed(n);
  },
  breed(n) {
    for (let k = 0; k < 16; k++) {
      if (G.garden.plots[k] || !this.inGrid(k, n)) continue;
      const near = this.neighbours(k).filter(j => this.inGrid(j, n) && G.garden.plots[j] && this.mature(G.garden.plots[j])).map(j => G.garden.plots[j].seed);
      if (near.length < 2) continue;
      const options = Object.entries(SEEDS).filter(([, s]) => s.parents && (s.parents[0] === s.parents[1]
        ? near.filter(x => x === s.parents[0]).length >= 2
        : near.includes(s.parents[0]) && near.includes(s.parents[1])));
      if (!options.length || Math.random() > BREED_CHANCE) continue;
      const [id, seed] = pick(options);
      G.garden.plots[k] = { seed: id, at: Date.now() };
      if (!G.garden.known.includes(id)) {
        G.garden.known.push(id);
        toast({ icon: GLYPH.star, kicker: 'New package discovered', title: esc(seed.name), text: `${esc(seed.note)} You can plant it now too.`, kind: 'gold', life: 7000 });
      }
    }
  },
  plant(k, id) {
    if (G.garden.plots[k] || !G.garden.known.includes(id)) return false;
    const cost = this.seedCost(id);
    if (G.tokens < cost) return false;
    G.tokens -= cost;
    G.garden.plots[k] = { seed: id, at: Date.now() };
    this.stateSig = '';
    return true;
  },
  harvest(k) {
    const p = G.garden.plots[k];
    if (!p || this.age(p) < 1) return null;
    const h = SEEDS[p.seed].harvest;
    G.garden.plots[k] = null;
    G.garden.harvests++;
    this.stateSig = '';
    if (h.tokens) { const g = Math.max(D.tpsGross * h.tokens, h.tokens); earn(g); return `+${fmt(g)} tokens`; }
    if (h.buff) { addBuff('garden', 'Fresh Harvest', 60, { prod: h.buff, desc: 'From the Dependency Garden: production ×2.' }); return 'Production ×2 for 60 seconds'; }
    if (h.lucky) { const g = Math.min(G.tokens * 0.15, D.tpsGross * 900) + 13; earn(g); return `Lucky Commit: +${fmt(g)} tokens`; }
    if (h.building) {
      const owned = BUILDINGS.map((_, i) => i).filter(i => G.owned[i] > 0);
      const i = owned.length ? pick(owned) : 0;
      G.owned[i]++;
      recompute();
      return `A free ${BUILDINGS[i].name}`;
    }
    return 'Harvested';
  },
  dig(k) { G.garden.plots[k] = null; this.stateSig = ''; },
};
registerSystem(Garden);

// ---------- Garden UI ----------
function plantSvg(seed, stage, wilting) {
  const col = wilting ? '#7a6a68' : SEEDS[seed].color, h = 6 + stage * 16;
  let s = `<path d="M16 30V${30 - h}" stroke="#5FAF8F" stroke-width="2" stroke-linecap="round"/>`;
  if (stage > 0.3) s += `<path d="M16 ${30 - h * 0.55}C11 ${28 - h * 0.6} 8 ${26 - h * 0.4} 9 ${24 - h * 0.3}C13 ${25 - h * 0.35} 15 ${27 - h * 0.45} 16 ${30 - h * 0.55}Z" fill="#76B947"/>`;
  if (stage > 0.6) s += `<path d="M16 ${30 - h * 0.75}C21 ${28 - h * 0.8} 24 ${26 - h * 0.6} 23 ${24 - h * 0.5}C19 ${25 - h * 0.55} 17 ${27 - h * 0.65} 16 ${30 - h * 0.75}Z" fill="#8FD3B6"/>`;
  if (stage >= 1) s += `<path d="${STAR(16, 30 - h - 2, 6, 6.5, 2.8)}" fill="${col}"/><circle cx="16" cy="${28 - h}" r="2" fill="#FFF1D2"/>`;
  else s += `<circle cx="16" cy="${30 - h}" r="${2 + stage * 2}" fill="${col}" opacity=".8"/>`;
  return `<svg class="ico" viewBox="0 0 32 32" aria-hidden="true">${s}</svg>`;
}

const GardenUI = {
  id: 'garden', name: 'Garden', need: [3, 1], ever: () => G.garden.harvests > 0,
  blurb: 'Plant packages that grow in real time. Harvest them for rewards, keep them mature for passive bonuses, and cross-breed rare ones.',
  sel: 'leftpad',
  badge: () => G.garden.plots.some((p, k) => p && Garden.inGrid(k, Garden.size()) && Garden.mature(p)),
  render(body) {
    body.innerHTML =
      `<div class="tb-head"><h3 class="sec">Dependency Garden</h3><span class="chip" id="gdSize"></span></div>` +
      `<p class="tb-note">Pick a package, then click an empty plot to plant it. Plants grow in real time, even while the game is closed. ` +
      `Mature plants give passive bonuses until you harvest them (or they wilt). Two different mature packages next to an empty plot can cross-breed.</p>` +
      `<div class="gd-bonus" id="gdBonus"></div><div class="gd-seeds" id="gdSeeds"></div><div class="gd-grid" id="gdGrid"></div>`;
    body.querySelector('#gdSeeds').addEventListener('click', e => {
      const b = e.target.closest('[data-seed]');
      if (b) { this.sel = b.dataset.seed; this.update(body, true); }
    });
    body.querySelector('#gdGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-plot]');
      if (!b) return;
      const k = +b.dataset.plot, p = G.garden.plots[k];
      if (this.sel === 'shovel') { if (p) { Garden.dig(k); Sound.squash(); } }
      else if (p && Garden.age(p) >= 1) {
        const out = Garden.harvest(k);
        Sound.ach();
        toast({ icon: GLYPH.star, kicker: `Harvested ${esc(SEEDS[p.seed].name)}`, title: esc(out), kind: 'mint', life: 3200 });
      } else if (!p) {
        if (Garden.plant(k, this.sel)) Sound.buy();
      }
      Garden.cache = Garden.passive();
      recompute();
      this.update(body, true);
    });
    bindTips(body.querySelector('#gdGrid'), '[data-plot]', el => this.plotTip(+el.dataset.plot));
    bindTips(body.querySelector('#gdSeeds'), '[data-seed]', el => this.seedTip(el.dataset.seed));
  },
  update(body, force) {
    const n = Garden.size();
    body.querySelector('#gdSize').textContent = `${n}×${n} plots${n < 4 ? ' · 4×4 at 50 Linters' : ''}`;
    const c = Garden.cache, parts = [];
    if (c.prod) parts.push(`production +${Math.round(c.prod * 100)}%`);
    if (c.click) parts.push(`clicks +${Math.round(c.click * 100)}%`);
    if (c.cost) parts.push(`buildings −${Math.round(c.cost * 100)}%`);
    if (c.eureka) parts.push(`Eureka tokens +${Math.round(c.eureka * 100)}%`);
    body.querySelector('#gdBonus').textContent = parts.length ? `Mature plants: ${parts.join(', ')}.` : 'No mature plants yet.';
    const seeds = ['shovel', ...Object.keys(SEEDS)].map(id => {
      if (id === 'shovel') return `<button type="button" class="gd-seed ${this.sel === 'shovel' ? 'sel' : ''}" data-seed="shovel">Shovel<span>dig up</span></button>`;
      const known = G.garden.known.includes(id);
      if (!known) return `<button type="button" class="gd-seed unknown" data-seed="${id}" disabled>???<span>cross-breed</span></button>`;
      const cost = Garden.seedCost(id);
      return `<button type="button" class="gd-seed ${this.sel === id ? 'sel' : ''} ${G.tokens < cost ? 'poor' : ''}" data-seed="${id}" style="--sc:${SEEDS[id].color}">` +
        `${esc(SEEDS[id].name)}<span>${TK}${fmt(cost)} · ${fmtDur(Garden.growSec(id))}</span></button>`;
    }).join('');
    const sEl = body.querySelector('#gdSeeds');
    if (force || sEl.dataset.sig !== seeds) { sEl.dataset.sig = seeds; sEl.innerHTML = seeds; }
    const grid = body.querySelector('#gdGrid');
    grid.style.setProperty('--n', n);
    let html = '';
    for (let k = 0; k < 16; k++) {
      if (!Garden.inGrid(k, n)) continue;
      const p = G.garden.plots[k];
      if (!p) { html += `<button type="button" class="gd-plot empty" data-plot="${k}" aria-label="Empty plot"></button>`; continue; }
      const a = Garden.age(p), stage = Math.min(1, a), wilting = a > WITHER_AFTER;
      const label = a < 1 ? fmtDur((1 - a) * Garden.growSec(p.seed)) : wilting ? 'wilting' : 'ready';
      html += `<button type="button" class="gd-plot ${a >= 1 ? 'ripe' : ''} ${wilting ? 'wilt' : ''}" data-plot="${k}" aria-label="${esc(SEEDS[p.seed].name)}">` +
        `${plantSvg(p.seed, stage, wilting)}<span class="gd-name">${esc(SEEDS[p.seed].name)}</span><span class="gd-time">${label}</span>` +
        `${a < 1 ? `<span class="gd-prog" style="width:${(a * 100).toFixed(1)}%"></span>` : ''}</button>`;
    }
    if (force || grid.dataset.sig !== html) { grid.dataset.sig = html; grid.innerHTML = html; }
  },
  plotTip(k) {
    const p = G.garden.plots[k];
    if (!p) return tipHead(svgIcon(GLYPH.star), 'Empty plot', 'Garden') + `<div class="tip-desc">${this.sel === 'shovel' ? 'Nothing to dig up.' : `Click to plant ${esc(SEEDS[this.sel] ? SEEDS[this.sel].name : '')}.`}</div>`;
    const s = SEEDS[p.seed], a = Garden.age(p);
    const status = a < 1 ? `Growing: ${fmtDur((1 - a) * Garden.growSec(p.seed))} left.` : a > WITHER_AFTER ? 'Wilting soon. Harvest it now.' : `Mature. Wilts in ${fmtDur((1 + WITHER_AFTER - a) * Garden.growSec(p.seed))}.`;
    return tipHead(plantSvg(p.seed, Math.min(1, a), false), s.name, 'Garden plant') + `<div class="tip-desc">${esc(s.note)}</div>` +
      `<div class="tip-stats">${status}<br>${this.effects(p.seed)}</div>`;
  },
  seedTip(id) {
    if (id === 'shovel') return tipHead(svgIcon(GLYPH.bug), 'Shovel', 'Garden tool') + '<div class="tip-desc">Click a plot to dig up whatever is in it. No refund.</div>';
    const s = SEEDS[id];
    return tipHead(plantSvg(id, 1, false), s.name, s.parents ? 'Hybrid package' : 'Package') + `<div class="tip-desc">${esc(s.note)}</div>` +
      `<div class="tip-stats">Grows in ${fmtDur(Garden.growSec(id))}.<br>${this.effects(id)}${s.parents ? `<br>Bred from ${esc(SEEDS[s.parents[0]].name)} + ${esc(SEEDS[s.parents[1]].name)}.` : ''}</div>`;
  },
  effects(id) {
    const s = SEEDS[id], ps = s.passive, h = s.harvest, bits = [];
    if (ps.prod) bits.push(`+${ps.prod * 100}% production`);
    if (ps.click) bits.push(`+${ps.click * 100}% clicks`);
    if (ps.cost) bits.push(`buildings ${ps.cost * 100}% cheaper`);
    if (ps.eureka) bits.push(`Eureka tokens +${ps.eureka * 100}% more often`);
    const harvest = h.tokens ? `${fmtDur(h.tokens)} of production` : h.buff ? 'production ×2 for 60 seconds' : h.lucky ? 'a Lucky Commit' : h.building ? 'a free building' : '';
    return `While mature: <b>${bits.length ? bits.join(', ') : 'nothing'}</b>.<br>Harvest: <b>${harvest}</b>.`;
  },
};
Toolbox.add(GardenUI);
