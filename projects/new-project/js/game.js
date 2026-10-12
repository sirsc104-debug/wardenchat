/* Apples to Oranges — the game: screens, matchups, the reveal, scoring and saving bests. */
'use strict';

(function () {
  const $ = id => document.getElementById(id);

  const DIFFS = {
    owen:   { name: 'Owen (Easy)', time: 15, lives: 3, mult: 1 },
    medium: { name: 'Medium',      time: 10, lives: 2, mult: 1.5 },
    hard:   { name: 'Hard',        time: 7,  lives: 1, mult: 2 }
  };

  // Altitude is the score times this, in metres.
  const M_PER_POINT = 3;
  const STOPS = [
    { alt: 20,     name: 'The Treetops',         ic: '🌳' },
    { alt: 60,     name: 'The Rooftops',         ic: '🏠' },
    { alt: 150,    name: 'Kite Height',          ic: '🪁' },
    { alt: 400,    name: 'The Birds',            ic: '🐦' },
    { alt: 828,    name: 'Burj Khalifa Height',  ic: '🏙️' },
    { alt: 2000,   name: 'The Clouds',           ic: '☁️' },
    { alt: 5000,   name: 'The Mountain Peaks',   ic: '🏔️' },
    { alt: 8849,   name: 'Mount Everest',        ic: '🗻' },
    { alt: 11000,  name: 'The Jet Planes',       ic: '✈️' },
    { alt: 15000,  name: 'The Stratosphere',     ic: '🌌' },
    { alt: 21027,  name: 'The Balloon World Record', ic: '🏆', sub: 'Vijaypat Singhania flew a hot-air balloon to 21,027 m in 2005' },
    { alt: 35000,  name: 'The Weather Balloons', ic: '🎈' },
    { alt: 100000, name: 'The Edge of Space',    ic: '🚀' }
  ];

  // ---- Saving (best scores) ----------------------------------------------
  let best = { owen: 0, medium: 0, hard: 0 };
  try { Object.assign(best, JSON.parse(localStorage.getItem('a2o.best') || '{}')); } catch (e) { /* storage blocked */ }
  function saveBest() { try { localStorage.setItem('a2o.best', JSON.stringify(best)); } catch (e) { /* ignore */ } }

  // ---- Formatting ----------------------------------------------------------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const commas = n => Math.round(n).toLocaleString('en-US');
  const numText = f => f.show || (f.year ? String(f.n) : commas(f.n));
  const withUnit = f => numText(f) + (f.u ? ' ' + f.u : '');
  const fmtAlt = m => (m < 10000 ? commas(m) + ' m' : (m / 1000).toFixed(1) + ' km');
  const pickOne = a => a[Math.floor(Math.random() * a.length)];

  function textSize(s) { return s.length > 46 ? 25 : s.length > 32 ? 29 : 34; }
  function numSize(s) { return s.length <= 6 ? 90 : s.length <= 9 ? 76 : s.length <= 13 ? 56 : 36; }

  // ---- Fit the 1600×900 stage to the window ------------------------------
  const stage = $('stage');
  let scale = 1;
  function fit() {
    const vw = $('viewport').clientWidth, vh = $('viewport').clientHeight;
    scale = Math.min(vw / 1600, vh / 900);
    const w = vw / scale, h = vh / scale;
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    stage.style.transform = `scale(${scale})`;
    Scene.resize(w, h, scale);
  }
  window.addEventListener('resize', fit);

  // ---- Home ----------------------------------------------------------------
  function showBests() {
    document.querySelectorAll('[data-best]').forEach(el => {
      const b = best[el.dataset.best];
      el.textContent = b ? 'Best: ' + commas(b) : 'Not flown yet';
    });
  }
  function goHome() {
    G = null;
    $('game').classList.add('hidden'); $('over').classList.add('hidden'); $('pause').classList.add('hidden');
    $('home').classList.remove('hidden');
    showBests();
    Scene.setAlt(0);
    Sound.musicLevel(1);
    if (musicStarted) Sound.music('breeze');
  }
  function syncSoundButtons() {
    const m = Sound.isMuted();
    $('btnSound').textContent = m ? '🔇' : '🔊';
    $('btnPauseSound').textContent = m ? '🔇 Sound off' : '🔊 Sound on';
    const on = Sound.musicEnabled();
    $('btnMusic').classList.toggle('off', !on);
    $('btnPauseMusic').textContent = on ? '🎵 Music on' : '🎵 Music off';
  }
  function toggleSound() { Sound.setMuted(!Sound.isMuted()); syncSoundButtons(); Sound.click(); }

  // Music: Breeze down low, Sky once the balloon is past the jet planes.
  const SKY_ALT = 11000;
  const trackNow = () => (G && G.alt >= SKY_ALT ? 'sky' : 'breeze');
  let musicStarted = false;
  function startMusic() {          // browsers only allow sound after a click or key press
    if (musicStarted) return;
    musicStarted = true;
    Sound.unlock();
    Sound.music(trackNow());
  }
  function toggleMusic() {
    startMusic();
    Sound.setMusicEnabled(!Sound.musicEnabled());
    Sound.music(trackNow());
    syncSoundButtons();
  }

  // ---- A run ----------------------------------------------------------------
  let G = null;

  function start(diff) {
    Sound.unlock(); Sound.click();
    startMusic();
    Sound.musicLevel(1);
    const d = DIFFS[diff];
    G = {
      diff, d, score: 0, alt: 0, lives: d.lives, streak: 0, bestStreak: 0, right: 0, asked: 0,
      photoWon: 0, photoLost: 0, used: new Set(), pstate: { pendingPhoto: false },
      left: null, right_: null, timeLeft: d.time, phase: 'ask', paused: false, killer: null, stop: -1
    };
    G.left = Pairs.first();
    G.used.add(G.left.id);
    G.right_ = Pairs.next(G.left, diff, G.used, G.pstate);
    G.used.add(G.right_.id);

    $('home').classList.add('hidden'); $('over').classList.add('hidden');
    $('game').classList.remove('hidden');
    Scene.setAlt(0, true);
    buildRail();
    renderLives();
    updateHud();
    renderCards(true);
    newRound();
    Sound.music('breeze');
  }

  function newRound() {
    G.asked++;
    G.phase = 'ask';
    G.timeLeft = G.d.time;
    $('qcount').textContent = 'Matchup ' + G.asked;
    $('result').className = 'result';
    $('resultQuip').textContent = ''; $('resultLine').textContent = ''; $('resultPts').textContent = '';
    $('photoBanner').classList.add('hidden');
  }

  function cardHTML(f, hidden) {
    const cat = CATS[f.c];
    const t = cap(f.t), num = numText(f);
    return `<div class="chip"><span class="chip-ic">${cat.icon}</span>${esc(cat.name)}</div>
      <div class="ctext" style="font-size:${textSize(t)}px">${esc(t)}</div>
      <div class="cnum${hidden ? ' hidden-num' : ''}" style="font-size:${numSize(num)}px">${hidden ? '?' : esc(num)}</div>
      <div class="cunit">${esc(f.u)}</div>
      <div class="cnote">${hidden ? '' : esc(f.note || '')}</div>
      ${hidden ? `<div class="choices">
        <button class="btn-hi" type="button" data-g="higher">▲ Higher</button>
        <button class="btn-lo" type="button" data-g="lower">▼ Lower</button>
      </div>` : ''}`;
  }

  function renderCards(first) {
    const L = $('cardL'), R = $('cardR');
    L.className = 'card card-l'; R.className = 'card card-r' + (first ? '' : ' in');
    L.innerHTML = cardHTML(G.left, false);
    R.innerHTML = cardHTML(G.right_, true);
    R.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => guess(b.dataset.g)));
  }

  // ---- HUD -----------------------------------------------------------------
  function buildRail() {
    $('rail').innerHTML = STOPS.slice().reverse().map((s, i) =>
      `<div class="rail-stop" data-i="${STOPS.length - 1 - i}" title="${esc(s.name)} · ${fmtAlt(s.alt)}">${s.ic}</div>`).join('');
  }
  function renderLives() {
    $('hudLives').innerHTML = Array.from({ length: G.d.lives }, (_, i) => `<span class="${i < G.lives ? '' : 'gone'}">🎈</span>`).join('');
  }
  function updateHud() {
    $('hudScore').textContent = commas(G.score);
    $('hudAlt').textContent = fmtAlt(G.alt);
    const next = STOPS.find(s => s.alt > G.alt);
    $('hudNext').textContent = next ? `Next stop: ${next.ic} ${next.name} · ${fmtAlt(next.alt)}` : 'Higher than anyone has ever gone!';
    $('hudStreak').textContent = G.streak;
    $('hudMult').textContent = 'next ×' + Math.min(5, 1 + 0.25 * G.streak).toFixed(2);
    const sp = $('streakPill');
    sp.classList.toggle('hot', G.streak >= 3);
    sp.classList.toggle('blazing', G.streak >= 8);
    document.querySelectorAll('.rail-stop').forEach(el => {
      const i = +el.dataset.i;
      el.classList.toggle('done', STOPS[i].alt <= G.alt);
      el.classList.toggle('next', next === STOPS[i]);
    });
  }

  function showReached(s) {
    const el = $('reached');
    $('reachedIc').textContent = s.ic;
    $('reachedName').textContent = s.name;
    $('reachedSub').textContent = s.sub || fmtAlt(s.alt) + ' up';
    el.classList.add('hidden'); void el.offsetWidth; el.classList.remove('hidden');
    clearTimeout(showReached.t);
    showReached.t = setTimeout(() => el.classList.add('hidden'), 2900);
    Sound.milestone();
    Scene.confetti(60, Scene.balloonX());
  }

  // ---- Timer loop ----------------------------------------------------------
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (G && G.phase === 'ask' && !G.paused && !portrait.matches) {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) { G.timeLeft = 0; reveal(null); }
    }
    if (G && G.phase === 'ask') {
      const frac = G.timeLeft / G.d.time;
      $('timerFill').style.transform = `scaleX(${frac})`;
      $('timerSecs').textContent = Math.ceil(G.timeLeft) + 's';
      const used = 1 - frac;
      $('speedLabel').textContent = used < 0.25 ? '⚡ ×2 speed bonus' : used < 0.5 ? '⚡ ×1.5 speed bonus' : '';
    }
    requestAnimationFrame(loop);
  }

  // ---- Guess and reveal ----------------------------------------------------
  function guess(g) {
    if (!G || G.phase !== 'ask' || G.paused) return;
    Sound.click();
    reveal(g);
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(r));

  // Count the hidden number up on the right card. A photo finish races most of the way,
  // then crawls the last few numbers one at a time, slower and slower.
  async function countUp(f, other, photo) {
    const el = $('cardR').querySelector('.cnum');
    el.classList.remove('hidden-num');
    $('cardR').classList.add('counting');
    const show = v => { el.textContent = f.year ? String(Math.round(v)) : commas(v); };
    const big = f.n > 1e12;
    const crawlFrom = photo ? Math.max(0, Math.max(Math.min(f.n, other.n) - 3, f.n - 8)) : f.n;
    const fastTo = photo ? crawlFrom : f.n;
    const dur = photo ? 900 : 850;
    const t0 = performance.now();
    let lastTick = 0;
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      if (big) el.textContent = commas(Math.pow(10, Math.log10(f.n) * e));
      else show(fastTo * e);
      if (performance.now() - lastTick > 55 && t < 1) { Sound.tick(); lastTick = performance.now(); }
      if (t >= 1) break;
      await frame();
    }
    if (photo) {
      Sound.musicLevel(0.15);
      $('photoBanner').classList.remove('hidden');
      flash();
      const steps = f.n - crawlFrom;
      Sound.drumroll(0.3 + steps * 0.45);
      for (let i = 1; i <= steps; i++) {
        await wait(200 + i * 95);
        if (!G) return;
        show(crawlFrom + i);
        Sound.photoTick(i);
        el.style.transform = 'scale(1.12)';
        setTimeout(() => { el.style.transform = ''; }, 120);
      }
      await wait(350);
    }
    el.textContent = numText(f);
    $('cardR').classList.remove('counting');
    const note = $('cardR').querySelector('.cnote');
    note.textContent = f.note || '';
  }

  function flash() {
    const el = $('flash');
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }

  function sentence(L, R) {
    if (L.n === R.n) return `${cap(L.t)} and ${R.t} are both ${numText(L)}!`;
    const [hi, lo] = L.n > R.n ? [L, R] : [R, L];
    return `${cap(hi.t)} (${withUnit(hi)}) beats ${lo.t} (${withUnit(lo)}).`;
  }

  async function reveal(g) {
    const L = G.left, R = G.right_;
    const run = G;
    G.phase = 'reveal';
    const usedFrac = 1 - G.timeLeft / G.d.time;
    const photo = Pairs.isPhoto(L, R), tie = L.n === R.n;
    const ok = !!g && (tie || (g === 'higher' ? R.n > L.n : R.n < L.n));
    const gap = Math.abs(L.n - R.n);

    const choices = $('cardR').querySelector('.choices');
    if (choices) {
      choices.classList.add('locked');
      const btn = choices.querySelector(`[data-g="${g}"]`);
      if (btn) btn.classList.add('chosen');
    }
    if (!g) Sound.timeout();

    await countUp(R, L, photo);
    if (G !== run) return;            // quit during the reveal

    const res = $('result'), quip = $('resultQuip');
    let pts = 0, quipText, quipCls, ptsText = '';
    if (ok) {
      const tier = Pairs.tierOf(L, R);
      const T = Pairs.TIERS[tier];
      const speed = usedFrac < 0.25 ? 2 : usedFrac < 0.5 ? 1.5 : 1;
      const streakMult = Math.min(5, 1 + 0.25 * G.streak);
      pts = Math.round(T.pts * G.d.mult * speed * streakMult);
      G.streak++; G.right++;
      G.bestStreak = Math.max(G.bestStreak, G.streak);
      const parts = [`<span class="${T.cls}">+${commas(pts)} · ${T.name}</span>`];
      if (G.d.mult > 1) parts.push(`×${G.d.mult} ${G.diff}`);
      if (speed > 1) parts.push(`×${speed} speed`);
      if (streakMult > 1) parts.push(`×${streakMult.toFixed(2)} streak`);
      ptsText = parts.join(' &nbsp;·&nbsp; ');
      if (photo) {
        G.photoWon++;
        quipText = tie ? 'IT’S A TIE?! Both answers count!' : gap === 1 ? 'PHOTO FINISH! By ONE!' : `PHOTO FINISH! By ${gap}!`;
        quipCls = 'q-photo';
        tie ? Sound.tie() : Sound.photoWin();
        Scene.confetti(160);
        flash();
      } else {
        quipText = tier === 3 ? pickOne(['So close!', 'Nailed it!', 'Close call!', 'Ooh, nice!'])
          : tier === 2 ? pickOne(['Nice!', 'Good call!', 'Yep!', 'Correct!'])
          : pickOne(['Easy!', 'Obviously.', 'Too easy.', 'Yep!']);
        quipCls = 'q-good';
        Sound.good(tier);
      }
      $('cardR').classList.add('right-ans');
      Scene.burn(photo ? 2.2 : 1.3);
      Sound.burner();
      addScore(pts);
    } else {
      G.lives--; G.streak = 0;
      G.killer = { L, R, g, photo, gap };
      if (photo) {
        G.photoLost++;
        quipText = gap === 1 ? 'Lost by ONE.' : `Lost by ${gap}.`;
        quipCls = 'q-bad';
        Sound.photoLose();
      } else {
        quipText = !g ? 'Too slow!' : Pairs.ratio(L, R) >= 10 ? 'Not even close!' : pickOne(['Nope!', 'Oof!', 'Wrong way!']);
        quipCls = 'q-bad';
        if (g) Sound.bad();
      }
      $('cardR').classList.add('wrong-ans');
      Scene.dip();
      renderLives();
      const lifeEls = $('hudLives').children;
      if (lifeEls[G.lives]) lifeEls[G.lives].classList.add('pop');
      updateHud();
    }
    quip.className = 'result-quip ' + quipCls;
    quip.textContent = quipText;
    $('resultLine').textContent = sentence(L, R);
    $('resultPts').innerHTML = ptsText;
    res.classList.remove('pop'); void res.offsetWidth; res.classList.add('pop');

    if (photo) setTimeout(() => { if (G === run && !G.paused) Sound.musicLevel(1); }, 1800);
    await wait(photo ? 2700 : ok ? 1500 : 2100);
    if (G !== run) return;
    while (G.paused) { await wait(100); if (G !== run) return; }
    if (G.lives <= 0) gameOver();
    else advance();
  }

  function addScore(pts) {
    const before = G.alt;
    G.score += pts;
    G.alt = G.score * M_PER_POINT;
    Scene.setAlt(G.alt);
    if (musicStarted) Sound.music(trackNow());
    const pill = document.querySelector('.score-pill');
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    const passed = STOPS.filter(s => s.alt > before && s.alt <= G.alt);
    if (passed.length) setTimeout(() => { if (G) showReached(passed[passed.length - 1]); }, 700);
    updateHud();
  }

  async function advance() {
    const L = $('cardL'), R = $('cardR');
    L.classList.add('out'); R.classList.add('shift');
    await wait(430);
    if (!G) return;
    G.left = G.right_;
    G.right_ = Pairs.next(G.left, G.diff, G.used, G.pstate);
    G.used.add(G.right_.id);
    renderCards(false);
    newRound();
  }

  // ---- Game over and sharing -----------------------------------------------
  function shareText() {
    const reached = STOPS.filter(s => s.alt <= G.alt).pop();
    const lines = [
      `🍎 Apples to Oranges 🍊 (${G.d.name})`,
      `${commas(G.score)} points · ${G.right} right · best streak ${G.bestStreak}`,
      `🎈 ${reached ? 'Reached ' + reached.name : 'Never left the ground'} (${fmtAlt(G.alt)})`
    ];
    if (G.photoWon || G.photoLost) lines.push(`📸 Photo finishes: ${G.photoWon} won, ${G.photoLost} lost`);
    const k = G.killer;
    if (k) {
      lines.push(k.photo
        ? `💀 Lost by ${k.gap === 1 ? 'ONE' : k.gap}: ${k.L.t} (${numText(k.L)}) vs ${k.R.t} (${numText(k.R)})`
        : `💀 Taken down by ${k.L.t} (${numText(k.L)}) vs ${k.R.t} (${numText(k.R)})`);
    }
    return lines.join('\n');
  }

  function gameOver() {
    G.phase = 'over';
    Sound.over();
    const isBest = G.score > (best[G.diff] || 0);
    if (isBest) { best[G.diff] = G.score; saveBest(); }
    const reached = STOPS.filter(s => s.alt <= G.alt).pop();

    $('overKicker').textContent = G.d.name;
    $('overTitle').textContent = G.right === 0 ? 'Never left the ground!' : 'Out of hot air!';
    $('overScore').textContent = commas(G.score);
    const ob = $('overBest');
    ob.className = 'over-best' + (isBest && G.score > 0 ? ' new' : '');
    ob.textContent = isBest && G.score > 0 ? '🏆 New best!' : best[G.diff] ? 'Best: ' + commas(best[G.diff]) : '';
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    $('overStats').innerHTML =
      stat(fmtAlt(G.alt), reached ? esc(reached.name) : 'On the ground') +
      stat(G.right, 'Right answers') +
      stat(G.bestStreak, 'Best streak') +
      stat(`${G.photoWon}/${G.photoWon + G.photoLost}`, 'Photo finishes won');
    const k = G.killer;
    $('overKiller').innerHTML = k
      ? `💀 ${k.g ? (k.photo ? `Lost by <b>${k.gap === 1 ? 'ONE' : k.gap}</b>` : 'Taken down by') : 'Ran out of time on'}: ${esc(cap(k.L.t))} (<b>${esc(withUnit(k.L))}</b>) vs ${esc(k.R.t)} (<b>${esc(withUnit(k.R))}</b>)`
      : '';
    $('btnShare').textContent = '📋 Share';
    setTimeout(() => $('over').classList.remove('hidden'), 500);
  }

  async function share() {
    const text = shareText();
    let done = false;
    try {
      if (navigator.share && window.self === window.top && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ text }); done = true; }
    } catch (e) { /* cancelled */ }
    if (!done) {
      try { await navigator.clipboard.writeText(text); done = true; } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { done = document.execCommand('copy'); } catch (e2) { done = false; }
        ta.remove();
      }
      $('btnShare').textContent = done ? '✅ Copied!' : '❌ Couldn’t copy';
    }
  }

  // ---- Pause ---------------------------------------------------------------
  function setPaused(p) {
    if (!G || G.phase === 'over') return;
    G.paused = p;
    $('pause').classList.toggle('hidden', !p);
    Sound.musicLevel(p ? 0.35 : 1);
    syncSoundButtons();
  }

  // ---- Wiring --------------------------------------------------------------
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => start(b.dataset.diff)));
  $('btnSound').addEventListener('click', toggleSound);
  $('btnPauseSound').addEventListener('click', toggleSound);
  $('btnMusic').addEventListener('click', toggleMusic);
  $('btnPauseMusic').addEventListener('click', toggleMusic);
  document.addEventListener('pointerdown', startMusic, { once: true });
  document.addEventListener('keydown', startMusic, { once: true });
  $('btnFull').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  });
  $('btnPause').addEventListener('click', () => setPaused(true));
  $('btnResume').addEventListener('click', () => setPaused(false));
  $('btnQuit').addEventListener('click', goHome);
  $('btnAgain').addEventListener('click', () => start(G ? G.diff : 'owen'));
  $('btnHome').addEventListener('click', goHome);
  $('btnShare').addEventListener('click', share);

  document.addEventListener('keydown', e => {
    if (!G) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (G.phase !== 'over') setPaused(!G.paused); return; }
    if (G.paused) return;
    if (G.phase === 'over') { if (e.key === 'Enter') start(G.diff); return; }
    if (['ArrowUp', 'w', 'W', 'h', 'H'].includes(e.key)) { e.preventDefault(); guess('higher'); }
    else if (['ArrowDown', 's', 'S', 'l', 'L'].includes(e.key)) { e.preventDefault(); guess('lower'); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.phase === 'ask') setPaused(true); });

  Scene.init($('scene'));
  fit();
  showBests();
  syncSoundButtons();
  requestAnimationFrame(loop);
})();
