/* Kingdom Clash: everything drawn in code (troops, towers, the arena, card portraits, Trainer Owen).
   Each troop is drawn at its feet, facing right, at k pixels per tile; the caller mirrors it to face
   left. No image files, so the whole game ships as one page. */
'use strict';

const KCArt = (() => {
  const OUT = '#1c1530';
  const TEAM = [
    { main: '#2f7cf6', light: '#8cc4ff', dark: '#1a4ba8', cloth: '#2c6be0' },
    { main: '#e5414b', light: '#ff9ea4', dark: '#9e1f29', cloth: '#d23a45' },
  ];
  const TAU = Math.PI * 2;

  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  function paint(c, fill, lw) {
    c.fillStyle = fill; c.fill();
    if (lw) { c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); }
  }
  function line(c, x1, y1, x2, y2, col, w) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.stroke();
  }
  function eye(c, x, y, r) { circ(c, x, y, r); paint(c, '#fff', r * 0.5); circ(c, x + r * 0.25, y, r * 0.5); paint(c, OUT); }

  // A feathered wing from the shoulder (0,0), swept up and back, with a team-coloured tip.
  function wing(c, k, rot, col, tip, lw, sz) {
    c.save(); c.rotate(rot); c.scale(sz, sz);
    c.beginPath();
    c.moveTo(k * 0.08, -k * 0.02);
    c.quadraticCurveTo(k * 0.02, -k * 0.5, -k * 0.42, -k * 0.7);
    c.lineTo(-k * 0.5, -k * 0.56);
    c.lineTo(-k * 0.4, -k * 0.5); c.lineTo(-k * 0.46, -k * 0.38);
    c.lineTo(-k * 0.34, -k * 0.34); c.lineTo(-k * 0.38, -k * 0.2);
    c.lineTo(-k * 0.24, -k * 0.18); c.lineTo(-k * 0.22, -k * 0.02);
    c.closePath(); paint(c, col, lw);
    c.beginPath();
    c.moveTo(-k * 0.3, -k * 0.63); c.lineTo(-k * 0.42, -k * 0.7); c.lineTo(-k * 0.5, -k * 0.56); c.lineTo(-k * 0.4, -k * 0.5);
    c.closePath(); c.fillStyle = tip; c.fill();
    line(c, -k * 0.02, -k * 0.12, -k * 0.3, -k * 0.5, 'rgba(40,20,10,0.35)', k * 0.03);
    c.restore();
  }

  /* ---------- troops ---------- */
  const TROOPS = {
    rhino(c, k, o) {
      const lw = k * 0.07, st = o.walk ? Math.sin(o.t * 9) * k * 0.06 : 0, lunge = o.atk * k * 0.25;
      for (const [lx, ph] of [[-0.5, 1], [-0.22, -1], [0.2, 1], [0.46, -1]]) {
        rr(c, lx * k - k * 0.1, -k * 0.42 + st * ph, k * 0.2, k * 0.42 - st * ph, k * 0.06); paint(c, '#6c7380', lw);
      }
      line(c, -k * 0.8, -k * 0.7, -k * 0.98, -k * 0.55, OUT, k * 0.07);
      ell(c, -k * 0.05, -k * 0.66, k * 0.8, k * 0.46); paint(c, '#98a0ac', lw);
      ell(c, -k * 0.05, -k * 0.5, k * 0.6, k * 0.22); paint(c, '#a9b0ba');
      rr(c, -k * 0.6, -k * 1.12, k * 0.95, k * 0.42, k * 0.16); paint(c, '#c38b3c', lw);
      for (const rx of [-0.45, -0.15, 0.15]) { circ(c, rx * k, -k * 0.92, k * 0.045); paint(c, '#f3d18a'); }
      rr(c, -k * 0.62, -k * 0.86, k * 0.98, k * 0.09, k * 0.04); paint(c, '#8d5f25');
      c.save(); c.translate(lunge, 0);
      ell(c, k * 0.68, -k * 0.62, k * 0.36, k * 0.29); paint(c, '#9ea6b1', lw);
      poly(c, [k * 0.86, -k * 0.74, k * 1.18, -k * 1.08, k * 1.0, -k * 0.6]); paint(c, '#f2e8c8', lw * 0.8);
      poly(c, [k * 0.7, -k * 0.86, k * 0.8, -k * 1.02, k * 0.86, -k * 0.82]); paint(c, '#f2e8c8', lw * 0.7);
      poly(c, [k * 0.42, -k * 0.82, k * 0.46, -k * 1.02, k * 0.58, -k * 0.86]); paint(c, '#858c97', lw * 0.7);
      eye(c, k * 0.66, -k * 0.7, k * 0.07);
      line(c, k * 0.58, -k * 0.82, k * 0.76, -k * 0.76, OUT, k * 0.05);
      circ(c, k * 0.96, -k * 0.52, k * 0.03); paint(c, OUT);
      c.restore();
    },
    wolves(c, k, o) {
      const lw = k * 0.06, st = o.walk ? Math.sin(o.t * 14) * k * 0.05 : 0, lunge = o.atk * k * 0.2;
      for (const [lx, ph] of [[-0.24, 1], [-0.1, -1], [0.14, 1], [0.26, -1]]) {
        rr(c, lx * k - k * 0.05, -k * 0.24 + st * ph, k * 0.1, k * 0.24 - st * ph, k * 0.04); paint(c, '#6f7884', lw);
      }
      c.beginPath(); c.moveTo(-k * 0.3, -k * 0.36); c.quadraticCurveTo(-k * 0.55, -k * 0.5, -k * 0.5, -k * 0.7);
      c.strokeStyle = OUT; c.lineWidth = k * 0.13; c.lineCap = 'round'; c.stroke();
      c.strokeStyle = '#8b95a1'; c.lineWidth = k * 0.07; c.stroke();
      ell(c, 0, -k * 0.34, k * 0.36, k * 0.18); paint(c, '#8f99a5', lw);
      ell(c, -k * 0.04, -k * 0.42, k * 0.26, k * 0.08); paint(c, '#6d7682');
      c.save(); c.translate(lunge, 0);
      poly(c, [k * 0.22, -k * 0.56, k * 0.26, -k * 0.76, k * 0.36, -k * 0.6]); paint(c, '#7b8591', lw);
      poly(c, [k * 0.34, -k * 0.58, k * 0.42, -k * 0.78, k * 0.48, -k * 0.56]); paint(c, '#7b8591', lw);
      circ(c, k * 0.36, -k * 0.45, k * 0.15); paint(c, '#9aa4b0', lw);
      ell(c, k * 0.53, -k * 0.4, k * 0.12, k * 0.07); paint(c, '#c9ced6', lw);
      circ(c, k * 0.64, -k * 0.42, k * 0.03); paint(c, OUT);
      circ(c, k * 0.39, -k * 0.49, k * 0.035); paint(c, '#ffd54a');
      c.restore();
    },
    gladiator(c, k, o) {
      const T = TEAM[o.team], lw = k * 0.065, st = o.walk ? Math.sin(o.t * 9) * k * 0.06 : 0, sw = o.atk;
      rr(c, -k * 0.2, -k * 0.42 + st, k * 0.14, k * 0.42 - st, k * 0.05); paint(c, '#d9a27a', lw);
      rr(c, k * 0.06, -k * 0.42 - st, k * 0.14, k * 0.42 + st, k * 0.05); paint(c, '#d9a27a', lw);
      poly(c, [-k * 0.3, -k * 0.42, k * 0.3, -k * 0.42, k * 0.22, -k * 0.72, -k * 0.22, -k * 0.72]); paint(c, T.cloth, lw);
      rr(c, -k * 0.24, -k * 1.05, k * 0.48, k * 0.38, k * 0.12); paint(c, '#e0ab84', lw);
      rr(c, -k * 0.26, -k * 0.78, k * 0.52, k * 0.09, k * 0.03); paint(c, '#b7832f', lw * 0.7);
      c.save(); c.translate(-k * 0.2, -k * 0.85); c.rotate(-0.9 + sw * 2.2);
      rr(c, -k * 0.03, -k * 0.62, k * 0.08, k * 0.52, k * 0.03); paint(c, '#dfe6ee', lw * 0.8);
      rr(c, -k * 0.1, -k * 0.12, k * 0.22, k * 0.06, k * 0.02); paint(c, '#b7832f', lw * 0.7);
      c.restore();
      circ(c, 0, -k * 1.22, k * 0.2); paint(c, '#e0ab84', lw);
      c.beginPath(); c.arc(0, -k * 1.22, k * 0.23, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); paint(c, '#c99a3e', lw);
      rr(c, k * 0.02, -k * 1.28, k * 0.2, k * 0.06, k * 0.02); paint(c, OUT);
      for (let i = 0; i < 5; i++) { circ(c, -k * 0.18 + i * k * 0.07, -k * 1.5 - Math.sin(i / 4 * Math.PI) * k * 0.08, k * 0.07); paint(c, T.main, lw * 0.6); }
      circ(c, k * 0.26, -k * 0.7, k * 0.32); paint(c, '#a3652e', lw);
      circ(c, k * 0.26, -k * 0.7, k * 0.32); c.lineWidth = k * 0.07; c.strokeStyle = '#d8a440'; c.stroke();
      circ(c, k * 0.26, -k * 0.7, k * 0.1); paint(c, T.light, lw * 0.7);
    },
    hawks(c, k, o) {
      const T = TEAM[o.team], lw = k * 0.06, flap = Math.sin(o.t * 13 + (o.id || 0)) * 0.7, dive = o.atk * k * 0.3;
      c.save(); c.translate(dive, dive * 0.6);
      poly(c, [-k * 0.3, -k * 0.02, -k * 0.58, -k * 0.12, -k * 0.56, k * 0.1]); paint(c, '#6e4325', lw);
      wing(c, k, -0.25 - flap, '#74472a', T.main, lw, 0.9);
      ell(c, 0, 0, k * 0.32, k * 0.17); paint(c, '#8a5a35', lw);
      ell(c, k * 0.02, k * 0.05, k * 0.2, k * 0.08); paint(c, '#d9b98d');
      wing(c, k, 0.1 + flap, '#94603a', T.light, lw, 1);
      circ(c, k * 0.3, -k * 0.06, k * 0.14); paint(c, '#f5f1e8', lw);
      poly(c, [k * 0.4, -k * 0.1, k * 0.56, -k * 0.02, k * 0.42, k * 0.02]); paint(c, '#f4c23a', lw * 0.7);
      circ(c, k * 0.33, -k * 0.09, k * 0.035); paint(c, OUT);
      line(c, k * 0.26, -k * 0.16, k * 0.4, -k * 0.13, OUT, k * 0.035);
      line(c, k * 0.05, k * 0.14, k * 0.1, k * 0.24, '#f4c23a', k * 0.05);
      c.restore();
    },
    archers(c, k, o) {
      const T = TEAM[o.team], lw = k * 0.065, st = o.walk ? Math.sin(o.t * 9) * k * 0.05 : 0, draw = o.atk;
      rr(c, -k * 0.16, -k * 0.36 + st, k * 0.12, k * 0.36 - st, k * 0.04); paint(c, '#4a3a2c', lw);
      rr(c, k * 0.04, -k * 0.36 - st, k * 0.12, k * 0.36 + st, k * 0.04); paint(c, '#4a3a2c', lw);
      rr(c, -k * 0.36, -k * 1.0, k * 0.16, k * 0.4, k * 0.04); paint(c, '#7a4f2a', lw);
      line(c, -k * 0.3, -k * 1.0, -k * 0.34, -k * 1.12, '#f0e6d0', k * 0.05);
      line(c, -k * 0.24, -k * 1.0, -k * 0.24, -k * 1.13, '#f0e6d0', k * 0.05);
      poly(c, [-k * 0.28, -k * 0.34, k * 0.28, -k * 0.34, k * 0.2, -k * 0.95, -k * 0.2, -k * 0.95]); paint(c, '#3d7a4a', lw);
      line(c, -k * 0.26, -k * 0.5, k * 0.26, -k * 0.5, T.main, k * 0.07);
      c.beginPath(); c.arc(0, -k * 1.06, k * 0.27, Math.PI * 0.85, Math.PI * 2.15); c.closePath(); paint(c, T.main, lw);
      ell(c, k * 0.06, -k * 1.02, k * 0.15, k * 0.14); paint(c, '#e8b48d', lw * 0.7);
      circ(c, k * 0.11, -k * 1.04, k * 0.03); paint(c, OUT);
      const bx = k * 0.34 - draw * k * 0.05;
      c.beginPath(); c.arc(bx - k * 0.2, -k * 0.72, k * 0.38, -1.0, 1.0); c.strokeStyle = OUT; c.lineWidth = k * 0.11; c.stroke();
      c.strokeStyle = '#a0662f'; c.lineWidth = k * 0.06; c.stroke();
      line(c, bx - k * 0.2 + Math.cos(-1) * k * 0.38, -k * 0.72 + Math.sin(-1) * k * 0.38, bx - k * 0.2 - draw * k * 0.12, -k * 0.72, '#eee', k * 0.02);
      line(c, bx - k * 0.2 - draw * k * 0.12, -k * 0.72, bx - k * 0.2 + Math.cos(1) * k * 0.38, -k * 0.72 + Math.sin(1) * k * 0.38, '#eee', k * 0.02);
      rr(c, k * 0.06, -k * 0.8, k * 0.14, k * 0.12, k * 0.05); paint(c, '#e8b48d', lw * 0.7);
    },
    snowman(c, k, o) {
      const T = TEAM[o.team], lw = k * 0.065, bob = o.walk ? Math.abs(Math.sin(o.t * 7)) * k * 0.05 : 0, th = o.atk;
      circ(c, 0, -k * 0.36, k * 0.37); paint(c, '#f5f9ff', lw);
      ell(c, -k * 0.08, -k * 0.3, k * 0.26, k * 0.22); paint(c, '#dfe9f7');
      c.save(); c.translate(0, -bob);
      line(c, -k * 0.2, -k * 0.95, -k * 0.55, -k * 1.2, '#6b4426', k * 0.06);
      line(c, -k * 0.45, -k * 1.13, -k * 0.55, -k * 1.32, '#6b4426', k * 0.04);
      circ(c, 0, -k * 0.92, k * 0.28); paint(c, '#f5f9ff', lw);
      for (const by of [-0.85, -1.0]) { circ(c, 0, by * k, k * 0.035); paint(c, '#2b2b36'); }
      const ax = k * (0.45 + th * 0.15), ay = -k * (0.95 + th * 0.4);
      line(c, k * 0.2, -k * 0.95, ax, ay, '#6b4426', k * 0.06);
      if (th < 0.6) { circ(c, ax + k * 0.04, ay - k * 0.05, k * 0.13); paint(c, '#ffffff', lw * 0.7); }
      circ(c, 0, -k * 1.32, k * 0.21); paint(c, '#f5f9ff', lw);
      rr(c, -k * 0.27, -k * 1.18, k * 0.54, k * 0.1, k * 0.05); paint(c, T.main, lw * 0.7);
      rr(c, -k * 0.2, -k * 1.18, k * 0.1, k * 0.28, k * 0.04); paint(c, T.main, lw * 0.7);
      eye(c, -k * 0.02, -k * 1.37, k * 0.04); eye(c, k * 0.1, -k * 1.37, k * 0.04);
      poly(c, [k * 0.08, -k * 1.32, k * 0.38, -k * 1.28, k * 0.08, -k * 1.25]); paint(c, '#f28a26', lw * 0.6);
      rr(c, -k * 0.2, -k * 1.56, k * 0.4, k * 0.06, k * 0.03); paint(c, '#262433', lw * 0.6);
      rr(c, -k * 0.13, -k * 1.82, k * 0.26, k * 0.28, k * 0.04); paint(c, '#262433', lw * 0.6);
      rr(c, -k * 0.13, -k * 1.62, k * 0.26, k * 0.05, k * 0.01); paint(c, T.main);
      c.restore();
    },
    gorilla(c, k, o) {
      const lw = k * 0.07, st = o.walk ? Math.sin(o.t * 8) * k * 0.06 : 0, sm = o.atk;
      rr(c, -k * 0.45, -k * 0.42, k * 0.24, k * 0.42, k * 0.08); paint(c, '#33363e', lw);
      rr(c, -k * 0.15, -k * 0.42, k * 0.24, k * 0.42, k * 0.08); paint(c, '#33363e', lw);
      c.save(); c.translate(k * 0.35, -k * 0.95); c.rotate(-0.3 - sm * 2.0 + st * 0.5 / k);
      rr(c, -k * 0.13, 0, k * 0.26, k * 0.85, k * 0.12); paint(c, '#2d3037', lw);
      ell(c, 0, k * 0.86, k * 0.16, k * 0.11); paint(c, '#6a5a4c', lw);
      c.restore();
      ell(c, -k * 0.05, -k * 0.82, k * 0.6, k * 0.5); paint(c, '#3b3e47', lw);
      ell(c, -k * 0.2, -k * 0.98, k * 0.36, k * 0.22); paint(c, '#8f949e');
      c.save(); c.translate(k * 0.6, -k * 0.95); c.rotate(-0.15 - sm * 2.4 - st * 0.5 / k);
      rr(c, -k * 0.13, 0, k * 0.27, k * 0.92, k * 0.12); paint(c, '#34373f', lw);
      ell(c, 0, k * 0.93, k * 0.17, k * 0.12); paint(c, '#6a5a4c', lw);
      c.restore();
      circ(c, k * 0.42, -k * 1.22, k * 0.27); paint(c, '#3b3e47', lw);
      ell(c, k * 0.55, -k * 1.14, k * 0.17, k * 0.15); paint(c, '#8a7462', lw * 0.7);
      rr(c, k * 0.3, -k * 1.36, k * 0.38, k * 0.09, k * 0.04); paint(c, '#2a2c33');
      circ(c, k * 0.46, -k * 1.26, k * 0.035); paint(c, '#ffd54a'); circ(c, k * 0.6, -k * 1.26, k * 0.035); paint(c, '#ffd54a');
      line(c, k * 0.5, -k * 1.06, k * 0.62, -k * 1.07, OUT, k * 0.03);
    },
  };

  function troop(c, card, k, o) {
    const f = TROOPS[card];
    if (!f) return;
    c.save();
    if (o.face < 0) c.scale(-1, 1);
    f(c, k, o);
    c.restore();
  }

  /* ---------- towers ---------- */
  function stoneBlock(c, k, x, y, w, h, T) {
    rr(c, x, y, w, h, k * 0.18); paint(c, '#b8b2a8', k * 0.08);
    c.save(); rr(c, x, y, w, h, k * 0.18); c.clip();
    c.strokeStyle = 'rgba(70,60,60,0.35)'; c.lineWidth = k * 0.04;
    const rows = Math.round(h / (k * 0.42));
    for (let i = 1; i < rows; i++) {
      const yy = y + (h * i) / rows;
      line(c, x, yy, x + w, yy, 'rgba(70,60,60,0.35)', k * 0.04);
      for (let j = 0; j < 5; j++) {
        const xx = x + (w * (j + (i % 2 ? 0.5 : 0))) / 4;
        line(c, xx, yy - h / rows, xx, yy, 'rgba(70,60,60,0.3)', k * 0.035);
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, y + h * 0.75, w, h * 0.25);
    c.restore();
    rr(c, x - k * 0.08, y - k * 0.1, w + k * 0.16, k * 0.55, k * 0.14); paint(c, '#d3cdc3', k * 0.08);
    for (let i = 0; i < 4; i++) {
      rr(c, x - k * 0.05 + i * (w / 3.4), y - k * 0.42, w / 6, k * 0.36, k * 0.06); paint(c, '#cfc9be', k * 0.07);
    }
    rr(c, x + w * 0.22, y + k * 0.5, w * 0.56, h * 0.55, k * 0.1); paint(c, T.cloth, k * 0.07);
    poly(c, [x + w * 0.22, y + k * 0.5 + h * 0.55, x + w * 0.5, y + k * 0.5 + h * 0.42, x + w * 0.78, y + k * 0.5 + h * 0.55]);
    c.fillStyle = '#b8b2a8'; c.fill();
  }
  function crownIcon(c, x, y, s, fill) {
    poly(c, [x - s, y + s * 0.5, x - s, y - s * 0.4, x - s * 0.5, y, x, y - s * 0.7, x + s * 0.5, y, x + s, y - s * 0.4, x + s, y + s * 0.5]);
    paint(c, fill || '#ffcf3f', s * 0.22);
  }
  function archerTower(c, k, o) {
    const T = TEAM[o.team];
    ell(c, 0, k * 1.1, k * 1.5, k * 0.45); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
    stoneBlock(c, k, -k * 1.3, -k * 1.25, k * 2.6, k * 2.4, T);
    crownIcon(c, 0, k * 0.15, k * 0.26, '#ffd85a');
    const f = o.face || 1;
    c.save(); c.translate(0, -k * 1.45); c.scale(f, 1);
    poly(c, [-k * 0.28, 0, k * 0.28, 0, k * 0.2, -k * 0.55, -k * 0.2, -k * 0.55]); paint(c, T.dark, k * 0.06);
    c.beginPath(); c.arc(0, -k * 0.62, k * 0.24, Math.PI * 0.85, Math.PI * 2.15); c.closePath(); paint(c, T.main, k * 0.06);
    ell(c, k * 0.05, -k * 0.58, k * 0.13, k * 0.12); paint(c, '#e8b48d', k * 0.04);
    c.beginPath(); c.arc(k * 0.12, -k * 0.35, k * 0.3, -1.1, 1.1); c.strokeStyle = OUT; c.lineWidth = k * 0.09; c.stroke();
    c.strokeStyle = '#a0662f'; c.lineWidth = k * 0.05; c.stroke();
    c.restore();
  }
  function kingTower(c, k, o) {
    const T = TEAM[o.team];
    ell(c, 0, k * 1.55, k * 2.0, k * 0.55); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
    stoneBlock(c, k, -k * 1.75, -k * 1.75, k * 3.5, k * 3.2, T);
    crownIcon(c, 0, k * 0.2, k * 0.42, '#ffd85a');
    const f = o.face || 1;
    c.save(); c.translate(0, -k * 2.0); c.scale(f, 1);
    rr(c, k * 0.25, -k * 0.45, k * 0.75, k * 0.3, k * 0.12); paint(c, '#3a3d48', k * 0.07);
    circ(c, k * 1.0, -k * 0.3, k * 0.12); paint(c, '#1e2028', k * 0.05);
    poly(c, [-k * 0.42, 0, k * 0.42, 0, k * 0.3, -k * 0.6, -k * 0.3, -k * 0.6]); paint(c, T.cloth, k * 0.07);
    circ(c, 0, -k * 0.82, k * 0.3); paint(c, '#f0c29e', k * 0.07);
    c.beginPath(); c.arc(0, -k * 0.75, k * 0.27, 0.15, Math.PI - 0.15); c.closePath(); paint(c, '#8b5a2b', k * 0.05);
    if (o.active) { eye(c, -k * 0.08, -k * 0.88, k * 0.055); eye(c, k * 0.12, -k * 0.88, k * 0.055); }
    else { line(c, -k * 0.14, -k * 0.88, -k * 0.02, -k * 0.88, OUT, k * 0.04); line(c, k * 0.06, -k * 0.88, k * 0.18, -k * 0.88, OUT, k * 0.04); }
    crownIcon(c, 0, -k * 1.18, k * 0.24, '#ffcf3f');
    c.restore();
    if (!o.active) {
      c.font = `${Math.round(k * 0.5)}px "Lilita One", "Arial Black", sans-serif`;
      c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = k * 0.08;
      const z = (o.t || 0) % 2;
      c.globalAlpha = 1 - z / 2;
      c.strokeText('z', k * 0.45, -k * 3.0 - z * k * 0.3); c.fillText('z', k * 0.45, -k * 3.0 - z * k * 0.3);
      c.globalAlpha = 1;
    }
  }
  function rubble(c, k, o) {
    const T = TEAM[o.team], s = o.sub === 'king' ? 1.3 : 1;
    ell(c, 0, k * 0.5 * s, k * 1.4 * s, k * 0.5 * s); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    const rocks = [[-0.8, 0.2, 0.42], [0.2, 0.35, 0.5], [0.85, 0.1, 0.36], [-0.3, -0.25, 0.38], [0.45, -0.3, 0.3], [-0.95, -0.3, 0.26]];
    for (const [x, y, r] of rocks) { ell(c, x * k * s, y * k * s, r * k * s, r * k * s * 0.75); paint(c, '#a39d93', k * 0.07); }
    rr(c, -k * 0.2 * s, -k * 0.45 * s, k * 1.0 * s, k * 0.18, k * 0.05); paint(c, '#7a5232', k * 0.06);
    poly(c, [-k * 0.6 * s, -k * 0.1, -k * 0.1 * s, -k * 0.2, -k * 0.3 * s, k * 0.25]); paint(c, T.cloth, k * 0.05);
  }

  /* ---------- the arena (drawn once per size) ---------- */
  function arena(c, k, B) {
    const S = KCSim, W = S.W, H = S.H, X = x => (x + B) * k, Y = y => (y + B) * k;
    const r = S.mulberry(42);
    c.fillStyle = '#5c5470'; c.fillRect(0, 0, (W + 2 * B) * k, (H + 2 * B) * k);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      c.fillStyle = (x + y) % 2 ? '#7cc653' : '#73bd4b';
      c.fillRect(X(x), Y(y), k + 0.5, k + 0.5);
    }
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H; c.fillRect(X(x), Y(y), k * 0.08, k * 0.22); }
    const path = (x1, y1, x2, y2) => { rr(c, X(x1), Y(y1), (x2 - x1) * k, (y2 - y1) * k, k * 0.5); c.fillStyle = '#d6bf8a'; c.fill(); };
    for (const lx of [3.5, 14.5]) { path(lx - 0.7, 6.5, lx + 0.7, 25.5); }
    path(3.5, 2.3, 14.5, 3.7); path(3.5, 28.3, 14.5, 29.7);
    c.fillStyle = 'rgba(120,90,50,0.18)';
    for (let i = 0; i < 70; i++) { const lx = r() < 0.5 ? 3.5 : 14.5; ell(c, X(lx + (r() - 0.5) * 1.2), Y(7 + r() * 18), k * 0.09, k * 0.06); c.fill(); }
    const pad = (x, y, h) => { rr(c, X(x - h - 0.15), Y(y - h - 0.15), (h * 2 + 0.3) * k, (h * 2 + 0.3) * k, k * 0.35); c.fillStyle = '#9d978d'; c.fill(); c.lineWidth = k * 0.06; c.strokeStyle = 'rgba(0,0,0,0.25)'; c.stroke(); };
    for (const y of [25.5, 6.5]) { pad(3.5, y, 1.5); pad(14.5, y, 1.5); }
    pad(9, 29, 2); pad(9, 3, 2);
    c.fillStyle = '#3d8fe0'; c.fillRect(X(0), Y(S.RIVER_TOP), W * k, 2 * k);
    c.fillStyle = '#2f75c4'; c.fillRect(X(0), Y(S.RIVER_TOP), W * k, k * 0.22); c.fillRect(X(0), Y(S.RIVER_BOT) - k * 0.22, W * k, k * 0.22);
    c.fillStyle = '#5aa63e'; c.fillRect(X(0), Y(S.RIVER_TOP) - k * 0.14, W * k, k * 0.14); c.fillRect(X(0), Y(S.RIVER_BOT), W * k, k * 0.14);
    for (const b of S.BRIDGES) {
      const x0 = X(b - 1.1), w = 2.2 * k, y0 = Y(S.RIVER_TOP - 0.35), h = (2.7) * k;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x0 + k * 0.12, y0 + k * 0.15, w, h);
      rr(c, x0, y0, w, h, k * 0.12); paint(c, '#b47a43', k * 0.07);
      for (let i = 1; i < 7; i++) line(c, x0 + k * 0.1, y0 + (h * i) / 7, x0 + w - k * 0.1, y0 + (h * i) / 7, 'rgba(70,40,20,0.45)', k * 0.04);
      for (const side of [x0, x0 + w - k * 0.2]) { rr(c, side, y0 - k * 0.1, k * 0.2, h + k * 0.2, k * 0.08); paint(c, '#8a5a2e', k * 0.05); }
    }
    const flowers = ['#ffffff', '#ffd54a', '#ff8fb3', '#b68cff'];
    for (let i = 0; i < 44; i++) {
      const x = 0.4 + r() * (W - 0.8), y = 0.4 + r() * (H - 0.8);
      if (Math.abs(x - 3.5) < 2 || Math.abs(x - 14.5) < 2 || (y > 13.8 && y < 18.2) || (Math.abs(x - 9) < 3 && (y < 6 || y > 26))) continue;
      circ(c, X(x), Y(y), k * 0.08); c.fillStyle = flowers[i % 4]; c.fill();
    }
    const wall = (x, y, w, h) => {
      c.fillStyle = '#857c95'; c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(30,20,45,0.45)'; c.lineWidth = k * 0.05;
      const n = Math.max(1, Math.round(Math.max(w, h) / k));
      for (let i = 0; i <= n; i++) {
        if (w > h) { c.beginPath(); c.moveTo(x + (w * i) / n, y); c.lineTo(x + (w * i) / n, y + h); c.stroke(); }
        else { c.beginPath(); c.moveTo(x, y + (h * i) / n); c.lineTo(x + w, y + (h * i) / n); c.stroke(); }
      }
    };
    const fw = (W + 2 * B) * k, fh = (H + 2 * B) * k;
    wall(0, 0, fw, B * k); wall(0, fh - B * k, fw, B * k); wall(0, 0, B * k, fh); wall(fw - B * k, 0, B * k, fh);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(B * k, B * k, W * k, k * 0.2); c.fillRect(B * k, B * k, k * 0.2, H * k);
  }

  /* ---------- card portraits ---------- */
  const RARITY = {
    common: ['#7fb3e8', '#3e6fa8', '#bcd7f2'],
    rare: ['#ffbe5c', '#d9741c', '#ffe1a6'],
  };
  function portrait(cardId, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), card = KC_CARDS[cardId], R = RARITY[card.rarity] || RARITY.common;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, R[0]); g.addColorStop(1, R[1]);
    rr(c, 0, 0, w, h, w * 0.1); c.fillStyle = g; c.fill();
    c.save(); rr(c, 0, 0, w, h, w * 0.1); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath(); c.arc(w * 0.5, h * 0.42, w * 0.42, 0, TAU); c.fill();
    const k = w * 0.42;
    const o = { team: 0, t: 0.3, walk: false, atk: 0, face: 1, id: 1 };
    c.translate(w * 0.5, h * 0.86);
    if (cardId === 'fireball') { c.translate(0, -h * 0.36); fireballArt(c, k * 0.9, 0.4); }
    else if (cardId === 'wolves') {
      c.save(); c.translate(-w * 0.18, -h * 0.12); troop(c, 'wolves', k * 1.1, o); c.restore();
      troop(c, 'wolves', k * 1.35, { ...o, t: 1.1 });
    } else if (cardId === 'hawks') {
      c.save(); c.translate(-w * 0.12, -h * 0.5); troop(c, 'hawks', k * 0.95, { ...o, t: 0.9 }); c.restore();
      c.translate(w * 0.06, -h * 0.25); troop(c, 'hawks', k * 1.2, o);
    } else if (cardId === 'archers') {
      c.save(); c.translate(-w * 0.17, -h * 0.03); troop(c, 'archers', k * 0.85, o); c.restore();
      c.translate(w * 0.12, 0); troop(c, 'archers', k * 0.98, o);
    } else {
      const sc = { rhino: 0.62, gladiator: 0.85, snowman: 0.72, gorilla: 0.7 }[cardId] || 0.8;
      c.translate(cardId === 'rhino' ? -w * 0.08 : cardId === 'gorilla' ? -w * 0.1 : 0, 0);
      troop(c, cardId, k * sc * 1.6, o);
    }
    c.restore();
    rr(c, w * 0.03, w * 0.03, w * 0.94, h - w * 0.06, w * 0.08);
    c.lineWidth = w * 0.045; c.strokeStyle = R[2]; c.stroke();
    return cv;
  }
  function fireballArt(c, k, t) {
    for (let i = 0; i < 5; i++) {
      const a = t * 3 + i;
      circ(c, -k * (0.25 + i * 0.12), k * (0.25 + i * 0.12) + Math.sin(a) * k * 0.03, k * (0.26 - i * 0.04));
      c.fillStyle = `rgba(255,${150 - i * 20},40,${0.65 - i * 0.1})`; c.fill();
    }
    const g = c.createRadialGradient(-k * 0.08, -k * 0.08, k * 0.05, 0, 0, k * 0.45);
    g.addColorStop(0, '#fff6b0'); g.addColorStop(0.45, '#ffb030'); g.addColorStop(1, '#e8461f');
    circ(c, 0, 0, k * 0.42); c.fillStyle = g; c.fill(); c.lineWidth = k * 0.06; c.strokeStyle = '#8a1f10'; c.stroke();
  }

  /* ---------- Trainer Owen ---------- */
  function owen(cv) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, k = w;
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffcf6b'); g.addColorStop(1, '#e98a2b');
    rr(c, 0, 0, w, h, w * 0.14); c.fillStyle = g; c.fill();
    c.save(); rr(c, 0, 0, w, h, w * 0.14); c.clip();
    rr(c, w * 0.12, h * 0.72, w * 0.76, h * 0.5, w * 0.2); paint(c, '#e5414b', k * 0.025);
    rr(c, w * 0.44, h * 0.72, w * 0.12, h * 0.3, w * 0.03); paint(c, '#ffffff');
    line(c, w * 0.36, h * 0.72, w * 0.5, h * 0.9, '#2b2b36', k * 0.018);
    line(c, w * 0.64, h * 0.72, w * 0.5, h * 0.9, '#2b2b36', k * 0.018);
    rr(c, w * 0.45, h * 0.88, w * 0.1, w * 0.06, w * 0.02); paint(c, '#c9ced6', k * 0.015);
    circ(c, w * 0.5, h * 0.47, w * 0.27); paint(c, '#f0c29e', k * 0.025);
    circ(c, w * 0.24, h * 0.5, w * 0.06); paint(c, '#e8b08a', k * 0.02);
    circ(c, w * 0.76, h * 0.5, w * 0.06); paint(c, '#e8b08a', k * 0.02);
    c.beginPath(); c.arc(w * 0.5, h * 0.42, w * 0.29, Math.PI, 0); c.closePath(); paint(c, '#2f7cf6', k * 0.025);
    rr(c, w * 0.42, h * 0.36, w * 0.48, h * 0.07, w * 0.03); paint(c, '#1a4ba8', k * 0.02);
    crownIcon(c, w * 0.5, h * 0.26, w * 0.06, '#ffcf3f');
    eye(c, w * 0.41, h * 0.5, w * 0.04); eye(c, w * 0.59, h * 0.5, w * 0.04);
    c.beginPath(); c.arc(w * 0.5, h * 0.58, w * 0.1, 0.2, Math.PI - 0.2); c.lineWidth = k * 0.022; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = 'rgba(230,110,90,0.35)'; circ(c, w * 0.34, h * 0.58, w * 0.04); c.fill(); circ(c, w * 0.66, h * 0.58, w * 0.04); c.fill();
    c.restore();
  }

  return { OUT, TEAM, troop, archerTower, kingTower, rubble, arena, portrait, fireballArt, crownIcon, owen, rr, circ, ell, line, paint, poly };
})();
