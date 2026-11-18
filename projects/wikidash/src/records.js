import * as store from "./store.js";

// Personal records, kept in this browser: fastest time and fewest clicks per route.

const key = (start, target) => `wd:pr:${start.toLowerCase()}|${target.toLowerCase()}`;

export function getBest(start, target) {
  try {
    return JSON.parse(store.get(key(start, target)) || "null");
  } catch {
    return null;
  }
}

/** Save a finished run. Returns what improved. */
export function recordRun(start, target, ms, clicks) {
  const old = getBest(start, target);
  const best = {
    ms: old ? Math.min(old.ms, ms) : ms,
    clicks: old ? Math.min(old.clicks, clicks) : clicks,
  };
  try {
    store.set(key(start, target), JSON.stringify(best));
  } catch {
    /* ignore */
  }
  return { best, first: !old, newTime: !old || ms < old.ms, newClicks: !old || clicks < old.clicks };
}
