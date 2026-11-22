#!/usr/bin/env python3
"""Build the Google Sites file: a small launcher whose button opens an about:blank tab and writes
the whole playback test into it (Google Sites shows embeds in a small iframe).

    python3 build-sites.py      (reads index.html, writes dist/youtube-playback-test-google-sites.html)

Paste the output into Google Sites with Insert -> Embed -> Embed code. The test itself is the
unchanged index.html, carried as a string.
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
test = (HERE / 'index.html').read_text(encoding='utf-8')
# A JS string inside a <script>: escape anything that could end or confuse the script block.
src = json.dumps(test, ensure_ascii=False)
src = re.sub(r'<(?=[/!sS])', r'\\u003c', src).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')

page = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>SirSC Scroll · YouTube Playback Test</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center; padding: 16px; box-sizing: border-box;
    background: #0a0c0f; color: #e9eef4; font: 500 14px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .card {
    width: min(460px, 100%); padding: 22px 22px 18px; border-radius: 16px; background: #101318;
    border: 1px solid rgb(255 255 255 / 0.08); display: grid; gap: 12px;
  }
  h1 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
  h1 span { color: #22d3ee; }
  p { margin: 0; color: #a9b3bf; }
  .tag { justify-self: start; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; background: rgb(251 191 36 / 0.15); color: #fcd34d; }
  button {
    height: 42px; padding: 0 18px; border-radius: 99px; border: 0; cursor: pointer;
    background: #22d3ee; color: #00141a; font: 800 14px system-ui, sans-serif;
  }
  button:hover { background: #4fe0f5; }
  button:focus-visible, a:focus-visible { outline: 2px solid #22d3ee; outline-offset: 2px; }
  .note { font-size: 13px; color: #c9d2dc; padding: 10px 12px; border-radius: 10px; background: #161a20; border: 1px solid rgb(255 255 255 / 0.1); }
  .note a { color: #22d3ee; font-weight: 700; cursor: pointer; text-decoration: underline; }
  .alt { justify-self: center; font-size: 12.5px; color: #a9b3bf; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
  .alt:hover { color: #e9eef4; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main class="card">
  <span class="tag">Experiment</span>
  <h1>SirSC Scroll · <span>YouTube playback test</span></h1>
  <p>Measures how quickly and reliably YouTube videos load and switch on this device. It opens in its own tab so the player has room and full screen works.</p>
  <button id="open" type="button">Open the test in a new tab</button>
  <a class="alt" id="inline" role="button" tabindex="0">or run it inside this page</a>
  <p class="note" id="note" role="status" aria-live="polite" hidden></p>
</main>
<script>
(function () {
  var SOURCE = ''' + src + ''';
  var note = document.getElementById('note');
  function say(html) { note.innerHTML = html; note.hidden = false; }
  function runHere() {
    // Fallback: replace this embed with the test itself.
    document.open();
    document.write(SOURCE);
    document.close();
  }
  function offerHere(prefix) {
    say(prefix + ' <a id="here" role="button" tabindex="0">Run it here instead</a>.');
    onActivate(document.getElementById('here'), runHere);
  }
  function onActivate(el, fn) {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }
  // Always offered, so the new tab and the embed can be compared on the same device.
  onActivate(document.getElementById('inline'), runHere);
  document.getElementById('open').addEventListener('click', function () {
    var w = null;
    try { w = window.open('about:blank', '_blank'); } catch (e) { w = null; }
    if (!w) return offerHere('The browser blocked the new tab. Allow pop-ups for this site and press the button again, or');
    try {
      w.document.open();
      w.document.write(SOURCE);
      w.document.close();
      try { w.focus(); } catch (e) { /* ignore */ }
      say('The test is open in a new tab. Reloading or closing that tab clears it, so come back here to open it again. Your video list and options are kept.');
    } catch (e) {
      try { w.close(); } catch (e2) { /* ignore */ }
      offerHere('This page couldn\\u2019t write the test into a new tab.');
    }
  });
})();
</script>
</body>
</html>
'''
out = HERE / 'dist' / 'youtube-playback-test-google-sites.html'
out.write_text(page, encoding='utf-8')
print(f'{out}: {len(page.encode()):,} bytes')
