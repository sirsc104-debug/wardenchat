/* Brain Rocket – Evolved: screens, the Daily Launch, Endless, the archive and the answer browser.
 *
 * Daily Launch (one difficulty): 10 prompts a day, the same for everyone, a fresh set at midnight in
 * the player's own time zone. 25 seconds each and ONE answer: an answer that isn't on the list doesn't
 * use up the shot (try another), a close spelling asks to be confirmed first, and the first real
 * answer locks in. Points by tier (Launch Pad 500 … Supernova 5,000) lift the rocket; 50,000 is the
 * Edge of the Universe. One go a day: leaving part-way still counts, with the rest as misses.
 *
 * Endless (Owen, Medium, Hard, Ultra): the new prompts with Brain Rocket's classic rules. Each
 * difficulty has its own timer, fuel cells, skips and topic mix; points are the tier's (Launch Pad 10 …
 * Supernova 200) × the difficulty × speed (first quarter ×2, first half ×1.5) × streak (+0.25 per
 * answer in a row, up to ×5), and a Supernova is a deepest cut (×1.5). Wrong guesses are free; a
 * timeout burns a fuel cell; skips are limited. Hints on Owen; on Ultra you fall while you think.
 */
'use strict';

(function () {
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const T = Quiz.TIERS;
  const DAILY_TIME = 25;
  const CLASSIC_PTS = [10, 15, 30, 60, 100, 200];
  const MODES = {
    easy:   { name: 'Owen', icon: '🧒', time: 30, fuel: 5, skips: 5, mult: 1,   hints: true },
    medium: { name: 'Medium', icon: '🚀', time: 20, fuel: 3, skips: 3, mult: 1.5 },
    hard:   { name: 'Hard', icon: '☄️', time: 12, fuel: 3, skips: 2, mult: 2 },
    ultra:  { name: 'Ultra Hard', icon: '💀', time: 12, fuel: 3, skips: 2, mult: 2.5, drift: true }
  };
  const HINT_COST = 0.8;
  const streakMult = n => Math.min(5, 1 + 0.25 * Math.max(0, n - 1));
  // Where "open in a new tab" goes when the game is embedded somewhere that blocks fullscreen.
  // Set this to the game's own address once it has one.
  const SITE_URL = '';

  Quiz.ready();

  // ---- Storage (any of it can be blocked: private windows, previews) -------------------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('brEvolved.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('brEvolved.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  // ---- Days ---------------------------------------------------------------------------
  // Launch #1 is November 13, 2026. A day is a calendar day in the player's own time zone.
  const EPOCH = Date.UTC(2026, 10, 13);
  const dayNumber = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5) + 1;
  const dateOf = n => { const d = new Date(EPOCH + (n - 1) * 864e5); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  const dateText = n => dateOf(n).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  function msToNextDay() { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return m - n; }
  const hms = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`; };

  // Saved days: { "<n>": { done, crashed, score, picks: [{ cat, tier (-1 = miss), name, typed }] } }
  const days = () => store.get('days', {});
  const saveDay = (n, rec) => { const all = days(); all[n] = rec; store.set('days', all); };
  const archive = () => store.get('archive', {});
  const saveArchive = (n, rec) => { const all = archive(); all[n] = rec; store.set('archive', all); };
  const bests = () => store.get('bests', {});
  function streak() {
    const s = store.get('streak', { last: 0, count: 0 });
    return s.last >= dayNumber() - 1 ? s : { last: s.last, count: 0 };
  }
  function bumpStreak(n) {
    const s = store.get('streak', { last: 0, count: 0 });
    if (s.last === n) return;
    store.set('streak', { last: n, count: s.last === n - 1 ? s.count + 1 : 1 });
  }
  // A daily left part-way (tab closed, page reloaded) counts, with the rest as misses.
  function settle() {
    const all = days();
    let changed = false;
    for (const [n, r] of Object.entries(all)) {
      if (r.done) continue;
      if (+n === G.day && G.mode === 'daily' && G.state !== 'title' && G.state !== 'over') continue;
      while (r.picks.length < Quiz.DAILY) r.picks.push({ tier: -1 });
      r.done = true; changed = true;
      bumpStreak(+n);
    }
    if (changed) store.set('days', all);
  }

  // ---- Stage scaling (always 16:9, no black bars; from Brain Rocket) ---------------------
  const view = { c: 1, x: 0, y: 0, pan: 0, s: 1, left: 0, top: 0 };
  const world = $('world'), viewportEl = $('viewport');
  function fit() {
    const cs = getComputedStyle(viewportEl);
    const padL = parseFloat(cs.paddingLeft) || 0, padT = parseFloat(cs.paddingTop) || 0;
    const vw = viewportEl.clientWidth - padL - (parseFloat(cs.paddingRight) || 0);
    const vh = viewportEl.clientHeight - padT - (parseFloat(cs.paddingBottom) || 0);
    if (vw <= 0 || vh <= 0) return;
    const s = Math.min(vw / 1600, vh / 900);
    const SW = vw / s, SH = vh / s;
    stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
    view.s = s; view.left = padL; view.top = padT;
    placeStage();
    const c = Math.max(SW / 1600, SH / 900);
    view.c = c; view.x = (SW - 1600 * c) / 2; view.y = (SH - 900 * c) / 2;
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${c})`;
    Scene.resize(s * c);
    if (G.state !== 'title') buildTrack();
    placeGlider();
  }
  const placeStage = () => { stage.style.transform = `translate(${view.left}px, ${view.top + view.pan}px) scale(${view.s})`; };
  const toStage = (x, y) => [view.x + x * view.c, view.y + y * view.c];
  stage.addEventListener('scroll', () => { if (stage.scrollLeft || stage.scrollTop) { stage.scrollLeft = 0; stage.scrollTop = 0; } });
  // Phones: when the on-screen keyboard opens, slide the game up so the answer box stays visible.
  function keyboardPan() {
    const vv = window.visualViewport;
    let pan = 0;
    const a = document.activeElement, typing = a && a.tagName === 'INPUT' && stage.contains(a);
    if (vv && typing && vv.height < window.innerHeight - 80) {
      const r = a.getBoundingClientRect();
      pan = Math.min(0, view.pan + (vv.offsetTop + vv.height - 12) - r.bottom);
    }
    if (pan !== view.pan) { view.pan = pan; placeStage(); }
  }

  // ---- State ----------------------------------------------------------------------------
  const G = {
    state: 'title', mode: null, diff: null, day: 0, cats: [], i: 0, score: 0, peak: 0, picks: [],
    fuel: 0, skips: 0, streak: 0, bestStreak: 0, hints: 0, hintEnt: null,
    cat: null, ends: 0, time: DAILY_TIME, pending: null, next: null, timers: []
  };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); G.timers.push(id); return id; };
  const clearLater = () => { G.timers.forEach(clearTimeout); G.timers = []; };
  const classic = () => G.mode === 'endless';
  const M = () => MODES[G.diff] || MODES.medium;

  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  function screen(name) {
    show('title', name === 'title'); show('over', name === 'over');
    const playing = name === 'game';
    show('hud', playing); show('card', playing); show('track', playing);
  }

  // ---- Altitude, stops and the track ------------------------------------------------------
  const placeAt = score => { let p = STOPS[0]; for (const m of STOPS) if (score >= m.pts) p = m; return p; };
  const nextPlace = score => STOPS.find(m => m.pts > score) || null;
  // The track spaces the stops evenly (the real gaps grow the further out you go); the rocket moves
  // between two stops in proportion to the points between them.
  function trackFrac(score) {
    const n = STOPS.length - 1;
    for (let i = 0; i < n; i++) {
      const a = STOPS[i], b = STOPS[i + 1];
      if (score < b.pts) return (i + Math.max(0, score - a.pts) / (b.pts - a.pts)) / n;
    }
    return 1;
  }
  function buildTrack() {
    const box = $('trackStops'); box.innerHTML = '';
    for (const m of STOPS) {
      if (m.pts === 0) continue;
      const d = document.createElement('div');
      d.className = 'track-stop'; d.textContent = m.icon; d.title = m.name;
      d.style.top = (100 - trackFrac(m.pts) * 100) + '%';
      box.appendChild(d);
    }
    updateTrack();
  }
  function updateTrack() {
    const f = trackFrac(G.score);
    $('trackFill').style.height = f * 100 + '%';
    $('trackRocket').style.top = (100 - f * 100) + '%';
    const stops = $('trackStops').children;
    let k = 0;
    for (const m of STOPS) { if (m.pts === 0) continue; if (stops[k]) stops[k].classList.toggle('reached', G.score >= m.pts); k++; }
  }
  function updateHud() {
    $('hudScore').textContent = fmt(G.score);
    const p = placeAt(G.score), nx = nextPlace(G.score);
    $('hudPlace').textContent = `${p.icon} ${p.name}`;
    $('hudNext').textContent = nx ? `Next stop: ${nx.icon} ${nx.name} at ${fmt(nx.pts)}` : 'Beyond everything';
    if (classic()) {
      $('roundLabel').textContent = 'Question';
      $('hudRound').textContent = G.i + 1;
      $('hudFuel').innerHTML = Array.from({ length: M().fuel }, (_, i) => `<span class="${i < G.fuel ? '' : 'off'}">⛽</span>`).join('');
      $('hudStreak').textContent = G.streak;
      $('hudMult').textContent = `next ×${streakMult(G.streak + 1).toFixed(2)}`;
      $('skipCount').textContent = G.skips;
    } else {
      $('roundLabel').textContent = 'Prompt';
      $('hudRound').textContent = `${Math.min(G.i + 1, Quiz.DAILY)} / ${Quiz.DAILY}`;
    }
    show('fuelPill', classic()); show('streakPill', classic()); show('btnQuit', classic());
    updateTrack();
  }
  function popup(text, sub, tier) {
    const p = Scene.rocketScreen(), [x, y] = toStage(p.x + 150, p.y - 60);
    const d = document.createElement('div');
    d.className = `popup tier-${tier}`; d.style.left = x + 'px'; d.style.top = y + 'px';
    d.innerHTML = `${esc(text)}<small>${esc(sub)}</small>`;
    $('popups').appendChild(d);
    setTimeout(() => d.remove(), 1700);
  }
  function banner(text) {
    const b = $('banner');
    b.textContent = text; b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.add('hidden'), 2700);
  }
  Scene.onStop(m => { if (G.state !== 'title') { banner(`${m.icon} ${m.name}!`); Sound.milestone(); } });

  // ---- Starting -------------------------------------------------------------------------
  function startDaily(n, isArchive) {
    const rec = isArchive ? null : days()[n];
    if (rec && rec.done) return showResults({ mode: 'daily', day: n, ...rec });
    begin(isArchive ? 'archive' : 'daily', n, Quiz.daily(n));
    if (!isArchive) saveDay(n, { done: false, score: 0, picks: [] });
  }
  function startEndless(diff) {
    G.diff = diff;
    begin('endless', 0, null);
    G.next = Quiz.endless((Math.random() * 2 ** 31) >>> 0, diff);
  }
  function begin(mode, day, cats) {
    clearLater();
    const m = MODES[G.diff] || MODES.medium;
    Object.assign(G, {
      mode, day, cats: cats || [], i: 0, score: 0, peak: 0, picks: [], pending: null, state: 'countdown',
      fuel: m.fuel, skips: m.skips, streak: 0, bestStreak: 0
    });
    if (mode !== 'endless') G.diff = null;
    $('card').classList.toggle('daily', mode !== 'endless');
    Sound.unlock(); Sound.music('evolved');
    Scene.reset();
    screen('game');
    show('card', false);
    buildTrack(); updateHud();
    const cd = $('countdown');
    cd.classList.remove('hidden');
    const steps = ['3', '2', '1', 'GO!'];
    steps.forEach((s, k) => later(() => {
      cd.innerHTML = `<span>${s}</span>`;
      if (k < 3) { Sound.count(); Scene.setIgnite((k + 1) / 3); } else Sound.go();
    }, k * 800));
    later(() => {
      cd.classList.add('hidden'); Scene.setIgnite(1); Sound.rumble(1.2); prompt();
      later(() => { if (Scene.alt < 0.5) Scene.setIgnite(0.3); }, 1400);
    }, steps.length * 800);
  }

  // ---- A prompt --------------------------------------------------------------------------
  function prompt() {
    const cat = classic() ? G.next() : G.cats[G.i];
    G.cat = Quiz.built(cat);
    G.pending = null; G.hints = 0;
    G.state = 'question';
    G.time = classic() ? M().time : DAILY_TIME;
    G.ends = performance.now() + G.time * 1000;
    const card = $('card');
    card.classList.remove('locked', 'hidden');
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    show('reveal', false);
    $('qCat').textContent = `${cat.icon || '🔭'} ${cat.name || 'Category'}`;
    $('qNum').textContent = classic() ? `${M().icon} ${M().name} · Question ${G.i + 1}` : `Prompt ${G.i + 1} of ${Quiz.DAILY}`;
    $('qText').innerHTML = G.cat.html;
    $('feedback').textContent = classic() ? 'Wrong guesses are free. Be quick and be rare!' : `${fmt(G.cat.entities.length)} answers count. Name one!`;
    show('skipBtn', classic()); $('skipBtn').disabled = G.skips <= 0;
    show('hintBtn', classic() && !!M().hints); $('hintBtn').disabled = false;
    // a hint spells out a Launch Pad answer, a letter at a time
    const pads = G.cat.entities.filter(e => e.tier === 0 && /^[a-z]/i.test(e.name));
    G.hintEnt = pads.length ? pads[Math.floor(Math.random() * pads.length)] : null;
    show('hintLine', false);
    show('speedBadge', classic());
    $('legend').innerHTML = T.map((t, i) => `<span class="tier-${i}">${t.emoji} ${fmt(classic() ? CLASSIC_PTS[i] : t.pts)}</span>`).join('');
    const a = $('answer'); a.value = ''; a.disabled = false;
    if (!matchMedia('(hover: none)').matches) a.focus({ preventScroll: true });
    updateHud();
  }

  function submit(e) {
    if (e) e.preventDefault();
    if (G.state !== 'question') return;
    const a = $('answer'), text = a.value.trim();
    const fb = $('feedback');
    if (!Quiz.keyOf(text)) { fb.textContent = 'Type an answer first!'; return; }
    const hit = Quiz.find(G.cat, text);
    if (!hit) {
      if (BadWords.test(text)) return crash();
      G.pending = null;
      Sound.wrong();
      a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
      fb.innerHTML = classic() ? `<span class="bad">“${esc(text)}” isn't on the list.</span> Try another!`
        : `“${esc(text)}” isn't on the list for this one. Your shot isn't used up, so try another!`;
      a.select();
      return;
    }
    lock(hit, text);
  }

  function speedMult() {
    const left = (G.ends - performance.now()) / (G.time * 1000);
    return left >= 0.75 ? 2 : left >= 0.5 ? 1.5 : 1;
  }

  function lock(hit, typed) {
    const tier = hit.ent.tier, t = T[tier];
    G.state = 'reveal';
    let pts = t.pts, tags = [];
    if (classic()) {
      const sp = speedMult(), stm = streakMult(G.streak + 1), deep = tier === 5 ? 1.5 : 1, hm = Math.pow(HINT_COST, G.hints);
      pts = Math.max(1, Math.round(CLASSIC_PTS[tier] * M().mult * sp * stm * deep * hm));
      G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak);
      if (sp > 1) tags.push(`⚡×${sp}`);
      if (stm > 1) tags.push(`🔥×${stm.toFixed(2)}`);
      if (deep > 1) tags.push('💎 deepest cut');
    }
    G.score += pts; G.peak = Math.max(G.peak, G.score);
    G.picks.push({ cat: G.cat.id, tier, name: hit.ent.name, typed, pts });
    saveProgress();
    Scene.boostTo(Scene.altFor(G.score), Math.min(5, tier + 1));
    Scene.setStreak(classic() ? G.streak : tier >= 4 ? 8 : tier >= 3 ? 5 : tier >= 2 ? 3 : 0);
    Sound.boost(Math.min(5, tier + 1));
    if (tier === 5) { Scene.confetti(); Sound.best(); }
    popup(`+${fmt(pts)}`, `${t.emoji} ${t.name}`, tier);
    updateHud();
    if (classic()) {
      $('feedback').innerHTML = `<span class="good">✅ <b class="tier-${tier}">${esc(hit.ent.name)}</b>: ${t.emoji} ${t.name}! +${fmt(pts)}</span>${tags.length ? ' · ' + tags.join(' ') : ''}${hit.fuzzy ? `<br><span class="fixed">✏️ "${esc(typed)}" read as ${esc(hit.ent.name)}</span>` : ''}`;
      $('answer').disabled = true;
      later(nextClassic, tier === 5 ? 1900 : 1300);
    } else reveal(hit.ent, tier, hit.fuzzy ? typed : null);
  }

  function timeout(skipped) {
    if (G.state !== 'question') return;
    G.state = 'reveal';
    G.picks.push({ cat: G.cat.id, tier: -1 });
    saveProgress();
    if (classic()) {
      G.streak = 0;
      const ex = Quiz.examples(G.cat, 0, 1)[0];
      if (skipped) { G.skips--; Sound.skip(); }
      else { G.fuel--; Sound.timeout(); Scene.sputter(); }
      $('answer').disabled = true;
      $('feedback').innerHTML = `<span class="bad">${skipped ? '⏭ Skipped.' : '⏰ Out of time! That burned a fuel cell.'}</span>${ex ? ` <b>${esc(ex)}</b> would have worked.` : ''}`;
      updateHud();
      later(nextClassic, skipped ? 1300 : 2100);
      return;
    }
    Sound.timeout(); Scene.sputter();
    reveal(null, -1);
    updateHud();
  }

  function nextClassic() {
    if (G.fuel <= 0) return finish();
    G.i++;
    prompt();
  }

  function hint() {
    if (G.state !== 'question' || !G.hintEnt) return;
    const name = G.hintEnt.name, letters = name.replace(/[^a-z]/gi, '').length;
    if (G.hints >= Math.max(1, Math.floor(letters / 2))) return;
    G.hints++; G.streak = 0;
    Sound.click();
    let shown = 0;
    const text = [...name].map(ch => /[a-z]/i.test(ch) ? (shown++ < G.hints ? ch.toUpperCase() : '_') : ch).join(' ');
    $('hintLine').textContent = text; show('hintLine', true);
    $('feedback').textContent = `Each hint letter costs 20% of the points and ends your streak.`;
    $('hintBtn').disabled = G.hints >= Math.max(1, Math.floor(letters / 2));
    updateHud();
  }

  // The Daily's reveal: what you got, the Supernova, what most people say, and every answer.
  function reveal(ent, tier, typed) {
    const c = G.cat;
    $('card').classList.add('locked');
    $('answer').disabled = true; $('answer').blur();
    const badge = $('rvBadge');
    if (ent) {
      const t = T[tier];
      badge.innerHTML = `<span class="rv-emoji">${t.emoji}</span><span class="tier-${tier}">${t.name}</span><span class="rv-pts tier-${tier}">+${fmt(t.pts)}</span>`;
      $('rvLine').innerHTML = `<b>${esc(ent.name)}</b>: ${esc(t.blurb)}` + (typed ? `<br><span class="fixed">✏️ "${esc(typed)}" read as ${esc(ent.name)}</span>` : '');
    } else {
      badge.innerHTML = `<span class="rv-emoji">${Quiz.MISS.emoji}</span><span class="tier-x">${Quiz.MISS.name}</span><span class="rv-pts tier-x">+0</span>`;
      $('rvLine').textContent = 'Out of time on this one.';
    }
    const lines = [];
    if (c.gem && ent !== c.gem) lines.push(`🌟 The Supernova was <b>${esc(c.gem.name)}</b>.`);
    if (ent && ent === c.gem) lines.push('🌟 You found this prompt\'s one Supernova!');
    const pad = Quiz.examples(c, 0, 3);
    if (pad.length) lines.push(`🏁 Most people say ${pad.map(n => `<b>${esc(n)}</b>`).join(', ')}.`);
    lines.push(`${fmt(c.entities.length)} answers counted.`);
    $('rvExtra').innerHTML = lines.join('<br>');
    $('rvNext').textContent = G.i + 1 >= Quiz.DAILY ? 'Results ▸' : 'Next ▸';
    show('reveal', true);
    G.revealAt = performance.now();
    $('rvNext').focus({ preventScroll: true });
  }

  function next() {
    if (G.state !== 'reveal' || classic() || performance.now() - G.revealAt < 500) return;
    G.i++;
    if (G.i >= Quiz.DAILY) return finish();
    prompt();
  }

  function saveProgress() {
    if (G.mode === 'daily') saveDay(G.day, { done: false, score: G.score, picks: G.picks });
  }

  function crash() {
    G.state = 'crashing';
    clearLater();
    $('answer').disabled = true;
    show('card', false);
    later(() => Sound.boom(), 1300);
    Scene.crash();
    const wait = () => (Scene.crashDone ? finish(true) : later(wait, 200));
    later(wait, 600);
  }

  // ---- Results -----------------------------------------------------------------------------
  function finish(crashed) {
    clearLater();
    const score = crashed ? 0 : classic() ? G.peak : G.score;
    const rec = { done: true, crashed: !!crashed, score, picks: G.picks };
    if (G.mode === 'daily') {
      while (rec.picks.length < Quiz.DAILY) rec.picks.push({ tier: -1 });
      saveDay(G.day, rec); bumpStreak(G.day);
    } else if (G.mode === 'archive') {
      while (rec.picks.length < Quiz.DAILY) rec.picks.push({ tier: -1 });
      const old = archive()[G.day];
      if (!old || rec.score > old.score) saveArchive(G.day, rec);
    } else {
      const all = bests(), old = all[G.diff];
      rec.best = !crashed && (!old || score > old.score);
      rec.diff = G.diff; rec.bestStreak = G.bestStreak;
      if (rec.best) { all[G.diff] = { score, answers: G.picks.filter(p => p.tier >= 0).length }; store.set('bests', all); }
    }
    showResults({ mode: G.mode, day: G.day, ...rec });
  }

  const VERDICTS = [
    [40000, 'Supernova run. Out past the galaxy. Absurd.'],
    [30000, 'Deep Space. Seriously far out.'],
    [20000, 'Moonshot. Well past the inner planets.'],
    [10000, 'Orbiter. A steady climb.'],
    [0, 'Still close to home. Plenty of sky left up there.']
  ];
  const emojiOf = p => (p.tier >= 0 ? T[p.tier].emoji : Quiz.MISS.emoji);
  const gridOf = picks => picks.map(emojiOf).join('');

  function showResults(r) {
    G.state = 'over'; G.result = r;
    Sound.music('results');
    screen('over');
    const daily = r.mode !== 'endless';
    const m = MODES[r.diff];
    $('overTitle').textContent = daily ? `${r.mode === 'archive' ? 'Archive' : 'Daily Launch'} #${r.day}` : `∞ Endless · ${m.icon} ${m.name}`;
    $('overDate').textContent = daily ? dateText(r.day) : `${r.picks.filter(p => p.tier >= 0).length} answers · best streak ${r.bestStreak || 0}`;
    $('overScore').textContent = fmt(r.score);
    $('overMax').textContent = daily ? ' / 50,000' : '';
    const p = placeAt(r.score);
    $('overPlace').textContent = r.crashed ? '💥 Crashed: rude words end the run' : `${p.icon} Reached ${p.name}`;
    $('overVerdict').textContent = r.crashed || !daily ? '' : VERDICTS.find(v => r.score >= v[0])[1];
    $('overGrid').textContent = daily ? gridOf(r.picks) : gridOf(r.picks.slice(-20));
    const rows = $('overRounds'); rows.innerHTML = '';
    const list = daily ? r.picks.map((pk, k) => [pk, k]) : r.picks.map((pk, k) => [pk, k]).slice(-10);
    for (const [pk, k] of list) {
      const c = Quiz.get(pk.cat || (daily ? Quiz.daily(r.day)[k].id : ''));
      if (!c) continue;
      const pts = pk.tier >= 0 ? (pk.pts != null ? pk.pts : T[pk.tier].pts) : 0;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'round-row';
      b.innerHTML = `<span class="rr-e">${emojiOf(pk)}</span><span class="rr-q">${c.q.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</span>` +
        `<span class="rr-a ${pk.tier >= 0 ? 'tier-' + pk.tier : 'tier-x'}">${pk.tier >= 0 ? esc(pk.name) : '—'}</span><span class="rr-p">${fmt(pts)}</span>`;
      b.title = 'See every answer';
      b.addEventListener('click', () => { Sound.click(); answerBrowser(c, pk.name); });
      rows.appendChild(b);
    }
    let note = '';
    if (r.mode === 'daily') note = `🔥 ${streak().count}-day streak · next launch in ${hms(msToNextDay())} · tap a prompt to see every answer`;
    else if (r.mode === 'archive') note = 'Archive launches don\'t count toward your streak. Tap a prompt to see every answer.';
    else note = (r.best ? `🏆 A new ${m.name} best! ` : `${m.name} best: ${fmt((bests()[r.diff] || { score: 0 }).score)}. `) + (r.picks.length > 10 ? 'Your last 10 questions:' : 'Tap a question to see every answer.');
    $('overNote').textContent = note;
    show('btnShare', daily);
    $('btnAgain').textContent = daily ? 'Play Endless' : 'Fly again';
    if (r.score > 0 && !r.crashed) Scene.confetti(80);
  }

  function shareText(r) {
    const p = placeAt(r.score);
    const site = SITE_URL ? `\n${SITE_URL}` : '';
    return `Brain Rocket – Evolved ${r.mode === 'archive' ? 'Archive ' : ''}#${r.day} 🚀\n${fmt(r.score)} / 50,000 · ${p.icon} ${p.name}\n${gridOf(r.picks)}${site}`;
  }
  async function share() {
    const text = shareText(G.result);
    try {
      if (navigator.share && matchMedia('(hover: none)').matches) { await navigator.share({ text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('Copied! Paste it anywhere.'); }
    catch (e) { sheet('Copy your result', `<p>Select and copy:</p><pre style="white-space:pre-wrap;font:inherit">${esc(text)}</pre>`); }
  }
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  // ---- Sheets: every answer, the archive, how to play ---------------------------------------
  let sheetBack = null;
  function sheet(title, html, focusSel) {
    $('sheetTitle').innerHTML = title;
    $('sheetBody').innerHTML = html;
    $('sheetBody').scrollTop = 0;
    sheetBack = document.activeElement;
    show('sheet', true);
    const f = focusSel && $('sheetBody').querySelector(focusSel);
    if (f && !matchMedia('(hover: none)').matches) f.focus({ preventScroll: true });
    else $('sheetClose').focus({ preventScroll: true });
  }
  function closeSheet() {
    show('sheet', false);
    if (sheetBack && sheetBack.focus) sheetBack.focus({ preventScroll: true });
  }
  function answerBrowser(c, mine) {
    const all = Quiz.answers(c), counts = Quiz.tierCounts(c);
    sheet(c.q.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'), `
      <div class="ab-tools">
        <input class="ab-search" type="search" placeholder="Search ${fmt(all.length)} answers…" aria-label="Search answers" spellcheck="false" autocomplete="off">
        <div class="ab-tiers">
          <button type="button" class="ab-tier on" data-t="all">All ${fmt(all.length)}</button>
          ${[5, 4, 3, 2, 1, 0].filter(t => counts[t]).map(t => `<button type="button" class="ab-tier tier-${t}" data-t="${t}">${T[t].emoji} ${T[t].name} ${fmt(counts[t])}</button>`).join('')}
        </div>
      </div>
      <div class="ab-list"></div><div class="ab-more"></div>`, '.ab-search');
    const body = $('sheetBody'), list = body.querySelector('.ab-list'), more = body.querySelector('.ab-more'), box = body.querySelector('.ab-search');
    let tier = 'all';
    const LIMIT = 600;
    function render() {
      const q = Quiz.norm(box.value);
      const rows = all.filter(a => (tier === 'all' || a.tier === +tier) && (!q || Quiz.norm(a.name).includes(q) || a.alt.some(x => Quiz.norm(x).includes(q))));
      list.innerHTML = rows.slice(0, LIMIT).map(a => {
        const alt = a.alt.filter(x => Quiz.keyOf(x) !== Quiz.keyOf(a.name)).slice(0, 3);
        return `<div class="ab-item${a.name === mine ? ' mine' : ''}"><span class="tier-${a.tier}">${T[a.tier].emoji}</span> ${esc(a.name)}${alt.length ? `<small>also ${alt.map(esc).join(', ')}</small>` : ''}</div>`;
      }).join('');
      more.textContent = rows.length > LIMIT ? `Showing ${LIMIT} of ${fmt(rows.length)}. Search to narrow it down.` : rows.length ? '' : 'Nothing matches that.';
    }
    box.addEventListener('input', render);
    body.querySelectorAll('.ab-tier').forEach(b => b.addEventListener('click', () => {
      tier = b.dataset.t;
      body.querySelectorAll('.ab-tier').forEach(x => x.classList.toggle('on', x === b));
      render();
    }));
    render();
  }
  function archiveSheet() {
    const today = dayNumber(), mine = days(), arch = archive();
    const items = [];
    for (let n = today - 1; n >= 1; n--) {
      const d = mine[n], a = arch[n];
      const state = d && d.done ? `${fmt(d.score)} · ${gridOf(d.picks)}` : a ? `Archive best ${fmt(a.score)}` : 'Not played';
      items.push(`<button type="button" class="arch-day" data-n="${n}"><b>#${n}</b><span>${dateText(n)}</span><span>${state}</span></button>`);
    }
    sheet('⟲ Archive', items.length ? `<p>Play any past Daily Launch. Archive launches don't change your streak or that day's score.</p><div class="arch-list">${items.join('')}</div>` : '<p>Launch #1 is today, so there are no past launches yet. Come back tomorrow!</p>');
    $('sheetBody').querySelectorAll('.arch-day').forEach(b => b.addEventListener('click', () => {
      Sound.click(); closeSheet();
      startDaily(+b.dataset.n, true);
    }));
  }
  function howSheet() {
    sheet('How to play', `
      <p><b>Name something in the category.</b> Each prompt names one: "Name a dog breed." How rare your answer is decides how far you fly.
      Spelling doesn't have to be right: close spellings and ones that sound right count, and the game shows what it read your answer as.</p>
      <div class="how-tiers">${T.map((t, i) => `<span class="ht-e">${t.emoji}</span><span class="tier-${i}">${t.name} · ${fmt(t.pts)} (Endless ${CLASSIC_PTS[i]})</span><span>${esc(t.blurb)}</span>`).join('')}</div>
      <p><b>🌅 Daily Launch</b> (one difficulty): 10 prompts a day, the same for everyone, new at midnight. 25 seconds and one answer each:
      an answer that isn't on the list doesn't use up your shot, and the first real answer locks in. 50,000 points reaches the Edge of the Universe.
      One go a day, and leaving part-way still counts. After each prompt you can see every answer that would have counted.</p>
      <p><b>∞ Endless</b> plays by Brain Rocket's classic rules: Owen (30s, 5 fuel cells, 5 skips, hints), Medium (20s, ×1.5), Hard (12s, ×2) and
      Ultra Hard (12s, ×2.5, and you fall while you think). Answer in the first quarter of the timer for ×2, the first half for ×1.5. Each answer
      in a row adds ×0.25, up to ×5, and a Supernova is a deepest cut (×1.5). Wrong guesses are free; running out of time burns a fuel cell.</p>
      <p><b>No rude words.</b> Type a swear word and the rocket crashes.</p>
      <p>The answer lists are built from Wikidata and Wikipedia.</p>`);
  }

  // ---- Title screen: Daily and Endless tabs ----------------------------------------------------
  const TABS = {
    daily: {
      tagline: 'Ten prompts a day, the same for everyone. One answer each: the rarer it is, the further you fly.',
      how: `<div><b>🎯 One shot.</b> 25 seconds and one answer. Answers that aren't on the list don't use it up.</div>
        <div><b>🌟 Be rare.</b> A Launch Pad answer is 500 points; the one Supernova is 5,000.</div>
        <div><b>🌍 Same for everyone.</b> New prompts at midnight. 50,000 reaches the Edge of the Universe.</div>
        <div><b>👀 No secrets after.</b> See every answer that counted, searchable, once you've played.</div>`
    },
    endless: {
      tagline: 'Brain Rocket\'s classic rules with the new questions. Be quick, keep a streak, and don\'t run out of fuel.',
      how: `<div><b>⚡ Be quick.</b> Answer in the first quarter of the timer for ×2, the first half for ×1.5.</div>
        <div><b>🔥 Keep a streak.</b> Each answer in a row adds ×0.25, up to ×5.</div>
        <div><b>⛽ Watch your fuel.</b> Running out of time burns a fuel cell. Skips are limited.</div>
        <div><b>🌟 Be rare.</b> Launch Pad 10 up to Supernova 200, and a Supernova is a deepest cut (×1.5).</div>`
    }
  };
  let tab = store.get('tab', 'daily');
  if (!TABS[tab]) tab = 'daily';
  function placeGlider() {
    const b = document.querySelector(`.type-btn[data-tab="${tab}"]`), g = $('typeGlider');
    if (!b || !b.offsetWidth) return;
    g.style.width = b.offsetWidth + 'px';
    g.style.transform = `translateX(${b.offsetLeft - 6}px)`;
  }
  function setTab(t) {
    tab = t; store.set('tab', t);
    $('title').dataset.tab = t;
    document.querySelectorAll('.type-btn').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    show('paneDaily', t === 'daily'); show('paneEndless', t === 'endless');
    $('tagline').textContent = TABS[t].tagline;
    $('howBox').innerHTML = TABS[t].how + `<div class="how-links"><button type="button" class="link-btn" data-act="how">How to play</button>${t === 'daily' ? '<button type="button" class="link-btn" data-act="archive">⟲ Archive</button>' : ''}</div>`;
    $('howBox').querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => { Sound.click(); b.dataset.act === 'how' ? howSheet() : archiveSheet(); }));
    placeGlider();
  }

  // Browsers only allow sound after a click or key press, so the title music waits for one.
  let interacted = false;
  const firstTouch = () => {
    if (interacted) return;
    interacted = true;
    Sound.unlock();
    if (G.state === 'title') Sound.music('evolved');
  };
  window.addEventListener('pointerdown', firstTouch, true);
  window.addEventListener('keydown', firstTouch, true);

  function showTitle() {
    clearLater();
    settle();
    G.state = 'title'; G.mode = null;
    screen('title');
    show('countdown', false);
    Scene.reset();
    if (interacted) Sound.music('evolved');
    const n = dayNumber(), rec = days()[n], s = streak();
    $('dcNum').textContent = `#${n}`;
    $('dcStreak').textContent = `🔥 ${s.count}-day streak`;
    show('dcStreak', s.count > 0);
    const box = $('dcState');
    if (rec && rec.done) {
      const p = placeAt(rec.score);
      box.innerHTML = `<div class="dc-done"><div class="dc-score">${fmt(rec.score)} <small>/ 50,000 · ${p.icon} ${esc(p.name)}</small></div>
        <div class="dc-grid">${gridOf(rec.picks)}</div>
        <div class="dc-row"><button type="button" class="go-btn small" id="dcResults">See results</button><span class="dc-next" id="dcNext"></span></div></div>`;
      $('dcResults').addEventListener('click', () => { Sound.click(); startDaily(n); });
      const tick = () => { const el = $('dcNext'); if (!el) return; el.textContent = `Next launch in ${hms(msToNextDay())}`; if (msToNextDay() < 1500) later(showTitle, 1600); };
      tick(); clearInterval(showTitle.iv); showTitle.iv = setInterval(tick, 30000);
    } else {
      box.innerHTML = `<p class="dc-lead">Today's ten prompts are waiting. <b>Name the rarest answer you can</b> to every one.</p>
        <button type="button" class="go-btn" id="dcGo">▲ LAUNCH ▲</button>`;
      $('dcGo').addEventListener('click', () => { Sound.click(); startDaily(n); });
    }
    const all = bests();
    document.querySelectorAll('[data-best]').forEach(el => {
      const b = all[el.dataset.best];
      el.textContent = b ? `🏆 Best ${fmt(b.score)}` : '';
    });
    setTab(tab);
  }

  // ---- Wiring ---------------------------------------------------------------------------------
  $('answerForm').addEventListener('submit', submit);
  $('rvNext').addEventListener('click', next);
  $('rvAll').addEventListener('click', () => { Sound.click(); answerBrowser(G.cat, G.picks.length && G.picks[G.picks.length - 1].name); });
  $('skipBtn').addEventListener('click', () => { if (G.state === 'question' && G.skips > 0) timeout(true); });
  $('hintBtn').addEventListener('click', hint);
  $('btnQuit').addEventListener('click', () => { if (G.state === 'question' || G.state === 'reveal') finish(); });
  document.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => { if (b.dataset.tab !== tab) { Sound.click(); setTab(b.dataset.tab); } }));
  document.querySelectorAll('.mode-card').forEach(b => b.addEventListener('click', () => { Sound.click(); startEndless(b.dataset.mode); }));
  $('btnShare').addEventListener('click', share);
  $('btnAgain').addEventListener('click', () => {
    Sound.click();
    if (G.result && G.result.mode === 'endless') startEndless(G.result.diff);
    else { tab = 'endless'; showTitle(); }
  });
  $('btnMenu').addEventListener('click', () => { Sound.click(); showTitle(); });
  $('sheetClose').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });
  const soundBtn = $('btnSound');
  const paintSound = () => { soundBtn.textContent = Sound.muted ? '🔇' : '🔊'; };
  soundBtn.addEventListener('click', () => { Sound.toggle(); paintSound(); });
  paintSound();

  const fullBtn = $('btnFull');
  const newTabUrl = () => SITE_URL || location.href.split('#')[0];
  function openNewTab() { const a = document.createElement('a'); a.href = newTabUrl(); a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  function setNewTabMode() { fullBtn.textContent = '↗'; fullBtn.classList.add('newtab'); fullBtn.title = 'Open in a new tab'; fullBtn.setAttribute('aria-label', 'Open in a new tab'); }
  if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) setNewTabMode();
  fullBtn.addEventListener('click', () => {
    if (fullBtn.classList.contains('newtab')) { Sound.click(); return openNewTab(); }
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => { setNewTabMode(); openNewTab(); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('sheet').classList.contains('hidden')) { e.preventDefault(); closeSheet(); return; }
    if (!$('sheet').classList.contains('hidden')) return;
    if (e.key === 'Enter' && G.state === 'reveal' && !classic() && document.activeElement !== $('rvAll')) { e.preventDefault(); next(); }
  });
  // Typing anywhere during a prompt goes to the answer box.
  document.addEventListener('keydown', e => {
    if (G.state !== 'question' || !$('sheet').classList.contains('hidden') || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = $('answer');
    if (document.activeElement !== a && e.key.length === 1) a.focus({ preventScroll: true });
  }, true);

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  document.addEventListener('fullscreenchange', () => setTimeout(fit, 60));
  if (window.visualViewport) { visualViewport.addEventListener('resize', keyboardPan); visualViewport.addEventListener('scroll', keyboardPan); }
  document.addEventListener('focusin', () => setTimeout(keyboardPan, 300));
  document.addEventListener('focusout', () => setTimeout(keyboardPan, 300));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeGlider);
  // Leaving a daily part-way counts: record it as soon as the page goes away.
  window.addEventListener('pagehide', () => { if (G.mode === 'daily' && G.state !== 'over' && G.state !== 'title') saveProgress(); });

  // ---- Main loop ------------------------------------------------------------------------------
  let last = performance.now(), hudT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.state === 'question') {
      const left = (G.ends - now) / 1000;
      const f = Math.max(0, left / G.time);
      const fill = $('timerFill');
      fill.style.width = f * 100 + '%';
      fill.classList.toggle('low', left < Math.min(6, G.time * 0.25));
      const secs = Math.max(0, Math.ceil(left));
      const el = $('timerSecs');
      if (el.textContent !== String(secs)) { el.textContent = secs; if (secs <= 5 && secs > 0) Sound.tick(secs <= 3); }
      if (classic()) {
        const sp = f >= 0.75 ? 2 : f >= 0.5 ? 1.5 : 1;
        $('speedBadge').textContent = sp > 1 ? `⚡ ×${sp}` : '';
        // Ultra Hard: the rocket falls while you think, faster the higher you are
        if (M().drift && G.score > 0) {
          G.score = Math.max(0, G.score - (12 + 0.03 * G.score) * dt);
          Scene.setTarget(Scene.altFor(G.score));
          if ((hudT += dt) > 0.2) { hudT = 0; updateHud(); }
        }
      }
      if (left <= 0) timeout(false);
    }
    Scene.update(dt);
    Scene.draw();
    requestAnimationFrame(frame);
  }

  Scene.init($('scene'));
  fit();
  showTitle();
  requestAnimationFrame(frame);

  // for tests
  window.BREvolved = { G, dayNumber, startDaily, startEndless, showTitle, store, MODES };
})();
