/* Apples to Oranges — the animated worlds behind the game. Each mode has its own:
 *   classic  a hot-air balloon rising from an orchard, past kites, birds, skyscrapers, clouds,
 *            mountains and jets, up to the edge of space
 *   size     a dragon taking off from a castle valley, past cliffs, floating islands, storms and a
 *            sunset, up into the stars
 *   guess    a squirrel climbing a tree that never ends, past owls, nests and lanterns, through
 *            autumn, fog and frost, on up into space
 *   haunt    the Halloween chase: a jack-o'-lantern balloon flying sideways across a Halloween
 *            night with a ghost coming from behind
 * One canvas, redrawn every frame. Where you are is your score, on the mode's map of 20 locations
 * (js/map.js); each location has its own sky, its own decor and sometimes a landmark, so what you
 * see is where you are. Switching worlds slides the old picture out and the new one in, the way
 * Brain Rocket does. */
'use strict';

const Scene = (function () {
  const TAU = Math.PI * 2;
  // The climb follows your score along the mode's map (js/map.js): every one of the 20 locations
  // gets the same height on screen, and so does every 5,000 points of infinite mode after the target.
  const ZPX = 1500;                 // world pixels per location
  const ZOFF = 120;                 // a location's art starts a little above where you arrive
  const wy = score => mapBand(score) * ZPX;
  const zoneOfW = w => Math.max(0, Math.floor((w - ZOFF) / ZPX));
  const stopOf = z => (z >= 20 ? MAPS[world].infinite : MAPS[world].stops[z]);

  let canvas, ctx;
  let W = 1600, H = 900, BASE = 780, BX = 330;
  const st = { cam: 0, target: 0, t: 0, burn: 0, dipY: 0, dipV: 0, shake: 0, sway: 0 };
  const fx = [];      // screen-space confetti and smoke
  let trees = [], city = [], stars = [];
  let world = 'classic';
  let pines = [], cottages = [], woods = [];

  // ---- Helpers -----------------------------------------------------------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; };
  const wrapX = (x, m = 260) => { const span = W + m * 2; return ((((x + m) % span) + span) % span) - m; };
  const sy = w => BASE - (w - st.cam);

  // ---- Sky colours, one [top, bottom] per location (the 21st is infinite mode) ----------------
  const SKY = {
    // 🎈 a summer morning, deepening to the black of space
    classic: [
      ['#5fb4ff', '#d4f0ff'], ['#59aefc', '#cdeeff'], ['#53a8f8', '#c6eaff'], ['#4ea2f4', '#c3e8ff'], ['#4a9cf0', '#bde4ff'],
      ['#4796ec', '#b6e0ff'], ['#4b9be8', '#d6ecff'], ['#58a6ee', '#e2f2ff'], ['#4390e2', '#acd6fb'], ['#4d5a7c', '#8a96b4'],
      ['#3f86da', '#9fcdf6'], ['#3a7cd2', '#93c4f2'], ['#3270c9', '#86b8ee'], ['#2b62bc', '#79aae6'], ['#2455ad', '#6c9bdc'],
      ['#1c4596', '#587fc8'], ['#0f2459', '#1f3f80'], ['#0a1640', '#16295e'], ['#060d2c', '#0f1d48'], ['#03061a', '#0a1436'],
      ['#020310', '#070b24']
    ],
    // 🐉 a warm morning over the valley, a stormy noon, a sunset, then the night and its stars
    size: [
      ['#78b4ff', '#ffd9b8'], ['#72aefc', '#ffe0c0'], ['#6aa8f8', '#ffe6cc'], ['#62a0f4', '#f8e8d4'], ['#5a98f0', '#e4ecf8'],
      ['#5e9ef0', '#f0f4ff'], ['#5692ea', '#dfe9fb'], ['#4c88e2', '#cfe2f8'], ['#5a7ee0', '#e6d8f8'], ['#5a64d0', '#c8b8f4'],
      ['#3e4870', '#7a80a4'], ['#3a62c4', '#b0c8f0'], ['#4a5ec0', '#e8b8a8'], ['#5a4aa8', '#ff9a5a'], ['#2a2a78', '#6a4a9a'],
      ['#141a4a', '#20306a'], ['#0e1036', '#1c1c50'], ['#0a0a2a', '#181844'], ['#0a0a24', '#1a1a3e'], ['#08061c', '#1a1036'],
      ['#040312', '#0c0a26']
    ],
    // 🐿️ a forest morning, a lantern-lit dusk, autumn, fog, open sky, frost, then space
    guess: [
      ['#7cc5ff', '#e6f7ff'], ['#76c0fc', '#e0f4ff'], ['#70bbf8', '#daf1ff'], ['#6ab4f4', '#d4eeff'], ['#66b1f5', '#d6f0ff'],
      ['#62adf2', '#d0ecff'], ['#6ab8f4', '#f0f4d8'], ['#5aa6ee', '#c8e6ff'], ['#3a4a8a', '#8a7ab0'], ['#6aa0d8', '#f4d8b0'],
      ['#6098d4', '#ecd4b4'], ['#a6b6c8', '#e3e9ef'], ['#7aa6e2', '#d3e6ff'], ['#6a9ce0', '#c8e0ff'], ['#5a8ed8', '#bcd6fa'],
      ['#3a6cc4', '#94b8ec'], ['#5a7ab0', '#c8dcf0'], ['#0f1f5c', '#2c4690'], ['#0a143e', '#1a2a60'], ['#060c2a', '#141e4a'],
      ['#04081f', '#0c1438']
    ]
  };
  // where the sky is: the location the camera is in, as a smooth number
  const skyBand = () => clamp(st.cam / ZPX - 0.25, 0, 20);
  function skyAt(b) {
    const P = SKY[world] || SKY.classic;
    const i = Math.min(19, Math.floor(b)), t = clamp(b - i, 0, 1);
    return [0, 1].map(k => { const x = hex(P[i][k]), y = hex(P[i + 1][k]); return x.map((v, j) => lerp(v, y[j], t)); });
  }
  const css = c => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

  // ---- Things in the sky: each location's own decor, from the map ----------------------------
  // Most of it is laid out in the open sky on the left, the part the matchup panel doesn't cover.
  const visL = () => 96, visR = () => Math.max(560, W - 1040);
  const wrapIn = (x, a, b) => a + ((((x - a) % (b - a)) + (b - a)) % (b - a));
  // things that stand still, rising from below the picture (towers, peaks, cliffs, treetops)
  const TALL = new Set(['spire', 'peak', 'cliff', 'castletop', 'canopy']);
  const STILL = new Set([...TALL, 'crystal', 'constellation', 'planet', 'firefly', 'fog', 'aurora', 'storm', 'island']);
  const SPEED = { birds: 34, geese: 30, eagle: 26, kite: 8, balloon: 7, blimp: 14, cloud: 7, wisp: 10, sheep: 9, swirl: 12, minidragon: 30, wballoon: 5, sat: 9, butterfly: 6, leaf: 6, snow: 4 };

  const CHUNK = 210;
  const chunkCache = new Map();
  function chunk(ci) {
    const key = world + ci;
    if (chunkCache.has(key)) return chunkCache.get(key);
    if (chunkCache.size > 400) chunkCache.clear();
    const rng = mulberry32(ci * 7919 + 17 + (world === 'size' ? 101 : world === 'guess' ? 202 : 0));
    const out = [];
    if (ci * CHUNK < 260) { chunkCache.set(key, out); return out; }   // leave the launch clear
    const decor = stopOf(zoneOfW(ci * CHUNK + CHUNK / 2)).decor;
    for (const [type, wgt] of Object.entries(decor)) {
      const n = Math.floor(wgt * 0.45 + rng());
      for (let i = 0; i < n; i++) {
        const still = STILL.has(type);
        out.push({
          type, w: ci * CHUNK + rng() * CHUNK, fx: rng(), local: TALL.has(type) || rng() < 0.75,
          s: 0.7 + rng() * 0.6, seed: rng() * 1000, hue: Math.floor(rng() * 360),
          vx: still ? 0 : (rng() < 0.5 ? -1 : 1) * (SPEED[type] || 12) * (0.6 + rng() * 0.8)
        });
      }
    }
    out.sort((a, b) => TALL.has(b.type) - TALL.has(a.type));    // the tall things go behind
    chunkCache.set(key, out);
    return out;
  }

  // ---- Fixed scenery, laid out for the current width ----------------------
  function layout() {
    const rng = mulberry32(42);
    trees = [];
    for (let x = 40; x < W; x += 70 + rng() * 90) {
      if (Math.abs(x - BX) < 150) continue;                 // keep the launch field clear
      if (x > W * 0.78 - 40 && x < W * 0.78 + 230) continue; // and the barn
      trees.push({ x, s: 0.8 + rng() * 0.5, kind: rng() < 0.5 ? 'apple' : 'orange', seed: rng() * 100 });
    }
    city = [];
    for (let x = -20; x < W + 40;) {
      const w = 40 + rng() * 70;
      city.push({ x, w, h: 60 + rng() * 150, lit: rng() });
      x += w + 6 + rng() * 20;
    }
    stars = [];
    for (let i = 0; i < 160; i++) stars.push({ x: rng() * W, y: rng() * H, r: 0.6 + rng() * 1.6, p: rng() * TAU });
    pines = [];
    for (let x = 20; x < W; x += 50 + rng() * 80) {
      if (Math.abs(x - BX) < 170 || (x > W * 0.7 && x < W * 0.7 + 300)) continue;
      pines.push({ x, s: 0.7 + rng() * 0.6, c: rng() });
    }
    cottages = [];
    for (let x = 10; x < W; x += 110 + rng() * 140) cottages.push({ x, w: 50 + rng() * 30, h: 34 + rng() * 22, roof: rng() < 0.5 ? '#c4473a' : '#7a4fb0', lit: rng() });
    woods = [];
    for (let x = -30; x < W + 60; x += 40 + rng() * 50) woods.push({ x, h: 120 + rng() * 140, w: 50 + rng() * 40, kind: rng() < 0.5 ? 'pine' : 'round', c: rng() });
  }

  // ---- Drawing -------------------------------------------------------------
  function drawSky() {
    const [top, bot] = skyAt(skyBand());
    skyLum = lum(top);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(top)); g.addColorStop(1, css(bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  let skyLum = 1;

  // the stars come out as the sky gets dark
  function drawStars() {
    const a = clamp((0.3 - skyLum) / 0.18, 0, 1);
    if (a <= 0) return;
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(st.t * 2 + s.p));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSun() {
    const a = clamp((skyLum - 0.12) / 0.2, 0, 1);
    if (a <= 0) return;
    const r = 58;
    const x = W * 0.55, y = 112 + Math.min(80, st.cam * 0.01);
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, 'rgba(255,250,210,0.9)'); g.addColorStop(0.25, 'rgba(255,220,120,0.4)'); g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // The Edge of Space: the curve of the Earth below you, glowing blue
  function drawEarthCurve() {
    const b = st.cam / ZPX;
    const a = clamp(b - 18.2, 0, 1);
    if (world !== 'classic' || a <= 0) return;
    const R = 2600, top = H - 150 + clamp(b - 19, 0, 6) * 30, cx = W * 0.3, cy = top + R;
    ctx.globalAlpha = a;
    const glow = ctx.createRadialGradient(cx, cy, R - 10, cx, cy, R + 90);
    glow.addColorStop(0, 'rgba(120,200,255,0.8)'); glow.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R + 90, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#5fb4ff'); g.addColorStop(0.3, '#2a6fc9'); g.addColorStop(1, '#1d4f8f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    // cloud swirls and a bit of land
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(90,170,90,0.7)';
    ctx.beginPath(); ctx.ellipse(cx - 380, top + 70, 260, 40, -0.05, 0, TAU); ctx.ellipse(cx + 420, top + 90, 200, 36, 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(cx - 700 + i * 230 + Math.sin(i * 7) * 40, top + 40 + (i % 3) * 22, 90, 10, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFruitTree(tr, gy) {
    const s = tr.s, sw = Math.sin(st.t * 1.4 + tr.seed) * 2;
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(tr.x - 5 * s, gy - 40 * s, 10 * s, 42 * s);
    ctx.fillStyle = tr.seed > 50 ? '#2e8b3e' : '#3a9d4a';
    ctx.beginPath();
    ctx.arc(tr.x + sw, gy - 60 * s, 27 * s, 0, TAU);
    ctx.arc(tr.x - 17 * s + sw, gy - 44 * s, 19 * s, 0, TAU);
    ctx.arc(tr.x + 17 * s + sw, gy - 44 * s, 19 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tr.kind === 'apple' ? '#ff4d5e' : '#ff9a1f';
    const spots = [[-12, -62], [8, -70], [16, -48], [-20, -44], [0, -50], [-4, -76]];
    for (const [dx, dy] of spots) { ctx.beginPath(); ctx.arc(tr.x + dx * s + sw, gy + dy * s, 4.2 * s, 0, TAU); ctx.fill(); }
  }

  function drawBarn(x, gy) {
    ctx.fillStyle = '#d64545'; ctx.fillRect(x, gy - 110, 190, 110);
    ctx.fillStyle = '#a83232';
    ctx.beginPath(); ctx.moveTo(x - 14, gy - 108); ctx.lineTo(x + 95, gy - 170); ctx.lineTo(x + 204, gy - 108); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4e0';
    ctx.fillRect(x + 70, gy - 70, 50, 70);
    ctx.strokeStyle = '#d64545'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 70, gy - 70); ctx.lineTo(x + 120, gy); ctx.moveTo(x + 120, gy - 70); ctx.lineTo(x + 70, gy); ctx.stroke();
    ctx.fillStyle = '#fff4e0'; ctx.fillRect(x + 82, gy - 140, 26, 22);
    // fruit crates
    for (let i = 0; i < 3; i++) {
      const cx = x - 70 + i * 34;
      ctx.fillStyle = '#b07a3e'; ctx.fillRect(cx, gy - 22, 30, 22);
      ctx.fillStyle = i === 1 ? '#ff9a1f' : '#ff4d5e';
      for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(cx + 7 + j * 8, gy - 24, 5, 0, TAU); ctx.fill(); }
    }
  }

  function drawGround() {
    const cam = st.cam * 0.3;           // the ground falls away slower than the sky goes by, so the orchard stays a while
    const gy = BASE + 14 + cam;     // the basket sits on the platform, 14px above the grass
    if (gy - 460 > H) return;
    // far mountains
    const my = BASE - 40 + cam * 0.35;
    if (my - 280 < H) {
      ctx.fillStyle = '#8fa6d8';
      ctx.beginPath(); ctx.moveTo(-20, H + 2000);
      const mtn = x => my - 120 - 90 * Math.abs(Math.sin(x * 0.004 + 1)) - 40 * Math.sin(x * 0.013);
      for (let x = -20; x <= W + 40; x += 40) ctx.lineTo(x, mtn(x));
      ctx.lineTo(W + 40, H + 2000); ctx.fill();
      ctx.fillStyle = '#eef4ff';
      for (let x = 60; x < W; x += 260) {
        const top = mtn(x);
        ctx.beginPath(); ctx.moveTo(x - 30, top + 26); ctx.lineTo(x, top - 2); ctx.lineTo(x + 30, top + 26); ctx.fill();
      }
    }
    // city
    const cy = BASE + 6 + cam * 0.55;
    if (cy - 220 < H) {
      for (const b of city) {
        ctx.fillStyle = '#5d6fa6';
        ctx.fillRect(b.x, cy - b.h, b.w, b.h + 1200);
        ctx.fillStyle = 'rgba(255,233,150,0.75)';
        for (let y = cy - b.h + 10; y < cy - 8; y += 16) {
          for (let x = b.x + 6; x < b.x + b.w - 8; x += 10) {
            if (((x * 13 + y * 7) % 10) / 10 < b.lit * 0.6) ctx.fillRect(x, y, 4, 6);
          }
        }
      }
    }
    // near hills
    const hy = BASE + 18 + cam * 0.8;
    ctx.fillStyle = '#66c35f';
    ctx.beginPath(); ctx.moveTo(-20, H + 2000);
    for (let x = -20; x <= W + 40; x += 30) ctx.lineTo(x, hy - 30 - 26 * Math.sin(x * 0.006 + 2) - 12 * Math.sin(x * 0.017));
    ctx.lineTo(W + 40, H + 2000); ctx.fill();
    // ground
    ctx.fillStyle = '#4caf50'; ctx.fillRect(-20, gy, W + 40, 30);
    ctx.fillStyle = '#3d8f42'; ctx.fillRect(-20, gy + 30, W + 40, 18);
    ctx.fillStyle = '#7a5537'; ctx.fillRect(-20, gy + 48, W + 40, 1600);
    for (const tr of trees) drawFruitTree(tr, gy);
    drawBarn(W * 0.78, gy);
    // launch platform
    ctx.fillStyle = '#9c6b3c'; ctx.fillRect(BX - 80, gy - 14, 160, 14);
    ctx.fillStyle = '#7d522b'; ctx.fillRect(BX - 80, gy - 14, 160, 4);
    ctx.fillStyle = '#c9a26b';
    for (const dx of [-70, 58]) { ctx.beginPath(); ctx.ellipse(BX + dx + 6, gy - 22, 12, 9, 0, 0, TAU); ctx.fill(); }
    // windsock
    const wx = BX + 170;
    ctx.fillStyle = '#ddd'; ctx.fillRect(wx, gy - 120, 4, 120);
    ctx.save(); ctx.translate(wx + 4, gy - 116); ctx.rotate(Math.sin(st.t * 2) * 0.12);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#ff6b3d';
      ctx.beginPath(); ctx.moveTo(i * 16, -10 + i * 1.5); ctx.lineTo(i * 16 + 16, -9 + i * 2); ctx.lineTo(i * 16 + 16, 9 - i * 2); ctx.lineTo(i * 16, 10 - i * 1.5); ctx.fill();
    }
    ctx.restore();
  }

  // -- sky things --
  function cloud(x, y, s, a = 0.95) {
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e3eefb';
    ctx.beginPath();
    ctx.arc(x - 50 * s, y + 10 * s, 34 * s, 0, TAU); ctx.arc(x + 50 * s, y + 12 * s, 30 * s, 0, TAU);
    ctx.arc(x, y + 14 * s, 36 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 50 * s, y, 34 * s, 0, TAU); ctx.arc(x - 8 * s, y - 22 * s, 46 * s, 0, TAU);
    ctx.arc(x + 44 * s, y - 4 * s, 36 * s, 0, TAU); ctx.arc(x, y + 6 * s, 40 * s, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function birds(x, y, s, n, seed) {
    ctx.strokeStyle = '#2b3550'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = x + i * 26 * s - (i % 2) * 8, by = y + Math.abs(i - n / 2) * 12 * s;
      const f = Math.sin(st.t * 9 + seed + i) * 6 * s;
      ctx.beginPath(); ctx.moveTo(bx - 10 * s, by - f); ctx.quadraticCurveTo(bx - 4 * s, by - 6 * s, bx, by);
      ctx.quadraticCurveTo(bx + 4 * s, by - 6 * s, bx + 10 * s, by - f); ctx.stroke();
    }
  }
  function kite(x, y, s, hue, seed) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(st.t * 1.5 + seed) * 0.15);
    ctx.fillStyle = `hsl(${hue},85%,60%)`;
    ctx.beginPath(); ctx.moveTo(0, -30 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(0, 36 * s); ctx.lineTo(-20 * s, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `hsl(${(hue + 60) % 360},85%,65%)`;
    ctx.beginPath(); ctx.moveTo(0, -30 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 36 * s);
    for (let i = 1; i <= 6; i++) ctx.lineTo(Math.sin(st.t * 4 + i + seed) * 8 * s, 36 * s + i * 12 * s);
    ctx.stroke();
    ctx.restore();
  }
  function smallBalloon(x, y, s, hue) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * 0.45, s * 0.45);
    envelope(0, 0, [`hsl(${hue},80%,60%)`, `hsl(${(hue + 40) % 360},85%,62%)`, '#fff3c4']);
    ctx.fillStyle = '#9c6b3c'; ctx.fillRect(-18, 40, 36, 28);
    ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-18, 16); ctx.lineTo(-16, 40); ctx.moveTo(18, 16); ctx.lineTo(16, 40); ctx.stroke();
    ctx.restore();
  }
  function blimp(x, y, s, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    ctx.fillStyle = '#c9d2e3'; ctx.beginPath(); ctx.ellipse(0, 0, 90, 30, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff9a1f'; ctx.fillRect(-60, -6, 110, 12);
    ctx.fillStyle = '#9aa6bd';
    ctx.beginPath(); ctx.moveTo(-78, -10); ctx.lineTo(-108, -32); ctx.lineTo(-96, 0); ctx.lineTo(-108, 32); ctx.lineTo(-78, 10); ctx.fill();
    ctx.fillStyle = '#596580'; ctx.fillRect(-14, 28, 30, 10);
    ctx.restore();
  }
  function plane(x, y, s, dir, jet) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    if (jet) {
      const g = ctx.createLinearGradient(-500, 0, -40, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.75)');
      ctx.fillStyle = g; ctx.fillRect(-500, -3, 460, 6);
    }
    ctx.fillStyle = '#f4f6fb';
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#dfe5f1';
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-22, 26); ctx.lineTo(-12, 26); ctx.lineTo(14, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-46, -22); ctx.lineTo(-38, -22); ctx.lineTo(-24, 0); ctx.fill();
    ctx.fillStyle = jet ? '#4fa3ff' : '#ff5d73'; ctx.fillRect(-30, -2, 60, 3);
    ctx.fillStyle = '#2b3550';
    for (let i = 0; i < 6; i++) ctx.fillRect(-18 + i * 8, -4, 4, 3);
    if (!jet) {
      ctx.fillStyle = 'rgba(80,90,110,0.6)';
      ctx.fillRect(44, -12 * Math.abs(Math.sin(st.t * 30)), 3, 24 * Math.abs(Math.sin(st.t * 30)));
    }
    ctx.restore();
  }
  function wisp(x, y, s) {
    const g = ctx.createLinearGradient(x - 160 * s, 0, x + 160 * s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 160 * s, 7 * s, 0, 0, TAU); ctx.fill();
  }
  function wballoon(x, y, s) {
    ctx.fillStyle = '#f2f4fa';
    ctx.beginPath(); ctx.arc(x, y, 26 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,175,205,0.6)';
    ctx.beginPath(); ctx.arc(x + 8 * s, y + 6 * s, 18 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + 26 * s); ctx.lineTo(x, y + 70 * s); ctx.stroke();
    ctx.fillStyle = '#ff9a1f'; ctx.fillRect(x - 6 * s, y + 70 * s, 12 * s, 10 * s);
  }
  function meteor(x, y, s) {
    const g = ctx.createLinearGradient(x - 140 * s, y - 70 * s, x, y);
    g.addColorStop(0, 'rgba(255,220,150,0)'); g.addColorStop(1, 'rgba(255,240,200,0.9)');
    ctx.strokeStyle = g; ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(x - 140 * s, y - 70 * s); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff6da'; ctx.beginPath(); ctx.arc(x, y, 4 * s, 0, TAU); ctx.fill();
  }
  function sat(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(st.t * 0.4) * 0.3); ctx.scale(s, s);
    ctx.fillStyle = '#d9dee9'; ctx.fillRect(-12, -10, 24, 20);
    ctx.fillStyle = '#e8b83c'; ctx.fillRect(-10, -8, 20, 16);
    ctx.fillStyle = '#3a63c9'; ctx.fillRect(-54, -8, 38, 16); ctx.fillRect(16, -8, 38, 16);
    ctx.restore();
  }

  // ---- Easter egg: the rocket from Brain Rocket, flying past ------------------
  // Same shapes and colours as Brain Rocket's rocket, drawn nose-up around its nozzle at (0, 0).
  function brainRocket() {
    // flame
    const L = 70 * (1 + Math.sin(st.t * 40) * 0.08 + Math.sin(st.t * 23) * 0.06);
    const layer = (w, l, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(-w * 1.1, l * 0.45, 0, l);
      ctx.quadraticCurveTo(w * 1.1, l * 0.45, w, 0); ctx.closePath(); ctx.fill();
    };
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    layer(17, L, '#ff7a1a'); layer(11, L * 0.72, '#ffd23f'); layer(5, L * 0.4, '#ffffff');
    ctx.restore();
    // fins
    for (const d of [-1, 1]) {
      ctx.fillStyle = '#e8364f';
      ctx.beginPath(); ctx.moveTo(d * 32, -70); ctx.lineTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 30, -16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8243b';
      ctx.beginPath(); ctx.moveTo(d * 66, -12); ctx.lineTo(d * 66, 8); ctx.lineTo(d * 56, 2); ctx.closePath(); ctx.fill();
    }
    // nozzle
    const ng = ctx.createLinearGradient(-26, 0, 26, 0);
    ng.addColorStop(0, '#4a5060'); ng.addColorStop(0.5, '#9aa2b4'); ng.addColorStop(1, '#3e4352');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(18, -18); ctx.lineTo(25, 0); ctx.lineTo(-25, 0); ctx.closePath(); ctx.fill();
    // body, with the red nose cone and stripes
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-31, -16); ctx.lineTo(-35, -110);
    ctx.quadraticCurveTo(-35, -165, 0, -200); ctx.quadraticCurveTo(35, -165, 35, -110);
    ctx.lineTo(31, -16); ctx.closePath();
    const bg = ctx.createLinearGradient(-35, 0, 35, 0);
    bg.addColorStop(0, '#b9c1d4'); bg.addColorStop(0.35, '#ffffff'); bg.addColorStop(1, '#a7b0c4');
    ctx.fillStyle = bg; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#e8364f'; ctx.fillRect(-40, -210, 80, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-20, -210, 10, 62);
    ctx.fillStyle = '#e8364f'; ctx.fillRect(-40, -46, 80, 10);
    ctx.fillStyle = '#2a3350'; ctx.fillRect(-40, -34, 80, 4);
    ctx.restore();
    // window and its little pilot, waving hello
    ctx.fillStyle = '#7b8499'; ctx.beginPath(); ctx.arc(0, -105, 19, 0, TAU); ctx.fill();
    const wg = ctx.createRadialGradient(-5, -110, 2, 0, -105, 15);
    wg.addColorStop(0, '#7fd3ff'); wg.addColorStop(1, '#173a8a');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, -105, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd7a8'; ctx.beginPath(); ctx.arc(0, -101, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-2.3, -102, 1.1, 0, TAU); ctx.arc(2.3, -102, 1.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -100.5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-6, -112, 4, 2.5, -0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c62a42'; ctx.fillRect(-4, -60, 8, 66);
  }

  // It shows up rarely on its own (and the game sends it when you hit a 10 streak).
  let egg = null, eggWait = rand(40, 90);
  function launchEgg() {
    if (egg) return;
    // it launches up through the open sky on the left, where the matchup panel doesn't cover it
    // (and to one side of the balloon, so its smoke trail doesn't cross it)
    const right = Math.min(540, W * 0.33);
    const x = Math.random() < 0.5 ? rand(50, Math.max(60, BX - 160)) : rand(Math.min(right - 10, BX + 160), right);
    egg = { x, y: H + 60, vx: (x < BX ? 1 : -1) * rand(20, 90), vy: -rand(330, 420), s: rand(0.4, 0.5), trail: 0 };
  }
  function drawEgg(dt) {
    eggWait -= dt;
    if (eggWait <= 0) { eggWait = rand(70, 160); if (Math.random() < 0.45) launchEgg(); }
    if (!egg) return;
    egg.x += egg.vx * dt; egg.y += egg.vy * dt;
    const ang = Math.atan2(egg.vy, egg.vx) + Math.PI / 2;    // the nose points along its path
    egg.trail += dt;
    while (egg.trail > 0.03) {
      egg.trail -= 0.03;
      fx.push({ kind: 'puff', x: egg.x - Math.sin(ang) * -6, y: egg.y + Math.cos(ang) * 6, vx: rand(-15, 15), vy: rand(-15, 15), life: 1.2, max: 1.2, r: rand(5, 9) * egg.s * 2 });
    }
    ctx.save(); ctx.translate(egg.x, egg.y); ctx.rotate(ang); ctx.scale(egg.s, egg.s);
    brainRocket();
    ctx.restore();
    if (egg.x < -300 || egg.x > W + 300 || egg.y < -400) egg = null;
  }

  function drawDecor() {
    const top = st.cam + (BASE + 200), bot = st.cam - (H - BASE) - 200;
    const L = visL(), R = visR();
    drawMarks();
    // two passes: the tall things that rise from below go behind everything else
    for (const tall of [true, false]) for (let ci = Math.max(1, Math.floor(bot / CHUNK)); ci <= Math.floor((top + 700) / CHUNK); ci++) {
      for (const o of chunk(ci)) {
        if (TALL.has(o.type) !== tall) continue;
        const y = sy(o.w);
        if (y > H + 200) continue;
        if (tall ? y + 700 < 0 : y < -200) continue;
        const x0 = o.local ? L + o.fx * (R - L) : o.fx * W;
        const x = o.local ? wrapIn(x0 + o.vx * st.t, -200, R + 240) : wrapX(x0 + o.vx * st.t);
        const dir = o.vx > 0 ? 1 : -1;
        switch (o.type) {
          case 'cloud': cloud(x, y, o.s); break;
          case 'birds': birds(x, y, o.s, 3 + Math.floor(o.seed) % 3, o.seed); break;
          case 'geese': birds(x, y, o.s * 0.8, 7, o.seed); break;
          case 'kite': kite(x, y, o.s, o.hue, o.seed); break;
          case 'balloon': smallBalloon(x, y, o.s, o.hue); break;
          case 'blimp': blimp(x, y, o.s, dir); break;
          case 'jet': plane(o.local ? wrapIn(x0 + o.vx * 3 * st.t, -500, R + 600) : wrapX(x0 + o.vx * 3 * st.t, 600), y, o.s, dir || 1, true); break;
          case 'fighter': {
            const fxp = o.local ? wrapIn(x0 + 130 * (dir || 1) * st.t, -400, R + 500) : wrapX(x0 + 130 * (dir || 1) * st.t, 500);
            fighter(fxp, y, o.s * 0.9, dir || 1); fighter(fxp - 60 * (dir || 1), y + 30 * o.s, o.s * 0.9, dir || 1); break;
          }
          case 'wisp': wisp(x, y, o.s); break;
          case 'wballoon': wballoon(x, y, o.s); break;
          case 'meteor': meteor(wrapX(x0 + st.t * 220 + o.seed), y + ((st.t * 110 + o.seed) % 300), o.s); break;
          case 'sat': sat(x, y, o.s); break;
          case 'island': island(x, y, o.s, o.seed); break;
          case 'storm': storm(x, y, o.s, o.seed); break;
          case 'aurora': aurora(x0, y, o.s * 1.2, o.seed); break;
          case 'butterfly': butterfly(x, y, o.s, o.hue, o.seed); break;
          case 'leaf': fallingLeaf(x, y + ((st.t * 30 + o.seed) % 160), o.s, o.seed); break;
          case 'fog': fogBand(y, o.s, o.seed); break;
          case 'spire': spire(x, y, o.s, o.seed); break;
          case 'eagle': eagle(x, y, o.s, dir || 1, o.seed); break;
          case 'peak': peak(x, y, o.s, o.seed); break;
          case 'planet': planet(x, y, o.s, o.hue, o.seed); break;
          case 'castletop': castletop(x, y, o.s, o.seed); break;
          case 'cliff': cliff(x, y, o.s, o.seed); break;
          case 'sheep': sheep(x, y, o.s, dir || 1, o.seed); break;
          case 'swirl': swirl(x, y, o.s, o.seed); break;
          case 'crystal': crystal(x, y, o.s, o.hue, o.seed); break;
          case 'minidragon': miniDragon(x, y, o.s, dir || 1); break;
          case 'constellation': constellation(x, y, o.s, o.seed); break;
          case 'canopy': canopy(x, y, o.s, o.seed); break;
          case 'firefly': fireflies(x, y, o.s, o.seed); break;
          case 'snow': snow(x, y, o.s, o.seed); break;
        }
      }
    }
  }

  // ---- Landmarks: one big thing drawn in the middle of its location ---------------------------
  const markW = z => z * ZPX + ZOFF + ZPX * 0.66;
  function drawMarks() {
    const z0 = zoneOfW(st.cam - 2000), z1 = zoneOfW(st.cam + 2600);
    for (let z = z0; z <= Math.min(z1, 19); z++) {
      const m = MAPS[world].stops[z].mark;
      if (!m) continue;
      const y = sy(markW(z));
      const x = visL() + (visR() - visL()) * 0.72;
      if (y < -700 || y > H + 1800) continue;
      switch (m) {
        case 'burj': burj(x + 30, y); break;
        case 'rainbow': rainbowArc(x - 140, y + 260, 360); break;
        case 'everest': everest(x - 40, y); break;
        case 'iss': iss(x - 60, y); break;
        case 'skycastle': skyCastle(x - 40, y, 1.6); break;
        case 'moon': bigMoon(x, y, 110, '#fff4cf'); break;
        case 'bigmoon': bigMoon(x - 30, y, 250, '#fff6dc'); break;
        case 'bigstar': bigStar(x - 40, y); break;
      }
    }
  }

  // ---- The sky things for each location ---------------------------------------------------
  // The tall things fade out into the haze below them, so a peak above you never walls off the sky.
  const rgbaOf = (h, a) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  function fadeDown(col, y, len) {
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, rgbaOf(col, 1)); g.addColorStop(0.5, rgbaOf(col, 1)); g.addColorStop(1, rgbaOf(col, 0));
    return g;
  }
  // Skyscraper tops, rising from below the picture; (x, y) is the roof
  function spire(x, y, s, seed) {
    const w = (64 + (seed % 46)) * s, k = Math.floor(seed) % 3;
    const col = ['#6d7fae', '#7b8cbc', '#5f7099'][k];
    const len = 560;
    ctx.fillStyle = fadeDown(col, y, len); ctx.fillRect(x - w / 2, y, w, len);
    ctx.fillStyle = fadeDown('#ffffff', y, len); ctx.globalAlpha = 0.12; ctx.fillRect(x - w / 2, y, w * 0.28, len); ctx.globalAlpha = 1;
    ctx.fillStyle = col; ctx.fillRect(x - w * 0.32, y - 26 * s, w * 0.64, 26 * s);
    ctx.fillStyle = '#c9d2e3'; ctx.fillRect(x - 2, y - 96 * s, 4, 70 * s);
    if (Math.sin(st.t * 3 + seed) > 0) { ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(x, y - 98 * s, 5, 0, TAU); ctx.fill(); }
    const y0 = y + 14 + Math.max(0, Math.ceil((-40 - y - 14) / 22)) * 22;
    for (let yy = y0; yy < Math.min(H + 20, y + len * 0.9); yy += 22) {
      ctx.fillStyle = `rgba(255,240,170,${0.6 * (1 - (yy - y) / (len * 0.9))})`;
      for (let i = 0, xx = x - w / 2 + 8; xx < x + w / 2 - 10; xx += 14, i++) if ((i * 7 + Math.round((yy - y) / 22) * 3 + Math.floor(seed)) % 5 < 2) ctx.fillRect(xx, yy, 6, 9);
    }
  }
  // The Burj Khalifa: setbacks narrowing up to its long spire
  function burj(x, y) {
    const steps = [[0, 3], [190, 9], [300, 16], [430, 26], [580, 38], [760, 52], [960, 68], [1200, 86], [1500, 104], [2400, 120]];
    ctx.fillStyle = '#b9c7de';
    ctx.beginPath(); ctx.moveTo(x, y - 20);
    for (const [dy, hw] of steps) { ctx.lineTo(x + hw, y + dy); ctx.lineTo(x + hw, y + dy + 30); }
    for (let i = steps.length - 1; i >= 0; i--) { const [dy, hw] = steps[i]; ctx.lineTo(x - hw, y + dy + 30); ctx.lineTo(x - hw, y + dy); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(70,90,140,0.25)'; ctx.fillRect(x, y + 190, 140, 2400);   // the shaded side
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); for (let dy = 220; dy < 2400; dy += 18) { const yy = y + dy; if (yy < -10 || yy > H + 10) continue; const hw = steps.find(s => s[0] >= dy - 30)[1] - 3; ctx.moveTo(x - hw, yy); ctx.lineTo(x + hw, yy); } ctx.stroke();
    if (Math.sin(st.t * 2.4) > 0.3) { ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(x, y - 22, 5, 0, TAU); ctx.fill(); }
  }
  function rainbowArc(x, y, R) {
    const cols = ['#ff5d5d', '#ff9a3c', '#ffe14d', '#6ad46a', '#4fa3ff', '#8a6cff'];
    ctx.globalAlpha = 0.6; ctx.lineWidth = 24;
    cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(x, y, R - i * 23, Math.PI, TAU); ctx.stroke(); });
    ctx.globalAlpha = 1;
    cloud(x - R + 50, y + 4, 0.9); cloud(x + R - 50, y + 4, 0.9);
  }
  function eagle(x, y, s, dir, seed) {
    const f = Math.sin(st.t * 2.6 + seed);
    ctx.save(); ctx.translate(x, y + Math.sin(st.t * 0.8 + seed) * 10); ctx.scale(s * dir, s);
    ctx.fillStyle = '#4a3020';
    for (const d of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(d * 40, -20 - f * 16, d * 92, -12 - f * 26);
      ctx.lineTo(d * 84, -2 - f * 18); ctx.lineTo(d * 90, 2 - f * 14); ctx.lineTo(d * 78, 6 - f * 10);
      ctx.quadraticCurveTo(d * 40, 8, 0, 8); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(2, 4, 28, 9, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-22, 2); ctx.lineTo(-44, -4); ctx.lineTo(-44, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(30, 0, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffc23f'; ctx.beginPath(); ctx.moveTo(37, -3); ctx.lineTo(48, 2); ctx.lineTo(36, 5); ctx.fill();
    ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(32, -2, 1.8, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // A mountain top rising from below; (x, y) is the summit
  function peak(x, y, s, seed, rock = ['#7d8fb8', '#62739c'], h = 620) {
    const w = 200 * s;
    const lx = x - w * (0.3 + (seed % 10) * 0.01);
    ctx.fillStyle = fadeDown(rock[0], y, h);
    ctx.beginPath(); ctx.moveTo(x - w * 1.5, y + h); ctx.lineTo(lx, y + 120 * s); ctx.lineTo(x, y); ctx.lineTo(x + w * 0.4, y + 140 * s); ctx.lineTo(x + w * 1.5, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fadeDown(rock[1], y, h);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.4, y + 140 * s); ctx.lineTo(x + w * 1.5, y + h); ctx.lineTo(x + w * 0.25, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f8ff';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (lx - x) * 0.6, y + 72 * s); ctx.lineTo(x - 22 * s, y + 58 * s); ctx.lineTo(x - 4 * s, y + 82 * s);
    ctx.lineTo(x + 18 * s, y + 62 * s); ctx.lineTo(x + w * 0.24, y + 84 * s); ctx.closePath(); ctx.fill();
  }
  // Mount Everest, with prayer flags at the summit
  function everest(x, y) {
    peak(x - 330, y + 240, 1.1, 3, ['#8796c0', '#6d7ca6'], 700);
    peak(x, y, 1.9, 5, ['#7484ae', '#56658e'], 1000);
    ctx.strokeStyle = 'rgba(60,40,40,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.quadraticCurveTo(x + 40, y + 6, x + 80, y + 40); ctx.stroke();
    const cols = ['#4f8cff', '#fff', '#ff5d5d', '#4fd07a', '#ffd23f'];
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6, fx = x + 80 * t, fy = y - 2 + (8 + 34 * t * t) * t + Math.sin(st.t * 4 + i) * 1.5;
      ctx.fillStyle = cols[i % 5]; ctx.fillRect(fx - 4, fy, 8, 9);
    }
    wisp(x - 60, y + 120, 1.2);
  }
  function fighter(x, y, s, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    const g = ctx.createLinearGradient(-300, 0, -34, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.6)');
    ctx.fillStyle = g; ctx.fillRect(-300, -2, 266, 4);
    const fl = 16 + Math.sin(st.t * 50) * 4;
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-34, -4); ctx.lineTo(-34 - fl, 0); ctx.lineTo(-34, 4); ctx.fill();
    ctx.fillStyle = '#8d97ab';
    ctx.beginPath(); ctx.moveTo(44, 0); ctx.lineTo(12, -6); ctx.lineTo(-30, -6); ctx.lineTo(-34, 0); ctx.lineTo(-30, 6); ctx.lineTo(12, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6f7a90';
    ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(-20, 24); ctx.lineTo(-28, 24); ctx.lineTo(-20, 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16, -4); ctx.lineTo(-28, -22); ctx.lineTo(-34, -22); ctx.lineTo(-30, -4); ctx.fill();
    ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.ellipse(18, -5, 9, 3.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // The International Space Station: its long truss and big golden solar wings
  function iss(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(st.t * 0.2) * 0.04);
    for (const px of [-200, -150, 150, 200]) for (const d of [-1, 1]) {
      const py = d > 0 ? 12 : -112;
      ctx.fillStyle = '#c9952e'; ctx.fillRect(px - 20, py, 40, 100);
      ctx.strokeStyle = 'rgba(90,55,0,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); for (let k = 1; k < 8; k++) { ctx.moveTo(px - 20, py + k * 12.5); ctx.lineTo(px + 20, py + k * 12.5); } ctx.moveTo(px, py); ctx.lineTo(px, py + 100); ctx.stroke();
    }
    ctx.fillStyle = '#c9ced8'; ctx.fillRect(-230, -6, 460, 12);
    ctx.fillStyle = '#f4f6fa'; ctx.fillRect(-70, 14, 18, 54); ctx.fillRect(52, 14, 18, 54);
    ctx.fillStyle = '#e6e9ef'; ctx.fillRect(-34, -26, 68, 52); ctx.fillRect(-100, -15, 66, 30); ctx.fillRect(34, -15, 80, 30);
    ctx.fillStyle = '#b8bfcc'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4fa3ff'; ctx.fillRect(-6, -40, 12, 14);
    ctx.restore();
  }
  function planet(x, y, s, hue, seed) {
    const r = 46 * s;
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, `hsl(${hue},70%,72%)`); g.addColorStop(1, `hsl(${hue},55%,32%)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (seed % 2 < 1) {
      ctx.strokeStyle = `hsla(${(hue + 40) % 360},70%,80%,0.7)`; ctx.lineWidth = 5 * s;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.7, r * 0.42, -0.35, 0, TAU); ctx.stroke();
    }
  }
  function castletop(x, y, s, seed) {
    const w = 64 * s;
    ctx.fillStyle = fadeDown('#a7a0bb', y, 520); ctx.fillRect(x - w / 2, y, w, 520);
    ctx.fillStyle = fadeDown('#8a82a2', y, 520); ctx.fillRect(x + w * 0.12, y, w * 0.38, 520);
    ctx.fillStyle = '#ffd86b';
    for (let k = 1; k < 3; k++) { const wy = y + k * 130 * s; if (wy > -30 && wy < H + 30) { ctx.beginPath(); ctx.moveTo(x - 8 * s, wy + 24 * s); ctx.lineTo(x - 8 * s, wy); ctx.arc(x, wy, 8 * s, Math.PI, 0); ctx.lineTo(x + 8 * s, wy + 24 * s); ctx.fill(); } }
    ctx.fillStyle = seed % 2 < 1 ? '#7a4fb0' : '#c4473a';
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 10 * s, y); ctx.lineTo(x, y - 92 * s); ctx.lineTo(x + w / 2 + 10 * s, y); ctx.fill();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 92 * s); ctx.lineTo(x, y - 128 * s); ctx.stroke();
    ctx.fillStyle = ['#ff5d73', '#ffd23f', '#4fa3ff'][Math.floor(seed) % 3];
    ctx.beginPath(); ctx.moveTo(x, y - 128 * s);
    for (let i = 0; i <= 5; i++) ctx.lineTo(x + i * 6 * s, y - 128 * s + Math.sin(st.t * 6 + i + seed) * 2);
    ctx.lineTo(x + 30 * s, y - 114 * s); ctx.lineTo(x, y - 114 * s); ctx.fill();
  }
  // A cliff with a waterfall pouring off it
  function cliff(x, y, s, seed) {
    const w = 150 * s, h = 600;
    ctx.fillStyle = fadeDown('#8a7a8e', y, h);
    ctx.beginPath(); ctx.moveTo(x - w, y + h); ctx.lineTo(x - w * 0.9, y + 40 * s); ctx.lineTo(x - w * 0.7, y); ctx.lineTo(x + w * 0.7, y); ctx.lineTo(x + w * 0.85, y + 60 * s); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fadeDown('#74657a', y, h); ctx.fillRect(x + w * 0.3, y + 20, w * 0.6, h - 20);
    ctx.fillStyle = '#5cc463'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.74, 12 * s, 0, 0, TAU); ctx.fill();
    const fx = x + ((seed % 40) - 20) * s;
    ctx.fillStyle = fadeDown('#bee6ff', y, h); ctx.fillRect(fx - 10 * s, y, 20 * s, h);
    for (let k = 0; k < 9; k++) {
      const d = (st.t * 160 + k * 70) % h, yy = y + d;
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - d / h)})`;
      ctx.fillRect(fx - 6 * s, yy, 4 * s, 18); ctx.fillRect(fx + 3 * s, y + (d + 35) % h, 3 * s, 14);
    }
  }
  // A cloud that's also a sheep
  function sheep(x, y, s, dir, seed) {
    ctx.save(); ctx.translate(x, y + Math.sin(st.t * 2 + seed) * 6); ctx.scale(s * dir, s);
    ctx.fillStyle = '#3a3450';
    for (const lx of [-26, -10, 12, 28]) ctx.fillRect(lx, 18, 6, 22 + Math.sin(st.t * 6 + lx) * 3);
    ctx.fillStyle = '#e3eefb'; ctx.beginPath(); ctx.ellipse(0, 10, 50, 26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); for (const [px, py, r] of [[-30, 0, 20], [-8, -10, 24], [18, -6, 22], [34, 6, 18], [0, 10, 26]]) { ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU); } ctx.fill();
    ctx.fillStyle = '#3a3450'; ctx.beginPath(); ctx.ellipse(54, 2, 15, 12, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(46, -8, 8, 4, -0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(58, -1, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // A wind spirit: a turning swirl of air
  function swirl(x, y, s, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s * 0.7); ctx.rotate(st.t * 1.4 + seed);
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = k ? 'rgba(180,240,255,0.45)' : 'rgba(240,252,255,0.85)'; ctx.lineWidth = k ? 9 : 4;
      ctx.beginPath();
      for (let a = 0; a < 4 * Math.PI; a += 0.2) { const r = 4 + a * 7; const px = Math.cos(a + k * 0.3) * r, py = Math.sin(a + k * 0.3) * r; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function crystal(x, y, s, hue, seed) {
    const bob = Math.sin(st.t * 1.5 + seed) * 10;
    const h1 = 200 + (hue % 90);
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
    g.addColorStop(0, `hsla(${h1},90%,75%,0.45)`); g.addColorStop(1, `hsla(${h1},90%,75%,0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 90, 0, TAU); ctx.fill();
    const shard = (dx, h, w, a) => {
      ctx.save(); ctx.translate(dx, 20); ctx.rotate(a);
      ctx.fillStyle = `hsl(${h1},75%,62%)`;
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(w, -h * 0.72); ctx.lineTo(w, 0); ctx.lineTo(0, h * 0.25); ctx.lineTo(-w, 0); ctx.lineTo(-w, -h * 0.72); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `hsla(${h1},90%,88%,0.75)`;
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(-w, -h * 0.72); ctx.lineTo(-w, 0); ctx.lineTo(0, h * 0.25); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    shard(-22, 52, 11, -0.35); shard(22, 46, 10, 0.4); shard(0, 76, 15, 0);
    // a few rocks the crystals grow out of
    ctx.fillStyle = '#5a4a6e'; ctx.beginPath(); ctx.ellipse(0, 28, 40, 14, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function miniDragon(x, y, s, dir) {
    ctx.save(); ctx.translate(x, y + Math.sin(st.t * 2 + x * 0.01) * 8); ctx.scale(0.26 * s * dir, 0.26 * s); ctx.rotate(-0.2);
    dragonBody(0, false);
    ctx.restore();
  }
  function bigMoon(x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
    g.addColorStop(0, 'rgba(255,245,210,0.35)'); g.addColorStop(1, 'rgba(255,245,210,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,130,0.4)';
    for (const [dx, dy, rr] of [[-0.35, -0.25, 0.18], [0.28, 0.12, 0.24], [-0.1, 0.42, 0.13], [0.42, -0.4, 0.11], [-0.5, 0.2, 0.09]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU); ctx.fill(); }
  }
  function constellation(x, y, s, seed) {
    const r = mulberry32(Math.floor(seed * 1000));
    const pts = Array.from({ length: 6 }, () => [x + (r() - 0.5) * 220 * s, y + (r() - 0.5) * 120 * s]);
    pts.sort((a, b) => a[0] - b[0]);
    ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    pts.forEach((p, i) => {
      const tw = 0.6 + 0.4 * Math.sin(st.t * 3 + i + seed);
      ctx.fillStyle = `rgba(255,250,220,${0.25 * tw})`; ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.8 * tw + 1, 0, TAU); ctx.fill();
    });
  }
  // The Dragon Star: a huge glowing star
  function bigStar(x, y) {
    const p = 1 + Math.sin(st.t * 2) * 0.06;
    const g = ctx.createRadialGradient(x, y, 10, x, y, 260);
    g.addColorStop(0, 'rgba(255,240,170,0.7)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 260, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,245,200,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = st.t * 0.3 + i * TAU / 12; ctx.moveTo(x + Math.cos(a) * 90, y + Math.sin(a) * 90); ctx.lineTo(x + Math.cos(a) * 200, y + Math.sin(a) * 200); } ctx.stroke();
    ctx.fillStyle = '#ffe58a'; ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 32 : 78) * p; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // The tops of the forest's other trees, below you
  function canopy(x, y, s, seed) {
    ctx.fillStyle = fadeDown('#5a3a22', y + 60 * s, 380); ctx.fillRect(x - 10 * s, y + 60 * s, 20 * s, 380);
    const c = seed % 2 < 1 ? ['#2f8a45', '#3fa356'] : ['#3a9d4a', '#5cc463'];
    ctx.fillStyle = c[0]; ctx.beginPath(); for (const [px, py, r] of [[-46, 50, 40], [46, 50, 40], [0, 70, 50]]) { ctx.moveTo(x + (px + r) * s, y + py * s); ctx.arc(x + px * s, y + py * s, r * s, 0, TAU); } ctx.fill();
    ctx.fillStyle = c[1]; ctx.beginPath(); for (const [px, py, r] of [[-24, 20, 36], [24, 22, 34], [0, 0, 38]]) { ctx.moveTo(x + (px + r) * s, y + py * s); ctx.arc(x + px * s, y + py * s, r * s, 0, TAU); } ctx.fill();
  }
  function fireflies(x, y, s, seed) {
    for (let i = 0; i < 4; i++) {
      const fx = x + Math.sin(st.t * 0.9 + seed + i * 2.1) * 60 * s, fy = y + Math.cos(st.t * 0.7 + seed + i * 1.3) * 40 * s;
      const a = 0.4 + 0.6 * Math.abs(Math.sin(st.t * 2.5 + i + seed));
      const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, 16);
      g.addColorStop(0, `rgba(230,255,140,${a})`); g.addColorStop(1, 'rgba(230,255,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,210,${a})`; ctx.beginPath(); ctx.arc(fx, fy, 2.6, 0, TAU); ctx.fill();
    }
  }
  function snow(x, y, s, seed) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const fy = y + ((st.t * (26 + i * 5) + seed + i * 47) % 220) - 110, fx = x + i * 30 * s - 60 + Math.sin(st.t + i + seed) * 12;
      const r = (3 + (i % 3)) * s;
      ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3 + st.t * 0.5; ctx.moveTo(fx - Math.cos(a) * r, fy - Math.sin(a) * r); ctx.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r); } ctx.stroke();
    }
  }
  // The Moon Acorn: a giant golden acorn, glowing like the moon
  function moonAcorn(x, y) {
    const g = ctx.createRadialGradient(x, y, 40, x, y, 320);
    g.addColorStop(0, 'rgba(255,220,120,0.45)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 320, 0, TAU); ctx.fill();
    const ng = ctx.createRadialGradient(x - 40, y - 10, 10, x, y + 30, 150);
    ng.addColorStop(0, '#fff2b0'); ng.addColorStop(1, '#e0a83a');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.ellipse(x, y + 40, 105, 125, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8c070'; ctx.beginPath(); ctx.moveTo(x - 8, y + 160); ctx.lineTo(x, y + 182); ctx.lineTo(x + 8, y + 160); ctx.fill();
    ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.ellipse(x, y - 52, 128, 62, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,10,0.45)'; ctx.lineWidth = 2;
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y - 52, 128, 62, 0, 0, TAU); ctx.clip();
    ctx.beginPath(); for (let k = -6; k <= 6; k++) { ctx.moveTo(x + k * 24 - 70, y - 120); ctx.lineTo(x + k * 24 + 70, y + 10); ctx.moveTo(x + k * 24 + 70, y - 120); ctx.lineTo(x + k * 24 - 70, y + 10); } ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 7, y - 140, 14, 34);
  }

  // The balloon's envelope, drawn around (cx, mouthY): the mouth sits at mouthY,
  // the envelope rises about 260px above it.
  function envelope(cx, mouthY, colors) {
    const R = 108, cy = mouthY - 140;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 22, mouthY);
    ctx.bezierCurveTo(cx - 60, mouthY - 22, cx - R * 1.04, cy + 60, cx - R, cy);
    ctx.arc(cx, cy, R, Math.PI, 0);
    ctx.bezierCurveTo(cx + R * 1.04, cy + 60, cx + 60, mouthY - 22, cx + 22, mouthY);
    ctx.closePath();
    ctx.clip();
    // curved stripes: narrowing ellipses, alternating colours
    const N = 7;
    for (let k = N; k >= 1; k--) {
      ctx.fillStyle = colors[k % colors.length];
      ctx.beginPath(); ctx.ellipse(cx, cy + 30, R * 1.1 * (k / N), R * 1.9, 0, 0, TAU); ctx.fill();
    }
    // light from the top left, shade on the right
    const g = ctx.createRadialGradient(cx - 40, cy - 50, 10, cx, cy, R * 1.5);
    g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(40,0,40,0.3)');
    ctx.fillStyle = g; ctx.fillRect(cx - R - 10, cy - R - 10, R * 2 + 20, R * 3);
    ctx.restore();
  }

  // Classic's balloon is fruit, picked once when the page loads: half the time an apple, half the
  // time an orange. One apple in twenty has a worm living in it.
  const FORCE = (location.search.match(/[?&]fruit=(apple|orange|worm)/) || [])[1];
  const FRUIT = FORCE ? (FORCE === 'orange' ? 'orange' : 'apple') : Math.random() < 0.5 ? 'apple' : 'orange';
  const WORM = FORCE ? FORCE === 'worm' : FRUIT === 'apple' && Math.random() < 0.05;

  // The fruit envelope: a real apple or orange shape (not a balloon's teardrop) sitting on the
  // balloon's mouth at mouthY, the burner and ropes hanging below it as usual.
  function fruitEnvelope(cx, mouth) {
    const apple = FRUIT === 'apple';
    const R = apple ? 128 : 118;                   // half the width
    const bottom = mouth + 4, top = apple ? mouth - 226 : mouth - 232;
    const cy = (top + bottom) / 2;
    ctx.save();
    ctx.beginPath();
    if (apple) {
      // dimple at the top, round shoulders, sides tucking in to a flatter bottom with its own dimple
      ctx.moveTo(cx, top + 22);
      ctx.bezierCurveTo(cx + 34, top - 10, cx + R * 0.92, top - 14, cx + R, top + 64);
      ctx.bezierCurveTo(cx + R * 1.04, top + 140, cx + R * 0.6, bottom + 4, cx + 36, bottom - 2);
      ctx.quadraticCurveTo(cx, bottom - 16, cx - 36, bottom - 2);
      ctx.bezierCurveTo(cx - R * 0.6, bottom + 4, cx - R * 1.04, top + 140, cx - R, top + 64);
      ctx.bezierCurveTo(cx - R * 0.92, top - 14, cx - 34, top - 10, cx, top + 22);
    } else {
      ctx.ellipse(cx, cy, R, (bottom - top) / 2, 0, 0, TAU);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, 10, cx, cy, R * 1.25);
    if (apple) { g.addColorStop(0, '#ff7a7a'); g.addColorStop(0.45, '#ec2f3c'); g.addColorStop(1, '#a8162a'); }
    else { g.addColorStop(0, '#ffc75a'); g.addColorStop(0.5, '#ff9a1f'); g.addColorStop(1, '#d9650a'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    if (apple) {
      // faint streaks running from the stem down round the apple
      ctx.strokeStyle = 'rgba(255,210,120,0.2)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (const k of [-0.7, -0.4, 0.4, 0.7]) { ctx.moveTo(cx + k * 20, top + 26); ctx.quadraticCurveTo(cx + k * R * 1.25, cy, cx + k * 34, bottom - 8); }
      ctx.stroke();
      // the dimple's shadow at the top
      ctx.fillStyle = 'rgba(110,10,25,0.35)'; ctx.beginPath(); ctx.ellipse(cx, top + 26, 30, 10, 0, 0, TAU); ctx.fill();
    } else {
      // the dimpled peel
      ctx.fillStyle = 'rgba(190,80,0,0.22)';
      for (let i = 0; i < 90; i++) {
        const a = i * 2.39996, r = R * 0.98 * Math.sqrt((i + 0.5) / 90);
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.4, 0, TAU); ctx.fill();
      }
    }
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(cx - R * 0.45, cy - R * 0.4, 15, 30, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
    // stem and leaf
    const sway = Math.sin(st.t * 1.3) * 0.08;
    if (apple) {
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, top + 26); ctx.quadraticCurveTo(cx + 2, top - 6, cx + 12, top - 22); ctx.stroke();
      ctx.save(); ctx.translate(cx + 8, top - 6); ctx.rotate(-0.5 + sway);
    } else {
      // the little green star where the stem was
      ctx.fillStyle = '#3f7a22'; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4 : 10; ctx.lineTo(cx + Math.cos(a) * r, top + 6 + Math.sin(a) * r * 0.6); }
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(cx + 4, top + 2); ctx.rotate(-0.45 + sway);
    }
    ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(26, 0, 28, 12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(50, 0); ctx.stroke();
    ctx.restore();
    if (WORM) { ctx.save(); ctx.translate(cx + 76, cy - 4); ctx.scale(1.4, 1.4); drawWorm(0, 0); ctx.restore(); }
  }
  // The worm, poking out of a hole in the apple's side, wiggling and smiling
  function drawWorm(x, y) {
    ctx.fillStyle = '#5a1418'; ctx.beginPath(); ctx.ellipse(x, y, 13, 10, 0, 0, TAU); ctx.fill();
    const peek = 0.75 + 0.25 * Math.sin(st.t * 0.9);
    const seg = [];
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      seg.push([x + 10 + k * 34 * peek + Math.sin(st.t * 4 + i) * 3, y - k * 30 * peek + Math.sin(st.t * 3 + i * 0.8) * 4 * k]);
    }
    for (let i = 0; i < seg.length; i++) {
      ctx.fillStyle = i % 2 ? '#9ad85a' : '#86c84a';
      ctx.beginPath(); ctx.arc(seg[i][0], seg[i][1], 10 - i * 0.4, 0, TAU); ctx.fill();
    }
    const [hx, hy] = seg[seg.length - 1];
    ctx.fillStyle = '#a6e066'; ctx.beginPath(); ctx.arc(hx + 2, hy - 4, 12, 0, TAU); ctx.fill();
    const blink = (st.t % 4) < 0.12;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx - 2, hy - 8, 4, 0, TAU); ctx.arc(hx + 7, hy - 8, 4, 0, TAU); ctx.fill();
    if (!blink) { ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(hx - 1, hy - 7, 2, 0, TAU); ctx.arc(hx + 8, hy - 7, 2, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#2b5a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx + 3, hy - 2, 5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,140,0.6)'; ctx.beginPath(); ctx.arc(hx - 5, hy - 1, 2.5, 0, TAU); ctx.arc(hx + 11, hy - 1, 2.5, 0, TAU); ctx.fill();
  }

  function drawBalloon() {
    const air = st.cam > 4 || st.target > 0;
    const bob = air ? Math.sin(st.t * 1.6) * 6 : 0;
    const shake = st.shake > 0 ? Math.sin(st.t * 70) * 6 * st.shake : 0;
    const cx = BX + shake + (air ? Math.sin(st.t * 0.7) * 4 : 0);
    const by = BASE + bob + st.dipY;      // bottom of the basket
    const mouth = by - 108;

    ctx.save();
    ctx.translate(cx, by); ctx.rotate(Math.sin(st.t * 0.9) * (air ? 0.025 : 0) + st.sway * 0.08); ctx.translate(-cx, -by);

    // flame (behind the envelope's mouth)
    const burn = st.burn > 0 ? Math.min(1, st.burn) : 0;
    const flick = 0.75 + 0.25 * Math.sin(st.t * 40);
    const fl = 10 + 52 * burn * flick;
    const fg = ctx.createLinearGradient(0, by - 92, 0, by - 92 - fl);
    fg.addColorStop(0, 'rgba(120,180,255,0.95)'); fg.addColorStop(0.3, 'rgba(255,230,120,0.95)'); fg.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(cx - 9, by - 92); ctx.quadraticCurveTo(cx, by - 92 - fl * 1.2, cx + 9, by - 92); ctx.fill();

    fruitEnvelope(cx, mouth);
    // skirt
    ctx.fillStyle = FRUIT === 'apple' ? '#8a1424' : '#c2560a';
    ctx.beginPath(); ctx.moveTo(cx - 22, mouth); ctx.lineTo(cx + 22, mouth); ctx.lineTo(cx + 17, mouth + 14); ctx.lineTo(cx - 17, mouth + 14); ctx.fill();
    // ropes
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [a, b] of [[-17, -28], [-6, -10], [6, 10], [17, 28]]) { ctx.moveTo(cx + a, mouth + 14); ctx.lineTo(cx + b, by - 46); }
    ctx.stroke();
    // burner
    ctx.fillStyle = '#9aa3b8'; ctx.fillRect(cx - 10, by - 96, 20, 10);
    ctx.fillStyle = '#6e7586'; ctx.fillRect(cx - 10, by - 88, 20, 3);
    // pilot
    ctx.fillStyle = '#ffd3a1'; ctx.beginPath(); ctx.arc(cx + 9, by - 54, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.arc(cx + 9, by - 58, 11, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = '#2b3550';
    ctx.beginPath(); ctx.arc(cx + 6, by - 54, 1.8, 0, TAU); ctx.arc(cx + 13, by - 54, 1.8, 0, TAU); ctx.fill();
    // basket
    ctx.fillStyle = '#b07a3e'; ctx.fillRect(cx - 30, by - 46, 60, 46);
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = by - 36; y < by; y += 10) { ctx.moveTo(cx - 30, y); ctx.lineTo(cx + 30, y); }
    for (let x = cx - 20; x < cx + 30; x += 12) { ctx.moveTo(x, by - 46); ctx.lineTo(x, by); }
    ctx.stroke();
    ctx.fillStyle = '#7d522b'; ctx.fillRect(cx - 33, by - 50, 66, 7);
    // sandbags
    ctx.fillStyle = '#c9a26b';
    ctx.beginPath(); ctx.ellipse(cx - 36, by - 22, 7, 10, 0, 0, TAU); ctx.ellipse(cx + 36, by - 22, 7, 10, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // sparks while the burner roars
    if (burn > 0.2 && Math.random() < 0.6) {
      fx.push({ kind: 'spark', x: cx + rand(-6, 6), y: by - 96, vx: rand(-30, 30), vy: rand(-160, -60), life: 0.5, max: 0.5, c: Math.random() < 0.5 ? '#ffd23f' : '#ff9a1f', r: rand(2, 3.5) });
    }
  }

  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.life -= dt;
      if (p.life <= 0) { fx.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'confetti') {
        p.vy += 260 * dt; p.vx *= 0.99; p.rot += p.vr * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore();
      } else if (p.kind === 'puff') {
        p.r += 14 * dt;
        ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.kind === 'acorn') {
        p.vy += 900 * dt; p.rot += p.vr * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = '#b8742e'; ctx.beginPath(); ctx.ellipse(0, 3, 8, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.ellipse(0, -6, 9, 5, 0, 0, TAU); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'wisp') {
        p.r += 40 * dt;
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#eef3ff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.kind === 'smoke') {
        p.r += 30 * dt;
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = '#7d8597';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Sky things for the dragon and the tree ------------------------------
  function island(x, y, s, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    // rock underside
    ctx.fillStyle = '#8a6a5a';
    ctx.beginPath(); ctx.moveTo(-90, 0); ctx.quadraticCurveTo(-60, 70, -10, 110); ctx.quadraticCurveTo(10, 80, 30, 95); ctx.quadraticCurveTo(70, 50, 90, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6e5246';
    ctx.beginPath(); ctx.moveTo(20, 0); ctx.quadraticCurveTo(60, 40, 30, 95); ctx.quadraticCurveTo(70, 50, 90, 0); ctx.closePath(); ctx.fill();
    // grass top
    ctx.fillStyle = '#5cc463'; ctx.beginPath(); ctx.ellipse(0, 0, 92, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4aa852'; ctx.beginPath(); ctx.ellipse(0, 4, 92, 12, 0, 0, Math.PI); ctx.fill();
    // a little waterfall off the edge
    if (seed % 2 < 1) {
      ctx.fillStyle = 'rgba(190,230,255,0.85)'; ctx.fillRect(60, 2, 10, 90);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 4; i++) ctx.fillRect(62, ((st.t * 80 + i * 22) % 90) + 2, 6, 8);
    }
    // a tree
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-34, -40, 8, 40);
    ctx.fillStyle = '#2e8b3e'; ctx.beginPath(); ctx.arc(-30, -48, 20, 0, TAU); ctx.arc(-44, -36, 14, 0, TAU); ctx.arc(-16, -36, 14, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function skyCastle(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    cloud(0, 30, 1.1);
    ctx.fillStyle = '#e8e2f2';
    ctx.fillRect(-60, -40, 120, 60);
    for (const tx of [-70, 50]) { ctx.fillRect(tx, -80, 20, 100); ctx.fillStyle = '#7a4fb0'; ctx.beginPath(); ctx.moveTo(tx - 6, -80); ctx.lineTo(tx + 10, -112); ctx.lineTo(tx + 26, -80); ctx.fill(); ctx.fillStyle = '#e8e2f2'; }
    ctx.fillRect(-14, -90, 28, 60);
    ctx.fillStyle = '#7a4fb0'; ctx.beginPath(); ctx.moveTo(-20, -90); ctx.lineTo(0, -130); ctx.lineTo(20, -90); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-6, -70, 12, 16); ctx.fillRect(-40, -20, 10, 12); ctx.fillRect(30, -20, 10, 12);
    ctx.restore();
  }
  function storm(x, y, s, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * 1.3, s * 1.3);
    ctx.fillStyle = '#4b5373';
    ctx.beginPath(); ctx.arc(-50, 8, 34, 0, TAU); ctx.arc(-6, -16, 46, 0, TAU); ctx.arc(44, 0, 38, 0, TAU); ctx.arc(0, 10, 42, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a4060';
    ctx.beginPath(); ctx.arc(-30, 22, 30, 0, TAU); ctx.arc(24, 22, 32, 0, TAU); ctx.fill();
    // a lightning bolt now and then
    if (((st.t + seed) % 4) < 0.18) {
      ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(-14, 80); ctx.lineTo(6, 84); ctx.lineTo(-10, 130); ctx.stroke();
    }
    ctx.restore();
  }
  function aurora(x, y, s, seed) {
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = k ? 'rgba(200,120,255,0.18)' : 'rgba(110,255,190,0.22)';
      ctx.lineWidth = 34 * s;
      ctx.beginPath();
      for (let i = -6; i <= 6; i++) {
        const px = x + i * 50 * s, py = y + Math.sin(st.t * 0.8 + i * 0.6 + seed + k) * 26 * s + k * 26;
        if (i === -6) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  function butterfly(x, y, s, hue, seed) {
    const f = Math.abs(Math.sin(st.t * 12 + seed));
    const bx = x + Math.sin(st.t * 1.3 + seed) * 30, by = y + Math.sin(st.t * 2.1 + seed) * 14;
    ctx.save(); ctx.translate(bx, by); ctx.scale(s, s);
    ctx.fillStyle = `hsl(${hue},85%,62%)`;
    ctx.beginPath(); ctx.ellipse(-8 * f - 2, -4, 9 * f + 1, 8, -0.4, 0, TAU); ctx.ellipse(8 * f + 2, -4, 9 * f + 1, 8, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = `hsl(${(hue + 30) % 360},85%,70%)`;
    ctx.beginPath(); ctx.ellipse(-6 * f - 2, 6, 6 * f + 1, 5, -0.3, 0, TAU); ctx.ellipse(6 * f + 2, 6, 6 * f + 1, 5, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-1.5, -8, 3, 18);
    ctx.restore();
  }
  function fallingLeaf(x, y, s, seed) {
    const z = zoneOfW(st.cam + 300), autumn = z >= 9 && z < 12;
    ctx.save(); ctx.translate(x + Math.sin(st.t * 1.6 + seed) * 24, y); ctx.rotate(Math.sin(st.t * 2 + seed) * 0.8); ctx.scale(s, s);
    ctx.fillStyle = autumn ? (seed % 3 < 1 ? '#e8742c' : '#f2b234') : (seed % 3 < 1 ? '#7cc85a' : '#4aa852');
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.restore();
  }
  function fogBand(y, s, seed) {
    const g = ctx.createLinearGradient(0, y - 60 * s, 0, y + 60 * s);
    g.addColorStop(0, 'rgba(240,244,250,0)'); g.addColorStop(0.5, 'rgba(240,244,250,0.55)'); g.addColorStop(1, 'rgba(240,244,250,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y - 60 * s, W, 120 * s);
  }

  // ---- The dragon ride ---------------------------------------------------------
  function drawCastle(x, gy) {
    ctx.fillStyle = '#b9b2c9';
    ctx.fillRect(x, gy - 120, 220, 120);
    for (let i = 0; i < 11; i++) if (i % 2 === 0) ctx.fillRect(x + i * 20, gy - 134, 20, 14);
    const tower = (tx, h) => {
      ctx.fillStyle = '#a7a0bb'; ctx.fillRect(tx, gy - h, 46, h);
      ctx.fillStyle = '#7a4fb0'; ctx.beginPath(); ctx.moveTo(tx - 8, gy - h); ctx.lineTo(tx + 23, gy - h - 56); ctx.lineTo(tx + 54, gy - h); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx + 23, gy - h - 56); ctx.lineTo(tx + 23, gy - h - 84); ctx.stroke();
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath(); ctx.moveTo(tx + 23, gy - h - 84);
      for (let i = 0; i <= 5; i++) ctx.lineTo(tx + 23 + i * 6, gy - h - 84 + Math.sin(st.t * 6 + i) * 2);
      ctx.lineTo(tx + 53, gy - h - 72); ctx.lineTo(tx + 23, gy - h - 72); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(tx + 17, gy - h + 30, 12, 18);
    };
    tower(x - 30, 190); tower(x + 204, 170); tower(x + 90, 230);
    ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.moveTo(x + 90, gy); ctx.lineTo(x + 90, gy - 46); ctx.arc(x + 110, gy - 46, 20, Math.PI, 0); ctx.lineTo(x + 130, gy); ctx.fill();
  }
  function drawSizeGround() {
    const cam = st.cam * 0.3;
    const gy = BASE + 14 + cam;
    if (gy - 520 > H) return;
    const my = BASE - 40 + cam * 0.35;
    if (my - 360 < H) {
      ctx.fillStyle = '#8b86c9';
      ctx.beginPath(); ctx.moveTo(-20, H + 2000);
      const mtn = x => my - 160 - 150 * Math.abs(Math.sin(x * 0.0035 + 0.4)) - 50 * Math.sin(x * 0.011);
      for (let x = -20; x <= W + 40; x += 30) ctx.lineTo(x, mtn(x));
      ctx.lineTo(W + 40, H + 2000); ctx.fill();
      ctx.fillStyle = '#f2f0ff';
      for (let x = 90; x < W; x += 230) {
        const top = mtn(x);
        ctx.beginPath(); ctx.moveTo(x - 40, top + 36); ctx.lineTo(x, top - 2); ctx.lineTo(x + 40, top + 36); ctx.fill();
      }
    }
    const vy = BASE + 8 + cam * 0.6;
    if (vy - 200 < H) {
      ctx.fillStyle = '#7cc46a';
      ctx.beginPath(); ctx.moveTo(-20, H + 2000);
      for (let x = -20; x <= W + 40; x += 30) ctx.lineTo(x, vy - 24 - 20 * Math.sin(x * 0.005 + 1));
      ctx.lineTo(W + 40, H + 2000); ctx.fill();
      for (const c of cottages) {
        const hy = vy - 24 - 20 * Math.sin(c.x * 0.005 + 1);
        ctx.fillStyle = '#f0e4cf'; ctx.fillRect(c.x, hy - c.h, c.w, c.h + 4);
        ctx.fillStyle = c.roof; ctx.beginPath(); ctx.moveTo(c.x - 6, hy - c.h); ctx.lineTo(c.x + c.w / 2, hy - c.h - 26); ctx.lineTo(c.x + c.w + 6, hy - c.h); ctx.fill();
        ctx.fillStyle = c.lit > 0.5 ? '#ffd86b' : '#7a8bb0'; ctx.fillRect(c.x + 8, hy - c.h + 10, 10, 10);
      }
    }
    ctx.fillStyle = '#4caf50'; ctx.fillRect(-20, gy, W + 40, 30);
    ctx.fillStyle = '#3d8f42'; ctx.fillRect(-20, gy + 30, W + 40, 18);
    ctx.fillStyle = '#7a5537'; ctx.fillRect(-20, gy + 48, W + 40, 1600);
    drawCastle(W * 0.72, gy);
    for (const p of pines) {
      const h = 70 * p.s;
      ctx.fillStyle = '#5b3b22'; ctx.fillRect(p.x - 4, gy - 14, 8, 14);
      ctx.fillStyle = p.c > 0.5 ? '#2f7d45' : '#3b9152';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(p.x - (26 - k * 6) * p.s, gy - 10 - k * 22 * p.s); ctx.lineTo(p.x, gy - 10 - h - k * 10 * p.s); ctx.lineTo(p.x + (26 - k * 6) * p.s, gy - 10 - k * 22 * p.s); ctx.fill(); }
    }
    // the rock the dragon takes off from
    ctx.fillStyle = '#8d8a9e';
    ctx.beginPath(); ctx.moveTo(BX - 110, gy); ctx.quadraticCurveTo(BX - 100, gy - 60, BX - 40, gy - 70); ctx.quadraticCurveTo(BX + 20, gy - 82, BX + 70, gy - 60); ctx.quadraticCurveTo(BX + 110, gy - 40, BX + 120, gy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#76738a';
    ctx.beginPath(); ctx.moveTo(BX + 30, gy - 75); ctx.quadraticCurveTo(BX + 90, gy - 55, BX + 120, gy); ctx.lineTo(BX + 50, gy); ctx.closePath(); ctx.fill();
  }

  // Drawn facing right, nose tilted up, around its middle at (0, 0).
  function dragonBody(fire, perched) {
    const G1 = '#3fbf6a', G2 = '#2a8f4c', BELLY = '#ffe3a3', HORN = '#fff1c9';
    const flapSpeed = st.burn > 0 ? 15 : 6;
    const flap = perched ? -0.5 + Math.sin(st.t * 1.4) * 0.08 : Math.sin(st.t * flapSpeed);
    const wing = (dark) => {
      ctx.save(); ctx.translate(-6, -26); ctx.rotate(-0.2 + flap * 0.55 + (dark ? 0.25 : 0));
      ctx.fillStyle = dark ? '#5b35b0' : '#7a4fd6';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-36, -112);
      ctx.quadraticCurveTo(-70, -90, -128, -96); ctx.quadraticCurveTo(-110, -70, -150, -34);
      ctx.quadraticCurveTo(-110, -30, -112, 6); ctx.quadraticCurveTo(-70, -8, -40, 18); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark ? '#3e2384' : '#4f2fa0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-36, -112); ctx.moveTo(-36, -112); ctx.lineTo(-128, -96); ctx.moveTo(-36, -112); ctx.lineTo(-150, -34); ctx.moveTo(-36, -112); ctx.lineTo(-112, 6); ctx.stroke();
      ctx.restore();
    };
    wing(true);
    // tail
    ctx.fillStyle = G2;
    ctx.beginPath(); ctx.moveTo(-50, -6); ctx.quadraticCurveTo(-140, 10 + Math.sin(st.t * 3) * 10, -200, 50 + Math.sin(st.t * 3 + 1) * 12);
    ctx.quadraticCurveTo(-140, 30, -54, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a4fd6';
    const tx = -200, ty = 50 + Math.sin(st.t * 3 + 1) * 12;
    ctx.beginPath(); ctx.moveTo(tx + 6, ty - 4); ctx.lineTo(tx - 20, ty - 18); ctx.lineTo(tx - 12, ty + 6); ctx.lineTo(tx - 22, ty + 22); ctx.lineTo(tx + 8, ty + 8); ctx.fill();
    // legs
    ctx.fillStyle = G2;
    ctx.beginPath(); ctx.ellipse(-30, 26, 14, 22, 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(34, 24, 9, 16, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = HORN;
    for (const [cx, cy] of [[-24, 46], [40, 38]]) { ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx + 8, cy); ctx.fill(); }
    // body and belly
    ctx.fillStyle = G1; ctx.beginPath(); ctx.ellipse(0, 0, 72, 36, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = BELLY; ctx.beginPath(); ctx.ellipse(4, 14, 56, 18, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = 'rgba(200,150,70,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = -40; i <= 44; i += 14) { ctx.moveTo(i, 16); ctx.lineTo(i + 2, 30); } ctx.stroke();
    // spikes down the back
    ctx.fillStyle = '#7a4fd6';
    for (let i = -56; i <= 40; i += 16) { ctx.beginPath(); ctx.moveTo(i - 7, -30 + Math.abs(i) * 0.08); ctx.lineTo(i, -46 + Math.abs(i) * 0.08); ctx.lineTo(i + 7, -30 + Math.abs(i) * 0.08); ctx.fill(); }
    // neck and head
    ctx.fillStyle = G1;
    ctx.beginPath(); ctx.moveTo(40, -22); ctx.quadraticCurveTo(80, -40, 96, -78); ctx.lineTo(124, -66); ctx.quadraticCurveTo(100, -20, 60, 12); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(118, -82); ctx.rotate(-0.15);
    ctx.fillStyle = HORN;
    ctx.beginPath(); ctx.moveTo(-20, -14); ctx.quadraticCurveTo(-36, -40, -54, -44); ctx.quadraticCurveTo(-34, -30, -10, -18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, -18); ctx.quadraticCurveTo(-14, -46, -30, -56); ctx.quadraticCurveTo(-12, -40, 4, -20); ctx.fill();
    ctx.fillStyle = G1; ctx.beginPath(); ctx.ellipse(0, 0, 34, 24, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(28, 6, 26, 15, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = G2; ctx.beginPath(); ctx.arc(46, 0, 3, 0, TAU); ctx.fill();
    // mouth: open while breathing fire
    ctx.strokeStyle = '#1f5a33'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(14, 14); ctx.quadraticCurveTo(34, fire ? 26 : 18, 52, fire ? 20 : 12); ctx.stroke();
    // eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-2, -6, 9, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(1, -5, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3, -8, 1.8, 0, TAU); ctx.fill();
    ctx.restore();
    wing(false);
    // fire!
    if (fire > 0) {
      ctx.save(); ctx.translate(170, -76); ctx.rotate(-0.25);
      const L = (110 + 40 * Math.sin(st.t * 30)) * Math.min(1, fire);
      const layer = (w, l, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -w * 0.4); ctx.quadraticCurveTo(l * 0.5, -w * 1.2, l, 0); ctx.quadraticCurveTo(l * 0.5, w * 1.2, 0, w * 0.4); ctx.closePath(); ctx.fill(); };
      layer(34, L, '#ff4a1c'); layer(24, L * 0.78, '#ff8a1f'); layer(14, L * 0.52, '#ffd23f'); layer(6, L * 0.28, '#fff6c8');
      ctx.restore();
    }
  }
  function drawDragon() {
    const perched = st.cam < 4 && st.target <= 0;
    const bob = perched ? 0 : Math.sin(st.t * 2.2) * 8;
    const shake = st.shake > 0 ? Math.sin(st.t * 70) * 6 * st.shake : 0;
    const x = BX + shake, y = BASE - 92 + bob + st.dipY;
    ctx.save(); ctx.translate(x, y); ctx.rotate(perched ? -0.12 : -0.32 + st.sway * 0.12); ctx.scale(0.95, 0.95);
    dragonBody(st.burn > 0 ? st.burn : 0, perched);
    ctx.restore();
  }

  // ---- The endless tree ------------------------------------------------------------
  const TRUNK_W = 190;
  const TX = () => BX - 40;
  const TREE_CH = 260;
  const treeCache = new Map();
  function treeChunk(ci) {
    if (treeCache.has(ci)) return treeCache.get(ci);
    if (treeCache.size > 200) treeCache.clear();
    const rng = mulberry32(ci * 4513 + 7);
    const w = ci * TREE_CH + rng() * TREE_CH * 0.6;
    const out = { branch: { w, side: ci % 2 ? 1 : -1, len: 150 + rng() * 170, seed: rng() * 100 } };
    if (ci > 0 && rng() < 0.7) {
      // what grows on the tree here comes from the map
      const fw = ci * TREE_CH + TREE_CH * 0.7;
      const z = zoneOfW(fw);
      const kinds = (z >= 20 ? MAPS.guess.infinite : MAPS.guess.stops[z]).feature || ['nest'];
      out.feature = { kind: kinds[Math.floor(rng() * kinds.length)], w: fw, seed: rng() * 100 };
    }
    treeCache.set(ci, out);
    return out;
  }
  // green leaves, then autumn, pale cloud leaves, frost, and violet leaves up among the stars
  function leafColor(z) {
    return z < 9 ? ['#3a9d4a', '#5cc463'] : z < 12 ? ['#e8742c', '#f2b234'] : z < 16 ? ['#cfe0ef', '#eef6ff'] : z < 17 ? ['#d8ecff', '#ffffff'] : ['#b8a6ff', '#e6dcff'];
  }
  function drawBranch(b) {
    const y = sy(b.w); if (y < -240 || y > H + 240) return;
    const x0 = TX() + b.side * (TRUNK_W / 2 - 14), x1 = x0 + b.side * (b.len + 14);   // starts inside the wavy trunk edge
    ctx.fillStyle = '#6e4a2c';
    ctx.beginPath(); ctx.moveTo(x0, y - 16); ctx.quadraticCurveTo((x0 + x1) / 2, y - 30, x1, y - 44); ctx.lineTo(x1, y - 38); ctx.quadraticCurveTo((x0 + x1) / 2, y - 8, x0, y + 14); ctx.closePath(); ctx.fill();
    const [c1, c2] = leafColor(zoneOfW(b.w));
    for (let i = 0; i < 4; i++) {
      const lx = x0 + b.side * b.len * (0.45 + i * 0.18), ly = y - 30 - i * 5;
      ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.arc(lx, ly - 10, 34 - i * 4, 0, TAU); ctx.fill();
    }
  }
  function drawFeature(f) {
    const y = sy(f.w); if (y < -120 || y > H + 120) return;
    const x = TX() - 40;
    if (f.kind === 'hollow') {
      ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.ellipse(x, y, 26, 36, 0, 0, TAU); ctx.fill();
      const blink = ((st.t + f.seed) % 4) < 0.15;
      ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.arc(x, y + 6, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      if (!blink) { ctx.beginPath(); ctx.arc(x - 7, y + 2, 6, 0, TAU); ctx.arc(x + 7, y + 2, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(x - 7, y + 2, 2.5, 0, TAU); ctx.arc(x + 7, y + 2, 2.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#e8a33c'; ctx.beginPath(); ctx.moveTo(x - 3, y + 8); ctx.lineTo(x + 3, y + 8); ctx.lineTo(x, y + 14); ctx.fill();
    } else if (f.kind === 'door') {
      ctx.fillStyle = '#c4473a'; ctx.beginPath(); ctx.moveTo(x - 18, y + 26); ctx.lineTo(x - 18, y - 6); ctx.arc(x, y - 6, 18, Math.PI, 0); ctx.lineTo(x + 18, y + 26); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x + 9, y + 8, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8fd0ff'; ctx.beginPath(); ctx.arc(x, y - 8, 7, 0, TAU); ctx.fill();
    } else if (f.kind === 'mushroom') {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#e8b77a' : '#d99a55'; ctx.beginPath(); ctx.ellipse(x - 10 + i * 10, y + i * 14, 26 - i * 4, 9, 0, Math.PI, 0); ctx.fill(); }
    } else if (f.kind === 'feeder') {
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 10); ctx.stroke();
      ctx.fillStyle = '#c4473a'; ctx.beginPath(); ctx.moveTo(x - 24, y - 6); ctx.lineTo(x, y - 24); ctx.lineTo(x + 24, y - 6); ctx.fill();
      ctx.fillStyle = '#f0e4cf'; ctx.fillRect(x - 18, y - 6, 36, 24);
      ctx.fillStyle = '#c9a26b'; ctx.fillRect(x - 22, y + 18, 44, 5);
    } else if (f.kind === 'nest') {
      ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(x, y, 30, 12, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.ellipse(x - 10, y - 2, 6, 8, 0, 0, TAU); ctx.ellipse(x + 4, y - 4, 6, 8, 0, 0, TAU); ctx.fill();
    } else if (f.kind === 'lantern') {
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x, y - 14); ctx.stroke();
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 40);
      glow.addColorStop(0, 'rgba(255,220,120,0.7)'); glow.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe28a'; ctx.fillRect(x - 9, y - 14, 18, 24);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 11, y - 16, 22, 4); ctx.fillRect(x - 11, y + 10, 22, 4);
    } else if (f.kind === 'woodpecker') {
      const peck = Math.sin(st.t * 22) > 0 && ((st.t + f.seed) % 3) < 1 ? 4 : 0;
      ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.arc(x + 30, y - 6, 3, 0, TAU); ctx.arc(x + 34, y + 4, 2.5, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(x - peck, y);
      ctx.fillStyle = '#1b1b24'; ctx.beginPath(); ctx.moveTo(-8, 18); ctx.lineTo(-14, 40); ctx.lineTo(-2, 22); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-6, 4, 11, 20, 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-2, 8, 6, 14, 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b1b24'; ctx.beginPath(); ctx.arc(2, -16, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e83a3a'; ctx.beginPath(); ctx.arc(0, -24, 7, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -17, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(26, -15); ctx.lineTo(10, -12); ctx.fill();
      ctx.restore();
    } else if (f.kind === 'flowers') {
      ctx.fillStyle = '#9c6b3c'; ctx.fillRect(x - 34, y, 68, 20); ctx.fillStyle = '#7d522b'; ctx.fillRect(x - 36, y - 3, 72, 5);
      for (let i = 0; i < 5; i++) {
        const fx = x - 26 + i * 13, fy = y - 18 - (i % 2) * 8 + Math.sin(st.t * 2 + i) * 1.5;
        ctx.strokeStyle = '#3a9d4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.fillStyle = ['#ff5d73', '#ffd23f', '#c77dff', '#4fd1ff', '#ff9a1f'][(i + Math.floor(f.seed)) % 5];
        ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = k * TAU / 5; ctx.moveTo(fx + Math.cos(a) * 5 + 4, fy + Math.sin(a) * 5); ctx.arc(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 4, 0, TAU); } ctx.fill();
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, TAU); ctx.fill();
      }
    } else if (f.kind === 'treehouse') {
      const hx = x - 20;
      ctx.fillStyle = '#7d522b'; ctx.fillRect(hx - 64, y + 30, 128, 10);
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx - 54, y + 40); ctx.lineTo(hx - 20, y + 70); ctx.moveTo(hx + 54, y + 40); ctx.lineTo(hx + 20, y + 70); ctx.stroke();
      ctx.fillStyle = '#e8b77a'; ctx.fillRect(hx - 44, y - 30, 88, 60);
      ctx.fillStyle = '#c4473a'; ctx.beginPath(); ctx.moveTo(hx - 54, y - 28); ctx.lineTo(hx, y - 70); ctx.lineTo(hx + 54, y - 28); ctx.fill();
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(hx - 10, y - 4, 20, 34);
      ctx.fillStyle = '#ffd86b'; ctx.fillRect(hx + 18, y - 18, 16, 14); ctx.fillRect(hx - 34, y - 18, 16, 14);
      ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.moveTo(hx, y - 70); ctx.lineTo(hx, y - 92); ctx.lineTo(hx + 18, y - 86); ctx.lineTo(hx, y - 80); ctx.fill();
    } else if (f.kind === 'bignest') {
      ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(x, y + 6, 58, 22, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.ellipse(x, y - 24, 30, 40, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,150,200,0.5)'; for (const [dx, dy] of [[-10, -40], [8, -28], [-6, -14], [12, -48], [-14, -24]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 3.5, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = -50; k <= 50; k += 12) { ctx.moveTo(x + k, y + 4); ctx.lineTo(x + k + 14, y + 20); } ctx.stroke();
      ctx.fillStyle = '#9a7a4a'; ctx.beginPath(); ctx.ellipse(x, y + 4, 60, 10, 0, 0, TAU); ctx.fill();
    } else if (f.kind === 'icicles') {
      ctx.fillStyle = '#f4f8ff'; ctx.beginPath(); ctx.ellipse(x, y - 4, 44, 10, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(x - 44, y - 4, 88, 6);
      ctx.fillStyle = 'rgba(200,235,255,0.95)';
      for (let i = 0; i < 7; i++) { const ix = x - 36 + i * 12, len = 18 + ((i * 13 + Math.floor(f.seed)) % 22); ctx.beginPath(); ctx.moveTo(ix - 4, y + 2); ctx.lineTo(ix, y + 2 + len); ctx.lineTo(ix + 4, y + 2); ctx.fill(); }
      if (((st.t + f.seed) % 2.5) < 0.12) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 10, y - 8, 3, 0, TAU); ctx.fill(); }
    } else if (f.kind === 'dish') {
      ctx.fillStyle = '#9aa3b8'; ctx.fillRect(x - 4, y - 6, 8, 34); ctx.fillRect(x - 16, y + 26, 32, 6);
      ctx.save(); ctx.translate(x, y - 10); ctx.rotate(-0.6 + Math.sin(st.t * 0.4) * 0.15);
      ctx.fillStyle = '#e6e9ef'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 12, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#9aa3b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, 2); ctx.lineTo(0, -26); ctx.lineTo(26, 2); ctx.stroke();
      ctx.fillStyle = Math.sin(st.t * 4) > 0 ? '#ff4d4d' : '#7a2a2a'; ctx.beginPath(); ctx.arc(0, -26, 4, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (f.kind === 'kite') {
      ctx.save(); ctx.translate(x - 10, y - 10); ctx.rotate(0.5 + Math.sin(st.t * 1.4 + f.seed) * 0.08);
      ctx.fillStyle = `hsl(${(f.seed * 37) % 360},85%,60%)`;
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(20, 0); ctx.lineTo(0, 36); ctx.lineTo(-20, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(20, 0); ctx.lineTo(0, 0); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 24, y + 22); for (let i = 1; i <= 6; i++) ctx.lineTo(x - 24 + Math.sin(st.t * 4 + i) * 8, y + 22 + i * 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 10, y - 10); ctx.quadraticCurveTo(x + 30, y + 30, x + 50, y - 20); ctx.stroke();
    }
  }
  // The trunk: gently wavy sides, bark that stays on the tree, a few knots, and at the bottom a base
  // that flares out into roots gripping the ground.
  function drawTrunk() {
    const gy = BASE + 14 + st.cam;
    const cx = TX(), half = TRUNK_W / 2;
    const bottom = Math.min(H + 20, gy + 10);
    const worldAt = y => BASE - y + st.cam;
    const wob = (y, side) => { const w = worldAt(y); return 5 * Math.sin(w * 0.011 + side) + 3 * Math.sin(w * 0.029 + side * 2); };
    const flare = y => { const d = y - (gy - 170); return d > 0 ? Math.pow(d / 170, 2.2) * 80 : 0; };
    const edge = (y, side) => cx + side * (half + flare(y)) + wob(y, side);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(edge(-20, -1), -20);
      for (let y = -20; y <= bottom; y += 14) ctx.lineTo(edge(y, -1), y);
      ctx.lineTo(edge(bottom, -1), bottom); ctx.lineTo(edge(bottom, 1), bottom);
      for (let y = bottom; y >= -20; y -= 14) ctx.lineTo(edge(y, 1), y);
      ctx.closePath();
    };
    // roots, spreading out over the grass on both sides
    if (gy - 200 < H) {
      for (const [d, len, lift, wdt] of [[-1, 210, 4, 34], [-1, 120, 12, 26], [1, 230, 2, 36], [1, 130, 14, 24]]) {
        const x0 = cx + d * (half + 30);
        const rg = ctx.createLinearGradient(x0, 0, x0 + d * len, 0);
        rg.addColorStop(0, '#6e4a2c'); rg.addColorStop(1, '#4e321e');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(x0 - d * 40, gy - 70);
        ctx.quadraticCurveTo(x0 + d * len * 0.35, gy - wdt * 0.6 - lift, x0 + d * len, gy + 6 - lift * 0.2);
        ctx.quadraticCurveTo(x0 + d * len * 0.4, gy + 10, x0 - d * 10, gy + 10);
        ctx.closePath(); ctx.fill();
      }
    }
    // the trunk itself
    const g = ctx.createLinearGradient(cx - half - 60, 0, cx + half + 60, 0);
    g.addColorStop(0, '#4e321e'); g.addColorStop(0.3, '#7a5032'); g.addColorStop(0.45, '#8a5c36'); g.addColorStop(0.75, '#734b2e'); g.addColorStop(1, '#452c1a');
    ctx.save();
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    // bark grooves that slide by as the squirrel climbs; they bend outward where the base flares
    ctx.strokeStyle = 'rgba(40,24,12,0.42)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const step = 46, off = (st.cam % step + step) % step;
    for (let y = -step + off; y < bottom; y += step) {
      const row = Math.floor((y - off + st.cam) / step);
      for (let i = 0; i < 6; i++) {
        const u = (i + 0.5) / 6 * 2 - 1 + (((row * 7 + i * 13) % 10) - 5) * 0.012;   // -1..1 across the trunk
        const at = yy => cx + u * (half + flare(yy)) + wob(yy, u);
        ctx.beginPath(); ctx.moveTo(at(y), y); ctx.quadraticCurveTo(at(y + step * 0.5) + 5, y + step * 0.5, at(y + step * 0.85), y + step * 0.85); ctx.stroke();
      }
    }
    // a knot now and then
    const k0 = Math.floor((st.cam - 300) / 520), k1 = Math.floor((st.cam + H + 300) / 520);
    for (let k = Math.max(0, k0); k <= k1; k++) {
      if (k % 3 === 1) continue;
      const ky = BASE - (k * 520 + 260) + st.cam, kx = cx + (((k * 37) % 70) - 35);
      if (ky < -40 || ky > H + 40 || ky > gy - 120) continue;
      ctx.fillStyle = '#3e2716'; ctx.beginPath(); ctx.ellipse(kx, ky, 11, 17, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(40,24,12,0.5)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(kx, ky, 18, 27, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(160,110,70,0.35)'; ctx.beginPath(); ctx.ellipse(kx - 3, ky - 4, 4, 7, 0, 0, TAU); ctx.fill();
    }
    // light down the left side, shade down the right
    ctx.fillStyle = 'rgba(255,220,170,0.08)'; ctx.fillRect(cx - half * 0.55, -20, half * 0.35, bottom + 20);
    ctx.restore();
    const top = st.cam + BASE + 260, bot = st.cam - (H - BASE) - 260;
    for (let ci = Math.max(0, Math.floor(bot / TREE_CH)); ci <= Math.floor(top / TREE_CH); ci++) {
      const c = treeChunk(ci);
      if (ci > 0) drawBranch(c.branch);
      if (c.feature) drawFeature(c.feature);
    }
    // The Moon Acorn hangs on the tree, glowing
    const mz = MAPS.guess.stops.findIndex(s => s.mark === 'moonacorn');
    const my = sy(markW(mz));
    if (my > -300 && my < H + 300) {
      ctx.strokeStyle = '#6e4a2c'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(TX() - 20, my - 200); ctx.quadraticCurveTo(TX() - 60, my - 160, TX() - 50, my - 90); ctx.stroke();
      ctx.save(); ctx.translate(TX() - 50, my); ctx.scale(0.62, 0.62); moonAcorn(0, 0); ctx.restore();
    }
  }
  function drawGuessGround() {
    const gy = BASE + 14 + st.cam;
    if (gy - 420 > H) return;
    const hy = BASE - 20 + st.cam * 0.4;
    if (hy - 260 < H) {
      ctx.fillStyle = '#8fbfa4';
      ctx.beginPath(); ctx.moveTo(-20, H + 2000);
      for (let x = -20; x <= W + 40; x += 30) ctx.lineTo(x, hy - 90 - 50 * Math.sin(x * 0.004 + 2) - 20 * Math.sin(x * 0.013));
      ctx.lineTo(W + 40, H + 2000); ctx.fill();
    }
    const fy = BASE + 10 + st.cam * 0.7;
    if (fy - 300 < H) {
      for (const t of woods) {
        ctx.fillStyle = t.c > 0.5 ? '#3f8f5a' : '#4f9f68';
        if (t.kind === 'pine') { ctx.beginPath(); ctx.moveTo(t.x - t.w / 2, fy); ctx.lineTo(t.x, fy - t.h); ctx.lineTo(t.x + t.w / 2, fy); ctx.fill(); }
        else { ctx.fillRect(t.x - 4, fy - t.h * 0.4, 8, t.h * 0.4); ctx.beginPath(); ctx.arc(t.x, fy - t.h * 0.6, t.w * 0.55, 0, TAU); ctx.fill(); }
      }
    }
    ctx.fillStyle = '#4caf50'; ctx.fillRect(-20, gy, W + 40, 30);
    ctx.fillStyle = '#3d8f42'; ctx.fillRect(-20, gy + 30, W + 40, 18);
    ctx.fillStyle = '#7a5537'; ctx.fillRect(-20, gy + 48, W + 40, 1600);
    const tx = TX();
    // mushrooms and ferns on the forest floor
    for (let i = 0; i < 10; i++) {
      const mx = (i * 173 + 90) % W;
      if (Math.abs(mx - tx) < TRUNK_W) continue;
      if (i % 2) { ctx.fillStyle = '#f2e8d8'; ctx.fillRect(mx - 3, gy - 14, 6, 14); ctx.fillStyle = '#e8473a'; ctx.beginPath(); ctx.ellipse(mx, gy - 14, 14, 9, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx - 5, gy - 18, 2, 0, TAU); ctx.arc(mx + 5, gy - 17, 2, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = '#2e8b3e'; ctx.lineWidth = 4; ctx.beginPath(); for (const a of [-0.6, 0, 0.6]) { ctx.moveTo(mx, gy); ctx.quadraticCurveTo(mx + a * 30, gy - 30, mx + a * 40, gy - 40); } ctx.stroke(); }
    }
  }
  function drawSquirrel() {
    const x = TX() + TRUNK_W / 2 - 2;
    const hop = st.burn > 0 ? Math.sin(Math.min(1, st.burn) * Math.PI) * -18 : 0;
    const y = BASE - 70 + st.dipY + hop + (st.cam < 4 && st.target <= 0 ? 6 : Math.sin(st.t * 2) * 2);
    ctx.save(); ctx.translate(x, y);
    // tail: a big curl beside the trunk
    const wag = Math.sin(st.t * 3) * 0.08;
    ctx.save(); ctx.rotate(wag);
    ctx.fillStyle = '#c8692c';
    ctx.beginPath(); ctx.moveTo(6, 30); ctx.bezierCurveTo(70, 40, 92, -20, 70, -70); ctx.bezierCurveTo(56, -104, 18, -96, 26, -70);
    ctx.bezierCurveTo(48, -60, 52, -20, 14, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e89a5a';
    ctx.beginPath(); ctx.moveTo(14, 20); ctx.bezierCurveTo(56, 24, 70, -20, 58, -60); ctx.bezierCurveTo(50, -80, 34, -80, 36, -66); ctx.bezierCurveTo(48, -46, 44, -12, 14, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    // body, belly towards the trunk
    ctx.fillStyle = '#b85d27'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 38, -0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2c08a'; ctx.beginPath(); ctx.ellipse(-9, 4, 11, 28, -0.1, 0, TAU); ctx.fill();
    // paws gripping the bark
    ctx.fillStyle = '#9a4a1e';
    ctx.beginPath(); ctx.ellipse(-20, -20, 8, 5, 0.3, 0, TAU); ctx.ellipse(-20, 28, 9, 6, -0.3, 0, TAU); ctx.fill();
    // head
    ctx.fillStyle = '#b85d27'; ctx.beginPath(); ctx.arc(-4, -46, 19, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-16, -56, 12, 9, -0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -60); ctx.lineTo(12, -80); ctx.lineTo(16, -58); ctx.fill();
    ctx.fillStyle = '#f2c08a'; ctx.beginPath(); ctx.ellipse(-12, -42, 8, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(-9, -52, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8, -54, 1.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a1a10'; ctx.beginPath(); ctx.arc(-25, -62, 3, 0, TAU); ctx.fill();
    // a golden acorn after a bullseye
    if (st.gold > 0) {
      ctx.globalAlpha = Math.min(1, st.gold);
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(-30, -24, 9, 11, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b07a3e'; ctx.beginPath(); ctx.ellipse(-30, -34, 10, 5, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---- The Halloween chase ---------------------------------------------------------
  // The jack-o'-lantern balloon flies right, the ghost comes from behind. The game sets the gap
  // and distance; the world scrolls sideways with the distance flown, and the score picks the
  // location on the map: new props come in from the right as you get there, and the sky fades over.
  const hz = { cam: 0, camT: 0, gap: 60, gapT: 60, warn: 0, caught: 0, play: 0, playT: 0, blast: 0, ghostX: null, zone: 0, sky: null, skyFrom: null, skyMix: 1 };
  const PX_PER_M = 9;       // scrolling: screen pixels per metre flown
  const GAP_PX = 4.2;       // the ghost: screen pixels per metre behind
  const hStop = z => (z >= 20 ? MAPS.haunt.infinite : MAPS.haunt.stops[z]);
  const BIG = new Set(['mansion', 'vcastle', 'shop', 'pyramid', 'lake', 'crypt', 'wagon']);
  const HCH = 380;
  const hCache = new Map();
  function hChunk(ci) {
    if (hCache.has(ci)) return hCache.get(ci);
    if (hCache.size > 200) hCache.clear();
    const rng = mulberry32(ci * 9137 + 3 + hz.zone * 71);
    const decor = Object.entries(hStop(hz.zone).decor), total = decor.reduce((s, d) => s + d[1], 0);
    const pick = () => { let r = rng() * total; for (const [k, w] of decor) if ((r -= w) <= 0) return k; return decor[0][0]; };
    const out = [];
    const first = pick();
    if (BIG.has(first)) {
      out.push({ kind: first, x: ci * HCH + HCH * 0.5, s: 0.9 + rng() * 0.2, seed: rng() * 100 });
    } else {
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        let k = i ? pick() : first;
        if (BIG.has(k)) k = decor.find(d => !BIG.has(d[0]))?.[0] || 'pumpkin';
        out.push({ kind: k, x: ci * HCH + (i + 0.15 + rng() * 0.7) * HCH / n, s: 0.8 + rng() * 0.4, seed: rng() * 100 });
      }
    }
    hCache.set(ci, out);
    return out;
  }
  // a new location: the props not on screen yet are swapped for the new location's, and the sky fades over
  function hSetZone(z) {
    if (z === hz.zone) return;
    hz.skyFrom = hz.sky; hz.skyMix = 0;
    hz.zone = z;
    for (const ci of [...hCache.keys()]) if (ci * HCH > hz.cam + W + 40) hCache.delete(ci);
  }
  function hauntSky(dt) {
    const target = hStop(hz.zone).sky.map(hex);
    hz.skyMix = Math.min(1, hz.skyMix + dt * 0.5);
    const from = hz.skyFrom || target;
    hz.sky = target.map((c, k) => c.map((v, j) => lerp(from[k][j], v, hz.skyMix)));
    const g = ctx.createLinearGradient(0, 0, 0, H - 300);
    g.addColorStop(0, css(hz.sky[0])); g.addColorStop(0.55, css(hz.sky[1])); g.addColorStop(1, css(hz.sky[2]));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function moon(red) {
    const x = W * 0.2, y = 190, r = 86;
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4);
    g.addColorStop(0, red ? 'rgba(255,90,70,0.45)' : 'rgba(255,240,190,0.4)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = red ? '#e8604a' : '#fff1b8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = red ? 'rgba(160,40,30,0.35)' : 'rgba(210,190,130,0.45)';
    for (const [dx, dy, rr] of [[-30, -20, 16], [24, 10, 22], [-10, 36, 12], [36, -34, 10]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, rr, 0, TAU); ctx.fill(); }
  }
  function hPumpkin(x, gy, s) {
    ctx.fillStyle = '#e8741a'; ctx.beginPath(); ctx.ellipse(x - 12 * s, gy - 20 * s, 18 * s, 20 * s, 0, 0, TAU); ctx.ellipse(x + 12 * s, gy - 20 * s, 18 * s, 20 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f28a2a'; ctx.beginPath(); ctx.ellipse(x, gy - 20 * s, 18 * s, 22 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a5a1a'; ctx.fillRect(x - 3 * s, gy - 46 * s, 6 * s, 9 * s);
    const f = 0.75 + 0.25 * Math.sin(st.t * 9 + x);
    ctx.fillStyle = `rgba(255,${200 + 40 * f},90,${0.8 * f + 0.2})`;
    ctx.beginPath(); ctx.moveTo(x - 14 * s, gy - 28 * s); ctx.lineTo(x - 6 * s, gy - 22 * s); ctx.lineTo(x - 16 * s, gy - 20 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 14 * s, gy - 28 * s); ctx.lineTo(x + 6 * s, gy - 22 * s); ctx.lineTo(x + 16 * s, gy - 20 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 16 * s, gy - 12 * s); ctx.lineTo(x - 8 * s, gy - 8 * s); ctx.lineTo(x, gy - 13 * s); ctx.lineTo(x + 8 * s, gy - 8 * s); ctx.lineTo(x + 16 * s, gy - 12 * s); ctx.lineTo(x, gy - 4 * s); ctx.fill();
    const glow = ctx.createRadialGradient(x, gy - 18 * s, 4, x, gy - 18 * s, 60 * s);
    glow.addColorStop(0, 'rgba(255,170,60,0.25)'); glow.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, gy - 18 * s, 60 * s, 0, TAU); ctx.fill();
  }
  function hProp(p, x, gy) {
    const s = p.s;
    switch (p.kind) {
      case 'pumpkin': hPumpkin(x, gy, s); break;
      case 'hay': ctx.fillStyle = '#c9a23a'; ctx.fillRect(x - 40 * s, gy - 46 * s, 80 * s, 46 * s); ctx.strokeStyle = '#9a7a22'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 1; i < 4; i++) { ctx.moveTo(x - 40 * s, gy - i * 11 * s); ctx.lineTo(x + 40 * s, gy - i * 11 * s); } ctx.stroke(); break;
      case 'fence': ctx.fillStyle = '#1a1022'; for (let i = 0; i < 7; i++) { ctx.fillRect(x - 60 + i * 18, gy - 64, 7, 64); ctx.beginPath(); ctx.moveTo(x - 62 + i * 18, gy - 64); ctx.lineTo(x - 56.5 + i * 18, gy - 76); ctx.lineTo(x - 51 + i * 18, gy - 64); ctx.fill(); } ctx.fillRect(x - 64, gy - 50, 124, 5); ctx.fillRect(x - 64, gy - 22, 124, 5); break;
      case 'scarecrow': ctx.fillStyle = '#4a2f1a'; ctx.fillRect(x - 3, gy - 130, 6, 130); ctx.fillRect(x - 46, gy - 104, 92, 6); ctx.fillStyle = '#5a3a7a'; ctx.beginPath(); ctx.moveTo(x - 30, gy - 100); ctx.lineTo(x + 30, gy - 100); ctx.lineTo(x + 24, gy - 40); ctx.lineTo(x - 24, gy - 40); ctx.fill(); ctx.fillStyle = '#d9a35a'; ctx.beginPath(); ctx.arc(x, gy - 118, 18, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1022'; ctx.beginPath(); ctx.moveTo(x - 28, gy - 128); ctx.lineTo(x, gy - 168); ctx.lineTo(x + 28, gy - 128); ctx.fill(); ctx.beginPath(); ctx.arc(x - 6, gy - 118, 3, 0, TAU); ctx.arc(x + 6, gy - 118, 3, 0, TAU); ctx.fill(); break;
      case 'corn': ctx.strokeStyle = '#6a7a2a'; ctx.lineWidth = 5; for (let i = 0; i < 5; i++) { const cx = x - 40 + i * 20, h = 110 + (i * 37 + p.seed) % 40; ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx + Math.sin(st.t + i) * 4, gy - h); ctx.stroke(); ctx.fillStyle = '#8a9a3a'; ctx.beginPath(); ctx.ellipse(cx + 8, gy - h * 0.6, 14, 4, -0.6, 0, TAU); ctx.fill(); } break;
      case 'tomb': ctx.fillStyle = '#5a5470'; ctx.beginPath(); ctx.moveTo(x - 22 * s, gy); ctx.lineTo(x - 22 * s, gy - 40 * s); ctx.arc(x, gy - 40 * s, 22 * s, Math.PI, 0); ctx.lineTo(x + 22 * s, gy); ctx.fill(); ctx.fillStyle = '#3a3450'; ctx.fillRect(x - 10 * s, gy - 46 * s, 20 * s, 4 * s); ctx.fillRect(x - 2 * s, gy - 54 * s, 4 * s, 22 * s); break;
      case 'deadtree': ctx.strokeStyle = '#2a1626'; ctx.lineCap = 'round'; ctx.lineWidth = 12 * s; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - 150 * s); ctx.stroke(); ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(x, gy - 100 * s); ctx.lineTo(x - 50 * s, gy - 160 * s); ctx.moveTo(x, gy - 120 * s); ctx.lineTo(x + 60 * s, gy - 170 * s); ctx.moveTo(x - 30 * s, gy - 136 * s); ctx.lineTo(x - 40 * s, gy - 180 * s); ctx.moveTo(x + 36 * s, gy - 148 * s); ctx.lineTo(x + 70 * s, gy - 150 * s); ctx.stroke(); break;
      case 'cauldron': ctx.fillStyle = '#1a1022'; ctx.beginPath(); ctx.ellipse(x, gy - 30, 40, 32, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#7dff6a'; ctx.beginPath(); ctx.ellipse(x, gy - 58, 34, 8, 0, 0, TAU); ctx.fill(); for (let i = 0; i < 3; i++) { const by = gy - 66 - ((st.t * 40 + i * 25) % 70); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x - 12 + i * 12, by, 6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } break;
      case 'house': ctx.fillStyle = '#2a1830'; ctx.fillRect(x - 50, gy - 90, 100, 90); ctx.beginPath(); ctx.moveTo(x - 62, gy - 88); ctx.lineTo(x - 4, gy - 150); ctx.lineTo(x + 58, gy - 88); ctx.fill(); ctx.fillStyle = '#ffb347'; ctx.fillRect(x - 30, gy - 66, 18, 18); ctx.fillRect(x + 12, gy - 66, 18, 18); break;
      case 'mansion': ctx.fillStyle = '#21142a'; ctx.fillRect(x - 130, gy - 200, 260, 200); ctx.beginPath(); ctx.moveTo(x - 146, gy - 196); ctx.lineTo(x, gy - 280); ctx.lineTo(x + 146, gy - 196); ctx.fill(); ctx.fillRect(x - 160, gy - 250, 50, 250); ctx.beginPath(); ctx.moveTo(x - 170, gy - 250); ctx.lineTo(x - 135, gy - 310); ctx.lineTo(x - 100, gy - 250); ctx.fill(); ctx.fillStyle = '#ffb347'; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if ((r * 4 + c + Math.floor(p.seed)) % 3) ctx.fillRect(x - 100 + c * 56, gy - 170 + r * 52, 22, 30); break;
      case 'rock': ctx.fillStyle = '#2a1e33'; ctx.beginPath(); ctx.moveTo(x - 110, gy); ctx.quadraticCurveTo(x - 100, gy - 170, x, gy - 180); ctx.quadraticCurveTo(x + 100, gy - 170, x + 110, gy); ctx.lineTo(x + 60, gy); ctx.quadraticCurveTo(x + 50, gy - 90, x, gy - 96); ctx.quadraticCurveTo(x - 50, gy - 90, x - 60, gy); ctx.closePath(); ctx.fill(); break;
      case 'wagon': {
        ctx.fillStyle = '#4a2f1a'; ctx.fillRect(x - 110, gy - 70, 200, 40);
        ctx.fillStyle = '#c9a23a'; ctx.fillRect(x - 100, gy - 100, 90, 32); ctx.fillRect(x - 6, gy - 96, 80, 28);
        ctx.strokeStyle = '#9a7a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 100, gy - 84); ctx.lineTo(x - 10, gy - 84); ctx.moveTo(x - 6, gy - 82); ctx.lineTo(x + 74, gy - 82); ctx.stroke();
        hPumpkin(x - 60, gy - 100, 0.6); hPumpkin(x + 34, gy - 96, 0.55);
        ctx.strokeStyle = '#2a1626'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x + 90, gy - 50); ctx.lineTo(x + 150, gy - 40); ctx.stroke();
        for (const wx of [-74, 54]) {
          ctx.fillStyle = '#2a1626'; ctx.beginPath(); ctx.arc(x + wx, gy - 24, 24, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4 + hz.cam * 0.02; ctx.moveTo(x + wx - Math.cos(a) * 20, gy - 24 - Math.sin(a) * 20); ctx.lineTo(x + wx + Math.cos(a) * 20, gy - 24 + Math.sin(a) * 20); } ctx.stroke();
        }
        break;
      }
      case 'crypt': {
        ctx.fillStyle = '#4a4560'; ctx.fillRect(x - 80, gy - 120, 160, 120);
        ctx.beginPath(); ctx.moveTo(x - 96, gy - 118); ctx.lineTo(x, gy - 170); ctx.lineTo(x + 96, gy - 118); ctx.fill();
        ctx.fillStyle = '#5a5470'; for (const cx of [-66, -40, 28, 54]) ctx.fillRect(x + cx, gy - 116, 12, 116);
        ctx.fillStyle = '#120a18'; ctx.beginPath(); ctx.moveTo(x - 20, gy); ctx.lineTo(x - 20, gy - 60); ctx.arc(x, gy - 60, 20, Math.PI, 0); ctx.lineTo(x + 20, gy); ctx.fill();
        ctx.fillStyle = '#3a3450'; ctx.fillRect(x - 3, gy - 200, 6, 32); ctx.fillRect(x - 12, gy - 192, 24, 6);
        const f = 0.5 + 0.5 * Math.sin(st.t * 3 + p.seed);
        ctx.fillStyle = `rgba(140,255,170,${0.25 + 0.3 * f})`; ctx.beginPath(); ctx.arc(x - 7, gy - 50, 3, 0, TAU); ctx.arc(x + 7, gy - 50, 3, 0, TAU); ctx.fill();
        break;
      }
      case 'web': {
        const cx = x, cy = gy - 120, R = 70;
        ctx.strokeStyle = '#2a1626'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - 80, gy); ctx.lineTo(x - 76, gy - 200); ctx.moveTo(x + 80, gy); ctx.lineTo(x + 84, gy - 190); ctx.stroke();
        ctx.strokeStyle = 'rgba(230,230,255,0.55)'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
        for (let ring = 1; ring <= 4; ring++) { const r = ring * R / 4; for (let k = 0; k <= 8; k++) { const a = k * TAU / 8, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } }
        ctx.stroke();
        const sy2 = cy + 20 + Math.sin(st.t * 1.5 + p.seed) * 30;
        ctx.beginPath(); ctx.moveTo(cx + 20, cy - R); ctx.lineTo(cx + 20, sy2); ctx.stroke();
        ctx.fillStyle = '#120a18'; ctx.beginPath(); ctx.arc(cx + 20, sy2, 9, 0, TAU); ctx.arc(cx + 20, sy2 - 10, 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#120a18'; ctx.lineWidth = 2; ctx.beginPath(); for (const d of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.moveTo(cx + 20, sy2); ctx.lineTo(cx + 20 + d * 16, sy2 - 8 + k * 8); } ctx.stroke();
        ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(cx + 18, sy2 - 11, 1.5, 0, TAU); ctx.arc(cx + 22, sy2 - 11, 1.5, 0, TAU); ctx.fill();
        break;
      }
      case 'shop': {
        ctx.fillStyle = '#2a1830'; ctx.save(); ctx.translate(x, gy); ctx.rotate(-0.03);
        ctx.fillRect(-90, -130, 180, 130); ctx.beginPath(); ctx.moveTo(-104, -128); ctx.lineTo(-10, -210); ctx.lineTo(104, -128); ctx.fill();
        ctx.fillRect(40, -200, 24, 50);
        ctx.fillStyle = '#7a4a22'; ctx.fillRect(-70, -170, 120, 26);
        ctx.fillStyle = '#ffd86b'; ctx.font = '700 16px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('POTIONS', -10, -151);
        ctx.fillStyle = '#ffb347'; ctx.fillRect(-70, -110, 90, 60);
        const cols = ['#7dff6a', '#c77dff', '#4fd1ff', '#ff5d73'];
        for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(-58 + i * 22, -66, 8, 0, TAU); ctx.fill(); ctx.fillRect(-61 + i * 22, -84, 6, 12); }
        ctx.fillStyle = '#120a18'; ctx.fillRect(36, -80, 34, 80);
        ctx.restore(); ctx.textAlign = 'start';
        for (let i = 0; i < 3; i++) { const yy = gy - 210 - ((st.t * 30 + i * 30) % 90); ctx.fillStyle = `rgba(160,255,150,${0.35 - ((st.t * 30 + i * 30) % 90) / 300})`; ctx.beginPath(); ctx.arc(x + 52 + Math.sin(st.t + i) * 8, yy, 10 + i * 3, 0, TAU); ctx.fill(); }
        break;
      }
      case 'wolf': {
        ctx.fillStyle = '#2a1e33'; ctx.beginPath(); ctx.moveTo(x - 90, gy); ctx.quadraticCurveTo(x - 70, gy - 70, x - 10, gy - 80); ctx.lineTo(x + 50, gy - 74); ctx.quadraticCurveTo(x + 90, gy - 40, x + 100, gy); ctx.fill();
        ctx.save(); ctx.translate(x + 6, gy - 80); ctx.fillStyle = '#140a18';
        ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-46, -30, -30, -40); ctx.lineTo(4, -44); ctx.lineTo(14, -62); ctx.lineTo(22, -90); ctx.lineTo(28, -80); ctx.lineTo(36, -96); ctx.lineTo(38, -78); ctx.lineTo(48, -70);
        ctx.lineTo(30, -56); ctx.lineTo(24, -36); ctx.lineTo(20, 0); ctx.lineTo(12, 0); ctx.lineTo(8, -24); ctx.lineTo(-20, -24); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-38, -30); ctx.quadraticCurveTo(-70, -36, -76, -8); ctx.quadraticCurveTo(-60, -22, -40, -18); ctx.fill();
        ctx.restore();
        if (((st.t + p.seed) % 6) < 1.4) { ctx.strokeStyle = 'rgba(220,220,255,0.35)'; ctx.lineWidth = 2; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(x + 54, gy - 170, k * 14, -1.2, -0.2); ctx.stroke(); } }
        break;
      }
      case 'lake': {
        const g = ctx.createLinearGradient(0, gy - 30, 0, gy + 10);
        g.addColorStop(0, '#1a2f4a'); g.addColorStop(1, '#0f1a2e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, gy - 6, 170, 26, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,230,255,0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); for (let k = 0; k < 5; k++) { const lx = x - 100 + k * 50 + Math.sin(st.t + k) * 6; ctx.moveTo(lx - 14, gy - 10 + (k % 2) * 6); ctx.lineTo(lx + 14, gy - 10 + (k % 2) * 6); } ctx.stroke();
        for (let k = 0; k < 2; k++) {
          const gx2 = x - 60 + k * 110 + Math.sin(st.t * 0.6 + k * 2 + p.seed) * 20, gy2 = gy - 60 - Math.abs(Math.sin(st.t * 0.9 + k)) * 20;
          ctx.fillStyle = 'rgba(220,235,255,0.35)';
          ctx.beginPath(); ctx.arc(gx2, gy2, 16, Math.PI, 0); ctx.lineTo(gx2 + 16, gy2 + 26); ctx.lineTo(gx2 + 6, gy2 + 20); ctx.lineTo(gx2, gy2 + 28); ctx.lineTo(gx2 - 6, gy2 + 20); ctx.lineTo(gx2 - 16, gy2 + 26); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(20,16,32,0.6)'; ctx.beginPath(); ctx.arc(gx2 - 5, gy2 - 2, 2.5, 0, TAU); ctx.arc(gx2 + 5, gy2 - 2, 2.5, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = '#2a3a2a'; ctx.lineWidth = 3; ctx.beginPath(); for (const rx of [-180, -170, 168, 178]) { ctx.moveTo(x + rx, gy); ctx.lineTo(x + rx + 4, gy - 40); } ctx.stroke();
        break;
      }
      case 'skeleton': {
        const t = st.t * 4 + p.seed, b = Math.abs(Math.sin(t)) * 10;
        ctx.save(); ctx.translate(x, gy - b); ctx.scale(s, s);
        ctx.strokeStyle = '#ece6d8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -60); ctx.lineTo(0, -30);                                    // spine
        ctx.moveTo(0, -30); ctx.lineTo(-12 + Math.sin(t) * 6, -6); ctx.lineTo(-14, 0);   // legs
        ctx.moveTo(0, -30); ctx.lineTo(12 - Math.sin(t) * 6, -6); ctx.lineTo(14, 0);
        ctx.moveTo(0, -56); ctx.lineTo(-22, -70 + Math.sin(t) * 18); ctx.lineTo(-30, -90 + Math.sin(t) * 22);   // arms up
        ctx.moveTo(0, -56); ctx.lineTo(22, -70 - Math.sin(t) * 18); ctx.lineTo(30, -90 - Math.sin(t) * 22);
        ctx.stroke();
        ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 0; k < 3; k++) { ctx.moveTo(-10, -54 + k * 7); ctx.lineTo(10, -54 + k * 7); } ctx.stroke();
        ctx.fillStyle = '#ece6d8'; ctx.beginPath(); ctx.arc(0, -74, 13, 0, TAU); ctx.fill(); ctx.fillRect(-7, -66, 14, 8);
        ctx.fillStyle = '#140a18'; ctx.beginPath(); ctx.arc(-5, -75, 3.5, 0, TAU); ctx.arc(5, -75, 3.5, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'pyramid': {
        ctx.fillStyle = '#6a5038'; ctx.beginPath(); ctx.moveTo(x - 150, gy); ctx.lineTo(x - 10, gy - 160); ctx.lineTo(x + 130, gy); ctx.fill();
        ctx.fillStyle = '#4a3828'; ctx.beginPath(); ctx.moveTo(x - 10, gy - 160); ctx.lineTo(x + 130, gy); ctx.lineTo(x + 20, gy); ctx.fill();
        ctx.strokeStyle = 'rgba(30,20,10,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 1; k < 7; k++) { const yy = gy - k * 22, hw = (160 - k * 22) * 0.875; ctx.moveTo(x - 10 - hw, yy); ctx.lineTo(x - 10 + hw, yy); } ctx.stroke();
        ctx.fillStyle = '#140a18'; ctx.fillRect(x - 24, gy - 40, 24, 40);
        // the mummy, shuffling about
        const mx = x + 150 + Math.sin(st.t * 0.6 + p.seed) * 14;
        ctx.fillStyle = '#d8ccb0'; ctx.beginPath(); ctx.ellipse(mx, gy - 50, 16, 44, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(mx, gy - 102, 13, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#d8ccb0'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx, gy - 74); ctx.lineTo(mx + 34, gy - 76 + Math.sin(st.t * 2) * 3); ctx.stroke();
        ctx.strokeStyle = 'rgba(140,120,90,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k < 8; k++) { ctx.moveTo(mx - 16, gy - 86 + k * 11); ctx.lineTo(mx + 16, gy - 80 + k * 11); } ctx.stroke();
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(mx - 4, gy - 104, 2.5, 0, TAU); ctx.arc(mx + 5, gy - 104, 2.5, 0, TAU); ctx.fill();
        break;
      }
      case 'vcastle': {
        ctx.fillStyle = '#140a1c';
        ctx.beginPath(); ctx.moveTo(x - 220, gy); ctx.quadraticCurveTo(x - 160, gy - 70, x, gy - 80); ctx.quadraticCurveTo(x + 160, gy - 70, x + 220, gy); ctx.fill();
        const towers = [[-130, 200, 34], [-70, 260, 40], [0, 330, 50], [70, 250, 40], [130, 210, 34]];
        for (const [dx, h, w] of towers) {
          ctx.fillRect(x + dx - w / 2, gy - 60 - h, w, h);
          ctx.beginPath(); ctx.moveTo(x + dx - w / 2 - 8, gy - 60 - h); ctx.lineTo(x + dx, gy - 60 - h - w * 1.6); ctx.lineTo(x + dx + w / 2 + 8, gy - 60 - h); ctx.fill();
        }
        const f = 0.7 + 0.3 * Math.sin(st.t * 2 + p.seed);
        ctx.fillStyle = `rgba(255,60,60,${f})`;
        for (const [dx, h] of towers) for (let k = 0; k < 2; k++) ctx.fillRect(x + dx - 4, gy - 60 - h + 30 + k * 60, 8, 16);
        break;
      }
      case 'spirit': {
        const bob = Math.sin(st.t * 1.8 + p.seed) * 14, sx = x + Math.sin(st.t * 0.5 + p.seed) * 30, sy3 = gy - 120 + bob;
        const g = ctx.createRadialGradient(sx, sy3, 4, sx, sy3, 70);
        g.addColorStop(0, 'rgba(170,220,255,0.4)'); g.addColorStop(1, 'rgba(170,220,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy3, 70, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(235,245,255,0.8)';
        ctx.beginPath(); ctx.arc(sx, sy3, 22 * s, Math.PI, 0); ctx.lineTo(sx + 22 * s, sy3 + 30 * s);
        for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(sx + (16 - k * 11) * s, sy3 + (40 + (k % 2) * 6) * s + Math.sin(st.t * 4 + k) * 3, sx + (11 - k * 11) * s, sy3 + 30 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a1430'; ctx.beginPath(); ctx.ellipse(sx - 7 * s, sy3 - 2, 3.5 * s, 5 * s, 0, 0, TAU); ctx.ellipse(sx + 7 * s, sy3 - 2, 3.5 * s, 5 * s, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'floatlantern': {
        for (let k = 0; k < 4; k++) {
          const rise = (st.t * (14 + k * 4) + p.seed * 7 + k * 90) % 420;
          const lx = x - 60 + k * 40 + Math.sin(st.t * 0.8 + k + p.seed) * 14, ly = gy - 40 - rise;
          const a = rise < 40 ? rise / 40 : rise > 360 ? (420 - rise) / 60 : 1;
          ctx.globalAlpha = a;
          const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 36);
          g.addColorStop(0, 'rgba(255,190,90,0.6)'); g.addColorStop(1, 'rgba(255,190,90,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 36, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(lx - 10, ly - 14); ctx.lineTo(lx + 10, ly - 14); ctx.lineTo(lx + 8, ly + 12); ctx.lineTo(lx - 8, ly + 12); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff1b8'; ctx.fillRect(lx - 3, ly + 4, 6, 6);
          ctx.globalAlpha = 1;
        }
        break;
      }
    }
  }
  function hBats(n) {
    ctx.fillStyle = '#140a18';
    for (let i = 0; i < n; i++) {
      const x = wrapX(W - ((st.t * (60 + i * 9) + i * 211) % (W + 400)) + 200, 200);
      const y = 120 + (i * 53) % 260 + Math.sin(st.t * 2 + i) * 18;
      const f = Math.sin(st.t * 14 + i) * 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 10, y - 8 - f, x - 22, y - f); ctx.quadraticCurveTo(x - 12, y + 2, x, y + 4); ctx.quadraticCurveTo(x + 12, y + 2, x + 22, y - f); ctx.quadraticCurveTo(x + 10, y - 8 - f, x, y); ctx.fill();
    }
    // a witch on her broom now and then
    const wx = wrapX(((st.t * 90) % (W + 900)) - 300, 300), wy = 90 + Math.sin(st.t * 0.7) * 20;
    ctx.save(); ctx.translate(wx, wy);
    ctx.strokeStyle = '#140a18'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-30, 8); ctx.lineTo(30, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, 8); ctx.lineTo(-44, 2); ctx.lineTo(-44, 16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(6, 4); ctx.lineTo(2, -14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(10, -12); ctx.lineTo(4, -32); ctx.fill();
    ctx.restore();
  }
  // The jack-o'-lantern balloon, at (cx, by): by is the bottom of the basket.
  function jackBalloon(cx, by, candle) {
    const mouth = by - 108, RX = 128, RY = 100, cyE = mouth - 108;
    // the neck the ropes hang from
    ctx.fillStyle = '#d85f0c';
    ctx.beginPath(); ctx.moveTo(cx - 40, cyE + RY - 18); ctx.quadraticCurveTo(cx - 26, mouth - 6, cx - 22, mouth); ctx.lineTo(cx + 22, mouth); ctx.quadraticCurveTo(cx + 26, mouth - 6, cx + 40, cyE + RY - 18); ctx.fill();
    // lobes: the outer ones darker, the middle one brightest
    const lobes = [[-0.62, 0.5, '#d9620c'], [0.62, 0.5, '#d9620c'], [-0.34, 0.62, '#ec7212'], [0.34, 0.62, '#ec7212'], [0, 0.56, '#ff8a1a']];
    for (const [dx, w, col] of lobes) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(cx + dx * RX, cyE, RX * w, RY, 0, 0, TAU); ctx.fill();
    }
    const sh = ctx.createRadialGradient(cx - 50, cyE - 50, 10, cx, cyE, RX * 1.2);
    sh.addColorStop(0, 'rgba(255,240,200,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(60,10,0,0.25)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(cx, cyE, RX * 1.12, RY, 0, 0, TAU); ctx.fill();
    // stem
    ctx.fillStyle = '#3a5a1a';
    ctx.beginPath(); ctx.moveTo(cx - 10, cyE - RY + 10); ctx.quadraticCurveTo(cx - 8, cyE - RY - 22, cx + 12, cyE - RY - 30); ctx.lineTo(cx + 14, cyE - RY - 20); ctx.quadraticCurveTo(cx + 6, cyE - RY - 12, cx + 10, cyE - RY + 10); ctx.fill();
    ctx.strokeStyle = '#4a7a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 8, cyE - RY - 6); ctx.quadraticCurveTo(cx + 34, cyE - RY - 24, cx + 26, cyE - RY - 2); ctx.stroke();
    // the carved face, lit from inside
    const f = 0.8 + 0.2 * Math.sin(st.t * 11) + 0.1 * Math.sin(st.t * 23);
    const lit = candle > 0;
    const inner = lit ? ctx.createRadialGradient(cx, cyE + 10, 4, cx, cyE + 10, 100) : null;
    if (inner) { inner.addColorStop(0, `rgba(255,250,190,${f})`); inner.addColorStop(1, `rgba(255,150,30,${0.9 * f})`); }
    ctx.fillStyle = lit ? inner : '#2a1408';
    ctx.beginPath(); ctx.moveTo(cx - 70, cyE - 30); ctx.lineTo(cx - 24, cyE - 4); ctx.lineTo(cx - 74, cyE + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 70, cyE - 30); ctx.lineTo(cx + 24, cyE - 4); ctx.lineTo(cx + 74, cyE + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 9, cyE + 22); ctx.lineTo(cx, cyE + 8); ctx.lineTo(cx + 9, cyE + 22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 84, cyE + 34);
    const teeth = [[-60, 48], [-44, 36], [-28, 52], [-8, 38], [10, 54], [28, 38], [44, 52], [62, 38], [84, 34]];
    for (const [dx, dy] of teeth) ctx.lineTo(cx + dx, cyE + dy);
    ctx.quadraticCurveTo(cx, cyE + 96, cx - 84, cyE + 34); ctx.fill();
    if (lit) {
      const g = ctx.createRadialGradient(cx, cyE + 20, 10, cx, cyE + 20, 230);
      g.addColorStop(0, `rgba(255,170,60,${0.18 * f})`); g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cyE + 20, 230, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#7a3a12';
    ctx.beginPath(); ctx.moveTo(cx - 22, mouth); ctx.lineTo(cx + 22, mouth); ctx.lineTo(cx + 17, mouth + 14); ctx.lineTo(cx - 17, mouth + 14); ctx.fill();
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [a, b] of [[-17, -28], [-6, -10], [6, 10], [17, 28]]) { ctx.moveTo(cx + a, mouth + 14); ctx.lineTo(cx + b, by - 46); }
    ctx.stroke();
    ctx.fillStyle = '#ffd3a1'; ctx.beginPath(); ctx.arc(cx + 9, by - 54, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.arc(cx + 9, by - 58, 11, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = '#2b3550'; ctx.beginPath(); ctx.arc(cx + 6, by - 54, 1.8, 0, TAU); ctx.arc(cx + 13, by - 54, 1.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(cx - 30, by - 46, 60, 46);
    ctx.strokeStyle = '#5a3414'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = by - 36; y < by; y += 10) { ctx.moveTo(cx - 30, y); ctx.lineTo(cx + 30, y); }
    ctx.stroke();
    ctx.fillStyle = '#5a3414'; ctx.fillRect(cx - 33, by - 50, 66, 7);
  }
  // The ghost, facing right, its tail streaming out behind. reach: 0..1 how far its hands stretch.
  function ghost(gx, gy, s, reach, eyes, wrap) {
    ctx.save(); ctx.translate(gx, gy); ctx.scale(s, s);
    const wob = Math.sin(st.t * 3) * 6;
    // one outline from the round head, down the wavy hem, out to the tail tip and back over the top,
    // so the tail grows out of the head with no seam
    const g = ctx.createLinearGradient(-210, 0, 80, 0);
    g.addColorStop(0, '#d6e0f5'); g.addColorStop(0.45, '#eef3ff'); g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(80, -4);
    ctx.bezierCurveTo(82, 30, 78, 56, 66, 80);
    for (let i = 0; i < 4; i++) { const x0 = 66 - i * 26; ctx.quadraticCurveTo(x0 - 13, 98 + (i % 2) * 6 + wob * 0.3, x0 - 26, 82); }
    ctx.bezierCurveTo(-90, 80 + wob, -150, 60 + wob, -212, 22 + wob);
    ctx.bezierCurveTo(-150, 8 + wob * 0.5, -96, -6, -62, -34);
    ctx.bezierCurveTo(-46, -84, 50, -98, 80, -4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(160,180,220,0.18)';
    ctx.beginPath(); ctx.ellipse(-40, 50, 70, 18, -0.1, 0, TAU); ctx.fill();
    // hands reaching for the balloon
    if (reach > 0) {
      ctx.strokeStyle = '#eef3ff'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      for (const dy of [26, 52]) { ctx.beginPath(); ctx.moveTo(56, dy); ctx.quadraticCurveTo(56 + 50 * reach, dy - 10, 70 + 80 * reach, dy - 4 + Math.sin(st.t * 8 + dy) * 4); ctx.stroke(); }
    }
    // eyes: glowing when it's close, red when it's about to lunge
    if (eyes.glow > 0) {
      const eg = ctx.createRadialGradient(36, -14, 4, 36, -14, 70);
      eg.addColorStop(0, eyes.red ? `rgba(255,40,40,${0.6 * eyes.glow})` : `rgba(160,220,255,${0.5 * eyes.glow})`); eg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(36, -14, 70, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = eyes.red ? '#d01818' : '#141020';
    ctx.beginPath(); ctx.ellipse(22, -16, 11, 17, 0, 0, TAU); ctx.ellipse(52, -16, 11, 17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#141020'; ctx.beginPath(); ctx.ellipse(38, 22, 10, 14, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawHaunt(dt) {
    hz.cam += (hz.camT - hz.cam) * Math.min(1, dt * 3);
    hz.gap += (hz.gapT - hz.gap) * Math.min(1, dt * 4);
    hz.play += (hz.playT - hz.play) * Math.min(1, dt * 2.5);
    const stop = hStop(hz.zone);
    hauntSky(dt);
    // stars
    ctx.fillStyle = '#fff';
    for (const s0 of stars) { if (s0.y > H * 0.55) continue; ctx.globalAlpha = 0.4 + 0.4 * Math.sin(st.t * 2 + s0.p); ctx.beginPath(); ctx.arc(s0.x, s0.y, s0.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    moon(!!stop.redMoon);
    const HY = H - 300;   // where the ground starts; the card strip covers what's below
    // far hills
    ctx.fillStyle = hz.zone >= 18 ? '#2a2650' : '#3a1f3a';
    ctx.beginPath(); ctx.moveTo(-20, H);
    for (let x = -20; x <= W + 40; x += 30) { const wx = x + hz.cam * 0.15; ctx.lineTo(x, HY - 70 - 40 * Math.sin(wx * 0.004) - 18 * Math.sin(wx * 0.013)); }
    ctx.lineTo(W + 40, H); ctx.fill();
    // fog glow over the ground
    const fg = ctx.createLinearGradient(0, HY - 60, 0, HY + 40);
    fg.addColorStop(0, 'rgba(255,140,80,0)'); fg.addColorStop(1, 'rgba(255,140,80,0.18)');
    ctx.fillStyle = fg; ctx.fillRect(0, HY - 60, W, 100);
    hBats(stop.bats || 9);
    // ground and props
    ctx.fillStyle = '#1a0f1f'; ctx.fillRect(0, HY, W, H - HY);
    ctx.fillStyle = '#2a1a2a'; ctx.fillRect(0, HY, W, 8);
    const c0 = Math.floor((hz.cam - 300) / HCH), c1 = Math.floor((hz.cam + W + 300) / HCH);
    for (let ci = c0; ci <= c1; ci++) for (const p of hChunk(ci)) hProp(p, p.x - hz.cam, HY + 6);
    // the balloon: on the left on the title screen, on the right while playing
    const bx = lerp(W * 0.25, W * 0.64, hz.play), byB = H * 0.47 + Math.sin(st.t * 1.6) * 8 + st.dipY;
    ctx.save(); ctx.translate(bx, byB); ctx.rotate(Math.sin(st.t * 0.9) * 0.03 + st.sway * 0.06); ctx.translate(-bx, -byB);
    jackBalloon(bx, byB, hz.caught > 0.5 ? 0 : 1);
    ctx.restore();
    // the ghost, the gap behind it
    const close = clamp((40 - hz.gap) / 40, 0, 1);
    let gx = bx - 150 - Math.max(0, hz.gap) * GAP_PX;
    if (hz.caught > 0) gx = lerp(gx, bx - 70, Math.min(1, hz.caught));
    const lungeShake = hz.warn > 0 ? Math.sin(st.t * 60) * 5 : 0;
    ghost(gx + lungeShake, H * 0.36 + Math.sin(st.t * 2.4) * 14, 1, close * (hz.caught > 0 ? 1 : 0.9), { glow: Math.max(close, hz.warn), red: hz.warn > 0 }, hz.caught);
    // the dark creeps in as the ghost gets close
    if (close > 0 || hz.caught > 0) {
      const a = Math.max(close * 0.5, Math.min(0.6, hz.caught * 0.6));
      const v = ctx.createRadialGradient(bx, H * 0.4, 100, bx, H * 0.4, W * 0.75);
      v.addColorStop(0, `rgba(10,0,20,${a * 0.4})`); v.addColorStop(1, `rgba(10,0,20,${a})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
    if (hz.caught > 0) hz.caught = Math.min(2, hz.caught + dt * 0.8);
  }

  // ---- Switching worlds: the old picture slides out as the new one slides in ----------------
  let oldCanvas = null;
  function slide(dir) {
    if (!oldCanvas) return;
    oldCanvas.width = canvas.width; oldCanvas.height = canvas.height;
    oldCanvas.style.width = canvas.style.width; oldCanvas.style.height = canvas.style.height;
    oldCanvas.getContext('2d').drawImage(canvas, 0, 0);
    for (const c of [canvas, oldCanvas]) c.classList.remove('sliding');
    oldCanvas.style.transform = 'translateX(0)';
    canvas.style.transform = `translateX(${dir * 100}%)`;
    oldCanvas.classList.remove('hidden');
    void canvas.offsetWidth;
    for (const c of [canvas, oldCanvas]) c.classList.add('sliding');
    oldCanvas.style.transform = `translateX(${-dir * 100}%)`;
    canvas.style.transform = 'translateX(0)';
    clearTimeout(slide.t);
    slide.t = setTimeout(() => { oldCanvas.classList.add('hidden'); canvas.classList.remove('sliding'); oldCanvas.classList.remove('sliding'); }, 600);
  }

  // ---- Loop ----------------------------------------------------------------
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    st.t += dt;
    st.cam += (st.target - st.cam) * Math.min(1, dt * 2.2);
    st.burn = Math.max(0, st.burn - dt);
    st.shake = Math.max(0, st.shake - dt * 1.5);
    // dip: a spring pulling the balloon back to its place
    st.dipV += (-60 * st.dipY - 7 * st.dipV) * dt;
    st.dipY += st.dipV * dt;
    st.sway *= Math.pow(0.1, dt);
    st.gold = Math.max(0, (st.gold || 0) - dt * 0.6);

    if (world === 'haunt') {
      drawHaunt(dt);
    } else {
      drawSky();
      drawStars();
      drawSun();
      drawEarthCurve();
      drawDecor();
      drawEgg(dt);
      if (world === 'size') { drawSizeGround(); drawDragon(); }
      else if (world === 'guess') { drawGuessGround(); drawTrunk(); drawSquirrel(); }
      else { drawGround(); drawBalloon(); }
    }
    drawFx(dt);
    requestAnimationFrame(frame);
  }

  // where the vehicle is on screen, for effects
  function vehiclePos() {
    if (world === 'haunt') return { x: lerp(W * 0.25, W * 0.64, hz.play), y: H * 0.47 - 200 };
    if (world === 'size') return { x: BX + 150, y: BASE - 190 + st.dipY };
    if (world === 'guess') return { x: TX() + TRUNK_W / 2 - 20, y: BASE - 110 + st.dipY };
    return { x: BX, y: BASE - 100 + st.dipY };
  }

  return {
    init(cv, old) {
      canvas = cv; ctx = canvas.getContext('2d'); oldCanvas = old || null;
      requestAnimationFrame(t => { last = t; frame(t); });
    },
    // w, h: stage size in game pixels; scale: game pixels to CSS pixels
    resize(w, h, scale) {
      W = w; H = h; BASE = H - 118; BX = Math.max(230, Math.min(340, W * 0.2));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * scale * dpr); canvas.height = Math.round(H * scale * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      layout();
    },
    // where you are on the map: your score
    setAlt(score, instant) { st.target = wy(score); if (instant) st.cam = st.target; },
    burn(sec = 1.3) { st.burn = sec; },
    dip() {
      st.dipV = 260; st.shake = 0.6; st.sway = (Math.random() < 0.5 ? -1 : 1);
      const v = vehiclePos();
      if (world === 'guess') {
        fx.push({ kind: 'acorn', x: v.x - 10, y: v.y + 20, vx: rand(-40, 40), vy: -160, rot: 0, vr: rand(-8, 8), life: 1.6, max: 1.6 });
        return;
      }
      if (world === 'haunt') return;
      // the balloon's burner coughs smoke; the dragon sneezes it
      for (let i = 0; i < 8; i++) fx.push({ kind: 'smoke', x: v.x + rand(-12, 12), y: v.y, vx: rand(-40, 40), vy: rand(-70, -30), life: 1.1, max: 1.1, r: rand(6, 12) });
    },
    // which world to draw; dir (-1 or 1) slides the old one out that way
    setWorld(name, dir) {
      if (name === world) return;
      if (dir) slide(dir);
      world = name;
      st.cam = st.target = 0; st.burn = 0; st.dipY = st.dipV = 0; egg = null;
      hz.cam = hz.camT = 0; hz.gap = hz.gapT = 60; hz.caught = 0; hz.warn = 0;
      hz.zone = 0; hz.sky = hz.skyFrom = null; hz.skyMix = 1; hCache.clear();
    },
    // the Halloween chase: gap (metres the ghost is behind), dist (metres flown), warn (0..1 lunge warning), play
    chase(o) {
      if (o.gap != null) hz.gapT = o.gap;
      if (o.dist != null) hz.camT = o.dist * PX_PER_M;
      if (o.warn != null) hz.warn = o.warn;
      if (o.play != null) hz.playT = o.play ? 1 : 0;
      if (o.score != null) hSetZone(mapPlace('haunt', o.score).i);
      if (o.rewind) { hz.caught = 0; hz.warn = 0; hCache.clear(); }   // play again: the night scrolls back to the start
      if (o.reset) { hz.cam = hz.camT; hz.gap = hz.gapT; hz.caught = 0; hCache.clear(); hz.skyFrom = null; hz.skyMix = 1; }
    },
    caught() { hz.caught = 0.01; },
    blast() {
      const bx = lerp(W * 0.25, W * 0.64, hz.play), gx = bx - 150 - Math.max(0, hz.gap) * GAP_PX;
      for (let i = 0; i < 26; i++) fx.push({ kind: 'wisp', x: gx + rand(-90, 60), y: H * 0.36 + rand(-60, 60), vx: rand(-200, -40), vy: rand(-60, 60), life: 0.9, max: 0.9, r: rand(8, 16) });
    },
    gold() { st.gold = 2.5; },
    confetti(n = 120, x = null) {
      const cols = ['#ff5d73', '#ffd23f', '#4fd1ff', '#7ddc6f', '#c77dff', '#ff9a1f'];
      for (let i = 0; i < n; i++) {
        fx.push({ kind: 'confetti', x: x == null ? rand(0, W) : x + rand(-100, 100), y: x == null ? rand(-60, -10) : H * 0.4, vx: rand(-160, 160), vy: x == null ? rand(40, 180) : rand(-520, -200), rot: rand(0, TAU), vr: rand(-8, 8), life: 2.6, max: 2.6, c: cols[i % cols.length], r: rand(4, 7) });
      }
    },
    rocket() { if (world !== 'haunt') launchEgg(); },
    balloonX: () => vehiclePos().x
  };
})();
