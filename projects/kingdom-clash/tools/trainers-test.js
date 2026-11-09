// How often does each Training Grounds trainer beat different kinds of players?
// node tools/trainers-test.js [matches]
// Owen (tutorial) should almost never win, Romeo should win some, Luc should be a real test.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['cards.js', 'trainers.js', 'sim.js', 'bot.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });

const N = +process.argv[2] || 100;
const only = process.argv[3];
// A player who drops a random affordable card on a random spot of their side every few seconds.
function randomPlayer(seed) {
  const r = KCSim.mulberry(seed);
  let next = 2 + r() * 4;
  return s => {
    if (s.time < next) return;
    const slot = Math.floor(r() * 4), id = s.hands[0][slot], c = KC_CARDS[id];
    if (s.energy[0] < c.cost) return;
    const x = Math.floor(r() * 18) + 0.5, y = c.kind === 'spell' ? Math.floor(r() * 32) + 0.5 : Math.floor(17 + r() * 15) + 0.5;
    if (KCSim.play(s, 0, slot, x, y) === 'ok') next = s.time + 3 + r() * 5;
  };
}
const players = {
  'good player': i => { const b = KCBot.create(0, { skill: 'normal', seed: 10 + i }); return s => KCBot.update(b, s); },
  'sloppy player': i => { const b = KCBot.create(0, { skill: 'trainer', seed: 20 + i }); return s => KCBot.update(b, s); },
  'random clicker': i => randomPlayer(30 + i),
  'does nothing': () => () => {},
};
for (const T of KC_TRAINERS) {
  if (only && T.id !== only) continue;
  console.log(`${T.name} (${T.tier}, skill ${T.skill}, tower damage ${T.towerDamage})`);
  for (const [name, make] of Object.entries(players)) {
    const t = { won: 0, lost: 0, draw: 0 };
    for (let i = 0; i < N; i++) {
      const s = KCSim.create({ seed: 4000 + i, towerDamage: [1, T.towerDamage] });
      const bot = KCBot.create(1, { skill: T.skill, seed: 900 + i }), me = make(i);
      while (!s.result) { KCSim.step(s); me(s); KCBot.update(bot, s); s.events.length = 0; }
      const w = s.result.winner;
      if (w === 1) t.won++; else if (w === 0) t.lost++; else t.draw++;
    }
    console.log(`  vs ${name.padEnd(15)} trainer won ${String(t.won).padStart(3)} of ${N} (${(t.won / N * 100).toFixed(0)}%), lost ${t.lost}, drew ${t.draw}`);
  }
}
