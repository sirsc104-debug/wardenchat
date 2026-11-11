/* Kingdom Clash: sound effects made on the fly with Web Audio (no sound files). Starts on the first
   click, as browsers require. */
'use strict';

const KCSound = (() => {
  let ac = null, master = null, on = true;
  const lastAt = {};
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
