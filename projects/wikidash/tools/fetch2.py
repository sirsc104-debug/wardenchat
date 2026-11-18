# usage: fetch2.py titles.txt outdir [workers]
# Saves the article body of https://en.wikipedia.org/wiki/<title> as gz, plus canonical title in index.tsv
import os, sys, time, gzip, re, urllib.parse, threading, queue
sys.path.insert(0, os.path.dirname(__file__))
from wiki import get, fname

titles = [l.strip() for l in open(sys.argv[1]) if l.strip()]
d = sys.argv[2]
workers = int(sys.argv[3]) if len(sys.argv) > 3 else 4
os.makedirs(d, exist_ok=True)
idx_path = os.path.join(d, "index.tsv")
done = {}
if os.path.exists(idx_path):
    for line in open(idx_path, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) == 2:
            done[p[0]] = p[1]
lock = threading.Lock()
q = queue.Queue()
for t in titles:
    if t not in done:
        q.put(t)
count = [0]
START = re.compile(r'<div class="mw-content-ltr mw-parser-output"[^>]*>')
END_MARKERS = ['<div class="printfooter"', '<div id="catlinks"', "<noscript><img"]


def work():
    while True:
        try:
            t = q.get_nowait()
        except queue.Empty:
            return
        url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(t.replace(" ", "_"), safe="():,'!*$&+;=@")
        try:
            html = get(url).decode("utf-8", "replace")
        except Exception as e:
            print("FAIL", t, e, flush=True)
            continue
        m = re.search(r'<link rel="canonical" href="https://en\.wikipedia\.org/wiki/([^"]+)"', html)
        canon = urllib.parse.unquote(m.group(1)).replace("_", " ") if m else t
        s = START.search(html)
        if not s:
            print("NOBODY", t, flush=True)
            continue
        body = html[s.start():]
        cut = len(body)
        for mk in END_MARKERS:
            i = body.find(mk)
            if 0 < i < cut:
                cut = i
        body = body[:cut]
        with gzip.open(os.path.join(d, fname(canon) + ".html.gz"), "wb") as fh:
            fh.write(body.encode())
        with lock:
            with open(idx_path, "a", encoding="utf-8") as f:
                f.write(f"{t}\t{canon}\n")
            count[0] += 1
            if count[0] % 100 == 0:
                print(count[0], "fetched", flush=True)
        time.sleep(0.05)


ths = [threading.Thread(target=work) for _ in range(workers)]
for th in ths:
    th.start()
for th in ths:
    th.join()
print("done", count[0], flush=True)
