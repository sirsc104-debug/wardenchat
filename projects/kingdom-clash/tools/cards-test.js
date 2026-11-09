// Checks the Arena 1 cards in the simulation: the Cannon pulls a Rhino off its lane and decays over
// 30 seconds; the Skeleton Pack spawns three; card levels scale stats. node tools/cards-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
for (const f of ['cards.js', 'sim.js', 'bot.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const S = KCSim;
const deck = id => Array(8).fill(id);

// 1. A Rhino walking down the left lane goes for a Cannon placed in the middle instead of the tower.
let s = S.create({ seed: 1, decks: [deck('cannon'), deck('rhino')] });
s.energy = [10, 10];
assert.strictEqual(S.play(s, 1, 0, 3.5, 13.5), 'ok');          // red Rhino just past their bridge
for (let i = 0; i < 30 * 4; i++) { S.step(s); s.events.length = 0; }
assert.strictEqual(S.play(s, 0, 0, 7.5, 22.5), 'ok');          // blue Cannon in the middle
const cannon = s.ents.find(e => e.kind === 'building');
assert(cannon, 'cannon placed');
let hitCannon = false;
for (let i = 0; i < 30 * 12; i++) {
  const before = cannon.hp; S.step(s);
  for (const e of s.events) if (e.type === 'hit' && e.card === 'rhino' && Math.hypot(e.x - cannon.x, e.y - cannon.y) < 0.1) hitCannon = true;
  s.events.length = 0;
  if (cannon.dead) break;
}
const leftTower = S.tower(s, 0, 'L');
assert(hitCannon, 'the Rhino attacked the Cannon');
assert.strictEqual(leftTower.hp, leftTower.maxHp, 'the left tower was not touched while the Cannon stood');
console.log('Cannon pulls the Rhino: ok');

// 2. A Cannon on its own decays to nothing in about 30 seconds (plus 1 s to deploy).
s = S.create({ seed: 2, decks: [deck('cannon'), deck('wolves')] });
S.play(s, 0, 0, 9.5, 22.5);
let t = 0;
while (s.ents.some(e => e.kind === 'building') && t < 40) { S.step(s); s.events.length = 0; t += S.DT; }
assert(t > 30 && t < 31.5, `cannon lasted ${t.toFixed(1)} s`);
console.log(`Cannon lifetime ${t.toFixed(1)} s: ok`);

// 3. Can't place a Cannon on the river, on a tower, or on the enemy side.
s = S.create({ seed: 3, decks: [deck('cannon'), deck('cannon')] });
assert(!S.canDeploy(s, 0, 'cannon', 9.5, 16.5));
assert(!S.canDeploy(s, 0, 'cannon', 3.5, 25.5));
assert(!S.canDeploy(s, 0, 'cannon', 9.5, 10.5));
assert(S.canDeploy(s, 0, 'cannon', 9.5, 19.5));
console.log('Cannon placement rules: ok');

// 4. Skeleton Pack spawns three; levels scale stats.
s = S.create({ seed: 4, decks: [deck('skeletons'), deck('skeletons')], cardLevels: [{ skeletons: 5 }, {}] });
S.play(s, 0, 0, 9.5, 24.5);
const sk = s.ents.filter(e => e.card === 'skeletons');
assert.strictEqual(sk.length, 3);
assert.strictEqual(sk[0].maxHp, Math.round(40 * Math.pow(1.08, 4)));
assert.strictEqual(sk[0].level, 5);
console.log('Skeleton Pack x3 at level 5: ok');

// 5. Bots that hold the new cards play full matches without errors.
let n = 0;
for (let i = 0; i < 12; i++) {
  const d = ['rhino', 'skeletons', 'gladiator', 'hawks', 'archers', 'cannon', 'gorilla', 'fireball'];
  s = S.create({ seed: 50 + i, decks: [d, d], cardLevels: [{ cannon: 3 }, { skeletons: 2 }] });
  const bots = [KCBot.create(0, { skill: 'normal', seed: i }), KCBot.create(1, { skill: 'romeo', seed: i + 9 })];
  let built = 0;
  while (!s.result) { S.step(s); bots.forEach(b => KCBot.update(b, s)); for (const e of s.events) if (e.type === 'deploy' && e.card === 'cannon') built++; s.events.length = 0; }
  n += built;
}
assert(n > 0, 'bots used the Cannon');
console.log(`Bots with the new cards finished 12 matches and placed ${n} Cannons: ok`);
