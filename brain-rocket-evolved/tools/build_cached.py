"""Like build_answers.py, but only from what's already downloaded: categories (or sources) that
aren't cached yet are skipped instead of fetched. For previews while a long fetch is still running.

    python3 tools/build_cached.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_answers as B, wiki

out, total = [B.HEADER], 0
for c in B.CATEGORIES:
    srcs = [s for s in c.get('src', []) if os.path.exists(wiki._path(s))]
    if c.get('src') and not srcs: continue
    ents, lines = B.build({**c, 'src': srcs})
    if len(ents) < c.get('min', 25): continue
    total += len(ents)
    out.append(B.entry(c, lines))
open(B.OUT, 'w', encoding='utf-8').write(''.join(out))
print(f'{len(out) - 1} categories, {total} answers (cached only) -> js/answers.js')
