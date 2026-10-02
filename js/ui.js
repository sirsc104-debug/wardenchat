'use strict';
/* Claude Code Clicker: DOM interface (store, tooltips, toasts, eureka tokens, bugs, ticker, spinner, sound). */

const $ = (s, root = document) => root.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function svgIcon(parts, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 32 32" aria-hidden="true">${parts.map(p =>
    `<path d="${p.d}" fill="${p.f || 'none'}"${p.s ? ` stroke="${p.s}" stroke-width="${p.w || 1.5}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`).join('')}</svg>`;
}
const iconParts = ic => (ic.b != null ? BUILDINGS[ic.b].icon : GLYPH[ic.g]);
function upgIcon(u) {
  const t = u.icon.tier;
  return svgIcon(iconParts(u.icon)) + (t != null ? `<span class="tier" style="--tc:${TIERS[t].col}"></span>` : '');
}
const TK = '<span class="tk" aria-hidden="true">✻</span>';

// How each rarity tier of Eureka token looks: 1 = common gold, 2 = rare ice-blue, 3 = legendary violet and gold.
const EUREKA_GLYPH = {
  1: GLYPH.gold,
  2: [{ d: GLYPH.gold[0].d, s: '#9FE3FF', w: 3.1 }, { d: C(16, 16, 3.4), f: '#F2FBFF' }],
  3: [{ d: GLYPH.gold[0].d, s: '#E2A6FF', w: 3.4 }, { d: C(16, 16, 4.2), f: '#F2C57C' }],
};
const EUREKA_COLOR = { 1: '#F2C57C', 2: '#9FE3FF', 3: '#E2A6FF' };

// Gold pointer skins: [icon parts, hotspot x, hotspot y, fallback cursor].
const GOLD_INK = '#4A2F10', GOLD_FILL = '#F2C57C';
const goldLine = (d, w) => [{ d, s: GOLD_INK, w: w + 2.4 }, { d, s: GOLD_FILL, w }];
const GOLD_ARROW = { d: 'M6 3L6 25L11.5 20L15.5 28.5L19 27L15 18.5L22 18.5Z', f: GOLD_FILL, s: GOLD_INK, w: 1.6 };
const GOLD_SKINS = {
  arrow: [[GOLD_ARROW], 6, 3, 'default'],
  hand: [BIG_HAND, 12, 2, 'pointer'],
  text: [goldLine('M11.5 5.5H20.5M16 5.5V26.5M11.5 26.5H20.5', 2.4), 16, 16, 'text'],
  noentry: [[...goldLine(C(16, 16, 10), 3), ...goldLine('M9 23L23 9', 3)], 16, 16, 'not-allowed'],
  crosshair: [[...goldLine('M16 3V11M16 21V29M3 16H11M21 16H29', 2.2), ...goldLine(C(16, 16, 5.5), 2)], 16, 16, 'crosshair'],
  help: [[{ ...GOLD_ARROW, d: 'M4 2L4 20L8.5 16L11.5 22.5L14 21.5L11 15L16.5 15Z' },
    { d: C(23.5, 23.5, 7), f: GOLD_FILL, s: GOLD_INK, w: 1.4 },
    { d: 'M21.2 21.8C21.2 19.6 25.8 19.6 25.8 21.9C25.8 23.6 23.5 23.6 23.5 25.4', s: GOLD_INK, w: 1.6 },
    { d: C(23.5, 27.8, 0.8), f: GOLD_INK }], 4, 2, 'help'],
};

// ---------- sound (synthesised, off by default) ----------
const Sound = {
  ctx: null,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  tone(f, dur, { type = 'sine', vol = 0.05, at = 0, to = 0 } = {}) {
    if (!G.settings.sound) return;
    const c = this.ensure();
    if (!c) return;
    const t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },
  click() { this.tone(420 + Math.random() * 80, 0.07, { type: 'triangle', vol: 0.05, to: 720 }); },
  buy() { this.tone(660, 0.08, { type: 'square', vol: 0.02 }); this.tone(990, 0.1, { type: 'square', vol: 0.018, at: 0.06 }); },
  ach() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, { vol: 0.04, at: i * 0.07 })); },
  eureka() { [1318, 1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.28, { vol: 0.025, at: i * 0.05 })); },
  legendary() { [784, 1175, 1568, 2349, 3136].forEach((f, i) => this.tone(f, 0.4, { vol: 0.022, at: i * 0.07 })); },
  pop() { this.tone(880 + Math.random() * 200, 0.09, { type: 'sine', vol: 0.05, to: 1500 }); },
  rumble() { this.tone(70, 2.4, { type: 'sawtooth', vol: 0.05, to: 28 }); this.tone(110, 2.2, { type: 'triangle', vol: 0.03, at: 0.3, to: 40 }); },
  boom() { this.tone(90, 1.2, { type: 'sawtooth', vol: 0.07, to: 30 }); [523, 784, 1047, 1568].forEach((f, i) => this.tone(f, 0.6, { vol: 0.03, at: 0.1 + i * 0.08 })); },
  squash() { this.tone(200, 0.16, { type: 'sawtooth', vol: 0.035, to: 55 }); },
  fail() { this.tone(240, 0.3, { type: 'sawtooth', vol: 0.03, to: 110 }); },
};

// ---------- tooltip ----------
const Tip = {
  init() { this.el = $('#tooltip'); this.anchor = null; this.fn = null; },
  show(anchor, fn) {
    this.anchor = anchor;
    this.fn = fn;
    this.el.innerHTML = fn();
    this.el.hidden = false;
    this.place();
  },
  refresh() {
    if (!this.anchor) return;
    if (!this.anchor.isConnected) return this.hide();
    this.el.innerHTML = this.fn();
    this.place();
  },
  place() {
    const r = this.anchor.getBoundingClientRect(), t = this.el.getBoundingClientRect();
    const W = innerWidth, H = innerHeight, gap = 12;
    let x, y;
    if (r.left - t.width - gap >= 8) x = r.left - t.width - gap;
    else if (r.right + t.width + gap <= W - 8) x = r.right + gap;
    if (x != null) {
      y = clamp(r.top + r.height / 2 - t.height / 2, 8, H - t.height - 8);
    } else {
      x = clamp(r.left, 8, W - t.width - 8);
      y = r.bottom + gap + t.height <= H - 8 ? r.bottom + gap : Math.max(8, r.top - gap - t.height);
    }
    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
  },
  hide() { this.el.hidden = true; this.anchor = null; this.fn = null; },
};
// Hover tooltips for mouse; touch taps show them briefly.
function bindTips(container, selector, contentFor) {
  container.addEventListener('mouseover', e => {
    const el = e.target.closest(selector);
    if (el && container.contains(el) && Tip.anchor !== el) Tip.show(el, () => contentFor(el));
  });
  container.addEventListener('mouseout', e => {
    const el = e.target.closest(selector);
    if (el && !el.contains(e.relatedTarget)) Tip.hide();
  });
  container.addEventListener('focusin', e => {
    const el = e.target.closest(selector);
    if (el) Tip.show(el, () => contentFor(el));
  });
  container.addEventListener('focusout', () => Tip.hide());
}
let touchTipTimer = 0;
function flashTip(el, fn) {
  Tip.show(el, fn);
  clearTimeout(touchTipTimer);
  touchTipTimer = setTimeout(() => Tip.hide(), 2600);
}

const effectDesc = b => b.desc || (EUREKA.find(e => e.id === b.key) || {}).desc || '';
function buffTip(key) {
  const b = G.buffs.find(x => x.key === key);
  if (!b) return '';
  const bad = b.prod < 1 || b.bad;
  return tipHead(svgIcon(bad ? GLYPH.bug : GLYPH.gold), b.name, `${bad ? 'Bad effect' : 'Active effect'} · ${Math.ceil(b.t)}s left`) +
    `<div class="tip-desc">${esc(effectDesc(b))}</div>`;
}
function eurekaTip(id) {
  const e = EUREKA.find(x => x.id === id);
  return tipHead(svgIcon(e.bad ? GLYPH.bug : GLYPH.gold), e.name, `Eureka effect · ${e.w}% chance`) + `<div class="tip-desc">${esc(e.desc)}</div>`;
}
function flowTip() {
  const pct = Math.round(D.flow * 100), n = G.achievements.size;
  const engineers = UPGRADES.filter(u => u.kind === 'flow' && G.upgrades.has(u.id)).length;
  const every = Math.round(clamp(45 / (1 + D.flow), 6, 45));
  return tipHead(svgIcon(GLYPH.people), `Flow ${pct}%`, `${n} achievement${n === 1 ? '' : 's'} × 4% each`) +
    `<div class="tip-desc">Flow is the tide under the sparkle. It rises with every achievement you unlock.</div>` +
    `<div class="tip-stats">Production <b>+${+(D.flowBonus * 100).toFixed(1)}%</b> (0.25% per 1% Flow).<br>` +
    (engineers ? `Engineer upgrades (${engineers}) multiply that by <b>×${D.flowMult.toFixed(2)}</b>.<br>` : 'Engineer upgrades in the Store turn Flow into even more production.<br>') +
    (pct ? `A Flow bubble rises about every <b>${every}s</b>. Pop it for <b>${fmt(bubbleValue())}</b> tokens.` : 'Unlock an achievement to start Flow bubbles rising.') + '</div>';
}
function tipHead(icon, name, tag, cost, can) {
  return `<div class="tip-head">${icon}<div><div class="tip-name">${esc(name)}</div><div class="tip-tag">${tag}</div></div>` +
    (cost != null ? `<div class="tip-cost ${can ? '' : 'no'}">${TK}${fmt(cost)}</div>` : '') + '</div>';
}
function upgTip(u) {
  const cost = upgCost(u);
  return tipHead(upgIcon(u), u.name, `Upgrade · ${u.req}`, cost, G.tokens >= cost) +
    `<div class="tip-desc">${u.desc}</div>` + (u.q ? `<div class="tip-quote">“${esc(u.q)}”</div>` : '');
}
function bldTip(i) {
  const b = BUILDINGS[i], n = G.owned[i], sell = UI.mode === 'sell', amt = UI.amt;
  const cost = sell ? sellValue(i, amt) : bulkCost(i, amt);
  const each = D.each[i] * D.mult * D.buffProd, total = each * n;
  let stats = '';
  if (n > 0) {
    const share = D.tps > 0 ? (total / D.tps) * 100 : 0;
    stats = `<div class="tip-stats">Each ${esc(b.name)} makes <b>${fmt(each)}</b> tokens/s.<br>` +
      `${n.toLocaleString('en-US')} ${esc(n === 1 ? b.name : b.plural)} make <b>${fmt(total)}</b> tokens/s (<b>${share.toFixed(1)}%</b> of total).<br>` +
      `<b>${fmt(G.producedBy[i])}</b> tokens generated this run.</div>`;
  } else {
    stats = `<div class="tip-stats">Each ${esc(b.name)} makes <b>${fmt(each)}</b> tokens/s.</div>`;
  }
  const tag = `Building · owned ${n.toLocaleString('en-US')}${sell ? ` · sells ${Math.min(amt, n)} for` : amt > 1 ? ` · buy ${amt}` : ''}`;
  const lv = G.levels[i], away = awayOf(i);
  const extra = (lv || away || UI.mode === 'level')
    ? `<div class="tip-stats">${lv ? `Level <b>${lv}</b>: +${lv}% output.<br>` : ''}${away ? `<b>${away}</b> away on missions (not producing).<br>` : ''}` +
      `${UI.mode === 'level' ? `Level up for <b>⚡${levelCost(i)}</b> compute credit${levelCost(i) === 1 ? '' : 's'} (you have ${G.credits}).` : ''}</div>`
    : '';
  return tipHead(svgIcon(b.icon), b.name, tag, UI.mode === 'level' ? null : cost, sell ? n > 0 : G.tokens >= cost) + `<div class="tip-desc">${esc(b.desc)}</div>` + stats + extra;
}

// ---------- toasts ----------
function toast({ icon = GLYPH.sparkle, kicker = '', title, text = '', kind = '', life = 5200 }) {
  const box = $('#toasts'), el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${svgIcon(icon)}<div>${kicker ? `<div class="toast-kicker">${kicker}</div>` : ''}<div class="toast-title">${title}</div>${text ? `<div class="toast-text">${text}</div>` : ''}</div>`;
  const close = () => {
    if (!el.isConnected || el.classList.contains('out')) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  };
  el.addEventListener('click', close);
  box.appendChild(el);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(close, life);
}

// ---------- Eureka tokens and bugs (full-screen effects layer) ----------
const FX = {
  eureka: null, bug: null, chain: 0, hungry: [],
  init() { this.layer = $('#fx'); },
  spawnEureka(force, wantTier) {
    const life = EUREKA_LIFE * D.eurekaLife;
    if (this.eureka && wantTier) this.removeEureka();
    if (this.eureka) { if (force) this.eureka.t = life; return; }
    const eff = wantTier ? eurekaRollTier(wantTier) : eurekaRoll(), tier = eurekaTier(eff);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `eureka t${tier}`;
    el.setAttribute('aria-label', `${EUREKA_TIERS[tier]} Eureka token. Click it before it vanishes.`);
    el.innerHTML = svgIcon(EUREKA_GLYPH[tier]);
    if (tier === 3) Sound.legendary();
    el.style.left = rand(0.1, 0.9) * innerWidth + 'px';
    el.style.top = rand(0.18, 0.82) * innerHeight + 'px';
    el.addEventListener('click', () => {
      if (!this.eureka) return;
      const out = eurekaEffect(eff);
      this.burst(el, EUREKA_COLOR[tier]);
      this.removeEureka();
      Sound.eureka();
      const kicker = out.bad ? 'Eureka backfired' : tier > 1 ? `${EUREKA_TIERS[tier]} Eureka` : 'Eureka';
      toast({ icon: out.bad ? GLYPH.bug : EUREKA_GLYPH[tier], kicker, title: out.title, text: out.text, kind: out.bad ? 'bad' : tier === 3 ? 'legend' : tier === 2 ? 'rare' : 'gold' });
      UI.refreshStore();
      if (this.chain > 0) {
        this.chain--;
        setTimeout(() => this.spawnEureka(true), 700);
      }
    });
    this.layer.appendChild(el);
    this.eureka = { el, t: life };
  },
  removeEureka() {
    if (!this.eureka) return;
    const el = this.eureka.el;
    this.eureka = null;
    el.classList.add('gone');
    setTimeout(() => el.remove(), 250);
  },
  spawnBug(golden) {
    if (this.bug) {
      if (golden) { this.bug.golden = true; this.bug.el.classList.add('golden'); this.bug.t = 0; }
      return;
    }
    const el = document.createElement('button');
    el.type = 'button';
    el.className = golden ? 'bug golden' : 'bug';
    el.setAttribute('aria-label', golden ? 'A golden bug. Squash it for a big bonus.' : 'A bug. Squash it for a bonus.');
    el.innerHTML = svgIcon(GLYPH.bug);
    const fromLeft = Math.random() < 0.5, W = innerWidth, H = innerHeight;
    this.bug = {
      el, t: 0, dur: rand(9, 13), x0: fromLeft ? -40 : W + 40, x1: fromLeft ? W + 40 : -40,
      y: rand(0.25, 0.8) * H, amp: rand(20, 60), freq: rand(1.2, 2.4), golden: !!golden,
    };
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!this.bug) return;
      const golden = this.bug.golden, gain = bugReward(golden);
      this.burst(el, golden ? '#F2C57C' : '#7FB069');
      Sound.squash();
      toast({ icon: golden ? GLYPH.gold : GLYPH.bug, kicker: golden ? 'Golden bug squashed' : 'Bug squashed', title: `+${fmt(gain)} tokens`,
        text: golden ? 'Ten minutes of production, straight from the bug bounty.' : 'One less thing in the issue tracker.', kind: golden ? 'gold' : 'mint', life: 3600 });
      this.bug.el.remove();
      this.bug = null;
    });
    this.layer.appendChild(el);
  },
  // Bug Infestation: bugs pour in from random points on the screen edge and run for the sparkle.
  // Each bug that reaches it clings to the rim and eats 1/9 of production until squashed (no refund).
  sparkleTarget() {
    const cv = Stage.cv;
    if (cv && cv.clientWidth) {
      const r = cv.getBoundingClientRect();
      return { x: r.left + Stage.cx, y: r.top + Stage.cy, ring: Stage.R * 0.82 };
    }
    return { x: innerWidth / 2, y: innerHeight / 2, ring: 70 };
  },
  infestation(n) {
    const W = innerWidth, H = innerHeight, tgt = this.sparkleTarget();
    for (let i = 0; i < n; i++) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'bug hungry';
      el.setAttribute('aria-label', 'A hungry bug heading for the sparkle. Squash it.');
      el.innerHTML = `<span class="bug-body">${svgIcon(GLYPH.bug)}</span>`;
      // A random point just outside one of the four screen edges.
      const side = Math.floor(Math.random() * 4), u = Math.random();
      const x = side === 0 ? u * W : side === 1 ? W + 30 : side === 2 ? u * W : -30;
      const y = side === 0 ? -30 : side === 1 ? u * H : side === 2 ? H + 30 : u * H;
      const b = {
        el, x, y, t: -i * 0.28, state: 'run', speed: rand(120, 175), wob: rand(0, 6),
        slot: Math.atan2(y - tgt.y, x - tgt.x) + rand(-0.35, 0.35), // where on the rim it will cling
      };
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (b.dead) return;
        b.dead = true;
        G.bugsSquashed++;
        this.burst(el, '#E0645C');
        Sound.squash();
        el.remove();
      });
      el.style.transform = `translate(${x}px,${y}px)`;
      this.layer.appendChild(el);
      this.hungry.push(b);
    }
    this.infestTotal = (this.infestTotal || 0) + n;
    this.infestOverlay(true);
  },
  infestOverlay(on) {
    if (!this.redEl) {
      this.redEl = document.createElement('div');
      this.redEl.className = 'infest-overlay';
      this.redEl.innerHTML = '<div class="infest-banner"><span class="infest-title">Bug infestation</span><span class="infest-info"></span></div>';
      document.body.appendChild(this.redEl);
    }
    this.redEl.classList.toggle('on', on);
  },
  updateHungry(dt) {
    const tgt = this.sparkleTarget();
    let eating = 0;
    for (const b of this.hungry) {
      if (b.dead) continue;
      b.t += dt;
      if (b.t < 0) continue;
      if (b.t > INFEST_TIME && b.state !== 'flee') { b.state = 'flee'; b.el.classList.remove('eating'); }
      let ang;
      if (b.state === 'eat') {
        eating++;
        const a = b.slot + Math.sin(b.t * 7 + b.wob) * 0.04;
        b.x = tgt.x + Math.cos(a) * tgt.ring;
        b.y = tgt.y + Math.sin(a) * tgt.ring;
        ang = a + Math.PI * 1.5; // head toward the centre of the sparkle
      } else {
        const gx = b.state === 'flee' ? b.x + (b.x - tgt.x) : tgt.x + Math.cos(b.slot) * tgt.ring;
        const gy = b.state === 'flee' ? b.y + (b.y - tgt.y) : tgt.y + Math.sin(b.slot) * tgt.ring;
        const dx = gx - b.x, dy = gy - b.y, d = Math.hypot(dx, dy) || 1;
        const zig = Math.sin(b.t * 9 + b.wob) * 0.45; // scurrying zig-zag
        const vx = dx / d, vy = dy / d, step = Math.min(d, b.speed * (b.state === 'flee' ? 1.4 : 1) * dt);
        b.x += (vx - vy * zig) * step;
        b.y += (vy + vx * zig) * step;
        ang = Math.atan2(vy, vx) + Math.PI / 2;
        if (b.state === 'run' && d < 4) { b.state = 'eat'; b.el.classList.add('eating'); }
        if (b.state === 'flee' && (b.x < -60 || b.y < -60 || b.x > innerWidth + 60 || b.y > innerHeight + 60)) { b.dead = true; b.el.remove(); }
      }
      b.el.style.transform = `translate(${b.x}px,${b.y}px)`;
      b.el.firstElementChild.style.transform = `rotate(${ang}rad)`;
    }
    this.hungry = this.hungry.filter(b => !b.dead);
    setBugsEating(eating);
    const left = this.hungry.length;
    if (!left) {
      this.infestTotal = 0;
      this.infestOverlay(false);
      if (G.buffs.some(b => b.key === 'infest')) { G.buffs = G.buffs.filter(b => b.key !== 'infest'); recompute(); }
      return;
    }
    const info = this.redEl.querySelector('.infest-info');
    const text = `${left} bug${left === 1 ? '' : 's'} loose · ${eating} eating · ${fmt(D.tps)}/s`;
    if (info.textContent !== text) info.textContent = text;
    this.redEl.classList.toggle('severe', eating >= INFEST_ZERO_AT);
  },
  // Token Rain: golden tokens fall down the screen; each one caught is worth 20 seconds of production.
  tokenRain(n) {
    const H = innerHeight;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'drop';
      el.setAttribute('aria-label', 'Falling token. Click to catch it.');
      el.innerHTML = svgIcon(GLYPH.gold);
      el.style.cssText = `left:${rand(0.05, 0.92) * innerWidth}px;--fall:${H + 120}px;--d:${rand(4, 6.5).toFixed(2)}s;--delay:${(i * 0.32).toFixed(2)}s;--r:${rand(-200, 200).toFixed(0)}deg`;
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (el.classList.contains('caught')) return;
        const gain = Math.max(D.tpsGross * 20, 30) * luckMult();
        earn(gain);
        el.classList.add('caught');
        el.dataset.gain = '+' + fmt(gain);
        Sound.click();
        setTimeout(() => el.remove(), 600);
      });
      el.addEventListener('animationend', e => { if (e.animationName === 'fall') el.remove(); });
      this.layer.appendChild(el);
    }
  },
  burst(el, col) {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (!G.settings.particles) return;
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('span');
      p.className = 'fx-spark';
      const a = (i / 14) * Math.PI * 2, d = rand(40, 90);
      p.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--c:${col}`;
      this.layer.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  },
  update(dt) {
    if (this.hungry.length || bugsEating) this.updateHungry(dt);
    if (this.eureka) {
      this.eureka.t -= dt;
      this.eureka.el.classList.toggle('fading', this.eureka.t < 1);
      if (this.eureka.t <= 0) this.removeEureka();
    }
    const b = this.bug;
    if (b) {
      b.t += dt;
      const p = b.t / b.dur;
      if (p >= 1) { b.el.remove(); this.bug = null; return; }
      const x = b.x0 + (b.x1 - b.x0) * p, y = b.y + Math.sin(b.t * b.freq) * b.amp;
      const vx = (b.x1 - b.x0) / b.dur, vy = Math.cos(b.t * b.freq) * b.amp * b.freq;
      const ang = Math.atan2(vy, vx) + Math.PI / 2;
      b.el.style.transform = `translate(${x}px,${y}px) rotate(${ang}rad)`;
    }
  },
};

// ---------- news ticker ----------
const Ticker = {
  init() {
    this.t = 0;
    this.last = '';
    $('#ticker').addEventListener('click', () => { grant('news'); this.next(); });
    this.next();
  },
  next() {
    this.t = 0;
    const pool = NEWS.filter(n => !n[0] || safe(n[0]));
    let line = pick(pool)[1];
    for (let tries = 0; line === this.last && tries < 5; tries++) line = pick(pool)[1];
    this.last = line;
    const el = $('#tickerText');
    el.classList.remove('in');
    void el.offsetWidth;
    el.textContent = line;
    el.classList.add('in');
  },
  frame(dt) { if ((this.t += dt) > 10) this.next(); },
};

// ---------- the "what Claude is doing" spinner under the sparkle ----------
const Spinner = {
  init() {
    Object.assign(this, { f: 0, acc: 0, txt: 0, glyph: $('#spinGlyph'), verbEl: $('#spinVerb'), meta: $('#spinMeta') });
    this.pick();
  },
  pick() { this.verb = pick(VERBS); this.vt = 0; this.made = 0; },
  frame(dt) {
    const idle = G.earned === 0;
    this.vt += dt;
    this.made += D.tps * dt;
    if ((this.acc += dt) > 0.11 && !idle && !stillMode()) {
      this.acc = 0;
      this.f = (this.f + 1) % SPIN_FRAMES.length;
      this.glyph.textContent = SPIN_FRAMES[this.f];
    }
    if (this.vt > 5) this.pick();
    if ((this.txt += dt) < 0.2) return;
    this.txt = 0;
    if (idle) {
      this.glyph.textContent = '✻';
      this.verbEl.textContent = 'Click the sparkle to start generating tokens';
      this.meta.textContent = '';
      return;
    }
    this.verbEl.textContent = this.verb + '…';
    this.meta.textContent = `(${Math.floor(this.vt)}s · ↑ ${fmt(this.made)} tokens · esc to interrupt)`;
  },
};

// ---------- main UI controller ----------
const UI = {
  mode: 'buy', amt: 1, upgSig: null, bldSig: null, fast: 0, slow: 0,
  init() {
    $('#brandMark').innerHTML = svgIcon(GLYPH.sparkle);
    Tip.init();
    FX.init();
    Ticker.init();
    Spinner.init();
    this.bindStore();
    this.bindChrome();
    bindTips($('#buffs'), '.buff', el => buffTip(el.dataset.key));
    bindTips($('#paneLeft'), '#flowTag', () => flowTip());
    bindTips(document.querySelector('.brand'), '#seasonPill', () => Events.seasonTip());
    this.refreshStore(true);
    this.refreshBank();
  },
  isTouch: e => e.pointerType === 'touch' || e.pointerType === 'pen',
  bindStore() {
    const upBox = $('#upgrades'), bBox = $('#buildings');
    let lastPointer = 'mouse';
    document.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; }, true);

    upBox.addEventListener('click', e => {
      const el = e.target.closest('.upg');
      if (!el) return;
      const u = UPG[el.dataset.id];
      if (buyUpgrade(u.id)) {
        Sound.buy();
        Tip.hide();
        toast({ icon: iconParts(u.icon), kicker: 'Upgrade installed', title: esc(u.name), text: u.desc, life: 3200 });
        this.refreshStore();
      } else if (lastPointer !== 'mouse') {
        flashTip(el, () => upgTip(u));
      }
    });
    bindTips(upBox, '.upg', el => upgTip(UPG[el.dataset.id]));

    bBox.addEventListener('click', e => {
      const el = e.target.closest('.bld[data-i]');
      if (!el) return;
      const i = +el.dataset.i;
      const ok = this.mode === 'level' ? levelUp(i) : this.mode === 'sell' ? sellBuilding(i, this.amt) : buyBuilding(i, this.amt);
      if (ok) {
        Sound.buy();
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
        this.refreshStore();
        if (lastPointer === 'mouse') Tip.refresh();
        else flashTip(el, () => bldTip(i));
      } else if (lastPointer !== 'mouse') {
        flashTip(el, () => bldTip(i));
      }
    });
    bindTips(bBox, '.bld[data-i]', el => bldTip(+el.dataset.i));

    document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      this.mode = btn.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      this.refreshStore();
    }));
    document.querySelectorAll('[data-amt]').forEach(btn => btn.addEventListener('click', () => {
      this.amt = +btn.dataset.amt;
      document.querySelectorAll('[data-amt]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      this.refreshStore();
    }));
    $('#buyAll').addEventListener('click', () => {
      let n = 0;
      for (const u of visibleUpgrades()) if (buyUpgrade(u.id)) n++;
      if (n) { Sound.buy(); toast({ icon: GLYPH.up, kicker: 'Batch mode', title: `Installed ${n} upgrade${n === 1 ? '' : 's'}` }); }
      this.refreshStore();
    });
  },
  bindChrome() {
    if (!document.body.dataset.view) document.body.dataset.view = 'left';
    document.querySelectorAll('#mobileNav [data-view]').forEach(btn => btn.addEventListener('click', () => {
      document.body.dataset.view = btn.dataset.view;
      document.querySelectorAll('#mobileNav [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      Tip.hide();
    }));
    $('#btnSave').addEventListener('click', () => {
      toast(save() ? { icon: GLYPH.prompt, title: 'Game saved', text: 'Progress is stored in this browser.', life: 2400 }
        : { icon: GLYPH.prompt, title: 'Could not save', text: 'This browser is blocking storage. Use Options → Export to keep a copy.', kind: 'bad' });
    });
    $('#btnSound').addEventListener('click', () => {
      G.settings.sound = !G.settings.sound;
      if (G.settings.sound) { Sound.ensure(); Sound.ach(); }
      this.refreshSoundButton();
      Panels.syncOptions();
    });
    this.refreshSoundButton();
  },
  refreshSoundButton() {
    const b = $('#btnSound');
    b.setAttribute('aria-pressed', String(G.settings.sound));
    b.textContent = G.settings.sound ? 'Sound on' : 'Sound off';
  },
  refreshBank() {
    $('#bankCount').textContent = fmtLong(G.tokens);
    const rate = $('#bankRate');
    rate.textContent = `per second: ${fmt(D.tps)}${D.buffProd !== 1 ? `  (×${+D.buffProd.toFixed(2)})` : ''}`;
    rate.classList.toggle('hot', D.buffProd > 1);
    rate.classList.toggle('cold', D.buffProd < 1 || D.bugsEating > 0);
  },
  refreshBuffs() {
    const box = $('#buffs');
    const sig = G.buffs.map(b => b.key).join();
    if (sig !== box.dataset.sig) {
      box.dataset.sig = sig;
      box.innerHTML = G.buffs.map(b => `<div class="buff ${b.prod < 1 || b.bad ? 'bad' : ''}" tabindex="0" data-key="${esc(b.key)}"><span class="buff-name">${esc(b.name)}</span><span class="buff-t"></span></div>`).join('');
    }
    for (const el of box.children) {
      const b = G.buffs.find(x => x.key === el.dataset.key);
      if (!b) continue;
      el.style.setProperty('--p', (b.t / b.dur).toFixed(3));
      el.lastElementChild.textContent = `${Math.ceil(b.t)}s`;
    }
  },
  refreshStore(force) {
    const list = visibleUpgrades();
    const upBox = $('#upgrades');
    const sig = list.map(u => u.id).join();
    if (force || sig !== this.upgSig) {
      this.upgSig = sig;
      upBox.innerHTML = list.length
        ? list.map(u => `<button class="upg" type="button" data-id="${u.id}" aria-label="${esc(u.name)}">${upgIcon(u)}</button>`).join('')
        : '<p class="empty-note">New upgrades appear here as your workspace grows.</p>';
      if (inChallenge('noupgrade')) upBox.insertAdjacentHTML('afterbegin', '<p class="empty-note">Vanilla Only challenge: upgrades are locked this run.</p>');
    }
    for (const el of upBox.children) {
      const u = UPG[el.dataset.id];
      if (u) el.classList.toggle('can', G.tokens >= upgCost(u));
    }
    $('#buyAll').hidden = !(hasMem('batch') && list.length);

    let maxRev = 0;
    for (let i = 0; i < N; i++) if (i === 0 || G.owned[i] > 0 || G.earned >= BUILDINGS[i].cost / 2) maxRev = i;
    const shown = Math.min(N, maxRev + 3);
    const bBox = $('#buildings');
    if (force || `${shown}:${maxRev}` !== this.bldSig) {
      this.bldSig = `${shown}:${maxRev}`;
      bBox.innerHTML = BUILDINGS.slice(0, shown).map((b, i) => i <= maxRev
        ? `<button class="bld" type="button" data-i="${i}" style="--bc:${b.color}"><span class="bld-ico">${svgIcon(b.icon)}</span>` +
          `<span class="bld-main"><span class="bld-name">${esc(b.name)} <span class="bld-lv"></span></span><span class="bld-cost">${TK}<span class="bld-cost-v"></span></span></span>` +
          `<span class="bld-owned"></span></button>`
        : `<div class="bld mystery" aria-hidden="true"><span class="bld-ico">${svgIcon(b.icon)}</span>` +
          `<span class="bld-main"><span class="bld-name">???</span><span class="bld-cost">${TK}${fmt(b.cost)}</span></span><span class="bld-owned"></span></div>`).join('');
    }
    const sell = this.mode === 'sell', lvl = this.mode === 'level';
    for (const el of bBox.querySelectorAll('.bld[data-i]')) {
      const i = +el.dataset.i;
      const cost = lvl ? levelCost(i) : sell ? sellValue(i, this.amt) : bulkCost(i, this.amt);
      const can = lvl ? G.owned[i] > 0 && G.credits >= cost : sell ? G.owned[i] - awayOf(i) > 0 : G.tokens >= cost;
      const txt = lvl ? `⚡${cost} credit${cost === 1 ? '' : 's'} → Lv ${G.levels[i] + 1}` : (sell ? '+' : '') + fmt(cost);
      const lv = el.querySelector('.bld-lv'), lvTxt = G.levels[i] ? `Lv ${G.levels[i]}` : '';
      if (lv.textContent !== lvTxt) lv.textContent = lvTxt;
      const cv = el.querySelector('.bld-cost-v'), ov = el.querySelector('.bld-owned');
      if (cv.textContent !== txt) cv.textContent = txt;
      const own = G.owned[i] ? G.owned[i].toLocaleString('en-US') : '';
      if (ov.textContent !== own) ov.textContent = own;
      el.classList.toggle('no', !can);
      el.classList.toggle('sell', sell);
      el.classList.toggle('lvl', lvl);
    }
    const cb = $('#creditsBar'), next = DAY_MS - (Date.now() - G.creditAt);
    const ctext = `⚡ ${G.credits} compute credit${G.credits === 1 ? '' : 's'} · next in ${fmtTime(next / 1000)}`;
    if (cb.textContent !== ctext) cb.textContent = ctext;
  },
  // From 100 Autocompletes on, every mouse pointer gets a gold skin, and clicks play a quick gold tap.
  // Cursor tier: 0 = normal, 1 = gold (100+ Autocompletes), 2 = shimmering rainbow (500+).
  refreshCursor() {
    const owned = G.owned[0], tier = owned >= DIAMOND_AT ? 3 : owned >= RAINBOW_AT ? 2 : owned >= HAND_GROUP_AT ? 1 : 0;
    if (tier === this.cursorTier) return;
    if (!this.skinCss) this.initGoldCursor();
    const first = this.cursorTier === undefined, up = !first && tier > this.cursorTier;
    this.cursorTier = tier;
    this.goldCursor = tier > 0;
    document.body.classList.toggle('gold-cursor', tier > 0);
    if (tier > 0) this.setSkin(this.skin || 'arrow', true);
    if (up && tier === 1) toast({ icon: BIG_HAND, kicker: 'Golden touch', title: 'Your cursor turned gold', text: 'You own 100 Autocompletes. Every pointer is gold now, and clicking the sparkle lands with a golden tap.', kind: 'gold' });
    if (up && tier === 3) toast({ icon: BIG_HAND, kicker: 'Diamond touch', title: 'Your cursor turned to diamond', text: 'You own 5,000 Autocompletes. Every pointer glitters now, and clicking the sparkle shatters crystal everywhere.', kind: 'rare' });
    if (up && tier === 2) toast({ icon: BIG_HAND, kicker: 'Event horizon touch', title: 'Your cursor fell into a black hole', text: 'You own 500 Autocompletes. Every pointer is dark and glowing now, and clicking the sparkle collapses space around it.', kind: 'legend' });
  },
  initGoldCursor() {
    const toSvg = (parts, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${defs}${parts.map(p =>
      `<path d="${p.d}" fill="${p.f || 'none'}"${p.s ? ` stroke="${p.s}" stroke-width="${p.w || 1.5}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`).join('')}</svg>`;
    // Black hole skins: gold fills become near-black with a sweeping orange glint, outlines turn orange.
    const rbMap = { [GOLD_FILL]: 'url(#rb)', '#F2C57C': 'url(#rb)', [GOLD_INK]: '#FF7A1A', '#B9853A': 'rgba(255,122,26,.65)' };
    const rbParts = parts => parts.map(p => ({ ...p, f: p.f && (rbMap[p.f] || p.f), s: p.s && (rbMap[p.s] || p.s) }));
    const rbDefs = k => `<defs><linearGradient id="rb" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="30" y2="30" gradientTransform="rotate(${k * 45} 16 16)">` +
      '<stop offset="0" stop-color="#060608"/><stop offset=".55" stop-color="#26262B"/><stop offset=".8" stop-color="#FF7A1A"/><stop offset="1" stop-color="#FFB070"/></linearGradient></defs>';
    const css = (svgText, hx, hy, fallback) => `url("data:image/svg+xml,${encodeURIComponent(svgText)}") ${hx} ${hy}, ${fallback}`;
    this.skinSvg = {};
    this.skinCss = {};
    this.rbSvg = {};
    this.rbCss = {};
    this.diaSvg = {};
    this.diaCss = {};
    // Diamond skins: icy white-to-cyan fill with a moving glint and deep blue outlines.
    const diaMap = { [GOLD_FILL]: 'url(#dg)', '#F2C57C': 'url(#dg)', [GOLD_INK]: '#1F4E66', '#B9853A': 'rgba(31,78,102,.6)' };
    const diaParts = parts => parts.map(p => ({ ...p, f: p.f && (diaMap[p.f] || p.f), s: p.s && (diaMap[p.s] || p.s) }));
    const diaDefs = k => `<defs><linearGradient id="dg" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="30" y2="30" gradientTransform="rotate(${k * 45} 16 16)">` +
      '<stop offset="0" stop-color="#E9FBFF"/><stop offset=".45" stop-color="#9FE3FF"/><stop offset=".55" stop-color="#FFFFFF"/><stop offset="1" stop-color="#5EC8FF"/></linearGradient></defs>';
    for (const [name, [parts, hx, hy, fallback]] of Object.entries(GOLD_SKINS)) {
      this.skinSvg[name] = toSvg(parts);
      this.skinCss[name] = css(this.skinSvg[name], hx, hy, fallback);
      this.rbSvg[name] = [];
      this.rbCss[name] = [];
      this.diaSvg[name] = [];
      this.diaCss[name] = [];
      for (let k = 0; k < 8; k++) {
        this.rbSvg[name].push(toSvg(rbParts(parts), rbDefs(k)));
        this.rbCss[name].push(css(this.rbSvg[name][k], hx, hy, fallback));
        this.diaSvg[name].push(toSvg(diaParts(parts), diaDefs(k)));
        this.diaCss[name].push(css(this.diaSvg[name][k], hx, hy, fallback));
      }
    }
    this.rbFrame = 0;
    // The rainbow pointer shimmers by stepping through 8 gradient angles.
    setInterval(() => {
      if (this.cursorTier < 2 || document.hidden) return;
      this.rbFrame = (this.rbFrame + 1) % 8;
      this.applySkin();
    }, 150);
    this.tapEl = document.createElement('div');
    this.tapEl.className = 'gold-tap';
    this.tapEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.tapEl);
    document.addEventListener('pointermove', e => { if (this.goldCursor && e.pointerType === 'mouse') this.setSkin(this.skinFor(e.target)); }, { passive: true });
    document.addEventListener('pointerdown', e => {
      if (!this.goldCursor || e.pointerType !== 'mouse' || e.button !== 0) return;
      this.setSkin(this.skinFor(e.target));
      // The tap animation only plays when the click lands on the sparkle itself.
      if (e.target.id !== 'stage') return;
      const p = Stage.local(e);
      if (!Stage.hit(p.x, p.y)) return;
      if (this.cursorTier === 3) this.diamondTap(e.clientX, e.clientY);
      else if (this.cursorTier === 2) this.rainbowTap(e.clientX, e.clientY);
      else this.goldTap(e.clientX, e.clientY);
    }, true);
  },
  // Which pointer the browser would normally show over this element.
  skinFor(el) {
    if (!el || !el.closest) return 'arrow';
    if (el.closest('textarea, input[type="text"], input[type="number"]')) return 'text';
    if (el.closest('.bug')) return 'crosshair';
    if (el.closest('[disabled], [aria-disabled="true"]')) return 'noentry';
    if (el.closest('.ach')) return 'help';
    if (el.id === 'stage') return Stage.hover ? 'hand' : 'arrow';
    if (el.closest('button, a, label, select, input, [role="tab"]')) return 'hand';
    return 'arrow';
  },
  setSkin(name, force) {
    if (name === this.skin && !force) return;
    this.skin = name;
    this.applySkin();
  },
  applySkin() {
    const css = this.cursorTier === 3 ? this.diaCss[this.skin][this.rbFrame] : this.cursorTier === 2 ? this.rbCss[this.skin][this.rbFrame] : this.skinCss[this.skin];
    document.documentElement.style.setProperty('--gold-cursor', css);
  },
  // Shows an animated copy of the current pointer at the click point, hiding the real one meanwhile.
  playTap(x, y, svgText, cls, ms) {
    const [, hx, hy] = GOLD_SKINS[this.skin];
    const el = this.tapEl;
    el.innerHTML = svgText;
    el.style.cssText = `left:${x - hx}px;top:${y - hy}px;transform-origin:${hx}px ${hy}px`;
    el.className = 'gold-tap';
    void el.offsetWidth;
    el.className = `gold-tap go ${cls}`;
    document.body.classList.add('cursor-hidden');
    clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => { el.className = 'gold-tap'; document.body.classList.remove('cursor-hidden'); }, ms);
  },
  ring(x, y, cls = '', style = '') {
    const ring = document.createElement('span');
    ring.className = `gold-ring ${cls}`;
    ring.style.cssText = `left:${x}px;top:${y}px;${style}`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 900);
  },
  // Gold tier: a fast version of the circle hands' tap, plus a gold shockwave.
  goldTap(x, y) {
    if (stillMode()) return;
    this.playTap(x, y, this.skinSvg[this.skin], '', 300);
    this.ring(x, y);
  },
  // Diamond tier: the spin-slam, then crystal rings bursting outward and shards flying in every direction.
  diamondTap(x, y) {
    if (stillMode()) return;
    this.playTap(x, y, this.diaSvg[this.skin][this.rbFrame], 'rb dia', 470);
    ['#FFFFFF', '#9FE3FF', '#5EC8FF'].forEach((col, i) => this.ring(x, y, 'rb', `--rc:${col};animation-delay:${0.12 + i * 0.06}s`));
    if (!G.settings.particles) return;
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('span'), a = (i / 16) * Math.PI * 2 + rand(-0.15, 0.15), d = rand(60, 120);
      p.className = 'fx-spark shard';
      p.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--c:${i % 2 ? '#FFFFFF' : '#9FE3FF'};--rot:${(a * 180) / Math.PI}deg;animation-delay:.12s`;
      FX.layer.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  },
  // Black hole tier: wind-up, slam and a full spin, rings that collapse inward, sparks pulled into the click,
  // then one orange flash outward.
  rainbowTap(x, y) {
    if (stillMode()) return;
    this.playTap(x, y, this.rbSvg[this.skin][this.rbFrame], 'rb', 470);
    ['#FF7A1A', '#9A9AA2', '#FFB070'].forEach((col, i) => this.ring(x, y, 'void', `--rc:${col};animation-delay:${i * 0.06}s`));
    this.ring(x, y, 'rb', '--rc:#FF7A1A;animation-delay:.34s');
    if (!G.settings.particles) return;
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('span'), a = (i / 12) * Math.PI * 2, d = rand(55, 95);
      p.className = 'fx-spark';
      p.style.cssText = `left:${x + Math.cos(a) * d}px;top:${y + Math.sin(a) * d}px;--dx:${-Math.cos(a) * d}px;--dy:${-Math.sin(a) * d}px;--c:${i % 2 ? '#9A9AA2' : '#FF7A1A'}`;
      FX.layer.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  },
  frame(dt) {
    this.refreshBank();
    Spinner.frame(dt);
    Ticker.frame(dt);
    if ((this.fast += dt) >= 0.1) {
      this.fast = 0;
      this.refreshStore();
      this.refreshBuffs();
      this.refreshCursor();
      const ft = $('#flowTag'), label = `Flow ${Math.round(D.flow * 100)}%`;
      if (ft.lastElementChild.textContent !== label) ft.lastElementChild.textContent = label;
      Panels.fastRefresh();
    }
    if ((this.slow += dt) >= 0.5) {
      this.slow = 0;
      Tip.refresh();
      Panels.refresh();
    }
  },
};
