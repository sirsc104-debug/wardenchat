// Simulated creator analytics, derived deterministically from the account's videos.
import type { Category, Persisted, Video } from '../state/types';
import { commentCount, likeCount, saveCount, shareCount, videosBy, viewCount } from './catalog';
import { CATEGORY_IDS } from '../data/categories';
import { USER_MAP } from '../data/users';
import { hash01, rng } from './rng';

const DAY = 86_400_000;

export interface DayPoint {
  t: number;
  views: number;
  likes: number;
  followers: number;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Daily totals for the last `days` days (plus the same span before it, for deltas). */
export function dailySeries(p: Persisted, userId: string, days: number): { cur: DayPoint[]; prev: DayPoint[] } {
  const vids = videosBy(p, userId);
  const today = startOfDay(Date.now());
  const span = days * 2;
  const out: DayPoint[] = [];
  for (let i = span - 1; i >= 0; i--) out.push({ t: today - i * DAY, views: 0, likes: 0, followers: 0 });
  for (const v of vids) {
    const V = viewCount(p, v);
    const L = likeCount(p, v);
    const tau = 4 + hash01(v.id) * 6;
    const up = startOfDay(v.uploadedAt);
    const age = Math.max(1, Math.round((today - up) / DAY) + 1);
    let norm = 0;
    for (let d = 0; d < age; d++) norm += Math.exp(-d / tau);
    for (const pt of out) {
      const d = Math.round((pt.t - up) / DAY);
      if (d < 0 || d >= age) continue;
      const share = Math.exp(-d / tau) / norm;
      pt.views += V * share;
      pt.likes += L * share;
    }
  }
  const r = rng(`series:${userId}:${days}`);
  const base = (USER_MAP.get(userId)?.followers ?? 1000) * 0.02;
  for (const pt of out) {
    // Profile visits and older uploads keep a trickle going.
    const noise = 0.85 + r() * 0.3;
    const weekday = new Date(pt.t).getDay();
    const weekend = weekday === 0 || weekday === 6 ? 1.18 : 1;
    pt.views = Math.round((pt.views + base * (0.7 + r() * 0.6)) * noise * weekend);
    pt.likes = Math.round((pt.likes + base * 0.06) * noise);
    pt.followers = Math.max(0, Math.round(pt.views * (0.008 + r() * 0.012)));
  }
  return { cur: out.slice(days), prev: out.slice(0, days) };
}

/** Share of viewers still watching at each second (simulated). */
export function retention(v: Video): { t: number; pct: number }[] {
  const r = rng(`ret:${v.id}`);
  const hook = 0.62 + r() * 0.25;
  const decay = 0.9 + r() * 1.6;
  const pts: { t: number; pct: number }[] = [];
  const steps = Math.min(40, Math.max(8, v.duration));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * v.duration;
    const x = t / v.duration;
    let pct = i === 0 ? 1 : hook * Math.exp(-x * decay) + (1 - hook) * Math.exp(-x * 12);
    if (x > 0.85) pct += 0.04 * (x - 0.85) * 10 * (r() * 0.5 + 0.5);
    pts.push({ t: Math.round(t), pct: Math.max(0.02, Math.min(1, pct)) });
  }
  return pts;
}

export function avgWatch(v: Video): number {
  const pts = retention(v);
  return pts.reduce((s, x) => s + x.pct, 0) / pts.length;
}

export function engagement(p: Persisted, userId: string) {
  const vids = videosBy(p, userId);
  return {
    likes: vids.reduce((s, v) => s + likeCount(p, v), 0),
    comments: vids.reduce((s, v) => s + commentCount(p, v), 0),
    shares: vids.reduce((s, v) => s + shareCount(p, v), 0),
    saves: vids.reduce((s, v) => s + saveCount(p, v), 0),
  };
}

export function trafficSources(userId: string): { label: string; share: number }[] {
  const r = rng(`traffic:${userId}`);
  const raw: [string, number][] = [
    ['For You feed', 55 + r() * 15],
    ['Following feed', 10 + r() * 8],
    ['Your profile', 5 + r() * 5],
    ['Search', 4 + r() * 5],
    ['Shared links & Warden Chat', 3 + r() * 5],
  ];
  const total = raw.reduce((s, x) => s + x[1], 0);
  return raw.map(([label, v]) => ({ label, share: v / total }));
}

export function audienceInterests(userId: string): { category: Category; share: number }[] {
  const u = USER_MAP.get(userId);
  const r = rng(`aud:${userId}`);
  const w = CATEGORY_IDS.map((c) => {
    const i = u?.categories.indexOf(c) ?? -1;
    return { category: c, w: (i === 0 ? 5 : i > 0 ? 2.5 : 0.4) * (0.7 + r() * 0.6) };
  });
  const total = w.reduce((s, x) => s + x.w, 0);
  return w
    .map((x) => ({ category: x.category, share: x.w / total }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);
}
