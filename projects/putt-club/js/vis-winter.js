/* Putt Club: how the Winter Wonderland looks. Snowy mountains and pines, gingerbread houses and candy canes,
   falling snow, and winter versions of the moving parts (PC.VIS.winter[type] is used instead of PC.VIS[type]
   when a hole's look.theme is 'winter'). Thin ice and snowballs are drawn here for every course. */
(function (PC) {
  'use strict';
  const U = PC.U, T = PC.TEX, TAU = U.TAU, C = PC.C;
  const col = PC.col, V = PC.V;
  const VIS = PC.VIS;
  const WV = VIS.winter = {};
  const GY = () => PC.GROUND_Y;
  const M = (hex, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: 0.7 }, o || {}));
  const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
  const at = (o, x, y, h) => { o.position.copy(V(x, y, h)); return o; };
  const now = (t, sim) => (sim ? sim.t : t);
  const texMat = (tex, rx, ry, o) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial(Object.assign({ map: t, roughness: 0.8 }, o || {})); };
  const SNOW = () => M('#ffffff', { roughness: 1 });
  const UP = new THREE.Vector3(0, 1, 0);

  // ---------- Models ----------
  // A candy cane: a striped tube going up and curling over at the top.
  class CaneCurve extends THREE.Curve {
    constructor(h, hook) { super(); this.h = h; this.k = hook; }
    getPoint(t, out = new THREE.Vector3()) {
      const straight = this.h - this.k, L = straight + Math.PI * this.k, s = t * L;
      if (s <= straight) return out.set(0, s, 0);
      const a = (s - straight) / this.k;
      return out.set(this.k - Math.cos(a) * this.k, straight + Math.sin(a) * this.k, 0);
    }
  }
  function candyCane(h, r) {
    const g = new THREE.TubeGeometry(new CaneCurve(h, Math.max(0.12, h * 0.16)), 40, r, 10, false);
    const m = mesh(g, texMat(T.candy(), Math.round(h * 6), 1, { roughness: 0.3 }));
    return m;
  }
  VIS.candyCane = candyCane;

  function snowman(r, rnd) {
    const g = new THREE.Group(), snow = M('#fbfdff', { roughness: 0.9 });
    const r1 = r, r2 = r * 0.74, r3 = r * 0.52;
    const b1 = mesh(new THREE.SphereGeometry(r1, 18, 14), snow); b1.position.y = r1 * 0.9;
    const b2 = mesh(new THREE.SphereGeometry(r2, 16, 12), snow); b2.position.y = r1 * 1.7 + r2 * 0.7;
    const b3 = mesh(new THREE.SphereGeometry(r3, 16, 12), snow); b3.position.y = b2.position.y + r2 * 0.8 + r3 * 0.75;
    const coal = M('#1a1a1e', { roughness: 0.5 });
    const eyes = [-1, 1].map(s => { const e = mesh(new THREE.SphereGeometry(r3 * 0.12, 8, 6), coal, false); e.position.set(s * r3 * 0.35, b3.position.y + r3 * 0.2, r3 * 0.88); return e; });
    const nose = mesh(new THREE.ConeGeometry(r3 * 0.14, r3 * 0.8, 10), M('#ff7a1a'), false);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, b3.position.y, r3 * 1.2);
    const scarfCol = ['#d42a3a', '#2f9a5a', '#2f6fc4'][Math.floor(rnd() * 3)];
    const scarf = mesh(new THREE.TorusGeometry(r2 * 0.72, r2 * 0.16, 8, 20), M(scarfCol, { roughness: 0.9 }));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = b2.position.y + r2 * 0.62;
    const tail = mesh(new THREE.BoxGeometry(r2 * 0.25, r2 * 0.7, r2 * 0.08), M(scarfCol, { roughness: 0.9 }));
    tail.position.set(r2 * 0.45, b2.position.y + r2 * 0.25, r2 * 0.6); tail.rotation.z = 0.2;
    const buttons = [0, 1, 2].map(i => { const bt = mesh(new THREE.SphereGeometry(r2 * 0.08, 6, 5), coal, false); bt.position.set(0, b2.position.y + r2 * (0.3 - i * 0.35), r2 * (0.95 - Math.abs(i - 0.5) * 0.06)); return bt; });
    const hat = new THREE.Group();
    const brim = mesh(new THREE.CylinderGeometry(r3 * 0.95, r3 * 0.95, r3 * 0.08, 18), coal); const crown = mesh(new THREE.CylinderGeometry(r3 * 0.62, r3 * 0.62, r3 * 0.85, 18), coal);
    crown.position.y = r3 * 0.45;
    const band = mesh(new THREE.CylinderGeometry(r3 * 0.64, r3 * 0.64, r3 * 0.16, 18), M('#d42a3a'), false); band.position.y = r3 * 0.12;
    hat.add(brim, crown, band); hat.position.y = b3.position.y + r3 * 0.85; hat.rotation.z = (rnd() - 0.5) * 0.3;
    const arms = [-1, 1].map(s => { const a = mesh(new THREE.CylinderGeometry(0.015, 0.025, r * 1.6, 5), M('#5a3a22'), false); a.position.set(s * (r2 + r * 0.45), b2.position.y + r2 * 0.2, 0); a.rotation.z = s * (1.0 + rnd() * 0.3); return a; });
    g.add(b1, b2, b3, ...eyes, nose, scarf, tail, ...buttons, hat, ...arms);
    return g;
  }
  VIS.snowman = snowman;

  function penguin() {
    const g = new THREE.Group(), body = new THREE.Group();
    const black = M('#1c2230', { roughness: 0.5 }), white = M('#f8f8f4', { roughness: 0.6 }), orange = M('#ff9a1a', { roughness: 0.5 });
    const b = mesh(new THREE.SphereGeometry(0.22, 18, 14), black); b.scale.set(1, 1.35, 0.95); b.position.y = 0.3;
    const belly = mesh(new THREE.SphereGeometry(0.2, 16, 12), white); belly.scale.set(0.85, 1.22, 0.7); belly.position.set(0, 0.28, 0.08);
    const head = mesh(new THREE.SphereGeometry(0.14, 16, 12), black); head.position.y = 0.6;
    const face = mesh(new THREE.SphereGeometry(0.1, 12, 10), white); face.scale.set(1, 0.9, 0.6); face.position.set(0, 0.6, 0.07);
    const beak = mesh(new THREE.ConeGeometry(0.04, 0.12, 8), orange); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.58, 0.18);
    const eyes = [-1, 1].map(s => { const e = mesh(new THREE.SphereGeometry(0.018, 6, 5), M('#111111'), false); e.position.set(s * 0.05, 0.64, 0.12); return e; });
    const flips = [-1, 1].map(s => { const f = mesh(new THREE.SphereGeometry(0.1, 10, 8), black); f.scale.set(0.25, 1, 0.55); f.position.set(s * 0.22, 0.32, 0); f.rotation.z = s * 0.3; return f; });
    const feet = [-1, 1].map(s => { const f = mesh(new THREE.SphereGeometry(0.06, 8, 6), orange); f.scale.set(1, 0.35, 1.6); f.position.set(s * 0.08, 0.02, 0.06); return f; });
    const scarf = mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 18), M('#d42a3a', { roughness: 0.9 })); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.48;
    body.add(b, belly, head, face, beak, ...eyes, ...flips, ...feet, scarf);
    g.add(body);
    g.userData = { body, flips };
    return g;
  }
  VIS.penguin = penguin;

  // A gingerbread house: cookie walls, an iced roof, gumdrops on the ridge and warm windows.
  function gingerHouse(w, d, h, rnd) {
    const g = new THREE.Group();
    const cookie = texMat(T.gingerbread(), w, h, { roughness: 0.9 });
    const icing = M('#fffaf4', { roughness: 0.55 });
    const body = mesh(new THREE.BoxGeometry(w, h, d), cookie); body.position.y = h / 2;
    g.add(body);
    const rh = w * 0.42, slope = Math.atan2(rh, w / 2), rl = Math.hypot(w / 2, rh) + 0.12;
    [-1, 1].forEach(s => {
      // each half of the roof starts at the ridge and runs down past the eave
      const ux = s * Math.cos(slope), uy = -Math.sin(slope), nx = s * Math.sin(slope), ny = Math.cos(slope);
      const cx = ux * (rl / 2 - 0.03), cy = h + rh + uy * (rl / 2 - 0.03);
      const roof = mesh(new THREE.BoxGeometry(rl, 0.08, d + 0.24), cookie);
      roof.position.set(cx, cy, 0); roof.rotation.z = -s * slope;
      const snow = mesh(new THREE.BoxGeometry(rl, 0.07, d + 0.26), icing);
      snow.position.set(cx + nx * 0.07, cy + ny * 0.07, 0); snow.rotation.z = -s * slope;
      g.add(roof, snow);
    });
    // gable ends
    const gable = new THREE.Shape(); gable.moveTo(-w / 2, 0); gable.lineTo(w / 2, 0); gable.lineTo(0, rh); gable.closePath();
    [-1, 1].forEach(s => { const gm = mesh(new THREE.ShapeGeometry(gable), cookie); gm.position.set(0, h, s * (d / 2 + 0.001)); if (s < 0) gm.rotation.y = Math.PI; g.add(gm); });
    // icing drips along the eaves
    for (let i = 0; i < 9; i++) [-1, 1].forEach(s => { const dr = mesh(new THREE.SphereGeometry(0.05, 6, 5), icing, false); dr.scale.y = 1.6; dr.position.set(s * (w / 2 + 0.04), h - 0.02, -d / 2 + (i + 0.5) * d / 9); g.add(dr); });
    // gumdrops on the ridge
    const gum = ['#e8384f', '#2fbf71', '#f2c94c', '#9b59d0', '#3fa9f5'];
    for (let i = 0; i < 5; i++) { const gd = mesh(new THREE.SphereGeometry(0.07, 10, 8, 0, TAU, 0, Math.PI / 2), M(gum[i % 5], { roughness: 0.3 })); gd.position.set(0, h + rh + 0.05, -d / 2 + (i + 0.5) * d / 5); g.add(gd); }
    // door and windows on the front (+z)
    const door = mesh(new THREE.BoxGeometry(w * 0.24, h * 0.5, 0.04), M('#6a3a18')); door.position.set(0, h * 0.25, d / 2 + 0.02);
    const doorTrim = mesh(new THREE.TorusGeometry(w * 0.13, 0.025, 6, 16, Math.PI), icing, false); doorTrim.position.set(0, h * 0.5, d / 2 + 0.03);
    g.add(door, doorTrim);
    const winM = new THREE.MeshStandardMaterial({ color: col('#ffd27a'), emissive: col('#ffb84a'), emissiveIntensity: 0.9 });
    [-1, 1].forEach(s => {
      const wn = mesh(new THREE.BoxGeometry(w * 0.18, h * 0.22, 0.03), winM, false); wn.position.set(s * w * 0.3, h * 0.58, d / 2 + 0.02);
      const fr = mesh(new THREE.BoxGeometry(w * 0.22, h * 0.26, 0.02), icing, false); fr.position.set(s * w * 0.3, h * 0.58, d / 2 + 0.008);
      g.add(fr, wn);
    });
    // a little candy cane by the door and a chimney with snow
    const cc = candyCane(h * 0.6, 0.03); cc.position.set(w * 0.2, 0, d / 2 + 0.15); cc.rotation.y = Math.PI; g.add(cc);
    const ch = mesh(new THREE.BoxGeometry(0.16, 0.36, 0.16), texMat(T.gingerbread(), 0.3, 0.6)); ch.position.set(w * 0.22, h + rh * 0.6, -d * 0.15);
    const chs = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), icing); chs.position.set(w * 0.22, h + rh * 0.6 + 0.2, -d * 0.15);
    g.add(ch, chs);
    g.userData.chimney = [w * 0.22, h + rh * 0.6 + 0.25, -d * 0.15];
    void rnd;
    return g;
  }
  VIS.gingerHouse = gingerHouse;

  function pine(rnd) {
    const g = new THREE.Group(), h = 2.6 + rnd() * 2.6, green = M(['#24563a', '#2c6444', '#1f4a32'][Math.floor(rnd() * 3)], { roughness: 0.9, flatShading: true });
    const trunk = mesh(new THREE.CylinderGeometry(0.08, 0.12, h * 0.25, 6), M('#5a3a22', { roughness: 1 })); trunk.position.y = h * 0.12; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const r = (0.75 - i * 0.18) * h * 0.38, y = h * (0.22 + i * 0.22), th = h * 0.42;
      const c = mesh(new THREE.ConeGeometry(r, th, 8), green); c.position.y = y + th / 2; g.add(c);
      const sc = mesh(new THREE.ConeGeometry(r * 0.72, th * 0.38, 8), M('#ffffff', { roughness: 1, flatShading: true }), false); sc.position.y = y + th * 0.82; g.add(sc);
    }
    return g;
  }

  // ---------- Snowbanks: lumps of snow along the top of the wall ----------
  const baseExtras = VIS.railExtras;
  VIS.railExtras = function (r, body, world, sim) {
    if (r.style !== 'snowbank') return baseExtras && baseExtras(r, body, world, sim);
    const rnd = U.rng(Math.round(r.pts[0][0] * 31 + r.pts[0][1] * 17)), items = [];
    const P = body.line, N = body.normals, Tp = body.tops;
    for (let i = 0; i < P.length - 1; i++) {
      const n = N[Math.min(i, N.length - 1)];
      for (let k = 0; k < 2; k++) {
        const t = rnd(), off = r.side === 'out' ? r.w / 2 : 0;
        const x = P[i][0] + (P[i + 1][0] - P[i][0]) * t + n[0] * (off + (rnd() - 0.5) * r.w * 0.4), y = P[i][1] + (P[i + 1][1] - P[i][1]) * t + n[1] * (off + (rnd() - 0.5) * r.w * 0.4);
        const sc = r.w * (0.5 + rnd() * 0.25);
        items.push({ x, y: Tp[i] - sc * 0.35, z: -y, s: sc, sy: sc * 0.6, ry: rnd() * 6, c: rnd() < 0.5 ? '#ffffff' : '#f2f7fc' });
      }
    }
    VIS.instanced(world, new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ roughness: 1 }), items);
  };

  // ---------- Posts ----------
  const basePost = VIS.post;
  VIS.post = function (p, world) {
    const h0 = world.sim.groundRaw(p.x, p.y), rnd = U.rng(Math.round(p.x * 37 + p.y * 91));
    if (p.style === 'cane') { const m = candyCane(p.h, p.r); m.rotation.y = rnd() * TAU; world.holeGroup.add(at(m, p.x, p.y, h0)); return; }
    if (p.style === 'snowman') { const m = snowman(p.r, rnd); m.rotation.y = Math.atan2(world.hole.tee[0] - p.x, -(world.hole.tee[1] - p.y)) + (rnd() - 0.5) * 0.6; world.holeGroup.add(at(m, p.x, p.y, h0)); return; }
    return basePost(p, world);
  };

  // ---------- Thin ice (every course) ----------
  VIS.thinice = function (s, world, f) {
    const sim = world.sim, G = world.holeGroup;
    const sheets = s.list.map((q, i) => {
      const poly = U.ccw(q.poly || q);
      const it = T.ice().clone(); it.needsUpdate = true;
      const mat = new THREE.MeshPhysicalMaterial({ map: it, color: col('#e6f6ff'), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.82 });
      const geo = surfaceGeometry(poly, (x, y) => sim.floorHeight(x, y) + 0.02, (x, y) => [x / 3, y / 3]);
      const sheet = mesh(geo, mat, false);
      G.add(sheet);
      // cracks, built when the ice first cracks, spreading over the 4 seconds
      const cracks = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.95 }));
      cracks.visible = false; G.add(cracks);
      // shards that float on the water once it breaks
      const shards = new THREE.Group(); shards.visible = false; G.add(shards);
      const rnd = U.rng(i * 7 + 3), box = U.bbox ? U.bbox(poly) : null;
      const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      void box;
      for (let k = 0; k < 18; k++) {
        const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
        if (!U.inPoly(x, y, poly)) continue;
        const sh = new THREE.Shape(); const n = 3 + Math.floor(rnd() * 3), rr = 0.15 + rnd() * 0.3;
        for (let j = 0; j < n; j++) { const a = (j / n) * TAU + rnd() * 0.6, d = rr * (0.6 + rnd() * 0.6); j ? sh.lineTo(Math.cos(a) * d, Math.sin(a) * d) : sh.moveTo(Math.cos(a) * d, Math.sin(a) * d); }
        const m = mesh(new THREE.ShapeGeometry(sh), mat, false); m.rotation.x = -Math.PI / 2; m.position.copy(V(x, y, sim.floorHeight(x, y) + 0.022)); m.userData.ph = rnd() * 6; m.userData.base = m.position.y;
        shards.add(m);
      }
      return { poly, sheet, mat, cracks, shards, built: false, x0, x1, y0, y1, center: U.centroid(poly) };
    });
    const buildCracks = (o, cx, cy) => {
      const pts = [], rnd = U.rng(Math.round(cx * 100 + cy * 37));
      const R = Math.hypot(o.x1 - o.x0, o.y1 - o.y0);
      for (let b = 0; b < 9; b++) {
        let a = (b / 9) * TAU + rnd() * 0.5, x = cx, y = cy;
        const steps = 8;
        for (let k = 0; k < steps; k++) {
          const l = R / steps * (0.6 + rnd() * 0.8);
          a += (rnd() - 0.5) * 0.9;
          const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
          pts.push([x, y, nx, ny, k / steps]);
          if (rnd() < 0.3) { const ba = a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.6), bl = l * 0.8; pts.push([nx, ny, nx + Math.cos(ba) * bl, ny + Math.sin(ba) * bl, (k + 0.5) / steps]); }
          x = nx; y = ny;
        }
      }
      // order by distance from the start so drawRange spreads them outward
      pts.sort((p, q) => p[4] - q[4]);
      const arr = [];
      pts.forEach(p => {
        const ok = U.inPoly(p[0], p[1], o.poly) && U.inPoly(p[2], p[3], o.poly);
        if (!ok) return;
        arr.push(p[0], sim.floorHeight(p[0], p[1]) + 0.026, -p[1], p[2], sim.floorHeight(p[2], p[3]) + 0.026, -p[3]);
      });
      o.cracks.geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      o.nSeg = arr.length / 6;
      o.built = true;
    };
    return {
      update(t, dt, s2) {
        const tt = now(t, s2);
        sheets.forEach((o, i) => {
          const st = f.list[i];
          if (st.crack < 0) { o.sheet.visible = true; o.shards.visible = false; o.cracks.visible = false; return; }
          if (!o.built) buildCracks(o, st.cx, st.cy);
          const k = U.clamp((tt - st.crack) / 4, 0, 1);
          if (!st.broken) {
            o.cracks.visible = true;
            o.cracks.geometry.setDrawRange(0, Math.max(2, Math.floor(o.nSeg * Math.min(1, 0.15 + k * 1.1)) * 2));
            o.mat.opacity = 0.82 - k * 0.2;
            o.sheet.position.y = k > 0.75 ? Math.sin(tt * 60) * 0.006 * (k - 0.75) * 4 : 0;
          } else {
            o.sheet.visible = false; o.cracks.visible = false; o.shards.visible = true;
            o.shards.children.forEach(m => { m.position.y = m.userData.base + Math.sin(tt * 1.6 + m.userData.ph) * 0.012; m.rotation.z = Math.sin(tt * 0.4 + m.userData.ph) * 0.3; });
          }
        });
      },
    };
  };
  // the same geometry helper the world uses for greens
  function surfaceGeometry(P, hAt, uvf) {
    const shape = new THREE.Shape(P.map(p => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ShapeGeometry(shape, 1);
    const pos = g.attributes.position, uv = [];
    // subdivide coarsely by re-triangulating a grid is overkill here: thin ice sits on flat ground
    const arr = [];
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); arr.push(x, hAt(x, y), -y); const q = uvf(x, y); uv.push(q[0], q[1]); }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(g.index);
    out.computeVertexNormals();
    return out;
  }

  // ---------- Snowballs (every course) ----------
  VIS.snowballs = function (s, world, f) {
    const sim = world.sim;
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const p = geo.attributes.position, rnd = U.rng(5), seen = new Map();
    for (let i = 0; i < p.count; i++) { const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!seen.has(key)) seen.set(key, 0.9 + rnd() * 0.18); const k = seen.get(key); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
    geo.computeVertexNormals();
    const mat = texMat(T.snow(), 1, 1, { roughness: 0.95 });
    const balls = f.list.map(() => { const m = mesh(geo, mat); world.holeGroup.add(m); return { m, n: -1, px: 0, py: 0 }; });
    const q = new THREE.Quaternion(), axis = new THREE.Vector3();
    return {
      update() {
        f.list.forEach((w, i) => {
          const o = balls[i];
          if (o.n !== w.n) {
            // the last one burst at the bottom of its run
            if (o.n >= 0) { const path = s.list[i].path, e = path[path.length - 1]; world.burst('puff', e[0], e[1], sim.groundRaw(e[0], e[1]), { color: '#ffffff', n: 16 }); }
            o.n = w.n; o.px = w.x; o.py = w.y;
          }
          o.m.visible = w.on;
          if (!w.on) return;
          const dx = w.x - o.px, dy = w.y - o.py, d = Math.hypot(dx, dy);
          if (d > 1e-5 && d < 1) { axis.set(-dy / d, 0, -dx / d); q.setFromAxisAngle(axis, d / Math.max(0.05, w.r)); o.m.quaternion.premultiply(q); }
          o.px = w.x; o.py = w.y;
          o.m.scale.setScalar(w.r);
          o.m.position.copy(V(w.x, w.y, sim.groundRaw(w.x, w.y) + w.r * 0.95));
        });
      },
    };
  };

  // ---------- Winter versions of the moving parts ----------
  WV.patrol = function (s, world, f) {
    if (!s.penguins) return VIS.patrol(s, world, f);
    const models = f.movers.map(() => { const g = penguin(); world.holeGroup.add(g); return g; });
    return {
      update(t) {
        f.movers.forEach((mv, i) => {
          const g = models[i], sp = Math.hypot(mv.vx, mv.vy);
          g.position.copy(V(mv.x, mv.y, world.sim.groundRaw(mv.x, mv.y)));
          if (sp > 0.05) g.rotation.y = Math.atan2(mv.vx, -mv.vy);   // beak (+z) along the way it slides
          // belly-slide when going fast, stand up to turn round at each end
          const slide = U.smooth(0.4, 1.4, sp);
          g.userData.body.rotation.x = slide * 0.85;
          g.userData.body.position.y = slide * 0.05;
          g.userData.flips.forEach((fl, k) => { fl.rotation.z = (k ? 1 : -1) * (0.3 + slide * 1.0 + (1 - slide) * Math.abs(Math.sin(t * 8)) * 0.4); });
          const hit = t - (mv.hit || -9), sq = hit >= 0 && hit < 0.3 ? 1 + Math.sin(hit * 20) * 0.08 * (1 - hit / 0.3) : 1;
          g.scale.set(sq, 2 - sq, sq);
        });
      },
    };
  };

  // A peppermint turnstile: striped vanes under a giant peppermint candy.
  WV.spinner = function (s, world, f) {
    const g = new THREE.Group(), h0 = world.sim.groundRaw(s.x, s.y);
    const post = candyCane(s.h + 0.1, 0.16); post.geometry = new THREE.CylinderGeometry(0.16, 0.18, s.h + 0.1, 16); post.position.y = (s.h + 0.1) / 2; g.add(post);
    const rot = new THREE.Group();
    const vaneMat = texMat(T.candy(), 2, 0.6, { roughness: 0.35 });
    for (let i = 0; i < s.arms; i++) {
      const hh = new THREE.Group();
      const v = mesh(new THREE.BoxGeometry(s.len - 0.2, s.h * 0.6, s.w * 0.9), vaneMat); v.position.set((s.len + 0.2) / 2, s.h * 0.32, 0);
      hh.add(v); hh.rotation.y = (i * TAU) / s.arms; rot.add(hh);
    }
    // the peppermint: a white disc with red swirls, wrapped ends left off
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x2 = c.getContext('2d'); x2.fillStyle = '#fbf6f0'; x2.beginPath(); x2.arc(128, 128, 126, 0, TAU); x2.fill();
    x2.fillStyle = '#d42a3a';
    for (let i = 0; i < 8; i++) { const a0 = (i / 8) * TAU; x2.beginPath(); x2.moveTo(128, 128); for (let k = 0; k <= 20; k++) { const r = (k / 20) * 124, a = a0 + (k / 20) * 0.9; x2.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } for (let k = 20; k >= 0; k--) { const r = (k / 20) * 124, a = a0 + 0.32 + (k / 20) * 0.9; x2.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } x2.closePath(); x2.fill(); }
    const tex = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const mint = mesh(new THREE.CylinderGeometry(s.len * 0.55, s.len * 0.55, 0.14, 40), [M('#fbf6f0', { roughness: 0.25 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 })]);
    mint.position.y = s.h + 0.1;
    rot.add(mint);
    g.add(rot);
    world.holeGroup.add(at(g, s.x, s.y, h0));
    return { update() { rot.rotation.y = f.ang; } };
  };

  // Candy cane gates: striped bars that swing open from candy cane posts.
  WV.gates = function (s, world, f) {
    const sim = world.sim, bar = texMat(T.candy(), 3, 1, { roughness: 0.35 });
    const doors = f.list.map(g => {
      const dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1], len = Math.hypot(dx, dy), half = len / 2, ang = Math.atan2(dy, dx);
      const make = (hinge, dir) => {
        const piv = new THREE.Group(), holder = new THREE.Group();
        [0.15, 0.42].forEach(y => { const b = mesh(new THREE.CylinderGeometry(0.045, 0.045, half - 0.04, 10), bar); b.rotation.z = Math.PI / 2; b.position.set(half / 2, y, 0); holder.add(b); });
        const st = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8), M('#fbf6f0', { roughness: 0.3 })); st.position.set(half - 0.06, 0.28, 0); holder.add(st);
        holder.scale.x = dir; piv.add(holder);
        piv.position.copy(V(hinge[0], hinge[1], sim.groundRaw(hinge[0], hinge[1]))); piv.rotation.y = ang;
        world.holeGroup.add(piv);
        const cane = candyCane(0.95, 0.06); cane.rotation.y = ang + (dir > 0 ? Math.PI : 0);
        world.holeGroup.add(at(cane, hinge[0], hinge[1], sim.groundRaw(hinge[0], hinge[1])));
        return piv;
      };
      return { g, a: make(g.a, 1), b: make(g.b, -1), ang };
    });
    return { update() { doors.forEach(d => { const o = U.smooth(0, 1, d.g.open); d.a.rotation.y = d.ang + o * 1.45; d.b.rotation.y = d.ang - o * 1.45; }); } };
  };

  // Gumdrops: sugary domes in bright colours.
  WV.bumpers = function (s, world, f) {
    const cols = ['#e8384f', '#2fbf71', '#f2c94c', '#9b59d0', '#3fa9f5', '#ff8a2a'];
    const items = f.list.map((p, i) => {
      const prof = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI / 2; prof.push(new THREE.Vector2(p.r * 1.05 * Math.cos(a) * (1 - 0.15 * Math.sin(a)), 0.62 * Math.sin(a) * 1.1)); }
      prof.push(new THREE.Vector2(0, 0.68));
      const g = mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshPhysicalMaterial({ color: col(cols[i % cols.length]), roughness: 0.55, clearcoat: 0.3 }));
      world.holeGroup.add(at(g, p.x, p.y, world.sim.groundRaw(p.x, p.y)));
      return g;
    });
    return { update(t, dt, s2) { const tt = now(t, s2); f.list.forEach((p, i) => { const k = tt - p.hit; const q = k >= 0 && k < 0.4 ? 1 + Math.sin(k * 30) * 0.12 * (1 - k / 0.4) : 1; items[i].scale.set(q, 2 - q, q); }); } };
  };

  // Gingerbread houses over each tunnel mouth.
  WV.tunnels = function (s, world, f) {
    const rnd = U.rng(11), houses = [];
    s.pairs.forEach((p, i) => [p.a, p.b].forEach((e, end) => {
      const h = world.sim.groundRaw(e[0], e[1]);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.33, 24), new THREE.MeshBasicMaterial({ map: T.cupShade() }));
      hole.rotation.x = -Math.PI / 2; world.holeGroup.add(at(hole, e[0], e[1], h + 0.012));
      const mat = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.48, 24), M('#fffaf4', { roughness: 0.6 }));
      mat.rotation.x = -Math.PI / 2; world.holeGroup.add(at(mat, e[0], e[1], h + 0.01));
      // the house sits behind the hole, its door facing the way the ball comes out
      const dir = end ? p.dirB : p.dirA;
      const house = gingerHouse(0.95, 0.75, 0.75, rnd);
      const bx = e[0] - Math.cos(dir) * 0.95, by = e[1] - Math.sin(dir) * 0.95;
      house.rotation.y = Math.atan2(Math.cos(dir), -Math.sin(dir));
      world.holeGroup.add(at(house, bx, by, h));
      houses.push({ house, i, end });
    }));
    return {
      update(t) {
        houses.forEach(o => {
          const tp = f.pops && f.pops[o.i] ? f.pops[o.i][o.end] : -9, k = t - (tp - 0.75);
          const q = k > 0 && k < 0.4 ? 1 + Math.sin(k * 25) * 0.05 : 1;
          o.house.scale.set(q, 2 - q, q);
        });
      },
    };
  };

  // A giant bauble swinging from a candy cane arch.
  WV.swing = function (s, world, f) {
    const G = world.holeGroup;
    [-1, 1].forEach(k => { const c = candyCane(s.zp + 0.3, 0.12); c.rotation.y = k > 0 ? Math.PI : 0; G.add(at(c, s.x + k * 3.2, s.y, GY())); });
    const beam = mesh(new THREE.CylinderGeometry(0.1, 0.1, 6.4, 12), texMat(T.candy(), 12, 1, { roughness: 0.3 })); beam.rotation.z = Math.PI / 2; beam.position.copy(V(s.x, s.y, s.zp + 0.12)); G.add(beam);
    const rope = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), M('#f2c94c', { metalness: 0.6, roughness: 0.3 }));
    const ball = new THREE.Group();
    const glass = mesh(new THREE.SphereGeometry(s.rt, 28, 20), new THREE.MeshPhysicalMaterial({ color: col('#c8102e'), metalness: 0.55, roughness: 0.12, clearcoat: 1 }));
    const cap = mesh(new THREE.CylinderGeometry(s.rt * 0.22, s.rt * 0.26, s.rt * 0.2, 12), M('#f2c94c', { metalness: 0.8, roughness: 0.25 })); cap.position.y = s.rt * 0.98;
    const band = mesh(new THREE.TorusGeometry(s.rt * 1.0, 0.025, 6, 32), M('#f2c94c', { metalness: 0.8, roughness: 0.25 })); band.rotation.x = Math.PI / 2;
    ball.add(glass, cap, band);
    G.add(rope, ball);
    return {
      update() {
        // the cap points up the cord at the pivot, and the cord runs from the pivot to the cap
        ball.position.copy(V(f.xc, s.y, f.zc)); ball.rotation.z = f.th;
        const top = V(s.x, s.y, s.zp), c = V(f.xc, s.y, f.zc), dir = top.clone().sub(c).normalize();
        const bot = c.clone().add(dir.clone().multiplyScalar(s.rt * 1.08));
        rope.position.copy(top.clone().add(bot).multiplyScalar(0.5)); rope.scale.y = top.distanceTo(bot); rope.quaternion.setFromUnitVectors(UP, dir);
      },
    };
  };

  // An ice floe for the ferry.
  WV.ferry = function (s, world, f) {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(s.r, s.r * 0.9, 0.24, 14, 1);
    const p = geo.attributes.position, rnd = U.rng(9);
    const ks = []; for (let i = 0; i < 15; i++) ks.push(0.9 + rnd() * 0.16);
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = ks[Math.floor(((a + Math.PI) / TAU) * 14) % 14]; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    geo.computeVertexNormals();
    const floe = mesh(geo, [texMat(T.ice(), 2, 0.3, { roughness: 0.2 }), texMat(T.snow(), 1, 1, { roughness: 1 }), M('#bfe0f2')]);
    floe.position.y = -0.12;
    g.add(floe);
    world.holeGroup.add(g);
    return { update(t) { g.position.copy(V(f.x, f.y, (s.h === undefined ? -0.03 : s.h) + Math.sin(t * 1.3) * 0.006)); g.rotation.y = Math.sin(t * 0.4) * 0.15; } };
  };

  // A ski-jump kicker with gate flags either side.
  WV.launch = function (s, world, f) {
    const G = world.holeGroup, h0 = world.sim.floorHeight(s.x, s.y);
    const lip = mesh(new THREE.BoxGeometry(s.r * 2.2, 0.05, 0.5), texMat(T.snow(), 1, 1)); lip.position.copy(V(s.x, s.y, h0 + 0.01)); G.add(lip);
    const mark = new THREE.Mesh(new THREE.RingGeometry(s.r * 0.75, s.r, 28), M('#2f6fc4')); mark.rotation.x = -Math.PI / 2; G.add(at(mark, s.x, s.y, h0 + 0.02));
    [-1, 1].forEach(k => {
      const pole = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), M('#ffffff')); G.add(at(pole, s.x + k * (s.r + 0.35), s.y, h0 + 0.65));
      const flag = mesh(new THREE.PlaneGeometry(0.4, 0.3), M(k < 0 ? '#d42a3a' : '#2f6fc4', { side: THREE.DoubleSide }), false); G.add(at(flag, s.x + k * (s.r + 0.35) + k * 0.2, s.y, h0 + 1.15));
    });
    return { update(t, dt, s2) { const k = now(t, s2) - f.hit; mark.material.emissive = col(k >= 0 && k < 0.4 ? '#4a8aff' : '#000000'); } };
  };

  // A blizzard: snow streaming across in gusts, and a candy-striped windsock.
  WV.wind = function (s, world, f) {
    const box = world.hole.box, dx = s.dir[0], dy = s.dir[1];
    const px = dx < 0 ? box.x1 + 1.4 : box.x0 - 1.4, py = box.cy;
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), texMat(T.candy(), 6, 1)); world.holeGroup.add(at(pole, px, py, GY() + 1.3));
    const sockG = new THREE.Group();
    const sock = mesh(new THREE.CylinderGeometry(0.18, 0.08, 1.0, 14, 5, true), new THREE.MeshStandardMaterial({ map: T.candy(), side: THREE.DoubleSide, roughness: 0.6 }));
    sock.rotation.z = Math.PI / 2; sock.position.x = 0.5; sockG.add(sock);
    world.holeGroup.add(at(sockG, px, py, GY() + 2.5));
    sockG.rotation.y = Math.atan2(dy, dx);
    let acc = 0;
    return {
      update(t, dt) {
        const k = f.gust || 0;
        sockG.rotation.z = -1.2 + k * 1.15 + Math.sin(t * 3) * 0.05;
        acc += dt * (4 + k * 50);
        while (acc > 1) {
          acc -= 1;
          const along = dx < 0 ? box.x1 + 3 : box.x0 - 3, y = box.y0 + Math.random() * box.h;
          world.glow.spawn({ x: along, y: 0.1 + Math.random() * 2.2, z: -y, vx: dx * (2 + k * 9), vy: -0.2, vz: -dy * (2 + k * 9) + (Math.random() - 0.5) * 0.5, g: 0, drag: 1, life: 2.4, size: 0.04 + Math.random() * 0.04, color: col('#ffffff'), a: 0.9, wobble: 1.4, seed: Math.random() * 9 });
        }
      },
    };
  };

  // The ice rink turntable: a turning disc of ice with snowmen riding on it.
  WV.turntable = function (s, world, f) {
    const g = new THREE.Group();
    const disc = mesh(new THREE.CircleGeometry(s.r, 64), new THREE.MeshPhysicalMaterial({ map: T.ice(), roughness: 0.06, clearcoat: 1 }), false);
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.008; g.add(disc);
    const line = new THREE.Mesh(new THREE.RingGeometry(s.r * 0.45, s.r * 0.48, 48), M('#d42a3a')); line.rotation.x = -Math.PI / 2; line.position.y = 0.012;
    const centre = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), M('#2f6fc4')); centre.rotation.x = -Math.PI / 2; centre.position.y = 0.012;
    const turn = new THREE.Group(); turn.add(disc, line, centre); g.add(turn);
    const gap = mesh(new THREE.RingGeometry(s.r - 0.01, s.r + 0.04, 64), M('#9ab8d0'), false); gap.rotation.x = -Math.PI / 2; gap.position.y = 0.006; g.add(gap);
    const men = (s.pots || []).map((p, i) => { const m = snowman(p.r, U.rng(i + 2)); g.add(m); return m; });
    world.holeGroup.add(at(g, s.x, s.y, 0));
    return { update() { turn.rotation.y = f.ang; f.pots().forEach((p, i) => { men[i].position.set(p.x - s.x, 0, -(p.y - s.y)); men[i].rotation.y = f.ang; }); } };
  };

  // The cup rides in a little red sleigh.
  WV.movingCup = function (s, world, f) {
    const G = world.holeGroup;
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) + C.CUP_R * 2 + 0.3;
    const track = mesh(new THREE.PlaneGeometry(len, C.CUP_R * 2 + 0.2), texMat(T.ice(), 2, 0.3, { roughness: 0.1 }), false);
    track.rotation.x = -Math.PI / 2; track.rotation.z = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
    G.add(at(track, (s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, 0.004));
    const sleigh = new THREE.Group();
    const red = M('#c8102e', { roughness: 0.4, metalness: 0.1 }), gold = M('#f2c94c', { metalness: 0.8, roughness: 0.25 });
    const back = mesh(new THREE.BoxGeometry(0.5, 0.36, 0.08), red); back.position.set(0, 0.2, C.CUP_R + 0.12);
    const sides = [-1, 1].map(k => { const sd = mesh(new THREE.BoxGeometry(0.06, 0.16, C.CUP_R * 2 + 0.3), red); sd.position.set(k * (C.CUP_R + 0.1), 0.08, 0); return sd; });
    const front = mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 16, Math.PI), red); front.position.set(0, 0.16, -(C.CUP_R + 0.14)); front.rotation.y = Math.PI / 2;
    const runners = [-1, 1].map(k => { const r = mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 16, Math.PI * 1.2), gold); r.position.set(k * (C.CUP_R + 0.1), 0.02, -(C.CUP_R + 0.12)); r.rotation.y = Math.PI / 2; return r; });
    sleigh.add(back, ...sides, front, ...runners);
    G.add(sleigh);
    return { update() { sleigh.position.copy(V(f.x, f.y, 0.0)); } };
  };

  // A gift box spring: the pad is the lid of a wrapped present.
  WV.spring = function (s, world, f) {
    const o = VIS.spring(s, world, f);
    const h0 = world.sim.groundRaw(s.x, s.y);
    const box = mesh(new THREE.BoxGeometry(s.r * 2.3, 0.06, s.r * 2.3), texMat(T.wrap('#2f8a4a'), 1, 1)); world.holeGroup.add(at(box, s.x, s.y, h0 + 0.01));
    const ribbon = mesh(new THREE.BoxGeometry(s.r * 2.32, 0.065, 0.08), M('#d42a3a')); world.holeGroup.add(at(ribbon, s.x, s.y, h0 + 0.012));
    return o;
  };

  // Gingerbread houses along a gingerbread wall, or one big one by the cup at the summit.
  WV.village = function (s, world) {
    const hole = world.hole, rnd = U.rng(31), G = world.holeGroup;
    if (s.summit) {
      const hs = gingerHouse(3.2, 2.4, 2.2, rnd);
      hs.rotation.y = 0;
      G.add(at(hs, hole.cup[0] + 0.6, hole.box.y1 + 2.4, GY()));
      return null;
    }
    const wall = (hole.walls || []).find(w => w.style === 'gingerbread');
    if (!wall) return null;
    const y = wall.pts[0][1];
    [hole.box.x0 - 2.2, hole.box.x1 + 2.2].forEach((x, i) => { const hs = gingerHouse(2.4, 1.8, 1.7, rnd); hs.rotation.y = i ? -Math.PI / 2 : Math.PI / 2; G.add(at(hs, x, y, GY())); });
    return null;
  };

  // A chairlift running over the hole.
  WV.lift = function (s, world) {
    const box = world.hole.box, G = world.holeGroup;
    const ax = box.x0 - 4, bx = box.x1 + 4, y = box.cy + 1.5, top = 6.5;
    [ax, bx].forEach(x => {
      const tw = mesh(new THREE.CylinderGeometry(0.14, 0.2, top, 8), M('#5a5f6a', { metalness: 0.6, roughness: 0.4 })); G.add(at(tw, x, y, GY() + top / 2));
      const arm = mesh(new THREE.BoxGeometry(0.2, 0.15, 1.4), M('#5a5f6a', { metalness: 0.6 })); G.add(at(arm, x, y, GY() + top));
    });
    const cables = [-0.6, 0.6].map(dz => { const c = mesh(new THREE.CylinderGeometry(0.015, 0.015, bx - ax, 4), M('#2a2a2e'), false); c.rotation.z = Math.PI / 2; G.add(at(c, (ax + bx) / 2, y + dz, GY() + top - 0.05)); return c; });
    void cables;
    const chairs = [];
    for (let i = 0; i < 6; i++) {
      const ch = new THREE.Group();
      const hang = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), M('#2a2a2e')); hang.position.y = -0.55;
      const seat = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.4), M(i % 2 ? '#d42a3a' : '#2f6fc4')); seat.position.y = -1.1;
      const backr = mesh(new THREE.BoxGeometry(0.9, 0.4, 0.06), M(i % 2 ? '#d42a3a' : '#2f6fc4')); backr.position.set(0, -0.9, -0.2);
      ch.add(hang, seat, backr); G.add(ch); chairs.push({ ch, k: i / 6, side: i % 2 ? 1 : -1 });
    }
    return { update(t) { chairs.forEach(c => { const u = (c.k + t * 0.02) % 1, dir = c.side; const x = dir > 0 ? ax + (bx - ax) * u : bx - (bx - ax) * u; c.ch.position.copy(V(x, y + dir * 0.6, GY() + top - 0.05)); c.ch.rotation.z = Math.sin(t * 1.3 + c.k * 9) * 0.05; }); } };
  };

  // Hockey goal behind the cup on the rink hole; nothing extra on the pond.
  WV.rink = function (s, world) {
    if (world.hole.id !== 'hockey-rink') return null;
    const [cx, cy] = world.hole.cup, G = world.holeGroup, red = M('#d42a3a', { roughness: 0.4 });
    const frame = new THREE.Group();
    [-1, 1].forEach(k => { const p = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), red); p.position.set(k * 1.0, 0.35, 0); frame.add(p); });
    const bar = mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), red); bar.rotation.z = Math.PI / 2; bar.position.y = 0.7; frame.add(bar);
    const net = mesh(new THREE.PlaneGeometry(2.0, 0.7, 10, 4), new THREE.MeshStandardMaterial({ color: col('#ffffff'), wireframe: true, transparent: true, opacity: 0.6 }), false); net.position.set(0, 0.35, -0.6); frame.add(net);
    G.add(at(frame, cx, cy + 1.6, 0));
    return null;
  };

  // ---------- The wonderland round each hole ----------
  VIS.decorateWinter = function (hole, world, sim) {
    const rnd = U.rng(U.hash(hole.id) + 9);
    const box = hole.box, G = world.holeGroup, base = GY();
    const polys = hole.floors.map(f => f.poly).concat(hole.hazards.map(z => z.poly));
    const clear = (x, y, m) => polys.every(P => !U.inPoly(x, y, P) && U.distToPoly(x, y, P) > m);
    const fwd = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    const behind = (x, y) => { const a = Math.atan2(y - hole.tee[1], x - hole.tee[0]); return Math.abs(U.wrapAngle(a - (fwd + Math.PI))) < 0.7 && Math.hypot(x - hole.tee[0], y - hole.tee[1]) < 18; };
    const cx = box.cx, cy = box.cy;

    // --- Snowy mountains all round ---
    const rock = [], caps = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + rnd() * 0.25, d = 150 + rnd() * 80, r = 22 + rnd() * 30, h = 34 + rnd() * 40;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      rock.push({ x, y: base + h / 2 - 2, z: -y, sx: r, sy: h, sz: r, ry: rnd() * 6, c: ['#7d8ca6', '#8a98b0', '#6f7f9a'][i % 3] });
      caps.push({ x, y: base + h - 2 - h * 0.21 + 0.3, z: -y, sx: r * 0.44, sy: h * 0.44, sz: r * 0.44, ry: rnd() * 6, c: '#ffffff' });
    }
    VIS.instanced(world, new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), rock, false);
    VIS.instanced(world, new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), caps, false);

    // --- Snowy pines, near and far ---
    for (let i = 0, n = 0; i < 260 && n < 26; i++) {
      const x = box.x0 - 16 + rnd() * (box.w + 32), y = box.y0 - 6 + rnd() * (box.h + 22);
      if (!clear(x, y, 4.5) || behind(x, y)) continue;
      n++;
      const p = pine(rnd); p.scale.setScalar(0.8 + rnd() * 0.6); G.add(at(p, x, y, base));
    }
    const far = [], farCap = [];
    for (let i = 0; i < 140; i++) {
      const a = rnd() * TAU, d = 36 + rnd() * 60, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (behind(x, y)) continue;
      const h = 4 + rnd() * 4;
      far.push({ x, y: base + h / 2, z: -y, sx: h * 0.32, sy: h, sz: h * 0.32, c: ['#24563a', '#2c6444', '#1f4a32'][i % 3] });
      farCap.push({ x, y: base + h * 0.78, z: -y, sx: h * 0.16, sy: h * 0.34, sz: h * 0.16, c: '#ffffff' });
    }
    VIS.instanced(world, new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 0.9 }), far, false);
    VIS.instanced(world, new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 1 }), farCap, false);

    // --- Gingerbread houses, candy canes, lollipops and snowmen near the course ---
    const spots = [];
    for (let i = 0; i < 400 && spots.length < 12; i++) {
      const x = box.x0 - 9 + rnd() * (box.w + 18), y = box.y0 - 3 + rnd() * (box.h + 10);
      if (!clear(x, y, 2.6) || behind(x, y) || spots.some(s => Math.hypot(s[0] - x, s[1] - y) < 3.2)) continue;
      spots.push([x, y]);
    }
    spots.forEach(([x, y], i) => {
      const toward = Math.atan2(box.cx - x, -(box.cy - y));   // turns a model's front (+z) toward the course
      if (i % 4 === 0) { const hs = gingerHouse(1.8 + rnd() * 0.8, 1.4 + rnd() * 0.6, 1.3 + rnd() * 0.5, rnd); hs.rotation.y = toward; G.add(at(hs, x, y, base)); }
      else if (i % 4 === 1) { const c = candyCane(2 + rnd() * 1.6, 0.1 + rnd() * 0.04); c.rotation.y = rnd() * TAU; G.add(at(c, x, y, base)); }
      else if (i % 4 === 2) {
        const lg = new THREE.Group();
        const stick = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), M('#ffffff', { roughness: 0.4 })); stick.position.y = 0.8;
        const c = document.createElement('canvas'); c.width = c.height = 128; const x2 = c.getContext('2d');
        const cols = [['#e8384f', '#ffffff'], ['#2fbf71', '#f2c94c'], ['#9b59d0', '#ffffff']][i % 3];
        for (let k = 60; k > 0; k -= 6) { x2.fillStyle = cols[(k / 6) % 2]; x2.beginPath(); x2.arc(64, 64, k, 0, TAU); x2.fill(); }
        const tx = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) tx.encoding = THREE.sRGBEncoding;
        const pop = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 32), [M(cols[0], { roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.3 })]);
        pop.rotation.x = Math.PI / 2; pop.position.y = 1.9;
        lg.add(stick, pop); lg.rotation.y = toward; G.add(at(lg, x, y, base));
      } else { const sm = snowman(0.42 + rnd() * 0.15, rnd); sm.rotation.y = toward; G.add(at(sm, x, y, base)); }
    });

    // --- Snow mounds and a snowy path to the tee ---
    const mounds = [];
    for (let i = 0; i < 160; i++) {
      const x = box.x0 - 14 + rnd() * (box.w + 28), y = box.y0 - 8 + rnd() * (box.h + 22);
      if (!clear(x, y, 1.2)) continue;
      const s = 0.3 + rnd() * 1.1;
      mounds.push({ x, y: base - s * 0.2, z: -y, sx: s * (1 + rnd()), sy: s * 0.35, sz: s, ry: rnd() * 6, c: '#ffffff' });
    }
    VIS.instanced(world, new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ roughness: 1 }), mounds, false);
    const ta = Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]);
    const lamps = [];
    for (let i = 1; i < 5; i++) {
      const d = 1.6 + i * 1.6;
      [-1, 1].forEach(k => {
        const x = hole.tee[0] - Math.cos(ta) * d + Math.sin(ta) * k * 1.1, y = hole.tee[1] - Math.sin(ta) * d - Math.cos(ta) * k * 1.1;
        if (clear(x, y, 0.4)) lamps.push([x, y]);
      });
    }
    lamps.forEach(([x, y]) => { const c = candyCane(0.9, 0.035); c.rotation.y = rnd() * TAU; G.add(at(c, x, y, base)); });
    VIS.sign(hole, world, sim);

    // --- Falling snow: its own cloud of flakes, drifting down and starting again at the top ---
    const N = 900, pos = new Float32Array(N * 3), spd = new Float32Array(N), ph = new Float32Array(N);
    const sx0 = box.x0 - 12, sw = box.w + 24, sy0 = box.y0 - 10, sh = box.h + 20, top = 9;
    for (let i = 0; i < N; i++) { pos[i * 3] = sx0 + Math.random() * sw; pos[i * 3 + 1] = base + Math.random() * (top - base); pos[i * 3 + 2] = -(sy0 + Math.random() * sh); spd[i] = 0.5 + Math.random() * 0.5; ph[i] = Math.random() * 9; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(sg, new THREE.PointsMaterial({ map: T.dot(), color: 0xffffff, size: 0.09, transparent: true, depthWrite: false, opacity: 0.95 }));
    flakes.frustumCulled = false;
    G.add(flakes);
    world.vis.push({
      update(t, dt) {
        dt = Math.min(dt || 0, 0.05);
        for (let i = 0; i < N; i++) {
          let y = pos[i * 3 + 1] - spd[i] * dt;
          pos[i * 3] += (Math.sin(t * 0.8 + ph[i]) * 0.25 + 0.12) * dt;
          if (y < base) { y = top; pos[i * 3] = sx0 + Math.random() * sw; pos[i * 3 + 2] = -(sy0 + Math.random() * sh); }
          pos[i * 3 + 1] = y;
        }
        sg.attributes.position.needsUpdate = true;
      },
    });
  };
})(window.PC);
