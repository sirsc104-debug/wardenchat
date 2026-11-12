/* Kingdom Clash: the second design of the Arena 5 to 10 characters (after js/art3.js, using its helpers).
   Same sizes, footprints and options as their first designs in js/art2.js (o.shield, o.charge, o.hook,
   o.hatch, o.walk, o.atk, o.view), so the game's health bars and effects still line up. */
'use strict';

(() => {
  const A = KCArt, { OUT, TEAM, C, rr, circ, ell, line, paint, poly, sh, rope, dot } = A;
  const { eyes, mouth, head, legs, torso, arm, sword, blush, glow, W, SKIN, STEEL, GOLD, LEATHER, WOOD } = KCArt3;
  const LW = () => A.lw();
  const ICE = ['#d8f3ff', '#9fd4f0', '#f2fbff'], CRYSTAL = ['#d4b8ff', '#8a5cf0', '#f3eaff'], BRONZE = [C.bronze, C.bronzeSh];
  const DARK = ['#3e3650', '#262031'], PIRATE = ['#f3efe6', '#cfc8b8'];
  const shard = (c, x, y, w, h, cols) => sh(c, () => poly(c, [x, y - h, x + w, y - h * 0.35, x, y, x - w, y - h * 0.35]), cols[0], cols[1], h * 0.2);
  const sparkle = (c, x, y, r, col) => { poly(c, [x, y - r, x + r * 0.25, y - r * 0.25, x + r, y, x + r * 0.25, y + r * 0.25, x, y + r, x - r * 0.25, y + r * 0.25, x - r, y, x - r * 0.25, y - r * 0.25]); c.fillStyle = col || '#fff'; c.fill(); };

  const T6 = {
    /* ---------- Arena 5: Frostfang Keep ---------- */
    // Frost Sprite: a round little snow spirit with a crown of icicles, big eyes and frosty sparkles
    frostsprite(c, k, o) {
      const q = v => v * k * 1.3, T = TEAM[o.team], hop = Math.abs(Math.sin(o.t * 9)) * q(o.walk ? 0.18 : 0.06), front = o.view === 'front';
      c.save(); c.translate(0, -hop);
      glow(c, 0, q(-0.34), q(0.6), '170,230,255', 0.4);
      for (const [x, h, r] of [[-0.2, 0.24, -0.4], [-0.08, 0.32, -0.15], [0.08, 0.32, 0.15], [0.2, 0.24, 0.4]]) { c.save(); c.translate(q(x), q(-0.5)); c.rotate(r); shard(c, 0, 0, q(0.07), q(h), ICE); c.restore(); }
      sh(c, () => ell(c, 0, q(-0.3), q(0.3), q(0.28)), ICE[0], ICE[1], q(0.07));
      for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(0.3), q(-0.24), q(0.08), q(0.06), sd * 0.5), ICE[0], ICE[1], q(0.01));
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.22), q(-0.16)); c.quadraticCurveTo(0, q(-0.08), q(0.22), q(-0.16)); c.lineTo(q(0.16), q(-0.04)); c.lineTo(q(-0.16), q(-0.04)); c.closePath(); }, T.main, T.sh, q(0.02));
      if (front) { eyes(c, 0, q(-0.34), q(0.24), o, { gap: 0.45, iris: '#3a8ad8', brows: false }); blush(c, 0, q(-0.24), q(0.2)); mouth(c, 0, q(-0.2), q(0.14), o); }
      for (let i = 0; i < 3; i++) { const a = o.t * 3 + i * 2.1; sparkle(c, Math.cos(a) * q(0.42), q(-0.36) + Math.sin(a) * q(0.2), q(0.05)); }
      c.restore();
    },
    // Icebound Giant: a hulking ice golem with craggy shoulders, a glowing rune and frosty breath
    icegiant(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = W(o, 6), sw = o.atk || 0, front = o.view === 'front';
      for (const s of [-1, 1]) sh(c, () => rr(c, s * q(0.24) - q(0.14), q(-0.38) + st * s * q(0.05), q(0.28), q(0.38), q(0.12)), ICE[1], '#7fb6d8', q(0.05));
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * q(0.5), q(-0.92)); c.rotate(s * (0.25 + (s > 0 ? sw : 0) * 0.9));
        sh(c, () => rr(c, -q(0.15), 0, q(0.3), q(0.56), q(0.14)), ICE[0], ICE[1], q(0.06));
        sh(c, () => circ(c, 0, q(0.6), q(0.17)), ICE[0], ICE[1], q(0.04));
        c.restore();
      }
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.5), q(-0.36)); c.lineTo(q(-0.52), q(-0.9)); c.quadraticCurveTo(q(-0.5), q(-1.2), q(-0.2), q(-1.22)); c.lineTo(q(0.2), q(-1.22)); c.quadraticCurveTo(q(0.5), q(-1.2), q(0.52), q(-0.9)); c.lineTo(q(0.5), q(-0.36)); c.quadraticCurveTo(0, q(-0.28), q(-0.5), q(-0.36)); c.closePath(); }, ICE[0], ICE[1], q(0.1));
      for (const [x, y] of [[-0.3, -0.6], [0.28, -0.5], [0.1, -1.0]]) line(c, q(x), q(y), q(x + 0.08), q(y + 0.1), 'rgba(90,150,200,0.6)', LW() * 0.6);
      for (const [x, y, h, r] of [[-0.42, -1.1, 0.26, -0.5], [-0.16, -1.2, 0.3, -0.15], [0.16, -1.2, 0.28, 0.15], [0.42, -1.1, 0.24, 0.5]]) { c.save(); c.translate(q(x), q(y)); c.rotate(r); shard(c, 0, 0, q(0.08), q(h), [ICE[2], ICE[1]]); c.restore(); }
      if (front) {
        sh(c, () => poly(c, [0, q(-0.74), q(0.11), q(-0.6), 0, q(-0.46), q(-0.11), q(-0.6)]), T.light, T.main, q(0.03));
        glow(c, 0, q(-0.6), q(0.3), '170,230,255', 0.4);
        eyes(c, 0, q(-0.94), q(0.3), o, { gap: 0.55, iris: '#2a7ad0', fierce: 0.8, browCol: '#5f94bd' });
        mouth(c, 0, q(-0.8), q(0.22), o, 'flat');
      } else sh(c, () => rr(c, q(-0.3), q(-0.74), q(0.6), q(0.08), q(0.04)), T.main, T.sh, q(0.02));
    },
    // Winter Sage: an old frost wizard, a long white beard, starry team robe and a snowflake staff
    wintersage(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', cast = o.atk || 0;
      legs(c, q, o, 0.1, 0.22, 0.12, ['#5a6a88', '#46546e']);
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.4), q(-0.14)); c.quadraticCurveTo(q(-0.32), q(-0.6), q(-0.24), q(-0.9)); c.lineTo(q(0.24), q(-0.9)); c.quadraticCurveTo(q(0.32), q(-0.6), q(0.4), q(-0.14)); c.closePath(); }, T.main, T.sh, q(0.08));
      sh(c, () => rr(c, q(-0.41), q(-0.24), q(0.82), q(0.1), q(0.04)), ICE[0], ICE[1], q(0.03));
      for (const [x, y] of [[-0.18, -0.5], [0.2, -0.38], [0.05, -0.7]]) sparkle(c, q(x), q(y), q(0.05), ICE[0]);
      // the staff with a snowflake crystal
      c.save(); c.translate(q(0.42), q(-0.52)); c.rotate(-0.12 - cast * 0.5);
      rope(c, () => { c.beginPath(); c.moveTo(0, q(0.34)); c.lineTo(0, q(-0.76)); }, '#8a6a4a', q(0.06));
      c.save(); c.translate(0, -q(0.9)); c.rotate(o.t);
      for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); line(c, 0, 0, 0, -q(0.17), OUT, q(0.07)); line(c, 0, 0, 0, -q(0.17), ICE[0], q(0.035)); }
      sh(c, () => circ(c, 0, 0, q(0.07)), ICE[2], ICE[1], q(0.02));
      c.restore();
      glow(c, 0, -q(0.9), q(0.3 + cast * 0.3), '170,230,255', 0.35 + cast * 0.4);
      c.restore();
      arm(c, q(0.18), q(-0.78), q(0.4), q(-0.6), q(0.1), T.main);
      head(c, q, -1.06, 0.26, o, { iris: '#3a7ad0', mouth: false, blush: true });
      if (front) {
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.24), q(-1.0)); c.quadraticCurveTo(q(-0.26), q(-0.66), 0, q(-0.5)); c.quadraticCurveTo(q(0.26), q(-0.66), q(0.24), q(-1.0)); c.quadraticCurveTo(0, q(-0.86), q(-0.24), q(-1.0)); c.closePath(); }, '#f6f8fc', '#c9d2e2', q(0.05));
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.16), q(-0.92)); c.quadraticCurveTo(0, q(-1.0), q(0.16), q(-0.92)); c.quadraticCurveTo(0, q(-0.94), q(-0.16), q(-0.92)); c.closePath(); }, '#f6f8fc', '#c9d2e2', q(0.01));
        for (const sd of [-1, 1]) line(c, sd * q(0.05), q(-1.2), sd * q(0.2), q(-1.17), '#f6f8fc', q(0.05));
      }
      // the pointed hat with a drooping tip and a star
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.34), q(-1.16)); c.quadraticCurveTo(q(-0.1), q(-1.5), q(0.02), q(-1.7)); c.quadraticCurveTo(q(0.24), q(-1.72), q(0.3), q(-1.6)); c.quadraticCurveTo(q(0.12), q(-1.56), q(0.12), q(-1.4)); c.quadraticCurveTo(q(0.2), q(-1.26), q(0.34), q(-1.16)); c.closePath(); }, T.main, T.sh, q(0.05));
      sh(c, () => rr(c, q(-0.36), q(-1.22), q(0.72), q(0.1), q(0.04)), ICE[0], ICE[1], q(0.02));
      sparkle(c, q(0.3), q(-1.6), q(0.07), '#fff6c8');
    },

    /* ---------- Arena 6: Blackwater Harbor ---------- */
    // a Dock Raider: a scrappy young pirate, team bandana, striped shirt, an eyepatch and a cutlass
    raider(c, k, o) {
      const q = v => v * k * 0.85, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0;
      legs(c, q, o, 0.1, 0.3, 0.12, ['#3e3024', '#2a2018'], ['#4a5a7a', '#36445e']);
      sh(c, () => rr(c, q(-0.25), q(-0.72), q(0.5), q(0.44), q(0.13)), PIRATE[0], PIRATE[1], q(0.05));
      c.save(); rr(c, q(-0.25), q(-0.72), q(0.5), q(0.44), q(0.13)); c.clip(); for (const y of [-0.64, -0.54, -0.44]) { c.fillStyle = T.main; c.fillRect(q(-0.3), q(y), q(0.6), q(0.05)); } c.restore();
      sh(c, () => rr(c, q(-0.26), q(-0.36), q(0.52), q(0.08), q(0.03)), LEATHER[0], LEATHER[1], q(0.02));
      c.save(); c.translate(q(front ? 0.28 : -0.28), q(-0.58)); c.rotate((front ? -0.7 : 0.7) + (front ? 1 : -1) * sw * 1.6);
      sh(c, () => { c.beginPath(); c.moveTo(-q(0.035), 0); c.quadraticCurveTo(q(0.16), q(-0.3), q(0.05), q(-0.6)); c.lineTo(q(0.04), 0); c.closePath(); }, STEEL[0], STEEL[1], q(0.03));
      sh(c, () => { c.beginPath(); c.arc(0, q(0.02), q(0.09), 0, Math.PI); c.lineWidth = q(0.03); }, GOLD[0], GOLD[1], 0);
      c.restore();
      head(c, q, -0.98, 0.26, o, { iris: '#4a6a2a' });
      if (front) { line(c, q(-0.26), q(-1.1), q(0.24), q(-0.92), OUT, q(0.03)); sh(c, () => ell(c, q(0.1), q(-0.96), q(0.07), q(0.06)), '#2a2433', '#1a1622', 0); }
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.02), q(0.27), Math.PI, 0); c.quadraticCurveTo(0, q(-1.08), q(-0.27), q(-1.02)); c.closePath(); }, T.main, T.sh, q(0.04));
      if (!front) sh(c, () => circ(c, 0, q(-0.98), q(0.25)), T.main, T.sh, q(0.04));
      for (const y of [-1.06, -0.92]) sh(c, () => ell(c, q(-0.32), q(y), q(0.07), q(0.04), 0.5), T.main, T.sh, 0);
      for (const [x, y] of [[-0.1, -1.16], [0.1, -1.12]]) dot(c, q(x), q(y), q(0.03), '#fff');
    },
    dockraiders(c, k, o) { T6.raider(c, k, o); },
    // a Harpoon Raider: a pirate in a leather vest with a bundle of little harpoons and a red sash
    raidergun(c, k, o) {
      const q = v => v * k * 0.85, T = TEAM[o.team], front = o.view === 'front', th = o.atk || 0;
      legs(c, q, o, 0.1, 0.3, 0.12, ['#3e3024', '#2a2018'], ['#6a5a4a', '#4e4234']);
      sh(c, () => rr(c, q(-0.25), q(-0.72), q(0.5), q(0.44), q(0.13)), PIRATE[0], PIRATE[1], q(0.05));
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.25), q(-0.72), sd * q(0.06), q(-0.72), sd * q(0.08), q(-0.3), sd * q(0.25), q(-0.3)]), '#6a4a2e', '#4e3420', q(0.03));
      sh(c, () => rr(c, q(-0.26), q(-0.38), q(0.52), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
      if (!front) for (const x of [-0.1, 0, 0.1]) line(c, q(x), q(-0.5), q(x + 0.06), q(-1.0), '#9a6a3a', q(0.04));
      c.save(); c.translate(q(front ? 0.3 : -0.3), q(-0.64)); c.rotate((front ? -0.4 : 0.4) + (front ? -1 : 1) * th * 1.2);
      line(c, 0, q(0.1), 0, q(-0.56), OUT, q(0.07)); line(c, 0, q(0.1), 0, q(-0.56), '#9a6a3a', q(0.04));
      sh(c, () => poly(c, [0, q(-0.74), q(-0.07), q(-0.54), q(0.07), q(-0.54)]), STEEL[0], STEEL[1], q(0.02));
      c.restore();
      head(c, q, -0.98, 0.26, o, { skin: ['#e0a982', '#c4885e'], iris: '#3a2a1a' });
      // a knit cap
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.03), q(0.27), Math.PI, 0); c.closePath(); }, T.main, T.sh, q(0.04));
      sh(c, () => rr(c, q(-0.28), q(-1.08), q(0.56), q(0.08), q(0.03)), T.light, T.main, q(0.01));
      if (!front) sh(c, () => circ(c, 0, q(-0.98), q(0.25)), T.main, T.sh, q(0.04));
      sh(c, () => circ(c, 0, q(-1.32), q(0.06)), T.light, T.main, q(0.01));
    },
    // Harpoon Captain: a burly sea captain, a big red-brown beard, tricorn hat, great harpoon and rope
    harpoon(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0, throwing = o.hook || 0;
      legs(c, q, o, 0.15, 0.36, 0.16, ['#3e3024', '#2a2018'], ['#4a5a7a', '#36445e']);
      // the long coat
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.44), q(-0.3)); c.lineTo(q(-0.4), q(-0.98)); c.quadraticCurveTo(0, q(-1.06), q(0.4), q(-0.98)); c.lineTo(q(0.44), q(-0.3)); c.closePath(); }, T.main, T.sh, q(0.07));
      sh(c, () => poly(c, [q(-0.16), q(-0.98), q(0.16), q(-0.98), q(0.12), q(-0.34), q(-0.12), q(-0.34)]), PIRATE[0], PIRATE[1], q(0.03));
      for (const y of [-0.84, -0.66, -0.48]) for (const sd of [-1, 1]) dot(c, sd * q(0.21), q(y), q(0.035), C.gold);
      sh(c, () => rr(c, q(-0.45), q(-0.52), q(0.9), q(0.1), q(0.04)), LEATHER[0], LEATHER[1], q(0.02));
      sh(c, () => rr(c, q(-0.08), q(-0.53), q(0.16), q(0.12), q(0.02)), GOLD[0], GOLD[1], q(0.01));
      // the rope coil on his hip
      ell(c, q(-0.38), q(-0.42), q(0.15), q(0.12)); c.lineWidth = q(0.08); c.strokeStyle = OUT; c.stroke(); c.lineWidth = q(0.05); c.strokeStyle = '#d8b880'; c.stroke();
      ell(c, q(-0.38), q(-0.42), q(0.08), q(0.06)); c.lineWidth = q(0.03); c.strokeStyle = '#b89860'; c.stroke();
      // the great harpoon
      c.save(); c.translate(q(front ? 0.44 : -0.44), q(-0.74)); c.rotate((front ? -0.25 : 0.25) + (front ? -1 : 1) * (sw * 1.1 + throwing * 0.8));
      rope(c, () => { c.beginPath(); c.moveTo(0, q(0.5)); c.lineTo(0, q(-0.9)); }, '#8a6a44', q(0.07));
      if (throwing < 0.5) { sh(c, () => poly(c, [0, q(-1.16), q(-0.11), q(-0.86), 0, q(-0.94), q(0.11), q(-0.86)]), STEEL[0], STEEL[1], q(0.03)); }
      c.restore();
      arm(c, q(0.32), q(-0.9), q(front ? 0.44 : -0.44), q(-0.72), q(0.13), T.main);
      head(c, q, -1.24, 0.3, o, { iris: '#3a5a8a', mouth: false });
      if (front) {
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.3), q(-1.2)); c.quadraticCurveTo(q(-0.32), q(-0.86), 0, q(-0.82)); c.quadraticCurveTo(q(0.32), q(-0.86), q(0.3), q(-1.2)); c.quadraticCurveTo(0, q(-1.06), q(-0.3), q(-1.2)); c.closePath(); }, '#a8542a', '#84401e', q(0.04));
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.2), q(-1.1)); c.quadraticCurveTo(0, q(-1.2), q(0.2), q(-1.1)); c.quadraticCurveTo(0, q(-1.12), q(-0.2), q(-1.1)); c.closePath(); }, '#a8542a', '#84401e', q(0.01));
        mouth(c, 0, q(-1.02), q(0.18), o, sw > 0.2 ? 'open' : 'flat');
      }
      // the tricorn
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.5), q(-1.36)); c.quadraticCurveTo(q(-0.3), q(-1.46), 0, q(-1.42)); c.quadraticCurveTo(q(0.3), q(-1.46), q(0.5), q(-1.36)); c.quadraticCurveTo(q(0.42), q(-1.64), q(0.2), q(-1.66)); c.quadraticCurveTo(0, q(-1.8), q(-0.2), q(-1.66)); c.quadraticCurveTo(q(-0.42), q(-1.64), q(-0.5), q(-1.36)); c.closePath(); }, DARK[0], DARK[1], q(0.05));
      line(c, q(-0.46), q(-1.39), q(0.46), q(-1.39), C.gold, q(0.035));
      if (front) { sh(c, () => circ(c, 0, q(-1.58), q(0.07)), '#f4f0e6', '#cfc8b8', q(0.01)); for (const sd of [-1, 1]) line(c, sd * q(0.04), q(-1.53), sd * q(0.1), q(-1.48), '#f4f0e6', q(0.03)); }
    },
    // Broadside Cart: a ship's cannon with a gold muzzle on a red-wheeled cart, behind a plank shield
    broadside(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', roll = o.t * (o.walk ? 6 : 0), rec = (o.atk || 0) * q(0.12);
      for (const s of [-1, 1]) {
        sh(c, () => circ(c, s * q(0.52), q(-0.22), q(0.22)), '#b8443a', '#8a2e26', q(0.05));
        for (let i = 0; i < 4; i++) { const a = roll + i * 0.785; line(c, s * q(0.52) - Math.cos(a) * q(0.17), q(-0.22) - Math.sin(a) * q(0.17), s * q(0.52) + Math.cos(a) * q(0.17), q(-0.22) + Math.sin(a) * q(0.17), '#6e2018', LW() * 0.7); }
        sh(c, () => circ(c, s * q(0.52), q(-0.22), q(0.06)), GOLD[0], GOLD[1], q(0.01));
      }
      sh(c, () => rr(c, q(-0.62), q(-0.6), q(1.24), q(0.38), q(0.08)), WOOD[0], WOOD[1], q(0.06));
      for (const x of [-0.3, 0, 0.3]) line(c, q(x), q(-0.6), q(x), q(-0.22), WOOD[1], LW() * 0.6);
      sh(c, () => rr(c, q(-0.63), q(-0.4), q(1.26), q(0.07), q(0.02)), T.main, T.sh, q(0.02));
      c.save(); c.translate(0, q(-0.76) + (front ? rec : -rec));
      sh(c, () => rr(c, q(-0.21), q(-0.2), q(0.42), q(0.4), q(0.18)), '#3e414c', '#2a2c34', q(0.05));
      for (const y of [-0.08, 0.06]) line(c, q(-0.21), q(y), q(0.21), q(y), '#5a5e6a', q(0.03));
      sh(c, () => ell(c, 0, front ? q(0.2) : q(-0.22), q(0.18), q(0.1)), GOLD[0], GOLD[1], 0);
      if (front) { ell(c, 0, q(0.2), q(0.1), q(0.055)); c.fillStyle = '#15161b'; c.fill(); }
      c.restore();
      if (o.shield) {
        const y0 = front ? -0.52 : -1.02;
        sh(c, () => rr(c, q(-0.6), q(y0), q(1.2), q(0.52), q(0.07)), '#b07c44', '#835628', q(0.05));
        for (const x of [-0.3, 0, 0.3]) line(c, q(x), q(y0), q(x), q(y0 + 0.52), '#6e4622', LW() * 0.7);
        for (const y of [0.12, 0.4]) { line(c, q(-0.6), q(y0 + y), q(0.6), q(y0 + y), '#5a5f6a', q(0.05)); for (const x of [-0.45, 0.45]) dot(c, q(x), q(y0 + y), q(0.03), '#c9cfda'); }
        sh(c, () => circ(c, 0, q(y0 + 0.26), q(0.1)), T.main, T.sh, q(0.02));
        sh(c, () => poly(c, [0, q(y0 + 0.18), q(0.05), q(y0 + 0.26), 0, q(y0 + 0.34), q(-0.05), q(y0 + 0.26)]), '#fff', '#ddd', 0);
      }
    },

    /* ---------- Arena 7: Gearforge Citadel ---------- */
    // a Sparkbot: a cheerful little robot on treads with screen eyes and a sparking antenna
    sparkbots(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', zap = o.atk || 0, bob = W(o, 14) * q(0.03);
      sh(c, () => rr(c, q(-0.32), q(-0.2), q(0.64), q(0.2), q(0.09)), '#4a4a55', '#33333c', q(0.04));
      for (let i = 0; i < 4; i++) dot(c, q(-0.22 + i * 0.15), q(-0.1), q(0.04), '#7a7a86');
      c.save(); c.translate(0, bob);
      for (const sd of [-1, 1]) { line(c, sd * q(0.28), q(-0.48), sd * q(0.42), q(-0.36 - (sd > 0 ? zap * 0.2 : 0)), OUT, q(0.07)); line(c, sd * q(0.28), q(-0.48), sd * q(0.42), q(-0.36 - (sd > 0 ? zap * 0.2 : 0)), '#9aa3b2', q(0.04)); sh(c, () => circ(c, sd * q(0.43), q(-0.34 - (sd > 0 ? zap * 0.2 : 0)), q(0.06)), BRONZE[0], BRONZE[1], q(0.01)); }
      sh(c, () => rr(c, q(-0.3), q(-0.72), q(0.6), q(0.54), q(0.14)), BRONZE[0], BRONZE[1], q(0.06));
      for (const [x, y] of [[-0.22, -0.64], [0.22, -0.64], [-0.22, -0.26], [0.22, -0.26]]) dot(c, q(x), q(y), q(0.025), '#7a5220');
      sh(c, () => rr(c, q(-0.31), q(-0.34), q(0.62), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
      if (front) {
        sh(c, () => rr(c, q(-0.22), q(-0.64), q(0.44), q(0.24), q(0.06)), '#1e2a3a', '#141c28', q(0.02));
        for (const sd of [-1, 1]) { const h = zap > 0.3 ? 0.03 : 0.08; rr(c, sd * q(0.09) - q(0.04), q(-0.52) - q(h / 2), q(0.08), q(h), q(0.02)); c.fillStyle = '#8ff0ff'; c.fill(); }
        glow(c, 0, q(-0.52), q(0.24), '120,220,255', 0.3);
      } else for (let i = 0; i < 3; i++) line(c, q(-0.16), q(-0.62 + i * 0.08), q(0.16), q(-0.62 + i * 0.08), '#8a6026', LW() * 0.6);
      line(c, 0, q(-0.72), 0, q(-0.96), OUT, q(0.06)); line(c, 0, q(-0.72), 0, q(-0.96), '#c9d0db', q(0.03));
      sh(c, () => circ(c, 0, q(-1.0), q(0.08)), '#ffe27a', '#e0b030', q(0.02));
      if (zap > 0.1 || Math.sin(o.t * 7) > 0.8) { glow(c, 0, q(-1.0), q(0.3 + zap * 0.3), '150,230,255', 0.7); for (let i = 0; i < 3; i++) { const a = o.t * 11 + i * 2.1; line(c, Math.cos(a) * q(0.1), q(-1.0) + Math.sin(a) * q(0.1), Math.cos(a) * q(0.22), q(-1.0) + Math.sin(a) * q(0.22), '#e8fbff', q(0.025)); } }
      c.restore();
    },
    titan(c, k, o) { titanArt(c, k, o, true); },
    titanling(c, k, o) { titanArt(c, k * 0.62, o, false); },
    // Arc Cannon: a heavy engine on treads, a copper coil cannon whose orb brightens as it charges
    arccannon(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', ch = Math.max(0, Math.min(1, o.charge || 0)), roll = o.walk ? o.t * 4 : 0;
      sh(c, () => rr(c, q(-0.68), q(-0.32), q(1.36), q(0.32), q(0.15)), '#3e3e48', '#2a2a32', q(0.05));
      for (let i = 0; i < 6; i++) dot(c, q(-0.55 + ((i * 0.22 + roll * 0.05) % 1.32)), q(-0.16), q(0.06), '#6a6a76');
      sh(c, () => rr(c, q(-0.58), q(-0.82), q(1.16), q(0.54), q(0.16)), BRONZE[0], BRONZE[1], q(0.07));
      for (const x of [-0.46, 0.46]) for (const y of [-0.72, -0.4]) dot(c, q(x), q(y), q(0.03), '#7a5220');
      sh(c, () => rr(c, q(-0.59), q(-0.52), q(1.18), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
      // a gauge showing the charge
      sh(c, () => circ(c, q(-0.34), q(-0.66), q(0.1)), '#f4f0e6', '#cfc8b8', q(0.02));
      line(c, q(-0.34), q(-0.66), q(-0.34) + Math.cos(Math.PI + ch * Math.PI) * q(0.08), q(-0.66) + Math.sin(Math.PI + ch * Math.PI) * q(0.08), '#c0283a', q(0.025));
      const y = front ? -1.0 : -1.1;
      sh(c, () => rr(c, q(-0.24), q(y - 0.36), q(0.48), q(0.64), q(0.2)), '#555a66', '#3a3e48', q(0.05));
      for (let i = 0; i < 4; i++) { line(c, q(-0.26), q(y - 0.25 + i * 0.14), q(0.26), q(y - 0.25 + i * 0.14), OUT, q(0.08)); line(c, q(-0.25), q(y - 0.25 + i * 0.14), q(0.25), q(y - 0.25 + i * 0.14), '#e0a050', q(0.05)); }
      const cy = q(y - 0.46);
      if (ch > 0.05) glow(c, 0, cy, q(0.3 + ch * 0.7), '140,220,255', 0.3 + ch * 0.5);
      sh(c, () => circ(c, 0, cy, q(0.17)), ch > 0.95 ? '#f0fcff' : '#8fd8ff', '#4a9ee0', q(0.03));
      if (front) for (const sd of [-1, 1]) dot(c, sd * q(0.06), cy, q(0.035), '#1e3a6a');
      if (ch > 0.6) for (let i = 0; i < 4; i++) { const a = o.t * 9 + i * 1.6, r1 = q(0.18), r2 = q(0.3 + ch * 0.16); line(c, Math.cos(a) * r1, cy + Math.sin(a) * r1, Math.cos(a + 0.3) * r2, cy + Math.sin(a + 0.3) * r2, '#e8fbff', q(0.03)); }
    },

    /* ---------- Arena 8: Crystal Chasm ---------- */
    // a Shard Guard: a spear guard in crystal-studded armor, a glowing crystal shield while it holds
    shardguards(c, k, o) {
      const q = v => v * k * 0.9, T = TEAM[o.team], front = o.view === 'front', thrust = o.atk || 0;
      legs(c, q, o, 0.1, 0.3, 0.12, ['#3e3a52', '#2a2638'], ['#5a5272', '#423c58']);
      torso(c, q, T, -0.74, -0.3, 0.24, { col: '#6e64a0', sh: '#524a80', trimCol: CRYSTAL });
      shard(c, 0, q(-0.42), q(0.07), q(0.22), CRYSTAL);
      c.save(); c.translate(q(front ? 0.3 : -0.3), q(-0.6) - thrust * q(0.22));
      line(c, 0, q(0.4), 0, q(-0.9), OUT, q(0.07)); line(c, 0, q(0.4), 0, q(-0.9), '#9a8ab8', q(0.04));
      shard(c, 0, q(-0.88), q(0.08), q(0.28), CRYSTAL);
      c.restore();
      head(c, q, -0.98, 0.26, o, { iris: '#8a5cf0' });
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.03), q(0.28), Math.PI, 0); c.lineTo(q(0.28), q(-0.98)); c.lineTo(q(-0.28), q(-0.98)); c.closePath(); }, '#6e64a0', '#524a80', q(0.04));
      if (!front) sh(c, () => circ(c, 0, q(-0.98), q(0.26)), '#6e64a0', '#524a80', q(0.04));
      shard(c, 0, q(-1.24), q(0.08), q(0.26), CRYSTAL);
      if (o.shield) {
        c.save(); c.translate(q(front ? -0.3 : 0.3), q(-0.56));
        glow(c, 0, 0, q(0.4), '200,170,255', 0.4);
        sh(c, () => poly(c, [0, q(-0.32), q(0.21), q(-0.17), q(0.15), q(0.2), 0, q(0.34), q(-0.15), q(0.2), q(-0.21), q(-0.17)]), '#e8daff', '#a882f0', q(0.04));
        poly(c, [0, q(-0.32), 0, q(0.34)]); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = LW() * 0.6; c.stroke();
        sparkle(c, q(-0.06), q(-0.12), q(0.06));
        c.restore();
      }
    },
    // a Crystal Imp: a mischievous little crystal creature with pointy ears and a toothy grin
    imp(c, k, o) {
      const q = v => v * k * 0.8, T = TEAM[o.team], front = o.view === 'front', hop = Math.abs(W(o, 12)) * q(0.12);
      c.save(); c.translate(0, -hop);
      legs(c, q, o, 0.1, 0.22, 0.1, CRYSTAL, CRYSTAL);
      for (const sd of [-1, 1]) line(c, sd * q(0.24), q(-0.5), sd * q(0.4), q(-0.38 - (sd > 0 ? (o.atk || 0) * 0.3 : 0)), CRYSTAL[1], q(0.07));
      sh(c, () => ell(c, 0, q(-0.5), q(0.28), q(0.3)), CRYSTAL[0], CRYSTAL[1], q(0.06));
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.16), q(-0.66), sd * q(0.42), q(-0.9), sd * q(0.26), q(-0.56)]), CRYSTAL[0], CRYSTAL[1], q(0.03));
      for (const x of [-0.1, 0.1]) shard(c, q(x), q(-0.76), q(0.05), q(0.16), [CRYSTAL[2], CRYSTAL[1]]);
      sh(c, () => rr(c, q(-0.2), q(-0.3), q(0.4), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
      if (front) { eyes(c, 0, q(-0.54), q(0.22), o, { gap: 0.45, iris: '#ffd23f', fierce: 0.7 }); mouth(c, 0, q(-0.4), q(0.18), o, 'open'); }
      c.restore();
    },
    // Prism Archer: a hooded ranger with a crystal bow, a glowing gem on her brow and a crystal quiver
    prism(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', draw = o.atk || 0, d = front ? 1 : -1;
      legs(c, q, o, 0.1, 0.32, 0.13, ['#3a3450', '#28243a'], ['#4a4268', '#36304e']);
      c.save(); c.translate(q(-0.26 * d), q(-0.84)); c.rotate(-0.3 * d);
      sh(c, () => rr(c, -q(0.08), 0, q(0.16), q(0.42), q(0.05)), '#5a4a7a', '#40345a', q(0.02));
      for (const x of [-0.04, 0.04]) shard(c, q(x), q(0.02), q(0.04), q(0.14), CRYSTAL);
      c.restore();
      sh(c, () => poly(c, [q(-0.32), q(-0.3), q(0.32), q(-0.3), q(0.24), q(-0.88), q(-0.24), q(-0.88)]), T.main, T.sh, q(0.06));
      torso(c, q, T, -0.84, -0.36, 0.2, { col: '#4a4268', sh: '#36304e', trimCol: CRYSTAL });
      c.save(); c.translate(q(0.36 * d), q(-0.68));
      const a0 = front ? -1.2 : Math.PI - 1.2, a1 = front ? 1.2 : Math.PI + 1.2;
      c.beginPath(); c.arc(0, 0, q(0.44), a0, a1); c.lineWidth = q(0.11); c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke(); c.lineWidth = q(0.065); c.strokeStyle = CRYSTAL[0]; c.stroke();
      const pull = -d * draw * q(0.18);
      line(c, Math.cos(a0) * q(0.44), Math.sin(a0) * q(0.44), pull, 0, '#efe2ff', q(0.02)); line(c, pull, 0, Math.cos(a1) * q(0.44), Math.sin(a1) * q(0.44), '#efe2ff', q(0.02));
      if (draw > 0.2) { line(c, pull, 0, d * q(0.3), 0, '#f3eaff', q(0.04)); glow(c, d * q(0.3), 0, q(0.3), '220,190,255', 0.6 * draw); }
      c.restore();
      head(c, q, -1.1, 0.27, o, { iris: '#8a5cf0' });
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.12), q(0.32), Math.PI * 1.0, 0); c.lineTo(q(0.3), q(-0.96)); c.quadraticCurveTo(q(0.16), q(-1.3), 0, q(-1.3)); c.quadraticCurveTo(q(-0.16), q(-1.3), q(-0.3), q(-0.96)); c.closePath(); }, T.main, T.sh, q(0.05));
      if (!front) sh(c, () => circ(c, 0, q(-1.1), q(0.29)), T.main, T.sh, q(0.05));
      sh(c, () => poly(c, [q(-0.08), q(-1.42), q(0.08), q(-1.42), 0, q(-1.62)]), T.main, T.sh, q(0.02));
      if (front) { shard(c, 0, q(-1.24), q(0.05), q(0.12), CRYSTAL); glow(c, 0, q(-1.3), q(0.14), '220,190,255', 0.5); }
    },

    /* ---------- Arena 9: Skyward Sanctuary ---------- */
    // Sun Sprite: a smiling little sun with a ring of turning rays
    sunsprite(c, k, o) {
      const q = v => v * k * 1.3, T = TEAM[o.team], hop = Math.abs(Math.sin(o.t * 9)) * q(o.walk ? 0.18 : 0.06), front = o.view === 'front';
      c.save(); c.translate(0, -hop);
      glow(c, 0, q(-0.34), q(0.7), '255,220,120', 0.5);
      for (let i = 0; i < 8; i++) { const a = i * 0.785 + o.t * 1.5; c.save(); c.translate(0, q(-0.34)); c.rotate(a); sh(c, () => poly(c, [q(0.25), -q(0.06), q(0.42), 0, q(0.25), q(0.06)]), '#ffd23f', '#f0a81a', 0); c.restore(); }
      sh(c, () => circ(c, 0, q(-0.34), q(0.25)), '#fff1a6', '#ffcd33', q(0.05));
      sh(c, () => { c.beginPath(); c.arc(0, q(-0.34), q(0.25), 0.5, Math.PI - 0.5); c.closePath(); }, T.main, T.sh, 0);
      if (front) { eyes(c, 0, q(-0.38), q(0.22), o, { gap: 0.45, iris: '#c97a10', brows: false }); blush(c, 0, q(-0.3), q(0.2)); mouth(c, 0, q(-0.27), q(0.14), o); }
      c.restore();
    },
    // Celestial Guardian: a radiant paladin in white and gold, feathered wings, a halo and a healing hammer
    guardian(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0, flap = Math.sin(o.t * 3) * 0.08;
      for (const s of [-1, 1]) { c.save(); c.translate(s * q(0.2), q(-0.86)); c.rotate(s * flap); c.scale(s, 1);
        sh(c, () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.3), q(-0.4), q(0.56), q(-0.36)); c.quadraticCurveTo(q(0.5), q(-0.2), q(0.54), q(-0.1)); c.quadraticCurveTo(q(0.42), q(0.0), q(0.44), q(0.12)); c.quadraticCurveTo(q(0.24), q(0.14), 0, q(0.24)); c.closePath(); }, '#ffffff', '#d9dfe9', q(0.04));
        for (const [x, y] of [[0.22, -0.12], [0.34, -0.02]]) line(c, q(x), q(y), q(x + 0.12), q(y - 0.06), '#c9cfdc', LW() * 0.5);
        c.restore(); }
      legs(c, q, o, 0.13, 0.34, 0.15, STEEL, ['#f1f3f8', '#c9cfdc']);
      torso(c, q, T, -0.94, -0.32, 0.3, { col: '#f6f7fb', sh: '#c9cfdc' });
      sh(c, () => poly(c, [q(-0.22), q(-0.32), q(0.22), q(-0.32), q(0.3), q(-0.16), q(-0.3), q(-0.16)]), T.main, T.sh, q(0.03));
      sh(c, () => poly(c, [0, q(-0.86), q(0.11), q(-0.72), 0, q(-0.56), q(-0.11), q(-0.72)]), GOLD[0], GOLD[1], q(0.03));
      for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(0.32), q(-0.88), q(0.14), q(0.1)), GOLD[0], GOLD[1], q(0.03));
      c.save(); c.translate(q(front ? 0.4 : -0.4), q(-0.72)); c.rotate((front ? -0.4 : 0.4) + (front ? 1 : -1) * sw * 1.6);
      rope(c, () => { c.beginPath(); c.moveTo(0, q(0.18)); c.lineTo(0, q(-0.54)); }, '#c9a060', q(0.06));
      glow(c, 0, q(-0.64), q(0.35 + sw * 0.3), '255,230,140', 0.4 + sw * 0.4);
      sh(c, () => rr(c, q(-0.21), q(-0.76), q(0.42), q(0.26), q(0.07)), GOLD[0], GOLD[1], q(0.04));
      sh(c, () => rr(c, q(-0.08), q(-0.72), q(0.16), q(0.18), q(0.03)), '#fff6c8', '#ffe27a', q(0.01));
      c.restore();
      head(c, q, -1.18, 0.27, o, { iris: '#c99a20' });
      // golden hair framing the face
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.2), q(0.29), Math.PI * 1.05, -Math.PI * 0.05); c.quadraticCurveTo(q(0.1), q(-1.34), 0, q(-1.26)); c.quadraticCurveTo(q(-0.1), q(-1.34), q(-0.28), q(-1.26)); c.closePath(); }, '#ffd86a', '#e0a83a', q(0.03));
      if (!front) sh(c, () => { c.beginPath(); c.arc(0, q(-1.16), q(0.29), Math.PI * 1.0, 0); c.lineTo(q(0.3), q(-0.92)); c.lineTo(q(-0.3), q(-0.92)); c.closePath(); }, '#ffd86a', '#e0a83a', q(0.04));
      ell(c, 0, q(-1.58), q(0.24), q(0.07)); c.lineWidth = q(0.08); c.strokeStyle = OUT; c.stroke(); c.lineWidth = q(0.045); c.strokeStyle = '#ffe27a'; c.stroke();
      glow(c, 0, q(-1.58), q(0.3), '255,230,140', 0.4);
    },
    // Cloud Drake: a chubby young sky dragon, storm-blue scales, cloud wings, little horns and a grin
    drake(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 8 + (o.id || 0)), front = o.view === 'front', breath = o.atk || 0;
      for (const s of [-1, 1]) {
        c.save(); c.scale(s, 1); c.translate(q(0.2), q(-0.12)); c.rotate(-0.2 - flap * 0.4);
        const wing = () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.4), q(-0.62), q(0.88), q(-0.44)); c.quadraticCurveTo(q(0.66), q(-0.3), q(0.74), q(-0.12)); c.quadraticCurveTo(q(0.56), q(-0.14), q(0.52), q(0.02)); c.quadraticCurveTo(q(0.36), q(-0.02), q(0.3), q(0.12)); c.quadraticCurveTo(q(0.14), q(0.06), 0, q(0.12)); c.closePath(); };
        sh(c, wing, '#6fa8d8', '#4a84b8', q(0.05));
        c.save(); wing(); c.clip(); sh(c, () => { c.beginPath(); c.moveTo(q(0.1), q(0.1)); c.quadraticCurveTo(q(0.4), q(-0.4), q(0.86), q(-0.42)); c.lineTo(q(0.9), q(0.2)); c.closePath(); }, '#eef6ff', '#bcd2ea', 0); c.restore();
        wing(); c.lineWidth = LW(); c.strokeStyle = OUT; c.stroke();
        c.restore();
      }
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.06), q(0.14)); c.quadraticCurveTo(q(0.06), q(0.56), q(0.22), q(0.62)); c.lineTo(q(0.12), q(0.7)); c.quadraticCurveTo(q(-0.06), q(0.6), q(0.08), q(0.12)); c.closePath(); }, '#6fa8d8', '#4a84b8', q(0.03));
      sh(c, () => ell(c, 0, q(0.02), q(0.26), q(0.3)), '#6fa8d8', '#4a84b8', q(0.06));
      sh(c, () => ell(c, 0, q(0.08), q(0.16), q(0.2)), '#f2e6b8', '#d4c48e', q(0.04));
      for (const y of [0.0, 0.08, 0.16]) line(c, q(-0.1), q(y), q(0.1), q(y), '#c4b07a', LW() * 0.5);
      sh(c, () => rr(c, q(-0.22), q(-0.12), q(0.44), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
      sh(c, () => circ(c, 0, q(-0.38), q(0.23)), '#6fa8d8', '#4a84b8', q(0.04));
      for (const s of [-1, 1]) sh(c, () => poly(c, [s * q(0.08), q(-0.56), s * q(0.2), q(-0.78), s * q(0.18), q(-0.52)]), '#f2e6b8', '#d4c48e', q(0.02));
      if (front) {
        sh(c, () => ell(c, 0, q(-0.28), q(0.15), q(0.09)), '#8cc0e8', '#6aa0cc', q(0.02));
        for (const sd of [-1, 1]) dot(c, sd * q(0.05), q(-0.3), q(0.018));
        eyes(c, 0, q(-0.42), q(0.2), o, { gap: 0.5, iris: '#ffc52e' });
        if (breath > 0.2) glow(c, 0, q(-0.2), q(0.4), '220,240,255', 0.6 * breath);
      }
    },
    // Dawn Phoenix: a radiant firebird, gold and flame-red, a crest of fire and a trailing flame tail
    phoenix(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 10 + (o.id || 0)), front = o.view === 'front';
      glow(c, 0, 0, q(1.0), '255,170,60', 0.4);
      for (const i of [0, 4, 1, 3, 2]) { const x = (i - 2) * 0.13, w = Math.sin(o.t * 12 + i) * 0.05, len = 0.8 - Math.abs(i - 2) * 0.1;
        sh(c, () => { c.beginPath(); c.moveTo(q(x * 0.5 - 0.09), q(0.12)); c.quadraticCurveTo(q(x * 1.2 - 0.12 + w), q(0.45), q(x * 1.7 + w), q(len)); c.quadraticCurveTo(q(x * 1.2 + 0.12 + w), q(0.45), q(x * 0.5 + 0.09), q(0.12)); c.closePath(); }, i === 2 ? '#ffe27a' : i % 2 ? '#ffb52e' : '#ff6a2a', '#e0601a', q(0.03)); }
      for (const s of [-1, 1]) {
        c.save(); c.scale(s, 1); c.translate(q(0.16), q(-0.1)); c.rotate(-0.25 - flap * 0.5);
        const wing = () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.36), q(-0.6), q(0.9), q(-0.56)); c.lineTo(q(0.7), q(-0.38)); c.lineTo(q(0.82), q(-0.24)); c.lineTo(q(0.56), q(-0.16)); c.lineTo(q(0.64), q(-0.02)); c.lineTo(q(0.4), q(0.0)); c.quadraticCurveTo(q(0.2), q(0.12), 0, q(0.12)); c.closePath(); };
        sh(c, wing, '#ffb52e', '#e0761a', q(0.05));
        c.save(); wing(); c.clip(); c.fillStyle = '#ff5a2a'; c.fillRect(q(0.5), q(-0.7), q(0.6), q(0.9)); c.restore();
        wing(); c.lineWidth = LW(); c.strokeStyle = OUT; c.stroke();
        c.restore();
      }
      sh(c, () => ell(c, 0, 0, q(0.22), q(0.3)), '#ffcd33', '#e09f12', q(0.06));
      if (front) sh(c, () => ell(c, 0, q(0.06), q(0.13), q(0.18)), '#fff1c0', '#f0d080', q(0.03));
      sh(c, () => rr(c, q(-0.2), q(-0.06), q(0.4), q(0.06), q(0.03)), T.main, T.sh, q(0.02));
      sh(c, () => circ(c, 0, q(-0.36), q(0.2)), '#ffcd33', '#e09f12', q(0.04));
      for (const [x, h, r] of [[-0.1, 0.24, -0.4], [0, 0.32, 0], [0.1, 0.24, 0.4]]) { c.save(); c.translate(q(x), q(-0.5)); c.rotate(r); sh(c, () => { c.beginPath(); c.moveTo(-q(0.05), 0); c.quadraticCurveTo(-q(0.04), -q(h * 0.6), 0, -q(h)); c.quadraticCurveTo(q(0.06), -q(h * 0.5), q(0.05), 0); c.closePath(); }, '#ff6a2a', '#d0441a', q(0.02)); c.restore(); }
      if (front) { eyes(c, 0, q(-0.38), q(0.17), o, { gap: 0.55, iris: '#e0441a', fierce: 0.6 }); sh(c, () => poly(c, [q(-0.05), q(-0.32), q(0.05), q(-0.32), 0, q(-0.2)]), '#fff1c0', '#e0c080', q(0.02)); }
    },
    // the Phoenix egg: a golden egg with flame patterns, cracking as it gets ready to hatch
    phoenixegg(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], p = o.hatch || 0, beat = 0.5 + 0.5 * Math.sin(o.t * (4 + p * 10)), wob = Math.sin(o.t * (6 + p * 14)) * p * 0.12;
      glow(c, 0, q(-0.36), q(0.6 + beat * 0.25), '255,170,60', 0.3 + p * 0.4);
      ell(c, 0, q(-0.02), q(0.3), q(0.08)); c.fillStyle = '#8a6a4a'; c.fill();
      for (let i = 0; i < 5; i++) line(c, q(-0.3 + i * 0.15), q(-0.06), q(-0.24 + i * 0.15), q(0.04), '#6a4a2e', q(0.04));
      c.save(); c.translate(0, q(-0.04)); c.rotate(wob);
      sh(c, () => ell(c, 0, q(-0.34), q(0.27), q(0.36)), '#ffe9a8', '#f0b44a', q(0.07));
      for (const [x, y, r] of [[-0.1, -0.5, 0.3], [0.12, -0.3, -0.3]]) { c.save(); c.translate(q(x), q(y)); c.rotate(r); c.beginPath(); c.moveTo(-q(0.08), q(0.06)); c.quadraticCurveTo(-q(0.04), -q(0.06), 0, -q(0.14)); c.quadraticCurveTo(q(0.04), -q(0.06), q(0.08), q(0.06)); c.closePath(); c.fillStyle = '#ff9a3a'; c.fill(); c.restore(); }
      sh(c, () => rr(c, q(-0.25), q(-0.2), q(0.5), q(0.06), q(0.03)), T.main, T.sh, q(0.02));
      if (p > 0.4) { c.beginPath(); c.moveTo(q(-0.16), q(-0.46)); c.lineTo(q(-0.06), q(-0.38)); c.lineTo(q(0.02), q(-0.48)); c.lineTo(q(0.1), q(-0.4)); if (p > 0.7) { c.lineTo(q(0.18), q(-0.5)); } c.strokeStyle = OUT; c.lineWidth = LW() * 0.8; c.stroke(); }
      c.restore();
    },

    /* ---------- Arena 10: Eclipse Throne ---------- */
    wraiths(c, k, o) { wraithArt(c, k, o); },
    wraith(c, k, o) { wraithArt(c, k, o); },
    // Dread Knight: a towering knight in black spiked plate, crimson light in the seams, a great blade
    dreadknight(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0;
      legs(c, q, o, 0.2, 0.46, 0.22, DARK, DARK);
      // a tattered cape behind
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.5), q(-1.3)); c.lineTo(q(0.5), q(-1.3)); c.lineTo(q(0.6), q(-0.32)); c.lineTo(q(0.36), q(-0.4)); c.lineTo(q(0.2), q(-0.26)); c.lineTo(0, q(-0.38)); c.lineTo(q(-0.2), q(-0.26)); c.lineTo(q(-0.36), q(-0.4)); c.lineTo(q(-0.6), q(-0.32)); c.closePath(); }, T.main, T.sh, q(0.06));
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.5), q(-1.34)); c.quadraticCurveTo(q(-0.54), q(-0.7), q(-0.4), q(-0.44)); c.lineTo(q(0.4), q(-0.44)); c.quadraticCurveTo(q(0.54), q(-0.7), q(0.5), q(-1.34)); c.closePath(); }, DARK[0], DARK[1], q(0.08));
      for (const y of [-1.08, -0.82]) { line(c, q(-0.42), q(y), q(0.42), q(y), '#ff3a4a', q(0.035)); }
      glow(c, 0, q(-0.94), q(0.5), '220,40,60', 0.35);
      sh(c, () => poly(c, [0, q(-1.18), q(0.12), q(-0.98), 0, q(-0.8), q(-0.12), q(-0.98)]), '#ff4a5a', '#b02030', q(0.02));
      sh(c, () => rr(c, q(-0.46), q(-0.56), q(0.92), q(0.12), q(0.05)), '#5a5466', '#3a3446', q(0.03));
      for (const s of [-1, 1]) {
        sh(c, () => ell(c, s * q(0.56), q(-1.24), q(0.24), q(0.18)), DARK[0], DARK[1], q(0.05));
        for (const a of [-0.5, 0, 0.5]) sh(c, () => poly(c, [s * q(0.56 + Math.sin(a) * 0.14), q(-1.36), s * q(0.56 + Math.sin(a) * 0.26), q(-1.62 + Math.abs(a) * 0.14), s * q(0.56 + Math.sin(a) * 0.14 + 0.08), q(-1.36)]), '#5a5466', '#3a3446', q(0.02));
      }
      c.save(); c.translate(q(front ? 0.64 : -0.64), q(-1.0)); c.rotate((front ? -0.5 : 0.5) + (front ? 1 : -1) * sw * 1.8);
      sh(c, () => poly(c, [q(-0.11), 0, q(0.11), 0, q(0.09), q(-1.22), 0, q(-1.4), q(-0.09), q(-1.22)]), '#5a5466', '#3a3446', q(0.05));
      line(c, 0, q(-0.1), 0, q(-1.2), '#ff3a4a', q(0.035));
      glow(c, 0, q(-0.7), q(0.4), '255,60,80', 0.25 + sw * 0.3);
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.3), q(0.02)); c.quadraticCurveTo(0, q(-0.12), q(0.3), q(0.02)); c.lineTo(q(0.26), q(0.08)); c.quadraticCurveTo(0, q(-0.02), q(-0.26), q(0.08)); c.closePath(); }, '#8a8496', '#6a6476', q(0.02));
      sh(c, () => rr(c, q(-0.05), q(0.06), q(0.1), q(0.24), q(0.03)), LEATHER[0], LEATHER[1], q(0.01));
      c.restore();
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.3), q(-1.36)); c.lineTo(q(-0.32), q(-1.7)); c.quadraticCurveTo(0, q(-1.98), q(0.32), q(-1.7)); c.lineTo(q(0.3), q(-1.36)); c.quadraticCurveTo(0, q(-1.28), q(-0.3), q(-1.36)); c.closePath(); }, DARK[0], DARK[1], q(0.06));
      if (front) {
        poly(c, [q(-0.24), q(-1.64), q(-0.04), q(-1.56), q(-0.04), q(-1.5), q(-0.22), q(-1.56)]); c.fillStyle = '#ff3a4a'; c.fill();
        poly(c, [q(0.24), q(-1.64), q(0.04), q(-1.56), q(0.04), q(-1.5), q(0.22), q(-1.56)]); c.fillStyle = '#ff3a4a'; c.fill();
        glow(c, 0, q(-1.56), q(0.4), '255,60,80', 0.55);
        line(c, 0, q(-1.5), 0, q(-1.36), '#1a1622', q(0.04));
      }
      for (const s of [-1, 1]) sh(c, () => { c.beginPath(); c.moveTo(s * q(0.22), q(-1.78)); c.quadraticCurveTo(s * q(0.5), q(-1.86), s * q(0.52), q(-2.2)); c.quadraticCurveTo(s * q(0.36), q(-1.96), s * q(0.14), q(-1.88)); c.closePath(); }, '#5a5466', '#3a3446', q(0.03));
    },
  };

  // Steel Titan (big) and a Titanling (small): a clockwork giant with gear shoulders, a furnace core
  // and a visor face whose eyes glow
  function titanArt(c, k, o, big) {
    const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', st = W(o, 5), sw = o.atk || 0;
    for (const s of [-1, 1]) { sh(c, () => rr(c, s * q(0.36) - q(0.2), q(-0.52) + st * s * q(0.06), q(0.4), q(0.52), q(0.12)), '#6a5a48', '#4e4234', q(0.06)); sh(c, () => rr(c, s * q(0.36) - q(0.24), q(-0.16), q(0.48), q(0.16), q(0.06)), '#4e4234', '#3a3026', q(0.02)); }
    for (const s of [-1, 1]) {
      c.save(); c.translate(s * q(0.74), q(-1.32)); c.rotate(s * (0.2 + (s > 0 ? sw * 1.0 : 0)));
      sh(c, () => rr(c, -q(0.2), 0, q(0.4), q(0.86), q(0.16)), BRONZE[0], BRONZE[1], q(0.07));
      for (const y of [0.3, 0.56]) line(c, -q(0.2), q(y), q(0.2), q(y), '#8a5a20', LW() * 0.6);
      sh(c, () => rr(c, -q(0.25), q(0.8), q(0.5), q(0.36), q(0.14)), '#6a5a48', '#4e4234', q(0.05));
      for (const x of [-0.12, 0, 0.12]) line(c, q(x), q(1.0), q(x), q(1.14), '#3a3026', LW() * 0.6);
      c.restore();
      c.save(); c.translate(s * q(0.62), q(-1.38)); c.rotate(o.t * 2 * s);
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); rr(c, -q(0.05), -q(0.28), q(0.1), q(0.1), q(0.02)); paint(c, BRONZE[1], LW() * 0.6); }
      sh(c, () => circ(c, 0, 0, q(0.21)), BRONZE[0], BRONZE[1], q(0.04));
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); line(c, 0, 0, 0, -q(0.15), BRONZE[1], LW() * 0.6); }
      dot(c, 0, 0, q(0.06), '#3a2f24');
      c.restore();
    }
    sh(c, () => { c.beginPath(); c.moveTo(q(-0.62), q(-1.5)); c.quadraticCurveTo(q(-0.64), q(-1.64), q(-0.4), q(-1.64)); c.lineTo(q(0.4), q(-1.64)); c.quadraticCurveTo(q(0.64), q(-1.64), q(0.62), q(-1.5)); c.lineTo(q(0.5), q(-0.5)); c.quadraticCurveTo(0, q(-0.4), q(-0.5), q(-0.5)); c.closePath(); }, BRONZE[0], BRONZE[1], q(0.1));
    for (const [x, y] of [[-0.48, -1.5], [0.48, -1.5], [-0.42, -0.64], [0.42, -0.64]]) dot(c, q(x), q(y), q(0.045), '#6a4a24');
    sh(c, () => rr(c, q(-0.56), q(-0.74), q(1.12), q(0.12), q(0.05)), T.main, T.sh, q(0.03));
    if (front) {
      sh(c, () => circ(c, 0, q(-1.1), q(0.26)), '#5a4a38', '#3e3226', q(0.03));
      for (let i = 0; i < 3; i++) line(c, q(-0.18), q(-1.18 + i * 0.08), q(0.18), q(-1.18 + i * 0.08), '#2a2018', q(0.04));
      const fl = 0.7 + 0.3 * Math.sin(o.t * 8);
      sh(c, () => circ(c, 0, q(-1.1), q(0.17)), '#ffe9a8', '#ffb52e', q(0.04));
      glow(c, 0, q(-1.1), q(big ? 0.7 : 0.45), '255,170,60', 0.45 * fl);
    } else for (let i = 0; i < 3; i++) sh(c, () => rr(c, q(-0.3 + i * 0.22), q(-1.42), q(0.16), q(0.36), q(0.06)), '#555a66', '#3a3e48', q(0.02));
    sh(c, () => rr(c, q(-0.3), q(-2.02), q(0.6), q(0.44), q(0.14)), BRONZE[0], BRONZE[1], q(0.06));
    sh(c, () => rr(c, q(-0.04), q(-2.12), q(0.08), q(0.12), q(0.02)), '#8a8e9a', '#6a6e7a', 0);
    if (front) { sh(c, () => rr(c, q(-0.22), q(-1.9), q(0.44), q(0.16), q(0.06)), '#1e2a3a', '#141c28', q(0.02)); for (const sd of [-1, 1]) { circ(c, sd * q(0.1), q(-1.82), q(0.045)); c.fillStyle = '#7fe0ff'; c.fill(); } glow(c, 0, q(-1.82), q(0.3), '127,224,255', 0.4); }
  }
  // a wraith: a hooded spectre, see-through, glowing eyes in the dark of its hood, a ghostly blade
  function wraithArt(c, k, o) {
    const q = v => v * k * 0.9, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0, drift = Math.sin(o.t * 3 + (o.id || 0)) * q(0.05);
    c.save(); c.globalAlpha *= 0.88; c.translate(0, drift);
    glow(c, 0, q(-0.5), q(0.6), '170,120,255', 0.35);
    const robe = () => { c.beginPath(); c.moveTo(q(-0.24), q(-0.9)); c.quadraticCurveTo(q(-0.34), q(-0.3), q(-0.28), q(0.02)); c.quadraticCurveTo(q(-0.2), q(-0.1), q(-0.12), q(-0.02)); c.quadraticCurveTo(q(-0.06), q(-0.12), 0, q(0.04)); c.quadraticCurveTo(q(0.06), q(-0.12), q(0.12), q(-0.02)); c.quadraticCurveTo(q(0.2), q(-0.1), q(0.28), q(0.02)); c.quadraticCurveTo(q(0.34), q(-0.3), q(0.24), q(-0.9)); c.closePath(); };
    sh(c, robe, '#5a4a7a', '#3e3058', q(0.05));
    c.save(); robe(); c.clip(); const g = c.createLinearGradient(0, q(-0.4), 0, q(0.05)); g.addColorStop(0, 'rgba(90,74,122,0)'); g.addColorStop(1, 'rgba(200,170,255,0.5)'); c.fillStyle = g; c.fillRect(-q(0.4), -q(0.4), q(0.8), q(0.5)); c.restore();
    sh(c, () => rr(c, q(-0.25), q(-0.52), q(0.5), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
    c.save(); c.translate(q(front ? 0.26 : -0.26), q(-0.56)); c.rotate((front ? -0.6 : 0.6) + (front ? 1 : -1) * sw * 1.6);
    glow(c, 0, -q(0.26), q(0.3), '200,170,255', 0.3);
    sh(c, () => poly(c, [q(-0.035), 0, q(0.035), 0, q(0.025), q(-0.48), 0, q(-0.56), q(-0.025), q(-0.48)]), '#e4d8ff', '#a88ae0', q(0.02));
    sh(c, () => rr(c, -q(0.09), -q(0.01), q(0.18), q(0.04), q(0.02)), '#8a7aa8', null, 0);
    c.restore();
    sh(c, () => { c.beginPath(); c.arc(0, q(-0.98), q(0.24), Math.PI * 0.85, Math.PI * 0.15); c.quadraticCurveTo(q(0.06), q(-1.24), 0, q(-1.36)); c.quadraticCurveTo(q(-0.06), q(-1.24), Math.cos(Math.PI * 0.85) * q(0.24), q(-0.98) + Math.sin(Math.PI * 0.85) * q(0.24)); c.closePath(); }, '#4a3a6a', '#32264a', q(0.04));
    if (front) {
      ell(c, 0, q(-0.94), q(0.16), q(0.14)); c.fillStyle = '#140e20'; c.fill();
      for (const sd of [-1, 1]) { ell(c, sd * q(0.065), q(-0.96), q(0.04), q(0.03), sd * -0.3); c.fillStyle = '#d9b8ff'; c.fill(); }
      glow(c, 0, q(-0.96), q(0.18), '217,184,255', 0.6);
    }
    c.restore();
  }

  /* ---------- buildings ---------- */
  const BUILD6 = {
    // Coil Tower: a copper coil on a carved stone base, a crackling orb on top; hidden, just a hatch
    coil(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], up = o.hidden ? 0 : Math.max(0, Math.min(1, 1 - (o.rise || 0) / 0.6)), at = o.atk || 0;
      ell(c, 0, q(0.4), q(0.95), q(0.36)); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
      sh(c, () => rr(c, q(-0.86), q(-0.12), q(1.72), q(0.62), q(0.18)), '#8a8590', '#5f5b66', q(0.1));
      for (const x of [-0.56, 0, 0.56]) sh(c, () => rr(c, q(x - 0.16), q(0.0), q(0.32), q(0.2), q(0.05)), '#9e99a6', '#75707e', q(0.02));
      sh(c, () => rr(c, q(-0.87), q(0.28), q(1.74), q(0.1), q(0.04)), T.main, T.sh, q(0.03));
      ell(c, 0, q(0.02), q(0.5), q(0.2)); c.fillStyle = '#2a2632'; c.fill();
      if (up <= 0) {
        for (const s of [-1, 1]) sh(c, () => { c.beginPath(); c.ellipse(0, q(0.02), q(0.5), q(0.2), 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5); c.closePath(); }, '#6a6572', '#4e4a56', q(0.02));
        line(c, 0, q(-0.18), 0, q(0.22), OUT, LW()); dot(c, 0, q(0.02), q(0.05), T.main); return;
      }
      c.save(); c.translate(0, (1 - up) * q(1.4));
      c.beginPath(); c.rect(-q(1), -q(3), q(2), q(3) + (1 - up) * -q(1.4) + q(0.1)); c.clip();
      sh(c, () => rr(c, q(-0.2), q(-1.3), q(0.4), q(1.35), q(0.1)), '#555a66', '#3a3e48', q(0.05));
      for (let i = 0; i < 6; i++) { line(c, q(-0.3), q(-1.18 + i * 0.2), q(0.3), q(-1.12 + i * 0.2), OUT, q(0.1)); line(c, q(-0.29), q(-1.18 + i * 0.2), q(0.29), q(-1.12 + i * 0.2), '#e0903a', q(0.06)); }
      for (const s of [-1, 1]) sh(c, () => poly(c, [s * q(0.2), q(-1.3), s * q(0.4), q(-1.42), s * q(0.2), q(-1.18)]), '#8a8e9a', '#6a6e7a', q(0.01));
      glow(c, 0, q(-1.52), q(0.5 + at * 0.4), '140,220,255', 0.4 + at * 0.5);
      sh(c, () => circ(c, 0, q(-1.52), q(0.25)), '#d8f8ff', '#6fd0f0', q(0.05));
      for (let i = 0; i < 3; i++) { const a = o.t * 7 + i * 2.1; line(c, Math.cos(a) * q(0.1), q(-1.52) + Math.sin(a) * q(0.1), Math.cos(a + 0.6) * q(0.2), q(-1.52) + Math.sin(a + 0.6) * q(0.2), '#ffffff', q(0.025)); }
      c.restore();
    },
    // Crystal Drill: a crystal drill bit on a mining frame with lanterns, spinning in a ring of rubble
    drill(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], spin = o.t * 8;
      ell(c, 0, q(0.38), q(0.9), q(0.32)); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      for (let i = 0; i < 9; i++) { const a = i * 0.7; sh(c, () => circ(c, Math.cos(a) * q(0.74), q(0.26) + Math.sin(a) * q(0.24), q(0.1 + (i % 3) * 0.02)), i % 2 ? '#7e6aa0' : '#5a4e76', '#3e3456', q(0.02)); }
      sh(c, () => rr(c, q(-0.72), q(-0.32), q(1.44), q(0.52), q(0.12)), '#6a5a48', '#4e4234', q(0.07));
      for (const x of [-0.5, 0.5]) dot(c, q(x), q(-0.06), q(0.04), '#c9cfda');
      sh(c, () => rr(c, q(-0.73), q(-0.08), q(1.46), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
      for (const s of [-1, 1]) { rope(c, () => { c.beginPath(); c.moveTo(s * q(0.52), q(-0.32)); c.lineTo(s * q(0.22), q(-1.36)); }, '#8a7a66', q(0.08)); sh(c, () => rr(c, s * q(0.52) - q(0.08), q(-0.86), q(0.16), q(0.2), q(0.04)), '#ffe27a', '#e0b030', q(0.02)); glow(c, s * q(0.52), q(-0.76), q(0.25), '255,230,140', 0.4); }
      sh(c, () => rr(c, q(-0.32), q(-1.44), q(0.64), q(0.14), q(0.04)), '#6a5a48', '#4e4234', q(0.03));
      c.save(); c.translate(0, q(-0.78));
      glow(c, 0, 0, q(0.65), '200,170,255', 0.4);
      sh(c, () => poly(c, [q(-0.36), q(-0.52), q(0.36), q(-0.52), 0, q(0.52)]), CRYSTAL[0], CRYSTAL[1], q(0.06));
      for (let i = 0; i < 4; i++) { const y = ((spin * 0.1 + i / 4) % 1) - 0.46; line(c, q(-0.32 * (0.5 - y)), q(y), q(0.32 * (0.5 - y)), q(y + 0.1), '#f3eaff', q(0.04)); }
      sparkle(c, q(-0.12), q(-0.28), q(0.07));
      c.restore();
    },
  };

  A.add(T6, BUILD6);
})();
