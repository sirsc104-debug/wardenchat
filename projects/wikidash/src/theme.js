// Light and dark. Follows the viewer's theme (the artifact viewer's own setting,
// then the system's) unless the player picks one with the switch, which this
// browser remembers.

import * as store from "./store.js";

const KEY = "wd:theme";
const root = document.documentElement;
const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function wanted() {
  const saved = store.get(KEY);
  if (saved === "dark" || saved === "light") return saved === "dark";
  const host = root.getAttribute("data-theme");
  if (host === "dark" || host === "light") return host === "dark";
  return Boolean(media && media.matches);
}

function apply() {
  const dark = wanted();
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function initTheme() {
  apply();
  media?.addEventListener?.("change", apply);
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
}

export const isDark = () => root.classList.contains("dark");

export function toggleTheme() {
  const dark = !isDark();
  root.classList.add("theme-fade");
  setTimeout(() => root.classList.remove("theme-fade"), 450);
  store.set(KEY, dark ? "dark" : "light");
  apply();
  return dark;
}
