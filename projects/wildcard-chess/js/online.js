/* Wildcard Chess: playing a friend online. One player creates a game and shares a 5-letter code,
   the other joins with it. The server (docs/ONLINE-WCC.md) deals the wildcards and keeps the moves in
   order; each side's engine checks every move it receives. Moves travel by polling wcc_online_state.
   Loaded before game.js; uses its helpers ($, G, show, toast…) only at run time. */
'use strict';

const Online = (() => {
  const q = s => document.querySelector(s);
  const POLL_MS = 1500;
  let game = null;          // the latest state for the game in progress (or waiting)
  let timer = 0, polling = false, token = 0, count = 1, fog = false;
  const ERR = {
    wcc_no_such_game: 'No game has that code. Check it with your friend.',
    wcc_game_full: 'That game already has two players.',
    wcc_own_game: 'That’s your own game. Send the code to a friend.',
    wcc_too_many_games: 'You already have 3 online games going. Finish or cancel one first.',
    not_deployed: 'Online play isn’t switched on yet on Warden Chat.',
    offline: 'Can’t reach Warden Chat. Check your connection.',
  };
  const err = e => ERR[e && e.code] || 'Something went wrong. Try again in a moment.';
  const me = () => (game ? game.color : 'w');
  const them = () => (game ? game[me() === 'w' ? 'black' : 'white'] : null);

  /* ---------- the Online screen ---------- */
  function render(msg) {
    const box = q('#onlineBody');
    const available = Account.status !== 'unavailable' && Account.status !== 'checking';
    if (!available) { box.innerHTML = '<p class="ol-note">Online play opens when Warden Chat accounts are switched on for Wildcard Chess.</p>'; return; }
    if (Account.status !== 'signedIn') {
      box.innerHTML = '<p class="ol-note">Sign in with your Warden Chat account to play friends online.</p><button type="button" class="btn primary small" data-shop="signin"><span>Sign in</span></button>';
      return;
    }
    if (game && game.status === 'waiting') {
      box.innerHTML = `<div class="ol-wait"><p class="ol-k">Your game code</p><div class="ol-code" id="olCode">${game.code}</div>
        <button type="button" class="btn small" data-ol="copy"><span>Copy code</span></button>
        <p class="ol-note">Waiting for your friend. They open <b>Online</b>, choose <b>Join</b> and type this code.<span class="thinking"><i></i><i></i><i></i></span></p>
        <p class="ol-note small">You'll play ${game.color === 'w' ? 'White' : 'Black'}, ${game.setup.wild.w.length} wildcard${game.setup.wild.w.length > 1 ? 's' : ''} each${game.setup.fog ? ', in the fog' : ''}.</p>
        <button type="button" class="btn ghost small" data-ol="cancel"><span>Cancel</span></button></div>`;
      return;
    }
    const seg = (id, vals, cur) => `<div class="seg" id="${id}">${vals.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    box.innerHTML = `<div class="ol-cols">
      <div class="ol-card"><h3>Create a game</h3><p class="ol-note">You'll get a code to send a friend. The server deals both sides' wildcards.</p>
        <div class="opt"><span class="opt-l">Wildcards each</span>${seg('olCount', [[1, '1'], [2, '2'], [3, '3']], count)}</div>
        <div class="opt"><span class="opt-l">Fog of war</span>${seg('olFog', [[0, 'Off'], [1, 'On']], fog ? 1 : 0)}</div>
        <button type="button" class="btn primary" data-ol="create"><span>Create game</span></button></div>
      <div class="ol-card"><h3>Join a game</h3><p class="ol-note">Type the code your friend sent you.</p>
        <form id="olJoin" class="ol-join"><input id="olCodeIn" maxlength="5" autocomplete="off" spellcheck="false" placeholder="ABCDE" aria-label="Game code">
        <button class="btn primary" type="submit"><span>Join</span></button></form></div>
    </div>${msg ? `<p class="ol-err" role="alert">${esc(msg)}</p>` : ''}
    <p class="ol-note small">Online games don't earn coins yet. Your wildcard's rules are shown to you; your friend's stay hidden, just like against the computer.</p>`;
  }

  /* ---------- talking to the server ---------- */
  function call(fn, p) { return Account.rpc(fn, p); }
  function create() {
    call('wcc_online_create', { wildcards: count, fog }).then(st => { game = st; render(); startPolling(); }, e => render(err(e)));
  }
  function join(code) {
    call('wcc_online_join', { code: code.trim().toUpperCase() }).then(st => { game = st; begin(); }, e => render(err(e)));
  }
  function cancel() {
    const g = game;
    stop(); game = null; render();
    if (g) call('wcc_online_cancel', { game_id: g.game_id }).catch(() => {});
  }
  function startPolling() { stop(); polling = true; const t = ++token; const tick = () => { if (t !== token) return; poll().finally(() => { if (t === token) timer = setTimeout(tick, POLL_MS); }); }; timer = setTimeout(tick, POLL_MS); }
  function stop() { polling = false; token++; clearTimeout(timer); }
  const applied = () => (G.mode === 'online' && G.hist ? G.hist.length - 1 : 0);

  function poll() {
    if (!game) return Promise.resolve();
    const since = game.status === 'playing' ? applied() : 0;
    return call('wcc_online_state', { game_id: game.game_id, since }).then(st => {
      const was = game.status;
      game = Object.assign({}, game, st);
      if (was === 'waiting' && st.status === 'playing') { begin(); return; }
      if (st.status === 'cancelled') { stop(); game = null; if (current === 'online') render('That game was cancelled.'); return; }
      if (G.mode !== 'online') return;
      // the opponent's moves, in order
      for (const mv of (st.moves || []).slice().sort((a, b) => a.ply - b.ply)) {
        if (mv.ply !== applied() || mv.by === me()) continue;
        const real = matchMove(mv.move);
        if (!real) { dispute(); return; }
        applyMove(real);
      }
      if (st.status === 'finished' && !G.over && st.result) {
        const r = st.result;
        G.over = { over: true, winner: r.winner, reason: r.reason };
        if (G.fog) refreshBoard(true);
        renderWildInfo(); G.render(); endGame(G.over);
        stop();
      }
      renderBars(); renderStatus(); renderPresence();
    }, () => { renderPresence(true); });
  }
  function matchMove(m) {
    if (!m || typeof m !== 'object') return null;
    return G.legal.find(r => r.o === m.o && r.f === m.f && r.t === m.t && r.k === m.k && (r.promo || '') === (m.promo || '') && (r.rt || '') === (m.rt || '') && !!r.tele === !!m.tele) || null;
  }
  function dispute() {
    stop();
    toast('<span>Your opponent sent a move that doesn’t fit this board</span>', 'var(--red)');
    call('wcc_online_finish', { game_id: game.game_id, winner: 'draw', reason: 'disputed' }).catch(() => {});
    G.over = { over: true, winner: null, reason: 'disputed' };
    G.render(); endGame(G.over);
  }

  /* ---------- the game itself ---------- */
  function begin() {
    show('game');
    G.start({ mode: 'online', human: game.color, level: 'pro', wild: game.setup.wild, slots: game.setup.slots, fog: !!game.setup.fog });
    startPolling();
  }
  /* game.js calls this after every move it applies; only the player's own moves go to the server. */
  function moved(s, m, ns, st) {
    if (G.mode !== 'online' || !game) return;
    if (s.turn !== me()) {   // the opponent's move, already on the server: just report a finish our engine sees
      if (st.over) { call('wcc_online_finish', { game_id: game.game_id, winner: st.winner || 'draw', reason: st.reason }).catch(() => {}); stop(); }
      return;
    }
    const move = { o: m.o, f: m.f, t: m.t, k: m.k };
    if (m.promo) move.promo = m.promo;
    if (m.rt) move.rt = m.rt;
    if (m.tele) move.tele = 1;
    call('wcc_online_move', { game_id: game.game_id, ply: G.hist.length - 2, move, next_turn: ns.turn }).then(() => {
      if (st.over) {
        const winner = st.winner || 'draw';
        call('wcc_online_finish', { game_id: game.game_id, winner, reason: st.reason }).catch(() => {});
        stop();
      }
    }, e => toast(`<span>${e.code === 'wcc_out_of_sync' ? 'Out of sync with the server. Reload the game from the Online screen.' : 'That move didn’t reach Warden Chat. Check your connection.'}</span>`, 'var(--red)'));
  }
  function resign() {
    if (!game) return Promise.resolve();
    stop();
    return call('wcc_online_resign', { game_id: game.game_id }).catch(() => {});
  }
  function claim() {
    call('wcc_online_claim', { game_id: game.game_id }).then(st => { game = Object.assign({}, game, st); poll(); },
      e => toast(`<span>${e.code === 'wcc_opponent_here' ? 'Your opponent is still here.' : esc(err(e))}</span>`, 'var(--gold)'));
  }
  function renderPresence(lost) {
    const el = q('#onlinePresence');
    if (!el) return;
    if (G.mode !== 'online' || G.over || !game) { el.hidden = true; return; }
    const away = game.opponent_seen;
    el.hidden = !(lost || away > 20);
    el.innerHTML = lost ? 'Can’t reach Warden Chat. Retrying…'
      : away > 120 ? `${esc(oppName())} has been gone for ${Math.round(away / 60)} min. <button type="button" class="btn small" data-ol="claim"><span>Claim the win</span></button>`
        : `${esc(oppName())} seems to have lost connection…`;
  }
  const oppName = () => (them() ? them().username : 'Your opponent');

  function init() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-ol], #olCount button, #olFog button');
      if (!t) return;
      if (t.closest('#olCount')) { count = +t.dataset.v; render(); return; }
      if (t.closest('#olFog')) { fog = t.dataset.v === '1'; render(); return; }
      const a = t.dataset.ol;
      if (a === 'create') create();
      else if (a === 'cancel') cancel();
      else if (a === 'claim') claim();
      else if (a === 'copy') {
        const code = game && game.code;
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('<span>Code copied</span>', 'var(--gold)'), () => selectCode());
        else selectCode();
      }
    });
    document.addEventListener('submit', e => { if (e.target.id === 'olJoin') { e.preventDefault(); join(q('#olCodeIn').value); } });
    Account.on(() => { if (current === 'online') render(); });
  }
  function selectCode() { const el = q('#olCode'); if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  /* Leaving the game screen for good. */
  function leave() { stop(); game = null; }
  return { init, render, moved, resign, leave, oppName, oppMember: () => !!(them() && them().member), renderPresence, get active() { return !!game; } };
})();
