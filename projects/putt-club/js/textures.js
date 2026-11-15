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


  // Molten lava: soft overlapping glows with a few darker crusts and bright seams.
  T.lava = () => once('lava', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(221);
    g.fillStyle = '#b8340a'; g.fillRect(0, 0, S, S);
    const blob = (x, y, r, colr, a) => {
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        grd.addColorStop(0, colr.replace('A', a)); grd.addColorStop(1, colr.replace('A', 0));
        g.fillStyle = grd; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    };
    for (let i = 0; i < 70; i++) blob(rnd() * S, rnd() * S, 20 + rnd() * 50, 'rgba(255,120,24,A)', 0.55);
    for (let i = 0; i < 46; i++) blob(rnd() * S, rnd() * S, 14 + rnd() * 34, 'rgba(70,12,2,A)', 0.6);
    for (let i = 0; i < 26; i++) blob(rnd() * S, rnd() * S, 6 + rnd() * 14, 'rgba(255,200,90,A)', 0.6);
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

  // ---------- The canyon ----------
  // Wind-rippled sand for the desert floor.
  T.sand = () => once('sand', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(401);
    g.fillStyle = '#d9b07a'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) { const v = Math.sin((y / S) * Math.PI * 2 * 9 + Math.sin(y * 0.05) * 1.5); g.fillStyle = v > 0 ? 'rgba(255,240,210,0.10)' : 'rgba(150,100,60,0.08)'; g.fillRect(0, y, S, 2); }
    speckle(g, S, S, 1400, ['#c99a62', '#e6c08a', '#b88a56', '#f0d4a4'], 0.6, 1.8, rnd);
    return tex(c);
  });

  // Banded red sandstone: canyon walls, mesas, the sides of the course.
  T.sandstone = () => once('sandstone', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(411);
    const bands = ['#b8562e', '#c96a3a', '#a84a28', '#d8814a', '#c25f34', '#e09a62', '#9c4424'];
    let y = 0, i = 0;
    while (y < S) {
      const h = 6 + rnd() * 26;
      g.fillStyle = bands[(i++ * 3 + Math.floor(rnd() * 2)) % bands.length];
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 2);
      g.lineTo(S, y + h); g.lineTo(0, y + h); g.fill();
      y += h;
    }
    g.globalAlpha = 0.25; speckle(g, S, S, 500, ['#7a3a1c', '#f0b07a'], 0.8, 2.5, rnd);
    g.globalAlpha = 0.18; g.strokeStyle = '#5a2a14';
    for (let k = 0; k < 18; k++) { g.lineWidth = 1 + rnd() * 2; g.beginPath(); const x = rnd() * S; g.moveTo(x, rnd() * S); g.lineTo(x + (rnd() - 0.5) * 10, rnd() * S); g.stroke(); }
    g.globalAlpha = 1;
    return tex(c);
  });

  // Cactus skin: green ribs with little white spines along them.
  T.cactus = (tone = '#4f8a3a') => once('cactus' + tone, () => {
    const W = 128, Hh = 128, c = canvas(W, Hh), g = c.getContext('2d'), rnd = U.rng(421);
    const base = new THREE.Color(tone);
    const ribs = 8, w = W / ribs;
    for (let i = 0; i < ribs; i++) {
      const grd = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      grd.addColorStop(0, base.clone().offsetHSL(0, 0, -0.1).getStyle()); grd.addColorStop(0.5, base.clone().offsetHSL(0, 0, 0.06).getStyle()); grd.addColorStop(1, base.clone().offsetHSL(0, 0, -0.1).getStyle());
      g.fillStyle = grd; g.fillRect(i * w, 0, w, Hh);
    }
    for (let i = 0; i < ribs; i++) for (let y = 4; y < Hh; y += 11) {
      const x = i * w + w / 2 + (rnd() - 0.5);
      g.fillStyle = '#f4f0dc'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill();
      g.strokeStyle = 'rgba(250,248,230,0.8)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x - 3, y - 2); g.lineTo(x + 3, y + 2); g.moveTo(x + 3, y - 2); g.lineTo(x - 3, y + 2); g.stroke();
    }
    return tex(c);
  });

  // A woven desert rug for the Canyon tee: rust with cream, turquoise and black bands and a stepped diamond.
  T.teeRug = () => once('teeRug', () => {
    const W = 256, Hh = 200, c = canvas(W, Hh), g = c.getContext('2d'), rnd = U.rng(447);
    g.fillStyle = '#8a3a1c'; g.fillRect(0, 0, W, Hh);
    const band = (y, h, colr) => { g.fillStyle = colr; g.fillRect(0, y, W, h); g.fillRect(0, Hh - y - h, W, h); };
    band(14, 6, '#f0dcb4'); band(24, 10, '#2a1a12'); band(38, 6, '#3a9a8a'); band(48, 4, '#f0dcb4');
    // a stepped diamond in the middle
    const cx = W / 2, cy = Hh / 2, step = 9;
    [['#f0dcb4', 6], ['#2a1a12', 4], ['#3a9a8a', 2], ['#f0dcb4', 1]].forEach(([colr, n]) => {
      g.fillStyle = colr;
      for (let i = -n; i <= n; i++) { const w = (n - Math.abs(i) + 1) * step * 2 - step; g.fillRect(cx - w / 2, cy + i * step * 0.62 - step * 0.31, w, step * 0.62); }
    });
    // little zigzags either side
    g.strokeStyle = '#f0dcb4'; g.lineWidth = 3;
    [36, W - 36].forEach(x => { g.beginPath(); for (let k = 0; k <= 6; k++) g.lineTo(x + (k % 2 ? 9 : -9), 66 + k * 11); g.stroke(); });
    // the weave: fine threads across and along
    for (let y = 0; y < Hh; y += 2) { g.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.05})`; g.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 3) { g.fillStyle = `rgba(255,240,220,${rnd() * 0.05})`; g.fillRect(x, 0, 1, Hh); }
    // a fringe edge
    g.fillStyle = '#e8d2a8'; for (let x = 2; x < W; x += 5) { g.fillRect(x, 0, 2, 6); g.fillRect(x, Hh - 6, 2, 6); }
    return tex(c);
  });

  // Dry twigs on a clear background, for the shell of a tumbleweed.
  T.twigs = () => once('twigs', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(431);
    g.clearRect(0, 0, S, S);
    g.lineCap = 'round';
    for (let i = 0; i < 150; i++) {
      g.strokeStyle = ['#8a6a3c', '#a8844e', '#6e5230', '#c0a068'][i % 4];
      g.lineWidth = 1.2 + rnd() * 2;
      let x = rnd() * S, y = rnd() * S, a = rnd() * 6.28;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { a += (rnd() - 0.5) * 1.6; x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); }
      g.stroke();
    }
    return tex(c);
  });

  // ---------- The temple ----------
  // Polished dark flagstones for the putting surfaces: 4 x 4 slabs per tile (one slab per unit).
  T.templeFloor = () => once('templeFloor', () => {
    const S = 512, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(301);
    const q = S / 4;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const v = (rnd() - 0.5) * 0.06;
      g.fillStyle = new THREE.Color('#3b3436').offsetHSL(0, 0, v).getStyle();
      g.fillRect(i * q, j * q, q, q);
      g.globalAlpha = 0.18;
      for (let k = 0; k < 220; k++) { g.fillStyle = rnd() < 0.5 ? '#2c2628' : '#4a4144'; g.fillRect(i * q + rnd() * q, j * q + rnd() * q, 1 + rnd() * 2, 1 + rnd() * 2); }
      g.globalAlpha = 0.12; g.strokeStyle = '#5a4e4c'; g.lineWidth = 1;
      for (let k = 0; k < 3; k++) { g.beginPath(); const x = i * q + rnd() * q, y = j * q + rnd() * q; g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 50); g.stroke(); }
      g.globalAlpha = 1;
    }
    g.fillStyle = '#1b1517';
    for (let i = 0; i <= 4; i++) { g.fillRect(i * q - 1.5, 0, 3, S); g.fillRect(0, i * q - 1.5, S, 3); }
    g.globalAlpha = 0.25; g.fillStyle = '#6a5a52';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillRect(i * q + 2, j * q + 2, q - 4, 2); }
    g.globalAlpha = 1;
    return tex(c);
  });

  // Plain dressed masonry for the sides of platforms, columns and ruins.
  T.templeStone = () => once('templeStone', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(311);
    g.fillStyle = '#161214'; g.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = 26 + rnd() * 14; let x = -rnd() * 40;
      while (x < S) {
        const w = 44 + rnd() * 40;
        g.fillStyle = new THREE.Color('#3a3234').offsetHSL(0, 0, (rnd() - 0.5) * 0.08).getStyle();
        g.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 3, y + 3, w - 8, 2);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 3, y + h - 6, w - 6, 3);
        x += w;
      }
      y += h;
    }
    g.globalAlpha = 0.2; speckle(g, S, S, 300, ['#0e0b0c', '#4a4042'], 1, 3, rnd); g.globalAlpha = 1;
    return tex(c);
  });

  // A carved band of runes: a dark stone map and a glow map where only the runes are lit.
  T.runeBand = () => once('runeBand', () => {
    const W = 512, H = 128, rnd = U.rng(321);
    const c = canvas(W, H), g = c.getContext('2d'), e = canvas(W, H), h = e.getContext('2d');
    g.fillStyle = '#241e20'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#3a3032'; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);
    h.fillStyle = '#000'; h.fillRect(0, 0, W, H);
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    [g, h].forEach((ctx, k) => {
      ctx.font = '700 64px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 8; i++) {
        const ch = glyphs[(i * 7 + 3) % glyphs.length];
        if (k === 0) { ctx.fillStyle = '#120c0c'; ctx.fillText(ch, 32 + i * 64, 66); }
        else { ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffb060'; ctx.fillText(ch, 32 + i * 64, 66); ctx.shadowBlur = 0; }
      }
      ctx.fillStyle = k ? '#ff7a2a' : '#120c0c';
      ctx.fillRect(0, 16, W, 3); ctx.fillRect(0, H - 19, W, 3);
    });
    void rnd;
    return { map: tex(c), glow: tex(e) };
  });

  // Dark rock with a few thin glowing veins (magma boulders, the volcano, rafts).
  T.magmaRock = () => once('magmaRock', () => {
    const S = 256, rnd = U.rng(331);
    const c = canvas(S, S), g = c.getContext('2d'), e = canvas(S, S), h = e.getContext('2d');
    g.fillStyle = '#231c1d'; g.fillRect(0, 0, S, S);
    speckle(g, S, S, 420, ['#2c2324', '#1a1415', '#352a2a'], 3, 12, rnd);
    h.fillStyle = '#000'; h.fillRect(0, 0, S, S);
    for (let k = 0; k < 4; k++) {
      let x = rnd() * S, y = rnd() * S;
      const pts = [[x, y]];
      for (let i = 0; i < 5; i++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; pts.push([x, y]); }
      [[g, '#7a2a0c', 2.4], [h, '#ff7a2a', 2.2], [h, '#ffd27a', 0.8]].forEach(([ctx, colr, w]) => {
        ctx.strokeStyle = colr; ctx.lineWidth = w; ctx.lineJoin = 'round';
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      });
    }
    return { map: tex(c), glow: tex(e) };
  });

  // Rough cliff rock for the cavern walls (tiles a lot, so it stays subtle).
  T.cliff = () => once('cliff', () => {
    const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(341);
    g.fillStyle = '#1a1519'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) { g.strokeStyle = rnd() < 0.5 ? 'rgba(60,48,58,0.5)' : 'rgba(8,6,8,0.6)'; g.lineWidth = 2 + rnd() * 6; g.beginPath(); const x = rnd() * S; g.moveTo(x, 0); g.bezierCurveTo(x + (rnd() - 0.5) * 40, S * 0.3, x + (rnd() - 0.5) * 40, S * 0.7, x + (rnd() - 0.5) * 30, S); g.stroke(); }
    speckle(g, S, S, 200, ['#241d22', '#0f0c0e'], 2, 6, rnd);
    return tex(c);
  });

  // The lava far below: dark crust broken by wide, softly glowing flows (tiles seamlessly).
  T.lavaDeep = () => once('lavaDeep', () => {
    const S = 1024, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(351);
    g.fillStyle = '#170502'; g.fillRect(0, 0, S, S);
    speckle(g, S, S, 260, ['#220804', '#100302', '#2c0c06'], 16, 60, rnd);
    // broad rivers that all run roughly the same way, like a lake slowly flowing
    const a0 = 0.5, flows = [];
    for (let i = 0; i < 6; i++) {
      const pts = []; let x = rnd() * S, y = (i / 6) * S + rnd() * 60;
      for (let k = 0; k < 9; k++) { pts.push([x, y]); const a = a0 + Math.sin(k * 0.9 + i * 2.1) * 0.45; x += Math.cos(a) * 150; y += Math.sin(a) * 150 * 0.35; }
      flows.push({ pts, w: 0.7 + rnd() * 0.8 });
    }
    const stroke = (w, colr, blur, alpha) => {
      g.globalAlpha = alpha; g.strokeStyle = colr; g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = colr; g.shadowBlur = blur;
      flows.forEach(f => { g.lineWidth = w * f.w; for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); f.pts.forEach((p, k) => { if (k) { const q = f.pts[k - 1]; g.quadraticCurveTo(q[0] + ox, q[1] + oy, (q[0] + p[0]) / 2 + ox, (q[1] + p[1]) / 2 + oy); } else g.moveTo(p[0] + ox, p[1] + oy); }); g.stroke(); } });
    };
    stroke(90, '#a0280a', 60, 0.35); stroke(44, '#e8480e', 40, 0.6); stroke(16, '#ff9a3a', 20, 0.7);
    g.globalAlpha = 1; g.shadowBlur = 0;
    // dark rafts of crust floating on the flows
    speckle(g, S, S, 70, ['#1a0603', '#260a05'], 8, 26, rnd);
    return tex(c);
  });

  // Streaks for the lava waterfalls (tiles vertically, so it can scroll down).
  T.lavaFall = () => once('lavaFall', () => {
    const W = 128, H = 256, c = canvas(W, H), g = c.getContext('2d'), rnd = U.rng(361);
    g.fillStyle = '#c8400c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, w = 2 + rnd() * 8, y = rnd() * H, l = 40 + rnd() * 160;
      g.fillStyle = rnd() < 0.55 ? 'rgba(255,190,80,0.55)' : 'rgba(110,20,4,0.45)';
      g.fillRect(x, y, w, l); g.fillRect(x, y - H, w, l);
    }
    const edge = g.createLinearGradient(0, 0, W, 0);
    edge.addColorStop(0, 'rgba(60,10,2,0.8)'); edge.addColorStop(0.2, 'rgba(60,10,2,0)'); edge.addColorStop(0.8, 'rgba(60,10,2,0)'); edge.addColorStop(1, 'rgba(60,10,2,0.8)');
    g.fillStyle = edge; g.fillRect(0, 0, W, H);
    return tex(c);
  });

  // A soft vertical fade, used for light shafts and the glow over the lava.
  T.fade = () => once('fade', () => {
    const c = canvas(8, 128), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.35, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 8, 128);
    return tex(c, false);
  });

  // A rune circle for the turning wheel.
  T.runes = () => once('runes', () => {
    const S = 1024, c = canvas(S, S), g = c.getContext('2d'), rnd = U.rng(261);
    g.fillStyle = '#211b1e'; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill();
    speckle(g, S, S, 500, ['#2a2226', '#181315', '#2f262a'], 4, 16, rnd);
    // carved spokes between the rings
    g.strokeStyle = '#141011'; g.lineWidth = 8;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * S * 0.2, S / 2 + Math.sin(a) * S * 0.2); g.lineTo(S / 2 + Math.cos(a) * S * 0.36, S / 2 + Math.sin(a) * S * 0.36); g.stroke(); }
    g.strokeStyle = '#ff6a1a'; g.shadowColor = '#ff7a2a'; g.shadowBlur = 22;
    [[0.47, 12], [0.37, 5], [0.19, 7], [0.09, 5]].forEach(([r, w]) => { g.lineWidth = w; g.beginPath(); g.arc(S / 2, S / 2, S * r, 0, 7); g.stroke(); });
    g.font = '700 70px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffb060';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(S / 2 + Math.cos(a) * S * 0.42, S / 2 + Math.sin(a) * S * 0.42); g.rotate(a + Math.PI / 2); g.fillText(glyphs[i], 0, 0); g.restore(); }
    g.font = '700 54px Georgia, serif';
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.26; g.save(); g.translate(S / 2 + Math.cos(a) * S * 0.28, S / 2 + Math.sin(a) * S * 0.28); g.rotate(a + Math.PI / 2); g.fillText(glyphs[(i * 5) % 12], 0, 0); g.restore(); }
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
