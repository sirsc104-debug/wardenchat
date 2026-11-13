/* Kingdom Clash: the second design of every character (this file: the starter deck and Arenas 1 to 4;
   js/art4.js: Arenas 5 to 10, buildings and spells). Chibi proportions, expressive faces (eyes with
   glints, brows that frown when fighting, a mouth that opens on a swing), layered outfits in the team's
   colours and detailed weapons. Each drawing keeps the size, footprint and options of the first design
   (o.walk, o.atk, o.view, and each card's own: power, ratk, charged, beam, evo...), so health bars,
   effects and the game's logic all still line up. Drawn at (0, 0) at the feet, k pixels to a tile. */
'use strict';

const KCArt3 = (() => {
  const A = KCArt, { OUT, TEAM, C, rr, circ, ell, line, paint, poly, sh, rope, dot } = A;
  const LW = () => A.lw();
  const W = (o, f) => (o.walk ? Math.sin(o.t * (f || 10)) : 0);
  const SKIN = ['#f7c6a0', '#e3a47e'], HAIR = ['#6b4426', '#4e3018'], STEEL = ['#dfe5ee', '#a7b0c0'], GOLD = [C.gold, C.goldSh];
  const LEATHER = ['#8a5a34', '#68401f'], WOOD = [C.wood, C.woodSh];
  // a glow (additive)
  function glow(c, x, y, r, rgb, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, `rgba(${rgb},${a == null ? 0.6 : a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
  }
  // Big expressive eyes: white, a coloured iris, a pupil, two glints; brows that frown when angry.
  function eyes(c, x, y, s, o, opt) {
    opt = opt || {};
    const gap = s * (opt.gap || 0.42), fierce = opt.fierce !== undefined ? opt.fierce : Math.min(1, (o.atk || 0) * 1.6);
    for (const sd of [-1, 1]) {
      const ex = x + sd * gap;
      ell(c, ex, y, s * 0.2, s * 0.25); paint(c, '#ffffff', LW() * 0.8);
      circ(c, ex + s * 0.03 * (opt.look || 0), y + s * 0.03, s * 0.14); c.fillStyle = opt.iris || '#5a3a24'; c.fill();
      circ(c, ex + s * 0.03 * (opt.look || 0), y + s * 0.04, s * 0.075); c.fillStyle = OUT; c.fill();
      circ(c, ex - s * 0.05, y - s * 0.06, s * 0.05); c.fillStyle = '#fff'; c.fill();
      circ(c, ex + s * 0.06, y + s * 0.09, s * 0.025); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill();
      if (opt.brows !== false) {
        const by = y - s * 0.36, tilt = fierce * 0.16;
        line(c, ex - s * 0.18, by - sd * s * tilt * 0 - s * tilt * (sd > 0 ? -1 : 1) * 0.5, ex + s * 0.18, by + s * tilt * (sd > 0 ? -1 : 1) * 0.5, opt.browCol || OUT, Math.max(1.2, s * 0.09));
      }
    }
  }
  // A mouth: a smile, a grin with teeth when attacking, or a little 'o'.
  function mouth(c, x, y, s, o, kind) {
    const open = kind === 'open' || (kind !== 'flat' && (o.atk || 0) > 0.25);
    if (open) {
      c.beginPath(); c.moveTo(x - s * 0.22, y - s * 0.04); c.quadraticCurveTo(x, y + s * 0.34, x + s * 0.22, y - s * 0.04); c.closePath(); paint(c, '#6b1a2a', LW() * 0.8);
      rr(c, x - s * 0.15, y - s * 0.04, s * 0.3, s * 0.07, s * 0.02); c.fillStyle = '#fff'; c.fill();
    } else if (kind === 'flat') line(c, x - s * 0.12, y, x + s * 0.12, y, OUT, Math.max(1, s * 0.07));
    else { c.beginPath(); c.arc(x, y - s * 0.06, s * 0.15, 0.35, Math.PI - 0.35); c.strokeStyle = OUT; c.lineWidth = Math.max(1, s * 0.07); c.lineCap = 'round'; c.stroke(); }
  }
  const blush = (c, x, y, s) => { for (const sd of [-1, 1]) { ell(c, x + sd * s * 0.62, y, s * 0.13, s * 0.07); c.fillStyle = 'rgba(255,120,130,0.45)'; c.fill(); } };
  // A round head (front: a face; back: hair or a helmet), radius r at (0, y).
  function head(c, q, y, r, o, opt) {
    opt = opt || {};
    const front = o.view === 'front', skin = opt.skin || SKIN;
    sh(c, () => circ(c, 0, q(y), q(r)), skin[0], skin[1], q(r * 0.18));
    if (front) {
      if (opt.ears) for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(r * 0.98), q(y + r * 0.05), q(r * 0.16), q(r * 0.22)), skin[0], skin[1], q(0.02));
      eyes(c, 0, q(y + r * 0.08), q(r), o, opt);
      if (opt.blush !== false) blush(c, 0, q(y + r * 0.42), q(r));
      if (opt.mouth !== false) mouth(c, 0, q(y + r * 0.55), q(r), o, opt.mood);
    }
    return front;
  }
  // Two short legs with boots, stepping while walking.
  function legs(c, q, o, sep, h, w, boot, pants) {
    const st = W(o) * q(0.06);
    for (const [x, ph] of [[-sep, 1], [sep, -1]]) {
      sh(c, () => rr(c, q(x - w / 2), -q(h) + st * ph, q(w), q(h * 0.7) - st * ph, q(w * 0.3)), (pants || LEATHER)[0], (pants || LEATHER)[1], q(0.03));
      sh(c, () => rr(c, q(x - w * 0.62), -q(h * 0.36), q(w * 1.24), q(h * 0.36), q(w * 0.35)), (boot || LEATHER)[0], (boot || LEATHER)[1], q(0.03));
    }
  }
  // A torso: a rounded tunic in the team colour with a trim and a belt.
  function torso(c, q, T, y0, y1, w, opt) {
    opt = opt || {};
    sh(c, () => poly(c, [q(-w * 0.82), q(y0), q(w * 0.82), q(y0), q(w), q(y1), q(-w), q(y1)]), opt.col || T.main, opt.sh || T.sh, q(0.06));
    if (opt.trim !== false) sh(c, () => rr(c, q(-w * 0.85), q(y0 - 0.02), q(w * 1.7), q(0.08), q(0.03)), (opt.trimCol || GOLD)[0], (opt.trimCol || GOLD)[1], q(0.02));
    if (opt.belt !== false) {
      sh(c, () => rr(c, q(-w * 1.02), q(y1 - 0.14), q(w * 2.04), q(0.1), q(0.03)), LEATHER[0], LEATHER[1], q(0.02));
      sh(c, () => rr(c, q(-0.06), q(y1 - 0.15), q(0.12), q(0.12), q(0.02)), GOLD[0], GOLD[1], q(0.02));
    }
  }
  // An arm as a thick outlined stroke ending in a hand.
  function arm(c, x0, y0, x1, y1, w, col, hand) {
    rope(c, () => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); }, col, w);
    if (hand !== false) sh(c, () => circ(c, x1, y1, w * 0.62), (hand || SKIN)[0], (hand || SKIN)[1], w * 0.12);
  }
  // A sword blade with a crossguard, pointing up from (0, 0) (rotate before calling).
  function sword(c, q, len, w) {
    sh(c, () => poly(c, [-q(w), 0, q(w), 0, q(w * 0.8), -q(len), 0, -q(len + w * 1.6), -q(w * 0.8), -q(len)]), STEEL[0], STEEL[1], q(0.03));
    line(c, 0, -q(0.04), 0, -q(len * 0.9), 'rgba(255,255,255,0.7)', Math.max(1, q(w * 0.35)));
    sh(c, () => rr(c, -q(w * 3), -q(0.02), q(w * 6), q(w * 1.3), q(w * 0.5)), GOLD[0], GOLD[1], q(0.02));
    sh(c, () => rr(c, -q(w * 0.7), q(0.02), q(w * 1.4), q(len * 0.22), q(w * 0.5)), LEATHER[0], LEATHER[1], q(0.02));
    dot(c, 0, q(len * 0.26), q(w * 0.9), C.gold);
  }

  const T3 = {
    /* ---------- the starter deck ---------- */
    // Rhino: an armored war rhino with a gold-tipped horn, team saddle cloth and plated brow
    rhino(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', st = W(o, 7), lunge = (o.atk || 0) * q(0.18) * (front ? 1 : -1);
      c.save(); c.translate(0, lunge);
      for (const [x, y, ph] of [[-0.55, 0.02, 1], [0.55, 0.02, -1], [-0.42, -0.12, -1], [0.42, -0.12, 1]]) sh(c, () => rr(c, q(x - 0.15), q(y - 0.36) + st * ph * q(0.05), q(0.3), q(0.38), q(0.1)), '#9a98a6', '#77758a', q(0.04));
      sh(c, () => ell(c, 0, q(-0.62), q(0.86), q(0.5)), '#b1afbd', '#8a889a', q(0.1));
      // armor plates and the saddle cloth
      sh(c, () => { c.beginPath(); c.ellipse(0, q(-0.74), q(0.7), q(0.34), 0, Math.PI, 0); c.closePath(); }, '#8f96a8', '#6d7486', q(0.05));
      for (const x of [-0.4, 0, 0.4]) dot(c, q(x), q(-0.88), q(0.04), '#d8dde8');
      sh(c, () => rr(c, q(-0.52), q(-0.7), q(1.04), q(0.26), q(0.08)), T.main, T.sh, q(0.04));
      sh(c, () => rr(c, q(-0.53), q(-0.48), q(1.06), q(0.06), q(0.03)), GOLD[0], GOLD[1], q(0.02));
      if (front) {
        // head toward you: plated brow, little eyes, two horns
        for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(0.4), q(-0.66), q(0.1), q(0.15), sd * 0.4), '#a9a7b6', '#86849a', q(0.02));
        sh(c, () => ell(c, 0, q(-0.4), q(0.42), q(0.36)), '#bdbbc8', '#94929f', q(0.06));
        sh(c, () => ell(c, 0, q(-0.22), q(0.3), q(0.17)), '#cfcdd8', '#a9a7b6', q(0.03));
        for (const sd of [-1, 1]) dot(c, sd * q(0.12), q(-0.2), q(0.035), '#55536a');
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.4), q(-0.6)); c.quadraticCurveTo(0, q(-0.82), q(0.4), q(-0.6)); c.lineTo(q(0.36), q(-0.5)); c.quadraticCurveTo(0, q(-0.64), q(-0.36), q(-0.5)); c.closePath(); }, '#8f96a8', '#6d7486', q(0.03));
        for (const sd of [-1, 1]) dot(c, sd * q(0.2), q(-0.6), q(0.03), '#d8dde8');
        eyes(c, 0, q(-0.44), q(0.2), o, { gap: 1.25, iris: '#2a1d18', fierce: 1 });
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.13), q(-0.3)); c.quadraticCurveTo(q(-0.06), q(-0.58), q(0.06), q(-0.86)); c.quadraticCurveTo(q(0.06), q(-0.56), q(0.13), q(-0.3)); c.closePath(); }, '#f4ead6', '#d6c8ac', q(0.04));
        sh(c, () => poly(c, [q(-0.02), q(-0.7), q(0.07), q(-0.7), q(0.06), q(-0.86)]), GOLD[0], GOLD[1], q(0.01));
      } else {
        sh(c, () => ell(c, 0, q(-1.02), q(0.3), q(0.2)), '#b1afbd', '#8a889a', q(0.04));
        sh(c, () => poly(c, [q(-0.08), q(-1.1), q(0.08), q(-1.1), 0, q(-1.42)]), '#f4ead6', '#d6c8ac', q(0.03));
        for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(0.26), q(-1.12), q(0.08), q(0.12)), '#a9a7b6', '#86849a', q(0.02));
      }
      c.restore();
    },
    // Wolves: lean grey wolves with a team collar, bright eyes and a snarl when they bite
    wolves(c, k, o) {
      const q = v => v * k * 0.95, T = TEAM[o.team], front = o.view === 'front', st = W(o, 14), bite = o.atk || 0;
      for (const [x, ph] of [[-0.2, 1], [0.2, -1], [-0.12, -1], [0.12, 1]]) sh(c, () => rr(c, q(x - 0.05), q(-0.3) + st * ph * q(0.05), q(0.1), q(0.3), q(0.04)), '#7d8292', '#5f6475', q(0.02));
      if (!front) sh(c, () => { c.beginPath(); c.moveTo(q(-0.06), q(-0.42)); c.quadraticCurveTo(q(0.02), q(0.05), q(0.18), q(0.02)); c.lineTo(q(0.06), q(-0.42)); c.closePath(); }, '#9aa0ae', '#787e8e', q(0.03));
      sh(c, () => ell(c, 0, q(-0.42), q(0.3), q(0.2)), '#9aa0ae', '#787e8e', q(0.05));
      sh(c, () => ell(c, 0, q(-0.36), q(0.16), q(0.1)), '#e8ecf2', '#c9cfda', q(0.02));
      c.save(); c.translate(0, front ? bite * q(0.05) : 0);
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.08), q(-0.9), sd * q(0.3), q(-1.16), sd * q(0.3), q(-0.82)]), '#8a90a0', '#6b7182', q(0.02));
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.16), q(-0.92), sd * q(0.26), q(-1.06), sd * q(0.26), q(-0.88)]), '#e0a0a8', '#c08088', 0);
      sh(c, () => circ(c, 0, q(-0.74), q(0.29)), '#9aa0ae', '#787e8e', q(0.04));
      if (front) for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.2), q(-0.7), sd * q(0.34), q(-0.6), sd * q(0.22), q(-0.58)]), '#9aa0ae', '#787e8e', 0);
      sh(c, () => rr(c, q(-0.2), q(-0.56), q(0.4), q(0.07), q(0.03)), T.main, T.sh, q(0.02));
      dot(c, 0, q(-0.49), q(0.035), C.gold);
      if (front) {
        sh(c, () => ell(c, 0, q(-0.62), q(0.15), q(0.11)), '#e8ecf2', '#c9cfda', q(0.02));
        dot(c, 0, q(-0.67), q(0.05));
        eyes(c, 0, q(-0.8), q(0.2), o, { gap: 0.62, iris: '#ffc52e', fierce: 0.7 + bite * 0.3, browCol: '#4e5262' });
        if (bite > 0.2) { poly(c, [q(-0.07), q(-0.6), q(0.07), q(-0.6), 0, q(-0.54)]); paint(c, '#6b1a2a', LW() * 0.6); }
      }
      c.restore();
    },
    // Gladiator: a bronze-helmed arena champion with a crested helm, round shield and short sword
    gladiator(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0;
      legs(c, q, o, 0.13, 0.36, 0.13, LEATHER, SKIN);
      const shield = sd => {
        c.save(); c.translate(sd * q(0.32), q(-0.66));
        sh(c, () => circ(c, 0, 0, q(0.3)), T.main, T.sh, q(0.06));
        circ(c, 0, 0, q(0.24)); c.lineWidth = q(0.05); c.strokeStyle = C.gold; c.stroke();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.5; dot(c, Math.cos(a) * q(0.2), Math.sin(a) * q(0.2), q(0.025), '#fff6c8'); }
        sh(c, () => circ(c, 0, 0, q(0.09)), GOLD[0], GOLD[1], q(0.02));
        c.restore();
      };
      const blade = (sd, rot) => { c.save(); c.translate(sd * q(0.34), q(-0.74)); c.rotate(rot); sword(c, q, 0.48, 0.045); c.restore(); };
      if (!front) shield(-1);
      // skirt of leather strips and a team sash
      for (const x of [-0.22, -0.11, 0, 0.11, 0.22]) sh(c, () => rr(c, q(x - 0.055), q(-0.44), q(0.11), q(0.2), q(0.03)), LEATHER[0], LEATHER[1], q(0.02));
      torso(c, q, T, -0.9, -0.42, 0.3, { col: SKIN[0], sh: SKIN[1], trim: false });
      sh(c, () => poly(c, [q(-0.3), q(-0.9), q(-0.18), q(-0.9), q(0.3), q(-0.46), q(0.18), q(-0.44)]), T.main, T.sh, q(0.03));
      sh(c, () => ell(c, q(-0.3), q(-0.88), q(0.16), q(0.1)), '#c9933f', '#a06e22', q(0.03));
      if (front) blade(-1, -0.45 + sw * 1.8); else blade(1, 0.45 - sw * 1.8);
      head(c, q, -1.18, 0.3, o, { iris: '#3a6a9a' });
      // the helmet: bronze bowl, cheek guards, a tall team crest
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.22), q(0.33), Math.PI, 0); c.lineTo(q(0.33), q(-1.16)); c.lineTo(q(-0.33), q(-1.16)); c.closePath(); }, C.bronze, C.bronzeSh, q(0.05));
      if (front) for (const sd of [-1, 1]) sh(c, () => rr(c, sd > 0 ? q(0.21) : q(-0.34), q(-1.2), q(0.13), q(0.28), q(0.05)), C.bronze, C.bronzeSh, q(0.03));
      else sh(c, () => circ(c, 0, q(-1.18), q(0.31)), C.bronze, C.bronzeSh, q(0.06));
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.06), q(-1.5)); c.quadraticCurveTo(q(0.02), q(-1.95), q(0.28), q(-1.72)); c.quadraticCurveTo(q(0.12), q(-1.62), q(0.08), q(-1.48)); c.closePath(); }, T.main, T.sh, q(0.03));
      if (front) shield(1);
    },
    // Hawks: two fierce hawks with team-tipped wings, a hooked beak and talons
    hawks(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 13 + (o.id || 0)), front = o.view === 'front', dive = (o.atk || 0) * q(0.25) * (front ? 1 : -1);
      c.save(); c.translate(0, dive);
      for (const sd of [-1, 1]) {
        c.save(); c.scale(sd, 1); c.translate(q(0.14), q(-0.08)); c.rotate(-0.15 - flap * 0.45);
        const wing = () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.32), q(-0.48), q(0.78), q(-0.38)); c.lineTo(q(0.7), q(-0.24)); c.lineTo(q(0.76), q(-0.13)); c.lineTo(q(0.58), q(-0.07)); c.lineTo(q(0.6), q(0.05)); c.lineTo(q(0.4), q(0.05)); c.quadraticCurveTo(q(0.16), q(0.14), 0, q(0.13)); c.closePath(); };
        sh(c, wing, '#a06a3c', '#7a4a26', q(0.06));
        c.save(); wing(); c.clip(); poly(c, [q(0.5), q(-0.6), q(1), q(-0.6), q(1), q(0.2), q(0.5), q(0.2)]); c.fillStyle = T.main; c.fill();
        for (const x of [0.26, 0.4]) line(c, q(x), q(-0.3), q(x + 0.1), q(0.05), 'rgba(60,30,10,0.45)', LW() * 0.6);
        c.restore(); wing(); c.lineWidth = LW(); c.strokeStyle = OUT; c.stroke();
        c.restore();
      }
      if (!front) sh(c, () => poly(c, [q(-0.13), q(0.2), q(0.13), q(0.2), q(0.22), q(0.5), 0, q(0.43), q(-0.22), q(0.5)]), '#8a5a34', '#6c4222', q(0.04));
      sh(c, () => ell(c, 0, q(0.03), q(0.24), q(0.31)), '#a26e42', '#7d4f2b', q(0.06));
      if (front) {
        sh(c, () => ell(c, 0, q(0.1), q(0.15), q(0.19)), '#f1e2c4', '#d4bf96', q(0.04));
        for (const y of [0.04, 0.12]) line(c, q(-0.06), q(y), q(0.06), q(y + 0.02), '#c9a878', LW() * 0.6);
        for (const sd of [-1, 1]) { line(c, sd * q(0.08), q(0.3), sd * q(0.1), q(0.43), '#f2b824', q(0.06)); }
      }
      sh(c, () => circ(c, 0, q(-0.3), q(0.21)), '#f5f2ea', '#d6d2c8', q(0.04));
      if (front) {
        eyes(c, 0, q(-0.33), q(0.15), o, { gap: 0.6, iris: '#f2a51c', fierce: 1, brows: true, browCol: '#3a2a20' });
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.07), q(-0.27)); c.lineTo(q(0.07), q(-0.27)); c.quadraticCurveTo(q(0.04), q(-0.1), 0, q(-0.1)); c.closePath(); }, '#ffc52e', '#e09f12', q(0.03));
      }
      c.restore();
    },
    // Archers: hooded archers with a team cloak, a longbow and a quiver of fletched arrows
    archers(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', draw = o.atk || 0;
      // the recurve bow turns to aim at what it shoots (o.aim), held out ahead with nothing to shoot
      const ang = o.aim === undefined ? A.restAim(front) : o.aim, behind = A.bowBehind(ang);
      const bow = () => { c.save(); c.translate(0, q(-0.74)); A.aimedBow(c, k, ang, draw, { sleeve: '#5d7a4a', skin: SKIN[0], fletch: T.main }); c.restore(); };
      legs(c, q, o, 0.1, 0.32, 0.12, LEATHER, ['#4a5a3a', '#36432a']);
      if (front) { sh(c, () => rr(c, q(-0.32), q(-0.98), q(0.18), q(0.46), q(0.06)), LEATHER[0], LEATHER[1], q(0.03)); for (const x of [-0.29, -0.24, -0.19]) line(c, q(x), q(-0.98), q(x), q(-1.08), '#dc3640', q(0.05)); }
      else { sh(c, () => rr(c, q(0.06), q(-1.02), q(0.18), q(0.46), q(0.06)), LEATHER[0], LEATHER[1], q(0.03)); for (const x of [0.1, 0.15, 0.2]) line(c, q(x), q(-1.02), q(x), q(-1.12), '#f1ead8', q(0.05)); }
      if (behind) bow();
      sh(c, () => poly(c, [q(-0.34), q(-0.3), q(0.34), q(-0.3), q(0.26), q(-0.92), q(-0.26), q(-0.92)]), T.main, T.sh, q(0.06));
      torso(c, q, T, -0.86, -0.34, 0.24, { col: '#5d7a4a', sh: '#465d38', trim: false });
      if (!behind) bow();
      head(c, q, -1.12, 0.28, o, { iris: '#3a7a3a' });
      // the hood
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.15), q(0.33), Math.PI * 1.0, 0); c.lineTo(q(0.3), q(-1.0)); c.quadraticCurveTo(q(0.16), q(-1.32), 0, q(-1.32)); c.quadraticCurveTo(q(-0.16), q(-1.32), q(-0.3), q(-1.0)); c.closePath(); }, T.main, T.sh, q(0.05));
      if (!front) sh(c, () => circ(c, 0, q(-1.12), q(0.3)), T.main, T.sh, q(0.05));
      sh(c, () => poly(c, [q(-0.08), q(-1.46), q(0.08), q(-1.46), 0, q(-1.6)]), T.main, T.sh, q(0.02));
    },
    // Snowman: a jolly snowman in a top hat with a team scarf, coal smile and carrot nose
    snowman(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', th = o.atk || 0;
      sh(c, () => circ(c, 0, q(-0.36), q(0.38)), '#ffffff', '#d6e2f0', q(0.08));
      sh(c, () => circ(c, 0, q(-0.94), q(0.3)), '#ffffff', '#d6e2f0', q(0.07));
      if (front) for (const y of [-0.5, -0.32]) dot(c, 0, q(y), q(0.045), '#3a3a46');
      // stick arms, one winding up a snowball
      for (const sd of [-1, 1]) {
        const up = sd > 0 ? th : 0;
        line(c, sd * q(0.26), q(-0.98), sd * q(0.62), q(-1.16 - up * 0.3), '#6b4426', q(0.06));
        line(c, sd * q(0.5), q(-1.1 - up * 0.25), sd * q(0.6), q(-0.98 - up * 0.25), '#6b4426', q(0.04));
      }
      if (th > 0.1) sh(c, () => circ(c, q(0.66), q(-1.22 - th * 0.3), q(0.13)), '#ffffff', '#d6e2f0', q(0.03));
      sh(c, () => circ(c, 0, q(-1.42), q(0.25)), '#ffffff', '#d6e2f0', q(0.05));
      if (front) {
        for (const sd of [-1, 1]) dot(c, sd * q(0.09), q(-1.48), q(0.05), '#2a2a33'), dot(c, sd * q(0.09) - q(0.017), q(-1.497), q(0.018), '#fff');
        for (const sd of [-1, 1]) line(c, sd * q(0.04), q(-1.57 + (o.atk || 0) * 0.02), sd * q(0.14), q(-1.57 - (o.atk || 0) * 0.02), '#2a2a33', q(0.03));
        sh(c, () => poly(c, [-q(0.02), q(-1.44), -q(0.02), q(-1.36), q(0.24), q(-1.39)]), '#ff8a2a', '#e0661a', q(0.02));
        for (let i = 0; i < 5; i++) { const a = 0.5 + i * 0.53; dot(c, Math.cos(a) * q(0.12), q(-1.38) + Math.sin(a) * q(0.06) + q(0.02), q(0.02), '#3a3a46'); }
        blush(c, 0, q(-1.36), q(0.2));
      }
      // scarf
      sh(c, () => rr(c, q(-0.27), q(-1.24), q(0.54), q(0.12), q(0.05)), T.main, T.sh, q(0.03));
      sh(c, () => rr(c, q(0.08), q(-1.18), q(0.12), q(0.34), q(0.04)), T.main, T.sh, q(0.03));
      for (const y of [-1.06, -0.96]) line(c, q(0.08), q(y), q(0.2), q(y), T.light, LW() * 0.6);
      // top hat
      sh(c, () => rr(c, q(-0.28), q(-1.66), q(0.56), q(0.08), q(0.03)), '#2a2836', '#1a1924', q(0.02));
      sh(c, () => rr(c, q(-0.17), q(-1.98), q(0.34), q(0.34), q(0.04)), '#2a2836', '#1a1924', q(0.04));
      sh(c, () => rr(c, q(-0.17), q(-1.73), q(0.34), q(0.06), q(0.02)), T.main, T.sh, q(0.01));
    },
    // Gorilla: a silverback with huge fists, a silver back, a team arm band and a fierce face
    gorilla(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', st = W(o, 8), sm = o.atk || 0;
      for (const [x, ph] of [[-0.22, 1], [0.22, -1]]) sh(c, () => rr(c, q(x - 0.13), q(-0.36) + st * ph * q(0.05), q(0.26), q(0.36), q(0.1)), '#3e3a48', '#2a2732', q(0.04));
      for (const sd of [-1, 1]) {
        const lift = sm * (sd > 0 ? 1 : 0.6);
        rope(c, () => { c.beginPath(); c.moveTo(sd * q(0.42), q(-1.12)); c.quadraticCurveTo(sd * q(0.78), q(-0.8 - lift * 0.4), sd * q(0.62), q(-0.32 - lift * 0.6)); }, '#4a4656', q(0.22));
        sh(c, () => circ(c, sd * q(0.62), q(-0.26 - lift * 0.6), q(0.18)), '#4a4656', '#33303c', q(0.04));
        sh(c, () => rr(c, sd * q(0.62) - q(0.15), q(-0.98 + 0.0), q(0.3), q(0.09), q(0.03)), T.main, T.sh, q(0.02));
      }
      sh(c, () => ell(c, 0, q(-0.86), q(0.5), q(0.52)), '#4a4656', '#33303c', q(0.1));
      if (!front) sh(c, () => ell(c, 0, q(-0.96), q(0.32), q(0.34)), '#a7a4b4', '#85829a', q(0.05));
      else sh(c, () => ell(c, 0, q(-0.74), q(0.3), q(0.3)), '#6e6a7c', '#56526a', q(0.05));
      sh(c, () => circ(c, 0, q(-1.36), q(0.32)), '#4a4656', '#33303c', q(0.05));
      if (front) {
        sh(c, () => ell(c, 0, q(-1.3), q(0.25), q(0.21)), '#8a7068', '#6e564e', q(0.03));
        eyes(c, 0, q(-1.42), q(0.22), o, { gap: 0.55, iris: '#c97a2a', fierce: 1, brows: false });
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.28), q(-1.48)); c.quadraticCurveTo(0, q(-1.6), q(0.28), q(-1.48)); c.lineTo(q(0.26), q(-1.53)); c.quadraticCurveTo(0, q(-1.68), q(-0.26), q(-1.53)); c.closePath(); }, '#3a3644', '#2a2732', q(0.01));
        for (const sd of [-1, 1]) dot(c, sd * q(0.05), q(-1.3), q(0.03));
        mouth(c, 0, q(-1.2), q(0.22), o, sm > 0.2 ? 'open' : 'flat');
      }
    },
    // Skeletons: rattling skeletons with a team bandana, glowing eye sockets and a bone club
    skeletons(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], st = W(o, 14) * q(0.05), front = o.view === 'front', sw = o.atk || 0;
      const bone = ['#f5f1e6', '#cfc8b6'];
      for (const [x, ph] of [[-0.09, 1], [0.09, -1]]) rope(c, () => { c.beginPath(); c.moveTo(q(x * 0.7), q(-0.3)); c.lineTo(q(x), -st * ph); }, bone[0], q(0.06));
      sh(c, () => ell(c, 0, q(-0.3), q(0.12), q(0.06)), bone[0], bone[1], q(0.02));
      rope(c, () => { c.beginPath(); c.moveTo(0, q(-0.3)); c.lineTo(0, q(-0.5)); }, bone[0], q(0.05));
      sh(c, () => rr(c, q(-0.15), q(-0.64), q(0.3), q(0.22), q(0.08)), bone[0], bone[1], q(0.03));
      for (const y of [-0.58, -0.51]) line(c, q(-0.11), q(y), q(0.11), q(y), bone[1], LW() * 0.8);
      rope(c, () => { c.beginPath(); c.moveTo(q(-0.14), q(-0.6)); c.lineTo(q(-0.26), q(-0.42)); }, bone[0], q(0.05));
      rope(c, () => { c.beginPath(); c.moveTo(q(0.14), q(-0.6)); c.lineTo(q(0.27), q(-0.44 - sw * 0.3)); }, bone[0], q(0.05));
      c.save(); c.translate(q(0.27), q(-0.44 - sw * 0.3)); c.rotate(-0.6 + sw * 1.5);
      sh(c, () => rr(c, q(-0.035), q(-0.3), q(0.07), q(0.3), q(0.03)), bone[0], bone[1], q(0.02));
      for (const sd of [-1, 1]) sh(c, () => circ(c, sd * q(0.04), q(-0.32), q(0.045)), bone[0], bone[1], q(0.01));
      c.restore();
      sh(c, () => circ(c, 0, q(-0.88), q(0.24)), bone[0], bone[1], q(0.05));
      sh(c, () => rr(c, q(-0.25), q(-1.1), q(0.5), q(0.1), q(0.04)), T.main, T.sh, q(0.02));
      if (front) {
        sh(c, () => rr(c, q(-0.13), q(-0.76), q(0.26), q(0.11), q(0.04)), bone[0], bone[1], q(0.02));
        for (const x of [-0.06, 0, 0.06]) line(c, q(x), q(-0.76), q(x), q(-0.66), bone[1], LW() * 0.6);
        for (const sd of [-1, 1]) { ell(c, sd * q(0.09), q(-0.9), q(0.07), q(0.075)); c.fillStyle = '#231a30'; c.fill(); circ(c, sd * q(0.09), q(-0.9), q(0.03)); c.fillStyle = '#7ff0ff'; c.fill(); glow(c, sd * q(0.09), q(-0.9), q(0.12), '127,240,255', 0.5); }
        poly(c, [q(-0.025), q(-0.8), q(0.025), q(-0.8), 0, q(-0.84)]); c.fillStyle = '#231a30'; c.fill();
      } else sh(c, () => poly(c, [q(0.18), q(-1.06), q(0.34), q(-0.96), q(0.24), q(-0.9)]), T.main, T.sh, q(0.02));
    },
    // Footmen: soldiers in kettle helms and mail with a team tabard, a buckler and a short sword
    footmen(c, k, o) {
      const q = v => v * k * 0.9, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0;
      legs(c, q, o, 0.12, 0.34, 0.13, LEATHER, ['#8a8e9a', '#6a6e7a']);
      torso(c, q, T, -0.9, -0.36, 0.3, { col: '#a7adbb', sh: '#868c9c', trim: false, belt: true });
      sh(c, () => poly(c, [q(-0.18), q(-0.9), q(0.18), q(-0.9), q(0.2), q(-0.36), q(-0.2), q(-0.36)]), T.main, T.sh, q(0.04));
      sh(c, () => poly(c, [0, q(-0.78), q(0.08), q(-0.68), 0, q(-0.58), q(-0.08), q(-0.68)]), GOLD[0], GOLD[1], q(0.02));
      c.save(); c.translate(q(front ? 0.34 : -0.34), q(-0.72)); c.rotate((front ? -0.4 : 0.4) + (front ? 1 : -1) * sw * 1.6); sword(c, q, 0.42, 0.045); c.restore();
      c.save(); c.translate(q(front ? -0.34 : 0.34), q(-0.62));
      sh(c, () => circ(c, 0, 0, q(0.2)), '#8a8e9a', '#6a6e7a', q(0.04)); sh(c, () => circ(c, 0, 0, q(0.1)), T.main, T.sh, q(0.02)); dot(c, 0, 0, q(0.03), C.gold);
      c.restore();
      head(c, q, -1.14, 0.28, o, { iris: '#4a6a8a' });
      // the kettle helm with its wide brim
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.2), q(0.29), Math.PI, 0); c.closePath(); }, STEEL[0], STEEL[1], q(0.05));
      sh(c, () => ell(c, 0, q(-1.2), q(0.42), q(0.09)), STEEL[0], STEEL[1], q(0.03));
      dot(c, 0, q(-1.46), q(0.04), T.main);
    },
    // Flail Knight: a burly knight in plate with a horned helm, swinging a spiked ball on a chain
    flail(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0, spin = o.t * 6 + sw * 5;
      legs(c, q, o, 0.16, 0.38, 0.16, ['#6a6e7a', '#4e525e'], STEEL);
      torso(c, q, T, -1.06, -0.4, 0.38, { col: STEEL[0], sh: STEEL[1], trim: false });
      sh(c, () => poly(c, [q(-0.22), q(-1.04), q(0.22), q(-1.04), q(0.25), q(-0.42), q(-0.25), q(-0.42)]), T.main, T.sh, q(0.04));
      for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(0.4), q(-0.98), q(0.17), q(0.12)), STEEL[0], STEEL[1], q(0.03));
      // the flail: a handle, a chain swinging round, a spiked ball
      const hx = q(front ? 0.44 : -0.44), hy = q(-0.82), bx = hx + Math.cos(spin) * q(0.62), by = hy - q(0.35) + Math.sin(spin) * q(0.26);
      sh(c, () => rr(c, hx - q(0.04), hy - q(0.2), q(0.08), q(0.26), q(0.03)), LEATHER[0], LEATHER[1], q(0.02));
      for (let i = 1; i < 5; i++) { const f = i / 5; circ(c, hx + (bx - hx) * f, hy - q(0.18) + (by - hy + q(0.18)) * f, q(0.035)); paint(c, '#8a8e9a', LW() * 0.5); }
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + spin; poly(c, [bx + Math.cos(a) * q(0.12), by + Math.sin(a) * q(0.12), bx + Math.cos(a + 0.25) * q(0.24), by + Math.sin(a + 0.25) * q(0.24), bx + Math.cos(a + 0.5) * q(0.12), by + Math.sin(a + 0.5) * q(0.12)]); paint(c, '#c9cfda', LW() * 0.6); }
      sh(c, () => circ(c, bx, by, q(0.15)), '#6a6e7a', '#4e525e', q(0.03));
      head(c, q, -1.36, 0.3, o, { iris: '#7a4a2a' });
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.46), q(0.33), Math.PI, 0); c.lineTo(q(0.33), q(-1.43)); c.lineTo(q(-0.33), q(-1.43)); c.closePath(); }, STEEL[0], STEEL[1], q(0.05));
      if (front) { sh(c, () => rr(c, q(-0.045), q(-1.46), q(0.09), q(0.2), q(0.03)), STEEL[0], STEEL[1], q(0.01)); }
      if (!front) sh(c, () => circ(c, 0, q(-1.36), q(0.31)), STEEL[0], STEEL[1], q(0.05));
      for (const sd of [-1, 1]) sh(c, () => { c.beginPath(); c.moveTo(sd * q(0.26), q(-1.56)); c.quadraticCurveTo(sd * q(0.5), q(-1.64), sd * q(0.5), q(-1.92)); c.quadraticCurveTo(sd * q(0.36), q(-1.7), sd * q(0.16), q(-1.66)); c.closePath(); }, '#f4ead6', '#d6c8ac', q(0.03));
    },
    // Pot Thrower: a round-bellied potter with a team apron and a clay pot held high
    pots(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', th = o.atk || 0;
      legs(c, q, o, 0.12, 0.3, 0.13);
      sh(c, () => ell(c, 0, q(-0.6), q(0.34), q(0.32)), '#e8d8b8', '#c9b48e', q(0.07));
      sh(c, () => poly(c, [q(-0.22), q(-0.8), q(0.22), q(-0.8), q(0.28), q(-0.34), q(-0.28), q(-0.34)]), T.main, T.sh, q(0.04));
      sh(c, () => rr(c, q(-0.12), q(-0.6), q(0.24), q(0.12), q(0.04)), T.light, T.main, q(0.02));
      // the pot, raised to throw
      c.save(); c.translate(q(0.3), q(-1.0 - th * 0.35));
      arm(c, -q(0.12), q(0.24 + th * 0.35), 0, q(0.08), q(0.1), '#e8d8b8');
      sh(c, () => { c.beginPath(); c.moveTo(-q(0.1), -q(0.12)); c.quadraticCurveTo(-q(0.24), q(0.05), -q(0.12), q(0.2)); c.lineTo(q(0.12), q(0.2)); c.quadraticCurveTo(q(0.24), q(0.05), q(0.1), -q(0.12)); c.closePath(); }, '#d07a45', '#a85a2c', q(0.04));
      line(c, -q(0.15), q(0.04), q(0.15), q(0.04), '#f0c08a', LW() * 0.7);
      c.restore();
      head(c, q, -1.12, 0.28, o, { iris: '#6a4a2a' });
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.22), q(0.3), Math.PI, 0); c.closePath(); }, T.main, T.sh, q(0.04));
      sh(c, () => rr(c, q(-0.31), q(-1.25), q(0.62), q(0.07), q(0.03)), T.light, T.main, q(0.01));
      sh(c, () => circ(c, 0, q(-1.52), q(0.07)), T.light, T.main, q(0.02));
    },

    /* ---------- Arena 3: Sunstone ---------- */
    // a Cart Soldier: a sandy-armored soldier with a team turban and a curved sword
    ramsoldier(c, k, o) {
      const q = v => v * k * 0.9, T = TEAM[o.team], front = o.view === 'front', sw = o.atk || 0;
      legs(c, q, o, 0.11, 0.32, 0.13, LEATHER, ['#d8c08a', '#b89c62']);
      torso(c, q, T, -0.86, -0.36, 0.28, { col: '#e8d2a0', sh: '#c9b07a' });
      sh(c, () => poly(c, [q(-0.28), q(-0.86), q(0.1), q(-0.86), q(0.28), q(-0.4), q(0.06), q(-0.4)]), T.main, T.sh, q(0.03));
      c.save(); c.translate(q(front ? 0.32 : -0.32), q(-0.7)); c.rotate((front ? -0.5 : 0.5) + (front ? 1 : -1) * sw * 1.6);
      sh(c, () => { c.beginPath(); c.moveTo(-q(0.035), 0); c.quadraticCurveTo(q(0.16), -q(0.28), q(0.04), -q(0.56)); c.lineTo(q(0.035), 0); c.closePath(); }, STEEL[0], STEEL[1], q(0.03));
      sh(c, () => rr(c, -q(0.11), -q(0.02), q(0.22), q(0.05), q(0.02)), GOLD[0], GOLD[1], q(0.01));
      c.restore();
      head(c, q, -1.1, 0.27, o, { skin: ['#e0a982', '#c4885e'], iris: '#3a2a1a' });
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.2), q(0.3), Math.PI, 0); c.quadraticCurveTo(0, q(-1.26), q(-0.3), q(-1.2)); c.closePath(); }, T.main, T.sh, q(0.04));
      for (const y of [-1.3, -1.39]) line(c, q(-0.24), q(y + 0.03), q(0.24), q(y - 0.03), T.sh, LW() * 0.6);
      if (!front) sh(c, () => circ(c, 0, q(-1.12), q(0.28)), T.main, T.sh, q(0.04));
      dot(c, 0, q(-1.36), q(0.05), C.gold);
    },
    // Ram Cart: a heavy cart with a golden ram's head, iron-banded wheels and two soldiers pushing
    ramcart(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', pw = o.power || 0, roll = o.t * (2 + pw * 8);
      // the two soldiers behind it
      const back = front ? -1 : 1;
      if (front) for (const sd of [-1, 1]) { c.save(); c.translate(sd * q(0.36), q(-0.72)); c.scale(0.7, 0.7); T3.ramsoldier(c, k, Object.assign({}, o, { atk: 0, walk: true })); c.restore(); }
      for (const sd of [-1, 1]) {
        sh(c, () => circ(c, sd * q(0.58), q(-0.24), q(0.24)), WOOD[0], WOOD[1], q(0.05));
        circ(c, sd * q(0.58), q(-0.24), q(0.24)); c.lineWidth = q(0.05); c.strokeStyle = '#5a5f6a'; c.stroke();
        for (let i = 0; i < 3; i++) { const a = roll + i * 1.05; line(c, sd * q(0.58) - Math.cos(a) * q(0.18), q(-0.24) - Math.sin(a) * q(0.18), sd * q(0.58) + Math.cos(a) * q(0.18), q(-0.24) + Math.sin(a) * q(0.18), WOOD[1], LW() * 0.8); }
        dot(c, sd * q(0.58), q(-0.24), q(0.05), C.gold);
      }
      sh(c, () => rr(c, q(-0.6), q(-0.72), q(1.2), q(0.44), q(0.08)), WOOD[0], WOOD[1], q(0.06));
      for (const x of [-0.3, 0, 0.3]) line(c, q(x), q(-0.72), q(x), q(-0.28), WOOD[1], LW() * 0.7);
      sh(c, () => rr(c, q(-0.62), q(-0.48), q(1.24), q(0.08), q(0.03)), T.main, T.sh, q(0.02));
      // the battering log and its golden ram's head
      const hy = front ? -0.7 : -1.06;
      sh(c, () => rr(c, q(-0.16), q(-1.02), q(0.32), q(0.5), q(0.08)), '#9a6a3c', '#734a26', q(0.04));
      sh(c, () => circ(c, 0, q(hy), q(0.24)), GOLD[0], GOLD[1], q(0.05));
      for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * q(0.25), q(hy - 0.02), q(0.13), sd > 0 ? Math.PI * 1.1 : -Math.PI * 0.1, sd > 0 ? Math.PI * 2.7 : Math.PI * 1.5, sd < 0); c.lineCap = 'round'; c.lineWidth = q(0.13); c.strokeStyle = OUT; c.stroke(); c.lineWidth = q(0.08); c.strokeStyle = '#e6b23a'; c.stroke(); }
      if (front) sh(c, () => ell(c, 0, q(hy + 0.14), q(0.13), q(0.08)), '#f4d27a', '#d8ae4a', q(0.02));
      if (front) eyes(c, 0, q(hy - 0.02), q(0.14), o, { gap: 0.65, iris: '#dc3640', fierce: 1, brows: false });
      if (!front) for (const sd of [-1, 1]) { c.save(); c.translate(sd * q(0.42), q(0.12)); c.scale(0.78, 0.78); T3.ramsoldier(c, k, Object.assign({}, o, { atk: 0, walk: true })); c.restore(); }
      if (pw > 0.5) for (let i = 0; i < 3; i++) line(c, q(-0.7 - i * 0.12), q(-0.4 + i * 0.12), q(-0.95 - i * 0.12), q(-0.4 + i * 0.12), 'rgba(255,255,255,0.6)', LW() * 0.8);
    },
    // Mole: a stout mole in a miner's helmet with a lamp, big claws and a team neckerchief
    mole(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', dig = o.atk || 0;
      legs(c, q, o, 0.14, 0.24, 0.15, ['#5a4a42', '#443630'], ['#7a6258', '#5e4a42']);
      sh(c, () => ell(c, 0, q(-0.62), q(0.38), q(0.42)), '#7a6258', '#5e4a42', q(0.08));
      if (front) sh(c, () => ell(c, 0, q(-0.56), q(0.22), q(0.26)), '#b09080', '#94766a', q(0.04));
      for (const sd of [-1, 1]) {
        c.save(); c.translate(sd * q(0.38), q(-0.7)); c.rotate(sd * (0.6 + (sd > 0 ? dig * 0.8 : 0)));
        sh(c, () => ell(c, 0, 0, q(0.13), q(0.16)), '#f0c4b8', '#d4a498', q(0.03));
        for (const x of [-0.07, 0, 0.07]) sh(c, () => poly(c, [q(x - 0.03), q(0.1), q(x + 0.03), q(0.1), q(x), q(0.24)]), '#f4ead6', '#d6c8ac', q(0.01));
        c.restore();
      }
      sh(c, () => rr(c, q(-0.24), q(-0.98), q(0.48), q(0.09), q(0.04)), T.main, T.sh, q(0.02));
      sh(c, () => circ(c, 0, q(-1.16), q(0.26)), '#7a6258', '#5e4a42', q(0.05));
      if (front) {
        sh(c, () => ell(c, 0, q(-1.06), q(0.11), q(0.08)), '#ff9aa8', '#e07a8a', q(0.02));
        for (const sd of [-1, 1]) for (const a of [-0.2, 0.1]) line(c, sd * q(0.1), q(-1.06 + a * 0.2), sd * q(0.28), q(-1.08 + a), 'rgba(40,30,30,0.6)', LW() * 0.5);
        for (const sd of [-1, 1]) { circ(c, sd * q(0.1), q(-1.2), q(0.04)); c.fillStyle = OUT; c.fill(); circ(c, sd * q(0.1) - q(0.012), q(-1.215), q(0.014)); c.fillStyle = '#fff'; c.fill(); }
      }
      // the miner's helmet and lamp
      sh(c, () => { c.beginPath(); c.arc(0, q(-1.22), q(0.28), Math.PI, 0); c.closePath(); }, '#ffcd33', '#e09f12', q(0.04));
      sh(c, () => ell(c, 0, q(-1.22), q(0.34), q(0.06)), '#ffcd33', '#e09f12', q(0.02));
      if (front) { sh(c, () => circ(c, 0, q(-1.36), q(0.07)), '#fff6c8', '#ffe27a', q(0.02)); glow(c, 0, q(-1.36), q(0.25), '255,240,170', 0.5); }
    },
    // Camel Jockey: a desert camel with a tasselled team saddle, its rider swinging a lasso overhead
    camel(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', st = W(o, 9), ra = o.ratk || 0, ch = o.charged;
      const fur = ['#dcae6e', '#b8884a'], furD = ['#c4945a', '#a07440'];
      if (ch) glow(c, 0, q(-1.0), q(1.0), '255,220,140', 0.35);
      // the neck and head behind (seen from behind, it walks away from you)
      const neckHead = (hx, hy) => {
        rope(c, () => { c.beginPath(); c.moveTo(q(0.12), q(-1.0)); c.quadraticCurveTo(q(hx * 0.9), q(-1.0), q(hx), q(hy + 0.12)); }, fur[0], q(0.22));
        sh(c, () => ell(c, q(hx), q(hy), q(0.2), q(0.16)), fur[0], fur[1], q(0.04));
        for (const sd of [-1, 1]) sh(c, () => ell(c, q(hx + sd * 0.14), q(hy - 0.14), q(0.05), q(0.08)), furD[0], furD[1], q(0.01));
      };
      if (!front) neckHead(0.46, -1.62);
      // four long legs with knobbly knees and wide feet
      for (const [x, ph, back] of [[-0.3, 1, 1], [0.3, -1, 1], [-0.24, -1, 0], [0.24, 1, 0]]) {
        const lift = st * ph * q(0.07), col = back ? furD : fur;
        sh(c, () => rr(c, q(x - 0.07), q(-0.86) + lift, q(0.14), q(0.82) - lift, q(0.06)), col[0], col[1], q(0.03));
        sh(c, () => ell(c, q(x), q(-0.44) + lift * 0.5, q(0.09), q(0.07)), col[0], col[1], q(0.02));
        sh(c, () => ell(c, q(x), q(-0.04), q(0.12), q(0.05)), '#8a6a4a', '#6a4e34', q(0.02));
      }
      // the body and hump
      sh(c, () => ell(c, 0, q(-0.98), q(0.52), q(0.3)), fur[0], fur[1], q(0.08));
      sh(c, () => ell(c, 0, q(-1.2), q(0.3), q(0.2)), fur[0], fur[1], q(0.05));
      // the saddle cloth with gold trim and tassels
      sh(c, () => { c.beginPath(); c.moveTo(q(-0.42), q(-1.12)); c.lineTo(q(0.42), q(-1.12)); c.lineTo(q(0.36), q(-0.8)); c.lineTo(q(-0.36), q(-0.8)); c.closePath(); }, T.main, T.sh, q(0.05));
      line(c, q(-0.38), q(-0.86), q(0.38), q(-0.86), C.gold, q(0.04));
      for (const x of [-0.3, -0.1, 0.1, 0.3]) { line(c, q(x), q(-0.8), q(x), q(-0.7), C.gold, q(0.025)); sh(c, () => circ(c, q(x), q(-0.68), q(0.035)), GOLD[0], GOLD[1], q(0.01)); }
      // the rider on the hump
      c.save(); c.translate(0, q(-1.3)); const r = v => v * k * 0.86;
      for (const sd of [-1, 1]) sh(c, () => rr(c, sd * r(0.2) - r(0.06), -r(0.14), r(0.12), r(0.26), r(0.05)), '#f3efe6', '#cfc8b8', r(0.02));
      sh(c, () => rr(c, -r(0.2), -r(0.48), r(0.4), r(0.44), r(0.14)), '#f3efe6', '#cfc8b8', r(0.05));
      sh(c, () => poly(c, [-r(0.2), -r(0.46), -r(0.06), -r(0.46), r(0.2), -r(0.1), r(0.06), -r(0.06)]), T.main, T.sh, r(0.02));
      sh(c, () => rr(c, -r(0.21), -r(0.16), r(0.42), r(0.07), r(0.03)), LEATHER[0], LEATHER[1], r(0.01));
      // the lasso, whirled overhead (faster as it winds up)
      const spin = o.t * (5 + ra * 10), lx = r(0.26), ly = -r(0.92);
      arm(c, r(0.16), -r(0.4), lx, ly + r(0.1), r(0.09), '#f3efe6');
      ell(c, lx, ly - r(0.12), r(0.3), r(0.1), Math.sin(spin) * 0.25); c.lineWidth = Math.max(1.5, r(0.07)); c.strokeStyle = OUT; c.stroke(); c.lineWidth = Math.max(1, r(0.04)); c.strokeStyle = '#d8b07a'; c.stroke();
      arm(c, -r(0.16), -r(0.4), -r(0.3), -r(0.2), r(0.09), '#f3efe6');
      head(c, r, -0.7, 0.24, o, { skin: ['#e0a982', '#c4885e'], iris: '#3a2a1a' });
      sh(c, () => { c.beginPath(); c.arc(0, -r(0.76), r(0.26), Math.PI, 0); c.closePath(); }, '#f3efe6', '#cfc8b8', r(0.04));
      sh(c, () => rr(c, -r(0.27), -r(0.8), r(0.54), r(0.08), r(0.03)), T.main, T.sh, r(0.02));
      if (!front) sh(c, () => circ(c, 0, -r(0.7), r(0.24)), '#f3efe6', '#cfc8b8', r(0.04));
      dot(c, 0, -r(0.98), r(0.05), C.gold);
      c.restore();
      // the head in front (walking toward you)
      if (front) {
        rope(c, () => { c.beginPath(); c.moveTo(0, q(-0.92)); c.lineTo(0, q(-0.72)); }, fur[0], q(0.2));
        const hy = -0.66;
        sh(c, () => ell(c, 0, q(hy), q(0.21), q(0.17)), fur[0], fur[1], q(0.04));
        sh(c, () => ell(c, 0, q(hy + 0.1), q(0.14), q(0.09)), '#ecd09c', '#cdb07a', q(0.02));
        for (const sd of [-1, 1]) dot(c, sd * q(0.05), q(hy + 0.1), q(0.018));
        for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(0.2), q(hy - 0.12), q(0.05), q(0.08)), furD[0], furD[1], q(0.01));
        eyes(c, 0, q(hy - 0.04), q(0.13), o, { gap: 0.7, iris: '#3a2a1a', fierce: ch ? 1 : 0.2, browCol: '#7a5a3a' });
        sh(c, () => rr(c, q(-0.2), q(hy - 0.2), q(0.4), q(0.05), q(0.02)), T.main, T.sh, q(0.01));
      }
    },

    /* ---------- Arena 4: Stormspire ---------- */
    // Bees: chubby striped bees with shimmering wings, a team stripe and a stinger
    bees(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 40 + (o.id || 0)), front = o.view === 'front', sting = (o.atk || 0) * q(0.12);
      c.save(); c.translate(0, sting * (front ? 1 : -1));
      for (const sd of [-1, 1]) { c.save(); c.translate(sd * q(0.12), q(-0.18)); c.rotate(sd * (0.5 + flap * 0.3)); ell(c, sd * q(0.12), -q(0.06), q(0.16), q(0.09)); paint(c, 'rgba(220,240,255,0.85)', LW() * 0.6); c.restore(); }
      sh(c, () => ell(c, 0, q(0.02), q(0.2), q(0.18)), '#ffcd33', '#e09f12', q(0.04));
      c.save(); ell(c, 0, q(0.02), q(0.2), q(0.18)); c.clip();
      for (const y of [-0.04, 0.08]) { c.fillStyle = '#2a2433'; c.fillRect(-q(0.25), q(y), q(0.5), q(0.06)); }
      c.fillStyle = T.main; c.fillRect(-q(0.25), q(-0.1), q(0.5), q(0.04));
      c.restore();
      ell(c, 0, q(0.02), q(0.2), q(0.18)); c.lineWidth = LW(); c.strokeStyle = OUT; c.stroke();
      poly(c, [q(-0.04), q(0.18), q(0.04), q(0.18), 0, q(0.3)]); paint(c, '#2a2433', LW() * 0.5);
      sh(c, () => circ(c, 0, q(-0.2), q(0.13)), '#2a2433', '#1a1622', q(0.03));
      for (const sd of [-1, 1]) { line(c, sd * q(0.04), q(-0.3), sd * q(0.1), q(-0.4), '#2a2433', LW() * 0.8); dot(c, sd * q(0.1), q(-0.4), q(0.025), '#ffcd33'); }
      if (front) { for (const sd of [-1, 1]) { circ(c, sd * q(0.05), q(-0.21), q(0.035)); c.fillStyle = '#fff'; c.fill(); circ(c, sd * q(0.05), q(-0.2), q(0.018)); c.fillStyle = OUT; c.fill(); } }
      c.restore();
    },
    // Owl: an armored battle owl with a steel helm and team-trimmed feathers, firing quills
    owl(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 7 + (o.id || 0)), front = o.view === 'front', sh2 = o.atk || 0;
      for (const sd of [-1, 1]) {
        c.save(); c.scale(sd, 1); c.translate(q(0.22), q(-0.2)); c.rotate(-0.25 - flap * 0.35 - sh2 * 0.3);
        const wing = () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.45), q(-0.55), q(0.95), q(-0.32)); c.lineTo(q(0.82), q(-0.18)); c.lineTo(q(0.9), q(-0.04)); c.lineTo(q(0.66), q(0.02)); c.lineTo(q(0.7), q(0.14)); c.quadraticCurveTo(q(0.3), q(0.2), 0, q(0.16)); c.closePath(); };
        sh(c, wing, '#b08060', '#86603e', q(0.06));
        c.save(); wing(); c.clip(); c.fillStyle = T.main; c.fillRect(q(0.6), q(-0.6), q(0.5), q(0.9)); c.restore();
        wing(); c.lineWidth = LW(); c.strokeStyle = OUT; c.stroke();
        c.restore();
      }
      sh(c, () => ell(c, 0, q(-0.02), q(0.3), q(0.38)), '#b08060', '#86603e', q(0.07));
      if (front) {
        sh(c, () => ell(c, 0, q(0.06), q(0.2), q(0.26)), '#f1e2c4', '#d4bf96', q(0.04));
        for (const y of [-0.02, 0.08, 0.18]) for (const sd of [-1, 1]) line(c, sd * q(0.07), q(y), sd * q(0.02), q(y + 0.04), '#c9a878', LW() * 0.6);
        sh(c, () => rr(c, q(-0.22), q(-0.12), q(0.44), q(0.09), q(0.03)), STEEL[0], STEEL[1], q(0.02));
      }
      sh(c, () => circ(c, 0, q(-0.48), q(0.27)), '#b08060', '#86603e', q(0.05));
      if (front) {
        for (const sd of [-1, 1]) sh(c, () => circ(c, sd * q(0.11), q(-0.5), q(0.12)), '#f1e2c4', '#d4bf96', q(0.02));
        eyes(c, 0, q(-0.48), q(0.3), o, { gap: 0.38, iris: '#ffb52e', brows: false });
        sh(c, () => poly(c, [q(-0.05), q(-0.42), q(0.05), q(-0.42), 0, q(-0.3)]), '#ffc52e', '#e09f12', q(0.02));
      }
      // the steel helm with a team plume
      sh(c, () => { c.beginPath(); c.arc(0, q(-0.66), q(0.26), Math.PI * 1.12, -Math.PI * 0.12); c.closePath(); }, STEEL[0], STEEL[1], q(0.04));
      for (const sd of [-1, 1]) sh(c, () => poly(c, [sd * q(0.14), q(-0.76), sd * q(0.32), q(-0.98), sd * q(0.2), q(-0.7)]), '#b08060', '#86603e', q(0.02));
      sh(c, () => ell(c, 0, q(-0.86), q(0.06), q(0.13)), T.main, T.sh, q(0.02));
    },
    // Thunder Cloud: a brooding storm cloud with angry eyes, crackling with lightning
    thundercloud(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], front = o.view === 'front', zap = o.atk || 0, puff = Math.sin(o.t * 2) * q(0.03);
      glow(c, 0, q(-0.1), q(1.1), '140,120,230', 0.25 + zap * 0.3);
      for (const [x, y, r] of [[-0.55, 0.05, 0.36], [0.55, 0.05, 0.36], [-0.28, -0.22, 0.42], [0.3, -0.2, 0.44], [0, 0.12, 0.42]]) sh(c, () => circ(c, q(x), q(y) + puff, q(r)), '#6a5ea8', '#4a3e86', q(0.1));
      sh(c, () => circ(c, 0, q(-0.12) + puff, q(0.46)), '#7a6eb8', '#5a4e96', q(0.08));
      for (let i = 0; i < 4; i++) { const x = -0.45 + i * 0.3, y = 0.5 + ((o.t * 1.6 + i * 0.37) % 1) * 0.35; ell(c, q(x), q(y), q(0.035), q(0.07)); paint(c, T.light, LW() * 0.5); }
      for (const sd of [-1, 1]) sh(c, () => ell(c, sd * q(0.42), q(0.26), q(0.16), q(0.07)), T.main, T.sh, q(0.02));
      if (front) {
        eyes(c, 0, q(-0.16), q(0.34), o, { gap: 0.48, iris: '#ffe27a', fierce: 1, browCol: '#2a2050' });
        mouth(c, 0, q(0.08), q(0.26), o, zap > 0.2 ? 'open' : 'flat');
      }
      for (let i = 0; i < 2; i++) { const x = (i ? 0.3 : -0.36), ph = Math.sin(o.t * 5 + i * 2); if (ph > 0.3 || zap > 0.3) { poly(c, [q(x), q(0.32), q(x + 0.1), q(0.32), q(x), q(0.48), q(x + 0.12), q(0.48), q(x - 0.06), q(0.75), q(x + 0.02), q(0.52), q(x - 0.08), q(0.52)]); paint(c, '#ffe27a', LW() * 0.6); } }
    },
    // Griffin: a storm griffin, eagle head with a team crest, lion body and lightning in its wings
    griffin(c, k, o) {
      const q = v => v * k, T = TEAM[o.team], flap = Math.sin(o.t * 8 + (o.id || 0)), front = o.view === 'front', bm = o.beam || 0;
      for (const sd of [-1, 1]) {
        c.save(); c.scale(sd, 1); c.translate(q(0.2), q(-0.24)); c.rotate(-0.3 - flap * 0.4);
        const wing = () => { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(q(0.5), q(-0.7), q(1.05), q(-0.5)); c.lineTo(q(0.92), q(-0.34)); c.lineTo(q(1.0), q(-0.2)); c.lineTo(q(0.76), q(-0.14)); c.lineTo(q(0.8), q(0.0)); c.lineTo(q(0.52), q(0.02)); c.quadraticCurveTo(q(0.24), q(0.18), 0, q(0.16)); c.closePath(); };
        sh(c, wing, '#e8d8b0', '#c4b086', q(0.06));
        c.save(); wing(); c.clip(); c.fillStyle = T.main; c.fillRect(q(0.68), q(-0.8), q(0.5), q(1)); c.restore();
        wing(); c.lineWidth = LW(); c.strokeStyle = OUT; c.stroke();
        if (bm) line(c, q(0.3), q(-0.2), q(0.7), q(-0.38), '#bff4ff', q(0.03 + bm * 0.01));
        c.restore();
      }
      rope(c, () => { c.beginPath(); c.moveTo(0, q(0.25)); c.quadraticCurveTo(q(0.4), q(0.5), q(0.2), q(0.72)); }, '#d8a868', q(0.07));
      sh(c, () => ell(c, q(0.2), q(0.74), q(0.06), q(0.09)), '#a87a40', '#86602e', q(0.01));
      for (const sd of [-1, 1]) { sh(c, () => rr(c, sd * q(0.2) - q(0.07), q(0.14), q(0.14), q(0.3), q(0.06)), '#c8985a', '#a87a40', q(0.02)); sh(c, () => ell(c, sd * q(0.2), q(0.44), q(0.1), q(0.06)), '#c8985a', '#a87a40', q(0.01)); }
      sh(c, () => ell(c, 0, q(0.02), q(0.32), q(0.36)), '#d8a868', '#b8884a', q(0.07));
      if (front) { sh(c, () => ell(c, 0, q(-0.06), q(0.2), q(0.18)), '#f5f2ea', '#d6d2c8', q(0.03)); for (const sd of [-1, 1]) { line(c, sd * q(0.1), q(0.18), sd * q(0.12), q(0.36), '#ffc52e', q(0.06)); } }
      sh(c, () => circ(c, 0, q(-0.46), q(0.26)), '#f5f2ea', '#d6d2c8', q(0.05));
      for (const x of [-0.1, 0, 0.1]) sh(c, () => poly(c, [q(x - 0.04), q(-0.66), q(x), q(-0.9), q(x + 0.04), q(-0.66)]), T.main, T.sh, q(0.02));
      if (front) {
        eyes(c, 0, q(-0.5), q(0.2), o, { gap: 0.55, iris: '#4ac8ff', fierce: 1 });
        sh(c, () => { c.beginPath(); c.moveTo(q(-0.08), q(-0.44)); c.lineTo(q(0.08), q(-0.44)); c.quadraticCurveTo(q(0.05), q(-0.24), 0, q(-0.24)); c.closePath(); }, '#ffc52e', '#e09f12', q(0.03));
      }
      if (bm) glow(c, 0, q(-0.5), q(0.4 + bm * 0.2), '150,230,255', 0.3 + bm * 0.15);
    },
  };

  A.add(T3);
  return { eyes, mouth, head, legs, torso, arm, sword, blush, glow, W, SKIN, HAIR, STEEL, GOLD, LEATHER, WOOD };
})();
