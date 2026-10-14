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
      } },
    // Real Size, the dragon ride: an adventure theme. D – Bm – G – A, a harp, timpani and a horn tune.
    dragon: { bpm: 100, vol: 0.5, echo: 3, fb: 0.3, steps: 64,
      chords: [[50, 54, 57], [47, 50, 54], [43, 47, 50], [45, 49, 52]],
      tune: [74, 0, 0, 76, 78, 0, 74, 0, 71, 0, 0, 74, 76, 0, 0, 0, 67, 0, 71, 74, 79, 0, 78, 76, 76, 0, 0, 0, 73, 0, 0, 0],
      step(i, t, out, E) {
        const j = i % 32, ch = this.chords[Math.floor(j / 8)], k = j % 8;
        tone(hz(ch[[0, 1, 2, 1][k % 4]] + 12 + (k >= 4 ? 12 : 0)), E * 1.2, { type: 'triangle', vol: 0.04, t, out });   // harp
        if (k === 0) { tone(hz(ch[0] - 12), 0.5, { type: 'sine', vol: 0.18, t, out, to: hz(ch[0] - 14) }); noise(0.12, { vol: 0.08, freq: 140, type: 'lowpass', t, out }); }
        if (k === 4) tone(hz(ch[0] - 12), 0.3, { type: 'sine', vol: 0.1, t, out });
        const m = this.tune[j];
        if (m && i >= 32) tone(hz(m - 12), E * 2.2, { type: 'triangle', vol: 0.08, t, out, vibrato: 4, attack: 0.06 });   // horn
      } },
    // Guess the Number, the endless tree: a skippy plucked tune with a woodblock and a flute.
    forest: { bpm: 124, vol: 0.45, echo: 2, fb: 0.2, steps: 64,
      chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]],
      tune: [79, 0, 76, 79, 81, 0, 79, 0, 76, 0, 74, 0, 72, 74, 76, 0, 74, 0, 72, 0, 71, 72, 74, 0, 79, 0, 78, 0, 74, 0, 0, 0],
      step(i, t, out, E) {
        const j = i % 32, ch = this.chords[Math.floor(j / 8)], k = j % 8;
        if (k % 2 === 0) tone(hz(ch[(k / 2) % 3] + 12), 0.12, { type: 'triangle', vol: 0.06, t, out });   // pizzicato
        if (k === 0 || k === 4) tone(hz(ch[0] - 12), E * 1.4, { type: 'sine', vol: 0.12, t, out });
        if (k % 2 === 1) noise(0.03, { vol: 0.05, freq: 2200, q: 6, t, out });   // woodblock
        const m = this.tune[j];
        if (m && i >= 32) tone(hz(m), E * 1.6, { type: 'sine', vol: 0.05, t, out, vibrato: 5, attack: 0.03 });   // flute
      } },
    // Fruit Dash, the kitchen race: a quick, bouncy loop. C – Am – F – G, a marimba, slap bass, a
    // snappy snare on the backbeat and a whistled tune every other time round.
    dash: { bpm: 152, vol: 0.5, echo: 2, fb: 0.18, steps: 64,
      chords: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]],
      tune: [76, 0, 79, 0, 76, 74, 72, 0, 72, 0, 76, 0, 74, 0, 0, 0, 77, 0, 76, 74, 72, 0, 69, 0, 71, 0, 74, 0, 79, 0, 0, 0],
      step(i, t, out, E) {
        const j = i % 32, ch = this.chords[Math.floor(j / 8)], k = j % 8;
        tone(hz(ch[[0, 2, 1, 2, 0, 2, 1, 2][k]] + 24), 0.1, { type: 'sine', vol: 0.07, t, out });   // marimba
        if (k === 0 || k === 3 || k === 6) tone(hz(ch[0] - 12 + (k === 3 ? 7 : 0)), E * 0.9, { type: 'triangle', vol: 0.16, t, out });   // slap bass
        if (k === 2 || k === 6) noise(0.09, { vol: 0.07, freq: 1800, q: 0.7, t, out });   // snare
        if (k % 2 === 1) noise(0.03, { vol: 0.02, freq: 8000, type: 'highpass', t, out });   // hi-hat
        const m = this.tune[j];
        if (m && i >= 32) tone(hz(m + 12), E * 1.4, { type: 'sine', vol: 0.045, t, out, vibrato: 5, attack: 0.02 });   // whistle
      } },
    // Halloween: a spooky waltz-ish loop in E minor. Music box, organ bass, bells and a wobbly theremin.
    spooky: { bpm: 100, vol: 0.85, echo: 3, fb: 0.35, steps: 64,
      chords: [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]],
      tune: [71, 0, 67, 0, 64, 0, 71, 0, 72, 0, 71, 0, 67, 0, 64, 0, 69, 0, 72, 0, 76, 0, 75, 0, 71, 0, 0, 0, 66, 0, 71, 0],
      step(i, t, out, E) {
        const j = i % 32, ch = this.chords[Math.floor(j / 8)], k = [0, 1, 2, 3, 2, 1, 0, 1][j % 8];
        tone(hz((k === 3 ? ch[0] + 12 : ch[k]) + 24), E * 1.6, { type: 'triangle', vol: 0.08, t, out });   // music box
        if (j % 4 === 0) { tone(hz(ch[0] - 12), E * 3.6, { type: 'sine', vol: 0.15, t, out }); tone(hz(ch[0]), E * 3.6, { type: 'square', vol: 0.022, t, out }); }
        if (j % 8 === 0) tone(hz(ch[0] + 36), 1.2, { type: 'sine', vol: 0.05, t, out });   // bell
        const m = this.tune[j];
        if (m && i >= 32) tone(hz(m), E * 1.9, { type: 'sine', vol: 0.1, t, out, vibrato: 8, attack: 0.08 });   // theremin
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
    // the race countdown: three beeps, then a higher GO
    countBeep(go) { tone(go ? 1046.5 : 523.25, go ? 0.45 : 0.18, { type: 'square', vol: go ? 0.12 : 0.09 }); },
    // the race is over: a referee's whistle
    whistle() { tone(2300, 0.5, { type: 'sine', vol: 0.12, vibrato: 60 }); tone(2350, 0.22, { type: 'sine', vol: 0.08, at: 0.55, vibrato: 60 }); },
    // a fruit tripping over: a squelchy slip
    slip() { tone(500, 0.25, { type: 'sine', vol: 0.12, to: 140 }); noise(0.15, { vol: 0.1, freq: 900, q: 1.5, at: 0.05 }); },
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
    // Halloween: the heartbeat as the ghost gets close, and its hiss before a lunge
    heartbeat() {
      tone(60, 0.16, { type: 'sine', vol: 0.5, to: 40 });
      tone(56, 0.16, { type: 'sine', vol: 0.4, at: 0.22, to: 38 });
    },
    hiss() { noise(0.9, { vol: 0.22, freq: 4500, type: 'highpass' }); tone(220, 0.8, { type: 'sawtooth', vol: 0.05, to: 120 }); },
    caught() { tone(300, 1.2, { type: 'sawtooth', vol: 0.1, to: 60 }); noise(1.2, { vol: 0.2, freq: 300, type: 'lowpass' }); },
    escape() { [523.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.2, { type: 'square', vol: 0.08, at: i * 0.07 })); },
    roar() { tone(180, 0.6, { type: 'sawtooth', vol: 0.09, to: 90 }); noise(0.6, { vol: 0.16, freq: 500, q: 0.5 }); },
    chirp() { tone(1600, 0.08, { type: 'sine', vol: 0.08, to: 2200 }); tone(1800, 0.08, { type: 'sine', vol: 0.06, at: 0.1, to: 2400 }); },
    milestone() {
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.12, at: i * 0.08 }));
    },
    burner() { noise(0.6, { vol: 0.18, freq: 600, q: 0.4 }); },
    over() {
      [523.25, 440, 349.23, 261.63].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.14, at: i * 0.16 }));
    }
  };
})();
