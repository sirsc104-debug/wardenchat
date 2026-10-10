/* Brain Rocket — Play With Friends as a live race. A signed-in player hosts a race and gets a
   6-character code; friends join by code or invite; the host starts it and everyone counts down
   together on the server's clock, gets the same questions (one shared seed), and watches the
   others drill on a live board and on the depth track. Then a podium and a vote: if everyone still
   there votes to play again, the next round starts for all of them, with new questions.

   The server side is the br_race_* functions in RACES-API.md (Warden Chat's Supabase project);
   this file reaches them through Account.rpc. Browsers poll about every 1.5 seconds, which is
   plenty for a 30 to 120-second race. js/game.js plays the drill itself (BRGame hooks). */
'use strict';

const Race = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => Number(v || 0).toLocaleString();
  const click = () => { if (typeof Sound !== 'undefined') Sound.click(); };
  const avatar = name => ProfilePictures.html(name);
  const MODE_NAME = { easy: '🧒 Owen', medium: 'Medium', hard: 'Hard' };
  const LENS = [30, 60, 120], MAX = 8, POLL = 1500;
  const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  const tidy = s => String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  const describe = r => `⛏️ ${MODE_NAME[r.mode] || r.mode} · ${r.len}-second drill`;
  const ordinal = i => (i === 1 ? '1st' : i === 2 ? '2nd' : i === 3 ? '3rd' : i + 'th');
  const me = () => (Account.user ? Account.user.id : null);

  let host = { mode: 'medium', len: 60 };
  try { const h = JSON.parse(localStorage.getItem('brainRocket.raceHost')); if (h && MODE_NAME[h.mode] && LENS.includes(h.len)) host = h; } catch (e) { /* first time */ }

  let race = null;        // the latest race state from the server
  let phase = 'none';     // none | lobby | starting | racing | results
  let offset = 0, bestRtt = Infinity;      // server clock minus this computer's clock, in ms
  let pollTimer = 0, startTimer = 0, lastSent = -1, myResult = null, busy = false, round = 0, voted = false;
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
      case 'br_race_not_found': return 'No open race has that code. Check it with your friend.';
      case 'br_race_started': return 'That race has already started.';
      case 'br_race_closed': return 'That race is over.';
      case 'br_race_full': return `That race is full (${MAX} racers).`;
      case 'br_not_friends': return 'You can only invite friends.';
      case 'br_not_host': return 'Only the host can start the race.';
      case 'br_need_players': return 'You need at least one more racer.';
      case 'br_bad_race': return "That race setting isn't allowed.";
      case 'br_rate_limited': case 'rate_limited': return 'Too many tries. Wait a minute, then try again.';
      case 'offline': return "Can't reach the server. Check your connection.";
      case 'not_deployed': return 'Live races are being switched on. Try again soon.';
      case 'unauthorized': return 'Your sign-in ran out. Sign in again to race.';
      default: return 'Something went wrong. Try again in a moment.';
    }
  }
  const toast = (html, kind) => { if (typeof AccountUI !== 'undefined') AccountUI.toast(html, kind); };

  // ---- The Play With Friends panel on the home screen ---------------------------------
  const panel = $('chPanel');
  const card = (icon, title, text, btns) => `<div class="ch-box race-gate"><div class="rg-icon" aria-hidden="true">${icon}</div><h3>${title}</h3><p>${text}</p>${btns ? `<div class="ch-host-btns">${btns}</div>` : ''}</div>`;
  function renderPanel() {
    const s = Account.status;
    if (s === 'checking') panel.innerHTML = card('⏳', 'Connecting…', 'Getting the race server ready.');
    else if (s === 'unavailable') panel.innerHTML = card('📡', "Can't reach the race server", "Live races need the Brain Rocket server, and it can't be reached right now. Check your connection, then try again.", '<button type="button" class="big-btn ghost" data-race="retry">↻ Try again</button>');
    else if (s === 'restricted') panel.innerHTML = card('🚫', 'Races are off for your account', `Your Warden Chat account is ${Account.restriction && Account.restriction.status === 'banned' ? 'banned' : 'suspended'}, so you can’t race right now.`);
    else if (s === 'signedOut') panel.innerHTML = card('🏁', 'Race your friends live', 'Everyone gets the same questions at the same time, and you watch each other drill down. Races need a <span class="wc-badge">💬 Warden Chat</span> account.',
      '<button type="button" class="big-btn" data-race="signin">Sign in</button><button type="button" class="big-btn ghost" data-race="signup">Create an account</button>');
    else if (invitesState === 'not_deployed') panel.innerHTML = card('🚧', 'Live races are almost here', 'The race server is being switched on. Check back soon!');
    else {
      const row = (id, items, on) => `<div class="ch-row" id="${id}" role="group">${items.map(([v, label]) => `<button type="button" data-v="${v}" class="${on(v) ? 'active' : ''}" aria-pressed="${on(v)}">${label}</button>`).join('')}</div>`;
      panel.innerHTML = `
        <form class="ch-box" id="raceJoinForm" autocomplete="off">
          <h3>🎟️ Join a race</h3>
          <div class="race-join-row"><input id="raceCode" maxlength="9" placeholder="6-letter code" spellcheck="false" autocapitalize="characters" aria-label="Race code" aria-describedby="raceJoinMsg">
          <button type="submit" class="big-btn" id="raceJoin" disabled>🏁 Join</button></div>
          <div class="ch-preview ${panelMsg.kind}" id="raceJoinMsg" aria-live="polite">${esc(panelMsg.text || 'Type the code from your friend’s race lobby.')}</div>
          <div class="race-invites" id="raceInvites"></div>
        </form>
        <div class="ch-box">
          <h3>📣 Host a race</h3>
          ${row('raceMode', [['easy', '🧒 Owen'], ['medium', 'Medium'], ['hard', 'Hard']], v => v === host.mode)}
          ${row('raceLen', LENS.map(l => [l, `${l} seconds`]), v => +v === host.len)}
          <div class="race-pick" id="racePick">${pickList()}</div>
          <div class="ch-host-btns"><button type="button" class="big-btn" data-race="create" title="You also get a 6-letter code for anyone else. Up to ${MAX} racers.">🏁 Create a race</button></div>
        </div>`;
      renderInvites();
    }
  }
  // Friends to invite straight away; the race code is there too, for anyone else.
  function pickList() {
    const f = Account.friends;
    if (!f) { Account.loadFriends().then(() => { const b = $('racePick'); if (b) b.innerHTML = pickList(); }); return '<span class="race-pick-note">Loading your friends…</span>'; }
    if (!f.friends.length) return '<span class="race-pick-note">No friends yet? Add them from your account, top right.</span>';
    const ids = new Set(f.friends.map(x => x.user_id));
    [...picked].forEach(id => { if (!ids.has(id)) picked.delete(id); });
    return '<span class="race-pick-label">Invite:</span>' + f.friends.map(x => `<button type="button" class="race-chip${picked.has(x.user_id) ? ' on' : ''}" data-pick="${esc(x.user_id)}" aria-pressed="${picked.has(x.user_id)}">${picked.has(x.user_id) ? '✓ ' : ''}${esc(x.username)}</button>`).join('');
  }
  function renderInvites() {
    const box = $('raceInvites');
    if (!box) return;
    box.innerHTML = invites.length
      ? '<h4 class="race-inv-h">📨 Invites</h4>' + invites.map(i => `<div class="race-inv">${avatar(i.from_username)}<span class="race-inv-text"><b>${esc(i.from_username)}</b> invited you<small>${esc(MODE_NAME[i.mode] || i.mode)} · ${i.len}s · ${i.players} in</small></span>
          <button type="button" class="fr-btn yes" data-race="join" data-code="${esc(i.code)}">Join</button><button type="button" class="fr-btn subtle" data-race="decline" data-id="${esc(i.race_id)}" aria-label="Decline">✕</button></div>`).join('')
      : '<p class="race-inv-none">No invites right now. Friends can invite you from their race lobby.</p>';
    tabBadge();
  }
  function tabBadge() {
    const b = document.querySelector('.type-btn[data-type="drill"]');
    if (!b) return;
    let dot = b.querySelector('.race-badge');
    if (invites.length && !dot) { dot = document.createElement('span'); dot.className = 'race-badge'; b.appendChild(dot); }
    if (dot) { if (invites.length) { dot.textContent = invites.length; dot.title = `${invites.length} race invite${invites.length === 1 ? '' : 's'}`; } else dot.remove(); }
  }
  function say(text, kind) { panelMsg = { text, kind: kind || '' }; const m = $('raceJoinMsg'); if (m) { m.className = 'ch-preview ' + (kind || ''); m.textContent = text; } }

  panel.addEventListener('input', e => {
    if (e.target.id !== 'raceCode') return;
    const code = tidy(e.target.value), ok = code.length === 6 && [...code].every(c => CODE_CHARS.includes(c));
    $('raceJoin').disabled = !ok || busy;
    say(!code ? 'Type the code from your friend’s race lobby.' : code.length < 6 ? `${code.length} of 6 letters…` : ok ? '✅ Ready to join' : "That doesn't look like a race code.", ok ? 'ok' : code.length > 6 || (code.length === 6 && !ok) ? 'bad' : '');
  });
  panel.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'raceJoinForm') join(tidy($('raceCode').value)); });
  panel.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || busy) return;
    if (b.closest('#raceMode')) { click(); host.mode = b.dataset.v; saveHost(); renderPanel(); return; }
    if (b.closest('#raceLen')) { click(); host.len = +b.dataset.v; saveHost(); renderPanel(); return; }
    if (b.dataset.pick) { click(); const id = b.dataset.pick; if (picked.has(id)) picked.delete(id); else picked.add(id); $('racePick').innerHTML = pickList(); return; }
    const a = b.dataset.race;
    if (!a) return;
    click();
    if (a === 'signin' || a === 'signup') AccountUI.open(a);
    else if (a === 'retry') { Account.init().then(renderPanel); }
    else if (a === 'create') create(b);
    else if (a === 'join') join(b.dataset.code);
    else if (a === 'decline') call('br_race_decline', { race_id: b.dataset.id }).then(loadInvites, loadInvites);
  });
  const saveHost = () => { try { localStorage.setItem('brainRocket.raceHost', JSON.stringify(host)); } catch (e) { /* ignore */ } };

  function create(btn) {
    busy = true; if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
    call('br_race_create', { mode: host.mode, len: host.len }).then(r => {
      busy = false; enterLobby(r);
      // invite the friends ticked on the host card
      [...picked].forEach(id => call('br_race_invite', { race_id: r.race_id, friend_id: id }).then(() => { invitedNow.add(id); renderLobby(); }, () => {}));
    }, e => { busy = false; renderPanel(); say(errText(e), 'bad'); });
  }
  function join(code) {
    if (!code) return;
    busy = true; say('Joining…');
    const btn = $('raceJoin'); if (btn) btn.disabled = true;
    call('br_race_join', { code }).then(r => { busy = false; say(''); const i = $('raceCode'); if (i) i.value = ''; enterLobby(r); },
      e => { busy = false; say(errText(e), 'bad'); if (btn) btn.disabled = false; if (!$('raceCode')) toast(errText(e), 'warn'); });
  }

  // Invites: checked every 10 seconds on the home screen, with a notice for each new one.
  function loadInvites() {
    if (Account.status !== 'signedIn') { invites = []; tabBadge(); return Promise.resolve(); }
    const before = invitesState;
    return call('br_race_invites').then(list => {
      invitesState = 'ok';
      invites = Array.isArray(list) ? list : [];
      invites.forEach(i => {
        if (toasted.has(i.race_id)) return;
        toasted.add(i.race_id);
        if (phase === 'none') toast(`📨 <b>${esc(i.from_username)}</b> invited you to a race · ${esc(describe(i))} <button type="button" class="acct-link" data-race-code="${esc(i.code)}">Join</button>`, 'good');
      });
    }, e => { invitesState = e.code === 'not_deployed' ? 'not_deployed' : 'error'; }).then(() => {
      if (before !== invitesState && drillTabShown()) renderPanel(); else renderInvites();
      tabBadge();
    });
  }
  const drillTabShown = () => !$('title').classList.contains('hidden') && !panel.classList.contains('hidden');
  $('acctToast').addEventListener('click', e => { const b = e.target.closest('[data-race-code]'); if (b) { click(); $('acctToast').className = 'acct-toast'; join(b.dataset.raceCode); } });
  setInterval(() => { if (Account.status === 'signedIn' && phase === 'none' && !document.hidden && BRGame.state === 'title') loadInvites(); }, 10000);

  // ---- The lobby -------------------------------------------------------------------
  const lobby = document.createElement('div');
  lobby.id = 'raceLobby'; lobby.className = 'screen hidden';
  lobby.innerHTML = `<div class="dialog race-lobby" role="dialog" aria-modal="true" aria-labelledby="rlTitle">
      <h2 id="rlTitle">🏁 Race lobby</h2>
      <div class="rl-code"><span class="rl-code-label">Race code</span><span class="rl-code-val" id="rlCode"></span><button type="button" class="ch-copy" data-race="copy">📋 Copy</button></div>
      <p class="rl-desc" id="rlDesc"></p>
      <div class="rl-cols">
        <div><h3 class="fr-h" id="rlCount">Racers</h3><div class="rl-list" id="rlPlayers"></div></div>
        <div><h3 class="fr-h">Invite friends</h3><div class="rl-list" id="rlFriends"></div></div>
      </div>
      <div class="af-error" id="rlMsg" role="alert"></div>
      <p class="rl-wait" id="rlWait" aria-live="polite"></p>
      <div class="dialog-btns"><button type="button" class="big-btn" id="rlStart" data-race="start">🏁 Start race</button><button type="button" class="big-btn ghost" data-race="leave">Leave</button></div>
    </div>`;
  $('stage').appendChild(lobby);

  function enterLobby(r) {
    stop();
    race = r; phase = 'lobby'; invitedNow.clear();
    $('rlMsg').textContent = '';
    lobby.classList.remove('hidden');
    renderLobby();
    Account.loadFriends().then(renderLobby);
    loop();
    setTimeout(() => { const b = $('rlStart'); (b.offsetParent ? b : lobby.querySelector('[data-race="leave"]')).focus(); }, 50);
  }
  function renderLobby() {
    if (!race || (phase !== 'lobby' && phase !== 'starting')) return;
    const mine = me(), isHost = race.host_id === mine, players = race.players.filter(p => !p.left);
    const hostName = (players.find(p => p.is_host) || {}).username || 'the host';
    $('rlCode').textContent = race.code;
    $('rlDesc').textContent = describe(race);
    $('rlCount').textContent = `Racers (${players.length} of ${MAX})`;
    $('rlPlayers').innerHTML = players.map(p => `<div class="fr-row${p.user_id === mine ? ' me' : ''}">${avatar(p.username)}<span class="fr-name"><b>${esc(p.username)}</b><small>${p.is_host ? '👑 Host' : 'Ready'}${p.user_id === mine ? ' · you' : ''}</small></span></div>`).join('');
    const inRace = new Set(race.players.map(p => p.user_id)), invited = new Set((race.invited || []).map(i => i.user_id).concat([...invitedNow]));
    const f = Account.friends;
    const friends = f ? f.friends.filter(x => !inRace.has(x.user_id)) : null;
    $('rlFriends').innerHTML = !f ? '<p class="fr-empty">Loading your friends…</p>'
      : !friends.length ? `<p class="fr-empty">${f.friends.length ? 'All your friends are in!' : 'No friends yet. Share the race code, or add friends from your account (top right of the home screen).'}</p>`
      : friends.map(x => `<div class="fr-row">${avatar(x.username)}<span class="fr-name"><b>${esc(x.username)}</b></span>${invited.has(x.user_id)
          ? '<span class="rl-invited">Invited ✓</span>' : `<button type="button" class="fr-btn yes" data-race="invite" data-id="${esc(x.user_id)}">Invite</button>`}</div>`).join('');
    const start = $('rlStart'), starting = phase === 'starting';
    start.classList.toggle('hidden', !isHost);
    start.disabled = starting || players.length < 2;
    $('rlWait').textContent = starting ? '🚦 Get ready! The race is starting…'
      : isHost ? (players.length < 2 ? 'Share the code or invite a friend: you need at least 2 racers.' : 'Everyone in? Start when you’re ready.')
      : `Waiting for ${hostName} to start the race…`;
    lobby.querySelector('[data-race="leave"]').disabled = starting;
  }
  lobby.addEventListener('click', e => {
    const b = e.target.closest('button[data-race]');
    if (!b || !race) return;
    const a = b.dataset.race;
    click();
    if (a === 'copy') {
      const done = ok => { b.textContent = ok ? '✅ Copied' : race.code; };
      try { navigator.clipboard.writeText(race.code).then(() => done(true), () => done(false)); } catch (err) { done(false); }
    } else if (a === 'leave') { leave(true); }
    else if (a === 'start') {
      b.disabled = true; $('rlMsg').textContent = '';
      call('br_race_start', { race_id: race.race_id }).then(update, err => { $('rlMsg').textContent = errText(err); renderLobby(); });
    } else if (a === 'invite') {
      b.disabled = true;
      call('br_race_invite', { race_id: race.race_id, friend_id: b.dataset.id }).then(() => { invitedNow.add(b.dataset.id); renderLobby(); },
        err => { $('rlMsg').textContent = errText(err); b.disabled = false; });
    }
  });

  // ---- Keeping up with the server ------------------------------------------------------
  function loop() { clearTimeout(pollTimer); if (race && phase !== 'none') pollTimer = setTimeout(tick, POLL); }
  function tick() {
    if (!race) return;
    const id = race.race_id;
    let p;
    if (phase === 'racing' && BRGame.racing && BRGame.raceId === id && BRGame.state !== 'countdown') {
      const sc = BRGame.score();
      p = sc !== lastSent ? call('br_race_progress', { race_id: id, score: sc, correct: BRGame.correct() }).then(r => { lastSent = sc; return r; })
        : call('br_race_state', { race_id: id });
    } else p = call('br_race_state', { race_id: id });
    p.then(update, e => { if (e.code === 'br_race_not_found' && phase === 'lobby') gone('That race closed.'); }).then(() => { if (race && race.race_id === id) loop(); });
  }
  function update(r) {
    if (!r || !race || r.race_id !== race.race_id) return;
    race = r;
    if (phase === 'lobby') {
      if (r.status === 'racing') return countdown();
      if (r.status === 'closed') return gone('That race was closed.');
      if (!r.players.some(p => p.user_id === me())) return gone('You’re no longer in that race.');
      renderLobby();
    } else if (phase === 'racing') renderBoard();
    else if (phase === 'results') {
      if (r.status === 'racing' && r.round > round) return countdown();   // everyone voted yes: next round
      if (!r.players.some(p => p.user_id === me() && !p.left)) return;
      renderResults();
    }
  }
  function gone(msg) {
    const wasLobby = phase === 'lobby' || phase === 'starting';
    stop();
    if (wasLobby) lobby.classList.add('hidden');
    if (msg) toast(msg, 'warn');
    if (drillTabShown()) renderPanel();
  }
  function stop() {
    clearTimeout(pollTimer); clearTimeout(startTimer);
    race = null; phase = 'none'; lastSent = -1; myResult = null; round = 0; voted = false;
    showBoard(false);
  }

  // ---- The start: line the game's 3-2-1 up with the server's start time -------------------
  function countdown() {
    phase = 'starting'; round = race.round || 1; voted = false; myResult = null; renderLobby();
    const startLocal = Date.parse(race.starts_at) - offset, endLocal = Date.parse(race.ends_at) - offset;
    const r = race;
    clearTimeout(startTimer);
    startTimer = setTimeout(() => {
      if (!race || race.race_id !== r.race_id) return;
      lobby.classList.add('hidden');
      phase = 'racing'; lastSent = -1;
      BRGame.startRace({ raceId: r.race_id, mode: r.mode, len: r.len, seed: r.seed, code: r.code, endLocal });
      showBoard(true); renderBoard();
    }, Math.max(0, startLocal - 3200 - Date.now()));   // the game's countdown takes 3.2 seconds
    loop();
  }

  // ---- The live board while racing, and the other drills on the depth track ----------------
  const board = document.createElement('div');
  board.id = 'raceBoard'; board.className = 'race-board hidden'; board.setAttribute('aria-live', 'off');
  $('stage').appendChild(board);
  const marks = document.createElement('div');
  marks.className = 'race-marks';
  $('track').appendChild(marks);
  function showBoard(on) { board.classList.toggle('hidden', !on); marks.classList.toggle('hidden', !on); if (!on) marks.innerHTML = ''; }
  function standings() {
    const mine = me();
    return race.players.map(p => {
      const live = p.user_id === mine && BRGame.racing && phase === 'racing';
      return { ...p, score: p.crashed ? 0 : live ? BRGame.score() : p.score, me: p.user_id === mine };
    }).sort((a, b) => (a.left - b.left) || (b.score - a.score));
  }
  function renderBoard() {
    if (!race || phase !== 'racing') return;
    const rows = standings();
    // the top four, plus you if you're further down
    const shown = rows.filter((p, i) => i < 4 || p.me);
    board.innerHTML = `<div class="rb-h">🏁 LIVE RACE${race.round > 1 ? ` · ROUND ${race.round}` : ''} <span>${esc(race.code)}</span></div>` + shown.map(p => [p, rows.indexOf(p)]).map(([p, i]) =>
      `<div class="rb-row${p.me ? ' me' : ''}${p.left ? ' left' : ''}"><span class="rb-rank">${p.left ? '–' : i + 1}</span>${avatar(p.username)}<span class="rb-name">${p.me ? 'You' : esc(p.username)}</span><span class="rb-score">${p.left ? 'left' : n(p.score)}</span><span class="rb-flag">${p.crashed ? '💥' : p.finished ? '✓' : ''}</span></div>`).join('');
    marks.innerHTML = rows.filter(p => !p.me && !p.left).map(p => `<span class="race-mark" style="top:${BRGame.trackTop(p.score)}px" title="${esc(p.username)}">${esc(String(p.username)[0].toUpperCase())}</span>`).join('');
  }
  // the board follows your own score between server replies
  setInterval(() => { if (phase === 'racing' && race && BRGame.racing) renderBoard(); }, 500);

  // ---- Results ----------------------------------------------------------------------
  const MEDAL = ['🥇', '🥈', '🥉'];
  function over(res) {
    if (!race) return BRGame.showTitle();
    myResult = res; phase = 'results'; showBoard(false);
    $('overReached').innerHTML = res.line;
    renderResults();
    $('over').classList.remove('hidden');
    $('btnAgain').focus();
    const id = race.race_id;
    call('br_race_finish', { race_id: id, score: res.score, correct: res.correct, crashed: res.crashed })
      .then(update, () => { /* the next poll tries again with the state */ }).then(loop);
  }
  function renderResults() {
    if (!race || phase !== 'results') return;
    const mine = me(), rows = standings();
    rows.forEach(p => { if (p.me && myResult) { p.finished = true; p.score = myResult.score; p.crashed = myResult.crashed; } });
    rows.sort((a, b) => (a.left - b.left) || (b.score - a.score));
    const done = race.status === 'finished', waiting = rows.filter(p => !p.finished && !p.left).length;
    const still = rows.filter(p => !p.left), yes = still.filter(p => p.voted || (p.me && voted)).length;
    const myPlace = rows.findIndex(p => p.user_id === mine) + 1, winner = rows[0];
    $('overTitle').textContent = !done ? '🏁 You finished!' : winner && winner.user_id === mine ? '🥇 You won the race!' : `🏁 ${winner ? winner.username : 'Nobody'} wins!`;
    $('overStats').innerHTML = `
      <div class="stat wide race-results">
        ${rows.map((p, i) => `<div class="rr-row${p.me ? ' me' : ''}${p.left ? ' left' : ''}"><span class="rr-rank">${p.left ? '–' : p.finished ? MEDAL[i] || i + 1 : '⛏️'}</span>${avatar(p.username)}<span class="rr-name">${p.me ? 'You' : esc(p.username)}</span><span class="rr-score">${p.left ? 'left the race' : p.crashed ? '💥 0' : p.finished ? n(p.score) : `drilling… ${n(p.score)}`}</span>${done && !p.left ? `<span class="rr-vote${p.voted || (p.me && voted) ? ' yes' : ''}">${p.voted || (p.me && voted) ? '✓ again' : '…'}</span>` : ''}</div>`).join('')}
        ${waiting ? `<div class="rr-wait">Waiting for ${waiting} racer${waiting === 1 ? '' : 's'} to finish…</div>`
          : done && still.length < 2 ? '<div class="rr-wait">Everyone else left, so there\'s no next round.</div>'
          : done ? `<div class="rr-wait">🔁 Play again? ${yes} of ${still.length} voted yes. When everyone says yes, the next round starts with new questions.</div>` : ''}
      </div>
      <div class="stat"><div class="s-label">Your place</div><div class="s-value">${done ? ordinal(myPlace) : '…'}</div></div>
      <div class="stat"><div class="s-label">Your score</div><div class="s-value" style="color:var(--accent)">${n(myResult ? myResult.score : 0)}</div></div>
      <div class="stat"><div class="s-label">Correct answers</div><div class="s-value">${myResult ? myResult.correct : 0}</div></div>`;
    const again = $('btnAgain');
    again.textContent = !voted ? '🔁 Play again' : yes >= still.length ? '🚦 Starting the next round…' : `⏳ Waiting for ${still.length - yes} more`;
    again.disabled = !done || voted || still.length < 2;
    again.title = done ? '' : 'Wait for everyone to finish';
    $('btnMenu').textContent = 'Leave race';
  }
  // Vote to play again. The server starts the next round the moment everyone has said yes.
  function again() {
    if (!race || race.status !== 'finished' || voted) return;
    voted = true; renderResults();
    call('br_race_vote', { race_id: race.race_id, again: true }).then(update, e => { voted = false; renderResults(); toast(errText(e), 'warn'); });
  }
  // Leave: from the lobby (stay on the home screen) or from the results (back to it)
  function leave(fromLobby) {
    const id = race && race.race_id;
    if (fromLobby) lobby.classList.add('hidden');
    stop();
    if (id) call('br_race_leave', { race_id: id }).catch(() => { /* the server times it out anyway */ });
    if (!fromLobby) BRGame.showTitle(); else if (drillTabShown()) renderPanel();
  }
  // Back on the home screen by any other road (pause is off in races, so it's rare): count it as leaving.
  function onTitle() {
    if (phase === 'racing' || phase === 'results') { const id = race && race.race_id; stop(); if (id) call('br_race_leave', { race_id: id }).catch(() => {}); }
    $('btnAgain').disabled = false; $('btnAgain').title = ''; $('btnMenu').textContent = 'Change mode';
    if (Account.status === 'signedIn') loadInvites(); else renderPanel();
  }

  Account.on(() => {
    if (Account.status !== 'signedIn' && phase !== 'none') { const wasLobby = phase === 'lobby' || phase === 'starting'; stop(); if (wasLobby) lobby.classList.add('hidden'); }
    if (Account.status === 'signedIn' && invitesState === 'unknown') loadInvites();
    if (phase === 'lobby') renderLobby();
    if (drillTabShown() && !panel.contains(document.activeElement)) renderPanel();
  });

  return { renderPanel, onTitle, over, again, leave: () => leave(false), get phase() { return phase; } };
})();
