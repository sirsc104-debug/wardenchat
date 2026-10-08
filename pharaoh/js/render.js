// Draws the town or the battlefield: ground, the Nile, buildings (cached
// sprites plus live moving parts), troops, projectiles and effects.
(function (G) {
  'use strict';
  const { D, U, Sprites } = G;
  const { shade, rgba } = U;
  const N = D.MAP;
  const HW = 32, HH = 16;
  const GOLD = Sprites.GOLD, GOOP = Sprites.GOOP;

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.cam = { x: 0, y: N * HH, z: 0.9 };
      this.particles = [];
      this.floaters = [];   // floating text / icons
      this.rubble = new Map();
      this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.resize();
      this.buildGround();
    }

    resize() {
      const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
      const r = this.cv.getBoundingClientRect();
      this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
      this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
      this.dpr = dpr;
      this.clampCam();
    }

    // world (tiles + height px) -> screen px
    toScreen(x, y, z = 0) {
      const c = this.cam;
      return [(U.isoX(x, y) - c.x) * c.z + this.W / 2, (U.isoY(x, y) - z - c.y) * c.z + this.H / 2];
    }
    toTile(sx, sy) {
      const c = this.cam;
      const px = (sx - this.W / 2) / c.z + c.x, py = (sy - this.H / 2) / c.z + c.y;
      return [(px / HW + py / HH) / 2, (py / HH - px / HW) / 2];
    }
    clampCam() {
      const c = this.cam;
      c.z = U.clamp(c.z, Math.max(0.3, Math.min(this.W / (N * 64 + 200), this.H / (N * 32 + 300))), 2.2);
      c.x = U.clamp(c.x, -N * HW, N * HW);
      c.y = U.clamp(c.y, -40, N * 2 * HH);
    }
    fit() {
      this.cam.z = Math.min(this.W / (N * 64 * 0.82), this.H / (N * 32 * 0.95));
      this.cam.x = 0; this.cam.y = N * HH;
      this.clampCam();
    }

    // ------------------------------------------------------------ ground
    buildGround() {
      const PAD = 10, S = 0.5;
      const w = (N + PAD * 2) * 64, h = (N + PAD * 2) * 32 + 40;
      const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w * S, h * S) : Object.assign(document.createElement('canvas'), { width: w * S, height: h * S });
      const ctx = cv.getContext('2d');
      ctx.scale(S, S);
      const ox = w / 2, oy = PAD * 32 * 0 + 20;
      // in this cache, tile (x, y) maps to ox + (x - y)*32, oy + (x + y + 2*PAD)*16
      const P = (x, y) => [ox + (x - y) * HW, oy + (x + y + 2 * PAD) * HH];
      // desert background
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#e9c98c'); g.addColorStop(1, '#d9b06a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const rng = U.makeRng(42);
      // dune ripples
      ctx.strokeStyle = 'rgba(170,120,60,0.18)'; ctx.lineWidth = 2;
      for (let i = 0; i < 160; i++) {
        const x = rng() * w, y = rng() * h, l = 30 + rng() * 60;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 6, x + l, y); ctx.stroke();
      }
      // the buildable plateau
      const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
      poly([P(0, 0), P(N, 0), P(N, N), P(0, N)], '#e3c487');
      poly([P(D.EDGE, D.EDGE), P(N - D.EDGE, D.EDGE), P(N - D.EDGE, N - D.EDGE), P(D.EDGE, N - D.EDGE)], '#ecd39c');
      // checkerboard tiles, very faint
      for (let y = D.EDGE; y < N - D.EDGE; y++) for (let x = D.EDGE; x < N - D.EDGE; x++) {
        if ((x + y) % 2) continue;
        poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], 'rgba(205,165,100,0.13)');
      }
      // pebbles and tufts
      for (let i = 0; i < 500; i++) {
        const x = rng() * (N + 2 * PAD) - PAD, y = rng() * (N + 2 * PAD) - PAD;
        if (y > N + 1.5 && y < N + 7) continue;
        const [sx, sy] = P(x, y);
        if (rng() < 0.7) { ctx.fillStyle = `rgba(150,110,70,${0.2 + rng() * 0.3})`; ctx.beginPath(); ctx.ellipse(sx, sy, 2 + rng() * 2, 1 + rng(), 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.strokeStyle = 'rgba(120,140,60,0.5)'; ctx.lineWidth = 1.4; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + k * 3, sy - 6); ctx.stroke(); } }
      }
      // the Nile along the bottom-left edge, with green banks
      const riverA = N + 2.5, riverB = N + 6;
      poly([P(-PAD, N + 1), P(N + PAD, N + 1), P(N + PAD, riverA), P(-PAD, riverA)], '#7fa84a');
      poly([P(-PAD, riverA), P(N + PAD, riverA), P(N + PAD, riverB), P(-PAD, riverB)], '#2f7fb0');
      poly([P(-PAD, riverA + 0.5), P(N + PAD, riverA + 0.5), P(N + PAD, riverB - 0.6), P(-PAD, riverB - 0.6)], '#3a92c4');
      poly([P(-PAD, riverB), P(N + PAD, riverB), P(N + PAD, riverB + 0.8), P(-PAD, riverB + 0.8)], '#7fa84a');
      // reeds and papyrus on the banks
      for (let i = 0; i < 140; i++) {
        const x = -PAD + rng() * (N + 2 * PAD), y = rng() < 0.5 ? riverA - 0.2 - rng() * 0.8 : riverB + rng() * 0.6;
        const [sx, sy] = P(x, y);
        ctx.strokeStyle = rng() < 0.5 ? '#4f7f2a' : '#6f9a3a'; ctx.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(sx + k * 2, sy); ctx.quadraticCurveTo(sx + k * 2 + 2, sy - 8, sx + k * 3 - 2, sy - 13 - rng() * 6); ctx.stroke(); }
        if (rng() < 0.3) { ctx.fillStyle = '#9ab84a'; ctx.beginPath(); ctx.arc(sx + 2, sy - 17, 3, 0, Math.PI * 2); ctx.fill(); }
      }
      // palms around the outside of the plateau
      const palms = [];
      for (let i = 0; i < 70; i++) {
        let x, y;
        do { x = -PAD + 1 + rng() * (N + 2 * PAD - 2); y = -PAD + 1 + rng() * (N + 2 * PAD - 2); }
        while ((x > -1.5 && x < N + 1.5 && y > -1.5 && y < N + 1.5) || (y > N + 1.6 && y < N + 7));
        palms.push([x, y]);
      }
      palms.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
      for (const [x, y] of palms) {
        const [sx, sy] = P(x, y);
        ctx.fillStyle = 'rgba(90,60,20,0.18)'; ctx.beginPath(); ctx.ellipse(sx + 8, sy + 2, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(sx, sy); Sprites.kit(ctx, 0, 0).palm(0, 0, 0, 30 + rng() * 22, 1 + rng() * 0.4); ctx.restore();
      }
      this.ground = { cv, S, w, h, ox, oy, PAD };
    }

    drawGround(t) {
      const ctx = this.ctx, c = this.cam, g = this.ground;
      // cache pixel (ox + isoX, oy + (x+y+2PAD)*16) = world iso (isoX, isoY)
      const wx0 = -g.ox, wy0 = -(g.oy + g.PAD * 2 * HH);
      const sx = (wx0 - c.x) * c.z + this.W / 2, sy = (wy0 - c.y) * c.z + this.H / 2;
      ctx.drawImage(g.cv, sx, sy, g.w * c.z, g.h * c.z);
      // water shimmer
      if (!this.reduced) {
        ctx.strokeStyle = 'rgba(220,240,255,0.35)'; ctx.lineWidth = 1.2 * c.z;
        for (let i = 0; i < 26; i++) {
          const x = -8 + ((i * 7.3 + t * 0.6) % (N + 16));
          const y = N + 3 + (i % 3) * 0.9;
          const [a, b] = this.toScreen(x, y), [e, f] = this.toScreen(x + 1.2, y);
          ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + e) / 2, b - 2 * c.z + Math.sin(t * 3 + i) * 1.5 * c.z, e, f); ctx.stroke();
        }
        // a felucca sailing the Nile
        const bx = ((t * 0.5) % (N + 30)) - 12, by = N + 4.2;
        const [x, y] = this.toScreen(bx, by);
        const z = c.z;
        ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.moveTo(x - 18 * z, y - 6 * z); ctx.quadraticCurveTo(x, y + 6 * z, x + 18 * z, y - 2 * z); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f4ead2'; ctx.beginPath(); ctx.moveTo(x - 2 * z, y - 6 * z); ctx.lineTo(x + 12 * z, y - 32 * z); ctx.lineTo(x + 14 * z, y - 4 * z); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.moveTo(x, y - 4 * z); ctx.lineTo(x, y - 30 * z); ctx.stroke();
      }
    }

    // Diamond outline of a footprint.
    footprint(x, y, w, h, fill, stroke, lw = 2) {
      const ctx = this.ctx;
      const a = this.toScreen(x, y), b = this.toScreen(x + w, y), c = this.toScreen(x + w, y + h), d = this.toScreen(x, y + h);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    }
    rangeRing(cx, cy, r, color, dash) {
      const ctx = this.ctx, [x, y] = this.toScreen(cx, cy), z = this.cam.z;
      ctx.beginPath(); ctx.ellipse(x, y, r * HW * 1.414 * z, r * HH * 1.414 * z, 0, 0, Math.PI * 2);
      ctx.setLineDash(dash ? [6, 6] : []);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }

    // ---------------------------------------------------------- the scene
    // scene: { buildings:[{type,x,y,level,...}], obstacles, troops, projectiles, fx, mode, selected, ghost, t }
    draw(scene) {
      const ctx = this.ctx, t = scene.t;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = '#d9b06a'; ctx.fillRect(0, 0, this.W, this.H);
      this.drawGround(t);
      if (scene.grid) this.drawGrid(scene);
      if (scene.deployMask) this.drawDeployMask(scene);

      // rubble and ground marks first
      const items = [];
      for (const b of scene.buildings) {
        if (b.destroyed) { this.drawRubble(b); continue; }
        if (b.hidden) continue;
        const s = D.B[b.type].size;
        items.push({ k: (b.x + s / 2) + (b.y + s / 2) + (D.B[b.type].isTrap ? -50 : 0), b });
      }
      for (const o of scene.obstacles || []) items.push({ k: o.x + o.y + o.size, o });
      for (const u of scene.troops || []) if (!u.dead) items.push({ k: u.x + u.y + 0.5 + (u.air ? 3 : 0), u });
      items.sort((a, b) => a.k - b.k);

      for (const it of items) {
        if (it.b) this.drawBuilding(it.b, scene);
        else if (it.o) this.drawObstacle(it.o, scene);
        else this.drawTroop(it.u, scene, t);
      }
      if (scene.selected) this.drawSelection(scene.selected, scene);
      if (scene.ghost) this.drawGhost(scene.ghost, scene);
      for (const p of scene.projectiles || []) this.drawProjectile(p, scene);
      this.drawParticles(scene.dt || 0.016);
      this.drawOverlays(scene);
      this.drawFloaters(scene.dt || 0.016);
    }

    drawGrid(scene) {
      const ctx = this.ctx;
      ctx.strokeStyle = 'rgba(120,80,30,0.18)'; ctx.lineWidth = 1;
      for (let i = D.EDGE; i <= N - D.EDGE; i++) {
        const a = this.toScreen(i, D.EDGE), b = this.toScreen(i, N - D.EDGE);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
        const c = this.toScreen(D.EDGE, i), d = this.toScreen(N - D.EDGE, i);
        ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(...d); ctx.stroke();
      }
    }
    drawDeployMask(scene) {
      if (!scene.showMask) return;
      const m = scene.deployMask;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y * N + x]) this.footprint(x, y, 1, 1, 'rgba(220,60,40,0.16)');
    }

    drawRubble(b) {
      const s = D.B[b.type].size;
      if (D.B[b.type].isTrap) return;
      const ctx = this.ctx, z = this.cam.z;
      this.footprint(b.x + 0.1, b.y + 0.1, s - 0.2, s - 0.2, 'rgba(60,40,25,0.45)');
      const rng = U.makeRng(b.x * 97 + b.y * 13 + 1);
      const n = s * s + 2;
      const m = Sprites.M(b.level || 1);
      for (let i = 0; i < n; i++) {
        const [x, y] = this.toScreen(b.x + 0.2 + rng() * (s - 0.4), b.y + 0.2 + rng() * (s - 0.4));
        ctx.fillStyle = i % 3 ? shade(m.base, -0.25) : shade(m.base, -0.05);
        ctx.beginPath(); ctx.moveTo(x - 4 * z, y); ctx.lineTo(x, y - 5 * z); ctx.lineTo(x + 5 * z, y - 1 * z); ctx.lineTo(x + 1 * z, y + 2 * z); ctx.closePath(); ctx.fill();
      }
    }

    drawObstacle(o, scene) {
      const sp = Sprites.sprite(o.type, 1, 'o' + o.size + (o.v || 0), o.size);
      this.blit(sp, o.x, o.y);
      if (o.clearing) this.drawProgress(o.x + o.size / 2, o.y + o.size / 2, 40, o.progress, scene.t);
    }

    blit(sp, x, y, alpha) {
      const ctx = this.ctx, z = this.cam.z;
      const [sx, sy] = this.toScreen(x, y);
      if (alpha != null) ctx.globalAlpha = alpha;
      ctx.drawImage(sp.img, sx - sp.ax * z, sy - sp.ay * z, sp.w * z, sp.h * z);
      if (alpha != null) ctx.globalAlpha = 1;
    }

    drawBuilding(b, scene) {
      const def = D.B[b.type];
      const lv = Math.max(1, b.level || 1);
      let extra = 0;
      if (def.isWall) extra = scene.wallConn ? scene.wallConn(b) : 0;
      else if (def.stores || def.produces) extra = Math.round((b.fill || 0) * 4) / 4;
      const sp = Sprites.sprite(b.type, lv, extra);
      if (b.level === 0 || b.building) {
        // new construction: foundation and scaffolding only
        this.drawFoundation(b, scene);
      } else {
        const flash = b.flash > 0;
        this.blit(sp, b.x, b.y, scene.moving === b ? 0.5 : undefined);
        if (flash) { this.ctx.globalCompositeOperation = 'lighter'; this.blit(sp, b.x, b.y, 0.25); this.ctx.globalCompositeOperation = 'source-over'; }
        this.drawLive(b, scene);
      }
      if (b.upgrading && b.level > 0) this.drawScaffold(b, scene);
    }

    drawFoundation(b, scene) {
      const s = D.B[b.type].size;
      this.footprint(b.x + 0.1, b.y + 0.1, s - 0.2, s - 0.2, 'rgba(150,110,60,0.5)', 'rgba(110,80,40,0.8)', 1);
      this.drawScaffold(b, scene);
    }

    drawScaffold(b, scene) {
      const ctx = this.ctx, z = this.cam.z, s = D.B[b.type].size, t = scene.t;
      if (s > 1) {
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2 * z;
        const H = 22 + s * 8;
        for (const [u, v] of [[0.15, 0.15], [s - 0.15, 0.15], [s - 0.15, s - 0.15], [0.15, s - 0.15]]) {
          const [x, y] = this.toScreen(b.x + u, b.y + v);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - H * z); ctx.stroke();
        }
        for (const h of [H * 0.5, H]) {
          const a = this.toScreen(b.x + 0.15, b.y + s - 0.15, h), c = this.toScreen(b.x + s - 0.15, b.y + s - 0.15, h), d = this.toScreen(b.x + s - 0.15, b.y + 0.15, h);
          ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...c); ctx.lineTo(...d); ctx.stroke();
        }
      }
      // a builder hammering
      const [x, y] = this.toScreen(b.x + s - 0.1, b.y + s * 0.5 + 0.3);
      this.drawBuilder(x, y, z, t);
      if (b.upgradeLeft != null) this.drawProgress(b.x + s / 2, b.y + s / 2, 30 + s * 14, b.upgradeProgress, t, U.fmtTime(b.upgradeLeft));
    }

    drawBuilder(x, y, z, t) {
      const ctx = this.ctx, swing = Math.sin(t * 10) * 0.8;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y, 6 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2ead6'; ctx.fillRect(x - 3 * z, y - 12 * z, 6 * z, 9 * z);
      ctx.fillStyle = '#c98a58'; ctx.fillRect(x - 2 * z, y - 4 * z, 1.6 * z, 4 * z); ctx.fillRect(x + 0.6 * z, y - 4 * z, 1.6 * z, 4 * z);
      ctx.beginPath(); ctx.arc(x, y - 15 * z, 3.2 * z, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f6fb3'; ctx.fillRect(x - 3.4 * z, y - 18.5 * z, 6.8 * z, 2.2 * z);
      ctx.save(); ctx.translate(x + 3 * z, y - 10 * z); ctx.rotate(-0.6 + swing);
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.4 * z; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8 * z, 0); ctx.stroke();
      ctx.fillStyle = '#888'; ctx.fillRect(7 * z, -2.5 * z, 3 * z, 5 * z);
      ctx.restore();
    }

    drawProgress(cx, cy, h, p, t, label) {
      const ctx = this.ctx, z = this.cam.z;
      const [x, y] = this.toScreen(cx, cy, h);
      const w = 54 * Math.max(0.7, z);
      ctx.fillStyle = 'rgba(30,20,10,0.75)'; roundRect(ctx, x - w / 2 - 2, y - 7, w + 4, 10, 4); ctx.fill();
      ctx.fillStyle = '#7ed957'; roundRect(ctx, x - w / 2, y - 5, w * U.clamp(p || 0, 0, 1), 6, 3); ctx.fill();
      if (label) {
        ctx.font = '700 11px Rubik, system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,25,10,0.85)'; ctx.strokeText(label, x, y - 10);
        ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - 10);
      }
    }

    // --------------------------------------------------- live moving parts
    drawLive(b, scene) {
      const ctx = this.ctx, z = this.cam.z, t = scene.t + (b.x * 0.37 + b.y * 0.61);
      const lv = b.level, def = D.B[b.type], s = def.size, m = Sprites.M(lv);
      const P = (u, v, h = 0) => this.toScreen(b.x + u, b.y + v, h);
      const battle = scene.mode === 'battle';
      const aim = b.aim != null ? b.aim : Math.sin(t * 0.4) * 1.2 + 0.8;
      switch (b.type) {
        case 'pyramid': {
          const H = lv >= 6 ? 101 + (lv - 6) * 8 : 0;
          if (lv >= 4) for (const [u, v] of [[-0.05, 4.05], [4.05, 4.05]]) this.flame(...P(u, v, 8), 0.8, t);
          if (lv >= 7 && !this.reduced) { // glint sweeping over the capstone
            const [x, y] = P(2, 2, H - 6);
            const a = (t % 4) / 4;
            if (a < 0.3) { ctx.fillStyle = `rgba(255,255,240,${0.9 * Math.sin(a / 0.3 * Math.PI)})`; star(ctx, x - 4 * z, y + 4 * z, 7 * z); }
          }
          if (lv >= 10) { // floating sun disk with turning rays
            const [x, y] = P(2, 2, H + 30 + Math.sin(t * 1.5) * 4);
            sunDisk(ctx, x, y, (lv >= 11 ? 12 : 10) * z, t, lv >= 11 ? '#3fe0d0' : '#ffb02a');
          }
          if (lv >= 11 && !this.reduced && Math.random() < 0.15) this.spark(b.x + Math.random() * 4, b.y + Math.random() * 4, 20 + Math.random() * 60, '#3fe0d0');
          break;
        }
        case 'goldMine': {
          if (b.level && !b.upgrading) {
            const k = (Math.sin(t * 0.8) + 1) / 2; // cart rolling in and out
            const [x, y] = P(1.4, 1.75 + k * 1.1, 0);
            ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 7 * z, y - 9 * z, 14 * z, 7 * z);
            ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(x, y - 9 * z, 6 * z, 3 * z, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 4 * z, y - 2 * z, 2 * z, 0, 7); ctx.arc(x + 4 * z, y - 2 * z, 2 * z, 0, 7); ctx.fill();
            if (!this.reduced && Math.random() < 0.04) this.spark(b.x + 2.2 + Math.random() * 0.6, b.y + 2, 6, '#fff4b0');
          }
          if (!battle && b.fill > 0.05) this.collectBubble(b, 'gold', t);
          break;
        }
        case 'goopWell': {
          // shaduf arm bobbing
          const ang = Math.sin(t * 1.4) * 0.35;
          const [px, py] = P(2.56, 0.46, 40);
          ctx.save(); ctx.translate(px, py); ctx.rotate(-0.3 + ang);
          ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2.4 * z;
          ctx.beginPath(); ctx.moveTo(-34 * z, 0); ctx.lineTo(16 * z, 0); ctx.stroke();
          ctx.fillStyle = '#8a7a6a'; ctx.beginPath(); ctx.arc(16 * z, 0, 4 * z, 0, 7); ctx.fill();
          ctx.strokeStyle = '#5a4026'; ctx.lineWidth = 1 * z; ctx.beginPath(); ctx.moveTo(-34 * z, 0); ctx.lineTo(-34 * z, 14 * z); ctx.stroke();
          ctx.fillStyle = '#b87a46'; ctx.fillRect(-38 * z, 14 * z, 8 * z, 7 * z);
          ctx.restore();
          if (!this.reduced && Math.random() < 0.12) this.bubble(b.x + 1.1 + Math.random() * 0.8, b.y + 1.1 + Math.random() * 0.8, 17);
          if (!battle && b.fill > 0.05) this.collectBubble(b, 'goop', t);
          break;
        }
        case 'goopJar':
          if (!this.reduced && Math.random() < 0.05) this.bubble(b.x + 1.5, b.y + 1.5, 66);
          break;
        case 'treasury':
          if (!this.reduced && Math.random() < 0.03 && b.fill > 0.1) this.spark(b.x + 1.2 + Math.random() * 0.6, b.y + 1.2 + Math.random() * 0.6, 20, '#fff4b0');
          break;
        case 'armyCamp': {
          this.flame(...P(2, 2, 2), 1.1, t);
          if (scene.campTroops && scene.campTroops.get(b)) {
            for (const tr of scene.campTroops.get(b)) this.drawTroop(tr, scene, scene.t, true);
          }
          break;
        }
        case 'barracks':
          if (scene.training && !this.reduced && Math.random() < 0.08) this.dust(b.x + 1 + Math.random(), b.y + 2.6, '#c8a878');
          break;
        case 'temple':
          if (scene.researching) { const [x, y] = P(1.5, 1.5, 58); ctx.fillStyle = `rgba(255,200,80,${0.25 + 0.2 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.arc(x, y, 20 * z, 0, 7); ctx.fill(); }
          break;
        case 'ballista': {
          const [x, y] = P(1.5, 1.5, 14);
          const recoil = b.fired > 0 ? -3 : 0;
          drawTurret(ctx, x, y, z, aim, (c, zz) => {
            c.fillStyle = '#6b4a2a'; c.fillRect(-4 * zz + recoil * zz, -3 * zz, 26 * zz, 6 * zz);           // stock
            c.strokeStyle = lv >= 7 ? GOLD : '#4a3018'; c.lineWidth = 3 * zz;
            c.beginPath(); c.moveTo(14 * zz, -16 * zz); c.quadraticCurveTo(20 * zz, 0, 14 * zz, 16 * zz); c.stroke(); // bow
            c.strokeStyle = '#eee'; c.lineWidth = 0.8 * zz; c.beginPath(); c.moveTo(14 * zz, -16 * zz); c.lineTo((b.fired > 0 ? 12 : 2) * zz, 0); c.lineTo(14 * zz, 16 * zz); c.stroke();
            c.fillStyle = '#ccc'; c.fillRect(18 * zz, -1 * zz, 8 * zz, 2 * zz);
          }, m.base);
          break;
        }
        case 'catapult': {
          const [x, y] = P(1.5, 1.5, 10);
          const throwA = b.fired > 0 ? -1.6 * (b.fired / 0.25) : 0.9;
          drawTurret(ctx, x, y, z, aim, (c, zz) => {
            c.fillStyle = '#6b4a2a'; c.fillRect(-12 * zz, -9 * zz, 24 * zz, 18 * zz);
            c.save(); c.rotate(throwA); c.fillStyle = '#5a3a1a'; c.fillRect(-2 * zz, -26 * zz, 4 * zz, 26 * zz);
            c.fillStyle = '#8a7a6a'; c.beginPath(); c.arc(0, -26 * zz, 4.5 * zz, 0, 7); c.fill(); c.restore();
          }, m.base, true);
          break;
        }
        case 'archerTower': {
          const top = 58 + lv * 2 + 6;
          const [x, y] = P(1.5, 1.5, top);
          drawArcher(ctx, x, y, z, Math.cos(aim) - Math.sin(aim) >= 0 ? 1 : -1, b.fired > 0, lv);
          break;
        }
        case 'falconPerch': {
          if (b.fired > 0 && battle) break; // the falcon is out hunting
          const [x, y] = P(1.5, 1.5, 57);
          drawBird(ctx, x, y - 2 * z, 7 * z, Math.sin(t * 2) > 0.95 ? Math.sin(t * 30) : 0.2, lv >= 7 ? '#c89a40' : '#7a5530', 1);
          break;
        }
        case 'brazier': {
          const [x, y] = P(1, 1, 36);
          this.flame(x, y, 1.6 + (b.fired > 0 ? 1.4 : 0), t, true);
          break;
        }
        case 'eyeHorus': {
          const [x, y] = this.toScreen(b.x + 1.5, b.y + 2.05, 40);
          const pulse = 0.5 + 0.5 * Math.sin(t * 3) + (b.fired > 0 ? 1 : 0);
          ctx.fillStyle = `rgba(80,160,255,${0.35 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(x - 4 * z, y - 2 * z, (4 + pulse * 3) * z, 0, 7); ctx.fill();
          ctx.fillStyle = '#1a1a3a'; ctx.beginPath(); ctx.arc(x - 4 * z, y - 2 * z, 2.4 * z, 0, 7); ctx.fill();
          break;
        }
        case 'obelisk': {
          const [x, y] = P(1, 1, 8 + 92 + lv * 4 + 8);
          const charge = b.cd != null && battle ? 1 - U.clamp(b.cd / def.rate, 0, 1) : 0.5 + 0.5 * Math.sin(t * 2);
          const gr = ctx.createRadialGradient(x, y, 0, x, y, 14 * z);
          gr.addColorStop(0, `rgba(255,240,180,${0.5 + 0.5 * charge})`); gr.addColorStop(1, 'rgba(255,180,60,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 14 * z, 0, 7); ctx.fill();
          break;
        }
        case 'anubis':
        case 'sphinx': {
          const [x, y] = b.type === 'anubis' ? P(1.3, 0.85, 38) : P(2.15, 1.4, 44);
          const on = battle && b.target ? 1 : 0.35 + 0.25 * Math.sin(t * 2);
          ctx.fillStyle = `rgba(255,${b.type === 'sphinx' ? 120 : 60},40,${on})`;
          ctx.beginPath(); ctx.arc(x - 2 * z, y, 1.6 * z, 0, 7); ctx.arc(x + 2 * z, y + 1 * z, 1.6 * z, 0, 7); ctx.fill();
          break;
        }
        case 'sunDisk': {
          const [x, y] = P(1.5, 1.5, 110 + Math.sin(t * 1.2) * 3);
          sunDisk(ctx, x, y, 16 * z, t * (b.fired > 0 ? 4 : 1), lv >= 11 ? '#3fe0d0' : '#ff9a2a');
          break;
        }
        case 'royalHall':
        case 'builderHut':
          break;
      }
      // the finest buildings shimmer
      if (lv >= 11 && !def.isWall && !def.isTrap && !this.reduced && Math.random() < 0.05) this.spark(b.x + Math.random() * s, b.y + Math.random() * s, 10 + Math.random() * 30, '#3fe0d0');
    }

    collectBubble(b, res, t) {
      const ctx = this.ctx, z = Math.max(0.7, this.cam.z);
      const s = D.B[b.type].size;
      const [x, y0] = this.toScreen(b.x + s / 2, b.y + s / 2, 60);
      const y = y0 + Math.sin(t * 3) * 3;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(80,50,20,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 12 * z, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4 * z, y + 10 * z); ctx.lineTo(x, y + 17 * z); ctx.lineTo(x + 4 * z, y + 10 * z); ctx.fill();
      resIcon(ctx, res, x, y, 7 * z);
    }

    // ------------------------------------------------------------- troops
    drawTroop(u, scene, t, idle) {
      const ctx = this.ctx, z = this.cam.z;
      const a = scene.alpha == null ? 1 : scene.alpha;
      const x = u.px != null && !idle ? U.lerp(u.px, u.x, a) : u.x, y = u.px != null && !idle ? U.lerp(u.py, u.y, a) : u.y;
      const air = u.air;
      const [sx, sy] = this.toScreen(x, y, 0);
      // shadow
      ctx.fillStyle = 'rgba(40,25,10,0.25)'; ctx.beginPath(); ctx.ellipse(sx, sy, (air ? 7 : 5) * z * (u.t.housing >= 20 ? 2.2 : u.t.housing >= 5 ? 1.4 : 1), 2.5 * z, 0, 0, 7); ctx.fill();
      const hover = air ? 46 + Math.sin(t * 3 + u.uid) * 3 : 0;
      const moving = !idle && !u.attacking && (Math.abs(u.x - (u.px ?? u.x)) + Math.abs(u.y - (u.py ?? u.y)) > 0.001);
      const bob = moving ? Math.abs(Math.sin((u.walk || 0) * 2)) * 2 : 0;
      const by = sy - (hover + bob) * z;
      drawTroopFigure(ctx, u.type, sx, by, z * 1.3, u.face || 1, t + (u.uid || 0), !!u.attacking, u.level || 1, u.side === 'def');
      if (u.hit > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,80,60,0.4)'; ctx.beginPath(); ctx.arc(sx, by - 8 * z, 8 * z, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      if (!idle && u.hp < u.maxHp) {
        const w = 16 * Math.max(0.8, z), hh = (u.t.housing >= 20 ? 40 : u.t.housing >= 5 ? 30 : 24) * z;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - w / 2 - 1, by - hh - 1, w + 2, 4);
        ctx.fillStyle = u.side === 'def' ? '#e05a4a' : '#7ed957'; ctx.fillRect(sx - w / 2, by - hh, w * U.clamp(u.hp / u.maxHp, 0, 1), 2);
      }
      if (u.slowUntil && !idle) { ctx.strokeStyle = 'rgba(140,100,50,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 8 * z, 3 * z, 0, 0, 7); ctx.stroke(); }
    }

    // --------------------------------------------------------- projectiles
    drawProjectile(p, scene) {
      const ctx = this.ctx, z = this.cam.z;
      const k = U.clamp(p.t / p.dur, 0, 1);
      if (p.t < 0) return;
      const x = U.lerp(p.x0, p.tx, k), y = U.lerp(p.y0, p.ty, k);
      const arc = p.kind === 'stone' ? Math.sin(k * Math.PI) * 120 : p.kind === 'sandball' || p.kind === 'orb' ? Math.sin(k * Math.PI) * 20 : 0;
      const tz = p.unit && p.unit.air ? 46 : 8;
      const hz = U.lerp(p.z0, p.kind === 'sun' || p.kind === 'bomb' ? 0 : tz, k) + arc;
      const [sx, sy] = this.toScreen(x, y, hz);
      const [px, py] = this.toScreen(U.lerp(p.x0, p.tx, Math.max(0, k - 0.08)), U.lerp(p.y0, p.ty, Math.max(0, k - 0.08)), U.lerp(p.z0, tz, Math.max(0, k - 0.08)) + (p.kind === 'stone' ? Math.sin(Math.max(0, k - 0.08) * Math.PI) * 120 : 0));
      switch (p.kind) {
        case 'arrow': case 'bolt': case 'feather': {
          const ang = Math.atan2(sy - py, sx - px);
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
          ctx.strokeStyle = p.kind === 'feather' ? '#c8a060' : '#5a3a1a'; ctx.lineWidth = (p.kind === 'bolt' ? 2.5 : 1.4) * z;
          ctx.beginPath(); ctx.moveTo(-(p.kind === 'bolt' ? 14 : 9) * z, 0); ctx.lineTo(0, 0); ctx.stroke();
          ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(0, -2 * z); ctx.lineTo(4 * z, 0); ctx.lineTo(0, 2 * z); ctx.fill();
          ctx.restore(); break;
        }
        case 'stone':
          ctx.fillStyle = '#7a6a5a'; ctx.beginPath(); ctx.arc(sx, sy, 5 * z, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.2)'; { const [gx, gy] = this.toScreen(x, y); ctx.beginPath(); ctx.ellipse(gx, gy, 5 * z, 2 * z, 0, 0, 7); ctx.fill(); }
          break;
        case 'falcon':
          drawBird(ctx, sx, sy, 7 * z, Math.sin(scene.t * 25), '#7a5530', sx > px ? 1 : -1);
          break;
        case 'orb': case 'sandball': case 'fire': {
          const col = p.kind === 'orb' ? '120,180,255' : p.kind === 'fire' ? '255,140,40' : '230,190,110';
          const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9 * z);
          gr.addColorStop(0, `rgba(255,255,240,0.95)`); gr.addColorStop(0.4, `rgba(${col},0.9)`); gr.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, 9 * z, 0, 7); ctx.fill();
          if (!this.reduced && Math.random() < 0.5) this.particles.push({ x, y, z: hz, vx: 0, vy: 0, vz: 10, life: 0.3, max: 0.3, color: `rgba(${col},0.7)`, size: 3 });
          break;
        }
        case 'bomb':
          ctx.fillStyle = '#b8642a'; ctx.beginPath(); ctx.arc(sx, sy, 4.5 * z, 0, 7); ctx.fill();
          this.flame(sx, sy - 4 * z, 0.4, scene.t);
          break;
        case 'sun': {
          // a pillar of sunlight that narrows onto the target
          const [gx, gy] = this.toScreen(p.tx, p.ty);
          const w = (1 - k) * 26 * z + 6 * z;
          const gr = ctx.createLinearGradient(gx, gy - 400 * z, gx, gy);
          gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(1, `rgba(255,200,80,${0.35 + 0.5 * k})`);
          ctx.fillStyle = gr; ctx.fillRect(gx - w / 2, gy - 400 * z, w, 400 * z);
          ctx.strokeStyle = `rgba(255,120,40,${0.4 + 0.5 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(gx, gy, 2 * HW * 1.414 * z * (1.2 - k * 0.2), 2 * HH * 1.414 * z * (1.2 - k * 0.2), 0, 0, 7); ctx.stroke();
          break;
        }
      }
    }

    // --------------------------------------------------------------- effects
    // Turn battle events into particles and flashes.
    handleFx(fx, battle) {
      for (const e of fx) {
        switch (e.k) {
          case 'hit': this.burst(e.x, e.y, e.air ? 46 : 10, 4, e.kind === 'feather' ? '#c8a060' : '#ffe0a0', 30, 0.25); break;
          case 'boom': this.burst(e.x, e.y, 6, 14, '#ffb050', 70, 0.5); this.burst(e.x, e.y, 6, 6, '#6a5a4a', 40, 0.8); this.ring(e.x, e.y, e.r || 1, '#ffb050'); break;
          case 'cleave': this.ring(e.x, e.y, e.r, '#e8e0c0'); break;
          case 'destroy':
            this.burst(e.x, e.y, 10, e.wall ? 8 : 26, '#b89a70', 90, 0.9);
            if (!e.wall) { this.burst(e.x, e.y, 20, 18, 'rgba(90,80,70,0.7)', 30, 2.2, true); this.ring(e.x, e.y, e.size * 0.9, '#ffcc66'); }
            if (this.onShake && !e.wall) this.onShake(e.size * 2);
            break;
          case 'death':
            this.burst(e.x, e.y, e.air ? 46 : 8, 6, e.side === 'def' ? '#e05a4a' : '#f2ead6', 30, 0.6);
            this.floaters.push({ x: e.x, y: e.y, z: e.air ? 46 : 14, vz: 26, life: 1.1, max: 1.1, ankh: true });
            break;
          case 'heal': this.burst(e.x, e.y, 10, 8, '#ffe680', 20, 0.8, true); this.ring(e.x, e.y, e.r, '#ffe680'); break;
          case 'deploy': this.burst(e.x, e.y, 2, 6, '#d8c090', 25, 0.5); break;
          case 'loot':
            if (e.gold) this.floaters.push({ x: e.x, y: e.y, z: 40, vz: 34, life: 1, max: 1, res: 'gold', text: '+' + U.fmt(e.gold) });
            if (e.goop) this.floaters.push({ x: e.x + 0.4, y: e.y, z: 40, vz: 34, life: 1, max: 1, res: 'goop', text: '+' + U.fmt(e.goop) });
            break;
          case 'trap':
            if (e.type === 'scarabTrap') { this.burst(e.x, e.y, 2, 22, '#1f4a3a', 60, 0.9); this.ring(e.x, e.y, e.r, '#2a8a7a'); }
            else if (e.type === 'quicksand') { this.ring(e.x, e.y, e.r, '#8a6a3a'); this.burst(e.x, e.y, 2, 16, '#c8a070', 30, 1); }
            else if (e.type === 'falconNet') { this.burst(e.x, e.y, 46, 12, '#7a5530', 40, 0.7); }
            else { this.burst(e.x, e.y, 6, 12, '#c9a020', 50, 0.6); this.ring(e.x, e.y, 1, '#c9a020'); }
            break;
          case 'beam': case 'ray': case 'flame': case 'slam':
            this.beams.push({ ...e, life: e.k === 'ray' ? 0.12 : 0.3, max: e.k === 'ray' ? 0.12 : 0.3, battle });
            if (e.k === 'slam') this.ring(e.x, e.y, e.r, '#c9a020');
            if (e.k === 'flame') this.burst(e.x, e.y, e.air ? 46 : 8, 6, '#ff8a2a', 30, 0.5);
            break;
          case 'guards': this.ring(e.x, e.y, 3, '#e05a4a'); break;
        }
      }
    }
    get beams() { return this._beams || (this._beams = []); }

    burst(x, y, z0, n, color, speed, life, rise) {
      if (this.reduced) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = Math.random() * speed;
        this.particles.push({ x, y, z: z0, vx: Math.cos(a) * s / 40, vy: Math.sin(a) * s / 40, vz: rise ? 15 + Math.random() * 20 : 20 + Math.random() * speed, g: rise ? 0 : 160,
          life: life * (0.6 + Math.random() * 0.6), max: life, color, size: rise ? 4 + Math.random() * 5 : 1.5 + Math.random() * 2.5 });
      }
    }
    ring(x, y, r, color) { this.particles.push({ ring: true, x, y, r, life: 0.45, max: 0.45, color }); }
    spark(x, y, z, color) { this.particles.push({ x, y, z, vx: 0, vy: 0, vz: 8, life: 0.7, max: 0.7, color, size: 2, star: true }); }
    bubble(x, y, z) { this.particles.push({ x, y, z, vx: 0, vy: 0, vz: 14, life: 0.8, max: 0.8, color: 'rgba(160,255,120,0.9)', size: 2.4, bubble: true }); }
    dust(x, y, color) { this.particles.push({ x, y, z: 4, vx: (Math.random() - 0.5) * 0.4, vy: 0, vz: 12, life: 1, max: 1, color, size: 5, rise: true }); }
    floatText(x, y, text, res, color) { this.floaters.push({ x, y, z: 50, vz: 30, life: 1.4, max: 1.4, text, res, color }); }

    drawParticles(dt) {
      const ctx = this.ctx, z = this.cam.z;
      // defense beams
      for (const bm of this.beams) {
        bm.life -= dt;
        const b = bm.battle && bm.battle.buildings[bm.b];
        if (!b) continue;
        const k = bm.life / bm.max;
        const top = { obelisk: 104 + b.level * 4, sphinx: 44, brazier: 36, anubis: 30 }[b.type] || 20;
        const src = b.type === 'sphinx' ? this.toScreen(b.x + 2.15, b.y + 1.4, top) : this.toScreen(b.cx, b.cy, top);
        const dst = this.toScreen(bm.x, bm.y, bm.air ? 46 : 10);
        if (bm.k === 'beam' || bm.k === 'ray') {
          const heat = bm.k === 'ray' ? bm.heat : 1;
          ctx.strokeStyle = bm.k === 'ray' ? `rgba(255,${Math.round(200 - heat * 140)},60,${0.8 * k + 0.2})` : `rgba(255,240,170,${k})`;
          ctx.lineWidth = (bm.k === 'ray' ? 2 + heat * 4 : 6 * k + 1) * z;
          ctx.beginPath(); ctx.moveTo(...src); ctx.lineTo(...dst); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 1.5 * z; ctx.stroke();
        } else if (bm.k === 'flame') {
          for (let i = 0; i < 6; i++) {
            const f = Math.random();
            ctx.fillStyle = `rgba(255,${120 + Math.random() * 100},40,${0.6 * k})`;
            ctx.beginPath(); ctx.arc(U.lerp(src[0], dst[0], f), U.lerp(src[1], dst[1], f) - Math.sin(f * Math.PI) * 10 * z, (3 + f * 7) * z, 0, 7); ctx.fill();
          }
        }
      }
      this._beams = this.beams.filter((b) => b.life > 0);

      const keep = [];
      for (const p of this.particles) {
        p.life -= dt;
        if (p.life <= 0) continue;
        keep.push(p);
        const k = p.life / p.max;
        if (p.ring) {
          const [x, y] = this.toScreen(p.x, p.y, 2);
          const rr = p.r * (1.3 - k * 0.6);
          ctx.strokeStyle = p.color; ctx.globalAlpha = k; ctx.lineWidth = 3 * k + 1;
          ctx.beginPath(); ctx.ellipse(x, y, rr * HW * 1.414 * z, rr * HH * 1.414 * z, 0, 0, 7); ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        p.x += p.vx * dt * 6; p.y += p.vy * dt * 6;
        p.z += p.vz * dt; p.vz -= (p.g || 0) * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; }
        const [x, y] = this.toScreen(p.x, p.y, p.z);
        ctx.globalAlpha = Math.min(1, k * 1.5);
        if (p.star) { ctx.fillStyle = p.color; star(ctx, x, y, 4 * z * k + 1); }
        else if (p.bubble) { ctx.strokeStyle = p.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, p.size * z, 0, 7); ctx.stroke(); }
        else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, p.size * z * (p.rise ? 1.5 - k * 0.5 : 1), 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      this.particles = keep.length > 1500 ? keep.slice(-1500) : keep;
    }

    drawFloaters(dt) {
      const ctx = this.ctx, z = Math.max(0.75, this.cam.z);
      const keep = [];
      for (const f of this.floaters) {
        f.life -= dt; if (f.life <= 0) continue; keep.push(f);
        f.z += f.vz * dt;
        const k = f.life / f.max;
        const [x, y] = this.toScreen(f.x, f.y, f.z);
        ctx.globalAlpha = Math.min(1, k * 2);
        if (f.ankh) {
          ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(x, y - 5, 2.5, 3.2, 0, 0, 7); ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 6); ctx.moveTo(x - 3.5, y); ctx.lineTo(x + 3.5, y); ctx.stroke();
        } else {
          if (f.res) resIcon(ctx, f.res, x - 14 * z, y - 4 * z, 6 * z);
          ctx.font = `800 ${Math.round(13 * z)}px Rubik, system-ui, sans-serif`; ctx.textAlign = 'left';
          ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(50,30,10,0.85)'; ctx.strokeText(f.text, x - 6 * z, y);
          ctx.fillStyle = f.color || (f.res === 'goop' ? '#a6f58a' : f.res === 'gems' ? '#7fe8ff' : '#ffe27a'); ctx.fillText(f.text, x - 6 * z, y);
        }
        ctx.globalAlpha = 1;
      }
      this.floaters = keep;
    }

    flame(x, y, size, t, big) {
      const ctx = this.ctx, z = this.cam.z * size;
      if (this.reduced) { ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.arc(x, y - 4 * z, 3 * z, 0, 7); ctx.fill(); return; }
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(t * 12 + i * 2) * 1.5 * z;
        ctx.fillStyle = ['rgba(255,90,20,0.85)', 'rgba(255,170,40,0.9)', 'rgba(255,240,160,0.95)'][i];
        const h = (12 - i * 3.5) * z, w = (5 - i * 1.4) * z;
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w, y - h * 0.6, x + f, y - h); ctx.quadraticCurveTo(x + w, y - h * 0.6, x + w, y); ctx.closePath(); ctx.fill();
      }
    }

    // ------------------------------------------------- selection & overlays
    drawSelection(b, scene) {
      const def = D.B[b.type], s = def.size;
      const t = scene.t;
      this.footprint(b.x, b.y, s, s, `rgba(255,255,255,${0.12 + 0.06 * Math.sin(t * 5)})`, '#fff', 2);
      if (def.range) {
        this.rangeRing(b.x + s / 2, b.y + s / 2, def.range + s / 2, 'rgba(255,255,255,0.8)');
        if (def.minRange) this.rangeRing(b.x + s / 2, b.y + s / 2, def.minRange, 'rgba(255,120,80,0.8)', true);
      }
      if (def.isTrap && def.trigger) this.rangeRing(b.x + 0.5, b.y + 0.5, def.trigger, 'rgba(255,220,120,0.8)', true);
    }
    drawGhost(g, scene) {
      const def = D.B[g.type], s = def.size;
      this.footprint(g.x, g.y, s, s, g.ok ? 'rgba(90,220,90,0.35)' : 'rgba(230,60,50,0.4)', g.ok ? '#5adc5a' : '#e63c32', 2);
      const sp = Sprites.sprite(g.type, Math.max(1, g.level || 1), def.isWall ? 0 : 0);
      this.blit(sp, g.x, g.y, 0.75);
      if (def.range) this.rangeRing(g.x + s / 2, g.y + s / 2, def.range + s / 2, 'rgba(255,255,255,0.6)', true);
    }

    drawOverlays(scene) {
      const ctx = this.ctx, z = this.cam.z;
      if (scene.mode === 'battle') {
        for (const b of scene.buildings) {
          if (b.destroyed || b.def.isWall || b.hp >= b.maxHp) continue;
          if (!(b.lastHit > scene.time - 3)) continue;
          const s = b.size, [x, y] = this.toScreen(b.x + s / 2, b.y + s / 2, 30 + s * 12);
          const w = 26 + s * 6;
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
          ctx.fillStyle = b.def.isDefense ? '#f0a030' : '#7ed957'; ctx.fillRect(x - w / 2, y, w * b.hp / b.maxHp, 4);
        }
      }
    }
  }

  // ---------------------------------------------------------------- helpers
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.3 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  function sunDisk(ctx, x, y, r, t, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6);
    ctx.strokeStyle = U.rgba(color, 0.7); ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); ctx.lineTo(Math.cos(a) * r * 1.9, Math.sin(a) * r * 1.9); ctx.stroke(); }
    ctx.restore();
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, color); g.addColorStop(1, U.shade(color, -0.35));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  function resIcon(ctx, res, x, y, r) {
    if (res === 'gold') {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, '#fff3a6'); g.addColorStop(0.6, '#f2c230'); g.addColorStop(1, '#b8860b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8a6208'; ctx.lineWidth = 1; ctx.stroke();
    } else if (res === 'goop') {
      ctx.fillStyle = '#5fdc4a';
      ctx.beginPath(); ctx.moveTo(x, y - r * 1.2); ctx.quadraticCurveTo(x + r, y, x + r * 0.8, y + r * 0.4); ctx.arc(x, y + r * 0.3, r * 0.8, 0, Math.PI); ctx.quadraticCurveTo(x - r, y, x, y - r * 1.2); ctx.fill();
      ctx.strokeStyle = '#2f9a2a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y + r * 0.1, r * 0.22, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#4fd8f0';
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y - r * 0.2); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y - r * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y - r * 0.2); ctx.lineTo(x, y - r * 0.2); ctx.fill();
    }
  }
  function drawTurret(ctx, x, y, z, aim, fn, baseColor, noPivot) {
    // aim is an angle in tile space; convert to screen direction
    const dx = Math.cos(aim), dy = Math.sin(aim);
    const sa = Math.atan2((dx + dy) * HH, (dx - dy) * HW);
    if (!noPivot) { ctx.fillStyle = U.shade(baseColor, -0.3); ctx.beginPath(); ctx.ellipse(x, y, 13 * z, 7 * z, 0, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(x, y - 6 * z); ctx.scale(1, 0.75); ctx.rotate(sa);
    fn(ctx, z);
    ctx.restore();
  }
  function drawArcher(ctx, x, y, z, face, firing, lv) {
    ctx.fillStyle = '#f2ead6'; ctx.fillRect(x - 3 * z, y - 13 * z, 6 * z, 10 * z);
    ctx.fillStyle = '#c98a58'; ctx.beginPath(); ctx.arc(x, y - 16 * z, 3.2 * z, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 3.4 * z, y - 19.5 * z, 6.8 * z, 2.5 * z);
    ctx.strokeStyle = lv >= 7 ? '#f2c230' : '#6b4a2a'; ctx.lineWidth = 1.5 * z;
    ctx.beginPath(); ctx.arc(x + face * 4 * z, y - 11 * z, 6 * z, face > 0 ? -1.2 : 1.9, face > 0 ? 1.2 : 4.3); ctx.stroke();
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.7 * z; ctx.beginPath();
    ctx.moveTo(x + face * (4 + 6 * Math.cos(1.2)) * z, y - (11 + 6 * Math.sin(1.2)) * z); ctx.lineTo(x + face * (firing ? 6 : 1) * z, y - 11 * z);
    ctx.lineTo(x + face * (4 + 6 * Math.cos(1.2)) * z, y - (11 - 6 * Math.sin(1.2)) * z); ctx.stroke();
  }
  function drawBird(ctx, x, y, r, flap, color, face) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.9, r * 0.45, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + face * r * 0.8, y - r * 0.3, r * 0.35, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.moveTo(x + face * r * 1.1, y - r * 0.35); ctx.lineTo(x + face * r * 1.45, y - r * 0.2); ctx.lineTo(x + face * r * 1.1, y - r * 0.1); ctx.fill();
    ctx.fillStyle = U.shade(color, -0.2);
    const wy = -flap * r * 1.1;
    ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.2); ctx.quadraticCurveTo(x - r * 0.2, y - r * 0.4 + wy, x - r * 1.4, y - r * 0.3 + wy); ctx.lineTo(x + r * 0.3, y); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - r * 0.9, y); ctx.lineTo(x - r * 1.5, y + r * 0.2); ctx.lineTo(x - r * 0.9, y + r * 0.3); ctx.fill();
  }

  // Each troop has its own little figure. `lvl` changes the armour colour.
  function armour(lvl) { return lvl >= 10 ? '#3fa0e0' : lvl >= 7 ? '#f2c230' : lvl >= 4 ? '#c8ccd4' : '#c08040'; }
  function drawTroopFigure(ctx, type, x, y, z, face, t, attacking, lvl, guard) {
    const A = armour(lvl), skin = '#c98a58', linen = '#f2ead6';
    const swing = attacking ? Math.sin(t * 18) : 0;
    const person = (body, head, opts = {}) => {
      const s = opts.scale || 1, zz = z * s;
      ctx.fillStyle = skin; ctx.fillRect(x - 2.2 * zz, y - 4 * zz, 1.6 * zz, 4 * zz); ctx.fillRect(x + 0.6 * zz, y - 4 * zz, 1.6 * zz, 4 * zz);
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(x - 4 * zz, y - 4 * zz); ctx.lineTo(x + 4 * zz, y - 4 * zz); ctx.lineTo(x + 3 * zz, y - 13 * zz); ctx.lineTo(x - 3 * zz, y - 13 * zz); ctx.closePath(); ctx.fill();
      ctx.fillStyle = A; ctx.fillRect(x - 3 * zz, y - 13 * zz, 6 * zz, 2 * zz);
      if (guard) { ctx.fillStyle = '#c83a2a'; ctx.fillRect(x - 3.5 * zz, y - 9 * zz, 7 * zz, 1.6 * zz); }
      ctx.fillStyle = opts.headColor || skin; ctx.beginPath(); ctx.arc(x, y - 16 * zz, 3.2 * zz, 0, 7); ctx.fill();
      if (head) head(zz);
    };
    switch (type) {
      case 'spearman': {
        person(linen, (zz) => { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 3.4 * zz, y - 19.5 * zz, 6.8 * zz, 2.4 * zz); });
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.2 * z;
        const tip = attacking ? 4 * swing : 0;
        ctx.beginPath(); ctx.moveTo(x + face * 4 * z, y - 2 * z); ctx.lineTo(x + face * (7 + tip) * z, y - 24 * z); ctx.stroke();
        ctx.fillStyle = A; ctx.beginPath(); ctx.moveTo(x + face * (7 + tip) * z, y - 27 * z); ctx.lineTo(x + face * (6 + tip) * z, y - 23 * z); ctx.lineTo(x + face * (8.2 + tip) * z, y - 23 * z); ctx.fill();
        ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.ellipse(x - face * 3.5 * z, y - 9 * z, 2.6 * z, 4.5 * z, 0, 0, 7); ctx.fill();
        break;
      }
      case 'archer':
        person('#f8f2e2', (zz) => { ctx.fillStyle = '#c83a2a'; ctx.fillRect(x - 3.3 * zz, y - 18 * zz, 6.6 * zz, 1.4 * zz); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 3.4 * zz, y - 17 * zz, 1.4 * zz, 6 * zz); });
        ctx.strokeStyle = lvl >= 7 ? '#f2c230' : '#6b4a2a'; ctx.lineWidth = 1.3 * z;
        ctx.beginPath(); ctx.arc(x + face * 4 * z, y - 11 * z, 6 * z, face > 0 ? -1.2 : 1.9, face > 0 ? 1.2 : 4.3); ctx.stroke();
        break;
      case 'tombRobber':
        person('#3a2f2a', (zz) => { ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.arc(x, y - 17 * zz, 3.6 * zz, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 3.6 * zz, y - 17 * zz, 7.2 * zz, 2 * zz); });
        ctx.fillStyle = '#b89a60'; ctx.beginPath(); ctx.arc(x - face * 5 * z, y - 10 * z, 4 * z, 0, 7); ctx.fill();
        ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(x - face * 5 * z, y - 13 * z, 1.4 * z, 0, 7); ctx.fill();
        break;
      case 'shieldBearer':
        person(linen, (zz) => { ctx.fillStyle = A; ctx.beginPath(); ctx.arc(x, y - 17 * zz, 3.8 * zz, Math.PI, 0); ctx.fill(); }, { scale: 1.35 });
        ctx.fillStyle = A; ctx.strokeStyle = U.shade(A, -0.4); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + face * 3 * z, y - 2 * z); ctx.lineTo(x + face * 3 * z, y - 20 * z); ctx.quadraticCurveTo(x + face * 7 * z, y - 23 * z, x + face * 11 * z, y - 20 * z); ctx.lineTo(x + face * 11 * z, y - 2 * z); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c83a2a'; ctx.beginPath(); ctx.arc(x + face * 7 * z, y - 12 * z, 2 * z, 0, 7); ctx.fill();
        break;
      case 'ramCrew': {
        const sw = attacking ? 3 * swing : 0;
        for (const dx of [-4, 4]) { ctx.fillStyle = linen; ctx.fillRect(x + dx * z - 2.5 * z, y - 11 * z, 5 * z, 8 * z); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x + dx * z, y - 14 * z, 2.6 * z, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#7a5530'; ctx.save(); ctx.translate(x + sw * z, y - 9 * z); ctx.fillRect(-10 * z, -2 * z, 20 * z, 4 * z); ctx.fillStyle = A; ctx.fillRect(face > 0 ? 8 * z : -11 * z, -3 * z, 3 * z, 6 * z); ctx.restore();
        break;
      }
      case 'falcon':
        drawBird(ctx, x, y - 4 * z, 7 * z, Math.sin(t * 16), lvl >= 7 ? '#c89a40' : '#7a5530', face);
        break;
      case 'sandMage':
        person('#2f55a8', (zz) => { ctx.fillStyle = '#2f55a8'; ctx.beginPath(); ctx.moveTo(x - 4 * zz, y - 15 * zz); ctx.lineTo(x, y - 24 * zz); ctx.lineTo(x + 4 * zz, y - 15 * zz); ctx.fill(); });
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.moveTo(x + face * 5 * z, y); ctx.lineTo(x + face * 5 * z, y - 22 * z); ctx.stroke();
        ctx.fillStyle = `rgba(240,200,110,${0.7 + 0.3 * Math.sin(t * 6)})`; ctx.beginPath(); ctx.arc(x + face * 5 * z, y - 24 * z, (2.5 + (attacking ? 1.5 : 0)) * z, 0, 7); ctx.fill();
        break;
      case 'priestess': {
        // floating on spread wings of Isis
        const f = Math.sin(t * 3) * 2;
        ctx.fillStyle = A;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, y - 12 * z); ctx.quadraticCurveTo(x + s * 10 * z, y - (18 + f) * z, x + s * 16 * z, y - (10 + f) * z); ctx.quadraticCurveTo(x + s * 8 * z, y - 8 * z, x, y - 8 * z); ctx.fill(); }
        person('#f8f2e2', (zz) => { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 3.4 * zz, y - 19.5 * zz, 6.8 * zz, 6 * zz); ctx.fillStyle = '#c83a2a'; ctx.beginPath(); ctx.arc(x, y - 22 * zz, 2.2 * zz, 0, 7); ctx.fill(); });
        break;
      }
      case 'chariot': {
        const w = Math.sin(t * 10);
        ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.ellipse(x + face * 9 * z, y - 9 * z, 7 * z, 4 * z, 0, 0, 7); ctx.fill(); // horse body
        ctx.fillRect(x + face * 14 * z - 1.5 * z, y - 17 * z, 3 * z, 8 * z);
        ctx.beginPath(); ctx.ellipse(x + face * 16 * z, y - 17 * z, 3.5 * z, 2 * z, face * 0.4, 0, 7); ctx.fill();
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.6 * z; ctx.beginPath(); ctx.moveTo(x + face * 5 * z, y - 7 * z); ctx.lineTo(x + face * (4 + w * 2) * z, y); ctx.moveTo(x + face * 13 * z, y - 7 * z); ctx.lineTo(x + face * (14 - w * 2) * z, y); ctx.stroke();
        ctx.fillStyle = A; ctx.fillRect(x - 6 * z, y - 12 * z, 9 * z, 7 * z);
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.4 * z; ctx.beginPath(); ctx.arc(x - 2 * z, y - 4 * z, 4 * z, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 2 * z + Math.cos(t * 12) * 4 * z, y - 4 * z + Math.sin(t * 12) * 4 * z); ctx.lineTo(x - 2 * z - Math.cos(t * 12) * 4 * z, y - 4 * z - Math.sin(t * 12) * 4 * z); ctx.stroke();
        ctx.fillStyle = linen; ctx.fillRect(x - 3.5 * z, y - 20 * z, 5 * z, 8 * z);
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x - 1 * z, y - 22 * z, 2.8 * z, 0, 7); ctx.fill();
        ctx.fillStyle = '#2f55a8'; ctx.fillRect(x - 4 * z, y - 25 * z, 6 * z, 2 * z);
        break;
      }
      case 'camelArcher': {
        ctx.fillStyle = '#c89a5a';
        ctx.beginPath(); ctx.ellipse(x, y - 11 * z, 9 * z, 4.5 * z, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x - 2 * z, y - 15 * z, 4 * z, Math.PI, 0); ctx.fill();
        ctx.fillRect(x + face * 7 * z - 1.5 * z, y - 21 * z, 3 * z, 10 * z);
        ctx.beginPath(); ctx.ellipse(x + face * 9 * z, y - 21 * z, 3.5 * z, 2 * z, 0, 0, 7); ctx.fill();
        const w = Math.sin(t * 9) * 2;
        ctx.strokeStyle = '#a87a3a'; ctx.lineWidth = 1.6 * z;
        for (const dx of [-6, -3, 3, 6]) { ctx.beginPath(); ctx.moveTo(x + dx * z, y - 8 * z); ctx.lineTo(x + (dx + (dx > 0 ? w : -w)) * z, y); ctx.stroke(); }
        ctx.fillStyle = '#f8f2e2'; ctx.fillRect(x - 3 * z, y - 25 * z, 5 * z, 8 * z);
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x - 0.5 * z, y - 28 * z, 2.6 * z, 0, 7); ctx.fill();
        ctx.fillStyle = A; ctx.fillRect(x - 3.4 * z, y - 31 * z, 6 * z, 2 * z);
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.arc(x + face * 3 * z, y - 22 * z, 5 * z, face > 0 ? -1.2 : 1.9, face > 0 ? 1.2 : 4.3); ctx.stroke();
        break;
      }
      case 'phoenix': {
        const f = Math.sin(t * 7);
        const col = lvl >= 10 ? '#3fe0d0' : '#ff7a2a';
        const g = ctx.createRadialGradient(x, y - 8 * z, 1, x, y - 8 * z, 26 * z);
        g.addColorStop(0, 'rgba(255,240,160,0.7)'); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 8 * z, 26 * z, 0, 7); ctx.fill();
        ctx.fillStyle = col;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, y - 8 * z); ctx.quadraticCurveTo(x + s * 12 * z, y - (24 + f * 10) * z, x + s * 24 * z, y - (14 + f * 12) * z); ctx.quadraticCurveTo(x + s * 12 * z, y - 6 * z, x, y - 4 * z); ctx.fill(); }
        ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.ellipse(x, y - 8 * z, 8 * z, 4 * z, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + face * 8 * z, y - 12 * z, 3.4 * z, 0, 7); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - face * 6 * z, y - 7 * z); ctx.lineTo(x - face * 18 * z, y - 2 * z + f * 3 * z); ctx.lineTo(x - face * 14 * z, y - 10 * z); ctx.fill();
        break;
      }
      case 'mummy':
      case 'miniMummy': {
        const s = type === 'mummy' ? 1.3 : 0.85;
        person('#ddd5c0', (zz) => {
          ctx.strokeStyle = '#a89a80'; ctx.lineWidth = 0.8 * zz;
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 3 * zz, y - (18 - i * 2) * zz); ctx.lineTo(x + 3 * zz, y - (16.5 - i * 2) * zz); ctx.stroke(); }
          ctx.fillStyle = '#ffd040'; ctx.fillRect(x + face * 1 * zz - 0.6 * zz, y - 17 * zz, 1.4 * zz, 1.2 * zz);
        }, { scale: s, headColor: '#ddd5c0' });
        ctx.strokeStyle = '#ddd5c0'; ctx.lineWidth = 2 * z * s; ctx.beginPath(); ctx.moveTo(x + face * 2 * z * s, y - 11 * z * s); ctx.lineTo(x + face * 9 * z * s, y - (12 + swing * 2) * z * s); ctx.stroke();
        break;
      }
      case 'warElephant': {
        const w = Math.sin(t * 5) * 2;
        ctx.fillStyle = '#8a8a90';
        for (const dx of [-9, -4, 5, 10]) ctx.fillRect(x + dx * z, y - 10 * z, 4 * z, 10 * z + (dx > 0 ? w : -w) * z * 0.3);
        ctx.beginPath(); ctx.ellipse(x, y - 18 * z, 16 * z, 11 * z, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + face * 15 * z, y - 21 * z, 7 * z, 7 * z, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 4 * z; ctx.beginPath(); ctx.moveTo(x + face * 20 * z, y - 19 * z); ctx.quadraticCurveTo(x + face * (25 + swing * 2) * z, y - 10 * z, x + face * 22 * z, y - 3 * z); ctx.stroke();
        ctx.strokeStyle = '#f8f2e2'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.moveTo(x + face * 18 * z, y - 16 * z); ctx.lineTo(x + face * 24 * z, y - 14 * z); ctx.stroke();
        ctx.fillStyle = '#6a6a72'; ctx.beginPath(); ctx.ellipse(x + face * 12 * z, y - 22 * z, 4 * z, 6 * z, 0, 0, 7); ctx.fill();
        ctx.fillStyle = A; ctx.fillRect(x - 13 * z, y - 27 * z, 22 * z, 10 * z);
        ctx.fillStyle = '#c83a2a'; ctx.fillRect(x - 13 * z, y - 19 * z, 22 * z, 2.5 * z);
        ctx.fillStyle = '#7a5530'; ctx.fillRect(x - 6 * z, y - 35 * z, 10 * z, 8 * z);
        break;
      }
      case 'anubisWarrior': {
        person('#1d1a24', null, { scale: 1.6 });
        const zz = z * 1.6;
        ctx.fillStyle = A; ctx.fillRect(x - 4 * zz, y - 6 * zz, 8 * zz, 2.4 * zz);
        ctx.fillStyle = '#1d1a24'; ctx.beginPath(); ctx.ellipse(x + face * 1 * zz, y - 16 * zz, 3.4 * zz, 3 * zz, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + face * 2 * zz, y - 16 * zz); ctx.lineTo(x + face * 7 * zz, y - 15 * zz); ctx.lineTo(x + face * 2 * zz, y - 13.5 * zz); ctx.fill();
        for (const dx of [-1.6, 1.6]) { ctx.beginPath(); ctx.moveTo(x + dx * zz - 1 * zz, y - 18 * zz); ctx.lineTo(x + dx * zz, y - 24 * zz); ctx.lineTo(x + dx * zz + 1.3 * zz, y - 18 * zz); ctx.fill(); }
        ctx.fillStyle = '#ffd040'; ctx.fillRect(x + face * 1.5 * zz, y - 17 * zz, 1 * zz, 1 * zz);
        ctx.save(); ctx.translate(x + face * 4 * zz, y - 11 * zz); ctx.rotate(face * (-0.8 + swing * 1.2));
        ctx.strokeStyle = '#e0e0e8'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8 * zz); ctx.arc(face * 2.5 * zz, -8 * zz, 2.5 * zz, Math.PI, face > 0 ? Math.PI * 1.9 : Math.PI * 0.1, face < 0); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'skyBarge': {
        const r = Math.sin(t * 2) * 0.05;
        ctx.save(); ctx.translate(x, y); ctx.rotate(r);
        ctx.fillStyle = '#c8a050'; ctx.beginPath(); ctx.moveTo(-16 * z, -8 * z); ctx.quadraticCurveTo(0, 2 * z, 16 * z, -8 * z); ctx.lineTo(12 * z, -4 * z); ctx.quadraticCurveTo(0, 0, -12 * z, -4 * z); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#8a6a2a'; ctx.lineWidth = 0.8; for (let i = -10; i <= 10; i += 4) { ctx.beginPath(); ctx.moveTo(i * z, -6 * z); ctx.lineTo(i * z, -2 * z); ctx.stroke(); }
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.4 * z; ctx.beginPath(); ctx.moveTo(0, -6 * z); ctx.lineTo(0, -30 * z); ctx.stroke();
        ctx.fillStyle = lvl >= 7 ? '#f2c230' : '#f4ead2'; ctx.beginPath(); ctx.moveTo(-1 * z, -29 * z); ctx.quadraticCurveTo(-12 * z, -20 * z, -1 * z, -9 * z); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c83a2a'; ctx.beginPath(); ctx.arc(-4 * z, -9 * z, 2 * z, 0, 7); ctx.arc(5 * z, -9 * z, 2 * z, 0, 7); ctx.fill();
        ctx.restore();
        break;
      }
      case 'sobekBrute': {
        person('#3a7a4a', null, { scale: 1.8, headColor: '#4a8a4a' });
        const zz = z * 1.8;
        ctx.fillStyle = A; ctx.fillRect(x - 4 * zz, y - 6 * zz, 8 * zz, 2.4 * zz);
        ctx.fillStyle = '#4a8a4a'; ctx.beginPath(); ctx.moveTo(x, y - 18 * zz); ctx.lineTo(x + face * 9 * zz, y - 16 * zz); ctx.lineTo(x + face * 9 * zz, y - 14.5 * zz); ctx.lineTo(x, y - 14 * zz); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.7 * zz; ctx.beginPath(); for (let i = 2; i < 9; i += 2) { ctx.moveTo(x + face * i * zz, y - 15 * zz); ctx.lineTo(x + face * (i + 0.6) * zz, y - 14 * zz); } ctx.stroke();
        ctx.fillStyle = '#ffd040'; ctx.fillRect(x + face * 1.5 * zz, y - 18 * zz, 1.1 * zz, 1.1 * zz);
        ctx.strokeStyle = '#3a7a4a'; ctx.lineWidth = 3.5 * z; ctx.beginPath(); ctx.moveTo(x - face * 3 * zz, y - 5 * zz); ctx.quadraticCurveTo(x - face * (9 + swing * 3) * zz, y - 2 * zz, x - face * 12 * zz, y + 1 * zz); ctx.stroke();
        ctx.save(); ctx.translate(x + face * 4 * zz, y - 11 * zz); ctx.rotate(face * (-0.6 + swing)); ctx.fillStyle = '#7a5530'; ctx.fillRect(-1 * z, -14 * zz, 2.4 * z, 14 * zz); ctx.fillStyle = A; ctx.fillRect(-3 * z, -16 * zz, 6.4 * z, 4 * zz); ctx.restore();
        break;
      }
      case 'champion': {
        const zz = z * 1.7;
        const g = ctx.createRadialGradient(x, y - 14 * zz, 1, x, y - 14 * zz, 22 * zz);
        g.addColorStop(0, `rgba(255,220,100,${0.25 + 0.1 * Math.sin(t * 4)})`); g.addColorStop(1, 'rgba(255,220,100,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 14 * zz, 22 * zz, 0, 7); ctx.fill();
        person('#f8f2e2', (s) => {
          ctx.fillStyle = '#2f55a8'; ctx.beginPath(); ctx.moveTo(x - 4.6 * s, y - 12 * s); ctx.lineTo(x - 4 * s, y - 18 * s); ctx.lineTo(x + 4 * s, y - 18 * s); ctx.lineTo(x + 4.6 * s, y - 12 * s); ctx.fill();
          ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 0.9 * s; for (let i = -3; i <= 3; i += 2) { ctx.beginPath(); ctx.moveTo(x + i * s, y - 18 * s); ctx.lineTo(x + i * 1.2 * s, y - 12 * s); ctx.stroke(); }
          ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x + face * 0.6 * s, y - 15.5 * s, 2.4 * s, 0, 7); ctx.fill();
          ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(x, y - 19 * s, 1.2 * s, 0, 7); ctx.fill();
        }, { scale: 1.7 });
        ctx.fillStyle = '#f2c230'; ctx.fillRect(x - 4 * zz, y - 7 * zz, 8 * zz, 2 * zz);
        ctx.save(); ctx.translate(x + face * 4 * zz, y - 11 * zz); ctx.rotate(face * (-0.9 + swing * 1.1));
        ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 2.2 * z; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -11 * zz); ctx.stroke();
        ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.moveTo(-3 * z, -11 * zz); ctx.lineTo(0, -15 * zz); ctx.lineTo(3 * z, -11 * zz); ctx.fill();
        ctx.restore();
        break;
      }
      default:
        person(linen);
    }
  }

  G.Renderer = Renderer;
  G.Draw = { drawTroopFigure, resIcon, roundRect, sunDisk, star };
})(globalThis.SOTP = globalThis.SOTP || {});
