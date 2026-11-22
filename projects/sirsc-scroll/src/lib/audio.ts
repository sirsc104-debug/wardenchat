// A tiny procedural soundtrack so Mute/Volume do something real without shipping audio files.
// Each clip gets its own tempo, key and instrument from its id. Quiet by design, off by default.
import type { TemplateKind } from '../state/types';
import { hash } from './rng';

const SCALES = [
  [0, 3, 5, 7, 10],
  [0, 2, 4, 7, 9],
  [0, 2, 3, 7, 8],
];

class ClipSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | undefined;
  private nextTime = 0;
  private step = 0;
  private seed = 0;
  private bpm = 110;
  private root = 57;
  private scale = SCALES[0];
  private wave: OscillatorType = 'triangle';
  private volume = 0.5;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.level();
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  private level() {
    return 0.16 * this.volume * this.volume;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.05);
  }

  start(id: string, template: TemplateKind, speed: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    void ctx.resume();
    this.stopTimer();
    this.seed = hash(id);
    this.bpm = (88 + (this.seed % 40)) * speed;
    this.root = 50 + (this.seed % 12);
    this.scale = SCALES[this.seed % SCALES.length];
    this.wave = template === 'gaming' || template === 'tech' ? 'square' : template === 'music' || template === 'trend' ? 'sawtooth' : 'triangle';
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stop() {
    this.stopTimer();
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  private stopTimer() {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const sixteenth = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.play(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  private play(step: number, t: number, len: number) {
    const s = step % 16;
    if (s === 0 || s === 8 || (s === 10 && this.seed % 3 === 0)) this.kick(t);
    if (s % 4 === 2) this.hat(t, 0.25);
    if (s === 4 || s === 12) this.hat(t, 0.6, 0.08);
    const bar = Math.floor(step / 16);
    const chord = [0, 3, 4, 2][(bar + this.seed) % 4];
    if (s % 8 === 0) this.tone(this.note(chord, -12), t, len * 7, 'sine', 0.5);
    const motif = (this.seed >> (s % 12)) & 1;
    if (s % 2 === 0 && motif) this.tone(this.note(chord + ((s / 2 + bar) % 5), 0), t, len * 1.6, this.wave, this.wave === 'triangle' ? 0.22 : 0.08);
  }

  private note(degree: number, octave: number): number {
    const sc = this.scale;
    const d = ((degree % sc.length) + sc.length) % sc.length;
    const midi = this.root + sc[d] + 12 * Math.floor(degree / sc.length) + octave;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.25);
  }

  private hat(t: number, gain: number, dur = 0.03) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.01);
  }
}

export const synth = new ClipSynth();
