'use strict';
/* Claude Code Clicker: Subagent Missions. Send Subagents on real-time jobs (5 minutes to 8 hours). While they
   are away they do not produce, but they come back with far more tokens, sometimes a free upgrade, and
   sometimes a rare item with a permanent bonus. Missions keep running while the game is closed. */

const MISSION_TYPES = [
  'Refactor the legacy billing module', 'Write the missing tests', 'Hunt down a memory leak', 'Migrate the app to TypeScript',
  'Triage 300 open issues', 'Port the hot path to Rust', 'Document the public API', 'Map the whole monorepo',
  'Upgrade every dependency', 'Fix the flaky integration test', 'Untangle a circular import', 'Speed up the CI pipeline',
];
const MISSION_LENGTHS = [[300, 1], [900, 2], [1800, 3], [3600, 5], [7200, 8], [14400, 12], [28800, 20]]; // [seconds, Subagents needed]
const MAX_ACTIVE = 3;
const RARE_ITEMS = [
  { id: 'semicolon', name: 'Golden Semicolon', text: 'Production +2%', prod: 1.02 },
  { id: 'answer', name: 'Lost Stack Overflow Answer', text: 'Production +3%', prod: 1.03 },
  { id: 'treaty', name: 'Tabs-and-Spaces Peace Treaty', text: 'Production +2%', prod: 1.02 },
  { id: 'build', name: 'Always-Green Build', text: 'Production +3%', prod: 1.03 },
  { id: 'keyboard', name: "Founder's Keyboard", text: 'Clicking +5%', click: 1.05 },
  { id: 'duck', name: 'Ancient Rubber Duck', text: 'Clicking +5%', click: 1.05 },
  { id: 'coffee', name: 'Bottomless Coffee', text: 'Missions 10% faster', speed: 0.9 },
  { id: 'readme', name: 'The Perfect README', text: 'Flow bonus +10%', flow: 1.1 },
];

const Missions = {
  key: 'missions',
  fresh() { return { board: [], active: [], items: [], done: 0, rerollAt: 0 }; },
  load(o) {
    const m = this.fresh();
    const ok = x => x && typeof x.name === 'string' && x.dur > 0 && x.agents > 0;
    m.board = (o.board || []).filter(ok).slice(0, 3);
    m.active = (o.active || []).filter(x => ok(x) && x.end > 0).slice(0, MAX_ACTIVE);
    m.items = (o.items || []).filter(id => RARE_ITEMS.some(r => r.id === id));
    m.done = +o.done || 0;
    m.rerollAt = +o.rerollAt || 0;
    return m;
  },
  newMission() {
    const [dur, agents] = pick(MISSION_LENGTHS);
    return { name: pick(MISSION_TYPES), dur, agents, id: Math.random().toString(36).slice(2, 9) };
  },
  fill() { while (G.missions.board.length < 3) G.missions.board.push(this.newMission()); },
  busy() { return G.missions.active.reduce((t, a) => t + a.agents, 0); },
  free() { return G.owned[5] - this.busy(); },
  // Subagents on missions do not produce.
  away(i) { return i === 5 ? Math.min(G.owned[5], this.busy()) : 0; },
  item(key) { return G.missions.items.reduce((p, id) => p * (RARE_ITEMS.find(r => r.id === id)[key] || 1), 1); },
  prod() { return this.item('prod'); },
  click() { return this.item('click'); },
  flow() { return this.item('flow'); },
  speed() { return this.item('speed') * modProduct('missionSpeed'); },
  send(k) {
    const m = G.missions, b = m.board[k];
    if (!b || m.active.length >= MAX_ACTIVE || this.free() < b.agents) return false;
    const dur = Math.max(60, Math.round(b.dur * this.speed()));
    // Reward is fixed at launch: three times what those Subagents would have made, plus a share of everything else.
    const agentRate = b.agents * D.each[5] * D.mult;
    const reward = agentRate * b.dur * 3 + D.tpsBase * Math.min(b.dur, 3600) * 0.05 + 100;
    m.active.push({ ...b, end: Date.now() + dur * 1000, total: dur, reward, upgrade: b.dur >= 3600 ? 0.3 : 0.1, rare: 0.02 + 0.38 * (b.dur / 28800) });
    m.board.splice(k, 1);
    this.fill();
    recompute();
    return true;
  },
  collect(k) {
    const m = G.missions, a = m.active[k];
    if (!a || Date.now() < a.end) return null;
    m.active.splice(k, 1);
    m.done++;
    const out = [];
    let tokens = a.reward;
    if (Math.random() < a.upgrade) {
      const u = visibleUpgrades()[0];
      if (u) { G.upgrades.add(u.id); out.push(`free upgrade: ${u.name}`); }
    }
    if (Math.random() < a.rare) {
      const left = RARE_ITEMS.filter(r => !m.items.includes(r.id));
      if (left.length) { const r = pick(left); m.items.push(r.id); out.unshift(`RARE ITEM: ${r.name} (${r.text})`); }
      else tokens *= 2;
    }
    earn(tokens);
    out.unshift(`+${fmt(tokens)} tokens`);
    recompute();
    return out;
  },
  reroll() {
    if (Date.now() < G.missions.rerollAt) return false;
    G.missions.board = [];
    this.fill();
    G.missions.rerollAt = Date.now() + 10 * 60 * 1000;
    return true;
  },
};
registerSystem(Missions);

const MissionsUI = {
  id: 'missions', name: 'Missions', need: [5, 1], ever: () => G.missions.done > 0 || G.missions.active.length > 0,
  blurb: 'Send Subagents on jobs that run in real time, from 5 minutes to 8 hours, for big rewards and rare items.',
  badge: () => G.missions.active.some(a => Date.now() >= a.end),
  render(body) {
    Missions.fill();
    body.innerHTML =
      `<div class="ms-wrap"><div class="tb-head"><h3 class="sec">Subagent Missions</h3><span class="chip" id="msFree"></span></div>` +
      `<p class="tb-note">Subagents on a mission do not produce while they are away, but they bring back about three times what they would have made, ` +
      `sometimes a free upgrade, and sometimes a rare item with a permanent bonus. Missions keep running while the game is closed. Up to ${MAX_ACTIVE} at once.</p>` +
      `<h3 class="sec">In progress</h3><div class="ms-list" id="msActive"></div>` +
      `<div class="tb-head"><h3 class="sec">Job board</h3><button type="button" class="btn tiny" id="msReroll">New jobs</button></div><div class="ms-list" id="msBoard"></div>` +
      `<h3 class="sec">Rare items</h3><div class="ms-items" id="msItems"></div></div>`;
    body.firstElementChild.addEventListener('click', e => {
      const s = e.target.closest('[data-send]'), c = e.target.closest('[data-collect]');
      if (s && Missions.send(+s.dataset.send)) Sound.buy();
      if (c) {
        const out = Missions.collect(+c.dataset.collect);
        if (out) {
          Sound.ach();
          toast({ icon: BUILDINGS[5].icon, kicker: 'Mission complete', title: esc(out[0]), text: out.slice(1).map(esc).join('<br>'), kind: out.some(x => x.startsWith('RARE')) ? 'legend' : 'mint', life: 6000 });
        }
      }
      if (e.target.closest('#msReroll')) Missions.reroll();
      this.update(body, true);
    });
  },
  update(body, force) {
    const free = Missions.free();
    body.querySelector('#msFree').textContent = `${free} of ${G.owned[5]} Subagents free`;
    const rr = Math.max(0, (G.missions.rerollAt - Date.now()) / 1000);
    const rb = body.querySelector('#msReroll');
    rb.disabled = rr > 0;
    rb.textContent = rr > 0 ? `New jobs in ${fmtDur(rr)}` : 'New jobs';
    const act = G.missions.active.map((a, k) => {
      const left = Math.max(0, (a.end - Date.now()) / 1000), done = left <= 0;
      return `<div class="ms-row tb-card ${done ? 'ready' : ''}"><div><b>${esc(a.name)}</b><span class="mem-desc">${a.agents} Subagent${a.agents === 1 ? '' : 's'} · ${fmtDur(a.total)} · reward ${fmt(a.reward)} tokens</span>` +
        `${bar(100 - (left / a.total) * 100)}</div>${done ? `<button type="button" class="btn compact" data-collect="${k}">Collect</button>` : `<span class="chip">${fmtDur(left)} left</span>`}</div>`;
    }).join('') || '<p class="muted">No missions running.</p>';
    const aEl = body.querySelector('#msActive');
    if (force || aEl.dataset.sig !== act) { aEl.dataset.sig = act; aEl.innerHTML = act; }
    const board = G.missions.board.map((b, k) => {
      const can = G.missions.active.length < MAX_ACTIVE && free >= b.agents;
      return `<div class="ms-row tb-card"><div><b>${esc(b.name)}</b><span class="mem-desc">Needs ${b.agents} Subagent${b.agents === 1 ? '' : 's'} · takes ${fmtDur(Math.round(b.dur * Missions.speed()))}` +
        ` · ${b.dur >= 3600 ? '30%' : '10%'} upgrade chance · ${Math.round((0.02 + 0.38 * (b.dur / 28800)) * 100)}% rare item chance</span></div>` +
        `<button type="button" class="btn" data-send="${k}" ${can ? '' : 'disabled'}>Send</button></div>`;
    }).join('');
    const bEl = body.querySelector('#msBoard');
    if (force || bEl.dataset.sig !== board) { bEl.dataset.sig = board; bEl.innerHTML = board; }
    const items = RARE_ITEMS.map(r => {
      const has = G.missions.items.includes(r.id);
      return `<div class="ms-item tb-card ${has ? 'has' : ''}"><b>${has ? esc(r.name) : '???'}</b><span class="mem-desc">${has ? esc(r.text) : 'Not found yet'}</span></div>`;
    }).join('');
    const iEl = body.querySelector('#msItems');
    if (force || iEl.dataset.sig !== items) { iEl.dataset.sig = items; iEl.innerHTML = items; }
  },
  fast(body) { this.update(body); },
};
Toolbox.add(MissionsUI);
