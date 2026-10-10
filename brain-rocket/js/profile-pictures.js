/* Warden pictures are read-only here. Signed URLs stay in memory and never enter progress. */
'use strict';
const ProfilePictures = (() => {
  const cache = new Map();
  let owner = Account.user && Account.user.id, epoch = 0, pending = null, timer;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = name => name.toLowerCase();
  const nodes = () => [...document.querySelectorAll('[data-br-avatar]')];
  function paint() {
    const boundary = epoch;
    for (const node of nodes()) {
      const name = node.dataset.brAvatar, hit = cache.get(key(name));
      const url = Account.status === 'signedIn' && hit && hit.url;
      const old = node.querySelector('img');
      if (!url) { if (old) old.remove(); continue; }
      if (old && old.src === url) continue;
      const img = document.createElement('img'); img.alt = ''; img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        if (boundary !== epoch || !node.isConnected || node.dataset.brAvatar !== name || cache.get(key(name))?.url !== url) return;
        node.querySelector('img')?.remove(); node.appendChild(img);
      };
      img.onerror = () => { if (boundary === epoch && cache.get(key(name))?.url === url) { cache.set(key(name), {url:null,until:Date.now()+45000}); node.querySelector('img')?.remove(); } };
      img.src = url;
    }
  }
  async function refresh(force = true) {
    if (force) cache.clear();
    if (Account.status !== 'signedIn' || document.hidden) { paint(); return; }
    if (pending) { await pending; return refresh(false); }
    const boundary = epoch;
    const names = [...new Set(nodes().map(n => n.dataset.brAvatar))].filter(n => !cache.has(key(n)) || cache.get(key(n)).until <= Date.now());
    if (!names.length) { paint(); return; }
    const task = (async () => {
      for (let i=0; i<names.length; i+=200) {
        const batch = names.slice(i,i+200);
        let pictures = [];
        try { pictures = await Account.pictureUrls(batch); } catch (_) { /* initials remain available offline */ }
        if (boundary !== epoch) return;
        for (const name of batch) cache.set(key(name), {url:null,until:Date.now()+45000});
        for (const p of pictures) {
          if (!batch.some(n => key(n) === key(p.username)) || typeof p.url !== 'string' ||
              !p.url.startsWith(Account.CONFIG.supabaseUrl+'/storage/v1/object/sign/avatars/') || p.expiresAt <= Date.now()+5000) continue;
          cache.set(key(p.username), {url:p.url,until:Math.min(p.expiresAt-5000,Date.now()+45000)});
        }
      }
      paint();
    })();
    pending = task;
    try { await task; } finally { if (pending === task) pending = null; }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => refresh(false), 50); }
  Account.on(() => {
    const next = Account.status === 'signedIn' && Account.user ? Account.user.id : null;
    if (next !== owner) { owner = next; epoch++; cache.clear(); paint(); }
    schedule();
  });
  new MutationObserver(schedule).observe(document.body, {childList:true,subtree:true});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', () => refresh());
  setInterval(() => refresh(), 45000);
  return {refresh,html: (name,cls='') => `<span class="acct-avatar${cls ? ' '+esc(cls) : ''}" data-br-avatar="${esc(name || '')}" aria-hidden="true">${esc(String(name || '?')[0].toUpperCase())}</span>`};
})();
