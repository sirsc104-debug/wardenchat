/* Apples to Oranges — the Fruit Dash world: a race of running fruits across a giant kitchen.
 *
 * Every racer is a different fruit (apple, orange, banana, strawberry, watermelon, pineapple,
 * grapes, lemon) with little legs, a face and a name tag, running along their own lane of the
 * kitchen counter. Your score is how far along the counter you are, on the mode's map of 20
 * kitchen locations (js/map.js: MAPS.race): the fruit bowl, the toaster, the sink, the cookie jar…
 * out to the farmers' market at 50,000. The back counter's props, the wall tiles and a hanging
 * sign change with each location. A right answer gives a burst of speed; a wrong one, a dizzy
 * stumble. Rivals who are off the screen show as a tag at its edge.
 *
 * Plugged into js/scene.js as the 'race' world (Scene.addWorld). The game sets the racers. */
'use strict';

const Kitchen = (function () {
  const TAU = Math.PI * 2;
  const FRUITS = [
    { key: 'apple',      name: 'Apple',      emoji: '🍎', color: '#e8364f' },
    { key: 'orange',     name: 'Orange',     emoji: '🍊', color: '#ff8a1f' },
    { key: 'banana',     name: 'Banana',     emoji: '🍌', color: '#f5c518' },
    { key: 'strawberry', name: 'Strawberry', emoji: '🍓', color: '#ff4d6d' },
    { key: 'watermelon', name: 'Watermelon', emoji: '🍉', color: '#2fa85a' },
    { key: 'pineapple',  name: 'Pineapple',  emoji: '🍍', color: '#e0a91c' },
    { key: 'grapes',     name: 'Grapes',     emoji: '🍇', color: '#8a4fd6' },
    { key: 'lemon',      name: 'Lemon',      emoji: '🍋', color: '#e6d228' }
  ];
  const PX = 700;                 // counter pixels per location on the map
  const TOP = 330;                // the back counter's edge, where the props stand
  const LANES_TOP = 352, LANES_BOT = 586;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const css = c => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  let ctx, W = 1600, H = 900, T = 0;
  const st = { cam: 0, title: true, wall: null, wallFrom: null, wallMix: 1, zone: 0 };
  const racers = new Map();       // id -> { id, name, fruit, me, score, x, xT, phase, boost, stumble, finished, left }
  const xOf = score => (typeof mapBand === 'function' ? mapBand(Math.max(0, score)) : score / 1000) * PX;
  const stopOf = z => (z >= 20 ? MAPS.race.infinite : MAPS.race.stops[z]);
  const zoneAtX = x => Math.max(0, Math.floor(x / PX));

  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function circle(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

  // ---- The fruits ------------------------------------------------------------------------
  // Drawn standing on (0, 0), about 70 px tall at s = 1. mood: 'run' | 'boost' | 'dizzy' | 'idle'
  function face(cx, cy, s, mood, dark) {
    const ink = dark || '#2a1a12';
    if (mood === 'dizzy') {
      ctx.strokeStyle = ink; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for (const ex of [-7, 7]) { ctx.beginPath(); ctx.moveTo(cx + ex - 3.5, cy - 3.5); ctx.lineTo(cx + ex + 3.5, cy + 3.5); ctx.moveTo(cx + ex + 3.5, cy - 3.5); ctx.lineTo(cx + ex - 3.5, cy + 3.5); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx, cy + 9, 4, 0, TAU); ctx.stroke();
      return;
    }
    for (const ex of [-7, 7]) {
      circle(cx + ex, cy, 5.2, '#fff');
      circle(cx + ex + 1.2, cy + 0.6, 2.7, ink);
      circle(cx + ex + 2, cy - 0.8, 1, '#fff');
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'boost') { ctx.fillStyle = '#7a1f2a'; ctx.moveTo(cx - 6, cy + 7); ctx.quadraticCurveTo(cx, cy + 16, cx + 6, cy + 7); ctx.closePath(); ctx.fill(); }
    else { ctx.arc(cx, cy + 5, 5.5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,120,140,0.45)';
    ctx.beginPath(); ctx.ellipse(cx - 12, cy + 6, 3.5, 2.2, 0, 0, TAU); ctx.ellipse(cx + 12, cy + 6, 3.5, 2.2, 0, 0, TAU); ctx.fill();
  }
  function legs(phase, moving, col) {
    const swing = moving ? Math.sin(phase) : 0;
    ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    for (const [i, d] of [[0, -1], [1, 1]]) {
      const a = (i ? swing : -swing) * 0.7, hx = d * 7, hy = -20;
      const fx = hx + Math.sin(a) * 18, fy = hy + Math.cos(a) * 18;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(fx + 3, fy + 1, 6, 3.6, 0, 0, TAU); ctx.fill();
    }
  }
  function body(kind) {
    switch (kind) {
      case 'apple': {
        const g = ctx.createRadialGradient(-8, -50, 3, 0, -42, 30);
        g.addColorStop(0, '#ff7a85'); g.addColorStop(1, '#c41e36');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(0, -60); ctx.bezierCurveTo(10, -68, 28, -64, 27, -44); ctx.bezierCurveTo(27, -28, 14, -18, 0, -21);
        ctx.bezierCurveTo(-14, -18, -27, -28, -27, -44); ctx.bezierCurveTo(-28, -64, -10, -68, 0, -60); ctx.fill();
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -60); ctx.quadraticCurveTo(2, -68, 6, -72); ctx.stroke();
        ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(11, -70, 7, 3.5, -0.4, 0, TAU); ctx.fill();
        return [0, -42];
      }
      case 'orange': {
        const g = ctx.createRadialGradient(-8, -50, 3, 0, -42, 28);
        g.addColorStop(0, '#ffc266'); g.addColorStop(1, '#f07a10');
        circle(0, -42, 24, g);
        ctx.fillStyle = 'rgba(190,80,0,0.25)';
        for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 6 + (i % 4) * 4; ctx.beginPath(); ctx.arc(Math.cos(a) * r, -42 + Math.sin(a) * r, 1.3, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(5, -67, 7, 3.2, -0.3, 0, TAU); ctx.fill();
        circle(0, -66, 2.4, '#3f7a22');
        return [0, -42];
      }
      case 'banana': {
        ctx.fillStyle = '#ffd93b'; ctx.strokeStyle = '#c9a20e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14, -72); ctx.quadraticCurveTo(-34, -40, -10, -20); ctx.quadraticCurveTo(10, -14, 22, -26);
        ctx.quadraticCurveTo(2, -26, -4, -44); ctx.quadraticCurveTo(-8, -58, -8, -72); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-15, -76, 6, 6); circle(22, -26, 2.5, '#6b4a2b');
        return [-12, -44];
      }
      case 'strawberry': {
        const g = ctx.createRadialGradient(-6, -50, 3, 0, -40, 30);
        g.addColorStop(0, '#ff6b7d'); g.addColorStop(1, '#d81e3c');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(0, -18); ctx.bezierCurveTo(-18, -24, -28, -46, -22, -58); ctx.quadraticCurveTo(0, -68, 22, -58); ctx.bezierCurveTo(28, -46, 18, -24, 0, -18); ctx.fill();
        ctx.fillStyle = '#ffe680';
        for (const [sx, sy] of [[-14, -48], [14, -48], [-8, -32], [8, -32], [0, -26], [-18, -40], [18, -40], [0, -56]]) { ctx.beginPath(); ctx.ellipse(sx, sy, 1.4, 2.2, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#3fa356';
        ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.55; ctx.moveTo(0, -60); ctx.lineTo(Math.cos(a) * 16, -62 + Math.sin(a) * 9 + 6); ctx.lineTo(Math.cos(a + 0.2) * 6, -62); } ctx.fill();
        return [0, -40];
      }
      case 'watermelon': {
        // a slice: the flat edge up, the green rind round the bottom
        ctx.fillStyle = '#2e8b3e'; ctx.beginPath(); ctx.arc(0, -58, 32, 0, Math.PI); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e9f7d6'; ctx.beginPath(); ctx.arc(0, -58, 28, 0, Math.PI); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(0, -58, 25, 0, Math.PI); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a1a12';
        for (const [sx, sy] of [[-14, -44], [14, -44], [0, -38], [-6, -50], [7, -50]]) { ctx.beginPath(); ctx.ellipse(sx, sy, 1.6, 2.8, 0, 0, TAU); ctx.fill(); }
        return [0, -51];
      }
      case 'pineapple': {
        ctx.fillStyle = '#3f9a3f';
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 5, -62); ctx.lineTo(k * 9, -86 + Math.abs(k) * 5); ctx.lineTo(k * 5 + 5, -62); ctx.fill(); }
        const g = ctx.createLinearGradient(-20, 0, 20, 0);
        g.addColorStop(0, '#d18a12'); g.addColorStop(0.5, '#f5c230'); g.addColorStop(1, '#c9800f');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -40, 20, 25, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.ellipse(0, -40, 20, 25, 0, 0, TAU); ctx.clip();
        ctx.strokeStyle = 'rgba(120,70,0,0.45)'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let k = -40; k <= 40; k += 9) { ctx.moveTo(k, -70); ctx.lineTo(k + 40, -10); ctx.moveTo(k, -10); ctx.lineTo(k + 40, -70); }
        ctx.stroke(); ctx.restore();
        return [0, -40];
      }
      case 'grapes': {
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -66); ctx.lineTo(3, -74); ctx.stroke();
        ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(10, -72, 7, 3.4, -0.3, 0, TAU); ctx.fill();
        const rows = [[-15, -58], [0, -60], [15, -58], [-8, -46], [8, -46], [-15, -36], [15, -36], [0, -34], [-7, -24], [7, -24]];
        for (const [gx, gy] of rows) {
          const g = ctx.createRadialGradient(gx - 3, gy - 3, 1, gx, gy, 9);
          g.addColorStop(0, '#c49cff'); g.addColorStop(1, '#6a2fb8');
          circle(gx, gy, 8.5, g);
        }
        return [0, -46];
      }
      case 'lemon': {
        const g = ctx.createRadialGradient(-8, -48, 3, 0, -42, 30);
        g.addColorStop(0, '#fff6a0'); g.addColorStop(1, '#e3c712');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(-30, -42); ctx.quadraticCurveTo(-26, -66, 0, -66); ctx.quadraticCurveTo(26, -66, 30, -42);
        ctx.quadraticCurveTo(26, -18, 0, -18); ctx.quadraticCurveTo(-26, -18, -30, -42); ctx.fill();
        ctx.fillStyle = '#d4b80c'; ctx.beginPath(); ctx.ellipse(-31, -42, 4, 3, 0, 0, TAU); ctx.ellipse(31, -42, 4, 3, 0, 0, TAU); ctx.fill();
        return [0, -42];
      }
    }
    return [0, -42];
  }
  function drawFruit(fi, x, y, s, o) {
    const f = FRUITS[fi % FRUITS.length];
    o = o || {};
    const moving = o.moving !== false;
    const bob = moving ? Math.abs(Math.sin(o.phase || 0)) * -4 : Math.sin(T * 2 + fi) * 1.5;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    // a soft shadow on the counter
    ctx.fillStyle = 'rgba(60,40,20,0.18)'; ctx.beginPath(); ctx.ellipse(0, 2, 22, 5, 0, 0, TAU); ctx.fill();
    // speed lines behind on a boost
    if (o.boost > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * Math.min(1, o.boost)})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) { const ly = -64 + k * 13, len = 26 + ((T * 90 + k * 17) % 22); ctx.beginPath(); ctx.moveTo(-36, ly); ctx.lineTo(-36 - len, ly); ctx.stroke(); }
    }
    ctx.translate(0, bob);
    if (o.stumble > 0) ctx.rotate(Math.sin(T * 18) * 0.18 * Math.min(1, o.stumble));
    else if (moving) ctx.rotate(0.08);
    legs(o.phase || 0, moving, f.color);
    const [fx, fy] = body(f.key);
    face(fx, fy, s, o.stumble > 0 ? 'dizzy' : o.boost > 0 ? 'boost' : 'run', f.key === 'grapes' ? '#1b0b2e' : null);
    if (o.stumble > 0) {
      for (let k = 0; k < 3; k++) { const a = T * 6 + k * TAU / 3; ctx.font = '700 14px sans-serif'; ctx.fillStyle = '#ffd23f'; ctx.fillText('★', Math.cos(a) * 20 - 5, -84 + Math.sin(a) * 6); }
    }
    ctx.restore();
  }
  // A name tag just behind a fruit (to its left, pointing at it), so the lanes can sit close together.
  function tag(x, y, text, col, me) {
    ctx.font = `700 ${me ? 17 : 15}px Fredoka, sans-serif`;
    const w = ctx.measureText(text).width + 18, h = me ? 24 : 22;
    ctx.fillStyle = me ? '#ffd23f' : 'rgba(20,24,52,0.82)';
    rr(x - w - 6, y - h / 2, w, h, h / 2); ctx.fill();
    if (!me) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x - 7, y - 5); ctx.lineTo(x, y); ctx.lineTo(x - 7, y + 5); ctx.fill();
    ctx.fillStyle = me ? '#3a1d00' : '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, x - w / 2 - 6, y + 5); ctx.textAlign = 'start';
  }

  // ---- The kitchen ---------------------------------------------------------------------------
  function wallColors(z) { return (stopOf(z).wall || ['#fff3d6', '#f3dfb2']).map(hex); }
  function drawWall(dt) {
    const z = zoneAtX(st.cam + W * 0.3);
    if (z !== st.zone || !st.wall) { st.wallFrom = st.wall; st.wallMix = st.wall ? 0 : 1; st.zone = z; }
    st.wallMix = Math.min(1, st.wallMix + dt * 1.2);
    const to = wallColors(st.zone), from = st.wallFrom || to;
    st.wall = to.map((c, k) => c.map((v, j) => lerp(from[k][j], v, st.wallMix)));
    const out = !!stopOf(st.zone).outdoors;
    if (out) {
      const g = ctx.createLinearGradient(0, 0, 0, TOP);
      g.addColorStop(0, '#6cc0ff'); g.addColorStop(1, '#d9f1ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, TOP + 4);
      circle(W * 0.82, 90, 46, '#fff4c2');
      for (let i = 0; i < 4; i++) { const cx = ((i * 520 - st.cam * 0.2) % (W + 400) + W + 400) % (W + 400) - 200; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(cx, 130 + (i % 2) * 40, 34, 0, TAU); ctx.arc(cx + 36, 120 + (i % 2) * 40, 42, 0, TAU); ctx.arc(cx + 76, 132 + (i % 2) * 40, 30, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#7cc46a'; ctx.fillRect(0, TOP - 60, W, 64);
      return;
    }
    ctx.fillStyle = css(st.wall[0]); ctx.fillRect(0, 0, W, TOP + 4);
    // tiles that slide by with the camera
    const size = 46, off = ((-st.cam * 0.6) % size + size) % size;
    ctx.strokeStyle = css(st.wall[1]); ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = off - size; x < W; x += size) { ctx.moveTo(x, 110); ctx.lineTo(x, TOP); }
    for (let y = 110; y < TOP; y += size) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // upper cabinets
    const cw = 230, coff = ((-st.cam * 0.6) % cw + cw) % cw;
    for (let x = coff - cw; x < W; x += cw) {
      ctx.fillStyle = '#c98f55'; ctx.fillRect(x + 4, 0, cw - 8, 100);
      ctx.fillStyle = '#b57c45'; ctx.fillRect(x + 14, 10, cw / 2 - 20, 78); ctx.fillRect(x + cw / 2 + 6, 10, cw / 2 - 20, 78);
      circle(x + cw / 2 - 12, 74, 4, '#ffe39a'); circle(x + cw / 2 + 12, 74, 4, '#ffe39a');
    }
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 100, W, 10);
  }
  function drawCounter() {
    // the back edge, then the counter top the fruits race on
    ctx.fillStyle = '#d9c7b0'; ctx.fillRect(0, TOP - 4, W, 14);
    const g = ctx.createLinearGradient(0, TOP + 10, 0, H);
    g.addColorStop(0, '#f4ead9'); g.addColorStop(1, '#e2d1b6');
    ctx.fillStyle = g; ctx.fillRect(0, TOP + 10, W, H - TOP);
    // speckles in the stone, scrolling with the camera
    const rng = mulberry32(7);
    ctx.fillStyle = 'rgba(150,120,90,0.18)';
    for (let i = 0; i < 90; i++) { const x = ((rng() * 3000 - st.cam) % W + W) % W, y = TOP + 16 + rng() * (H - TOP - 20); ctx.fillRect(x, y, 3, 2); }
  }
  function laneY(i, n) { const step = (LANES_BOT - LANES_TOP) / Math.max(1, n); return LANES_TOP + step * (i + 0.75); }
  const laneScale = y => 0.62 + 0.42 * clamp((y - LANES_TOP) / (LANES_BOT - LANES_TOP), 0, 1);
  function drawLanes(n) {
    ctx.strokeStyle = 'rgba(160,130,100,0.35)'; ctx.setLineDash([18, 14]); ctx.lineWidth = 2;
    const step = (LANES_BOT - LANES_TOP) / Math.max(1, n);
    ctx.beginPath(); for (let i = 1; i < n; i++) { const y = LANES_TOP + step * i + 8; ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
    ctx.setLineDash([]);
    // the start line: a checkered strip
    const sx = -st.cam + W * 0.18;
    if (sx > -40 && sx < W + 40) {
      for (let r = 0; LANES_TOP + r * 12 < LANES_BOT + 10; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#222' : '#fff'; ctx.fillRect(sx + c * 12, LANES_TOP + r * 12, 12, 12); }
    }
  }

  // ---- Props on the back counter (base at y = TOP) --------------------------------------------
  const PROPS = {
    bowl(x) { ctx.fillStyle = '#5aa0d8'; ctx.beginPath(); ctx.ellipse(x, TOP - 30, 70, 30, 0, 0, Math.PI); ctx.fill(); const fr = [['#e8364f', -36], ['#ff8a1f', -10], ['#8a4fd6', 18], ['#e8364f', 40]]; fr.forEach(([c, dx], k) => circle(x + dx, TOP - 40 - (k % 2) * 8, 17, c)); ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.ellipse(x + 6, TOP - 62, 30, 8, -0.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#3f7fbf'; ctx.fillRect(x - 70, TOP - 32, 140, 6); },
    napkin(x) { ctx.fillStyle = '#ff9aa9'; ctx.beginPath(); ctx.moveTo(x - 30, TOP); ctx.lineTo(x, TOP - 46); ctx.lineTo(x + 30, TOP); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 15, TOP - 22); ctx.lineTo(x + 15, TOP - 22); ctx.stroke(); },
    board(x) { ctx.fillStyle = '#c98f55'; rr(x - 70, TOP - 110, 120, 110, 14); ctx.fill(); circle(x + 30, TOP - 92, 8, '#a8743f'); ctx.strokeStyle = 'rgba(120,70,30,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(x - 60, TOP - 80 + k * 18); ctx.lineTo(x + 40, TOP - 80 + k * 18); } ctx.stroke(); },
    rollingpin(x) { ctx.fillStyle = '#e8c28f'; rr(x - 60, TOP - 22, 120, 20, 10); ctx.fill(); ctx.fillStyle = '#b57c45'; rr(x - 82, TOP - 17, 24, 10, 5); ctx.fill(); rr(x + 58, TOP - 17, 24, 10, 5); ctx.fill(); },
    toaster(x) { ctx.fillStyle = '#c9d2e3'; rr(x - 60, TOP - 80, 120, 80, 20); ctx.fill(); ctx.fillStyle = '#9aa6bd'; rr(x - 44, TOP - 84, 36, 10, 4); ctx.fill(); rr(x + 8, TOP - 84, 36, 10, 4); ctx.fill(); const pop = Math.max(0, Math.sin(T * 1.2)) * 30; ctx.fillStyle = '#e0a45a'; rr(x - 40, TOP - 104 - pop, 28, 30, 6); ctx.fill(); rr(x + 12, TOP - 100 - pop * 0.8, 28, 30, 6); ctx.fill(); ctx.fillStyle = '#ffffff55'; ctx.fillRect(x - 52, TOP - 70, 10, 50); circle(x + 62, TOP - 40, 6, '#2a2a3a'); },
    butter(x) { ctx.fillStyle = '#e9f0fb'; rr(x - 34, TOP - 16, 68, 16, 4); ctx.fill(); ctx.fillStyle = '#ffe680'; rr(x - 24, TOP - 30, 48, 16, 4); ctx.fill(); },
    sink(x) { ctx.fillStyle = '#b8c3d6'; ctx.fillRect(x - 120, TOP - 10, 240, 10); ctx.strokeStyle = '#9aa6bd'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, TOP - 10); ctx.lineTo(x, TOP - 120); ctx.quadraticCurveTo(x, TOP - 150, x + 40, TOP - 150); ctx.lineTo(x + 60, TOP - 140); ctx.stroke(); ctx.fillStyle = 'rgba(140,200,255,0.75)'; ctx.fillRect(x + 54, TOP - 136, 10, 126); circle(x - 30, TOP - 40, 10, '#ff5d73'); circle(x + 26, TOP - 40, 10, '#4f8cff'); },
    sponge(x) { ctx.fillStyle = '#ffe14d'; rr(x - 26, TOP - 22, 52, 22, 5); ctx.fill(); ctx.fillStyle = '#4caf50'; rr(x - 26, TOP - 28, 52, 8, 3); ctx.fill(); },
    bubbles(x) { for (let k = 0; k < 5; k++) { const by = TOP - 20 - ((T * 30 + k * 40) % 200); ctx.strokeStyle = 'rgba(120,190,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + Math.sin(T + k) * 20, by, 8 + (k % 3) * 4, 0, TAU); ctx.stroke(); } },
    spices(x) { ctx.fillStyle = '#a8743f'; ctx.fillRect(x - 90, TOP - 120, 180, 8); ctx.fillRect(x - 90, TOP - 60, 180, 8); const cols = ['#e8742c', '#c4473a', '#f2b234', '#6b8e23', '#8a5a2a', '#d14a2a']; for (let k = 0; k < 6; k++) { const jx = x - 80 + k * 28; ctx.fillStyle = cols[k]; rr(jx, TOP - 52 - 60 * (k % 2), 22, 44, 4); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillRect(jx, TOP - 56 - 60 * (k % 2), 22, 8); } },
    shakers(x) { ctx.fillStyle = '#fff'; rr(x - 28, TOP - 50, 22, 50, 8); ctx.fill(); ctx.fillStyle = '#333'; rr(x + 6, TOP - 50, 22, 50, 8); ctx.fill(); ctx.fillStyle = '#c9d2e3'; ctx.fillRect(x - 28, TOP - 54, 22, 8); ctx.fillRect(x + 6, TOP - 54, 22, 8); },
    cookiejar(x) { ctx.fillStyle = 'rgba(210,235,255,0.75)'; rr(x - 50, TOP - 110, 100, 110, 22); ctx.fill(); ctx.fillStyle = '#c4473a'; rr(x - 40, TOP - 128, 80, 22, 8); ctx.fill(); circle(x, TOP - 132, 9, '#c4473a'); for (const [cx, cy] of [[-22, -30], [10, -26], [-6, -56], [24, -60], [-26, -78]]) { circle(x + cx, TOP + cy, 15, '#d9a35a'); circle(x + cx - 5, TOP + cy - 3, 2.5, '#5a3414'); circle(x + cx + 4, TOP + cy + 3, 2.5, '#5a3414'); } },
    milk(x) { ctx.fillStyle = 'rgba(230,240,255,0.6)'; rr(x - 18, TOP - 70, 36, 70, 6); ctx.fill(); ctx.fillStyle = '#fff'; rr(x - 16, TOP - 54, 32, 52, 5); ctx.fill(); },
    mixer(x) { ctx.fillStyle = '#ff5d73'; rr(x - 20, TOP - 150, 40, 150, 14); ctx.fill(); rr(x - 20, TOP - 160, 110, 50, 20); ctx.fill(); ctx.fillStyle = '#c9d2e3'; ctx.beginPath(); ctx.moveTo(x + 10, TOP - 70); ctx.lineTo(x + 110, TOP - 70); ctx.lineTo(x + 96, TOP); ctx.lineTo(x + 24, TOP); ctx.fill(); ctx.strokeStyle = '#9aa6bd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 60, TOP - 110); ctx.lineTo(x + 60 + Math.sin(T * 20) * 6, TOP - 60); ctx.stroke(); },
    flour(x) { ctx.fillStyle = '#efe6d4'; ctx.beginPath(); ctx.moveTo(x - 36, TOP); ctx.lineTo(x - 30, TOP - 80); ctx.quadraticCurveTo(x, TOP - 92, x + 30, TOP - 80); ctx.lineTo(x + 36, TOP); ctx.fill(); ctx.fillStyle = '#c4473a'; ctx.font = '700 13px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FLOUR', x, TOP - 40); ctx.textAlign = 'start'; },
    cereal(x, seed) { const cols = ['#ffd23f', '#4f8cff', '#ff5d73', '#7ddc6f']; const c = cols[Math.floor(seed) % 4]; ctx.fillStyle = c; ctx.fillRect(x - 36, TOP - 150, 72, 150); ctx.fillStyle = 'rgba(255,255,255,0.85)'; circle(x, TOP - 92, 24, 'rgba(255,255,255,0.85)'); for (let k = 0; k < 5; k++) circle(x - 12 + (k % 3) * 12, TOP - 98 + Math.floor(k / 3) * 12, 5, '#e8a33c'); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 22, TOP - 150, 14, 150); },
    stove(x) { ctx.fillStyle = '#2a2a3a'; ctx.fillRect(x - 130, TOP - 12, 260, 12); for (const dx of [-70, 70]) { ctx.strokeStyle = `rgba(255,${80 + 40 * Math.sin(T * 8 + dx)},40,0.9)`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x + dx, TOP - 12, 38, 6, 0, 0, TAU); ctx.stroke(); } },
    pot(x) { ctx.fillStyle = '#9aa6bd'; rr(x - 46, TOP - 80, 92, 76, 10); ctx.fill(); ctx.fillStyle = '#7d8aa3'; rr(x - 52, TOP - 86, 104, 12, 6); ctx.fill(); ctx.fillRect(x - 70, TOP - 70, 22, 8); ctx.fillRect(x + 48, TOP - 70, 22, 8); for (let k = 0; k < 3; k++) { const sy = TOP - 96 - ((T * 26 + k * 30) % 80); ctx.fillStyle = `rgba(255,255,255,${0.5 - ((T * 26 + k * 30) % 80) / 180})`; circle(x - 16 + k * 16 + Math.sin(T + k) * 6, sy, 12, ctx.fillStyle); } },
    fridge(x) { ctx.fillStyle = '#e9f0fb'; rr(x - 90, TOP - 320, 180, 320, 16); ctx.fill(); ctx.fillStyle = '#d3dcec'; ctx.fillRect(x - 90, TOP - 210, 180, 6); ctx.fillStyle = '#9aa6bd'; rr(x + 60, TOP - 290, 10, 60, 5); ctx.fill(); rr(x + 60, TOP - 190, 10, 80, 5); ctx.fill(); },
    magnets(x) { const cols = ['#ff5d73', '#ffd23f', '#4fd1ff', '#7ddc6f']; for (let k = 0; k < 4; k++) circle(x - 30 + k * 20, TOP - 160 - (k % 2) * 18, 7, cols[k]); ctx.fillStyle = '#fff'; ctx.fillRect(x - 20, TOP - 150, 40, 50); ctx.strokeStyle = '#4f8cff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 12, TOP - 120); ctx.lineTo(x - 2, TOP - 132); ctx.lineTo(x + 10, TOP - 116); ctx.stroke(); },
    cans(x, seed) { ctx.fillStyle = '#a8743f'; ctx.fillRect(x - 100, TOP - 150, 200, 8); const cols = ['#c4473a', '#4f8cff', '#7ddc6f', '#ffd23f', '#ff9a1f']; for (let row = 0; row < 2; row++) for (let k = 0; k < 5; k++) { const cx = x - 84 + k * 38, cy = row ? TOP : TOP - 150; ctx.fillStyle = '#c9d2e3'; ctx.fillRect(cx - 14, cy - 60, 30, 60); ctx.fillStyle = cols[(k + row + Math.floor(seed)) % 5]; ctx.fillRect(cx - 14, cy - 46, 30, 30); } },
    cake(x) { ctx.fillStyle = '#c9d2e3'; ctx.fillRect(x - 6, TOP - 40, 12, 40); ctx.fillRect(x - 70, TOP - 46, 140, 8); ctx.fillStyle = '#ff9ac2'; rr(x - 60, TOP - 120, 120, 76, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); for (let k = 0; k < 8; k++) ctx.arc(x - 52 + k * 15, TOP - 118, 9, 0, Math.PI); ctx.fill(); for (let k = 0; k < 4; k++) { const cx = x - 36 + k * 24; ctx.fillStyle = ['#4fd1ff', '#ffd23f', '#7ddc6f', '#c77dff'][k]; ctx.fillRect(cx - 3, TOP - 150, 6, 28); const fl = 1 + Math.sin(T * 12 + k) * 0.2; ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(cx, TOP - 158, 4 * fl, 8 * fl, 0, 0, TAU); ctx.fill(); } },
    cupcake(x, seed) { ctx.fillStyle = '#e8a33c'; ctx.beginPath(); ctx.moveTo(x - 20, TOP - 36); ctx.lineTo(x + 20, TOP - 36); ctx.lineTo(x + 14, TOP); ctx.lineTo(x - 14, TOP); ctx.fill(); circle(x, TOP - 44, 20, ['#ff9ac2', '#c49cff', '#9be6ff'][Math.floor(seed) % 3]); circle(x, TOP - 66, 6, '#e8364f'); },
    blender(x) { ctx.fillStyle = '#2a2a3a'; rr(x - 46, TOP - 50, 92, 50, 10); ctx.fill(); ctx.fillStyle = 'rgba(200,230,255,0.55)'; ctx.beginPath(); ctx.moveTo(x - 40, TOP - 50); ctx.lineTo(x - 50, TOP - 190); ctx.lineTo(x + 50, TOP - 190); ctx.lineTo(x + 40, TOP - 50); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.moveTo(x - 40, TOP - 50); ctx.lineTo(x - 48, TOP - 150); ctx.lineTo(x + 48, TOP - 150); ctx.lineTo(x + 40, TOP - 50); ctx.clip(); ctx.fillStyle = '#ff7aa8'; ctx.fillRect(x - 60, TOP - 130 + Math.sin(T * 10) * 6, 120, 90); ctx.restore(); ctx.fillStyle = '#2a2a3a'; rr(x - 54, TOP - 204, 108, 16, 6); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, TOP - 90, 22, T * 20, T * 20 + 2); ctx.stroke(); },
    bread(x) { ctx.fillStyle = '#c98f55'; rr(x - 70, TOP - 70, 140, 70, 10); ctx.fill(); ctx.fillStyle = '#e0a45a'; ctx.beginPath(); ctx.ellipse(x, TOP - 70, 56, 30, 0, Math.PI, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(120,70,30,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = -1; k <= 1; k++) { ctx.moveTo(x + k * 22 - 8, TOP - 92); ctx.lineTo(x + k * 22 + 8, TOP - 80); } ctx.stroke(); },
    baguette(x) { ctx.save(); ctx.translate(x, TOP - 60); ctx.rotate(-0.5); ctx.fillStyle = '#e0a45a'; rr(-70, -12, 140, 24, 12); ctx.fill(); ctx.strokeStyle = 'rgba(120,70,30,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(k * 24 - 6, -8); ctx.lineTo(k * 24 + 6, 6); } ctx.stroke(); ctx.restore(); },
    teapot(x) { ctx.fillStyle = '#4fb3a8'; ctx.beginPath(); ctx.ellipse(x, TOP - 50, 56, 48, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#4fb3a8'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x + 50, TOP - 50); ctx.quadraticCurveTo(x + 90, TOP - 60, x + 96, TOP - 100); ctx.stroke(); ctx.beginPath(); ctx.arc(x - 64, TOP - 54, 22, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); circle(x, TOP - 100, 10, '#3a8f86'); for (let k = 0; k < 3; k++) { const sy = TOP - 110 - ((T * 24 + k * 26) % 70); ctx.fillStyle = `rgba(255,255,255,${0.55 - ((T * 24 + k * 26) % 70) / 140})`; ctx.beginPath(); ctx.arc(x + 98 + Math.sin(T + k) * 6, sy, 10, 0, TAU); ctx.fill(); } },
    teacup(x) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 26, TOP - 36); ctx.lineTo(x + 26, TOP - 36); ctx.quadraticCurveTo(x + 24, TOP - 4, x, TOP - 4); ctx.quadraticCurveTo(x - 24, TOP - 4, x - 26, TOP - 36); ctx.fill(); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.ellipse(x, TOP - 3, 36, 5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x + 30, TOP - 24, 9, -1.4, 1.4); ctx.stroke(); },
    herbs(x, seed) { ctx.fillStyle = '#d9784a'; ctx.beginPath(); ctx.moveTo(x - 30, TOP - 50); ctx.lineTo(x + 30, TOP - 50); ctx.lineTo(x + 22, TOP); ctx.lineTo(x - 22, TOP); ctx.fill(); ctx.fillStyle = ['#3fa356', '#5cc463', '#2f8a45'][Math.floor(seed) % 3]; for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.28 + Math.sin(T * 1.5 + k) * 0.04; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 34, TOP - 56 + Math.sin(a) * 40, 9, 16, a + Math.PI / 2, 0, TAU); ctx.fill(); } },
    dishes(x) { ctx.strokeStyle = '#9aa6bd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 80, TOP - 4); ctx.lineTo(x + 80, TOP - 4); ctx.stroke(); for (let k = 0; k < 6; k++) { ctx.fillStyle = ['#ffffff', '#cfe8ff', '#ffe0e8'][k % 3]; ctx.beginPath(); ctx.ellipse(x - 60 + k * 24, TOP - 50, 9, 46, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5; ctx.stroke(); } },
    cups(x) { for (let k = 0; k < 3; k++) { const cx = x - 40 + k * 40; ctx.fillStyle = ['#ffd23f', '#4fd1ff', '#ff9ac2'][k]; rr(cx - 15, TOP - 40, 30, 40, 6); ctx.fill(); } },
    oven(x) { ctx.fillStyle = '#b5523a'; ctx.beginPath(); ctx.moveTo(x - 120, TOP); ctx.lineTo(x - 120, TOP - 120); ctx.quadraticCurveTo(x, TOP - 230, x + 120, TOP - 120); ctx.lineTo(x + 120, TOP); ctx.fill(); ctx.fillStyle = '#2a1408'; ctx.beginPath(); ctx.moveTo(x - 60, TOP); ctx.lineTo(x - 60, TOP - 60); ctx.quadraticCurveTo(x, TOP - 120, x + 60, TOP - 60); ctx.lineTo(x + 60, TOP); ctx.fill(); const f = 0.6 + 0.4 * Math.sin(T * 9); const g = ctx.createRadialGradient(x, TOP - 20, 4, x, TOP - 20, 60); g.addColorStop(0, `rgba(255,200,80,${f})`); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(x - 60, TOP - 90, 120, 90); },
    pizza(x) { circle(x, TOP - 14, 46, '#e0a45a'); circle(x, TOP - 14, 38, '#e85a3a'); ctx.fillStyle = '#ffe680'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k) * 20, TOP - 14 + Math.sin(k) * 6, 8, 0, TAU); ctx.fill(); } for (let k = 0; k < 4; k++) circle(x + Math.cos(k * 1.7) * 24, TOP - 14 + Math.sin(k * 1.7) * 7, 5, '#c4202f'); },
    juice(x, seed) { const cols = ['#ff9a1f', '#e8364f', '#7ddc6f', '#c77dff']; const c = cols[Math.floor(seed) % 4]; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 26, TOP); ctx.lineTo(x - 26, TOP - 90); ctx.lineTo(x, TOP - 112); ctx.lineTo(x + 26, TOP - 90); ctx.lineTo(x + 26, TOP); ctx.fill(); ctx.fillStyle = c; ctx.fillRect(x - 26, TOP - 76, 52, 46); circle(x, TOP - 54, 14, '#fff'); circle(x, TOP - 54, 9, c); },
    stall(x) { ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 150, TOP - 150, 10, 150); ctx.fillRect(x + 140, TOP - 150, 10, 150); for (let k = 0; k < 10; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#e8364f'; ctx.beginPath(); ctx.moveTo(x - 160 + k * 32, TOP - 150); ctx.lineTo(x - 128 + k * 32, TOP - 150); ctx.lineTo(x - 144 + k * 32 + 16, TOP - 120); ctx.lineTo(x - 160 + k * 32, TOP - 120); ctx.fill(); } ctx.fillStyle = '#c98f55'; ctx.fillRect(x - 150, TOP - 50, 300, 50); for (let k = 0; k < 9; k++) circle(x - 128 + k * 32, TOP - 58, 14, ['#e8364f', '#ff8a1f', '#ffd93b', '#8a4fd6'][k % 4]); },
    crate(x, seed) { ctx.fillStyle = '#c98f55'; ctx.fillRect(x - 50, TOP - 50, 100, 50); ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 3; ctx.strokeRect(x - 50, TOP - 50, 100, 50); for (let k = 0; k < 5; k++) circle(x - 36 + k * 18, TOP - 54, 11, ['#e8364f', '#ff8a1f', '#7ddc6f', '#ffd93b'][(k + Math.floor(seed)) % 4]); }
  };
  const BIGW = { fridge: 220, stove: 280, sink: 260, oven: 260, stall: 320, spices: 200, cans: 220 };
  const CH = 420;
  const chunkCache = new Map();
  function chunk(ci) {
    if (chunkCache.has(ci)) return chunkCache.get(ci);
    if (chunkCache.size > 200) chunkCache.clear();
    const out = [];
    if (ci < 0) { chunkCache.set(ci, out); return out; }
    const rng = mulberry32(ci * 4271 + 11);
    const decor = Object.entries(stopOf(zoneAtX(ci * CH + CH / 2)).decor), total = decor.reduce((s, d) => s + d[1], 0);
    const pickKind = () => { let r = rng() * total; for (const [k, w] of decor) if ((r -= w) <= 0) return k; return decor[0][0]; };
    const first = pickKind();
    if (BIGW[first]) out.push({ kind: first, x: ci * CH + CH / 2, seed: rng() * 100 });
    else { const n = 1 + Math.floor(rng() * 2); for (let i = 0; i < n; i++) { let k = i ? pickKind() : first; if (BIGW[k]) k = decor.find(d => !BIGW[d[0]])?.[0] || 'bowl'; out.push({ kind: k, x: ci * CH + (i + 0.3 + rng() * 0.4) * CH / n, seed: rng() * 100 }); } }
    chunkCache.set(ci, out);
    return out;
  }
  function drawProps() {
    const c0 = Math.floor((st.cam - 300) / CH), c1 = Math.floor((st.cam + W + 300) / CH);
    for (let ci = c0; ci <= c1; ci++) for (const p of chunk(ci)) { const f = PROPS[p.kind]; if (f) f(p.x - st.cam, p.seed); }
  }
  // a sign hanging on the wall where each location starts
  // On the title screen they fade out before they reach the menu, so they don't show behind the logo.
  function drawSigns(title) {
    const z0 = Math.max(0, zoneAtX(st.cam - 200)), z1 = zoneAtX(st.cam + W + 200);
    for (let z = z0; z <= z1 && z <= 20; z++) {
      const x = z * PX - st.cam + W * 0.18;
      if (x < -200 || x > W + 200) continue;
      const fade = title ? clamp((W - 1180 - x) / 160, 0, 1) : 1;
      if (fade <= 0) continue;
      ctx.globalAlpha = fade;
      const s = stopOf(z);
      const text = `${s.ic} ${s.name}`;
      ctx.font = '700 22px Fredoka, sans-serif';
      const w = ctx.measureText(text).width + 34;
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w / 2 + 20, 108); ctx.lineTo(x - w / 2 + 20, 132); ctx.moveTo(x + w / 2 - 20, 108); ctx.lineTo(x + w / 2 - 20, 132); ctx.stroke();
      ctx.fillStyle = '#fffaf0'; rr(x - w / 2, 130, w, 40, 12); ctx.fill(); ctx.strokeStyle = '#c98f55'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#5a3414'; ctx.textAlign = 'center'; ctx.fillText(text, x, 158); ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
    }
  }

  // ---- The race ----------------------------------------------------------------------------
  function set(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let r = racers.get(p.id);
      if (!r) { r = { id: p.id, x: xOf(p.score || 0), phase: Math.random() * 6, boost: 0, stumble: 0 }; racers.set(p.id, r); }
      Object.assign(r, { name: p.name, fruit: p.fruit | 0, me: !!p.me, score: p.score || 0, finished: !!p.finished, left: !!p.left });
      r.xT = xOf(r.score);
    }
    for (const id of [...racers.keys()]) if (!seen.has(id)) racers.delete(id);
  }
  function fx(id, kind) { const r = racers.get(id); if (r) r[kind] = kind === 'boost' ? 1 : 1.1; }
  function reset() { racers.clear(); st.cam = 0; chunkCache.clear(); st.wall = null; }

  function draw(c, dt, env) {
    ctx = c; W = env.W; H = env.H; T = env.t;
    const list = [...racers.values()];
    const me = list.find(r => r.me);
    for (const r of list) {
      const v = r.xT - r.x;
      r.x += v * Math.min(1, dt * 3);
      r.phase += dt * (r.racing === false ? 0 : 9 + Math.min(14, Math.abs(v) * 0.05));
      r.boost = Math.max(0, r.boost - dt); r.stumble = Math.max(0, r.stumble - dt);
    }
    const title = st.title || !list.length;
    if (title) st.cam += 90 * dt;           // the title screen: the kitchen rolls by, location after location
    else {
      const camT = me ? me.x - W * 0.12 : Math.max(...list.map(r => r.x)) - W * 0.12;
      st.cam += (camT - st.cam) * Math.min(1, dt * 3);
    }
    drawWall(dt);
    drawSigns(title);
    drawProps();
    drawCounter();
    if (title) {
      // all eight fruits running together in two rows, in the open space left of the menu
      FRUITS.forEach((f, i) => {
        const back = i % 2, col = i >> 1;
        const y = back ? LANES_TOP + 70 : LANES_TOP + 200, x = 70 + col * 118 + (back ? 0 : 50) + Math.sin(T * 1.3 + i) * 10;
        drawFruit(i, x, y, back ? 0.9 : 1.15, { phase: T * 11 + i * 1.7, moving: true });
      });
      return;
    }
    const n = Math.max(1, list.length);
    drawLanes(n);
    // lanes by fruit order, back lanes first so nearer fruits overlap them
    const lanes = list.slice().sort((a, b) => a.fruit - b.fruit);
    lanes.forEach((r, i) => {
      // more racers, smaller fruits, so eight fit on the counter
      const y = laneY(i, n), s = laneScale(y) * (n > 5 ? 0.8 : n > 3 ? 0.9 : 1), x = r.x - st.cam + W * 0.18 + 30;
      if (x < -60 || x > W + 60) {
        // off the screen: a tag at the edge
        const ahead = x > W;
        const text = `${ahead ? '' : '◀ '}${FRUITS[r.fruit % 8].emoji} ${r.me ? 'You' : r.name}${ahead ? ' ▶' : ''}`;
        ctx.font = '700 15px Fredoka, sans-serif';
        const w = ctx.measureText(text).width + 18, tx = ahead ? W - w - 10 : 10;
        ctx.fillStyle = 'rgba(20,24,52,0.82)'; rr(tx, y - 30, w, 24, 12); ctx.fill();
        ctx.strokeStyle = FRUITS[r.fruit % 8].color; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(text, tx + 9, y - 13);
        return;
      }
      drawFruit(r.fruit, x, y, s, { phase: r.phase, moving: !r.finished && !r.left, boost: r.boost, stumble: r.stumble });
      if (!r.left) tag(x - 34 * s, y - 36 * s, r.me ? 'YOU' : r.name, FRUITS[r.fruit % 8].color, r.me);
      if (r.finished) { ctx.font = '22px sans-serif'; ctx.fillText('🏁', x + 24 * s, y - 64 * s); }
    });
  }
  function vehiclePos() {
    const me = [...racers.values()].find(r => r.me);
    return { x: me ? me.x - st.cam + W * 0.18 + 30 : W * 0.2, y: LANES_TOP + 40 };
  }

  return {
    FRUITS, set, fx, reset, draw, vehiclePos, xOf,
    set title(v) { st.title = !!v; },
    // a single fruit drawn on any canvas (for the lobby's fruit picker)
    paintFruit(c, fi, x, y, s) { const keep = ctx; ctx = c; drawFruit(fi, x, y, s, { moving: false }); ctx = keep; }
  };
})();

if (typeof Scene !== 'undefined' && Scene.addWorld) Scene.addWorld('race', Kitchen);
