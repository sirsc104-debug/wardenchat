#!/usr/bin/env python3
"""Bundle Kingdom Clash into one self-contained page.

    python3 build-artifact.py OUT.html               (for publishing as a claude.ai Artifact)
    python3 build-artifact.py OUT.html --standalone  (a complete page to download and open anywhere)

The Artifact host wraps the page in its own <html>/<head>/<body>, so the default bundle leaves those
out: the <title>, the Google Fonts link, the CSS inlined into <style>, the body's markup, then every
script inlined in the order index.html loads them. With --standalone it is a complete page instead.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent


def main(out, standalone=False):
    html = (HERE / 'index.html').read_text(encoding='utf-8')
    title = re.search(r'<title>.*?</title>', html, re.S).group(0)
    metas = ''.join(m.group(0) + '\n' for m in re.finditer(r'<meta name="claude:[^>]+>', html))
    fonts = ''.join(m.group(0) + '\n' for m in re.finditer(r'<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>', html))
    css = '\n'.join((HERE / href).read_text(encoding='utf-8')
                    for href in re.findall(r'<link rel="stylesheet" href="(css/[^"]+)">', html))
    body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    scripts = re.findall(r'<script src="([^"]+)"></script>', body)
    body = re.sub(r'\s*<script src="[^"]+"></script>', '', body).strip()
    js = '\n'.join((HERE / src).read_text(encoding='utf-8') for src in scripts)
    if '</script' in js or '</style' in css:
        sys.exit('A closing tag inside the CSS or JS would end the inline block early.')
    page = f'{title}\n{metas}{fonts}<style>\n{css}\n</style>\n{body}\n<script>\n{js}\n</script>\n'
    if standalone:
        page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                f'{title}\n{fonts}<style>\n{css}\n</style>\n</head>\n<body>\n{body}\n<script>\n{js}\n</script>\n</body>\n</html>\n')
    pathlib.Path(out).write_text(page, encoding='utf-8')
    print(f'{out}: {len(page.encode()):,} bytes, {len(scripts)} scripts inlined')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--standalone']
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], standalone='--standalone' in sys.argv)
