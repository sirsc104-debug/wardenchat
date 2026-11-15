/* Putt Club: every texture is painted on a canvas at startup, so the page needs no image files. */
(function (PC) {
  'use strict';
  const U = PC.U;
  const cache = {};

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, repeat, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }
  function speckle(g, w, h, n, colors, rmin, rmax, rnd) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[Math.floor(rnd() * colors.length)];
      const r = rmin + rnd() * (rmax - rmin);
      g.beginPath(); g.ellipse(rnd() * w, rnd() * h, r, r * (0.6 + rnd() * 0.8), rnd() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  function once(key, make) { return cache[key] || (cache[key] = make()); }

  const T = PC.TEX = {};

  // Putting-green turf with mowing stripes. One tile covers 4 x 4 units.
  T.turf = (tint = '#5fae47') => once('turf' + tint, () => {
    const c = canvas(512, 512), g = c.getContext('2d'), rnd = U.rng(7);
    const base = new THREE.Color(tint);
    const light = base.clone().offsetHSL(0, -0.02, 0.045).getStyle(), dark = base.clone().offsetHSL(0, 0.02, -0.03).getStyle();
    g.fillStyle = light; g.fillRect(0, 0, 256, 512);
    g.fillStyle = dark; g.fillRect(256, 0, 256, 512);
    const tones = [0, 1, 2, 3].map(i => base.clone().offsetHSL((rnd() - 0.5) * 0.03, 0, (i - 1.5) * 0.035).getStyle());
    g.globalAlpha = 0.5;
    for (let i = 0; i < 9000; i++) { g.fillStyle = tones[i % 4]; g.fillRect(rnd() * 512, rnd() * 512, 1.6, 3 + rnd() * 3); }
    g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
    for (let i = 0; i < 1400; i++) g.fillRect(rnd() * 512, rnd() * 512, 1, 2);
    g.globalAlpha = 1;
    return tex(c);
  });

  T.grass = () => once('grass', () => {
    const c = canvas(256, 256), g = c.getContext('2d'), rnd = U.rng(3);
    g.fillStyle = '#4f8f39'; g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.5;
    speckle(g, 256, 256, 160, ['#4a8836', '#559640', '#4b8a37', '#5a9a42'], 6, 16, rnd);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 5000; i++) { g.fillStyle = rnd() < 0.5 ? '#43802f' : '#62a447'; g.fillRect(rnd() * 256, rnd() * 256, 1, 3 + rnd() * 4); }
    g.globalAlpha = 1;
    return tex(c);
  });

  T.wood = (tone = '#a8713f') => once('wood' + tone, () => {
    const c = canvas(256, 64), g = c.getContext('2d'), rnd = U.rng(11);
    const base = new THREE.Color(tone);
    g.fillStyle = tone; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = base.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.12).getStyle();
      g.globalAlpha = 0.6; g.lineWidth = 0.6 + rnd() * 1.6;
      const y = rnd() * 64; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 1.6);
      g.stroke();
    }
    g.globalAlpha = 0.5; g.fillStyle = base.clone().offsetHSL(0, 0, -0.15).getStyle();
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(rnd() * 256, rnd() * 64, 4, 2, 0, 0, 7); g.fill(); }
    g.globalAlpha = 0.7; g.fillStyle = base.clone().offsetHSL(0, 0, -0.2).getStyle();
    g.fillRect(127, 0, 2, 64); g.fillRect(0, 31, 256, 1.2);
    g.globalAlpha = 1;
    return tex(c);
  });

  T.planks = () => once('planks', () => {
    const c = canvas(128, 256), g = c.getContext('2d'), rnd = U.rng(5);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = new THREE.Color('#9b5b34').offsetHSL(0, 0, (rnd() - 0.5) * 0.08).getStyle();
      g.fillRect(0, i * 32, 128, 30);
      g.fillStyle = '#4a2a17'; g.fillRect(0, i * 32 + 30, 128, 2);
      g.fillStyle = '#3b2010'; g.fillRect(10, i * 32 + 13, 3, 3); g.fillRect(115, i * 32 + 13, 3, 3);
    }
    return tex(c);
  });

  T.stone = () => once('stone', () => {
    const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(21);
    g.fillStyle = '#6f6a62'; g.fillRect(0, 0, 256, 128);
    let y = 0;
    while (y < 128) {
      const h = 22 + rnd() * 18; let x = -rnd() * 30;
      while (x < 256) {
        const w = 28 + rnd() * 34;
        g.fillStyle = new THREE.Color('#b9b2a3').offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.16).getStyle();
        g.beginPath();
        if (g.roundRect) g.roundRect(x + 2, y + 2, w - 4, h - 4, 7); else g.rect(x + 2, y + 2, w - 4, h - 4);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 5, y + 4, w - 12, 3);
        x += w;
      }
      y += h;
    }
    return tex(c);
  });

  T.brick = () => once('brick', () => {
    const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(31);
    g.fillStyle = '#d8cbb8'; g.fillRect(0, 0, 256, 128);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 32 : 0;
      for (let x = -off; x < 256; x += 64) {
        g.fillStyle = new THREE.Color('#b4553a').offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.12).getStyle();
        g.fillRect(x + 2, row * 16 + 2, 60, 12);
      }
    }
    return tex(c);
  });

  T.hedge = () => once('hedge', () => {
    const c = canvas(256, 256), g = c.getContext('2d'), rnd = U.rng(41);
    g.fillStyle = '#2f6b2a'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 2600, ['#285e24', '#3b7f32', '#22521f', '#4a9140', '#367530'], 2, 6, rnd);
    g.globalAlpha = 0.35; speckle(g, 256, 256, 400, ['#7cc06b'], 1.5, 3, rnd); g.globalAlpha = 1;
    return tex(c);
  });

  T.soil = () => once('soil', () => {
    const c = canvas(256, 256), g = c.getContext('2d'), rnd = U.rng(51);
    g.fillStyle = '#6b4a2f'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 900, ['#5a3d26', '#7a5637', '#4c3320', '#86613f'], 1.5, 5, rnd);
    return tex(c);
  });

  T.pebbles = () => once('pebbles', () => {
    const c = canvas(256, 256), g = c.getContext('2d'), rnd = U.rng(61);
    g.fillStyle = '#7d7464'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 700, ['#9b9282', '#b8ad9a', '#6c6355', '#c9c0ae', '#8b8270'], 4, 10, rnd);
    return tex(c);
  });

  T.slime = () => once('slime', () => {
    const c = canvas(256, 256), g = c.getContext('2d'), rnd = U.rng(71);
    g.fillStyle = '#8fd048'; g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.35; speckle(g, 256, 256, 140, ['#d9ff9a', '#7fbf3f'], 3, 12, rnd);
    g.globalAlpha = 0.7; g.strokeStyle = '#efffd2'; g.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 2 + rnd() * 4, 0, 7); g.stroke(); }
    g.globalAlpha = 1;
    return tex(c);
  });

  T.honey = () => once('honey', () => {
    const c = canvas(256, 256), g = c.getContext('2d'), rnd = U.rng(81);
    g.fillStyle = '#c97806'; g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.35; speckle(g, 256, 256, 120, ['#e89a14', '#a35a02', '#f2b437'], 6, 22, rnd);
    g.globalAlpha = 0.5; speckle(g, 256, 256, 30, ['#ffe08a'], 2, 5, rnd);
    g.globalAlpha = 1;
    return tex(c);
  });

  // Sunflower head: seeds in the golden-angle spiral, centred in the texture.
  T.seeds = () => once('seeds', () => {
    const S = 1024, c = canvas(S, S), g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, '#3a2412'); grd.addColorStop(0.75, '#5a3818'); grd.addColorStop(0.95, '#7a4e1e'); grd.addColorStop(1, '#a8741e');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    const n = 1500, golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 1; i < n; i++) {
      const r = Math.sqrt(i / n) * S * 0.49, a = i * golden;
      const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
      const s = 3 + (r / (S * 0.49)) * 7;
      g.fillStyle = i % 3 ? '#2a170a' : '#4a2c12';
      g.beginPath(); g.ellipse(x, y, s, s * 0.7, a, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,214,120,0.18)';
      g.beginPath(); g.ellipse(x - s * 0.2, y - s * 0.2, s * 0.4, s * 0.25, a, 0, 7); g.fill();
    }
    return tex(c, false);
  });

  // The turning daisy: white petals around a yellow middle.
  T.daisy = () => once('daisy', () => {
    const S = 1024, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(91);
    g.fillStyle = '#5aa845'; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill();
    g.save(); g.translate(S / 2, S / 2);
    for (let i = 0; i < 22; i++) {
      g.rotate((Math.PI * 2) / 22);
      g.fillStyle = i % 2 ? '#ffffff' : '#f6f3ff';
      g.beginPath(); g.ellipse(S * 0.29, 0, S * 0.2, S * 0.055, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(180,170,210,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(S * 0.12, 0); g.lineTo(S * 0.46, 0); g.stroke();
    }
    g.restore();
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.13);
    grd.addColorStop(0, '#ffb000'); grd.addColorStop(1, '#ffd84a');
    g.fillStyle = grd; g.beginPath(); g.arc(S / 2, S / 2, S * 0.13, 0, 7); g.fill();
    speckle(g, S, S, 0, [], 1, 1, rnd);
    g.strokeStyle = '#2f5f25'; g.lineWidth = 10; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 5, 0, 7); g.stroke();
    return tex(c, false);
  });

  T.lilypad = () => once('lilypad', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, '#7cc552'); grd.addColorStop(1, '#3f8a2e');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(210,255,170,0.45)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + Math.cos(a) * S / 2, S / 2 + Math.sin(a) * S / 2); g.stroke(); }
    return tex(c, false);
  });

  // Water ripples as a normal map.
  T.waterNormal = () => once('waterN', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d');
    const img = g.createImageData(S, S), rnd = U.rng(101);
    const waves = [];
    for (let i = 0; i < 9; i++) waves.push([rnd() * 6 + 1, rnd() * 6 + 1, rnd() * 6.28, 0.5 + rnd()]);
    const hgt = (x, y) => waves.reduce((s, w) => s + Math.sin(((x * Math.round(w[0]) + y * Math.round(w[1])) / S) * Math.PI * 2 + w[2]) * w[3], 0);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
      const nx = -dx * 2, ny = -dy * 2, nz = 1, l = Math.hypot(nx, ny, nz);
      const k = (y * S + x) * 4;
      img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c, true, false);
  });

  T.dimples = () => once('dimples', () => {
    const S = 128, c = canvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#c8c8c8';
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { g.beginPath(); g.arc(x * 11 + (y % 2) * 5.5 + 3, y * 11 + 3, 3.4, 0, 7); g.fill(); }
    return tex(c, true, false);
  });

  // Soft round sprite for particles.
  T.dot = () => once('dot', () => {
    const S = 64, c = canvas(S, S), g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    return tex(c, false);
  });

  // A petal-shaped sprite for confetti and blowing leaves.
  T.petal = () => once('petal', () => {
    const S = 64, c = canvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(58, 18, 52, 50, 32, 60); g.bezierCurveTo(12, 50, 6, 18, 32, 4); g.fill();
    return tex(c, false);
  });

  T.cupShade = () => once('cupShade', () => {
    const S = 128, c = canvas(S, S), g = c.getContext('2d');
    const grd = g.createRadialGradient(S * 0.46, S * 0.44, S * 0.05, S / 2, S / 2, S / 2);
    grd.addColorStop(0, '#050505'); grd.addColorStop(0.7, '#121212'); grd.addColorStop(0.92, '#2b2b2b'); grd.addColorStop(1, '#3a3a3a');
    g.fillStyle = grd; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill();
    return tex(c, false);
  });

  T.pole = () => once('pole', () => {
    const c = canvas(16, 128), g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e2463b'; g.fillRect(0, i * 16, 16, 16); }
    return tex(c);
  });

  // The flag shows the hole number.
  T.flag = (num, color = '#e2463b') => {
    const c = canvas(256, 160), g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 256, 160);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 256, 20);
    g.fillStyle = '#ffffff'; g.font = '700 108px Fredoka, Outfit, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(num), 128, 86);
    return tex(c, false);
  };

  // The wooden sign by each tee.
  T.sign = (num, name, par, hell) => {
    const c = canvas(512, 256), g = c.getContext('2d');
    g.fillStyle = hell ? '#2a2124' : '#7a4a26'; g.fillRect(0, 0, 512, 256);
    const rnd = U.rng(num * 7);
    g.globalAlpha = 0.25;
    for (let i = 0; i < 40; i++) { g.strokeStyle = rnd() < 0.5 ? '#5a3418' : '#9a6638'; g.lineWidth = 1 + rnd() * 2; const y = rnd() * 256; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 6, 340, y - 6, 512, y + 3); g.stroke(); }
    g.globalAlpha = 1;
    g.strokeStyle = hell ? '#ff6a1a' : '#f3e3c3'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 228);
    g.fillStyle = hell ? '#ffb06a' : '#f3e3c3'; g.textAlign = 'center';
    g.font = '600 36px Fredoka, Outfit, system-ui, sans-serif'; g.fillText((hell ? 'ABYSS ' : 'HOLE ') + num + '  ·  PAR ' + par, 256, 74);
    g.font = '700 66px Fredoka, Outfit, system-ui, sans-serif';
    let size = 66; while (g.measureText(name).width > 440 && size > 30) { size -= 4; g.font = `700 ${size}px Fredoka, Outfit, system-ui, sans-serif`; }
    g.fillText(name, 256, 168);
    return tex(c, false);
  };

  T.seedPacket = () => once('seedPacket', () => {
    const c = canvas(256, 192), g = c.getContext('2d');
    g.fillStyle = '#f4e6c3'; g.fillRect(0, 0, 256, 192);
    g.fillStyle = '#3f8a2e'; g.fillRect(0, 0, 256, 44);
    g.fillStyle = '#ffffff'; g.font = '700 30px Outfit, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('MAGIC BEANS', 128, 32);
    g.fillStyle = '#5aa845';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(50 + i * 40, 110, 14, 22, 0.3, 0, 7); g.fill(); }
    g.fillStyle = '#7a4a26'; g.font = '600 20px Outfit, system-ui, sans-serif'; g.fillText('roll over to plant', 128, 172);
    return tex(c, false);
  });

  // ---------- The Abyss ----------
  // Charred felt for the platforms, with faint ember stripes.
  T.ashTurf = () => once('ashTurf', () => {
    const c = canvas(512, 512), g = c.getContext('2d'), rnd = U.rng(201);
    g.fillStyle = '#3d3336'; g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#332a2d'; g.fillRect(256, 0, 256, 512);
    g.globalAlpha = 0.5;
    for (let i = 0; i < 9000; i++) { g.fillStyle = ['#463b3e', '#2c2427', '#3a2f32', '#4d3a36'][i % 4]; g.fillRect(rnd() * 512, rnd() * 512, 1.6, 3 + rnd() * 3); }
    g.globalAlpha = 0.55;
    for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? '#ff5a1f' : '#ffae3a'; g.fillRect(rnd() * 512, rnd() * 512, 1.4, 1.4); }
    g.globalAlpha = 1;
    return tex(c);
  });

  // Basalt with glowing cracks: a colour map and a matching glow map.
  T.basalt = () => once('basalt', () => {
    const S = 256, rnd = U.rng(211);
    const c = canvas(S, S), g = c.getContext('2d'), e = canvas(S, S), h = e.getContext('2d');
    g.fillStyle = '#2a2124'; g.fillRect(0, 0, S, S);
    speckle(g, S, S, 500, ['#33282b', '#221a1c', '#3b2e2f', '#2e2426'], 3, 12, rnd);
    h.fillStyle = '#000000'; h.fillRect(0, 0, S, S);
    for (let k = 0; k < 14; k++) {
      let x = rnd() * S, y = rnd() * S;
      const pts = [[x, y]];
      for (let i = 0; i < 6; i++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; pts.push([x, y]); }
      [[g, '#8a2a0c', 4], [g, '#ff6a1a', 1.6], [h, '#ff7a2a', 3], [h, '#ffd27a', 1]].forEach(([ctx, colr, w]) => {
        ctx.strokeStyle = colr; ctx.lineWidth = w; ctx.lineJoin = 'round';
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      });
    }
    return { map: tex(c), glow: tex(e) };
  });

  // Molten lava: soft overlapping glows with a few darker crusts and bright seams.
  T.lava = () => once('lava', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(221);
    g.fillStyle = '#e84a0c'; g.fillRect(0, 0, S, S);
    const blob = (x, y, r, colr, a) => {
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        grd.addColorStop(0, colr.replace('A', a)); grd.addColorStop(1, colr.replace('A', 0));
        g.fillStyle = grd; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    };
    for (let i = 0; i < 70; i++) blob(rnd() * S, rnd() * S, 20 + rnd() * 50, 'rgba(255,170,40,A)', 0.55);
    for (let i = 0; i < 40; i++) blob(rnd() * S, rnd() * S, 14 + rnd() * 34, 'rgba(120,20,4,A)', 0.55);
    for (let i = 0; i < 30; i++) blob(rnd() * S, rnd() * S, 6 + rnd() * 14, 'rgba(255,230,140,A)', 0.7);
    return tex(c);
  });

  // The sea far below: mostly dark crust with glowing seams.
  T.lavaSea = () => once('lavaSea', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(281);
    g.fillStyle = '#2a0a06'; g.fillRect(0, 0, S, S);
    speckle(g, S, S, 120, ['#3a0e08', '#1c0604', '#4a1208'], 10, 34, rnd);
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      let x = rnd() * S, y = rnd() * S;
      const pts = [[x, y]];
      for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; pts.push([x, y]); }
      [['#ff5a0a', 5], ['#ffb43a', 1.6]].forEach(([cl, w]) => { g.strokeStyle = cl; g.lineWidth = w; g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); });
    }
    g.globalAlpha = 0.8; speckle(g, S, S, 40, ['#ff7a1a', '#ff9a2a'], 3, 9, rnd); g.globalAlpha = 1;
    return tex(c);
  });

  T.obsidian = () => once('obsidian', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(231);
    g.fillStyle = '#120e16'; g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 40; i++) { g.strokeStyle = rnd() < 0.5 ? '#3a2a5a' : '#5a2a3a'; g.lineWidth = 1 + rnd() * 3; g.beginPath(); const y = rnd() * S; g.moveTo(0, y); g.bezierCurveTo(80, y + (rnd() - 0.5) * 60, 170, y + (rnd() - 0.5) * 60, S, y + (rnd() - 0.5) * 30); g.stroke(); }
    g.globalAlpha = 1;
    return tex(c);
  });

  T.tar = () => once('tar', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(241);
    g.fillStyle = '#141012'; g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.5; speckle(g, S, S, 90, ['#221a1e', '#0a0809', '#2a1f22'], 8, 26, rnd);
    g.globalAlpha = 0.6; g.strokeStyle = '#4a3a40'; g.lineWidth = 1.5;
    for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(rnd() * S, rnd() * S, 3 + rnd() * 6, 0, 7); g.stroke(); }
    g.globalAlpha = 1;
    return tex(c);
  });

  T.ash = () => once('ash', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(251);
    g.fillStyle = '#5a5150'; g.fillRect(0, 0, S, S);
    speckle(g, S, S, 900, ['#4a4241', '#6a605e', '#3a3333', '#7a6e6a'], 1.5, 5, rnd);
    g.globalAlpha = 0.6; speckle(g, S, S, 60, ['#ff5a1f'], 1, 2, rnd); g.globalAlpha = 1;
    return tex(c);
  });

  // A rune circle for the turning wheel.
  T.runes = () => once('runes', () => {
    const S = 1024, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(261);
    g.fillStyle = '#2a2127'; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill();
    speckle(g, S, S, 700, ['#33292f', '#221a20', '#3a2e34'], 4, 16, rnd);
    g.strokeStyle = '#ff5a1a'; g.shadowColor = '#ff7a2a'; g.shadowBlur = 18;
    [[0.46, 10], [0.38, 6], [0.16, 6]].forEach(([r, w]) => { g.lineWidth = w; g.beginPath(); g.arc(S / 2, S / 2, S * r, 0, 7); g.stroke(); });
    g.lineWidth = 7; g.beginPath();
    for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5, x = S / 2 + Math.cos(a) * S * 0.38, y = S / 2 + Math.sin(a) * S * 0.38; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.font = '700 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff8a3a';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(S / 2 + Math.cos(a) * S * 0.42, S / 2 + Math.sin(a) * S * 0.42); g.rotate(a + Math.PI / 2); g.fillText(glyphs[i], 0, 0); g.restore(); }
    g.shadowBlur = 0;
    return tex(c, false);
  });

  T.bone = () => once('bone', () => {
    const c = canvas(128, 256), g = c.getContext('2d'), rnd = U.rng(271);
    g.fillStyle = '#e6dbc2'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(90,70,50,0.35)'; g.fillRect(0, i * 32 + 28, 128, 4); }
    speckle(g, 128, 256, 120, ['#d4c6a8', '#f2e9d6', '#c9b994'], 1, 4, rnd);
    return tex(c);
  });

  T.lattice = () => once('lattice', () => {
    const c = canvas(128, 128), g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = '#fbfaf5'; g.lineWidth = 9;
    for (let i = -128; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
    for (let i = -128; i < 256; i += 32) { g.beginPath(); g.moveTo(i + 4, 0); g.lineTo(i + 132, 128); g.stroke(); }
    return tex(c);
  });

  T.mushroomCap = () => once('mushroomCap', () => {
    const c = canvas(256, 128), g = c.getContext('2d'), rnd = U.rng(121);
    g.fillStyle = '#e0352b'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#fff8ee';
    for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(rnd() * 256, 10 + rnd() * 80, 8 + rnd() * 9, 6 + rnd() * 6, 0, 0, 7); g.fill(); }
    return tex(c);
  });

  T.vine = () => once('vine', () => {
    const c = canvas(128, 256), g = c.getContext('2d'), rnd = U.rng(131);
    g.fillStyle = '#3f8a2e'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 6; i++) { g.strokeStyle = i % 2 ? '#2f6e22' : '#5aa845'; g.lineWidth = 10; g.beginPath(); for (let y = 0; y <= 256; y += 8) g.lineTo(20 + i * 18 + Math.sin(y * 0.05 + i) * 8, y); g.stroke(); }
    speckle(g, 128, 256, 50, ['#7cc552', '#4f9c3a'], 5, 10, rnd);
    return tex(c);
  });
})(window.PC = window.PC || {});
