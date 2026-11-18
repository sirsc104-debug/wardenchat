// In-page confirm and text prompts. The artifact viewer doesn't show the
// browser's own confirm() or prompt() dialogs.

import { h } from "./ui.js";

function modal(build) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    let done = false;
    const close = (v) => {
      if (done) return;
      done = true;
      wrap.classList.remove("in");
      setTimeout(() => wrap.remove(), 160);
      document.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(null);
      }
    };
    const card = h("div", { class: "dlg-card", role: "dialog", "aria-modal": "true" });
    const wrap = h("div", { class: "dlg", onclick: (e) => e.target === wrap && close(null) }, card);
    const focus = build(card, close);
    document.body.append(wrap);
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => {
      wrap.classList.add("in");
      focus?.focus();
    });
  });
}

/** Resolves true when the player presses the confirm button. */
export function ask(message, { yes = "OK", no = "Cancel", danger = false } = {}) {
  return modal((card, close) => {
    const ok = h("button", { class: `btn ${danger ? "danger-fill" : "primary"}`, type: "button", onclick: () => close(true) }, yes);
    card.append(h("p", { class: "dlg-msg" }, message), h("div", { class: "dlg-actions" }, h("button", { class: "btn ghost", type: "button", onclick: () => close(false) }, no), ok));
    return ok;
  }).then(Boolean);
}

/** Resolves the typed text, or null when cancelled. */
export function askText(label, value = "", { yes = "Save", maxlength = 20 } = {}) {
  return modal((card, close) => {
    const input = h("input", { class: "field", id: "dlg-text", value, maxlength, autocomplete: "off" });
    input.addEventListener("keydown", (e) => e.key === "Enter" && close(input.value));
    card.append(
      h("label", { class: "lbl", for: "dlg-text" }, label),
      input,
      h("div", { class: "dlg-actions" }, h("button", { class: "btn ghost", type: "button", onclick: () => close(null) }, "Cancel"), h("button", { class: "btn primary", type: "button", onclick: () => close(input.value) }, yes)),
    );
    setTimeout(() => input.select(), 30);
    return input;
  });
}

/** Copy text, falling back to showing it selected for a manual copy. */
export async function copyText(text, okMsg, toast) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg, "ok");
  } catch {
    modal((card, close) => {
      const ta = h("textarea", { class: "field copy-box", readonly: true, rows: Math.min(10, text.split("\n").length + 1) }, text);
      card.append(h("p", { class: "dlg-msg" }, "Copy this:"), ta, h("div", { class: "dlg-actions" }, h("button", { class: "btn primary", type: "button", onclick: () => close(true) }, "Done")));
      setTimeout(() => ta.select(), 30);
      return ta;
    });
  }
}
