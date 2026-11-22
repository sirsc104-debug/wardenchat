import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FeedState, Video } from '../../state/types';
import { go } from '../../state/actions';
import { usePersisted } from '../../state/store';
import { getVideo } from '../../lib/catalog';

interface Props {
  feed: FeedState;
  render: (video: Video, active: boolean) => ReactNode;
  /** Shown instead of the track when the feed has no videos. */
  empty?: ReactNode;
  /** Shown over the last clip ("you're all caught up"). */
  endNote?: ReactNode;
  /** False while this track slides away during a feed switch: nothing in it plays. */
  live?: boolean;
  className?: string;
}

const WHEEL_THRESHOLD = 45;
const QUIET_MS = 170;

/**
 * Vertical, one-at-a-time video track. Only the current clip and its two neighbours are mounted.
 * Wheel/trackpad gestures move exactly one clip per gesture; touch drags follow the finger.
 */
export function FeedTrack({ feed, render, empty, endNote, className = '', live = true }: Props) {
  const p = usePersisted();
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const wheel = useRef({ acc: 0, locked: false, last: 0, lastAbs: 0, lockedAt: 0 });
  const touch = useRef<{ id: number; y: number; x: number; t: number; moved: boolean } | null>(null);
  const prevIndex = useRef(feed.index);
  const currentId = feed.items[feed.index]?.id;
  const prevId = useRef(currentId);
  const [jump, setJump] = useState(false);

  // Far jumps (an Up Next pick) and in-place swaps (filter, sort, refresh) fade instead of sliding.
  useEffect(() => {
    const far = Math.abs(feed.index - prevIndex.current) > 1 || (feed.index === prevIndex.current && currentId !== prevId.current);
    prevIndex.current = feed.index;
    prevId.current = currentId;
    if (!far) return;
    setJump(true);
    const id = window.setTimeout(() => setJump(false), 260);
    return () => window.clearTimeout(id);
  }, [feed.index, currentId]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const w = wheel.current;
      const now = performance.now();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 32;
      else if (e.deltaMode === 2) dy *= el.clientHeight;
      const gap = now - w.last;
      const abs = Math.abs(dy);
      w.last = now;
      if (w.locked) {
        // Stay locked through a gesture's momentum; unlock on a pause or a clearly new, harder swipe.
        const fresh = gap > QUIET_MS || (now - w.lockedAt > 420 && abs > Math.max(28, w.lastAbs * 1.8));
        w.lastAbs = abs;
        if (!fresh) return;
        w.locked = false;
        w.acc = 0;
      }
      if (gap > QUIET_MS) w.acc = 0;
      w.acc += dy;
      w.lastAbs = abs;
      if (Math.abs(w.acc) >= WHEEL_THRESHOLD) {
        go(w.acc > 0 ? 1 : -1);
        w.locked = true;
        w.lockedAt = now;
        w.acc = 0;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    touch.current = { id: e.pointerId, y: e.clientY, x: e.clientX, t: performance.now(), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    const dy = e.clientY - t.y;
    if (!t.moved && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(e.clientX - t.x)) {
      t.moved = true;
      setDragging(true);
      box.current?.setPointerCapture(e.pointerId);
    }
    if (t.moved) {
      const atStart = feed.index === 0 && dy > 0;
      setDrag(atStart ? dy * 0.3 : dy);
    }
  };
  const finish = (e: React.PointerEvent) => {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    touch.current = null;
    if (!t.moved) return;
    const dy = e.clientY - t.y;
    const v = dy / Math.max(1, performance.now() - t.t);
    const h = box.current?.clientHeight ?? 600;
    setDragging(false);
    setDrag(0);
    if (dy < -h * 0.18 || v < -0.45) go(1);
    else if (dy > h * 0.18 || v > 0.45) go(-1);
  };

  const ids: { id: string; offset: number }[] = [];
  for (let o = -1; o <= 1; o++) {
    const it = feed.items[feed.index + o];
    if (it) ids.push({ id: it.id, offset: o });
  }
  const atEnd = feed.index >= feed.items.length - 1;

  return (
    <div
      ref={box}
      className={`track${dragging ? ' dragging' : ''}${jump ? ' jump' : ''} ${className}`}
      style={{ '--drag': `${drag}px` } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {ids.map(({ id, offset }) => {
        const v = getVideo(p, id);
        if (!v) return null;
        return (
          <div key={id} className="track-item" style={{ '--o': offset } as React.CSSProperties} aria-hidden={offset !== 0}>
            {render(v, live && offset === 0)}
          </div>
        );
      })}
      {!feed.items.length && empty && <div className="track-item track-empty">{empty}</div>}
      {atEnd && feed.items.length > 0 && endNote && <div className="track-endnote">{endNote}</div>}
    </div>
  );
}
