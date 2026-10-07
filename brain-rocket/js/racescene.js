/* Brain Rocket — the World Race world: a car driving around the planet, side-on
   (same API as Scene, SubScene and DrillScene). */
'use strict';

const RaceScene = (function () {
  const W = 1600, H = 900;
  const KX = 3;             // screen pixels per point of distance (for landmarks and coastlines)
  const CARX = 430;         // the car's x on screen
  const LANE = 784;         // y of the car's wheels (middle lane)
  const ROAD_TOP = 702, ROAD_BOT = 856;
  const LAP = 52000;        // New York round to Los Angeles (50,000), then across America to New York again
  const TAU = Math.PI * 2;
  const CRUISE = 520;       // how fast the road rushes past (px/s); boost adds to it

  let canvas, ctx, pxScale = 1;
  const st = {
    cam: 0, target: 0, vel: 0, t: 0, drive: 0, speed: CRUISE, boost: 0, kick: 0, ignite: 0,
    dead: false, deadT: 0, shake: 0, streak: 0, flash: 0, emit: 0,
    crash: null   // bad word: spin round and race backwards to New York
  };
  const parts = [];   // exhaust, dust, sparks (screen space, scrolled with the road)
  const fx = [];      // confetti, rings
  const traffic = []; // other cars
  let onMilestone = null;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixc = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; };
  const blob = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const poly = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };

  // ---- Where are we? -----------------------------------------------------
  const lapPos = a => ((a % LAP) + LAP) % LAP;
  // The nearest copy of a place (the route repeats every lap).
  const near = a => a + LAP * Math.round((st.cam - a) / LAP);
  function segment(a) {
    const p = lapPos(a);
    for (let i = 0; i < RACE_STOPS.length - 1; i++) {
      const s = RACE_STOPS[i], e = RACE_STOPS[i + 1];
      if (p < e.alt) return [s, e, (p - s.alt) / (e.alt - s.alt)];
    }
    // Los Angeles back across America to New York for the next lap
    const L = RACE_STOPS[RACE_STOPS.length - 1];
    return [L, RACE_STOPS[0], (p - L.alt) / (LAP - L.alt)];
  }
  const inRange = (list, a) => { const p = lapPos(a); return list.find(([f, t]) => p >= f && p <= t); };
  const isSea = a => !!inRange(RACE_SEAS, a);
  const isTunnel = a => !!inRange(RACE_TUNNELS, a);
  const biomeAt = a => { const [s, e, t] = segment(a); return (t < 0.5 ? s : e).biome; };

  // ---- Weather (looks only) ---------------------------------------------------
  const SKIES = {
    clear: ['#5fb4ff', '#cfeeff'], cloudy: ['#8fa6bd', '#d7e1ea'], rain: ['#6f8296', '#b4c2cf'],
    monsoon: ['#56667a', '#9aa9b6'], storm: ['#3e4856', '#7b8794'], snow: ['#a9bccb', '#e8eef3'],
    fog: ['#b7c0c8', '#e3e7ea'], sand: ['#d9a865', '#f2d6a2'], heat: ['#7ec3ff', '#fff1c9'],
    blossom: ['#8fd0ff', '#ffe4f0'], night: ['#0a0f2e', '#2a2458'], sunset: ['#ff8a5c', '#ffd88a']
  };
  // How much of each effect a weather has.
  const WX = {
    clear: {}, cloudy: { clouds: 1 }, rain: { rain: 0.6, clouds: 1 }, monsoon: { rain: 1, clouds: 1 },
    storm: { rain: 0.9, clouds: 1, lightning: 1 }, snow: { snow: 1, clouds: 0.6 }, fog: { fog: 1 },
    sand: { sand: 1 }, heat: { heat: 1 }, blossom: { petals: 1 }, night: { night: 1 }, sunset: { sunset: 1 }
  };
  // Weather blends from one city's to the next around the middle of the drive.
  function weather() {
    const [s, e, t] = segment(st.cam);
    const f = clamp((t - 0.4) / 0.2, 0, 1);
    const k = f * f * (3 - 2 * f);
    const A = SKIES[s.wx], B = SKIES[e.wx];
    const fxA = WX[s.wx], fxB = WX[e.wx];
    const amt = name => (fxA[name] || 0) * (1 - k) + (fxB[name] || 0) * k;
    return { top: mixc(A[0], B[0], k), bot: mixc(A[1], B[1], k), amt };
  }

  // ---- Countryside ----------------------------------------------------------------
  const BIOMES = {
    temperate: { ground: '#5fae4f', hill: '#7fbf6a', far: '#9cc3d6', tree: 'round' },
    med:       { ground: '#a9b85c', hill: '#c2c477', far: '#b9c9d8', tree: 'cypress' },
    desert:    { ground: '#e3c27c', hill: '#e9cf95', far: '#e6c9a3', tree: 'palm' },
    desertus:  { ground: '#d9a86a', hill: '#c98a55', far: '#d9a98a', tree: 'cactus' },
    savanna:   { ground: '#c8b25a', hill: '#b8a65a', far: '#c3b9a0', tree: 'acacia' },
    tropical:  { ground: '#3f9a4a', hill: '#4fae57', far: '#8fb8a8', tree: 'palm' },
    snow:      { ground: '#eef3f7', hill: '#dfe8ef', far: '#c7d3de', tree: 'pine' },
    scrub:     { ground: '#b5a35a', hill: '#a89a5a', far: '#b8b4a0', tree: 'gum' },
    grass:     { ground: '#8fc45a', hill: '#9fcf6a', far: '#a9c4cf', tree: 'round' },
    mountain:  { ground: '#8a9a6a', hill: '#7a8a6a', far: '#a3a9b4', tree: 'pine' }
  };

  // 0 out at sea, rising to 1 a few hundred pixels inland, so hills slope down to the water
  // instead of stopping dead at the coast.
  function landness(x) {
    const a = vAlt(x), p = lapPos(a);
    let d = Infinity;
    for (const [f, t] of RACE_SEAS) {
      if (p >= f && p <= t) return 0;
      d = Math.min(d, Math.abs(p - f), Math.abs(p - t));
    }
    const k = clamp(d * KX / 380, 0, 1);
    return k * k * (3 - 2 * k);
  }

  function drawFar(w) {
    const off = st.cam * KX * 0.12 + st.drive * 0.04;
    const b = BIOMES[biomeAt(st.cam)];
    // the open sea is always there behind the hills; it shows wherever the land drops away
    const g = ctx.createLinearGradient(0, 560, 0, ROAD_TOP);
    g.addColorStop(0, '#3d8fd1'); g.addColorStop(1, '#1f5fa0');
    rect(-30, 560, W + 60, ROAD_TOP - 560 + 4, g);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 18; i++) { const x = ((i * 137 - off * 2) % (W + 200) + W + 200) % (W + 200) - 100; ctx.fillRect(x, 590 + (i % 5) * 22, 40, 2); }
    const sx = ((900 - off * 0.6) % (W + 400) + W + 400) % (W + 400) - 200;
    if (landness(sx) < 0.2) {
      poly([[sx - 60, 572], [sx + 60, 572], [sx + 48, 588], [sx - 48, 588]], '#33394a');
      rect(sx - 20, 556, 40, 16, '#e8e8f0'); rect(sx - 4, 540, 8, 16, '#e8364f');
    }
    const lands = [];
    for (let x = -30; x <= W + 30; x += 30) lands.push([x, landness(x)]);
    ctx.fillStyle = mixc(b.far, '#ffffff', w.amt('fog') * 0.5);
    ctx.beginPath(); ctx.moveTo(-30, 641);
    for (const [x, L] of lands) { const u = (x + off) * 0.004; const top = 520 - Math.abs(Math.sin(u)) * 90 - Math.sin(u * 2.7) * 30; ctx.lineTo(x, lerp(641, top, L)); }
    ctx.lineTo(W + 30, 641); ctx.fill();
    ctx.fillStyle = b.hill;
    ctx.beginPath(); ctx.moveTo(-30, ROAD_TOP + 1);
    for (const [x, L] of lands) { const u = (x + off * 2.2) * 0.006; const top = 610 - Math.abs(Math.sin(u + 1)) * 50; ctx.lineTo(x, lerp(ROAD_TOP + 1, Math.min(top, 641), Math.min(1, L * 1.4))); }
    ctx.lineTo(W + 30, ROAD_TOP + 1); ctx.fill();
  }

  // ---- Landmarks -------------------------------------------------------------------
  // Each draws its city's skyline standing on the ground line y.
  const LAND = {
    ny(x, y) {
      for (let i = 0; i < 9; i++) { const h = 120 + hash(i) * 160; rect(x - 230 + i * 50, y - h, 42, h, i % 2 ? '#6b7a99' : '#5b6a88'); }
      // Empire State
      rect(x - 25, y - 330, 50, 330, '#4c5a78'); rect(x - 15, y - 380, 30, 50, '#4c5a78'); rect(x - 3, y - 430, 6, 50, '#4c5a78');
      // Statue of Liberty
      const sx = x + 260;
      rect(sx - 26, y - 70, 52, 70, '#8a8f99');
      poly([[sx - 14, y - 70], [sx + 14, y - 70], [sx + 8, y - 170], [sx - 8, y - 170]], '#6fbfa5');
      blob(sx, y - 180, 11, '#6fbfa5'); rect(sx + 8, y - 230, 6, 60, '#6fbfa5'); blob(sx + 11, y - 236, 8, '#ffd23f');
    },
    london(x, y) {
      rect(x - 22, y - 300, 44, 300, '#c9a96a'); poly([[x - 26, y - 300], [x + 26, y - 300], [x, y - 360]], '#5a6a50');
      blob(x, y - 260, 16, '#f6f0dc'); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 260); ctx.lineTo(x + 8, y - 266); ctx.stroke();
      ctx.strokeStyle = '#e6e6ee'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x + 230, y - 140, 120, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + st.t * 0.05; ctx.beginPath(); ctx.moveTo(x + 230, y - 140); ctx.lineTo(x + 230 + Math.cos(a) * 120, y - 140 + Math.sin(a) * 120); ctx.stroke(); }
      poly([[x + 200, y], [x + 230, y - 140], [x + 260, y]], '#cfcfd8');
    },
    paris(x, y) {
      ctx.strokeStyle = '#6b5a4a'; ctx.fillStyle = '#7a6655';
      poly([[x - 90, y], [x - 30, y - 150], [x - 14, y - 300], [x, y - 400], [x + 14, y - 300], [x + 30, y - 150], [x + 90, y], [x + 55, y], [x, y - 110], [x - 55, y]], '#7a6655');
      rect(x - 50, y - 160, 100, 10, '#6b5a4a'); rect(x - 26, y - 300, 52, 8, '#6b5a4a');
    },
    rome(x, y) {
      poly([[x - 180, y], [x - 170, y - 150], [x + 170, y - 170], [x + 180, y]], '#d6b58a');
      ctx.fillStyle = '#7a5c3a';
      for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) ctx.fillRect(x - 150 + i * 36, y - 135 + r * 45, 18, 30);
    },
    cairo(x, y) {
      const pyr = (px, s, c) => poly([[px - 120 * s, y], [px, y - 130 * s], [px + 120 * s, y]], c);
      pyr(x - 160, 1.3, '#d9b46a'); pyr(x + 60, 1.6, '#e3c27c'); pyr(x + 260, 1, '#cfa85e');
      poly([[x + 60, y - 208], [x + 190, y], [x + 60, y]], 'rgba(0,0,0,0.08)');
    },
    nairobi(x, y) {
      for (let i = 0; i < 5; i++) { const h = 60 + hash(i + 40) * 90; rect(x - 60 + i * 36, y - h, 30, h, '#7a8494'); }
      const giraffe = gx => {
        rect(gx - 20, y - 70, 40, 28, '#d9a440'); rect(gx - 18, y - 42, 6, 42, '#d9a440'); rect(gx + 12, y - 42, 6, 42, '#d9a440');
        poly([[gx + 10, y - 70], [gx + 20, y - 70], [gx + 34, y - 140], [gx + 26, y - 142]], '#d9a440'); poly([[gx + 24, y - 146], [gx + 46, y - 140], [gx + 30, y - 134]], '#d9a440');
        ctx.fillStyle = '#8a5a20'; for (let i = 0; i < 4; i++) ctx.fillRect(gx - 14 + i * 9, y - 64 + (i % 2) * 8, 5, 5);
      };
      giraffe(x - 200); giraffe(x + 230);
    },
    capetown(x, y) {
      poly([[x - 340, y], [x - 250, y - 210], [x + 230, y - 210], [x + 320, y]], '#7d8a6a');
      rect(x - 250, y - 214, 480, 8, '#e8eef2');
    },
    dubai(x, y) {
      for (let i = 0; i < 8; i++) { const h = 110 + hash(i + 70) * 150; rect(x - 260 + i * 60, y - h, 46, h, '#9fb6c9'); }
      poly([[x - 26, y], [x - 18, y - 260], [x - 8, y - 380], [x, y - 520], [x + 8, y - 380], [x + 18, y - 260], [x + 26, y]], '#b9cfe0');
      ctx.fillStyle = '#e8f0f6'; ctx.beginPath(); ctx.moveTo(x + 220, y); ctx.quadraticCurveTo(x + 300, y - 140, x + 230, y - 240); ctx.lineTo(x + 220, y); ctx.fill();
    },
    mumbai(x, y) {
      rect(x - 110, y - 160, 220, 160, '#d8b77f');
      ctx.fillStyle = '#8a6a40'; ctx.beginPath(); ctx.moveTo(x - 34, y); ctx.lineTo(x - 34, y - 80); ctx.arc(x, y - 80, 34, Math.PI, 0); ctx.lineTo(x + 34, y); ctx.fill();
      for (const k of [-1, 1]) { rect(x + k * 90 - 12, y - 210, 24, 50, '#d8b77f'); blob(x + k * 90, y - 212, 14, '#d8b77f'); }
      blob(x, y - 176, 30, '#d8b77f');
    },
    bangkok(x, y) {
      for (const [dx, s] of [[-140, 0.8], [0, 1.2], [150, 0.9]]) {
        rect(x + dx - 50 * s, y - 60 * s, 100 * s, 60 * s, '#e8d9b8');
        poly([[x + dx - 70 * s, y - 60 * s], [x + dx, y - 130 * s], [x + dx + 70 * s, y - 60 * s]], '#c0392b');
        poly([[x + dx - 14 * s, y - 120 * s], [x + dx, y - 220 * s], [x + dx + 14 * s, y - 120 * s]], '#f0c040');
      }
    },
    beijing(x, y) {
      // the Great Wall on the hills, and the Temple of Heaven
      ctx.strokeStyle = '#a58f6a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x - 400, y - 40);
      for (let i = 0; i <= 8; i++) ctx.lineTo(x - 400 + i * 60, y - 60 - Math.abs(Math.sin(i * 0.9)) * 80);
      ctx.stroke();
      const tx = x + 160;
      rect(tx - 70, y - 50, 140, 50, '#c0392b');
      for (let i = 0; i < 3; i++) poly([[tx - 90 + i * 18, y - 50 - i * 46], [tx + 90 - i * 18, y - 50 - i * 46], [tx + 60 - i * 18, y - 86 - i * 46], [tx - 60 + i * 18, y - 86 - i * 46]], '#2f5f9a');
      blob(tx, y - 196, 8, '#f0c040');
    },
    tokyo(x, y) {
      poly([[x - 380, y], [x - 160, y - 260], [x + 60, y]], '#7a8aa6');
      poly([[x - 205, y - 220], [x - 160, y - 260], [x - 115, y - 220], [x - 140, y - 210], [x - 160, y - 225], [x - 180, y - 210]], '#f4f7fb');
      ctx.strokeStyle = '#e8364f'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x + 160, y); ctx.lineTo(x + 210, y - 330); ctx.lineTo(x + 260, y); ctx.stroke();
      ctx.lineWidth = 3; for (let i = 1; i < 6; i++) { const yy = y - i * 55, w = 50 - i * 8; ctx.beginPath(); ctx.moveTo(x + 210 - w, yy); ctx.lineTo(x + 210 + w, yy); ctx.stroke(); }
      rect(x + 190, y - 210, 40, 14, '#f4f7fb');
    },
    sydney(x, y) {
      ctx.strokeStyle = '#5a6070'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x + 200, y + 40, 200, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      rect(x + 10, y - 60, 380, 8, '#5a6070');
      const shell = (sx, s) => { ctx.fillStyle = '#f4f2ea'; ctx.beginPath(); ctx.moveTo(sx, y); ctx.quadraticCurveTo(sx + 10 * s, y - 120 * s, sx + 70 * s, y - 130 * s); ctx.quadraticCurveTo(sx + 40 * s, y - 60 * s, sx + 60 * s, y); ctx.fill(); };
      shell(x - 230, 1); shell(x - 170, 1.2); shell(x - 100, 0.9); shell(x - 50, 0.7);
      rect(x - 250, y - 14, 260, 14, '#d8c9a8');
    },
    auckland(x, y) {
      for (let i = 0; i < 6; i++) { const h = 70 + hash(i + 90) * 100; rect(x - 200 + i * 55, y - h, 44, h, '#7c8ca0'); }
      rect(x - 7, y - 380, 14, 380, '#d8dde6'); blob(x, y - 300, 22, '#d8dde6'); rect(x - 2, y - 440, 4, 60, '#d8dde6');
    },
    buenos(x, y) {
      for (let i = 0; i < 7; i++) { const h = 60 + hash(i + 110) * 90; rect(x - 260 + i * 75, y - h, 60, h, '#a0a8b8'); }
      poly([[x - 22, y], [x - 12, y - 280], [x, y - 310], [x + 12, y - 280], [x + 22, y]], '#f4f4f0');
    },
    rio(x, y) {
      poly([[x - 380, y], [x - 300, y - 200], [x - 250, y - 230], [x - 200, y - 160], [x - 150, y]], '#4f8a52');
      poly([[x + 40, y], [x + 140, y - 250], [x + 240, y]], '#3f7a48');
      rect(x + 136, y - 300, 8, 50, '#f4f4f0'); rect(x + 112, y - 290, 56, 7, '#f4f4f0'); blob(x + 140, y - 304, 6, '#f4f4f0');
    },
    lima(x, y) {
      poly([[x - 420, y], [x - 250, y - 300], [x - 80, y], [x - 10, y - 240], [x + 160, y]], '#8a8f9a');
      poly([[x - 290, y - 260], [x - 250, y - 300], [x - 210, y - 260]], '#f4f7fb');
      poly([[x - 40, y - 210], [x - 10, y - 240], [x + 20, y - 210]], '#f4f7fb');
      // a llama
      const lx = x + 260; rect(lx - 26, y - 46, 52, 24, '#f0e6d2'); rect(lx - 22, y - 22, 6, 22, '#f0e6d2'); rect(lx + 16, y - 22, 6, 22, '#f0e6d2');
      rect(lx + 18, y - 82, 12, 40, '#f0e6d2'); poly([[lx + 18, y - 82], [lx + 40, y - 78], [lx + 30, y - 70]], '#f0e6d2');
    },
    mexico(x, y) {
      for (let i = 0; i < 5; i++) rect(x - 200 + i * 20, y - 30 - i * 30, 400 - i * 40, 30, i % 2 ? '#b8946a' : '#a8845a');
      rect(x - 30, y - 190, 60, 40, '#a8845a');
      rect(x + 300, y - 260, 14, 260, '#e8e2d2'); blob(x + 307, y - 270, 12, '#f0c040'); poly([[x + 295, y - 268], [x + 307, y - 300], [x + 319, y - 268]], '#f0c040');
    },
    vegas(x, y) {
      for (let i = 0; i < 7; i++) { const h = 120 + hash(i + 130) * 180; rect(x - 280 + i * 75, y - h, 60, h, '#2a2550'); ctx.fillStyle = `hsl(${(i * 50 + st.t * 40) % 360},90%,65%)`; for (let k = 0; k < h / 24; k++) ctx.fillRect(x - 274 + i * 75, y - h + 6 + k * 24, 48, 4); }
      rect(x + 300, y - 160, 8, 160, '#ccc');
      ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.moveTo(x + 230, y - 230); ctx.lineTo(x + 380, y - 230); ctx.lineTo(x + 360, y - 160); ctx.lineTo(x + 250, y - 160); ctx.fill();
      ctx.fillStyle = '#e8364f'; ctx.font = '700 20px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('WELCOME', x + 305, y - 202); ctx.fillStyle = '#2f7bff'; ctx.fillText('LAS VEGAS', x + 305, y - 176);
    },
    la(x, y) {
      poly([[x - 420, y], [x - 250, y - 200], [x + 40, y - 230], [x + 260, y]], '#9a8a5a');
      ctx.fillStyle = '#ffffff'; ctx.font = '700 46px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('HOLLYWOOD', x - 120, y - 150);
      const palm = px => { rect(px - 4, y - 200, 8, 200, '#6b4a2a'); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.strokeStyle = '#3d8a3a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(px, y - 200); ctx.quadraticCurveTo(px + Math.cos(a) * 40, y - 230, px + Math.cos(a) * 70, y - 190 + Math.abs(Math.sin(a)) * 10); ctx.stroke(); } };
      palm(x + 250); palm(x + 340);
    }
  };
  function drawLandmarks() {
    const p = 0.45, y = 640;
    for (const s of RACE_STOPS) {
      const a = near(s.alt);
      const x = CARX + 260 + (a - st.cam) * KX * p;
      // each city's skyline only shows around that city, so neighbours never overlap
      const fade = clamp(1.6 - Math.abs(a - st.cam) / 260, 0, 1);
      if (fade <= 0 || x < -700 || x > W + 700) continue;
      ctx.save(); ctx.globalAlpha *= fade; LAND[s.land](x, y); ctx.restore();
    }
  }

  // ---- Near scenery, road, bridges -------------------------------------------------
  const vAlt = x => st.cam + (x - CARX) / KX;   // what distance a screen x shows
  function drawTrees() {
    const off = st.drive * 0.55 + st.cam * KX * 0.3;
    const spacing = 170;
    const i0 = Math.floor((off - 200) / spacing), i1 = Math.floor((off + W + 200) / spacing);
    for (let i = i0; i <= i1; i++) {
      if (hash(i) < 0.35) continue;
      const x = i * spacing - off + hash(i + 7) * 60;
      const a = vAlt(x);
      if (isSea(a) || isTunnel(a)) continue;
      const kind = BIOMES[biomeAt(a)].tree, s = 0.8 + hash(i + 3) * 0.6, y = ROAD_TOP + 2;
      switch (kind) {
        case 'round': rect(x - 5 * s, y - 50 * s, 10 * s, 50 * s, '#6b4a2a'); blob(x, y - 70 * s, 32 * s, '#3d8a45'); blob(x - 18 * s, y - 58 * s, 22 * s, '#46a050'); break;
        case 'cypress': rect(x - 3, y - 20 * s, 6, 20 * s, '#6b4a2a'); ctx.fillStyle = '#2f6a3a'; ctx.beginPath(); ctx.ellipse(x, y - 70 * s, 14 * s, 55 * s, 0, 0, TAU); ctx.fill(); break;
        case 'palm': rect(x - 4, y - 110 * s, 8, 110 * s, '#8a6a3a'); for (let k = 0; k < 5; k++) { const ang = k / 5 * Math.PI + Math.PI; ctx.strokeStyle = '#3d8a3a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y - 110 * s); ctx.quadraticCurveTo(x + Math.cos(ang) * 30 * s, y - 130 * s, x + Math.cos(ang) * 55 * s, y - 95 * s + Math.sin(ang) * -10); ctx.stroke(); } break;
        case 'cactus': rect(x - 7, y - 70 * s, 14, 70 * s, '#4f8a4a'); rect(x - 24 * s, y - 50 * s, 10, 24 * s, '#4f8a4a'); rect(x - 24 * s, y - 34 * s, 20 * s, 10, '#4f8a4a'); rect(x + 14 * s, y - 60 * s, 10, 28 * s, '#4f8a4a'); break;
        case 'acacia': rect(x - 4, y - 60 * s, 8, 60 * s, '#6b4a2a'); ctx.fillStyle = '#5a7a30'; ctx.beginPath(); ctx.ellipse(x, y - 66 * s, 50 * s, 14 * s, 0, 0, TAU); ctx.fill(); break;
        case 'pine': rect(x - 4, y - 16 * s, 8, 16 * s, '#6b4a2a'); poly([[x - 26 * s, y - 16 * s], [x, y - 90 * s], [x + 26 * s, y - 16 * s]], biomeAt(a) === 'snow' ? '#3a6a52' : '#2f6a3a'); if (biomeAt(a) === 'snow') poly([[x - 10 * s, y - 62 * s], [x, y - 90 * s], [x + 10 * s, y - 62 * s]], '#f4f8fb'); break;
        case 'gum': rect(x - 4, y - 70 * s, 8, 70 * s, '#d8cfc0'); blob(x, y - 80 * s, 26 * s, '#7a9a6a'); blob(x + 16 * s, y - 70 * s, 18 * s, '#8aa878'); break;
      }
    }
  }

  function drawRoad(w) {
    // the ground (or water) column by column, so coastlines line up with the world
    for (let x = -40; x < W + 40; x += 40) {
      const a = vAlt(x + 20);
      if (isSea(a)) {
        const g = ctx.createLinearGradient(0, ROAD_BOT, 0, H);
        g.addColorStop(0, '#2f7fc4'); g.addColorStop(1, '#174a85');
        rect(x, ROAD_TOP - 6, 41, H - ROAD_TOP + 6, g);
      } else {
        const b = BIOMES[biomeAt(a)];
        // a sandy beach where the land meets the sea
        const L = landness(x + 20);
        rect(x, ROAD_TOP - 6, 41, H - ROAD_TOP + 6, L < 1 ? mixc('#e9d49a', b.ground, clamp(L * 1.6, 0, 1)) : b.ground);
      }
    }
    // waves under bridges
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97 - st.drive * 0.9) % (W + 100) + W + 100) % (W + 100) - 50;
      if (isSea(vAlt(x))) ctx.fillRect(x, 850 + (i % 4) * 12, 26, 3);
    }
    // the road
    rect(-30, ROAD_TOP, W + 60, ROAD_BOT - ROAD_TOP, '#4a4d57');
    rect(-30, ROAD_TOP, W + 60, 5, '#6a6e7a');
    rect(-30, ROAD_BOT - 6, W + 60, 6, '#3a3d46');
    ctx.fillStyle = '#f4f4f0';
    const dash = 120, doff = st.drive % dash;
    for (let x = -doff; x < W + dash; x += dash) { ctx.fillRect(x, ROAD_TOP + 50, 60, 5); ctx.fillRect(x, ROAD_BOT - 46, 60, 5); }
    // bridge rails, towers and cables over water
    const toff = st.drive % 600;
    for (let x = -toff; x < W + 600; x += 600) {
      if (!isSea(vAlt(x))) continue;
      rect(x - 8, ROAD_TOP - 230, 16, 230, '#c0392b');
      rect(x - 14, ROAD_TOP - 236, 28, 12, '#a02a20');
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, ROAD_TOP - 226); ctx.quadraticCurveTo(x + 300, ROAD_TOP - 40, x + 600, ROAD_TOP - 226); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let k = 1; k < 12; k++) { const cx = x + k * 50, t = k / 12, cy = (1 - t) * (1 - t) * (ROAD_TOP - 226) + 2 * (1 - t) * t * (ROAD_TOP - 40) + t * t * (ROAD_TOP - 226); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, ROAD_TOP); ctx.stroke(); }
    }
    for (let x = -40; x < W + 40; x += 40) {
      if (!isSea(vAlt(x + 20))) continue;
      // a concrete ramp and pier where the bridge leaves (or reaches) the shore
      const l = isSea(vAlt(x - 20)), r = isSea(vAlt(x + 60));
      if (!l || !r) { const px = l ? x + 30 : x - 10; rect(px - 14, ROAD_BOT, 28, H - ROAD_BOT, '#8a8f99'); rect(px - 20, ROAD_BOT, 40, 10, '#6b7080'); }
      rect(x, ROAD_TOP - 18, 41, 4, '#c8ccd6');
      rect(x + ((-st.drive % 40) + 40) % 40, ROAD_TOP - 18, 3, 18, '#c8ccd6');
    }
    // the Channel Tunnel: a lit tube under the sea, with a concrete portal at each end
    for (let x = -40; x < W + 40; x += 40) {
      if (!isTunnel(vAlt(x + 20))) continue;
      const g2 = ctx.createLinearGradient(0, ROAD_TOP - 260, 0, ROAD_TOP);
      g2.addColorStop(0, '#2a2f3a'); g2.addColorStop(0.5, '#3c4352'); g2.addColorStop(1, '#22262f');
      rect(x, -30, 41, 120, '#1f6fae');                      // the sea far above
      rect(x, 86, 41, ROAD_TOP - 86, '#3a2f27');             // rock under the seabed
      rect(x, 86, 41, 8, '#c9b48a');
      rect(x, ROAD_TOP - 300, 41, 300, g2);                  // the tube
      rect(x, ROAD_TOP - 304, 41, 8, '#8a8f99');
      const l = isTunnel(vAlt(x - 20)), r = isTunnel(vAlt(x + 60));
      if (!l || !r) { rect(l ? x + 20 : x, ROAD_TOP - 330, 22, 330, '#a3a8b4'); rect(l ? x + 20 : x, ROAD_TOP - 340, 22, 12, '#6b7080'); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 10; i++) { const x = ((i * 173 - st.drive * 0.3) % W + W) % W; if (isTunnel(vAlt(x))) ctx.fillRect(x, 80 + (i % 4) * 90, 30, 3); }
    const loff = st.drive % 160;
    for (let x = -loff; x < W + 160; x += 160) if (isTunnel(vAlt(x))) { rect(x - 18, ROAD_TOP - 290, 36, 6, '#ffe9a0'); blob(x, ROAD_TOP - 280, 30, 'rgba(255,233,160,0.12)'); }
  }

  // ---- Other cars ---------------------------------------------------------------------
  const CAR_COLS = ['#e8364f', '#2f7bff', '#f4f4f0', '#3a3d46', '#7ddc6f', '#ff9a3c', '#9b59b6', '#c9d0dc'];
  function kindFor(a) {
    const land = segment(a)[2] < 0.5 ? segment(a)[0].land : segment(a)[1].land;
    const r = Math.random();
    if (land === 'ny' && r < 0.45) return 'taxi';
    if (land === 'london' && r < 0.35) return 'bus';
    if (land === 'london' && r < 0.55) return 'cab';
    if (land === 'bangkok' && r < 0.4) return 'tuktuk';
    return r < 0.12 ? 'truck' : r < 0.2 ? 'van' : 'car';
  }
  function spawnTraffic(dt) {
    if (isTunnel(st.cam) && Math.random() < 0.5) return;
    // far lane: oncoming; near lane: same way, slower than us
    if (Math.random() < dt * 0.55) traffic.push({ lane: 0, x: W + 200, v: -rand(380, 520), kind: kindFor(st.cam), col: CAR_COLS[Math.floor(Math.random() * CAR_COLS.length)] });
    if (Math.random() < dt * 0.35) traffic.push({ lane: 1, x: W + 200, v: rand(220, 380), kind: kindFor(st.cam), col: CAR_COLS[Math.floor(Math.random() * CAR_COLS.length)] });
  }
  function drawVehicle(kind, col, x, y, s, flip, wheelSpin) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
    const wheel = (wx) => { blob(wx, 0, 15, '#1d1f26'); blob(wx, 0, 7, '#9aa2b4'); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx, 0); ctx.lineTo(wx + Math.cos(wheelSpin) * 7, Math.sin(wheelSpin) * 7); ctx.stroke(); };
    switch (kind) {
      case 'bus':
        ctx.fillStyle = '#d8231f'; ctx.beginPath(); ctx.roundRect(-110, -150, 220, 140, 14); ctx.fill();
        ctx.fillStyle = '#bfe4ff'; for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) ctx.fillRect(-96 + i * 40, -136 + r * 62, 30, 28);
        wheel(-70); wheel(70); break;
      case 'truck':
        rect(-120, -110, 150, 95, '#e8e2d2'); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(36, -80, 70, 66, 10); ctx.fill();
        rect(70, -72, 28, 24, '#bfe4ff'); wheel(-90); wheel(-40); wheel(76); break;
      case 'van':
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-80, -84, 160, 72, 14); ctx.fill(); rect(30, -74, 40, 26, '#bfe4ff'); wheel(-50); wheel(50); break;
      case 'tuktuk':
        ctx.fillStyle = '#2f9a5a'; ctx.beginPath(); ctx.roundRect(-50, -70, 100, 30, 10); ctx.fill();
        rect(-46, -42, 92, 26, '#f0c040'); wheel(-34); wheel(36); break;
      default: {
        const c = kind === 'taxi' ? '#ffcc1a' : kind === 'cab' ? '#1d1f26' : col;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(-80, -16); ctx.lineTo(-78, -40); ctx.quadraticCurveTo(-50, -48, -36, -50); ctx.lineTo(-18, -74); ctx.lineTo(34, -74); ctx.lineTo(56, -48); ctx.quadraticCurveTo(80, -44, 82, -28); ctx.lineTo(82, -16); ctx.closePath(); ctx.fill();
        rect(-12, -68, 20, 18, '#bfe4ff'); rect(12, -68, 22, 18, '#bfe4ff');
        if (kind === 'taxi') { rect(-8, -84, 26, 10, '#222'); }
        wheel(-50); wheel(52);
      }
    }
    ctx.restore();
  }
  function drawTraffic(lane) {
    for (const c of traffic) {
      if (c.lane !== lane) continue;
      const y = lane === 0 ? ROAD_TOP + 36 : ROAD_BOT - 6;
      const s = lane === 0 ? 0.62 : 1.05;
      drawVehicle(c.kind, c.col, c.x, y, s, lane === 0, st.t * 20);
    }
  }

  // ---- The player's car -------------------------------------------------------------------
  const BODY = ['#e8364f', '#ff8a1a', '#2f9bff', '#a24dff'];
  const bodyCol = () => BODY[st.streak >= 8 ? 3 : st.streak >= 5 ? 2 : st.streak >= 3 ? 1 : 0];
  function carPose() {
    let x = CARX, y = LANE, tilt = 0, flip = 1;
    if (!st.dead) y += Math.sin(st.t * 18) * (st.speed > 50 ? 1.2 : 0);
    tilt = -st.boost * 0.05 + Math.sin(st.t * 3) * 0.004;
    x += st.boost * 30;
    if (st.crash) {
      const c = st.crash, f = clamp(c.t / 0.6, 0, 1);
      flip = Math.cos(f * Math.PI);          // squash through 0 to face the other way
      if (c.boom) { flip = -1; tilt = Math.min(c.since * 4, 1.8); y -= Math.max(0, 140 * c.since - 260 * c.since * c.since); }
    }
    return { x, y, tilt, flip };
  }
  function drawCar() {
    const p = carPose();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt); ctx.scale(p.flip || 0.02, 1);
    // rocket booster
    if (st.boost > 0.05 && !st.crash) {
      rect(-118, -62, 34, 22, '#8a92a4'); rect(-124, -66, 10, 30, '#5c6478');
      const L = 60 + st.boost * 90 + Math.sin(st.t * 40) * 10;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(-124, 0, -124 - L, 0);
      g.addColorStop(0, '#fff6b0'); g.addColorStop(0.4, '#ffb52e'); g.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-124, -64); ctx.quadraticCurveTo(-124 - L * 0.6, -52, -124 - L, -51); ctx.quadraticCurveTo(-124 - L * 0.6, -50, -124, -38); ctx.fill();
      ctx.restore();
    }
    const c = bodyCol();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(-96, -18); ctx.lineTo(-94, -44); ctx.quadraticCurveTo(-70, -54, -44, -56); ctx.lineTo(-20, -84); ctx.lineTo(36, -84); ctx.lineTo(66, -54); ctx.quadraticCurveTo(98, -50, 100, -30); ctx.lineTo(100, -18); ctx.closePath(); ctx.fill();
    rect(-90, -38, 186, 6, 'rgba(255,255,255,0.75)');   // racing stripe
    ctx.fillStyle = '#bfe4ff';
    ctx.beginPath(); ctx.moveTo(-14, -78); ctx.lineTo(10, -78); ctx.lineTo(10, -58); ctx.lineTo(-30, -58); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -78); ctx.lineTo(34, -78); ctx.lineTo(56, -58); ctx.lineTo(16, -58); ctx.closePath(); ctx.fill();
    // driver
    blob(2, -66, 8, '#ffd7a8'); ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(2, -69, 8.5, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath();
    if (st.dead || st.crash) ctx.arc(5, -61, 2.2, 1.15 * Math.PI, 1.85 * Math.PI); else ctx.arc(5, -64, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    rect(92, -36, 10, 8, '#fff6c0'); rect(-98, -36, 6, 8, '#ff4a4a');
    const spin = st.drive / 18;
    for (const wx of [-58, 62]) {
      blob(wx, 0, 19, '#1d1f26'); blob(wx, 0, 9, '#c9d0dc');
      ctx.strokeStyle = '#6b7286'; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const a = spin + k * TAU / 3; ctx.beginPath(); ctx.moveTo(wx, 0); ctx.lineTo(wx + Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---- Weather overlays -------------------------------------------------------------------
  const flakes = Array.from({ length: 160 }, (_, i) => ({ x: hash(i) * W, y: hash(i + 500) * H, s: 0.5 + hash(i + 900) }));
  function drawWeatherBack(w) {
    const night = w.amt('night');
    if (night > 0.05) {
      ctx.fillStyle = `rgba(255,255,255,${night * 0.8})`;
      for (let i = 0; i < 60; i++) ctx.fillRect(hash(i + 3) * W, hash(i + 77) * 420, 2, 2);
      blob(1300, 130, 40, `rgba(250,248,230,${night})`);
    } else {
      const sunY = 140 + w.amt('sunset') * 300;
      blob(1320, sunY, 52, `rgba(255,${Math.round(248 - w.amt('sunset') * 80)},${Math.round(210 - w.amt('sunset') * 120)},${0.95 - w.amt('clouds') * 0.6})`);
    }
    const clouds = w.amt('clouds');
    const cc = w.amt('rain') > 0.5 ? 'rgba(120,130,145,' : 'rgba(255,255,255,';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 330 - st.drive * 0.05 - st.t * (8 + i * 2)) % (W + 400) + W + 400) % (W + 400) - 200;
      const y = 80 + (i % 3) * 70, a = 0.5 + clouds * 0.45;
      if (clouds < 0.1 && i % 2) continue;
      for (const [dx, dy, r] of [[0, 0, 44], [46, 8, 36], [-44, 10, 34], [14, -24, 34]]) blob(x + dx, y + dy, r * (1 + clouds * 0.4), cc + a + ')');
    }
  }
  function drawWeatherFront(w) {
    const rain = w.amt('rain'), snow = w.amt('snow'), sand = w.amt('sand'), petals = w.amt('petals'), fog = w.amt('fog'), heat = w.amt('heat'), night = w.amt('night'), lightning = w.amt('lightning');
    if (rain > 0.02) {
      ctx.strokeStyle = `rgba(200,220,255,${0.35 + rain * 0.3})`; ctx.lineWidth = 1.6;
      ctx.beginPath();
      const n = Math.floor(80 + rain * 160);
      for (let i = 0; i < n; i++) {
        const x = ((hash(i) * (W + 300) - st.t * 300 - st.drive * 0.2) % (W + 300) + W + 300) % (W + 300) - 150;
        const y = ((hash(i + 31) * H + st.t * 1300) % (H + 60)) - 30;
        ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 26);
      }
      ctx.stroke();
    }
    if (snow > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${snow})`;
      for (const f of flakes) {
        const x = ((f.x - st.t * 40 * f.s - st.drive * 0.1 + Math.sin(st.t + f.y) * 20) % W + W) % W;
        const y = (f.y + st.t * 60 * f.s) % H;
        ctx.beginPath(); ctx.arc(x, y, 2 + f.s * 2, 0, TAU); ctx.fill();
      }
    }
    if (petals > 0.02) {
      for (const f of flakes.slice(0, 70)) {
        const x = ((f.x - st.t * 60 * f.s - st.drive * 0.15) % W + W) % W;
        const y = (f.y + st.t * 40 * f.s) % H;
        ctx.fillStyle = `rgba(255,170,200,${petals * 0.9})`;
        ctx.beginPath(); ctx.ellipse(x, y, 5, 3, st.t * 2 + f.s * 5, 0, TAU); ctx.fill();
      }
    }
    if (sand > 0.02) {
      rect(-30, -30, W + 60, H + 60, `rgba(220,170,100,${sand * 0.25})`);
      ctx.fillStyle = `rgba(200,150,80,${sand * 0.7})`;
      for (const f of flakes) { const x = ((f.x - st.t * 500 * f.s) % W + W) % W; ctx.fillRect(x, f.y * 0.9 + 60, 3, 1.5); }
    }
    if (fog > 0.02) {
      const g = ctx.createLinearGradient(0, 300, 0, H);
      g.addColorStop(0, `rgba(230,234,238,${fog * 0.35})`); g.addColorStop(0.6, `rgba(230,234,238,${fog * 0.65})`); g.addColorStop(1, `rgba(230,234,238,${fog * 0.3})`);
      rect(-30, -30, W + 60, H + 60, g);
    }
    if (heat > 0.02) {
      ctx.strokeStyle = `rgba(255,255,255,${heat * 0.12})`; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const y = ROAD_TOP - 20 - i * 6; ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + st.t * 6 + i) * 3); ctx.stroke(); }
    }
    if (night > 0.05) rect(-30, -30, W + 60, H + 60, `rgba(10,10,40,${night * 0.35})`);
    if (lightning > 0.3 && Math.sin(st.t * 1.7) > 0.995) st.flash = Math.max(st.flash, 0.6 * lightning);
  }

  // ---- Crash (a bad word) ---------------------------------------------------------------
  // Spin round and race backwards, faster and faster, all the way to New York, then crash.
  function updateCrash(dt) {
    const c = st.crash;
    c.t += dt;
    if (c.boom) { c.since += dt; return; }
    if (c.t < 0.6) { st.speed = lerp(st.speed, 0, dt * 6); return; }
    c.p = Math.min(1, (c.t - 0.6) / c.dur);
    st.cam = c.top * (1 - Math.pow(c.p, 3));
    st.speed = -(300 + 2400 * c.p);
    if (c.p >= 1) boom();
  }
  function boom() {
    const c = st.crash;
    c.boom = true; c.since = 0; st.cam = 0; st.speed = 0;
    st.flash = 1; st.shake = 1.5;
    const x = CARX - 80, y = LANE - 40;
    const fire = ['#ff3d00', '#ff8a00', '#ffd23f', '#ffffff'];
    for (let i = 0; i < 120; i++) { const a = rand(0, TAU), sp = rand(80, 600); parts.push({ k: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 120, g: 300, life: rand(0.5, 1.2), max: 1.2, size: rand(10, 30), color: fire[i % 4] }); }
    for (let i = 0; i < 30; i++) parts.push({ k: 'smoke', x: x + rand(-60, 60), y: y - rand(0, 40), vx: rand(-80, 80), vy: rand(-120, -30), g: 0, life: rand(1.6, 2.6), max: 2.6, size: rand(20, 40), grow: 40, color: '#33303a' });
    fx.push({ k: 'ring', x, y, r: 460, life: 0.7, max: 0.7, color: '#ffd23f' });
  }

  // ---- Update / draw ------------------------------------------------------------------------
  function update(dt) {
    st.t += dt;
    const prev = st.cam;
    if (st.crash) updateCrash(dt);
    else if (!st.dead) {
      st.cam += (st.target - st.cam) * (1 - Math.exp(-dt * 2.4));
      if (Math.abs(st.target - st.cam) < 0.02) st.cam = st.target;
      const want = CRUISE * (0.35 + 0.65 * Math.max(st.ignite, 1)) + st.boost * 900 + st.kick * 400;
      st.speed += (want - st.speed) * Math.min(1, dt * 3);
    } else { st.deadT += dt; st.speed *= Math.exp(-dt * 1.6); }
    const dx = st.speed * dt;
    st.drive += dx;
    st.vel = dt > 0 ? (st.cam - prev) * KX / dt : 0;
    st.kick = Math.max(0, st.kick - dt * 1.2);
    st.boost = Math.max(0, st.boost - dt * 0.5);
    st.shake = Math.max(0, st.shake - dt * 2.5);
    st.flash = Math.max(0, st.flash - dt * 2);

    // traffic: positions relative to the road rushing past at our speed
    if (!st.crash) spawnTraffic(dt);
    for (let i = traffic.length - 1; i >= 0; i--) {
      const c = traffic[i];
      c.x += (c.v - st.speed) * dt;
      if (c.x < -400 || c.x > W + 400) traffic.splice(i, 1);
    }
    // exhaust
    if (!st.crash && !st.dead) {
      st.emit += dt * (6 + st.boost * 30);
      while (st.emit >= 1) {
        st.emit--;
        const p = carPose();
        parts.push(st.boost > 0.1
          ? { k: 'fire', x: p.x - 130, y: p.y - 51, vx: -rand(200, 400), vy: rand(-30, 30), g: 0, life: 0.35, max: 0.35, size: rand(6, 12), color: Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a' }
          : { k: 'smoke', x: p.x - 100, y: p.y - 22, vx: -rand(40, 90), vy: rand(-30, -10), g: 0, life: 0.9, max: 0.9, size: rand(4, 7), grow: 16, color: '#c8c8d0' });
      }
    }
    if (st.dead && Math.random() < dt * 8) { const p = carPose(); parts.push({ k: 'smoke', x: p.x + 80, y: p.y - 40, vx: rand(-20, 20), vy: rand(-70, -30), g: 0, life: 1.6, max: 1.6, size: 10, grow: 30, color: '#4a4a52' }); }
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += (q.g || 0) * dt;
      q.x += q.vx * dt - dx * 0.3; q.y += q.vy * dt;
      if (q.k === 'smoke') q.size += (q.grow || 0) * dt;
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      if (f.k === 'confetti') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 200 * dt; f.rot += f.vr * dt; }
    }
    if (onMilestone) {
      for (const s of RACE_STOPS) {
        if (s.alt <= 0) continue;
        // every lap passes the cities again, so check the nearest copy
        const a = near(s.alt);
        if (prev < a && st.cam >= a) onMilestone(s);
      }
    }
  }

  function draw() {
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    if (st.shake) ctx.translate((Math.random() - 0.5) * st.shake * 16, (Math.random() - 0.5) * st.shake * 16);
    const w = weather();
    const g = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    g.addColorStop(0, w.top); g.addColorStop(1, w.bot);
    rect(-30, -30, W + 60, H + 60, g);
    drawWeatherBack(w);
    drawFar(w);
    ctx.save(); ctx.globalAlpha = 0.45 + 0.55 * landness(CARX + 260); drawLandmarks(); ctx.restore();
    drawTrees();
    drawRoad(w);
    drawTraffic(0);
    for (const q of parts) if (q.k === 'smoke') { ctx.globalAlpha = (q.life / q.max) * 0.5; blob(q.x, q.y, q.size, q.color); }
    ctx.globalAlpha = 1;
    if (!(st.crash && st.crash.boom && st.crash.since > 1.4)) drawCar();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of parts) if (q.k === 'fire') { ctx.globalAlpha = q.life / q.max; blob(q.x, q.y, q.size * (q.life / q.max), q.color); }
    ctx.restore(); ctx.globalAlpha = 1;
    drawTraffic(1);
    // speed streaks when boosting
    if (st.boost > 0.1 || Math.abs(st.speed) > 1200) {
      ctx.strokeStyle = `rgba(255,255,255,${clamp(st.boost, 0.2, 0.5)})`; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 18; i++) { const y = 120 + hash(i) * 680, x = ((hash(i + 9) * W - st.drive * 1.5) % W + W) % W; ctx.moveTo(x, y); ctx.lineTo(x + 140, y); }
      ctx.stroke();
    }
    drawWeatherFront(w);
    for (const f of fx) {
      if (f.k === 'confetti') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color;
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h * Math.abs(Math.cos(f.rot * 2)));
        ctx.restore();
      } else if (f.k === 'ring') {
        const a = f.life / f.max;
        ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = 5 * a;
        ctx.beginPath(); ctx.arc(f.x, f.y, (1 - a) * f.r + 10, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (st.flash > 0) rect(-30, -30, W + 60, H + 60, `rgba(255,255,255,${st.flash * 0.5})`);
  }

  return {
    W, H,
    init(c) { canvas = c; ctx = c.getContext('2d'); },
    resize(stageScale) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      pxScale = stageScale * dpr;
      if (canvas) { canvas.width = Math.round(W * pxScale); canvas.height = Math.round(H * pxScale); }
    },
    update, draw,
    reset() {
      st.cam = 0; st.target = 0; st.dead = false; st.deadT = 0; st.boost = 0; st.kick = 0; st.ignite = 0;
      st.streak = 0; st.crash = null; st.speed = CRUISE;
      parts.length = 0; fx.length = 0; traffic.length = 0;
    },
    get alt() { return st.cam; },
    setIgnite(v) { st.ignite = v; },
    setStreak(n) { st.streak = n; },
    setTarget(d) { st.target = d; },
    // Overfilling the tank fires the rocket booster; power 0..1.5 sets how hard.
    setBoost(power) { st.boost = Math.max(st.boost, power); st.shake = Math.max(st.shake, 0.3 + power * 0.3); },
    boostTo(d, power) {
      st.target = d;
      st.kick = Math.min(1.2, 0.5 + power * 0.15);
      st.shake = Math.max(st.shake, 0.15 + power * 0.08);
      if (power >= 4) st.flash = 0.4;
      const p = carPose();
      fx.push({ k: 'ring', x: p.x, y: p.y - 40, r: 140 + power * 40, life: 0.6, max: 0.6, color: '#ffffff' });
    },
    sputter() { st.shake = 0.4; },
    die() { st.dead = true; st.deadT = 0; },
    crash() {
      const top = st.cam;
      const dur = 0.9 + Math.min(1.6, Math.log10(1 + top) * 0.4);
      st.crash = { t: 0, p: 0, top, dur, boom: false, since: 0 };
      st.boost = 0; st.shake = Math.max(st.shake, 0.4);
    },
    get crashDone() { return !!(st.crash && st.crash.boom && st.crash.since > 1.8); },
    get crashBoom() { return !!(st.crash && st.crash.boom); },
    confetti(n = 160) {
      const cols = ['#ff5d73', '#ffd23f', '#4fd1ff', '#7ddc6f', '#b04dff', '#ff9a3c'];
      for (let i = 0; i < n; i++) fx.push({ k: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-80, 80), vy: rand(60, 220), rot: rand(0, TAU), vr: rand(-6, 6), w: rand(8, 14), h: rand(10, 18), life: rand(2.5, 4), color: cols[i % cols.length] });
    },
    burst(x, y, color, n = 30) {
      for (let i = 0; i < n; i++) { const a = rand(0, TAU), sp = rand(100, 360); parts.push({ k: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 5), color }); }
    },
    rocketScreen() { const p = carPose(); return { x: p.x, y: p.y - 60 }; },
    onMilestone(fn) { onMilestone = fn; }
  };
})();
