/* Kingdom Clash: the battle simulation. Plain state advanced in fixed steps (30 a second) with no DOM,
   so the same code runs in the page, in Node for tests, and later on both ends of an online match
   (both sides step the same state from the same card plays).

   The arena is 18 tiles wide and 32 tall. Team 0 (blue, the player) defends the bottom half, team 1
   (red) the top. The river covers y 15 to 17 and is crossed on two bridges at x 3.5 and 14.5. */
'use strict';

const KCSim = (() => {
  const W = 18, H = 32, MID = 16, RIVER_TOP = 15, RIVER_BOT = 17;
  const BRIDGES = [3.5, 14.5], BRIDGE_HALF = 1.0;
  const DT = 1 / 30;
  const REGULAR = 180, OVERTIME = 60, DOUBLE_AT = 60;
  const REGEN = 1 / 2.8, MAX_ENERGY = 10, START_ENERGY = 5;
  const POCKET = 11; // how far past the river you may deploy once that lane's tower is down
  const TOWERS = {
    archer: { hp: 1400, dmg: 50, hit: 0.8, range: 7.5, half: 1.5, proj: 'arrow', projSpeed: 14 },
    king: { hp: 2400, dmg: 55, hit: 1.0, range: 7.0, half: 2.0, proj: 'cannon', projSpeed: 11 },
  };
  const levelMult = lvl => Math.pow(1.08, (lvl || 1) - 1);

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, r) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // Mirror a y for a team: each team sees its own side as the bottom (y >= 17).
  const own = (team, y) => (team === 0 ? y : H - y);

  function create(opts) {
    opts = opts || {};
    const s = {
      tick: 0, time: 0, phase: 'regular', timeLeft: REGULAR, double: false,
      ents: [], projs: [], events: [], nextId: 1,
      energy: [START_ENERGY, START_ENERGY], crowns: [0, 0], result: null,
      hands: [], queues: [], levels: opts.levels || [1, 1], played: [0, 0],
      // Each team's card levels ({ cardId: level }); a card not listed uses the team's level.
      cardLevels: opts.cardLevels || [{}, {}],
      // How hard each team's troops and spells hit towers (Trainer Owen hits them at a quarter).
      towerDamage: opts.towerDamage || [1, 1],
      rand: mulberry(opts.seed || 1),
    };
    for (const team of [0, 1]) {
      const deck = (opts.decks && opts.decks[team]) || KC_STARTER_DECK;
      const order = shuffle(deck.slice(), s.rand);
      s.hands[team] = order.slice(0, 4);
      s.queues[team] = order.slice(4);
      addTower(s, team, 'archer', 'L', 3.5, own(team, 25.5));
      addTower(s, team, 'archer', 'R', 14.5, own(team, 25.5));
      addTower(s, team, 'king', 'K', 9, own(team, 29));
    }
    return s;
  }

  function addTower(s, team, sub, lane, x, y) {
    const T = TOWERS[sub], m = levelMult(s.levels[team]);
    s.ents.push({
      id: s.nextId++, kind: 'tower', team, sub, lane, x, y, px: x, py: y,
      radius: T.half, half: T.half, hp: Math.round(T.hp * m), maxHp: Math.round(T.hp * m),
      dmg: Math.round(T.dmg * m), hit: T.hit, range: T.range, proj: T.proj, projSpeed: T.projSpeed,
      targets: 'both', active: sub !== 'king', cd: 0, target: 0, flash: 0, dead: false,
    });
  }

  const cardLevel = (s, team, id) => (s.cardLevels[team] && s.cardLevels[team][id]) || s.levels[team] || 1;
  const blocks = e => (e.kind === 'tower' || e.kind === 'building') && !e.dead;
  const byId = (s, id) => {
    if (!id) return null;
    for (const e of s.ents) if (e.id === id) return e;
    return null;
  };
  const tower = (s, team, lane) => s.ents.find(e => e.kind === 'tower' && e.team === team && e.lane === lane);
  const laneOf = x => (x < W / 2 ? 'L' : 'R');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const edge = (a, b) => dist(a, b) - a.radius - b.radius;
  function canHit(a, t) {
    if (!t || t.dead || t.team === a.team) return false;
    if (a.kind === 'building' && t.kind !== 'troop') return false;
    if (a.targets === 'buildings') return t.kind === 'tower' || t.kind === 'building';
    if (a.targets === 'ground') return !t.air;
    return true;
  }

  /* ---------- deploying ---------- */
  // Is (x, y) on a tower or building (or within pad of one)?
  function inTower(s, x, y, pad) {
    for (const e of s.ents) {
      if (!blocks(e)) continue;
      if (Math.abs(x - e.x) < e.half + pad && Math.abs(y - e.y) < e.half + pad) return true;
    }
    return false;
  }
  function canDeploy(s, team, cardId, x, y) {
    const c = KC_CARDS[cardId];
    if (!c || x < 0.5 || x > W - 0.5 || y < 0.5 || y > H - 0.5) return false;
    if (c.kind === 'spell') return true;
    const my = own(team, y), half = c.kind === 'building' ? c.half : 0;
    let ok = my - half >= RIVER_BOT + 0.1;
    if (!ok && my - half >= POCKET) {
      const t = tower(s, 1 - team, laneOf(x));
      ok = !!(t && t.dead) && (my + half < RIVER_TOP || my - half > RIVER_BOT);
    }
    if (half && (x - half < 0 || x + half > W || y - half < 0 || y + half > H)) return false;
    return ok && !inTower(s, x, y, half ? half + 0.05 : 0.2);
  }

  function play(s, team, slot, x, y) {
    if (s.result) return 'over';
    const id = s.hands[team][slot], c = KC_CARDS[id];
    if (!c) return 'card';
    if (s.energy[team] < c.cost) return 'energy';
    if (!canDeploy(s, team, id, x, y)) return 'zone';
    s.energy[team] -= c.cost;
    s.hands[team][slot] = s.queues[team].shift();
    s.queues[team].push(id);
    s.played[team]++;
    if (c.kind === 'spell') {
      const k = tower(s, team, 'K');
      s.projs.push({ kind: 'fireball', team, x: k.x, y: k.y, sx: k.x, sy: k.y, tx: x, ty: y, target: 0,
        speed: c.projSpeed, dmg: Math.round(c.dmg * levelMult(cardLevel(s, team, id))), card: id });
      s.events.push({ type: 'cast', team, card: id, x, y });
      return 'ok';
    }
    if (c.kind === 'building') {
      spawnBuilding(s, team, id, x, y);
      s.events.push({ type: 'deploy', team, card: id, x, y });
      return 'ok';
    }
    const offs = formation(c.count);
    for (const [ox, oy] of offs) spawn(s, team, id, x + ox, y + (team === 0 ? oy : -oy));
    s.events.push({ type: 'deploy', team, card: id, x, y });
    return 'ok';
  }
  function formation(n) {
    if (n === 2) return [[-0.5, 0], [0.5, 0]];
    if (n === 3) return [[-0.55, 0.3], [0.55, 0.3], [0, -0.45]];
    if (n === 4) return [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]];
    return [[0, 0]];
  }
  function spawnBuilding(s, team, id, x, y) {
    const c = KC_CARDS[id], level = cardLevel(s, team, id), m = levelMult(level), hp = Math.round(c.hp * m);
    const b = {
      id: s.nextId++, kind: 'building', team, card: id, x, y, px: x, py: y, level,
      hp, maxHp: hp, dmg: Math.round(c.dmg * m), hit: c.hit, range: c.range, targets: c.targets, air: false,
      radius: c.radius, half: c.half, decay: hp / c.lifetime, proj: c.proj, projSpeed: c.projSpeed,
      deploy: 1.0, cd: 0, target: 0, angle: team === 0 ? -Math.PI / 2 : Math.PI / 2, atk: 0, flash: 0, dead: false,
    };
    s.ents.push(b);
    return b;
  }
  function spawn(s, team, id, x, y) {
    const c = KC_CARDS[id], level = cardLevel(s, team, id), m = levelMult(level);
    const u = {
      id: s.nextId++, kind: 'troop', team, card: id, x, y, px: x, py: y, level,
      hp: Math.round(c.hp * m), maxHp: Math.round(c.hp * m), dmg: Math.round(c.dmg * m),
      hit: c.hit, range: c.range, speed: c.speed, targets: c.targets, air: !!c.air,
      radius: c.radius, mass: c.mass, heavy: !!c.heavy, proj: c.proj || null, projSpeed: c.projSpeed || 0,
      splash: c.splash || 0, sight: Math.max(5.5, c.range + 1),
      deploy: 1.0, cd: c.hit * 0.5, target: 0, locked: false, retarget: 0,
      face: team === 0 ? 1 : -1, moving: false, atk: 0, flash: 0, born: s.time, dead: false,
    };
    clampArena(u);
    s.ents.push(u);
    return u;
  }

  /* ---------- damage ---------- */
  function damage(s, e, amount, by) {
    if (!e || e.dead) return;
    if (e.kind === 'tower' && by !== undefined) amount = Math.max(1, Math.round(amount * s.towerDamage[by]));
    e.hp -= amount;
    e.flash = 0.12;
    if (e.kind === 'tower' && e.sub === 'king' && !e.active) {
      e.active = true;
      s.events.push({ type: 'king', team: e.team });
    }
    if (e.hp <= 0) {
      e.hp = 0;
      e.dead = true;
      if (e.kind === 'tower') towerDown(s, e);
      else s.events.push({ type: 'death', team: e.team, card: e.card, x: e.x, y: e.y, air: e.air, building: e.kind === 'building' });
    }
  }
  function towerDown(s, t) {
    const other = 1 - t.team;
    s.events.push({ type: 'tower', team: t.team, sub: t.sub, x: t.x, y: t.y });
    if (t.sub === 'king') {
      s.crowns[other] = 3;
      for (const e of s.ents) if (e.kind === 'tower' && e.team === t.team && !e.dead) {
        e.dead = true; e.hp = 0;
        s.events.push({ type: 'tower', team: e.team, sub: e.sub, x: e.x, y: e.y });
      }
      finish(s, other, 'king');
      return;
    }
    s.crowns[other]++;
    const k = tower(s, t.team, 'K');
    if (k && !k.dead && !k.active) { k.active = true; s.events.push({ type: 'king', team: t.team }); }
    if (s.phase === 'overtime') finish(s, other, 'overtime');
  }
  function finish(s, winner, reason) {
    if (s.result) return;
    s.result = { winner, reason, crowns: s.crowns.slice(), time: s.time };
    s.events.push({ type: 'end', winner, reason });
  }

  /* ---------- moving ---------- */
  function nav(u, tx, ty) {
    if (u.air) return [tx, ty];
    const side = y => (y > MID ? 0 : 1);
    const inRiver = u.y > RIVER_TOP - 0.05 && u.y < RIVER_BOT + 0.05;
    const onBridge = BRIDGES.find(b => Math.abs(u.x - b) < BRIDGE_HALF);
    if (!inRiver && side(u.y) === side(ty)) return [tx, ty];
    const down = ty > u.y; // heading to the bottom half
    const exitY = down ? RIVER_BOT + 0.6 : RIVER_TOP - 0.6;
    if (inRiver && onBridge !== undefined) return [onBridge + (u.x - onBridge) * 0.5, exitY];
    if (side(u.y) === side(ty)) return [tx, ty];
    let bx = BRIDGES[0], best = Infinity;
    for (const b of BRIDGES) {
      const cost = Math.abs(u.x - b) + Math.abs(tx - b);
      if (cost < best) { best = cost; bx = b; }
    }
    const entryY = down ? RIVER_TOP - 0.5 : RIVER_BOT + 0.5;
    if (Math.abs(u.x - bx) < 0.55 && Math.abs(u.y - entryY) < 0.7) return [bx, exitY];
    return [bx, entryY];
  }
  // Walk around any standing tower between a ground troop and where it is heading: aim for the near
  // corner of the tower first, then the far corner, on the side closer to the troop (or its goal).
  function avoid(s, u, nx, ny, target) {
    if (u.air) return [nx, ny];
    let best = null, bt = Infinity;
    for (const t of s.ents) {
      if (!blocks(t) || t === target) continue;
      const h = t.half + u.radius * 0.8 + 0.12;
      const hit = segBox(u.x, u.y, nx, ny, t.x - h, t.y - h, t.x + h, t.y + h);
      if (hit !== null && hit < bt) { bt = hit; best = { t, h }; }
    }
    if (!best) return [nx, ny];
    const { t, h } = best, dx = u.x - t.x;
    const sx = Math.abs(dx) > 0.3 ? Math.sign(dx) : Math.sign(nx - t.x) || (t.x < W / 2 ? 1 : -1);
    const sy = Math.sign(ny - u.y) || 1;
    const cx = t.x + sx * (h + 0.15);
    if (Math.abs(dx) < h) return [cx, Math.abs(u.y - t.y) < h ? u.y + sy * 0.2 : t.y - sy * h];
    return [cx, t.y + sy * (h + 0.15)];
  }
  // Where along the segment (0 to 1) it enters the box, or null if it misses.
  function segBox(x1, y1, x2, y2, minX, minY, maxX, maxY) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    for (const [p, q] of [[-dx, x1 - minX], [dx, maxX - x1], [-dy, y1 - minY], [dy, maxY - y1]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return t0;
  }
  function clampArena(u) {
    u.x = Math.max(u.radius * 0.6, Math.min(W - u.radius * 0.6, u.x));
    u.y = Math.max(u.radius * 0.6, Math.min(H - u.radius * 0.6, u.y));
    if (!u.air && u.y > RIVER_TOP && u.y < RIVER_BOT) {
      const onBridge = BRIDGES.some(b => Math.abs(u.x - b) <= BRIDGE_HALF - 0.15);
      if (!onBridge) {
        const b = BRIDGES.reduce((p, q) => (Math.abs(u.x - q) < Math.abs(u.x - p) ? q : p));
        const toBank = Math.min(u.y - RIVER_TOP, RIVER_BOT - u.y);
        const toBridge = Math.abs(u.x - b) - (BRIDGE_HALF - 0.15);
        if (toBridge < toBank) u.x = b + Math.sign(u.x - b) * (BRIDGE_HALF - 0.15);
        else u.y = u.y < MID ? RIVER_TOP : RIVER_BOT;
      }
    }
  }

  /* ---------- troops ---------- */
  function findTarget(s, u) {
    let best = null, bd = Infinity;
    for (const e of s.ents) {
      if (!canHit(u, e)) continue;
      const d = edge(u, e);
      if (u.targets !== 'buildings' && d > u.sight) continue;
      // Tower-chasers go for a nearby building first (that is what a Cannon is for).
      if (u.targets === 'buildings' && d > (e.kind === 'building' ? 7 : 3)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) return best;
    const lt = tower(s, 1 - u.team, laneOf(u.x));
    if (lt && !lt.dead) return lt;
    const k = tower(s, 1 - u.team, 'K');
    return k && !k.dead ? k : null;
  }
  function attack(s, u, t) {
    u.atk = 0.28;
    if (u.proj) {
      s.projs.push({ kind: u.proj, team: u.team, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: t.x, ty: t.y,
        target: t.id, speed: u.projSpeed, dmg: u.dmg, splash: u.splash, targets: u.targets, card: u.card,
        air: u.air });
      s.events.push({ type: 'shoot', kind: u.proj, team: u.team, x: u.x, y: u.y });
    } else {
      damage(s, t, u.dmg, u.team);
      s.events.push({ type: 'hit', card: u.card, team: u.team, x: t.x, y: t.y, by: u.id });
    }
  }
  function troopStep(s, u) {
    if (u.flash > 0) u.flash -= DT;
    if (u.deploy > 0) { u.deploy -= DT; return; }
    if (u.atk > 0) u.atk -= DT;
    u.cd -= DT;
    let t = byId(s, u.target);
    if (!t || !canHit(u, t)) { t = null; u.target = 0; u.locked = false; }
    u.retarget -= DT;
    if (!u.locked && (u.retarget <= 0 || !t)) {
      u.retarget = 0.2;
      const n = findTarget(s, u);
      if (n) { t = n; u.target = n.id; }
    }
    u.moving = false;
    if (!t) return;
    const d = edge(u, t);
    if (d <= u.range) {
      if (Math.abs(t.x - u.x) > 0.05) u.face = Math.sign(t.x - u.x);
      if (u.cd <= 0) { attack(s, u, t); u.cd = u.hit; u.locked = true; }
      return;
    }
    if (u.locked && d > u.range + 0.6) u.locked = false;
    if (u.cd < u.hit * 0.5) u.cd = u.hit * 0.5;
    const [nx, ny] = avoid(s, u, ...nav(u, t.x, t.y), t);
    const dx = nx - u.x, dy = ny - u.y, len = Math.hypot(dx, dy);
    if (len > 0.001) {
      const step = Math.min(len, u.speed * DT);
      u.x += (dx / len) * step;
      u.y += (dy / len) * step;
      if (Math.abs(dx) > 0.02) u.face = Math.sign(dx);
      u.moving = true;
    }
  }
  function towerStep(s, e) {
    if (e.flash > 0) e.flash -= DT;
    if (!e.active) return;
    e.cd -= DT;
    let t = byId(s, e.target);
    if (!t || t.dead || t.kind === 'tower' || edge(e, t) > e.range) {
      t = null; e.target = 0;
      let bd = Infinity;
      for (const u of s.ents) {
        if ((u.kind !== 'troop' && u.kind !== 'building') || u.team === e.team || u.dead) continue;
        const d = edge(e, u);
        if (d <= e.range && d < bd) { bd = d; t = u; }
      }
      if (t) e.target = t.id;
    }
    if (t && e.cd <= 0) {
      e.cd = e.hit;
      const top = e.sub === 'king' ? 1.6 : 1.4;
      s.projs.push({ kind: e.proj, team: e.team, x: e.x, y: e.y - top, sx: e.x, sy: e.y - top, tx: t.x, ty: t.y,
        target: t.id, speed: e.projSpeed, dmg: e.dmg, splash: 0, targets: 'both', tower: true });
      s.events.push({ type: 'shoot', kind: e.proj, team: e.team, x: e.x, y: e.y, tower: true });
    }
  }

  /* ---------- buildings ---------- */
  function buildingStep(s, b) {
    if (b.flash > 0) b.flash -= DT;
    if (b.deploy > 0) { b.deploy -= DT; return; }
    b.hp -= b.decay * DT;
    if (b.hp <= 0) {
      b.hp = 0; b.dead = true;
      s.events.push({ type: 'death', team: b.team, card: b.card, x: b.x, y: b.y, building: true });
      return;
    }
    if (b.atk > 0) b.atk -= DT;
    b.cd -= DT;
    let t = byId(s, b.target);
    if (!t || !canHit(b, t) || edge(b, t) > b.range) {
      t = null; b.target = 0;
      let bd = Infinity;
      for (const u of s.ents) {
        if (!canHit(b, u)) continue;
        const d = edge(b, u);
        if (d <= b.range && d < bd) { bd = d; t = u; }
      }
      if (t) b.target = t.id;
    }
    if (!t) return;
    b.angle = Math.atan2(t.y - b.y, t.x - b.x);
    if (b.cd <= 0) {
      b.cd = b.hit; b.atk = 0.25;
      const mx = b.x + Math.cos(b.angle) * 0.7, my = b.y + Math.sin(b.angle) * 0.7 - 0.3;
      s.projs.push({ kind: b.proj, team: b.team, x: mx, y: my, sx: mx, sy: my, tx: t.x, ty: t.y, target: t.id,
        speed: b.projSpeed, dmg: b.dmg, splash: 0, targets: b.targets, card: b.card });
      s.events.push({ type: 'shoot', kind: b.proj, team: b.team, x: b.x, y: b.y });
    }
  }

  /* ---------- projectiles ---------- */
  function projStep(s) {
    for (const p of s.projs) {
      const t = byId(s, p.target);
      if (t && !t.dead) { p.tx = t.x; p.ty = t.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * DT;
      if (d > step) { p.x += (dx / d) * step; p.y += (dy / d) * step; continue; }
      p.x = p.tx; p.y = p.ty; p.done = true;
      if (p.kind === 'fireball') fireball(s, p);
      else if (p.splash) {
        for (const e of s.ents) {
          if (e.dead || e.team === p.team) continue;
          if (p.targets === 'ground' && e.air) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) - e.radius <= p.splash) damage(s, e, p.dmg, p.team);
        }
        s.events.push({ type: 'splash', kind: p.kind, x: p.x, y: p.y, r: p.splash });
      } else if (t && !t.dead) {
        damage(s, t, p.dmg, p.team);
        s.events.push({ type: 'hit', kind: p.kind, team: p.team, x: p.x, y: p.y });
      }
    }
    s.projs = s.projs.filter(p => !p.done);
  }
  function fireball(s, p) {
    const c = KC_CARDS.fireball;
    for (const e of s.ents) {
      if (e.dead || e.team === p.team) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d - e.radius > c.area) continue;
      damage(s, e, e.kind === 'tower' ? Math.round(p.dmg * c.towerPct) : p.dmg, p.team);
      if (e.kind === 'troop' && !e.dead && !e.heavy) {
        const k = c.knockback / Math.max(1, e.mass / 2);
        const nx = d > 0.01 ? (e.x - p.x) / d : 0, ny = d > 0.01 ? (e.y - p.y) / d : (e.team === 0 ? 1 : -1);
        e.x += nx * k; e.y += ny * k;
        clampArena(e);
      }
    }
    s.events.push({ type: 'boom', team: p.team, x: p.x, y: p.y, r: c.area });
  }

  /* ---------- pushing apart ---------- */
  function collide(s) {
    const troops = s.ents.filter(e => e.kind === 'troop' && !e.dead);
    for (let i = 0; i < troops.length; i++) {
      const a = troops[i];
      for (let j = i + 1; j < troops.length; j++) {
        const b = troops[j];
        if (a.air !== b.air) continue;
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        const min = (a.radius + b.radius) * 0.9;
        if (d >= min) continue;
        if (d < 0.001) { dx = ((a.id * 7919) % 13) / 13 - 0.5 || 0.1; dy = 0.3; d = Math.hypot(dx, dy); }
        const push = min - d, ma = a.deploy > 0 ? a.mass * 3 : a.mass, mb = b.deploy > 0 ? b.mass * 3 : b.mass;
        const fa = mb / (ma + mb), fb = ma / (ma + mb);
        a.x -= (dx / d) * push * fa; a.y -= (dy / d) * push * fa;
        b.x += (dx / d) * push * fb; b.y += (dy / d) * push * fb;
      }
    }
    for (const u of troops) {
      if (!u.air) for (const t of s.ents) {
        if (!blocks(t)) continue;
        const h = t.half + u.radius * 0.8, dx = u.x - t.x, dy = u.y - t.y;
        if (Math.abs(dx) >= h || Math.abs(dy) >= h) continue;
        if (h - Math.abs(dx) < h - Math.abs(dy)) u.x = t.x + Math.sign(dx || 1) * h;
        else u.y = t.y + Math.sign(dy || 1) * h;
      }
      clampArena(u);
    }
  }

  /* ---------- the clock ---------- */
  function lowestTower(s, team) {
    let low = Infinity;
    for (const e of s.ents) if (e.kind === 'tower' && e.team === team && !e.dead) low = Math.min(low, e.hp / e.maxHp);
    return low === Infinity ? 0 : low;
  }
  function clock(s) {
    s.timeLeft -= DT;
    if (s.phase === 'regular' && !s.double && s.timeLeft <= DOUBLE_AT) {
      s.double = true;
      s.events.push({ type: 'double' });
    }
    if (s.timeLeft > 0) return;
    if (s.crowns[0] !== s.crowns[1]) { finish(s, s.crowns[0] > s.crowns[1] ? 0 : 1, 'time'); return; }
    if (s.phase === 'regular') {
      s.phase = 'overtime';
      s.timeLeft = OVERTIME;
      s.events.push({ type: 'overtime' });
      return;
    }
    const a = lowestTower(s, 0), b = lowestTower(s, 1);
    if (Math.abs(a - b) < 1e-6) finish(s, -1, 'draw');
    else finish(s, a > b ? 0 : 1, 'tiebreak');
  }

  function step(s) {
    if (s.result) return;
    s.tick++;
    s.time += DT;
    const mult = s.double || s.phase === 'overtime' ? 2 : 1;
    for (const t of [0, 1]) s.energy[t] = Math.min(MAX_ENERGY, s.energy[t] + REGEN * mult * DT);
    for (const e of s.ents) { e.px = e.x; e.py = e.y; }
    for (const p of s.projs) { p.px = p.x; p.py = p.y; }
    for (const e of s.ents) {
      if (e.dead) continue;
      if (e.kind === 'tower') towerStep(s, e); else if (e.kind === 'building') buildingStep(s, e); else troopStep(s, e);
      if (s.result) break;
    }
    if (!s.result) projStep(s);
    collide(s);
    s.ents = s.ents.filter(e => e.kind === 'tower' || !e.dead);
    if (!s.result) clock(s);
  }

  return {
    W, H, MID, RIVER_TOP, RIVER_BOT, BRIDGES, BRIDGE_HALF, DT, REGULAR, OVERTIME, MAX_ENERGY, TOWERS,
    create, step, play, canDeploy, tower, laneOf, own, mulberry, levelMult,
  };
})();
