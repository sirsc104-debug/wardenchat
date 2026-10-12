/* Apples to Oranges — picking matchups.
 *
 * How hard a matchup is depends only on how close the two numbers are (the bigger one
 * divided by the smaller one). Owen gets numbers a fair way apart, Hard gets them close.
 * Every so often a "photo finish" comes up: two exact numbers that tie or are a few apart.
 * Matchups are picked from CARDS (facts.js): every fact, plus each measurement in its other units.
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
  function ultraPartners(c) {
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
  function nextUltra(left, used) {
    const all = ultraPartners(left).filter(c => ultraPartners(c).some(o => o.base !== left.base));
    const fresh = all.filter(c => !used.has(c.id));
    return pickByFact(fresh.length ? fresh : all.length ? all : ultraPartners(left));
  }

  /* A match for the left card.
   *   left     the card on the left
   *   diff     'owen' | 'medium' | 'hard'
   *   used     Set of card ids already shown this run (the same fact can come back in another unit)
   *   state    { pendingPhoto } carried between calls
   * Returns the card for the right side. */
  function next(left, diff, used, state) {
    if (diff === 'ultra' && ultraPartners(left).length) return nextUltra(left, used);
    if (diff === 'ultra') diff = 'hard';     // (never expected: a card with no close partner falls back to Hard)
    let pool = CARDS.filter(f => !used.has(f.id) && f.base !== left.base);
    if (pool.length < 40) {            // nearly used everything: start over (but not the card on screen)
      used.clear(); used.add(left.id);
      pool = CARDS.filter(f => f.base !== left.base);
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
      const setUp = cands.filter(f => f.x && photoPartners(f, pool).some(o => o.base !== left.base));
      if (setUp.length) return pickByFact(setUp);
    }
    return pickByFact(cands);
  }

  // A first card: a fact in its own unit, not a year (on Ultra: one with plenty of close partners).
  function first(diff) {
    if (diff === 'ultra') return pickByFact(CARDS.filter(f => !f.year && !f.converted && trusted(f) && ultraPartners(f).length >= 3));
    return pickByFact(CARDS.filter(f => !f.year && !f.converted));
  }

  return { TIERS, ratio, isPhoto, tierOf, next, first, ultraPartners };
})();
