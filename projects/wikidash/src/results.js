import { h, clear, icon, toast, avatar, fmtTime, TEAM_COLORS } from "./ui.js";
import { sameTitle } from "./wiki.js";
import { recordRun } from "./records.js";
import { fetchDaily, boardList, dateLabel } from "./daily.js";
import { buildMap } from "./mapview.js";
import { buildReplay } from "./replay.js";
import { toggleTray } from "./react.js";
import { copyText } from "./dialog.js";
import { rewardBox } from "./reward.js";

// Tab and fetched data survive re-renders of the card within a round.
const T = { round: null, tab: "results", pr: null, prKey: "", daily: null, dailyKey: "" };
let buttons = [];

export function resultsSig(v) {
  const r = v.round;
  return [r.n, r.endedAt, v.host === v.you ? "h" : "-", v.match.done, v.match.played, v.players.length, v.joined ? 1 : 0, T.daily ? 1 : 0].join("|");
}

export function resultsError() {
  for (const b of buttons) {
    b.disabled = false;
    b.classList.remove("busy");
    if (b.dataset.label) b.textContent = b.dataset.label;
  }
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const unitAvatar = (u) => (u.team != null ? h("span", { class: "avatar sm", style: { background: TEAM_COLORS[u.team] } }, u.name.charAt(5)) : avatar(u.key, u.name, "sm"));
const labelOf = (v, k) => (v.round.units[k] && v.round.units[k].name) || (v.match.scores.find((s) => s.key === k) || {}).name || "Player";

function headline(v) {
  const r = v.round;
  const m = v.match;
  const w = r.winner ? r.units[r.winner] : null;
  const mine = (k) => k === v.myKey;
  const route = `${r.start} to ${r.target}`;
  if (v.settings.daily) {
    return w
      ? { title: "You made it!", sub: `${plural(w.clicks, "click")} in ${fmtTime(w.finishMs)}`, trophy: true }
      : { title: "Round over", sub: `You didn't reach ${r.target}.` };
  }
  if (m.done && (r.mode === "elim" || (r.rules.rounds > 1 && m.champs.length))) {
    if (!m.champs.length) return { title: "Match over", sub: "Nobody won." };
    const names = m.champs.map((k) => labelOf(v, k));
    const me = m.champs.some(mine);
    const team = r.mode === "teams";
    const title = names.length > 1 ? `${names.join(" and ")} tie` : me ? (team ? "Your team wins the match!" : "You win the match!") : `${names[0]} wins the match!`;
    return { title, sub: r.mode === "elim" ? "Last one standing." : `Final score after ${plural(m.played, "round")}.`, trophy: true };
  }
  if (r.mode === "elim") {
    const outs = r.out.map((k) => labelOf(v, k));
    if (!outs.length) return { title: "Nobody reached it", sub: "No one is out. Next round is a fresh route." };
    return { title: `${outs.join(" and ")} ${outs.length > 1 ? "are" : "is"} out`, sub: `The rest reached ${r.target}.` };
  }
  if (!w) return { title: { time: "Time's up", allOut: "Everyone's out", host: "Round ended", done: "Round over" }[r.endReason] || "Round over", sub: `Nobody reached ${r.target}.` };
  if (r.mode === "fewest") {
    return { title: mine(w.key) ? `You win with ${plural(w.clicks, "click")}!` : `${w.name} wins with ${plural(w.clicks, "click")}`, sub: route, trophy: true };
  }
  const title = r.mode === "teams" ? (mine(w.key) ? "Your team wins!" : `${w.name} wins!`) : mine(w.key) ? "You win!" : `${w.name} wins!`;
  return { title, sub: `${route} in ${fmtTime(w.finishMs)} with ${plural(w.clicks, "click")}`, trophy: true };
}

function pathView(u, target, won) {
  const wrap = h("div", { class: "path" });
  if (u.hidden || !u.path) return wrap;
  u.path.forEach((step, i) => {
    if (i) wrap.append(h("span", { class: "p-arrow" }, icon(step.back ? "back" : "arrow", 12)));
    const end = won && i === u.path.length - 1 && sameTitle(step.t, target);
    wrap.append(h("span", { class: `p-chip${step.back ? " back" : ""}${i === 0 ? " first" : ""}${end ? " end" : ""}` }, step.t));
  });
  return wrap;
}

function leavesOf(r, u) {
  return u.members.reduce((n, p) => n + ((r.watch[p] && r.watch[p].leaves) || 0), 0);
}

function standings(v) {
  const r = v.round;
  return h(
    "ol",
    { class: "res-list" },
    r.order.map((k, i) => {
      const u = r.units[k];
      const pts = r.points[k];
      const out = r.out.includes(k);
      const leaves = leavesOf(r, u);
      const meta = `${u.status === "won" ? fmtTime(u.finishMs) : u.reason || "Didn't finish"} · ${plural(u.clicks, "click")}${leaves ? ` · left tab ${leaves}x` : ""}`;
      return h(
        "li",
        { class: `res-row ${u.status}${out ? " outed" : ""}`, style: { "--i": i } },
        h("div", { class: "res-top" }, h("span", { class: "rank" }, String(i + 1)), unitAvatar(u), h("b", null, u.name), u.key === v.myKey ? h("span", { class: "tag" }, "you") : null, pts ? h("span", { class: "pts" }, `+${pts}`) : null, out ? h("span", { class: "tag out" }, "Out") : null, h("span", { class: "grow" }), h("span", { class: "res-meta" }, meta)),
        v.round.mode === "teams" ? h("div", { class: "res-members muted sm" }, u.names.join(", ")) : null,
        pathView(u, r.target, u.status === "won"),
      );
    }),
  );
}

function matchBox(v) {
  const m = v.match;
  const r = v.round;
  if (v.settings.daily) return null;
  if (r.mode === "elim") {
    const still = m.roster.filter((p) => !m.out.includes(p)).map((p) => (v.players.find((x) => x.id === p) || {}).name || "Player");
    const outs = m.out.map((p) => (v.players.find((x) => x.id === p) || {}).name || "Player");
    return h("div", { class: "match-box" }, h("div", { class: "eyebrow" }, "Elimination"), h("p", null, h("b", null, "Still in: "), still.join(", ") || "nobody"), outs.length ? h("p", { class: "muted" }, `Out: ${outs.join(", ")}`) : null);
  }
  if (r.rules.rounds <= 1) return null;
  return h(
    "div",
    { class: "match-box" },
    h("div", { class: "eyebrow" }, `Match score, round ${Math.min(m.played, r.rules.rounds)} of ${r.rules.rounds}`),
    h("ol", { class: "score-list" }, m.scores.map((s, i) => h("li", { class: m.champs.includes(s.key) ? "champ" : "" }, h("span", { class: "rank" }, String(i + 1)), h("span", { class: "sc-name" }, s.name, s.key === v.myKey ? h("span", { class: "tag" }, "you") : null), h("b", null, `${s.pts} pts`)))),
  );
}

function recordLine(ctx, v) {
  const r = v.round;
  const u = v.myKey ? r.units[v.myKey] : null;
  if (!u || u.status !== "won" || r.mode === "teams") return null;
  const key = `${ctx.S.code}:${r.n}`;
  if (T.prKey !== key) {
    T.prKey = key;
    T.pr = recordRun(r.start, r.target, u.finishMs, u.clicks);
  }
  const p = T.pr;
  if (!p) return null;
  const bits = [];
  if (p.first) bits.push("First time on this route.");
  else {
    if (p.newTime) bits.push("New fastest time!");
    if (p.newClicks) bits.push("New fewest clicks!");
  }
  return h("div", { class: "pr-line" }, icon("trophy", 15), h("span", null, h("b", null, "Your best on this route: "), `${fmtTime(p.best.ms)} and ${plural(p.best.clicks, "click")}. `, bits.join(" ")));
}

function shareText(ctx, v) {
  const r = v.round;
  const m = v.match;
  const medals = ["🥇", "🥈", "🥉"];
  const lines = [];
  const fin = r.order.map((k) => r.units[k]).filter((u) => u.status === "won");
  if (v.settings.daily) {
    const w = fin[0];
    lines.push(`📅 WikiDash Daily ${dateLabel(v.settings.daily)}`, `${r.start} → ${r.target}`);
    if (w) {
      lines.push(`${plural(w.clicks, "click")} · ${fmtTime(w.finishMs)}`);
      if (T.daily && T.daily.you) lines.push(`Rank ${T.daily.you.rank} of ${T.daily.total}`);
    } else lines.push("Didn't reach it");
    lines.push("", "Think you can beat it? Play WikiDash.");
    return lines.join("\n");
  }
  lines.push("🏁 WikiDash", `${r.start} → ${r.target}`);
  if (r.mode === "elim") {
    const outs = r.out.map((k) => labelOf(v, k));
    if (outs.length) lines.push(`❌ Out: ${outs.join(", ")}`);
    if (m.done && m.champs.length) lines.push(`🏆 ${m.champs.map((k) => labelOf(v, k)).join(" and ")} is the last one standing`);
  } else if (fin.length) {
    fin.slice(0, 3).forEach((u, i) => {
      const who = r.mode === "teams" ? `${u.name} (${u.names.join(", ")})` : u.name;
      lines.push(`${medals[i]} ${who} · ${plural(u.clicks, "click")} · ${fmtTime(u.finishMs)}`);
    });
  } else lines.push("Nobody reached the target");
  if (r.mode !== "elim" && r.rules.rounds > 1) {
    lines.push("", `${m.done ? "Final" : "Score"}: ${m.scores.map((s) => `${s.name} ${s.pts}`).join(", ")}`);
  }
  lines.push("", "Race us on WikiDash.");
  return lines.join("\n");
}

function shareRow(ctx, v) {
  const text = () => shareText(ctx, v);
  const copy = h("button", { class: "btn", type: "button", onclick: () => copyText(text(), "Result copied. Paste it in your group chat.", toast) }, icon("copy", 16), "Copy result");
  const row = h("div", { class: "share-row" }, copy, ctx.solo() ? null : h("button", { class: "btn", type: "button", onclick: toggleTray }, icon("smile", 16), "React"));
  return row;
}

function dailyBox(ctx, v) {
  const box = h("div", { class: "match-box" }, h("div", { class: "eyebrow" }, "Today's leaderboard"), h("div", { class: "daily-board" }, h("div", { class: "spinner sm" })));
  const key = `${ctx.S.code}:${v.round.n}`;
  const paint = (d) => box.querySelector(".daily-board").replaceChildren(boardList(d.top, 8), h("p", { class: "muted sm" }, d.you ? `You are #${d.you.rank} of ${d.total}.` : `${plural(d.total, "finish")} so far.`));
  if (T.dailyKey === key && T.daily) paint(T.daily);
  else {
    fetchDaily().then((d) => {
      T.dailyKey = key;
      T.daily = d;
      paint(d);
    }).catch(() => box.querySelector(".daily-board").replaceChildren(h("p", { class: "muted sm" }, "The leaderboard isn't available right now.")));
  }
  return box;
}

function actions(ctx, v) {
  const host = ctx.isHost();
  const m = v.match;
  buttons = [];
  const act = (label, cls, fn, busyLabel) => {
    const b = h("button", { class: `btn ${cls}`, type: "button", "data-label": label }, label);
    b.addEventListener("click", () => {
      if (busyLabel) {
        b.disabled = true;
        b.classList.add("busy");
        b.textContent = busyLabel;
        setTimeout(resultsError, 25000);
      }
      fn();
    });
    buttons.push(b);
    return b;
  };
  if (v.settings.daily) {
    return h("div", { class: "res-actions" }, act("Try again", "primary", () => ctx.act({ kind: "next", route: "same" })), h("button", { class: "btn", type: "button", onclick: ctx.home }, "Home"));
  }
  if (!host) return h("div", { class: "res-actions" }, h("span", { class: "sb-info waiting" }, h("span", { class: "pulse" }), "Waiting for the host"));
  return h(
    "div",
    { class: "res-actions" },
    act(m.done ? "Play again" : "Next round", "primary", () => ctx.act({ kind: "next", route: "new" }), "Building a route..."),
    act("Same route", "", () => ctx.act({ kind: "next", route: "same" })),
    act("Back to lobby", "ghost", () => ctx.act({ kind: "lobby" })),
  );
}

export function renderResults(ctx, v, { onHide }) {
  const r = v.round;
  if (T.round !== r.n) {
    T.round = r.n;
    T.tab = "results";
  }
  const hl = headline(v);
  const pane = h("div", { class: "res-pane" });
  const tabs = h("div", { class: "res-tabs", role: "tablist" });
  const paint = () => {
    clear(pane);
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === T.tab));
    if (T.tab === "map") pane.append(buildMap(v));
    else if (T.tab === "replay") pane.append(buildReplay(v));
    else pane.append(...[standings(v), rewardBox(ctx, v), matchBox(v), v.settings.daily ? dailyBox(ctx, v) : null, recordLine(ctx, v), shareRow(ctx, v)].filter(Boolean));
  };
  for (const [id, ic, label] of [["results", "list", "Results"], ["map", "graph", "Map"], ["replay", "replay", "Replay"]]) {
    tabs.append(h("button", { type: "button", role: "tab", "data-tab": id, onclick: () => ((T.tab = id), paint()) }, icon(ic, 15), label));
  }
  const card = h(
    "div",
    { class: "res-card" },
    h("button", { class: "icon-btn res-x", type: "button", title: "Hide results", onclick: onHide }, icon("x", 18)),
    h("div", { class: "res-head" }, hl.trophy ? h("div", { class: "res-trophy" }, icon("trophy", 30)) : null, h("h2", { class: "display" }, hl.title), h("p", { class: "res-sub" }, hl.sub)),
    tabs,
    pane,
    actions(ctx, v),
  );
  paint();
  return card;
}
