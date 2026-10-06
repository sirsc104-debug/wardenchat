'use strict';
/* Claude Code Clicker: "New window". Opens the game in its own window and hands your save over to it.
   The new window may not share this page's storage (the artifact viewer runs the game in a frame), so the
   save travels in the link, and the new window sends its progress back here every few seconds. Meanwhile
   this window pauses, so the two never overwrite each other, and it picks up again when the other closes. */

const HANDOFF_HASH = '#ccc-save=';
const CHILD_FLAG = 'claude-code-clicker/child';
const SYNC_EVERY = 5000;

const Popout = {
  away: false, win: null, latest: null, child: false,
  // Called before the game starts: a save handed over in the link wins over anything stored here.
  takeHandoff() {
    if (!location.hash.startsWith(HANDOFF_HASH)) return null;
    let json = null;
    try { json = decodeURIComponent(escape(atob(decodeURIComponent(location.hash.slice(HANDOFF_HASH.length))))); } catch (e) { /* damaged link */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* not allowed here */ }
    try { sessionStorage.setItem(CHILD_FLAG, '1'); } catch (e) { /* storage blocked */ }
    return json;
  },
  init() {
    let flagged = false;
    try { flagged = sessionStorage.getItem(CHILD_FLAG) === '1'; } catch (e) { /* storage blocked */ }
    this.child = !!(window.opener && flagged);
    this.btn = $('#btnPopout');
    this.btn.hidden = this.child;
    this.btn.addEventListener('click', () => this.open());
    addEventListener('message', e => this.onMessage(e));
    if (this.child) {
      // Keep the original window's copy of the save up to date.
      setInterval(() => this.send('sync'), SYNC_EVERY);
      addEventListener('pagehide', () => this.send('closed'));
      setTimeout(() => this.send('sync'), 500);
    }
  },
  send(type) {
    try { if (window.opener && !window.opener.closed) window.opener.postMessage({ ccc: type, save: serialize() }, '*'); } catch (e) { /* the original is gone */ }
  },
  open() {
    if (this.away || BlackHole.running || Supernova.running) return;
    FullView.exit();
    save();
    const url = location.href.split('#')[0] + HANDOFF_HASH + encodeURIComponent(exportSave());
    let w = null;
    try { w = window.open(url, 'claude-code-clicker', 'popup=yes,width=1280,height=820'); } catch (e) { w = null; }
    if (!w) {
      toast({ icon: GLYPH.prompt, kicker: 'New window', title: 'The window was blocked', text: 'Your browser blocked the new window. Allow pop-ups for this page, then try again.', kind: 'bad', life: 7000 });
      return;
    }
    this.pause(w);
  },
  // This window steps aside while the other one plays.
  pause(w) {
    this.away = true;
    this.win = w;
    this.latest = null;
    Tip.hide();
    const ov = document.createElement('div');
    ov.className = 'popout-ov';
    ov.innerHTML =
      `<div class="popout-card" role="dialog" aria-labelledby="popTitle"><div class="popout-icon">${svgIcon(GLYPH.sparkle)}</div>` +
      `<h2 id="popTitle">Playing in a new window</h2>` +
      `<p>This window is paused so the two don't overwrite each other's progress. Your save is copied back here every few seconds, and the game picks up here when you close the other window.</p>` +
      `<div class="popout-actions"><button type="button" class="btn" id="popFocus">Show the window</button><button type="button" class="btn compact" id="popBack">Play here instead</button></div>` +
      `<p class="popout-sync" id="popSync">Waiting for the new window…</p></div>`;
    document.body.appendChild(ov);
    this.ov = ov;
    ov.querySelector('#popFocus').addEventListener('click', () => { try { this.win.focus(); } catch (e) { /* closed */ } });
    ov.querySelector('#popBack').addEventListener('click', () => this.bringBack());
    clearInterval(this.watch);
    this.watch = setInterval(() => { if (!this.win || this.win.closed) this.resume(); }, 1000);
  },
  // Ask the other window for its latest save, close it, and carry on here.
  bringBack() {
    try { this.win.postMessage({ ccc: 'return' }, '*'); } catch (e) { /* closed */ }
    setTimeout(() => { if (this.away) { try { this.win.close(); } catch (e) { /* not ours to close */ } this.resume(); } }, 1500);
  },
  resume() {
    if (!this.away) return;
    clearInterval(this.watch);
    const json = this.latest || readSave();
    this.away = false;
    this.win = null;
    if (json) { try { load(json, false); } catch (e) { console.warn('Could not load the save from the other window:', e); } }
    recompute();
    save();
    emit('reset');
    if (this.ov) { this.ov.remove(); this.ov = null; }
    toast({ icon: GLYPH.sparkle, kicker: 'Welcome back', title: 'Playing here again', text: 'Your progress from the other window came with you.', kind: 'mint' });
  },
  onMessage(e) {
    const d = e.data;
    if (!d || typeof d !== 'object' || typeof d.ccc !== 'string') return;
    if (this.child) {
      if (d.ccc === 'return' && e.source === window.opener) { this.send('closed'); setTimeout(() => window.close(), 50); }
      return;
    }
    if ((d.ccc !== 'sync' && d.ccc !== 'closed') || typeof d.save !== 'string' || e.source === window) return;
    // A window we opened is reporting in. If this page reloaded in the meantime, adopt it again.
    if (!this.away) this.pause(e.source);
    if (e.source !== this.win) return;
    this.latest = d.save;
    try { localStorage.setItem(SAVE_KEY, d.save); } catch (err) { /* storage blocked: the copy in memory still works */ }
    const s = $('#popSync');
    if (s) s.textContent = `Progress copied back at ${new Date().toLocaleTimeString()}.`;
    // A 'closed' report may just be a reload, so resuming is left to the check that the window really closed.
  },
};
