/* Brain Rocket — game flow, scoring and UI. */
'use strict';

(function () {
  const MODES = {
    easy:   { id: 'easy',   label: 'Owen (Easy)', time: 30, lives: 5, mult: 1,   skips: 5 },
    medium: { id: 'medium', label: 'Medium',      time: 20, lives: 3, mult: 1.5, skips: 3 },
    hard:   { id: 'hard',   label: 'Hard',        time: 12, lives: 3, mult: 2,   skips: 2 }
  };

  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const el = {
    hud: $('hud'), track: $('track'), card: $('card'), title: $('title'), pause: $('pause'), over: $('over'),
    score: $('hudScore'), alt: $('hudAlt'), next: $('hudNext'), streak: $('hudStreak'), mult: $('hudMult'),
    streakPill: $('streakPill'), fuel: $('hudFuel'), qCat: $('qCat'), qNum: $('qNum'), qText: $('qText'),
    timer: document.querySelector('.timer'), timerFill: $('timerFill'), timerSecs: $('timerSecs'), speed: $('speedBadge'),
    form: $('answerForm'), input: $('answer'), go: $('goBtn'), feedback: $('feedback'), reveal: $('reveal'),
    skip: $('skipBtn'), skipCount: $('skipCount'), popups: $('popups'), banner: $('banner'), countdown: $('countdown'),
    trackStops: $('trackStops'), trackFill: $('trackFill'), trackRocket: $('trackRocket')
  };

  // ---- Stage scaling (always 16:9) ------------------------------------
  function fit() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    stage.style.transform = `scale(${s}) translate(-50%, -50%)`;
    Scene.resize(s);
  }

  // ---- Saved bests ------------------------------------------------------
  let bests = {};
  try { bests = JSON.parse(localStorage.getItem('brainRocket.bests') || '{}') || {}; } catch (e) { bests = {}; }
  function saveBests() { try { localStorage.setItem('brainRocket.bests', JSON.stringify(bests)); } catch (e) { /* ignore */ } }

  // ---- Distance helpers -------------------------------------------------
  function kmAt(alt) {
    const M = MILESTONES;
    if (alt <= 0) return 0;
    for (let i = 0; i < M.length - 1; i++) {
      const a = M[i], b = M[i + 1];
      if (alt <= b.alt) {
        const t = (alt - a.alt) / (b.alt - a.alt);
        if (a.km <= 0) return b.km * t;
        return Math.exp(Math.log(a.km) + (Math.log(b.km) - Math.log(a.km)) * t);
      }
    }
    const last = M[M.length - 1];
    return last.km * Math.exp((alt - last.alt) / 2500);
  }
  function fmtKm(km) {
    const LY = 9.461e12;
    if (km < 10) return km.toFixed(1) + ' km';
    if (km < 1e6) return Math.round(km).toLocaleString() + ' km';
    if (km < 1e9) return (km / 1e6).toFixed(1) + ' million km';
    if (km < 1e12) return (km / 1e9).toFixed(1) + ' billion km';
    const ly = km / LY;
    if (ly < 1) return (km / 1e12).toFixed(1) + ' trillion km';
    if (ly < 1e6) return Math.round(ly).toLocaleString() + ' light-years';
    if (ly < 1e9) return (ly / 1e6).toFixed(1) + ' million light-years';
    return (ly / 1e9).toFixed(1) + ' billion light-years';
  }
  // Score -> scene altitude, linear between milestones.
  function altFor(score) {
    const M = MILESTONES;
    for (let i = 0; i < M.length - 1; i++) {
      const a = M[i], b = M[i + 1];
      if (score < b.pts) return a.alt + (score - a.pts) * (b.alt - a.alt) / (b.pts - a.pts);
    }
    const a = M[M.length - 2], b = M[M.length - 1];
    return b.alt + (score - b.pts) * (b.alt - a.alt) / (b.pts - a.pts);
  }
  const placeAt = score => { let m = MILESTONES[0]; for (const x of MILESTONES) if (score >= x.pts) m = x; return m; };
  const nextPlace = score => MILESTONES.find(m => m.pts > score);
  const nextByAlt = alt => MILESTONES.find(m => m.alt > alt);

  // ---- Game state -------------------------------------------------------
  const G = {
    state: 'title', mode: null, score: 0, shown: 0, lives: 0, streak: 0, bestStreak: 0, qNum: 0,
    skips: 0, used: new Set(), seen: Quiz.newRun(), q: null, timeLeft: 0, lastTick: 0,
    correct: 0, bestAnswer: null, launched: false, timers: []
  };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); G.timers.push(id); return id; };
  const clearLater = () => { G.timers.forEach(clearTimeout); G.timers = []; };

  const streakMult = n => Math.min(3, 1 + 0.25 * Math.max(0, n - 1));
  const speedMult = frac => (frac >= 0.75 ? 2 : frac >= 0.5 ? 1.5 : 1);

  // ---- Title screen -----------------------------------------------------
  function showTitle() {
    clearLater();
    G.state = 'title';
    Scene.reset();
    [el.hud, el.track, el.card, el.pause, el.over, el.countdown].forEach(e => e.classList.add('hidden'));
    el.card.classList.remove('blur');
    el.title.classList.remove('hidden');
    document.querySelectorAll('[data-best]').forEach(b => {
      const r = bests[b.dataset.best];
      b.textContent = r ? `Best: ${r.score.toLocaleString()} · ${r.icon} ${r.place}` : 'Not flown yet';
    });
  }

  // ---- Start a run ------------------------------------------------------
  function start(modeId) {
    Sound.unlock();
    clearLater();
    const mode = MODES[modeId];
    Object.assign(G, {
      state: 'countdown', mode, score: 0, shown: 0, lives: mode.lives, streak: 0, bestStreak: 0, qNum: 0,
      skips: mode.skips, used: new Set(), seen: Quiz.newRun(), q: null, correct: 0, bestAnswer: null, launched: false
    });
    Scene.reset();
    Scene.setStreak(0);
    el.title.classList.add('hidden');
    el.over.classList.add('hidden');
    el.pause.classList.add('hidden');
    el.hud.classList.remove('hidden');
    el.track.classList.remove('hidden');
    el.card.classList.add('hidden');
    buildTrack();
    renderFuel();
    renderStreak();
    updateHud(0);

    const steps = ['3', '2', '1', 'GO!'];
    steps.forEach((txt, i) => later(() => {
      el.countdown.classList.remove('hidden', 'tick');
      void el.countdown.offsetWidth;
      el.countdown.textContent = txt;
      el.countdown.classList.add('tick');
      if (txt === 'GO!') { Sound.go(); Scene.setIgnite(0.5); }
      else { Sound.count(); Scene.setIgnite(0.25 + i * 0.25); }
      if (i === 0) Sound.rumble(3);
    }, i * 800));
    later(() => { el.countdown.classList.add('hidden'); nextQuestion(); }, steps.length * 800);
  }

  // ---- Questions --------------------------------------------------------
  function nextQuestion() {
    if (G.lives <= 0) return gameOver();
    G.qNum++;
    G.q = Quiz.generate(G.mode.id, G.seen);
    G.timeLeft = G.mode.time;
    G.lastTick = Math.ceil(G.timeLeft);
    G.state = 'question';
    el.card.classList.remove('hidden', 'swap', 'blur', 'shake');
    void el.card.offsetWidth;
    el.card.classList.add('swap');
    el.qCat.textContent = `${G.q.cat.icon} ${G.q.cat.name}`;
    el.qNum.textContent = `Question ${G.qNum}`;
    el.qText.innerHTML = G.q.text;
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
    el.reveal.classList.add('hidden');
    el.input.value = '';
    el.input.disabled = false;
    el.go.disabled = false;
    el.skip.disabled = G.skips <= 0;
    el.skipCount.textContent = G.skips;
    updateTimer();
    el.input.focus();
  }

  function submit() {
    if (G.state !== 'question') return;
    const res = Quiz.check(G.q, el.input.value);
    if (!res.ok) {
      el.feedback.textContent = res.reason;
      el.feedback.className = 'feedback';
      el.card.classList.remove('shake'); void el.card.offsetWidth; el.card.classList.add('shake');
      if (el.input.value.trim()) Sound.wrong();
      el.input.select();
      return;
    }
    correct(res);
  }

  function correct(res) {
    const frac = G.timeLeft / G.mode.time;
    const tier = res.ent.tier;
    G.streak++;
    G.bestStreak = Math.max(G.bestStreak, G.streak);
    G.correct++;
    const sp = speedMult(frac);
    const stm = streakMult(G.streak);
    const deep = tier >= 3 && tier === G.q.maxTier ? 1.5 : 1;
    const repeat = G.used.has(G.q.cat.id + ':' + res.ent.id) ? 0.5 : 1;
    G.used.add(G.q.cat.id + ':' + res.ent.id);
    const pts = Math.max(1, Math.round(Quiz.TIER_POINTS[tier] * G.mode.mult * sp * stm * deep * repeat));
    G.score += pts;

    if (!G.bestAnswer || pts > G.bestAnswer.pts) G.bestAnswer = { text: res.v.raw, tier, pts };

    // Rocket!
    Scene.setStreak(G.streak);
    Scene.boostTo(altFor(G.score), tier);
    const rs = Scene.rocketScreen();
    Scene.burst(rs.x, rs.y + 60, ['', '#ffffff', '#6fe08a', '#4fb3ff', '#c77dff', '#ffc531'][tier], 20 + tier * 12);
    if (tier >= 4) Scene.confetti(tier === 5 ? 140 : 60);
    Sound.boost(tier);

    const tags = [];
    if (!G.launched) { tags.push(['🚀 LIFTOFF!', '#fff']); G.launched = true; }
    if (sp > 1) tags.push([sp === 2 ? '⚡ ×2 Lightning' : '⚡ ×1.5 Quick', sp === 2 ? '#ffd23f' : '#4fd1ff']);
    if (stm > 1) tags.push([`🔥 ×${stm.toFixed(2).replace(/0$/, '')} Streak`, '#ff9a3c']);
    if (deep > 1) tags.push(['🤓 ×1.5 Deepest cut', '#c77dff']);
    if (G.mode.mult > 1) tags.push([`×${G.mode.mult} ${G.mode.label}`, '#ffffff']);
    if (repeat < 1) tags.push(['♻️ ×0.5 Repeat', '#b9c3e6']);
    popup(`+${pts.toLocaleString()}`, Quiz.TIER_NAMES[tier], tier, tags);

    el.feedback.className = 'feedback ok';
    el.feedback.innerHTML = `✅ <b class="tier-${tier}">${escapeHtml(res.v.raw)}</b> — ${Quiz.TIER_NAMES[tier]}!` + (res.fuzzy ? ' <span style="opacity:.7">(close enough!)</span>' : '');
    const ex = Quiz.examples(G.q, 3).filter(a => Quiz.keyOf(a.text) !== res.v.key);
    showReveal(tier >= G.q.maxTier ? 'You found one of the rarest answers! Others:' : 'Rarer answers you could have used:', ex);

    renderStreak();
    el.score.parentElement.classList.remove('bump'); void el.score.offsetWidth; el.score.parentElement.classList.add('bump');
    lockCard();
    G.state = 'reveal';
    later(nextQuestion, tier >= 4 ? 2300 : 1900);
  }

  function timeout() {
    G.state = 'reveal';
    G.lives--;
    G.streak = 0;
    Scene.setStreak(0);
    Scene.sputter();
    Sound.timeout();
    renderFuel(true);
    renderStreak();
    el.feedback.className = 'feedback';
    el.feedback.textContent = G.lives > 0 ? "⏰ Time's up! You lost a fuel cell." : "⏰ Time's up! That was your last fuel cell…";
    showReveal('You could have said:', Quiz.examples(G.q, 4));
    popup('-1 ⛽', "TIME'S UP", 0, [], true);
    lockCard();
    later(() => (G.lives > 0 ? nextQuestion() : gameOver()), 3000);
  }

  function skip() {
    if (G.state !== 'question' || G.skips <= 0) return;
    G.skips--;
    G.state = 'reveal';
    G.streak = 0;
    Scene.setStreak(0);
    Sound.skip();
    renderStreak();
    el.feedback.className = 'feedback';
    el.feedback.textContent = '⏭ Skipped — your streak resets.';
    showReveal('Answers that would have worked:', Quiz.examples(G.q, 4));
    lockCard();
    later(nextQuestion, 2400);
  }

  function lockCard() {
    el.input.disabled = true;
    el.go.disabled = true;
    el.skip.disabled = true;
  }

  function showReveal(title, list) {
    if (!list.length) { el.reveal.classList.add('hidden'); return; }
    el.reveal.innerHTML = `${title}<br>` + list.map(a =>
      `<span class="ans tier-${a.tier}">${escapeHtml(a.text)} · ${Quiz.TIER_NAMES[a.tier]}</span>`).join('');
    el.reveal.classList.remove('hidden');
  }

  // ---- Game over --------------------------------------------------------
  function gameOver() {
    clearLater();
    G.state = 'dying';
    lockCard();
    Scene.die();
    Sound.gameOver();
    later(() => {
      G.state = 'over';
      el.card.classList.add('hidden');
      const place = placeAt(G.score);
      const prev = bests[G.mode.id];
      const isBest = !prev || G.score > prev.score;
      if (isBest && G.score > 0) {
        bests[G.mode.id] = { score: G.score, place: place.name, icon: place.icon };
        saveBests();
        Sound.best();
        Scene.confetti(200);
      }
      $('newBest').classList.toggle('hidden', !(isBest && G.score > 0));
      $('overReached').innerHTML = `You reached <b>${place.icon} ${place.name}</b> — ${fmtKm(kmAt(altFor(G.score)))} from Earth.`;
      const ba = G.bestAnswer;
      $('overStats').innerHTML = `
        <div class="stat"><div class="s-label">Score</div><div class="s-value" style="color:var(--accent)">${G.score.toLocaleString()}</div></div>
        <div class="stat"><div class="s-label">Correct answers</div><div class="s-value">${G.correct}</div></div>
        <div class="stat"><div class="s-label">Best streak</div><div class="s-value">${G.bestStreak} 🔥</div></div>
        <div class="stat wide"><div class="s-label">Best answer</div><div class="s-value">${ba ? `<span class="tier-${ba.tier}">${escapeHtml(ba.text)}</span> · ${Quiz.TIER_NAMES[ba.tier]} · +${ba.pts.toLocaleString()}` : '—'}</div></div>
        <div class="stat wide"><div class="s-label">Mode</div><div class="s-value">${G.mode.label}${prev ? ` · previous best ${prev.score.toLocaleString()}` : ''}</div></div>`;
      el.over.classList.remove('hidden');
      $('btnAgain').focus();
    }, 2600);
  }

  // ---- Pause ------------------------------------------------------------
  function pause() {
    if (G.state !== 'question') return;
    G.state = 'paused';
    el.card.classList.add('blur');
    el.pause.classList.remove('hidden');
    $('btnResume').focus();
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = 'question';
    el.card.classList.remove('blur');
    el.pause.classList.add('hidden');
    el.input.focus();
  }

  // ---- HUD rendering ----------------------------------------------------
  function renderFuel(lost) {
    el.fuel.innerHTML = '';
    for (let i = 0; i < G.mode.lives; i++) {
      const c = document.createElement('span');
      c.className = 'cell' + (i >= G.lives ? ' empty' : '') + (lost && i === G.lives ? ' lost' : '');
      el.fuel.appendChild(c);
    }
  }

  function renderStreak() {
    el.streak.textContent = G.streak;
    el.mult.textContent = `next ×${streakMult(G.streak + 1).toFixed(2)}`;
    el.streakPill.classList.toggle('hot', G.streak >= 2);
    el.streakPill.classList.toggle('blazing', G.streak >= 5 && G.streak < 8);
    el.streakPill.classList.toggle('cosmic', G.streak >= 8);
  }

  function buildTrack() {
    el.trackStops.innerHTML = '';
    const n = MILESTONES.length;
    MILESTONES.forEach((m, i) => {
      const d = document.createElement('div');
      d.className = 'stop';
      d.style.top = trackY(i / (n - 1)) + 'px';
      d.innerHTML = `${m.icon}<span class="stop-name">${m.name}</span>`;
      el.trackStops.appendChild(d);
    });
  }
  const trackY = f => 24 + (1 - f) * (856 - 48);

  function trackFrac(alt) {
    const M = MILESTONES, n = M.length;
    for (let i = 0; i < n - 1; i++) {
      if (alt < M[i + 1].alt) return (i + (alt - M[i].alt) / (M[i + 1].alt - M[i].alt)) / (n - 1);
    }
    return 1;
  }

  let lastHudAlt = -1;
  function updateHud(dt) {
    G.shown += (G.score - G.shown) * Math.min(1, dt * 5);
    if (Math.abs(G.score - G.shown) < 0.5) G.shown = G.score;
    el.score.textContent = Math.round(G.shown).toLocaleString();
    const alt = Scene.alt;
    if (Math.abs(alt - lastHudAlt) > 0.01 || dt === 0) {
      lastHudAlt = alt;
      el.alt.textContent = fmtKm(kmAt(alt));
      const f = trackFrac(alt);
      el.trackFill.style.height = (f * 100) + '%';
      el.trackRocket.style.top = trackY(f) + 'px';
      const stops = el.trackStops.children;
      const nxt = nextByAlt(alt);
      for (let i = 0; i < stops.length; i++) {
        stops[i].classList.toggle('reached', MILESTONES[i].alt <= alt);
        stops[i].classList.toggle('next', MILESTONES[i] === nxt);
      }
    }
    const np = nextPlace(G.score);
    el.next.textContent = np ? `Next stop: ${np.icon} ${np.name} · ${(np.pts - G.score).toLocaleString()} pts` : '∞ Beyond everything!';
  }

  function updateTimer() {
    const frac = Math.max(0, G.timeLeft / G.mode.time);
    el.timerFill.style.width = (frac * 100) + '%';
    el.timerSecs.textContent = Math.ceil(G.timeLeft) + 's';
    const sp = speedMult(frac);
    el.speed.textContent = sp === 2 ? '⚡ ×2 speed bonus' : sp === 1.5 ? '⚡ ×1.5 speed bonus' : 'No speed bonus';
    el.speed.className = 'speed-badge' + (sp === 2 ? '' : sp === 1.5 ? ' x15' : ' x1');
    el.timer.classList.toggle('low', G.timeLeft <= 5);
  }

  // ---- Popups and banners --------------------------------------------
  function popup(big, label, tier, tags, miss) {
    const d = document.createElement('div');
    d.className = 'popup' + (tier === 5 ? ' legendary' : '') + (miss ? ' miss' : '');
    d.style.left = '760px';
    d.style.top = '380px';
    const col = ['#ff5d73', 'var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)', 'var(--t5)'][tier];
    d.innerHTML = `<div class="pts" style="color:${col}">${big}</div>` +
      `<div class="rarity" style="color:${col}">${label.toUpperCase()}</div>` +
      (tags.length ? `<div class="tags">${tags.map(([t, c]) => `<span class="tag" style="color:${c}">${t}</span>`).join('')}</div>` : '');
    el.popups.appendChild(d);
    setTimeout(() => d.remove(), 2400);
  }

  function milestone(m) {
    if (G.state === 'title' || G.state === 'over') return;
    Sound.milestone();
    Scene.confetti(m.body ? 160 : 70);
    el.banner.classList.remove('hidden');
    el.banner.innerHTML = `<span class="b-icon">${m.icon}</span><div class="b-small">YOU REACHED</div><div class="b-name">${m.name}</div><div class="b-dist">${fmtKm(m.km)} from Earth</div>`;
    el.banner.style.animation = 'none'; void el.banner.offsetWidth; el.banner.style.animation = '';
    clearTimeout(milestone.t);
    milestone.t = setTimeout(() => el.banner.classList.add('hidden'), 3300);
  }

  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- Main loop --------------------------------------------------------
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (G.state !== 'paused') Scene.update(dt);
    Scene.draw();
    if (G.state !== 'title') updateHud(dt);
    if (G.state === 'question') {
      G.timeLeft -= dt;
      const s = Math.ceil(G.timeLeft);
      if (s < G.lastTick) { G.lastTick = s; if (s <= 5 && s > 0) Sound.tick(s <= 3); }
      updateTimer();
      if (G.timeLeft <= 0) { G.timeLeft = 0; updateTimer(); timeout(); }
    }
    requestAnimationFrame(frame);
  }

  // ---- Wiring -----------------------------------------------------------
  Scene.init($('scene'));
  Scene.onMilestone(milestone);
  fit();
  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);

  document.querySelectorAll('.mode-card').forEach(b => b.addEventListener('click', () => { Sound.click(); start(b.dataset.mode); }));
  el.form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  el.skip.addEventListener('click', skip);
  $('btnPause').addEventListener('click', pause);
  $('btnResume').addEventListener('click', resume);
  $('btnQuit').addEventListener('click', showTitle);
  $('btnAgain').addEventListener('click', () => start(G.mode.id));
  $('btnMenu').addEventListener('click', showTitle);

  const soundBtn = $('btnSound');
  const syncSound = () => { soundBtn.textContent = Sound.muted ? '🔇' : '🔊'; };
  syncSound();
  soundBtn.addEventListener('click', () => { Sound.toggle(); syncSound(); Sound.click(); });
  $('btnFull').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (G.state === 'question') pause();
      else if (G.state === 'paused') resume();
      return;
    }
    if (G.state === 'question' && document.activeElement !== el.input && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      el.input.focus();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  showTitle();
  requestAnimationFrame(frame);
})();
