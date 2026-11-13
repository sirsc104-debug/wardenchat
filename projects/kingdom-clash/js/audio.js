/* Kingdom Clash: sound effects and music made on the fly with Web Audio (no sound files). Starts on
   the first click, as browsers require. Effects and music can each be switched off (Settings). */
'use strict';

const KCSound = (() => {
  let ac = null, master = null, on = true, musicOn = true, musicBus = null, crowdBus = null, pv = 1;
  const lastAt = {};
  let snapN = 0, snapAt = 0;
  try { on = localStorage.getItem('kc.sound') !== 'off'; musicOn = localStorage.getItem('kc.music') !== 'off'; } catch (e) { /* storage blocked */ }

  // the audio context, made on the first click; `any` makes it even with effects off (for the music)
  function ensure(any) {
    if (!on && !(any && musicOn)) return null;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(ac.destination);
      crowdBus = ac.createGain(); crowdBus.gain.value = 0; crowdBus.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f1, f2, dur, type, vol, delay) {
    const a = ensure(); if (!a) return;
    const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    f1 *= pv; if (f2) f2 *= pv;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f1, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, type, delay) {
    const a = ensure(); if (!a) return;
    const t = a.currentTime + (delay || 0), n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = type || 'lowpass'; f.frequency.value = freq || 1200;
    g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const SFX = {
    select: () => tone(660, 880, 0.06, 'triangle', 0.12),
    // chests and the Shop
    chestDrop: () => { tone(130, 45, 0.22, 'sine', 0.4); noise(0.16, 0.25, 420); noise(0.08, 0.1, 2400, 'bandpass', 0.05); },
    chestShake: () => { for (let i = 0; i < 5; i++) { noise(0.05, 0.13, 1500 + i * 250, 'bandpass', i * 0.09); tone(190 + i * 22, 150, 0.05, 'square', 0.04, i * 0.09); } },
    chestOpen: () => { noise(0.6, 0.16, 2600, 'highpass'); tone(160, 720, 0.35, 'sawtooth', 0.06); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0, 0.5 - i * 0.05, 'triangle', 0.15, 0.08 + i * 0.06)); },
    cardFly: () => { noise(0.2, 0.07, 1300, 'bandpass'); tone(280, 920, 0.2, 'sine', 0.07); },
    cardFlip: () => { tone(880, 1500, 0.07, 'triangle', 0.12); noise(0.05, 0.05, 3200, 'highpass'); },
    revealCommon: () => [659, 880].forEach((f, i) => tone(f, 0, 0.16, 'triangle', 0.15, i * 0.08)),
    revealRare: () => { [659, 880, 1175, 1568].forEach((f, i) => tone(f, 0, 0.22, 'triangle', 0.16, i * 0.07)); noise(0.4, 0.05, 5000, 'highpass', 0.1); },
    revealNew: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0, i === 5 ? 0.6 : 0.2, 'triangle', 0.17, i * 0.08)); noise(0.6, 0.06, 5200, 'highpass', 0.1); },
    rubyTick: () => tone(1250 + Math.random() * 500, 0, 0.05, 'square', 0.045),
    countTick: () => tone(900 + Math.random() * 200, 0, 0.035, 'triangle', 0.07),
    chestDone: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0, i === 3 ? 0.45 : 0.16, 'triangle', 0.16, i * 0.1)),
    // a magic item gathering, each part snapping in (a rising scale), and the item forming
    itemGather: () => { noise(0.9, 0.05, 1800, 'bandpass'); tone(180, 760, 0.9, 'sine', 0.06); tone(240, 1020, 0.9, 'triangle', 0.03, 0.1); },
    partSnap: () => {
      const now = performance.now();
      snapN = now - snapAt > 700 ? 0 : Math.min(snapN + 1, 14); snapAt = now;
      const f = 520 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33][snapN] / 12);
      tone(f, 0, 0.09, 'triangle', 0.11); tone(f * 2, 0, 0.05, 'sine', 0.04); noise(0.03, 0.05, 4200, 'highpass');
    },
    hammerForm: () => { tone(1320, 1240, 0.5, 'square', 0.05); tone(1980, 1900, 0.7, 'triangle', 0.09); tone(95, 45, 0.3, 'sine', 0.35); noise(0.14, 0.2, 2400, 'bandpass');
      [523, 784, 1047, 1568].forEach((f, i) => tone(f, 0, 0.5, 'triangle', 0.12, 0.12 + i * 0.07)); },
    // a card growing (js/upgrades.js)
    upgradeGo: () => { tone(392, 784, 0.12, 'triangle', 0.13); tone(784, 0, 0.14, 'triangle', 0.1, 0.08); noise(0.08, 0.06, 3000, 'highpass'); },
    charge: () => { tone(160, 980, 1.1, 'sawtooth', 0.04); tone(240, 1470, 1.1, 'triangle', 0.05); noise(1.1, 0.05, 900, 'bandpass'); },
    levelUp: () => { tone(70, 35, 0.5, 'sine', 0.4); noise(0.5, 0.2, 700); [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0, i === 6 ? 0.8 : 0.25, 'triangle', 0.15, 0.05 + i * 0.065)); noise(0.9, 0.05, 6000, 'highpass', 0.3); },
    anvil: () => { tone(1480, 1400, 0.45, 'square', 0.045); tone(2210, 2150, 0.6, 'triangle', 0.08); tone(110, 50, 0.22, 'sine', 0.35); noise(0.1, 0.22, 2600, 'bandpass'); },
    bookOpen: () => { noise(0.25, 0.12, 1400, 'bandpass'); tone(330, 990, 0.4, 'sine', 0.06); [784, 988, 1319].forEach((f, i) => tone(f, 0, 0.3, 'triangle', 0.1, 0.12 + i * 0.06)); },
    pageFlip: () => { noise(0.09, 0.08, 3400, 'highpass'); noise(0.06, 0.05, 1600, 'bandpass', 0.03); },
    // emotes (js/emotes.js)
    em_laugh: () => [0, 0.11, 0.22, 0.33].forEach((d, i) => { tone(520 - i * 20, 380, 0.09, 'square', 0.06, d); noise(0.06, 0.04, 2200, 'bandpass', d); }),
    em_cry: () => { tone(620, 380, 0.5, 'triangle', 0.1); tone(560, 330, 0.55, 'sine', 0.06, 0.25); },
    em_angry: () => { tone(140, 90, 0.35, 'sawtooth', 0.09); noise(0.35, 0.12, 500); },
    em_thumbs: () => { tone(880, 0, 0.12, 'triangle', 0.14); tone(1320, 0, 0.22, 'triangle', 0.12, 0.09); },
    em_wow: () => tone(330, 990, 0.35, 'triangle', 0.13),
    em_yawn: () => { tone(420, 220, 0.7, 'sine', 0.1); noise(0.6, 0.03, 900, 'bandpass'); },
    em_cheeky: () => { noise(0.22, 0.12, 300, 'bandpass'); tone(200, 140, 0.2, 'square', 0.05); tone(990, 1320, 0.08, 'triangle', 0.08, 0.2); },
    em_think: () => { tone(392, 0, 0.14, 'triangle', 0.1); tone(330, 0, 0.14, 'triangle', 0.1, 0.16); tone(440, 0, 0.2, 'triangle', 0.1, 0.32); },
    // the Shop's emotes
    em_love: () => [660, 880, 1046].forEach((f, i) => tone(f, f * 1.02, 0.18, 'sine', 0.11, i * 0.1)),
    em_cool: () => { tone(220, 330, 0.12, 'square', 0.05); tone(440, 0, 0.25, 'triangle', 0.1, 0.12); },
    em_party: () => { tone(500, 1400, 0.3, 'sawtooth', 0.05); noise(0.3, 0.08, 4000, 'highpass', 0.2); [784, 988, 1175].forEach((f, i) => tone(f, 0, 0.12, 'triangle', 0.1, 0.3 + i * 0.07)); },
    em_dizzy: () => { for (let i = 0; i < 4; i++) tone(500 + (i % 2) * 200, 400, 0.12, 'sine', 0.08, i * 0.1); },
    em_nervous: () => { for (let i = 0; i < 5; i++) tone(620, 600, 0.05, 'square', 0.04, i * 0.06); },
    em_facepalm: () => { noise(0.08, 0.2, 900, 'lowpass'); tone(300, 180, 0.4, 'triangle', 0.08, 0.08); },
    em_kiss: () => { tone(1200, 1800, 0.08, 'sine', 0.1); tone(900, 0, 0.2, 'triangle', 0.08, 0.12); },
    em_wave: () => [523, 659].forEach((f, i) => tone(f, 0, 0.15, 'triangle', 0.12, i * 0.12)),
    em_clap: () => { for (let i = 0; i < 4; i++) noise(0.05, 0.18, 1800, 'bandpass', i * 0.13); },
    em_shush: () => noise(0.45, 0.07, 3500, 'highpass'),
    em_popcorn: () => { for (let i = 0; i < 6; i++) noise(0.03, 0.12, 2600 + Math.random() * 1500, 'bandpass', i * 0.07 + Math.random() * 0.03); },
    em_trophy: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0, i === 3 ? 0.4 : 0.14, 'triangle', 0.12, i * 0.09)),
    em_mindblown: () => { noise(0.4, 0.2, 600); tone(120, 60, 0.3, 'sine', 0.25); tone(600, 1600, 0.3, 'triangle', 0.06, 0.1); },
    em_smug: () => { tone(330, 392, 0.2, 'triangle', 0.1); tone(523, 0, 0.18, 'triangle', 0.08, 0.2); },
    em_salute: () => { tone(392, 0, 0.12, 'square', 0.06); tone(523, 0, 0.12, 'square', 0.06, 0.12); tone(659, 0, 0.3, 'square', 0.06, 0.24); },
    // Stormspire cards
    buzz: () => { for (let i = 0; i < 3; i++) tone(210 + i * 9, 230, 0.4, 'sawtooth', 0.025, i * 0.03); },
    quill: () => { noise(0.08, 0.06, 3600, 'highpass'); tone(900, 1400, 0.06, 'triangle', 0.04); },
    thunder: () => { noise(0.08, 0.35, 5000, 'highpass'); noise(0.8, 0.3, 260); tone(80, 35, 0.7, 'sine', 0.3, 0.03); },
    thunderclap: () => { noise(0.1, 0.4, 5000, 'highpass'); noise(1.2, 0.4, 200); tone(70, 30, 1.0, 'sine', 0.4, 0.05); noise(0.5, 0.15, 1200, 'bandpass', 0.2); },
    beamUp: () => { tone(400, 1200, 0.25, 'sawtooth', 0.05); noise(0.2, 0.06, 4200, 'highpass'); },
    emCard: () => { tone(392, 784, 0.12, 'triangle', 0.1); [659, 988].forEach((f, i) => tone(f, 0, 0.18, 'triangle', 0.1, 0.12 + i * 0.09)); noise(0.1, 0.05, 3000, 'highpass', 0.1); },
    emPhrase: () => { tone(700, 1050, 0.08, 'triangle', 0.12); noise(0.05, 0.05, 3000, 'highpass'); },
    // Sunstone Arena cards and evolutions
    sandstorm: () => { noise(1.4, 0.12, 700, 'bandpass'); noise(1.2, 0.06, 2600, 'bandpass', 0.2); tone(120, 220, 1.2, 'sine', 0.05); },
    dig: () => { for (let i = 0; i < 4; i++) noise(0.08, 0.12, 380, 'lowpass', i * 0.07); },
    surface: () => { tone(110, 50, 0.25, 'sine', 0.3); noise(0.35, 0.2, 500); noise(0.2, 0.08, 2400, 'bandpass', 0.05); },
    ramHit: () => { tone(90, 40, 0.4, 'sine', 0.4); noise(0.4, 0.3, 450); noise(0.25, 0.15, 1600, 'bandpass', 0.04); tone(300, 120, 0.2, 'square', 0.06); },
    lasso: () => { noise(0.25, 0.07, 1900, 'bandpass'); tone(500, 900, 0.18, 'sine', 0.04); },
    snare: () => { tone(220, 330, 0.12, 'triangle', 0.09); noise(0.06, 0.06, 2800, 'highpass'); },
    evo: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0, 0.25, 'triangle', 0.1, i * 0.05)); noise(0.6, 0.05, 6000, 'highpass', 0.1); tone(200, 800, 0.4, 'sine', 0.05); },
    // a new card's unlock, by rarity
    unlock_common: () => { tone(523, 1046, 0.25, 'triangle', 0.08); noise(0.2, 0.05, 4000, 'highpass', 0.1); },
    unlock_rare: () => { tone(220, 660, 1.4, 'sawtooth', 0.04); noise(1.2, 0.05, 2200, 'bandpass'); [659, 784, 988].forEach((f, i) => tone(f, 0, 0.3, 'triangle', 0.08, 1.2 + i * 0.08)); },
    unlock_epic: () => { tone(110, 440, 2.2, 'sawtooth', 0.05); tone(165, 660, 2.2, 'triangle', 0.05); noise(2.2, 0.06, 900, 'bandpass'); },
    unlock_legendary: () => { tone(55, 220, 3.4, 'sawtooth', 0.06); tone(82, 330, 3.4, 'triangle', 0.06); noise(3.2, 0.05, 600, 'bandpass'); [262, 330, 392, 523].forEach((f, i) => tone(f, f * 1.01, 0.9, 'sine', 0.05, 0.6 + i * 0.6)); },
    rumble: () => { noise(0.8, 0.25, 140, 'lowpass'); tone(50, 35, 0.8, 'sine', 0.3); },
    firework: () => { noise(0.05, 0.2, 5000, 'highpass'); noise(0.5, 0.1, 2400, 'bandpass', 0.05); },
    unlockFanfare: () => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0, i === 6 ? 1 : 0.25, 'triangle', 0.16, i * 0.1)),
    buy: () => { tone(880, 1320, 0.1, 'triangle', 0.15); tone(1760, 0, 0.18, 'sine', 0.1, 0.09); },
    deploy: () => { tone(220, 90, 0.16, 'sine', 0.3); noise(0.12, 0.12, 600); },
    // deploy sounds by what lands: heavy, a swarm, a flyer, a ranged troop, a building
    deployHeavy: () => { tone(110, 40, 0.35, 'sine', 0.42); noise(0.3, 0.22, 260); tone(70, 30, 0.25, 'triangle', 0.15, 0.04); },
    deploySwarm: () => { for (let i = 0; i < 5; i++) { noise(0.04, 0.07, 1400 + i * 300, 'bandpass', i * 0.045); tone(420 + i * 40, 300, 0.04, 'triangle', 0.04, i * 0.045); } },
    deployAir: () => { for (let i = 0; i < 3; i++) noise(0.09, 0.08, 900, 'bandpass', i * 0.08); tone(500, 900, 0.18, 'sine', 0.05); },
    deployRanged: () => { tone(260, 120, 0.14, 'sine', 0.22); noise(0.08, 0.06, 3200, 'highpass', 0.05); tone(900, 1300, 0.06, 'triangle', 0.04, 0.06); },
    deployBuilding: () => { tone(180, 90, 0.2, 'square', 0.09); noise(0.18, 0.18, 700); tone(1200, 1100, 0.12, 'triangle', 0.05, 0.12); },
    crowdCheer: () => cheer(),
    // Briar Hollow cards
    spearsCast: () => { for (let i = 0; i < 6; i++) noise(0.14, 0.06, 2600 + i * 300, 'bandpass', i * 0.04); },
    spears: () => { for (let i = 0; i < 7; i++) { noise(0.05, 0.1, 900, 'bandpass', i * 0.035); tone(260 - i * 12, 150, 0.04, 'square', 0.05, i * 0.035); } },
    spin: () => { noise(0.3, 0.09, 1200, 'bandpass'); tone(160, 420, 0.25, 'sawtooth', 0.04); tone(140, 80, 0.12, 'square', 0.06, 0.22); },
    potThrow: () => { noise(0.1, 0.05, 1800, 'bandpass'); tone(400, 600, 0.08, 'sine', 0.04); },
    potBreak: () => { noise(0.18, 0.18, 3200, 'highpass'); [1800, 2400, 3100].forEach((f, i) => tone(f, f * 0.7, 0.05, 'triangle', 0.05, i * 0.03)); },
    spell: () => { noise(0.35, 0.12, 2200, 'bandpass'); tone(300, 600, 0.3, 'sawtooth', 0.05); },
    arrow: () => noise(0.06, 0.05, 3000, 'highpass'),
    cannon: () => { tone(140, 60, 0.12, 'square', 0.06); noise(0.08, 0.08, 500); },
    snow: () => noise(0.12, 0.08, 1500, 'bandpass'),
    hit: () => tone(180, 120, 0.05, 'square', 0.04),
    smash: () => { tone(110, 50, 0.14, 'square', 0.1); noise(0.1, 0.12, 400); },
    death: () => tone(400, 150, 0.15, 'triangle', 0.08),
    boom: () => { noise(0.5, 0.35, 380); tone(90, 40, 0.4, 'sine', 0.3); },
    tower: () => { noise(0.9, 0.45, 300); tone(70, 30, 0.8, 'sine', 0.4); },
    crown: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0, 0.18, 'triangle', 0.16, i * 0.09)),
    error: () => tone(160, 120, 0.15, 'square', 0.08),
    tick: () => tone(1000, 0, 0.05, 'square', 0.06),
    double: () => [523, 659, 784].forEach((f, i) => tone(f, 0, 0.16, 'triangle', 0.14, i * 0.08)),
    fight: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0, 0.2, 'sawtooth', 0.07, i * 0.07)); noise(0.3, 0.1, 900, 'bandpass', 0.28); },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0, i === 5 ? 0.6 : 0.2, 'triangle', 0.18, i * 0.14)),
    lose: () => [440, 392, 330, 262].forEach((f, i) => tone(f, 0, 0.3, 'triangle', 0.15, i * 0.2)),
    // Arenas 5 to 10
    freezeCast: () => { noise(0.3, 0.1, 6000, 'highpass'); tone(1400, 2600, 0.25, 'sine', 0.07); },
    freeze: () => { noise(0.7, 0.16, 5200, 'highpass'); [1568, 2093, 2637].forEach((f, i) => tone(f, f * 1.02, 0.5, 'sine', 0.06, i * 0.05)); },
    iceHit: () => { noise(0.12, 0.08, 4800, 'highpass'); tone(1800, 1200, 0.08, 'triangle', 0.05); },
    iceShatter: () => { noise(0.5, 0.2, 3600, 'highpass'); for (let i = 0; i < 5; i++) tone(2000 + Math.random() * 1500, 0, 0.08, 'triangle', 0.05, i * 0.05); },
    frostShot: () => { noise(0.14, 0.06, 5000, 'highpass'); tone(1200, 1800, 0.1, 'sine', 0.05); },
    stunZap: () => { noise(0.08, 0.06, 3000, 'bandpass'); tone(1800, 600, 0.07, 'square', 0.03); },
    gemFlash: () => { noise(0.15, 0.12, 4000, 'bandpass'); tone(900, 2400, 0.12, 'sawtooth', 0.05); },
    gemBoom: () => { noise(0.3, 0.2, 2500, 'bandpass'); [1319, 1760, 2349].forEach((f, i) => tone(f, 0, 0.3, 'triangle', 0.07, i * 0.03)); },
    shieldBreak: () => { noise(0.25, 0.18, 2200, 'bandpass'); tone(700, 260, 0.2, 'triangle', 0.08); },
    clunk: () => { tone(160, 90, 0.18, 'square', 0.08); noise(0.12, 0.12, 700); },
    coilRise: () => { tone(120, 420, 0.4, 'sawtooth', 0.05); noise(0.3, 0.05, 1500, 'bandpass'); },
    coilHide: () => tone(380, 110, 0.3, 'sawtooth', 0.04),
    coilZap: () => { noise(0.15, 0.14, 3500, 'bandpass'); tone(1600, 300, 0.12, 'square', 0.05); },
    sparkShot: () => { noise(0.1, 0.08, 4200, 'bandpass'); tone(2200, 900, 0.08, 'square', 0.035); },
    arcBlast: () => { noise(0.6, 0.3, 900); tone(220, 60, 0.5, 'sawtooth', 0.12); tone(2400, 300, 0.3, 'square', 0.05); },
    prism: () => { tone(1800, 2600, 0.12, 'sine', 0.06); tone(2700, 3600, 0.1, 'triangle', 0.03, 0.02); },
    puffShot: () => noise(0.2, 0.1, 900, 'lowpass'),
    hookThrow: () => { noise(0.25, 0.08, 1400, 'bandpass'); tone(500, 900, 0.2, 'triangle', 0.05); },
    hookHit: () => { tone(320, 160, 0.12, 'square', 0.08); noise(0.1, 0.1, 1200); },
    barrelThrow: () => { noise(0.3, 0.08, 900, 'bandpass'); tone(300, 500, 0.3, 'triangle', 0.05); },
    barrelBreak: () => { noise(0.3, 0.22, 900); tone(180, 80, 0.2, 'square', 0.08); },
    jump: () => { noise(0.3, 0.1, 600); tone(150, 360, 0.3, 'sawtooth', 0.06); },
    slam: () => { noise(0.5, 0.32, 300); tone(80, 35, 0.4, 'sine', 0.3); },
    heal: () => [784, 1047, 1319].forEach((f, i) => tone(f, 0, 0.25, 'sine', 0.06, i * 0.06)),
    chime: () => [1047, 1319, 1568].forEach((f, i) => tone(f, 0, 0.2, 'triangle', 0.06, i * 0.05)),
    leap: () => tone(500, 1100, 0.15, 'triangle', 0.06),
    egg: () => { tone(600, 400, 0.15, 'triangle', 0.07); noise(0.1, 0.05, 2000, 'bandpass'); },
    rebirth: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0, 0.3, 'triangle', 0.1, i * 0.07)); noise(0.6, 0.1, 2500, 'bandpass', 0.1); },
    fireBurst: () => { noise(0.5, 0.25, 1200); tone(300, 90, 0.4, 'sawtooth', 0.08); },
    portal: () => { tone(90, 60, 1.2, 'sawtooth', 0.06); tone(180, 120, 1.2, 'sine', 0.06); noise(1.0, 0.06, 500, 'lowpass'); },
    wraithRise: () => { tone(260, 180, 0.3, 'sine', 0.05); noise(0.2, 0.04, 1800, 'bandpass'); },
    meteorCast: () => { tone(200, 60, 1.0, 'sawtooth', 0.06); noise(1.0, 0.08, 400, 'lowpass'); },
    meteor: () => { noise(1.0, 0.5, 250); tone(60, 25, 0.9, 'sine', 0.45); },
    pop: () => tone(700, 1100, 0.06, 'triangle', 0.05),
  };
  // battle sounds heard over and over come out a little higher or lower each time
  const VARY = new Set(['hit', 'arrow', 'death', 'smash', 'cannon', 'snow', 'deploy', 'deployHeavy', 'deploySwarm', 'deployAir', 'deployRanged', 'deployBuilding', 'quill', 'iceHit', 'sparkShot', 'frostShot', 'puffShot', 'pop', 'stunZap']);
  function play(name) {
    if (!on || !SFX[name]) return;
    const now = performance.now();
    if (lastAt[name] && now - lastAt[name] < 45) return;
    lastAt[name] = now;
    pv = VARY.has(name) ? 0.93 + Math.random() * 0.14 : 1;
    try { SFX[name](); } catch (e) { /* audio unavailable */ }
    pv = 1;
  }

  /* ---------- music ----------
     Original tunes written as chord progressions and patterns, played by a small sequencer that looks a
     little ahead on the audio clock. 'lobby' is calm (C major); 'battle' drives (A minor) and gets
     faster and busier with `intensity`: 1 at double energy, 2 in overtime and sudden death. */
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const TRACKS = {
    lobby: { bpm: 96, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], bass: [48, 43, 45, 41],
      lead: [0, 2, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2], vol: 0.11 },
    battle: { bpm: 122, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [45, 41, 36, 43],
      lead: [0, -1, 2, -1, 1, 2, -1, 0, 3, -1, 2, 1, -1, 2, 0, -1], vol: 0.12 },
  };
  const M = { track: null, intensity: 0, step: 0, next: 0, timer: 0 };
  function mnote(t, f, dur, type, vol, cutoff) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (cutoff) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; o.connect(fl); fl.connect(g); } else o.connect(g);
    g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function mdrum(t, kind, vol) {
    if (kind === 'kick') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25); return; }
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), len = kind === 'snare' ? 0.16 : kind === 'tom' ? 0.2 : 0.04;
    src.buffer = noiseBuf; f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : kind === 'tom' ? 300 : 1800;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g); g.connect(musicBus); src.start(t); src.stop(t + len + 0.02);
  }
  // one sixteenth of a bar
  function mstep(t, T, k) {
    const bar = Math.floor(k / 16) % 4, s16 = k % 16, I = M.intensity, v = T.vol;
    // tension: the last chord of the battle progression darkens in overtime
    const ch = T.chords[bar].map(n => n + (M.track === 'battle' && I >= 2 && bar === 3 ? -1 : 0)), beat = 60 / (T.bpm * (1 + I * 0.1)) / 4;
    if (s16 === 0) for (const n of ch) mnote(t, NOTE(n), beat * 15, 'triangle', v * 0.32, 1800);
    if (M.track === 'lobby') {
      if (s16 % 8 === 0) mnote(t, NOTE(T.bass[bar]), beat * 7, 'sine', v * 0.9);
      if (s16 % 2 === 0) { const li = T.lead[(s16 / 2 + bar * 2) % T.lead.length]; mnote(t, NOTE(ch[li % 3] + 12 * (li >= 3 ? 1 : 0) + 12), beat * 3, 'triangle', v * 0.42); }
      if (s16 % 4 === 2) mdrum(t, 'hat', v * 0.25);
    } else {
      if (s16 % 2 === 0) mnote(t, NOTE(T.bass[bar] - 12 + (s16 % 8 === 6 ? 12 : 0)), beat * 1.6, 'sawtooth', v * 0.5, 600 + I * 300);
      if (s16 % 8 === 0) mdrum(t, 'kick', v * 2.2);
      if (s16 % 8 === 4) mdrum(t, 'snare', v * 1.1);
      if (I >= 1 && s16 % 2 === 1) mdrum(t, 'hat', v * 0.35);
      if (I >= 2 && s16 >= 12 && bar === 3) mdrum(t, 'tom', v * 1.2);
      const li = T.lead[s16];
      if (li >= 0 && (s16 % 2 === 0 || I >= 1)) mnote(t, NOTE(ch[li % 3] + 12 * (li >= 3 ? 2 : 1)), beat * 1.8, 'square', v * 0.16, 2400);
    }
  }
  function schedule() {
    if (!ac || !M.track) return;
    const T = TRACKS[M.track];
    while (M.next < ac.currentTime + 0.25) {
      mstep(M.next, T, M.step);
      M.next += 60 / (T.bpm * (1 + M.intensity * 0.1)) / 4;
      M.step++;
    }
  }
  function music(track) {
    if (track === M.track) return;
    M.track = track || null; M.intensity = 0;
    if (!musicOn || !track) { fadeMusic(0); return; }
    const a = ensure(true); if (!a) return;
    M.step = 0; M.next = a.currentTime + 0.1;
    fadeMusic(1);
    if (!M.timer) M.timer = setInterval(schedule, 60);
  }
  function fadeMusic(to) {
    if (!musicBus) return;
    const t = ac.currentTime;
    musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(to, t + (to ? 1.2 : 0.6));
  }
  // the crowd: a murmur under the battle, and a cheer when a tower falls
  let crowdSrc = null;
  function crowd(onOff) {
    if (!onOff) { if (crowdBus) { const t = ac.currentTime; crowdBus.gain.cancelScheduledValues(t); crowdBus.gain.setValueAtTime(crowdBus.gain.value, t); crowdBus.gain.linearRampToValueAtTime(0, t + 0.8); } return; }
    if (!on) return;
    const a = ensure(); if (!a) return;
    if (!crowdSrc) {
      const n = a.sampleRate * 3, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      let lp = 0; for (let i = 0; i < n; i++) { lp = lp * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = lp * (0.7 + 0.3 * Math.sin(i / n * Math.PI * 6)); }
      crowdSrc = a.createBufferSource(); crowdSrc.buffer = buf; crowdSrc.loop = true;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
      crowdSrc.connect(f); f.connect(crowdBus); crowdSrc.start();
    }
    const t = a.currentTime;
    crowdBus.gain.cancelScheduledValues(t); crowdBus.gain.setValueAtTime(crowdBus.gain.value, t); crowdBus.gain.linearRampToValueAtTime(0.5, t + 1.5);
  }
  function cheer() {
    if (!crowdBus || !on) return;
    const t = ac.currentTime;
    crowdBus.gain.cancelScheduledValues(t); crowdBus.gain.setValueAtTime(crowdBus.gain.value, t);
    crowdBus.gain.linearRampToValueAtTime(2.6, t + 0.25); crowdBus.gain.linearRampToValueAtTime(0.5, t + 2.4);
    noise(0.8, 0.08, 1100, 'bandpass', 0.05);
  }
  return {
    play, unlock: () => ensure(true), music, crowd,
    intensity(n) { M.intensity = n; },
    get on() { return on; },
    set on(v) { on = !!v; try { localStorage.setItem('kc.sound', on ? 'on' : 'off'); } catch (e) { /* storage blocked */ } if (on) ensure(); else crowd(false); },
    get musicOn() { return musicOn; },
    set musicOn(v) {
      musicOn = !!v; try { localStorage.setItem('kc.music', musicOn ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
      const t = M.track; M.track = null; if (musicOn) music(t); else { fadeMusic(0); M.track = t; }
    },
  };
})();
