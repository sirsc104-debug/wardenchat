/* Kingdom Clash: everything drawn in code (troops, towers, the arena, card portraits, the trainers).

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
      if (o.evo) {
        // evolved: an ice crown over the hat, frost shards on the shoulders, glowing eyes
        // an ice crown on the hat
        for (const [x, h] of [[-0.2, 0.26], [0, 0.4], [0.2, 0.26]]) sh(c, () => poly(c, [q(x - 0.13), q(-1.86), q(x), q(-1.88 - h), q(x + 0.13), q(-1.86)]), '#e6f8ff', '#a8e2f8', q(0.03));
        sh(c, () => rr(c, q(-0.32), q(-1.92), q(0.64), q(0.14), q(0.05)), '#bdeeff', '#8fd0f0', q(0.03));
        dot(c, 0, q(-1.85), q(0.05), '#b48cff');
        for (const d of [-1, 1]) sh(c, () => poly(c, [d * q(0.18), q(-1.06), d * q(0.5), q(-1.34), d * q(0.38), q(-0.98)]), '#e2ccff', '#b48cff', q(0.02));
        if (front) { dot(c, q(-0.08), q(-1.37), q(0.05), '#7ff0ff'); dot(c, q(0.08), q(-1.37), q(0.05), '#7ff0ff'); }
      }
      if (th < 0.6) sh(c, () => circ(c, hx, hy - q(0.04), q(o.evo ? 0.2 : 0.13)), snow, snowSh, q(0.03));
      c.restore();
    },

    skeletons(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 14) * q(0.05) : 0, front = o.view === 'front';
      const bone = '#f3efe4', boneSh = '#cfc8b8', swing = o.atk;
      for (const [x, ph] of [[-0.1, 1], [0.1, -1]]) rope(c, () => { c.beginPath(); c.moveTo(q(x * 0.7), q(-0.3)); c.lineTo(q(x) , -st * ph); }, bone, q(0.06));
      sh(c, () => ell(c, 0, q(-0.3), q(0.12), q(0.06)), bone, boneSh, q(0.02));
      rope(c, () => { c.beginPath(); c.moveTo(0, q(-0.3)); c.lineTo(0, q(-0.5)); }, bone, q(0.05));
      sh(c, () => rr(c, q(-0.15), q(-0.62), q(0.3), q(0.2), q(0.07)), bone, boneSh, q(0.03));
      for (const y of [-0.56, -0.5]) line(c, q(-0.11), q(y), q(0.11), q(y), boneSh, LW * 0.8);
      const arm = (sx, up) => rope(c, () => { c.beginPath(); c.moveTo(sx * q(0.14), q(-0.58)); c.lineTo(sx * q(0.27), q(-0.42 - up * 0.3)); }, bone, q(0.05));
      arm(-1, 0); arm(1, swing);
      // a little bone club in the right hand
      c.save(); c.translate(q(0.27), q(-0.42 - swing * 0.3)); c.rotate(-0.6 + swing * 1.4);
      sh(c, () => rr(c, q(-0.03), q(-0.26), q(0.06), q(0.26), q(0.03)), bone, boneSh, q(0.02));
      sh(c, () => circ(c, 0, q(-0.27), q(0.055)), bone, null, 0);
      c.restore();
      sh(c, () => circ(c, 0, q(-0.84), q(0.22)), bone, boneSh, q(0.05));
      if (front) {
        sh(c, () => rr(c, q(-0.12), q(-0.72), q(0.24), q(0.1), q(0.04)), bone, boneSh, q(0.02));
        for (const x of [-0.06, 0, 0.06]) line(c, q(x), q(-0.72), q(x), q(-0.63), boneSh, LW * 0.6);
        for (const s2 of [-1, 1]) { ell(c, s2 * q(0.085), q(-0.86), q(0.06), q(0.065)); c.fillStyle = '#2a2236'; c.fill(); dot(c, s2 * q(0.085), q(-0.86), q(0.018), '#ffd43b'); }
        poly(c, [q(-0.02), q(-0.77), q(0.02), q(-0.77), 0, q(-0.8)]); c.fillStyle = '#2a2236'; c.fill();
      } else {
        line(c, 0, q(-0.98), 0, q(-0.72), boneSh, LW);
      }
      sh(c, () => rr(c, q(-0.23), q(-1.01), q(0.46), q(0.09), q(0.04)), T.main, T.sh, q(0.02));
      if (!front) for (const sx of [-1, 1]) sh(c, () => poly(c, [0, q(-0.97), sx * q(0.1), q(-0.82), sx * q(0.03), q(-0.8)]), T.main, T.sh, q(0.02));
    },

    // Footmen: four armored soldiers with a kettle helmet, mail, a team tabard, a short sword and a buckler.
    footmen(c, k, o) {
      const q = v => v * k * 0.9, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 10) * q(0.05) : 0, front = o.view === 'front';
      const steel = '#c7cfda', steelSh = '#8f99a8', mail = '#9aa3b0', swing = o.atk;
      for (const [x, ph] of [[-0.19, 1], [0.06, -1]]) {
        sh(c, () => rr(c, q(x), q(-0.3) + st * ph, q(0.13), q(0.3) - st * ph, q(0.05)), '#5a5f6b', null, 0);
        rr(c, q(x - 0.02), q(-0.07), q(0.17), q(0.07), q(0.03)); paint(c, '#3a3d46', LW * 0.6);
      }
      const buckler = side => {
        sh(c, () => circ(c, side * q(0.3), q(-0.62), q(0.2)), steel, steelSh, q(0.05));
        circ(c, side * q(0.3), q(-0.62), q(0.07)); paint(c, T.main, LW * 0.6);
      };
      const sword = (side, rot) => {
        c.save(); c.translate(side * q(0.32), q(-0.74)); c.rotate(rot);
        sh(c, () => rr(c, q(-0.04), q(-0.5), q(0.08), q(0.44), q(0.03)), '#eef2f7', '#c3ccd8', q(0.03));
        sh(c, () => rr(c, q(-0.11), q(-0.08), q(0.22), q(0.06), q(0.02)), '#6b6f7a', null, 0);
        circ(c, 0, q(0.02), q(0.06)); paint(c, '#7a5a44', LW * 0.6);
        c.restore();
      };
      if (!front) buckler(-1);
      // mail shirt and tabard
      sh(c, () => rr(c, q(-0.28), q(-0.9), q(0.56), q(0.62), q(0.16)), mail, '#7d8694', q(0.06));
      sh(c, () => poly(c, [q(-0.17), q(-0.86), q(0.17), q(-0.86), q(0.2), q(-0.3), q(-0.2), q(-0.3)]), T.main, T.sh, q(0.05));
      if (front) { sh(c, () => rr(c, q(-0.07), q(-0.74), q(0.14), q(0.3), q(0.04)), C.gold, null, 0); }
      sh(c, () => rr(c, q(-0.29), q(-0.42), q(0.58), q(0.08), q(0.03)), '#5d4030', null, 0);
      if (front) sword(-1, -0.45 + swing * 1.7); else sword(1, 0.45 - swing * 1.7);
      // head and kettle helmet
      if (front) {
        sh(c, () => circ(c, 0, q(-1.08), q(0.24)), C.skin, C.skinSh, q(0.04));
        dot(c, q(-0.08), q(-1.07), q(0.035)); dot(c, q(0.08), q(-1.07), q(0.035));
        line(c, 0, q(-1.2), 0, q(-1.0), steelSh, LW * 1.1);
      } else sh(c, () => circ(c, 0, q(-1.08), q(0.25)), steel, steelSh, q(0.05));
      sh(c, () => ell(c, 0, q(-1.2), q(0.38), q(0.09)), steel, steelSh, q(0.03));
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.2), q(0.25), Math.PI, 0); c.closePath(); }, steel, steelSh, q(0.05));
      sh(c, () => ell(c, 0, q(-1.47), q(0.05), q(0.1)), T.main, T.sh, q(0.03));
      if (front) buckler(1);
    },

    // Flail Knight: a heavy armored knight swinging a spiked ball on a chain in a full circle.
    flail(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 7) * q(0.05) : 0, front = o.view === 'front';
      const plate = '#bfc7d3', plateSh = '#8a94a3';
      // the ball goes once round the knight during an attack, and hangs and sways otherwise
      const swinging = o.atk > 0.02, ang = swinging ? -Math.PI / 2 + (1 - o.atk) * Math.PI * 2 : Math.PI * 0.62 + Math.sin(o.t * 2.6) * 0.18;
      const hx = q(0.36), hy = q(-0.7), reach = swinging ? q(1.25) : q(0.62);
      const bx = hx + Math.cos(ang) * reach * (swinging ? 1 : 0.4), by = swinging ? q(-0.62) + Math.sin(ang) * reach * 0.45 : hy + reach;
      const drawBall = () => {
        c.beginPath(); c.moveTo(hx, hy);
        c.quadraticCurveTo((hx + bx) / 2, Math.max(hy, by) + q(0.12), bx, by);
        c.strokeStyle = OUT; c.lineWidth = q(0.07) + LW; c.stroke();
        c.setLineDash([q(0.06), q(0.04)]); c.strokeStyle = '#9aa3b0'; c.lineWidth = q(0.07); c.stroke(); c.setLineDash([]);
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          poly(c, [bx + Math.cos(a - 0.25) * q(0.17), by + Math.sin(a - 0.25) * q(0.17), bx + Math.cos(a) * q(0.3), by + Math.sin(a) * q(0.3), bx + Math.cos(a + 0.25) * q(0.17), by + Math.sin(a + 0.25) * q(0.17)]);
          paint(c, '#d6dce5', LW * 0.6);
        }
        sh(c, () => circ(c, bx, by, q(0.19)), '#5d6370', '#3f444f', q(0.05));
        circ(c, bx - q(0.06), by - q(0.06), q(0.05)); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
      };
      if (swinging) {
        // a faint arc showing the sweep
        c.beginPath(); c.ellipse(0, q(-0.62), q(1.25), q(0.56), 0, 0, Math.PI * 2);
        c.strokeStyle = `rgba(255,255,255,${0.25 * o.atk})`; c.lineWidth = q(0.12); c.stroke();
      }
      const behind = swinging ? Math.sin(ang) < 0 : !front;
      if (behind) drawBall();
      for (const [x, ph] of [[-0.26, 1], [0.08, -1]]) sh(c, () => rr(c, q(x), q(-0.36) + st * ph, q(0.18), q(0.36) - st * ph, q(0.06)), plate, plateSh, q(0.05));
      sh(c, () => rr(c, q(-0.4), q(-1.02), q(0.8), q(0.72), q(0.22)), plate, plateSh, q(0.1));
      sh(c, () => poly(c, [q(-0.24), q(-0.98), q(0.24), q(-0.98), q(0.28), q(-0.34), q(-0.28), q(-0.34)]), T.main, T.sh, q(0.06));
      if (front) sh(c, () => poly(c, [0, q(-0.86), q(0.1), q(-0.7), 0, q(-0.52), q(-0.1), q(-0.7)]), C.gold, C.goldSh, q(0.03));
      sh(c, () => rr(c, q(-0.4), q(-0.46), q(0.8), q(0.1), q(0.04)), '#5d4030', null, 0);
      for (const s of [-1, 1]) sh(c, () => ell(c, s * q(0.42), q(-0.98), q(0.2), q(0.14)), plate, plateSh, q(0.04));
      // arm and handle
      sh(c, () => rr(c, q(0.26), q(-0.92), q(0.18), q(0.3), q(0.08)), plate, plateSh, q(0.04));
      sh(c, () => rr(c, q(0.3), q(-0.76), q(0.12), q(0.16), q(0.04)), '#6b4a30', null, 0);
      // great helm
      sh(c, () => rr(c, q(-0.27), q(-1.5), q(0.54), q(0.52), q(0.2)), plate, plateSh, q(0.07));
      if (front) {
        rr(c, q(-0.2), q(-1.3), q(0.4), q(0.07), q(0.03)); c.fillStyle = '#1c1a26'; c.fill();
        line(c, 0, q(-1.24), 0, q(-1.06), plateSh, LW);
      } else line(c, 0, q(-1.48), 0, q(-1.0), plateSh, LW);
      sh(c, () => ell(c, 0, q(-1.6), q(0.08), q(0.16)), T.main, T.sh, q(0.04));
      if (!behind) drawBall();
    },

    // Pot Thrower: a small hooded potter lobbing clay pots.
    pots(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 11) * q(0.05) : 0, front = o.view === 'front';
      const robe = '#8a6a4a', robeSh = '#6a4e34', clay = '#d07a45', claySh = '#a8582c';
      const th = o.atk; // 1 just after a throw
      const pot = (x, y, s) => {
        sh(c, () => { c.beginPath(); c.ellipse(x, y, q(0.17) * s, q(0.15) * s, 0, 0, Math.PI * 2); }, clay, claySh, q(0.04) * s);
        sh(c, () => rr(c, x - q(0.09) * s, y - q(0.21) * s, q(0.18) * s, q(0.08) * s, q(0.03) * s), claySh, null, 0);
        line(c, x - q(0.12) * s, y + q(0.02) * s, x + q(0.12) * s, y + q(0.02) * s, '#f0b080', LW * 0.6);
      };
      for (const [x, ph] of [[-0.15, 1], [0.04, -1]]) sh(c, () => rr(c, q(x), q(-0.26) + st * ph, q(0.11), q(0.26) - st * ph, q(0.05)), '#4a3a2c', null, 0);
      // a satchel of pots on the back
      if (!front) { pot(q(-0.22), q(-0.62), 0.9); pot(q(0.18), q(-0.6), 0.8); }
      sh(c, () => poly(c, [q(-0.3), q(-0.22), q(0.3), q(-0.22), q(0.22), q(-0.82), q(-0.22), q(-0.82)]), robe, robeSh, q(0.06));
      sh(c, () => rr(c, q(-0.26), q(-0.84), q(0.52), q(0.1), q(0.04)), T.main, T.sh, q(0.03));
      // the throwing arm: pot held high, then empty after the throw
      const ax = q(0.3), ay = q(-0.86 - (1 - th) * 0.3);
      rope(c, () => { c.beginPath(); c.moveTo(q(0.16), q(-0.66)); c.lineTo(ax, ay); }, robe, q(0.1));
      if (th < 0.35) pot(ax, ay - q(0.14), 1);
      sh(c, () => circ(c, 0, q(-1.02), q(0.25)), robe, robeSh, q(0.05));
      if (front) {
        sh(c, () => ell(c, 0, q(-0.98), q(0.16), q(0.15)), C.skin, C.skinSh, q(0.03));
        dot(c, q(-0.06), q(-1.0), q(0.03)); dot(c, q(0.06), q(-1.0), q(0.03));
        line(c, q(-0.04), q(-0.92), q(0.05), q(-0.93), OUT, LW * 0.7);
      }
      sh(c, () => poly(c, [q(-0.14), q(-1.22), q(0.14), q(-1.22), 0, q(-1.42)]), robe, robeSh, q(0.03));
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

    // A Ram Cart soldier: a desert fighter in a tunic and leather cap, with a wooden mallet.
    ramsoldier(c, k, o) {
      const q = v => v * k * 0.88, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 11) * q(0.05) : 0, front = o.view === 'front', sw = o.atk;
      const tunic = '#e2c48a', tunicSh = '#bf9c5e', leather = '#a8703c', leatherSh = '#7e4f25';
      for (const [x, ph] of [[-0.19, 1], [0.06, -1]]) sh(c, () => rr(c, q(x), q(-0.3) + st * ph, q(0.13), q(0.3) - st * ph, q(0.05)), '#6b4a30', null, 0);
      const mallet = () => {
        c.save(); c.translate(q(0.3), q(-0.72)); c.rotate(-0.4 + sw * 2.2);
        line(c, 0, 0, 0, q(-0.5), OUT, q(0.09) + LW); line(c, 0, 0, 0, q(-0.5), '#8a5a2e', q(0.09));
        sh(c, () => rr(c, q(-0.17), q(-0.68), q(0.34), q(0.2), q(0.06)), C.wood, C.woodSh, q(0.05));
        rr(c, q(-0.17), q(-0.62), q(0.34), q(0.05), 0); c.fillStyle = C.gold; c.fill();
        c.restore();
      };
      if (!front) mallet();
      sh(c, () => rr(c, q(-0.27), q(-0.88), q(0.54), q(0.62), q(0.16)), tunic, tunicSh, q(0.06));
      sh(c, () => poly(c, [q(-0.27), q(-0.84), q(-0.12), q(-0.88), q(0.27), q(-0.4), q(0.27), q(-0.26)]), T.main, T.sh, q(0.04));
      sh(c, () => rr(c, q(-0.28), q(-0.4), q(0.56), q(0.09), q(0.03)), leather, null, 0);
      sh(c, () => circ(c, 0, q(-1.1), q(0.25)), front ? C.skin : '#4a2f1e', front ? C.skinSh : '#36210f', q(0.05));
      if (front) {
        dot(c, q(-0.08), q(-1.1), q(0.035)); dot(c, q(0.08), q(-1.1), q(0.035));
        line(c, q(-0.08), q(-0.98), q(0.08), q(-0.98), OUT, LW * 0.9);
      }
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.13), q(0.27), Math.PI, 0); c.closePath(); }, leather, leatherSh, q(0.05));
      sh(c, () => rr(c, q(-0.29), q(-1.16), q(0.58), q(0.08), q(0.03)), leatherSh, null, 0);
      sh(c, () => ell(c, q(0.02), q(-1.45), q(0.07), q(0.13), 0.3), T.main, T.sh, q(0.03));
      if (front) mallet();
    },

    // The Ram Cart: a wheeled frame carrying a log with a golden ram's head, pushed by two soldiers.
    // o.power (0 to 1) is how fast it is going: the wheels spin faster and it leans into the charge.
    ramcart(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', pw = o.power || 0;
      const spin = o.walk ? o.t * (5 + pw * 14) : 0, lean = (front ? 1 : -1) * pw * q(0.06);
      const wood = '#b07a43', woodSh = '#84552a';
      const wheel = (x, y, r) => {
        sh(c, () => circ(c, x, y, r), '#7a4f2a', '#5a3818', r * 0.25);
        for (let i = 0; i < 4; i++) { const a = spin + i * Math.PI / 4; line(c, x - Math.cos(a) * r * 0.75, y - Math.sin(a) * r * 0.75, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, '#c9935a', Math.max(1, r * 0.16)); }
        circ(c, x, y, r * 0.24); paint(c, C.gold, LW * 0.6);
      };
      const ramHead = (y, s) => {
        c.save(); c.translate(0, y); c.scale(s, s);
        for (const d of [-1, 1]) {
          rope(c, () => { c.beginPath(); c.arc(d * q(0.24), q(-0.1), q(0.17), d > 0 ? Math.PI * 1.2 : -Math.PI * 0.2, d > 0 ? Math.PI * 2.7 : Math.PI * 1.3, d < 0); }, '#e8a91c', q(0.1));
          circ(c, d * q(0.24), q(-0.1), q(0.06)); paint(c, '#c47f10', LW * 0.5);
        }
        sh(c, () => ell(c, 0, 0, q(0.22), q(0.26)), C.gold, C.goldSh, q(0.06));
        sh(c, () => ell(c, 0, q(0.14), q(0.15), q(0.11)), '#ffe27a', C.goldSh, q(0.03));
        if (front) {
          dot(c, q(-0.09), q(-0.04), q(0.035)); dot(c, q(0.09), q(-0.04), q(0.035));
          dot(c, q(-0.05), q(0.16), q(0.025), '#8a5a05'); dot(c, q(0.05), q(0.16), q(0.025), '#8a5a05');
        }
        c.restore();
      };
      const pushers = () => {
        for (const x of [-0.34, 0.34]) {
          c.save(); c.translate(q(x), front ? q(-1.05) : q(0.32)); c.scale(0.78, 0.78);
          TROOPS.ramsoldier(c, k, Object.assign({}, o, { atk: 0, t: o.t + x * 3 }));
          c.restore();
        }
      };
      c.save(); c.translate(0, lean);
      if (front) pushers();
      // far wheels, the frame, the log, near wheels
      wheel(q(-0.55), q(-1.05), q(0.2)); wheel(q(0.55), q(-1.05), q(0.2));
      sh(c, () => rr(c, q(-0.5), q(-1.25), q(1.0), q(1.0), q(0.12)), wood, woodSh, q(0.1));
      c.save(); rr(c, q(-0.5), q(-1.25), q(1.0), q(1.0), q(0.12)); c.clip();
      for (const y of [-1.0, -0.72, -0.44]) line(c, q(-0.5), q(y), q(0.5), q(y), 'rgba(60,35,15,0.45)', LW * 0.8);
      c.restore();
      sh(c, () => rr(c, q(-0.5), q(-0.62), q(1.0), q(0.12), q(0.04)), T.main, T.sh, q(0.04));
      sh(c, () => rr(c, q(-0.2), q(-1.5), q(0.4), q(1.45), q(0.18)), '#9a6a3a', '#734a26', q(0.08));
      for (const y of [-1.25, -0.42]) sh(c, () => rr(c, q(-0.23), q(y), q(0.46), q(0.1), q(0.03)), '#5d6370', '#3f444f', q(0.03));
      wheel(q(-0.58), q(-0.4), q(0.25)); wheel(q(0.58), q(-0.4), q(0.25));
      if (front) ramHead(q(0.02), 1.15); else ramHead(q(-1.55), 0.85);
      c.restore();
      if (!front) pushers();
    },

    // The Mole: a burly digger in a miner's helmet with a lamp, big claws for digging and fighting.
    mole(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = o.walk ? Math.sin(o.t * 10) * q(0.04) : 0, front = o.view === 'front', sw = o.atk;
      const fur = '#7a5a44', furSh = '#5a412f', belly = '#b48e6c';
      for (const [x, ph] of [[-0.22, 1], [0.08, -1]]) sh(c, () => ell(c, q(x + 0.07), q(-0.08) + st * ph, q(0.13), q(0.09)), '#e9a9a0', '#c98880', q(0.02));
      const claw = (d) => {
        c.save(); c.translate(d * q(0.38), q(-0.6)); c.rotate(d * (0.3 - sw * 1.6));
        sh(c, () => ell(c, 0, q(0.08), q(0.14), q(0.18)), '#e9a9a0', '#c98880', q(0.04));
        for (const a of [-0.35, 0, 0.35]) sh(c, () => poly(c, [q(a * 0.3) - q(0.04), q(0.2), q(a * 0.3) + q(0.04), q(0.2), q(a * 0.6), q(0.38)]), '#f3ead0', '#d4c8a6', q(0.02));
        c.restore();
      };
      claw(-1);
      sh(c, () => ell(c, 0, q(-0.46), q(0.38), q(0.4)), fur, furSh, q(0.09));
      if (front) sh(c, () => ell(c, 0, q(-0.4), q(0.24), q(0.28)), belly, '#97735a', q(0.05));
      else sh(c, () => ell(c, 0, q(-0.1), q(0.06), q(0.05)), '#e9a9a0', null, 0);
      claw(1);
      sh(c, () => circ(c, 0, q(-0.9), q(0.27)), fur, furSh, q(0.06));
      if (front) {
        sh(c, () => ell(c, 0, q(-0.8), q(0.15), q(0.11)), belly, '#97735a', q(0.03));
        for (const d of [-1, 1]) { circ(c, d * q(0.1), q(-0.94), q(0.07)); paint(c, '#bfe6ff', LW * 0.8); dot(c, d * q(0.1), q(-0.94), q(0.025)); }
        line(c, q(-0.03), q(-0.94), q(0.03), q(-0.94), OUT, LW);
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; dot(c, Math.cos(a) * q(0.05), q(-0.83) + Math.sin(a) * q(0.05), q(0.03), '#ff8aa8'); }
        circ(c, 0, q(-0.83), q(0.045)); paint(c, '#ff6f95', LW * 0.6);
        rr(c, q(-0.045), q(-0.75), q(0.09), q(0.06), q(0.01)); paint(c, '#fff', LW * 0.5);
      }
      // the miner's helmet and its lamp
      sh(c, () => { c.beginPath(); c.arc(0, q(-0.98), q(0.29), Math.PI, 0); c.closePath(); }, '#ffcd33', '#e09f12', q(0.05));
      sh(c, () => rr(c, q(-0.31), q(-1.01), q(0.62), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
      if (front) {
        sh(c, () => circ(c, 0, q(-1.12), q(0.08)), '#fff8d0', '#ffe27a', q(0.02));
        const g = c.createRadialGradient(0, q(-1.12), 0, 0, q(-1.12), q(0.3));
        g.addColorStop(0, 'rgba(255,245,190,0.6)'); g.addColorStop(1, 'rgba(255,245,190,0)');
        c.fillStyle = g; circ(c, 0, q(-1.12), q(0.3)); c.fill();
      }
    },

    // The Camel Jockey: a camel that gallops for buildings, and its rider who lassos troops.
    // o.ratk (0 to 1) is the rider's throw; o.charged lights up the run before a charge hit.
    camel(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', g = o.walk ? o.t * 11 : 0;
      const tan = '#dba862', tanSh = '#b5853f', hoof = '#5a4030';
      const bob = o.walk ? Math.abs(Math.sin(g)) * q(0.07) : 0, lunge = (front ? 1 : -1) * o.atk * q(0.2);
      const leg = (x, ph) => {
        const sw = Math.sin(g + ph) * q(0.12);
        sh(c, () => rr(c, q(x) - q(0.09), q(-0.7) + Math.max(0, -sw) * 0.4, q(0.18), q(0.7) - Math.max(0, sw) * 0.5, q(0.07)), tan, tanSh, q(0.03));
        sh(c, () => ell(c, q(x), q(-0.03) - Math.max(0, sw) * 0.5, q(0.09), q(0.05)), hoof, null, 0);
      };
      const rider = (y) => {
        c.save(); c.translate(0, y);
        const th = o.ratk || 0;
        // the lasso, swung overhead before the throw
        if (th > 0.05) {
          // swung on the far side from the camel's head
          const a = o.t * 18, sd = front ? 1 : -1, lx = sd * q(0.36), ly = q(-1.05);
          rope(c, () => { c.beginPath(); c.moveTo(sd * q(0.2), q(-0.62)); c.lineTo(lx, ly); }, '#c8a070', q(0.04));
          rope(c, () => ell(c, lx + Math.cos(a) * q(0.08), ly - q(0.06), q(0.24), q(0.09)), '#c8a070', q(0.04));
        }
        sh(c, () => rr(c, q(-0.24), q(-0.66), q(0.48), q(0.56), q(0.16)), T.main, T.sh, q(0.06));
        sh(c, () => rr(c, q(-0.25), q(-0.3), q(0.5), q(0.08), q(0.03)), C.gold, null, 0);
        sh(c, () => circ(c, 0, q(-0.86), q(0.22)), front ? C.skin : '#f3ead6', front ? C.skinSh : '#d8ccb0', q(0.05));
        if (front) {
          dot(c, q(-0.07), q(-0.88), q(0.032)); dot(c, q(0.07), q(-0.88), q(0.032));
          rr(c, q(-0.1), q(-0.8), q(0.2), q(0.06), q(0.03)); c.fillStyle = '#5a3a24'; c.fill();
        }
        // a wrapped turban with a tail in the team's colour
        sh(c, () => ell(c, 0, q(-1.03), q(0.25), q(0.15)), '#f3ead6', '#d8ccb0', q(0.04));
        sh(c, () => circ(c, 0, q(-1.03), q(0.06)), T.main, T.sh, q(0.02));
        if (!front) sh(c, () => poly(c, [q(-0.08), q(-0.98), q(0.06), q(-0.98), q(0.12), q(-0.6), q(-0.02), q(-0.64)]), T.main, T.sh, q(0.03));
        c.restore();
      };
      c.save(); c.translate(0, lunge);
      // the charge glow under it
      if (o.charged) { ell(c, 0, q(-0.05), q(0.75), q(0.28)); c.fillStyle = 'rgba(255,210,120,0.35)'; c.fill(); }
      const head = (x, y, sc) => {
        c.save(); c.translate(x, y); c.scale(sc, sc);
        for (const d of [-1, 1]) sh(c, () => ell(c, d * q(0.17), q(-0.14), q(0.07), q(0.045), d * 0.6), tan, tanSh, q(0.01));
        sh(c, () => ell(c, 0, 0, q(0.2), q(0.17)), tan, tanSh, q(0.04));
        sh(c, () => ell(c, 0, q(0.11), q(0.15), q(0.1)), '#c9965a', tanSh, q(0.03));
        if (front) {
          for (const d of [-1, 1]) {
            circ(c, d * q(0.08), q(-0.05), q(0.045)); paint(c, '#fff', LW * 0.5); dot(c, d * q(0.08), q(-0.04), q(0.022));
            line(c, d * q(0.13), q(-0.09), d * q(0.03), q(-0.08), OUT, LW * 0.9);
            dot(c, d * q(0.05), q(0.11), q(0.02));
          }
          line(c, q(-0.06), q(0.17), q(0.06), q(0.17), OUT, LW * 0.8);
        }
        c.restore();
      };
      const body = () => {
        sh(c, () => ell(c, 0, q(-0.82), q(0.6), q(0.4)), tan, tanSh, q(0.09));
        // the hump rises above the saddle blanket
        sh(c, () => ell(c, 0, q(-1.12), q(0.3), q(0.24)), tan, tanSh, q(0.06));
        sh(c, () => poly(c, [q(-0.52), q(-0.92), q(0.52), q(-0.92), q(0.44), q(-0.62), q(-0.44), q(-0.62)]), T.main, T.sh, q(0.04));
        for (let i = 0; i < 6; i++) dot(c, q(-0.38 + i * 0.152), q(-0.6), q(0.035), C.gold);
      };
      if (front) {
        // facing you: hind legs, the body and hump, the rider behind, then the neck and a big head in front
        leg(-0.34, 0); leg(0.34, Math.PI);
        c.save(); c.translate(0, -bob);
        body();
        rider(q(-1.1));
        rope(c, () => { c.beginPath(); c.moveTo(0, q(-0.86)); c.quadraticCurveTo(q(0.04), q(-0.62), 0, q(-0.5)); }, tan, q(0.22));
        head(0, q(-0.46), 1.25);
        c.restore();
        leg(-0.24, Math.PI * 0.5); leg(0.24, Math.PI * 1.5);
      } else {
        // from behind: the neck reaches up past the rider, the head leads the way
        leg(-0.26, Math.PI * 0.5); leg(0.26, Math.PI * 1.5);
        c.save(); c.translate(0, -bob);
        rope(c, () => { c.beginPath(); c.moveTo(q(0.1), q(-1.0)); c.quadraticCurveTo(q(0.42), q(-1.5), q(0.34), q(-2.05)); }, tan, q(0.2));
        head(q(0.34), q(-2.14), 0.95);
        body();
        rope(c, () => { c.beginPath(); c.moveTo(0, q(-0.5)); c.quadraticCurveTo(q(0.12), q(-0.32), q(0.05), q(-0.24)); }, '#8a5a2e', q(0.04));
        rider(q(-1.02));
        c.restore();
        leg(-0.34, 0); leg(0.34, Math.PI);
      }
      c.restore();
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

  // The Cannon: a wooden platform with an iron barrel that turns to aim (o.angle, in screen space).
  function cannon(c, k, o) {
    LW = Math.max(1, k * 0.07);
    const q = v => v * k, T = TEAM[o.team], recoil = (o.atk || 0) * q(0.18);
    ell(c, 0, q(0.5), q(1.05), q(0.38)); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
    sh(c, () => rr(c, q(-0.92), q(-0.5), q(1.84), q(1.1), q(0.18)), '#9a6a3c', '#734a26', q(0.16));
    c.save(); rr(c, q(-0.92), q(-0.5), q(1.84), q(1.1), q(0.18)); c.clip();
    for (const y of [-0.22, 0.06, 0.34]) line(c, q(-0.9), q(y), q(0.9), q(y), 'rgba(60,35,15,0.45)', LW * 0.8);
    c.restore();
    rr(c, q(-0.92), q(-0.5), q(1.84), q(1.1), q(0.18)); c.lineWidth = LW; c.strokeStyle = OUT; c.stroke();
    for (const x of [-0.78, 0.78]) for (const y of [-0.36, 0.44]) dot(c, q(x), q(y), q(0.05), '#d9c27a');
    sh(c, () => rr(c, q(-0.92), q(0.3), q(1.84), q(0.14), q(0.05)), T.main, T.sh, q(0.04));
    for (const x of [-0.62, 0.62]) { sh(c, () => circ(c, q(x), q(0.12), q(0.24)), '#6b4a2c', '#4e351e', q(0.05)); dot(c, q(x), q(0.12), q(0.07), '#cfc6b6'); }
    c.save(); c.translate(0, q(-0.18)); c.rotate(o.angle || -Math.PI / 2);
    sh(c, () => rr(c, q(-0.32) - recoil, q(-0.24), q(1.15), q(0.48), q(0.2)), '#3e414c', '#2a2c34', q(0.08));
    sh(c, () => rr(c, q(0.66) - recoil, q(-0.28), q(0.2), q(0.56), q(0.08)), '#555a66', '#3a3e48', q(0.05));
    circ(c, q(0.86) - recoil, 0, q(0.13)); c.fillStyle = '#15161b'; c.fill();
    sh(c, () => circ(c, q(-0.2) - recoil, 0, q(0.2)), '#555a66', null, 0);
    c.restore();
    sh(c, () => circ(c, 0, q(-0.18), q(0.16)), '#ffcd33', '#e09f12', q(0.04));
  }

  function troop(c, card, k, o) {
    const f = TROOPS[card];
    if (!f) return;
    LW = Math.max(1, k * 0.07);
    o.view = o.view || (o.team === 0 ? 'back' : 'front');
    if (o.evo) {
      // an evolution: a violet glow at its feet and a little more size
      const pulse = 0.75 + Math.sin((o.t || 0) * 4) * 0.2;
      const g = c.createRadialGradient(0, -k * 0.2, k * 0.1, 0, -k * 0.2, k * 1.1);
      g.addColorStop(0, `rgba(190,140,255,${0.55 * pulse})`); g.addColorStop(1, 'rgba(150,90,255,0)');
      c.fillStyle = g; ell(c, 0, -k * 0.2, k * 1.1, k * 0.7); c.fill();
      c.save(); c.scale(1.12, 1.12); f(c, k, o); c.restore();
      return;
    }
    // the camel stands taller than its footprint
    if (card === 'camel') { c.save(); c.scale(1.18, 1.18); f(c, k, o); c.restore(); return; }
    f(c, k, o);
  }
  // Sandstorm: a swirling column of sand with dust and pebbles. t turns it.
  function sandstormArt(c, k, t) {
    for (let i = 0; i < 5; i++) {
      const y = -k * (0.1 + i * 0.22), rx = k * (0.32 + i * 0.12), a = t * (3 + i * 0.6) + i;
      c.beginPath(); c.ellipse(0, y, rx, rx * 0.32, 0, a, a + Math.PI * 1.4);
      c.strokeStyle = OUT; c.lineWidth = k * 0.13 + LW; c.lineCap = 'round'; c.stroke();
      c.strokeStyle = i % 2 ? '#e8c27a' : '#d6a24e'; c.lineWidth = k * 0.13; c.stroke();
      c.beginPath(); c.ellipse(0, y, rx, rx * 0.32, 0, a + 0.2, a + Math.PI * 0.8);
      c.strokeStyle = 'rgba(255,240,200,0.8)'; c.lineWidth = k * 0.04; c.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const a = t * 4 + i * 0.7, r = k * (0.35 + (i % 3) * 0.2), y = -k * (0.15 + (i % 4) * 0.25);
      circ(c, Math.cos(a) * r, y + Math.sin(a) * r * 0.3, k * (0.04 + (i % 2) * 0.03)); paint(c, i % 3 ? '#9a7048' : '#c9a070', LW * 0.5);
    }
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
    epic: ['#d9a6ff', '#7a3fd0', '#f1dcff'],
    legendary: ['#8ff0e0', '#7a4cff', '#fff2b3', '#ff8fd0'],
    evo: ['#c79bff', '#4a22a8', '#e8d4ff'],
  };
  // opts.evo: the evolved version's card (a violet card with the evolved troop).
  function portrait(cardId, w, h, opts) {
    const cv = document.createElement('canvas');
    // opts.bare: just the character, on a transparent background with no card and nothing clipped (for
    // the card emotes): drawn with a wide margin all round so wings and weapons fit (trim it after)
    const evo = !!(opts && opts.evo), bare = !!(opts && opts.bare), team = (opts && opts.team) || 0;
    cv.width = bare ? w * 2 : w; cv.height = bare ? h * 2 : h;
    const c = cv.getContext('2d'), card = KC_CARDS[cardId], R = evo ? RARITY.evo : RARITY[card.rarity] || RARITY.common;
    if (bare) c.translate(w / 2, h / 2);
    if (!bare) {
      const g = c.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, R[0]); if (R[3]) g.addColorStop(0.55, R[3]); g.addColorStop(1, R[1]);
      rr(c, 0, 0, w, h, w * 0.1); c.fillStyle = g; c.fill();
    }
    c.save(); if (!bare) { rr(c, 0, 0, w, h, w * 0.1); c.clip(); }
    if (!bare) {
      const glow = c.createRadialGradient(w * 0.5, h * 0.42, w * 0.05, w * 0.5, h * 0.42, w * 0.6);
      glow.addColorStop(0, 'rgba(255,255,255,0.45)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = glow; c.fillRect(0, 0, w, h);
      ell(c, w * 0.5, h * 0.86, w * 0.42, h * 0.07); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill();
    }
    const k = w * 0.42;
    const o = { team, t: 0.3, walk: false, atk: 0, face: 1, id: 1, view: 'front', evo };
    if (bare) {
      const fin = () => { c.restore(); return cv; };
      const at2 = (x, y, s, oo) => { c.save(); c.translate(w * x, h * y); troop(c, cardId, k * s, Object.assign({}, o, oo)); c.restore(); };
      if (cardId === 'fireball') { c.save(); c.translate(w * 0.54, h * 0.46); LW = Math.max(1, k * 0.07); fireballArt(c, k * 1.0, 0.4); c.restore(); return fin(); }
      if (cardId === 'spears') { c.save(); c.translate(w * 0.5, h * 0.5); LW = Math.max(1, k * 0.06); spearsArt(c, k * 1.05, 0); c.restore(); return fin(); }
      if (cardId === 'sandstorm') { c.save(); c.translate(w * 0.56, h * 0.76); LW = Math.max(1, k * 0.06); sandstormArt(c, k * 1.35, 0.6); c.restore(); return fin(); }
      if (cardId === 'cannon') { c.save(); c.translate(w * 0.5, h * 0.62); cannon(c, k * 0.95, { team, angle: Math.PI * 0.62 }); c.restore(); return fin(); }
    }
    const at = (x, y, s, oo) => { c.save(); c.translate(w * x, h * y); troop(c, cardId, k * s, Object.assign({}, o, oo)); c.restore(); };
    if (cardId === 'fireball') { c.save(); c.translate(w * 0.54, h * 0.46); LW = Math.max(1, k * 0.07); fireballArt(c, k * 1.0, 0.4); c.restore(); }
    else if (cardId === 'sandstorm') { c.save(); c.translate(w * 0.56, h * 0.76); LW = Math.max(1, k * 0.06); sandstormArt(c, k * 1.35, 0.6); c.restore(); }
    else if (cardId === 'ramcart') at(0.5, 0.9, 1.05, { power: 0.4 });
    else if (cardId === 'camel') at(0.5, 0.97, 0.86, { ratk: 0.6, t: 0.2 });
    else if (cardId === 'spears') { c.save(); c.translate(w * 0.5, h * 0.5); LW = Math.max(1, k * 0.06); spearsArt(c, k * 1.05, 0); c.restore(); }
    else if (cardId === 'footmen') { at(0.27, 0.72, 1.15, { t: 0.4 }); at(0.73, 0.72, 1.15, { t: 1.1 }); at(0.5, 0.92, 1.4, {}); }
    else if (cardId === 'wolves') { at(0.26, 0.7, 1.6, { t: 1.1 }); at(0.74, 0.7, 1.6, {}); at(0.5, 0.9, 2.0, { t: 0.6 }); }
    else if (cardId === 'hawks') { at(0.3, 0.34, 1.1, { t: 0.9 }); at(0.58, 0.62, 1.45, {}); }
    else if (cardId === 'archers') { at(0.3, 0.86, 1.2, {}); at(0.64, 0.92, 1.35, { face: 1 }); }
    else {
      if (cardId === 'skeletons') { at(0.26, 0.78, 1.55, { t: 0.4 }); at(0.74, 0.78, 1.55, { t: 1.2 }); at(0.5, 0.94, 1.85, {}); c.restore(); return bare ? cv : finish(c, w, h, R, cv); }
      if (cardId === 'cannon') { c.save(); c.translate(w * 0.5, h * 0.62); cannon(c, k * 0.95, { team: 0, angle: Math.PI * 0.62 }); c.restore(); c.restore(); return finish(c, w, h, R, cv); }
      const sc = { rhino: 1.6, gladiator: 1.5, snowman: evo ? 1.0 : 1.32, gorilla: 1.45, flail: 1.22, pots: 1.55, mole: 1.6, ramsoldier: 1.5 }[cardId] || 1;
      at(0.5, cardId === 'rhino' ? 0.86 : 0.92, sc, {});
    }
    c.restore();
    return bare ? cv : finish(c, w, h, R, cv);
  }
  function finish(c, w, h, R, cv) {
    rr(c, w * 0.025, w * 0.025, w * 0.95, h - w * 0.05, w * 0.085);
    c.lineWidth = w * 0.04; c.strokeStyle = R[2]; c.stroke();
    if (R === RARITY.evo) {
      // the evolution mark: a violet gem with a swirl, top left
      const x = w * 0.16, y = w * 0.16, r = w * 0.1;
      poly(c, [x, y - r, x + r, y, x, y + r, x - r, y]); paint(c, '#b48cff', Math.max(1.5, w * 0.018));
      c.beginPath(); c.arc(x, y, r * 0.42, 0, Math.PI * 1.5); c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.2, w * 0.014); c.stroke();
    }
    return cv;
  }
  // Spears: a volley of spears coming down at an angle. t (0 to 1) slides them forward.
  function spearsArt(c, k, t) {
    const spears = [[-0.42, -0.2, 0.95], [-0.12, -0.42, 1], [0.2, -0.24, 0.9], [-0.28, 0.16, 0.85], [0.06, 0.06, 1.05], [0.36, 0.14, 0.9], [-0.02, 0.4, 0.8]];
    for (const [x, y, s] of spears) {
      c.save(); c.translate(k * x, k * y + t * k * 0.2); c.rotate(0.55); c.scale(s, s);
      line(c, 0, -k * 0.5, 0, k * 0.3, OUT, k * 0.09);
      line(c, 0, -k * 0.5, 0, k * 0.3, '#9a6a3a', k * 0.05);
      poly(c, [0, k * 0.52, -k * 0.08, k * 0.28, k * 0.08, k * 0.28]); paint(c, '#e4e9f0', LW);
      poly(c, [0, -k * 0.5, -k * 0.09, -k * 0.62, 0, -k * 0.56, k * 0.09, -k * 0.62]); paint(c, '#dc3640', LW * 0.7);
      c.restore();
    }
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
  // Battlefield palettes: the Training Grounds, and Arena 1 (Cinder Keep: dry grass, ash and embers).
  const THEMES = {
    training: { bg: '#5c5470', grass: ['#7cc653', '#73bd4b'], path: '#d6bf8a', pad: '#9d978d', river: ['#3d8fe0', '#2f75c4'], bank: '#5aa63e', wall: '#857c95', specks: ['#ffffff', '#ffd54a', '#ff8fb3', '#b68cff'] },
    briar: { bg: '#3b4636', grass: ['#5d8a45', '#557f3f'], path: '#8a6a44', pad: '#7e8579', river: ['#2e7a84', '#22636c'], bank: '#3f6a34', wall: '#5e6b56', specks: ['#d8ff8a', '#ffe48a', '#9fe0a0', '#c84a5a'] },
    sunstone: { bg: '#6e4a2c', grass: ['#e8c47c', '#e0ba70'], path: '#c99a5a', pad: '#b3906a', river: ['#35b8c6', '#2794a6'], bank: '#9fb05a', wall: '#b07a4a', specks: ['#5fa84a', '#ffe08a', '#c96a3a', '#fff4d6'] },
    cinder: { bg: '#4d3f45', grass: ['#a6ad5a', '#9ba251'], path: '#c9a47c', pad: '#8d857e', river: ['#3a86c4', '#2c6aa3'], bank: '#7f8a42', wall: '#6f6168', specks: ['#ff8a3d', '#ffc261', '#5a4a44', '#e6dccd'] },
  };
  // The battlefield under the live game: the arena's illustration if it has one (js/arenas.js),
  // otherwise drawn here from its palette.
  function arena(c, k, B, theme) {
    if (typeof KCArenas !== 'undefined' && KCArenas.drawField(c, theme, k, B, KCSim.W, KCSim.H)) return;
    const PAL = THEMES[theme] || THEMES.training;
    const S = KCSim, W = S.W, H = S.H, X = x => (x + B) * k, Y = y => (y + B) * k;
    const r = S.mulberry(42);
    c.fillStyle = PAL.bg; c.fillRect(0, 0, (W + 2 * B) * k, (H + 2 * B) * k);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      c.fillStyle = (x + y) % 2 ? PAL.grass[0] : PAL.grass[1];
      c.fillRect(X(x), Y(y), k + 0.5, k + 0.5);
    }
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H; c.fillRect(X(x), Y(y), k * 0.08, k * 0.22); }
    const path = (x1, y1, x2, y2) => { rr(c, X(x1), Y(y1), (x2 - x1) * k, (y2 - y1) * k, k * 0.5); c.fillStyle = PAL.path; c.fill(); };
    for (const lx of [3.5, 14.5]) { path(lx - 0.7, 6.5, lx + 0.7, 25.5); }
    path(3.5, 2.3, 14.5, 3.7); path(3.5, 28.3, 14.5, 29.7);
    c.fillStyle = 'rgba(120,90,50,0.18)';
    for (let i = 0; i < 70; i++) { const lx = r() < 0.5 ? 3.5 : 14.5; ell(c, X(lx + (r() - 0.5) * 1.2), Y(7 + r() * 18), k * 0.09, k * 0.06); c.fill(); }
    const pad = (x, y, h) => { rr(c, X(x - h - 0.15), Y(y - h - 0.15), (h * 2 + 0.3) * k, (h * 2 + 0.3) * k, k * 0.35); c.fillStyle = PAL.pad; c.fill(); c.lineWidth = k * 0.06; c.strokeStyle = 'rgba(0,0,0,0.25)'; c.stroke(); };
    for (const y of [25.5, 6.5]) { pad(3.5, y, 1.5); pad(14.5, y, 1.5); }
    pad(9, 29, 2); pad(9, 3, 2);
    c.fillStyle = PAL.river[0]; c.fillRect(X(0), Y(S.RIVER_TOP), W * k, 2 * k);
    c.fillStyle = PAL.river[1]; c.fillRect(X(0), Y(S.RIVER_TOP), W * k, k * 0.22); c.fillRect(X(0), Y(S.RIVER_BOT) - k * 0.22, W * k, k * 0.22);
    c.fillStyle = PAL.bank; c.fillRect(X(0), Y(S.RIVER_TOP) - k * 0.14, W * k, k * 0.14); c.fillRect(X(0), Y(S.RIVER_BOT), W * k, k * 0.14);
    for (const b of S.BRIDGES) {
      const x0 = X(b - 1.1), w = 2.2 * k, y0 = Y(S.RIVER_TOP - 0.35), h = (2.7) * k;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x0 + k * 0.12, y0 + k * 0.15, w, h);
      rr(c, x0, y0, w, h, k * 0.12); paint(c, '#b47a43', k * 0.07);
      for (let i = 1; i < 7; i++) line(c, x0 + k * 0.1, y0 + (h * i) / 7, x0 + w - k * 0.1, y0 + (h * i) / 7, 'rgba(70,40,20,0.45)', k * 0.04);
      for (const side of [x0, x0 + w - k * 0.2]) { rr(c, side, y0 - k * 0.1, k * 0.2, h + k * 0.2, k * 0.08); paint(c, '#8a5a2e', k * 0.05); }
    }
    const flowers = PAL.specks;
    for (let i = 0; i < 44; i++) {
      const x = 0.4 + r() * (W - 0.8), y = 0.4 + r() * (H - 0.8);
      if (Math.abs(x - 3.5) < 2 || Math.abs(x - 14.5) < 2 || (y > 13.8 && y < 18.2) || (Math.abs(x - 9) < 3 && (y < 6 || y > 26))) continue;
      circ(c, X(x), Y(y), k * 0.08); c.fillStyle = flowers[i % 4]; c.fill();
    }
    const wall = (x, y, w, h) => {
      c.fillStyle = PAL.wall; c.fillRect(x, y, w, h);
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


  /* ---------- trainer portraits ---------- */
  // Head and shoulders of a trainer on a rounded square, from a look in js/trainers.js.
  function trainer(cv, look, locked) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, q = v => v * w;
    LW = Math.max(1.5, w * 0.022);
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, look.bg[0]); g.addColorStop(1, look.bg[1]);
    rr(c, 0, 0, w, h, q(0.14)); c.fillStyle = g; c.fill();
    c.save(); rr(c, 0, 0, w, h, q(0.14)); c.clip();
    const glow = c.createRadialGradient(q(0.5), q(0.4), q(0.05), q(0.5), q(0.4), q(0.6));
    glow.addColorStop(0, 'rgba(255,255,255,0.35)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow; c.fillRect(0, 0, w, h);
    // shoulders
    sh(c, () => rr(c, q(0.1), q(0.74), q(0.8), q(0.5), q(0.2)), look.shirt, shade(look.shirt), q(0.05));
    if (look.extra === 'armor') {
      for (const x of [0.06, 0.6]) sh(c, () => rr(c, q(x), q(0.76), q(0.34), q(0.18), q(0.09)), '#c4cad6', '#949cab', q(0.04));
      sh(c, () => rr(c, q(0.4), q(0.74), q(0.2), q(0.3), q(0.04)), '#dc3640', '#ae232d', q(0.03));
    }
    if (look.extra === 'scarf') sh(c, () => rr(c, q(0.3), q(0.7), q(0.4), q(0.12), q(0.06)), '#ffcd33', '#e09f12', q(0.03));
    if (look.extra === 'whistle') {
      rr(c, q(0.44), q(0.74), q(0.12), q(0.28), q(0.03)); paint(c, '#ffffff');
      line(c, q(0.36), q(0.74), q(0.5), q(0.9), OUT, q(0.018)); line(c, q(0.64), q(0.74), q(0.5), q(0.9), OUT, q(0.018));
      sh(c, () => rr(c, q(0.45), q(0.88), q(0.1), q(0.06), q(0.02)), '#c9ced6', null, 0);
    }
    // head
    for (const x of [0.24, 0.76]) sh(c, () => circ(c, q(x), q(0.5), q(0.06)), look.skin, null, 0);
    if (look.hair === 'curly') for (const [x, y, r] of [[0.28, 0.32, 0.11], [0.72, 0.32, 0.11], [0.26, 0.45, 0.08], [0.74, 0.45, 0.08]]) sh(c, () => circ(c, q(x), q(y), q(r)), look.hairCol, null, 0);
    sh(c, () => circ(c, q(0.5), q(0.47), q(0.27)), look.skin, shade(look.skin), q(0.04));
    if (look.hair === 'cap') {
      sh(c, () => { c.beginPath(); c.arc(q(0.5), q(0.42), q(0.29), Math.PI, 0); c.closePath(); }, look.hat, look.hatSh || shade(look.hat), q(0.04));
      sh(c, () => rr(c, q(0.42), q(0.36), q(0.48), q(0.07), q(0.03)), look.hatSh || shade(look.hat), null, 0);
      crownIcon(c, q(0.5), q(0.26), q(0.06), C.gold);
    } else if (look.hair === 'curly') {
      for (const [x, y, r] of [[0.32, 0.25, 0.11], [0.47, 0.19, 0.12], [0.62, 0.22, 0.11], [0.72, 0.3, 0.09], [0.26, 0.33, 0.08]]) sh(c, () => circ(c, q(x), q(y), q(r)), look.hairCol, null, 0);
      sh(c, () => rr(c, q(0.25), q(0.3), q(0.5), q(0.06), q(0.03)), look.band, null, 0);
    } else if (look.hair === 'beard') {
      sh(c, () => { c.beginPath(); c.arc(q(0.5), q(0.42), q(0.28), Math.PI * 1.02, Math.PI * 1.98); c.closePath(); }, look.hairCol, '#a4a8b5', q(0.03));
      sh(c, () => { c.beginPath(); c.moveTo(q(0.25), q(0.5)); c.quadraticCurveTo(q(0.24), q(0.84), q(0.5), q(0.9)); c.quadraticCurveTo(q(0.76), q(0.84), q(0.75), q(0.5)); c.quadraticCurveTo(q(0.5), q(0.66), q(0.25), q(0.5)); c.closePath(); }, look.hairCol, '#a4a8b5', q(0.04));
      line(c, q(0.33), q(0.4), q(0.45), q(0.43), OUT, q(0.028)); line(c, q(0.67), q(0.4), q(0.55), q(0.43), OUT, q(0.028));
      line(c, q(0.62), q(0.36), q(0.68), q(0.5), '#c98466', q(0.014));
    }
    const ey = look.hair === 'beard' ? 0.48 : 0.5;
    eye(c, q(0.41), q(ey), q(0.04)); eye(c, q(0.59), q(ey), q(0.04));
    c.beginPath();
    if (look.mouth === 'smile') c.arc(q(0.5), q(0.58), q(0.1), 0.2, Math.PI - 0.2);
    else if (look.mouth === 'smirk') { c.moveTo(q(0.42), q(0.63)); c.quadraticCurveTo(q(0.54), q(0.67), q(0.61), q(0.6)); }
    else { c.moveTo(q(0.43), q(0.6)); c.lineTo(q(0.57), q(0.6)); }
    c.lineWidth = q(0.022); c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke();
    if (look.mouth !== 'flat') { c.fillStyle = 'rgba(230,110,90,0.32)'; circ(c, q(0.34), q(0.58), q(0.04)); c.fill(); circ(c, q(0.66), q(0.58), q(0.04)); c.fill(); }
    c.restore();
    if (locked) {
      rr(c, 0, 0, w, h, q(0.14)); c.fillStyle = 'rgba(20,14,40,0.62)'; c.fill();
      sh(c, () => rr(c, q(0.36), q(0.48), q(0.28), q(0.22), q(0.04)), '#c9ccd6', '#9a9eab', q(0.04));
      c.beginPath(); c.arc(q(0.5), q(0.48), q(0.09), Math.PI, 0); c.lineWidth = q(0.04); c.strokeStyle = '#c9ccd6'; c.stroke();
    }
  }
  // A darker version of a #rrggbb colour, for the shaded side of a shape.
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16), f = v => Math.round(v * 0.78);
    return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
  }
  const owen = cv => trainer(cv, KC_TRAINERS[0].look);

  return { OUT, TEAM, THEMES, cannon, spearsArt, sandstormArt, troop, archerTower, kingTower, rubble, arena, portrait, fireballArt, crownIcon, owen, trainer, rr, circ, ell, line, paint, poly };
})();
