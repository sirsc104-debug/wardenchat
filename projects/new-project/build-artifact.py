#!/usr/bin/env python3
"""Bundle Apples to Oranges into one page for publishing as a claude.ai Artifact.

    python3 build-artifact.py OUT.html

The Artifact host wraps the page in its own <html>/<head>/<body>, so the bundle leaves those
out: a <title>, the Google Fonts link, the CSS inlined into <style>, the body's markup, then
every script inlined in the order index.html loads them. The game itself is unchanged.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent


def main(out):
    html = (HERE / 'index.html').read_text(encoding='utf-8')
    title = re.search(r'<title>.*?</title>', html, re.S).group(0)
    fonts = ''.join(m.group(0) + '\n' for m in re.finditer(r'<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>', html))
    css = '\n'.join((HERE / href).read_text(encoding='utf-8')
                    for href in re.findall(r'<link rel="stylesheet" href="(css/[^"]+)">', html))
    body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    scripts = re.findall(r'<script src="([^"]+)"></script>', body)
    body = re.sub(r'\s*<script src="[^"]+"></script>', '', body).strip()
    js = '\n'.join((HERE / src).read_text(encoding='utf-8') for src in scripts)
    if '</script' in js or '</style' in css:
        sys.exit('A closing tag inside the CSS or JS would end the inline block early.')
    page = f'{title}\n{fonts}<style>\n{css}\n</style>\n{body}\n<script>\n{js}\n</script>\n'
    pathlib.Path(out).write_text(page, encoding='utf-8')
    print(f'{out}: {len(page.encode()):,} bytes, {len(scripts)} scripts inlined')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
