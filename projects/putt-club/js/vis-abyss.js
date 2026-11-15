/* Putt Club: how the Abyss looks. The hellscape around each hole, and hell versions of the moving parts
   (PC.VIS.abyss[type] is used instead of PC.VIS[type] when a hole's look.theme is 'abyss'). */
(function (PC) {
  'use strict';
  const U = PC.U, C = PC.C, T = PC.TEX, TAU = U.TAU;
  const col = PC.col, V = PC.V;
  const VIS = PC.VIS;
  const AV = VIS.abyss = {};

  const M = (hex, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: 0.8 }, o || {}));
  const glowM = (hex, k = 1) => new THREE.MeshStandardMaterial({ color: col(hex), emissive: col(hex), emissiveIntensity: k, roughness: 0.5 });
  const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
  const at = (o, x, y, h) => { o.position.copy(V(x, y, h)); return o; };
  const basaltMat = (k = 1) => { const b = T.magmaRock(); return new THREE.MeshStandardMaterial({ map: b.map, emissiveMap: b.glow, emissive: col('#ff6a1a'), emissiveIntensity: 1.3 * k, roughness: 0.9 }); };
  const plainStone = () => new THREE.MeshStandardMaterial({ map: T.templeStone(), roughness: 0.9 });
  const rockGeo = (r, seed) => {
    const g = new THREE.DodecahedronGeometry(r, 1), rnd = U.rng(seed), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.82 + rnd() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
    g.computeVertexNormals();
    return g;
  };
  const ember = (world, x, y, h, o = {}) => world.glow.spawn(Object.assign({ x, y: h, z: -y, vx: (Math.random() - 0.5) * 0.3, vy: 0.6 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.3, g: 0.2, drag: 0.99, life: 1.6 + Math.random(), size: 0.05 + Math.random() * 0.04, color: col(Math.random() < 0.5 ? '#ff7a2a' : '#ffc04a'), wobble: 0.6, seed: Math.random() * 9 }, o));

  // ---------- The temple: an underground volcanic temple suspended over a lava abyss ----------
  const stoneMat = (rx = 1, ry = 1, colr = '#ffffff') => { const t = T.templeStone().clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial({ map: t, color: col(colr), roughness: 0.88 }); };
  const runeMat = (rx, k = 1.6) => { const r = T.runeBand(); const m = r.map.clone(), g = r.glow.clone(); m.needsUpdate = g.needsUpdate = true; m.repeat.set(rx, 1); g.repeat.set(rx, 1); return new THREE.MeshStandardMaterial({ map: m, emissiveMap: g, emissive: col('#ff7a2a'), emissiveIntensity: k, roughness: 0.7 }); };

  // Join geometries that share one material (each with its own transform) into one mesh.
  function mergeGeos(parts) {
    const pos = [], nrm = [], uv = [];
    parts.forEach(({ g, m }) => {
      const n = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
      const p = n.attributes.position.array, q = n.attributes.normal.array, u = n.attributes.uv ? n.attributes.uv.array : null;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nrm.push(q[i]); }
      for (let i = 0; i < p.length / 3; i++) { uv.push(u ? u[i * 2] : 0, u ? u[i * 2 + 1] : 0); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }
  const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  VIS.mergeGeos = mergeGeos; VIS.M4 = M4;

  // A ruined island: a floor slab on a rocky root, with broken columns, an arch, a wall and steps.
  function ruinIsland(rnd, r) {
    const parts = [];
    const add = (g, m) => parts.push({ g, m });
    add(new THREE.CylinderGeometry(r, r * 0.92, 0.7, 9), M4(0, -0.35, 0));
    add(new THREE.CylinderGeometry(r * 0.88, r * 0.94, 0.3, 9), M4(0, -0.85, 0));
    const col1 = (x, z, h, rr) => { add(new THREE.CylinderGeometry(rr, rr * 1.08, h, 10), M4(x, h / 2, z)); add(new THREE.BoxGeometry(rr * 2.6, 0.25, rr * 2.6), M4(x, 0.12, z)); };
    const kind = Math.floor(rnd() * 3);
    if (kind === 0) {
      // an arch between two columns, and a broken one
      const w = r * 0.9, h = 3 + rnd() * 1.5;
      col1(-w / 2, 0, h, 0.32); col1(w / 2, 0, h, 0.32);
      add(new THREE.BoxGeometry(w + 1, 0.5, 0.8), M4(0, h + 0.25, 0));
      col1(r * 0.4, r * 0.5, 1 + rnd() * 1.2, 0.3);
    } else if (kind === 1) {
      // a colonnade with columns at different heights, one fallen
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + rnd(); col1(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, i === 0 ? 4 : 0.8 + rnd() * 2.6, 0.3); }
      add(new THREE.CylinderGeometry(0.3, 0.3, 3.2, 10), M4(0, 0.3, 0, 0, rnd() * 3, Math.PI / 2));
    } else {
      // a wall with a doorway, and steps up to it
      const w = r * 1.3, h = 2.6 + rnd();
      add(new THREE.BoxGeometry(w * 0.36, h, 0.6), M4(-w * 0.32, h / 2, 0));
      add(new THREE.BoxGeometry(w * 0.36, h * (0.6 + rnd() * 0.3), 0.6), M4(w * 0.32, h * 0.35, 0));
      add(new THREE.BoxGeometry(w * 0.3, 0.5, 0.6), M4(-w * 0.1, h - 0.25, 0));
      for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(w * 0.4, 0.2, 0.5), M4(0, 0.1 + i * 0.2, 0.6 + (2 - i) * 0.4));
    }
    return mergeGeos(parts);
  }

  VIS.decorateAbyss = function (hole, world) {
    const rnd = U.rng(U.hash(hole.id) + 7);
    const box = hole.box, G = world.holeGroup;
    const cx = box.cx, cy = box.cy;
    const R = Math.hypot(box.w, box.h) / 2;
    const Rc = Math.max(70, R + 46);
    const fwd = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    const behind = a => Math.abs(U.wrapAngle(a - (fwd + Math.PI))) < 1.0;   // where the camera usually sits
    const polys = hole.floors.map(f => f.poly).concat(hole.hazards.map(z => z.poly));
    const clearOf = (x, y, m) => polys.every(P => !U.inPoly(x, y, P) && U.distToPoly(x, y, P) > m);
    const P = (a, d) => [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
    const SEA = -62;

    // --- The cavern: obsidian cliffs all round, and a ceiling hung with stalactites ---
    const cliff = new THREE.CylinderGeometry(Rc, Rc * 1.18, 130, 72, 22, true);
    const cp = cliff.attributes.position, colors = [];
    const ph = [rnd() * 9, rnd() * 9, rnd() * 9];
    const lowC = col('#ff9a5a'), highC = col('#8a7a8e');
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
      const a = Math.atan2(z, x);
      const n = 0.55 * Math.sin(a * 5 + ph[0] + y * 0.02) + 0.3 * Math.sin(a * 13 + ph[1] + y * 0.05) + 0.15 * Math.sin(a * 31 + ph[2] - y * 0.09) + 0.12 * Math.sin(y * 0.35 + a * 3);
      const k = 1 + 0.13 * n;
      cp.setXYZ(i, x * k, y, z * k);
      const t = U.smooth(-60, 5, y);
      const c = lowC.clone().lerp(highC, t);
      colors.push(c.r, c.g, c.b);
    }
    cliff.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    cliff.computeVertexNormals();
    const ct = T.cliff().clone(); ct.needsUpdate = true; ct.repeat.set(14, 5);
    const cliffMesh = new THREE.Mesh(cliff, new THREE.MeshStandardMaterial({ map: ct, vertexColors: true, roughness: 0.62, metalness: 0.08, side: THREE.BackSide }));
    cliffMesh.position.set(cx, 1, -cy);
    G.add(cliffMesh);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(Rc * 1.25, 48, 12, 0, Math.PI * 2, 0, 0.62), new THREE.MeshStandardMaterial({ map: ct, color: col('#4a4050'), roughness: 0.8, metalness: 0.05, side: THREE.BackSide }));
    dome.position.set(cx, 66 - Rc * 1.25 * Math.cos(0.62) * 0.25, -cy);
    G.add(dome);
    const stal = [];
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, d = 10 + Math.sqrt(rnd()) * (Rc - 12);
      const [x, y] = P(a, d), L = 5 + rnd() * 16, r = 0.8 + rnd() * 2.2;
      stal.push({ x, y: 64 - L / 2 - (d / Rc) * 18, z: -y, sx: r, sy: L, sz: r, rx: Math.PI, ry: rnd() * 6 });
    }
    VIS.instanced(world, new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ map: ct, color: col('#6a5c6a'), roughness: 0.7, metalness: 0.05 }), stal, false);

    // --- Lava waterfalls pouring down the cliffs into the abyss ---
    const fallTex = T.lavaFall().clone(); fallTex.needsUpdate = true; fallTex.repeat.set(1, 5);
    const fallMat = new THREE.MeshBasicMaterial({ map: fallTex, color: col('#ffffff'), side: THREE.DoubleSide });
    const glowMat = new THREE.MeshBasicMaterial({ map: T.fade(), color: col('#ff6a1a'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const falls = [];
    [fwd + 0.75, fwd - 0.95, fwd + 1.9, fwd - 2.05].forEach((a, i) => {
      const d = Rc * 0.92, [x, y] = P(a, d), top = 18 + rnd() * 18, w = i < 2 ? 5 + rnd() * 2 : 3.5 + rnd() * 2;
      const h = top - SEA;
      const g = new THREE.Group();
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 8), fallMat);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 3.2, h), glowMat);
      halo.position.z = -0.6;
      // a dark overhang of rock that the lava spills out of
      const mouth = new THREE.Mesh(new THREE.DodecahedronGeometry(w * 0.9, 1), new THREE.MeshStandardMaterial({ map: ct, color: col('#6a5a62'), roughness: 0.8 }));
      mouth.scale.set(1.4, 0.7, 1); mouth.position.set(0, h / 2 + w * 0.35, -0.4);
      const spill = new THREE.Mesh(new THREE.CircleGeometry(w * 0.55, 16, 0, Math.PI), glowM('#ffb04a', 2.2));
      spill.position.set(0, h / 2 - 0.2, 0.05); spill.rotation.z = Math.PI;
      // a cloud of glowing mist where it meets the lake
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(w * 4, 14), new THREE.MeshBasicMaterial({ map: T.dot(), color: col('#ff7a2a'), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      mist.position.set(0, -h / 2 + 2, 0.4);
      g.add(halo, sheet, mouth, spill, mist);
      g.position.set(x, SEA + h / 2, -y);
      g.lookAt(cx, SEA + h / 2, -cy);
      G.add(g);
      falls.push({ x, y, w });
    });
    // Two lights stand by the biggest falls; one glows up from the wheel below the course.
    world.pts[0].position.set(cx, -20, -cy); world.pts[0].intensity = 2.2; world.pts[0].distance = 95; world.pts[0].color = col('#ff6a1a');
    [0, 1].forEach(i => { const f = falls[i], [x, y] = [cx + (f.x - cx) * 0.8, cy + (f.y - cy) * 0.8]; const l = world.pts[i + 1]; l.position.set(x, -6, -y); l.intensity = 2.0; l.distance = 120; l.color = col('#ff7a2a'); });

    // --- The temple facade carved into the cliff ahead ---
    {
      const a = fwd, d = Rc * 0.8, [x, y] = P(a, d);
      const g = new THREE.Group();
      const sm = stoneMat(4, 4, '#bfb4b6');
      const W = 34, H = 26;
      for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(W + 6 - i * 2, 1.2, 3 - i * 0.4), sm); st.position.set(0, -14 + i * 1.2, 1.5 + (3 - i) * 0.8); g.add(st); }
      for (let i = 0; i < 6; i++) {
        if (i === 2 || i === 3) continue;
        const cxm = -W / 2 + 3 + i * (W - 6) / 5;
        const c1 = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, H - 4, 14), sm); c1.position.set(cxm, -10 + (H - 4) / 2, 1.6); g.add(c1);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 1.2, 14, 1, true), runeMat(2, 1.2)); band.position.set(cxm, -4 + i % 2 * 5, 1.6); g.add(band);
      }
      const ent = new THREE.Mesh(new THREE.BoxGeometry(W, 2.6, 3.4), sm); ent.position.set(0, -10 + H - 4 + 1.3, 1.6); g.add(ent);
      const frieze = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, 1.6), runeMat(9, 1.8)); frieze.position.set(0, -10 + H - 4 + 1.3, 3.32); g.add(frieze);
      const ped = new THREE.Shape(); ped.moveTo(-W / 2 - 0.5, 0); ped.lineTo(W / 2 + 0.5, 0); ped.lineTo(0, 6); ped.closePath();
      const pm = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 3, bevelEnabled: false }), sm); pm.position.set(0, -10 + H - 1.4, 0.1); g.add(pm);
      const back = new THREE.Mesh(new THREE.BoxGeometry(W + 2, H + 6, 1), stoneMat(5, 4, '#7a7072')); back.position.set(0, -10 + H / 2, -0.6); g.add(back);
      // the doorway glows from deep inside
      const door = new THREE.Mesh(new THREE.PlaneGeometry(7, 13), new THREE.MeshBasicMaterial({ color: col('#ff7a2a'), map: T.fade(), transparent: true }));
      door.position.set(0, -10 + 6.5, 0.0); g.add(door);
      const doorFrame = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.45, 8, 24, Math.PI), runeMat(6, 2)); doorFrame.position.set(0, -10 + 9, 0.3); g.add(doorFrame);
      g.position.set(x, 0, -y);
      g.lookAt(cx, 0, -cy);
      G.add(g);
    }

    // --- Giant runic pillars rising out of the abyss ---
    const pillars = [];
    const nP = 6;
    for (let i = 0; i < nP * 4 && pillars.length < nP; i++) {
      const a = fwd + (i / (nP * 4)) * Math.PI * 2 + rnd() * 0.2;
      if (behind(a)) continue;
      const d = R + 15 + rnd() * 16;
      const [x, y] = P(a, d);
      if (!clearOf(x, y, 6) || pillars.some(p => Math.hypot(p.x - x, p.y - y) < 14)) continue;
      pillars.push({ x, y, r: 1.5 + rnd() * 0.8, top: 3 + rnd() * 6 });
    }
    pillars.forEach((p, i) => {
      const g = new THREE.Group();
      const h = p.top - SEA;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 1.12, h, 12), stoneMat(3, h / 4));
      shaft.position.y = SEA + h / 2; g.add(shaft);
      // runes only in carved bands, so they read as part of the pillar
      [p.top - 2.5, p.top - 9, p.top - 17, p.top - 26].forEach((yy, k) => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.06, p.r * 1.06, 1.5, 24, 1, true), runeMat(3, k === 0 ? 2.2 : 1.4));
        band.position.y = yy; g.add(band);
      });
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.5, p.r * 1.15, 1.2, 12), stoneMat(3, 1, '#d0c4c4')); cap.position.y = p.top + 0.6; g.add(cap);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 1.1, p.r * 0.7, 0.8, 12, 1, true), M('#3a2c28', { metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide })); bowl.position.y = p.top + 1.6; g.add(bowl);
      const coals = new THREE.Mesh(new THREE.CircleGeometry(p.r * 1.0, 16).rotateX(-Math.PI / 2), glowM('#ff8a2a', 2.4)); coals.position.y = p.top + 1.7; g.add(coals);
      g.position.set(p.x, 0, -p.y);
      G.add(g);
      p.fire = p.top + 1.8;
    });

    // --- Ruined islands drifting around the course ---
    const islands = [];
    for (let i = 0; i < 80 && islands.length < 8; i++) {
      const a = rnd() * Math.PI * 2;
      if (behind(a)) continue;
      const d = R + 6 + rnd() * 26, [x, y] = P(a, d);
      const r = 2 + rnd() * 2.2;
      if (!clearOf(x, y, r + 3) || pillars.some(p => Math.hypot(p.x - x, p.y - y) < r + 4) || islands.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + 3)) continue;
      islands.push({ x, y, r, h: -1.5 - rnd() * 8 });
    }
    const ruinMat = stoneMat(1.2, 1.2, '#c8bcbc');
    const rootMat = new THREE.MeshStandardMaterial({ map: ct, color: col('#7a6c74'), roughness: 0.75, metalness: 0.05 });
    islands.forEach(q => {
      const m = new THREE.Mesh(ruinIsland(rnd, q.r), ruinMat);
      m.position.set(q.x, q.h, -q.y); m.rotation.y = rnd() * 6; m.castShadow = true; m.receiveShadow = true;
      G.add(m);
      const root = new THREE.Mesh(new THREE.ConeGeometry(q.r * 0.9, q.r * 3, 8), rootMat);
      root.rotation.x = Math.PI; root.position.set(q.x, q.h - 1 - q.r * 1.5, -q.y);
      G.add(root);
    });

    // --- Columns holding up the course itself ---
    const cols = [];
    hole.floors.forEach(f => {
      const b = U.bounds([f.poly]);
      const long = Math.max(b.w, b.h), thin = Math.min(b.w, b.h);
      if (thin < 2.2 && long < 9) return;   // corner pads and short bridges hang off their neighbours
      const r = thin < 2.2 ? 0.45 : Math.min(0.95, Math.max(0.55, thin * 0.2));
      const n = Math.max(1, Math.round(long / 11));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = b.w >= b.h ? b.x0 + b.w * t : b.cx, y = b.w >= b.h ? b.cy : b.y0 + b.h * t;
        if (!U.inPoly(x, y, f.poly)) continue;
        cols.push({ x, y: (-1.5 + SEA) / 2, z: -y, sx: r, sy: -1.5 - SEA, sz: r });
        cols.push({ x, y: -1.75, z: -y, sx: r * 1.9, sy: 0.5, sz: r * 1.9 });
      }
    });
    VIS.instanced(world, new THREE.CylinderGeometry(1, 1, 1, 10), stoneMat(1, 8, '#a89c9c'), cols.filter(c => c.sy > 1), false);
    VIS.instanced(world, new THREE.BoxGeometry(1, 1, 1), stoneMat(1, 1, '#a89c9c'), cols.filter(c => c.sy <= 1), false);

    // --- The centerpiece: a colossal rune wheel turning slowly in the abyss below the course ---
    const wheel = new THREE.Group();
    const WR = Math.max(16, R * 0.9);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(WR, 1.4, 12, 96), stoneMat(24, 1, '#b8acac'));
    ring.rotation.x = Math.PI / 2; wheel.add(ring);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(WR + 1.45, WR + 1.45, 1.3, 96, 1, true), runeMat(26, 2)); wheel.add(band);
    const discTex = T.runes();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(WR - 1, 96), new THREE.MeshStandardMaterial({ map: discTex, emissiveMap: discTex, emissive: col('#ff6a1a'), emissiveIntensity: 1.5, roughness: 0.8 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; wheel.add(disc);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(WR * 1.6, 48), new THREE.MeshBasicMaterial({ map: T.dot(), color: col('#ff5a10'), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = -0.5; wheel.add(halo);
    wheel.position.set(cx, -30, -cy);
    G.add(wheel);
    // great chains from the wheel to the cliffs
    const linkGeo = new THREE.TorusGeometry(0.7, 0.2, 6, 12);
    const links = [];
    [fwd + 0.4, fwd + 2.1, fwd - 1.2, fwd - 2.7].forEach(a => {
      const x0 = cx + Math.cos(a) * (WR + 1), y0 = cy + Math.sin(a) * (WR + 1), x1 = cx + Math.cos(a) * Rc * 0.9, y1 = cy + Math.sin(a) * Rc * 0.9;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.1);
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = U.lerp(x0, x1, t), y = U.lerp(y0, y1, t), h = U.lerp(-30, 2, t) - Math.sin(Math.PI * t) * 9;
        links.push({ x, y: h, z: -y, ry: -a + Math.PI / 2, rx: k % 2 ? Math.PI / 2 : 0, rz: 0.2 * Math.sin(t * 9) });
      }
    });
    VIS.instanced(world, linkGeo, M('#3a3236', { metalness: 0.8, roughness: 0.4 }), links, false);

    // --- Light falling through cracks in the ceiling ---
    const shaftMat = new THREE.MeshBasicMaterial({ map: T.fade(), color: col('#ffc08a'), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    islands.slice(0, 2).concat(pillars.slice(0, 1)).forEach(q => {
      const h = 64 - (q.h || q.top);
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 5.5, h, 20, 1, true), shaftMat);
      sh.position.set(q.x, 64 - h / 2, -q.y);
      G.add(sh);
    });

    VIS.sign(hole, world, world.sim, true);

    let emb = 0, smk = 0;
    world.vis.push({
      update(t, dt) {
        wheel.rotation.y = t * 0.035;
        disc.material.emissiveIntensity = 1.35 + Math.sin(t * 0.9) * 0.25;
        band.material.emissiveIntensity = 1.8 + Math.sin(t * 0.9 + 1) * 0.4;
        fallTex.offset.set(0, t * 0.9);
        world.pts[0].intensity = 2.0 + Math.sin(t * 0.9) * 0.3;
        // embers rising from the abyss and from the pillar fires
        emb += dt;
        while (emb > 0.03) {
          emb -= 0.03;
          const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * (R + 30);
          world.glow.spawn({ x: cx + Math.cos(a) * d, y: -14 + Math.random() * 10, z: -(cy + Math.sin(a) * d), vx: (Math.random() - 0.5) * 0.4, vy: 1.4 + Math.random() * 1.8, vz: (Math.random() - 0.5) * 0.4, g: 0, drag: 1, life: 7 + Math.random() * 4, size: 0.07 + Math.random() * 0.06, color: col(Math.random() < 0.6 ? '#ff7a2a' : '#ffc04a'), wobble: 0.5, seed: Math.random() * 9 });
          if (Math.random() < 0.35 && pillars.length) { const p = pillars[Math.floor(Math.random() * pillars.length)]; world.glow.spawn({ x: p.x + (Math.random() - 0.5) * p.r, y: p.fire, z: -p.y + (Math.random() - 0.5) * p.r, vx: 0, vy: 2 + Math.random() * 1.5, vz: 0, g: 0.6, life: 0.7 + Math.random() * 0.4, size: 0.35 + Math.random() * 0.3, grow: -0.6, color: col(Math.random() < 0.5 ? '#ff8a2a' : '#ffd25a') }); }
        }
        // slow smoke from the lava, which the fog turns into haze
        smk += dt;
        while (smk > 0.18) {
          smk -= 0.18;
          const a = Math.random() * Math.PI * 2, d = Math.random() * (R + 40);
          world.smoke.spawn({ x: cx + Math.cos(a) * d, y: SEA + 6, z: -(cy + Math.sin(a) * d), vx: 0.3, vy: 2.4 + Math.random(), vz: 0, g: 0, drag: 1, life: 16, size: 9 + Math.random() * 8, grow: 1.2, color: col('#3a2622'), a: 0.22 });
        }
      },
    });
  };

  // ---------- Hell versions of the moving parts ----------
  AV.gates = function (s, world, f) {
    const iron = M('#2a2426', { metalness: 0.7, roughness: 0.45 });
    const items = f.list.map(g => {
      const dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1], len = Math.hypot(dx, dy);
      const grp = new THREE.Group();
      const port = new THREE.Group();
      for (let i = 0; i <= 5; i++) { const bar = mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), iron); bar.position.set(-len / 2 + (i * len) / 5, 0.38, 0); port.add(bar); const tip = mesh(new THREE.ConeGeometry(0.045, 0.12, 6), iron); tip.rotation.z = Math.PI; tip.position.set(bar.position.x, -0.04, 0); port.add(tip); }
      [0.18, 0.55].forEach(h => { const cb = mesh(new THREE.BoxGeometry(len, 0.05, 0.06), iron); cb.position.y = h; port.add(cb); });
      grp.add(port);
      [g.a, g.b].forEach(p => {
        const pil = mesh(new THREE.BoxGeometry(0.3, 1.5, 0.3), M('#1a1418', { roughness: 0.3, metalness: 0.2 }));
        pil.position.set((p === g.a ? -1 : 1) * (len / 2 + 0.05), 0.75, 0);
        grp.add(pil);
        const fire = mesh(new THREE.SphereGeometry(0.1, 8, 6), glowM('#ffb43a', 2.4), false);
        fire.position.set(pil.position.x, 1.6, 0); grp.add(fire);
      });
      grp.position.copy(V((g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2, 0));
      grp.rotation.y = Math.atan2(dy, dx);
      world.holeGroup.add(grp);
      return { g, port };
    });
    return { update() { items.forEach(it => { it.port.position.y = U.smooth(0, 1, it.g.open) * 0.85; }); } };
  };

  AV.spinner = function (s, world, f) {
    const g = new THREE.Group();
    const h0 = world.sim.groundRaw(s.x, s.y);
    const post = mesh(new THREE.CylinderGeometry(0.2, 0.26, s.h + 0.3, 10), M('#1e181c', { metalness: 0.5, roughness: 0.4 }));
    post.position.y = (s.h + 0.3) / 2; g.add(post);
    const skull = new THREE.Group();
    skull.add(mesh(new THREE.SphereGeometry(0.22, 14, 10), M('#e6dbc2')));
    [-1, 1].forEach(k => { const e = mesh(new THREE.SphereGeometry(0.05, 8, 6), glowM('#ff3a1a', 2.5), false); e.position.set(0.17, 0.02, k * 0.08); skull.add(e); });
    skull.position.y = s.h + 0.5; g.add(skull);
    const rot = new THREE.Group();
    for (let i = 0; i < s.arms; i++) {
      const hold = new THREE.Group();
      const blade = mesh(new THREE.BoxGeometry(s.len - 0.2, s.h * 0.75, 0.06), M('#2e2a2e', { metalness: 0.85, roughness: 0.3 }));
      blade.position.set((s.len + 0.2) / 2, s.h * 0.4, 0);
      const edge = mesh(new THREE.BoxGeometry(s.len - 0.2, 0.05, 0.08), glowM('#ff4a1a', 1.8), false);
      edge.position.set((s.len + 0.2) / 2, s.h * 0.78, 0);
      hold.add(blade, edge);
      hold.rotation.y = (i * TAU) / s.arms;
      rot.add(hold);
    }
    g.add(rot);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    return { update(t) { rot.rotation.y = f.ang; skull.rotation.y = Math.sin(t) * 0.4; } };
  };

  AV.patrol = function (s, world, f) {
    const models = f.movers.map((mv, i) => {
      const g = new THREE.Group();
      const red = M(i % 2 ? '#c62a1e' : '#a8201a', { roughness: 0.55 });
      const body = mesh(new THREE.SphereGeometry(0.22, 14, 10), red); body.scale.set(0.9, 1.1, 0.9); body.position.y = 0.3; g.add(body);
      const head = mesh(new THREE.SphereGeometry(0.16, 14, 10), red); head.position.set(0.04, 0.62, 0); g.add(head);
      [-1, 1].forEach(k => {
        const horn = mesh(new THREE.ConeGeometry(0.04, 0.18, 6), M('#1a1214')); horn.position.set(0.0, 0.78, k * 0.09); horn.rotation.x = k * 0.4; g.add(horn);
        const eye = mesh(new THREE.SphereGeometry(0.035, 8, 6), glowM('#ffd23f', 2.2), false); eye.position.set(0.14, 0.65, k * 0.06); g.add(eye);
        const wing = mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.1, 0.32), new THREE.Vector2(-0.34, 0.2), new THREE.Vector2(-0.22, 0.02)])), new THREE.MeshStandardMaterial({ color: col('#3a1218'), side: THREE.DoubleSide }));
        wing.position.set(-0.08, 0.38, k * 0.14); wing.rotation.y = k * 1.2; g.add(wing);
        const leg = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.14, 6), M('#1a1214')); leg.position.set(0.02, 0.07, k * 0.08); g.add(leg);
      });
      const tail = mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 12, Math.PI * 1.3), M('#1a1214')); tail.position.set(-0.22, 0.3, 0); tail.rotation.y = Math.PI / 2; g.add(tail);
      const fork = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6), M('#3a3036', { metalness: 0.6 })); fork.position.set(0.05, 0.45, 0.22); fork.rotation.x = 0.15; g.add(fork);
      world.holeGroup.add(g);
      return g;
    });
    return {
      update(t) {
        f.movers.forEach((mv, i) => {
          const g = models[i], sp = Math.hypot(mv.vx, mv.vy);
          g.position.copy(V(mv.x, mv.y, world.sim.groundRaw(mv.x, mv.y) + Math.abs(Math.sin(t * 10 + i)) * 0.05 * Math.min(1, sp)));
          if (sp > 0.02) g.rotation.y = Math.atan2(mv.vy, mv.vx);
          const hit = t - (mv.hit || -9), k = hit < 0.3 ? 1 + Math.sin(hit * 20) * 0.1 * (1 - hit / 0.3) : 1;
          g.scale.set(k, 2 - k, k);
        });
      },
    };
  };

  AV.bumpers = function (s, world, f) {
    const mats = [];
    const items = f.list.map((p, i) => {
      const mat = basaltMat(); mats.push(mat);
      const m = mesh(rockGeo(p.r * 1.05, i * 7 + 1), mat);
      m.scale.y = 0.9; m.rotation.set(i, i * 2, 0);
      world.holeGroup.add(at(m, p.x, p.y, world.sim.groundRaw(p.x, p.y) + p.r * 0.55));
      return m;
    });
    return {
      update(t) {
        f.list.forEach((p, i) => {
          const k = t - p.hit;
          const s2 = k < 0.4 ? 1 + Math.sin(k * 30) * 0.1 * (1 - k / 0.4) : 1;
          items[i].scale.set(s2, (2 - s2) * 0.9, s2);
          mats[i].emissiveIntensity = 1.2 + (k < 0.6 ? (1 - k / 0.6) * 3 : 0) + Math.sin(t * 2 + i) * 0.2;
        });
      },
    };
  };

  AV.launch = function (s, world, f) {
    const h0 = world.sim.groundRaw(s.x, s.y);
    const g = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(s.r * 0.95, 0.12, 8, 20), plainStone());
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.scale.z = 0.6;
    const core = mesh(new THREE.CircleGeometry(s.r * 0.85, 24), glowM('#ff7a1a', 2), false);
    core.rotation.x = -Math.PI / 2; core.position.y = 0.012;
    g.add(ring, core);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    let acc = 0, fired = -9;
    return {
      update(t, dt) {
        acc += dt;
        while (acc > 0.07) { acc -= 0.07; world.glow.spawn({ x: s.x + (Math.random() - 0.5) * 0.4, y: h0 + 0.05, z: -s.y + (Math.random() - 0.5) * 0.4, vx: 0, vy: 0.6 + Math.random() * 0.6, vz: 0, g: 0.1, life: 1.2, size: 0.18, grow: 2, color: col('#5a4a48'), a: 0.35 }); }
        if (f.hit > fired) {
          fired = f.hit;
          for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, sp = Math.random() * 1.2; world.glow.spawn({ x: s.x, y: h0 + 0.1, z: -s.y, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 4, vz: Math.sin(a) * sp, g: -9, life: 0.9, size: 0.08 + Math.random() * 0.06, color: col(Math.random() < 0.5 ? '#ff7a1a' : '#ffd25a') }); }
        }
        core.material.emissiveIntensity = 1.8 + Math.sin(t * 5) * 0.3 + (t - f.hit < 0.5 ? 2 : 0);
      },
    };
  };

  AV.ferry = function (s, world, f) {
    const raft = new THREE.Group();
    const top = mesh(new THREE.CylinderGeometry(s.r, s.r * 0.85, 0.22, 24), basaltMat(0.7));
    top.position.y = -0.11;
    raft.add(top);
    world.holeGroup.add(raft);
    return { update(t) { raft.position.copy(V(f.x, f.y, (s.h === undefined ? -0.03 : s.h) + 0.001)); raft.rotation.y = Math.sin(t * 0.5) * 0.2; } };
  };

  AV.tunnels = function (s, world, f) {
    const cols = ['#ff3df2', '#3dd6ff', '#ffd23f', '#7dff6a'];
    const swirls = [];
    s.pairs.forEach((p, i) => {
      [p.a, p.b].forEach(e => {
        const h = world.sim.groundRaw(e[0], e[1]);
        const g = new THREE.Group();
        const ring = mesh(new THREE.TorusGeometry(0.4, 0.06, 10, 32), glowM(cols[i % 4], 1.8), false);
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
        const disc = mesh(new THREE.CircleGeometry(0.36, 24), new THREE.MeshBasicMaterial({ map: T.cupShade() }), false);
        disc.rotation.x = -Math.PI / 2; disc.position.y = 0.012;
        const sw = mesh(new THREE.RingGeometry(0.12, 0.3, 24, 1, 0, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: col(cols[i % 4]), transparent: true, opacity: 0.6, side: THREE.DoubleSide }), false);
        sw.rotation.x = -Math.PI / 2; sw.position.y = 0.016;
        g.add(ring, disc, sw);
        world.holeGroup.add(at(g, e[0], e[1], h));
        swirls.push({ sw, e, h, c: col(cols[i % 4]) });
      });
    });
    let acc = 0;
    return {
      update(t, dt) {
        swirls.forEach((w, i) => { w.sw.rotation.z = t * (2 + (i % 2)); });
        acc += dt;
        while (acc > 0.08) { acc -= 0.08; const w = swirls[Math.floor(Math.random() * swirls.length)]; world.glow.spawn({ x: w.e[0] + (Math.random() - 0.5) * 0.5, y: w.h + 0.05, z: -w.e[1] + (Math.random() - 0.5) * 0.5, vx: 0, vy: 0.7, vz: 0, g: 0, life: 0.9, size: 0.06, color: w.c }); }
      },
    };
  };

  AV.swing = function (s, world, f) {
    // Hung on a chain that runs up out of sight to the cavern roof, so nothing stands in the way.
    const iron = M('#3a3236', { metalness: 0.6, roughness: 0.4 });
    const anchor = mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 16), iron);
    anchor.position.copy(V(s.x, s.y, s.zp)); anchor.rotation.y = Math.PI / 2;
    world.holeGroup.add(anchor);
    const up = mesh(new THREE.CylinderGeometry(0.045, 0.045, 60, 6), iron, false);
    up.position.copy(V(s.x, s.y, s.zp + 30.2));
    world.holeGroup.add(up);
    const chain = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), M('#5a5056', { metalness: 0.6, roughness: 0.35 }));
    const ball = new THREE.Group();
    ball.add(mesh(new THREE.SphereGeometry(s.rt * 0.75, 18, 14), M('#26222a', { metalness: 0.5, roughness: 0.4 })));
    for (let i = 0; i < 14; i++) { const a = Math.acos(1 - 2 * (i + 0.5) / 14), b = i * 2.4; const dir = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)); const sp = mesh(new THREE.ConeGeometry(0.06, 0.22, 6), M('#5a5258', { metalness: 0.5, roughness: 0.35 })); sp.position.copy(dir.clone().multiplyScalar(s.rt * 0.8)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); ball.add(sp); }
    world.holeGroup.add(chain, ball);
    return {
      update() {
        ball.position.copy(V(f.xc, s.y, f.zc)); ball.rotation.z = -f.th * 2;
        const top = V(s.x, s.y, s.zp), c = V(f.xc, s.y, f.zc), bot = c.clone().add(top.clone().sub(c).normalize().multiplyScalar(s.rt * 0.75));
        chain.position.copy(top.clone().add(bot).multiplyScalar(0.5));
        chain.scale.y = top.distanceTo(bot); chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
      },
    };
  };

  AV.turntable = function (s, world, f) {
    const g = new THREE.Group();
    const rt = T.runes();
    const disc = mesh(new THREE.CircleGeometry(s.r, 72), new THREE.MeshStandardMaterial({ map: rt, emissiveMap: rt, emissive: col('#ff6a1a'), emissiveIntensity: 1.2, roughness: 0.75 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.008;
    g.add(disc);
    // A carved stone rim round the wheel with a band of runes, and a glow rising off it.
    const rim = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ map: T.templeStone(), roughness: 0.85, color: col('#c8bcbc') });
    const lip = mesh(new THREE.TorusGeometry(s.r + 0.16, 0.12, 8, 80), glowM('#ff6a1a', 1.6), false);
    lip.rotation.x = -Math.PI / 2; lip.position.y = 0.01;
    rim.add(lip);
    const rb = T.runeBand();
    const band = mesh(new THREE.CylinderGeometry(s.r + 0.3, s.r + 0.3, 0.5, 80, 1, true), new THREE.MeshStandardMaterial({ map: rb.map, emissiveMap: rb.glow, emissive: col('#ff7a2a'), emissiveIntensity: 1.8, roughness: 0.7, side: THREE.DoubleSide }), false);
    band.position.y = -0.27;
    rim.add(band);
    const skirt = mesh(new THREE.CylinderGeometry(s.r + 0.32, s.r * 0.6, s.big ? 3.2 : 2.2, 48, 1, true), stone, false);
    skirt.position.y = -0.52 - (s.big ? 1.6 : 1.1);
    rim.add(skirt);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.big ? 3.2 : 2.2, 48, 1, true), new THREE.MeshBasicMaterial({ map: T.fade(), color: col('#ff6a1a'), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = s.big ? 1.2 : 0.9;
    rim.add(beam);
    world.holeGroup.add(at(rim, s.x, s.y, 0));
    const gap = mesh(new THREE.RingGeometry(s.r - 0.01, s.r + 0.04, 72), M('#120a08'), false);
    gap.rotation.x = -Math.PI / 2; gap.position.y = 0.006;
    world.holeGroup.add(at(gap, s.x, s.y, 0));
    const pots = (s.pots || []).map(p => {
      const pg = new THREE.Group();
      pg.add(mesh(new THREE.CylinderGeometry(p.r * 0.8, p.r, 0.55, 10), M('#e6dbc2', { map: T.bone() })));
      const sk = mesh(new THREE.SphereGeometry(p.r * 0.8, 12, 10), M('#e6dbc2')); sk.position.y = 0.7; pg.add(sk);
      [-1, 1].forEach(k => { const e = mesh(new THREE.SphereGeometry(0.05, 8, 6), glowM('#ff3a1a', 2.4), false); e.position.set(p.r * 0.62, 0.72, k * 0.09); pg.add(e); });
      g.add(pg);
      return pg;
    });
    world.holeGroup.add(at(g, s.x, s.y, 0));
    let acc = 0;
    return {
      update(t, dt) {
        disc.rotation.z = f.ang;
        disc.material.emissiveIntensity = 1.15 + Math.sin(t * 1.3) * 0.25;
        beam.material.opacity = 0.18 + Math.sin(t * 1.3) * 0.06;
        f.pots().forEach((p, i) => { pots[i].position.set(p.x - s.x, 0.27, -(p.y - s.y)); pots[i].rotation.y = f.ang; });
        acc += dt;
        while (acc > 0.08) { acc -= 0.08; const a = Math.random() * Math.PI * 2; world.glow.spawn({ x: s.x + Math.cos(a) * s.r, y: 0.05, z: -(s.y + Math.sin(a) * s.r), vx: 0, vy: 0.8 + Math.random() * 0.6, vz: 0, g: 0, life: 1.4, size: 0.06, color: col('#ffb04a') }); }
      },
    };
  };

  AV.brook = function (s, world, f) {
    const line = f.line, sim = world.sim, hw = s.width / 2;
    world.holeGroup.add(mesh(PC.surfaceGeometry(U.ribbon(line, hw * 0.9), (x, y) => sim.floorHeight(x, y), { lift: 0.005, uv: (x, y) => [x / 1.5, y / 1.5], cell: 0.15 }), new THREE.MeshStandardMaterial({ map: T.ash(), roughness: 1 }), false));
    const pos = [], uv = [];
    let acc = 0;
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      if (i > 0) acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      const c = line[i], wy = sim.floorHeight(c[0], c[1]) + 0.06, w = hw * 0.8;
      pos.push(c[0] + nx * w, wy, -(c[1] + ny * w), c[0] - nx * w, wy, -(c[1] - ny * w));
      uv.push(0, acc / 1.5, 1, acc / 1.5);
    }
    const idx = [];
    for (let i = 0; i < line.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const lt = T.lava().clone(); lt.needsUpdate = true; lt.repeat.set(1, 1);
    const flow = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: lt, emissiveMap: lt, emissive: col('#ff6a1a'), emissiveIntensity: 0.6, transparent: true, opacity: 0.55, depthWrite: false, color: col('#b0a8a0') }));
    flow.renderOrder = 2;
    world.holeGroup.add(flow);
    let e = 0;
    return {
      update(t, dt) {
        lt.offset.set(0, -t * 0.3);
        e += dt;
        while (e > 0.1) { e -= 0.1; const i = Math.floor(Math.random() * (line.length - 2)), c = line[i], n = line[i + 1], l = Math.hypot(n[0] - c[0], n[1] - c[1]) || 1; ember(world, c[0], c[1], sim.floorHeight(c[0], c[1]) + 0.08, { vx: (n[0] - c[0]) / l * 0.9, vz: -(n[1] - c[1]) / l * 0.9, vy: 0.2, life: 1.5 }); }
      },
    };
  };

  AV.rockery = function (s, world) {
    // the volcano: basalt over the slopes, a glowing crater rim and smoke
    const sim = world.sim;
    const ring = U.circle(s.x, s.y, 4.4, 64), inner = U.circle(s.x, s.y, 0.75, 32);
    const geo = PC.surfaceGeometry(ring, (x, y) => sim.floorHeight(x, y), { lift: 0.004, uv: (x, y) => [x / 2, y / 2], cell: 0.25 });
    // cut the crater out of the slope overlay by dropping triangles inside it
    const p = geo.attributes.position.array, keep = [], nrm = geo.attributes.normal.array, uvs = geo.attributes.uv.array, kn = [], ku = [];
    for (let i = 0; i < p.length; i += 9) {
      const cx = (p[i] + p[i + 3] + p[i + 6]) / 3, cy = -(p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      if (U.inPoly(cx, cy, inner)) continue;
      for (let k = 0; k < 9; k++) { keep.push(p[i + k]); kn.push(nrm[i + k]); }
      const u = (i / 3) * 2; for (let k = 0; k < 6; k++) ku.push(uvs[u + k]);
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    g2.setAttribute('normal', new THREE.Float32BufferAttribute(kn, 3));
    g2.setAttribute('uv', new THREE.Float32BufferAttribute(ku, 2));
    world.holeGroup.add(mesh(g2, basaltMat(), false));
    const rim = mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 40), glowM('#ff6a1a', 1.8), false);
    rim.rotation.x = -Math.PI / 2;
    world.holeGroup.add(at(rim, s.x, s.y, sim.floorHeight(s.x + 0.75, s.y) + 0.02));
    let acc = 0;
    return { update(t, dt) { acc += dt; while (acc > 0.09) { acc -= 0.09; const a = Math.random() * TAU; world.glow.spawn({ x: s.x + Math.cos(a) * 0.6, y: 1.1, z: -(s.y + Math.sin(a) * 0.6), vx: 0, vy: 0.8, vz: 0, g: 0.1, life: 2, size: 0.2, grow: 2.5, color: col('#4a3c3a'), a: 0.3 }); } } };
  };

  AV.beanstalk = function (s, world, f) {
    const btn = new THREE.Group();
    const stone = mesh(new THREE.CylinderGeometry(s.br, s.br, 0.04, 28), new THREE.MeshStandardMaterial({ map: T.runes(), emissiveMap: T.runes(), emissive: col('#ff6a1a'), emissiveIntensity: 0.8, roughness: 0.9 }));
    stone.position.y = 0.02; btn.add(stone);
    world.holeGroup.add(at(btn, s.button[0], s.button[1], 0));
    const r = s.rect, len = r[3] - r[1], w = r[2] - r[0];
    const bridge = new THREE.Group();
    const deck = mesh(new THREE.BoxGeometry(w, 0.1, len), new THREE.MeshStandardMaterial({ map: T.bone(), roughness: 0.7 }));
    deck.position.set(0, -0.05, -len / 2); bridge.add(deck);
    const boneM = M('#e6dbc2');
    for (let i = 0; i < 7; i++) {
      [-1, 1].forEach(k => {
        const rib = mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 12, Math.PI * 0.8), boneM);
        rib.position.set(k * (w / 2 + 0.02), 0.0, -(0.25 + (i * (len - 0.5)) / 6));
        rib.rotation.y = k > 0 ? 0 : Math.PI; rib.rotation.z = Math.PI / 2;
        bridge.add(rib);
      });
    }
    world.holeGroup.add(at(bridge, (r[0] + r[2]) / 2, r[1], 0));
    let last = -9;
    return {
      update(t) {
        const gr = f.grown;
        bridge.visible = gr > 0.01;
        bridge.scale.set(1, Math.min(1, gr * 2), Math.max(0.001, gr));
        stone.material.emissiveIntensity = f.left > 0 ? 2.2 : 0.7 + Math.sin(t * 3) * 0.3;
        if (f.t0 !== last && t - f.t0 < 0.1) { last = f.t0; world.burst('spark', s.button[0], s.button[1], 0.05, { color: '#ff8a3a', n: 30 }); }
      },
    };
  };

  AV.seesaw = function (s, world, f) {
    const g = new THREE.Group();
    const w = s.x1 - s.x0, l = s.y1 - s.y0;
    const slab = mesh(new THREE.BoxGeometry(w, 0.12, l), new THREE.MeshStandardMaterial({ map: T.obsidian(), roughness: 0.3, metalness: 0.2 }));
    slab.position.y = -0.06; g.add(slab);
    [-1, 1].forEach(k => { const e = mesh(new THREE.BoxGeometry(0.04, 0.02, l), glowM('#ff5a1a', 1.5), false); e.position.set(k * (w / 2 - 0.02), 0.002, 0); g.add(e); });
    world.holeGroup.add(at(g, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, 0));
    world.holeGroup.add(at(mesh(new THREE.CylinderGeometry(0.18, 0.18, l + 0.6, 10), plainStone()).rotateX(Math.PI / 2), (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, -0.3));
    return { update() { g.rotation.z = f.th; } };
  };

  AV.sprinkler = function (s, world, f) {
    const g = new THREE.Group();
    const h0 = world.sim.groundRaw(s.x, s.y);
    g.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.2, 12), M('#2a2426', { metalness: 0.6, roughness: 0.4 })));
    const head = mesh(new THREE.BoxGeometry(0.42, 0.1, 0.1), M('#3a3034', { metalness: 0.7 }));
    head.position.set(0.15, 0.25, 0);
    const hold = new THREE.Group(); hold.add(head); g.add(hold);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    let acc = 0;
    return {
      update(t, dt) {
        hold.rotation.y = f.ang;
        acc += dt;
        while (acc > 0.008) {
          acc -= 0.008;
          const a = f.ang + (Math.random() - 0.5) * (s.spread || 0.26) * 1.2, reach = s.range * (0.25 + Math.random() * 0.75), tFly = 0.45, sp = reach / tFly;
          world.glow.spawn({ x: s.x + Math.cos(a) * 0.38, y: h0 + 0.3, z: -(s.y + Math.sin(a) * 0.38), vx: Math.cos(a) * sp, vy: 0.6, vz: -Math.sin(a) * sp, g: -1, drag: 1, life: tFly, size: 0.14 + Math.random() * 0.1, grow: -0.5, color: col(Math.random() < 0.5 ? '#ff7a1a' : '#ffd25a') });
        }
      },
    };
  };

  AV.movingCup = function (s, world, f) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) + C.CUP_R * 2 + 0.3;
    const slot = mesh(new THREE.PlaneGeometry(len, C.CUP_R * 2 + 0.2), glowM('#3a0c06', 0.4), false);
    slot.rotation.x = -Math.PI / 2; slot.rotation.z = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
    world.holeGroup.add(at(slot, (s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, 0.003));
    const rim = mesh(new THREE.TorusGeometry(C.CUP_R + 0.05, 0.05, 10, 32), M('#3a3034', { metalness: 0.8, roughness: 0.35 }));
    rim.rotation.x = -Math.PI / 2;
    world.holeGroup.add(rim);
    return { update() { rim.position.copy(V(f.x, f.y, 0.02)); } };
  };

  AV.wind = function (s, world, f) {
    const box = world.hole.box;
    const px = box.x0 - 1.6, py = box.cy;
    world.holeGroup.add(at(mesh(new THREE.CylinderGeometry(0.08, 0.1, 11, 7), plainStone()), px, py, -3.5));
    const cloth = mesh(new THREE.PlaneGeometry(1.4, 0.6, 10, 3), new THREE.MeshStandardMaterial({ color: col('#7a1414'), side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.geometry.translate(0.7, 0, 0);
    const base = cloth.geometry.attributes.position.array.slice();
    const holder = new THREE.Group(); holder.add(cloth);
    world.holeGroup.add(at(holder, px, py, 1.7));
    let acc = 0;
    return {
      update(t, dt) {
        const k = f.gust, arr = cloth.geometry.attributes.position.array;
        for (let i = 0; i < arr.length; i += 3) { const x = base[i]; arr[i + 2] = Math.sin(x * 6 - t * (4 + k * 8)) * (0.06 + k * 0.08) * x; arr[i + 1] = base[i + 1] - x * (0.5 - k * 0.45); }
        cloth.geometry.attributes.position.needsUpdate = true;
        acc += dt * (1 + k * 18 + f.warn * 3);
        while (acc > 1) { acc -= 1; const y = box.y0 + Math.random() * box.h; world.glow.spawn({ x: box.x0 - 3, y: 0.2 + Math.random() * 1.6, z: -y, vx: 3 + k * 7, vy: Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.4, g: 0, drag: 1, life: 3, size: 0.07, color: col(Math.random() < 0.6 ? '#8a8078' : '#ff8a3a'), a: 0.7, wobble: 2, seed: Math.random() * 9 }); }
      },
    };
  };

  AV.boost = function (s, world, f) {
    const pads = f.pads.map(p => {
      const h0 = world.sim.groundRaw(p.x, p.y);
      const g = new THREE.Group();
      const ring = mesh(new THREE.RingGeometry(p.r * 0.72, p.r, 36), glowM('#ff6a1a', 1.4), false);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; g.add(ring);
      for (let i = 0; i < 2; i++) {
        const sh = new THREE.Shape();
        sh.moveTo(-0.2, -0.08 + i * 0.2); sh.lineTo(0, 0.04 + i * 0.2); sh.lineTo(0.2, -0.08 + i * 0.2); sh.lineTo(0.2, i * 0.2); sh.lineTo(0, 0.12 + i * 0.2); sh.lineTo(-0.2, i * 0.2);
        const ch = mesh(new THREE.ShapeGeometry(sh), glowM('#ffc04a', 1.8), false);
        ch.rotation.x = -Math.PI / 2; ch.position.y = 0.008;
        const hold = new THREE.Group(); hold.add(ch); hold.rotation.y = Math.atan2(p.dy, p.dx) - Math.PI / 2; g.add(hold);
      }
      world.holeGroup.add(at(g, p.x, p.y, h0));
      return { p, ring, h0, fired: -9 };
    });
    return {
      update(t) {
        pads.forEach(pd => {
          pd.ring.material.emissiveIntensity = 1.3 + Math.sin(t * 4 + pd.p.x) * 0.3;
          if (pd.p.hit > pd.fired) { pd.fired = pd.p.hit; for (let i = 0; i < 26; i++) world.glow.spawn({ x: pd.p.x, y: pd.h0 + 0.1, z: -pd.p.y, vx: pd.p.dx * (2 + Math.random() * 3), vy: 0.8 + Math.random(), vz: -pd.p.dy * (2 + Math.random() * 3), g: -2, life: 0.6, size: 0.12, grow: -0.5, color: col(Math.random() < 0.5 ? '#ff7a1a' : '#ffd25a') }); }
        });
      },
    };
  };

  AV.falls = function (s, world) {
    // lava pouring off the side of each ledge
    const box = world.hole.box, sim = world.sim;
    const lt = T.lava().clone(); lt.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: lt, emissiveMap: lt, emissive: col('#ff6a1a'), emissiveIntensity: 1.4, roughness: 0.6, side: THREE.DoubleSide });
    s.steps.forEach(y => {
      const hTop = sim.floorHeight(box.x1 - 0.5, y - 0.05);
      const sheet = mesh(new THREE.PlaneGeometry(0.8, hTop + 9), mat, false);
      sheet.rotation.y = Math.PI / 2;
      world.holeGroup.add(at(sheet, box.x1 + 0.05, y - 0.4, (hTop - 9) / 2));
    });
    return { update(t) { lt.offset.set(0, t * 0.6); } };
  };

  // posts in the Abyss
  const basePost = VIS.post;
  VIS.post = function (p, world) {
    if (p.style !== 'basalt') return basePost(p, world);
    const m = mesh(rockGeo(p.r * 1.1, Math.round(p.x * 13 + p.y * 7)), basaltMat());
    world.holeGroup.add(at(m, p.x, p.y, world.sim.groundRaw(p.x, p.y) + p.r * 0.4));
  };
})(window.PC = window.PC || {});
