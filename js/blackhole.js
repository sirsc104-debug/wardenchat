'use strict';
/* Claude Code Clicker: the one-time Event Horizon event at 1 trillion all-time tokens.
   The sparkle collapses into a black hole, swallows the whole screen, shows every building you own
   falling in on a fullscreen "Event Horizon" tab, then spits it all back out and unlocks the
   black, orange and grey Event Horizon style. Purely visual: production keeps running throughout. */

const BH_AT = 1e12;
const BH = { collapse: 2.4, suck: 1.6, black: [2.6, 3.6], fall: [3.8, 11.4], flash: 12.6, fade: [12.8, 14.6], end: 15.6 };

const BlackHole = {
  running: false,
  // The event never starts on its own: once you qualify, it waits for your next click,
  // so nobody misses it by being away from the keyboard.
  ready() { return !this.running && !G.blackhole && !document.hidden && allTimeEarned() >= BH_AT; },
  init() {
    const go = () => { if (this.ready()) setTimeout(() => { if (this.ready()) this.start(); }, 0); };
    document.addEventListener('pointerdown', go, true);
    on('clicked', go); // keyboard clicks on the sparkle count too
  },
  start() {
    if (this.running) return;
    this.running = true;
    Tip.hide();
    if (stillMode()) return this.quick();

    const ov = document.createElement('div');
    ov.className = 'bh-overlay';
    ov.innerHTML =
      `<div class="bh-tab"><span class="bh-dot"></span><span class="bh-title">Event Horizon</span>` +
      `<span class="bh-count" id="bhCount"></span><button type="button" class="bh-skip" id="bhSkip">Skip ›</button></div>` +
      `<canvas class="bh-canvas"></canvas><div class="bh-caption" id="bhCaption"></div><div class="bh-flash"></div>`;
    document.body.appendChild(ov);
    this.ov = ov;
    this.cv = ov.querySelector('canvas');
    this.ctx = this.cv.getContext('2d');
    this.caption = ov.querySelector('#bhCaption');
    this.count = ov.querySelector('#bhCount');
    this.flashEl = ov.querySelector('.bh-flash');
    ov.querySelector('#bhSkip').addEventListener('click', () => { if (this.t < BH.fall[1]) this.t = BH.fall[1]; });
    this.size();
    this.onResize = () => this.size();
    addEventListener('resize', this.onResize);

    this.t = 0;
    this.last = performance.now();
    this.sucked = false;
    this.returned = false;
    this.consumed = 0;
    this.burst = [];
    this.rings = [];
    this.buildItems();
    this.stars = Array.from({ length: 170 }, () => this.newStar(true));
    document.getElementById('app').classList.add('bh-shake');
    document.body.classList.add('bh-running');
    Sound.rumble();
    this.raf = requestAnimationFrame(now => this.tick(now));
  },
  // Reduced motion: a calm fade into the new style instead of the full show.
  quick() {
    G.blackhole = true;
    G.theme = 'horizon';
    applyTheme();
    save();
    this.running = false;
    toast({ icon: GLYPH.sparkle, kicker: 'Event Horizon', title: 'You crossed 1 trillion tokens', text: 'New clicker style unlocked: Event Horizon. Switch styles any time in Options.', kind: 'legend', life: 8000 });
  },
  size() {
    const r = dpr();
    this.W = innerWidth;
    this.H = innerHeight;
    this.cv.width = Math.round(this.W * r);
    this.cv.height = Math.round(this.H * r);
    this.ctx.setTransform(r, 0, 0, r, 0, 0);
  },
  // Every building type you own falls in; bigger collections send more icons, in their gold or rainbow look.
  buildItems() {
    this.items = [];
    this.total = totalOwned();
    for (let i = 0; i < N; i++) {
      const n = G.owned[i];
      if (!n) continue;
      const k = clamp(Math.ceil(Math.log2(n + 1) * 2.5), 2, 16);
      const spr = n >= RAINBOW_AT ? Workspace.rbLaneSprite(i, 0) : n >= HAND_GROUP_AT ? Workspace.bigSprite(i) : Workspace.sprite(i);
      for (let j = 0; j < k; j++) this.items.push({ spr, worth: n / k, size: n >= HAND_GROUP_AT ? 46 : 34 });
    }
    // Nothing owned yet? Throw some sparkles in so the show still has something to swallow.
    if (!this.items.length) for (let j = 0; j < 20; j++) this.items.push({ spr: makeSprite(GLYPH.sparkle, 30), worth: 0, size: 30 });
    if (this.items.length > 220) this.items = this.items.sort(() => Math.random() - 0.5).slice(0, 220);
    const [a, b] = BH.fall;
    for (const it of this.items) {
      it.dur = rand(2.2, 3.6);
      it.start = a + Math.random() * (b - it.dur - a);
      it.a0 = Math.random() * Math.PI * 2;
      it.spin = rand(-4, 4);
      it.done = false;
    }
  },
  newStar(anywhere) {
    const maxR = Math.hypot(this.W, this.H) / 2 + 30;
    return { a: Math.random() * Math.PI * 2, r: anywhere ? rand(40, maxR) : maxR, v: rand(30, 90), s: rand(0.6, 1.8) };
  },
  // Black hole radius over the timeline.
  holeR(t) {
    const full = Math.min(this.W, this.H) * 0.15;
    if (t < BH.collapse) return 6 + (t / BH.collapse) * full * 0.3;
    if (t < BH.fall[0]) return full * (0.3 + 0.7 * ((t - BH.collapse) / (BH.fall[0] - BH.collapse)));
    if (t < BH.fall[1]) return full * (1 + Math.sin(t * 2) * 0.02);
    if (t < BH.flash) return Math.max(3, full * (1 - Math.pow((t - BH.fall[1]) / (BH.flash - BH.fall[1]), 0.7)));
    return 0;
  },
  // The real page panels spin and shrink into the hole, then fly back out after the flash.
  panels() {
    return ['.topbar', '#paneRight', '#paneMid', '#paneLeft', '#mobileNav']
      .map(s => document.querySelector(s)).filter(el => el && el.getClientRects().length);
  },
  suck() {
    const cx = innerWidth / 2, cy = innerHeight / 2;
    this.panels().forEach((el, k) => {
      const r = el.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      const spin = (k % 2 ? -1 : 1) * rand(260, 460);
      el.style.transition = `transform 1.9s cubic-bezier(.6,0,.85,.35) ${k * 0.16}s, opacity 1.9s ease-in ${k * 0.16}s`;
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(.02)`;
      el.style.opacity = '0';
    });
  },
  unsuck() {
    this.panels().forEach((el, k) => {
      el.style.transition = `transform 1.3s cubic-bezier(.15,.75,.25,1) ${k * 0.08}s, opacity .7s ease-out ${k * 0.08}s`;
      el.style.transform = '';
      el.style.opacity = '';
    });
    setTimeout(() => this.panels().forEach(el => { el.style.transition = ''; }), 2200);
  },
  setCaption(text) {
    if (this.caption.textContent !== text) this.caption.textContent = text;
  },
  tick(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    try {
      this.step(dt);
    } catch (e) {
      console.error('Black hole event failed:', e);
      this.t = BH.end;
    }
    if (this.t >= BH.end) return this.finish();
    this.raf = requestAnimationFrame(n => this.tick(n));
  },
  step(dt) {
    const t = (this.t += dt), c = this.ctx, W = this.W, H = this.H, cx = W / 2, cy = H / 2;
    Stage.collapse = clamp(t / BH.collapse, 0, 1) * (t < BH.flash ? 1 : 0);
    if (!this.sucked && t >= BH.suck) { this.sucked = true; this.suck(); }
    if (t >= BH.fall[0]) document.getElementById('app').classList.remove('bh-shake');

    // Background goes black while the page is inside the hole, then clears after the flash.
    let bg = 0;
    if (t >= BH.black[0] && t < BH.fade[0]) bg = clamp((t - BH.black[0]) / (BH.black[1] - BH.black[0]), 0, 1);
    else if (t >= BH.fade[0]) bg = 1 - clamp((t - BH.fade[0]) / (BH.fade[1] - BH.fade[0]), 0, 1);
    this.ov.style.background = `rgba(4,4,6,${bg})`;
    this.ov.classList.toggle('tab-on', t >= BH.fall[0] - 0.2 && t < BH.flash + 0.8);

    c.clearRect(0, 0, W, H);
    const R = this.holeR(t);

    // Vignette closing in during the collapse.
    if (t < BH.black[1]) {
      const v = c.createRadialGradient(cx, cy, Math.min(W, H) * (0.6 - 0.4 * clamp(t / BH.collapse, 0, 1)), cx, cy, Math.hypot(W, H) / 2);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${0.75 * clamp(t / BH.collapse, 0, 1)})`);
      c.fillStyle = v;
      c.fillRect(0, 0, W, H);
    }

    // Stars streaming inward while the tab is open.
    if (bg > 0.05 && t < BH.flash) {
      c.fillStyle = '#E9E6E1';
      for (const s of this.stars) {
        s.r -= s.v * dt * (1 + 120 / Math.max(20, s.r));
        if (s.r < R + 2) Object.assign(s, this.newStar(false));
        c.globalAlpha = bg * clamp((s.r - R) / 120, 0, 0.9);
        c.fillRect(cx + Math.cos(s.a) * s.r, cy + Math.sin(s.a) * s.r, s.s, s.s);
      }
      c.globalAlpha = 1;
    }

    if (R > 0) this.drawHole(c, cx, cy, R, t, 'back');

    // Buildings spiral in, stretching toward the hole, and vanish past the horizon.
    if (t >= BH.fall[0] && t < BH.flash) {
      const maxR = Math.hypot(W, H) / 2 + 60;
      for (const it of this.items) {
        const e = (t - it.start) / it.dur;
        if (e < 0 || it.done) continue;
        if (e >= 1) { it.done = true; this.consumed += it.worth; this.rings.push({ x: cx, y: cy, life: 0, r0: R }); continue; }
        const r = R * 0.6 + (maxR - R * 0.6) * Math.pow(1 - e, 1.6);
        const a = it.a0 + e * e * 7;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const sc = 1 - e * 0.85;
        c.save();
        c.translate(x, y);
        c.rotate(a);
        c.scale(1 + e * 1.6, 1 - e * 0.55); // tidal stretch toward the hole
        c.rotate(it.spin * e);
        c.globalAlpha = r < R ? 0 : 1;
        c.drawImage(it.spr, -it.size * sc / 2, -it.size * sc / 2, it.size * sc, it.size * sc);
        c.restore();
      }
      c.globalAlpha = 1;
    }

    if (R > 0) this.drawHole(c, cx, cy, R, t, 'front');

    // Little orange pulses on the photon ring each time something falls in.
    this.rings = this.rings.filter(g => (g.life += dt) < 0.5);
    for (const g of this.rings) {
      if (g.big) continue;
      c.globalAlpha = 1 - g.life / 0.5;
      c.strokeStyle = '#FFB070';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(g.x, g.y, g.r0 * (1.05 + g.life * 0.6), 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;

    // The flash: switch styles, bring the page back, and blow everything back out.
    if (!this.returned && t >= BH.flash) {
      this.returned = true;
      this.flashEl.classList.add('go');
      G.blackhole = true;
      G.theme = 'horizon';
      applyTheme();
      Stage.collapse = 0;
      this.unsuck();
      Sound.boom();
      for (const it of this.items.slice(0, 180)) {
        const a = Math.random() * Math.PI * 2, v = rand(250, 950);
        this.burst.push({ spr: it.spr, size: it.size, x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: 0, vr: rand(-8, 8), life: 0, max: rand(1.6, 2.6) });
      }
      for (let k = 0; k < 4; k++) this.rings.push({ x: cx, y: cy, life: -k * 0.12, r0: 30 + k * 40, big: true });
    }
    if (this.burst.length) {
      this.burst = this.burst.filter(p => (p.life += dt) < p.max);
      for (const p of this.burst) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.rot += p.vr * dt;
        c.save();
        c.globalAlpha = 1 - p.life / p.max;
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.drawImage(p.spr, -p.size / 2, -p.size / 2, p.size, p.size);
        c.restore();
      }
      c.globalAlpha = 1;
    }
    for (const g of this.rings.filter(g => g.big && g.life > 0)) {
      c.globalAlpha = Math.max(0, 1 - g.life / 0.5);
      c.strokeStyle = '#FF7A1A';
      c.lineWidth = 6;
      c.beginPath();
      c.arc(g.x, g.y, g.r0 + g.life * Math.max(W, H) * 1.6, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;

    const total = this.total.toLocaleString('en-US');
    this.count.textContent = `${Math.min(this.total, Math.round(this.consumed)).toLocaleString('en-US')} of ${total} buildings consumed`;
    this.setCaption(
      t < BH.suck ? 'The sparkle is collapsing under its own weight…'
        : t < BH.fall[0] ? 'Everything is falling in.'
          : t < BH.fall[1] ? 'Event horizon reached. Your whole workspace is falling into the singularity.'
            : t < BH.flash ? 'Critical mass…'
              : '…and it all comes back out.');
  },
  drawHole(c, cx, cy, R, t, layer) {
    c.save();
    c.translate(cx, cy);
    if (layer === 'back') {
      const glow = c.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 3.4);
      glow.addColorStop(0, 'rgba(255,122,26,.55)');
      glow.addColorStop(0.4, 'rgba(255,122,26,.14)');
      glow.addColorStop(1, 'rgba(255,122,26,0)');
      c.fillStyle = glow;
      c.fillRect(-R * 3.4, -R * 3.4, R * 6.8, R * 6.8);
      c.rotate(-0.28);
      c.lineCap = 'butt';
      for (const [k, w, a] of [[2.7, 0.55, 0.35], [2.1, 0.3, 0.6], [1.6, 0.14, 0.9]]) {
        c.strokeStyle = `rgba(255,${110 + k * 25 | 0},40,${a})`;
        c.lineWidth = R * w;
        c.setLineDash([R * 1.1, R * 0.09, R * 0.4, R * 0.06]);
        c.lineDashOffset = -t * R * (2.2 / k);
        c.beginPath();
        c.ellipse(0, 0, R * k, R * k * 0.27, 0, Math.PI, Math.PI * 2); // far half of the disk, behind the hole
        c.stroke();
      }
    } else {
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(0, 0, R, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#FFB070';
      c.lineWidth = Math.max(1.5, R * 0.05);
      c.shadowColor = 'rgba(255,140,40,1)';
      c.shadowBlur = R * 0.4;
      c.stroke();
      c.shadowBlur = 0;
      c.rotate(-0.28);
      c.lineCap = 'butt';
      for (const [k, w, a] of [[2.7, 0.55, 0.35], [2.1, 0.3, 0.6], [1.6, 0.14, 0.9]]) {
        c.strokeStyle = `rgba(255,${110 + k * 25 | 0},40,${a})`;
        c.lineWidth = R * w;
        c.setLineDash([R * 1.1, R * 0.09, R * 0.4, R * 0.06]);
        c.lineDashOffset = -t * R * (2.2 / k);
        c.beginPath();
        c.ellipse(0, 0, R * k, R * k * 0.27, 0, 0, Math.PI); // near half, in front of the hole
        c.stroke();
      }
    }
    c.restore();
  },
  finish() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    document.getElementById('app').classList.remove('bh-shake');
    document.body.classList.remove('bh-running');
    Stage.collapse = 0;
    if (!this.returned) { G.blackhole = true; G.theme = 'horizon'; applyTheme(); this.unsuck(); }
    const ov = this.ov;
    ov.classList.add('done');
    setTimeout(() => ov.remove(), 600);
    this.running = false;
    save();
    toast({ icon: GLYPH.sparkle, kicker: 'Event Horizon', title: 'You crossed 1 trillion tokens', text: 'New clicker style unlocked: Event Horizon. Switch styles any time in Options.', kind: 'legend', life: 9000 });
  },
};

// Applies the saved clicker style to the page.
function applyTheme() {
  document.body.classList.toggle('theme-horizon', G.theme === 'horizon');
  if (typeof Stage !== 'undefined' && Stage.cv) Stage.resize();
}
