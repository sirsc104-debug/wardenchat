import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Clock, Hash, Plus, Search, X, Play } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { useAcct, usePersisted, useS } from '../../state/store';
import { addRecentSearch, clearRecentSearches, openModal, openVideo, removeRecentSearch } from '../../state/actions';
import { suggestions, type Suggestion } from '../../lib/search';
import { getUser, userByHandle } from '../../lib/catalog';
import { trendingHashtags } from '../../lib/recommend';
import { href, navigate } from '../../lib/router';
import { useDismiss } from '../../lib/hooks';

export function TopBar({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <header className={`topbar ${className}`}>
      <SearchBox />
      {children}
      <button type="button" className="btn btn-accent btn-sm topbar-upload" onClick={() => openModal({ type: 'upload' })} title="Upload a simulated video">
        <Plus size={15} strokeWidth={2.6} /> <span>Upload</span>
      </button>
    </header>
  );
}

export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const p = usePersisted();
  const recent = useAcct((a) => a.recentSearches);
  const focusKey = useS((s) => s.searchFocus);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [wrap]);

  // Respond only to "/" presses made while this box is mounted, not to the count it mounted with.
  const seenFocus = useRef(focusKey);
  useEffect(() => {
    if (focusKey === seenFocus.current) return;
    seenFocus.current = focusKey;
    input.current?.focus();
    input.current?.select();
    setOpen(true);
  }, [focusKey]);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const sugg = useMemo(() => (q.trim().length >= 1 ? suggestions(p, q) : []), [p, q]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hot = useMemo(() => trendingHashtags(p, 5), [p.userVideos]);
  const rows: Suggestion[] = q.trim()
    ? [{ kind: 'query', label: `Search for “${q.trim()}”`, value: q.trim() }, ...sugg]
    : [...recent.map((r) => ({ kind: 'query' as const, label: r, value: r, sub: 'recent' })), ...hot.map((t) => ({ kind: 'tag' as const, label: `#${t.tag}`, value: t.tag, sub: 'trending' }))];

  const go = (s: Suggestion) => {
    setOpen(false);
    setHi(-1);
    input.current?.blur();
    if (s.kind === 'query') {
      addRecentSearch(s.value);
      setQ(s.value);
      navigate(href.explore(s.value));
    } else if (s.kind === 'creator') {
      addRecentSearch(`@${s.value}`);
      navigate(href.profile(s.value));
    } else if (s.kind === 'tag') {
      addRecentSearch(`#${s.value}`);
      navigate(href.tag(s.value));
    } else {
      addRecentSearch(q.trim());
      openVideo(s.value);
      navigate('#/watch');
    }
  };

  return (
    <div ref={wrap} className={`search${open ? ' open' : ''}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (hi >= 0 && rows[hi]) return go(rows[hi]);
          const v = q.trim();
          if (!v) return;
          if (v.startsWith('@') && userByHandle(p, v)) return go({ kind: 'creator', label: v, value: v.slice(1).toLowerCase() });
          go({ kind: 'query', label: v, value: v });
        }}
      >
        <Search size={16} className="search-ico" />
        <input
          ref={input}
          type="search"
          value={q}
          placeholder="Search videos, creators, #tags"
          aria-label="Search"
          aria-expanded={open}
          aria-controls="search-pop"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHi(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHi((h) => Math.min(rows.length - 1, h + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHi((h) => Math.max(-1, h - 1));
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
              input.current?.blur();
            }
          }}
        />
        {q ? (
          <button type="button" className="icon-btn xs" onClick={() => (setQ(''), input.current?.focus())} aria-label="Clear search">
            <X size={14} />
          </button>
        ) : (
          <kbd className="search-kbd">/</kbd>
        )}
      </form>
      {open && rows.length > 0 && (
        <div className="search-pop" id="search-pop" role="listbox">
          {!q.trim() && recent.length > 0 && (
            <div className="search-pop-head">
              <span>Recent searches</span>
              <button type="button" className="link-btn" onClick={clearRecentSearches}>
                Clear
              </button>
            </div>
          )}
          {rows.map((s, i) => {
            const u = s.kind === 'creator' ? getUser(p, userByHandle(p, s.value)?.id ?? '') : undefined;
            return (
              <div key={`${s.kind}${s.value}${i}`} className={`search-row${hi === i ? ' hi' : ''}`} role="option" aria-selected={hi === i}>
                <button type="button" className="search-row-btn" onMouseEnter={() => setHi(i)} onClick={() => go(s)}>
                  <span className="search-row-ico">
                    {s.kind === 'creator' ? <Avatar user={u} size={24} /> : s.kind === 'tag' ? <Hash size={15} /> : s.kind === 'video' ? <Play size={14} /> : s.sub === 'recent' ? <Clock size={15} /> : <Search size={15} />}
                  </span>
                  <span className="search-row-label">{s.label}</span>
                  {s.sub && <span className="search-row-sub">{s.sub}</span>}
                </button>
                {s.sub === 'recent' && (
                  <button type="button" className="icon-btn xs" onClick={() => removeRecentSearch(s.value)} aria-label={`Remove ${s.label} from recent searches`}>
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
