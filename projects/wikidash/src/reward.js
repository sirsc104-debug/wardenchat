// Coins after a solo or daily win, on the results card. The server works them out (wkd_reward,
// docs/ECONOMY-WKD.md); this shows the breakdown. Party races don't pay: friends could trade wins.

import { h, toast } from "./ui.js";
import { Account } from "./wc/account.js";
import { Wallet, BADGE_SVG } from "./wc/wallet.js";
import { shortestPath, sameTitle } from "./wiki.js";
import { openSignIn } from "./acct.js";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const BASE = { solo: { easy: 300, medium: 600, hard: 1200 }, daily: { easy: 800, medium: 1200, hard: 2000 } };
const done = new Map(); // round key -> the server's answer (or the promise of one)
const toasted = new Set();

/** The route's par (its shortest length) and the level that par means. */
export function routeFacts(v) {
  const r = v.round;
  let par = v.settings.routeHops;
  if (!par || !sameTitle(v.settings.start?.title || "", r.start)) par = Math.max(1, shortestPath(r.start, r.target).length - 1);
  const level = v.settings.daily ? v.settings.routeLevel || "medium" : par <= 2 ? "easy" : par === 3 ? "medium" : "hard";
  return { par, level };
}

export function rewardBox(ctx, v) {
  const r = v.round;
  if (Account.status === "unavailable" || Account.status === "checking") return null;
  if (ctx.S.kind === "party") return h("p", { class: "rw-note" }, "Party races don't earn coins, since friends could trade wins. Solo and daily wins do.");
  const u = v.myKey ? r.units[v.myKey] : null;
  if (!u || u.status !== "won") return null;
  const kind = v.settings.daily ? "daily" : "solo";
  const { par, level } = routeFacts(v);
  const box = h("div", { class: "rw-box" });
  if (Account.status !== "signedIn") {
    const eff = u.clicks === par ? 1.5 : Math.max(0.4, par / u.clicks);
    const est = Math.floor(BASE[kind][level] * eff);
    box.append(h("p", { class: "rw-note" }, "Sign in with your Warden Chat account to earn coins. This run would have paid ", h("b", null, `🪙 ${fmt(est)}`), "."), h("button", { class: "btn sm", type: "button", onclick: () => openSignIn() }, "Sign in"));
    return box;
  }
  const key = `${ctx.S.kind}:${r.n}:${r.endedAt}`;
  if (!done.has(key)) {
    done.set(
      key,
      Wallet.reward({ kind, level, clicks: u.clicks, par, durationMs: u.finishMs, start: r.start, target: r.target, date: v.settings.daily || "" }).then(
        (x) => (done.set(key, { ok: x }), x),
        (e) => (done.set(key, { err: e }), null),
      ),
    );
  }
  const paint = (res, animate) => {
    box.replaceChildren();
    if (res.err) {
      const e = res.err;
      const msg = e.code === "sirsc_bad_reward" ? "That run doesn't count for coins." : e.code === "sirsc_rate_limited" ? "That's a lot of races this hour. Coins come back shortly." : e.offline ? "Couldn't reach Warden Chat, so no coins this time." : "No coins this time: Warden Chat didn't answer.";
      box.append(h("p", { class: "rw-note" }, msg));
      return;
    }
    const x = res.ok;
    const total = h("span", { class: "rw-count" }, animate ? "0" : fmt(x.coins));
    const lines = h("ul", { class: "rw-lines" }, h("li", null, h("span", null, `${kind === "daily" ? "Daily" : "Solo"} · ${level}`), h("b", null, fmt(x.base))));
    lines.append(h("li", null, h("span", null, x.perfect ? `Perfect: the shortest route (${par})` : `${u.clicks} clicks, shortest is ${par}`), h("b", null, `×${x.eff_mult}`)));
    if (x.member_mult > 1) {
      const li = h("li", null, h("span", null, " Member"), h("b", null, `×${x.member_mult}`));
      li.firstChild.insertAdjacentHTML("afterbegin", BADGE_SVG);
      lines.append(li);
    }
    if (x.first_daily_bonus) lines.append(h("li", null, h("span", null, "First daily finish today"), h("b", null, `+${fmt(x.first_daily_bonus)}`)));
    box.append(h("div", { class: "rw-total" }, "🪙 ", total), lines, h("p", { class: "rw-note" }, x.capped ? "You've hit today's 20,000-coin limit for WikiDash. It resets at midnight UTC." : `Today: ${fmt(x.today)} of ${fmt(x.daily_cap)} coins.`));
    if (animate) countUp(total, x.coins);
  };
  const cur = done.get(key);
  if (cur && !(cur instanceof Promise)) paint(cur, false);
  else {
    box.append(h("p", { class: "rw-note" }, "Counting your coins…"));
    cur.then(() => {
      const res = done.get(key);
      paint(res, true);
      if (res.ok && res.ok.coins > 0 && !toasted.has(key)) {
        toasted.add(key);
        toast(`+${fmt(res.ok.coins)} coins`, "ok");
      }
    });
  }
  return box;
}

function countUp(el, n) {
  const t0 = performance.now();
  const dur = Math.min(1600, 400 + n / 6);
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(Math.round(n * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
