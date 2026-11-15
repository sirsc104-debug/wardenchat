/* Putt Club: how the Canyon looks. The desert round each hole, the cacti and tumbleweeds, the springs,
   and desert versions of the moving parts (PC.VIS.canyon[type] is used instead of PC.VIS[type] when a hole's look.theme is 'canyon'). */
(function (PC) {
  'use strict';
  const U = PC.U, T = PC.TEX, TAU = U.TAU;
  const col = PC.col, V = PC.V;
  const VIS = PC.VIS;
  const CV = VIS.canyon = {};
  const GY = () => PC.GROUND_Y;
  const M = (hex, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: 0.85 }, o || {}));
  const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
  const at = (o, x, y, h) => { o.position.copy(V(x, y, h)); return o; };
  const merge = parts => VIS.mergeGeos(parts);
  const M4 = (...a) => VIS.M4(...a);
  const now = (t, sim) => (sim ? sim.t : t);

  const texMat = (tex, rx, ry, o) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial(Object.assign({ map: t, roughness: 0.9 }, o || {})); };
  const stoneMat = (rx = 1, ry = 1, tint = '#ffffff') => texMat(T.sandstone(), rx, ry, { color: col(tint), roughness: 0.95 });
  const woodMat = (tone = '#8a6a44', rx = 1, ry = 1) => texMat(T.wood(tone), rx, ry, { roughness: 0.95 });
  const rough = (g, seed, amt = 0.2) => {
    const rnd = U.rng(seed), p = g.attributes.position, seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
      if (!seen.has(key)) seen.set(key, 1 - amt / 2 + rnd() * amt);
      const k = seen.get(key);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * (1 + (k - 1) * 0.4), p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  };

  // A text board painted on a canvas, for shop fronts.
  function boardTex(text, bg, fg) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(0,0,0,' + (0.05 + (i % 2) * 0.05) + ')'; g.fillRect(0, i * 26, 512, 2); }
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, 492, 108);
    g.fillStyle = fg; g.font = 'bold 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 68, 470);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ---------- Cacti ----------
  const CACTUS_TONES = { saguaro: '#4c8a3c', barrel: '#5a8f3a', pear: '#6a9e4c', cholla: '#a9a65e' };
  const cactusMats = {};
  function cactusMat(kind) {
    if (!cactusMats[kind]) {
      const t = T.cactus(CACTUS_TONES[kind]).clone(); t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(kind === 'barrel' ? 2.5 : kind === 'saguaro' ? 2 : 1, kind === 'saguaro' ? 3 : 1);
      cactusMats[kind] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
    }
    return cactusMats[kind];
  }
  // One cactus as a group, base at 0. r and h match the physics (how wide and tall it is to the ball).
  function cactusModel(c, rnd) {
    const g = new THREE.Group(), mat = cactusMat(c.kind), parts = [];
    const add = (geo, m) => parts.push({ g: geo, m });
    const blossoms = [];
    if (c.kind === 'saguaro') {
      const r = c.r * 0.95, h = c.h;
      add(new THREE.CylinderGeometry(r * 0.92, r, h - r, 18, 3), M4(0, (h - r) / 2, 0));
      add(new THREE.SphereGeometry(r * 0.92, 18, 8, 0, TAU, 0, Math.PI / 2), M4(0, h - r, 0));
      const arms = 1 + Math.floor(rnd() * 2.2);
      for (let i = 0; i < arms; i++) {
        const a = (i === 0 ? rnd() * TAU : i * 2.4 + rnd()), ar = r * 0.58, y0 = h * (0.38 + rnd() * 0.2), out = r + 0.22 + rnd() * 0.12, up = 0.35 + rnd() * 0.45;
        const ca = Math.cos(a), sa = Math.sin(a);
        add(new THREE.CylinderGeometry(ar, ar, out, 12), M4(ca * out / 2, y0, -sa * out / 2, 0, a, Math.PI / 2));
        add(new THREE.SphereGeometry(ar, 12, 8), M4(ca * out, y0, -sa * out));
        add(new THREE.CylinderGeometry(ar * 0.92, ar, up, 12), M4(ca * out, y0 + up / 2, -sa * out));
        add(new THREE.SphereGeometry(ar * 0.92, 12, 6, 0, TAU, 0, Math.PI / 2), M4(ca * out, y0 + up, -sa * out));
      }
      if (rnd() < 0.7) for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + rnd(); blossoms.push([Math.cos(a) * r * 0.5, h - r * 0.25, Math.sin(a) * r * 0.5, '#fff6e0']); }
    } else if (c.kind === 'barrel') {
      const r = c.r * 0.98, h = c.h;
      const prof = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(r * Math.sin(Math.PI * (0.08 + t * 0.84)) * (t < 0.5 ? 1 : 1 - (t - 0.5) * 0.25), t * h)); }
      prof.unshift(new THREE.Vector2(0, 0)); prof.push(new THREE.Vector2(0, h));
      add(new THREE.LatheGeometry(prof, 20), M4(0, 0, 0));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; blossoms.push([Math.cos(a) * r * 0.32, h - 0.02, Math.sin(a) * r * 0.32, i % 2 ? '#ffcf3a' : '#ff6a3a']); }
    } else if (c.kind === 'pear') {
      // Pads, flat ovals, the first ones on the ground and more growing out of their rims.
      const pads = [];
      const pad = (x, y, z, ry, rz, s) => { add(new THREE.SphereGeometry(1, 14, 10), M4(x, y, z, 0, ry, rz, 0.17 * s, 0.22 * s, 0.045 * s)); pads.push([x, y, z, ry, rz, s]); };
      const n0 = 3;
      for (let i = 0; i < n0; i++) {
        const a = (i / n0) * TAU + rnd(), d = c.r * 0.42;
        pad(Math.cos(a) * d, 0.2, -Math.sin(a) * d, a + Math.PI / 2, (rnd() - 0.5) * 0.4, 1);
      }
      for (let i = 0; i < 4; i++) {
        const b = pads[i % n0], a = b[3] - Math.PI / 2, s = 0.8 + rnd() * 0.15;
        const tilt = (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.4);
        const x = b[0] * 0.6 - Math.sin(tilt) * 0.12 * Math.cos(b[3]), z = b[2] * 0.6;
        pad(x, 0.2 + 0.36, z, b[3] + (rnd() - 0.5) * 0.8, tilt, s);
        if (rnd() < 0.8) blossoms.push([x + (rnd() - 0.5) * 0.12, 0.2 + 0.36 + 0.17 * s, z, '#c2185b', 0.045]);
      }
    } else {
      // Cholla: a short trunk with jointed, fuzzy branches.
      const seg = (x0, y0, z0, x1, y1, z1, r) => {
        const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
        add(new THREE.CylinderGeometry(r, r * 1.1, L, 9), new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), q, new THREE.Vector3(1, 1, 1)));
        add(new THREE.SphereGeometry(r * 1.05, 9, 6), M4(x1, y1, z1));
      };
      seg(0, 0, 0, 0, c.h * 0.45, 0, 0.075);
      const tips = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + rnd() * 0.6, out = 0.1 + rnd() * 0.12, y1 = c.h * (0.55 + rnd() * 0.2);
        const x1 = Math.cos(a) * out, z1 = Math.sin(a) * out;
        seg(0, c.h * 0.42, 0, x1, y1, z1, 0.06);
        const x2 = x1 * 1.6 + (rnd() - 0.5) * 0.05, z2 = z1 * 1.6, y2 = Math.min(c.h, y1 + 0.18 + rnd() * 0.12);
        seg(x1, y1, z1, x2, y2, z2, 0.055);
        tips.push([x2, y2, z2]);
      }
      tips.forEach(p => { if (rnd() < 0.6) blossoms.push([p[0], p[1] + 0.05, p[2], '#e8d84a', 0.04]); });
    }
    const body = mesh(merge(parts), mat);
    g.add(body);
    if (blossoms.length) {
      const bg = new THREE.SphereGeometry(1, 8, 6);
      blossoms.forEach(([x, y, z, c2, s]) => { const b = mesh(bg, M(c2, { roughness: 0.6, emissive: col(c2), emissiveIntensity: 0.12 }), false); b.scale.set(s || 0.05, (s || 0.05) * 0.7, s || 0.05); b.position.set(x, y, z); g.add(b); });
    }
    g.rotation.y = rnd() * TAU;
    return g;
  }
  VIS.cactusModel = cactusModel;

  VIS.cacti = function (s, world, f) {
    const sim = world.sim;
    const items = f.list.map((c, i) => {
      const g = cactusModel(c, U.rng(Math.round(c.x * 97 + c.y * 31) + i));
      const base = new THREE.Group(); base.add(g);
      // a little ring of pebbles round its foot
      const peb = new THREE.Mesh(new THREE.RingGeometry(c.r * 0.9, c.r * 1.25, 18), M('#b08a5a', { roughness: 1 }));
      peb.rotation.x = -Math.PI / 2; peb.position.y = 0.006; peb.receiveShadow = true;
      base.add(peb);
      world.holeGroup.add(at(base, c.x, c.y, sim.groundRaw(c.x, c.y)));
      return { c, g, ry: g.rotation.y };
    });
    return {
      update(t, dt, s2) {
        const tt = now(t, s2);
        items.forEach(it => {
          const k = tt - (it.c.hit || -9);
          if (k >= 0 && k < 0.7) { const w = Math.sin(k * 34) * 0.14 * (1 - k / 0.7); it.g.rotation.z = w; it.g.rotation.x = w * 0.5; }
          else { it.g.rotation.z = Math.sin(t * 0.6 + it.c.x) * 0.006; it.g.rotation.x = 0; }
        });
      },
    };
  };

  // ---------- Tumbleweeds ----------
  VIS.tumbleweeds = function (s, world, f) {
    const sim = world.sim;
    const twig = T.twigs();
    const shellMat = new THREE.MeshStandardMaterial({ map: twig, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1, color: col('#e8d0a0') });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: twig, alphaTest: 0.35 });
    const stickMat = M('#9a7a4c', { roughness: 1 });
    const weeds = f.list.map((w, i) => {
      const g = new THREE.Group(), spin = new THREE.Group();
      const rnd = U.rng(77 + i * 13);
      [1, 0.78, 0.55].forEach((k, j) => {
        const sh = new THREE.Mesh(new THREE.IcosahedronGeometry(w.r * k, 2), shellMat);
        sh.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
        sh.castShadow = true; sh.customDepthMaterial = depth;
        spin.add(sh);
      });
      for (let k = 0; k < 7; k++) {
        const tor = mesh(new THREE.TorusGeometry(w.r * (0.7 + rnd() * 0.28), 0.012, 4, 22, TAU * (0.5 + rnd() * 0.5)), stickMat, false);
        tor.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
        spin.add(tor);
      }
      g.add(spin);
      world.holeGroup.add(g);
      return { w, g, spin, px: w.x, py: w.y, hop: rnd() * 6, dust: 0 };
    });
    const axis = new THREE.Vector3(), q = new THREE.Quaternion();
    return {
      update(t, dt, s2) {
        const tt = now(t, s2);
        weeds.forEach(o => {
          const w = o.w, dx = w.x - o.px, dy = w.y - o.py, d = Math.hypot(dx, dy);
          o.px = w.x; o.py = w.y;
          if (d > 1e-5 && d < 1) {
            axis.set(-dy / d, 0, -dx / d);
            q.setFromAxisAngle(axis, d / w.r);
            o.spin.quaternion.premultiply(q);
            o.hop += d * 2.2;
          }
          const sp = Math.hypot(w.vx, w.vy);
          const hop = Math.abs(Math.sin(o.hop)) * 0.07 * Math.min(1, sp / 1.2);
          const k = tt - (w.hit || -9), sq = k >= 0 && k < 0.35 ? 1 - Math.sin(k * 26) * 0.12 * (1 - k / 0.35) : 1;
          o.g.scale.set(2 - sq, sq, 2 - sq);
          o.g.position.copy(V(w.x, w.y, sim.groundRaw(w.x, w.y) + w.r * sq + hop));
          // a little dust kicked up when it lands from a hop
          o.dust += dt * sp;
          if (o.dust > 0.5 && hop < 0.01) {
            o.dust = 0;
            world.glow.spawn({ x: w.x + (Math.random() - 0.5) * w.r, y: sim.groundRaw(w.x, w.y) + 0.05, z: -w.y + (Math.random() - 0.5) * w.r, vx: -w.vx * 0.15, vy: 0.25, vz: w.vy * 0.15, g: -0.2, life: 0.9, size: 0.14, grow: 1.8, color: col('#d8b88a'), a: 0.4 });
          }
        });
      },
    };
  };

  // ---------- Springs (Ultra; drawn here so every course can use them) ----------
  class Helix extends THREE.Curve {
    constructor(r, h, turns) { super(); this.r = r; this.h = h; this.turns = turns; }
    getPoint(t, out = new THREE.Vector3()) { const a = t * this.turns * TAU; return out.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r); }
  }
  VIS.spring = function (s, world, f, hell) {
    const sim = world.sim, h0 = sim.groundRaw(s.x, s.y);
    const trap = s.dir !== undefined;
    const g = new THREE.Group();
    const metal = hell ? M('#3a3036', { metalness: 0.7, roughness: 0.4 }) : M('#8a8f96', { metalness: 0.8, roughness: 0.3 });
    const padCol = trap ? '#e0332a' : '#f2b81f';
    const housing = mesh(new THREE.TorusGeometry(s.r * 0.98, 0.06, 8, 28), metal);
    housing.rotation.x = -Math.PI / 2; housing.position.y = 0.03;
    const well = new THREE.Mesh(new THREE.CircleGeometry(s.r * 0.98, 28), new THREE.MeshBasicMaterial({ color: col('#1a1210') }));
    well.rotation.x = -Math.PI / 2; well.position.y = 0.004;
    g.add(housing, well);
    // the coil, squashed flat until it fires
    const coilGeo = new THREE.TubeGeometry(new Helix(s.r * 0.6, 1, 5), 120, 0.035, 6, false);
    const coil = mesh(coilGeo, hell ? M('#c8a050', { metalness: 0.8, roughness: 0.35 }) : M('#d8d8d8', { metalness: 0.9, roughness: 0.25 }));
    coil.scale.y = 0.03;
    g.add(coil);
    // the pad on top, with chevrons (jump) or an arrow (trap) painted on
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x2 = c.getContext('2d');
    x2.fillStyle = padCol; x2.beginPath(); x2.arc(64, 64, 62, 0, TAU); x2.fill();
    x2.strokeStyle = 'rgba(0,0,0,0.35)'; x2.lineWidth = 6; x2.beginPath(); x2.arc(64, 64, 56, 0, TAU); x2.stroke();
    x2.fillStyle = trap ? '#ffffff' : '#5a3a08'; x2.strokeStyle = x2.fillStyle; x2.lineWidth = 12; x2.lineCap = 'round'; x2.lineJoin = 'round';
    if (trap) { x2.beginPath(); x2.moveTo(24, 64); x2.lineTo(92, 64); x2.stroke(); x2.beginPath(); x2.moveTo(104, 64); x2.lineTo(76, 40); x2.lineTo(76, 88); x2.closePath(); x2.fill(); }
    else { [44, 74].forEach(y => { x2.beginPath(); x2.moveTo(36, y + 14); x2.lineTo(64, y - 10); x2.lineTo(92, y + 14); x2.stroke(); }); }
    const tex = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const padTop = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.2, emissive: col(padCol), emissiveIntensity: hell ? 0.5 : 0.12 });
    const pad = mesh(new THREE.CylinderGeometry(s.r * 0.86, s.r * 0.86, 0.05, 28), [M(padCol, { metalness: 0.4, roughness: 0.4 }), padTop, M(padCol)]);
    pad.position.y = 0.035;
    // turn the pad so its arrow points the way it throws, or its chevrons point at the landing
    const dir = trap ? s.dir : s.land ? Math.atan2(s.land[1] - s.y, s.land[0] - s.x) : Math.PI / 2;
    pad.rotation.y = dir + (trap ? Math.PI / 2 : 0);   // the cap's u runs along local z, v along local x
    g.add(pad);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    // a faint marker where a jump spring lands, so you know where it sends you
    if (s.land) {
      const mk = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: col('#f2b81f'), transparent: true, opacity: 0.55, depthWrite: false }));
      mk.rotation.x = -Math.PI / 2;
      world.holeGroup.add(at(mk, s.land[0], s.land[1], sim.floorHeight(s.land[0], s.land[1]) + 0.012));
    }
    let fired = -9;
    return {
      update(t, dt, s2) {
        const tt = now(t, s2), k = tt - (f.hit === undefined ? -9 : f.hit);
        let up = 0;
        if (k >= 0 && k < 0.9) up = k < 0.06 ? k / 0.06 : Math.max(0, Math.exp(-(k - 0.06) * 5) * Math.cos((k - 0.06) * 22));
        const lift = Math.max(0, up) * 0.42;
        pad.position.y = 0.035 + lift;
        coil.scale.y = 0.03 + lift;
        if (f.hit > fired && k < 0.2) {
          fired = f.hit;
          for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, sp = 0.6 + Math.random(); world.glow.spawn({ x: s.x, y: h0 + 0.1, z: -s.y, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2, vz: Math.sin(a) * sp, g: -6, life: 0.5, size: 0.06, color: col(trap ? '#ff6a4a' : '#ffe27a') }); }
        }
        padTop.emissiveIntensity = (hell ? 0.5 : 0.12) + (trap ? 0.1 : 0.15) * (1 + Math.sin(t * 4)) + (k >= 0 && k < 0.4 ? 1 : 0);
      },
    };
  };
  if (VIS.abyss) VIS.abyss.spring = (s, world, f) => VIS.spring(s, world, f, true);

  // ---------- The desert round each hole ----------
  VIS.decorateCanyon = function (hole, world, sim) {
    const rnd = U.rng(U.hash(hole.id) + 3);
    const box = hole.box, G = world.holeGroup, base = GY();
    const L = world.L;
    const sunset = hole.look.light === 'mesa';
    const polys = hole.floors.map(f => f.poly).concat(hole.hazards.map(z => z.poly));
    const clear = (x, y, m) => polys.every(P => !U.inPoly(x, y, P) && U.distToPoly(x, y, P) > m);
    const fwd = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    const behind = (x, y) => { const a = Math.atan2(y - hole.tee[1], x - hole.tee[0]); return Math.abs(U.wrapAngle(a - (fwd + Math.PI))) < 0.7 && Math.hypot(x - hole.tee[0], y - hole.tee[1]) < 18; };
    const cx = box.cx, cy = box.cy;
    const tints = sunset ? ['#ffffff', '#ffd8c0', '#f4c0a0', '#ffe2cc'] : ['#ffffff', '#f6ddc8', '#ecc8a8', '#fff0e0'];

    // --- Mesas, buttes and spires all round the horizon, in banded red sandstone ---
    const mesaGeo = rough(new THREE.CylinderGeometry(0.86, 1, 1, 9, 3), 11, 0.12);
    const butteGeo = rough(new THREE.CylinderGeometry(0.7, 1, 1, 7, 4), 12, 0.16);
    const spireGeo = rough(new THREE.CylinderGeometry(0.25, 1, 1, 7, 5), 13, 0.22);
    const capGeo = rough(new THREE.CylinderGeometry(1.05, 0.9, 1, 9, 1), 14, 0.12);
    const big = [], mid = [], spires = [], caps = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rnd() * 0.3, d = 150 + rnd() * 70, r = 18 + rnd() * 26, h = 22 + rnd() * 26;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      big.push({ x, y: base + h / 2 - 1, z: -y, sx: r * (1 + rnd() * 0.6), sy: h, sz: r, ry: rnd() * 6, c: tints[i % 4] });
      caps.push({ x, y: base + h - 1 + 0.6, z: -y, sx: r * (1 + rnd() * 0.6) * 0.9, sy: 1.6, sz: r * 0.9, ry: rnd() * 6, c: '#c87a4a' });
    }
    for (let i = 0; i < 14; i++) {
      const a = rnd() * TAU, d = 55 + rnd() * 70;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (behind(x, y)) continue;
      const r = 3 + rnd() * 6, h = 10 + rnd() * 22;
      (rnd() < 0.6 ? mid : spires).push({ x, y: base + h / 2 - 0.5, z: -y, sx: r, sy: h, sz: r * (0.8 + rnd() * 0.4), ry: rnd() * 6, c: tints[i % 4] });
    }
    VIS.instanced(world, mesaGeo, stoneMat(3, 6), big, false);
    VIS.instanced(world, capGeo, stoneMat(3, 1, '#b8704a'), caps, false);
    VIS.instanced(world, butteGeo, stoneMat(2, 5), mid, false);
    VIS.instanced(world, spireGeo, stoneMat(1, 5), spires, false);

    // --- Boulders, scrub, dry grass and cacti on the sand near the course ---
    const rocks = [], scrub = [], grass = [], decorCacti = [];
    for (let i = 0; i < 520; i++) {
      const x = box.x0 - 18 + rnd() * (box.w + 36), y = box.y0 - 12 + rnd() * (box.h + 30);
      if (!clear(x, y, 0.9) || behind(x, y) && Math.hypot(x - hole.tee[0], y - hole.tee[1]) < 9) continue;
      if (hole.hazards.some(z => z.kind === 'chasm' && U.distToPoly(x, y, z.poly) < 1.4)) continue;
      const r = rnd();
      if (r < 0.2) { const s = 0.12 + rnd() * 0.36; rocks.push({ x, y: base + s * 0.3, z: -y, sx: s * (1 + rnd()), sy: s * 0.7, sz: s, rx: rnd(), ry: rnd() * 6, c: ['#c88a5a', '#b87a4c', '#d8a070', '#a86a40'][i % 4] }); }
      else if (r < 0.34) { const s = 0.12 + rnd() * 0.16; for (let k = 0; k < 3; k++) scrub.push({ x: x + (rnd() - 0.5) * s * 2, y: base + s * 0.5, z: -(y + (rnd() - 0.5) * s * 2), s: s * (0.7 + rnd() * 0.5), sy: s * 0.75, ry: rnd() * 6, c: ['#76804c', '#86905a', '#6a7444', '#8a8a56'][(i + k) % 4] }); }
      else if (r < 0.85) { const s = 0.12 + rnd() * 0.2; grass.push({ x, y: base + s * 0.5, z: -y, sx: s * 0.6, sy: s, sz: s * 0.6, ry: rnd() * 6, c: ['#d8c080', '#c8a860', '#e0cc90'][i % 3] }); }
      else if (decorCacti.length < 22 && clear(x, y, 3.2)) decorCacti.push([x, y]);
    }
    VIS.instanced(world, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), rocks);
    VIS.instanced(world, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), scrub);
    VIS.instanced(world, new THREE.ConeGeometry(1, 1, 5, 1, true), new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), grass, false);
    const kinds = ['saguaro', 'saguaro', 'barrel', 'pear', 'cholla'];
    decorCacti.forEach(([x, y], i) => {
      const kind = kinds[i % kinds.length], big2 = kind === 'saguaro' ? 1 + rnd() * 0.8 : 1;
      const m = cactusModel({ kind, r: ({ saguaro: 0.3, barrel: 0.34, pear: 0.42, cholla: 0.3 })[kind] * big2, h: ({ saguaro: 2.2, barrel: 0.55, pear: 0.7, cholla: 0.9 })[kind] * big2 }, U.rng(i * 7 + 1));
      m.traverse(o => { if (o.isMesh) o.castShadow = kind === 'saguaro'; });
      G.add(at(m, x, y, base));
    });
    // Far-off saguaros on the plain, for scale
    const farS = [];
    for (let i = 0; i < 70; i++) {
      const a = rnd() * TAU, d = 28 + rnd() * 70, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (behind(x, y) || !clear(x, y, 4)) continue;
      const h = 2.5 + rnd() * 3;
      farS.push({ x, y: base + h / 2, z: -y, sx: 0.3, sy: h, sz: 0.3, c: '#5a8a46' });
      if (rnd() < 0.8) farS.push({ x: x + 0.45, y: base + h * 0.55, z: -y, sx: 0.2, sy: h * 0.35, sz: 0.2, c: '#5a8a46' });
    }
    VIS.instanced(world, new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), farS, false);

    // --- An old wooden fence and a wagon wheel by the tee, and a sandstone path up to it ---
    const ta = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    const slabs = [];
    for (let i = 1; i < 9; i++) {
      const d = 1.2 + i * 0.8;
      const x = hole.tee[0] - Math.cos(ta) * d + Math.sin(i * 1.7) * 0.15, y = hole.tee[1] - Math.sin(ta) * d;
      if (!clear(x, y, 0.35)) continue;
      slabs.push({ x, y: base + 0.03, z: -y, sx: 0.36 + rnd() * 0.12, sy: 0.06, sz: 0.28 + rnd() * 0.1, ry: rnd() * 3, c: '#e0a878' });
    }
    VIS.instanced(world, new THREE.CylinderGeometry(1, 1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 0.95 }), slabs, false);
    const fence = [], rails2 = [];
    const fx0 = box.x0 - 4.5, fy0 = box.y0 + 1;
    for (let i = 0; i < 6; i++) {
      const y = fy0 + i * 1.6;
      if (!clear(fx0, y, 0.6)) continue;
      fence.push({ x: fx0 + (rnd() - 0.5) * 0.1, y: base + 0.5, z: -y, sx: 0.1, sy: 1, sz: 0.1, rz: (rnd() - 0.5) * 0.12, c: '#8a6a44' });
      if (i < 5 && clear(fx0, y + 1.6, 0.6)) [0.35, 0.75].forEach(h => rails2.push({ x: fx0, y: base + h, z: -(y + 0.8), sx: 0.05, sy: 0.08, sz: 1.7, rx: (rnd() - 0.5) * 0.05, c: '#9a7a52' }));
    }
    VIS.instanced(world, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 1 }), fence.concat(rails2));
    VIS.sign(hole, world, sim);

    // --- Sky: thin clouds, and vultures circling high above ---
    const clouds = [];
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU, d = 120 + rnd() * 60, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, h = 50 + rnd() * 20;
      for (let k = 0; k < 4; k++) clouds.push({ x: x + (rnd() - 0.5) * 30, y: h + rnd() * 3, z: -(y + (rnd() - 0.5) * 8), s: 9 + rnd() * 8, sy: 1.6 + rnd(), c: sunset ? '#ffd8c0' : '#ffffff' });
    }
    VIS.instanced(world, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: col((world.L && world.L.cloud) || '#ffffff'), fog: false, transparent: true, opacity: 0.8, userData: { cloud: true } }), clouds, false);
    const birds = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group(), wm = M('#2a2220', { side: THREE.DoubleSide });
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), wm), wr = wl.clone();
      wl.position.x = -0.45; wr.position.x = 0.45;
      const lp = new THREE.Group(), rp = new THREE.Group(); lp.add(wl); rp.add(wr);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), wm); body.scale.z = 2.4;
      b.add(lp, rp, body);
      G.add(b);
      birds.push({ b, lp, rp, ph: rnd() * 9, r: 10 + rnd() * 8, h: 16 + rnd() * 8, cx: cx + (rnd() - 0.5) * 10, cy: cy + 6 + rnd() * 10 });
    }

    // --- Drifting dust, and the odd shimmer of heat off the sand ---
    let dustT = 0;
    world.vis.push({
      update(t, dt) {
        birds.forEach(o => {
          const a = t * 0.18 + o.ph;
          o.b.position.copy(V(o.cx + Math.cos(a) * o.r, o.cy + Math.sin(a) * o.r, o.h + Math.sin(t * 0.5 + o.ph)));
          o.b.rotation.set(0, a, 0.25);
          const flap = Math.sin(t * 2 + o.ph) > 0.85 ? Math.sin(t * 9) * 0.4 : 0.08;
          o.lp.rotation.z = flap; o.rp.rotation.z = -flap;
        });
        dustT += dt;
        if (dustT > 0.1) {
          dustT = 0;
          const x = box.x0 - 4 + Math.random() * (box.w + 8), y = box.y0 + Math.random() * box.h;
          world.glow.spawn({ x, y: 0.15 + Math.random() * 1.2, z: -y, vx: 0.35, vy: 0.04, vz: (Math.random() - 0.5) * 0.1, g: 0, life: 4, size: 0.03, color: col('#fff0d0'), a: 0.6, wobble: 0.3, seed: Math.random() * 9, drag: 1 });
        }
      },
    });
  };

  // ---------- Posts: sandstone pillars ----------
  const basePost = VIS.post;
  VIS.post = function (p, world) {
    if (p.style !== 'sandrock') return basePost(p, world);
    const h0 = world.sim.groundRaw(p.x, p.y);
    const geo = rough(new THREE.CylinderGeometry(p.r * 0.85, p.r * 1.08, p.h + 0.3, 10, 4), Math.round(p.x * 31 + p.y * 7), 0.16);
    const m = mesh(geo, stoneMat(1, 0.6));
    world.holeGroup.add(at(m, p.x, p.y, h0 + (p.h + 0.3) / 2 - 0.3));
  };

  // ---------- Desert versions of the moving parts ----------
  // Saloon doors: batwing doors on two posts, swinging open and shut.
  CV.gates = function (s, world, f) {
    const sim = world.sim;
    const plank = woodMat('#8a5a34', 0.4, 0.6), dark = M('#5a3a22', { roughness: 1 });
    const doors = f.list.map(g => {
      const dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1], len = Math.hypot(dx, dy), half = len / 2;
      const ang = Math.atan2(dy, dx);
      const make = (hinge, dir) => {
        const piv = new THREE.Group(), holder = new THREE.Group();
        const w = half - 0.03;
        const frame = mesh(new THREE.BoxGeometry(w, 0.6, 0.05), plank);
        frame.position.set(w / 2, 0.32, 0);
        holder.add(frame);
        for (let i = 0; i < 4; i++) { const sl = mesh(new THREE.BoxGeometry(w * 0.8, 0.035, 0.07), dark); sl.position.set(w / 2, 0.16 + i * 0.1, 0); sl.rotation.x = 0.4; holder.add(sl); }
        const top = mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.05, 16, 1, false, 0, Math.PI), plank);
        top.rotation.x = Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.set(w / 2, 0.62, 0); top.scale.set(1, 1, 0.35);
        holder.add(top);
        holder.scale.x = dir;
        piv.add(holder);
        piv.position.copy(V(hinge[0], hinge[1], sim.groundRaw(hinge[0], hinge[1])));
        piv.rotation.y = ang;
        world.holeGroup.add(piv);
        const post = mesh(new THREE.BoxGeometry(0.12, 1.25, 0.12), dark);
        world.holeGroup.add(at(post, hinge[0], hinge[1], sim.groundRaw(hinge[0], hinge[1]) + 0.62));
        return piv;
      };
      // a lintel with a sign over the doorway
      const mx = (g.a[0] + g.b[0]) / 2, my = (g.a[1] + g.b[1]) / 2, h0 = sim.groundRaw(mx, my);
      const lintel = mesh(new THREE.BoxGeometry(len + 0.3, 0.12, 0.14), dark);
      lintel.rotation.y = ang;
      world.holeGroup.add(at(lintel, mx, my, h0 + 1.25));
      const sign = mesh(new THREE.BoxGeometry(len * 0.9, 0.28, 0.04), [dark, dark, dark, dark, new THREE.MeshStandardMaterial({ map: boardTex('SALOON', '#6a4426', '#f4d8a0'), roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: boardTex('SALOON', '#6a4426', '#f4d8a0'), roughness: 0.9 })]);
      sign.rotation.y = ang;
      world.holeGroup.add(at(sign, mx, my, h0 + 1.45));
      return { g, a: make(g.a, 1), b: make(g.b, -1), ang };
    });
    return {
      update(t) {
        doors.forEach(d => {
          const o = U.smooth(0, 1, d.g.open);
          const flap = d.g.open > 0.98 ? Math.sin(t * 7) * 0.05 : 0;
          d.a.rotation.y = d.ang + o * 1.45 + flap;
          d.b.rotation.y = d.ang - o * 1.45 - flap;
        });
      },
    };
  };

  // Mine shafts: a timber collar round each hole and a little headframe with a winding wheel.
  CV.tunnels = function (s, world, f) {
    const timber = woodMat('#6a4a2c', 0.5, 0.5), dark = M('#3a2818', { roughness: 1 });
    const wheels = [];
    s.pairs.forEach((p, i) => {
      [p.a, p.b].forEach((e, end) => {
        const h = world.sim.groundRaw(e[0], e[1]);
        const g = new THREE.Group();
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.33, 24), new THREE.MeshBasicMaterial({ map: T.cupShade() }));
        hole.rotation.x = -Math.PI / 2; hole.position.y = 0.012;
        g.add(hole);
        const R = 0.48;
        for (let k = 0; k < 4; k++) {
          const beam = mesh(new THREE.BoxGeometry(R * 2 + 0.16, 0.08, 0.12), timber);
          const a = (k / 4) * TAU;
          beam.position.set(Math.cos(a) * R, 0.04, Math.sin(a) * R);
          beam.rotation.y = -a + Math.PI / 2;
          g.add(beam);
        }
        // headframe: two legs, a crossbeam and a wheel turning when a ball goes through
        const legL = mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), dark), legR = legL.clone();
        legL.position.set(-R - 0.05, 0.72, 0); legL.rotation.z = -0.12;
        legR.position.set(R + 0.05, 0.72, 0); legR.rotation.z = 0.12;
        const cross = mesh(new THREE.BoxGeometry(R * 2 + 0.1, 0.08, 0.1), dark); cross.position.y = 1.42;
        const wheel = new THREE.Group();
        const rim = mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 20), M('#5a5a5a', { metalness: 0.7, roughness: 0.4 }));
        wheel.add(rim);
        for (let k = 0; k < 4; k++) { const sp = mesh(new THREE.BoxGeometry(0.44, 0.02, 0.02), M('#5a5a5a', { metalness: 0.7 })); sp.rotation.z = (k / 4) * Math.PI; wheel.add(sp); }
        wheel.position.y = 1.6;
        const rope = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.4, 4), M('#c8b080'), false); rope.position.set(0.22, 0.9, 0);
        g.add(legL, legR, cross, wheel, rope);
        const exitDir = end ? p.dirB : p.dirA;
        g.rotation.y = exitDir;   // the frame stands across the way the ball comes out
        world.holeGroup.add(at(g, e[0], e[1], h));
        // a lantern on one leg
        const lamp = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: col('#ffcf6a'), emissive: col('#ffb03a'), emissiveIntensity: 1.6 }), false);
        lamp.position.set(-R - 0.1, 1.05, 0.08); g.add(lamp);
        wheels.push({ wheel, i, end });
      });
    });
    return {
      update(t, dt) {
        wheels.forEach(w => {
          const tp = f.pops && f.pops[w.i] ? f.pops[w.i][w.end] : -9;
          const k = t - (tp - 0.75);
          w.wheel.rotation.z += dt * (k > 0 && k < 1.5 ? 9 : 0.2);
        });
      },
    };
  };

  // A windpump: its sails spin up with every gust, and dust blows across the hole.
  CV.wind = function (s, world, f) {
    const box = world.hole.box, base = GY();
    const dx = s.dir ? s.dir[0] : 1, dy = s.dir ? s.dir[1] : 0;
    const px = box.x0 - 3.2, py = box.y1 - 3;
    const g = new THREE.Group();
    const leg = M('#6a6a6a', { metalness: 0.6, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4, l = mesh(new THREE.CylinderGeometry(0.035, 0.05, 5.4, 6), leg);
      l.position.set(Math.cos(a) * 0.45, 2.7, Math.sin(a) * 0.45);
      l.rotation.set(Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08);
      g.add(l);
    }
    for (let k = 1; k < 4; k++) { const ring = mesh(new THREE.TorusGeometry(0.55 - k * 0.07, 0.02, 4, 4), leg); ring.rotation.set(Math.PI / 2, 0, Math.PI / 4); ring.position.y = k * 1.35; g.add(ring); }
    const head = new THREE.Group();
    head.position.y = 5.5;
    const rotor = new THREE.Group();
    const blade = M('#d8d0c0', { metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) {
      const b = mesh(new THREE.PlaneGeometry(0.22, 1.0), blade);
      b.position.set(0, 0.62, 0); b.rotation.y = 0.5;
      const hh = new THREE.Group(); hh.add(b); hh.rotation.z = (i / 14) * TAU; rotor.add(hh);
    }
    const hub = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), leg); hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    rotor.position.z = 0.3;
    const tail = mesh(new THREE.PlaneGeometry(1.0, 0.6), M('#c84a2a', { side: THREE.DoubleSide }));
    tail.position.set(0, 0.1, -1.0); tail.rotation.y = Math.PI / 2;
    const boom = mesh(new THREE.BoxGeometry(0.05, 0.05, 1.0), leg); boom.position.z = -0.5;
    head.add(rotor, tail, boom);
    g.add(head);
    // face into the wind
    head.rotation.y = Math.atan2(-dx, dy);
    world.holeGroup.add(at(g, px, py, base));
    const trough = mesh(new THREE.BoxGeometry(1.4, 0.35, 0.6), woodMat('#7a5a3a'));
    world.holeGroup.add(at(trough, px + 1.1, py - 0.6, base + 0.17));
    let acc = 0, spin = 0;
    return {
      update(t, dt) {
        const k = f.gust || 0;
        spin += dt * (0.6 + k * 9);
        rotor.rotation.z = -spin;
        acc += dt * (1 + k * 16 + (f.warn || 0) * 3);
        while (acc > 1) {
          acc -= 1;
          const y = box.y0 + Math.random() * box.h, x = box.x0 - 3;
          world.glow.spawn({ x, y: 0.1 + Math.random() * 1.2, z: -y, vx: (2.5 + k * 6) * dx, vy: Math.random() * 0.3, vz: -(2.5 + k * 6) * dy + (Math.random() - 0.5) * 0.4, g: 0, drag: 1, life: 3, size: 0.12 + Math.random() * 0.16, grow: 1.6, color: col('#d8b88a'), a: 0.3 + k * 0.25, wobble: 1, seed: Math.random() * 9 });
        }
      },
    };
  };

  // The wagon-wheel turnstile: plank arms below an old wagon wheel lying flat on the hub.
  CV.spinner = function (s, world, f) {
    const g = new THREE.Group(), h0 = world.sim.groundRaw(s.x, s.y);
    const dark = M('#5a3a22', { roughness: 1 });
    const post = mesh(new THREE.CylinderGeometry(0.2, 0.24, s.h + 0.2, 12), woodMat('#6a4a2c'));
    post.position.y = (s.h + 0.2) / 2;
    g.add(post);
    const rot = new THREE.Group();
    const board = woodMat('#9a6a3c', 1, 0.5);
    for (let i = 0; i < s.arms; i++) {
      const hh = new THREE.Group();
      const b = mesh(new THREE.BoxGeometry(s.len - 0.2, s.h * 0.62, s.w * 0.9), board);
      b.position.set((s.len + 0.2) / 2, s.h * 0.33, 0);
      hh.add(b);
      hh.rotation.y = (i * TAU) / s.arms;
      rot.add(hh);
    }
    // the wheel: a rim, sixteen spokes and a hub
    const wheel = new THREE.Group();
    const rim = mesh(new THREE.TorusGeometry(s.len - 0.05, 0.07, 6, 48), dark);
    rim.rotation.x = Math.PI / 2;
    const tyre = mesh(new THREE.TorusGeometry(s.len - 0.05, 0.035, 6, 48), M('#4a4a4a', { metalness: 0.7, roughness: 0.4 }));
    tyre.rotation.x = Math.PI / 2; tyre.scale.z = 2.6;
    wheel.add(rim, tyre);
    for (let i = 0; i < 16; i++) { const sp = mesh(new THREE.CylinderGeometry(0.035, 0.05, s.len - 0.2, 6), woodMat('#9a6a3c')); sp.rotation.z = Math.PI / 2; sp.position.x = (s.len - 0.2) / 2 + 0.1; const hh = new THREE.Group(); hh.add(sp); hh.rotation.y = (i / 16) * TAU; wheel.add(hh); }
    const hub = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.24, 14), dark);
    wheel.add(hub);
    wheel.position.y = s.h + 0.05;
    rot.add(wheel);
    g.add(rot);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    return { update() { rot.rotation.y = f.ang; } };
  };

  // Hoodoos: banded sandstone columns with a dark capstone, springy to the ball.
  CV.bumpers = function (s, world, f) {
    const items = f.list.map((p, i) => {
      const g = new THREE.Group();
      const h = 0.9 + (i % 3) * 0.25;
      const col1 = mesh(rough(new THREE.CylinderGeometry(p.r * 0.7, p.r * 1.05, h, 12, 5), 40 + i, 0.18), stoneMat(1, 0.5));
      col1.position.y = h / 2;
      const neck = mesh(rough(new THREE.CylinderGeometry(p.r * 0.45, p.r * 0.7, 0.3, 10, 2), 50 + i, 0.15), stoneMat(1, 0.2, '#ffd0b0'));
      neck.position.y = h + 0.15;
      const cap = mesh(rough(new THREE.DodecahedronGeometry(p.r * 1.0, 1), 60 + i, 0.2), M('#7a5040', { roughness: 0.95, flatShading: true }));
      cap.scale.y = 0.42; cap.position.y = h + 0.38;
      g.add(col1, neck, cap);
      world.holeGroup.add(at(g, p.x, p.y, world.sim.groundRaw(p.x, p.y)));
      g.rotation.y = i * 1.3;
      return g;
    });
    return {
      update(t, dt, s2) {
        const tt = now(t, s2);
        f.list.forEach((p, i) => {
          const k = tt - p.hit;
          const s3 = k >= 0 && k < 0.4 ? 1 + Math.sin(k * 30) * 0.08 * (1 - k / 0.4) : 1;
          items[i].scale.set(s3, 2 - s3, s3);
        });
      },
    };
  };

  // A natural arch over the lane; its legs are the two sandstone posts.
  CV.arch = function (s, world) {
    const half = s.span / 2;
    const sh = new THREE.Shape();
    sh.moveTo(-half - 0.6, -0.4); sh.lineTo(-half - 0.66, 1.1);
    sh.bezierCurveTo(-half - 0.6, 2.4, -half * 0.4, 2.9, 0, 2.85);
    sh.bezierCurveTo(half * 0.45, 2.85, half + 0.62, 2.5, half + 0.66, 1.1);
    sh.lineTo(half + 0.6, -0.4); sh.lineTo(half - 0.5, -0.4); sh.lineTo(half - 0.44, 0.9);
    sh.bezierCurveTo(half - 0.5, 1.75, half * 0.3, 2.05, 0, 2.02);
    sh.bezierCurveTo(-half * 0.35, 2.0, -half + 0.48, 1.75, -half + 0.44, 0.9);
    sh.lineTo(-half + 0.5, -0.4); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 2, curveSegments: 18, steps: 2 });
    geo.translate(0, 0, -0.5);
    rough(geo, 91, 0.1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) * (1 + 0.25 * Math.sin(x * 2.1 + 1) * Math.cos(y * 1.7))); }
    geo.computeVertexNormals();
    const m = mesh(geo, stoneMat(0.45, 0.45, '#f4d2b8'));
    world.holeGroup.add(at(m, s.x, s.y, 0));
    return null;
  };

  // The oasis: palms and reeds round a spring-fed pool.
  function palm(world, x, y, h, lean, rnd) {
    const g = new THREE.Group();
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(Math.sin(lean) * h * t * t * 0.4, t * h, Math.cos(lean) * h * t * t * 0.4)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const trunk = mesh(new THREE.TubeGeometry(curve, 16, 0.14, 8, false), texMat(T.wood('#8a6a44'), 1, 6));
    g.add(trunk);
    const top = curve.getPoint(1);
    const frondMat = M('#4a8a3a', { side: THREE.DoubleSide, roughness: 0.8 });
    for (let i = 0; i < 9; i++) {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.quadraticCurveTo(0.9, 0.28, 2.0, 0); sh.quadraticCurveTo(0.9, -0.28, 0, 0);
      const fg = new THREE.ShapeGeometry(sh, 8);
      const p = fg.attributes.position;
      for (let k = 0; k < p.count; k++) { const fx = p.getX(k); p.setZ(k, -fx * fx * 0.18); }
      fg.computeVertexNormals();
      const fr = mesh(fg, frondMat, true);
      fr.rotation.set(-Math.PI / 2, 0.25 + rnd() * 0.35, 0);   // lay it flat, then droop it
      const hh = new THREE.Group(); hh.add(fr); hh.position.copy(top); hh.rotation.y = (i / 9) * TAU + rnd() * 0.3;
      g.add(hh);
    }
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.SphereGeometry(0.1, 8, 6), M('#6a4a2a')); const a = (i / 4) * TAU; c.position.set(top.x + Math.cos(a) * 0.15, top.y - 0.12, top.z + Math.sin(a) * 0.15); g.add(c); }
    world.holeGroup.add(at(g, x, y, GY()));
    return g;
  }
  CV.oasis = function (s, world) {
    const rnd = U.rng(5);
    const hole = world.hole;
    const clear = (x, y, m) => hole.floors.every(f => !U.inPoly(x, y, f.poly) && U.distToPoly(x, y, f.poly) > m);
    const palms = [];
    for (let i = 0; i < 40 && palms.length < 6; i++) {
      const a = (i / 40) * TAU * 3 + rnd(), d = 6.2 + rnd() * 3;
      const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d;
      if (!clear(x, y, 1.0) || y < s.y - 4) continue;
      palms.push(palm(world, x, y, 3.8 + rnd() * 2.2, Math.atan2(x - s.x, -(y - s.y)) + (rnd() - 0.5) * 0.5, rnd));
    }
    // reeds and a ring of green round the edge of the green
    const reeds = [], green = [];
    for (let i = 0; i < 220; i++) {
      const a = rnd() * TAU, d = 5.2 + rnd() * 2.5, x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d;
      if (!clear(x, y, 0.25)) continue;
      const s2 = 0.12 + rnd() * 0.16;
      if (rnd() < 0.35) reeds.push({ x, y: GY() + 0.35, z: -y, sx: 0.025, sy: 0.7 + rnd() * 0.5, sz: 0.025, rx: (rnd() - 0.5) * 0.3, rz: (rnd() - 0.5) * 0.3, c: rnd() < 0.5 ? '#6a8a3a' : '#8a9a4a' });
      else green.push({ x, y: GY() + s2 * 0.5, z: -y, sx: s2 * 0.7, sy: s2, sz: s2 * 0.7, ry: rnd() * 6, c: ['#4a7a2c', '#5a8434', '#3e6a26'][i % 3] });
    }
    VIS.instanced(world, new THREE.CylinderGeometry(1, 1, 1, 4), new THREE.MeshStandardMaterial({ roughness: 0.9 }), reeds, false);
    VIS.instanced(world, new THREE.ConeGeometry(1, 1, 6, 1, true), new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), green, false);
    return { update(t) { palms.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.7 + i) * 0.02; }); } };
  };

  // The ghost town: false-front buildings with porches down both sides of main street.
  CV.town = function (s, world) {
    const hole = world.hole, box = hole.box, base = GY();
    const rnd = U.rng(21);
    const names = [['SALOON', '#7a3a24'], ['GENERAL STORE', '#3a5a6a'], ['SHERIFF', '#5a4a2a'], ['BANK', '#4a5a3a'], ['HOTEL', '#6a3a4a'], ['ASSAY OFFICE', '#5a4a3a']];
    const planks = woodMat('#8a6a48', 2, 1), porch = woodMat('#6a4a2c', 2, 1), dark = M('#2a1a10', { roughness: 1 });
    let n = 0;
    [-1, 1].forEach(side => {
      for (let i = 0; i < 3; i++) {
        const y = box.y0 + 3.4 + i * (box.h - 6) / 2, w = 4.6, d = 4, h = 2.6 + rnd() * 0.7, ff = h + 0.9 + rnd() * 0.5;
        const xEdge = side < 0 ? box.x0 - 2.8 : box.x1 + 2.8, x = xEdge + side * d / 2;
        const g = new THREE.Group();
        const body = mesh(new THREE.BoxGeometry(d, h, w), planks); body.position.y = h / 2;
        const roof = mesh(new THREE.BoxGeometry(d + 0.2, 0.12, w + 0.2), dark); roof.position.y = h;
        const front = mesh(new THREE.BoxGeometry(0.14, ff, w + 0.3), planks); front.position.set(-side * d / 2, ff / 2, 0);
        const [name, bg] = names[n++ % names.length];
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 0.6), new THREE.MeshStandardMaterial({ map: boardTex(name, bg, '#f4e0b0'), roughness: 0.9 }));
        sign.position.set(-side * (d / 2 + 0.08), ff - 0.55, 0); sign.rotation.y = -side * Math.PI / 2;
        g.add(body, roof, front, sign);
        // windows and a door on the street side
        [-1.4, 1.4].forEach(z => { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), M('#1a1a20', { roughness: 0.2, metalness: 0.4 })); win.position.set(-side * (d / 2 + 0.075), 1.4, z); win.rotation.y = -side * Math.PI / 2; g.add(win); });
        const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), dark); door.position.set(-side * (d / 2 + 0.075), 0.85, 0); door.rotation.y = -side * Math.PI / 2; g.add(door);
        // a porch roof on posts, and a boardwalk
        const deck = mesh(new THREE.BoxGeometry(1.1, 0.1, w + 0.3), porch); deck.position.set(-side * (d / 2 + 0.6), 0.05, 0);
        const awn = mesh(new THREE.BoxGeometry(1.3, 0.07, w + 0.3), porch); awn.position.set(-side * (d / 2 + 0.65), 2.15, 0); awn.rotation.z = side * 0.12;
        g.add(deck, awn);
        [-w / 2, 0, w / 2].forEach(z => { const p = mesh(new THREE.BoxGeometry(0.09, 2.15, 0.09), porch); p.position.set(-side * (d / 2 + 1.15), 1.07, z); g.add(p); });
        // a loose board or two
        if (rnd() < 0.6) { const b = mesh(new THREE.BoxGeometry(0.05, 0.9, 0.18), planks); b.position.set(-side * (d / 2 + 0.09), 2.0, 1.4); b.rotation.x = 0.5; g.add(b); }
        world.holeGroup.add(at(g, x, y, base));
      }
    });
    // a water tower at the end of the street
    const tw = new THREE.Group();
    const tank = mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.8, 16), woodMat('#7a5a3a', 3, 1)); tank.position.y = 4.4;
    const cone = mesh(new THREE.ConeGeometry(1.45, 0.7, 16), dark); cone.position.y = 5.65;
    tw.add(tank, cone);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4, l = mesh(new THREE.BoxGeometry(0.14, 3.6, 0.14), porch); l.position.set(Math.cos(a) * 1.0, 1.8, Math.sin(a) * 1.0); tw.add(l); }
    world.holeGroup.add(at(tw, box.x1 + 3.5, box.y1 + 4, base));
    return null;
  };

  // Sunset Mesa's cliff faces are drawn by the world with every other ledge.
  CV.mesa = () => null;
})(window.PC);
