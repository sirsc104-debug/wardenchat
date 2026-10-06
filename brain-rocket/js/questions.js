/* Brain Rocket — builds questions from the answer lists and checks answers. */
'use strict';

const Quiz = (function () {
  const TIER_POINTS = [0, 10, 25, 50, 100, 200];
  const TIER_NAMES = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

  function norm(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/['’`.]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/^the /, '');
  }
  const keyOf = s => norm(s).replace(/[^a-z]/g, '');

  // ---- Build categories -------------------------------------------------
  const CATS = {};
  const GLOBAL = new Map(); // key -> Set of category ids

  for (const id of Object.keys(RAW_CATEGORIES)) {
    const raw = RAW_CATEGORIES[id];
    const entities = [];
    const index = new Map();
    raw.list.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      const tier = +line[0];
      const names = line.slice(2).split('/').map(s => s.trim()).filter(Boolean);
      const ent = { id: entities.length, name: names[0], tier, variants: [] };
      for (const n of names) {
        const v = { raw: n, norm: norm(n), key: keyOf(n) };
        if (!v.key || ent.variants.some(x => x.key === v.key)) continue;
        ent.variants.push(v);
        if (!index.has(v.key)) index.set(v.key, { ent, v });
        if (!GLOBAL.has(v.key)) GLOBAL.set(v.key, new Set());
        GLOBAL.get(v.key).add(id);
      }
      entities.push(ent);
    });
    CATS[id] = { id, name: raw.name, noun: raw.noun, icon: raw.icon, entities, index };
  }

  // ---- Constraints ------------------------------------------------------
  const AN = new Set('aefhilmnorsx'.split(''));
  const L = l => `<span class="ltr">${l.toUpperCase()}</span>`;
  const article = l => (AN.has(l) ? 'an' : 'a');            // before a letter name: "an S"
  const articleFor = w => (/^[aeiou]/i.test(w) ? 'an' : 'a'); // before a word: "a sport", "an animal"
  const count = (s, l) => s.split(l).length - 1;

  const RULES = {
    start:    { test: (v, c) => v.key[0] === c.l,                 text: c => `starts with ${L(c.l)}`,           why: c => `doesn't start with ${c.l.toUpperCase()}` },
    contains: { test: (v, c) => v.key.includes(c.l),              text: c => `has ${article(c.l)} ${L(c.l)} in it`, why: c => `has no ${c.l.toUpperCase()} in it` },
    end:      { test: (v, c) => v.key[v.key.length - 1] === c.l,  text: c => `ends with ${L(c.l)}`,             why: c => `doesn't end with ${c.l.toUpperCase()}` },
    without:  { test: (v, c) => !v.key.includes(c.l),             text: c => `has <b>no</b> ${L(c.l)} in it`,   why: c => `has ${article(c.l)} ${c.l.toUpperCase()} in it` },
    len:      { test: (v, c) => v.key.length === c.n,             text: c => `is exactly <b>${c.n} letters</b> long`, why: c => `isn't ${c.n} letters long` },
    minlen:   { test: (v, c) => v.key.length >= c.n,              text: c => `is <b>${c.n}+ letters</b> long`,  why: c => `is shorter than ${c.n} letters` },
    double:   { test: v => /(.)\1/.test(v.key),                   text: () => `has a <b>double letter</b> (like EE or LL)`, why: () => `has no double letter` },
    words:    { test: v => v.norm.includes(' '),                  text: () => `is <b>more than one word</b>`,   why: () => `is only one word` },
    twice:    { test: (v, c) => count(v.key, c.l) >= 2,           text: c => `has ${L(c.l)} at least <b>twice</b>`, why: c => `doesn't have two ${c.l.toUpperCase()}s` }
  };

  // Build the parameters of one rule from a seed answer, so at least that answer fits.
  function makeRule(type, k, v, used, rng) {
    const pick = arr => arr[Math.floor(rng() * arr.length)];
    switch (type) {
      case 'start': return { type, l: k[0] };
      case 'end': return { type, l: k[k.length - 1] };
      case 'contains': {
        const opts = [...new Set(k.slice(1, -1).split(''))].filter(l => !used.has(l));
        if (!opts.length) return null;
        const l = pick(opts); used.add(l); return { type, l };
      }
      case 'without': {
        const opts = 'eaoinrstlu'.split('').filter(l => !k.includes(l) && !used.has(l));
        if (!opts.length) return null;
        const l = pick(opts); used.add(l); return { type, l };
      }
      case 'len': return k.length >= 4 && k.length <= 11 ? { type, n: k.length } : null;
      case 'minlen': return k.length >= 7 ? { type, n: Math.max(7, k.length - Math.floor(rng() * 3)) } : null;
      case 'double': return /(.)\1/.test(k) ? { type } : null;
      case 'words': return v.norm.includes(' ') ? { type } : null;
      case 'twice': {
        const opts = [...new Set(k.split(''))].filter(l => count(k, l) >= 2 && !used.has(l));
        if (!opts.length) return null;
        const l = pick(opts); used.add(l); return { type, l };
      }
    }
    return null;
  }

  const TEMPLATES = {
    easy: [
      [['start'], 5], [['start', 'contains'], 4], [['end'], 1]
    ],
    medium: [
      [['start', 'contains'], 4], [['start', 'end'], 2], [['contains', 'end'], 1.5],
      [['start', 'without'], 1.5], [['start', 'minlen'], 1], [['start', 'twice'], 0.8], [['double', 'start'], 0.7]
    ],
    hard: [
      [['start', 'contains', 'end'], 2], [['start', 'len'], 2], [['contains', 'contains', 'without'], 1.5],
      [['double', 'start'], 1], [['words', 'start'], 0.8], [['end', 'len'], 1.5], [['start', 'twice'], 1],
      [['contains', 'end', 'without'], 1]
    ]
  };
  const CAT_WEIGHTS = {
    easy:   { countries: 4, animals: 4, fruitveg: 3, sports: 2 },
    medium: { countries: 3, animals: 3, fruitveg: 2, sports: 2, capitals: 2, elements: 1 },
    hard:   { countries: 2, animals: 2, fruitveg: 2, sports: 1.5, capitals: 2, elements: 2 }
  };
  const MIN_ANSWERS = { easy: 6, medium: 4, hard: 2 };

  function weighted(pairs, rng) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = rng() * total;
    for (const p of pairs) { if ((r -= p[1]) <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }

  const passes = (v, rules) => rules.every(c => RULES[c.type].test(v, c));

  function answersFor(cat, rules) {
    const out = [];
    for (const ent of cat.entities) {
      const v = ent.variants.find(x => passes(x, rules));
      if (v) out.push({ ent, v });
    }
    return out;
  }

  function sortRules(rules) {
    const order = ['start', 'contains', 'twice', 'end', 'without', 'double', 'len', 'minlen', 'words'];
    return rules.slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  function phrase(cat, rules) {
    const parts = sortRules(rules).map(c => RULES[c.type].text(c));
    const joined = parts.length === 1 ? parts[0]
      : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
    return `Name ${articleFor(cat.noun)} <b>${cat.noun}</b> that ${joined}`;
  }

  function generate(mode, seen, rng = Math.random) {
    const min = MIN_ANSWERS[mode];
    const cats = Object.entries(CAT_WEIGHTS[mode]);
    for (let attempt = 0; attempt < 400; attempt++) {
      const cat = CATS[weighted(cats, rng)];
      const types = weighted(TEMPLATES[mode], rng);
      // Easy seeds come from well-known answers so the letters feel fair.
      const pool = mode === 'easy' ? cat.entities.filter(e => e.tier <= 3) : cat.entities;
      const ent = pool[Math.floor(rng() * pool.length)];
      const v = ent.variants[0];
      const k = v.key;
      if (k.length < 3) continue;
      const used = new Set([k[0], k[k.length - 1]]);
      const rules = [];
      let ok = true;
      for (const t of types) {
        const r = makeRule(t, k, v, used, rng);
        if (!r) { ok = false; break; }
        rules.push(r);
      }
      if (!ok) continue;
      const sig = cat.id + '|' + JSON.stringify(sortRules(rules));
      if (seen && seen.has(sig)) continue;
      const answers = answersFor(cat, rules);
      if (answers.length < min) continue;
      // Avoid questions where every answer is obscure in easy/medium.
      if (mode !== 'hard' && !answers.some(a => a.ent.tier <= 3)) continue;
      if (seen) seen.add(sig);
      const maxTier = Math.max(...answers.map(a => a.ent.tier));
      return { cat, rules, text: phrase(cat, rules), answers, maxTier, sig };
    }
    // Fallback: very simple question.
    const cat = CATS.countries;
    const rules = [{ type: 'start', l: 's' }];
    const answers = answersFor(cat, rules);
    return { cat, rules, text: phrase(cat, rules), answers, maxTier: Math.max(...answers.map(a => a.ent.tier)), sig: 'fallback' };
  }

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

  function find(cat, k) {
    if (cat.index.has(k)) return { ...cat.index.get(k), fuzzy: false };
    // Plurals: "peas", "tomatoes", "mice" won't all work, but most do.
    const tries = [k.replace(/es$/, ''), k.replace(/s$/, ''), k + 's', k.replace(/ies$/, 'y')];
    for (const t of tries) if (t !== k && cat.index.has(t)) return { ...cat.index.get(t), fuzzy: false };
    return null;
  }

  function fuzzy(cat, k) {
    if (k.length < 5) return null;
    const max = k.length >= 9 ? 2 : 1;
    let best = null, bestD = max + 1;
    for (const [key, hit] of cat.index) {
      const d = lev(k, key, max);
      if (d < bestD) { bestD = d; best = hit; }
    }
    return best ? { ...best, fuzzy: true } : null;
  }

  /* Returns { ok, reason, ent, v, fuzzy } */
  function check(q, input) {
    const k = keyOf(input);
    if (k.length < 2) return { ok: false, reason: 'Type an answer first!' };
    let hit = find(q.cat, k);
    if (!hit) {
      const other = GLOBAL.get(k);
      if (other && !other.has(q.cat.id)) {
        const c = CATS[[...other][0]];
        return { ok: false, reason: `That's ${articleFor(c.noun)} ${c.noun}, not ${articleFor(q.cat.noun)} ${q.cat.noun}!` };
      }
      hit = fuzzy(q.cat, k);
    }
    if (!hit) return { ok: false, reason: `Hmm, "${input.trim()}" isn't on our ${q.cat.noun} list.` };
    const failed = q.rules.find(c => !RULES[c.type].test(hit.v, c));
    if (failed) {
      return { ok: false, reason: `${hit.v.raw} ${RULES[failed.type].why(failed)}.`, near: true };
    }
    return { ok: true, ent: hit.ent, v: hit.v, fuzzy: hit.fuzzy };
  }

  /* A few example answers for the reveal: the rarest ones plus a common one. */
  function examples(q, n = 4) {
    const sorted = q.answers.slice().sort((a, b) => b.ent.tier - a.ent.tier || Math.random() - 0.5);
    const picks = sorted.slice(0, n - 1);
    const common = sorted.slice(n - 1).reverse()[0];
    if (common) picks.push(common);
    return picks.map(a => ({ text: a.v.raw, tier: a.ent.tier }));
  }

  return { CATS, TIER_POINTS, TIER_NAMES, generate, check, examples, keyOf };
})();
