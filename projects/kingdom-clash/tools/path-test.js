// Places each ground troop behind and beside every friendly tower and checks it gets past within
// 20 seconds instead of sticking to the tower: node tools/path-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['cards.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });

const spots = [[3.5, 28.5], [3.5, 27.6], [2.5, 28.5], [14.5, 28.5], [15.5, 27.6], [9.5, 31.5], [8.5, 31.5], [9.5, 31.2], [6.5, 31.5], [11.5, 30.5]];
const troops = ['rhino', 'wolves', 'gladiator', 'archers', 'snowman', 'gorilla'];
let fails = 0, runs = 0;
for (const team of [0, 1]) for (const card of troops) for (const [x, y0] of spots) {
  const y = team === 0 ? y0 : KCSim.H - y0;
  const s = KCSim.create({ seed: 3, decks: [Array(8).fill(card), Array(8).fill(card)] });
  s.energy[team] = 10;
  const r = KCSim.play(s, team, 0, x, y);
  if (r !== 'ok') continue;
  runs++;
  for (let i = 0; i < 20 * 30; i++) { KCSim.step(s); s.events.length = 0; }
  const us = s.ents.filter(e => e.kind === 'troop' && e.team === team);
  const stuck = us.filter(u => KCSim.own(team, u.y) > 23.5);
  if (stuck.length) { fails++; console.log(`STUCK team ${team} ${card} from ${x},${y}: ` + stuck.map(u => `${u.x.toFixed(1)},${u.y.toFixed(1)}`).join(' ')); }
}
console.log(`${runs - fails}/${runs} placements got past their towers`);
process.exitCode = fails ? 1 : 0;
