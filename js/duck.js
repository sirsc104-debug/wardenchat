'use strict';
/* Claude Code Clicker: the Pet Rubber Duck. Feed it buildings to level it up; every level unlocks an aura,
   and level 10 opens a second aura slot. */

const DUCK_FEED = 20; // buildings eaten per level
const DUCK_TITLES = ['Rubber Duck', 'Duckling', 'Bath Duck', 'Debug Duck', 'Senior Duck', 'Staff Duck', 'Principal Duck',
  'Duck of the Year', 'Legendary Duck', 'Cosmic Duck', 'The Duck Prime'];
const AURAS = [
  { id: 'quack', lvl: 1, name: 'Quack Boost', text: 'Clicking +10%', click: 1.1 },
  { id: 'listen', lvl: 2, name: 'Patient Listener', text: 'Production +5%', prod: 1.05 },
  { id: 'feather', lvl: 3, name: 'Lucky Feather', text: 'Eureka tokens appear 10% more often', eureka: 1.1 },
  { id: 'crumbs', lvl: 4, name: 'Bread Crumbs', text: 'Buildings cost 3% less', cost: 0.97 },
  { id: 'bath', lvl: 5, name: 'Bubble Bath', text: 'Flow bonus +25%', flow: 1.25 },
  { id: 'debug', lvl: 6, name: 'Debug Aura', text: 'Squashed bugs pay twice as much', bugMult: 2 },
  { id: 'down', lvl: 7, name: 'Golden Down', text: 'Eureka effects last 20% longer', effDur: 1.2 },
  { id: 'pond', lvl: 8, name: 'Deep Pond', text: 'Offline production +20%', offline: 0.2 },
  { id: 'army', lvl: 9, name: 'Duck Army', text: 'Production +1% per duck level', army: true },
];

const Duck = {
  key: 'duck',
  fresh: () => ({ level: 0, auras: [null, null] }),
  load(o) {
    const lv = clamp(Math.floor(+o.level || 0), 0, 10);
    const ok = id => (AURAS.find(a => a.id === id && a.lvl <= lv) ? id : null);
    return { level: lv, auras: [ok((o.auras || [])[0]), lv >= 10 ? ok((o.auras || [])[1]) : null] };
  },
  active() { return G.duck.auras.filter(Boolean).map(id => AURAS.find(a => a.id === id)); },
  pickNum(key) { return this.active().reduce((p, a) => p * (a[key] || 1), 1); },
  prod() { return this.pickNum('prod') * (this.active().some(a => a.army) ? 1 + 0.01 * G.duck.level : 1); },
  click() { return this.pickNum('click'); },
  eureka() { return this.pickNum('eureka'); },
  costOf() { return this.pickNum('cost'); },
  flow() { return this.pickNum('flow'); },
  bugMult() { return this.pickNum('bugMult'); },
  effDur() { return this.pickNum('effDur'); },
  offline() { return this.active().reduce((t, a) => t + (a.offline || 0), 0); },
  food() { return G.duck.level < 10 ? G.duck.level : -1; }, // building index eaten for the next level
  feed() {
    const i = this.food();
    if (i < 0 || G.owned[i] - awayOf(i) < DUCK_FEED) return false;
    G.owned[i] -= DUCK_FEED;
    G.duck.level++;
    recompute();
    return true;
  },
  setAura(slot, id) {
    if (slot === 1 && G.duck.level < 10) return;
    G.duck.auras[slot] = id || null;
    if (G.duck.auras[0] && G.duck.auras[0] === G.duck.auras[1]) G.duck.auras[1 - slot] = null;
    recompute();
  },
};
registerSystem(Duck);

function duckArt(level) {
  const parts = BUILDINGS[2].icon.map(p => `<path d="${p.d}" fill="${p.f || 'none'}"${p.s ? ` stroke="${p.s}" stroke-width="${p.w || 1.5}"` : ''}/>`).join('');
  const glasses = level >= 3 ? '<path d="M8.6 8.5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0ZM12.6 8.5H14.5" fill="none" stroke="#2A2230" stroke-width=".8"/>' : '';
  const crown = level >= 7 ? `<path d="M7.5 4.5L9 1.5L11 3.5L12 0.8L13 3.5L15 1.5L16.5 4.5Z" fill="#F2C57C" stroke="#8B5E3C" stroke-width=".5"/>` : '';
  const halo = level >= 10 ? '<ellipse cx="12" cy="0.6" rx="5" ry="1.2" fill="none" stroke="#FFF1D2" stroke-width=".8"/>' : '';
  return `<svg class="dk-art lv${Math.min(level, 10)}" viewBox="-2 -3 36 36" aria-hidden="true">${halo}${parts}${glasses}${crown}</svg>`;
}

const DuckUI = {
  id: 'duck', name: 'Duck', need: [2, 1], ever: () => G.duck.level > 0,
  blurb: 'A pet rubber duck you feed buildings to level up. Every level unlocks a passive aura.',
  render(body) {
    body.innerHTML = `<div class="dk-wrap"><div class="tb-head"><h3 class="sec">Pet Rubber Duck</h3><span class="chip gold" id="dkLvl"></span></div>` +
      `<div class="dk-top"><div class="dk-pond" id="dkArt"></div><div class="dk-info"><div class="ws-title" id="dkTitle"></div>` +
      `<p class="tb-note" id="dkNext"></p><button type="button" class="btn compact" id="dkFeed"></button></div></div>` +
      `<h3 class="sec">Auras</h3><div class="dk-slots" id="dkSlots"></div><div class="mem-grid" id="dkAuras"></div></div>`;
    const w = body.firstElementChild;
    w.addEventListener('click', e => {
      if (e.target.closest('#dkFeed') && Duck.feed()) {
        Sound.ach();
        toast({ icon: BUILDINGS[2].icon, kicker: 'Duck levelled up', title: `${DUCK_TITLES[G.duck.level]} (level ${G.duck.level})`, text: G.duck.level >= 10 ? 'A second aura slot is open.' : `New aura: ${AURAS[G.duck.level - 1].name}.`, kind: 'gold' });
        this.render(body);
      }
    });
    w.addEventListener('change', e => {
      const sel = e.target.closest('[data-aura-slot]');
      if (sel) { Duck.setAura(+sel.dataset.auraSlot, sel.value); this.update(body, true); }
    });
    this.update(body, true);
  },
  update(body, force) {
    const lv = G.duck.level, i = Duck.food();
    body.querySelector('#dkLvl').textContent = `Level ${lv} of 10`;
    body.querySelector('#dkTitle').textContent = DUCK_TITLES[lv];
    const art = body.querySelector('#dkArt');
    if (force || art.dataset.lv !== String(lv)) { art.dataset.lv = lv; art.innerHTML = duckArt(lv); }
    const feed = body.querySelector('#dkFeed');
    if (i < 0) {
      body.querySelector('#dkNext').textContent = 'Your duck is fully grown. It is, frankly, magnificent.';
      feed.hidden = true;
    } else {
      const have = G.owned[i] - awayOf(i);
      body.querySelector('#dkNext').textContent = `Feed it ${DUCK_FEED} ${BUILDINGS[i].plural} to reach level ${lv + 1}` +
        `${lv + 1 < 10 ? ` and unlock ${AURAS[lv].name} (${AURAS[lv].text.toLowerCase()})` : ' and open a second aura slot'}. You have ${have}.`;
      feed.textContent = `Feed ${DUCK_FEED} ${BUILDINGS[i].plural}`;
      feed.disabled = have < DUCK_FEED;
    }
    const slots = [0, 1].map(k => {
      if (k === 1 && lv < 10) return `<label class="dk-slot tb-card muted">Second slot opens at level 10</label>`;
      const opts = AURAS.filter(a => a.lvl <= lv).map(a => `<option value="${a.id}" ${G.duck.auras[k] === a.id ? 'selected' : ''}>${esc(a.name)}: ${esc(a.text)}</option>`).join('');
      return `<label class="dk-slot tb-card" for="dkAura${k}">Aura ${k + 1}<select id="dkAura${k}" data-aura-slot="${k}" ${lv ? '' : 'disabled'}><option value="">None</option>${opts}</select></label>`;
    }).join('');
    const sEl = body.querySelector('#dkSlots');
    if (force || sEl.dataset.sig !== slots) { sEl.dataset.sig = slots; sEl.innerHTML = slots; }
    const list = AURAS.map(a => `<div class="mem-card ${a.lvl <= lv ? (G.duck.auras.includes(a.id) ? 'owned' : 'can') : 'locked'}">` +
      `<span class="mem-name">${a.lvl <= lv ? esc(a.name) : '???'}</span><span class="mem-desc">${a.lvl <= lv ? esc(a.text) : `Unlocks at level ${a.lvl}`}</span>` +
      `<span class="mem-state">${G.duck.auras.includes(a.id) ? 'Active' : a.lvl <= lv ? 'Available' : 'Locked'}</span></div>`).join('');
    const lEl = body.querySelector('#dkAuras');
    if (force || lEl.dataset.sig !== list) { lEl.dataset.sig = list; lEl.innerHTML = list; }
  },
};
Toolbox.add(DuckUI);
