import { memo, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw, SkipForward } from 'lucide-react';
import type { RealVideo } from '../../lib/videoSource';
import { Placeholder } from '../placeholders/Placeholder';
import { loadYouTubeApi, pageOrigin, playerVideoId, YT_HOSTS, YT_STATE, ytErrorText, type YTPlayer, type YTPlayerOptions } from '../../lib/youtube';
import { markUnplayable } from '../../lib/remoteCatalog';
import { go, setMuted, setPlaying } from '../../state/actions';
import { getState } from '../../state/store';
import type { ExternalClock } from './usePlayback';

interface Props {
  video: RealVideo;
  active: boolean;
  playing: boolean;
  muted: boolean;
  volume: number;
  speed: number;
  host: 'nocookie' | 'youtube';
  clock: React.RefObject<ExternalClock | null>;
}

type Phase = 'poster' | 'loading' | 'ready' | 'playing' | 'error';

/** Errors that belong to the video itself (gone, private, embedding off): hide it on this device. */
const VIDEO_ERRORS = new Set<number | string>([2, 100, 101, 150]);
/** After this many failures in a row, stop skipping: something about this network or device blocks playback. */
const MAX_AUTO_SKIPS = 3;
let failuresInARow = 0;

/**
 * Plays one real video with YouTube's official IFrame player. Only the clip on screen gets a player, and it
 * gets a new one: switching videos inside one player (loadVideoById) silently kept the previous video
 * playing on school Chromebooks. Until it reports PLAYING, the video's thumbnail stands in.
 */
export const YouTubeScreen = memo(function YouTubeScreen({ video, active, playing, muted, volume, speed, host, clock }: Props) {
  const src = video.source;
  const wrap = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  const state = useRef<number>(YT_STATE.UNSTARTED);
  const endedFlag = useRef(false);
  const wanted = useRef<'play' | 'pause' | null>(null);
  const skipTimer = useRef<number | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('poster');
  const [error, setError] = useState<{ code: number | string; text: string; skipping: boolean } | null>(null);
  const [thumbOk, setThumbOk] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ playing, muted, volume, speed });
  latest.current = { playing, muted, volume, speed };

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // Hidden only after moving past it, so the message and the skip aren't cut short.
    let hideOnLeave = false;
    setPhase('loading');
    setError(null);

    const fail = (code: number | string, text?: string) => {
      if (cancelled) return;
      setPhase('error');
      if (VIDEO_ERRORS.has(code)) hideOnLeave = true;
      failuresInARow++;
      const skipping = code !== 'api' && failuresInARow <= MAX_AUTO_SKIPS;
      setError({ code, text: text ?? ytErrorText(code), skipping });
      if (skipping) {
        window.clearTimeout(skipTimer.current);
        skipTimer.current = window.setTimeout(() => {
          const s = getState().s;
          const f = s.feeds[s.activeFeed];
          if (f.items[f.index]?.id === video.id) go(1);
        }, 1600);
      }
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !wrap.current) return;
        const mount = document.createElement('div');
        wrap.current.appendChild(mount);
        const vars: Record<string, string | number> = {
          autoplay: latest.current.playing ? 1 : 0,
          mute: latest.current.muted ? 1 : 0,
          controls: 0,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
        };
        const origin = pageOrigin();
        if (origin) vars.origin = origin;
        const opts: YTPlayerOptions = {
          width: '100%',
          height: '100%',
          videoId: src.youtubeId,
          playerVars: vars,
          events: {
            onReady: (e) => {
              if (cancelled) return;
              const p = e.target;
              ready.current = true;
              try {
                p.setVolume(Math.round(latest.current.volume * 100));
                if (latest.current.speed !== 1) p.setPlaybackRate(latest.current.speed);
                if (latest.current.muted) p.mute();
                else p.unMute();
                if (latest.current.playing) {
                  wanted.current = 'play';
                  p.playVideo();
                } else {
                  // Autoplay off: wait for Play with the thumbnail showing.
                  setPhase((ph) => (ph === 'loading' ? 'ready' : ph));
                }
              } catch {
                /* player gone */
              }
              clock.current = {
                time: () => safely(() => p.getCurrentTime(), 0),
                duration: () => safely(() => p.getDuration(), 0),
                isPlaying: () => state.current === YT_STATE.PLAYING,
                consumeEnded: () => {
                  const was = endedFlag.current;
                  endedFlag.current = false;
                  return was;
                },
                seek: (s) => safely(() => p.seekTo(s, true), undefined),
                restart: () => {
                  endedFlag.current = false;
                  wanted.current = 'play';
                  safely(() => (p.seekTo(0, true), p.playVideo()), undefined);
                },
              };
            },
            onStateChange: (e) => {
              if (cancelled) return;
              state.current = e.data;
              if (e.data === YT_STATE.PLAYING) {
                const id = playerVideoId(e.target);
                if (id && id !== src.youtubeId) {
                  fail('wrong');
                  return;
                }
                failuresInARow = 0;
                setPhase('playing');
                // Started from YouTube's own picture (a click on the video): follow it.
                if (!getState().s.playing && wanted.current !== 'pause') setPlaying(true);
                wanted.current = null;
              } else if (e.data === YT_STATE.PAUSED) {
                if (getState().s.playing && wanted.current !== 'play') setPlaying(false);
                wanted.current = null;
              } else if (e.data === YT_STATE.ENDED) {
                endedFlag.current = true;
              }
            },
            onError: (e) => fail(e.data),
            onAutoplayBlocked: () => {
              // The browser wants a click before sound: play muted instead.
              safely(() => (player.current?.mute(), player.current?.playVideo()), undefined);
              setMuted(true);
            },
          },
        };
        if (host === 'nocookie') opts.host = YT_HOSTS.nocookie;
        player.current = new YT.Player(mount, opts);
      })
      .catch((e: Error) => fail('api', e.message));

    return () => {
      cancelled = true;
      if (hideOnLeave) window.setTimeout(() => markUnplayable(video.id), 0);
      window.clearTimeout(skipTimer.current);
      clock.current = null;
      safely(() => player.current?.destroy(), undefined);
      player.current = null;
      ready.current = false;
      state.current = YT_STATE.UNSTARTED;
      endedFlag.current = false;
      wanted.current = null;
      if (wrap.current) wrap.current.textContent = '';
      setPhase('poster');
    };
  }, [active, src.youtubeId, host, attempt, video.id, clock]);

  useEffect(() => {
    const p = player.current;
    if (!p || !ready.current) return;
    wanted.current = playing ? 'play' : 'pause';
    if (playing) setPhase((ph) => (ph === 'ready' ? 'loading' : ph));
    safely(() => (playing ? p.playVideo() : p.pauseVideo()), undefined);
  }, [playing]);

  useEffect(() => {
    const p = player.current;
    if (p && ready.current) safely(() => (muted ? p.mute() : p.unMute()), undefined);
  }, [muted]);

  useEffect(() => {
    const p = player.current;
    if (p && ready.current) safely(() => p.setVolume(Math.round(volume * 100)), undefined);
  }, [volume]);

  useEffect(() => {
    const p = player.current;
    if (p && ready.current) safely(() => p.setPlaybackRate(speed), undefined);
  }, [speed]);

  const fit = src.orientation === 'horizontal' ? 'contain' : 'cover';
  return (
    <div className={`yt-screen yt-${phase} yt-fit-${fit}`} data-video={src.youtubeId}>
      {src.thumbnailUrl && thumbOk ? (
        <img className="yt-poster" src={src.thumbnailUrl} alt="" draggable={false} onError={() => setThumbOk(false)} />
      ) : (
        <Placeholder video={video} running={false} />
      )}
      <div ref={wrap} className="yt-frame" />
      {active && phase === 'loading' && <span className="yt-spin" aria-label="Loading video" role="status" />}
      {active && phase === 'error' && error && (
        <div className="yt-msg" role="alert" onClick={(e) => e.stopPropagation()}>
          <AlertTriangle size={22} />
          <b>{error.code === 'api' ? 'YouTube’s player isn’t available here' : 'This video can’t play here'}</b>
          <span>
            {error.code === 'api' ? error.text : `YouTube error ${error.code}: ${error.text}.`}
            {error.skipping ? ' Skipping to the next video…' : ''}
          </span>
          {!error.skipping && (
            <>
              {error.code !== 'api' && (
                <span className="yt-msg-hint">Several videos in a row didn’t play. If this keeps happening, try the other player address in Settings › Videos.</span>
              )}
              <span className="yt-msg-row">
                <button type="button" className="btn btn-accent btn-sm" onClick={() => (failuresInARow = 0, go(1))}>
                  <SkipForward size={14} /> Next video
                </button>
                <button type="button" className="btn btn-glass btn-sm" onClick={() => (failuresInARow = 0, setAttempt((n) => n + 1))}>
                  <RotateCcw size={14} /> Try again
                </button>
                <a className="btn btn-glass btn-sm" href="#/settings/videos">
                  Settings
                </a>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
});

function safely<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
