/* Apples to Oranges — picking matchups.
 *
 * How hard a matchup is depends only on how close the two numbers are (the bigger one
 * divided by the smaller one). Owen gets numbers a fair way apart, Hard gets them close.
 * Every so often a "photo finish" comes up: two exact numbers that tie or are a few apart.
 * Matchups are picked from CARDS (cards.js): every fact, plus each measurement in its other units.
 *
 * Four modes share this:
 *   classic  Higher or lower, from the regular facts.
 *   haunt    The same, but every matchup puts a Halloween fact against a regular one.
 *   size     Real Size: two measurements of the same kind in different units. Which is really bigger?
 *   guess    Guess the Number: one card at a time, scored by how close the guess is.
 */
'use strict';

const Pairs = (function () {
  // Points for a right answer, by how close the numbers were.
  const TIERS = [
    { name: 'Common',    pts: 10,  cls: 't1' },   // 10× apart or more
    { name: 'Uncommon',  pts: 25,  cls: 't2' },   // 3× to 10×
    { name: 'Rare',      pts: 50,  cls: 't3' },   // 1.5× to 3×
    { name: 'Epic',      pts: 100, cls: 't4' },   // closer than 1.5×
    { name: 'Legendary', pts: 200, cls: 't5' }    // photo finish
  ];

  // Which closeness each difficulty draws from, as [smallest, biggest] ratio.
  const BANDS = { owen: [1.6, 8], medium: [1.25, 5], hard: [1.05, 4] };
  // Chance that the next matchup tries to be a photo finish.
  const PHOTO_CHANCE = { owen: 1 / 16, medium: 1 / 11, hard: 1 / 7 };

  function ratio(a, b) {
    const hi = Math.max(a.n, b.n), lo = Math.min(a.n, b.n);
    return lo <= 0 ? Infinity : hi / lo;
  }

  // A tie, or a gap of a few, between two exact facts.
  function isPhoto(a, b) {
    if (!a.x || !b.x) return false;
    if (a.n === b.n) return true;
    const gap = Math.abs(a.n - b.n), r = ratio(a, b);
    return (gap <= 4 && r <= 1.05) || r <= 1.002;
  }

  function tierOf(a, b) {
    if (isPhoto(a, b)) return 4;
    const r = ratio(a, b);
    if (r >= 10) return 0;
    if (r >= 3) return 1;
    if (r >= 1.5) return 2;
    return 3;
  }

  // Facts from the same category are too related to meet, except years
  // (Toy Story against the first Pokémon games is fair and fun). A fact never meets itself.
  function unrelated(a, b) {
    return a.base !== b.base && (a.c !== b.c || a.c === 'years');
  }

  // Could this pair come up at all? An approximate or converted number needs a clear gap,
  // so "about 70 mph" never decides a matchup by a hair.
  function fair(a, b) {
    if (!unrelated(a, b)) return false;
    if (isPhoto(a, b)) return true;
    if (a.n === b.n) return false;
    if ((!a.x || !b.x) && ratio(a, b) < 1.1) return false;
    return true;
  }

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const rand = (a, b) => a + Math.random() * (b - a);

  // Halloween facts only come up in the Halloween event, always against a regular fact.
  // allowed(c, from, mode): can card c be the next card after `from` in this mode?
  const allowed = (c, from, mode) => (mode === 'haunt' ? !!c.hw !== !!from.hw : !c.hw);

  // Pick a fact first, then one of its units, so a measurement with eight units
  // comes up about as often as a plain count.
  function pickByFact(cards) {
    const byBase = new Map();
    for (const c of cards) {
      if (!byBase.has(c.base)) byBase.set(c.base, []);
      byBase.get(c.base).push(c);
    }
    return pick(pick([...byBase.values()]));
  }

  function photoPartners(f, pool) {
    return pool.filter(o => unrelated(f, o) && isPhoto(f, o));
  }

  /* ---- Ultra: every matchup is within 10 -----------------------------------------------
   * Both numbers have to be trustworthy to the last digit: an exact fact, or a measurement
   * converted from one (rounding never changes which of two numbers is bigger, it can only make
   * them look equal, so a converted number never meets an equal one). No ties: a tie would be a
   * free point. */
  const ULTRA_GAP = 10;
  const trusted = c => !!(c.x || c.xs);
  function ultraPair(a, b) {
    if (!unrelated(a, b) || !trusted(a) || !trusted(b)) return false;
    const gap = Math.abs(a.n - b.n);
    return gap > 0 && gap <= ULTRA_GAP;
  }
  let ultraMap = null;           // card id -> its Ultra partners, worked out the first time Ultra is played
  function ultraPartners(c, from, mode) {
    const all = ultraAll(c);
    return from ? all.filter(o => allowed(o, from, mode)) : all;
  }
  function ultraAll(c) {
    if (!ultraMap) {
      ultraMap = new Map();
      const ok = CARDS.filter(trusted).sort((a, b) => a.n - b.n);
      for (const c0 of ok) ultraMap.set(c0.id, []);
      for (let i = 0; i < ok.length; i++) {
        for (let j = i + 1; j < ok.length && ok[j].n - ok[i].n <= ULTRA_GAP; j++) {
          if (ultraPair(ok[i], ok[j])) { ultraMap.get(ok[i].id).push(ok[j]); ultraMap.get(ok[j].id).push(ok[i]); }
        }
      }
    }
    return ultraMap.get(c.id) || [];
  }
  // A partner that itself has somewhere to go next, so the chain never runs dry.
  function nextUltra(left, used, mode) {
    const mine = ultraPartners(left, left, mode);
    const all = mine.filter(c => ultraPartners(c, c, mode).some(o => o.base !== left.base));
    const fresh = all.filter(c => !used.has(c.id));
    return pickByFact(fresh.length ? fresh : all.length ? all : mine);
  }

  /* A match for the left card.
   *   left     the card on the left
   *   diff     'owen' | 'medium' | 'hard' | 'ultra'
   *   used     Set of card ids already shown this run (the same fact can come back in another unit)
   *   state    { pendingPhoto } carried between calls
   *   mode     'classic' or 'haunt'
   * Returns the card for the right side. */
  function next(left, diff, used, state, mode = 'classic') {
    if (diff === 'ultra' && ultraPartners(left, left, mode).length) return nextUltra(left, used, mode);
    if (diff === 'ultra') diff = 'hard';     // (never expected: a card with no close partner falls back to Hard)
    let pool = CARDS.filter(f => !used.has(f.id) && f.base !== left.base && allowed(f, left, mode));
    if (pool.length < 40) {            // nearly used everything: start over (but not the card on screen)
      used.clear(); used.add(left.id);
      pool = CARDS.filter(f => f.base !== left.base && allowed(f, left, mode));
    }

    // Photo finish: on a lucky roll (or one left over from last time), if this card has a near-twin.
    if (state.pendingPhoto || Math.random() < PHOTO_CHANCE[diff]) {
      const twins = photoPartners(left, pool);
      if (twins.length) { state.pendingPhoto = false; return pickByFact(twins); }
      state.pendingPhoto = true;       // this card has none: steer toward one that does
    }

    const [lo, hi] = BANDS[diff];
    let cands = pool.filter(f => fair(left, f) && !isPhoto(left, f) && ratio(left, f) >= lo && ratio(left, f) <= hi);
    if (!cands.length) cands = pool.filter(f => fair(left, f) && !isPhoto(left, f));
    if (!cands.length) cands = pool.filter(f => unrelated(left, f) && f.n !== left.n);
    if (!cands.length) cands = pool;

    if (state.pendingPhoto) {
      const after = CARDS.filter(o => o.base !== left.base);
      const setUp = cands.filter(f => f.x && photoPartners(f, after.filter(o => allowed(o, f, mode))).length);
      if (setUp.length) return pickByFact(setUp);
    }
    return pickByFact(cands);
  }

  // A first card: a regular fact in its own unit, not a year (on Ultra: one with plenty of close partners).
  function first(diff, mode = 'classic') {
    const start = CARDS.filter(f => !f.hw && !f.year && !f.converted);
    if (diff === 'ultra') return pickByFact(start.filter(f => trusted(f) && ultraPartners(f, f, mode).length >= 3));
    return pickByFact(start);
  }

  /* ---- Real Size: which is really bigger? -------------------------------------------------
   * Two lengths (heights, lengths, distances), both in centimeters. The difficulty sets how
   * close the two are. (Traps, where the bigger number is the smaller thing, can only happen
   * across different units, so they no longer come up.) */
  const SIZE_BANDS = { owen: [2, 60], medium: [1.4, 4], hard: [1.1, 2], ultra: [1.02, 1.25] };   // with only lengths in cm, few pairs are within 10%
  const TRAP_CHANCE = { owen: 1 / 3, medium: 1 / 2, hard: 2 / 3, ultra: 0.85 };
  // Every Real Size card is a length in centimeters, so both numbers are always in the same unit.
  const SIZE_CARDS = CARDS.filter(c => c.dim === 'len' && c.mk === 'cm' && !c.hw);
  const realRatio = (a, b) => Math.max(a.real, b.real) / Math.min(a.real, b.real);
  const isTrap = (a, b) => Math.sign(a.n - b.n) !== Math.sign(a.real - b.real);
  function sizeFair(a, b) {
    if (a.base === b.base || a.dim !== b.dim) return false;
    const r = realRatio(a, b);
    if (r < 1.02) return false;                         // too close for rounding to be fair
    return (trusted(a) && trusted(b)) || r >= 1.1;      // approximate sizes need a clear gap
  }
  function sizeTier(a, b) {
    const r = realRatio(a, b);
    return r >= 10 ? 0 : r >= 3 ? 1 : r >= 1.5 ? 2 : r >= 1.1 ? 3 : 4;
  }
  function nextSize(left, diff, used) {
    let pool = SIZE_CARDS.filter(c => !used.has(c.id) && sizeFair(left, c));
    if (pool.length < 4) pool = SIZE_CARDS.filter(c => sizeFair(left, c));
    const [lo, hi] = SIZE_BANDS[diff];
    const inBand = (a, c) => { const r = realRatio(a, c); return r >= lo && r <= hi; };
    // keep the chain going: the next card should have partners in the band of its own
    const ok = pool.filter(c => SIZE_CARDS.some(o => o.base !== left.base && sizeFair(c, o)));
    const band = ok.filter(c => inBand(left, c));
    const onward = band.filter(c => SIZE_CARDS.some(o => o.base !== left.base && o.base !== c.base && sizeFair(c, o) && inBand(c, o)));
    const wantTrap = Math.random() < TRAP_CHANCE[diff];
    for (const set of [onward, band]) {
      const choice = set.filter(c => isTrap(left, c) === wantTrap);
      if (choice.length) return pickByFact(choice);
      if (set.length) return pickByFact(set);
    }
    if (!ok.length) return null;
    // nothing in the band: the closest pairs to it
    const mid = Math.sqrt(lo * Math.min(hi, 100));
    const near = ok.slice().sort((a, c) => Math.abs(Math.log(realRatio(left, a) / mid)) - Math.abs(Math.log(realRatio(left, c) / mid)));
    return pick(near.slice(0, 5));
  }
  function firstSize(diff) {
    const start = SIZE_CARDS;
    const [lo, hi] = SIZE_BANDS[diff];
    return pickByFact(start.filter(c => SIZE_CARDS.some(o => sizeFair(c, o) && realRatio(c, o) >= lo && realRatio(c, o) <= hi)));
  }

  /* ---- Guess the Number ------------------------------------------------------------------
   * One card at a time. Owen picks from four answers, Medium uses a slider, Hard and Ultra type
   * the number. Scored by how close: within 1% is a Bullseye. Years are scored in years. */
  const GUESS_CARDS = CARDS.filter(c => !c.hw && !c.show && c.n <= 1e12);
  function nextGuess(used) {
    let pool = GUESS_CARDS.filter(c => !used.has(c.id) && !used.has('base:' + c.base));
    if (pool.length < 20) { used.clear(); pool = GUESS_CARDS; }
    const c = pickByFact(pool);
    used.add(c.id); used.add('base:' + c.base);
    return c;
  }
  // How close a guess was: { tier: 0 (miss) to 5 (Bullseye), pts, off: text }
  const GUESS_TIERS = [
    { name: 'Miss',      pts: 0,   cls: 't0' },
    { name: 'Close-ish', pts: 10,  cls: 't1' },
    { name: 'Not bad',   pts: 25,  cls: 't2' },
    { name: 'Close',     pts: 50,  cls: 't3' },
    { name: 'So close',  pts: 100, cls: 't4' },
    { name: 'Bullseye',  pts: 200, cls: 't5' }
  ];
  function scoreGuess(card, g, diff) {
    if (!(g >= 0) || !isFinite(g)) return { tier: 0, off: 'No guess' };
    if (card.year) {
      const d = Math.abs(g - card.n);
      const tier = d === 0 ? 5 : d <= 1 ? 4 : d <= 3 ? 3 : d <= 5 ? 2 : d <= 10 ? 1 : 0;
      return { tier: diff === 'ultra' && d > 1 ? 0 : tier, off: d === 0 ? 'Exactly right!' : `${d} year${d === 1 ? '' : 's'} off` };
    }
    const err = Math.abs(g - card.n) / card.n;
    const tier = err <= 0.01 ? 5 : err <= 0.05 ? 4 : err <= 0.10 ? 3 : err <= 0.25 ? 2 : err <= 0.5 ? 1 : 0;
    const pct = err * 100;
    const off = g === card.n ? 'Exactly right!' : `${pct < 1 ? pct.toFixed(1) : Math.round(pct)}% off`;
    return { tier: diff === 'ultra' && err > 0.05 ? 0 : tier, off };
  }
  // Owen: the answer and three wrong ones, each at least a quarter away, rounded like the answer.
  function guessChoices(card) {
    const n = card.n, out = new Set([n]);
    const dec = (String(n).split('.')[1] || '').length;
    const nice = v => {
      if (card.year) return Math.round(v);
      if (v >= 100) { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); return Math.round(v / p) * p; }
      return Number(v.toFixed(Math.max(dec, v < 10 ? 1 : 0)));
    };
    const factors = [0.25, 0.4, 0.5, 0.6, 1.5, 1.75, 2, 2.5, 3, 4].sort(() => Math.random() - 0.5);
    for (const f of factors) {
      if (out.size >= 4) break;
      const v = card.year ? n + Math.round((f - 1) * 30) : nice(n * f);
      if (v > 0 && !out.has(v) && (card.year ? Math.abs(v - n) >= 4 : Math.abs(v - n) / n >= 0.25) && (!card.year || v <= 2026)) out.add(v);
    }
    return [...out].sort((a, b) => a - b);
  }
  // Medium: a slider whose ends don't give the answer away (it's never in the middle).
  function guessRange(card) {
    if (card.year) return { lo: Math.round(card.n - rand(15, 70)), hi: Math.min(2026, Math.round(card.n + rand(15, 70))), log: false };
    return { lo: card.n / rand(2.5, 8), hi: card.n * rand(2.5, 8), log: true };
  }

  return {
    TIERS, GUESS_TIERS, ratio, isPhoto, tierOf, next, first, ultraPartners,
    realRatio, isTrap, sizeTier, nextSize, firstSize,
    nextGuess, scoreGuess, guessChoices, guessRange
  };
})();
