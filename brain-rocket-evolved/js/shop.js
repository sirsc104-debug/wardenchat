/* Brain Rocket – Evolved: what's equipped (Look), the account chip, signing in with Warden Chat, the
 * SirSC Shop (rockets, flames, trails, membership, diamonds) and the coins shown on the results.
 * Everything about money goes through Wallet (wallet.js); the server decides it. Ported in spirit
 * from Wildcard Chess's js/shop.js. */
'use strict';

/* What's equipped: one item of each kind. Remembered on this device, sent to the wallet when signed
 * in, and only things the account owns (or the free defaults) count. */
const Look = (() => {
  const KEY = 'brEvolved.look';
  let chosen = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(chosen)); } catch (e) { /* storage blocked */ } };
  const usable = (kind, id) => id === BRE_DEFAULT[kind] || (BRE_LOOKS[kind][id] && Wallet.owns(kind + ':' + id));
  function current() {
    const out = {};
    for (const kind of Object.keys(BRE_DEFAULT)) out[kind] = usable(kind, chosen[kind]) ? chosen[kind] : BRE_DEFAULT[kind];
    return out;
  }
  function apply() {
    const c = current(), L = {};
    for (const kind of Object.keys(c)) L[kind] = c[kind] === BRE_DEFAULT[kind] ? null : BRE_LOOKS[kind][c[kind]];
    Scene.setLook(L);
  }
  return {
    current, apply,
    choose(kind, id) {
      chosen[kind] = id; save(); apply();
      Wallet.equip(kind, id === BRE_DEFAULT[kind] ? null : kind + ':' + id);
    },
    // the wallet's copy of what's equipped (slot -> "kind:id")
    adopt(eq) {
      for (const kind of Object.keys(BRE_DEFAULT)) chosen[kind] = eq[kind] ? String(eq[kind]).split(':')[1] : BRE_DEFAULT[kind];
      save(); apply();
    }
  };
})();

const Shop = (() => {
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let tab = 'rocket', preview = null, confirmKey = '', open = false, raf = 0;

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
    sirsc_bad_request: 'Diamonds come in fives, from 5 to 500.'
  };
  const errText = e => ERRORS[e && e.code] || 'Something went wrong. Try again in a moment.';
  const available = () => Account.status !== 'unavailable' && Account.status !== 'checking';
  const badge = () => (Wallet.member ? SIRSC_BADGE_SVG : '');
  const demo = () => !!window.BRE_DEMO;
  function toast(msg) {
    const t = $('toast'); t.innerHTML = msg; t.classList.remove('hidden');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  /* ---------- the chip on the home screen ---------- */
  function renderChip() {
    const chip = $('acctChip');
    chip.classList.toggle('hidden', !available());
    if (Account.status === 'signedIn') {
      chip.innerHTML = `<button type="button" class="acct-in" data-shop="open" title="Open the SirSC Shop"><span class="acct-name">${esc(Account.user.username)}${badge()}</span>
        <span class="acct-bal">${Wallet.me ? `<span>🪙 ${fmt(Wallet.coins)}</span><span>💎 ${fmt(Wallet.diamonds)}</span>` : '<span>Loading wallet…</span>'}</span>${demo() ? '<span class="acct-demo">Demo wallet, pretend coins</span>' : ''}</button>`;
    } else if (Account.status === 'restricted') {
      chip.innerHTML = '<span class="acct-in acct-banned">Account restricted on Warden Chat</span>';
    } else chip.innerHTML = '<button type="button" class="go-btn small" data-shop="signin">Sign in</button>';
    document.querySelectorAll('[data-shop-link]').forEach(el => el.classList.toggle('hidden', !available()));
  }

  /* ---------- signing in ---------- */
  function openSignIn() {
    $('siErr').textContent = '';
    $('signin').classList.remove('hidden');
    setTimeout(() => $('siUser').focus(), 30);
  }
  const closeSignIn = () => $('signin').classList.add('hidden');
  function submit(create) {
    const user = $('siUser').value.trim(), pass = $('siPass').value, R = Account.RULES;
    if (user.length < R.nameMin || user.length > R.nameMax || !R.nameRe.test(user)) { $('siErr').textContent = ERRORS.signup_rejected; return; }
    if (create && pass.length < R.passwordMin) { $('siErr').textContent = ERRORS.weak_password; return; }
    $('siErr').textContent = create ? 'Creating your Warden Chat account…' : 'Signing in…';
    (create ? Account.signUp(user, pass) : Account.signIn(user, pass)).then(() => {
      $('siPass').value = '';
      closeSignIn();
      toast(`🚀 Signed in as ${esc(user)}`);
    }, e => { $('siErr').textContent = errText(e); });
  }

  /* ---------- the shop screen ---------- */
  const items = kind => [kind + ':' + BRE_DEFAULT[kind]].concat(BRE_CATALOG.filter(c => c.item_id.startsWith(kind + ':')).map(c => c.item_id));
  function stateOf(item) {
    const c = lookOf(item), price = Wallet.price(item);
    const isFree = c.id === BRE_DEFAULT[c.kind];
    return { c, price, isFree, owned: isFree || Wallet.owns(item), equipped: Look.current()[c.kind] === c.id };
  }
  function buyHTML(item) {
    const { price, owned, equipped, isFree } = stateOf(item);
    if (owned) return `<span class="own">${isFree ? 'Free' : 'Owned'}</span>` + (equipped ? '<span class="equipped">Equipped</span>' : `<button type="button" class="ghost-btn small" data-equip="${item}">Equip</button>`);
    if (price && price.member_only) {
      const when = price.claim_from ? `Members, ${new Date(price.claim_from).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}` : 'Every member';
      return `<span class="member-only">👑 ${when}</span>`;
    }
    const b = [];
    for (const cur of ['coins', 'diamonds']) {
      if (!price || !price[cur]) continue;
      const key = item + '|' + cur, label = cur === 'coins' ? `🪙 ${fmt(price.coins)}` : `💎 ${price.diamonds}`;
      b.push(`<button type="button" class="${confirmKey === key ? 'go-btn' : 'ghost-btn'} small" data-buy="${key}">${confirmKey === key ? 'Buy for ' + label + '?' : label}</button>`);
    }
    return b.join('');
  }
  // what the preview shows for an item: the item itself, with what's equipped for the other kinds
  function lookWith(item) {
    const cur = Look.current(), L = {};
    for (const kind of Object.keys(cur)) L[kind] = cur[kind] === BRE_DEFAULT[kind] ? null : BRE_LOOKS[kind][cur[kind]];
    if (item) { const c = lookOf(item); L[c.kind] = c.id === BRE_DEFAULT[c.kind] ? null : BRE_LOOKS[c.kind][c.id]; }
    return L;
  }
  function renderWalletBar() {
    const w = $('shopWallet');
    if (!available()) { w.innerHTML = '<span class="sw-note">The shop opens when Warden Chat accounts are switched on.</span>'; return; }
    if (Account.status !== 'signedIn') { w.innerHTML = '<button type="button" class="go-btn small" data-shop="signin">Sign in to buy</button><span class="sw-note">Use your Warden Chat account.</span>'; return; }
    w.innerHTML = (demo() ? '<span class="pill demo" title="This build uses a pretend wallet stored in your browser. Nothing touches a real Warden Chat account.">Demo wallet</span>' : '') +
      `<span class="pill">🪙 <b>${fmt(Wallet.coins)}</b></span><span class="pill">💎 <b>${fmt(Wallet.diamonds)}</b></span>
      <span class="pill who">${esc(Account.user.username)}${badge()}</span><button type="button" class="ghost-btn small" data-shop="signout">Sign out</button>`;
  }
  function renderGrid() {
    document.querySelectorAll('.shop-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const g = $('shopGrid');
    if (tab === 'member') { g.innerHTML = memberHTML(); return; }
    if (tab === 'diamonds') { g.innerHTML = diamondsHTML(); return; }
    const wide = tab === 'scene';
    g.classList.toggle('wide', wide);
    g.innerHTML = items(tab).map(item => {
      const { c } = stateOf(item);
      return `<div class="item ${preview === item ? 'pv' : ''}" data-preview="${item}" tabindex="0" role="button" aria-label="Preview ${esc(c.name)}">
        <canvas class="item-art" width="${wide ? 192 : 96}" height="${wide ? 108 : 120}" data-art="${item}"></canvas>
        <div class="item-txt"><div class="item-name">${esc(c.name)}</div><div class="item-desc">${esc(c.desc)}</div></div>
        <div class="item-buy">${buyHTML(item)}</div></div>`;
    }).join('');
    for (const cv of g.querySelectorAll('canvas[data-art]')) (wide ? Scene.previewScene : Scene.preview)(cv, lookWith(cv.dataset.art), 1.2);
  }
  function memberHTML() {
    const until = Wallet.memberUntil ? new Date(Wallet.memberUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
    const month = BRE_CATALOG.filter(c => c.member_only && c.claim_from && Date.parse(c.claim_from) <= Date.now() && Date.now() < Date.parse(c.claim_until));
    return `<div class="member-card">
      <div class="mc-head2">${SIRSC_BADGE_SVG}<div><h3>SirSC Membership</h3><p>${Wallet.member ? `You're a member until ${until}.` : '$3 a month, paid to SirSC. It works across all of SirSC’s games.'}</p></div></div>
      <ul class="mc-perks">
        <li><b>1.5× coins</b> from every Daily Launch and Endless run</li>
        <li><b>5 💎 every month</b>, added the first time you play that month</li>
        <li><b>The SirSC Diamond</b> by your name</li>
        <li><b>This month's members' rocket</b>, yours forever: ${month.map(c => esc(lookOf(c.item_id).name)).join(', ') || 'coming soon'}</li>
        <li><b>The SirSC Diamond rocket</b>, <b>Diamond Fire</b>, <b>Diamond Shards</b> and the <b>Crystal Caverns</b> scene while you're a member</li>
      </ul>
      ${Wallet.member ? '' : '<p class="mc-how">To join, pay SirSC $3 for each month and ask them to add it to your Warden Chat account.</p>'}
      ${demo() && Account.status === 'signedIn' && !Wallet.member ? '<button type="button" class="go-btn small" data-shop="demo-member">Demo: try a month of membership</button>' : ''}
    </div>`;
  }
  function diamondsHTML() {
    const reqs = (Wallet.me && Wallet.me.requests) || [];
    return `<div class="member-card">
      <div class="mc-head2"><div class="dia-big">💎</div><div><h3>Diamonds</h3><p>5 💎 for $1, paid to SirSC in person. Then send a request here and SirSC adds them to your wallet. 1 💎 is worth 5,000 coins.</p></div></div>
      ${Account.status === 'signedIn' ? `<form class="dia-form" id="diaForm">
        <label>Diamonds <select id="diaN">${[5, 10, 25, 50, 100, 250, 500].map(n => `<option value="${n}">${n} 💎 ($${n / 5})</option>`).join('')}</select></label>
        <label>Note for SirSC <input id="diaNote" maxlength="200" placeholder="e.g. paid at lunch on Tuesday"></label>
        <button class="go-btn small" type="submit">I've paid: request them</button></form>
      <div class="dia-reqs">${reqs.length ? reqs.map(r => `<div class="dia-req"><span>${r.diamonds} 💎</span><span class="st ${r.status}">${r.status}</span>${r.status === 'pending' ? `<button type="button" class="ghost-btn small" data-cancel="${r.id}">Cancel</button>` : ''}</div>`).join('') : '<p class="sw-note">No requests yet.</p>'}</div>`
        : '<button type="button" class="go-btn small" data-shop="signin">Sign in to request diamonds</button>'}
    </div>`;
  }
  function setPreview(item) {
    preview = item;
    const c = lookOf(item);
    $('shopPvCap').textContent = `Previewing: ${c.name}`;
    renderGrid();
  }
  function loop(t) {
    if (!open) return;
    const c = preview && lookOf(preview);
    (c && c.kind === 'scene' ? Scene.previewScene : Scene.preview)($('shopCanvas'), lookWith(preview), t / 1000);
    raf = requestAnimationFrame(loop);
  }
  function show() {
    open = true;
    $('shop').classList.remove('hidden');
    renderWalletBar(); renderGrid();
    if (!preview) setPreview('rocket:' + Look.current().rocket);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    if (Account.status === 'signedIn') Wallet.load();
  }
  function hide() { open = false; cancelAnimationFrame(raf); $('shop').classList.add('hidden'); }

  function buy(key) {
    const [item, cur] = key.split('|');
    if (Account.status !== 'signedIn') { openSignIn(); return; }
    if (confirmKey !== key) { confirmKey = key; renderGrid(); return; }
    confirmKey = '';
    Wallet.buy(item, cur).then(() => {
      Sound.best();
      const c = lookOf(item);
      Look.choose(c.kind, c.id);
      toast(`✨ ${esc(c.name)} is yours, and equipped`);
      renderWalletBar(); renderGrid();
    }, e => { toast(esc(errText(e))); renderGrid(); });
  }

  /* ---------- coins on the results ---------- */
  // What a run would pay (the server's formula, docs/ECONOMY-BRE.md), for players who aren't signed in.
  const estimate = r => (r.mode === 'daily' ? Math.floor(10000 + 0.6 * Math.min(50000, r.score)) : Math.floor(Math.min(20000, 0.4 * r.score)));
  function reward(r) {
    const box = $('rewardBox');
    box.innerHTML = '';
    if (!available() || r.crashed || (r.mode !== 'daily' && r.mode !== 'endless')) {
      if (available() && r.mode === 'archive') box.innerHTML = '<p class="rw-note">Archive launches don’t earn coins. Today’s Daily Launch does.</p>';
      return;
    }
    if (Account.status !== 'signedIn') {
      box.innerHTML = `<p class="rw-note">Sign in with your Warden Chat account to earn coins. This ${r.mode === 'daily' ? 'launch' : 'run'} would have paid <b>🪙 ${fmt(estimate(r))}</b>.</p>
        <button type="button" class="go-btn small" data-shop="signin">Sign in</button>`;
      return;
    }
    box.innerHTML = '<p class="rw-note">Counting your coins…</p>';
    Wallet.reward(r).then(x => {
      const lines = [];
      if (r.mode === 'daily') lines.push(`<li><span>Daily Launch finished</span><b>${fmt(x.base)}</b></li>`, `<li><span>${fmt(r.score)} points</span><b>+${fmt(x.score_bonus)}</b></li>`);
      else lines.push(`<li><span>${fmt(r.score)} points${x.score_coins >= 20000 ? ' (the most a run pays)' : ''}</span><b>${fmt(x.score_coins)}</b></li>`);
      if (x.member_mult > 1) lines.push(`<li><span>${SIRSC_BADGE_SVG} Member</span><b>×${x.member_mult}</b></li>`);
      const note = r.mode === 'daily' ? (x.already_paid ? 'You’ve already been paid for today’s launch.' : 'One reward per Daily Launch.')
        : x.capped ? `You’ve hit today’s ${fmt(x.daily_cap)}-coin limit for Endless. It resets at midnight UTC.` : `Endless today: ${fmt(x.today)} of ${fmt(x.daily_cap)} coins.`;
      box.innerHTML = `<div class="rw-total">🪙 <span id="rwCount">0</span></div><ul class="rw-lines">${lines.join('')}</ul><p class="rw-note">${note}</p>`;
      countUp($('rwCount'), x.coins);
      if (x.coins > 0) Sound.best();
      renderChip();
    }, e => {
      const msg = e.code === 'sirsc_bad_reward' ? 'That run couldn’t earn coins: it was too short.'
        : e.code === 'sirsc_rate_limited' ? 'That’s a lot of runs this hour. Coins come back shortly.'
          : e.offline ? 'Couldn’t reach Warden Chat, so no coins this time.' : 'No coins this time: Warden Chat didn’t answer.';
      box.innerHTML = `<p class="rw-note">${msg}</p>`;
    });
  }
  function countUp(el, n) {
    const t0 = performance.now(), dur = Math.min(1800, 500 + n / 20);
    const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = fmt(Math.round(n * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- wiring ---------- */
  function init() {
    installBadgeDefs();
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-shop],[data-shoptab],[data-buy],[data-equip],[data-preview],[data-cancel]');
      if (!t) return;
      if (t.dataset.shop === 'open') { Sound.click(); show(); return; }
      if (t.dataset.shop === 'close') { Sound.click(); hide(); return; }
      if (t.dataset.shop === 'signin') { openSignIn(); return; }
      if (t.dataset.shop === 'signout') { Account.signOut().then(() => { renderWalletBar(); renderGrid(); Look.apply(); }); return; }
      if (t.dataset.shop === 'demo-member') { Account.rpc('demo_membership', {}).then(() => Wallet.load()).then(() => { renderGrid(); renderWalletBar(); }); return; }
      if (t.dataset.shoptab) { tab = t.dataset.shoptab; confirmKey = ''; Sound.click(); renderGrid(); if (BRE_KINDS[tab]) setPreview(tab + ':' + Look.current()[tab]); return; }
      if (t.dataset.buy) { buy(t.dataset.buy); return; }
      if (t.dataset.equip) { const c = lookOf(t.dataset.equip); Look.choose(c.kind, c.id); Sound.click(); renderGrid(); return; }
      if (t.dataset.cancel) { Wallet.cancelRequest(t.dataset.cancel).then(renderGrid, err => toast(esc(errText(err)))); return; }
      if (t.dataset.preview) setPreview(t.dataset.preview);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('signin').classList.contains('hidden')) { closeSignIn(); e.stopPropagation(); return; }
      if (e.key === 'Escape' && open) { hide(); e.stopPropagation(); }
    }, true);
    document.addEventListener('submit', e => {
      if (e.target.id === 'signinForm') { e.preventDefault(); submit(false); }
      if (e.target.id === 'diaForm') {
        e.preventDefault();
        Wallet.requestDiamonds(+$('diaN').value, $('diaNote').value).then(() => { toast('Request sent. SirSC adds your diamonds once they see it.'); renderGrid(); }, err => toast(esc(errText(err))));
      }
    });
    $('siCreate').addEventListener('click', () => submit(true));
    $('siClose').addEventListener('click', closeSignIn);
    $('signin').addEventListener('click', e => { if (e.target.id === 'signin') closeSignIn(); });
    $('siChat').href = BRE_CONFIG.chatUrl;
    Account.on(() => { renderChip(); Look.apply(); if (open) { renderWalletBar(); renderGrid(); } });
    Wallet.on(() => { renderChip(); Look.apply(); if (open) { renderWalletBar(); renderGrid(); } });
    Wallet.onClaim(c => {
      const parts = [];
      if (c.diamonds_added) parts.push(`+${c.diamonds_added} 💎 this month`);
      if (c.claimed && c.claimed.length) parts.push(c.claimed.map(i => (lookOf(i) || { name: i }).name).join(', '));
      toast(`${SIRSC_BADGE_SVG} Member perks: ${esc(parts.join(' · '))}`);
    });
    renderChip();
    Look.apply();
    Account.init();
  }
  return { init, reward, show, hide, renderChip, get open() { return open; } };
})();
