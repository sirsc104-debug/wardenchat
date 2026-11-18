// The bundled Wikipedia. An artifact can't reach wikipedia.org, so the game ships
// its own snapshot: a few thousand well-linked articles, cleaned and cut down to
// text, with every link between them kept. Links to pages outside the snapshot
// are plain text, so everything a player can click is something they can reach.
//
// data/index.json  titles, short descriptions and the link graph
// data/a/<n>.txt   article bodies, a handful per file, fetched when needed

const NAMESPACES = new Set([
  "file", "image", "media", "category", "help", "special", "wikipedia", "wp", "project",
  "template", "portal", "talk", "user", "draft", "mediawiki", "module", "timedtext", "book",
]);

/** decodeURIComponent that never throws (some hrefs carry a bare "%"). */
export function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return String(v);
  }
}

export function normTitle(raw) {
  let t = String(raw ?? "");
  t = t.split("#")[0].replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const head = String.fromCodePoint(t.codePointAt(0));
  return head.toUpperCase() + t.slice(head.length);
}

export const sameTitle = (a, b) => normTitle(a).toLowerCase() === normTitle(b).toLowerCase();

// ── index ────────────────────────────────────────────────────────────────

let IDX = null;
let byKey = null;
let loading = null;

export function ready() {
  if (!loading) {
    loading = fetch("data/index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`The article index didn't load (${r.status}).`);
        return r.json();
      })
      .then((j) => {
        IDX = j;
        byKey = new Map();
        j.t.forEach((t, i) => byKey.set(t.toLowerCase(), i));
        for (const [alias, i] of Object.entries(j.al || {})) if (!byKey.has(alias)) byKey.set(alias, i);
        return IDX;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

export const isReady = () => Boolean(IDX);
export const articleCount = () => (IDX ? IDX.t.length : 0);
export const snapshotDate = () => (IDX ? IDX.date : "");

/** Article id for a title or one of its redirects, or -1. */
export function idOf(title) {
  if (!IDX) return -1;
  const k = normTitle(title).toLowerCase();
  const i = byKey.get(k);
  return i === undefined ? -1 : i;
}
export const titleOf = (i) => (IDX && IDX.t[i]) || "";

/** Canonical article title (follows redirects), or null if it isn't in the snapshot. */
export async function canonical(title) {
  await ready();
  const i = idOf(title);
  return i < 0 ? null : IDX.t[i];
}

/** Title search: prefix matches first, then word starts, then anywhere. */
export async function search(q) {
  await ready();
  const k = q.trim().toLowerCase();
  if (!k) return [];
  const pre = [];
  const word = [];
  const any = [];
  for (let i = 0; i < IDX.t.length; i++) {
    const t = IDX.t[i].toLowerCase();
    if (t.startsWith(k)) pre.push(i);
    else if (t.includes(" " + k) || t.includes("(" + k)) word.push(i);
    else if (t.includes(k)) any.push(i);
  }
  const rank = (a, b) => IDX.t[a].length - IDX.t[b].length || (IDX.pop[b] || 0) - (IDX.pop[a] || 0);
  pre.sort(rank);
  word.sort(rank);
  any.sort(rank);
  const out = [...pre, ...word, ...any].slice(0, 7).map((i) => IDX.t[i]);
  // A redirect name that matches exactly ("USA") shows its article too.
  const alias = byKey.get(k);
  if (alias !== undefined && !out.includes(IDX.t[alias])) out.unshift(IDX.t[alias]);
  return out.slice(0, 7);
}

// ── article bodies ──────────────────────────────────────────────────────

const shards = new Map();

async function gunzip(buf) {
  const ds = new DecompressionStream("gzip");
  const text = await new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
  return JSON.parse(text);
}

/** Each file holds a few articles as gzipped JSON, written out in base64 text. */
function shard(n) {
  if (!shards.has(n)) {
    const p = fetch(`data/a/${n}.txt`)
      .then((r) => {
        if (!r.ok) throw new Error(`Couldn't load that page (${r.status}).`);
        return r.text();
      })
      .then((text) => {
        const bin = atob(text.trim());
        const b = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        return gunzip(b);
      });
    shards.set(n, p);
    p.catch(() => shards.delete(n));
  }
  return shards.get(n);
}

async function body(i) {
  await ready();
  const s = await shard(IDX.sh[i]);
  const a = s[i];
  if (!a) throw new Error("That page is missing from the snapshot.");
  return a;
}

export async function fetchArticle(title) {
  await ready();
  const i = idOf(title);
  if (i < 0) throw new Error(`"${title}" isn't in this edition.`);
  const a = await body(i);
  return { id: i, title: IDX.t[i], html: a.h, nav: a.n || [] };
}

const summaries = new Map();
export function summary(title) {
  const k = normTitle(title).toLowerCase();
  if (!summaries.has(k)) {
    const p = (async () => {
      await ready();
      const i = idOf(title);
      if (i < 0) return { title: normTitle(title), description: "", extract: "", thumb: "" };
      let extract = "";
      try {
        extract = (await body(i)).x || "";
      } catch {
        /* description is enough */
      }
      return { title: IDX.t[i], description: IDX.d[i] || "", extract, thumb: "" };
    })();
    summaries.set(k, p);
  }
  return summaries.get(k);
}

/** Turn stored article HTML into a safe, game-ready node. */
export function buildArticle(html, { allowNavboxes, current, nav }) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  root.querySelectorAll("script,iframe,object,embed,form,style,link,meta").forEach((n) => n.remove());
  root.querySelectorAll("*").forEach((n) => {
    for (const a of [...n.attributes]) if (/^on/i.test(a.name) || a.name === "style" || a.name === "href" || a.name === "src") n.removeAttribute(a.name);
  });
  root.querySelectorAll("a").forEach((a) => {
    a.draggable = false;
    if (a.hasAttribute("f")) {
      a.dataset.frag = a.getAttribute("f");
      a.removeAttribute("f");
      a.className = "fl";
      return;
    }
    const i = Number(a.getAttribute("i"));
    a.removeAttribute("i");
    const t = Number.isInteger(i) ? titleOf(i) : "";
    if (!t) {
      a.className = "dead";
      return;
    }
    if (current && sameTitle(t, current)) {
      a.className = "fl";
      a.dataset.frag = "";
      return;
    }
    a.className = "wl";
    a.dataset.to = t;
    a.setAttribute("role", "link");
    a.tabIndex = 0;
  });
  // Wide tables scroll on their own instead of pushing the page sideways.
  root.querySelectorAll("table.wikitable").forEach((tb) => {
    const wrap = doc.createElement("div");
    wrap.className = "tbl-wrap";
    tb.replaceWith(wrap);
    wrap.append(tb);
  });
  const wrap = document.createElement("div");
  wrap.className = "mw-parser-output";
  wrap.append(...[...root.childNodes].map((n) => document.importNode(n, true)));
  if (allowNavboxes && nav && nav.length) wrap.append(navBoxes(nav, current));
  return wrap;
}

function navBoxes(nav, current) {
  const box = document.createElement("div");
  box.className = "navboxes";
  for (const nb of nav) {
    const t = document.createElement("table");
    t.className = "navbox";
    if (nb.t) {
      const cap = t.createCaption();
      cap.textContent = nb.t;
    }
    const tb = t.createTBody();
    for (const [group, ids] of nb.g) {
      const tr = tb.insertRow();
      if (group) {
        const th = document.createElement("th");
        th.scope = "row";
        th.textContent = group;
        tr.append(th);
      }
      const td = tr.insertCell();
      if (!group) td.colSpan = 2;
      const ul = document.createElement("ul");
      for (const i of ids) {
        const title = titleOf(i);
        if (!title) continue;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.textContent = title;
        if (current && sameTitle(title, current)) {
          a.className = "fl self";
          a.dataset.frag = "";
        } else {
          a.className = "wl";
          a.dataset.to = title;
          a.setAttribute("role", "link");
          a.tabIndex = 0;
        }
        li.append(a);
        ul.append(li);
      }
      td.append(ul);
    }
    box.append(t);
  }
  return box;
}

// ── the link graph: verification and routes ─────────────────────────────

/** Does `from` link to `to`? Navigation-box links count only when the round shows them. */
export function verifyLink(from, rawTo, allowNav) {
  if (!IDX) return { ok: false, canon: "", reason: "The article index isn't loaded yet." };
  const a = idOf(from);
  const b = idOf(rawTo);
  if (b < 0) return { ok: false, canon: "", reason: "That link goes to a page outside this edition." };
  if (a < 0) return { ok: false, canon: "", reason: "Your current page isn't in this edition." };
  const linked = IDX.l[a].includes(b) || (allowNav && IDX.v[a].includes(b));
  if (!linked) return { ok: false, canon: "", reason: "That link isn't on your current page." };
  return { ok: true, canon: IDX.t[b], reason: "" };
}

const HUBS = new Set([
  "united states", "united kingdom", "europe", "asia", "africa", "north america", "south america",
  "oceania", "antarctica", "australia", "canada", "france", "germany", "china", "india", "russia",
  "japan", "italy", "spain", "brazil", "mexico", "world war i", "world war ii", "english language",
  "latin", "greek language", "french language", "christianity", "islam", "catholic church",
]);
const BAD_RE =
  /^(List|Lists|Index|Outline|Glossary|Timeline) of |\((disambiguation|identifier)\)|^ISO \d|^\d|^(January|February|March|April|May|June|July|August|September|October|November|December) \d/i;
/** Not for a family game: anything explicit or grim never ends up as a stop on a generated route. */
const SENSITIVE_RE =
  /\b(sex\w*|penis|glans|vagin\w*|vulva|clitor\w*|anus|anal sex|genital\w*|porn\w*|erotic\w*|nud(e|ity)|naked|rape\w*|incest|masturbat\w*|orgasm\w*|prostitut\w*|fetish\w*|bdsm|condom\w*|abortion\w*|suicide|genocide|holocaust|massacre|nazi\w*|terroris\w*|murder\w*|cocaine|heroin|methamphetamine)\b/i;

function isBad(i, banned) {
  const t = IDX.t[i];
  const k = t.toLowerCase();
  return HUBS.has(k) || banned.has(i) || BAD_RE.test(t) || SENSITIVE_RE.test(t);
}

/** Breadth-first distances over body links from `start`. Banned pages can't be passed through. */
function distances(start, banned) {
  const dist = new Int16Array(IDX.t.length).fill(-1);
  dist[start] = 0;
  let frontier = [start];
  let d = 0;
  while (frontier.length && d < 8) {
    d++;
    const next = [];
    for (const a of frontier) {
      for (const b of IDX.l[a]) {
        if (dist[b] !== -1 || banned.has(b)) continue;
        dist[b] = d;
        next.push(b);
      }
    }
    frontier = next;
  }
  return dist;
}

/** Seeded random numbers (mulberry32), so the daily route is the same for everyone. */
export function rng(seed) {
  let a = 0;
  for (const c of String(seed)) a = (Math.imul(a ^ c.charCodeAt(0), 2654435761) + 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

/** A random article people will recognise, for the dice button. */
export function randomArticle(rand = Math.random) {
  if (!IDX) return { ok: false, error: "The article index isn't loaded yet." };
  const pool = IDX.good;
  for (let n = 0; n < 50; n++) {
    const i = pick(pool, rand);
    if (!isBad(i, new Set())) return { ok: true, title: IDX.t[i] };
  }
  return { ok: true, title: IDX.t[pick(pool, rand)] };
}

/** Shortest route length in clicks for each difficulty. */
const HOPS = { easy: [2, 2], medium: [3, 3], hard: [4, 6] };

/**
 * A start and a target the shortest route between which is exactly the
 * difficulty's length, worked out on the real link graph. "Doable in N" is the
 * true minimum, not a guess.
 */
export function randomRoute(level, bannedTitles = [], opts = {}) {
  if (!IDX) return { ok: false, error: "The article index isn't loaded yet." };
  const rand = opts.rand || Math.random;
  const [lo, hi] = HOPS[level] || HOPS.medium;
  const banned = new Set(bannedTitles.map(idOf).filter((i) => i >= 0));
  const starts = opts.daily ? IDX.starts : IDX.good;
  for (let attempt = 0; attempt < 60; attempt++) {
    const s = pick(starts, rand);
    if (isBad(s, banned)) continue;
    const dist = distances(s, banned);
    const cands = [];
    let best = [];
    let bestD = 0;
    for (const i of IDX.good) {
      const d = dist[i];
      if (d < lo || isBad(i, banned)) continue;
      if (d <= hi) cands.push(i);
      else if (d > bestD) {
        bestD = d;
        best = [i];
      } else if (d === bestD) best.push(i);
    }
    let pool = cands;
    // Hard routes take the farthest page when nothing lands in the range.
    if (!pool.length && level === "hard" && bestD >= lo) pool = best;
    if (!pool.length) continue;
    // Prefer targets people have heard of.
    pool.sort((a, b) => (IDX.pop[b] || 0) - (IDX.pop[a] || 0));
    const top = pool.slice(0, Math.max(12, Math.ceil(pool.length / 3)));
    const t = pick(top, rand);
    return { ok: true, start: IDX.t[s], target: IDX.t[t], hops: dist[t] };
  }
  return { ok: false, error: "Couldn't build a route. Try again." };
}

/** Mon, Wed, Sun easy. Tue, Fri medium. Thu, Sat hard. Same for everyone. */
export function dailyLevel(date) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1)).getUTCDay();
  return ["easy", "easy", "medium", "easy", "hard", "medium", "hard"][dow] || "medium";
}

/** Today's date in US Eastern time. The daily challenge rolls over at midnight there. */
export function etDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The day's route, built from a seed so every player gets the same one. */
export async function dailyRoute(date = etDate()) {
  await ready();
  const level = dailyLevel(date);
  const made = randomRoute(level, [], { daily: true, rand: rng("wikidash-daily-" + date) });
  return made.ok ? { ...made, level, date } : null;
}

/** Titles a page links to in its body. */
export function linksOf(title) {
  const i = idOf(title);
  return i < 0 ? [] : IDX.l[i].map((j) => IDX.t[j]);
}

/** One shortest route by body links, as titles from `from` to `to`, or [] when there's none. */
export function shortestPath(from, to, banned = []) {
  if (!IDX) return [];
  const a = idOf(from);
  const b = idOf(to);
  if (a < 0 || b < 0) return [];
  const ban = new Set(banned.map(idOf).filter((i) => i >= 0));
  const prev = new Map([[a, -1]]);
  let frontier = [a];
  while (frontier.length && !prev.has(b)) {
    const next = [];
    for (const x of frontier) {
      for (const y of IDX.l[x]) {
        if (prev.has(y) || (ban.has(y) && y !== b)) continue;
        prev.set(y, x);
        next.push(y);
      }
    }
    frontier = next;
  }
  if (!prev.has(b)) return [];
  const out = [];
  for (let c = b; c !== -1; c = prev.get(c)) out.unshift(IDX.t[c]);
  return out;
}

/** Fine to show on the home screen: no lists, dates or anything grim. */
export const safeTitle = (t) => !BAD_RE.test(t) && !SENSITIVE_RE.test(t);
