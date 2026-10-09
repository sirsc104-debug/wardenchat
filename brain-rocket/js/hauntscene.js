/* Brain Rocket — Haunted Flight (limited time): a side-on night flight with a ghost on your tail.
   The rocket flies right, on the right of the flight area; the ghost chases from the left. The
   question card sits along the bottom, so the chase gets the whole width above it.
   The game tells the scene how far the ghost is behind (setGap) and how far you've flown
   (setTarget); everything else here is how that looks. */
'use strict';

const HauntScene = (function () {
  const W = 1600, H = 900, TAU = Math.PI * 2;
  const RY = 350;            // the rocket's flight line
  const GY = 600;            // the ground line (the question card sits below it)
  const PLAY_X = 1150;       // the rocket's x while playing; it waits further left on the title screen
  const TITLE_X = 470;
  const RS = 0.8;            // rocket scale
  const PXM = 14;            // screen pixels per metre flown, for the nearest layer
  const GPX = 6.2;           // screen pixels per metre between the ghost and the rocket
  const DANGER = 40;         // metres: closer than this and the world starts to darken

  let canvas, ctx, pxScale = 1, onMilestone = null;
  const st = {};
  const parts = [], fx = [];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixc = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; };
  const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const poly = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
  const glow = (x, y, r, c, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c.replace('A', a)); g.addColorStop(1, c.replace('A', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

  // ---- The places along the way ----------------------------------------------------------
  // [sky top, horizon, moon] for each stop in HAUNT_STOPS
  const LOOK = [
    ['#1c1145', '#c4562c', '#fff1c2'], ['#1a1140', '#9a4a3a', '#ffeab0'], ['#100d2e', '#3f2a64', '#e8e6ff'],
    ['#071418', '#1c3b38', '#d8f0e8'], ['#110a24', '#2e5a2a', '#e0ffc0'], ['#08060c', '#22182a', '#bfb8d8'],
    ['#140c2a', '#4a2650', '#f0e0ff'], ['#1a0406', '#8a1414', '#ff4a2a'], ['#0a0828', '#4a2a8a', '#d8c8ff'],
    ['#04100a', '#164a2a', '#b8ffd0']
  ];
  const zoneAt = d => { let z = 0; HAUNT_STOPS.forEach((s, i) => { if (d >= s.alt) z = i; }); return z; };
  // colours blend into the next place over the last 150 m before it
  function look(d) {
    const z = zoneAt(d), next = HAUNT_STOPS[z + 1];
    const t = next ? clamp((d - (next.alt - 150)) / 150, 0, 1) : 0;
    const a = LOOK[z], b = LOOK[Math.min(z + 1, LOOK.length - 1)];
    return a.map((c, i) => mixc(c, b[i], t));
  }

  // ---- Scenery, generated in chunks along each parallax layer ------------------------------
  const LAYERS = {
    near: { p: 1, cw: 260, n: [1, 3], zones: [
      { pumpkin: 4, fence: 1.2, scarecrow: 0.6, hay: 1 }, { corn: 6, scarecrow: 0.8, pumpkin: 0.6 },
      { tomb: 4, cross: 1.5, fence: 1.5, pumpkin: 0.4 }, { stump: 1.5, mushroom: 2, tomb: 0.6, eyes: 1.5 },
      { cauldron: 1.5, mushroom: 1.5, pumpkin: 1, sign: 0.6 }, { rock: 3, stalagmite: 3, bones: 1 },
      { fence: 2.5, tomb: 1, pumpkin: 1, lamp: 1 }, { rock: 2, bush: 2, bones: 1 },
      { crystal: 2.5, wisp: 2 }, { bones: 2, flame: 2, tomb: 1.5 }] },
    mid: { p: 0.45, cw: 360, n: [1, 2], zones: [
      { tree: 1.5, barn: 0.5, deadTree: 0.8 }, { cornTall: 5 }, { deadTree: 2, crypt: 1, spire: 0.4 },
      { deadTree: 5, eyes: 1.5 }, { hut: 1, deadTree: 2 }, { stalactite: 4, arch: 1 },
      { mansion: 0.7, deadTree: 1.5 }, { deadTree: 2, wolf: 1 }, { floatRock: 2, rune: 1.5 }, { boneArch: 1, deadTree: 1.5 }] },
    sky: { p: 0.25, cw: 520, n: [0, 2], zones: [
      { bats: 2, crow: 1 }, { crow: 3, bats: 1 }, { bats: 2, crow: 1 }, { owl: 1, bats: 2 }, { witch: 1.5, bats: 1 },
      { bats: 5 }, { bats: 3, witch: 0.5 }, { bats: 2, crow: 1 }, { spirit: 3 }, { spirit: 2, bats: 1 }] }
  };
  const cache = new Map();
  function chunk(name, ci) {
    const key = name + ci;
    if (cache.has(key)) return cache.get(key);
    if (cache.size > 600) cache.clear();
    const L = LAYERS[name], seed = ci * 7919 + name.length * 131;
    const d = (ci * L.cw - PLAY_X) / (PXM * L.p);       // metres flown when this chunk passes the rocket
    const types = L.zones[zoneAt(Math.max(0, d))];
    const pairs = Object.entries(types), total = pairs.reduce((s, p) => s + p[1], 0);
    const out = [];
    const n = L.n[0] + Math.floor(hash(seed) * (L.n[1] - L.n[0] + 1));
    for (let i = 0; i < n; i++) {
      const h = k => hash(seed + i * 31 + k);
      let r = h(1) * total, type = pairs[0][0];
      for (const [t, w] of pairs) { if ((r -= w) <= 0) { type = t; break; } }
      out.push({ type, x: ci * L.cw + (i + h(2)) * L.cw / Math.max(1, n), s: 0.75 + h(3) * 0.5, seed: h(4) * 100, y: h(5) });
    }
    cache.set(key, out);
    return out;
  }
  function drawLayer(name, colour) {
    const L = LAYERS[name], off = st.cam * PXM * L.p;
    const c0 = Math.floor((off - 300) / L.cw), c1 = Math.floor((off + W + 300) / L.cw);
    for (let ci = c0; ci <= c1; ci++) for (const o of chunk(name, ci)) {
      const x = o.x - off;
      if (x < -300 || x > W + 300) continue;
      PROP[o.type](o, x, colour);
    }
  }

  // ---- Props (simple silhouettes with a few glowing bits) ----------------------------------
  const PROP = {
    pumpkin(o, x) {
      const s = o.s * 1.1, y = GY + 2;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      glow(0, -20, 60, 'rgba(255,150,40,A)', 0.25 + 0.1 * Math.sin(st.t * 6 + o.seed));
      for (const [dx, r] of [[-16, 18], [16, 18], [0, 21]]) { ctx.fillStyle = dx ? '#d4621c' : '#e8792a'; ctx.beginPath(); ctx.ellipse(dx, -20, r, 20, 0, 0, TAU); ctx.fill(); }
      rect(-3, -46, 6, 9, '#3d6a2a');
      const f = '#ffd24a';
      poly([[-14, -28], [-6, -28], [-10, -36]], f); poly([[6, -28], [14, -28], [10, -36]], f);
      poly([[-16, -16], [-10, -10], [-4, -16], [2, -10], [8, -16], [14, -10], [16, -16], [0, -4]], f);
      ctx.restore();
    },
    fence(o, x, c) { for (let i = 0; i < 6; i++) poly([[x + i * 16, GY], [x + i * 16, GY - 46], [x + i * 16 + 4, GY - 56], [x + i * 16 + 8, GY - 46], [x + i * 16 + 8, GY]], '#120c1e'); rect(x - 4, GY - 40, 100, 5, '#120c1e'); rect(x - 4, GY - 18, 100, 5, '#120c1e'); },
    scarecrow(o, x) {
      rect(x - 3, GY - 120, 6, 120, '#2a1c14'); rect(x - 40, GY - 96, 80, 6, '#2a1c14');
      poly([[x - 26, GY - 100], [x + 26, GY - 100], [x + 18, GY - 50], [x - 18, GY - 50]], '#4a2a5a');
      blob(x, GY - 116, 15, '#c98a3a'); poly([[x - 22, GY - 124], [x + 22, GY - 124], [x, GY - 152]], '#2a1c14');
      blob(x - 5, GY - 118, 2.5, '#111'); blob(x + 5, GY - 118, 2.5, '#111');
    },
    hay(o, x) { ctx.fillStyle = '#b8892a'; ctx.beginPath(); ctx.roundRect(x - 34, GY - 44, 68, 44, 8); ctx.fill(); ctx.strokeStyle = '#8a6418'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 30, GY - 34 + i * 12); ctx.lineTo(x + 30, GY - 34 + i * 12); ctx.stroke(); } },
    corn(o, x) { cornStalk(x, GY, o.s * 1.1, '#3a4a1a', '#55682a', o.seed); },
    cornTall(o, x, c) { for (let i = 0; i < 4; i++) cornStalk(x + i * 26, GY - 30, o.s * 1.4, c, c, o.seed + i); },
    tomb(o, x) {
      const s = o.s, k = Math.floor(o.seed) % 3;
      ctx.fillStyle = '#5a5870'; ctx.beginPath();
      if (k === 0) { ctx.moveTo(x - 22 * s, GY); ctx.lineTo(x - 22 * s, GY - 40 * s); ctx.arc(x, GY - 40 * s, 22 * s, Math.PI, 0); ctx.lineTo(x + 22 * s, GY); }
      else if (k === 1) ctx.rect(x - 18 * s, GY - 56 * s, 36 * s, 56 * s);
      else { ctx.moveTo(x - 26 * s, GY); ctx.lineTo(x - 22 * s, GY - 38 * s); ctx.lineTo(x, GY - 48 * s); ctx.lineTo(x + 22 * s, GY - 38 * s); ctx.lineTo(x + 26 * s, GY); }
      ctx.fill();
      ctx.fillStyle = '#3a3850'; ctx.font = `700 ${Math.round(12 * s)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('RIP', x, GY - 30 * s);
    },
    cross(o, x) { rect(x - 4, GY - 64 * o.s, 8, 64 * o.s, '#5a5870'); rect(x - 18 * o.s, GY - 50 * o.s, 36 * o.s, 8, '#5a5870'); },
    stump(o, x) { poly([[x - 22, GY], [x - 18, GY - 30], [x + 18, GY - 34], [x + 24, GY]], '#1e1610'); },
    mushroom(o, x) {
      const s = o.s;
      for (const [dx, k] of [[0, 1], [18, 0.7], [-14, 0.6]]) {
        rect(x + dx - 3 * k * s, GY - 22 * k * s, 6 * k * s, 22 * k * s, '#e8e0c8');
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(x + dx, GY - 22 * k * s, 16 * k * s, 11 * k * s, 0, Math.PI, 0); ctx.fill();
        blob(x + dx - 5 * k * s, GY - 27 * k * s, 2.5 * k * s, '#fff'); blob(x + dx + 6 * k * s, GY - 25 * k * s, 2 * k * s, '#fff');
      }
    },
    eyes(o, x) {
      const y = GY - 40 - o.y * 140, open = Math.sin(st.t * 0.9 + o.seed) > -0.85;
      if (!open) return;
      for (const dx of [-9, 9]) { glow(x + dx, y, 14, 'rgba(255,220,60,A)', 0.4); ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.ellipse(x + dx, y, 5, 3.4, 0, 0, TAU); ctx.fill(); }
    },
    cauldron(o, x) {
      glow(x, GY - 50, 70, 'rgba(120,255,90,A)', 0.35);
      ctx.fillStyle = '#16121e'; ctx.beginPath(); ctx.ellipse(x, GY - 26, 34, 28, 0, 0, TAU); ctx.fill();
      rect(x - 36, GY - 52, 72, 8, '#2a2236');
      ctx.fillStyle = '#7dff5a'; ctx.beginPath(); ctx.ellipse(x, GY - 50, 30, 6, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 3; i++) { const t2 = (st.t * 0.8 + i * 0.33 + o.seed) % 1; blob(x - 12 + i * 12, GY - 54 - t2 * 40, 5 * (1 - t2), `rgba(140,255,110,${1 - t2})`); }
      poly([[x - 26, GY - 4], [x - 20, GY + 2], [x - 32, GY + 2]], '#16121e'); poly([[x + 26, GY - 4], [x + 20, GY + 2], [x + 32, GY + 2]], '#16121e');
    },
    sign(o, x) { rect(x - 3, GY - 70, 6, 70, '#2a1c14'); poly([[x - 4, GY - 66], [x + 54, GY - 66], [x + 64, GY - 56], [x + 54, GY - 46], [x - 4, GY - 46]], '#4a3420'); ctx.fillStyle = '#e8d4a8'; ctx.font = '700 11px Fredoka, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('BEWARE', x + 4, GY - 52); },
    rock(o, x) { poly([[x - 40 * o.s, GY], [x - 30 * o.s, GY - 30 * o.s], [x - 4, GY - 44 * o.s], [x + 26 * o.s, GY - 26 * o.s], [x + 40 * o.s, GY]], '#1a1622'); },
    stalagmite(o, x) { poly([[x - 16 * o.s, GY], [x, GY - 90 * o.s], [x + 16 * o.s, GY]], '#221c2a'); poly([[x + 14, GY], [x + 24, GY - 50 * o.s], [x + 34, GY]], '#1a1622'); },
    bones(o, x) {
      ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 20, GY - 4); ctx.lineTo(x + 16, GY - 12); ctx.stroke();
      for (const [bx, by] of [[x - 20, GY - 4], [x + 16, GY - 12]]) { blob(bx - 2, by - 3, 4, '#d8d0b8'); blob(bx + 2, by + 3, 4, '#d8d0b8'); }
      blob(x + 30, GY - 14, 13, '#e8e0c8'); rect(x + 22, GY - 8, 16, 8, '#e8e0c8');
      blob(x + 25, GY - 15, 3.5, '#111'); blob(x + 35, GY - 15, 3.5, '#111');
    },
    lamp(o, x) { rect(x - 3, GY - 110, 6, 110, '#16121e'); rect(x - 10, GY - 126, 20, 18, '#16121e'); const on = Math.sin(st.t * 13 + o.seed) > -0.7; if (on) { glow(x, GY - 117, 50, 'rgba(255,220,140,A)', 0.4); rect(x - 6, GY - 122, 12, 10, '#ffe7a0'); } },
    bush(o, x) { ctx.strokeStyle = '#120c14'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.35; ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x + Math.cos(a) * 50 * o.s, GY + Math.sin(a) * 50 * o.s); ctx.stroke(); } },
    crystal(o, x) { glow(x, GY - 30, 60, 'rgba(180,120,255,A)', 0.3); for (const [dx, h, w] of [[0, 70, 14], [-16, 44, 10], [16, 52, 10]]) poly([[x + dx - w, GY], [x + dx, GY - h * o.s], [x + dx + w, GY]], '#9a6aff'); },
    wisp(o, x) { const y = GY - 30 - Math.sin(st.t * 2 + o.seed) * 14; glow(x, y, 26, 'rgba(160,220,255,A)', 0.6); blob(x, y, 6, '#e8f8ff'); },
    flame(o, x) {
      const f = 1 + Math.sin(st.t * 14 + o.seed) * 0.15;
      glow(x, GY - 26, 50, 'rgba(90,255,140,A)', 0.4);
      poly([[x - 14, GY], [x - 8, GY - 40 * f], [x, GY - 22], [x + 6, GY - 50 * f], [x + 14, GY]], '#5aff8a');
      rect(x - 16, GY - 4, 32, 6, '#2a2a2a');
    },
    tree(o, x, c) { rect(x - 6, GY - 110 * o.s, 12, 110 * o.s, c); blob(x, GY - 120 * o.s, 40 * o.s, c); blob(x - 26 * o.s, GY - 100 * o.s, 30 * o.s, c); blob(x + 26 * o.s, GY - 104 * o.s, 30 * o.s, c); },
    barn(o, x, c) { poly([[x - 60, GY - 30], [x - 60, GY - 110], [x, GY - 160], [x + 60, GY - 110], [x + 60, GY - 30]], c); rect(x - 10, GY - 120, 20, 22, '#ffb24a'); },
    deadTree(o, x, c) { deadTree(x, GY - 26, o.s * 1.2, c, o.seed); },
    crypt(o, x, c) { poly([[x - 50, GY - 26], [x - 50, GY - 100], [x, GY - 140], [x + 50, GY - 100], [x + 50, GY - 26]], c); rect(x - 14, GY - 80, 28, 54, '#0c0812'); rect(x - 3, GY - 160, 6, 24, c); rect(x - 11, GY - 152, 22, 6, c); },
    spire(o, x, c) { poly([[x - 30, GY - 26], [x - 30, GY - 160], [x, GY - 260], [x + 30, GY - 160], [x + 30, GY - 26]], c); rect(x - 8, GY - 140, 16, 26, '#ffcf6a'); },
    hut(o, x, c) {
      poly([[x - 50, GY - 26], [x - 44, GY - 100], [x + 46, GY - 96], [x + 52, GY - 26]], c);
      poly([[x - 64, GY - 96], [x + 6, GY - 190], [x + 64, GY - 92]], c);
      rect(x + 10, GY - 80, 22, 22, '#9aff6a'); glow(x + 21, GY - 69, 40, 'rgba(150,255,100,A)', 0.35);
      rect(x - 30, GY - 200, 12, 50, c);
    },
    stalactite(o, x, c) { const top = 110; for (let i = 0; i < 5; i++) poly([[x + i * 30 - 12, top], [x + i * 30, top + (60 + hash(o.seed + i) * 120) * o.s], [x + i * 30 + 12, top]], c); rect(x - 20, 0, 170, top, c); },
    arch(o, x, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 90, GY - 26); ctx.lineTo(x - 80, GY - 180); ctx.quadraticCurveTo(x, GY - 280, x + 80, GY - 180); ctx.lineTo(x + 90, GY - 26); ctx.lineTo(x + 50, GY - 26); ctx.quadraticCurveTo(x + 40, GY - 190, x, GY - 200); ctx.quadraticCurveTo(x - 40, GY - 190, x - 50, GY - 26); ctx.fill(); },
    mansion(o, x, c) {
      poly([[x - 150, GY - 26], [x - 150, GY - 170], [x - 110, GY - 200], [x - 70, GY - 170], [x - 70, GY - 210], [x, GY - 280], [x + 70, GY - 210], [x + 70, GY - 170], [x + 110, GY - 230], [x + 150, GY - 170], [x + 150, GY - 26]], c);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
        if (hash(o.seed + r * 7 + k) < 0.45) continue;
        const flick = Math.sin(st.t * 3 + r + k * 2) > -0.9;
        rect(x - 126 + k * 46, GY - 150 + r * 40, 18, 24, flick ? '#ffcf6a' : '#3a2a20');
      }
      rect(x - 14, GY - 70, 28, 44, '#0c0812');
    },
    wolf(o, x, c) {
      poly([[x - 70, GY - 26], [x - 50, GY - 90], [x + 10, GY - 110], [x + 60, GY - 70], [x + 80, GY - 26]], c);
      ctx.save(); ctx.translate(x + 4, GY - 108); ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, -14, 26, 12, -0.2, 0, TAU); ctx.fill();
      poly([[16, -22], [34, -64], [40, -58], [30, -20]], c); poly([[30, -60], [36, -76], [42, -62]], c); poly([[34, -66], [52, -70], [40, -58]], c);
      poly([[-18, -10], [-20, 6], [-14, 6], [-10, -8]], c); poly([[10, -8], [10, 6], [16, 6], [16, -10]], c); poly([[-24, -16], [-48, -6], [-26, -8]], c);
      ctx.restore();
    },
    floatRock(o, x, c) { const y = GY - 140 - o.y * 140 + Math.sin(st.t + o.seed) * 10; poly([[x - 50, y], [x + 50, y], [x + 20, y + 60], [x - 14, y + 70]], c); glow(x, y - 10, 50, 'rgba(180,140,255,A)', 0.2); },
    rune(o, x, c) { rect(x - 18, GY - 120, 36, 94, c); ctx.strokeStyle = `rgba(190,150,255,${0.5 + 0.4 * Math.sin(st.t * 2 + o.seed)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 8, GY - 100); ctx.lineTo(x + 8, GY - 80); ctx.lineTo(x - 8, GY - 60); ctx.moveTo(x, GY - 104); ctx.lineTo(x, GY - 54); ctx.stroke(); },
    boneArch(o, x) {
      ctx.strokeStyle = '#c8c0a8'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 80, GY - 26); ctx.quadraticCurveTo(x - 90, GY - 230, x, GY - 240); ctx.quadraticCurveTo(x + 90, GY - 230, x + 80, GY - 26); ctx.stroke();
      blob(x, GY - 250, 22, '#d8d0b8'); blob(x - 7, GY - 252, 5, '#111'); blob(x + 7, GY - 252, 5, '#111');
      glow(x - 7, GY - 252, 10, 'rgba(120,255,150,A)', 0.8); glow(x + 7, GY - 252, 10, 'rgba(120,255,150,A)', 0.8);
    },
    bats(o, x) { const y = 150 + o.y * 220; for (let i = 0; i < 3; i++) drawBat(x + i * 34 + Math.sin(st.t * 2 + i) * 8, y + (i % 2) * 18 + Math.sin(st.t * 3 + i + o.seed) * 10, 0.8 * o.s, o.seed + i); },
    crow(o, x) { const y = 160 + o.y * 200, f = Math.sin(st.t * 9 + o.seed) * 10; ctx.fillStyle = '#0c0a12'; ctx.beginPath(); ctx.ellipse(x, y, 16, 6, 0, 0, TAU); ctx.fill(); poly([[x - 4, y], [x + 4, y - 22 - f], [x + 10, y]], '#0c0a12'); poly([[x + 14, y - 2], [x + 22, y], [x + 14, y + 2]], '#d8a020'); },
    owl(o, x) { const y = 180 + o.y * 160, f = Math.sin(st.t * 7 + o.seed) * 14; ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.ellipse(x, y, 16, 20, 0, 0, TAU); ctx.fill(); poly([[x - 12, y], [x - 40, y - 12 - f], [x - 6, y + 10]], '#3a2a20'); poly([[x + 12, y], [x + 40, y - 12 - f], [x + 6, y + 10]], '#3a2a20'); blob(x - 6, y - 8, 5, '#ffd23f'); blob(x + 6, y - 8, 5, '#ffd23f'); blob(x - 6, y - 8, 2, '#111'); blob(x + 6, y - 8, 2, '#111'); },
    witch(o, x) {
      const y = 170 + o.y * 160 + Math.sin(st.t * 1.5 + o.seed) * 14;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08);
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, 6); ctx.lineTo(40, 0); ctx.stroke();
      poly([[-40, 6], [-60, -4], [-62, 14]], '#a07a3a');
      poly([[-10, 2], [8, 2], [4, -30], [-6, -30]], '#16121e');
      blob(0, -36, 8, '#7ac860'); poly([[-12, -40], [12, -40], [4, -70]], '#16121e'); rect(-16, -42, 32, 4, '#16121e');
      poly([[8, -38], [16, -34], [8, -32]], '#7ac860');
      ctx.restore();
    },
    spirit(o, x) { const y = 150 + o.y * 240 + Math.sin(st.t * 1.4 + o.seed) * 20; glow(x, y, 40, 'rgba(170,200,255,A)', 0.45); ctx.fillStyle = 'rgba(230,240,255,0.7)'; ctx.beginPath(); ctx.arc(x, y, 12, Math.PI, 0); ctx.lineTo(x + 12, y + 18); ctx.lineTo(x - 12, y + 18); ctx.fill(); }
  };
  function cornStalk(x, y, s, stem, leaf, seed) {
    const sw = Math.sin(st.t * 1.2 + seed) * 4;
    ctx.strokeStyle = stem; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw, y - 60 * s, x + sw * 2, y - 120 * s); ctx.stroke();
    ctx.fillStyle = leaf;
    for (let i = 0; i < 4; i++) { const ly = y - 30 * s - i * 24 * s, d = i % 2 ? 1 : -1; ctx.beginPath(); ctx.ellipse(x + d * 16 * s + sw, ly, 20 * s, 5 * s, d * 0.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#d8b43a'; ctx.beginPath(); ctx.ellipse(x + 6 * s + sw, y - 70 * s, 5 * s, 12 * s, 0.3, 0, TAU); ctx.fill();
  }
  function deadTree(x, y, s, c, seed) {
    ctx.strokeStyle = c; ctx.lineCap = 'round';
    const branch = (bx, by, len, ang, w, depth) => {
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      if (depth <= 0) return;
      branch(ex, ey, len * 0.7, ang - 0.5 - hash(seed + depth) * 0.3, w * 0.65, depth - 1);
      branch(ex, ey, len * 0.66, ang + 0.45 + hash(seed + depth * 3) * 0.3, w * 0.62, depth - 1);
    };
    branch(x, y, 80 * s, -Math.PI / 2, 14 * s, 3);
  }
  function drawBat(x, y, s, seed) {
    const f = Math.sin(st.t * 14 + seed);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#0a0810';
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 8, 0, 0, TAU); ctx.fill();
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(d * 14, -14 * f - 6, d * 28, -8 * f); ctx.quadraticCurveTo(d * 20, 0, d * 22, 6); ctx.quadraticCurveTo(d * 12, 2, 0, 4); ctx.fill(); }
    poly([[-4, -6], [-6, -13], [-1, -7]], '#0a0810'); poly([[4, -6], [6, -13], [1, -7]], '#0a0810');
    ctx.restore();
  }

  // ---- The rocket, lying on its side and pointing right ----------------------------------
  function drawFlame(len, w) {
    const f = 1 + Math.sin(st.t * 40) * 0.08 + Math.sin(st.t * 23) * 0.06, L = len * f;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, L * 0.3, 0, 0, L * 0.3, L * 0.9);
    g.addColorStop(0, '#ff8a2a88'); g.addColorStop(1, '#ff8a2a00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, L * 0.3, L * 0.9, 0, TAU); ctx.fill();
    const layer = (ww, ll, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-ww, 0); ctx.quadraticCurveTo(-ww * 1.1, ll * 0.45, 0, ll); ctx.quadraticCurveTo(ww * 1.1, ll * 0.45, ww, 0); ctx.closePath(); ctx.fill(); };
    layer(w, L, '#ff7a1a'); layer(w * 0.65, L * 0.72, '#ffd23f'); layer(w * 0.3, L * 0.4, '#ffffff');
    ctx.restore();
  }
  function drawRocket(x, y, rot, thrust, sad) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(RS, RS); ctx.rotate(Math.PI / 2); ctx.translate(0, 100);
    if (thrust > 0.02) drawFlame(30 + thrust * 150, 15 + thrust * 8);
    const fin = d => {
      ctx.fillStyle = '#e8364f'; ctx.beginPath(); ctx.moveTo(d * 32, -70); ctx.lineTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 30, -16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8243b'; ctx.beginPath(); ctx.moveTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 56, 2); ctx.closePath(); ctx.fill();
    };
    fin(-1); fin(1);
    const ng = ctx.createLinearGradient(-26, 0, 26, 0);
    ng.addColorStop(0, '#4a5060'); ng.addColorStop(0.5, '#9aa2b4'); ng.addColorStop(1, '#3e4352');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(18, -18); ctx.lineTo(25, 0); ctx.lineTo(-25, 0); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-31, -16); ctx.lineTo(-35, -110); ctx.quadraticCurveTo(-35, -165, 0, -200); ctx.quadraticCurveTo(35, -165, 35, -110); ctx.lineTo(31, -16); ctx.closePath();
    const bg = ctx.createLinearGradient(-35, 0, 35, 0);
    bg.addColorStop(0, '#b9c1d4'); bg.addColorStop(0.35, '#ffffff'); bg.addColorStop(1, '#a7b0c4');
    ctx.fillStyle = bg; ctx.fill(); ctx.clip();
    rect(-40, -210, 80, 62, '#e8364f'); rect(-20, -210, 10, 62, 'rgba(255,255,255,0.25)');
    rect(-40, -46, 80, 10, '#e8364f'); rect(-40, -34, 80, 4, '#2a3350');
    ctx.restore();
    blob(0, -105, 19, '#7b8499');
    const wg = ctx.createRadialGradient(-5, -110, 2, 0, -105, 15);
    wg.addColorStop(0, '#7fd3ff'); wg.addColorStop(1, '#173a8a');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, -105, 14, 0, TAU); ctx.fill();
    blob(0, -101, 6.5, '#ffd7a8');
    blob(-2.3, -102, 1.1, '#222'); blob(2.3, -102, 1.1, '#222');
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath();
    if (sad) ctx.arc(0, -96.5, 2, Math.PI * 1.15, Math.PI * 1.85); else ctx.arc(0, -100.5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    rect(-4, -60, 8, 66, '#c62a42');
    ctx.restore();
  }

  // ---- The ghost --------------------------------------------------------------------------
  // p: how close it is (0 far, 1 touching). reach: how far its arms stretch toward the rocket.
  function drawGhost(x, y, scale, alpha, p, hands) {
    if (alpha <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
    glow(0, 0, 190, 'rgba(170,255,225,A)', 0.18 + 0.22 * p);
    const w1 = Math.sin(st.t * 3) * 10, w2 = Math.sin(st.t * 3 + 1.4) * 8;
    const g = ctx.createLinearGradient(0, -90, 0, 70);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfe6ff');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(66, 30); ctx.lineTo(72, -20);
    ctx.arc(0, -20, 72, 0, Math.PI, true);
    ctx.bezierCurveTo(-110, -6, -150, w1, -215, 12 + w1);
    ctx.bezierCurveTo(-170, 40 + w2, -135, 52, -100, 58 + w2);
    for (let i = 0; i < 4; i++) { const x0 = -100 + i * 41.5; ctx.quadraticCurveTo(x0 + 20, 84 + Math.sin(st.t * 5 + i) * 6, x0 + 41.5, 58); }
    ctx.closePath(); ctx.fill();
    // face: eyes look toward the rocket and glow as it closes in
    const eye = (ex, ey) => {
      ctx.fillStyle = '#141420'; ctx.beginPath(); ctx.ellipse(ex, ey, 10, 15, 0, 0, TAU); ctx.fill();
      if (p > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ex, ey, 26 + 20 * p, 'rgba(255,60,30,A)', 0.9 * p);
        ctx.fillStyle = `rgba(255,${Math.round(200 - 120 * p)},80,${p})`; ctx.beginPath(); ctx.ellipse(ex + 2, ey, 5, 8, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    };
    eye(16, -34); eye(46, -36);
    ctx.fillStyle = '#141420'; ctx.beginPath(); ctx.ellipse(36, 4, 9 + 12 * p, 10 + 16 * p, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // arms reaching for the rocket's fins
    if (hands) for (const [ox, oy, hx, hy] of hands) {
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#eaf4ff'; ctx.lineCap = 'round';
      const mx = (ox + hx) / 2, my = (oy + hy) / 2 + Math.sin(st.t * 6 + ox) * 10;
      ctx.lineWidth = 16 * scale; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
      ctx.lineWidth = 5 * scale;
      for (let f = -1; f <= 1; f++) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 14 * scale, hy + f * 8 * scale + Math.sin(st.t * 9 + f) * 2); ctx.stroke(); }
      ctx.restore();
    }
  }

  // ---- State ----------------------------------------------------------------------------
  function reset() {
    Object.assign(st, {
      t: st.t || 0, cam: 0, target: 0,
      gap: 60, disp: 60, idle: true, title: true, rx: TITLE_X,
      thrust: 0.5, kick: 0, surge: 0, shake: 0, flash: 0, pulse: 0, grasp: 0, poof: null, streak: 0,
      dead: false, deadT: 0, crash: null, vel: 0
    });
    parts.length = 0; fx.length = 0;
  }
  reset();

  const danger = () => (st.title ? 0 : clamp(1 - st.disp / DANGER, 0, 1));
  const ghostPos = () => {
    let x = st.rx - 165 - st.disp * GPX, y = RY + 10 + Math.sin(st.t * 2.1) * 12;
    if (st.dead) { const w = clamp(st.deadT / 0.9, 0, 1); x = lerp(x, st.rx - 30, w); y = lerp(y, RY + 4, w); }
    return { x, y };
  };
  function rocketPose() {
    let x = st.rx + st.surge, y = RY + Math.sin(st.t * 1.7) * 7, rot = Math.sin(st.t * 1.3) * 0.03;
    const p = danger();
    if (p > 0.6 && !st.dead) { x += rand(-2, 2) * p; y += rand(-2, 2) * p; }
    if (st.dead && st.deadT > 1.3) { const k = st.deadT - 1.3; y += k * k * 50; rot += k * 0.25; }
    if (st.crash) {
      const c = st.crash;
      rot = Math.PI * clamp(c.t / 0.6, 0, 1);
      if (c.t > 0.6) x = st.rx - (c.t - 0.6) * 1100;
    }
    return { x, y, rot };
  }
  function handsFor(g, pose) {
    const r = clamp(1 - st.disp / 22, 0, 1) * (1 - st.grasp);
    if (r <= 0 && !st.dead) return null;
    const out = [];
    for (const [oy, fy] of [[-8, -34], [22, 34]]) {
      const ox = g.x + 58, oyy = g.y + oy, tx = pose.x - 76, ty = pose.y + fy;
      const d = Math.hypot(tx - ox, ty - oyy), reach = st.dead ? d : Math.min(d, 30 + r * 130);
      out.push([ox, oyy, ox + (tx - ox) * reach / d, oyy + (ty - oyy) * reach / d]);
    }
    return out;
  }

  // ---- Update -------------------------------------------------------------------------------
  function update(dt) {
    st.t += dt;
    const prev = st.cam;
    if (st.idle) { st.target += 12 * dt; st.gap = 34 + Math.sin(st.t * 0.5) * 14; }
    if (!st.crash) st.cam += (st.target - st.cam) * (1 - Math.exp(-dt * 3));
    st.vel = dt > 0 ? (st.cam - prev) * PXM / dt : 0;
    st.rx += ((st.title ? TITLE_X : PLAY_X) - st.rx) * (1 - Math.exp(-dt * 2.2));
    // the ghost's drawn distance follows the real one: quickly as it closes in, smoothly as you pull away
    const k = st.gap < st.disp ? 10 : 2.6;
    st.disp += (st.gap - st.disp) * (1 - Math.exp(-dt * k));
    st.kick = Math.max(0, st.kick - dt * 1.4);
    st.surge *= Math.exp(-dt * 2.5);
    st.shake = Math.max(0, st.shake - dt * 2.5);
    st.flash = Math.max(0, st.flash - dt * 2.2);
    st.pulse = Math.max(0, st.pulse - dt * 3);
    st.grasp = Math.max(0, st.grasp - dt * 1.4);
    if (st.poof) { st.poof.t += dt; if (st.poof.t > 1.2) st.poof = null; }
    st.thrust = st.dead ? (st.deadT < 1.3 ? (Math.random() < 0.5 ? 0 : rand(0.1, 0.5)) : 0) : 0.45 + st.kick * 0.55;
    if (st.dead) st.deadT += dt;
    if (st.crash) updateCrash(dt);
    for (const s of HAUNT_STOPS) if (s.alt > 0 && prev < s.alt && st.cam >= s.alt && onMilestone && !st.idle) onMilestone(s);
    emit(dt);
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += (q.g || 0) * dt;
      q.x += q.vx * dt - (q.scroll ? st.vel * dt : 0); q.y += q.vy * dt;
      if (q.k === 'smoke' || q.k === 'wisp') q.size += 14 * dt;
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      if (f.k === 'confetti') { f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; f.vx *= 0.99; }
    }
  }
  function updateCrash(dt) {
    const c = st.crash;
    c.t += dt;
    if (c.boom) { c.since += dt; return; }
    const g = ghostPos();
    if (c.t > 0.6 && rocketPose().x <= g.x + 70) {
      c.boom = true; c.since = 0; st.flash = 1; st.shake = 1.2;
      for (let i = 0; i < 60; i++) { const a = rand(0, TAU), sp = rand(120, 520); parts.push({ k: 'spark', x: g.x + 40, y: g.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: rand(0.5, 1), max: 1, size: rand(2, 5), color: Math.random() < 0.5 ? '#ffb24a' : '#ffe9a0' }); }
      fx.push({ k: 'ring', x: g.x + 40, y: g.y, r: 360, life: 0.7, max: 0.7, color: '#ffd9a0' });
    }
  }
  function emit(dt) {
    const pose = rocketPose();
    if (!(st.crash && st.crash.boom) && st.thrust > 0.05 && Math.random() < dt * 40) {
      const nx = pose.x - Math.cos(pose.rot) * 92, ny = pose.y - Math.sin(pose.rot) * 92;
      parts.push({ k: 'smoke', x: nx, y: ny + rand(-6, 6), vx: -rand(60, 140), vy: rand(-20, 20), life: rand(0.6, 1.1), max: 1.1, size: rand(8, 14), color: '#8a7aa8', scroll: true });
    }
    if (st.kick > 0.3 && Math.random() < dt * 40) parts.push({ k: 'line', x: rand(0, W), y: rand(130, GY - 20), vx: -2400, vy: 0, life: 0.5, max: 0.5, size: 2, color: 'rgba(255,255,255,0.35)' });
    const g = ghostPos();
    if (!st.poof && Math.random() < dt * 14) parts.push({ k: 'wisp', x: g.x - 180, y: g.y + rand(-10, 30), vx: -rand(40, 90), vy: rand(-15, 15), life: rand(0.8, 1.4), max: 1.4, size: rand(6, 12), color: '#d8ecff', scroll: true });
  }

  // ---- Draw ---------------------------------------------------------------------------------
  function draw() {
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    if (st.shake) ctx.translate((Math.random() - 0.5) * st.shake * 16, (Math.random() - 0.5) * st.shake * 16);
    const [top, horizon, moon] = look(st.cam);
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, top); sky.addColorStop(1, horizon);
    rect(-30, -30, W + 60, GY + 30, sky);
    // stars
    for (let i = 0; i < 110; i++) {
      const x = ((hash(i) * W * 1.2 - st.cam * PXM * 0.02) % (W + 40) + W + 40) % (W + 40) - 20, y = hash(i + 500) * (GY - 200);
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(st.t * (0.5 + hash(i + 9)) + i)); blob(x, y, hash(i + 77) * 1.6 + 0.4, '#fff');
    }
    ctx.globalAlpha = 1;
    // the moon
    const mx = 300, my = 220;
    glow(mx, my, 220, `rgba(${moon.match(/\d+/g).slice(0, 3).join(',')},A)`, 0.35);
    blob(mx, my, 74, moon);
    for (const [dx, dy, r] of [[-22, -14, 14], [18, 20, 18], [26, -26, 9], [-8, 30, 8]]) blob(mx + dx, my + dy, r, 'rgba(0,0,0,0.08)');
    // far hills
    const far = mixc(hexOf(horizon), '#06040c', 0.55);
    ctx.fillStyle = far; ctx.beginPath(); ctx.moveTo(-20, GY);
    const fo = st.cam * PXM * 0.12;
    for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, GY - 70 - 70 * noise((x + fo) * 0.004) - 30 * noise((x + fo) * 0.013 + 9));
    ctx.lineTo(W + 20, GY); ctx.fill();
    drawLayer('sky', null);
    // middle ridge and its scenery
    const midC = mixc(hexOf(horizon), '#05030a', 0.75);
    drawLayer('mid', midC);
    ctx.fillStyle = midC; ctx.beginPath(); ctx.moveTo(-20, GY);
    const mo = st.cam * PXM * 0.45;
    for (let x = -20; x <= W + 20; x += 16) ctx.lineTo(x, GY - 22 - 14 * noise((x + mo) * 0.01));
    ctx.lineTo(W + 20, GY); ctx.fill();
    // fog
    for (let i = 0; i < 3; i++) {
      const fx2 = ((i * 600 - (st.cam * PXM * 0.6 + st.t * 20) % 1800) + 1800) % 1800 - 300;
      ctx.fillStyle = 'rgba(210,200,255,0.07)'; ctx.beginPath(); ctx.ellipse(fx2, GY - 20, 420, 40, 0, 0, TAU); ctx.fill();
    }
    // the ground and the near scenery
    rect(-30, GY, W + 60, H - GY + 30, '#0b0812');
    drawLayer('near', null);
    // smoke and wisps behind everything that flies
    for (const q of parts) {
      if (q.k !== 'smoke' && q.k !== 'wisp') continue;
      ctx.globalAlpha = (q.life / q.max) * (q.k === 'wisp' ? 0.45 : 0.3); blob(q.x, q.y, q.size, q.color);
    }
    ctx.globalAlpha = 1;
    const pose = rocketPose(), g = ghostPos(), p = danger();
    let ga = 1;
    if (st.poof) ga = st.poof.t < 0.5 ? 0 : clamp((st.poof.t - 0.5) / 0.6, 0, 1);
    if (st.crash && st.crash.boom) ga = 1;
    const hands = st.crash ? null : handsFor(g, pose);
    const scale = st.dead ? lerp(1, 1.3, clamp(st.deadT / 0.9, 0, 1)) : 1 + (st.crash && st.crash.boom ? Math.max(0, 0.25 - st.crash.since * 0.2) : 0);
    if (!st.dead) drawGhost(g.x, g.y, scale, ga, Math.max(p, st.crash ? 1 : 0), null);
    const hidden = st.crash && st.crash.boom;
    if (!hidden) drawRocket(pose.x, pose.y, pose.rot, st.thrust, st.dead || !!st.crash || p > 0.7);
    // the ghost wraps around the rocket when it catches you; otherwise only its hands reach over
    if (st.dead) drawGhost(g.x, g.y, scale, 0.62, 1, hands);
    else if (hands && ga > 0.5) drawHands(hands, ga);
    // sparks and speed lines
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of parts) {
      const a = q.life / q.max;
      if (q.k === 'spark') { ctx.globalAlpha = a; blob(q.x, q.y, q.size, q.color); }
      else if (q.k === 'line') { ctx.globalAlpha = a; rect(q.x, q.y, 90, 2, q.color); }
      else if (q.k === 'burstWisp') { ctx.globalAlpha = a * 0.8; blob(q.x, q.y, q.size, q.color); }
    }
    ctx.restore(); ctx.globalAlpha = 1;
    // the closer the ghost, the darker the world; a red pulse with each heartbeat
    if (p > 0) {
      rect(-30, -30, W + 60, H + 60, `rgba(4,0,10,${0.32 * p})`);
      const v = ctx.createRadialGradient(pose.x - 200, RY, 200, pose.x - 200, RY, 1100);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(${Math.round(60 * st.pulse)},0,0,${0.55 * p + 0.25 * st.pulse * p})`);
      rect(-30, -30, W + 60, H + 60, v);
    }
    if (st.dead) rect(-30, -30, W + 60, H + 60, `rgba(0,0,8,${Math.min(0.55, st.deadT * 0.3)})`);
    for (const f of fx) {
      if (f.k === 'confetti') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color;
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h * Math.abs(Math.cos(f.rot * 2))); ctx.restore();
      } else if (f.k === 'ring') {
        const a = f.life / f.max;
        ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = 6 * a;
        ctx.beginPath(); ctx.arc(f.x, f.y, (1 - a) * f.r + 10, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    if (st.flash > 0) rect(-30, -30, W + 60, H + 60, `rgba(255,255,255,${st.flash * 0.5})`);
  }
  function drawHands(hands, a) {
    ctx.save(); ctx.globalAlpha = a;
    for (const [ox, oy, hx, hy] of hands) {
      ctx.strokeStyle = '#eaf4ff'; ctx.lineCap = 'round';
      const mx = (ox + hx) / 2, my = (oy + hy) / 2 + Math.sin(st.t * 6 + ox) * 10;
      ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
      ctx.lineWidth = 5;
      for (let f = -1; f <= 1; f++) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 14, hy + f * 8 + Math.sin(st.t * 9 + f) * 2); ctx.stroke(); }
    }
    ctx.restore();
  }
  // look() returns rgb() strings; the glow helpers want hex
  const hexOf = c => { const m = c.match(/\d+/g); return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : c; };

  // ---- Public API (the same shape as the other worlds, plus the chase) -----------------------
  return {
    W, H,
    init(c) { canvas = c; ctx = c.getContext('2d'); },
    resize(stageScale) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pxScale = stageScale * dpr;
      if (canvas) { canvas.width = Math.round(W * pxScale); canvas.height = Math.round(H * pxScale); }
    },
    update, draw, reset,
    get alt() { return st.cam; },
    setIgnite(v) { st.kick = Math.max(st.kick, v * 0.6); },
    setStreak(n) { st.streak = n; },
    setTarget(d) { st.target = d; },
    // the real distance between the ghost and the rocket, in metres
    setGap(g) { st.gap = Math.max(0, g); st.idle = false; },
    setTitle(on) { st.title = on; if (on && !st.idle) { st.idle = true; } },
    boostTo(d, tier) {
      st.target = d;
      st.kick = Math.min(1.2, 0.5 + tier * 0.15);
      st.surge = 30 + tier * 16;
      if (tier >= 4) { st.shake = Math.max(st.shake, 0.35); st.flash = 0.3; }
      const pose = rocketPose();
      fx.push({ k: 'ring', x: pose.x - 80, y: pose.y, r: 140 + tier * 40, life: 0.6, max: 0.6, color: '#ffd9a0' });
    },
    // A right answer: close escapes rip free of the ghost's grip; Legendary blasts it into wisps.
    escape(tier, close) {
      const g = ghostPos();
      if (close) {
        st.grasp = 1; st.flash = Math.max(st.flash, 0.35);
        const pose = rocketPose();
        for (let i = 0; i < 24; i++) parts.push({ k: 'burstWisp', x: pose.x - 90, y: pose.y + rand(-40, 40), vx: -rand(80, 300), vy: rand(-120, 120), life: rand(0.5, 0.9), max: 0.9, size: rand(4, 9), color: '#e8f6ff' });
      }
      if (tier >= 5) {
        st.poof = { t: 0 };
        for (let i = 0; i < 70; i++) { const a = rand(0, TAU), sp = rand(120, 520); parts.push({ k: 'burstWisp', x: g.x + rand(-60, 60), y: g.y + rand(-60, 40), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: -40, life: rand(0.6, 1.2), max: 1.2, size: rand(5, 13), color: Math.random() < 0.5 ? '#ffffff' : '#bfe8ff' }); }
      }
    },
    // A skip: the ghost lunges forward.
    lunge() { st.shake = Math.max(st.shake, 0.2); },
    beat() { st.pulse = 1; },
    sputter() { st.shake = 0.4; },
    die() { st.dead = true; st.deadT = 0; st.shake = 0.6; },
    crash() { st.crash = { t: 0, boom: false, since: 0 }; st.shake = Math.max(st.shake, 0.4); },
    get crashDone() { return !!(st.crash && st.crash.boom && st.crash.since > 1.8); },
    get crashBoom() { return !!(st.crash && st.crash.boom); },
    confetti(n = 160) {
      const cols = ['#ff8a1a', '#b04dff', '#7dff5a', '#ffd23f', '#ffffff', '#ff5d73'];
      for (let i = 0; i < n; i++) fx.push({ k: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-80, 80), vy: rand(60, 220), rot: rand(0, TAU), vr: rand(-6, 6), w: rand(8, 14), h: rand(10, 18), life: rand(2.5, 4), color: cols[i % cols.length] });
    },
    burst(x, y, color, n = 30) {
      for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(100, 360); parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 4), color }); }
    },
    rocketScreen() { const p = rocketPose(); return { x: p.x, y: p.y - 40 }; },
    onMilestone(fn) { onMilestone = fn; }
  };
})();
