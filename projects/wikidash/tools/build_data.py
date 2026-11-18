# usage: build_data.py pagesdir outdir
# Cleans every crawled article, builds the link graph and writes data/index.json + data/a/<n>.gz
import gzip, hashlib, json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(__file__))
import clean as C

pages, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, "a"), exist_ok=True)

canon = {}
for line in open(os.path.join(pages, "index.tsv"), encoding="utf-8"):
    a, b = line.rstrip("\n").split("\t")
    canon[a] = b
titles = sorted(set(canon.values()), key=lambda t: t.lower())
idx = {t: i for i, t in enumerate(titles)}
lower = {t.lower(): i for i, t in enumerate(titles)}

ALIASES = {
    "Latin language": "Latin", "Arabic language": "Arabic", "Sanskrit language": "Sanskrit",
    "Second World War": "World War II", "First World War": "World War I", "WWII": "World War II",
    "WW2": "World War II", "WWI": "World War I", "Global warming": "Climate change", "Fungi": "Fungus",
    "Homo sapiens": "Human", "Humans": "Human", "Persia": "Iran", "Mediterranean": "Mediterranean Sea",
    "Earth's atmosphere": "Atmosphere of Earth", "Aztec": "Aztecs", "Roman Catholic Church": "Catholic Church",
    "Roman Catholic": "Catholic Church", "Hindu": "Hindus", "Muslim": "Muslims", "Buddhist": "Buddhism",
    "Mythology": "Myth", "USA": "United States", "U.S.": "United States", "US": "United States",
    "United States of America": "United States", "America": "United States", "UK": "United Kingdom",
    "U.K.": "United Kingdom", "USSR": "Soviet Union", "Soviet": "Soviet Union", "Bacterium": "Bacteria",
    "Deoxyribonucleic acid": "DNA", "The Sun": "Sun", "The Moon": "Moon", "Planet Earth": "Earth",
    "People's Republic of China": "China", "PRC": "China", "Republic of India": "India",
    "Jesus Christ": "Jesus", "Christ": "Jesus", "Prophet Muhammad": "Muhammad", "Mohammed": "Muhammad",
    "Einstein": "Albert Einstein", "Darwin": "Charles Darwin", "Shakespeare": "William Shakespeare",
    "Mozart": "Wolfgang Amadeus Mozart", "Beethoven": "Ludwig van Beethoven", "Picasso": "Pablo Picasso",
    "Van Gogh": "Vincent van Gogh", "Gandhi": "Mahatma Gandhi", "Napoleon Bonaparte": "Napoleon",
    "Lincoln": "Abraham Lincoln", "NYC": "New York City", "New York (city)": "New York City",
    "Ancient Egyptian": "Ancient Egypt", "Ancient Egyptians": "Ancient Egypt", "Egyptian": "Egypt",
    "Roman Empire (disambiguation)": "Roman Empire", "Romans": "Ancient Rome", "Ancient Romans": "Ancient Rome",
    "Ancient Greeks": "Ancient Greece", "Greeks": "Greeks", "World Wide Web": "World Wide Web",
    "Web": "World Wide Web", "Computers": "Computer", "Dinosaurs": "Dinosaur", "Volcanoes": "Volcano",
    "Planets": "Planet", "Stars": "Star", "Galaxies": "Galaxy", "Black holes": "Black hole",
    "Atoms": "Atom", "Molecules": "Molecule", "Cells (biology)": "Cell (biology)", "Cell": "Cell (biology)",
    "Proteins": "Protein", "Genes": "Gene", "Plants": "Plant", "Animals": "Animal", "Mammals": "Mammal",
    "Birds": "Bird", "Insects": "Insect", "Reptiles": "Reptile", "Amphibians": "Amphibian",
    "Trees": "Tree", "Flowers": "Flower", "Fruits": "Fruit", "Vegetables": "Vegetable", "Dogs": "Dog",
    "Cats": "Cat", "Horses": "Horse", "Elephants": "Elephant", "Sharks": "Shark", "Whales": "Whale",
    "Islamic": "Islam", "Christian": "Christianity", "Judaic": "Judaism", "Jewish": "Jews",
    "Electric": "Electricity", "Hurricane": "Tropical cyclone", "Hurricanes": "Tropical cyclone",
    "Light bulb": "Electric light", "Pirate": "Piracy", "Pirates": "Piracy", "RMS Titanic": "Titanic",
    "Football (soccer)": "Association football", "Soccer": "Association football",
    "Olympics": "Olympic Games", "Olympic games": "Olympic Games", "Movie": "Film", "Movies": "Film",
    "Cinema": "Film", "TV": "Television", "Internet (computer network)": "Internet",
    "Global Positioning System": "Global Positioning System", "Video games": "Video game",
}
aliases = {}
for a, b in canon.items():
    if a != b and b in idx:
        aliases[a] = idx[b]
for a, b in ALIASES.items():
    if b in idx and a not in idx:
        aliases[a] = idx[b]


def resolve(t, is_red):
    if t in idx:
        return idx[t]
    if t in aliases:
        return aliases[t]
    if not is_red:
        return None
    k = t.lower()
    for cand in (k[:-1] if k.endswith("s") else None, k + "s", k[:-9] if k.endswith(" language") else None,
                 k[:-6] if k.endswith(" (god)") else None):
        if cand and cand in lower:
            return lower[cand]
    return None


MAX_HTML = 100_000


def trim(html):
    """Very long articles keep the lead and their first sections, up to a size cap, then See also."""
    if len(html) <= MAX_HTML:
        return html
    parts = re.split(r"(?=<h2[ >])", html)
    keep = parts[0]
    see = ""
    for p in parts[1:]:
        if re.match(r'<h2[^>]*>\s*See also', p):
            see = p
            continue
        if len(keep) + len(p) <= MAX_HTML:
            keep += p
    return keep + see


arts = []
for i, t in enumerate(titles):
    h = gzip.open(os.path.join(pages, hashlib.md5(t.encode()).hexdigest() + ".html.gz")).read().decode()
    r = C.clean(h, resolve)
    html = trim(r["html"])
    body = []
    for m in re.finditer(r'<a i="(\d+)"', html):
        j = int(m.group(1))
        if j != i and j not in body:
            body.append(j)
    navs = []
    for nb in r["nav"]:
        g2 = [[g, [x for x in ids if x != i]] for g, ids in nb["g"]]
        g2 = [g for g in g2 if g[1]]
        if g2:
            navs.append({"t": nb["t"], "g": g2})
    nav_only = sorted({x for nb in navs for _, ids in nb["g"] for x in ids} - set(body) - {i})
    arts.append({"t": t, "d": r["desc"], "x": r["extract"], "h": html, "n": navs, "l": body, "v": nav_only})
    if i % 200 == 0:
        print(i, t, len(html), len(body), flush=True)

n = len(arts)
indeg = collections.Counter()
for a in arts:
    for j in a["l"]:
        indeg[j] += 1
pop = [indeg[i] for i in range(n)]

BAD = re.compile(r"^(List|Lists|Index|Outline|Glossary|Timeline) of |\((disambiguation|identifier)\)|^ISO \d|^\d", re.I)
good = [i for i, a in enumerate(arts) if not BAD.search(a["t"]) and len(a["l"]) >= 8 and pop[i] >= 3]

STARTS = re.findall(r'"([^"]+)"', re.search(r"const STARTS = \[(.*?)\];", open(sys.argv[3]).read(), re.S).group(1))
starts = []
for s in STARTS:
    j = idx.get(s, aliases.get(s))
    if j is not None and j in good and j not in starts:
        starts.append(j)

SHARD = 16
shard_of = [i // SHARD for i in range(n)]
total_raw = total_gz = 0
for k in range(0, n, SHARD):
    chunk = {str(i): {"h": arts[i]["h"], "n": arts[i]["n"], "x": arts[i]["x"]} for i in range(k, min(n, k + SHARD))}
    raw = json.dumps(chunk, ensure_ascii=False, separators=(",", ":")).encode()
    gz = gzip.compress(raw, 9, mtime=0)
    import base64
    open(os.path.join(out, "a", f"{k // SHARD}.txt"), "w").write(base64.b64encode(gz).decode())
    total_raw += len(raw)
    total_gz += len(gz)

index = {
    "ver": 1,
    "date": sys.argv[4] if len(sys.argv) > 4 else "",
    "t": [a["t"] for a in arts],
    "d": [a["d"] for a in arts],
    "l": [a["l"] for a in arts],
    "v": [a["v"] for a in arts],
    "pop": pop,
    "good": good,
    "starts": starts,
    "sh": shard_of,
    "al": {k.lower(): v for k, v in aliases.items()},
}
index["v"] = [a["v"] for a in arts]
raw = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
open(os.path.join(out, "index.json"), "w", encoding="utf-8").write(raw)
print("articles", n, "good", len(good), "starts", len(starts), "shards", (n + SHARD - 1) // SHARD)
print("bodies raw MB", round(total_raw / 1e6, 1), "gz MB", round(total_gz / 1e6, 1), "index KB", len(raw) // 1024)
ls = sorted(len(a["l"]) for a in arts)
print("links/page avg", round(sum(ls) / n, 1), "median", ls[n // 2], "lowest", ls[:8])
