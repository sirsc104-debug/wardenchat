// Warden Chat account screens: sign in or create an account, your profile and wallet, friends and party
// invites, and the screen a restricted account sees. All in the SirSC games' sheet style.

import { h, clear, toast, fmtTime } from "./ui.js";
import { Account, CONFIG, errText } from "./wc/account.js";
import { Wallet, BADGE_SVG } from "./wc/wallet.js";
import { Friends } from "./wc/friends.js";
import { avatarHTML, current as currentLook } from "./look.js";
import { ask } from "./dialog.js";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");
let open = null;

/** A paper sheet over a dark backdrop. build(body, close) fills it; returns close(). */
export function sheet(title, build, { wide = false, cls = "" } = {}) {
  closeSheet();
  const body = h("div", { class: "sheet-body" });
  const x = h("button", { class: "sheet-x", type: "button", "aria-label": "Close" }, "✕");
  const card = h("div", { class: `sheet ${wide ? "wide" : ""} ${cls}`, role: "dialog", "aria-modal": "true", "aria-label": title }, h("div", { class: "sheet-head" }, h("h2", null, title), x), body);
  const wrap = h("div", { class: "sheet-wrap sirsc" }, card);
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.classList.remove("in");
    setTimeout(() => wrap.remove(), 180);
    document.removeEventListener("keydown", onKey, true);
    if (open && open.wrap === wrap) open = null;
    stop.forEach((s) => s());
  };
  const onKey = (e) => e.key === "Escape" && close();
  x.addEventListener("click", close);
  wrap.addEventListener("click", (e) => e.target === wrap && close());
  document.addEventListener("keydown", onKey, true);
  const stop = [];
  document.body.append(wrap);
  open = { wrap, close };
  build(body, close, (fn) => stop.push(fn));
  requestAnimationFrame(() => wrap.classList.add("in"));
  return close;
}
export function closeSheet() {
  if (open) open.close();
}

function demoNote() {
  return Account.demo
    ? h("p", { class: "sheet-demo" }, "Demo build: any username and a password of 10 or more characters work, and every new account starts with 🪙 40,000 and 💎 10 to try the Shop. Nothing here touches a real Warden Chat account.")
    : null;
}

// ── signing in ───────────────────────────────────────────────────────────

export function openSignIn(then) {
  sheet("Sign in with Warden Chat", (body, close) => {
    const user = h("input", { class: "sfield", id: "wc-user", autocomplete: "username", maxlength: 24, placeholder: "Warden Chat username", spellcheck: "false" });
    const pass = h("input", { class: "sfield", id: "wc-pass", type: "password", autocomplete: "current-password", placeholder: "Password" });
    const err = h("p", { class: "sheet-err", role: "alert" });
    const signIn = h("button", { class: "btn", type: "submit" }, "Sign in");
    const create = h("button", { class: "btn alt", type: "button" }, "Create account");
    const submit = (make) => {
      const R = Account.RULES;
      const u = user.value.trim();
      if (u.length < R.nameMin || u.length > R.nameMax || !R.nameRe.test(u)) return (err.textContent = errText({ code: "signup_rejected" }));
      if (make && pass.value.length < R.passwordMin) return (err.textContent = errText({ code: "weak_password" }));
      if (!pass.value) return (err.textContent = "Type your password.");
      err.textContent = make ? "Creating your account…" : "Signing in…";
      signIn.disabled = create.disabled = true;
      (make ? Account.signUp(u, pass.value) : Account.signIn(u, pass.value)).then(
        () => {
          pass.value = "";
          close();
          toast(`Signed in as ${u}`, "ok");
          then?.();
        },
        (e) => {
          err.textContent = errText(e);
          signIn.disabled = create.disabled = false;
        },
      );
    };
    const form = h(
      "form",
      { class: "sheet-form", onsubmit: (e) => (e.preventDefault(), submit(false)) },
      h("label", { class: "slbl", for: "wc-user" }, "Username"),
      user,
      h("label", { class: "slbl", for: "wc-pass" }, "Password"),
      pass,
      err,
      h("div", { class: "sheet-actions" }, signIn, create),
    );
    create.addEventListener("click", () => submit(true));
    body.append(
      h("p", { class: "sheet-lead" }, "WikiDash uses your Warden Chat account. Your coins, diamonds, membership and friends are shared with SirSC's other games."),
      demoNote(),
      form,
      h("p", { class: "sheet-small" }, "Forgot your password, or want to delete your account? Do that on ", h("a", { href: CONFIG.chatUrl, target: "_blank", rel: "noopener" }, "Warden Chat"), "."),
    );
    setTimeout(() => user.focus(), 40);
  });
}

// ── your account ─────────────────────────────────────────────────────────

/** tab: "profile" | "friends". opts.party: { id, code } when inviting into a party you're in. */
export function openAccount(tab = "profile", opts = {}) {
  if (Account.status === "restricted") return openRestricted();
  if (Account.status !== "signedIn") return openSignIn(() => openAccount(tab, opts));
  sheet("Your account", (body, close, onStop) => {
    const tabs = h("div", { class: "sheet-tabs", role: "tablist" });
    const pane = h("div", { class: "sheet-pane" });
    let cur = tab;
    const paint = () => {
      clear(tabs);
      const n = Friends.incoming.length + Friends.invites.length;
      for (const [id, label] of [["profile", "Profile"], ["friends", `Friends${n ? ` (${n} new)` : ""}`]]) {
        tabs.append(h("button", { type: "button", class: cur === id ? "on" : "", onclick: () => ((cur = id), paint()) }, label));
      }
      clear(pane);
      if (cur === "profile") profile(pane, close);
      else friendsPane(pane, opts);
    };
    onStop(Friends.on(paint));
    onStop(Wallet.on(paint));
    body.append(tabs, pane);
    paint();
    Friends.load();
  }, { wide: true });
}

function profile(pane, close) {
  const u = Account.user;
  const look = currentLook();
  const name = h("div", { class: "pf-name" }, u.username);
  if (Wallet.member) {
    const b = h("span", { class: "badge-wrap" });
    b.innerHTML = BADGE_SVG;
    name.append(b);
  }
  const until = Wallet.memberUntil ? new Date(Wallet.memberUntil).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  pane.append(
    h("div", { class: "pf-head" }, avatarHTML(u.id, u.username, look.avatar, "xl"), h("div", null, name, h("div", { class: "pf-sub" }, Wallet.member ? `SirSC Member until ${until}` : "Warden Chat account"))),
    h(
      "div",
      { class: "pf-wallet" },
      h("div", { class: "pf-cell" }, h("span", null, "Coins"), h("b", null, `🪙 ${Wallet.me ? fmt(Wallet.coins) : "…"}`)),
      h("div", { class: "pf-cell" }, h("span", null, "Diamonds"), h("b", null, `💎 ${Wallet.me ? fmt(Wallet.diamonds) : "…"}`)),
      h("div", { class: "pf-cell" }, h("span", null, "Items owned"), h("b", null, String(Wallet.me ? (Wallet.me.owned || []).length : 0))),
    ),
    demoNote(),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { class: "btn", type: "button", onclick: () => (close(), document.dispatchEvent(new CustomEvent("wkd:shop"))) }, "🛍️ Shop"),
      h("button", { class: "btn alt", type: "button", onclick: () => Account.signOut().then(() => (close(), toast("Signed out", "ok"))) }, "Sign out"),
    ),
    h("p", { class: "sheet-small" }, "Change your password or delete your account on ", h("a", { href: CONFIG.chatUrl, target: "_blank", rel: "noopener" }, "Warden Chat"), ". Signing out here keeps you signed in there."),
  );
}

function friendsPane(pane, opts) {
  const input = h("input", { class: "sfield", id: "wc-friend", placeholder: "Their Warden Chat username", maxlength: 24, spellcheck: "false", autocomplete: "off" });
  const msg = h("p", { class: "sheet-err", role: "status" });
  const add = () => {
    const name = input.value.trim();
    if (!name) return input.focus();
    msg.textContent = "Sending…";
    Friends.add(name).then(
      (r) => {
        input.value = "";
        msg.textContent = r && r.status === "accepted" ? `${name} had already asked you, so you're friends now.` : `Friend request sent to ${name}.`;
      },
      (e) => (msg.textContent = errText(e)),
    );
  };
  pane.append(h("form", { class: "fr-add", onsubmit: (e) => (e.preventDefault(), add()) }, input, h("button", { class: "btn", type: "submit" }, "Add friend")), msg);

  if (Friends.invites.length) {
    pane.append(h("div", { class: "fr-sub" }, "Party invites"));
    for (const inv of Friends.invites) {
      pane.append(
        h(
          "div",
          { class: "fr-row" },
          h("span", { class: "fr-n" }, `${inv.from} invited you to a party`),
          h("button", { class: "btn small", type: "button", onclick: () => (closeSheet(), document.dispatchEvent(new CustomEvent("wkd:join-invite", { detail: inv }))) }, "Join"),
          h("button", { class: "btn small alt", type: "button", onclick: () => Friends.dismissInvite(inv.party_id) }, "No thanks"),
        ),
      );
    }
  }
  if (Friends.incoming.length) {
    pane.append(h("div", { class: "fr-sub" }, "Friend requests"));
    for (const r of Friends.incoming) {
      pane.append(
        h(
          "div",
          { class: "fr-row" },
          avatarHTML(r.username, r.username, null, "sm"),
          h("span", { class: "fr-n" }, r.username),
          h("button", { class: "btn small", type: "button", onclick: () => Friends.answer(r.request_id, true).then(() => toast(`You and ${r.username} are friends now`, "ok"), (e) => toast(errText(e), "error")) }, "Accept"),
          h("button", { class: "btn small alt", type: "button", onclick: () => Friends.answer(r.request_id, false).catch((e) => toast(errText(e), "error")) }, "Decline"),
        ),
      );
    }
  }
  pane.append(h("div", { class: "fr-sub" }, `Friends (${Friends.list.length})`));
  if (!Friends.list.length) pane.append(h("p", { class: "sheet-small" }, "No friends yet. Add someone by their Warden Chat username. Friends you've made in Brain Rocket and SirSC's other games show up here too."));
  for (const f of Friends.list) {
    const stats = [];
    if (f.daily && f.daily.date) stats.push(`Daily: ${f.daily.clicks} clicks, ${fmtTime(f.daily.ms)}`);
    stats.push(`${f.party_wins || 0} party win${f.party_wins === 1 ? "" : "s"}`);
    if (f.solo_wins) stats.push(`${f.solo_wins} solo wins`);
    const name = h("span", { class: "fr-n" }, f.username);
    if (f.member) {
      const b = h("span", { class: "badge-wrap" });
      b.innerHTML = BADGE_SVG;
      name.append(b);
    }
    const row = h("div", { class: "fr-row" }, avatarHTML(f.user_id, f.username, f.avatar, "sm"), h("div", { class: "fr-main" }, name, h("span", { class: "fr-stats" }, stats.join(" · "))));
    const inviteBtn = h("button", { class: "btn small", type: "button" }, opts.party ? "Invite" : "Race");
    inviteBtn.addEventListener("click", () => {
      inviteBtn.disabled = true;
      document.dispatchEvent(new CustomEvent("wkd:invite", { detail: { friend: f, done: (ok) => { inviteBtn.textContent = ok ? "Invited" : "Invite"; inviteBtn.disabled = ok; } } }));
    });
    row.append(
      inviteBtn,
      h("button", { class: "btn small alt", type: "button", title: `Remove ${f.username}`, onclick: () => ask(`Remove ${f.username} from your friends? This removes them in SirSC's other games too.`, { yes: "Remove", danger: true }).then((y) => y && Friends.remove(f.user_id).catch((e) => toast(errText(e), "error"))) }, "✕"),
    );
    pane.append(row);
  }
  if (Friends.outgoing.length) {
    pane.append(h("div", { class: "fr-sub" }, "Waiting for an answer"));
    for (const r of Friends.outgoing) {
      pane.append(h("div", { class: "fr-row" }, h("span", { class: "fr-n" }, r.username), h("button", { class: "btn small alt", type: "button", onclick: () => Friends.cancel(r.request_id).catch((e) => toast(errText(e), "error")) }, "Cancel")));
    }
  }
}

// ── a restricted account ─────────────────────────────────────────────────

export function openRestricted() {
  const r = Account.restriction || {};
  sheet("Account restricted", (body, close) => {
    body.append(
      h("p", { class: "sheet-lead" }, r.status === "banned" ? "Your Warden Chat account has been banned." : `Your Warden Chat account is suspended${r.until ? ` until ${new Date(r.until).toLocaleString()}` : ""}.`),
      r.reason ? h("p", { class: "sheet-small" }, `Reason: ${r.reason}`) : null,
      h("p", { class: "sheet-small" }, "You can still race solo and in parties on this page without signing in."),
      h("div", { class: "sheet-actions" }, h("button", { class: "btn", type: "button", onclick: () => Account.signOut().then(close) }, "Sign out")),
    );
  });
}
