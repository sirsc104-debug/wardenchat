/* Google Sites landing.
 *
 * Google Sites shows embeds in a small iframe that blocks fullscreen. The Sites build
 * (build-sites.py) loads this page with window.WCC_LANDING set and the whole page's source in
 * window.WCC_SOURCE. The title screen then shows a single button that opens an about:blank tab
 * and writes the full game into it. In every other build this file does nothing. */
(function () {
  if (!window.WCC_LANDING || typeof window.WCC_SOURCE !== 'string') return;
  document.body.classList.add('landing');
  const btn = document.getElementById('openTabBtn'), note = document.getElementById('landingNote');
  btn.hidden = false;
  const say = html => { note.innerHTML = html; note.hidden = false; };
  btn.addEventListener('click', () => {
    let w = null;
    try { w = window.open('about:blank', '_blank'); } catch (e) { w = null; }
    if (!w) {
      say('Your browser blocked the new tab. Allow pop-ups for this page and try again, or <a id="playHere">play here instead</a>.');
      document.getElementById('playHere').addEventListener('click', () => {
        document.body.classList.remove('landing'); btn.hidden = true; note.hidden = true;
      });
      return;
    }
    try {
      w.document.open();
      w.document.write(window.WCC_SOURCE);
      w.document.close();
      try { w.focus(); } catch (e) { /* ignore */ }
      say('The game is open in a new tab. Closing or reloading that tab ends the game, so come back here to open it again.');
    } catch (e) {
      try { w.close(); } catch (e2) { /* ignore */ }
      say('This page couldn\u2019t open the game in a new tab. <a id="playHere">Play here instead</a>.');
      document.getElementById('playHere').addEventListener('click', () => {
        document.body.classList.remove('landing'); btn.hidden = true; note.hidden = true;
      });
    }
  });
})();
