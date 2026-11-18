// Anti-cheat while racing: find-in-page lock, back-button trap, copy/drag
// blocking and tab-leave detection. What the host turned on decides which run.

let cfg = { active: false, started: false, allowFind: true, allowBack: true, tabLeave: "off" };
let hooks = { onBack() {}, onLeave() {}, onReturn() {}, notify() {} };
let trapped = false;
let awayAt = 0;
let blurTimer = 0;

export function setHooks(next) {
  hooks = { ...hooks, ...next };
}

export function configure(next) {
  const was = cfg.active;
  cfg = { ...cfg, ...next };
  document.documentElement.classList.toggle("lockdown", cfg.active && !cfg.allowFind);
  if (cfg.active && !was) arm();
  if (!cfg.active) {
    awayAt = 0;
    clearTimeout(blurTimer);
  }
}

function arm() {
  if (!trapped) {
    try {
      history.pushState({ wd: "trap" }, "", location.href);
      trapped = true;
    } catch {
      /* the frame refused; the back button just isn't trapped */
    }
  }
}

const typing = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

window.addEventListener(
  "keydown",
  (e) => {
    if (!cfg.active || cfg.allowFind) return;
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const find = (mod && (k === "f" || k === "g")) || k === "f3" || (mod && e.shiftKey && k === "g");
    const quick = !mod && !typing(document.activeElement) && (e.key === "/" || e.key === "'");
    const copy = mod && (k === "c" || k === "a" || k === "x");
    if (find || quick || (copy && !typing(document.activeElement))) {
      e.preventDefault();
      e.stopPropagation();
      hooks.notify(find || quick ? "Find in page is off this race." : "Copying is off this race.");
    }
  },
  true,
);

for (const ev of ["copy", "cut", "contextmenu", "selectstart"]) {
  document.addEventListener(
    ev,
    (e) => {
      if (!cfg.active || cfg.allowFind || typing(e.target)) return;
      e.preventDefault();
    },
    true,
  );
}

document.addEventListener(
  "dragstart",
  (e) => {
    if (cfg.active) e.preventDefault();
  },
  true,
);
document.addEventListener(
  "auxclick",
  (e) => {
    if (cfg.active) e.preventDefault();
  },
  true,
);

window.addEventListener("popstate", () => {
  if (!cfg.active) {
    trapped = false;
    return;
  }
  try {
    history.pushState({ wd: "trap" }, "", location.href);
  } catch {
    /* ignore */
  }
  if (!cfg.started) return;
  if (cfg.allowBack) hooks.onBack();
  else hooks.notify("The back button is off this race.");
});

window.addEventListener("beforeunload", (e) => {
  if (cfg.active && cfg.started) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function watching() {
  return cfg.active && cfg.started && cfg.tabLeave !== "off";
}
function away() {
  if (!watching() || awayAt) return;
  awayAt = Date.now();
  hooks.onLeave();
}
function back() {
  clearTimeout(blurTimer);
  if (!awayAt) return;
  const ms = Date.now() - awayAt;
  awayAt = 0;
  if (cfg.active) hooks.onReturn(ms);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") away();
  else back();
});
window.addEventListener("blur", () => {
  if (!watching()) return;
  clearTimeout(blurTimer);
  blurTimer = setTimeout(away, 1500);
});
window.addEventListener("focus", back);
