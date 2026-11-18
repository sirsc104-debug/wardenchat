// Small DOM helpers shared by every screen.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "style" && typeof v === "object") {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith("--")) el.style.setProperty(sk, String(sv));
          else el.style[sk] = sv;
        }
      }
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, String(v));
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

const PATHS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  find: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  door: '<path d="M14 4h5v16h-5M10 8l4 4-4 4M14 12H3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  click: '<path d="M9 3v4M3 9h4M5 5l2.5 2.5M12 12l8 3-3.5 1.5L15 20z"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>',
  swap: '<path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  graph: '<circle cx="5" cy="12" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M7 11l10-4M7 13l10 4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  skip: '<path d="M5 5l9 7-9 7zM17 5v14"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

export function icon(name, size = 18) {
  const span = document.createElement("span");
  span.className = "ic";
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ""}</svg>`;
  return span;
}

export const TEAM_COLORS = ["#d4334f", "#1f45ff", "#128a4f", "#d98e0b"];
export const TEAM_NAMES = ["Red", "Blue", "Green", "Gold"];

let lastToast = { text: "", at: 0 };
export function toast(text, kind = "info") {
  const now = Date.now();
  if (text === lastToast.text && now - lastToast.at < 1500) return;
  lastToast = { text, at: now };
  const box = document.getElementById("toasts");
  const t = h("div", { class: `toast ${kind}`, role: "status" }, text);
  box.append(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => {
    t.classList.remove("in");
    setTimeout(() => t.remove(), 300);
  }, kind === "error" ? 3800 : 2600);
}

export function fmtTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 100);
  const tenths = total % 10;
  const s = Math.floor(total / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const HUES = [222, 350, 152, 32, 280, 190, 12, 100, 300, 48];
export function colorFor(id) {
  let n = 0;
  for (const c of String(id)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${HUES[n % HUES.length]} 72% 46%)`;
}

let avatarOf = () => null;
/** Where avatar() finds a player's equipped Shop avatar (a glyph and its colour). */
export function setAvatarLookup(fn) {
  avatarOf = fn;
}

export function avatar(id, name, size = "") {
  const look = avatarOf(id);
  if (look && look.glyph) return h("span", { class: `avatar glyph ${size}`, style: { background: look.bg }, "aria-hidden": "true" }, look.glyph);
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return h("span", { class: `avatar ${size}`, style: { background: colorFor(id) }, "aria-hidden": "true" }, letter);
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
