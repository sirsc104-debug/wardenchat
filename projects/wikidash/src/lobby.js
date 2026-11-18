import { h, clear, icon, toast, avatar, debounce, fmtTime, TEAM_COLORS, TEAM_NAMES } from "./ui.js";
import { search, summary, canonical, sameTitle, idOf } from "./wiki.js";
import { ask, askText } from "./dialog.js";
import { BADGE_SVG } from "./wc/wallet.js";
import { brand, roomChip, soloChip, connDot, copyInvite, toolButtons } from "./shell.js";
import { getBest } from "./records.js";
import { fetchDaily, boardList, dateLabel, levelPill } from "./daily.js";

let R = null;

const CLICKS = [0, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50];
const TIMES = [0, 1, 2, 3, 5, 7, 10, 15, 20, 30];
const MODES = [["race", "Race"], ["fewest", "Fewest clicks"], ["teams", "Teams"], ["elim", "Elimination"]];
const MODE_TEXT = {
  race: "The first player to reach the target wins the round.",
  fewest: "Everyone races and the round ends when all are done. Fewest clicks wins.",
  teams: "Teammates share one path and take turns clicking. The first team to the target wins.",
  elim: "Everyone races. The last player to reach the target is out, until one is left.",
};
const LEVELS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

export function mountLobby(root, ctx) {
  const v = ctx.S.view;
  R = { ctx, slots: {}, controls: {}, daily: Boolean(v.settings.daily), busy: false };
  R.startbar = h("div", { class: "startbar" });
  R.visTag = h("span", { class: "vis-tag", hidden: true, title: "Listed on the home page for anyone to join" }, icon("users", 13), "Public");
  const missing = false;
  root.append(
    h("header", { class: "topbar" }, brand(), h("div", { class: "grow" }), ctx.solo() ? soloChip(R.daily) : roomChip(ctx), ctx.solo() ? null : R.visTag, toolButtons(), ctx.solo() ? null : connDot()),
  );
  if (missing) {
    R.missing = true;
    root.append(
      h("main", { class: "lobby" }, h("div", { class: "center-msg" }, h("h2", { class: "display" }, "Today's challenge isn't ready"), h("p", { class: "muted" }, "Wikipedia didn't answer in time. Go back and try again."), h("a", { class: "btn primary", href: "/" }, "Back to start"))),
    );
    return;
  }
  if (R.daily) mountDaily(root);
  else mountParty(root);
  root.append(R.startbar);
}

export function lobbyError() {
  if (!R) return;
  R.busy = false;
  for (const s of Object.values(R.slots)) setBusy(s, false);
  if (R.randBtn) paintRandom();
}

// ── daily ────────────────────────────────────────────────────────────────

function mountDaily(root) {
  const v = R.ctx.S.view;
  const board = h("div", { class: "daily-board" }, h("div", { class: "spinner sm" }));
  root.append(
    h(
      "main",
      { class: "lobby daily-lobby" },
      h("div", { class: "lobby-head" }, h("p", { class: "eyebrow" }, icon("calendar", 13), " Daily challenge ", levelPill(v.settings.routeLevel)), h("h1", { class: "display" }, "Same route for everyone"), h("p", { class: "muted" }, "Reach the target using only links. Fewest clicks wins. The back button and Ctrl+F are off, and leaving the tab is flagged on the leaderboard.")),
      h(
        "section",
        { class: "card route-card" },
        h("div", { class: "daily-route big" }, h("span", { class: "rchip start" }, v.settings.start.title), icon("arrow", 18), h("span", { class: "rchip target" }, icon("flag", 14), v.settings.target.title)),
        h("p", { class: "muted sm pad0" }, v.settings.routeHops ? `The shortest route is ${v.settings.routeHops} click${v.settings.routeHops === 1 ? "" : "s"}.` : ""),
      ),
      h("section", { class: "card pad-card" }, h("h2", { class: "card-title" }, "Today's leaderboard"), board),
    ),
  );
  fetchDaily()
    .then((d) => {
      board.replaceChildren(boardList(d.top, 10), h("p", { class: "muted sm" }, d.shared ? `${dateLabel(d.date)}. ${d.total} ${d.total === 1 ? "finish" : "finishes"} so far.` : `${dateLabel(d.date)}. Sign in to Claude to see everyone's results.`));
    })
    .catch(() => board.replaceChildren(h("p", { class: "muted sm" }, "The leaderboard isn't available right now.")));
}

// ── party lobby ──────────────────────────────────────────────────────────

function mountParty(root) {
  const ctx = R.ctx;
  R.route = h("section", { class: "card route-card" });
  R.game = h("section", { class: "card rules-card game-card" });
  R.rules = h("section", { class: "card rules-card" });
  R.players = h("aside", { class: "card players-card" });
  R.last = h("div", { class: "last-round" });
  root.append(
    h(
      "main",
      { class: "lobby" },
      h("div", { class: "lobby-head" }, h("h1", { class: "display" }, "Set the route"), h("p", { class: "muted" }, "Everyone starts on the same page. Reach the target using only links.")),
      h("div", { class: "lobby-grid" }, h("div", { class: "col-main" }, R.route, R.game, R.rules), h("div", { class: "col-side" }, R.players, R.last)),
    ),
  );
  buildRoute();
  buildGame();
  buildRules();
  
}

function setBusy(s, busy) {
  s.busy = busy;
  s.box.classList.toggle("busy", busy);
}

function buildRoute() {
  R.route.append(h("h2", { class: "card-title" }, "Route"));
  R.swap = h("button", { class: "icon-btn swap", type: "button", title: "Swap start and target", onclick: () => R.ctx.act({ kind: "swapPages" }) }, icon("swap"));
  R.route.append(h("div", { class: "route-grid" }, slot("start"), h("div", { class: "route-mid" }, R.swap), slot("target")));

  R.randBtn = h("button", { class: "btn", type: "button", onclick: onRandomRoute }, icon("dice", 16), h("span", null, "Random route"));
  const lv = LEVELS.map(([v, l]) => h("button", { type: "button", "data-v": v, onclick: () => patch({ difficulty: v }) }, l));
  R.controls.difficulty = (v, host) =>
    lv.forEach((b) => {
      b.classList.toggle("on", b.dataset.v === v);
      b.disabled = !host;
    });
  R.tools = h("div", { class: "route-tools" }, R.randBtn, h("div", { class: "seg" }, lv));
  R.hint = h("p", { class: "route-hint muted sm" });
  R.route.append(R.tools, R.hint, buildSuggest());
}

// ── suggestions ──────────────────────────────────────────────────────────

/** Players who aren't running the party can suggest pages. The host or a co-host picks. */
function buildSuggest() {
  const input = h("input", { class: "field", placeholder: "Suggest a page to the host", autocomplete: "off", spellcheck: "false", "aria-label": "Suggest a page" });
  const list = h("ul", { class: "suggest", role: "listbox" });
  attachSearch(input, list, (title) => {
    if (!title.trim()) return;
    input.value = "";
    list.classList.remove("open");
    R.ctx.act({ kind: "suggest", title });
  });
  R.suggPicker = h("div", { class: "picker" }, input, list);
  R.suggList = h("div", { class: "sug-list" });
  R.sugg = h("div", { class: "sugg" }, h("div", { class: "eyebrow" }, "Suggested pages"), R.suggPicker, R.suggList);
  return R.sugg;
}

function renderSuggest(v, ctx) {
  const host = ctx.isHost();
  const list = v.suggestions || [];
  R.sugg.hidden = host && !list.length;
  R.suggPicker.hidden = host;
  clear(R.suggList);
  if (!list.length) {
    R.suggList.append(h("p", { class: "muted sm" }, "Nothing suggested yet."));
    return;
  }
  for (const x of list) {
    const mine = x.by === v.you;
    R.suggList.append(
      h(
        "div",
        { class: "sug-row" },
        h("div", { class: "sug-main" }, h("b", null, x.title), h("span", { class: "muted sm" }, mine ? "from you" : `from ${x.name}`)),
        host ? h("button", { class: "btn sm", type: "button", onclick: () => ctx.act({ kind: "useSuggestion", id: x.id, which: "start" }) }, "Start") : null,
        host ? h("button", { class: "btn sm", type: "button", onclick: () => ctx.act({ kind: "useSuggestion", id: x.id, which: "target" }) }, "Target") : null,
        host || mine ? h("button", { class: "icon-btn sm", type: "button", title: host ? "Dismiss" : "Take back", onclick: () => ctx.act({ kind: "dismissSuggestion", id: x.id }) }, icon("x", 14)) : null,
      ),
    );
  }
}

function paintRandom() {
  R.randBtn.disabled = R.busy;
  R.randBtn.querySelector("span:last-child").textContent = R.busy ? "Building a route..." : "Random route";
}

function onRandomRoute() {
  const s = R.ctx.S.view.settings;
  R.busy = true;
  R.randSig = JSON.stringify([s.start, s.target]);
  paintRandom();
  R.ctx.act({ kind: "randomRoute" });
  setTimeout(() => {
    if (R && R.busy) {
      R.busy = false;
      paintRandom();
    }
  }, 25000);
}

/** Wikipedia title search under an input: arrows to move, Enter to pick, or type a full title. */
function attachSearch(input, list, choose) {
  let items = [];
  let idx = -1;
  const run = debounce(async (q) => {
    if (!q.trim()) return list.classList.remove("open");
    try {
      const res = await search(q);
      if (input.value !== q) return;
      items = res;
      idx = -1;
      clear(list);
      if (!res.length) list.append(h("li", { class: "empty" }, "No articles found"));
      res.forEach((t, i) => list.append(h("li", { role: "option", "data-i": i, onmousedown: (e) => (e.preventDefault(), choose(t)) }, t)));
      list.classList.add("open");
    } catch {
      /* ignore */
    }
  }, 160);
  input.addEventListener("input", () => run(input.value));
  input.addEventListener("blur", () => setTimeout(() => list.classList.remove("open"), 120));
  input.addEventListener("keydown", (e) => {
    const lis = [...list.querySelectorAll("li[role=option]")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!lis.length) return;
      idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + lis.length) % lis.length;
      lis.forEach((li, i) => li.classList.toggle("on", i === idx));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(idx >= 0 && items[idx] ? items[idx] : input.value);
    } else if (e.key === "Escape") {
      list.classList.remove("open");
    }
  });
}

function slot(which) {
  const s = { which, title: undefined, busy: false, items: [], idx: -1 };
  s.input = h("input", {
    class: "field", placeholder: which === "start" ? "Search a start page" : "Search a target page",
    autocomplete: "off", spellcheck: "false", "aria-label": `${which} page`,
  });
  s.list = h("ul", { class: "suggest", role: "listbox" });
  const choose = (title) => {
    if (!title.trim()) return;
    setBusy(s, true);
    s.input.value = "";
    s.list.classList.remove("open");
    R.ctx.act({ kind: "setPage", which, title });
  };
  attachSearch(s.input, s.list, choose);
  s.dice = h("button", { class: "icon-btn", type: "button", title: "Random article", onclick: () => (setBusy(s, true), R.ctx.act({ kind: "randomPage", which })) }, icon("dice"));
  s.picker = h("div", { class: "picker" }, h("div", { class: "picker-row" }, s.input, s.dice), s.list);
  s.card = h("div", { class: "page-card empty" });
  s.box = h("div", { class: `slot slot-${which}` }, h("div", { class: "slot-label" }, h("span", { class: `pin ${which}` }), which === "start" ? "Start" : "Target"), s.card, s.picker);
  R.slots[which] = s;
  return s.box;
}

function renderCard(s, title, host) {
  clear(s.card);
  if (!title) {
    s.card.className = "page-card empty";
    s.card.append(h("p", null, host ? "Search below or roll a random page." : "The host is picking..."));
    return;
  }
  s.card.className = "page-card";
  void s.card.offsetWidth;
  s.card.className = "page-card swap";
  const body = h("div", { class: "pc-body" }, h("div", { class: "pc-title" }, title), h("div", { class: "pc-desc" }), h("p", { class: "pc-extract" }));
  const thumb = h("div", { class: "pc-thumb none" });
  s.card.append(thumb, body);
  if (host) s.card.append(h("button", { class: "icon-btn pc-x", type: "button", title: "Clear", onclick: () => R.ctx.act({ kind: "clearPage", which: s.which }) }, icon("x", 16)));
  summary(title).then((sm) => {
    if (s.title !== title) return;
    body.querySelector(".pc-desc").textContent = sm.description;
    body.querySelector(".pc-extract").textContent = sm.extract;
    if (sm.thumb) thumb.append(h("img", { src: sm.thumb, alt: "", loading: "lazy" }));
    else thumb.classList.add("none");
  });
}

// ── game + rules ─────────────────────────────────────────────────────────

function patch(p) {
  R.ctx.act({ kind: "settings", patch: p });
}

function ruleRow(label, desc, control, extra) {
  return h("div", { class: `rule${extra || ""}` }, h("div", { class: "rule-text" }, h("div", { class: "rule-name" }, label), h("div", { class: "rule-desc" }, desc)), control);
}

function toggleRow(key, label, desc) {
  const sw = h("button", { class: "switch", type: "button", role: "switch", "aria-label": label, onclick: () => patch({ [key]: sw.getAttribute("aria-checked") !== "true" }) }, h("span"));
  R.controls[key] = (v, host) => {
    sw.setAttribute("aria-checked", String(Boolean(v)));
    sw.disabled = !host;
  };
  return ruleRow(label, desc, sw);
}

function segControl(key, options) {
  const btns = options.map(([v, l]) => h("button", { type: "button", "data-v": String(v), onclick: () => patch({ [key]: v }) }, l));
  R.controls[key] = (v, host) =>
    btns.forEach((b) => {
      b.classList.toggle("on", b.dataset.v === String(v));
      b.disabled = !host;
    });
  return h("div", { class: "seg" }, btns);
}

function selectRow(key, label, desc, values, fmt) {
  const sel = h("select", { class: "select", onchange: () => patch({ [key]: Number(sel.value) }) }, values.map((v) => h("option", { value: v }, fmt(v))));
  R.controls[key] = (v, host) => {
    sel.value = String(v);
    sel.disabled = !host;
  };
  return ruleRow(label, desc, sel);
}

function bannedRow() {
  const chips = h("div", { class: "chips" });
  const input = h("input", { class: "field sm", placeholder: "Ban a page", maxlength: 100, spellcheck: "false" });
  const add = async (raw) => {
    const t = (raw || input.value).trim();
    if (!t) return;
    const list = R.ctx.S.view.settings.banned;
    if (list.length >= 12) return toast("Up to 12 banned pages.", "warn");
    const canon = await canonical(t).catch(() => null);
    if (!canon) return toast(`"${t}" isn't in this edition.`, "error");
    if (list.some((b) => sameTitle(b, canon))) return toast(`"${canon}" is already banned.`, "warn");
    input.value = "";
    patch({ banned: [...list, canon] });
  };
  input.addEventListener("keydown", (e) => e.key === "Enter" && add());
  const quick = h("div", { class: "quick-bans" });
  const adder = h("div", { class: "ban-add" }, input, h("button", { class: "btn sm", type: "button", onclick: () => add() }, "Ban"));
  R.controls.banned = (list, host) => {
    clear(chips);
    if (!list.length) chips.append(h("span", { class: "muted sm" }, "No banned pages"));
    for (const b of list) {
      chips.append(h("span", { class: "chip ban" }, icon("ban", 13), b, host ? h("button", { type: "button", title: `Unban ${b}`, onclick: () => patch({ banned: list.filter((x) => x !== b) }) }, icon("x", 12)) : null));
    }
    adder.hidden = !host;
    clear(quick);
    if (host) {
      for (const q of ["United States", "United Kingdom", "Europe", "World War II"]) {
        if (idOf(q) >= 0 && !list.some((b) => sameTitle(b, q))) quick.append(h("button", { class: "chip suggest-chip", type: "button", onclick: () => add(q) }, "+ ", q));
      }
    }
  };
  return h("div", { class: "rule col" }, h("div", { class: "rule-text" }, h("div", { class: "rule-name" }, "Banned pages"), h("div", { class: "rule-desc" }, "Clicking into one of these is blocked. Classic rule: no United States.")), chips, adder, quick);
}

function buildGame() {
  R.modeDesc = h("div", { class: "rule-desc mode-desc" });
  R.rowVis = ruleRow("Who can join", "Private: only people with the code or link. Public: listed on the home page so anyone can join.", segControl("visibility", [["private", "Private"], ["public", "Public"]]));
  R.rowMode = h("div", { class: "rule col" }, h("div", { class: "rule-text" }, h("div", { class: "rule-name" }, "Game mode")), segControl("mode", MODES), R.modeDesc);
  R.rowRounds = ruleRow("Rounds", "Points add up across rounds. 3 for a win. Fewest clicks gives 3, 2 and 1.", segControl("rounds", [[1, "1"], [3, "3"], [5, "5"], [7, "7"]]));
  R.rowTeams = ruleRow("Teams", "Players are split evenly. Tap a team tag in the player list to switch.", segControl("teamCount", [[2, "2"], [3, "3"], [4, "4"]]));
  R.game.append(h("div", { class: "card-head" }, h("h2", { class: "card-title" }, "Game"), h("span", { class: "host-only-note" }, "Only the host can change these")), R.rowVis, R.rowMode, R.rowRounds, R.rowTeams);
}

function buildRules() {
  R.rules.append(
    h("div", { class: "card-head" }, h("h2", { class: "card-title" }, "Rules")),
    toggleRow("allowBack", "Back button", "Let players go back a page. Each back counts as a click."),
    toggleRow("allowFind", "Find in page (Ctrl+F)", "When off, Ctrl+F, quick find and copying text are blocked."),
    ruleRow("Leaving the tab", "Switching tabs or apps mid race, like to google something.", segControl("tabLeave", [["off", "Allowed"], ["flag", "Flag it"], ["dq", "Disqualify"]])),
    selectRow("clickLimit", "Click limit", "Run out of clicks and you're out.", CLICKS, (v) => (v ? `${v} clicks` : "No limit")),
    selectRow("timeLimit", "Time limit", "The round ends when the clock runs out.", TIMES, (v) => (v ? `${v} min` : "No limit")),
    toggleRow("showPositions", "Show live positions", "Everyone can see which page the others are on."),
    toggleRow("allowNavboxes", "Navigation boxes", "The big link tables at the bottom of articles. Turn off for a harder race."),
    bannedRow(),
  );
}

// ── players ──────────────────────────────────────────────────────────────

function renderPlayers(v) {
  const ctx = R.ctx;
  clear(R.players);
  const host = ctx.isHost();
  const owner = ctx.isOwner();
  const teams = v.settings.mode === "teams";
  R.players.append(
    h(
      "div",
      { class: "card-head" },
      h("h2", { class: "card-title" }, "Players ", h("span", { class: "count" }, String(v.players.length))),
      ctx.solo() ? null : h("div", { class: "head-btns" }, ctx.wardenParty() ? h("button", { class: "btn sm", type: "button", onclick: () => ctx.inviteFriends() }, icon("users", 14), "Invite friends") : null, h("button", { class: "btn sm ghost", type: "button", onclick: () => copyInvite(ctx.S.code) }, icon("copy", 14), "Code")),
    ),
  );
  if (v.host && !ctx.online(v.host) && !host && v.joined) {
    R.players.append(h("div", { class: "notice" }, "The host is offline.", h("button", { class: "btn sm", type: "button", onclick: () => ctx.act({ kind: "claimHost" }) }, "Take over as host")));
  }
  const ul = h("ul", { class: "plist" });
  for (const p of v.players) {
    const me = p.id === v.you;
    const row = h(
      "li",
      { class: `prow${ctx.online(p.id) ? "" : " offline"}${R.seenPlayers && !R.seenPlayers.has(p.id) ? " enter" : ""}` },
      avatar(p.id, p.name),
      h("span", { class: "pname" }, p.name, p.member ? badgeEl() : null, me ? h("span", { class: "tag" }, "you") : null, p.id === v.host ? h("span", { class: "tag host" }, icon("crown", 12), "host") : null, (v.cohosts || []).includes(p.id) ? h("span", { class: "tag co" }, icon("shield", 12), "co-host") : null),
    );
    if (teams) {
      const chip = h("button", { class: "team-chip", type: "button", style: { background: TEAM_COLORS[p.team] || "#888" }, disabled: !(me || host), title: me || host ? "Switch team" : "" }, TEAM_NAMES[p.team] || "?");
      chip.addEventListener("click", () => ctx.act({ kind: "setTeam", pid: p.id, team: (p.team + 1) % v.settings.teamCount }));
      row.append(chip);
    }
    const tools = h("span", { class: "ptools" });
    const isCo = (v.cohosts || []).includes(p.id);
    if (me && v.joined) {
      tools.append(
        h("button", {
          class: "icon-btn sm", type: "button", title: "Change your name",
          onclick: () => {
            askText("Your name", ctx.S.name).then((n) => {
              if (n && n.trim()) ctx.setName(n);
            });
          },
        }, icon("pencil", 14)),
      );
    } else if (owner) {
      tools.append(
        h("button", { class: `icon-btn sm${isCo ? " on" : ""}`, type: "button", title: isCo ? `Remove ${p.name} as co-host` : `Make ${p.name} a co-host`, onclick: () => ctx.act({ kind: "setCohost", pid: p.id, on: !isCo }) }, icon("shield", 14)),
        h("button", { class: "icon-btn sm", type: "button", title: `Make ${p.name} the host`, onclick: () => ctx.act({ kind: "makeHost", pid: p.id }) }, icon("crown", 14)),
        h("button", { class: "icon-btn sm danger", type: "button", title: `Remove ${p.name}`, onclick: () => ask(`Remove ${p.name} from the party?`, { yes: "Remove", danger: true }).then((y) => y && ctx.act({ kind: "kick", pid: p.id })) }, icon("x", 14)),
      );
    } else if (host && !isCo && p.id !== v.host) {
      tools.append(h("button", { class: "icon-btn sm danger", type: "button", title: `Remove ${p.name}`, onclick: () => ask(`Remove ${p.name} from the party?`, { yes: "Remove", danger: true }).then((y) => y && ctx.act({ kind: "kick", pid: p.id })) }, icon("x", 14)));
    }
    row.append(tools);
    ul.append(row);
  }
  R.players.append(ul);
  R.seenPlayers = new Set(v.players.map((x) => x.id));
  if (v.players.length < 2) R.players.append(h("p", { class: "muted sm pad" }, ctx.solo() ? "You're racing solo. To race friends, go back to the start and create a party." : `Friends join with the code ${ctx.S.code}. You can also start on your own.`));
}

function renderLast(v) {
  const r = v.round;
  const stamp = v.phase === "lobby" && r ? r.n : 0;
  if (R.lastStamp === stamp) return;
  R.lastStamp = stamp;
  clear(R.last);
  if (!r || v.phase !== "lobby") return;
  const w = r.winner ? r.units[r.winner] : null;
  R.last.append(
    h(
      "div",
      { class: "card last-card" },
      h("div", { class: "eyebrow" }, `Last round`),
      w ? h("p", null, icon("trophy", 16), h("b", null, w.name), ` reached ${r.target} in ${fmtTime(w.finishMs)} with ${w.clicks} click${w.clicks === 1 ? "" : "s"}.`) : h("p", null, `Nobody reached ${r.target}.`),
    ),
  );
}

// ── update ───────────────────────────────────────────────────────────────

function problem(v, ctx) {
  const s = v.settings;
  if (!s.start || !s.target) return "Pick a start and a target page.";
  if (sameTitle(s.start.title, s.target.title)) return "Start and target must be different.";
  const online = v.players.filter((p) => ctx.online(p.id));
  if (s.mode === "elim" && online.length < 2) return "Elimination needs at least 2 players.";
  if (s.mode === "teams" && new Set(online.map((p) => p.team)).size < 2) return "Put players on at least two teams.";
  return "";
}

function renderStartbar(v, ctx) {
  clear(R.startbar);
  const s = v.settings;
  const host = ctx.isHost();
  const hostName = v.players.find((p) => p.id === v.host)?.name || "the host";
  if (!host) {
    R.startbar.append(h("div", { class: "sb-info waiting" }, h("span", { class: "pulse" }), `Waiting for ${hostName} to start the race`));
    return;
  }
  const p = R.daily ? "" : problem(v, ctx);
  const online = v.players.filter((x) => ctx.online(x.id)).length;
  const label = R.daily ? "Start" : s.mode === "elim" ? "Start elimination" : s.rounds > 1 ? "Start match" : "Start race";
  const info = R.daily ? "Ready when you are" : p || (s.mode === "teams" ? `${new Set(v.players.filter((x) => ctx.online(x.id)).map((x) => x.team)).size} teams will race` : `${online} player${online === 1 ? "" : "s"} will race`);
  R.startbar.append(h("div", { class: "sb-info" }, info), h("button", { class: "btn primary xl", type: "button", disabled: Boolean(p), onclick: () => ctx.act({ kind: "start" }) }, label, icon("flag")));
}

export function updateLobby(ctx) {
  if (!R || R.missing) return;
  R.ctx = ctx;
  const v = ctx.S.view;
  document.title = R.daily ? "WikiDash daily challenge" : "WikiDash lobby";
  if (R.daily) return renderStartbar(v, ctx);
  const host = ctx.isHost();
  const s = v.settings;
  R.route.classList.toggle("is-host", host);
  R.rules.classList.toggle("is-host", host);
  R.game.classList.toggle("is-host", host);

  for (const which of ["start", "target"]) {
    const sl = R.slots[which];
    const title = s[which]?.title || null;
    sl.picker.hidden = !host;
    if (title !== sl.title || sl.wasHost !== host) {
      sl.title = title;
      sl.wasHost = host;
      setBusy(sl, false);
      renderCard(sl, title, host);
    }
  }
  R.swap.hidden = !host;
  R.swap.disabled = !s.start && !s.target;
  R.tools.hidden = !host;
  if (R.busy && JSON.stringify([s.start, s.target]) !== R.randSig) R.busy = false;
  paintRandom();
  const best = s.start && s.target ? getBest(s.start.title, s.target.title) : null;
  R.hint.textContent = [
    s.routeHops ? `The shortest route is ${s.routeHops} click${s.routeHops === 1 ? "" : "s"}.` : "",
    best ? `Your best here: ${fmtTime(best.ms)}, ${best.clicks} click${best.clicks === 1 ? "" : "s"}.` : "",
  ].filter(Boolean).join(" ");
  R.hint.hidden = !R.hint.textContent;

  for (const [k, fn] of Object.entries(R.controls)) fn(s[k], host);
  R.modeDesc.textContent = MODE_TEXT[s.mode];
  R.visTag.hidden = s.visibility !== "public";
  R.rowVis.hidden = ctx.solo();
  R.rowRounds.hidden = s.mode === "elim";
  R.rowTeams.hidden = s.mode !== "teams";
  renderPlayers(v);
  renderSuggest(v, ctx);
  renderLast(v);
  renderStartbar(v, ctx);
}

function badgeEl() {
  const b = document.createElement("span");
  b.className = "badge-wrap";
  b.innerHTML = BADGE_SVG;
  return b;
}
