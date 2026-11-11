/* Kingdom Clash: the full-screen scenes for growing a card. One scene for each way:

   - Upgrade with coins: the card's copies stream out of its bar and coins pour in, the card charges up
     and shakes, then bursts: the level number slams to the new one and the stats count up.
   - Hammer of Books: the hammer swings in and strikes the card three times (sparks, cracks of light,
     the screen shakes), and on the third strike the card bursts into a rainbow level-up.
   - Wild cards: wild cards fly in one after another and melt into the card, each counting into its bar.
   - Books (and the Book of Books): the book drops in and falls open, its pages flip and fly into the
     card as light, filling its bar to the top.

   A click (or Space or Enter) during a scene jumps to its end; another closes it. Escape closes it.
   With reduced motion, the scene opens on its end. The game's rules are not touched here: the caller
   has already upgraded the card or used the item, and passes what changed. */
'use strict';

const KCUpgradeFX = (() => {
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const RAINBOW = ['#7ff0e0', '#9fb8ff', '#d49bff', '#ff8fd8', '#ffc35a', '#ffffff'];
  const RCOL = { common: ['#8fd0ff', '#cdeaff', '#ffffff'], rare: ['#ffb347', '#ffd98a', '#ffffff'], epic: ['#d49bff', '#efd4ff', '#ffffff'], legendary: RAINBOW };
  let el = null, S = null;

  /* ---------- the scene's markup, made once ---------- */
  function build() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'up-scene';
    el.id = 'upScene';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'usTitle');
    el.innerHTML = `<canvas class="us-fx" id="usFx" aria-hidden="true"></canvas>
      <div class="us-stage" id="usStage">
        <p class="us-title" id="usTitle"></p>
        <div class="us-center" id="usCenter">
          <span class="us-rays" aria-hidden="true"></span>
          <div class="us-card" id="usCard"><img id="usImg" alt=""><span class="us-shine" aria-hidden="true"></span>
            <svg class="us-cracks" viewBox="0 0 100 120" aria-hidden="true">
              <path class="ck ck1" d="M78 6L66 30 74 40 58 58"/><path class="ck ck2" d="M96 34L76 48 80 62 62 72 66 88"/><path class="ck ck3" d="M70 2L50 26 54 40 36 56 44 70 26 92M54 40L70 50M44 70L60 80"/>
            </svg></div>
          <div class="us-tool" id="usTool" aria-hidden="true"></div>
        </div>
        <div class="us-lvl" id="usLvl"><small>Level</small><span class="us-num" id="usNum"><b id="usOld">1</b><b id="usNew">2</b></span></div>
        <div class="us-bar" id="usBar"><i id="usFill"></i><span id="usBarText"></span></div>
        <div class="us-gain" id="usGain" aria-live="polite"></div>
        <div class="us-stats" id="usStats"></div>
        <p class="us-note" id="usNote"></p>
        <p class="us-hint" id="usHint"></p>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', tap);
    window.addEventListener('keydown', e => {
      if (!S || el.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) tap(); }
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    window.addEventListener('resize', () => { if (S) sizeFx(); });
  }
  const $ = id => document.getElementById(id);

  /* ---------- effects canvas ---------- */
  const FX = { parts: [], raf: 0, last: 0, dpr: 1 };
  function sizeFx() {
    const cv = $('usFx'), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); FX.dpr = dpr;
  }
  function center(node, fy) {
    const r = node.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height * (fy == null ? 0.5 : fy), r.width];
  }
  function push(p) { if (!calm) { FX.parts.push(Object.assign({ vx: 0, vy: 0, g: 0, spin: Math.random() * 6, age: 0 }, p)); if (FX.parts.length > 400) FX.parts.splice(0, FX.parts.length - 400); } }
  function sparks(x, y, n, cols, speed, up) {
    for (let i = 0; i < n; i++) {
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.4 : Math.random() * 6.283, v = (speed || 260) * (0.35 + Math.random());
      push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 260, life: 0.6 + Math.random() * 0.7, r: 2 + Math.random() * 3.5, col: cols[i % cols.length] });
    }
  }
  function flash(x, y, r, col) {
    push({ kind: 'flash', x, y, life: 0.5, max: 0.5, r });
    push({ kind: 'ring', x, y, life: 0.75, max: 0.75, r: r * 1.6, col });
    push({ kind: 'ring', x, y, life: 0.5, max: 0.5, r: r * 1.05, col: '#ffffff' });
  }
  // something that flies from (x0, y0) to (x1, y1) along a curve, then calls done
  function fly(kind, x0, y0, x1, y1, dur, col, done, extra) {
    if (calm) { if (done) done(); return; }
    push(Object.assign({ kind, x0, y0, x1, y1, x: x0, y: y0, t: 0, dur, col, done, trail: [], life: dur + 0.3, bend: (Math.random() - 0.5) * 0.7 }, extra || {}));
  }
  function frame(now) {
    FX.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (FX.last || now)) / 1000); FX.last = now;
    const cv = $('usFx'), c = cv.getContext('2d');
    c.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of FX.parts) {
      p.life -= dt; p.age += dt; p.spin += dt * 7;
      if (p.x0 != null) {
        // a flyer: eased along a bent path, trailing light
        p.t += dt;
        const q = Math.min(1, p.t / p.dur), e = q * q * (3 - 2 * q), dx = p.x1 - p.x0, dy = p.y1 - p.y0, b = Math.sin(q * Math.PI) * p.bend;
        p.x = p.x0 + dx * e - dy * b; p.y = p.y0 + dy * e + dx * b;
        if (q < 1) p.trail.push([p.x, p.y]); if (p.trail.length > 12 || (q >= 1 && p.trail.length)) p.trail.shift();
        if (q >= 1 && p.done) { const f = p.done; p.done = null; f(); }
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        for (let k = 1; k < p.trail.length; k++) {
          const f = k / p.trail.length;
          c.globalAlpha = f * 0.7; c.strokeStyle = p.col; c.lineWidth = 1 + f * (p.kind === 'coin' ? 4 : 6);
          c.beginPath(); c.moveTo(p.trail[k - 1][0], p.trail[k - 1][1]); c.lineTo(p.trail[k][0], p.trail[k][1]); c.stroke();
        }
        c.restore();
        if (q < 1) drawThing(c, p, 1 - q * 0.35);
        continue;
      }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      c.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.kind === 'flash' || p.kind === 'ring') {
        const a = 1 - p.life / p.max;
        c.save(); c.globalCompositeOperation = 'lighter';
        if (p.kind === 'flash') {
          const rr = p.r * (0.4 + a), g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
          g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - a)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, rr, 0, 6.3); c.fill();
        } else { c.globalAlpha = (1 - a) * 0.9; c.strokeStyle = p.col; c.lineWidth = 2 + (1 - a) * 9; c.beginPath(); c.arc(p.x, p.y, p.r * (0.2 + a * 0.8), 0, 6.3); c.stroke(); }
        c.restore();
      } else drawThing(c, p, 1);
    }
    c.globalAlpha = 1;
    FX.parts = FX.parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  }
  function drawThing(c, p, sc) {
    const x = p.x, y = p.y;
    if (p.kind === 'coin') {
      const r = 8 * sc;
      c.beginPath(); c.ellipse(x, y, r * Math.abs(Math.cos(p.spin)) + 1.2, r, 0, 0, 6.3);
      c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#8a5a05'; c.stroke();
    } else if (p.kind === 'copy' || p.kind === 'page') {
      // a little card (a copy) or a page of a book, tumbling
      c.save(); c.translate(x, y); c.rotate(Math.sin(p.spin) * 0.6);
      const w = (p.kind === 'page' ? 16 : 14) * sc, h = (p.kind === 'page' ? 20 : 18) * sc;
      c.fillStyle = p.kind === 'page' ? '#fffaf0' : p.col; c.strokeStyle = '#1c1530'; c.lineWidth = 1.6;
      c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -h / 2, w, h, 3) : c.rect(-w / 2, -h / 2, w, h); c.fill(); c.stroke();
      if (p.kind === 'page') { c.strokeStyle = 'rgba(120,100,70,.7)'; c.lineWidth = 1; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-w * 0.3, -h * 0.25 + k * h * 0.22); c.lineTo(w * 0.3, -h * 0.25 + k * h * 0.22); c.stroke(); } }
      c.restore();
      c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, 16 * sc);
      g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 16 * sc, 0, 6.3); c.fill(); c.restore();
    } else if (p.kind === 'orb') {
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(x, y, 0, x, y, 13 * sc);
      g.addColorStop(0, '#fff'); g.addColorStop(0.45, p.col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 13 * sc, 0, 6.3); c.fill(); c.restore();
    } else {
      const s = p.r * (0.6 + 0.4 * Math.sin(p.spin * 2));
      c.fillStyle = p.col; c.beginPath();
      c.moveTo(x, y - s * 2); c.lineTo(x + s * 0.6, y - s * 0.6); c.lineTo(x + s * 2, y); c.lineTo(x + s * 0.6, y + s * 0.6);
      c.lineTo(x, y + s * 2); c.lineTo(x - s * 0.6, y + s * 0.6); c.lineTo(x - s * 2, y); c.lineTo(x - s * 0.6, y - s * 0.6);
      c.closePath(); c.fill();
    }
  }

  /* ---------- timing ---------- */
  const later = (fn, ms) => { if (!S) return; const id = setTimeout(() => { if (S) fn(); }, ms); S.timers.push(id); };
  function count(ms, fn, sound) {
    if (calm || !S) { fn(1); return; }
    const t0 = performance.now(); let tick = 0;
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      fn(p);
      if (sound && performance.now() - tick > 75) { tick = performance.now(); KCSound.play(sound); }
      if (p >= 1) clearInterval(id);
    }, 33);
    S.counters.push(id);
  }
  const snd = n => KCSound.play(n);

  /* ---------- the bar under the card ---------- */
  function bar(count, need, max) {
    const pct = max ? 100 : need ? Math.min(100, count / need * 100) : 0;
    $('usFill').style.width = pct.toFixed(1) + '%';
    $('usBar').classList.toggle('full', !max && need > 0 && count >= need);
    $('usBarText').textContent = max ? 'Max level' : `${fmt(Math.round(count))} / ${fmt(need)}`;
  }

  /* ---------- open, skip, close ---------- */
  // d: { mode: 'upgrade' | 'hammer' | 'wild' | 'book', id, name, img, rarity, title, itemSvg (for the
  //      item modes), item, before: { level, count, need, max }, after: { level, count, need, max },
  //      gives (copies added), cost (coins), xp, levelUp (new account level, if any),
  //      stats: [[label, before, after]], onClose }
  function play(d) {
    build();
    if (S) end(true);
    S = { d, timers: [], counters: [], finished: false };
    const lvlMode = d.mode === 'upgrade' || d.mode === 'hammer';
    el.className = `up-scene m-${d.mode} r-${d.rarity}${d.item === 'book_books' ? ' rainbow' : ''}`;
    $('usTitle').textContent = d.title;
    $('usImg').src = d.img; $('usImg').alt = d.name;
    $('usCard').className = 'us-card enter';
    $('usTool').className = 'us-tool'; $('usTool').innerHTML = d.itemSvg || '';
    if (d.mode === 'book') $('usTool').innerHTML = openBook(d.item) + `<span class="us-closed">${d.itemSvg}</span>`;
    $('usOld').textContent = d.before.level; $('usNew').textContent = d.after.level;
    $('usLvl').className = 'us-lvl';
    $('usGain').textContent = ''; $('usGain').className = 'us-gain';
    $('usStats').innerHTML = (d.stats || []).map(([k, a]) => `<div><small>${esc(k)}</small><b data-k="${esc(k)}">${fmt(a)}</b></div>`).join('');
    $('usStats').className = 'us-stats' + (lvlMode ? '' : ' none');
    $('usNote').textContent = ''; $('usHint').textContent = '';
    bar(d.before.count, d.before.need, d.before.max);
    el.hidden = false;
    sizeFx(); FX.parts = []; FX.last = 0;
    if (!FX.raf) FX.raf = requestAnimationFrame(frame);
    if (calm) { finish(false); return; }
    ({ upgrade: coinsRun, hammer: hammerRun, wild: wildRun, book: bookRun })[d.mode]();
  }
  function tap() { if (!S) return; if (!S.finished) finish(true); else close(); }
  function end(quiet) {
    for (const t of S.timers) clearTimeout(t);
    for (const t of S.counters) clearInterval(t);
    S.timers = []; S.counters = [];
    for (const f of S.flyers || []) f.remove();
    S.flyers = [];
    if (quiet) { FX.parts = []; }
  }
  function close() {
    if (!S) return;
    end(true);
    const cb = S.d.onClose;
    S = null; el.hidden = true;
    cancelAnimationFrame(FX.raf); FX.raf = 0; FX.parts = [];
    if (cb) cb();
  }
  // The end of every scene: the card's new state, shown at once (a skip lands here too).
  function finish(skip) {
    if (!S || S.finished) return;
    const d = S.d, quick = !!skip;
    end(false);
    FX.parts = FX.parts.filter(p => p.x0 == null);
    S.finished = true;
    const card = $('usCard'), lvl = d.mode === 'upgrade' || d.mode === 'hammer';
    $('usTool').className = 'us-tool gone';
    card.className = 'us-card done' + (lvl ? ' leveled' : ' filled');
    bar(d.after.count, d.after.need, d.after.max);
    if (lvl) {
      $('usLvl').className = 'us-lvl up';
      $('usTitle').textContent = 'Level up!';
      for (const b of $('usStats').querySelectorAll('b')) {
        const s = d.stats.find(x => x[0] === b.dataset.k);
        b.innerHTML = `${fmt(s[2])}<em>+${fmt(s[2] - s[1])}</em>`;
      }
      $('usStats').classList.add('on');
      $('usGain').innerHTML = `<span class="xp">+${fmt(d.xp)} XP</span>${d.mode === 'hammer' ? '<span class="free">No coins spent!</span>' : ''}`;
      $('usGain').className = 'us-gain on';
      $('usNote').textContent = d.levelUp ? `You are now level ${d.levelUp}!` : '';
      if (d.levelUp) $('usNote').className = 'us-note king';
    } else {
      $('usGain').innerHTML = `<span class="plus">+${fmt(d.gives)} ${d.gives === 1 ? 'copy' : 'copies'}</span>`;
      $('usGain').className = 'us-gain on';
      const ready = !d.after.max && d.after.count >= d.after.need;
      $('usNote').textContent = ready ? 'Upgrade ready!' : '';
      $('usNote').className = 'us-note' + (ready ? ' ready' : '');
    }
    if (quick && !calm) { const [x, y, w] = center(card); flash(x, y, w * 0.9, colors()[0]); sparks(x, y, 30, colors(), 300); }
    $('usHint').textContent = 'Click to continue';
  }
  const colors = () => (S.d.mode === 'hammer' || S.d.item === 'book_books' ? RAINBOW : RCOL[S.d.rarity] || RCOL.common);

  // The level number slams from old to new, the card bursts and the stats count up.
  function levelBurst(rainbow) {
    const d = S.d, card = $('usCard'), [x, y, w] = center(card), cols = rainbow ? RAINBOW : ['#ffe27a', '#ffd23f', '#fff6c8', '#ffffff', colors()[0]];
    card.className = 'us-card leveled';
    $('usLvl').className = 'us-lvl up';
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    $('usTitle').textContent = 'Level up!';
    flash(x, y, w * 1.1, cols[0]);
    sparks(x, y, 70, cols, 420);
    later(() => sparks(x, y - w * 0.3, 30, cols, 300, true), 160);
    snd('levelUp');
    later(() => {
      $('usStats').classList.add('on');
      const bs = [...$('usStats').querySelectorAll('b')];
      count(700, p => bs.forEach(b => {
        const s = d.stats.find(q => q[0] === b.dataset.k), v = Math.round(s[1] + (s[2] - s[1]) * p);
        b.innerHTML = `${fmt(v)}${p >= 1 ? `<em>+${fmt(s[2] - s[1])}</em>` : ''}`;
      }), 'countTick');
    }, 350);
    later(() => { $('usGain').innerHTML = `<span class="xp">+${fmt(d.xp)} XP</span>${d.mode === 'hammer' ? '<span class="free">No coins spent!</span>' : ''}`; $('usGain').className = 'us-gain on'; snd('buy'); }, 1150);
    later(() => {
      if (d.levelUp) { $('usNote').textContent = `You are now level ${d.levelUp}!`; $('usNote').className = 'us-note king'; snd('crown'); }
    }, 1500);
    later(finish, d.levelUp ? 1900 : 1500);
  }

  /* ---------- upgrade with coins ---------- */
  function coinsRun() {
    const d = S.d, card = $('usCard'), barEl = $('usBar');
    later(() => {
      const [bx, by, bw] = center(barEl), [cx, cy] = center(card), copies = Math.min(10, Math.max(3, d.before.need));
      // the copies leave the bar for the card
      for (let i = 0; i < copies; i++) later(() => {
        const sx = bx - bw / 2 + bw * (1 - i / copies) * 0.95;
        fly('copy', sx, by, cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 30, 0.5, colors()[0], () => { snd('partSnap'); sparks(cx, cy, 3, colors(), 140); });
        bar(d.before.need * (1 - (i + 1) / copies), d.before.need, false);
      }, i * 70);
      // coins pour in from below
      const coins = 16;
      for (let i = 0; i < coins; i++) later(() => {
        const a = Math.PI * (0.15 + 0.7 * Math.random()), R = Math.max(innerWidth, innerHeight) * 0.55;
        fly('coin', cx + Math.cos(a) * R * (Math.random() < 0.5 ? -1 : 1), cy + Math.sin(a) * R, cx, cy, 0.55 + Math.random() * 0.2, '#ffd23f', () => snd('coinTick'));
      }, 180 + i * 55);
      $('usGain').innerHTML = `<span class="spent"><i class="coin-i" aria-hidden="true"></i>−${fmt(d.cost)}</span>`; $('usGain').className = 'us-gain on';
    }, 420);
    later(() => { card.className = 'us-card charging'; snd('charge'); }, 1100);
    later(() => levelBurst(false), 2250);
  }

  /* ---------- the Hammer of Books ---------- */
  function hammerRun() {
    const tool = $('usTool'), card = $('usCard');
    later(() => { tool.className = 'us-tool hammer in'; snd('itemGather'); }, 300);
    const strikes = [1050, 1600, 2050];
    strikes.forEach((t, k) => {
      later(() => { tool.className = 'us-tool hammer in'; void tool.offsetWidth; tool.className = 'us-tool hammer in strike'; }, t);
      later(() => {
        const [x, y, w] = center(card, 0.18);
        snd('anvil');
        sparks(x + w * 0.2, y, 26 + k * 10, ['#fff6c8', '#ffd23f', '#ffffff', RAINBOW[k + 1]], 380);
        push({ kind: 'ring', x: x + w * 0.2, y, life: 0.45, max: 0.45, r: w * 0.9, col: RAINBOW[k * 2] });
        el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
        card.className = `us-card cracked c${k + 1}`;
        if (k === 2) card.className = 'us-card cracked c3 charging';
      }, t + 210);
    });
    later(() => { tool.className = 'us-tool hammer gone'; levelBurst(true); }, strikes[2] + 650);
  }

  /* ---------- wild cards ---------- */
  function wildRun() {
    const d = S.d, tool = $('usTool'), card = $('usCard'), n = Math.min(12, d.gives), gap = Math.max(70, Math.min(180, 1300 / n));
    tool.className = 'us-tool wild hold';
    later(() => tool.classList.add('in'), 100);
    later(() => {
      for (let i = 0; i < n; i++) later(() => {
        // each flying card is a copy of the item's art
        const [sx, sy] = center(tool), [cx, cy] = center(card), f = document.createElement('span');
        f.className = 'us-flyer'; f.innerHTML = d.itemSvg; el.appendChild(f);
        const dx = cx - sx, dy = cy - sy, rot = (Math.random() - 0.5) * 80;
        f.style.left = sx + 'px'; f.style.top = sy + 'px';
        const a = f.animate([
          { transform: 'translate(-50%,-50%) scale(.5) rotate(0deg)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - 70}px)) scale(.9) rotate(${rot}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.25) rotate(${rot * 2}deg)`, opacity: 0.2 },
        ], { duration: 560, easing: 'cubic-bezier(.4,0,.6,1)' });
        S.flyers = (S.flyers || []).concat(f);
        a.onfinish = () => {
          f.remove();
          if (!S || S.finished) return;
          snd('partSnap'); sparks(cx, cy, 6, colors(), 180);
          card.classList.remove('gulp'); void card.offsetWidth; card.classList.add('gulp');
          const got = Math.round(d.gives * (i + 1) / n);
          bar(d.before.count + got, d.after.need, d.after.max);
          if (got) { $('usGain').innerHTML = `<span class="plus">+${fmt(got)}</span>`; $('usGain').className = 'us-gain on'; }
        };
      }, i * gap);
    }, 650);
    const doneAt = 650 + (n - 1) * gap + 620;
    later(() => { tool.className = 'us-tool wild gone'; fillBurst(); }, doneAt);
  }

  /* ---------- books ---------- */
  // An open book, its pages spread and one page turning. Drawn here, as a separate picture from the
  // closed book in js/items.js.
  function openBook(item) {
    const M = KCProgress.MAGIC[item], p = (KCItems.PAL[M.rarity] || KCItems.PAL.any), O = '#1c1530';
    const cov = item === 'book_books' ? 'url(#usRb)' : p[1];
    return `<svg class="us-open" viewBox="0 0 140 90" aria-hidden="true"><defs>
        <linearGradient id="usRb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7ff0e0"/><stop offset=".33" stop-color="#7fa8ff"/><stop offset=".66" stop-color="#d48cff"/><stop offset="1" stop-color="#ffab4a"/></linearGradient>
        <radialGradient id="usBl" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="${p[3]}" stop-opacity=".6"/><stop offset="1" stop-color="${p[3]}" stop-opacity="0"/></radialGradient></defs>
      <ellipse class="us-bglow" cx="70" cy="40" rx="68" ry="42" fill="url(#usBl)"/>
      <path d="M6 22q32-10 64 0v58q-32-10-64 0z" fill="${cov}" stroke="${O}" stroke-width="3" transform="translate(-3 3)"/>
      <path d="M70 22q32-10 64 0v58q-32-10-64 0z" fill="${cov}" stroke="${O}" stroke-width="3" transform="translate(3 3)"/>
      <path d="M8 20q31-9 62 0v56q-31-9-62 0z" fill="#fffaf0" stroke="${O}" stroke-width="2.6"/>
      <path d="M70 20q31-9 62 0v56q-31-9-62 0z" fill="#f2e6c8" stroke="${O}" stroke-width="2.6"/>
      <path d="M18 32q24-6 44 0M18 42q24-6 44 0M18 52q24-6 44 0M18 62q24-6 44 0M78 32q24-6 44 0M78 42q24-6 44 0M78 52q24-6 44 0M78 62q24-6 44 0" stroke="#b9a37c" stroke-width="1.6" fill="none"/>
      <g class="us-turn"><path d="M70 20q31-9 62 0v56q-31-9-62 0z" fill="#fffdf6" stroke="${O}" stroke-width="2.4"/></g>
      <g class="us-turn t2"><path d="M70 20q31-9 62 0v56q-31-9-62 0z" fill="#fffdf6" stroke="${O}" stroke-width="2.4"/></g>
      <path d="M70 20v58" stroke="${O}" stroke-width="2.4"/>
    </svg>`;
  }
  function bookRun() {
    const d = S.d, tool = $('usTool'), rainbow = d.item === 'book_books';
    tool.className = 'us-tool book hold';
    later(() => { tool.classList.add('in'); snd('cardFly'); }, 100);
    later(() => { tool.classList.add('shake'); snd('chestShake'); }, 650);
    later(() => {
      tool.className = 'us-tool book hold in opened'; snd('bookOpen');
      const [x, y, w] = center(tool); flash(x, y, w * 0.7, colors()[0]); sparks(x, y, 30, colors(), 300, true);
    }, 1150);
    // pages stream from the book into the card
    const pages = 14, start = 1450, gap = 70;
    for (let i = 0; i < pages; i++) later(() => {
      const [sx, sy] = center(tool, 0.4), [cx, cy] = center($('usCard'));
      if (i % 3 === 0) snd('pageFlip');
      fly(i % 2 && rainbow ? 'orb' : 'page', sx + (Math.random() - 0.5) * 50, sy, cx + (Math.random() - 0.5) * 36, cy + (Math.random() - 0.5) * 36, 0.6, colors()[i % colors().length], () => {
        if (!S || S.finished) return;
        snd('partSnap'); sparks(cx, cy, 4, colors(), 160);
        const card = $('usCard'); card.classList.remove('gulp'); void card.offsetWidth; card.classList.add('gulp');
        const got = Math.round(d.gives * (i + 1) / pages);
        bar(d.before.count + got, d.after.need, d.after.max);
        if (got) { $('usGain').innerHTML = `<span class="plus">+${fmt(got)}</span>`; $('usGain').className = 'us-gain on'; }
      });
    }, start + i * gap);
    later(() => { tool.className = 'us-tool book gone'; fillBurst(); }, start + (pages - 1) * gap + 750);
  }
  // The end of a wild card or book: the card soaks it up and glows, its bar full if it can level.
  function fillBurst() {
    const d = S.d, card = $('usCard'), [x, y, w] = center(card), ready = !d.after.max && d.after.count >= d.after.need;
    card.className = 'us-card filled';
    flash(x, y, w * 0.9, colors()[0]);
    sparks(x, y, ready ? 50 : 26, colors(), 320);
    snd(ready ? 'revealNew' : 'revealRare');
    later(finish, 500);
  }

  return { play, close, get open() { return !!S; } };
})();
