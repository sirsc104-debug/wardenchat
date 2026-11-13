"""Builds Brain Rocket – Evolved as one self-contained HTML file (for an artifact link or Google Sites).

    python3 tools/build_page.py OUT_DIR [--google-sites] [--wallet-demo]

Writes OUT_DIR/brain-rocket-evolved.html: the page with css/style.css and every script inlined.
--google-sites writes a whole document (doctype, charset, viewport) for Google Sites' Embed code box,
as OUT_DIR/brain-rocket-evolved-google-sites.html. --wallet-demo adds js/wallet-mock.js, a pretend
Warden Chat and SirSC wallet in the browser, so signing in, coins and the shop can be tried before the
server has them (writes brain-rocket-evolved-wallet-demo.html)."""
import os, re, sys

here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
sites = '--google-sites' in sys.argv
demo = '--wallet-demo' in sys.argv
out = args[0]
rd = lambda p: open(os.path.join(here, p), encoding='utf-8').read()
html, css = rd('index.html'), rd('css/style.css')
body = html[html.index('<body>') + 6:html.index('<script src=')]
srcs = re.findall(r'<script src="([^"]+)"></script>', html)
if demo: srcs.insert(srcs.index('js/wallet.js') + 1, 'js/wallet-mock.js')
for s in srcs: assert '</script' not in rd(s).lower(), s
js = ''.join(f'<script>\n{rd(s)}\n</script>\n' for s in srcs)
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
links = ''.join(l + '\n' for l in re.findall(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts[^>]+>', head))
page = (f'<title>Brain Rocket – Evolved</title>\n{links}<style>\n:root {{ color-scheme: dark; }}\n{css}\n</style>\n'
        f'{body.strip()}\n{js}')
if sites:
    page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + page.replace('<style>', '</head>\n<body>\n<style>', 1) + '</body>\n</html>\n')
    # keep the title and font links in the head
    page = page.replace('</head>\n<body>\n<style>', '<style>', 1)
    page = page.replace('<style>\n:root', '</head>\n<body>\n<style>\n:root', 1)
name = 'brain-rocket-evolved-wallet-demo.html' if demo else 'brain-rocket-evolved-google-sites.html' if sites else 'brain-rocket-evolved.html'
open(os.path.join(out, name), 'w', encoding='utf-8').write(page)
print(f'{len(srcs)} scripts -> {out}/{name} ({os.path.getsize(os.path.join(out, name)) // 1024} KB)')
