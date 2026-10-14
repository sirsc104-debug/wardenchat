/* Apples to Oranges — Fruit Dash, the live race. Every racer is a different fruit. A signed-in
   player hosts a race and gets a 6-character code; friends join by code or invite and pick their
   fruit in the lobby; the host starts it and everyone counts down together on the server's clock.
   Then 60 seconds of Classic higher or lower, with the same matchups in the same order for everyone
   (one shared seed), while the fruits dash across the kitchen. Highest score wins. Then a podium
   and a vote: if everyone still there votes to play again, the next round starts with new matchups.

   The server side is the a2o_race_* functions in RACES-API.md (Warden Chat's Supabase project); this
   file reaches them through Account.rpc. Browsers poll about every 1.5 seconds, which is plenty for
   a 60-second race. js/game.js plays the race itself (the A2OGame hooks); js/kitchen.js draws it.

   The Fruit Dash tab works without an account too: Practice solo is a 60-second dash on your own.
   Ported from Brain Rocket's js/race.js. */
'use strict';

const Race = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => Math.round(Number(v || 0)).toLocaleString('en-US');
  const click = () => { if (typeof Sound !== 'undefined') Sound.click(); };
  const avatar = name => AccountUI.avatar(name);
  const DIFFS = [['owen', '🧒 Owen'], ['medium', '🍓 Medium'], ['hard', '🍉 Hard'], ['ultra', '💀 Ultra']];
  const DIFF_NAME = Object.fromEntries(DIFFS);
  const DIFF_INFO = { owen: 'numbers 1.6× to 8× apart', medium: 'closer numbers · ×1.25 points', hard: 'really close numbers · ×1.5 points', ultra: 'always within 10 · ×1.75 points' };
  const LEN = 60, MAX = 8, POLL = 1500;
  const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  const FRUITS = Kitchen.FRUITS;
  const fruitOf = i => FRUITS[((i | 0) % FRUITS.length + FRUITS.length) % FRUITS.length];
  const tidy = s => String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  const describe = r => `🏃 Fruit Dash · ${DIFF_NAME[r.diff] || r.diff} · ${r.len || LEN} seconds`;
  const ordinal = i => (i === 1 ? '1st' : i === 2 ? '2nd' : i === 3 ? '3rd' : i + 'th');
  const me = () => (Account.user ? Account.user.id : null);

  let host = { diff: 'medium' };
  try { const h = JSON.parse(localStorage.getItem('a2o.raceHost')); if (h && DIFF_NAME[h.diff]) host = h; } catch (e) { /* first time */ }
  // your favourite fruit: what you run as in Practice, and what you ask for in a race lobby
  let fav = 0;
  try { const f = +localStorage.getItem('a2o.fruit'); if (f >= 0 && f < FRUITS.length) fav = f; } catch (e) { /* first time */ }
  const saveFav = () => { try { localStorage.setItem('a2o.fruit', String(fav)); } catch (e) { /* ignore */ } };

  let race = null;        // the latest race state from the server
  let phase = 'none';     // none | lobby | starting | racing | results
  let offset = 0, bestRtt = Infinity;      // server clock minus this computer's clock, in ms
  let pollTimer = 0, lastSent = -1, myResult = null, busy = false, round = 0, voted = false, fruitAsked = false;
  const picked = new Set();     // friends ticked on the host card, invited as the race is made
  let invites = [], invitesState = 'unknown', panelMsg = { text: '', kind: '' };
  const toasted = new Set(), invitedNow = new Set();

  // ---- Calling the server ------------------------------------------------------
  // Every reply carries server_now; the quickest round trips set the clock offset, so everyone's
  // countdown ends on the same instant.
  function call(fn, params) {
    const t0 = Date.now();
    return Account.rpc(fn, params).then(r => {
      const t1 = Date.now(), rtt = t1 - t0;
      if (r && r.server_now && rtt <= bestRtt + 40) { offset = Date.parse(r.server_now) - (t0 + t1) / 2; bestRtt = Math.min(bestRtt, rtt); }
      return r;
    });
  }
  function errText(e) {
    switch (e && e.code) {
      case 'a2o_race_not_found': return 'No open race has that code. Check it with your friend.';
      case 'a2o_race_started': return 'That race has already started.';
      case 'a2o_race_closed': return 'That race is over.';
      case 'a2o_race_full': return `That race is full (${MAX} fruits).`;
      case 'a2o_fruit_taken': return 'Someone else just took that fruit. Pick another one!';
      case 'a2o_not_friends': return 'You can only invite friends.';
      case 'a2o_not_host': return 'Only the host can start the race.';
      case 'a2o_need_players': return 'You need at least one more racer.';
      case 'a2o_bad_race': return "That race setting isn't allowed.";
      case 'a2o_rate_limited': case 'rate_limited': return 'Too many tries. Wait a minute, then try again.';
      case 'offline': return "Can't reach the server. Check your connection.";
      case 'not_deployed': return 'Live races are being switched on. Try again soon.';
      case 'unauthorized': return 'Your sign-in ran out. Sign in again to race.';
      default: return 'Something went wrong. Try again in a moment.';
    }
  }
  const toast = (html, kind) => { if (typeof AccountUI !== 'undefined') AccountUI.toast(html, kind); };

  // ---- The Fruit Dash panel on the home screen -----------------------------------------
  // Left: join a race (or sign in). Right: pick a difficulty, then host a race or practise solo.
  const panel = $('racePanel');
  const gate = (icon, title, text, btns) => `<div class="rp-box rp-gate"><div class="rp-icon" aria-hidden="true">${icon}</div><h3>${title}</h3><p>${text}</p>${btns ? `<div class="rp-btns">${btns}</div>` : ''}</div>`;
  function leftBox() {
    const s = Account.status;
    if (s === 'checking') return gate('⏳', 'Connecting…', 'Getting the race server ready.');
    if (s === 'unavailable' || invitesState === 'not_deployed') return gate('🚧', 'Live races are almost here', 'Racing your friends needs the race server, and it isn’t switched on yet (or can’t be reached). Practise solo in the meantime!', '<button type="button" class="rp-btn" data-race="retry">↻ Check again</button>');
    if (s === 'restricted') return gate('🚫', 'Races are off for your account', `Your Warden Chat account is ${Account.restriction && Account.restriction.status === 'banned' ? 'banned' : 'suspended'}, so you can’t race right now.`);
    if (s === 'signedOut') return gate('🏁', 'Race your friends live', 'Up to 8 fruits, the same matchups at the same time, 60 seconds. Races need a <span class="wc-badge">💬 Warden Chat</span> account.',
      '<button type="button" class="rp-btn go" data-race="signin">Sign in</button><button type="button" class="rp-btn" data-race="signup">Create an account</button>');
    return `<form class="rp-box" id="raceJoinForm" autocomplete="off">
        <h3>🎟️ Join a race</h3>
        <div class="rp-join"><input id="raceCode" maxlength="9" placeholder="6-letter code" spellcheck="false" autocapitalize="characters" aria-label="Race code" aria-describedby="raceJoinMsg">
        <button type="submit" class="rp-btn go" id="raceJoin" disabled>🏁 Join</button></div>
        <div class="rp-msg ${panelMsg.kind}" id="raceJoinMsg" aria-live="polite">${esc(panelMsg.text || 'Type the code from your friend’s race lobby.')}</div>
        <div class="rp-invites" id="raceInvites"></div>
      </form>`;
  }
  function rightBox() {
    const signed = Account.status === 'signedIn' && invitesState !== 'not_deployed';
    const b = typeof A2OGame !== 'undefined' ? A2OGame.best('race', host.diff) : 0;
    return `<div class="rp-box">
        <h3>⏱️ 60-second dash <button type="button" class="rp-fruit" data-race="fruit" title="Change your fruit" aria-label="Your fruit: ${fruitOf(fav).name}. Change it">${fruitOf(fav).emoji}<span>${esc(fruitOf(fav).name)}</span> ▾</button></h3>
        <div class="rp-row" id="raceDiff" role="group" aria-label="Difficulty">${DIFFS.map(([v, label]) => `<button type="button" data-v="${v}" class="${v === host.diff ? 'active' : ''}" aria-pressed="${v === host.diff}">${label}</button>`).join('')}</div>
        <div class="rp-info">${esc(DIFF_INFO[host.diff])} · <b>${b ? 'Best: ' + n(b) : 'No best yet'}</b></div>
        ${signed ? `<div class="rp-pick" id="racePick">${pickList()}</div>` : ''}
        <div class="rp-btns">${signed ? `<button type="button" class="rp-btn go" data-race="create" title="You also get a 6-letter code for anyone else. Up to ${MAX} fruits.">🏁 Host a race</button>` : ''}<button type="button" class="rp-btn${signed ? '' : ' go'}" data-race="practice">▶ Practise solo</button></div>
      </div>`;
  }
  function renderPanel() {
    if (!panel) return;
    panel.innerHTML = leftBox() + rightBox();
    renderInvites();
  }
  // Friends to invite straight away; the race code is there too, for anyone else.
  function pickList() {
    const f = Account.friends;
    if (!f) { Account.loadFriends().then(() => { const b = $('racePick'); if (b) b.innerHTML = pickList(); }); return '<span class="rp-note">Loading your friends…</span>'; }
    if (!f.friends.length) return '<span class="rp-note">No friends yet? Add them from your account, top left.</span>';
    const ids = new Set(f.friends.map(x => x.user_id));
    [...picked].forEach(id => { if (!ids.has(id)) picked.delete(id); });
    return '<span class="rp-label">Invite:</span>' + f.friends.map(x => `<button type="button" class="rp-chip${picked.has(x.user_id) ? ' on' : ''}" data-pick="${esc(x.user_id)}" aria-pressed="${picked.has(x.user_id)}">${picked.has(x.user_id) ? '✓ ' : ''}${esc(x.username)}</button>`).join('');
  }
  function renderInvites() {
    const box = $('raceInvites');
    if (box) box.innerHTML = invites.length
      ? invites.map(i => `<div class="rp-inv">${avatar(i.from_username)}<span class="rp-inv-text"><b>${esc(i.from_username)}</b> invited you<small>${esc(DIFF_NAME[i.diff] || i.diff)} · ${i.players} in</small></span>
          <button type="button" class="fr-btn yes" data-race="join" data-code="${esc(i.code)}">Join</button><button type="button" class="fr-btn subtle" data-race="decline" data-id="${esc(i.race_id)}" aria-label="Decline">✕</button></div>`).join('')
      : '<p class="rp-none">📨 No invites right now. Friends can invite you from their race lobby.</p>';
    tabBadge();
  }
  function tabBadge() {
    const b = document.querySelector('.type-btn[data-type="race"]');
    if (!b) return;
    let dot = b.querySelector('.race-badge');
    if (invites.length && !dot) { dot = document.createElement('span'); dot.className = 'race-badge'; b.appendChild(dot); }
    if (dot) { if (invites.length) { dot.textContent = invites.length; dot.title = `${invites.length} race invite${invites.length === 1 ? '' : 's'}`; } else dot.remove(); }
  }
  function say(text, kind) { panelMsg = { text, kind: kind || '' }; const m = $('raceJoinMsg'); if (m) { m.className = 'rp-msg ' + (kind || ''); m.textContent = text; } }

  if (panel) {
    panel.addEventListener('input', e => {
      if (e.target.id !== 'raceCode') return;
      const code = tidy(e.target.value), ok = code.length === 6 && [...code].every(c => CODE_CHARS.includes(c));
      $('raceJoin').disabled = !ok || busy;
      say(!code ? 'Type the code from your friend’s race lobby.' : code.length < 6 ? `${code.length} of 6 letters…` : ok ? '✅ Ready to join' : "That doesn't look like a race code.", ok ? 'ok' : code.length > 6 || (code.length === 6 && !ok) ? 'bad' : '');
    });
    // typing a code shouldn't also switch tabs or start a dash
    panel.addEventListener('keydown', e => { if (e.target.id === 'raceCode') e.stopPropagation(); });
    panel.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'raceJoinForm') join(tidy($('raceCode').value)); });
    panel.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || busy) return;
      if (b.closest('#raceDiff')) { click(); host.diff = b.dataset.v; saveHost(); renderPanel(); return; }
      if (b.dataset.pick) { click(); const id = b.dataset.pick; if (picked.has(id)) picked.delete(id); else picked.add(id); $('racePick').innerHTML = pickList(); return; }
      const a = b.dataset.race;
      if (!a) return;
      click();
      if (a === 'signin' || a === 'signup') AccountUI.open(a);
      else if (a === 'retry') { invitesState = 'unknown'; Account.init().then(() => { if (Account.status === 'signedIn') loadInvites(); renderPanel(); }); }
      else if (a === 'practice') A2OGame.practice(host.diff, fav);
      else if (a === 'fruit') openPicker();
      else if (a === 'create') create(b);
      else if (a === 'join') join(b.dataset.code);
      else if (a === 'decline') call('a2o_race_decline', { race_id: b.dataset.id }).then(loadInvites, loadInvites);
    });
  }
  const saveHost = () => { try { localStorage.setItem('a2o.raceHost', JSON.stringify(host)); } catch (e) { /* ignore */ } };

  function create(btn) {
    busy = true; if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
    call('a2o_race_create', { diff: host.diff }).then(r => {
      busy = false; enterLobby(r);
      // invite the friends ticked on the host card
      [...picked].forEach(id => call('a2o_race_invite', { race_id: r.race_id, friend_id: id }).then(() => { invitedNow.add(id); renderLobby(); }, () => {}));
    }, e => { busy = false; renderPanel(); say(errText(e), 'bad'); if (!$('raceJoinMsg')) toast(errText(e), 'warn'); });
  }
  function join(code) {
    if (!code) return;
    busy = true; say('Joining…');
    const btn = $('raceJoin'); if (btn) btn.disabled = true;
    call('a2o_race_join', { code }).then(r => { busy = false; say(''); const i = $('raceCode'); if (i) i.value = ''; enterLobby(r); },
      e => { busy = false; say(errText(e), 'bad'); if (btn) btn.disabled = false; if (!$('raceCode')) toast(errText(e), 'warn'); });
  }

  // Invites: checked every 10 seconds on the home screen, with a notice for each new one.
  function loadInvites() {
    if (Account.status !== 'signedIn') { invites = []; tabBadge(); return Promise.resolve(); }
    const before = invitesState;
    return call('a2o_race_invites').then(list => {
      invitesState = 'ok';
      invites = Array.isArray(list) ? list : [];
      invites.forEach(i => {
        if (toasted.has(i.race_id)) return;
        toasted.add(i.race_id);
        if (phase === 'none') toast(`📨 <b>${esc(i.from_username)}</b> invited you to a race · ${esc(describe(i))} <button type="button" class="acct-link" data-race-code="${esc(i.code)}">Join</button>`, 'good');
      });
    }, e => { invitesState = e.code === 'not_deployed' ? 'not_deployed' : 'error'; }).then(() => {
      if (before !== invitesState && raceTabShown()) renderPanel(); else renderInvites();
      tabBadge();
    });
  }
  const raceTabShown = () => typeof A2OGame !== 'undefined' && A2OGame.state === 'title' && A2OGame.type === 'race';
  $('acctToast').addEventListener('click', e => { const b = e.target.closest('[data-race-code]'); if (b) { click(); $('acctToast').className = 'acct-toast'; join(b.dataset.raceCode); } });
  setInterval(() => { if (Account.status === 'signedIn' && phase === 'none' && !document.hidden && A2OGame.state === 'title') loadInvites(); }, 10000);

  // ---- Picking a fruit ---------------------------------------------------------------
  // The eight fruits, drawn by the kitchen's own painter. In a lobby, ones other racers have are
  // taken; on the home screen it just sets your favourite.
  function fruitButtons(taken, mine) {
    return FRUITS.map((f, i) => {
      const who = taken.get(i), isMine = i === mine;
      return `<button type="button" class="fp-btn${isMine ? ' on' : ''}" data-fruit="${i}" ${who && !isMine ? 'disabled' : ''} aria-pressed="${isMine}" title="${esc(f.name)}${who && !isMine ? ' · ' + esc(who) : ''}">
        <canvas width="120" height="120" data-paint="${i}"></canvas><span>${esc(f.name)}</span>${who && !isMine ? `<small>${esc(who)}</small>` : ''}</button>`;
    }).join('');
  }
  function paintAll(root) {
    root.querySelectorAll('canvas[data-paint]').forEach(cv => {
      const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
      Kitchen.paintFruit(c, +cv.dataset.paint, 60, 112, 1.4);
    });
  }
  const picker = document.createElement('div');
  picker.id = 'fruitPick'; picker.className = 'modal hidden';
  picker.innerHTML = `<div class="modal-box fp-box" role="dialog" aria-modal="true" aria-labelledby="fpTitle">
      <h2 id="fpTitle">Pick your fruit</h2><p class="acct-sub">Who do you want to run as? In a race, everyone is a different fruit.</p>
      <div class="fp-grid" id="fpGrid"></div>
      <button type="button" class="big-btn quiet" data-fp="close">Done</button></div>`;
  $('stage').appendChild(picker);
  function openPicker() {
    $('fpGrid').innerHTML = fruitButtons(new Map(), fav);
    paintAll(picker);
    picker.classList.remove('hidden');
  }
  picker.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.target === picker || (b && b.dataset.fp === 'close')) { click(); picker.classList.add('hidden'); renderPanel(); return; }
    if (b && b.dataset.fruit) { click(); fav = +b.dataset.fruit; saveFav(); $('fpGrid').innerHTML = fruitButtons(new Map(), fav); paintAll(picker); }
  });
  picker.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { picker.classList.add('hidden'); renderPanel(); } });

  // ---- The lobby -------------------------------------------------------------------
  const lobby = document.createElement('div');
  lobby.id = 'raceLobby'; lobby.className = 'modal hidden';
  lobby.innerHTML = `<div class="modal-box race-lobby" role="dialog" aria-modal="true" aria-labelledby="rlTitle">
      <h2 id="rlTitle">🏁 Race lobby</h2>
      <div class="rl-code"><span class="rl-code-label">Race code</span><span class="rl-code-val" id="rlCode"></span><button type="button" class="rl-copy" data-race="copy">📋 Copy</button></div>
      <p class="rl-desc" id="rlDesc"></p>
      <div class="rl-cols">
        <div><h3 class="fr-h" id="rlCount">Racers</h3><div class="rl-list" id="rlPlayers"></div></div>
        <div><h3 class="fr-h">Your fruit</h3><div class="fp-grid small" id="rlFruits"></div>
          <h3 class="fr-h">Invite friends</h3><div class="rl-list short" id="rlFriends"></div></div>
      </div>
      <div class="af-error" id="rlMsg" role="alert"></div>
      <p class="rl-wait" id="rlWait" aria-live="polite"></p>
      <div class="acct-btns"><button type="button" class="big-btn go" id="rlStart" data-race="start">🏁 Start race</button><button type="button" class="big-btn quiet" data-race="leave">Leave</button></div>
    </div>`;
  $('stage').appendChild(lobby);

  function enterLobby(r) {
    stop();
    race = r; phase = 'lobby'; invitedNow.clear(); fruitAsked = false;
    $('rlMsg').textContent = '';
    lobby.classList.remove('hidden');
    askFavourite();
    renderLobby();
    Account.loadFriends().then(renderLobby);
    loop();
    setTimeout(() => { const b = $('rlStart'); (b.offsetParent ? b : lobby.querySelector('[data-race="leave"]')).focus(); }, 50);
  }
  // The server hands out the first free fruit; if your favourite is free, ask for it once.
  function askFavourite() {
    if (fruitAsked || !race) return;
    fruitAsked = true;
    const mine = race.players.find(p => p.user_id === me());
    const taken = new Set(race.players.filter(p => !p.left && p.user_id !== me()).map(p => p.fruit));
    if (mine && mine.fruit !== fav && !taken.has(fav)) setFruit(fav, true);
  }
  function setFruit(i, quiet) {
    if (!race) return;
    const id = race.race_id;
    call('a2o_race_fruit', { race_id: id, fruit: i }).then(r => { if (!quiet) { fav = i; saveFav(); } update(r); },
      e => { if (!quiet && race && race.race_id === id) { $('rlMsg').textContent = errText(e); renderLobby(); } });
  }
  function renderLobby() {
    if (!race || (phase !== 'lobby' && phase !== 'starting')) return;
    const mine = me(), isHost = race.host_id === mine, players = race.players.filter(p => !p.left);
    const hostName = (players.find(p => p.is_host) || {}).username || 'the host';
    const myFruit = (players.find(p => p.user_id === mine) || {}).fruit;
    $('rlCode').textContent = race.code;
    $('rlDesc').textContent = describe(race);
    $('rlCount').textContent = `Racers (${players.length} of ${MAX})`;
    $('rlPlayers').innerHTML = players.map(p => `<div class="fr-row${p.user_id === mine ? ' me' : ''}"><span class="rl-fruit" style="border-color:${fruitOf(p.fruit).color}">${fruitOf(p.fruit).emoji}</span><span class="fr-name"><b>${esc(p.username)}</b><small>${esc(fruitOf(p.fruit).name)} · ${p.is_host ? '👑 Host' : 'Ready'}${p.user_id === mine ? ' · you' : ''}</small></span></div>`).join('');
    const taken = new Map(players.filter(p => p.user_id !== mine).map(p => [p.fruit, p.username]));
    const fruits = $('rlFruits');
    if (fruits.dataset.key !== JSON.stringify([...taken, myFruit])) {     // only repaint when something changed
      fruits.dataset.key = JSON.stringify([...taken, myFruit]);
      fruits.innerHTML = fruitButtons(taken, myFruit);
      paintAll(fruits);
    }
    const inRace = new Set(race.players.map(p => p.user_id)), invited = new Set((race.invited || []).map(i => i.user_id).concat([...invitedNow]));
    const f = Account.friends;
    const friends = f ? f.friends.filter(x => !inRace.has(x.user_id)) : null;
    $('rlFriends').innerHTML = !f ? '<p class="fr-empty">Loading your friends…</p>'
      : !friends.length ? `<p class="fr-empty">${f.friends.length ? 'All your friends are in!' : 'No friends yet. Share the race code, or add friends from your account.'}</p>`
      : friends.map(x => `<div class="fr-row">${avatar(x.username)}<span class="fr-name"><b>${esc(x.username)}</b></span>${invited.has(x.user_id)
          ? '<span class="rl-invited">Invited ✓</span>' : `<button type="button" class="fr-btn yes" data-race="invite" data-id="${esc(x.user_id)}">Invite</button>`}</div>`).join('');
    const start = $('rlStart'), starting = phase === 'starting';
    start.classList.toggle('hidden', !isHost);
    start.disabled = starting || players.length < 2;
    $('rlWait').textContent = starting ? '🚦 Get ready! The race is starting…'
      : isHost ? (players.length < 2 ? 'Share the code or invite a friend: you need at least 2 racers.' : 'Everyone in? Start when you’re ready.')
      : `Waiting for ${hostName} to start the race…`;
    lobby.querySelector('[data-race="leave"]').disabled = starting;
    fruits.querySelectorAll('button').forEach(b => { if (starting) b.disabled = true; });
  }
  lobby.addEventListener('click', e => {
    const b = e.target.closest('button[data-race], button[data-fruit]');
    if (!b || !race) return;
    click();
    if (b.dataset.fruit) { $('rlMsg').textContent = ''; setFruit(+b.dataset.fruit); return; }
    const a = b.dataset.race;
    if (a === 'copy') {
      const done = ok => { b.textContent = ok ? '✅ Copied' : race.code; };
      try { navigator.clipboard.writeText(race.code).then(() => done(true), () => done(false)); } catch (err) { done(false); }
    } else if (a === 'leave') { leave(true); }
    else if (a === 'start') {
      b.disabled = true; $('rlMsg').textContent = '';
      call('a2o_race_start', { race_id: race.race_id }).then(update, err => { $('rlMsg').textContent = errText(err); renderLobby(); });
    } else if (a === 'invite') {
      b.disabled = true;
      call('a2o_race_invite', { race_id: race.race_id, friend_id: b.dataset.id }).then(() => { invitedNow.add(b.dataset.id); renderLobby(); },
        err => { $('rlMsg').textContent = errText(err); b.disabled = false; });
    }
  });
  lobby.addEventListener('keydown', e => e.stopPropagation());

  // ---- Keeping up with the server ------------------------------------------------------
  function loop() { clearTimeout(pollTimer); if (race && phase !== 'none') pollTimer = setTimeout(tick, POLL); }
  function tick() {
    if (!race) return;
    const id = race.race_id;
    let p;
    if (phase === 'racing' && A2OGame.racing && A2OGame.raceId === id && A2OGame.state === 'playing') {
      const sc = A2OGame.score();
      p = sc !== lastSent ? call('a2o_race_progress', { race_id: id, score: sc, correct: A2OGame.correct() }).then(r => { lastSent = sc; return r; })
        : call('a2o_race_state', { race_id: id });
    } else p = call('a2o_race_state', { race_id: id });
    p.then(update, e => { if (e.code === 'a2o_race_not_found' && phase === 'lobby') gone('That race closed.'); }).then(() => { if (race && race.race_id === id) loop(); });
  }
  function update(r) {
    if (!r || !race || r.race_id !== race.race_id) return;
    race = r;
    if (phase === 'lobby') {
      if (r.status === 'racing') return go();
      if (r.status === 'closed') return gone('That race was closed.');
      if (!r.players.some(p => p.user_id === me() && !p.left)) return gone('You’re no longer in that race.');
      renderLobby();
    } else if (phase === 'racing') { feedKitchen(); renderBoard(); }
    else if (phase === 'results') {
      if (r.status === 'racing' && r.round > round) return go();   // everyone voted yes: next round
      if (!r.players.some(p => p.user_id === me() && !p.left)) return;
      renderResults();
    }
  }
  function gone(msg) {
    const wasLobby = phase === 'lobby' || phase === 'starting';
    stop();
    if (wasLobby) lobby.classList.add('hidden');
    if (msg) toast(msg, 'warn');
    if (raceTabShown()) renderPanel();
  }
  function stop() {
    clearTimeout(pollTimer);
    race = null; phase = 'none'; lastSent = -1; myResult = null; round = 0; voted = false;
    showBoard(false);
  }

  // ---- The start: the game counts down to the server's start time ------------------------
  function go() {
    phase = 'racing'; round = race.round || 1; voted = false; myResult = null; lastSent = -1;
    lobby.classList.add('hidden');
    const r = race, mine = r.players.find(p => p.user_id === me()) || {};
    A2OGame.startRace({ raceId: r.race_id, code: r.code, diff: r.diff, seed: r.seed, round,
      fruit: mine.fruit | 0, startLocal: Date.parse(r.starts_at) - offset, endLocal: Date.parse(r.ends_at) - offset });
    feedKitchen();
    showBoard(true); renderBoard();
    loop();
  }

  // ---- The live board while racing, and the other fruits in the kitchen --------------------
  const board = document.createElement('div');
  board.id = 'raceBoard'; board.className = 'race-board hidden'; board.setAttribute('aria-live', 'off');
  $('game').appendChild(board);
  function showBoard(on) { board.classList.toggle('hidden', !on); }
  function standings() {
    const mine = me();
    return race.players.map(p => {
      const live = p.user_id === mine && A2OGame.racing;
      return { ...p, score: live ? A2OGame.score() : p.score, me: p.user_id === mine };
    }).sort((a, b) => (a.left - b.left) || (b.score - a.score));
  }
  function feedKitchen() {
    if (!race) return;
    A2OGame.rivals(race.players.filter(p => p.user_id !== me()).map(p => ({ id: p.user_id, name: p.username, fruit: p.fruit, score: p.score, finished: p.finished, left: p.left })));
  }
  function renderBoard() {
    if (!race || phase !== 'racing') return;
    const rows = standings();
    // the top four, plus you if you're further down
    const shown = rows.filter((p, i) => i < 4 || p.me);
    board.innerHTML = `<div class="rb-h">🏁 LIVE${race.round > 1 ? ` · ROUND ${race.round}` : ''} <span>${esc(race.code)}</span></div>` + shown.map(p => [p, rows.indexOf(p)]).map(([p, i]) =>
      `<div class="rb-row${p.me ? ' me' : ''}${p.left ? ' left' : ''}"><span class="rb-rank">${p.left ? '–' : i + 1}</span><span class="rb-fruit">${fruitOf(p.fruit).emoji}</span><span class="rb-name">${p.me ? 'You' : esc(p.username)}</span><span class="rb-score">${p.left ? 'left' : n(p.score)}</span><span class="rb-flag">${p.finished ? '🏁' : ''}</span></div>`).join('');
  }
  // the board follows your own score between server replies
  setInterval(() => { if (phase === 'racing' && race && A2OGame.racing) renderBoard(); }, 400);

  // ---- Results ----------------------------------------------------------------------
  const MEDAL = ['🥇', '🥈', '🥉'];
  let cheered = '';     // the race and round the winner's confetti has gone off for
  // The game calls this when the clock runs out. res: { score, correct, bestStreak, photos }
  function over(res) {
    if (!race) return false;
    myResult = res; phase = 'results'; showBoard(false);
    renderResults();
    const id = race.race_id;
    call('a2o_race_finish', { race_id: id, score: res.score, correct: res.correct })
      .then(update, () => { /* the next poll tries again with the state */ }).then(loop);
    return true;
  }
  function renderResults() {
    if (!race || phase !== 'results') return;
    const mine = me(), rows = standings();
    rows.forEach(p => { if (p.me && myResult) { p.finished = true; p.score = myResult.score; } });
    rows.sort((a, b) => (a.left - b.left) || (b.score - a.score));
    const done = race.status === 'finished', waiting = rows.filter(p => !p.finished && !p.left).length;
    const still = rows.filter(p => !p.left), yes = still.filter(p => p.voted || (p.me && voted)).length;
    const myPlace = rows.findIndex(p => p.user_id === mine) + 1, winner = rows[0];
    const won = done && winner && winner.user_id === mine;
    $('overKicker').textContent = `🏃 Fruit Dash · ${(DIFF_NAME[race.diff] || race.diff).replace(/^\S+ /, '')}${race.round > 1 ? ` · Round ${race.round}` : ''}`;
    $('overTitle').textContent = !done ? '🏁 Time’s up!' : won ? '🥇 You won the race!' : `🏁 ${winner ? winner.username : 'Nobody'} wins!`;
    $('overStats').innerHTML = `
      <div class="race-results">
        ${rows.map((p, i) => `<div class="rr-row${p.me ? ' me' : ''}${p.left ? ' left' : ''}"><span class="rr-rank">${p.left ? '–' : p.finished ? MEDAL[i] || i + 1 : '🏃'}</span><span class="rr-fruit" style="border-color:${fruitOf(p.fruit).color}">${fruitOf(p.fruit).emoji}</span><span class="rr-name">${p.me ? 'You' : esc(p.username)}</span><span class="rr-score">${p.left ? 'left the race' : p.finished ? n(p.score) : `still dashing… ${n(p.score)}`}</span>${done && !p.left ? `<span class="rr-vote${p.voted || (p.me && voted) ? ' yes' : ''}">${p.voted || (p.me && voted) ? '✓ again' : '…'}</span>` : ''}</div>`).join('')}
        ${waiting ? `<div class="rr-wait">Waiting for ${waiting} racer${waiting === 1 ? '' : 's'} to cross the line…</div>`
          : done && still.length < 2 ? '<div class="rr-wait">Everyone else left, so there\'s no next round.</div>'
          : done ? `<div class="rr-wait">🔁 Play again? ${yes} of ${still.length} voted yes. When everyone says yes, the next round starts with new matchups.</div>` : ''}
      </div>
      <div class="stat"><b>${done ? ordinal(myPlace) : '…'}</b><span>Your place</span></div>
      <div class="stat"><b>${myResult ? myResult.correct : 0}</b><span>Right answers</span></div>
      <div class="stat"><b>${myResult ? myResult.bestStreak : 0}</b><span>Best streak</span></div>
      <div class="stat"><b>${myResult ? myResult.photos : '–'}</b><span>Photo finishes won</span></div>`;
    const again = $('btnAgain');
    again.textContent = !voted ? '🔁 Play again' : yes >= still.length ? '🚦 Starting the next round…' : `⏳ Waiting for ${still.length - yes} more`;
    again.disabled = !done || voted || still.length < 2;
    again.title = done ? '' : 'Wait for everyone to finish';
    $('btnHome').textContent = 'Leave race';
    const key = race.race_id + '#' + race.round;
    if (won && cheered !== key) { cheered = key; Scene.confetti(220); Sound.photoWin(); }
  }
  // Vote to play again. The server starts the next round the moment everyone has said yes.
  function again() {
    if (!race || race.status !== 'finished' || voted) return;
    voted = true; renderResults();
    call('a2o_race_vote', { race_id: race.race_id, again: true }).then(update, e => { voted = false; renderResults(); toast(errText(e), 'warn'); });
  }
  // Leave: from the lobby (stay on the home screen) or from the results (back to it)
  function leave(fromLobby) {
    const id = race && race.race_id;
    if (fromLobby) lobby.classList.add('hidden');
    stop();
    if (id) call('a2o_race_leave', { race_id: id }).catch(() => { /* the server times it out anyway */ });
    if (!fromLobby) A2OGame.showTitle(); else if (raceTabShown()) renderPanel();
  }
  // Back on the home screen by any other road: count it as leaving.
  function onTitle() {
    if (phase === 'racing' || phase === 'results') { const id = race && race.race_id; stop(); if (id) call('a2o_race_leave', { race_id: id }).catch(() => {}); }
    $('btnAgain').disabled = false; $('btnAgain').title = ''; $('btnHome').textContent = 'Home';
    if (Account.status === 'signedIn') loadInvites();
    if (raceTabShown()) renderPanel();
  }

  Account.on(() => {
    if (Account.status !== 'signedIn' && phase !== 'none') { const wasLobby = phase === 'lobby' || phase === 'starting'; stop(); if (wasLobby) lobby.classList.add('hidden'); }
    if (Account.status === 'signedIn' && invitesState === 'unknown') loadInvites();
    if (phase === 'lobby') renderLobby();
    if (raceTabShown() && !(panel && panel.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')) renderPanel();
  });

  return {
    renderPanel, onTitle, over, again, leave: () => leave(false),
    get phase() { return phase; }, get fruit() { return fav; }
  };
})();
