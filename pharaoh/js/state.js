// Your town: resources, buildings, builders, army, research, raids and
// achievements. Everything runs on real timestamps so progress carries on
// while the game is closed.
(function (G) {
  'use strict';
  const { D, U, BaseGen, BattleSim } = G;
  const N = D.MAP, E = D.EDGE;
  const SAVE_KEY = 'sotp_save_v1';
  const MIN = 60 * 1000;

  const OBSTACLE_TYPES = [
    { type: 'palm', sizes: [1, 2], cost: ['gold', 60], time: 10 },
    { type: 'rock', sizes: [1, 2, 3], cost: ['goop', 120], time: 15 },
    { type: 'ruin', sizes: [2], cost: ['gold', 250], time: 20 },
    { type: 'bush', sizes: [1], cost: ['goop', 40], time: 5 },
  ];
  const GEM_DROPS = [0, 0, 1, 1, 2, 2, 3, 4, 5, 6];

  const ACHIEVEMENTS = [
    { id: 'ph', name: 'Rising Pharaoh', desc: 'Upgrade your Pyramid to level {n}', stat: 'ph', goals: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], gems: [5, 10, 15, 20, 25, 30, 40, 50, 60, 100] },
    { id: 'wins', name: 'Conqueror', desc: 'Win {n} battles', stat: 'wins', goals: [1, 10, 50, 200], gems: [5, 10, 25, 50] },
    { id: 'stars', name: 'Star Gazer', desc: 'Earn {n} stars in battle', stat: 'stars', goals: [10, 100, 500], gems: [5, 20, 50] },
    { id: 'three', name: 'Total Victory', desc: 'Win {n} battles with three stars', stat: 'threeStars', goals: [1, 25, 100], gems: [5, 25, 50] },
    { id: 'pyr', name: 'Pyramid Breaker', desc: 'Destroy {n} rival Pyramids', stat: 'pyramids', goals: [10, 100], gems: [10, 30] },
    { id: 'def', name: 'Unbreakable', desc: 'Defend your town {n} times', stat: 'defenses', goals: [1, 10, 50], gems: [5, 15, 40] },
    { id: 'obs', name: 'Clearing the Sands', desc: 'Clear {n} palms, rocks or ruins', stat: 'obstacles', goals: [5, 25, 100], gems: [5, 15, 30] },
    { id: 'friends', name: 'Friendly Rivalry', desc: 'Attack friends {n} times', stat: 'friendAttacks', goals: [1, 10], gems: [5, 15] },
    { id: 'train', name: 'Drill Sergeant', desc: 'Train {n} troops', stat: 'trained', goals: [100, 1000, 5000], gems: [5, 20, 50] },
    { id: 'gold', name: 'Gold Hoarder', desc: 'Loot {n} gold from rivals', stat: 'goldLooted', goals: [10000, 1000000, 50000000], gems: [5, 20, 50] },
  ];

  let S = null; // the live state
  const listeners = new Set();
  function emit(ev, data) { for (const f of listeners) f(ev, data); }

  // ------------------------------------------------------------ new game
  function newGame(name) {
    const now = Date.now();
    const st = {
      v: 1, name: name || 'Pharaoh ' + (1000 + Math.floor(Math.random() * 9000)),
      code: U.makeBaseCode(), created: now, last: now, uid: 1,
      res: { ...D.START }, trophies: 0,
      buildings: [], obstacles: [],
      army: {}, queue: [], trainLeft: 0,
      troopLevels: Object.fromEntries(D.TROOP_ORDER.map((t) => [t, 1])),
      research: null,
      log: [], friends: [],
      stats: { wins: 0, losses: 0, stars: 0, threeStars: 0, pyramids: 0, defenses: 0, obstacles: 0, friendAttacks: 0, trained: 0, goldLooted: 0 },
      claimed: {},
      nextRaid: now + 25 * MIN, lastObstacle: now,
      tutorial: 0, sound: true,
    };
    S = st;
    addBuilding('pyramid', 20, 20, 1);
    addBuilding('builderHut', 15, 23, 1);
    addBuilding('builderHut', 26, 16, 1);
    const rng = U.makeRng(now & 0xffffffff);
    for (let i = 0; i < 18; i++) spawnObstacle(rng);
    return st;
  }

  function addBuilding(type, x, y, level) {
    const b = { id: S.uid++, type, x, y, level, upgrading: null };
    if (D.B[type].produces) { b.stored = 0; }
    S.buildings.push(b);
    return b;
  }

  // --------------------------------------------------------------- saving
  function save() {
    if (!S) return;
    S.last = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
    emit('saved');
  }
  function loadLocal() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function adopt(st) {
    S = st;
    // fill in anything added in later versions
    S.stats = Object.assign({ wins: 0, losses: 0, stars: 0, threeStars: 0, pyramids: 0, defenses: 0, obstacles: 0, friendAttacks: 0, trained: 0, goldLooted: 0 }, S.stats);
    for (const t of D.TROOP_ORDER) if (!S.troopLevels[t]) S.troopLevels[t] = 1;
    S.friends = S.friends || []; S.claimed = S.claimed || {};
    return S;
  }
  function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------ queries
  function get() { return S; }
  function ph() { const p = S.buildings.find((b) => b.type === 'pyramid'); return p ? p.level : 1; }
  function byType(type) { return S.buildings.filter((b) => b.type === type); }
  function countOf(type) { return byType(type).length; }
  function active(b) { return b.level > 0 && !b.upgrading; }

  function capacity(res) {
    if (res === 'gems') return Infinity;
    let c = 0;
    for (const b of S.buildings) {
      if (b.level < 1) continue;
      if (b.type === 'pyramid') c += D.B.pyramid.storage[b.level - 1];
      if (D.B[b.type].stores === res) c += D.storageOf(b.type, b.level);
    }
    return c;
  }
  function add(res, amt) {
    const before = S.res[res];
    S.res[res] = Math.max(0, Math.min(capacity(res), before + amt));
    if (res === 'gems') S.res.gems = Math.max(0, before + amt);
    return S.res[res] - before;
  }
  function canAfford(res, amt) { return S.res[res] >= amt; }

  function buildersTotal() { return countOf('builderHut'); }
  function buildersBusy() {
    return S.buildings.filter((b) => b.upgrading && b.upgrading.builder).length + S.obstacles.filter((o) => o.clearing).length;
  }
  function freeBuilders() { return buildersTotal() - buildersBusy(); }

  function housingCap() {
    return byType('armyCamp').filter((b) => b.level > 0).reduce((s, b) => s + D.B.armyCamp.housing[b.level - 1], 0);
  }
  function housingUsed() { return Object.entries(S.army).reduce((s, [t, n]) => s + D.T[t].housing * n, 0); }
  function queuedHousing() { return S.queue.reduce((s, q) => s + D.T[q.type].housing * q.n, 0); }
  function barracksLevel() { return byType('barracks').reduce((m, b) => Math.max(m, b.level), 0); }
  function templeLevel() { const t = byType('temple')[0]; return t ? t.level : 0; }
  function troopUnlocked(t) { return barracksLevel() >= D.T[t].barracks; }
  function troopMax(t) { return D.troopMaxLevel(templeLevel()); }

  // ------------------------------------------------------------ the map
  function occupied(x, y, w, h, ignore) {
    if (x < E || y < E || x + w > N - E || y + h > N - E) return true;
    for (const b of S.buildings) {
      if (b === ignore) continue;
      const s = D.B[b.type].size;
      if (x < b.x + s && x + w > b.x && y < b.y + s && y + h > b.y) return true;
    }
    for (const o of S.obstacles) {
      if (o === ignore) continue;
      if (x < o.x + o.size && x + w > o.x && y < o.y + o.size && y + h > o.y) return true;
    }
    return false;
  }
  function findSpot(size, nearX = N / 2, nearY = N / 2) {
    let best = null, bd = Infinity;
    for (let y = E; y <= N - E - size; y++) for (let x = E; x <= N - E - size; x++) {
      const d = U.dist(x + size / 2, y + size / 2, nearX, nearY);
      if (d >= bd) continue;
      if (!occupied(x, y, size, size)) { bd = d; best = [x, y]; }
    }
    return best;
  }
  function spawnObstacle(rng) {
    rng = rng || U.makeRng(Date.now() & 0xffffffff);
    if (S.obstacles.length >= 40) return null;
    for (let tries = 0; tries < 80; tries++) {
      const o = rng.pick(OBSTACLE_TYPES);
      const size = rng.pick(o.sizes);
      const x = rng.int(E, N - E - size), y = rng.int(E, N - E - size);
      if (U.dist(x, y, N / 2, N / 2) < 8) continue;
      if (occupied(x - 1, y - 1, size + 2, size + 2)) continue;
      const ob = { id: S.uid++, type: o.type, x, y, size, v: rng.int(0, 3), clearing: null };
      S.obstacles.push(ob);
      return ob;
    }
    return null;
  }
  function obstacleInfo(o) { return OBSTACLE_TYPES.find((t) => t.type === o.type); }

  // ------------------------------------------------------------ actions
  // Each returns { ok: true } or { ok: false, why: 'message' }.
  function costCheck(res, amt) {
    if (!canAfford(res, amt)) return { ok: false, why: `You need ${U.fmt(amt - S.res[res])} more ${res}.`, short: res };
    return null;
  }

  function place(type, x, y) {
    const def = D.B[type];
    const p = ph();
    if (countOf(type) >= D.countAllowed(type, p)) return { ok: false, why: `Upgrade your Pyramid to build more ${def.name}s.` };
    if (occupied(x, y, def.size, def.size)) return { ok: false, why: 'Something is already there.' };
    const cost = D.upgradeCost(type, 1);
    const c = costCheck(def.costRes, cost); if (c) return c;
    const time = D.upgradeTime(type, 1);
    if (time > 0 && freeBuilders() < 1) return { ok: false, why: 'All your builders are busy.', builders: true };
    S.res[def.costRes] -= cost;
    const b = addBuilding(type, x, y, time > 0 ? 0 : 1);
    if (time > 0) b.upgrading = { to: 1, start: Date.now(), end: Date.now() + time * 1000, builder: true };
    emit('placed', b);
    save();
    return { ok: true, b };
  }

  function upgrade(b) {
    const def = D.B[b.type];
    if (b.upgrading) return { ok: false, why: 'Already upgrading.' };
    const to = b.level + 1;
    const max = D.maxLevel(b.type, ph());
    if (b.type === 'pyramid' ? to > D.MAX_PH : to > max) {
      if (b.type !== 'pyramid' && to <= 11) return { ok: false, why: `Upgrade your Pyramid to level ${D.pyramidFor(b.type, to)} first.` };
      return { ok: false, why: 'Already at the highest level.' };
    }
    const cost = D.upgradeCost(b.type, to);
    const c = costCheck(def.costRes, cost); if (c) return c;
    const time = D.upgradeTime(b.type, to);
    if (time > 0 && freeBuilders() < 1) return { ok: false, why: 'All your builders are busy.', builders: true };
    S.res[def.costRes] -= cost;
    if (time <= 0) { b.level = to; emit('upgraded', b); }
    else b.upgrading = { to, start: Date.now(), end: Date.now() + time * 1000, builder: true };
    save();
    return { ok: true };
  }
  function gemsToFinish(sec) { return Math.max(1, Math.ceil(sec / 600)); }
  function finishNow(b) {
    if (!b.upgrading) return { ok: false };
    const g = gemsToFinish((b.upgrading.end - Date.now()) / 1000);
    if (S.res.gems < g) return { ok: false, why: `You need ${g} gems.` };
    S.res.gems -= g;
    b.upgrading.end = Date.now();
    tick();
    save();
    return { ok: true };
  }
  function cancelUpgrade(b) {
    if (!b.upgrading) return;
    const to = b.upgrading.to;
    S.res[D.B[b.type].costRes] += Math.floor(D.upgradeCost(b.type, to) / 2);
    if (b.level === 0) S.buildings = S.buildings.filter((x) => x !== b);
    else b.upgrading = null;
    save();
  }
  function move(b, x, y) {
    const s = D.B[b.type].size;
    if (occupied(x, y, s, s, b)) return false;
    b.x = x; b.y = y; save();
    return true;
  }
  function sell(b) { // only walls and traps can be removed
    if (!D.B[b.type].isWall && !D.B[b.type].isTrap) return;
    S.buildings = S.buildings.filter((x) => x !== b); save();
  }
  function collect(b) {
    if (!b.stored || b.stored < 1) return 0;
    const res = D.B[b.type].produces;
    const got = add(res, Math.floor(b.stored));
    b.stored -= got;
    if (b.stored < 1) b.stored = 0;
    save();
    return got;
  }
  function collectAll() {
    let g = 0, p = 0;
    for (const b of S.buildings) if (D.B[b.type].produces && b.stored >= 1) { const got = collect(b); if (D.B[b.type].produces === 'gold') g += got; else p += got; }
    return { gold: g, goop: p };
  }

  function clearObstacle(o) {
    if (o.clearing) return { ok: false, why: 'Already being cleared.' };
    const info = obstacleInfo(o);
    const [res, base] = info.cost;
    const cost = base * o.size * Math.max(1, Math.floor(ph() / 2));
    const c = costCheck(res, cost); if (c) return c;
    if (freeBuilders() < 1) return { ok: false, why: 'All your builders are busy.', builders: true };
    S.res[res] -= cost;
    o.clearing = { start: Date.now(), end: Date.now() + info.time * o.size * 1000 };
    save();
    return { ok: true };
  }
  function obstacleCost(o) { const [res, base] = obstacleInfo(o).cost; return [res, base * o.size * Math.max(1, Math.floor(ph() / 2))]; }

  function buyBuilder() {
    const n = buildersTotal();
    if (n >= 5) return { ok: false, why: 'You already have all five builders.' };
    const cost = D.BUILDER_GEM_COST[n];
    if (S.res.gems < cost) return { ok: false, why: `A new builder costs ${cost} gems. Win battles to earn more.` };
    const spot = findSpot(2, N / 2 + 6, N / 2 + 6);
    if (!spot) return { ok: false, why: 'There is no room for another hut. Clear some space first.' };
    S.res.gems -= cost;
    const b = addBuilding('builderHut', spot[0], spot[1], 1);
    save();
    return { ok: true, b };
  }

  function train(type, n = 1) {
    if (!troopUnlocked(type)) return { ok: false, why: `Upgrade your Barracks to level ${D.T[type].barracks} to train this troop.` };
    const cap = housingCap();
    const need = D.T[type].housing * n;
    if (housingUsed() + queuedHousing() + need > cap) return { ok: false, why: 'Your Army Camps are full.' };
    // Training is free: only camp space and time limit your army.
    const last = S.queue[S.queue.length - 1];
    if (last && last.type === type) last.n += n; else S.queue.push({ type, n });
    if (!S.trainLeft) S.trainLeft = D.T[S.queue[0].type].train;
    save();
    return { ok: true };
  }
  function untrain(type) {
    for (let i = S.queue.length - 1; i >= 0; i--) {
      if (S.queue[i].type !== type) continue;
      S.queue[i].n--;
      if (S.queue[i].n <= 0) { S.queue.splice(i, 1); if (i === 0) S.trainLeft = S.queue[0] ? D.T[S.queue[0].type].train : 0; }
      save();
      return;
    }
  }
  function queueSeconds() {
    const speed = Math.max(1, byType('barracks').filter(active).length);
    let s = S.trainLeft || 0;
    S.queue.forEach((q, i) => { s += D.T[q.type].train * (i === 0 ? q.n - 1 : q.n); });
    return s / speed;
  }
  function finishTraining() {
    const g = gemsToFinish(queueSeconds() * 4);
    if (S.res.gems < g) return { ok: false, why: `You need ${g} gems.` };
    let space = housingCap() - housingUsed();
    while (S.queue.length) {
      const q = S.queue[0];
      if (D.T[q.type].housing > space) break;
      S.army[q.type] = (S.army[q.type] || 0) + 1; space -= D.T[q.type].housing;
      S.stats.trained++;
      if (--q.n <= 0) S.queue.shift();
    }
    S.trainLeft = S.queue[0] ? D.T[S.queue[0].type].train : 0;
    S.res.gems -= g; save();
    return { ok: true };
  }

  function startResearch(type) {
    const tl = templeLevel();
    if (!tl) return { ok: false, why: 'Build a Temple of Ra first.' };
    const temple = byType('temple')[0];
    if (temple.upgrading) return { ok: false, why: 'The Temple is being upgraded.' };
    if (S.research) return { ok: false, why: 'The priests are already studying something.' };
    if (!troopUnlocked(type)) return { ok: false, why: 'Unlock this troop in the Barracks first.' };
    const to = S.troopLevels[type] + 1;
    if (to > troopMax(type)) return { ok: false, why: to > 11 ? 'This troop is at its highest level.' : `Upgrade the Temple of Ra to research level ${to}.` };
    const cost = D.researchCost(type, to);
    const c = costCheck('goop', cost); if (c) return c;
    S.res.goop -= cost;
    S.research = { type, to, start: Date.now(), end: Date.now() + D.researchTime(type, to) * 1000 };
    save();
    return { ok: true };
  }
  function finishResearch() {
    if (!S.research) return { ok: false };
    const g = gemsToFinish((S.research.end - Date.now()) / 1000);
    if (S.res.gems < g) return { ok: false, why: `You need ${g} gems.` };
    S.res.gems -= g; S.research.end = Date.now(); tick(); save();
    return { ok: true };
  }

  // ---------------------------------------------------------------- tick
  // Advance the town to `now`. Safe to call often; handles long gaps too.
  function tick(now = Date.now()) {
    const dt = Math.max(0, (now - S.last) / 1000);
    S.last = now;
    const done = [];
    // 1. upgrades finish
    for (const b of S.buildings) {
      if (b.upgrading && now >= b.upgrading.end) {
        b.level = b.upgrading.to;
        b.upgrading = null;
        if (D.B[b.type].produces && b.stored == null) b.stored = 0;
        done.push(b);
      }
    }
    for (const o of S.obstacles) {
      if (o.clearing && now >= o.clearing.end) {
        o.cleared = true;
        const gems = GEM_DROPS[Math.floor(Math.random() * GEM_DROPS.length)];
        S.res.gems += gems;
        S.stats.obstacles++;
        emit('obstacleCleared', { o, gems });
      }
    }
    S.obstacles = S.obstacles.filter((o) => !o.cleared);
    for (const b of done) emit('upgraded', b);

    // 2. mines produce
    for (const b of S.buildings) {
      const def = D.B[b.type];
      if (!def.produces || !active(b)) continue;
      const cap = D.mineCap(b.type, b.level);
      b.stored = Math.min(cap, (b.stored || 0) + D.rateOf(b.type, b.level) * dt / 3600);
    }

    // 3. training (in chunks so long absences work)
    let left = dt * Math.max(0, byType('barracks').filter(active).length);
    let guard = 0;
    while (left > 0 && S.queue.length && guard++ < 5000) {
      const q = S.queue[0];
      const h = D.T[q.type].housing;
      if (housingUsed() + h > housingCap()) break; // camps full: wait
      if (!S.trainLeft) S.trainLeft = D.T[q.type].train;
      const step = Math.min(left, S.trainLeft);
      S.trainLeft -= step; left -= step;
      if (S.trainLeft <= 1e-6) {
        S.army[q.type] = (S.army[q.type] || 0) + 1;
        S.stats.trained++;
        if (--q.n <= 0) S.queue.shift();
        S.trainLeft = S.queue[0] ? D.T[S.queue[0].type].train : 0;
        emit('trained', q.type);
      }
    }

    // 4. research
    if (S.research && now >= S.research.end) {
      S.troopLevels[S.research.type] = S.research.to;
      emit('researched', S.research);
      S.research = null;
    }

    // 5. new obstacles every 8 hours
    if (now - S.lastObstacle > 8 * 60 * MIN) {
      const n = Math.min(4, Math.floor((now - S.lastObstacle) / (8 * 60 * MIN)));
      for (let i = 0; i < n; i++) spawnObstacle();
      S.lastObstacle = now;
    }

    // 6. raids by rival players
    let raids = 0;
    while (now >= S.nextRaid && raids < 2) {
      const at = S.nextRaid;
      S.nextRaid = at + (30 + Math.random() * 40) * MIN;
      if (now - at > 24 * 60 * MIN && raids > 0) continue;
      const entry = runRaid(at);
      if (entry) { raids++; emit('raided', entry); }
    }
    if (S.nextRaid < now) S.nextRaid = now + (30 + Math.random() * 40) * MIN;
    return done;
  }

  // ---------------------------------------------------------------- raids
  function battleLayout(st = S) {
    return st.buildings.filter((b) => b.level > 0).map((b) => {
      const o = { type: b.type, x: b.x, y: b.y, level: b.level };
      if (b.upgrading && D.B[b.type].isDefense) o.inactive = 1;
      return o;
    });
  }
  function guardLevel() { const h = byType('royalHall')[0]; return h ? Math.max(1, Math.min(11, h.level)) : 1; }

  function runRaid(at) {
    const p = ph();
    const seed = (at / 1000) >>> 0;
    const rival = BaseGen.makeRival(p, S.trophies, seed);
    const rng = U.makeRng(seed ^ 0x51ed);
    const { army, levels } = BattleSim.planArmy(rival.ph, rng, 0.6 + rng() * 0.3);
    const layout = battleLayout();
    const stake = (res) => Math.floor(Math.min(S.res[res] * 0.2, D.lootFor(p, p, false)[res] * 3));
    const loot = { gold: stake('gold'), goop: stake('goop') };
    const opts = { layout, seed, troopLevels: levels, loot, guardLevel: guardLevel() };
    const probe = new G.Battle(opts);
    const deploy = BattleSim.planDeploy(probe, army, rng);
    const b = BattleSim.simulate(opts, deploy);
    const r = b.result();
    const won = r.stars > 0;
    const lost = { gold: 0, goop: 0 };
    if (won) {
      lost.gold = Math.min(S.res.gold, r.stolen.gold); lost.goop = Math.min(S.res.goop, r.stolen.goop);
      S.res.gold -= lost.gold; S.res.goop -= lost.goop;
    } else S.stats.defenses++;
    const dTroph = won ? -(6 + r.stars * 4) : 8 + Math.floor(Math.random() * 6);
    S.trophies = Math.max(0, S.trophies + dTroph);
    const entry = {
      id: S.uid++, at, name: rival.name, clan: rival.clan, ph: rival.ph, stars: r.stars, destruction: r.destruction, lost, trophies: dTroph,
      seed: rival.seed, replay: { layout, seed, levels, deploy, loot, guardLevel: guardLevel() }, revenged: false, seen: false,
    };
    S.log.unshift(entry);
    if (S.log.length > 12) S.log.length = 12;
    return entry;
  }

  // Battle results from your own attacks.
  function applyAttack(result, info) {
    const p = ph();
    const r = result;
    const won = r.stars > 0;
    const gained = { gold: 0, goop: 0, gems: 0, trophies: 0 };
    for (const [t, n] of Object.entries(info.used)) {
      S.army[t] = Math.max(0, (S.army[t] || 0) - n);
      if (!S.army[t]) delete S.army[t];
    }
    if (info.friendly) {
      if (won) { gained.gold = add('gold', info.loot.gold); gained.goop = add('goop', info.loot.goop); }
      S.stats.friendAttacks++;
    } else {
      if (won) {
        gained.gold = add('gold', info.loot.gold);
        gained.goop = add('goop', info.loot.goop);
        gained.gems = info.loot.gems; S.res.gems += info.loot.gems;
        gained.trophies = 12 + r.stars * 6 + Math.max(0, info.ph - p) * 4;
        S.stats.wins++;
      } else {
        gained.gold = add('gold', r.stolen.gold);
        gained.goop = add('goop', r.stolen.goop);
        gained.trophies = -(8 + Math.max(0, p - info.ph) * 2);
        S.stats.losses++;
      }
      S.trophies = Math.max(0, S.trophies + gained.trophies);
      S.stats.stars += r.stars;
      if (r.stars === 3) S.stats.threeStars++;
      if (r.pyramid) S.stats.pyramids++;
      S.stats.goldLooted += gained.gold;
      if (info.revengeId) { const e = S.log.find((x) => x.id === info.revengeId); if (e) e.revenged = true; }
    }
    save();
    return gained;
  }

  // --------------------------------------------------------- achievements
  function achievementState() {
    const st = { ...S.stats, ph: ph() };
    return ACHIEVEMENTS.map((a) => {
      const claimedTier = S.claimed[a.id] || 0;
      const tier = Math.min(claimedTier, a.goals.length - 1);
      const goal = a.goals[tier], have = st[a.stat] || 0;
      return { ...a, tier: claimedTier, goal, have, done: claimedTier >= a.goals.length, ready: claimedTier < a.goals.length && have >= goal, gemsNow: a.gems[tier] };
    });
  }
  function claim(id) {
    const a = achievementState().find((x) => x.id === id);
    if (!a || !a.ready) return 0;
    S.claimed[id] = (S.claimed[id] || 0) + 1;
    S.res.gems += a.gemsNow;
    save();
    return a.gemsNow;
  }

  G.Game = {
    newGame, save, loadLocal, adopt, wipe, get, ph, byType, countOf, active, capacity, add, canAfford,
    buildersTotal, buildersBusy, freeBuilders, housingCap, housingUsed, queuedHousing, barracksLevel, templeLevel,
    troopUnlocked, troopMax, occupied, findSpot, place, upgrade, finishNow, gemsToFinish, cancelUpgrade, move, sell,
    collect, collectAll, clearObstacle, obstacleCost, obstacleInfo, buyBuilder, train, untrain, queueSeconds, finishTraining,
    startResearch, finishResearch, tick, battleLayout, guardLevel, runRaid, applyAttack, achievementState, claim,
    on: (f) => listeners.add(f), off: (f) => listeners.delete(f), emit, ACHIEVEMENTS,
  };
})(globalThis.SOTP = globalThis.SOTP || {});
