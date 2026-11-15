/* Putt Club: how things look. The garden around each hole, posts, rail trims, and the moving parts of every special feature.
   Each PC.VIS[type](spec, world, feature, sim) builds meshes into world.holeGroup and returns {update(t, dt, sim)}. */
(function (PC) {
  'use strict';
  const U = PC.U, C = PC.C, T = PC.TEX, TAU = U.TAU;
  const col = PC.col, V = PC.V;
  const VIS = PC.VIS = {};
  const GY = () => PC.GROUND_Y;

  const M = (hex, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: 0.8 }, o || {}));
  const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
  const at = (o, x, y, h) => { o.position.copy(V(x, y, h)); return o; };
  const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // Join several geometries into one (so many small parts can share one instanced mesh).
  function merge(geos) {
    const pos = [], nrm = [], clr = [];
    geos.forEach(({ g, color }) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (!n.attributes.normal) n.computeVertexNormals();
      const p = n.attributes.position.array, q = n.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nrm.push(q[i]); }
      const c = col(color || '#ffffff');
      for (let i = 0; i < p.length / 3; i++) clr.push(c.r, c.g, c.b);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
    return g;
  }
  const tr = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    return g.clone().applyMatrix4(m);
  };

  // Instanced helper: add many copies of one geometry with their own transform and colour.
  function instanced(world, geo, mat, items, cast = true) {
    if (!items.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    items.forEach((it, i) => {
      e.set(it.rx || 0, it.ry || 0, it.rz || 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1));
      im.setMatrixAt(i, m);
      if (it.c) im.setColorAt(i, col(it.c));
    });
    im.castShadow = cast; im.receiveShadow = true;
    world.holeGroup.add(im);
    return im;
  }
  VIS.instanced = instanced;

  // Shared little geometries
  const G = {};
  function geos() {
    if (G.ready) return G;
    const petal = new THREE.SphereGeometry(0.05, 7, 5);
    const parts = [];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; parts.push({ g: tr(petal, Math.cos(a) * 0.045, 0, Math.sin(a) * 0.045, 0, -a, 0, 1, 0.28, 0.6), color: '#ffffff' }); }
    parts.push({ g: tr(new THREE.SphereGeometry(0.03, 7, 5), 0, 0.012, 0, 0, 0, 0, 1, 0.6, 1), color: '#ffd23f' });
    G.flower = merge(parts);
    G.leaf = new THREE.IcosahedronGeometry(0.1, 0);
    G.blob = new THREE.IcosahedronGeometry(1, 1);
    G.trunk = new THREE.CylinderGeometry(0.16, 0.26, 1, 7);
    G.tulip = merge([
      { g: tr(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), 0, 0.15, 0), color: '#3f8a2e' },
      { g: tr(lathe([[0, 0], [0.04, 0.01], [0.05, 0.06], [0.035, 0.11], [0.0, 0.1]], 8), 0, 0.28, 0), color: '#ffffff' },
    ]);
    G.ready = true;
    return G;
  }

  function flowerItems(points, colors, rnd, base) {
    const heads = [], leaves = [];
    points.forEach(p => {
      const s = 0.8 + rnd() * 0.6;
      leaves.push({ x: p[0], y: base + 0.06, z: -p[1], s: 1.2 + rnd() * 0.8, sy: 0.8 + rnd() * 0.5, ry: rnd() * 6, c: rnd() < 0.5 ? '#3d7f2c' : '#4f9a3a' });
      heads.push({ x: p[0] + (rnd() - 0.5) * 0.06, y: base + 0.15 + rnd() * 0.12, z: -p[1] + (rnd() - 0.5) * 0.06, s, ry: rnd() * 6, rx: (rnd() - 0.5) * 0.4, c: colors[Math.floor(rnd() * colors.length)] });
    });
    return { heads, leaves };
  }

  // ---------- The garden around each hole ----------
  VIS.decorate = function (hole, world, sim) {
    const g = geos();
    const rnd = U.rng(U.hash(hole.id));
    const L = world.L;
    const polys = hole.floors.map(f => f.poly).concat(hole.hazards.map(z => z.poly));
    const clear = (x, y, m) => polys.every(P => !U.inPoly(x, y, P) && U.distToPoly(x, y, P) > m);
    const box = hole.box;
    const colors = hole.look.flowers || ['#ff7aa8', '#ffd23f', '#ffffff'];
    const base = GY();

    // Flowerbeds hugging the outside of the rails
    const bedPts = [], beds = [];
    hole.rails.filter(r => r.side === 'out' && r.style !== 'hedge').forEach(r => {
      const P = U.resample(r.pts, 0.2, r.closed);
      const N = U.normals(P, r.closed);
      let run = [];
      const flush = () => { if (run.length > 3) beds.push(run); run = []; };
      P.forEach((p, i) => {
        const n = N[i], nl = Math.hypot(n[0], n[1]) || 1;
        const ux = n[0] / nl, uy = n[1] / nl;
        const o = r.w + 0.05;
        const a = [p[0] + ux * o, p[1] + uy * o], b = [p[0] + ux * (o + 0.8), p[1] + uy * (o + 0.8)];
        if (clear(a[0], a[1], 0.05) && clear(b[0], b[1], 0.15)) {
          run.push([a, b]);
          if (rnd() < 0.85) for (let k = 0; k < 2; k++) { const t = 0.2 + rnd() * 0.65; bedPts.push([a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * 0.1, a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * 0.1]); }
        } else flush();
      });
      flush();
    });
    const soilMat = new THREE.MeshStandardMaterial({ map: T.soil(), roughness: 1 });
    beds.forEach(run => {
      const pos = [];
      for (let i = 0; i < run.length - 1; i++) {
        const [a0, b0] = run[i], [a1, b1] = run[i + 1], y = base + 0.05;
        pos.push(a0[0], y, -a0[1], b0[0], y, -b0[1], a1[0], y, -a1[1], a1[0], y, -a1[1], b0[0], y, -b0[1], b1[0], y, -b1[1]);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 2, pos[i + 2] / 2);
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, soilMat); m.receiveShadow = true; world.holeGroup.add(m);
    });
    const fl = flowerItems(bedPts, colors, rnd, base);
    instanced(world, g.flower, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), fl.heads, false);
    instanced(world, g.leaf, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), fl.leaves, false);

    // Bushes and flower clumps nearby
    const bush = [], bushFl = [];
    for (let i = 0; i < 260 && bush.length < 140; i++) {
      const x = box.x0 - 9 + rnd() * (box.w + 18), y = box.y0 - 6 + rnd() * (box.h + 14);
      if (!clear(x, y, 1.3)) continue;
      if (y < hole.tee[1] - 1 && Math.abs(x - hole.tee[0]) < 3.2) continue;
      const n = 2 + Math.floor(rnd() * 3), s = 0.35 + rnd() * 0.35;
      const tint = rnd() < 0.5 ? '#3f7d2f' : rnd() < 0.5 ? '#4f9038' : '#356b29';
      for (let k = 0; k < n; k++) {
        const bx = x + (rnd() - 0.5) * s * 1.6, by = y + (rnd() - 0.5) * s * 1.6, bs = s * (0.6 + rnd() * 0.5);
        bush.push({ x: bx, y: base + bs * 0.5, z: -by, s: bs, sy: bs * 0.85, ry: rnd() * 6, c: tint });
        if (rnd() < 0.35) for (let f = 0; f < 6; f++) { const a = rnd() * 6.28; bushFl.push({ x: bx + Math.cos(a) * bs * 0.8, y: base + bs * (0.6 + rnd() * 0.5), z: -by + Math.sin(a) * bs * 0.8, s: 0.9, ry: rnd() * 6, rx: -0.6, c: colors[(i + f) % colors.length] }); }
      }
    }
    instanced(world, g.blob, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), bush);
    instanced(world, g.flower, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), bushFl, false);

    // Trees, kept well back so the camera never ends up inside one
    const autumn = hole.look.light === 'autumn', spring = hole.look.light === 'spring';
    const canopyCols = autumn ? ['#d9822b', '#c2410c', '#e8b03a', '#a3471a'] : spring ? ['#4f9a3a', '#f4a7c0', '#5ea845', '#f9c4d6'] : ['#3f7d2f', '#4f9038', '#2f6a27', '#5a9a3f'];
    const trunks = [], canopy = [];
    let trees = 0;
    for (let i = 0; i < 400 && trees < 14; i++) {
      const x = box.x0 - 16 + rnd() * (box.w + 32), y = box.y0 - 4 + rnd() * (box.h + 22);
      if (!clear(x, y, 6.5)) continue;
      if (y < hole.tee[1] + 2 && Math.abs(x - hole.tee[0]) < 9) continue;
      trees++;
      const hgt = 2.2 + rnd() * 1.6, s = 1 + rnd() * 0.5;
      trunks.push({ x, y: base + hgt / 2, z: -y, sx: s, sy: hgt, sz: s, c: '#6b4a2f' });
      const c = canopyCols[Math.floor(rnd() * canopyCols.length)];
      for (let k = 0; k < 5; k++) {
        const a = rnd() * 6.28, d = rnd() * 0.9 * s, cs = (0.9 + rnd() * 0.6) * s;
        canopy.push({ x: x + Math.cos(a) * d, y: base + hgt + 0.3 + rnd() * 0.9 * s, z: -y + Math.sin(a) * d, s: cs, sy: cs * 0.85, ry: rnd() * 6, c });
      }
    }
    instanced(world, g.trunk, new THREE.MeshStandardMaterial({ roughness: 1 }), trunks);
    instanced(world, g.blob, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), canopy);

    // A ring of distant trees and hills
    const far = [], farT = [];
    for (let i = 0; i < 150; i++) {
      const a = rnd() * TAU, d = 42 + rnd() * 26;
      const x = box.cx + Math.cos(a) * d, y = box.cy + Math.sin(a) * d;
      const s = 2 + rnd() * 2.5;
      far.push({ x, y: base + s * 1.1, z: -y, s, sy: s * 1.2, ry: rnd() * 6, c: L.hills[i % 3] });
      if (rnd() < 0.3) farT.push({ x, y: base + s * 0.3, z: -y, sx: s * 0.4, sy: s * 0.8, sz: s * 0.4, c: '#5b4a35' });
    }
    instanced(world, g.blob, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), far, false);
    instanced(world, g.trunk, new THREE.MeshStandardMaterial({ roughness: 1 }), farT, false);
    const hills = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rnd(), d = 110 + rnd() * 50, s = 35 + rnd() * 30;
      hills.push({ x: box.cx + Math.cos(a) * d, y: base - s * 0.55, z: -(box.cy + Math.sin(a) * d), sx: s * 1.6, sy: s * 0.7, sz: s, c: L.hills[(i + 1) % 3] });
    }
    instanced(world, g.blob, new THREE.MeshStandardMaterial({ roughness: 1 }), hills, false);

    // Clouds
    const clouds = [];
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU, d = 120 + rnd() * 60, cx = box.cx + Math.cos(a) * d, cy = box.cy + Math.sin(a) * d, h = 38 + rnd() * 22;
      for (let k = 0; k < 5; k++) clouds.push({ x: cx + (rnd() - 0.5) * 24, y: h + rnd() * 4, z: -(cy + (rnd() - 0.5) * 10), s: 7 + rnd() * 6, sy: 3 + rnd() * 2, c: '#ffffff' });
    }
    instanced(world, g.blob, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 }), clouds, false);

    // Stepping stones up to the tee, and the hole's sign
    const ta = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    const stones = [];
    for (let i = 1; i < 9; i++) {
      const d = 1.2 + i * 0.75;
      const x = hole.tee[0] - Math.cos(ta) * d + Math.sin(i * 1.7) * 0.12, y = hole.tee[1] - Math.sin(ta) * d;
      if (!clear(x, y, 0.3)) continue;
      stones.push({ x, y: base + 0.02, z: -y, sx: 0.32 + rnd() * 0.1, sy: 0.05, sz: 0.24 + rnd() * 0.08, ry: rnd() * 3, c: '#c9c2b2' });
    }
    instanced(world, new THREE.CylinderGeometry(1, 1, 1, 9), new THREE.MeshStandardMaterial({ roughness: 0.95 }), stones, false);
    VIS.sign(hole, world, sim);

    // Butterflies and drifting pollen
    const flies = [];
    for (let i = 0; i < 5; i++) {
      const bf = new THREE.Group();
      const wing = new THREE.CircleGeometry(0.09, 8);
      const wm = new THREE.MeshStandardMaterial({ color: col(colors[i % colors.length]), side: THREE.DoubleSide, roughness: 0.6 });
      const l = new THREE.Mesh(wing, wm), r = new THREE.Mesh(wing, wm);
      l.position.x = -0.07; r.position.x = 0.07;
      const lp = new THREE.Group(), rp = new THREE.Group();
      lp.add(l); rp.add(r);
      bf.add(lp, rp);
      world.holeGroup.add(bf);
      flies.push({ g: bf, lp, rp, ph: rnd() * 10, cx: box.cx + (rnd() - 0.5) * box.w * 1.4, cy: box.cy + (rnd() - 0.5) * box.h, rx: 2 + rnd() * 4, ry: 2 + rnd() * 4, sp: 0.15 + rnd() * 0.2 });
    }
    let pollenT = 0;
    world.vis.push({
      update(t, dt) {
        flies.forEach(f => {
          const a = t * f.sp + f.ph;
          const x = f.cx + Math.cos(a) * f.rx, y = f.cy + Math.sin(a * 1.3) * f.ry;
          f.g.position.copy(V(x, y, 0.5 + Math.sin(t * 2 + f.ph) * 0.25 + 0.4));
          f.g.rotation.y = a + Math.PI / 2;
          const flap = Math.sin(t * 22 + f.ph) * 1.1;
          f.lp.rotation.z = flap; f.rp.rotation.z = -flap;
        });
        pollenT += dt;
        if (pollenT > 0.12) {
          pollenT = 0;
          const x = box.x0 + rnd() * box.w, y = box.y0 + rnd() * box.h;
          world.glow.spawn({ x, y: 0.3 + rnd() * 1.5, z: -y, vx: 0.1, vy: 0.05, vz: 0, g: 0, life: 5, size: 0.035, color: col('#fff6c8'), a: 0.7, wobble: 0.15, seed: rnd() * 9, drag: 1 });
        }
      },
    });
  };

  VIS.sign = function (hole, world, sim, hell) {
    const [tx, ty] = hole.tee;
    const ta = Math.atan2(hole.cup[1] - ty, hole.cup[0] - tx);
    // to the left of the tee, outside the green
    let sx = tx - Math.sin(ta) * -1, sy = ty;
    const polys = hole.floors.map(f => f.poly).concat(hole.hazards.map(z => z.poly));
    for (let d = 2; d < 8; d += 0.25) {
      const x = tx + Math.cos(ta + Math.PI * 0.62) * d, y = ty + Math.sin(ta + Math.PI * 0.62) * d;
      if (polys.every(P => !U.inPoly(x, y, P) && U.distToPoly(x, y, P) > 0.9)) { sx = x; sy = y; break; }
    }
    const g = new THREE.Group();
    const edge = hell ? '#1e1719' : '#6b4a2f';
    const postLen = hell ? 10.3 : 1.3;
    const post = mesh(new THREE.BoxGeometry(hell ? 0.18 : 0.1, postLen, hell ? 0.18 : 0.1), M(edge));
    post.position.y = 1.3 - postLen / 2;
    const board = mesh(new THREE.BoxGeometry(1.5, 0.75, 0.06), [M(edge), M(edge), M(edge), M(edge), new THREE.MeshStandardMaterial({ map: T.sign(hole.num, hole.name, hole.par, hell), roughness: 0.8, emissive: col(hell ? '#3a1206' : '#000000') }), M(edge)]);
    board.position.y = 1.25;
    g.add(post, board);
    at(g, sx, sy, hell ? 0 : GY());
    g.rotation.y = ta - Math.PI / 2 + 0.35;
    world.holeGroup.add(g);
  };

  // ---------- Posts ----------
  VIS.post = function (p, world) {
    const sim = world.sim;
    const h0 = sim.groundRaw(p.x, p.y);
    const rnd = U.rng(Math.round(p.x * 100 + p.y * 37));
    if (p.style === 'pot') {
      const g = VIS.pot(p.r, p.h, rnd, world.hole.look.flowers);
      world.holeGroup.add(at(g, p.x, p.y, h0));
    } else if (p.style === 'hive') {
      const g = new THREE.Group();
      const prof = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push([p.r * Math.sqrt(1 - t * t * 0.95) * (1 + 0.04 * Math.sin(t * 40)), t * p.h]); }
      prof.push([0, p.h]);
      const skep = mesh(lathe(prof, 24), M('#d9a441', { roughness: 0.95 }));
      const door = mesh(new THREE.CircleGeometry(0.08, 12), M('#2a1a0a'));
      door.position.set(0, 0.1, p.r * 0.98);
      const stand = mesh(new THREE.CylinderGeometry(p.r * 1.1, p.r * 1.1, 0.06, 20), M('#7a5230'));
      g.add(stand, skep, door);
      skep.position.y = 0.06; door.position.y = 0.16;
      g.rotation.y = -0.6;
      world.holeGroup.add(at(g, p.x, p.y, h0));
    } else {
      const geo = new THREE.DodecahedronGeometry(p.r * 1.08, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const k = 0.85 + rnd() * 0.25; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
      geo.computeVertexNormals();
      const rock = mesh(geo, M(['#9a958b', '#8a857b', '#a9a397'][Math.floor(rnd() * 3)], { flatShading: true, roughness: 0.95 }));
      rock.scale.y = Math.min(1, (p.h * 0.9) / p.r);
      rock.rotation.set(rnd(), rnd() * 6, rnd());
      world.holeGroup.add(at(rock, p.x, p.y, h0 + p.r * 0.25));
    }
  };

  VIS.pot = function (r, h, rnd, colors) {
    const g = new THREE.Group();
    const ph = h * 0.75;
    const pot = mesh(lathe([[0, 0], [r * 0.72, 0], [r * 0.95, ph * 0.85], [r * 1.02, ph * 0.87], [r * 1.02, ph], [r * 0.9, ph], [r * 0.88, ph * 0.9], [0, ph * 0.9]], 18), M('#c8693c', { roughness: 0.9 }));
    g.add(pot);
    const soil = mesh(new THREE.CircleGeometry(r * 0.88, 16), M('#4a3220'));
    soil.rotation.x = -Math.PI / 2; soil.position.y = ph * 0.9;
    g.add(soil);
    for (let i = 0; i < 4; i++) {
      const a = rnd() * 6.28, s = r * (0.45 + rnd() * 0.25);
      const lf = mesh(new THREE.IcosahedronGeometry(s, 0), M(rnd() < 0.5 ? '#3d7f2c' : '#56a03f', { flatShading: true }));
      lf.position.set(Math.cos(a) * r * 0.35, ph + s * 0.6, Math.sin(a) * r * 0.35);
      g.add(lf);
    }
    if (colors) for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(geos().flower, new THREE.MeshStandardMaterial({ color: col(colors[Math.floor(rnd() * colors.length)]), vertexColors: true, roughness: 0.7 }));
      const a = rnd() * 6.28;
      f.position.set(Math.cos(a) * r * 0.4, ph + r * 0.9, Math.sin(a) * r * 0.4);
      f.scale.setScalar(r * 4);
      g.add(f);
    }
    return g;
  };

  // ---------- Rail trims ----------
  VIS.railExtras = function (r, body, world, sim) {
    const rnd = U.rng(U.hash(r.style + r.pts.length + r.pts[0][0]));
    const P = body.line, N = body.normals, Tp = body.tops;
    if (r.style === 'hedge') {
      const items = [];
      for (let i = 0; i < P.length - 1; i++) {
        const n = N[Math.min(i, N.length - 1)];
        const off = r.side === 'out' ? r.w / 2 : 0;
        for (let k = 0; k < 2; k++) {
          const t = rnd();
          const x = P[i][0] + (P[i + 1][0] - P[i][0]) * t + n[0] * (off + (rnd() - 0.5) * r.w * 0.6);
          const y = P[i][1] + (P[i + 1][1] - P[i][1]) * t + n[1] * (off + (rnd() - 0.5) * r.w * 0.6);
          const s = r.w * (0.32 + rnd() * 0.18);
          items.push({ x, y: Tp[i] - s * 0.25, z: -y, s, sy: s * 0.8, ry: rnd() * 6, c: rnd() < 0.5 ? '#2f6b2a' : rnd() < 0.5 ? '#3b7f32' : '#285e24' });
        }
      }
      instanced(world, geos().blob, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), items);
    } else if (r.style === 'trellis' || r.style === 'glass') {
      // A tall panel standing on the rail: rose lattice or greenhouse glass
      const top = r.style === 'trellis' ? (r.h || 0.7) + 0.15 : 1.5;
      const pos = [], uv = [];
      let acc = 0;
      const mid = r.side === 'out' ? r.w * 0.5 : 0;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1], na = N[i], nb = N[Math.min(i + 1, N.length - 1)];
        const ax = a[0] + na[0] * mid, ay = a[1] + na[1] * mid, bx = b[0] + nb[0] * mid, by = b[1] + nb[1] * mid;
        const l = Math.hypot(bx - ax, by - ay), y0a = Tp[i], y0b = Tp[Math.min(i + 1, Tp.length - 1)];
        pos.push(ax, y0a, -ay, bx, y0b, -by, ax, y0a + top, -ay, ax, y0a + top, -ay, bx, y0b, -by, bx, y0b + top, -by);
        uv.push(acc, 0, acc + l, 0, acc, top, acc, top, acc + l, 0, acc + l, top);
        acc += l;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv.map((v, i) => (i % 2 === 0 ? v / 0.7 : v / 0.7)), 2));
      geo.computeVertexNormals();
      let mat;
      if (r.style === 'trellis') mat = new THREE.MeshStandardMaterial({ map: T.lattice(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
      else mat = new THREE.MeshPhysicalMaterial({ color: col('#e8fbff'), transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, side: THREE.DoubleSide, clearcoat: 1, depthWrite: false });
      const m = mesh(geo, mat, r.style === 'trellis');
      world.holeGroup.add(m);
      // posts / mullions and roses
      const postItems = [], roses = [], leaves = [];
      let d = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = N[i];
        if (d <= 0) { postItems.push({ x: a[0] + n[0] * mid, y: Tp[i] + top / 2, z: -(a[1] + n[1] * mid), sx: 0.05, sy: top, sz: 0.05, c: '#ffffff' }); d = r.style === 'glass' ? 1.1 : 1.6; }
        d -= l;
        if (r.style === 'trellis') for (let k = 0; k < 3; k++) {
          const t = rnd(), hh = Tp[i] + 0.1 + rnd() * (top - 0.1);
          const x = a[0] + (b[0] - a[0]) * t + n[0] * (mid + 0.03), y = a[1] + (b[1] - a[1]) * t + n[1] * (mid + 0.03);
          if (rnd() < 0.55) roses.push({ x, y: hh, z: -y, s: 0.045 + rnd() * 0.03, c: (world.hole.look.flowers || ['#e11d48'])[Math.floor(rnd() * 3)] });
          leaves.push({ x: x + (rnd() - 0.5) * 0.1, y: hh + (rnd() - 0.5) * 0.1, z: -y, s: 0.5 + rnd() * 0.4, sy: 0.4, ry: rnd() * 6, c: rnd() < 0.5 ? '#2f6b2a' : '#4f9038' });
        }
      }
      instanced(world, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), postItems);
      instanced(world, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), roses);
      instanced(world, geos().leaf, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), leaves);
    } else if (r.side === 'out' && (r.style === 'timber' || r.style === 'white' || r.style === 'brick' || r.style === 'stone' || r.style === 'petal')) {
      // corner posts with caps where the rail turns
      const items = [], caps = [];
      const rawP = r.pts, n = rawP.length;
      const Nr = U.normals(rawP, r.closed);
      let last = -9;
      for (let i = 0; i < n; i++) {
        if (!r.closed && (i === 0 || i === n - 1)) continue;
        const a = rawP[(i - 1 + n) % n], b = rawP[i], c = rawP[(i + 1) % n];
        const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
        const turn = Math.abs(U.wrapAngle(t2 - t1));
        if (turn < 0.5 || i - last < 4) continue;
        last = i;
        const nn = Nr[i], l = Math.hypot(nn[0], nn[1]) || 1;
        const x = b[0] + (nn[0] / l) * r.w * 0.5, y = b[1] + (nn[1] / l) * r.w * 0.5;
        const top = sim.groundRaw(b[0] - nn[0] * 0.03, b[1] - nn[1] * 0.03) + r.h + 0.12;
        items.push({ x, y: (top + GY()) / 2, z: -y, sx: r.w + 0.06, sy: top - GY(), sz: r.w + 0.06 });
        caps.push({ x, y: top + 0.04, z: -y, sx: r.w + 0.12, sy: 0.07, sz: r.w + 0.12 });
      }
      const mats = world.railMaterials(r.style);
      instanced(world, new THREE.BoxGeometry(1, 1, 1), mats.body, items);
      if (mats.cap) instanced(world, new THREE.BoxGeometry(1, 1, 1), mats.cap, caps);
    }
  };

  VIS.flowerPit = function (z, world) {
    const rnd = U.rng(77), pts = [];
    const b = U.bounds([z.poly]);
    for (let y = b.y0 + 0.12; y < b.y1 - 0.05; y += 0.17) for (let x = b.x0 + 0.1; x < b.x1 - 0.05; x += 0.16) {
      const px = x + (rnd() - 0.5) * 0.08, py = y + (rnd() - 0.5) * 0.08;
      if (U.inPoly(px, py, z.poly)) pts.push([px, py]);
    }
    const cols = world.hole.look.flowers;
    instanced(world, geos().tulip, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), pts.map(p => ({ x: p[0], y: z.top - 0.18, z: -p[1], s: 1 + rnd() * 0.5, sy: 0.9 + rnd() * 0.6, ry: rnd() * 6, rz: (rnd() - 0.5) * 0.2, c: cols[Math.floor(rnd() * cols.length)] })), false);
    instanced(world, geos().leaf, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), pts.filter(() => rnd() < 0.5).map(p => ({ x: p[0], y: z.top - 0.14, z: -p[1], s: 0.9, sy: 0.6, ry: rnd() * 6, c: '#3d7f2c' })), false);
  };

  // ---------- Models ----------
  VIS.gnome = function (rnd) {
    const g = new THREE.Group();
    const coat = ['#2f6fd1', '#3a9d4a', '#7c4dbe'][Math.floor(rnd() * 3)];
    const body = mesh(new THREE.CylinderGeometry(0.16, 0.27, 0.42, 14), M(coat));
    body.position.y = 0.27;
    const belt = mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 14), M('#3b2a1a')); belt.position.y = 0.3;
    const buckle = mesh(new THREE.BoxGeometry(0.02, 0.05, 0.06), M('#ffd23f', { metalness: 0.5, roughness: 0.3 })); buckle.position.set(0.205, 0.3, 0);
    const head = mesh(new THREE.SphereGeometry(0.13, 16, 12), M('#f2c4a0')); head.position.y = 0.58;
    const beard = mesh(new THREE.ConeGeometry(0.15, 0.3, 14), M('#f8f8f8')); beard.rotation.z = Math.PI; beard.position.set(0.06, 0.45, 0); beard.rotation.y = 0;
    const nose = mesh(new THREE.SphereGeometry(0.045, 10, 8), M('#ee9a86')); nose.position.set(0.13, 0.58, 0);
    const hat = mesh(new THREE.ConeGeometry(0.15, 0.44, 16), M('#d93a2f')); hat.position.set(-0.02, 0.84, 0); hat.rotation.z = 0.12;
    const bootL = mesh(new THREE.SphereGeometry(0.07, 10, 8), M('#3b2a1a')); bootL.position.set(0.12, 0.04, 0.09); bootL.scale.set(1.4, 0.7, 1);
    const bootR = bootL.clone(); bootR.position.z = -0.09;
    const armL = mesh(new THREE.SphereGeometry(0.06, 10, 8), M(coat)); armL.position.set(0.05, 0.38, 0.19);
    const armR = armL.clone(); armR.position.z = -0.19;
    g.add(body, belt, buckle, head, beard, nose, hat, bootL, bootR, armL, armR);
    return g;
  };

  VIS.pumpkin = function (r, tint) {
    const g = new THREE.Group();
    const mat = M(tint || '#f07a1a', { roughness: 0.6 });
    for (let i = 0; i < 8; i++) {
      const s = mesh(new THREE.SphereGeometry(r * 0.62, 14, 10), mat);
      const a = (i / 8) * TAU;
      s.scale.set(0.62, 0.86, 1);
      s.position.set(Math.cos(a) * r * 0.42, r * 0.72, Math.sin(a) * r * 0.42);
      s.rotation.y = -a;
      g.add(s);
    }
    const stem = mesh(new THREE.CylinderGeometry(r * 0.07, r * 0.11, r * 0.4, 7), M('#5b6b2a')); stem.position.y = r * 1.4; stem.rotation.z = 0.25;
    const leaf = mesh(new THREE.SphereGeometry(r * 0.25, 8, 6), M('#4f8a2e')); leaf.scale.set(1.4, 0.2, 0.9); leaf.position.set(r * 0.25, r * 1.3, 0);
    g.add(stem, leaf);
    return g;
  };

  VIS.tree = function (world, x, y, opts = {}) {
    const g = new THREE.Group();
    const h = opts.h || 2.6, s = opts.s || 1.2;
    const trunk = mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, h, 9), M('#6b4a2f', { roughness: 1 }));
    trunk.position.y = h / 2;
    g.add(trunk);
    const cols = opts.colors || ['#3f7d2f', '#4f9038', '#2f6a27'];
    const rnd = U.rng(Math.round(x * 31 + y * 17));
    for (let i = 0; i < (opts.blobs || 6); i++) {
      const a = rnd() * 6.28, d = rnd() * 0.9 * s, cs = (0.8 + rnd() * 0.6) * s;
      const b = mesh(new THREE.IcosahedronGeometry(cs, 1), M(cols[i % cols.length], { flatShading: true, roughness: 0.95 }));
      b.position.set(Math.cos(a) * d, h + 0.2 + rnd() * 0.8 * s, Math.sin(a) * d); b.scale.y = 0.85;
      g.add(b);
    }
    world.holeGroup.add(at(g, x, y, GY()));
    return g;
  };

  // ---------- Feature visuals ----------
  VIS.spinner = function (s, world, f) {
    const g = new THREE.Group();
    const h0 = world.sim.groundRaw(s.x, s.y);
    const pole = mesh(new THREE.CylinderGeometry(0.2, 0.24, s.h + 0.25, 16), new THREE.MeshStandardMaterial({ map: T.pole(), roughness: 0.5 }));
    pole.position.y = (s.h + 0.25) / 2;
    g.add(pole);
    const rot = new THREE.Group();
    const cols = ['#ff5d8f', '#ffd23f', '#3db2ff', '#7ed957'];
    for (let i = 0; i < s.arms; i++) {
      const sh = new THREE.Shape();
      sh.moveTo(0.18, 0.06); sh.lineTo(s.len, 0.06); sh.quadraticCurveTo(s.len, s.h * 0.75, 0.18, s.h);
      sh.lineTo(0.18, 0.06);
      const vane = mesh(new THREE.ShapeGeometry(sh, 6), new THREE.MeshStandardMaterial({ color: col(cols[i % cols.length]), side: THREE.DoubleSide, roughness: 0.55 }));
      const stripe = new THREE.Shape();
      stripe.moveTo(0.18, s.h * 0.38); stripe.lineTo(s.len * 0.9, 0.3); stripe.lineTo(s.len * 0.94, 0.42); stripe.lineTo(0.18, s.h * 0.52);
      const st = new THREE.Mesh(new THREE.ShapeGeometry(stripe), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
      const holder = new THREE.Group();
      holder.add(vane, st);
      holder.rotation.y = (i * TAU) / s.arms;
      // thin frame along the bottom edge
      const bar = mesh(new THREE.BoxGeometry(s.len - 0.18, 0.06, 0.06), M('#f5f5f5'));
      bar.position.set((s.len + 0.18) / 2, 0.06, 0);
      holder.add(bar);
      rot.add(holder);
    }
    g.add(rot);
    // a little pinwheel flower on top that spins the other way
    const top = new THREE.Group();
    for (let i = 0; i < 6; i++) { const p = mesh(new THREE.SphereGeometry(0.12, 10, 6), M(cols[i % 4])); p.scale.set(1, 0.25, 0.45); p.position.x = 0.12; const hh = new THREE.Group(); hh.add(p); hh.rotation.y = (i / 6) * TAU; top.add(hh); }
    top.position.y = s.h + 0.3;
    g.add(top);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    return { update() { rot.rotation.y = f.ang; top.rotation.y = -f.ang * 2; } };
  };

  VIS.sprinkler = function (s, world, f) {
    const g = new THREE.Group();
    const h0 = world.sim.groundRaw(s.x, s.y);
    const base = mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 18), M('#3a8f4a', { roughness: 0.5 }));
    base.position.y = 0.06;
    const riser = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 10), M('#c9a227', { metalness: 0.7, roughness: 0.3 }));
    riser.position.y = 0.3;
    const head = new THREE.Group();
    const arm = mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), M('#c9a227', { metalness: 0.7, roughness: 0.3 }));
    arm.position.x = 0.15;
    const nozzle = mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.1, 8), M('#8a6d10', { metalness: 0.7, roughness: 0.35 }));
    nozzle.rotation.z = -Math.PI / 2.4; nozzle.position.set(0.36, 0.04, 0);
    head.add(arm, nozzle);
    head.position.y = 0.5;
    g.add(base, riser, head);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    let acc = 0;
    const wc = col('#cdefff');
    return {
      update(t, dt) {
        head.rotation.y = f.ang;
        acc += dt;
        while (acc > 0.006) {
          acc -= 0.006;
          const a = f.ang + (Math.random() - 0.5) * (s.spread || 0.26) * 1.2;
          const reach = s.range * (0.25 + Math.random() * 0.75);
          const tFly = 0.5, sp = reach / tFly;
          world.glow.spawn({ x: s.x + Math.cos(a) * 0.38, y: h0 + 0.55, z: -(s.y + Math.sin(a) * 0.38), vx: Math.cos(a) * sp, vy: 2.0, vz: -Math.sin(a) * sp, g: -9.5, drag: 1, life: tFly + 0.05, size: 0.09 + Math.random() * 0.06, color: wc, a: 0.95, floor: h0 + 0.02 });
          if (Math.random() < 0.12) world.glow.spawn({ x: s.x + Math.cos(a) * reach, y: h0 + 0.05, z: -(s.y + Math.sin(a) * reach), vx: 0, vy: 0.3, vz: 0, g: 0, life: 0.5, size: 0.22, grow: 1.5, color: wc, a: 0.35 });
        }
      },
    };
  };

  VIS.ferry = function (s, world, f) {
    const pad = new THREE.Group();
    const sh = new THREE.Shape();
    sh.absarc(0, 0, s.r, 0.25, TAU - 0.25, false);
    sh.lineTo(0, 0);
    const top = mesh(new THREE.ShapeGeometry(sh, 32), new THREE.MeshStandardMaterial({ map: T.lilypad(), roughness: 0.6 }));
    const uv = top.geometry.attributes.uv, p = top.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / (2 * s.r) + 0.5, p.getY(i) / (2 * s.r) + 0.5);
    top.rotation.x = -Math.PI / 2;
    const rim = mesh(new THREE.CylinderGeometry(s.r, s.r * 0.97, 0.06, 40, 1, true, 0.25 + Math.PI / 2, TAU - 0.5), M('#2f6e22'));
    rim.position.y = -0.03;
    pad.add(top, rim);
    const lotus = new THREE.Group();
    for (let i = 0; i < 8; i++) { const pt = mesh(new THREE.SphereGeometry(0.12, 10, 6), M(i % 2 ? '#ffb3d1' : '#ff8fc0')); pt.scale.set(1, 0.5, 0.4); pt.position.set(0.08, 0.06, 0); pt.rotation.z = 0.7; const hh = new THREE.Group(); hh.add(pt); hh.rotation.y = (i / 8) * TAU; lotus.add(hh); }
    const ctr = mesh(new THREE.SphereGeometry(0.05, 8, 6), M('#ffd23f')); ctr.position.y = 0.08; lotus.add(ctr);
    lotus.position.set(-s.r * 0.55, 0, -s.r * 0.55);
    pad.add(lotus);
    world.holeGroup.add(pad);
    // a few still lily pads and a frog
    const hz = world.hole.hazards[0];
    const rnd = U.rng(5);
    if (hz) for (let i = 0; i < 9; i++) {
      const b = U.bounds([hz.poly]);
      const x = b.x0 + rnd() * b.w, y = b.y0 + rnd() * b.h;
      if (!U.inPoly(x, y, hz.poly) || Math.abs(x - s.a[0]) < s.r + 0.4 || world.sim.floorAt(x, y)) continue;
      const r = 0.25 + rnd() * 0.25;
      const shp = new THREE.Shape(); shp.absarc(0, 0, r, 0.3, TAU - 0.3, false); shp.lineTo(0, 0);
      const m = mesh(new THREE.ShapeGeometry(shp, 16), M('#4f9a3a', { roughness: 0.6 }), false);
      m.rotation.x = -Math.PI / 2; m.rotation.z = rnd() * 6;
      m.position.copy(V(x, y, hz.top - 0.005));
      world.holeGroup.add(m);
    }
    const frog = new THREE.Group();
    const fb = mesh(new THREE.SphereGeometry(0.16, 14, 10), M('#5cb34a')); fb.scale.set(1.2, 0.75, 1);
    const e1 = mesh(new THREE.SphereGeometry(0.06, 10, 8), M('#ffffff')); e1.position.set(0.1, 0.12, 0.08);
    const e2 = e1.clone(); e2.position.z = -0.08;
    const p1 = mesh(new THREE.SphereGeometry(0.03, 8, 6), M('#111111')); p1.position.set(0.15, 0.13, 0.08);
    const p2 = p1.clone(); p2.position.z = -0.08;
    frog.add(fb, e1, e2, p1, p2);
    frog.position.copy(V(-2.75, 11.6, PC.C.WATER_TOP + 0.08));
    frog.rotation.y = -Math.PI / 2 + 0.6;
    world.holeGroup.add(frog);
    return { update(t) { pad.position.copy(V(f.x, f.y, (s.h || -0.03) + 0.005)); pad.rotation.y = Math.sin(t * 0.4) * 0.15; frog.scale.y = 1 + Math.max(0, Math.sin(t * 1.3)) * 0.06; } };
  };

  VIS.tunnels = function (s, world, f) {
    const moles = [];
    const soil = M('#6b4a2f', { roughness: 1 });
    s.pairs.forEach((p, i) => {
      [p.a, p.b].forEach((e, end) => {
        const h = world.sim.groundRaw(e[0], e[1]);
        const mound = mesh(new THREE.SphereGeometry(0.62, 24, 12, 0, TAU, 0, Math.PI / 2), soil);
        mound.scale.set(1, 0.28, 1);
        // a ring mound with the hole in the middle
        const ring = mesh(new THREE.TorusGeometry(0.42, 0.14, 10, 28), soil);
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.scale.z = 0.7;
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.31, 24), new THREE.MeshBasicMaterial({ map: T.cupShade() }));
        hole.rotation.x = -Math.PI / 2; hole.position.y = 0.012;
        const crumbs = new THREE.Group();
        const rnd = U.rng(i * 10 + end);
        for (let k = 0; k < 7; k++) { const c = mesh(new THREE.IcosahedronGeometry(0.04 + rnd() * 0.04, 0), soil); const a = rnd() * 6.28, d = 0.55 + rnd() * 0.3; c.position.set(Math.cos(a) * d, 0.01, Math.sin(a) * d); crumbs.add(c); }
        const g = new THREE.Group();
        g.add(ring, hole, crumbs);
        world.holeGroup.add(at(g, e[0], e[1], h));
        // the mole
        const mole = new THREE.Group();
        const mb = mesh(new THREE.SphereGeometry(0.17, 14, 10), M('#5a4636', { roughness: 1 })); mb.scale.y = 1.25;
        const snout = mesh(new THREE.SphereGeometry(0.05, 10, 8), M('#f2a1a8')); snout.position.set(0.16, 0.08, 0);
        const paw1 = mesh(new THREE.SphereGeometry(0.06, 8, 6), M('#f2c4b0')); paw1.position.set(0.12, -0.02, 0.1); paw1.scale.set(1, 0.5, 1.3);
        const paw2 = paw1.clone(); paw2.position.z = -0.1;
        const eye = mesh(new THREE.SphereGeometry(0.018, 6, 6), M('#111111')); eye.position.set(0.12, 0.16, 0.06);
        const eye2 = eye.clone(); eye2.position.z = -0.06;
        mole.add(mb, snout, paw1, paw2, eye, eye2);
        mole.rotation.y = Math.atan2(-(end ? p.dirA : p.dirB) * 0, 1) + (end ? p.dirA : p.dirB);
        const mg = new THREE.Group(); mg.add(mole);
        world.holeGroup.add(at(mg, e[0], e[1], h));
        moles.push({ mg, mole, i, end, base: h });
      });
    });
    return {
      update(t) {
        moles.forEach(m => {
          const tp = f.pops[m.i][m.end];
          const k = t - (tp - 0.75);
          let up = 0;
          if (k > 0 && k < 2.2) up = k < 0.3 ? k / 0.3 : k > 1.6 ? 1 - (k - 1.6) / 0.6 : 1;
          const idle = Math.max(0, Math.sin(t * 0.7 + m.i * 2.1 + m.end * 1.3) - 0.92) * 8;
          const v = Math.max(up, idle * 0.6);
          m.mg.position.y = m.base - 0.25 + v * 0.38;
          m.mg.visible = v > 0.02;
        });
      },
    };
  };

  VIS.patrol = function (s, world, f) {
    const rnd = U.rng(3);
    const models = f.movers.map(mv => {
      let g;
      if (s.snail) {
        g = new THREE.Group();
        const body = mesh(new THREE.SphereGeometry(0.1, 16, 10), M('#c9b28a', { roughness: 0.35 }));
        body.scale.set(3.1, 0.75, 1); body.position.set(0.04, 0.07, 0);
        const shell = mesh(new THREE.TorusGeometry(0.15, 0.1, 12, 24), M('#b5652b', { roughness: 0.5 }));
        shell.position.set(-0.05, 0.25, 0);
        const shell2 = mesh(new THREE.SphereGeometry(0.12, 14, 10), M('#d68a45', { roughness: 0.5 }));
        shell2.position.set(-0.05, 0.25, 0); shell2.scale.z = 0.8;
        const st1 = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), M('#c9b28a')); st1.position.set(0.26, 0.2, 0.04); st1.rotation.z = -0.4;
        const st2 = st1.clone(); st2.position.z = -0.04;
        const e1 = mesh(new THREE.SphereGeometry(0.025, 8, 6), M('#222222')); e1.position.set(0.3, 0.29, 0.04);
        const e2 = e1.clone(); e2.position.z = -0.04;
        g.add(body, shell, shell2, st1, st2, e1, e2);
      } else g = VIS.gnome(rnd);
      world.holeGroup.add(g);
      return g;
    });
    return {
      update(t) {
        f.movers.forEach((mv, i) => {
          const g = models[i];
          const h = world.sim.groundRaw(mv.x, mv.y);
          const sp = Math.hypot(mv.vx, mv.vy);
          g.position.copy(V(mv.x, mv.y, h + (s.snail ? 0 : Math.abs(Math.sin(t * 9 + i)) * 0.04 * Math.min(1, sp))));
          if (sp > 0.02) g.rotation.y = Math.atan2(mv.vy, mv.vx);
          if (!s.snail) g.rotation.z = Math.sin(t * 9 + i) * 0.08 * Math.min(1, sp);
          const hit = t - (mv.hit || -9);
          const k = hit < 0.3 ? 1 + Math.sin(hit * 20) * 0.08 * (1 - hit / 0.3) : 1;
          g.scale.set(k, 2 - k, k);
        });
      },
    };
  };

  VIS.bumpers = function (s, world, f) {
    const items = f.list.map((p, i) => {
      const g = VIS.pumpkin(p.r * 1.05, p.small ? '#f3c623' : i % 2 ? '#e8701a' : '#f08a24');
      world.holeGroup.add(at(g, p.x, p.y, world.sim.groundRaw(p.x, p.y)));
      g.rotation.y = i * 1.3;
      return g;
    });
    // a scarecrow-free autumn touch: hay bales and gourds outside the course
    const hb = world.hole.box;
    [[hb.x0 - 1.6, hb.y1 - 2], [hb.x1 + 1.6, hb.y1 - 4], [hb.x1 + 1.8, hb.y0 + 3]].forEach(([x, y], i) => {
      const bale = mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), M('#e0bf5a', { roughness: 1 }));
      bale.rotation.y = i;
      world.holeGroup.add(at(bale, x, y, GY() + 0.3));
      const pk = VIS.pumpkin(0.35, '#f07a1a');
      world.holeGroup.add(at(pk, x + 0.2, y, GY() + 0.6));
    });
    return {
      update(t) {
        f.list.forEach((p, i) => {
          const k = t - p.hit;
          const s2 = k < 0.4 ? 1 + Math.sin(k * 30) * 0.12 * (1 - k / 0.4) : 1;
          items[i].scale.set(s2, 2 - s2, s2);
        });
      },
    };
  };

  VIS.launch = function (s, world, f) {
    const g = new THREE.Group();
    const h0 = world.sim.groundRaw(s.x, s.y);
    const capTex = T.mushroomCap();
    const cap = mesh(new THREE.SphereGeometry(s.r * 1.05, 28, 14, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: capTex, roughness: 0.45 }));
    cap.scale.y = 0.38;
    const gill = mesh(new THREE.CircleGeometry(s.r * 1.05, 28), M('#f3e6cf'));
    gill.rotation.x = Math.PI / 2; gill.position.y = 0.002;
    g.add(cap, gill);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    // little mushrooms around the course
    const rnd = U.rng(9);
    const box = world.hole.box;
    for (let i = 0; i < 26; i++) {
      const x = box.x0 - 2 + rnd() * (box.w + 4), y = box.y0 + rnd() * box.h;
      if (world.hole.floors.some(fl => U.inPoly(x, y, fl.poly) || U.distToPoly(x, y, fl.poly) < 0.45)) continue;
      const mg = new THREE.Group();
      const hgt = 0.15 + rnd() * 0.25, r = 0.08 + rnd() * 0.12;
      const stem = mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.45, hgt, 8), M('#f6ecd8'));
      stem.position.y = hgt / 2;
      const c = mesh(new THREE.SphereGeometry(r, 14, 8, 0, TAU, 0, Math.PI / 2), rnd() < 0.6 ? new THREE.MeshStandardMaterial({ map: capTex, roughness: 0.5 }) : M('#c98a4a'));
      c.position.y = hgt; c.scale.y = 0.7;
      mg.add(stem, c);
      world.holeGroup.add(at(mg, x, y, GY()));
    }
    return { update(t) { const k = t - f.hit; const sq = k < 0.5 ? Math.sin(k * 25) * 0.35 * (1 - k / 0.5) : 0; cap.scale.y = 0.38 * (1 - sq); cap.scale.x = cap.scale.z = 1 + sq * 0.3; } };
  };

  VIS.wheelbarrow = function (s, world) {
    const g = new THREE.Group();
    const len = s.y1 - s.y0, ang = Math.atan2(s.h, len);
    const trayMat = M('#c8412f', { metalness: 0.35, roughness: 0.45 });
    // tray bottom sits just under the ramp surface; low sides and a front lip
    const plate = mesh(new THREE.BoxGeometry(s.w + 0.12, 0.04, Math.hypot(len, s.h)), trayMat);
    plate.rotation.x = ang;
    plate.position.set(0, s.h / 2 - 0.025, -(s.y0 + len / 2));
    const sideL = mesh(new THREE.BoxGeometry(0.08, 0.1, Math.hypot(len, s.h)), M('#8f2a1e', { metalness: 0.35, roughness: 0.45 }));
    sideL.rotation.x = ang; sideL.position.set(-s.w / 2 - 0.06, s.h / 2 - 0.01, -(s.y0 + len / 2));
    const sideR = sideL.clone(); sideR.position.x = s.w / 2 + 0.06;
    // the ramp surface itself in metal so it reads as the tray
    const deck = mesh(new THREE.PlaneGeometry(s.w, Math.hypot(len, s.h)), M('#d9593f', { metalness: 0.3, roughness: 0.5 }));
    deck.rotation.x = -Math.PI / 2 + ang; deck.position.set(0, s.h / 2 + 0.004, -(s.y0 + len / 2));
    const wheel = mesh(new THREE.TorusGeometry(0.26, 0.08, 10, 24), M('#222222', { roughness: 0.9 }));
    wheel.rotation.y = Math.PI / 2; wheel.position.set(0, 0.0, -(s.y1 + 0.15));
    const hub = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), M('#bbbbbb', { metalness: 0.7, roughness: 0.3 }));
    hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position);
    const fork = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), M('#555555', { metalness: 0.6 }));
    fork.position.set(0, 0.1, -(s.y1 + 0.05));
    // handles out the back, up in the air
    [-1, 1].forEach(k => {
      const hnd = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), M('#8a5a32'));
      hnd.rotation.x = Math.PI / 2 - 0.55; hnd.position.set(k * (s.w / 2 + 0.06), 0.62, -(s.y0 - 0.35));
      g.add(hnd);
      const grip = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), M('#222222'));
      grip.rotation.x = Math.PI / 2 - 0.55; grip.position.set(k * (s.w / 2 + 0.06), 1.0, -(s.y0 - 0.95));
      g.add(grip);
    });
    g.add(plate, sideL, sideR, deck, wheel, hub, fork);
    world.holeGroup.add(g);
    return null;
  };

  VIS.maze = function (s, world) {
    // topiary balls on the ends of the hedge walls, and a little statue in the middle
    world.hole.rails.filter(r => r.side === 'center' && r.style === 'hedge').forEach(r => {
      [r.pts[0], r.pts[r.pts.length - 1]].forEach(p => {
        const inside = world.hole.floors.some(f => U.distToPoly(p[0], p[1], f.poly) > 0.3);
        if (!inside) return;
        const b = mesh(new THREE.IcosahedronGeometry(0.3, 2), new THREE.MeshStandardMaterial({ map: T.hedge(), roughness: 1 }));
        world.holeGroup.add(at(b, p[0], p[1], 0.62 + 0.22));
      });
    });
    const bath = new THREE.Group();
    const ped = mesh(lathe([[0, 0], [0.35, 0], [0.18, 0.12], [0.12, 0.7], [0.2, 0.8], [0.6, 0.86], [0.64, 0.96], [0.56, 0.95], [0.3, 0.86], [0, 0.85]], 24), M('#c9c1b1', { roughness: 0.9 }));
    const water = mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshPhysicalMaterial({ color: col('#5fb2d4'), roughness: 0.05, clearcoat: 1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.9;
    bath.add(ped, water);
    const bx = world.hole.box.x1 + 1.6, by = world.hole.box.cy;
    world.holeGroup.add(at(bath, bx, by, GY()));
    return null;
  };

  VIS.rockery = function (s, world) {
    // flat stones set flush into the mound, and alpine flowers around the base outside the rail
    const rnd = U.rng(21), sim = world.sim;
    for (let i = 0; i < 14; i++) {
      const a = rnd() * TAU, d = 0.9 + rnd() * 1.6;
      const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d;
      if (Math.abs(x) < 0.5 && y < s.y) continue;
      const r = 0.12 + rnd() * 0.12;
      const st = mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.02, 7), M('#b9b2a3', { roughness: 0.95 }), false);
      const e = 0.02;
      const hx = (sim.floorHeight(x + e, y) - sim.floorHeight(x - e, y)) / (2 * e), hy = (sim.floorHeight(x, y + e) - sim.floorHeight(x, y - e)) / (2 * e);
      st.position.copy(V(x, y, sim.floorHeight(x, y) + 0.004));
      st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-hx, 1, hy).normalize());
      world.holeGroup.add(st);
    }
    return null;
  };

  VIS.sunflower = function (s, world) {
    // giant petals all round the outside of the bowl
    const g = new THREE.Group();
    const n = 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if (Math.abs(U.wrapAngle(a + Math.PI / 2)) < 0.42) continue; // leave room for the lane
      const pm = mesh(new THREE.SphereGeometry(1, 16, 8), M(i % 2 ? '#ffc300' : '#ffd60a', { roughness: 0.6 }));
      pm.scale.set(1.25, 0.06, 0.42);
      const hold = new THREE.Group();
      pm.position.x = s.r + 0.45 + 1.1;
      pm.rotation.z = 0.12;
      hold.add(pm);
      hold.rotation.y = a;
      g.add(hold);
    }
    world.holeGroup.add(at(g, s.x, s.y, -0.08));
    // leaves and a stem going off behind
    [[-1, 0.7], [1, 2.3]].forEach(([k, a]) => {
      const lf = mesh(new THREE.SphereGeometry(1, 14, 8), M('#4f9a3a'));
      lf.scale.set(1.6, 0.06, 0.7); lf.rotation.y = a;
      world.holeGroup.add(at(lf, s.x + k * (s.r + 3.2), s.y + 2.6, GY() + 0.1));
    });
    return null;
  };

  VIS.brook = function (s, world, f) {
    const line = f.line, sim = world.sim, hw = s.width / 2;
    // pebbly bed under the water, then a moving water ribbon
    const bed = mesh(PC.surfaceGeometry(U.ribbon(line, hw * 0.9), (x, y) => sim.floorHeight(x, y), { lift: 0.005, uv: (x, y) => [x / 1.5, y / 1.5], cell: 0.15 }), new THREE.MeshStandardMaterial({ map: T.pebbles(), roughness: 1 }), false);
    world.holeGroup.add(bed);
    const pos = [], uv = [];
    let acc = 0;
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      if (i > 0) acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      const c = line[i];
      const fade = 1 - U.smooth(0.9, 1, acc / (f.line.length ? 1 : 1) / 30);
      const wy = sim.floorHeight(c[0], c[1]) + 0.07 * fade - 0.01;
      const w = hw * 0.82;
      pos.push(c[0] + nx * w, wy, -(c[1] + ny * w), c[0] - nx * w, wy, -(c[1] - ny * w));
      uv.push(0, acc / 1.5, 1, acc / 1.5);
    }
    const idx = [];
    for (let i = 0; i < line.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const n = T.waterNormal().clone(); n.needsUpdate = true; n.repeat.set(1, 1);
    const wm = new THREE.MeshPhysicalMaterial({ color: col('#6fc3e0'), transparent: true, opacity: 0.6, roughness: 0.05, normalMap: n, normalScale: new THREE.Vector2(0.5, 0.5), clearcoat: 1, depthWrite: false });
    const water = new THREE.Mesh(geo, wm);
    water.renderOrder = 2;
    world.holeGroup.add(water);
    // stones along the banks
    const rnd = U.rng(12), stones = [];
    for (let i = 0; i < line.length; i += 2) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const k = rnd() < 0.5 ? 1 : -1, d = hw * (0.95 + rnd() * 0.15);
      const x = line[i][0] - (dy / l) * d * k, y = line[i][1] + (dx / l) * d * k;
      if (!sim.floorAt(x, y)) continue;
      const ss = 0.06 + rnd() * 0.05; stones.push({ x, y: sim.floorHeight(x, y) + 0.01, z: -y, s: ss, sy: ss * 0.45, ry: rnd() * 6, c: rnd() < 0.5 ? '#b9b2a3' : '#9a958b' });
    }
    instanced(world, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), stones, false);
    let foamT = 0;
    return {
      update(t, dt) {
        n.offset.set(0, -t * 0.25);
        foamT += dt;
        if (foamT > 0.18) {
          foamT = 0;
          const i = Math.floor(Math.random() * (line.length * 0.85));
          const c = line[i];
          const nx = line[i + 1][0] - c[0], ny = line[i + 1][1] - c[1], l = Math.hypot(nx, ny) || 1;
          world.glow.spawn({ x: c[0] + (Math.random() - 0.5) * hw, y: sim.floorHeight(c[0], c[1]) + 0.07, z: -(c[1] + (Math.random() - 0.5) * hw), vx: (nx / l) * 0.9, vy: 0, vz: -(ny / l) * 0.9, g: 0, drag: 1, life: 1.6, size: 0.04, color: col('#ffffff'), a: 0.6 });
        }
      },
    };
  };

  VIS.koi = function (s, world) {
    const g = new THREE.Group();
    const red = M('#c0392b', { roughness: 0.5 });
    const arch = y => 0.55 * Math.sin((Math.PI * (y - s.y0)) / (s.y1 - s.y0));
    // posts and a hand rail following the arch, on both sides
    [-1, 1].forEach(k => {
      const x = k * (s.hw + 0.02);
      const pts = [];
      for (let y = s.y0; y <= s.y1 + 1e-6; y += 0.6) {
        const post = mesh(new THREE.BoxGeometry(0.07, 0.34, 0.07), red);
        post.position.copy(V(x, y, arch(y) + 0.17));
        g.add(post);
      }
      for (let y = s.y0; y <= s.y1 + 1e-6; y += 0.15) pts.push(V(x, y, arch(y) + 0.34));
      const curve = new THREE.CatmullRomCurve3(pts);
      g.add(mesh(new THREE.TubeGeometry(curve, 40, 0.035, 6, false), red));
      // side fascia from deck down to the water
      const shape = [];
      for (let y = s.y0; y <= s.y1 + 1e-6; y += 0.2) shape.push([y, arch(y)]);
      const pos = [];
      for (let i = 0; i < shape.length - 1; i++) {
        const [y0, h0] = shape[i], [y1, h1] = shape[i + 1];
        const b0 = h0 - 0.14, b1 = h1 - 0.14;
        pos.push(x, h0, -y0, x, b0, -y0, x, h1, -y1, x, h1, -y1, x, b0, -y0, x, b1, -y1);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      g.add(mesh(geo, new THREE.MeshStandardMaterial({ color: col('#a8322a'), side: THREE.DoubleSide, roughness: 0.6 })));
    });
    world.holeGroup.add(g);
    // koi
    const fish = [];
    const cols = ['#ff7a1a', '#ffffff', '#ffb000', '#ff5a36', '#f5f5f5', '#ffa23a'];
    for (let i = 0; i < 7; i++) {
      const fg = new THREE.Group();
      const body = mesh(new THREE.SphereGeometry(0.16, 12, 8), M(cols[i], { roughness: 0.4 }), false);
      body.scale.set(1.9, 0.5, 0.65);
      const spot = mesh(new THREE.SphereGeometry(0.07, 8, 6), M(i % 2 ? '#ff5a1a' : '#ffffff'), false);
      spot.position.set(0.05, 0.05, 0); spot.scale.set(1.4, 0.4, 0.8);
      const tail = mesh(new THREE.ConeGeometry(0.12, 0.2, 6), M(cols[i]), false);
      tail.rotation.z = Math.PI / 2; tail.position.x = -0.34; tail.scale.z = 0.3;
      fg.add(body, spot, tail);
      world.holeGroup.add(fg);
      fish.push({ fg, tail, ph: i * 0.9, r: 1.6 + (i % 3) * 0.9, cx: i % 2 ? -2.6 : 2.6, cy: 8.7, sp: 0.35 + (i % 3) * 0.12 });
    }
    // a stone lantern and a pink-blossom tree
    const lan = new THREE.Group();
    const stone = M('#a9a397', { roughness: 0.95 });
    const b1 = mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.15, 6), stone); b1.position.y = 0.07;
    const b2 = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.6, 6), stone); b2.position.y = 0.45;
    const b3 = mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), stone); b3.position.y = 0.88;
    const glow = mesh(new THREE.BoxGeometry(0.2, 0.14, 0.36), new THREE.MeshStandardMaterial({ color: col('#ffe7a3'), emissive: col('#ffcf6a'), emissiveIntensity: 0.6 })); glow.position.y = 0.88;
    const roof = mesh(new THREE.ConeGeometry(0.42, 0.24, 6), stone); roof.position.y = 1.13;
    lan.add(b1, b2, b3, glow, roof);
    world.holeGroup.add(at(lan, -3.3, 12.6, GY()));
    VIS.tree(world, 5.6, 14.6, { colors: ['#f7a8c4', '#f9c4d6', '#f48fb1'], h: 2.4, s: 1.3 });
    return {
      update(t) {
        fish.forEach(fi => {
          const a = t * fi.sp + fi.ph;
          const x = fi.cx + Math.cos(a) * fi.r * 0.7, y = fi.cy + Math.sin(a) * fi.r * 0.55;
          fi.fg.position.copy(V(x, y, PC.C.WATER_TOP - 0.12));
          fi.fg.rotation.y = a + Math.PI / 2 + Math.PI;
          fi.tail.rotation.y = Math.sin(t * 8 + fi.ph) * 0.5;
          fi.fg.visible = !world.sim.floorAt(x, y);
        });
      },
    };
  };

  VIS.swing = function (s, world, f) {
    const tx = s.x - 5.6;
    const tree = VIS.tree(world, tx, s.y, { h: 5.6, s: 1.7, blobs: 8, colors: ['#3f7d2f', '#4f9038', '#356b29'] });
    const branch = mesh(new THREE.CylinderGeometry(0.1, 0.2, 6.2, 8), M('#6b4a2f', { roughness: 1 }));
    branch.rotation.z = Math.PI / 2 - 0.04;
    branch.position.copy(V(s.x - 2.6, s.y, s.zp + 0.12));
    world.holeGroup.add(branch);
    const rope = mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), M('#c9a36a'));
    const tire = mesh(new THREE.TorusGeometry(s.rt - 0.12, 0.13, 12, 28), M('#262626', { roughness: 0.85 }));
    world.holeGroup.add(rope, tire);
    void tree;
    return {
      update() {
        const px = s.x, pz = s.zp;
        tire.position.copy(V(f.xc, s.y, f.zc));
        tire.rotation.z = -f.th;
        const top = V(px, s.y, pz), bot = V(f.xc, s.y, f.zc + s.rt - 0.05);
        const mid = top.clone().add(bot).multiplyScalar(0.5);
        rope.position.copy(mid);
        rope.scale.y = top.distanceTo(bot);
        rope.rotation.z = -f.th;
      },
    };
  };

  VIS.hive = function (s, world) {
    const bees = [];
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Group();
      const body = mesh(new THREE.SphereGeometry(0.04, 8, 6), M('#ffcc00'), false); body.scale.x = 1.4;
      const stripe = mesh(new THREE.SphereGeometry(0.041, 8, 6), M('#222222'), false); stripe.scale.set(0.5, 1, 1);
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      w.rotation.x = Math.PI / 2; w.position.y = 0.03;
      b.add(body, stripe, w);
      world.holeGroup.add(b);
      bees.push({ b, w, ph: i * 1.7, r: 0.5 + (i % 4) * 0.25, sp: 1.2 + (i % 3) * 0.5 });
    }
    // tipped honey pots spilling outside the green
    const box = world.hole.box;
    [[box.x1 + 1.1, 6.6, 1.2], [box.x0 - 1.2, 11.8, -1.6]].forEach(([x, y, r]) => {
      const pot = VIS.pot(0.34, 0.6, U.rng(4), null);
      pot.rotation.set(0, r, Math.PI / 2.3);
      world.holeGroup.add(at(pot, x, y, GY() + 0.3));
      const spill = mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshPhysicalMaterial({ color: col('#f0a41a'), roughness: 0.1, clearcoat: 1 }), false);
      spill.rotation.x = -Math.PI / 2;
      world.holeGroup.add(at(spill, x - Math.sign(x) * 0.5, y, GY() + 0.012));
    });
    return {
      update(t) {
        bees.forEach(be => {
          const a = t * be.sp + be.ph;
          be.b.position.copy(V(s.x + Math.cos(a) * be.r + Math.sin(t * 7 + be.ph) * 0.05, s.y + Math.sin(a * 1.3) * be.r, 0.6 + Math.sin(a * 2.1) * 0.25));
          be.b.rotation.y = -a;
          be.w.rotation.z = Math.sin(t * 60 + be.ph) * 0.8;
        });
      },
    };
  };

  VIS.wind = function (s, world, f) {
    const box = world.hole.box;
    const pole = mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 8), M('#dddddd', { metalness: 0.5, roughness: 0.4 }));
    const px = box.x0 - 1.2, py = box.cy;
    world.holeGroup.add(at(pole, px, py, GY() + 1.2));
    const sockG = new THREE.Group();
    const sock = mesh(new THREE.CylinderGeometry(0.16, 0.08, 1.0, 14, 5, true), new THREE.MeshStandardMaterial({ map: T.pole(), side: THREE.DoubleSide, roughness: 0.7 }));
    sock.rotation.z = Math.PI / 2; sock.position.x = 0.5;
    sockG.add(sock);
    world.holeGroup.add(at(sockG, px, py, GY() + 2.3));
    const leafCols = ['#e8701a', '#d93a2f', '#f2b234', '#b9551c'].map(col);
    // leaf piles outside the course
    const rnd = U.rng(17), piles = [];
    for (let i = 0; i < 70; i++) {
      const cx = box.x0 - 2 + rnd() * (box.w + 4), cy = box.y0 + rnd() * box.h;
      if (world.hole.floors.some(fl => U.inPoly(cx, cy, fl.poly) || U.distToPoly(cx, cy, fl.poly) < 0.5) || world.hole.hazards.some(z => U.inPoly(cx, cy, z.poly) || U.distToPoly(cx, cy, z.poly) < 0.4)) continue;
      piles.push({ x: cx, y: GY() + 0.03, z: -cy, s: 0.07 + rnd() * 0.05, sy: 0.3, ry: rnd() * 6, rx: rnd() * 0.5, c: ['#e8701a', '#d93a2f', '#f2b234', '#b9551c'][i % 4] });
    }
    instanced(world, new THREE.CircleGeometry(1, 6), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }), piles.map(p => Object.assign(p, { rx: -Math.PI / 2 + p.rx, sx: p.s * 1.4, sy: p.s, sz: 1 })), false);
    let acc = 0;
    return {
      update(t, dt) {
        const k = f.gust;
        sockG.rotation.z = -1.2 + k * 1.15 + Math.sin(t * 3) * 0.05;
        sockG.rotation.y = Math.sin(t * 0.8) * 0.15 * (1 - k);
        acc += dt * (0.5 + k * 14 + f.warn * 2);
        while (acc > 1) {
          acc -= 1;
          const y = box.y0 + Math.random() * box.h;
          world.fx.spawn({ x: box.x0 - 3, y: 0.3 + Math.random() * 1.6, z: -y, vx: 3 + k * 6 + Math.random() * 2, vy: Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.6, g: -0.4, drag: 1, life: 3.2, size: 0.1 + Math.random() * 0.05, color: leafCols[Math.floor(Math.random() * 4)], wobble: 3, seed: Math.random() * 9 });
        }
      },
    };
  };

  VIS.carrots = function (s, world) {
    const sim = world.sim, items = [], roots = [];
    const ca = Math.cos(s.a), sa = Math.sin(s.a);
    for (let k = -6; k < 20; k++) {
      const u0 = s.pitch * (k + 0.5);
      for (let x = -3.1; x <= 3.1; x += 0.34) {
        const y = (u0 - x * sa) / ca;
        if (y < s.y0 + 0.4 || y > s.y1 - 0.4 || !sim.floorAt(x, y)) continue;
        const h = sim.floorHeight(x, y);
        for (let j = 0; j < 4; j++) items.push({ x: x + (Math.random() - 0.5) * 0.04, y: h + 0.08, z: -y, sx: 0.012, sy: 0.16 + Math.random() * 0.06, sz: 0.012, rx: (Math.random() - 0.5) * 0.7, rz: (Math.random() - 0.5) * 0.7, c: j % 2 ? '#3f8a2e' : '#5aa845' });
        roots.push({ x, y: h + 0.01, z: -y, s: 0.035, sy: 0.04, c: '#f07a1a' });
      }
    }
    instanced(world, new THREE.ConeGeometry(1, 1, 4), new THREE.MeshStandardMaterial({ roughness: 0.8 }), items, false);
    instanced(world, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), roots, false);
    // a scarecrow beside the patch
    const sc = new THREE.Group();
    const wood = M('#8a5a32');
    const p1 = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), wood); p1.position.y = 1.1;
    const p2 = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), wood); p2.rotation.z = Math.PI / 2; p2.position.y = 1.6;
    const shirt = mesh(new THREE.BoxGeometry(0.5, 0.6, 0.25), M('#3a6fb0')); shirt.position.y = 1.45;
    const head = mesh(new THREE.SphereGeometry(0.2, 12, 10), M('#e8d29a')); head.position.y = 2.0;
    const hat = mesh(new THREE.ConeGeometry(0.32, 0.3, 14), M('#a07a3a')); hat.position.y = 2.25;
    const brim = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 16), M('#a07a3a')); brim.position.y = 2.12;
    sc.add(p1, p2, shirt, head, hat, brim);
    world.holeGroup.add(at(sc, world.hole.box.x1 + 2, 8, GY()));
    sc.rotation.y = -Math.PI / 2 - 0.3;
    return null;
  };

  VIS.turntable = function (s, world, f) {
    const g = new THREE.Group();
    const disc = mesh(new THREE.CircleGeometry(s.r, 64), new THREE.MeshStandardMaterial({ map: T.daisy(), roughness: 0.85 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.008;
    g.add(disc);
    const gap = mesh(new THREE.RingGeometry(s.r - 0.01, s.r + 0.035, 64), M('#2a3a1f'), false);
    gap.rotation.x = -Math.PI / 2; gap.position.y = 0.006;
    world.holeGroup.add(at(gap, s.x, s.y, 0));
    const pots = (s.pots || []).map((p, i) => { const pg = VIS.pot(p.r, 0.6, U.rng(i + 3), world.hole.look.flowers); g.add(pg); return pg; });
    world.holeGroup.add(at(g, s.x, s.y, 0));
    return {
      update() {
        disc.rotation.z = f.ang;
        f.pots().forEach((p, i) => { pots[i].position.set(p.x - s.x, 0, -(p.y - s.y)); pots[i].rotation.y = f.ang; });
      },
    };
  };

  VIS.movingCup = function (s, world, f) {
    // a groove for the pot to run in, and the pot rim around the cup
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) + C.CUP_R * 2 + 0.2;
    const slot = mesh(new THREE.PlaneGeometry(len, C.CUP_R * 2 + 0.16), M('#5b3b22', { roughness: 1 }), false);
    slot.rotation.x = -Math.PI / 2;
    slot.rotation.z = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
    world.holeGroup.add(at(slot, (s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, 0.003));
    const rim = mesh(new THREE.TorusGeometry(C.CUP_R + 0.05, 0.05, 10, 32), M('#c8693c', { roughness: 0.85 }));
    rim.rotation.x = -Math.PI / 2;
    world.holeGroup.add(rim);
    const ends = [s.a, s.b].map(e => { const st = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 10), M('#8a5a32')); world.holeGroup.add(at(st, e[0] + Math.sign(e[0]) * 0.45, e[1], 0.06)); return st; });
    void ends;
    return { update() { rim.position.copy(V(f.x, f.y, 0.01)); } };
  };

  VIS.seesaw = function (s, world, f) {
    const g = new THREE.Group();
    const w = s.x1 - s.x0, l = s.y1 - s.y0;
    const plank = mesh(new THREE.BoxGeometry(w, 0.08, l), new THREE.MeshStandardMaterial({ map: T.planks(), roughness: 0.8 }));
    plank.position.y = -0.04;
    const tex = plank.material.map; tex.repeat.set(1, 2);
    g.add(plank);
    // cross battens
    for (let i = 0; i < 4; i++) { const bt = mesh(new THREE.BoxGeometry(w + 0.04, 0.03, 0.08), M('#6b4a2f')); bt.position.set(0, 0.005, -l / 2 + 0.4 + i * (l - 0.8) / 3); g.add(bt); }
    world.holeGroup.add(at(g, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, 0));
    const log = mesh(new THREE.CylinderGeometry(0.16, 0.16, l + 0.6, 12), M('#7a5230', { roughness: 1 }));
    log.rotation.x = Math.PI / 2;
    world.holeGroup.add(at(log, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, -0.26));
    return { update() { g.rotation.z = f.th; } };
  };

  VIS.beanstalk = function (s, world, f) {
    const btn = new THREE.Group();
    const packet = mesh(new THREE.BoxGeometry(0.72, 0.03, 0.54), [M('#f4e6c3'), M('#f4e6c3'), new THREE.MeshStandardMaterial({ map: T.seedPacket(), roughness: 0.7 }), M('#f4e6c3'), M('#f4e6c3'), M('#f4e6c3')]);
    packet.position.y = 0.015;
    const ring = mesh(new THREE.RingGeometry(s.br + 0.02, s.br + 0.1, 40), new THREE.MeshBasicMaterial({ color: col('#ffe066'), transparent: true, opacity: 0.6 }), false);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
    btn.add(packet, ring);
    world.holeGroup.add(at(btn, s.button[0], s.button[1], 0));
    // a seed packet on a stake outside the rail, pointing the way
    const stake = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), M('#8a5a32')); pole.position.y = 0.65;
    const sign = mesh(new THREE.BoxGeometry(0.62, 0.46, 0.03), [M('#f4e6c3'), M('#f4e6c3'), M('#f4e6c3'), M('#f4e6c3'), new THREE.MeshStandardMaterial({ map: T.seedPacket(), roughness: 0.7 }), M('#f4e6c3')]);
    sign.position.y = 1.35;
    stake.add(pole, sign);
    world.holeGroup.add(at(stake, world.hole.box.x0 - 0.7, s.button[1], PC.GROUND_Y));
    const padRnd = U.rng(8);
    world.hole.hazards.forEach(hz => { const b = U.bounds([hz.poly]); for (let i = 0; i < 6; i++) { const x = b.x0 + 0.4 + padRnd() * (b.w - 0.8), y = b.y0 + 0.3 + padRnd() * (b.h - 0.6); if (Math.abs(x - (s.rect[0] + s.rect[2]) / 2) < 1.1) continue; const r = 0.22 + padRnd() * 0.2; const shp = new THREE.Shape(); shp.absarc(0, 0, r, 0.3, TAU - 0.3, false); shp.lineTo(0, 0); const m = mesh(new THREE.ShapeGeometry(shp, 16), M('#4f9a3a', { roughness: 0.6 }), false); m.rotation.x = -Math.PI / 2; m.rotation.z = padRnd() * 6; m.position.copy(V(x, y, hz.top - 0.005)); world.holeGroup.add(m); } });
    const r = s.rect, len = r[3] - r[1], w = r[2] - r[0];
    const bridge = new THREE.Group();
    const deck = mesh(new THREE.BoxGeometry(w, 0.1, len), new THREE.MeshStandardMaterial({ map: T.vine(), roughness: 0.8 }));
    deck.position.set(0, -0.05, -len / 2);
    bridge.add(deck);
    // twisting vine edges and leaves
    const leafMat = M('#5aa845', { roughness: 0.7 });
    const leaves = [];
    [-1, 1].forEach(k => {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(k * (w / 2) + Math.sin(t * 14) * 0.05, 0.02 + Math.cos(t * 14) * 0.04, -t * len)); }
      bridge.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.05, 6), M('#3f8a2e')));
      for (let i = 0; i < 7; i++) { const lf = mesh(new THREE.SphereGeometry(0.14, 10, 6), leafMat); lf.scale.set(1, 0.15, 0.55); lf.position.set(k * (w / 2 + 0.08), 0.05, -(0.3 + i * (len - 0.6) / 6)); lf.rotation.y = k * 0.6; bridge.add(lf); leaves.push(lf); }
    });
    world.holeGroup.add(at(bridge, (r[0] + r[2]) / 2, r[1], 0));
    // the sprout on the near shore
    const sprout = new THREE.Group();
    const sp1 = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.35, 0), new THREE.Vector3(-0.08, 0.7, 0.05), new THREE.Vector3(0.12, 1.0, 0)]), 20, 0.04, 6), M('#3f8a2e'));
    sprout.add(sp1);
    [[0.1, 0.35, 0.7], [-0.08, 0.7, -0.8], [0.12, 1.0, 0.4]].forEach(([x, y, r]) => { const lf = mesh(new THREE.SphereGeometry(0.14, 10, 6), M('#5aa845')); lf.scale.set(1, 0.18, 0.55); lf.position.set(x + Math.sign(r) * 0.1, y, 0); lf.rotation.z = r; sprout.add(lf); });
    world.holeGroup.add(at(sprout, (r[0] + r[2]) / 2 - w / 2 - 0.3, r[1] - 0.3, 0));
    const green = col('#3f8a2e'), brown = col('#8a6a2a');
    let last = -9;
    return {
      update(t) {
        const gr = f.grown;
        bridge.visible = gr > 0.01;
        bridge.scale.set(Math.min(1, gr * 3), Math.min(1, gr * 2), Math.max(0.001, gr));
        ring.material.opacity = 0.35 + 0.35 * Math.sin(t * 4) * (f.left > 0 ? 0.3 : 1);
        packet.position.y = t - f.pressed < 0.3 ? 0.005 : 0.015;
        const wilt = f.left > 0 && f.left < 3 ? 1 - f.left / 3 : 0;
        leafMat.color.copy(green).lerp(brown, wilt);
        sprout.rotation.z = Math.sin(t * 1.5) * 0.05;
        if (f.t0 !== last && t - f.t0 < 0.1) { last = f.t0; world.burst('spark', s.button[0], s.button[1], 0.05, { color: '#b6f26b', n: 24 }); }
      },
    };
  };

  VIS.gates = function (s, world, f) {
    const doors = f.list.map(g => {
      const dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1], len = Math.hypot(dx, dy), half = len / 2;
      const ang = Math.atan2(dy, dx);
      const make = (hinge, dir) => {
        const piv = new THREE.Group();
        const leafShape = new THREE.Shape();
        leafShape.moveTo(0, 0); leafShape.lineTo(0, 0.5); leafShape.bezierCurveTo(half * 0.45, 0.62, half * 0.85, 0.5, half - 0.01, 0.3); leafShape.lineTo(half - 0.01, 0); leafShape.lineTo(0, 0);
        const lm = mesh(new THREE.ExtrudeGeometry(leafShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }), M('#5cb043', { roughness: 0.55 }));
        lm.position.z = -0.03;
        const vein = mesh(new THREE.BoxGeometry(half - 0.06, 0.025, 0.09), M('#3a7a2a'));
        vein.position.set(half / 2, 0.26, 0); vein.rotation.z = -0.25;
        const holder = new THREE.Group(); holder.add(lm, vein);
        holder.scale.x = dir;
        piv.add(holder);
        piv.position.copy(V(hinge[0], hinge[1], 0));
        piv.rotation.y = ang;
        world.holeGroup.add(piv);
        return piv;
      };
      const tulip = (p) => {
        const tg = new THREE.Group();
        const stem = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 6), M('#3f8a2e')); stem.position.y = 0.42;
        const lf = mesh(new THREE.SphereGeometry(0.16, 10, 6), M('#4f9a3a')); lf.scale.set(0.35, 1.2, 0.12); lf.position.set(0.05, 0.25, 0); lf.rotation.z = -0.3;
        tg.add(lf);
        const petals = [];
        const c = (world.hole.look.flowers || ['#ef4444'])[(Math.abs(Math.round(p[0] * 10)) + Math.round(p[1])) % 3];
        for (let i = 0; i < 6; i++) { const pt = mesh(new THREE.SphereGeometry(0.2, 12, 8), M(c, { roughness: 0.45 })); pt.scale.set(0.5, 1, 0.28); pt.position.y = 0.18; const hh = new THREE.Group(); hh.add(pt); hh.rotation.y = (i / 6) * TAU; hh.position.y = 0.86; tg.add(hh); petals.push(hh); }
        tg.add(stem);
        world.holeGroup.add(at(tg, p[0], p[1], 0.55));
        return petals;
      };
      return { g, a: make(g.a, 1), b: make(g.b, -1), pa: tulip(g.a), pb: tulip(g.b), ang };
    });
    return {
      update() {
        doors.forEach(d => {
          const o = U.smooth(0, 1, d.g.open);
          d.a.rotation.y = d.ang + o * 1.45;
          d.b.rotation.y = d.ang - o * 1.45;
          [d.pa, d.pb].forEach(ps => ps.forEach(p => { p.children[0].rotation.x = 0.12 + o * 0.85; }));
        });
      },
    };
  };

  VIS.greenhouse = function (s, world) {
    // white hoop ribs over the green and hanging baskets
    const g = new THREE.Group();
    const white = M('#ffffff', { roughness: 0.5 });
    const sim = world.sim;
    for (let y = s.y0 + 1.5; y < s.y1 - 0.5; y += 2.4) {
      const h = sim.floorHeight(0, y);
      const pts = [];
      for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); pts.push(new THREE.Vector3(Math.cos(a) * (s.x1 + 0.12), h + 1.5 + Math.sin(a) * 1.4, -y)); }
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.035, 6), white));
    }
    const ridge = [];
    for (let y = s.y0 + 1.5; y < s.y1 - 0.5; y += 0.5) ridge.push(new THREE.Vector3(0, sim.floorHeight(0, y) + 2.9, -y));
    if (ridge.length > 1) g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridge), 20, 0.03, 6), white));
    world.holeGroup.add(g);
    // potting benches outside the glass
    [s.x0 - 1.3, s.x1 + 1.3].forEach((x, i) => {
      const bench = mesh(new THREE.BoxGeometry(0.8, 0.06, 3.5), M('#8a5a32'));
      world.holeGroup.add(at(bench, x, 5 + i * 4, GY() + 0.8));
      for (let k = 0; k < 3; k++) { const p = VIS.pot(0.18, 0.4, U.rng(k + i * 5), world.hole.look.flowers); world.holeGroup.add(at(p, x, 4 + i * 4 + k * 1.0, GY() + 0.83)); }
      [-1, 1].forEach(e => { const leg = mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), M('#6b4a2f')); world.holeGroup.add(at(leg, x + 0.3, 5 + i * 4 + e * 1.6, GY() + 0.4)); });
    });
    return null;
  };

  VIS.trellis = function (s, world) {
    // a rose arch over the stepping stones behind the tee
    const [tx, ty] = world.hole.tee;
    const g = new THREE.Group();
    const white = M('#fbfaf5', { roughness: 0.6 });
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); pts.push(new THREE.Vector3(Math.cos(a) * 0.9, 1.3 + Math.sin(a) * 0.6, 0)); }
    [-0.12, 0.12].forEach(z => {
      const p2 = pts.map(p => new THREE.Vector3(p.x, p.y, z));
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p2), 30, 0.035, 6), white));
      [-0.9, 0.9].forEach(x => { const leg = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6), white); leg.position.set(x, 0.65, z); g.add(leg); });
    });
    const rnd = U.rng(31);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * rnd(), rr = mesh(new THREE.SphereGeometry(0.05 + rnd() * 0.03, 8, 6), M((world.hole.look.flowers || ['#e11d48'])[i % 3]));
      rr.position.set(Math.cos(a) * 0.9, 1.3 + Math.sin(a) * 0.6, (rnd() - 0.5) * 0.3);
      g.add(rr);
    }
    world.holeGroup.add(at(g, tx, ty - 3.4, GY()));
    return null;
  };

  VIS.falls = function (s, world) {
    // a stepped stream with waterfalls just outside the right-hand rail
    const box = world.hole.box;
    const x = box.x1 + 0.75, w = 0.9;
    const levels = [[box.y0 - 1, s.steps[0], 1.0], [s.steps[0], s.steps[1], 0.5], [s.steps[1], box.y1 + 1, 0.0]];
    const stone = world.railMaterials('stone');
    const n = T.waterNormal().clone(); n.needsUpdate = true;
    const wm = new THREE.MeshPhysicalMaterial({ color: col('#5bb4d6'), transparent: true, opacity: 0.8, roughness: 0.05, normalMap: n, clearcoat: 1 });
    levels.forEach(([y0, y1, h]) => {
      const bed = mesh(new THREE.BoxGeometry(w + 0.5, h - GY() + 0.05, y1 - y0), stone.body);
      bed.position.copy(V(x, (y0 + y1) / 2, (h + GY()) / 2 - 0.05));
      world.holeGroup.add(bed);
      const water = mesh(new THREE.PlaneGeometry(w, y1 - y0), wm, false);
      water.rotation.x = -Math.PI / 2;
      water.position.copy(V(x, (y0 + y1) / 2, h + 0.02));
      world.holeGroup.add(water);
    });
    const sheets = s.steps.map((y, i) => {
      const hTop = levels[i][2], hBot = levels[i + 1][2];
      const sh = mesh(new THREE.PlaneGeometry(w, hTop - hBot), new THREE.MeshPhysicalMaterial({ color: col('#e6f7ff'), transparent: true, opacity: 0.7, roughness: 0.1, normalMap: n, side: THREE.DoubleSide }), false);
      sh.position.copy(V(x, y + 0.02, (hTop + hBot) / 2 + 0.02));
      world.holeGroup.add(sh);
      return { y, h: hBot };
    });
    // the terrace edges get a stone lip
    s.steps.forEach((y, i) => {
      const lip = mesh(new THREE.BoxGeometry(box.w, 0.04, 0.12), stone.cap || stone.body);
      lip.position.copy(V(box.cx, y - 0.06, levels[i][2] + 0.02));
      world.holeGroup.add(lip);
    });
    let acc = 0;
    return {
      update(t, dt) {
        n.offset.set(0, -t * 0.4);
        acc += dt;
        while (acc > 0.03) {
          acc -= 0.03;
          const sh = sheets[Math.floor(Math.random() * sheets.length)];
          world.glow.spawn({ x: x + (Math.random() - 0.5) * w, y: sh.h + 0.05, z: -(sh.y + 0.1), vx: (Math.random() - 0.5) * 0.5, vy: 0.6 + Math.random() * 0.8, vz: -Math.random() * 0.6, g: -6, life: 0.5, size: 0.05, color: col('#ffffff'), a: 0.8 });
        }
      },
    };
  };

  VIS.boost = function (s, world, f) {
    const heads = f.pads.map(p => {
      const h0 = world.sim.groundRaw(p.x, p.y);
      const pad = new THREE.Group();
      const ring = mesh(new THREE.RingGeometry(p.r * 0.75, p.r, 36), new THREE.MeshStandardMaterial({ color: col('#ffe066'), roughness: 0.5, emissive: col('#ffcc33'), emissiveIntensity: 0.25 }), false);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006;
      pad.add(ring);
      // chevrons pointing the way it blows
      for (let i = 0; i < 2; i++) {
        const sh = new THREE.Shape();
        sh.moveTo(-0.2, -0.08 + i * 0.2); sh.lineTo(0, 0.04 + i * 0.2); sh.lineTo(0.2, -0.08 + i * 0.2); sh.lineTo(0.2, -0.0 + i * 0.2); sh.lineTo(0, 0.12 + i * 0.2); sh.lineTo(-0.2, -0.0 + i * 0.2);
        const ch = mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: col('#fff6c8'), emissive: col('#ffe066'), emissiveIntensity: 0.4 }), false);
        ch.rotation.x = -Math.PI / 2; ch.position.y = 0.008 + i * 0.001;
        const hold = new THREE.Group(); hold.add(ch); hold.rotation.y = Math.atan2(p.dy, p.dx) - Math.PI / 2;
        pad.add(hold);
      }
      world.holeGroup.add(at(pad, p.x, p.y, h0));
      // the dandelion clock beside it
      const side = [p.x - p.dy * (p.r + 0.35), p.y + p.dx * (p.r + 0.35)];
      const dg = new THREE.Group();
      const stem = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.95, 6), M('#6aa84f')); stem.position.y = 0.47;
      const head = new THREE.Group();
      const core = mesh(new THREE.SphereGeometry(0.05, 8, 6), M('#c8b98a')); head.add(core);
      const fluff = [];
      for (let i = 0; i < 60; i++) { const a = Math.acos(1 - 2 * (i + 0.5) / 60), b = i * 2.4; fluff.push(new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b))); }
      const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.4, emissive: col('#ffffff'), emissiveIntensity: 0.15 }), fluff.length);
      fluff.forEach((v, i) => { const m = new THREE.Matrix4().compose(v.clone().multiplyScalar(0.25), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); seeds.setMatrixAt(i, m); });
      head.add(seeds);
      head.position.y = 1.0;
      dg.add(stem, head);
      world.holeGroup.add(at(dg, side[0], side[1], h0));
      return { p, head, ring };
    });
    return {
      update(t) {
        heads.forEach(hd => {
          const k = t - hd.p.hit;
          if (k >= 0 && k < 0.05 && !hd.fired) { hd.fired = true; world.burst('seeds', hd.p.x, hd.p.y, 0.3, { dx: hd.p.dx * 2, dy: hd.p.dy * 2 }); }
          if (k > 0.05) hd.fired = false;
          const s2 = k < 3 ? U.smooth(0.2, 3, k) : 1;
          hd.head.scale.setScalar(0.2 + 0.8 * s2);
          hd.ring.material.emissiveIntensity = 0.25 + Math.sin(t * 3 + hd.p.x) * 0.15;
        });
      },
    };
  };

  // Things that only need the generic look
  VIS.decor = () => null;
})(window.PC = window.PC || {});
