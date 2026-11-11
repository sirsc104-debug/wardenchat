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

  const cardImg = id => imgs[id] || (imgs[id] = KCArt.portrait(id, 200, 240).toDataURL());
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
  function recordResult(foe, winner) {
    const r = foe.kind === 'trophy' ? G.recordTrophy(winner) : G.recordTrainer(foe.id, winner);
    return r;
  }

  // TEMPORARY test button: counts a win against the current opponent without playing the match,
  // with the same rewards as a real win.
  function simulateWin() {
    const foe = nextFoe(), r = recordResult(foe, 0);
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
  function fxBurst(el, n, kind, cols) {
    if (calm || !el) return;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.45;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * (kind === 'coin' ? 1.8 : 3.6), v = (kind === 'coin' ? 320 : 240) * (0.5 + Math.random());
      FX.parts.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: kind === 'coin' ? 900 : 320, life: 0.9 + Math.random() * 0.8, max: 1.7,
        r: kind === 'coin' ? 6 + Math.random() * 3 : 2 + Math.random() * 3, col: cols[Math.floor(Math.random() * cols.length)], spin: Math.random() * 6 });
    }
    if (FX.parts.length > 260) FX.parts.splice(0, FX.parts.length - 260);
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
    FX.parts = FX.parts.filter(p => p.life > 0 && p.y < innerHeight + 20);
  }
  const SPARKS = { platinum: ['#dcfcff', '#8ff0ff', '#ffffff'], legendary: ['#ffd25a', '#ff9a3d', '#ff5a2e', '#ffffff'], mythic: ['#eadcff', '#a98bff', '#6ff0de', '#ff6bd5', '#ffffff'],
    wooden: ['#ffe9a0', '#ffc861', '#ffffff'], silver: ['#d8f0ff', '#9fd0ff', '#ffffff'], gold: ['#fff3a0', '#ffd23f', '#ff9a3d', '#ffffff'] };

  // type: 'wooden' | 'silver' | 'gold', or null for a reward with no chest. got: { coins, cards: [{ id, n, isNew }] },
  // already added to the player's collection.
  function showChest(type, got, title) {
    const rank = c => (c.isNew ? 2 : KC_CARDS[c.id].rarity === 'rare' ? 1 : 0);
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
    KCSound.play('cardFly');
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
      const M = G.MAGIC[st.item], big = M.kind !== 'wild' || M.rarity === 'epic' || M.rarity === 'legendary';
      box.className = `co-reward rv-item r-${M.rarity}${big ? ' big' : ''}`;
      box.innerHTML = `<div class="rv-fly"><span class="rv-itemart">${itemSvg(st.item)}</span></div>
        <div class="rv-info"><div class="rv-line"><b class="rv-name">${esc(M.name)}</b><span class="rv-n" id="rvN">×${fmt(st.n)}</span>${big ? '<em>Rare find!</em>' : ''}</div><small>${esc(M.blurb)}</small></div>`;
      later(() => {
        $('#coReward .rv-info').classList.add('on');
        KCSound.play(big ? 'revealNew' : 'revealRare');
        fxBurst($('#coReward .rv-fly'), big ? 40 : 16, 'spark', ['#fff3a0', '#d49bff', '#7ff0e0', '#ffffff']);
      }, big ? 900 : 500);
      later(shown, big ? 1500 : 950);
      return;
    }
    const c = KC_CARDS[st.id], special = st.isNew || c.rarity === 'rare';
    box.className = `co-reward rv-card ${c.rarity}${st.isNew ? ' is-new' : ''}`;
    box.innerHTML = `<div class="rv-fly"><div class="rv-flip"><div class="rv-back"></div><img class="rv-front" src="${cardImg(st.id)}" alt=""></div></div>
      <div class="rv-info">
        <div class="rv-line"><b class="rv-name">${esc(c.name)}</b><span class="rv-n" id="rvN">×0</span>${st.isNew ? '<em>New card!</em>' : ''}</div>
        <div class="rv-bar" id="rvBar"><i style="width:${barPct(st, st.before).toFixed(1)}%"></i><span>${barText(st, st.before)}</span></div>
        <small id="rvNote"><span class="rar ${c.rarity}">${c.rarity}</span> Level ${st.level}</small>
      </div>`;
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
    if (st.item) { /* nothing counts up */ }
    else if (st.coins) $('#rvN').textContent = '+' + fmt(st.coins);
    else { $('#coReward .rv-fly').classList.add('tease'); $('#coReward .rv-flip').classList.add('flipped'); cardCount(st, st.n); }
    shown();
  }
  function shown() {
    co.phase = 'shown';
    const left = co.steps.length - co.i - 1;
    $('#coHint').textContent = left ? `Click for the next one (${left} left)` : 'Click to finish';
  }
  function summary() {
    stopTimers();
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
    $('#shopOffers').innerHTML = shop.offers.map((o, i) => {
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
      const btn = sold ? '<button class="buy-btn" type="button" disabled>Bought</button>'
        : `<button class="buy-btn${gem ? ' gem' : ''}${poor ? ' poor' : ''}${confirmOffer === i ? ' confirm' : ''}" type="button" data-offer="${i}"
            aria-label="${confirmOffer === i ? 'Confirm: buy' : 'Buy'} for ${o.price} ${gem ? 'diamonds' : 'coins'}">${confirmOffer === i ? 'Confirm ' : ''}${price}</button>`;
      return `<div class="offer ${o.currency}${sold ? ' sold' : ''}"><span class="of-tag">${esc(o.tag)}</span>${body}${btn}</div>`;
    }).join('');
    for (const b of $$('#shopOffers .buy-btn[data-offer]')) b.addEventListener('click', e => { e.stopPropagation(); buyClick(+b.dataset.offer); });
    // the chest row: a free Wooden Chest each day, then every tier for coins (contents stay hidden)
    const oddsText = t => { const o = G.chestOdds(t), w = G.wildActive() && Object.keys(G.MAGIC_RULES.wild[t] || {}).length; return `${fmt(o.cards)} cards<br>${fmt(o.coins[0])}–${fmt(o.coins[1])} coins${w ? '<br>+ wild cards' : ''}`; };
    const free = G.freeChestReady();
    const tiles = [`<div class="chest-tile free wooden${free ? '' : ' sold'}"><span class="of-tag">Free daily</span>
      <div class="ct-art">${chestSvg('wooden')}</div><b>Wooden Chest</b><small class="ct-odds">${oddsText('wooden')}</small>
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
    shopTimer();
  }
  function shopTimer() {
    const left = clock(G.shopEnds() - Date.now());
    for (const el of [$('#shopTimer'), $('#freeClock')]) if (el) el.textContent = left;
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

  /* ---------- magic items ---------- */
  const RCOL = { common: ['#8cc0f0', '#3f72b0'], rare: ['#ffc463', '#dc761c'], epic: ['#d49bff', '#8a3fd0'], legendary: ['#7ff0e0', '#ff7ad8'], any: ['#fff0a0', '#e0a020'] };
  // Item art, drawn in SVG: wild cards are glowing cards, books are bound tomes, the hammer has a book on it.
  function itemSvg(id) {
    const M = G.MAGIC[id], O = '#1c1530', [a, b] = RCOL[M.rarity] || RCOL.any, gid = 'g' + id;
    const grad = M.rarity === 'legendary' || id === 'book_books'
      ? `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ff0e0"/><stop offset=".5" stop-color="#d49bff"/><stop offset="1" stop-color="#ffb347"/></linearGradient>`
      : `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
    if (M.kind === 'wild') return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${grad}</defs>
      <rect x="10" y="8" width="38" height="48" rx="6" transform="rotate(-8 29 32)" fill="${b}" stroke="${O}" stroke-width="3" opacity=".7"/>
      <rect x="16" y="6" width="38" height="50" rx="6" fill="url(#${gid})" stroke="${O}" stroke-width="3"/>
      <path d="M35 14l3.5 9 9.5 1-7 6.5 2 9.5-8-5-8 5 2-9.5-7-6.5 9.5-1z" fill="#fff" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M22 46h26" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>`;
    if (M.kind === 'book') return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${grad}</defs>
      <path d="M12 12h36a4 4 0 0 1 4 4v38H16a4 4 0 0 1-4-4z" fill="#f3ead6" stroke="${O}" stroke-width="3"/>
      <path d="M10 10h34a4 4 0 0 1 4 4v38H14a4 4 0 0 1-4-4z" fill="url(#${gid})" stroke="${O}" stroke-width="3"/>
      <rect x="10" y="10" width="7" height="42" fill="rgba(0,0,0,.2)"/>
      <path d="M30 20l3 6 6.5.6-5 4.4 1.5 6.5L30 34l-6 3.5 1.5-6.5-5-4.4 6.5-.6z" fill="#fff6c8" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
      ${id === 'book_books' ? '<path d="M20 44h20M20 48h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' : `<text x="29" y="50" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="9" fill="#fff" stroke="${O}" stroke-width="2" paint-order="stroke">${M.rarity.slice(0, 1).toUpperCase()}</text>`}</svg>`;
    if (M.kind === 'hammer') return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${grad}</defs>
      <path d="M34 26l18 26-6 4-18-26z" fill="#a8703c" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M8 18l20-12 10 16-20 12z" fill="#c7cfda" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M14 20l12-7 5 8-12 7z" fill="url(#${gid})" stroke="${O}" stroke-width="2"/>
      <path d="M19 20l6-3.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6l14 18-14 34-14-34z" fill="#b48cff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M32 6l6 18-6 34" fill="#8a5ae0"/><path d="M18 24h28" stroke="${O}" stroke-width="2.5"/><path d="M26 14l-3 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  }
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
    const cards = P().found.filter(id => M.rarity === 'any' || KC_CARDS[id].rarity === M.rarity);
    const why = { full: 'Has the copies it needs', copies: 'Needs its copies first', max: 'Max level', rarity: 'Wrong rarity', 'none-held': 'You have none', 'not-found': 'Not found', none: '' };
    const rows = M.soon ? '<p class="dim">Nothing gives evolution shards yet. They arrive with evolutions.</p>'
      : !cards.length ? `<p class="dim">You have no ${M.rarity} cards yet.</p>`
        : `<div class="mp-cards">${cards.map(id => {
          const r = G.magicFor(magicSel, id), u = G.upgradeInfo(id);
          const what = r.ok ? (M.kind === 'hammer' ? `Upgrade to level ${r.level}` : `+${fmt(r.gives)} ${r.gives === 1 ? 'copy' : 'copies'}`) : why[r.reason] || '';
          return `<button type="button" class="mp-card${r.ok ? '' : ' off'}" data-card="${id}" ${r.ok ? '' : 'disabled'}>
            <img src="${cardImg(id)}" alt=""><span><b>${esc(KC_CARDS[id].name)}</b><small>Level ${u.level}${u.max ? '' : ` · ${fmt(u.count)} / ${fmt(u.need)}`}</small><em>${what}</em></span></button>`;
        }).join('')}</div>`;
    pick.innerHTML = `<div class="mp-head"><span class="mi-art big">${itemSvg(magicSel)}</span><div><b>${esc(M.name)}</b> <span class="mi-held">×${fmt(n)}</span><p>${esc(M.blurb)}</p></div></div>${rows}`;
    for (const b of $$('#magicPick .mp-card:not(.off)')) b.addEventListener('click', () => applyMagic(magicSel, b.dataset.card));
  }
  function applyMagic(item, id) {
    const r = G.useMagic(item, id);
    if (!r.ok) { toast('That item can\'t be used on that card right now.'); return; }
    KCSound.play(G.MAGIC[item].kind === 'hammer' ? 'double' : 'revealRare');
    toast(G.MAGIC[item].kind === 'hammer' ? `${KC_CARDS[id].name} upgraded to level ${r.level} with no coins!` : `${KC_CARDS[id].name}: +${fmt(r.gives)} ${r.gives === 1 ? 'copy' : 'copies'}`);
    refresh();
    if (!$('#cardModal').hidden && modalId === id) { modalId = null; openCard(id); }
  }
  // Buttons in a card's details window for the items that can be used on it.
  function modalMagic(id) {
    const box = $('#mMagic'), btns = G.MAGIC_ORDER.filter(it => G.magicFor(it, id).ok).map(it => {
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
    $('#roadTrack').innerHTML = road.map((m, i) => {
      const st = G.roadState(m), nextAt = road[i + 1] ? road[i + 1].at : m.at + 50;
      const fill = Math.max(0, Math.min(1, (p.trophies - m.at) / (nextAt - m.at)));
      return `<li class="rn ${st}" data-at="${m.at}">
        <div class="rn-card">${rewardHtml(m)}
          ${st === 'ready' ? `<button class="claim-btn" type="button" data-at="${m.at}">Claim</button>` : st === 'claimed' ? '<span class="rn-done" aria-label="Claimed"></span>' : st === 'soon' ? '<span class="rn-soon">Soon</span>' : '<span class="rn-lock" aria-label="Locked"></span>'}
        </div>
        <div class="rn-at"><i class="trophy-i" aria-hidden="true"></i>${m.at}</div>
        ${i < road.length - 1 ? `<div class="rn-line"><i style="width:${(fill * 100).toFixed(1)}%"></i></div>` : ''}
      </li>`;
    }).join('');
    for (const b of $$('#roadTrack .claim-btn')) b.addEventListener('click', () => claimAt(+b.dataset.at));
  }
  function scrollRoad() {
    const box = $('#roadScroll'), here = $('#roadTrack .rn.ready') || [...$$('#roadTrack .rn')].reverse().find(n => +n.dataset.at <= P().trophies);
    if (box && here) box.scrollLeft = Math.max(0, here.offsetLeft - box.clientWidth / 2 + here.clientWidth / 2);
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
      const pct = Math.min(100, u.count / u.need * 100);
      return `<span class="lvl-strip"><span>Level ${u.level}</span><span class="cprog${u.count >= u.need ? ' full' : ''}"><i style="width:${pct.toFixed(0)}%"></i><em>${u.count}/${u.need}</em></span></span>`;
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
        <span class="cc-art"><img src="${cardImg(id)}" alt=""><span class="cost">${c.cost}</span>${deck.includes(id) ? '<span class="in-deck" title="In your deck">In deck</span>' : ''}${u.can ? '<span class="up-arrow" aria-label="Upgrade ready"></span>' : ''}</span>
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
      const up = next && (k === 'Health' || k === 'Damage') ? `<em>+${Math.round((k === 'Health' ? c.hp : c.dmg) * next) - val}</em>` : '';
      return `<div><small>${k}</small><b>${val}${up}</b></div>`;
    }).join('');
    $('#mEvo').textContent = c.evo;
    modalMagic(id);
    // level, copies and the buttons
    $('#mLevel').textContent = u.found ? (u.max ? `Level ${u.level} · Max` : `Level ${u.level}`) : 'Not found yet';
    const pct = u.found && !u.max ? Math.min(100, u.count / u.need * 100) : u.max ? 100 : 0;
    $('#mProgFill').style.width = pct + '%';
    $('#mProgFill').parentElement.classList.toggle('full', !!u.can || (u.found && !u.max && u.count >= u.need));
    $('#mProgText').textContent = !u.found ? `Trophy Road · ${G.unlockAt(id)} trophies` : u.max ? 'Max level' : `${u.count} / ${u.need} cards`;
    const upBtn = $('#mUpgrade');
    upBtn.hidden = !u.found || u.max;
    upBtn.disabled = !u.can;
    $('#mUpCost').innerHTML = `<i class="coin-i" aria-hidden="true"></i>${fmt(u.cost || 0)}`;
    const inDeck = P().deck.includes(id);
    $('#mUse').hidden = !u.found || inDeck;
    $('#mNote').textContent = !u.found ? 'Reach it on the Trophy Road to add it to your collection.'
      : u.max ? '' : u.reason === 'copies' ? `Needs ${u.need - u.count} more card${u.need - u.count === 1 ? '' : 's'} from chests.`
        : u.reason === 'coins' ? `Needs ${fmt(u.cost - P().coins)} more coins.` : inDeck ? 'In your deck.' : '';
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
  function upgradeCard() {
    const id = modalId, r = G.upgrade(id);
    if (!r) return;
    KCSound.play('double');
    toast(`${KC_CARDS[id].name} reached level ${r.level}!${r.levelUp ? ` You are now level ${r.levelUp}.` : ''}`);
    const card = $('.modal-card');
    card.classList.remove('leveled'); void card.offsetWidth; card.classList.add('leveled');
    refresh();
    modalId = null; openCard(id);
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
    $('#passText').innerHTML = open ? '<span class="tag-lock">Soon</span> The Kingdom Pass arrives in a later update. Members will get the premium track.'
      : '<span class="tag-lock">Locked</span> Opens with the Trophy Road. Members get the premium track.';
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
    $('#xpFill').style.width = (into / G.XP_PER_LEVEL * 100).toFixed(1) + '%';
    $('#xpText').textContent = `${into} / ${G.XP_PER_LEVEL}`;
    $('#coinVal').textContent = fmt(p.coins);
    $('#gemVal').textContent = fmt(p.diamonds);
    $('#shopTag').hidden = !G.freeChestReady();
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
      if (e.key === 'Escape') { closeCard(); closePops(); endSwap(); return; }
      if (!$('#cardModal').hidden || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
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
    init, refresh, recordResult, nextFoe, cardImg, tab,
    get name() { return P() ? P().name : 'Player'; },
    show() { refresh(); requestAnimationFrame(placeGlow); },
  };
})();
