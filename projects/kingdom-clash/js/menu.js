/* Kingdom Clash: the lobby. A top bar (name, level and experience, coins and diamonds, sound,
   settings), the tabs (Shop, Cards, Battle, Clan, Trophy Road) and a bottom navigation bar.

   All progress and its rules live in KCProgress (progress.js); this file only shows them.

   Battle tab: the arena centerpiece (img/training-grounds.webp, transparent) with its empty bar filled
   from progress: trainers beaten in the Training Grounds, trophies toward the next arena once the
   Trophy Road is open. Under it: the opponent (trophy battle or a trainer, picked from a panel), the
   Battle button and four chest slots. Cards tab: the deck (swap cards in), the collection with levels
   and copies, and a details window with Upgrade. Trophy Road tab: the road's rewards to claim. Shop tab:
   the day's five offers. Chests, road cards and purchases all open in the same reveal scene. */
'use strict';

const KCMenu = (() => {
  const $ = q => document.querySelector(q), $$ = q => document.querySelectorAll(q);
  const G = KCProgress;
  const TABS = ['shop', 'cards', 'battle', 'clan', 'road'];
  const imgs = {};
  let opts = {}, tabNow = 'battle', swapId = null, ticker = 0;
  const P = () => G.state;

  // A card's picture (evo: its evolved version's card), drawn once and kept.
  const cardImg = (id, evo) => {
    const key = evo ? id + ':evo' : id;
    if (imgs[key]) return imgs[key];
    const url = KCArt.portrait(id, 200, 240, { evo: !!evo }).toDataURL(), art = !evo && KC_CARDS[id] && KC_CARDS[id].art;
    // an illustrated picture still loading: don't keep the stand-in
    if (art && !KCArenas.ready(KCArenas.image(art))) return url;
    return (imgs[key] = url);
  };
  // once each illustrated card picture loads, redraw what shows it
  for (const id of KC_ALL_CARDS) if (KC_CARDS[id].art) KCArenas.whenReady(KC_CARDS[id].art, () => { delete imgs[id]; if (P()) refresh(); });
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const recText = r => (r.w + r.l + r.d ? `${r.w}W · ${r.l}L${r.d ? ` · ${r.d}D` : ''}` : 'No matches yet');
  const dur = sec => (sec >= 3600 ? `${Math.round(sec / 3600)}h` : sec >= 60 ? `${Math.round(sec / 60)}m` : `${sec}s`);
  const clock = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };

  /* ---------- what the Battle button plays ---------- */
  function nextFoe(kind) {
    if ((kind || G.mode()) === 'trophy') return G.trophyFoe();
    return G.trainer();
  }
  // Called by the game when a match ends; returns what changed, for the result screen.
  // crowns: the crowns you took, which count toward the Diamond Pass in trophy battles.
  function recordResult(foe, winner, crowns) {
    const r = foe.kind === 'trophy' ? G.recordTrophy(winner, crowns) : G.recordTrainer(foe.id, winner);
    return r;
  }

  // TEMPORARY test button: counts a win against the current opponent without playing the match,
  // with the same rewards as a real win.
  function simulateWin() {
    const foe = nextFoe(), r = recordResult(foe, 0, 3);
    const bits = [r.unlockedNext ? `${r.unlockedNext.name} unlocked` : '', r.roadOpened ? 'Trophy Road unlocked' : '',
      r.kind === 'trophy' ? `+${r.delta} trophies` : '', r.chest ? `${r.chest.name} earned` : '', r.slotsFull ? 'chest slots are full' : '',
      r.levelUp ? `level ${r.levelUp}` : ''].filter(Boolean);
    if (G.roadOpen()) KCArenas.preload(G.arena().theme);
    KCSound.play('crown');
    refresh();
    toast(`Simulated win vs ${foe.name}${bits.length ? ': ' + bits.join(', ') : ''}`);
  }

  /* ---------- small messages ---------- */
  let toastT = 0;
  function toast(text) {
    const t = $('#lobbyToast');
    t.textContent = text; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- tabs and popovers ---------- */
  function tab(name) {
    if (!TABS.includes(name)) return;
    tabNow = name;
    closePops();
    if (name !== 'cards') endSwap();
    for (const b of $$('.nb')) { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); }
    placeGlow();
    const prev = [...$$('.lobby-main .tab')].find(el => !el.hidden && !el.classList.contains('tab-out')), next = $('#tab-' + name);
    if (prev && prev !== next && !$('#home').hidden) slideTabs(prev, next, TABS.indexOf(name) > TABS.indexOf(prev.id.slice(4)) ? 1 : -1);
    else { finishSlide(); for (const el of $$('.lobby-main .tab')) el.hidden = el !== next; }
    if (name === 'road' && G.roadOpen() && !P().roadSeen) { P().roadSeen = true; G.save(); }
    refresh();
    if (name === 'road') requestAnimationFrame(scrollRoad);
  }
  // Tabs slide in from the side their button is on; the old tab slides out the other way.
  let sliding = null;
  function slideTabs(prev, next, dir) {
    finishSlide();
    const main = $('.lobby-main'), scroll = main.scrollTop;
    const box = { top: prev.offsetTop - scroll, left: prev.offsetLeft, width: prev.offsetWidth, height: prev.offsetHeight };
    main.scrollTop = 0;
    for (const k in box) prev.style[k] = box[k] + 'px';
    prev.classList.add('tab-out', dir > 0 ? 'out-left' : 'out-right');
    for (const el of $$('.lobby-main .tab')) if (el !== prev) el.hidden = el !== next;
    next.classList.add(dir > 0 ? 'in-right' : 'in-left');
    const done = e => { if (e.target === next) finishSlide(); };
    next.addEventListener('animationend', done);
    sliding = { prev, next, done, timer: setTimeout(finishSlide, 450) };
  }
  function finishSlide() {
    if (!sliding) return;
    const { prev, next, done, timer } = sliding;
    sliding = null;
    clearTimeout(timer);
    next.removeEventListener('animationend', done);
    prev.hidden = true;
    prev.removeAttribute('style');
    prev.classList.remove('tab-out', 'out-left', 'out-right');
    next.classList.remove('in-left', 'in-right');
  }
  // The gold highlight behind the selected button glides to it.
  function placeGlow() {
    const on = $('.nb.on'), g = $('#nbGlow');
    if (!on || !g) return;
    g.style.width = on.offsetWidth + 'px';
    g.style.transform = `translateX(${on.offsetLeft}px)`;
  }

  function closePops() {
    $('#oppPanel').hidden = true; $('#oppChange').setAttribute('aria-expanded', 'false');
    $('#settings').hidden = true; $('#settingsBtn').setAttribute('aria-expanded', 'false');
  }
  function toggle(panel, btn) {
    const open = $(panel).hidden;
    closePops();
    $(panel).hidden = !open;
    $(btn).setAttribute('aria-expanded', String(open));
    return open;
  }

  /* ---------- chests ---------- */
  // Each chest is drawn as a base and a lid, so the lid can lift when it opens (CSS: .chest-svg.open).
  const CHEST_LOOK = {
    wooden: { body: '#b2733a', bodySh: '#8a5426', lid: '#c98a48', lidSh: '#a36a30', band: '#5f6573', bandSh: '#474c58', trim: '#8a909e', lock: '#d9a032', glow: '#fff0b0' },
    silver: { body: '#8fa1ba', bodySh: '#6a7c96', lid: '#aebccf', lidSh: '#8797ae', band: '#eef2f8', bandSh: '#c5cfdd', trim: '#f6f9fc', lock: '#4aa8ff', glow: '#d8f0ff' },
    gold: { body: '#e6a81e', bodySh: '#b98008', lid: '#f8c636', lidSh: '#d99a10', band: '#b3202a', bandSh: '#8a1620', trim: '#fff0a0', lock: '#ff4d5a', glow: '#fff3a0' },
    platinum: { body: '#c9d4e2', bodySh: '#9eadc2', lid: '#e4ebf4', lidSh: '#b9c6d8', band: '#4fbcd4', bandSh: '#358fa6', trim: '#ffffff', lock: '#2fe0cf', glow: '#dcfcff' },
    legendary: { body: '#6a2a86', bodySh: '#4c1a63', lid: '#8a3aa8', lidSh: '#6c2a88', band: '#ff9a2e', bandSh: '#d9731a', trim: '#ffd25a', lock: '#ff5a2e', glow: '#ffd9a0', halo: '#ff9a3d' },
    mythic: { body: '#24296a', bodySh: '#171a4a', lid: '#343c98', lidSh: '#262c78', band: '#6ff0de', bandSh: '#43c2b2', trim: '#d8c8ff', lock: '#ff6bd5', glow: '#eadcff', halo: '#a98bff' },
  };
  // A small four-point sparkle centred on (x, y).
  const spark = (x, y, r) => `<path d="M${x} ${y - r}l${r * 0.3} ${r * 0.7} ${r * 0.7} ${r * 0.3}-${r * 0.7} ${r * 0.3}-${r * 0.3} ${r * 0.7}-${r * 0.3}-${r * 0.7}-${r * 0.7}-${r * 0.3} ${r * 0.7}-${r * 0.3}z"/>`;
  function chestSvg(type, open) {
    const L = CHEST_LOOK[type] || CHEST_LOOK.wooden, O = '#1c1530';
    const fancy = type === 'legendary' || type === 'mythic';
    // decoration on the front of the base
    const front = {
      wooden: [44, 60, 76].map(x => `<path d="M${x} 59v36" stroke="${L.bodySh}" stroke-width="2"/>`).join(''),
      silver: [[44, 68], [76, 68], [44, 86], [76, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${L.trim}"/>`).join(''),
      gold: `<path d="M46 62h28v26H46z" fill="${L.band}" stroke="${O}" stroke-width="2"/><path d="M52 78l3-9 5 6 5-6 3 9z" fill="${L.trim}"/>`,
      platinum: [[42, 66], [78, 66], [42, 88], [78, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${L.trim}"/>`).join('') +
        `<path d="M60 62l9 10-9 11-9-11z" fill="${L.lock}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M57 68l3-3 3 3" stroke="#fff" stroke-width="1.6" fill="none"/>`,
      legendary: `<path d="M45 61h30v28H45z" fill="${L.bodySh}" stroke="${O}" stroke-width="2"/>` +
        `<path class="ch-flame" d="M60 64c7 6 9 12 4 19 1-6-4-8-4-8s-5 2-4 8c-5-7-3-13 4-19z" fill="${L.band}" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>`,
      mythic: `<path d="M45 61h30v28H45z" fill="${L.bodySh}" stroke="${O}" stroke-width="2"/>` +
        `<path d="M60 63l3.2 7.3 7.8.9-5.8 5.3 1.6 7.7L60 80.3l-6.8 3.9 1.6-7.7-5.8-5.3 7.8-.9z" fill="${L.band}" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>`,
    }[type] || '';
    // drawn inside the lid group, so they lift with it
    const lidPlanks = type === 'wooden' ? [46, 60, 74].map(x => `<path d="M${x} 20v22" stroke="${L.lidSh}" stroke-width="2"/>`).join('') : '';
    const lock = type === 'wooden'
      ? `<rect x="52" y="42" width="16" height="20" rx="4" fill="${L.lock}" stroke="${O}" stroke-width="3"/><circle cx="60" cy="50" r="2.6" fill="${O}"/><path d="M60 50v6" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>`
      : `<rect x="51" y="41" width="18" height="22" rx="5" fill="${L.trim}" stroke="${O}" stroke-width="3"/><path d="M60 45l6 7-6 8-6-8z" fill="${L.lock}" stroke="${O}" stroke-width="2"/>`;
    const crown = type === 'gold' || fancy
      ? `<path d="M48 16l2-12 6 7 4-9 4 9 6-7 2 12z" fill="${type === 'gold' ? L.trim : '#ffcf3f'}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="60" cy="11" r="2" fill="${L.lock}"/>`
      : '';
    const wings = type === 'platinum'
      ? `<path d="M14 40c-8-2-12-8-12-14 5 3 8 3 12 2M106 40c8-2 12-8 12-14-5 3-8 3-12 2" fill="${L.trim}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`
      : '';
    const stars = type === 'gold' || fancy
      ? `<g class="ch-stars" fill="#fff">${spark(20, 34, 5)}${spark(101, 26, 4)}${spark(99, 74, 3.2)}</g>` : '';
    // the animated chests: a glowing halo behind, and sparkles circling
    const halo = fancy ? `<g class="ch-aura"><ellipse cx="60" cy="58" rx="58" ry="52" fill="${L.halo}" opacity="0.35"/><ellipse cx="60" cy="58" rx="42" ry="38" fill="${L.halo}" opacity="0.45"/></g>` : '';
    const orbit = fancy
      ? `<g class="ch-orbit" fill="${type === 'mythic' ? '#eadcff' : '#ffe1a0'}">${spark(60, 2, 4.5)}${spark(116, 58, 3.5)}${spark(60, 114, 4)}${spark(4, 58, 3.5)}</g>` : '';
    return `<svg class="chest-svg chest-${type}${open ? ' open' : ''}" viewBox="0 0 120 110" aria-hidden="true">
      ${halo}
      <ellipse cx="60" cy="100" rx="46" ry="7" fill="rgba(0,0,0,0.3)"/>
      <g class="ch-all">
        <path class="ch-beam" d="M26 50L6 -40h108L94 50z" fill="${L.glow}"/>
        <g class="ch-inside"><path d="M17 30h86v26H17z" fill="#1a0f1e" stroke="${O}" stroke-width="3"/><ellipse class="ch-glow" cx="60" cy="50" rx="38" ry="12" fill="${L.glow}"/></g>
        <g class="ch-shell">
          <g class="ch-base">
            <rect x="14" y="52" width="92" height="44" rx="6" fill="${L.body}" stroke="${O}" stroke-width="3"/>
            <path d="M15.5 82h89v8a4.5 4.5 0 0 1-4.5 4.5h-80a4.5 4.5 0 0 1-4.5-4.5z" fill="${L.bodySh}"/>
            ${front}
            <rect x="24" y="52" width="11" height="44" fill="${L.band}" stroke="${O}" stroke-width="2.5"/><rect x="85" y="52" width="11" height="44" fill="${L.band}" stroke="${O}" stroke-width="2.5"/>
            <path d="M25.5 84h8v10.5h-8zM86.5 84h8v10.5h-8z" fill="${L.bandSh}"/>
            <rect x="11" y="50" width="98" height="9" rx="3" fill="${L.trim}" stroke="${O}" stroke-width="3"/>
          </g>
          <g class="ch-lid">
            ${wings}
            <path d="M14 52V38Q14 14 60 14Q106 14 106 38V52Z" fill="${L.lid}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
            ${lidPlanks}
            <path d="M22 30Q30 19 52 17" stroke="rgba(255,255,255,0.45)" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M24 23.5L35 19V50H24zM85 19l11 4.5V50H85z" fill="${L.band}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
            <rect x="11" y="43" width="98" height="9" rx="3" fill="${L.trim}" stroke="${O}" stroke-width="3"/>
            ${crown}${lock}
          </g>
        </g>
      </g>
      ${orbit}${stars}
    </svg>`;
  }
  function renderChests() {
    const open = G.roadOpen(), now = Date.now();
    const busy = G.unlockingSlot(now) >= 0;
    $('#chests').innerHTML = P().chests.map((c, i) => {
      if (!open) return `<div class="slot locked" aria-label="Chest slot ${i + 1}: locked"><span class="slot-lock" aria-hidden="true"></span><small>Locked</small></div>`;
      const st = G.chestState(i, now);
      if (st === 'empty') return `<div class="slot empty" aria-label="Chest slot ${i + 1}: empty"><small>Empty</small></div>`;
      const C = G.CHESTS[c.type];
      const label = st === 'ready' ? 'Open!' : st === 'unlocking' ? clock(c.ends - now) : busy ? `${C.name.split(' ')[0]} · ${dur(C.seconds)}` : `Unlock ${dur(C.seconds)}`;
      const cls = st === 'ready' ? 'ready' : st === 'unlocking' ? 'unlocking' : 'chest';
      return `<button type="button" class="slot ${cls} ${c.type}" data-slot="${i}" aria-label="${C.name}: ${label}">${chestSvg(c.type)}<small>${label}</small></button>`;
    }).join('') + `<p class="chest-note">${open ? (P().chests.some(Boolean) ? 'One chest unlocks at a time.' : 'Win trophy battles to earn chests') : 'Chests unlock with the Trophy Road'}</p>`;
    chestSig = open ? chestStates() : '';
    for (const b of $$('#chests button.slot')) b.addEventListener('click', () => chestClick(+b.dataset.slot));
  }
  function chestClick(i) {
    const st = G.chestState(i), c = P().chests[i];
    if (st === 'ready') { const got = G.openChest(i); if (got) showChest(got.chest, got); }
    else if (st === 'locked') {
      const r = G.startUnlock(i);
      if (r === 'busy') toast('Another chest is unlocking. One at a time!');
      else if (r === 'ok') { toast(`${G.CHESTS[c.type].name} is unlocking`); KCSound.play('select'); }
    } else if (st === 'unlocking') toast(`Opens in ${clock(c.ends - Date.now())}.`);
    refresh();
  }

  /* ---------- opening a chest ----------
     The chest drops in and rattles; a click cracks it open in a burst of light. Then each reward comes
     out one at a time: coins count up; a card flies out face down, glowing in its rarity's colour, flips
     over, and its copies count into its level bar. A click during a reveal finishes it; a click after
     moves on. Rares and new cards come last. The same scene shows Trophy Road cards and Shop purchases
     (no chest, just the reveal). */
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let co = null;
  const later = (fn, ms) => { const id = setTimeout(fn, calm ? Math.min(ms, 60) : ms); co.timers.push(id); return id; };
  // the magic circle that turns behind an item while it forms
  const SIGIL = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 4.5"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="2.6" opacity=".75"/>
    <path d="M50 12L83 69H17zM50 88L17 31H83z" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="6 3" opacity=".8"/></svg>`;
  function stopTimers() { for (const t of co.timers) clearTimeout(t); co.timers = []; clearInterval(co.counter); co.counter = 0; }

  // sparkles and coins, drawn on one canvas over the scene
  const FX = { parts: [], raf: 0, last: 0 };
  function fxStart() {
    const cv = $('#coFx'), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    FX.dpr = dpr; FX.parts = []; FX.last = 0;
    if (!FX.raf) FX.raf = requestAnimationFrame(fxFrame);
  }
  function fxStop() { cancelAnimationFrame(FX.raf); FX.raf = 0; FX.parts = []; }
  // size scales the sparkles (1 is the usual size)
  function fxBurst(el, n, kind, cols, size = 1) {
    if (calm || !el) return;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.45;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * (kind === 'coin' ? 1.8 : 3.6), v = (kind === 'coin' ? 320 : 240) * (0.5 + Math.random());
      FX.parts.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: kind === 'coin' ? 900 : 320, life: 0.9 + Math.random() * 0.8, max: 1.7,
        r: kind === 'coin' ? 6 + Math.random() * 3 : (2 + Math.random() * 3) * size, col: cols[Math.floor(Math.random() * cols.length)], spin: Math.random() * 6 });
    }
    if (FX.parts.length > 260) FX.parts.splice(0, FX.parts.length - 260);
  }
  // A glowing comet from (x0, y0) to (x1, y1) over dur seconds, trailing light: one flies in with
  // each part of a magic item.
  function fxComet(x0, y0, x1, y1, dur, col) {
    if (calm) return;
    FX.parts.push({ kind: 'comet', x0, y0, x1, y1, t: 0, dur, col, trail: [], life: dur + 0.25, max: dur + 0.25, x: x0, y: y0, vx: 0, vy: 0, g: 0, spin: 0 });
  }
  // A white flash and a shockwave ring in the item's colour, centred on el.
  function fxFlash(el, col) {
    if (calm || !el) return;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    FX.parts.push({ kind: 'flash', x, y, vx: 0, vy: 0, g: 0, spin: 0, life: 0.5, max: 0.5, r: r.width * 0.9, col: '#ffffff' });
    FX.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, g: 0, spin: 0, life: 0.7, max: 0.7, r: r.width * 1.5, col });
    FX.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, g: 0, spin: 0, life: 0.55, max: 0.55, r: r.width * 1.0, col: '#ffffff' });
  }
  function fxFrame(now) {
    FX.raf = requestAnimationFrame(fxFrame);
    const dt = Math.min(0.05, (now - (FX.last || now)) / 1000); FX.last = now;
    const cv = $('#coFx'), c = cv.getContext('2d');
    c.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of FX.parts) {
      p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.spin += dt * 8;
      c.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.kind === 'comet') {
        p.t += dt;
        const q = Math.min(1, p.t / p.dur), e = 1 - Math.pow(1 - q, 3);
        // a slight curve, so the comets swirl in rather than fly straight
        const bend = Math.sin(q * Math.PI) * 0.18, dx = p.x1 - p.x0, dy = p.y1 - p.y0;
        p.x = p.x0 + dx * e - dy * bend; p.y = p.y0 + dy * e + dx * bend;
        if (q < 1) p.trail.push([p.x, p.y]);
        if (p.trail.length > 14 || (q >= 1 && p.trail.length)) p.trail.shift();
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        for (let k = 1; k < p.trail.length; k++) {
          const f = k / p.trail.length;
          c.globalAlpha = f * 0.8; c.strokeStyle = p.col; c.lineWidth = 1 + f * 7;
          c.beginPath(); c.moveTo(p.trail[k - 1][0], p.trail[k - 1][1]); c.lineTo(p.trail[k][0], p.trail[k][1]); c.stroke();
        }
        if (q < 1) {
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12);
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, p.col); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 12, 0, 6.3); c.fill();
        }
        c.restore();
        continue;
      }
      if (p.kind === 'flash' || p.kind === 'ring') {
        const a = 1 - p.life / p.max;
        c.save(); c.globalCompositeOperation = 'lighter';
        if (p.kind === 'flash') {
          const rr = p.r * (0.4 + a * 0.8), g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
          g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - a)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, rr, 0, 6.3); c.fill();
        } else {
          c.globalAlpha = (1 - a) * 0.9; c.strokeStyle = p.col; c.lineWidth = 2 + (1 - a) * 8;
          c.beginPath(); c.arc(p.x, p.y, p.r * (0.25 + a * 0.75), 0, 6.3); c.stroke();
        }
        c.restore();
        continue;
      }
      if (p.kind === 'coin') {
        c.beginPath(); c.ellipse(p.x, p.y, p.r * Math.abs(Math.cos(p.spin)) + 1, p.r, 0, 0, 6.3);
        c.fillStyle = p.col; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#8a5a05'; c.stroke();
      } else {
        const s = p.r * (0.6 + 0.4 * Math.sin(p.spin * 2));
        c.fillStyle = p.col; c.beginPath();
        c.moveTo(p.x, p.y - s * 2); c.lineTo(p.x + s * 0.6, p.y - s * 0.6); c.lineTo(p.x + s * 2, p.y); c.lineTo(p.x + s * 0.6, p.y + s * 0.6);
        c.lineTo(p.x, p.y + s * 2); c.lineTo(p.x - s * 0.6, p.y + s * 0.6); c.lineTo(p.x - s * 2, p.y); c.lineTo(p.x - s * 0.6, p.y - s * 0.6);
        c.closePath(); c.fill();
      }
    }
    c.globalAlpha = 1;
    FX.parts = FX.parts.filter(p => p.life > 0 && (p.kind === 'comet' || p.y < innerHeight + 20));
  }
  const SPARKS = { platinum: ['#dcfcff', '#8ff0ff', '#ffffff'], legendary: ['#ffd25a', '#ff9a3d', '#ff5a2e', '#ffffff'], mythic: ['#eadcff', '#a98bff', '#6ff0de', '#ff6bd5', '#ffffff'],
    wooden: ['#ffe9a0', '#ffc861', '#ffffff'], silver: ['#d8f0ff', '#9fd0ff', '#ffffff'], gold: ['#fff3a0', '#ffd23f', '#ff9a3d', '#ffffff'] };

  // type: 'wooden' | 'silver' | 'gold', or null for a reward with no chest. got: { coins, cards: [{ id, n, isNew }] },
  // already added to the player's collection.
  function showChest(type, got, title) {
    // commons first, building up to the rarest; within a rarity, new cards last
    const rank = c => ({ common: 0, rare: 2, epic: 4, legendary: 6 }[KC_CARDS[c.id].rarity] || 0) + (c.isNew ? 1 : 0);
    const cards = got.cards.slice().sort((a, b) => rank(a) - rank(b));
    const steps = [];
    if (got.coins) steps.push({ coins: got.coins });
    for (const c of cards) {
      const u = G.upgradeInfo(c.id);
      steps.push(Object.assign({ level: u.level, need: u.max ? 0 : u.need, after: u.count, before: Math.max(0, u.count - c.n) }, c));
    }
    const items = (got.items || []).slice().sort((a, b) => (a.id.startsWith('wild_') ? 0 : 1) - (b.id.startsWith('wild_') ? 0 : 1));
    for (const it of items) steps.push({ item: it.id, n: it.n });
    if (co) stopTimers();
    co = { type, got: { coins: got.coins, cards, items }, steps, i: -1, phase: 'drop', timers: [], counter: 0, done: false };
    const chest = $('#coChest');
    $('#coTitle').textContent = title || (type ? G.CHESTS[type].name : 'Reward');
    $('#chestOpen').className = 'chest-open' + (type ? ' has-chest ' + type : ' no-chest');
    $('#coChestWrap').hidden = !type;
    chest.innerHTML = type ? chestSvg(type) : '';
    $('#coRays').className = 'co-rays ' + (type || '');
    $('#coCount').hidden = true;
    $('#coReward').hidden = true; $('#coReward').innerHTML = '';
    $('#coSummary').hidden = true; $('#coDone').hidden = true;
    $('#coHint').hidden = false; $('#coHint').textContent = '';
    $('#chestOpen').hidden = false;
    fxStart();
    if (!type) { co.phase = 'opened'; later(nextReward, 120); return; }
    chest.className = 'co-chest drop';
    later(() => KCSound.play('chestDrop'), 360);
    later(settle, 760);
  }
  function settle() {
    co.phase = 'idle';
    $('#coChest').className = 'co-chest idle';
    $('#coHint').textContent = 'Click to open';
  }
  // Any click (or Space / Enter) on the scene.
  function chestTap() {
    if (!co || co.done) return;
    if (co.phase === 'drop') { stopTimers(); settle(); crack(); }
    else if (co.phase === 'idle') crack();
    else if (co.phase === 'reveal') finishReveal();
    else if (co.phase === 'opened' || co.phase === 'shown') nextReward();
  }
  function crack() {
    co.phase = 'opening';
    $('#chestOpen').classList.add('revealing');
    $('#coHint').textContent = '';
    $('#coChest').className = 'co-chest rattle';
    KCSound.play('chestShake');
    later(() => {
      const svg = $('#coChest svg');
      svg.classList.add('open');
      $('#coChest').className = 'co-chest opened';
      $('#coRays').classList.add('on');
      KCSound.play('chestOpen');
      fxBurst(svg, { wooden: 30, silver: 44, gold: 60, platinum: 72, legendary: 96, mythic: 120 }[co.type] || 40, 'spark', SPARKS[co.type] || SPARKS.gold);
      if (co.type === 'legendary' || co.type === 'mythic') {
        later(() => KCSound.play('revealNew'), 260);
        later(() => fxBurst(svg, 60, 'spark', SPARKS[co.type]), 380);
      }
      const n = $('#coCount'); n.textContent = co.steps.length; n.hidden = false;
      co.phase = 'opened';
      later(nextReward, 750);
    }, 560);
  }
  function nextReward() {
    stopTimers();
    unlockReset();
    co.i++;
    if (co.i >= co.steps.length) return summary();
    reveal(co.steps[co.i]);
  }
  const barText = (st, count) => (st.need ? `${count} / ${st.need}` : 'Max level');
  const barPct = (st, count) => (st.need ? Math.min(100, count / st.need * 100) : 100);
  function reveal(st) {
    co.phase = 'reveal';
    const left = co.steps.length - co.i - 1, box = $('#coReward'), chest = $('#coChest');
    const badge = $('#coCount'); badge.textContent = left; badge.hidden = !co.type || left === 0;
    if (co.type) { chest.classList.remove('spit'); void chest.offsetWidth; chest.classList.add('spit'); }
    $('#coHint').textContent = '';
    box.hidden = false;
    KCSound.play(st.item ? 'itemGather' : 'cardFly');
    if (st.coins) {
      box.className = 'co-reward rv-coins';
      box.innerHTML = `<div class="rv-fly"><span class="rv-pile" aria-hidden="true"><i class="co-coin"></i><i class="co-coin"></i><i class="co-coin"></i></span></div>
        <div class="rv-info"><span class="rv-n" id="rvN">+0</span><b class="rv-name">Coins</b></div>`;
      later(() => {
        $('#coReward .rv-info').classList.add('on');
        fxBurst($('#coReward .rv-pile'), 26, 'coin', ['#ffd23f', '#ffe27a', '#f2b01e']);
        count(900, p => { $('#rvN').textContent = '+' + fmt(Math.round(st.coins * p)); }, 'coinTick');
      }, 480);
      later(shown, 1500);
      return;
    }
    if (st.item) {
      // The item's parts fly in from all sides, each trailing a comet, and snap together; then it
      // flashes, a shockwave rolls out and its name appears. Rarer items form more slowly.
      const M = G.MAGIC[st.item], big = M.kind !== 'wild' || M.rarity === 'epic' || M.rarity === 'legendary';
      const n = KCItems.partsOf(st.item), gap = big ? 150 : 105, fly = 470, lead = 180, formAt = lead + (n - 1) * gap + 600;
      box.className = `co-reward rv-item r-${M.rarity} k-${M.kind}${big ? ' big' : ''}`;
      box.innerHTML = `<div class="rv-fly"><span class="rv-sigil" aria-hidden="true">${SIGIL}</span><span class="rv-itemart forming" style="--gap:${gap}ms">${itemSvg(st.item)}</span></div>
        <div class="rv-info"><div class="rv-line"><b class="rv-name">${esc(M.name)}</b><span class="rv-n" id="rvN">×${fmt(st.n)}</span>${big ? '<em>Rare find!</em>' : ''}</div><small>${esc(M.blurb)}</small></div>`;
      const art = $('#coReward .rv-itemart'), cols = KCItems.colors(st.item);
      for (let i = 0; i < n; i++) {
        later(() => {
          const r = art.getBoundingClientRect(), sc = r.width / 100, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const a = i * 2.39996 + 0.6 + (M.kind === 'hammer' ? -0.489 : 0), R = 120 + (i % 3) * 22; // the hammer is drawn turned 28 degrees
          fxComet(cx + Math.cos(a) * R * sc, cy + Math.sin(a) * R * sc, cx + Math.cos(a) * 10 * sc, cy + Math.sin(a) * 10 * sc, fly / 1000, cols[i % cols.length]);
        }, lead + i * gap);
        later(() => { KCSound.play('partSnap'); fxBurst(art, 3, 'spark', cols); }, lead + i * gap + fly);
      }
      later(() => {
        art.classList.remove('forming'); art.classList.add('formed'); box.classList.add('formed');
        $('#coReward .rv-info').classList.add('on');
        fxFlash(art, cols[0]);
        KCSound.play(M.kind === 'hammer' ? 'hammerForm' : big ? 'revealNew' : 'revealRare');
        fxBurst(art, big ? 46 : 20, 'spark', cols);
      }, formAt);
      later(shown, formAt + (big ? 700 : 450));
      return;
    }
    const c = KC_CARDS[st.id], special = st.isNew || c.rarity !== 'common';
    box.className = `co-reward rv-card ${c.rarity}${st.isNew ? ' is-new' : ''}`;
    box.innerHTML = `<div class="rv-fly"><div class="rv-flip"><div class="rv-back"></div><img class="rv-front" src="${cardImg(st.id)}" alt=""></div></div>
      <div class="rv-info">
        <div class="rv-line"><b class="rv-name">${esc(c.name)}</b><span class="rv-n" id="rvN">×0</span>${st.isNew ? '<em>New card!</em>' : ''}</div>
        <div class="rv-bar" id="rvBar"><i style="width:${barPct(st, st.before).toFixed(1)}%"></i><span>${barText(st, st.before)}</span></div>
        <small id="rvNote"><span class="rar ${c.rarity}">${c.rarity}</span> Level ${st.level}</small>
      </div>`;
    // every card gets its rarity's show; a new one says so on the banner
    unlock(st, c); return;
    const flipAt = special ? 1350 : 850;
    later(() => { $('#coReward .rv-fly').classList.add('tease'); if (special) KCSound.play('chestShake'); }, 560);
    later(() => { $('#coReward .rv-flip').classList.add('flipped'); KCSound.play('cardFlip'); }, flipAt);
    later(() => {
      $('#coReward .rv-info').classList.add('on');
      KCSound.play(st.isNew ? 'revealNew' : c.rarity === 'rare' ? 'revealRare' : 'revealCommon');
      fxBurst($('#coReward .rv-flip'), special ? 30 : 12, 'spark', c.rarity === 'rare' ? ['#ffd27a', '#ffb347', '#ffffff'] : ['#bfe0ff', '#ffffff']);
      count(Math.min(1100, 350 + st.n * 30), p => cardCount(st, Math.round(st.n * p)), 'countTick');
    }, flipAt + 420);
    later(shown, flipAt + 420 + Math.min(1100, 350 + st.n * 30) + 250);
  }
  /* ---------- a new card's unlock, one show for each rarity ----------
     Common: a blue burst and a shine. Rare: the card shakes, embers rise and gold rays fan out before
     it flips in a double flash. Epic: the screen dims, a violet vortex turns behind the shaking card and
     lightning streaks into it, then it implodes into a shockwave. Legendary: the screen goes dark,
     rainbow beams sweep, the card comes down slowly in a spinning halo while rainbow comets pour into
     it, the screen rumbles, a white-out, and rainbow fireworks. Each ends on its own banner. */
  const UL = {
    common: { flip: 900, cols: ['#8fd0ff', '#cdeaff', '#ffffff'], banner: 'New card!', again: '' },
    rare: { flip: 1700, cols: ['#ffb347', '#ffd98a', '#ff8a3d', '#ffffff'], banner: 'New Rare!', again: 'Rare!' },
    epic: { flip: 2500, cols: ['#d49bff', '#efd4ff', '#9a5ae8', '#ffffff'], banner: 'New Epic!', again: 'Epic!' },
    legendary: { flip: 3600, cols: ['#7ff0e0', '#9fb8ff', '#d49bff', '#ff8fd8', '#ffc35a', '#ffffff'], banner: 'Legendary!', again: 'Legendary!' },
  };
  function unlockReset() {
    const u = $('#coUnlock');
    if (u) u.className = 'co-unlock';
  }
  function unlock(st, c) {
    const r = UL[c.rarity] ? c.rarity : 'common', U = UL[r], u = $('#coUnlock'), fly = $('#coReward .rv-fly'), flip = $('#coReward .rv-flip');
    const at = (fn, ms) => later(fn, ms);
    const centre = () => { const b = flip.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width]; };
    $('#ulBanner').textContent = st.isNew ? U.banner : U.again;
    u.className = `co-unlock ul-${r} on`;
    // centre the light on where the card comes to rest
    // (from its layout box, not its rect, since its entrance animation is moving it)
    const op = fly.offsetParent.getBoundingClientRect(), host = $('#chestOpen').getBoundingClientRect();
    u.style.setProperty('--ux', (op.left + fly.offsetLeft + fly.offsetWidth / 2 - host.left) + 'px');
    u.style.setProperty('--uy', (op.top + fly.offsetTop + fly.offsetHeight / 2 - host.top) + 'px');
    KCSound.play('unlock_' + r);
    if (r === 'common') {
      at(() => { fly.classList.add('tease'); fxBurst(flip, 14, 'spark', U.cols); }, 350);
    } else if (r === 'rare') {
      at(() => { fly.classList.add('tease'); KCSound.play('chestShake'); }, 300);
      for (let i = 0; i < 6; i++) at(() => fxBurst(flip, 5, 'spark', U.cols, 0.5), 400 + i * 180);
    } else if (r === 'epic') {
      at(() => u.classList.add('vortex'), 250);
      at(() => { fly.classList.add('tease'); KCSound.play('chestShake'); }, 500);
      for (let i = 0; i < 8; i++) at(() => {
        const [x, y, w] = centre(), a = i * 2.4 + 0.5, R = Math.max(innerWidth, innerHeight) * 0.45;
        fxComet(x + Math.cos(a) * R, y + Math.sin(a) * R, x, y, 0.45, U.cols[i % 3]);
      }, 700 + i * 170);
      at(() => { u.classList.add('implode'); KCSound.play('rumble'); }, 2050);
    } else {
      fly.classList.add('descend');
      at(() => u.classList.add('beams'), 300);
      at(() => u.classList.add('halo'), 700);
      for (let i = 0; i < 16; i++) at(() => {
        const [x, y] = centre(), a = i * 2.39996, R = Math.max(innerWidth, innerHeight) * 0.55;
        fxComet(x + Math.cos(a) * R, y + Math.sin(a) * R, x, y, 0.55, U.cols[i % U.cols.length]);
        if (i % 4 === 0) KCSound.play('partSnap');
      }, 900 + i * 110);
      at(() => { fly.classList.add('tease'); $('#chestOpen').classList.add('rumble'); KCSound.play('rumble'); }, 2700);
      at(() => u.classList.add('whiteout'), 3400);
    }
    at(() => {
      $('#chestOpen').classList.remove('rumble');
      flip.classList.add('flipped'); KCSound.play('cardFlip');
      u.classList.add('reveal');
      // the rare's gold rays come out as the card turns over
      if (r === 'rare') u.classList.add('beams');
      const [x, y, w] = centre();
      // the flash and sparkles wait until the card has turned face up, so the turn shows
      setTimeout(() => {
        if (!co || co.steps[co.i] !== st) return;
        fxFlash(flip, U.cols[0]);
        fxBurst(flip, { common: 24, rare: 30, epic: 56, legendary: 80 }[r], 'spark', U.cols, { common: 0.8, rare: 0.55, epic: 1, legendary: 1 }[r]);
        if (r === 'rare' || r === 'legendary') setTimeout(() => fxFlash(flip, U.cols[1]), 160);
      }, 300);
      if (r === 'legendary') for (let i = 0; i < 6; i++) setTimeout(() => {
        // fireworks round the card
        const fx = x + (Math.random() - 0.5) * innerWidth * 0.7, fy = y + (Math.random() - 0.6) * innerHeight * 0.5;
        FX.parts.push({ kind: 'ring', x: fx, y: fy, vx: 0, vy: 0, g: 0, spin: 0, life: 0.6, max: 0.6, r: 90, col: U.cols[i % U.cols.length] });
        for (let k = 0; k < 18; k++) { const a = Math.random() * 6.283, v = 120 + Math.random() * 200; FX.parts.push({ kind: 'spark', x: fx, y: fy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 180, life: 0.8 + Math.random() * 0.5, max: 1.3, r: 2 + Math.random() * 3, col: U.cols[k % U.cols.length], spin: 0 }); }
        KCSound.play('firework');
      }, 250 + i * 260);
    }, U.flip);
    const infoAt = U.flip + (r === 'legendary' ? 700 : 450);
    at(() => {
      $('#coReward .rv-info').classList.add('on');
      KCSound.play(r === 'legendary' ? 'unlockFanfare' : st.isNew || r !== 'common' ? 'revealNew' : 'revealCommon');
      count(Math.min(1100, 350 + st.n * 30), p => cardCount(st, Math.round(st.n * p)), 'countTick');
    }, infoAt);
    at(shown, infoAt + Math.min(1100, 350 + st.n * 30) + 300);
  }
  function cardCount(st, n) {
    const now = st.before + n, bar = $('#rvBar');
    $('#rvN').textContent = '×' + n;
    bar.firstElementChild.style.width = barPct(st, now).toFixed(1) + '%';
    bar.lastElementChild.textContent = barText(st, now);
    const ready = st.need && now >= st.need;
    bar.classList.toggle('full', !!ready);
    if (ready && n === st.n) $('#rvNote').innerHTML = `<span class="rar ${KC_CARDS[st.id].rarity}">${KC_CARDS[st.id].rarity}</span> Level ${st.level} · <b class="rv-ready">Upgrade ready!</b>`;
  }
  // Runs fn(0..1) over ms, with a tick sound as it goes.
  function count(ms, fn, sound) {
    clearInterval(co.counter);
    if (calm) { fn(1); return; }
    const t0 = performance.now();
    let lastTick = 0;
    co.counter = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      fn(p);
      if (performance.now() - lastTick > 70) { lastTick = performance.now(); KCSound.play(sound); }
      if (p >= 1) { clearInterval(co.counter); co.counter = 0; }
    }, 33);
  }
  // A click during a reveal: jump to its end.
  function finishReveal() {
    stopTimers();
    const st = co.steps[co.i], info = $('#coReward .rv-info');
    $('#coReward').classList.add('skip');
    if (info) info.classList.add('on');
    if (st.item) { const art = $('#coReward .rv-itemart'); if (art) { art.classList.remove('forming'); art.classList.add('formed'); } $('#coReward').classList.add('formed'); }
    else if (st.coins) $('#rvN').textContent = '+' + fmt(st.coins);
    else {
      $('#coReward .rv-fly').classList.add('tease'); $('#coReward .rv-flip').classList.add('flipped'); cardCount(st, st.n);
      { $('#coUnlock').className = `co-unlock ul-${UL[KC_CARDS[st.id].rarity] ? KC_CARDS[st.id].rarity : 'common'} on reveal`; $('#chestOpen').classList.remove('rumble'); }
    }
    shown();
  }
  function shown() {
    co.phase = 'shown';
    const left = co.steps.length - co.i - 1;
    $('#coHint').textContent = left ? `Click for the next one (${left} left)` : 'Click to finish';
  }
  function summary() {
    stopTimers();
    unlockReset(); $('#chestOpen').classList.remove('rumble');
    co.phase = 'summary'; co.done = true;
    $('#coReward').hidden = true; $('#coChestWrap').hidden = true; $('#coHint').hidden = true;
    $('#chestOpen').classList.add('summing');
    const g = co.got, items = [];
    if (g.coins) items.push(`<span class="rv-pile small" aria-hidden="true"><i class="co-coin"></i><i class="co-coin"></i></span><b>+${fmt(g.coins)}</b>`);
    for (const c of g.cards) items.push(`<img src="${cardImg(c.id)}" alt="${esc(KC_CARDS[c.id].name)}"><b>×${c.n}</b>${c.isNew ? '<em>New</em>' : ''}`);
    for (const it of g.items || []) items.push(`<span class="cs-art" title="${esc(G.MAGIC[it.id].name)}">${itemSvg(it.id)}</span><b>×${fmt(it.n)}</b>`);
    $('#coSummary').innerHTML = items.map((h, i) => `<div class="cs-item" style="animation-delay:${(i * 0.12).toFixed(2)}s">${h}</div>`).join('');
    $('#coSummary').hidden = false; $('#coDone').hidden = false; $('#coDone').focus();
    KCSound.play('chestDone');
  }
  function closeChest() {
    if (co) stopTimers();
    fxStop();
    $('#chestOpen').hidden = true; co = null; refresh();
  }

  /* ---------- the Shop ---------- */
  let confirmOffer = -1, confirmT = 0;
  function renderShop() {
    const shop = G.shop(), p = P();
    $('#shopOffers').innerHTML = passTile() + shop.offers.map((o, i) => {
      const sold = !!shop.bought[o.id] && !o.repeat, gem = o.currency === 'diamonds';
      const poor = !sold && (gem ? p.diamonds : p.coins) < o.price;
      let body;
      if (o.kind === 'coins') {
        body = `<div class="of-art of-coins" aria-hidden="true"><span class="rv-pile"><i class="co-coin"></i><i class="co-coin"></i><i class="co-coin"></i></span></div>
          <b>${fmt(o.qty)} Coins</b><small class="of-note">Buy as many times as you like</small>`;
      } else {
        const c = KC_CARDS[o.card], u = G.upgradeInfo(o.card), after = u.count + (sold ? 0 : o.qty);
        const pct = u.max ? 100 : Math.min(100, after / u.need * 100);
        body = `<div class="of-art ${c.rarity}"><img src="${cardImg(o.card)}" alt=""><span class="of-qty">×${fmt(o.qty)}</span></div>
          <b>${esc(c.name)}</b>
          <span class="of-prog${!u.max && after >= u.need ? ' full' : ''}" title="${u.max ? 'Max level' : sold ? 'Your copies now' : 'Your copies after buying'}"><i style="width:${pct.toFixed(0)}%"></i><em>${u.max ? 'Max level' : `Lv ${u.level} · ${fmt(after)} / ${fmt(u.need)}`}</em></span>`;
      }
      const price = `<i class="${gem ? 'gem-i' : 'coin-i'}" aria-hidden="true"></i>${fmt(o.price)}`;
      const maxed = o.card && G.upgradeInfo(o.card).max;
      const btn = sold ? '<button class="buy-btn" type="button" disabled>Bought</button>'
        : maxed ? '<button class="buy-btn" type="button" disabled>Max level</button>'
        : `<button class="buy-btn${gem ? ' gem' : ''}${poor ? ' poor' : ''}${confirmOffer === i ? ' confirm' : ''}" type="button" data-offer="${i}"
            aria-label="${confirmOffer === i ? 'Confirm: buy' : 'Buy'} for ${o.price} ${gem ? 'diamonds' : 'coins'}">${confirmOffer === i ? 'Confirm ' : ''}${price}</button>`;
      return `<div class="offer ${o.currency}${sold ? ' sold' : ''}"><span class="of-tag">${esc(o.tag)}</span>${body}${btn}</div>`;
    }).join('');
    for (const b of $$('#shopOffers .buy-btn[data-offer]')) b.addEventListener('click', e => { e.stopPropagation(); buyClick(+b.dataset.offer); });
    const pb = $('#shopOffers .buy-btn[data-pass]');
    if (pb) pb.addEventListener('click', e => { e.stopPropagation(); buyPassClick(); });
    const pv = $('#shopOffers .of-see');
    if (pv) pv.addEventListener('click', e => { e.stopPropagation(); openPass(); });
    // the chest row: a free Wooden Chest each day, then every tier for coins (contents stay hidden)
    const oddsText = (t, opts) => {
      const o = G.chestOdds(t, opts), w = G.wildActive() && Object.keys(G.MAGIC_RULES.wild[t] || {}).length;
      const sure = [o.rares ? `${fmt(o.rares)}+ rare` : '', o.epicMin ? `${o.epicMin}+ epic` : '', o.legendaryMin ? `${o.legendaryMin} legendary` : ''].filter(Boolean).join(', ');
      return `${fmt(o.cards)} cards<br>${fmt(o.coins[0])}–${fmt(o.coins[1])} coins${sure ? `<br><span class="ct-sure">${sure}</span>` : ''}${w ? '<br>+ wild cards' : ''}`;
    };
    const free = G.freeChestReady();
    const tiles = [`<div class="chest-tile free wooden${free ? '' : ' sold'}"><span class="of-tag">Free daily</span>
      <div class="ct-art">${chestSvg('wooden')}</div><b>Wooden Chest</b><small class="ct-odds">${oddsText(G.ECONOMY.freeChest.type, { bonus: G.ECONOMY.freeChest.bonus })}</small>
      ${free ? '<button class="buy-btn free-btn" type="button" data-free="1" aria-label="Open your free Wooden Chest">Free</button>'
    : `<button class="buy-btn" type="button" disabled>Next in <span id="freeClock">${clock(G.shopEnds() - Date.now())}</span></button>`}</div>`];
    for (const t of G.TIERS) {
      const C = G.CHESTS[t];
      if (!G.chestAllowed(t)) {
        tiles.push(`<div class="chest-tile locked ${t}"><div class="ct-art">${chestSvg(t)}</div><b>${C.name}</b><small class="ct-odds">${oddsText(t)}</small>
          <span class="ct-locked"><span class="slot-lock" aria-hidden="true"></span>Unlocks in Arena ${G.CHEST_RULES.arena[t]}</span></div>`);
        continue;
      }
      const price = G.chestPrice(t), poor = p.coins < price;
      tiles.push(`<div class="chest-tile ${t}"><div class="ct-art">${chestSvg(t)}</div><b>${C.name}</b><small class="ct-odds">${oddsText(t)}</small>
        <button class="buy-btn${poor ? ' poor' : ''}" type="button" data-chest="${t}" aria-label="Buy a ${C.name} for ${price} coins"><i class="coin-i" aria-hidden="true"></i>${fmt(price)}</button></div>`);
    }
    $('#shopChests').innerHTML = tiles.join('');
    for (const b of $$('#shopChests .buy-btn[data-chest]')) b.addEventListener('click', e => { e.stopPropagation(); buyChestClick(b.dataset.chest); });
    const fb = $('#shopChests .free-btn');
    if (fb) fb.addEventListener('click', e => { e.stopPropagation(); freeChestClick(); });
    // emotes: today's three, each animated on its tile
    $('#shopEmotes').innerHTML = G.emoteOffers().map(o => {
      const poorC = P().coins < o.coins, poorD = P().diamonds < o.diamonds, conf = emoteConfirm === o.id;
      const btns = o.owned ? '<button class="buy-btn" type="button" disabled>Owned</button>'
        : `<span class="eo-btns"><button class="buy-btn${poorC ? ' poor' : ''}" type="button" data-emote="${o.id}" data-cur="coins" aria-label="Buy the ${esc(o.name)} emote for ${o.coins} coins"><i class="coin-i" aria-hidden="true"></i>${fmt(o.coins)}</button>
          <span class="eo-or">or</span>
          <button class="buy-btn gem${poorD ? ' poor' : ''}${conf ? ' confirm' : ''}" type="button" data-emote="${o.id}" data-cur="diamonds" aria-label="${conf ? 'Confirm: buy' : 'Buy'} the ${esc(o.name)} emote for ${o.diamonds} diamond">${conf ? 'Confirm ' : ''}<i class="gem-i" aria-hidden="true"></i>${fmt(o.diamonds)}</button></span>`;
      return `<div class="emote-offer${o.owned ? ' owned' : ''}${o.card ? ' card-emote' : ''}"><span class="eo-art em-live">${KCEmotes.face(o.id, 0)}</span>
        <span class="eo-body"><b>${esc(o.card ? o.name + ' emote' : o.name)}</b><small>${o.owned ? 'In your emote panel' : 'Yours for good: use it in every battle'}</small>${btns}</span></div>`;
    }).join('');
    for (const b of $$('#shopEmotes .buy-btn[data-emote]')) b.addEventListener('click', e => { e.stopPropagation(); buyEmoteClick(b.dataset.emote, b.dataset.cur); });
    shopTimer();
  }
  let emoteConfirm = null, emoteConfirmT = 0;
  function buyEmoteClick(id, cur) {
    // a diamond takes a second click to confirm, like every diamond purchase
    if (cur === 'diamonds' && P().diamonds >= G.EMOTE_SHOP.diamonds && emoteConfirm !== id) {
      emoteConfirm = id; clearTimeout(emoteConfirmT);
      emoteConfirmT = setTimeout(() => { emoteConfirm = null; renderShop(); }, 4000);
      renderShop(); return;
    }
    emoteConfirm = null; clearTimeout(emoteConfirmT);
    const r = G.buyEmote(id, cur);
    if (r.error === 'coins') { KCSound.play('error'); toast('Not enough coins. Win battles and open chests to earn more.'); return; }
    if (r.error === 'diamonds') { KCSound.play('error'); toast('Not enough diamonds. Diamonds will come from the SirSC wallet.'); return; }
    if (!r.ok) return;
    KCSound.play('buy'); setTimeout(() => KCSound.play(id.startsWith('card_') ? 'emCard' : 'em_' + id), 250);
    toast(`${KCEmotes.LABEL[id]} is in your emote panel!`);
    refresh();
  }
  function shopTimer() {
    const left = clock(G.shopEnds() - Date.now());
    for (const el of [$('#shopTimer'), $('#freeClock'), $('#emoteTimer')]) if (el) el.textContent = left;
  }

  /* ---------- the King Tower ---------- */
  // Drawn once per level onto a canvas (and as a picture for the upgrade scene).
  function kingArt(cv, level) {
    const c = cv.getContext('2d'), w = cv.width;
    c.clearRect(0, 0, w, w);
    const g = c.createRadialGradient(w / 2, w * 0.45, w * 0.05, w / 2, w * 0.45, w * 0.55);
    g.addColorStop(0, 'rgba(140,180,255,0.55)'); g.addColorStop(1, 'rgba(140,180,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
    c.save(); c.translate(w / 2, w * 0.62); KCArt.kingTower(c, w * 0.16, { team: 0, face: 1, active: true, t: 0, view: 'front' }); c.restore();
    // its level on a badge
    const r = w * 0.09, x = w * 0.8, y = w * 0.18;
    KCArt.rr(c, x - r, y - r, r * 2, r * 2, r * 0.45); c.fillStyle = '#1a4ba8'; c.fill(); c.lineWidth = w * 0.015; c.strokeStyle = KCArt.OUT; c.stroke();
    c.font = `${Math.round(r * 1.4)}px "Lilita One", "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
    c.fillText(String(level), x, y + 1);
  }
  function kingImg(level) {
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 240;
    const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, '#8cc0f0'); g.addColorStop(1, '#2a4fa0');
    KCArt.rr(c, 0, 0, 200, 240, 20); c.fillStyle = g; c.fill();
    const t = document.createElement('canvas'); t.width = 200; t.height = 200; kingArt(t, level);
    c.drawImage(t, 0, 24);
    return cv.toDataURL();
  }
  function openKing() { renderKing(); $('#kingModal').hidden = false; ($('#kingUp').disabled ? $('#kingX') : $('#kingUp')).focus(); }
  function closeKing() { $('#kingModal').hidden = true; }
  function renderKing() {
    const k = G.kingInfo(), T = KCSim.TOWERS, m = KCSim.levelMult(k.level), mn = KCSim.levelMult(Math.min(15, k.level + 1));
    $('#kingTitle').textContent = `King Tower · Level ${k.level}${k.max ? ' · Max' : ''}`;
    kingArt($('#kingArt'), k.level);
    const stat = (label, v) => { const a = Math.round(v * m), b = Math.round(v * mn); return `<div><small>${label}</small><b>${fmt(a)}${k.max ? '' : `<em>+${fmt(b - a)}</em>`}</b></div>`; };
    $('#kingStats').innerHTML = stat('King Tower health', T.king.hp) + stat('King Tower damage', T.king.dmg) + stat('Archer Tower health', T.archer.hp) + stat('Archer Tower damage', T.archer.dmg);
    if (k.max) {
      $('#kingNeed').innerHTML = '<b>Your King Tower is at the top level.</b>';
    } else {
      const ok = P().found.filter(id => P().cards[id].level >= k.next), rest = P().found.filter(id => P().cards[id].level < k.next);
      $('#kingNeed').innerHTML = `<b>Level ${k.next} needs ${k.next} cards at level ${k.next} or higher</b>
        <div class="m-prog${k.can ? ' full' : ''}"><i style="width:${Math.min(100, k.have / k.need * 100).toFixed(0)}%"></i><span>${Math.min(k.have, k.need)} / ${k.need} cards</span></div>
        <div class="kg-cards">${ok.map(id => `<img src="${cardImg(id)}" alt="${esc(KC_CARDS[id].name)}" title="${esc(KC_CARDS[id].name)}: level ${P().cards[id].level}">`).join('')}${rest.map(id => `<img class="off" src="${cardImg(id)}" alt="" title="${esc(KC_CARDS[id].name)}: level ${P().cards[id].level}">`).join('')}</div>`;
    }
    $('#kingUp').hidden = k.max;
    $('#kingUp').disabled = !k.can;
    $('#kingNote').textContent = k.max ? '' : k.can ? 'Ready to upgrade!' : `${k.need - k.have} more card${k.need - k.have === 1 ? '' : 's'} at level ${k.next} needed.`;
  }
  function upgradeKingClick() {
    const before = G.kingInfo(), r = G.upgradeKing();
    if (!r) return;
    const T = KCSim.TOWERS, v = (x, l) => Math.round(x * KCSim.levelMult(l));
    refresh(); renderKing();
    KCUpgradeFX.play({ mode: 'king', id: 'king', name: 'King Tower', img: kingImg(r.level), imgBefore: kingImg(before.level), rarity: 'common', title: 'King Tower',
      before: { level: before.level, count: 0, need: 0, max: true }, after: { level: r.level, count: 0, need: 0, max: true },
      stats: [['Tower health', v(T.king.hp, before.level), v(T.king.hp, r.level)], ['Tower damage', v(T.king.dmg, before.level), v(T.king.dmg, r.level)]],
      xp: r.xp, levelUp: r.levelUp, cost: 0, gives: 0, onClose: () => { if (!$('#kingModal').hidden) $('#kingX').focus(); } });
  }
  function buyChestClick(type) {
    const r = G.buyChest(type);
    if (r.error === 'coins') { KCSound.play('error'); toast('Not enough coins. Win battles and open chests to earn more.'); return; }
    if (r.error === 'locked') { KCSound.play('error'); toast(`${G.CHESTS[type].name}s unlock in Arena ${G.CHEST_RULES.arena[type]}.`); return; }
    if (!r.ok) { toast('That chest is not available.'); refresh(); return; }
    KCSound.play('buy');
    refresh();
    showChest(r.chest, r);
  }
  function freeChestClick() {
    const r = G.claimFreeChest();
    if (!r.ok) { toast('You already opened today\'s free chest. A new one arrives at midnight.'); refresh(); return; }
    KCSound.play('buy');
    refresh();
    showChest('wooden', r, 'Free Wooden Chest');
  }
  function buyClick(i) {
    const o = G.shop().offers[i];
    if (!o) return;
    const gem = o.currency === 'diamonds';
    if ((gem ? P().diamonds : P().coins) < o.price) {
      KCSound.play('error');
      toast(gem ? 'Not enough diamonds. Diamonds will come from the SirSC wallet.' : 'Not enough coins. Win battles and open chests to earn more.');
      return;
    }
    // diamonds take a second click to confirm
    if (gem && confirmOffer !== i) {
      confirmOffer = i;
      clearTimeout(confirmT);
      confirmT = setTimeout(() => { confirmOffer = -1; if (tabNow === 'shop') renderShop(); }, 4000);
      renderShop();
      const again = $(`#shopOffers .buy-btn[data-offer="${i}"]`);
      if (again) again.focus();
      return;
    }
    clearTimeout(confirmT); confirmOffer = -1;
    const r = G.buy(i);
    if (!r.ok) { toast(r.error === 'sold' ? 'You already bought that today.' : 'That offer is not available.'); refresh(); return; }
    KCSound.play('buy');
    refresh();
    showChest(null, r, 'Purchased');
  }


  /* ---------- online battles (js/net.js) ---------- */
  let onlineJoinCode = '';
  function openOnline() {
    $('#onlineModal').hidden = false;
    KCNet.init().then(() => renderOnline(KCNet.info()));
    renderOnline(KCNet.info());
  }
  function closeOnline() {
    $('#onlineModal').hidden = true;
    if (KCNet.info().status !== 'playing') KCNet.cancel();
  }
  const matched = m => { $('#onlineModal').hidden = true; if (opts.onOnline) opts.onOnline(m); };
  function renderOnline(info) {
    if ($('#onlineModal').hidden) return;
    const box = $('#onlineBody');
    if (!G.onlineOpen()) {
      box.innerHTML = `<div class="ol-lock"><b>Opens at Stormspire</b><p>Reach Stormspire (${fmt(G.ONLINE_AT)} trophies) to battle other players online.</p></div>`;
      return;
    }
    if (info.kind === 'off') {
      // live play isn't switched on yet: show what's coming
      box.innerHTML = `<div class="ol-soon"><span class="tag-lock">Coming soon</span><b>Online battles are coming soon</b>
        <p>Battle other players with your own deck, card levels, King Tower and evolutions.</p></div>
        <div class="ol-opts is-soon" aria-disabled="true">
          <div class="ol-opt"><b>Quick match</b><p>Battle the next player who's looking.</p><button type="button" class="big-btn ol-go" disabled><span>Find a battle</span></button></div>
          <div class="ol-opt"><b>Friendly battle</b><p>Make a room and share its code, or type a friend's code.</p>
            <button type="button" class="pill gold" disabled>Make a room</button>
            <div class="ol-join"><input maxlength="5" placeholder="Code" disabled aria-label="Room code"><button type="button" class="pill" disabled>Join</button></div>
          </div>
        </div>
        <p class="dim ol-note">No trophies will be won or lost in online battles.</p>`;
      return;
    }
    if (info.kind === 'none') { box.innerHTML = '<div class="ol-lock"><b>Not available here</b><p>This browser can\'t connect to other players.</p></div>'; return; }
    const where = info.kind === 'room'
      ? `<p class="ol-where"><b>${fmt(info.online)}</b> other player${info.online === 1 ? '' : 's'} here now${info.seeking ? ` · ${fmt(info.seeking)} looking for a battle` : ''}.</p>`
      : '<p class="ol-where">Not on claude.ai, so only other tabs of this browser can be reached here.</p>';
    if (info.status === 'seeking') {
      box.innerHTML = `${where}<div class="ol-wait"><span class="nw-spin" aria-hidden="true"></span><b>Looking for an opponent…</b><p>You'll be matched with the next player who looks for a battle.</p></div>
        <button type="button" class="pill" id="olCancel">Stop looking</button>`;
    } else if (info.status === 'hosting') {
      box.innerHTML = `${where}<div class="ol-wait"><small>Your room code</small><b class="ol-code">${esc(info.code.toUpperCase())}</b><p>Tell your friend this code. The battle starts as soon as they join.</p></div>
        <button type="button" class="pill" id="olCancel">Cancel</button>`;
    } else if (info.status === 'joining') {
      box.innerHTML = `${where}<div class="ol-wait"><span class="nw-spin" aria-hidden="true"></span><b>Joining room ${esc(info.code.toUpperCase())}…</b><p>Waiting for its host. Check the code if this takes long.</p></div>
        <button type="button" class="pill" id="olCancel">Cancel</button>`;
    } else if (info.status === 'playing') {
      box.innerHTML = '<div class="ol-wait"><b>Starting…</b></div>';
    } else {
      box.innerHTML = `${where}
        <div class="ol-opts">
          <div class="ol-opt"><b>Quick match</b><p>Battle the next player who's looking.</p><button type="button" class="big-btn ol-go" id="olQuick"><span>Find a battle</span></button></div>
          <div class="ol-opt"><b>Friendly battle</b><p>Make a room and share its code, or type a friend's code.</p>
            <button type="button" class="pill gold" id="olCreate">Make a room</button>
            <form class="ol-join" id="olJoin"><input id="olCode" maxlength="5" placeholder="Code" autocomplete="off" spellcheck="false" aria-label="Room code" value="${esc(onlineJoinCode)}"><button type="submit" class="pill">Join</button></form>
          </div>
        </div>
        <p class="dim ol-note">Online battles use your deck, card levels, King Tower and evolutions. No trophies are won or lost.</p>`;
      $('#olQuick').addEventListener('click', () => KCNet.quickMatch(matched));
      $('#olCreate').addEventListener('click', () => KCNet.createRoom(matched));
      $('#olCode').addEventListener('input', e => { onlineJoinCode = e.target.value; });
      $('#olJoin').addEventListener('submit', async e => {
        e.preventDefault();
        const r = await KCNet.joinRoom($('#olCode').value, matched);
        if (r.error === 'code') { KCSound.play('error'); toast('Room codes are five letters and numbers.'); }
      });
    }
    const c = $('#olCancel');
    if (c) c.addEventListener('click', () => KCNet.cancel());
  }

  /* ---------- the Diamond Pass ---------- */
  // A pass reward as a small picture and a label.
  function rewardArt(R) {
    if (R.kind === 'coins') return { art: '<span class="pr-coins" aria-hidden="true"><i class="coin-i"></i><i class="coin-i"></i></span>', label: `${fmt(R.n)} coins` };
    if (R.kind === 'chest') return { art: `<span class="pr-chest">${chestSvg(R.chest)}</span>`, label: G.CHESTS[R.chest].name };
    if (R.kind === 'item') return { art: `<span class="pr-item">${itemSvg(R.item)}</span>`, label: `${G.MAGIC[R.item].name} ×${fmt(R.n)}` };
    if (R.kind === 'evo') return { art: `<img class="pr-evo" src="${cardImg(R.card, true)}" alt="">`, label: KC_EVOS[R.card].name };
    return { art: '', label: '' };
  }
  function passPlaque() {
    const open = G.passOpen(), tier = G.passTier(), max = G.PASS.tiers.length, per = G.PASS.crownsPerTier, ready = G.passClaimable();
    $('#passTier').textContent = tier;
    $('#passFill').style.width = (open ? (tier >= max ? 100 : G.passInto() / per * 100) : 0).toFixed(1) + '%';
    $('#passCount').textContent = open ? (tier >= max ? 'Done' : `${G.passInto()}/${per}`) : `0/${per}`;
    $('#passPlaque').classList.toggle('locked', !open);
    $('#passPlaque').classList.toggle('has-ready', ready > 0);
    // on narrow screens the side plaques are hidden: a small Diamond Pass button sits under the chests
    $('#passMini').hidden = !open;
    $('#passMiniText').textContent = ready ? `${ready} reward${ready === 1 ? '' : 's'} ready` : `Tier ${tier} / ${max}`;
    $('#passMini').classList.toggle('has-ready', ready > 0);
    $('#passText').innerHTML = !open ? '<span class="tag-lock">Locked</span> Opens in Sunstone Arena (600 trophies). Members get the Diamond Pass track.'
      : ready ? `<span class="tag-new">${ready} ready</span> Rewards to claim! Crowns from trophy battles move you up.`
        : `Tier ${tier} of ${max}. ${G.passPremium() ? 'Diamond Pass active.' : 'Free track · the Diamond Pass is in the Shop.'} Win crowns to move up.`;
  }
  let passConfirm = false, passConfirmT = 0;
  function passTile() {
    if (!G.passOpen()) return '';
    const owned = G.passPremium(), poor = P().diamonds < G.PASS.price;
    const btn = owned ? '<button class="buy-btn" type="button" disabled>Active</button>'
      : `<button class="buy-btn gem${poor ? ' poor' : ''}${passConfirm ? ' confirm' : ''}" type="button" data-pass="1" aria-label="${passConfirm ? 'Confirm: buy' : 'Buy'} the Diamond Pass for ${G.PASS.price} diamonds">${passConfirm ? 'Confirm ' : ''}<i class="gem-i" aria-hidden="true"></i>${fmt(G.PASS.price)}</button>`;
    return `<div class="offer diamonds pass-offer${owned ? ' sold' : ''}"><span class="of-tag">Season ${G.PASS.season}</span>
      <div class="of-art pass-art"><img src="${cardImg('snowman', true)}" alt=""></div>
      <b>Diamond Pass</b><small class="of-note">Snowman Evolution at tier 1 and ${G.PASS.tiers.length} more rewards</small>
      <button type="button" class="of-see">See rewards</button>${btn}</div>`;
  }
  function buyPassClick() {
    if (P().diamonds < G.PASS.price) { KCSound.play('error'); toast('Not enough diamonds. Diamonds will come from the SirSC wallet.'); return; }
    if (!passConfirm) {
      passConfirm = true; clearTimeout(passConfirmT);
      passConfirmT = setTimeout(() => { passConfirm = false; renderShop(); }, 4000);
      renderShop(); return;
    }
    passConfirm = false; clearTimeout(passConfirmT);
    const r = G.buyPass();
    if (!r.ok) { KCSound.play('error'); return; }
    KCSound.play('buy');
    toast('Diamond Pass active! Its rewards are ready to claim.');
    refresh();
    openPass();
  }
  function openPass() {
    renderPass();
    $('#passModal').hidden = false;
    const first = $('#passTiers .pm-claim') || $('#passX');
    first.focus();
    const here = $('#passTiers .pm-tier.here');
    if (here) here.scrollIntoView({ block: 'center' });
  }
  function closePass() { $('#passModal').hidden = true; }
  function renderPass() {
    const open = G.passOpen(), prem = G.passPremium(), tier = G.passTier(), per = G.PASS.crownsPerTier;
    $('#passTitle').textContent = `Diamond Pass · Season ${G.PASS.season}`;
    $('#passHead').innerHTML = `<div class="pm-prog"><span class="pass-tier"><b>${tier}</b></span><div class="pass-track"><i style="width:${(tier >= G.PASS.tiers.length ? 100 : G.passInto() / per * 100).toFixed(1)}%"></i></div>
        <small>${!open ? 'Opens in Sunstone Arena' : tier >= G.PASS.tiers.length ? 'Every tier reached!' : `${G.passInto()} / ${per} crowns to tier ${tier + 1}`}</small></div>
      <p class="dim">Every crown you take in a trophy battle moves you up. The free track is for everyone; the Diamond Pass track is for pass holders and members.</p>
      ${prem ? '<span class="pm-owned">Diamond Pass active</span>' : open ? `<button type="button" class="buy-btn gem pm-buy" id="pmBuy"><i class="gem-i" aria-hidden="true"></i>${fmt(G.PASS.price)} · Get the Diamond Pass</button>` : ''}`;
    $('#passTiers').innerHTML = G.PASS.tiers.map((T, i) => {
      const cell = track => {
        const st = G.passState(i, track), R = rewardArt(T[track]);
        const act = st === 'ready' ? `<button type="button" class="pm-claim" data-tier="${i}" data-track="${track}">Claim</button>`
          : st === 'claimed' ? '<span class="pm-done" aria-label="Claimed">&#x2713;</span>'
            : st === 'premium' ? '<span class="pm-lock" title="Needs the Diamond Pass" aria-label="Needs the Diamond Pass"></span>' : '';
        return `<div class="pm-cell ${track} ${st}">${R.art}<span class="pm-label">${esc(R.label)}</span>${act}</div>`;
      };
      return `<li class="pm-tier${i < tier ? ' reached' : ''}${i === tier ? ' here' : ''}"><span class="pm-num">${i + 1}</span>${cell('free')}${cell('paid')}</li>`;
    }).join('');
    for (const b of $$('#passTiers .pm-claim')) b.addEventListener('click', () => claimPassClick(+b.dataset.tier, b.dataset.track));
    const buy = $('#pmBuy');
    if (buy) buy.addEventListener('click', () => { closePass(); tab('shop'); });
  }
  function claimPassClick(i, track) {
    const got = G.claimPass(i, track);
    if (!got) return;
    KCSound.play('crown');
    refresh(); renderPass();
    if (got.evo) evoScene(got.evo, 'pass');
    else if (got.chest) showChest(got.chest, got);
    else showChest(null, got, `Tier ${i + 1} reward`);
  }

  /* ---------- evolutions ---------- */
  // The evolution unlock scene (js/upgrades.js).
  function evoScene(id, from) {
    const c = KC_CARDS[id];
    KCUpgradeFX.play({ mode: 'evo', id, name: c.name, img: cardImg(id), imgEvo: cardImg(id, true), rarity: c.rarity, title: KC_EVOS[id].name, from,
      before: { level: 1, count: 0, need: 0, max: true }, after: { level: 1, count: 0, need: 0, max: true }, stats: [], blurb: KC_EVOS[id].blurb,
      onClose: () => { if (!$('#cardModal').hidden && modalId === id) { modalId = null; openCard(id); } } });
  }
  function unlockEvoClick(id) {
    const r = G.useMagic('shards', id);
    if (!r.ok) { KCSound.play('error'); toast('Not enough Evolution Shards yet.'); return; }
    refresh();
    if (!$('#cardModal').hidden && modalId === id) { modalId = null; openCard(id); }
    evoScene(id, 'shards');
  }
  // The Evolution part of a card's window.
  function modalEvo(id) {
    const c = KC_CARDS[id], E = G.evoInfo(id), act = $('#mEvoAct'), box = $('#mEvoBox');
    box.classList.toggle('built', !!E);
    box.classList.toggle('owned', !!(E && E.has));
    if (!E) { $('#mEvoTag').textContent = '(unlocks later)'; $('#mEvo').textContent = c.evo; act.hidden = true; return; }
    $('#mEvo').textContent = E.blurb;
    act.hidden = false;
    if (E.has) { $('#mEvoTag').textContent = 'Unlocked'; act.innerHTML = `<img src="${cardImg(id, true)}" alt="${esc(c.name)} evolved"><span>In every battle, every third ${esc(c.name)} you play is evolved.</span>`; return; }
    if (!E.open) { $('#mEvoTag').textContent = '(opens in Sunstone Arena)'; act.innerHTML = `<span>Reach Sunstone Arena (600 trophies) to unlock evolutions with Evolution Shards or the Diamond Pass.</span>`; return; }
    $('#mEvoTag').textContent = `${Math.min(E.shards, E.need)} / ${E.need} shards`;
    act.innerHTML = `<span class="evo-shards"><span class="mi-art">${itemSvg('shards')}</span><span class="pass-track"><i style="width:${Math.min(100, E.shards / E.need * 100).toFixed(0)}%"></i></span></span>
      <button type="button" class="up-btn evo-btn" id="mEvoBtn" ${E.can ? '' : 'disabled'}><span>Unlock</span><small>${E.need} shards</small></button>`;
    const b = $('#mEvoBtn');
    if (b) b.addEventListener('click', () => unlockEvoClick(id));
  }

  /* ---------- magic items ---------- */
  // Item art lives in js/items.js, each item built from parts that can fly together.
  const itemSvg = id => KCItems.svg(id);
  let magicSel = null, subNow = 'cards';
  function sub(name) {
    subNow = name;
    for (const b of $$('.subtab')) { const on = b.dataset.sub === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
    $('#subCards').hidden = name !== 'cards';
    $('#subMagic').hidden = name !== 'magic';
    if (name === 'magic') renderMagic();
  }
  function renderMagic() {
    const held = G.MAGIC_ORDER.filter(id => G.magicCount(id)).length;
    $('#magicTag').textContent = held ? String(G.MAGIC_ORDER.reduce((a, id) => a + (id.startsWith('wild_') ? 0 : G.magicCount(id)), 0) || '') : '';
    $('#magicGrid').innerHTML = G.MAGIC_ORDER.map(id => {
      const M = G.MAGIC[id], n = G.magicCount(id);
      return `<button type="button" class="mi ${M.kind} r-${M.rarity}${magicSel === id ? ' on' : ''}${n ? '' : ' none'}${M.soon ? ' soon' : ''}" data-item="${id}">
        <span class="mi-art">${itemSvg(id)}</span><span class="mi-n">${M.soon ? 'Soon' : '×' + fmt(n)}</span><b>${esc(M.name)}</b></button>`;
    }).join('');
    for (const b of $$('#magicGrid .mi')) b.addEventListener('click', () => { magicSel = b.dataset.item; renderMagic(); });
    const pick = $('#magicPick');
    if (!magicSel) { pick.innerHTML = '<p class="dim">Pick an item to see what it does and use it on a card.</p>'; return; }
    const M = G.MAGIC[magicSel], n = G.magicCount(magicSel);
    const cards = P().found.filter(id => (M.kind === 'shard' ? !!KC_EVOS[id] : M.rarity === 'any' || KC_CARDS[id].rarity === M.rarity));
    const why = { full: 'Has the copies it needs', copies: 'Needs its copies first', max: 'Max level', rarity: 'Wrong rarity', 'none-held': 'You have none', 'not-found': 'Not found', none: '',
      'evo-owned': 'Evolution unlocked', 'evo-locked': 'Opens in Sunstone Arena', shards: `Needs ${M.kind === 'shard' ? (KC_EVOS.snowman.shards) : ''} shards`, 'no-evo': '' };
    const rows = M.soon ? '<p class="dim">Nothing gives evolution shards yet. They arrive with evolutions.</p>'
      : !cards.length ? `<p class="dim">You have no ${M.rarity} cards yet.</p>`
        : `<div class="mp-cards">${cards.map(id => {
          const r = G.magicFor(magicSel, id), u = G.upgradeInfo(id);
          const what = r.ok ? (M.kind === 'shard' ? 'Unlock its evolution' : M.kind === 'hammer' ? `Upgrade to level ${r.level}${r.fills ? ` (+${fmt(r.fills)} copies)` : ''}` : `+${fmt(r.gives)} ${r.gives === 1 ? 'copy' : 'copies'}`) : why[r.reason] || '';
          return `<button type="button" class="mp-card${r.ok ? '' : ' off'}" data-card="${id}" ${r.ok ? '' : 'disabled'}>
            <img src="${cardImg(id)}" alt=""><span><b>${esc(KC_CARDS[id].name)}</b><small>Level ${u.level}${u.max ? '' : ` · ${fmt(u.count)} / ${fmt(u.need)}`}</small><em>${what}</em></span></button>`;
        }).join('')}</div>`;
    pick.innerHTML = `<div class="mp-head"><span class="mi-art big">${itemSvg(magicSel)}</span><div><b>${esc(M.name)}</b> <span class="mi-held">×${fmt(n)}</span><p>${esc(M.blurb)}</p></div></div>${rows}`;
    for (const b of $$('#magicPick .mp-card:not(.off)')) b.addEventListener('click', () => applyMagic(magicSel, b.dataset.card));
  }
  function applyMagic(item, id) {
    if (G.MAGIC[item].kind === 'shard') { unlockEvoClick(id); return; }
    const before = G.upgradeInfo(id), r = G.useMagic(item, id);
    if (!r.ok) { toast('That item can\'t be used on that card right now.'); return; }
    const M = G.MAGIC[item], after = G.upgradeInfo(id);
    refresh();
    if (!$('#cardModal').hidden && modalId === id) { modalId = null; openCard(id); }
    growScene(M.kind === 'hammer' ? 'hammer' : M.kind === 'wild' ? 'wild' : 'book', id, before, after,
      { item, itemSvg: itemSvg(item), title: M.name, gives: r.gives || 0, xp: M.kind === 'hammer' ? 4 * r.level : 0, levelUp: r.levelUp });
  }
  // The full-screen scene for a card growing (js/upgrades.js): a level-up, or copies from an item.
  function growScene(mode, id, before, after, extra) {
    const c = KC_CARDS[id], m = KCSim.levelMult, v = (x, l) => Math.round(x * m(l));
    const stats = [];
    if (c.hp) stats.push(['Health', v(c.hp, before.level), v(c.hp, after.level)]);
    if (c.dmg) stats.push(['Damage', v(c.dmg, before.level), v(c.dmg, after.level)]);
    const st = u => ({ level: u.level, count: u.count, need: u.need || 0, max: !!u.max });
    KCUpgradeFX.play(Object.assign({ mode, id, name: c.name, img: cardImg(id), rarity: c.rarity, title: c.name,
      before: st(before), after: st(after), stats, cost: 0, xp: 0, gives: 0,
      onClose: () => { const f = !$('#cardModal').hidden ? $('#modalX') : null; if (f) f.focus(); } }, extra));
  }
  // Buttons in a card's details window for the items that can be used on it.
  function modalMagic(id) {
    const box = $('#mMagic'), btns = G.MAGIC_ORDER.filter(it => it !== 'shards' && G.magicFor(it, id).ok).map(it => {
      const r = G.magicFor(it, id), M = G.MAGIC[it];
      return `<button type="button" class="mm-btn" data-item="${it}" title="${esc(M.blurb)}"><span class="mi-art">${itemSvg(it)}</span><span><b>${esc(M.name)}</b><small>${M.kind === 'hammer' ? 'Upgrade free' : `+${fmt(r.gives)} ${r.gives === 1 ? 'copy' : 'copies'}`} · ×${fmt(G.magicCount(it))}</small></span></button>`;
    });
    box.hidden = !btns.length;
    box.innerHTML = btns.join('');
    for (const b of box.querySelectorAll('.mm-btn')) b.addEventListener('click', () => applyMagic(b.dataset.item, id));
  }

  /* ---------- the Trophy Road ---------- */
  function rewardHtml(m) {
    if (m.kind === 'coins') return `<span class="rw-coins"><span class="co-coin" aria-hidden="true"></span><b>${fmt(m.amount)}</b></span><small>Coins</small>`;
    if (m.kind === 'chest') { const t = G.capChest(m.chest); return `<span class="rw-chest">${chestSvg(t)}</span><small>${G.CHESTS[t].name}</small>`; }
    if (m.kind === 'card') return `<img class="rw-card" src="${cardImg(m.card)}" alt=""><small>${esc(KC_CARDS[m.card].name)} ×${m.copies}</small>`;
    const a = G.ARENAS.find(x => x.id === m.arena);
    return `<span class="rw-arena"><b>${a.number}</b></span><small>${a.soon ? `Arena ${a.number} · coming soon` : `Arena ${a.number}: ${esc(a.name)}`}</small>`;
  }
  function renderRoad() {
    const p = P(), road = G.ROAD;
    $('#rhTrophies').textContent = fmt(p.trophies);
    const a = G.arena();
    $('#rhArenaNo').textContent = `Arena ${a.number}`;
    $('#rhArena').textContent = a.name;
    $('#rhBest').textContent = `Best ${fmt(p.best)}`;
    const r = p.trophyRecord;
    $('#rhRecord').innerHTML = `<b>${r.w}</b><small>wins</small><b>${r.l}</b><small>losses</small>`;
    // the next reward and how far it is, or rewards waiting to be claimed
    const ready = road.filter(m => G.roadState(m) === 'ready'), next = road.find(m => G.roadState(m) === 'locked');
    const label = m => m.kind === 'card' ? `${KC_CARDS[m.card].name} ×${m.copies}` : m.kind === 'coins' ? `${fmt(m.amount)} coins` : m.kind === 'chest' ? G.CHESTS[G.capChest(m.chest)].name
      : (x => (x.soon ? `Arena ${x.number}` : x.name))(G.ARENAS.find(x => x.id === m.arena));
    $('#roadNext').innerHTML = ready.length
      ? `<span class="rnx-tag ready">${ready.length} reward${ready.length === 1 ? '' : 's'} to claim</span><button type="button" class="pill gold" id="roadGo">Show me</button>`
      : next ? `<span class="rnx-tag">Next reward</span><b>${esc(label(next))}</b><span class="rnx-at"><i class="trophy-i" aria-hidden="true"></i>${fmt(next.at)}</span>
        <span class="rnx-bar"><i style="width:${Math.max(4, Math.min(100, (p.trophies - (road[road.indexOf(next) - 1] || { at: 0 }).at) / (next.at - (road[road.indexOf(next) - 1] || { at: 0 }).at) * 100)).toFixed(0)}%"></i></span>
        <small>${fmt(next.at - p.trophies)} to go</small><button type="button" class="pill" id="roadGo">Find me</button>`
        : '<span class="rnx-tag ready">Every reward claimed!</span>';
    // the arena each reward belongs to, for its section colour
    let arenaNow = road[0].arena;
    $('#roadTrack').innerHTML = road.map(m => {
      if (m.kind === 'arena') arenaNow = m.arena;
      const st = G.roadState(m), A = G.ARENAS.find(x => x.id === arenaNow) || {}, theme = A.theme || 'soon';
      const act = st === 'ready' ? `<button class="claim-btn" type="button" data-at="${m.at}">Claim</button>` : st === 'claimed' ? '<span class="rn-done" aria-label="Claimed"></span>'
        : st === 'soon' ? '<span class="rn-soon">Soon</span>' : '<span class="rn-lock" aria-label="Locked"></span>';
      if (m.kind === 'arena') {
        // an arena gate: its badge, number and name
        const G2 = G.ARENAS.find(x => x.id === m.arena), art = !G2.soon && KCArenas.get(G2.theme);
        return `<li class="rn gate ${st} t-${G2.theme || 'soon'}" data-at="${m.at}">
          <div class="rn-top"><div class="rn-gate">${art ? `<img src="${art.centerpiece.src}" alt="">` : '<span class="rg-soon">?</span>'}<small>Arena ${G2.number}</small><b>${esc(G2.soon ? 'Coming soon' : G2.name)}</b>${act}</div></div>
          <span class="rn-slot"><i class="rn-pin"></i></span><div class="rn-at"><i class="trophy-i" aria-hidden="true"></i>${fmt(m.at)}</div></li>`;
      }
      return `<li class="rn ${st} t-${theme}" data-at="${m.at}"><div class="rn-top"><div class="rn-card">${rewardHtml(m)}${act}</div></div>
        <span class="rn-slot"><i class="rn-pin"></i></span><div class="rn-at"><i class="trophy-i" aria-hidden="true"></i>${fmt(m.at)}</div></li>`;
    }).join('');
    for (const b of $$('#roadTrack .claim-btn')) b.addEventListener('click', () => claimAt(+b.dataset.at));
    const go = $('#roadGo');
    if (go) go.addEventListener('click', () => scrollRoad(true));
    requestAnimationFrame(placeRoadMe);
  }
  // The track's fill and your marker, between the two rewards your trophies fall between.
  function placeRoadMe() {
    const nodes = [...$$('#roadTrack .rn')], t = P().trophies, track = $('#roadTrack');
    if (!nodes.length) return;
    const cx = n => n.offsetLeft + n.offsetWidth / 2;
    let x = cx(nodes[0]);
    for (let i = 0; i < nodes.length; i++) {
      const at = +nodes[i].dataset.at, nx = nodes[i + 1];
      if (t >= at && (!nx || t < +nx.dataset.at)) { x = nx ? cx(nodes[i]) + (cx(nx) - cx(nodes[i])) * (t - at) / (+nx.dataset.at - at) : cx(nodes[i]); break; }
    }
    // the track runs through every reward's slot row, below its card
    const slot = nodes[0].querySelector('.rn-slot'), y = slot.offsetTop + slot.offsetHeight / 2;
    $('.road-rail').style.top = y + 'px'; $('#roadMe').style.top = y + 'px';
    $('.road-rail').style.width = track.scrollWidth + 'px';
    $('#roadFill').style.width = x + 'px';
    $('#roadMe').style.left = x + 'px';
    $('#roadMeN').textContent = fmt(t);
  }
  function scrollRoad(smooth) {
    const box = $('#roadScroll'), here = $('#roadTrack .rn.ready') || [...$$('#roadTrack .rn')].reverse().find(n => +n.dataset.at <= P().trophies);
    if (box && here) box.scrollTo({ left: Math.max(0, here.offsetLeft - box.clientWidth / 2 + here.clientWidth / 2), behavior: smooth === true ? 'smooth' : 'auto' });
  }
  function claimAt(at) {
    const got = G.claim(at);
    if (!got) return;
    KCSound.play('crown');
    if (got.kind === 'chest') showChest(got.chest, got);
    else if (got.kind === 'card') showChest(null, got);
    else if (got.kind === 'coins') toast(`+${fmt(got.coins)} coins`);
    refresh();
  }

  /* ---------- the Cards tab ---------- */
  function buildCards() {
    const p = P(), deck = p.deck;
    const avg = deck.reduce((a, id) => a + KC_CARDS[id].cost, 0) / deck.length;
    $('#avgCost').textContent = avg.toFixed(1);
    const lvlStrip = id => {
      const u = G.upgradeInfo(id);
      if (!u.found) return `<span class="lvl-strip locked">${G.unlockAt(id) !== null ? `Trophy Road · ${G.unlockAt(id)}` : 'Locked'}</span>`;
      if (u.max) return `<span class="lvl-strip max">Level ${u.level} · Max</span>`;
      const pct = Math.min(100, u.count / u.need * 100), short = u.count >= u.need && P().coins < u.cost;
      return `<span class="lvl-strip"><span>Level ${u.level}</span><span class="cprog${u.count >= u.need ? ' full' : ''}"><i style="width:${pct.toFixed(0)}%"></i><em>${fmt(u.count)}/${fmt(u.need)}</em></span><span class="lvl-gold${short ? ' short' : ''}"><i class="coin-i" aria-hidden="true"></i>${fmt(u.cost)}</span></span>`;
    };
    $('#deckRow').innerHTML = deck.map((id, i) => {
      const c = KC_CARDS[id], u = G.upgradeInfo(id);
      return `<button type="button" class="mini-card ${c.rarity}${u.can ? ' can-up' : ''}" data-id="${id}" data-slot="${i}" title="${esc(c.name)}"><img src="${cardImg(id)}" alt="${esc(c.name)}"><span class="cost">${c.cost}</span>${u.can ? '<span class="up-arrow" aria-label="Upgrade ready"></span>' : ''}${lvlStrip(id)}</button>`;
    }).join('');
    const found = p.found.length, all = KC_ALL_CARDS.length;
    $('#foundCount').textContent = `${found} / ${all} found`;
    $('#collGrid').innerHTML = KC_ALL_CARDS.map(id => {
      const c = KC_CARDS[id], u = G.upgradeInfo(id);
      return `<button type="button" class="coll-card ${c.rarity}${u.found ? '' : ' not-found'}${u.can ? ' can-up' : ''}" data-id="${id}">
        <span class="cc-art"><img src="${cardImg(id)}" alt=""><span class="cost">${c.cost}</span>${deck.includes(id) ? '<span class="in-deck" title="In your deck">In deck</span>' : ''}${u.can ? '<span class="up-arrow" aria-label="Upgrade ready"></span>' : ''}${G.hasEvo(id) ? '<span class="evo-badge" title="Evolution unlocked">Evo</span>' : ''}</span>
        <b>${esc(c.name)}</b><span class="rar">${c.rarity}</span>${lvlStrip(id)}</button>`;
    }).join('');
    for (const b of $$('#deckRow .mini-card')) b.addEventListener('click', () => (swapId ? doSwap(+b.dataset.slot) : openCard(b.dataset.id)));
    for (const b of $$('#collGrid .coll-card')) b.addEventListener('click', () => openCard(b.dataset.id));
  }
  function startSwap(id) {
    swapId = id;
    closeCard();
    $('#swapBar').hidden = false;
    $('#swapText').textContent = `Pick a card in your deck to swap out for ${KC_CARDS[id].name}`;
    $('#deckRow').classList.add('swapping');
  }
  function endSwap() { swapId = null; $('#swapBar').hidden = true; $('#deckRow').classList.remove('swapping'); }
  function doSwap(slot) {
    const id = swapId;
    endSwap();
    if (G.setDeck(slot, id)) { toast(`${KC_CARDS[id].name} is in your deck`); KCSound.play('select'); }
    refresh();
  }

  let lastFocus = null, modalId = null;
  function openCard(id) {
    const c = KC_CARDS[id];
    if (!$('#cardModal').hidden && modalId === id) return;
    lastFocus = lastFocus || document.activeElement;
    modalId = id;
    $('#mImg').src = cardImg(id);
    $('#mCost').textContent = c.cost;
    $('#mName').textContent = c.name;
    const u = G.upgradeInfo(id);
    $('#mTags').innerHTML = [`<span class="rar ${c.rarity}">${c.rarity}</span>`, `<span>${esc(c.role)}</span>`,
      `<span>${c.kind === 'spell' ? 'Spell' : c.kind === 'building' ? 'Building' : c.air ? 'Flying troop' : 'Troop'}</span>`].join('');
    $('#mBlurb').textContent = c.blurb;
    const lvl = u.found ? u.level : 1, m = KCSim.levelMult(lvl), v = x => Math.round(x * m);
    const tgt = { buildings: 'Towers & buildings', ground: 'Ground', both: 'Air & ground' }[c.targets];
    const sp = s => (s >= 1.8 ? 'Very fast' : s >= 1.4 ? 'Fast' : s >= 1 ? 'Medium' : 'Slow');
    const stats = c.kind === 'spell'
      ? [['Damage', v(c.dmg)], ['Tower damage', Math.round(v(c.dmg) * c.towerPct)], ['Radius', c.area + ' tiles'], ['Energy', c.cost]]
      : c.kind === 'building'
        ? [['Health', v(c.hp)], ['Damage', v(c.dmg)], ['Hit speed', c.hit + ' s'], ['Range', c.range + ' tiles'], ['Lifetime', c.lifetime + ' s'], ['Targets', tgt], ['Energy', c.cost]]
        : [['Health', v(c.hp)], ['Damage', v(c.dmg)], ['Hit speed', c.hit + ' s'], ['Range', c.range < 1 ? 'Melee' : c.range + ' tiles'],
          ['Speed', sp(c.speed)], ['Targets', tgt], ['Energy', c.cost]].concat(c.count > 1 ? [['Count', '×' + c.count]] : []);
    const next = u.found && !u.max ? KCSim.levelMult(lvl + 1) : null;
    $('#mStats').innerHTML = stats.map(([k, val]) => {
      const nv = next && (k === 'Health' || k === 'Damage' || k === 'Tower damage') ? (k === 'Tower damage' ? Math.round(Math.round(c.dmg * next) * c.towerPct) : Math.round((k === 'Health' ? c.hp : c.dmg) * next)) : null;
      const up = nv !== null ? `<em title="At level ${lvl + 1}">→ ${nv}</em>` : '';
      return `<div><small>${k}</small><b>${val}${up}</b></div>`;
    }).join('');
    modalEvo(id);
    modalMagic(id);
    // level, copies and the buttons
    $('#mLevel').textContent = u.found ? (u.max ? `Level ${u.level} · Max` : `Level ${u.level}`) : 'Not found yet';
    const pct = u.found && !u.max ? Math.min(100, u.count / u.need * 100) : u.max ? 100 : 0;
    $('#mProgFill').style.width = pct + '%';
    $('#mProgFill').parentElement.classList.toggle('full', !!u.can || (u.found && !u.max && u.count >= u.need));
    $('#mProgText').textContent = !u.found ? `Trophy Road · ${G.unlockAt(id)} trophies` : u.max ? 'Max level' : `${fmt(u.count)} / ${fmt(u.need)} cards`;
    const upBtn = $('#mUpgrade');
    upBtn.hidden = !u.found || u.max;
    upBtn.disabled = !u.can;
    $('#mUpCost').innerHTML = `<i class="coin-i" aria-hidden="true"></i>${fmt(u.cost || 0)}`;
    const inDeck = P().deck.includes(id);
    $('#mUse').hidden = !u.found || inDeck;
    const lack = [u.count < u.need ? `${fmt(u.need - u.count)} more card${u.need - u.count === 1 ? '' : 's'}` : '', P().coins < u.cost ? `${fmt(u.cost - P().coins)} more coins` : ''].filter(Boolean);
    const toMax = u.found && !u.max ? ` To level ${G.MAX_LEVEL}: ${fmt(G.copiesToMax(id))} more cards and ${fmt(G.goldToMax(id))} coins.` : '';
    $('#mNote').textContent = !u.found ? 'Reach it on the Trophy Road to add it to your collection.'
      : u.max ? `Level ${G.MAX_LEVEL}: this card is fully upgraded.`
        : (lack.length ? `Needs ${lack.join(' and ')}.` : `Ready: uses ${fmt(u.need)} cards and ${fmt(u.cost)} coins.`) + toMax + (inDeck ? ' In your deck.' : '');
    $('#cardModal').hidden = false;
    (upBtn.hidden || upBtn.disabled ? $('#modalX') : upBtn).focus();
  }
  function closeCard() {
    if ($('#cardModal').hidden) return;
    $('#cardModal').hidden = true;
    modalId = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }
  let kingReady = false;
  function upgradeCard() {
    kingReady = G.kingInfo().can;
    const id = modalId, before = G.upgradeInfo(id), r = G.upgrade(id);
    if (!r) return;
    refresh();
    modalId = null; openCard(id);
    const kingWas = kingReady;
    growScene('upgrade', id, before, G.upgradeInfo(id), { title: `Upgrade ${KC_CARDS[id].name}`, cost: before.cost, xp: r.xp, levelUp: r.levelUp,
      onClose: () => { if (!kingWas && G.kingInfo().can) toast(`Your King Tower can go to level ${G.kingInfo().next}! Tap it in the top bar.`); } });
  }

  /* ---------- the opponent ---------- */
  const TROPHY_ID = 'trophy';
  // The Trophy Battle's picture: a gold trophy on the arena's colours.
  function trophyPic(cv) {
    const c = cv.getContext('2d'), w = cv.width, q = v => v * w;
    c.clearRect(0, 0, w, w);
    const g = c.createLinearGradient(0, 0, 0, w);
    g.addColorStop(0, '#ff9a4a'); g.addColorStop(1, '#a3262d');
    KCArt.rr(c, 0, 0, w, w, q(0.14)); c.fillStyle = g; c.fill();
    c.save(); c.translate(q(0.5), q(0.52)); c.scale(w / 24 * 0.62, w / 24 * 0.62); c.translate(-12, -12);
    c.fill(new Path2D('M7 3h10v3h3v3a4 4 0 0 1-4 4h-.5A5 5 0 0 1 13 16v2h3v3H8v-3h3v-2a5 5 0 0 1-3.5-3H8a4 4 0 0 1-4-4V6h3z'));
    const p = new Path2D('M7 3h10v3h3v3a4 4 0 0 1-4 4h-.5A5 5 0 0 1 13 16v2h3v3H8v-3h3v-2a5 5 0 0 1-3.5-3H8a4 4 0 0 1-4-4V6h3z');
    c.fillStyle = '#ffcf3f'; c.fill(p); c.lineWidth = 1.4; c.strokeStyle = '#1c1530'; c.lineJoin = 'round'; c.stroke(p);
    c.restore();
  }
  function renderOpp() {
    const p = P(), open = G.roadOpen(), mode = G.mode(), T = G.trainer(), next = G.nextTrainer();
    const pic = $('#oppPic');
    if (mode === 'trophy') {
      const a = G.arena();
      $('#oppLabel').textContent = 'Trophy Battle';
      $('#oppName').textContent = `${a.name}`;
      $('#oppMeta').textContent = `${fmt(p.trophies)} trophies · win +${G.TROPHIES.win} / loss −${G.TROPHIES.loss}`;
      if (pic.dataset.id !== TROPHY_ID) { pic.dataset.id = TROPHY_ID; trophyPic(pic); }
      $('#battleSub').textContent = `Trophy battle · ${a.name}`;
    } else {
      $('#oppLabel').textContent = open ? 'Trainer rematch · starter deck · no trophies' : next && T.id === next.id ? 'Next Opponent' : 'Rematch';
      $('#oppName').textContent = T.name;
      $('#oppMeta').textContent = `Level ${T.level} · ${T.tier} · ${recText(p.records[T.id])}`;
      if (pic.dataset.id !== T.id) { pic.dataset.id = T.id; KCArt.trainer(pic, T.look); }
      $('#battleSub').textContent = `vs ${T.name}`;
    }
    const items = [];
    if (open) items.push(`<li><button type="button" class="opp-item${mode === 'trophy' ? ' on' : ''}" data-mode="trophy"><canvas width="88" height="88" data-look="${TROPHY_ID}" aria-hidden="true"></canvas>
      <span class="oi-text"><b>Trophy Battle</b><small>${esc(G.arena().name)} · ${fmt(p.trophies)} trophies</small><small>${esc(recText(p.trophyRecord))}</small></span></button></li>`);
    items.push(...KC_TRAINERS.map(t => {
      const lock = !G.unlocked(t.id), st = lock ? 'Locked' : p.beaten[t.id] ? 'Beaten' : 'Not beaten yet';
      return `<li><button type="button" class="opp-item${mode === 'trainer' && t.id === T.id ? ' on' : ''}${lock ? ' locked' : ''}" data-id="${t.id}" ${lock ? 'aria-disabled="true"' : ''}>
        <canvas width="88" height="88" data-look="${t.id}" aria-hidden="true"></canvas>
        <span class="oi-text"><b>${esc(t.name)}</b><small>Level ${t.level} · ${esc(t.tier)} · ${st}</small><small>${lock ? esc(`Beat ${KC_TRAINERS[KC_TRAINERS.indexOf(t) - 1].name} to unlock`) : esc(recText(p.records[t.id]))}</small></span>
        ${p.beaten[t.id] ? '<span class="oi-check" aria-hidden="true"></span>' : lock ? '<span class="oi-lock" aria-hidden="true"></span>' : ''}</button></li>`;
    }));
    $('#oppList').innerHTML = items.join('');
    for (const cvs of $$('#oppList canvas')) {
      const id = cvs.dataset.look;
      if (id === TROPHY_ID) trophyPic(cvs);
      else KCArt.trainer(cvs, KC_TRAINER[id].look, !G.unlocked(id));
    }
    for (const b of $$('#oppList .opp-item')) b.addEventListener('click', () => {
      if (b.dataset.mode === 'trophy') G.setMode('trophy');
      else if (G.unlocked(b.dataset.id)) G.setMode('trainer', b.dataset.id);
      else return;
      closePops(); refresh();
    });
  }

  /* ---------- side plaques ---------- */
  function renderSides() {
    const p = P(), open = G.roadOpen(), next = G.nextTrainer();
    if (!open) {
      $('#leftTitle').textContent = 'Coming Up';
      const ups = [
        next ? [`Trainer ${next.short}`, 'Ready now'] : null,
        ...KC_TRAINERS.filter(t => !G.unlocked(t.id)).map(t => [t.name, `Beat ${KC_TRAINERS[KC_TRAINERS.indexOf(t) - 1].short}`]),
        ['Trophy Road', 'Beat all 3 trainers'], ['Arena 1: Cinder Keep', 'On the Trophy Road'], ['Chests & card levels', 'On the Trophy Road'],
      ].filter(Boolean);
      $('#unlocks').innerHTML = ups.map(([a, b]) => `<li><b>${esc(a)}</b><small>${esc(b)}</small></li>`).join('');
      $('#rightTitle').textContent = 'Training Rewards';
      $('#rightNote').textContent = 'First win against each trainer gives a 30 XP bonus.';
      $('#rewards').innerHTML = KC_TRAINERS.map((t, i) => {
        const prize = KC_TRAINERS[i + 1] ? `Unlocks ${KC_TRAINERS[i + 1].short}` : 'Opens the Trophy Road';
        return `<li class="${p.beaten[t.id] ? 'done' : G.unlocked(t.id) ? 'now' : 'later'}"><span class="rw-mark" aria-hidden="true"></span><span><b>Beat ${esc(t.short)}</b><small>${prize} · +30 XP</small></span></li>`;
      }).join('');
      return;
    }
    const a = G.arena();
    $('#leftTitle').textContent = `Arena ${a.number} Cards`;
    $('#unlocks').innerHTML = (a.cards || []).map(id => {
      const found = p.found.includes(id);
      return `<li class="card-li${found ? '' : ' dim-li'}"><img src="${cardImg(id)}" alt=""><span><b>${esc(KC_CARDS[id].name)}</b><small>${found ? `Found · level ${p.cards[id].level}` : `Trophy Road · ${G.unlockAt(id)} trophies`}</small></span></li>`;
    }).join('');
    $('#rightTitle').textContent = 'Next Rewards';
    const nxt = G.ROAD.filter(m => G.roadState(m) === 'ready' || G.roadState(m) === 'locked' || G.roadState(m) === 'soon').slice(0, 3);
    $('#rewards').innerHTML = nxt.map(m => {
      const st = G.roadState(m), what = m.kind === 'coins' ? `${fmt(m.amount)} coins` : m.kind === 'chest' ? G.CHESTS[G.capChest(m.chest)].name : m.kind === 'card' ? `${KC_CARDS[m.card].name} ×${m.copies}` : `Arena ${G.ARENAS.find(x => x.id === m.arena).number}`;
      return `<li class="${st === 'ready' ? 'now' : 'later'}"><span class="rw-mark" aria-hidden="true"></span><span><b>${esc(what)}</b><small>${st === 'ready' ? 'Ready to claim' : st === 'soon' ? `${m.at} trophies · coming soon` : `At ${m.at} trophies`}</small></span></li>`;
    }).join('') || '<li class="done"><span class="rw-mark" aria-hidden="true"></span><span><b>All claimed</b><small>More arenas are on the way</small></span></li>';
    $('#rightNote').textContent = G.claimable().length ? 'Claim rewards on the Trophy Road tab.' : 'Win trophy battles to reach the next reward.';
  }

  // Once a second while the lobby shows: chest timers count down (the slots are only redrawn when a
  // chest changes state, so their animations aren't restarted), and the Shop's clock runs.
  let chestSig = '';
  const chestStates = () => P().chests.map((c, i) => G.chestState(i)).join();
  function tick() {
    if ($('#home').hidden) return;
    if (G.roadOpen() && P().chests.some(Boolean)) {
      if (chestStates() !== chestSig) renderChests();
      else for (const b of $$('#chests .slot.unlocking')) b.querySelector('small').textContent = clock(P().chests[+b.dataset.slot].ends - Date.now());
    }
    if (tabNow === 'shop') {
      const day = P().shop && P().shop.day;
      if (G.shop().day !== day || (G.freeChestReady() && !$('#shopChests .free-btn'))) renderShop(); else shopTimer();
    }
  }

  /* ---------- keeping everything current ---------- */
  function refresh() {
    const p = P();
    if (!p) return;
    const total = KC_TRAINERS.length, n = G.beatenCount(), open = G.roadOpen();
    // top bar
    $('#playerName').textContent = p.name;
    const lv = G.level(), into = p.xp % G.XP_PER_LEVEL;
    $('#lvlNum').textContent = lv;
    const ki = G.kingInfo();
    $('#kingNum').textContent = ki.level;
    $('#kingBtn').classList.toggle('can', ki.can);
    $('#kingBtn').title = ki.can ? 'Your King Tower can be upgraded!' : `King Tower level ${ki.level}: its level sets the strength of your towers`;
    if (!$('#kingModal').hidden) renderKing();
    $('#xpFill').style.width = (into / G.XP_PER_LEVEL * 100).toFixed(1) + '%';
    $('#xpText').textContent = `${into} / ${G.XP_PER_LEVEL}`;
    $('#coinVal').textContent = fmt(p.coins);
    $('#gemVal').textContent = fmt(p.diamonds);
    $('#shopTag').hidden = !G.freeChestReady();
    passPlaque();
    $('#onlineBtn').classList.toggle('locked', !G.onlineOpen() || !KCNet.LIVE);
    $('#onlineBtn').title = KCNet.LIVE ? 'Battle other players online' : 'Online battles are coming soon';
    $('#onlineBtn').hidden = !G.roadOpen();
    if (subNow === 'magic') renderMagic(); else $('#magicTag').textContent = String(G.MAGIC_ORDER.reduce((a, id) => a + (id.startsWith('wild_') ? 0 : G.magicCount(id)), 0) || '');
    $('#soundBtn').setAttribute('aria-label', KCSound.on ? 'Sound on' : 'Sound off');
    $('#soundBtn').classList.toggle('off', !KCSound.on);
    $('#soundToggle').checked = KCSound.on;
    $('.who-text small').textContent = open ? `Arena ${G.arena().number} · ${G.arena().name}` : 'Training Grounds';
    // centerpiece: trainers beaten, then trophies toward the next arena
    const cp = $('#cp'), bar = $('#cpBar');
    // the arena's own centerpiece (js/arenas.js), its progress bar placed over the art's empty bar
    const art = KCArenas.get(open ? G.arena().theme : 'training'), C = art.centerpiece, img = $('#cpImg');
    if (img.dataset.src !== C.src) {
      img.dataset.src = C.src;
      img.hidden = false;
      img.onerror = () => { img.hidden = true; cp.classList.add('no-art'); };
      img.onload = () => cp.classList.remove('no-art');
      img.src = C.src;
      cp.style.setProperty('--cpw', C.w); cp.style.setProperty('--cph', C.h);
      for (const [k, v] of Object.entries(C.bar)) bar.style.setProperty(k, v + '%');
    }
    cp.dataset.arena = open ? G.arena().theme : 'training';
    $('#cpFallback').textContent = art.name;
    if (open) {
      const a = G.arena(), na = G.nextArena(), lo = a.min, hi = na ? na.min : a.min + 300;
      $('#cpImg').alt = `${a.name} arena`;
      $('#cpFill').style.width = (Math.max(0, Math.min(1, (p.trophies - lo) / (hi - lo))) * 100).toFixed(1) + '%';
      $('#cpText').textContent = `${fmt(p.trophies)} / ${fmt(hi)} Trophies`;
      bar.setAttribute('aria-label', 'Trophies toward the next arena');
      bar.setAttribute('aria-valuenow', String(p.trophies)); bar.setAttribute('aria-valuemax', String(hi));
      bar.classList.toggle('full', p.trophies >= hi);
    } else {
      $('#cpImg').alt = 'Training Grounds arena';
      $('#cpFill').style.width = (n / total * 100).toFixed(1) + '%';
      $('#cpText').textContent = `${n} / ${total} Trainers Defeated`;
      bar.setAttribute('aria-label', 'Trainers defeated');
      bar.setAttribute('aria-valuenow', String(n)); bar.setAttribute('aria-valuemax', String(total));
      bar.classList.remove('full');
    }
    $('#opp').classList.toggle('done', false);
    renderOpp();
    renderChests();
    renderShop();
    renderSides();
    buildCards();
    // the nav tags
    const ups = G.upgradable().length, ct = $('#cardsTag');
    ct.hidden = !ups; ct.textContent = ups;
    const claims = G.claimable().length, tag = $('#roadTag');
    tag.textContent = !open ? 'Locked' : claims ? `${claims} reward${claims === 1 ? '' : 's'}` : (p.roadSeen ? 'Open' : 'New!');
    tag.className = 'nb-tag' + (!open ? ' lock' : claims || !p.roadSeen ? ' new' : ' open');
    // Trophy Road tab
    $('#roadView').hidden = !open;
    $('#roadLocked').hidden = open;
    if (open) renderRoad();
    else {
      const next = G.nextTrainer();
      $('#roadTitle').textContent = 'Trophy Road is locked';
      $('#roadText').textContent = `Beat all three Training Grounds trainers to open it.${next ? ` Next up: ${next.name}.` : ''}`;
      $('#roadList').innerHTML = KC_TRAINERS.map(t => `<li class="${p.beaten[t.id] ? 'done' : ''}"><span>${esc(t.name)}</span><b>${p.beaten[t.id] ? 'Beaten' : G.unlocked(t.id) ? 'Not yet' : 'Locked'}</b></li>`).join('');
    }
  }

  function init(o) {
    opts = o || {};
    G.load();
    KCArenas.preload('training');
    if (G.roadOpen()) KCArenas.preload(G.arena().theme);
    for (const b of $$('[data-tab]')) b.addEventListener('click', () => tab(b.dataset.tab));
    $('#battleBtn').addEventListener('click', () => opts.onBattle && opts.onBattle(nextFoe()));
    $('#simWinLobby').addEventListener('click', simulateWin); // TEMPORARY
    $('#testRich').addEventListener('click', () => { G.grantTest(); KCSound.play('buy'); refresh(); toast('Test: you now have 1,000,000 coins and 1,000,000 diamonds'); }); // TEMPORARY
    $('#testOffers').addEventListener('click', () => { G.refreshShop(); confirmOffer = -1; KCSound.play('select'); refresh(); toast('Test: new offers made from your cards as they are now'); }); // TEMPORARY
    $('#oppChange').addEventListener('click', e => { e.stopPropagation(); toggle('#oppPanel', '#oppChange'); });
    $('#settingsBtn').addEventListener('click', e => {
      e.stopPropagation();
      if (toggle('#settings', '#settingsBtn')) $('#nameInput').value = P().name;
    });
    $('#whoBtn').addEventListener('click', e => {
      e.stopPropagation();
      if ($('#settings').hidden) toggle('#settings', '#settingsBtn');
      const i = $('#nameInput'); i.value = P().name; i.focus(); i.select();
    });
    for (const el of ['#settings', '#oppPanel']) $(el).addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => closePops());
    $('#soundBtn').addEventListener('click', () => { KCSound.on = !KCSound.on; refresh(); });
    $('#soundToggle').addEventListener('change', e => { KCSound.on = e.target.checked; refresh(); });
    $('#nameForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 16);
      if (v) { P().name = v; G.save(); }
      closePops(); refresh();
    });
    $('#modalX').addEventListener('click', closeCard);
    for (const b of $$('.subtab')) b.addEventListener('click', () => sub(b.dataset.sub));
    $('#testMagic').addEventListener('click', () => { G.grantMagic(); KCSound.play('buy'); refresh(); toast('Test: added wild cards, books and Hammers of Books'); }); // TEMPORARY
    $('#cardModal').addEventListener('click', e => { if (e.target.id === 'cardModal') closeCard(); });
    $('#mUpgrade').addEventListener('click', upgradeCard);
    $('#passPlaque').addEventListener('click', () => { if (G.passOpen()) openPass(); else { KCSound.play('error'); toast('The Diamond Pass opens in Sunstone Arena (600 trophies).'); } });
    $('#passX').addEventListener('click', closePass);
    // the road: arrows, and the mouse wheel scrolls it sideways
    const rs = $('#roadScroll');
    $('#roadLeft').addEventListener('click', () => rs.scrollBy({ left: -rs.clientWidth * 0.7, behavior: 'smooth' }));
    $('#roadRight').addEventListener('click', () => rs.scrollBy({ left: rs.clientWidth * 0.7, behavior: 'smooth' }));
    rs.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { rs.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    window.addEventListener('resize', () => { if (tabNow === 'road') placeRoadMe(); });
    $('#onlineBtn').addEventListener('click', openOnline);
    $('#onlineX').addEventListener('click', closeOnline);
    $('#onlineModal').addEventListener('click', e => { if (e.target.id === 'onlineModal') closeOnline(); });
    KCNet.onChange(renderOnline);
    $('#kingBtn').addEventListener('click', openKing);
    $('#kingX').addEventListener('click', closeKing);
    $('#kingUp').addEventListener('click', upgradeKingClick);
    $('#kingModal').addEventListener('click', e => { if (e.target.id === 'kingModal') closeKing(); });
    for (const b of $$('.shop-jump button')) b.addEventListener('click', () => $('#' + b.dataset.jump).scrollIntoView({ behavior: 'smooth', block: 'start' }));
    $('#passMini').addEventListener('click', openPass);
    $('#passModal').addEventListener('click', e => { if (e.target.id === 'passModal') closePass(); });
    $('#mUse').addEventListener('click', () => startSwap(modalId));
    $('#swapCancel').addEventListener('click', endSwap);
    $('#chestOpen').addEventListener('click', e => { if (!e.target.closest('#coDone')) chestTap(); });
    $('#coDone').addEventListener('click', closeChest);
    window.addEventListener('keydown', e => {
      if ($('#home').hidden || e.repeat) return;
      if (!$('#chestOpen').hidden) {
        if (e.key === 'Escape' || (co && co.done && e.key === 'Enter')) { if (co && !co.done) summary(); else closeChest(); e.preventDefault(); }
        else if (e.key === ' ' || e.key === 'Enter') { chestTap(); e.preventDefault(); }
        return;
      }
      if (e.key === 'Escape') { closeCard(); closePops(); endSwap(); closePass(); closeKing(); if (!$('#onlineModal').hidden) closeOnline(); return; }
      if (!$('#cardModal').hidden || !$('#passModal').hidden || !$('#kingModal').hidden || !$('#onlineModal').hidden || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
      const n = '12345'.indexOf(e.key);
      if (n >= 0) { tab(TABS[n]); e.preventDefault(); }
      else if (e.key === 'Enter' && tabNow === 'battle' && (document.activeElement === document.body || !document.activeElement)) { opts.onBattle && opts.onBattle(nextFoe()); e.preventDefault(); }
    });
    // chest timers tick while the lobby is showing
    placeGlow();
    requestAnimationFrame(() => { placeGlow(); $('#nbGlow').classList.add('ready'); });
    window.addEventListener('resize', placeGlow);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeGlow);
    clearInterval(ticker);
    ticker = setInterval(tick, 1000);
    refresh();
  }

  return {
    init, refresh, recordResult, nextFoe, cardImg, tab, showChest,
    get name() { return P() ? P().name : 'Player'; },
    show() { refresh(); requestAnimationFrame(placeGlow); },
  };
})();
