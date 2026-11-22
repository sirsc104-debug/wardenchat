import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FeedKind, Video } from '../../state/types';
import { FeedTrack } from './FeedTrack';
import { useP, useS } from '../../state/store';

const ORDER: FeedKind[] = ['foryou', 'following', 'trending', 'list'];
const SWAP_MS = 240;

interface Layer {
  kind: FeedKind;
  phase: 'in' | 'out';
  dir: 1 | -1;
}

interface Props {
  kind: FeedKind;
  render: (video: Video, active: boolean) => ReactNode;
  empty: (kind: FeedKind) => ReactNode;
  endNote: (kind: FeedKind) => ReactNode;
}

/**
 * Cross-slides between feeds. Each feed keeps its own track (and position); switching shows the
 * new one sliding in while the old one slides out. Rapid switching reuses layers still on screen.
 */
export function FeedStack({ kind, render, empty, endNote }: Props) {
  const feeds = useS((s) => s.feeds);
  const reduced = useP((p) => p.settings.reducedMotion);
  const [layers, setLayers] = useState<Layer[]>([{ kind, phase: 'in', dir: 1 }]);
  const prev = useRef(kind);

  useEffect(() => {
    if (prev.current === kind) return;
    const dir: 1 | -1 = ORDER.indexOf(kind) >= ORDER.indexOf(prev.current) ? 1 : -1;
    prev.current = kind;
    setLayers((ls) => [...ls.filter((l) => l.kind !== kind).map((l) => ({ ...l, phase: 'out' as const, dir })), { kind, phase: 'in', dir }]);
  }, [kind]);

  useEffect(() => {
    if (!layers.some((l) => l.phase === 'out')) return;
    const t = window.setTimeout(() => setLayers((ls) => ls.filter((l) => l.phase === 'in')), reduced ? 0 : SWAP_MS);
    return () => window.clearTimeout(t);
  }, [layers, reduced]);

  return (
    <>
      {layers.map((l) => (
        <div key={l.kind} className={`feed-layer ${l.phase} d${l.dir > 0 ? 'r' : 'l'}`} aria-hidden={l.phase === 'out'}>
          <FeedTrack feed={feeds[l.kind]} live={l.phase === 'in'} render={render} empty={empty(l.kind)} endNote={endNote(l.kind)} />
        </div>
      ))}
    </>
  );
}
