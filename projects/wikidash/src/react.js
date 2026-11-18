// Reactions and quick chat. Nobody types: players tap an emoji or a short phrase.
// The ids match the server's list; the server decides what text each one means.

import { h, icon, avatar } from "./ui.js";
import { sfx } from "./sound.js";

const EMOJI = [["e0", "👍"], ["e1", "😂"], ["e2", "🔥"], ["e3", "😮"], ["e4", "😭"], ["e5", "👏"]];
const PHRASES = [["p0", "Nice one"], ["p1", "So close"], ["p2", "GG"], ["p3", "Too easy"], ["p4", "Help"], ["p5", "Oops"], ["p6", "Rematch?"], ["p7", "Wow"]];

let mounted = false;
let tray;
let fab;
let feed;

export function mountReactions(send) {
  if (mounted) return;
  mounted = true;
  const say = (id) => {
    send({ kind: "say", id });
    tray.hidden = true;
  };
  feed = h("div", { class: "bubbles", "aria-live": "polite" });
  tray = h(
    "div",
    { class: "react-tray", hidden: true },
    h("div", { class: "emoji-row" }, EMOJI.map(([id, e]) => h("button", { type: "button", class: "emoji", "aria-label": e, onclick: () => say(id) }, e))),
    h("div", { class: "phrase-row" }, PHRASES.map(([id, t]) => h("button", { type: "button", class: "phrase", onclick: () => say(id) }, t))),
  );
  fab = h("button", { class: "react-fab", type: "button", title: "Reactions", "aria-label": "Reactions", onclick: () => (tray.hidden = !tray.hidden) }, icon("smile", 22));
  document.body.append(feed, tray, fab);
}

document.addEventListener("click", (e) => {
  if (mounted && !tray.hidden && !tray.contains(e.target) && !fab.contains(e.target)) tray.hidden = true;
});

export function unmountReactions() {
  if (!mounted) return;
  mounted = false;
  feed?.remove();
  tray?.remove();
  fab?.remove();
}

export function showSay(msg) {
  if (!mounted) return;
  const big = msg.id.startsWith("e");
  const b = h("div", { class: `bubble${big ? " big" : ""}` }, avatar(msg.pid, msg.name, "sm"), h("span", { class: "b-name" }, msg.name), h("span", { class: "b-text" }, msg.text));
  if (big) floatEmoji(msg.text);
  feed.append(b);
  while (feed.children.length > 4) feed.firstChild.remove();
  requestAnimationFrame(() => b.classList.add("in"));
  sfx.pop();
  setTimeout(() => {
    b.classList.remove("in");
    setTimeout(() => b.remove(), 300);
  }, 4200);
}

/** Opens or closes the reaction tray (used by the button on the results card). */
export function toggleTray() {
  if (mounted) tray.hidden = !tray.hidden;
}

/** Emoji reactions drift up the screen so everyone sees them. */
function floatEmoji(text) {
  const el = h("span", { class: "float-emoji", style: { left: `${12 + Math.random() * 70}vw`, "--drift": `${Math.round((Math.random() - 0.5) * 120)}px` } }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}
