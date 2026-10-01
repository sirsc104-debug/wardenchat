'use strict';
/* Claude Code Clicker: boot, main loop, autosave and global events. */

// If the page is swapped or duplicated underneath the running game (for example a live update
// arriving while it is open), save and reload once instead of drawing onto detached elements.
const HEAL_KEY = 'claude-code-clicker/healed-at';
let healing = false;
function heal(reason) {
  if (healing) return;
  let last = 0;
  try { last = +sessionStorage.getItem(HEAL_KEY) || 0; } catch (e) { /* storage blocked */ }
  if (Date.now() - last < 15000) { console.error('Page still inconsistent after a reload:', reason); return; }
  healing = true;
  console.warn('Reloading to repair the page:', reason);
  try { sessionStorage.setItem(HEAL_KEY, String(Date.now())); } catch (e) { /* storage blocked */ }
  save();
  location.reload();
}
function pageProblem(app) {
  if (!app.isConnected || document.querySelectorAll('#app').length !== 1) return 'app container replaced';
  if (!Stage.cv.isConnected || document.getElementById('stage') !== Stage.cv) return 'sparkle canvas replaced';
  if (!Workspace.cv.isConnected) return 'workspace canvas replaced';
  if (document.querySelectorAll('.term').length > 1 || document.querySelectorAll('#panel-terminal').length !== 1) return 'panels duplicated';
  return '';
}

let started = false;
function start(snapshot) {
  if (started) return heal('started twice');
  started = true;
  let offline = null;
  const tryLoad = (str, applyOffline) => {
    try { offline = load(str, applyOffline); return true; } catch (e) { console.warn('Save not loaded:', e); return false; }
  };
  if (!(snapshot && tryLoad(snapshot, false))) {
    const stored = readSave();
    if (stored) tryLoad(stored, true);
  }
  recompute();

  UI.init();
  Stage.init($('#stage'));
  Workspace.init($('#workspace'));
  Panels.init();
  Dev.init();

  on('achievement', a => {
    Panels.achDirty = true;
    Sound.ach();
    toast({ icon: iconParts(a.icon), kicker: 'Achievement unlocked', title: esc(a.name), text: a.desc, kind: 'mint' });
  });
  on('spawnEureka', force => FX.spawnEureka(force));
  on('spawnBug', golden => FX.spawnBug(golden));
  on('tokenRain', n => FX.tokenRain(n));
  on('eurekaChain', n => { FX.chain += n; });
  on('reset', () => {
    Spinner.pick();
    Workspace.sig = '';
    Panels.achDirty = true;
    Panels.syncOptions();
    UI.refreshSoundButton();
    UI.refreshStore(true);
    Panels.refresh(true);
    Dev.sync();
  });

  if (offline && offline.gain > 0) {
    toast({
      icon: GLYPH.clock, kicker: 'Welcome back', title: `+${fmt(offline.gain)} tokens`,
      text: `You were away for ${fmtTime(offline.away)}. Your workspace kept going at ${Math.round(D.offline * 100)}% speed.`, life: 9000,
    });
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && G.earned > 0) {
      grant('interrupt');
      Tip.hide();
    }
  });

  let last = performance.now();
  // One failing step must never stop the loop (that would freeze or blank the game).
  const step = (name, fn) => {
    try { fn(); } catch (e) {
      console.error(`${name} failed:`, e);
      if (name === 'stage') Stage.resize();
      if (name === 'workspace') Workspace.refresh();
    }
  };
  const loop = now => {
    requestAnimationFrame(loop);
    const dt = Math.min(86400, Math.max(0, (now - last) / 1000));
    last = now;
    const vdt = Math.min(dt, 0.1);
    step('update', () => update(dt));
    step('fx', () => FX.update(Math.min(dt, 0.25)));
    step('stage', () => Stage.frame(vdt));
    step('workspace', () => { if (Panels.workspaceVisible()) Workspace.frame(vdt); });
    step('ui', () => UI.frame(dt));
  };
  requestAnimationFrame(loop);

  setInterval(save, 30000);
  const app = document.getElementById('app');
  setInterval(() => { const why = pageProblem(app); if (why) heal(why); }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return save();
    // Coming back to the tab: redraw the cached images in case the browser discarded them.
    Stage.resize();
    Workspace.refresh();
  });
  window.addEventListener('pagehide', save);

  // Keep progress when the page is live-reloaded inside the artifact viewer.
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ save: serialize() })); } catch (e) { /* not in a live viewer */ }
}

(function boot() {
  const hot = window.claude && window.claude.hot;
  const go = data => start(data && data.save);
  if (hot && typeof hot.ready === 'function') {
    try { hot.ready(go); return; } catch (e) { /* fall through to a normal start */ }
  }
  go(hot && hot.data);
})();
