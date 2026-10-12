/* Apples to Oranges — the cards. Loaded after every facts file. */
'use strict';

/* Every card that can come up: each fact in its own unit, plus each measurement in the other
 * units of its kind, as long as the number reads sensibly (at least 0.1, at most a trillion,
 * and above zero). Converted numbers are rounded to what the card shows, and the game judges
 * the numbers exactly as shown. */
const CARDS = (function () {
  const groupOf = {};
  for (const [g, units] of Object.entries(UNITS)) for (const k of Object.keys(units)) groupOf[k] = g;
  const toK = { F: v => (v - 32) * 5 / 9 + 273.15, C: v => v + 273.15, K: v => v };
  const fromK = { F: k => (k - 273.15) * 9 / 5 + 32, C: k => k - 273.15, K: k => k };
  const round = v => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
  // an approximate number keeps three significant figures, so "about 165 tons" doesn't become 149,685,482 grams
  const sig3 = v => { if (v < 1000) return round(v); const p = Math.pow(10, Math.floor(Math.log10(v)) - 2); return Math.round(v / p) * p; };

  const out = [];
  for (const f of FACTS) {
    if (!f.m) { out.push(Object.assign({}, f, { base: f.id })); continue; }
    const g = groupOf[f.m];
    const units = UNITS[g];
    for (const [k, [size, name]] of Object.entries(units)) {
      if (k === f.m) {
        out.push(Object.assign({}, f, { base: f.id, id: f.id + '@' + k, u: f.u || name }));
        continue;
      }
      const v = g === 'temp' ? fromK[k](toK[f.m](f.n)) : f.n * units[f.m][0] / size;
      const n = f.x ? round(v) : sig3(v);
      if (!(n > 0) || v < 0.1 || v > 1e12) continue;
      // xs: converted from an exact fact, so it's trusted to the rounding shown (Ultra uses these)
      out.push(Object.assign({}, f, { base: f.id, id: f.id + '@' + k, n, u: name, x: 0, xs: f.x ? 1 : 0, converted: 1 }));
    }
  }
  return out;
})();
