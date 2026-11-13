#!/usr/bin/env python3
"""Bundle Kingdom Clash into one self-contained page.

    python3 build-artifact.py OUT.html               (for publishing as a claude.ai Artifact)
    python3 build-artifact.py OUT.html --standalone  (a complete page to download and open anywhere)
    python3 build-artifact.py OUT.html --standalone --accounts-demo  (with a pretend Warden Chat back end)

The Artifact host wraps the page in its own <html>/<head>/<body>, so the default bundle leaves those
out: the <title>, the Google Fonts link, the CSS inlined into <style>, the body's markup, then every
script inlined in the order index.html loads them. With --standalone it is a complete page instead.
With --accounts-demo the pretend Warden Chat back end (js/account-mock.js) goes in right after
js/account.js, so sign-in, cloud saves, friends, invites and the SirSC wallet can be tried without the
real one (accounts: demo, pal and sam, password kingdom12345). Never publish a demo build.
"""
import base64
import importlib.util
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.dont_write_bytecode = True   # no __pycache__ left in the folder
# the rules version and the server's bundle come from build-server.py
_spec = importlib.util.spec_from_file_location('build_server', HERE / 'build-server.py')
build_server = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build_server)


def main(out, standalone=False, demo=False):
    html = (HERE / 'index.html').read_text(encoding='utf-8')
    title = re.search(r'<title>.*?</title>', html, re.S).group(0)
    metas = ''.join(m.group(0) + '\n' for m in re.finditer(r'<meta name="claude:[^>]+>', html))
    fonts = ''.join(m.group(0) + '\n' for m in re.finditer(r'<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>', html))
    css = '\n'.join((HERE / href).read_text(encoding='utf-8')
                    for href in re.findall(r'<link rel="stylesheet" href="(css/[^"]+)">', html))
    body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    scripts = re.findall(r'<script src="([^"]+)"></script>', body)
    if demo:
        scripts.insert(scripts.index('js/account.js') + 1, 'js/account-mock.js')
    body = re.sub(r'\s*<script src="[^"]+"></script>', '', body).strip()
    version = build_server.rules_version()
    def source(src):
        text = (HERE / src).read_text(encoding='utf-8')
        # the game says which battle rules it plays with (the server checks trophy battles with the same)
        return build_server.stamp(text, version) if src == 'js/progress.js' else text
    js = '\n'.join(source(src) for src in scripts)
    if demo:
        # the pretend back end checks trophy battles with the server's own bundle, as the real one will
        js += '\nconst KCServerCore = ' + build_server.core_source(version) + ';\n'
    # Images the scripts load (the scenery backgrounds) are baked in as data URIs.
    def inline(m):
        path = HERE / m.group(1)
        mime = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg'}[path.suffix]
        return f"'data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}'"
    js = re.sub(r"'(img/[A-Za-z0-9_-]+\.(?:webp|png|jpg))'", inline, js)
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
    args = [a for a in sys.argv[1:] if a not in ('--standalone', '--accounts-demo')]
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], standalone='--standalone' in sys.argv, demo='--accounts-demo' in sys.argv)
