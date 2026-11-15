#!/usr/bin/env node
/* Plays every hole with a simple search bot to check each one can be finished, and roughly how many strokes it takes.
     node tools/test-holes.js            all holes
     node tools/test-holes.js koi moles  just these */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, Date };
ctx.window = ctx;
vm.createContext(ctx);
['util', 'physics', 'features', 'holes'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' }));
const PC = ctx.PC, U = PC.U, C = PC.C;

const TIMED = new Set(['spinner', 'ferry', 'patrol', 'swing', 'gates', 'seesaw', 'movingCup', 'beanstalk', 'wind', 'turntable']);

function distanceField(hole) {
  const sim = new PC.Sim(hole);
  const b = hole.box, cell = 0.15;
  const x0 = b.x0 - 0.5, y0 = b.y0 - 0.5;
  const nx = Math.ceil((b.w + 1) / cell), ny = Math.ceil((b.h + 1) / cell);
  const cost = new Float32Array(nx * ny).fill(Infinity);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell, y = y0 + j * cell;
    const g = sim.ground(x, y);
    let c = g.kind === 'floor' || g.kind === 'platform' ? 1 : g.kind === 'water' || g.kind === 'flowers' ? 4 : Infinity;
    if (c === Infinity) continue;
    for (const s of hole.segs) {
      if (s.ghost) continue;
      const q = U.closestOnSeg(x, y, s.ax, s.ay, s.bx, s.by);
      if (Math.hypot(x - q[0], y - q[1]) < s.r + C.R * 0.9 && !(s.top && s.h === 0)) { c = Infinity; break; }
    }
    if (c !== Infinity) for (const p of hole.posts) if (Math.hypot(x - p.x, y - p.y) < p.r + C.R * 0.9) { c = Infinity; break; }
    cost[j * nx + i] = c;
  }
  const dist = new Float64Array(nx * ny).fill(Infinity);
  const ci = Math.round((hole.cup[0] - x0) / cell), cj = Math.round((hole.cup[1] - y0) / cell);
  // binary heap of [distance, i, j]
  const heap = [];
  const hpush = e => { heap.push(e); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const hpop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  hpush([0, ci, cj]);
  dist[cj * nx + ci] = 0;
  const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [d, i, j] = hpop();
    if (d > dist[j * nx + i]) continue;
    for (const [di, dj, w] of N) {
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= nx || c >= ny) continue;
      const k = c * nx + a;
      if (cost[k] === Infinity) continue;
      const nd = d + w * cell * cost[k];
      if (nd < dist[k]) { dist[k] = nd; hpush([nd, a, c]); }
    }
  }
  return (x, y) => {
    const i = Math.round((x - x0) / cell), j = Math.round((y - y0) / cell);
    if (i < 0 || j < 0 || i >= nx || j >= ny) return 99;
    let best = dist[j * nx + i];
    if (best === Infinity) for (const [di, dj] of N) { const a = i + di, c = j + dj; if (a >= 0 && c >= 0 && a < nx && c < ny) best = Math.min(best, dist[c * nx + a] + cell); }
    return best === Infinity ? 99 : best;
  };
}

function snapshot(sim) {
  return { t: sim.t, ball: Object.assign({}, sim.ball), safe: sim.safe.slice(), feats: sim.feats.map(f => { const o = {}; for (const k of Object.keys(f)) if (typeof f[k] !== 'function' && k !== 'spec') o[k] = JSON.parse(JSON.stringify(f[k])); return o; }) };
}
function restore(hole, snap) {
  const sim = new PC.Sim(hole);
  sim.t = snap.t;
  sim.feats.forEach((f, i) => Object.assign(f, snap.feats[i]));
  sim.feats.forEach(f => f.update && f.update(sim.t, sim));
  Object.assign(sim.ball, snap.ball);
  sim.safe = snap.safe.slice();
  return sim;
}

// Run until the ball rests, drops or is lost. Returns {result, sim}.
function play(sim, maxT = 18) {
  const start = sim.t;
  let lost = null;
  while (sim.t - start < maxT) {
    sim.step(C.DT);
    const b = sim.ball;
    if (b.mode === 'sunk') return { result: 'sunk', sim };
    if (b.mode === 'lost') { lost = b.lostKind; sim.restore(); return { result: 'lost', kind: lost, sim }; }
    if (sim.t - start > 0.4 && sim.resting()) return { result: 'rest', sim };
  }
  return { result: 'timeout', sim };
}

function solve(hole, opts = {}) {
  const field = distanceField(hole);
  const timed = (hole.features || []).some(f => TIMED.has(f.type));
  const angles = timed ? 40 : 60, powers = timed ? [0.18, 0.3, 0.42, 0.55, 0.7, 0.86, 1] : [0.12, 0.2, 0.28, 0.36, 0.45, 0.55, 0.66, 0.78, 0.9, 1];
  const waits = timed ? [0, 0.9, 1.8, 2.7] : [0];
  let sim = new PC.Sim(hole);
  // let the ball settle on the tee
  for (let i = 0; i < 120; i++) sim.step(C.DT);
  const teeMove = Math.hypot(sim.ball.x - hole.tee[0], sim.ball.y - hole.tee[1]);
  let strokes = 0, aces = 0, firstTrials = 0;
  const log = [];
  while (strokes < 8) {
    const base = snapshot(sim);
    let best = null;
    for (const w of waits) {
      const pre = restore(hole, base);
      while (pre.t - base.t < w) pre.step(C.DT);
      if (!pre.resting() && w > 0) continue;
      const preSnap = snapshot(pre);
      for (let a = 0; a < angles; a++) for (const p of powers) {
        const s = restore(hole, preSnap);
        const ang = (a / angles) * Math.PI * 2;
        s.shoot(ang, p);
        const r = play(s);
        let score;
        if (r.result === 'sunk') score = -1;
        else if (r.result === 'lost') score = field(s.ball.x, s.ball.y) + 6;
        else score = field(s.ball.x, s.ball.y) + (r.result === 'timeout' ? 3 : 0);
        // The beanstalk only grows once the seed packet is pressed: reward pressing it.
        const bean = s.feats.find(f => f.type === 'beanstalk');
        if (bean && r.result !== 'sunk' && s.ball.y < 7 && !(bean.left > 4)) score += 20;
        if (strokes === 0) { firstTrials++; if (r.result === 'sunk') aces++; }
        if (!best || score < best.score) best = { score, ang, p, w, r, snap: snapshot(r.sim) };
      }
    }
    strokes++;
    log.push(`${(best.ang * 180 / Math.PI).toFixed(0)}deg p${best.p} wait${best.w} -> ${best.r.result}${best.r.kind ? '(' + best.r.kind + ')' : ''} d=${best.score.toFixed(2)}`);
    if (best.r.result === 'sunk') return { strokes, log, aces, firstTrials, teeMove };
    sim = restore(hole, best.snap);
  }
  return { strokes: 'X', log, aces, firstTrials, teeMove };
}

function check(hole) {
  const sim = new PC.Sim(hole);
  const problems = [];
  const gt = sim.ground(hole.tee[0], hole.tee[1]), gc = sim.ground(hole.cup[0], hole.cup[1]);
  if (gt.kind !== 'floor') problems.push('tee not on the green');
  if (gc.kind !== 'floor') problems.push('cup not on the green');
  hole.posts.forEach((p, i) => { if (sim.ground(p.x, p.y).kind !== 'floor') problems.push('post ' + i + ' off the green'); });
  return problems;
}

const want = process.argv.slice(2);
const holes = PC.HOLES.filter(h => !want.length || want.includes(h.id) || want.includes(String(h.num)));
let fails = 0;
for (const spec of holes) {
  const hole = PC.prepareHole(spec);
  const t0 = Date.now();
  const problems = check(hole);
  const r = solve(hole);
  const ms = Date.now() - t0;
  const ok = r.strokes !== 'X' && problems.length === 0;
  if (!ok) fails++;
  console.log(`${String(hole.num).padStart(2)} ${hole.name.padEnd(18)} par ${hole.par}  bot ${String(r.strokes).padEnd(2)} aces ${r.aces}/${r.firstTrials}  tee drift ${r.teeMove.toFixed(3)}  ${ms}ms ${problems.join('; ')}`);
  if (!ok || process.env.VERBOSE) r.log.forEach(l => console.log('     ' + l));
}
console.log(fails ? `${fails} hole(s) need work` : 'All holes finished');
process.exit(fails ? 1 : 0);
