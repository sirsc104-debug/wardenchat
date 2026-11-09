/* Kingdom Clash: the arena scenery beside the battlefield.

   Each side panel shows its arena's illustration (js/arenas.js): for the Training Grounds the Royal
   Grandstands and the Royal Waterfall, for Cinder Keep the volcanic grandstand and the lavafall. The
   image is cropped to fill the panel like CSS "cover" and drawn once into a cached canvas whenever the
   panel or the arena changes; every frame then draws that cache, the animated spectators sitting on
   the illustrated benches, and light effects (torch glow, stars, waterfall mist, or rising embers and
   lava spray). The spectators are not in the artwork: they bob, cheer when a tower falls and
   celebrate the winner. Drawn at 30 frames a second at most. */
'use strict';

const KCScenery = (() => {
  const OUT = '#231c33';
  const BLUE = ['#2f6fe4', '#3d82f2', '#2458c4'], RED = ['#dc3640', '#e8505a', '#b8262f'];
  const PLAIN = ['#f2c14e', '#4fb477', '#9b6bd6', '#f08a4b', '#e9e4dc', '#5fc4d9', '#6d6a7c'];
  const SKIN = ['#f6c9a6', '#e0a982', '#b87a52', '#8a5636', '#f8d8bd'];
  const HAIR = ['#3a2a20', '#6b4426', '#c58a3c', '#2a2a33', '#9a3b2a', '#e2d3a8'];

  let arenaId = 'training';
  const scenes = [];
  let last = 0, cheerT = 0, cheerTeam = -1, partyT = 0, partyTeam = -1;

  // The layout of this panel's artwork in the current arena (image, where people sit, lights).
  const layoutOf = s => KCArenas.get(arenaId).scenery[s.side];

  function attach(s) {
    s.L = layoutOf(s);
    s.img = KCArenas.image(s.L.src);
    KCArenas.whenReady(s.L.src, () => { s.cacheKey = ''; });
  }

  function make(cv, side) {
    const s = { cv, side, img: null, L: null, w: 0, h: 0, dpr: 1, cache: null, cacheKey: '', crowd: [], fx: [], cover: null };
    attach(s);
    scenes.push(s);
    resize(s);
    return s;
  }

  // Scale the artwork to cover the panel, keeping the anchor point (a fraction of the image) in view.
  function cover(s) {
    const L = s.L, k = Math.max(s.w / L.w, s.h / L.h);
    const dw = L.w * k, dh = L.h * k;
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
    const L = s.L, cv = s.cover, rand = KCSim.mulberry((s.side === 'left' ? 11 : 23) + arenaId.length);
    const unit = L.w * cv.k; // pixels per image width
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
    s.stars = Array.from({ length: L.stars || 0 }, () => ({ x: rand() * s.w, y: rand() * Math.max(10, cv.y(0.3)), r: 0.6 + rand() * 1.1, ph: rand() * 6.28 }));
  }

  // Draw the artwork into the cache, once per size and arena (and once more when the image loads).
  // If the image can't load, a plain dusk gradient stands in and the crowd still plays.
  function paintCache(s) {
    const ok = KCArenas.ready(s.img);
    const key = `${s.w}x${s.h}@${s.dpr}:${ok}:${s.L.src}`;
    if (key === s.cacheKey && s.cache) return;
    s.cacheKey = key;
    if (!s.cache) s.cache = document.createElement('canvas');
    s.cache.width = s.cv.width; s.cache.height = s.cv.height;
    const c = s.cache.getContext('2d'), cv = s.cover;
    c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    if (ok) {
      c.imageSmoothingQuality = 'high';
      c.drawImage(s.img, cv.ox, cv.oy, cv.dw, cv.dh);
    } else {
      const g = c.createLinearGradient(0, 0, 0, s.h);
      g.addColorStop(0, '#2a1758'); g.addColorStop(1, arenaId === 'cinder' ? '#5a2a2a' : '#4b3a7a');
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
    const L = s.L, cv = s.cover;
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
    // Cinder Keep: embers drifting up through the whole panel, and spray at the foot of the lavafall
    if (L.embers && Math.random() < dt * 9) {
      s.fx.push({ kind: 'ember', x: Math.random() * s.w, y: s.h + 4, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 30, life: 4 + Math.random() * 3, max: 6, sway: Math.random() * 6.28 });
    }
    if (L.lavafall) {
      const [a, b, v] = L.lavafall;
      c.globalCompositeOperation = 'lighter';
      const fx0 = cv.x(a), fx1 = cv.x(b), fy = cv.y(v), pulse = 0.5 + 0.5 * Math.sin(t * 2.3);
      const g = c.createRadialGradient((fx0 + fx1) / 2, fy, 0, (fx0 + fx1) / 2, fy, (fx1 - fx0) * 1.4);
      g.addColorStop(0, `rgba(255,150,40,${0.18 + pulse * 0.12})`); g.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = g; c.fillRect(fx0 - (fx1 - fx0), fy - (fx1 - fx0) * 1.4, (fx1 - fx0) * 3, (fx1 - fx0) * 2.8);
      c.globalCompositeOperation = 'source-over';
      if (Math.random() < dt * 14) s.fx.push({ kind: 'spark', x: fx0 + Math.random() * (fx1 - fx0), y: fy, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 70, g: 140, life: 0.9, max: 0.9 });
    }
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
      if (f.g) f.vy += f.g * dt;
      if (f.kind === 'ember') {
        if (f.sway !== undefined) f.x += Math.sin(t * 1.7 + f.sway) * 0.3;
        c.globalAlpha = Math.min(1, a * 1.5) * (0.6 + 0.4 * Math.sin(t * 9 + (f.sway || 0)));
        c.fillStyle = '#ffb44a'; c.fillRect(f.x, f.y, 2, 2);
      } else if (f.kind === 'spark') { c.globalAlpha = a; c.fillStyle = '#ffe08a'; c.fillRect(f.x, f.y, 2.5, 2.5); }
      else if (f.kind === 'mist') { c.globalAlpha = Math.sin(a * Math.PI) * 0.35; c.beginPath(); c.arc(f.x, f.y, f.r * (1.6 - a * 0.6), 0, Math.PI * 2); c.fillStyle = '#eef6ff'; c.fill(); }
      else if (f.kind === 'confetti') {
        f.rot += dt * 6; c.globalAlpha = Math.min(1, a * 2);
        c.save(); c.translate(f.x, f.y); c.rotate(f.rot); c.fillStyle = f.col; c.fillRect(-3, -1.5, 6, 3); c.restore();
      }
    }
    c.globalAlpha = 1;
    s.fx = s.fx.filter(f => f.life > 0 && f.y < s.h + 10 && f.y > -10);
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
  // Switch both panels to an arena's artwork and crowd layout.
  function setArena(id) {
    if (!KCArenas.ART[id]) id = 'training';
    if (id === arenaId && scenes.every(s => s.L)) return;
    arenaId = id;
    for (const s of scenes) { attach(s); s.fx = []; resize(s); }
  }
  return { make, resize: () => scenes.forEach(resize), frame, cheer, celebrate, reset, setArena, get arena() { return arenaId; } };
})();
