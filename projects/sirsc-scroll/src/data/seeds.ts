import type { AccountState, AppNotification, Category, Collection, HistoryEntry, Settings, Video } from '../state/types';
import { emptyInterests } from './categories';
import { DEMO_IDS, FRIENDS_OF, USER_MAP, USERS } from './users';
import { SEED_VIDEOS } from './videos';
import { between, hash01, intBetween, pick, pickN, rng } from '../lib/rng';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface DemoPlan {
  interests: Partial<Record<Category, number>>;
  follows: string[];
  collections: [string, Category[]][];
}

const PLANS: Record<string, DemoPlan> = {
  alex: {
    interests: { gaming: 2.8, memes: 2.3, technology: 2.1, comedy: 1.1, community: 1.2, science: 0.8 },
    follows: ['pixelvault', 'lagspike', 'memeorbit', 'circuit', 'bytesize', 'deadpan', 'sirscgames', 'jordan', 'taylor'],
    collections: [['Setup ideas', ['technology']], ['Clutch moments', ['gaming']]],
  },
  jordan: {
    interests: { sports: 2.9, comedy: 2.2, gaming: 1.9, trending: 1.2, memes: 1.1, music: 0.7 },
    follows: ['courtvision', 'trickshot', 'finalwhistle', 'sketchy', 'bitlab', 'noscope', 'alex', 'sam'],
    collections: [['Moves to learn', ['sports']], ['Bits for practice', ['comedy']]],
  },
  sam: {
    interests: { music: 2.9, trending: 2.4, comedy: 1.6, animals: 1.2, memes: 1.3, sports: 0.6 },
    follows: ['loopstation', 'kenjikeys', 'bassment', 'trendcast', 'dailydrop', 'mayajokes', 'jordan', 'taylor'],
    collections: [['Songs to cover', ['music']], ['Dances', ['trending']]],
  },
  taylor: {
    interests: { school: 2.7, science: 2.6, memes: 2.0, animals: 1.2, technology: 1.0, gaming: 0.6 },
    follows: ['hallpass', 'fieldtrip', 'studyloop', 'labrat', 'orbitlab', 'fizz', 'goblinmode', 'alex', 'sam'],
    collections: [['Study tips', ['school']], ['Experiments to try', ['science']]],
  },
};

function affinity(v: Video, interests: Partial<Record<Category, number>>): number {
  return (interests[v.category] ?? 0.6) + (v.meta.alsoFor.reduce((s, c) => s + (interests[c] ?? 0), 0) * 0.2);
}

function interestedPicks(seed: string, interests: Partial<Record<Category, number>>, n: number, exclude: Set<string> = new Set()): string[] {
  const r = rng(seed);
  return SEED_VIDEOS.filter((v) => !exclude.has(v.id) && !DEMO_IDS.includes(v.creatorId))
    .map((v) => ({ id: v.id, s: affinity(v, interests) * (0.4 + r()) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.id);
}

function seedNotifications(id: string, plan: DemoPlan): AppNotification[] {
  const r = rng(`notes:${id}`);
  const now = Date.now();
  const friends = FRIENDS_OF[id];
  const own = SEED_VIDEOS.filter((v) => v.creatorId === id);
  const creators = USERS.filter((u) => u.kind === 'creator' && u.categories.some((c) => (plan.interests[c] ?? 0) > 1.5));
  const strangers = USERS.filter((u) => u.kind !== 'demo' && u.id !== id);
  const out: AppNotification[] = [];
  let n = 0;
  const add = (x: Omit<AppNotification, 'id' | 'read'>, readChance = 0.55) => {
    out.push({ ...x, id: `${id}n${n++}`, read: r() < readChance && x.at < now - 5 * HOUR });
  };
  const t = (lo: number, hi: number) => Math.round(now - between(r, lo, hi) * HOUR);

  for (const u of pickN(r, strangers, 4)) add({ type: 'follow', actorId: u.id, text: 'started following you', at: t(0.3, 140) });
  for (const v of own) {
    for (const u of pickN(r, strangers, 3)) add({ type: 'like', actorId: u.id, videoId: v.id, text: 'liked your video', at: t(1, 120) });
    const c = pick(r, strangers);
    add({ type: 'comment', actorId: c.id, videoId: v.id, text: 'commented on your video', quote: pick(r, ['this is so good', 'how did you do this??', 'part 2 please', 'okay this is elite']), at: t(2, 90) });
  }
  const replyFrom = pick(r, friends.map((f) => USER_MAP.get(f)!));
  add({ type: 'reply', actorId: replyFrom.id, videoId: interestedPicks(`rv${id}`, plan.interests, 1)[0], text: 'replied to your comment', quote: pick(r, ['LMAO you were right', 'no because same', 'wait I didn\'t notice that', 'sending this to you rn']), at: t(0.5, 30) });
  const mention = pick(r, friends.map((f) => USER_MAP.get(f)!));
  add({ type: 'mention', actorId: mention.id, videoId: interestedPicks(`mv${id}`, plan.interests, 1)[0], text: 'mentioned you in a comment', quote: `@${id} this is literally you`, at: t(3, 60) });
  for (const f of pickN(r, friends, 3)) {
    add({ type: 'share', actorId: f, videoId: interestedPicks(`sv${id}${f}`, plan.interests, 3)[intBetween(r, 0, 2)], text: 'sent you a video', at: t(0.2, 100) });
  }
  for (const c of pickN(r, creators, 3)) {
    add({ type: 'trending', actorId: c.id, videoId: SEED_VIDEOS.find((v) => v.creatorId === c.id)?.id, text: 'is trending in ' + (c.categories[0] === 'community' ? 'SirSC' : c.categories[0][0].toUpperCase() + c.categories[0].slice(1)), at: t(4, 160) });
  }
  add({ type: 'system', text: 'Welcome to SirSC Scroll. This is a demo account: everything you do stays in this browser.', at: now - 9 * DAY, actorId: 'sirsc' }, 1);
  return out.sort((a, b) => b.at - a.at);
}

export function seedAccount(id: string): AccountState {
  const plan = PLANS[id];
  const user = USER_MAP.get(id)!;
  const r = rng(`acct:${id}`);
  const interests = { ...emptyInterests(0.8), ...plan.interests };
  const liked = interestedPicks(`likes:${id}`, plan.interests, 18);
  const saved = interestedPicks(`saves:${id}`, plan.interests, 9, new Set(liked.slice(0, 6)));
  const now = Date.now();
  const collections: Collection[] = plan.collections.map(([name, cats], i) => ({
    id: `${id}col${i}`,
    name,
    createdAt: now - (20 - i * 6) * DAY,
    videoIds: saved.filter((vid) => cats.includes(SEED_VIDEOS.find((v) => v.id === vid)!.category)).slice(0, 4),
  }));
  // Everything the account liked or saved was watched first, so it's in the history too.
  const watched = Array.from(new Set([...interestedPicks(`hist:${id}`, plan.interests, 8, new Set([...liked, ...saved])), ...liked, ...saved]));
  const history: HistoryEntry[] = watched.map((videoId, i) => {
    const kept = liked.includes(videoId) || saved.includes(videoId);
    return {
      videoId,
      at: now - Math.round((i * 3.2 + between(r, 0.2, 2)) * HOUR),
      progress: kept ? 1 : Number(between(r, 0.35, 1).toFixed(2)),
      completions: kept ? 1 + (r() < 0.3 ? 1 : 0) : r() < 0.5 ? 1 : 0,
    };
  });
  return {
    profile: { name: user.name, bio: user.bio, avatar: { ...user.avatar } },
    following: plan.follows.slice(),
    liked,
    saved,
    collections,
    history,
    historyPaused: false,
    notInterested: [],
    hiddenCreators: [],
    reported: [],
    interests,
    tagAffinity: {},
    signals: { likes: 0, saves: 0, follows: 0, comments: 0, shares: 0, completions: 0, replays: 0, skips: 0, notInterested: 0 },
    likedComments: [],
    notifications: seedNotifications(id, plan),
    activity: [],
    drafts: [],
    recentSearches: pickN(r, ['mirror step', 'chromebook tips', '#speedrun', 'cats', 'piano', 'elephant toothpaste', '#wardenchat', 'trick shot'], 3),
    shares: [],
    nonce: 0,
  };
}

/** Liked videos of the fictional lurker friends (demo accounts use their live likes instead). */
const lurkerCache = new Map<string, string[]>();
export function lurkerLikes(userId: string): string[] {
  const hit = lurkerCache.get(userId);
  if (hit) return hit;
  const u = USER_MAP.get(userId);
  if (!u) return [];
  const interests: Partial<Record<Category, number>> = {};
  u.categories.forEach((c, i) => (interests[c] = 3 - i * 0.6));
  const ids = interestedPicks(`lurk:${userId}`, interests, 22);
  lurkerCache.set(userId, ids);
  return ids;
}

/** When a lurker "liked" something, spread over the past few days. */
export function lurkerLikeTime(userId: string, videoId: string): number {
  return Date.now() - Math.round(hash01(`${userId}:${videoId}`) * 5 * DAY + HOUR);
}

export const DEFAULT_SETTINGS: Settings = {
  autoplay: true,
  autoAdvance: false,
  loop: true,
  startMuted: true,
  speed: 1,
  volume: 0.5,
  reducedMotion: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  theme: 'dark',
  density: 'standard',
  sidebarCollapsed: false,
  sidebarCollapsedNarrow: true,
  // The claude.ai Artifact build stays on demo clips (it runs sandboxed, without network access).
  videoSource: typeof __MEMORY_ROUTER__ !== 'undefined' && __MEMORY_ROUTER__ ? 'demo' : 'catalog',
  playerHost: 'nocookie',
  catalogPreviewKey: '',
  catalogReviewKey: '',
};
