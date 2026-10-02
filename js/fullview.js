'use strict';
/* Claude Code Clicker: the full-screen view. The sparkle fills the screen and every building you own sets up a
   workstation around it: its crew hops at work, beams tokens into the sparkle, and shows what each work cycle made.
   Autocompletes stay as the hands circling the sparkle. */

const CITY_CYCLE = 3; // seconds per work cycle
const CITY_KINDS = [30, BIG_LANE_ICON, RB_LANE_ICON, DIA_LANE_ICON]; // icon size per tier: single, gold, black hole, diamond

const City = {
  sig: '', st: [], motes: [], pops: [],
  // Lay the workstations out on an ellipse around the sparkle, clear of the counter at the top and the bar at the bottom.
  layout(S) {
    const list = [];
    for (let i = 1; i < N; i++) if (G.owned[i] > 0) list.push(i);
    const sig = `${list.join()}|${S.w}|${S.h}|${S.R}`;
    if (sig === this.sig) return this.st;
    this.sig = sig;
    const n = list.length, top = 124, bottom = S.h - 50;
    const rx0 = S.w / 2 - 70, ry0 = Math.min(S.cy - top, bottom - S.cy) - 40;
    const per = 2 * Math.PI * Math.sqrt((rx0 * rx0 + ry0 * ry0) / 2);
    const size = clamp((per / Math.max(n, 1)) * 0.9, 70, 150), k = size / 140;
    const rx = Math.max(40, S.w / 2 - size * 0.55), ry = Math.max(40, Math.min(S.cy - top - 34 * k, bottom - S.cy - 46 * k - 30));
    const old = new Map(this.st.map(s => [s.i, s]));
    // Space the stations evenly by distance along the ellipse (equal angles would bunch them up at the narrow ends).
    const STEPS = 720, cum = [0];
    for (let q = 1; q <= STEPS; q++) {
      const a0 = ((q - 1) / STEPS) * Math.PI * 2, a1 = (q / STEPS) * Math.PI * 2;
      cum.push(cum[q - 1] + Math.hypot(rx * (Math.cos(a1) - Math.cos(a0)), ry * (Math.sin(a1) - Math.sin(a0))));
    }
    const angleAt = f => {
      const want = f * cum[STEPS];
      let q = 1;
      while (q < STEPS && cum[q] < want) q++;
      const u = (want - cum[q - 1]) / ((cum[q] - cum[q - 1]) || 1);
      return ((q - 1 + u) / STEPS) * Math.PI * 2;
    };
    this.st = list.map((i, j) => {
      const a = angleAt((0.75 + j / n) % 1); // three quarters round from the right is the top
      const prev = old.get(i);
      return { i, a, x: S.cx + Math.cos(a) * rx, y: S.cy + Math.sin(a) * ry, k, emit: prev ? prev.emit : Math.random(), phase: prev ? prev.phase : hash(i) };
    });
    this.rx = rx; this.ry = ry;
    return this.st;
  },
  // Which icons a station shows: the highest tiers first, like the workspace lanes, capped to fit.
  crew(n, cap) {
    let dia = 0, rb = 0, big = 0, small = n;
    if (n >= HAND_GROUP_AT) {
      let rest = n;
      if (n >= DIAMOND_AT) { dia = Math.floor(rest / DIAMOND_GROUP); rest %= DIAMOND_GROUP; }
      if (n >= RAINBOW_AT) { rb = Math.floor(rest / RAINBOW_GROUP); rest %= RAINBOW_GROUP; }
      big = Math.floor(rest / HAND_GROUP);
      small = rest % HAND_GROUP;
    }
    const out = [];
    for (const [kind, cnt] of [[3, dia], [2, rb], [1, big], [0, small]]) for (let j = 0; j < cnt && out.length < cap; j++) out.push(kind);
    return out;
  },
  sprite(i, kind, f) {
    return kind === 3 ? Workspace.diaLaneSprite(i, f) : kind === 2 ? Workspace.rbLaneSprite(i, f) : kind === 1 ? Workspace.bigSprite(i) : Workspace.sprite(i);
  },
  rate(i) { return (G.owned[i] - awayOf(i)) * D.each[i] * D.mult * D.buffProd; },
  draw(S, dt, t, still) {
    const st = this.layout(S), c = S.ctx;
    if (!st.length) {
      c.font = "500 12px 'Martian Mono', ui-monospace, monospace";
      c.textAlign = 'center';
      c.fillStyle = 'rgba(243,233,223,.45)';
      c.fillText('Buy buildings and they will set up shop around the sparkle.', S.cx, Math.min(S.h - 70, S.cy + S.R * 2.6));
      return;
    }
    const horizon = isHorizon(), frame = Math.floor(t * 8) % RB_FRAMES;
    // The ring road joining every workstation.
    c.save();
    c.strokeStyle = horizon ? 'rgba(255,122,26,.1)' : 'rgba(243,233,223,.07)';
    c.lineWidth = 2;
    c.setLineDash([3, 9]);
    c.lineDashOffset = still ? 0 : t * 12;
    c.beginPath();
    c.ellipse(S.cx, S.cy, this.rx, this.ry, 0, 0, Math.PI * 2);
    c.stroke();
    // Data links from each station into the sparkle, with dashes streaming inward.
    c.setLineDash([6, 10]);
    c.lineDashOffset = still ? 0 : -t * 40;
    for (const s of st) {
      c.strokeStyle = hexA(BUILDINGS[s.i].color, 0.22);
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.lineTo(S.cx + Math.cos(s.a) * S.R * 1.05, S.cy + Math.sin(s.a) * S.R * 1.05);
      c.stroke();
    }
    c.restore();

    this.drawMotes(S, dt, still);

    for (const s of st) {
      const b = BUILDINGS[s.i], n = G.owned[s.i], k = s.k, rate = this.rate(s.i);
      // Glow and platform.
      const gr = c.createRadialGradient(s.x, s.y, 4, s.x, s.y, 70 * k);
      gr.addColorStop(0, hexA(b.color, 0.24));
      gr.addColorStop(1, hexA(b.color, 0));
      c.fillStyle = gr;
      c.fillRect(s.x - 70 * k, s.y - 70 * k, 140 * k, 140 * k);
      c.fillStyle = hexA(b.color, 0.14);
      c.strokeStyle = hexA(b.color, 0.6);
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(s.x, s.y + 22 * k, 56 * k, 14 * k, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // The crew: a back row and a front row, each icon hopping as it works.
      const crew = this.crew(n, k < 0.7 ? 5 : 7), m = crew.length;
      const spots = crew.map((kind, j) => {
        const row = m > 3 && j % 2 ? 1 : 0;
        const col = m > 3 ? Math.floor(j / 2) - (Math.ceil(m / 2) - 1) / 2 + (row ? 0.5 : 0) : j - (m - 1) / 2;
        return { kind, j, x: s.x + col * 30 * k, y: s.y + (row ? 10 : -4) * k - (m > 3 ? 0 : 3 * k) };
      }).sort((p, q) => p.y - q.y);
      for (const p of spots) {
        const base = CITY_KINDS[p.kind] * k * (p.kind ? 0.82 : 1);
        const hop = still ? 0 : Math.pow(Math.max(0, Math.sin(t * 3.1 + p.j * 1.9 + s.i)), 10) * 8 * k;
        const tilt = still ? 0 : Math.sin(t * 6.2 + p.j * 1.9 + s.i) * 0.06;
        c.save();
        c.translate(p.x, p.y - hop);
        c.rotate(tilt);
        c.drawImage(this.sprite(s.i, p.kind, (frame + p.j) % RB_FRAMES), -base / 2, -base * 0.62, base, base);
        c.restore();
      }

      // Work cycle: the bar fills, then the station reports what it made and fires a burst at the sparkle.
      const before = s.phase;
      if (!still) s.phase = (s.phase + dt / CITY_CYCLE) % 1;
      if (!still && s.phase < before && rate > 0) {
        this.pops.push({ x: s.x, y: s.y - 34 * k, text: '+' + fmt(rate * CITY_CYCLE), col: b.color, life: 0 });
        for (let q = 0; q < 3; q++) this.mote(S, s, q * 0.08);
      }
      // Steady stream of tokens: more for bigger crews.
      if (!still && rate > 0) {
        s.emit += dt * Math.min(4, 0.5 + Math.log10(n + 1));
        while (s.emit >= 1) { s.emit -= 1; this.mote(S, s, 0); }
      }

      // Label: name and count, rate, and the cycle bar.
      const fs = clamp(10.5 * k + 2, 9, 12);
      c.font = `600 ${fs}px 'Martian Mono', ui-monospace, monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const label = `${n === 1 ? b.name : b.plural} × ${n.toLocaleString('en-US')}`, lw = c.measureText(label).width;
      const ly = s.y + 46 * k;
      c.fillStyle = horizon ? 'rgba(8,8,10,.8)' : 'rgba(19,13,16,.8)';
      c.beginPath();
      c.roundRect ? c.roundRect(s.x - lw / 2 - 8, ly - fs * 0.85, lw + 16, fs * 3.4, 6) : c.rect(s.x - lw / 2 - 8, ly - fs * 0.85, lw + 16, fs * 3.4);
      c.fill();
      c.fillStyle = '#F3E9DF';
      c.fillText(label, s.x, ly);
      c.fillStyle = b.color;
      const away = awayOf(s.i);
      c.fillText(`${fmt(rate)}/s${away ? ` · ${away} away` : ''}`, s.x, ly + fs * 1.25);
      const bw = Math.max(40, lw * 0.7);
      c.fillStyle = 'rgba(243,233,223,.12)';
      c.fillRect(s.x - bw / 2, ly + fs * 2.05, bw, 3);
      c.fillStyle = b.color;
      c.fillRect(s.x - bw / 2, ly + fs * 2.05, bw * (still ? 1 : s.phase), 3);
    }
    this.drawPops(c, dt);
  },
  // A token flying from a station into the sparkle along a gentle curve.
  mote(S, s, delay) {
    if (this.motes.length > 320) return;
    const k = s.k, sx = s.x + rand(-24, 24) * k, sy = s.y - rand(4, 20) * k;
    const dx = S.cx - sx, dy = S.cy - sy, bend = rand(-0.35, 0.35);
    this.motes.push({ sx, sy, qx: (sx + S.cx) / 2 - dy * bend, qy: (sy + S.cy) / 2 + dx * bend, life: -delay, dur: rand(0.9, 1.4), col: BUILDINGS[s.i].color, r: rand(1.8, 3) * Math.max(0.8, k) });
  },
  drawMotes(S, dt, still) {
    const c = S.ctx, ex = S.cx, ey = S.cy;
    const at = (m, u) => {
      const v = 1 - u;
      return [v * v * m.sx + 2 * v * u * m.qx + u * u * ex, v * v * m.sy + 2 * v * u * m.qy + u * u * ey];
    };
    this.motes = still ? [] : this.motes.filter(m => (m.life += dt) < m.dur);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      if (m.life < 0) continue;
      const u = m.life / m.dur, ease = u * u * (3 - 2 * u);
      // Fade out as it sinks into the sparkle.
      const fade = Math.min(1, u * 6) * (1 - Math.max(0, (u - 0.8) / 0.2));
      for (let q = 3; q >= 0; q--) {
        const [x, y] = at(m, Math.max(0, ease - q * 0.035));
        c.globalAlpha = fade * (q ? 0.18 * (4 - q) : 0.95);
        c.fillStyle = q ? m.col : '#FFF4E6';
        c.beginPath();
        c.arc(x, y, m.r * (q ? 1.3 : 0.75), 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  },
  drawPops(c, dt) {
    this.pops = this.pops.filter(p => (p.life += dt) < 1.4);
    if (this.pops.length > 40) this.pops.splice(0, this.pops.length - 40);
    c.font = "600 11px 'Martian Mono', ui-monospace, monospace";
    c.textAlign = 'center';
    for (const p of this.pops) {
      c.globalAlpha = 1 - p.life / 1.4;
      c.fillStyle = p.col;
      c.fillText(p.text, p.x, p.y - p.life * 22);
    }
    c.globalAlpha = 1;
  },
};

const FullView = {
  on: false, api: false,
  init() {
    this.btn = $('#btnFull');
    this.btn.addEventListener('click', () => (this.on ? this.exit() : this.enter()));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.on) this.exit(); });
    // Leaving the browser's own full screen (Esc, F11) closes the view too.
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && this.on && this.api) { this.api = false; this.exit(); } });
  },
  enter() {
    if (typeof BlackHole !== 'undefined' && BlackHole.running) return;
    this.on = true;
    document.body.classList.add('full-view');
    this.label();
    Tip.hide();
    // Ask for real full screen too; inside a frame that may be refused, and the view still fills the window.
    try {
      const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      if (p && p.then) { this.api = true; p.catch(() => { this.api = false; }); }
    } catch (e) { this.api = false; }
    City.sig = '';
    Stage.resize();
    $('#stage').focus({ preventScroll: true });
  },
  exit() {
    if (!this.on) return;
    this.on = false;
    document.body.classList.remove('full-view');
    this.label();
    if (this.api && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.api = false;
    City.motes.length = 0;
    City.pops.length = 0;
    Stage.resize();
  },
  label() {
    this.btn.setAttribute('aria-pressed', String(this.on));
    this.btn.innerHTML = this.on ? '<span aria-hidden="true">✕</span> Exit full screen' : '<span aria-hidden="true">⛶</span> Full screen';
    this.btn.title = this.on ? 'Back to the normal layout (Esc)' : 'Watch every building you own work around the sparkle';
  },
};
