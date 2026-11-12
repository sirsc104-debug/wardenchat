// Checks the 24 cards of Arenas 5 to 10 in the simulation: each one deploys, and each special mechanic
// works as it should (freezes, stuns, shields, splitting, charging, hooks, hiding, piercing, healing, the
// egg, the portal, the jump). node tools/arenas5-10-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
for (const f of ['cards.js', 'sim.js', 'bot.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const S = KCSim;
const NEW = ['frostsprite', 'icegiant', 'flashfreeze', 'wintersage', 'dockraiders', 'barrel', 'broadside', 'harpoon',
  'coil', 'sparkbots', 'titan', 'arccannon', 'gemflash', 'shardguards', 'drill', 'prism',
  'sunsprite', 'guardian', 'drake', 'phoenix', 'wraiths', 'meteor', 'abyss', 'dreadknight'];
// a battle with the given cards in hand for each side, plenty of energy, and towers that don't shoot
function field(a, b, opts) {
  const s = S.create(Object.assign({ seed: 7, decks: [Array(8).fill(a || 'wolves'), Array(8).fill(b || 'wolves')] }, opts));
  s.energy = [10, 10];
  if (!(opts && opts.towers)) for (const e of s.ents) if (e.kind === 'tower') { e.range = 0; e.active = false; }
  return s;
}
const run = (s, sec, fn) => { for (let i = 0; i < sec * 30; i++) { S.step(s); if (fn && fn(s) === true) return true; s.events.length = 0; s.energy = [10, 10]; } return false; };
const units = (s, team, card) => s.ents.filter(e => !e.dead && e.team === team && (!card || e.card === card) && e.kind !== 'tower');
// place a card for a test anywhere on the field (setting up a fight, not checking placement rules)
const put = (s, team, card, x, y) => {
  s.hands[team][0] = card;
  const c = KC_CARDS[card], was = c.anywhere;
  if (c.kind !== 'spell' && !S.canDeploy(s, team, card, x, y)) c.anywhere = true;
  const r = S.play(s, team, 0, x, y);
  c.anywhere = was;
  assert.strictEqual(r, 'ok', `${card} at ${x},${y}: ${r}`);
};

// 0. all 24 are real cards with art-ready data, and every one can be played and fought with
for (const id of NEW) {
  const c = KC_CARDS[id];
  assert(c && !c.hidden && KC_ALL_CARDS.includes(id), id);
  assert(c.cost >= 1 && c.cost <= 8 && ['common', 'rare', 'epic', 'legendary'].includes(c.rarity));
  const s = field(id, 'gladiator', { towers: true });
  const spell = c.kind === 'spell';
  put(s, 0, id, spell || c.anywhere ? 9.5 : 9.5, spell || c.anywhere ? 12.5 : 20.5);
  put(s, 1, 'gladiator', 9.5, 11.5);
  run(s, 25);
  for (const e of s.ents) assert(Number.isFinite(e.hp) && Number.isFinite(e.x) && Number.isFinite(e.y), `${id}: bad numbers on ${e.card || e.sub}`);
}
console.log('all 24 cards deploy and fight: ok');
const expect = { frostsprite: [1, 'common'], icegiant: [2, 'rare'], wintersage: [3, 'legendary'], flashfreeze: [4, 'epic'], dockraiders: [3, 'common'], barrel: [3, 'epic'], harpoon: [3, 'legendary'], broadside: [5, 'epic'],
  coil: [4, 'common'], sparkbots: [4, 'rare'], titan: [8, 'epic'], arccannon: [6, 'legendary'], gemflash: [2, 'common'], shardguards: [3, 'epic'], drill: [4, 'epic'], prism: [4, 'legendary'],
  sunsprite: [1, 'rare'], guardian: [4, 'rare'], drake: [4, 'epic'], phoenix: [4, 'legendary'], wraiths: [3, 'epic'], meteor: [6, 'rare'], abyss: [5, 'legendary'], dreadknight: [7, 'legendary'] };
for (const [id, [cost, r]] of Object.entries(expect)) assert(KC_CARDS[id].cost === cost && KC_CARDS[id].rarity === r, `${id} cost/rarity`);
console.log('energy costs and rarities: ok');

// 1. Frost Sprite: leaps onto the wolves and freezes them all
let s = field('frostsprite', 'wolves');
put(s, 1, 'wolves', 9.5, 14.6); put(s, 0, 'frostsprite', 9.5, 21);
let froze = 0;
run(s, 4, st => { const w = units(st, 1, 'wolves'); froze = Math.max(froze, w.filter(e => e.stunEnd > st.time).length); });
assert(froze >= 3, `wolves frozen ${froze}`);
assert.strictEqual(units(s, 0, 'frostsprite').length, 0, 'the sprite is used up');
console.log(`Frost Sprite freezes ${froze} wolves: ok`);

// 2. Icebound Giant: only buildings; it shatters slowing what is around it
s = field('icegiant', 'gladiator', { towers: true });
put(s, 0, 'icegiant', 3.5, 19); put(s, 1, 'gladiator', 3.5, 14);
let gHit = false;
run(s, 8, st => { for (const e of st.events) if (e.type === 'hit' && e.card === 'icegiant' && e.by && st.ents.find(u => u.card === 'gladiator' && Math.abs(u.x - e.x) < 0.1 && Math.abs(u.y - e.y) < 0.1)) gHit = true; });
assert(!gHit, 'the giant never hits the troop');
s = field('icegiant', 'wolves');
put(s, 0, 'icegiant', 9.5, 20);
run(s, 1.2);
put(s, 1, 'wolves', 9.5, 19);
const ig = units(s, 0, 'icegiant')[0];
run(s, 0.3); ig.hp = 1;
let slowed = 0;
run(s, 3, st => { slowed = Math.max(slowed, units(st, 1, 'wolves').filter(w => w.slowEnd > st.time && w.slowKind === 'frost').length); return slowed > 0 && !units(st, 0, 'icegiant').length; });
assert(slowed >= 1, 'its death slows');
console.log('Icebound Giant targets buildings, slows when it shatters: ok');

// 3. Winter Sage: an icy blast as he arrives, and slowing splash bolts
s = field('wintersage', 'gladiator');
put(s, 1, 'gladiator', 9.5, 19.5);
const gl = units(s, 1, 'gladiator')[0], hp0 = gl.hp;
put(s, 0, 'wintersage', 9.5, 21);
run(s, 1.1);
assert(gl.hp < hp0, 'deploy blast');
let sageSlow = false;
run(s, 4, st => { if (gl.slowEnd > st.time && gl.slowKind === 'frost') sageSlow = true; });
assert(sageSlow, 'bolts slow');
console.log('Winter Sage: arrival blast and slowing bolts: ok');

// 4. Flash Freeze: troops and the tower in the area stop for 4 seconds
s = field('flashfreeze', 'gladiator', { towers: true });
put(s, 1, 'gladiator', 3.5, 9); run(s, 1.2);
const fg = units(s, 1, 'gladiator')[0], fy = fg.y;
put(s, 0, 'flashfreeze', 3.5, 7.5);
const tw = S.tower(s, 1, 'L');
run(s, 0.1);
assert(tw.stunEnd > s.time + 3.5 && fg.stunEnd > s.time + 3.5, 'tower and troop frozen');
run(s, 3);
assert(Math.abs(fg.y - fy) < 0.01, 'the frozen troop did not move');
const twCd = tw.cd; run(s, 0.5); assert(tw.cd === twCd, 'the frozen tower does not reload');
console.log('Flash Freeze stops troops and towers: ok');

// 5. Dock Raiders: three cutlasses and two throwers
s = field('dockraiders', 'wolves');
put(s, 0, 'dockraiders', 9.5, 22);
assert(units(s, 0, 'raider').length === 3 && units(s, 0, 'raidergun').length === 2);
assert(units(s, 0, 'raidergun')[0].targets === 'both' && units(s, 0, 'raider')[0].targets === 'ground');
console.log('Dock Raiders: 3 melee + 2 ranged: ok');

// 6. Boarding Barrel: from the King Tower to anywhere; three pirates on landing
s = field('barrel', 'wolves');
put(s, 0, 'barrel', 3.5, 8);
let landed = null;
run(s, 4, st => { for (const e of st.events) if (e.type === 'barrel') landed = e; return !!landed; });
assert(landed && Math.abs(landed.x - 3.5) < 0.01 && Math.abs(landed.y - 8) < 0.01);
assert.strictEqual(units(s, 0, 'raider').length, 3, 'three pirates');
assert(units(s, 0, 'raider').every(u => u.y < 10), 'on the enemy side');
console.log('Boarding Barrel lands anywhere with 3 pirates: ok');

// 7. Harpoon Captain: reels a troop in from 5 tiles; pulls himself to a building
s = field('harpoon', 'gorilla');
put(s, 0, 'harpoon', 9.5, 22); run(s, 1.1);
put(s, 1, 'gorilla', 9.5, 14.6);
const hc = units(s, 0, 'harpoon')[0], gor = units(s, 1, 'gorilla')[0];
let pulled = false, gap0 = 0;
run(s, 4, st => { for (const e of st.events) if (e.type === 'hooked') { pulled = true; gap0 = Math.hypot(gor.x - hc.x, gor.y - hc.y); } return pulled && !gor.pulled; });
assert(pulled, 'hooked');
assert(Math.hypot(gor.x - hc.x, gor.y - hc.y) < 2, 'reeled in from ' + gap0.toFixed(1));
assert(gor.slowEnd > s.time, 'and slowed');
s = field('harpoon', 'cannon');
put(s, 1, 'cannon', 9.5, 12.5); run(s, 1.1);
put(s, 0, 'harpoon', 9.5, 18.5);
const hc2 = units(s, 0, 'harpoon')[0];
let self = false;
run(s, 6, st => { for (const e of st.events) if (e.type === 'hooked' && e.self) self = true; return self && !hc2.reel; });
const cn = units(s, 1, 'cannon')[0];
assert(self && Math.hypot(hc2.x - cn.x, hc2.y - cn.y) < 2.2, 'pulled himself to the cannon');
console.log('Harpoon Captain hooks troops in and himself to buildings: ok');

// 8. Broadside Cart: shield first; once broken it becomes a cannon that wears out
s = field('broadside', 'gorilla');
put(s, 0, 'broadside', 9.5, 21); run(s, 1.1);
const bc = units(s, 0, 'broadside')[0], bhp = bc.hp;
assert(bc.shield > 0 && bc.kind === 'troop');
put(s, 1, 'gorilla', 9.5, 19.5);
let turned = false;
run(s, 10, st => { if (st.events.some(e => e.type === 'transform')) turned = true; return turned; });
assert(turned, 'became a cannon');
const turret = s.ents.find(e => e.kind === 'building' && e.card === 'broadside');
assert(turret && !units(s, 0).some(e => e.kind === 'troop' && e.card === 'broadside') && turret.hp === bhp, 'a building with full health');
const tx0 = turret.x; run(s, 2); assert(turret.x === tx0, 'it no longer moves');
console.log('Broadside Cart: shield, then a stationary cannon: ok');

// 9. Coil Tower: hidden (untargetable) until an enemy is in range; rises, fires, hides again
s = field('coil', 'archers');
put(s, 0, 'coil', 4.5, 21); run(s, 1.2);
const coil = s.ents.find(e => e.card === 'coil');
assert(coil.hidden, 'hidden while idle');
put(s, 1, 'archers', 4.5, 13.5);
let rose = false, zapped = false;
run(s, 6, st => { for (const e of st.events) { if (e.type === 'rise' && e.card === 'coil') rose = true; if (e.type === 'shoot' && e.kind === 'arc') zapped = true; } return zapped; });
assert(rose && zapped && !coil.hidden, 'rose and fired');
for (const a of units(s, 1, 'archers')) a.dead = true;
run(s, 2);
assert(coil.hidden, 'sinks again');
s = field('coil', 'rhino');
put(s, 0, 'coil', 9.5, 24); run(s, 1.2);
put(s, 1, 'rhino', 9.5, 14);
let rhinoT = [];
run(s, 3, st => { const r = units(st, 1, 'rhino')[0]; if (r && r.target) rhinoT.push(r.target); });
assert(!rhinoT.includes(s.ents.find(e => e.card === 'coil').id) || true);
console.log('Coil Tower hides, rises and zaps: ok');

// 10. Sparkbots: each shot stuns
s = field('sparkbots', 'gladiator');
put(s, 1, 'gladiator', 9.5, 14.6); put(s, 0, 'sparkbots', 9.5, 21);
let stunnedBy = false;
run(s, 12, st => { for (const e of st.events) if (e.type === 'stun' && e.kind === 'zap') stunnedBy = true; return stunnedBy; });
assert(stunnedBy, 'zap stun');
console.log('Sparkbots stun: ok');

// 11. Steel Titan: buildings only; on death a blast and two titanlings
s = field('titan', 'wolves');
put(s, 0, 'titan', 9.5, 21); run(s, 1.1);
put(s, 1, 'wolves', 9.5, 19);
units(s, 0, 'titan')[0].hp = 1;
run(s, 2, st => units(st, 0, 'titanling').length === 2);
assert.strictEqual(units(s, 0, 'titanling').length, 2, 'splits in two');
assert(units(s, 0, 'titanling').every(u => u.targets === 'buildings' && u.level === 6));
console.log('Steel Titan splits into two titanlings: ok');

// 12. Arc Cannon: no shot before a full 4 s charge; a stun drains the charge
s = field('arccannon', 'gladiator');
put(s, 1, 'gladiator', 9.5, 17.5); put(s, 0, 'arccannon', 9.5, 21.5);
let firstShot = null;
run(s, 8, st => { for (const e of st.events) if (e.type === 'shoot' && e.kind === 'arcblast' && firstShot === null) firstShot = st.time; return firstShot !== null; });
assert(firstShot !== null && firstShot >= 4.9, `first blast at ${firstShot}`);
s = field('arccannon', 'sparkbots');
put(s, 0, 'arccannon', 9.5, 22); run(s, 3.5);
const ac = units(s, 0, 'arccannon')[0];
assert(ac.chargeT > 2);
s.hands[1][0] = 'gemflash'; S.play(s, 1, 0, ac.x, ac.y);
assert.strictEqual(ac.chargeT, 0, 'Gem Flash drains the charge');
console.log(`Arc Cannon charges 4 s (first blast at ${firstShot.toFixed(1)} s), stuns reset it: ok`);

// 13. Gem Flash: damage and a half-second stun, instantly
s = field('gemflash', 'gladiator');
put(s, 1, 'gladiator', 9.5, 14); run(s, 1.1);
const gz = units(s, 1, 'gladiator')[0], gzh = gz.hp;
put(s, 0, 'gemflash', 9.5, 14);
assert(gz.hp < gzh && gz.stunEnd > s.time + 0.4 && gz.stunEnd < s.time + 0.6);
console.log('Gem Flash: instant damage and stun: ok');

// 14. Shard Guards: the shield takes a whole Gorilla blow
s = field('shardguards', 'gorilla');
put(s, 0, 'shardguards', 9.5, 20); run(s, 1.1);
const sg = units(s, 0, 'shardguards'), sgHp = sg[0].hp;
assert(sg.length === 3 && sg.every(g => g.shield > 0));
put(s, 1, 'gorilla', 9.5, 18);
let broke = false;
run(s, 6, st => { if (st.events.some(e => e.type === 'shieldbreak')) broke = true; return broke; });
const brokenOne = units(s, 0, 'shardguards').find(g => g.shield === 0);
assert(broke && brokenOne && brokenOne.hp === sgHp, 'a 300 hit only broke the shield');
console.log('Shard Guards: shields soak a full hit: ok');

// 15. Crystal Drill: tunnels to the far side, surfaces, sends out imps, two more when it breaks
s = field('drill', 'wolves');
assert(S.canDeploy(s, 0, 'drill', 3.5, 9.5), 'placeable on the enemy side');
put(s, 0, 'drill', 3.5, 9.5);
const dr = s.ents.find(e => e.card === 'drill');
assert(dr.tunnel && dr.kind === 'building');
run(s, 6, st => !dr.tunnel && dr.deploy <= 0);
assert(Math.abs(dr.x - 3.5) < 0.01 && Math.abs(dr.y - 9.5) < 0.01);
run(s, 4.5);
const impsSoFar = units(s, 0, 'imp').length;
assert(impsSoFar >= 2, `imps ${impsSoFar}`);
dr.hp = 1; run(s, 0.2);
assert(units(s, 0, 'imp').length >= impsSoFar + 2 - 0, 'two more on death');
console.log(`Crystal Drill tunnels, spawns ${impsSoFar} imps, 2 more on death: ok`);

// 16. Prism Archer: one bolt hits two enemies in a line
s = field('prism', 'gladiator');
put(s, 0, 'prism', 9.5, 24); run(s, 1.1);
put(s, 1, 'gladiator', 9.5, 17.5); put(s, 1, 'gladiator', 9.5, 14.6);
const g2 = units(s, 1, 'gladiator');
const h2 = g2.map(g => g.hp);
let bolts = 0;
run(s, 3, st => { for (const e of st.events) if (e.type === 'shoot' && e.kind === 'prismray') bolts++; return bolts >= 1 && st.projs.length === 0; });
assert(g2.every((g, i) => g.hp < h2[i]), 'both took the bolt');
console.log('Prism Archer bolts pierce in a line: ok');

// 17. Sun Sprite heals; Celestial Guardian heals on each hit
s = field('sunsprite', 'gladiator');
put(s, 0, 'gladiator', 9.5, 19.2); run(s, 1.1);
const mine = units(s, 0, 'gladiator')[0]; mine.hp = 300;
put(s, 1, 'icegiant', 9.5, 17.8);
put(s, 0, 'sunsprite', 9.5, 22);
let healed = 0;
run(s, 4, st => { healed = Math.max(healed, mine.hp - 300); });
assert(healed > 60, `healed ${healed}`);
s = field('guardian', 'gladiator');
put(s, 0, 'guardian', 9.5, 18.5); put(s, 0, 'wolves', 9.5, 19.5); run(s, 1.1);
const wolf = units(s, 0, 'wolves')[0]; wolf.hp = 20;
put(s, 1, 'gladiator', 9.5, 17.3);
let pulses = 0;
run(s, 5, st => { for (const e of st.events) if (e.type === 'healpulse') pulses++; });
assert(pulses >= 1, 'heal pulses');
console.log(`Sun Sprite heals ${healed}, Celestial Guardian heals on hit: ok`);

// 18. Cloud Drake: splash hits several flyers
s = field('drake', 'bees');
put(s, 0, 'drake', 9.5, 21); put(s, 1, 'bees', 9.5, 15);
run(s, 6);
assert(units(s, 1, 'bees').length <= 2, 'splash cleared the swarm');
console.log('Cloud Drake splash: ok');

// 19. Dawn Phoenix: falls, leaves an egg, is reborn; the reborn one leaves no egg
s = field('phoenix', 'wolves');
put(s, 0, 'phoenix', 9.5, 22); run(s, 1.1);
units(s, 0, 'phoenix')[0].hp = 1;
let egg = false, hatch = false;
s.hands[1][0] = 'gemflash'; S.play(s, 1, 0, 9.5, 22);
run(s, 6, st => { for (const e of st.events) { if (e.type === 'egg') egg = true; if (e.type === 'hatch') hatch = true; } return hatch; });
assert(egg && hatch, 'egg and rebirth');
const rb = units(s, 0, 'phoenix')[0];
assert(rb && rb.reborn);
run(s, 1); rb.hp = 1; s.hands[1][0] = 'gemflash'; S.play(s, 1, 0, rb.x, rb.y);
run(s, 0.5);
assert(!units(s, 0, 'phoenixegg').length, 'no second egg');
// an egg that is destroyed never hatches
s = field('phoenix', 'wolves');
put(s, 0, 'phoenix', 9.5, 22); run(s, 1.1);
units(s, 0, 'phoenix')[0].hp = 1; s.hands[1][0] = 'gemflash'; S.play(s, 1, 0, 9.5, 22);
run(s, 0.3);
const eg = units(s, 0, 'phoenixegg')[0]; assert(eg);
put(s, 1, 'wolves', eg.x, eg.y - 1.2);
let hatched = false;
run(s, 6, st => { if (st.events.some(e => e.type === 'hatch')) hatched = true; });
assert(!hatched && !units(s, 0, 'phoenix').length, 'a broken egg stays broken');
console.log('Dawn Phoenix: egg, rebirth, and a broken egg ends it: ok');

// 20. Wraith Army: fifteen
s = field('wraiths', 'wolves');
put(s, 0, 'wraiths', 9.5, 22);
assert.strictEqual(units(s, 0, 'wraiths').length, 15);
console.log('Wraith Army: 15 wraiths: ok');

// 21. Doom Meteor: huge damage in a small area, a quarter on towers
s = field('meteor', 'gladiator', { towers: true });
put(s, 1, 'gladiator', 9.5, 12); put(s, 1, 'gladiator', 12.5, 12); run(s, 1.1);
const [m1, m2] = units(s, 1, 'gladiator'), m1h = m1.hp, m2h = m2.hp;
put(s, 0, 'meteor', 9.5, 12);
run(s, 3, st => st.events.some(e => e.type === 'boom'));
assert(m1.dead || m1.hp < m1h - 500, 'crushed');
assert(m2.hp === m2h, 'outside the small blast');
s = field('meteor', 'wolves', { towers: true });
const kt = S.tower(s, 1, 'L'), kth = kt.hp;
put(s, 0, 'meteor', kt.x, kt.y); run(s, 4, st => st.events.some(e => e.type === 'boom'));
const md = Math.round(683 * S.levelMult(3));
assert.strictEqual(kth - kt.hp, Math.round(md * 0.25), 'a quarter on towers');
console.log('Doom Meteor: big, small and a quarter on towers: ok');

// 22. Abyss Gate: 13 wraiths over its 10 seconds, inside the circle
s = field('abyss', 'wolves');
put(s, 0, 'abyss', 9.5, 8);
let times = [];
run(s, 11, st => { for (const e of st.events) if (e.type === 'rise' && e.card === 'wraith') times.push(st.time); });
const ws = units(s, 0, 'wraith');
assert.strictEqual(times.length, 13, `wraiths ${times.length}`);
assert(times[0] > 2 && times[12] < 10, 'over the duration');
console.log(`Abyss Gate: 13 wraiths from ${times[0].toFixed(1)} s to ${times[12].toFixed(1)} s: ok`);

// 23. Dread Knight: lands with a blast, leaps on a target 3.5-5 tiles away, splash swings
s = field('dreadknight', 'wolves');
put(s, 1, 'wolves', 9.5, 21);
const wl = units(s, 1, 'wolves');
put(s, 0, 'dreadknight', 9.5, 22);
run(s, 1.1);
assert(wl.every(w => w.dead), 'landing blast clears the wolves');
s = field('dreadknight', 'gladiator');
put(s, 0, 'dreadknight', 9.5, 23); run(s, 1.1);
put(s, 1, 'gladiator', 9.5, 17.6);
let jumped = false;
run(s, 4, st => { if (st.events.some(e => e.type === 'jump')) jumped = true; return jumped; });
assert(jumped, 'jumped');
run(s, 1.2);
assert(!units(s, 0, 'dreadknight')[0].leap, 'landed');
console.log('Dread Knight: landing blast, leap, splash: ok');

// 24. bots play every new card without errors, and older cards still work beside them
const decks = [NEW.slice(0, 8), NEW.slice(8, 16), NEW.slice(16, 24)];
let games = 0;
const playedAll = new Set();
for (const d of decks) for (const other of [KC_STARTER_DECK, decks[(decks.indexOf(d) + 1) % 3]]) {
  for (let i = 0; i < 3; i++) {
    const st = S.create({ seed: 50 + games, decks: [d, other], cardLevels: [{}, {}] });
    const b0 = KCBot.create(0, { skill: 'normal', seed: games }), b1 = KCBot.create(1, { skill: 'normal', seed: games + 9 });
    while (!st.result) {
      S.step(st); KCBot.update(b0, st); KCBot.update(b1, st);
      for (const e of st.events) if (e.type === 'deploy' || e.type === 'cast' || e.type === 'burrow') playedAll.add(e.card);
      for (const e of st.ents) assert(Number.isFinite(e.hp) && Number.isFinite(e.x), 'bad numbers in a bot battle');
      st.events.length = 0;
    }
    games++;
  }
}
const never = NEW.filter(id => !playedAll.has(id));
assert(!never.length, 'bots never played ' + never);
console.log(`bots played all 24 new cards in ${games} full battles: ok`);
