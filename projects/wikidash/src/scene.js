// The home screen's live background: real articles from this edition drifting in clusters, joined by
// their real links, while a gold dash races along a route between them.

import * as wiki from "./wiki.js";

const FALLBACK = [
  ["Banana", ["Fruit", "Ecuador", "India", "Plant", "Potassium"]],
  ["Moon", ["Earth", "Tide", "Apollo 11", "Astronomy", "Gravity"]],
  ["Chess", ["Game", "India", "Strategy", "Mathematics", "Computer"]],
  ["Volcano", ["Lava", "Iceland", "Earthquake", "Mountain", "Plate tectonics"]],
  ["Jazz", ["Music", "New Orleans", "Blues", "Piano", "Improvisation"]],
  ["Pizza", ["Italy", "Cheese", "Bread", "Tomato", "Naples"]],
];

export function startScene(canvas) {
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let nodes = [];
  let edges = [];
  let dash = null;
  let raf = 0;
  let W = 0;
  let H = 0;
  let t0 = performance.now();
  let stopped = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function clusters() {
    if (!wiki.isReady()) return FALLBACK;
    const out = [];
    const good = [];
    for (let i = 0; i < 400 && good.length < 60; i++) {
      const t = wiki.randomArticle().title;
      if (t && !good.includes(t) && wiki.safeTitle(t)) good.push(t);
    }
    for (const hub of good) {
      const links = wiki.linksOf(hub).filter((t) => t.length < 22 && wiki.safeTitle(t));
      if (links.length < 5) continue;
      out.push([hub, links.sort(() => Math.random() - 0.5).slice(0, 6)]);
      if (out.length >= 7) break;
    }
    return out.length >= 4 ? out : FALLBACK;
  }

  function build() {
    nodes = [];
    edges = [];
    const groups = clusters();
    const cols = Math.ceil(Math.sqrt(groups.length * (W / Math.max(H, 1))));
    const rows = Math.ceil(groups.length / cols);
    groups.forEach(([hub, kids], gi) => {
      const cx = ((gi % cols) + 0.5 + (Math.random() - 0.5) * 0.4) * (W / cols);
      const cy = (Math.floor(gi / cols) + 0.5 + (Math.random() - 0.5) * 0.3) * (H / rows);
      const h = { title: hub, x: cx, y: cy, bx: cx, by: cy, r: 5, hub: true, ph: Math.random() * 6.28, glow: 0 };
      nodes.push(h);
      kids.forEach((k, i) => {
        const a = (i / kids.length) * 6.283 + Math.random() * 0.6;
        const d = Math.min(W, H) * (0.1 + Math.random() * 0.07);
        const n = { title: k, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: 3, hub: false, ph: Math.random() * 6.28, glow: 0 };
        n.bx = n.x;
        n.by = n.y;
        nodes.push(n);
        edges.push([h, n]);
      });
    });
    // clusters whose pages link to each other get a bridge, so a dash can run between them
    const hubs = nodes.filter((n) => n.hub);
    for (let i = 0; i < hubs.length; i++) {
      for (let j = i + 1; j < hubs.length; j++) {
        const linked = wiki.isReady() ? wiki.linksOf(hubs[i].title).includes(hubs[j].title) : Math.random() < 0.3;
        if (linked || Math.random() < 0.18) edges.push([hubs[i], hubs[j]]);
      }
    }
  }

  function neighbours(n) {
    const out = [];
    for (const [a, b] of edges) {
      if (a === n) out.push(b);
      else if (b === n) out.push(a);
    }
    return out;
  }

  function newDash() {
    let cur = nodes[Math.floor(Math.random() * nodes.length)];
    const path = [cur];
    for (let i = 0; i < 5; i++) {
      const next = neighbours(cur).filter((x) => !path.includes(x));
      if (!next.length) break;
      cur = next[Math.floor(Math.random() * next.length)];
      path.push(cur);
    }
    dash = path.length >= 3 ? { path, i: 0, f: 0 } : null;
  }

  function frame(now) {
    if (stopped) return;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const n of nodes) {
      n.x = n.bx + Math.sin(t * 0.25 + n.ph) * 10;
      n.y = n.by + Math.cos(t * 0.21 + n.ph * 1.3) * 8;
      n.glow = Math.max(0, n.glow - 0.008);
    }
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      ctx.strokeStyle = `rgba(170,190,255,${0.1 + Math.max(a.glow, b.glow) * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // the dash
    if (!dash && !reduced) newDash();
    if (dash) {
      const a = dash.path[dash.i];
      const b = dash.path[dash.i + 1];
      dash.f += 0.018;
      if (dash.f >= 1) {
        b.glow = 1;
        dash.i += 1;
        dash.f = 0;
        if (dash.i >= dash.path.length - 1) dash = null;
      }
      if (dash) {
        const e = dash.f < 0.5 ? 2 * dash.f * dash.f : 1 - Math.pow(-2 * dash.f + 2, 2) / 2;
        const x = a.x + (b.x - a.x) * e;
        const y = a.y + (b.y - a.y) * e;
        ctx.strokeStyle = "rgba(255,210,63,.75)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        for (let k = 0; k < dash.i; k++) {
          ctx.beginPath();
          ctx.moveTo(dash.path[k].x, dash.path[k].y);
          ctx.lineTo(dash.path[k + 1].x, dash.path[k + 1].y);
          ctx.stroke();
        }
        ctx.fillStyle = "#ffd23f";
        ctx.shadowColor = "#ffd23f";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 6.283);
        ctx.fill();
        ctx.shadowBlur = 0;
        dash.path[0].glow = 1;
      }
    }
    ctx.textAlign = "center";
    for (const n of nodes) {
      const g = n.glow;
      ctx.fillStyle = g > 0.05 ? `rgba(255,210,63,${0.5 + g * 0.5})` : n.hub ? "rgba(239,234,219,.75)" : "rgba(239,234,219,.45)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + g * 3, 0, 6.283);
      ctx.fill();
      ctx.font = `${n.hub ? 600 : 400} ${n.hub ? 16 : 13}px "Source Serif 4", Georgia, serif`;
      ctx.fillStyle = g > 0.05 ? `rgba(255,236,170,${0.55 + g * 0.45})` : `rgba(226,232,255,${n.hub ? 0.5 : 0.3})`;
      ctx.fillText(n.title, n.x, n.y - n.r - 7);
    }
    raf = requestAnimationFrame(frame);
  }

  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  resize();
  if (!wiki.isReady()) wiki.ready().then(() => !stopped && build()).catch(() => {});
  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  };
}
