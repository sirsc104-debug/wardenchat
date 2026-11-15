#!/usr/bin/env node
/* Plays each hole with the rivals' own shot search (the same code their worker runs) and reports strokes.
     node tools/test-rivals.js [abyss|garden] [skill] [ids...] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, Date }; ctx.window = ctx; vm.createContext(ctx);
['util', 'physics', 'features', 'holes', 'canyon', 'winter', 'abyss', 'nav'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' }));
const PC = ctx.PC, C = PC.C, U = PC.U;
const args = process.argv.slice(2);
const course = ['garden', 'canyon', 'winter'].find(c => args.includes(c)) || 'abyss';
const skill = +(args.find(a => /^0?\.\d+$|^1$/.test(a)) || 0.97);
const ids = args.filter(a => !['garden', 'abyss', 'canyon', 'winter'].includes(a) && !/^0?\.\d+$|^1$/.test(a));
const TIMED = new Set(['spinner', 'ferry', 'patrol', 'swing', 'gates', 'seesaw', 'movingCup', 'beanstalk', 'wind', 'turntable', 'sprinkler', 'tumbleweeds', 'snowballs']);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pool = ({ abyss: PC.ABYSS, canyon: PC.CANYON, winter: PC.WINTER, garden: PC.HOLES })[course].filter(h => !ids.length || ids.includes(h.id));
let tot = 0, totPar = 0;
for (const spec of pool) {
  const hole = PC.prepareHole(spec), cache = {}, max = PC.maxStrokes(hole);
  const timed = (hole.features || []).some(f => TIMED.has(f.type));
  const runs = [];
  for (let run = 0; run < 3; run++) {
    const sim = new PC.Sim(hole);
    let strokes = 0, t0 = Date.now(), log = [];
    while (strokes < max) {
      const lead = 1.0;
      const res = PC.Nav.choose(sim.clone(), PC.Nav.fieldFor(hole, sim, cache), { waits: timed ? [lead, lead + 0.8, lead + 1.6] : [lead], n: Math.round(10 + skill * 22), seed: Math.floor(Math.random() * 1e9), maxT: 7, wobble: 0.012 + (1 - skill) * 0.05, pwobble: 0.02 + (1 - skill) * 0.08, check: 6 });
      const k = 1 - skill;
      let w = 0; while (w < res.wait) { sim.step(C.DT); w += C.DT; }
      sim.shoot(res.ang + gauss() * k * 0.1, U.clamp(res.p * (1 + gauss() * k * 0.16), 0.03, 1));
      strokes++;
      let n = 0;
      while (n < 240 * 12) { sim.step(C.DT); n++; const m = sim.ball.mode; if (m === 'sunk' || m === 'lost' || (n > 80 && sim.resting())) break; }
      log.push(sim.ball.mode[0] + res.score.toFixed(0));
      if (sim.ball.mode === 'sunk') break;
      if (sim.ball.mode === 'lost') { strokes++; sim.restore(); }
    }
    runs.push({ s: Math.min(strokes, max), ms: Date.now() - t0, log: log.join(' ') });
  }
  const avg = runs.reduce((a, r) => a + r.s, 0) / runs.length;
  tot += avg; totPar += hole.par;
  console.log(`${hole.name.padEnd(18)} par ${hole.par} max ${max}  rival ${runs.map(r => r.s).join(',').padEnd(9)} avg ${avg.toFixed(1)}  ${Math.round(runs[0].ms)}ms  ${runs[0].log}`);
}
console.log(`total avg ${tot.toFixed(1)} vs par ${totPar}`);
