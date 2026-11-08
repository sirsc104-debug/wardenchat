/* Kingdom Clash: everything drawn in code (troops, towers, the arena, card portraits, Trainer Owen).

   The style: chunky shapes, thick dark outlines, flat colours with one darker shade along the
   bottom of each shape. Every troop and tower has two views. Your side is seen from behind (it faces
   up the arena, toward the enemy) and the enemy faces you. Troops are drawn at their feet, at k pixels
   per tile. No image files, so the whole game ships as one page. */
'use strict';

const KCArt = (() => {
  const OUT = '#211d2e';
  const TEAM = [
    { main: '#2f6fe4', sh: '#2255bd', light: '#86b6ff', dark: '#1a4396', cloth: '#2f6fe4' },
    { main: '#dc3640', sh: '#ae232d', light: '#ff9299', dark: '#8c1a23', cloth: '#dc3640' },
  ];
  const C = {
    skin: '#f7c6a0', skinSh: '#e3a47e', gold: '#ffcd33', goldSh: '#e09f12', bronze: '#d39a48', bronzeSh: '#a8712a',
    stone: '#d8d2cb', stoneSh: '#b5aea6', brick: '#b4ada6', brick2: '#aaa39c', mortar: '#7c7680',
    base: '#8a8590', baseSh: '#5f5b66', wood: '#b4733c', woodSh: '#8c5427', white: '#f7f5f0', whiteSh: '#d9d6e0',
  };
  const TAU = Math.PI * 2;
  let LW = 2;

  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
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
  // Fill a shape, shade a crescent along its bottom, then outline it.
  function sh(c, build, base, shade, off) {
    build(); c.fillStyle = shade || base; c.fill();
    if (shade) { c.save(); build(); c.clip(); c.translate(0, -off); build(); c.fillStyle = base; c.fill(); c.restore(); }
    build(); c.lineWidth = LW; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
  }
  // A thick outlined stroke: dark underneath, colour on top.
  function rope(c, build, col, w) {
    build(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = OUT; c.lineWidth = w + LW * 2; c.stroke();
    c.strokeStyle = col; c.lineWidth = w; c.stroke();
  }
  function dot(c, x, y, r, col) { circ(c, x, y, r); c.fillStyle = col || OUT; c.fill(); }
  function crownIcon(c, x, y, s, fill) {
    poly(c, [x - s, y + s * 0.5, x - s, y - s * 0.4, x - s * 0.5, y, x, y - s * 0.7, x + s * 0.5, y, x + s, y - s * 0.4, x + s, y + s * 0.5]);
    paint(c, fill || C.gold, Math.max(1, s * 0.22));
  }
  // The blocky gold crown the kings wear, sitting on a band in the team's colour.
  function kingCrown(c, q, T) {
    sh(c, () => poly(c, [q(-0.44), q(-0.5), q(-0.44), q(-0.95), q(-0.24), q(-0.8), q(-0.24), q(-1.02), q(-0.1), q(-0.85),
      q(0.1), q(-0.85), q(0.24), q(-1.02), q(0.24), q(-0.8), q(0.44), q(-0.95), q(0.44), q(-0.5)]), C.gold, C.goldSh, q(0.1));
    sh(c, () => rr(c, q(-0.46), q(-0.6), q(0.92), q(0.18), q(0.05)), T.main, T.sh, q(0.05));
  }

  /* ---------- troops ---------- */
  const TROOPS = {
    rhino(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 9) * q(0.05) : 0;
      const grey = '#a3aab4', greySh = '#7f8692', front = o.view === 'front';
      const lunge = (front ? 1 : -1) * o.atk * q(0.18);
      for (const [x, ph] of [[-0.5, 1], [0.24, -1]]) sh(c, () => rr(c, q(x), q(-0.36) + st * ph, q(0.26), q(0.36) - st * ph, q(0.08)), '#868d98', '#6a717c', q(0.06));
      c.save(); c.translate(0, lunge);
      if (front) {
        sh(c, () => ell(c, 0, q(-0.62), q(0.8), q(0.46)), grey, greySh, q(0.1));
        sh(c, () => rr(c, q(-0.46), q(-1.1), q(0.92), q(0.3), q(0.13)), C.bronze, C.bronzeSh, q(0.07));
        for (const x of [-0.28, 0.28]) dot(c, q(x), q(-0.96), q(0.05), '#ffe4a8');
        for (const s of [-1, 1]) sh(c, () => poly(c, [s * q(0.3), q(-0.82), s * q(0.52), q(-1.1), s * q(0.52), q(-0.74)]), grey, greySh, q(0.04));
        sh(c, () => ell(c, 0, q(-0.5), q(0.52), q(0.43)), '#b0b7c0', '#8f96a1', q(0.08));
        sh(c, () => ell(c, 0, q(-0.3), q(0.34), q(0.19)), '#c3c9d1', '#a6adb7', q(0.05));
        sh(c, () => poly(c, [q(-0.08), q(-0.74), q(0), q(-0.98), q(0.08), q(-0.74)]), '#f3ead0', '#d4c8a6', q(0.03));
        dot(c, q(-0.11), q(-0.3), q(0.05)); dot(c, q(0.11), q(-0.3), q(0.05));
        sh(c, () => poly(c, [q(-0.16), q(-0.4), q(0.03), q(-1.2), q(0.16), q(-0.4)]), '#f3ead0', '#d4c8a6', q(0.06));
        for (const s of [-1, 1]) {
          circ(c, s * q(0.31), q(-0.6), q(0.085)); paint(c, '#fff', LW * 0.8); dot(c, s * q(0.29), q(-0.58), q(0.045));
          line(c, s * q(0.44), q(-0.75), s * q(0.2), q(-0.69), OUT, LW * 1.2);
        }
      } else {
        for (const s of [-1, 1]) sh(c, () => poly(c, [s * q(0.18), q(-1.0), s * q(0.32), q(-1.24), s * q(0.4), q(-0.96)]), grey, greySh, q(0.03));
        sh(c, () => poly(c, [q(-0.07), q(-1.05), q(0), q(-1.34), q(0.07), q(-1.05)]), '#f3ead0', '#d4c8a6', q(0.03));
        sh(c, () => ell(c, 0, q(-0.6), q(0.78), q(0.5)), grey, greySh, q(0.12));
        sh(c, () => rr(c, q(-0.5), q(-1.12), q(1.0), q(0.44), q(0.16)), C.bronze, C.bronzeSh, q(0.08));
        for (const x of [-0.3, 0, 0.3]) dot(c, q(x), q(-0.9), q(0.05), '#ffe4a8');
        rr(c, q(-0.52), q(-0.74), q(1.04), q(0.1), q(0.04)); paint(c, T.main, LW * 0.8);
        line(c, 0, q(-0.6), 0, q(-0.32), OUT, LW * 1.4);
        sh(c, () => ell(c, 0, q(-0.28), q(0.06), q(0.09)), '#6a717c', null, 0);
      }
      c.restore();
    },

    wolves(c, k, o) {
      const q = v => v * k, st = o.walk ? Math.sin(o.t * 14) * q(0.05) : 0, front = o.view === 'front';
      const fur = '#9ba6b2', furSh = '#76818e', lunge = (front ? 1 : -1) * o.atk * q(0.16);
      for (const [x, ph] of [[-0.18, 1], [0.06, -1]]) sh(c, () => rr(c, q(x), q(-0.26) + st * ph, q(0.12), q(0.26) - st * ph, q(0.05)), '#7d8794', null, 0);
      c.save(); c.translate(0, lunge);
      if (front) {
        sh(c, () => ell(c, 0, q(-0.34), q(0.3), q(0.2)), fur, furSh, q(0.06));
        for (const s of [-1, 1]) {
          sh(c, () => poly(c, [s * q(0.06), q(-0.68), s * q(0.2), q(-0.96), s * q(0.26), q(-0.6)]), fur, furSh, q(0.03));
          poly(c, [s * q(0.12), q(-0.7), s * q(0.19), q(-0.87), s * q(0.22), q(-0.66)]); c.fillStyle = '#f2b6c0'; c.fill();
        }
        sh(c, () => circ(c, 0, q(-0.55), q(0.25)), '#a9b3be', furSh, q(0.05));
        sh(c, () => ell(c, 0, q(-0.44), q(0.15), q(0.12)), C.white, C.whiteSh, q(0.04));
        dot(c, 0, q(-0.5), q(0.055));
        for (const s of [-1, 1]) { circ(c, s * q(0.1), q(-0.6), q(0.05)); paint(c, '#ffd43b', LW * 0.6); dot(c, s * q(0.1), q(-0.6), q(0.022)); }
      } else {
        sh(c, () => ell(c, 0, q(-0.32), q(0.3), q(0.21)), fur, furSh, q(0.06));
        sh(c, () => ell(c, 0, q(-0.44), q(0.09), q(0.22), 0.35 + Math.sin(o.t * 6) * 0.15), '#b7c0ca', furSh, q(0.04));
        sh(c, () => circ(c, 0, q(-0.6), q(0.21)), fur, furSh, q(0.05));
        for (const s of [-1, 1]) sh(c, () => poly(c, [s * q(0.05), q(-0.7), s * q(0.18), q(-0.94), s * q(0.22), q(-0.62)]), fur, furSh, q(0.03));
      }
      c.restore();
    },

    gladiator(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 9) * q(0.05) : 0, front = o.view === 'front';
      const swing = o.atk;
      for (const [x, ph] of [[-0.2, 1], [0.07, -1]]) {
        sh(c, () => rr(c, q(x), q(-0.32) + st * ph, q(0.13), q(0.32) - st * ph, q(0.05)), C.skin, null, 0);
        rr(c, q(x - 0.02), q(-0.08), q(0.17), q(0.08), q(0.03)); paint(c, '#7a4a28', LW * 0.6);
      }
      const shield = side => {
        sh(c, () => circ(c, side * q(0.3), q(-0.62), q(0.3)), C.wood, C.woodSh, q(0.07));
        circ(c, side * q(0.3), q(-0.62), q(0.26)); c.strokeStyle = C.gold; c.lineWidth = q(0.06); c.stroke();
        sh(c, () => circ(c, side * q(0.3), q(-0.62), q(0.1)), T.light, T.main, q(0.03));
      };
      const sword = (side, rot) => {
        c.save(); c.translate(side * q(0.34), q(-0.8)); c.rotate(rot);
        sh(c, () => rr(c, q(-0.045), q(-0.62), q(0.09), q(0.55), q(0.04)), '#eef2f7', '#c3ccd8', q(0.04));
        sh(c, () => rr(c, q(-0.13), q(-0.1), q(0.26), q(0.07), q(0.03)), C.gold, null, 0);
        circ(c, 0, q(0.02), q(0.07)); paint(c, C.skin, LW * 0.7);
        c.restore();
      };
      if (!front) shield(-1);
      sh(c, () => poly(c, [q(-0.3), q(-0.52), q(0.3), q(-0.52), q(0.36), q(-0.24), q(-0.36), q(-0.24)]), T.main, T.sh, q(0.05));
      for (const x of [-0.16, 0, 0.16]) line(c, q(x), q(-0.5), q(x * 1.15), q(-0.27), T.dark, LW * 0.7);
      if (front) {
        sh(c, () => rr(c, q(-0.28), q(-0.94), q(0.56), q(0.46), q(0.18)), C.skin, C.skinSh, q(0.06));
        line(c, q(-0.22), q(-0.9), q(0.2), q(-0.58), '#7a4a28', q(0.07));
        sword(-1, -0.5 + swing * 1.7);
      } else {
        sh(c, () => poly(c, [q(-0.3), q(-0.96), q(0.3), q(-0.96), q(0.38), q(-0.3), q(-0.38), q(-0.3)]), T.main, T.sh, q(0.06));
        sword(1, 0.5 - swing * 1.7);
      }
      sh(c, () => rr(c, q(-0.31), q(-0.58), q(0.62), q(0.09), q(0.03)), C.gold, null, 0);
      if (front) {
        sh(c, () => circ(c, 0, q(-1.18), q(0.3)), C.skin, C.skinSh, q(0.05));
        sh(c, () => { c.beginPath(); c.arc(0, q(-1.2), q(0.33), Math.PI, 0); c.lineTo(q(0.33), q(-1.14)); c.lineTo(q(-0.33), q(-1.14)); c.closePath(); }, C.bronze, C.bronzeSh, q(0.05));
        for (const s of [-1, 1]) sh(c, () => rr(c, s > 0 ? q(0.2) : q(-0.34), q(-1.18), q(0.14), q(0.26), q(0.05)), C.bronze, C.bronzeSh, q(0.03));
        dot(c, q(-0.09), q(-1.08), q(0.04)); dot(c, q(0.09), q(-1.08), q(0.04));
        line(c, q(-0.06), q(-0.97), q(0.06), q(-0.97), OUT, LW * 0.9);
      } else {
        sh(c, () => circ(c, 0, q(-1.18), q(0.32)), C.bronze, C.bronzeSh, q(0.07));
        line(c, q(-0.24), q(-1.02), q(0.24), q(-1.02), C.bronzeSh, LW);
      }
      sh(c, () => ell(c, 0, q(-1.58), q(0.1), q(0.24)), T.main, T.sh, q(0.05));
      if (front) shield(1);
    },

    hawks(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 13 + (o.id || 0)), front = o.view === 'front';
      c.save(); c.translate(0, (front ? 1 : -1) * o.atk * q(0.25));
      for (const s of [-1, 1]) {
        c.save(); c.scale(s, 1); c.translate(q(0.15), q(-0.08)); c.rotate(-0.15 - flap * 0.45);
        const wingPath = () => {
          c.beginPath(); c.moveTo(0, 0);
          c.quadraticCurveTo(q(0.3), q(-0.42), q(0.72), q(-0.34));
          c.lineTo(q(0.64), q(-0.22)); c.lineTo(q(0.7), q(-0.12)); c.lineTo(q(0.54), q(-0.06));
          c.lineTo(q(0.57), q(0.05)); c.lineTo(q(0.38), q(0.05));
          c.quadraticCurveTo(q(0.16), q(0.13), 0, q(0.12)); c.closePath();
        };
        sh(c, wingPath, '#946139', '#734624', q(0.06));
        c.save(); wingPath(); c.clip();
        poly(c, [q(0.5), q(-0.5), q(0.9), q(-0.5), q(0.9), q(0.2), q(0.5), q(0.2)]); c.fillStyle = T.main; c.fill();
        c.restore();
        wingPath(); c.lineWidth = LW; c.strokeStyle = OUT; c.stroke();
        c.restore();
      }
      if (!front) {
        sh(c, () => poly(c, [q(-0.12), q(0.2), q(0.12), q(0.2), q(0.2), q(0.48), q(0), q(0.42), q(-0.2), q(0.48)]), '#8a5a34', '#6c4222', q(0.04));
      }
      sh(c, () => ell(c, 0, q(0.02), q(0.23), q(0.3)), '#97653d', '#77492a', q(0.06));
      if (front) {
        sh(c, () => ell(c, 0, q(0.1), q(0.14), q(0.18)), '#ecd8b2', '#d1b98e', q(0.04));
        for (const s of [-1, 1]) line(c, s * q(0.08), q(0.3), s * q(0.1), q(0.42), '#f2b824', q(0.05));
      }
      sh(c, () => circ(c, 0, q(-0.3), q(0.2)), C.white, C.whiteSh, q(0.04));
      if (front) {
        for (const s of [-1, 1]) { dot(c, s * q(0.08), q(-0.33), q(0.035)); line(c, s * q(0.15), q(-0.43), s * q(0.03), q(-0.39), OUT, LW * 0.9); }
        sh(c, () => poly(c, [q(-0.07), q(-0.27), q(0.07), q(-0.27), q(0), q(-0.12)]), '#ffc52e', '#e09f12', q(0.03));
      }
      c.restore();
    },

    archers(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 9) * q(0.05) : 0, front = o.view === 'front';
      for (const [x, ph] of [[-0.17, 1], [0.05, -1]]) sh(c, () => rr(c, q(x), q(-0.32) + st * ph, q(0.12), q(0.32) - st * ph, q(0.05)), '#4d3c30', null, 0);
      c.save(); c.translate(0, q(-0.3));
      archerUpper(c, q, T, front, o.face || 1, o.atk, 0.82);
      c.restore();
    },

    snowman(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], bob = o.walk ? Math.abs(Math.sin(o.t * 7)) * q(0.05) : 0, front = o.view === 'front';
      const th = o.atk, snow = '#f9fbff', snowSh = '#cddcf0';
      sh(c, () => circ(c, 0, q(-0.36), q(0.37)), snow, snowSh, q(0.09));
      c.save(); c.translate(0, -bob);
      const arm = (s, raise) => {
        const ax = s * q(0.52 + raise * 0.05), ay = q(-0.98 - raise * 0.42);
        rope(c, () => { c.beginPath(); c.moveTo(s * q(0.2), q(-0.92)); c.lineTo(ax, ay); }, '#7a4b2a', q(0.05));
        rope(c, () => { c.beginPath(); c.moveTo(s * q(0.42), q(-0.95 - raise * 0.33)); c.lineTo(s * q(0.48), q(-1.12 - raise * 0.3)); }, '#7a4b2a', q(0.035));
        return [ax, ay];
      };
      arm(-1, 0);
      const [hx, hy] = arm(1, th);
      sh(c, () => circ(c, 0, q(-0.92), q(0.28)), snow, snowSh, q(0.07));
      if (front) for (const y of [-0.84, -1.0]) dot(c, 0, q(y), q(0.035));
      sh(c, () => circ(c, 0, q(-1.32), q(0.22)), snow, snowSh, q(0.05));
      sh(c, () => rr(c, q(-0.25), q(-1.18), q(0.5), q(0.11), q(0.05)), T.main, T.sh, q(0.03));
      const tailX = front ? q(0.08) : q(-0.14);
      sh(c, () => rr(c, tailX, q(-1.14), q(0.1), q(0.3), q(0.04)), T.main, T.sh, q(0.03));
      if (front) {
        dot(c, q(-0.08), q(-1.37), q(0.035)); dot(c, q(0.08), q(-1.37), q(0.035));
        sh(c, () => poly(c, [q(-0.03), q(-1.32), q(0.03), q(-1.32), q(0.16), q(-1.22)]), '#ff8c2a', '#e06a10', q(0.02));
        for (const x of [-0.07, 0, 0.07]) dot(c, q(x), q(-1.21) + Math.abs(x) * q(-0.3), q(0.02));
      }
      sh(c, () => rr(c, q(-0.22), q(-1.54), q(0.44), q(0.07), q(0.03)), '#2a2836', null, 0);
      sh(c, () => rr(c, q(-0.14), q(-1.84), q(0.28), q(0.32), q(0.05)), '#2a2836', '#1c1a26', q(0.04));
      rr(c, q(-0.14), q(-1.62), q(0.28), q(0.06), 0); c.fillStyle = T.main; c.fill();
      if (th < 0.6) sh(c, () => circ(c, hx, hy - q(0.04), q(0.13)), snow, snowSh, q(0.03));
      c.restore();
    },

    gorilla(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 8) * q(0.05) : 0, front = o.view === 'front';
      const fur = '#454955', furSh = '#30333c', sm = o.atk;
      for (const [x, ph] of [[-0.36, 1], [0.1, -1]]) sh(c, () => rr(c, q(x), q(-0.32) + st * ph, q(0.26), q(0.32) - st * ph, q(0.1)), '#3a3d47', null, 0);
      sh(c, () => ell(c, 0, q(-0.8), q(0.54), q(0.5)), fur, furSh, q(0.1));
      if (front) sh(c, () => ell(c, 0, q(-0.74), q(0.32), q(0.3)), '#5f6370', '#4b4f5b', q(0.05));
      else sh(c, () => ell(c, 0, q(-0.86), q(0.34), q(0.26)), '#a6acb6', '#868c97', q(0.06));
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * q(0.48), q(-1.0)); c.rotate(s * (0.14 - sm * 2.5) + s * st / k * 0.6);
        sh(c, () => rr(c, q(-0.14), 0, q(0.28), q(0.9), q(0.14)), fur, furSh, q(0.06));
        sh(c, () => ell(c, 0, q(0.92), q(0.18), q(0.13)), '#6d5c50', '#56473d', q(0.04));
        c.restore();
      }
      sh(c, () => circ(c, 0, q(-1.28), q(0.3)), fur, furSh, q(0.06));
      if (front) {
        sh(c, () => ell(c, 0, q(-1.2), q(0.23), q(0.2)), '#a58d78', '#86705e', q(0.04));
        sh(c, () => rr(c, q(-0.23), q(-1.4), q(0.46), q(0.1), q(0.04)), furSh, null, 0);
        dot(c, q(-0.08), q(-1.29), q(0.035), '#ffd43b'); dot(c, q(0.08), q(-1.29), q(0.035), '#ffd43b');
        dot(c, q(-0.05), q(-1.15), q(0.025)); dot(c, q(0.05), q(-1.15), q(0.025));
        line(c, q(-0.07), q(-1.08), q(0.07), q(-1.08), OUT, LW * 0.9);
      }
      rr(c, q(-0.3), q(-0.36), q(0.6), q(0.08), q(0.03)); paint(c, T.main, LW * 0.7);
    },
  };

  // The upper half of an archer (hood, cloak, bow), shared by the Archers card and the Archer Towers.
  // Its origin is the waist.
  function archerUpper(c, q, T, front, face, draw, sc) {
    c.save(); c.scale(sc, sc);
    const bow = () => {
      c.save(); c.scale(face, 1);
      rope(c, () => { c.beginPath(); c.arc(q(0.3), q(-0.62), q(0.42), -1.15, 1.15); }, '#9a5d2a', q(0.07));
      const ex = q(0.3) + Math.cos(1.15) * q(0.42), ey = Math.sin(1.15) * q(0.42), pull = q(0.06 + draw * 0.14);
      c.beginPath(); c.moveTo(ex, q(-0.62) - ey); c.lineTo(q(0.3) + q(0.42) * Math.cos(1.15) - pull, q(-0.62)); c.lineTo(ex, q(-0.62) + ey);
      c.strokeStyle = '#f3f0e6'; c.lineWidth = Math.max(1, q(0.025)); c.stroke();
      if (front) {
        rope(c, () => { c.beginPath(); c.moveTo(q(0.42) - pull, q(-0.62)); c.lineTo(q(0.95), q(-0.62)); }, '#8a5a2e', q(0.035));
        poly(c, [q(1.04), q(-0.62), q(0.92), q(-0.69), q(0.92), q(-0.55)]); paint(c, '#dfe5ec', LW * 0.8);
        circ(c, q(0.72), q(-0.62), q(0.08)); paint(c, C.skin, LW * 0.8);
      }
      c.restore();
    };
    const quiver = (x, rot) => {
      c.save(); c.translate(q(x), q(-0.62)); c.rotate(rot);
      for (const [fx, fy] of [[-0.05, -0.42], [0.04, -0.46], [0.12, -0.4]]) { poly(c, [q(fx), q(fy), q(fx + 0.06), q(fy - 0.12), q(fx + 0.12), q(fy)]); paint(c, '#f3f0e6', LW * 0.6); }
      sh(c, () => rr(c, q(-0.1), q(-0.36), q(0.26), q(0.5), q(0.06)), '#8b5a2f', '#6b4220', q(0.04));
      c.restore();
    };
    if (front) quiver(-0.3, -0.45);
    else bow();
    sh(c, () => poly(c, [q(-0.34), 0, q(0.34), 0, q(0.26), q(-0.62), q(-0.26), q(-0.62)]), T.main, T.sh, q(0.06));
    sh(c, () => rr(c, q(-0.31), q(-0.18), q(0.62), q(0.08), q(0.03)), C.gold, null, 0);
    if (!front) quiver(-0.12, -0.3);
    sh(c, () => circ(c, 0, q(-0.88), q(0.36)), T.main, T.sh, q(0.07));
    if (front) {
      sh(c, () => ell(c, q(0.02) * face, q(-0.82), q(0.24), q(0.21)), C.skin, C.skinSh, q(0.04));
      rope(c, () => { c.beginPath(); c.arc(q(0.02) * face, q(-0.82), q(0.26), Math.PI * 1.1, Math.PI * 1.9); }, C.gold, q(0.06));
      dot(c, q(-0.08) + q(0.03) * face, q(-0.82), q(0.04)); dot(c, q(0.08) + q(0.03) * face, q(-0.82), q(0.04));
      bow();
    } else {
      rope(c, () => { c.beginPath(); c.arc(0, q(-0.88), q(0.31), Math.PI * 0.22, Math.PI * 0.78); }, C.gold, q(0.06));
    }
    c.restore();
  }

  function troop(c, card, k, o) {
    const f = TROOPS[card];
    if (!f) return;
    LW = Math.max(1, k * 0.07);
    o.view = o.view || (o.team === 0 ? 'back' : 'front');
    f(c, k, o);
  }

  /* ---------- towers ---------- */
  // g: the tower's shape in tiles, centred on its footprint.
  const ARCHER_T = { bw: 1.45, b0: 0.62, b1: 1.14, w0: 1.27, w1: 1.1, y0: 0.72, y1: -0.92, pw: 1.45, p0: -1.52, p1: -0.86,
    m0: -1.9, merlons: [[-1.42, -0.86], [-0.28, 0.28], [0.86, 1.42]], fig: -1.52, banner: [-0.6, -0.8, 0.6, 0.45, 0.22], crown: [-0.2, 0.28] };
  const KING_T = { bw: 1.95, b0: 0.9, b1: 1.5, w0: 1.75, w1: 1.55, y0: 1.0, y1: -1.0, pw: 1.95, p0: -1.55, p1: -0.92,
    m0: -1.95, merlons: [[-1.9, -1.32], [-0.92, -0.5], [0.5, 0.92], [1.32, 1.9]], fig: -1.55, banner: [-0.85, -0.85, 0.85, 0.75, 0.3], crown: [-0.12, 0.36], knobs: true };

  function towerBase(c, k, g) {
    const q = v => v * k;
    ell(c, 0, q(g.b1 - 0.05), q(g.bw * 1.08), q(0.42)); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
    sh(c, () => rr(c, q(-g.bw), q(g.b0), q(g.bw * 2), q(g.b1 - g.b0), q(0.2)), C.base, C.baseSh, q(0.2));
    const body = () => poly(c, [q(-g.w0), q(g.y0), q(g.w0), q(g.y0), q(g.w1), q(g.y1), q(-g.w1), q(g.y1)]);
    body(); c.fillStyle = C.mortar; c.fill();
    c.save(); body(); c.clip();
    const rowH = q(0.36), bw = q(0.68), gap = Math.max(1, q(0.05));
    for (let r = 0, y = q(g.y1); y < q(g.y0); r++, y += rowH) {
      for (let x = -q(g.w0) - (r % 2 ? bw / 2 : 0); x < q(g.w0); x += bw) {
        rr(c, x + gap / 2, y + gap / 2, bw - gap, rowH - gap, q(0.05)); c.fillStyle = (r + Math.round(x / bw)) % 3 ? C.brick : C.brick2; c.fill();
      }
    }
    c.fillStyle = 'rgba(30,20,40,0.16)'; c.fillRect(q(g.w0 * 0.55), q(g.y1), q(g.w0), q(g.y0 - g.y1));
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(-q(g.w0), q(g.y1), q(g.w0 * 0.35), q(g.y0 - g.y1));
    c.restore();
    body(); c.lineWidth = LW; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
  }
  function towerBanner(c, k, g, T) {
    const q = v => v * k, [x0, y0, x1, y1, n] = g.banner;
    sh(c, () => poly(c, [q(x0), q(y0), q(x1), q(y0), q(x1), q(y1), q((x0 + x1) / 2), q(y1 - n), q(x0), q(y1)]), T.main, T.sh, q(0.14));
    rr(c, q(x0), q(y0), q(x1 - x0), q(0.12), 0); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
    crownIcon(c, 0, q(g.crown[0]), q(g.crown[1]), C.gold);
    if (g.knobs) for (const x of [x0, x1]) sh(c, () => circ(c, q(x), q(y0 + 0.02), q(0.16)), C.gold, C.goldSh, q(0.04));
  }
  function towerTop(c, k, g) {
    const q = v => v * k;
    for (const [a, b] of g.merlons) sh(c, () => rr(c, q(a), q(g.m0), q(b - a), q(g.p0 - g.m0 + 0.15), q(0.12)), C.stone, C.stoneSh, q(0.1));
    sh(c, () => rr(c, q(-g.pw), q(g.p0), q(g.pw * 2), q(g.p1 - g.p0), q(0.18)), C.stone, C.stoneSh, q(0.18));
  }
  function archerTower(c, k, o) {
    LW = Math.max(1, k * 0.075);
    const T = TEAM[o.team], g = ARCHER_T, front = (o.view || (o.team === 0 ? 'back' : 'front')) === 'front', q = v => v * k;
    towerBase(c, k, g);
    if (front) towerBanner(c, k, g, T);
    c.save(); c.translate(0, q(g.fig + 0.12));
    archerUpper(c, q, T, front, o.face || 1, o.atk || 0, 1.02);
    c.restore();
    towerTop(c, k, g);
  }
  function kingTower(c, k, o) {
    LW = Math.max(1, k * 0.075);
    const T = TEAM[o.team], g = KING_T, front = (o.view || (o.team === 0 ? 'back' : 'front')) === 'front', q = v => v * k;
    towerBase(c, k, g);
    if (front) towerBanner(c, k, g, T);
    c.save(); c.translate(0, q(g.fig + 0.1));
    if (front) {
      sh(c, () => rr(c, q(-0.8), q(-0.78), q(1.6), q(1.0), q(0.4)), T.main, T.sh, q(0.12));
      for (const s of [-1, 1]) sh(c, () => rr(c, s * q(0.36) - q(0.07), q(-0.76), q(0.14), q(0.8), q(0.05)), C.gold, null, 0);
      sh(c, () => circ(c, 0, q(-0.5), q(0.13)), C.gold, C.goldSh, q(0.03));
      for (const s of [-1, 1]) sh(c, () => circ(c, s * q(0.44), q(-1.14), q(0.1)), C.skin, null, 0);
      sh(c, () => circ(c, 0, q(-1.2), q(0.44)), C.skin, C.skinSh, q(0.06));
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.42), q(-1.12)); c.quadraticCurveTo(q(-0.44), q(-0.7), 0, q(-0.62)); c.quadraticCurveTo(q(0.44), q(-0.7), q(0.42), q(-1.12)); c.quadraticCurveTo(0, q(-0.92), q(-0.42), q(-1.12)); c.closePath(); }, C.white, C.whiteSh, q(0.05));
      for (const s of [-1, 1]) sh(c, () => ell(c, s * q(0.12), q(-1.03), q(0.13), q(0.06), s * 0.25), C.white, null, 0);
      sh(c, () => circ(c, 0, q(-1.12), q(0.07)), '#f0b18a', null, 0);
      if (o.active) { dot(c, q(-0.16), q(-1.26), q(0.05)); dot(c, q(0.16), q(-1.26), q(0.05)); }
      else for (const s of [-1, 1]) { c.beginPath(); c.arc(s * q(0.16), q(-1.28), q(0.06), 0.2, Math.PI - 0.2); c.strokeStyle = OUT; c.lineWidth = LW; c.stroke(); }
      for (const s of [-1, 1]) line(c, s * q(0.27), q(-1.42), s * q(0.08), q(-1.38), OUT, LW * 0.9);
    } else {
      for (const s of [-1, 1]) sh(c, () => circ(c, s * q(0.45), q(-1.15), q(0.1)), C.skin, null, 0);
      sh(c, () => rr(c, q(-0.82), q(-0.8), q(1.64), q(1.05), q(0.42)), T.main, T.sh, q(0.12));
      c.save(); rr(c, q(-0.82), q(-0.8), q(1.64), q(1.05), q(0.42)); c.clip();
      sh(c, () => rr(c, q(-0.9), q(-0.56), q(1.8), q(0.14), 0), C.gold, null, 0);
      c.restore();
      sh(c, () => circ(c, 0, q(-1.2), q(0.44)), '#7d4c2b', '#5e381f', q(0.08));
    }
    c.save(); c.translate(0, q(-1.0)); kingCrown(c, q, T); c.restore();
    c.restore();
    towerTop(c, k, g);
    if (!o.active) {
      c.font = `${Math.round(k * 0.55)}px "Lilita One", "Arial Black", sans-serif`;
      c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = k * 0.09;
      const z = ((o.t || 0) % 2) / 2;
      c.globalAlpha = 1 - z;
      c.strokeText('z', q(0.7), q(-3.0 - z * 0.4)); c.fillText('z', q(0.7), q(-3.0 - z * 0.4));
      c.globalAlpha = 1;
    }
  }
  function rubble(c, k, o) {
    LW = Math.max(1, k * 0.075);
    const T = TEAM[o.team], king = o.sub === 'king', g = king ? KING_T : ARCHER_T, q = v => v * k;
    ell(c, 0, q(g.b1 - 0.05), q(g.bw * 1.08), q(0.42)); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
    sh(c, () => rr(c, q(-g.bw), q(g.b0), q(g.bw * 2), q(g.b1 - g.b0), q(0.2)), C.base, C.baseSh, q(0.2));
    const top = g.y0 - 0.75;
    sh(c, () => poly(c, [q(-g.w0), q(g.y0), q(g.w0), q(g.y0), q(g.w0 * 0.97), q(top + 0.1), q(g.w0 * 0.5), q(top - 0.15), q(g.w0 * 0.2), q(top + 0.12),
      q(-g.w0 * 0.2), q(top - 0.2), q(-g.w0 * 0.6), q(top + 0.05), q(-g.w0 * 0.97), q(top - 0.05)]), C.brick, C.mortar, q(0.12));
    const rocks = [[-0.9, 0.55, 0.32], [0.95, 0.6, 0.28], [-0.35, 0.82, 0.24], [0.4, 0.86, 0.3], [1.25, 0.95, 0.2], [-1.25, 0.95, 0.22]];
    for (const [x, y, r] of rocks) sh(c, () => ell(c, q(x * (king ? 1.3 : 1)), q(y + (king ? 0.25 : 0)), q(r), q(r * 0.75)), C.stone, C.stoneSh, q(0.06));
    sh(c, () => poly(c, [q(-0.55), q(top + 0.1), q(0.15), q(top + 0.02), q(-0.05), q(top + 0.55), q(-0.35), q(top + 0.4)]), T.main, T.sh, q(0.05));
  }

  /* ---------- card portraits (the front view) ---------- */
  const RARITY = {
    common: ['#8cc0f0', '#3f72b0', '#d4e8ff'],
    rare: ['#ffc463', '#dc761c', '#ffe7b3'],
  };
  function portrait(cardId, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), card = KC_CARDS[cardId], R = RARITY[card.rarity] || RARITY.common;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, R[0]); g.addColorStop(1, R[1]);
    rr(c, 0, 0, w, h, w * 0.1); c.fillStyle = g; c.fill();
    c.save(); rr(c, 0, 0, w, h, w * 0.1); c.clip();
    const glow = c.createRadialGradient(w * 0.5, h * 0.42, w * 0.05, w * 0.5, h * 0.42, w * 0.6);
    glow.addColorStop(0, 'rgba(255,255,255,0.45)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow; c.fillRect(0, 0, w, h);
    ell(c, w * 0.5, h * 0.86, w * 0.42, h * 0.07); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill();
    const k = w * 0.42;
    const o = { team: 0, t: 0.3, walk: false, atk: 0, face: 1, id: 1, view: 'front' };
    const at = (x, y, s, oo) => { c.save(); c.translate(w * x, h * y); troop(c, cardId, k * s, Object.assign({}, o, oo)); c.restore(); };
    if (cardId === 'fireball') { c.save(); c.translate(w * 0.54, h * 0.46); LW = Math.max(1, k * 0.07); fireballArt(c, k * 1.0, 0.4); c.restore(); }
    else if (cardId === 'wolves') { at(0.26, 0.7, 1.6, { t: 1.1 }); at(0.74, 0.7, 1.6, {}); at(0.5, 0.9, 2.0, { t: 0.6 }); }
    else if (cardId === 'hawks') { at(0.3, 0.34, 1.1, { t: 0.9 }); at(0.58, 0.62, 1.45, {}); }
    else if (cardId === 'archers') { at(0.3, 0.86, 1.2, {}); at(0.64, 0.92, 1.35, { face: 1 }); }
    else {
      const sc = { rhino: 1.6, gladiator: 1.5, snowman: 1.32, gorilla: 1.45 }[cardId] || 1;
      at(0.5, cardId === 'rhino' ? 0.86 : 0.92, sc, {});
    }
    c.restore();
    rr(c, w * 0.025, w * 0.025, w * 0.95, h - w * 0.05, w * 0.085);
    c.lineWidth = w * 0.04; c.strokeStyle = R[2]; c.stroke();
    return cv;
  }
  function fireballArt(c, k, t) {
    for (let i = 4; i >= 0; i--) {
      const a = t * 3 + i;
      circ(c, -k * (0.22 + i * 0.13), k * (0.22 + i * 0.13) + Math.sin(a) * k * 0.03, k * (0.27 - i * 0.04));
      c.fillStyle = `rgba(255,${160 - i * 22},40,${0.75 - i * 0.12})`; c.fill();
    }
    const g = c.createRadialGradient(-k * 0.1, -k * 0.1, k * 0.04, 0, 0, k * 0.44);
    g.addColorStop(0, '#fff6b8'); g.addColorStop(0.45, '#ffb22e'); g.addColorStop(1, '#ea4a1c');
    circ(c, 0, 0, k * 0.42); c.fillStyle = g; c.fill(); c.lineWidth = Math.max(1.5, k * 0.07); c.strokeStyle = '#7a1c0e'; c.stroke();
    circ(c, -k * 0.14, -k * 0.16, k * 0.1); c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
  }
  const eye = (c, x, y, r) => { circ(c, x, y, r); paint(c, '#fff', r * 0.5); circ(c, x + r * 0.25, y, r * 0.5); paint(c, OUT); };

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
