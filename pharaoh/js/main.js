// The controller: game loop, input, camera, placing buildings, matchmaking,
// battles and replays.
(function (G) {
  'use strict';
  const { D, U, Game, Renderer, UI, Sound, Net, BaseGen, BattleSim, Battle } = G;
  const N = D.MAP;
  const $ = (id) => document.getElementById(id);

  const App = {
    mode: 'village',
    renderer: null,
    selected: null,
    placing: null,
    bt: null,
    shake: 0,
    lastTick: 0,
    dirtyLayout: true,
    lastPublish: 0,
    lastCloud: 0,
    campCache: { key: '', map: new Map() },

    // ------------------------------------------------------------------ boot
    async boot() {
      const cv = $('view');
      this.renderer = new Renderer(cv);
      this.renderer.onShake = (n) => { this.shake = Math.min(12, this.shake + n); };
      addEventListener('resize', () => this.renderer.resize());
      this.bindInput(cv);
      this.bindButtons();
      Game.on((ev, data) => this.onGameEvent(ev, data));

      const local = Game.loadLocal();
      if (local) this.start(Game.adopt(local));
      requestAnimationFrame((t) => this.frame(t));

      // Friend codes go online when running as a shared artifact.
      const online = await Net.init();
      if (online) {
        const cloud = await Net.loadCloudSave();
        const cur = Game.get();
        if (cloud && (!cur || (cloud.last || 0) > (cur.last || 0) + 5000)) {
          this.start(Game.adopt(cloud));
          UI.toast('Loaded your town from the cloud.', 'good');
        }
        this.dirtyLayout = true;
      }
      if (!Game.get()) UI.welcome((name) => { this.start(Game.newGame(name)); this.dirtyLayout = true; Game.save(); });
    },

    start(st) {
      Sound.on = st.sound !== false;
      Game.tick();
      this.renderer.fit();
      this.mode = 'village';
      UI.hud();
      const fresh = st.log.filter((e) => !e.seen && e.at > (st.lastSeenLog || 0));
      if (fresh.length) {
        const won = fresh.filter((e) => e.stars > 0).length;
        UI.toast(`${fresh.length} rival${fresh.length > 1 ? 's' : ''} attacked while you were away. ${won ? `${won} got in.` : 'Your defenses held!'}`, won ? 'bad' : 'good');
        st.lastSeenLog = Date.now();
      }
    },

    bindButtons() {
      const on = (id, f) => $(id).addEventListener('click', () => { Sound.unlock(); f(); });
      on('btn-attack', () => this.findMatch());
      on('btn-shop', () => UI.shop());
      on('btn-army', () => UI.army());
      on('btn-temple', () => UI.temple());
      on('btn-friends', () => UI.friends());
      on('btn-log', () => UI.log());
      on('btn-ach', () => UI.achievements());
      on('btn-settings', () => UI.settings());
      on('btn-profile', () => UI.settings());
      on('place-ok', () => this.confirmPlace());
      on('place-no', () => this.cancelPlace());
      on('b-end', () => this.endButton());
      on('b-next', () => this.nextMatch());
      on('b-speed', () => { if (this.bt) { this.bt.speed = this.bt.speed === 4 ? 1 : this.bt.speed * 2; UI.battleHud(this); } });
      addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { if (UI.modalOpen()) UI.closeModal(); else if (this.placing) this.cancelPlace(); else this.select(null); }
      });
      addEventListener('pagehide', () => Game.get() && Game.save());
      document.addEventListener('visibilitychange', () => { if (document.hidden && Game.get()) Game.save(); });
    },

    onGameEvent(ev, data) {
      if (ev === 'upgraded') {
        const def = D.B[data.type];
        if (this.mode === 'village') {
          const s = def.size;
          this.renderer.burst(data.x + s / 2, data.y + s / 2, 30, 30, '#ffe27a', 80, 1.2);
          this.renderer.ring(data.x + s / 2, data.y + s / 2, s, '#fff3a6');
          Sound.play('done');
          UI.toast(`${def.name} ${data.level === 1 ? 'built' : 'reached level ' + data.level}!`, 'good');
        }
        this.dirtyLayout = true;
        if (this.selected === data) UI.selection(data);
      } else if (ev === 'obstacleCleared') {
        const o = data.o;
        if (data.gems) { this.renderer.floatText(o.x + o.size / 2, o.y + o.size / 2, '+' + data.gems, 'gems'); Sound.play('coin'); }
        if (this.selected && this.selected.obstacle === o) this.select(null);
      } else if (ev === 'researched') {
        UI.toast(`${D.T[data.type].name} reached level ${data.to}!`, 'good'); Sound.play('done');
      } else if (ev === 'raided') {
        if (this.mode === 'village' && Date.now() - data.at < 5 * 60 * 1000) {
          UI.toast(data.stars ? `${data.name} raided your town and got ${data.stars} star${data.stars > 1 ? 's' : ''}!` : `${data.name} attacked, but your defenses held!`, data.stars ? 'bad' : 'good');
          Sound.play('horn');
        }
      }
    },

    // ------------------------------------------------------------- the loop
    frame(now) {
      const t = now / 1000;
      const dt = Math.min(0.1, t - (this.lastT || t));
      this.lastT = t;
      const S = Game.get();
      if (S && this.mode === 'village' && t - this.lastTick > 0.5) {
        this.lastTick = t;
        Game.tick();
        UI.hud();
        if (this.selected && !UI.modalOpen()) UI.selection(this.selected);
        UI.liveTick();
        this.syncOnline(t);
      }
      if (this.bt) this.stepBattle(dt);
      this.draw(t, dt);
      requestAnimationFrame((x) => this.frame(x));
    },

    syncOnline(t) {
      const S = Game.get();
      if (this.dirtyLayout && t - this.lastPublish > 4) {
        this.dirtyLayout = false; this.lastPublish = t;
        Net.publish(S);
      }
      if (t - this.lastCloud > 60) { this.lastCloud = t; Game.save(); Net.saveCloud(S); }
    },
    layoutChanged() { this.dirtyLayout = true; },

    draw(t, dt) {
      const r = this.renderer;
      const S = Game.get();
      const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0, shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      this.shake = Math.max(0, this.shake - dt * 30);
      r.cam.x += shakeX; r.cam.y += shakeY;
      if (this.bt) {
        const b = this.bt.battle;
        const walls = new Set(b.buildings.filter((x) => x.def.isWall && !x.destroyed).map((x) => x.x + ',' + x.y));
        r.draw({
          t, dt, mode: 'battle', buildings: b.buildings, troops: b.troops, projectiles: b.projectiles, time: b.time,
          alpha: this.bt.acc / BattleSim.DT,
          wallConn: (w) => (walls.has((w.x + 1) + ',' + w.y) ? 1 : 0) | (walls.has(w.x + ',' + (w.y + 1)) ? 2 : 0),
          deployMask: b.deployMask, showMask: this.bt.showMask > t,
        });
      } else if (S) {
        r.draw(this.villageScene(S, t, dt));
      } else {
        r.draw({ t, dt, mode: 'village', buildings: [], obstacles: [] });
      }
      r.cam.x -= shakeX; r.cam.y -= shakeY;
    },

    villageScene(S, t, dt) {
      const now = Date.now();
      const capG = Game.capacity('gold'), capP = Game.capacity('goop');
      const walls = new Set(S.buildings.filter((b) => b.type === 'wall').map((b) => b.x + ',' + b.y));
      const blds = S.buildings.map((b) => {
        const def = D.B[b.type];
        const o = Object.create(b);
        if (def.stores === 'gold') o.fill = capG ? S.res.gold / capG : 0;
        else if (def.stores === 'goop') o.fill = capP ? S.res.goop / capP : 0;
        else if (def.produces) o.fill = (b.stored || 0) / Math.max(1, D.mineCap(b.type, Math.max(1, b.level)));
        if (b.upgrading) {
          o.upgradeLeft = (b.upgrading.end - now) / 1000;
          o.upgradeProgress = 1 - o.upgradeLeft / Math.max(1, (b.upgrading.end - b.upgrading.start) / 1000);
        }
        if (this.placing && this.placing.b === b) o.hidden = true;
        return o;
      });
      const obs = S.obstacles.map((o) => {
        const x = Object.create(o);
        if (o.clearing) x.progress = 1 - (o.clearing.end - now) / (o.clearing.end - o.clearing.start);
        return x;
      });
      return {
        t, dt, mode: 'village', buildings: blds, obstacles: obs,
        wallConn: (w) => (walls.has((w.x + 1) + ',' + w.y) ? 1 : 0) | (walls.has(w.x + ',' + (w.y + 1)) ? 2 : 0),
        selected: this.selected && !this.selected.obstacle && !this.placing ? this.selected : null,
        ghost: this.placing, grid: !!this.placing,
        campTroops: this.campTroops(S),
        training: S.queue.length > 0, researching: !!S.research,
      };
    },

    // Show trained troops milling around the army camps.
    campTroops(S) {
      const camps = Game.byType('armyCamp').filter((b) => b.level > 0);
      const key = JSON.stringify(S.army) + camps.map((c) => c.x + ',' + c.y).join(';');
      if (key === this.campCache.key) return this.campCache.map;
      const map = new Map();
      const list = [];
      for (const t of D.TROOP_ORDER) for (let i = 0; i < Math.min(S.army[t] || 0, 12); i++) list.push(t);
      camps.forEach((c) => map.set(c, []));
      list.forEach((type, i) => {
        if (!camps.length) return;
        const c = camps[i % camps.length];
        const arr = map.get(c);
        if (arr.length >= 14) return;
        const k = arr.length, a = (k / 14) * Math.PI * 2 + 0.3, r = 1.15 + (k % 2) * 0.35;
        arr.push({ type, t: D.T[type], level: S.troopLevels[type], x: c.x + 2 + Math.cos(a) * r, y: c.y + 2 + Math.sin(a) * r, face: Math.cos(a) > 0 ? -1 : 1, uid: k + i * 7, air: D.T[type].air, hp: 1, maxHp: 1 });
      });
      for (const arr of map.values()) arr.sort((a, b) => a.x + a.y - b.x - b.y);
      this.campCache = { key, map };
      return map;
    },

    // ---------------------------------------------------------------- input
    bindInput(cv) {
      const ptrs = new Map();
      let drag = null, pinch = null, hold = null;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', (e) => {
        Sound.unlock();
        cv.setPointerCapture(e.pointerId);
        const p = pos(e);
        ptrs.set(e.pointerId, p);
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          pinch = { d: U.dist(a[0], a[1], b[0], b[1]), z: this.renderer.cam.z };
          drag = null; this.stopHold(hold); hold = null;
          return;
        }
        const tile = this.renderer.toTile(...p);
        drag = { x: p[0], y: p[1], cx: this.renderer.cam.x, cy: this.renderer.cam.y, moved: false, t0: performance.now(), tile };
        // dragging the building being placed moves it instead of the camera
        if (this.placing) {
          const g = this.placing, s = D.B[g.type].size;
          if (tile[0] >= g.x - 0.5 && tile[0] <= g.x + s + 0.5 && tile[1] >= g.y - 0.5 && tile[1] <= g.y + s + 0.5) drag.ghost = { ox: tile[0] - g.x, oy: tile[1] - g.y };
        }
        if (this.bt && this.bt.pick && !this.bt.replay && this.bt.phase !== 'over') hold = this.startHold(p);
      });
      cv.addEventListener('pointermove', (e) => {
        if (!ptrs.has(e.pointerId)) return;
        const p = pos(e);
        ptrs.set(e.pointerId, p);
        if (pinch && ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          const d = U.dist(a[0], a[1], b[0], b[1]);
          this.zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch.z * d / pinch.d, true);
          return;
        }
        if (!drag) return;
        const dx = p[0] - drag.x, dy = p[1] - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 7) { drag.moved = true; cv.classList.add('dragging'); }
        if (hold) hold.pos = p;
        if (!drag.moved) return;
        if (drag.ghost && this.placing) {
          const tile = this.renderer.toTile(...p);
          this.movePlacing(Math.round(tile[0] - drag.ghost.ox), Math.round(tile[1] - drag.ghost.oy));
          return;
        }
        if (hold && hold.active) return; // spraying troops, keep camera still
        if (hold) { this.stopHold(hold); hold = null; }
        const z = this.renderer.cam.z;
        this.renderer.cam.x = drag.cx - dx / z;
        this.renderer.cam.y = drag.cy - dy / z;
        this.renderer.clampCam();
      });
      const up = (e) => {
        if (!ptrs.has(e.pointerId)) return;
        const p = ptrs.get(e.pointerId);
        ptrs.delete(e.pointerId);
        cv.classList.remove('dragging');
        if (ptrs.size < 2) pinch = null;
        if (hold) { const deployed = hold.count; this.stopHold(hold); hold = null; if (deployed) { drag = null; return; } }
        if (drag && !drag.moved && e.type === 'pointerup') this.tap(...p);
        drag = null;
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const p = pos(e);
        this.zoomAt(p[0], p[1], this.renderer.cam.z * Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });
    },

    zoomAt(sx, sy, z) {
      const r = this.renderer;
      const before = r.toTile(sx, sy);
      r.cam.z = z;
      r.clampCam();
      const after = r.toTile(sx, sy);
      r.cam.x += U.isoX(before[0], before[1]) - U.isoX(after[0], after[1]);
      r.cam.y += U.isoY(before[0], before[1]) - U.isoY(after[0], after[1]);
      r.clampCam();
    },

    // Hold a finger down in battle to keep sending troops.
    startHold(p) {
      const h = { pos: p, count: 0, active: false };
      h.timer = setTimeout(() => {
        h.active = true;
        h.iv = setInterval(() => { if (this.deployAt(...h.pos, true)) h.count++; else { this.stopHold(h); } }, 110);
      }, 260);
      return h;
    },
    stopHold(h) { if (!h) return; clearTimeout(h.timer); clearInterval(h.iv); },

    tap(sx, sy) {
      const [tx, ty] = this.renderer.toTile(sx, sy);
      if (this.bt) { if (!this.bt.replay) this.deployAt(sx, sy); return; }
      const S = Game.get();
      if (!S) return;
      if (this.placing) {
        const s = D.B[this.placing.type].size;
        this.movePlacing(Math.round(tx - s / 2), Math.round(ty - s / 2));
        return;
      }
      const hit = this.hitTest(tx, ty);
      if (!hit) { this.select(null); return; }
      if (!hit.obstacle && D.B[hit.type].produces && (hit.stored || 0) >= 1 && this.selected !== hit) {
        this.collect(hit);
      }
      Sound.play('tap');
      this.select(hit);
    },

    hitTest(tx, ty) {
      const S = Game.get();
      // prefer the front-most building whose footprint contains the tile
      let best = null, bk = -Infinity;
      for (const b of S.buildings) {
        const s = D.B[b.type].size;
        if (tx >= b.x && tx < b.x + s && ty >= b.y && ty < b.y + s && b.x + b.y > bk) { best = b; bk = b.x + b.y; }
      }
      if (best) return best;
      // tall buildings: tapping just above the footprint still selects them
      for (const b of S.buildings) {
        const s = D.B[b.type].size;
        if (s >= 3 && tx >= b.x - 1.2 && tx < b.x + s && ty >= b.y - 1.2 && ty < b.y + s) return b;
      }
      for (const o of S.obstacles) if (tx >= o.x && tx < o.x + o.size && ty >= o.y && ty < o.y + o.size) return { obstacle: o };
      return null;
    },

    select(b) {
      this.selected = b;
      UI.selection(b);
      $('goal').hidden = !!b || this.mode !== 'village';
    },
    focus(b) {
      const s = D.B[b.type].size;
      this.renderer.cam.x = U.isoX(b.x + s / 2, b.y + s / 2);
      this.renderer.cam.y = U.isoY(b.x + s / 2, b.y + s / 2);
      this.renderer.clampCam();
      this.select(b);
    },

    // ------------------------------------------------------- village actions
    collect(b) {
      const res = D.B[b.type].produces;
      const before = b.stored || 0;
      const got = Game.collect(b);
      if (got > 0) {
        const s = D.B[b.type].size;
        this.renderer.floatText(b.x + s / 2, b.y + s / 2, '+' + U.fmt(got), res);
        this.renderer.burst(b.x + s / 2, b.y + s / 2, 50, 10, res === 'gold' ? '#ffe27a' : '#a6f58a', 50, 0.8);
        Sound.play(res === 'gold' ? 'coin' : 'goop');
      } else if (before >= 1) UI.toast(`Your ${res === 'gold' ? 'Treasuries are' : 'Goop Jars are'} full. Build or upgrade storage.`, 'bad');
      UI.hud();
    },
    upgrade(b) {
      const r = Game.upgrade(b);
      if (!r.ok) { UI.toast(r.why, 'bad'); return; }
      Sound.play('build');
      this.dirtyLayout = true;
      UI.hud(); UI.selection(b);
    },
    finishNow(b) {
      const r = Game.finishNow(b);
      if (!r.ok) UI.toast(r.why || 'Not enough gems.', 'bad');
      UI.hud();
    },
    clearObstacle(o) {
      const r = Game.clearObstacle(o);
      if (!r.ok) { UI.toast(r.why, 'bad'); return; }
      Sound.play('build'); UI.hud(); UI.selection({ obstacle: o });
    },

    startPlace(type) {
      const s = D.B[type].size;
      const r = this.renderer;
      const [cx, cy] = r.toTile(r.W / 2, r.H / 2);
      const spot = Game.findSpot(s, cx, cy) || [Math.round(cx - s / 2), Math.round(cy - s / 2)];
      this.placing = { type, x: spot[0], y: spot[1], level: 1, ok: true, isNew: true };
      this.movePlacing(spot[0], spot[1]);
      this.select(null);
      $('placebar').hidden = false;
      $('place-hint').textContent = D.B[type].isWall ? 'Place walls one after another. Tap ✕ when done.' : 'Drag the building or tap the sand, then confirm.';
      $('dock').hidden = true;
    },
    startMove(b) {
      this.placing = { type: b.type, x: b.x, y: b.y, level: Math.max(1, b.level), ok: true, b };
      this.select(null);
      $('placebar').hidden = false;
      $('place-hint').textContent = 'Drag to move, then confirm.';
      $('dock').hidden = true;
    },
    movePlacing(x, y) {
      const g = this.placing, s = D.B[g.type].size;
      g.x = U.clamp(x, D.EDGE, N - D.EDGE - s); g.y = U.clamp(y, D.EDGE, N - D.EDGE - s);
      g.ok = !Game.occupied(g.x, g.y, s, s, g.b);
      $('place-ok').disabled = !g.ok;
    },
    confirmPlace() {
      const g = this.placing;
      if (!g || !g.ok) return;
      if (g.b) {
        Game.move(g.b, g.x, g.y);
        const b = g.b;
        this.cancelPlace();
        this.dirtyLayout = true;
        this.select(b);
        return;
      }
      const r = Game.place(g.type, g.x, g.y);
      if (!r.ok) { UI.toast(r.why, 'bad'); if (r.builders || r.short) this.cancelPlace(); return; }
      Sound.play('build');
      this.renderer.burst(g.x + D.B[g.type].size / 2, g.y + D.B[g.type].size / 2, 4, 14, '#d8c090', 40, 0.7);
      this.dirtyLayout = true;
      UI.hud();
      if (D.B[g.type].isWall && Game.countOf('wall') < D.countAllowed('wall', Game.ph())) {
        // keep laying walls in a line
        const dir = g.lastDir || [1, 0];
        const nx = g.x + dir[0], ny = g.y + dir[1];
        this.movePlacing(nx, ny);
        if (!g.ok) { g.lastDir = [dir[1], dir[0]]; this.movePlacing(g.x - dir[0] + dir[1], g.y - dir[1] + dir[0]); }
        return;
      }
      this.cancelPlace();
      this.select(r.b);
    },
    cancelPlace() {
      this.placing = null;
      $('placebar').hidden = true;
      $('dock').hidden = false;
    },

    // ---------------------------------------------------------------- battle
    armyCount() { const S = Game.get(); return Object.values(S.army).reduce((a, b) => a + b, 0); },

    findMatch(free) {
      const S = Game.get();
      if (!S) return;
      if (!this.armyCount()) {
        UI.toast(Game.barracksLevel() ? 'Train some troops first (Army menu).' : 'Build a Barracks and an Army Camp, then train troops.', 'bad');
        return;
      }
      const ph = Game.ph();
      if (!free) {
        const cost = D.NEXT_COST[ph - 1];
        if (S.res.gold < cost) { UI.toast(`Finding a match costs ${cost} gold.`, 'bad'); return; }
        S.res.gold -= cost;
      }
      const seed = (Math.random() * 2 ** 31) >>> 0;
      const rival = BaseGen.makeRival(ph, S.trophies, seed);
      const loot = D.lootFor(ph, rival.ph, false);
      this.beginBattle({
        layout: rival.layout, seed, title: rival.name, sub: `${rival.clan ? rival.clan + ' · ' : ''}Pyramid ${rival.ph} · ${D.leagueOf(rival.trophies)}`,
        info: { loot, friendly: false, ph: rival.ph }, guardLevel: Math.max(1, rival.ph - 1), canNext: true,
      });
    },
    nextMatch() {
      const S = Game.get(), cost = D.NEXT_COST[Game.ph() - 1];
      if (S.res.gold < cost) { UI.toast(`You need ${cost} gold to look for another town.`, 'bad'); return; }
      this.bt = null;
      this.findMatch();
    },
    attackFriend(base) {
      if (!this.armyCount()) { UI.toast('Train some troops first (Army menu).', 'bad'); return; }
      const loot = D.lootFor(Game.ph(), base.ph, true);
      this.beginBattle({ layout: base.layout, seed: U.hashString(base.code) ^ Date.now(), title: base.name, sub: `Friend · Pyramid ${base.ph} · ${U.prettyCode(base.code)}`,
        info: { loot, friendly: true, ph: base.ph }, guardLevel: base.guardLevel });
    },
    revenge(e) {
      if (!this.armyCount()) { UI.toast('Train some troops first (Army menu).', 'bad'); return; }
      const rival = BaseGen.makeRival(Game.ph(), Game.get().trophies, e.seed, e.ph);
      const loot = D.lootFor(Game.ph(), rival.ph, false);
      this.beginBattle({ layout: rival.layout, seed: e.seed, title: e.name, sub: `Revenge · Pyramid ${rival.ph}`, info: { loot, friendly: false, ph: rival.ph, revengeId: e.id }, guardLevel: Math.max(1, rival.ph - 1) });
    },
    replay(e) {
      const R = e.replay;
      const battle = new Battle({ layout: R.layout, seed: R.seed, troopLevels: R.levels, loot: R.loot, guardLevel: R.guardLevel });
      battle.reserve = R.deploy.length;
      this.enterBattleView({ battle, title: e.name, sub: `Raided you · Pyramid ${e.ph}`, info: { loot: { ...R.loot, gems: 0 } }, replay: true, deploy: R.deploy, di: 0, phase: 'fight', speed: 1 });
    },

    beginBattle(o) {
      const S = Game.get();
      const battle = new Battle({ layout: o.layout, seed: o.seed, troopLevels: S.troopLevels, loot: o.info.loot, guardLevel: o.guardLevel || 1 });
      const left = { ...S.army };
      battle.reserve = Object.values(left).reduce((a, b) => a + b, 0);
      const pick = D.TROOP_ORDER.find((t) => left[t]);
      this.enterBattleView({ battle, title: o.title, sub: o.sub, info: o.info, left, used: {}, pick, phase: 'scout', scoutLeft: 30, canNext: o.canNext, speed: 1 });
    },

    enterBattleView(bt) {
      UI.closeModal();
      this.cancelPlace();
      this.select(null);
      bt.acc = 0; bt.left = bt.left || {}; bt.used = bt.used || {};
      this.bt = bt;
      this.mode = 'battle';
      $('hud').hidden = true; $('dock').hidden = true; $('goal').hidden = true;
      $('bhud').hidden = false;
      for (const i of $('b-stars').children) i.classList.remove('on');
      this.renderer.particles = []; this.renderer.floaters = [];
      this.renderer.fit();
      UI.flash();
      Sound.play('horn');
      UI.battleHud(this); UI.battleCards(this);
    },

    deployAt(sx, sy, quiet) {
      const B = this.bt;
      if (!B || B.replay || B.phase === 'over') return false;
      if (!B.pick || !B.left[B.pick]) {
        const next = D.TROOP_ORDER.find((t) => B.left[t]);
        if (!next) { if (!quiet) UI.toast('All your troops are on the field.'); return false; }
        B.pick = next; UI.battleCards(this);
      }
      const [x, y] = this.renderer.toTile(sx, sy);
      if (!B.battle.canDeploy(x, y)) {
        B.showMask = performance.now() / 1000 + 1.5;
        if (!quiet) UI.toast('Troops must land outside the red area.', 'bad');
        return false;
      }
      const t = B.pick, lv = Game.get().troopLevels[t];
      B.battle.deploy(t, lv, x, y);
      B.left[t]--; B.used[t] = (B.used[t] || 0) + 1;
      B.battle.reserve--;
      if (B.phase === 'scout') { B.phase = 'fight'; }
      Sound.play('deploy');
      if (!B.left[t]) { B.pick = D.TROOP_ORDER.find((k) => B.left[k]) || null; }
      UI.battleCards(this);
      return true;
    },

    stepBattle(dt) {
      const B = this.bt, b = B.battle;
      if (B.phase === 'scout') {
        B.scoutLeft -= dt;
        if (B.scoutLeft <= 0) B.phase = 'fight';
        if ((B.hudT = (B.hudT || 0) + dt) > 0.2) { B.hudT = 0; UI.battleHud(this); }
        return;
      }
      if (B.phase === 'over') return;
      B.acc += dt * (B.speed || 1);
      let steps = 0;
      while (B.acc >= BattleSim.DT && steps++ < 40) {
        B.acc -= BattleSim.DT;
        if (B.replay) {
          while (B.di < B.deploy.length && B.deploy[B.di].tick <= b.tick) {
            const d = B.deploy[B.di++];
            b.reserve--;
            b.deploy(d.type, B.battle.troopLevels[d.type] || 1, d.x, d.y);
          }
        }
        b.step();
        this.handleFx(b);
        if (b.ended) break;
      }
      if ((B.hudT = (B.hudT || 0) + dt) > 0.2) { B.hudT = 0; UI.battleHud(this); }
      if (b.ended && B.phase !== 'over') this.finishBattle();
    },

    handleFx(b) {
      if (!b.fx.length) return;
      this.renderer.handleFx(b.fx, b);
      let snd = null;
      for (const e of b.fx) {
        if (e.k === 'destroy' && !e.wall) snd = 'destroy';
        else if (e.k === 'boom' && snd !== 'destroy') snd = 'boom';
        else if (e.k === 'guards') Sound.play('horn');
        else if (e.k === 'hit' && !snd && Math.random() < 0.15) snd = 'hit';
      }
      if (snd) Sound.play(snd);
      b.fx.length = 0;
    },

    endButton() {
      const B = this.bt;
      if (!B) return;
      if (B.replay || B.phase === 'scout') { this.goHome(); return; }
      if (B.phase === 'fight') { B.battle.finish('surrender'); this.finishBattle(); }
    },

    finishBattle() {
      const B = this.bt;
      B.phase = 'over';
      UI.battleHud(this);
      const r = B.battle.result();
      let gained = null;
      if (!B.replay) {
        gained = Game.applyAttack(r, { ...B.info, used: B.used });
        this.dirtyLayout = true;
      }
      setTimeout(() => UI.result(this, r, gained), 900);
    },

    goHome() {
      this.bt = null;
      this.mode = 'village';
      $('bhud').hidden = true; $('hud').hidden = false; $('dock').hidden = false;
      this.renderer.particles = []; this.renderer.floaters = [];
      this.renderer.fit();
      UI.hud();
    },
  };

  G.App = App;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.boot());
    else App.boot();
  }
})(globalThis.SOTP = globalThis.SOTP || {});
