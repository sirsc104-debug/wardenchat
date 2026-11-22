// Loads YouTube's official IFrame Player API once, and the few types SirSC Scroll uses from it.

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  setPlaybackRate(r: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoUrl(): string;
  destroy(): void;
}

export interface YTPlayerOptions {
  host?: string;
  width?: string | number;
  height?: string | number;
  videoId: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number; target: YTPlayer }) => void;
    onError?: (e: { data: number }) => void;
    onAutoplayBlocked?: () => void;
  };
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

export const YT_HOSTS = { youtube: 'https://www.youtube.com', nocookie: 'https://www.youtube-nocookie.com' } as const;

/** YouTube's own meanings for onError codes (152 is undocumented; it's what school Chromebooks returned). */
export function ytErrorText(code: number | string): string {
  switch (code) {
    case 2: return 'invalid video ID';
    case 5: return 'can’t play in an HTML5 player';
    case 100: return 'video not found or private';
    case 101:
    case 150: return 'the owner doesn’t allow embedding';
    case 152: return 'not documented by YouTube (seen when a network or device blocks embeds)';
    case 153: return 'the page didn’t identify itself to YouTube (missing Referer)';
    case 'wrong': return 'the player kept playing a different video';
    default: return 'unknown error';
  }
}

let loading: Promise<YTNamespace> | null = null;

/** The IFrame API, loaded from www.youtube.com once per page. Rejects if it can't load within 15 s. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error('YouTube’s player script couldn’t load (offline, or www.youtube.com is blocked here).'));
    };
    document.head.appendChild(s);
    window.setTimeout(() => {
      if (!window.YT?.Player) {
        loading = null;
        reject(new Error('YouTube’s player didn’t become ready within 15 seconds.'));
      }
    }, 15000);
  });
  return loading;
}

/**
 * The page's web origin for the player's `origin` parameter. In a tab opened by a launcher with
 * about:blank + document.write, location reads about:blank but the document keeps the opener's origin.
 */
export function pageOrigin(): string | null {
  if (/^https?:$/.test(location.protocol)) return location.origin;
  const so = typeof self !== 'undefined' ? self.origin : '';
  return so && /^https?:\/\//.test(so) ? so : null;
}

/** The video ID the player says it has (getVideoUrl is part of the documented API). */
export function playerVideoId(p: YTPlayer): string | null {
  try {
    const m = /[?&]v=([A-Za-z0-9_-]{11})/.exec(p.getVideoUrl());
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
