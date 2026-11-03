/* Wildcard Chess: the account chip, signing in, the Shop (boards, card backs, finales, membership,
   diamonds) and the coins shown after a game. Everything about money goes through Wallet (wallet.js);
   the server decides it. Loaded before game.js, so the game's helpers ($, toast, show, G…) are only
   used once the page is running. */
'use strict';

const Shop = (() => {
  const q = s => document.querySelector(s);
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  let tab = 'board', preview = null, previewBoard = null, confirmKey = '';

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

  /* ---------- the chip on the menu ---------- */
  function renderChip() {
    const chip = q('#acctChip');
    if (!chip) return;
    chip.hidden = !available();
    if (Account.status === 'signedIn') {
      chip.innerHTML = `<button type="button" class="acct-in" data-shop="open"><span class="acct-name">${esc(Account.user.username)}${badge()}</span>
        <span class="acct-bal">${Wallet.me ? `<span>🪙 ${fmt(Wallet.coins)}</span><span>💎 ${fmt(Wallet.diamonds)}</span>` : '<span>Loading wallet…</span>'}</span>${window.WCC_DEMO ? '<span class="acct-demo">Demo wallet, pretend coins</span>' : ''}</button>`;
    } else if (Account.status === 'restricted') {
      chip.innerHTML = '<span class="acct-in acct-banned">Account restricted on Warden Chat</span>';
    } else chip.innerHTML = '<button type="button" class="btn small acct-signin" data-shop="signin"><span>Sign in</span></button>';
    const sc = q('#shopCount');
    if (sc) sc.textContent = Account.status === 'signedIn' && Wallet.me ? `🪙 ${fmt(Wallet.coins)}` : 'Boards & more';
  }

  /* ---------- signing in ---------- */
  function openSignIn() {
    q('#siErr').textContent = '';
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
      toast(`${pieceSVG('K', 'w')}<span>Signed in as ${esc(user)}</span>`, 'var(--gold)');
    }, e => { q('#siErr').textContent = errText(e); });
  }

  /* ---------- the shop screen ---------- */
  function items(kind) {
    const free = { board: 'walnut', back: 'classic', finale: 'classic' }[kind];
    return [kind + ':' + free].concat(WCC_CATALOG.filter(c => c.item_id.startsWith(kind + ':')).map(c => c.item_id));
  }
  function swatch(item) {
    const c = cosmeticOf(item);
    if (c.kind === 'board') return `<canvas class="sw-board" data-theme="${c.id}" width="128" height="128"></canvas>`;
    if (c.kind === 'back') return `<div class="sw-back" style="--a:${c.a};--b:${c.b};--ink:${c.ink};--bd:${c.border}"><span>W</span></div>`;
    return `<div class="sw-finale" style="--c1:${c.colors[0]};--c2:${c.colors[1]};--c3:${c.colors[2] || c.colors[0]}">${pieceSVG('K', 'w')}</div>`;
  }
  function stateOf(item) {
    const c = cosmeticOf(item), price = Wallet.price(item), look = Look.current();
    const isFree = item.endsWith(':' + DEFAULT_LOOK[c.kind]);
    const owned = isFree || Wallet.owns(item), equipped = look[c.kind] === c.id;
    return { c, price, owned, equipped, isFree };
  }
  function buyHTML(item) {
    const { price, owned, equipped, isFree } = stateOf(item);
    if (owned) return `<span class="own">${isFree ? 'Free' : 'Owned'}</span>` + (equipped ? '<span class="equipped">Equipped</span>' : `<button type="button" class="btn small" data-equip="${item}"><span>Equip</span></button>`);
    if (price && price.member_only) {
      const when = price.claim_from ? `Members, ${new Date(price.claim_from).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}` : 'Every member';
      return `<span class="member-only">👑 ${when}</span>`;
    }
    const b = [];
    for (const cur of ['coins', 'diamonds']) {
      if (!price || !price[cur]) continue;
      const key = item + '|' + cur, label = cur === 'coins' ? `🪙 ${fmt(price.coins)}` : `💎 ${price.diamonds}`;
      b.push(`<button type="button" class="btn small ${confirmKey === key ? 'primary' : ''}" data-buy="${key}"><span>${confirmKey === key ? 'Buy for ' + label + '?' : label}</span></button>`);
    }
    return b.join('');
  }
  function renderWalletBar() {
    const w = q('#shopWallet');
    if (!available()) { w.innerHTML = '<span class="sw-note">The shop opens when Warden Chat accounts are switched on.</span>'; return; }
    if (Account.status !== 'signedIn') { w.innerHTML = '<button type="button" class="btn small primary" data-shop="signin"><span>Sign in to buy</span></button>'; return; }
    w.innerHTML = (window.WCC_DEMO ? '<span class="pill demo" title="This build uses a pretend wallet stored in your browser. Nothing touches a real Warden Chat account.">Demo wallet</span>' : '') + `<span class="pill">🪙 <b>${fmt(Wallet.coins)}</b></span><span class="pill">💎 <b>${fmt(Wallet.diamonds)}</b></span>
      <span class="pill who">${esc(Account.user.username)}${badge()}</span><button type="button" class="btn small ghost" data-shop="signout"><span>Sign out</span></button>`;
  }
  function renderGrid() {
    for (const b of document.querySelectorAll('.shop-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    const g = q('#shopGrid');
    if (tab === 'member') { g.innerHTML = memberHTML(); return; }
    if (tab === 'diamonds') { g.innerHTML = diamondsHTML(); return; }
    g.innerHTML = items(tab).map(item => {
      const { c } = stateOf(item);
      return `<div class="item ${preview === item ? 'pv' : ''}" data-preview="${item}" tabindex="0" role="button" aria-label="Preview ${esc(c.name)}">
        <div class="item-art">${swatch(item)}</div>
        <div class="item-txt"><div class="item-name">${esc(c.name)}</div><div class="item-desc">${esc(c.desc)}</div></div>
        <div class="item-buy">${buyHTML(item)}</div></div>`;
    }).join('');
    for (const cv of g.querySelectorAll('canvas.sw-board')) paintBoard(cv.getContext('2d'), cv.width, cv.dataset.theme, 3, 2);
  }
  function memberHTML() {
    const until = Wallet.memberUntil ? new Date(Wallet.memberUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
    const month = WCC_CATALOG.filter(c => c.member_only && c.claim_from && Date.parse(c.claim_from) <= Date.now() && Date.now() < Date.parse(c.claim_until));
    return `<div class="member-card">
      <div class="mc-head">${SIRSC_BADGE_SVG}<div><h3>SirSC Membership</h3><p>${Wallet.member ? `You're a member until ${until}.` : '$3 a month, paid to SirSC. It works across all of SirSC’s games.'}</p></div></div>
      <ul class="mc-perks">
        <li><b>1.5× coins</b> from every game</li>
        <li><b>5 💎 every month</b>, added the first time you play that month</li>
        <li><b>The SirSC Diamond</b> by your name</li>
        <li><b>This month's members' board</b>, yours forever: ${month.map(c => esc(cosmeticOf(c.item_id).name)).join(', ') || 'coming soon'}</li>
        <li><b>The SirSC Diamond card back</b> while you're a member</li>
      </ul>
      ${Wallet.member ? '' : `<p class="mc-how">To join, pay SirSC $3 for each month and ask them to add it to your Warden Chat account.</p>`}
      ${window.WCC_DEMO && Account.status === 'signedIn' && !Wallet.member ? '<button type="button" class="btn small primary" data-shop="demo-member"><span>Demo: try a month of membership</span></button>' : ''}
    </div>`;
  }
  function diamondsHTML() {
    const reqs = (Wallet.me && Wallet.me.requests) || [];
    return `<div class="member-card">
      <div class="mc-head"><div class="dia-big">💎</div><div><h3>Diamonds</h3><p>5 💎 for $1, paid to SirSC in person. Then send a request here and SirSC adds them to your wallet. 1 💎 is worth 5,000 coins.</p></div></div>
      ${Account.status === 'signedIn' ? `<form class="dia-form" id="diaForm">
        <label>Diamonds <select id="diaN">${[5, 10, 25, 50, 100, 250, 500].map(n => `<option value="${n}">${n} 💎 ($${n / 5})</option>`).join('')}</select></label>
        <label>Note for SirSC <input id="diaNote" maxlength="200" placeholder="e.g. paid at lunch on Tuesday"></label>
        <button class="btn small primary" type="submit"><span>I've paid: request them</span></button></form>
      <div class="dia-reqs">${reqs.length ? reqs.map(r => `<div class="dia-req"><span>${r.diamonds} 💎</span><span class="st ${r.status}">${r.status}</span>${r.status === 'pending' ? `<button type="button" class="btn small ghost" data-cancel="${r.id}"><span>Cancel</span></button>` : ''}</div>`).join('') : '<p class="sw-note">No requests yet.</p>'}</div>`
        : '<button type="button" class="btn small primary" data-shop="signin"><span>Sign in to request diamonds</span></button>'}
    </div>`;
  }
  function setPreview(item) {
    preview = item;
    const c = cosmeticOf(item), b = previewBoard;
    if (!b) return;
    b.resetEnd();
    b.setTheme(c.kind === 'board' ? c.id : Look.current().board);
    if (c.kind === 'back') {
      const root = b.root.style;
      root.setProperty('--back-a', c.a); root.setProperty('--back-b', c.b); root.setProperty('--back-ink', c.ink); root.setProperty('--back-border', c.border);
      b.setFacedown(new Set([48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 61, 62, 63]));
    } else {
      b.setFacedown(new Set());
      for (const k of ['--back-a', '--back-b', '--back-ink', '--back-border']) b.root.style.removeProperty(k);
    }
    q('#shopPvCap').textContent = c.kind === 'finale' ? `Previewing: ${c.name}` : `Previewing: ${c.name}`;
    if (c.kind === 'finale') {
      playFinale(b, 60, c.id, { win: true, word: 'Checkmate', sub: 'Preview' });
      const at = preview;
      setTimeout(() => { if (preview === at) b.resetEnd(); }, 3200);
    }
    renderGrid();
  }
  function render() {
    if (!previewBoard) {
      previewBoard = new BoardView(q('#shopBoard'), { seed: 21, coords: false });
      const s = E.newGame({ wild: { w: ['phoenix'], b: ['void'] }, slots: { w: [11], b: [51] } });
      previewBoard.setPieces(s, { anim: false });
    }
    requestAnimationFrame(() => previewBoard.resize());
    renderWalletBar();
    renderGrid();
    if (!preview) setPreview('board:' + Look.current().board);
    if (Account.status === 'signedIn') Wallet.load();
  }

  function buy(key) {
    const [item, cur] = key.split('|');
    if (Account.status !== 'signedIn') { openSignIn(); return; }
    if (confirmKey !== key) { confirmKey = key; renderGrid(); return; }
    confirmKey = '';
    Wallet.buy(item, cur).then(() => {
      Sound.play('win');
      const c = cosmeticOf(item);
      Look.choose(c.kind, c.id);
      toast(`${pieceSVG('K', 'w')}<span>${esc(c.name)} is yours, and equipped</span>`, 'var(--gold)');
      renderWalletBar(); renderGrid();
    }, e => { toast(`<span>${esc(errText(e))}</span>`, 'var(--red)'); renderGrid(); });
  }

  /* ---------- coins after a game ---------- */
  const REWARD_BASE = { easy: 500, medium: 1000, pro: 2000, xtreme: 4000 };
  function reward(st, game) {
    const box = q('#rewardBox');
    if (!box || !available()) return;
    if (game.mode !== 'ai') { box.innerHTML = `<p class="rw-note">${game.mode === 'online' ? 'Online games don\u2019t earn coins yet.' : 'Pass &amp; Play games don\u2019t earn coins.'}</p>`; return; }
    const result = !st.winner ? 'draw' : st.winner === game.human ? 'win' : 'loss';
    if (Account.status !== 'signedIn') {
      const est = Math.floor(REWARD_BASE[game.level] * { win: 1, draw: 0.3, loss: 0.1 }[result] * (game.drafted ? 1.25 : 1));
      box.innerHTML = `<p class="rw-note">Sign in with your Warden Chat account to earn coins. This game would have paid <b>🪙 ${fmt(est)}</b>.</p>
        <button type="button" class="btn small" data-shop="signin"><span>Sign in</span></button>`;
      return;
    }
    box.innerHTML = '<p class="rw-note">Counting your coins…</p>';
    Wallet.reward({ level: game.level, result, plies: game.plies, durationMs: game.durationMs, draft: game.drafted, codex: game.codex }).then(r => {
      const lines = [`<li><span>${LEVELS[game.level].name} ${result}</span><b>${fmt(Math.floor(r.base * r.result_mult))}</b></li>`];
      if (r.draft_mult > 1) lines.push(`<li><span>Drafted army</span><b>×${r.draft_mult}</b></li>`);
      if (r.member_mult > 1) lines.push(`<li><span>${SIRSC_BADGE_SVG} Member</span><b>×${r.member_mult}</b></li>`);
      if (r.first_win_bonus) lines.push(`<li><span>First win today</span><b>+${fmt(r.first_win_bonus)}</b></li>`);
      if (r.codex_bonus) lines.push(`<li><span>New in your Codex: ${r.codex_new.map(t => esc(WILD[t] ? WILD[t].name : t)).join(', ')}</span><b>+${fmt(r.codex_bonus)}</b></li>`);
      box.innerHTML = `<div class="rw-total">🪙 <span id="rwCount">0</span></div><ul class="rw-lines">${lines.join('')}</ul>
        <p class="rw-note">${r.capped ? 'You’ve hit today’s 25,000-coin limit for Wildcard Chess. It resets at midnight UTC.' : `Today: ${fmt(r.today)} of ${fmt(r.daily_cap)} coins.`}</p>`;
      countUp(q('#rwCount'), r.coins);
      if (r.coins > 0) Sound.play('magic');
      renderChip();
    }, e => {
      const msg = e.code === 'sirsc_bad_reward' ? 'That game was too short to earn coins (at least 6 moves each and 30 seconds).'
        : e.code === 'sirsc_rate_limited' ? 'That’s a lot of games this hour. Coins come back shortly.'
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
      const t = e.target.closest('[data-shop],[data-tab],[data-buy],[data-equip],[data-preview],[data-cancel]');
      if (!t) return;
      Sound.init();
      if (t.dataset.shop === 'open') { show('shop'); return; }
      if (t.dataset.shop === 'signin') { openSignIn(); return; }
      if (t.dataset.shop === 'signout') { Account.signOut().then(() => { renderWalletBar(); renderGrid(); Look.apply(); }); return; }
      if (t.dataset.shop === 'demo-member') { Account.rpc('demo_membership', {}).then(() => Wallet.load()).then(() => { renderGrid(); renderWalletBar(); }); return; }
      if (t.dataset.tab) { tab = t.dataset.tab; confirmKey = ''; renderGrid(); return; }
      if (t.dataset.buy) { buy(t.dataset.buy); return; }
      if (t.dataset.equip) { const c = cosmeticOf(t.dataset.equip); Look.choose(c.kind, c.id); Sound.play('select'); renderGrid(); return; }
      if (t.dataset.cancel) { Wallet.cancelRequest(t.dataset.cancel).then(renderGrid, err => toast(`<span>${esc(errText(err))}</span>`, 'var(--red)')); return; }
      if (t.dataset.preview) setPreview(t.dataset.preview);
    });
    document.addEventListener('submit', e => {
      if (e.target.id === 'signinForm') { e.preventDefault(); submit(false); }
      if (e.target.id === 'diaForm') {
        e.preventDefault();
        Wallet.requestDiamonds(+q('#diaN').value, q('#diaNote').value).then(() => {
          toast('<span>Request sent. SirSC adds your diamonds once they see it.</span>', 'var(--gold)'); renderGrid();
        }, err => toast(`<span>${esc(errText(err))}</span>`, 'var(--red)'));
      }
    });
    q('#siCreate').addEventListener('click', () => submit(true));
    q('#siClose').addEventListener('click', closeSignIn);
    q('#signin').addEventListener('click', e => { if (e.target.id === 'signin') closeSignIn(); });
    q('#siChat').href = WCC_CONFIG.chatUrl;
    Account.on(() => { renderChip(); Look.apply(); if (current === 'shop') { renderWalletBar(); renderGrid(); } });
    Wallet.on(() => { renderChip(); Look.apply(); if (current === 'shop') { renderWalletBar(); renderGrid(); } });
    Wallet.onClaim(c => {
      const parts = [];
      if (c.diamonds_added) parts.push(`+${c.diamonds_added} 💎 this month`);
      if (c.claimed && c.claimed.length) parts.push(c.claimed.map(i => (cosmeticOf(i) || { name: i }).name).join(', '));
      toast(`${SIRSC_BADGE_SVG}<span>Member perks: ${esc(parts.join(' · '))}</span>`, '#7fd8ff');
    });
    renderChip();
    Account.init();
  }
  return { init, render, reward, openSignIn, renderChip };
})();
