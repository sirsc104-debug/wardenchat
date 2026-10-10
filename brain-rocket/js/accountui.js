/* Brain Rocket — the account screens. The Sign in / profile button on the home screen; the account
   dialog (sign in with Warden Chat, create a Warden Chat account, the profile with its sync status,
   friends, signing out); the little notices that pop up; and, on the results screen, whether the
   score is saved to your account and how your friends did in today's Bullseye.
   Talks only to Account (js/account.js). Passwords are changed, and accounts deleted, on Warden Chat. */
'use strict';

const AccountUI = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R = Account.RULES;
  const chatUrl = Account.CONFIG.chatUrl, chatHost = chatUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const chatLink = text => `<a class="acct-link nowrap" href="${esc(chatUrl)}" target="_blank" rel="noopener">${text}&nbsp;↗</a>`;
  const click = () => { if (typeof Sound !== 'undefined') Sound.click(); };
  const n = v => Number(v || 0).toLocaleString();

  // ---- Pieces that live in the page --------------------------------------------
  const stage = $('stage');
  const chip = document.createElement('button');
  chip.type = 'button'; chip.id = 'acctChip'; chip.className = 'acct-chip hidden';
  $('title').appendChild(chip);

  const modal = document.createElement('div');
  modal.id = 'acct'; modal.className = 'screen hidden';
  modal.innerHTML = '<div class="dialog acct-dialog" role="dialog" aria-modal="true" aria-labelledby="acctTitle"></div>';
  stage.appendChild(modal);
  const box = modal.firstChild;

  const toastEl = document.createElement('div');
  toastEl.id = 'acctToast'; toastEl.className = 'acct-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
  stage.appendChild(toastEl);

  // on the results screen: friends' Bullseye scores, then the "saved to your account" line
  const overDialog = document.querySelector('#over .dialog');
  const board = document.createElement('div');
  board.id = 'overFriends'; board.className = 'acct-board hidden';
  const note = document.createElement('div');
  note.id = 'overAcct'; note.className = 'acct-note hidden';
  overDialog.insertBefore(board, overDialog.querySelector('.dialog-btns'));
  overDialog.insertBefore(note, overDialog.querySelector('.dialog-btns'));

  // ---- Little notices --------------------------------------------------------
  let toastTimer = 0;
  function toast(html, kind) {
    toastEl.innerHTML = html;
    toastEl.className = 'acct-toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'acct-toast'; }, 4500);
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
    pending: ['syncing', 'Saving your latest progress…'],
    synced: ['synced', null],
    offline: ['offline', "You're offline. Your progress is saved on this device and will sync when you're back online."],
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
      case 'rate_limited': case 'br_rate_limited': return 'Too many tries. Wait a minute, then try again.';
      case 'offline': return "Can't reach the server. Check your connection and try again.";
      case 'br_user_not_found': return `There's no Warden Chat account called ${who}. Check the spelling.`;
      case 'br_self': return "That's you! Add someone else's username.";
      case 'br_already_friends': return `You're already friends with ${who}.`;
      case 'br_already_requested': return `You've already sent ${who} a friend request.`;
      case 'br_too_many': return "You've reached the friend limit.";
      case 'br_request_not_found': return 'That request is no longer there.';
      default: return 'Something went wrong on our side. Try again in a moment.';
    }
  }
  const errorField = e => ({ bad_credentials: 'password', username_taken: 'username', weak_password: 'password', signup_rejected: 'username' }[e.code]);
  function todayText(t) {
    if (!t) return '<span class="fr-none">No Bullseye yet today</span>';
    if (!t.done) return '🎯 Playing now…';
    if (t.crashed) return '💥 0 today';
    return `🎯 <b>${n(t.score)}</b> today${t.bulls ? ` · ${t.bulls} bullseye${t.bulls === 1 ? '' : 's'}` : ''}`;
  }
  const avatar = (name, cls) => ProfilePictures.html(name, cls);

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
    signin: () => `${head('Sign in', `Use your ${wc} account. Your best scores, Bullseye streak and friends come with you to every device.`)}
      <form class="acct-form" novalidate>
        ${field('username', 'Warden Chat username', 'text', `autocomplete="username" maxlength="${R.nameMax}" required`)}
        ${field('password', 'Password', 'password', 'autocomplete="current-password" maxlength="200" required')}
        <button type="button" class="acct-link acct-forgot" data-go="forgot">Forgot password?</button>
        ${errBox}
        <button type="submit" class="big-btn acct-main">Sign in</button>
      </form>
      <p class="acct-foot">No Warden Chat account? <button type="button" class="acct-link" data-go="signup">Create one here</button></p>`,
    signup: () => `${head('Create an account')}
      <div class="wc-callout"><span class="wc-callout-icon" aria-hidden="true">💬</span><span>This creates a <b>Warden Chat</b> account. Use the same username and password to sign in to Brain Rocket and to chat at ${chatLink(esc(chatHost))}.</span></div>
      <form class="acct-form" novalidate>
        ${field('username', 'Username', 'text', `autocomplete="username" maxlength="${R.nameMax}" required`, `${R.nameMin}–${R.nameMax} letters, numbers, dots, dashes or underscores. It can't be changed later.`)}
        ${field('password', 'Password', 'password', 'autocomplete="new-password" maxlength="200" required', PW_RULE)}
        ${field('confirm', 'Type the password again', 'password', 'autocomplete="new-password" maxlength="200" required')}
        <p class="acct-warn">⚠️ Warden Chat doesn't use email, so a forgotten password can't be reset. Keep it somewhere safe.</p>
        ${errBox}
        <button type="submit" class="big-btn acct-main">Create Warden Chat account</button>
      </form>
      <p class="acct-foot">Already on Warden Chat? <button type="button" class="acct-link" data-go="signin">Sign in</button></p>`,
    forgot: () => `${head('Forgot your password?')}
      <div class="acct-big-icon" aria-hidden="true">🔑</div>
      <p class="acct-msg">Warden Chat accounts don't have an email address, so a forgotten password can't be reset.</p>
      <p class="acct-msg">Still signed in to ${chatLink('Warden Chat')} somewhere? You can change it there. If not, you can make a new account, and the progress on this device comes with it.</p>
      <div class="dialog-btns"><button type="button" class="big-btn ghost" data-go="signup">New account</button><button type="button" class="big-btn" data-go="signin">Back to sign in</button></div>`,
    profile: () => {
      const u = Account.user, [cls] = SYNC_TEXT[Account.sync], f = Account.friends;
      const st = typeof Daily !== 'undefined' ? Daily.streak() : 0, td = typeof Daily !== 'undefined' ? Daily.today() : null;
      let bests = {};
      try { bests = JSON.parse(localStorage.getItem('brainRocket.bests') || '{}') || {}; } catch (e) { /* none */ }
      const nf = f ? f.friends.length : 0, req = f ? f.incoming.length : 0;
      return `${head('Your account')}
        <div class="acct-who">${avatar(u.username, 'big')}
          <span class="acct-who-text"><b>${esc(u.username)}</b>${wc}</span></div>
        <div class="acct-sync ${cls}"><span class="acct-dot" aria-hidden="true"></span><span class="acct-sync-text">${esc(syncLine())}</span>
          <button type="button" class="acct-link" data-act="sync"${Account.sync === 'syncing' ? ' disabled' : ''}>Sync now</button></div>
        <div class="stats acct-stats">
          <div class="stat"><div class="s-label">Best scores saved</div><div class="s-value">${Object.keys(bests).length}</div></div>
          <div class="stat"><div class="s-label">Bullseye streak</div><div class="s-value">${st} 🔥</div></div>
          <div class="stat"><div class="s-label">Today's Bullseye</div><div class="s-value">${td && td.done ? n(td.crashed ? 0 : td.score) : '—'}</div></div>
        </div>
        <div class="dialog-btns"><button type="button" class="big-btn ghost acct-friends-btn" data-go="friends">👥 Friends${f ? ` (${nf})` : ''}${req ? `<span class="acct-badge">${req}</span>` : ''}</button><button type="button" class="big-btn" data-go="signout">Sign out</button></div>
        <p class="acct-foot small">To change your picture or password, or delete your account, go to ${chatLink('Warden Chat')}.</p>`;
    },
    signout: () => `${head('Sign out?', 'Your progress stays saved to your account. Warden Chat stays signed in.')}
      <label class="acct-check"><input type="checkbox" name="clear"> <span>Also remove it from this device<small>Pick this on a shared or school computer.</small></span></label>
      ${errBox}
      <div class="dialog-btns"><button type="button" class="big-btn" data-act="signout">Sign out</button><button type="button" class="big-btn ghost" data-go="profile">Cancel</button></div>`,
    friends: () => `${head('Friends', 'See how your friends do in today\'s Bullseye. Add them by their Warden Chat username.')}
      <form class="acct-form fr-add" novalidate>
        <span class="af-wrap"><input class="af-input" name="friend" type="text" maxlength="${R.nameMax}" placeholder="Their Warden Chat username" aria-label="Friend's Warden Chat username" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"></span>
        <button type="submit" class="big-btn acct-main fr-send">Add</button>
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
    if (!f.friends.length) rows.push('<p class="fr-empty">No friends yet. Type a friend\'s Warden Chat username above and they\'ll get a request the next time they open Brain Rocket.</p>');
    const score = x => (x.today && x.today.done && !x.today.crashed ? x.today.score : -1);
    [...f.friends].sort((a, b) => score(b) - score(a) || a.username.localeCompare(b.username)).forEach(x => rows.push(
      `<div class="fr-row">${avatar(x.username)}<span class="fr-name"><b>${esc(x.username)}</b><small>${todayText(x.today)}${x.streak ? ` · 🔥 ${x.streak}` : ''}</small></span>
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
    if (typeof BadWords !== 'undefined' && BadWords.test(v)) return 'Pick a different username.';
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
    box.className = 'dialog acct-dialog acct-' + v;
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
        toast(r.synced ? `✅ Signed in as <b>${esc(r.user.username)}</b>. Your progress is synced.` : `Signed in as <b>${esc(r.user.username)}</b>. Your progress will sync when it can.`, r.synced ? 'good' : '');
      }, e => fail(e));
    },
    signup(v) {
      setBusy(true, 'Creating account…');
      return Account.signUp(v.username, v.password).then(r => {
        setBusy(false); close();
        toast(`🎉 Welcome, <b>${esc(r.user.username)}</b>! Your progress is saved to your new Warden Chat account.`, 'good');
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
      Account.signOut(clear).then(() => { setBusy(false); close(); toast(clear ? 'Signed out. Progress was removed from this device.' : 'Signed out. Your progress is still on this device.'); });
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
  modal.addEventListener('keydown', e => {
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
  function renderNote() {
    const s = Account.status;
    note.className = 'acct-note' + (s === 'unavailable' || s === 'checking' || s === 'restricted' ? ' hidden' : '');
    if (s === 'signedOut') note.innerHTML = '<button type="button" class="acct-link" data-open="signin">Sign in with Warden Chat</button> to keep your scores on every device.';
    else if (s === 'signedIn') {
      const u = esc(Account.user.username);
      note.className = 'acct-note ' + SYNC_TEXT[Account.sync][0];
      note.innerHTML = {
        syncing: '☁️ Saving to your account…', pending: '☁️ Saving to your account…', idle: '☁️ Saving to your account…', synced: `☁️ Saved to <b>${u}</b>'s account`,
        offline: "⚠️ You're offline. Saved on this device; it will sync later.", error: "⚠️ Couldn't save to your account yet. We'll keep trying."
      }[Account.sync];
    }
  }
  // Today's Bullseye on the results screen: you and your friends, best first.
  const isDailyOver = () => !$('over').classList.contains('hidden') && !!$('overStats').querySelector('.daily-grid-stat');
  function renderBoard() {
    const show = Account.status === 'signedIn' && isDailyOver();
    board.classList.toggle('hidden', !show);
    if (!show) return;
    const f = Account.friends, me = typeof Daily !== 'undefined' ? Daily.today() : null;
    if (!f) { board.innerHTML = '<div class="acct-board-h">👥 Friends today</div><p class="fr-empty">Loading…</p>'; return; }
    if (!f.friends.length) { board.innerHTML = '<button type="button" class="acct-link" data-open="friends">👥 Add friends</button> to see their Bullseye scores here.'; return; }
    const rows = f.friends.map(x => ({ name: x.username, t: x.today })).concat([{ name: Account.user.username, t: me && { done: me.done, crashed: me.crashed, score: me.score, bulls: (me.marks || []).filter(m => m === 0).length }, me: true }]);
    const score = r => (r.t && r.t.done ? (r.t.crashed ? 0 : r.t.score) : -1);
    rows.sort((a, b) => score(b) - score(a));
    const medal = ['🥇', '🥈', '🥉'];
    const shown = rows.slice(0, 3);     // the top three, plus you if you're further down
    if (!shown.some(r => r.me)) shown.push(rows.find(r => r.me));
    board.innerHTML = '<div class="acct-board-h">👥 Friends today</div>' + shown.map(r => {
      const i = rows.indexOf(r), s = score(r);
      return `<div class="acct-board-row${r.me ? ' me' : ''}"><span class="ab-rank">${s >= 0 ? medal[i] || i + 1 : '·'}</span><span class="ab-name">${r.me ? 'You' : esc(r.name)}</span><span class="ab-score">${s >= 0 ? n(s) : 'not yet'}</span></div>`;
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
  ban.id = 'acctBan'; ban.className = 'screen hidden';
  ban.innerHTML = '<div class="dialog ban-dialog" role="alertdialog" aria-modal="true" aria-labelledby="banTitle" aria-describedby="banText"></div>';
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
      <p class="ban-what">While it’s ${deleting ? 'being deleted' : banned ? 'banned' : 'suspended'}, you can’t sync progress, use friends or race. You can still play Brain Rocket as a guest.</p>
      <div class="dialog-btns"><button type="button" class="big-btn" data-ban="guest">Sign out and play as a guest</button>${banned || deleting ? '' : '<button type="button" class="big-btn ghost" data-ban="check">↻ Check again</button>'}</div>
      <p class="ban-msg" role="status"></p>`;
  }
  // Mid-game it waits for the results or the home screen, so nobody loses a run to it.
  const calm = () => typeof BRGame === 'undefined' || ['title', 'over', 'paused'].includes(BRGame.state);
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
    if (e.key === 'Escape') e.stopPropagation();
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
  // the results screen: fetch friends' scores when a Bullseye result appears
  new MutationObserver(() => { if (isDailyOver()) { renderBoard(); Account.loadFriends(); } else renderBoard(); }).observe($('over'), { attributes: true, attributeFilter: ['class'] });
  // new friend requests turn up on the home screen without a reload
  setInterval(() => { if (Account.status === 'signedIn' && !document.hidden) { if (Account.sync === 'synced') refresh(); Account.loadFriends(); } }, 120000);

  Account.on(refresh);
  Account.onExpired(() => toast('You were signed out. <button type="button" class="acct-link" data-open="signin">Sign in again</button> to keep syncing.', 'warn'));
  Account.init().then(refresh);
  return { open, close, isOpen, toast };
})();
