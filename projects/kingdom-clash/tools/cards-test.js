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

// 4b. Arena 2 cards.
const solo = (id, opts) => S.create(Object.assign({ seed: 9, decks: [deck(id), deck('wolves')] }, opts));
const run = (s, secs) => { const ev = []; for (let i = 0; i < secs * 30; i++) { S.step(s); ev.push(...s.events); s.events.length = 0; } return ev; };
// Spears hit ground and air, kill swarms, and do 30% to towers
s = S.create({ seed: 5, decks: [deck('spears'), deck('wolves')] });
s.energy = [10, 10]; s.hands[1][0] = 'hawks'; S.play(s, 1, 0, 9.5, 14.5); s.hands[1][1] = 'wolves'; S.play(s, 1, 1, 9.5, 13.5);
run(s, 1.2);
assert.strictEqual(S.play(s, 0, 0, 9.5, 14), 'ok');
run(s, 1.5);
assert.strictEqual(s.ents.filter(e => e.kind === 'troop' && e.team === 1).length, 0, 'spears cleared the hawks and wolves');
s = S.create({ seed: 5, decks: [deck('spears'), deck('wolves')] }); s.energy[0] = 10;
const lt = S.tower(s, 1, 'L'), lhp = lt.hp; S.play(s, 0, 0, 3.5, 6.5); run(s, 2);
assert.strictEqual(lhp - lt.hp, Math.round(185 * 0.3), 'spears do 30% to towers');
console.log('Spears: air and ground, 30% to towers: ok');
// Footmen: four of them
s = solo('footmen'); S.play(s, 0, 0, 9.5, 24.5);
assert.strictEqual(s.ents.filter(e => e.card === 'footmen').length, 4);
console.log('Footmen x4: ok');
// Flail Knight hits every wolf around him in one swing
s = S.create({ seed: 6, decks: [deck('flail'), deck('wolves')] }); s.energy = [10, 10];
assert.strictEqual(S.play(s, 0, 0, 3.5, 18.5), 'ok'); run(s, 1.1);
assert.strictEqual(S.play(s, 1, 0, 3.5, 14.5), 'ok');
let ev = run(s, 5);
const spins = ev.filter(e => e.type === 'spin').length;
assert(spins >= 1, 'he swung');
assert.strictEqual(s.ents.filter(e => e.card === 'wolves').length, 0, 'one or two swings clear a wolf pack');
console.log(`Flail Knight cleared four wolves in ${spins} swing(s): ok`);
// Pot Thrower: splash, then pottery that keeps hurting the spot for 0.5 s (ground only)
s = S.create({ seed: 7, decks: [deck('pots'), deck('gladiator')] }); s.energy = [10, 10];
assert.strictEqual(S.play(s, 0, 0, 3.5, 19.5), 'ok'); assert.strictEqual(S.play(s, 1, 0, 3.5, 13.5), 'ok');
let sawZone = false, zoneDmg = 0, g0 = null;
for (let i = 0; i < 30 * 8 && !zoneDmg; i++) {
  const gl = s.ents.find(e => e.card === 'gladiator'); const before = gl ? gl.hp : 0;
  S.step(s); s.events.length = 0;
  if (s.zones.length) { sawZone = true; if (!g0) g0 = s.zones[0]; }
  if (sawZone && !s.zones.length) zoneDmg = 1;
}
assert(sawZone, 'pottery left on the ground');
assert(Math.abs(g0.dur - 0.5) < 1e-9 && g0.dps === 40);
s = S.create({ seed: 7, decks: [deck('pots'), deck('hawks')] }); s.energy = [10, 10];
S.play(s, 0, 0, 3.5, 21.5); S.play(s, 1, 0, 3.5, 12.5); ev = run(s, 6);
assert(!ev.some(e => e.type === 'shoot' && e.kind === 'pot'), 'Pot Thrower ignores flyers');
// zone damage total: about 0.5 s x 40 dps
s = S.create({ seed: 8, decks: [deck('wolves'), deck('wolves')] });
assert.strictEqual(S.play(s, 1, 0, 9.5, 12.5), 'ok'); const dummy = s.ents.filter(e => e.card === 'wolves')[0];
const hp0 = dummy.hp; s.zones.push({ x: dummy.x, y: dummy.y, r: 1, team: 0, dps: 40, left: 0.5, dur: 0.5, pulse: 0, targets: 'ground' });
for (let i = 0; i < 15; i++) { dummy.deploy = 1; S.step(s); s.events.length = 0; }
assert.strictEqual(hp0 - dummy.hp, 20, 'five pulses of 4 damage');
console.log('Pot Thrower: splash, 0.5 s of pottery damage, ground only: ok');

// 5. Bots that hold the new cards play full matches without errors.
let n = 0;
for (let i = 0; i < 12; i++) {
  const d = i % 2 ? ['rhino', 'skeletons', 'gladiator', 'hawks', 'archers', 'cannon', 'gorilla', 'fireball'] : ['rhino', 'spears', 'footmen', 'flail', 'pots', 'archers', 'snowman', 'fireball'];
  s = S.create({ seed: 50 + i, decks: [d, d], cardLevels: [{ cannon: 3 }, { skeletons: 2 }] });
  const bots = [KCBot.create(0, { skill: 'normal', seed: i }), KCBot.create(1, { skill: 'romeo', seed: i + 9 })];
  let built = 0;
  while (!s.result) { S.step(s); bots.forEach(b => KCBot.update(b, s)); for (const e of s.events) if (e.type === 'deploy' && e.card === 'cannon') built++; s.events.length = 0; }
  n += built;
}
assert(n > 0, 'bots used the Cannon');
console.log(`Bots with the new cards finished 12 matches and placed ${n} Cannons: ok`);

// ---------- Sunstone Arena cards and the Snowman's evolution ----------
{
  const mk = (a, b, evos) => { const s = KCSim.create({ seed: 5, decks: [Array(8).fill(a), Array(8).fill(b)], evos }); s.energy = [10, 10]; return s; };
  const put = (s, team, id, x, y) => { s.energy[team] = 10; s.hands[team][0] = id; return KCSim.play(s, team, 0, x, y); };
  const run = (s, sec, fn) => { for (let i = 0; i < sec * 30; i++) { KCSim.step(s); if (fn) fn(s); s.events.length = 0; } };
  // Mole: placed on the far side, nothing hits it while it tunnels, then it surfaces there
  let s = mk('mole', 'archers');
  assert.strictEqual(put(s, 0, 'mole', 3.5, 4.2), 'ok', 'the Mole can go on the far side');
  assert.strictEqual(KCSim.canDeploy(s, 0, 'mole', 8.5, 16), false, 'but not in the river');
  put(s, 1, 'archers', 3.5, 9.5);
  const mole = s.ents.find(e => e.card === 'mole');
  let hitUnder = false;
  run(s, 2.5, () => { if (mole.tunnel && mole.hp < mole.maxHp) hitUnder = true; });
  assert(!hitUnder, 'nothing hits the Mole underground');
  run(s, 3);
  assert(!mole.tunnel && Math.hypot(mole.x - 3.5, mole.y - 4.2) < 2.5, 'the Mole surfaced at the spot');
  console.log('Mole: placed anywhere off the river, untouchable while tunneling, surfaces on the spot: ok');
  // Sandstorm: slows and wears down enemies, never friends
  s = mk('sandstorm', 'gladiator');
  put(s, 1, 'gladiator', 9.5, 10.5); put(s, 0, 'gladiator', 9.5, 21.5);
  run(s, 1.2);
  put(s, 0, 'sandstorm', 9.5, 12);
  run(s, 0.5);
  const foe = s.ents.find(e => e.team === 1 && e.kind === 'troop'), mine = s.ents.find(e => e.team === 0 && e.kind === 'troop');
  assert(foe.slowEnd > s.time && Math.abs(foe.slowF - 0.25) < 1e-9 && foe.hp < foe.maxHp, 'the enemy is slowed 25% and hurt');
  assert(!(mine.slowEnd > s.time), 'friends are not slowed');
  console.log('Sandstorm: 25% slow and damage over time on enemies only: ok');
  // Ram Cart: speeds up, hits the tower, two soldiers come out
  s = mk('ramcart', 'wolves');
  put(s, 0, 'ramcart', 3.5, 18.5);
  let ram = null, vmax = 0, soldiers = 0;
  run(s, 12, t => { const c = t.ents.find(e => e.card === 'ramcart'); if (c) vmax = Math.max(vmax, c.speed); for (const e of t.events) if (e.type === 'ram') { ram = e; soldiers = t.ents.filter(u => u.card === 'ramsoldier' && !u.dead).length; } });
  assert(ram && ram.power > 1.5, `the Ram Cart hit at speed (power ${ram && ram.power.toFixed(2)})`);
  assert(vmax > 2 && soldiers === 2, `it sped up (${vmax.toFixed(2)}) and left two soldiers (${soldiers})`);
  console.log(`Ram Cart: top speed ${vmax.toFixed(1)}, hit for ${ram.power.toFixed(2)}x, two soldiers: ok`);
  // Camel Jockey: the camel goes for towers while the rider lassos troops, a slow every 4 s at most
  s = mk('camel', 'gladiator');
  assert.strictEqual(put(s, 0, 'camel', 3.5, 22.5), 'ok'); assert.strictEqual(put(s, 1, 'gladiator', 3.5, 11.5), 'ok');
  const snares = [];
  run(s, 9, t => { for (const e of t.events) if (e.type === 'snare') snares.push(t.time); });
  const camel = s.ents.find(e => e.card === 'camel');
  assert(snares.length >= 1, 'the rider slowed a troop');
  for (let i = 1; i < snares.length; i++) assert(snares[i] - snares[i - 1] >= 3.9, 'slows are at least 4 s apart');
  assert(!camel || camel.targets === 'buildings', 'the camel keeps to buildings');
  console.log(`Camel Jockey: rider lassos troops (${snares.length} slows, 4 s apart) while the camel heads for towers: ok`);
  // the Snowman's evolution: every third play, giant snowballs 1.5x faster, same damage
  s = mk('snowman', 'wolves', [['snowman'], []]);
  const evo = []; for (let i = 0; i < 6; i++) { put(s, 0, 'snowman', 9.5, 24.5); evo.push(s.ents.filter(e => e.card === 'snowman' && e.evo).length); }
  assert.deepStrictEqual(evo, [0, 0, 1, 1, 1, 2], 'every third Snowman is evolved');
  const e1 = s.ents.find(e => e.card === 'snowman' && e.evo), n1 = s.ents.find(e => e.card === 'snowman' && !e.evo);
  assert(e1.dmg === n1.dmg && Math.abs(e1.projSpeed / n1.projSpeed - 1.5) < 1e-9 && Math.abs(e1.splash / n1.splash - 1.5) < 1e-9 && e1.proj === 'bigsnow');
  const s2 = mk('snowman', 'wolves'); for (let i = 0; i < 3; i++) put(s2, 0, 'snowman', 9.5, 24.5);
  assert.strictEqual(s2.ents.filter(e => e.evo).length, 0, 'no evolution without unlocking it');
  console.log('Snowman evolution: every third play, 1.5x snowballs and speed, same damage: ok');
}
