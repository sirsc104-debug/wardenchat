/* Kingdom Clash: the arena scenery beside the battlefield. The left side has a statue, the right side
   a waterfall, and both have a crowd in the stands, banners and torches. The crowd cheers when a
   tower falls. Drawn at 30 frames a second at most. */
'use strict';

const KCScenery = (() => {
  const A = KCArt, scenes = [];
  let last = 0;
  const SHIRTS = ['#2f7cf6', '#e5414b', '#ffcf3f', '#3fbf6f', '#b06bff', '#ff8a3d', '#f5f5f5', '#59c9e8'];
  const SKIN = ['#f0c29e', '#d9a27a', '#a8714c', '#7a4e33', '#f6d3b5'];

  function make(cv, side) {
    const s = { cv, side, w: 0, h: 0, crowd: [], stars: [], cheer: 0, dpr: 1 };
    scenes.push(s);
    resize(s);
    return s;
  }
  function resize(s) {
    const r = s.cv.getBoundingClientRect();
    s.dpr = Math.min(2, window.devicePixelRatio || 1);
    s.w = Math.max(1, r.width); s.h = Math.max(1, r.height);
    s.cv.width = Math.round(s.w * s.dpr); s.cv.height = Math.round(s.h * s.dpr);
    const rand = KCSim.mulberry(s.side === 'left' ? 11 : 23);
    s.crowd = [];
    const rows = 4, top = s.h * 0.6, rowH = (s.h * 0.24) / rows;
    for (let r2 = 0; r2 < rows; r2++) {
      const size = 7 + r2 * 1.6, n = Math.floor(s.w / (size * 2.3));
      for (let i = 0; i < n; i++) {
        s.crowd.push({ x: (i + 0.5 + (rand() - 0.5) * 0.5) * (s.w / n), y: top + r2 * rowH + rowH * 0.8, size,
          shirt: SHIRTS[Math.floor(rand() * SHIRTS.length)], skin: SKIN[Math.floor(rand() * SKIN.length)],
          ph: rand() * 6.28, sp: 2 + rand() * 2.5, flag: rand() < 0.12, row: r2 });
      }
    }
    s.stars = Array.from({ length: 34 }, () => ({ x: rand() * s.w, y: rand() * s.h * 0.4, r: 0.6 + rand() * 1.3, ph: rand() * 6 }));
  }
  function cheer() { for (const s of scenes) s.cheer = 2.2; }

  function draw(s, t, dt) {
    const c = s.cv.getContext('2d'), w = s.w, h = s.h;
    c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    s.cheer = Math.max(0, s.cheer - dt);
    const sky = c.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#1a0f33'); sky.addColorStop(0.55, '#47215f'); sky.addColorStop(1, '#a84a72');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    for (const st of s.stars) {
      c.globalAlpha = 0.45 + 0.45 * Math.sin(t * 1.7 + st.ph);
      A.circ(c, st.x, st.y, st.r); c.fillStyle = '#fff'; c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#2d1a4b';
    c.beginPath(); c.moveTo(0, h * 0.52);
    for (let i = 0; i <= 8; i++) c.lineTo((w * i) / 8, h * (0.4 + ((i * 37) % 11) / 90));
    c.lineTo(w, h * 0.6); c.lineTo(0, h * 0.6); c.closePath(); c.fill();

    // back wall with banners
    c.fillStyle = '#5a4a72'; c.fillRect(0, h * 0.53, w, h * 0.08);
    for (let x = 0; x < w; x += 22) { c.fillRect(x, h * 0.515, 13, h * 0.02); }
    c.fillStyle = 'rgba(20,10,35,0.35)'; c.fillRect(0, h * 0.6, w, h * 0.012);
    const poles = s.side === 'left' ? [0.14, 0.52, 0.88] : [0.12, 0.48, 0.84];
    poles.forEach((px, i) => flag(c, w * px, h * 0.53, h * 0.15, i % 2 ? 1 : 0, t + i));

    // stands and crowd
    for (let r2 = 0; r2 < 4; r2++) {
      const y = h * 0.6 + (h * 0.24 * r2) / 4;
      c.fillStyle = r2 % 2 ? '#6d5c86' : '#776690'; c.fillRect(0, y, w, (h * 0.24) / 4);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(0, y + (h * 0.24) / 4 - 3, w, 3);
    }
    const ch = s.cheer > 0;
    for (const p of s.crowd) {
      const bob = Math.sin(t * p.sp + p.ph) * 1.5, jump = ch ? Math.abs(Math.sin(t * 9 + p.ph)) * p.size * 0.9 : 0;
      const y = p.y + bob - jump, z = p.size;
      A.rr(c, p.x - z * 0.75, y - z * 0.4, z * 1.5, z * 1.6, z * 0.5); c.fillStyle = p.shirt; c.fill();
      A.circ(c, p.x, y - z * 0.85, z * 0.62); c.fillStyle = p.skin; c.fill();
      if (ch || p.flag) {
        const wave = Math.sin(t * 8 + p.ph) * 0.4;
        c.strokeStyle = p.skin; c.lineWidth = z * 0.35; c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.x + z * 0.55, y - z * 0.2); c.lineTo(p.x + z * (0.9 + wave * 0.4), y - z * 1.6); c.stroke();
        if (ch) { c.beginPath(); c.moveTo(p.x - z * 0.55, y - z * 0.2); c.lineTo(p.x - z * (0.9 - wave * 0.4), y - z * 1.6); c.stroke(); }
        if (p.flag) { c.fillStyle = p.row % 2 ? '#e5414b' : '#2f7cf6'; c.fillRect(p.x + z * (0.9 + wave * 0.4), y - z * 2.4, z * 1.3, z * 0.8); }
      }
    }

    // front wall
    const fy = h * 0.84;
    c.fillStyle = '#857c95'; c.fillRect(0, fy, w, h - fy);
    c.strokeStyle = 'rgba(30,20,45,0.45)'; c.lineWidth = 1.5;
    for (let row = 0; row < 6; row++) {
      const y = fy + row * 18;
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      for (let x = (row % 2) * 17; x < w; x += 34) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 18); c.stroke(); }
    }
    c.fillStyle = '#9a91a9'; c.fillRect(0, fy - 8, w, 10);
    for (let x = 4; x < w; x += 30) { c.fillStyle = '#9a91a9'; c.fillRect(x, fy - 20, 18, 14); }

    if (s.side === 'left') statue(c, w * 0.36, h * 0.985, h * 0.34, t);
    else waterfall(c, w, h, t);
    const torchX = s.side === 'left' ? [0.08, 0.8] : [0.1, 0.5];
    for (const tx of torchX) torch(c, w * tx, fy + 4, t + tx * 10);
  }

  function flag(c, x, y, len, team, t) {
    c.fillStyle = '#3a2d1f'; c.fillRect(x - 2, y - len, 4, len);
    A.circ(c, x, y - len - 3, 4); c.fillStyle = '#ffcf3f'; c.fill();
    const col = KCArt.TEAM[team].cloth, fw = len * 0.55, fh = len * 0.62;
    c.beginPath(); c.moveTo(x + 2, y - len);
    for (let i = 0; i <= 10; i++) { const u = i / 10; c.lineTo(x + 2 + u * fw, y - len + Math.sin(t * 4 + u * 4) * 3 * u); }
    for (let i = 10; i >= 0; i--) { const u = i / 10; c.lineTo(x + 2 + u * fw, y - len + fh + Math.sin(t * 4 + u * 4) * 3 * u - (u > 0.8 ? 0 : 0)); }
    c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = KCArt.OUT; c.lineWidth = 1.5; c.stroke();
    KCArt.crownIcon(c, x + 2 + fw * 0.45, y - len + fh * 0.5 + Math.sin(t * 4 + 2) * 1.2, fh * 0.16, '#ffcf3f');
  }
  function torch(c, x, y, t) {
    c.fillStyle = '#4a3423'; c.fillRect(x - 3, y - 26, 6, 26);
    A.rr(c, x - 7, y - 32, 14, 8, 3); c.fillStyle = '#6b6f7a'; c.fill();
    const fl = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.08;
    const g = c.createRadialGradient(x, y - 40, 2, x, y - 40, 34);
    g.addColorStop(0, 'rgba(255,190,90,0.55)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.fillRect(x - 40, y - 80, 80, 80);
    c.beginPath(); c.moveTo(x - 7, y - 32);
    c.quadraticCurveTo(x - 9, y - 44 * fl, x, y - 56 * fl); c.quadraticCurveTo(x + 9, y - 44 * fl, x + 7, y - 32); c.closePath();
    c.fillStyle = '#ff8a2a'; c.fill();
    c.beginPath(); c.moveTo(x - 3.5, y - 32);
    c.quadraticCurveTo(x - 4, y - 40 * fl, x, y - 47 * fl); c.quadraticCurveTo(x + 4, y - 40 * fl, x + 3.5, y - 32); c.closePath();
    c.fillStyle = '#ffe08a'; c.fill();
  }
  function statue(c, x, y, hgt, t) {
    const k = hgt / 2.6, O = A.OUT;
    A.rr(c, x - k * 0.9, y - k * 0.55, k * 1.8, k * 0.55, k * 0.08); A.paint(c, '#77708a', 2);
    A.rr(c, x - k * 0.75, y - k * 0.75, k * 1.5, k * 0.22, k * 0.06); A.paint(c, '#8b84a0', 2);
    c.save(); c.translate(x, y - k * 0.75);
    A.poly(c, [-k * 0.5, 0, k * 0.5, 0, k * 0.34, -k * 1.1, -k * 0.34, -k * 1.1]); A.paint(c, '#a29cb2', 2);
    A.rr(c, -k * 0.3, -k * 1.5, k * 0.6, k * 0.5, k * 0.18); A.paint(c, '#aaa4ba', 2);
    A.circ(c, 0, -k * 1.72, k * 0.26); A.paint(c, '#b4aec4', 2);
    c.beginPath(); c.arc(0, -k * 1.62, k * 0.24, 0.2, Math.PI - 0.2); c.closePath(); A.paint(c, '#9993aa', 1.5);
    A.crownIcon(c, 0, -k * 2.02, k * 0.2, '#c9c2d8');
    A.rr(c, k * 0.3, -k * 2.35, k * 0.1, k * 1.5, k * 0.04); A.paint(c, '#c2bcd0', 2);
    A.rr(c, k * 0.18, -k * 0.95, k * 0.34, k * 0.08, k * 0.03); A.paint(c, '#b4aec4', 1.5);
    c.fillStyle = 'rgba(80,60,110,0.25)'; c.fillRect(-k * 0.5, -k * 0.5, k * 1.0, k * 0.5);
    c.restore();
    c.strokeStyle = O; c.globalAlpha = 0.15 + 0.1 * Math.sin(t);
    c.globalAlpha = 1;
  }
  function waterfall(c, w, h, t) {
    const x0 = w * 0.58, x1 = w * 0.9, top = h * 0.36, bot = h * 0.93;
    c.fillStyle = '#4b3d63';
    c.beginPath(); c.moveTo(w * 0.48, h); c.lineTo(w * 0.5, top + h * 0.06); c.lineTo(w * 0.6, top - h * 0.02);
    c.lineTo(w * 0.92, top - h * 0.04); c.lineTo(w, top + h * 0.03); c.lineTo(w, h); c.closePath(); c.fill();
    c.fillStyle = '#5d4e78';
    for (const [rx, ry, rw, rh] of [[0.5, 0.5, 0.1, 0.07], [0.9, 0.45, 0.1, 0.09], [0.52, 0.7, 0.07, 0.06], [0.92, 0.66, 0.08, 0.08]]) {
      A.ell(c, w * rx, h * ry, w * rw, h * rh); c.fill();
    }
    const g = c.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, '#7fd1ff'); g.addColorStop(1, '#4a8fe6');
    c.fillStyle = g; c.fillRect(x0, top, x1 - x0, bot - top);
    c.save(); c.beginPath(); c.rect(x0, top, x1 - x0, bot - top); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const lx = x0 + ((i + 0.5) / 9) * (x1 - x0), off = ((t * 220 + i * 53) % (bot - top + 60)) - 60;
      c.beginPath(); c.moveTo(lx, top + off); c.lineTo(lx, top + off + 40); c.stroke();
    }
    c.restore();
    c.fillStyle = '#3d7fd6'; A.ell(c, (x0 + x1) / 2, bot + 4, (x1 - x0) * 0.75, h * 0.03); c.fill();
    for (let i = 0; i < 8; i++) {
      const mx = x0 + (i / 7) * (x1 - x0), r = 9 + 4 * Math.sin(t * 3 + i * 1.7);
      A.circ(c, mx, bot - 2 + Math.sin(t * 2 + i) * 2, r); c.fillStyle = 'rgba(235,245,255,0.75)'; c.fill();
    }
  }

  function frame(now) {
    const t = now / 1000;
    if (t - last < 1 / 30) return;
    const dt = Math.min(0.1, t - last);
    last = t;
    for (const s of scenes) if (s.cv.offsetParent !== null) draw(s, t, dt);
  }
  return { make, resize: () => scenes.forEach(resize), frame, cheer };
})();
