import { h, clear, icon, toast } from "./ui.js";
import { isMuted, toggleMute } from "./sound.js";
import { isDark, toggleTheme } from "./theme.js";
import { ask, copyText } from "./dialog.js";

let goHome = () => {};
export function setHome(fn) {
  goHome = fn;
}

/** The wordmark. In a game it asks before leaving. */
export function brand(small = false) {
  return h(
    "button",
    {
      class: `brand${small ? " sm" : ""}`, type: "button", "aria-label": "WikiDash home",
      onclick: async () => {
        if (document.querySelector(".racebar, .topbar") && !(await ask("Leave this game and go back to the start?", { yes: "Leave" }))) return;
        goHome();
      },
    },
    h("span", { class: "b-wiki" }, "Wiki"),
    h("span", { class: "b-dash" }, "Dash"),
  );
}

export function inviteText(code) {
  return `Join my WikiDash party: open WikiDash and enter the code ${code}`;
}

export function copyInvite(code) {
  return copyText(inviteText(code), "Invite copied. Send it to your friends.", toast);
}

export function roomChip(ctx) {
  return h(
    "button",
    { class: "room-chip", type: "button", title: "Copy the party code", onclick: () => copyInvite(ctx.S.code) },
    h("span", { class: "rc-label" }, "Party"),
    h("span", { class: "rc-code" }, ctx.S.code),
    icon("copy", 15),
  );
}

export function soloChip(daily) {
  return h("span", { class: "room-chip solo" }, h("span", { class: "rc-label" }, daily ? "Daily" : "Solo"));
}

export function connDot() {
  return h("span", { class: "conn", title: "Connection" }, h("span", { class: "conn-dot" }), h("span", { class: "conn-text" }));
}

/** Sound and dark mode switches, shown in every top bar. */
export function toolButtons() {
  const snd = h("button", { class: "icon-btn sm tool", type: "button", title: "Sound on or off", "aria-label": "Sound on or off" });
  const thm = h("button", { class: "icon-btn sm tool", type: "button", title: "Light or dark mode", "aria-label": "Light or dark mode" });
  const paint = () => {
    clear(snd).append(icon(isMuted() ? "mute" : "volume", 16));
    clear(thm).append(icon(isDark() ? "sun" : "moon", 16));
  };
  snd.addEventListener("click", () => (toggleMute(), paint()));
  thm.addEventListener("click", () => (toggleTheme(), paint()));
  paint();
  return h("span", { class: "tools" }, snd, thm);
}
