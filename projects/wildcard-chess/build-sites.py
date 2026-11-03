#!/usr/bin/env python3
"""Build the Google Sites file: a title-screen landing whose only button opens the game in an
about:blank tab (Google Sites shows embeds in a small iframe and blocks fullscreen).

    python3 build-sites.py            (reads dist/wildcard-chess.html, writes dist/wildcard-chess-google-sites.html)

The output is a tiny loader holding the full game page as a string. Once loaded it replaces itself
with that page in landing mode (window.WCC_LANDING, see js/landing.js); the button writes the same
string, without landing mode, into the new tab.
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
game = (HERE / 'dist' / 'wildcard-chess.html').read_text(encoding='utf-8')
# A JS string literal inside a <script>: escape anything that could end or confuse the script block.
src = json.dumps(game, ensure_ascii=False)
src = re.sub(r'<(?=[/!sS])', r'\\u003c', src).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Wildcard Chess</title>
<style>html,body{{margin:0;height:100%;background:#1b1916}}</style>
</head>
<body>
<script>
(function () {{
  window.WCC_SOURCE = {src};
  window.WCC_LANDING = true;
  // Runs once: document.open() keeps this window, so the guard (and no lingering listener) stops a loop.
  function swap() {{
    if (window.WCC_SWAPPED) return;
    window.WCC_SWAPPED = true;
    document.open(); document.write(window.WCC_SOURCE); document.close();
  }}
  if (document.readyState === 'complete') setTimeout(swap, 0);
  else window.addEventListener('load', function () {{ setTimeout(swap, 0); }}, {{ once: true }});
}})();
</script>
</body>
</html>
'''
out = HERE / 'dist' / 'wildcard-chess-google-sites.html'
out.write_text(page, encoding='utf-8')
print(f'{out}: {len(page.encode()):,} bytes')
