import { useCallback, useEffect, useRef, useState } from 'react';
import type { Video } from '../../state/types';
import { endWatch, startWatch } from '../../state/actions';

/** A real player (YouTube) that owns the time for the clip on screen. */
export interface ExternalClock {
  /** Seconds into the video. */
  time(): number;
  /** Seconds, or 0 while unknown. */
  duration(): number;
  /** The player is actually playing (not buffering, paused or ended). */
  isPlaying(): boolean;
  /** True once after the player reports the video ended; reading it clears it. */
  consumeEnded(): boolean;
  seek(seconds: number): void;
  /** Back to the start and play (replay, loop). */
  restart(): void;
}

interface Options {
  video: Video;
  active: boolean;
  playing: boolean;
  speed: number;
  loop: boolean;
  autoAdvance: boolean;
  onAdvance: () => void;
  /** Set for real videos: time comes from the player instead of the simulated clock. */
  clock?: React.RefObject<ExternalClock | null>;
}

/**
 * Playback clock for the clip on screen: simulated for demo clips, read from the YouTube player for real
 * videos. Time lives in a ref and the progress bar is painted directly (transform only), so React re-renders
 * at most once per second of clip time.
 */
export function usePlayback({ video, active, playing, speed, loop, autoAdvance, onAdvance, clock }: Options) {
  const t = useRef(0);
  const bar = useRef<HTMLSpanElement>(null);
  const [sec, setSec] = useState(0);
  const [ended, setEnded] = useState(false);
  const stats = useRef({ max: 0, completions: 0, watchedMs: 0 });
  const advanceRef = useRef(onAdvance);
  advanceRef.current = onAdvance;
  const d = video.duration;
  const dur = useRef(d);
  dur.current = clock?.current?.duration() || d;
  const external = !!clock;

  const paint = useCallback(() => {
    if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, t.current / (dur.current || d))})`;
  }, [d]);

  // Fresh start whenever this clip becomes the active one; report the watch when it leaves.
  useEffect(() => {
    if (!active) {
      t.current = 0;
      paint();
      return;
    }
    t.current = 0;
    stats.current = { max: 0, completions: 0, watchedMs: 0 };
    setSec(0);
    setEnded(false);
    paint();
    startWatch(video.id);
    return () => {
      const s = stats.current;
      endWatch(video.id, s.completions > 0 ? 1 : s.max, s.completions, s.watchedMs);
    };
  }, [active, video.id, paint]);

  useEffect(() => {
    if (!active || !playing || ended) return;
    let last = performance.now();
    let raf = 0;
    let shown = Math.floor(t.current);
    const finishOrLoop = (length: number): boolean => {
      stats.current.completions++;
      stats.current.max = 1;
      if (autoAdvance) {
        t.current = length;
        paint();
        advanceRef.current();
        return true;
      }
      if (loop) {
        t.current = 0;
        if (external) clock?.current?.restart();
        return false;
      }
      t.current = length;
      paint();
      setSec(Math.floor(length));
      setEnded(true);
      return true;
    };
    const tick = (now: number) => {
      const real = Math.min(250, now - last);
      last = now;
      if (external) {
        const c = clock?.current;
        if (c) {
          const length = c.duration() || d;
          dur.current = length;
          if (c.isPlaying()) stats.current.watchedMs += real;
          t.current = Math.min(length, c.time());
          if (c.consumeEnded() && finishOrLoop(length)) return;
          stats.current.max = Math.max(stats.current.max, t.current / length);
        }
      } else {
        t.current += (real / 1000) * speed;
        stats.current.watchedMs += real;
        if (t.current >= d && finishOrLoop(d)) return;
        stats.current.max = Math.max(stats.current.max, t.current / d);
      }
      paint();
      const s = Math.floor(t.current);
      if (s !== shown) {
        shown = s;
        setSec(s);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, playing, ended, speed, loop, autoAdvance, d, paint, external, clock]);

  const seek = useCallback(
    (frac: number) => {
      const length = dur.current || d;
      t.current = Math.max(0, Math.min(length - 0.05, frac * length));
      if (external) clock?.current?.seek(t.current);
      paint();
      setSec(Math.floor(t.current));
      setEnded(false);
    },
    [d, paint, external, clock],
  );

  const nudge = useCallback((delta: number) => seek((t.current + delta) / (dur.current || d)), [seek, d]);

  const replay = useCallback(() => {
    stats.current.completions = Math.max(1, stats.current.completions);
    if (external) {
      t.current = 0;
      clock?.current?.restart();
      paint();
      setSec(0);
      setEnded(false);
      return;
    }
    seek(0);
  }, [seek, external, clock, paint]);

  return { bar, sec, ended, seek, nudge, replay, timeRef: t, durationRef: dur };
}
