/* Kingdom Clash: checking trophy battles on the server (the back end runs this; BACKEND_HANDOFF.md).
   It runs the game's own rules: js/cards.js, js/trainers.js, js/sim.js, js/bot.js and js/progress.js,
   bundled with this file into server/kc-battle-core.mjs by build-server.py (each request gets the
   bundle's own copies, with no storage, page or account behind them). Nothing here trusts the browser:
   - issue:  the opponent for a trophy battle, from the server's trophies for the player and a seed it picks;
   - setup:  the player's side (deck, card levels, evolutions, King Tower), from their saved progress;
   - replay: the battle again, from the seeds, both sides and the player's plays; the computer player
             plays itself again (it is deterministic), so only the player's plays come from the browser;
   - settle: the trophies after a result, by the game's rules (stakes, arena floors, streaks, SirSC);
   - adopt:  a player's trophies the first time, from their save (once; from then on only checked
             battles change them). */
'use strict';

const KCVerify = (() => {
  const mem = data => { const m = new Map(Object.entries(data || {})); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
  const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
  // a trophy state: { trophies, best, w, l, d, streak }
  function clean(t) {
    t = t || {};
    return { trophies: n(t.trophies), best: Math.max(n(t.best), n(t.trophies)), w: n(t.w), l: n(t.l), d: n(t.d), streak: Number.isFinite(+t.streak) ? Math.max(-99, Math.min(99, Math.trunc(+t.streak))) : 0 };
  }
  // a fresh copy of the progress rules for one player: their trophies, with the road open
  function scratch(t, doc) {
    const s = clean(t), base = doc && typeof doc === 'object' ? JSON.parse(JSON.stringify(doc)) : {};
    const save = Object.assign(base, { beaten: { owen: true, romeo: true, luc: true }, trophies: s.trophies, best: s.best,
      trophyRecord: { w: s.w, l: s.l, d: s.d }, streak: s.streak, claimed: Object.assign({ 0: true }, base.claimed), live: null });
    KCProgress.load(mem({ 'kc.progress': JSON.stringify(save) }));
    return KCProgress;
  }
  const state = G => G.trophyState();

  // The player's trophies the first time they play a checked battle: from their save, once.
  function adopt(doc) {
    const d = doc && typeof doc === 'object' ? doc : {};
    KCProgress.load(mem({ 'kc.progress': JSON.stringify(d) }));
    return clean(KCProgress.trophyState());
  }
  // Whether the save has the Trophy Road open (Trainer Luc beaten): trophy battles need it.
  const roadOpen = doc => !!(doc && doc.beaten && doc.beaten.luc);
  // The player's side of a battle, from their saved progress.
  function setup(doc) {
    KCProgress.load(mem({ 'kc.progress': JSON.stringify(doc || {}) }));
    return JSON.parse(JSON.stringify(KCProgress.battleSetup()));
  }
  // The opponent: what the game's matchmaking gives at these trophies, from this seed.
  function issue(t, seed) {
    const G = scratch(t);
    return JSON.parse(JSON.stringify(G.trophyFoe(KCSim.mulberry(seed >>> 0))));
  }

  /* The battle again. plays: the player's plays, [tick, slot, x, y, card] in the order they were made
     (team 0's entries of the game's battle log). end: { tick, reason: 'surrender' } when the player gave
     up, else null (the battle ends by itself). Returns { ok: true, winner, crowns, reason, tick } or
     { ok: false, error, at } when a play can't have happened (the battle then counts as a loss). */
  const MAX_TICKS = Math.round((KCSim.REGULAR + KCSim.OVERTIME + 600) / KCSim.DT), MAX_PLAYS = 1500;
  function replay(b) {
    const plays = Array.isArray(b.plays) ? b.plays : [], foe = b.foe, setupP = b.setup, end = b.end && b.end.reason === 'surrender' ? b.end : null;
    if (!foe || !setupP || !Array.isArray(setupP.deck) || setupP.deck.length !== 8) return { ok: false, error: 'setup' };
    if (plays.length > MAX_PLAYS) return { ok: false, error: 'plays' };
    for (const p of plays) {
      if (!Array.isArray(p) || p.length !== 5 || !Number.isInteger(p[0]) || p[0] < 0 || !Number.isInteger(p[1]) || p[1] < 0 || p[1] > 3
        || typeof p[2] !== 'number' || !Number.isFinite(p[2]) || typeof p[3] !== 'number' || !Number.isFinite(p[3]) || typeof p[4] !== 'string') return { ok: false, error: 'plays' };
    }
    if (end && (!Number.isInteger(end.tick) || end.tick < 0)) return { ok: false, error: 'end' };
    const s = KCSim.create(KCProgress.trophyBattleOpts(foe, setupP, b.seed));
    const bot = KCBot.create(1, { skill: foe.skill, seed: b.botSeed >>> 0, style: foe.style });
    let i = 0;
    for (;;) {
      // the player's plays come between steps, after the computer's (as in the game's loop)
      while (i < plays.length && plays[i][0] === s.tick) {
        const [tick, slot, x, y, card] = plays[i++];
        if (s.hands[0][slot] !== card) return { ok: false, error: 'card', at: tick };
        const r = KCSim.play(s, 0, slot, x, y);
        if (r !== 'ok') return { ok: false, error: r, at: tick };
      }
      if (i < plays.length && plays[i][0] < s.tick) return { ok: false, error: 'order', at: plays[i][0] };
      if (end && s.tick >= end.tick) { KCSim.forceEnd(s, 1, 'surrender'); break; }
      if (s.result) break;
      if (s.tick > MAX_TICKS) return { ok: false, error: 'long' };
      KCSim.step(s);
      if (s.result) break;
      KCBot.update(bot, s);
    }
    if (i < plays.length) return { ok: false, error: 'after', at: plays[i][0] };
    return { ok: true, winner: s.result.winner, crowns: s.crowns.slice(), reason: s.result.reason, tick: s.tick };
  }

  // The trophies after a result (winner 0: the player, 1: the opponent, -1: a draw). crowns: the player's.
  function settle(t, foe, winner, crowns) {
    const G = scratch(t), before = clean(t);
    const r = G.recordTrophy(winner, crowns | 0, foe.trophies, null, !!foe.boss);
    const after = clean(state(G));
    return Object.assign(after, { delta: after.trophies - before.trophies, boss: !!r.boss });
  }
  // A battle that was started and never finished counts as a loss (not against SirSC).
  const abandon = (t, foe) => settle(t, foe, 1, 0);

  return { RULES: KCProgress.RULES, clean, adopt, roadOpen, setup, issue, replay, settle, abandon };
})();
