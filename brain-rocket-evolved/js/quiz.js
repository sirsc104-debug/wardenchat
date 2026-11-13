/* Brain Rocket – Evolved: the categories, answer matching and the daily schedule.
 *
 * Categories come from js/answers-*.js (built by tools/build_answers.py), each registered with
 * EVO.cat({ id, q, noun, icon, strip, list }). A list has one answer per line:
 *     <tier>|Shown name|alias|alias
 * Tiers: 0 Launch Pad, 1 Space Junk, 2 Orbiter, 3 Moonshot, 4 Deep Space, 5 Supernova (one per category).
 *
 * Matching starts from Brain Rocket's (accents and "the" ignored, plurals, filler words like
 * "beagle dog", an answer inside a phrase) and is very forgiving about spelling: up to about a third
 * of a long name can be wrong, and spellings that sound right count too (chiwawa, rotwiler, daschund).
 */
'use strict';

const EVO = { CATS: [], cat(c) { EVO.CATS.push(c); } };

const Quiz = (function () {
  const TIERS = [
    { id: 'pad', name: 'Launch Pad', pts: 500, emoji: '🏁', blurb: 'The answer everyone blurts out.' },
    { id: 'junk', name: 'Space Junk', pts: 750, emoji: '🛰️', blurb: 'The famous "obscure" pick. Everyone reaches for it.' },
    { id: 'orbit', name: 'Orbiter', pts: 1500, emoji: '🚀', blurb: 'Solid. Safely in orbit.' },
    { id: 'moon', name: 'Moonshot', pts: 3000, emoji: '🌙', blurb: 'Genuinely uncommon. Nice pull.' },
    { id: 'deep', name: 'Deep Space', pts: 4250, emoji: '🪐', blurb: 'True obscurity. Few fly this far.' },
    { id: 'nova', name: 'Supernova', pts: 5000, emoji: '🌟', blurb: 'The one gem of this prompt. Out of this world.' },
  ];
  const MISS = { name: 'Lost signal', emoji: '⬛', pts: 0 };
  const PER_PROMPT = 5000;

  function norm(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/\+/g, ' plus ')
      .replace(/['’`.]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/^(the|a|an) /, '');
  }
  const keyOf = s => norm(s).replace(/[^a-z0-9]/g, '');

  // ---- Building categories (lazily, the first time one is played) -------
  const BY_ID = new Map();
  function built(c) {
    if (c.entities) return c;
    c.entities = []; c.index = new Map();
    for (const line of c.list.split('\n')) {
      if (!line.trim()) continue;
      const [tier, ...names] = line.split('|');
      const ent = { name: names[0], tier: +tier, id: c.entities.length };
      let any = false;
      for (const raw of names) {
        const key = keyOf(raw);
        if (!key || c.index.has(key)) continue;   // the first answer listed keeps a shared name
        c.index.set(key, { ent, v: { raw, norm: norm(raw), key } });
        any = true;
      }
      if (any) c.entities.push(ent);
    }
    c.strip = c.strip || [];
    c.gem = c.entities.find(e => e.tier === 5) || null;
    c.html = c.q.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    return c;
  }
  const get = id => BY_ID.get(id);
  function ready() { for (const c of EVO.CATS) BY_ID.set(c.id, c); }

  // ---- Matching -----------------------------------------------------------
  // Edit distance where swapping two neighbouring letters counts as one typo.
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let pp = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, pp[j - 2] + 1);
        cur[j] = d;
        if (d < best) best = d;
      }
      if (best > max) return max + 1;
      pp = prev; prev = cur;
    }
    return prev[b.length];
  }

  function exact(c, text) {
    const k = keyOf(text);
    if (c.index.has(k)) return c.index.get(k);
    const tries = [k.replace(/es$/, ''), k.replace(/s$/, ''), k + 's', k + 'es', k.replace(/ies$/, 'y'), k.replace(/y$/, 'ies')];
    for (const t of tries) if (t !== k && t && c.index.has(t)) return c.index.get(t);
    return null;
  }

  // A rough "sounds like" spelling, so misspellings by ear still match: ph/f, c/k/ck/q, s/z, x/ks,
  // y/i, "hu" before a vowel as w (chihuahua ~ chiwawa), silent h, and doubled letters.
  function sound(k) {
    return k.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/[cq]/g, 'k')
      .replace(/x/g, 'ks').replace(/z/g, 's').replace(/y/g, 'i').replace(/hu(?=[aeio])/g, 'w').replace(/wh/g, 'w')
      .replace(/(?!^)h/g, '').replace(/(.)\1+/g, '$1');
  }
  // How many letters can be wrong: lenient on purpose (about a third of a long name).
  const allowance = n => (n < 4 ? 0 : n < 6 ? 1 : n < 9 ? 2 : n < 13 ? 3 : 4);

  function fuzzy(c, text) {
    const k = keyOf(text);
    const max = allowance(k.length);
    if (!max) return null;
    if (!c.sounds) { c.sounds = new Map(); for (const h of c.index.values()) c.sounds.set(h, sound(h.v.key)); }
    const sk = sound(k);
    let best = null, bestD = 99;
    for (const h of c.index.values()) {
      const key = h.v.key;
      if (key.length < 4 || Math.abs(key.length - k.length) > max + 1) continue;
      const lim = Math.min(max, allowance(key.length) || 1);
      let d = lev(k, key, lim);
      const ds = lev(sk, c.sounds.get(h), lim);
      if (ds < d) d = ds + 0.5;           // a sound-alike counts a little less than a real typo
      // the closest wins; on a tie, the better-known answer (what people usually mean)
      if (d <= lim && (d < bestD || (d === bestD && h.ent.tier < best.ent.tier))) { bestD = d; best = h; }
    }
    return best && { h: best, d: bestD };
  }

  /* -> { ent, v, fuzzy } or null */
  function find(c, input) {
    c = built(c);
    const n = norm(input);
    if (!n) return null;
    // the answer as typed, and without the filler words players add ("beagle dog")
    const tries = [n];
    if (c.strip.length) {
      const words = n.split(' ').filter(w => !c.strip.includes(w));
      if (words.length && words.length < n.split(' ').length) tries.push(words.join(' '));
    }
    for (const t of tries) { const hit = exact(c, t); if (hit) return { ...hit, fuzzy: false }; }
    // an answer said inside a longer phrase: "a big golden retriever"
    const padded = ` ${n} `;
    let best = null;
    for (const h of c.index.values()) {
      if (h.v.key.length >= 4 && padded.includes(` ${h.v.norm} `) && (!best || h.v.norm.length > best.v.norm.length)) best = h;
    }
    if (best) return { ...best, fuzzy: false };
    // the closest typo match over both versions ("beagel dog" is one letter off "beagle")
    let pick = null;
    for (const t of tries) { const f = fuzzy(c, t); if (f && (!pick || f.d < pick.d)) pick = f; }
    return pick ? { ...pick.h, fuzzy: true } : null;
  }

  /* Every answer for the reveal list, rarest first, with the names the player could have typed. */
  function answers(c) {
    c = built(c);
    const alts = new Map();
    for (const h of c.index.values()) if (h.v.raw !== h.ent.name) (alts.get(h.ent) || alts.set(h.ent, []).get(h.ent)).push(h.v.raw);
    return c.entities.map(e => ({ name: e.name, tier: e.tier, alt: alts.get(e) || [] }))
      .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name));
  }
  const tierCounts = c => built(c).entities.reduce((n, e) => (n[e.tier]++, n), [0, 0, 0, 0, 0, 0]);
  const examples = (c, tier, n = 3) => built(c).entities.filter(e => e.tier === tier).slice(0, n).map(e => e.name);

  // ---- Seeded randomness and the daily schedule ---------------------------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(list, r) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // The daily order works through every category before any comes back: the categories are
  // shuffled once per "cycle" (seeded by the cycle number) and each day takes the next ten.
  // Sorting by id first means the order doesn't depend on which file a category is in.
  const DAILY = 10;
  function daily(day) {
    const ids = EVO.CATS.filter(c => !c.noDaily).map(c => c.id).sort();
    const out = [];
    if (ids.length < DAILY) throw new Error('Not enough categories for a daily launch');
    for (let slot = (day - 1) * DAILY; out.length < DAILY; slot++) {
      const cycle = Math.floor(slot / ids.length);
      const order = shuffled(ids, rng(0x5eed + cycle * 7919));
      const id = order[slot % ids.length];
      if (!out.includes(id)) out.push(id);
    }
    return out.map(get);
  }
  // Endless: each difficulty weights the categories by how hard they are (1 everyday, 2 mixed,
  // 3 expert), as Brain Rocket's modes did. A category doesn't come back until every category with a
  // chance has come up.
  const LEVEL_WEIGHTS = { easy: [0, 1, 0.15, 0], medium: [0, 0.6, 1, 0.3], hard: [0, 0.15, 0.6, 1], ultra: [0, 0.15, 0.6, 1] };
  function endless(seed, mode = 'medium') {
    const r = rng(seed), W = LEVEL_WEIGHTS[mode] || LEVEL_WEIGHTS.medium;
    const pool = EVO.CATS.map(c => ({ c, w: W[c.level || 2] })).filter(x => x.w > 0);
    let used = new Set(), last = null;
    return () => {
      let left = pool.filter(x => !used.has(x.c.id) && x.c.id !== last);
      if (!left.length) { used = new Set(); left = pool.filter(x => x.c.id !== last); }
      let t = left.reduce((n, x) => n + x.w, 0) * r(), pick = left[0];
      for (const x of left) if ((t -= x.w) <= 0) { pick = x; break; }
      used.add(pick.c.id); last = pick.c.id;
      return get(pick.c.id);
    };
  }

  return { TIERS, MISS, PER_PROMPT, DAILY, norm, keyOf, ready, get, built, find, answers, tierCounts, examples, daily, endless, rng };
})();
