import { h, clear, icon, toast, avatar, fmtTime, fmtClock, TEAM_COLORS } from "./ui.js";
import { fetchArticle, buildArticle, summary, sameTitle } from "./wiki.js";
import { brand, roomChip, soloChip, connDot, toolButtons } from "./shell.js";
import { ask } from "./dialog.js";
import * as guard from "./guard.js";
import { sfx } from "./sound.js";
import { finale, spark } from "./fx.js";
import * as Look from "./look.js";
import { renderResults, resultsSig, resultsError } from "./results.js";

let R = null;
const RANK = { won: 0, running: 1, out: 2, dnf: 2, dq: 3 };
const MODE_LABEL = { race: "Race", fewest: "Fewest clicks", teams: "Teams", elim: "Elimination" };
const TURN_IDLE_MS = 25000;

export function mountRace(root, ctx) {
  R = { ctx, displayed: null, loadingFor: null, pending: false, pendingAt: 0, roundN: null, hideResults: false, myLeaves: 0, myStatus: null, cdLast: null, prevPhase: null, prevTurn: null, bannerAt: 0 };
  R.route = h("div", { class: "rb-route" });
  R.mode = h("span", { class: "mode-pill" });
  R.clicks = h("div", { class: "stat" });
  R.timerN = h("span", { class: "stat-n" }, "0:00.0");
  R.timerL = h("span", { class: "stat-l" }, "time");
  R.timer = h("div", { class: "stat timer" }, R.timerN, R.timerL);
  R.badges = h("div", { class: "rb-badges" });
  R.backBtn = h("button", { class: "btn sm", type: "button", onclick: () => raceBack(R.ctx) }, icon("back", 16), "Back");
  R.giveUp = h("button", { class: "btn sm ghost", type: "button", onclick: () => ask("Give up this round?", { yes: "Give up", danger: true }).then((y) => y && R.ctx.act({ kind: "forfeit" })) }, "Give up");
  R.boardBtn = h("button", { class: "icon-btn board-toggle", type: "button", title: "Race board", onclick: () => document.body.classList.toggle("board-open") }, icon("users"), h("span", { class: "bt-n" }));
  R.loadbar = h("div", { class: "loadbar" });
  R.banner = h("div", { class: "reader-banner", hidden: true });
  R.article = h("article", { class: "article" });
  R.observe = h("div", { class: "observe", hidden: true });
  R.reader = h("main", { class: "reader" }, R.loadbar, R.banner, R.article, R.observe);
  R.toc = h("nav", { class: "toc", "aria-label": "Contents", hidden: true });
  R.board = h("aside", { class: "board" });
  R.body = h("div", { class: "racebody no-toc" }, R.toc, R.reader, R.board);
  R.countdown = h("div", { class: "overlay countdown", hidden: true });
  R.results = h("div", { class: "overlay results", hidden: true });
  R.peek = h("div", { class: "peek", hidden: true });
  R.go = h("div", { class: "go-flash", hidden: true }, h("span", null, "GO!"));
  R.showRes = h("button", { class: "btn primary show-res", type: "button", hidden: true, onclick: () => ((R.hideResults = false), (R.results.hidden = false), (R.showRes.hidden = true), syncResultsClass()) }, icon("trophy", 16), "Results");

  root.append(
    h("header", { class: "racebar" }, brand(true), R.route, R.mode, h("div", { class: "rb-stats" }, R.clicks, R.timer), R.badges, h("div", { class: "rb-actions" }, R.backBtn, R.giveUp, toolButtons(), R.boardBtn)),
    R.body,
    R.peek,
    R.countdown,
    R.go,
    R.results,
    R.showRes,
  );
  R.article.addEventListener("click", onArticleClick);
  R.article.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList?.contains("wl")) onArticleClick(e);
  });
  R.tick = setInterval(tick, 100);
  // The page and link styles from the Shop.
  const dress = (look) => R && Look.paint(R.reader, look);
  dress(Look.current());
  R.unlook = Look.onChange(dress);
  document.addEventListener("click", closeBoardOutside);
}

// On phones the race board slides over the page. Tapping anywhere else closes it.
function closeBoardOutside(e) {
  if (document.body.classList.contains("board-open") && !e.target.closest(".board, .board-toggle")) document.body.classList.remove("board-open");
}

// On phones the results card covers the reaction button, so it moves into the card.
function syncResultsClass() {
  document.body.classList.toggle("results-open", Boolean(R) && !R.results.hidden);
}

export function unmountRace() {
  if (!R) return;
  document.removeEventListener("click", closeBoardOutside);
  document.body.classList.remove("results-open");
  clearInterval(R.tick);
  R.unlook?.();
  R.tocObs?.disconnect();
  guard.configure({ active: false });
  document.body.classList.remove("board-open");
  R = null;
}

const view = () => R.ctx.S.view;
const me = () => {
  const v = view();
  return v.round && v.myKey ? v.round.units[v.myKey] || null : null;
};
const current = (u) => u.stack[u.stack.length - 1];

function nameAt(u, pid) {
  const i = u.members.indexOf(pid);
  return (i >= 0 && u.names[i]) || "a teammate";
}

function canClick() {
  const v = view();
  const u = me();
  if (v.phase !== "racing" || !u || u.status !== "running") return false;
  if (R.ctx.now() < v.round.startAt || R.pending) return false;
  if (v.round.mode === "teams" && u.turn !== v.you) return false;
  return Boolean(R.displayed) && sameTitle(R.displayed, current(u));
}

function setLoading(on) {
  R.loadbar.classList.toggle("on", on);
}

function onArticleClick(e) {
  const a = e.target.closest("a");
  if (!a) return;
  e.preventDefault();
  if (a.classList.contains("fl")) {
    const id = a.dataset.frag;
    const target = id && R.article.querySelector(`[id="${CSS.escape(id)}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (!a.classList.contains("wl")) return;
  if (!canClick()) {
    const v = view();
    const u = me();
    if (u && u.status === "running" && v.round.mode === "teams" && u.turn !== v.you && R.ctx.now() >= v.round.startAt) {
      toast(`It's ${nameAt(u, u.turn)}'s turn.`, "warn");
    }
    return;
  }
  const to = a.dataset.to;
  if (view().round.rules.banned.some((b) => sameTitle(b, to))) return toast(`"${to}" is banned this round.`, "warn");
  R.pending = true;
  R.pendingAt = Date.now();
  setLoading(true);
  a.classList.add("going");
  sfx.click();
  const box = a.getBoundingClientRect();
  spark(Look.current().spark, e.clientX || box.left + box.width / 2, e.clientY || box.top + box.height / 2);
  fetchArticle(to).catch(() => {});
  R.ctx.act({ kind: "move", to });
}

export function raceBack(ctx) {
  if (!R) return;
  const u = me();
  if (!u || !canClickBase(u) || !view().round.rules.allowBack || u.stack.length < 2) return;
  R.pending = true;
  R.pendingAt = Date.now();
  setLoading(true);
  sfx.click();
  fetchArticle(u.stack[u.stack.length - 2]).catch(() => {});
  ctx.act({ kind: "back" });
}

function canClickBase(u) {
  const v = view();
  if (v.phase !== "racing" || u.status !== "running" || R.pending) return false;
  if (R.ctx.now() < v.round.startAt) return false;
  return v.round.mode !== "teams" || u.turn === v.you;
}

export function raceError() {
  if (!R) return;
  R.pending = false;
  R.article.querySelectorAll("a.going").forEach((a) => a.classList.remove("going"));
  if (!R.loadingFor) setLoading(false);
  resultsError();
}

async function load(title) {
  R.loadingFor = title;
  setLoading(true);
  try {
    const a = await fetchArticle(title);
    if (!R || R.loadingFor !== title) return;
    const node = buildArticle(a.html, { allowNavboxes: view().round.rules.allowNavboxes, current: a.title, nav: a.nav });
    const banned = view().round.rules.banned;
    node.querySelectorAll("a.wl").forEach((l) => {
      if (banned.some((b) => sameTitle(b, l.dataset.to))) l.classList.add("banned");
    });
    clear(R.article);
    R.article.append(h("h1", { class: "art-title" }, a.title), h("div", { class: "art-from" }, "From Wikipedia, the free encyclopedia. Text under CC BY-SA 4.0."), node);
    R.displayed = title;
    R.article.classList.remove("enter");
    void R.article.offsetWidth;
    R.article.classList.add("enter");
    buildToc(a.title);
    R.reader.scrollTop = 0;
    window.scrollTo(0, 0);
  } catch (err) {
    if (!R || R.loadingFor !== title) return;
    clear(R.article);
    R.article.append(h("div", { class: "art-error" }, h("p", null, `Couldn't load "${title}". ${err.message || ""}`), h("button", { class: "btn", type: "button", onclick: () => load(title) }, "Try again")));
  } finally {
    if (R && R.loadingFor === title) {
      R.loadingFor = null;
      R.pending = false;
      setLoading(false);
    }
  }
}

function buildToc(title) {
  R.tocObs?.disconnect();
  clear(R.toc);
  const heads = [...R.article.querySelectorAll(".mw-parser-output h2[id], .mw-parser-output h3[id]")];
  const top = h("button", { type: "button", class: "toc-item top", onclick: () => window.scrollTo({ top: 0, behavior: "smooth" }) }, "(Top)");
  const items = heads.map((hd) =>
    h("button", { type: "button", class: `toc-item ${hd.tagName === "H3" ? "sub" : ""}`, onclick: () => { hd.scrollIntoView({ behavior: "smooth", block: "start" }); if (window.innerWidth <= 1000) R.toc.querySelector("details").open = false; } }, hd.textContent.trim()),
  );
  const details = h("details", { open: window.innerWidth > 1000 }, h("summary", null, "Contents", h("span", { class: "toc-count" }, String(heads.length))), h("div", { class: "toc-list" }, h("div", { class: "toc-title" }, title), top, items));
  R.toc.append(details);
  R.toc.hidden = heads.length === 0;
  R.body.classList.toggle("no-toc", R.toc.hidden);
  const map = new Map(heads.map((hd, i) => [hd, items[i]]));
  R.tocObs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        R.toc.querySelectorAll(".toc-item.on").forEach((x) => x.classList.remove("on"));
        const it = map.get(e.target);
        if (it) {
          it.classList.add("on");
          // Scroll the contents list itself. scrollIntoView would also nudge the page and fight your scrolling.
          if (window.innerWidth > 1000) {
            const top = it.offsetTop;
            if (top < R.toc.scrollTop + 48 || top > R.toc.scrollTop + R.toc.clientHeight - 72) R.toc.scrollTop = Math.max(0, top - R.toc.clientHeight / 3);
          }
        }
      }
    },
    { rootMargin: "-80px 0px -70% 0px" },
  );
  heads.forEach((hd) => R.tocObs.observe(hd));
}

function chip(title, cls) {
  return h("span", { class: `rchip ${cls}`, title }, title);
}

function renderHeader(v, u) {
  const r = v.round;
  clear(R.route);
  const target = h("button", { class: "rchip target", type: "button", title: "Show target summary", onclick: togglePeek }, icon("flag", 14), r.target);
  R.route.append(chip(r.start, "start"), h("span", { class: "rb-arrow" }, icon("arrow", 16)), target);

  const multi = r.mode !== "elim" && r.rules.rounds > 1;
  const roundTxt = r.mode === "elim" ? ` · Round ${r.n}` : multi ? ` · Round ${Math.min(v.match.played + (v.phase === "racing" ? 1 : 0), r.rules.rounds)} of ${r.rules.rounds}` : "";
  R.mode.textContent = MODE_LABEL[r.mode] + roundTxt;
  if (u && r.mode === "teams") {
    R.mode.style.background = TEAM_COLORS[u.team];
    R.mode.style.color = "#fff";
    R.mode.textContent = u.name + roundTxt;
  } else {
    R.mode.style.background = "";
    R.mode.style.color = "";
  }

  const limit = r.rules.clickLimit;
  clear(R.clicks);
  const bumped = u && R.lastMyClicks != null && R.lastMyClicks !== u.clicks;
  R.lastMyClicks = u ? u.clicks : null;
  R.clicks.append(h("span", { class: `stat-n${bumped ? " bump" : ""}` }, u ? String(u.clicks) : "-", limit ? h("small", null, ` / ${limit}`) : null), h("span", { class: "stat-l" }, "clicks"));
  R.clicks.classList.toggle("warn", Boolean(limit && u && limit - u.clicks <= 2 && u.status === "running"));

  clear(R.badges);
  const rule = (on, ic, label) => h("span", { class: `rbadge ${on ? "on" : "off"}`, title: `${label}: ${on ? "allowed" : "off"}` }, icon(ic, 14));
  const tabTitle = { off: "allowed", flag: "flagged", dq: r.mode === "teams" ? "flagged" : "disqualifies you" }[r.rules.tabLeave];
  R.badges.append(
    rule(r.rules.allowBack, "back", "Back button"),
    rule(r.rules.allowFind, "find", "Find in page"),
    h("span", { class: `rbadge ${r.rules.tabLeave === "off" ? "on" : r.rules.tabLeave === "dq" && r.mode !== "teams" ? "dq" : "flag"}`, title: `Leaving the tab: ${tabTitle}` }, icon("door", 14)),
  );

  const running = Boolean(u) && u.status === "running" && v.phase === "racing";
  R.backBtn.hidden = !(running && r.rules.allowBack);
  R.backBtn.disabled = !u || u.stack.length < 2 || (r.mode === "teams" && u.turn !== v.you);
  R.giveUp.hidden = !running || r.mode === "teams";
  R.boardBtn.querySelector(".bt-n").textContent = String(Object.keys(r.units).length);
}

async function togglePeek() {
  if (!R.peek.hidden) {
    R.peek.hidden = true;
    return;
  }
  const t = view().round.target;
  clear(R.peek);
  R.peek.hidden = false;
  const box = h("div", { class: "peek-card" }, h("div", { class: "eyebrow" }, "Your target"), h("h3", null, t), h("p", { class: "muted" }, "Loading..."));
  R.peek.append(box, h("button", { class: "icon-btn peek-x", type: "button", onclick: () => (R.peek.hidden = true) }, icon("x", 16)));
  const s = await summary(t);
  box.querySelector("p").textContent = s.extract || s.description || "";
  if (s.thumb) box.prepend(h("img", { src: s.thumb, alt: "" }));
}

// ── board ────────────────────────────────────────────────────────────────

function leavesOf(r, u) {
  return u.members.reduce((n, p) => n + ((r.watch[p] && r.watch[p].leaves) || 0), 0);
}
function awayOf(r, u) {
  return u.members.some((p) => r.watch[p] && r.watch[p].away);
}

function statusLine(u, r) {
  if (u.status === "won") return h("span", { class: "st won" }, icon("trophy", 13), `Reached it in ${fmtTime(u.finishMs)}`);
  if (u.status !== "running") return h("span", { class: `st ${u.status}` }, u.reason || "Out");
  if (u.hidden) return h("span", { class: "st" }, "Racing...");
  const cur = current(u);
  return h("span", { class: "st page", title: cur }, sameTitle(cur, r.start) && u.clicks === 0 ? "On the start page" : cur);
}

function sortedUnits(v) {
  const r = v.round;
  const idx = (k) => r.order.indexOf(k);
  return Object.values(r.units).sort((a, b) => (RANK[a.status] ?? 4) - (RANK[b.status] ?? 4) || idx(a.key) - idx(b.key));
}

function unitRow(v, u) {
  const r = v.round;
  const mine = u.key === v.myKey;
  const flags = h("span", { class: "flags" });
  const leaves = leavesOf(r, u);
  if (leaves > 0) flags.append(h("span", { class: "flag-pill", title: `Left the tab ${leaves}x` }, icon("door", 12), `${leaves}x`));
  if (awayOf(r, u) && u.status === "running" && v.phase === "racing") flags.append(h("span", { class: "flag-pill live" }, "away"));
  const av = u.team != null ? h("span", { class: "avatar sm", style: { background: TEAM_COLORS[u.team] }, "aria-hidden": "true" }, u.name.charAt(5)) : avatar(u.key, u.name, "sm");
  const main = h("div", { class: "bmain" }, h("div", { class: "bname" }, u.name, mine ? h("span", { class: "tag" }, "you") : null, flags), statusLine(u, r));
  if (r.mode === "teams") {
    main.append(
      h("div", { class: "members" }, u.names.map((n, i) => h("span", { class: `member${u.status === "running" && u.turn === u.members[i] ? " turn" : ""}` }, n))),
    );
  }
  return h("li", { class: `brow ${u.status}${mine ? " me" : ""}${u.members.some((p) => R.ctx.online(p)) ? "" : " offline"}` }, av, main, h("div", { class: "bclicks" }, h("b", { class: R.prevClicks && R.prevClicks[u.key] !== undefined && R.prevClicks[u.key] !== u.clicks ? "bump" : "" }, String(u.clicks)), h("small", null, "clicks")));
}

function renderBoard(v) {
  const r = v.round;
  clear(R.board);
  R.board.append(h("div", { class: "board-head" }, h("h2", { class: "card-title" }, `Round ${r.n}`), R.ctx.solo() ? soloChip(Boolean(v.settings.daily)) : roomChip(R.ctx), toolButtons(), R.ctx.solo() ? null : connDot(), h("button", { class: "icon-btn sm board-close", type: "button", title: "Close", onclick: () => document.body.classList.remove("board-open") }, icon("x", 16))));
  const ul = h("ul", { class: "blist" });
  for (const u of sortedUnits(v)) ul.append(unitRow(v, u));
  R.prevClicks = Object.fromEntries(Object.values(r.units).map((x) => [x.key, x.clicks]));
  R.board.append(ul);
  const inRound = new Set(Object.values(r.units).flatMap((u) => u.members));
  const out = v.players.filter((p) => !inRound.has(p.id));
  const bits = [];
  if (out.length) bits.push(`Out or waiting: ${out.map((p) => p.name).join(", ")}`);
  if (bits.length) R.board.append(h("p", { class: "muted sm pad" }, bits.join(". ")));
  if (R.ctx.isHost() && v.phase === "racing") {
    R.board.append(h("div", { class: "board-foot" }, h("button", { class: "btn sm ghost danger", type: "button", onclick: () => ask(R.ctx.solo() ? "End this round?" : "End this round for everyone?", { yes: "End round", danger: true }).then((y) => y && R.ctx.act({ kind: "endRound" })) }, icon("stop", 14), "End round")));
  }
}

function renderObserve(v) {
  const r = v.round;
  clear(R.observe);
  R.observe.append(h("h2", { class: "display" }, "Watching"), h("p", { class: "muted" }, `${r.start} to ${r.target}`));
  const grid = h("div", { class: "watch-grid" });
  for (const u of sortedUnits(v)) {
    const trail = u.hidden || !u.path ? [] : u.path.slice(-7);
    grid.append(
      h(
        "div",
        { class: `wcard ${u.status}` },
        h("div", { class: "wc-top" }, u.team != null ? h("span", { class: "avatar sm", style: { background: TEAM_COLORS[u.team] } }, u.name.charAt(5)) : avatar(u.key, u.name, "sm"), h("b", null, u.name), h("span", { class: "grow" }), h("span", { class: "wc-clicks" }, `${u.clicks} click${u.clicks === 1 ? "" : "s"}`)),
        statusLine(u, r),
        h("div", { class: "path" }, trail.map((s, i) => [i ? h("span", { class: "p-arrow" }, icon(s.back ? "back" : "arrow", 12)) : null, h("span", { class: `p-chip${s.back ? " back" : ""}` }, s.t)])),
      ),
    );
  }
  R.observe.append(grid);
}

// ── banner ───────────────────────────────────────────────────────────────

function renderBanner(v, u) {
  const r = v.round;
  clear(R.banner);
  let msg = "";
  let action = null;
  let cls = "reader-banner";
  if (!u) {
    msg = v.match.out.includes(v.you)
      ? "You're out. Watching the rest of the match."
      : "You joined mid race, so you're watching this round. You'll race in the next one.";
  } else if (v.phase === "racing") {
    if (u.status === "won") msg = r.mode === "fewest" || r.mode === "elim" ? "You reached it. Waiting for the others." : "You made it!";
    else if (u.status !== "running") msg = `${u.reason || "You're out"}. You can keep reading, but clicks don't count anymore.`;
    else if (r.mode === "teams" && R.ctx.now() >= r.startAt) {
      const mineTurn = u.turn === v.you;
      const who = nameAt(u, u.turn);
      const idle = !R.ctx.online(u.turn) || R.ctx.now() - u.turnAt > TURN_IDLE_MS;
      if (mineTurn) {
        msg = u.members.length > 1 ? "Your turn. Pick a link, or pass to a teammate." : "Pick a link.";
        cls += " turn";
        if (u.members.length > 1) action = ["Pass", () => R.ctx.act({ kind: "pass" })];
      } else {
        msg = `Waiting for ${who} to click. You can read along and talk it over.`;
        if (idle) action = [`Skip ${who}`, () => R.ctx.act({ kind: "pass" })];
      }
    }
  }
  R.banner.className = cls;
  R.banner.hidden = !msg;
  if (msg) {
    R.banner.append(h("span", null, msg));
    if (action) R.banner.append(h("button", { class: "btn sm", type: "button", onclick: action[1] }, icon("skip", 14), action[0]));
  }
}

// ── tick + update ────────────────────────────────────────────────────────

function flashGo() {
  R.go.hidden = false;
  R.go.classList.remove("on");
  void R.go.offsetWidth;
  R.go.classList.add("on");
  setTimeout(() => R && (R.go.hidden = true), 900);
}

function tick() {
  if (!R) return;
  const v = view();
  const r = v?.round;
  if (!r) return;
  const now = R.ctx.now();
  const u = me();
  const pre = now < r.startAt;

  if (v.phase === "racing" && pre) {
    const n = String(Math.ceil((r.startAt - now) / 1000));
    R.countdown.hidden = false;
    const big = R.countdown.querySelector(".cd-n");
    if (big && big.textContent !== n) {
      big.textContent = n;
      big.classList.remove("pop");
      void big.offsetWidth;
      big.classList.add("pop");
      sfx.tick();
    }
    R.cdLast = n;
  } else if (!R.countdown.hidden) {
    R.countdown.hidden = true;
    if (v.phase === "racing" && R.cdLast) {
      sfx.go();
      flashGo();
    }
    R.cdLast = null;
  }

  let text;
  let label = "time";
  let warn = false;
  if (r.endAt && v.phase === "racing") {
    const left = r.endAt - Math.max(now, r.startAt);
    text = fmtClock(left);
    label = "left";
    warn = left < 30000;
  } else if (v.phase === "racing") {
    text = fmtTime(u && u.status !== "running" && u.finishMs != null ? u.finishMs : Math.max(0, now - r.startAt));
  } else {
    const w = r.winner ? r.units[r.winner] : null;
    text = fmtTime(u && u.finishMs != null ? u.finishMs : w ? w.finishMs : (r.endedAt || r.startAt) - r.startAt);
  }
  // The clock updates ten times a second, so it changes the text in place instead of rebuilding.
  if (R.timerText !== text) {
    R.timerText = text;
    R.timerN.textContent = text;
  }
  if (R.timerLabel !== label) {
    R.timerLabel = label;
    R.timerL.textContent = label;
  }
  R.timer.classList.toggle("warn", warn);

  if (R.pending && Date.now() - R.pendingAt > 15000) raceError();
  if (r.mode === "teams" && v.phase === "racing" && now - R.bannerAt > 1000) {
    R.bannerAt = now;
    renderBanner(v, u);
  }

  guard.configure({
    active: v.phase === "racing" && Boolean(u) && u.status === "running",
    started: !pre,
    allowFind: r.rules.allowFind,
    allowBack: r.rules.allowBack,
    tabLeave: r.rules.tabLeave,
  });
}

function ruleSummary(r) {
  const s = r.rules;
  const bits = [s.allowBack ? "Back allowed" : "No back button", s.allowFind ? "Find allowed" : "No Ctrl+F"];
  if (s.tabLeave === "dq") bits.push(r.mode === "teams" ? "Leaving the tab gets flagged" : "Leaving the tab disqualifies you");
  else if (s.tabLeave === "flag") bits.push("Leaving the tab gets flagged");
  if (s.clickLimit) bits.push(`${s.clickLimit} click limit`);
  if (s.timeLimit) bits.push(`${s.timeLimit} min limit`);
  if (s.banned.length) bits.push(`Banned: ${s.banned.join(", ")}`);
  return bits.join(" · ");
}

function renderCountdown(v) {
  const r = v.round;
  clear(R.countdown);
  const modeLine = { race: "First to the target wins.", fewest: "Fewest clicks wins.", teams: "Take turns clicking. First team there wins.", elim: "The last to arrive is out." }[r.mode];
  R.countdown.append(
    h("div", { class: "cd-card" }, h("div", { class: "eyebrow" }, `Round ${r.n}`), h("div", { class: "cd-route" }, chip(r.start, "start"), icon("arrow"), chip(r.target, "target")), h("div", { class: "cd-n" }, ""), h("p", { class: "cd-mode" }, modeLine), h("p", { class: "cd-rules" }, ruleSummary(r))),
  );
}

function outcomeSound(v, u) {
  const r = v.round;
  if (!u || r.winner == null) return;
  const big = v.match.done && (r.mode === "elim" || r.rules.rounds > 1);
  const won = r.mode === "elim" ? !r.out.includes(v.myKey) : (r.points[v.myKey] || 0) > 0;
  if (won) {
    sfx.win();
    finale(Look.current().finale, { big });
  } else sfx.lose();
}

export function updateRace(ctx) {
  if (!R) return;
  R.ctx = ctx;
  const v = view();
  const r = v.round;
  const u = me();
  document.title = `${r.start} to ${r.target} · WikiDash`;

  if (R.roundN !== r.n) {
    R.roundN = r.n;
    R.displayed = null;
    R.loadingFor = null;
    R.pending = false;
    R.hideResults = false;
    R.resSig = null;
    R.myLeaves = 0;
    R.prevClicks = null;
    R.lastMyClicks = null;
    R.myStatus = u ? u.status : null;
    R.prevTurn = null;
    R.peek.hidden = true;
    R.showRes.hidden = true;
    renderCountdown(v);
  }

  if (u) {
    const mineLeaves = r.watch[v.you] ? r.watch[v.you].leaves : 0;
    if (mineLeaves > R.myLeaves && r.rules.tabLeave === "flag") toast("You left the tab. Everyone can see that.", "warn");
    if (u.status !== R.myStatus && u.status === "dq") toast("Disqualified for leaving the tab.", "error");
    if (u.status !== R.myStatus && u.status === "out") toast(u.reason || "You're out.", "warn");
    R.myLeaves = mineLeaves;
    R.myStatus = u.status;
    if (r.mode === "teams" && v.phase === "racing" && u.turn === v.you && R.prevTurn !== v.you && ctx.now() >= r.startAt) {
      sfx.tick();
      toast("Your turn.", "ok");
    }
    R.prevTurn = u.turn;
  }
  if (R.prevPhase === "racing" && v.phase === "over") outcomeSound(v, u);
  R.prevPhase = v.phase;

  renderHeader(v, u);
  renderBoard(v);
  renderBanner(v, u);

  if (u) {
    R.observe.hidden = true;
    R.article.hidden = false;
    const cur = current(u);
    if (!sameTitle(cur, R.displayed || "") && !sameTitle(cur, R.loadingFor || "")) load(cur);
  } else {
    R.article.hidden = true;
    R.observe.hidden = false;
    R.toc.hidden = true;
    R.body.classList.add("no-toc");
    renderObserve(v);
  }

  if (v.phase === "over") {
    const sig = resultsSig(v);
    if (R.resSig !== sig) {
      R.resSig = sig;
      clear(R.results);
      R.results.append(renderResults(ctx, v, { onHide: () => ((R.hideResults = true), (R.results.hidden = true), (R.showRes.hidden = false), syncResultsClass()) }));
    }
    R.results.hidden = R.hideResults;
    R.showRes.hidden = !R.hideResults;
  } else {
    R.results.hidden = true;
    R.showRes.hidden = true;
  }
  syncResultsClass();
  tick();
}
