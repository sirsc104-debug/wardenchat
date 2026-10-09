"""Builds the single-file Brain Rocket page for the old claude.ai artifact link, with a screen on top.

    python3 brain-rocket-artifact/build.py OUT_DIR [off|closeable|none]

  off        (default) "This link has been switched off": can't be closed, links to the new site and Warden Chat
  closeable  "Brain Rocket has a new home!": can be closed to keep playing "for a few more days"
  none       no screen: the plain game

Writes OUT_DIR/brain-rocket.html. The game itself (brain-rocket/) is unchanged and never shows these screens."""
import os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
game = os.path.join(here, '..', 'brain-rocket')
out, which = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'off')
screen = '' if which == 'none' else open(os.path.join(here, f'screen-{which}.html')).read()

rd = lambda p: open(os.path.join(game, p)).read()
html, css = rd('index.html'), rd('css/style.css')
body = html[html.index('<body>') + 6:html.index('<script src=')]
srcs = re.findall(r'<script src="([^"]+)"></script>', html)
for s in srcs: assert '</script' not in rd(s).lower()
js = ''.join(f'<script>\n{rd(s)}\n</script>\n' for s in srcs)
open(os.path.join(out, 'brain-rocket.html'), 'w').write(f'''<title>Brain Rocket</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap">
<style>
:root {{ color-scheme: dark; }}
{css}
</style>
{body.strip()}
{js}{screen}''')
print(f'{len(srcs)} scripts + ' + ('no screen' if which == 'none' else f'screen-{which}.html') + f' -> {out}/brain-rocket.html')
