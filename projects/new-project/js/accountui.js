/* Apples to Oranges — the account screens. The Sign in / profile button on the home screen; the
   account dialog (sign in with Warden Chat, create a Warden Chat account, the profile with its sync
   status, friends, signing out); the little notices that pop up; and, on the results screen,
   whether the score is saved to your account and how your friends have done on the same mode.
   Talks only to Account (js/account.js). Passwords are changed, and accounts deleted, on Warden Chat.
   Ported from Brain Rocket's js/accountui.js. */
'use strict';

const AccountUI = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R = Account.RULES;
  const chatUrl = Account.CONFIG.chatUrl, chatHost = chatUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const chatLink = text => `<a class="acct-link nowrap" href="${esc(chatUrl)}" target="_blank" rel="noopener">${text}&nbsp;↗</a>`;
  const click = () => { if (typeof Sound !== 'undefined') Sound.click(); };
  const n = v => Math.round(Number(v || 0)).toLocaleString('en-US');
  const MODE_NAME = { classic: '🎈 Classic', race: '🏃 Fruit Dash', guess: '🐿️ Guess the Number', haunt: '🎃 Halloween', size: '🐉 Real Size' };
  const DIFF_NAME = { owen: 'Owen', medium: 'Medium', hard: 'Hard', ultra: 'Ultra' };
  const bestsOf = () => { try { return JSON.parse(localStorage.getItem('a2o.best2') || '{}') || {}; } catch (e) { return {}; } };
  const topOf = (b, mode) => Math.max(0, ...Object.values((b && b[mode]) || {}));

  // A round picture with the first letter of the username, in a colour of its own.
  const COLORS = ['#e8364f', '#ff8a1f', '#e0a91c', '#2fa85a', '#1fa2c9', '#3f6fe0', '#8a4fd6', '#d63f9a'];
  function avatar(name, cls) {
    const s = String(name || '?');
    let h = 0; for (const c of s.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0;
    return `<span class="acct-av${cls ? ' ' + cls : ''}" style="background:${COLORS[Math.abs(h) % COLORS.length]}" aria-hidden="true">${esc(s.charAt(0).toUpperCase())}</span>`;
  }

  // ---- Pieces that live in the page --------------------------------------------
  const stage = $('stage');
  const chip = document.createElement('button');
  chip.type = 'button'; chip.id = 'acctChip'; chip.className = 'acct-chip hidden';
  document.querySelector('#home .corner-btns').appendChild(chip);

  const modal = document.createElement('div');
  modal.id = 'acct'; modal.className = 'modal hidden';
  modal.innerHTML = '<div class="modal-box acct-box" role="dialog" aria-modal="true" aria-labelledby="acctTitle"></div>';
  stage.appendChild(modal);
  const box = modal.firstChild;

  const toastEl = document.createElement('div');
  toastEl.id = 'acctToast'; toastEl.className = 'acct-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
  stage.appendChild(toastEl);

  // on the results screen: friends' bests on the same mode, then the "saved to your account" line
  const overBox = document.querySelector('#over .modal-box');
  const board = document.createElement('div');
  board.id = 'overFriends'; board.className = 'acct-board hidden';
  const note = document.createElement('div');
  note.id = 'overAcct'; note.className = 'acct-note hidden';
  overBox.insertBefore(board, overBox.querySelector('.over-btns'));
  overBox.insertBefore(note, overBox.querySelector('.over-btns'));

  // ---- Little notices --------------------------------------------------------
  let toastTimer = 0;
  function toast(html, kind) {
    toastEl.innerHTML = html;
    toastEl.className = 'acct-toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'acct-toast'; }, 5000);
  }

  // ---- Words ------------------------------------------------------------------
  function ago(t) {
    if (!t) return 'not yet';
    const s = (Date.now() - t) / 1000;
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  const SYNC_TEXT = {
    idle: ['', 'Not synced yet'],
    syncing: ['syncing', 'Syncing…'],
    pending: ['syncing', 'Saving your latest scores…'],
    synced: ['synced', null],
    offline: ['offline', "You're offline. Your scores are saved on this device and will sync when you're back online."],
    error: ['error', "Couldn't sync just now. We'll keep trying."]
  };
  const syncLine = () => (Account.sync === 'synced' ? `Synced ${ago(Account.lastSync)}` : SYNC_TEXT[Account.sync][1]);
  const PW_RULE = `At least ${R.passwordMin} characters, mixing two of: lowercase, uppercase, numbers, symbols.`;
  function errorText(e, name) {
    const who = name ? `<b>${esc(name)}</b>` : 'them';
    switch (e.code) {
      case 'bad_credentials': return "That username or password isn't right.";
      case 'username_taken': return 'That username is already taken on Warden Chat. Try another one, or <button type="button" class="acct-link" data-go="signin">sign in</button> if it\'s yours.';
      case 'weak_password': return `Warden Chat needs a stronger password. ${PW_RULE}`;
      case 'signup_rejected': return "Warden Chat couldn't create that account. Try a different username.";
      case 'confirm_enabled': return `Warden Chat isn't taking new accounts right now. Ask SirSC on ${chatLink('Warden Chat')}.`;
      case 'not_deployed': return 'Accounts are being switched on. Try again a little later.';
      case 'rate_limited': case 'a2o_rate_limited': return 'Too many tries. Wait a minute, then try again.';
      case 'offline': return "Can't reach the server. Check your connection and try again.";
      case 'a2o_user_not_found': return `There's no Warden Chat account called ${who}. Check the spelling.`;
      case 'a2o_self': return "That's you! Add someone else's username.";
      case 'a2o_already_friends': return `You're already friends with ${who}.`;
      case 'a2o_already_requested': return `You've already sent ${who} a friend request.`;
      case 'a2o_too_many': return "You've reached the friend limit.";
      case 'a2o_request_not_found': return 'That request is no longer there.';
      default: return 'Something went wrong on our side. Try again in a moment.';
    }
  }
  const errorField = e => ({ bad_credentials: 'password', username_taken: 'username', weak_password: 'password', signup_rejected: 'username' }[e.code]);
  function friendLine(x) {
    const c = topOf(x.bests, 'classic'), r = topOf(x.bests, 'race');
    const bits = [];
    if (c) bits.push(`🎈 <b>${n(c)}</b>`);
    if (r) bits.push(`🏃 <b>${n(r)}</b>`);
    if (x.race_wins) bits.push(`🏆 ${x.race_wins} race win${x.race_wins === 1 ? '' : 's'}`);
    return bits.length ? bits.join(' · ') : '<span class="fr-none">No scores yet</span>';
  }

  // ---- Building the dialog ---------------------------------------------------------
  function field(name, label, type, attrs, hint) {
    const pw = type === 'password';
    return `<label class="af"><span class="af-label">${label}</span>
      <span class="af-wrap"><input class="af-input" name="${name}" type="${type}" ${attrs || ''} spellcheck="false" autocapitalize="off" autocorrect="off">${pw ? '<button type="button" class="af-eye" aria-label="Show password" aria-pressed="false">Show</button>' : ''}</span>
      ${hint ? `<span class="af-hint">${hint}</span>` : ''}</label>`;
  }
  const head = (title, sub) => `<button type="button" class="acct-x" aria-label="Close">✕</button><h2 id="acctTitle">${title}</h2>${sub ? `<p class="acct-sub">${sub}</p>` : ''}`;
  const errBox = '<div class="af-error" role="alert"></div>';
  const wc = '<span class="wc-badge">💬 Warden Chat</span>';

  const VIEWS = {
    signin: () => `${head('Sign in', `Use your ${wc} account. Your best scores and friends come with you to every device, and you can race your friends in Fruit Dash.`)}
      <form class="acct-form" novalidate>
        ${field('username', 'Warden Chat username', 'text', `autocomplete="username" maxlength="${R.nameMax}" required`)}
        ${field('password', 'Password', 'password', 'autocomplete="current-password" maxlength="200" required')}
        <button type="button" class="acct-link acct-forgot" data-go="forgot">Forgot password?</button>
        ${errBox}
        <button type="submit" class="big-btn go acct-main">Sign in</button>
      </form>
      <p class="acct-foot">No Warden Chat account? <button type="button" class="acct-link" data-go="signup">Create one here</button></p>`,
    signup: () => `${head('Create an account')}
      <div class="wc-callout"><span class="wc-callout-icon" aria-hidden="true">💬</span><span>This creates a <b>Warden Chat</b> account. Use the same username and password here, in Brain Rocket, and to chat at ${chatLink(esc(chatHost))}.</span></div>
      <form class="acct-form" novalidate>
        ${field('username', 'Username', 'text', `autocomplete="username" maxlength="${R.nameMax}" required`, `${R.nameMin}–${R.nameMax} letters, numbers, dots, dashes or underscores. It can't be changed later.`)}
        ${field('password', 'Password', 'password', 'autocomplete="new-password" maxlength="200" required', PW_RULE)}
        ${field('confirm', 'Type the password again', 'password', 'autocomplete="new-password" maxlength="200" required')}
        <p class="acct-warn">⚠️ Warden Chat doesn't use email, so a forgotten password can't be reset. Keep it somewhere safe.</p>
        ${errBox}
        <button type="submit" class="big-btn go acct-main">Create Warden Chat account</button>
      </form>
      <p class="acct-foot">Already on Warden Chat? <button type="button" class="acct-link" data-go="signin">Sign in</button></p>`,
    forgot: () => `${head('Forgot your password?')}
      <div class="acct-big-icon" aria-hidden="true">🔑</div>
      <p class="acct-msg">Warden Chat accounts don't have an email address, so a forgotten password can't be reset.</p>
      <p class="acct-msg">Still signed in to ${chatLink('Warden Chat')} somewhere? You can change it there. If not, you can make a new account, and the scores on this device come with it.</p>
      <div class="acct-btns"><button type="button" class="big-btn quiet" data-go="signup">New account</button><button type="button" class="big-btn" data-go="signin">Back to sign in</button></div>`,
    profile: () => {
      const u = Account.user, [cls] = SYNC_TEXT[Account.sync], f = Account.friends, b = bestsOf();
      const saved = Object.values(b).reduce((s, m) => s + Object.values(m || {}).filter(v => v > 0).length, 0);
      const nf = f ? f.friends.length : 0, req = f ? f.incoming.length : 0;
      return `${head('Your account')}
        <div class="acct-who">${avatar(u.username, 'big')}
          <span class="acct-who-text"><b>${esc(u.username)}</b>${wc}</span></div>
        <div class="acct-sync ${cls}"><span class="acct-dot" aria-hidden="true"></span><span class="acct-sync-text">${esc(syncLine())}</span>
          <button type="button" class="acct-link" data-act="sync"${Account.sync === 'syncing' ? ' disabled' : ''}>Sync now</button></div>
        <div class="acct-stats">
          <div class="stat"><b>${saved}</b><span>Best scores saved</span></div>
          <div class="stat"><b>${topOf(b, 'classic') ? n(topOf(b, 'classic')) : '–'}</b><span>🎈 Classic best</span></div>
          <div class="stat"><b>${topOf(b, 'race') ? n(topOf(b, 'race')) : '–'}</b><span>🏃 Fruit Dash best</span></div>
        </div>
        <div class="acct-btns"><button type="button" class="big-btn acct-friends-btn" data-go="friends">👥 Friends${f ? ` (${nf})` : ''}${req ? `<span class="acct-badge">${req}</span>` : ''}</button><button type="button" class="big-btn quiet" data-go="signout">Sign out</button></div>
        <p class="acct-foot small">To change your picture or password, or delete your account, go to ${chatLink('Warden Chat')}.</p>`;
    },
    signout: () => `${head('Sign out?', 'Your best scores stay saved to your account. Warden Chat stays signed in.')}
      <label class="acct-check"><input type="checkbox" name="clear"> <span>Also remove them from this device<small>Pick this on a shared or school computer.</small></span></label>
      ${errBox}
      <div class="acct-btns"><button type="button" class="big-btn" data-act="signout">Sign out</button><button type="button" class="big-btn quiet" data-go="profile">Cancel</button></div>`,
    friends: () => `${head('Friends', 'Race them in Fruit Dash and see their best scores. Add them by their Warden Chat username. Friends from Brain Rocket are here too.')}
      <form class="acct-form fr-add" novalidate>
        <span class="af-wrap"><input class="af-input" name="friend" type="text" maxlength="${R.nameMax}" placeholder="Their Warden Chat username" aria-label="Friend's Warden Chat username" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"></span>
        <button type="submit" class="big-btn go acct-main fr-send">Add</button>
      </form>
      ${errBox}
      <div class="fr-lists">${friendLists()}</div>
      <p class="acct-foot"><button type="button" class="acct-link" data-go="profile">← Your account</button></p>`
  };

  function friendLists() {
    const f = Account.friends;
    if (!f) return '<p class="fr-empty">Loading your friends…</p>';
    const rows = [];
    if (f.incoming.length) {
      rows.push(`<h3 class="fr-h">Friend requests <span class="acct-badge">${f.incoming.length}</span></h3>`);
      f.incoming.forEach(r => rows.push(`<div class="fr-row req">${avatar(r.username)}<span class="fr-name"><b>${esc(r.username)}</b><small>wants to be friends</small></span>
        <button type="button" class="fr-btn yes" data-fr="accept" data-id="${esc(r.request_id)}" data-name="${esc(r.username)}">Accept</button>
        <button type="button" class="fr-btn" data-fr="decline" data-id="${esc(r.request_id)}" data-name="${esc(r.username)}">Decline</button></div>`));
    }
    rows.push(`<h3 class="fr-h">Your friends${f.friends.length ? ` (${f.friends.length})` : ''}</h3>`);
    if (!f.friends.length) rows.push('<p class="fr-empty">No friends yet. Type a friend\'s Warden Chat username above and they\'ll get a request the next time they open Apples to Oranges or Brain Rocket.</p>');
    [...f.friends].sort((a, b) => topOf(b.bests, 'classic') - topOf(a.bests, 'classic') || a.username.localeCompare(b.username)).forEach(x => rows.push(
      `<div class="fr-row">${avatar(x.username)}<span class="fr-name"><b>${esc(x.username)}</b><small>${friendLine(x)}</small></span>
        <button type="button" class="fr-btn subtle" data-fr="remove" data-id="${esc(x.user_id)}" data-name="${esc(x.username)}">Remove</button></div>`));
    if (f.outgoing.length) {
      rows.push('<h3 class="fr-h">Waiting for them to accept</h3>');
      f.outgoing.forEach(r => rows.push(`<div class="fr-row out">${avatar(r.username)}<span class="fr-name"><b>${esc(r.username)}</b><small>Request sent</small></span>
        <button type="button" class="fr-btn subtle" data-fr="cancel" data-id="${esc(r.request_id)}" data-name="${esc(r.username)}">Cancel</button></div>`));
    }
    return rows.join('');
  }

  // ---- Checking boxes before sending -------------------------------------------------
  function checkName(v) {
    if (!v) return 'Choose a username.';
    if (v.length < R.nameMin || v.length > R.nameMax) return `Usernames are ${R.nameMin}–${R.nameMax} characters.`;
    if (!R.nameRe.test(v)) return 'Use only letters, numbers, dots, dashes and underscores (no spaces).';
    if (!/[a-zA-Z0-9]/.test(v)) return 'Include at least one letter or number.';
    return '';
  }
  function checkPassword(v) {
    if (!v) return 'Choose a password.';
    if (v.length < R.passwordMin) return `Use at least ${R.passwordMin} characters.`;
    const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(re => re.test(v)).length;
    return kinds < 2 ? 'Mix at least two of: lowercase, uppercase, numbers, symbols.' : '';
  }
  const CHECKS = {
    signin: v => [['username', v.username ? '' : 'Enter your Warden Chat username.'], ['password', v.password ? '' : 'Enter your password.']],
    signup: v => [['username', checkName(v.username)], ['password', checkPassword(v.password)], ['confirm', v.confirm === v.password ? '' : "The two passwords don't match."]],
    friends: v => [['friend', v.friend ? '' : "Type your friend's Warden Chat username."]]
  };

  // ---- Opening, switching and closing -----------------------------------------------
  let view = null, busy = false, returnFocus = null, friendTimer = 0;
  function open(v, o) {
    o = o || {};
    if (modal.classList.contains('hidden')) returnFocus = document.activeElement;
    view = v; busy = false;
    box.innerHTML = VIEWS[v](o);
    box.className = 'modal-box acct-box acct-' + v;
    modal.classList.remove('hidden');
    wire();
    // on touch screens, don't jump straight into a text box: that pops the keyboard over half the game
    const touch = matchMedia('(pointer: coarse)').matches;
    const first = (!touch && box.querySelector('.af-input')) || box.querySelector('.acct-main, .big-btn');
    if (first && !o.noFocus) setTimeout(() => first.focus({ preventScroll: true }), 30);
    if (o.message) setError(o.message, true);
    clearInterval(friendTimer);
    if (v === 'friends' || v === 'profile') {
      Account.loadFriends();
      if (v === 'friends') friendTimer = setInterval(() => Account.loadFriends(), 30000);
    }
  }
  function close() {
    if (busy) return;
    clearInterval(friendTimer);
    modal.classList.add('hidden'); view = null;
    if (returnFocus && document.contains(returnFocus) && returnFocus.offsetParent !== null) returnFocus.focus();
  }
  const isOpen = () => !modal.classList.contains('hidden');

  function setError(html, info) {
    const b = box.querySelector('.af-error');
    if (b) { b.innerHTML = html || ''; b.classList.toggle('info', !!info); }
  }
  function setBusy(on, label, btn) {
    busy = on;
    box.querySelectorAll('input, button').forEach(x => { x.disabled = on; });
    const m = btn || box.querySelector('.acct-main, [data-act="signout"]');
    if (m) { if (on) { m.dataset.label = m.innerHTML; m.textContent = label || 'Please wait…'; } else if (m.dataset.label) m.innerHTML = m.dataset.label; }
    box.classList.toggle('busy', on);
  }
  function fail(e, name) {
    setBusy(false);
    setError(errorText(e, name));
    const f = errorField(e), inp = f && box.querySelector(`[name="${f}"]`);
    if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); if (inp.select) inp.select(); }
  }
  function values() {
    const out = {};
    box.querySelectorAll('.af-input').forEach(i => { out[i.name] = /password|confirm/.test(i.name) ? i.value : i.value.trim(); });
    return out;
  }
  function validate(v) {
    for (const [k, msg] of CHECKS[view](v)) {
      if (!msg) continue;
      setError(esc(msg));
      const i = box.querySelector(`[name="${k}"]`); i.setAttribute('aria-invalid', 'true'); i.focus();
      return false;
    }
    return true;
  }

  const SUBMIT = {
    signin(v) {
      setBusy(true, 'Signing in…');
      return Account.signIn(v.username, v.password).then(r => {
        setBusy(false); close();
        if (r.restricted) return;   // the banned screen takes over
        toast(r.synced ? `✅ Signed in as <b>${esc(r.user.username)}</b>. Your best scores are synced.` : `Signed in as <b>${esc(r.user.username)}</b>. Your scores will sync when they can.`, r.synced ? 'good' : '');
      }, e => fail(e));
    },
    signup(v) {
      setBusy(true, 'Creating account…');
      return Account.signUp(v.username, v.password).then(r => {
        setBusy(false); close();
        toast(`🎉 Welcome, <b>${esc(r.user.username)}</b>! Your best scores are saved to your new Warden Chat account.`, 'good');
      }, e => fail(e));
    },
    friends(v) {
      const name = v.friend, btn = box.querySelector('.fr-send');
      setBusy(true, 'Sending…', btn);
      return Account.addFriend(name).then(r => {
        setBusy(false); renderFriends();
        box.querySelector('[name="friend"]').value = '';
        setError(r && r.status === 'accepted' ? `🎉 <b>${esc(name)}</b> had already asked you, so you're friends now!` : `✅ Friend request sent to <b>${esc(name)}</b>.`, true);
        box.querySelector('[name="friend"]').focus();
      }, e => { fail(e, name); const i = box.querySelector('[name="friend"]'); i.setAttribute('aria-invalid', 'true'); i.focus(); });
    }
  };

  function wire() {
    const form = box.querySelector('form');
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      if (busy) return;
      click();
      box.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
      setError('');
      const v = values();
      if (validate(v)) SUBMIT[view](v);
    });
    box.querySelectorAll('.af-input').forEach(i => i.addEventListener('input', () => { i.removeAttribute('aria-invalid'); }));
    box.querySelectorAll('.af-eye').forEach(b => b.addEventListener('click', () => {
      const i = b.previousElementSibling, show = i.type === 'password';
      i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show';
      b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      i.focus();
    }));
    box.querySelector('.acct-x').addEventListener('click', () => { click(); close(); });
  }
  // Links that switch views, and the buttons that do something, are handled for the whole dialog.
  const FRIEND_ACTS = {
    accept: (id, name) => Account.answerFriend(id, true).then(() => `🎉 You and <b>${esc(name)}</b> are friends now.`),
    decline: id => Account.answerFriend(id, false).then(() => 'Request declined.'),
    cancel: id => Account.cancelFriend(id).then(() => 'Request cancelled.'),
    remove: (id, name) => Account.removeFriend(id).then(() => `Removed <b>${esc(name)}</b> from your friends.`)
  };
  box.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'), act = e.target.closest('[data-act]'), fr = e.target.closest('[data-fr]');
    if (busy) return;
    if (go) { click(); open(go.dataset.go); }
    else if (act && act.dataset.act === 'sync') { click(); Account.syncNow(); }
    else if (act && act.dataset.act === 'signout') {
      click();
      const clear = box.querySelector('[name="clear"]').checked;
      setBusy(true, 'Signing out…');
      Account.signOut(clear).then(() => { setBusy(false); close(); toast(clear ? 'Signed out. Your scores were removed from this device.' : 'Signed out. Your scores are still on this device.'); });
    } else if (fr) {
      click();
      const { fr: what, id, name } = fr.dataset;
      // removing a friend asks first: the button turns into "Sure?"
      if (what === 'remove' && !fr.classList.contains('confirm')) {
        fr.classList.add('confirm'); fr.textContent = 'Sure?';
        setTimeout(() => { if (fr.isConnected) { fr.classList.remove('confirm'); fr.textContent = 'Remove'; } }, 4000);
        return;
      }
      setBusy(true, '…', fr);
      FRIEND_ACTS[what](id, name).then(msg => { setBusy(false); renderFriends(); setError(msg, true); }, err => { setBusy(false); renderFriends(); setError(errorText(err, name)); });
    }
  });
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  // Escape closes the dialog wherever the focus is, before the game sees it
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } }, true);
  // typing in the dialog shouldn't also play the game (←/→ switch tabs on the home screen)
  modal.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key !== 'Tab') return;
    // keep Tab inside the dialog
    const f = [...box.querySelectorAll('input, button, [href]')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---- Keeping everything up to date ---------------------------------------------------
  function renderChip() {
    const s = Account.status;
    if (s === 'restricted') {
      const u = Account.user.username, word = Account.restriction.status === 'banned' ? 'Banned' : 'Suspended';
      chip.className = 'acct-chip in restricted';
      chip.innerHTML = `${avatar(u)}<span class="acct-chip-name">${esc(u)}</span><span class="acct-ban-tag">${word}</span>`;
      chip.title = `${u} · account ${word.toLowerCase()} on Warden Chat`;
      chip.setAttribute('aria-label', `Your account, ${u}, is ${word.toLowerCase()}`);
    } else if (s === 'signedIn') {
      const [cls] = SYNC_TEXT[Account.sync], u = Account.user.username, req = Account.friends ? Account.friends.incoming.length : 0;
      chip.className = 'acct-chip in ' + cls;
      chip.innerHTML = `${avatar(u)}<span class="acct-chip-name">${esc(u)}</span><span class="acct-dot" aria-hidden="true"></span>${req ? `<span class="acct-badge" title="${req} friend request${req === 1 ? '' : 's'}">${req}</span>` : ''}`;
      chip.title = `${u} · ${syncLine()}${req ? ` · ${req} friend request${req === 1 ? '' : 's'}` : ''}`;
      chip.setAttribute('aria-label', `Your account, ${u}. ${syncLine()}${req ? `. ${req} friend request${req === 1 ? '' : 's'}` : ''}`);
    } else if (s === 'signedOut') {
      chip.className = 'acct-chip';
      chip.innerHTML = '<span class="acct-chip-icon" aria-hidden="true">👤</span><span class="acct-chip-name">Sign in</span>';
      chip.title = 'Sign in with your Warden Chat account';
      chip.setAttribute('aria-label', 'Sign in with your Warden Chat account');
    } else chip.className = 'acct-chip hidden';
  }
  // the results screen says which mode it was (game.js sets data-mode and data-diff on #over)
  const overShown = () => !$('over').classList.contains('hidden');
  const overIsRace = () => $('over').dataset.race === '1';
  function renderNote() {
    const s = Account.status;
    note.className = 'acct-note' + (s === 'unavailable' || s === 'checking' || s === 'restricted' || overIsRace() ? ' hidden' : '');
    if (s === 'signedOut') note.innerHTML = '<button type="button" class="acct-link" data-open="signin">Sign in with Warden Chat</button> to keep your best scores on every device.';
    else if (s === 'signedIn') {
      const u = esc(Account.user.username);
      note.className += ' ' + SYNC_TEXT[Account.sync][0];
      note.innerHTML = {
        syncing: '☁️ Saving to your account…', pending: '☁️ Saving to your account…', idle: '☁️ Saving to your account…', synced: `☁️ Saved to <b>${u}</b>'s account`,
        offline: "⚠️ You're offline. Saved on this device; it will sync later.", error: "⚠️ Couldn't save to your account yet. We'll keep trying."
      }[Account.sync];
    }
  }
  // Your friends' bests on the same mode and difficulty, on the results screen: the top three, plus you.
  function renderBoard() {
    const mode = $('over').dataset.mode, diff = $('over').dataset.diff;
    const show = Account.status === 'signedIn' && overShown() && !overIsRace() && !!mode;
    board.classList.toggle('hidden', !show);
    if (!show) return;
    const f = Account.friends, label = `${MODE_NAME[mode] || mode} · ${DIFF_NAME[diff] || diff}`;
    if (!f) { board.innerHTML = `<div class="acct-board-h">👥 Friends' bests · ${esc(label)}</div><p class="fr-empty">Loading…</p>`; return; }
    if (!f.friends.length) { board.innerHTML = '<button type="button" class="acct-link" data-open="friends">👥 Add friends</button> to see their best scores here.'; return; }
    const mine = (bestsOf()[mode] || {})[diff] || 0;
    const rows = f.friends.map(x => ({ name: x.username, s: ((x.bests || {})[mode] || {})[diff] || 0 })).concat([{ name: Account.user.username, s: mine, me: true }]);
    rows.sort((a, b) => b.s - a.s);
    const medal = ['🥇', '🥈', '🥉'];
    const shown = rows.slice(0, 3);
    if (!shown.some(r => r.me)) shown.push(rows.find(r => r.me));
    board.innerHTML = `<div class="acct-board-h">👥 Friends' bests · ${esc(label)}</div>` + shown.map(r => {
      const i = rows.indexOf(r);
      return `<div class="acct-board-row${r.me ? ' me' : ''}"><span class="ab-rank">${r.s > 0 ? medal[i] || i + 1 : '·'}</span>${avatar(r.name)}<span class="ab-name">${r.me ? 'You' : esc(r.name)}</span><span class="ab-score">${r.s > 0 ? n(r.s) : 'not yet'}</span></div>`;
    }).join('');
  }
  function renderFriends() {
    const lists = view === 'friends' && box.querySelector('.fr-lists');
    if (lists && !busy) lists.innerHTML = friendLists();
  }
  function refresh() {
    renderChip(); renderNote(); renderBoard(); renderFriends();
    if (view === 'profile' && !busy) {
      // update just the parts that change, so nothing jumps under the pointer
      const row = box.querySelector('.acct-sync');
      if (row) {
        row.className = 'acct-sync ' + SYNC_TEXT[Account.sync][0];
        row.querySelector('.acct-sync-text').textContent = syncLine();
        row.querySelector('[data-act="sync"]').disabled = Account.sync === 'syncing';
      }
      const fb = box.querySelector('.acct-friends-btn'), f = Account.friends;
      if (fb && f) fb.innerHTML = `👥 Friends (${f.friends.length})${f.incoming.length ? `<span class="acct-badge">${f.incoming.length}</span>` : ''}`;
    }
    if (Account.status !== 'signedIn' && ['profile', 'signout', 'friends'].includes(view) && !busy) close();
  }
  chip.addEventListener('click', () => { click(); if (Account.status === 'restricted') showBan(true); else open(Account.status === 'signedIn' ? 'profile' : 'signin'); });

  // ---- "You've been banned": an admin suspended or banned this account on Warden Chat ----------
  const ban = document.createElement('div');
  ban.id = 'acctBan'; ban.className = 'modal hidden';
  ban.innerHTML = '<div class="modal-box ban-box" role="alertdialog" aria-modal="true" aria-labelledby="banTitle" aria-describedby="banText"></div>';
  stage.appendChild(ban);
  const banBox = ban.firstChild;
  let banWanted = false;
  function renderBan() {
    const r = Account.restriction, u = Account.user;
    if (!r || !u) return;
    const banned = r.status === 'banned', deleting = r.status === 'deleting';
    const until = r.until ? new Date(r.until).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null;
    banBox.innerHTML = `
      <div class="ban-icon" aria-hidden="true">${deleting ? '🗑️' : '🚫'}</div>
      <h2 id="banTitle">${deleting ? 'Account being deleted' : banned ? 'You’ve been banned' : 'You’ve been suspended'}</h2>
      <p class="ban-text" id="banText">${deleting ? `Your Warden Chat account <b>${esc(u.username)}</b> is being deleted.`
        : `An admin has ${banned ? 'banned' : 'suspended'} your Warden Chat account <b>${esc(u.username)}</b>.`}</p>
      ${r.reason && !deleting ? `<div class="ban-reason"><span class="ban-label">Reason</span>${esc(r.reason)}</div>` : ''}
      <p class="ban-when">${deleting ? '' : banned ? 'This ban doesn’t end on its own.' : until ? `Until <b>${esc(until)}</b>.` : 'It lasts until an admin lifts it.'}</p>
      <p class="ban-what">While it’s ${deleting ? 'being deleted' : banned ? 'banned' : 'suspended'}, you can’t sync scores, use friends or race. You can still play Apples to Oranges as a guest.</p>
      <div class="acct-btns"><button type="button" class="big-btn" data-ban="guest">Sign out and play as a guest</button>${banned || deleting ? '' : '<button type="button" class="big-btn quiet" data-ban="check">↻ Check again</button>'}</div>
      <p class="ban-msg" role="status"></p>`;
  }
  // Mid-game it waits for the results or the home screen, so nobody loses a run to it.
  const calm = () => typeof A2OGame === 'undefined' || ['title', 'over', 'paused'].includes(A2OGame.state);
  function showBan(force) {
    banWanted = true;
    if (!force && !calm()) return;
    close(); renderBan();
    ban.classList.remove('hidden');
    setTimeout(() => { const b = banBox.querySelector('.big-btn'); if (b) b.focus(); }, 30);
  }
  function hideBan() { banWanted = false; ban.classList.add('hidden'); }
  setInterval(() => { if (banWanted && ban.classList.contains('hidden') && Account.status === 'restricted' && calm()) showBan(); }, 500);
  banBox.addEventListener('click', e => {
    const b = e.target.closest('[data-ban]');
    if (!b || b.disabled) return;
    click();
    const msg = banBox.querySelector('.ban-msg');
    banBox.querySelectorAll('button').forEach(x => { x.disabled = true; });
    if (b.dataset.ban === 'guest') {
      Account.signOut(false).then(() => { hideBan(); toast('Signed out. You’re playing as a guest.'); });
    } else {
      msg.textContent = 'Checking…';
      Account.recheck().then(state => {
        if (state === 'restricted') { renderBan(); banBox.querySelector('.ban-msg').textContent = 'Still ' + (Account.restriction.status === 'banned' ? 'banned' : 'suspended') + '.'; }
        else { hideBan(); toast('✅ Your account is back. Welcome back!', 'good'); }
      }, () => { banBox.querySelectorAll('button').forEach(x => { x.disabled = false; }); msg.textContent = "Couldn't check right now. Try again in a moment."; });
    }
  });
  // there's no getting past it except the two buttons (Escape and clicks outside do nothing)
  ban.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key !== 'Tab') return;
    const f = [...banBox.querySelectorAll('button')].filter(x => !x.disabled);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  Account.onRestricted(() => showBan());
  Account.on(() => { if (Account.status !== 'restricted' && banWanted) hideBan(); });
  [note, board, toastEl].forEach(x => x.addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (o) { click(); toastEl.className = 'acct-toast'; open(o.dataset.open); }
  }));
  // the results screen: fetch friends' bests when it appears
  new MutationObserver(() => { if (overShown()) { renderNote(); renderBoard(); Account.loadFriends(); } else renderBoard(); }).observe($('over'), { attributes: true, attributeFilter: ['class'] });
  // new friend requests turn up on the home screen without a reload
  setInterval(() => { if (Account.status === 'signedIn' && !document.hidden) { if (Account.sync === 'synced') refresh(); Account.loadFriends(); } }, 120000);

  Account.on(refresh);
  Account.onExpired(() => toast('You were signed out. <button type="button" class="acct-link" data-open="signin">Sign in again</button> to keep syncing.', 'warn'));
  Account.init().then(refresh);
  return { open, close, isOpen, toast, avatar };
})();
