// After a round: which pages players shared (hub pages) and a graph of every route.

import { h, TEAM_COLORS, colorFor, icon } from "./ui.js";
import { sameTitle } from "./wiki.js";

const NS = "http://www.w3.org/2000/svg";
const NODE_W = 150;
const NODE_H = 30;
const GAP_X = 70;
const GAP_Y = 14;

function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}

const colorOf = (u) => (u.team != null ? TEAM_COLORS[u.team] : colorFor(u.key));
const trunc = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

export function buildMap(v) {
  const r = v.round;
  const units = r.order.map((k) => r.units[k]).filter((u) => u.path && u.path.length);
  const nodes = new Map();
  const edges = new Map();
  for (const u of units) {
    let cur = null;
    u.path.forEach((step, i) => {
      const k = step.t.toLowerCase();
      let n = nodes.get(k);
      if (!n) {
        n = { key: k, title: step.t, layer: i, units: new Set() };
        nodes.set(k, n);
      }
      n.layer = Math.min(n.layer, i);
      n.units.add(u.key);
      if (cur !== null && !step.back) {
        const ek = `${cur}>${k}`;
        const e = edges.get(ek) || { from: cur, to: k, units: new Set() };
        e.units.add(u.key);
        edges.set(ek, e);
      }
      cur = k;
    });
  }

  // Hub pages: visited by more than one player or team.
  const hubs = [...nodes.values()]
    .filter((n) => n.units.size >= 2 && !sameTitle(n.title, r.start) && !sameTitle(n.title, r.target))
    .sort((a, b) => b.units.size - a.units.size || a.layer - b.layer)
    .slice(0, 6);
  const who = r.mode === "teams" ? "teams" : "players";
  const hubBox = h(
    "div",
    { class: "hubs" },
    h("div", { class: "eyebrow" }, "Hub pages"),
    hubs.length
      ? h("div", { class: "chips" }, hubs.map((n) => h("span", { class: "chip hub", title: `${n.units.size} ${who} went through this page` }, n.title, h("b", null, ` ×${n.units.size}`))))
      : h("p", { class: "muted sm" }, `No page was visited by more than one of the ${who}.`),
  );

  const legend = h("div", { class: "legend" }, units.map((u) => h("span", { class: "lg" }, h("i", { style: { background: colorOf(u) } }), u.name)));

  // Layers with nothing in them are squeezed out so the graph stays compact.
  const uniq = [...new Set([...nodes.values()].map((n) => n.layer))].sort((a, b) => a - b);
  const slot = new Map(uniq.map((l, i) => [l, i]));
  const layers = uniq.map(() => []);
  for (const n of nodes.values()) layers[slot.get(n.layer)].push(n);
  const maxRows = Math.max(1, ...layers.map((l) => l.length));
  const width = layers.length * (NODE_W + GAP_X) + 20;
  const height = maxRows * (NODE_H + GAP_Y) + 30;
  layers.forEach((l, li) => {
    l.sort((a, b) => b.units.size - a.units.size);
    const off = ((maxRows - l.length) * (NODE_H + GAP_Y)) / 2;
    l.forEach((n, i) => {
      n.x = 10 + li * (NODE_W + GAP_X);
      n.y = 15 + off + i * (NODE_H + GAP_Y);
    });
  });

  const svg = s("svg", { class: "mapsvg", width, height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Map of everyone's routes" });
  const edgeLayer = s("g", { fill: "none" });
  for (const e of edges.values()) {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W;
    const y1 = a.y + NODE_H / 2;
    const x2 = b.x;
    const y2 = b.y + NODE_H / 2;
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    const solo = e.units.size === 1;
    const u = solo ? r.units[[...e.units][0]] : null;
    edgeLayer.append(
      s("path", {
        d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
        class: solo ? "edge" : "edge shared",
        pathLength: 1,
        stroke: solo && u ? colorOf(u) : "",
        "stroke-width": solo ? 2.2 : 2.2 + e.units.size,
      }),
    );
  }
  svg.append(edgeLayer);
  let nodeIdx = 0;
  for (const n of nodes.values()) {
    const isStart = sameTitle(n.title, r.start);
    const isTarget = sameTitle(n.title, r.target);
    const cls = `node${isStart ? " start" : ""}${isTarget ? " target" : ""}${n.units.size > 1 ? " shared" : ""}`;
    const g = s("g", { class: cls, transform: `translate(${n.x},${n.y})`, style: `--i:${nodeIdx++}` }, s("title", {}, n.title));
    g.append(s("rect", { width: NODE_W, height: NODE_H, rx: 8 }));
    const t = s("text", { x: 10, y: NODE_H / 2 + 4.5 });
    t.textContent = trunc(n.title, 21);
    g.append(t);
    if (n.units.size > 1) {
      g.append(s("circle", { cx: NODE_W - 4, cy: 2, r: 9, class: "badge" }));
      const c = s("text", { x: NODE_W - 4, y: 5.5, class: "badge-n", "text-anchor": "middle" });
      c.textContent = String(n.units.size);
      g.append(c);
    }
    svg.append(g);
  }

  return h("div", { class: "map-pane" }, hubBox, legend, h("div", { class: "map-wrap" }, svg), h("p", { class: "muted sm" }, "Each line is one route. Grey lines were taken by more than one."));
}
