/* Putt Club: how each cosmetic looks (cosmetics.js says which ones you wear). Ball designs, trails,
   hole-out celebrations, flags and scenery. These only change the picture, never the physics.
   They extend PC.World, which calls setLook / spawnTrail / sinkBurst / buildSceneFx. */
(function (PC) {
  'use strict';
  const U = PC.U, C = PC.C, T = PC.TEX, TAU = U.TAU;
  const col = PC.col, V = PC.V;
  const W = PC.World.prototype;
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; if (srgb && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; return t; };
  const cache = {};
  const once = (k, f) => cache[k] || (cache[k] = f());

  // ---------- Ball designs ----------
  // Equirectangular canvases wrapped round the ball.
  const BALL_TEX = {
    beach: () => { const c = canvas(256, 128), g = c.getContext('2d'); const cols = ['#e8384f', '#ffd23f', '#2f7fe0', '#ffffff', '#2fbf71', '#ff8a2a']; cols.forEach((k, i) => { g.fillStyle = k; g.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); }); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 10); g.fillRect(0, 118, 256, 10); return tex(c); },
    soccer: () => { const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(5); g.fillStyle = '#f8f8f4'; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#1a1a1e'; for (let i = 0; i < 12; i++) { const x = (i % 6) * 43 + (i > 5 ? 21 : 0), y = i > 5 ? 86 : 40, r = 13; g.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + rnd() * 0.2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); } g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(rnd() * 256, rnd() * 128); g.lineTo(rnd() * 256, rnd() * 128); g.stroke(); } return tex(c); },
    moon: () => { const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(9); g.fillStyle = '#b8b6b0'; g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '80,78,74' : '230,228,222'},${0.15 + rnd() * 0.2})`; g.fillRect(rnd() * 256, rnd() * 128, 2, 2); }
      for (let i = 0; i < 26; i++) { const x = rnd() * 256, y = 10 + rnd() * 108, r = 3 + rnd() * 10; const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); gr.addColorStop(0, '#8e8c86'); gr.addColorStop(0.8, '#9c9a94'); gr.addColorStop(1, '#d8d6d0'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } return tex(c); },
    disco: () => { const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(3); for (let y = 0; y < 128; y += 8) for (let x = 0; x < 256; x += 8) { const v = 140 + rnd() * 115 | 0; g.fillStyle = `rgb(${v},${v},${v + 10})`; g.fillRect(x, y, 7, 7); if (rnd() < 0.08) { g.fillStyle = ['#ff7ad9', '#7ad9ff', '#fff27a'][rnd() * 3 | 0]; g.fillRect(x, y, 7, 7); } } return tex(c); },
    galaxy: () => { const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(21); const gr = g.createLinearGradient(0, 0, 256, 128); gr.addColorStop(0, '#120a3a'); gr.addColorStop(1, '#2a0a3a'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 14; i++) { const x = rnd() * 256, y = rnd() * 128, r = 18 + rnd() * 40; const ng = g.createRadialGradient(x, y, 0, x, y, r); ng.addColorStop(0, ['rgba(255,90,200,0.55)', 'rgba(90,160,255,0.55)', 'rgba(160,90,255,0.5)'][i % 3]); ng.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ng; g.fillRect(x - r, y - r, r * 2, r * 2); }
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.6})`; const s = rnd() < 0.1 ? 2 : 1; g.fillRect(rnd() * 256, rnd() * 128, s, s); } return tex(c); },
    diamond: () => { const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(31); for (let y = 0; y < 128; y += 16) for (let x = 0; x < 256; x += 16) { for (let k = 0; k < 2; k++) { const v = rnd(); g.fillStyle = `hsl(${200 + rnd() * 25},${70 + rnd() * 25}%,${55 + v * 40}%)`; g.beginPath(); if (k) { g.moveTo(x, y); g.lineTo(x + 16, y); g.lineTo(x + 16, y + 16); } else { g.moveTo(x, y); g.lineTo(x, y + 16); g.lineTo(x + 16, y + 16); } g.closePath(); g.fill(); } } return tex(c); },
  };
  PC.ballSwatch = id => (BALL_TEX[id] ? once('ball-' + id, BALL_TEX[id]).image : null);
  W.setBallSkin = function (id) {
    const m = this.ball.material, c = PC.COSMETIC_BALL && PC.COSMETIC_BALL[id];
    const def = COSMETICS.ball[id] || {};
    m.map = BALL_TEX[id] ? once('ball-' + id, BALL_TEX[id]) : null;
    m.color = col(def.color || (BALL_TEX[id] ? '#ffffff' : '#fbfbf7'));
    m.metalness = id === 'gold' ? 0.75 : id === 'disco' ? 0.55 : id === 'diamond' ? 0.3 : 0;
    m.roughness = id === 'gold' ? 0.28 : id === 'disco' ? 0.18 : id === 'diamond' ? 0.12 : id === 'ruby' ? 0.18 : 0.32;
    m.emissive = col(id === 'galaxy' ? '#ffffff' : id === 'diamond' ? '#2a6aff' : id === 'gold' ? '#4a3200' : '#222222');
    m.emissiveMap = id === 'galaxy' ? m.map : null;
    m.emissiveIntensity = id === 'galaxy' ? 0.55 : id === 'diamond' ? 0.35 : 1;
    m.bumpScale = BALL_TEX[id] ? 0.002 : 0.004;
    m.needsUpdate = true;
    void c;
  };

  // ---------- Trails ----------
  const RAINBOW = ['#ff4d4d', '#ff9a2a', '#ffe24a', '#4ade80', '#38bdf8', '#a78bfa'];
  W.spawnTrail = function (style, p, sp, dt, t) {
    this.trailAcc = (this.trailAcc || 0) + dt * Math.min(1, sp / 2) * 60;
    const G = this.glow, F = this.fx, r = () => Math.random() - 0.5;
    while (this.trailAcc > 1) {
      this.trailAcc -= 1;
      if (style === 'plain') { if (sp > 3) G.spawn({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, g: 0, life: 0.35, size: 0.09 * Math.min(1, sp / 8), color: col('#ffffff'), a: 0.35 }); continue; }
      if (style === 'sparkle') G.spawn({ x: p.x + r() * 0.1, y: p.y + r() * 0.08, z: p.z + r() * 0.1, vx: r() * 0.4, vy: 0.3 + Math.random() * 0.4, vz: r() * 0.4, g: -0.6, life: 0.6 + Math.random() * 0.3, size: 0.04 + Math.random() * 0.04, color: col(Math.random() < 0.5 ? '#ffe27a' : '#ffffff'), a: 0.95 });
      else if (style === 'bubbles') G.spawn({ x: p.x + r() * 0.1, y: p.y, z: p.z + r() * 0.1, vx: r() * 0.2, vy: 0.4 + Math.random() * 0.4, vz: r() * 0.2, g: 0.15, drag: 0.98, life: 1.2, size: 0.05 + Math.random() * 0.05, grow: 0.4, color: col('#bfe8ff'), a: 0.55, wobble: 1.2, seed: Math.random() * 9 });
      else if (style === 'petals') F.spawn({ x: p.x + r() * 0.1, y: p.y + 0.05, z: p.z + r() * 0.1, vx: r() * 0.5, vy: 0.5, vz: r() * 0.5, g: -0.8, drag: 0.97, life: 1.6, size: 0.06, color: col(Math.random() < 0.6 ? '#ffb3c6' : '#ffffff'), wobble: 3, seed: Math.random() * 9, floor: p.y - C.R + 0.01 });
      else if (style === 'rainbow') G.spawn({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, g: 0, life: 0.7, size: 0.1, color: col(RAINBOW[Math.floor(t * 12) % RAINBOW.length]), a: 0.7 });
      else if (style === 'fire') { G.spawn({ x: p.x + r() * 0.06, y: p.y, z: p.z + r() * 0.06, vx: r() * 0.3, vy: 0.8 + Math.random() * 0.8, vz: r() * 0.3, g: 0.4, drag: 0.96, life: 0.45, size: 0.09 + Math.random() * 0.05, grow: -0.5, color: col(Math.random() < 0.5 ? '#ff7a1a' : '#ffd25a'), a: 0.9 }); if (Math.random() < 0.2) this.smoke.spawn({ x: p.x, y: p.y + 0.1, z: p.z, vx: 0, vy: 0.4, vz: 0, g: 0, life: 1, size: 0.1, grow: 2, color: col('#555555'), a: 0.25 }); }
      else if (style === 'stardust') G.spawn({ x: p.x + r() * 0.12, y: p.y + r() * 0.12, z: p.z + r() * 0.12, vx: r() * 0.2, vy: 0.1, vz: r() * 0.2, g: 0, life: 1.4, size: 0.035 + Math.random() * 0.05, color: col(['#c4b5fd', '#93c5fd', '#ffffff', '#f0abfc'][Math.random() * 4 | 0]), a: 0.9 });
      else if (style === 'diamond') { G.spawn({ x: p.x + r() * 0.1, y: p.y + r() * 0.06, z: p.z + r() * 0.1, vx: r() * 0.3, vy: 0.2, vz: r() * 0.3, g: -0.4, life: 0.9, size: 0.05, color: col(Math.random() < 0.5 ? '#7fd8ff' : '#e9fbff'), a: 0.95 }); if (Math.random() < 0.3) F.spawn({ x: p.x, y: p.y, z: p.z, vx: r() * 0.6, vy: 0.6, vz: r() * 0.6, g: -3, life: 0.8, size: 0.05, color: col('#9fe4ff'), wobble: 2, seed: Math.random() * 9, floor: p.y - C.R + 0.01 }); }
    }
  };

  // ---------- Hole-out celebrations ----------
  W.sinkBurst = function (style, x, y, h, big) {
    const G = this.glow, F = this.fx, r = Math.random, n = big ? 2 : 1;
    if (style === 'balloons') {
      const cols = ['#e8384f', '#ffd23f', '#2f7fe0', '#2fbf71', '#ff8a2a', '#c084fc'];
      for (let i = 0; i < 9 * n; i++) G.spawn({ x: x + (r() - 0.5) * 0.4, y: h + 0.2, z: -y + (r() - 0.5) * 0.4, vx: (r() - 0.5) * 0.6, vy: 1.2 + r() * 0.8, vz: (r() - 0.5) * 0.6, g: 0.3, drag: 0.99, life: 3.5, size: 0.3 + r() * 0.1, color: col(cols[i % cols.length]), a: 0.95, wobble: 0.8, seed: r() * 9 });
    } else if (style === 'bubbles') {
      for (let i = 0; i < 50 * n; i++) G.spawn({ x, y: h + 0.1, z: -y, vx: (r() - 0.5) * 1.6, vy: 1 + r() * 2.2, vz: (r() - 0.5) * 1.6, g: -0.3, drag: 0.97, life: 2 + r(), size: 0.06 + r() * 0.1, grow: 0.3, color: col('#cfefff'), a: 0.6, wobble: 1.5, seed: r() * 9 });
    } else if (style === 'fireworks') {
      const pal = [['#ff4d6d', '#ffd23f'], ['#4ade80', '#38bdf8'], ['#c084fc', '#ffffff'], ['#ff9a2a', '#fff27a']];
      for (let k = 0; k < 3 * n; k++) {
        const cx = x + (r() - 0.5) * 2, cy = h + 2.2 + r() * 1.2, cz = -y + (r() - 0.5) * 2, p = pal[(r() * pal.length) | 0];
        setTimeout(() => { for (let i = 0; i < 46; i++) { const a = r() * TAU, b = Math.acos(2 * r() - 1), s = 2.2 + r() * 0.8; G.spawn({ x: cx, y: cy, z: cz, vx: Math.sin(b) * Math.cos(a) * s, vy: Math.cos(b) * s, vz: Math.sin(b) * Math.sin(a) * s, g: -2.2, drag: 0.95, life: 1.1 + r() * 0.4, size: 0.07, color: col(p[i % 2]), a: 1 }); } }, k * 260);
      }
    } else if (style === 'snow') {
      for (let i = 0; i < 90 * n; i++) G.spawn({ x: x + (r() - 0.5) * 3, y: h + 1.5 + r() * 1.5, z: -y + (r() - 0.5) * 3, vx: (r() - 0.5) * 0.3, vy: -0.4 - r() * 0.4, vz: (r() - 0.5) * 0.3, g: 0, drag: 1, life: 3 + r() * 1.5, size: 0.05 + r() * 0.04, color: col('#ffffff'), a: 0.95, wobble: 1.5, seed: r() * 9, floor: h + 0.02 });
    } else if (style === 'lightning') {
      const pts = [], top = h + 7;
      let px = x, py = -y;
      for (let k = 0; k <= 10; k++) { const yy = top - (k / 10) * (top - h - 0.1); pts.push(new THREE.Vector3(px, yy, py)); px += (r() - 0.5) * 0.7; py += (r() - 0.5) * 0.7; }
      pts[pts.length - 1].set(x, h + 0.05, -y);
      const bolt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.05, 5, false), new THREE.MeshBasicMaterial({ color: col('#e8f4ff'), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.holeGroup.add(bolt);
      const flash = new THREE.PointLight(col('#bcd8ff'), 4, 20, 1.5); flash.position.set(x, h + 2, -y); this.holeGroup.add(flash);
      let life = 0.5;
      this.vis.push({ update: (tt, dt) => { if (life <= 0) return; life -= dt; bolt.material.opacity = Math.max(0, life * 2) * (0.6 + Math.random() * 0.4); flash.intensity = Math.max(0, life * 8); if (life <= 0) { this.holeGroup.remove(bolt, flash); bolt.geometry.dispose(); } } });
      for (let i = 0; i < 40 * n; i++) { const a = r() * TAU, s = 1 + r() * 2.5; G.spawn({ x, y: h + 0.1, z: -y, vx: Math.cos(a) * s, vy: 1 + r() * 2, vz: Math.sin(a) * s, g: -6, life: 0.5 + r() * 0.3, size: 0.05, color: col(r() < 0.5 ? '#bcd8ff' : '#ffffff') }); }
    } else if (style === 'goldrush') {
      for (let i = 0; i < 60 * n; i++) { const a = r() * TAU, s = 0.8 + r() * 1.8; F.spawn({ x, y: h + 0.1, z: -y, vx: Math.cos(a) * s, vy: 2.5 + r() * 3, vz: Math.sin(a) * s, g: -7, drag: 0.98, life: 2 + r(), size: 0.09, color: col(r() < 0.7 ? '#ffcc33' : '#fff2a8'), wobble: 4, seed: r() * 9, floor: h + 0.01 }); }
      for (let i = 0; i < 20; i++) G.spawn({ x, y: h + 0.2, z: -y, vx: (r() - 0.5) * 2, vy: 1 + r() * 2, vz: (r() - 0.5) * 2, g: -3, life: 0.8, size: 0.06, color: col('#fff6c8') });
    }
  };

  // ---------- Flags ----------
  T.flagStyled = (num, color, style) => {
    if (!style || style === 'classic') return T.flag(num, color);
    return once('flag-' + style + '-' + num, () => {
      const c = canvas(256, 160), g = c.getContext('2d');
      if (style === 'checkered') { for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#111111' : '#ffffff'; g.fillRect(x * 32, y * 32, 32, 32); } }
      else if (style === 'pirate') {
        g.fillStyle = '#121212'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#f4f1e8';
        g.beginPath(); g.arc(128, 66, 30, 0, TAU); g.fill(); g.fillRect(110, 84, 36, 20);
        g.fillStyle = '#121212'; g.beginPath(); g.arc(116, 64, 8, 0, TAU); g.arc(140, 64, 8, 0, TAU); g.fill(); g.fillRect(118, 92, 4, 10); g.fillRect(126, 92, 4, 10); g.fillRect(134, 92, 4, 10);
        g.strokeStyle = '#f4f1e8'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(84, 108); g.lineTo(172, 146); g.moveTo(172, 108); g.lineTo(84, 146); g.stroke();
      } else if (style === 'usa') {
        // Thirteen stripes, and the hole number on the blue where the stars would be.
        for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b22234'; g.fillRect(0, i * 160 / 13, 256, 160 / 13 + 1); }
        const cw = 110, ch = 160 * 7 / 13;
        g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, cw, ch);
        g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `700 ${String(num).length > 1 ? 58 : 66}px Fredoka, Outfit, system-ui, sans-serif`;
        g.fillText(String(num), cw / 2, ch / 2 + 3);
        return tex(c, false);
      }
      else if (style === 'dragon') {
        g.fillStyle = '#1f5a34'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#d42a3a';
        g.beginPath(); g.moveTo(60, 120); g.quadraticCurveTo(80, 50, 140, 60); g.lineTo(170, 34); g.lineTo(176, 62); g.lineTo(206, 70); g.lineTo(178, 84); g.quadraticCurveTo(150, 92, 130, 86); g.quadraticCurveTo(110, 110, 150, 128); g.quadraticCurveTo(90, 140, 60, 120); g.fill();
        g.beginPath(); g.moveTo(110, 70); g.lineTo(96, 24); g.lineTo(130, 58); g.fill();
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(180, 60, 3, 0, TAU); g.fill();
      } else if (style === 'sirsc') {
        const gr = g.createLinearGradient(0, 0, 256, 160); gr.addColorStop(0, '#1e3a8a'); gr.addColorStop(1, '#2f6fe0'); g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
        const dg = g.createLinearGradient(90, 30, 170, 130); dg.addColorStop(0, '#e9fbff'); dg.addColorStop(0.5, '#7fd8ff'); dg.addColorStop(1, '#3b82f6');
        g.fillStyle = dg; g.strokeStyle = '#0b1f5a'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(98, 40); g.lineTo(158, 40); g.lineTo(184, 72); g.lineTo(128, 136); g.lineTo(72, 72); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(72, 72); g.lineTo(184, 72); g.moveTo(98, 40); g.lineTo(112, 72); g.lineTo(128, 136); g.lineTo(144, 72); g.lineTo(158, 40); g.stroke();
      }
      // the hole number in a white disc
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(214, 30, 22, 0, TAU); g.fill();
      g.fillStyle = '#111111'; g.font = '700 30px Fredoka, Outfit, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 214, 32);
      return tex(c, false);
    });
  };

  // ---------- Scenery ----------
  const NIGHT = { top: '#03061a', mid: '#0d1a3e', horizon: '#26386e', sun: '#9fb4ff', sunI: 0.42, hemiSky: '#4a5a90', hemiGround: '#10101a', hemiI: 0.42, fog: '#0c1430', exposure: 1.05, cloud: '#26304c' };
  PC.SCENES = {
    standard: null,
    sunset: { light: { top: '#2f3f8f', mid: '#f08a6a', horizon: '#ffc070', sun: '#ff9448', sunI: 2.4, hemiSky: '#ffb488', hemiGround: '#5a3a3a', hemiI: 0.62, fog: '#f0a070', exposure: 0.92, cloud: '#ffb898' }, lowSun: true },
    blossom: { light: { top: '#7ab8ec', mid: '#f6c8dc', horizon: '#fff0f4', sun: '#fff0f4', sunI: 2.1, hemiSky: '#ffe0ee', hemiGround: '#8a6a7a', hemiI: 0.9, fog: '#f8dcea', exposure: 1.0, cloud: '#ffe8f2' }, petals: ['#ffb3c6', '#ffd1dc', '#ffffff'] },
    night: { light: NIGHT, stars: true, moon: true, lanterns: true },
    aurora: { light: Object.assign({}, NIGHT, { top: '#020a16', mid: '#0a2030', horizon: '#1a4a5a', fog: '#0a1c26' }), stars: true, aurora: true, lanterns: true },
    fireworks: { light: NIGHT, stars: true, fireworks: true, lanterns: true },
    harvest: { light: { top: '#1a1440', mid: '#7a3a5a', horizon: '#ff9a4a', sun: '#ff9a5a', sunI: 1.4, hemiSky: '#c08080', hemiGround: '#3a2a20', hemiI: 0.6, fog: '#5a3040', exposure: 1.0, cloud: '#7a5060' }, bigMoon: true, leaves: ['#e8701a', '#d93a2f', '#f2b234', '#b9551c'], lanterns: true, lowSun: true },
  };
  // The light preset a course gets with the scenery worn (the Abyss keeps its own cavern light).
  PC.sceneLight = (L, lightName, scene) => {
    const S = PC.SCENES[scene];
    if (!S || lightName === 'abyss') return L;
    return Object.assign({}, L, S.light);
  };

  const moonTex = (big) => once('moon' + (big ? 'big' : ''), () => {
    const c = canvas(256, 256), g = c.getContext('2d');
    const halo = g.createRadialGradient(128, 128, 40, 128, 128, 128); halo.addColorStop(0, big ? 'rgba(255,170,80,0.55)' : 'rgba(220,230,255,0.45)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 256, 256);
    const body = g.createRadialGradient(110, 110, 10, 128, 128, 62); body.addColorStop(0, big ? '#ffd08a' : '#fbfaf2'); body.addColorStop(1, big ? '#f08a3a' : '#d8dbe6');
    g.fillStyle = body; g.beginPath(); g.arc(128, 128, 60, 0, TAU); g.fill();
    const rnd = U.rng(big ? 2 : 1); g.fillStyle = big ? 'rgba(180,90,30,0.35)' : 'rgba(150,155,170,0.35)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(90 + rnd() * 76, 90 + rnd() * 76, 5 + rnd() * 12, 0, TAU); g.fill(); }
    return tex(c);
  });

  W.buildSceneFx = function (hole) {
    if (this.sceneFx) { this.scene.remove(this.sceneFx); this.sceneFx.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.sceneFx = null; }
    this.sceneTick = null;
    this.pts.forEach(l => { l.intensity = 0; });
    const id = (this.look && this.look.scene) || 'standard', S = PC.SCENES[id];
    if (!S || !hole || hole.look.theme === 'abyss') return;
    const G = new THREE.Group(), box = hole.box, cx = box.cx, cy = box.cy;
    const fwd = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    this.sceneFx = G; this.scene.add(G);
    if (S.stars) {
      const n = 1200, pos = new Float32Array(n * 3), rnd = U.rng(7);
      for (let i = 0; i < n; i++) { const a = rnd() * TAU, e = 0.08 + Math.pow(rnd(), 0.7) * 1.4, R = 280; pos[i * 3] = cx + Math.cos(a) * Math.cos(e) * R; pos[i * 3 + 1] = Math.sin(e) * R; pos[i * 3 + 2] = -(cy + Math.sin(a) * Math.cos(e) * R); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(sg, new THREE.PointsMaterial({ map: T.dot(), color: 0xffffff, size: 2.2, sizeAttenuation: true, transparent: true, depthWrite: false, fog: false }));
      stars.frustumCulled = false; G.add(stars);
    }
    if (S.moon || S.bigMoon) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex(!!S.bigMoon), transparent: true, depthWrite: false, fog: false }));
      const a = fwd + 0.55, d = S.bigMoon ? 200 : 230, e = S.bigMoon ? 0.09 : 0.42;
      m.position.set(cx + Math.cos(a) * d * Math.cos(e), Math.sin(e) * d + (S.bigMoon ? 8 : 0), -(cy + Math.sin(a) * d * Math.cos(e)));
      m.scale.setScalar(S.bigMoon ? 90 : 46);
      G.add(m);
    }
    if (S.aurora) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec2 vUv; uniform float t; void main() { vUv = uv; vec3 p = position; p.z += sin(uv.x * 9.0 + t * 0.4) * 12.0; p.y += sin(uv.x * 5.0 - t * 0.3) * 4.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'varying vec2 vUv; uniform float t; void main() { float band = 0.5 + 0.5 * sin(vUv.x * 40.0 + t * 0.8 + sin(vUv.x * 7.0 - t * 0.5) * 3.0); float fall = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y)); vec3 c = mix(vec3(0.15, 1.0, 0.55), vec3(0.6, 0.3, 1.0), vUv.y); float a = fall * (0.35 + 0.65 * band) * 0.55; gl_FragColor = vec4(c * a, a); }',
      });
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(320, 80, 80, 1), mat);
        const a = fwd + (i - 1) * 0.5, d = 165 + i * 20, h = 62 + i * 9;
        p.position.set(cx + Math.cos(a) * d, h, -(cy + Math.sin(a) * d));
        p.lookAt(cx, h, -cy);
        G.add(p);
      }
      this.sceneTick = (t) => { mat.uniforms.t.value = t; };
    }
    if (S.lanterns) {
      const spots = [[box.x0 - 1.4, box.y0 + box.h * 0.3], [box.x1 + 1.4, box.y0 + box.h * 0.55], [box.x0 - 1.4, box.y1 - 1]];
      spots.forEach(([x, y], i) => {
        const l = this.pts[i]; l.color = col('#ffcf8a'); l.intensity = 1.6; l.distance = 30; l.decay = 1.4; l.position.copy(V(x, y, 3.0));
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 8), new THREE.MeshStandardMaterial({ color: col('#2a2a30'), roughness: 0.6 }));
        pole.position.copy(V(x, y, PC.GROUND_Y + 1.5)); G.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: col('#ffe2a8') }));
        lamp.position.copy(V(x, y, PC.GROUND_Y + 3.1)); G.add(lamp);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.dot(), color: col('#ffb85a'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.position.copy(lamp.position); halo.scale.setScalar(1.6); G.add(halo);
      });
    }
    const fall = S.petals || S.leaves;
    let acc = 0, fwAcc = 0;
    const prevTick = this.sceneTick;
    this.sceneTick = (t, dt) => {
      if (prevTick) prevTick(t, dt);
      if (fall) {
        acc += dt * 14;
        while (acc > 1) { acc -= 1; const x = box.x0 - 6 + Math.random() * (box.w + 12), y = box.y0 - 4 + Math.random() * (box.h + 8); this.fx.spawn({ x, y: 4 + Math.random() * 3, z: -y, vx: 0.4 + Math.random() * 0.4, vy: -0.5 - Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.3, g: 0, drag: 1, life: 9, size: 0.08, color: col(fall[(Math.random() * fall.length) | 0]), wobble: 2.5, seed: Math.random() * 9, floor: PC.GROUND_Y + 0.02 }); }
      }
      if (S.fireworks) {
        fwAcc -= dt;
        if (fwAcc <= 0) {
          fwAcc = 0.7 + Math.random() * 1.2;
          const a = fwd + (Math.random() - 0.5) * 2.2, d = 50 + Math.random() * 40, x = cx + Math.cos(a) * d, z = -(cy + Math.sin(a) * d), y = 17 + Math.random() * 14;
          const pal = [['#ff4d6d', '#ffd23f'], ['#4ade80', '#38bdf8'], ['#c084fc', '#ffffff'], ['#ff9a2a', '#fff27a'], ['#38bdf8', '#ffffff']][(Math.random() * 5) | 0];
          for (let i = 0; i < 70; i++) { const u = Math.random() * TAU, v = Math.acos(2 * Math.random() - 1), s = 7 + Math.random() * 2; this.glow.spawn({ x, y, z, vx: Math.sin(v) * Math.cos(u) * s, vy: Math.cos(v) * s, vz: Math.sin(v) * Math.sin(u) * s, g: -3, drag: 0.96, life: 1.6 + Math.random() * 0.6, size: 0.9, color: col(pal[i % 2]), a: 1 }); }
        }
      }
    };
  };

  // Wear a look: the ball now; the flag, scenery and lighting on the next build (or at once, if asked).
  W.setLook = function (look, rebuild) {
    const prev = this.look || {};
    this.look = Object.assign({}, look);
    this.setBallSkin(this.look.ball);
    if (this.hole && this.cup && prev.flag !== this.look.flag) this.cup.flag.material.map = T.flagStyled(this.hole.num, this.hole.look.flag || '#e2463b', this.look.flag);
    if (rebuild && this.hole && prev.scene !== this.look.scene) {
      this.setLight(this.hole.look.light);
      this.buildSceneFx(this.hole);
      const cloud = col(this.L.cloud || '#ffffff');
      this.holeGroup.traverse(o => { if (o.material && o.material.userData && o.material.userData.cloud) o.material.color = cloud; });
    }
  };
})(window.PC);
