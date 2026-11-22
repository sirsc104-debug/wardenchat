import { useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { SortKey } from '../../state/types';
import { CATEGORIES } from '../../data/categories';
import { CATEGORY_ICON } from '../common/icons';
import { useS } from '../../state/store';
import { openModal, refreshFeed, setCategory, setSort } from '../../state/actions';

export function ListHeader({ label, back }: { label: string; back: string }) {
  return (
    <div className="list-head">
      <a href={back} className="btn btn-ghost btn-sm">
        <ArrowLeft size={15} /> Back
      </a>
      <span className="list-head-label">{label}</span>
    </div>
  );
}

const SORTS: [SortKey, string][] = [
  ['recommended', 'Recommended'],
  ['newest', 'Newest'],
  ['liked', 'Most liked'],
  ['viewed', 'Most viewed'],
  ['shortest', 'Shortest'],
];

export function FeedControls() {
  const category = useS((s) => s.category);
  const sort = useS((s) => s.sort);
  const strip = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => strip.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  return (
    <div className="feed-controls">
      <button type="button" className="icon-btn xs chips-arrow" onClick={() => scroll(-1)} aria-label="Scroll categories left" tabIndex={-1}>
        <ChevronLeft size={15} />
      </button>
      <div className="chips" ref={strip} role="toolbar" aria-label="Filter by category">
        <button type="button" className={`chip${category === 'all' ? ' on' : ''}`} onClick={() => setCategory('all')} aria-pressed={category === 'all'}>
          All
        </button>
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c.id];
          const on = category === c.id;
          return (
            <button key={c.id} type="button" className={`chip${on ? ' on' : ''}`} onClick={() => setCategory(on ? 'all' : c.id)} aria-pressed={on} style={{ '--hue': c.hue } as React.CSSProperties}>
              <Icon size={13} /> {c.label}
            </button>
          );
        })}
      </div>
      <button type="button" className="icon-btn xs chips-arrow" onClick={() => scroll(1)} aria-label="Scroll categories right" tabIndex={-1}>
        <ChevronRight size={15} />
      </button>
      <label className="select-wrap" title="Sort this feed">
        <span className="sr-only">Sort feed</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {SORTS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="icon-btn" onClick={refreshFeed} aria-label="Refresh feed" title="Refresh feed" data-tap="spin">
        <RefreshCw size={16} />
      </button>
      <button type="button" className="icon-btn" onClick={() => openModal({ type: 'interests' })} aria-label="Feed preferences" title="Feed preferences">
        <SlidersHorizontal size={16} />
      </button>
    </div>
  );
}
