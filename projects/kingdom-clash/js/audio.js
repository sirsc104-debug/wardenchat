/* Kingdom Clash: sound effects made on the fly with Web Audio (no sound files). Starts on the first
   click, as browsers require. */
'use strict';

const KCSound = (() => {
  let ac = null, master = null, on = true;
  const lastAt = {};
  let snapN = 0, snapAt = 0;
  try { on = localStorage.getItem('kc.sound') !== 'off'; } catch (e) { /* storage blocked */ }

  function ensure() {
    if (!on) return null;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f1, f2, dur, type, vol, delay) {
    const a = ensure(); if (!a) return;
    const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
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
    coinTick: () => tone(1250 + Math.random() * 500, 0, 0.05, 'square', 0.045),
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
    emPhrase: () => { tone(700, 1050, 0.08, 'triangle', 0.12); noise(0.05, 0.05, 3000, 'highpass'); },
    // Sunstone Arena cards and evolutions
    sandstorm: () => { noise(1.4, 0.12, 700, 'bandpass'); noise(1.2, 0.06, 2600, 'bandpass', 0.2); tone(120, 220, 1.2, 'sine', 0.05); },
    dig: () => { for (let i = 0; i < 4; i++) noise(0.08, 0.12, 380, 'lowpass', i * 0.07); },
    surface: () => { tone(110, 50, 0.25, 'sine', 0.3); noise(0.35, 0.2, 500); noise(0.2, 0.08, 2400, 'bandpass', 0.05); },
    ramHit: () => { tone(90, 40, 0.4, 'sine', 0.4); noise(0.4, 0.3, 450); noise(0.25, 0.15, 1600, 'bandpass', 0.04); tone(300, 120, 0.2, 'square', 0.06); },
    lasso: () => { noise(0.25, 0.07, 1900, 'bandpass'); tone(500, 900, 0.18, 'sine', 0.04); },
    snare: () => { tone(220, 330, 0.12, 'triangle', 0.09); noise(0.06, 0.06, 2800, 'highpass'); },
    evo: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0, 0.25, 'triangle', 0.1, i * 0.05)); noise(0.6, 0.05, 6000, 'highpass', 0.1); tone(200, 800, 0.4, 'sine', 0.05); },
    buy: () => { tone(880, 1320, 0.1, 'triangle', 0.15); tone(1760, 0, 0.18, 'sine', 0.1, 0.09); },
    deploy: () => { tone(220, 90, 0.16, 'sine', 0.3); noise(0.12, 0.12, 600); },
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
  };
  function play(name) {
    if (!on || !SFX[name]) return;
    const now = performance.now();
    if (lastAt[name] && now - lastAt[name] < 45) return;
    lastAt[name] = now;
    try { SFX[name](); } catch (e) { /* audio unavailable */ }
  }
  return {
    play, unlock: ensure,
    get on() { return on; },
    set on(v) { on = !!v; try { localStorage.setItem('kc.sound', on ? 'on' : 'off'); } catch (e) { /* storage blocked */ } if (on) ensure(); },
  };
})();
