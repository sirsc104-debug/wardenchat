/* Brain Rocket — builds questions from the topics and checks answers.
 * Two kinds of question:
 *   topic   "What's a breed of dog?"            (most questions)
 *   letter  "Name a breed of dog that starts with B and has an L in it."
 */
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
      .replace(/^(the|a|an) /, '');
  }
  const keyOf = s => norm(s).replace(/[^a-z0-9]/g, '');
  const letters = s => norm(s).replace(/[^a-z]/g, '');

  // ---- Build topics -----------------------------------------------------
  function parseList(text) {
    const entries = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const group = line.match(/^([1-5]):\s*(.*)$/);
      if (group) {
        for (const e of group[2].split(',')) if (e.trim()) entries.push([+group[1], e.trim()]);
      } else if (/^[1-5] /.test(line)) {
        entries.push([+line[0], line.slice(2).trim()]);
      }
    }
    return entries;
  }

  const TOPIC = {};
  for (const t of TOPICS) {
    const entities = [];
    const index = new Map();
    for (const [tier, text] of parseList(t.list)) {
      const names = text.split('/').map(s => s.trim()).filter(Boolean);
      const ent = { id: entities.length, name: names[0], tier, variants: [] };
      for (const n of names) {
        const v = { raw: n, norm: norm(n), key: keyOf(n), letters: letters(n) };
        if (!v.key || index.has(v.key)) continue;   // first (most common) wins
        ent.variants.push(v);
        index.set(v.key, { ent, v });
      }
      if (ent.variants.length) entities.push(ent);
    }
    const strip = (t.strip || []).map(norm);
    TOPIC[t.id] = { ...t, entities, index, strip, html: t.q.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') };
  }
  const ALL = Object.values(TOPIC);

  // ---- Letter rules -----------------------------------------------------
  const AN = new Set('aefhilmnorsx'.split(''));
  const L = l => `<span class="ltr">${l.toUpperCase()}</span>`;
  const article = l => (AN.has(l) ? 'an' : 'a');                // before a letter: "an S"
  const articleFor = w => (/^[aeiou]/i.test(w) ? 'an' : 'a');   // before a word: "an animal"
  const count = (s, l) => s.split(l).length - 1;

  const RULES = {
    start:    { test: (v, c) => v.letters[0] === c.l,                       text: c => `starts with ${L(c.l)}`,              why: c => `doesn't start with ${c.l.toUpperCase()}` },
    contains: { test: (v, c) => v.letters.includes(c.l),                    text: c => `has ${article(c.l)} ${L(c.l)} in it`, why: c => `has no ${c.l.toUpperCase()} in it` },
    end:      { test: (v, c) => v.letters[v.letters.length - 1] === c.l,    text: c => `ends with ${L(c.l)}`,                why: c => `doesn't end with ${c.l.toUpperCase()}` },
    without:  { test: (v, c) => !v.letters.includes(c.l),                   text: c => `has <b>no</b> ${L(c.l)} in it`,      why: c => `has ${article(c.l)} ${c.l.toUpperCase()} in it` },
    len:      { test: (v, c) => v.letters.length === c.n,                   text: c => `is exactly <b>${c.n} letters</b> long`, why: c => `isn't ${c.n} letters long` },
    minlen:   { test: (v, c) => v.letters.length >= c.n,                    text: c => `is <b>${c.n}+ letters</b> long`,     why: c => `is shorter than ${c.n} letters` },
    double:   { test: v => /(.)\1/.test(v.letters),                         text: () => `has a <b>double letter</b> (like EE or LL)`, why: () => `has no double letter` },
    words:    { test: v => v.norm.includes(' '),                            text: () => `is <b>more than one word</b>`,      why: () => `is only one word` },
    twice:    { test: (v, c) => count(v.letters, c.l) >= 2,                 text: c => `has ${L(c.l)} at least <b>twice</b>`, why: c => `doesn't have two ${c.l.toUpperCase()}s` }
  };

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

  const LETTER_TEMPLATES = {
    easy:   [[['start'], 5], [['start', 'contains'], 4], [['end'], 1]],
    medium: [[['start', 'contains'], 4], [['start', 'end'], 2], [['contains', 'end'], 1.5], [['start', 'without'], 1.5],
             [['start', 'minlen'], 1], [['start', 'twice'], 0.8], [['double', 'start'], 0.7]],
    hard:   [[['start', 'contains', 'end'], 2], [['start', 'len'], 2], [['contains', 'contains', 'without'], 1.5],
             [['double', 'start'], 1], [['words', 'start'], 0.8], [['end', 'len'], 1.5], [['start', 'twice'], 1],
             [['contains', 'end', 'without'], 1]]
  };
  const LETTER_SHARE = { easy: 0.3, medium: 0.33, hard: 0.35 };
  const MIN_ANSWERS = { easy: 6, medium: 4, hard: 2 };
  // How often each topic level comes up in each mode.
  const LEVEL_WEIGHTS = { easy: [0, 1, 0.12, 0], medium: [0, 0.6, 1, 0.35], hard: [0, 0.3, 1, 1] };

  function weighted(pairs, rng) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = rng() * total;
    for (const p of pairs) { if ((r -= p[1]) <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }

  const passes = (v, rules) => rules.every(c => RULES[c.type].test(v, c));
  function answersFor(topic, rules) {
    const out = [];
    for (const ent of topic.entities) {
      const v = rules.length ? ent.variants.find(x => passes(x, rules)) : ent.variants[0];
      if (v) out.push({ ent, v });
    }
    return out;
  }
  function sortRules(rules) {
    const order = ['start', 'contains', 'twice', 'end', 'without', 'double', 'len', 'minlen', 'words'];
    return rules.slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  function finish(topic, rules, text, sig) {
    const answers = answersFor(topic, rules);
    return { cat: topic, rules, text, answers, maxTier: Math.max(...answers.map(a => a.ent.tier)), sig };
  }

  // Pick a topic, avoiding ones already asked this run until the pool runs out.
  function pickTopic(mode, used, rng, filter) {
    const W = LEVEL_WEIGHTS[mode];
    let pool = ALL.filter(t => W[t.level] > 0 && (!filter || filter(t)));
    let fresh = pool.filter(t => !used.has(t.id));
    if (!fresh.length) { pool.forEach(t => used.delete(t.id)); fresh = pool; }
    return weighted(fresh.map(t => [t, W[t.level]]), rng);
  }

  function letterQuestion(mode, seen, rng) {
    const min = MIN_ANSWERS[mode];
    const big = t => t.entities.length >= 40;
    for (let attempt = 0; attempt < 300; attempt++) {
      const topic = pickTopic(mode, seen.letterTopics, rng, big);
      const types = weighted(LETTER_TEMPLATES[mode], rng);
      const pool = mode === 'easy' ? topic.entities.filter(e => e.tier <= 3) : topic.entities;
      const ent = pool[Math.floor(rng() * pool.length)];
      const v = ent.variants[0];
      const k = v.letters;
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
      const sig = topic.id + '|' + JSON.stringify(sortRules(rules));
      if (seen.sigs.has(sig)) continue;
      const answers = answersFor(topic, rules);
      if (answers.length < min) continue;
      if (mode !== 'hard' && !answers.some(a => a.ent.tier <= 3)) continue;
      seen.sigs.add(sig);
      seen.letterTopics.add(topic.id);
      const parts = sortRules(rules).map(c => RULES[c.type].text(c));
      const joined = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
      return finish(topic, rules, `Name ${articleFor(topic.noun)} <b>${topic.noun}</b> that ${joined}.`, sig);
    }
    return null;
  }

  function newRun() { return { topics: new Set(), letterTopics: new Set(), sigs: new Set() }; }

  function generate(mode, seen, rng = Math.random) {
    if (rng() < LETTER_SHARE[mode]) {
      const q = letterQuestion(mode, seen, rng);
      if (q) return q;
    }
    const topic = pickTopic(mode, seen.topics, rng);
    seen.topics.add(topic.id);
    return finish(topic, [], topic.html, topic.id);
  }

  // ---- Answer checking --------------------------------------------------
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

  function exact(topic, k) {
    if (topic.index.has(k)) return topic.index.get(k);
    // Plurals and singulars: "pancake" / "pancakes", "tomatoes", "berries".
    const tries = [k.replace(/es$/, ''), k.replace(/s$/, ''), k + 's', k + 'es', k.replace(/ies$/, 'y'), k.replace(/y$/, 'ies')];
    for (const t of tries) if (t !== k && topic.index.has(t)) return topic.index.get(t);
    return null;
  }

  function find(topic, input) {
    const n = norm(input);
    let hit = exact(topic, keyOf(n));
    if (hit) return { ...hit, fuzzy: false };
    // Drop words players often add ("beagle dog", "oak tree").
    if (topic.strip.length) {
      const words = n.split(' ').filter(w => !topic.strip.includes(w));
      if (words.length) {
        hit = exact(topic, keyOf(words.join(' ')));
        if (hit) return { ...hit, fuzzy: false };
      }
    }
    // An answer said inside a longer phrase: "a big golden retriever".
    const padded = ` ${n} `;
    let best = null;
    for (const [key, h] of topic.index) {
      if (key.length >= 4 && padded.includes(` ${h.v.norm} `) && (!best || h.v.norm.length > best.v.norm.length)) best = h;
    }
    if (best) return { ...best, fuzzy: false };
    // Small typos.
    const k = keyOf(n);
    if (k.length >= 5) {
      const max = k.length >= 9 ? 2 : 1;
      let bestD = max + 1;
      for (const [key, h] of topic.index) {
        const d = lev(k, key, max);
        if (d < bestD) { bestD = d; best = h; }
      }
      if (best) return { ...best, fuzzy: true };
    }
    return null;
  }

  /* Returns { ok, reason, ent, v, fuzzy } */
  function check(q, input) {
    if (keyOf(input).length < 1) return { ok: false, reason: 'Type an answer first!' };
    const hit = find(q.cat, input);
    if (!hit) return { ok: false, reason: `Hmm, "${input.trim()}" isn't on our list for this one. Try another!` };
    const failed = q.rules.find(c => !RULES[c.type].test(hit.v, c));
    if (failed) return { ok: false, reason: `${hit.v.raw} ${RULES[failed.type].why(failed)}.`, near: true };
    return { ok: true, ent: hit.ent, v: hit.v, fuzzy: hit.fuzzy };
  }

  /* A few example answers for the reveal: the rarest ones plus a common one. */
  function examples(q, n = 4) {
    const sorted = q.answers.slice().sort((a, b) => b.ent.tier - a.ent.tier || Math.random() - 0.5);
    const picks = sorted.slice(0, n - 1);
    const rest = sorted.slice(n - 1);
    const common = rest[rest.length - 1];
    if (common) picks.push(common);
    return picks.map(a => ({ text: a.v.raw, tier: a.ent.tier }));
  }

  return { TOPIC, TIER_POINTS, TIER_NAMES, generate, check, examples, keyOf, newRun };
})();
