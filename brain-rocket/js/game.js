/* Brain Rocket — game flow, scoring and UI for both Rocket and Submarine modes. */
'use strict';

(function () {
  const MODES = {
    easy:   { id: 'easy',   label: 'Owen (Easy)', time: 30, lives: 5, mult: 1,   skips: 5, fast: [6, 12], drain: 5 },
    medium: { id: 'medium', label: 'Medium',      time: 20, lives: 3, mult: 1.5, skips: 3, fast: [5, 10], drain: 8 },
    hard:   { id: 'hard',   label: 'Hard',        time: 12, lives: 3, mult: 2,   skips: 2, fast: [4, 8], drain: 12 },
    // Ultra: Hard questions, but you slide back (rocket falls, sub floats up) while each question is up.
    // Ultra comes with a choice of question difficulty; everything else is the same.
    'ultra-easy':   { id: 'ultra-easy',   label: 'Ultra Hard · easy questions',   tag: 'Ultra Hard', time: 12, lives: 3, mult: 2.5, skips: 2, fast: [4, 8], quiz: 'easy',   drift: true, drain: 15 },
    'ultra-medium': { id: 'ultra-medium', label: 'Ultra Hard · medium questions', tag: 'Ultra Hard', time: 12, lives: 3, mult: 2.5, skips: 2, fast: [4, 8], quiz: 'medium', drift: true, drain: 15 },
    ultra:          { id: 'ultra',        label: 'Ultra Hard · hard questions',   tag: 'Ultra Hard', time: 12, lives: 3, mult: 2.5, skips: 2, fast: [4, 8], quiz: 'hard',   drift: true, drain: 15 }
  };
  const DIVE_LENGTHS = [30, 60, 120];
  let diveLen = 60;
  try { const v = +localStorage.getItem('brainRocket.dive'); if (DIVE_LENGTHS.includes(v)) diveLen = v; } catch (e) { /* ignore */ }

  const fmtKm = km => {
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
  };
  // Haunted Flight (limited time): outrun a ghost. All distances are in metres.
  const HAUNT = {
    start: 60,                       // your head start
    max: 150,                        // the furthest ahead of the ghost you can get
    danger: 40,                      // closer than this, the heartbeat starts and the world darkens
    close: 10,                       // a right answer when it's closer than this is a close escape
    cruise: 12,                      // metres flown each second while a question is up
    speed: t => 2.5 + 0.015 * t,     // how fast the ghost closes in (m/s), t seconds into the chase
    boost: pts => 9 * Math.pow(pts / 10, 0.75),        // metres an answer's points blast you ahead
    skipCost: t => Math.round(4 * HAUNT.speed(t))       // a skip lets the ghost gain 4 seconds' worth
  };
  const HALLOWEEN_SHARE = 0.25;      // how often Haunted Flight asks a Halloween question
  const fmtM = m => Math.round(m).toLocaleString() + ' m';
  const fmtTime = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const boostRange = mult => `+${Math.round(HAUNT.boost(10 * mult))} m to +${Math.round(HAUNT.boost(200 * mult))} m per answer`;

  const fmtDepth = km => (km < 20 ? Math.round(km * 1000).toLocaleString() + ' m' : Math.round(km).toLocaleString() + ' km');

  // The two ways to play. Everything that differs between them lives here.
  const TYPES = {
    rocket: {
      id: 'rocket', scene: Scene, stops: MILESTONES, fmt: fmtKm, from: 'from Earth', distLabel: 'Altitude',
      marker: '🚀', down: false, go: 'GO!', firstTag: '🚀 LIFTOFF!', reached: 'YOU REACHED', notYet: 'Not flown yet',
      tagline: 'Answer questions to fuel your rocket. Fly from the launch pad to the Moon, Mars… and beyond!',
      fast: '<b>⚡ Be fast.</b> Answer in the first quarter of the timer for ×2, first half for ×1.5.',
      rule: '<b>⛽ Don\'t run dry.</b> Running out of time burns a fuel cell. Wrong guesses are free.',
      endless: '∞ Beyond everything!',
      again: '🚀 Fly again', overTitle: 'Out of fuel!', crashTitle: '💥 Crashed!', name: () => 'Rocket',
      turning: 'Your rocket is turning back…',
      crashLine: p => `Your rocket nose-dived from <b>${p}</b> into the Earth. Score lost!`,
      reachedLine: (p, dist) => `You reached <b>${p}</b> — ${dist} from Earth.`,
      info: {
        easy: '30s per question<br>5 fuel cells · everyday topics',
        medium: '20s per question<br>3 fuel cells · mixed topics',
        hard: '12s per question<br>3 fuel cells · expert topics',
        ultra: '12s per question<br>you fall between answers!'
      }
    },
    sub: {
      id: 'sub', scene: SubScene, stops: DEPTHS, fmt: fmtDepth, from: 'deep', distLabel: 'Depth',
      marker: '🤿', down: true, go: 'DIVE!', firstTag: '🌊 DIVE!', reached: 'YOU DOVE TO', notYet: 'Not dived yet',
      tagline: 'Pick a 30, 60 or 120-second dive. Every answer drives your submarine deeper. How far down can you get?',
      fast: '<b>⚡ Be fast.</b> Answer each question within a few seconds for ×2 or ×1.5.',
      rule: '<b>⏱️ Beat the clock.</b> One timed dive. No lives to lose and unlimited skips.',
      leftText: 's of dive left', endless: '∞ Deeper than anyone!', outText: '⏱️ Time\'s up! Surfacing…',
      again: '🌊 Dive again', overTitle: "Time's up!", crashTitle: '🫧 Back to the surface!', name: n => `Submarine (${n}s)`,
      turning: 'Your sub is turning back…',
      crashLine: p => `Your sub shot back up from <b>${p}</b>. Score lost!`,
      reachedLine: (p, dist) => `You dove to <b>${p}</b> — ${dist} deep.`,
      info: {
        easy: '30, 60 or 120s dive<br>unlimited skips · everyday topics',
        medium: '30, 60 or 120s dive<br>unlimited skips · mixed topics',
        hard: '30, 60 or 120s dive<br>unlimited skips · expert topics',
        ultra: '30, 60 or 120s dive<br>you float up between answers!'
      }
    }
  };
  // Play With Friends: a timed race to the centre of the Earth, played from a code so friends get the same questions.
  TYPES.drill = {
    ...TYPES.sub,
    id: 'drill', scene: DrillScene, stops: DRILL_STOPS, from: 'deep', marker: '⛏️', go: 'DRILL!', firstTag: '⛏️ DRILL!',
    reached: 'YOU DRILLED TO', notYet: 'Not drilled yet',
    tagline: 'Drill to the centre of the Earth! Share a code so your friends get the exact same questions, then compare scores.',
    rule: '<b>🎟️ Same code, same questions.</b> Friends with your code get the exact same questions, in order.',
    timeLabel: 'Drill time', leftText: 's left', outText: '⏱️ Time\'s up!', again: '⛏️ Drill again', crashTitle: '💥 Blasted out!', name: n => `Play With Friends (${n}s drill)`,
    turning: 'Your drill is turning back…',
    crashLine: p => `Your drill spun round and shot out of the ground from <b>${p}</b>. Score lost!`,
    reachedLine: (p, dist) => `You drilled down to <b>${p}</b> — ${dist} deep.`
  };
  // Elevator: up a tower that never ends. Power is your life: wrong answers and timeouts drain it,
  // correct answers recharge a little, and the whole building reacts as it runs low.
  TYPES.elev = {
    ...TYPES.rocket,
    id: 'elev', scene: ElevScene, stops: ELEV_STOPS, fmt: n => 'Floor ' + (n >= 1e9 ? '∞' : Math.max(1, Math.round(n)).toLocaleString()), from: '', distLabel: 'Elevator',
    marker: '🛗', down: false, go: 'GOING UP!', firstTag: '🛗 GOING UP!', reached: 'YOU REACHED', notYet: 'Not ridden yet',
    tagline: 'Ride a glass elevator up a tower that never ends. The higher you go, the stranger the floors get!',
    rule: '<b>⚡ Keep the power on.</b> Wrong answers and timeouts drain power; right ones recharge it. At 0% the lights go out.',
    timeLabel: 'Power', driftText: '⬇️ Going down', endless: '∞ The tower never ends!',
    again: '🛗 Ride again', overTitle: 'Power outage!', crashTitle: '💥 Cable snapped!', name: () => 'Elevator',
    turning: 'The elevator cable is snapping…',
    crashLine: p => `The cable snapped near <b>${p}</b> and the elevator plunged to the lobby. Score lost!`,
    reachedLine: (p, dist) => `You rode up to <b>${p}</b> — ${dist}.`,
    info: {
      easy: '30s per question<br>wrong answer −5% power',
      medium: '20s per question<br>wrong answer −8% power',
      hard: '12s per question<br>wrong answer −12% power',
      ultra: '12s per question<br>the elevator sinks between answers!'
    }
  };
  // Haunted Flight: a limited-time Halloween mode. No timer, no fuel: survive until the ghost reaches you.
  TYPES.haunt = {
    ...TYPES.rocket,
    id: 'haunt', scene: HauntScene, stops: HAUNT_STOPS, fmt: fmtM, from: 'flown', distLabel: 'Ghost behind', unit: ' m',
    marker: '👻', go: 'FLY!', firstTag: '👻 RUN!', reached: 'YOU FLEW PAST', notYet: 'Not flown yet',
    tagline: '🎃 Limited time! A ghost is chasing your rocket. Every right answer blasts you ahead. How far can you get?',
    fast: '<b>👻 Outrun the ghost.</b> It closes in while you think and slowly speeds up. Rarer answers push it further back.',
    rule: '<b>⏭ Skips cost distance.</b> Skip as often as you like, but the ghost jumps closer each time. Wrong guesses are free.',
    timeLabel: 'Survived', endless: '∞ Beyond everything!',
    again: '👻 Fly again', overTitle: '👻 Caught!', crashTitle: '👻 Gobbled!', name: () => 'Haunted Flight',
    turning: 'Your rocket is turning back…',
    crashLine: p => `Your rocket turned around and flew straight into the ghost near <b>${p}</b>. Score lost!`,
    reachedLine: (p, dist) => `The ghost caught you near <b>${p}</b> after ${dist}.`,
    info: {
      easy: `everyday questions · hints<br>${boostRange(1)}`,
      medium: `mixed questions<br>${boostRange(1.5)}`,
      hard: `expert questions<br>${boostRange(2)}`,
      ultra: ''
    }
  };
  const TYPE_ORDER = ['rocket', 'sub', 'drill', 'elev', 'haunt'];
  // Elevator is hidden for now: its tab is hidden in index.html, and a saved choice of it falls back to Rocket.
  // Haunted Flight is a limited-time Halloween event: it disappears once November 1, 2026 is over
  // (midnight in the player's own time zone).
  const HAUNT_ENDS = new Date(2026, 10, 2);
  const HIDDEN_TYPES = new Set(['elev', ...(Date.now() >= HAUNT_ENDS.getTime() ? ['haunt'] : [])]);
  document.querySelectorAll('.type-btn').forEach(b => { if (HIDDEN_TYPES.has(b.dataset.type)) b.hidden = true; });
  const isElev = () => G.type === 'elev';
  const isHaunt = () => G.type === 'haunt';
  let J = TYPES.rocket;   // the current way to play
  let S = J.scene;        // its scene
  try { const t = localStorage.getItem('brainRocket.type'); if (TYPES[t] && !HIDDEN_TYPES.has(t)) { J = TYPES[t]; S = J.scene; } } catch (e) { /* ignore */ }

  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const el = {
    hud: $('hud'), track: $('track'), card: $('card'), title: $('title'), pause: $('pause'), over: $('over'),
    score: $('hudScore'), alt: $('hudAlt'), altLabel: $('hudAltLabel'), next: $('hudNext'), streak: $('hudStreak'), mult: $('hudMult'),
    streakPill: $('streakPill'), fuel: $('hudFuel'), fuelPill: $('fuelPill'), timePill: $('timePill'), time: $('hudTime'),
    qCat: $('qCat'), qNum: $('qNum'), qText: $('qText'),
    timer: document.querySelector('.timer'), timerFill: $('timerFill'), timerSecs: $('timerSecs'), speed: $('speedBadge'),
    form: $('answerForm'), input: $('answer'), go: $('goBtn'), feedback: $('feedback'), reveal: $('reveal'),
    skip: $('skipBtn'), skipCount: $('skipCount'), hint: $('hint'), hintBtn: $('hintBtn'), popups: $('popups'), banner: $('banner'), countdown: $('countdown'),
    trackStops: $('trackStops'), trackFill: $('trackFill'), trackRocket: $('trackRocket')
  };

  // ---- Stage scaling (always 16:9) ------------------------------------
  function fit() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    stage.style.transform = `scale(${s}) translate(-50%, -50%)`;
    Scene.resize(s);
    SubScene.resize(s);
    DrillScene.resize(s);
    ElevScene.resize(s);
    HauntScene.resize(s);
    const old = $('sceneOld'); if (old) { old.width = $('scene').width; old.height = $('scene').height; }
  }

  // ---- Saved bests ------------------------------------------------------
  let bests = {};
  try { bests = JSON.parse(localStorage.getItem('brainRocket.bests') || '{}') || {}; } catch (e) { bests = {}; }
  function saveBests() { try { localStorage.setItem('brainRocket.bests', JSON.stringify(bests)); } catch (e) { /* ignore */ } }
  // Rocket: 'easy'. Submarine: 'sub:easy' for 60-second dives (the original length), 'sub:easy:30' otherwise.
  const bestKey = (type, mode, len) => (type === 'rocket' ? mode : type === 'elev' || type === 'haunt' ? `${type}:${mode}` : len === 60 ? `${type}:${mode}` : `${type}:${mode}:${len}`);

  // ---- Distance helpers -------------------------------------------------
  function kmAt(alt) {
    const M = J.stops;
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
  // Score -> scene position, linear between stops.
  function altFor(score) {
    const M = J.stops;
    for (let i = 0; i < M.length - 1; i++) {
      const a = M[i], b = M[i + 1];
      if (score < b.pts) return a.alt + (score - a.pts) * (b.alt - a.alt) / (b.pts - a.pts);
    }
    const a = M[M.length - 2], b = M[M.length - 1];
    return b.alt + (score - b.pts) * (b.alt - a.alt) / (b.pts - a.pts);
  }
  const placeAt = score => { let m = J.stops[0]; for (const x of J.stops) if (score >= x.pts) m = x; return m; };
  const nextPlace = score => J.stops.find(m => m.pts > score);
  const nextByAlt = alt => J.stops.find(m => m.alt > alt);

  // ---- Game state -------------------------------------------------------
  const G = {
    state: 'title', mode: null, type: 'rocket', score: 0, shown: 0, lives: 0, streak: 0, bestStreak: 0, qNum: 0,
    skips: 0, used: new Set(), seen: Quiz.newRun(), q: null, timeLeft: 0, lastTick: 0, diveLeft: 0, qElapsed: 0,
    correct: 0, bestAnswer: null, launched: false, peak: 0, reached: new Set(), timers: [],
    challenge: null, rng: Math.random   // a challenge code fixes the question order for everyone
  };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); G.timers.push(id); return id; };
  const clearLater = () => { G.timers.forEach(clearTimeout); G.timers = []; };
  // Submarine and Play With Friends both run on one clock with unlimited skips.
  const isDive = () => G.type === 'sub' || G.type === 'drill';
  // When the dive clock turns red and starts ticking.
  const lowAt = () => 10;

  // How fast Ultra slides you back, in points per second. It gets harsher the further you've gone.
  // A parachute (Rocket only, inside the atmosphere) cuts that to 30%.
  const CHUTE_SLOW = 0.7;
  const drifts = () => !!(G.mode && G.mode.drift);
  const driftRate = () => (12 + 0.03 * G.score) * (1 - CHUTE_SLOW * (S === Scene ? Scene.chute : 0));

  const streakMult = n => Math.min(5, 1 + 0.25 * Math.max(0, n - 1));
  const HINT_COST = 0.8;   // each hint takes 20% off that answer's points (and ends your streak)
  // Rocket: by how much of the question timer is left. Submarine: by seconds taken on this question.
  function speedMult() {
    if (isDive()) {
      const [x2, x15] = G.mode.fast;
      return G.qElapsed <= x2 ? 2 : G.qElapsed <= x15 ? 1.5 : 1;
    }
    const frac = G.timeLeft / G.mode.time;
    return frac >= 0.75 ? 2 : frac >= 0.5 ? 1.5 : 1;
  }

  // ---- Title screen -----------------------------------------------------
  // Switching tabs slides the old world out and the new one in, in step with the tab highlight.
  function setType(id, animate) {
    const from = TYPE_ORDER.indexOf(J.id), to = TYPE_ORDER.indexOf(id);
    J = TYPES[id];
    if (S !== J.scene) {
      if (animate && from !== to) slideScenes(to > from ? 1 : -1);
      S = J.scene; S.reset();
    }
    try { localStorage.setItem('brainRocket.type', id); } catch (e) { /* ignore */ }
    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === id);
      b.setAttribute('aria-pressed', b.dataset.type === id ? 'true' : 'false');
    });
    const n = s => s.replace('{n}', diveLen);
    $('tagline').textContent = n(J.tagline);
    // the rules box only changes its text once it's fully blurred
    const fastText = J.fast, ruleText = n(J.rule);
    const rules = () => { $('ruleFast').innerHTML = fastText; $('ruleLast').innerHTML = ruleText; };
    if (animate && from !== to) blurRules(rules); else rules();
    closeTimePick();
    $('chPanel').classList.toggle('hidden', id !== 'drill');
    if (id === 'drill') renderHost();
    document.querySelectorAll('.mode-card').forEach(c => { c.querySelector('.mode-info').innerHTML = n(J.info[c.dataset.mode]); });
    document.querySelectorAll('[data-best]').forEach(b => {
      // Submarine keeps a best for each dive length; the card shows the best of them
      const r = id === 'sub' ? bestDive(b.dataset.best) : bests[bestKey(id, b.dataset.best, diveLen)];
      const len = r && r.len ? ` (${r.len}s)` : '';
      if (b.closest('.ultra-pick')) b.textContent = r ? `Best ${r.score.toLocaleString()}${len}` : '';
      else b.textContent = r ? `Best: ${r.score.toLocaleString()}${J.unit || ''} · ${r.icon} ${r.place}${len}` : J.notYet;
    });
    el.title.dataset.type = id;
    moveGlider(animate);
  }

  // The yellow highlight behind the active tab slides from tab to tab.
  function moveGlider(animate) {
    const glider = $('typeGlider'), btn = document.querySelector('.type-btn.active');
    if (!glider || !btn || !btn.offsetWidth) return;
    glider.classList.toggle('instant', !animate);
    glider.style.width = btn.offsetWidth + 'px';
    glider.style.transform = `translateX(${btn.offsetLeft}px)`;
  }

  const bestDive = mode => DIVE_LENGTHS.map(len => bests[bestKey('sub', mode, len)] && { ...bests[bestKey('sub', mode, len)], len })
    .filter(Boolean).sort((a, b) => b.score - a.score)[0];

  // Submarine: after you pick a difficulty, a picker covers that card and asks how long to dive.
  const tp = { box: $('timePick'), mode: null, card: null };
  function openTimePick(card, modeId) {
    const box = tp.box;
    tp.mode = modeId; tp.card = card;
    box.style.left = card.offsetLeft + 'px'; box.style.top = card.offsetTop + 'px';
    box.style.width = card.offsetWidth + 'px'; box.style.height = card.offsetHeight + 'px';
    $('tpMode').textContent = MODES[modeId].label;
    box.querySelectorAll('.tp-len').forEach(b => {
      const len = +b.dataset.len, r = bests[bestKey('sub', modeId, len)];
      b.querySelector('small').textContent = r ? `Best ${r.score.toLocaleString()}` : 'Not dived yet';
      b.classList.toggle('last', len === diveLen);
    });
    box.classList.remove('hidden');
    void box.offsetWidth; box.classList.add('open');
    box.querySelector(`.tp-len[data-len="${diveLen}"]`).focus();
  }
  function closeTimePick() {
    if (!tp.box || tp.box.classList.contains('hidden')) return;
    tp.box.classList.add('hidden'); tp.box.classList.remove('open');
    tp.mode = null; tp.card = null;
  }
  const timePickOpen = () => !tp.box.classList.contains('hidden');
  // Every way to pick a difficulty comes through here.
  function chooseMode(card, modeId) {
    if (J.id === 'sub') openTimePick(card, modeId);
    else start(modeId);
  }

  // The rules box blurs while the worlds slide past, swaps its text once fully blurred, then sharpens.
  const BLUR_MS = 250;   // matches the .how filter transition in style.css
  function blurRules(swap) {
    const how = document.querySelector('.title-panel .how');
    how.classList.add('switching');
    clearTimeout(blurRules.t); clearTimeout(blurRules.t2);
    blurRules.t = setTimeout(() => {
      swap();
      blurRules.t2 = setTimeout(() => how.classList.remove('switching'), 40);
    }, BLUR_MS + 20);
  }

  function slideScenes(dir) {
    const main = $('scene'), old = $('sceneOld');
    old.width = main.width; old.height = main.height;
    old.getContext('2d').drawImage(main, 0, 0);
    for (const c of [main, old]) { c.classList.remove('sliding'); }
    old.style.transform = 'translateX(0)';
    main.style.transform = `translateX(${dir * 100}%)`;
    old.classList.remove('hidden');
    void main.offsetWidth;
    for (const c of [main, old]) c.classList.add('sliding');
    old.style.transform = `translateX(${-dir * 100}%)`;
    main.style.transform = 'translateX(0)';
    clearTimeout(slideScenes.t);
    slideScenes.t = setTimeout(() => { old.classList.add('hidden'); main.classList.remove('sliding'); old.classList.remove('sliding'); }, 600);
  }
  function showTitle() {
    clearLater();
    G.state = 'title';
    S.reset();
    [el.hud, el.track, el.card, el.pause, el.over, el.countdown].forEach(e => e.classList.add('hidden'));
    el.card.classList.remove('blur');
    el.title.classList.remove('hidden');
    const u = document.querySelector('.mode-ultra');
    u.classList.remove('open'); u.setAttribute('aria-expanded', 'false');
    setType(J.id);
  }

  // ---- Start a run ------------------------------------------------------
  // challenge: a decoded code ({type, mode, len, seed}), or nothing for a normal game.
  function start(modeId, challenge) {
    Sound.unlock();
    clearLater();
    const ch = challenge || null;
    if (ch) setType('drill');
    const mode = MODES[modeId];
    const len = ch ? ch.len : diveLen;   // a challenge sets its own time; the Submarine choice is left alone
    const dive = J.id === 'sub' || J.id === 'drill';
    const elev = J.id === 'elev';
    const haunt = J.id === 'haunt';
    Object.assign(G, {
      state: 'countdown', mode, type: J.id, score: 0, shown: 0, lives: dive || elev || haunt ? Infinity : mode.lives, power: 100, tried: new Set(), streak: 0, bestStreak: 0,
      gap: HAUNT.start, dist: 0, chaseT: 0, closest: null, pauseUsed: false, beatT: 0,
      qNum: 0, skips: dive || haunt ? Infinity : mode.skips, used: new Set(), seen: ch ? Quiz.freshRun() : Quiz.newRun(), q: null,
      challenge: ch, rng: ch ? Challenge.rng(ch.seed) : Math.random, correct: 0, bestAnswer: null,
      launched: false, peak: 0, reached: new Set(), crashed: false, boomed: false, diveTime: len, diveLeft: len, qElapsed: 0, lastTick: len
    });
    S.reset();
    S.setStreak(0);
    el.title.classList.add('hidden');
    el.over.classList.add('hidden');
    el.pause.classList.add('hidden');
    el.hud.classList.remove('hidden');
    el.track.classList.toggle('hidden', haunt);
    el.card.classList.add('hidden');
    el.track.classList.toggle('down', dive);
    el.card.classList.toggle('dive', dive);
    // Haunted Flight: the card runs along the bottom and the HUD shows the chase
    el.card.classList.toggle('haunt', haunt);
    el.hud.classList.toggle('haunt', haunt);
    el.countdown.classList.toggle('haunt', haunt);
    el.banner.classList.toggle('haunt', haunt);
    el.timerFill.style.background = '';
    $('btnPause').disabled = false;
    document.querySelector('.score-pill .pill-label').textContent = haunt ? 'Distance' : 'Score';
    document.querySelectorAll('.legend span').forEach((sp, i) => {
      sp.dataset.base = sp.dataset.base || sp.textContent;
      sp.textContent = haunt ? `${Quiz.TIER_NAMES[i + 1]} +${Math.round(HAUNT.boost(Quiz.TIER_POINTS[i + 1] * mode.mult))} m` : sp.dataset.base;
    });
    el.fuelPill.classList.toggle('hidden', dive || elev || haunt);
    el.timePill.classList.toggle('hidden', !dive && !elev && !haunt);
    el.altLabel.textContent = J.distLabel;
    $('hudTimeLabel').textContent = J.timeLabel || 'Dive time';
    el.trackRocket.textContent = J.marker;
    buildTrack();
    renderFuel();
    renderStreak();
    if (elev) renderPower(); else if (haunt) renderChase(); else renderDiveClock();
    updateHud(0);

    const steps = ['3', '2', '1', J.go];
    steps.forEach((txt, i) => later(() => {
      el.countdown.classList.remove('hidden', 'tick');
      void el.countdown.offsetWidth;
      el.countdown.textContent = txt;
      el.countdown.classList.add('tick');
      if (txt === J.go) { Sound.go(); S.setIgnite(0.5); }
      else { Sound.count(); S.setIgnite(0.25 + i * 0.25); }
      if (i === 0) Sound.rumble(3);
    }, i * 800));
    later(() => { el.countdown.classList.add('hidden'); nextQuestion(); }, steps.length * 800);
  }

  // ---- Questions --------------------------------------------------------
  function nextQuestion() {
    if (G.lives <= 0) return gameOver();
    if (isDive() && G.diveLeft <= 0) return gameOver();
    G.qNum++;
    // Haunted Flight mixes in a Halloween question a quarter of the time
    G.q = isHaunt() && G.rng() < HALLOWEEN_SHARE ? Quiz.halloween(G.seen, G.rng) : Quiz.generate(G.mode.quiz || G.mode.id, G.seen, G.rng);
    G.timeLeft = G.mode.time;
    G.qElapsed = 0;
    if (!isDive()) G.lastTick = Math.ceil(G.timeLeft);
    G.state = 'question';
    el.card.classList.remove('hidden', 'swap', 'blur', 'shake');
    void el.card.offsetWidth;
    el.card.classList.add('swap');
    el.qCat.textContent = `${G.q.cat.icon} ${G.q.cat.name}`;
    el.qNum.innerHTML = `Question ${G.qNum}` + (G.challenge ? ` · <span class="ch-tag">🎟️ ${G.challenge.code}</span>` : '');
    el.qText.innerHTML = G.q.text;
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
    el.reveal.classList.add('hidden');
    el.input.value = '';
    el.input.disabled = false;
    el.go.disabled = false;
    el.skip.disabled = G.skips <= 0;
    el.skipCount.textContent = isDive() ? '∞' : G.skips;
    el.skip.classList.remove('risky');
    // Hints are only on Owen (Easy).
    G.hint = null;
    el.hint.classList.add('hidden');
    el.hintBtn.classList.toggle('hidden', G.mode.id !== 'easy');
    el.hintBtn.disabled = false;
    el.hintBtn.textContent = '💡 Hint (−20%)';
    updateTimer();
    el.input.focus();
  }

  function submit() {
    if (G.state !== 'question') return;
    const res = Quiz.check(G.q, el.input.value);
    if (!res.ok) {
      // A real answer for this topic is never rude (Tit is a bird, Ass is a donkey), even when it breaks the letter rule.
      const real = Quiz.check({ cat: G.q.cat, rules: [] }, el.input.value).ok;
      if (!real && BadWords.test(el.input.value)) return crash();
      if (isElev() && el.input.value.trim()) {
        const k = Quiz.keyOf(el.input.value);
        if (!G.tried.has(k)) { G.tried.add(k); if (losePower(G.mode.drain, 'WRONG')) return; }
      }
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
    const tier = res.ent.tier;
    const sp = isHaunt() ? 1 : speedMult();   // no question timer in Haunted Flight, so no speed bonus
    G.streak++;
    G.bestStreak = Math.max(G.bestStreak, G.streak);
    G.correct++;
    const stm = streakMult(G.streak);
    const deep = tier >= 3 && tier === G.q.maxTier ? 1.5 : 1;
    const repeat = G.used.has(G.q.cat.id + ':' + res.ent.id) ? 0.5 : 1;
    G.used.add(G.q.cat.id + ':' + res.ent.id);
    const hints = G.hint ? G.hint.shown : 0;
    const hm = Math.pow(HINT_COST, hints);
    const pts = Math.max(1, Math.round(Quiz.TIER_POINTS[tier] * G.mode.mult * sp * stm * deep * repeat * hm));
    // Haunted Flight: the points become metres. You fly that far and the ghost falls that far behind.
    const metres = isHaunt() ? HAUNT.boost(pts) : 0;
    const before = G.gap, close = isHaunt() && before < HAUNT.close;
    if (isHaunt()) {
      G.gap = Math.min(HAUNT.max, G.gap + metres);
      G.dist += metres;
      G.score = Math.floor(G.dist);
      if (G.closest === null || before < G.closest) G.closest = before;
    } else G.score += pts;
    G.peak = Math.max(G.peak, G.score);

    if (!G.bestAnswer || pts > G.bestAnswer.pts) G.bestAnswer = { text: res.v.raw, tier, pts, metres };

    S.setStreak(G.streak);
    if (isHaunt()) { S.boostTo(G.dist, tier); S.escape(tier, close); }
    else S.boostTo(altFor(G.score), tier);
    const rs = S.rocketScreen();
    S.burst(rs.x, rs.y + 60, ['', '#ffffff', '#6fe08a', '#4fb3ff', '#c77dff', '#ffc531'][tier], 20 + tier * 12);
    if (tier >= 4) S.confetti(tier === 5 ? 140 : 60);
    Sound.boost(tier);

    const tags = [];
    if (!G.launched) { tags.push([J.firstTag, '#fff']); G.launched = true; }
    if (sp > 1) tags.push([sp === 2 ? '⚡ ×2 Lightning' : '⚡ ×1.5 Quick', sp === 2 ? '#ffd23f' : '#4fd1ff']);
    if (stm > 1) tags.push([`🔥 ×${stm.toFixed(2).replace(/0$/, '')} Streak`, '#ff9a3c']);
    if (deep > 1) tags.push(['🤓 ×1.5 Deepest cut', '#c77dff']);
    if (G.mode.mult > 1) tags.push([`×${G.mode.mult} ${G.mode.tag || G.mode.label}`, '#ffffff']);
    if (repeat < 1) tags.push(['♻️ ×0.5 Repeat', '#b9c3e6']);
    if (isElev() && G.power < 100) { const up = Math.min(100 - G.power, tier * 2); G.power += up; renderPower(); tags.push([`⚡ +${up}% power`, '#7dffb0']); }
    if (hints) tags.push([`💡 ×${+hm.toFixed(2)} ${hints} hint${hints > 1 ? 's' : ''}`, '#ffe08a']);
    if (close) tags.unshift(['😱 Close escape!', '#ff9a9a']);
    popup(isHaunt() ? `+${Math.round(metres)} m` : `+${pts.toLocaleString()}`, Quiz.TIER_NAMES[tier], tier, tags);

    el.feedback.className = 'feedback ok';
    el.feedback.innerHTML = `✅ <b class="tier-${tier}">${escapeHtml(res.v.raw)}</b> — ${Quiz.TIER_NAMES[tier]}!` + (res.fuzzy ? ' <span style="opacity:.7">(close enough!)</span>' : '');
    el.reveal.classList.add('hidden');

    renderStreak();
    el.score.parentElement.classList.remove('bump'); void el.score.offsetWidth; el.score.parentElement.classList.add('bump');
    lockCard();
    G.state = 'reveal';
    // The dive clock keeps running, so Submarine moves on quickly. The ghost waits while you watch the escape.
    later(nextQuestion, isDive() ? (tier >= 4 ? 1100 : 800) : isHaunt() ? (tier >= 4 ? 1600 : 1100) : (tier >= 4 ? 2300 : 1900));
  }

  // Elevator: lose some power. Returns true if that was the last of it (the game is over).
  function losePower(n, label) {
    G.power = Math.max(0, G.power - n);
    renderPower(true);
    S.sputter();
    popup(`-${n}% ⚡`, label, 0, [], true);
    if (G.power <= 0) { gameOver(); return true; }
    return false;
  }

  function timeout() {
    if (isElev()) {
      G.state = 'reveal';
      G.streak = 0; S.setStreak(0); renderStreak();
      Sound.timeout();
      el.feedback.className = 'feedback';
      el.feedback.textContent = "⏰ Time's up! The elevator lost power.";
      showReveal('You could have said:', Quiz.examples(G.q));
      lockCard();
      if (!losePower(20, "TIME'S UP")) later(nextQuestion, 2600);
      return;
    }
    G.state = 'reveal';
    G.lives--;
    G.streak = 0;
    S.setStreak(0);
    S.sputter();
    Sound.timeout();
    renderFuel(true);
    renderStreak();
    el.feedback.className = 'feedback';
    el.feedback.textContent = G.lives > 0 ? "⏰ Time's up! You lost a fuel cell." : "⏰ Time's up! That was your last fuel cell…";
    showReveal('You could have said:', Quiz.examples(G.q));
    popup('-1 ⛽', "TIME'S UP", 0, [], true);
    lockCard();
    later(() => (G.lives > 0 ? nextQuestion() : gameOver()), 3000);
  }

  function skip() {
    if (G.state !== 'question' || G.skips <= 0) return;
    if (!isDive()) G.skips--;
    G.state = 'reveal';
    G.streak = 0;
    S.setStreak(0);
    Sound.skip();
    renderStreak();
    // The dive clock never stops, so Submarine goes straight to the next question.
    if (isDive()) return nextQuestion();
    // Haunted Flight: unlimited skips, but the ghost jumps closer each time (the button shows how much).
    if (isHaunt()) {
      const cost = HAUNT.skipCost(G.chaseT);
      G.gap -= cost;
      S.lunge(); Sound.whoosh();
      popup(`−${cost} m`, 'GHOST GAINS', 0, [], true);
      if (G.gap <= 0) { G.gap = 0; return gameOver(); }
      return nextQuestion();
    }
    el.feedback.className = 'feedback';
    el.feedback.textContent = '⏭ Skipped — your streak resets.';
    showReveal('One answer that would have worked:', Quiz.examples(G.q));
    lockCard();
    later(nextQuestion, 2400);
  }

  // Each press shows one more letter of a Common answer: "B _ _ _ _ _", then "B E _ _ _ _"...
  function hint() {
    if (G.state !== 'question' || G.mode.id !== 'easy') return;
    if (!G.hint) {
      const low = Math.min(...G.q.answers.map(a => a.ent.tier));
      const pool = G.q.answers.filter(a => a.ent.tier === low);
      G.hint = { word: pool[Math.floor(Math.random() * pool.length)].v.raw, shown: 0 };
    }
    const letters = G.hint.word.replace(/[^A-Za-z]/g, '').length;
    G.hint.shown = Math.min(G.hint.shown + 1, Math.max(1, Math.ceil(letters / 2)));
    let n = 0;
    const pattern = [...G.hint.word].map(ch => {
      if (!/[A-Za-z]/.test(ch)) return ch === ' ' ? '\u00a0\u00a0' : ch;
      return n++ < G.hint.shown ? ch.toUpperCase() : '_';
    }).join(' ');
    el.hint.innerHTML = `💡 Try: <span class="hint-word">${escapeHtml(pattern)}</span>` +
      ` <span class="hint-cost">−${Math.round((1 - Math.pow(HINT_COST, G.hint.shown)) * 100)}% points</span>`;
    if (G.streak) { G.streak = 0; S.setStreak(0); renderStreak(); }
    el.hint.classList.remove('hidden');
    const done = G.hint.shown >= Math.max(1, Math.ceil(letters / 2));
    el.hintBtn.textContent = done ? '💡 No more hints' : '💡 Another letter (−20%)';
    el.hintBtn.disabled = done;
    Sound.click();
    el.input.focus();
  }

  // A rude word: the rocket flips and nose-dives into the Earth; the sub turns round and shoots back to the surface.
  function crash() {
    clearLater();
    G.state = 'crashing';
    G.crashed = true;
    G.crashedFrom = Math.round(isDive() ? G.score : G.peak);
    G.crashPlace = placeAt(Math.round(G.score));
    lockCard();
    G.streak = 0;
    S.setStreak(0);
    renderStreak();
    G.score = 0;   // the score drains away as you go
    el.banner.classList.add('hidden');
    el.feedback.className = 'feedback bad';
    el.feedback.textContent = `🚫 ${J.turning}`;
    el.reveal.classList.add('hidden');
    el.hint.classList.add('hidden');
    el.card.classList.remove('shake'); void el.card.offsetWidth; el.card.classList.add('shake');
    Sound.wrong();
    later(() => Sound.dive(), 700);
    S.crash();
  }

  function lockCard() {
    el.hintBtn.disabled = true;
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
    const crashed = G.crashed;
    G.state = 'dying';
    lockCard();
    if (!crashed) { S.die(); if (isHaunt()) Sound.ghost(); Sound.gameOver(); }
    if (isHaunt() && !crashed) {
      el.feedback.className = 'feedback bad';
      el.feedback.textContent = '👻 The ghost caught you!';
      renderChase();
    }
    if (isDive() && !crashed) {
      el.feedback.className = 'feedback';
      el.feedback.textContent = J.outText;
    }
    later(() => {
      G.state = 'over';
      el.card.classList.add('hidden');
      // Rocket counts the highest point reached; Submarine counts where you are when time runs out.
      const result = crashed ? 0 : Math.round(isDive() ? G.score : G.peak);
      const place = placeAt(result);
      // A challenge keeps its own best per code, so you can see if you beat yourself on the same questions.
      const key = G.challenge ? `drill:${G.challenge.code}` : bestKey(G.type, G.mode.id, G.diveTime);
      const prev = bests[key];
      const isBest = !prev || result > prev.score;
      if (isBest && result > 0) {
        bests[key] = { score: result, place: place.name, icon: place.icon };
        saveBests();
        Sound.best();
        S.confetti(200);
      }
      $('newBest').classList.toggle('hidden', !(isBest && result > 0));
      $('overTitle').textContent = crashed ? J.crashTitle : J.overTitle;
      $('btnAgain').textContent = J.again;
      const dist = isHaunt() ? fmtM(result) : J.fmt(kmAt(altFor(result)));
      const cp = G.crashPlace;
      $('overReached').innerHTML = crashed ? J.crashLine(`${cp.icon} ${cp.name}`) : J.reachedLine(`${place.icon} ${place.name}`, dist);
      const ba = G.bestAnswer;
      if (isHaunt()) {
        $('overStats').innerHTML = `
        <div class="stat"><div class="s-label">Distance</div><div class="s-value" style="color:var(--accent)">${fmtM(result)}${crashed && G.crashedFrom ? ` <s class="lost">${fmtM(G.crashedFrom)}</s>` : ''}</div></div>
        <div class="stat"><div class="s-label">Survived</div><div class="s-value">${fmtTime(G.chaseT)}</div></div>
        <div class="stat"><div class="s-label">Correct answers</div><div class="s-value">${G.correct}</div></div>
        <div class="stat"><div class="s-label">Closest escape</div><div class="s-value">${G.closest === null ? '—' : G.closest < 10 ? G.closest.toFixed(1) + ' m 😱' : fmtM(G.closest)}</div></div>
        <div class="stat wide"><div class="s-label">Best answer</div><div class="s-value">${ba ? `<span class="tier-${ba.tier}">${escapeHtml(ba.text)}</span> · ${Quiz.TIER_NAMES[ba.tier]} · +${Math.round(ba.metres)} m` : '—'}</div></div>
        <div class="stat wide"><div class="s-label">Mode</div><div class="s-value">${J.name()} · ${G.mode.label}${prev ? ` · previous best ${fmtM(prev.score)}` : ''}</div></div>`;
        el.over.classList.remove('hidden');
        $('btnAgain').focus();
        return;
      }
      $('overStats').innerHTML = `
        <div class="stat"><div class="s-label">${drifts() && !isDive() ? 'Highest score' : 'Score'}</div><div class="s-value" style="color:var(--accent)">${result.toLocaleString()}${crashed && G.crashedFrom ? ` <s class="lost">${G.crashedFrom.toLocaleString()}</s>` : ''}</div></div>
        <div class="stat"><div class="s-label">Correct answers</div><div class="s-value">${G.correct}</div></div>
        <div class="stat"><div class="s-label">Best streak</div><div class="s-value">${G.bestStreak} 🔥</div></div>
        <div class="stat wide"><div class="s-label">Best answer</div><div class="s-value">${ba ? `<span class="tier-${ba.tier}">${escapeHtml(ba.text)}</span> · ${Quiz.TIER_NAMES[ba.tier]} · +${ba.pts.toLocaleString()}` : '—'}</div></div>
        ${G.challenge ? `<div class="stat wide"><div class="s-label">Challenge code</div><div class="s-value"><span class="ch-tag">🎟️ ${G.challenge.code}</span> · everyone with this code got the same questions</div></div>` : ''}
        <div class="stat wide"><div class="s-label">Mode</div><div class="s-value">${J.name(G.diveTime)} · ${G.mode.label}${prev ? ` · previous best ${prev.score.toLocaleString()}` : ''}</div></div>`;
      el.over.classList.remove('hidden');
      $('btnAgain').focus();
    }, crashed ? 300 : 2600);
  }

  // ---- Pause ------------------------------------------------------------
  // Haunted Flight gets one pause per run (switching away from the tab always pauses, for free).
  function pause(auto) {
    if (G.state !== 'question') return;
    if (isHaunt() && auto !== true) {
      if (G.pauseUsed) return;
      G.pauseUsed = true;
      $('btnPause').disabled = true;
    }
    $('pauseText').textContent = isHaunt() ? (G.pauseUsed ? 'The ghost is frozen. That was your one pause for this run.' : 'The ghost is frozen while you\'re away.') : 'The timer is frozen. Take a breath, astronaut.';
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
    if (isDive()) return;
    for (let i = 0; i < G.mode.lives; i++) {
      const c = document.createElement('span');
      c.className = 'cell' + (i >= G.lives ? ' empty' : '') + (lost && i === G.lives ? ' lost' : '');
      el.fuel.appendChild(c);
    }
  }

  function renderPower(hit) {
    el.time.textContent = `${Math.round(G.power)}%`;
    el.timePill.classList.toggle('low', G.power <= 25);
    if (hit) { el.timePill.classList.remove('bump'); void el.timePill.offsetWidth; el.timePill.classList.add('bump'); }
  }

  function renderDiveClock() {
    el.time.textContent = Math.max(0, Math.ceil(G.diveLeft));
    el.timePill.classList.toggle('low', G.diveLeft <= lowAt());
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
    const n = J.stops.length;
    J.stops.forEach((m, i) => {
      const d = document.createElement('div');
      d.className = 'stop';
      d.style.top = trackY(i / (n - 1)) + 'px';
      d.innerHTML = `${m.icon}<span class="stop-name">${m.name}</span>`;
      el.trackStops.appendChild(d);
    });
  }
  // Rocket climbs the track bottom to top; the submarine goes top to bottom.
  const trackY = f => 24 + (J.down ? f : 1 - f) * (856 - 48);

  function trackFrac(alt) {
    const M = J.stops, n = M.length;
    for (let i = 0; i < n - 1; i++) {
      if (alt < M[i + 1].alt) return (i + (alt - M[i].alt) / (M[i + 1].alt - M[i].alt)) / (n - 1);
    }
    return 1;
  }

  let lastHudAlt = -1;
  function updateHud(dt) {
    G.shown += (G.score - G.shown) * Math.min(1, dt * 5);
    if (Math.abs(G.score - G.shown) < 0.5) G.shown = G.score;
    el.score.textContent = Math.round(G.shown).toLocaleString() + (J.unit || '');
    if (isHaunt()) { renderChase(); return; }
    const alt = S.alt;
    if (Math.abs(alt - lastHudAlt) > 0.01 || dt === 0) {
      lastHudAlt = alt;
      el.alt.textContent = J.fmt(kmAt(alt));
      const f = trackFrac(alt);
      el.trackFill.style.height = (f * 100) + '%';
      el.trackRocket.style.top = trackY(f) + 'px';
      const stops = el.trackStops.children;
      const nxt = nextByAlt(alt);
      for (let i = 0; i < stops.length; i++) {
        stops[i].classList.toggle('reached', J.stops[i].alt <= alt);
        stops[i].classList.toggle('next', J.stops[i] === nxt);
      }
    }
    const np = nextPlace(G.score);
    const drift = drifts() && G.state === 'question' && G.score > 0;
    el.alt.parentElement.classList.toggle('drifting', !!drift);
    if (drift) { el.next.textContent = `${J.driftText || (J.down ? '⬆️ Floating up' : Scene.chute > 0.5 && S === Scene ? '🪂 Parachute!' : '⬇️ Falling')} ${Math.round(driftRate()).toLocaleString()} pts/s — answer!`; return; }
    el.next.textContent = np ? `Next stop: ${np.icon} ${np.name} · ${Math.ceil(np.pts - G.score).toLocaleString()} pts` : J.endless;
  }

  // Haunted Flight: the ghost meter on the card, the HUD pills and the skip price, all from the gap.
  function renderChase() {
    const g = Math.max(0, G.gap), lvl = g < HAUNT.close ? 'danger' : g < HAUNT.danger ? 'near' : 'safe';
    el.alt.textContent = fmtM(g);
    el.alt.parentElement.dataset.chase = lvl;
    const np = nextPlace(G.score);
    el.next.textContent = np ? `Next: ${np.icon} ${np.name} · ${fmtM(np.pts - G.score)}` : J.endless;
    el.time.textContent = fmtTime(G.chaseT);
    el.timerFill.style.width = (g / HAUNT.max * 100) + '%';
    el.timerFill.style.background = { safe: '#7ddc6f', near: '#ffb02e', danger: '#ff5d73' }[lvl];
    el.timer.classList.toggle('low', lvl === 'danger');
    el.speed.textContent = `👻 The ghost is ${fmtM(g)} behind you`;
    el.speed.className = 'speed-badge chase-' + lvl;
    el.timerSecs.textContent = `closing at ${HAUNT.speed(G.chaseT).toFixed(1)} m/s`;
    const cost = HAUNT.skipCost(G.chaseT);
    el.skipCount.textContent = `👻 +${cost} m`;
    el.skip.title = cost >= g ? 'Skipping now lets the ghost catch you!' : `Skipping lets the ghost ${cost} m closer`;
    el.skip.classList.toggle('risky', G.state === 'question' && cost >= g);
  }

  function updateTimer() {
    if (isHaunt()) return renderChase();
    const sp = speedMult();
    if (isDive()) {
      el.timerFill.style.width = (Math.max(0, G.diveLeft / G.diveTime) * 100) + '%';
      el.timerSecs.textContent = `${Math.max(0, Math.ceil(G.diveLeft))}${J.leftText}`;
      el.timer.classList.toggle('low', G.diveLeft <= lowAt());
    } else {
      el.timerFill.style.width = (Math.max(0, G.timeLeft / G.mode.time) * 100) + '%';
      el.timerSecs.textContent = Math.ceil(G.timeLeft) + 's';
      el.timer.classList.toggle('low', G.timeLeft <= 5);
    }
    el.speed.textContent = sp === 2 ? '⚡ ×2 speed bonus' : sp === 1.5 ? '⚡ ×1.5 speed bonus' : 'No speed bonus';
    el.speed.className = 'speed-badge' + (sp === 2 ? '' : sp === 1.5 ? ' x15' : ' x1');
  }

  // ---- Popups and banners --------------------------------------------
  function popup(big, label, tier, tags, miss) {
    const d = document.createElement('div');
    d.className = 'popup' + (tier === 5 ? ' legendary' : '') + (miss ? ' miss' : '');
    d.style.left = '760px';
    d.style.top = isDive() ? '430px' : '380px';
    if (isDive()) d.style.left = '600px';
    if (isHaunt()) { d.style.left = '1000px'; d.style.top = '120px'; }
    const col = ['#ff5d73', 'var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)', 'var(--t5)'][tier];
    d.innerHTML = `<div class="pts" style="color:${col}">${big}</div>` +
      `<div class="rarity" style="color:${col}">${label.toUpperCase()}</div>` +
      (tags.length ? `<div class="tags">${tags.map(([t, c]) => `<span class="tag" style="color:${c}">${t}</span>`).join('')}</div>` : '');
    el.popups.appendChild(d);
    setTimeout(() => d.remove(), 2400);
  }

  function milestone(m) {
    if (G.state === 'title' || G.state === 'over') return;
    if (G.reached.has(m.name)) return;   // in Ultra you can pass a stop more than once
    G.reached.add(m.name);
    Sound.milestone();
    S.confetti(m.body ? 160 : 70);
    el.banner.classList.remove('hidden');
    el.banner.classList.toggle('dive', isDive());
    el.banner.innerHTML = `<span class="b-icon">${m.icon}</span><div class="b-small">${J.reached}</div><div class="b-name">${m.name}</div><div class="b-dist">${J.fmt(m.km)} ${J.from}</div>`;
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
    // Check the scene itself, not G.type: on the title screen G.type is whatever the last game was.
    Scene.setChute(S === Scene && !!(G.mode && G.mode.drift) && G.state !== 'title');
    if (S === ElevScene) ElevScene.setPower(G.state === 'title' || G.type !== 'elev' ? 1 : G.power / 100);
    if (S === HauntScene) {
      HauntScene.setTitle(G.state === 'title');
      if (G.state !== 'title' && isHaunt()) { HauntScene.setGap(G.gap); HauntScene.setTarget(G.dist); }
    }
    if (G.state !== 'paused') S.update(dt);
    S.draw();
    if (G.state !== 'title') updateHud(dt);
    if (drifts() && G.state === 'question' && G.score > 0) {
      G.score = Math.max(0, G.score - driftRate() * dt);
      S.setTarget(altFor(G.score));
    }
    if (G.state === 'crashing') {
      if (S.crashBoom && !G.boomed) { G.boomed = true; if (J.id === 'sub') Sound.splash(); else Sound.boom(); }
      if (S.crashDone) gameOver();
    } else if (isDive() && (G.state === 'question' || G.state === 'reveal')) {
      // One clock for the whole dive. It runs during the short reveals too.
      G.diveLeft -= dt;
      if (G.state === 'question') G.qElapsed += dt;
      const s = Math.ceil(G.diveLeft);
      if (s < G.lastTick) { G.lastTick = s; if (s <= lowAt() && s > 0) Sound.tick(s <= lowAt() / 2); }
      renderDiveClock();
      updateTimer();
      if (G.diveLeft <= 0) { G.diveLeft = 0; renderDiveClock(); updateTimer(); gameOver(); }
    } else if (isHaunt()) {
      // The chase only runs while a question is up: countdowns and answer reveals don't cost you.
      if (G.state === 'question') {
        G.chaseT += dt;
        G.gap -= HAUNT.speed(G.chaseT) * dt;
        G.dist += HAUNT.cruise * dt;
        G.score = Math.floor(G.dist);
        G.peak = G.score;
        if (G.gap < HAUNT.danger) {
          G.beatT -= dt;
          if (G.beatT <= 0) {
            const p = 1 - Math.max(0, G.gap) / HAUNT.danger;
            Sound.heartbeat(p); S.beat();
            G.beatT = 1.15 - 0.8 * p;   // the heart beats faster as it gets closer
          }
        } else G.beatT = 0;
        if (G.gap <= 0) { G.gap = 0; gameOver(); }
      }
    } else if (G.state === 'question') {
      G.timeLeft -= dt;
      const s = Math.ceil(G.timeLeft);
      if (s < G.lastTick) { G.lastTick = s; if (s <= 5 && s > 0) Sound.tick(s <= 3); }
      updateTimer();
      if (G.timeLeft <= 0) { G.timeLeft = 0; updateTimer(); timeout(); }
    }
    requestAnimationFrame(frame);
  }

  // ---- Play With Friends codes ----------------------------------------------
  const ch = {
    input: $('chInput'), preview: $('chPreview'), join: $('chJoin'),
    code: $('chCode'), copy: $('chCopy'), make: $('chMake'), play: $('chPlayMine'),
    host: { len: 60, mode: 'medium' }, made: null
  };
  const describe = c => `⛏️ ${MODES[c.mode].label} · ${c.len}-second drill`;

  function renderHost() {
    const mark = (sel, on) => document.querySelectorAll(sel).forEach(b => {
      const a = on(b); b.classList.toggle('active', a); b.setAttribute('aria-pressed', a ? 'true' : 'false');
    });
    mark('#chLen button', b => +b.dataset.len === ch.host.len);
    mark('#chMode button', b => b.dataset.mode === ch.host.mode);
    // A code you made stays until you change a setting, so you never share one that doesn't match.
    if (ch.made && (ch.made.mode !== ch.host.mode || ch.made.len !== ch.host.len)) ch.made = null;
    ch.code.textContent = ch.made ? ch.made.code : '— — — —';
    ch.code.classList.toggle('empty', !ch.made);
    ch.copy.disabled = !ch.made; ch.copy.textContent = '📋 Copy';
    ch.play.disabled = !ch.made;
    ch.make.textContent = ch.made ? '🎲 New code' : '🎲 Make a code';
  }
  function checkInput() {
    const raw = ch.input.value.replace(/[^0-9a-z]/gi, '');
    const say = (cls, text) => { ch.preview.className = 'ch-preview' + (cls ? ' ' + cls : ''); ch.preview.textContent = text; };
    ch.join.disabled = true;
    if (!raw) { say('', 'Type the code a friend sent you.'); return null; }
    if (raw.length < 8) { say('', `${raw.length} of 8 characters…`); return null; }
    const d = Challenge.decode(raw);
    if (d.error) { say('bad', d.error); return null; }
    say('ok', `✅ ${describe(d)}`);
    ch.join.disabled = false;
    return d;
  }

  ch.input.addEventListener('input', checkInput);
  $('chJoinForm').addEventListener('submit', e => {
    e.preventDefault();
    const d = checkInput();
    if (d) { Sound.click(); start(d.mode, d); }
  });
  document.querySelectorAll('#chLen button').forEach(b => b.addEventListener('click', () => { Sound.click(); ch.host.len = +b.dataset.len; renderHost(); }));
  document.querySelectorAll('#chMode button').forEach(b => b.addEventListener('click', () => { Sound.click(); ch.host.mode = b.dataset.mode; renderHost(); }));
  ch.make.addEventListener('click', () => {
    Sound.click();
    ch.made = Challenge.decode(Challenge.encode({ ...ch.host, seed: Challenge.newSeed() }));
    renderHost();
  });
  const selectCode = () => { const r = document.createRange(); r.selectNodeContents(ch.code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); };
  ch.copy.addEventListener('click', () => {
    if (!ch.made) return;
    const done = ok => { ch.copy.textContent = ok ? '✅ Copied' : '⌨️ Ctrl+C'; };
    try { navigator.clipboard.writeText(ch.made.code).then(() => done(true), () => { selectCode(); done(false); }); }
    catch (e) { selectCode(); done(false); }
  });
  ch.play.addEventListener('click', () => { if (ch.made) { Sound.click(); start(ch.made.mode, ch.made); } });

  // ---- Wiring -----------------------------------------------------------
  Scene.init($('scene'));
  SubScene.init($('scene'));
  DrillScene.init($('scene'));
  ElevScene.init($('scene'));
  HauntScene.init($('scene'));
  Scene.onMilestone(m => { if (S === Scene) milestone(m); });
  SubScene.onMilestone(m => { if (S === SubScene) milestone(m); });
  DrillScene.onMilestone(m => { if (S === DrillScene) milestone(m); });
  ElevScene.onMilestone(m => { if (S === ElevScene) milestone(m); });
  HauntScene.onMilestone(m => { if (S === HauntScene) milestone(m); });
  fit();
  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);

  document.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => { if (b.dataset.type === J.id) return; Sound.click(); setType(b.dataset.type, true); }));
  window.addEventListener('resize', () => moveGlider(false));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveGlider(false));
  document.querySelectorAll('.mode-card:not(.mode-ultra)').forEach(b => b.addEventListener('click', () => { Sound.click(); chooseMode(b, b.dataset.mode); }));
  tp.box.querySelectorAll('.tp-len').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    Sound.click();
    diveLen = +b.dataset.len;
    try { localStorage.setItem('brainRocket.dive', diveLen); } catch (err) { /* ignore */ }
    const mode = tp.mode;
    closeTimePick();
    start(mode);
  }));
  $('tpClose').addEventListener('click', e => { e.stopPropagation(); Sound.click(); closeTimePick(); });
  tp.box.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', e => { if (timePickOpen() && !e.target.closest('.mode-card')) closeTimePick(); });
  // The Ultra card opens to show its three question difficulties.
  const ultra = document.querySelector('.mode-ultra');
  const toggleUltra = open => {
    ultra.classList.toggle('open', open);
    ultra.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  ultra.addEventListener('click', e => {
    const pick = e.target.closest('.ultra-pick');
    Sound.click();
    if (pick) chooseMode(ultra, pick.dataset.mode);
    else toggleUltra(!ultra.classList.contains('open'));
  });
  ultra.addEventListener('keydown', e => {
    if (e.target === ultra && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggleUltra(!ultra.classList.contains('open'));
      if (ultra.classList.contains('open')) ultra.querySelector('.ultra-pick').focus();
    }
  });
  el.form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  el.skip.addEventListener('click', skip);
  el.hintBtn.addEventListener('click', hint);
  $('btnPause').addEventListener('click', pause);
  $('btnResume').addEventListener('click', resume);
  $('btnQuit').addEventListener('click', showTitle);
  $('btnAgain').addEventListener('click', () => start(G.mode.id, G.challenge));
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
      if (G.state === 'title' && timePickOpen()) { closeTimePick(); return; }
      if (G.state === 'question') pause();
      else if (G.state === 'paused') resume();
      return;
    }
    if (G.state === 'question' && document.activeElement !== el.input && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      el.input.focus();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

  showTitle();
  requestAnimationFrame(frame);
})();
