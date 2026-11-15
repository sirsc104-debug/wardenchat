/* Putt Club: the moving and special parts of each hole (physics only; the look lives in vis.js).
   Each type makes an object with any of:
     update(t, sim)          move to time t
     surface(x, y, t, sim)   a platform under the ball: {kind:'platform', h, gx, gy, fric, carry:[vx,vy]}
     heightMod(x, y, t)      added to the floor height (a brook channel)
     fric(x, y, t)           multiplies rolling resistance
     force(ball, t, sim)     extra push on a rolling ball: [ax, ay]
     collide(ball, sim)      moving colliders
     onStep(ball, sim)       triggers: tunnels, launch pads, switches, boost pads
     cupPos(t)               a moving cup: [x, y, vx, vy] */
(function (mod) { const PC = window.PC = window.PC || {}; mod(PC); (PC.SRC = PC.SRC || []).push(mod); })(function (PC) {
  'use strict';
  const U = PC.U, C = PC.C, TAU = U.TAU;
  const F = PC.FEAT = {};
  const moving = b => Math.hypot(b.vx, b.vy) > 0.2;

  // Pinwheel vanes turning around a post like a revolving door.
  F.spinner = { make(s) {
    return {
      ang: 0,
      update(t) { this.ang = (s.phase || 0) + s.omega * t; },
      vanes() {
        const out = [];
        for (let i = 0; i < s.arms; i++) { const a = this.ang + (i * TAU) / s.arms; out.push([s.x + Math.cos(a) * s.len, s.y + Math.sin(a) * s.len]); }
        return out;
      },
      collide(b, sim) {
        if (Math.hypot(b.x - s.x, b.y - s.y) > s.len + 0.4) return;
        const top = sim.groundRaw(s.x, s.y) + (s.h || 0.9);
        sim.hitCircle(s.x, s.y, 0.22, top, 0.5, 0, 0, 'post');
        this.vanes().forEach(e => {
          const c = U.closestOnSeg(b.x, b.y, s.x, s.y, e[0], e[1]);
          const cvx = -s.omega * (c[1] - s.y), cvy = s.omega * (c[0] - s.x);
          sim.hitSeg(s.x, s.y, e[0], e[1], (s.w || 0.12) / 2, top, 0.55, cvx, cvy, 'paddle');
        });
      },
    };
  } };

  // A turning sprinkler: its jet pushes a rolling ball outward.
  F.sprinkler = { make(s) {
    return {
      ang: 0,
      update(t) { this.ang = (s.phase || 0) + s.omega * t; },
      force(b) {
        if (!moving(b) || b.mode !== 'roll') return null;
        const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy);
        if (d > s.range || d < 0.25) return null;
        const da = Math.abs(U.wrapAngle(Math.atan2(dy, dx) - this.ang));
        const hw = s.spread || 0.26;
        if (da > hw) return null;
        const k = s.power * (1 - da / hw) * (1 - (0.5 * d) / s.range);
        return [(dx / d) * k, (dy / d) * k];
      },
      collide(b, sim) { sim.hitCircle(s.x, s.y, 0.24, sim.groundRaw(s.x, s.y) + 0.5, 0.6, 0, 0, 'post'); },
    };
  } };

  // A lily pad that ferries the ball across a pond, pausing at each shore.
  F.ferry = { make(s) {
    const cyc = 2 * (s.travel + s.pause);
    return {
      x: s.a[0], y: s.a[1], vx: 0, vy: 0, f: 0,
      update(t) {
        const u = (((t + (s.phase || 0)) % cyc) + cyc) % cyc;
        let f, df;
        if (u < s.pause) { f = 0; df = 0; }
        else if (u < s.pause + s.travel) { const k = (u - s.pause) / s.travel; f = U.ease(k); df = U.dEase(k) / s.travel; }
        else if (u < 2 * s.pause + s.travel) { f = 1; df = 0; }
        else { const k = (u - 2 * s.pause - s.travel) / s.travel; f = 1 - U.ease(k); df = -U.dEase(k) / s.travel; }
        this.f = f;
        this.x = U.lerp(s.a[0], s.b[0], f); this.y = U.lerp(s.a[1], s.b[1], f);
        this.vx = (s.b[0] - s.a[0]) * df; this.vy = (s.b[1] - s.a[1]) * df;
      },
      surface(x, y) {
        const dx = x - this.x, dy = y - this.y;
        if (dx * dx + dy * dy > s.r * s.r) return null;
        return { kind: 'platform', h: s.h === undefined ? -0.03 : s.h, gx: 0, gy: 0, fric: 1.1, carry: [this.vx, this.vy] };
      },
    };
  } };

  // Mole burrows joined in pairs: roll into one, pop out of the other.
  F.tunnels = { make(s) {
    return {
      cool: -1, pops: s.pairs.map(() => [-9, -9]),
      onStep(b, sim) {
        if (b.mode !== 'roll' || sim.t < this.cool) return;
        for (let i = 0; i < s.pairs.length; i++) {
          const p = s.pairs[i];
          for (let end = 0; end < 2; end++) {
            const e = end ? p.b : p.a, o = end ? p.a : p.b;
            if (Math.hypot(b.x - e[0], b.y - e[1]) > (s.r || 0.32)) continue;
            const sp = Math.hypot(b.vx, b.vy);
            if (sp > 8.5) continue;
            const dir = end ? p.dirA : p.dirB;
            const out = Math.max(sp * 0.9, 2.6);
            sim.tunnel(o[0] + Math.cos(dir) * 0.5, o[1] + Math.sin(dir) * 0.5, Math.cos(dir) * out, Math.sin(dir) * out, 0.75, { pair: i, end });
            this.pops[i][end ? 0 : 1] = sim.t + 0.75;
            this.cool = sim.t + 1.4;
            return;
          }
        }
      },
    };
  } };

  // Things that walk back and forth (gnomes, a snail).
  F.patrol = { make(s) {
    const movers = s.movers.map(m => Object.assign({ x: m.a[0], y: m.a[1], vx: 0, vy: 0, r: 0.36, h: 0.8 }, m));
    return {
      movers,
      update(t) {
        movers.forEach(m => {
          const w = TAU / m.period, u = w * t + (m.phase || 0) * TAU;
          const f = 0.5 - 0.5 * Math.cos(u), df = 0.5 * w * Math.sin(u);
          m.x = U.lerp(m.a[0], m.b[0], f); m.y = U.lerp(m.a[1], m.b[1], f);
          m.vx = (m.b[0] - m.a[0]) * df; m.vy = (m.b[1] - m.a[1]) * df;
        });
      },
      collide(b, sim) {
        movers.forEach(m => {
          if (sim.hitCircle(m.x, m.y, m.r, sim.groundRaw(m.x, m.y) + m.h, 0.75, m.vx, m.vy, s.sound || 'bonk')) m.hit = sim.t;
        });
      },
    };
  } };

  // Pinball bumpers: springy and they kick the ball away.
  F.bumpers = { make(s) {
    const list = s.list.map(p => Object.assign({ hit: -9, kick: 2.6, h: 0.6 }, p));
    return {
      list,
      collide(b, sim) {
        list.forEach(p => { if (sim.hitCircle(p.x, p.y, p.r, sim.groundRaw(p.x, p.y) + p.h, 0.95, 0, 0, 'bumper', p.kick)) p.hit = sim.t; });
      },
    };
  } };

  // A springy mushroom cap that throws the ball into the air.
  F.launch = { make(s) {
    return {
      cool: -1, hit: -9,
      onStep(b, sim) {
        if (b.mode !== 'roll' || sim.t < this.cool) return;
        if (Math.hypot(b.x - s.x, b.y - s.y) > s.r) return;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp < 0.35) return;
        const k = U.clamp(sp, s.minSpeed || 3, s.maxSpeed || 99) / sp;
        b.vx *= k; b.vy *= k;
        b.mode = 'air'; b.vz = s.vz; b.z += 0.02;
        this.hit = sim.t; this.cool = sim.t + 0.6;
        sim.emit({ type: 'launch' });
      },
    };
  } };

  // A brook running through the green: a shallow channel whose current carries the ball.
  F.brook = { make(s) {
    const line = U.catmull(s.line, 10);
    const hw = s.width / 2;
    let cache = { x: NaN, y: NaN, i: null };
    const info = (x, y) => {
      if (x === cache.x && y === cache.y) return cache.i;
      const i = U.polyInfo(x, y, line);
      cache = { x, y, i };
      return i;
    };
    return {
      line,
      heightMod(x, y) {
        const i = info(x, y);
        if (i.d > hw) return 0;
        return -s.depth * (1 - U.smooth(hw * 0.4, hw, i.d)) * (1 - U.smooth(0.94, 1, i.along / i.total));
      },
      fric(x, y) { return info(x, y).d < hw * 0.7 ? 1.25 : 0; },
      force(b) {
        if (b.mode !== 'roll') return null;
        const i = info(b.x, b.y);
        if (i.d > hw * 0.85) return null;
        const fade = 1 - U.smooth(0.8, 0.97, i.along / i.total);
        const k = s.flow * fade * (1 - i.d / (hw * 0.85));
        // a little pull toward the middle of the stream too
        const cx = i.x - b.x, cy = i.y - b.y;
        return [i.tx * k + cx * 1.5 * fade, i.ty * k + cy * 1.5 * fade];
      },
    };
  } };

  // A tire swinging across the fairway on a rope.
  F.swing = { make(s) {
    return {
      th: 0, xc: s.x, zc: 0, vx: 0,
      update(t) {
        const w = TAU / s.period, u = w * t + (s.phase || 0);
        this.th = s.amp * Math.sin(u);
        const dth = s.amp * w * Math.cos(u);
        this.xc = s.x + s.len * Math.sin(this.th);
        this.zc = s.zp - s.len * Math.cos(this.th);
        this.vx = s.len * Math.cos(this.th) * dth;
        this.vz = s.len * Math.sin(this.th) * dth;
      },
      collide(b, sim) {
        const dz = b.z - this.zc, rt = s.rt;
        if (Math.abs(dz) >= rt + C.R * 0.5) return;
        const hw = Math.sqrt(Math.max(0, (rt + C.R * 0.5) ** 2 - dz * dz));
        if (sim.hitSeg(this.xc - hw, s.y, this.xc + hw, s.y, 0.12, 99, 0.55, this.vx, 0, 'tire')) this.hit = sim.t;
      },
    };
  } };

  // Gusts of wind that push a rolling ball.
  F.wind = { make(s) {
    return {
      gust: 0, warn: 0,
      update(t) {
        const u = (((t + (s.phase || 0)) % s.period) + s.period) % s.period;
        this.gust = u < s.gust ? Math.pow(Math.sin((Math.PI * u) / s.gust), 2) : 0;
        this.warn = u > s.period - 1.2 ? (u - (s.period - 1.2)) / 1.2 : 0;
        this.u = u;
      },
      force(b) {
        if (!this.gust || !moving(b)) return null;
        return [s.dir[0] * s.power * this.gust, s.dir[1] * s.power * this.gust];
      },
    };
  } };

  // A turning flowerbed that carries the ball around, with pots riding on it.
  F.turntable = { make(s) {
    return {
      ang: 0,
      update(t) { this.ang = s.omega * t; },
      surface(x, y) {
        const dx = x - s.x, dy = y - s.y;
        if (dx * dx + dy * dy > s.r * s.r) return null;
        return { kind: 'platform', h: 0, gx: 0, gy: 0, fric: 1, carry: [-s.omega * dy, s.omega * dx] };
      },
      pots() { return (s.pots || []).map(p => { const a = this.ang + p.a; return { x: s.x + Math.cos(a) * p.d, y: s.y + Math.sin(a) * p.d, r: p.r }; }); },
      collide(b, sim) {
        this.pots().forEach(p => sim.hitCircle(p.x, p.y, p.r, 0.6, 0.6, -s.omega * (p.y - s.y), s.omega * (p.x - s.x), 'post'));
      },
    };
  } };

  // The cup rides back and forth in a flowerpot.
  F.movingCup = { make(s) {
    return {
      x: s.a[0], y: s.a[1], vx: 0, vy: 0,
      update(t) {
        const w = TAU / s.period, u = w * t + (s.phase || 0);
        const f = 0.5 - 0.5 * Math.cos(u), df = 0.5 * w * Math.sin(u);
        this.x = U.lerp(s.a[0], s.b[0], f); this.y = U.lerp(s.a[1], s.b[1], f);
        this.vx = (s.b[0] - s.a[0]) * df; this.vy = (s.b[1] - s.a[1]) * df;
      },
      cupPos() { return [this.x, this.y, this.vx, this.vy]; },
    };
  } };

  // A plank bridge that rocks from side to side over a ditch.
  F.seesaw = { make(s) {
    return {
      th: 0,
      update(t) { this.th = s.amp * Math.sin((TAU * t) / s.period + (s.phase || 0)); },
      surface(x, y) {
        if (x < s.x0 || x > s.x1 || y < s.y0 || y > s.y1) return null;
        const k = Math.tan(this.th), cx = (s.x0 + s.x1) / 2;
        return { kind: 'platform', h: k * (x - cx), gx: k, gy: 0, fric: 1 };
      },
    };
  } };

  // Roll over the seed packet and a beanstalk grows a bridge over the pond for a while.
  F.beanstalk = { make(s) {
    return {
      t0: -99, t1: -99, grown: 0, pressed: -9,
      update(t) {
        let g = 0;
        if (t < this.t1) g = U.clamp((t - this.t0) / s.grow, 0, 1);
        else g = 1 - U.clamp((t - this.t1) / 0.9, 0, 1);
        this.grown = g;
        this.left = Math.max(0, this.t1 - t);
      },
      onStep(b, sim) {
        if (b.mode !== 'roll') return;
        if (Math.hypot(b.x - s.button[0], b.y - s.button[1]) > s.br) return;
        if (sim.t - this.pressed > 0.5) sim.emit({ type: 'switch' });
        this.pressed = sim.t;
        if (sim.t > this.t1) this.t0 = sim.t;
        this.t1 = sim.t + s.duration;
      },
      surface(x, y) {
        if (this.grown < 0.98) return null;
        const r = s.rect;
        if (x < r[0] || x > r[2] || y < r[1] || y > r[3]) return null;
        return { kind: 'platform', h: 0, gx: 0, gy: 0, fric: 1 };
      },
    };
  } };

  // Leafy gates that swing open and shut in a hedge row.
  F.gates = { make(s) {
    const list = s.list.map(g => Object.assign({ open: 0 }, g));
    return {
      list,
      update(t) { list.forEach(g => { const u = t / g.period + (g.phase || 0); g.open = U.clamp(0.5 + 1.7 * Math.sin(TAU * u), 0, 1); }); },
      collide(b, sim) {
        list.forEach(g => {
          if (g.open > 0.55) return;
          sim.hitSeg(g.a[0], g.a[1], g.b[0], g.b[1], 0.1, 9, 0.5, 0, 0, 'gate');
        });
      },
    };
  } };

  // Dandelion puffs that blow the ball along in the direction they point.
  F.boost = { make(s) {
    const pads = s.pads.map(p => { const l = Math.hypot(p.dir[0], p.dir[1]); return Object.assign({ r: 0.55, power: 8, cool: -1, hit: -9, dx: p.dir[0] / l, dy: p.dir[1] / l }, p); });
    return {
      pads,
      onStep(b, sim) {
        if (b.mode !== 'roll') return;
        pads.forEach(p => {
          if (sim.t < p.cool) return;
          if (Math.hypot(b.x - p.x, b.y - p.y) > p.r) return;
          const sp = Math.max(Math.hypot(b.vx, b.vy), p.power);
          b.vx = p.dx * sp; b.vy = p.dy * sp; b.rest = 0;
          p.cool = sim.t + 0.6; p.hit = sim.t;
          sim.emit({ type: 'boost' });
        });
      },
    };
  } };

  // Pieces that only change the look (handled in vis.js) still need a physics stub.
  ['decor', 'wheelbarrow', 'koi', 'hive', 'carrots', 'greenhouse', 'trellis', 'falls', 'rockery', 'sunflower', 'maze'].forEach(k => { F[k] = { make() { return {}; } }; });
});
