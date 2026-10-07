/* Brain Rocket — tiny synthesized sound effects (Web Audio, no files). */
'use strict';

const Sound = (function () {
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('brainRocket.muted') === '1'; } catch (e) { /* storage blocked */ }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  }

  function tone(freq, dur, { type = 'sine', vol = 0.3, delay = 0, slide = 0, attack = 0.01 } = {}) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, { vol = 0.3, freq = 800, q = 0.7, delay = 0, sweepTo = 0 } = {}) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur);
  }

  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

  return {
    unlock: ensure,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('brainRocket.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (ensure()) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    click() { tone(660, 0.08, { type: 'triangle', vol: 0.15 }); },
    count() { tone(440, 0.18, { type: 'square', vol: 0.12 }); },
    go() { tone(880, 0.4, { type: 'square', vol: 0.14 }); tone(1320, 0.4, { type: 'triangle', vol: 0.1, delay: 0.05 }); },
    rumble(dur = 1.6) { noise(dur, { vol: 0.35, freq: 180, sweepTo: 600 }); },
    boost(tier) {
      noise(0.9 + tier * 0.15, { vol: 0.28, freq: 300, sweepTo: 2400 + tier * 400 });
      const n = 2 + tier;
      for (let i = 0; i < n; i++) tone(notes[i], 0.22, { type: 'triangle', vol: 0.16, delay: i * 0.07 });
      if (tier >= 4) tone(notes[7], 0.6, { type: 'sine', vol: 0.18, delay: n * 0.07 });
    },
    wrong() { tone(180, 0.22, { type: 'sawtooth', vol: 0.12, slide: -60 }); },
    tick(urgent) { tone(urgent ? 1000 : 750, 0.05, { type: 'square', vol: 0.06 }); },
    timeout() {
      tone(392, 0.25, { type: 'square', vol: 0.12 });
      tone(311, 0.45, { type: 'square', vol: 0.12, delay: 0.22 });
      noise(0.5, { vol: 0.25, freq: 400, delay: 0.1, sweepTo: 80 });
    },
    // bad word: a falling whistle, then a big boom (rocket) or a splash (sub)
    dive() { tone(1400, 1.6, { type: 'sine', vol: 0.12, slide: -1100, attack: 0.2 }); },
    boom() { noise(1.8, { vol: 0.5, freq: 220, sweepTo: 50 }); tone(70, 1.2, { type: 'sawtooth', vol: 0.2, slide: -40 }); },
    splash() { noise(1.1, { vol: 0.4, freq: 1800, sweepTo: 300 }); },
    skip() { tone(500, 0.15, { type: 'triangle', vol: 0.12, slide: -200 }); },
    milestone() {
      [0, 2, 4, 7].forEach((n, i) => tone(notes[n] / 2, 0.3, { type: 'square', vol: 0.1, delay: i * 0.12 }));
      tone(notes[7] / 2, 0.9, { type: 'triangle', vol: 0.15, delay: 0.5 });
      tone(notes[4], 0.9, { type: 'sine', vol: 0.1, delay: 0.5 });
    },
    gameOver() {
      [392, 370, 349, 262].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.35, { type: 'triangle', vol: 0.16, delay: i * 0.32, slide: i === 3 ? -80 : 0 }));
    },
    best() { [0, 2, 4, 5, 7].forEach((n, i) => tone(notes[n], 0.2, { type: 'triangle', vol: 0.14, delay: 0.9 + i * 0.09 })); }
  };
})();
