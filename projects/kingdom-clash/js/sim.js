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
  // Only exact arithmetic (+ - * / and square roots) in the simulation, so two browsers playing the
  // same online battle compute exactly the same thing: no powers, hypot or trigonometry here.
  const hyp = (x, y) => Math.sqrt(x * x + y * y);
  const levelMult = lvl => { let m = 1; for (let i = 1; i < (lvl || 1); i++) m *= 1.08; return m; };

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
      ents: [], projs: [], zones: [], events: [], nextId: 1,
      energy: [START_ENERGY, START_ENERGY], crowns: [0, 0], result: null,
      hands: [], queues: [], levels: opts.levels || [1, 1], played: [0, 0],
      // Each team's card levels ({ cardId: level }); a card not listed uses the team's level.
      cardLevels: opts.cardLevels || [{}, {}],
      // How hard each team's troops and spells hit towers (Trainer Owen hits them at a quarter).
      towerDamage: opts.towerDamage || [1, 1],
      // Each team's unlocked evolutions (card ids), and how many times each card has been played.
      evos: opts.evos || [[], []], evoPlays: [{}, {}],
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

  const cardLevel = (s, team, id) => Math.max(KC_MIN_LEVEL(id), (s.cardLevels[team] && s.cardLevels[team][id]) || s.levels[team] || 1);
  const blocks = e => (e.kind === 'tower' || e.kind === 'building') && !e.dead && !e.tunnel;
  const byId = (s, id) => {
    if (!id) return null;
    for (const e of s.ents) if (e.id === id) return e;
    return null;
  };
  const tower = (s, team, lane) => s.ents.find(e => e.kind === 'tower' && e.team === team && e.lane === lane);
  const stunned = (s, e) => e.stunEnd > s.time;
  const laneOf = x => (x < W / 2 ? 'L' : 'R');
  const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
  const edge = (a, b) => dist(a, b) - a.radius - b.radius;
  function canHit(a, t) {
    if (!t || t.dead || t.team === a.team || t.tunnel || t.leap || t.hidden || a.targets === 'none') return false;
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
    if (c.anywhere) {
      const inRiver = y > RIVER_TOP && y < RIVER_BOT && !BRIDGES.some(b => Math.abs(x - b) < BRIDGE_HALF);
      const hf = c.half || 0;
      if (hf && (x - hf < 0 || x + hf > W || y - hf < 0 || y + hf > H)) return false;
      return !inRiver && !inTower(s, x, y, hf ? hf + 0.05 : 0.2);
    }
    const my = own(team, y), half = c.kind === 'building' ? c.half : 0;
    let ok = my - half >= RIVER_BOT + 0.1;
    if (!ok && my - half >= POCKET) {
      // once that lane's tower is down: the ground up to the pocket line and, for a troop, that
      // lane's bridge (never the water, and never a building on the bridge)
      const t = tower(s, 1 - team, laneOf(x));
      const onBridge = !half && BRIDGES.some(b => Math.abs(x - b) <= BRIDGE_HALF - 0.15);
      ok = !!(t && t.dead) && (my + half < RIVER_TOP || my - half > RIVER_BOT || onBridge);
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
    if (c.storm) {
      // a sandstorm: no projectile, the storm rises where it is cast
      const lv = levelMult(cardLevel(s, team, id));
      s.zones.push({ x, y, r: c.area, team, dps: Math.round(c.dmg / c.storm.dur * lv), left: c.storm.dur, dur: c.storm.dur, pulse: 0,
        kind: 'sandstorm', targets: 'both', slow: c.storm.slow, towerPct: c.towerPct, card: id });
      s.events.push({ type: 'cast', team, card: id, x, y });
      return 'ok';
    }
    if (c.instant) {
      // Flash Freeze, Gem Flash: no travel time, everything in the area at once
      const lv = levelMult(cardLevel(s, team, id)), dmg = Math.round(c.dmg * lv);
      for (const e of s.ents) {
        if (e.dead || e.team === team || e.tunnel || e.leap) continue;
        if (hyp(e.x - x, e.y - y) - e.radius > c.area) continue;
        damage(s, e, e.kind === 'tower' ? Math.max(1, Math.round(dmg * c.towerPct)) : dmg, team);
        if (!e.dead) stun(s, e, c.stun, id === 'flashfreeze' ? 'freeze' : 'zap');
      }
      s.events.push({ type: 'cast', team, card: id, x, y });
      s.events.push({ type: 'boom', team, card: id, x, y, r: c.area });
      return 'ok';
    }
    if (c.gate) {
      // Abyss Gate: a portal that lets wraiths out one by one for its duration
      const G = c.gate;
      s.zones.push({ x, y, r: c.area, team, dps: 0, left: G.dur, dur: G.dur, pulse: 0, kind: 'gate', targets: 'ground', card: id,
        gate: { card: G.card, n: G.n, every: G.every, next: G.first, done: 0, level: cardLevel(s, team, id) }, age: 0 });
      s.events.push({ type: 'cast', team, card: id, x, y });
      return 'ok';
    }
    if (c.kind === 'spell') {
      const k = tower(s, team, 'K');
      s.projs.push({ kind: c.projKind || 'fireball', spell: id, team, x: k.x, y: k.y, sx: k.x, sy: k.y, tx: x, ty: y, target: 0,
        speed: c.projSpeed, dmg: Math.round(c.dmg * levelMult(cardLevel(s, team, id))), card: id, level: cardLevel(s, team, id) });
      s.events.push({ type: 'cast', team, card: id, x, y });
      return 'ok';
    }
    if (c.kind === 'building' && c.burrow) {
      // the Crystal Drill bores from in front of its King Tower to the spot, then comes up as a building
      const k = tower(s, team, 'K'), sx = k.x, sy = own(team, own(team, k.y) - 2.6);
      const b = spawnBuilding(s, team, id, sx, sy);
      b.tunnel = { tx: x, ty: y }; b.deploy = 0;
      s.events.push({ type: 'burrow', team, card: id, x: sx, y: sy, tx: x, ty: y });
      return 'ok';
    }
    if (c.kind === 'building') {
      spawnBuilding(s, team, id, x, y);
      s.events.push({ type: 'deploy', team, card: id, x, y });
      return 'ok';
    }
    if (c.burrow) {
      // the Mole digs out from in front of its King Tower and tunnels to the spot
      const k = tower(s, team, 'K'), sx = k.x, sy = own(team, own(team, k.y) - 2.6);
      const u = spawn(s, team, id, sx, sy);
      u.tunnel = { tx: x, ty: y }; u.deploy = 0;
      s.events.push({ type: 'burrow', team, card: id, x: sx, y: sy, tx: x, ty: y });
      return 'ok';
    }
    // an evolution comes round every cycle-th play of the card
    let evo = false;
    if (KC_EVOS[id] && s.evos[team].includes(id)) {
      const n = s.evoPlays[team][id] || 0;
      evo = n % KC_EVOS[id].cycle === KC_EVOS[id].cycle - 1;
      s.evoPlays[team][id] = n + 1;
    }
    const offs = formation(c.count), lvl = cardLevel(s, team, id);
    if (c.squad) {
      // a mixed group (Dock Raiders): the melee ones in front, the throwers behind, all at the card's level
      let i = 0;
      for (const g of c.squad) for (let n = 0; n < g.n; n++, i++) { const [ox, oy] = offs[i]; spawn(s, team, g.card, x + ox, y + (team === 0 ? oy : -oy), false, lvl); }
    } else for (const [ox, oy] of offs) spawn(s, team, id, x + ox, y + (team === 0 ? oy : -oy), evo);
    s.events.push({ type: 'deploy', team, card: id, x, y, evo });
    return 'ok';
  }
  // Where each of a card's units stands, around the spot it was placed (front first, toward the enemy).
  function formation(n) {
    if (n === 2) return [[-0.5, 0], [0.5, 0]];
    if (n === 3) return [[-0.55, 0.3], [0.55, 0.3], [0, -0.45]];
    if (n === 4) return [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]];
    if (n === 5) return [[0, -0.5], [-0.5, -0.1], [0.5, -0.1], [-0.3, 0.45], [0.3, 0.45]];
    if (n > 5) {
      // a horde: a centre and rings around it (fixed points, no trigonometry)
      const ring = [[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]];
      const ring2 = [[1, 0], [0.71, 0.71], [0, 1], [-0.71, 0.71], [-1, 0], [-0.71, -0.71], [0, -1], [0.71, -0.71]];
      const out = [[0, 0]];
      for (const [a, b] of ring) out.push([a * 0.6, b * 0.6]);
      for (let r = 1.2; out.length < n; r += 0.6) for (const [a, b] of ring2) out.push([a * r, b * r]);
      return out.slice(0, n);
    }
    return [[0, 0]];
  }
  function spawnBuilding(s, team, id, x, y) {
    const c = KC_CARDS[id], level = cardLevel(s, team, id), m = levelMult(level), hp = Math.round(c.hp * m);
    const b = {
      id: s.nextId++, kind: 'building', team, card: id, x, y, px: x, py: y, level,
      hp, maxHp: hp, dmg: Math.round(c.dmg * m), hit: c.hit, range: c.range, targets: c.targets, air: false,
      radius: c.radius, half: c.half, decay: hp / c.lifetime, proj: c.proj, projSpeed: c.projSpeed,
      deploy: 1.0, cd: 0, target: 0, aimX: 0, aimY: team === 0 ? -1 : 1, atk: 0, flash: 0, dead: false, stunEnd: 0,
    };
    // the Coil Tower waits hidden underground until something comes in range
    if (c.hide) Object.assign(b, { hidden: true, rise: 0, idle: 0 });
    if (c.spawner) b.spawnT = c.spawner.first;
    s.ents.push(b);
    return b;
  }
  // How an evolution stands for a team's card: null if it has none, else how many plays are counted
  // toward the next evolved one and whether the next play is evolved.
  function evoCharge(s, team, id) {
    const E = KC_EVOS[id];
    if (!E || !s.evos[team].includes(id)) return null;
    const n = (s.evoPlays[team][id] || 0) % E.cycle;
    return { n, cycle: E.cycle, ready: n === E.cycle - 1 };
  }
  function spawn(s, team, id, x, y, evo, lvl) {
    const c = KC_CARDS[id], parent = c.hidden ? null : id, level = lvl || cardLevel(s, team, id), m = levelMult(level);
    const u = {
      id: s.nextId++, kind: 'troop', team, card: id, x, y, px: x, py: y, level,
      hp: Math.round(c.hp * m), maxHp: Math.round(c.hp * m), dmg: Math.round(c.dmg * m),
      hit: c.hit, range: c.range, speed: c.speed, targets: c.targets, air: !!c.air,
      radius: c.radius, mass: c.mass, heavy: !!c.heavy, proj: c.proj || null, projSpeed: c.projSpeed || 0,
      splash: c.splash || 0, sight: Math.max(5.5, c.range + 1), spin: c.spin || 0,
      zone: c.zone ? { r: c.zone.r, dur: c.zone.dur, dps: Math.round(c.zone.dps * m) } : null,
      deploy: 1.0, cd: c.hit * 0.5, target: 0, locked: false, retarget: 0,
      face: team === 0 ? 1 : -1, moving: false, atk: 0, flash: 0, born: s.time, dead: false,
      towerDmg: c.towerDmg || 1, slowEnd: 0, slowF: 0, run: 0, stunEnd: 0,
    };
    if (c.hook) { u.sight = c.hook.max + 0.5; u.hookCd = 0; u.hookT = 0; }
    if (c.shield) u.shield = u.maxShield = Math.round(c.shield * m);
    if (c.charge) { u.chargeT = 0; u.cd = 0; }
    if (c.leap) u.leapDmg = Math.round(c.dmg * m);
    if (c.healHit) u.healHit = { r: c.healHit.r, amount: Math.round(c.healHit.amount * m) };
    if (c.selfHeal) { u.selfHeal = { dps: c.selfHeal.dps * m, after: c.selfHeal.after }; u.lastAtk = -99; }
    if (c.meleeSplash) u.meleeSplash = c.meleeSplash;
    if (c.deployBlast) u.deployBlast = { r: c.deployBlast.r, dmg: Math.round(c.deployBlast.dmg * m) };
    if (c.jump) u.jump = { min: c.jump.min, max: c.jump.max, dmg: Math.round(c.jump.dmg * m), r: c.jump.r, time: c.jump.time, cd: c.jump.cd, ready: 0 };
    if (c.stunHit) u.stunHit = c.stunHit;
    if (c.slowHit) u.slowHit = c.slowHit;
    if (c.pierce) u.pierce = c.pierce;
    if (c.egg) u.egg = c.egg;
    if (id === 'phoenixegg') u.hatch = KC_CARDS.phoenix.egg.hatch;
    if (c.ram) Object.assign(u, { ram: true, baseSpeed: c.speed, maxSpeed: c.ram.max, accel: c.ram.accel });
    if (c.chargeHit) u.chargeHit = c.chargeHit;
    if (c.strike) u.strike = c.strike;
    if (c.beam) Object.assign(u, { beam: c.beam.dps.map(d => d * m), beamStage: c.beam.stage, beamTime: 0, beamOn: 0, beamTick: 0 });
    if (c.deathBlast) u.deathBlast = { r: c.deathBlast.r, dmg: Math.round(c.deathBlast.dmg * m), air: !!c.deathBlast.air, slow: c.deathBlast.slow, slowDur: c.deathBlast.slowDur };
    if (c.rider) u.rider = { dmg: Math.round(c.rider.dmg * m), hit: c.rider.hit, range: c.rider.range, slow: c.rider.slow, slowDur: c.rider.slowDur,
      slowCd: c.rider.slowCd, cd: 0.6, snareCd: 0, atk: 0, aim: 0 };
    if (evo && KC_EVOS[id]) {
      const E = KC_EVOS[id];
      Object.assign(u, { evo: true, proj: 'bigsnow', projSpeed: u.projSpeed * E.projSpeed, splash: u.splash * E.splash });
    }
    clampArena(u);
    s.ents.push(u);
    return u;
  }

  /* ---------- damage ---------- */
  // soft: steady damage over time (a storm, broken pottery), which doesn't flash its target each pulse
  function damage(s, e, amount, by, soft) {
    if (!e || e.dead || e.tunnel || e.leap) return;
    if (e.kind === 'tower' && by !== undefined) amount = Math.max(1, Math.round(amount * s.towerDamage[by]));
    if (e.shield > 0) {
      // a shield takes the whole of the next blow, however big, before it breaks (nothing carries over)
      e.shield = Math.max(0, e.shield - amount);
      if (!soft) e.flash = 0.12;
      if (!e.shield) {
        s.events.push({ type: 'shieldbreak', team: e.team, card: e.card, x: e.x, y: e.y });
        if (KC_CARDS[e.card] && KC_CARDS[e.card].turret) toTurret(s, e);
      }
      return;
    }
    e.hp -= amount;
    if (!soft) e.flash = 0.12;
    if (e.kind === 'tower' && e.sub === 'king' && !e.active) {
      e.active = true;
      s.events.push({ type: 'king', team: e.team });
    }
    if (e.hp <= 0) {
      e.hp = 0;
      e.dead = true;
      if (e.kind === 'tower') towerDown(s, e);
      else if (e.kind === 'building') buildingGone(s, e);
      else {
        s.events.push({ type: 'death', team: e.team, card: e.card, x: e.x, y: e.y, air: e.air, building: false });
        breakUp(s, e);
        if (e.deathBlast) deathBlast(s, e);
        // the Phoenix leaves an egg behind (not when it has already been reborn once)
        if (e.egg && !e.reborn) {
          const g = spawn(s, e.team, e.egg.card, e.x, e.y, false, e.level);
          g.deploy = 0; clampArena(g);
          s.events.push({ type: 'egg', team: e.team, x: g.x, y: g.y });
        }
      }
    }
  }
  // A burst when a troop is destroyed: the Thunder Cloud's thunderclap (ground only), the Steel Titan's,
  // the Icebound Giant's freezing shatter (air too, and slows), the Phoenix's flames.
  function deathBlast(s, e) {
    const B = e.deathBlast;
    for (const o of s.ents) {
      if (o.dead || o.team === e.team || o.tunnel || o.leap || (o.air && !B.air)) continue;
      if (hyp(o.x - e.x, o.y - e.y) - o.radius > B.r) continue;
      damage(s, o, B.dmg, e.team);
      if (B.slow && !o.dead) slowDown(s, o, B.slow, B.slowDur, 'frost');
    }
    s.events.push({ type: 'thunderclap', team: e.team, card: e.card, x: e.x, y: e.y, r: B.r });
  }
  // A building ends (destroyed or worn out): the Crystal Drill lets its last imps out.
  function buildingGone(s, b) {
    s.events.push({ type: 'death', team: b.team, card: b.card, x: b.x, y: b.y, building: true });
    const sp = KC_CARDS[b.card] && KC_CARDS[b.card].spawner;
    if (sp) for (let i = 0; i < sp.onDeath; i++) spawnFrom(s, b, sp.card, i % 2 ? 0.55 : -0.55);
  }
  function spawnFrom(s, b, card, ox) {
    const u = spawn(s, b.team, card, b.x + ox, b.y + (b.team === 0 ? -1 : 1) * (b.half + 0.3), false, b.level);
    u.deploy = 0.3;
    return u;
  }
  // Stunned or frozen: no moving, no attacking; it also starts the next attack over, drains a charge and
  // breaks a beam or a half-thrown hook.
  function stun(s, e, dur, kind) {
    if (!e || e.dead || e.tunnel || e.leap || !dur) return;
    e.stunEnd = Math.max(e.stunEnd || 0, s.time + dur); e.stunKind = kind || 'zap';
    if (e.hit) e.cd = Math.max(e.cd || 0, e.hit * 0.5);
    if (e.chargeT !== undefined) e.chargeT = 0;
    if (e.beam) { e.beamOn = 0; e.beamTime = 0; e.beamTick = 0; }
    if (e.hookT) e.hookT = 0;
    s.events.push({ type: 'stun', team: e.team, id: e.id, x: e.x, y: e.y, kind: e.stunKind, dur });
  }
  function heal(e, amount) {
    if (!e || e.dead || e.kind !== 'troop' || e.hp >= e.maxHp) return 0;
    const h = Math.min(amount, e.maxHp - e.hp);
    e.hp += h;
    return h;
  }
  // The Broadside Cart's shield is gone: the cart stops and becomes a cannon where it stands.
  function toTurret(s, u) {
    const c = KC_CARDS[u.card];
    u.dead = true;
    const b = spawnBuilding(s, u.team, u.card, u.x, u.y);
    const m = levelMult(u.level);
    b.level = u.level; b.hp = b.maxHp = Math.round(c.hp * m); b.dmg = u.dmg; b.half = c.turret.half; b.radius = c.radius;
    b.decay = b.hp / c.turret.lifetime; b.deploy = 0.4; b.turret = true;
    s.events.push({ type: 'transform', team: u.team, card: u.card, x: u.x, y: u.y });
  }
  // A troop that leaves others behind when it ends (the Ram Cart's soldiers).
  function breakUp(s, e) {
    const c = KC_CARDS[e.card];
    if (!c || !c.onEnd || e.brokeUp) return;
    e.brokeUp = true;
    for (let i = 0; i < c.onEnd.count; i++) {
      const side = i % 2 ? 1 : -1, u = spawn(s, e.team, c.onEnd.card, e.x + side * 0.45, e.y, false, e.level);
      u.deploy = 0.3;
    }
    s.events.push({ type: 'breakup', team: e.team, card: e.card, x: e.x, y: e.y });
  }
  // A slow: the strongest slow on a troop wins; it wears off at its end time.
  function slowDown(s, e, f, dur, kind) {
    if (e.kind !== 'troop' || e.dead || e.tunnel) return;
    const active = e.slowEnd > s.time;
    if (!active || f >= e.slowF) { e.slowF = f; e.slowKind = kind; }
    e.slowEnd = Math.max(active ? e.slowEnd : 0, s.time + dur);
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
    // a troop on the end of a harpoon rope, or in the middle of a leap, is in the air over the river
    if (!u.air && !u.pulled && !u.reel && !u.leap && u.y > RIVER_TOP && u.y < RIVER_BOT) {
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
    if (u.targets === 'none') return null;
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
    if (u.spin) {
      // a full-circle swing: every ground enemy around the troop (towers and buildings too)
      for (const e of s.ents) {
        if (e.dead || e.team === u.team || e.air) continue;
        if (e === t || edge(u, e) <= u.spin) damage(s, e, u.dmg, u.team);
      }
      s.events.push({ type: 'spin', card: u.card, team: u.team, x: u.x, y: u.y, r: u.spin + u.radius });
      return;
    }
    if (u.strike) {
      // lightning called down onto the building, splashing the ground around it
      damage(s, t, u.dmg, u.team);
      for (const o of s.ents) {
        if (o === t || o.dead || o.team === u.team || o.air || o.tunnel || o.kind === 'tower') continue;
        if (hyp(o.x - t.x, o.y - t.y) - o.radius <= u.strike) damage(s, o, u.dmg, u.team);
      }
      s.events.push({ type: 'strike', card: u.card, team: u.team, x: t.x, y: t.y, fx: u.x, fy: u.y, r: u.strike });
      return;
    }
    u.lastAtk = s.time;
    if (u.healHit) {
      // the Celestial Guardian: every swing heals the friendly troops around her, herself included
      let any = false;
      for (const o of s.ents) if (o.kind === 'troop' && o.team === u.team && !o.dead && !o.tunnel && hyp(o.x - u.x, o.y - u.y) <= u.healHit.r && heal(o, u.healHit.amount)) any = true;
      if (any) s.events.push({ type: 'healpulse', team: u.team, x: u.x, y: u.y, r: u.healHit.r });
    }
    if (u.pierce) {
      // the Prism Archer: a bolt that keeps flying in a straight line through everything in its way
      const dx = t.x - u.x, dy = t.y - u.y, d = hyp(dx, dy) || 1;
      s.projs.push({ kind: u.proj, team: u.team, x: u.x, y: u.y, sx: u.x, sy: u.y, dx: dx / d, dy: dy / d, left: u.range + u.radius + u.pierce.extra,
        speed: u.projSpeed, dmg: u.dmg, width: u.pierce.width, pierce: true, hitIds: [], targets: u.targets, card: u.card, tx: t.x, ty: t.y });
      s.events.push({ type: 'shoot', kind: u.proj, team: u.team, x: u.x, y: u.y });
      return;
    }
    if (u.proj) {
      s.projs.push({ kind: u.proj, team: u.team, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: t.x, ty: t.y,
        target: t.id, speed: u.projSpeed, dmg: u.dmg, splash: u.splash, targets: u.targets, card: u.card,
        air: u.air, zone: u.zone, evo: u.evo, stun: u.stunHit || 0, slowHit: u.slowHit || null });
      s.events.push({ type: 'shoot', kind: u.proj, team: u.team, x: u.x, y: u.y });
    } else {
      let dmg = u.dmg, charged = false;
      if (u.chargeHit && u.run >= u.chargeHit) { dmg *= 2; charged = true; }
      u.run = 0;
      if (t.kind === 'tower') dmg = Math.round(dmg * u.towerDmg);
      damage(s, t, dmg, u.team);
      if (u.meleeSplash) {
        // the Dread Knight's swing: every ground enemy around the one he hits
        for (const o of s.ents) {
          if (o === t || o.dead || o.team === u.team || o.air || o.tunnel || o.leap || o.kind === 'tower') continue;
          if (hyp(o.x - t.x, o.y - t.y) - o.radius <= u.meleeSplash) damage(s, o, u.dmg, u.team);
        }
      }
      s.events.push({ type: charged ? 'charge' : 'hit', card: u.card, team: u.team, x: t.x, y: t.y, by: u.id, r: u.meleeSplash || 0 });
    }
  }
  // Area damage on the ground around a spot (a landing knight, a sage arriving, a drill surfacing).
  function blast(s, team, x, y, r, dmg, card) {
    for (const o of s.ents) {
      if (o.dead || o.team === team || o.air || o.tunnel || o.leap) continue;
      if (hyp(o.x - x, o.y - y) - o.radius <= r) damage(s, o, dmg, team);
    }
    s.events.push({ type: 'slam', team, card, x, y, r });
  }
  // The Harpoon Captain: a hook thrown at a ground enemy 3.5 to 7 tiles away. A troop is reeled in to
  // him and slowed; a building or tower can't move, so he pulls himself to it instead.
  function hookStep(s, u, t, d) {
    const H = KC_CARDS[u.card].hook;
    u.hookCd -= DT;
    if (u.hookT > 0) {
      u.hookT -= DT;
      if (u.hookT <= 0) {
        u.hookT = 0; u.hookCd = H.cd;
        const tg = byId(s, u.hookAt);
        if (tg && canHit(u, tg)) {
          s.projs.push({ kind: 'hook', team: u.team, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: tg.x, ty: tg.y, target: tg.id, speed: H.speed, dmg: 0, hook: u.id, card: u.card });
          s.events.push({ type: 'hookthrow', team: u.team, x: u.x, y: u.y });
        }
      }
      return true;
    }
    if (u.hookCd > 0 || !t || t.air || d < H.min || d > H.max) return false;
    u.hookT = H.windup; u.hookAt = t.id; u.moving = false;
    return true;
  }
  function hooked(s, p, t) {
    const u = byId(s, p.hook), H = KC_CARDS.harpoon.hook;
    if (!u || u.dead || !t || t.dead) return;
    if (t.kind === 'troop') {
      t.pulled = { by: u.id, speed: 9 };
      slowDown(s, t, H.slow, H.slowDur + 0.6, 'hook');
      if (t.beam) { t.beamOn = 0; t.beamTime = 0; }
    } else u.reel = { to: t.id, speed: 9 };
    s.events.push({ type: 'hooked', team: u.team, x: t.x, y: t.y, id: t.id, by: u.id, self: t.kind !== 'troop' });
  }
  // The Dread Knight leaps at an enemy 3.5 to 5 tiles away (troops and buildings, not towers).
  function jumpStep(s, u, t, d) {
    const J = u.jump;
    if (J.ready > 0) J.ready -= DT;
    if (u.leap || J.ready > 0 || !t || t.kind === 'tower' || t.air || d < J.min || d > J.max) return false;
    u.leap = { sx: u.x, sy: u.y, tx: t.x, ty: t.y, t: 0, dur: J.time, tid: t.id };
    s.events.push({ type: 'jump', team: u.team, x: u.x, y: u.y, tx: t.x, ty: t.y });
    return true;
  }
  // The Camel Jockey's rider: lassos the nearest enemy troop in range while the camel goes on. Every
  // lasso hurts; one in every slowCd seconds also slows its target.
  function riderStep(s, u) {
    const R = u.rider;
    R.cd -= DT; R.snareCd -= DT; if (R.atk > 0) R.atk -= DT;
    if (R.cd > 0) return;
    let best = null, bd = Infinity;
    for (const e of s.ents) {
      if (e.kind !== 'troop' || !canHit({ team: u.team, targets: 'both', kind: 'troop' }, e)) continue;
      const d = edge(u, e);
      if (d <= R.range && d < bd) { bd = d; best = e; }
    }
    if (!best) { R.cd = 0.15; return; }
    R.cd = R.hit; R.atk = 0.4;
    const snare = R.snareCd <= 0;
    if (snare) R.snareCd = R.slowCd;
    s.projs.push({ kind: 'lasso', team: u.team, x: u.x, y: u.y - 0.4, sx: u.x, sy: u.y - 0.4, tx: best.x, ty: best.y, target: best.id,
      speed: 12, dmg: R.dmg, splash: 0, targets: 'both', card: u.card, from: u.id, slow: snare ? { f: R.slow, dur: R.slowDur } : null });
    s.events.push({ type: 'lasso', team: u.team, x: u.x, y: u.y });
  }
  function troopStep(s, u) {
    if (u.flash > 0) u.flash -= DT;
    if (u.tunnel) {
      // underground: straight to the spot, under the river and the towers, and nothing can hit it
      const dx = u.tunnel.tx - u.x, dy = u.tunnel.ty - u.y, d = hyp(dx, dy), step = KC_CARDS[u.card].burrow.speed * DT;
      u.moving = true;
      if (d > step) { u.x += (dx / d) * step; u.y += (dy / d) * step; if (Math.abs(dx) > 0.02) u.face = Math.sign(dx); return; }
      u.x = u.tunnel.tx; u.y = u.tunnel.ty; u.tunnel = null; u.moving = false;
      u.deploy = KC_CARDS[u.card].burrow.surface;
      s.events.push({ type: 'surface', team: u.team, card: u.card, x: u.x, y: u.y });
      return;
    }
    if (u.leap) {
      // mid-leap: in the air (untouchable) on its way to the landing spot
      const L = u.leap; L.t += DT;
      const f = Math.min(1, L.t / L.dur);
      u.x = L.sx + (L.tx - L.sx) * f; u.y = L.sy + (L.ty - L.sy) * f; u.moving = true;
      if (f >= 1) {
        u.leap = null; clampArena(u);
        blast(s, u.team, u.x, u.y, u.jump.r, u.jump.dmg, u.card);
        u.jump.ready = u.jump.cd; u.cd = Math.min(u.cd, u.hit * 0.4); u.target = L.tid; u.locked = false;
      }
      return;
    }
    if (u.deploy > 0) {
      u.deploy -= DT;
      // the Dread Knight lands, and the Winter Sage arrives, with a burst around them
      if (u.deploy <= 0 && u.deployBlast) blast(s, u.team, u.x, u.y, u.deployBlast.r, u.deployBlast.dmg, u.card);
      return;
    }
    if (u.hatch !== undefined) {
      // the Phoenix egg: if it lasts, the Phoenix comes back
      u.hatch -= DT;
      if (u.hatch <= 0) {
        u.dead = true;
        const ph = spawn(s, u.team, 'phoenix', u.x, u.y, false, u.level);
        ph.reborn = true; ph.deploy = 0.6;
        s.events.push({ type: 'hatch', team: u.team, x: u.x, y: u.y });
      }
      return;
    }
    if (u.pulled) {
      // on the end of the Harpoon Captain's rope: dragged to him, nothing else
      const by = byId(s, u.pulled.by);
      if (!by || by.dead) { u.pulled = null; clampArena(u); return; }
      const dx = by.x - u.x, dy = by.y - u.y, dd = hyp(dx, dy), stop = by.radius + u.radius + 0.25;
      if (dd <= stop + 0.05) { u.pulled = null; clampArena(u); return; }
      const st = Math.min(dd - stop, u.pulled.speed * DT);
      u.x += dx / dd * st; u.y += dy / dd * st; u.moving = false;
      return;
    }
    if (u.reel) {
      // the Harpoon Captain pulling himself along his rope to a building
      const to = byId(s, u.reel.to);
      if (!to || to.dead) { u.reel = null; return; }
      const dx = to.x - u.x, dy = to.y - u.y, dd = hyp(dx, dy), stop = to.radius + u.radius + 0.1;
      if (dd <= stop + 0.05) { u.reel = null; u.target = to.id; clampArena(u); return; }
      const st = Math.min(dd - stop, u.reel.speed * DT);
      u.x += dx / dd * st; u.y += dy / dd * st; u.moving = true;
      return;
    }
    if (stunned(s, u)) { u.moving = false; return; }
    if (u.atk > 0) u.atk -= DT;
    if (u.selfHeal && s.time - u.lastAtk > u.selfHeal.after) heal(u, u.selfHeal.dps * DT);
    if (u.chargeT !== undefined) u.chargeT = Math.min(KC_CARDS[u.card].charge, u.chargeT + DT);
    if (u.rider) riderStep(s, u);
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
    if (u.hookCd !== undefined && hookStep(s, u, t, d)) return;
    if (u.jump && jumpStep(s, u, t, d)) return;
    if (u.leapDmg !== undefined && d <= u.range) {
      // a sprite leaps onto its target and bursts (it is used up)
      const L = KC_CARDS[u.card].leap;
      u.dead = true; u.hp = 0;
      s.projs.push({ kind: u.card === 'sunsprite' ? 'sunleap' : 'frostleap', team: u.team, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: t.x, ty: t.y, target: t.id,
        speed: L.speed, dmg: u.leapDmg, splash: L.r, targets: 'both', card: u.card, leapStun: L.stun || 0,
        heal: L.heal ? { r: L.heal.r, amount: Math.round(L.heal.amount * levelMult(u.level)), dur: L.heal.dur } : null });
      s.events.push({ type: 'leap', team: u.team, card: u.card, x: u.x, y: u.y });
      return;
    }
    if (u.beam) {
      // once locked it holds a little past its range, and follows the target while beaming
      if (d <= u.range || (u.beamOn === t.id && d <= u.range + 0.8)) {
        // the beam holds on one target; it grows stronger every few seconds and starts over on a new one
        if (u.beamOn !== t.id) { u.beamOn = t.id; u.beamTime = 0; u.beamTick = 0; }
        if (Math.abs(t.x - u.x) > 0.05) u.face = Math.sign(t.x - u.x);
        u.locked = true; u.moving = false;
        u.beamTime += DT; u.beamTick += DT;
        if (u.beamTick >= u.hit - 1e-9) {
          u.beamTick -= u.hit;
          const stage = Math.min(u.beam.length - 1, Math.floor(u.beamTime / u.beamStage));
          damage(s, t, Math.max(1, Math.round(u.beam[stage] * u.hit)), u.team);
        }
        if (d > u.range * 0.8) moveStep(s, u, t);
        return;
      }
      u.beamOn = 0; u.beamTime = 0; u.beamTick = 0;
    }
    if (d <= u.range) {
      if (Math.abs(t.x - u.x) > 0.05) u.face = Math.sign(t.x - u.x);
      if (u.ram) {
        // the Ram Cart's charge ends against the building: up to double damage at full speed, then it
        // breaks apart and its soldiers fight on
        const f = 1 + Math.max(0, Math.min(1, (u.speed - u.baseSpeed) / (u.maxSpeed - u.baseSpeed)));
        let dmg = Math.round(u.dmg * f);
        if (t.kind === 'tower') dmg = Math.round(dmg * u.towerDmg);
        damage(s, t, dmg, u.team);
        s.events.push({ type: 'ram', card: u.card, team: u.team, x: t.x, y: t.y, power: f, cx: u.x, cy: u.y });
        u.dead = true; u.hp = 0;
        breakUp(s, u);
        return;
      }
      if (u.chargeT !== undefined) {
        // the Arc Cannon fires only with a full charge, then starts charging again
        if (u.chargeT >= KC_CARDS[u.card].charge - 1e-9) { attack(s, u, t); u.chargeT = 0; u.locked = true; }
        return;
      }
      if (u.cd <= 0) { attack(s, u, t); u.cd = u.hit; u.locked = true; }
      return;
    }
    if (u.locked && d > u.range + 0.6) u.locked = false;
    if (u.cd < u.hit * 0.5) u.cd = u.hit * 0.5;
    moveStep(s, u, t);
  }
  // Move a troop one tick toward its target (round towers, over the bridges), slowed if it is slowed.
  function moveStep(s, u, t) {
    const [nx, ny] = avoid(s, u, ...nav(u, t.x, t.y), t);
    const dx = nx - u.x, dy = ny - u.y, len = hyp(dx, dy);
    if (len > 0.001) {
      if (u.ram) u.speed = Math.min(u.maxSpeed, u.speed + u.accel * DT);
      const slow = u.slowEnd > s.time ? 1 - u.slowF : 1;
      const step = Math.min(len, u.speed * slow * DT);
      u.run += step;
      u.x += (dx / len) * step;
      u.y += (dy / len) * step;
      if (Math.abs(dx) > 0.02) u.face = Math.sign(dx);
      u.moving = true;
    }
  }
  function towerStep(s, e) {
    if (e.flash > 0) e.flash -= DT;
    if (!e.active || stunned(s, e)) return;
    e.cd -= DT;
    let t = byId(s, e.target);
    if (!t || t.dead || t.kind === 'tower' || t.hidden || t.leap || edge(e, t) > e.range) {
      t = null; e.target = 0;
      let bd = Infinity;
      for (const u of s.ents) {
        if ((u.kind !== 'troop' && u.kind !== 'building') || u.team === e.team || u.dead || u.tunnel || u.leap || u.hidden) continue;
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
    const c = KC_CARDS[b.card];
    if (b.tunnel) {
      // the Crystal Drill underground: straight to the spot, under the river and the towers
      const dx = b.tunnel.tx - b.x, dy = b.tunnel.ty - b.y, d = hyp(dx, dy), step = c.burrow.speed * DT;
      if (d > step) { b.x += (dx / d) * step; b.y += (dy / d) * step; return; }
      b.x = b.tunnel.tx; b.y = b.tunnel.ty; b.tunnel = null; b.deploy = c.burrow.surface;
      // it bursts out of the ground, hurting what stands on the spot, and pushes troops off its footprint
      blast(s, b.team, b.x, b.y, c.emerge.r, Math.round(c.emerge.dmg * levelMult(b.level)), b.card);
      s.events.push({ type: 'surface', team: b.team, card: b.card, x: b.x, y: b.y });
      return;
    }
    if (b.deploy > 0) { b.deploy -= DT; return; }
    b.hp -= b.decay * DT;
    if (b.hp <= 0) {
      b.hp = 0; b.dead = true;
      buildingGone(s, b);
      return;
    }
    if (stunned(s, b)) return;
    if (c.spawner) {
      // a spawner: one unit every few seconds
      b.spawnT -= DT;
      if (b.spawnT <= 0) { b.spawnT += c.spawner.every; spawnFrom(s, b, c.spawner.card, 0); s.events.push({ type: 'spawn', team: b.team, card: b.card, x: b.x, y: b.y }); }
    }
    if (!b.dmg) return;
    if (b.atk > 0) b.atk -= DT;
    b.cd -= DT;
    if (c.hide) {
      // the Coil Tower: hidden (troops can't target it) until an enemy comes in range; then it rises,
      // which takes a moment, fights, and sinks back once nothing has been in range for a second
      let near = false;
      for (const u of s.ents) if (canHit(b, u) && edge(b, u) <= b.range) { near = true; break; }
      if (b.hidden) {
        if (!near) return;
        b.hidden = false; b.rise = c.hide.rise; b.idle = 0;
        s.events.push({ type: 'rise', team: b.team, card: b.card, x: b.x, y: b.y });
        return;
      }
      if (b.rise > 0) { b.rise -= DT; return; }
      if (!near) {
        b.idle += DT;
        if (b.idle >= c.hide.idle) { b.hidden = true; b.target = 0; s.events.push({ type: 'hide', team: b.team, card: b.card, x: b.x, y: b.y }); }
        return;
      }
      b.idle = 0;
    }
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
    // where it aims (a direction, for drawing the barrel); the muzzle is 0.7 tiles along it
    const ax = t.x - b.x, ay = t.y - b.y, al = hyp(ax, ay) || 1;
    b.aimX = ax / al; b.aimY = ay / al;
    if (b.cd <= 0) {
      b.cd = b.hit; b.atk = 0.25;
      const mx = b.x + b.aimX * 0.7, my = b.y + b.aimY * 0.7 - 0.3;
      s.projs.push({ kind: b.proj, team: b.team, x: mx, y: my, sx: mx, sy: my, tx: t.x, ty: t.y, target: t.id,
        speed: b.projSpeed, dmg: b.dmg, splash: 0, targets: b.targets, card: b.card, from: b.id });
      s.events.push({ type: 'shoot', kind: b.proj, team: b.team, x: b.x, y: b.y });
    }
  }

  /* ---------- projectiles ---------- */
  function projStep(s) {
    for (const p of s.projs) {
      if (p.pierce) { pierceStep(s, p); continue; }
      const t = byId(s, p.target);
      if (t && !t.dead) { p.tx = t.x; p.ty = t.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = hyp(dx, dy), step = p.speed * DT;
      if (d > step) { p.x += (dx / d) * step; p.y += (dy / d) * step; continue; }
      p.x = p.tx; p.y = p.ty; p.done = true;
      if (p.hook) { hooked(s, p, t); continue; }
      if (p.spell) spellHit(s, p);
      else if (p.splash) {
        for (const e of s.ents) {
          if (e.dead || e.team === p.team || e.tunnel || e.leap) continue;
          if (p.targets === 'ground' && e.air) continue;
          if (hyp(e.x - p.x, e.y - p.y) - e.radius > p.splash) continue;
          damage(s, e, p.dmg, p.team);
          if (e.dead) continue;
          if (p.leapStun) stun(s, e, p.leapStun, 'freeze');
          if (p.slowHit) slowDown(s, e, p.slowHit.f, p.slowHit.dur, 'frost');
        }
        // the Sun Sprite's burst of light heals friendly troops around it for a second
        if (p.heal) { s.zones.push({ x: p.x, y: p.y, r: p.heal.r, team: p.team, dps: 0, heal: p.heal.amount / p.heal.dur, left: p.heal.dur, dur: p.heal.dur, pulse: 0, kind: 'heal', targets: 'both' }); }
        // broken pottery (and the like) keeps hurting the spot for a moment
        if (p.zone) s.zones.push({ x: p.x, y: p.y, r: p.zone.r, team: p.team, dps: p.zone.dps, left: p.zone.dur, dur: p.zone.dur, pulse: 0, kind: p.kind, targets: p.targets });
        s.events.push({ type: 'splash', kind: p.kind, x: p.x, y: p.y, r: p.splash });
      } else if (t && !t.dead) {
        damage(s, t, p.dmg, p.team);
        if (p.stun && !t.dead) stun(s, t, p.stun, 'zap');
        if (p.slow && !t.dead) { slowDown(s, t, p.slow.f, p.slow.dur, 'lasso'); s.events.push({ type: 'snare', team: p.team, x: t.x, y: t.y, id: t.id }); }
        s.events.push({ type: 'hit', kind: p.kind, team: p.team, x: p.x, y: p.y });
      }
    }
    s.projs = s.projs.filter(p => !p.done);
  }
  // The Prism Archer's bolt: straight on from where it was shot, hitting each enemy it passes once.
  function pierceStep(s, p) {
    const step = Math.min(p.left, p.speed * DT), x0 = p.x, y0 = p.y;
    p.x += p.dx * step; p.y += p.dy * step; p.left -= step;
    for (const e of s.ents) {
      if (e.dead || e.team === p.team || e.tunnel || e.leap || e.hidden || p.hitIds.includes(e.id)) continue;
      if (p.targets === 'ground' && e.air) continue;
      // distance from the enemy to the bit of line flown this tick
      const vx = p.x - x0, vy = p.y - y0, l2 = vx * vx + vy * vy || 1e-9;
      const f = Math.max(0, Math.min(1, ((e.x - x0) * vx + (e.y - y0) * vy) / l2));
      if (hyp(e.x - (x0 + vx * f), e.y - (y0 + vy * f)) > e.radius + p.width) continue;
      p.hitIds.push(e.id);
      damage(s, e, p.dmg, p.team);
      s.events.push({ type: 'hit', kind: p.kind, team: p.team, x: e.x, y: e.y });
    }
    if (p.left <= 1e-9 || p.x < -1 || p.x > W + 1 || p.y < -1 || p.y > H + 1) p.done = true;
  }
  // A spell landing: area damage (reduced on towers), and a knockback if the spell has one; a Boarding
  // Barrel breaks open and lets its pirates out.
  function spellHit(s, p) {
    const c = KC_CARDS[p.spell] || KC_CARDS.fireball;
    if (c.barrel) {
      const offs = formation(c.barrel.n);
      for (const [ox, oy] of offs) { const u = spawn(s, p.team, c.barrel.card, p.x + ox, p.y + (p.team === 0 ? oy : -oy), false, p.level); u.deploy = 0.4; }
      s.events.push({ type: 'barrel', team: p.team, card: c.id, x: p.x, y: p.y });
      return;
    }
    for (const e of s.ents) {
      if (e.dead || e.team === p.team) continue;
      const d = hyp(e.x - p.x, e.y - p.y);
      if (d - e.radius > c.area) continue;
      damage(s, e, e.kind === 'tower' ? Math.round(p.dmg * c.towerPct) : p.dmg, p.team);
      if (c.knockback && e.kind === 'troop' && !e.dead && !e.heavy) {
        if (e.beam) { e.beamOn = 0; e.beamTime = 0; }
        const k = c.knockback / Math.max(1, e.mass / 2);
        const nx = d > 0.01 ? (e.x - p.x) / d : 0, ny = d > 0.01 ? (e.y - p.y) / d : (e.team === 0 ? 1 : -1);
        e.x += nx * k; e.y += ny * k;
        clampArena(e);
      }
    }
    s.events.push({ type: 'boom', team: p.team, card: c.id, x: p.x, y: p.y, r: c.area });
  }
  // Lingering damage areas, in pulses of a tenth of a second.
  function zoneStep(s) {
    for (const z of s.zones) {
      z.left -= DT; z.pulse += DT;
      if (z.gate) { gateStep(s, z); continue; }
      if (z.pulse < 0.1 - 1e-9) continue;
      z.pulse -= 0.1;
      if (z.heal) {
        // a healing glow: friendly troops inside get back health every tenth of a second
        for (const e of s.ents) if (e.kind === 'troop' && e.team === z.team && !e.dead && !e.tunnel && hyp(e.x - z.x, e.y - z.y) - e.radius <= z.r) heal(e, Math.max(1, Math.round(z.heal * 0.1)));
        continue;
      }
      const amount = Math.max(1, Math.round(z.dps * 0.1));
      for (const e of s.ents) {
        if (e.dead || e.team === z.team || (z.targets === 'ground' && e.air)) continue;
        if (hyp(e.x - z.x, e.y - z.y) - e.radius > z.r) continue;
        damage(s, e, e.kind === 'tower' && z.towerPct ? Math.max(1, Math.round(amount * z.towerPct)) : amount, z.team, true);
        if (z.slow) slowDown(s, e, z.slow, 0.25, 'sand');
      }
    }
    s.zones = s.zones.filter(z => z.left > 1e-9);
  }
  // The Abyss Gate: a wraith climbs out somewhere inside the circle on a steady beat.
  function gateStep(s, z) {
    const G = z.gate;
    z.age += DT;
    while (G.done < G.n && z.age >= G.next - 1e-9) {
      G.done++; G.next += G.every;
      let x = z.x, y = z.y;
      for (let i = 0; i < 8; i++) {
        const a = s.rand() * 2 - 1, b = s.rand() * 2 - 1;
        if (a * a + b * b > 1) { i--; continue; }
        x = z.x + a * (z.r - 0.4); y = z.y + b * (z.r - 0.4);
        const inRiver = y > RIVER_TOP && y < RIVER_BOT && !BRIDGES.some(bx => Math.abs(x - bx) < BRIDGE_HALF);
        if (!inRiver && !inTower(s, x, y, 0.2) && x > 0.4 && x < W - 0.4 && y > 0.4 && y < H - 0.4) break;
      }
      const u = spawn(s, z.team, G.card, x, y, false, G.level);
      u.deploy = 0.5;
      s.events.push({ type: 'rise', team: z.team, card: G.card, x: u.x, y: u.y });
    }
  }

  /* ---------- pushing apart ---------- */
  function collide(s) {
    const troops = s.ents.filter(e => e.kind === 'troop' && !e.dead && !e.tunnel && !e.leap && !e.pulled && !e.reel);
    for (let i = 0; i < troops.length; i++) {
      const a = troops[i];
      for (let j = i + 1; j < troops.length; j++) {
        const b = troops[j];
        if (a.air !== b.air) continue;
        let dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
        const min = (a.radius + b.radius) * 0.9;
        if (d >= min) continue;
        if (d < 0.001) { dx = ((a.id * 7919) % 13) / 13 - 0.5 || 0.1; dy = 0.3; d = hyp(dx, dy); }
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
    if (!s.result) zoneStep(s);
    collide(s);
    s.ents = s.ents.filter(e => e.kind === 'tower' || !e.dead);
    if (!s.result) clock(s);
  }

  return {
    W, H, MID, RIVER_TOP, RIVER_BOT, BRIDGES, BRIDGE_HALF, DT, REGULAR, OVERTIME, MAX_ENERGY, TOWERS,
    create, step, play, canDeploy, tower, laneOf, own, mulberry, levelMult, evoCharge, formation,
    // Ends a match on the spot: the Simulate Win test button (TEMPORARY), and an online battle whose
    // opponent left ('left') or fell out of step ('desync').
    forceEnd: (s, winner, reason) => finish(s, winner, reason || 'test'),
  };
})();
