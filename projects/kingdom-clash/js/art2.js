/* Kingdom Clash: the troops, buildings and card pictures of Arenas 5 to 10 (Frostfang Keep, Blackwater
   Harbor, Gearforge Citadel, Crystal Chasm, Skyward Sanctuary, Eclipse Throne), drawn in code in the same
   style as js/art.js and added to it. Every drawing stands on (0, 0) at its feet, k pixels to a tile;
   o = { team, t, walk, atk (0 to 1 while hitting), face, view: 'front' | 'back', ... }. */
'use strict';

(() => {
  const A = KCArt, { OUT, TEAM, C, rr, circ, ell, line, paint, poly, sh, rope, dot } = A;
  const LW = () => A.lw();
  const ICE = ['#cfeeff', '#9fd4f0', '#e9f8ff'], CRYSTAL = ['#c9a8ff', '#8a5cf0', '#efe2ff'], GOLD = [C.gold, C.goldSh];
  const BRONZE = [C.bronze, C.bronzeSh], STEEL = ['#c9d0db', '#9aa3b2'], DARK = ['#3a3346', '#25202f'];
  const walkOf = (o, f) => (o.walk ? Math.sin(o.t * (f || 10)) : 0);
  // eyes looking out of a face (front view only)
  const eyes = (c, q, y, gap, r, col) => { for (const s of [-1, 1]) { circ(c, s * q(gap), q(y), q(r)); c.fillStyle = col || OUT; c.fill(); } };
  // a glow (additive), for crystals, sparks and fire
  function glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, col.replace(')', `,${a == null ? 0.7 : a})`).replace('rgb(', 'rgba(')); g.addColorStop(1, col.replace(')', ',0)').replace('rgb(', 'rgba('));
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
  }
  // a little ice shard or crystal: a diamond shape
  const shard = (c, x, y, w, h, cols) => sh(c, () => poly(c, [x, y - h, x + w, y - h * 0.35, x, y, x - w, y - h * 0.35]), cols[0], cols[1], h * 0.2);
  // two legs for a walking humanoid
  function legs(c, q, o, col, sep, h, w) {
    const st = walkOf(o) * q(0.05);
    for (const [x, ph] of [[-sep, 1], [sep, -1]]) sh(c, () => rr(c, q(x) - q(w / 2), -q(h) + st * ph, q(w), q(h) - st * ph, q(w * 0.4)), col, null, 0);
  }

  const T5 = {
    /* ---------- Arena 5: Frostfang Keep ---------- */
    // Frost Sprite: a hopping ball of frost with a crown of ice shards
    frostsprite(c, k, o) {
      const q = v => v * k * 1.3, T = TEAM[o.team], hop = Math.abs(Math.sin(o.t * 9)) * q(o.walk ? 0.18 : 0.06), front = o.view === 'front';
      c.save(); c.translate(0, -hop);
      glow(c, 0, q(-0.35), q(0.6), 'rgb(170,230,255)', 0.35);
      for (const [x, h] of [[-0.18, 0.28], [0, 0.36], [0.18, 0.28]]) shard(c, q(x), q(-0.5), q(0.08), q(h), ICE);
      sh(c, () => ell(c, 0, q(-0.3), q(0.3), q(0.27)), ICE[0], ICE[1], q(0.06));
      sh(c, () => rr(c, q(-0.2), q(-0.18), q(0.4), q(0.08), q(0.04)), T.main, T.sh, q(0.02));
      if (front) { eyes(c, q, -0.34, 0.1, 0.045, '#1f3a6a'); line(c, q(-0.05), q(-0.24), q(0.05), q(-0.24), '#1f3a6a', LW() * 0.8); }
      c.restore();
    },
    // Icebound Giant: a hulking giant of packed ice, blue rune on its chest
    icegiant(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = walkOf(o, 6), sw = o.atk, front = o.view === 'front';
      for (const s of [-1, 1]) sh(c, () => rr(c, s * q(0.24) - q(0.13), q(-0.36) + st * s * q(0.05), q(0.26), q(0.36), q(0.1)), ICE[1], '#7fb6d8', q(0.05));
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * q(0.48), q(-0.86)); c.rotate(s * (0.25 + (s > 0 ? sw : 0) * 0.9));
        sh(c, () => rr(c, -q(0.14), 0, q(0.28), q(0.62), q(0.13)), ICE[0], ICE[1], q(0.06));
        shard(c, 0, q(0.1), q(0.07), q(0.2), [ICE[2], ICE[1]]);
        c.restore();
      }
      sh(c, () => rr(c, q(-0.46), q(-1.12), q(0.92), q(0.82), q(0.32)), ICE[0], ICE[1], q(0.1));
      for (const [x, y, h] of [[-0.3, -1.08, 0.24], [0.02, -1.14, 0.3], [0.3, -1.06, 0.22]]) shard(c, q(x), q(y), q(0.09), q(h), [ICE[2], ICE[1]]);
      if (front) {
        sh(c, () => poly(c, [0, q(-0.88), q(0.12), q(-0.72), 0, q(-0.56), q(-0.12), q(-0.72)]), T.light, T.main, q(0.03));
        eyes(c, q, -0.98, 0.15, 0.05, '#1f3a6a');
        line(c, q(-0.24), q(-1.06), q(-0.06), q(-1.02), '#5f94bd', q(0.05)); line(c, q(0.24), q(-1.06), q(0.06), q(-1.02), '#5f94bd', q(0.05));
      } else sh(c, () => rr(c, q(-0.2), q(-0.95), q(0.4), q(0.08), q(0.04)), T.main, T.sh, q(0.02));
    },
    // Winter Sage: an old frost wizard in a team robe, a white beard and an ice-tipped staff
    wintersage(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', cast = o.atk;
      legs(c, q, o, '#5a6a88', 0.1, 0.2, 0.12);
      sh(c, () => poly(c, [q(-0.36), q(-0.16), q(0.36), q(-0.16), q(0.22), q(-0.86), q(-0.22), q(-0.86)]), T.main, T.sh, q(0.07));
      sh(c, () => rr(c, q(-0.37), q(-0.24), q(0.74), q(0.1), q(0.04)), ICE[0], ICE[1], q(0.03));
      // the staff
      c.save(); c.translate(q(0.36), q(-0.5)); c.rotate(-0.15 - cast * 0.5);
      rope(c, () => { c.beginPath(); c.moveTo(0, q(0.32)); c.lineTo(0, q(-0.72)); }, '#8a6a4a', q(0.06));
      shard(c, 0, q(-0.72), q(0.1), q(0.3), ICE);
      if (cast > 0.2) glow(c, 0, q(-0.86), q(0.4), 'rgb(170,230,255)', 0.6 * cast);
      c.restore();
      sh(c, () => circ(c, 0, q(-1.0), q(0.22)), C.skin, C.skinSh, q(0.04));
      if (front) {
        sh(c, () => poly(c, [q(-0.2), q(-0.98), q(0.2), q(-0.98), q(0.1), q(-0.62), 0, q(-0.54), q(-0.1), q(-0.62)]), '#f4f6fb', '#c9d2e2', q(0.04));
        eyes(c, q, -1.05, 0.08, 0.03);
      }
      sh(c, () => poly(c, [q(-0.3), q(-1.1), q(0.3), q(-1.1), q(0.06), q(-1.62), q(-0.04), q(-1.6)]), T.main, T.sh, q(0.05));
      sh(c, () => rr(c, q(-0.31), q(-1.16), q(0.62), q(0.09), q(0.04)), ICE[0], ICE[1], q(0.02));
      shard(c, 0, q(-1.24), q(0.05), q(0.12), [ICE[2], ICE[1]]);
    },

    /* ---------- Arena 6: Blackwater Harbor ---------- */
    // a Dock Raider: a quick pirate with a team bandana, a striped shirt and a cutlass
    raider(c, k, o) {
      const q = v => v * k * 0.85, T = TEAM[o.team], front = o.view === 'front', sw = o.atk;
      legs(c, q, o, '#4a3a2a', 0.1, 0.3, 0.12);
      sh(c, () => rr(c, q(-0.24), q(-0.7), q(0.48), q(0.42), q(0.12)), '#f3efe6', '#cfc8b8', q(0.05));
      for (const y of [-0.62, -0.52, -0.42]) line(c, q(-0.22), q(y), q(0.22), q(y), T.main, q(0.04));
      c.save(); c.translate(q(0.26), q(-0.58)); c.rotate(-0.7 + sw * 1.6);
      sh(c, () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.14), q(-0.3), q(0.04), q(-0.58)); c.lineTo(-q(0.03), q(-0.02)); c.closePath(); }, STEEL[0], STEEL[1], q(0.03));
      sh(c, () => rr(c, q(-0.07), q(-0.02), q(0.14), q(0.05), q(0.02)), GOLD[0], null, 0);
      c.restore();
      sh(c, () => circ(c, 0, q(-0.92), q(0.22)), C.skin, C.skinSh, q(0.04));
      if (front) { eyes(c, q, -0.94, 0.08, 0.03); line(c, q(-0.1), q(-0.82), q(0.1), q(-0.82), OUT, LW() * 0.8); }
      sh(c, () => { c.beginPath(); c.arc(0, q(-0.96), q(0.23), Math.PI, 0); c.closePath(); }, T.main, T.sh, q(0.04));
      sh(c, () => poly(c, [q(-0.22), q(-0.98), q(-0.36), q(-0.9), q(-0.3), q(-0.82)]), T.main, T.sh, q(0.02));
    },
    // the Dock Raiders card itself (the placement ghost): one of its cutlass pirates
    dockraiders(c, k, o) { T5.raider(c, k, o); },
    // a Harpoon Raider: a pirate in a vest with a bundle of little harpoons to throw
    raidergun(c, k, o) {
      const q = v => v * k * 0.85, T = TEAM[o.team], front = o.view === 'front', th = o.atk;
      legs(c, q, o, '#4a3a2a', 0.1, 0.3, 0.12);
      sh(c, () => rr(c, q(-0.24), q(-0.7), q(0.48), q(0.42), q(0.12)), '#f3efe6', '#cfc8b8', q(0.05));
      sh(c, () => poly(c, [q(-0.24), q(-0.7), q(-0.06), q(-0.7), q(-0.08), q(-0.3), q(-0.24), q(-0.3)]), '#6a4a2e', '#4e3420', q(0.03));
      sh(c, () => poly(c, [q(0.24), q(-0.7), q(0.06), q(-0.7), q(0.08), q(-0.3), q(0.24), q(-0.3)]), '#6a4a2e', '#4e3420', q(0.03));
      c.save(); c.translate(q(0.28), q(-0.62)); c.rotate(-0.4 - th * 1.2);
      line(c, 0, q(0.1), 0, q(-0.56), OUT, q(0.07)); line(c, 0, q(0.1), 0, q(-0.56), '#9a6a3a', q(0.04));
      poly(c, [0, q(-0.7), q(-0.06), q(-0.54), q(0.06), q(-0.54)]); paint(c, STEEL[0], LW() * 0.8);
      c.restore();
      sh(c, () => circ(c, 0, q(-0.92), q(0.22)), C.skin, C.skinSh, q(0.04));
      if (front) eyes(c, q, -0.94, 0.08, 0.03);
      sh(c, () => { c.beginPath(); c.arc(0, q(-0.96), q(0.23), Math.PI, 0); c.closePath(); }, T.main, T.sh, q(0.04));
    },
    // Harpoon Captain: a burly pirate captain, tricorn hat, beard, a great harpoon and a coil of rope
    harpoon(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk, throwing = o.hook || 0;
      legs(c, q, o, '#3e3024', 0.15, 0.36, 0.16);
      sh(c, () => rr(c, q(-0.4), q(-0.98), q(0.8), q(0.66), q(0.22)), '#5a3e28', '#3e2a1a', q(0.07));
      sh(c, () => rr(c, q(-0.18), q(-0.96), q(0.36), q(0.6), q(0.1)), '#f3efe6', '#cfc8b8', q(0.04));
      sh(c, () => rr(c, q(-0.41), q(-0.5), q(0.82), q(0.1), q(0.04)), T.main, T.sh, q(0.02));
      // the rope coil on his hip
      ell(c, q(-0.34), q(-0.48), q(0.14), q(0.11)); c.lineWidth = q(0.07); c.strokeStyle = OUT; c.stroke(); c.lineWidth = q(0.04); c.strokeStyle = '#d8b880'; c.stroke();
      // the harpoon
      c.save(); c.translate(q(0.42), q(-0.72)); c.rotate(-0.25 - sw * 1.1 - throwing * 0.8);
      rope(c, () => { c.beginPath(); c.moveTo(0, q(0.5)); c.lineTo(0, q(-0.9)); }, '#8a6a44', q(0.07));
      if (throwing < 0.5) { poly(c, [0, q(-1.12), q(-0.1), q(-0.88), q(0.1), q(-0.88)]); paint(c, STEEL[0], LW()); line(c, q(-0.1), q(-0.88), q(-0.16), q(-0.98), OUT, q(0.04)); }
      c.restore();
      sh(c, () => circ(c, 0, q(-1.2), q(0.28)), C.skin, C.skinSh, q(0.05));
      if (front) {
        sh(c, () => { c.beginPath(); c.arc(0, q(-1.12), q(0.27), 0.2, Math.PI - 0.2); c.closePath(); }, '#7a4a2a', '#5a341c', q(0.04));
        eyes(c, q, -1.26, 0.1, 0.035);
      }
      sh(c, () => poly(c, [q(-0.46), q(-1.36), q(0.46), q(-1.36), q(0.3), q(-1.6), 0, q(-1.52), q(-0.3), q(-1.6)]), DARK[0], DARK[1], q(0.05));
      sh(c, () => rr(c, q(-0.3), q(-1.42), q(0.6), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
    },
    // Broadside Cart: a ship's cannon on a wooden cart, behind a plank shield while the shield holds
    broadside(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', roll = o.t * (o.walk ? 6 : 0), rec = o.atk * q(0.12);
      for (const s of [-1, 1]) {
        sh(c, () => circ(c, s * q(0.5), q(-0.2), q(0.2)), C.wood, C.woodSh, q(0.05));
        for (let i = 0; i < 3; i++) { const a = roll + i * 1.05; line(c, s * q(0.5) - Math.cos(a) * q(0.16), q(-0.2) - Math.sin(a) * q(0.16), s * q(0.5) + Math.cos(a) * q(0.16), q(-0.2) + Math.sin(a) * q(0.16), C.woodSh, LW() * 0.8); }
      }
      sh(c, () => rr(c, q(-0.62), q(-0.56), q(1.24), q(0.34), q(0.06)), C.wood, C.woodSh, q(0.06));
      sh(c, () => rr(c, q(-0.62), q(-0.36), q(1.24), q(0.06), q(0.02)), T.main, T.sh, q(0.02));
      // the cannon barrel, pointing where it faces
      c.save(); c.translate(0, q(-0.72) + (front ? rec : -rec));
      sh(c, () => rr(c, q(-0.2), q(-0.18), q(0.4), q(0.36), q(0.16)), '#3e414c', '#2a2c34', q(0.05));
      sh(c, () => ell(c, 0, front ? q(0.18) : q(-0.2), q(0.17), q(0.1)), '#555a66', null, 0);
      if (front) { ell(c, 0, q(0.18), q(0.1), q(0.06)); c.fillStyle = '#15161b'; c.fill(); }
      c.restore();
      if (o.shield) {
        // the plank shield in front, with iron bands
        const y0 = front ? -0.5 : -1.0;
        sh(c, () => rr(c, q(-0.58), q(y0), q(1.16), q(0.5), q(0.06)), '#a8743e', '#835628', q(0.05));
        for (const x of [-0.29, 0, 0.29]) line(c, q(x), q(y0), q(x), q(y0 + 0.5), '#6e4622', LW() * 0.7);
        for (const y of [0.12, 0.38]) line(c, q(-0.58), q(y0 + y), q(0.58), q(y0 + y), '#5a5f6a', q(0.05));
      }
    },

    /* ---------- Arena 7: Gearforge Citadel ---------- */
    // a Sparkbot: a little boxy robot on treads with a sparking antenna
    sparkbots(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', zap = o.atk, bob = walkOf(o, 14) * q(0.03);
      sh(c, () => rr(c, q(-0.3), q(-0.18), q(0.6), q(0.18), q(0.08)), '#4a4a55', '#33333c', q(0.04));
      c.save(); c.translate(0, bob);
      sh(c, () => rr(c, q(-0.28), q(-0.66), q(0.56), q(0.5), q(0.1)), BRONZE[0], BRONZE[1], q(0.06));
      sh(c, () => rr(c, q(-0.2), q(-0.4), q(0.4), q(0.14), q(0.04)), T.main, T.sh, q(0.02));
      if (front) { sh(c, () => circ(c, 0, q(-0.52), q(0.09)), '#bff4ff', '#6fd0f0', q(0.02)); glow(c, 0, q(-0.52), q(0.2), 'rgb(120,220,255)', 0.4); }
      line(c, 0, q(-0.66), 0, q(-0.92), OUT, q(0.06)); line(c, 0, q(-0.66), 0, q(-0.92), '#c9d0db', q(0.03));
      sh(c, () => circ(c, 0, q(-0.96), q(0.07)), '#ffe27a', '#e0b030', q(0.02));
      if (zap > 0.1 || Math.sin(o.t * 7) > 0.8) glow(c, 0, q(-0.96), q(0.3 + zap * 0.3), 'rgb(150,230,255)', 0.7);
      c.restore();
    },
    // Steel Titan: an enormous clockwork giant, bronze plates, turning gears and a glowing core
    titan(c, k, o) { titanArt(c, k * 1.0, o, true); },
    titanling(c, k, o) { titanArt(c, k * 0.62, o, false); },
    // Arc Cannon: a heavy engine on treads with a great coil cannon that glows as it charges
    arccannon(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', ch = Math.max(0, Math.min(1, o.charge || 0));
      sh(c, () => rr(c, q(-0.66), q(-0.3), q(1.32), q(0.3), q(0.14)), '#3e3e48', '#2a2a32', q(0.05));
      for (let i = 0; i < 5; i++) dot(c, q(-0.5 + i * 0.25), q(-0.15), q(0.06), '#6a6a76');
      sh(c, () => rr(c, q(-0.56), q(-0.78), q(1.12), q(0.52), q(0.14)), BRONZE[0], BRONZE[1], q(0.07));
      sh(c, () => rr(c, q(-0.56), q(-0.5), q(1.12), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
      // the coil barrel
      const y = front ? -0.98 : -1.08;
      sh(c, () => rr(c, q(-0.24), q(y - 0.34), q(0.48), q(0.62), q(0.2)), '#555a66', '#3a3e48', q(0.05));
      for (let i = 0; i < 4; i++) line(c, q(-0.25), q(y - 0.24 + i * 0.13), q(0.25), q(y - 0.24 + i * 0.13), '#d39a48', q(0.05));
      const cy = q(y - 0.42);
      sh(c, () => circ(c, 0, cy, q(0.16)), ch > 0.95 ? '#e8fbff' : '#8fd8ff', '#4a9ee0', q(0.03));
      if (ch > 0.05) glow(c, 0, cy, q(0.3 + ch * 0.7), 'rgb(140,220,255)', 0.3 + ch * 0.5);
      if (ch > 0.95) for (let i = 0; i < 3; i++) { const a = o.t * 9 + i * 2.1; line(c, Math.cos(a) * q(0.16), cy + Math.sin(a) * q(0.16), Math.cos(a) * q(0.42), cy + Math.sin(a) * q(0.42), '#e8fbff', q(0.03)); }
    },

    /* ---------- Arena 8: Crystal Chasm ---------- */
    // a Shard Guard: crystal armor, a crystal kite shield (while it holds) and a long spear
    shardguards(c, k, o) {
      const q = v => v * k * 0.9, T = TEAM[o.team], front = o.view === 'front', thrust = o.atk;
      legs(c, q, o, '#3e3a52', 0.1, 0.3, 0.12);
      sh(c, () => rr(c, q(-0.24), q(-0.72), q(0.48), q(0.44), q(0.12)), CRYSTAL[0], CRYSTAL[1], q(0.06));
      sh(c, () => rr(c, q(-0.25), q(-0.4), q(0.5), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
      c.save(); c.translate(q(0.28), q(-0.6) - thrust * q(0.2));
      line(c, 0, q(0.4), 0, q(-0.9), OUT, q(0.07)); line(c, 0, q(0.4), 0, q(-0.9), '#9a8ab8', q(0.04));
      shard(c, 0, q(-0.88), q(0.07), q(0.24), CRYSTAL);
      c.restore();
      if (o.shield) {
        c.save(); c.translate(q(-0.26), q(-0.56));
        sh(c, () => poly(c, [0, q(-0.3), q(0.2), q(-0.16), q(0.14), q(0.2), 0, q(0.32), q(-0.14), q(0.2), q(-0.2), q(-0.16)]), '#e4d2ff', '#a882f0', q(0.04));
        glow(c, 0, 0, q(0.35), 'rgb(200,170,255)', 0.35);
        c.restore();
      }
      sh(c, () => circ(c, 0, q(-0.94), q(0.21)), front ? C.skin : CRYSTAL[1], front ? C.skinSh : CRYSTAL[1], q(0.04));
      if (front) eyes(c, q, -0.96, 0.08, 0.03);
      sh(c, () => poly(c, [q(-0.24), q(-0.98), q(0.24), q(-0.98), q(0.12), q(-1.32), 0, q(-1.42), q(-0.12), q(-1.32)]), CRYSTAL[0], CRYSTAL[1], q(0.04));
    },
    // a Crystal Imp: a little hopping creature of living crystal
    imp(c, k, o) {
      const q = v => v * k * 0.8, T = TEAM[o.team], front = o.view === 'front', hop = Math.abs(walkOf(o, 12)) * q(0.12);
      c.save(); c.translate(0, -hop);
      legs(c, q, o, CRYSTAL[1], 0.1, 0.22, 0.1);
      sh(c, () => poly(c, [0, q(-0.98), q(0.28), q(-0.62), q(0.22), q(-0.22), q(-0.22), q(-0.22), q(-0.28), q(-0.62)]), CRYSTAL[0], CRYSTAL[1], q(0.06));
      sh(c, () => rr(c, q(-0.2), q(-0.36), q(0.4), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
      if (front) eyes(c, q, -0.6, 0.08, 0.045, '#fff6a8');
      for (const s of [-1, 1]) line(c, s * q(0.24), q(-0.52), s * q(0.38), q(-0.4 - (s > 0 ? o.atk * 0.3 : 0)), CRYSTAL[1], q(0.06));
      c.restore();
    },
    // Prism Archer: a hooded archer with a crystal bow and a glowing quiver
    prism(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', draw = o.atk;
      legs(c, q, o, '#3a3450', 0.1, 0.32, 0.13);
      sh(c, () => poly(c, [q(-0.3), q(-0.3), q(0.3), q(-0.3), q(0.22), q(-0.86), q(-0.22), q(-0.86)]), T.main, T.sh, q(0.06));
      sh(c, () => rr(c, q(-0.3), q(-0.4), q(0.6), q(0.08), q(0.03)), CRYSTAL[0], CRYSTAL[1], q(0.02));
      // the bow
      c.save(); c.translate(q(0.34), q(-0.68));
      c.beginPath(); c.arc(0, 0, q(0.42), -1.2, 1.2); c.lineWidth = q(0.1); c.strokeStyle = OUT; c.stroke(); c.lineWidth = q(0.06); c.strokeStyle = CRYSTAL[0]; c.stroke();
      line(c, Math.cos(-1.2) * q(0.42), Math.sin(-1.2) * q(0.42), -draw * q(0.16), 0, '#efe2ff', q(0.02));
      line(c, -draw * q(0.16), 0, Math.cos(1.2) * q(0.42), Math.sin(1.2) * q(0.42), '#efe2ff', q(0.02));
      if (draw > 0.2) glow(c, 0, 0, q(0.4), 'rgb(220,190,255)', 0.5 * draw);
      c.restore();
      sh(c, () => circ(c, 0, q(-1.04), q(0.22)), C.skin, C.skinSh, q(0.04));
      if (front) eyes(c, q, -1.04, 0.08, 0.03);
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.06), q(0.27), Math.PI * 0.95, Math.PI * 0.05); c.lineTo(q(0.12), q(-1.44)); c.lineTo(q(-0.12), q(-1.44)); c.closePath(); }, T.main, T.sh, q(0.05));
      shard(c, q(-0.28), q(-0.78), q(0.06), q(0.3), CRYSTAL);
    },

    /* ---------- Arena 9: Skyward Sanctuary ---------- */
    // Sun Sprite: a little ball of warm light with a ring of rays
    sunsprite(c, k, o) {
      const q = v => v * k * 1.3, T = TEAM[o.team], hop = Math.abs(Math.sin(o.t * 9)) * q(o.walk ? 0.18 : 0.06), front = o.view === 'front';
      c.save(); c.translate(0, -hop);
      glow(c, 0, q(-0.34), q(0.7), 'rgb(255,220,120)', 0.45);
      for (let i = 0; i < 8; i++) { const a = i * 0.785 + o.t * 1.5; line(c, Math.cos(a) * q(0.26), q(-0.34) + Math.sin(a) * q(0.26), Math.cos(a) * q(0.4), q(-0.34) + Math.sin(a) * q(0.4), '#ffd23f', q(0.06)); }
      sh(c, () => circ(c, 0, q(-0.34), q(0.24)), '#fff1a6', '#ffcd33', q(0.05));
      sh(c, () => rr(c, q(-0.16), q(-0.16), q(0.32), q(0.06), q(0.03)), T.main, T.sh, q(0.02));
      if (front) { eyes(c, q, -0.37, 0.08, 0.035, '#8a5a10'); c.beginPath(); c.arc(0, q(-0.3), q(0.07), 0.2, Math.PI - 0.2); c.strokeStyle = '#8a5a10'; c.lineWidth = LW() * 0.8; c.stroke(); }
      c.restore();
    },
    // Celestial Guardian: radiant armor, a halo, small wings and a glowing hammer that heals
    guardian(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk;
      for (const s of [-1, 1]) sh(c, () => poly(c, [s * q(0.2), q(-0.9), s * q(0.62), q(-1.16), s * q(0.56), q(-0.84), s * q(0.48), q(-0.62), s * q(0.2), q(-0.6)]), '#ffffff', '#d9dfe9', q(0.04));
      legs(c, q, o, STEEL[1], 0.13, 0.34, 0.15);
      sh(c, () => rr(c, q(-0.32), q(-0.92), q(0.64), q(0.6), q(0.16)), '#f1f3f8', '#c9cfdc', q(0.06));
      sh(c, () => poly(c, [0, q(-0.86), q(0.12), q(-0.7), 0, q(-0.54), q(-0.12), q(-0.7)]), GOLD[0], GOLD[1], q(0.03));
      sh(c, () => rr(c, q(-0.33), q(-0.44), q(0.66), q(0.1), q(0.04)), T.main, T.sh, q(0.02));
      c.save(); c.translate(q(0.38), q(-0.72)); c.rotate(-0.4 + sw * 1.6);
      rope(c, () => { c.beginPath(); c.moveTo(0, q(0.18)); c.lineTo(0, q(-0.54)); }, '#c9a060', q(0.06));
      sh(c, () => rr(c, q(-0.2), q(-0.74), q(0.4), q(0.24), q(0.06)), GOLD[0], GOLD[1], q(0.04));
      glow(c, 0, q(-0.62), q(0.35 + sw * 0.3), 'rgb(255,230,140)', 0.4 + sw * 0.4);
      c.restore();
      sh(c, () => circ(c, 0, q(-1.14), q(0.24)), C.skin, C.skinSh, q(0.04));
      if (front) eyes(c, q, -1.14, 0.08, 0.03);
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.18), q(0.26), Math.PI, 0); c.lineTo(q(0.26), q(-1.1)); c.lineTo(q(-0.26), q(-1.1)); c.closePath(); }, '#f1f3f8', '#c9cfdc', q(0.04));
      ell(c, 0, q(-1.5), q(0.22), q(0.07)); c.lineWidth = q(0.07); c.strokeStyle = OUT; c.stroke(); c.lineWidth = q(0.04); c.strokeStyle = '#ffe27a'; c.stroke();
    },
    // Cloud Drake: a young flying drake of storm-blue scales with cloud-white wings
    drake(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 8 + (o.id || 0)), front = o.view === 'front', breath = o.atk;
      for (const s of [-1, 1]) {
        c.save(); c.scale(s, 1); c.translate(q(0.2), q(-0.1)); c.rotate(-0.2 - flap * 0.4);
        sh(c, () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.4), q(-0.6), q(0.86), q(-0.42)); c.quadraticCurveTo(q(0.62), q(-0.2), q(0.7), q(0.02)); c.quadraticCurveTo(q(0.4), q(-0.04), q(0.34), q(0.12)); c.quadraticCurveTo(q(0.16), q(0.06), 0, q(0.12)); c.closePath(); }, '#eef6ff', '#bcd2ea', q(0.05));
        c.restore();
      }
      sh(c, () => poly(c, [0, q(0.1), q(0.12), q(0.5), q(0.02), q(0.7), q(-0.06), q(0.52)]), '#6fa8d8', '#4a84b8', q(0.04));
      sh(c, () => ell(c, 0, 0, q(0.26), q(0.32)), '#6fa8d8', '#4a84b8', q(0.06));
      sh(c, () => ell(c, 0, q(0.06), q(0.15), q(0.2)), '#dff0ff', '#b4d2ee', q(0.04));
      sh(c, () => rr(c, q(-0.22), q(-0.06), q(0.44), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
      sh(c, () => ell(c, 0, q(-0.38), q(0.2), q(0.18)), '#6fa8d8', '#4a84b8', q(0.04));
      for (const s of [-1, 1]) sh(c, () => poly(c, [s * q(0.1), q(-0.5), s * q(0.2), q(-0.68), s * q(0.16), q(-0.46)]), '#eef6ff', '#bcd2ea', q(0.02));
      if (front) { eyes(c, q, -0.4, 0.08, 0.035); if (breath > 0.2) glow(c, 0, q(-0.22), q(0.4), 'rgb(220,240,255)', 0.6 * breath); }
    },
    // Dawn Phoenix (and the reborn one): a golden firebird with a tail of flame
    phoenix(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 10 + (o.id || 0)), front = o.view === 'front';
      glow(c, 0, 0, q(0.9), 'rgb(255,170,60)', 0.35);
      for (let i = 0; i < 3; i++) sh(c, () => poly(c, [q(-0.08 + i * 0.08), q(0.1), q(-0.2 + i * 0.2), q(0.7 + Math.sin(o.t * 12 + i) * 0.06), q(0.04 + i * 0.04), q(0.2)]), i === 1 ? '#ffd23f' : '#ff8a2a', '#e05a1a', q(0.03));
      for (const s of [-1, 1]) {
        c.save(); c.scale(s, 1); c.translate(q(0.16), q(-0.1)); c.rotate(-0.25 - flap * 0.5);
        sh(c, () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.36), q(-0.56), q(0.84), q(-0.5)); c.lineTo(q(0.66), q(-0.32)); c.lineTo(q(0.74), q(-0.18)); c.lineTo(q(0.5), q(-0.1)); c.lineTo(q(0.52), q(0.04)); c.quadraticCurveTo(q(0.2), q(0.1), 0, q(0.12)); c.closePath(); }, '#ffb52e', '#e0761a', q(0.05));
        c.restore();
      }
      sh(c, () => ell(c, 0, 0, q(0.22), q(0.3)), '#ffcd33', '#e09f12', q(0.06));
      sh(c, () => rr(c, q(-0.2), q(-0.02), q(0.4), q(0.06), q(0.03)), T.main, T.sh, q(0.02));
      sh(c, () => circ(c, 0, q(-0.34), q(0.18)), '#ffcd33', '#e09f12', q(0.04));
      for (const x of [-0.08, 0, 0.08]) sh(c, () => poly(c, [q(x - 0.04), q(-0.46), q(x), q(-0.7), q(x + 0.04), q(-0.46)]), '#ff8a2a', '#e05a1a', q(0.02));
      if (front) { eyes(c, q, -0.36, 0.07, 0.03); sh(c, () => poly(c, [q(-0.05), q(-0.3), q(0.05), q(-0.3), 0, q(-0.18)]), '#fff1c0', '#e0c080', q(0.02)); }
    },
    // the Phoenix egg: a warm, glowing egg that pulses as it gets ready to hatch
    phoenixegg(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], p = o.hatch || 0, beat = 0.5 + 0.5 * Math.sin(o.t * (4 + p * 10));
      glow(c, 0, q(-0.36), q(0.6 + beat * 0.2), 'rgb(255,170,60)', 0.3 + p * 0.4);
      sh(c, () => ell(c, 0, q(-0.36), q(0.28), q(0.36)), '#ffe9a8', '#f0b44a', q(0.07));
      for (const [x, y] of [[-0.1, -0.5], [0.12, -0.3], [-0.06, -0.18]]) dot(c, q(x), q(y), q(0.04), '#ff8a2a');
      sh(c, () => rr(c, q(-0.24), q(-0.12), q(0.48), q(0.06), q(0.03)), T.main, T.sh, q(0.02));
    },

    /* ---------- Arena 10: Eclipse Throne ---------- */
    // a wraith (the Wraith Army's, and the Abyss Gate's): a spectral swordsman, half see-through
    wraiths(c, k, o) { wraithArt(c, k, o); },
    wraith(c, k, o) { wraithArt(c, k, o); },
    // Dread Knight: a towering knight in black plate with crimson light in the seams, a great blade
    dreadknight(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk;
      legs(c, q, o, DARK[1], 0.2, 0.44, 0.22);
      for (const s of [-1, 1]) sh(c, () => rr(c, s * q(0.58) - q(0.2), q(-1.32), q(0.4), q(0.28), q(0.12)), DARK[0], DARK[1], q(0.05));
      sh(c, () => rr(c, q(-0.5), q(-1.32), q(1.0), q(0.92), q(0.22)), DARK[0], DARK[1], q(0.08));
      for (const y of [-1.06, -0.8]) line(c, q(-0.42), q(y), q(0.42), q(y), '#c0283a', q(0.04));
      glow(c, 0, q(-0.94), q(0.5), 'rgb(220,40,60)', 0.3);
      sh(c, () => rr(c, q(-0.51), q(-0.5), q(1.02), q(0.12), q(0.05)), T.main, T.sh, q(0.03));
      c.save(); c.translate(q(0.62), q(-1.0)); c.rotate(-0.5 + sw * 1.8);
      sh(c, () => poly(c, [q(-0.1), 0, q(0.1), 0, q(0.08), q(-1.2), 0, q(-1.36), q(-0.08), q(-1.2)]), '#5a5466', '#3a3446', q(0.05));
      line(c, 0, q(-0.1), 0, q(-1.2), '#c0283a', q(0.03));
      sh(c, () => rr(c, q(-0.24), q(-0.04), q(0.48), q(0.1), q(0.04)), '#8a8496', null, 0);
      c.restore();
      sh(c, () => rr(c, q(-0.3), q(-1.82), q(0.6), q(0.56), q(0.2)), DARK[0], DARK[1], q(0.06));
      if (front) { rr(c, q(-0.22), q(-1.6), q(0.44), q(0.08), q(0.03)); c.fillStyle = '#ff3a4a'; c.fill(); glow(c, 0, q(-1.56), q(0.4), 'rgb(255,60,80)', 0.5); }
      for (const s of [-1, 1]) sh(c, () => poly(c, [s * q(0.22), q(-1.74), s * q(0.5), q(-2.1), s * q(0.32), q(-1.68)]), DARK[0], DARK[1], q(0.03));
    },
  };

  // Steel Titan (big) and a Titanling (small): bronze plates, gear shoulders, a glowing core
  function titanArt(c, k, o, big) {
    const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', st = walkOf(o, 5), sw = o.atk;
    for (const s of [-1, 1]) sh(c, () => rr(c, s * q(0.36) - q(0.18), q(-0.5) + st * s * q(0.06), q(0.36), q(0.5), q(0.12)), '#6a5a48', '#4e4234', q(0.06));
    for (const s of [-1, 1]) {
      c.save(); c.translate(s * q(0.72), q(-1.3)); c.rotate(s * (0.2 + (s > 0 ? sw * 1.0 : 0)));
      sh(c, () => rr(c, -q(0.2), 0, q(0.4), q(0.9), q(0.16)), BRONZE[0], BRONZE[1], q(0.07));
      sh(c, () => circ(c, 0, q(0.92), q(0.22)), '#6a5a48', '#4e4234', q(0.05));
      c.restore();
      // a turning gear on each shoulder
      c.save(); c.translate(s * q(0.62), q(-1.36)); c.rotate(o.t * 2 * s);
      for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); rr(c, -q(0.05), -q(0.26), q(0.1), q(0.1), q(0.02)); paint(c, BRONZE[1], LW() * 0.6); }
      sh(c, () => circ(c, 0, 0, q(0.2)), BRONZE[0], BRONZE[1], q(0.04));
      dot(c, 0, 0, q(0.06), '#3a2f24');
      c.restore();
    }
    sh(c, () => rr(c, q(-0.6), q(-1.6), q(1.2), q(1.14), q(0.3)), BRONZE[0], BRONZE[1], q(0.1));
    for (const [x, y] of [[-0.46, -1.48], [0.46, -1.48], [-0.46, -0.6], [0.46, -0.6]]) dot(c, q(x), q(y), q(0.04), '#6a4a24');
    sh(c, () => rr(c, q(-0.61), q(-0.7), q(1.22), q(0.12), q(0.05)), T.main, T.sh, q(0.03));
    if (front) {
      sh(c, () => circ(c, 0, q(-1.08), q(0.2)), '#ffe9a8', '#ffb52e', q(0.04));
      glow(c, 0, q(-1.08), q(big ? 0.6 : 0.4), 'rgb(255,190,80)', 0.45);
    }
    sh(c, () => rr(c, q(-0.28), q(-1.98), q(0.56), q(0.42), q(0.12)), BRONZE[0], BRONZE[1], q(0.06));
    if (front) { rr(c, q(-0.18), q(-1.84), q(0.36), q(0.1), q(0.04)); c.fillStyle = '#7fe0ff'; c.fill(); }
  }
  // a wraith: hooded, see-through, a ghostly blade
  function wraithArt(c, k, o) {
    const q = v => v * k * 0.9, T = TEAM[o.team], front = o.view === 'front', sw = o.atk, drift = Math.sin(o.t * 3 + (o.id || 0)) * q(0.04);
    c.save(); c.globalAlpha *= 0.85; c.translate(0, drift);
    glow(c, 0, q(-0.5), q(0.55), 'rgb(170,120,255)', 0.3);
    sh(c, () => { c.beginPath(); c.moveTo(q(-0.22), q(-0.9)); c.quadraticCurveTo(q(-0.3), q(-0.3), q(-0.24), 0); c.lineTo(q(-0.12), q(-0.1)); c.lineTo(0, 0); c.lineTo(q(0.12), q(-0.1)); c.lineTo(q(0.24), 0); c.quadraticCurveTo(q(0.3), q(-0.3), q(0.22), q(-0.9)); c.closePath(); }, '#5a4a7a', '#3e3058', q(0.05));
    sh(c, () => rr(c, q(-0.23), q(-0.5), q(0.46), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
    c.save(); c.translate(q(0.24), q(-0.56)); c.rotate(-0.6 + sw * 1.6);
    sh(c, () => poly(c, [q(-0.03), 0, q(0.03), 0, q(0.02), q(-0.46), 0, q(-0.52), q(-0.02), q(-0.46)]), '#d9c8ff', '#a88ae0', q(0.02));
    c.restore();
    sh(c, () => { c.beginPath(); c.arc(0, q(-0.98), q(0.2), Math.PI * 0.9, Math.PI * 0.1); c.lineTo(0, q(-1.3)); c.closePath(); }, '#4a3a6a', '#32264a', q(0.04));
    if (front) eyes(c, q, -0.96, 0.07, 0.03, '#c9a8ff');
    c.restore();
  }

  /* ---------- buildings ---------- */
  const BUILD = {
    // Coil Tower: a copper coil on a stone base with a sphere on top; hidden, it is just a hatch in the ground
    coil(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], up = o.hidden ? 0 : Math.max(0, Math.min(1, 1 - (o.rise || 0) / 0.6));
      ell(c, 0, q(0.4), q(0.95), q(0.36)); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
      sh(c, () => rr(c, q(-0.85), q(-0.1), q(1.7), q(0.6), q(0.16)), '#8a8590', '#5f5b66', q(0.1));
      sh(c, () => rr(c, q(-0.86), q(0.28), q(1.72), q(0.1), q(0.04)), T.main, T.sh, q(0.03));
      ell(c, 0, q(0.05), q(0.5), q(0.2)); c.fillStyle = '#2a2632'; c.fill();
      if (up <= 0) { for (const s of [-1, 1]) line(c, s * q(0.45), q(0.05), 0, q(0.05), '#5f5b66', LW()); return; }
      c.save(); c.translate(0, (1 - up) * q(1.4));
      c.beginPath(); c.rect(-q(1), -q(3), q(2), q(3) + (1 - up) * -q(1.4) + q(0.1)); c.clip();
      sh(c, () => rr(c, q(-0.2), q(-1.3), q(0.4), q(1.35), q(0.1)), '#555a66', '#3a3e48', q(0.05));
      for (let i = 0; i < 6; i++) line(c, q(-0.28), q(-1.18 + i * 0.2), q(0.28), q(-1.12 + i * 0.2), '#d38a3a', q(0.07));
      sh(c, () => circ(c, 0, q(-1.5), q(0.24)), '#bff4ff', '#6fd0f0', q(0.05));
      const at = o.atk || 0;
      glow(c, 0, q(-1.5), q(0.5 + at * 0.4), 'rgb(140,220,255)', 0.4 + at * 0.5);
      c.restore();
    },
    // the Broadside Cart once its shield is gone: the cart chocked in place, its cannon free to turn
    broadside(c, k, o) {
      const q = v => v * k, T = TEAM[o.team];
      ell(c, 0, q(0.42), q(0.9), q(0.32)); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
      for (const s of [-1, 1]) { sh(c, () => circ(c, s * q(0.55), q(0.18), q(0.22)), C.wood, C.woodSh, q(0.05)); sh(c, () => poly(c, [s * q(0.4), q(0.42), s * q(0.7), q(0.42), s * q(0.55), q(0.22)]), '#6e4622', null, 0); }
      sh(c, () => rr(c, q(-0.68), q(-0.24), q(1.36), q(0.42), q(0.08)), C.wood, C.woodSh, q(0.06));
      sh(c, () => rr(c, q(-0.68), q(0.02), q(1.36), q(0.07), q(0.02)), T.main, T.sh, q(0.02));
      c.save(); c.translate(0, -q(0.3)); c.rotate(o.angle || 0);
      const rec = (o.atk || 0) * q(0.14);
      sh(c, () => rr(c, -q(0.3) - rec, -q(0.2), q(1.0), q(0.4), q(0.18)), '#3e414c', '#2a2c34', q(0.07));
      circ(c, q(0.7) - rec, 0, q(0.12)); c.fillStyle = '#15161b'; c.fill();
      c.restore();
    },
    // Crystal Drill: a conical crystal drill bit on a mining frame, spinning; imps climb out of it
    drill(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], spin = o.t * 8;
      ell(c, 0, q(0.38), q(0.9), q(0.32)); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      for (let i = 0; i < 7; i++) { const a = i * 0.9; circ(c, Math.cos(a) * q(0.72), q(0.25) + Math.sin(a) * q(0.24), q(0.12)); c.fillStyle = i % 2 ? '#6e5a90' : '#4a3e66'; c.fill(); }
      sh(c, () => rr(c, q(-0.7), q(-0.3), q(1.4), q(0.5), q(0.12)), '#6a5a48', '#4e4234', q(0.07));
      sh(c, () => rr(c, q(-0.71), q(-0.06), q(1.42), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
      for (const s of [-1, 1]) line(c, s * q(0.5), q(-0.3), s * q(0.2), q(-1.3), '#8a7a66', q(0.08));
      c.save(); c.translate(0, q(-0.75));
      sh(c, () => poly(c, [q(-0.36), q(-0.5), q(0.36), q(-0.5), 0, q(0.5)]), CRYSTAL[0], CRYSTAL[1], q(0.06));
      for (let i = 0; i < 3; i++) { const y = ((spin * 0.1 + i / 3) % 1) - 0.4; line(c, q(-0.32 * (0.5 - y)), q(y), q(0.32 * (0.5 - y)), q(y + 0.1), '#efe2ff', q(0.04)); }
      glow(c, 0, 0, q(0.6), 'rgb(200,170,255)', 0.35);
      c.restore();
    },
  };

  /* ---------- card pictures ---------- */
  const one = (y, s, oo) => (c, w, h, k, at) => at(0.5, y, s, oo || {});
  const PICS = {
    frostsprite: (c, w, h, k, at) => { at(0.5, 0.86, 2.0, {}); },
    icegiant: one(0.92, 1.0),
    wintersage: one(0.94, 1.05),
    dockraiders: (c, w, h, k, at) => { at(0.27, 0.72, 1.0, { card: 'raidergun' }); at(0.73, 0.72, 1.0, { card: 'raidergun' }); at(0.5, 0.94, 1.25, { card: 'raider' }); },
    harpoon: one(0.94, 0.88),
    broadside: (c, w, h, k, at) => at(0.5, 0.9, 1.05, { shield: 1, view: 'back' }),
    sparkbots: (c, w, h, k, at) => { at(0.27, 0.7, 1.1, { t: 0.5 }); at(0.73, 0.7, 1.1, { t: 1.2 }); at(0.5, 0.92, 1.4, { atk: 1 }); },
    titan: one(0.95, 0.66),
    arccannon: (c, w, h, k, at) => at(0.5, 0.92, 1.0, { charge: 1 }),
    shardguards: (c, w, h, k, at) => { at(0.27, 0.74, 1.0, { shield: 1 }); at(0.73, 0.74, 1.0, { shield: 1 }); at(0.5, 0.95, 1.2, { shield: 1 }); },
    prism: (c, w, h, k, at) => at(0.5, 0.94, 0.95, { atk: 0.8 }),
    sunsprite: (c, w, h, k, at) => at(0.5, 0.82, 2.0, {}),
    guardian: (c, w, h, k, at) => at(0.5, 0.94, 0.95, { atk: 0.4 }),
    drake: (c, w, h, k, at) => at(0.5, 0.6, 1.25, { t: 0.3 }),
    phoenix: (c, w, h, k, at) => at(0.5, 0.58, 1.25, { t: 0.2 }),
    wraiths: (c, w, h, k, at) => { for (const [x, y, s] of [[0.22, 0.66, 1.0], [0.5, 0.62, 1.0], [0.78, 0.66, 1.0], [0.34, 0.84, 1.2], [0.66, 0.84, 1.2], [0.5, 0.98, 1.4]]) at(x, y, s, { t: x * 7 }); },
    dreadknight: one(0.97, 0.7),
    // buildings and spells
    coil: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.72); BUILD.coil(c, k * 0.82, { team: 0, t: 0.3, atk: 0.6 }); c.restore(); },
    drill: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.76); BUILD.drill(c, k * 0.9, { team: 0, t: 0.2 }); c.restore(); },
    flashfreeze: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.48); snowflake(c, k * 1.05); c.restore(); },
    gemflash: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.48); gemburst(c, k * 1.0); c.restore(); },
    meteor: (c, w, h, k) => { c.save(); c.translate(w * 0.56, h * 0.5); meteorArt(c, k * 1.0, 0.3); c.restore(); },
    barrel: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.62); barrelArt(c, k * 1.1, 0.2, 0); c.restore(); },
    abyss: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.6); portalArt(c, k * 1.1, 0.5, 0); c.restore(); },
  };
  // the card picture's at() draws its own card; a picture can show another unit with { card }
  for (const [id, f] of Object.entries(PICS)) {
    PICS[id] = (c, w, h, k, at, team) => f(c, w, h, k, (x, y, s, oo) => {
      if (oo && oo.card) { c.save(); c.translate(w * x, h * y); A.troop(c, oo.card, k * s, Object.assign({ team: team || 0, t: 0.3, walk: false, atk: 0, face: 1, id: 1, view: 'front' }, oo)); c.restore(); }
      else at(x, y, s, oo);
    });
  }

  /* ---------- spell art (card pictures, and in battle) ---------- */
  function snowflake(c, k) {
    const q = v => v * k;
    glow(c, 0, 0, q(0.8), 'rgb(170,230,255)', 0.5);
    for (let i = 0; i < 6; i++) {
      c.save(); c.rotate(i * Math.PI / 3);
      rope(c, () => { c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -q(0.62)); }, '#e9f8ff', q(0.09));
      for (const y of [0.28, 0.46]) rope(c, () => { c.beginPath(); c.moveTo(-q(0.14), -q(y + 0.1)); c.lineTo(0, -q(y)); c.lineTo(q(0.14), -q(y + 0.1)); }, '#cfeeff', q(0.06));
      c.restore();
    }
    shard(c, 0, q(0.18), q(0.16), q(0.36), ICE);
  }
  function gemburst(c, k) {
    const q = v => v * k;
    glow(c, 0, 0, q(0.9), 'rgb(210,180,255)', 0.55);
    for (let i = 0; i < 8; i++) { c.save(); c.rotate(i * Math.PI / 4); poly(c, [0, -q(0.7), q(0.07), -q(0.3), -q(0.07), -q(0.3)]); paint(c, i % 2 ? '#efe2ff' : '#7ff0ff', A.lw() * 0.7); c.restore(); }
    shard(c, 0, q(0.24), q(0.2), q(0.5), CRYSTAL);
  }
  function meteorArt(c, k, t) {
    const q = v => v * k;
    for (let i = 4; i >= 0; i--) { circ(c, -q(0.24 + i * 0.13), -q(0.24 + i * 0.13), q(0.26 - i * 0.04)); c.fillStyle = `rgba(${200 - i * 20},${40 + i * 10},${80 + i * 20},${0.75 - i * 0.12})`; c.fill(); }
    glow(c, 0, 0, q(0.7), 'rgb(220,40,70)', 0.45);
    sh(c, () => { c.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = q(0.4 + ((i * 37) % 7) * 0.012); i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }, '#3a2e3e', '#241c2a', q(0.08));
    for (const [x, y] of [[-0.12, -0.08], [0.14, 0.1], [0.02, 0.2]]) { circ(c, q(x), q(y), q(0.06)); c.fillStyle = '#ff4a5a'; c.fill(); }
  }
  function barrelArt(c, k, t, team) {
    const q = v => v * k, T = TEAM[team || 0];
    c.save(); c.rotate(t);
    sh(c, () => rr(c, q(-0.34), q(-0.44), q(0.68), q(0.88), q(0.22)), C.wood, C.woodSh, q(0.08));
    for (const y of [-0.28, 0.26]) sh(c, () => rr(c, q(-0.36), q(y), q(0.72), q(0.08), q(0.03)), '#5a5f6a', null, 0);
    for (const x of [-0.16, 0, 0.16]) line(c, q(x), q(-0.42), q(x), q(0.42), C.woodSh, A.lw() * 0.7);
    sh(c, () => rr(c, q(-0.36), q(-0.04), q(0.72), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
    c.restore();
  }
  function portalArt(c, k, t, team) {
    const q = v => v * k;
    glow(c, 0, 0, q(1.0), 'rgb(150,60,220)', 0.5);
    for (let i = 0; i < 4; i++) {
      ell(c, 0, 0, q(0.75 - i * 0.15), q(0.36 - i * 0.07), t * (i % 2 ? -1.5 : 1.2));
      c.lineWidth = q(0.07); c.strokeStyle = OUT; c.stroke();
      c.lineWidth = q(0.04); c.strokeStyle = i % 2 ? '#c0283a' : '#9a6ad6'; c.stroke();
    }
    ell(c, 0, 0, q(0.25), q(0.12)); c.fillStyle = '#120a1e'; c.fill();
  }

  // every drawing gets safe defaults, so a missing option can never become a non-finite size
  const safe = f => (c, k, o) => f(c, k, Object.assign({ t: 0, atk: 0, walk: false, face: 1, id: 1, team: 0, view: 'front' }, o, { atk: (o && o.atk) || 0, t: (o && o.t) || 0 }));
  for (const tb of [T5, BUILD]) for (const id of Object.keys(tb)) tb[id] = safe(tb[id]);
  A.add(T5, BUILD, PICS);
  Object.assign(A, { snowflake, gemburst, meteorArt, barrelArt, portalArt, glow });
})();
