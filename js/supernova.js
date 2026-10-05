'use strict';
/* Claude Code Clicker: the one-time Supernova event at 100 quadrillion all-time tokens (after the Event Horizon).
   The sparkle swells into a red giant and engulfs the page. On a fullscreen "Supernova" tab, every building you own
   orbits the star as it grows, and is fused into heavier elements as the star swallows its orbit. When the core turns
   to iron it collapses, explodes into a nebula and leaves a spinning pulsar, and the Supernova clicker style unlocks.
   Purely visual: production keeps running throughout. */

const SN_AT = 1e17;
const SN = { burn: 2.2, black: [2.6, 3.4], giant: [3.6, 10.2], collapse: 11.2, fade: [15.4, 17], end: 17.6 };
const SN_ELEMENTS = ['H', 'He', 'C', 'O', 'Ne', 'Si', 'Fe'];
const SN_COLS = ['#FFFFFF', '#5EE6FF', '#FF5FB8', '#FFD27A', '#A79BFF'];

const Supernova = {
  running: false,
  // Like the Event Horizon, it waits for your next click once you qualify, and always comes after it.
  ready() {
    return !this.running && G.blackhole && !G.supernova && !BlackHole.running && !document.hidden && allTimeEarned() >= SN_AT;
  },
  init() {
    const go = () => { if (this.ready()) setTimeout(() => { if (this.ready()) this.start(); }, 0); };
    document.addEventListener('pointerdown', go, true);
    on('clicked', go);
  },
  start() {
    if (this.running) return;
    if (typeof FullView !== 'undefined') FullView.exit();
    this.running = true;
    Tip.hide();
    if (stillMode()) return this.quick();

    const ov = document.createElement('div');
    ov.className = 'bh-overlay sn';
    ov.innerHTML =
      `<div class="bh-tab"><span class="bh-dot"></span><span class="bh-title">Supernova</span>` +
      `<span class="bh-count" id="snCount"></span><span class="bh-prog"><span id="snProg"></span></span><button type="button" class="bh-skip" id="snSkip">Skip ›</button></div>` +
      `<canvas class="bh-canvas"></canvas><div class="bh-caption" id="snCaption"></div><div class="bh-flash"></div>`;
    document.body.appendChild(ov);
    Object.assign(this, {
      ov, cv: ov.querySelector('canvas'), caption: ov.querySelector('#snCaption'), count: ov.querySelector('#snCount'),
      prog: ov.querySelector('#snProg'), flashEl: ov.querySelector('.bh-flash'),
    });
    this.ctx = this.cv.getContext('2d');
    // Skipping jumps straight to the core collapse.
    ov.querySelector('#snSkip').addEventListener('click', () => {
      if (this.t >= SN.giant[1]) return;
      this.t = SN.giant[1];
      for (const it of this.items) if (!it.done) { it.done = true; this.fused += it.worth; }
    });
    this.size();
    this.onResize = () => this.size();
    addEventListener('resize', this.onResize);

    Object.assign(this, { t: 0, last: performance.now(), burned: false, exploded: false, born: false, fused: 0, flashes: [], rings: [], sparks: [], burst: [], filaments: [], beamHalf: 0 });
    this.buildItems();
    this.stars = Array.from({ length: 180 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.8), ph: Math.random() * 6 }));
    document.getElementById('app').classList.add('bh-shake');
    document.body.classList.add('bh-running');
    Sound.rumble();
    this.raf = requestAnimationFrame(now => this.tick(now));
  },
  // Reduced motion: switch styles quietly instead of the full show.
  quick() {
    this.unlock();
    save();
    this.running = false;
    this.announce();
  },
  unlock() {
    G.supernova = true;
    G.theme = 'supernova';
    applyTheme();
  },
  announce() {
    toast({ icon: GLYPH.sparkle, kicker: 'Supernova', title: 'You crossed 100 quadrillion tokens', text: 'New clicker style unlocked: Supernova. Switch styles any time in Options.', kind: 'legend', life: 9000 });
  },
  size() {
    const r = dpr();
    this.W = innerWidth;
    this.H = innerHeight;
    this.cv.width = Math.round(this.W * r);
    this.cv.height = Math.round(this.H * r);
    this.ctx.setTransform(r, 0, 0, r, 0, 0);
    const m = Math.min(this.W, this.H);
    this.rIn = m * 0.2;
    this.rOut = m * 0.47;
  },
  // Each building type you own gets its own orbit, inner orbits for the earlier buildings.
  buildItems() {
    this.items = [];
    this.total = totalOwned();
    const types = [];
    for (let i = 0; i < N; i++) if (G.owned[i]) types.push(i);
    this.orbits = Math.max(1, types.length);
    types.forEach((i, ring) => {
      const n = G.owned[i], k = clamp(Math.ceil(Math.log2(n + 1) * 2), 2, 14);
      const spr = n >= DIAMOND_AT ? Workspace.diaLaneSprite(i, 0) : n >= RAINBOW_AT ? Workspace.rbLaneSprite(i, 0) : n >= HAND_GROUP_AT ? Workspace.bigSprite(i) : Workspace.sprite(i);
      const size = n >= HAND_GROUP_AT ? 40 : 30, off = Math.random() * Math.PI * 2;
      for (let q = 0; q < k; q++) this.items.push({ spr, size, worth: n / k, ring, a0: off + (q / k) * Math.PI * 2 + rand(-0.15, 0.15), done: false });
    });
    if (!this.items.length) {
      this.orbits = 3;
      for (let q = 0; q < 18; q++) this.items.push({ spr: makeSprite(GLYPH.sparkle, 30), size: 26, worth: 0, ring: q % 3, a0: q * 1.1, done: false });
    }
    if (this.items.length > 240) this.items = this.items.sort(() => Math.random() - 0.5).slice(0, 240);
  },
  orbitR(ring) { return this.rIn + (this.rOut - this.rIn) * ((ring + 0.5) / this.orbits); },
  // The star's radius over the timeline: it swells past every orbit, then collapses to a point.
  starR(t) {
    const [g0, g1] = SN.giant, r0 = Math.min(this.W, this.H) * 0.09, rMax = this.rOut * 1.05;
    if (t < g0 - 0.6) return 0;
    if (t < g0) return r0 * ((t - (g0 - 0.6)) / 0.6);
    if (t < g1) return r0 + (rMax - r0) * Math.pow((t - g0) / (g1 - g0), 1.35);
    if (t < SN.collapse) {
      const e = (t - g1) / (SN.collapse - g1);
      if (e < 0.3) return rMax * (1 - 0.05 * (e / 0.3)); // it hesitates…
      return rMax * 0.95 * Math.pow(1 - (e - 0.3) / 0.7, 3) + 3; // …then implodes
    }
    return 0;
  },
  burn() {
    BlackHole.panels().forEach((el, k) => {
      const d = k * 0.1;
      el.style.transition = `filter 1.2s ease-in ${d}s, transform 1.6s ease-in ${d}s, opacity 1.3s ease-in ${d + 0.35}s`;
      el.style.filter = 'brightness(1.6) sepia(.7) saturate(2.6) hue-rotate(-20deg) blur(3px)';
      el.style.transform = 'scale(1.08)';
      el.style.opacity = '0';
    });
  },
  restore() {
    BlackHole.panels().forEach((el, k) => {
      const d = k * 0.08;
      el.style.transition = `transform 1.2s cubic-bezier(.15,.75,.25,1) ${d}s, opacity .8s ease-out ${d}s, filter 1.8s ease-out ${d}s`;
      el.style.transform = '';
      el.style.opacity = '';
      el.style.filter = '';
    });
    setTimeout(() => BlackHole.panels().forEach(el => { el.style.transition = ''; }), 2600);
  },
  tick(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    try {
      this.step(dt);
    } catch (e) {
      console.error('Supernova event failed:', e);
      this.t = SN.end;
    }
    if (this.t >= SN.end) return this.finish();
    this.raf = requestAnimationFrame(n => this.tick(n));
  },
  step(dt) {
    const t = (this.t += dt), c = this.ctx, W = this.W, H = this.H, cx = W / 2, cy = H / 2, [g0, g1] = SN.giant;
    Stage.swell = t < SN.black[1] ? clamp(t / SN.black[0], 0, 1) : 0;
    if (!this.burned && t >= SN.burn) { this.burned = true; this.burn(); }
    if (t >= g0) document.getElementById('app').classList.remove('bh-shake');

    let bg = 0;
    if (t >= SN.black[0] && t < SN.fade[0]) bg = clamp((t - SN.black[0]) / (SN.black[1] - SN.black[0]), 0, 1);
    else if (t >= SN.fade[0]) bg = 1 - clamp((t - SN.fade[0]) / (SN.fade[1] - SN.fade[0]), 0, 1);
    this.ov.style.background = `rgba(5,6,15,${bg})`;
    this.ov.classList.toggle('tab-on', t >= g0 - 0.2 && t < SN.fade[0]);

    c.clearRect(0, 0, W, H);
    let shake = 0;
    if (t > g1 - 1.5 && t < SN.collapse) shake = clamp((t - (g1 - 1.5)) / (SN.collapse - g1 + 1.5), 0, 1) * 10;
    else if (t >= SN.collapse) shake = Math.max(0, 26 * (1 - (t - SN.collapse) / 1.4));
    c.save();
    if (shake) c.translate(rand(-shake, shake), rand(-shake, shake));

    // A heat haze closes in while the sparkle swells.
    if (t < SN.black[1]) {
      const e = clamp(t / SN.black[0], 0, 1), v = c.createRadialGradient(cx, cy, Math.min(W, H) * (0.55 - 0.35 * e), cx, cy, Math.hypot(W, H) / 2);
      v.addColorStop(0, 'rgba(255,80,30,0)');
      v.addColorStop(1, `rgba(120,20,10,${0.7 * e})`);
      c.fillStyle = v;
      c.fillRect(0, 0, W, H);
    }
    // Twinkling background stars.
    if (bg > 0.05) {
      c.fillStyle = '#EAF0FF';
      for (const s of this.stars) {
        c.globalAlpha = bg * (0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 + s.ph)));
        c.fillRect(s.x * W, s.y * H, s.s, s.s);
      }
      c.globalAlpha = 1;
    }

    const R = this.starR(t);
    const f = this.items.length ? this.items.filter(it => it.done).length / this.items.length : 1;
    // Orbits and the buildings on them, swallowed as the star grows past each one.
    if (t >= g0 - 0.6 && t < g1) {
      c.lineWidth = 1;
      for (let ring = 0; ring < this.orbits; ring++) {
        const r = this.orbitR(ring);
        if (r <= R) continue;
        c.strokeStyle = 'rgba(234,240,255,.07)';
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.stroke();
      }
    }
    if (R > 0 && t < SN.collapse) this.drawStar(c, cx, cy, R, t, f);
    if (t >= g0 - 0.6 && t < SN.collapse) {
      for (const it of this.items) {
        if (it.done) continue;
        const r = this.orbitR(it.ring), a = it.a0 + t * 0.9 * Math.pow(this.rIn / r, 1.5);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (r <= R + 4) {
          it.done = true;
          this.fused += it.worth;
          this.flashes.push({ x, y, life: 0 });
          continue;
        }
        const heat = clamp(1 - (r - R) / 90, 0, 1);
        if (heat > 0) {
          const hg = c.createRadialGradient(x, y, 0, x, y, it.size);
          hg.addColorStop(0, `rgba(255,150,60,${0.55 * heat})`);
          hg.addColorStop(1, 'rgba(255,150,60,0)');
          c.fillStyle = hg;
          c.fillRect(x - it.size, y - it.size, it.size * 2, it.size * 2);
        }
        const sz = it.size * (1 + heat * 0.15 * Math.sin(t * 20 + it.a0));
        c.drawImage(it.spr, x - sz / 2, y - sz / 2, sz, sz);
      }
    }
    // Each building that falls in flares as it fuses.
    this.flashes = this.flashes.filter(p => (p.life += dt) < 0.45);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of this.flashes) {
      const e = p.life / 0.45, r = 6 + e * 22, g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,240,200,${0.9 * (1 - e)})`);
      g.addColorStop(0.4, `rgba(255,150,70,${0.5 * (1 - e)})`);
      g.addColorStop(1, 'rgba(255,120,50,0)');
      c.fillStyle = g;
      c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    c.restore();
    // Core collapse: matter streaks inward.
    if (t >= g1 && t < SN.collapse) {
      const e = (t - g1) / (SN.collapse - g1);
      c.strokeStyle = `rgba(255,220,180,${0.5 * e})`;
      c.lineWidth = 1.5;
      for (let k = 0; k < 40; k++) {
        const a = k * 0.157 + hash(k) * 0.2, r1 = R + 20 + ((t * 600 + hash(k + 7) * 400) % 300);
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        c.lineTo(cx + Math.cos(a) * (r1 - 40), cy + Math.sin(a) * (r1 - 40));
        c.stroke();
      }
    }

    // The explosion: switch styles, bring the page back, and blow everything out.
    if (!this.exploded && t >= SN.collapse) this.explode(cx, cy);
    if (t >= SN.collapse) this.drawRemnant(c, cx, cy, t, dt);
    c.restore();

    // Tab readout.
    const el = SN_ELEMENTS[Math.min(SN_ELEMENTS.length - 1, Math.floor(f * SN_ELEMENTS.length))];
    const total = this.total.toLocaleString('en-US');
    this.count.textContent = t < SN.collapse
      ? `Fusing ${t >= g1 ? 'Fe' : el} · ${Math.min(this.total, Math.round(this.fused)).toLocaleString('en-US')} of ${total} buildings`
      : 'Remnant · pulsar online';
    this.prog.style.width = `${(t >= SN.collapse ? 1 : f) * 100}%`;
    const caption =
      t < SN.burn ? 'The sparkle is overheating…'
        : t < g0 ? 'It is swelling into a red giant.'
          : t < (g0 + g1) / 2 ? 'Red giant. Your buildings are being fused into heavier elements.'
            : t < g1 ? 'Iron is building up in the core. Fusion is running out.'
              : t < SN.collapse ? 'Core collapse…'
                : t < SN.collapse + 2.4 ? 'SUPERNOVA.'
                  : 'A pulsar is born. Your clicker is now a neutron star.';
    if (this.caption.textContent !== caption) this.caption.textContent = caption;
  },
  drawStar(c, cx, cy, R, t, f) {
    const collapsing = t >= SN.giant[1];
    c.save();
    c.translate(cx, cy);
    // Corona.
    const cor = c.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.9);
    cor.addColorStop(0, collapsing ? 'rgba(255,240,220,.45)' : 'rgba(255,110,50,.4)');
    cor.addColorStop(1, 'rgba(255,90,40,0)');
    c.fillStyle = cor;
    c.fillRect(-R * 1.9, -R * 1.9, R * 3.8, R * 3.8);
    // Body: hotter and whiter as it collapses.
    const body = c.createRadialGradient(0, 0, 0, 0, 0, R);
    body.addColorStop(0, '#FFF6DE');
    body.addColorStop(0.35, collapsing ? '#FFE2A8' : '#FFB45E');
    body.addColorStop(0.75, collapsing ? '#FF9A4D' : '#E8502A');
    body.addColorStop(1, collapsing ? '#E8502A' : '#9C1E14');
    c.fillStyle = body;
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fill();
    // Boiling surface (granulation), clipped to the disc.
    c.save();
    c.clip();
    for (let k = 0; k < 46; k++) {
      const a = hash(k) * Math.PI * 2 + t * 0.05 * (1 + hash(k + 1)), d = Math.sqrt(hash(k + 2)) * R * 0.92;
      const x = Math.cos(a) * d, y = Math.sin(a) * d, r = R * (0.1 + hash(k + 3) * 0.12) * (1 + 0.15 * Math.sin(t * 1.7 + k));
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const hot = k % 3 !== 0;
      g.addColorStop(0, hot ? 'rgba(255,214,150,.22)' : 'rgba(110,20,10,.22)');
      g.addColorStop(1, hot ? 'rgba(255,214,150,0)' : 'rgba(110,20,10,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Limb darkening.
    const limb = c.createRadialGradient(0, 0, R * 0.65, 0, 0, R);
    limb.addColorStop(0, 'rgba(80,10,5,0)');
    limb.addColorStop(1, 'rgba(80,10,5,.55)');
    c.fillStyle = limb;
    c.fillRect(-R, -R, R * 2, R * 2);
    c.restore();
    // The iron core, glowing brighter as more is fused.
    const core = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.32);
    core.addColorStop(0, `rgba(225,240,255,${0.2 + f * 0.7})`);
    core.addColorStop(1, 'rgba(225,240,255,0)');
    c.fillStyle = core;
    c.fillRect(-R * 0.32, -R * 0.32, R * 0.64, R * 0.64);
    // Prominences arcing off the edge.
    c.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05 + t * 0.08, h = R * (0.16 + 0.07 * Math.sin(t * 1.9 + k * 2));
      c.strokeStyle = 'rgba(255,190,120,.5)';
      c.lineWidth = Math.max(1, R * 0.008);
      c.shadowColor = 'rgba(255,140,60,.9)';
      c.shadowBlur = R * 0.05;
      c.beginPath();
      c.moveTo(Math.cos(a - 0.1) * R, Math.sin(a - 0.1) * R);
      c.quadraticCurveTo(Math.cos(a) * (R + h * 2), Math.sin(a) * (R + h * 2), Math.cos(a + 0.1) * R, Math.sin(a + 0.1) * R);
      c.stroke();
    }
    c.restore();
  },
  explode(cx, cy) {
    this.exploded = true;
    this.flashEl.classList.add('go');
    this.unlock();
    Stage.swell = 0;
    this.restore();
    Sound.boom();
    const maxR = Math.hypot(this.W, this.H) / 2;
    for (const it of this.items.slice(0, 200)) {
      const a = Math.random() * Math.PI * 2, v = rand(300, 1300);
      this.burst.push({ spr: it.spr, size: it.size, x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: 0, vr: rand(-8, 8), life: 0, max: rand(1.8, 2.8), col: pick(SN_COLS) });
    }
    for (let k = 0; k < 7; k++) this.rings.push({ life: -k * 0.09, r0: 20 + k * 30, col: ['#FFFFFF', '#5EE6FF', '#FF5FB8', '#FFD27A', '#A79BFF', '#5EE6FF', '#FF5FB8'][k] });
    for (let k = 0; k < 520; k++) {
      const a = Math.random() * Math.PI * 2, v = rand(150, 1600);
      this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(0.8, 2.6), col: pick(SN_COLS), s: rand(1.5, 3.8) });
    }
    for (let k = 0; k < 110; k++) {
      this.filaments.push({ a: Math.random() * Math.PI * 2, len: rand(0.35, 1) * maxR, bend: rand(-0.35, 0.35), w: rand(1, 3.2), col: pick(['255,95,184', '94,230,255', '255,210,122', '167,155,255']) });
    }
  },
  drawRemnant(c, cx, cy, t, dt) {
    const e = t - SN.collapse, W = this.W, H = this.H, maxR = Math.hypot(W, H) / 2;
    const grow = Math.min(1, e / 3.2), fadeA = Math.max(0, 1 - e / 6.2);
    // Expanding nebula shell.
    const neb = c.createRadialGradient(cx, cy, 0, cx, cy, 60 + grow * maxR * 1.1);
    neb.addColorStop(0, `rgba(255,255,255,${0.5 * fadeA})`);
    neb.addColorStop(0.25, `rgba(94,230,255,${0.3 * fadeA})`);
    neb.addColorStop(0.55, `rgba(255,95,184,${0.24 * fadeA})`);
    neb.addColorStop(0.8, `rgba(255,210,122,${0.1 * fadeA})`);
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = neb;
    c.fillRect(0, 0, W, H);
    // Light rays for the first moments.
    if (e < 2.6) {
      const fade = 1 - e / 2.6, len = Math.hypot(W, H);
      c.save();
      c.translate(cx, cy);
      c.rotate(-t * 0.5);
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2, wdt = 0.04 + (k % 3) * 0.02;
        const g = c.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        g.addColorStop(0, `rgba(255,255,255,${0.55 * fade})`);
        g.addColorStop(0.3, k % 2 ? `rgba(255,95,184,${0.28 * fade})` : `rgba(94,230,255,${0.28 * fade})`);
        g.addColorStop(1, 'rgba(94,230,255,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, len, a - wdt, a + wdt);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    // Filaments, like the Crab Nebula.
    c.lineCap = 'round';
    for (const fl of this.filaments) {
      const r1 = fl.len * grow, r0 = r1 * 0.3;
      c.strokeStyle = `rgba(${fl.col},${0.6 * fadeA})`;
      c.lineWidth = fl.w;
      c.beginPath();
      c.moveTo(cx + Math.cos(fl.a) * r0, cy + Math.sin(fl.a) * r0);
      c.quadraticCurveTo(cx + Math.cos(fl.a + fl.bend) * (r0 + r1) / 2, cy + Math.sin(fl.a + fl.bend) * (r0 + r1) / 2, cx + Math.cos(fl.a + fl.bend * 0.5) * r1, cy + Math.sin(fl.a + fl.bend * 0.5) * r1);
      c.stroke();
    }
    // Shock rings.
    this.rings = this.rings.filter(g => (g.life += dt) < 1.1);
    for (const g of this.rings) {
      if (g.life < 0) continue;
      c.globalAlpha = Math.max(0, 1 - g.life / 1.1);
      c.strokeStyle = g.col;
      c.lineWidth = g.pulse ? 2 : 6;
      c.beginPath();
      c.arc(cx, cy, g.r0 + g.life * (g.pulse ? 180 : maxR * 1.5), 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    // Sparks and the buildings blasted back out, each with a coloured trail.
    this.sparks = this.sparks.filter(p => (p.life += dt) < p.max);
    for (const p of this.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      c.globalAlpha = 1 - p.life / p.max;
      c.fillStyle = p.col;
      c.fillRect(p.x, p.y, p.s, p.s);
    }
    this.burst = this.burst.filter(p => (p.life += dt) < p.max);
    for (const p of this.burst) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.rot += p.vr * dt;
      const a = 1 - p.life / p.max;
      c.globalAlpha = a * 0.6;
      c.strokeStyle = p.col;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(p.x - p.vx * 0.08, p.y - p.vy * 0.08);
      c.lineTo(p.x, p.y);
      c.stroke();
      c.globalAlpha = a;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.drawImage(p.spr, -p.size / 2, -p.size / 2, p.size, p.size);
      c.restore();
    }
    c.globalAlpha = 1;
    // The pulsar: a tiny white-hot core with two sweeping beams, pulsing each time a beam comes round.
    if (e > 0.8) {
      const on = Math.min(1, (e - 0.8) / 0.8), ang = t * 4.2, len = maxR * 1.3;
      if (!this.born) { this.born = true; Sound.legendary(); }
      const half = Math.floor(ang / Math.PI);
      if (half !== this.beamHalf) { this.beamHalf = half; this.rings.push({ life: 0, r0: 8, col: '#5EE6FF', pulse: true }); }
      c.save();
      c.translate(cx, cy);
      c.rotate(ang);
      for (const dir of [0, Math.PI]) {
        const g = c.createLinearGradient(0, 0, Math.cos(dir) * len, Math.sin(dir) * len);
        g.addColorStop(0, `rgba(230,250,255,${0.75 * on})`);
        g.addColorStop(0.3, `rgba(94,230,255,${0.3 * on})`);
        g.addColorStop(1, 'rgba(94,230,255,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, len, dir - 0.06, dir + 0.06);
        c.closePath();
        c.fill();
      }
      c.restore();
      const cg = c.createRadialGradient(cx, cy, 0, cx, cy, 34);
      cg.addColorStop(0, `rgba(255,255,255,${on})`);
      cg.addColorStop(0.25, `rgba(190,245,255,${0.8 * on})`);
      cg.addColorStop(1, 'rgba(94,230,255,0)');
      c.fillStyle = cg;
      c.fillRect(cx - 34, cy - 34, 68, 68);
    }
  },
  finish() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    document.getElementById('app').classList.remove('bh-shake');
    document.body.classList.remove('bh-running');
    Stage.swell = 0;
    if (!this.exploded) { this.unlock(); this.restore(); }
    const ov = this.ov;
    ov.classList.add('done');
    setTimeout(() => ov.remove(), 600);
    this.running = false;
    save();
    this.announce();
  },
};
