import { useCallback, useEffect, useRef, useState } from 'react';
import type { Video } from '../../state/types';
import { endWatch, startWatch } from '../../state/actions';

interface Options {
  video: Video;
  active: boolean;
  playing: boolean;
  speed: number;
  loop: boolean;
  autoAdvance: boolean;
  onAdvance: () => void;
}

/**
 * Simulated playback clock for the clip on screen. Time lives in a ref and the progress bar is
 * painted directly (transform only), so React re-renders at most once per second of clip time.
 */
export function usePlayback({ video, active, playing, speed, loop, autoAdvance, onAdvance }: Options) {
  const t = useRef(0);
  const bar = useRef<HTMLSpanElement>(null);
  const [sec, setSec] = useState(0);
  const [ended, setEnded] = useState(false);
  const stats = useRef({ max: 0, completions: 0, watchedMs: 0 });
  const advanceRef = useRef(onAdvance);
  advanceRef.current = onAdvance;
  const d = video.duration;

  const paint = useCallback(() => {
    if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, t.current / d)})`;
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
    const tick = (now: number) => {
      const real = Math.min(250, now - last);
      last = now;
      t.current += (real / 1000) * speed;
      stats.current.watchedMs += real;
      if (t.current >= d) {
        stats.current.completions++;
        stats.current.max = 1;
        if (autoAdvance) {
          t.current = d;
          paint();
          advanceRef.current();
          return;
        }
        if (loop) {
          t.current = 0;
        } else {
          t.current = d;
          paint();
          setSec(Math.floor(d));
          setEnded(true);
          return;
        }
      }
      stats.current.max = Math.max(stats.current.max, t.current / d);
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
  }, [active, playing, ended, speed, loop, autoAdvance, d, paint]);

  const seek = useCallback(
    (frac: number) => {
      t.current = Math.max(0, Math.min(d - 0.05, frac * d));
      paint();
      setSec(Math.floor(t.current));
      setEnded(false);
    },
    [d, paint],
  );

  const nudge = useCallback((delta: number) => seek((t.current + delta) / d), [seek, d]);

  const replay = useCallback(() => {
    stats.current.completions = Math.max(1, stats.current.completions);
    seek(0);
  }, [seek]);

  return { bar, sec, ended, seek, nudge, replay, timeRef: t };
}
