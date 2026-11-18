import { h, clear, toast, setAvatarLookup } from "./ui.js";
import * as net from "./net.js";
import * as guard from "./guard.js";
import * as wiki from "./wiki.js";
import * as store from "./store.js";
import { setHome } from "./shell.js";
import { initTheme } from "./theme.js";
import { mountReactions, showSay, unmountReactions } from "./react.js";
import { submitDaily } from "./daily.js";
import { mountLobby, updateLobby, lobbyError } from "./lobby.js";
import { mountRace, updateRace, raceError, unmountRace, raceBack } from "./race.js";
import { mountHome, unmountHome, refreshHome, recordSolo } from "./home.js";
import { askText } from "./dialog.js";
import { partyKit } from "./caps.js";
import { Account, errText } from "./wc/account.js";
import { Wallet, installBadgeDefs, BADGE_SVG } from "./wc/wallet.js";
import { Friends } from "./wc/friends.js";
import { COSMETICS } from "./wc/catalog.js";
import * as Look from "./look.js";
import { openSignIn, openAccount, openRestricted, sheet, closeSheet } from "./acct.js";
import { openShop, closeShop } from "./shop.js";
import { routeFacts } from "./reward.js";

initTheme();
installBadgeDefs();

const app = document.getElementById("app");
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const cleanCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const cleanName = (n) => String(n || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);

const S = {
  code: cleanCode(location.hash.slice(1)),
  name: cleanName(store.get("wd:name", "")),
  kind: null, // "solo" | "daily" | "party"
  quick: null, // the difficulty of a one-click solo race
  view: null,
  connected: [],
  offset: 0,
  conn: "connecting",
  screen: null,
  started: false,
};

/** The name you race under: your Warden Chat username when signed in. */
const raceName = () => (Account.status === "signedIn" ? Account.user.username.slice(0, 20) : S.name);
/** What every page learns about you when you join: name, Shop avatar, members' badge. */
const hello = () => {
  const look = Look.current();
  return { name: raceName() || "Player", avatar: look.avatar !== "reader" ? look.avatar : null, member: Wallet.member };
};

const ctx = {
  S,
  act: net.act,
  now: () => Date.now() + S.offset,
  /** The host or a co-host: can run the party. */
  isHost: () => Boolean(S.view && S.view.joined && (S.view.host === S.view.you || (S.view.cohosts || []).includes(S.view.you))),
  /** The host only: can hand over the host role and choose co-hosts. */
  isOwner: () => Boolean(S.view && S.view.joined && S.view.host === S.view.you),
  online: (pid) => S.connected.includes(pid),
  setName(n) {
    if (Account.status === "signedIn") return toast("Your name comes from your Warden Chat account.", "warn");
    S.name = cleanName(n);
    store.set("wd:name", S.name);
    net.act({ kind: "hello", name: S.name });
  },
  home: goHome,
  solo: () => S.kind !== "party",
  wardenParty: () => Boolean(net.partyInfo()?.warden),
  inviteFriends: () => openAccount("friends", { party: net.partyInfo() }),
};

// Avatars everywhere in a game come from what each player equipped.
setAvatarLookup((id) => {
  const p = S.view && S.view.players.find((x) => x.id === id);
  const c = p && p.avatar && COSMETICS[`avatar:${p.avatar}`];
  return c ? c.p : null;
});

guard.setHooks({
  onLeave: () => net.act({ kind: "left", phase: "start" }),
  onReturn: (ms) => net.act({ kind: "left", phase: "end", ms }),
  onBack: () => raceBack(ctx),
  notify: (m) => toast(m, "warn"),
});
setHome(goHome);

function randomCode(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

function setHash(code) {
  try {
    if (code) history.replaceState(null, "", `#${code}`);
    else history.replaceState(null, "", location.pathname + location.search);
  } catch {
    /* the frame may refuse; the code is on screen anyway */
  }
}

function goHome() {
  net.leave();
  unmountRace();
  unmountReactions();
  closeShop();
  closeSheet();
  guard.configure({ active: false });
  S.code = "";
  S.kind = null;
  S.quick = null;
  S.view = null;
  S.started = false;
  S.screen = null;
  setHash("");
  home();
}

// ── home ─────────────────────────────────────────────────────────────────

let publicCount = null;
let stopPublic = null;
let roomOK = null;
partyKit().then((k) => {
  roomOK = k.ok;
  refreshHome();
  net.watchPublic((list) => {
    publicCount = list ? list.length : null;
    refreshHome();
  }).then((stop) => (stopPublic = stop));
});

/** Asks for a name if there isn't one yet. */
function withName(then) {
  if (raceName()) return then();
  askText("Your name for the race", "", { yes: "Race" }).then((n) => {
    const c = cleanName(n);
    if (!c) return;
    S.name = c;
    store.set("wd:name", c);
    refreshHome();
    then();
  });
}

/** Where a new party runs: on Warden Chat when you're signed in, otherwise in this page's room. */
const useWarden = () => Account.status === "signedIn";

function home() {
  S.screen = "home";
  clear(app);
  document.title = "WikiDash";
  document.body.classList.remove("ruled");
  mountHome(app, {
    name: () => S.name,
    editName: () =>
      askText("Your name", S.name).then((n) => {
        if (n === null) return;
        S.name = cleanName(n);
        store.set("wd:name", S.name);
        refreshHome();
      }),
    solo: (level) => withName(() => startSolo(false, level)),
    custom: () => withName(() => startSolo(false)),
    daily: () => withName(() => startSolo(true)),
    host: () => withName(() => startParty(true)),
    join: () =>
      askText("Party code", "", { yes: "Join", maxlength: 12 }).then((c) => {
        const code = cleanCode(c);
        if (!code) return;
        if (code.length < 4) return toast("Party codes have 5 letters.", "warn");
        withName(() => ((S.code = code), startParty(false)));
      }),
    friends: () => openAccount("friends"),
    publicList,
    signIn: () => (Account.status === "restricted" ? openRestricted() : openSignIn()),
    account: () => (Account.status === "restricted" ? openRestricted() : openAccount("profile")),
    shop: (tab) => openShop(tab),
    joinInvite: (inv) => joinInvite(inv),
    partyNote: (id) => {
      if (id === "host") return useWarden() ? "On Warden Chat" : roomOK ? "On this page" : "Sign in first";
      if (id === "join") return "5-letter code";
      if (id === "public") return publicCount == null ? "Signed-in players" : `${publicCount} open now`;
      return "";
    },
    partyWhere: () =>
      useWarden()
        ? `You're signed in with Warden Chat, so your parties run there: invite friends from your list, or share the code.${Account.demo ? " (Demo: pretend friends join and race.)" : ""}`
        : roomOK
          ? "Parties run on this page: anyone with access to it joins with the code. Sign in with Warden Chat to invite your friends."
          : "Sign in with Warden Chat to host parties and invite friends.",
  });
}

function publicList() {
  sheet("Public parties", (body, close, onStop) => {
    const list = h("div", { class: "pub-list2" }, h("div", { class: "spinner sm" }));
    body.append(h("p", { class: "sheet-lead" }, "Parties whose host made them public. You join with the name you race under."), list);
    net.watchPublic((parties) => {
      list.replaceChildren();
      if (!parties) return list.append(h("p", { class: "sheet-small" }, "Public parties show up here for players signed in to Claude with access to this page."));
      if (!parties.length) return list.append(h("p", { class: "sheet-small" }, "No public parties right now. Host one and set it to public in the lobby."));
      for (const p of parties) {
        list.append(
          h(
            "div",
            { class: "fr-row" },
            h("div", { class: "fr-main" }, h("span", { class: "fr-n" }, `${p.host}'s party`), h("span", { class: "fr-stats" }, `${p.players} of ${p.max} · ${{ race: "Race", fewest: "Fewest clicks", teams: "Teams", elim: "Elimination" }[p.mode]}`)),
            h("button", { class: "btn small", type: "button", disabled: p.players >= p.max, onclick: () => (close(), withName(() => ((S.code = p.room), startParty(false, { room: true })))) }, p.players >= p.max ? "Full" : "Join"),
          ),
        );
      }
    }).then((stop) => stop && onStop(stop));
  });
}

// ── friends and invites ──────────────────────────────────────────────────

document.addEventListener("wkd:shop", () => openShop());
document.addEventListener("wkd:join-invite", (e) => joinInvite(e.detail));
document.addEventListener("wkd:invite", async (e) => {
  const { friend, done } = e.detail;
  let info = net.partyInfo();
  if (!info || !info.warden) {
    // Racing a friend from the menu: host a party on Warden Chat first.
    closeSheet();
    await startParty(true);
    info = net.partyInfo();
    if (!info || !info.warden) return done(false);
  }
  Friends.invite(info.partyId, friend.user_id).then(
    () => {
      done(true);
      toast(`Invited ${friend.username}. They'll join with the code ${info.code}.`, "ok");
    },
    (err) => {
      done(false);
      toast(errText(err), "error");
    },
  );
});

function joinInvite(inv) {
  closeSheet();
  withName(() => {
    S.code = inv.code;
    startParty(false);
  });
}

// Toasts for things that arrive while you're on the menu.
let seenInvites = new Set();
let seenRequests = new Set();
Friends.on((data, invites) => {
  for (const inv of invites) {
    if (seenInvites.has(inv.party_id)) continue;
    seenInvites.add(inv.party_id);
    if (S.screen === "home") toast(`${inv.from} invited you to a party`, "ok");
  }
  for (const r of data.incoming) {
    if (seenRequests.has(r.request_id)) continue;
    seenRequests.add(r.request_id);
    if (S.screen === "home") toast(`${r.username} wants to be friends`, "ok");
  }
});
Account.on(() => {
  if (Account.status === "restricted") openRestricted();
  if (Account.status !== "signedIn") {
    seenInvites = new Set();
    seenRequests = new Set();
  }
  refreshHome();
});
Wallet.onClaim((c) => {
  const parts = [];
  if (c.diamonds_added) parts.push(`+${c.diamonds_added} 💎 this month`);
  if (c.claimed && c.claimed.length) parts.push(c.claimed.map((i) => (COSMETICS[i] || { name: i }).name).join(", "));
  toast(`Member perks: ${parts.join(" · ")}`, "ok");
});
void BADGE_SVG;

// ── game screens ─────────────────────────────────────────────────────────

const handlers = {
  onState(msg) {
    S.view = msg.view;
    S.connected = msg.connected || [];
    S.offset = msg.serverNow - Date.now();
    if (S.kind === "party") mountReactions(net.act);
    route();
  },
  onError(err) {
    toast(err, "error");
    if (S.screen === "race") raceError(ctx, err);
    if (S.screen === "lobby") lobbyError(ctx, err);
  },
  onConn(status) {
    S.conn = status;
    document.documentElement.dataset.conn = status;
  },
  onSay: showSay,
  onFinish(state) {
    const r = state.round;
    if (!r?.winner) return;
    const u = r.units[r.winner];
    const who = u?.members?.[0];
    if (!u || who !== net.playerId()) return;
    // A finished daily run goes on today's board.
    if (state.settings.daily) submitDaily(state.settings.daily, { name: u.name, clicks: u.clicks, ms: u.finishMs ?? 0, leaves: r.watch?.[who]?.leaves ?? 0 });
    // Solo wins count toward the difficulty's card on the menu.
    else if (S.kind === "solo") {
      const view = { round: r, settings: state.settings };
      recordSolo(routeFacts(view).level, u.finishMs ?? 0);
    }
  },
};

function waiting(text) {
  clear(app);
  app.append(h("div", { class: "center-msg" }, h("div", { class: "spinner" }), h("p", null, text)));
}

function failed(title, text) {
  clear(app);
  app.append(h("div", { class: "center-msg" }, h("h2", { class: "display" }, title), h("p", { class: "muted" }, text), h("button", { class: "btn primary", type: "button", onclick: goHome }, "Back to start")));
}

function leaveHome() {
  unmountHome();
  closeShop();
  document.body.classList.remove("ruled");
}

async function startSolo(daily, quick = null) {
  leaveHome();
  S.kind = daily ? "daily" : "solo";
  S.quick = quick;
  S.code = "";
  S.started = true;
  S.screen = "connecting";
  waiting(daily ? "Getting today's challenge..." : "Opening the encyclopedia...");
  try {
    await wiki.ready();
  } catch (err) {
    failed("The articles didn't load", err.message);
    return;
  }
  net.startSolo(hello, handlers, { daily, quick });
}

/** Host (create) or join S.code. opts.room forces this page's room (public parties). */
async function startParty(create, opts = {}) {
  leaveHome();
  S.kind = "party";
  S.started = true;
  S.screen = "connecting";
  const warden = useWarden() && !opts.room;
  if (!warden && create) S.code = randomCode(5);
  waiting(create ? "Starting your party..." : `Joining party ${S.code}...`);
  try {
    await wiki.ready();
  } catch (err) {
    failed("The articles didn't load", err.message);
    return;
  }
  const res = await net.startParty(S.code, hello, handlers, { create, warden });
  if (res.error) {
    S.code = "";
    setHash("");
    failed("Couldn't join", res.error);
    return;
  }
  S.code = res.code;
  setHash(S.code);
  if (S.screen === "connecting") waiting(`Party ${S.code}: waiting for the host...`);
}

function show(screen, mount) {
  if (S.screen === screen) return;
  if (S.screen === "race") unmountRace();
  S.screen = screen;
  clear(app);
  mount?.(app, ctx);
}

function route() {
  const v = S.view;
  if (!v || S.screen === "home") return;
  if (v.kicked) {
    show("kicked", (root) =>
      root.append(h("div", { class: "center-msg" }, h("h2", { class: "display" }, "You were removed from this party."), h("button", { class: "btn primary", type: "button", onclick: goHome }, "Back to start"))),
    );
    guard.configure({ active: false });
    return;
  }
  if (!v.joined) {
    show("joining", (root) => root.append(h("div", { class: "center-msg" }, h("div", { class: "spinner" }), h("p", null, "Joining..."))));
    return;
  }
  if (S.kind === "daily" && v.phase === "lobby" && !v.settings.daily) {
    show("daily-wait", (root) => root.append(h("div", { class: "center-msg" }, h("div", { class: "spinner" }), h("p", null, "Getting today's challenge..."))));
    return;
  }
  if (v.phase === "lobby") {
    show("lobby", mountLobby);
    updateLobby(ctx);
  } else {
    show("race", mountRace);
    updateRace(ctx);
  }
}

// ── start ────────────────────────────────────────────────────────────────

Account.init();
if (S.code && raceName()) startParty(false);
else home();

// The menu's sound and the name field wait for the intro, if there is one.
if (window.SirSCIntro && window.SirSCIntro.done) window.SirSCIntro.done.then(() => S.screen === "home" && refreshHome());
