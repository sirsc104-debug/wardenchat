/* Kingdom Clash: art for the expansion's 24 cards: their buildings, the units they bring, the Walking
   Smelter, the spell pictures (on the cards and in battle) and every card portrait. Drawn in code in the
   style of js/art3.js (and with its helpers), each in its arena's look: lava and ash for Cinder Keep,
   briars for Briar Hollow, sandstone for Sunstone, storm crystals for Stormspire, ice for Frostfang,
   ship timber for Blackwater, copper and gears for Gearforge, gems for Crystal Chasm, marble and gold for
   Skyward, obsidian and spectres for Eclipse. Buildings stand at (0, 0) on the ground, k pixels a tile. */
'use strict';

const KCArt5 = (() => {
  const A = KCArt, { OUT, TEAM, C, rr, circ, ell, line, paint, poly, sh, rope, dot } = A;
  const { eyes, mouth, head, legs, torso, arm, sword, glow, W, SKIN, STEEL, GOLD, LEATHER, WOOD } = KCArt3;
  const LW = () => A.lw();
  const STONE = ['#8a8590', '#5f5b66'], SAND = ['#e6c98e', '#c4a264'], LAVA = ['#ff8a2a', '#e0501a'], OBS = ['#3a3346', '#25202f'];
  const ICE = ['#d8f3ff', '#9fd4f0'], COPPER = ['#e0903a', '#b0661e'], MARBLE = ['#f4f1ea', '#d2ccbe'], BRIAR = ['#6a8a3a', '#4e6a2a'];
  const ground = (c, q, rx, ry, a) => { ell(c, 0, q(0.42), q(rx), q(ry)); c.fillStyle = `rgba(0,0,0,${a || 0.28})`; c.fill(); };
  const base = (c, q, T, w, h, cols) => {
    sh(c, () => rr(c, q(-w / 2), q(-0.1), q(w), q(h), q(0.16)), (cols || STONE)[0], (cols || STONE)[1], q(0.1));
    sh(c, () => rr(c, q(-w / 2 - 0.01), q(h - 0.32), q(w + 0.02), q(0.1), q(0.04)), T.main, T.sh, q(0.03));
  };
  const sparkle = (c, x, y, r, col) => { poly(c, [x, y - r, x + r * 0.25, y - r * 0.25, x + r, y, x + r * 0.25, y + r * 0.25, x, y + r, x - r * 0.25, y + r * 0.25, x - r, y, x - r * 0.25, y - r * 0.25]); c.fillStyle = col || '#fff'; c.fill(); };
  const flame = (c, x, y, s, t, cols) => {
    const w = Math.sin(t * 14 + x) * s * 0.12;
    sh(c, () => { c.beginPath(); c.moveTo(x - s * 0.35, y); c.quadraticCurveTo(x - s * 0.45, y - s * 0.6, x + w, y - s * 1.2); c.quadraticCurveTo(x + s * 0.45, y - s * 0.6, x + s * 0.35, y); c.closePath(); }, (cols || LAVA)[0], (cols || LAVA)[1], s * 0.1);
    sh(c, () => { c.beginPath(); c.moveTo(x - s * 0.16, y); c.quadraticCurveTo(x - s * 0.2, y - s * 0.4, x + w * 0.5, y - s * 0.7); c.quadraticCurveTo(x + s * 0.2, y - s * 0.4, x + s * 0.16, y); c.closePath(); }, '#ffe27a', '#ffc040', 0);
  };

  /* ---------- buildings ---------- */
  const BUILD = {
    // Magma Turret: a squat forge turret of dark stone, a glowing magma pot that it lobs from
    magmaturret(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], at = o.atk || 0, a = o.angle || -Math.PI / 2;
      ground(c, q, 0.95, 0.34);
      base(c, q, T, 1.7, 0.6, OBS);
      for (let i = 0; i < 4; i++) dot(c, q(-0.6 + i * 0.4), q(0.1), q(0.05), '#ff8a2a');
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.62), q(-0.1)); c.lineTo(q(-0.5), q(-1.0)); c.lineTo(q(0.5), q(-1.0)); c.lineTo(q(0.62), q(-0.1)); c.closePath(); }, '#4a4256', '#2f2a38', q(0.08));
      for (const y of [-0.4, -0.7]) line(c, q(-0.55), q(y), q(0.55), q(y), 'rgba(255,120,40,0.55)', LW() * 0.6);
      for (const sd of [-1, 0, 1]) sh(c, () => rr(c, q(sd * 0.36 - 0.12), q(-1.2), q(0.24), q(0.24), q(0.04)), '#4a4256', '#2f2a38', q(0.03));
      // the magma pot on top, tipping toward its target as it throws
      c.save(); c.translate(0, q(-1.1)); c.rotate(Math.cos(a) * 0.25 * (1 + at));
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.34), q(-0.1)); c.quadraticCurveTo(q(-0.4), q(0.18), 0, q(0.22)); c.quadraticCurveTo(q(0.4), q(0.18), q(0.34), q(-0.1)); c.closePath(); }, '#5a5266', '#3a3446', q(0.04));
      ell(c, 0, q(-0.1), q(0.32), q(0.1)); c.fillStyle = '#ff9a2a'; c.fill();
      glow(c, 0, q(-0.15), q(0.5 + at * 0.4), '255,140,40', 0.45 + at * 0.4);
      for (let i = 0; i < 3; i++) dot(c, q(-0.15 + i * 0.15), q(-0.14 - Math.abs(Math.sin(o.t * 4 + i)) * 0.12), q(0.04), '#ffe27a');
      c.restore();
    },
    // Bramble Nest: a domed hut of woven briars and roots with a round door and thorns all over
    bramblenest(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], sp = Math.max(0, 1 - ((o.t * 0.6) % 1) * 3);
      ground(c, q, 1.0, 0.36);
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.9), q(0.35)); c.quadraticCurveTo(q(-1.0), q(-1.3), 0, q(-1.45)); c.quadraticCurveTo(q(1.0), q(-1.3), q(0.9), q(0.35)); c.closePath(); }, '#7a5a34', '#5a4020', q(0.12));
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(q(-0.85 + i * 0.05), q(0.2 - i * 0.32)); c.quadraticCurveTo(0, q(-0.1 - i * 0.36), q(0.85 - i * 0.05), q(0.2 - i * 0.32)); c.strokeStyle = 'rgba(60,40,20,0.6)'; c.lineWidth = LW() * 0.7; c.stroke(); }
      for (const [x, y, r] of [[-0.6, -0.4, -1], [0.62, -0.5, 1], [-0.3, -1.05, -0.6], [0.35, -1.1, 0.6], [0, -1.42, 0]]) sh(c, () => poly(c, [q(x - 0.06), q(y), q(x + 0.06), q(y), q(x + r * 0.18), q(y - 0.22)]), '#a8c46a', '#7a9a4a', q(0.01));
      sh(c, () => { c.beginPath(); c.arc(0, q(0.1), q(0.32), Math.PI, 0); c.lineTo(q(0.32), q(0.35)); c.lineTo(q(-0.32), q(0.35)); c.closePath(); }, '#2a1d18', '#1a120e', 0);
      glow(c, 0, q(0.05), q(0.3), '255,220,120', 0.25 + sp * 0.4);
      for (const [x, y] of [[-0.45, -0.75], [0.48, -0.8]]) { sh(c, () => ell(c, q(x), q(y), q(0.12), q(0.1)), '#e04a6a', '#b02a4a', q(0.02)); dot(c, q(x), q(y), q(0.04), '#ffe27a'); }
      sh(c, () => rr(c, q(-0.92), q(0.22), q(1.84), q(0.12), q(0.05)), T.main, T.sh, q(0.02));
    },
    // Scarab Shrine: a small sandstone tomb with a carved scarab, its stone door grinding open
    scarabshrine(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], open = Math.max(0, Math.sin(o.t * 1.8));
      ground(c, q, 0.9, 0.32);
      sh(c, () => rr(c, q(-0.82), q(-0.05), q(1.64), q(0.5), q(0.06)), SAND[0], SAND[1], q(0.08));
      sh(c, () => poly(c, [q(-0.7), q(-0.05), q(0.7), q(-0.05), q(0.5), q(-1.25), q(-0.5), q(-1.25)]), SAND[0], SAND[1], q(0.08));
      sh(c, () => rr(c, q(-0.6), q(-1.4), q(1.2), q(0.18), q(0.04)), '#d8b878', '#b89458', q(0.03));
      for (const y of [-0.45, -0.85]) line(c, q(-0.62 + (y + 1.25) * 0.15), q(y), q(0.62 - (y + 1.25) * 0.15), q(y), 'rgba(140,100,50,0.5)', LW() * 0.6);
      // the scarab carving, glowing
      c.save(); c.translate(0, q(-0.78));
      sh(c, () => ell(c, 0, 0, q(0.2), q(0.24)), '#3ac8a8', '#2a9a80', q(0.03));
      line(c, 0, q(-0.22), 0, q(0.22), '#1a5a4a', LW() * 0.7);
      for (const sd of [-1, 1]) { line(c, sd * q(0.18), q(-0.05), sd * q(0.32), q(-0.15), '#1a5a4a', q(0.035)); line(c, sd * q(0.18), q(0.1), sd * q(0.32), q(0.2), '#1a5a4a', q(0.035)); }
      glow(c, 0, 0, q(0.35), '90,230,200', 0.3);
      c.restore();
      // the door
      rr(c, q(-0.28), q(-0.3), q(0.56), q(0.5), q(0.03)); c.fillStyle = '#2a1d18'; c.fill();
      sh(c, () => rr(c, q(-0.28) + q(0.5) * open, q(-0.3), q(0.56), q(0.5), q(0.03)), '#c4a264', '#a4844a', q(0.03));
      sh(c, () => rr(c, q(-0.84), q(0.28), q(1.68), q(0.1), q(0.04)), T.main, T.sh, q(0.02));
    },
    // Dune Mortar: a heavy sandstone mortar on a carved base, its stubby barrel tilting toward the target
    dunemortar(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], at = o.atk || 0, a = o.angle || -Math.PI / 2;
      ground(c, q, 1.0, 0.36);
      base(c, q, T, 1.8, 0.62, SAND);
      for (const x of [-0.6, 0, 0.6]) sh(c, () => poly(c, [q(x - 0.08), q(0.0), q(x + 0.08), q(0.0), q(x), q(0.14)]), '#c4a264', '#a4844a', 0);
      c.save(); c.translate(0, q(-0.35));
      const tilt = Math.cos(a) * 0.35, rec = at * q(0.12);
      c.rotate(tilt);
      sh(c, () => ell(c, 0, q(0.05), q(0.62), q(0.32)), '#b89458', '#94743a', q(0.05));
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.42), q(0.05) + rec); c.lineTo(q(-0.32), q(-0.85) + rec); c.lineTo(q(0.32), q(-0.85) + rec); c.lineTo(q(0.42), q(0.05) + rec); c.closePath(); }, '#8a6a4a', '#6a4e34', q(0.06));
      for (const y of [-0.25, -0.6]) line(c, q(-0.4), q(y) + rec, q(0.4), q(y) + rec, GOLD[0], q(0.05));
      sh(c, () => ell(c, 0, q(-0.85) + rec, q(0.34), q(0.13)), '#a8845a', '#86663e', q(0.02));
      ell(c, 0, q(-0.86) + rec, q(0.22), q(0.08)); c.fillStyle = '#1a120e'; c.fill();
      if (at > 0.4) for (let i = 0; i < 3; i++) { A.circ(c, q(-0.2 + i * 0.2), q(-1.1 - i * 0.1), q(0.14)); c.fillStyle = 'rgba(230,210,170,0.7)'; c.fill(); }
      c.restore();
    },
    // Storm Conductor: a tall dark-iron tower crowned with blue storm crystals, crackling
    conductor(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], at = o.atk || 0;
      ground(c, q, 0.95, 0.34);
      base(c, q, T, 1.6, 0.58);
      sh(c, () => poly(c, [q(-0.5), q(-0.1), q(0.5), q(-0.1), q(0.28), q(-1.6), q(-0.28), q(-1.6)]), '#4a4e5a', '#30333c', q(0.08));
      for (let i = 0; i < 4; i++) { const y = -0.35 - i * 0.32, w = 0.46 - i * 0.05; line(c, q(-w), q(y), q(w), q(y), COPPER[0], q(0.06)); }
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.28), q(-1.45), sd * q(0.55), q(-1.75), sd * q(0.4), q(-1.85), sd * q(0.2), q(-1.6)]), '#4a4e5a', '#30333c', q(0.02));
      // the crystal cluster
      for (const [x, h, w] of [[-0.22, 0.5, 0.12], [0.22, 0.48, 0.12], [0, 0.75, 0.16]]) sh(c, () => poly(c, [q(x - w), q(-1.62), q(x), q(-1.62 - h), q(x + w), q(-1.62), q(x), q(-1.5)]), '#9fe6ff', '#4ab0e8', q(0.03));
      const pulse = 0.5 + 0.5 * Math.sin(o.t * 6);
      glow(c, 0, q(-2.0), q(0.6 + at * 0.5 + pulse * 0.1), '120,210,255', 0.35 + at * 0.4);
      for (let i = 0; i < 2; i++) { const a = o.t * 9 + i * 3; line(c, Math.cos(a) * q(0.12), q(-2.0) + Math.sin(a) * q(0.12), Math.cos(a + 0.5) * q(0.4), q(-2.0) + Math.sin(a + 0.5) * q(0.3), '#e8fbff', q(0.025)); }
    },
    // Frostfang Cage: an ice-crusted iron cage with a hulking shape glaring out between the bars
    cage(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], rattle = Math.sin(o.t * 11) * (Math.sin(o.t * 0.9) > 0.6 ? q(0.03) : 0);
      ground(c, q, 0.95, 0.34);
      base(c, q, T, 1.7, 0.5, ['#7a8696', '#56606e']);
      // the brute inside
      sh(c, () => ell(c, rattle, q(-0.68), q(0.55), q(0.6)), '#9ab8d8', '#6a8ab0', q(0.06));
      for (const sd of [-1, 1]) sh(c, () => circ(c, sd * q(0.42) + rattle, q(-0.45), q(0.16)), ICE[0], ICE[1], q(0.02));
      for (const sd of [-1, 1]) { ell(c, sd * q(0.16) + rattle, q(-0.82), q(0.08), q(0.05), sd * 0.3); c.fillStyle = '#9ff0ff'; c.fill(); }
      glow(c, rattle, q(-0.82), q(0.3), '150,240,255', 0.4);
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.32) + rattle, q(-1.05), sd * q(0.46) + rattle, q(-1.32), sd * q(0.2) + rattle, q(-1.1)]), '#f4ead6', '#d6c8ac', q(0.01));
      // the bars and frame
      sh(c, () => rr(c, q(-0.8), q(-1.5), q(1.6), q(0.16), q(0.05)), '#5a6270', '#3e4450', q(0.03));
      for (let i = 0; i < 5; i++) { const x = -0.64 + i * 0.32; rope(c, () => { c.beginPath(); c.moveTo(q(x), q(-1.36)); c.lineTo(q(x), q(-0.08)); }, '#8a94a4', q(0.045)); }
      // his eyes glare out between the bars
      for (const sd of [-1, 1]) { ell(c, sd * q(0.16) + rattle, q(-0.82), q(0.09), q(0.055), sd * 0.3); c.fillStyle = '#c8f8ff'; c.fill(); }
      // ice crust
      for (const [x, y, s] of [[-0.6, -1.5, 1], [0.1, -1.55, 0.8], [0.55, -1.48, 1.1], [-0.7, -0.2, 0.8], [0.7, -0.3, 0.9]]) sh(c, () => poly(c, [q(x - 0.12 * s), q(y), q(x), q(y - 0.22 * s), q(x + 0.12 * s), q(y), q(x), q(y + 0.08)]), ICE[0], ICE[1], q(0.02));
    },
    // Pirate Barracks: a fort of shipwreck planks with a skull flag and a lantern at the door
    barracks(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], wave = Math.sin(o.t * 3);
      ground(c, q, 1.15, 0.4);
      sh(c, () => rr(c, q(-1.0), q(-1.3), q(2.0), q(1.75), q(0.08)), '#8a5a34', '#68401f', q(0.1));
      for (let i = 1; i < 6; i++) line(c, q(-1.0), q(-1.3 + i * 0.29), q(1.0), q(-1.3 + i * 0.29), '#5a3a1e', LW() * 0.7);
      for (const x of [-0.98, 0.98]) sh(c, () => rr(c, q(x - 0.12), q(-1.5), q(0.24), q(1.95), q(0.04)), '#6a4628', '#4e3218', q(0.03));
      sh(c, () => poly(c, [q(-1.15), q(-1.3), q(0), q(-2.0), q(1.15), q(-1.3)]), '#5a3a1e', '#3e2612', q(0.06));
      // the door, open, and its lantern
      sh(c, () => { c.beginPath(); c.arc(0, q(-0.25), q(0.38), Math.PI, 0); c.lineTo(q(0.38), q(0.45)); c.lineTo(q(-0.38), q(0.45)); c.closePath(); }, '#2a1d18', '#1a120e', 0);
      sh(c, () => rr(c, q(0.48), q(-0.62), q(0.18), q(0.24), q(0.04)), GOLD[0], GOLD[1], q(0.02));
      glow(c, q(0.57), q(-0.5), q(0.4), '255,210,120', 0.45);
      // the flag
      line(c, q(0), q(-2.0), q(0), q(-2.8), '#3a2a1a', q(0.06));
      sh(c, () => { c.beginPath(); c.moveTo(0, q(-2.78)); c.quadraticCurveTo(q(0.35), q(-2.7 + wave * 0.05), q(0.7), q(-2.75)); c.lineTo(q(0.7), q(-2.3)); c.quadraticCurveTo(q(0.35), q(-2.25 - wave * 0.05), 0, q(-2.32)); c.closePath(); }, T.main, T.sh, q(0.03));
      sh(c, () => circ(c, q(0.35), q(-2.54), q(0.1)), '#f4f0e6', '#cfc8b8', 0);
      sh(c, () => rr(c, q(-1.02), q(0.28), q(2.04), q(0.12), q(0.04)), T.main, T.sh, q(0.02));
    },
    // Energy Foundry: a copper boiler with turning gears, a pressure gauge and a glowing energy tank
    foundry(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], fill = (o.t * 0.11) % 1;
      ground(c, q, 1.0, 0.36);
      base(c, q, T, 1.8, 0.55, ['#6a5a48', '#4e4234']);
      sh(c, () => rr(c, q(-0.7), q(-1.2), q(0.9), q(1.15), q(0.4)), COPPER[0], COPPER[1], q(0.08));
      for (const y of [-0.85, -0.45]) line(c, q(-0.7), q(y), q(0.2), q(y), '#8a4a14', q(0.05));
      for (const [x, y] of [[-0.55, -1.05], [0.05, -1.05], [-0.55, -0.25], [0.05, -0.25]]) dot(c, q(x), q(y), q(0.035), '#ffe0a0');
      // the energy tank, filling
      sh(c, () => rr(c, q(0.25), q(-1.3), q(0.48), q(1.25), q(0.2)), '#d8f0ff', '#a0c8e8', q(0.05));
      c.save(); rr(c, q(0.29), q(-1.26), q(0.4), q(1.17), q(0.17)); c.clip();
      const g = c.createLinearGradient(0, q(-1.2), 0, q(0));
      g.addColorStop(0, '#ff8ad8'); g.addColorStop(1, '#c048e0');
      c.fillStyle = g; c.fillRect(q(0.25), q(-0.09) - q(1.17) * fill, q(0.48), q(1.17) * fill + q(0.1));
      c.restore();
      glow(c, q(0.49), q(-0.6), q(0.45), '230,120,255', 0.25 + fill * 0.35);
      // the gauge and a gear
      sh(c, () => circ(c, q(-0.25), q(-0.62), q(0.2)), '#f4f0e6', '#cfc8b8', q(0.02));
      line(c, q(-0.25), q(-0.62), q(-0.25) + Math.cos(Math.PI + fill * Math.PI) * q(0.15), q(-0.62) + Math.sin(Math.PI + fill * Math.PI) * q(0.15), '#c0283a', q(0.03));
      c.save(); c.translate(q(-0.62), q(-1.3)); c.rotate(o.t * 2);
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); rr(c, -q(0.04), -q(0.24), q(0.08), q(0.08), q(0.02)); paint(c, '#a07a3a', LW() * 0.5); }
      sh(c, () => circ(c, 0, 0, q(0.18)), '#c89848', '#a07a3a', q(0.03)); dot(c, 0, 0, q(0.05), '#5a3a1a');
      c.restore();
      // a puff of steam now and then
      if (Math.sin(o.t * 2.2) > 0.85) { A.circ(c, q(-0.4), q(-1.6), q(0.16)); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill(); }
    },
    // Golden Ballista: a great golden crossbow on a marble stand, swinging toward its target
    ballista(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], at = o.atk || 0, a = o.angle || -Math.PI / 2;
      ground(c, q, 1.05, 0.36);
      base(c, q, T, 1.8, 0.6, MARBLE);
      sh(c, () => rr(c, q(-0.2), q(-0.7), q(0.4), q(0.65), q(0.08)), MARBLE[0], MARBLE[1], q(0.04));
      c.save(); c.translate(0, q(-0.8));
      // seen from above-front: the stock points along the aim, the bow arms across it
      const dx = Math.cos(a), dy = Math.sin(a) * 0.6, len = q(0.95), px = -dy, py = dx;
      const fx = dx * len, fy = dy * len;
      rope(c, () => { c.beginPath(); c.moveTo(-fx * 0.5, -fy * 0.5); c.lineTo(fx, fy); }, '#c89848', q(0.16));
      const bend = q(0.18) * (1 - at);
      for (const sd of [-1, 1]) rope(c, () => { c.beginPath(); c.moveTo(fx * 0.7, fy * 0.7); c.quadraticCurveTo(fx * 0.7 + px * sd * q(0.5), fy * 0.7 + py * sd * q(0.5), fx * 0.7 - dx * bend + px * sd * q(0.75), fy * 0.7 - dy * bend + py * sd * q(0.75)); }, GOLD[0], q(0.1));
      line(c, fx * 0.7 - dx * bend + px * q(0.75), fy * 0.7 - dy * bend + py * q(0.75), -dx * q(0.1) * (1 - at), -dy * q(0.1) * (1 - at), '#f4f0e6', q(0.025));
      line(c, fx * 0.7 - dx * bend - px * q(0.75), fy * 0.7 - dy * bend - py * q(0.75), -dx * q(0.1) * (1 - at), -dy * q(0.1) * (1 - at), '#f4f0e6', q(0.025));
      if (at < 0.5) { line(c, 0, 0, fx * 1.05, fy * 1.05, '#8a6a44', q(0.05)); sh(c, () => poly(c, [fx * 1.12, fy * 1.12, fx * 1.0 + px * q(0.07), fy * 1.0 + py * q(0.07), fx * 1.0 - px * q(0.07), fy * 1.0 - py * q(0.07)]), STEEL[0], STEEL[1], 0); }
      sh(c, () => circ(c, 0, 0, q(0.16)), GOLD[0], GOLD[1], q(0.03));
      sh(c, () => circ(c, 0, 0, q(0.07)), T.main, T.sh, 0);
      c.restore();
      // a winged crest on the stand
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.1), q(-0.4), sd * q(0.42), q(-0.55), sd * q(0.34), q(-0.3)]), '#ffffff', '#d9dfe9', q(0.01));
    },
  };

  /* ---------- the units cards bring, and the Walking Smelter ---------- */
  const T7 = {
    // Thornling: a little round bramble creature with leaf ears, throwing thorns
    thornling(c, k, o) {
      const q = v => v * k * 0.85, T = TEAM[o.team], front = o.view === 'front', th = o.atk || 0;
      legs(c, q, o, 0.1, 0.24, 0.11, BRIAR, BRIAR);
      sh(c, () => ell(c, 0, q(-0.6), q(0.32), q(0.34)), '#8aa84a', '#6a8a3a', q(0.06));
      for (const [x, y, r] of [[-0.3, -0.85, -0.8], [0.3, -0.85, 0.8], [0, -0.96, 0], [-0.32, -0.45, -1.4], [0.32, -0.45, 1.4]]) sh(c, () => poly(c, [q(x - 0.05), q(y), q(x + 0.05), q(y), q(x + Math.sin(r) * 0.18), q(y - Math.cos(r) * 0.18)]), '#c4d88a', '#9ab45a', 0);
      for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(0.34), q(-0.8), q(0.16), q(0.07), sd * -0.6), '#4e8a2a', '#3a6a1e', q(0.01));
      sh(c, () => rr(c, q(-0.24), q(-0.36), q(0.48), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
      if (front) { eyes(c, 0, q(-0.62), q(0.24), o, { gap: 0.42, iris: '#ffc52e', fierce: 0.6 }); mouth(c, 0, q(-0.48), q(0.16), o); }
      c.save(); c.translate(q(front ? 0.36 : -0.36), q(-0.6 - th * 0.25)); c.rotate((front ? -0.8 : 0.8) - th);
      line(c, 0, 0, 0, -q(0.4), '#6a4a2a', q(0.05)); sh(c, () => poly(c, [-q(0.05), -q(0.38), q(0.05), -q(0.38), 0, -q(0.56)]), '#e8f0c8', '#c4d09a', 0);
      c.restore();
    },
    // Scarab: a fragile beetle warrior of sandstone and turquoise, mandibles snapping
    scarab(c, k, o) {
      const q = v => v * k * 0.9, T = TEAM[o.team], st = W(o, 16) * q(0.04), front = o.view === 'front', bite = o.atk || 0;
      for (const sd of [-1, 1]) for (const [y, ph] of [[-0.18, 1], [-0.3, -1], [-0.42, 1]]) line(c, sd * q(0.15), q(y), sd * q(0.34), q(y + 0.1) + st * ph * sd, '#2a2420', q(0.04));
      sh(c, () => ell(c, 0, q(-0.32), q(0.24), q(0.2)), '#3ac8a8', '#2a9a80', q(0.04));
      line(c, 0, q(-0.5), 0, q(-0.14), '#1a5a4a', LW() * 0.7);
      sh(c, () => rr(c, q(-0.24), q(-0.34), q(0.48), q(0.05), q(0.02)), T.main, T.sh, 0);
      sh(c, () => ell(c, 0, q(-0.58), q(0.16), q(0.12)), SAND[0], SAND[1], q(0.02));
      if (front) {
        for (const sd of [-1, 1]) line(c, sd * q(0.06), q(-0.64), sd * q(0.14 + bite * 0.06), q(-0.78), '#2a2420', q(0.035));
        for (const sd of [-1, 1]) { circ(c, sd * q(0.07), q(-0.6), q(0.035)); c.fillStyle = '#ff5a3a'; c.fill(); }
      }
    },
    // Frost Brute: a hulking yeti-like brawler with icy fists and frost on its fur
    frostbrute(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0, st = W(o, 9);
      for (const [x, ph] of [[-0.2, 1], [0.2, -1]]) sh(c, () => rr(c, q(x - 0.13), q(-0.36) + st * ph * q(0.05), q(0.26), q(0.36), q(0.1)), '#b8c8d8', '#90a4b8', q(0.04));
      for (const sd of [-1, 1]) {
        const lift = sd > 0 ? sw : sw * 0.3;
        rope(c, () => { c.beginPath(); c.moveTo(sd * q(0.38), q(-1.0)); c.quadraticCurveTo(sd * q(0.62), q(-0.7 - lift * 0.3), sd * q(0.5), q(-0.38 - lift * 0.5)); }, '#d8e4f0', q(0.2));
        sh(c, () => circ(c, sd * q(0.5), q(-0.32 - lift * 0.5), q(0.18)), ICE[0], ICE[1], q(0.04));
      }
      sh(c, () => ell(c, 0, q(-0.8), q(0.46), q(0.48)), '#d8e4f0', '#aabccc', q(0.09));
      sh(c, () => rr(c, q(-0.4), q(-0.52), q(0.8), q(0.09), q(0.04)), T.main, T.sh, q(0.02));
      sh(c, () => circ(c, 0, q(-1.3), q(0.28)), '#d8e4f0', '#aabccc', q(0.05));
      if (front) {
        sh(c, () => ell(c, 0, q(-1.24), q(0.2), q(0.17)), '#8aa8c8', '#6a88a8', q(0.02));
        eyes(c, 0, q(-1.34), q(0.2), o, { gap: 0.55, iris: '#4ac8ff', fierce: 1, browCol: '#6a88a8' });
        mouth(c, 0, q(-1.14), q(0.2), o, sw > 0.2 ? 'open' : 'flat');
      }
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.16), q(-1.52), sd * q(0.3), q(-1.72), sd * q(0.3), q(-1.46)]), ICE[0], ICE[1], q(0.01));
    },
    // Buccaneer: a burly pirate with a bandana, a striped shirt, a big belly and a broad cutlass
    buccaneer(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0;
      legs(c, q, o, 0.13, 0.34, 0.15, ['#3e3024', '#2a2018'], ['#4a5a7a', '#36445e']);
      sh(c, () => ell(c, 0, q(-0.7), q(0.36), q(0.36)), '#f3efe6', '#cfc8b8', q(0.06));
      c.save(); ell(c, 0, q(-0.7), q(0.36), q(0.36)); c.clip(); for (const y of [-0.9, -0.74, -0.58]) { c.fillStyle = T.main; c.fillRect(q(-0.4), q(y), q(0.8), q(0.06)); } c.restore();
      sh(c, () => rr(c, q(-0.37), q(-0.46), q(0.74), q(0.09), q(0.04)), LEATHER[0], LEATHER[1], q(0.02));
      c.save(); c.translate(q(front ? 0.36 : -0.36), q(-0.7)); c.rotate((front ? -0.6 : 0.6) + (front ? 1 : -1) * sw * 1.6);
      sh(c, () => { c.beginPath(); c.moveTo(-q(0.06), 0); c.quadraticCurveTo(q(0.22), -q(0.32), q(0.08), -q(0.66)); c.lineTo(q(0.06), 0); c.closePath(); }, STEEL[0], STEEL[1], q(0.03));
      sh(c, () => { c.beginPath(); c.arc(0, q(0.03), q(0.11), 0, Math.PI); c.lineWidth = q(0.04); }, GOLD[0], GOLD[1], 0);
      c.restore();
      head(c, q, -1.18, 0.28, o, { skin: ['#e0a982', '#c4885e'], iris: '#3a2a1a', mouth: false });
      if (front) {
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.24), q(-1.1)); c.quadraticCurveTo(0, q(-0.84), q(0.24), q(-1.1)); c.quadraticCurveTo(0, q(-1.0), q(-0.24), q(-1.1)); c.closePath(); }, '#3a2418', '#2a1810', q(0.02));
        mouth(c, 0, q(-1.03), q(0.16), o, sw > 0.2 ? 'open' : 'flat');
      }
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.22), q(0.29), Math.PI, 0); c.quadraticCurveTo(0, q(-1.28), q(-0.29), q(-1.22)); c.closePath(); }, T.main, T.sh, q(0.04));
      if (!front) sh(c, () => circ(c, 0, q(-1.18), q(0.27)), T.main, T.sh, q(0.04));
      for (const y of [-1.24, -1.1]) sh(c, () => ell(c, q(-0.35), q(y), q(0.07), q(0.04), 0.5), T.main, T.sh, 0);
    },
    // Heavenly Sentinel: a spear guard in white and gold with a winged helm and a golden kite shield
    sentinel(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', th = o.atk || 0;
      legs(c, q, o, 0.12, 0.34, 0.14, STEEL, MARBLE);
      torso(c, q, T, -0.92, -0.36, 0.28, { col: '#f6f7fb', sh: '#c9cfdc' });
      sh(c, () => poly(c, [0, q(-0.84), q(0.1), q(-0.7), 0, q(-0.56), q(-0.1), q(-0.7)]), GOLD[0], GOLD[1], q(0.02));
      c.save(); c.translate(q(front ? 0.34 : -0.34), q(-0.66) - th * q(0.2));
      line(c, 0, q(0.4), 0, q(-0.95), OUT, q(0.08)); line(c, 0, q(0.4), 0, q(-0.95), '#c9a060', q(0.045));
      sh(c, () => poly(c, [0, q(-1.2), q(-0.08), q(-0.95), q(0.08), q(-0.95)]), GOLD[0], GOLD[1], q(0.02));
      c.restore();
      head(c, q, -1.14, 0.27, o, { iris: '#c99a20' });
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.18), q(0.29), Math.PI, 0); c.lineTo(q(0.29), q(-1.1)); c.lineTo(q(-0.29), q(-1.1)); c.closePath(); }, GOLD[0], GOLD[1], q(0.04));
      if (!front) sh(c, () => circ(c, 0, q(-1.14), q(0.28)), GOLD[0], GOLD[1], q(0.04));
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.22), q(-1.3), sd * q(0.5), q(-1.52), sd * q(0.42), q(-1.24)]), '#ffffff', '#d9dfe9', q(0.01));
      if (o.shield) {
        c.save(); c.translate(q(front ? -0.32 : 0.32), q(-0.6));
        sh(c, () => poly(c, [0, q(-0.3), q(0.2), q(-0.18), q(0.15), q(0.18), 0, q(0.32), q(-0.15), q(0.18), q(-0.2), q(-0.18)]), GOLD[0], GOLD[1], q(0.04));
        sh(c, () => poly(c, [0, q(-0.18), q(0.1), q(-0.1), q(0.07), q(0.12), 0, q(0.2), q(-0.07), q(0.12), q(-0.1), q(-0.1)]), T.main, T.sh, q(0.02));
        glow(c, 0, 0, q(0.3), '255,230,140', 0.3);
        c.restore();
      }
    },
    // Emberling: a hopping little flame with eyes
    emberling(c, k, o) {
      const q = v => v * k * 1.3, T = TEAM[o.team], hop = Math.abs(Math.sin(o.t * 10 + (o.id || 0))) * q(o.walk ? 0.16 : 0.05), front = o.view === 'front';
      c.save(); c.translate(0, -hop);
      glow(c, 0, q(-0.3), q(0.55), '255,140,40', 0.45);
      flame(c, 0, q(-0.05), q(0.5), o.t);
      sh(c, () => rr(c, q(-0.16), q(-0.12), q(0.32), q(0.06), q(0.03)), T.main, T.sh, q(0.01));
      if (front) eyes(c, 0, q(-0.3), q(0.18), o, { gap: 0.45, iris: '#3a1a0a', brows: false });
      c.restore();
    },
    // Walking Smelter: an iron furnace on four clanking legs, its belly glowing, smoke from its chimney
    smelter(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', st = W(o, 5), fire = 0.6 + 0.4 * Math.sin(o.t * 7);
      for (const [x, ph] of [[-0.45, 1], [0.45, -1], [-0.25, -1], [0.25, 1]]) {
        const lift = st * ph * q(0.08);
        rope(c, () => { c.beginPath(); c.moveTo(q(x * 0.8), q(-0.65)); c.lineTo(q(x * 1.15), q(-0.3) - lift); c.lineTo(q(x), -lift * 0.3); }, '#5a5e6a', q(0.1));
        sh(c, () => rr(c, q(x - 0.11), q(-0.08) - lift * 0.3, q(0.22), q(0.09), q(0.03)), '#3e414c', '#2a2c34', 0);
      }
      sh(c, () => rr(c, q(-0.6), q(-1.5), q(1.2), q(0.95), q(0.3)), '#5a5e6a', '#3e414c', q(0.08));
      for (const [x, y] of [[-0.48, -1.38], [0.48, -1.38], [-0.48, -0.68], [0.48, -0.68]]) dot(c, q(x), q(y), q(0.04), '#9aa0ae');
      sh(c, () => rr(c, q(-0.61), q(-0.82), q(1.22), q(0.1), q(0.04)), T.main, T.sh, q(0.02));
      if (front) {
        // the furnace mouth, roaring
        sh(c, () => rr(c, q(-0.32), q(-1.28), q(0.64), q(0.42), q(0.1)), '#2a1d18', '#1a120e', 0);
        const g = c.createRadialGradient(0, q(-1.05), 0, 0, q(-1.05), q(0.4));
        g.addColorStop(0, `rgba(255,240,170,${fire})`); g.addColorStop(0.6, `rgba(255,140,40,${fire * 0.9})`); g.addColorStop(1, 'rgba(200,60,20,0.4)');
        rr(c, q(-0.28), q(-1.24), q(0.56), q(0.34), q(0.08)); c.fillStyle = g; c.fill();
        for (let i = 0; i < 4; i++) line(c, q(-0.28 + i * 0.187), q(-1.27), q(-0.28 + i * 0.187), q(-0.88), '#3e414c', q(0.04));
        for (const sd of [-1, 1]) { circ(c, sd * q(0.18), q(-1.4), q(0.05)); c.fillStyle = '#ffcf5a'; c.fill(); }
      } else for (let i = 0; i < 3; i++) line(c, q(-0.4), q(-1.3 + i * 0.16), q(0.4), q(-1.3 + i * 0.16), '#4a4e5a', LW() * 0.7);
      glow(c, 0, q(-1.05), q(0.7), '255,140,40', 0.3 * fire);
      // the chimney and its smoke
      sh(c, () => rr(c, q(0.18), q(-1.95), q(0.24), q(0.5), q(0.05)), '#4a4e5a', '#30333c', q(0.03));
      for (let i = 0; i < 3; i++) { const f = ((o.t * 0.8 + i / 3) % 1); A.circ(c, q(0.3 + f * 0.3), q(-2.0 - f * 0.7), q(0.1 + f * 0.14)); c.fillStyle = `rgba(90,90,100,${0.55 * (1 - f)})`; c.fill(); }
    },
  };

  /* ---------- spell pictures (card art, and parts of the battle effects) ---------- */
  // Magma Quake: cracked dark ground with lava glowing through and a burst of lava rock
  function quakeArt(c, k, t) {
    const q = v => v * k;
    sh(c, () => ell(c, 0, 0, q(0.95), q(0.5)), '#4a4256', '#2f2a38', q(0.08));
    for (const [a, l] of [[0.3, 0.9], [1.6, 0.8], [2.6, 0.85], [3.9, 0.7], [5.1, 0.9]]) {
      c.beginPath(); c.moveTo(0, 0);
      for (let i = 1; i <= 3; i++) c.lineTo(Math.cos(a + (i % 2 ? 0.2 : -0.15)) * q(l * i / 3), Math.sin(a + (i % 2 ? 0.2 : -0.15)) * q(l * i / 3) * 0.5);
      c.strokeStyle = '#ff8a2a'; c.lineWidth = q(0.08); c.lineCap = 'round'; c.stroke(); c.strokeStyle = '#ffe27a'; c.lineWidth = q(0.03); c.stroke();
    }
    glow(c, 0, 0, q(0.9), '255,120,40', 0.4);
    for (const [x, y, r] of [[-0.3, -0.5, 0.12], [0.25, -0.7, 0.1], [0.05, -0.95, 0.14]]) sh(c, () => circ(c, q(x), q(y - Math.abs(Math.sin(t * 3 + x)) * 0.1), q(r)), '#5a5266', '#3a3446', q(0.02));
  }
  // Ashfall: a heavy grey-orange cloud raining glowing ash
  function ashArt(c, k, t) {
    const q = v => v * k;
    for (let i = 0; i < 10; i++) { const x = -0.6 + (i % 5) * 0.3, y = 0.1 + ((t * 0.6 + i * 0.31) % 1) * 0.8; dot(c, q(x + Math.sin(i) * 0.05), q(y), q(0.04), i % 2 ? '#ff8a2a' : '#9a8a8a'); }
    for (const [x, y, r] of [[-0.45, -0.1, 0.32], [0.45, -0.1, 0.32], [-0.2, -0.35, 0.38], [0.22, -0.32, 0.4], [0, 0.02, 0.36]]) sh(c, () => circ(c, q(x), q(y), q(r)), '#6a5e5e', '#4a4040', q(0.08));
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [x, y] of [[-0.2, 0.15], [0.2, 0.12]]) { const g = c.createRadialGradient(q(x), q(y), 0, q(x), q(y), q(0.4)); g.addColorStop(0, 'rgba(255,120,40,0.5)'); g.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = g; c.fillRect(q(x - 0.4), q(y - 0.4), q(0.8), q(0.8)); }
    c.restore();
  }
  // Thornroller: a huge log wrapped in thorny briars, rolling (seen from the front)
  function logArt(c, k, t, len) {
    const q = v => v * k, L = len || 1.6;
    sh(c, () => rr(c, q(-L), q(-0.42), q(L * 2), q(0.84), q(0.4)), '#8a5a34', '#68401f', q(0.1));
    for (let i = 0; i < 6; i++) { const x = -L + 0.2 + ((i * 0.6 + t * 1.6) % (L * 2 - 0.4)); line(c, q(x), q(-0.36), q(x - 0.12), q(0.36), '#5a3a1e', LW() * 0.7); }
    for (const sd of [-1, 1]) { sh(c, () => ell(c, sd * q(L - 0.02), 0, q(0.18), q(0.42)), '#c8955a', '#a0703a', q(0.03)); ell(c, sd * q(L - 0.02), 0, q(0.08), q(0.22)); c.strokeStyle = '#8a5a34'; c.lineWidth = LW() * 0.6; c.stroke(); }
    for (let i = 0; i < 9; i++) { const x = -L + 0.3 + i * (L * 2 - 0.6) / 8, up = i % 2 ? -1 : 1, rot = t * 6; sh(c, () => poly(c, [q(x - 0.07), q(up * 0.38), q(x + 0.07), q(up * 0.38), q(x + Math.sin(rot + i) * 0.05), q(up * 0.6)]), '#a8c46a', '#7a9a4a', 0); }
    rope(c, () => { c.beginPath(); c.moveTo(q(-L + 0.2), q(-0.3)); for (let i = 0; i < 6; i++) c.quadraticCurveTo(q(-L + 0.4 + i * L / 3), q(i % 2 ? 0.4 : -0.4), q(-L + 0.6 + i * L / 3), q(i % 2 ? -0.3 : 0.3)); }, '#5a8a2a', q(0.06));
  }
  // Briar Bind: thorny vines curling up out of the ground
  function vineArt(c, k, t) {
    const q = v => v * k;
    sh(c, () => ell(c, 0, q(0.05), q(0.7), q(0.28)), '#5a4020', '#3e2a12', q(0.05));
    for (const [x, h, d] of [[-0.35, 0.9, -1], [0.0, 1.2, 1], [0.35, 0.95, 1]]) {
      const w = Math.sin(t * 2 + x * 4) * 0.08;
      rope(c, () => { c.beginPath(); c.moveTo(q(x), q(0)); c.bezierCurveTo(q(x + d * 0.35), q(-h * 0.35), q(x - d * 0.3 + w), q(-h * 0.7), q(x + d * 0.12 + w), q(-h)); }, '#5a8a2a', q(0.12));
      for (let i = 1; i < 4; i++) sh(c, () => poly(c, [q(x + d * 0.15 * (i % 2 ? 1 : -1)), q(-h * i / 4), q(x + d * 0.3 * (i % 2 ? 1 : -1)), q(-h * i / 4 - 0.06), q(x + d * 0.15 * (i % 2 ? 1 : -1)), q(-h * i / 4 - 0.12)]), '#c4d88a', '#9ab45a', 0);
      sh(c, () => ell(c, q(x + d * 0.12 + w), q(-h), q(0.12), q(0.07), d * 0.6), '#7aaa3a', '#5a8a2a', 0);
    }
  }
  // Judgment Bolt: three forked lightning strikes from a dark cloud
  function lightningArt(c, k, t) {
    const q = v => v * k;
    for (const [x, y, r] of [[-0.4, -0.75, 0.3], [0.4, -0.75, 0.3], [0, -0.9, 0.38]]) sh(c, () => circ(c, q(x), q(y), q(r)), '#4a4a6a', '#30304a', q(0.06));
    for (const [x0, x1] of [[-0.4, -0.55], [0.05, 0.0], [0.4, 0.55]]) {
      const pts = [q(x0), q(-0.6), q(x0 + 0.12), q(-0.25), q(x0 - 0.05), q(-0.2), q(x1 + 0.08), q(0.35), q(x1 - 0.05), q(-0.05), q(x1 + 0.12), q(-0.1)];
      poly(c, [q(x0 - 0.06), q(-0.6), q(x0 + 0.08), q(-0.6), q(x0 + 0.02), q(-0.25), q(x0 + 0.14), q(-0.25), q(x1), q(0.42), q(x1 + 0.03), q(0.0), q(x1 - 0.1), q(0.0)]);
      paint(c, '#ffe27a', LW()); void pts;
      glow(c, q(x1), q(0.3), q(0.4), '255,240,150', 0.5);
    }
  }
  // Cyclone: a swirling funnel of wind with leaves and debris
  function cycloneArt(c, k, t) {
    const q = v => v * k;
    for (let i = 0; i < 6; i++) {
      const y = -1.0 + i * 0.2, rx = 0.2 + i * 0.12, a = t * 5 + i;
      c.beginPath(); c.ellipse(0, q(y), q(rx), q(rx * 0.28), 0, a, a + Math.PI * 1.5);
      c.strokeStyle = OUT; c.lineWidth = q(0.12); c.lineCap = 'round'; c.stroke();
      c.strokeStyle = i % 2 ? '#d8f0ff' : '#a8d0ec'; c.lineWidth = q(0.07); c.stroke();
    }
    for (let i = 0; i < 4; i++) { const a = t * 6 + i * 1.6, r = 0.5 + i * 0.1; sh(c, () => ell(c, Math.cos(a) * q(r), q(-0.4 + i * 0.1) + Math.sin(a) * q(r * 0.25), q(0.08), q(0.04), a), '#7aaa3a', '#5a8a2a', 0); }
  }
  // Glacier Slam: a great ball of magic ice with cracks of blue light
  function glacierArt(c, k, t) {
    const q = v => v * k;
    glow(c, 0, 0, q(0.9), '170,230,255', 0.45);
    sh(c, () => circ(c, 0, 0, q(0.6)), '#e8f8ff', '#9fd4f0', q(0.12));
    for (const [a, l] of [[0.4, 0.5], [2.1, 0.45], [3.6, 0.5], [5.2, 0.4]]) line(c, Math.cos(a) * q(0.1), Math.sin(a) * q(0.1), Math.cos(a) * q(l), Math.sin(a) * q(l), '#5ab8f0', q(0.04));
    for (const [x, y] of [[-0.25, -0.3], [0.2, 0.15]]) sparkle(c, q(x), q(y), q(0.1));
    for (const [a, s] of [[-1.2, 1], [-0.4, 0.8], [0.9, 0.9], [2.4, 0.7]]) { c.save(); c.rotate(a); sh(c, () => poly(c, [q(-0.07 * s), q(-0.58), q(0), q(-0.58 - 0.22 * s), q(0.07 * s), q(-0.58)]), '#ffffff', '#bfe6ff', 0); c.restore(); }
  }
  // Powder Keg: a banded gunpowder keg with a fizzing fuse
  function kegArt(c, k, t, team) {
    const q = v => v * k, T = TEAM[team || 0];
    sh(c, () => { c.beginPath(); c.moveTo(q(-0.45), q(-0.5)); c.quadraticCurveTo(q(-0.6), 0, q(-0.45), q(0.5)); c.lineTo(q(0.45), q(0.5)); c.quadraticCurveTo(q(0.6), 0, q(0.45), q(-0.5)); c.closePath(); }, '#9a6a3c', '#734a26', q(0.08));
    for (const y of [-0.32, 0.32]) line(c, q(-0.52), q(y), q(0.52), q(y), '#4a4e5a', q(0.07));
    sh(c, () => rr(c, q(-0.2), q(-0.12), q(0.4), q(0.24), q(0.05)), T.main, T.sh, q(0.02));
    sh(c, () => ell(c, 0, q(-0.5), q(0.45), q(0.12)), '#b07c44', '#835628', q(0.02));
    line(c, q(0.05), q(-0.55), q(0.25), q(-0.85), '#3a2a1a', q(0.04));
    glow(c, q(0.25), q(-0.88), q(0.25), '255,200,80', 0.7);
    for (let i = 0; i < 3; i++) { const a = t * 20 + i * 2; dot(c, q(0.25) + Math.cos(a) * q(0.1), q(-0.88) + Math.sin(a) * q(0.1), q(0.03), '#ffe27a'); }
  }
  // Overclock: a glowing gear with sparks and lightning between its teeth
  function gearArt(c, k, t) {
    const q = v => v * k;
    glow(c, 0, 0, q(1.0), '255,160,60', 0.35);
    c.save(); c.rotate(t * 1.5);
    for (let i = 0; i < 10; i++) { c.rotate(Math.PI / 5); rr(c, -q(0.1), -q(0.78), q(0.2), q(0.2), q(0.04)); paint(c, '#ffb52e', LW()); }
    sh(c, () => circ(c, 0, 0, q(0.62)), '#ffcd33', '#e09f12', q(0.08));
    sh(c, () => circ(c, 0, 0, q(0.3)), '#c0283a', '#901c2c', q(0.04));
    c.restore();
    poly(c, [q(-0.06), q(-0.26), q(0.12), q(-0.26), q(0.0), q(0), q(0.14), q(0), q(-0.08), q(0.3), q(0.0), q(0.06), q(-0.14), q(0.06)]); paint(c, '#fff6c8', LW() * 0.7);
    for (let i = 0; i < 3; i++) { const a = t * 7 + i * 2.1; line(c, Math.cos(a) * q(0.7), Math.sin(a) * q(0.7), Math.cos(a) * q(1.0), Math.sin(a) * q(1.0), '#fff6c8', q(0.04)); }
  }
  // Prism Echo: a floating prism splitting a beam of light into a rainbow mirror image
  function echoArt(c, k, t) {
    const q = v => v * k;
    c.save(); c.globalCompositeOperation = 'lighter';
    const cols = ['255,90,90', '255,200,60', '90,230,120', '90,170,255', '200,120,255'];
    cols.forEach((col, i) => { c.beginPath(); c.moveTo(q(0.1), q(0)); c.lineTo(q(0.95), q(-0.35 + i * 0.17)); c.lineTo(q(0.95), q(-0.27 + i * 0.17)); c.closePath(); c.fillStyle = `rgba(${col},0.6)`; c.fill(); });
    c.beginPath(); c.moveTo(q(-0.95), q(0.02)); c.lineTo(q(-0.1), q(0)); c.lineTo(q(-0.95), q(-0.06)); c.closePath(); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill();
    c.restore();
    c.save(); c.translate(0, Math.sin(t * 2) * q(0.05));
    sh(c, () => poly(c, [0, q(-0.6), q(0.45), q(0.35), q(-0.45), q(0.35)]), '#efe2ff', '#a882f0', q(0.06));
    poly(c, [0, q(-0.6), q(0.08), q(0.35), q(-0.45), q(0.35)]); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
    c.restore();
    for (const [x, y] of [[-0.6, -0.5], [0.6, 0.5], [0.4, -0.6]]) sparkle(c, q(x), q(y), q(0.08));
  }
  // Heaven's Guard: a golden capsule with white wings, falling with a beam of light
  function capsuleArt(c, k, t, team) {
    const q = v => v * k, T = TEAM[team || 0];
    for (const sd of [-1, 1]) sh(c, () => { c.beginPath(); c.moveTo(sd * q(0.35), q(-0.2)); c.quadraticCurveTo(sd * q(0.9), q(-0.75), sd * q(1.05), q(-0.3)); c.quadraticCurveTo(sd * q(0.85), q(-0.25), sd * q(0.9), q(-0.05)); c.quadraticCurveTo(sd * q(0.6), q(-0.05), sd * q(0.35), q(0.15)); c.closePath(); }, '#ffffff', '#d9dfe9', q(0.05));
    sh(c, () => { c.beginPath(); c.moveTo(q(-0.38), q(-0.45)); c.quadraticCurveTo(0, q(-0.85), q(0.38), q(-0.45)); c.lineTo(q(0.32), q(0.4)); c.quadraticCurveTo(0, q(0.6), q(-0.32), q(0.4)); c.closePath(); }, GOLD[0], GOLD[1], q(0.08));
    sh(c, () => rr(c, q(-0.39), q(-0.08), q(0.78), q(0.14), q(0.05)), T.main, T.sh, q(0.02));
    sh(c, () => poly(c, [0, q(-0.4), q(0.1), q(-0.25), 0, q(-0.1), q(-0.1), q(-0.25)]), '#ffffff', '#e0e8f0', 0);
    glow(c, 0, q(-0.2), q(0.9), '255,230,140', 0.35);
  }
  // Divine Reflection: an ornate golden hand mirror showing a shining reflection
  function mirrorArt(c, k, t) {
    const q = v => v * k;
    sh(c, () => rr(c, q(-0.09), q(0.35), q(0.18), q(0.62), q(0.06)), GOLD[0], GOLD[1], q(0.03));
    sh(c, () => ell(c, 0, q(-0.12), q(0.52), q(0.6)), GOLD[0], GOLD[1], q(0.08));
    const g = c.createLinearGradient(q(-0.4), q(-0.6), q(0.4), q(0.4));
    g.addColorStop(0, '#e8f4ff'); g.addColorStop(0.5, '#a8d0f0'); g.addColorStop(1, '#d8e8ff');
    ell(c, 0, q(-0.12), q(0.4), q(0.48)); c.fillStyle = g; c.fill(); c.lineWidth = LW() * 0.8; c.strokeStyle = OUT; c.stroke();
    c.save(); ell(c, 0, q(-0.12), q(0.4), q(0.48)); c.clip();
    const sw = ((t * 0.5) % 1.6) - 0.8;
    poly(c, [q(sw - 0.1), q(-0.7), q(sw + 0.1), q(-0.7), q(sw - 0.2), q(0.5), q(sw - 0.4), q(0.5)]); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
    c.restore();
    for (const [x, y] of [[0, -0.74], [-0.5, -0.12], [0.5, -0.12]]) sh(c, () => circ(c, q(x), q(y), q(0.08)), '#7ad0ff', '#3a9ae0', q(0.01));
    sparkle(c, q(0.25), q(-0.4), q(0.1));
  }
  // Soulblight: a dark green-violet curse sigil with a skull and wisps
  function curseArt(c, k, t) {
    const q = v => v * k;
    glow(c, 0, 0, q(1.0), '120,220,120', 0.25);
    ell(c, 0, q(0.2), q(0.85), q(0.4)); c.strokeStyle = 'rgba(150,255,150,0.8)'; c.lineWidth = q(0.06); c.setLineDash([q(0.2), q(0.12)]); c.lineDashOffset = -t * q(0.5); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 5; i++) { const a = t * 1.2 + i * 1.26; sh(c, () => { c.beginPath(); c.moveTo(Math.cos(a) * q(0.7), q(0.2) + Math.sin(a) * q(0.32)); c.quadraticCurveTo(Math.cos(a) * q(0.5), q(-0.3) + Math.sin(a) * q(0.2), Math.cos(a) * q(0.6) + q(0.1), q(-0.7)); c.lineWidth = q(0.04); }, '#8aff8a', '#5ac85a', 0); }
    sh(c, () => circ(c, 0, q(-0.2), q(0.34)), '#c8e8c0', '#98c090', q(0.05));
    sh(c, () => rr(c, q(-0.18), q(0.02), q(0.36), q(0.18), q(0.05)), '#c8e8c0', '#98c090', q(0.02));
    for (const sd of [-1, 1]) { ell(c, sd * q(0.13), q(-0.22), q(0.09), q(0.1)); c.fillStyle = '#1a2a1a'; c.fill(); circ(c, sd * q(0.13), q(-0.22), q(0.04)); c.fillStyle = '#8aff8a'; c.fill(); }
    for (const x of [-0.08, 0, 0.08]) line(c, q(x), q(0.03), q(x), q(0.18), '#98c090', LW() * 0.6);
  }
  // Abyssal Collapse: a black rift with violet edges and energy spiralling into it
  function riftArt(c, k, t) {
    const q = v => v * k;
    glow(c, 0, 0, q(1.1), '170,90,255', 0.35);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 0, q(0.85 - i * 0.22), q(0.4 - i * 0.1), 0, t * (2 + i) + i, t * (2 + i) + i + Math.PI * 1.4); c.strokeStyle = i % 2 ? '#c99aff' : '#8a4ae0'; c.lineWidth = q(0.08); c.lineCap = 'round'; c.stroke(); }
    sh(c, () => ell(c, 0, 0, q(0.4), q(0.18)), '#0a0612', '#000000', 0);
    ell(c, 0, 0, q(0.4), q(0.18)); c.strokeStyle = '#e8c8ff'; c.lineWidth = q(0.04); c.stroke();
    for (let i = 0; i < 6; i++) { const a = t * 3 + i, r = 0.95 - ((t * 0.8 + i / 6) % 1) * 0.6; dot(c, Math.cos(a) * q(r), Math.sin(a) * q(r * 0.45), q(0.04), '#e8c8ff'); }
  }

  /* ---------- the card portraits ---------- */
  const spell = (fn, y, s, oo) => (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * (y || 0.5)); A.setLw(Math.max(1, k * s * 0.07)); fn(c, k * s, 0.4, 0, oo); c.restore(); };
  const bld = (id, y, s) => (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * (y || 0.7)); A.setLw(Math.max(1, k * s * 0.07)); BUILD[id](c, k * s, { team: 0, t: 0.4, atk: 0.3, angle: -Math.PI / 2 - 0.25 }); c.restore(); };
  const PICS = {
    magmaquake: spell(quakeArt, 0.6, 1.05), ashfall: spell(ashArt, 0.46, 1.05),
    magmaturret: bld('magmaturret', 0.74, 0.88), thornroller: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.55); c.rotate(-0.25); A.setLw(Math.max(1, k * 0.05)); logArt(c, k * 0.68, 0.4, 1.3); c.restore(); },
    briarbind: spell(vineArt, 0.78, 1.0), bramblenest: bld('bramblenest', 0.76, 0.8),
    scarabshrine: bld('scarabshrine', 0.72, 0.92), dunemortar: bld('dunemortar', 0.72, 0.92),
    judgment: spell(lightningArt, 0.55, 1.05), cyclone: spell(cycloneArt, 0.72, 1.05), conductor: bld('conductor', 0.84, 0.72),
    glacierslam: spell(glacierArt, 0.5, 1.0), cage: bld('cage', 0.76, 0.8),
    powderkeg: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.52); c.rotate(-0.35); A.setLw(Math.max(1, k * 0.07)); kegArt(c, k * 1.1, 0.4, 0); c.restore(); },
    barracks: bld('barracks', 0.8, 0.62), overclock: spell(gearArt, 0.5, 0.9), foundry: bld('foundry', 0.74, 0.82),
    smelter: (c, w, h, k, at) => at(0.5, 0.94, 0.95, { t: 0.3 }),
    prismecho: spell(echoArt, 0.5, 0.95),
    heavensguard: (c, w, h, k) => { c.save(); c.translate(w * 0.5, h * 0.5); A.setLw(Math.max(1, k * 0.06)); capsuleArt(c, k * 0.85, 0.4, 0); c.restore(); },
    reflection: spell(mirrorArt, 0.52, 1.0), ballista: bld('ballista', 0.75, 0.8),
    soulblight: spell(curseArt, 0.56, 1.0), collapse: spell(riftArt, 0.52, 1.0),
  };
  // safe defaults for every drawing (as js/art2.js does)
  const safe = f => (c, k, o) => f(c, k, Object.assign({ t: 0, atk: 0, walk: false, face: 1, id: 1, team: 0, view: 'front' }, o, { atk: (o && o.atk) || 0, t: (o && o.t) || 0 }));
  for (const id of Object.keys(BUILD)) BUILD[id] = safe(BUILD[id]);
  for (const id of Object.keys(T7)) T7[id] = safe(T7[id]);
  A.add(T7, BUILD, PICS);
  return { quakeArt, ashArt, logArt, vineArt, lightningArt, cycloneArt, glacierArt, kegArt, gearArt, echoArt, capsuleArt, mirrorArt, curseArt, riftArt, flame, sparkle };
})();
