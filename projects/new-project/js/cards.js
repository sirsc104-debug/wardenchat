/* Apples to Oranges — the cards. Loaded after every facts file.
 *
 * Every card that can come up: each fact in its own unit, plus each measurement in the other
 * units of its kind, as long as the number reads sensibly (at least 0.1, at most a trillion,
 * and above zero). Converted numbers are rounded to what the card shows, and the game judges
 * the numbers exactly as shown.
 *
 * A measurement card also knows what it measures (dim: 'len', 'mass', 'speed', 'temp', 'time',
 * 'vol'), its unit (mk) and its real size in that kind's base unit (real: meters, kilograms,
 * meters per second, kelvin, seconds or liters), worked out from the number on the card.
 * Real Size compares those. */
'use strict';

const Units = (function () {
  const groupOf = {};
  for (const [g, units] of Object.entries(UNITS)) for (const k of Object.keys(units)) groupOf[k] = g;
  const toK = { F: v => (v - 32) * 5 / 9 + 273.15, C: v => v + 273.15, K: v => v };
  const fromK = { F: k => (k - 273.15) * 9 / 5 + 32, C: k => k - 273.15, K: k => k };
  const toBase = (v, k) => (groupOf[k] === 'temp' ? toK[k](v) : v * UNITS[groupOf[k]][k][0]);
  const fromBase = (b, k) => (groupOf[k] === 'temp' ? fromK[k](b) : b / UNITS[groupOf[k]][k][0]);
  const round = v => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
  // an approximate number keeps three significant figures, so "about 165 tons" doesn't become 149,685,482 grams
  const sig3 = v => { if (v < 1000) return round(v); const p = Math.pow(10, Math.floor(Math.log10(v)) - 2); return Math.round(v / p) * p; };
  const name = k => UNITS[groupOf[k]][k][1];
  return { groupOf, toBase, fromBase, round, sig3, name };
})();

const CARDS = (function () {
  const out = [];
  for (const f of FACTS) {
    if (!f.m) { out.push(Object.assign({}, f, { base: f.id })); continue; }
    const g = Units.groupOf[f.m];
    for (const k of Object.keys(UNITS[g])) {
      if (k === f.m) {
        out.push(Object.assign({}, f, { base: f.id, id: f.id + '@' + k, u: f.u || Units.name(k), dim: g, mk: k, real: Units.toBase(f.n, k) }));
        continue;
      }
      const v = Units.fromBase(Units.toBase(f.n, f.m), k);
      const n = f.x ? Units.round(v) : Units.sig3(v);
      if (!(n > 0) || v < 0.1 || v > 1e12) continue;
      // xs: converted from an exact fact, so it's trusted to the rounding shown (Ultra uses these)
      out.push(Object.assign({}, f, {
        base: f.id, id: f.id + '@' + k, n, u: Units.name(k), x: 0, xs: f.x ? 1 : 0, converted: 1,
        dim: g, mk: k, real: Units.toBase(n, k)
      }));
    }
  }
  // Every year also comes up as "how many years ago" and "how many days ago", worked out from today.
  // They're the same fact (same base), not new ones. Years ago is exact (this year minus that year);
  // days ago counts from the fact's date when it has one, otherwise from the middle of that year.
  const now = new Date(), thisYear = now.getFullYear(), DAY = 86400000;
  const today = Date.UTC(thisYear, now.getMonth(), now.getDate());
  const fmtDate = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  for (const f of FACTS) {
    if (!f.year || !(f.n < thisYear)) continue;
    const what = /^the year /.test(f.t) ? f.t.replace(/^the year /, '') : 'it was ' + f.t;
    out.push(Object.assign({}, f, {
      base: f.id, id: f.id + '@yearsago', c: 'ago', t: 'how many years ago ' + what, n: thisYear - f.n, u: 'years ago',
      year: 0, x: 0, xs: 1, converted: 1, ago: 1, note: 'In ' + f.n + (f.date ? ' (' + fmtDate(f.date) + ')' : '')
    }));
    const from = f.date ? Date.parse(f.date + 'T00:00:00Z') : Date.UTC(f.n, 6, 1);
    const days = Math.round((today - from) / DAY);
    if (days < 1) continue;
    out.push(Object.assign({}, f, {
      base: f.id, id: f.id + '@daysago', c: 'ago', t: 'how many days ago ' + what, n: f.date ? days : Units.sig3(days), u: 'days ago',
      year: 0, x: 0, xs: 0, converted: 1, ago: 1, note: f.date ? 'Since ' + fmtDate(f.date) : 'About. In ' + f.n
    }));
  }
  return out;
})();
CATS.ago = { name: 'Years Ago', icon: '⏳' };
