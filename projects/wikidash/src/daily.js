// The daily challenge: one shared route per day, scored by fewest clicks.
// The route comes from a seed, so everyone gets the same one without a server.
// The leaderboard is one shared document per player (lb/<their id>) holding
// their best run of the day. Without the shared store it shows your own best.

import { h, icon, fmtTime } from "./ui.js";
import { cap, userId } from "./caps.js";
import { dailyRoute } from "./wiki.js";
import * as store from "./store.js";

const localKey = (date) => `wd:daily:${date}`;

function better(a, b) {
  return !b || a.clicks < b.clicks || (a.clicks === b.clicks && a.ms < b.ms);
}

export async function fetchDaily() {
  const route = await dailyRoute();
  if (!route) throw new Error("Today's challenge couldn't be built.");
  const mineLocal = store.getJSON(localKey(route.date));
  const [db, uid] = await Promise.all([cap("db"), userId()]);
  let rows = [];
  let shared = false;
  if (db) {
    try {
      const snap = await db.collection("lb").where("date", "==", route.date).limit(500).get();
      rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => Number.isFinite(e.clicks) && Number.isFinite(e.ms));
      shared = true;
    } catch {
      rows = [];
    }
  }
  if (!shared && mineLocal) rows = [{ id: "me", ...mineLocal }];
  rows.sort((a, b) => a.clicks - b.clicks || a.ms - b.ms);
  const meId = shared ? uid : "me";
  const idx = rows.findIndex((e) => e.id === meId);
  return {
    ...route,
    shared,
    total: rows.length,
    top: rows.slice(0, 20).map((e, i) => ({ rank: i + 1, name: String(e.name || "Player").slice(0, 20), clicks: e.clicks, ms: e.ms, leaves: e.leaves || 0, you: i === idx })),
    you: idx >= 0 ? { rank: idx + 1, clicks: rows[idx].clicks, ms: rows[idx].ms } : null,
  };
}

/** Save a finished daily run: your best here, and on the shared board when there is one. */
export async function submitDaily(date, entry) {
  const run = { date, name: entry.name, clicks: entry.clicks, ms: Math.round(entry.ms), leaves: entry.leaves || 0 };
  const old = store.getJSON(localKey(date));
  if (better(run, old)) store.setJSON(localKey(date), run);
  const [db, uid] = await Promise.all([cap("db"), userId()]);
  if (!db || !uid) return;
  try {
    const ref = db.doc(`lb/${uid}`);
    const cur = await ref.get();
    const prev = cur.exists ? cur.data() : null;
    if (prev && prev.date === date && !better(run, prev)) {
      if (prev.name !== run.name) await ref.set({ ...prev, name: run.name });
      return;
    }
    await ref.set({ ...run, at: Date.now() });
  } catch {
    /* view-only access: the run stays in this browser */
  }
}

export function dateLabel(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function boardList(top, limit = 5) {
  const rows = top.slice(0, limit).map((e) =>
    h(
      "li",
      { class: `lb-row${e.you ? " you" : ""}` },
      h("span", { class: "lb-rank" }, String(e.rank)),
      h("span", { class: "lb-name" }, e.name, e.you ? h("span", { class: "tag" }, "you") : null, e.leaves ? h("span", { class: "flag-pill", title: `Left the tab ${e.leaves}x` }, icon("door", 12), `${e.leaves}x`) : null),
      h("span", { class: "lb-clicks" }, `${e.clicks} click${e.clicks === 1 ? "" : "s"}`),
      h("span", { class: "lb-time" }, fmtTime(e.ms)),
    ),
  );
  return h("ol", { class: "lb-list" }, rows.length ? rows : h("li", { class: "lb-empty" }, "No finishes yet today. Be the first."));
}

const LEVEL_TEXT = { easy: "Easy day", medium: "Medium day", hard: "Hard day" };

/** A small tag saying how hard today's route is. */
export function levelPill(level) {
  if (!LEVEL_TEXT[level]) return null;
  return h("span", { class: `lvl lvl-${level}` }, LEVEL_TEXT[level]);
}
