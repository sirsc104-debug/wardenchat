/* Putt Club: ball physics. Pure data, no three.js, so it also runs under Node for the hole tests.
   The ball rolls on the course in 2D (x, y) and keeps a height z for ramps, drops and jumps. */
(function (mod) { const PC = window.PC = window.PC || {}; mod(PC); (PC.SRC = PC.SRC || []).push(mod); })(function (PC) {
  'use strict';
  const U = PC.U;

  const C = PC.C = {
    R: 0.12,          // ball radius
    CUP_R: 0.27,      // cup radius
    G: 18,            // gravity in flight
    GS: 11,           // how hard slopes pull a rolling ball
    FRIC: 1.5,        // rolling resistance
    LIN: 0.28,        // drag that grows with speed
    MAXV: 12.5,       // full-power putt
    DT: 1 / 240,
    SINK_V: 3.4,      // faster than this and the ball skims over the cup
    RAIL_H: 0.28,
    WATER_TOP: -0.2,
    WATER_BED: -0.55,
  };

  const ZONE_FRIC = { slime: 0.2, honey: 7, soil: 1.35, seeds: 1.05, sand: 3, moss: 1.15, glass: 0.2, tar: 7, ash: 1.3, cinder: 2.4, ice: 0.16, snow: 8 };
  PC.ZONE_FRIC = ZONE_FRIC;

  // Turn a hole design into the shape the simulator and renderer share.
  PC.prepareHole = function (spec) {
    if (spec._prepared) return spec;
    const hole = Object.assign({}, spec);
    hole.height = spec.height || (() => 0);
    hole.floors = spec.floors.map(f => {
      const o = Array.isArray(f) ? { poly: f } : Object.assign({}, f);
      o.poly = U.ccw(o.poly);
      o.holes = (o.holes || []).map(U.cw);
      return o;
    });
    hole.hazards = (spec.hazards || []).map(z => Object.assign({ kind: 'water', top: C.WATER_TOP, bed: C.WATER_BED }, z.kind === 'chasm' ? { top: -0.3, bed: -9 } : {}, z, { poly: U.ccw(z.poly) }));
    hole.overHazards = hole.hazards.filter(z => z.over);
    hole.zones = (spec.zones || []).map(z => Object.assign({}, z, { poly: U.ccw(z.poly), fric: z.fric || ZONE_FRIC[z.type] || 1 }));
    const look = hole.look = Object.assign({ rail: 'timber', light: 'day' }, spec.look || {});
    let rails = spec.rails;
    // Abyss holes float over nothing: no rails unless the hole asks for them.
    if (!rails) rails = look.theme === 'abyss' ? [] : [{ pts: hole.floors[0].poly, closed: true }];
    hole.rails = rails.map(r => Object.assign({ side: 'out', h: C.RAIL_H, w: 0.2, style: look.rail, e: 0.72 }, r));
    (spec.walls || []).forEach(w => hole.rails.push(Object.assign({ side: 'center', closed: false, h: 0.5, w: 0.3, style: 'hedge', e: 0.6 }, w)));
    hole.posts = (spec.posts || []).map(p => Object.assign({ h: 0.5, e: 0.6, style: 'rock' }, p));

    // Physics segments for every rail and wall.
    hole.segs = [];
    hole.rails.forEach(r => {
      const P = r.pts, n = r.closed ? P.length : P.length - 1;
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        hole.segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], nx: dy / l, ny: -dx / l, r: r.side === 'center' ? r.w / 2 : 0, h: r.h, top: r.top, e: r.e, ghost: r.ghost });
      }
    });
    const all = hole.floors.map(f => f.poly).concat(hole.hazards.map(z => z.poly));
    hole.box = U.bounds(all);
    hole._prepared = true;
    return hole;
  };

  class Sim {
    constructor(hole, opts) {
      this.hole = PC.prepareHole(hole);
      this.opts = opts || {};
      this.assist = this.opts.assist || 1;
      this.t = 0;
      this.steps = 0;       // physics steps since the hole began (online replays start putts on the same step)
      this.events = [];
      this.feats = (this.hole.features || []).map(f => {
        const def = PC.FEAT[f.type];
        if (!def) throw new Error('Unknown feature ' + f.type);
        const o = def.make(f, this.hole);
        o.spec = f; o.type = f.type;
        return o;
      });
      this.surfFeats = this.feats.filter(f => f.surface);
      this.modFeats = this.feats.filter(f => f.heightMod);
      this.fricFeats = this.feats.filter(f => f.fric);
      this.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mode: 'roll', rest: 1, timer: 0, hidden: false, lipped: false };
      this.feats.forEach(f => f.update && f.update(0, this));
      this.place(this.hole.tee[0], this.hole.tee[1]);
    }

    emit(e) { this.events.push(e); }

    place(x, y) {
      const b = this.ball, g = this.ground(x, y);
      Object.assign(b, { x, y, z: g.h + C.R, vx: 0, vy: 0, vz: 0, mode: 'roll', rest: 1, timer: 0, hidden: false, lipped: false });
      this.safe = [x, y];
    }

    floorAt(x, y) {
      const F = this.hole.floors;
      for (let i = 0; i < F.length; i++) {
        const f = F[i];
        if (!U.inPoly(x, y, f.poly)) continue;
        let inHole = false;
        for (let j = 0; j < f.holes.length; j++) if (U.inPoly(x, y, f.holes[j])) { inHole = true; break; }
        if (!inHole) return f;
      }
      return null;
    }

    floorHeight(x, y) {
      let h = this.hole.height(x, y, this.t);
      for (let i = 0; i < this.modFeats.length; i++) h += this.modFeats[i].heightMod(x, y, this.t, this);
      return h;
    }

    // Height of the course surface ignoring moving platforms; walls stand on this.
    groundRaw(x, y) {
      if (this.floorAt(x, y)) return this.floorHeight(x, y);
      const hz = this.hazardAt(x, y);
      if (hz) return hz.top;
      return this.floorHeight(x, y);
    }

    hazardAt(x, y) {
      const H = this.hole.hazards;
      for (let i = 0; i < H.length; i++) if (U.inPoly(x, y, H[i].poly)) return H[i];
      return null;
    }

    zoneFric(x, y) {
      let k = 1;
      const Z = this.hole.zones;
      for (let i = 0; i < Z.length; i++) if (U.inPoly(x, y, Z[i].poly)) { k = Z[i].fric; break; }
      for (let i = 0; i < this.fricFeats.length; i++) { const f = this.fricFeats[i].fric(x, y, this.t, this); if (f) k *= f; }
      return k;
    }

    ground(x, y) {
      for (let i = 0; i < this.surfFeats.length; i++) {
        const s = this.surfFeats[i].surface(x, y, this.t, this);
        if (s) return s;
      }
      // Pools of lava set into a green follow the green's height.
      const O = this.hole.overHazards;
      for (let i = 0; i < O.length; i++) {
        if (!U.inPoly(x, y, O[i].poly)) continue;
        const fh = O[i].level !== undefined ? O[i].level : this.floorHeight(x, y);
        return { kind: O[i].kind, h: fh - 0.45, top: fh - 0.05, hazard: O[i] };
      }
      if (this.floorAt(x, y)) return { kind: 'floor', h: this.floorHeight(x, y), fric: this.zoneFric(x, y) };
      const hz = this.hazardAt(x, y);
      if (hz) return { kind: hz.kind, h: hz.bed, top: hz.top, hazard: hz };
      return { kind: 'void', h: -6, top: -1 };
    }

    grad(x, y, g) {
      if (g.gx !== undefined) return [g.gx, g.gy];
      const e = 0.015;
      return [(this.floorHeight(x + e, y) - this.floorHeight(x - e, y)) / (2 * e), (this.floorHeight(x, y + e) - this.floorHeight(x, y - e)) / (2 * e)];
    }

    cupPos() {
      for (let i = 0; i < this.feats.length; i++) if (this.feats[i].cupPos) return this.feats[i].cupPos(this.t);
      return [this.hole.cup[0], this.hole.cup[1], 0, 0];
    }

    resting() { const b = this.ball; return b.mode === 'roll' && b.rest > 0.3; }
    speed() { const b = this.ball; return Math.hypot(b.vx, b.vy); }

    shoot(angle, power) {
      const b = this.ball;
      const g = this.ground(b.x, b.y);
      const cv = g.carry || [0, 0];
      const v = 0.5 + (C.MAXV - 0.5) * Math.pow(U.clamp(power, 0, 1), 1.15);
      b.vx = cv[0] + Math.cos(angle) * v;
      b.vy = cv[1] + Math.sin(angle) * v;
      b.rest = 0; b.lipped = false;
      if (g.kind === 'floor') this.safe = [b.x, b.y];
      this.emit({ type: 'putt', power });
    }

    tunnel(x, y, vx, vy, delay, info) {
      const b = this.ball;
      b.mode = 'tunnel'; b.hidden = true; b.timer = delay;
      b.exit = { x, y, vx, vy };
      this.emit(Object.assign({ type: 'tunnel' }, info));
    }

    // Walls, posts and moving things. Moving colliders pass their surface velocity (cvx, cvy).
    bounce(nx, ny, e, cvx, cvy, kind, kick) {
      const b = this.ball;
      let rvx = b.vx - cvx, rvy = b.vy - cvy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        rvx -= (1 + e) * vn * nx; rvy -= (1 + e) * vn * ny;
        const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
        rvx -= vt * 0.05 * tx; rvy -= vt * 0.05 * ty;
        if (kick) { rvx += nx * kick; rvy += ny * kick; }
        b.vx = rvx + cvx; b.vy = rvy + cvy;
        if (-vn > 0.25 || kick) this.emit({ type: kind || 'wall', speed: -vn, x: b.x, y: b.y });
      }
      b.rest = 0;
    }

    hitCircle(cx, cy, r, top, e, cvx, cvy, kind, kick) {
      const b = this.ball;
      let dx = b.x - cx, dy = b.y - cy;
      const d = Math.hypot(dx, dy), rr = r + C.R;
      if (d >= rr) return false;
      if (b.z - C.R * 0.6 > top) return false;
      if (d < 1e-6) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
      b.x = cx + dx * rr; b.y = cy + dy * rr;
      this.bounce(dx, dy, e, cvx || 0, cvy || 0, kind, kick);
      return true;
    }

    hitSeg(ax, ay, bx, by, r, top, e, cvx, cvy, kind, nx0, ny0) {
      const b = this.ball;
      const c = U.closestOnSeg(b.x, b.y, ax, ay, bx, by);
      let dx = b.x - c[0], dy = b.y - c[1];
      const d = Math.hypot(dx, dy), rr = r + C.R;
      if (d >= rr) return false;
      const tp = typeof top === 'function' ? top(c[0], c[1], this.t) : top;
      if (b.z - C.R * 0.6 > tp) return false;
      if (d < 1e-6) { dx = nx0 || 1; dy = ny0 || 0; } else { dx /= d; dy /= d; }
      b.x = c[0] + dx * rr; b.y = c[1] + dy * rr;
      this.bounce(dx, dy, e, cvx || 0, cvy || 0, kind);
      return true;
    }

    collide() {
      const b = this.ball, H = this.hole;
      for (let i = 0; i < H.segs.length; i++) {
        const s = H.segs[i];
        // quick reject
        const minx = Math.min(s.ax, s.bx) - s.r - 0.2, maxx = Math.max(s.ax, s.bx) + s.r + 0.2;
        if (b.x < minx || b.x > maxx) continue;
        const miny = Math.min(s.ay, s.by) - s.r - 0.2, maxy = Math.max(s.ay, s.by) + s.r + 0.2;
        if (b.y < miny || b.y > maxy) continue;
        const top = s.top || ((x, y) => this.groundRaw(x - s.nx * 0.01, y - s.ny * 0.01) + s.h);
        this.hitSeg(s.ax, s.ay, s.bx, s.by, s.r, top, s.e, 0, 0, 'wall', -s.nx, -s.ny);
      }
      for (let i = 0; i < H.posts.length; i++) {
        const p = H.posts[i];
        if (Math.abs(b.x - p.x) > p.r + 0.3 || Math.abs(b.y - p.y) > p.r + 0.3) continue;
        this.hitCircle(p.x, p.y, p.r, this.groundRaw(p.x, p.y) + p.h, p.e, 0, 0, p.kind || 'post', p.kick);
      }
      for (let i = 0; i < this.feats.length; i++) if (this.feats[i].collide) this.feats[i].collide(b, this);
    }

    step(dt) {
      dt = dt || C.DT;
      this.t += dt;
      this.steps++;
      const b = this.ball;
      for (let i = 0; i < this.feats.length; i++) if (this.feats[i].update) this.feats[i].update(this.t, this);
      if (b.mode === 'tunnel') {
        b.timer -= dt;
        if (b.timer <= 0) {
          const e = b.exit, g = this.ground(e.x, e.y);
          Object.assign(b, { x: e.x, y: e.y, z: g.h + C.R, vx: e.vx, vy: e.vy, vz: 0, mode: 'roll', hidden: false, rest: 0 });
          this.emit({ type: 'popout', x: e.x, y: e.y });
        }
        return;
      }
      if (b.mode !== 'roll' && b.mode !== 'air') { b.timer += dt; return; }
      if (b.mode === 'roll') this.roll(dt); else this.fly(dt);
    }

    roll(dt) {
      const b = this.ball;
      const g = this.ground(b.x, b.y);
      if (g.kind !== 'floor' && g.kind !== 'platform') { b.mode = 'air'; this.fly(dt); return; }
      const gr = this.grad(b.x, b.y, g);
      let ax = -C.GS * gr[0], ay = -C.GS * gr[1];
      for (let i = 0; i < this.feats.length; i++) {
        const f = this.feats[i];
        if (!f.force) continue;
        const F = f.force(b, this.t, this);
        if (F) { ax += F[0]; ay += F[1]; }
      }
      const cp = this.cupPos();
      const cdx = cp[0] - b.x, cdy = cp[1] - b.y, cd = Math.hypot(cdx, cdy);
      const relCup = Math.hypot(b.vx - cp[2], b.vy - cp[3]);
      const A = this.assist;
      if (cd < C.CUP_R + 0.1 * A && cd > 1e-4 && relCup < 1.8 * A) { ax += (cdx / cd) * 3.2 * A; ay += (cdy / cd) * 3.2 * A; }

      const cvx = g.carry ? g.carry[0] : 0, cvy = g.carry ? g.carry[1] : 0;
      b.vx += ax * dt; b.vy += ay * dt;
      let rvx = b.vx - cvx, rvy = b.vy - cvy;
      const sp = Math.hypot(rvx, rvy);
      const fr = C.FRIC * (g.fric || 1);
      const dec = (fr + C.LIN * sp * Math.min(g.fric || 1, 2.5)) * dt;
      let still = false;
      if (sp <= dec) { rvx = 0; rvy = 0; still = Math.hypot(ax, ay) < fr * 1.02; }
      else { const k = (sp - dec) / sp; rvx *= k; rvy *= k; }
      const lim = C.MAXV * 1.6, s2 = Math.hypot(rvx, rvy);
      if (s2 > lim) { rvx *= lim / s2; rvy *= lim / s2; }
      b.vx = rvx + cvx; b.vy = rvy + cvy;
      b.rest = still ? b.rest + dt : 0;

      const ox = b.x, oy = b.y, oz = b.z;
      b.x += b.vx * dt; b.y += b.vy * dt;
      this.collide();
      for (let i = 0; i < this.feats.length; i++) if (this.feats[i].onStep) this.feats[i].onStep(b, this);
      if (b.mode !== 'roll') return;

      // The cup.
      const cp2 = this.cupPos();
      const d2 = Math.hypot(cp2[0] - b.x, cp2[1] - b.y);
      const rel = Math.hypot(b.vx - cp2[2], b.vy - cp2[3]);
      if (d2 < C.CUP_R - C.R * 0.25) {
        if (rel < C.SINK_V) { this.sink(cp2); return; }
        if (!b.lipped) {
          b.lipped = true;
          // A lip-out: the deflection depends only on where and how the ball arrives, so previews match.
          const r = Math.sin(b.x * 127.1 + b.y * 311.7 + b.vx * 74.7 + b.vy * 19.3) * 43758.5453;
          const a = (r - Math.floor(r) - 0.5) * 0.4, c = Math.cos(a), s = Math.sin(a);
          const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
          b.vx = vx * 0.84; b.vy = vy * 0.84;
          this.emit({ type: 'lip' });
        }
      } else if (d2 > C.CUP_R + 0.06) b.lipped = false;

      const g2 = this.ground(b.x, b.y);
      if (g2.kind !== 'floor' && g2.kind !== 'platform') { b.mode = 'air'; b.z = oz; return; }
      const zg = g2.h + C.R;
      if (zg > oz + 0.09) { b.x = ox; b.y = oy; b.vx *= -0.35; b.vy *= -0.35; b.z = oz; return; }
      const zb = oz + b.vz * dt - 0.5 * C.G * dt * dt;
      if (zb > zg + 0.004 && (b.vz > 0.4 || zb - zg > 0.03)) { b.mode = 'air'; b.z = zb; b.vz -= C.G * dt; this.emit({ type: 'takeoff' }); return; }
      b.vz = U.clamp((zg - oz) / dt, -8, 8);
      b.z = zg;
    }

    fly(dt) {
      const b = this.ball;
      b.vz -= C.G * dt;
      const ox = b.x, oy = b.y, oz = b.z;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      this.collide();
      if (b.mode === 'lost') return;   // a cactus got it in mid-air
      const g = this.ground(b.x, b.y);
      if (g.kind === 'void') { if (b.z < -1.5) this.lose('oob'); return; }
      if (g.kind !== 'floor' && g.kind !== 'platform') {
        if (b.z < g.top) this.lose(g.kind === 'water' ? 'water' : g.kind);
        return;
      }
      const zg = g.h + C.R;
      if (b.z > zg) return;
      if (zg - oz > 0.16) { b.x = ox; b.y = oy; b.vx *= -0.4; b.vy *= -0.4; return; }
      const cp = this.cupPos();
      if (Math.hypot(cp[0] - b.x, cp[1] - b.y) < C.CUP_R && b.vz > -11 && Math.hypot(b.vx - cp[2], b.vy - cp[3]) < 7) { this.sink(cp); return; }
      b.z = zg;
      if (b.vz < -2.4) {
        b.vz = -b.vz * 0.3; b.vx *= 0.9; b.vy *= 0.9;
        this.emit({ type: 'land', speed: -b.vz });
      } else {
        b.vz = 0; b.mode = 'roll';
        this.emit({ type: 'land', speed: 0.5 });
      }
    }

    sink(cp) {
      const b = this.ball;
      b.mode = 'sunk'; b.timer = 0;
      b.cupX = cp[0]; b.cupY = cp[1];
      this.emit({ type: 'sink' });
    }

    lose(kind) {
      const b = this.ball;
      b.mode = 'lost'; b.lostKind = kind; b.timer = 0;
      this.emit({ type: 'lost', kind, x: b.x, y: b.y });
    }

    // Put the ball back where the last shot was taken from (after water or out of bounds).
    restore() {
      let [x, y] = this.safe;
      // If the spot has gone (thin ice that broke since), use the nearest bit of solid green instead.
      const ok = (px, py) => { const g = this.ground(px, py); return g.kind === 'floor' || g.kind === 'platform'; };
      if (!ok(x, y)) {
        let found = null;
        for (let d = 0.25; d < 8 && !found; d += 0.25) for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (ok(px, py) && ok(px + 0.15, py) && ok(px - 0.15, py) && ok(px, py + 0.15) && ok(px, py - 0.15)) { found = [px, py]; break; } }
        [x, y] = found || this.hole.tee;
      }
      this.place(x, y);
    }

    // Everything needed to rebuild this moment in another Sim (for rivals thinking in a worker).
    snapshot() {
      const copy = v => JSON.parse(JSON.stringify(v));
      return {
        t: this.t, steps: this.steps, ball: copy(this.ball), safe: this.safe.slice(),
        feats: this.feats.map(f => { const o = {}; Object.keys(f).forEach(k => { if (typeof f[k] !== 'function' && k !== 'spec' && k !== 'type' && k !== 'line') o[k] = f[k]; }); return copy(o); }),
      };
    }
    load(snap) {
      this.t = snap.t;
      this.steps = snap.steps || 0;
      this.feats.forEach((f, i) => Object.assign(f, snap.feats[i]));
      this.feats.forEach(f => f.update && f.update(this.t, this));
      Object.assign(this.ball, snap.ball);
      this.safe = snap.safe.slice();
      this.events.length = 0;
      return this;
    }
    clone() { return new Sim(this.hole, this.opts).load(this.snapshot()); }
  }
  PC.Sim = Sim;
  // The most strokes before you pick up: 8 in the garden, par + 5 in the Abyss.
  PC.maxStrokes = hole => (hole.par >= 6 ? hole.par + 5 : 8);
});
