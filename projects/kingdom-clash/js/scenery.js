/* Kingdom Clash: the Training Grounds scenery beside the battlefield.

   Each side panel shows one illustrated background (the Royal Grandstands with the King statue on the
   left, the Royal Waterfall on the right), cropped to fill the panel like CSS "cover". The image is
   drawn once into a cached canvas whenever the panel changes size; every frame then draws that cache,
   the animated spectators sitting on the illustrated benches, and a few light effects (torch glow,
   twinkling stars, waterfall mist). The spectators are not in the artwork: they bob, cheer when a
   tower falls and celebrate the winner. Drawn at 30 frames a second at most. */
'use strict';

const KCScenery = (() => {
  const SRC = { left: 'img/grounds-left.webp', right: 'img/grounds-right.webp' };
  const IMG_W = 793, IMG_H = 1983;
  const OUT = '#231c33';
  const BLUE = ['#2f6fe4', '#3d82f2', '#2458c4'], RED = ['#dc3640', '#e8505a', '#b8262f'];
  const PLAIN = ['#f2c14e', '#4fb477', '#9b6bd6', '#f08a4b', '#e9e4dc', '#5fc4d9', '#6d6a7c'];
  const SKIN = ['#f6c9a6', '#e0a982', '#b87a52', '#8a5636', '#f8d8bd'];
  const HAIR = ['#3a2a20', '#6b4426', '#c58a3c', '#2a2a33', '#9a3b2a', '#e2d3a8'];

  /* Where people can sit, in image coordinates (0 to 1 of the artwork's width and height).
     Each row is the line a seated spectator's hips rest on, with the stretches between stairs,
     the statue and the waterfall. Rows further back are drawn smaller. */
  const LAYOUT = {
    left: {
      anchor: [0.55, 0.72],
      rows: [
        { y: 0.586, slope: 0.012, size: 0.82, spans: [[0.365, 0.575], [0.69, 0.985]] },
        { y: 0.615, slope: 0.012, size: 0.87, spans: [[0.47, 0.63], [0.745, 0.985]] },
        { y: 0.645, slope: 0.012, size: 0.92, spans: [[0.51, 0.71], [0.815, 0.985]] },
        { y: 0.676, slope: 0.012, size: 0.97, spans: [[0.5, 0.79], [0.9, 0.985]] },
        { y: 0.707, slope: 0.012, size: 1.02, spans: [[0.505, 0.86]] },
        { y: 0.737, slope: 0.012, size: 1.07, spans: [[0.6, 0.92]] },
        { y: 0.766, slope: 0.01, size: 1.12, spans: [[0.62, 0.72], [0.78, 0.93]] },
      ],
      glows: [[0.07, 0.725, 1.3], [0.548, 0.735, 1.2], [0.523, 0.528, 0.7], [0.958, 0.551, 0.7], [0.093, 0.462, 0.6], [0.405, 0.512, 0.6]],
    },
    right: {
      anchor: [0.35, 0.72],
      rows: [
        { y: 0.590, slope: 0, size: 0.78, spans: [[0.005, 0.105], [0.22, 0.44]] },
        { y: 0.606, slope: 0, size: 0.8, spans: [[0.005, 0.12], [0.24, 0.455]] },
        { y: 0.622, slope: 0, size: 0.82, spans: [[0.005, 0.135], [0.26, 0.47]] },
        { y: 0.672, slope: 0, size: 0.9, spans: [[0.005, 0.15], [0.29, 0.43]] },
        { y: 0.689, slope: 0, size: 0.93, spans: [[0.005, 0.17], [0.31, 0.445]] },
        { y: 0.706, slope: 0, size: 0.96, spans: [[0.005, 0.19], [0.33, 0.46]] },
      ],
      glows: [[0.067, 0.528, 0.7], [0.305, 0.551, 0.7], [0.178, 0.646, 0.45], [0.455, 0.646, 0.45], [0.052, 0.835, 1.3], [0.935, 0.845, 1.3]],
      mist: [0.44, 0.9, 0.855],
    },
  };

  // Colour grading per arena. Arena 1 reuses the Training Grounds art, warmed toward ember and ash,
  // until it has illustrations of its own.
  const GRADES = { training: 'none', cinder: 'sepia(0.6) saturate(1.45) hue-rotate(-28deg) brightness(0.85)' };
  let grade = 'training';
  const scenes = [], images = {};
  let last = 0, cheerT = 0, cheerTeam = -1, partyT = 0, partyTeam = -1;

  function load(side) {
    if (images[side]) return images[side];
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { for (const s of scenes) if (s.side === side) s.cacheKey = ''; };
    img.src = SRC[side];
    images[side] = img;
    return img;
  }

  function make(cv, side) {
    const s = { cv, side, img: load(side), w: 0, h: 0, dpr: 1, cache: null, cacheKey: '', crowd: [], fx: [], cover: null };
    scenes.push(s);
    resize(s);
    return s;
  }

  // Scale the artwork to cover the panel, keeping the anchor point (a fraction of the image) in view.
  function cover(s) {
    const L = LAYOUT[s.side], k = Math.max(s.w / IMG_W, s.h / IMG_H);
    const dw = IMG_W * k, dh = IMG_H * k;
    const ox = Math.min(0, Math.max(s.w - dw, s.w / 2 - L.anchor[0] * dw));
    const oy = Math.min(0, Math.max(s.h - dh, s.h * 0.62 - L.anchor[1] * dh));
    return { k, ox, oy, dw, dh, x: u => ox + u * dw, y: v => oy + v * dh };
  }

  function resize(s) {
    const r = s.cv.getBoundingClientRect();
    s.dpr = Math.min(2, window.devicePixelRatio || 1);
    s.w = Math.max(1, Math.round(r.width)); s.h = Math.max(1, Math.round(r.height));
    s.cv.width = Math.round(s.w * s.dpr); s.cv.height = Math.round(s.h * s.dpr);
    s.cover = cover(s);
    s.cacheKey = '';
    seat(s);
  }

  // Fill the benches with people. The seating is seeded, so the same crowd comes back every match.
  function seat(s) {
    const L = LAYOUT[s.side], cv = s.cover, rand = KCSim.mulberry(s.side === 'left' ? 11 : 23);
    const unit = IMG_W * cv.k; // pixels per image width
    s.crowd = [];
    for (const row of L.rows) {
      const size = row.size * unit * 0.034;
      for (const [a, b] of row.spans) {
        const step = row.size * 0.036;
        for (let u = a + step * 0.5; u < b; u += step * (0.85 + rand() * 0.3)) {
          if (rand() < 0.1) continue; // an empty seat now and then
          const fan = rand();
          const team = fan < 0.42 ? 0 : fan < 0.72 ? 1 : -1;
          const shirt = team === 0 ? BLUE[Math.floor(rand() * 3)] : team === 1 ? RED[Math.floor(rand() * 3)] : PLAIN[Math.floor(rand() * PLAIN.length)];
          s.crowd.push({
            x: cv.x(u), y: cv.y(row.y + row.slope * (u - 0.5)), z: size * (0.92 + rand() * 0.16), team, shirt,
            skin: SKIN[Math.floor(rand() * SKIN.length)], hair: HAIR[Math.floor(rand() * HAIR.length)], hairStyle: Math.floor(rand() * 4),
            hat: rand() < 0.14, flag: team >= 0 && rand() < 0.16, ph: rand() * 6.28, sp: 1.6 + rand() * 2.2, jump: 0.7 + rand() * 0.6,
          });
        }
      }
    }
    s.crowd.sort((p, q) => p.y - q.y);
    s.stars = Array.from({ length: 26 }, () => ({ x: rand() * s.w, y: rand() * Math.max(10, cv.y(0.33)), r: 0.6 + rand() * 1.1, ph: rand() * 6.28 }));
  }

  // Draw the artwork into the cache, once per size (and once more when the image finishes loading).
  function paintCache(s) {
    const key = `${s.w}x${s.h}@${s.dpr}:${s.img.complete && s.img.naturalWidth > 0}:${grade}`;
    if (key === s.cacheKey && s.cache) return;
    s.cacheKey = key;
    if (!s.cache) s.cache = document.createElement('canvas');
    s.cache.width = s.cv.width; s.cache.height = s.cv.height;
    const c = s.cache.getContext('2d'), cv = s.cover;
    c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    if (s.img.complete && s.img.naturalWidth > 0) {
      c.imageSmoothingQuality = 'high';
      c.filter = GRADES[grade] || 'none';
      c.drawImage(s.img, cv.ox, cv.oy, cv.dw, cv.dh);
      c.filter = 'none';
    } else {
      const g = c.createLinearGradient(0, 0, 0, s.h);
      g.addColorStop(0, '#2a1758'); g.addColorStop(1, '#4b3a7a');
      c.fillStyle = g; c.fillRect(0, 0, s.w, s.h);
    }
  }

  /* ---------- the crowd ---------- */
  function person(c, p, t, mood) {
    const z = p.z, team = p.team;
    // mood: 0 idle, 1 cheering, 2 celebrating (their side won), -1 disappointed
    const excited = mood > 0 && (mood === 2 || team < 0 || team === cheerTeam || cheerTeam < 0);
    const bob = Math.sin(t * p.sp + p.ph) * z * 0.06;
    const hop = excited ? Math.abs(Math.sin(t * (mood === 2 ? 8 : 9.5) + p.ph)) * z * 0.55 * p.jump : 0;
    const slump = mood === -1 && team >= 0 && team !== partyTeam ? z * 0.12 : 0;
    const y = p.y + bob - hop + slump, x = p.x;
    c.lineWidth = Math.max(1, z * 0.09); c.strokeStyle = OUT; c.lineJoin = 'round';
    // body
    rr(c, x - z * 0.42, y - z * 0.78, z * 0.84, z * 0.86, z * 0.3);
    c.fillStyle = p.shirt; c.fill(); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.18)'; rr(c, x - z * 0.42, y - z * 0.2, z * 0.84, z * 0.28, z * 0.14); c.fill();
    // arms: up when excited, a flag for some fans
    const wave = Math.sin(t * 7 + p.ph);
    if (excited || p.flag) {
      c.lineCap = 'round';
      const arm = (sx, up) => {
        const ex = x + sx * z * (0.55 + up * 0.15 + wave * 0.12 * sx), ey = y - z * (0.55 + up * 0.75);
        c.beginPath(); c.moveTo(x + sx * z * 0.3, y - z * 0.6); c.lineTo(ex, ey);
        c.lineWidth = z * 0.28; c.strokeStyle = OUT; c.stroke();
        c.lineWidth = z * 0.17; c.strokeStyle = p.skin; c.stroke();
        return [ex, ey];
      };
      const [fx, fy] = arm(1, excited ? 1 : 0.7);
      if (excited) arm(-1, 1);
      if (p.flag) {
        const col = team === 0 ? '#2f6fe4' : '#dc3640';
        c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - z * 1.0); c.lineWidth = Math.max(1, z * 0.08); c.strokeStyle = '#4a3523'; c.stroke();
        c.beginPath(); c.moveTo(fx, fy - z * 1.0);
        c.quadraticCurveTo(fx + z * 0.45, fy - z * (1.0 - wave * 0.12), fx + z * 0.85, fy - z * (0.95 + wave * 0.1));
        c.lineTo(fx + z * 0.85, fy - z * (0.55 + wave * 0.1));
        c.quadraticCurveTo(fx + z * 0.45, fy - z * (0.6 - wave * 0.12), fx, fy - z * 0.6);
        c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = Math.max(1, z * 0.07); c.strokeStyle = OUT; c.stroke();
      }
      c.lineWidth = Math.max(1, z * 0.09); c.strokeStyle = OUT;
    }
    // head and hair
    const hy = y - z * 1.08;
    c.beginPath(); c.arc(x, hy, z * 0.38, 0, Math.PI * 2); c.fillStyle = p.skin; c.fill(); c.stroke();
    c.fillStyle = p.hair;
    if (p.hat) { rr(c, x - z * 0.42, hy - z * 0.46, z * 0.84, z * 0.24, z * 0.1); c.fillStyle = team === 1 ? '#dc3640' : team === 0 ? '#2f6fe4' : '#f2c14e'; c.fill(); c.stroke(); }
    else if (p.hairStyle === 0) { c.beginPath(); c.arc(x, hy - z * 0.06, z * 0.38, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill(); }
    else if (p.hairStyle === 1) { c.beginPath(); c.arc(x, hy - z * 0.04, z * 0.4, Math.PI * 0.95, Math.PI * 2.05); c.closePath(); c.fill(); c.fillRect(x - z * 0.4, hy - z * 0.08, z * 0.14, z * 0.4); c.fillRect(x + z * 0.26, hy - z * 0.08, z * 0.14, z * 0.4); }
    else if (p.hairStyle === 2) { c.beginPath(); c.arc(x, hy - z * 0.34, z * 0.16, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x, hy - z * 0.08, z * 0.37, Math.PI * 1.1, Math.PI * 1.9); c.closePath(); c.fill(); }
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  /* ---------- light effects ---------- */
  function effects(s, c, t, dt) {
    const L = LAYOUT[s.side], cv = s.cover;
    for (const st of s.stars) {
      c.globalAlpha = 0.25 + 0.5 * Math.max(0, Math.sin(t * 1.4 + st.ph));
      c.beginPath(); c.arc(st.x, st.y, st.r, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    for (const [u, v, size] of L.glows) {
      const x = cv.x(u), y = cv.y(v), r = size * cv.dw * 0.09 * (1 + Math.sin(t * 11 + u * 40) * 0.06 + Math.sin(t * 6.3 + v * 30) * 0.05);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,170,70,0.32)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
      if (size > 1 && Math.random() < dt * 5) s.fx.push({ kind: 'ember', x: x + (Math.random() - 0.5) * r * 0.3, y: y - r * 0.2, vx: (Math.random() - 0.5) * 8, vy: -20 - Math.random() * 25, life: 1.2, max: 1.2 });
    }
    c.globalCompositeOperation = 'source-over';
    if (L.mist && Math.random() < dt * 4) {
      const [a, b, v] = L.mist;
      s.fx.push({ kind: 'mist', x: cv.x(a + Math.random() * (b - a)), y: cv.y(v), vx: (Math.random() - 0.5) * 10, vy: -6 - Math.random() * 6, r: cv.dw * (0.03 + Math.random() * 0.04), life: 2.6, max: 2.6 });
    }
    if (partyT > 0 && Math.random() < dt * 30) {
      const cols = partyTeam === 1 ? ['#dc3640', '#ffcd33', '#ff9299'] : ['#2f6fe4', '#ffcd33', '#86b6ff', '#ffffff'];
      s.fx.push({ kind: 'confetti', x: Math.random() * s.w, y: -6, vx: (Math.random() - 0.5) * 30, vy: 50 + Math.random() * 50, rot: Math.random() * 6, life: 4, max: 4, col: cols[Math.floor(Math.random() * cols.length)] });
    }
    for (const f of s.fx) {
      f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt;
      const a = Math.max(0, f.life / f.max);
      if (f.kind === 'ember') { c.globalAlpha = a; c.fillStyle = '#ffc261'; c.fillRect(f.x, f.y, 2, 2); }
      else if (f.kind === 'mist') { c.globalAlpha = Math.sin(a * Math.PI) * 0.35; c.beginPath(); c.arc(f.x, f.y, f.r * (1.6 - a * 0.6), 0, Math.PI * 2); c.fillStyle = '#eef6ff'; c.fill(); }
      else if (f.kind === 'confetti') {
        f.rot += dt * 6; c.globalAlpha = Math.min(1, a * 2);
        c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.fillStyle = f.col; c.fillRect(-3, -1.5, 6, 3); c.restore();
      }
    }
    c.globalAlpha = 1;
    s.fx = s.fx.filter(f => f.life > 0 && f.y < s.h + 10);
    if (s.fx.length > 220) s.fx.splice(0, s.fx.length - 220);
  }

  function draw(s, t, dt) {
    paintCache(s);
    const c = s.cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(s.cache, 0, 0);
    c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    const mood = partyT > 0 ? 2 : cheerT > 0 ? 1 : partyTeam >= 0 ? -1 : 0;
    for (const p of s.crowd) person(c, p, t, mood === 2 && p.team >= 0 && p.team !== partyTeam ? -1 : mood);
    effects(s, c, t, dt);
  }

  /* ---------- reactions the game calls ---------- */
  // A tower fell: the scoring side's fans and the neutral fans jump and wave.
  function cheer(team) { cheerT = 2.4; cheerTeam = team === undefined ? -1 : team; }
  // The match is over: the winner's fans and the neutral fans celebrate under confetti; the other side's fans slump.
  function celebrate(team) { partyT = 7; partyTeam = team; cheerTeam = team; }
  // A new match: everyone settles down.
  function reset() { cheerT = 0; partyT = 0; partyTeam = -1; cheerTeam = -1; for (const s of scenes) s.fx = []; }

  function frame(now) {
    const t = now / 1000;
    if (t - last < 1 / 30) return;
    const dt = Math.min(0.1, t - last);
    last = t;
    cheerT = Math.max(0, cheerT - dt);
    partyT = Math.max(0, partyT - dt);
    for (const s of scenes) if (s.cv.offsetParent !== null) draw(s, t, dt);
  }
  function setGrade(g) { grade = GRADES[g] ? g : 'training'; }
  return { make, resize: () => scenes.forEach(resize), frame, cheer, celebrate, reset, setGrade, LAYOUT, SRC };
})();
