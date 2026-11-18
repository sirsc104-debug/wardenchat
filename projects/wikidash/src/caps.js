// Artifact runtime capabilities. Each resolves to its namespace or null, and the
// page works without any of them: solo races need nothing, parties need the
// room and the shared store, the daily leaderboard needs the store and an id.

const cache = new Map();

export function cap(name) {
  if (!cache.has(name)) {
    let p;
    try {
      p = window.claude && typeof window.claude.use === "function" ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
    } catch {
      p = Promise.resolve(null);
    }
    cache.set(name, p);
  }
  return cache.get(name);
}

let me = null;
/** This viewer's id on the shared store, or null. */
export function userId() {
  if (!me) me = cap("user").then((u) => (u ? u.id().catch(() => null) : null));
  return me;
}

/** Everything a party needs, or null with the reason. */
export async function partyKit() {
  const [room, db] = await Promise.all([cap("room"), cap("db")]);
  if (!room || !db) return { ok: false, room, db };
  return { ok: true, room, db };
}
