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
  return tipHead(svgIcon(b.icon), b.name, tag, cost, sell ? n > 0 : G.tokens >= cost) + `<div class="tip-desc">${esc(b.desc)}</div>` + stats;
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
  eureka: null, bug: null, chain: 0,
  init() { this.layer = $('#fx'); },
  spawnEureka(force) {
    const life = 13 * D.eurekaLife;
    if (this.eureka) { if (force) this.eureka.t = life; return; }
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'eureka';
    el.setAttribute('aria-label', 'Eureka token. Click it for a bonus.');
    el.innerHTML = svgIcon(GLYPH.gold);
    el.style.left = rand(0.1, 0.9) * innerWidth + 'px';
    el.style.top = rand(0.18, 0.82) * innerHeight + 'px';
    el.addEventListener('click', () => {
      if (!this.eureka) return;
      const out = eurekaEffect();
      this.burst(el, '#F2C57C');
      this.removeEureka();
      Sound.eureka();
      toast({ icon: GLYPH.gold, kicker: 'Eureka', title: out.title, text: out.text, kind: 'gold' });
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
        const gain = Math.max(D.tps * 20, 30) * luckMult();
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
    if (this.eureka) {
      this.eureka.t -= dt;
      this.eureka.el.classList.toggle('fading', this.eureka.t < 2.5);
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
      const ok = this.mode === 'sell' ? sellBuilding(i, this.amt) : buyBuilding(i, this.amt);
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
    rate.classList.toggle('cold', D.buffProd < 1);
  },
  refreshBuffs() {
    const box = $('#buffs');
    const sig = G.buffs.map(b => b.key).join();
    if (sig !== box.dataset.sig) {
      box.dataset.sig = sig;
      box.innerHTML = G.buffs.map(b => `<div class="buff ${b.prod < 1 ? 'bad' : ''}" data-key="${esc(b.key)}"><span class="buff-name">${esc(b.name)}</span><span class="buff-t"></span></div>`).join('');
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
          `<span class="bld-main"><span class="bld-name">${esc(b.name)}</span><span class="bld-cost">${TK}<span class="bld-cost-v"></span></span></span>` +
          `<span class="bld-owned"></span></button>`
        : `<div class="bld mystery" aria-hidden="true"><span class="bld-ico">${svgIcon(b.icon)}</span>` +
          `<span class="bld-main"><span class="bld-name">???</span><span class="bld-cost">${TK}${fmt(b.cost)}</span></span><span class="bld-owned"></span></div>`).join('');
    }
    const sell = this.mode === 'sell';
    for (const el of bBox.querySelectorAll('.bld[data-i]')) {
      const i = +el.dataset.i;
      const cost = sell ? sellValue(i, this.amt) : bulkCost(i, this.amt);
      const can = sell ? G.owned[i] > 0 : G.tokens >= cost;
      const txt = (sell ? '+' : '') + fmt(cost);
      const cv = el.querySelector('.bld-cost-v'), ov = el.querySelector('.bld-owned');
      if (cv.textContent !== txt) cv.textContent = txt;
      const own = G.owned[i] ? G.owned[i].toLocaleString('en-US') : '';
      if (ov.textContent !== own) ov.textContent = own;
      el.classList.toggle('no', !can);
      el.classList.toggle('sell', sell);
    }
  },
  // From 100 Autocompletes on, every mouse pointer gets a gold skin, and clicks play a quick gold tap.
  refreshCursor() {
    const gold = G.owned[0] >= HAND_GROUP_AT;
    if (gold === this.goldCursor) return;
    if (!this.skinCss) this.initGoldCursor();
    const first = this.goldCursor === undefined;
    this.goldCursor = gold;
    document.body.classList.toggle('gold-cursor', gold);
    if (gold) this.setSkin(this.skin || 'arrow', true);
    if (gold && !first) toast({ icon: BIG_HAND, kicker: 'Golden touch', title: 'Your cursor turned gold', text: 'You own 100 Autocompletes. Every pointer is gold now, and every click lands with a golden tap.', kind: 'gold' });
  },
  initGoldCursor() {
    const svg = parts => `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${parts.map(p =>
      `<path d="${p.d}" fill="${p.f || 'none'}"${p.s ? ` stroke="${p.s}" stroke-width="${p.w || 1.5}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`).join('')}</svg>`;
    this.skinSvg = {};
    this.skinCss = {};
    for (const [name, [parts, hx, hy, fallback]] of Object.entries(GOLD_SKINS)) {
      this.skinSvg[name] = svg(parts);
      this.skinCss[name] = `url("data:image/svg+xml,${encodeURIComponent(this.skinSvg[name])}") ${hx} ${hy}, ${fallback}`;
    }
    this.tapEl = document.createElement('div');
    this.tapEl.className = 'gold-tap';
    this.tapEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.tapEl);
    document.addEventListener('pointermove', e => { if (this.goldCursor && e.pointerType === 'mouse') this.setSkin(this.skinFor(e.target)); }, { passive: true });
    document.addEventListener('pointerdown', e => {
      if (!this.goldCursor || e.pointerType !== 'mouse' || e.button !== 0) return;
      this.setSkin(this.skinFor(e.target));
      this.goldTap(e.clientX, e.clientY);
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
    document.documentElement.style.setProperty('--gold-cursor', this.skinCss[name]);
  },
  // A fast version of the circle hands' tap: wind up, slam, wobble, plus a shockwave at the click point.
  goldTap(x, y) {
    if (stillMode()) return;
    const [, hx, hy] = GOLD_SKINS[this.skin];
    const el = this.tapEl;
    el.innerHTML = this.skinSvg[this.skin];
    el.style.cssText = `left:${x - hx}px;top:${y - hy}px;transform-origin:${hx}px ${hy}px`;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    document.body.classList.add('cursor-hidden');
    clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => { el.classList.remove('go'); document.body.classList.remove('cursor-hidden'); }, 300);
    const ring = document.createElement('span');
    ring.className = 'gold-ring';
    ring.style.cssText = `left:${x}px;top:${y}px`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 600);
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
      Panels.fastRefresh();
    }
    if ((this.slow += dt) >= 0.5) {
      this.slow = 0;
      Tip.refresh();
      Panels.refresh();
    }
  },
};
