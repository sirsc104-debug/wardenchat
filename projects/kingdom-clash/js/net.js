/* Kingdom Clash: Play a Friend, battles against a friend (opened at Stormspire, Arena 4).

   The connection: once a player is signed in with their WardenChat account, js/account.js gives a
   transport over Supabase Realtime (a private channel per room, kc-<code>). With LIVE on and no backend,
   claude.ai's `room` capability, or else a BroadcastChannel that reaches other tabs of the same browser
   only (handy for trying it out, the demo build and the tests). All of them look the same to the rest
   of the game: a lobby, and named rooms (one per battle).

   Finding your friend (there is no matchmaking with strangers):
   - Invite a friend: friends come from the player's WardenChat account (the backend connects them with
     connectFriends, below). Inviting one makes a room and sends them its code through the account;
     they get an invite in the game and accepting joins the room.
   - Invite with a code: one player makes a room and reads its five-letter code to a friend, who types
     it in.
   In the room each player shows their setup (name, deck, card levels, King Tower level, evolutions) in
   presence; the host starts the battle with a seed and both setups (mp.start). From then on the battle
   itself runs in js/game.js: both players run the same simulation and swap only their card plays
   (mp.step), so nothing else needs to travel.

   Everything a peer sends is untrusted: setups and plays are checked before use. No names travel
   except the name each player typed for themselves, shown as plain text; nothing is recorded. */
'use strict';

const KCNet = (() => {
  // LIVE stays off: battles with friends switch on when the backend gives a transport (a signed-in
  // WardenChat account, js/backend.js); until then the screens say "coming soon" and nothing connects.
  const LIVE = false;
  const TOPICS = ['mp.start', 'mp.step', 'mp.emote', 'mp.bye'];
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
      // the backend's own lobby (js/backend.js) when it is connected, which also switches battles on
      const backend = typeof KCBackend !== 'undefined' ? KCBackend.transport() : null;
      if (!LIVE && !backend) { kind = 'off'; changed(); return kind; }
      let room = null;
      if (backend) { lobby = backend; kind = 'backend'; }
      else {
        try { room = window.claude && window.claude.use ? await window.claude.use('room') : null; } catch (e) { room = null; }
        if (room) { lobby = room; kind = 'room'; }
        else { lobby = localTransport(); kind = lobby ? 'local' : 'none'; }
      }
      if (lobby) lobby.onPeers(() => changed());
      changed();
      return kind;
    })();
    return initP;
  }
  const myPeer = r => { const p = (r.peers() || []).find(x => x.isMe && x.sameTab); return p ? p.peer : null; };
  const validCode = c => typeof c === 'string' && /^[a-z0-9]{5}$/.test(c);
  const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  function changed() { if (S.onChange) S.onChange(info()); }
  // Where things stand: the connection, the room, and whether the WardenChat friends list is connected.
  function info() {
    const ps = lobby ? lobby.peers() : [];
    return { kind, status: S.status, code: S.code, role: S.role, online: ps.filter(p => !p.isMe).length, friends: !!friendsP, invitee: S.invitee || null };
  }

  /* ---------- WardenChat friends ----------
     The game keeps no friends list of its own: friends are the player's WardenChat friends. The backend
     connects them by calling KCNet.connectFriends(provider) once the player is signed in, where
       provider.list()                 -> Promise of [{ id, name, online, inGame, avatar? }]
       provider.invite(friendId, code) -> Promise (send a battle invite: the room code to join)
       provider.onInvite(fn)           -> an unsubscribe function; calls fn({ id, from: { id, name }, code })
                                          when a friend invites you
       provider.decline(inviteId)      -> Promise (optional: tell the inviter you said no)
     Until it is connected, the Friends screen says friends come with the WardenChat account. */
  let friendsP = null, friendsOff = null;
  function connectFriends(provider) {
    if (friendsOff) { try { friendsOff(); } catch (e) { /* gone */ } friendsOff = null; }
    friendsP = provider || null;
    if (friendsP && friendsP.onInvite) friendsOff = friendsP.onInvite(inv => { if (inv && validCode(inv.code) && S.onInvite) S.onInvite(inv); });
    changed();
  }
  async function friends() {
    if (!friendsP) return null;
    try { const list = await friendsP.list(); return Array.isArray(list) ? list.filter(f => f && f.id).map(f => ({ id: String(f.id), name: String(f.name || 'Friend').slice(0, 24), online: !!f.online, inGame: !!f.inGame, avatar: f.avatar || null })) : []; }
    catch (e) { return []; }
  }
  // Invite a friend: a room of your own, its code sent to them through the account.
  async function inviteFriend(friend, onMatch) {
    if (!friendsP) return { error: 'friends' };
    const r = await createRoom(onMatch);
    if (!r.ok) return r;
    S.invitee = { id: friend.id, name: friend.name };
    try { await friendsP.invite(friend.id, r.code); } catch (e) { await cancel(); return { error: 'invite' }; }
    changed();
    return r;
  }
  function onInvite(fn) { S.onInvite = fn; }
  async function declineInvite(inv) { if (friendsP && friendsP.decline && inv && inv.id) try { await friendsP.decline(inv.id); } catch (e) { /* gone */ } }
  // accepting tells the inviter's account (the room itself is joined with joinRoom)
  async function acceptInvite(inv) { if (friendsP && friendsP.accept && inv && inv.id) try { await friendsP.accept(inv.id); } catch (e) { /* gone */ } }
  // friend requests, when the account has them: { incoming: [{ id, name }], outgoing: [...] }
  function friendRequests() {
    if (!friendsP || !friendsP.requests) return null;
    try { const r = friendsP.requests() || {}; const clean = a => (Array.isArray(a) ? a.filter(x => x && x.id).map(x => ({ id: String(x.id), name: String(x.name || 'Player').slice(0, 24) })) : []); return { incoming: clean(r.incoming), outgoing: clean(r.outgoing) }; }
    catch (e) { return null; }
  }
  // send a friend request by WardenChat username; resolves to { status } or { error: code }
  async function addFriend(name) {
    if (!friendsP || !friendsP.add) return { error: 'friends' };
    try { return Object.assign({ ok: true }, await friendsP.add(name)); } catch (e) { return { error: String((e && e.code) || 'error').replace(/^(kc|br)_/, '') }; }
  }
  async function answerFriend(id, accept) {
    if (!friendsP || !friendsP.respond) return { error: 'friends' };
    try { await friendsP.respond(id, accept); return { ok: true }; } catch (e) { return { error: String((e && e.code) || 'error').replace(/^(kc|br)_/, '') }; }
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
  // Leave any room (telling the other player).
  async function cancel() {
    clearInterval(S.startTimer);
    for (const u of S.unsub) try { u(); } catch (e) { /* gone */ }
    S.unsub = [];
    if (S.room) { const r = S.room; S.room = null; try { await r.emit('mp.bye', {}); } catch (e) { /* gone */ } r.leave().catch(() => {}); }
    Object.assign(S, { status: 'idle', code: '', role: null, matched: false, invitee: null });
    changed();
  }
  function onChange(fn) { S.onChange = fn; changed(); }

  // battles with friends are on: LIVE, or a backend lobby connected
  const isLive = () => LIVE || !!(typeof KCBackend !== 'undefined' && KCBackend.transport());
  // start over (when the backend connects after the game has started)
  function reinit() { initP = null; lobby = null; kind = 'none'; }
  return { LIVE, isLive, reinit, TOPICS, init, info, createRoom, joinRoom, cancel, onChange, checkSetup, mySetup, connectFriends, friends, inviteFriend, onInvite, declineInvite,
    acceptInvite, friendRequests, addFriend, answerFriend, localTransport,
    get kind() { return kind; } };
})();
