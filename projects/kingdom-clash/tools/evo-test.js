// Checks the evolutions: every evolution card evolves on the right play, and each evolved card does what
// it says (js/cards.js KC_EVOS, js/sim.js), against a plain copy in the same fight.
// node tools/evo-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
for (const f of ['cards.js', 'sim.js', 'bot.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const S = KCSim, EVEN = Object.fromEntries(Object.keys(KC_CARDS).map(id => [id, 9]));

// a fight: their cards cross the river first, then our card (evolved or not) is played right in front of
// them, so both sides meet; measured over `secs` seconds from then
function fight(card, foes, evolved, opts = {}) {
  const s = S.create({ seed: 7, decks: [Array(8).fill(card), foes.concat(foes, foes, foes).slice(0, 8)], cardLevels: [EVEN, EVEN], evos: [evolved ? [card] : [], []] });
  // play it once far away so the next one is the evolved one (every cycle-th play)
  for (let i = 0; i < KC_EVOS[card].cycle - 1; i++) { s.energy[0] = 10; S.play(s, 0, 0, 3, 30); }
  for (const [i, f] of foes.entries()) { s.energy[1] = 10; const r = S.play(s, 1, s.hands[1].indexOf(f), 3.5 + (i - (foes.length - 1) / 2) * 0.8, 13); assert.strictEqual(r, 'ok', 'their ' + f + ' is played'); }
  const theirs = () => s.ents.filter(e => e.team === 1 && e.kind === 'troop' && !e.dead);
  for (let t = 0; t < 30 * 30 && !theirs().some(e => e.y > 19); t++) { S.step(s); s.events.length = 0; }
  const lead = theirs().sort((a, b) => b.y - a.y)[0];
  s.energy[0] = 10; assert.strictEqual(S.play(s, 0, 0, lead.x, Math.min(30, lead.y + 1.5)), 'ok', 'ours is played');
  const ev = {}, hp = team => s.ents.filter(e => e.team === team && e.kind === 'troop' && !e.dead).reduce((a, e) => a + e.hp + (e.shield || 0), 0);
  const start = hp(1);
  for (let t = 0; t < 30 * (opts.secs || 6) && !s.result; t++) {
    S.step(s);
    for (const e of s.events) {
      const k = e.evoHit || (e.type === 'ricochet' || e.type === 'slam' || e.type === 'shieldbreak' ? e.type : null);
      if (k) ev[k] = (ev[k] || 0) + 1;
    }
    s.events.length = 0;
  }
  return { ev, dealt: start - hp(1), left: hp(0), s };
}

// the cycle: with an evolution, every cycle-th play of the card is evolved
for (const id of Object.keys(KC_EVOS)) {
  const s = S.create({ seed: 1, decks: [Array(8).fill(id), KC_STARTER_DECK], evos: [[id], []] });
  const evolved = [];
  for (let i = 0; i < KC_EVOS[id].cycle * 2; i++) {
    s.energy[0] = 10; S.play(s, 0, 0, 9, 26);
    evolved.push(s.events.some(e => (e.type === 'deploy' || e.type === 'cast') && e.evo));
    s.events.length = 0;
  }
  const want = evolved.map((_, i) => i % KC_EVOS[id].cycle === KC_EVOS[id].cycle - 1);
  assert.deepStrictEqual(evolved, want, `${id}: every ${KC_EVOS[id].cycle} plays`);
  assert(KC_CARDS[id].evo && KC_EVOS[id].blurb && KC_EVOS[id].shards === 6, `${id}: described, 6 shards`);
}
console.log(`${Object.keys(KC_EVOS).length} evolutions (${Object.keys(KC_EVOS).join(', ')}) come round on the right play: ok`);

// Archers: arrows bounce on to a second enemy
{
  const e = fight('archers', ['gladiator', 'gladiator', 'gladiator'], true), p = fight('archers', ['gladiator', 'gladiator', 'gladiator'], false);
  assert(e.ev.ricochet > 0 && !p.ev.ricochet, 'evolved arrows ricochet');
  assert(e.dealt > p.dealt, `more damage to a group (${e.dealt} vs ${p.dealt})`);
  console.log(`Archers: ${e.ev.ricochet} ricochets, ${e.dealt} damage to a group against ${p.dealt}: ok`);
}
// Wolves: they bite faster in a pack
{
  const e = fight('wolves', ['titan'], true, { secs: 5 }), p = fight('wolves', ['titan'], false, { secs: 5 });
  assert(e.dealt > p.dealt * 1.08, `the pack bites faster (${e.dealt} vs ${p.dealt})`);
  console.log(`Wolves: ${e.dealt} damage to a Titan in 5 s against ${p.dealt}: ok`);
}
// Gladiator: a shield, and a bash when it breaks
{
  const e = fight('gladiator', ['wolves', 'skeletons'], true), p = fight('gladiator', ['wolves', 'skeletons'], false);
  assert(e.ev.shieldbreak >= 1 && e.ev.slam >= 1 && !p.ev.slam, 'the shield breaks with a bash');
  assert(e.left > p.left, `it survives better (${e.left} vs ${p.left} health left)`);
  console.log(`Gladiator: shield then bash, ${e.left} health left against ${p.left}: ok`);
}
// Hawks: a dive on each new target
{
  const e = fight('hawks', ['wolves', 'gladiator'], true), p = fight('hawks', ['wolves', 'gladiator'], false);
  assert(e.ev.dive >= 2 && !p.ev.dive, 'evolved hawks dive');
  assert(e.dealt > p.dealt, `more damage (${e.dealt} vs ${p.dealt})`);
  console.log(`Hawks: ${e.ev.dive} dives, ${e.dealt} damage against ${p.dealt}: ok`);
}
// Gorilla: every third hit is a chest pound
{
  const e = fight('gorilla', ['titan'], true, { secs: 8 }), p = fight('gorilla', ['titan'], false, { secs: 8 });
  assert(e.ev.pound >= 1 && !p.ev.pound, 'chest pounds');
  assert(e.dealt > p.dealt * 1.08, `more damage to a tank (${e.dealt} vs ${p.dealt})`);
  console.log(`Gorilla: ${e.ev.pound} chest pounds, ${e.dealt} damage against ${p.dealt}: ok`);
}
// Fireball: burning ground for 2 seconds
{
  const run = evolved => {
    const s = S.create({ seed: 3, decks: [Array(8).fill('fireball'), Array(8).fill('gladiator')], cardLevels: [EVEN, EVEN], evos: [evolved ? ['fireball'] : [], []] });
    s.energy = [10, 10]; S.play(s, 1, 0, 9, 13);
    S.play(s, 0, 0, 3, 8); s.energy[0] = 10; S.play(s, 0, 0, 9, 13);
    let burn = 0, boom = 0;
    for (let t = 0; t < 30 * 4; t++) { S.step(s); if (s.zones.some(z => z.kind === 'burn')) burn++; for (const e of s.events) if (e.type === 'boom' && e.evo) boom++; s.events.length = 0; }
    const g = s.ents.find(e => e.card === 'gladiator' && e.team === 1);
    return { burn, boom, hp: g ? g.hp : 0 };
  };
  const e = run(true), p = run(false);
  assert(e.boom === 1 && e.burn >= 55 && e.burn <= 65 && !p.burn, `the second Fireball burns for 2 s (${e.burn} ticks)`);
  assert(e.hp < p.hp, 'the burn does damage');
  console.log(`Fireball: burning ground for ${(e.burn / 30).toFixed(1)} s, the Gladiator on ${e.hp} health against ${p.hp}: ok`);
}
// the same battle twice: evolutions stay exact (online battles)
{
  const play = () => {
    const evos = Object.keys(KC_EVOS);
    const s = S.create({ seed: 11, decks: [KC_STARTER_DECK, KC_STARTER_DECK], evos: [evos, evos], cardLevels: [EVEN, EVEN] });
    const b = [KCBot.create(0, { skill: 'normal', seed: 1 }), KCBot.create(1, { skill: 'normal', seed: 2 })];
    while (!s.result) { S.step(s); b.forEach(x => KCBot.update(x, s)); s.events.length = 0; }
    return JSON.stringify([s.result, s.tick, s.ents.filter(e => e.kind === 'tower').map(e => e.hp)]);
  };
  assert.strictEqual(play(), play(), 'deterministic');
  console.log('a battle with every evolution on both sides plays out the same twice: ok');
}
