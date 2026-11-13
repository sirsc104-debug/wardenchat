// Tests server-checked trophy battles: node tools/verify-test.js [battles]
// Plays trophy battles the way the game does (its own copy of the rules, the game loop's order: a step,
// the computer's move, then the player's plays), with a computer player standing in for the player, then
// has the server's bundle (server/kc-battle-core.mjs, built by build-server.py) replay each one from the
// seeds and the player's plays alone. Every result must come out the same; tampered plays must be caught;
// trophies must follow the game's rules.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
execFileSync('python3', [path.join(ROOT, 'build-server.py')], { stdio: 'ignore' });
for (const f of ['cards.js', 'trainers.js', 'sim.js', 'bot.js', 'progress.js']) vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), { filename: f });
const mem = data => { const m = new Map(Object.entries(data || {})); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
const N = +process.argv[2] || 16;

(async () => {
  const { KCServerCore: V } = await import(path.join(ROOT, 'server', 'kc-battle-core.mjs'));
  assert(/^[0-9a-f]{12}$/.test(V.RULES), 'the bundle carries its rules version');

  // a player's saved progress: a deck at mixed levels, an evolution, King Tower 9
  const doc = { name: 'Tester', beaten: { owen: true, romeo: true, luc: true }, claimed: { 0: true }, trophies: 1500, best: 1600, trophyRecord: { w: 60, l: 50, d: 1 }, streak: 0,
    found: KC_ALL_CARDS.slice(), deck: ['archers', 'knight', 'fireball', 'giant', 'minions', 'cannon', 'arrows', 'musketeer'].filter(id => KC_CARDS[id]), cards: {}, evos: ['archers'], king: 9 };
  while (doc.deck.length < 8) { const id = KC_ALL_CARDS.find(c => !doc.deck.includes(c) && !KC_CARDS[c].hidden && !KC_CARDS[c].mirror); doc.deck.push(id); }
  for (const id of KC_ALL_CARDS) doc.cards[id] = { level: Math.max(KC_MIN_LEVEL(id), 9), count: 0 };
  const state0 = V.adopt(doc);
  assert.deepStrictEqual(state0, { trophies: 1500, best: 1600, w: 60, l: 50, d: 1, streak: 0 }, 'trophies adopted from the save, once');
  assert(V.roadOpen(doc) && !V.roadOpen({}), 'trophy battles need the road open');
  const setup = V.setup(doc);
  assert.deepStrictEqual(setup.deck, doc.deck); assert.strictEqual(setup.king, 9); assert(setup.evos.includes('archers'));

  // the game's side: its own copy of the rules, its own loop
  function playLikeTheGame(foe, seed, botSeed, me, stopAt) {
    const s = KCSim.create(KCProgress.trophyBattleOpts(foe, setup, seed));
    const bot = KCBot.create(1, { skill: foe.skill, seed: botSeed, style: foe.style });
    const player = KCBot.create(0, { skill: KCProgress.skillFor ? KCProgress.skillFor(0.6) : foe.skill, seed: me, style: 'beatdown' });
    let end = null;
    while (!s.result) {
      KCSim.step(s);
      KCBot.update(bot, s);
      KCBot.update(player, s);   // the player's plays come after the computer's, between frames
      if (stopAt && s.tick >= stopAt && !s.result) { KCSim.forceEnd(s, 1, 'surrender'); end = { tick: s.tick, reason: 'surrender' }; }
      if (s.tick > 40000) throw new Error('battle too long');
    }
    return { s, end, plays: s.log.filter(l => l[1] === 0).map(l => [l[0], l[2], l[3], l[4], l[5]]) };
  }

  let same = 0, ms = 0, ticks = 0, wins = 0;
  const seeds = []; for (let i = 0; i < N; i++) seeds.push([(i * 2654435761) >>> 0, (i * 40503 + 7) >>> 0, (i * 9301 + 49297) >>> 0, (i * 1013904223) >>> 0]);
  for (const [foeSeed, seed, botSeed, me] of seeds) {
    const foe = V.issue(state0, foeSeed);
    assert(foe.kind === 'trophy' && Array.isArray(foe.deck) && foe.deck.length === 8, 'an opponent');
    // the same opponent from the game's own rules, so the server issues what the game would
    KCProgress.load(mem({ 'kc.progress': JSON.stringify(Object.assign({}, doc, { trophies: state0.trophies, best: state0.best })) }));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(KCProgress.trophyFoe(KCSim.mulberry(foeSeed)))), foe, 'the server picks the opponent the game would');
    const game = playLikeTheGame(JSON.parse(JSON.stringify(foe)), seed, botSeed, me);
    const t0 = Date.now(), r = V.replay({ seed, botSeed, setup, foe, plays: game.plays, end: null });
    ms += Date.now() - t0; ticks += game.s.tick;
    assert(r.ok, 'replay ok: ' + JSON.stringify(r));
    assert.deepStrictEqual([r.winner, r.crowns, r.reason, r.tick], [game.s.result.winner, game.s.crowns, game.s.result.reason, game.s.tick], 'the server reaches the same result');
    same++; if (r.winner === 0) wins++;
  }
  console.log(`replays: ${same}/${N} battles came out the same (${wins} player wins), ${Math.round(ms / N)} ms a battle (${Math.round(ticks / N)} steps)`);

  // a surrender part-way through
  {
    const foe = V.issue(state0, 99), g = playLikeTheGame(foe, 5, 6, 7, 900);
    const r = V.replay({ seed: 5, botSeed: 6, setup, foe, plays: g.plays, end: g.end });
    assert(r.ok && r.winner === 1 && r.reason === 'surrender' && r.tick === g.s.tick, 'a surrender replays as a surrender at the same tick');
  }
  // tampering: a card that wasn't in the hand, a play that couldn't be paid for, plays out of order, junk
  {
    const foe = V.issue(state0, 1234), g = playLikeTheGame(foe, 11, 12, 13);
    assert(g.plays.length > 4, 'the battle has plays');
    const bad = (plays, why) => { const r = V.replay({ seed: 11, botSeed: 12, setup, foe, plays, end: null }); assert(!r.ok, why + ': ' + JSON.stringify(r)); return r.error; };
    const p = g.plays.map(x => x.slice());
    const wrong = p.map(x => x.slice()); wrong[2][4] = setup.deck.find(id => id !== wrong[2][4] && !g.s.hands[0].includes(id)) || 'nothing';
    console.log('tampering caught:', [
      bad(wrong, 'a card not in that slot'),
      bad(p.slice(0, 3).concat([[p[2][0], p[2][1], p[2][2], p[2][3], p[2][4]]]).concat(p.slice(3)), 'the same play twice'),
      bad([p[1], p[0]].concat(p.slice(2)), 'plays out of order'),
      bad([[0, 0, 'x', 3, 'knight']], 'junk'),
      bad(p.concat([[g.s.tick + 50, 0, 9, 25, setup.deck[0]]]), 'a play after the end'),
    ].join(', '));
    // a different (impossible) claimed result doesn't matter: the server's own replay decides
    const r = V.replay({ seed: 11, botSeed: 12, setup, foe, plays: p, end: null, claimed: { winner: 0, crowns: [3, 0] } });
    assert(r.ok && r.winner === g.s.result.winner);
    // other seeds give another battle: plays from one battle don't fit another
    const other = V.replay({ seed: 77, botSeed: 12, setup, foe, plays: p, end: null });
    assert(!other.ok || other.winner !== r.winner || other.tick !== r.tick, 'the seed matters');
  }

  // trophies by the game's rules
  {
    const foe = V.issue(state0, 4321), st = KCProgress.stakes(state0.trophies, foe.trophies);
    const w = V.settle(state0, foe, 0, 2);
    assert(w.trophies === state0.trophies + st.win && w.w === 61 && w.streak === 1 && w.delta === st.win, 'a win pays the stakes');
    const l = V.settle(state0, foe, 1, 0);
    assert(l.trophies === state0.trophies - st.loss && l.l === 51 && l.streak === -1, 'a loss costs the stakes');
    const floor = V.settle(Object.assign({}, state0, { trophies: 905, best: 905 }), foe, 1, 0);
    assert.strictEqual(floor.trophies, 900, 'never below the arena floor');
    assert.deepStrictEqual(V.abandon(state0, foe), l, 'leaving counts as a loss');
    const hi = { trophies: 4500, best: 4500, w: 300, l: 250, d: 0, streak: -2 };
    let boss = null; for (let i = 0; i < 400 && !boss; i++) { const f = V.issue(hi, i); if (f.boss) boss = f; }
    assert(boss && boss.kingLevel === 50, 'SirSC turns up in the high arenas');
    const bl = V.settle(hi, boss, 1, 0);
    assert(bl.trophies === 4500 && bl.l === 251 && bl.streak === -2 && bl.boss, 'losing to SirSC costs nothing, and leaving his battle neither');
    assert.strictEqual(V.abandon(hi, boss).trophies, 4500);
    assert.deepStrictEqual(V.clean({ trophies: -5, best: 'x', w: 2.7, streak: 1e9 }), { trophies: 0, best: 0, w: 2, l: 0, d: 0, streak: 99 }, 'junk trophies are cleaned');
  }
  console.log('trophies: stakes, floors, streaks, leaving and SirSC by the game rules: ok');
})().catch(e => { console.error(e); process.exit(1); });
