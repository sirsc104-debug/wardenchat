// How a game runs inside the artifact. There's no server, so one page is in charge:
//
//   solo   The rules run in this page and nothing is shared. Solo races and the
//          daily challenge.
//   host   The rules run in this page. Each change is written to the shared store
//          (parties/<CODE>) for everyone, and other players' moves arrive through
//          their presence in the party's room.
//   guest  Moves go out through this page's presence in the room, queued until
//          the host acknowledges them. The game is drawn from the shared store.
//
// If the host leaves, the first player still here takes over from the shared copy.

import * as logic from "./logic.js";
import { createEngine } from "./engine.js";
import { partyKit } from "./caps.js";
import { openWardenParty } from "./wc/party.js";
import { errText } from "./wc/account.js";
import { dailyRoute } from "./wiki.js";

const SAY_TEXT = {
  e0: "👍", e1: "😂", e2: "🔥", e3: "😮", e4: "😭", e5: "👏",
  p0: "Nice one", p1: "So close", p2: "GG", p3: "Too easy", p4: "Help", p5: "Oops", p6: "Rematch?", p7: "Wow",
};
const HOST_GONE_MS = 8000;

export function playerId() {
  const k = "wd:pid";
  let id = null;
  try {
    id = sessionStorage.getItem(k);
  } catch {
    /* storage blocked */
  }
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(9));
    id = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
    try {
      sessionStorage.setItem(k, id);
    } catch {
      /* fine, one page load */
    }
  }
  return id;
}

let S = null; // the running session

export const isOnline = () => Boolean(S && S.online);
export const mode = () => (S ? S.mode : null);
/** The running party: { code, partyId, warden } (partyId only on Warden Chat). */
export const partyInfo = () => (S && S.info) || null;

/** Send a game action. Returns false when it couldn't be sent. */
export function act(action) {
  if (!S) return false;
  return S.act(action);
}

export function leave() {
  if (!S) return;
  S.stop();
  S = null;
}

function emitState(h, state, connected, offset) {
  h.onState({ view: logic.viewFor(state, h.me), connected, serverNow: Date.now() + offset });
}

// ── solo ─────────────────────────────────────────────────────────────────

/** A race in this page only. opts.daily sets up today's challenge. */
export async function startSolo(hello, h, opts = {}) {
  const name = hello().name;
  leave();
  const me = playerId();
  h.me = me;
  const engine = createEngine({
    connected: () => [me],
    onCommit: (st) => emitState(h, st, [me], 0),
    onError: (_pid, msg) => h.onError(msg),
    onFinish: (st, prev) => h.onFinish?.(st, prev),
  });
  const timer = setInterval(() => engine.tick(), 250);
  S = {
    mode: "solo",
    online: true,
    act(a) {
      if (a.kind === "hello") a = { ...hello(), ...a };
      if (a.kind === "say") {
        const text = SAY_TEXT[a.id];
        if (text) h.onSay?.({ pid: me, name: engine.state.players[me]?.name || name, id: a.id, text });
        return true;
      }
      engine.handle(me, a);
      return true;
    },
    stop() {
      clearInterval(timer);
    },
  };
  h.onConn("solo");
  await engine.handle(me, { kind: "hello", ...hello() });
  if (opts.daily) {
    const route = await dailyRoute();
    if (!route) {
      h.onError("Today's challenge couldn't be built. Try again.");
      return;
    }
    await engine.system({ kind: "dailySetup", _t: { date: route.date, route } });
    return;
  }
  // A quick race: pick a route of that difficulty and go.
  if (opts.quick) {
    await engine.handle(me, { kind: "settings", patch: { difficulty: opts.quick } });
    await engine.handle(me, { kind: "randomRoute" });
    await engine.handle(me, { kind: "start" });
  }
}

// ── party ────────────────────────────────────────────────────────────────

/**
 * Join party `code`, or create it. Resolves an error message on failure, or "".
 * h.onState, h.onError, h.onConn, h.onSay as in startSolo.
 */
export async function startParty(code, hello, h, { create = false, warden = false } = {}) {
  leave();
  const nameFn = () => hello().name;
  let room = null;
  let party;
  let ref;
  let me;
  let partyId = null;
  if (warden) {
    // On Warden Chat: the server keeps the party, and players are their accounts.
    try {
      const link = await openWardenParty(code, create);
      ({ party, ref, me, partyId, code } = link);
    } catch (e) {
      return { error: errText(e) };
    }
  } else {
    const kit = await partyKit();
    if (!kit.ok) return { error: "Parties on this page need you to be signed in to Claude with access to this artifact. You can still race solo, or sign in with Warden Chat." };
    room = kit.room;
    me = playerId();
    ref = kit.db.doc(`parties/${code}`);
    try {
      party = await room.join(`wd-${code.toLowerCase()}`);
    } catch (e) {
      return { error: e?.code === "not_permitted" ? "Your access to this artifact doesn't include parties." : "Couldn't open the party room. Try again." };
    }
  }
  h.me = me;

  const st = {
    mode: "guest",
    online: false,
    hostPid: null,
    engine: null,
    doc: null, // latest shared copy
    acks: {}, // host: pid -> {n, err}
    seen: {}, // host: pid -> last applied n
    seq: 0, // guest: my last queued action number
    queue: [], // guest: [n, action] not yet acknowledged
    shownErr: 0,
    offsets: [],
    offset: 0,
    sayN: 0,
    lastSay: {},
    hostSeenAt: Date.now(),
    writing: false,
    dirty: false,
    stopped: false,
    myPeer: "",
    lastConnSig: "",
    unsub: [],
    pubSig: "",
  };

  const connected = () => {
    const ids = new Set([me]);
    for (const p of party.peers()) if (typeof p.presence?.pid === "string") ids.add(p.presence.pid);
    return [...ids];
  };

  // ── host side ──

  async function flush() {
    if (st.writing || st.stopped) return;
    st.writing = true;
    try {
      while (st.dirty && !st.stopped) {
        st.dirty = false;
        const body = { state: st.engine.state, clock: Date.now(), acks: st.acks, connected: connected(), host: me, v: 1 };
        try {
          await ref.set(body);
        } catch (e) {
          h.onError(e?.code === "invalid_argument" ? "The game got too big to share. Start a new party." : "Couldn't save the game for the others. Check your access to this artifact.");
          break;
        }
        await new Promise((r) => setTimeout(r, 60));
      }
    } finally {
      st.writing = false;
    }
  }
  const save = () => {
    st.dirty = true;
    flush();
  };

  function publicListing(state) {
    const s = state.settings;
    const online = connected();
    const listed = s.visibility === "public" && state.phase === "lobby" && !s.daily;
    const entry = listed
      ? { code, host: state.players[state.host]?.name || "Host", players: state.order.filter((p) => online.includes(p)).length, mode: s.mode, rounds: s.rounds }
      : null;
    const sig = JSON.stringify(entry);
    if (sig !== st.pubSig && room) {
      st.pubSig = sig;
      room.presence({ pub: entry }).catch(() => {});
    }
  }

  let pendingErr = null;
  function becomeHost(state) {
    st.mode = "host";
    st.hostSince = Date.now();
    st.engine = createEngine({
      state,
      connected,
      onCommit: (s) => {
        emitState(h, s, connected(), 0);
        publicListing(s);
        save();
      },
      onError: (pid, msg) => {
        if (pid === me) h.onError(msg);
        else pendingErr = msg;
      },
    });
    st.acks = { ...(st.doc?.acks || {}) };
    for (const [pid, a] of Object.entries(st.acks)) st.seen[pid] = a.n || 0;
    // Anything I queued as a guest is mine to apply now.
    const mine = st.queue;
    st.queue = [];
    party.presence({ q: [] }).catch(() => {});
    for (const [, a] of mine) st.engine.handle(me, a);
    st.tick = setInterval(() => st.engine.tick(), 250);
    emitState(h, st.engine.state, connected(), 0);
    publicListing(st.engine.state);
  }

  async function pullMoves() {
    if (st.mode !== "host") return;
    for (const p of party.peers()) {
      if (p.sameTab) continue;
      const pr = p.presence || {};
      const pid = typeof pr.pid === "string" ? pr.pid : null;
      if (!pid || pid === me || !Array.isArray(pr.q)) continue;
      for (const item of pr.q) {
        if (!Array.isArray(item) || !Number.isInteger(item[0])) continue;
        const [n, a] = item;
        if (n <= (st.seen[pid] || 0)) continue;
        st.seen[pid] = n;
        pendingErr = null;
        await st.engine.handle(pid, a);
        st.acks[pid] = pendingErr ? { n, err: pendingErr } : { n };
        save();
      }
    }
  }
  let pulling = Promise.resolve();
  const queuePull = () => (pulling = pulling.then(pullMoves).catch(() => {}));

  // ── guest side ──

  function readDoc(snap) {
    if (!snap.exists) {
      st.doc = null;
      return;
    }
    const d = snap.data();
    if (!d || !d.state || d.state.v !== 2) return;
    st.doc = d;
    if (!snap.metadata.fromCache && Number.isFinite(d.clock)) {
      st.offsets.push(d.clock - Date.now());
      if (st.offsets.length > 12) st.offsets.shift();
      st.offset = Math.max(...st.offsets);
    }
    const state = d.state;
    if (st.mode === "host") {
      // Someone else took over (both of us thought the host was gone): theirs wins.
      // Copies written before this page took charge are stale and ignored.
      const writtenAt = Number(d.clock) - st.offset;
      if (state.host !== me && d.host !== me && writtenAt > st.hostSince) stepDown();
      return;
    }
    if (state.host === me) {
      becomeHost(state);
      return;
    }
    const ack = (d.acks || {})[me];
    if (ack) {
      if (ack.err && ack.n > st.shownErr) {
        st.shownErr = ack.n;
        h.onError(ack.err);
      }
      const before = st.queue.length;
      st.queue = st.queue.filter(([n]) => n > ack.n);
      if (st.queue.length !== before) party.presence({ q: st.queue }).catch(() => {});
      st.seq = Math.max(st.seq, ack.n);
    }
    emitState(h, state, Array.isArray(d.connected) ? d.connected : connected(), st.offset);
  }

  function stepDown() {
    clearInterval(st.tick);
    st.mode = "guest";
    st.engine = null;
    if (st.doc) emitState(h, st.doc.state, st.doc.connected || connected(), st.offset);
  }

  function guestSend(a) {
    st.seq += 1;
    st.queue.push([st.seq, a]);
    if (st.queue.length > 12) st.queue = st.queue.slice(-12);
    party.presence({ q: st.queue }).catch(() => h.onError("Couldn't send that. Try again."));
    return true;
  }

  // The host is gone: the first player still here (co-hosts first) takes over.
  function watchHost() {
    if (st.mode !== "guest" || !st.doc) return;
    const state = st.doc.state;
    const here = connected();
    if (here.includes(state.host)) {
      st.hostSeenAt = Date.now();
      return;
    }
    if (Date.now() - st.hostSeenAt < HOST_GONE_MS || !state.players[me]) return;
    const order = [...(state.cohosts || []), ...state.order];
    const next = order.find((p) => p !== state.host && here.includes(p) && state.players[p]);
    if (next === me) claim();
  }

  function claim() {
    if (st.mode === "host" || !st.doc) return;
    const state = st.doc.state;
    becomeHost(state);
    if (state.host !== me) st.engine.handle(me, { kind: "claimHost" });
    else save();
  }

  // ── reactions ──

  function readSays(peers) {
    for (const p of peers) {
      const s = p.presence?.say;
      if (!Array.isArray(s) || typeof s[0] !== "number") continue;
      const k = p.peer;
      if (st.lastSay[k] === undefined) {
        st.lastSay[k] = s[0];
        if (!p.sameTab) continue;
      }
      if (s[0] === st.lastSay[k]) continue;
      st.lastSay[k] = s[0];
      const text = SAY_TEXT[s[1]];
      if (text) h.onSay?.({ pid: String(p.presence.pid || p.peer), name: String(s[2] || "Player").slice(0, 20), id: s[1], text });
    }
  }

  // ── wiring ──

  st.unsub.push(
    party.onConnection(
      (on) => {
        st.online = on;
        h.onConn(on ? "online" : "offline");
      },
      () => h.onConn("offline"),
    ),
  );
  st.unsub.push(
    party.onPeers((change) => {
      readSays(change.peers);
      if (st.mode === "host") {
        queuePull();
        const sig = connected().sort().join(",");
        if (sig !== st.lastConnSig) {
          st.lastConnSig = sig;
          emitState(h, st.engine.state, connected(), 0);
          publicListing(st.engine.state);
          save();
        }
      } else {
        watchHost();
        if (st.doc) emitState(h, st.doc.state, connected(), st.offset);
      }
    }),
  );

  let first = true;
  let gotDoc = false;
  const firstSnap = new Promise((resolve) => {
    st.unsub.push(
      ref.onSnapshot(
        (snap) => {
          if (snap.metadata.fromCache && !snap.exists) return;
          gotDoc = true;
          readDoc(snap);
          if (first) {
            first = false;
            resolve();
          }
        },
        () => {
          if (first) {
            first = false;
            resolve();
          }
        },
      ),
    );
    setTimeout(() => {
      if (first) {
        first = false;
        resolve();
      }
    }, 10000);
  });

  const hostTimer = setInterval(watchHost, 1000);
  await party.presence({ pid: me, name: nameFn(), q: [], say: null }).catch(() => {});

  S = {
    mode: "party",
    info: { code, partyId, warden },
    get online() {
      return st.online;
    },
    act(a) {
      if (a.kind === "say") {
        st.sayN += 1;
        party.presence({ say: [st.sayN, a.id, nameFn()] }).catch(() => {});
        return true;
      }
      if (a.kind === "hello") party.presence({ name: a.name }).catch(() => {});
      if (a.kind === "hello") a = { ...hello(), ...a };
      if (st.mode === "host") {
        st.engine.handle(me, a);
        return true;
      }
      if (a.kind === "claimHost") {
        claim();
        return true;
      }
      return guestSend(a);
    },
    stop() {
      st.stopped = true;
      clearInterval(st.tick);
      clearInterval(hostTimer);
      for (const u of st.unsub) {
        try {
          u();
        } catch {
          /* already gone */
        }
      }
      if (room) room.presence({ pub: null }).catch(() => {});
      party.leave().catch(() => {});
    },
  };

  await firstSnap;
  if (S.mode !== "party" || st.stopped) return { code };
  if (!gotDoc || !st.doc) {
    if (!create) {
      // Give a just-created party a moment to appear.
      await new Promise((r) => setTimeout(r, 2500));
      if (!st.doc) {
        leave();
        return { error: `There's no party with code ${code}. Check the code, or start your own.` };
      }
    } else {
      const fresh = logic.setup([]);
      try {
        await ref.set({ state: fresh, clock: Date.now(), acks: {}, connected: [me], host: me, v: 1 });
      } catch {
        leave();
        return { error: warden ? "Couldn't save the party on Warden Chat. Try again." : "You can't start a party with view-only access. Ask the owner of this artifact for Contributor access, or race solo." };
      }
      if (st.mode !== "host") becomeHost(fresh);
    }
  }
  S.act({ kind: "hello", ...hello() });
  return { code };
}

// ── public parties, from the lobby everyone shares ───────────────────────

/** Calls fn(list) whenever the public parties change. Returns a stop function, or null without a room. */
export async function watchPublic(fn) {
  const kit = await partyKit();
  if (!kit.ok) return null;
  const read = (peers) => {
    const seen = new Map();
    for (const p of peers) {
      const e = p.presence?.pub;
      if (!e || typeof e.code !== "string" || !/^[A-Z0-9]{4,12}$/.test(e.code)) continue;
      seen.set(e.code, {
        room: e.code,
        host: String(e.host || "Host").slice(0, 20),
        players: Math.max(0, Math.min(24, Number(e.players) || 0)),
        max: logic.meta.maxPlayers,
        mode: ["race", "fewest", "teams", "elim"].includes(e.mode) ? e.mode : "race",
        rounds: Number(e.rounds) || 1,
      });
    }
    fn([...seen.values()]);
  };
  const stop = kit.room.onPeers((c) => read(c.peers), () => fn(null));
  read(kit.room.peers());
  return stop;
}
