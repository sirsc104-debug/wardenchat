// Balance check for new cards: the same bot plays a deck with the new cards against the starter deck
// (and the other way round, to cancel any side advantage), and some one-on-one trades are timed.
// node tools/balance-test.js [matches]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['cards.js', 'sim.js', 'bot.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const S = KCSim, N = +process.argv[2] || 60;
const STARTER = KC_STARTER_DECK;
const DECKS = {
  // each new card takes the place of a card with the same job, so the deck keeps its answers to air
  'Spears for Wolves': ['rhino', 'spears', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'Footmen for Gorilla': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'footmen', 'fireball'],
  'Flail Knight for Gorilla': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'flail', 'fireball'],
  'Pot Thrower for Wolves': ['rhino', 'pots', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'All four new cards': ['rhino', 'spears', 'footmen', 'hawks', 'archers', 'pots', 'flail', 'fireball'],
  // Sunstone Arena
  'Sandstorm for Wolves': ['rhino', 'sandstorm', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'Ram Cart for Rhino': ['ramcart', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'Mole for Gladiator': ['rhino', 'wolves', 'mole', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'Camel Jockey for Rhino': ['camel', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'Evolved Snowman': { deck: STARTER, evos: ['snowman'] },
  // Stormspire
  'Bees for Wolves': ['rhino', 'bees', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'Owl for Archers': ['rhino', 'wolves', 'gladiator', 'hawks', 'owl', 'snowman', 'gorilla', 'fireball'],
  'Thunder Cloud for Rhino': ['thundercloud', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'Griffin for Gorilla': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'griffin', 'fireball'],
  // Arenas 5 to 10 (named "A5: ..." to "A10: ...", so one arena can be run on its own)
  'A5: Frost Sprite for Wolves': ['rhino', 'frostsprite', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A5: Icebound Giant for Rhino': ['icegiant', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A5: Winter Sage for Snowman': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'wintersage', 'gorilla', 'fireball'],
  'A5: Flash Freeze for Fireball': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'flashfreeze'],
  'A6: Dock Raiders for Wolves': ['rhino', 'dockraiders', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A6: Boarding Barrel for Rhino': ['barrel', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A6: Harpoon Captain for Gladiator': ['rhino', 'wolves', 'harpoon', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A6: Broadside Cart for Snowman': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'broadside', 'gorilla', 'fireball'],
  'A7: Coil Tower for Gladiator': ['rhino', 'wolves', 'coil', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A7: Sparkbots for Archers': ['rhino', 'wolves', 'gladiator', 'hawks', 'sparkbots', 'snowman', 'gorilla', 'fireball'],
  'A7: Steel Titan for Rhino': ['titan', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A7: Arc Cannon for Snowman': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'arccannon', 'gorilla', 'fireball'],
  'A8: Gem Flash for Wolves': ['rhino', 'gemflash', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A8: Shard Guards for Gladiator': ['rhino', 'wolves', 'shardguards', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A8: Crystal Drill for Rhino': ['drill', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A8: Prism Archer for Archers': ['rhino', 'wolves', 'gladiator', 'hawks', 'prism', 'snowman', 'gorilla', 'fireball'],
  'A9: Sun Sprite for Wolves': ['rhino', 'sunsprite', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A9: Celestial Guardian for Gladiator': ['rhino', 'wolves', 'guardian', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A9: Cloud Drake for Hawks': ['rhino', 'wolves', 'gladiator', 'drake', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A9: Dawn Phoenix for Hawks': ['rhino', 'wolves', 'gladiator', 'phoenix', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A10: Wraith Army for Wolves': ['rhino', 'wraiths', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A10: Doom Meteor for Fireball': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'meteor'],
  'A10: Abyss Gate for Rhino': ['abyss', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'gorilla', 'fireball'],
  'A10: Dread Knight for Gorilla': ['rhino', 'wolves', 'gladiator', 'hawks', 'archers', 'snowman', 'dreadknight', 'fireball'],
};
const only = process.argv[3];
// every card at the same level (9, where a Legendary starts), so cards are compared on their own merits
const EVEN = Object.fromEntries(Object.keys(KC_CARDS).map(id => [id, 9]));
for (const [name, spec] of Object.entries(DECKS)) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
  const deck = Array.isArray(spec) ? spec : spec.deck, evo = Array.isArray(spec) ? [] : spec.evos;
  let w = 0, l = 0, d = 0;
  for (let i = 0; i < N; i++) {
    const newSide = i % 2;
    const decks = newSide ? [STARTER, deck] : [deck, STARTER];
    const s = S.create({ seed: 900 + i, decks, evos: newSide ? [[], evo] : [evo, []], cardLevels: [EVEN, EVEN] });
    const bots = [KCBot.create(0, { skill: 'normal', seed: i }), KCBot.create(1, { skill: 'normal', seed: i + 500 })];
    while (!s.result) { S.step(s); bots.forEach(b => KCBot.update(b, s)); s.events.length = 0; }
    const win = s.result.winner;
    if (win === -1) d++; else if (win === newSide) w++; else l++;
  }
  console.log(`${name.padEnd(26)} won ${w}, lost ${l}, drew ${d} of ${N} (${Math.round(w / (w + l || 1) * 100)}% of decided)`);
}

// One-on-one trades: who is left standing, and how long it takes.
function duel(a, b, ax = 9.5, ay = 19.5, bx = 9.5, by = 13.5) {
  const s = S.create({ seed: 3, decks: [Array(8).fill(a), Array(8).fill(b)], cardLevels: [EVEN, EVEN] });
  s.energy = [10, 10];
  S.play(s, 0, 0, ax, ay); S.play(s, 1, 0, bx, by);
  let t = 0;
  while (t < 30) {
    S.step(s); s.events.length = 0; t += S.DT;
    const A = s.ents.filter(e => e.kind !== 'tower' && e.team === 0), Bs = s.ents.filter(e => e.kind !== 'tower' && e.team === 1);
    if (!A.length || !Bs.length) return `${KC_CARDS[a].name} (${KC_CARDS[a].cost}) vs ${KC_CARDS[b].name} (${KC_CARDS[b].cost}): ${A.length ? KC_CARDS[a].name : KC_CARDS[b].name} wins, ${(A.length ? A : Bs).reduce((x, e) => x + e.hp, 0)} HP left, ${t.toFixed(1)} s`;
  }
  return `${KC_CARDS[a].name} vs ${KC_CARDS[b].name}: no result in 30 s`;
}
if (!only) for (const [a, b] of [['camel', 'gladiator'], ['camel', 'gorilla'], ['mole', 'archers'], ['mole', 'gladiator'], ['ramcart', 'skeletons']]) console.log(duel(a, b));
if (!only) for (const [a, b] of [['flail', 'wolves'], ['flail', 'gladiator'], ['flail', 'gorilla'], ['footmen', 'gorilla'], ['footmen', 'gladiator'], ['footmen', 'snowman'], ['pots', 'wolves'], ['pots', 'skeletons'], ['pots', 'gladiator'], ['gorilla', 'footmen'], ['wolves', 'pots']]) console.log(duel(a, b));
