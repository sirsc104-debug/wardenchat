"""Builds js/answers.js, every category's answers and tiers, from Wikidata and Brain Rocket's lists.

    python3 tools/build_answers.py            # fetch what isn't cached, then build
    python3 tools/build_answers.py --report   # also print each category's tiers for checking

No AI is involved. For each category in categories.py:
  1. Answers come from its Wikidata sources (see wiki.py), plus Brain Rocket's hand-made list for the
     same topic when there is one (tools/cache/br-topics.json, from export_br.js), plus any `add`.
  2. Each answer's familiarity is how many Wikipedias (and sister sites) have a page on it, on a log
     scale, nudged by its Brain Rocket tier when it had one (Common answers there are well known).
  3. Answers are ranked by familiarity and split into tiers by rank: the best-known few are Launch
     Pad, the next fifth Orbiter, the next quarter Moonshot and the rest Deep Space.
  4. Hand-picked answers override that: `junk` (the famous "obscure" pick everyone reaches for) is
     Space Junk, and `gem` (one per category) is the Supernova. Without a gem, the best-known Deep
     Space answer is picked.
"""
import json, math, os, re, sys, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wiki
from categories import CATEGORIES

OUT = os.path.join(HERE, '..', 'js', 'answers.js')
BR = json.load(open(os.path.join(HERE, 'cache', 'br-topics.json')))
BR_NUDGE = {1: 2.2, 2: 1.0, 3: 0.3, 4: 0.0, 5: -0.3}


def norm(s):
    s = unicodedata.normalize('NFD', str(s).lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('&', ' and ').replace('+', ' plus ')
    s = re.sub(r"['’`.]", '', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    return re.sub(r'^(the|a|an) ', '', s)


key = lambda s: norm(s).replace(' ', '')
PAREN = re.compile(r'\s*\([^)]*\)\s*$')
BAD_ALIAS = re.compile(r'[:/|`$\\]|^Q\d+$|https?')


def shown(item, cat):
    """The name to show: the Wikipedia title without its "(dog)" or "(band)" or a trailing "dog"."""
    t = PAREN.sub('', item['title']).strip()
    words = t.split()
    # only a lower-case trailing word: "Dalmatian dog" -> "Dalmatian", but "Spanish Water Dog" stays
    while len(words) > 1 and words[-1] in cat.get('strip', []) and len(' '.join(words[:-1])) >= 3: words.pop()
    t = ' '.join(words)
    if cat.get('trim'):
        short = re.sub(cat['trim'], '', t)
        if len(short) >= 2: t = short
    return t


def clean_alias(a, cat):
    a = PAREN.sub('', a).strip()
    if len(key(a)) < (2 if cat.get('short') else 3) or BAD_ALIAS.search(a) or len(a) > 60: return None
    return a


def build(cat, report=False):
    # a category whose Wikidata sources couldn't be fetched falls back on Brain Rocket's whole list
    if cat.get('src') and not any(os.path.exists(wiki._path(s)) for s in cat['src']):
        cat = {**cat, 'src': [], 'br_match_only': False}
    items = {}
    for src in cat.get('src', []):
        for it in wiki.items(src):
            if it['id'] in items: continue
            if re.match(r'^(List|Lists|Index|Outline|Timeline|History) of ', it['title']): continue
            items[it['id']] = it
    drop = {key(x) for x in cat.get('drop', [])}
    drop_re = re.compile(cat['drop_re'], re.I) if cat.get('drop_re') else None
    ents = []
    for it in items.values():
        name = shown(it, cat)
        if key(name) in drop or key(it['title']) in drop or (drop_re and drop_re.search(it['title'])): continue
        if cat.get('min_links') and it['links'] < cat['min_links']: continue
        names = [name, PAREN.sub('', it['title']).strip(), it.get('label', '')] + it.get('aliases', [])
        # the short form too ("Spanish Water" for "Spanish Water Dog"), so it doesn't need the last word
        w = name.split()
        if len(w) > 1 and w[-1].lower() in cat.get('strip', []) and len(' '.join(w[:-1])) >= 4: names.append(' '.join(w[:-1]))
        names = [n for n in (clean_alias(x, cat) for x in names) if n]
        ents.append({'name': name, 'names': names, 'links': it['links'], 'br': None})
    # Brain Rocket's list for the same topic: its answers count too, and its tiers say what's well known.
    by_key = {}
    for e in ents:
        for n in e['names']: by_key.setdefault(key(n), e)
    lost = []
    for tid in cat.get('br', []):
        for a in BR[tid]['answers']:
            names = [a['name']] + a['alt']
            hit = next((by_key[key(n)] for n in names if key(n) in by_key), None)
            if not hit and cat.get('br_match_only') and a['tier'] <= 2: lost.append(a['name'])
            if hit:
                hit['br'] = min(hit['br'] or 9, a['tier'])
                for n in names:
                    if key(n) not in by_key: hit['names'].append(n); by_key[key(n)] = hit
            elif not cat.get('br_match_only') and not any(key(n) in drop for n in names):
                e = {'name': a['name'], 'names': names, 'links': 0, 'br': a['tier']}
                ents.append(e)
                for n in names: by_key.setdefault(key(n), e)
    # hand-added answers: 'Name/alias/alias@tier', the tier as in Brain Rocket's lists (1 = very common)
    for line in cat.get('add', []):
        line, _, t = line.partition('@')
        names = [n.strip() for n in line.split('/') if n.strip()]
        if any(key(n) in by_key for n in names): continue
        e = {'name': names[0], 'names': names, 'links': 0, 'br': int(t) if t else 4}
        ents.append(e)
        for n in names: by_key[key(n)] = e
    # nicknames and slang ("Soob" for Subaru): added to whichever answer has that name
    for target, nicks in cat.get('nick', {}).items():
        e = by_key.get(key(target))
        if not e: print(f"  !! {cat['id']}: no answer called {target} for its nicknames"); continue
        for n in nicks:
            if key(n) not in by_key: e['names'].append(n); by_key[key(n)] = e
    # merge entries that ended up with the same shown name (the same thing under two items)
    merged = {}
    for e in ents:
        k = key(e['name'])
        if k in merged:
            m = merged[k]; m['links'] = max(m['links'], e['links']); m['names'] += e['names']
            m['br'] = min(x for x in (m['br'], e['br'], 9) if x is not None) if (m['br'] or e['br']) else None
        else: merged[k] = e
    ents = list(merged.values())
    for e in ents:
        e['fam'] = math.log2(1 + e['links']) + (BR_NUDGE.get(e['br'], 0) if e['br'] else 0)
    # An answer only Brain Rocket's list has gets the typical familiarity of the matched answers that
    # share its Brain Rocket tier (so "England" for a country isn't treated as obscure). With no
    # Wikidata items at all, Brain Rocket's tiers are the only signal, so they set the tiers directly.
    has_wd = any(e['links'] for e in ents)
    by_tier = {}
    for e in ents:
        if e['links'] and e['br']: by_tier.setdefault(e['br'], []).append(e['fam'])
    for e in ents:
        if e['links'] or not e['br']: continue
        pool = by_tier.get(e['br']) or [f for t in sorted(by_tier) for f in by_tier[t] if t >= e['br']][:50]
        if pool: e['fam'] = sorted(pool)[len(pool) // 2] - 0.01
        elif not has_wd: e['fam'] = 10 - e['br'] * 2
    for e in ents: e['fam'] += cat.get('boost', {}).get(key(e['name']), 0)
    ents.sort(key=lambda e: (-e['fam'], e['name']))
    n = len(ents)
    pad = min(cat.get('pad_max', 14), max(3, math.ceil(n * cat.get('pad', 0.035))))
    orb = pad + math.ceil(n * 0.2)
    moon = orb + math.ceil(n * 0.25)
    for i, e in enumerate(ents):
        e['tier'] = 0 if i < pad else 2 if i < orb else 3 if i < moon else 4
    if not has_wd:
        for e in ents: e['tier'] = {1: 0, 2: 2, 3: 3}.get(e['br'], 4)
    junk = {key(x) for x in cat.get('junk', [])}
    gem_key = key(cat['gem']) if cat.get('gem') else None
    found_junk, gem = set(), None
    for e in ents:
        ks = {key(x) for x in e['names']}
        if ks & junk: e['tier'] = 1; found_junk |= ks & junk
        if gem_key and gem_key in ks: gem = e
    missing = junk - found_junk
    if gem_key and not gem: missing.add(cat['gem'])
    if not gem:
        gem = next((e for e in ents if e['tier'] == 4), ents[-1] if ents else None)
    if gem: gem['tier'] = 5
    if report:
        tiers = {t: [e['name'] for e in ents if e['tier'] == t] for t in range(6)}
        print(f"\n## {cat['id']}: {n} answers  pad {len(tiers[0])} junk {len(tiers[1])} orbit {len(tiers[2])} moon {len(tiers[3])} deep {len(tiers[4])}")
        print('  PAD:', ', '.join(tiers[0]))
        print('  JUNK:', ', '.join(tiers[1]), ' GEM:', gem and gem['name'])
        print('  ORBIT top:', ', '.join(tiers[2][:12]))
        print('  MOON top:', ', '.join(tiers[3][:8]))
        print('  DEEP sample:', ', '.join(tiers[4][:6]), '…', ', '.join(tiers[4][-4:]))
        if missing: print('  !! not found:', ', '.join(sorted(missing)))
        if lost: print('  !! well-known Brain Rocket answers left out:', ', '.join(lost[:25]))
    lines = []
    for e in sorted(ents, key=lambda e: -e['fam']):
        seen, names = set(), []
        for x in [e['name']] + e['names']:
            x = x.replace('|', ' ').replace('`', "'").replace('${', '$ {').strip()
            if x and key(x) not in seen: seen.add(key(x)); names.append(x)
        lines.append(f"{e['tier']}|" + '|'.join(names))
    return ents, lines


HEADER = ('/* Brain Rocket – Evolved answer lists. Built by tools/build_answers.py from Wikidata and Brain\n'
          ' * Rocket\'s lists; do not edit by hand. One answer per line: tier|shown name|alias|…\n'
          ' * Tiers: 0 Launch Pad, 1 Space Junk, 2 Orbiter, 3 Moonshot, 4 Deep Space, 5 Supernova. */\n')


def entry(c, lines):
    meta = {k: c[k] for k in ('id', 'name', 'icon', 'q', 'strip', 'level') if k in c}
    if c.get('noDaily'): meta['noDaily'] = True
    body = '\n'.join(lines)
    assert '`' not in body and '${' not in body and '</script' not in body.lower()
    return f"EVO.cat({{ ...{json.dumps(meta, ensure_ascii=False)}, list: `\n{body}\n` }});\n"


def main():
    report = '--report' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    cats = [c for c in CATEGORIES if not only or c['id'] in only]
    wiki.fetch([s for c in cats for s in c.get('src', [])])
    out = [HEADER]
    total = 0
    for c in cats:
        ents, lines = build(c, report)
        if len(ents) < c.get('min', 25):
            print(f"!! {c['id']} has only {len(ents)} answers; left out"); continue
        total += len(ents)
        out.append(entry(c, lines))
    if not only:
        open(OUT, 'w', encoding='utf-8').write(''.join(out))
        print(f'{len(out) - 1} categories, {total} answers, {os.path.getsize(OUT) // 1024} KB -> js/answers.js')


if __name__ == '__main__':
    main()
