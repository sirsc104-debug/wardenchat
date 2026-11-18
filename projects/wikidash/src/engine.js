// The trusted half of a party, run in the host's page. It does what the
// Cloudflare room did: stamps each action with the clock, the players who are
// here and any page lookups, then hands it to logic.js to validate and apply.
// Page lookups and click checks use the bundled link graph, so every move is
// checked against the same links the players see.

import * as logic from "./logic.js";
import { canonical, randomArticle, randomRoute, verifyLink } from "./wiki.js";

export const SYSTEM = "__system";

/** Everything a player may ask for. `_t` is never accepted from a player. */
const CLIENT_KINDS = new Set([
  "hello", "settings", "setPage", "randomPage", "randomRoute", "clearPage", "swapPages",
  "setTeam", "setCohost", "suggest", "useSuggestion", "dismissSuggestion", "start", "next", "move", "back", "pass", "left", "forfeit", "endRound", "lobby",
  "kick", "makeHost", "claimHost",
]);

const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const canHost = (s, pid) => s.host === pid || (s.cohosts || []).includes(pid);

/**
 * opts.state      starting state (a fresh setup when absent)
 * opts.connected  () => player ids here right now
 * opts.onCommit   (state) => void, after every change
 * opts.onError    (pid, message) => void
 * opts.onFinish   (state, prev) => void, after a round ends
 */
export function createEngine(opts) {
  let state = opts.state && opts.state.v === 2 ? opts.state : logic.setup([]);
  let chain = Promise.resolve();

  const fail = (pid, msg) => opts.onError?.(pid, msg);

  function commit(pid, action) {
    let cur = state;
    const now = Date.now();
    // A move that arrives after the time limit loses to the clock.
    if (cur.phase === "racing" && cur.round?.endAt && now >= cur.round.endAt) {
      cur = logic.applyAction(cur, SYSTEM, { kind: "tick", _t: { now } });
      if (pid === SYSTEM) action = { kind: "tick", _t: { now } };
    }
    const verdict = logic.validateAction(cur, pid, action);
    if (!verdict.ok) {
      if (cur !== state) {
        const prev = state;
        state = cur;
        opts.onCommit(state);
        if (prev.phase === "racing" && state.phase === "over") opts.onFinish?.(state, prev);
      }
      if (pid !== SYSTEM) fail(pid, verdict.error || "Not allowed.");
      return false;
    }
    const prev = cur;
    state = logic.applyAction(cur, pid, action);
    opts.onCommit(state);
    if (prev.phase === "racing" && state.phase === "over") opts.onFinish?.(state, prev);
    return true;
  }

  async function prepare(pid, a) {
    if (!isRecord(a) || typeof a.kind !== "string" || !CLIENT_KINDS.has(a.kind)) return fail(pid, "unknown action");
    const action = { ...a };
    delete action._t;
    const t = { now: Date.now(), connected: opts.connected() };
    const pre = state;

    if (a.kind === "setPage" || a.kind === "randomPage") {
      if (!canHost(pre, pid)) return fail(pid, "Only the host can pick pages.");
      if (pre.phase !== "lobby") return fail(pid, "Pages are locked during a match.");
      let title = null;
      if (a.kind === "randomPage") {
        const r = randomArticle();
        if (!r.ok) return fail(pid, r.error);
        title = r.title;
      } else {
        title = await canonical(String(a.title ?? ""));
        if (!title) return fail(pid, `"${String(a.title ?? "").slice(0, 60)}" isn't in this edition. Pick one from the search list.`);
      }
      action.kind = "setPage";
      delete action.title;
      t.resolved = { title };
    }

    if (a.kind === "suggest") {
      if (!pre.players[pid]) return fail(pid, "Join the party first.");
      if (pre.phase !== "lobby") return fail(pid, "Suggestions are closed.");
      const title = await canonical(String(a.title ?? ""));
      if (!title) return fail(pid, `"${String(a.title ?? "").slice(0, 60)}" isn't in this edition.`);
      delete action.title;
      t.resolved = { title };
    }

    if (a.kind === "randomRoute" || (a.kind === "next" && a.route === "new")) {
      if (!canHost(pre, pid)) return fail(pid, "Only the host can do that.");
      if (pre.settings.daily) return fail(pid, "The daily route is fixed.");
      if (a.kind === "randomRoute" && pre.phase !== "lobby") return fail(pid, "Pages are locked during a match.");
      if (a.kind === "next" && pre.phase !== "over") return fail(pid, "The round isn't over yet.");
      const made = randomRoute(pre.settings.difficulty, pre.settings.banned || []);
      if (!made.ok) return fail(pid, made.error);
      t.route = { start: made.start, target: made.target, hops: made.hops };
      if (a.kind === "randomRoute") action.kind = "setRoute";
    }

    if (a.kind === "move") {
      const key = pre.round?.teamOf?.[pid];
      const unit = key ? pre.round.units[key] : null;
      if (pre.phase !== "racing" || !unit || unit.status !== "running") return fail(pid, "You're not racing.");
      if (t.now < pre.round.startAt) return fail(pid, "Wait for the countdown.");
      if (pre.round.mode === "teams" && unit.turn !== pid) return fail(pid, "It's not your turn.");
      const from = unit.stack[unit.stack.length - 1];
      const check = verifyLink(from, String(a.to ?? ""), pre.round.rules.allowNavboxes);
      t.from = from;
      t.verified = check.ok;
      t.canon = check.canon;
      t.reason = check.reason;
    }

    action._t = t;
    commit(pid, action);
  }

  return {
    get state() {
      return state;
    },
    /** Replace the state, e.g. when taking over as host from the shared copy. */
    load(s) {
      if (s && s.v === 2) state = s;
    },
    /** Player actions run one at a time, in arrival order. */
    handle(pid, action) {
      chain = chain.then(() => prepare(pid, action)).catch((err) => {
        console.error("action failed", err);
        fail(pid, "Something went wrong. Try again.");
      });
      return chain;
    },
    /** Actions only the host's page may make (the daily route, the clock). */
    system(action) {
      chain = chain.then(() => commit(SYSTEM, { ...action, _t: { now: Date.now(), ...(action._t || {}) } }));
      return chain;
    },
    /** Ends a timed round once the clock runs out. Call a few times a second. */
    tick() {
      const r = state.round;
      if (state.phase === "racing" && r?.endAt && Date.now() >= r.endAt) this.system({ kind: "tick" });
    },
  };
}
