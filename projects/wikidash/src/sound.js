// Tiny synthesized sound effects (no audio files). One mute switch, remembered.

const KEY = "wd:mute";
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(KEY) === "1";
} catch {
  /* private mode */
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur, { type = "sine", vol = 0.12, at = 0, to = 0 } = {}) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

export const sfx = {
  tick: () => tone(660, 0.12, { vol: 0.1 }),
  go: () => tone(990, 0.35, { type: "triangle", vol: 0.14 }),
  click: () => tone(520, 0.05, { type: "square", vol: 0.04, to: 380 }),
  pop: () => tone(780, 0.07, { vol: 0.06, to: 1040 }),
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: "triangle", vol: 0.12, at: i * 0.1 }));
  },
  lose() {
    tone(330, 0.22, { type: "sawtooth", vol: 0.05, to: 247 });
    tone(247, 0.3, { type: "sawtooth", vol: 0.05, at: 0.2, to: 185 });
  },
};

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (!muted) sfx.pop();
  return muted;
}
