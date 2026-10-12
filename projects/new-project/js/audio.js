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

  // at: seconds from now; t: an exact AudioContext time (the music uses this); out: where to send it
  function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, t = 0, to = null, attack = 0.005, out = null, vibrato = 0 } = {}) {
    if (!ensure() || muted) return;
    const t0 = t || ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = vibrato;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    o.connect(g); g.connect(out || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, { vol = 0.2, at = 0, t = 0, freq = 1200, q = 0.8, type = 'bandpass', out = null } = {}) {
    if (!ensure() || muted) return;
    const t0 = t || ctx.currentTime + at;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(out || master);
    src.start(t0);
  }

  /* ---- Background music: a short loop, made on the fly, the same way Brain Rocket does it ----------
     A track is a tempo, a loop length in eighth-notes and a step(i, t, out, E) that plays eighth i at
     time t (E is one eighth, in seconds). Breeze plays on the launch field and in the lower sky; Sky
     fades in once the balloon is past the jet planes. Music has its own switch (home screen and pause
     menu), remembered in this browser, and the 🔊 button silences it too. */
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note -> Hz
  const TRACKS = {
    // Breeze: a sunny afternoon at the orchard. F – Dm – Bb – C, a plucked ukulele strum, a bouncy
    // bass, a shaker, and a whistled tune every other time round.
    breeze: { bpm: 116, vol: 0.5, echo: 3, fb: 0.22, steps: 64,
      chords: [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55]],
      tune: [72, 0, 69, 0, 72, 74, 72, 0, 69, 0, 65, 0, 67, 69, 67, 0,
             70, 0, 74, 0, 72, 70, 69, 0, 67, 0, 64, 0, 67, 0, 0, 0],
      step(i, t, out, E) {
        const j = i % 32, ch = this.chords[Math.floor(j / 8)], k = j % 8;
        // ukulele: down-strums on the beat, single plucks between
        if (k === 0 || k === 3 || k === 6) ch.forEach((n, s) => tone(hz(n + 12), E * 1.5, { type: 'triangle', vol: 0.045, t: t + s * 0.012, out }));
        else tone(hz(ch[[0, 1, 2, 1, 2, 0, 1, 2][k]] + 24), E * 0.9, { type: 'triangle', vol: 0.035, t, out });
        // bass: root and fifth
        if (k === 0 || k === 4) tone(hz(ch[0] - 12 + (k === 4 ? 7 : 0)), E * 1.8, { type: 'sine', vol: 0.13, t, out });
        // shaker on the off-beats
        if (k % 2 === 1) noise(0.05, { vol: 0.025, freq: 7000, type: 'highpass', t, out });
        const m = this.tune[j];
        if (m && i >= 32) tone(hz(m + 12), E * 1.7, { type: 'sine', vol: 0.05, t, out, vibrato: 6, attack: 0.03 });
      } },
    // Sky: up past the jet planes, slow and floaty. Fmaj7 – Am7 – Bbmaj7 – Csus, soft pads,
    // a deep bass and twinkles.
    sky: { bpm: 76, vol: 0.5, echo: 2, fb: 0.45, steps: 32,
      chords: [[53, 57, 60, 64], [45, 48, 52, 55], [46, 50, 53, 57], [48, 53, 55, 60]],
      step(i, t, out, E) {
        const ch = this.chords[Math.floor(i / 8)];
        if (i % 8 === 0) {
          for (const n of ch.slice(1)) tone(hz(n + 12), E * 8, { type: 'sine', vol: 0.028, t, out, attack: 0.9 });
          tone(hz(ch[0] - 12), E * 6, { type: 'sine', vol: 0.12, t, out, attack: 0.2 });
        }
        if (i % 2 === 0) tone(hz(ch[(i / 2) % 4] + 24), E * 2.5, { type: 'sine', vol: 0.045, t, out, attack: 0.04 });
        if (i % 8 === 5) tone(hz(ch[3] + 36), 0.9, { type: 'sine', vol: 0.025, t, out });
      } }
  };
  const M = { name: null, track: null, gain: null, step: 0, next: 0, timer: null, level: 1, enabled: true };
  try { M.enabled = localStorage.getItem('a2o.music') !== '0'; } catch (e) { /* storage blocked */ }
  function scheduleMusic() {
    const T = M.track, E = 60 / T.bpm / 2;
    if (M.next < ctx.currentTime) M.next = ctx.currentTime + 0.05;   // the tab was asleep: don't rush to catch up
    while (M.next < ctx.currentTime + 0.25) {
      T.step(M.step % T.steps, M.next, M.gain, E);
      M.step++; M.next += E;
    }
  }
  // Fade the old loop out and the new one in. name: a key of TRACKS, or null for silence.
  let wanted = null;
  function playMusic(name) {
    wanted = name;
    const want = M.enabled && TRACKS[name] ? name : null;
    if (want === M.name) return;
    if (want && !ensure()) return;
    if (M.gain) { const g = M.gain; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => g.disconnect(), 2500); }
    clearInterval(M.timer); M.timer = null; M.gain = null; M.track = null;
    M.name = want;
    if (!want) return;
    const T = M.track = TRACKS[want], E = 60 / T.bpm / 2;
    // each loop gets its own echo, so it sounds like it's playing out in the open
    const g = M.gain = ctx.createGain(); g.gain.value = 0;
    const d = ctx.createDelay(2); d.delayTime.value = E * T.echo;
    const fb = ctx.createGain(); fb.gain.value = T.fb;
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    g.connect(master); g.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master);
    g.gain.setTargetAtTime(T.vol * M.level, ctx.currentTime, 0.8);
    M.step = 0; M.next = ctx.currentTime + 0.1;
    scheduleMusic();
    M.timer = setInterval(scheduleMusic, 100);
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
    // Background music: music('breeze'), music('sky') or music(null).
    music: playMusic,
    musicEnabled: () => M.enabled,
    setMusicEnabled(on) {
      M.enabled = on;
      try { localStorage.setItem('a2o.music', on ? '1' : '0'); } catch (e) { /* ignore */ }
      const w = wanted; playMusic(on ? w : null); wanted = w;
    },
    // turn the music down while a photo finish plays out (1 = full, 0 = silent)
    musicLevel(x) {
      M.level = Math.max(0, Math.min(1, x));
      if (M.gain) M.gain.gain.setTargetAtTime(M.track.vol * M.level, ctx.currentTime, 0.25);
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
