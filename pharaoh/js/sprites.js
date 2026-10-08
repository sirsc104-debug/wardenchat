// Procedural art. Every building is drawn from code: each level uses a
// different material (mud brick up to obsidian) and adds its own details.
// Static parts are cached as sprites; moving parts are drawn live (see render.js).
(function (G) {
  'use strict';
  const { D, U } = G;
  const { shade, mix, rgba } = U;
  const HW = 32, HH = 16; // half tile size at zoom 1
  const SS = 2;           // sprites are cached at 2x for crisp zooming

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
    // ------------------------------------------------------------ faces
    // A lit, textured quad. a/b = bottom-left/right, c/d = top-right/left
    // (screen points). light: 1 = sunlit face, 0 = shaded face.
    // The texture (brick courses, stone blocks or polished stone) comes from
    // k.tex, which the sprite sets from the building's level.
    const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const bil = (a, b, c, d, s, t) => lerp2(lerp2(a, b, s), lerp2(d, c, s), t);
    const len = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
    k.tex = 'block';
    k.rng = U.makeRng(7);
    k.face = (a, b, c, d, col, opts = {}) => {
      const tex = opts.tex || k.tex;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
      const yb = Math.max(a[1], b[1]), yt = Math.min(c[1], d[1]);
      const g = ctx.createLinearGradient(0, yb, 0, yt);
      g.addColorStop(0, shade(col, -0.2)); g.addColorStop(0.22, col); g.addColorStop(1, shade(col, 0.1));
      ctx.fillStyle = g; ctx.fill();
      ctx.clip();
      const H = Math.max(len(a, d), len(b, c));
      if (tex === 'brick' || tex === 'block') {
        const course = tex === 'brick' ? 4.6 : 8.5, blen = tex === 'brick' ? 9 : 17;
        const rows = Math.max(1, Math.round(H / course));
        const dark = rgba(shade(col, -0.55), tex === 'brick' ? 0.32 : 0.28), lite = rgba(shade(col, 0.5), 0.35);
        for (let r = 0; r < rows; r++) {
          const t0 = r / rows, t1 = (r + 1) / rows;
          const W = len(bil(a, b, c, d, 0, t0), bil(a, b, c, d, 1, t0));
          const cols = Math.max(1, Math.round(W / blen));
          const off = (r % 2) * 0.5;
          // tint a few stones lighter or darker
          for (let i = -1; i < cols; i++) {
            const s0 = Math.max(0, (i + off) / cols), s1 = Math.min(1, (i + 1 + off) / cols);
            if (s1 <= s0) continue;
            const v = k.rng();
            if (v < 0.35) {
              ctx.beginPath();
              const p = [bil(a, b, c, d, s0, t0), bil(a, b, c, d, s1, t0), bil(a, b, c, d, s1, t1), bil(a, b, c, d, s0, t1)];
              ctx.moveTo(...p[0]); ctx.lineTo(...p[1]); ctx.lineTo(...p[2]); ctx.lineTo(...p[3]); ctx.closePath();
              ctx.fillStyle = v < 0.17 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.09)'; ctx.fill();
            }
            if (i >= 0) {
              const p0 = bil(a, b, c, d, (i + 1 + off) / cols, t0), p1 = bil(a, b, c, d, (i + 1 + off) / cols, t1);
              ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.strokeStyle = dark; ctx.lineWidth = 0.7; ctx.stroke();
            }
          }
          const q0 = bil(a, b, c, d, 0, t1), q1 = bil(a, b, c, d, 1, t1);
          ctx.beginPath(); ctx.moveTo(...q0); ctx.lineTo(...q1); ctx.strokeStyle = dark; ctx.lineWidth = 0.8; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(q0[0], q0[1] + 0.9); ctx.lineTo(q1[0], q1[1] + 0.9); ctx.strokeStyle = lite; ctx.lineWidth = 0.5; ctx.stroke();
        }
      } else if (tex === 'smooth') {
        // polished stone: a soft reflection streak
        const s = opts.light ? 0.22 : 0.62;
        const p0 = bil(a, b, c, d, s, 0), p1 = bil(a, b, c, d, s + 0.16, 0);
        const sg = ctx.createLinearGradient(p0[0], 0, p1[0], 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${opts.light ? 0.28 : 0.14})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(Math.min(p0[0], p1[0]) - 2, yt - 4, Math.abs(p1[0] - p0[0]) + 4, yb - yt + 8);
      }
      // ambient occlusion where the face meets the ground or the block below
      if (!opts.noAO) {
        const ao = ctx.createLinearGradient(0, yb, 0, yb - 9);
        ao.addColorStop(0, 'rgba(30,15,0,0.28)'); ao.addColorStop(1, 'rgba(30,15,0,0)');
        ctx.fillStyle = ao; ctx.fillRect(Math.min(a[0], b[0], c[0], d[0]) - 1, yb - 10, Math.abs(b[0] - a[0]) + Math.abs(c[0] - d[0]) + 20, 12);
      }
      ctx.restore();
      // crisp edges: dark seams, light along the top edge
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
      ctx.strokeStyle = rgba(shade(col, -0.6), 0.55); ctx.lineWidth = 0.7; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...d); ctx.lineTo(...c);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.9; ctx.stroke();
    };
    k.topFace = (pts, col) => {
      ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath();
      const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
      const g = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      g.addColorStop(0, shade(col, 0.18)); g.addColorStop(1, shade(col, -0.04));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = rgba(shade(col, -0.55), 0.5); ctx.lineWidth = 0.7; ctx.stroke();
      // bright back edges catch the sun
      ctx.beginPath(); ctx.moveTo(...pts[3]); ctx.lineTo(...pts[0]); ctx.lineTo(...pts[1]);
      ctx.strokeStyle = 'rgba(255,255,240,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    };
    // Rectangular block. c = base colour; the left face is sunlit, the right shaded.
    k.box = (u, v, w, d, z, h, c, opts = {}) => {
      const left = opts.left || shade(c, 0.04), right = opts.right || shade(c, -0.24);
      k.face(P(u, v + d, z), P(u + w, v + d, z), P(u + w, v + d, z + h), P(u, v + d, z + h), left, { ...opts, light: 1 });
      k.face(P(u + w, v + d, z), P(u + w, v, z), P(u + w, v, z + h), P(u + w, v + d, z + h), right, { ...opts, light: 0 });
      if (!opts.noTop) k.topFace([P(u, v, z + h), P(u + w, v, z + h), P(u + w, v + d, z + h), P(u, v + d, z + h)], opts.top || shade(c, 0.2));
    };
    // Box that narrows towards the top (pylons, mastabas). t = inset per side at the top, in tiles.
    k.taper = (u, v, w, d, z, h, t, c, opts = {}) => {
      const a = [u + t, v + t], b = [u + w - t, v + d - t];
      k.face(P(u, v + d, z), P(u + w, v + d, z), P(b[0], b[1], z + h), P(a[0], b[1], z + h), shade(c, 0.04), { ...opts, light: 1 });
      k.face(P(u + w, v + d, z), P(u + w, v, z), P(b[0], a[1], z + h), P(b[0], b[1], z + h), shade(c, -0.24), { ...opts, light: 0 });
      k.topFace([P(a[0], a[1], z + h), P(b[0], a[1], z + h), P(b[0], b[1], z + h), P(a[0], b[1], z + h)], opts.top || shade(c, 0.2));
    };
    k.pyr = (u, v, w, d, z, h, c, opts = {}) => {
      const ap = P(u + w / 2, v + d / 2, z + h);
      k.face(P(u, v + d, z), P(u + w, v + d, z), ap, ap, opts.left || shade(c, 0.04), { ...opts, light: 1 });
      k.face(P(u + w, v + d, z), P(u + w, v, z), ap, ap, opts.right || shade(c, -0.24), { ...opts, light: 0 });
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
      g.addColorStop(0, shade(c, 0.02)); g.addColorStop(0.32, shade(c, 0.26)); g.addColorStop(0.55, c); g.addColorStop(1, shade(c, -0.38));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x - rx, y1); ctx.lineTo(x - rx, y0);
      ctx.ellipse(x, y0, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + rx, y1);
      ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.clip();
      const tex = opts.tex || k.tex;
      if ((tex === 'brick' || tex === 'block') && h > 10 && rx > 6) {
        const course = tex === 'brick' ? 5 : 9;
        ctx.strokeStyle = rgba(shade(c, -0.55), 0.25); ctx.lineWidth = 0.7;
        for (let yy = y0 - course; yy > y1 + 2; yy -= course) { ctx.beginPath(); ctx.ellipse(x, yy, rx, ry, 0, 0.05, Math.PI - 0.05); ctx.stroke(); }
      }
      const ao = ctx.createLinearGradient(0, y0 + ry, 0, y0 + ry - 9);
      ao.addColorStop(0, 'rgba(30,15,0,0.3)'); ao.addColorStop(1, 'rgba(30,15,0,0)');
      ctx.fillStyle = ao; ctx.fillRect(x - rx - 1, y0 - 10, rx * 2 + 2, ry + 12);
      ctx.restore();
      ctx.strokeStyle = rgba(shade(c, -0.6), 0.6); ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x - rx, y1); ctx.lineTo(x - rx, y0); ctx.ellipse(x, y0, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(x + rx, y1); ctx.stroke();
      if (!opts.noTop) {
        ctx.beginPath(); ctx.ellipse(x, y1, rx, ry, 0, 0, Math.PI * 2);
        const tg = ctx.createLinearGradient(x - rx, y1 - ry, x + rx, y1 + ry);
        const tc = opts.top || shade(c, 0.22);
        tg.addColorStop(0, shade(tc, 0.15)); tg.addColorStop(1, shade(tc, -0.08));
        ctx.fillStyle = tg; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, y1, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
        ctx.strokeStyle = 'rgba(255,255,240,0.5)'; ctx.lineWidth = 1; ctx.stroke();
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
      // ringed trunk
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 3.4 * scale;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4 * scale, y - h / 2, x + 1, y - h); ctx.stroke();
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1;
      for (let i = 1; i < 7; i++) { const t = i / 7, px = x + 4 * scale * 2 * t * (1 - t) + t, py = y - h * t; ctx.beginPath(); ctx.moveTo(px - 1.6 * scale, py); ctx.lineTo(px + 1.6 * scale, py + 1); ctx.stroke(); }
      // fronds
      const tx = x + 1, ty = y - h;
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i - 3.5) * 0.48, L = (14 + (i % 2) * 3) * scale;
        const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + 7 * scale;
        const mx = tx + Math.cos(a) * L * 0.55, my = ty + Math.sin(a) * L * 0.6 - 4 * scale;
        ctx.fillStyle = i % 2 ? '#3f9a3a' : '#2f8233';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my - 3 * scale, ex, ey); ctx.quadraticCurveTo(mx, my + 2 * scale, tx, ty + 2 * scale); ctx.fill();
        ctx.strokeStyle = 'rgba(200,240,140,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my - 1 * scale, ex, ey); ctx.stroke();
      }
      ctx.fillStyle = '#8a5a20'; for (const [dx, dy] of [[-2, 2], [2, 2.5], [0, 4]]) { ctx.beginPath(); ctx.arc(tx + dx * scale, ty + dy * scale, 1.8 * scale, 0, 7); ctx.fill(); }
    };
    k.banner = (x, y, h, color, lv) => {
      ctx.strokeStyle = '#5a4026'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
      k.poly([[x, y - h], [x + 7, y - h + 2], [x + 7, y - h + 13], [x, y - h + 11]], color, shade(color, -0.4), 0.5);
      if (lv >= 7) k.circle(x + 3.5, y - h + 7, 1.6, '#ffd75a');
    };
    k.shadow = () => {}; // cast shadows are drawn separately (see sprite())
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
    // packed-earth yard
    k.ell(1, 1, 0.92, 0, 'rgba(150,105,55,0.45)');
    // mud-brick house with a rounded Nubian vault roof
    k.box(0.3, 0.35, 1.3, 1.25, 0, 22, m.base);
    const vault = lv >= 8 ? m.trim : lv >= 5 ? shade(m.base, 0.08) : '#c9a070';
    k.cyl(0.95, 0.98, 0.5, 22, 4, shade(m.base, -0.1), { noTop: true });
    k.dome(0.95, 0.98, 0.5, 26, vault, 0.8);
    k.door(0.3, 0.35, 1.3, 1.25, 0.42, 0, 14, 0.28, '#3a2210');
    // window
    { const a = k.fr(0.3, 0.35, 1.3, 1.25, 0.45, 16), b = k.fr(0.3, 0.35, 1.3, 1.25, 0.7, 16); k.poly([a, b, [b[0], b[1] - 6], [a[0], a[1] - 6]], '#3a2210'); }
    // palm-frond awning on poles
    const aw = lv >= 6 ? '#2a6fd0' : lv >= 3 ? '#e2c27a' : '#b89a5a';
    { const p1 = k.fl(0.3, 0.35, 1.3, 1.25, 0.1, 0), p2 = k.fl(0.3, 0.35, 1.3, 1.25, 0.9, 0);
      const q1 = k.P(0.35, 1.95, 0), q2 = k.P(1.5, 1.95, 0);
      k.line(q1, [q1[0], q1[1] - 15], '#6b4a2a', 1.6); k.line(q2, [q2[0], q2[1] - 15], '#6b4a2a', 1.6);
      k.poly([[p1[0], p1[1] - 18], [p2[0], p2[1] - 18], [q2[0], q2[1] - 15], [q1[0], q1[1] - 15]], aw, shade(aw, -0.4), 0.7);
      for (let i = 1; i < 6; i++) { const t = i / 6; k.line([U.lerp(p1[0], p2[0], t), U.lerp(p1[1], p2[1], t) - 18], [U.lerp(q1[0], q2[0], t), U.lerp(q1[1], q2[1], t) - 15], rgba(shade(aw, -0.4), 0.6), 0.6); } }
    // brick stack and water jar
    k.box(1.55, 1.55, 0.35, 0.3, 0, 6, '#b8683a', { tex: 'brick' });
    k.box(1.6, 1.58, 0.25, 0.22, 6, 4, '#c8784a', { tex: 'brick' });
    k.cyl(0.3, 1.7, 0.13, 0, 10, '#c06a3a', { top: '#3a2210' });
    if (lv >= 4) k.glyphs(0.3, 0.35, 1.3, 1.25, 8, rgba(m.trim, 0.8), 2);
    if (lv >= 7) k.trim(0.3, 0.35, 1.3, 1.25, 20, m.trim, 1.6);
    if (lv >= 9) { const p = k.fr(0.3, 0.35, 1.3, 1.25, 0.2, 12); k.gem(p[0], p[1], 2.6, m.glow || '#d23a4a'); }
    if (lv >= 10) { const p = k.P(0.95, 0.98, 46); k.circle(p[0], p[1], 3, GOLD, '#8a6208', 0.8); }
  };

  DRAW.goldMine = (k, lv, fill) => {
    const m = M(lv);
    const rock = U.mix('#b07a48', m.base, 0.3), rock2 = shade(rock, -0.08);
    k.ell(1.5, 1.6, 1.4, 0, 'rgba(120,80,40,0.35)');
    // craggy cliff: a few tapered blocks of rock
    const saved = k.tex; k.tex = 'none';
    k.taper(0.2, 0.15, 2.5, 1.45, 0, 38, 0.32, rock);
    k.taper(0.15, 0.95, 0.8, 1.2, 0, 22, 0.18, rock2);
    k.taper(1.85, 0.3, 1.0, 1.4, 0, 30, 0.22, shade(rock, -0.04));
    k.taper(0.8, 0.35, 1.0, 0.8, 38, 12, 0.22, shade(rock, 0.05));
    k.tex = saved;
    // gold veins glinting in the rock
    k.ctx.lineWidth = 1.6; k.ctx.strokeStyle = GOLD;
    for (const [u, v, z, dx] of [[0.6, 1.6, 20, 10], [1.2, 1.6, 28, -8], [2.7, 1.0, 18, -9], [2.85, 1.4, 10, 7]]) {
      const p = k.P(u, v, z); k.ctx.beginPath(); k.ctx.moveTo(...p); k.ctx.lineTo(p[0] + dx, p[1] - 5); k.ctx.lineTo(p[0] + dx * 1.4, p[1] - 2); k.ctx.stroke();
    }
    // timber-framed entrance
    const fc = lv >= 7 ? GOLD : lv >= 4 ? shade(m.base, -0.1) : '#6b4a2a';
    const a = k.fl(0.2, 0.15, 2.5, 1.45, 0.34, 0), b = k.fl(0.2, 0.15, 2.5, 1.45, 0.62, 0);
    k.poly([a, b, [b[0], b[1] - 22], [a[0], a[1] - 22]], '#1d130b');
    k.poly([[a[0] + 2, a[1] - 2], [b[0] - 2, b[1] - 2], [b[0] - 2, b[1] - 19], [a[0] + 2, a[1] - 19]], '#2e1f12');
    k.line(a, [a[0], a[1] - 23], fc, 3); k.line(b, [b[0], b[1] - 23], fc, 3);
    k.line([a[0] - 3, a[1] - 23], [b[0] + 3, b[1] - 23], fc, 3.2);
    // rails running out of the mine
    for (const off of [0, 0.36]) k.line(k.P(1.12 + off, 1.62, 0), k.P(1.12 + off, 2.95, 0), '#4a3018', 1.6);
    for (let i = 0; i < 5; i++) k.line(k.P(1.02, 1.75 + i * 0.27, 0), k.P(1.58, 1.75 + i * 0.27, 0), '#7a5530', 1.4);
    // heaps of gold
    const piles = 1 + Math.floor(lv / 3) + (fill > 0.5 ? 1 : 0);
    for (let i = 0; i < piles; i++) {
      const [x, y] = k.P(2.15 + (i % 2) * 0.48, 2.05 + Math.floor(i / 2) * 0.36, 0);
      const g = k.ctx.createLinearGradient(x, y - 9, x, y);
      g.addColorStop(0, '#fff3a6'); g.addColorStop(0.5, GOLD); g.addColorStop(1, '#a87a10');
      k.ctx.beginPath(); k.ctx.ellipse(x, y - 1, 9, 6, 0, Math.PI, 0); k.ctx.closePath(); k.ctx.fillStyle = g; k.ctx.fill();
      k.ctx.strokeStyle = '#8a6208'; k.ctx.lineWidth = 0.7; k.ctx.stroke();
      k.circle(x - 3, y - 5, 1.3, '#fffbe0'); k.circle(x + 2, y - 3, 1, '#fffbe0');
    }
    if (lv >= 5) { k.box(0.3, 2.25, 0.55, 0.5, 0, 11, '#7a5530', { tex: 'none' }); k.box(0.3, 2.25, 0.55, 0.5, 11, 2.5, GOLD, { tex: 'none' }); }
    if (lv >= 8) { const p = k.P(0.9, 0.5, 40); k.gem(p[0], p[1], 4.5, '#3a6fe0'); }
    if (lv >= 10) { const p = k.P(2.2, 0.6, 30); k.gem(p[0], p[1], 4, '#d23a4a'); }
    if (lv >= 3) { const p = k.P(0.25, 2.95, 0); k.banner(p[0], p[1], 28, bannerColor(lv), lv); }
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
    const H = 44 + lv * 1.5;
    // courtyard floor
    k.box(0.1, 0.1, 2.8, 2.8, 0, 4, shade(m.base, -0.18));
    // hall at the back
    k.box(0.3, 0.3, 2.4, 1.3, 4, 26, shade(m.base, -0.05));
    if (lv >= 3) k.trim(0.3, 0.3, 2.4, 1.3, 27, m.trim, 1.4);
    // training dummies in the yard
    for (const u of [0.75, 1.6]) {
      const p = k.P(u, 2.05, 4);
      k.line(p, [p[0], p[1] - 16], '#6b4a2a', 2);
      k.line([p[0] - 6, p[1] - 11], [p[0] + 6, p[1] - 11], '#6b4a2a', 1.8);
      k.circle(p[0], p[1] - 18, 3.4, '#d8b878', '#6b4a2a', 0.8);
    }
    // pylon gateway on the right side: two sloping towers and a lintel
    k.taper(2.0, 0.25, 0.75, 1.05, 4, H, 0.12, m.base);
    k.taper(2.0, 1.85, 0.75, 1.05, 4, H, 0.12, m.base);
    k.box(2.05, 1.25, 0.55, 0.65, 4 + H - 14, 12, shade(m.base, 0.04));
    { const a = k.fr(2.0, 1.25, 0.75, 0.6, 0.12, 4), b = k.fr(2.0, 1.25, 0.75, 0.6, 0.88, 4); k.poly([a, b, [b[0], b[1] - (H - 16)], [a[0], a[1] - (H - 16)]], '#2a1a10'); }
    if (lv >= 4) { k.glyphs(2.0, 0.25, 0.75, 1.05, 22, rgba(m.trim, 0.85), 2); k.glyphs(2.0, 1.85, 0.75, 1.05, 22, rgba(m.trim, 0.85), 2); }
    if (lv >= 3) { k.trim(2.0, 1.85, 0.75, 1.05, H - 2, m.trim, 1.6); }
    // flagpoles on the pylons
    for (const v of [0.6, 2.3]) { const p = k.P(2.7, v, 4 + H); k.banner(p[0], p[1] + 2, 24, bannerColor(Math.max(2, lv)), lv); }
    // spear rack
    const p = k.P(0.35, 2.6, 4);
    for (let i = 0; i < 3 + Math.min(4, Math.floor(lv / 2)); i++) { k.line([p[0] + i * 3, p[1] - i * 1.5], [p[0] + i * 3 - 2, p[1] - i * 1.5 - 22], '#6b4a2a', 1.3); k.poly([[p[0] + i * 3 - 2, p[1] - i * 1.5 - 26], [p[0] + i * 3 - 3.4, p[1] - i * 1.5 - 21], [p[0] + i * 3 - 0.6, p[1] - i * 1.5 - 21]], '#d0d0dc'); }
    if (lv >= 8) { const g = k.fr(2.0, 0.25, 0.75, 1.05, 0.5, 34); k.gem(g[0], g[1], 3.2, '#d23a4a'); }
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
    k.box(0.2, 0.2, s - 0.4, s - 0.4, 0, h, m.base);
    dress(k, s, lv, 0.2, 0.2, s - 0.4, s - 0.4, h);
    if (lv >= 5) { // corner posts
      for (const [cu, cv] of [[0.3, s - 0.3], [s - 0.3, s - 0.3], [s - 0.3, 0.3]]) {
        k.box(cu - 0.1, cv - 0.1, 0.2, 0.2, h, 6, shade(m.base, -0.1));
        if (lv >= 7) k.box(cu - 0.1, cv - 0.1, 0.2, 0.2, h + 6, 2, GOLD);
      }
    }
  }
  // Round stone bastion with battlements, for turret defenses.
  function bastion(k, s, lv, h) {
    const m = M(lv), c = s / 2, r = s * 0.43;
    k.cyl(c, c, r + 0.08, 0, 6, shade(m.base, -0.2));
    k.cyl(c, c, r, 6, h - 6, m.base, { top: shade(m.base, -0.08) });
    // battlements, back ones first
    const n = 12, merl = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; merl.push([c + Math.cos(a) * (r - 0.09), c + Math.sin(a) * (r - 0.09)]); }
    merl.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    for (const [u, v] of merl) k.box(u - 0.09, v - 0.09, 0.18, 0.18, h, 6, shade(m.base, 0.05));
    if (lv >= 3) { const [x, y] = k.P(c, c, h * 0.55); k.ctx.beginPath(); k.ctx.ellipse(x, y, r * HW * 1.414, r * HH * 1.414, 0, 0.1, Math.PI - 0.1); k.ctx.strokeStyle = m.trim; k.ctx.lineWidth = lv >= 7 ? 2.4 : 1.6; k.ctx.stroke(); }
    if (lv >= 8) { const [x, y] = k.P(c, c + r, h * 0.55); k.gem(x, y, 3.4, lv >= 11 ? '#3ff0dc' : lv >= 9 ? '#d23a4a' : '#3a6fe0'); }
    if (lv >= 6) { const [x, y] = k.P(c + r * 0.7, c - r * 0.7, h + 6); k.banner(x, y, 18, bannerColor(lv), lv); }
  }
  DRAW.ballista = (k, lv) => { bastion(k, 3, lv, 22); };
  DRAW.catapult = (k, lv) => {
    platform(k, 3, lv, 10);
    // sandbag ring and a boulder pile
    for (let i = 0; i < 9; i++) { const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7; const p = k.P(1.5 + Math.cos(a) * 1.15, 1.5 + Math.sin(a) * 1.15, 10); k.ctx.beginPath(); k.ctx.ellipse(p[0], p[1] - 3, 6, 4, 0, 0, Math.PI * 2); k.ctx.fillStyle = '#c8a870'; k.ctx.fill(); k.ctx.strokeStyle = '#7a5a30'; k.ctx.lineWidth = 0.7; k.ctx.stroke(); }
    for (let i = 0; i < 3; i++) { const p = k.P(0.5 + i * 0.25, 0.55, 10); k.circle(p[0], p[1] - 3.4, 3.8, '#8a7a6a', '#4a3a2a', 0.7); k.circle(p[0] - 1, p[1] - 4.6, 1.2, 'rgba(255,255,255,0.35)'); }
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
    const h = 15 + Math.min(lv, 8) * 1.2;
    const c = m.base;
    // arms reach into the neighbouring tile so runs of wall read as one wall
    if (conn & 1) { k.box(0.5, 0.27, 0.74, 0.46, 0, h + 2, c); if (lv >= 3) k.box(0.5, 0.24, 0.74, 0.52, h + 2, 2.5, shade(c, -0.12), { tex: 'none' }); }
    if (conn & 2) { k.box(0.27, 0.5, 0.46, 0.74, 0, h + 2, c); if (lv >= 3) k.box(0.24, 0.5, 0.52, 0.74, h + 2, 2.5, shade(c, -0.12), { tex: 'none' }); }
    k.box(0.22, 0.22, 0.56, 0.56, 0, h + 3, shade(c, 0.05));
    if (lv >= 3) k.box(0.18, 0.18, 0.64, 0.64, h + 3, 3, shade(c, -0.12), { tex: 'none' });
    if (lv >= 5 && lv < 7) k.trim(0.22, 0.22, 0.56, 0.56, h * 0.55, m.trim, 1.2);
    if (lv >= 7) k.pyr(0.26, 0.26, 0.48, 0.48, h + 6, 6, m.trim, { tex: 'none' });
    if (lv >= 9) { const p = k.P(0.5, 0.78, h * 0.6); k.gem(p[0], p[1], 2.4, lv >= 11 ? '#3ff0dc' : '#d23a4a'); }
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
    palm: (k, s, extra) => {
      const v = parseInt(String(extra).slice(-1), 10) || 0;
      k.palm(s * 0.45, s * 0.55, 0, 34 + s * 14 + v * 6, 1.15);
      if (s > 1 || v === 2) k.palm(s * 0.78, s * 0.3, 0, 26 + v * 3, 0.9);
    },
    rock: (k, s) => { k.taper(0.15, 0.2, s - 0.3, s - 0.35, 0, 10 + s * 7, 0.15 * s, '#9a8a78'); k.taper(0.5 * s, 0.1, 0.45 * s, 0.5 * s, 0, 8 + s * 4, 0.1, '#857565'); },
    ruin: (k, s) => { k.box(0.1, 0.1, s - 0.2, 0.3, 0, 14, '#cdb48a'); k.cyl(s - 0.45, s - 0.5, 0.2, 0, 26, '#d8c39a'); k.box(0.2, s - 0.6, 0.6, 0.4, 0, 6, '#b8a07a'); },
    bush: (k, s) => { for (let i = 0; i < 3; i++) { const p = k.P(0.3 + i * 0.22 * s, 0.6 + (i % 2) * 0.2, 0); k.circle(p[0], p[1] - 5, 6, i % 2 ? '#8a9a4a' : '#6f7f3a'); } },
  };

  // ------------------------------------------------------------ the cache
  // Height of each building in pixels (for its canvas and the shadow it casts).
  const HEIGHT = { palm: 80, pyramid: 230, obelisk: 170, archerTower: 120, sunDisk: 125, falconPerch: 90, temple: 110, barracks: 95, royalHall: 95, goopJar: 100 };
  const SHADOW = { pyramid: 150, obelisk: 120, archerTower: 90, sunDisk: 100, falconPerch: 60, temple: 60, barracks: 55, royalHall: 50, goopJar: 66, goldMine: 36, goopWell: 30,
    treasury: 36, builderHut: 30, armyCamp: 22, ballista: 26, catapult: 24, brazier: 36, eyeHorus: 52, anubis: 40, sphinx: 50, wall: 22, palm: 50, rock: 20, ruin: 26, bush: 8 };
  const cache = new Map();
  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function texFor(level) { return level <= 2 ? 'brick' : level <= 7 ? 'block' : 'smooth'; }

  // Convex hull (monotone chain) for shadow outlines.
  function hull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  // Returns { img, shadow, ax, ay, w, h, s }: draw img (and shadow, first) so
  // (ax, ay) lands on the footprint's top corner.
  function sprite(type, level, extra = 0, obstacleSize = 0) {
    const key = type + '|' + level + '|' + extra;
    let sp = cache.get(key);
    if (sp) { cache.delete(key); cache.set(key, sp); return sp; }
    const s = obstacleSize || D.B[type].size;
    const H = HEIGHT[type] || 80;
    const sh = SHADOW[type] || 30;
    const ax = s * 32 + 22, ay = H;
    const w = s * 64 + 44 + Math.round(sh * 0.5), h = s * 32 + H + 24;
    const W = Math.ceil(w * SS), Hh = Math.ceil(h * SS);
    // 1. the art itself
    const art = makeCanvas(W, Hh);
    const ctx = art.getContext('2d');
    ctx.scale(SS, SS);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const k = kit(ctx, ax, ay);
    k.tex = obstacleSize ? (type === 'ruin' ? 'block' : 'none') : texFor(level);
    k.rng = U.makeRng(U.hashString(key));
    if (obstacleSize) OB[type](k, s, extra);
    else DRAW[type](k, level, extra);
    // 2. a dark cartoon outline around the whole silhouette
    const sil = makeCanvas(W, Hh), sc = sil.getContext('2d');
    sc.drawImage(art, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = 'rgba(44,24,8,0.92)'; sc.fillRect(0, 0, W, Hh);
    const img = makeCanvas(W, Hh), ic = img.getContext('2d');
    const o = 1.5 * SS;
    for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o], [o * 0.7, o * 0.7], [-o * 0.7, o * 0.7], [o * 0.7, -o * 0.7], [-o * 0.7, -o * 0.7]]) ic.drawImage(sil, dx, dy);
    ic.drawImage(art, 0, 0);
    // 3. a soft shadow cast down and to the right, drawn on the ground first
    const shadow = makeCanvas(Math.ceil(w), Math.ceil(h)), xc = shadow.getContext('2d');
    const P = (u, v) => [ax + (u - v) * HW, ay + (u + v) * HH];
    const inset = type === 'wall' ? 0.15 : 0.08;
    const base = [P(inset, inset), P(s - inset, inset), P(s - inset, s - inset), P(inset, s - inset)];
    const ox = sh * 0.5, oy = sh * 0.14;
    const poly = hull(base.concat(base.map(([x, y]) => [x + ox, y + oy])));
    if ('filter' in xc) xc.filter = 'blur(3px)';
    xc.beginPath(); xc.moveTo(...poly[0]); for (const p of poly.slice(1)) xc.lineTo(...p); xc.closePath();
    xc.fillStyle = 'rgba(30,40,0,0.3)'; xc.fill();
    sp = { img, shadow, ax, ay, w, h, s };
    cache.set(key, sp);
    if (cache.size > 260) cache.delete(cache.keys().next().value);
    return sp;
  }

  G.Sprites = { sprite, kit, M, GOLD, GOOP, GOOP_D, bannerColor, HW, HH, OB };
})(globalThis.SOTP = globalThis.SOTP || {});
