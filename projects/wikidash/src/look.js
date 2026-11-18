// What you're wearing: the page, links, avatar, finish and click effect picked in the Shop. Saved in
// this browser per account. Signed out (or owning nothing), everyone gets the free defaults.

import * as store from "./store.js";
import { Account } from "./wc/account.js";
import { Wallet } from "./wc/wallet.js";
import { COSMETICS, DEFAULT_LOOK, isFree } from "./wc/catalog.js";
import { colorFor } from "./ui.js";

const key = () => `wkd.look.${Account.user ? Account.user.id : "guest"}`;
const listeners = new Set();
const VARS = ["bg", "fg", "muted", "line", "card", "link", "soft", "head"];

/** Whether this item can be worn right now (free, owned, or a members' item while a member). */
export function canWear(item) {
  if (isFree(item)) return true;
  if (!Wallet.me) return false;
  const c = COSMETICS[item];
  if (c && c.price && c.price.member_only && !c.price.claim_from) return Wallet.member && Wallet.owns(item);
  return Wallet.owns(item);
}

export function current() {
  const saved = store.getJSON(key(), {}) || {};
  const out = { ...DEFAULT_LOOK };
  for (const k of Object.keys(DEFAULT_LOOK)) if (saved[k] && canWear(`${k}:${saved[k]}`)) out[k] = saved[k];
  return out;
}

export function choose(kind, id) {
  const saved = store.getJSON(key(), {}) || {};
  saved[kind] = id;
  store.setJSON(key(), saved);
  fire();
}

const fire = () => { const look = current(); for (const fn of listeners) fn(look); };
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
Account.on(fire);
Wallet.on(fire);

/** Dresses one element (the race reader, the shop preview) in a page and a link style. */
export function paint(el, { paper, links }) {
  if (!el) return;
  for (const c of [...el.classList]) if (c.startsWith("lk-") || c.startsWith("pg-")) el.classList.remove(c);
  const p = (COSMETICS[`paper:${paper}`] || {}).p;
  if (p) {
    el.classList.add("pg-on", `pg-${paper}`);
    for (const v of VARS) el.style.setProperty(`--pg-${v}`, p[v]);
  } else for (const v of VARS) el.style.removeProperty(`--pg-${v}`);
  if (links && links !== "classic") el.classList.add(`lk-${links}`);
}

/** The avatar for one player: an equipped glyph on its colour, or their first letter. */
export function avatarHTML(id, name, avatar, size = "") {
  const c = avatar && COSMETICS[`avatar:${avatar}`];
  const glyph = c && c.p && c.p.glyph;
  const span = document.createElement("span");
  span.className = `avatar ${size}${glyph ? " glyph" : ""}`;
  span.setAttribute("aria-hidden", "true");
  span.style.background = glyph ? c.p.bg : colorFor(id);
  span.textContent = glyph || (name || "?").trim().charAt(0).toUpperCase() || "?";
  return span;
}
