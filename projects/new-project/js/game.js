/* Apples to Oranges — the game: the mode picker, the four ways to play, the reveal, scoring and bests.
 *
 *   classic  🎈 Higher or lower. The hot-air balloon climbs with every right answer.
 *   size     🐉 Real Size. Two measurements in different units: which is really bigger? A dragon ride.
 *   guess    🐿️ Guess the Number. One card at a time; the squirrel climbs a tree that never ends.
 *   haunt    🎃 Halloween (limited time). Higher or lower while a ghost chases the jack-o'-lantern balloon.
 */
'use strict';

(function () {
  const $ = id => document.getElementById(id);

  // ---- The modes --------------------------------------------------------------------------
  // The Halloween event ends once November 1, 2026 is over, in the player's own time zone.
  const HAUNT_ENDS = new Date(2026, 10, 2);
  const EVENT_ON = Date.now() < HAUNT_ENDS.getTime();

  const BASE_DIFFS = {
    // mult: the points multiplier. push: how much harder a right answer shoves the Halloween ghost back.
    owen:   { name: 'Owen (Easy)', time: 15, lives: 3, mult: 1,    push: 1 },
    medium: { name: 'Medium',      time: 10, lives: 2, mult: 1.25, push: 1.5 },
    hard:   { name: 'Hard',        time: 7,  lives: 1, mult: 1.5,  push: 2 },
    ultra:  { name: 'Ultra',       time: 5,  lives: 1, mult: 1.75, push: 2.5 }
  };
  const GUESS_TIME = { owen: 20, medium: 20, hard: 20, ultra: 15 };
  // Halloween: how far the ghost lunges on a wrong answer, by difficulty (metres)
  const LUNGE = { owen: 25, medium: 30, hard: 35, ultra: 40 };
  // Ultra: how far the ghost's own surprise lunge jumps (metres)
  const ULTRA_LUNGE = 20;
  // Halloween: how far a right answer pushes you ahead before the difficulty and streak (Common to Legendary)
  const PUSH = [8, 16, 27, 46, 77];

  const TYPES = {
    classic: {
      world: 'classic', icons: { medium: '🍎', hard: '🍊' }, lifeIcon: '🎈', lifeName: 'Lives',
      tagline: 'Two totally unrelated numbers. Is the next one <b>higher</b> or <b>lower</b>?<br>Every right answer lifts your balloon higher into the sky.',
      rules: [
        '<b>🍎🍊 Apples to oranges.</b> A blue whale against Jersey Mike’s. Ignore the units: just say if the number on the right is higher or lower.',
        '<b>🎯 Close calls pay.</b> The closer the two numbers, the more it’s worth: Common 10 up to Legendary 200.',
        '<b>📸 Photo finish!</b> Sometimes they’re only 1 apart, or exactly the same. Within 5%? A <b>Tie!</b> button appears, but it’s only right on an exact tie.',
        '<b>🔥 Keep a streak.</b> Each right answer in a row adds ×0.25, up to ×5. Pick in the first quarter of the timer for ×2.'
      ],
      info: {
        owen: '15s per pick · 3 lives<br>numbers 1.6× to 8× apart',
        medium: '10s per pick · 2 lives<br>closer numbers',
        hard: '7s per pick · 1 life<br>really close numbers',
        ultra: '5s per pick · 1 life<br>always within 10'
      }
    },
    size: {
      world: 'size', icons: { medium: '🔥', hard: '🐉' }, lifeIcon: '🔥', lifeName: 'Fire',
      tagline: 'Two lengths, both in centimeters. Which one is <b>bigger</b>?<br>Every right answer lifts your dragon higher.',
      rules: [
        '<b>📏 Everything in centimeters.</b> Heights, lengths and distances, every one measured in cm. Pick the one that’s bigger.',
        '<b>🔢 Big numbers.</b> A mountain or a road trip in centimeters gets huge, so read every digit.',
        '<b>🎯 Close calls pay.</b> The closer the real sizes, the more it’s worth: within 10% is Legendary. Within 5%? A <b>Tie!</b> button appears, but it’s only right if they’re exactly equal.',
        '<b>🔥 Keep a streak.</b> Each right answer in a row adds ×0.25, up to ×5. Pick in the first quarter of the timer for ×2.'
      ],
      info: {
        owen: '15s per pick · 3 lives<br>sizes 2× apart or more',
        medium: '10s per pick · 2 lives<br>sizes 1.4× to 4× apart',
        hard: '7s per pick · 1 life<br>within 2×',
        ultra: '5s per pick · 1 life<br>within 25%'
      }
    },
    guess: {
      world: 'guess', icons: { medium: '🌰', hard: '🐿️' }, lifeIcon: '🌰', lifeName: 'Acorns',
      tagline: 'One number at a time. <b>How close can you guess it?</b><br>Every good guess sends your squirrel up a tree that never ends.',
      rules: [
        '<b>🎯 Get close.</b> Within 1% is a Bullseye (200). Within 5%, 10%, 25% and 50% still score. Years count in years off.',
        '<b>🌰 Mind your acorns.</b> A guess more than 50% off (or out of time) drops an acorn. No acorns left, no more climbing.',
        '<b>🐿️ Owen, Medium, Hard.</b> Owen picks from four answers, Medium slides, Hard and Ultra type the number.',
        '<b>🔥 Keep a streak.</b> Each scoring guess in a row adds ×0.25, up to ×5. Answer in the first quarter of the timer for ×2.'
      ],
      info: {
        owen: 'pick from 4 answers<br>20s · 3 acorns',
        medium: 'slide to your guess<br>20s · 2 acorns',
        hard: 'type the number<br>20s · 1 acorn',
        ultra: 'type it, within 5%<br>15s · 1 acorn'
      }
    },
    haunt: {
      world: 'haunt', icons: { medium: '🎃', hard: '👻' },
      tagline: '🎃 Limited time! A ghost is chasing your balloon. Every right answer<br>blasts you ahead. How far can you get?',
      rules: [
        '<b>👻 Outrun the ghost.</b> It closes in while you think, and slowly speeds up. Closer calls push it further back.',
        '<b>🎃 Halloween facts.</b> Every matchup has one: candy, spooky movies, monsters, pumpkins and more. Within 5%? A <b>Tie!</b> button appears, but it’s only right on an exact tie.',
        '<b>💥 Wrong answers hurt.</b> The ghost lunges closer: 25 m on Owen, 30 on Medium, 35 on Hard, 40 on Ultra.',
        '<b>🔥 Keep a streak.</b> Each right answer in a row pushes harder. No timer and no lives: just get as far as you can.'
      ],
      info: {
        owen: '+8 m to +77 m per answer<br>wrong: it lunges 25 m',
        medium: '+12 m to +115 m per answer<br>wrong: it lunges 30 m',
        hard: '+16 m to +154 m per answer<br>wrong: it lunges 35 m',
        ultra: 'within 10 · never pauses<br>and it lunges on its own!'
      }
    }
  };
  const TYPE_ORDER = ['classic', 'size', 'guess', 'haunt'].filter(t => t !== 'haunt' || EVENT_ON);

  // ---- The maps ------------------------------------------------------------------------
  // Each mode's 20 locations are in js/map.js. Your score is where you are on the map: the 20th
  // location is at 50,000 points, the target, and reaching it starts infinite mode.
  const placeName = (t, score) => { const p = mapPlace(t, score); return `${p.stop.ic} ${p.stop.name}`; };

  // (Checked before anything below writes to storage.) A brand-new browser (nothing saved yet) gets the game's signature matchup as its very first
  // Classic question: Jersey Mike's in New Jersey against a blue whale's weight in tons.
  let firstMatchup = false;
  try { firstMatchup = !['a2o.best2', 'a2o.best', 'a2o.type', 'a2o.firstMatch'].some(k => localStorage.getItem(k)); } catch (e) { /* storage blocked */ }

  // ---- Saving (best scores, and the last tab) ----------------------------------------------
  // best[type][difficulty]: the best score
  const best = { classic: {}, size: {}, guess: {}, haunt: {} };
  try {
    Object.assign(best, JSON.parse(localStorage.getItem('a2o.best2') || '{}'));
    const old = JSON.parse(localStorage.getItem('a2o.best') || 'null');   // bests from before there were modes
    if (old && !Object.keys(best.classic).length) best.classic = old;
    // Halloween bests used to be metres flown; now every mode keeps its best score
    if (!localStorage.getItem('a2o.hauntScore')) { best.haunt = {}; localStorage.setItem('a2o.hauntScore', '1'); localStorage.setItem('a2o.best2', JSON.stringify(best)); }
  } catch (e) { /* storage blocked */ }
  function saveBest() { try { localStorage.setItem('a2o.best2', JSON.stringify(best)); } catch (e) { /* ignore */ } }
  let type = 'classic';
  try { const t = localStorage.getItem('a2o.type'); if (TYPE_ORDER.includes(t)) type = t; } catch (e) { /* ignore */ }

  // ---- Formatting ----------------------------------------------------------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const commas = n => Math.round(n).toLocaleString('en-US');
  const decimalsOf = n => (String(n).split('.')[1] || '').length;
  const fmtNum = (v, dec) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const numText = f => f.show || (f.year ? String(f.n) : fmtNum(f.n, decimalsOf(f.n)));
  const withUnit = f => numText(f) + (f.u ? ' ' + f.u : '');
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // a guess or slider value, rounded to something readable
  function niceVal(v, card) {
    if (card.year) return Math.round(v);
    if (v >= 1000) { const p = Math.pow(10, Math.floor(Math.log10(v)) - 2); return Math.round(v / p) * p; }
    if (v >= 100) return Math.round(v);
    if (v >= 10) return Math.round(v * 10) / 10;
    return Math.round(v * 100) / 100;
  }
  const valText = (v, card) => (card.year ? String(Math.round(v)) : fmtNum(v, decimalsOf(v)));

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
    placeGlider(true);
  }
  window.addEventListener('resize', fit);

  // ---- Sound and music ---------------------------------------------------------
  function syncSoundButtons() {
    const m = Sound.isMuted();
    $('btnSound').textContent = m ? '🔇' : '🔊';
    $('btnPauseSound').textContent = m ? '🔇 Sound off' : '🔊 Sound on';
    const on = Sound.musicEnabled();
    $('btnMusic').classList.toggle('off', !on);
    $('btnPauseMusic').textContent = on ? '🎵 Music on' : '🎵 Music off';
  }
  function toggleSound() { Sound.setMuted(!Sound.isMuted()); syncSoundButtons(); Sound.click(); }
  // Every mode has its own tune. Classic switches to the dreamy Sky tune once you reach the clouds.
  const trackNow = () => {
    if (type === 'size') return 'dragon';
    if (type === 'guess') return 'forest';
    if (type === 'haunt') return 'spooky';
    return G && mapPlace('classic', G.score).i >= 6 ? 'sky' : 'breeze';
  };
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

  // ---- Home: the mode picker -------------------------------------------------------------
  function placeGlider(instant) {
    const btn = document.querySelector(`.type-btn[data-type="${type}"]`), gl = $('typeGlider');
    if (!btn || !gl) return;
    gl.classList.toggle('instant', !!instant);
    gl.style.width = btn.offsetWidth + 'px';
    gl.style.transform = `translateX(${btn.offsetLeft}px)`;
    if (instant) { void gl.offsetWidth; gl.classList.remove('instant'); }
  }
  function bestText(t, diff) {
    const b = best[t][diff];
    if (!b) return t === 'haunt' ? 'Not flown yet' : t === 'guess' ? 'Not climbed yet' : 'Not flown yet';
    return 'Best: ' + commas(b);
  }
  function showModeCards() {
    const T = TYPES[type];
    document.querySelectorAll('.mode').forEach(c => {
      const d = c.dataset.diff;
      c.querySelector('.mode-desc').innerHTML = T.info[d];
      // Owen 🧒 and Ultra 💀 stay the same everywhere; Medium and Hard wear the mode's own emoji
      if (T.icons[d]) c.querySelector('.mode-ic').textContent = T.icons[d];
      c.querySelector('.mode-best').textContent = bestText(type, d);
    });
  }
  function rulesHTML() { return TYPES[type].rules.map(r => `<div>${r}</div>`).join(''); }
  // Switching tabs: the highlight glides over, the world slides across in the same direction,
  // and the rules box blurs, changes its text while it's blurred, then sharpens.
  function setType(t, animate) {
    const from = TYPE_ORDER.indexOf(type), to = TYPE_ORDER.indexOf(t);
    type = t;
    try { localStorage.setItem('a2o.type', t); } catch (e) { /* ignore */ }
    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === t);
      b.setAttribute('aria-pressed', b.dataset.type === t ? 'true' : 'false');
    });
    placeGlider(!animate);
    Scene.setWorld(TYPES[t].world, animate && from !== to ? (to > from ? 1 : -1) : 0);
    if (t === 'haunt') Scene.chase({ gap: 26, dist: 0, score: 0, play: false, reset: true });
    $('tagline').innerHTML = `<span>${TYPES[t].tagline}</span>`;
    showModeCards();
    const rules = $('rules');
    if (animate && from !== to) {
      rules.classList.add('switching');
      clearTimeout(setType.t1); clearTimeout(setType.t2);
      setType.t1 = setTimeout(() => { rules.innerHTML = rulesHTML(); setType.t2 = setTimeout(() => rules.classList.remove('switching'), 40); }, 270);
    } else rules.innerHTML = rulesHTML();
    if (musicStarted) Sound.music(trackNow());
  }

  function goHome() {
    G = null;
    $('game').classList.add('hidden'); $('over').classList.add('hidden'); $('pause').classList.add('hidden');
    $('home').classList.remove('hidden');
    Scene.setAlt(0);
    if (type === 'haunt') Scene.chase({ play: false, gap: 26, warn: 0, score: 0 });
    showModeCards();
    placeGlider(true);
    Sound.musicLevel(1);
    if (musicStarted) Sound.music(trackNow());
  }

  // ---- A run ----------------------------------------------------------------
  let G = null;

  function start(diff) {
    const replay = !!G;              // Play again, straight from the results
    Sound.unlock(); Sound.click();
    startMusic();
    Sound.musicLevel(1);
    const base = BASE_DIFFS[diff];
    const d = Object.assign({}, base, type === 'guess' ? { time: GUESS_TIME[diff] } : {});
    G = {
      type, diff, d, score: 0, scoreSeen: 0, lives: d.lives, streak: 0, bestStreak: 0, right: 0, asked: 0,
      photoWon: 0, photoLost: 0, traps: 0, bullseyes: 0, used: new Set(), pstate: { pendingPhoto: false },
      left: null, right_: null, card: null, timeLeft: d.time, phase: 'ask', paused: false, killer: null,
      // Halloween chase
      gap: 60, dist: 0, qtime: 0, survived: 0, closest: Infinity, pausesLeft: 1, lungeIn: 8 + Math.random() * 5, warn: 0, dodged: 0, beatIn: 0
    };
    $('home').classList.add('hidden'); $('over').classList.add('hidden');
    $('game').classList.remove('hidden');
    // Back to the start the same way going home does: the world glides back down (or, on Halloween,
    // scrolls back) while the new run begins.
    Scene.setAlt(0);
    setupPanel();
    buildRail();
    renderLives();
    if (type === 'guess') {
      G.card = Pairs.nextGuess(G.used);
    } else if (type === 'size') {
      G.left = Pairs.firstSize(diff); G.used.add(G.left.id);
      G.right_ = Pairs.nextSize(G.left, diff, G.used); G.used.add(G.right_.id);
    } else {
      const sig = firstMatchup && type === 'classic' && [CARDS.find(c => c.id === 'jerseymikes'), CARDS.find(c => c.id === 'whale@ton')];
      if (sig && sig[0] && sig[1]) {
        firstMatchup = false;
        try { localStorage.setItem('a2o.firstMatch', '1'); } catch (e) { /* ignore */ }
        G.left = sig[0]; G.right_ = sig[1];
      } else {
        G.left = Pairs.first(diff, type); G.right_ = Pairs.next(G.left, diff, G.used, G.pstate, type);
      }
      G.used.add(G.left.id); G.used.add(G.right_.id);
    }
    if (type === 'haunt') Scene.chase({ gap: 60, dist: 0, score: 0, play: true, warn: 0, reset: !replay, rewind: replay });
    updateHud();
    if (type === 'guess') renderGuess(); else renderCards(true);
    newRound();
    Sound.music(trackNow());
  }

  // The panel changes shape with the mode: two cards, one card and an answer box, or the Halloween strip.
  function setupPanel() {
    const p = $('panel');
    p.classList.toggle('strip', type === 'haunt');
    $('cardsRow').classList.toggle('hidden', type === 'guess');
    $('guessWrap').classList.toggle('hidden', type !== 'guess');
    $('timerRow').classList.toggle('hidden', type === 'haunt');
    $('chaseRow').classList.toggle('hidden', type !== 'haunt');
    $('rail').classList.toggle('hidden', type === 'haunt');
    $('livesPill').classList.toggle('hidden', type === 'haunt');
    $('timePill').classList.toggle('hidden', type !== 'haunt');
    $('hudScoreLabel').textContent = 'Score';
    $('hudAltLabel').textContent = type === 'haunt' ? 'Ghost behind' : 'Location';
    $('hudAlt').className = 'pill-value' + (type === 'haunt' ? '' : ' loc');
    $('hudLivesLabel').textContent = TYPES[type].lifeName || 'Lives';
    $('prompt').innerHTML = type === 'size' ? 'Is the right one <b class="hi-word">bigger</b> or <b class="lo-word">smaller</b>?'
      : type === 'guess' ? 'What’s the <b class="hi-word">number</b>?'
      : 'Is the right one <b class="hi-word">higher</b> or <b class="lo-word">lower</b>?';
    $('legend').innerHTML = type === 'guess'
      ? '<span>How close you get:</span><span class="t1">● 50% · 10</span><span class="t2">● 25% · 25</span><span class="t3">● 10% · 50</span><span class="t4">● 5% · 100</span><span class="t5">● 1% · Bullseye 200</span>'
      : type === 'haunt'
        ? `<span>Pushes the ghost back:</span>${Pairs.TIERS.map((T, i) => `<span class="${T.cls}">● ${T.name} +${Math.round(PUSH[i] * G.d.push)} m</span>`).join('')}`
        : `<span>${type === 'size' ? 'Closer sizes' : 'Closer numbers'} score more:</span><span class="t1">● Common 10</span><span class="t2">● Uncommon 25</span><span class="t3">● Rare 50</span><span class="t4">● Epic 100</span><span class="t5">● Legendary 200</span>`;
  }

  function newRound() {
    G.asked++;
    G.phase = 'ask';
    G.timeLeft = G.d.time;
    $('qcount').textContent = (type === 'guess' ? 'Number ' : 'Matchup ') + G.asked;
    $('result').className = 'result';
    $('resultQuip').textContent = ''; $('resultLine').textContent = ''; $('resultPts').textContent = '';
    $('photoBanner').classList.add('hidden');
    $('photoBanner').classList.remove('tie'); $('photoBanner').textContent = '📸 PHOTO FINISH';
    $('panel').classList.remove('tie-party');
    if (type === 'guess') focusField();
  }

  // Tie! only shows up when the two are within 5% of each other (real sizes in Real Size), and it's only
  // right on an exact tie.
  const tieable = (L, R) => (type === 'size' ? Pairs.realRatio(L, R) : Pairs.ratio(L, R)) <= 1.05;
  const isExactTie = (L, R) => (type === 'size' ? Math.abs(L.real - R.real) <= 1e-9 * Math.max(L.real, R.real) : L.n === R.n);

  function cardHTML(f, hidden, inline) {
    const cat = CATS[f.c];
    const t = cap(f.t), num = numText(f);
    const lbl = type === 'size' ? ['▲ Bigger', '▼ Smaller'] : ['▲ Higher', '▼ Lower'];
    return `<div class="chip"><span class="chip-ic">${cat.icon}</span>${esc(cat.name)}</div>
      <div class="ctext" style="font-size:${textSize(t)}px">${esc(t)}</div>
      <div class="cnum${hidden ? ' hidden-num' : ''}" style="font-size:${numSize(num)}px">${hidden ? '?' : esc(num)}</div>
      <div class="cunit">${esc(f.u)}</div>
      ${type === 'size' ? '<div class="cconv"></div>' : ''}
      <div class="cnote">${hidden ? '' : esc(f.note || '')}</div>
      ${hidden && inline ? `<div class="choices">
        <button class="btn-hi" type="button" data-g="higher">${lbl[0]}</button>
        ${G.tieShown ? '<button class="btn-tie" type="button" data-g="tie">Tie!</button>' : ''}
        <button class="btn-lo" type="button" data-g="lower">${lbl[1]}</button>
      </div>` : ''}`;
  }

  function renderCards(first) {
    const L = $('cardL'), R = $('cardR');
    const strip = type === 'haunt';
    G.tieShown = tieable(G.left, G.right_);
    L.className = 'card card-l'; R.className = 'card card-r' + (first ? '' : ' in');
    L.innerHTML = cardHTML(G.left, false, !strip);
    R.innerHTML = cardHTML(G.right_, true, !strip);
    R.style.setProperty('--shift', (L.offsetLeft - R.offsetLeft) + 'px');
    const sc = $('stripChoices');
    sc.className = 'strip-choices';
    sc.innerHTML = strip ? '<button class="btn-hi" type="button" data-g="higher">▲ Higher</button>' + (G.tieShown ? '<button class="btn-tie" type="button" data-g="tie">Tie!</button>' : '') + '<button class="btn-lo" type="button" data-g="lower">▼ Lower</button>' : '';
    document.querySelectorAll('#cardR [data-g], #stripChoices [data-g]').forEach(b => b.addEventListener('click', () => pick(b.dataset.g)));
  }

  // ---- HUD -----------------------------------------------------------------
  function buildRail() {
    const S = MAPS[type].stops;
    $('rail').classList.remove('infinite');
    $('rail').innerHTML = S.slice().reverse().map((s, i) =>
      `<div class="rail-stop" data-i="${S.length - 1 - i}" title="${esc(s.name)} · ${commas(s.at)}">${s.ic}</div>`).join('');
  }
  function renderLives() {
    if (type === 'haunt') return;
    $('hudLives').innerHTML = Array.from({ length: G.d.lives }, (_, i) => `<span class="${i < G.lives ? '' : 'gone'}">${TYPES[type].lifeIcon}</span>`).join('');
  }
  function updateHud() {
    $('hudStreak').textContent = G.streak;
    $('hudMult').textContent = 'next ×' + Math.min(5, 1 + 0.25 * G.streak).toFixed(2);
    const sp = $('streakPill');
    sp.classList.toggle('hot', G.streak >= 3);
    sp.classList.toggle('blazing', G.streak >= 8);
    if (type === 'haunt') { updateChaseHud(); return; }
    const S = MAPS[type].stops;
    $('hudScore').textContent = commas(G.score);
    $('hudAlt').textContent = placeName(type, G.score);
    const next = S.find(s => s.at > G.score);
    $('hudNext').textContent = next ? `Next: ${next.ic} ${next.name} at ${commas(next.at)}`
      : `♾️ Infinite mode · ${commas(G.score - MAP_TARGET)} past the target`;
    document.querySelectorAll('.rail-stop').forEach(el => {
      const i = +el.dataset.i;
      el.classList.toggle('done', S[i].at <= G.score);
      el.classList.toggle('next', next === S[i]);
    });
    $('rail').classList.toggle('infinite', G.score >= MAP_TARGET);
  }
  function updateChaseHud() {
    const gap = Math.max(0, G.gap);
    $('hudScore').textContent = commas(G.score);
    const alt = $('hudAlt');
    alt.textContent = Math.round(gap) + ' m';
    alt.className = 'pill-value ' + (gap > 60 ? 'danger-ok' : gap > 30 ? 'danger-mid' : 'danger-high');
    const next = MAPS.haunt.stops.find(s => s.at > G.score);
    $('hudNext').textContent = placeName('haunt', G.score) + (next ? ` · next ${next.ic} at ${commas(next.at)}` : ' · ♾️ infinite mode');
    $('hudTime').textContent = fmtTime(G.survived);
    const fill = $('chaseFill');
    fill.style.width = clamp(gap / 150, 0, 1) * 100 + '%';
    fill.className = 'chase-fill' + (gap > 60 ? '' : gap > 30 ? ' mid' : ' high');
    const ct = $('chaseText');
    ct.textContent = G.warn > 0 ? '👻 It’s about to lunge! Answer now!' : `👻 The ghost is ${Math.round(gap)} m behind you`;
    ct.classList.toggle('warn', G.warn > 0);
    $('chaseSpeed').textContent = `closing at ${ghostSpeed().toFixed(1)} m/s`;
  }

  function showReached(s, kicker, sub) {
    const el = $('reached');
    $('reachedIc').textContent = s.ic;
    el.querySelector('.reached-kicker').textContent = kicker || 'You reached';
    $('reachedName').textContent = s.name;
    $('reachedSub').textContent = sub || commas(s.at) + ' points';
    el.classList.add('hidden'); void el.offsetWidth; el.classList.remove('hidden');
    clearTimeout(showReached.t);
    showReached.t = setTimeout(() => el.classList.add('hidden'), 2900);
    Sound.milestone();
    Scene.confetti(60, Scene.balloonX());
  }

  // Moving from one score to another: announce the location you got to. Hitting 50,000 starts
  // infinite mode.
  function arrive(before, after, delay) {
    const M = MAPS[type];
    const passed = M.stops.concat(M.infinite).filter(s => s.at > before && s.at <= after);
    if (!passed.length) return;
    const target = before < MAP_TARGET && after >= MAP_TARGET;
    const show = () => {
      if (!G) return;
      if (target) {
        showReached(M.stops[19], '🏆 50,000! You reached', '♾️ Infinite mode: the map keeps going');
        Scene.confetti(200);
        flash();
      } else showReached(passed[passed.length - 1]);
    };
    if (delay) setTimeout(show, delay); else show();
  }

  // ---- The Halloween chase -------------------------------------------------------------
  // The ghost closes in while a matchup is up, starting at 2.5 m/s and speeding up 0.9 m/s every minute.
  // The balloon flies 12 m every second, the whole time (and scores 12 points a second for it).
  // You can be at most 150 m ahead.
  // While an answer plays out, the ghost keeps its distance (on Ultra it never lets up).
  const ghostSpeed = () => 2.5 + 0.9 * (G.qtime / 60);
  function chaseTick(dt) {
    const asking = G.phase === 'ask';
    const ultra = G.diff === 'ultra';
    if (asking) G.qtime += dt;
    G.survived += dt;
    if (asking || ultra) G.gap -= ghostSpeed() * dt;
    G.dist += 12 * dt;
    // Ultra: every 8 to 13 seconds of question time the ghost lunges, after a 1.5 second warning
    if (ultra && asking) {
      if (G.warn > 0) {
        G.warn -= dt;
        if (G.warn <= 0) { G.warn = 0; G.gap -= ULTRA_LUNGE; Sound.bad(); G.lungeIn = 8 + Math.random() * 5; }
      } else if ((G.lungeIn -= dt) <= 0) { G.warn = 1.5; Sound.hiss(); }
    }
    // the heartbeat speeds up as it gets close, and the music fades so you can hear it
    if (G.gap < 40) {
      G.beatIn -= dt;
      if (G.beatIn <= 0) { Sound.heartbeat(); G.beatIn = 0.45 + Math.max(0, G.gap) / 40 * 0.8; }
    }
    Sound.musicLevel(clamp(G.gap / 40, 0.15, 1));
    // the score goes up 12 a second while you fly, and every right answer adds its points
    G.score += 12 * dt;
    arrive(G.scoreSeen, G.score);
    G.scoreSeen = G.score;
    Scene.chase({ gap: Math.max(0, G.gap), dist: G.dist, score: G.score, warn: G.warn > 0 ? 1 : 0 });
    updateChaseHud();
    if (G.gap <= 0) caught();
  }
  function caught() {
    if (G.phase === 'over') return;
    G.phase = 'over';
    G.gap = 0;
    Scene.caught();
    Sound.caught();
    Sound.musicLevel(0.3);
    setTimeout(() => { if (G) gameOver(); }, 1600);
  }

  // ---- Timer loop ----------------------------------------------------------
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  let last = performance.now();
  let homeDist = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const running = G && !G.paused && !portrait.matches;
    if (running && G.type === 'haunt' && G.phase !== 'over') chaseTick(dt);
    if (running && G.type !== 'haunt' && G.phase === 'ask') {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) { G.timeLeft = 0; if (G.type === 'guess') submitGuess(null); else reveal(null); }
    }
    if (G && G.type !== 'haunt' && G.phase === 'ask') {
      const frac = G.timeLeft / G.d.time;
      $('timerFill').style.transform = `scaleX(${frac})`;
      $('timerSecs').textContent = Math.ceil(G.timeLeft) + 's';
      const used = 1 - frac;
      $('speedLabel').textContent = used < 0.25 ? '⚡ ×2 speed bonus' : used < 0.5 ? '⚡ ×1.5 speed bonus' : '';
    }
    // the Halloween title screen: the balloon drifts along with the ghost behind it
    if (!G && type === 'haunt') { homeDist += 12 * dt; Scene.chase({ dist: homeDist, gap: 26 + Math.sin(now / 900) * 6 }); }
    requestAnimationFrame(loop);
  }

  // ---- Higher or lower (Classic, Halloween) and bigger or smaller (Real Size) ------------------
  function pick(g) {
    if (!G || G.phase !== 'ask' || G.paused) return;
    if (g === 'tie' && !G.tieShown) return;           // no Tie! button this time
    Sound.click();
    reveal(g);
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(r));

  // Count the hidden number up. A photo finish races most of the way, then crawls the last few
  // numbers one at a time, slower and slower.
  async function countUp(card, f, other, photo) {
    const el = card.querySelector('.cnum');
    el.classList.remove('hidden-num');
    card.classList.add('counting');
    const dec = decimalsOf(f.n);
    const show = v => { el.textContent = f.year ? String(Math.round(v)) : fmtNum(v, dec); };
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
    card.classList.remove('counting');
    // the buttons shrink to just your pick, making room for the note under the number
    card.classList.add('revealed');
    const note = card.querySelector('.cnote');
    if (note) note.textContent = f.note || '';
  }

  // 🤝 A correct tie call: the banner, a fanfare, confetti from the sky and from the vehicle, flashes
  function celebrateTie(run) {
    const b = $('photoBanner');
    b.textContent = '🤝 TIE CALLED!';
    b.classList.add('tie'); b.classList.remove('hidden');
    const p = $('panel');
    p.classList.remove('tie-party'); void p.offsetWidth; p.classList.add('tie-party');
    Sound.tie();
    setTimeout(() => { if (G === run) Sound.photoWin(); }, 420);
    Scene.confetti(240);
    Scene.confetti(120, Scene.balloonX());
    Scene.burn(2.4);
    flash();
    setTimeout(() => { if (G === run) { flash(); Scene.confetti(160); } }, 600);
  }

  function flash() {
    const el = $('flash');
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }

  const SIZE_VERB = { len: ['is longer than', 'is shorter than'], mass: ['is heavier than', 'is lighter than'], speed: ['is faster than', 'is slower than'], temp: ['is hotter than', 'is colder than'], time: ['is longer than', 'is shorter than'], vol: ['holds more than', 'holds less than'] };
  function convText(R, L) {
    const v = Units.round(Units.fromBase(R.real, L.mk));
    return fmtNum(v, decimalsOf(v)) + ' ' + Units.name(L.mk);
  }
  function sentence(L, R) {
    if (type === 'size') {
      const [hi, lo] = L.real > R.real ? [L, R] : [R, L];
      const conv = c => (c === R && R.mk !== L.mk ? `${withUnit(R)} = ${convText(R, L)}` : withUnit(c));
      const loText = conv(lo), hiText = conv(hi);
      return `${cap(hi.t)} (${hiText}) ${SIZE_VERB[L.dim][0]} ${lo.t} (${loText}).`;
    }
    if (L.n === R.n) return `${cap(L.t)} and ${R.t} are both ${numText(L)}!`;
    const [hi, lo] = L.n > R.n ? [L, R] : [R, L];
    return `${cap(hi.t)} (${withUnit(hi)}) beats ${lo.t} (${withUnit(lo)}).`;
  }

  async function reveal(g) {
    const L = G.left, R = G.right_;
    const run = G;
    G.phase = 'reveal';
    const size = type === 'size', haunt = type === 'haunt';
    const usedFrac = haunt ? 1 : 1 - G.timeLeft / G.d.time;
    const photo = !size && Pairs.isPhoto(L, R), tie = !size && L.n === R.n;
    // Tie! is only right on an exact tie, and then Higher or Lower is wrong.
    const apart = size ? Pairs.realRatio(L, R) : Pairs.ratio(L, R);
    const exact = isExactTie(L, R);
    const ok = !!g && (g === 'tie' ? exact : !exact && (size ? (g === 'higher') === (R.real > L.real) : (g === 'higher' ? R.n > L.n : R.n < L.n)));
    const tieCall = ok && g === 'tie';
    const pctApart = isFinite(apart) ? Math.round((apart - 1) * 100) : null;
    const gap = Math.abs(L.n - R.n);
    const trap = size && Pairs.isTrap(L, R);
    const dodge = haunt && G.warn > 0 && ok;

    const box = haunt ? $('stripChoices') : $('cardR').querySelector('.choices');
    if (box) {
      box.classList.add('locked');
      const btn = box.querySelector(`[data-g="${g}"]`);
      if (btn) btn.classList.add('chosen');
    }
    if (!g) Sound.timeout();

    await countUp($('cardR'), R, L, photo);
    if (G !== run) return;            // quit during the reveal
    if (size && R.mk !== L.mk) { $('cardR').querySelector('.cconv').textContent = '= ' + convText(R, L); $('cardR').classList.add('has-conv'); }

    const res = $('result'), quip = $('resultQuip');
    let pts = 0, quipText, quipCls, ptsText = '';
    if (ok) {
      const tier = size ? Pairs.sizeTier(L, R) : Pairs.tierOf(L, R);
      const T = Pairs.TIERS[tier];
      const speed = usedFrac < 0.25 ? 2 : usedFrac < 0.5 ? 1.5 : 1;
      const streakMult = Math.min(5, 1 + 0.25 * G.streak);
      const trapMult = trap ? 1.5 : 1;
      pts = Math.round(T.pts * G.d.mult * speed * streakMult * trapMult);
      G.streak++; G.right++;
      G.bestStreak = Math.max(G.bestStreak, G.streak);
      if (trap) G.traps++;
      if (size && tier >= 3) G.closeCalls = (G.closeCalls || 0) + 1;
      const parts = [`<span class="${T.cls}">+${commas(pts)} · ${T.name}</span>`];
      if (G.d.mult > 1) parts.push(`×${G.d.mult} ${G.diff}`);
      if (speed > 1) parts.push(`×${speed} speed`);
      if (streakMult > 1) parts.push(`×${streakMult.toFixed(2)} streak`);
      if (trap) parts.push('🪤 ×1.5 trap');
      if (tieCall) {
        // calling a tie is a big deal: a banner, two bursts of confetti, flashes and a fanfare
        if (photo) G.photoWon++;
        G.ties = (G.ties || 0) + 1;
        quipText = 'IT’S A TIE!! YOU CALLED IT!';
        quipCls = 'q-photo q-tie';
        celebrateTie(run);
      } else if (photo) {
        G.photoWon++;
        quipText = gap === 1 ? 'PHOTO FINISH! By ONE!' : `PHOTO FINISH! By ${gap}!`;
        quipCls = 'q-photo';
        Sound.photoWin();
        Scene.confetti(160);
        flash();
      } else {
        quipText = trap ? pickOne(['🪤 Trap dodged!', '🪤 Not fooled!', '🪤 Nice catch!'])
          : tier >= 3 ? pickOne(['So close!', 'Nailed it!', 'Close call!', 'Ooh, nice!'])
          : tier === 2 ? pickOne(['Nice!', 'Good call!', 'Yep!', 'Correct!'])
          : pickOne(['Easy!', 'Obviously.', 'Too easy.', 'Yep!']);
        quipCls = 'q-good';
        Sound.good(tier);
      }
      $('cardR').classList.add('right-ans');
      if (haunt) {
        // the points push the ghost back (no speed bonus in the chase)
        const push = Math.round(PUSH[tier] * G.d.push * streakMult);
        const closeCall = G.gap < 10;
        G.closest = Math.min(G.closest, Math.max(0, G.gap));
        G.gap = Math.min(150, G.gap + push);
        G.dist += push;
        G.score += pts;
        parts.push(`👻 pushed back ${push} m`);
        if (dodge) { G.warn = 0; G.dodged++; G.lungeIn = 8 + Math.random() * 5; quipText = '🛡️ Lunge dodged!'; }
        else if (closeCall) { quipText = '😱 Close escape!'; Sound.escape(); }
        if (tier === 4) Scene.blast();
        Scene.burn(1.3);
        Scene.chase({ gap: G.gap, dist: G.dist, warn: 0 });
        updateChaseHud();
      } else {
        if (size) { Sound.roar(); Scene.burn(1.6); } else { Scene.burn(photo ? 2.2 : 1.3); Sound.burner(); }
        addScore(pts);
        if (G.streak === 10) setTimeout(() => Scene.rocket(), 900);   // a visitor from Brain Rocket
      }
      ptsText = parts.join(' &nbsp;·&nbsp; ');
    } else {
      G.streak = 0;
      G.killer = { L, R, g, photo, gap };
      if (exact && g && g !== 'tie') {
        if (photo) G.photoLost++;
        quipText = '🤝 It was a TIE! Only Tie was right.';
        quipCls = 'q-bad';
        Sound.photoLose();
      } else if (photo && g !== 'tie') {
        G.photoLost++;
        quipText = gap === 1 ? 'Lost by ONE.' : `Lost by ${gap}.`;
        quipCls = 'q-bad';
        Sound.photoLose();
      } else {
        quipText = !g ? 'Too slow!' : g === 'tie' ? (pctApart < 1 ? 'So close, but not a tie!' : `Not a tie! They’re ${pctApart}% apart.`) : trap ? '🪤 It was a trap!' : (size ? Pairs.realRatio(L, R) : Pairs.ratio(L, R)) >= 10 ? 'Not even close!' : pickOne(['Nope!', 'Oof!', 'Wrong way!']);
        quipCls = 'q-bad';
        if (g) Sound.bad();
      }
      $('cardR').classList.add('wrong-ans');
      Scene.dip();
      if (haunt) {
        const lunge = LUNGE[G.diff];
        G.gap -= lunge;
        ptsText = `<span class="t0">👻 The ghost lunges ${lunge} m closer!</span>`;
        Sound.hiss();
        Scene.chase({ gap: Math.max(0, G.gap) });
        updateChaseHud();
      } else {
        G.lives--;
        renderLives();
        const lifeEls = $('hudLives').children;
        if (lifeEls[G.lives]) lifeEls[G.lives].classList.add('pop');
        updateHud();
      }
    }
    quip.className = 'result-quip ' + quipCls;
    quip.textContent = quipText;
    $('resultLine').textContent = sentence(L, R);
    $('resultPts').innerHTML = ptsText;
    res.classList.remove('pop'); void res.offsetWidth; res.classList.add('pop');

    if (photo) setTimeout(() => { if (G === run && !G.paused) Sound.musicLevel(1); }, 1800);
    if (haunt && G.gap <= 0) { caught(); return; }
    await wait(photo || tieCall ? 2900 : ok ? 1500 : 2100);
    if (G !== run || G.phase === 'over') return;
    while (G.paused) { await wait(100); if (G !== run) return; }
    if (!haunt && G.lives <= 0) gameOver();
    else advance();
  }

  // Points move you along the map.
  function addScore(pts) {
    const before = G.score;
    G.score += pts;
    Scene.setAlt(G.score);
    if (musicStarted) Sound.music(trackNow());
    const pill = document.querySelector('.score-pill');
    pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
    arrive(before, G.score, 700);
    updateHud();
  }

  async function advance() {
    const L = $('cardL'), R = $('cardR');
    L.classList.add('out'); R.classList.add('shift');
    await wait(430);
    if (!G) return;
    G.left = G.right_;
    if (type === 'size') {
      let next = Pairs.nextSize(G.left, G.diff, G.used);
      if (!next) { G.left = Pairs.firstSize(G.diff); next = Pairs.nextSize(G.left, G.diff, G.used); }
      G.right_ = next;
    } else {
      G.right_ = Pairs.next(G.left, G.diff, G.used, G.pstate, type);
    }
    G.used.add(G.right_.id);
    renderCards(false);
    newRound();
  }

  // ---- Guess the Number ---------------------------------------------------------------
  function renderGuess() {
    const c = G.card, cat = CATS[c.c], t = cap(c.t);
    const card = $('cardG');
    card.className = 'card card-g';
    card.innerHTML = `<div class="chip"><span class="chip-ic">${cat.icon}</span>${esc(cat.name)}</div>
      <div class="ctext" style="font-size:${textSize(t) + 2}px">${esc(t)}</div>
      <div class="cnum hidden-num" style="font-size:96px">?</div>
      <div class="cunit">${esc(c.u)}</div>
      <div class="cnote"></div>`;
    const box = $('guessInput');
    box.className = 'guess-input';
    const unit = c.u ? `<div class="g-unit">${esc(c.u)}</div>` : '';
    if (G.diff === 'owen') {
      G.choices = Pairs.guessChoices(c);
      box.innerHTML = `<div class="g-label">Pick the right number</div><div class="g-choices">${G.choices.map((v, i) =>
        `<button class="g-choice" type="button" data-v="${v}"><span class="k">${i + 1}</span>${esc(valText(v, c))}</button>`).join('')}</div>${unit}`;
      box.querySelectorAll('.g-choice').forEach(b => b.addEventListener('click', () => submitGuess(+b.dataset.v)));
    } else if (G.diff === 'medium') {
      G.range = Pairs.guessRange(c);
      box.innerHTML = `<div class="g-label">Slide to your guess</div><div class="g-value" id="gValue"></div>${unit}
        <input class="g-slider" id="gSlider" type="range" min="0" max="1000" value="500" aria-label="Your guess">
        <div class="g-ends"><span>${esc(valText(niceVal(G.range.lo, c), c))}</span><span>${esc(valText(niceVal(G.range.hi, c), c))}</span></div>
        <button class="g-submit" id="gSubmit" type="button">✔ Guess</button>`;
      const sl = $('gSlider');
      const show = () => { $('gValue').textContent = valText(sliderValue(), c); };
      sl.addEventListener('input', show); show();
      $('gSubmit').addEventListener('click', () => submitGuess(sliderValue()));
    } else {
      box.innerHTML = `<div class="g-label">${G.diff === 'ultra' ? 'Type it. Only within 5% counts!' : 'Type your guess'}</div>
        <input class="g-field" id="gField" type="text" inputmode="decimal" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="?" aria-label="Your guess">${unit}
        <button class="g-submit" id="gSubmit" type="button">✔ Guess</button>`;
      $('gSubmit').addEventListener('click', () => submitGuess(fieldValue()));
      $('gField').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitGuess(fieldValue()); } });
    }
  }
  function sliderValue() {
    const p = (+$('gSlider').value) / 1000, r = G.range;
    const v = r.log ? r.lo * Math.pow(r.hi / r.lo, p) : r.lo + (r.hi - r.lo) * p;
    return niceVal(v, G.card);
  }
  function fieldValue() {
    const raw = ($('gField').value || '').replace(/[,\s]/g, '');
    return raw === '' ? NaN : Number(raw);
  }
  function focusField() { const f = $('gField'); if (f) setTimeout(() => f.focus(), 50); }

  async function submitGuess(v) {
    if (!G || G.type !== 'guess' || G.phase !== 'ask' || G.paused) return;
    if (v !== null && !(v >= 0)) { const f = $('gField'); if (f) { f.classList.remove('shake'); void f.offsetWidth; f.style.borderColor = '#ff5d73'; } return; }
    const run = G, c = G.card;
    G.phase = 'reveal';
    Sound.click();
    const usedFrac = 1 - G.timeLeft / G.d.time;
    const box = $('guessInput');
    box.classList.add('g-locked');
    let r;
    if (v === null) r = { tier: 0, off: 'Out of time' };
    else if (G.diff === 'owen') r = v === c.n ? { tier: 4, off: 'Right answer!' } : { tier: 0, off: Pairs.scoreGuess(c, v, 'hard').off };
    else r = Pairs.scoreGuess(c, v, G.diff);
    if (G.diff === 'owen') box.querySelectorAll('.g-choice').forEach(b => {
      const bv = +b.dataset.v;
      b.classList.add(bv === c.n ? 'right' : bv === v ? 'wrong' : 'dim');
    });
    if (v === null) Sound.timeout();

    await countUp($('cardG'), c, c, false);
    if (G !== run) return;
    // where your guess landed, next to the answer
    if (v !== null && G.diff !== 'owen') {
      const lo = c.year ? Math.min(v, c.n) - 10 : Math.min(v, c.n) / 2, hi = c.year ? Math.max(v, c.n) + 10 : Math.max(v, c.n) * 1.6;
      const pos = x => (c.year ? (x - lo) / (hi - lo) : Math.log(Math.max(x, lo) / lo) / Math.log(hi / lo)) * 100;
      const track = document.createElement('div');
      track.className = 'g-track';
      track.innerHTML = `<div class="ans" style="left:${clamp(pos(c.n), 0, 100)}%"><span class="tag">Answer</span></div><div class="you" style="left:${clamp(pos(v), 0, 100)}%"><span class="tag">You: ${esc(valText(v, c))}</span></div>`;
      box.appendChild(track);
    }

    const T = Pairs.GUESS_TIERS[r.tier];
    let ptsText = '', quipText, quipCls;
    if (r.tier > 0) {
      const speed = usedFrac < 0.25 ? 2 : usedFrac < 0.5 ? 1.5 : 1;
      const streakMult = Math.min(5, 1 + 0.25 * G.streak);
      const pts = Math.round(T.pts * G.d.mult * speed * streakMult);
      G.streak++; G.right++;
      G.bestStreak = Math.max(G.bestStreak, G.streak);
      const parts = [`<span class="${T.cls}">+${commas(pts)} · ${G.diff === 'owen' ? 'Right!' : T.name}</span>`];
      if (G.d.mult > 1) parts.push(`×${G.d.mult} ${G.diff}`);
      if (speed > 1) parts.push(`×${speed} speed`);
      if (streakMult > 1) parts.push(`×${streakMult.toFixed(2)} streak`);
      ptsText = parts.join(' &nbsp;·&nbsp; ');
      if (r.tier === 5) { G.bullseyes++; quipText = '🎯 BULLSEYE! A golden acorn!'; quipCls = 'q-photo'; Scene.gold(); Scene.confetti(140); Sound.photoWin(); flash(); }
      else { quipText = G.diff === 'owen' ? pickOne(['Right!', 'Yep!', 'Got it!']) : { 4: 'So close!', 3: 'Close!', 2: 'Not bad!', 1: 'Close-ish…' }[r.tier]; quipCls = 'q-good'; Sound.good(Math.min(4, r.tier)); Sound.chirp(); }
      $('cardG').classList.add('right-ans');
      Scene.burn(1.2);
      addScore(pts);
      if (G.streak === 10) setTimeout(() => Scene.rocket(), 900);
    } else {
      G.streak = 0;
      G.lives--;
      G.killer = { card: c, v };
      quipText = v === null ? 'Too slow!' : pickOne(['Way off!', 'Not quite!', 'Oof!']);
      quipCls = 'q-bad';
      ptsText = `<span class="t0">🌰 Dropped an acorn</span>`;
      if (v !== null) Sound.bad();
      $('cardG').classList.add('wrong-ans');
      Scene.dip();
      renderLives();
      const lifeEls = $('hudLives').children;
      if (lifeEls[G.lives]) lifeEls[G.lives].classList.add('pop');
      updateHud();
    }
    const res = $('result');
    $('resultQuip').className = 'result-quip ' + quipCls;
    $('resultQuip').textContent = quipText;
    $('resultLine').textContent = `${cap(c.t)}: ${withUnit(c)}.` + (v === null ? '' : ` You guessed ${valText(v, c)}: ${r.off}.`);
    $('resultPts').innerHTML = ptsText;
    res.classList.remove('pop'); void res.offsetWidth; res.classList.add('pop');

    await wait(r.tier === 5 ? 2600 : r.tier > 0 ? 2000 : 2400);
    if (G !== run) return;
    while (G.paused) { await wait(100); if (G !== run) return; }
    if (G.lives <= 0) { gameOver(); return; }
    G.card = Pairs.nextGuess(G.used);
    renderGuess();
    $('cardG').classList.add('in');
    newRound();
  }

  // ---- Game over and sharing -----------------------------------------------
  const TITLE = { classic: 'Apples to Oranges', size: 'Apples to Oranges: Real Size', guess: 'Apples to Oranges: Guess the Number', haunt: 'Apples to Oranges: Halloween' };
  function result() { return Math.round(G.score); }
  function killerText(plain) {
    const k = G.killer;
    if (!k) return '';
    if (G.type === 'guess') {
      const c = k.card;
      return plain ? `💀 ${cap(c.t)}: ${numText(c)}${k.v == null ? ' (ran out of time)' : `, I guessed ${valText(k.v, c)}`}`
        : `💀 ${esc(cap(c.t))}: <b>${esc(withUnit(c))}</b>${k.v == null ? ' (ran out of time)' : `. You guessed <b>${esc(valText(k.v, c))}</b>`}`;
    }
    const L = k.L, R = k.R;
    const lead = !k.g ? 'Ran out of time on' : k.gap === 0 && k.g !== 'tie' ? 'Missed the tie on' : k.g === 'tie' ? 'Called a tie that wasn’t on'
      : k.photo ? `Lost by ${k.gap === 1 ? 'ONE' : k.gap}` : 'Taken down by';
    return plain ? `💀 ${lead}: ${L.t} (${withUnit(L)}) vs ${R.t} (${withUnit(R)})`
      : `💀 ${lead}: ${esc(cap(L.t))} (<b>${esc(withUnit(L))}</b>) vs ${esc(R.t)} (<b>${esc(withUnit(R))}</b>)`;
  }
  function shareText() {
    const lines = [`🍎 ${TITLE[G.type]} 🍊 (${G.d.name})`];
    if (G.type === 'haunt') {
      lines.push(`🎃 ${commas(G.score)} points before the ghost caught me · survived ${fmtTime(G.survived)}`);
      lines.push(`📍 Reached ${placeName('haunt', G.score)}` + (G.score >= MAP_TARGET ? ' · ♾️ infinite mode' : ''));
      lines.push(`${G.right} right · best streak ${G.bestStreak}` + (isFinite(G.closest) ? ` · closest escape ${Math.round(G.closest)} m` : ''));
    } else {
      lines.push(`${commas(G.score)} points · ${G.right} right · best streak ${G.bestStreak}`);
      lines.push(`${G.type === 'size' ? '🐉' : G.type === 'guess' ? '🐿️' : '🎈'} ${G.score > 0 ? 'Reached ' + placeName(G.type, G.score) : 'Never left the ground'}` + (G.score >= MAP_TARGET ? ' · ♾️ infinite mode' : ''));
      if (G.photoWon || G.photoLost) lines.push(`📸 Photo finishes: ${G.photoWon} won, ${G.photoLost} lost`);
      if (G.bullseyes) lines.push(`🎯 Bullseyes: ${G.bullseyes}`);
    }
    const k = killerText(true);
    if (k) lines.push(k);
    return lines.join('\n');
  }

  function gameOver() {
    G.phase = 'over';
    if (G.type !== 'haunt') Sound.over();
    const score = result();
    const isBest = score > (best[G.type][G.diff] || 0);
    if (isBest) { best[G.type][G.diff] = score; saveBest(); }
    $('overKicker').textContent = `${{ classic: 'Classic', size: 'Real Size', guess: 'Guess the Number', haunt: 'Halloween' }[G.type]} · ${G.d.name}`;
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    if (G.type === 'haunt') {
      $('overTitle').textContent = '👻 Caught!';
      const here = mapPlace('haunt', G.score).stop;
      $('overScore').textContent = commas(score);
      $('overStats').innerHTML = stat(here.ic, esc(here.name)) + stat(fmtTime(G.survived), 'Survived') + stat(G.right, 'Right answers')
        + stat(isFinite(G.closest) ? Math.round(G.closest) + ' m' : '–', 'Closest escape');
    } else {
      const here = mapPlace(G.type, G.score).stop;
      $('overTitle').textContent = G.right === 0 ? 'Never left the ground!' : { classic: 'Out of hot air!', size: 'Out of fire!', guess: 'Out of acorns!' }[G.type];
      $('overScore').textContent = commas(G.score);
      $('overStats').innerHTML =
        stat(here.ic, G.score > 0 ? esc(here.name) : 'On the ground') +
        stat(G.right, G.type === 'guess' ? 'Scoring guesses' : 'Right answers') +
        stat(G.bestStreak, 'Best streak') +
        (G.type === 'guess' ? stat(G.bullseyes, 'Bullseyes') : G.type === 'size' ? stat(G.closeCalls || 0, 'Close calls won') : stat(`${G.photoWon}/${G.photoWon + G.photoLost}`, 'Photo finishes won'));
    }
    const ob = $('overBest');
    ob.className = 'over-best' + (isBest && score > 0 ? ' new' : '');
    ob.textContent = isBest && score > 0 ? '🏆 New best!' : best[G.type][G.diff] ? 'Best: ' + commas(best[G.type][G.diff]) : '';
    $('overKiller').innerHTML = killerText(false);
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
  // Halloween gives you one pause per run (switching away from the tab always pauses).
  function setPaused(p, forced) {
    if (!G || G.phase === 'over') return;
    if (p && G.type === 'haunt' && !forced) {
      if (G.pausesLeft <= 0) return;
      G.pausesLeft--;
    }
    G.paused = p;
    $('pause').classList.toggle('hidden', !p);
    $('pauseNote').classList.toggle('hidden', !(G.type === 'haunt' && G.pausesLeft <= 0));
    $('btnPause').disabled = G.type === 'haunt' && G.pausesLeft <= 0 && !p;
    Sound.musicLevel(p ? 0.35 : 1);
    syncSoundButtons();
    if (!p && G.type === 'guess') focusField();
  }

  // ---- Wiring --------------------------------------------------------------
  document.querySelectorAll('.type-btn').forEach(b => {
    if (!TYPE_ORDER.includes(b.dataset.type)) b.hidden = true;
    b.addEventListener('click', () => { startMusic(); if (b.dataset.type !== type) { Sound.click(); setType(b.dataset.type, true); } });
  });
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => start(b.dataset.diff)));
  $('btnSound').addEventListener('click', toggleSound);
  $('btnPauseSound').addEventListener('click', toggleSound);
  $('btnMusic').addEventListener('click', toggleMusic);
  $('btnPauseMusic').addEventListener('click', toggleMusic);
  document.addEventListener('pointerdown', startMusic, { once: true });
  document.addEventListener('keydown', startMusic, { once: true });
  // The SirSC intro's start screen always takes a press, so the music can start as soon as it ends.
  if (window.SirSCIntro) SirSCIntro.done.then(startMusic);
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
    if (!G) {
      // on the title screen, ← and → switch modes
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const i = TYPE_ORDER.indexOf(type) + (e.key === 'ArrowRight' ? 1 : -1);
        if (TYPE_ORDER[i]) setType(TYPE_ORDER[i], true);
      }
      return;
    }
    if (e.key === 'Escape' || ((e.key === 'p' || e.key === 'P') && G.type !== 'guess')) { if (G.phase !== 'over') setPaused(!G.paused); return; }
    if (G.paused) return;
    if (G.phase === 'over') { if (e.key === 'Enter' && !$('over').classList.contains('hidden')) start(G.diff); return; }
    if (G.type === 'guess') {
      if (G.diff === 'owen' && G.phase === 'ask' && /^[1-4]$/.test(e.key) && G.choices) submitGuess(G.choices[+e.key - 1]);
      else if (G.diff === 'medium' && G.phase === 'ask' && e.key === 'Enter') submitGuess(sliderValue());
      return;
    }
    if (['ArrowUp', 'w', 'W', 'h', 'H'].includes(e.key)) { e.preventDefault(); pick('higher'); }
    else if (['ArrowDown', 's', 'S', 'l', 'L'].includes(e.key)) { e.preventDefault(); pick('lower'); }
    else if (['=', 't', 'T'].includes(e.key)) { e.preventDefault(); pick('tie'); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.phase !== 'over' && !G.paused) setPaused(true, true); });

  Scene.init($('scene'), $('sceneOld'));
  fit();
  if (EVENT_ON) document.body.classList.add('halloween');
  setType(type, false);
  syncSoundButtons();
  requestAnimationFrame(loop);
})();
