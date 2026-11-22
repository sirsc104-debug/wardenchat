import type { AccountState, Settings } from '../state/types';
import { emptyInterests } from './categories';

/** A Warden Chat account the first time it signs in on this browser: no history, every category equal. */
export function freshAccount(): AccountState {
  return {
    following: [],
    liked: [],
    saved: [],
    collections: [],
    history: [],
    historyPaused: false,
    notInterested: [],
    hiddenCreators: [],
    reported: [],
    interests: emptyInterests(1),
    tagAffinity: {},
    signals: { likes: 0, saves: 0, follows: 0, comments: 0, completions: 0, replays: 0, skips: 0, notInterested: 0 },
    activity: [],
    recentSearches: [],
    nonce: 0,
    createdAt: Date.now(),
  };
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
