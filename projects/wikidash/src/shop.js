// The Shop: a live preview on the left (a page in the chosen look, with your avatar, a finish to play and
// links that burst when clicked) and the SirSC wallet's paper panel on the right. Pages, Links, Avatars,
// Finishes and Clicks; Membership; Diamonds. Every purchase goes through the wallet; the server decides.

import { h, clear, toast } from "./ui.js";
import { Account, errText } from "./wc/account.js";
import { Wallet, BADGE_SVG } from "./wc/wallet.js";
import { KINDS, KIND_NAMES, DEFAULT_LOOK, COSMETICS, cosmeticOf, itemsOf, isFree } from "./wc/catalog.js";
import * as Look from "./look.js";
import { finale, spark } from "./fx.js";
import { sfx } from "./sound.js";
import { openSignIn } from "./acct.js";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");
let S = null;

export function openShop(tab) {
  if (S) return setTab(tab || S.tab);
  S = { tab: tab || "paper", preview: null, confirm: "", stops: [] };
  S.walletRow = h("div", { class: "shop-wallet" });
  S.featured = h("div", { class: "shop-feat" });
  S.tabsEl = h("div", { class: "shop-tabs", role: "tablist" });
  S.grid = h("div", { class: "shop-grid" });
  S.pv = h("div", { class: "shop-pv" });
  S.pvCap = h("p", { class: "pv-cap" });
  const back = h("button", { class: "btn small alt shop-back", type: "button", onclick: closeShop }, "← Back");
  S.el = h(
    "div",
    { class: "shop-screen sirsc", role: "dialog", "aria-modal": "true", "aria-label": "Shop" },
    h("div", { class: "shop-left" }, S.pv, S.pvCap),
    h("section", { class: "shop-panel" }, h("div", { class: "shop-head" }, h("div", null, h("div", { class: "shop-eyebrow" }, "SirSC wallet"), h("h2", null, "Shop")), back), S.walletRow, S.featured, S.tabsEl, S.grid),
  );
  document.body.append(S.el);
  document.body.classList.add("shop-open");
  requestAnimationFrame(() => S && S.el.classList.add("in"));
  S.el.addEventListener("click", onClick);
  S.el.addEventListener("submit", onSubmit);
  const onKey = (e) => e.key === "Escape" && closeShop();
  document.addEventListener("keydown", onKey);
  S.stops.push(() => document.removeEventListener("keydown", onKey), Account.on(render), Wallet.on(render), Look.onChange(render));
  if (Account.status === "signedIn") Wallet.load();
  setTab(S.tab);
  setPreview(`paper:${Look.current().paper}`);
}

export function closeShop() {
  if (!S) return;
  for (const s of S.stops) s();
  const el = S.el;
  el.classList.remove("in");
  setTimeout(() => el.remove(), 220);
  document.body.classList.remove("shop-open");
  S = null;
  document.dispatchEvent(new CustomEvent("wkd:shop-closed"));
}

function setTab(tab) {
  S.tab = tab;
  S.confirm = "";
  render();
}

const available = () => Account.status !== "unavailable" && Account.status !== "checking";

// ── the panel ────────────────────────────────────────────────────────────

function render() {
  if (!S) return;
  renderWallet();
  renderFeatured();
  clear(S.tabsEl);
  for (const [k, name] of KINDS) S.tabsEl.append(h("button", { type: "button", class: S.tab === k ? "on" : "", "data-tab": k }, name));
  S.tabsEl.append(h("button", { type: "button", class: `tab-member ${S.tab === "member" ? "on" : ""}`, "data-tab": "member" }, "👑 Membership"));
  S.tabsEl.append(h("button", { type: "button", class: S.tab === "diamonds" ? "on" : "", "data-tab": "diamonds" }, "💎 Diamonds"));
  clear(S.grid);
  S.grid.classList.toggle("single", S.tab === "member" || S.tab === "diamonds");
  if (S.tab === "member") return S.grid.append(memberCard());
  if (S.tab === "diamonds") return S.grid.append(diamondsCard());
  for (const item of itemsOf(S.tab)) S.grid.append(card(item));
  renderPreview();
}

function renderWallet() {
  clear(S.walletRow);
  if (!available()) {
    S.walletRow.append(h("span", { class: "sw-note" }, "The Shop opens when Warden Chat accounts are switched on. You can look around."));
    return;
  }
  if (Account.status !== "signedIn") {
    S.walletRow.append(h("button", { class: "btn small", type: "button", "data-shop": "signin" }, "Sign in to buy"), h("span", { class: "sw-note" }, "Uses your Warden Chat account."));
    return;
  }
  if (Account.demo) S.walletRow.append(h("span", { class: "spill demo", title: "This build uses a pretend wallet stored in your browser. Nothing touches a real Warden Chat account." }, "Demo wallet"));
  const who = h("span", { class: "spill who" }, Account.user.username);
  if (Wallet.member) who.insertAdjacentHTML("beforeend", BADGE_SVG);
  S.walletRow.append(h("span", { class: "spill" }, "🪙 ", h("b", null, Wallet.me ? fmt(Wallet.coins) : "…")), h("span", { class: "spill" }, "💎 ", h("b", null, Wallet.me ? fmt(Wallet.diamonds) : "…")), who);
}

/** Four picks a week, one of each kind where possible, the same for everyone. */
function featured() {
  const week = Math.floor((Date.now() / 864e5 + 3) / 7);
  let seed = week * 9301 + 49297;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pool = Wallet.catalog().filter((c) => !c.member_only).map((c) => c.item_id);
  const out = [];
  const kinds = new Set();
  let guard = 0;
  while (out.length < 4 && pool.length && guard++ < 200) {
    const i = Math.floor(rnd() * pool.length);
    const id = pool[i];
    const k = id.split(":")[0];
    if (kinds.has(k) && pool.some((x) => !kinds.has(x.split(":")[0]))) continue;
    pool.splice(i, 1);
    kinds.add(k);
    out.push(id);
  }
  return out;
}

function renderFeatured() {
  clear(S.featured);
  const until = new Date((Math.floor((Date.now() / 864e5 + 3) / 7) * 7 + 4) * 864e5);
  const row = h("div", { class: "feat-row" });
  for (const item of featured()) row.append(card(item, true));
  S.featured.append(h("div", { class: "feat-head" }, h("h3", null, "Featured this week"), h("span", null, `New picks ${until.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}`)), row);
}

function stateOf(item) {
  const c = cosmeticOf(item);
  const price = Wallet.price(item);
  const free = isFree(item);
  const owned = free || Wallet.owns(item);
  const equipped = Look.current()[c.kind] === c.id;
  return { c, price, free, owned, equipped };
}

function buyBits(item) {
  const { c, price, free, owned, equipped } = stateOf(item);
  const out = [];
  if (owned) {
    const wearable = Look.canWear(item);
    out.push(h("span", { class: "own" }, free ? "Free" : "Owned"));
    if (equipped) out.push(h("span", { class: "equipped" }, "Equipped"));
    else if (wearable) out.push(h("button", { class: "btn small", type: "button", "data-equip": item }, "Equip"));
    else out.push(h("span", { class: "member-only" }, "👑 Members only"));
    return out;
  }
  if (price && price.member_only) {
    const when = price.claim_from ? `Members, ${new Date(price.claim_from).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}` : "Every member";
    out.push(h("span", { class: "member-only" }, `👑 ${when}`));
    return out;
  }
  for (const cur of ["coins", "diamonds"]) {
    if (!price || !price[cur]) continue;
    const key = `${item}|${cur}`;
    const label = cur === "coins" ? `🪙 ${fmt(price.coins)}` : `💎 ${price.diamonds}`;
    out.push(h("button", { class: `btn small ${cur === "diamonds" ? "dia" : ""} ${S.confirm === key ? "confirm" : ""}`, type: "button", "data-buy": key }, S.confirm === key ? `Buy for ${label}?` : label));
  }
  if (price && !price.coins && price.diamonds) out.push(h("span", { class: "dia-only" }, "Diamonds only"));
  void c;
  return out;
}

function card(item, feat = false) {
  const c = cosmeticOf(item);
  const el = h(
    "div",
    { class: `item${feat ? " feat" : ""}${S.preview === item ? " pv" : ""}`, "data-preview": item, tabindex: "0", role: "button", "aria-label": `Preview ${c.name}` },
    h("div", { class: "item-art" }, swatch(item)),
    h("div", { class: "item-txt" }, feat ? h("div", { class: "item-kind" }, KIND_NAMES[c.kind]) : null, h("div", { class: "item-name" }, c.name), feat ? null : h("div", { class: "item-desc" }, c.desc)),
    h("div", { class: "item-buy" }, buyBits(item)),
  );
  el.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && e.target === el && (e.preventDefault(), setPreview(item)));
  return el;
}

/** A small picture of each item. */
function swatch(item) {
  const c = cosmeticOf(item);
  const p = c.p || {};
  if (c.kind === "paper") {
    const pp = p.bg ? p : { bg: "#f3efe5", fg: "#14130f", link: "#1d3fd0", line: "#c4bba2" };
    return h("div", { class: `sw-paper${p.stars ? " stars" : ""}`, style: { "--b": pp.bg, "--f": pp.fg, "--l": pp.link, "--ln": pp.line } }, h("i", { class: "t" }), h("i"), h("i", { class: "k" }), h("i"), h("i", { class: "s" }));
  }
  if (c.kind === "links") return h("div", { class: `sw-links lk-${c.id}` }, h("span", null, "see ", h("a", { class: "wl" }, "Moon"), " and ", h("a", { class: "wl" }, "Tide")));
  if (c.kind === "avatar") return Look.avatarHTML("you", Account.user ? Account.user.username : "You", c.id, "xl");
  if (c.kind === "finale") return h("div", { class: `sw-finale fx-${p.fx}` }, h("span", null, "🏁"));
  return h("div", { class: `sw-spark sp-${p.fx}`, style: { "--c1": (p.c || [])[0], "--c2": (p.c || [])[1] || (p.c || [])[0] } }, h("i"), h("i"), h("i"), h("i"), h("i"), h("i"));
}

// ── the live preview ─────────────────────────────────────────────────────

function setPreview(item) {
  S.preview = item;
  const c = cosmeticOf(item);
  if (c.kind === "finale") finale(c.id);
  render();
}

function renderPreview() {
  const item = S.preview;
  if (!item) return;
  const c = cosmeticOf(item);
  const look = { ...Look.current(), [c.kind]: c.id };
  clear(S.pv);
  const art = h(
    "div",
    { class: "pv-article" },
    h("div", { class: "pv-bar" }, Look.avatarHTML("you", Account.user ? Account.user.username : "You", look.avatar, "sm"), h("b", null, Account.user ? Account.user.username : "You"), h("span", null, "3 clicks · 0:41.2")),
    h("h3", { class: "art-title" }, "Moon"),
    h("div", { class: "art-from" }, "From Wikipedia, the free encyclopedia."),
    h(
      "div",
      { class: "article mw-parser-output" },
      h("p", null, "The ", h("b", null, "Moon"), " is ", h("a", { class: "wl" }, "Earth"), "'s only natural ", h("a", { class: "wl" }, "satellite"), ". It orbits at an average distance of 384,400 km, about 30 times Earth's diameter. Its ", h("a", { class: "wl" }, "gravity"), " raises the ", h("a", { class: "wl" }, "tides"), "."),
      h("p", null, "The Moon was first reached by the uncrewed ", h("a", { class: "wl" }, "Luna 2"), " in 1959, and first walked on during ", h("a", { class: "wl" }, "Apollo 11"), " in 1969."),
    ),
  );
  art.querySelectorAll("a.wl").forEach((a) => a.addEventListener("click", (e) => { sfx.click(); spark(look.spark, e.clientX, e.clientY); }));
  Look.paint(art, look);
  S.pv.append(art);
  const play = h("button", { class: "btn small", type: "button", onclick: () => finale(look.finale) }, `▶ Play finish: ${cosmeticOf(`finale:${look.finale}`).name}`);
  S.pv.append(h("div", { class: "pv-actions" }, play));
  S.pvCap.textContent = `Previewing: ${c.name}. Click the links to see your click effect.`;
}

// ── membership and diamonds ──────────────────────────────────────────────

function memberCard() {
  const until = Wallet.memberUntil ? new Date(Wallet.memberUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const now = Date.now();
  const monthly = Wallet.catalog().filter((c) => c.member_only && c.claim_from && Date.parse(c.claim_from) <= now && now < Date.parse(c.claim_until)).map((c) => cosmeticOf(c.item_id).name);
  const head = h("div", { class: "mc-head" });
  head.innerHTML = BADGE_SVG;
  head.append(h("div", null, h("h3", null, "SirSC Membership"), h("p", null, Wallet.member ? `You're a member until ${until}.` : "$3 a month, paid to SirSC. It works across all of SirSC's games.")));
  const box = h(
    "div",
    { class: "member-card" },
    head,
    h(
      "ul",
      { class: "mc-perks" },
      h("li", null, h("b", null, "1.5× coins"), " from every solo and daily win"),
      h("li", null, h("b", null, "5 💎 every month"), ", added the first time you play that month"),
      h("li", null, h("b", null, "The SirSC Diamond"), " by your name, in parties too"),
      h("li", null, h("b", null, "This month's members' page"), `, yours forever: ${monthly.join(", ") || "coming soon"}`),
      h("li", null, h("b", null, "Diamond links"), ", the ", h("b", null, "SirSC Royalty"), " avatar and the ", h("b", null, "Diamond rain"), " finish while you're a member"),
    ),
  );
  if (!Wallet.member) box.append(h("p", { class: "mc-how" }, "To join, pay SirSC $3 for each month and ask them to add it to your Warden Chat account."));
  if (Account.demo && Account.status === "signedIn" && !Wallet.member) box.append(h("button", { class: "btn small", type: "button", "data-shop": "demo-member" }, "Demo: try a month of membership"));
  return box;
}

function diamondsCard() {
  const reqs = (Wallet.me && Wallet.me.requests) || [];
  const box = h("div", { class: "member-card" }, h("div", { class: "mc-head" }, h("div", { class: "dia-big" }, "💎"), h("div", null, h("h3", null, "Diamonds"), h("p", null, "5 💎 for $1, paid to SirSC in person. Then send a request here and SirSC adds them to your wallet. 1 💎 is worth 5,000 coins."))));
  if (Account.status !== "signedIn") {
    box.append(h("button", { class: "btn small", type: "button", "data-shop": "signin" }, "Sign in to request diamonds"));
    return box;
  }
  box.append(
    h(
      "form",
      { class: "dia-form", id: "diaForm" },
      h("label", { for: "diaN" }, "Diamonds ", h("select", { id: "diaN" }, [5, 10, 25, 50, 100, 250, 500].map((n) => h("option", { value: n }, `${n} 💎 ($${n / 5})`)))),
      h("label", { for: "diaNote" }, "Note for SirSC ", h("input", { id: "diaNote", maxlength: 200, placeholder: "e.g. paid at lunch on Tuesday" })),
      h("button", { class: "btn small", type: "submit" }, "I've paid: request them"),
    ),
    h(
      "div",
      { class: "dia-reqs" },
      reqs.length
        ? reqs.map((r) => h("div", { class: "dia-req" }, h("span", null, `${r.diamonds} 💎`), h("span", { class: `st ${r.status}` }, r.status), r.status === "pending" ? h("button", { class: "btn small alt", type: "button", "data-cancel": r.id }, "Cancel") : null))
        : h("p", { class: "sw-note" }, "No requests yet."),
    ),
  );
  return box;
}

// ── actions ──────────────────────────────────────────────────────────────

function buy(key) {
  const [item, cur] = key.split("|");
  if (Account.status !== "signedIn") return openSignIn();
  if (S.confirm !== key) {
    S.confirm = key;
    return render();
  }
  S.confirm = "";
  Wallet.buy(item, cur).then(
    () => {
      sfx.win();
      const c = cosmeticOf(item);
      Look.choose(c.kind, c.id);
      toast(`${c.name} is yours, and equipped`, "ok");
      if (c.kind === "finale") finale(c.id);
      render();
    },
    (e) => {
      toast(errText(e), "error");
      render();
    },
  );
}

function onClick(e) {
  const t = e.target.closest("[data-shop],[data-tab],[data-buy],[data-equip],[data-preview],[data-cancel]");
  if (!t || !S) return;
  if (t.dataset.shop === "signin") return openSignIn();
  if (t.dataset.shop === "demo-member") return Account.rpc("demo_membership", {}).then(() => Wallet.load()).then(() => toast("A month of membership, pretend edition", "ok"));
  if (t.dataset.tab) return (sfx.click(), setTab(t.dataset.tab));
  if (t.dataset.buy) return buy(t.dataset.buy);
  if (t.dataset.equip) {
    const c = cosmeticOf(t.dataset.equip);
    Look.choose(c.kind, c.id);
    sfx.pop();
    return;
  }
  if (t.dataset.cancel) return Wallet.cancelRequest(t.dataset.cancel).catch((err) => toast(errText(err), "error"));
  if (t.dataset.preview) setPreview(t.dataset.preview);
}

function onSubmit(e) {
  if (e.target.id !== "diaForm") return;
  e.preventDefault();
  Wallet.requestDiamonds(Number(S.el.querySelector("#diaN").value), S.el.querySelector("#diaNote").value).then(
    () => toast("Request sent. SirSC adds your diamonds once they see it.", "ok"),
    (err) => toast(errText(err), "error"),
  );
}

export { DEFAULT_LOOK, COSMETICS };
