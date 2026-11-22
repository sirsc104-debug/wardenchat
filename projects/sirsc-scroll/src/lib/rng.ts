// Small deterministic helpers so the fake catalog is identical on every load and every device.

/** 32-bit FNV-1a hash of a string. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash to a float in [0, 1). */
export function hash01(str: string): number {
  return hash(str) / 4294967296;
}

/** Mulberry32 PRNG. */
export function rng(seed: number | string): () => number {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)];
}

export function pickN<T>(r: () => number, list: readonly T[], n: number): T[] {
  const copy = list.slice();
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
  return out;
}

export function between(r: () => number, lo: number, hi: number): number {
  return lo + r() * (hi - lo);
}

export function intBetween(r: () => number, lo: number, hi: number): number {
  return Math.floor(between(r, lo, hi + 1));
}

let counter = 0;
/** Unique-enough id for things created on this device. */
export function uid(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
