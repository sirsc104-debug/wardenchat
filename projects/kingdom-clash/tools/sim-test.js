// Plays bot-vs-bot matches headless and checks they end cleanly: node tools/sim-test.js [matches]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['cards.js', 'sim.js', 'bot.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });

const N = +process.argv[2] || 40;
const tally = { 0: 0, 1: 0, '-1': 0 }, reasons = {};
let plays = 0, maxTroops = 0, totalTime = 0;
for (let i = 0; i < N; i++) {
  const s = KCSim.create({ seed: 1000 + i });
  const bots = [KCBot.create(0, { skill: 'normal', seed: 5 + i }), KCBot.create(1, { skill: i % 2 ? 'normal' : 'trainer', seed: 77 + i })];
  let steps = 0;
  while (!s.result && steps < 30 * 400) {
    KCSim.step(s);
    bots.forEach(b => KCBot.update(b, s));
    s.events.length = 0;
    steps++;
    const troops = s.ents.filter(e => e.kind === 'troop');
    maxTroops = Math.max(maxTroops, troops.length);
    for (const e of s.ents) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) throw new Error('NaN in ' + JSON.stringify(e));
      if (e.kind === 'troop' && !e.air && e.y > 15.01 && e.y < 16.99 && !KCSim.BRIDGES.some(b => Math.abs(e.x - b) < 1.01)) throw new Error(`ground troop in the river: ${e.card} ${e.x.toFixed(2)},${e.y.toFixed(2)}`);
    }
  }
  if (!s.result) throw new Error('match never ended');
  tally[s.result.winner]++;
  reasons[s.result.reason] = (reasons[s.result.reason] || 0) + 1;
  plays += s.played[0] + s.played[1];
  totalTime += s.result.time;
}
console.log(`${N} matches: blue ${tally[0]}, red ${tally[1]}, draws ${tally[-1]}`, reasons);
console.log(`avg length ${(totalTime / N).toFixed(0)} s, avg cards played ${(plays / N).toFixed(1)}, most troops at once ${maxTroops}`);
