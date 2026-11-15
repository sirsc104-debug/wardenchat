/* Putt Club: how the rivals find their way. A distance-to-the-cup map over each hole, straight-line checks,
   and a shot search that tries putts in a copy of the hole and keeps the one that ends closest along the course.
   Pure data like physics.js, so it runs in the rivals' worker and under Node. */
(function (mod) { const PC = window.PC = window.PC || {}; mod(PC); (PC.SRC = PC.SRC || []).push(mod); })(function (PC) {
  'use strict';
  const U = PC.U, C = PC.C;
  const Nav = PC.Nav = {};

  // How far a putt of each power rolls on flat green, for picking a power to reach a point.
  const ROLL = [];
  for (let i = 0; i <= 50; i++) {
    const p = i / 50;
    let v = 0.5 + (C.MAXV - 0.5) * Math.pow(p, 1.15), d = 0;
    while (v > 0.03) { v -= (C.FRIC + C.LIN * v) / 120; d += v / 120; }
    ROLL.push([p, d]);
  }
  Nav.powerFor = d => {
    if (d <= ROLL[0][1]) return 0.03;
    for (let i = 1; i < ROLL.length; i++) if (ROLL[i][1] >= d) {
      const [p0, d0] = ROLL[i - 1], [p1, d1] = ROLL[i];
      return U.clamp(p0 + ((p1 - p0) * (d - d0)) / (d1 - d0), 0.03, 1);
    }
    return 1;
  };

  function blockedBySolid(hole, x, y, pad) {
    for (const s of hole.segs) {
      if (s.top && s.h === 0) continue;   // ledges you drop off, not walls
      const q = U.closestOnSeg(x, y, s.ax, s.ay, s.bx, s.by);
      if (Math.hypot(x - q[0], y - q[1]) < s.r + C.R * pad) return true;
    }
    for (const p of hole.posts) if (Math.hypot(x - p.x, y - p.y) < p.r + C.R * pad) return true;
    return false;
  }

  // Distance along the course to the cup, on a 0.2-unit grid. Water and lava cost extra but can be crossed
  // (that is where ferries and bridges are); the void cannot.
  Nav.field = function (hole) {
    hole = PC.prepareHole(hole);
    const sim = new PC.Sim(hole);
    const b = hole.box, cell = 0.2;
    const x0 = b.x0 - 0.6, y0 = b.y0 - 0.6;
    const nx = Math.ceil((b.w + 1.2) / cell), ny = Math.ceil((b.h + 1.2) / cell);
    const cost = new Float32Array(nx * ny).fill(Infinity);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * cell, y = y0 + j * cell;
      const g = sim.ground(x, y);
      let c = g.kind === 'floor' || g.kind === 'platform' ? 1 : g.kind === 'water' || g.kind === 'flowers' || g.kind === 'lava' ? 5 : Infinity;
      if (c !== Infinity && blockedBySolid(hole, x, y, 0.9)) c = Infinity;
      cost[j * nx + i] = c;
    }
    const dist = new Float64Array(nx * ny).fill(Infinity);
    const heap = [];
    const push = e => { heap.push(e); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    // Shortcuts the grid can't see: portals and mole tunnels both ways, geysers to where they land.
    // The map is built outward from the cup, so each link is stored at its far end.
    const cellOf = (x, y) => { const i = Math.round((x - x0) / cell), j = Math.round((y - y0) / cell); return i >= 0 && j >= 0 && i < nx && j < ny ? j * nx + i : -1; };
    const rev = new Map();
    const link = (ax, ay, bx, by) => { const a = cellOf(ax, ay), q = cellOf(bx, by); if (a < 0 || q < 0) return; if (!rev.has(q)) rev.set(q, []); rev.get(q).push(a); cost[a] = Math.min(cost[a] === Infinity ? 1 : cost[a], 1); };
    (hole.features || []).forEach(f => {
      if (f.type === 'tunnels') f.pairs.forEach(p => { link(p.a[0], p.a[1], p.b[0], p.b[1]); link(p.b[0], p.b[1], p.a[0], p.a[1]); });
      if (f.type === 'launch' && f.land) link(f.x, f.y, f.land[0], f.land[1]);
    });
    const ci = Math.round((hole.cup[0] - x0) / cell), cj = Math.round((hole.cup[1] - y0) / cell);
    dist[cj * nx + ci] = 0; push([0, ci, cj]);
    while (heap.length) {
      const [d, i, j] = pop();
      if (d > dist[j * nx + i]) continue;
      const back = rev.get(j * nx + i);
      if (back) back.forEach(k => { const nd = d + 1; if (nd < dist[k]) { dist[k] = nd; push([nd, k % nx, Math.floor(k / nx)]); } });
      for (const [di, dj, w] of N) {
        const a = i + di, c = j + dj;
        if (a < 0 || c < 0 || a >= nx || c >= ny) continue;
        const k = c * nx + a;
        if (cost[k] === Infinity) continue;
        const nd = d + w * cell * cost[k];
        if (nd < dist[k]) { dist[k] = nd; push([nd, a, c]); }
      }
    }
    const idx = (x, y) => [Math.round((x - x0) / cell), Math.round((y - y0) / cell)];
    const at = (x, y) => {
      const [i, j] = idx(x, y);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return 99;
      let best = dist[j * nx + i];
      if (best === Infinity) for (const [di, dj] of N) { const a = i + di, c = j + dj; if (a >= 0 && c >= 0 && a < nx && c < ny) best = Math.min(best, dist[c * nx + a] + cell); }
      return best === Infinity ? 99 : best;
    };
    // Follow the map downhill from a point toward the cup.
    const path = (x, y, maxLen) => {
      let [i, j] = idx(x, y);
      const out = [];
      let len = 0, px = x, py = y;
      for (let n = 0; n < 400 && len < maxLen; n++) {
        let bi = -1, bj = -1, bd = i >= 0 && j >= 0 && i < nx && j < ny ? dist[j * nx + i] : Infinity;
        for (const [di, dj] of N) { const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= nx || c >= ny) continue; const v = dist[c * nx + a]; if (v < bd) { bd = v; bi = a; bj = c; } }
        if (bi < 0) break;
        i = bi; j = bj;
        const qx = x0 + i * cell, qy = y0 + j * cell;
        len += Math.hypot(qx - px, qy - py); px = qx; py = qy;
        out.push([qx, qy, len]);
        if (bd === 0) break;
      }
      return out;
    };
    return { at, path, cell };
  };

  // Can the ball roll straight from a to b without leaving the green or hitting anything solid?
  Nav.clear = function (sim, ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 0.15));
    for (let k = 1; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
      const g = sim.ground(x, y);
      if (g.kind !== 'floor' && g.kind !== 'platform') return false;
      if (blockedBySolid(sim.hole, x, y, 1.0)) return false;
    }
    return true;
  };

  // A spread of putts worth trying from where the ball is now.
  Nav.candidates = function (sim, F, n, rnd, timed) {
    const b = sim.ball;
    const cp = sim.cupPos();
    const path = F.path(b.x, b.y, 26);
    const clearPts = [];
    let misses = 0;
    for (const p of path) {
      if (p[2] < 0.6) continue;
      if (Nav.clear(sim, b.x, b.y, p[0], p[1])) { clearPts.push(p); misses = 0; } else if (++misses > 12) break;
    }
    const out = [];
    const add = (tx, ty, k) => {
      const ang = Math.atan2(ty - b.y, tx - b.x), d = Math.hypot(tx - b.x, ty - b.y);
      out.push({ ang, p: Nav.powerFor(d * k) });
      // Uphill takes more: climbing h costs about as much as rolling 7h further on the flat.
      const dh = sim.floorHeight(tx, ty) - sim.floorHeight(b.x, b.y);
      if (dh > 0.2) [1, 1.4].forEach(m => out.push({ ang, p: Nav.powerFor(d * k + dh * 7 * m) }));
    };
    const direct = Nav.clear(sim, b.x, b.y, cp[0], cp[1]);
    if (direct) [0.92, 1.0, 1.08, 1.18].forEach(k => add(cp[0], cp[1], k));
    if (clearPts.length) {
      const far = clearPts[clearPts.length - 1];
      const picks = [far];
      [0.25, 0.5, 0.75].forEach(f => { const q = clearPts[Math.floor((clearPts.length - 1) * f)]; if (q && q !== far) picks.push(q); });
      picks.forEach((q, i) => [0.8, 0.95, 1.1, 1.3].forEach(k => add(q[0], q[1], i === 0 ? k : k * 1.05)));
      [-0.12, -0.05, 0.05, 0.12].forEach(da => { const ang = Math.atan2(far[1] - b.y, far[0] - b.x) + da; out.push({ ang, p: Nav.powerFor(Math.hypot(far[0] - b.x, far[1] - b.y)) }); });
    } else if (path.length) {
      const q = path[Math.min(path.length - 1, 3)];
      const ang = Math.atan2(q[1] - b.y, q[0] - b.x);
      [0.12, 0.25, 0.4, 0.6].forEach(p => out.push({ ang, p }));
    }
    // A fan of putts around the way the course goes, at a spread of strengths (finds ferries, ramps and banks).
    // Aim the fan along the route about 3 units ahead (a point right next to the ball can kink sideways).
    let ahead = clearPts.length ? clearPts[clearPts.length - 1] : null;
    if (!ahead && path.length) ahead = path.find(p => p[2] >= 3) || path[path.length - 1];
    const dir = ahead ? Math.atan2(ahead[1] - b.y, ahead[0] - b.x) : Math.atan2(cp[1] - b.y, cp[0] - b.x);
    // Holes with moving parts try every putt at several moments, so they get a smaller fan.
    const big = n > 20 && !timed;
    const fanA = big ? [-0.5, -0.3, -0.15, -0.05, 0.05, 0.15, 0.3, 0.5] : [-0.35, -0.12, 0, 0.12, 0.35];
    const fanP = big ? [0.12, 0.2, 0.3, 0.42, 0.56, 0.72, 0.86, 1] : [0.15, 0.3, 0.46, 0.64, 0.82, 1];
    fanA.forEach(da => fanP.forEach(p => out.push({ ang: dir + da, p })));
    // Seed packets and runes that raise a bridge: try stopping on them.
    (sim.feats || []).forEach(f => {
      if (f.type !== 'beanstalk' || f.left > 4) return;
      const bt = f.spec.button;
      [0.95, 1.1, 1.3].forEach(k => add(bt[0], bt[1], k));
    });
    // Moving platforms: try stopping where they are and where they will be.
    (sim.feats || []).forEach(f => {
      if (f.type !== 'ferry') return;
      [f.spec.a, f.spec.b, [f.x, f.y]].forEach(q => { if (Math.hypot(q[0] - b.x, q[1] - b.y) < 9) [0.9, 1.05, 1.2].forEach(k => add(q[0], q[1], k)); });
    });
    while (out.length < n) out.push({ ang: rnd() * Math.PI * 2, p: 0.15 + rnd() * 0.7 });
    return out;
  };

  // Play one putt out in a copy of the hole. Lower scores are better; a holed putt scores -1.
  Nav.evaluate = function (base, cand, F, wait, maxT) {
    const s = base.clone();
    const dt = C.DT;   // the same step as the game, so the plan matches what really happens
    const beans = s.feats.filter(f => f.type === 'beanstalk' && f.left < 4);
    let w = 0;
    while (w < wait) { s.step(dt); w += dt; }
    if (!s.resting()) return { score: 50 };
    const startD = F.at(s.ball.x, s.ball.y);
    s.shoot(cand.ang, cand.p);
    const t0 = s.t;
    while (s.t - t0 < maxT) {
      s.step(dt);
      const m = s.ball.mode;
      if (m === 'sunk') return { score: -1 + (s.t - t0) * 0.001 };
      if (m === 'lost') return { score: startD + 6 };
      if (s.t - t0 > 0.35 && s.resting()) {
        // Raising a bridge is worth a lot, even though the ball is no nearer the cup yet.
        const raised = beans.some(f => f.left > 6);
        // Is it safe where it stopped? Watch a little longer: blades, imps and rafts can carry it off.
        const tRest = s.t;
        while (s.t - tRest < 1.6) {
          s.step(dt);
          if (s.ball.mode === 'lost') return { score: startD + 5 };
        }
        return { score: F.at(s.ball.x, s.ball.y) - (raised ? 8 : 0) + (s.resting() ? 0 : 0.6) };
      }
    }
    return { score: F.at(s.ball.x, s.ball.y) + 2 };
  };

  Nav.choose = function (sim, F, opts) {
    const rnd = U.rng(opts.seed || 1);
    const waits = opts.waits || [0];
    const cands = Nav.candidates(sim, F, opts.n || 16, rnd, waits.length > 1);
    const maxT = opts.maxT || 7;
    const all = [];
    for (const wait of waits) {
      for (const c of cands) all.push({ ang: c.ang, p: c.p, wait, score: Nav.evaluate(sim, c, F, wait, maxT).score });
    }
    all.sort((a, b) => a.score - b.score);
    // Check the best few with small mistakes added, and keep the one that holds up best.
    const da = opts.wobble === undefined ? 0.012 : opts.wobble;
    let best = null;
    for (const c of all.slice(0, opts.check || 5)) {
      const near = [[da, 0.02], [-da, -0.02]].map(([a, k]) => Nav.evaluate(sim, { ang: c.ang + a, p: U.clamp(c.p * (1 + k), 0.03, 1) }, F, c.wait, maxT).score);
      const sc = (c.score + near[0] + near[1]) / 3 + Math.max(0, Math.max(near[0], near[1]) - c.score) * 0.15;
      if (!best || sc < best.robust) best = Object.assign({}, c, { robust: sc });
    }
    return best || all[0];
  };
});
