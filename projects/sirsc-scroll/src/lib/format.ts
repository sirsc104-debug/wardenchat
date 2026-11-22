const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fullFmt = new Intl.NumberFormat('en-US');

/** 12.4K, 3.1M. Exact below 10,000 so a single like is visible. */
export function compact(n: number): string {
  if (n < 10000) return fullFmt.format(n);
  return compactFmt.format(n);
}

export function full(n: number): string {
  return fullFmt.format(n);
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${compact(n)} ${n === 1 ? one : many}`;
}

export function duration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "now", "5m", "3h", "2d", "4w", then a date. */
export function ago(at: number, now = Date.now()): string {
  const d = Math.max(0, now - at);
  if (d < MIN) return 'now';
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`;
  if (d < 8 * 7 * DAY) return `${Math.floor(d / (7 * DAY))}w`;
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function agoLong(at: number, now = Date.now()): string {
  const d = Math.max(0, now - at);
  if (d < MIN) return 'just now';
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < DAY) {
    const h = Math.floor(d / HOUR);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (d < 7 * DAY) {
    const n = Math.floor(d / DAY);
    return n === 1 ? 'yesterday' : `${n} days ago`;
  }
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dayBucket(at: number, now = Date.now()): 'Today' | 'Yesterday' | 'This week' | 'Earlier' {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  if (at >= t0) return 'Today';
  if (at >= t0 - DAY) return 'Yesterday';
  if (at >= t0 - 6 * DAY) return 'This week';
  return 'Earlier';
}

export const TIME = { MIN, HOUR, DAY };

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
