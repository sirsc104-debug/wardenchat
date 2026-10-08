// Tiny synthesized sound effects (no audio files). Starts after the first tap.
(function (G) {
  'use strict';
  let ac = null, master = null;
  const Sound = {
    on: true,
    unlock() {
      if (ac || typeof AudioContext === 'undefined') return;
      try { ac = new AudioContext(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); } catch (e) { ac = null; }
    },
    tone(freq, dur, type = 'sine', vol = 0.5, slide = 0, delay = 0) {
      if (!this.on || !ac) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.4, freq = 800, delay = 0) {
      if (!this.on || !ac) return;
      const t = ac.currentTime + delay;
      const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(master); s.start(t);
    },
    play(name) {
      if (!this.on || !ac) return;
      switch (name) {
        case 'tap': this.tone(660, 0.06, 'triangle', 0.25); break;
        case 'open': this.tone(520, 0.08, 'triangle', 0.25); this.tone(780, 0.1, 'triangle', 0.2, 0, 0.05); break;
        case 'coin': this.tone(988, 0.08, 'square', 0.15); this.tone(1318, 0.14, 'square', 0.15, 0, 0.07); break;
        case 'goop': this.tone(300, 0.18, 'sine', 0.35, 400); this.tone(500, 0.12, 'sine', 0.2, 300, 0.08); break;
        case 'build': this.noise(0.08, 0.3, 1500); this.noise(0.08, 0.3, 1500, 0.15); break;
        case 'done': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.3, 0, i * 0.08)); break;
        case 'error': this.tone(200, 0.18, 'sawtooth', 0.2, -60); break;
        case 'deploy': this.tone(420, 0.05, 'triangle', 0.15, 200); break;
        case 'hit': this.noise(0.05, 0.12, 2400); break;
        case 'boom': this.noise(0.35, 0.5, 500); this.tone(90, 0.3, 'sine', 0.4, -40); break;
        case 'destroy': this.noise(0.6, 0.6, 700); this.tone(70, 0.5, 'sine', 0.5, -30); break;
        case 'star': [784, 988, 1318].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.3, 0, i * 0.06)); break;
        case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.13)); break;
        case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.3, 0, i * 0.18)); break;
        case 'horn': this.tone(220, 0.6, 'sawtooth', 0.15, 30); this.tone(330, 0.6, 'sawtooth', 0.1, 40); break;
      }
    },
  };
  G.Sound = Sound;
})(globalThis.SOTP = globalThis.SOTP || {});
