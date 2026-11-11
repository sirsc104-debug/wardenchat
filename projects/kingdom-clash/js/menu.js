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
  };
  function chestSvg(type, open) {
    const L = CHEST_LOOK[type] || CHEST_LOOK.wooden, O = '#1c1530';
    const planks = type === 'wooden'
      ? [44, 60, 76].map(x => `<path d="M${x} 59v36" stroke="${L.bodySh}" stroke-width="2"/>`).join('') + [46, 60, 74].map(x => `<path d="M${x} 20v24" stroke="${L.lidSh}" stroke-width="2"/>`).join('')
      : type === 'silver'
        ? [[44, 68], [76, 68], [44, 86], [76, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${L.trim}"/>`).join('')
        : `<path d="M46 62h28v26H46z" fill="${L.band}" stroke="${O}" stroke-width="2"/><path d="M52 78l3-9 5 6 5-6 3 9z" fill="${L.trim}"/>`;
    const lock = type === 'wooden'
      ? `<rect x="52" y="42" width="16" height="20" rx="4" fill="${L.lock}" stroke="${O}" stroke-width="3"/><circle cx="60" cy="50" r="2.6" fill="${O}"/><path d="M60 50v6" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>`
      : `<rect x="51" y="41" width="18" height="22" rx="5" fill="${L.trim}" stroke="${O}" stroke-width="3"/><path d="M60 45l6 7-6 8-6-8z" fill="${L.lock}" stroke="${O}" stroke-width="2"/>`;
    const crown = type === 'gold' ? `<path d="M48 16l2-12 6 7 4-9 4 9 6-7 2 12z" fill="${L.trim}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="60" cy="11" r="2" fill="${L.lock}"/>` : '';
    const stars = type === 'gold' ? `<g class="ch-stars" fill="#fff"><path d="M20 30l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/><path d="M100 22l1.2 3.2 3.2 1.2-3.2 1.2-1.2 3.2-1.2-3.2-3.2-1.2 3.2-1.2z"/><path d="M98 70l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"/></g>` : '';
    return `<svg class="chest-svg chest-${type}${open ? ' open' : ''}" viewBox="0 0 120 110" aria-hidden="true">
      <ellipse cx="60" cy="100" rx="46" ry="7" fill="rgba(0,0,0,0.3)"/>
      <path class="ch-beam" d="M26 50L6 -40h108L94 50z" fill="${L.glow}"/>
      <g class="ch-inside"><path d="M17 30h86v26H17z" fill="#1a0f1e" stroke="${O}" stroke-width="3"/><ellipse class="ch-glow" cx="60" cy="50" rx="38" ry="12" fill="${L.glow}"/></g>
      <g class="ch-base">
        <rect x="14" y="52" width="92" height="44" rx="6" fill="${L.body}" stroke="${O}" stroke-width="3"/>
        <path d="M15.5 82h89v8a4.5 4.5 0 0 1-4.5 4.5h-80a4.5 4.5 0 0 1-4.5-4.5z" fill="${L.bodySh}"/>
        ${planks}
        <rect x="24" y="52" width="11" height="44" fill="${L.band}" stroke="${O}" stroke-width="2.5"/><rect x="85" y="52" width="11" height="44" fill="${L.band}" stroke="${O}" stroke-width="2.5"/>
        <path d="M25.5 84h8v10.5h-8zM86.5 84h8v10.5h-8z" fill="${L.bandSh}"/>
        <rect x="11" y="50" width="98" height="9" rx="3" fill="${L.trim}" stroke="${O}" stroke-width="3"/>
      </g>
      <g class="ch-lid">
        <path d="M14 52V38Q14 14 60 14Q106 14 106 38V52Z" fill="${L.lid}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M22 30Q30 19 52 17" stroke="rgba(255,255,255,0.45)" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M24 23.5L35 19V50H24zM85 19l11 4.5V50H85z" fill="${L.band}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="11" y="43" width="98" height="9" rx="3" fill="${L.trim}" stroke="${O}" stroke-width="3"/>
        ${crown}${lock}
      </g>
      ${stars}
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
  const SPARKS = { wooden: ['#ffe9a0', '#ffc861', '#ffffff'], silver: ['#d8f0ff', '#9fd0ff', '#ffffff'], gold: ['#fff3a0', '#ffd23f', '#ff9a3d', '#ffffff'] };

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
    if (co) stopTimers();
    co = { type, got: { coins: got.coins, cards }, steps, i: -1, phase: 'drop', timers: [], counter: 0, done: false };
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
      fxBurst(svg, co.type === 'gold' ? 60 : co.type === 'silver' ? 44 : 30, 'spark', SPARKS[co.type]);
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
    if (st.coins) $('#rvN').textContent = '+' + fmt(st.coins);
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
          <span class="of-prog${!u.max && after >= u.need ? ' full' : ''}"><i style="width:${pct.toFixed(0)}%"></i><em>${u.max ? 'Max level' : `${fmt(after)} / ${fmt(u.need)}`}</em></span>
          <small class="of-note">Level ${u.level}${u.max ? '' : sold ? '' : after >= u.need ? ' · ready to upgrade after' : ' · after buying'}</small>`;
      }
      const price = `<i class="${gem ? 'gem-i' : 'coin-i'}" aria-hidden="true"></i>${fmt(o.price)}`;
      const btn = sold ? '<button class="buy-btn" type="button" disabled>Bought</button>'
        : `<button class="buy-btn${gem ? ' gem' : ''}${poor ? ' poor' : ''}${confirmOffer === i ? ' confirm' : ''}" type="button" data-offer="${i}"
            aria-label="${confirmOffer === i ? 'Confirm: buy' : 'Buy'} for ${o.price} ${gem ? 'diamonds' : 'coins'}">${confirmOffer === i ? 'Confirm ' : ''}${price}</button>`;
      return `<div class="offer ${o.currency}${sold ? ' sold' : ''}"><span class="of-tag">${esc(o.tag)}</span>${body}${btn}</div>`;
    }).join('');
    for (const b of $$('#shopOffers .buy-btn[data-offer]')) b.addEventListener('click', e => { e.stopPropagation(); buyClick(+b.dataset.offer); });
    shopTimer();
  }
  function shopTimer() { const el = $('#shopTimer'); if (el) el.textContent = clock(G.shopEnds() - Date.now()); }
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

  /* ---------- the Trophy Road ---------- */
  function rewardHtml(m) {
    if (m.kind === 'coins') return `<span class="rw-coins"><span class="co-coin" aria-hidden="true"></span><b>${fmt(m.amount)}</b></span><small>Coins</small>`;
    if (m.kind === 'chest') return `<span class="rw-chest">${chestSvg(m.chest)}</span><small>${G.CHESTS[m.chest].name}</small>`;
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
      const st = G.roadState(m), what = m.kind === 'coins' ? `${fmt(m.amount)} coins` : m.kind === 'chest' ? G.CHESTS[m.chest].name : m.kind === 'card' ? `${KC_CARDS[m.card].name} ×${m.copies}` : `Arena ${G.ARENAS.find(x => x.id === m.arena).number}`;
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
      if (G.shop().day !== day) renderShop(); else shopTimer();
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
