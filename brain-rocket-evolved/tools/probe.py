"""Fetch candidate sources and show their size and best-known items:  python3 probe.py FILE
FILE has one 'name = source' per line."""
import sys, wiki
pairs = [tuple(x.strip() for x in l.split('=', 1)) for l in open(sys.argv[1]) if '=' in l and not l.startswith('#')]
wiki.fetch([s for _, s in pairs])
for name, src in pairs:
    it = sorted(wiki.items(src), key=lambda x: -x['links'])
    print(f"## {name} [{src}] {len(it)} | " + ', '.join(f"{x['title']}({x['links']})" for x in it[:12]) + ' … ' + ', '.join(x['title'] for x in it[-4:]), flush=True)
