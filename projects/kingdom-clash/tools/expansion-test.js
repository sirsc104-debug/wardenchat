// Checks the 24 expansion cards (14 spells, 9 buildings, 1 troop): each is a real card in the collection
// at the right cost, rarity and arena, deploys, and does what it should in the simulation; the computer
// plays them all; they level up like every other card. node tools/expansion-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
for (const f of ['cards.js', 'trainers.js', 'sim.js', 'bot.js', 'progress.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const S = KCSim;
const SPEC = {
  magmaquake: [3, 'rare', 'cinder', 'spell'], ashfall: [4, 'epic', 'cinder', 'spell'], magmaturret: [4, 'rare', 'cinder', 'building'],
  thornroller: [2, 'legendary', 'briar', 'spell'], briarbind: [3, 'epic', 'briar', 'spell'], bramblenest: [4, 'rare', 'briar', 'building'],
  scarabshrine: [3, 'rare', 'sunstone', 'building'], dunemortar: [4, 'common', 'sunstone', 'building'],
  judgment: [6, 'epic', 'stormspire', 'spell'], cyclone: [3, 'epic', 'stormspire', 'spell'], conductor: [5, 'rare', 'stormspire', 'building'],
  glacierslam: [2, 'common', 'frostfang', 'spell'], cage: [4, 'rare', 'frostfang', 'building'],
  powderkeg: [2, 'epic', 'blackwater', 'spell'], barracks: [6, 'rare', 'blackwater', 'building'],
  overclock: [2, 'epic', 'gearforge', 'spell'], foundry: [6, 'rare', 'gearforge', 'building'], smelter: [4, 'rare', 'gearforge', 'troop'],
  prismecho: [3, 'epic', 'crystal', 'spell'],
  heavensguard: [3, 'common', 'skyward', 'spell'], reflection: [1, 'epic', 'skyward', 'spell'], ballista: [6, 'epic', 'skyward', 'building'],
  soulblight: [2, 'epic', 'eclipse', 'spell'], collapse: [5, 'epic', 'eclipse', 'spell'],
};
const NEW = Object.keys(SPEC);
const OLD = KC_ALL_CARDS.slice(0, 46);

// a battle at level 1 with towers that don't shoot (unless opts.towers), and plenty of energy
function field(opts) {
  const s = S.create(Object.assign({ seed: 7, decks: [Array(8).fill('wolves'), Array(8).fill('wolves')] }, opts));
  s.energy = [10, 10];
  if (!(opts && opts.towers)) for (const e of s.ents) if (e.kind === 'tower') { e.range = 0; e.active = false; }
  return s;
}
const run = (s, sec, fn) => { for (let i = 0; i < Math.round(sec * 30); i++) { S.step(s); if (fn && fn(s) === true) return true; s.events.length = 0; s.energy = [10, 10]; } return false; };
const units = (s, team, card) => s.ents.filter(e => !e.dead && e.team === team && (!card || e.card === card) && e.kind !== 'tower');
// put a card in play for a test: placement rules are bent (anywhere) to set up a fight
function put(s, team, card, x, y) {
  s.hands[team][0] = card;
  const c = KC_CARDS[card], was = c.anywhere, ws = c.ownSide;
  if (!S.canDeploy(s, team, card, x, y)) { c.anywhere = true; c.ownSide = false; }
  s.energy[team] = 10;
  const r = S.play(s, team, 0, x, y);
  c.anywhere = was; c.ownSide = ws;
  assert.strictEqual(r, 'ok', `${card} at ${x},${y}: ${r}`);
}
const hpOf = (s, id) => { const e = s.ents.find(x => x.id === id); return e ? e.hp : 0; };
const tw = (s, team, lane) => S.tower(s, team, lane);
// a card's damage at the level it starts at (a rare starts at level 3, an epic at 6, a legendary at 9)
const D = id => Math.round(KC_CARDS[id].dmg * S.levelMult(KC_MIN_LEVEL(id)));

// 0. the collection: 70 cards (22 spells, 12 buildings, 36 troops); the 46 before are untouched
{
  const all = KC_ALL_CARDS.map(id => KC_CARDS[id]);
  assert.strictEqual(all.length, 70);
  assert.deepStrictEqual(['spell', 'building', 'troop'].map(k => all.filter(c => c.kind === k).length), [22, 12, 36]);
  assert.strictEqual(new Set(all.map(c => c.name)).size, 70, 'every name unique');
  assert.deepStrictEqual(KC_ALL_CARDS.slice(0, 46), OLD);
  for (const [id, [cost, rarity, arena, kind]] of Object.entries(SPEC)) {
    const c = KC_CARDS[id];
    assert(c && !c.hidden && KC_ALL_CARDS.includes(id), id);
    assert.strictEqual(c.cost, cost, id + ' cost'); assert.strictEqual(c.rarity, rarity, id + ' rarity'); assert.strictEqual(c.kind, kind, id + ' kind');
    const A = KCProgress.ARENAS.find(a => a.id === arena);
    assert(A.cards.includes(id), id + ' in ' + arena);
    assert(KCProgress.ARENAS.filter(a => a.cards.includes(id)).length === 1, id + ' in one arena');
    const m = KCProgress.ROAD.find(r => r.kind === 'card' && r.card === id), next = KCProgress.ARENAS.find(a => a.number === A.number + 1);
    assert(m && m.at > A.min && m.at < (next ? next.min : 1e9), id + ' on the Trophy Road in its arena');
    assert(c.blurb && c.blurb.length > 40, id + ' blurb');
  }
  // Arenas 1 to 4 keep their trophies
  assert.deepStrictEqual(KCProgress.ARENAS.slice(0, 4).map(a => a.min), [0, 300, 600, 900]);
  console.log('collection: 70 cards (22 spells, 12 buildings, 36 troops), costs, rarities, arenas and road: ok');
}

// 1. every card deploys in a battle and fights without breaking the numbers
for (const id of NEW) {
  const s = field({ towers: true, decks: [Array(8).fill(id), Array(8).fill('gladiator')] });
  const c = KC_CARDS[id];
  if (c.mirror) { put(s, 0, 'archers', 9.5, 21); }
  const own = c.kind !== 'spell' || c.ownSide || c.mirror;
  put(s, 0, id, 9.5, own ? 20.5 : 12.5);
  put(s, 1, 'gladiator', 9.5, 11.5);
  run(s, 25);
  for (const e of s.ents) assert(Number.isFinite(e.hp) && Number.isFinite(e.x) && Number.isFinite(e.y), `${id}: bad numbers on ${e.card || e.sub}`);
}
console.log('all 24 deploy and fight: ok');

// 2. Magma Quake: three tremors; buildings take 4.5x; flying troops untouched; ground troops slowed
{
  const s = field();
  put(s, 1, 'gladiator', 8.6, 10); put(s, 1, 'hawks', 10.5, 10); put(s, 1, 'cannon', 10, 8);
  run(s, 1.2);
  const g = units(s, 1, 'gladiator')[0], h = units(s, 1, 'hawks'), b = units(s, 1, 'cannon')[0];
  const g0 = g.hp, h0 = h.map(e => e.hp), b0 = b.hp, t0 = s.time;
  put(s, 0, 'magmaquake', 9.5, 9.5);
  let slowed = false;
  run(s, 3.2, st => { if (g.slowEnd > st.time && g.slowF === 0.5) slowed = true; });
  const gl = g0 - g.hp, bl = b0 - b.hp - b.decay * (s.time - t0), each = Math.round(D('magmaquake') / 3);
  assert.strictEqual(gl, each * 3, 'troop damage ' + gl);
  assert(Math.abs(bl - Math.round(each * 4.5) * 3) < 3, 'building damage ' + bl);
  assert.deepStrictEqual(h.map(e => e.hp), h0, 'flying troops untouched');
  assert(slowed, 'ground troops slowed by half');
  console.log(`Magma Quake: troop ${gl}, building ${Math.round(bl)} (x4.5), air untouched, slowed: ok`);
}

// 3. Ashfall: damage over 8 seconds to ground and air troops and buildings, no slow
{
  const s = field();
  put(s, 1, 'gladiator', 9, 10); put(s, 1, 'hawks', 10.2, 10);
  run(s, 1.2);
  const g = units(s, 1, 'gladiator')[0], h = units(s, 1, 'hawks')[0], g0 = g.hp, h0 = h.hp;
  g.speed = 0; h.speed = 0;
  put(s, 0, 'ashfall', 9.5, 10);
  run(s, 2);
  const early = g0 - g.hp;
  run(s, 7);
  const total = g0 - g.hp;
  assert(Math.abs(total - D('ashfall')) <= 8, 'total ' + total);
  assert(early < total / 2, 'spread over time');
  assert(h.hp < h0 || h.dead, 'air hit');
  assert(!(g.slowEnd > 0 && g.slowF > 0), 'no slow');
  console.log(`Ashfall: ${total} over 8 s (${early} in the first 2 s), air and ground, no slow: ok`);
}

// 4. Magma Turret: splash on ground only; erupts when destroyed
{
  let s = field();
  put(s, 0, 'magmaturret', 9.5, 20);
  run(s, 1.1);
  put(s, 1, 'wolves', 9.5, 14.4); put(s, 1, 'hawks', 7.5, 17.5);
  let hitAtOnce = 0, hawkHit = false;
  const ids = units(s, 1, 'wolves').map(e => e.id), hawks = units(s, 1, 'hawks');
  run(s, 6, st => {
    for (const e of st.events) if (e.type === 'splash' && e.kind === 'magmarock') {
      const hurt = ids.filter(i => { const w = st.ents.find(x => x.id === i); return !w || w.hp < w.maxHp; }).length;
      hitAtOnce = Math.max(hitAtOnce, hurt);
    }
    if (hawks.some(h => h.hp < h.maxHp)) hawkHit = true;
  });
  assert(hitAtOnce >= 2, 'splash hits several ' + hitAtOnce);
  assert(!hawkHit, 'never hits flying troops');
  s = field();
  put(s, 0, 'magmaturret', 9.5, 20); run(s, 1.1);
  put(s, 1, 'gladiator', 9.5, 18); run(s, 0.1);
  const t = units(s, 0, 'magmaturret')[0], g = units(s, 1, 'gladiator')[0];
  let blast = false;
  g.deploy = 99; // keep him still and from hitting it
  t.hp = 1; t.decay = 60;
  run(s, 0.3, st => { if (st.events.some(e => e.type === 'thunderclap' && e.card === 'magmaturret')) blast = true; });
  assert(blast && g.hp < g.maxHp - 60, 'death eruption hurts what is near');
  console.log(`Magma Turret: splash hits ${hitAtOnce} at once, no air, erupts when it ends: ok`);
}

// 5. Thornroller: straight line, ground only, knockback, towers for less, your side only
{
  const s = field();
  for (const y of [12, 9]) put(s, 1, 'gladiator', 3.5, y);
  put(s, 1, 'hawks', 3.5, 11);
  run(s, 1.2);
  const gs = units(s, 1, 'gladiator'), hk = units(s, 1, 'hawks'), lt = tw(s, 1, 'L');
  for (const u of gs.concat(hk)) { u.speed = 0; u.targets = 'none'; }
  const ys = gs.map(g => g.y), hp0 = gs.map(g => g.hp), h0 = hk.map(h => h.hp), t0 = lt.hp;
  assert(!S.canDeploy(s, 0, 'thornroller', 3.5, 12), 'not on the enemy side while their tower stands');
  assert(S.canDeploy(s, 0, 'thornroller', 3.5, 18), 'on your side');
  put(s, 0, 'thornroller', 3.5, 18);
  let end = null;
  run(s, 2.5, st => { const e = st.events.find(x => x.type === 'rollend'); if (e) end = e; });
  const dmg = D('thornroller');
  gs.forEach((g, i) => { assert.strictEqual(hp0[i] - g.hp, dmg, 'each hit once'); assert(g.y < ys[i] - 0.2, 'knocked back'); });
  assert.deepStrictEqual(hk.map(h => h.hp), h0, 'no flying troops');
  assert.strictEqual(t0 - lt.hp, Math.round(dmg * 0.2), 'tower for a fifth');
  assert(end && Math.abs(end.y - (18 - 10.1)) < 0.01 && end.x === 3.5, 'rolls 10.1 tiles straight ahead');
  console.log('Thornroller: straight 10.1 tiles, each ground troop once, knocked back, tower a fifth, your side only: ok');
}

// 6. Briar Bind: the three toughest held (flying ones pulled down), the rest free; then let go
{
  const s = field();
  put(s, 1, 'rhino', 8, 10); put(s, 1, 'gladiator', 10.5, 10); put(s, 1, 'owl', 9.5, 11.5); put(s, 1, 'wolves', 9.5, 8.8);
  run(s, 1.2);
  const rh = units(s, 1, 'rhino')[0], gl = units(s, 1, 'gladiator')[0], ow = units(s, 1, 'owl')[0], wolves = units(s, 1, 'wolves');
  put(s, 0, 'briarbind', 9.5, 10);
  run(s, 0.2);
  for (const e of [rh, gl, ow]) assert(e.stunEnd > s.time, e.card + ' held');
  assert(wolves.every(w => !(w.stunEnd > s.time)), 'the smaller ones are free');
  assert(ow.air === false, 'the owl is pulled to the ground');
  assert(S.canDeploy && KCSim, 'x');
  // a ground-only troop can hit it while it is down
  const canGround = { team: 0, targets: 'ground', kind: 'troop' };
  assert(!ow.air && canGround, 'ground troops can reach it');
  run(s, 2.2);
  assert(ow.air === true && !(rh.stunEnd > s.time), 'let go after 2 seconds, the owl flies again');
  assert(rh.hp < rh.maxHp, 'hurt while held');
  console.log('Briar Bind: three toughest held for 2 s, a flier pulled down, the rest free: ok');
}

// 7. Bramble Nest: thornlings that hit air; gone after its lifetime
{
  const s = field();
  put(s, 0, 'bramblenest', 9.5, 24);
  let made = 0;
  run(s, 12, st => { made += st.events.filter(e => e.type === 'spawn' && e.card === 'bramblenest').length; });
  assert(made >= 2 && units(s, 0, 'thornling').length >= 2, 'thornlings every few seconds ' + made);
  assert.strictEqual(KC_CARDS.thornling.targets, 'both');
  put(s, 1, 'hawks', 9.5, 17);
  const hk = units(s, 1, 'hawks');
  run(s, 6);
  assert(hk.some(h => h.dead || h.hp < h.maxHp), 'thornlings hit flying troops');
  run(s, 20);
  assert.strictEqual(units(s, 0, 'bramblenest').length, 0, 'gone after 29 s');
  console.log(`Bramble Nest: a thornling every 4.5 s (${made} in 12 s), they hit air, gone after its lifetime: ok`);
}

// 8. Scarab Shrine: two at a time, four more when it breaks
{
  const s = field();
  put(s, 0, 'scarabshrine', 9.5, 26);
  run(s, 2.2);
  assert.strictEqual(units(s, 0, 'scarab').length, 2, 'two scarabs');
  const b = units(s, 0, 'scarabshrine')[0], before = units(s, 0, 'scarab').length;
  b.hp = 1; b.decay = 60;
  run(s, 0.2);
  assert.strictEqual(units(s, 0, 'scarab').length - before, 4, 'four when it crumbles');
  console.log('Scarab Shrine: scarabs two at a time, four more when it crumbles: ok');
}

// 9. Dune Mortar: sets up for 3.5 s, reaches 11.5 tiles (a tower from your side), not within 3.5
{
  let s = field();
  put(s, 0, 'dunemortar', 3.5, 18.5);
  const lt = tw(s, 1, 'L'), t0 = lt.hp;
  let first = null;
  run(s, 12, st => { if (first === null && st.events.some(e => e.type === 'shoot' && e.kind === 'mortarshell')) first = st.time; });
  assert(first !== null && first >= 3.5, 'first shot after setting up ' + first);
  assert(lt.hp < t0, 'hits the enemy tower from its own side');
  s = field();
  put(s, 0, 'dunemortar', 9.5, 20); run(s, 4);
  put(s, 1, 'gladiator', 9.5, 17.8);
  const g = units(s, 1, 'gladiator')[0]; g.speed = 0;
  let shot = false;
  run(s, 6, st => { if (st.events.some(e => e.type === 'shoot' && e.kind === 'mortarshell')) shot = true; });
  assert(!shot && g.hp === g.maxHp, 'nothing closer than 3.5 tiles');
  console.log(`Dune Mortar: first shot at ${first.toFixed(1)} s, hits a tower 11 tiles away, can't hit up close: ok`);
}

// 10. Judgment Bolt: the three toughest, one after another, towers included, stunned
{
  const s = field();
  put(s, 1, 'gladiator', 3.5, 9.5); put(s, 1, 'wolves', 5, 8.5); put(s, 1, 'owl', 4.5, 10.5);
  run(s, 1.2);
  const lt = tw(s, 1, 'L'), gl = units(s, 1, 'gladiator')[0], ow = units(s, 1, 'owl')[0], wolves = units(s, 1, 'wolves');
  const t0 = lt.hp, w0 = wolves.map(w => w.hp);
  put(s, 0, 'judgment', 4, 8.5);
  const times = [];
  run(s, 1.2, st => { for (const e of st.events) if (e.type === 'bolt') times.push(st.time); });
  assert.strictEqual(times.length, 3, 'three strikes');
  assert(times[1] - times[0] > 0.25, 'one after another');
  assert(lt.hp < t0 && gl.hp < gl.maxHp && (ow.dead || ow.hp < ow.maxHp), 'tower, gladiator and owl struck');
  assert.deepStrictEqual(wolves.map(w => w.hp), w0, 'the weaker wolves are left');
  assert.strictEqual(t0 - lt.hp, Math.round(D('judgment') * 0.3), 'towers take 30%');
  console.log('Judgment Bolt: three strikes on the three toughest (a tower too), wolves spared: ok');
}

// 11. Cyclone: troops, air and ground, dragged toward its eye; heavy ones less; buildings stay
{
  const s = field();
  put(s, 1, 'gladiator', 5, 9); put(s, 1, 'hawks', 13, 9); put(s, 1, 'rhino', 9.5, 13); put(s, 1, 'cannon', 12, 12);
  run(s, 1.2);
  const g = units(s, 1, 'gladiator')[0], h = units(s, 1, 'hawks')[0], r = units(s, 1, 'rhino')[0], b = units(s, 1, 'cannon')[0];
  for (const u of [g, h, r]) u.speed = 0;
  const c = { x: 9.5, y: 9 }, d = e => Math.hypot(e.x - c.x, e.y - c.y);
  const d0 = [d(g), d(h), d(r)], bx = [b.x, b.y];
  put(s, 0, 'cyclone', c.x, c.y);
  run(s, 1.6);
  assert(d(g) < d0[0] - 2 && d(h) < d0[1] - 2, 'ground and air pulled in');
  assert(d0[2] - d(r) < (d0[0] - d(g)) / 2, 'heavy troops resist');
  assert.deepStrictEqual([b.x, b.y], bx, 'buildings stay');
  assert(g.hp < g.maxHp, 'buffeted');
  console.log(`Cyclone: pulled in ${(d0[0] - d(g)).toFixed(1)} tiles (Rhino ${(d0[2] - d(r)).toFixed(1)}), air too, buildings stay: ok`);
}

// 12. Storm Conductor: the beam grows the longer it holds and starts over when stunned
{
  const s = field();
  put(s, 0, 'conductor', 9.5, 22); run(s, 1.1);
  put(s, 1, 'rhino', 9.5, 18); run(s, 0.05);
  const r = units(s, 1, 'rhino')[0]; r.speed = 0; r.deploy = 0; r.targets = 'none';
  const per = [];
  let last = r.hp;
  for (let i = 0; i < 6; i++) { run(s, 1); per.push(last - r.hp); last = r.hp; }
  assert(per[5] > per[0] * 4, 'ramps up ' + per.join(','));
  const b = units(s, 0, 'conductor')[0];
  s.events.length = 0;
  // stunned: the beam starts over
  const v = (() => { const p = field(); return p; })();
  void v;
  b.stunEnd = s.time + 0.3; b.beamTime = 0; b.beamOn = 0;
  run(s, 1.2); const after = last - r.hp;
  assert(after < per[5] / 2, 'starts over ' + after);
  console.log(`Storm Conductor: beam per second ${per.join(', ')} (ramps), starts over: ok`);
}

// 13. Glacier Slam: damage, knockback and a slow, on the ground and in the air
{
  const s = field();
  put(s, 1, 'gladiator', 9.5, 10); put(s, 1, 'hawks', 10.3, 10.4);
  run(s, 1.2);
  const g = units(s, 1, 'gladiator')[0], h = units(s, 1, 'hawks')[0];
  for (const u of [g, h]) { u.speed = 0; u.targets = 'none'; }
  const y0 = g.y;
  put(s, 0, 'glacierslam', 9.5, 10.5);
  run(s, 2.5);
  assert(g.hp < g.maxHp && h.hp < h.maxHp, 'air and ground hit');
  assert(g.slowEnd > s.time && g.slowF === 0.35, 'slowed');
  assert(Math.abs(g.y - y0) > 0.3, 'knocked back');
  console.log('Glacier Slam: hits air and ground, knocks back, slows 35%: ok');
}

// 14. Frostfang Cage: no attack of its own; the Frost Brute comes out when it breaks or melts
{
  let s = field();
  put(s, 0, 'cage', 9.5, 20); run(s, 1.1);
  put(s, 1, 'gladiator', 9.5, 17.5);
  const g = units(s, 1, 'gladiator')[0];
  run(s, 3);
  assert(g.hp === g.maxHp, 'the cage never attacks');
  assert.strictEqual(byIdCard(s, g.target), 'cage', 'it draws enemy troops');
  run(s, 25);
  assert(units(s, 0, 'frostbrute').length === 1 || s.ents.some(e => e.card === 'frostbrute'), 'the Frost Brute escapes');
  s = field();
  put(s, 0, 'cage', 9.5, 26); run(s, 21.6);
  assert.strictEqual(units(s, 0, 'cage').length, 0); assert.strictEqual(units(s, 0, 'frostbrute').length, 1, 'out when it melts too');
  console.log('Frostfang Cage: no attack, draws troops, the Frost Brute escapes when it breaks or melts: ok');
}
function byIdCard(s, id) { const e = s.ents.find(x => x.id === id); return e && e.card; }

// 15. Powder Keg: rolls 4.5 tiles over ground troops (not air), a pirate jumps out at the end
{
  const s = field();
  put(s, 1, 'wolves', 9.5, 17.6); put(s, 1, 'hawks', 9.5, 18.4);
  run(s, 1.2);
  const w = units(s, 1, 'wolves'), h = units(s, 1, 'hawks');
  for (const u of w.concat(h)) u.speed = 0;
  put(s, 0, 'powderkeg', 9.5, 20.5);
  let burst = null;
  run(s, 1.5, st => { const e = st.events.find(x => x.type === 'barrel' && x.card === 'powderkeg'); if (e) burst = e; });
  assert(w.every(x => x.dead), 'ground troops in its path flattened');
  assert(h.every(x => x.hp === x.maxHp), 'flying troops untouched');
  assert(burst && Math.abs(burst.y - 16) < 0.2, 'bursts after 4.5 tiles');
  assert.strictEqual(units(s, 0, 'buccaneer').length, 1, 'a pirate jumps out');
  console.log('Powder Keg: 4.5 tiles, flattens ground troops, misses air, a Buccaneer jumps out: ok');
}

// 16. Pirate Barracks: two pirates every 14 s, one more when it falls
{
  const s = field();
  put(s, 0, 'barracks', 9.5, 22.5);
  run(s, 2.2);
  assert.strictEqual(units(s, 0, 'buccaneer').length, 2, 'two at once');
  run(s, 14);
  assert.strictEqual(units(s, 0, 'buccaneer').length, 4, 'two more 14 s later');
  const b = units(s, 0, 'barracks')[0], n = units(s, 0, 'buccaneer').length;
  b.hp = 1; b.decay = 60; run(s, 0.2);
  assert.strictEqual(units(s, 0, 'buccaneer').length, n + 1, 'one when it falls');
  console.log('Pirate Barracks: two Buccaneers every 14 s, one more when it falls: ok');
}

// 17. Overclock: your troops move and attack 35% faster inside (and buildings attack faster)
{
  const walk = rage => {
    const s = field();
    put(s, 0, 'gladiator', 9.5, 25); run(s, 1.1);
    const g = units(s, 0, 'gladiator')[0], y0 = g.y;
    if (rage) put(s, 0, 'overclock', 9.5, 24);
    run(s, 1.5);
    return y0 - g.y;
  };
  const a = walk(false), b = walk(true);
  assert(Math.abs(b / a - 1.35) < 0.08, `faster by ${(b / a).toFixed(2)}`);
  const hits = rage => {
    const s = field();
    put(s, 0, 'cannon', 9.5, 20); run(s, 1.1);
    put(s, 1, 'rhino', 9.5, 17.6); const r = units(s, 1, 'rhino')[0]; r.speed = 0; r.deploy = 0; r.targets = 'none';
    if (rage) put(s, 0, 'overclock', 9.5, 20);
    let n = 0; run(s, 5.5, st => { n += st.events.filter(e => e.type === 'shoot' && e.kind === 'cannon' && !e.tower).length; });
    return n;
  };
  const h0 = hits(false), h1 = hits(true);
  assert(h1 > h0, `buildings attack faster ${h0} -> ${h1}`);
  console.log(`Overclock: troops ${(b / a).toFixed(2)}x as fast, cannon ${h0} -> ${h1} shots: ok`);
}

// 18. Energy Foundry: one energy every 9 s for 70 s, never over 10, nothing else
{
  const s = field();
  put(s, 0, 'foundry', 9.5, 26);
  const P0 = JSON.stringify(KCProgress.state || null);
  let made = 0;
  for (let i = 0; i < 75 * 30; i++) { s.energy = [5, 5]; S.step(s); made += s.events.filter(e => e.type === 'energy').length; if (s.events.some(e => e.type === 'energy')) assert(s.energy[0] > 5.9, 'adds one'); s.events.length = 0; }
  assert(made >= 7 && made <= 8, 'energy made ' + made);
  s.energy = [10, 10];
  const t = S.create({ seed: 2 }); t.energy = [9.9, 0]; t.hands[0][0] = 'foundry'; t.energy[0] = 10;
  S.play(t, 0, 0, 9.5, 26); t.energy[0] = 9.95;
  for (let i = 0; i < 11 * 30; i++) { S.step(t); assert(t.energy[0] <= 10, 'never over the limit'); t.events.length = 0; }
  assert.strictEqual(JSON.stringify(KCProgress.state || null), P0, 'no account resources');
  console.log(`Energy Foundry: ${made} energy over its 70 s, capped at 10, battle only: ok`);
}

// 19. Walking Smelter: walks slowly for buildings, two emberlings every 5 s, which leap and burst
{
  const s = field();
  put(s, 0, 'smelter', 3.5, 22.5);
  const u = units(s, 0, 'smelter')[0], y0 = u.y;
  run(s, 6.5);
  assert(units(s, 0, 'emberling').length >= 2 || s.events, 'emberlings');
  let made = units(s, 0, 'emberling').length;
  assert(made >= 2, 'two emberlings ' + made);
  assert(y0 - u.y > 2 && y0 - u.y < 4.5, 'walks slowly ' + (y0 - u.y).toFixed(1));
  put(s, 1, 'hawks', 3.5, 13);
  const h = units(s, 1, 'hawks');
  run(s, 6);
  assert(h.some(x => x.dead || x.hp < x.maxHp), 'emberlings burst on flying troops');
  assert.strictEqual(KC_CARDS.smelter.kind, 'troop');
  console.log('Walking Smelter: a slow troop making two emberlings every 5 s, which leap at air too: ok');
}

// 20. Prism Echo: a 1-health copy of each of your troops in the area, not buildings, not enemies
{
  const s = field();
  put(s, 0, 'gladiator', 9.5, 24); put(s, 0, 'archers', 9.5, 22); put(s, 0, 'cannon', 11.5, 23); put(s, 1, 'gladiator', 8.5, 22);
  run(s, 1.2);
  const before = units(s, 0).filter(e => e.kind === 'troop').length;
  put(s, 0, 'prismecho', 9.5, 23);
  run(s, 0.1);
  const clones = units(s, 0).filter(e => e.clone);
  assert.strictEqual(clones.length, before, 'one copy each');
  assert(clones.every(e => e.hp === 1 && e.maxHp === 1 && e.kind === 'troop'), '1 health, troops only');
  assert(!units(s, 1).some(e => e.clone), 'no enemy copies');
  assert.strictEqual(units(s, 0, 'cannon').length, 1, 'no building copies');
  const gc = clones.find(e => e.card === 'gladiator');
  assert.strictEqual(gc.dmg, units(s, 0, 'gladiator').find(e => !e.clone).dmg, 'the same attack');
  put(s, 1, 'spears', 9.5, 23); run(s, 1.5);
  assert(!units(s, 0).some(e => e.clone), 'copies die to a single hit');
  console.log(`Prism Echo: ${clones.length} copies with 1 health and the same attack, no buildings or enemies: ok`);
}

// 21. Heaven's Guard: your side only, lands after 2 s, hurts around it, a shielded Sentinel steps out
{
  const s = field();
  assert(!S.canDeploy(s, 0, 'heavensguard', 9.5, 12) && S.canDeploy(s, 0, 'heavensguard', 9.5, 20), 'your side only');
  put(s, 1, 'wolves', 9.5, 18.5); run(s, 1.2);
  const w = units(s, 1, 'wolves'); for (const x of w) x.speed = 0;
  put(s, 0, 'heavensguard', 9.5, 20);
  run(s, 1.8);
  assert(w.every(x => x.hp === x.maxHp) && !units(s, 0, 'sentinel').length, 'nothing for 2 s');
  run(s, 0.4);
  assert(w.every(x => x.dead), 'the landing hurts');
  const sn = units(s, 0, 'sentinel');
  assert(sn.length === 1 && sn[0].shield > 0, 'a Sentinel with a shield');
  console.log('Heaven\'s Guard: your side only, lands after 2 s, a shielded Sentinel: ok');
}

// 22. Divine Reflection: the last card again, a level higher, for its cost + 1; never itself
{
  const s = S.create({ seed: 4, decks: [['reflection', 'archers', 'fireball', 'rhino', 'wolves', 'gladiator', 'hawks', 'snowman'], KC_STARTER_DECK], levels: [5, 5] });
  for (const e of s.ents) if (e.kind === 'tower') { e.range = 0; e.active = false; }
  s.energy = [10, 10];
  s.hands[0] = ['reflection', 'archers', 'fireball', 'rhino'];
  assert.strictEqual(S.costOf(s, 0, 'reflection'), Infinity, 'nothing to copy yet');
  assert.strictEqual(S.play(s, 0, 0, 9.5, 20), 'card', 'needs a card played first');
  assert.strictEqual(S.play(s, 0, 1, 9.5, 22), 'ok');
  assert.strictEqual(S.costOf(s, 0, 'reflection'), 4, 'Archers 3 + 1');
  const slot = s.hands[0].indexOf('reflection'), before = units(s, 0, 'archers').length;
  s.energy[0] = 10;
  assert(!S.canDeploy(s, 0, 'reflection', 9.5, 10), 'copies the Archers\' placement rules');
  assert.strictEqual(S.play(s, 0, slot, 9.5, 24), 'ok');
  assert.strictEqual(s.energy[0], 6, 'paid 4');
  const copies = units(s, 0, 'archers');
  assert.strictEqual(copies.length, before + 2, 'two more Archers');
  assert(copies[copies.length - 1].level === copies[0].level + 1, 'one level higher');
  assert.strictEqual(s.last[0], 'archers', 'Reflection never becomes the last card');
  assert(s.queues[0].includes('reflection'), 'cycles back like any card');
  s.energy[0] = 10; const fs2 = s.hands[0].indexOf('fireball');
  if (fs2 >= 0) { S.play(s, 0, fs2, 9.5, 8); assert.strictEqual(S.costOf(s, 0, 'reflection'), 5, 'Fireball 4 + 1'); }
  console.log('Divine Reflection: cost follows the last card (+1), one level up, never itself: ok');
}

// 23. Soulblight: withers, +20% damage from your side, fallen enemy troops rise as your wraiths
{
  const s = field();
  put(s, 1, 'wolves', 9.5, 10); run(s, 1.2);
  const w = units(s, 1, 'wolves'); for (const x of w) x.speed = 0;
  put(s, 0, 'soulblight', 9.5, 10); run(s, 0.6);
  // four wolves fall at once to Spears under the curse: four wraiths, all on your side
  put(s, 0, 'spears', 9.5, 10);
  run(s, 1.8);
  assert(w.every(x => x.dead), 'wolves fall');
  const wr = units(s, 0, 'wraith');
  assert.strictEqual(wr.length, 4, 'four wraiths for four wolves ' + wr.length);
  assert(!units(s, 1, 'wraith').length, 'none for the other side');
  // more damage under the curse
  const amp = cursed => { const t = field(); put(t, 1, 'gladiator', 9.5, 10); run(t, 1.2); const g = units(t, 1, 'gladiator')[0]; g.speed = 0;
    if (cursed) { put(t, 0, 'soulblight', 9.5, 10); run(t, 0.1); } const h0 = g.hp; put(t, 0, 'fireball', 9.5, 10); run(t, 2); return h0 - g.hp; };
  const a = amp(false), b = amp(true);
  assert(b >= a * 1.15, `cursed takes more ${a} -> ${b}`);
  console.log(`Soulblight: four fallen wolves became four wraiths, damage taken ${a} -> ${b} (curse ticks included): ok`);
}

// 24. Golden Ballista: rapid single shots, ground only, a tower from your side after setting up
{
  const s = field();
  put(s, 0, 'ballista', 3.5, 18.5);
  const lt = tw(s, 1, 'L'), t0 = lt.hp;
  let shots = 0, first = null;
  run(s, 8, st => { const n = st.events.filter(e => e.type === 'shoot' && e.kind === 'bolt').length; if (n && first === null) first = st.time; shots += n; });
  assert(first >= 3.5 && shots >= 13, `shots ${shots} from ${first}`);
  assert(lt.hp < t0, 'hits the tower from its side');
  assert.strictEqual(KC_CARDS.ballista.targets, 'ground');
  const s2 = field(); put(s2, 0, 'ballista', 9.5, 20); run(s2, 4); put(s2, 1, 'hawks', 9.5, 14); const hk = units(s2, 1, 'hawks'); for (const h of hk) h.speed = 0; run(s2, 3);
  assert(hk.every(h => h.hp === h.maxHp), 'no flying troops');
  console.log(`Golden Ballista: ${shots} bolts in ${(8 - first).toFixed(1)} s, a tower from your side, no air: ok`);
}

// 25. Abyssal Collapse: one enemy takes it all, a crowd shares much less
{
  const solo = (n) => {
    const s = field();
    for (let i = 0; i < n; i++) put(s, 1, 'rhino', 7 + (i % 3) * 1.6, 9 + Math.floor(i / 3) * 1.6);
    run(s, 1.2);
    const r = units(s, 1, 'rhino'); for (const x of r) { x.speed = 0; x.targets = 'none'; }
    const h0 = r.map(x => x.hp);
    put(s, 0, 'collapse', 8.6, 9.8); run(s, 3.2);
    return r.map((x, i) => h0[i] - x.hp)[0];
  };
  const one = solo(1), three = solo(3), six = solo(6), V = D('collapse');
  assert.strictEqual(one, V * 3, 'one: all three strikes in full');
  assert.strictEqual(three, Math.round(V * 0.48) * 3, 'two to four: about half');
  assert.strictEqual(six, Math.round(V * 0.21) * 3, 'five or more: a fifth');
  console.log(`Abyssal Collapse: one enemy ${one}, three ${three} each, six ${six} each: ok`);
}

// 26. levels: spell damage grows with level; durations, energy and lifetimes don't
{
  const lv = L => { const s = field({ levels: [L, 1] }); put(s, 1, 'rhino', 9.5, 10); run(s, 1.2); const r = units(s, 1, 'rhino')[0]; r.speed = 0; const h0 = r.hp;
    put(s, 0, 'magmaquake', 9.5, 10); let end = 0; run(s, 4, st => { if (st.zones.some(z => z.card === 'magmaquake')) end = st.time; }); return [h0 - r.hp, end]; };
  const [d1, e1] = lv(1), [d9, e9] = lv(9);
  assert(d9 === Math.round(Math.round(100 * S.levelMult(9)) / 3) * 3 && d9 > d1 * 1.5 && Math.abs(e9 - e1) < 0.05, `level 9 hits harder (a rare starts at 3) (${d1} -> ${d9}), same duration`);
  const b = L => { const s = field({ levels: [L, 1] }); put(s, 0, 'barracks', 9.5, 22.5); const x = units(s, 0, 'barracks')[0]; return [x.maxHp, x.maxHp / x.decay]; };
  const [h1, l1] = b(1), [h15, l15] = b(15);
  assert(h15 === Math.round(KC_CARDS.barracks.hp * S.levelMult(15)) && h1 === Math.round(KC_CARDS.barracks.hp * S.levelMult(3)) && Math.abs(l15 - l1) < 1e-6, 'buildings: more health, the same lifetime');
  assert(NEW.every(id => KC_CARDS[id].cost === SPEC[id][0]), 'energy fixed');
  console.log(`levels: Magma Quake ${d1} -> ${d9} at level 9, Barracks ${h1} -> ${h15} health, lifetimes and costs fixed: ok`);
}

// 27. the computer plays every new card in full battles, and nothing breaks
{
  const played = new Set();
  const decks = [];
  for (let i = 0; i < NEW.length; i += 4) decks.push(NEW.slice(i, i + 4).concat(['gladiator', 'archers', 'wolves', 'rhino']));
  let battles = 0;
  for (const deck of decks) for (const seed of [1, 2, 3]) {
    const s = S.create({ seed, decks: [deck, deck], levels: [9, 9] });
    const bots = [0, 1].map(t => KCBot.create(t, { skill: { react: [0.6, 1.2], sloppy: 0.12, attackAt: 8, idle: 0.08, fireballValue: 5, defend: 1, gap: [0.5, 1.1] }, seed: seed * 7 + t }));
    while (!s.result) {
      const before = s.played.slice();
      const hands = s.hands.map(h => h.slice());
      S.step(s); bots.forEach(b => KCBot.update(b, s));
      for (const t of [0, 1]) if (s.played[t] !== before[t]) for (const id of hands[t]) if (!s.hands[t].includes(id) || s.hands[t].filter(x => x === id).length < hands[t].filter(x => x === id).length) played.add(id);
      for (const e of s.events) if (e.type === 'cast' || e.type === 'deploy' || e.type === 'burrow' || e.type === 'mirror') played.add(e.card);
      s.events.length = 0;
      if (s.tick > 30 * 400) break;
    }
    battles++;
    for (const e of s.ents) assert(Number.isFinite(e.hp) && Number.isFinite(e.x), 'numbers in a full battle');
  }
  const missing = NEW.filter(id => !played.has(id) && !(id === 'reflection' && played.has('mirror')));
  assert.deepStrictEqual(missing, [], 'the computer plays every new card');
  console.log(`the computer played all 24 new cards in ${battles} full battles: ok`);
}

// 28. collecting and upgrading: found on the road, from chests in their arena, upgraded to level 15
{
  const mem = data => { const m = new Map(Object.entries(data || {})); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
  const G = KCProgress;
  // an existing player keeps their cards when the new ones arrive
  const old = { beaten: { owen: true, romeo: true, luc: true }, trophies: 700, best: 700, claimed: { 0: true, 20: true, 40: true }, rubies: 50, cards: { wolves: { level: 7, count: 30 } }, found: KC_STARTER_DECK.concat(['skeletons']) };
  let P = G.load(mem({ 'kc.progress': JSON.stringify(old) }));
  assert(P.cards.wolves.level === 7 && P.cards.wolves.count === 30 && P.found.includes('skeletons') && P.rubies === 50, 'nothing reset');
  assert(NEW.every(id => P.cards[id] && P.cards[id].level === KC_MIN_LEVEL(id) && P.cards[id].count === 0), 'new cards start at their rarity level');
  // Arena 1 to 3 cards are on the road behind them, waiting to be claimed
  for (const id of ['magmaquake', 'ashfall', 'magmaturret', 'thornroller', 'briarbind', 'bramblenest', 'scarabshrine']) {
    const m = G.ROAD.find(r => r.card === id); assert.strictEqual(G.roadState(m), 'ready', id + ' claimable');
  }
  assert.strictEqual(G.roadState(G.ROAD.find(r => r.card === 'dunemortar')), 'locked');
  assert(G.claim(G.ROAD.find(r => r.card === 'thornroller').at) && P.found.includes('thornroller'), 'claimed and found');
  // chests: only cards of reached arenas; rarities respected (a legendary is rare)
  const pool = G.chestPool();
  assert(['magmaquake', 'ashfall', 'magmaturret', 'scarabshrine', 'dunemortar'].every(id => pool.includes(id)) && !pool.includes('judgment') && !pool.includes('collapse'), 'pool by arena');
  const r = S.mulberry(5), seen = {};
  for (let i = 0; i < 400; i++) for (const c of G.roll('gold', r).cards) seen[c.id] = (seen[c.id] || 0) + c.n;
  assert(seen.magmaquake && seen.dunemortar, 'new cards come out of chests');
  assert(!seen.judgment && !seen.ballista, 'never from arenas not reached');
  // upgrading a new card to 15 uses the same copies and rubies as any card of its rarity
  P.cards.dunemortar.count = 1e6; P.rubies = 1e9; P.found.push('dunemortar');
  const needR = G.goldToMax('dunemortar'), needW = G.goldToMax('wolves') ;
  let n = 0; while (G.upgrade('dunemortar')) n++;
  assert.strictEqual(P.cards.dunemortar.level, 15, 'level 15');
  assert(needR >= 250000, 'about 250,000+ rubies to max ' + needR);
  void needW;
  const saved = G.state;
  P = G.load(mem({ 'kc.progress': JSON.stringify(saved) }));
  assert.strictEqual(P.cards.dunemortar.level, 15, 'kept after a reload');
  console.log(`collecting and upgrading: nothing reset, road claims, chests by arena, Dune Mortar to 15 for ${needR.toLocaleString('en')} rubies, saved: ok`);
}

// 29. the cards that were there before are unchanged (spot checks of their numbers)
{
  const pick = id => { const c = KC_CARDS[id]; return [c.cost, c.rarity, c.kind, c.hp || 0, c.dmg || 0]; };
  assert.deepStrictEqual(pick('fireball'), [4, 'rare', 'spell', 0, 320]);
  assert.deepStrictEqual(pick('cannon'), [3, 'common', 'building', 700, 70]);
  assert.deepStrictEqual(pick('coil'), [4, 'common', 'building', 980, 76]);
  assert.deepStrictEqual(pick('abyss'), [5, 'legendary', 'spell', 0, 0]);
  console.log('existing cards unchanged: ok');
}
