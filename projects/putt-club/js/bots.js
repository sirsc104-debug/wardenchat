/* Putt Club: rivals. Each rival plays the same hole at the same time as you, in a Sim of its own, and shows as a
   ghost ball. Their thinking (trying putts in a copy of the hole) runs in a Web Worker so the game never stutters. */
(function (PC) {
  'use strict';
  const U = PC.U;

  PC.RIVALS = {
    Owen: { color: '#ffd23f', skill: 0.25 },
    Clover: { color: '#7ed957', skill: 0.38 },
    Fern: { color: '#4fd1c5', skill: 0.5 },
    Bramble: { color: '#b58cff', skill: 0.62 },
    Blaze: { color: '#ff6b3d', skill: 0.72 },
    Thorn: { color: '#ff5d8f', skill: 0.78 },
    Cinder: { color: '#ff9a1f', skill: 0.85 },
    SirSC: { color: '#4ff3ff', skill: 0.97 },
  };
  const TIMED = new Set(['spinner', 'ferry', 'patrol', 'swing', 'gates', 'seesaw', 'movingCup', 'beanstalk', 'wind', 'turntable', 'sprinkler', 'tumbleweeds', 'snowballs']);

  // Runs inside the worker, built from the same physics source as the page.
  function workerMain(PC) {
    const holes = {}, fields = {};
    self.onmessage = e => {
      const m = e.data;
      try {
        let H = holes[m.holeId];
        if (!H) { H = holes[m.holeId] = PC.prepareHole(PC.holeById(m.holeId)); fields[m.holeId] = {}; }
        const sim = new PC.Sim(H, m.opts).load(m.snap);
        self.postMessage({ id: m.id, res: PC.Nav.choose(sim, PC.Nav.fieldFor(H, sim, fields[m.holeId]), m) });
      } catch (err) { self.postMessage({ id: m.id, error: String((err && err.message) || err) }); }
    };
  }

  function makeWorker() {
    try {
      const src = 'self.window = self;\nconst PC = {};\n' + PC.SRC.map(f => '(' + f.toString() + ')(PC);').join('\n') + '\n(' + workerMain.toString() + ')(PC);';
      return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch (e) { return null; }
  }

  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  class Rivals {
    constructor() {
      // One worker per rival so they think at the same time.
      this.workers = [];
      for (let i = 0; i < 3; i++) {
        const w = makeWorker();
        if (!w) break;
        w.onmessage = e => { const f = this.cb.get(e.data.id); this.cb.delete(e.data.id); if (f) f(e.data.res || null); };
        w.onerror = () => { this.workers = this.workers.filter(x => x !== w); };
        this.workers.push(w);
      }
      this.req = 0; this.cb = new Map(); this.list = []; this.gen = 0;
      this.thinkAvg = 0.8;   // seconds of real time a plan takes, measured as we go
    }
    get worker() { return this.workers[0] || null; }

    // roster: [{ name, color, skill }]
    setHole(hole, roster, opts) {
      this.gen++;
      this.cb.clear();
      this.hole = hole; this.fields = null;
      this.max = PC.maxStrokes(hole);
      this.timed = (hole.features || []).some(f => TIMED.has(f.type));
      this.list = roster.map((r, i) => ({
        name: r.name, color: r.color, skill: r.skill,
        sim: new PC.Sim(hole, opts), strokes: 0, done: false, picked: false,
        state: 'idle', timer: 1.4 + i * 0.9 + Math.random() * 0.8, plan: null, lostT: 0, shootAt: 0,
      }));
      const [tx, ty] = hole.tee, a = Math.atan2(hole.cup[1] - ty, hole.cup[0] - tx);
      const spots = [[0.5, -0.1], [-0.5, -0.1], [0, -0.55]];
      this.list.forEach((r, i) => {
        const [side, back] = spots[i % spots.length];
        const x = tx + Math.cos(a + Math.PI / 2) * side + Math.cos(a) * back, y = ty + Math.sin(a + Math.PI / 2) * side + Math.sin(a) * back;
        if (r.sim.ground(x, y).kind === 'floor') r.sim.place(x, y);
      });
      return this.list;
    }

    clear() { this.gen++; this.list = []; this.cb.clear(); }

    stepPhysics(dt) { for (const r of this.list) if (!r.done) r.sim.step(dt); }

    // Called once a frame. `speed` is how fast the game is running (faster while you wait for them).
    update(dt, speed) {
      const events = [];
      for (const r of this.list) {
        if (r.done) continue;
        const s = r.sim;
        for (const e of s.events) {
          if (e.type === 'sink') { r.done = true; r.state = 'done'; events.push({ type: 'sink', rival: r }); }
          else if (e.type === 'lost') { r.strokes += 1; r.state = 'lost'; r.lostT = 1.0; events.push({ type: 'lost', rival: r, kind: e.kind, x: e.x, y: e.y }); }
        }
        s.events.length = 0;
        if (r.done) continue;
        if (r.state === 'lost') {
          r.lostT -= dt * speed;
          if (r.lostT <= 0) { s.restore(); r.state = 'idle'; r.timer = 0.8; if (r.strokes >= this.max) this.pickUp(r, events); }
        } else if (r.state === 'rolling') {
          if (s.resting()) { r.state = 'idle'; r.timer = 0.5 + Math.random() * 0.9; if (r.strokes >= this.max) this.pickUp(r, events); }
        } else if (r.state === 'idle') {
          if (s.resting()) { r.timer -= dt * speed; if (r.timer <= 0) this.think(r, speed); }
        } else if (r.state === 'aim') {
          if (s.t >= r.shootAt) this.shoot(r);
        }
      }
      return events;
    }

    think(r, speed) {
      r.state = 'thinking';
      const gen = this.gen, t0 = r.sim.t, started = performance.now();
      // The plan is for a moment a little ahead, long enough for the thinking to finish first.
      const lead = this.timed ? U.clamp(this.thinkAvg * (speed || 1) * 1.6 + 0.4, 1.0, 5) : 0.6;
      const waits = this.timed && r.skill > 0.45 ? [lead, lead + 0.8, lead + 1.6] : [lead];
      const msg = { holeId: this.hole.id, opts: r.sim.opts, snap: r.sim.snapshot(), waits, n: Math.round(10 + r.skill * 22), seed: Math.floor(Math.random() * 1e9), maxT: 7, slot: this.list.indexOf(r),
        // A shakier rival checks its putts against bigger mistakes, so it keeps clear of cacti and edges it would likely hit.
        wobble: 0.012 + (1 - r.skill) * 0.05, pwobble: 0.02 + (1 - r.skill) * 0.08, check: 6 };
      this.ask(msg, res => {
        if (gen !== this.gen || r.done) return;
        const took = (performance.now() - started) / 1000;
        this.thinkAvg = this.thinkAvg * 0.7 + took * 0.3;
        if (!res) res = { ang: Math.random() * Math.PI * 2, p: 0.3, wait: lead };
        // Too late for a moving hole: think again (twice at most), now that we know how long it takes.
        if (this.timed && r.sim.t > t0 + res.wait + 0.02 && (r.replans || 0) < 2) { r.replans = (r.replans || 0) + 1; r.state = 'idle'; r.timer = 0; return; }
        r.replans = 0;
        const k = 1 - r.skill;
        r.plan = { ang: res.ang + gauss() * k * 0.1, p: U.clamp(res.p * (1 + gauss() * k * 0.16), 0.03, 1) };
        r.shootAt = t0 + res.wait;
        r.state = 'aim';
      });
    }

    ask(msg, cb) {
      if (!this.workers.length) {
        // No worker available: think on the main thread instead, with a lighter search.
        const sim = new PC.Sim(this.hole, msg.opts).load(msg.snap);
        const F = PC.Nav.fieldFor(this.hole, sim, this.fields || (this.fields = {}));
        setTimeout(() => cb(PC.Nav.choose(sim, F, Object.assign({}, msg, { n: 12, check: 2 }))), 0);
        return;
      }
      const id = ++this.req;
      this.cb.set(id, cb);
      this.workers[(msg.slot || 0) % this.workers.length].postMessage(Object.assign({ id }, msg));
    }

    shoot(r) {
      if (!r.sim.resting()) { r.state = 'idle'; r.timer = 0.3; return; }
      r.sim.shoot(r.plan.ang, r.plan.p);
      r.sim.events.length = 0;
      r.strokes++;
      r.state = 'rolling';
    }

    pickUp(r, events) { r.done = true; r.picked = true; r.state = 'done'; r.strokes = this.max; if (events) events.push({ type: 'pickup', rival: r }); }
    allDone() { return this.list.every(r => r.done); }
    // If you have waited long enough, the stragglers finish with two more strokes (never past the limit).
    forceFinish() { this.list.forEach(r => { if (!r.done) { r.done = true; r.picked = true; r.strokes = Math.min(this.max, r.strokes + 2); } }); }
  }
  PC.Rivals = Rivals;
})(window.PC = window.PC || {});
