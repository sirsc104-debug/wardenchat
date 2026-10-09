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
      .replace(/\+/g, ' plus ')                          // C++, Disney+, a B+ grade
      .replace(/\b([a-z])-(?=\s|$)/g, '$1 minus')       // an A- grade, so it isn't the same as A
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
        for (const part of group[2].split(',')) {
          const e = part.trim();
          if (!e) continue;
          // "London @1908,1948,2012": the extra years belong to the answer before them.
          if (/^\d{4}(-\d{4})?$/.test(e) && entries.length && /@[\d,-]+$/.test(entries[entries.length - 1][1])) {
            entries[entries.length - 1][1] += ',' + e;
          } else entries.push([+group[1], e]);
        }
      } else if (/^[1-5] /.test(line)) {
        entries.push([+line[0], line.slice(2).trim()]);
      }
    }
    return entries;
  }

  // "Toy Story @1995", "London @1908,1948,2012", "Woodrow Wilson @1913-1921"
  function parseYears(text) {
    const m = text.match(/\s*@([\d,\s-]+)$/);
    if (!m) return [text, null];
    const spans = m[1].split(',').map(p => p.trim()).filter(Boolean).map(p => {
      const [a, b] = p.split('-').map(Number);
      return [a, b || a];
    });
    return [text.slice(0, m.index), spans];
  }

  const TOPIC = {};
  for (const t of TOPICS) {
    let entities = [];
    const index = new Map();
    const add = ent => {
      const own = { ...ent, id: entities.length, variants: [] };
      for (const v of ent.variants) {
        if (index.has(v.key)) continue;   // first (most common) wins
        own.variants.push(v);
        index.set(v.key, { ent: own, v });
      }
      if (own.variants.length) entities.push(own);
    };
    if (t.from) {
      // A narrower version of another topic: "Name a country in Africa".
      const only = new Set(t.only.split(',').map(n => keyOf(n)).filter(Boolean));
      for (const ent of TOPIC[t.from].entities) if (only.has(keyOf(ent.name))) add(ent);
    } else {
      for (const [tier, text] of parseList(t.list)) {
        const [body, years] = parseYears(text);
        const names = body.split('/').map(n => n.trim()).filter(Boolean);
        if (!names.length) continue;
        add({
          name: names[0], tier, years,
          variants: names.map(n => ({ raw: n, norm: norm(n), key: keyOf(n), letters: letters(n) })).filter(v => v.key)
        });
      }
    }
    const strip = (t.strip || []).map(norm);
    TOPIC[t.id] = { ...t, entities, index, strip, html: t.q.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') };
  }
  const ALL = Object.values(TOPIC);

  // ---- Letter rules -----------------------------------------------------
  const AN = new Set('aefhilmnorsx'.split(''));
  const L = l => `<span class="ltr">${l.toUpperCase()}</span>`;
  const article = l => (AN.has(l) ? 'an' : 'a');                // before a letter: "an S"
  // Before a word: "an animal", but "a US president", "a unit".
  const articleFor = w => (/^(us\b|uni|use|eu|one)/i.test(w) ? 'a' : /^[aeiou]/i.test(w) ? 'an' : 'a');
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
    twice:    { test: (v, c) => count(v.letters, c.l) >= 2,                 text: c => `has ${L(c.l)} at least <b>twice</b>`, why: c => `doesn't have two ${c.l.toUpperCase()}s` },
    years:    { test: (v, c, ent) => !!ent.years && ent.years.some(([f, to]) => f <= c.b && to >= c.a),
                why: (c, ent) => ent.years ? `${(c.why || 'is from {y}').replace('{y}', fmtYears(ent.years))}, not between ${c.a} and ${c.b}` : `isn't one we have a date for` }
  };
  const fmtYears = ys => ys.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');

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
  // How often each special style comes up; the rest are plain topic questions.
  const LETTER_SHARE = { easy: 0.25, medium: 0.27, hard: 0.27 };
  const YEAR_SHARE = { easy: 0.08, medium: 0.18, hard: 0.3 };
  const YEAR_WIDTHS = { easy: [20, 30], medium: [10, 15, 20], hard: [5, 10] };
  const YEAR_MIN = { easy: 5, medium: 4, hard: 3 };
  const MIN_ANSWERS = { easy: 6, medium: 4, hard: 2 };
  // How often each topic level comes up in each mode.
  const LEVEL_WEIGHTS = { easy: [0, 1, 0.12, 0], medium: [0, 0.6, 1, 0.35], hard: [0, 0.3, 1, 1] };

  function weighted(pairs, rng) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = rng() * total;
    for (const p of pairs) { if ((r -= p[1]) <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }

  const passes = (v, rules, ent) => rules.every(c => RULES[c.type].test(v, c, ent));
  function answersFor(topic, rules) {
    const out = [];
    for (const ent of topic.entities) {
      const v = rules.length ? ent.variants.find(x => passes(x, rules, ent)) : ent.variants[0];
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
    // A topic can set `weight` to come up more or less often than others at its level.
    return weighted(fresh.map(t => [t, W[t.level] * (t.weight ?? 1)]), rng);
  }

  function letterQuestion(mode, seen, rng) {
    const min = MIN_ANSWERS[mode];
    // Letter questions need a big answer list, or a topic marked `letters` (like the DHHS ones).
    const big = t => t.entities.length >= 40 || (t.letters && t.entities.length >= 12);
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

  function yearQuestion(mode, seen, rng) {
    const dated = t => t.years && t.entities.filter(e => e.years).length >= 15;
    for (let attempt = 0; attempt < 200; attempt++) {
      const topic = pickTopic(mode, seen.yearTopics, rng, dated);
      const pool = topic.entities.filter(e => e.years && (mode !== 'easy' || e.tier <= 3));
      const ent = pool[Math.floor(rng() * pool.length)];
      const span = ent.years[Math.floor(rng() * ent.years.length)];
      const y = span[0] + Math.floor(rng() * (span[1] - span[0] + 1));
      const widths = YEAR_WIDTHS[mode];
      const w = widths[Math.floor(rng() * widths.length)];
      const step = w >= 10 ? 10 : 5;
      let a = Math.floor((y - Math.floor(rng() * w)) / step) * step;
      let b = a + w;
      if (b > 2026) { b = 2026; a = b - w; }
      const rules = [{ type: 'years', a, b, why: topic.yearWhy }];
      const sig = topic.id + '|' + a + '-' + b;
      if (seen.sigs.has(sig)) continue;
      const answers = answersFor(topic, rules);
      if (answers.length < YEAR_MIN[mode]) continue;
      if (mode !== 'hard' && !answers.some(x => x.ent.tier <= 3)) continue;
      seen.sigs.add(sig);
      seen.yearTopics.add(topic.id);
      const noun = topic.yearNoun || topic.noun;
      const when = topic.years.replace('{a}', `<b>${a}</b>`).replace('{b}', `<b>${b}</b>`);
      return finish(topic, rules, `Name ${articleFor(noun)} <b>${noun}</b> ${when}.`, sig);
    }
    return null;
  }

  /* Halloween (Haunted Flight only): a fixed pool of 150 questions from the Halloween topics. Each
     topic gives its plain question, and the bigger ones add "… that starts with B" questions for
     letters with plenty of answers, including some everyday ones. */
  const HALLOWEEN_SIZE = 150;
  const HALLOWEEN_POOL = (function () {
    const topics = ALL.filter(t => t.halloween);
    const pool = topics.map(t => ({ topic: t, rules: [] }));
    const extra = topics.map(t => {
      if (t.entities.length < 40) return [];
      const by = {};
      for (const e of t.entities) { const l = e.variants[0].letters[0]; if (l) (by[l] = by[l] || []).push(e); }
      return Object.keys(by)
        .map(l => ({ l, n: answersFor(t, [{ type: 'start', l }]).length, easy: answersFor(t, [{ type: 'start', l }]).filter(a => a.ent.tier <= 2).length }))
        .filter(x => x.n >= 5 && x.easy >= 2)
        .sort((a, b) => b.n - a.n || (a.l < b.l ? -1 : 1))
        .map(x => ({ topic: t, rules: [{ type: 'start', l: x.l }] }));
    });
    // take letter questions round-robin across topics so no one topic crowds the pool
    for (let i = 0; pool.length < HALLOWEEN_SIZE && extra.some(e => e.length > i); i++) {
      for (const e of extra) if (e[i] && pool.length < HALLOWEEN_SIZE) pool.push(e[i]);
    }
    return pool;
  })();
  function halloween(seen, rng = Math.random) {
    let open = HALLOWEEN_POOL.map((_, i) => i).filter(i => !seen.hw.has(i));
    if (!open.length) { seen.hw.clear(); open = HALLOWEEN_POOL.map((_, i) => i); }
    // never the same Halloween topic twice in a row
    const fresh = open.filter(i => HALLOWEEN_POOL[i].topic.id !== seen.hwLast);
    const pick = (fresh.length ? fresh : open)[Math.floor(rng() * (fresh.length ? fresh : open).length)];
    seen.hw.add(pick); seen.hwLast = HALLOWEEN_POOL[pick].topic.id;
    const { topic, rules } = HALLOWEEN_POOL[pick];
    const text = rules.length ? `Name ${articleFor(topic.noun)} <b>${topic.noun}</b> that ${RULES.start.text(rules[0])}.` : topic.html;
    remember(seen);
    return finish(topic, rules, text, 'hw|' + pick);
  }

  /* Remember what came up in recent games so a new game starts with fresh topics. */
  const SAVE_KEY = 'brainRocket.seen';
  function newRun() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (e) { saved = {}; }
    const set = k => new Set(Array.isArray(saved[k]) ? saved[k] : []);
    return { topics: set('topics'), letterTopics: set('letterTopics'), yearTopics: set('yearTopics'), sigs: set('sigs'), hw: set('hw') };
  }
  // A blank memory, for challenge codes: everyone must start from the same place.
  const freshRun = () => ({ topics: new Set(), letterTopics: new Set(), yearTopics: new Set(), sigs: new Set(), hw: new Set(), noSave: true });
  function remember(seen) {
    if (seen.noSave) return;   // a challenge game doesn't touch your own topic memory
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        topics: [...seen.topics], letterTopics: [...seen.letterTopics], yearTopics: [...seen.yearTopics],
        sigs: [...seen.sigs].slice(-400), hw: [...(seen.hw || [])]
      }));
    } catch (e) { /* storage blocked: only this game remembers */ }
  }

  function generate(mode, seen, rng = Math.random) {
    const r = rng();
    let q = null;
    if (r < YEAR_SHARE[mode]) q = yearQuestion(mode, seen, rng);
    else if (r < YEAR_SHARE[mode] + LETTER_SHARE[mode]) q = letterQuestion(mode, seen, rng);
    if (!q) {
      const topic = pickTopic(mode, seen.topics, rng);
      seen.topics.add(topic.id);
      q = finish(topic, [], topic.html, topic.id);
    }
    remember(seen);
    return q;
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

  function exact(topic, text) {
    const k = keyOf(text);
    if (topic.index.has(k)) return topic.index.get(k);
    // Plurals and singulars: "pancake" / "pancakes", "tomatoes", "berries".
    const tries = [k.replace(/es$/, ''), k.replace(/s$/, ''), k + 's', k + 'es', k.replace(/ies$/, 'y'), k.replace(/y$/, 'ies')];
    for (const t of tries) if (t !== k && topic.index.has(t)) {
      const hit = topic.index.get(t);
      // A recognized singular/plural is the player's answer, not a typo.
      // Preserve its letters: "shoe" must not be checked as "shoes".
      return { ent: hit.ent, v: { raw: text, norm: norm(text), key: k, letters: letters(text) } };
    }
    return null;
  }

  function find(topic, input) {
    const n = norm(input);
    let hit = exact(topic, n);
    if (hit) return { ...hit, fuzzy: false };
    // Drop words players often add ("beagle dog", "oak tree").
    if (topic.strip.length) {
      const words = n.split(' ').filter(w => !topic.strip.includes(w));
      if (words.length) {
        hit = exact(topic, words.join(' '));
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
    const failed = q.rules.find(c => !RULES[c.type].test(hit.v, c, hit.ent));
    if (failed) return { ok: false, reason: `${hit.v.raw} ${RULES[failed.type].why(failed, hit.ent)}.`, near: true };
    return { ok: true, ent: hit.ent, v: hit.v, fuzzy: hit.fuzzy };
  }

  /* One common answer for the reveal after a skip or timeout, so rare answers stay a secret. */
  function examples(q) {
    if (!q.answers.length) return [];
    const low = Math.min(...q.answers.map(a => a.ent.tier));
    const pool = q.answers.filter(a => a.ent.tier === low);
    const a = pool[Math.floor(Math.random() * pool.length)];
    return [{ text: a.v.raw, tier: a.ent.tier }];
  }

  return { TOPIC, TIER_POINTS, TIER_NAMES, generate, halloween, HALLOWEEN_POOL, check, examples, keyOf, newRun, freshRun };
})();
