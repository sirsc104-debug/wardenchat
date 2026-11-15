/* Putt Club: sound effects, birdsong and a gentle music loop, all synthesised with Web Audio. */
(function (PC) {
  'use strict';
  class Audio {
    constructor(prefs) {
      this.ctx = null;
      this.sfxOn = prefs.sfx !== false;
      this.musicOn = prefs.music !== false;
      this.nextBird = 0;
    }

    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = this.ctx = new AC();
        this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
        this.sfx = c.createGain(); this.sfx.gain.value = this.sfxOn ? 0.8 : 0; this.sfx.connect(this.master);
        this.mus = c.createGain(); this.mus.gain.value = this.musicOn ? 0.32 : 0; this.mus.connect(this.master);
        const len = c.sampleRate;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.startMusic();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    setSfx(on) { this.sfxOn = on; if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05); }
    setMusic(on) { this.musicOn = on; if (this.mus) this.mus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.2); }

    // building blocks
    tone(freq, t0, dur, opts = {}) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + (opts.glide || dur));
      if (opts.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = opts.vib; lg.gain.value = opts.vibDepth || freq * 0.05; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
      const v = opts.vol === undefined ? 0.3 : opts.vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + (opts.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(opts.out || this.sfx);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    noise(t0, dur, opts = {}) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf;
      f.type = opts.filter || 'bandpass';
      f.frequency.setValueAtTime(opts.freq || 1000, t0);
      if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
      f.Q.value = opts.q || 1;
      const v = opts.vol === undefined ? 0.3 : opts.vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + (opts.attack || 0.003));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(opts.out || this.sfx);
      s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
    }

    play(name, o = {}) {
      if (!this.ctx || !this.sfxOn) return;
      const t = this.ctx.currentTime + 0.005;
      const k = o.k === undefined ? 1 : o.k;
      switch (name) {
        case 'putt':
          this.noise(t, 0.05, { freq: 2600, q: 1.2, vol: 0.25 + 0.4 * k });
          this.tone(1300, t, 0.07, { to: 700, vol: 0.12 + 0.2 * k });
          break;
        case 'wall':
          this.noise(t, 0.08, { freq: 850, q: 4, vol: Math.min(0.5, 0.06 + k * 0.06) });
          this.tone(410, t, 0.07, { to: 330, vol: Math.min(0.3, 0.04 + k * 0.035), type: 'triangle' });
          break;
        case 'post':
          this.noise(t, 0.07, { freq: 500, q: 3, vol: Math.min(0.45, 0.05 + k * 0.05) });
          this.tone(240, t, 0.08, { vol: Math.min(0.25, 0.04 + k * 0.03) });
          break;
        case 'paddle': case 'gate':
          this.noise(t, 0.06, { freq: 1700, q: 3, vol: Math.min(0.4, 0.06 + k * 0.05) });
          this.tone(620, t, 0.06, { type: 'square', vol: 0.05 });
          break;
        case 'bonk':
          this.tone(760, t, 0.18, { vol: 0.2 }); this.tone(1520, t, 0.12, { vol: 0.08 });
          break;
        case 'squish':
          this.noise(t, 0.25, { filter: 'lowpass', freq: 1400, to: 200, vol: 0.25 });
          break;
        case 'tire':
          this.tone(120, t, 0.18, { to: 80, vol: 0.4 }); this.noise(t, 0.12, { filter: 'lowpass', freq: 600, vol: 0.2 });
          break;
        case 'bumper':
          this.tone(200, t, 0.35, { to: 560, glide: 0.12, vol: 0.32, vib: 18, vibDepth: 30 });
          break;
        case 'launch':
          this.tone(260, t, 0.45, { to: 980, glide: 0.25, vol: 0.32, vib: 14, vibDepth: 40 });
          break;
        case 'tunnel':
          this.tone(620, t, 0.35, { to: 140, vol: 0.25 }); this.noise(t, 0.3, { filter: 'lowpass', freq: 800, to: 200, vol: 0.12 });
          break;
        case 'popout':
          this.tone(220, t, 0.2, { to: 820, vol: 0.25 }); this.noise(t + 0.05, 0.06, { freq: 3000, vol: 0.2 });
          break;
        case 'boost':
          this.noise(t, 0.5, { freq: 400, to: 3600, q: 2, vol: 0.3 });
          this.tone(500, t, 0.4, { to: 1400, vol: 0.08, type: 'triangle' });
          break;
        case 'switch':
          [880, 1320, 1760].forEach((f, i) => this.tone(f, t + i * 0.07, 0.6, { vol: 0.12, type: 'triangle' }));
          break;
        case 'lip':
          for (let i = 0; i < 3; i++) this.noise(t + i * 0.035, 0.03, { freq: 2200, q: 5, vol: 0.18 });
          break;
        case 'sink':
          this.tone(560, t, 0.16, { to: 240, vol: 0.35 });
          for (let i = 0; i < 4; i++) this.noise(t + 0.09 + i * 0.045, 0.03, { freq: 1800 - i * 200, q: 6, vol: 0.2 - i * 0.03 });
          break;
        case 'splash':
          this.noise(t, 0.6, { filter: 'lowpass', freq: 2200, to: 260, vol: 0.45 });
          for (let i = 0; i < 5; i++) this.tone(500 + Math.random() * 600, t + 0.1 + i * 0.06, 0.06, { to: 1200, vol: 0.06 });
          break;
        case 'flowers':
          this.noise(t, 0.35, { filter: 'lowpass', freq: 900, to: 300, vol: 0.3 });
          break;
        case 'land':
          this.tone(150, t, 0.09, { to: 90, vol: Math.min(0.35, 0.1 + k * 0.05) }); this.noise(t, 0.06, { filter: 'lowpass', freq: 500, vol: 0.12 });
          break;
        case 'gust':
          this.noise(t, 2.2, { filter: 'bandpass', freq: 300, to: 900, q: 0.7, vol: 0.18, attack: 0.6 });
          break;
        case 'click':
          this.tone(900, t, 0.05, { vol: 0.08, type: 'triangle' });
          break;
        case 'good': // birdie and better
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.09, 0.4, { vol: 0.16, type: 'triangle' }));
          break;
        case 'par':
          [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.1, 0.35, { vol: 0.12, type: 'triangle' }));
          break;
        case 'meh':
          [392, 349].forEach((f, i) => this.tone(f, t + i * 0.16, 0.35, { vol: 0.12, type: 'triangle' }));
          break;
        case 'ace':
          [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, t + i * 0.08, 0.6, { vol: 0.16, type: 'triangle' }));
          for (let i = 0; i < 10; i++) this.tone(2000 + Math.random() * 2500, t + 0.5 + i * 0.05, 0.15, { vol: 0.05 });
          break;
      }
    }

    // A bird somewhere in the garden every few seconds.
    ambient(now) {
      if (!this.ctx || !this.sfxOn) return;
      if (now < this.nextBird) return;
      this.nextBird = now + 3 + Math.random() * 7;
      const t = this.ctx.currentTime, base = 2400 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const f = base * (0.9 + Math.random() * 0.25);
        this.tone(f, t + i * 0.12, 0.09, { to: f * (Math.random() < 0.5 ? 1.4 : 0.7), glide: 0.07, vol: 0.025 });
      }
    }

    // A soft plucked loop in C major, scheduled a little ahead.
    startMusic() {
      const c = this.ctx;
      const bpm = 88, beat = 60 / bpm;
      const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]];
      const melody = [76, 0, 79, 76, 74, 0, 72, 74, 76, 0, 72, 69, 67, 0, 69, 72, 72, 0, 74, 72, 69, 0, 67, 69, 71, 0, 74, 72, 71, 0, 67, 0];
      const hz = m => 440 * Math.pow(2, (m - 69) / 12);
      let step = 0, next = c.currentTime + 0.2;
      const pluck = (m, t, vol, dur) => this.tone(hz(m), t, dur, { type: 'triangle', vol, out: this.mus, attack: 0.006 });
      setInterval(() => {
        if (!this.musicOn) { next = c.currentTime + 0.2; return; }
        while (next < c.currentTime + 0.4) {
          const bar = Math.floor(step / 8) % 4, ch = chords[bar], s8 = step % 8;
          if (s8 === 0) { pluck(ch[0] - 12, next, 0.09, beat * 3.5); this.tone(hz(ch[0] - 24), next, beat * 3.8, { vol: 0.05, out: this.mus, attack: 0.08 }); }
          if (s8 === 4) pluck(ch[0] - 5, next, 0.06, beat * 1.8);
          pluck(ch[(s8 * 3) % 4] + (s8 % 2 ? 12 : 0), next, 0.035, beat * 0.9);
          const mel = melody[step % melody.length];
          if (mel && Math.floor(step / 32) % 2 === 1) pluck(mel, next, 0.05, beat * 1.2);
          next += beat / 2;
          step++;
        }
      }, 100);
    }
  }
  PC.Audio = Audio;
})(window.PC = window.PC || {});
