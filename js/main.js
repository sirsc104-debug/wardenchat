'use strict';
/* Claude Code Clicker: boot, main loop, autosave and global events. */

function start(snapshot) {
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

  on('achievement', a => {
    Panels.achDirty = true;
    Sound.ach();
    toast({ icon: iconParts(a.icon), kicker: 'Achievement unlocked', title: esc(a.name), text: a.desc, kind: 'mint' });
  });
  on('spawnEureka', force => FX.spawnEureka(force));
  on('spawnBug', () => FX.spawnBug());
  on('reset', () => {
    Spinner.pick();
    Workspace.sig = '';
    Panels.achDirty = true;
    Panels.syncOptions();
    UI.refreshSoundButton();
    UI.refreshStore(true);
    Panels.refresh(true);
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
  const loop = now => {
    const dt = Math.min(86400, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    FX.update(Math.min(dt, 0.25));
    const vdt = Math.min(dt, 0.1);
    Stage.frame(vdt);
    if (Panels.workspaceVisible()) Workspace.frame(vdt);
    UI.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  setInterval(save, 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
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
