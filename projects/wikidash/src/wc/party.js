// Parties on Warden Chat (docs/PARTIES-WKD.md): the same host-runs-the-rules design as the artifact's
// own room, carried over polling instead. Each page calls wkd_party_sync about once a second: it sends
// this player's presence (name, queued moves, reactions) and gets back everyone's presence and, when it
// has changed, the game the host last saved. The host saves with wkd_party_put.
//
// This file makes that look like the artifact room's named room and shared document, so net.js runs
// a party the same way on either.

import { Account } from "./account.js";

const FAST_MS = 350;
const SLOW_MS = 1000;

/** Opens (or creates) a party. Resolves { code, me, partyId, party, ref, listing } or throws an ApiError. */
export async function openWardenParty(code, create) {
  const first = create ? await Account.rpc("wkd_party_create", {}) : await Account.rpc("wkd_party_join", { code });
  const partyId = first.party_id;
  const me = Account.user.id;
  let mine = {};
  let dirty = true;
  let members = first.members || [];
  let rev = 0;
  let doc = null;
  let online = true;
  let stopped = false;
  let timer = 0;
  let inflight = null;
  const peerFns = new Set();
  const connFns = new Set();
  const snapFns = new Set();

  const peers = () =>
    Object.freeze(
      members.map((m) => ({
        peer: m.user_id, by: m.user_id, isMe: m.user_id === me, sameTab: m.user_id === me, kind: "viewer", guest: false,
        presence: Object.freeze(m.user_id === me ? { ...mine } : m.presence || {}),
        updatedAt: Date.now() - (m.seen_ago || 0) * 1000, here: m.user_id === me || (m.seen_ago ?? 99) < 8,
      })).filter((p) => p.here),
    );
  const firePeers = () => { const ps = peers(); for (const fn of peerFns) fn({ peers: ps, joined: [], left: [], updated: [] }); };
  const fireConn = (on) => { if (on !== online) { online = on; for (const fn of connFns) fn(on); } };
  const snapshot = () => ({ id: partyId, exists: Boolean(doc), data: () => doc || undefined, metadata: { fromCache: false, hasPendingWrites: false } });
  const fireSnap = () => { const s = snapshot(); for (const fn of snapFns) fn(s); };

  if (first.doc) {
    doc = first.doc;
    rev = first.rev || 0;
  }

  async function sync() {
    if (stopped) return;
    if (inflight) return inflight;
    const sent = dirty;
    dirty = false;
    inflight = Account.rpc("wkd_party_sync", { party_id: partyId, presence: mine, since_rev: rev })
      .then((r) => {
        fireConn(true);
        if (Array.isArray(r.members)) members = r.members;
        if (r.doc && r.rev > rev) {
          rev = r.rev;
          doc = r.doc;
          fireSnap();
        }
        firePeers();
      }, (e) => {
        if (sent) dirty = true;
        fireConn(false);
        if (e.code === "wkd_no_such_party") stop();
      })
      .finally(() => { inflight = null; });
    return inflight;
  }
  function loop() {
    if (stopped) return;
    sync().finally(() => {
      if (!stopped) timer = setTimeout(loop, dirty ? FAST_MS : SLOW_MS);
    });
  }
  function stop() {
    stopped = true;
    clearTimeout(timer);
  }
  setTimeout(loop, 0);

  const party = {
    name: first.code,
    async presence(patch) {
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete mine[k];
        else mine[k] = v;
      }
      if (JSON.stringify(mine).length > 4096) throw { code: "invalid_argument" };
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(loop, 60);
      firePeers();
    },
    peers,
    onPeers(fn) { peerFns.add(fn); setTimeout(() => fn({ peers: peers(), joined: peers(), left: [], updated: [] }), 0); return () => peerFns.delete(fn); },
    onConnection(fn) { connFns.add(fn); setTimeout(() => fn(online), 0); return () => connFns.delete(fn); },
    connected: () => online,
    async leave() {
      stop();
      await Account.rpc("wkd_party_leave", { party_id: partyId }).catch(() => {});
    },
  };

  let writing = Promise.resolve();
  const ref = {
    set(body) {
      writing = writing.then(() =>
        Account.rpc("wkd_party_put", { party_id: partyId, doc: body }).then((r) => {
          if (r && r.rev > rev) {
            rev = r.rev;
            doc = body;
          }
        }),
      );
      return writing;
    },
    onSnapshot(next) {
      snapFns.add(next);
      setTimeout(() => next(snapshot()), 0);
      return () => snapFns.delete(next);
    },
  };

  return { code: first.code, me, partyId, party, ref, listing: null };
}
