// Replay: every route plays side by side from the start, scaled to a watchable length.

import { h, clear, icon, avatar, fmtTime, TEAM_COLORS } from "./ui.js";
import { sameTitle } from "./wiki.js";

export function buildReplay(v) {
  const r = v.round;
  const units = r.order.map((k) => r.units[k]).filter((u) => u.path && u.path.length);
  const last = Math.max(1000, ...units.map((u) => Math.max(u.finishMs || 0, ...u.path.map((p) => p.at || 0))));
  const dur = last + 1200;
  const wall = Math.min(Math.max(dur, 8000), 26000);
  const rate = dur / wall;
  let t = 0;
  let playing = true;

  const lanes = h("div", { class: "lanes" });
  const laneEls = units.map((u) => {
    const clicks = h("span", { class: "lane-clicks" }, "0");
    const list = h("div", { class: "lane-steps" });
    const el = h(
      "div",
      { class: "lane" },
      h("div", { class: "lane-head" }, u.team != null ? h("span", { class: "avatar sm", style: { background: TEAM_COLORS[u.team] } }, u.name.charAt(5)) : avatar(u.key, u.name, "sm"), h("b", null, u.name), h("span", { class: "grow" }), clicks),
      list,
    );
    lanes.append(el);
    return { u, el, clicks, list, shown: -1 };
  });

  const clock = h("span", { class: "rp-time" }, "0:00.0");
  const range = h("input", { type: "range", min: 0, max: 1000, value: 0, class: "rp-range", "aria-label": "Replay position" });
  const playBtn = h("button", { class: "icon-btn", type: "button", title: "Play or pause" });
  const restart = h("button", { class: "icon-btn", type: "button", title: "Restart" }, icon("replay", 18));
  const paintBtn = () => clear(playBtn).append(icon(playing ? "pause" : "play", 18));

  function paint() {
    for (const L of laneEls) {
      const steps = L.u.path;
      let n = 0;
      while (n < steps.length && (steps[n].at || 0) <= t) n++;
      if (n === 0) n = 1;
      if (n === L.shown) continue;
      L.shown = n;
      clear(L.list);
      steps.slice(0, n).forEach((st, i) => {
        const isLast = i === n - 1;
        const reached = L.u.status === "won" && i === steps.length - 1 && sameTitle(st.t, r.target);
        L.list.append(h("div", { class: `lstep${st.back ? " back" : ""}${i === 0 ? " first" : ""}${isLast ? " now" : ""}${reached ? " end" : ""}` }, st.back ? icon("back", 12) : null, reached ? icon("trophy", 12) : null, st.t));
      });
      L.clicks.textContent = String(n - 1);
      L.el.classList.toggle("done", L.u.status === "won" && n === steps.length);
      L.list.scrollTop = L.list.scrollHeight;
    }
    clock.textContent = fmtTime(Math.min(t, last));
    range.value = String(Math.round((t / dur) * 1000));
  }

  playBtn.addEventListener("click", () => {
    if (t >= dur) t = 0;
    playing = !playing;
    paintBtn();
  });
  restart.addEventListener("click", () => {
    t = 0;
    playing = true;
    paintBtn();
    paint();
  });
  range.addEventListener("input", () => {
    t = (Number(range.value) / 1000) * dur;
    playing = false;
    paintBtn();
    paint();
  });

  const root = h("div", { class: "replay" }, h("div", { class: "rp-controls" }, playBtn, restart, range, clock), lanes, h("p", { class: "muted sm" }, `Playing ${rate >= 1.5 ? "at " + rate.toFixed(0) + "x speed" : rate <= 0.7 ? "in slow motion" : "in real time"}. Drag the bar to scrub.`));
  const timer = setInterval(() => {
    if (!root.isConnected) return clearInterval(timer);
    if (!playing) return;
    t += 80 * rate;
    if (t >= dur) {
      t = dur;
      playing = false;
      paintBtn();
    }
    paint();
  }, 80);
  paintBtn();
  paint();
  return root;
}
