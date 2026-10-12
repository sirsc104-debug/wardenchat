/* Apples to Oranges — sound effects, made on the fly with Web Audio (no sound files). */
'use strict';

const Sound = (function () {
  let ctx = null, master = null;
  let muted = false;
  try { muted = localStorage.getItem('a2o.muted') === '1'; } catch (e) { /* storage blocked */ }

  // Browsers only allow sound after a click or key press.
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, to = null, attack = 0.005 } = {}) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, { vol = 0.2, at = 0, freq = 1200, q = 0.8, type = 'bandpass' } = {}) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + at;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

  return {
    unlock: ensure,
    isMuted: () => muted,
    setMuted(m) {
      muted = m;
      try { localStorage.setItem('a2o.muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    click() { tone(660, 0.06, { type: 'triangle', vol: 0.12 }); },
    tick() { tone(1400, 0.025, { type: 'square', vol: 0.03 }); },
    // the slow final ticks of a photo finish, each a little higher
    photoTick(i) { tone(330 + i * 40, 0.12, { type: 'triangle', vol: 0.22 }); noise(0.08, { vol: 0.25, freq: 180, type: 'lowpass' }); },
    drumroll(sec) {
      for (let t = 0; t < sec; t += 0.045) noise(0.05, { vol: 0.08 + 0.12 * (t / sec), at: t, freq: 220, type: 'lowpass' });
    },
    good(tier) {
      const steps = 2 + tier;
      for (let i = 0; i < steps; i++) tone(NOTES[i + (tier > 2 ? 2 : 0)], 0.18, { type: 'triangle', vol: 0.16, at: i * 0.07 });
    },
    bad() {
      tone(220, 0.35, { type: 'sawtooth', vol: 0.12, to: 110 });
      tone(233, 0.35, { type: 'square', vol: 0.05, to: 116 });
    },
    photoWin() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.09, at: i * 0.1 }));
      tone(1046.5, 0.9, { type: 'triangle', vol: 0.2, at: 0.4 });
      tone(1318.51, 0.9, { type: 'triangle', vol: 0.14, at: 0.4 });
      noise(0.5, { vol: 0.25, at: 0.4, freq: 5000, type: 'highpass' });
    },
    photoLose() {
      // sad trombone
      [392, 370, 349, 330].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.32, { type: 'sawtooth', vol: 0.11, at: i * 0.33, to: i === 3 ? 300 : null }));
    },
    tie() {
      [659.25, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.16, { type: 'square', vol: 0.08, at: i * 0.09 }));
      tone(1567.98, 0.6, { type: 'sine', vol: 0.15, at: 0.36, to: 2093 });
    },
    timeout() { tone(440, 0.5, { type: 'square', vol: 0.08, to: 220 }); },
    milestone() {
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.12, at: i * 0.08 }));
    },
    burner() { noise(0.6, { vol: 0.18, freq: 600, q: 0.4 }); },
    over() {
      [523.25, 440, 349.23, 261.63].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.14, at: i * 0.16 }));
    }
  };
})();
