"""Cached access to Wikidata for the answer build.

A source is a SPARQL condition on ?item, written in short form:
  'P31=Q39367'                 ?item wdt:P31 wd:Q39367          (instance of dog breed)
  'P31/P279*=Q2095'            ?item wdt:P31/wdt:P279* wd:Q2095 (property paths work too)
  'P31=Q5 P39=Q11696'          several conditions that must all hold
  'is=Q10943'                  an instance or any subclass of cheese
  'species=Q7372'              any species under sharks ('genus=' for genera)
  '{ ... }'                    raw SPARQL, used as is
Each item comes back as {id, title, label, aliases, links}: its English Wikipedia title, English
label and aliases, and how many Wikimedia sites have a page on it (the main familiarity signal).
Only items with an English Wikipedia article are kept.

The query service only allows this connection about one request a minute, so sources are fetched
in batches (one query for several sources) and cached in tools/cache/wd/, and a rebuild makes no
requests at all.
"""
import hashlib, json, os, re, time, urllib.error, urllib.parse, urllib.request

UA = {'User-Agent': 'BrainRocketEvolved-databuild/0.2 (https://brainrocket.sirsc104.com)',
      'Accept': 'application/sparql-results+json'}
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache', 'wd')
os.makedirs(CACHE, exist_ok=True)
GAP = 62          # seconds between queries
_last = [0.0]


def _cond(source):
    if source.strip().startswith('{'): return source.strip()[1:-1]
    out = []
    for part in source.split():
        kind, _, val = part.partition('=')
        if kind == 'is':        # an instance or a subclass (food, dances and gems are mostly subclasses)
            out.append(f'{{ ?item wdt:P31/wdt:P279* wd:{val} . }} UNION {{ ?item wdt:P279+ wd:{val} . }}'); continue
        if kind in ('species', 'genus'):   # a taxon of that rank anywhere under the given group
            out.append(f'?item wdt:P171+ wd:{val} ; wdt:P105 wd:{"Q7432" if kind == "species" else "Q34740"} .'); continue
        prop, val = part.split('=', 1)
        path = '/'.join('wdt:' + p if not p.startswith('wdt:') else p for p in prop.split('/'))
        out.append(f'?item {path} wd:{val} .')
    return ' '.join(out)


def _path(source):
    return os.path.join(CACHE, hashlib.sha1(source.encode()).hexdigest()[:16] + '.json')


SIMPLE = re.compile(r'^(P\d+)=(Q\d+)$')
TAIL = """
  ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title .
  ?item wikibase:sitelinks ?links .
  OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label)='en') }
  OPTIONAL { ?item skos:altLabel ?alias FILTER(lang(?alias)='en') }
} GROUP BY ?src ?item ?title ?label ?links"""
HEAD = 'SELECT ?src ?item ?title ?label ?links (GROUP_CONCAT(DISTINCT ?alias; separator="\\u001f") AS ?aliases) WHERE {\n'


def _run(q):
    for attempt in range(4):
        wait = _last[0] + GAP - time.time()
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request('https://query.wikidata.org/sparql', data=urllib.parse.urlencode({'query': q}).encode(), headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)['results']['bindings']
        except urllib.error.HTTPError as e:
            body = e.read()[:300]
            if e.code in (429, 500, 502, 503, 504):
                print(f'  query service said {e.code}; waiting', flush=True)
                time.sleep(int(e.headers.get('Retry-After') or 0)); continue
            raise RuntimeError(f'{e.code} {body}')
        except (urllib.error.URLError, TimeoutError) as e:
            print(f'  network: {e}; retrying', flush=True)
    raise RuntimeError('gave up')


def _split(rows, n):
    got = [[] for _ in range(n)]
    for b in rows:
        got[int(b['src']['value'])].append({
            'id': b['item']['value'].rsplit('/', 1)[1], 'title': b['title']['value'],
            'label': b.get('label', b['title'])['value'],
            'aliases': [a for a in b.get('aliases', {}).get('value', '').split('\u001f') if a],
            'links': int(b['links']['value'])})
    return got


def _save(source, items):
    json.dump({'source': source, 'items': items}, open(_path(source), 'w'))


BIG = re.compile(r'^\{ \?item wdt:(P\d+) wd:(Q\d+) \.((?: \?item wdt:P\d+ wd:Q\d+ \.)*) \?item wikibase:sitelinks \?n \. FILTER\(\?n >= (\d+)\) \}$')


def _shape(s):
    """Sources that differ only in one value share a shape and go in one VALUES query:
    'P39=Q11696 P31=Q5' and 'P39=Q19546 P31=Q5' -> ('P39', ' ?item wdt:P31 wd:Q5 .', value, floor)."""
    toks = s.split()
    if toks and all(SIMPLE.match(t) for t in toks):
        p, v = SIMPLE.match(toks[0]).groups()
        rest = ''.join(' ?item wdt:%s wd:%s .' % SIMPLE.match(t).groups() for t in toks[1:])
        return (p, rest, False), v, 0
    m = BIG.match(s.strip())
    if m: return (m.group(1), m.group(3), True), m.group(2), int(m.group(4))
    return None, None, None


def fetch(sources, batch=12):
    """Fetch every source that isn't cached yet, grouping sources of the same shape in one query."""
    todo = [s for s in dict.fromkeys(sources) if not os.path.exists(_path(s))]
    groups, singles = {}, []
    for s in todo:
        shape, _, _ = _shape(s)
        if shape: groups.setdefault(shape, []).append(s)
        else: singles.append(s)
    jobs = []
    for shape, g in groups.items():
        n = 3 if shape[2] else batch
        jobs += [(shape, g[i:i + n]) for i in range(0, len(g), n)]
    jobs += [(None, [s]) for s in singles]
    for k, (shape, part) in enumerate(jobs, 1):
        print(f'query {k}/{len(jobs)}: {", ".join(part)[:110]}', flush=True)
        if shape:
            rows = []
            for i, src in enumerate(part):
                _, v, floor = _shape(src)
                rows.append(f'({i} wd:{v} {floor})')
            q = HEAD + f'  VALUES (?src ?val ?min) {{ {" ".join(rows)} }} ?item wdt:{shape[0]} ?val .{shape[1]}' + TAIL
            q = q.replace('  ?item wikibase:sitelinks ?links .', '  ?item wikibase:sitelinks ?links . FILTER(?links >= ?min)')
        else:
            q = HEAD + f'  {_cond(part[0])} BIND(0 AS ?src)' + TAIL
        try:
            res = _split(_run(q), len(part))
        except RuntimeError as e:
            if len(part) > 1:
                print(f'  FAILED ({e}); one at a time', flush=True)
                for src in part: fetch([src], batch=1)
            else: print(f'  FAILED: {e}', flush=True)
            continue
        for src, items in zip(part, res): _save(src, items)


def items(source):
    path = _path(source)
    if not os.path.exists(path): fetch([source])
    return json.load(open(path))['items'] if os.path.exists(path) else []
