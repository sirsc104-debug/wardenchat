// A pretend Warden Chat back end, for demo builds only (build.mjs --demo, which the artifact uses: an
// artifact can't reach Warden Chat). It answers the same Supabase Auth and database calls the real one
// will (docs/ACCOUNTS-WKD.md, docs/ECONOMY-WKD.md, docs/PARTIES-WKD.md), keeps accounts and wallets in
// this browser's storage, and comes with pretend friends who accept invites, join your party and race.
// Nothing here touches a real account.

import { Account, CONFIG } from "./account.js";
import { WKD_CATALOG } from "./catalog.js";
import * as wiki from "../wiki.js";

const KEY = "wkd-demo-db";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
let mem = load() || {};
mem = { users: {}, wallets: {}, owned: {}, requests: [], rewards: [], friends: {}, freq: [], ...mem };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* in memory only */ } };
const R = (status, data) => Promise.resolve({ status, data });
const fail = (code) => R(400, { code: "P0001", message: code });
const uid = (name) => "demo-" + name.toLowerCase();
const utcDay = () => new Date().toISOString().slice(0, 10);
const etDay = () => wiki.etDate();

// The pretend friends. Their ids look like everyone else's.
const BOTS = {
  "demo-atlas_reads": { id: "demo-atlas_reads", name: "Atlas_Reads", member: true, avatar: "owl", speed: [2600, 5200], wander: 0.12 },
  "demo-quill.fox": { id: "demo-quill.fox", name: "Quill.Fox", member: false, avatar: "fox", speed: [3800, 7600], wander: 0.25 },
  "demo-mia-r": { id: "demo-mia-r", name: "mia-r", member: false, avatar: "octopus", speed: [3200, 6800], wander: 0.2 },
};
for (const b of Object.values(BOTS)) mem.users[b.id] = mem.users[b.id] || { id: b.id, name: b.name, bot: true };

function tokenFor(u) {
  return { access_token: `demo.${u.id}.${Date.now()}`, refresh_token: `demo-refresh.${u.id}`, expires_in: 3600, user: { id: u.id, email: `${u.name}@warden.invalid`, user_metadata: { username: u.name } } };
}
function userOf(headers) {
  const m = /^Bearer demo\.(demo-[^.]+)\./.exec(headers.Authorization || "");
  return m && mem.users[m[1]] ? mem.users[m[1]] : null;
}
function wallet(id) {
  if (!mem.wallets[id]) mem.wallets[id] = { coins: 40000, diamonds: 10, member_until: null, member_month: null };
  return mem.wallets[id];
}
const isMember = (w) => Boolean(w.member_until && Date.parse(w.member_until) > Date.now());
function meOf(id) {
  const w = wallet(id);
  return {
    coins: w.coins, diamonds: w.diamonds, member: isMember(w), member_until: w.member_until, admin: false,
    owned: (mem.owned[id] || []).map((item_id) => ({ item_id, target: "" })), catalog: WKD_CATALOG,
    requests: mem.requests.filter((r) => r.user_id === id).slice(-10).reverse(), server_now: new Date().toISOString(),
  };
}
const owns = (id, item) => (mem.owned[id] || []).includes(item);
const give = (id, item) => { (mem.owned[id] = mem.owned[id] || []).push(item); };
const friendsOf = (id) => (mem.friends[id] = mem.friends[id] || []);
function befriend(a, b) {
  if (!friendsOf(a).includes(b)) friendsOf(a).push(b);
  if (!friendsOf(b).includes(a)) friendsOf(b).push(a);
}

/** A new demo account starts with two friends and one request waiting, so there's something to try. */
function welcome(id) {
  if (mem.users[id].welcomed) return;
  mem.users[id].welcomed = true;
  befriend(id, "demo-atlas_reads");
  befriend(id, "demo-quill.fox");
  mem.freq.push({ request_id: `fr-${Date.now()}`, from_id: "demo-mia-r", to_id: id, created_at: new Date().toISOString() });
  save();
}

function pretendDaily(bot) {
  // the pretend friends have usually played today's route already
  const day = etDay();
  let n = 0;
  for (const c of bot.id + day) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  if (n % 5 === 0) return null;
  return { date: day, clicks: 3 + (n % 3), ms: 30000 + (n % 50000) };
}

function rpc(fn, b, u) {
  if (fn === "wkd_ping") return R(200, true);
  if (fn === "my_account_state") return R(200, { active: true });
  if (!u) return fail(fn.startsWith("wkd_") ? "wkd_not_signed_in" : "sirsc_not_signed_in");
  const id = u.id;
  const w = wallet(id);
  if (fn === "sirsc_me") return R(200, meOf(id));
  if (fn === "sirsc_member_claim") {
    const out = { diamonds_added: 0, claimed: [] };
    if (isMember(w)) {
      const month = new Date().toISOString().slice(0, 7);
      if (w.member_month !== month) {
        w.member_month = month;
        w.diamonds += 5;
        out.diamonds_added = 5;
      }
      const t = Date.now();
      for (const c of WKD_CATALOG) {
        if (!c.member_only || owns(id, c.item_id)) continue;
        if (c.claim_from && !(Date.parse(c.claim_from) <= t && t < Date.parse(c.claim_until))) continue;
        give(id, c.item_id);
        out.claimed.push(c.item_id);
      }
      save();
    }
    out.me = meOf(id);
    return R(200, out);
  }
  if (fn === "sirsc_buy") {
    const c = WKD_CATALOG.find((x) => x.item_id === b.item_id);
    if (!c || b.game !== "wkd") return fail("sirsc_unknown_item");
    if (c.member_only) return fail("sirsc_member_only");
    const cost = b.currency === "coins" ? c.coins : b.currency === "diamonds" ? c.diamonds : null;
    if (!cost) return fail("sirsc_wrong_currency");
    if (owns(id, c.item_id)) return fail("sirsc_owned");
    if ((b.currency === "coins" ? w.coins : w.diamonds) < cost) return fail("sirsc_not_enough");
    if (b.currency === "coins") w.coins -= cost;
    else w.diamonds -= cost;
    give(id, c.item_id);
    save();
    return R(200, meOf(id));
  }
  if (fn === "sirsc_request_diamonds") {
    const n = b.diamonds | 0;
    if (n < 5 || n > 500 || n % 5) return fail("sirsc_bad_request");
    if (mem.requests.filter((r) => r.user_id === id && r.status === "pending").length >= 3) return fail("sirsc_too_many_requests");
    mem.requests.push({ id: `req-${Date.now()}`, user_id: id, diamonds: n, note: b.note || "", status: "pending", created_at: new Date().toISOString() });
    save();
    return R(200, meOf(id));
  }
  if (fn === "sirsc_cancel_request") {
    const r = mem.requests.find((x) => x.id === b.request_id && x.user_id === id);
    if (!r || r.status !== "pending") return fail("sirsc_request_closed");
    r.status = "cancelled";
    save();
    return R(200, meOf(id));
  }
  // demo only: pretend an admin gave this account a month of membership
  if (fn === "demo_membership") {
    w.member_until = new Date(Date.now() + 30 * 864e5).toISOString();
    save();
    return R(200, meOf(id));
  }
  if (fn === "wkd_reward") return reward(id, w, b);
  if (fn.startsWith("wkd_friend")) return friends(fn, id, b);
  if (fn.startsWith("wkd_party")) return party(fn, u, b);
  return R(404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
}

// ── coins after a race (ECONOMY-WKD.md) ──

const BASE = { solo: { easy: 300, medium: 600, hard: 1200 }, daily: { easy: 800, medium: 1200, hard: 2000 } };
function reward(id, w, b) {
  const base = (BASE[b.kind] || {})[b.level];
  const clicks = b.clicks | 0;
  const par = b.par | 0;
  if (!base || par < 1 || clicks < par || clicks > 200 || b.duration_ms < clicks * 1000 || b.duration_ms > 10800000) return fail("sirsc_bad_reward");
  const hour = mem.rewards.filter((r) => r.user_id === id && Date.now() - r.at < 3600e3).length;
  if (hour >= 40) return fail("sirsc_rate_limited");
  const day = utcDay();
  const mine = mem.rewards.filter((r) => r.user_id === id && r.day === day);
  const perfect = clicks === par;
  const effMult = perfect ? 1.5 : Math.max(0.4, Math.round((par / clicks) * 100) / 100);
  const memberMult = isMember(w) ? 1.5 : 1;
  const firstDaily = b.kind === "daily" && !mem.rewards.some((r) => r.user_id === id && r.daily === b.date) ? 1000 : 0;
  let coins = Math.floor(base * effMult * memberMult) + firstDaily;
  const earned = mine.reduce((t, r) => t + r.coins, 0);
  const left = Math.max(0, 20000 - earned);
  const capped = coins > left;
  coins = Math.min(coins, left);
  w.coins += coins;
  mem.rewards.push({ user_id: id, day, at: Date.now(), coins, daily: b.kind === "daily" ? b.date : null, clicks, ms: b.duration_ms, solo: b.kind === "solo" });
  save();
  return R(200, { coins, base, eff_mult: effMult, perfect, member_mult: memberMult, first_daily_bonus: firstDaily, capped, today: earned + coins, daily_cap: 20000, me: meOf(id) });
}

// ── friends (ACCOUNTS-WKD.md) ──

function friends(fn, id, b) {
  if (fn === "wkd_friends") {
    welcome(id);
    const list = friendsOf(id).map((fid) => {
      const f = mem.users[fid] || { id: fid, name: fid };
      const bot = BOTS[fid];
      const mineDaily = mem.rewards.filter((r) => r.user_id === fid && r.daily === etDay()).sort((a, c) => a.clicks - c.clicks)[0];
      return {
        user_id: fid, username: f.name, member: bot ? bot.member : isMember(wallet(fid)), avatar: bot ? bot.avatar : null,
        daily: bot ? pretendDaily(bot) : mineDaily ? { date: mineDaily.daily, clicks: mineDaily.clicks, ms: mineDaily.ms } : null,
        party_wins: bot ? (fid.length % 4) + 1 : 0, solo_wins: mem.rewards.filter((r) => r.user_id === fid && r.solo).length,
      };
    });
    const name = (x) => (mem.users[x] || {}).name || x;
    return R(200, {
      friends: list,
      incoming: mem.freq.filter((r) => r.to_id === id).map((r) => ({ request_id: r.request_id, username: name(r.from_id), created_at: r.created_at })),
      outgoing: mem.freq.filter((r) => r.from_id === id).map((r) => ({ request_id: r.request_id, username: name(r.to_id), created_at: r.created_at })),
    });
  }
  if (fn === "wkd_friend_request") {
    const name = String(b.target_username || "").trim();
    if (!Account.RULES.nameRe.test(name) || name.length < 3) return fail("wkd_user_not_found");
    const to = uid(name);
    if (to === id) return fail("wkd_self");
    if (friendsOf(id).includes(to)) return fail("wkd_already_friends");
    if (mem.freq.some((r) => r.from_id === id && r.to_id === to)) return fail("wkd_already_requested");
    const back = mem.freq.find((r) => r.from_id === to && r.to_id === id);
    if (back) {
      mem.freq = mem.freq.filter((r) => r !== back);
      befriend(id, to);
      save();
      return R(200, { status: "accepted" });
    }
    // any name works in the demo: a pretend player who says yes a few seconds later
    if (!mem.users[to]) mem.users[to] = { id: to, name, bot: true };
    const req = { request_id: `fr-${Date.now()}`, from_id: id, to_id: to, created_at: new Date().toISOString() };
    mem.freq.push(req);
    save();
    setTimeout(() => {
      if (!mem.freq.includes(req)) return;
      mem.freq = mem.freq.filter((r) => r !== req);
      befriend(id, to);
      save();
    }, 5000);
    return R(200, { status: "sent" });
  }
  if (fn === "wkd_friend_respond") {
    const r = mem.freq.find((x) => x.request_id === b.request_id && x.to_id === id);
    if (!r) return fail("wkd_request_not_found");
    mem.freq = mem.freq.filter((x) => x !== r);
    if (b.accept) befriend(id, r.from_id);
    save();
    return R(204, null);
  }
  if (fn === "wkd_friend_cancel") {
    const r = mem.freq.find((x) => x.request_id === b.request_id && x.from_id === id);
    if (!r) return fail("wkd_request_not_found");
    mem.freq = mem.freq.filter((x) => x !== r);
    save();
    return R(204, null);
  }
  if (fn === "wkd_friend_remove") {
    mem.friends[id] = friendsOf(id).filter((x) => x !== b.friend_id);
    mem.friends[b.friend_id] = friendsOf(b.friend_id).filter((x) => x !== id);
    save();
    return R(204, null);
  }
  return R(404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
}

// ── parties (PARTIES-WKD.md), in memory: a demo party lasts as long as the page ──

const parties = {};
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

function partyOut(p, id, sinceRev) {
  const now = Date.now();
  return {
    party_id: p.id, code: p.code, host_id: p.host_id, rev: p.rev, server_now: new Date().toISOString(),
    doc: p.rev > (sinceRev || 0) ? p.doc : null,
    members: [...p.members.values()].map((m) => ({ user_id: m.id, username: m.name, member: m.member, presence: m.presence, seen_ago: Math.round((now - m.seen) / 1000) })),
  };
}
function addMember(p, user) {
  if (!p.members.has(user.id)) p.members.set(user.id, { id: user.id, name: user.name, member: isMember(wallet(user.id)) || Boolean(BOTS[user.id] && BOTS[user.id].member), presence: {}, seen: Date.now() });
  return p.members.get(user.id);
}

function party(fn, u, b) {
  const id = u.id;
  if (fn === "wkd_party_create") {
    const p = { id: `p-${Date.now()}`, code: newCode(), host_id: id, rev: 0, doc: null, members: new Map(), bots: [], created: Date.now() };
    addMember(p, u);
    parties[p.id] = p;
    return R(200, partyOut(p, id, 0));
  }
  if (fn === "wkd_party_join") {
    const code = String(b.code || "").toUpperCase();
    const p = Object.values(parties).find((x) => x.code === code);
    if (!p) return fail("wkd_no_such_party");
    if (p.members.size >= 24 && !p.members.has(id)) return fail("wkd_party_full");
    addMember(p, u);
    return R(200, partyOut(p, id, 0));
  }
  if (fn === "wkd_party_invites") return R(200, []);
  if (fn === "wkd_party_decline") return R(204, null);
  const p = parties[b.party_id];
  if (!p || !p.members.has(id)) return fail("wkd_no_such_party");
  const me = p.members.get(id);
  if (fn === "wkd_party_sync") {
    me.seen = Date.now();
    if (b.presence && typeof b.presence === "object") me.presence = b.presence;
    return R(200, partyOut(p, id, b.since_rev));
  }
  if (fn === "wkd_party_put") {
    const host = p.members.get(p.host_id);
    if (p.host_id !== id && host && Date.now() - host.seen < 10000) return fail("wkd_not_host");
    p.host_id = id;
    p.doc = b.doc;
    p.rev += 1;
    return R(200, { rev: p.rev });
  }
  if (fn === "wkd_party_leave") {
    p.members.delete(id);
    return R(204, null);
  }
  if (fn === "wkd_party_invite") {
    const bot = BOTS[b.friend_id] || (mem.users[b.friend_id] && mem.users[b.friend_id].bot ? { id: b.friend_id, name: mem.users[b.friend_id].name, member: false, avatar: null, speed: [3500, 7000], wander: 0.2 } : null);
    if (!friendsOf(id).includes(b.friend_id)) return fail("wkd_not_friends");
    // a pretend friend says yes and joins a moment later
    if (bot && !p.members.has(bot.id)) setTimeout(() => botJoin(p, bot), 2200 + Math.random() * 1500);
    return R(200, { status: "sent" });
  }
  return R(404, { code: "PGRST202", message: `Could not find the function public.${fn}` });
}

// ── the pretend friends, racing ──

function botJoin(p, bot) {
  if (!parties[p.id] || p.members.has(bot.id)) return;
  const m = addMember(p, { id: bot.id, name: bot.name });
  m.presence = { pid: bot.id, name: bot.name, q: [[1, { kind: "hello", name: bot.name, avatar: bot.avatar, member: bot.member }]], say: null };
  const st = { n: 1, nextAt: 0, sayN: 0, lastRound: 0, saidFor: 0 };
  const timer = setInterval(() => {
    if (!parties[p.id] || !p.members.has(bot.id)) return clearInterval(timer);
    m.seen = Date.now();
    botThink(p, bot, m, st);
  }, 500);
}

function botThink(p, bot, m, st) {
  const doc = p.doc;
  const state = doc && doc.state;
  if (!state) return;
  // forget moves the host has answered
  const ack = (doc.acks || {})[bot.id];
  if (ack) m.presence = { ...m.presence, q: (m.presence.q || []).filter(([n]) => n > ack.n) };
  const send = (action) => {
    st.n += 1;
    m.presence = { ...m.presence, q: [...(m.presence.q || []), [st.n, action]].slice(-8) };
  };
  const say = (sid) => {
    st.sayN += 1;
    m.presence = { ...m.presence, say: [st.sayN, sid, bot.name] };
  };
  const r = state.round;
  if (state.phase === "over" && r && st.saidFor !== r.n) {
    st.saidFor = r.n;
    if (Math.random() < 0.7) setTimeout(() => say(r.winner === bot.id ? "p3" : Math.random() < 0.5 ? "p2" : "e5"), 1200 + Math.random() * 1500);
    return;
  }
  if (state.phase !== "racing" || !r) return;
  const key = r.teamOf[bot.id];
  const u = key && r.units[key];
  if (!u || u.status !== "running") return;
  const now = Date.now() + (Number(doc.clock) ? 0 : 0);
  if (now < r.startAt + 1200) return;
  if (r.mode === "teams" && u.turn !== bot.id) return;
  if ((m.presence.q || []).some(([, a]) => a.kind === "move")) return; // wait for the last click to land
  if (st.lastRound !== r.n) {
    st.lastRound = r.n;
    st.nextAt = r.startAt + bot.speed[0] + Math.random() * (bot.speed[1] - bot.speed[0]);
  }
  if (now < st.nextAt) return;
  const cur = u.stack[u.stack.length - 1];
  const banned = (r.rules && r.rules.banned) || [];
  let next = null;
  if (Math.random() < bot.wander) {
    const links = wiki.linksOf(cur).filter((t) => !banned.some((x) => x.toLowerCase() === t.toLowerCase()));
    next = links[Math.floor(Math.random() * links.length)];
  }
  if (!next) next = wiki.shortestPath(cur, r.target, banned)[1];
  if (!next) return;
  send({ kind: "move", to: next });
  st.nextAt = now + bot.speed[0] + Math.random() * (bot.speed[1] - bot.speed[0]);
}

// ── the transport ──

function handle(method, url, headers, body) {
  const path = url.replace(CONFIG.supabaseUrl, "");
  if (path.startsWith("/auth/v1/token?grant_type=password") || path === "/auth/v1/signup") {
    const name = String((body.data && body.data.username) || body.email.split("@")[0]).trim();
    if (!Account.RULES.nameRe.test(name) || name.length < 3) return R(400, { msg: "Database error saving new user" });
    if (path === "/auth/v1/signup" && String(body.password || "").length < 10) return R(422, { error_code: "weak_password", msg: "Password should be at least 10 characters" });
    const id = uid(name);
    if (BOTS[id]) return R(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
    if (!mem.users[id]) {
      mem.users[id] = { id, name };
      save();
    }
    return R(200, tokenFor(mem.users[id]));
  }
  if (path.startsWith("/auth/v1/token?grant_type=refresh_token")) {
    const id = String(body.refresh_token || "").replace("demo-refresh.", "");
    return mem.users[id] ? R(200, tokenFor(mem.users[id])) : R(400, { error_code: "refresh_token_not_found" });
  }
  if (path.startsWith("/auth/v1/logout")) return R(204, null);
  const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
  if (m) return rpc(m[1], body || {}, userOf(headers));
  return R(404, { message: "not found" });
}

export function installMock() {
  window.WKD_DEMO = true;
  Account.useTransport((method, url, headers, body) => new Promise((res) => setTimeout(() => res(handle(method, url, headers, body)), 90)));
}
