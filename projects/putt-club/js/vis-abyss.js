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
  const basaltMat = () => { const b = T.basalt(); return new THREE.MeshStandardMaterial({ map: b.map, emissiveMap: b.glow, emissive: col('#ff6a1a'), emissiveIntensity: 1.3, roughness: 0.95 }); };
  const rockGeo = (r, seed) => {
    const g = new THREE.DodecahedronGeometry(r, 1), rnd = U.rng(seed), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.82 + rnd() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
    g.computeVertexNormals();
    return g;
  };
  const ember = (world, x, y, h, o = {}) => world.glow.spawn(Object.assign({ x, y: h, z: -y, vx: (Math.random() - 0.5) * 0.3, vy: 0.6 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.3, g: 0.2, drag: 0.99, life: 1.6 + Math.random(), size: 0.05 + Math.random() * 0.04, color: col(Math.random() < 0.5 ? '#ff7a2a' : '#ffc04a'), wobble: 0.6, seed: Math.random() * 9 }, o));

  // ---------- The hellscape around each hole ----------
  VIS.decorateAbyss = function (hole, world) {
    const rnd = U.rng(U.hash(hole.id));
    const box = hole.box, G = world.holeGroup;
    const polys = hole.floors.map(f => f.poly).concat(hole.hazards.map(z => z.poly));
    const clear = (x, y, m) => polys.every(P => !U.inPoly(x, y, P) && U.distToPoly(x, y, P) > m);
    const bm = basaltMat();

    // Floating rocks below and around the platforms
    const rocks = [];
    for (let i = 0; i < 300 && rocks.length < 22; i++) {
      const x = box.x0 - 16 + rnd() * (box.w + 32), y = box.y0 - 8 + rnd() * (box.h + 18);
      if (!clear(x, y, 3.5)) continue;
      rocks.push({ x, y: -3 - rnd() * 5, z: -y, s: 0.4 + rnd() * 1.0, ry: rnd() * 6, rx: rnd(), sy: 0.6 + rnd() * 0.5 });
    }
    VIS.instanced(world, rockGeo(1, 3), bm, rocks.map(r => Object.assign(r, { sy: r.s * r.sy })), false);
    // Basalt spires rising out of the lava sea
    const spires = [], tips = [];
    for (let i = 0; i < 70; i++) {
      const a = rnd() * TAU, d = 14 + rnd() * 60, x = box.cx + Math.cos(a) * d, y = box.cy + Math.sin(a) * d;
      if (y < hole.tee[1] - 2 && Math.abs(x - hole.tee[0]) < 9 && d < 30) continue;
      const h = d < 32 ? 4 + rnd() * 5 : 6 + rnd() * 14, r = 0.8 + rnd() * 2.2;
      spires.push({ x, y: -16 + (h + 7) / 2, z: -y, sx: r, sy: h + 7, sz: r, ry: rnd() * 6 });
      if (rnd() < 0.3) tips.push({ x, y: -9 + h + 0.2, z: -y, s: r * 0.3 });
    }
    VIS.instanced(world, new THREE.ConeGeometry(1, 1, 7), bm, spires, false);
    VIS.instanced(world, new THREE.SphereGeometry(1, 8, 6), glowM('#ff6a1a', 1.0), tips, false);
    // Distant volcanoes
    const volc = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + rnd(), d = 95 + rnd() * 40;
      const x = box.cx + Math.cos(a) * d, y = box.cy + Math.sin(a) * d, s = 25 + rnd() * 20;
      volc.push({ x, y, s });
      G.add(at(mesh(new THREE.ConeGeometry(s, s * 0.9, 9, 1, true), M('#1c0f10', { roughness: 1 }), false), x, y, -16 + s * 0.45));
      G.add(at(mesh(new THREE.CylinderGeometry(s * 0.18, s * 0.22, 0.8, 9), glowM('#ff6a1a', 2), false), x, y, -16 + s * 0.9 - 0.3));
    }
    // Dark smoke clouds
    const clouds = [];
    for (let i = 0; i < 10; i++) {
      const a = rnd() * TAU, d = 80 + rnd() * 70, cx = box.cx + Math.cos(a) * d, cy = box.cy + Math.sin(a) * d;
      for (let k = 0; k < 5; k++) clouds.push({ x: cx + (rnd() - 0.5) * 26, y: 26 + rnd() * 14, z: -(cy + (rnd() - 0.5) * 12), s: 8 + rnd() * 8, sy: 3 + rnd() * 2 });
    }
    VIS.instanced(world, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: col('#2a1210'), transparent: true, opacity: 0.85 }), clouds, false);
    // Braziers on floating pillars beside the course
    const braziers = [];
    for (let i = 0; i < 200 && braziers.length < 5; i++) {
      const x = box.x0 - 3 + rnd() * (box.w + 6), y = box.y0 + rnd() * box.h;
      if (!clear(x, y, 1.4)) continue;
      if (polys.every(P => U.distToPoly(x, y, P) > 2.2)) continue;
      braziers.push([x, y]);
      const pil = mesh(new THREE.CylinderGeometry(0.22, 0.3, 16.4, 7), bm, false);
      G.add(at(pil, x, y, -8.1));
      const bowl = mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.25, 10, 1, true), M('#3a2a24', { metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
      G.add(at(bowl, x, y, 0.22));
      G.add(at(mesh(new THREE.CircleGeometry(0.3, 12).rotateX(-Math.PI / 2), glowM('#ff7a1a', 1.1), false), x, y, 0.26));
    }
    VIS.sign(hole, world, world.sim, true);

    let acc = 0, emb = 0;
    world.vis.push({
      update(t, dt) {
        acc += dt;
        while (acc > 0.05) {
          acc -= 0.05;
          braziers.forEach(([x, y]) => world.glow.spawn({ x: x + (Math.random() - 0.5) * 0.2, y: 0.35, z: -y + (Math.random() - 0.5) * 0.2, vx: 0, vy: 1.2 + Math.random(), vz: 0, g: 0.5, life: 0.5 + Math.random() * 0.3, size: 0.14 + Math.random() * 0.08, grow: -0.6, color: col(Math.random() < 0.5 ? '#ff8a2a' : '#ffd25a') }));
        }
        emb += dt;
        while (emb > 0.03) {
          emb -= 0.03;
          ember(world, box.x0 - 6 + Math.random() * (box.w + 12), box.y0 - 4 + Math.random() * (box.h + 8), -3 + Math.random() * 2, { vy: 1 + Math.random() * 1.4, life: 3 + Math.random() * 2 });
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
    const ring = mesh(new THREE.TorusGeometry(s.r * 0.95, 0.12, 8, 20), basaltMat());
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
    const b = T.basalt();
    const top = mesh(new THREE.CylinderGeometry(s.r, s.r * 0.85, 0.22, 24), new THREE.MeshStandardMaterial({ map: b.map, emissiveMap: b.glow, emissive: col('#ff6a1a'), emissiveIntensity: 1.1, roughness: 0.95 }));
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
    const g = new THREE.Group();
    const pm = M('#1a1418', { roughness: 0.4, metalness: 0.3 });
    [-1, 1].forEach(k => { const pil = mesh(new THREE.BoxGeometry(0.4, s.zp + 9.5, 0.4), pm); pil.position.set(k * 3.1, (s.zp - 9.5) / 2 + 0.2, 0); g.add(pil); });
    const beam = mesh(new THREE.BoxGeometry(6.6, 0.32, 0.32), pm); beam.position.y = s.zp + 0.2; g.add(beam);
    world.holeGroup.add(at(g, s.x, s.y, 0));
    const chain = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), M('#5a5056', { metalness: 0.8, roughness: 0.3 }));
    const ball = new THREE.Group();
    ball.add(mesh(new THREE.SphereGeometry(s.rt * 0.75, 18, 14), M('#26222a', { metalness: 0.8, roughness: 0.35 })));
    for (let i = 0; i < 14; i++) { const a = Math.acos(1 - 2 * (i + 0.5) / 14), b = i * 2.4; const dir = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)); const sp = mesh(new THREE.ConeGeometry(0.06, 0.22, 6), M('#4a4248', { metalness: 0.8, roughness: 0.3 })); sp.position.copy(dir.clone().multiplyScalar(s.rt * 0.8)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); ball.add(sp); }
    world.holeGroup.add(chain, ball);
    return {
      update() {
        ball.position.copy(V(f.xc, s.y, f.zc)); ball.rotation.z = -f.th * 2;
        const top = V(s.x, s.y, s.zp), bot = V(f.xc, s.y, f.zc + s.rt * 0.75);
        chain.position.copy(top.clone().add(bot).multiplyScalar(0.5));
        chain.scale.y = top.distanceTo(bot); chain.rotation.z = -f.th;
      },
    };
  };

  AV.turntable = function (s, world, f) {
    const g = new THREE.Group();
    const disc = mesh(new THREE.CircleGeometry(s.r, 64), new THREE.MeshStandardMaterial({ map: T.runes(), emissiveMap: T.runes(), emissive: col('#ff6a1a'), emissiveIntensity: 0.9, roughness: 0.85 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.008;
    g.add(disc);
    const gap = mesh(new THREE.RingGeometry(s.r - 0.01, s.r + 0.04, 64), glowM('#ff4a1a', 1.4), false);
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
    return { update() { disc.rotation.z = f.ang; f.pots().forEach((p, i) => { pots[i].position.set(p.x - s.x, 0.27, -(p.y - s.y)); pots[i].rotation.y = f.ang; }); } };
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
    world.holeGroup.add(at(mesh(new THREE.CylinderGeometry(0.18, 0.18, l + 0.6, 10), basaltMat()).rotateX(Math.PI / 2), (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, -0.3));
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
    world.holeGroup.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.08, 11, 7), basaltMat()), px, py, -3.5));
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
