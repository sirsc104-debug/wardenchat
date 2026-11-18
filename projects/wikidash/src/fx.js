// Finishes (what plays when you reach the target) and click effects (what bursts out of a link), drawn
// on one canvas over the page. Everything here is decoration: skipped for reduced motion.

import { COSMETICS } from "./wc/catalog.js";

let canvas = null;
let ctx = null;
let parts = [];
let raf = 0;
let W = 0;
let H = 0;
const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function ensure() {
  W = window.innerWidth;
  H = window.innerHeight;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "confetti";
    canvas.setAttribute("aria-hidden", "true");
    document.body.append(canvas);
    ctx = canvas.getContext("2d");
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  if (canvas.width !== Math.round(W * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function star(c, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
}
function diamond(c, r) {
  c.beginPath();
  c.moveTo(-r * 0.75, -r * 0.5);
  c.lineTo(r * 0.75, -r * 0.5);
  c.lineTo(r, -r * 0.1);
  c.lineTo(0, r);
  c.lineTo(-r, -r * 0.1);
  c.closePath();
}

function draw(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot || 0);
  ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha ?? 1));
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.stroke || p.color;
  switch (p.t) {
    case "rect":
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#14130f";
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      break;
    case "dot":
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, 6.283);
      ctx.fill();
      break;
    case "ring":
      ctx.beginPath();
      ctx.lineWidth = p.lw || 3;
      ctx.arc(0, 0, p.r, 0, 6.283);
      ctx.stroke();
      break;
    case "bubble":
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.arc(0, 0, p.r, 0, 6.283);
      ctx.stroke();
      ctx.globalAlpha *= 0.5;
      ctx.beginPath();
      ctx.arc(-p.r * 0.35, -p.r * 0.35, p.r * 0.25, 0, 6.283);
      ctx.fill();
      break;
    case "star":
      star(ctx, p.r);
      ctx.fill();
      break;
    case "diamond": {
      const g = ctx.createLinearGradient(-p.r, -p.r, p.r, p.r);
      g.addColorStop(0, "#e9fbff");
      g.addColorStop(0.5, "#7fd8ff");
      g.addColorStop(1, "#3b82f6");
      ctx.fillStyle = g;
      diamond(ctx, p.r);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#1e3a8a";
      ctx.stroke();
      break;
    }
    case "plane":
      ctx.beginPath();
      ctx.moveTo(p.r, 0);
      ctx.lineTo(-p.r, -p.r * 0.6);
      ctx.lineTo(-p.r * 0.5, 0);
      ctx.lineTo(-p.r, p.r * 0.6);
      ctx.closePath();
      ctx.fillStyle = "#fffdf6";
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "#3a372e";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.r, 0);
      ctx.lineTo(-p.r * 0.5, 0);
      ctx.stroke();
      break;
    case "blob":
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * 6.283;
        const rr = p.r * (0.8 + 0.25 * Math.sin(a * 3 + p.seed));
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.fill();
      break;
    case "bolt":
      ctx.lineWidth = 2.5;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (const [x, y] of p.pts) ctx.lineTo(x, y);
      ctx.stroke();
      break;
    case "flash": {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
      g.addColorStop(0, "rgba(255,255,255,.95)");
      g.addColorStop(0.35, p.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, 6.283);
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function frame() {
  ctx.clearRect(0, 0, W, H);
  parts = parts.filter((p) => p.age < p.life && p.y < H + 80 && p.y > -200 && p.x > -200 && p.x < W + 200);
  for (const p of parts) {
    p.age += 1;
    if (p.delay > 0) {
      p.delay -= 1;
      p.age -= 1;
      continue;
    }
    p.vy += p.g ?? 0.16;
    p.vx *= p.drag ?? 0.992;
    p.vy *= p.drag ?? 0.992;
    p.x += p.vx;
    p.y += p.vy;
    p.rot = (p.rot || 0) + (p.vr || 0);
    if (p.grow) p.r += p.grow;
    const left = p.life - p.age;
    p.alpha = p.fade ? Math.min(1, left / p.fade) : 1;
    if (p.burst && p.age === p.burst.at) {
      // a rocket bursts into sparks
      for (let i = 0; i < p.burst.n; i++) {
        const a = (i / p.burst.n) * 6.283;
        const v = rnd(2, 5.5);
        parts.push({ t: "dot", x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rnd(1.6, 3), color: pick(p.burst.colors), g: 0.05, drag: 0.975, life: 70, fade: 40, age: 0 });
      }
      p.life = p.age;
    }
    draw(p);
  }
  if (parts.length) raf = requestAnimationFrame(frame);
  else {
    canvas.remove();
    canvas = null;
    raf = 0;
  }
}
const go = () => { if (!raf) raf = requestAnimationFrame(frame); };

const CONFETTI = ["#1d3fd0", "#ffd23f", "#14130f", "#e4472b", "#f3efe5"];

/** The finish for the equipped item id (e.g. "fireworks"). big doubles it for a match win. */
export function finale(id = "confetti", { big = false } = {}) {
  if (reduced()) return;
  ensure();
  const fx = ((COSMETICS[`finale:${id}`] || {}).p || {}).fx || "confetti";
  const k = big ? 2 : 1;
  if (fx === "confetti") {
    const burst = (x, y, ang, spread, n, sp) => {
      for (let i = 0; i < n; i++) {
        const a = ang + (Math.random() - 0.5) * spread;
        const v = sp * rnd(0.55, 1.2);
        parts.push({ t: "rect", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: rnd(6, 13), h: rnd(4, 10), rot: rnd(0, 6.28), vr: rnd(-0.2, 0.2), color: pick(CONFETTI), life: 260, fade: 50, age: 0 });
      }
    };
    burst(W * 0.12, H * 0.95, -Math.PI * 0.38, 0.9, 50 * k, 17);
    burst(W * 0.88, H * 0.95, -Math.PI * 0.62, 0.9, 50 * k, 17);
    burst(W * 0.5, H * 0.3, -Math.PI / 2, Math.PI * 1.6, 40 * k, 7);
  } else if (fx === "ink") {
    for (let i = 0; i < 14 * k; i++) {
      const x = rnd(0.05, 0.95) * W;
      const y = rnd(0.08, 0.92) * H;
      const delay = Math.floor(rnd(0, 40));
      const color = pick(["#14130f", "#1d3fd0", "#3a2a6e"]);
      parts.push({ t: "blob", x, y, vx: 0, vy: 0, g: 0, r: rnd(8, 18), grow: rnd(0.6, 1.4), seed: rnd(0, 6), color, life: 90, fade: 50, age: 0, delay });
      // droplets fly off each splash
      for (let j = 0; j < 6; j++) parts.push({ t: "dot", x, y, vx: rnd(-4, 4), vy: rnd(-5, 1), r: rnd(2, 4), color, life: 60, fade: 30, age: 0, delay });
    }
  } else if (fx === "planes") {
    for (let i = 0; i < 16 * k; i++) {
      const y = rnd(0.15, 0.9) * H;
      parts.push({ t: "plane", x: -40 - rnd(0, 300), y, vx: rnd(5, 9), vy: rnd(-2.2, -0.6), g: 0.012, drag: 1, r: rnd(12, 22), rot: -0.2, color: "#fff", life: 400, fade: 40, age: 0, delay: Math.floor(rnd(0, 50)) });
    }
  } else if (fx === "fireworks") {
    const cols = [["#ffd23f", "#ff7a3c"], ["#7fd8ff", "#1d3fd0"], ["#ff6bd6", "#ffd23f"], ["#4ade80", "#fff6c8"]];
    for (let i = 0; i < 7 * k; i++) {
      parts.push({ t: "dot", x: rnd(0.15, 0.85) * W, y: H + 10, vx: rnd(-1, 1), vy: -rnd(11, 15), g: 0.18, drag: 1, r: 2.5, color: "#fff6c8", life: 999, age: 0, delay: Math.floor(i * 14 + rnd(0, 8)), burst: { at: Math.floor(rnd(38, 52)), n: 34, colors: pick(cols) } });
    }
  } else if (fx === "stars") {
    for (let i = 0; i < 70 * k; i++) parts.push({ t: "star", x: rnd(0, W), y: -rnd(10, 300), vx: rnd(-1, 1), vy: rnd(2, 5), g: 0.04, drag: 1, r: rnd(5, 11), vr: rnd(-0.08, 0.08), color: pick(["#ffd23f", "#f59e0b", "#fff6c8"]), life: 320, fade: 40, age: 0 });
  } else if (fx === "supernova") {
    parts.push({ t: "flash", x: W / 2, y: H / 2, vx: 0, vy: 0, g: 0, r: 30, grow: 14, color: "rgba(255,122,60,.6)", life: 60, fade: 45, age: 0 });
    for (let i = 0; i < 3; i++) parts.push({ t: "ring", x: W / 2, y: H / 2, vx: 0, vy: 0, g: 0, r: 10, grow: 9 + i * 3, lw: 5 - i, color: pick(["#ff6bd6", "#19f5e4", "#ffd23f"]), life: 70, fade: 50, age: 0, delay: i * 8 });
    for (let i = 0; i < 160 * k; i++) {
      const a = rnd(0, 6.283);
      const v = rnd(4, 16);
      parts.push({ t: "dot", x: W / 2, y: H / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, drag: 0.975, r: rnd(1.5, 4), color: pick(["#ff6bd6", "#19f5e4", "#ffd23f", "#fff"]), life: 110, fade: 60, age: 0 });
    }
  } else if (fx === "diamond") {
    for (let i = 0; i < 60 * k; i++) parts.push({ t: "diamond", x: rnd(0, W), y: -rnd(10, 400), vx: rnd(-0.6, 0.6), vy: rnd(2, 4.5), g: 0.03, drag: 1, r: rnd(8, 16), vr: rnd(-0.05, 0.05), color: "#7fd8ff", life: 360, fade: 40, age: 0 });
  }
  go();
}

/** A click effect at a point, for the equipped item id (e.g. "stars"). */
export function spark(id, x, y) {
  if (reduced()) return;
  const c = COSMETICS[`spark:${id}`];
  if (!c || !c.p) return;
  ensure();
  const { fx, c: cols } = c.p;
  if (fx === "ring") {
    parts.push({ t: "ring", x, y, vx: 0, vy: 0, g: 0, r: 4, grow: 1.6, lw: 2, color: cols[0], life: 22, fade: 22, age: 0 });
  } else if (fx === "dots" || fx === "flakes") {
    for (let i = 0; i < 14; i++) {
      const a = rnd(0, 6.283);
      const v = rnd(1.5, 4.5);
      parts.push({ t: fx === "flakes" ? "rect" : "dot", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: 0.14, drag: 0.96, r: rnd(1.8, 3.4), w: rnd(4, 7), h: rnd(3, 5), rot: rnd(0, 6), vr: rnd(-0.3, 0.3), color: pick(cols), life: 40, fade: 20, age: 0 });
    }
  } else if (fx === "stars") {
    for (let i = 0; i < 9; i++) {
      const a = rnd(0, 6.283);
      const v = rnd(1.5, 4);
      parts.push({ t: "star", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.12, drag: 0.96, r: rnd(3.5, 6), vr: rnd(-0.2, 0.2), color: pick(cols), life: 45, fade: 22, age: 0 });
    }
  } else if (fx === "bubbles") {
    for (let i = 0; i < 8; i++) parts.push({ t: "bubble", x: x + rnd(-10, 10), y, vx: rnd(-0.8, 0.8), vy: -rnd(0.8, 2.2), g: -0.01, drag: 0.99, r: rnd(4, 9), color: pick(cols), life: 60, fade: 25, age: 0 });
  } else if (fx === "bolts") {
    for (let i = 0; i < 5; i++) {
      const a = rnd(0, 6.283);
      const pts = [];
      let px = 0;
      let py = 0;
      for (let j = 0; j < 4; j++) {
        px += Math.cos(a) * 9 + rnd(-6, 6);
        py += Math.sin(a) * 9 + rnd(-6, 6);
        pts.push([px, py]);
      }
      parts.push({ t: "bolt", x, y, vx: 0, vy: 0, g: 0, pts, color: pick(cols), life: 16, fade: 12, age: 0 });
    }
  }
  go();
}

/** The old confetti call, kept for wins with no equipped finish. */
export function confetti({ count = 110 } = {}) {
  finale("confetti", { big: count > 200 });
}
