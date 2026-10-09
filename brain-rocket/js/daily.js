/* Brain Rocket — Bullseye, the daily mode. Everyone gets the same 15 questions each day (a new set
   at midnight, in the player's own time zone). Each question names a rarity to aim for: hitting it
   exactly is a bullseye, and every tier off lands one ring further out. This file works out today's
   puzzle, keeps today's result and the day streak, and writes the share text. */
'use strict';

const Daily = (function () {
  const COUNT = 15;
  const EPOCH = new Date(2026, 9, 9);                 // Bullseye #1
  const RING_POINTS = [100, 60, 30, 10, 5];           // by how many tiers off; a miss scores 0
  const MAX = COUNT * RING_POINTS[0];
  const RING_EMOJI = ['🎯', '🟡', '🔴', '🔵', '⚫'], MISS_EMOJI = '⬜';
  const KEY = 'brainRocket.daily', STREAK_KEY = 'brainRocket.dailyStreak';

  const dayStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Math.round, not floor: a day with a clock change is 23 or 25 hours long
  const dayNumber = (d = new Date()) => Math.round((dayStart(d) - EPOCH) / 864e5) + 1;
  const msToNextDay = (d = new Date()) => { const n = dayStart(d); n.setDate(n.getDate() + 1); return n - d; };

  // Today's 15 questions and what to aim for on each. The same day number gives the same puzzle on
  // every computer (as long as everyone has the same version of the question bank).
  function puzzle(day = dayNumber()) {
    const rng = Challenge.rng(0x5eed + day * 7919);
    const seen = Quiz.freshRun();
    const aims = [];
    for (let k = 0; k < COUNT / 5; k++) aims.push(1, 2, 3, 4, 5);
    for (let i = aims.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [aims[i], aims[j]] = [aims[j], aims[i]]; }
    const out = [];
    for (let guard = 0; out.length < COUNT && guard < 600; guard++) {
      const q = Quiz.generate('medium', seen, rng);
      if (/^dhhs/.test(q.cat.id) || q.cat.halloween) continue;            // school-only and seasonal topics stay out
      if (q.rules.length || q.cat.level > 2) continue;                    // plain questions only: aiming is the twist
      if (/^new-/.test(q.cat.id)) continue;                               // the original, broad topics everyone knows
      if (out.some(o => o.q.cat.id === q.cat.id)) continue;               // one question per topic each day
      const count = t => q.answers.filter(a => a.ent.tier === t).length;
      const good = [1, 2, 3, 4, 5].filter(t => count(t) >= 2);
      if (good.length < 3 || q.answers.length < 8) continue;
      // aim for the planned rarity, or the nearest one this question really has answers for
      let aim = aims[out.length];
      if (!good.includes(aim)) aim = good.reduce((b, t) => (Math.abs(t - aim) < Math.abs(b - aim) ? t : b), good[0]);
      out.push({ q, aim });
    }
    return out;
  }

  // A few answers of the rarity you were aiming for, shown after each shot.
  function examplesAt(q, tier, n = 1) {
    const pool = q.answers.filter(a => a.ent.tier === tier);
    return pool.slice(0, n).map(a => ({ text: a.v.raw, tier }));
  }

  // ---- Today's result: { day, done, crashed, marks: [rings off per shot, -1 for a miss], score } ----
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const scoreOf = marks => marks.reduce((s, m) => s + (m >= 0 ? RING_POINTS[m] : 0), 0);

  function today() { const r = load(KEY); return r && r.day === dayNumber() ? r : null; }
  function begin() { const r = { day: dayNumber(), done: false, crashed: false, marks: [], score: 0 }; save(KEY, r); return r; }
  function mark(r, off) { r.marks.push(off); r.score = scoreOf(r.marks); save(KEY, r); }
  function finish(r, crashed) {
    if (r.done) return r;
    while (r.marks.length < COUNT) r.marks.push(-1);
    r.done = true; r.crashed = !!crashed;
    r.score = crashed ? 0 : scoreOf(r.marks);
    save(KEY, r);
    const s = load(STREAK_KEY);
    const count = s && s.last === r.day - 1 ? s.count + 1 : s && s.last === r.day ? s.count : 1;
    save(STREAK_KEY, { last: r.day, count });
    return r;
  }
  // A game left half-way (closed tab or reload) counts as played, with the rest as misses.
  function settle() { const r = today(); if (r && !r.done) finish(r); }
  function streak() { const s = load(STREAK_KEY), d = dayNumber(); return s && (s.last === d || s.last === d - 1) ? s.count : 0; }

  const grid = marks => [0, 5, 10].map(i => marks.slice(i, i + 5).map(m => (m >= 0 ? RING_EMOJI[m] : MISS_EMOJI)).join('')).join('\n');
  function shareText(r) {
    const bulls = r.marks.filter(m => m === 0).length;
    return `🎯 Brain Rocket Bullseye #${r.day}\n${r.crashed ? '💥 0' : r.score.toLocaleString()} / ${MAX.toLocaleString()} · ${bulls} bullseye${bulls === 1 ? '' : 's'}\n${grid(r.marks)}\nbrainrocket.sirsc104.com`;
  }

  return { COUNT, MAX, RING_POINTS, RING_EMOJI, MISS_EMOJI, dayNumber, msToNextDay, puzzle, examplesAt,
           today, begin, mark, finish, settle, streak, grid, shareText };
})();
