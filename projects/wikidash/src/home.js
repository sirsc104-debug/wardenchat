// The home screen, in the SirSC games' style: a fixed stage scaled to the window over a live scene, the
// account and wallet in the top-left corner, the title panel on the right with a Solo / Party toggle and
// four mode cards, and the daily challenge on a paper card to the left.

import { h, clear, icon, fmtTime } from "./ui.js";
import * as wiki from "./wiki.js";
import * as store from "./store.js";
import { startScene } from "./scene.js";
import { Account } from "./wc/account.js";
import { Wallet, BADGE_SVG } from "./wc/wallet.js";
import { Friends } from "./wc/friends.js";
import { isMuted, toggleMute, sfx } from "./sound.js";
import { isDark, toggleTheme } from "./theme.js";
import { fetchDaily, boardList, levelPill, dateLabel } from "./daily.js";
import { avatarHTML, current as currentLook } from "./look.js";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

const SOLO = [
  { id: "easy", cls: "m-green", icon: "🌱", name: "Easy", tag: "2 clicks", info: "A short hop between two big topics." },
  { id: "medium", cls: "m-blue", icon: "🧭", name: "Medium", tag: "3 clicks", info: "Three links apart. The classic race." },
  { id: "hard", cls: "m-red", icon: "🔥", name: "Hard", tag: "4+ clicks", info: "The far corners of the encyclopedia." },
  { id: "custom", cls: "m-ultra", icon: "🗺️", name: "Custom", tag: "Your route", info: "Pick the start, the target and the rules." },
];
const PARTY = [
  { id: "host", cls: "m-green", icon: "🎉", name: "Host", tag: "Up to 24", info: "Start a party and share the code." },
  { id: "join", cls: "m-blue", icon: "🔑", name: "Join", tag: "Have a code?", info: "Type the code from your host." },
  { id: "friends", cls: "m-red", icon: "👥", name: "Friends", tag: "Warden Chat", info: "Invite friends from your account." },
  { id: "public", cls: "m-purple", icon: "🌍", name: "Public", tag: "Open parties", info: "Jump into a party anyone can join." },
];

/** Wins and best time per difficulty, kept in this browser. */
export function soloStats(level) {
  return store.getJSON(`wkd.solo.${level}`, { wins: 0, best: 0 }) || { wins: 0, best: 0 };
}
export function recordSolo(level, ms) {
  const s = soloStats(level);
  s.wins += 1;
  if (!s.best || ms < s.best) s.best = ms;
  store.setJSON(`wkd.solo.${level}`, s);
}

let H = null; // the mounted home

/**
 * actions: { name(), editName(), solo(level), custom(), daily(), host(), join(), friends(), publicList(),
 *            signIn(), account(), shop(tab), partyNote(), invites() }
 */
export function mountHome(root, actions) {
  unmountHome();
  const tab = store.get("wkd.home.tab", "solo") === "party" ? "party" : "solo";
  H = { actions, tab, stops: [] };
  document.body.classList.add("on-home");

  const canvas = h("canvas", { class: "scene", "aria-hidden": "true" });
  H.corner = h("div", { class: "corner-l" });
  H.cornerR = h("div", { class: "corner-r" });
  H.daily = h("aside", { class: "daily-card2", "aria-label": "Daily challenge" });
  H.racing = h("button", { class: "racing-as", type: "button" });
  H.glider = h("span", { class: "type-glider", "aria-hidden": "true" });
  H.tabs = {
    solo: h("button", { class: "type-btn", type: "button", "data-tab": "solo" }, h("span", { class: "type-icon" }, "🏃"), h("span", { class: "type-name" }, "Solo"), h("span", { class: "type-sub" }, "Race the clock")),
    party: h("button", { class: "type-btn", type: "button", "data-tab": "party" }, h("span", { class: "type-icon" }, "🎉"), h("span", { class: "type-name" }, "Party"), h("span", { class: "type-sub" }, "Race your friends")),
  };
  H.toggle = h("div", { class: "type-toggle", role: "tablist" }, H.glider, H.tabs.solo, H.tabs.party);
  H.modes = h("div", { class: "modes" });
  H.how = h("div", { class: "how" });
  H.edition = h("p", { class: "edition2" });
  H.panel = h(
    "section",
    { class: "title-panel" },
    h("h1", { class: "logo" }, h("span", { class: "l1" }, h("i", { class: "by" }, "SirSC's"), "WIKI"), h("span", { class: "l2" }, "DASH")),
    h("p", { class: "tagline" }, "Race across Wikipedia using only the links."),
    H.racing,
    H.toggle,
    H.modes,
    H.how,
  );
  H.stage = h("div", { class: "stage" }, H.corner, H.cornerR, H.daily, H.panel, H.edition);
  H.el = h("div", { class: "home", id: "home" }, canvas, h("div", { class: "scene-shade" }), H.stage);
  root.append(H.el);

  for (const b of Object.values(H.tabs)) b.addEventListener("click", () => setTab(b.dataset.tab));
  H.racing.addEventListener("click", () => (Account.status === "signedIn" ? actions.account() : actions.editName()));

  H.stops.push(startScene(canvas));
  const fit = () => {
    const tall = window.innerWidth / Math.max(1, window.innerHeight) < 0.95;
    const [w, hh] = tall ? [900, 1500] : [1600, 900];
    const k = Math.min(window.innerWidth / w, window.innerHeight / hh);
    H.stage.classList.toggle("tall", tall);
    H.stage.style.width = w + "px";
    H.stage.style.height = hh + "px";
    H.stage.style.transform = `translate(-50%, -50%) scale(${k})`;
    placeGlider();
  };
  window.addEventListener("resize", fit);
  H.stops.push(() => window.removeEventListener("resize", fit));
  fit();

  H.stops.push(Account.on(renderCorner), Wallet.on(renderCorner), Friends.on(() => { renderCorner(); renderHow(); renderDailyFriends(); }));
  renderCorner();
  renderCornerR();
  setTab(tab, true);
  renderDaily();
  wiki.ready().then(() => {
    if (!H) return;
    H.edition.textContent = `${wiki.articleCount().toLocaleString()} Wikipedia articles, saved ${dateLabel(wiki.snapshotDate())} · text CC BY-SA 4.0`;
  }).catch((e) => H && (H.edition.textContent = e.message));
  return unmountHome;
}

export function unmountHome() {
  if (!H) return;
  for (const s of H.stops) s && s();
  H.el.remove();
  document.body.classList.remove("on-home");
  H = null;
}

export const homeShown = () => Boolean(H);
export function refreshHome() {
  if (!H) return;
  renderCorner();
  renderRacing();
  renderModes();
  renderHow();
}

function setTab(t, first) {
  H.tab = t;
  store.set("wkd.home.tab", t);
  for (const [k, b] of Object.entries(H.tabs)) {
    b.classList.toggle("active", k === t);
    b.setAttribute("aria-selected", String(k === t));
  }
  placeGlider();
  if (!first) {
    sfx.click();
    H.how.classList.add("switching");
    setTimeout(() => H && H.how.classList.remove("switching"), 220);
  }
  renderRacing();
  renderModes();
  renderHow();
}

function placeGlider() {
  if (!H) return;
  const b = H.tabs[H.tab];
  requestAnimationFrame(() => {
    if (!H) return;
    H.glider.style.width = b.offsetWidth + "px";
    H.glider.style.transform = `translateX(${b.offsetLeft}px)`;
  });
}

// ── corners ──────────────────────────────────────────────────────────────

function pill(content, opts = {}) {
  return h("button", { class: `pill ${opts.cls || ""}`, type: "button", title: opts.title || null, onclick: opts.onclick }, content);
}

function renderCorner() {
  if (!H) return;
  const a = H.actions;
  clear(H.corner);
  const status = Account.status;
  if (status === "signedIn") {
    const u = Account.user;
    const look = currentLook();
    const alerts = Friends.incoming.length + Friends.invites.length;
    H.corner.append(
      pill([h("span", { class: "acct-av" }, avatarHTML(u.id, u.username, look.avatar)), h("span", { class: "acct-n" }, u.username), alerts ? h("span", { class: "acct-alert", title: "Friend requests and party invites" }, String(alerts)) : h("i", { class: "acct-dot", title: "Signed in" })], { cls: "acct-name", onclick: () => a.account(), title: "Your Warden Chat account" }),
      pill(["🪙 ", h("b", null, Wallet.me ? fmt(Wallet.coins) : "…")], { cls: "acct-num", onclick: () => a.shop(), title: "Coins" }),
      pill(["💎 ", h("b", null, Wallet.me ? fmt(Wallet.diamonds) : "…")], { cls: "acct-num", onclick: () => a.shop("diamonds"), title: "Diamonds" }),
    );
    if (Wallet.member) {
      const m = pill([], { cls: "acct-member", onclick: () => a.shop("member"), title: "SirSC Member" });
      m.innerHTML = `${BADGE_SVG}<span>Member</span>`;
      H.corner.append(m);
    }
    if (Account.demo) H.corner.append(h("span", { class: "pill demo-pill", title: "This build uses a pretend Warden Chat back end stored in your browser. Nothing touches a real account." }, "Demo wallet"));
  } else if (status === "restricted") {
    H.corner.append(pill("⛔ Account restricted", { onclick: () => a.account() }));
  } else if (status === "signedOut") {
    H.corner.append(pill(["👤 ", h("span", null, "Sign in")], { onclick: () => a.signIn(), title: "Sign in with Warden Chat" }));
  } else if (status === "checking") {
    H.corner.append(h("span", { class: "pill off" }, "👤 …"));
  }
  H.corner.append(pill(["🛍️ ", h("span", null, "Shop")], { onclick: () => a.shop(), title: "Pages, links, avatars and more" }));
  renderRacing();
}

function renderCornerR() {
  clear(H.cornerR);
  const snd = pill([], { title: "Sound on or off" });
  const thm = pill([], { title: "Light or dark pages while you race" });
  const paint = () => {
    snd.classList.toggle("off", isMuted());
    snd.replaceChildren(isMuted() ? "🔇 " : "🔊 ", h("span", null, "Sound"));
    thm.replaceChildren(isDark() ? "🌙 " : "☀️ ", h("span", null, isDark() ? "Dark pages" : "Light pages"));
  };
  snd.addEventListener("click", () => (toggleMute(), paint()));
  thm.addEventListener("click", () => (toggleTheme(), paint()));
  paint();
  H.cornerR.append(snd, thm);
}

function renderRacing() {
  if (!H) return;
  clear(H.racing);
  if (Account.status === "signedIn") {
    const u = Account.user;
    H.racing.append(avatarHTML(u.id, u.username, currentLook().avatar, "sm"), h("span", null, "Racing as ", h("b", null, u.username)));
    if (Wallet.member) {
      const b = h("span", { class: "badge-wrap" });
      b.innerHTML = BADGE_SVG;
      H.racing.append(b);
    }
    H.racing.title = "Your Warden Chat account";
  } else {
    const n = H.actions.name();
    H.racing.append(h("span", null, n ? "Racing as " : "Pick a name to race", n ? h("b", null, n) : null), h("span", { class: "rename" }, "✎"));
    H.racing.title = "Change your name";
  }
}

// ── mode cards and the rules box ─────────────────────────────────────────

function renderModes() {
  clear(H.modes);
  const list = H.tab === "solo" ? SOLO : PARTY;
  list.forEach((m, i) => {
    let best = "";
    let locked = false;
    if (H.tab === "solo" && m.id !== "custom") {
      const s = soloStats(m.id);
      best = s.wins ? `${s.wins} win${s.wins === 1 ? "" : "s"} · best ${fmtTime(s.best)}` : "No wins yet";
    } else if (H.tab === "solo") best = "Any of the articles";
    else if (m.id === "friends") {
      if (Account.status === "signedIn") best = `${Friends.list.length} friend${Friends.list.length === 1 ? "" : "s"}`;
      else {
        best = Account.status === "unavailable" ? "Not switched on yet" : "Sign in first";
        locked = Account.status === "unavailable";
      }
    } else best = H.actions.partyNote(m.id) || "";
    const card = h(
      "button",
      { class: `mode-card ${m.cls}${locked ? " locked" : ""}`, type: "button", style: { "--d": `${-i * 0.6}s` }, "aria-disabled": locked ? "true" : null },
      h("span", { class: "mode-icon" }, m.icon),
      h("span", { class: "mode-name" }, m.name),
      h("span", { class: "mode-tag" }, m.tag),
      h("span", { class: "mode-info" }, m.info),
      h("span", { class: "mode-best" }, best),
      locked ? h("span", { class: "mode-lock" }, "🔒") : null,
    );
    card.addEventListener("click", () => {
      if (locked) return;
      sfx.click();
      const a = H.actions;
      if (H.tab === "solo") return m.id === "custom" ? a.custom() : a.solo(m.id);
      if (m.id === "host") return a.host();
      if (m.id === "join") return a.join();
      if (m.id === "friends") return Account.status === "signedIn" ? a.friends() : a.signIn();
      return a.publicList();
    });
    H.modes.append(card);
  });
}

function renderHow() {
  if (!H) return;
  clear(H.how);
  const coins = Account.status !== "unavailable";
  if (H.tab === "solo") {
    H.how.append(
      how("🔗", "Click only the links in the article. No search, no back button unless you turn it on."),
      how("⏱️", "The clock starts on GO. Matching the shortest route is a perfect run."),
      how("🪙", coins ? `Wins earn coins: up to 🪙 ${fmt(1800)} for a perfect Hard run, 1.5× for SirSC Members.` : "Coins and the Shop arrive with Warden Chat accounts."),
      how("🛍️", "Pages, link styles, avatars and finishes come from the Shop."),
    );
    return;
  }
  const invites = Friends.invites || [];
  if (invites.length) {
    const box = h("div", { class: "how-invites" }, h("b", null, "Party invites"));
    for (const inv of invites.slice(0, 3)) {
      box.append(
        h("div", { class: "inv-row" }, h("span", null, `${inv.from} invited you`), h("button", { class: "btn small", type: "button", onclick: () => H.actions.joinInvite(inv) }, "Join"), h("button", { class: "btn small alt", type: "button", onclick: () => Friends.dismissInvite(inv.party_id) }, "No thanks")),
      );
    }
    H.how.append(box);
  }
  H.how.append(
    how("🏁", "Four modes: race, fewest clicks, teams and elimination, over 1 to 7 rounds."),
    how("🛡️", "The host sets the rules: back button, find in page, leaving the tab, click and time limits, banned pages."),
    how("📡", H.actions.partyWhere()),
    how("🙂", "Reactions and quick chat while you race. Party races don't earn coins."),
  );
}
const how = (ic, text) => h("p", { class: "how-row" }, h("span", { class: "how-ic" }, ic), h("span", null, text));

// ── the daily card ───────────────────────────────────────────────────────

function renderDaily() {
  clear(H.daily);
  H.dailyBody = h("div", { class: "dc-body" }, h("div", { class: "spinner sm" }));
  H.dailyFriends = h("div", { class: "dc-friends" });
  H.dailyBtn = h("button", { class: "btn red big", type: "button", disabled: true, onclick: () => H.actions.daily() }, "Play today's route");
  H.daily.append(
    h("div", { class: "dc-ribbon" }, "DAILY"),
    h("div", { class: "dc-head" }, h("span", { class: "dc-cal" }, "📅"), h("div", null, h("div", { class: "dc-title" }, "Daily challenge"), h("div", { class: "dc-date" }, ""))),
    H.dailyBody,
    H.dailyFriends,
    H.dailyBtn,
    h("p", { class: "dc-note" }, "A new route every day at midnight Eastern."),
  );
  fetchDaily()
    .then((d) => {
      if (!H) return;
      H.dailyData = d;
      H.daily.querySelector(".dc-date").textContent = dateLabel(d.date);
      clear(H.dailyBody).append(
        levelPill(d.level) || "",
        h("div", { class: "dc-route" }, h("span", { class: "rchip start" }, d.start), h("span", { class: "dc-arrow" }, "↓"), h("span", { class: "rchip target" }, icon("flag", 14), d.target)),
        h("p", { class: "dc-par" }, `Shortest route: ${d.hops} click${d.hops === 1 ? "" : "s"}`),
        boardList(d.top, 4),
      );
      H.dailyBtn.disabled = false;
      H.dailyBtn.textContent = d.you ? "Try again" : "Play today's route";
      renderDailyFriends();
    })
    .catch((e) => H && clear(H.dailyBody).append(h("p", { class: "dc-par" }, e.message || "The daily challenge isn't available.")));
}

function renderDailyFriends() {
  if (!H || !H.dailyFriends) return;
  clear(H.dailyFriends);
  const d = H.dailyData;
  if (!d || Account.status !== "signedIn") return;
  const done = Friends.list.filter((f) => f.daily && f.daily.date === d.date).sort((a, b) => a.daily.clicks - b.daily.clicks || a.daily.ms - b.daily.ms);
  if (!Friends.list.length) return;
  H.dailyFriends.append(h("div", { class: "dc-sub" }, "Friends today"));
  if (!done.length) H.dailyFriends.append(h("p", { class: "dc-par" }, "None of your friends has played yet."));
  for (const f of done.slice(0, 3)) {
    H.dailyFriends.append(h("div", { class: "dc-friend" }, avatarHTML(f.user_id, f.username, f.avatar, "sm"), h("span", { class: "dcf-n" }, f.username), h("span", null, `${f.daily.clicks} · ${fmtTime(f.daily.ms)}`)));
  }
}
