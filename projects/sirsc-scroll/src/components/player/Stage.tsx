import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Heart, Pause, Play, Repeat, RotateCcw, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type { Video } from '../../state/types';
import { Placeholder } from '../placeholders/Placeholder';
import { usePlayback } from './usePlayback';
import { go, likeOnly, setMuted, setPlaying, togglePlay, updateSettings } from '../../state/actions';
import { focusWidget } from '../../state/widgets';
import { useP, useS } from '../../state/store';
import { duration } from '../../lib/format';
import { synth } from '../../lib/audio';
import { USER_MAP } from '../../data/users';

/** The active stage exposes its controls here for keyboard shortcuts. */
export const activeControls: { current: { nudge: (d: number) => void; replay: () => void } | null } = { current: null };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface Props {
  video: Video;
  active: boolean;
  chrome: 'desktop' | 'mobile';
  children?: ReactNode;
}

interface Burst {
  id: number;
  x: number;
  y: number;
}

export const Stage = memo(function Stage({ video, active, chrome, children }: Props) {
  const playing = useS((s) => s.playing);
  const muted = useS((s) => s.muted);
  const speed = useP((p) => p.settings.speed);
  const loop = useP((p) => p.settings.loop);
  const autoAdvance = useP((p) => p.settings.autoAdvance);
  const volume = useP((p) => p.settings.volume);
  const reduced = useP((p) => p.settings.reducedMotion);
  const pb = usePlayback({ video, active, playing, speed, loop, autoAdvance, onAdvance: () => go(1) });
  const [bursts, setBursts] = useState<Burst[]>([]);
  const clickTimer = useRef<number | undefined>(undefined);
  const burstTimers = useRef<number[]>([]);
  const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!active) return;
    activeControls.current = { nudge: pb.nudge, replay: pb.replay };
    return () => {
      if (activeControls.current?.nudge === pb.nudge) activeControls.current = null;
    };
  }, [active, pb.nudge, pb.replay]);

  // Generated soundtrack for the active clip while unmuted.
  const audible = active && playing && !muted && !pb.ended;
  useEffect(() => {
    if (!audible) return;
    synth.start(video.id, video.template, speed);
    return () => synth.stop();
  }, [audible, video.id, video.template, speed]);
  useEffect(() => synth.setVolume(volume), [volume]);

  useEffect(
    () => () => {
      window.clearTimeout(clickTimer.current);
      window.clearTimeout(flashTimer.current);
      burstTimers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const showFlash = (k: 'play' | 'pause') => {
    setFlash(k);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 500);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!active) return;
    if (e.detail >= 2) {
      // Double click / double tap: like, with a heart where you tapped.
      window.clearTimeout(clickTimer.current);
      const r = e.currentTarget.getBoundingClientRect();
      const b = { id: Date.now() + Math.random(), x: e.clientX - r.left, y: e.clientY - r.top };
      setBursts((list) => [...list.slice(-3), b]);
      burstTimers.current.push(window.setTimeout(() => setBursts((list) => list.filter((x) => x.id !== b.id)), 900));
      likeOnly(video.id);
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      if (pb.ended) {
        pb.replay();
        setPlaying(true);
        return;
      }
      showFlash(playing ? 'pause' : 'play');
      togglePlay();
    }, 230);
  };

  const creator = USER_MAP.get(video.creatorId);
  const running = active && playing && !pb.ended && !reduced;

  return (
    <div className={`stage stage-${chrome}${active ? ' is-active' : ''}`}>
      <div className="stage-screen" onClick={onClick}>
        <Placeholder video={video} running={running} tag={active} handle={creator?.handle} speed={speed} />
        {bursts.map((b) => (
          <span key={b.id} className="burst" style={{ left: b.x, top: b.y }}>
            <Heart size={84} fill="currentColor" strokeWidth={0} />
          </span>
        ))}
        {active && !playing && !pb.ended && (
          <span className="stage-paused" aria-hidden="true">
            <Play size={38} fill="currentColor" />
          </span>
        )}
        {flash && playing && (
          <span className="stage-flash" key={flash} aria-hidden="true">
            {flash === 'play' ? <Play size={30} fill="currentColor" /> : <Pause size={30} fill="currentColor" />}
          </span>
        )}
      </div>
      {active && pb.ended && (
        <div className="stage-end">
          <button type="button" className="btn btn-glass" onClick={() => (pb.replay(), setPlaying(true))}>
            <RotateCcw size={16} /> Replay
          </button>
          <button type="button" className="btn btn-accent" onClick={() => go(1)}>
            <SkipForward size={16} /> Next video
          </button>
        </div>
      )}
      {children}
      <div className="stage-bottom" onClick={(e) => e.stopPropagation()}>
        {chrome === 'desktop' && active && (
          <div className="stage-cap">
            <button type="button" className="cap-handle" onClick={() => focusWidget('creator')} title="About the creator">
              @{creator?.handle}
            </button>
            <button type="button" className="cap-title" onClick={() => focusWidget('info')} title="Video information">
              {video.title}
            </button>
          </div>
        )}
        {chrome === 'desktop' && active && (
          <div className="stage-controls">
            <button type="button" className="sc-btn" onClick={() => (pb.ended ? (pb.replay(), setPlaying(true)) : togglePlay())} aria-label={playing && !pb.ended ? 'Pause (Space)' : 'Play (Space)'} title={playing ? 'Pause (Space)' : 'Play (Space)'}>
              {playing && !pb.ended ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
            <span className="sc-time">
              {duration(pb.sec)} <span>/ {duration(video.duration)}</span>
            </span>
            <span className="sc-spacer" />
            <button
              type="button"
              className="sc-btn sc-speed"
              onClick={() => updateSettings({ speed: SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] })}
              title="Playback speed"
              aria-label={`Playback speed ${speed}x`}
            >
              {speed}×
            </button>
            <button type="button" className={`sc-btn${loop ? ' on' : ''}`} onClick={() => updateSettings({ loop: !loop })} aria-pressed={loop} title={loop ? 'Loop on' : 'Loop off'} aria-label="Loop">
              <Repeat size={16} />
            </button>
            <div className="sc-vol">
              <button type="button" className="sc-btn" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute (M)' : 'Mute (M)'} title={muted ? 'Unmute (M)' : 'Mute (M)'}>
                {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateSettings({ volume: v });
                  setMuted(v === 0);
                }}
              />
            </div>
          </div>
        )}
        <Timeline active={active} bar={pb.bar} seek={pb.seek} thin={chrome === 'mobile'} label={`${duration(pb.sec)} of ${duration(video.duration)}`} />
      </div>
    </div>
  );
});

function Timeline({ active, bar, seek, thin, label }: { active: boolean; bar: React.RefObject<HTMLSpanElement | null>; seek: (f: number) => void; thin: boolean; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const frac = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  return (
    <div
      ref={track}
      className={`timeline${thin ? ' thin' : ''}`}
      role="slider"
      aria-label="Seek"
      aria-valuetext={label}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={active ? 0 : -1}
      onPointerDown={(e) => {
        if (!active) return;
        e.stopPropagation();
        dragging.current = true;
        track.current?.setPointerCapture(e.pointerId);
        const fill = bar.current;
        fill?.classList.add('seeking');
        window.setTimeout(() => fill?.classList.remove('seeking'), 220);
        seek(frac(e.clientX));
      }}
      onPointerMove={(e) => dragging.current && seek(frac(e.clientX))}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          const cur = Number(bar.current?.style.transform.match(/scaleX\(([\d.]+)\)/)?.[1] ?? 0);
          seek(cur + (e.key === 'ArrowRight' ? 0.05 : -0.05));
        }
      }}
    >
      <span className="tl-rail">
        <span className="tl-fill" ref={bar} />
      </span>
    </div>
  );
}
