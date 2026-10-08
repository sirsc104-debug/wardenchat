// Procedural art. Every building is drawn from code: each level uses a
// different material (mud brick up to obsidian) and adds its own details.
// Static parts are cached as sprites; moving parts are drawn live (see render.js).
(function (G) {
  'use strict';
  const { D, U } = G;
  const { shade, mix, rgba } = U;
  const HW = 32, HH = 16; // half tile size at zoom 1
  const SS = 1.5;         // sprites are cached at 1.5x for crisp zooming

  // ---------------------------------------------------------------- the kit
  // Coordinates: u, v in tiles from the footprint's top corner; z in pixels up.
  function kit(ctx, ox, oy) {
    const P = (u, v, z = 0) => [ox + (u - v) * HW, oy + (u + v) * HH - z];
    const k = { ctx, P };
    k.poly = (pts, fill, stroke, lw) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    };
    k.line = (a, b, color, lw) => {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.stroke();
    };
    // Rectangular block. c = base colour; top is lit, right face shaded.
    k.box = (u, v, w, d, z, h, c, opts = {}) => {
      const top = opts.top || shade(c, 0.18), left = opts.left || c, right = opts.right || shade(c, -0.22);
      const edge = opts.edge === undefined ? shade(c, -0.45) : opts.edge;
      k.poly([P(u, v + d, z), P(u + w, v + d, z), P(u + w, v + d, z + h), P(u, v + d, z + h)], left, edge, 0.6);
      k.poly([P(u + w, v, z), P(u + w, v + d, z), P(u + w, v + d, z + h), P(u + w, v, z + h)], right, edge, 0.6);
      if (!opts.noTop) k.poly([P(u, v, z + h), P(u + w, v, z + h), P(u + w, v + d, z + h), P(u, v + d, z + h)], top, edge, 0.6);
    };
    // Box that narrows towards the top (pylons, mastabas). t = inset per side at the top, in tiles.
    k.taper = (u, v, w, d, z, h, t, c, opts = {}) => {
      const top = opts.top || shade(c, 0.18), left = c, right = shade(c, -0.22), edge = shade(c, -0.45);
      const a = [u + t, v + t], b = [u + w - t, v + d - t];
      k.poly([P(u, v + d, z), P(u + w, v + d, z), P(b[0], b[1], z + h), P(a[0], b[1], z + h)], left, edge, 0.6);
      k.poly([P(u + w, v, z), P(u + w, v + d, z), P(b[0], b[1], z + h), P(b[0], a[1], z + h)], right, edge, 0.6);
      k.poly([P(a[0], a[1], z + h), P(b[0], a[1], z + h), P(b[0], b[1], z + h), P(a[0], b[1], z + h)], top, edge, 0.6);
    };
    k.pyr = (u, v, w, d, z, h, c, opts = {}) => {
      const ap = P(u + w / 2, v + d / 2, z + h), edge = opts.edge || shade(c, -0.4);
      k.poly([P(u, v + d, z), P(u + w, v + d, z), ap], opts.left || c, edge, 0.6);
      k.poly([P(u + w, v, z), P(u + w, v + d, z), ap], opts.right || shade(c, -0.24), edge, 0.6);
    };
    k.ell = (cu, cv, r, z, fill, stroke) => {
      const [x, y] = P(cu, cv, z);
      ctx.beginPath(); ctx.ellipse(x, y, r * HW * 1.414, r * HH * 1.414, 0, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
    };
    k.cyl = (cu, cv, r, z, h, c, opts = {}) => {
      const [x, y0] = P(cu, cv, z), y1 = y0 - h;
      const rx = r * HW * 1.414, ry = r * HH * 1.414;
      const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
      g.addColorStop(0, shade(c, 0.05)); g.addColorStop(0.45, shade(c, 0.18)); g.addColorStop(1, shade(c, -0.3));
      ctx.beginPath();
      ctx.moveTo(x - rx, y1); ctx.lineTo(x - rx, y0);
      ctx.ellipse(x, y0, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + rx, y1);
      ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 0.6; ctx.stroke();
      if (!opts.noTop) {
        ctx.beginPath(); ctx.ellipse(x, y1, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = opts.top || shade(c, 0.22); ctx.fill(); ctx.stroke();
      }
    };
    k.cone = (cu, cv, r, z, h, c) => {
      const [x, y0] = P(cu, cv, z);
      const rx = r * HW * 1.414, ry = r * HH * 1.414;
      const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
      g.addColorStop(0, shade(c, 0.1)); g.addColorStop(0.4, shade(c, 0.22)); g.addColorStop(1, shade(c, -0.3));
      ctx.beginPath(); ctx.moveTo(x - rx, y0); ctx.ellipse(x, y0, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(x, y0 - h); ctx.closePath();
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 0.6; ctx.stroke();
    };
    k.dome = (cu, cv, r, z, c, squash = 1) => {
      const [x, y] = P(cu, cv, z);
      const rx = r * HW * 1.414, ry = r * HH * 1.414;
      const g = ctx.createRadialGradient(x - rx * 0.35, y - rx * 0.6 * squash, 1, x, y, rx * 1.2);
      g.addColorStop(0, shade(c, 0.4)); g.addColorStop(0.5, c); g.addColorStop(1, shade(c, -0.35));
      ctx.beginPath(); ctx.moveTo(x - rx, y);
      ctx.ellipse(x, y, rx, rx * squash, 0, Math.PI, 0);
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 0.6; ctx.stroke();
    };
    k.circle = (x, y, r, fill, stroke, lw) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    };
    // Point on the front-left face (v = v+d) at fraction t along it, height z.
    k.fl = (u, v, w, d, t, z) => P(u + w * t, v + d, z);
    k.fr = (u, v, w, d, t, z) => P(u + w, v + d * t, z);
    // A band of little hieroglyphs along the front faces of a box.
    k.glyphs = (u, v, w, d, z, color, n = 6) => {
      for (let face = 0; face < 2; face++) for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const p = face ? k.fr(u, v, w, d, t, z) : k.fl(u, v, w, d, t, z);
        const kind = (i + face * 3) % 4;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 0.9;
        ctx.beginPath();
        if (kind === 0) { ctx.arc(p[0], p[1] - 3.5, 1.6, 0, Math.PI * 2); ctx.moveTo(p[0], p[1] - 2); ctx.lineTo(p[0], p[1] + 2); ctx.moveTo(p[0] - 2, p[1] - 0.8); ctx.lineTo(p[0] + 2, p[1] - 0.8); }
        else if (kind === 1) { ctx.moveTo(p[0] - 2, p[1] + 2); ctx.lineTo(p[0], p[1] - 3); ctx.lineTo(p[0] + 2, p[1] + 2); }
        else if (kind === 2) { ctx.moveTo(p[0] - 2.5, p[1]); ctx.quadraticCurveTo(p[0], p[1] - 3, p[0] + 2.5, p[1]); ctx.quadraticCurveTo(p[0], p[1] + 3, p[0] - 2.5, p[1]); }
        else { ctx.moveTo(p[0], p[1] - 3); ctx.lineTo(p[0], p[1] + 2); ctx.moveTo(p[0] - 1.6, p[1] - 1); ctx.lineTo(p[0] + 1.6, p[1] - 1); }
        ctx.stroke();
      }
    };
    // Horizontal trim line around the two front faces.
    k.trim = (u, v, w, d, z, color, lw = 1.6) => {
      ctx.beginPath();
      const a = P(u, v + d, z), b = P(u + w, v + d, z), c = P(u + w, v, z);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]);
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    };
    k.gem = (x, y, r, color) => {
      k.poly([[x, y - r], [x + r * 0.7, y], [x, y + r], [x - r * 0.7, y]], color, shade(color, -0.4), 0.6);
      k.poly([[x, y - r], [x + r * 0.7, y], [x, y]], shade(color, 0.45));
    };
    k.door = (u, v, w, d, t, z, h, wd, c) => { // doorway on front-left face
      const a = k.fl(u, v, w, d, t - wd / 2, z), b = k.fl(u, v, w, d, t + wd / 2, z);
      k.poly([a, b, [b[0], b[1] - h], [a[0], a[1] - h]], c || '#2a1a10');
    };
    k.palm = (cu, cv, z, h, scale = 1) => {
      const [x, y] = P(cu, cv, z);
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 2.4 * scale;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3 * scale, y - h / 2, x + 1, y - h); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.55;
        ctx.strokeStyle = i % 2 ? '#3f8f3a' : '#2f7a33'; ctx.lineWidth = 2.2 * scale;
        ctx.beginPath(); ctx.moveTo(x + 1, y - h);
        ctx.quadraticCurveTo(x + 1 + Math.cos(a) * 9 * scale, y - h + Math.sin(a) * 7 * scale - 3, x + 1 + Math.cos(a) * 13 * scale, y - h + Math.sin(a) * 4 * scale + 5);
        ctx.stroke();
      }
    };
    k.banner = (x, y, h, color, lv) => {
      ctx.strokeStyle = '#5a4026'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
      k.poly([[x, y - h], [x + 7, y - h + 2], [x + 7, y - h + 13], [x, y - h + 11]], color, shade(color, -0.4), 0.5);
      if (lv >= 7) k.circle(x + 3.5, y - h + 7, 1.6, '#ffd75a');
    };
    k.shadow = (u, v, w, d) => {
      k.poly([P(u - 0.1, v + 0.1), P(u + w + 0.15, v), P(u + w + 0.25, v + d + 0.25), P(u, v + d + 0.15)], 'rgba(60,35,10,0.18)');
    };
    return k;
  }

  // ------------------------------------------------------------- materials
  function M(level) { return D.MATERIALS[U.clamp(level, 1, 11)]; }
  const GOLD = '#f2c230', GOOP = '#5fdc4a', GOOP_D = '#2f9a2a';

  // Little decorations that build up as a building levels: banners, trims,
  // hieroglyphs, inlaid gems. `top` is the height of the main block.
  function dress(k, s, lv, u, v, w, d, top) {
    const m = M(lv);
    if (lv >= 3) k.trim(u, v, w, d, top - 2, m.trim, lv >= 7 ? 2.2 : 1.4);
    if (lv >= 4) k.glyphs(u, v, w, d, top * 0.5, rgba(shade(m.trim, -0.2), 0.75), Math.max(3, Math.round(w * 2)));
    if (lv >= 8) {
      const a = k.fl(u, v, w, d, 0.5, top * 0.78), b = k.fr(u, v, w, d, 0.5, top * 0.78);
      k.gem(a[0], a[1], 3.2, lv >= 11 ? '#3fe0d0' : lv >= 9 ? '#d23a4a' : '#3a6fe0');
      k.gem(b[0], b[1], 3.2, lv >= 11 ? '#3fe0d0' : lv >= 9 ? '#d23a4a' : '#3a6fe0');
    }
  }
  function bannerColor(lv) { return ['#c84a3a', '#c84a3a', '#2f6fb3', '#2f6fb3', '#2a8a5a', '#7a3ab0', '#d9a520', '#d9a520', '#1f2f7a', '#e0d070', '#3fe0d0'][lv - 1]; }

  function plinth(k, s, lv, h = 6) {
    const m = M(lv);
    k.box(0.05, 0.05, s - 0.1, s - 0.1, 0, h, shade(m.base, -0.12));
    if (lv >= 6) k.trim(0.05, 0.05, s - 0.1, s - 0.1, h - 1, m.trim, 1.2);
  }

  // ------------------------------------------------------------ buildings
  const DRAW = {};

  DRAW.pyramid = (k, lv) => {
    const m = M(lv), s = 4;
    k.box(0, 0, 4, 4, 0, 6, shade(m.base, -0.15));
    if (lv >= 6) k.trim(0, 0, 4, 4, 5, m.trim, 1.5);
    if (lv === 1) { // mastaba
      k.taper(0.4, 0.4, 3.2, 3.2, 6, 34, 0.3, m.base);
      k.door(0.4, 0.4, 3.2, 3.2, 0.5, 6, 14, 0.18);
      return;
    }
    if (lv === 2) { // two-step mastaba
      k.taper(0.3, 0.3, 3.4, 3.4, 6, 28, 0.2, m.base);
      k.taper(0.9, 0.9, 2.2, 2.2, 34, 20, 0.15, shade(m.base, 0.05));
      k.door(0.3, 0.3, 3.4, 3.4, 0.5, 6, 14, 0.15);
      k.banner(k.P(0.6, 3.7, 6)[0], k.P(0.6, 3.7, 6)[1], 40, bannerColor(lv), lv);
      return;
    }
    if (lv <= 4) { // step pyramid, Djoser style
      const steps = lv === 3 ? 4 : 5;
      for (let i = 0; i < steps; i++) {
        const inset = 0.25 + i * (1.5 / steps), h = lv === 3 ? 20 : 19;
        k.taper(inset, inset, 4 - inset * 2, 4 - inset * 2, 6 + i * h, h, 0.08, shade(m.base, i * 0.03));
        if (lv === 4) k.trim(inset, inset, 4 - inset * 2, 4 - inset * 2, 6 + i * h + 2, shade(m.base, -0.2), 0.8);
      }
      k.door(0.25, 0.25, 3.5, 3.5, 0.5, 6, 14, 0.12);
      return;
    }
    if (lv === 5) { // bent pyramid
      k.taper(0.2, 0.2, 3.6, 3.6, 6, 48, 0.65, m.base);
      k.pyr(0.85, 0.85, 2.3, 2.3, 54, 46, shade(m.base, 0.05));
      k.door(0.2, 0.2, 3.6, 3.6, 0.5, 6, 14, 0.12);
      return;
    }
    // smooth pyramids
    const H = 95 + (lv - 6) * 8;
    k.pyr(0.15, 0.15, 3.7, 3.7, 6, H, m.base);
    // courses of stone
    for (let i = 1; i < 9; i++) {
      const t = i / 9, ins = 0.15 + 1.85 * t;
      const a = k.P(ins, 3.85 - (ins - 0.15), 6 + H * t), b = k.P(3.85 - (ins - 0.15), 3.85 - (ins - 0.15), 6 + H * t), c = k.P(3.85 - (ins - 0.15), ins, 6 + H * t);
      k.ctx.beginPath(); k.ctx.moveTo(a[0], a[1]); k.ctx.lineTo(b[0], b[1]); k.ctx.lineTo(c[0], c[1]);
      k.ctx.strokeStyle = rgba(shade(m.base, -0.35), 0.35); k.ctx.lineWidth = 0.6; k.ctx.stroke();
    }
    if (lv === 6) { // blue band
      const t = 0.25, ins = 0.15 + 1.85 * t;
      k.trim(ins, ins, 3.7 - 2 * (ins - 0.15), 3.7 - 2 * (ins - 0.15), 6 + H * t, m.trim, 3);
    }
    if (lv >= 7) { // gold capstone
      const t = 0.78, ins = 0.15 + 1.85 * t;
      k.pyr(ins, ins, 3.85 - ins - (ins - 0.15) + 0.0, 3.85 - ins - (ins - 0.15), 6 + H * t, H * (1 - t), lv >= 11 ? '#3fe0d0' : GOLD);
    }
    if (lv >= 8) { // gilded edges
      const ap = k.P(2, 2, 6 + H);
      k.line(k.P(0.15, 3.85, 6), ap, m.trim, 1.6);
      k.line(k.P(3.85, 3.85, 6), ap, m.trim, 1.6);
      k.line(k.P(3.85, 0.15, 6), ap, m.trim, 1.6);
    }
    if (lv >= 9) k.glyphs(0.6, 0.6, 2.8, 2.8, 30, rgba(m.glow || m.trim, 0.8), 5);
    k.door(0.15, 0.15, 3.7, 3.7, 0.5, 6, 16, 0.1, lv >= 9 ? '#120c08' : '#2a1a10');
    if (lv >= 8) { // corner obelisks
      for (const [cu, cv] of [[0.25, 3.75], [3.75, 3.75], [3.75, 0.25]]) {
        k.box(cu - 0.12, cv - 0.12, 0.24, 0.24, 6, 28, shade(m.base, -0.1));
        k.pyr(cu - 0.12, cv - 0.12, 0.24, 0.24, 34, 7, GOLD);
      }
    }
  };

  DRAW.builderHut = (k, lv) => {
    const m = M(lv);
    k.shadow(0.2, 0.2, 1.6, 1.6);
    k.box(0.3, 0.3, 1.4, 1.4, 0, 22, m.base);
    k.box(0.22, 0.22, 1.56, 1.56, 22, 3, shade(m.base, -0.15));
    k.door(0.3, 0.3, 1.4, 1.4, 0.5, 0, 13, 0.3);
    if (lv >= 2) { // awning
      const a = k.fl(0.3, 0.3, 1.4, 1.4, 0.15, 17), b = k.fl(0.3, 0.3, 1.4, 1.4, 0.85, 17);
      k.poly([a, b, [b[0] - 3, b[1] + 6], [a[0] - 3, a[1] + 6]], lv >= 6 ? '#2f6fb3' : '#c8a060', '#5a4026', 0.5);
    }
    if (lv >= 3) { const p = k.P(1.85, 1.0, 0); k.ctx.fillStyle = '#7a5530'; k.ctx.fillRect(p[0] - 2, p[1] - 9, 5, 9); k.circle(p[0] + 0.5, p[1] - 12, 4, '#3f8f3a'); }
    if (lv >= 4) k.glyphs(0.3, 0.3, 1.4, 1.4, 6, rgba(m.trim, 0.8), 2);
    if (lv >= 5) { const p = k.P(1.75, 0.3, 25); k.line(p, [p[0], p[1] - 14], '#5a4026', 1.2); k.poly([[p[0], p[1] - 14], [p[0] + 8, p[1] - 11], [p[0], p[1] - 8]], bannerColor(lv)); }
    if (lv >= 7) k.trim(0.3, 0.3, 1.4, 1.4, 20, m.trim, 1.6);
    if (lv >= 9) { const p = k.fr(0.3, 0.3, 1.4, 1.4, 0.5, 14); k.gem(p[0], p[1], 2.6, '#d23a4a'); }
    if (lv >= 10) { const p = k.P(1, 1, 25); k.dome(1, 1, 0.35, 25, m.trim, 0.7); }
  };

  DRAW.goldMine = (k, lv, fill) => {
    const m = M(lv);
    k.shadow(0.1, 0.1, 2.8, 2.8);
    // rocky cliff
    const rock = mix('#a0703f', m.base, 0.35);
    k.taper(0.3, 0.2, 2.4, 1.5, 0, 34, 0.25, rock);
    k.taper(1.4, 0.4, 1.3, 1.6, 0, 26, 0.2, shade(rock, -0.06));
    // mine entrance frame
    const fc = lv >= 7 ? GOLD : lv >= 4 ? shade(m.base, -0.1) : '#6b4a2a';
    const a = k.fl(0.3, 0.2, 2.4, 1.5, 0.3, 0), b = k.fl(0.3, 0.2, 2.4, 1.5, 0.62, 0);
    k.poly([a, b, [b[0], b[1] - 20], [a[0], a[1] - 20]], '#1d130b');
    k.line(a, [a[0], a[1] - 21], fc, 2.4); k.line(b, [b[0], b[1] - 21], fc, 2.4);
    k.line([a[0] - 2, a[1] - 21], [b[0] + 2, b[1] - 21], fc, 2.6);
    // rails
    k.line(k.P(1.2, 1.7, 0), k.P(1.2, 2.9, 0), '#5a4026', 1.4);
    k.line(k.P(1.6, 1.7, 0), k.P(1.6, 2.9, 0), '#5a4026', 1.4);
    // gold pile grows with level and with how full the mine is
    const piles = 1 + Math.floor(lv / 3) + (fill > 0.5 ? 1 : 0);
    for (let i = 0; i < piles; i++) {
      const [x, y] = k.P(2.2 + (i % 2) * 0.45, 2.0 + Math.floor(i / 2) * 0.35, 0);
      k.ctx.beginPath(); k.ctx.ellipse(x, y - 2, 7, 5, 0, Math.PI, 0); k.ctx.fillStyle = GOLD; k.ctx.fill();
      k.ctx.strokeStyle = '#a27a10'; k.ctx.lineWidth = 0.6; k.ctx.stroke();
      k.circle(x - 2, y - 5, 1.2, '#fff4b0');
    }
    if (lv >= 5) { k.box(0.35, 2.2, 0.5, 0.5, 0, 10, '#7a5530'); k.box(0.35, 2.2, 0.5, 0.5, 10, 2, GOLD); }
    if (lv >= 8) { const p = k.P(0.9, 0.5, 34); k.gem(p[0], p[1], 4, '#3a6fe0'); }
    if (lv >= 10) { const p = k.P(1.9, 0.6, 30); k.gem(p[0], p[1], 3.5, '#d23a4a'); }
    if (lv >= 3) { const p = k.P(0.3, 2.9, 0); k.banner(p[0], p[1], 26, bannerColor(lv), lv); }
  };

  DRAW.goopWell = (k, lv, fill) => {
    const m = M(lv);
    k.shadow(0.2, 0.2, 2.6, 2.6);
    k.cyl(1.5, 1.5, 1.05, 0, 16, m.base, { noTop: true });
    k.ell(1.5, 1.5, 1.05, 16, shade(m.base, 0.15));
    k.ell(1.5, 1.5, 0.85, 16, GOOP_D);
    k.ell(1.5, 1.5, 0.78, 17, GOOP);
    if (lv >= 3) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, p = k.P(1.5 + Math.cos(a) * 1.05, 1.5 + Math.sin(a) * 1.05, 16);
      k.circle(p[0], p[1], 1.4, m.trim);
    }
    // shaduf frame (the bobbing arm is drawn live)
    const post = lv >= 6 ? shade(m.base, -0.2) : '#7a5530';
    k.box(2.45, 0.35, 0.22, 0.22, 0, 40, post);
    if (lv >= 4) k.glyphs(0.75, 0.75, 1.5, 1.5, 8, rgba(m.trim, 0.8), 3);
    if (lv >= 7) k.trim(0.45, 0.45, 2.1, 2.1, 1, GOLD, 1.2);
    if (lv >= 8) { const p = k.P(1.5, 2.55, 10); k.gem(p[0], p[1], 3, '#3fe0d0'); }
    if (lv >= 2) { // pipes and a little jar
      k.cyl(0.45, 2.4, 0.22, 0, 14, '#b87a46');
      k.ell(0.45, 2.4, 0.15, 14, GOOP);
    }
    if (lv >= 9) k.cyl(2.55, 2.45, 0.2, 0, 12, '#2a2a33', { top: GOOP });
  };

  DRAW.treasury = (k, lv, fill) => {
    const m = M(lv);
    k.shadow(0.1, 0.1, 2.8, 2.8);
    k.box(0.2, 0.2, 2.6, 2.6, 0, 12, shade(m.base, -0.08));
    // open courtyard walls
    k.box(0.35, 0.35, 2.3, 0.25, 12, 18, m.base);
    k.box(0.35, 0.35, 0.25, 2.3, 12, 18, m.base);
    // gold heap inside, size by fill
    const heap = 6 + fill * 22;
    const [x, y] = k.P(1.5, 1.5, 12);
    k.ctx.beginPath(); k.ctx.ellipse(x, y, 30, 15, 0, 0, Math.PI * 2); k.ctx.fillStyle = '#7a5a20'; k.ctx.fill();
    k.ctx.beginPath(); k.ctx.moveTo(x - 28, y); k.ctx.quadraticCurveTo(x, y - heap * 2.2, x + 28, y); k.ctx.ellipse(x, y, 28, 13, 0, 0, Math.PI);
    const g = k.ctx.createLinearGradient(x, y - heap * 1.2, x, y + 10); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.4, GOLD); g.addColorStop(1, '#b8860b');
    k.ctx.fillStyle = g; k.ctx.fill();
    for (let i = 0; i < 6; i++) k.circle(x - 16 + i * 6.5, y - 2 - Math.sin(i) * heap * 0.5, 2, '#fff4b0');
    // front walls (lower so the gold shows)
    k.box(0.35, 2.4, 2.3, 0.25, 12, 8, m.base);
    k.box(2.4, 0.35, 0.25, 2.3, 12, 8, m.base);
    // columns at the corners
    const col = lv >= 7 ? GOLD : shade(m.base, 0.1);
    for (const [cu, cv] of [[0.45, 2.55], [2.55, 2.55], [2.55, 0.45]]) k.cyl(cu, cv, 0.18, 12, 26 + lv, col);
    dress(k, 3, lv, 0.2, 0.2, 2.6, 2.6, 12);
  };

  DRAW.goopJar = (k, lv, fill) => {
    const m = M(lv);
    k.shadow(0.2, 0.2, 2.6, 2.6);
    plinth(k, 3, lv, 5);
    const clay = mix('#c06a3a', m.base, 0.45);
    // amphora body
    k.cyl(1.5, 1.5, 1.0, 5, 30, clay, { noTop: true });
    k.dome(1.5, 1.5, 1.0, 35, clay, 0.55);
    k.cyl(1.5, 1.5, 0.38, 52, 14, shade(clay, -0.05), { top: GOOP });
    k.ell(1.5, 1.5, 0.3, 66, GOOP);
    // glass-like window showing the goop level
    const [x, y] = k.P(1.5, 1.5, 5);
    const lvl = 4 + fill * 26;
    k.ctx.save();
    k.ctx.beginPath(); k.ctx.rect(x - 14, y - 34, 28, 30); k.ctx.clip();
    k.ctx.fillStyle = '#1c3a18'; k.ctx.fillRect(x - 14, y - 34, 28, 30);
    k.ctx.fillStyle = GOOP; k.ctx.fillRect(x - 14, y - 4 - lvl, 28, lvl);
    k.ctx.fillStyle = 'rgba(255,255,255,0.25)'; k.ctx.fillRect(x - 11, y - 32, 4, 26);
    k.ctx.restore();
    k.ctx.strokeStyle = lv >= 7 ? GOLD : shade(clay, -0.4); k.ctx.lineWidth = 1.6; k.ctx.strokeRect(x - 14, y - 34, 28, 30);
    // bands
    const bands = Math.min(3, 1 + Math.floor(lv / 4));
    for (let i = 0; i < bands; i++) { k.ctx.beginPath(); k.ctx.ellipse(x, y - 8 - i * 11, 45.2, 22.6 * 0.5, 0, 0.1, Math.PI - 0.1); k.ctx.strokeStyle = lv >= 6 ? m.trim : shade(clay, -0.3); k.ctx.lineWidth = 1.4; k.ctx.stroke(); }
    if (lv >= 8) k.gem(x + 26, y - 20, 3, lv >= 11 ? '#3fe0d0' : '#3a6fe0');
  };

  DRAW.barracks = (k, lv) => {
    const m = M(lv);
    k.shadow(0.1, 0.1, 2.8, 2.8);
    k.box(0.15, 0.15, 2.7, 2.7, 0, 4, shade(m.base, -0.15));
    // two pylon towers and a gate between
    k.taper(0.3, 1.9, 1.0, 0.8, 4, 40 + lv * 1.5, 0.12, m.base);
    k.taper(1.9, 0.3, 0.8, 1.0, 4, 40 + lv * 1.5, 0.12, m.base);
    k.box(0.4, 0.4, 1.6, 1.6, 4, 26, shade(m.base, -0.06));
    k.door(0.4, 0.4, 1.6, 1.6, 0.6, 4, 16, 0.3);
    k.taper(0.3, 1.9, 1.0, 0.8, 4, 40 + lv * 1.5, 0.12, m.base);
    if (lv >= 3) k.trim(0.3, 1.9, 1.0, 0.8, 36 + lv * 1.5, m.trim, 1.6);
    if (lv >= 4) k.glyphs(0.3, 1.9, 1.0, 0.8, 20, rgba(m.trim, 0.8), 2);
    // spear rack
    const p = k.P(2.3, 2.5, 4);
    for (let i = 0; i < 3 + Math.min(4, Math.floor(lv / 2)); i++) k.line([p[0] + i * 3, p[1] - i * 1.5], [p[0] + i * 3 - 2, p[1] - i * 1.5 - 20], '#6b4a2a', 1.2);
    k.line([p[0] - 3, p[1] - 8], [p[0] + 18, p[1] - 17], '#5a4026', 1.4);
    if (lv >= 6) { const b = k.P(0.8, 2.7, 44 + lv * 1.5); k.banner(b[0], b[1] + 12, 22, bannerColor(lv), lv); }
    if (lv >= 8) { const g = k.fl(0.3, 1.9, 1.0, 0.8, 0.5, 30); k.gem(g[0], g[1], 3, '#d23a4a'); }
  };

  DRAW.armyCamp = (k, lv) => {
    const m = M(lv);
    // packed sand ring
    k.ell(2, 2, 1.85, 0, 'rgba(150,105,55,0.35)');
    k.ell(2, 2, 1.55, 0, 'rgba(220,180,120,0.45)');
    // stone posts around the ring
    const posts = 8;
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2;
      const cu = 2 + Math.cos(a) * 1.75, cv = 2 + Math.sin(a) * 1.75;
      if (Math.sin(a) > 0.2 && Math.cos(a) > -0.2) continue; // leave the front open
      k.box(cu - 0.1, cv - 0.1, 0.2, 0.2, 0, 12 + Math.min(lv, 8), shade(m.base, -0.05));
      if (lv >= 7) k.box(cu - 0.12, cv - 0.12, 0.24, 0.24, 12 + Math.min(lv, 8), 2, GOLD);
    }
    // tents
    const tentC = lv >= 8 ? '#2f55a8' : lv >= 5 ? '#e8dcc0' : '#c8a070';
    k.pyr(0.3, 0.3, 1.0, 1.0, 0, 26, tentC);
    if (lv >= 3) k.pyr(2.7, 0.3, 1.0, 1.0, 0, 26, tentC);
    if (lv >= 6) k.pyr(0.3, 2.7, 1.0, 1.0, 0, 26, tentC);
    // fire pit stones (flames drawn live)
    k.ell(2, 2, 0.32, 0, '#5a4a3a');
    k.ell(2, 2, 0.22, 0, '#2a1a10');
    if (lv >= 4) { const p = k.P(0.4, 3.6, 0); k.banner(p[0], p[1], 30, bannerColor(lv), lv); }
  };

  DRAW.temple = (k, lv) => {
    const m = M(lv);
    k.shadow(0.1, 0.1, 2.8, 2.8);
    k.box(0.1, 0.1, 2.8, 2.8, 0, 8, shade(m.base, -0.12));
    k.box(0.35, 0.35, 2.3, 2.3, 8, 4, shade(m.base, -0.05));
    k.box(0.5, 0.5, 1.6, 1.6, 12, 24, shade(m.base, -0.2)); // inner sanctum
    const col = lv >= 7 ? mix(m.base, GOLD, 0.5) : m.base;
    const n = 3 + (lv >= 5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = 0.45 + (i / (n - 1)) * 2.1;
      k.cyl(t, 2.55, 0.16, 12, 30, col);
      k.cyl(2.55, t, 0.16, 12, 30, col);
    }
    k.box(0.3, 0.3, 2.4, 2.4, 42, 6, m.base, { top: lv >= 6 ? m.trim : undefined });
    dress(k, 3, lv, 0.3, 0.3, 2.4, 2.4, 48);
    // sun disk with uraeus on top
    const [x, y] = k.P(1.5, 1.5, 58);
    k.circle(x, y, 9 + lv * 0.4, lv >= 11 ? '#3fe0d0' : '#ff8a2a', '#b84a10', 1);
    if (lv >= 5) { k.ctx.beginPath(); k.ctx.moveTo(x - 13, y + 4); k.ctx.quadraticCurveTo(x - 20, y - 8, x - 10, y - 10); k.ctx.moveTo(x + 13, y + 4); k.ctx.quadraticCurveTo(x + 20, y - 8, x + 10, y - 10); k.ctx.strokeStyle = GOLD; k.ctx.lineWidth = 2; k.ctx.stroke(); }
  };

  DRAW.royalHall = (k, lv) => {
    const m = M(lv);
    k.shadow(0.1, 0.1, 2.8, 2.8);
    k.box(0.1, 0.1, 2.8, 2.8, 0, 6, shade(m.base, -0.12));
    k.box(0.3, 0.3, 2.4, 2.4, 6, 30, m.base);
    k.box(0.25, 0.25, 2.5, 2.5, 36, 5, shade(m.base, -0.1), { top: shade(m.base, 0.05) });
    k.door(0.3, 0.3, 2.4, 2.4, 0.5, 6, 20, 0.22);
    dress(k, 3, lv, 0.3, 0.3, 2.4, 2.4, 36);
    // statues of guards either side of the door
    for (const t of [0.22, 0.78]) {
      const p = k.fl(0.3, 0.3, 2.4, 2.4, t, 6);
      k.ctx.fillStyle = lv >= 8 ? GOLD : shade(m.base, -0.2);
      k.ctx.fillRect(p[0] - 2.5, p[1] - 22, 5, 16);
      k.circle(p[0], p[1] - 25, 3, k.ctx.fillStyle);
    }
    // roof flags
    const f = k.P(1.5, 1.5, 41);
    k.banner(f[0] - 16, f[1] + 6, 26, bannerColor(lv), lv);
    if (lv >= 4) k.banner(f[0] + 14, f[1] + 6, 26, bannerColor(lv), lv);
  };

  // Defense bases (the turning parts are drawn live).
  function platform(k, s, lv, h) {
    const m = M(lv);
    k.shadow(0.1, 0.1, s - 0.2, s - 0.2);
    k.box(0.2, 0.2, s - 0.4, s - 0.4, 0, h, m.base);
    dress(k, s, lv, 0.2, 0.2, s - 0.4, s - 0.4, h);
    if (lv >= 5) { // corner posts
      for (const [cu, cv] of [[0.3, s - 0.3], [s - 0.3, s - 0.3], [s - 0.3, 0.3]]) {
        k.box(cu - 0.1, cv - 0.1, 0.2, 0.2, h, 6, shade(m.base, -0.1));
        if (lv >= 7) k.box(cu - 0.1, cv - 0.1, 0.2, 0.2, h + 6, 2, GOLD);
      }
    }
  }
  DRAW.ballista = (k, lv) => { platform(k, 3, lv, 14); };
  DRAW.catapult = (k, lv) => {
    platform(k, 3, lv, 10);
    const m = M(lv);
    // boulder pile
    for (let i = 0; i < 3; i++) { const p = k.P(0.55 + i * 0.25, 2.45, 10); k.circle(p[0], p[1] - 3, 3.4, '#8a7a6a', '#4a3a2a', 0.6); }
  };
  DRAW.archerTower = (k, lv) => {
    const m = M(lv);
    k.shadow(0.2, 0.2, 2.6, 2.6);
    k.taper(0.45, 0.45, 2.1, 2.1, 0, 58 + lv * 2, 0.18, m.base);
    const top = 58 + lv * 2;
    k.box(0.4, 0.4, 2.2, 2.2, top, 6, shade(m.base, -0.08));
    // crenellations
    for (let i = 0; i < 4; i++) {
      k.box(0.4 + i * 0.6, 2.4, 0.3, 0.2, top + 6, 6, shade(m.base, 0.04));
      k.box(2.4, 0.4 + i * 0.6, 0.2, 0.3, top + 6, 6, shade(m.base, 0.04));
    }
    k.door(0.45, 0.45, 2.1, 2.1, 0.5, 0, 14, 0.2);
    dress(k, 3, lv, 0.6, 0.6, 1.8, 1.8, top - 6);
    if (lv >= 6) { const p = k.P(2.5, 2.5, top + 12); k.banner(p[0], p[1], 18, bannerColor(lv), lv); }
  };
  DRAW.falconPerch = (k, lv) => {
    const m = M(lv);
    platform(k, 3, lv, 10);
    k.box(1.35, 1.35, 0.3, 0.3, 10, 44, lv >= 7 ? GOLD : shade(m.base, -0.25));
    k.box(1.0, 1.4, 1.0, 0.2, 54, 3, '#6b4a2a');
    if (lv >= 4) for (let i = 0; i < 3; i++) { const p = k.P(0.5 + i * 0.3, 0.5, 10); k.circle(p[0], p[1] - 2, 2, '#e8dcc0'); }
  };
  DRAW.brazier = (k, lv) => {
    const m = M(lv);
    k.shadow(0.2, 0.2, 1.6, 1.6);
    k.box(0.3, 0.3, 1.4, 1.4, 0, 8, shade(m.base, -0.1));
    k.cyl(1, 1, 0.22, 8, 20, lv >= 7 ? GOLD : shade(m.base, -0.25));
    k.cyl(1, 1, 0.6, 28, 8, lv >= 6 ? m.trim : '#7a5530', { top: '#2a1a10' });
    if (lv >= 4) k.glyphs(0.3, 0.3, 1.4, 1.4, 4, rgba(m.trim, 0.8), 2);
  };
  DRAW.eyeHorus = (k, lv) => {
    const m = M(lv);
    platform(k, 3, lv, 8);
    k.taper(0.9, 0.9, 1.2, 1.2, 8, 46, 0.12, shade(m.base, -0.05));
    // eye emblem on the front-left face
    const [x, y] = k.fl(0.95, 0.95, 1.1, 1.1, 0.5, 40);
    k.ctx.beginPath(); k.ctx.moveTo(x - 9, y); k.ctx.quadraticCurveTo(x, y - 8, x + 9, y); k.ctx.quadraticCurveTo(x, y + 6, x - 9, y);
    k.ctx.fillStyle = '#f8f0dc'; k.ctx.fill(); k.ctx.strokeStyle = '#1a1a2a'; k.ctx.lineWidth = 1.4; k.ctx.stroke();
    k.ctx.beginPath(); k.ctx.moveTo(x - 2, y + 4); k.ctx.lineTo(x - 4, y + 11); k.ctx.moveTo(x + 2, y + 4); k.ctx.quadraticCurveTo(x + 7, y + 8, x + 5, y + 12); k.ctx.stroke();
  };
  DRAW.obelisk = (k, lv) => {
    const m = M(lv);
    k.shadow(0.2, 0.2, 1.6, 1.6);
    k.box(0.25, 0.25, 1.5, 1.5, 0, 8, shade(m.base, -0.12));
    const H = 92 + lv * 4;
    k.taper(0.65, 0.65, 0.7, 0.7, 8, H, 0.1, m.base);
    k.pyr(0.75, 0.75, 0.5, 0.5, 8 + H, 14, lv >= 11 ? '#3fe0d0' : GOLD);
    const n = 5 + Math.floor(lv / 2);
    for (let i = 0; i < n; i++) {
      const p = k.fl(0.68, 0.68, 0.64, 0.64, 0.5, 16 + i * (H - 20) / n);
      k.circle(p[0], p[1], 1.2, rgba(lv >= 9 && m.glow ? m.glow : shade(m.base, -0.45), 0.85));
    }
  };
  DRAW.anubis = (k, lv) => {
    const m = M(lv);
    const body = lv >= 9 ? '#1d1a24' : lv >= 5 ? '#2a2630' : mix('#3a3438', m.base, 0.4);
    const gold = lv >= 3 ? GOLD : shade(m.base, -0.2);
    k.shadow(0.2, 0.2, 1.6, 1.6);
    k.box(0.2, 0.2, 1.6, 1.6, 0, 10, shade(m.base, -0.1));
    if (lv >= 4) k.glyphs(0.2, 0.2, 1.6, 1.6, 5, rgba(m.trim, 0.8), 2);
    // lying jackal: body, front legs, neck and head
    k.box(0.45, 0.35, 0.7, 1.3, 10, 14, body);
    k.box(1.15, 0.45, 0.55, 0.22, 10, 6, body);
    k.box(1.15, 1.25, 0.55, 0.22, 10, 6, body);
    k.box(0.75, 0.6, 0.4, 0.6, 24, 16, body);
    k.box(1.05, 0.72, 0.38, 0.36, 34, 7, body);
    // ears
    const e1 = k.P(0.85, 0.65, 40), e2 = k.P(0.85, 1.1, 40);
    k.poly([e1, [e1[0] + 2, e1[1] - 11], [e1[0] + 5, e1[1] - 1]], body);
    k.poly([e2, [e2[0] + 2, e2[1] - 11], [e2[0] + 5, e2[1] - 1]], body);
    // collar
    k.trim(0.75, 0.6, 0.4, 0.6, 26, gold, 2.2);
    if (lv >= 7) k.trim(0.45, 0.35, 0.7, 1.3, 12, gold, 1.6);
  };
  DRAW.sphinx = (k, lv) => {
    const m = M(lv);
    const stone = lv >= 9 ? m.base : mix('#d9b26f', m.base, 0.5);
    k.shadow(0.1, 0.1, 2.8, 2.8);
    k.box(0.15, 0.15, 2.7, 2.7, 0, 10, shade(m.base, -0.12));
    dress(k, 3, lv, 0.15, 0.15, 2.7, 2.7, 10);
    k.box(0.4, 0.8, 1.7, 1.3, 10, 18, stone);          // body
    k.box(2.1, 0.9, 0.7, 0.35, 10, 6, stone);          // paws
    k.box(2.1, 1.6, 0.7, 0.35, 10, 6, stone);
    k.box(1.5, 0.95, 0.65, 0.95, 28, 22, stone);       // chest/head block
    // nemes headdress stripes
    const sc = lv >= 6 ? m.trim : '#2f55a8';
    for (let i = 0; i < 4; i++) { const a = k.fr(1.5, 0.95, 0.65, 0.95, 0.15 + i * 0.22, 46), b = k.fr(1.5, 0.95, 0.65, 0.95, 0.15 + i * 0.22, 30); k.line(a, b, sc, 1.6); }
    k.box(1.6, 1.15, 0.5, 0.55, 50, 6, sc);
    if (lv >= 7) { const p = k.P(2.15, 1.42, 52); k.circle(p[0], p[1], 2.5, GOLD); }
  };
  DRAW.sunDisk = (k, lv) => {
    const m = M(lv);
    k.shadow(0.2, 0.2, 2.6, 2.6);
    k.taper(0.3, 0.3, 2.4, 2.4, 0, 36, 0.3, m.base);
    k.taper(0.75, 0.75, 1.5, 1.5, 36, 50, 0.22, shade(m.base, 0.05));
    dress(k, 3, lv, 0.3, 0.3, 2.4, 2.4, 30);
    k.box(1.2, 1.2, 0.6, 0.6, 86, 8, GOLD);
  };

  DRAW.wall = (k, lv, conn) => {
    const m = M(lv);
    const h = 16 + Math.min(lv, 8);
    const c = m.base;
    // central post plus arms towards connected neighbours (+u, +v)
    if (conn & 1) k.box(0.5, 0.28, 0.6, 0.44, 0, h - 3, c);
    if (conn & 2) k.box(0.28, 0.5, 0.44, 0.6, 0, h - 3, c);
    k.box(0.22, 0.22, 0.56, 0.56, 0, h, shade(c, 0.04));
    if (lv >= 3) k.box(0.18, 0.18, 0.64, 0.64, h, 3, shade(c, -0.1));
    if (lv >= 7) k.box(0.3, 0.3, 0.4, 0.4, h + 3, 4, m.trim);
    if (lv >= 9) { const p = k.P(0.5, 0.5, h + 9); k.gem(p[0], p[1], 2.4, lv >= 11 ? '#3fe0d0' : '#d23a4a'); }
    if (lv >= 5 && lv < 7) k.trim(0.22, 0.22, 0.56, 0.56, h * 0.55, m.trim, 1);
  };

  // Traps are only seen in your own town. Their stone rim shows the level.
  function trapRim(k, lv) {
    const m = M(lv), [x, y] = k.P(0.5, 0.5, 0);
    k.ctx.beginPath(); k.ctx.ellipse(x, y, 24, 12, 0, 0, Math.PI * 2);
    k.ctx.strokeStyle = rgba(m.base, 0.9); k.ctx.lineWidth = 3; k.ctx.stroke();
    if (lv >= 6) { k.ctx.strokeStyle = rgba(m.trim, 0.9); k.ctx.lineWidth = 1; k.ctx.stroke(); }
    if (lv >= 9) for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) k.gem(x + Math.cos(a) * 24, y + Math.sin(a) * 12, 2.2, m.glow || '#d23a4a');
  }
  DRAW.scarabTrap = (k, lv) => {
    trapRim(k, lv);
    const [x, y] = k.P(0.5, 0.5, 0);
    k.ctx.fillStyle = 'rgba(80,50,20,0.35)'; k.ctx.beginPath(); k.ctx.ellipse(x, y, 18, 9, 0, 0, Math.PI * 2); k.ctx.fill();
    k.ctx.fillStyle = lv >= 6 ? '#2a8a7a' : '#2a3a2a';
    k.ctx.beginPath(); k.ctx.ellipse(x, y - 3, 7, 5, 0, 0, Math.PI * 2); k.ctx.fill();
    k.ctx.strokeStyle = '#111'; k.ctx.lineWidth = 0.8; k.ctx.beginPath(); k.ctx.moveTo(x, y - 8); k.ctx.lineTo(x, y + 2); k.ctx.stroke();
    k.circle(x, y - 9, 2.4, lv >= 9 ? GOLD : '#2a3a2a');
  };
  DRAW.quicksand = (k, lv) => {
    trapRim(k, lv);
    const [x, y] = k.P(0.5, 0.5, 0);
    for (let i = 3; i > 0; i--) { k.ctx.beginPath(); k.ctx.ellipse(x, y, i * 6, i * 3, 0, 0, Math.PI * 2); k.ctx.strokeStyle = rgba('#8a6a3a', 0.25 + 0.15 * i); k.ctx.lineWidth = 1.4; k.ctx.stroke(); }
  };
  DRAW.falconNet = (k, lv) => {
    trapRim(k, lv);
    const [x, y] = k.P(0.5, 0.5, 0);
    k.ctx.strokeStyle = '#7a5530'; k.ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { k.ctx.beginPath(); k.ctx.moveTo(x - 14, y + i * 3); k.ctx.lineTo(x + 14, y + i * 3); k.ctx.moveTo(x + i * 6, y - 7); k.ctx.lineTo(x + i * 6, y + 7); k.ctx.stroke(); }
    k.line([x + 14, y], [x + 14, y - 18], '#5a4026', 1.6);
  };
  DRAW.cobraPit = (k, lv) => {
    trapRim(k, lv);
    const [x, y] = k.P(0.5, 0.5, 0);
    k.ctx.fillStyle = '#3a2a1a'; k.ctx.beginPath(); k.ctx.ellipse(x, y, 14, 7, 0, 0, Math.PI * 2); k.ctx.fill();
    k.ctx.strokeStyle = lv >= 6 ? '#c9a020' : '#5a7a2a'; k.ctx.lineWidth = 2.4;
    k.ctx.beginPath(); k.ctx.moveTo(x - 6, y); k.ctx.quadraticCurveTo(x, y - 6, x + 6, y); k.ctx.stroke();
  };

  // Obstacles: palms, rocks, ruins and dry bushes.
  const OB = {
    palm: (k, s) => { k.shadow(0.1, 0.1, s - 0.2, s - 0.2); k.palm(s * 0.45, s * 0.55, 0, 40 * s * 0.7 + 10, 1.1); if (s > 1) k.palm(s * 0.75, s * 0.3, 0, 30, 0.9); },
    rock: (k, s) => { k.taper(0.15, 0.2, s - 0.3, s - 0.35, 0, 10 + s * 7, 0.15 * s, '#9a8a78'); k.taper(0.5 * s, 0.1, 0.45 * s, 0.5 * s, 0, 8 + s * 4, 0.1, '#857565'); },
    ruin: (k, s) => { k.box(0.1, 0.1, s - 0.2, 0.3, 0, 14, '#cdb48a'); k.cyl(s - 0.45, s - 0.5, 0.2, 0, 26, '#d8c39a'); k.box(0.2, s - 0.6, 0.6, 0.4, 0, 6, '#b8a07a'); },
    bush: (k, s) => { for (let i = 0; i < 3; i++) { const p = k.P(0.3 + i * 0.22 * s, 0.6 + (i % 2) * 0.2, 0); k.circle(p[0], p[1] - 5, 6, i % 2 ? '#8a9a4a' : '#6f7f3a'); } },
  };

  // ------------------------------------------------------------ the cache
  const HEIGHT = { pyramid: 230, obelisk: 170, archerTower: 120, sunDisk: 120, falconPerch: 90, temple: 110, barracks: 90, royalHall: 90, goopJar: 100 };
  const cache = new Map();
  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  // Returns { img, ax, ay, w, h, s }: draw img so (ax, ay) lands on the footprint's top corner.
  function sprite(type, level, extra = 0, obstacleSize = 0) {
    const key = type + '|' + level + '|' + extra;
    let sp = cache.get(key);
    if (sp) { cache.delete(key); cache.set(key, sp); return sp; }
    const s = obstacleSize || D.B[type].size;
    const H = HEIGHT[type] || 80;
    const w = s * 64 + 40, h = s * 32 + H + 20;
    const cv = makeCanvas(Math.ceil(w * SS), Math.ceil(h * SS));
    const ctx = cv.getContext('2d');
    ctx.scale(SS, SS);
    ctx.lineJoin = 'round';
    const ax = w / 2, ay = H;
    const k = kit(ctx, ax, ay);
    if (obstacleSize) OB[type](k, s);
    else DRAW[type](k, level, extra);
    sp = { img: cv, ax, ay, w, h, s };
    cache.set(key, sp);
    if (cache.size > 220) cache.delete(cache.keys().next().value);
    return sp;
  }

  G.Sprites = { sprite, kit, M, GOLD, GOOP, GOOP_D, bannerColor, HW, HH, OB };
})(globalThis.SOTP = globalThis.SOTP || {});
