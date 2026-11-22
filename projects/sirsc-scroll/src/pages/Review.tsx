// Owner-only review of the real-video catalog: shortlist videos for the school, reject the rest, export the
// shortlist, and approve it once the school agrees. Needs the review key (from Vault), kept in this browser.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Play,
  Search,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PageShell } from './PageShell';
import { Empty } from '../components/common/Empty';
import { getState, useP } from '../state/store';
import { confirmAction, toast, updateSettings } from '../state/actions';
import { CATALOG, reloadCatalog } from '../lib/remoteCatalog';
import {
  isKeyRejected,
  reviewExport,
  reviewList,
  reviewSet,
  type CatalogCategory,
  type ExportRow,
  type ReviewItem,
  type ReviewStatus,
} from '../lib/scrollCatalog';
import { compact, duration } from '../lib/format';
import { pageOrigin, YT_HOSTS } from '../lib/youtube';
import { youtubeWatchUrl } from '../lib/videoSource';
import { topInterests } from '../lib/recommend';
import { useRoute } from '../lib/router';
import { ModerateComments } from './ModerateComments';

const TABS: [ReviewStatus, string][] = [
  ['pending', 'To review'],
  ['shortlisted', 'Shortlisted'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];

const CAT_NAMES: Partial<Record<CatalogCategory, string>> = { internet_humor: 'Internet humor', trending_entertainment: 'Trending entertainment' };
const catLabel = (c: CatalogCategory) => CAT_NAMES[c] ?? c.charAt(0).toUpperCase() + c.slice(1);

interface Action {
  to: ReviewStatus;
  label: string;
  icon: LucideIcon;
  /** Shortcut in the one-by-one player. */
  key?: string;
  tone: 'accent' | 'ghost' | 'danger';
}

const ACTIONS: Record<ReviewStatus, Action[]> = {
  pending: [
    { to: 'shortlisted', label: 'Shortlist', icon: ThumbsUp, key: 'a', tone: 'accent' },
    { to: 'rejected', label: 'Reject', icon: ThumbsDown, key: 'r', tone: 'danger' },
  ],
  shortlisted: [
    { to: 'approved', label: 'Approve', icon: ShieldCheck, tone: 'accent' },
    { to: 'pending', label: 'Back to review', icon: Undo2, tone: 'ghost' },
    { to: 'rejected', label: 'Reject', icon: ThumbsDown, key: 'r', tone: 'danger' },
  ],
  approved: [
    { to: 'shortlisted', label: 'Unapprove', icon: Undo2, tone: 'ghost' },
    { to: 'rejected', label: 'Reject', icon: ThumbsDown, key: 'r', tone: 'danger' },
  ],
  rejected: [{ to: 'pending', label: 'Back to review', icon: Undo2, key: 'a', tone: 'ghost' }],
};

const DONE: Record<ReviewStatus, string> = { pending: 'moved back to review', shortlisted: 'shortlisted', approved: 'approved', rejected: 'rejected' };
const PAGE = 60;

export function Review() {
  const reviewKey = useP((p) => p.settings.catalogReviewKey);
  const route = useRoute();
  if (!reviewKey) return <KeyGate />;
  if (route.path[1] === 'comments') return <ModerateComments reviewKey={reviewKey} />;
  return <ReviewBoard reviewKey={reviewKey} />;
}

/* ---------------------------------------------------------------- review key */

function KeyGate() {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const k = draft.trim();
    if (!k) return;
    setBusy(true);
    setError('');
    try {
      await reviewList(CATALOG, k, { status: 'pending', limit: 1 });
      const s = getState().p.settings;
      // The review key also works as a preview key, so one key covers both on this device.
      updateSettings({ catalogReviewKey: k, ...(s.catalogPreviewKey ? {} : { catalogPreviewKey: k }) });
    } catch (e) {
      setError(isKeyRejected(e) ? 'That review key wasn’t accepted.' : `Couldn’t reach the catalog: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageShell title="Review videos" className="review-page">
      <div className="rv-gate">
        <Empty icon={KeyRound} title="Review key needed">
          Reviewing changes what students can see, so it needs its own key. Get it in the Supabase SQL editor with{' '}
          <code>select decrypted_secret from vault.decrypted_secrets where name = 'scroll_review_key';</code> It’s saved in this browser only, and also
          works as your preview key.
        </Empty>
        <div className="btn-row rv-gate-row">
          <input
            type="password"
            aria-label="Review key"
            placeholder="Paste the review key"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
          />
          <button type="button" className="btn btn-accent btn-sm" disabled={!draft.trim() || busy} onClick={() => void save()}>
            {busy ? 'Checking…' : 'Save'}
          </button>
        </div>
        {error && <p className="warn-text small">{error}</p>}
      </div>
    </PageShell>
  );
}

/* ---------------------------------------------------------------- board */

function ReviewBoard({ reviewKey }: { reviewKey: string }) {
  const host = useP((p) => p.settings.playerHost);
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [category, setCategory] = useState<CatalogCategory | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Partial<Record<ReviewStatus, number>>>({});
  const [cats, setCats] = useState<{ category: CatalogCategory; videos: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<number | null>(null);
  const [exporting, setExporting] = useState<ReviewStatus | null>(null);
  const dirty = useRef(false);
  const req = useRef(0);

  // Debounced search.
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (reset: boolean) => {
      const n = ++req.current;
      setLoading(true);
      setError('');
      try {
        const page = await reviewList(CATALOG, reviewKey, { status, category, search, offset: reset ? 0 : items.length, limit: PAGE });
        if (n !== req.current) return;
        setItems((prev) => (reset ? page.items : [...prev, ...page.items.filter((x) => !prev.some((p) => p.video_id === x.video_id))]));
        setTotal(page.total);
        setCounts(page.counts);
        setCats(page.categories);
        if (reset) setSelected(new Set());
      } catch (e) {
        if (n !== req.current) return;
        if (isKeyRejected(e)) {
          // The saved key no longer works (replaced in Vault?): forget it so the key form shows again.
          updateSettings({ catalogReviewKey: '' });
          toast('The saved review key wasn’t accepted. Paste the current one.');
        } else setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (n === req.current) setLoading(false);
      }
    },
    [reviewKey, status, category, search, items.length],
  );

  useEffect(() => {
    void load(true);
  }, [reviewKey, status, category, search]); // a new list only when the filters change, not on "load more"

  // Leaving the page after changes: reload the feed's videos so rejected ones leave it.
  useEffect(
    () => () => {
      if (dirty.current) {
        const { p } = getState();
        reloadCatalog(topInterests(p.accounts[p.activeId]).slice(0, 3).map((x) => x.category));
      }
    },
    [],
  );

  /** Move videos to another status, optimistically, with Undo. */
  const move = useCallback(
    async (ids: string[], to: ReviewStatus, opts: { quiet?: boolean } = {}) => {
      if (!ids.length || to === status) return;
      const from = status;
      const moved = new Set(ids);
      setItems((list) => list.filter((x) => !moved.has(x.video_id)));
      setTotal((t) => Math.max(0, t - ids.length));
      setCounts((c) => ({ ...c, [from]: Math.max(0, (c[from] ?? 0) - ids.length), [to]: (c[to] ?? 0) + ids.length }));
      setSelected((s) => new Set([...s].filter((id) => !moved.has(id))));
      try {
        for (let i = 0; i < ids.length; i += 1000) await reviewSet(CATALOG, reviewKey, ids.slice(i, i + 1000), to);
        dirty.current = true;
        if (!opts.quiet) {
          const what = ids.length === 1 ? '1 video' : `${ids.length} videos`;
          toast(`${what} ${DONE[to]}`, 'Undo', () => {
            void (async () => {
              try {
                for (let i = 0; i < ids.length; i += 1000) await reviewSet(CATALOG, reviewKey, ids.slice(i, i + 1000), from);
                toast('Undone');
              } catch {
                toast('Couldn’t undo. Check the other tabs.');
              }
              void load(true);
            })();
          });
        }
      } catch (e) {
        toast(isKeyRejected(e) ? 'The review key wasn’t accepted.' : 'That change didn’t save. The list has been reloaded.');
        void load(true);
      }
    },
    [status, reviewKey, load],
  );

  /** Approving makes videos public, so it always asks first. */
  const ask = useCallback(
    (ids: string[], to: ReviewStatus) => {
      if (to !== 'approved') return void move(ids, to);
      confirmAction(
        `Approve ${ids.length === 1 ? 'this video' : `${ids.length} videos`}?`,
        'Approved videos are public: everyone using SirSC Scroll can see them, without a key. Approve once the school has agreed to them.',
        'Approve',
        () => void move(ids, to),
        false,
      );
    },
    [move],
  );

  const approveShortlist = () => {
    const n = counts.shortlisted ?? 0;
    confirmAction(
      `The school approved the shortlist?`,
      `This approves all ${n} shortlisted videos. They become public: everyone using SirSC Scroll can see them, without a key.`,
      `Approve ${n} videos`,
      () =>
        void (async () => {
          try {
            const rows = await reviewExport(CATALOG, reviewKey, 'shortlisted');
            const ids = rows.map((r) => r.video_id);
            for (let i = 0; i < ids.length; i += 1000) await reviewSet(CATALOG, reviewKey, ids.slice(i, i + 1000), 'approved', 'Approved by the school');
            dirty.current = true;
            toast(`${ids.length} videos approved`);
          } catch {
            toast('Approving didn’t finish. Check the Shortlisted and Approved tabs.');
          }
          void load(true);
        })(),
      false,
    );
  };

  const actions = ACTIONS[status];
  const allOnPage = items.length > 0 && items.every((x) => selected.has(x.video_id));
  const shown = playing === null || !items.length ? null : Math.min(playing, items.length - 1);
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <PageShell
      title="Review videos"
      className="review-page"
      actions={
        <>
          <a className="btn btn-ghost btn-sm" href="#/review/comments">
            Comments
          </a>
          <a className="btn btn-ghost btn-sm" href="#/settings/videos">
            Settings
          </a>
        </>
      }
    >
      <p className="muted small rv-intro">
        Shortlist what you’d put on the school’s list and reject the rest. Only you can see shortlisted videos. Export the shortlist for the school,
        and when they agree, approve it: approved videos are public.
      </p>

      <div className="seg rv-tabs" role="tablist" aria-label="Review status">
        {TABS.map(([s, label]) => (
          <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => (setStatus(s), setCategory(null), setPlaying(null))}>
            {label} <span className="rv-count">{(counts[s] ?? 0).toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="rv-tools">
        <label className="rv-search">
          <Search size={15} />
          <input type="search" placeholder="Search titles and channels" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search titles and channels" />
        </label>
        {(status === 'shortlisted' || status === 'approved') && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={!counts[status]} onClick={() => setExporting(status)}>
            <ClipboardList size={14} /> {status === 'shortlisted' ? 'List for the school' : 'Export list'}
          </button>
        )}
        {status === 'shortlisted' && (
          <button type="button" className="btn btn-accent btn-sm" disabled={!counts.shortlisted} onClick={approveShortlist}>
            <ShieldCheck size={14} /> The school approved these
          </button>
        )}
      </div>

      {cats.length > 1 && (
        <div className="chips wrap rv-cats" role="group" aria-label="Category">
          <button type="button" className={`chip${category === null ? ' on' : ''}`} onClick={() => setCategory(null)}>
            All
          </button>
          {cats.map((c) => (
            <button key={c.category} type="button" className={`chip${category === c.category ? ' on' : ''}`} onClick={() => setCategory(c.category)}>
              {catLabel(c.category)} <span className="rv-count">{c.videos}</span>
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="rv-selectbar">
          <label className="rv-selectall">
            <input type="checkbox" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(items.map((x) => x.video_id)))} />
            Select all shown
          </label>
          {selected.size > 0 ? (
            <div className="rv-bulk" role="toolbar" aria-label="Selected videos">
              <b>{selected.size} selected</b>
              {actions.map((a) => (
                <button key={a.to} type="button" className={`btn btn-sm btn-${a.tone}`} onClick={() => ask([...selected], a.to)}>
                  <a.icon size={14} /> {a.label}
                </button>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          ) : (
            <span className="muted small">
              {items.length} of {total.toLocaleString()} shown{status === 'pending' ? ' · most watched first' : ' · most recently changed first'}
            </span>
          )}
          <button type="button" className="btn btn-accent btn-sm rv-oneby" onClick={() => setPlaying(0)}>
            <Play size={14} /> Review one by one
          </button>
        </div>
      )}

      {error && (
        <div className="catalog-status">
          <span className="warn-text">Couldn’t load the list: {error}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load(true)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <Empty icon={ClipboardList} title={search || category ? 'Nothing matches' : `Nothing in ${TABS.find((t) => t[0] === status)![1]}`}>
          {status === 'shortlisted' ? 'Shortlist videos from “To review” to build the school’s list.' : search || category ? 'Try another search or category.' : ''}
        </Empty>
      )}

      <div className="rv-grid">
        {items.map((it, i) => (
          <ReviewCard key={it.video_id} item={it} selected={selected.has(it.video_id)} actions={actions} onToggle={toggle} onAct={ask} onWatch={() => setPlaying(i)} />
        ))}
      </div>

      {items.length < total && (
        <div className="rv-more">
          <button type="button" className="btn btn-ghost btn-sm" disabled={loading} onClick={() => void load(false)}>
            {loading ? 'Loading…' : `Show more (${(total - items.length).toLocaleString()} left)`}
          </button>
        </div>
      )}
      {loading && items.length === 0 && <p className="muted small rv-loading">Loading…</p>}

      {shown !== null && (
        <OneByOne
          items={items}
          index={shown}
          total={total}
          host={host}
          actions={actions}
          onIndex={(i) => {
            if (i >= items.length - 3 && items.length < total && !loading) void load(false);
            setPlaying(Math.max(0, Math.min(i, items.length - 1)));
          }}
          onAct={(id, to) => {
            if (to === 'approved') return ask([id], to);
            void move([id], to, { quiet: true });
            toast(`${DONE[to].charAt(0).toUpperCase() + DONE[to].slice(1)}`);
            if (items.length - 1 <= (shown ?? 0) + 3 && items.length < total) void load(false);
            if (items.length <= 1) setPlaying(null);
          }}
          onClose={() => setPlaying(null)}
        />
      )}

      {exporting && <ExportDialog reviewKey={reviewKey} status={exporting} onClose={() => setExporting(null)} />}
    </PageShell>
  );
}

function ReviewCard({
  item,
  selected,
  actions,
  onToggle,
  onAct,
  onWatch,
}: {
  item: ReviewItem;
  selected: boolean;
  actions: Action[];
  onToggle: (id: string) => void;
  onAct: (ids: string[], to: ReviewStatus) => void;
  onWatch: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className={`rv-card${selected ? ' on' : ''}`} data-video={item.video_id}>
      <button type="button" className="rv-thumb" onClick={onWatch} aria-label={`Watch ${item.title}`}>
        {item.thumbnail_url && imgOk ? <img src={item.thumbnail_url} alt="" loading="lazy" draggable={false} onError={() => setImgOk(false)} /> : <span className="rv-noimg" />}
        <span className="rv-play" aria-hidden="true">
          <Play size={22} fill="currentColor" />
        </span>
        {item.duration_seconds != null && <span className="rv-dur">{duration(item.duration_seconds)}</span>}
        {item.made_for_kids && <span className="rv-kids">Made for kids</span>}
      </button>
      <label className="rv-check" title="Select">
        <input type="checkbox" checked={selected} onChange={() => onToggle(item.video_id)} aria-label={`Select ${item.title}`} />
      </label>
      <div className="rv-meta">
        <b className="rv-title" title={item.title}>
          {item.title}
        </b>
        <span className="rv-sub">{item.channel_title ?? 'Unknown channel'}</span>
        <span className="rv-sub">
          {item.view_count != null ? `${compact(item.view_count)} views · ` : ''}
          {catLabel(item.category)}
          {item.orientation && item.orientation !== 'vertical' ? ` · ${item.orientation}` : ''}
        </span>
      </div>
      <div className="rv-acts">
        {actions.map((a) => (
          <button key={a.to} type="button" className={`btn btn-xs btn-${a.tone}`} onClick={() => onAct([item.video_id], a.to)} title={a.label}>
            <a.icon size={13} /> {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- one by one */

function OneByOne({
  items,
  index,
  total,
  host,
  actions,
  onIndex,
  onAct,
  onClose,
}: {
  items: ReviewItem[];
  index: number;
  total: number;
  host: 'nocookie' | 'youtube';
  actions: Action[];
  onIndex: (i: number) => void;
  onAct: (id: string, to: ReviewStatus) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const latest = useRef({ item, index, actions, onIndex, onAct, onClose });
  latest.current = { item, index, actions, onIndex, onAct, onClose };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const L = latest.current;
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === 'escape') L.onClose();
      else if (k === 'arrowright' || k === 'j') L.onIndex(L.index + 1);
      else if (k === 'arrowleft' || k === 'k') L.onIndex(L.index - 1);
      else {
        const a = L.actions.find((x) => x.key === k);
        if (a && L.item) L.onAct(L.item.video_id, a.to);
        else handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const src = useMemo(() => {
    if (!item) return '';
    const origin = pageOrigin();
    const base = host === 'nocookie' ? YT_HOSTS.nocookie : YT_HOSTS.youtube;
    return `${base}/embed/${encodeURIComponent(item.video_id)}?autoplay=1&playsinline=1&rel=0${origin ? '&origin=' + encodeURIComponent(origin) : ''}`;
  }, [item, host]);

  if (!item) return null;
  return (
    <div className="rv-player" role="dialog" aria-modal="true" aria-label="Review one by one" onClick={onClose}>
      <div className="rv-player-box" onClick={(e) => e.stopPropagation()}>
        <div className={`rv-frame${item.orientation === 'horizontal' ? ' wide' : ''}`}>
          <iframe
            key={item.video_id}
            src={src}
            title={item.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="rv-side">
          <div className="rv-side-top">
            <span className="muted small">
              {index + 1} of {total.toLocaleString()}
            </span>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close (Esc)" title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
          <h3 className="rv-side-title">{item.title}</h3>
          <p className="muted small">
            {item.channel_title ?? 'Unknown channel'}
            {item.view_count != null ? ` · ${compact(item.view_count)} views` : ''}
            {item.duration_seconds != null ? ` · ${duration(item.duration_seconds)}` : ''} · {catLabel(item.category)}
          </p>
          {item.made_for_kids && <span className="pill">Made for kids</span>}
          <a className="details-yt" href={youtubeWatchUrl(item.video_id)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} /> Open on YouTube
          </a>
          <div className="rv-side-acts">
            {actions.map((a) => (
              <button key={a.to} type="button" className={`btn btn-sm btn-${a.tone}`} onClick={() => onAct(item.video_id, a.to)}>
                <a.icon size={14} /> {a.label}
                {a.key && <kbd>{a.key.toUpperCase()}</kbd>}
              </button>
            ))}
          </div>
          <div className="rv-side-nav">
            <button type="button" className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => onIndex(index - 1)}>
              <ChevronLeft size={14} /> Previous <kbd>K</kbd>
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={index >= items.length - 1} onClick={() => onIndex(index + 1)}>
              Skip <kbd>J</kbd> <ChevronRight size={14} />
            </button>
          </div>
          <p className="muted small">After a choice, the next video opens. Esc closes.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- export for the school */

function toText(rows: ExportRow[], status: ReviewStatus): string {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const head = status === 'shortlisted' ? 'Videos proposed for SirSC Scroll' : 'Videos approved for SirSC Scroll';
  const out: string[] = [`${head} (${rows.length}), ${date}`, ''];
  let cat = '';
  let n = 0;
  for (const r of rows) {
    if (r.category !== cat) {
      cat = r.category;
      out.push('', `${catLabel(r.category)} (${rows.filter((x) => x.category === cat).length})`);
    }
    n++;
    out.push(`${n}. ${r.title} | ${r.channel_title ?? 'Unknown channel'} | ${r.duration_seconds != null ? duration(r.duration_seconds) : '?'} | ${r.url}`);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

function toCsv(rows: ExportRow[]): string {
  const q = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return ['category,title,channel,duration_seconds,views,made_for_kids,url', ...rows.map((r) => [r.category, r.title, r.channel_title, r.duration_seconds, r.view_count, r.made_for_kids, r.url].map(q).join(','))].join('\n');
}

function ExportDialog({ reviewKey, status, onClose }: { reviewKey: string; status: ReviewStatus; onClose: () => void }) {
  const [rows, setRows] = useState<ExportRow[] | null>(null);
  const [error, setError] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    reviewExport(CATALOG, reviewKey, status).then(setRows, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, [reviewKey, status]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const text = rows ? toText(rows, status) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('List copied');
    } catch {
      box.current?.focus();
      box.current?.select();
      toast('Press Ctrl+C to copy the selected list');
    }
  };
  const download = () => {
    if (!rows) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }));
    a.download = `sirsc-scroll-${status}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="rv-player" role="dialog" aria-modal="true" aria-label="List for the school" onClick={onClose}>
      <div className="rv-export" onClick={(e) => e.stopPropagation()}>
        <div className="rv-side-top">
          <b>{status === 'shortlisted' ? 'List for the school' : 'Approved videos'}</b>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {error ? (
          <p className="warn-text">Couldn’t load the list: {error}</p>
        ) : !rows ? (
          <p className="muted small">Loading…</p>
        ) : (
          <>
            <p className="muted small">
              {rows.length} videos, grouped by category, each with its YouTube link. Copy it into an email or document, or download it as a spreadsheet
              (CSV). If the download doesn’t start (Google Sites can block downloads), use Copy.
            </p>
            <textarea ref={box} readOnly value={text} rows={14} aria-label="The list" />
            <div className="btn-row">
              <button type="button" className="btn btn-accent btn-sm" onClick={() => void copy()}>
                <Copy size={14} /> Copy
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={download}>
                <Download size={14} /> Download CSV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
