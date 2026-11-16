/* Putt Club: the account chip, signing in, the Shop (balls, trails, hole-outs, flags, scenery,
   avatars, membership, diamonds) and the coins shown after a round. Everything about money goes
   through Wallet (wallet.js); the server decides it. The shop shows a live practice green behind its
   panel (PC.game.showcase), where the ball keeps putting in wearing whatever you preview. */
'use strict';

const Shop = (() => {
  const q = s => document.querySelector(s);
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let tab = 'ball', confirmKey = '', open = false, previewItem = null;

  const ERRORS = {
    bad_credentials: 'That username and password don’t match a Warden Chat account.',
    username_taken: 'That username is taken on Warden Chat. Try another.',
    weak_password: 'Warden Chat needs a longer password: at least 10 characters.',
    signup_rejected: 'Warden Chat didn’t accept that username. Use 3 to 24 letters, numbers, dots, dashes or underscores.',
    confirm_enabled: 'Warden Chat isn’t taking new accounts right now.',
    rate_limited: 'Too many tries. Wait a minute and try again.',
    offline: 'Can’t reach Warden Chat. Check your connection and try again.',
    sirsc_not_enough: 'Not enough in your wallet for that.',
    sirsc_owned: 'You already own that.',
    sirsc_member_only: 'That one is for SirSC Members.',
    sirsc_wrong_currency: 'That can’t be bought with that currency.',
    sirsc_too_many_requests: 'You already have 3 requests waiting for SirSC.',
    sirsc_bad_request: 'Diamonds come in fives, from 5 to 500.',
  };
  const errText = e => ERRORS[e && e.code] || 'Something went wrong. Try again in a moment.';
  const available = () => Account.status !== 'unavailable' && Account.status !== 'checking';
  const badge = () => (Wallet.member ? SIRSC_BADGE_SVG : '');
  const toast = (big, small, tone) => PC.game && PC.game.toast(big, small, tone);
  const sfx = n => PC.game && PC.game.sfx(n);

  /* ---------- the account pills in the menu's top-left corner ---------- */
  let popOpen = false;
  function renderChip() {
    const chip = q('#acctChip');
    if (!chip) return;
    chip.hidden = !available();
    if (Account.status !== 'signedIn') popOpen = false;
    if (Account.status === 'signedIn') {
      const name = esc(Account.user.username), m = Wallet.me;
      chip.innerHTML = `<button type="button" class="pill acct-name" data-shop="acct" aria-expanded="${popOpen}"><span class="acct-av">${avatarIcon(Look.worn().avatar)}</span><span>${name}</span><i class="acct-dot" title="Signed in"></i>${window.PUTT_DEMO ? '<span class="acct-demo">Demo</span>' : ''}</button>` +
        `<button type="button" class="pill acct-num" data-shop="open" title="Coins: win them in rounds against the rivals">🪙 <b>${m ? fmt(Wallet.coins) : '…'}</b></button>` +
        `<button type="button" class="pill acct-num" data-shop="diamonds" title="Diamonds">💎 <b>${m ? fmt(Wallet.diamonds) : '…'}</b></button>` +
        (Wallet.member ? `<button type="button" class="pill acct-member" data-shop="member" title="SirSC Member">${SIRSC_BADGE_SVG}<span>Member</span></button>` : '') +
        `<div class="acct-pop" ${popOpen ? '' : 'hidden'}><p>Signed in to Warden Chat as <b>${name}</b>${Wallet.member ? ` ${SIRSC_BADGE_SVG}` : ''}</p>${window.PUTT_DEMO ? '<p class="small">Demo build: a pretend wallet kept in this browser.</p>' : ''}<button type="button" class="btn small" data-shop="signout">Sign out</button></div>`;
    } else if (Account.status === 'restricted') {
      chip.innerHTML = '<span class="pill acct-banned">Account restricted on Warden Chat</span>';
    } else chip.innerHTML = '<button type="button" class="pill" data-shop="signin">👤 <span>Sign in</span></button>';
  }

  /* ---------- signing in ---------- */
  function openSignIn() {
    q('#siErr').textContent = '';
    if (window.PUTT_DEMO) q('#siWhy').textContent = 'Demo build: any username and a password of 10 or more characters work, and every new account starts with 🪙 40,000 and 💎 10 to try the Shop. Nothing here touches a real Warden Chat account.';
    q('#signin').hidden = false;
    setTimeout(() => q('#siUser').focus(), 30);
  }
  function closeSignIn() { q('#signin').hidden = true; }
  function submit(create) {
    const user = q('#siUser').value.trim(), pass = q('#siPass').value, R = Account.RULES;
    if (user.length < R.nameMin || user.length > R.nameMax || !R.nameRe.test(user)) { q('#siErr').textContent = ERRORS.signup_rejected; return; }
    if (create && pass.length < R.passwordMin) { q('#siErr').textContent = ERRORS.weak_password; return; }
    q('#siErr').textContent = create ? 'Creating your account…' : 'Signing in…';
    (create ? Account.signUp(user, pass) : Account.signIn(user, pass)).then(() => {
      q('#siPass').value = '';
      closeSignIn();
      toast('Signed in', `Welcome, ${user}`, 'good');
    }, e => { q('#siErr').textContent = errText(e); });
  }

  /* ---------- swatches ---------- */
  const SKY = { standard: ['#4f9fe0', '#eef8ff'], sunset: ['#2f3f8f', '#ffd08a'], blossom: ['#7ab8ec', '#ffe0ee'], night: ['#03061a', '#26386e'], aurora: ['#020a16', '#1a4a5a'], fireworks: ['#03061a', '#26386e'], harvest: ['#1a1440', '#ff9a4a'] };
  const SCENE_ICON = { standard: '⛳', sunset: '🌅', blossom: '🌸', night: '🌙', aurora: '🌌', fireworks: '🎆', harvest: '🎃' };
  const SINK_ICON = { confetti: '🎊', balloons: '🎈', bubbles: '🫧', fireworks: '🎆', snow: '❄️', lightning: '⚡', goldrush: '🪙' };
  const TRAIL_COLS = { plain: ['#ffffff', '#e8eef0'], sparkle: ['#ffe27a', '#ffffff'], bubbles: ['#bfe8ff', '#e8f8ff'], petals: ['#ffb3c6', '#ffffff'], rainbow: ['#ff4d4d', '#38bdf8'], fire: ['#ff7a1a', '#ffd25a'], stardust: ['#c4b5fd', '#93c5fd'], diamond: ['#7fd8ff', '#e9fbff'] };
  function swatch(item) {
    const c = cosmeticOf(item);
    if (c.kind === 'ball') return `<canvas class="sw-ball" data-ball="${c.id}" width="192" height="192"></canvas>`;
    if (c.kind === 'flag') return `<canvas class="sw-flag" data-flag="${c.id}" width="128" height="96"></canvas>`;
    if (c.kind === 'scene') return `<div class="sw-scene" style="--a:${SKY[c.id][0]};--b:${SKY[c.id][1]}"><span>${SCENE_ICON[c.id]}</span></div>`;
    if (c.kind === 'sink') return `<div class="sw-icon">${SINK_ICON[c.id]}</div>`;
    if (c.kind === 'avatar') return `<div class="sw-avatar">${c.icon}</div>`;
    const tc = TRAIL_COLS[c.id];
    return `<div class="sw-trail" style="--a:${tc[0]};--b:${tc[1]}"><i></i><i></i><i></i><i></i><i></i><b></b></div>`;
  }
  function paintSwatches(root) {
    for (const cv of root.querySelectorAll('canvas.sw-ball')) {
      const g = cv.getContext('2d'), id = cv.dataset.ball, def = COSMETICS.ball[id];
      const pv = PC.ballPreview && PC.ballPreview(id);
      if (pv) { g.clearRect(0, 0, 192, 192); g.drawImage(pv, 0, 0); continue; }
      // No WebGL for the picture: a flat drawing instead.
      g.setTransform(2, 0, 0, 2, 0, 0);
      const img = PC.ballSwatch ? PC.ballSwatch(id) : null;
      g.clearRect(0, 0, 96, 96); g.save(); g.beginPath(); g.arc(48, 48, 40, 0, Math.PI * 2); g.clip();
      if (img) g.drawImage(img, -30, 8, 192, 80); else { g.fillStyle = def.color || '#fbfbf7'; g.fillRect(0, 0, 96, 96); }
      const sh = g.createRadialGradient(34, 32, 4, 48, 48, 44); sh.addColorStop(0, 'rgba(255,255,255,0.75)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = sh; g.fillRect(0, 0, 96, 96); g.restore();
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    for (const cv of root.querySelectorAll('canvas.sw-flag')) {
      const g = cv.getContext('2d'), t = PC.TEX.flagStyled(7, '#e2463b', cv.dataset.flag);
      g.clearRect(0, 0, 128, 96); g.fillStyle = '#e6e6e0'; g.fillRect(18, 6, 5, 88);
      if (t && t.image) g.drawImage(t.image, 23, 8, 96, 60);
    }
  }

  /* ---------- the shop screen ---------- */
  function items(kind) { return [kind + ':' + DEFAULT_LOOK[kind]].concat(PUTT_CATALOG.filter(c => c.item_id.startsWith(kind + ':')).map(c => c.item_id)); }
  function buyHTML(item) {
    const c = cosmeticOf(item), price = Wallet.price(item), isFree = c.id === DEFAULT_LOOK[c.kind];
    if (isFree || Wallet.owns(item)) {
      const on = Look.worn()[c.kind] === c.id;
      return `<span class="own">${isFree ? 'Free' : 'Owned'}</span>` + (on ? '<span class="equipped">Equipped</span>' : `<button type="button" class="btn small" data-equip="${item}">Equip</button>`);
    }
    if (price && price.member_only) {
      const when = price.claim_from ? `Members, ${new Date(price.claim_from).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}` : 'Every member';
      return `<span class="member-only">👑 ${when}</span>`;
    }
    const b = [];
    for (const cur of ['coins', 'diamonds']) {
      if (!price || !price[cur]) continue;
      const key = item + '|' + cur, label = cur === 'coins' ? `🪙 ${fmt(price.coins)}` : `💎 ${price.diamonds}`;
      b.push(`<button type="button" class="btn small ${confirmKey === key ? 'primary' : ''}" data-buy="${key}">${confirmKey === key ? 'Buy for ' + label + '?' : label}</button>`);
    }
    return b.join('');
  }
  function renderWalletBar() {
    const w = q('#shopWallet');
    if (!available()) { w.innerHTML = '<span class="sw-note">The shop opens when Warden Chat accounts are switched on for Putt Club. You can still look around and preview.</span>'; return; }
    if (Account.status !== 'signedIn') { w.innerHTML = '<button type="button" class="btn small primary" data-shop="signin">Sign in to buy</button>'; return; }
    w.innerHTML = (window.PUTT_DEMO ? '<span class="pill demo" title="This build uses a pretend wallet stored in your browser. Nothing touches a real Warden Chat account.">Demo wallet</span>' : '') +
      `<span class="pill">🪙 <b>${fmt(Wallet.coins)}</b></span><span class="pill">💎 <b>${fmt(Wallet.diamonds)}</b></span>
      <span class="pill who">${avatarIcon(Look.worn().avatar)} ${esc(Account.user.username)}${badge()}</span><button type="button" class="btn small ghost" data-shop="signout">Sign out</button>`;
  }
  function featured() {
    const week = Math.floor((Date.now() / 864e5 + 3) / 7);
    const pool = PUTT_CATALOG.filter(c => !c.member_only).map(c => c.item_id);
    const rnd = PC.U.rng(week * 9301 + 49297), out = [], kinds = new Set();
    while (out.length < 4 && pool.length) {
      const i = Math.floor(rnd() * pool.length), id = pool.splice(i, 1)[0], k = id.split(':')[0];
      if (kinds.has(k) && pool.some(x => !kinds.has(x.split(':')[0]))) continue;
      kinds.add(k); out.push(id);
    }
    return out;
  }
  const card = (item, feat) => {
    const c = cosmeticOf(item);
    return `<div class="item ${feat ? 'feat' : ''} ${previewItem === item ? 'pv' : ''}" data-preview="${item}" tabindex="0" role="button" aria-label="Preview ${esc(c.name)}">
      <div class="item-art">${swatch(item)}</div>
      <div class="item-txt">${feat ? `<div class="item-kind">${KIND_NAMES[c.kind]}</div>` : ''}<div class="item-name">${esc(c.name)}</div>${feat ? '' : `<div class="item-desc">${esc(c.desc)}</div>`}</div>
      <div class="item-buy">${buyHTML(item)}</div></div>`;
  };
  function renderGrid() {
    const box = q('#shopFeatured');
    const until = new Date((Math.floor((Date.now() / 864e5 + 3) / 7) * 7 + 4) * 864e5);
    box.innerHTML = `<div class="feat-head"><h3>Featured this week</h3><span>New picks ${until.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span></div><div class="feat-row">${featured().map(i => card(i, true)).join('')}</div>`;
    for (const b of document.querySelectorAll('.shop-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    const g = q('#shopGrid');
    if (tab === 'member') g.innerHTML = memberHTML();
    else if (tab === 'diamonds') g.innerHTML = diamondsHTML();
    else g.innerHTML = items(tab).map(i => card(i)).join('');
    paintSwatches(q('#shopPanel'));
    const cap = q('#shopPvCap');
    if (cap) cap.textContent = previewItem ? `Previewing: ${cosmeticOf(previewItem).name}` : 'Pick anything to try it on the green.';
  }
  function memberHTML() {
    const until = Wallet.memberUntil ? new Date(Wallet.memberUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
    const month = PUTT_CATALOG.filter(c => c.member_only && c.claim_from && Date.parse(c.claim_from) <= Date.now() && Date.now() < Date.parse(c.claim_until));
    return `<div class="member-card">
      <div class="mc-head">${SIRSC_BADGE_SVG}<div><h3>SirSC Membership</h3><p>${Wallet.member ? `You're a member until ${until}.` : '$3 a month, paid to SirSC. It works across all of SirSC’s games.'}</p></div></div>
      <ul class="mc-perks">
        <li><b>1.5× coins</b> from every round</li>
        <li><b>5 💎 every month</b>, added the first time you play that month</li>
        <li><b>The SirSC Diamond</b> by your name, on the menu and online</li>
        <li><b>This month's members' scenery</b>, yours forever: ${month.map(c => esc(cosmeticOf(c.item_id).name)).join(', ') || 'coming soon'}</li>
        <li><b>The SirSC Diamond ball</b>, <b>Diamond Dust</b> trail, <b>SirSC Standard</b> flag and <b>SirSC Royalty</b> avatar while you're a member</li>
      </ul>
      ${Wallet.member ? '' : '<p class="mc-how">To join, pay SirSC $3 for each month and ask them to add it to your Warden Chat account.</p>'}
      ${window.PUTT_DEMO && Account.status === 'signedIn' && !Wallet.member ? '<button type="button" class="btn small primary" data-shop="demo-member">Demo: try a month of membership</button>' : ''}
    </div>`;
  }
  function diamondsHTML() {
    const reqs = (Wallet.me && Wallet.me.requests) || [];
    return `<div class="member-card">
      <div class="mc-head"><div class="dia-big">💎</div><div><h3>Diamonds</h3><p>5 💎 for $1, paid to SirSC in person. Then send a request here and SirSC adds them to your wallet. 1 💎 is worth 5,000 coins.</p></div></div>
      ${Account.status === 'signedIn' ? `<form class="dia-form" id="diaForm">
        <label>Diamonds <select id="diaN">${[5, 10, 25, 50, 100, 250, 500].map(n => `<option value="${n}">${n} 💎 ($${n / 5})</option>`).join('')}</select></label>
        <label>Note for SirSC <input id="diaNote" maxlength="200" placeholder="e.g. paid at lunch on Tuesday"></label>
        <button class="btn small primary" type="submit">I've paid: request them</button></form>
      <div class="dia-reqs">${reqs.length ? reqs.map(r => `<div class="dia-req"><span>${r.diamonds} 💎</span><span class="st ${r.status}">${r.status}</span>${r.status === 'pending' ? `<button type="button" class="btn small ghost" data-cancel="${r.id}">Cancel</button>` : ''}</div>`).join('') : '<p class="sw-note">No requests yet.</p>'}</div>`
        : (available() ? '<button type="button" class="btn small primary" data-shop="signin">Sign in to request diamonds</button>' : '<p class="sw-note">Diamonds open when Warden Chat accounts are switched on for Putt Club.</p>')}
    </div>`;
  }
  function setPreview(item) {
    previewItem = item;
    const c = cosmeticOf(item);
    Look.preview(c.kind, c.id);
    if (PC.game) PC.game.showcasePutt();
    renderGrid();
  }
  function show(startTab) {
    open = true; previewItem = null; confirmKey = '';
    if (startTab) tab = startTab;
    Look.preview(null);
    q('#shop').hidden = false;
    if (PC.game) PC.game.showcase(true);
    renderWalletBar(); renderGrid();
    if (Account.status === 'signedIn') Wallet.load();
  }
  function hide() {
    open = false; previewItem = null;
    Look.preview(null);
    q('#shop').hidden = true;
    if (PC.game) PC.game.showcase(false);
  }
  function buy(key) {
    const [item, cur] = key.split('|');
    if (!available()) { toast('Not yet', 'The shop opens when Warden Chat accounts are switched on for Putt Club.', 'bad'); return; }
    if (Account.status !== 'signedIn') { openSignIn(); return; }
    if (confirmKey !== key) { confirmKey = key; renderGrid(); return; }
    confirmKey = '';
    Wallet.buy(item, cur).then(() => {
      sfx('ace');
      const c = cosmeticOf(item);
      Look.choose(c.kind, c.id);
      toast(`${c.name} is yours`, 'Bought and equipped', 'good');
      renderWalletBar(); renderGrid();
    }, e => { toast('Not bought', errText(e), 'bad'); renderGrid(); });
  }

  /* ---------- coins after a round ---------- */
  const BASE = { owen: 400, medium: 800, hard: 1500, ultra: 3000 }, PLACE = [1, 0.6, 0.4, 0.25];
  function reward(r) {
    const box = q('#rewardBox');
    if (!box) return;
    box.hidden = false;
    if (!available()) { box.hidden = true; return; }
    if (r.online) { box.innerHTML = '<p class="rw-note">Online rounds don’t earn coins yet.</p>'; return; }
    if (Account.status !== 'signedIn') {
      const est = Math.floor(BASE[r.diff] * (r.holes === 18 ? 2 : 1) * PLACE[r.place - 1]) + Math.min(3000, 150 * Math.max(0, r.par - r.strokes)) + 500 * Math.min(3, r.aces);
      box.innerHTML = `<p class="rw-note">Sign in with your Warden Chat account to earn coins. This round would have paid <b>🪙 ${fmt(est)}</b>.</p><button type="button" class="btn small" data-shop="signin">Sign in</button>`;
      return;
    }
    box.innerHTML = '<p class="rw-note">Counting your coins…</p>';
    Wallet.reward(r).then(x => {
      const lines = [`<li><span>${r.holes} holes, ${['1st', '2nd', '3rd', '4th'][r.place - 1]} place</span><b>${fmt(Math.floor(x.base * x.holes_mult * x.place_mult))}</b></li>`];
      if (x.member_mult > 1) lines.push(`<li><span>${SIRSC_BADGE_SVG} Member</span><b>×${x.member_mult}</b></li>`);
      if (x.under_par_bonus) lines.push(`<li><span>Under par</span><b>+${fmt(x.under_par_bonus)}</b></li>`);
      if (x.ace_bonus) lines.push(`<li><span>Hole${r.aces > 1 ? 's' : ''} in one</span><b>+${fmt(x.ace_bonus)}</b></li>`);
      if (x.first_win_bonus) lines.push(`<li><span>First win today</span><b>+${fmt(x.first_win_bonus)}</b></li>`);
      box.innerHTML = `<div class="rw-total">🪙 <span id="rwCount">0</span></div><ul class="rw-lines">${lines.join('')}</ul>
        <p class="rw-note">${x.capped ? 'You’ve hit today’s 25,000-coin limit for Putt Club. It resets at midnight UTC.' : `Today: ${fmt(x.today)} of ${fmt(x.daily_cap)} coins.`}</p>`;
      countUp(q('#rwCount'), x.coins);
      if (x.coins > 0) sfx('good');
      renderChip();
    }, e => {
      const msg = e.code === 'sirsc_bad_reward' ? 'That round was too quick to earn coins.'
        : e.code === 'sirsc_rate_limited' ? 'That’s a lot of rounds this hour. Coins come back shortly.'
          : e.offline ? 'Couldn’t reach Warden Chat, so no coins this time.' : 'No coins this time: Warden Chat didn’t answer.';
      box.innerHTML = `<p class="rw-note">${msg}</p>`;
    });
  }
  function countUp(el, n) {
    if (!el) return;
    const t0 = performance.now(), dur = Math.min(1600, 400 + n / 6);
    const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = fmt(Math.round(n * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- wiring ---------- */
  function init() {
    installBadgeDefs();
    document.addEventListener('click', e => {
      if (popOpen && !e.target.closest('.acct-pop,[data-shop="acct"]')) { popOpen = false; renderChip(); }
      const t = e.target.closest('[data-shop],[data-tab-shop],[data-buy],[data-equip],[data-preview],[data-cancel]');
      if (!t) return;
      if (t.dataset.shop === 'open' || t.dataset.shop === 'diamonds' || t.dataset.shop === 'member') { sfx('click'); popOpen = false; show(t.dataset.shop === 'open' ? null : t.dataset.shop); renderChip(); return; }
      if (t.dataset.shop === 'acct') { sfx('click'); popOpen = !popOpen; renderChip(); return; }
      if (t.dataset.shop === 'close') { sfx('click'); hide(); return; }
      if (t.dataset.shop === 'signin') { openSignIn(); return; }
      if (t.dataset.shop === 'signout') { popOpen = false; Account.signOut().then(() => { renderWalletBar(); renderGrid(); Look.apply(); }); return; }
      if (t.dataset.shop === 'demo-member') { Account.rpc('demo_membership', {}).then(() => Wallet.load()).then(() => { renderGrid(); renderWalletBar(); }); return; }
      if (t.dataset.tabShop) { tab = t.dataset.tabShop; confirmKey = ''; sfx('click'); renderGrid(); return; }
      if (t.dataset.buy) { buy(t.dataset.buy); return; }
      if (t.dataset.equip) { const c = cosmeticOf(t.dataset.equip); Look.choose(c.kind, c.id); sfx('click'); renderGrid(); renderChip(); return; }
      if (t.dataset.cancel) { Wallet.cancelRequest(t.dataset.cancel).then(renderGrid, err => toast('Not cancelled', errText(err), 'bad')); return; }
      if (t.dataset.preview && !e.target.closest('button')) setPreview(t.dataset.preview);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.preview) setPreview(e.target.dataset.preview); });
    document.addEventListener('submit', e => {
      if (e.target.id === 'signinForm') { e.preventDefault(); submit(false); }
      if (e.target.id === 'diaForm') {
        e.preventDefault();
        Wallet.requestDiamonds(+q('#diaN').value, q('#diaNote').value).then(() => {
          toast('Request sent', 'SirSC adds your diamonds once they see it.', 'good'); renderGrid();
        }, err => toast('Not sent', errText(err), 'bad'));
      }
    });
    q('#siCreate').addEventListener('click', () => submit(true));
    q('#siClose').addEventListener('click', closeSignIn);
    q('#signin').addEventListener('click', e => { if (e.target.id === 'signin') closeSignIn(); });
    q('#siChat').href = PUTT_CONFIG.chatUrl;
    const refresh = () => { renderChip(); Look.apply(); if (open) { renderWalletBar(); renderGrid(); } };
    // The Play online tab and the round-end coins depend on who is signed in.
    Account.on(() => { refresh(); if (PC.game) PC.game.renderMenu(); });
    Wallet.on(refresh);
    Wallet.onClaim(c => {
      const parts = [];
      if (c.diamonds_added) parts.push(`+${c.diamonds_added} 💎 this month`);
      if (c.claimed && c.claimed.length) parts.push(c.claimed.map(i => (cosmeticOf(i) || { name: i }).name).join(', '));
      toast('Member perks', parts.join(' · '), 'good');
    });
    renderChip();
    Account.init();
  }
  return { init, reward, openSignIn, renderChip, show, hide, get open() { return open; } };
})();
