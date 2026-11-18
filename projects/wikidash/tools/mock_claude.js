// Test double for the artifact runtime: room + db + user across tabs of one browser, via BroadcastChannel/localStorage.
(() => {
  const peerId = Math.random().toString(36).slice(2, 10);
  function makeRoom(name) {
    const ch = new BroadcastChannel('room:' + name);
    let mine = {};
    const others = new Map();
    const peerFns = new Set();
    const snapshot = () => Object.freeze([{ peer: peerId, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze({ ...mine }), updatedAt: Date.now() },
      ...[...others.entries()].map(([peer, presence]) => ({ peer, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence, updatedAt: Date.now() }))]);
    const fire = () => { const peers = snapshot(); for (const fn of peerFns) fn({ peers, joined: [], left: [], updated: [] }); };
    ch.onmessage = (e) => {
      const m = e.data;
      if (m.t === 'p') { others.set(m.peer, Object.freeze(m.presence)); fire(); }
      else if (m.t === 'hi') ch.postMessage({ t: 'p', peer: peerId, presence: mine });
      else if (m.t === 'bye') { others.delete(m.peer); fire(); }
    };
    ch.postMessage({ t: 'hi' });
    addEventListener('pagehide', () => ch.postMessage({ t: 'bye', peer: peerId }));
    return {
      name,
      async emit() {},
      on() { return () => {}; },
      async presence(patch) { for (const [k, v] of Object.entries(patch)) { if (v === null) delete mine[k]; else mine[k] = v; } if (JSON.stringify(mine).length > 4096) throw { code: 'invalid_argument' }; ch.postMessage({ t: 'p', peer: peerId, presence: mine }); setTimeout(fire, 0); },
      peers: snapshot,
      onPeers(fn) { peerFns.add(fn); setTimeout(() => fn({ peers: snapshot(), joined: snapshot(), left: [], updated: [] }), 0); return () => peerFns.delete(fn); },
      connected: () => true,
      onConnection(fn) { setTimeout(() => fn(true), 0); return () => {}; },
      async leave() { ch.postMessage({ t: 'bye', peer: peerId }); ch.close(); },
    };
  }
  const lobby = makeRoom('__lobby');
  const rooms = new Map();
  const room = { ...lobby, async join(n) { if (!rooms.has(n)) rooms.set(n, makeRoom(n)); return rooms.get(n); } };
  const subs = new Map();
  const key = (p) => 'mockdb:' + p;
  const read = (p) => { const v = localStorage.getItem(key(p)); return v ? JSON.parse(v) : null; };
  const snap = (p) => { const d = read(p); return { id: p.split('/').pop(), exists: !!d, data: () => d || undefined, metadata: { fromCache: false, hasPendingWrites: false } }; };
  const notify = (p) => { for (const fn of subs.get(p) || []) fn(snap(p)); };
  addEventListener('storage', (e) => { if (e.key && e.key.startsWith('mockdb:')) notify(e.key.slice(7)); });
  const doc = (p) => ({
    id: p.split('/').pop(), path: p,
    async get() { return snap(p); },
    async set(d) { const s = JSON.stringify(d); if (s.length > 262144) throw { code: 'invalid_argument' }; localStorage.setItem(key(p), s); setTimeout(() => notify(p), 5); },
    async update(d) { localStorage.setItem(key(p), JSON.stringify({ ...read(p), ...d })); notify(p); },
    async delete() { localStorage.removeItem(key(p)); notify(p); },
    onSnapshot(fn) { if (!subs.has(p)) subs.set(p, new Set()); subs.get(p).add(fn); setTimeout(() => fn(snap(p)), 10); return () => subs.get(p).delete(fn); },
  });
  const collection = (c) => {
    const q = (filters) => ({
      where(f, op, v) { return q([...filters, [f, v]]); }, orderBy() { return this; }, limit() { return this; },
      async get() { const docs = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('mockdb:' + c + '/')) continue; const p = k.slice(7); const d = read(p); if (filters.every(([f, v]) => d[f] === v)) docs.push(snap(p)); } return { docs, size: docs.length, empty: !docs.length }; },
    });
    return { ...q([]), doc: (id) => doc(c + '/' + id) };
  };
  const db = { doc, collection };
  const uid = 'u' + peerId;
  const user = { id: async () => uid, isOwner: async () => false, canEdit: async () => false };
  window.claude = { use: (n) => Promise.resolve({ room, db, user }[n] || null) };
})();
