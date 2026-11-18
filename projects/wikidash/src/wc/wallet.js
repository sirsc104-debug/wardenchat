// The SirSC wallet as WikiDash sees it (game id "wkd"): coins, diamonds, membership and owned items,
// through the shared sirsc_* functions (ECONOMY-API.md in sirsc104-debug/claude), plus wkd_reward for
// coins after a race (docs/ECONOMY-WKD.md). The server decides every balance and price.

import { Account } from "./account.js";
import { WKD_CATALOG } from "./catalog.js";

const GAME = "wkd";
const listeners = new Set();
let me = null;
let loading = null;
let onClaim = null;
const emit = () => listeners.forEach((fn) => { try { fn(me); } catch (e) { console.error(e); } });
const keep = (m) => { if (m && typeof m === "object" && "coins" in m) { me = m; emit(); } return me; };
const call = (fn, p) => Account.rpc(fn, p);

function load() {
  if (Account.status !== "signedIn") {
    me = null;
    emit();
    return Promise.resolve(null);
  }
  if (loading) return loading;
  loading = call("sirsc_me", { game: GAME })
    .then((m) => {
      keep(m);
      return m && m.member
        ? call("sirsc_member_claim", { game: GAME }).then((c) => {
            keep(c && c.me);
            if (c && onClaim && (c.diamonds_added > 0 || (c.claimed && c.claimed.length))) onClaim(c);
            return me;
          }, () => me)
        : me;
    })
    .catch(() => me)
    .finally(() => { loading = null; });
  return loading;
}

Account.on(() => {
  if (Account.status === "signedIn" && !me && !loading) load();
  if (Account.status !== "signedIn" && me) {
    me = null;
    emit();
  }
});

export const Wallet = {
  GAME,
  get me() { return me; },
  get coins() { return me ? me.coins : 0; },
  get diamonds() { return me ? me.diamonds : 0; },
  get member() { return Boolean(me && me.member); },
  get memberUntil() { return me && me.member_until; },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  onClaim(fn) { onClaim = fn; },
  load,
  owns: (item) => Boolean(me) && (me.owned || []).some((o) => o.item_id === item),
  price: (item) => (me && (me.catalog || []).find((c) => c.item_id === item)) || WKD_CATALOG.find((c) => c.item_id === item) || null,
  catalog: () => (me && me.catalog && me.catalog.length ? me.catalog : WKD_CATALOG),
  buy: (item, currency) => call("sirsc_buy", { game: GAME, item_id: item, target: "", currency }).then(keep),
  requestDiamonds: (diamonds, note) => call("sirsc_request_diamonds", { diamonds, note: note || "" }).then(keep),
  cancelRequest: (id) => call("sirsc_cancel_request", { request_id: id }).then(keep),
  /** A finished solo or daily run: the server works out the coins and returns the breakdown. */
  reward(r) {
    return call("wkd_reward", {
      kind: r.kind, level: r.level || "", clicks: r.clicks | 0, par: r.par | 0, duration_ms: Math.round(r.durationMs),
      start: r.start, target: r.target, date: r.date || "",
    }).then((x) => { keep(x && x.me); return x; });
  },
};

/** The SirSC Diamond, the badge SirSC Members wear by their name. */
export const BADGE_SVG =
  '<svg class="sirsc-badge" viewBox="0 0 24 24" role="img" aria-label="SirSC Member"><title>SirSC Member</title>' +
  '<path d="M6 3 H18 L22.5 9 L12 21.5 L1.5 9 Z" fill="url(#sirsc-badge-grad)" stroke="#1e3a8a" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M1.5 9 H22.5 M6 3 L9 9 L12 21.5 L15 9 L18 3 M9 9 L12 3 L15 9" fill="none" stroke="#1e3a8a" stroke-width=".8" stroke-linejoin="round" opacity=".7"/></svg>';

export function installBadgeDefs() {
  if (document.getElementById("sirsc-badge-defs")) return;
  const d = document.createElement("div");
  d.innerHTML =
    '<svg id="sirsc-badge-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="sirsc-badge-grad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#e9fbff"/><stop offset=".5" stop-color="#7fd8ff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs></svg>';
  document.body.appendChild(d.firstChild);
}
