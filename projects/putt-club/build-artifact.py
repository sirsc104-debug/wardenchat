#!/usr/bin/env python3
"""Bundle Putt Club into one self-contained page.

    python3 build-artifact.py OUT.html               (for publishing as a claude.ai Artifact)
    python3 build-artifact.py OUT.html --standalone  (a complete page to download and open anywhere)
    python3 build-artifact.py OUT.html --wallet-demo (with a pretend Warden Chat back end, js/wallet-mock.js)

The Artifact host wraps the page in its own <html>/<head>/<body>, so the default bundle leaves those
out: the <title>, the claude: meta tags, the Google Fonts link, the CSS inlined into <style>, the body's
markup, the three.js <script> tag from cdnjs, then every local script inlined in the order index.html loads them.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent


def main(out, standalone=False, demo=False):
    html = (HERE / 'index.html').read_text(encoding='utf-8')
    title = re.search(r'<title>.*?</title>', html, re.S).group(0)
    metas = ''.join(m.group(0) + '\n' for m in re.finditer(r'<meta name="claude:[^>]+>', html))
    fonts = ''.join(m.group(0) + '\n' for m in re.finditer(r'<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>', html))
    css = '\n'.join((HERE / href).read_text(encoding='utf-8')
                    for href in re.findall(r'<link rel="stylesheet" href="(css/[^"]+)">', html))
    body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    srcs = re.findall(r'<script src="([^"]+)"></script>', body)
    external = [s for s in srcs if s.startswith('http')]
    local = [s for s in srcs if not s.startswith('http')]
    if demo:
        local.insert(local.index('js/wallet.js') + 1, 'js/wallet-mock.js')
    body = re.sub(r'\s*<script src="[^"]+"></script>', '', body).strip()
    js = '\n'.join((HERE / src).read_text(encoding='utf-8') for src in local)
    if '</script' in js or '</style' in css:
        sys.exit('A closing tag inside the CSS or JS would end the inline block early.')
    ext = ''.join(f'<script src="{s}"></script>\n' for s in external)
    page = f'{title}\n{metas}{fonts}<style>\n{css}\n</style>\n{body}\n{ext}<script>\n{js}\n</script>\n'
    if standalone:
        page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                f'{title}\n{fonts}<style>\n{css}\n</style>\n</head>\n<body>\n{body}\n{ext}<script>\n{js}\n</script>\n</body>\n</html>\n')
    pathlib.Path(out).write_text(page, encoding='utf-8')
    print(f'{out}: {len(page.encode()):,} bytes, {len(local)} scripts inlined, {len(external)} loaded from a CDN')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a not in ('--standalone', '--wallet-demo')]
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], standalone='--standalone' in sys.argv, demo='--wallet-demo' in sys.argv)
