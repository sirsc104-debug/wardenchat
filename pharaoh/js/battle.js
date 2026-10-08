// Battle simulation. Pure logic with a fixed time step and a seeded random
// generator, so the same layout, army and deploy list always plays out the
// same way. That lets AI raids on your town run instantly and replay later.
(function (G) {
  'use strict';
  const { D, U } = G;
  const N = D.MAP;
  const DT = 0.1;              // seconds per tick
  const BATTLE_TIME = 180;     // three minutes
  const WALL_PENALTY = 9;      // extra path cost for breaking through a wall

  // Binary min-heap over typed arrays (keys are path costs, values are cell indexes).
  class Heap {
    constructor(cap) { this.k = new Float32Array(cap); this.v = new Int32Array(cap); this.n = 0; }
    push(key, val) {
      if (this.n >= this.k.length) {
        const k = new Float32Array(this.k.length * 2); k.set(this.k); this.k = k;
        const v = new Int32Array(this.v.length * 2); v.set(this.v); this.v = v;
      }
      const K = this.k, V = this.v;
      let i = this.n++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (K[p] <= key) break;
        K[i] = K[p]; V[i] = V[p]; i = p;
      }
      K[i] = key; V[i] = val;
    }
    pop() { // returns the value; the key is left in this.lastKey
      const K = this.k, V = this.v;
      const topK = K[0], topV = V[0];
      const n = --this.n;
      if (n > 0) {
        const key = K[n], val = V[n];
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i, mk = key;
          if (l < n && K[l] < mk) { m = l; mk = K[l]; }
          if (r < n && K[r] < mk) { m = r; }
          if (m === i) break;
          K[i] = K[m]; V[i] = V[m]; i = m;
        }
        K[i] = key; V[i] = val;
      }
      this.lastKey = topK;
      return topV;
    }
    get size() { return this.n; }
  }

  const GUARD_MIX = [
    ['spearman', 'archer'],
    ['spearman', 'archer', 'camelArcher'],
    ['shieldBearer', 'archer', 'camelArcher', 'sandMage'],
    ['anubisWarrior', 'camelArcher', 'sandMage', 'mummy'],
  ];

  class Battle {
    // opts: { layout:[{type,x,y,level}], seed, troopLevels:{id:lvl}, loot:{gold,goop}, hidden traps... }
    constructor(opts) {
      this.rng = U.makeRng(opts.seed || 1);
      this.tick = 0;
      this.time = 0;
      this.ended = false;
      this.loot = opts.loot || { gold: 0, goop: 0 };
      this.stolen = { gold: 0, goop: 0 };
      this.buildings = [];
      this.traps = [];
      this.troops = [];
      this.projectiles = [];
      this.fx = [];          // visual events for the renderer
      this.zones = [];       // lingering quicksand areas
      this.uid = 1;
      this.occ = new Int32Array(N * N).fill(-1);
      this.fieldCache = new Map();
      this.mapVersion = 0;
      this.deployed = 0;
      this.deployedAny = false;
      this.reserve = opts.reserveCount || 0; // troops not yet deployed (set by caller)
      this.guardsSpawned = false;
      this.guardQueue = [];

      for (const b of opts.layout) {
        const def = D.B[b.type];
        if (!def) continue;
        if (def.isTrap) {
          this.traps.push({ type: b.type, x: b.x, y: b.y, level: b.level, def, triggered: false, fuse: -1, cx: b.x + 0.5, cy: b.y + 0.5 });
          continue;
        }
        const idx = this.buildings.length;
        const hp = D.buildingHp(b.type, b.level);
        const o = {
          idx, type: b.type, def, x: b.x, y: b.y, size: def.size, level: b.level,
          hp, maxHp: hp, cx: b.x + def.size / 2, cy: b.y + def.size / 2,
          destroyed: false, cd: 0, target: null, ramp: 0, lootGold: 0, lootGoop: 0, flash: 0,
          counts: !def.isWall,
        };
        if (def.isDefense) {
          o.inactive = !!b.inactive; // defenses being upgraded do not fire
          o.dmg = D.defenseDmg(b.type, b.level);
          o.cd = 0.5 + this.rng() * 0.5;
        }
        this.buildings.push(o);
        for (let yy = 0; yy < def.size; yy++)
          for (let xx = 0; xx < def.size; xx++) this.occ[(b.y + yy) * N + b.x + xx] = idx;
      }
      this.totalCount = this.buildings.filter((b) => b.counts).length;
      this.destroyedCount = 0;
      this.pyramid = this.buildings.find((b) => b.type === 'pyramid') || null;
      this.royalHall = this.buildings.find((b) => b.type === 'royalHall') || null;
      this.troopLevels = opts.troopLevels || {};
      this.guardLevel = opts.guardLevel || 1;
      this.distributeLoot();
      this.buildDeployMask();
    }

    // Split the loot on offer across storages, mines and the Pyramid.
    distributeLoot() {
      for (const res of ['gold', 'goop']) {
        const total = this.loot[res] || 0;
        const holders = this.buildings.filter((b) => b.def.stores === res);
        const mines = this.buildings.filter((b) => b.def.produces === res);
        let shares = [];
        const sw = holders.length ? 0.6 : 0, mw = mines.length ? 0.2 : 0, pw = this.pyramid ? 0.2 : 0;
        const sum = sw + mw + pw || 1;
        for (const h of holders) shares.push([h, (sw / sum) / holders.length]);
        for (const m of mines) shares.push([m, (mw / sum) / mines.length]);
        if (this.pyramid) shares.push([this.pyramid, pw / sum]);
        let given = 0;
        shares.forEach(([b, f], i) => {
          const amt = i === shares.length - 1 ? total - given : Math.floor(total * f);
          given += amt;
          if (res === 'gold') b.lootGold += amt; else b.lootGoop += amt;
        });
      }
      for (const b of this.buildings) { b.lg0 = b.lootGold; b.lp0 = b.lootGoop; }
    }

    buildDeployMask() {
      const m = new Uint8Array(N * N); // 1 = blocked for deploying
      for (const b of this.buildings) {
        if (b.destroyed) continue;
        const pad = b.def.isWall ? 0 : 1;
        for (let y = b.y - pad; y < b.y + b.size + pad; y++)
          for (let x = b.x - pad; x < b.x + b.size + pad; x++)
            if (x >= 0 && y >= 0 && x < N && y < N) m[y * N + x] = 1;
      }
      this.deployMask = m;
    }
    canDeploy(x, y) {
      const cx = Math.floor(x), cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= N || cy >= N) return false;
      return !this.deployMask[cy * N + cx];
    }

    // ---------------------------------------------------------------- troops
    makeUnit(type, level, x, y, side) {
      const t = D.T[type] || (type === 'miniMummy' ? D.MINI_MUMMY : null);
      const hp = D.troopStat(type, level, 'hp');
      return {
        uid: this.uid++, type, t, level, side, x, y, px: x, py: y,
        hp, maxHp: hp, air: !!t.air, dead: false, cd: 0.2 + this.rng() * 0.6,
        target: null, unitTarget: null, wallTarget: null, slow: 1, slowUntil: 0,
        ox: (this.rng() - 0.5) * 0.6, oy: (this.rng() - 0.5) * 0.6, face: 1, attacking: 0, walk: this.rng() * 10,
        dmg: D.troopStat(type, level, 'dmg'), heal: D.troopStat(type, level, 'heal'),
        retarget: 0,
      };
    }

    deploy(type, level, x, y) {
      if (this.ended || !this.canDeploy(x, y)) return null;
      const u = this.makeUnit(type, level, x, y, 'att');
      this.troops.push(u);
      this.deployed++;
      this.deployedAny = true;
      this.fx.push({ k: 'deploy', x, y, t: this.time });
      return u;
    }

    // ------------------------------------------------------------ path fields
    // Distance field to a target footprint. Buildings block, walls cost extra.
    // Cell kinds for path finding: 0 open, 1 wall, 2 building. Rebuilt when something falls.
    cellKinds() {
      if (this._kindsV === this.mapVersion) return this._kinds;
      const k = this._kinds || (this._kinds = new Uint8Array(N * N));
      k.fill(0);
      for (const b of this.buildings) {
        if (b.destroyed) continue;
        const v = b.def.isWall ? 1 : 2;
        for (let yy = 0; yy < b.size; yy++) for (let xx = 0; xx < b.size; xx++) k[(b.y + yy) * N + b.x + xx] = v;
      }
      this._kindsV = this.mapVersion;
      return k;
    }

    field(b, jump) {
      const key = b.idx * 2 + (jump ? 1 : 0);
      const c = this.fieldCache.get(key);
      // Falling buildings only ever open up space, so a field a moment out of
      // date still leads somewhere sensible. Refresh at most twice a second.
      if (c && (c.v === this.mapVersion || this.time - c.at < 0.5)) return c.d;
      const d = c ? c.d : new Float32Array(N * N);
      d.fill(Infinity);
      const kinds = this.cellKinds();
      const h = this._heap || (this._heap = new Heap(4096));
      h.n = 0;
      const own = (i) => { const x = i % N, y = (i - x) / N; return x >= b.x && y >= b.y && x < b.x + b.size && y < b.y + b.size; };
      for (let yy = 0; yy < b.size; yy++)
        for (let xx = 0; xx < b.size; xx++) { const i = (b.y + yy) * N + b.x + xx; d[i] = 0; h.push(0, i); }
      const pen = jump ? 0 : WALL_PENALTY;
      while (h.size) {
        const i = h.pop(), dist = h.lastKey;
        if (dist > d[i]) continue;
        const x = i % N, y = (i - x) / N;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= N) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= N) continue;
            const j = ny * N + nx;
            let kj = kinds[j];
            if (kj === 2 && !own(j)) continue;
            if (kj === 1 && own(j)) kj = 0;
            if (dx && dy) { // no corner cutting past buildings or walls
              const ka = kinds[y * N + nx], kb = kinds[ny * N + x];
              if (ka === 2 || kb === 2 || (!jump && (ka === 1 || kb === 1))) continue;
            }
            const nd = dist + (dx && dy ? 1.414 : 1) + (kj === 1 ? pen : 0);
            if (nd < d[j]) { d[j] = nd; h.push(nd, j); }
          }
        }
      }
      this.fieldCache.set(key, { v: this.mapVersion, at: this.time, d });
      return d;
    }

    // ------------------------------------------------------------- targeting
    alive(b) { return b && !b.destroyed; }

    chooseTarget(u) {
      const kind = u.t.target;
      let pool = null;
      const live = this.buildings.filter((b) => !b.destroyed);
      if (kind === 'defense') pool = live.filter((b) => b.def.isDefense);
      else if (kind === 'resource') pool = live.filter((b) => b.def.isResource);
      else if (kind === 'wall') pool = live.filter((b) => b.def.isWall);
      if (!pool || !pool.length) pool = live.filter((b) => !b.def.isWall);
      let best = null, bd = Infinity;
      for (const b of pool) {
        const dd = U.distToRect(u.x, u.y, b.x, b.y, b.size, b.size);
        if (dd < bd) { bd = dd; best = b; }
      }
      // Ram crews only bother with walls that stand between them and buildings.
      if (kind === 'wall' && best && bd > 12) {
        const other = live.filter((b) => !b.def.isWall);
        if (other.length) return this.chooseTarget({ ...u, t: { target: 'any' } });
      }
      return best;
    }

    nearestEnemyUnit(u, maxR) {
      let best = null, bd = maxR;
      for (const o of this.troops) {
        if (o.dead || o.side === u.side) continue;
        if (o.air && !u.t.hitsAir) continue;
        const dd = U.dist(u.x, u.y, o.x, o.y);
        if (dd < bd) { bd = dd; best = o; }
      }
      return best;
    }

    // ---------------------------------------------------------------- damage
    damageBuilding(b, amount, src) {
      if (!b || b.destroyed) return;
      const before = b.hp;
      b.hp -= amount;
      b.flash = 0.15;
      b.lastHit = this.time;
      const dealt = Math.min(before, amount);
      if (b.lootGold || b.lootGoop) {
        const f = dealt / b.maxHp;
        const g = Math.min(b.lootGold, Math.round(b.lg0 * f));
        const p = Math.min(b.lootGoop, Math.round(b.lp0 * f));
        b.lootGold -= g; b.lootGoop -= p;
        this.stolen.gold += g; this.stolen.goop += p;
        if (g || p) this.fx.push({ k: 'loot', x: b.cx, y: b.cy, gold: g, goop: p, t: this.time });
      }
      if (b.hp <= 0) this.destroyBuilding(b);
    }

    destroyBuilding(b) {
      b.hp = 0; b.destroyed = true;
      // Whatever loot is left falls out with the building.
      this.stolen.gold += b.lootGold; this.stolen.goop += b.lootGoop;
      b.lootGold = 0; b.lootGoop = 0;
      if (b.counts) this.destroyedCount++;
      this.mapVersion++;
      this.fx.push({ k: 'destroy', x: b.cx, y: b.cy, size: b.size, wall: b.def.isWall, t: this.time, type: b.type });
      this.buildDeployMask();
    }

    damageUnit(u, amount) {
      if (u.dead) return;
      u.hp -= amount;
      u.hit = 0.12;
      if (u.hp <= 0) this.killUnit(u);
    }

    killUnit(u) {
      u.dead = true; u.hp = 0; u.deadAt = this.time;
      this.fx.push({ k: 'death', x: u.x, y: u.y, air: u.air, side: u.side, type: u.type, t: this.time });
      if (u.t.splitOnDeath) {
        for (let i = 0; i < u.t.splitOnDeath; i++) {
          const m = this.makeUnit('miniMummy', u.level, u.x + (i ? 0.3 : -0.3), u.y, u.side);
          this.troops.push(m);
        }
      }
      if (u.t.deathBlast) {
        const dmg = D.troopStat(u.type, u.level, 'deathBlast');
        this.splashBuildings(u.x, u.y, u.t.splash || 2, dmg, u);
        this.fx.push({ k: 'boom', x: u.x, y: u.y, r: 2, t: this.time });
      }
    }

    splashBuildings(x, y, r, dmg, src) {
      for (const b of this.buildings) {
        if (b.destroyed) continue;
        if (U.distToRect(x, y, b.x, b.y, b.size, b.size) <= r) this.damageBuilding(b, this.troopDamageVs(src, b, dmg), src);
      }
    }
    splashUnits(x, y, r, dmg, side, hitsGround, hitsAir) {
      for (const u of this.troops) {
        if (u.dead || u.side !== side) continue;
        if (u.air ? !hitsAir : !hitsGround) continue;
        if (U.dist(x, y, u.x, u.y) <= r) this.damageUnit(u, dmg);
      }
    }

    troopDamageVs(u, b, dmg) {
      if (!u || !u.t) return dmg;
      if (b.def.isWall && u.t.wallMult) dmg *= u.t.wallMult;
      if (b.def.isResource && u.t.resMult) dmg *= u.t.resMult;
      return dmg * (u.aura || 1);
    }

    // ------------------------------------------------------------------ tick
    step() {
      if (this.ended) return;
      this.tick++;
      this.time = this.tick * DT;
      for (const u of this.troops) { u.px = u.x; u.py = u.y; }
      this.updateAuras();
      this.updateGuards();
      for (const u of this.troops) if (!u.dead) this.updateUnit(u);
      for (const b of this.buildings) {
        if (b.flash > 0) b.flash -= DT;
        if (b.fired > 0) b.fired -= DT;
        if (!b.destroyed && b.def.isDefense && !b.inactive) this.updateDefense(b);
      }
      this.updateTraps();
      this.updateProjectiles();
      this.updateZones();
      if (this.tick % 50 === 0) this.troops = this.troops.filter((u) => !u.dead || this.time - (u.deadAt || 0) < 1);
      this.checkEnd();
    }

    updateAuras() {
      const champs = this.troops.filter((u) => !u.dead && u.t.aura);
      for (const u of this.troops) {
        u.aura = 1;
        if (u.dead) continue;
        for (const c of champs) if (c.side === u.side && U.dist(c.x, c.y, u.x, u.y) <= c.t.auraRange) { u.aura = 1 + c.t.aura; break; }
      }
    }

    updateGuards() {
      const h = this.royalHall;
      if (h && !h.destroyed && !this.guardsSpawned) {
        for (const u of this.troops) {
          if (u.dead || u.side !== 'att') continue;
          if (U.dist(u.x, u.y, h.cx, h.cy) < 8) { this.spawnGuards(); break; }
        }
      }
      if (this.guardQueue.length && this.tick % 3 === 0) {
        const type = this.guardQueue.shift();
        const g = this.makeUnit(type, this.guardLevel, h.cx + (this.rng() - 0.5), h.cy + 1.6, 'def');
        this.troops.push(g);
        this.fx.push({ k: 'deploy', x: g.x, y: g.y, t: this.time, guard: true });
      }
    }
    spawnGuards() {
      this.guardsSpawned = true;
      const h = this.royalHall;
      let space = D.B.royalHall.guards[h.level - 1];
      const mix = GUARD_MIX[Math.min(3, Math.floor((h.level - 1) / 3))];
      let i = 0;
      while (space > 0 && i < 200) {
        const t = mix[i % mix.length];
        const hs = D.T[t].housing;
        if (hs <= space) { this.guardQueue.push(t); space -= hs; } else if (hs > space && t === mix[0]) break;
        i++;
        if (i > mix.length * 40) break;
      }
      if (!this.guardQueue.length) this.guardQueue.push('spearman');
      this.fx.push({ k: 'guards', x: h.cx, y: h.cy, t: this.time });
    }

    updateUnit(u) {
      const t = u.t;
      if (u.slowUntil && this.time > u.slowUntil) { u.slow = 1; u.slowUntil = 0; }
      if (u.hit > 0) u.hit -= DT;
      u.cd -= DT;
      if (u.attacking > 0) u.attacking -= DT;

      // Guards hunt attackers. Attackers that fight anything get pulled into fights with guards.
      if (u.side === 'def') return this.updateGuard(u);

      if (t.target === 'heal') return this.updateHealer(u);

      if ((t.target === 'any' || t.target === 'resource') && this.tick % 5 === u.uid % 5) {
        const g = this.nearestEnemyUnit(u, u.air ? 3 : 3.5);
        if (g && !g.air || g && t.hitsAir) u.unitTarget = g;
      }
      if (u.unitTarget && (u.unitTarget.dead)) u.unitTarget = null;
      if (u.unitTarget) return this.fightUnit(u, u.unitTarget);

      if (u.wallTarget && u.wallTarget.destroyed) u.wallTarget = null;
      if (!this.alive(u.target)) { u.target = this.chooseTarget(u); u.wallTarget = null; }
      const b = u.wallTarget || u.target;
      if (!b) return;

      const range = t.range;
      const d = U.distToRect(u.x, u.y, b.x, b.y, b.size, b.size);
      if (d <= range + 0.05) return this.attackBuilding(u, b);

      const spd = t.speed * u.slow * DT;
      u.walk += DT * t.speed * 4;
      if (u.air) return this.moveStraight(u, b.cx, b.cy, spd);

      const jump = !!t.jumpsWalls;
      const f = this.field(u.target, jump);
      const cx = Math.floor(u.x), cy = Math.floor(u.y);
      const ci = cy * N + cx;
      if (!isFinite(f[ci])) return this.moveStraight(u, b.cx, b.cy, spd);
      // Pick the downhill neighbour.
      let best = ci, bv = f[ci];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        if (f[j] < bv - 1e-4) { bv = f[j]; best = j; }
      }
      if (best === ci) return this.moveStraight(u, b.cx, b.cy, spd);
      const occ = this.occ[best];
      if (occ >= 0 && !jump) {
        const wb = this.buildings[occ];
        if (!wb.destroyed && wb.def.isWall && wb !== u.target) { u.wallTarget = wb; return; }
      }
      const nx = best % N, ny = (best - nx) / N;
      this.moveStraight(u, nx + 0.5 + u.ox * 0.5, ny + 0.5 + u.oy * 0.5, spd, true);
    }

    moveStraight(u, tx, ty, spd) {
      const dx = tx - u.x, dy = ty - u.y;
      const l = Math.sqrt(dx * dx + dy * dy);
      if (l < 1e-6) return;
      const s = Math.min(spd, l);
      u.x += dx / l * s; u.y += dy / l * s;
      u.face = (dx - dy) >= 0 ? 1 : -1;
      u.walk += DT * 6;
    }

    attackBuilding(u, b) {
      const t = u.t;
      u.face = (b.cx - u.x - (b.cy - u.y)) >= 0 ? 1 : -1;
      if (u.cd > 0) return;
      u.cd = t.rate;
      u.attacking = 0.3;
      const dmg = u.dmg;
      if (t.suicide) {
        this.splashBuildings(u.x, u.y, t.splash, dmg, u);
        this.fx.push({ k: 'boom', x: u.x, y: u.y, r: t.splash, t: this.time });
        this.killUnit(u);
        return;
      }
      if (t.proj && t.range > 1.2) {
        const px = U.clamp(u.x, b.x, b.x + b.size), py = U.clamp(u.y, b.y, b.y + b.size);
        this.projectiles.push({ kind: t.proj, x0: u.x, y0: u.y, z0: u.air ? 50 : 12, tx: px, ty: py, b, dmg, splash: t.splash || 0, t: 0,
          dur: Math.max(0.15, U.dist(u.x, u.y, px, py) / 12), side: 'att', src: u, vsB: true });
        return;
      }
      if (t.splash) {
        const px = U.clamp(u.x, b.x, b.x + b.size), py = U.clamp(u.y, b.y, b.y + b.size);
        if (t.proj === 'bomb') {
          this.projectiles.push({ kind: 'bomb', x0: u.x, y0: u.y, z0: 50, tx: px, ty: py, b, dmg, splash: t.splash, t: 0, dur: 0.5, side: 'att', src: u, vsB: true });
          return;
        }
        this.splashBuildings(px, py, t.splash, dmg, u);
        this.fx.push({ k: 'cleave', x: px, y: py, r: t.splash, t: this.time });
        return;
      }
      this.damageBuilding(b, this.troopDamageVs(u, b, dmg), u);
      this.fx.push({ k: 'hit', x: U.clamp(u.x, b.x, b.x + b.size), y: U.clamp(u.y, b.y, b.y + b.size), t: this.time });
    }

    fightUnit(u, o) {
      const t = u.t;
      const d = U.dist(u.x, u.y, o.x, o.y);
      const range = Math.max(t.range, 0.5);
      if (d > range) { u.walk += DT * t.speed * 4; return this.moveStraight(u, o.x, o.y, t.speed * u.slow * DT); }
      u.face = (o.x - u.x - (o.y - u.y)) >= 0 ? 1 : -1;
      if (u.cd > 0) return;
      u.cd = t.rate; u.attacking = 0.3;
      const dmg = u.dmg * (u.aura || 1);
      if (t.proj && t.range > 1.2) {
        this.projectiles.push({ kind: t.proj, x0: u.x, y0: u.y, z0: u.air ? 50 : 12, tx: o.x, ty: o.y, unit: o, dmg, splash: t.splash || 0, t: 0,
          dur: Math.max(0.15, d / 12), side: u.side, hitsAir: !!t.hitsAir, hitsGround: true });
        return;
      }
      if (t.splash) this.splashUnits(o.x, o.y, t.splash, dmg, o.side, true, !!t.hitsAir);
      else this.damageUnit(o, dmg);
      this.fx.push({ k: 'hit', x: o.x, y: o.y, t: this.time });
    }

    updateGuard(u) {
      if (!u.unitTarget || u.unitTarget.dead || this.tick % 10 === u.uid % 10) u.unitTarget = this.nearestEnemyUnit(u, 14);
      if (u.unitTarget) return this.fightUnit(u, u.unitTarget);
      const h = this.royalHall;
      if (h) this.moveStraight(u, h.cx + u.ox * 4, h.cy + 2 + u.oy * 4, u.t.speed * DT);
    }

    updateHealer(u) {
      // Follow the most hurt ground troop, otherwise the crowd.
      let best = null, bs = Infinity;
      for (const o of this.troops) {
        if (o.dead || o.side !== u.side || o.air || o === u) continue;
        const dd = U.dist(u.x, u.y, o.x, o.y);
        const score = dd + (o.hp / o.maxHp) * 6;
        if (score < bs) { bs = score; best = o; }
      }
      if (!best) return;
      const d = U.dist(u.x, u.y, best.x, best.y);
      if (d > 1.5) this.moveStraight(u, best.x, best.y, u.t.speed * DT);
      if (u.cd <= 0 && d < u.t.range) {
        u.cd = u.t.rate; u.attacking = 0.4;
        let any = false;
        for (const o of this.troops) {
          if (o.dead || o.side !== u.side || o.air) continue;
          if (U.dist(best.x, best.y, o.x, o.y) <= u.t.splash && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + u.heal); any = true; }
        }
        if (any) this.fx.push({ k: 'heal', x: best.x, y: best.y, r: u.t.splash, t: this.time });
      }
    }

    // --------------------------------------------------------------- defense
    validTarget(b, u) {
      if (u.dead || u.side !== 'att') return false;
      if (u.air ? !b.def.air : !b.def.ground) return false;
      const d = U.dist(b.cx, b.cy, u.x, u.y);
      return d <= b.def.range + b.size / 2 && (!b.def.minRange || d >= b.def.minRange);
    }

    updateDefense(b) {
      const def = b.def;
      b.cd -= DT;
      if (b.target && !this.validTarget(b, b.target)) { b.target = null; b.ramp = 0; }
      if (!b.target) {
        let best = null, bd = Infinity;
        for (const u of this.troops) {
          if (!this.validTarget(b, u)) continue;
          const d = U.dist(b.cx, b.cy, u.x, u.y);
          if (d < bd) { bd = d; best = u; }
        }
        b.target = best;
        b.ramp = 0;
      }
      if (!b.target || b.cd > 0) return;
      b.cd = def.rate;
      const u = b.target;
      b.aim = Math.atan2(u.y - b.cy, u.x - b.cx);
      b.fired = 0.25;
      const dmg = b.dmg;
      switch (def.proj) {
        case 'ray': { // Sphinx: damage ramps up on the same target
          b.ramp = Math.min(b.ramp + 1, 30);
          this.damageUnit(u, dmg * (1 + b.ramp * 0.3));
          this.fx.push({ k: 'ray', b: b.idx, x: u.x, y: u.y, air: u.air, heat: b.ramp / 30, t: this.time });
          break;
        }
        case 'beam':
          this.damageUnit(u, dmg);
          this.fx.push({ k: 'beam', b: b.idx, x: u.x, y: u.y, air: u.air, t: this.time });
          break;
        case 'slam':
          this.splashUnits(u.x, u.y, def.splash, dmg, 'att', true, false);
          this.fx.push({ k: 'slam', b: b.idx, x: u.x, y: u.y, r: def.splash, t: this.time });
          break;
        case 'flame':
          this.splashUnits(u.x, u.y, def.splash, dmg, 'att', true, true);
          this.fx.push({ k: 'flame', b: b.idx, x: u.x, y: u.y, air: u.air, t: this.time });
          break;
        case 'sun': {
          const picks = this.troops.filter((o) => this.validTarget(b, o));
          for (let i = 0; i < (def.shots || 1); i++) {
            const o = picks.length ? picks[Math.floor(this.rng() * picks.length)] : u;
            this.projectiles.push({ kind: 'sun', x0: o.x, y0: o.y, z0: 400, tx: o.x, ty: o.y, dmg, splash: def.splash, t: -i * 0.35, dur: 1.0,
              side: 'def', hitsAir: true, hitsGround: true, b: null, from: b.idx });
          }
          break;
        }
        default: {
          const d = U.dist(b.cx, b.cy, u.x, u.y);
          const speed = def.proj === 'stone' ? 6 : def.proj === 'falcon' ? 14 : def.proj === 'orb' ? 10 : 18;
          const homing = !def.splash;
          this.projectiles.push({ kind: def.proj, x0: b.cx, y0: b.cy, z0: 40 + b.size * 8, tx: u.x, ty: u.y, unit: homing ? u : null,
            dmg, splash: def.splash || 0, t: 0, dur: Math.max(0.15, d / speed), side: 'def', hitsAir: def.air, hitsGround: def.ground, from: b.idx });
        }
      }
    }

    updateTraps() {
      for (const tr of this.traps) {
        if (tr.triggered) continue;
        if (tr.fuse >= 0) {
          tr.fuse -= DT;
          if (tr.fuse < 0) this.fireTrap(tr);
          continue;
        }
        for (const u of this.troops) {
          if (u.dead || u.side !== 'att') continue;
          if (u.air ? !tr.def.air : !tr.def.ground) continue;
          if (U.dist(tr.cx, tr.cy, u.x, u.y) <= tr.def.trigger) { tr.fuse = 0.3; tr.victim = u; break; }
        }
      }
    }
    fireTrap(tr) {
      tr.triggered = true;
      const dmg = D.defenseDmg(tr.type, tr.level);
      const def = tr.def;
      this.fx.push({ k: 'trap', type: tr.type, x: tr.cx, y: tr.cy, r: def.splash || 1, t: this.time });
      if (tr.type === 'quicksand') {
        this.zones.push({ x: tr.cx, y: tr.cy, r: def.splash, until: this.time + def.duration, dps: dmg, slow: def.slow });
      } else if (def.splash) {
        this.splashUnits(tr.cx, tr.cy, def.splash, dmg, 'att', def.ground, def.air);
      } else {
        // single target: the troop that set it off, if still close
        const v = tr.victim && !tr.victim.dead ? tr.victim : this.troops.find((u) => !u.dead && u.side === 'att' && (u.air ? def.air : def.ground) && U.dist(u.x, u.y, tr.cx, tr.cy) < def.trigger + 1);
        if (v) this.damageUnit(v, dmg);
      }
    }
    updateZones() {
      for (const z of this.zones) {
        if (this.time > z.until) continue;
        for (const u of this.troops) {
          if (u.dead || u.side !== 'att' || u.air) continue;
          if (U.dist(z.x, z.y, u.x, u.y) <= z.r) { u.slow = z.slow; u.slowUntil = this.time + 0.3; this.damageUnit(u, z.dps * DT); }
        }
      }
      this.zones = this.zones.filter((z) => this.time <= z.until);
    }

    updateProjectiles() {
      const keep = [];
      for (const p of this.projectiles) {
        p.t += DT;
        if (p.unit && !p.unit.dead) { p.tx = p.unit.x; p.ty = p.unit.y; }
        if (p.t < p.dur) { keep.push(p); continue; }
        // impact
        if (p.vsB) {
          if (p.splash) this.splashBuildings(p.tx, p.ty, p.splash, p.dmg, p.src);
          else if (p.b && !p.b.destroyed) this.damageBuilding(p.b, this.troopDamageVs(p.src, p.b, p.dmg), p.src);
          this.fx.push({ k: p.splash ? 'boom' : 'hit', x: p.tx, y: p.ty, r: p.splash || 0.5, t: this.time, kind: p.kind });
          continue;
        }
        const enemySide = p.side === 'def' ? 'att' : 'def';
        if (p.splash) {
          this.splashUnits(p.tx, p.ty, p.splash, p.dmg, enemySide, p.hitsGround, p.hitsAir);
          this.fx.push({ k: 'boom', x: p.tx, y: p.ty, r: p.splash, t: this.time, kind: p.kind });
        } else if (p.unit && !p.unit.dead) {
          this.damageUnit(p.unit, p.dmg);
          this.fx.push({ k: 'hit', x: p.tx, y: p.ty, t: this.time, kind: p.kind, air: p.unit.air });
        }
      }
      this.projectiles = keep;
    }

    // ------------------------------------------------------------------ end
    get destruction() { return this.totalCount ? Math.floor(100 * this.destroyedCount / this.totalCount) : 0; }
    get stars() {
      let s = 0;
      if (this.destruction >= 50) s++;
      if (this.pyramid && this.pyramid.destroyed) s++;
      if (this.destruction >= 100) s++;
      return s;
    }
    attackersAlive() { return this.troops.some((u) => !u.dead && u.side === 'att'); }
    checkEnd() {
      if (this.time >= BATTLE_TIME) return this.finish('time');
      if (this.destruction >= 100) return this.finish('wiped');
      if (this.deployedAny && this.reserve <= 0 && !this.attackersAlive()) return this.finish('troops');
    }
    finish(reason) {
      if (this.ended) return;
      this.ended = true;
      this.endReason = reason;
      this.fx.push({ k: 'end', t: this.time });
    }
    result() {
      return { stars: this.stars, destruction: this.destruction, stolen: { ...this.stolen }, time: this.time, pyramid: !!(this.pyramid && this.pyramid.destroyed) };
    }
  }

  // --------------------------------------------------------------- AI raids
  // Plan an army for an attacker at Pyramid level `ph`.
  // strength (0-1) shrinks the army and its levels: rivals raiding you are not maxed out.
  function planArmy(ph, rng, strength = 1) {
    const camps = D.countAllowed('armyCamp', ph);
    // Rival armies are a bit smaller and weaker than a maxed one, and vary a lot.
    const full = camps * D.B.armyCamp.housing[Math.max(0, D.maxLevel('armyCamp', ph) - 1)];
    const housing = Math.round(full * (0.65 + rng() * 0.35) * strength);
    const unlocked = D.TROOP_ORDER.filter((t) => D.T[t].barracks <= D.maxLevel('barracks', ph));
    const top = D.troopMaxLevel(D.maxLevel('temple', ph));
    const lvl = () => Math.max(1, top - rng.int(0, 2) - (strength < 0.9 ? 1 : 0));
    const army = {};
    let space = housing;
    const add = (t, n) => {
      if (!unlocked.includes(t)) return;
      const h = D.T[t].housing;
      while (n-- > 0 && space >= h) { army[t] = (army[t] || 0) + 1; space -= h; }
    };
    const tanks = ['warElephant', 'sobekBrute', 'shieldBearer'].filter((t) => unlocked.includes(t));
    const hitters = ['anubisWarrior', 'champion', 'mummy', 'chariot', 'sandMage', 'camelArcher', 'archer', 'spearman', 'tombRobber']
      .filter((t) => unlocked.includes(t));
    const style = rng.int(0, 2);
    if (style === 2 && unlocked.includes('phoenix')) {
      add('phoenix', Math.floor(housing * 0.7 / 20)); add('skyBarge', 3); add('falcon', 6);
    } else if (style === 1 && unlocked.includes('chariot')) {
      add('chariot', Math.floor(housing * 0.5 / 5)); add('priestess', 2);
    }
    if (tanks.length) add(tanks[0], Math.max(1, Math.floor(housing * 0.2 / D.T[tanks[0]].housing)));
    add('ramCrew', 2 + Math.floor(ph / 3));
    add('priestess', ph >= 6 ? 1 : 0);
    add('champion', 1);
    let guard = 0;
    while (space > 0 && guard++ < 400) {
      const t = rng.pick(hitters.slice(0, Math.max(3, Math.min(hitters.length, 3 + ph))));
      if (D.T[t].housing > space) { if (space >= 1) add(unlocked.includes('archer') ? 'archer' : 'spearman', space); break; }
      add(t, 1);
    }
    const levels = {};
    for (const t of Object.keys(army)) levels[t] = lvl(t);
    return { army, levels };
  }

  // Turn an army into a timed deploy list along one side of the map.
  function planDeploy(battle, army, rng) {
    const side = rng.int(0, 3);
    const spots = [];
    for (let i = 0; i < N; i++) {
      // walk inward from the chosen edge until the first blocked tile
      let last = null;
      for (let k = 0; k < N / 2; k++) {
        const [x, y] = side === 0 ? [i, k] : side === 1 ? [N - 1 - k, i] : side === 2 ? [i, N - 1 - k] : [k, i];
        if (!battle.canDeploy(x + 0.5, y + 0.5)) break;
        last = [x + 0.5, y + 0.5];
      }
      if (last) spots.push(last);
    }
    if (!spots.length) spots.push([1, 1]);
    // focus on the middle third of the side
    const mid = spots.slice(Math.floor(spots.length / 3), Math.ceil(spots.length * 2 / 3)) || spots;
    const pool = mid.length ? mid : spots;
    const order = ['warElephant', 'sobekBrute', 'shieldBearer', 'ramCrew', 'chariot', 'phoenix', 'skyBarge', 'anubisWarrior', 'mummy',
      'champion', 'sandMage', 'camelArcher', 'archer', 'spearman', 'tombRobber', 'falcon', 'priestess'];
    const list = [];
    let tick = 5;
    for (const t of order) {
      const n = army[t] || 0;
      for (let i = 0; i < n; i++) {
        const [x, y] = rng.pick(pool);
        list.push({ tick, type: t, x: x + (rng() - 0.5) * 0.8, y: y + (rng() - 0.5) * 0.8 });
        tick += t === 'ramCrew' ? 1 : 2;
      }
      if (n) tick += t === 'shieldBearer' || t === 'warElephant' || t === 'sobekBrute' ? 25 : 6;
    }
    return list;
  }

  // Runs a full battle without drawing anything.
  function simulate(opts, deployList) {
    const b = new Battle(opts);
    let i = 0;
    b.reserve = deployList.length;
    const levels = opts.troopLevels || {};
    while (!b.ended) {
      while (i < deployList.length && deployList[i].tick <= b.tick) {
        const d = deployList[i++];
        b.reserve--;
        b.deploy(d.type, levels[d.type] || 1, d.x, d.y);
      }
      b.step();
      b.fx.length = 0;
      if (b.tick > 4000) break;
    }
    return b;
  }

  G.Battle = Battle;
  G.BattleSim = { DT, BATTLE_TIME, planArmy, planDeploy, simulate };
})(globalThis.SOTP = globalThis.SOTP || {});
