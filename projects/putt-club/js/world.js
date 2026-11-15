/* Putt Club: the three.js scene. Builds a hole's green, rails, water, cup, flag and ball, and runs the effects.
   Paper (x, y) maps to three.js (x, height, -y). */
(function (PC) {
  'use strict';
  const U = PC.U, C = PC.C, T = PC.TEX;
  const GROUND_Y = -0.64;

  const col = hex => new THREE.Color(hex).convertSRGBToLinear();
  PC.col = col;
  const V = (x, y, h) => new THREE.Vector3(x, h, -y);
  PC.V = V;

  const LIGHTS = {
    day: { top: '#4f9fe0', mid: '#a9d6f5', horizon: '#eef8ff', sun: '#fff1da', sunI: 2.5, hemiSky: '#d6ecff', hemiGround: '#5d7a3c', hemiI: 0.95, fog: '#dcefff', turf: '#3f9434', grass: '#4a7f36', hills: ['#7fb36a', '#8fc07a', '#a6c99a'], exposure: 1.0 },
    spring: { top: '#62b3ea', mid: '#bfe6fb', horizon: '#f4fcff', sun: '#fffaf0', sunI: 2.4, hemiSky: '#e6f6ff', hemiGround: '#6aa04a', hemiI: 1.0, fog: '#e6f6fd', turf: '#43993a', grass: '#4c8638', hills: ['#86bf73', '#9acb88', '#b3d6a8'], exposure: 1.02 },
    golden: { top: '#5d97cf', mid: '#d9c7a8', horizon: '#ffe2b8', sun: '#ffd49a', sunI: 2.7, hemiSky: '#ffe8c8', hemiGround: '#6e6a35', hemiI: 0.85, fog: '#f6e0c2', turf: '#4a9636', grass: '#527f35', hills: ['#8aa865', '#a4b57a', '#c8c49a'], exposure: 1.0 },
    mesa: { top: '#3a5ca8', mid: '#e0a07a', horizon: '#ffc27a', sun: '#ffc48a', sunI: 2.3, hemiSky: '#ffd8b8', hemiGround: '#a0502e', hemiI: 0.55, fog: '#eebc90', turf: '#b8683e', grass: '#cc9c68', hills: ['#b85c32', '#a84c2a', '#c8703e'], exposure: 0.9 },
    winter: { top: '#2f6fc4', mid: '#9cc8ee', horizon: '#eef6ff', sun: '#fff4e6', sunI: 1.9, hemiSky: '#dcecff', hemiGround: '#9fb4cc', hemiI: 0.75, fog: '#e2ecf8', turf: '#2f7d55', grass: '#f4f8fc', hills: ['#e8f0f8', '#d8e4f0', '#f4f8fc'], exposure: 0.86 },
    abyss: { top: '#040205', mid: '#0c0507', horizon: '#2a0a06', sun: '#ffb27a', sunI: 1.5, hemiSky: '#2c2232', hemiGround: '#a8380e', hemiI: 0.7, fog: '#1e0805', turf: '#3a3134', grass: '#1a1212', hills: ['#2a1214', '#3a1610', '#1c0c0c'], exposure: 1.15 },
    autumn: { top: '#6aa3d0', mid: '#d6c7b3', horizon: '#ffdcb5', sun: '#ffcf96', sunI: 2.6, hemiSky: '#ffe6c9', hemiGround: '#7a5a2a', hemiI: 0.9, fog: '#f1dcc0', turf: '#4f9535', grass: '#647c34', hills: ['#a59a5c', '#b8a06a', '#cdb48a'], exposure: 1.0 },
  };
  PC.LIGHTS = LIGHTS;

  // Sutherland-Hodgman: the part of polygon P inside the box.
  function clipToBox(P, x0, y0, x1, y1) {
    let out = P;
    const edges = [[p => p[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + (b[1] - a[1]) * t]; }],
      [p => p[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + (b[1] - a[1]) * t]; }],
      [p => p[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y0]; }],
      [p => p[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y1]; }]];
    for (const [inside, cut] of edges) {
      const inp = out; out = [];
      if (!inp.length) break;
      for (let i = 0; i < inp.length; i++) {
        const cur = inp[i], prev = inp[(i - 1 + inp.length) % inp.length];
        const ci = inside(cur), pi = inside(prev);
        if (ci) { if (!pi) out.push(cut(prev, cur)); out.push(cur); }
        else if (pi) out.push(cut(prev, cur));
      }
    }
    return out;
  }

  // A surface over polygon P with heights from hAt(x, y): a grid inside, clipped cells at the edges.
  function surfaceGeometry(P, hAt, opts = {}) {
    const cell = opts.cell || 0.3, lift = opts.lift || 0;
    const uv = opts.uv || ((x, y) => [x / 4, y / 4]);
    const pos = [], nrm = [], uvs = [];
    const b = U.bounds([P]);
    const e = 0.02;
    const push = (x, y, cx, cy) => {
      const sx = x + (cx - x) * 0.012, sy = y + (cy - y) * 0.012;
      const h = hAt(sx, sy) + lift;
      const hx = (hAt(sx + e, sy) - hAt(sx - e, sy)) / (2 * e), hy = (hAt(sx, sy + e) - hAt(sx, sy - e)) / (2 * e);
      const n = new THREE.Vector3(-hx, 1, hy).normalize();
      pos.push(x, h, -y); nrm.push(n.x, n.y, n.z);
      const t = uv(x, y); uvs.push(t[0], t[1]);
    };
    const x0 = Math.floor(b.x0 / cell) * cell, y0 = Math.floor(b.y0 / cell) * cell;
    for (let y = y0; y < b.y1; y += cell) for (let x = x0; x < b.x1; x += cell) {
      const xa = x, ya = y, xb = x + cell, yb = y + cell;
      const inA = U.inPoly(xa, ya, P), inB = U.inPoly(xb, ya, P), inC = U.inPoly(xb, yb, P), inD = U.inPoly(xa, yb, P);
      if (inA && inB && inC && inD && U.distToPoly(xa + cell / 2, ya + cell / 2, P) > cell) {
        const cx = xa + cell / 2, cy = ya + cell / 2;
        push(xa, ya, cx, cy); push(xb, ya, cx, cy); push(xb, yb, cx, cy);
        push(xa, ya, cx, cy); push(xb, yb, cx, cy); push(xa, yb, cx, cy);
        continue;
      }
      const piece = clipToBox(P, xa, ya, xb, yb);
      if (piece.length < 3 || Math.abs(U.area(piece)) < 1e-6) continue;
      const c = U.centroid(piece);
      const pc = U.ccw(piece);
      const tris = THREE.ShapeUtils.triangulateShape(pc.map(p => new THREE.Vector2(p[0], p[1])), []);
      tris.forEach(t => { push(pc[t[0]][0], pc[t[0]][1], c[0], c[1]); push(pc[t[1]][0], pc[t[1]][1], c[0], c[1]); push(pc[t[2]][0], pc[t[2]][1], c[0], c[1]); });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return g;
  }
  PC.surfaceGeometry = surfaceGeometry;

  // A vertical band hanging from a polygon's edge (the side of a raised green, or a pond's rim).
  function skirtGeometry(P, topAt, bottom, closed = true, inset = 0) {
    let pts = U.resample(P, 0.25, closed);
    if (inset) { const N = U.normals(pts, closed); pts = pts.map((p, i) => [p[0] - N[i][0] * inset, p[1] - N[i][1] * inset]); }
    if (closed) pts.push(pts[0]);
    const pos = [], uvs = [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ta = topAt(a[0], a[1]), tb = topAt(b[0], b[1]);
      pos.push(a[0], ta, -a[1], a[0], bottom, -a[1], b[0], tb, -b[1], b[0], tb, -b[1], a[0], bottom, -a[1], b[0], bottom, -b[1]);
      uvs.push(acc, ta, acc, bottom, acc + l, tb, acc + l, tb, acc, bottom, acc + l, bottom);
      acc += l;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    return g;
  }
  PC.skirtGeometry = skirtGeometry;

  // A rail or wall: a band of width w along the polyline, from `bottom` up to top(x, y).
  function railGeometry(pts, closed, side, w, topAt, bottom, opts = {}) {
    let P = U.resample(pts, opts.step || 0.25, closed);
    const N = U.normals(P, closed);
    const inner = [], outer = [], tops = [];
    P.forEach((p, i) => {
      const n = N[i];
      const a = side === 'out' ? 0 : -w / 2, bb = side === 'out' ? w : w / 2;
      inner.push([p[0] + n[0] * (a - (opts.inset || 0)), p[1] + n[1] * (a - (opts.inset || 0))]);
      outer.push([p[0] + n[0] * (bb + (opts.inset || 0)), p[1] + n[1] * (bb + (opts.inset || 0))]);
      tops.push(topAt(p[0] - n[0] * 0.03, p[1] - n[1] * 0.03, p[0], p[1]));
    });
    if (closed) { inner.push(inner[0]); outer.push(outer[0]); tops.push(tops[0]); P = P.concat([P[0]]); }
    const pos = [], uvs = [];
    let acc = 0;
    const quad = (a, b, c, d, ua, ub, va, vb) => {
      pos.push(...a, ...b, ...c, ...c, ...b, ...d);
      uvs.push(ua, va, ua, vb, ub, va, ub, va, ua, vb, ub, vb);
    };
    const thick = opts.thick; // a cap: only the top slab of this thickness
    for (let i = 0; i < P.length - 1; i++) {
      const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
      const ia = inner[i], ib = inner[i + 1], oa = outer[i], ob = outer[i + 1];
      const ta = tops[i], tb = tops[i + 1];
      const ba = thick ? ta - thick : bottom, bb2 = thick ? tb - thick : bottom;
      const u0 = acc / (opts.uScale || 1), u1 = (acc + l) / (opts.uScale || 1);
      // inner face, top, outer face
      quad([ia[0], ta, -ia[1]], [ia[0], ba, -ia[1]], [ib[0], tb, -ib[1]], [ib[0], bb2, -ib[1]], u0, u1, ta, ba);
      quad([oa[0], ta, -oa[1]], [ia[0], ta, -ia[1]], [ob[0], tb, -ob[1]], [ib[0], tb, -ib[1]], u0, u1, 0.3, 0);
      quad([ob[0], tb, -ob[1]], [ob[0], bb2, -ob[1]], [oa[0], ta, -oa[1]], [oa[0], ba, -oa[1]], u1, u0, tb, bb2);
      if (thick) quad([ib[0], bb2, -ib[1]], [ob[0], bb2, -ob[1]], [ia[0], ba, -ia[1]], [oa[0], ba, -oa[1]], u0, u1, 0.3, 0);
      acc += l;
    }
    if (!closed) {
      const cap = (i, flip) => {
        const ia = inner[i], oa = outer[i], ta = tops[i], ba = thick ? ta - thick : bottom;
        if (flip) quad([oa[0], ta, -oa[1]], [oa[0], ba, -oa[1]], [ia[0], ta, -ia[1]], [ia[0], ba, -ia[1]], 0, w, ta, ba);
        else quad([ia[0], ta, -ia[1]], [ia[0], ba, -ia[1]], [oa[0], ta, -oa[1]], [oa[0], ba, -oa[1]], 0, w, ta, ba);
      };
      cap(0, false); cap(P.length - 1, true);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    return { geo: g, line: P, normals: N, tops };
  }
  PC.railGeometry = railGeometry;

  class Particles {
    constructor(scene, max, texture, blending) {
      this.max = max; this.n = 0;
      this.items = [];
      const g = new THREE.BufferGeometry();
      this.pos = new Float32Array(max * 3); this.colr = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.colr, 3));
      g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
      g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture }, scale: { value: 400 } },
        vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(map, gl_PointCoord); if(t.a*vA<0.02) discard; gl_FragColor=vec4(vC*t.rgb, t.a*vA); }',
        transparent: true, depthWrite: false, blending: blending || THREE.NormalBlending,
      });
      this.points = new THREE.Points(g, mat);
      this.points.frustumCulled = false;
      scene.add(this.points);
    }
    spawn(p) { if (this.items.length >= this.max) this.items.shift(); this.items.push(Object.assign({ age: 0, life: 1, drag: 0.98, g: -6, size: 0.1, color: new THREE.Color(1, 1, 1), fade: 1 }, p)); }
    update(dt) {
      const it = this.items;
      for (let i = it.length - 1; i >= 0; i--) {
        const p = it[i];
        p.age += dt;
        if (p.age >= p.life) { it.splice(i, 1); continue; }
        p.vy += p.g * dt;
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d; p.vz *= d;
        if (p.wobble) { p.vx += Math.sin(p.age * 7 + p.seed) * p.wobble * dt; p.vz += Math.cos(p.age * 5 + p.seed) * p.wobble * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.floor !== undefined && p.y < p.floor) { p.y = p.floor; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
      }
      for (let i = 0; i < this.max; i++) {
        const p = it[i];
        if (!p) { this.alpha[i] = 0; this.size[i] = 0; continue; }
        this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
        this.colr[i * 3] = p.color.r; this.colr[i * 3 + 1] = p.color.g; this.colr[i * 3 + 2] = p.color.b;
        const k = p.age / p.life;
        this.size[i] = p.size * (p.grow ? 1 + k * p.grow : 1);
        this.alpha[i] = (p.fade ? Math.min(1, (1 - k) * 2.5) : 1) * Math.min(1, p.age * 12) * (p.a === undefined ? 1 : p.a);
      }
      const g = this.points.geometry;
      ['position', 'color', 'size', 'alpha'].forEach(k => { g.attributes[k].needsUpdate = true; });
    }
    clear() { this.items.length = 0; }
  }
  PC.Particles = Particles;

  class World {
    constructor(canvas) {
      const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
      this.mats = {};

      this.hemi = new THREE.HemisphereLight(0xffffff, 0x445522, 0.9);
      this.scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
      this.sun.castShadow = true;
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;
      this.sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.02;
      this.scene.add(this.sun, this.sun.target);

      // Sky dome
      this.skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
      const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
        uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying vec3 vP; void main(){ float h=max(vP.y,0.0); vec3 c=mix(horizon, mid, smoothstep(0.0,0.18,h)); c=mix(c, top, smoothstep(0.15,0.75,h)); gl_FragColor=vec4(c,1.0); }',
      }));
      sky.renderOrder = -1;
      this.sky = sky;
      this.scene.add(sky);

      // Lawn all around
      const gt = T.grass(); gt.repeat.set(70, 70);
      this.groundMat = new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: 0xffffff });
      const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48), this.groundMat);
      ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND_Y; ground.receiveShadow = true;
      this.scene.add(ground);
      this.ground = ground;

      // The Abyss: a sea of lava far below the platforms
      // The Abyss: a lake of flowing lava far below, in two layers drifting different ways
      this.lavaSea = new THREE.Group();
      const lt1 = T.lavaDeep().clone(); lt1.needsUpdate = true; lt1.repeat.set(5, 5);
      const lt2 = T.lavaDeep().clone(); lt2.needsUpdate = true; lt2.repeat.set(2.3, 2.3); lt2.rotation = 0.7;
      const sea1 = new THREE.Mesh(new THREE.CircleGeometry(240, 48), new THREE.MeshBasicMaterial({ map: lt1, color: col('#ffffff') }));
      const sea2 = new THREE.Mesh(new THREE.CircleGeometry(240, 48), new THREE.MeshBasicMaterial({ map: lt2, color: col('#ff7a2a'), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      sea1.rotation.x = sea2.rotation.x = -Math.PI / 2;
      sea2.position.y = 0.3;
      this.lavaSea.add(sea1, sea2);
      this.lavaSea.position.y = -62; this.lavaSea.visible = false;
      this.lavaSeaTex = [lt1, lt2];
      this.scene.add(this.lavaSea);

      // Lights only the Abyss uses. They always exist (at zero in the Garden) so materials never need rebuilding.
      this.rim = new THREE.DirectionalLight(col('#7a86ff'), 0);
      this.scene.add(this.rim, this.rim.target);
      this.pts = [0, 1, 2].map(() => { const l = new THREE.PointLight(col('#ff6a1a'), 0, 90, 1.6); this.scene.add(l); return l; });

      this.holeGroup = new THREE.Group();
      this.scene.add(this.holeGroup);

      // Ball
      const dim = T.dimples(); dim.repeat.set(3, 2);
      this.ball = new THREE.Mesh(new THREE.SphereGeometry(C.R, 32, 20), new THREE.MeshStandardMaterial({ color: col('#fbfbf7'), roughness: 0.32, bumpMap: dim, bumpScale: 0.004, emissive: col('#222222') }));
      this.ball.castShadow = true;
      this.scene.add(this.ball);
      this.ballQ = new THREE.Quaternion();

      // Aim arrow, guide dots and a power ring
      this.aim = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(-0.07, 0); shape.lineTo(0.07, 0); shape.lineTo(0.07, 0.8); shape.lineTo(0.19, 0.8); shape.lineTo(0, 1); shape.lineTo(-0.19, 0.8); shape.lineTo(-0.07, 0.8); shape.closePath();
      this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false });
      this.arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.arrowMat);
      this.arrow.rotation.x = -Math.PI / 2;
      this.arrowPivot = new THREE.Group(); this.arrowPivot.add(this.arrow);
      this.aim.add(this.arrowPivot);
      this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), 140);
      this.dots.frustumCulled = false;
      this.aim.add(this.dots);
      this.ring = new THREE.Mesh(new THREE.RingGeometry(C.R * 1.6, C.R * 2.1, 40, 1, 0, Math.PI * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
      this.ring.rotation.x = -Math.PI / 2;
      this.aim.add(this.ring);
      this.aim.visible = false;
      this.aim.renderOrder = 5;
      this.scene.add(this.aim);

      this.fx = new Particles(this.scene, 700, T.petal());
      this.glow = new Particles(this.scene, 400, T.dot());
      this.smoke = new Particles(this.scene, 140, T.dot());
      this.trail = [];
      this.resize();
    }

    mat(key, make) { return this.mats[key] || (this.mats[key] = make()); }

    resize() {
      const w = this.renderer.domElement.clientWidth || window.innerWidth, h = this.renderer.domElement.clientHeight || window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
      this.fx.points.material.uniforms.scale.value = h * 0.9;
      this.glow.points.material.uniforms.scale.value = h * 0.9;
      if (this.smoke) this.smoke.points.material.uniforms.scale.value = h * 0.9;
    }

    setLight(name) {
      const L = LIGHTS[name] || LIGHTS.day;
      this.L = L;
      this.skyU.top.value.set(L.top); this.skyU.mid.value.set(L.mid); this.skyU.horizon.value.set(L.horizon);
      this.hemi.color = col(L.hemiSky); this.hemi.groundColor = col(L.hemiGround); this.hemi.intensity = L.hemiI;
      this.sun.color = col(L.sun); this.sun.intensity = L.sunI;
      const hell = name === 'abyss', desert = name === 'mesa' || name === 'winter';
      this.scene.fog = hell ? new THREE.Fog(col(L.fog), 24, 135) : desert ? new THREE.Fog(col(L.fog), 70, 240) : new THREE.Fog(col(L.fog), 45, 190);
      this.groundMat.color = col(L.grass).multiplyScalar(1.25);
      this.ground.visible = !hell && !desert;
      this.lavaSea.visible = hell;
      this.rim.intensity = hell ? 0.45 : 0;
      this.pts.forEach(l => { l.intensity = 0; });
      this.renderer.toneMappingExposure = L.exposure;
    }

    clearHole() {
      const g = this.holeGroup;
      g.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });
      while (g.children.length) g.remove(g.children[0]);
      this.vis = [];
      this.ghosts = [];
      this.fx.clear(); this.glow.clear(); this.smoke.clear(); this.trail = [];
    }

    // Build everything for one hole.
    build(hole, sim) {
      this.clearHole();
      this.hole = hole; this.sim = sim;
      const L = this.setLight(hole.look.light) || this.L;
      const G = this.holeGroup;
      const b = hole.box;

      // Sun over the left shoulder, shadows sized to the hole
      const cx = b.cx, cy = b.cy, ext = Math.max(b.w, b.h) / 2 + 7;
      this.sun.position.copy(V(cx - 9, cy - 6, 16));
      this.sun.target.position.copy(V(cx, cy, 0));
      const sc = this.sun.shadow.camera;
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 60;
      sc.updateProjectionMatrix();
      this.rim.position.copy(V(cx + 14, cy + 30, 26)); this.rim.target.position.copy(V(cx, cy, 0));

      const hAt = (x, y) => sim.floorHeight(x, y);
      const hell = hole.look.theme === 'abyss', desert = hole.look.theme === 'canyon', winter = hole.look.theme === 'winter';
      this.hell = hell;
      const turf = hell ? T.templeFloor() : T.turf(L.turf);
      const turfMat = new THREE.MeshStandardMaterial({ map: turf, roughness: hell ? 0.55 : 0.92, metalness: hell ? 0.1 : 0, color: hell || desert || winter ? col('#ffffff') : col('#e4f0dc') });
      const skirtStyle = hell ? 'temple' : desert ? 'sandstone' : winter ? 'snow' : hole.look.skirt || (hole.look.rail === 'stone' || hole.look.rail === 'brick' ? hole.look.rail : 'soil');
      if (desert) this.buildDesertGround(hole);
      if (winter) this.buildDesertGround(hole, T.snow(), '#ffffff');
      const skirtMat = this.railMaterials(skirtStyle).body;
      const skirtBottom = hell ? -1.5 : GROUND_Y - 0.02;

      hole.floors.forEach((f, fi) => {
        let m = turfMat;
        if (f.mat === 'planks') { const t = T.planks(); m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }); }
        const geo = surfaceGeometry(f.poly, hAt, { lift: fi * 0.002, cell: hole.look.cell || 0.3, uv: f.mat === 'planks' ? (x, y) => [x / 1.2 + 0.5, y / 2] : undefined });
        const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; G.add(mesh);
        const sk = new THREE.Mesh(skirtGeometry(f.poly, (x, y) => {
          const c = U.centroid(f.poly), dx = c[0] - x, dy = c[1] - y, l = Math.hypot(dx, dy) || 1;
          return hAt(x + dx / l * 0.01, y + dy / l * 0.01) - 0.002;
        }, skirtBottom, true, 0.02), skirtMat);
        sk.receiveShadow = true; G.add(sk);
      });
      if (hell) this.buildEdges(hole, hAt);

      // Friction zones painted on the green
      hole.zones.forEach(z => this.buildZone(z, hole, hAt));
      // Water and flowerbeds
      hole.hazards.forEach(z => this.buildHazard(z, hole));
      // Rails and walls
      hole.rails.forEach(r => this.buildRail(r, hole, sim));
      // Posts
      hole.posts.forEach(p => PC.VIS.post(p, this));

      this.buildCup(hole, sim);
      this.buildTee(hole, sim);
      if (hell) PC.VIS.decorateAbyss(hole, this, sim); else if (desert) PC.VIS.decorateCanyon(hole, this, sim); else if (winter) PC.VIS.decorateWinter(hole, this, sim); else PC.VIS.decorate(hole, this, sim);
      (sim.feats || []).forEach(f => { const v = (hell && PC.VIS.abyss[f.type]) || (desert && PC.VIS.canyon[f.type]) || (winter && PC.VIS.winter[f.type]) || PC.VIS[f.type]; if (v) { const o = v(f.spec, this, f, sim); if (o) this.vis.push(o); } });
      this.ghosts = [];
      return this;
    }

    railMaterials(style) {
      return this.mat('rail-' + style, () => {
        const M = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85 }, o));
        switch (style) {
          case 'stone': { const t = T.stone(); return { body: M({ map: t }), cap: M({ color: col('#cfc8b8'), roughness: 0.9 }) }; }
          case 'brick': { const t = T.brick(); t.repeat.set(1, 2); return { body: M({ map: t }), cap: M({ color: col('#d9cdb9') }) }; }
          case 'hedge': { const t = T.hedge(); return { body: M({ map: t, roughness: 1 }), cap: null }; }
          case 'white': { const t = T.wood('#f2efe6'); return { body: M({ map: t, roughness: 0.7 }), cap: M({ color: col('#ffffff'), roughness: 0.6 }) }; }
          case 'petal': { const t = T.wood('#ffcf33'); return { body: M({ map: t, roughness: 0.6 }), cap: M({ color: col('#ffe680'), roughness: 0.5 }) }; }
          case 'glass': { const t = T.wood('#f4f4ee'); return { body: M({ map: t, roughness: 0.6 }), cap: M({ color: col('#ffffff'), roughness: 0.5 }) }; }
          case 'trellis': { const t = T.wood('#ece7dc'); return { body: M({ map: t, roughness: 0.7 }), cap: M({ color: col('#fbfaf5') }) }; }
          case 'soil': { const t = T.soil(); return { body: M({ map: t, roughness: 1 }), cap: null }; }
          case 'sandstone': { const t = T.sandstone(); return { body: M({ map: t, roughness: 0.95 }), cap: M({ color: col('#e0a070'), roughness: 0.9 }) }; }
          case 'plank': { const t = T.wood('#9a7a52'); return { body: M({ map: t, roughness: 0.95 }), cap: M({ color: col('#b89466'), roughness: 0.9 }) }; }
          case 'candy': { const t = T.candy().clone(); t.needsUpdate = true; t.repeat.set(1.4, 1); return { body: M({ map: t, roughness: 0.35 }), cap: M({ color: col('#fbf6f0'), roughness: 0.3 }) }; }
          case 'gingerbread': { const t = T.gingerbread(); return { body: M({ map: t, roughness: 0.9 }), cap: M({ color: col('#fffaf4'), roughness: 0.6 }) }; }
          case 'present': { const t = T.wrap('#c8283a'); return { body: M({ map: t, roughness: 0.6 }), cap: M({ color: col('#f2c94c'), roughness: 0.4, metalness: 0.3 }) }; }
          case 'snowbank': case 'snow': { const t = T.snow(); return { body: M({ map: t, roughness: 1, color: col('#f2f6fb') }), cap: style === 'snowbank' ? M({ color: col('#ffffff'), roughness: 1 }) : null }; }
          case 'ice': { const t = T.ice(); return { body: M({ map: t, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.85 }), cap: M({ color: col('#e8f6ff'), roughness: 0.1 }) }; }
          case 'basalt': case 'temple': { const t = T.templeStone(); return { body: M({ map: t, roughness: 0.9 }), cap: M({ color: col('#4a3e3c'), roughness: 0.7 }) }; }
          case 'obsidian': { const t = T.obsidian(); return { body: M({ map: t, roughness: 0.25, metalness: 0.2 }), cap: M({ color: col('#ff5a1a'), emissive: col('#ff4a10'), emissiveIntensity: 0.9, roughness: 0.5 }) }; }
          default: { const t = T.wood('#a8713f'); return { body: M({ map: t }), cap: M({ color: col('#c99a63'), roughness: 0.75 }) }; }
        }
      });
    }

    buildRail(r, hole, sim) {
      if (r.style === 'none') { if (r.top && r.h === 0) this.buildLedge(r, hole, sim); return; }
      const G = this.holeGroup;
      const mats = this.railMaterials(r.style);
      const visH = r.style === 'hedge' ? r.h + 0.06 : r.style === 'trellis' ? 0.16 : r.h;
      const topAt = r.top ? (x, y, px, py) => r.top(px, py) : (x, y) => sim.groundRaw(x, y) + visH;
      const w = r.style === 'hedge' ? r.w + 0.04 : r.w;
      const body = railGeometry(r.pts, r.closed, r.side, w, topAt, GROUND_Y - 0.03, { uScale: r.style === 'hedge' ? 1.5 : 1 });
      const m = new THREE.Mesh(body.geo, mats.body); m.castShadow = true; m.receiveShadow = true; G.add(m);
      if (mats.cap) {
        const capTop = (x, y, px, py) => topAt(x, y, px, py) + 0.045;
        const cap = railGeometry(r.pts, r.closed, r.side, w, capTop, 0, { thick: 0.05, inset: 0.025 });
        const cm = new THREE.Mesh(cap.geo, mats.cap); cm.castShadow = true; cm.receiveShadow = true; G.add(cm);
      }
      if (PC.VIS.railExtras) PC.VIS.railExtras(r, body, this, sim);
    }

    // The face of a ledge (an invisible wall you can drop off but not climb): a strip from the lower
    // ground up to the ledge, in the course's skirt material, so the step is easy to see.
    buildLedge(r, hole, sim) {
      const theme = hole.look.theme, style = theme === 'winter' ? 'snow' : theme === 'canyon' ? 'sandstone' : theme === 'abyss' ? 'temple' : 'soil';
      const pts = U.resample(r.pts, 0.15, false), pos = [], uv = [], idx = [];
      let run = 0;
      pts.forEach((p, i) => {
        const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
        const dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        if (i) run += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
        const top = r.top(p[0], p[1]);
        const low = Math.min(sim.floorHeight(p[0] + nx * 0.12, p[1] + ny * 0.12), sim.floorHeight(p[0] - nx * 0.12, p[1] - ny * 0.12));
        pos.push(p[0], top + 0.004, -p[1], p[0], low - 0.01, -p[1]);
        uv.push(run / 2, top / 2, run / 2, low / 2);
      });
      for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = this.railMaterials(style).body.clone(); m.side = THREE.DoubleSide;
      const face = new THREE.Mesh(g, m); face.receiveShadow = true;
      this.holeGroup.add(face);
    }

    buildZone(z, hole, hAt) {
      const G = this.holeGroup;
      let m, lift = 0.006, uv;
      switch (z.type) {
        case 'slime': m = new THREE.MeshPhysicalMaterial({ map: T.slime(), color: col('#a6e85a'), roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.9, emissive: col('#2f5a10'), emissiveIntensity: 0.25 }); lift = 0.008; uv = (x, y) => [x / 2, y / 2]; break;
        case 'honey': m = new THREE.MeshPhysicalMaterial({ map: T.honey(), color: col('#ffffff'), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.95, emissive: col('#5a2c00'), emissiveIntensity: 0.2 }); lift = 0.012; uv = (x, y) => [x / 2.5, y / 2.5]; break;
        case 'soil': { const t = T.soil(); m = new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); uv = (x, y) => [x / 2, y / 2]; break; }
        case 'seeds': {
          const f = (hole.features || []).find(q => q.type === 'sunflower');
          const t = T.seeds();
          m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
          uv = (x, y) => [(x - f.x) / (2 * f.r) + 0.5, (y - f.y) / (2 * f.r) + 0.5];
          break;
        }
        case 'glass': m = new THREE.MeshPhysicalMaterial({ map: T.obsidian(), color: col('#ffffff'), roughness: 0.03, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 }); lift = 0.008; uv = (x, y) => [x / 2, y / 2]; break;
        case 'tar': m = new THREE.MeshPhysicalMaterial({ map: T.tar(), color: col('#ffffff'), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1 }); lift = 0.012; uv = (x, y) => [x / 2.5, y / 2.5]; break;
        case 'sand': { const t = T.sand(); m = new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: col('#f4e2c0') }); uv = (x, y) => [x / 2, y / 2]; break; }
        case 'ice': m = new THREE.MeshPhysicalMaterial({ map: T.ice(), color: col('#ffffff'), roughness: 0.06, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }); lift = 0.008; uv = (x, y) => [x / 3, y / 3]; break;
        case 'snow': {
          // A soft drift that bulges up away from its edges (the ball sinks into it).
          const t = T.snow(); m = new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: col('#ffffff') });
          const P = z.poly, geo = surfaceGeometry(P, (x, y) => hAt(x, y) + 0.015 + 0.13 * U.smooth(0, 0.55, U.inPoly(x, y, P) ? U.distToPoly(x, y, P) : 0) * (0.85 + 0.15 * Math.sin(x * 3.1 + y * 2.3)), { uv: (x, y) => [x / 2, y / 2], cell: 0.12 });
          const dm = new THREE.Mesh(geo, m); dm.receiveShadow = true; dm.castShadow = true; G.add(dm);
          return;
        }
        case 'ash': case 'cinder': { const t = T.ash(); m = new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: col(z.type === 'cinder' ? '#8a7a76' : '#ffffff') }); uv = (x, y) => [x / 2, y / 2]; break; }
        default: return;
      }
      const geo = surfaceGeometry(z.poly, (x, y) => hAt(x, y), { lift, uv, cell: 0.25 });
      const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; G.add(mesh);
    }

    buildHazard(z, hole) {
      const G = this.holeGroup;
      const flat = (P, y) => {
        const shape = new THREE.Shape(P.map(p => new THREE.Vector2(p[0], p[1])));
        const g = new THREE.ShapeGeometry(shape, 1);
        g.rotateX(-Math.PI / 2);
        g.translate(0, y, 0);
        return g;
      };
      if (z.kind === 'lava' && z.fire) { this.buildFirePit(z); return; }
      if (z.kind === 'lava') {
        const lt = T.lava(); lt.repeat.set(0.3, 0.3);
        // Lava makes its own light, so it is drawn unlit and never picks up the cavern's colours.
        const lm = new THREE.MeshBasicMaterial({ map: lt, color: col('#ffb27a') });
        if (z.over) {
          const lvl = z.level;
          const geo = surfaceGeometry(z.poly, lvl !== undefined ? () => lvl : (x, y) => this.sim.floorHeight(x, y), { lift: 0.014, uv: (x, y) => [x / 2.5, y / 2.5], cell: 0.2 });
          const m = new THREE.Mesh(geo, lm); G.add(m);
          const rim = railGeometry(z.poly, true, 'out', 0.09, lvl !== undefined ? () => lvl + 0.03 : (x, y) => this.sim.floorHeight(x, y) + 0.03, 0, { thick: 0.05 });
          const rm = new THREE.Mesh(rim.geo, this.railMaterials('temple').cap); G.add(rm);
        } else {
          G.add(new THREE.Mesh(flat(z.poly, z.top - 0.02), lm));
          const rim = new THREE.Mesh(skirtGeometry(z.poly, () => z.top + 0.05, -1.5), this.railMaterials('temple').body); G.add(rim);
        }
        this.vis.push({ update: (t) => { lt.offset.set(t * 0.012, t * 0.008); lm.color.setRGB(1, 0.62 + Math.sin(t * 2.1) * 0.05, 0.42); } });
        return;
      }
      if (z.kind === 'chasm') { this.buildChasm(z); return; }
      if (z.kind === 'water' && z.over) {
        // A pool set into the green, like the lava pools: water sitting just below the surface, with a stone lip.
        const n = T.waterNormal().clone(); n.needsUpdate = true; n.repeat.set(0.4, 0.4);
        const wm = new THREE.MeshPhysicalMaterial({ color: col(z.cold ? '#1f5a78' : '#2f8fa8'), roughness: 0.06, metalness: 0.05, transparent: true, opacity: 0.9, normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1 });
        const geo = surfaceGeometry(z.poly, (x, y) => this.sim.floorHeight(x, y), { lift: 0.012, uv: (x, y) => [x / 2, y / 2], cell: 0.2 });
        G.add(new THREE.Mesh(geo, wm));
        const rim = railGeometry(z.poly, true, 'out', 0.16, (x, y) => this.sim.floorHeight(x, y) + 0.04, 0, { thick: 0.06 });
        G.add(new THREE.Mesh(rim.geo, z.cold ? this.railMaterials('snow').body : this.railMaterials('sandstone').cap));
        this.vis.push({ update: (t) => { n.offset.set(t * 0.02, t * 0.013); } });
        return;
      }
      if (z.kind === 'water') {
        const bed = new THREE.Mesh(flat(z.poly, z.bed), new THREE.MeshStandardMaterial({ map: T.pebbles(), color: col('#7c8f86'), roughness: 1 }));
        bed.geometry.attributes.uv && bed.material.map.repeat.set(0.6, 0.6);
        bed.receiveShadow = true; G.add(bed);
        const n = T.waterNormal();
        const wm = new THREE.MeshPhysicalMaterial({ color: col(z.cold ? '#24607e' : '#3b93ad'), roughness: 0.06, metalness: 0.05, transparent: true, opacity: z.cold ? 0.88 : 0.78, normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.1 });
        n.repeat.set(0.35, 0.35);
        const water = new THREE.Mesh(flat(z.poly, z.top - 0.02), wm);
        water.receiveShadow = true; water.renderOrder = 2; G.add(water);
        this.vis.push({ update: (t) => { n.offset.set(t * 0.02, t * 0.013); } });
        const rim = new THREE.Mesh(skirtGeometry(z.poly, () => z.top + 0.07, GROUND_Y - 0.02), this.railMaterials(z.cold ? 'snow' : 'stone').body);
        rim.receiveShadow = true; G.add(rim);
        const lip = railGeometry(z.poly, true, 'out', 0.26, () => z.top + 0.1, GROUND_Y - 0.02, { thick: 0.08, inset: 0.03 });
        const lm = new THREE.Mesh(lip.geo, this.railMaterials(z.cold ? 'snow' : 'stone').body); lm.receiveShadow = true; lm.castShadow = true; G.add(lm);
      } else {
        const bed = new THREE.Mesh(flat(z.poly, z.top - 0.18), new THREE.MeshStandardMaterial({ map: T.soil(), roughness: 1 }));
        bed.receiveShadow = true; G.add(bed);
        PC.VIS.flowerPit(z, this);
      }
    }

    buildCup(hole, sim) {
      const G = this.holeGroup;
      const cup = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(C.CUP_R, 40), new THREE.MeshBasicMaterial({ map: T.cupShade() }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.016;
      const rim = new THREE.Mesh(new THREE.RingGeometry(C.CUP_R - 0.005, C.CUP_R + 0.03, 48), new THREE.MeshStandardMaterial({ color: col('#f6f6f0'), roughness: 0.5 }));
      rim.rotation.x = -Math.PI / 2; rim.position.y = 0.017;
      cup.add(disc, rim);
      const flagG = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.75, 10), new THREE.MeshStandardMaterial({ map: T.pole(), roughness: 0.5 }));
      pole.position.y = 0.875; pole.castShadow = true;
      const flagGeo = new THREE.PlaneGeometry(0.66, 0.42, 12, 4);
      flagGeo.translate(0.33, 0, 0);
      const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: T.flag(hole.num, hole.look.flag || '#e2463b'), side: THREE.DoubleSide, roughness: 0.8 }));
      flag.position.set(0.02, 1.5, 0); flag.castShadow = true;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshStandardMaterial({ color: col('#ffd23f'), roughness: 0.3, metalness: 0.4 }));
      knob.position.y = 1.77;
      flagG.add(pole, flag, knob);
      cup.add(flagG);
      G.add(cup);
      this.cup = { group: cup, flag, flagG, base: flagGeo.attributes.position.array.slice(), lift: 0 };
    }

    buildTee(hole, sim) {
      const G = this.holeGroup;
      const [tx, ty] = hole.tee;
      const h = sim.floorHeight(tx, ty);
      const ang = Math.atan2(hole.cup[1] - ty, hole.cup[0] - tx);
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.75), new THREE.MeshStandardMaterial({ map: hole.look.theme === 'abyss' ? T.ash() : hole.look.theme === 'canyon' ? T.teeRug() : hole.look.theme === 'winter' ? T.teeKnit() : T.turf('#3f8a33'), roughness: 1 }));
      mat.rotation.x = -Math.PI / 2; mat.rotation.z = ang - Math.PI / 2;
      mat.position.copy(V(tx, ty, h + 0.026)); mat.receiveShadow = true;   // above any ice or snow painted on the green
      G.add(mat);
      [-1, 1].forEach(s => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshStandardMaterial({ color: col(s < 0 ? '#e2463b' : '#ffffff'), roughness: 0.4 }));
        const px = tx + Math.cos(ang + Math.PI / 2) * 0.62 * s, py = ty + Math.sin(ang + Math.PI / 2) * 0.62 * s;
        m.position.copy(V(px, py, sim.floorHeight(px, py) + 0.06)); m.castShadow = true;
        G.add(m);
      });
    }

    // The desert floor for a canyon hole, with any gulches cut out of it so they really drop away.
    buildDesertGround(hole, groundTex, tint) {
      const G = this.holeGroup, b = hole.box;
      const shape = new THREE.Shape(U.circle(b.cx, b.cy, 230, 64).map(p => new THREE.Vector2(p[0], p[1])));
      hole.hazards.filter(z => z.kind === 'chasm').forEach(z => {
        const P = U.cw(z.poly.map(p => [U.clamp(p[0], b.cx - 220, b.cx + 220), U.clamp(p[1], b.cy - 220, b.cy + 220)]));
        shape.holes.push(new THREE.Path(P.map(p => new THREE.Vector2(p[0], p[1]))));
      });
      const geo = new THREE.ShapeGeometry(shape, 1);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, GROUND_Y, 0);
      const t = (groundTex || T.sand()).clone(); t.needsUpdate = true; t.repeat.set(0.25, 0.25);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: col(tint || '#f0dcc0') }));
      m.receiveShadow = true;
      G.add(m);
    }
    // A burning pit set into the platform: a ring of stone, a bed of glowing coals and flames licking up.
    buildFirePit(z) {
      const G = this.holeGroup, sim = this.sim;
      const c = U.centroid(z.poly), r = Math.max(...z.poly.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])));
      const h = sim.floorHeight(c[0], c[1]);
      const coalT = T.lava().clone(); coalT.needsUpdate = true; coalT.repeat.set(0.5, 0.5);
      const coals = new THREE.MeshBasicMaterial({ map: coalT, color: col('#ff8a3a') });
      const geo = surfaceGeometry(z.poly, (x, y) => sim.floorHeight(x, y), { lift: 0.006, uv: (x, y) => [x / 1.5, y / 1.5], cell: 0.15 });
      G.add(new THREE.Mesh(geo, coals));
      const rim = railGeometry(z.poly, true, 'out', 0.11, (x, y) => sim.floorHeight(x, y) + 0.07, 0, { thick: 0.08 });
      G.add(new THREE.Mesh(rim.geo, this.railMaterials('temple').body));
      const flame = this.mat('flame', () => new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 }, seed: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform float t; uniform float seed; varying vec2 vUv;',
          'float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
          'float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }',
          'void main() {',
          '  vec2 uv = vUv; float y = uv.y; float tt = t + seed * 7.0;',
          '  float q = n(vec2(uv.x * 4.0 + seed * 3.0, y * 3.0 - tt * 2.6)) * 0.6 + n(vec2(uv.x * 9.0 - seed, y * 7.0 - tt * 4.3)) * 0.4;',
          '  float w = (1.0 - y) * 0.5 + 0.06;',
          '  float d = abs(uv.x - 0.5 + (q - 0.5) * 0.25 * y) / w;',
          '  float f = clamp((1.0 - d - y * 0.55 + (q - 0.5) * 0.8 * (0.25 + y)) * 1.7, 0.0, 1.0);',
          '  vec3 c = mix(vec3(0.95, 0.18, 0.02), vec3(1.0, 0.62, 0.12), smoothstep(0.15, 0.6, f));',
          '  c = mix(c, vec3(1.0, 0.95, 0.75), smoothstep(0.7, 1.0, f));',
          '  float a = f * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.8, 1.0, y));',
          '  gl_FragColor = vec4(c * a, a);',
          '}',
        ].join('\n'),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      const fm = flame.clone(); fm.uniforms = { t: { value: 0 }, seed: { value: (c[0] * 0.37 + c[1] * 0.71) % 1 } };
      const fg = new THREE.Group();
      const hgt = 0.75 + r * 1.1, wid = r * 2.1;
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), fm);
        p.position.y = hgt / 2; p.rotation.y = (i / 3) * Math.PI;
        p.renderOrder = 5;
        fg.add(p);
      }
      const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 2.6, 24), new THREE.MeshBasicMaterial({ map: T.fade ? T.fade() : null, color: col('#ff6a1a'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02;
      fg.add(glow);
      fg.position.copy(V(c[0], c[1], h));
      G.add(fg);
      let acc = Math.random();
      this.vis.push({ update: (t, dt) => {
        fm.uniforms.t.value = t;
        coalT.offset.set(t * 0.02, t * 0.013);
        coals.color.setRGB(1, 0.5 + Math.sin(t * 3.1 + c[0]) * 0.08, 0.2);
        fg.scale.set(1, 1 + Math.sin(t * 7 + c[1]) * 0.06, 1);
        acc += dt || 0;
        if (acc > 0.18) { acc = 0; this.glow.spawn({ x: c[0] + (Math.random() - 0.5) * r, y: h + 0.3, z: -c[1] + (Math.random() - 0.5) * r, vx: (Math.random() - 0.5) * 0.3, vy: 1.2 + Math.random(), vz: (Math.random() - 0.5) * 0.3, g: 0.1, drag: 0.98, life: 1.2, size: 0.05, color: col(Math.random() < 0.5 ? '#ff8a2a' : '#ffd25a') }); }
      } });
    }

    buildChasm(z) {
      const G = this.holeGroup;
      // Banded walls that darken as they go down, so the gulch reads as deep.
      const P = U.resample(z.poly, 0.4, true); P.push(P[0]);
      const rows = [GROUND_Y, GROUND_Y - 0.3, -1.2, -1.9, -2.8, -4, -6, -10];
      const pos = [], uvs = [], cols = [], idx = [], top = col('#ffffff'), low = col('#2a1208');
      let run = 0;
      P.forEach((p, i) => {
        if (i) run += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]);
        rows.forEach(y => {
          pos.push(p[0], y, -p[1]); uvs.push(run / 3, y / 2.2);
          const k = Math.pow(U.clamp((y + 4.6) / (4.6 + GROUND_Y), 0, 1), 1.6), c = low.clone().lerp(top, k);
          cols.push(c.r, c.g, c.b);
        });
      });
      const R = rows.length;
      for (let i = 0; i < P.length - 1; i++) for (let r = 0; r < R - 1; r++) { const a = i * R + r, b = (i + 1) * R + r; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      wg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      wg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      wg.setIndex(idx); wg.computeVertexNormals();
      const wt = T.sandstone().clone(); wt.needsUpdate = true;
      const walls = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ map: wt, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
      G.add(walls);
      const shape = new THREE.Shape(z.poly.map(p => new THREE.Vector2(p[0], p[1])));
      const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2).translate(0, -10, 0), new THREE.MeshBasicMaterial({ color: col('#2a140a') }));
      G.add(floor);
      // A dark haze deeper down so the gulch looks deep.
      for (let i = 1; i <= 3; i++) {
        const haze = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2).translate(0, GROUND_Y - i * 2.6, 0), new THREE.MeshBasicMaterial({ color: col('#3a1e10'), transparent: true, opacity: 0.32, depthWrite: false }));
        G.add(haze);
      }
    }

    // Abyss platforms have no rails, so their edges glow to show where the drop is.
    buildEdges(hole, hAt) {
      const others = (fi, x, y) => hole.floors.some((g, gi) => gi !== fi && U.inPoly(x, y, g.poly) && U.distToPoly(x, y, g.poly) > 0.05);
      const pos = [];
      hole.floors.forEach((f, fi) => {
        const P = U.resample(f.poly, 0.2, true);
        const N = U.normals(P, true);
        for (let i = 0; i < P.length; i++) {
          const a = P[i], b = P[(i + 1) % P.length], na = N[i], nb = N[(i + 1) % P.length];
          if (others(fi, a[0], a[1]) || others(fi, b[0], b[1])) continue;
          const w = 0.07, y = 0.006 + fi * 0.002;
          const ia = [a[0] - na[0] * w, a[1] - na[1] * w], ib = [b[0] - nb[0] * w, b[1] - nb[1] * w];
          const ha = hAt(a[0] - na[0] * 0.02, a[1] - na[1] * 0.02) + y, hb = hAt(b[0] - nb[0] * 0.02, b[1] - nb[1] * 0.02) + y;
          pos.push(a[0], ha, -a[1], ia[0], ha, -ia[1], b[0], hb, -b[1], b[0], hb, -b[1], ia[0], ha, -ia[1], ib[0], hb, -ib[1]);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      // A thin inlay of hot bronze along every drop, so the edge is always easy to see.
      this.edgeMat = new THREE.MeshBasicMaterial({ color: col('#e8813a'), side: THREE.DoubleSide });
      this.holeGroup.add(new THREE.Mesh(g, this.edgeMat));
      this.vis.push({ update: (t) => { this.edgeMat.color.copy(col('#e8813a')).multiplyScalar(0.9 + Math.sin(t * 1.6) * 0.1); } });
    }

    // Rivals show as see-through balls of their own colour with a name tag.
    setGhosts(list) {
      this.ghosts = list.map(r => {
        const m = new THREE.Mesh(this.ball.geometry, new THREE.MeshStandardMaterial({ color: col(r.color), transparent: true, opacity: 0.6, emissive: col(r.color), emissiveIntensity: 0.45, roughness: 0.4, depthWrite: false }));
        m.userData.shared = true;
        const c = document.createElement('canvas'); c.width = 256; c.height = 72;
        const g = c.getContext('2d');
        g.fillStyle = 'rgba(16,24,20,0.82)';
        if (g.roundRect) { g.beginPath(); g.roundRect(4, 8, 248, 56, 28); g.fill(); } else g.fillRect(4, 8, 248, 56);
        g.fillStyle = r.color; g.beginPath(); g.arc(36, 36, 12, 0, 7); g.fill();
        g.fillStyle = '#ffffff'; g.font = '700 32px Fredoka, Outfit, system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(r.name, 58, 38);
        const tex = new THREE.CanvasTexture(c);
        const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        lab.scale.set(0.62, 0.175, 1);
        lab.renderOrder = 6;
        this.holeGroup.add(m, lab);
        return { m, lab, r, q: new THREE.Quaternion() };
      });
    }
    updateGhosts(dt) {
      (this.ghosts || []).forEach(gh => {
        const b = gh.r.sim.ball;
        const vis = !gh.r.done && !b.hidden && b.mode !== 'lost' && b.mode !== 'sunk';
        gh.m.visible = vis; gh.lab.visible = vis;
        if (!vis) return;
        gh.m.position.copy(V(b.x, b.y, b.z));
        gh.lab.position.copy(V(b.x, b.y, b.z + 0.36));
        // Tags fade out near your own ball so they never cover it.
        const me = this.sim && this.sim.ball, near = me ? Math.hypot(me.x - b.x, me.y - b.y) : 9;
        gh.lab.material.opacity = U.clamp((near - 0.5) / 0.8, 0, 1);
        gh.lab.visible = gh.lab.material.opacity > 0.02;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0.01) { gh.q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-b.vy, 0, -b.vx).normalize(), (sp * dt) / C.R)); gh.m.quaternion.copy(gh.q); }
      });
    }

    // Aim display: arrow length and colour follow power; dots trace the expected line.
    showAim(x, y, z, angle, power, path) {
      this.aim.visible = true;
      this.arrowPivot.position.set(x, z - C.R + 0.02, -y);
      this.arrowPivot.rotation.y = angle - Math.PI / 2;
      const len = 0.35 + power * 1.6;
      this.arrow.scale.set(0.9 + power * 0.4, len, 1);
      this.arrow.position.set(0, 0, -C.R * 1.4);
      this.arrowPivot.rotation.order = 'YXZ';
      const c = new THREE.Color().setHSL(0.33 - power * 0.33, 0.9, 0.55);
      this.arrowMat.color.copy(c);
      this.ring.position.set(x, z - C.R + 0.015, -y);
      this.ring.material.color.copy(c);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      let n = 0;
      if (path) for (let i = 0; i < path.length && n < 140; i++, n++) {
        const p = path[i];
        const s = 1 - i / Math.max(1, path.length) * 0.6;
        m.compose(new THREE.Vector3(p[0], p[2] + 0.015, -p[1]), q, new THREE.Vector3(s, s, s));
        this.dots.setMatrixAt(n, m);
      }
      this.dots.count = n;
      this.dots.instanceMatrix.needsUpdate = true;
    }
    hideAim() { this.aim.visible = false; }

    burst(kind, x, y, h, opts = {}) {
      const P = this.fx, D = this.glow;
      const rnd = Math.random;
      if (kind === 'splash') {
        for (let i = 0; i < 40; i++) { const a = rnd() * 6.28, s = 0.6 + rnd() * 1.8; D.spawn({ x, y: h, z: -y, vx: Math.cos(a) * s, vy: 2 + rnd() * 3, vz: Math.sin(a) * s, g: -12, life: 0.7 + rnd() * 0.4, size: 0.07 + rnd() * 0.06, color: col('#e8f7ff') }); }
        for (let i = 0; i < 2; i++) D.spawn({ x, y: h + 0.01, z: -y, vx: 0, vy: 0, vz: 0, g: 0, life: 1.1, size: 0.5 + i * 0.5, grow: 2.5, color: col('#d8f2ff'), a: 0.5 });
      } else if (kind === 'sink' || kind === 'ace') {
        const n = kind === 'ace' ? 160 : 60;
        const cols = this.hole.look.flowers || ['#ff7aa8', '#ffd23f', '#ffffff'];
        for (let i = 0; i < n; i++) {
          const a = rnd() * 6.28, s = (kind === 'ace' ? 1.5 : 0.8) + rnd() * (kind === 'ace' ? 3 : 1.6);
          P.spawn({ x, y: h + 0.1, z: -y, vx: Math.cos(a) * s, vy: 3 + rnd() * (kind === 'ace' ? 5 : 3), vz: Math.sin(a) * s, g: -5, drag: 0.96, life: 1.6 + rnd() * 1.2, size: 0.09 + rnd() * 0.07, color: col(cols[i % cols.length]), wobble: 3, seed: rnd() * 9, floor: h + 0.01 });
        }
      } else if (kind === 'puff') {
        const c = col(opts.color || '#e9e1cf');
        for (let i = 0; i < (opts.n || 14); i++) { const a = rnd() * 6.28, s = 0.3 + rnd() * 0.9; D.spawn({ x, y: h + 0.05, z: -y, vx: Math.cos(a) * s, vy: 0.4 + rnd() * 0.8, vz: Math.sin(a) * s, g: -1, life: 0.6 + rnd() * 0.4, size: 0.12 + rnd() * 0.1, grow: 1.5, color: c, a: 0.55 }); }
      } else if (kind === 'seeds') {
        for (let i = 0; i < 40; i++) { const a = rnd() * 6.28, s = 0.4 + rnd() * 1.4; D.spawn({ x, y: h + 0.4, z: -y, vx: Math.cos(a) * s + (opts.dx || 0), vy: 0.6 + rnd() * 1.6, vz: Math.sin(a) * s - (opts.dy || 0), g: -0.25, drag: 0.97, life: 2 + rnd() * 1.5, size: 0.05 + rnd() * 0.04, color: col('#ffffff'), wobble: 2, seed: rnd() * 9 }); }
      } else if (kind === 'spark') {
        const c = col(opts.color || '#ffe27a');
        for (let i = 0; i < (opts.n || 16); i++) { const a = rnd() * 6.28, s = 1 + rnd() * 2; D.spawn({ x, y: h + 0.1, z: -y, vx: Math.cos(a) * s, vy: 1 + rnd() * 2, vz: Math.sin(a) * s, g: -6, life: 0.4 + rnd() * 0.3, size: 0.06 + rnd() * 0.05, color: c }); }
      }
    }

    // Per-frame: ball, flag, effects, feature animations.
    update(t, dt, sim) {
      const b = sim.ball;
      const ball = this.ball;
      const cp = sim.cupPos();
      const ch = sim.floorHeight(cp[0], cp[1]);
      this.cup.group.position.copy(V(cp[0], cp[1], ch));
      // lift the flag out as the ball gets close
      const dCup = Math.hypot(b.x - cp[0], b.y - cp[1]);
      const want = dCup < 1.6 || b.mode === 'sunk' ? 1 : 0;
      this.cup.lift += (want - this.cup.lift) * Math.min(1, dt * 5);
      this.cup.flagG.position.y = this.cup.lift * 1.1;
      this.cup.flagG.visible = this.cup.lift < 0.98;
      this.cup.flagG.children.forEach(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 1 - this.cup.lift; } });
      // flutter
      const arr = this.cup.flag.geometry.attributes.position.array, base = this.cup.base;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i];
        arr[i + 2] = Math.sin(x * 7 - t * 6) * 0.045 * (x / 0.66) + Math.sin(t * 2.3) * 0.02 * x;
        arr[i + 1] = base[i + 1] - x * 0.04 * (1 + Math.sin(t * 1.7) * 0.3);
      }
      this.cup.flag.geometry.attributes.position.needsUpdate = true;
      this.cup.flag.geometry.computeVertexNormals();

      // Ball
      if (b.mode === 'sunk') {
        const k = Math.min(1, b.timer / 0.3);
        const tx = U.lerp(b.x, b.cupX, k), ty = U.lerp(b.y, b.cupY, k);
        ball.position.copy(V(tx, ty, ch + C.R - k * 0.3));
        ball.visible = b.timer < 0.5;
      } else if (b.mode === 'lost') {
        ball.position.copy(V(b.x, b.y, b.z - Math.min(0.5, b.timer * 0.6)));
        ball.visible = b.timer < 0.5;
      } else {
        ball.visible = !b.hidden;
        ball.position.copy(V(b.x, b.y, b.z));
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0.01 && b.mode === 'roll') {
          const axis = new THREE.Vector3(-b.vy, 0, -b.vx).normalize();
          const q = new THREE.Quaternion().setFromAxisAngle(axis, (sp * dt) / C.R);
          this.ballQ.premultiply(q);
        }
        ball.quaternion.copy(this.ballQ);
        // trail
        if (sp > 3 && !b.hidden) {
          this.glow.spawn({ x: ball.position.x, y: ball.position.y, z: ball.position.z, vx: 0, vy: 0, vz: 0, g: 0, life: 0.35, size: 0.09 * Math.min(1, sp / 8), color: col('#ffffff'), a: 0.35 });
        }
      }
      if (this.hell && this.lavaSeaTex) { this.lavaSeaTex[0].offset.set(t * 0.0025, t * 0.0015); this.lavaSeaTex[1].offset.set(-t * 0.004, t * 0.003); }
      this.vis.forEach(v => v.update && v.update(t, dt, sim));
      this.fx.update(dt); this.glow.update(dt); this.smoke.update(dt);
    }

    render() { this.renderer.render(this.scene, this.camera); }
  }
  PC.World = World;
  PC.GROUND_Y = GROUND_Y;
})(window.PC = window.PC || {});
