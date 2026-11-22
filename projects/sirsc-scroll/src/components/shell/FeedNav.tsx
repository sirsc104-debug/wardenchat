import { ArrowLeft, Focus } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { FeedKind } from '../../state/types';
import { CustomizeWidgets } from '../widgets/CustomizeWidgets';
import { useP, useS } from '../../state/store';
import { isFocusMode, toggleFocusMode } from '../../state/widgets';

export const FEED_TABS: [FeedKind, string, string][] = [
  ['foryou', 'For You', '#/'],
  ['following', 'Following', '#/following'],
  ['trending', 'Trending', '#/trending'],
  ['friends', 'Friends', '#/friends'],
];

/** The permanent bar above the player: the four feeds (with a gliding pill), Focus Mode and widget settings. */
export function FeedNav({ kind, back, label }: { kind: FeedKind; back?: string; label?: string }) {
  const i = FEED_TABS.findIndex((t) => t[0] === kind);
  const focus = useP((p) => isFocusMode(p.widgets));
  const customizeOpen = useS((s) => s.customizeOpen);
  return (
    <div className="fbar">
      <div className="fbar-main">
        {kind === 'list' && (
          <a className="fbar-back" href={back ?? '#/'} aria-label={`Back from ${label ?? 'this list'}`} title={`Back · ${label ?? ''}`}>
            <ArrowLeft size={16} />
          </a>
        )}
        <nav className="fbar-tabs" role="tablist" aria-label="Feeds" style={{ '--i': Math.max(0, i) } as CSSProperties}>
          <span className={`fbar-pill${i < 0 ? ' off' : ''}`} aria-hidden="true" />
          {FEED_TABS.map(([k, l, to]) => (
            <a key={k} href={to} role="tab" aria-selected={k === kind} className={k === kind ? 'on' : ''}>
              {l}
            </a>
          ))}
        </nav>
      </div>
      <div className="fbar-tools">
        <button type="button" className={`fbar-btn${focus ? ' on' : ''}`} onClick={toggleFocusMode} aria-pressed={focus} aria-label={focus ? 'Exit Focus Mode and bring widgets back' : 'Focus Mode: hide every widget (V)'} title={focus ? 'Exit Focus Mode (V)' : 'Focus Mode: video only (V)'}>
          <Focus size={16} />
        </button>
        <CustomizeWidgets open={customizeOpen} />
      </div>
    </div>
  );
}
