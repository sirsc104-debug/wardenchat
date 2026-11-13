/* Brain Rocket – Evolved: synthesized sound effects and music (Web Audio, no files). Brain Rocket's
   sound effects, with the Evolved music in place of its tracks. */
'use strict';

const Sound = (function () {
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('brEvolved.muted') === '1'; } catch (e) { /* storage blocked */ }

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

  function tone(freq, dur, { type = 'sine', vol = 0.3, delay = 0, slide = 0, attack = 0.01, at = 0, out = null, vibrato = 0 } = {}) {
    if (!ensure() || muted) return;
    const t = at || ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = vibrato;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    o.connect(g); g.connect(out || master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* ---- Background music: a short loop for each way to play, made on the fly -------------------
     A track is a tempo, a loop length in eighth-notes and a step(i, t, out, E) that plays eighth i
     at time t (E is one eighth, in seconds). Rocket, Submarine, Play With Friends and Elevator are
     quiet; Haunted Flight's spooky tune is louder. Music can be switched off on its own (pause menu). */
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note -> Hz
  const TRACKS = {
    // Evolved: a dusky synthwave loop. Am – F – C – G, pulsing bass, a gated arpeggio and a soft lead
    // that joins every other time round.
    evolved: { bpm: 100, vol: 0.5, echo: 3, fb: 0.3, steps: 64,
      chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]],
      lead: [76, 0, 0, 74, 72, 0, 69, 0, 72, 0, 0, 0, 67, 0, 0, 0, 72, 0, 0, 74, 76, 0, 79, 0, 74, 0, 0, 0, 71, 0, 0, 0],
      step(i, t, out, E) {
        const j = i % 32, ch = this.chords[Math.floor(j / 8)];
        tone(hz(ch[0] - 12), E * 0.8, { type: 'sawtooth', vol: 0.05, at: t, out });
        if (j % 2 === 0) tone(hz(ch[0] - 24), E * 1.6, { type: 'sine', vol: 0.14, at: t, out });
        const k = [0, 1, 2, 1, 0, 2, 1, 2][j % 8];
        tone(hz(ch[k] + 24), E * 0.6, { type: 'square', vol: 0.022, at: t, out });
        if (j % 8 === 0) for (const n of ch) tone(hz(n + 12), E * 7.5, { type: 'triangle', vol: 0.035, at: t, out, attack: 0.4 });
        if (j % 4 === 2) noise(0.05, { vol: 0.05, freq: 7000, at: t, out });
        const m = this.lead[j];
        if (m && i >= 32) tone(hz(m), E * 2.6, { type: 'triangle', vol: 0.075, at: t, out, vibrato: 4, attack: 0.05 });
      } },
    // Results: the same chords, slow and open
    results: { bpm: 72, vol: 0.45, echo: 2, fb: 0.4, steps: 32,
      chords: [[45, 48, 52, 55], [41, 45, 48, 52], [48, 52, 55, 59], [43, 47, 50, 55]],
      step(i, t, out, E) {
        const ch = this.chords[Math.floor(i / 8) % 4];
        if (i % 8 === 0) { tone(hz(ch[0] - 12), E * 7.5, { type: 'sine', vol: 0.12, at: t, out }); for (const n of ch) tone(hz(n + 12), E * 7.5, { type: 'triangle', vol: 0.03, at: t, out, attack: 0.6 }); }
        if (i % 2 === 0) tone(hz(ch[(i / 2) % 4] + 24), E * 2, { type: 'sine', vol: 0.05, at: t, out });
      } }
  };

  const M = { name: null, track: null, gain: null, step: 0, next: 0, timer: null, level: 1, enabled: true };
  try { M.enabled = localStorage.getItem('brEvolved.music') !== '0'; } catch (e) { /* storage blocked */ }
  function scheduleMusic() {
    const T = M.track, E = 60 / T.bpm / 2;
    while (M.next < ctx.currentTime + 0.25) {
      T.step(M.step % T.steps, M.next, M.gain, E);
      M.step++; M.next += E;
    }
  }
  // Fade the old loop out and the new one in. name: a key of TRACKS, or null for silence.
  function playMusic(name) {
    const want = M.enabled && TRACKS[name] ? name : null;
    if (want === M.name) return;
    if (want && !ensure()) return;
    if (M.gain) { const g = M.gain; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => g.disconnect(), 2000); }
    clearInterval(M.timer); M.timer = null; M.gain = null; M.track = null;
    M.name = want;
    if (!want) return;
    const T = M.track = TRACKS[want], E = 60 / T.bpm / 2;
    // each loop gets its own echo, so it sounds like it's playing somewhere
    const g = M.gain = ctx.createGain(); g.gain.value = 0;
    const d = ctx.createDelay(2); d.delayTime.value = E * T.echo;
    const fb = ctx.createGain(); fb.gain.value = T.fb;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    g.connect(master); g.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master);
    g.gain.setTargetAtTime(T.vol * M.level, ctx.currentTime, 0.6);
    M.step = 0; M.next = ctx.currentTime + 0.1;
    scheduleMusic();
    M.timer = setInterval(scheduleMusic, 100);
  }

  function noise(dur, { vol = 0.3, freq = 800, q = 0.7, delay = 0, sweepTo = 0, at = 0, out = null } = {}) {
    if (!ensure() || muted) return;
    const t = at || ctx.currentTime + delay;
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
    src.connect(f); f.connect(g); g.connect(out || master);
    src.start(t); src.stop(t + dur);
  }

  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

  return {
    unlock: ensure,
    // Background music: music('rocket'), music('haunt') … or music(null). The 🔊 mute button silences it too.
    music: playMusic,
    get musicOn() { return !!M.name; },
    get musicTrack() { return M.name; },
    // the pause menu's music switch, remembered in this browser
    get musicEnabled() { return M.enabled; },
    setMusicEnabled(on, name) {
      M.enabled = !!on;
      try { localStorage.setItem('brEvolved.music', on ? '1' : '0'); } catch (e) { /* ignore */ }
      playMusic(on ? name : null);
    },
    // turn the music down while the heartbeat takes over (1 = full, 0 = silent)
    musicLevel(x) {
      M.level = Math.max(0, Math.min(1, x));
      if (M.gain) M.gain.gain.setTargetAtTime(M.track.vol * M.level, ctx.currentTime, 0.3);
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('brEvolved.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
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
    // Haunted Flight: a heartbeat that gets louder as the ghost closes in, its wail, and a skip whoosh
    heartbeat(p = 0) {
      const v = 0.14 + 0.2 * p;
      tone(64, 0.14, { type: 'sine', vol: v, attack: 0.005 });
      tone(54, 0.18, { type: 'sine', vol: v * 0.8, delay: 0.17, attack: 0.005 });
    },
    ghost() {
      tone(440, 1.5, { type: 'sine', vol: 0.12, slide: -280, attack: 0.3 });
      tone(466, 1.5, { type: 'triangle', vol: 0.06, slide: -290, attack: 0.3, delay: 0.06 });
      noise(1.3, { vol: 0.12, freq: 900, sweepTo: 200 });
    },
    // Ultra Haunted Flight: a rising hiss as its eyes flash, then the lunge
    hiss() { noise(1.3, { vol: 0.18, freq: 500, sweepTo: 4000 }); tone(300, 1.3, { type: 'sawtooth', vol: 0.05, slide: 500, attack: 0.4 }); },
    lunge() { noise(0.5, { vol: 0.35, freq: 1800, sweepTo: 200 }); tone(160, 0.5, { type: 'sawtooth', vol: 0.14, slide: -90 }); },
    // Bullseye: the bow twangs, then the arrow thunks in (a bright chime for a bullseye, a dull thud for a miss)
    arrow() { tone(220, 0.25, { type: 'triangle', vol: 0.12, slide: -60 }); noise(0.35, { vol: 0.12, freq: 2500, sweepTo: 600, delay: 0.05 }); },
    thunk(off) {
      noise(0.12, { vol: 0.35, freq: 500, sweepTo: 120 }); tone(110, 0.15, { type: 'sine', vol: 0.2, slide: -40 });
      if (off === 0) [0, 2, 4, 7].forEach((n, i) => tone(notes[n], 0.25, { type: 'triangle', vol: 0.14, delay: 0.08 + i * 0.08 }));
      else if (off === 1) tone(notes[2], 0.2, { type: 'triangle', vol: 0.1, delay: 0.08 });
    },
    whoosh() { noise(0.45, { vol: 0.22, freq: 300, sweepTo: 2400 }); tone(220, 0.4, { type: 'sine', vol: 0.08, slide: 180 }); },
    best() { [0, 2, 4, 5, 7].forEach((n, i) => tone(notes[n], 0.2, { type: 'triangle', vol: 0.14, delay: 0.9 + i * 0.09 })); }
  };
})();
