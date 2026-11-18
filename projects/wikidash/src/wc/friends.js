// Friends, shared with Brain Rocket and the other SirSC games (their br_friendships table), and party
// invites between friends. docs/ACCOUNTS-WKD.md and docs/PARTIES-WKD.md.

import { Account } from "./account.js";

const listeners = new Set();
let data = { friends: [], incoming: [], outgoing: [] };
let invites = [];
let loading = null;
let timer = 0;
const emit = () => listeners.forEach((fn) => { try { fn(data, invites); } catch (e) { console.error(e); } });

function load() {
  if (Account.status !== "signedIn") return Promise.resolve(data);
  if (!loading) {
    loading = Promise.all([
      Account.rpc("wkd_friends").catch(() => null),
      Account.rpc("wkd_party_invites").catch(() => null),
    ])
      .then(([f, inv]) => {
        if (f && typeof f === "object") data = { friends: f.friends || [], incoming: f.incoming || [], outgoing: f.outgoing || [] };
        if (Array.isArray(inv)) invites = inv;
        emit();
        return data;
      })
      .finally(() => { loading = null; });
  }
  return loading;
}
const thenReload = (p) => p.then((r) => load().then(() => r));

Account.on(() => {
  clearInterval(timer);
  if (Account.status === "signedIn") {
    load();
    // Invites and requests arrive while you're on the menu.
    timer = setInterval(() => document.visibilityState === "visible" && load(), 12000);
  } else {
    data = { friends: [], incoming: [], outgoing: [] };
    invites = [];
    emit();
  }
});

export const Friends = {
  get list() { return data.friends; },
  get incoming() { return data.incoming; },
  get outgoing() { return data.outgoing; },
  get invites() { return invites; },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  load,
  add: (username) => thenReload(Account.rpc("wkd_friend_request", { target_username: username.trim() })),
  answer: (requestId, accept) => thenReload(Account.rpc("wkd_friend_respond", { request_id: requestId, accept: Boolean(accept) })),
  cancel: (requestId) => thenReload(Account.rpc("wkd_friend_cancel", { request_id: requestId })),
  remove: (userId) => thenReload(Account.rpc("wkd_friend_remove", { friend_id: userId })),
  invite: (partyId, friendId) => Account.rpc("wkd_party_invite", { party_id: partyId, friend_id: friendId }),
  dismissInvite: (partyId) => thenReload(Account.rpc("wkd_party_decline", { party_id: partyId })),
};
