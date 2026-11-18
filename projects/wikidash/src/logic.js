/**
 * WikiDash rules. Pure functions over JSON state.
 *
 * The room (src/room.ts) is the trusted half: it stamps every action with a
 * server-side `_t` object (clock, connected players, Wikipedia lookups, generated
 * routes). Client supplied `_t` is always stripped before it reaches this file, so
 * anything read from `_t` here can be trusted.
 *
 * Modes: race (first to the target), fewest (fewest clicks, waits for everyone),
 * teams (shared path, taking turns), elim (last to arrive is out each round).
 * A "unit" is whatever moves: one player, or one team.
 */

export const meta = { game: "WikiDash", minPlayers: 1, maxPlayers: 24 };

const MODES = ["race", "fewest", "teams", "elim"];
const TAB_MODES = ["off", "flag", "dq"];
const CLICK_LIMITS = [0, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50];
const TIME_LIMITS = [0, 1, 2, 3, 5, 7, 10, 15, 20, 30];
const ROUNDS = [1, 3, 5, 7];
const TEAM_COUNTS = [2, 3, 4];
const LEVELS = ["easy", "medium", "hard"];
const COUNTDOWN_MS = 3000;
const MAX_BANNED = 12;
const TURN_IDLE_MS = 25000;
const POINTS = [3, 2, 1];
const SYSTEM = "__system";
const STATUS_RANK = { dnf: 0, out: 1, dq: 2 };

function defaultSettings() {
  return {
    start: null,
    target: null,
    routeHops: 0,
    difficulty: "medium",
    mode: "race",
    rounds: 1,
    teamCount: 2,
    allowBack: false,
    allowFind: false,
    tabLeave: "flag",
    clickLimit: 0,
    timeLimit: 0,
    showPositions: true,
    allowNavboxes: true,
    banned: [],
    daily: null,
    routeLevel: null,
    visibility: "private",
  };
}

function newMatch() {
  return { scores: {}, labels: {}, played: 0, roster: [], out: [], done: false, champs: [] };
}

export function setup(players) {
  const state = {
    v: 2,
    phase: "lobby",
    host: null,
    order: [],
    players: {},
    kicked: [],
    cohosts: [],
    suggestions: [],
    sugSeq: 0,
    settings: defaultSettings(),
    match: newMatch(),
    round: null,
    roundNo: 0,
  };
  for (const p of players) {
    state.order.push(p);
    state.players[p] = { name: "Player", team: state.order.length % 2 === 0 ? 1 : 0 };
    if (!state.host) state.host = p;
  }
  return state;
}

// ── helpers ──────────────────────────────────────────────────────────────

const ok = { ok: true };
const no = (error) => ({ ok: false, error });
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const key = (t) => String(t || "").trim().toLowerCase();
const clone = (v) => JSON.parse(JSON.stringify(v));

function cleanName(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
}
function cleanAvatar(raw) {
  return typeof raw === "string" && /^[a-z]{1,16}$/.test(raw) ? raw : null;
}
function cleanTitle(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 255);
}
function now(action) {
  return isObj(action._t) && Number.isFinite(action._t.now) ? action._t.now : 0;
}
function tOf(action) {
  return isObj(action._t) ? action._t : {};
}
function isHost(state, pid) {
  return state.host === pid;
}
function cohostsOf(state) {
  return Array.isArray(state.cohosts) ? state.cohosts : [];
}
function suggestionsOf(state) {
  return Array.isArray(state.suggestions) ? state.suggestions : [];
}
/** The host and any co-hosts can run the party. */
function canHost(state, pid) {
  return state.host === pid || cohostsOf(state).includes(pid);
}
function unitOf(state, pid) {
  const r = state.round;
  if (!r) return null;
  const k = r.teamOf[pid];
  return k ? r.units[k] : null;
}
function current(u) {
  return u.stack[u.stack.length - 1];
}
function lobbyOnly(state) {
  return state.phase === "lobby";
}
function isBanned(settings, title) {
  const k = key(title);
  return settings.banned.some((b) => key(b) === k);
}
function onlinePlayers(state, t) {
  return Array.isArray(t.connected) ? state.order.filter((p) => t.connected.includes(p)) : state.order.slice();
}
function validRoute(rt) {
  return isObj(rt) && cleanTitle(rt.start) && cleanTitle(rt.target) && key(rt.start) !== key(rt.target);
}
function rebalance(state) {
  const n = state.settings.teamCount;
  state.order.forEach((p, i) => {
    state.players[p].team = i % n;
  });
}
function smallestTeam(state) {
  const n = state.settings.teamCount;
  const counts = new Array(n).fill(0);
  for (const p of state.order) {
    const t = state.players[p].team;
    if (t < n) counts[t] += 1;
  }
  return counts.indexOf(Math.min(...counts));
}

function validSettingsPatch(p) {
  if (!isObj(p)) return "settings must be an object";
  for (const [k, v] of Object.entries(p)) {
    switch (k) {
      case "allowBack":
      case "allowFind":
      case "showPositions":
      case "allowNavboxes":
        if (typeof v !== "boolean") return `${k} must be true or false`;
        break;
      case "tabLeave":
        if (!TAB_MODES.includes(v)) return "tabLeave must be off, flag or dq";
        break;
      case "clickLimit":
        if (!CLICK_LIMITS.includes(v)) return "unsupported click limit";
        break;
      case "timeLimit":
        if (!TIME_LIMITS.includes(v)) return "unsupported time limit";
        break;
      case "mode":
        if (!MODES.includes(v)) return "unknown game mode";
        break;
      case "rounds":
        if (!ROUNDS.includes(v)) return "unsupported round count";
        break;
      case "teamCount":
        if (!TEAM_COUNTS.includes(v)) return "unsupported team count";
        break;
      case "difficulty":
        if (!LEVELS.includes(v)) return "unknown difficulty";
        break;
      case "visibility":
        if (v !== "private" && v !== "public") return "visibility must be private or public";
        break;
      case "banned":
        if (!Array.isArray(v) || v.length > MAX_BANNED) return `up to ${MAX_BANNED} banned pages`;
        if (v.some((t) => !cleanTitle(t))) return "banned pages must be titles";
        break;
      default:
        return `unknown setting: ${k}`;
    }
  }
  return null;
}

/** Why a round can't start with these players, or null. */
function playerProblem(state, t) {
  const s = state.settings;
  const online = onlinePlayers(state, t);
  if (s.mode === "elim" && online.length < 2) return "Elimination needs at least 2 players.";
  if (s.mode === "teams") {
    const teams = new Set(online.map((p) => state.players[p].team));
    if (teams.size < 2) return "Teams mode needs players on at least two teams.";
  }
  return null;
}

function routeProblem(state) {
  const s = state.settings;
  if (!s.start || !s.target) return "Pick a start and a target page.";
  if (key(s.start.title) === key(s.target.title)) return "Start and target must be different pages.";
  if (isBanned(s, s.target.title)) return "The target page is on the banned list.";
  if (isBanned(s, s.start.title)) return "The start page is on the banned list.";
  return null;
}

// ── validate ─────────────────────────────────────────────────────────────

export function validateAction(state, playerId, action) {
  if (!isObj(action) || typeof action.kind !== "string") return no("bad action");
  const t = tOf(action);
  const known = Boolean(state.players[playerId]);
  const s = state.settings;
  const locked = Boolean(s.daily);

  if (action.kind === "hello") {
    if (state.kicked.includes(playerId)) return no("You were removed from this party.");
    if (!cleanName(action.name)) return no("Pick a name first.");
    if (!known && state.order.length >= meta.maxPlayers) return no("This party is full.");
    if (!known && locked && state.order.length >= 1) return no("This daily challenge is a solo attempt.");
    return ok;
  }
  if (action.kind === "tick") return playerId === SYSTEM ? ok : no("not allowed");
  if (action.kind === "dailySetup") {
    if (playerId !== SYSTEM || !lobbyOnly(state) || s.daily) return no("not allowed");
    return validRoute(t.route) && typeof t.date === "string" ? ok : no("bad daily route");
  }
  if (!known) return no("Join the party first.");

  switch (action.kind) {
    case "settings": {
      if (!canHost(state, playerId)) return no("Only the host can change rules.");
      if (!lobbyOnly(state)) return no("Rules are locked during a match.");
      if (locked) return no("The daily challenge rules are fixed.");
      const err = validSettingsPatch(action.patch);
      return err ? no(err) : ok;
    }
    case "setPage": {
      if (!canHost(state, playerId)) return no("Only the host can pick pages.");
      if (!lobbyOnly(state)) return no("Pages are locked during a match.");
      if (locked) return no("The daily route is fixed.");
      if (action.which !== "start" && action.which !== "target") return no("bad page slot");
      if (!isObj(t.resolved) || !cleanTitle(t.resolved.title)) return no("Couldn't find that article.");
      return ok;
    }
    case "setRoute":
      if (!canHost(state, playerId)) return no("Only the host can pick pages.");
      if (!lobbyOnly(state)) return no("Pages are locked during a match.");
      if (locked) return no("The daily route is fixed.");
      return validRoute(t.route) ? ok : no("Couldn't build a route. Try again.");
    case "clearPage":
      if (!canHost(state, playerId)) return no("Only the host can pick pages.");
      if (!lobbyOnly(state) || locked) return no("Pages are locked.");
      return action.which === "start" || action.which === "target" ? ok : no("bad page slot");
    case "swapPages":
      if (!canHost(state, playerId)) return no("Only the host can pick pages.");
      return lobbyOnly(state) && !locked ? ok : no("Pages are locked.");
    case "setTeam": {
      const pid = typeof action.pid === "string" ? action.pid : playerId;
      if (!state.players[pid]) return no("No such player.");
      if (pid !== playerId && !canHost(state, playerId)) return no("Only the host can move other players.");
      if (!lobbyOnly(state)) return no("Teams are locked during a match.");
      if (!Number.isInteger(action.team) || action.team < 0 || action.team >= s.teamCount) return no("No such team.");
      return ok;
    }
    case "start": {
      if (!canHost(state, playerId)) return no("Only the host can start.");
      if (!lobbyOnly(state)) return no("A match is already running.");
      const p = routeProblem(state) || playerProblem(state, t);
      return p ? no(p) : ok;
    }
    case "next": {
      if (!canHost(state, playerId)) return no("Only the host can continue.");
      if (state.phase !== "over") return no("The round isn't over yet.");
      if (action.route !== "new" && action.route !== "same") return no("bad route choice");
      if (action.route === "new") {
        if (locked) return no("The daily route is fixed.");
        if (!validRoute(t.route)) return no("Couldn't build a route. Try again.");
      } else {
        const p = routeProblem(state);
        if (p) return no(p);
      }
      const p2 = state.match.done ? playerProblem(state, t) : null;
      return p2 ? no(p2) : ok;
    }
    case "move": {
      if (state.phase !== "racing") return no("No race is running.");
      const u = unitOf(state, playerId);
      if (!u) return no("You're not in this round.");
      if (u.status !== "running") return no("You're out of this round.");
      if (now(action) < state.round.startAt) return no("Wait for the countdown.");
      if (state.round.mode === "teams" && u.turn !== playerId) {
        const who = state.round.watch[u.turn] ? state.round.watch[u.turn].name : "a teammate";
        return no(`It's ${who}'s turn.`);
      }
      if (t.from !== current(u)) return no("Page changed, try again.");
      if (!t.verified) return no(typeof t.reason === "string" ? t.reason : "That link isn't on this page.");
      const to = cleanTitle(t.canon);
      if (!to) return no("That link isn't an article.");
      if (key(to) === key(current(u))) return no("That link points back to this page.");
      if (isBanned(state.round.rules, to)) return no(`"${to}" is banned this round.`);
      return ok;
    }
    case "back": {
      if (state.phase !== "racing") return no("No race is running.");
      if (!state.round.rules.allowBack) return no("The back button is off this round.");
      const u = unitOf(state, playerId);
      if (!u || u.status !== "running") return no("You're not racing.");
      if (now(action) < state.round.startAt) return no("Wait for the countdown.");
      if (state.round.mode === "teams" && u.turn !== playerId) return no("It's not your turn.");
      if (u.stack.length < 2) return no("Nothing to go back to.");
      return ok;
    }
    case "pass": {
      if (state.phase !== "racing" || state.round.mode !== "teams") return no("Nothing to pass.");
      const u = unitOf(state, playerId);
      if (!u || u.status !== "running") return no("You're not racing.");
      if (now(action) < state.round.startAt) return no("Wait for the countdown.");
      if (u.turn === playerId) return ok;
      const online = Array.isArray(t.connected) ? t.connected : [];
      if (!online.includes(u.turn) || now(action) - u.turnAt > TURN_IDLE_MS) return ok;
      return no("It's still their turn.");
    }
    case "left": {
      if (state.phase !== "racing") return no("No race is running.");
      const u = unitOf(state, playerId);
      if (!u || u.status !== "running") return no("You're not racing.");
      if (action.phase !== "start" && action.phase !== "end") return no("bad leave report");
      return ok;
    }
    case "forfeit": {
      const u = unitOf(state, playerId);
      if (state.phase !== "racing" || !u || u.status !== "running") return no("You're not racing.");
      if (state.round.mode === "teams") return no("Teams can't give up.");
      return ok;
    }
    case "endRound":
      if (!canHost(state, playerId)) return no("Only the host can end the round.");
      return state.phase === "racing" ? ok : no("No race is running.");
    case "lobby":
      if (!canHost(state, playerId)) return no("Only the host can do that.");
      return state.phase === "over" ? ok : no("Finish the round first.");
    case "kick":
      if (!canHost(state, playerId)) return no("Only the host can remove players.");
      if (action.pid === playerId) return no("You can't remove yourself.");
      if (action.pid === state.host) return no("You can't remove the host.");
      if (cohostsOf(state).includes(action.pid) && !isHost(state, playerId)) return no("Only the host can remove a co-host.");
      return state.players[action.pid] ? ok : no("No such player.");
    case "setCohost":
      if (!isHost(state, playerId)) return no("Only the host can choose co-hosts.");
      if (!state.players[action.pid] || action.pid === state.host) return no("Pick another player.");
      return typeof action.on === "boolean" ? ok : no("bad request");
    case "suggest": {
      if (!lobbyOnly(state) || locked) return no("Suggestions are closed.");
      if (!isObj(t.resolved) || !cleanTitle(t.resolved.title)) return no("Couldn't find that article.");
      const title = cleanTitle(t.resolved.title);
      const list = suggestionsOf(state);
      if (isBanned(s, title)) return no("That page is banned.");
      if (list.some((x) => key(x.title) === key(title))) return no("Someone already suggested that.");
      if (list.filter((x) => x.by === playerId).length >= 2) return no("You can have 2 suggestions at a time.");
      if (list.length >= 12) return no("The suggestion list is full.");
      return ok;
    }
    case "useSuggestion": {
      if (!canHost(state, playerId)) return no("Only the host can pick pages.");
      if (!lobbyOnly(state) || locked) return no("Pages are locked.");
      if (action.which !== "start" && action.which !== "target") return no("bad page slot");
      return suggestionsOf(state).some((x) => x.id === action.id) ? ok : no("That suggestion is gone.");
    }
    case "dismissSuggestion": {
      const sg = suggestionsOf(state).find((x) => x.id === action.id);
      if (!sg) return no("That suggestion is gone.");
      return canHost(state, playerId) || sg.by === playerId ? ok : no("That isn't yours to remove.");
    }
    case "makeHost":
      if (!isHost(state, playerId)) return no("Only the host can do that.");
      return state.players[action.pid] ? ok : no("No such player.");
    case "claimHost": {
      const online = Array.isArray(t.connected) ? t.connected : [];
      if (isHost(state, playerId)) return no("You're already the host.");
      if (state.host && online.includes(state.host)) return no("The host is still here.");
      return ok;
    }
    default:
      return no(`unknown action: ${action.kind}`);
  }
}

// ── rounds ───────────────────────────────────────────────────────────────

function advanceTurn(u, t, at) {
  const online = Array.isArray(t.connected) ? t.connected : u.members;
  const n = u.members.length;
  const i = u.members.indexOf(u.turn);
  for (let k = 1; k <= n; k++) {
    const p = u.members[(i + k + n) % n];
    if (online.includes(p)) {
      u.turn = p;
      u.turnAt = at;
      return;
    }
  }
  u.turnAt = at;
}

function checkClickLimit(r, u, at) {
  const limit = r.rules.clickLimit;
  if (limit && u.status === "running" && u.clicks >= limit) {
    u.status = "out";
    u.reason = `Used all ${limit} clicks`;
    u.finishMs = at - r.startAt;
  }
}

function beginRound(state, at, t, starter, fresh) {
  const s = state.settings;
  if (fresh) state.match = newMatch();
  const m = state.match;
  let list = onlinePlayers(state, t);
  if (!list.includes(starter) && state.players[starter]) list.push(starter);
  if (s.mode === "elim") {
    if (fresh) m.roster = list.slice();
    list = list.filter((p) => m.roster.includes(p) && !m.out.includes(p));
  }
  const startAt = at + COUNTDOWN_MS;
  const first = s.start.title;
  const mk = (k, name, team, members) => ({
    key: k,
    name,
    team,
    members,
    stack: [first],
    path: [{ t: first, at: 0 }],
    clicks: 0,
    status: "running",
    finishMs: null,
    reason: null,
    turn: members[0],
    turnAt: startAt,
  });
  const units = {};
  const teamOf = {};
  const watch = {};
  const order = [];
  for (const p of list) watch[p] = { name: state.players[p].name, leaves: 0, awayMs: 0, away: false };
  if (s.mode === "teams") {
    const by = {};
    for (const p of list) {
      const tm = state.players[p].team;
      if (!by[tm]) by[tm] = [];
      by[tm].push(p);
    }
    for (const tm of Object.keys(by).sort()) {
      const k = "t" + tm;
      units[k] = mk(k, "Team " + ["Red", "Blue", "Green", "Gold"][Number(tm)], Number(tm), by[tm]);
      order.push(k);
      for (const p of by[tm]) teamOf[p] = k;
    }
  } else {
    for (const p of list) {
      units[p] = mk(p, state.players[p].name, null, [p]);
      teamOf[p] = p;
      order.push(p);
    }
  }
  state.suggestions = [];
  state.roundNo += 1;
  state.round = {
    n: state.roundNo,
    mode: s.mode,
    start: first,
    target: s.target.title,
    startAt,
    endAt: s.timeLimit ? startAt + s.timeLimit * 60000 : 0,
    rules: clone(s),
    units,
    order,
    watch,
    teamOf,
    winner: null,
    endReason: null,
    endedAt: null,
    points: {},
    out: [],
  };
  state.phase = "racing";
  return state;
}

function endRound(state, reason, at) {
  const r = state.round;
  const m = state.match;
  const mode = r.mode;
  const units = Object.values(r.units);
  state.phase = "over";
  r.endReason = reason;
  r.endedAt = at;
  for (const w of Object.values(r.watch)) w.away = false;
  for (const u of units) {
    if (u.status === "running") {
      u.status = "dnf";
      u.reason = reason === "time" ? "Out of time" : mode === "elim" ? "Last to finish" : "Didn't finish";
    }
  }
  const fin = units.filter((u) => u.status === "won");
  fin.sort(
    mode === "fewest"
      ? (a, b) => a.clicks - b.clicks || a.finishMs - b.finishMs
      : (a, b) => a.finishMs - b.finishMs,
  );
  const rest = units.filter((u) => u.status !== "won");
  rest.sort((a, b) => (STATUS_RANK[a.status] || 0) - (STATUS_RANK[b.status] || 0));
  r.order = fin.concat(rest).map((u) => u.key);
  r.winner = fin.length ? fin[0].key : null;

  r.points = {};
  if (mode === "race" || mode === "teams") {
    if (fin[0]) r.points[fin[0].key] = POINTS[0];
  } else if (mode === "fewest") {
    fin.slice(0, 3).forEach((u, i) => {
      r.points[u.key] = POINTS[i];
    });
  }
  for (const u of units) {
    m.labels[u.key] = { name: u.name, team: u.team };
    if (!(u.key in m.scores)) m.scores[u.key] = 0;
  }
  for (const k of Object.keys(r.points)) m.scores[k] += r.points[k];
  m.played += 1;

  r.out = [];
  if (mode === "elim") {
    if (fin.length > 0) {
      for (const u of units) {
        if (u.status !== "won") {
          r.out.push(u.key);
          m.out.push(u.key);
        }
      }
    }
    const alive = m.roster.filter((p) => !m.out.includes(p));
    if (alive.length <= 1) {
      m.done = true;
      m.champs = alive;
    }
  } else if (m.played >= r.rules.rounds) {
    m.done = true;
    let best = 0;
    for (const k of Object.keys(m.scores)) if (m.scores[k] > best) best = m.scores[k];
    m.champs = best > 0 ? Object.keys(m.scores).filter((k) => m.scores[k] === best) : [];
  }
  return state;
}

function maybeEnd(state, at) {
  if (state.phase !== "racing") return state;
  const r = state.round;
  const running = Object.values(r.units).filter((u) => u.status === "running").length;
  if (r.mode === "elim") {
    if (running <= 1) endRound(state, "elim", at);
  } else if (running === 0) {
    endRound(state, r.mode === "fewest" ? "done" : "allOut", at);
  }
  return state;
}

// ── apply ────────────────────────────────────────────────────────────────

export function applyAction(state0, playerId, action) {
  const state = clone(state0);
  const s = state.settings;
  const t = tOf(action);
  const at = now(action);
  const r = state.round;

  switch (action.kind) {
    case "hello": {
      const name = cleanName(action.name);
      if (!state.players[playerId]) {
        const team = smallestTeam(state);
        state.order.push(playerId);
        state.players[playerId] = { name, team };
      } else {
        state.players[playerId].name = name;
      }
      // Shop looks: the avatar and the members' badge are display only.
      state.players[playerId].avatar = cleanAvatar(action.avatar);
      state.players[playerId].member = action.member === true;
      if (r) {
        if (r.watch[playerId]) r.watch[playerId].name = name;
        const k = r.teamOf[playerId];
        if (k && r.mode !== "teams") r.units[k].name = name;
      }
      if (!state.host || !state.players[state.host]) state.host = playerId;
      return state;
    }
    case "dailySetup":
      s.daily = t.date;
      s.start = { title: cleanTitle(t.route.start) };
      s.target = { title: cleanTitle(t.route.target) };
      s.routeHops = Number.isFinite(t.route.hops) ? t.route.hops : 0;
      s.routeLevel = typeof t.route.level === "string" ? t.route.level : null;
      s.mode = "race";
      s.rounds = 1;
      s.allowBack = false;
      s.allowFind = false;
      s.tabLeave = "flag";
      s.clickLimit = 0;
      s.timeLimit = 0;
      s.showPositions = true;
      s.allowNavboxes = true;
      s.banned = [];
      return state;
    case "settings": {
      const patch = Object.assign({}, action.patch);
      if (patch.banned) {
        const seen = new Set();
        patch.banned = patch.banned.map(cleanTitle).filter((b) => b && !seen.has(key(b)) && seen.add(key(b)));
      }
      Object.assign(s, patch);
      if (patch.mode !== undefined || patch.teamCount !== undefined) rebalance(state);
      return state;
    }
    case "setPage":
      s[action.which] = { title: cleanTitle(t.resolved.title) };
      s.routeHops = 0;
      return state;
    case "setRoute":
      s.start = { title: cleanTitle(t.route.start) };
      s.target = { title: cleanTitle(t.route.target) };
      s.routeHops = Number.isFinite(t.route.hops) ? t.route.hops : 0;
      return state;
    case "clearPage":
      s[action.which] = null;
      s.routeHops = 0;
      return state;
    case "swapPages": {
      const a = s.start;
      s.start = s.target;
      s.target = a;
      s.routeHops = 0;
      return state;
    }
    case "setTeam":
      state.players[typeof action.pid === "string" ? action.pid : playerId].team = action.team;
      return state;
    case "start":
      return beginRound(state, at, t, playerId, true);
    case "next": {
      if (action.route === "new") {
        s.start = { title: cleanTitle(t.route.start) };
        s.target = { title: cleanTitle(t.route.target) };
        s.routeHops = Number.isFinite(t.route.hops) ? t.route.hops : 0;
      }
      return beginRound(state, at, t, playerId, state.match.done);
    }
    case "move": {
      const u = unitOf(state, playerId);
      const to = cleanTitle(t.canon);
      u.stack.push(to);
      u.path.push({ t: to, at: at - r.startAt });
      u.clicks += 1;
      if (key(to) === key(r.target)) {
        u.status = "won";
        u.finishMs = at - r.startAt;
        if (r.mode === "race" || r.mode === "teams") return endRound(state, "won", at);
      } else {
        checkClickLimit(r, u, at);
      }
      if (r.mode === "teams" && u.status === "running") advanceTurn(u, t, at);
      return maybeEnd(state, at);
    }
    case "back": {
      const u = unitOf(state, playerId);
      u.stack.pop();
      u.path.push({ t: current(u), at: at - r.startAt, back: true });
      u.clicks += 1;
      checkClickLimit(r, u, at);
      if (r.mode === "teams" && u.status === "running") advanceTurn(u, t, at);
      return maybeEnd(state, at);
    }
    case "pass":
      advanceTurn(unitOf(state, playerId), t, at);
      return state;
    case "left": {
      const w = r.watch[playerId];
      const u = unitOf(state, playerId);
      if (!w || r.rules.tabLeave === "off" || at < r.startAt) return state;
      if (action.phase === "start") {
        if (!w.away) {
          w.away = true;
          w.leaves += 1;
          if (r.rules.tabLeave === "dq" && r.mode !== "teams") {
            u.status = "dq";
            u.reason = "Left the game tab";
            u.finishMs = at - r.startAt;
          }
        }
      } else {
        w.away = false;
        const ms = Number(action.ms);
        if (Number.isFinite(ms) && ms > 0) w.awayMs += Math.min(Math.round(ms), 3600000);
      }
      return maybeEnd(state, at);
    }
    case "forfeit": {
      const u = unitOf(state, playerId);
      u.status = "out";
      u.reason = "Gave up";
      u.finishMs = at - r.startAt;
      return maybeEnd(state, at);
    }
    case "endRound":
      return endRound(state, "host", at);
    case "lobby":
      state.phase = "lobby";
      state.match = newMatch();
      return state;
    case "kick": {
      const p = action.pid;
      state.order = state.order.filter((x) => x !== p);
      delete state.players[p];
      state.cohosts = cohostsOf(state).filter((x) => x !== p);
      state.suggestions = suggestionsOf(state).filter((x) => x.by !== p);
      if (!state.kicked.includes(p)) state.kicked.push(p);
      state.match.roster = state.match.roster.filter((x) => x !== p);
      if (r && state.phase === "racing") {
        const u = unitOf(state, p);
        if (u && u.status === "running") {
          u.members = u.members.filter((x) => x !== p);
          if (u.members.length === 0) {
            u.status = "out";
            u.reason = "Removed by host";
          } else if (u.turn === p) {
            u.turn = u.members[0];
            advanceTurn(u, t, at);
          }
        }
        return maybeEnd(state, at);
      }
      return state;
    }
    case "makeHost": {
      const old = state.host;
      state.host = action.pid;
      const list = cohostsOf(state).filter((p) => p !== action.pid);
      if (old && old !== action.pid && state.players[old]) list.push(old);
      state.cohosts = list;
      return state;
    }
    case "claimHost":
      state.host = playerId;
      state.cohosts = cohostsOf(state).filter((p) => p !== playerId);
      return state;
    case "setCohost": {
      const list = cohostsOf(state).filter((p) => p !== action.pid);
      if (action.on) list.push(action.pid);
      state.cohosts = list;
      return state;
    }
    case "suggest":
      state.sugSeq = (state.sugSeq || 0) + 1;
      state.suggestions = suggestionsOf(state).concat([{ id: state.sugSeq, by: playerId, name: state.players[playerId].name, title: cleanTitle(t.resolved.title) }]);
      return state;
    case "useSuggestion": {
      const sg = suggestionsOf(state).find((x) => x.id === action.id);
      s[action.which] = { title: sg.title };
      s.routeHops = 0;
      state.suggestions = suggestionsOf(state).filter((x) => x.id !== action.id);
      return state;
    }
    case "dismissSuggestion":
      state.suggestions = suggestionsOf(state).filter((x) => x.id !== action.id);
      return state;
    case "tick":
      if (state.phase === "racing" && r.endAt && at >= r.endAt) endRound(state, "time", at);
      return state;
  }
  return state;
}

export function isGameOver(state) {
  if (state.phase !== "over" || !state.match.done) return { over: false };
  return { over: true, winner: state.match.champs.length ? state.match.champs[0] : null };
}

// ── view ─────────────────────────────────────────────────────────────────

export function viewFor(state, playerId) {
  const r = state.round;
  const m = state.match;
  let round = null;
  let myKey = null;
  if (r) {
    myKey = r.teamOf[playerId] || null;
    const hide = state.phase === "racing" && !r.rules.showPositions;
    const units = {};
    for (const [k, u] of Object.entries(r.units)) {
      const names = u.members.map((p) => (r.watch[p] ? r.watch[p].name : "Player"));
      if (hide && k !== myKey) {
        units[k] = {
          key: k,
          name: u.name,
          team: u.team,
          members: u.members,
          names,
          status: u.status,
          clicks: u.clicks,
          finishMs: u.finishMs,
          reason: u.reason,
          hidden: true,
        };
      } else {
        units[k] = Object.assign({}, u, { names });
      }
    }
    round = Object.assign({}, r, { units });
  }
  const scores = Object.keys(m.scores)
    .map((k) => ({
      key: k,
      name: m.labels[k] ? m.labels[k].name : k,
      team: m.labels[k] ? m.labels[k].team : null,
      pts: m.scores[k],
    }))
    .sort((a, b) => b.pts - a.pts);
  const isPlayer = Boolean(state.players[playerId]);
  return {
    phase: state.phase,
    host: state.host,
    you: playerId,
    joined: isPlayer,
    kicked: state.kicked.includes(playerId),
    players: state.order.map((p) => ({
      id: p,
      name: state.players[p].name,
      team: state.players[p].team,
      avatar: state.players[p].avatar || null,
      member: Boolean(state.players[p].member),
      out: m.out.includes(p),
    })),
    cohosts: cohostsOf(state),
    suggestions: suggestionsOf(state),
    settings: state.settings,
    match: {
      scores,
      played: m.played,
      rounds: state.settings.rounds,
      done: m.done,
      champs: m.champs,
      out: m.out,
      roster: m.roster,
    },
    myKey,
    round,
  };
}
