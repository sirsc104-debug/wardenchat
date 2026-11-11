/* Kingdom Clash: online battles (opened at Stormspire, Arena 4).

   The connection: on claude.ai the page uses the `room` capability, which reaches the other people
   who have this game open RIGHT NOW (nothing is stored; messages can drop). Anywhere else it falls
   back to a BroadcastChannel, which reaches other tabs of the same browser only (handy for trying it
   out, and what the tests use). Both look the same to the rest of the game: a lobby everyone shares,
   and named rooms (one per battle).

   Finding an opponent:
   - Quick match: you mark yourself as looking in the lobby's presence; the two who have been looking
     longest pair up, and the one with the lower peer label hosts and invites the other to a fresh
     room.
   - Friendly battle: one player makes a room and reads its five-letter code to a friend, who types it
     in.
   In the room each player shows their setup (name, deck, card levels, King Tower level, evolutions) in
   presence; the host starts the battle with a seed and both setups (mp.start). From then on the battle
   itself runs in js/game.js: both players run the same simulation and swap only their card plays
   (mp.step), so nothing else needs to travel.

   Everything a peer sends is untrusted: setups and plays are checked before use. No names travel
   except the name each player typed for themselves, shown as plain text; nothing is recorded. */
'use strict';

const KCNet = (() => {
  // LIVE PLAY IS OFF for now: only the front end is built. The screens show "coming soon" and nothing
  // connects. When the multiplayer backend exists, connect it here (a transport with the same calls as
  // the lobby below: emit, on, presence, peers, onPeers, join) and set LIVE to true.
  const LIVE = false;
  const TOPICS = ['mp.invite', 'mp.start', 'mp.step', 'mp.emote', 'mp.bye'];
  const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
  let lobby = null, kind = 'none', initP = null;
  const S = { status: 'idle', room: null, role: null, code: '', since: 0, onMatch: null, onChange: null, unsub: [], startTimer: 0, matched: false };

  /* ---------- a BroadcastChannel stand-in for the room (other tabs of this browser) ---------- */
  function localTransport() {
    if (typeof BroadcastChannel !== 'function') return null;
    const me = 'l' + Math.random().toString(36).slice(2, 12), ch = new BroadcastChannel('kingdom-clash-net');
    const rooms = {};
    function makeRoom(name) {
      const listeners = {}, peerFns = [], peers = new Map(); let mine = {}, beat = 0, left = false;
      const snap = () => [{ peer: me, isMe: true, sameTab: true, presence: mine, kind: 'viewer', guest: false, by: null, updatedAt: Date.now() }]
        .concat([...peers.entries()].map(([peer, v]) => ({ peer, isMe: false, sameTab: false, presence: v.presence, kind: 'viewer', guest: false, by: null, updatedAt: v.at })));
      let last = snap();
      const notify = (joined, gone) => { last = snap(); for (const f of peerFns) f({ peers: last, joined: joined || [], left: gone || [], updated: [] }); };
      const post = m => { try { ch.postMessage(Object.assign({ r: name, from: me }, m)); } catch (e) { /* closed */ } };
      const R = {
        name, kind: 'local',
        emit(topic, data) { if (left) return Promise.resolve(); post({ k: 'emit', topic, data }); deliver(topic, { peer: me, isMe: true, sameTab: true, topic, data }); return Promise.resolve(); },
        on(topic, fn) { (listeners[topic] = listeners[topic] || []).push(fn); return () => { listeners[topic] = (listeners[topic] || []).filter(f => f !== fn); }; },
        presence(patch) { mine = Object.assign({}, mine, patch); for (const k of Object.keys(mine)) if (mine[k] === null) delete mine[k]; post({ k: 'pres', p: mine }); notify(); return Promise.resolve(); },
        peers: () => last,
        onPeers(fn) { peerFns.push(fn); setTimeout(() => fn({ peers: last, joined: last, left: [], updated: [] }), 0); return () => { const i = peerFns.indexOf(fn); if (i >= 0) peerFns.splice(i, 1); }; },
        connected: () => true,
        leave() { left = true; post({ k: 'bye' }); clearInterval(beat); delete rooms[name]; return Promise.resolve(); },
      };
      function deliver(topic, msg) { for (const f of (listeners[topic] || []).slice()) try { f(msg); } catch (e) { console.error(e); } }
      R._in = m => {
        if (m.k === 'emit') deliver(m.topic, { peer: m.from, isMe: false, sameTab: false, topic: m.topic, data: m.data, kind: 'viewer', guest: false, by: null });
        else if (m.k === 'pres' || m.k === 'hello') {
          const was = peers.has(m.from);
          peers.set(m.from, { presence: m.p || {}, at: Date.now() });
          if (m.k === 'hello') post({ k: 'pres', p: mine });
          notify(was ? [] : [{ peer: m.from }]);
        } else if (m.k === 'bye') { if (peers.delete(m.from)) notify([], [{ peer: m.from }]); }
      };
      // keep presence fresh; drop tabs not heard from for a few seconds
      beat = setInterval(() => {
        post({ k: 'pres', p: mine });
        const now = Date.now(); let gone = [];
        for (const [peer, v] of peers) if (now - v.at > 4000) { peers.delete(peer); gone.push({ peer }); }
        if (gone.length) notify([], gone);
      }, 1000);
      post({ k: 'hello', p: mine });
      rooms[name] = R;
      return R;
    }
    ch.onmessage = e => { const m = e.data; if (!m || m.from === me) return; const R = rooms[m.r]; if (R) R._in(m); };
    const L = makeRoom('');
    L.join = name => Promise.resolve(rooms[name] || makeRoom(name));
    return L;
  }

  /* ---------- connecting ---------- */
  function init() {
    if (initP) return initP;
    initP = (async () => {
      if (!LIVE) { kind = 'off'; changed(); return kind; }
      let room = null;
      try { room = window.claude && window.claude.use ? await window.claude.use('room') : null; } catch (e) { room = null; }
      if (room) { lobby = room; kind = 'room'; }
      else { lobby = localTransport(); kind = lobby ? 'local' : 'none'; }
      if (lobby) {
        lobby.on('mp.invite', msg => {
          const d = msg.data || {};
          if (S.status !== 'seeking' || msg.isMe || d.to !== myPeer(lobby) || !validCode(d.code)) return;
          enterRoom(d.code, 'guest');
        });
        lobby.onPeers(() => { if (S.status === 'seeking') tryPair(); changed(); });
      }
      changed();
      return kind;
    })();
    return initP;
  }
  const myPeer = r => { const p = (r.peers() || []).find(x => x.isMe && x.sameTab); return p ? p.peer : null; };
  const validCode = c => typeof c === 'string' && /^[a-z0-9]{5}$/.test(c);
  const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  function changed() { if (S.onChange) S.onChange(info()); }
  // How many others have the game open (and are looking for a match).
  function info() {
    const ps = lobby ? lobby.peers() : [];
    const others = ps.filter(p => !p.isMe), seeking = others.filter(p => p.presence && p.presence.kc && p.presence.kc.seek);
    return { kind, status: S.status, code: S.code, role: S.role, online: others.length, seeking: seeking.length };
  }

  /* ---------- your setup, and checking someone else's ---------- */
  function mySetup() {
    const P = KCProgress.state, lv = KCProgress.cardLevels(), evos = KCProgress.evoList();
    return { name: String(P.name || 'Player').slice(0, 16), deck: P.deck.slice(), levels: P.deck.map(id => lv[id] || 1), king: KCProgress.kingInfo().level,
      evos: evos.filter(id => P.deck.includes(id)), trophies: P.trophies | 0, theme: KCProgress.arena().theme };
  }
  const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
  function checkSetup(x) {
    if (!x || typeof x !== 'object' || !Array.isArray(x.deck) || x.deck.length !== 8) return null;
    const deck = x.deck.filter(id => typeof id === 'string' && KC_ALL_CARDS.includes(id));
    if (deck.length !== 8 || new Set(deck).size !== 8) return null;
    const levels = deck.map((_, i) => int(Array.isArray(x.levels) ? x.levels[i] : 1, 1, 15, 1));
    const evos = Array.isArray(x.evos) ? x.evos.filter(id => typeof id === 'string' && KC_EVOS[id] && deck.includes(id)) : [];
    const theme = typeof x.theme === 'string' && KCArenas.ART[x.theme] ? x.theme : 'stormspire';
    return { name: (typeof x.name === 'string' ? x.name : 'Player').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯]/g, '').slice(0, 16) || 'Player',
      deck, levels, king: int(x.king, 1, 15, 1), evos, trophies: int(x.trophies, 0, 99999, 0), theme };
  }

  /* ---------- matchmaking ---------- */
  function tryPair() {
    const ps = lobby.peers(), me = myPeer(lobby);
    const seekers = ps.filter(p => p.presence && p.presence.kc && p.presence.kc.seek)
      .sort((a, b) => (a.presence.kc.since || 0) - (b.presence.kc.since || 0) || (a.peer < b.peer ? -1 : 1));
    if (seekers.length < 2 || !me) return;
    const pair = seekers.slice(0, 2);
    if (!pair.some(p => p.peer === me)) return;
    const other = pair.find(p => p.peer !== me);
    if (me < other.peer) {
      // this side hosts: a new room, and an invitation (sent a few times in case one drops)
      const code = newCode();
      for (const ms of [0, 400, 1200]) setTimeout(() => { if (S.code === code) lobby.emit('mp.invite', { to: other.peer, code }).catch(() => {}); }, ms);
      enterRoom(code, 'host');
    }
  }
  async function quickMatch(onMatch) {
    await init();
    if (!lobby) return { error: 'unavailable' };
    await cancel();
    S.onMatch = onMatch; S.status = 'seeking'; S.since = Date.now();
    await lobby.presence({ kc: { seek: true, since: S.since, trophies: KCProgress.state.trophies | 0 } }).catch(() => {});
    changed(); tryPair();
    return { ok: true };
  }
  async function createRoom(onMatch) {
    await init();
    if (!lobby) return { error: 'unavailable' };
    await cancel();
    S.onMatch = onMatch;
    const code = newCode();
    await enterRoom(code, 'host');
    return { ok: true, code };
  }
  async function joinRoom(code, onMatch) {
    await init();
    if (!lobby) return { error: 'unavailable' };
    code = String(code || '').trim().toLowerCase();
    if (!validCode(code)) return { error: 'code' };
    await cancel();
    S.onMatch = onMatch;
    await enterRoom(code, 'guest');
    return { ok: true, code };
  }
  async function enterRoom(code, role) {
    S.status = role === 'host' ? 'hosting' : 'joining'; S.code = code; S.role = role; S.matched = false;
    if (lobby) lobby.presence({ kc: { seek: false } }).catch(() => {});
    let room;
    try { room = await lobby.join('kc-' + code); } catch (e) { S.status = 'idle'; S.code = ''; changed(); return; }
    if (S.code !== code) { room.leave(); return; }
    S.room = room;
    await room.presence({ kc: { role, setup: mySetup() } }).catch(() => {});
    if (role === 'host') {
      const look = () => {
        if (S.matched || S.room !== room) return;
        const guest = room.peers().find(p => !p.isMe && p.presence && p.presence.kc && p.presence.kc.role === 'guest');
        const setup = guest && checkSetup(guest.presence.kc.setup);
        if (!setup) return;
        const start = { to: guest.peer, seed: (Math.random() * 4294967296) >>> 0, host: mySetup(), guest: setup };
        start.theme = start.host.theme;
        S.matched = true; S.status = 'playing';
        // sent again every second until the guest's first move comes in (js/game.js stops it)
        const send = () => room.emit('mp.start', start).catch(() => {});
        send(); S.startTimer = setInterval(send, 1000);
        changed();
        if (S.onMatch) S.onMatch({ room, role: 'host', peer: guest.peer, start, stopStart: () => clearInterval(S.startTimer) });
      };
      S.unsub.push(room.onPeers(look));
    } else {
      S.unsub.push(room.on('mp.start', msg => {
        const d = msg.data || {};
        if (S.matched || msg.isMe || d.to !== myPeer(room)) return;
        const host = checkSetup(d.host), guest = checkSetup(d.guest);
        if (!host || !guest || !Number.isInteger(d.seed)) return;
        S.matched = true; S.status = 'playing';
        changed();
        if (S.onMatch) S.onMatch({ room, role: 'guest', peer: msg.peer, start: { seed: d.seed >>> 0, host, guest, theme: host.theme }, stopStart: () => {} });
      }));
    }
    changed();
  }
  // Stop looking, and leave any room (telling the other player).
  async function cancel() {
    clearInterval(S.startTimer);
    for (const u of S.unsub) try { u(); } catch (e) { /* gone */ }
    S.unsub = [];
    if (S.room) { const r = S.room; S.room = null; try { await r.emit('mp.bye', {}); } catch (e) { /* gone */ } r.leave().catch(() => {}); }
    if (lobby && S.status === 'seeking') lobby.presence({ kc: { seek: false } }).catch(() => {});
    Object.assign(S, { status: 'idle', code: '', role: null, matched: false });
    changed();
  }
  function onChange(fn) { S.onChange = fn; changed(); }

  return { LIVE, TOPICS, init, info, quickMatch, createRoom, joinRoom, cancel, onChange, checkSetup, mySetup, get kind() { return kind; } };
})();
