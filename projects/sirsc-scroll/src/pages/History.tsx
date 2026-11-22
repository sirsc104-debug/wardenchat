import { useMemo, useState } from 'react';
import { History as HistoryIcon, Pause, Play, Search, Trash2, X } from 'lucide-react';
import type { Video } from '../state/types';
import { PageShell } from './PageShell';
import { useOpenList } from './Explore';
import { VideoCard } from '../components/common/VideoCard';
import { Empty } from '../components/common/Empty';
import { useAcct, usePersisted } from '../state/store';
import { clearHistory, confirmAction, removeHistory, setHistoryPaused } from '../state/actions';
import { getUser, getVideo } from '../lib/catalog';
import { ago, dayBucket } from '../lib/format';
import { useNow } from '../lib/hooks';

export function History() {
  const p = usePersisted();
  const now = useNow();
  const history = useAcct((a) => a.history);
  const paused = useAcct((a) => a.historyPaused);
  const [q, setQ] = useState('');
  const entries = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return history
      .map((h) => ({ h, v: getVideo(p, h.videoId) }))
      .filter((x): x is { h: typeof x.h; v: Video } => !!x.v)
      .filter(({ v }) => !needle || v.title.toLowerCase().includes(needle) || getUser(p, v.creatorId)?.handle.includes(needle) || v.hashtags.some((t) => t.includes(needle.replace('#', ''))));
  }, [history, p, q]);
  const open = useOpenList(
    entries.map((e) => e.v),
    'Watch history',
  );
  const groups = useMemo(() => {
    const m = new Map<string, typeof entries>();
    for (const e of entries) {
      const b = dayBucket(e.h.at, now);
      m.set(b, [...(m.get(b) ?? []), e]);
    }
    return [...m.entries()];
  }, [entries, now]);

  return (
    <PageShell
      title="Watch history"
      actions={
        <>
          <label className="mini-search">
            <Search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search history" aria-label="Search watch history" />
          </label>
          <button type="button" className={`btn btn-sm ${paused ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setHistoryPaused(!paused)} aria-pressed={paused}>
            {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume history' : 'Pause history'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!history.length} onClick={() => confirmAction('Clear watch history?', 'This removes every video from this account’s history. Recommendations keep what they learned.', 'Clear history', clearHistory)}>
            <Trash2 size={14} /> Clear all
          </button>
        </>
      }
    >
      {paused && <p className="notice">History is paused. New videos you watch aren’t added, and they don’t count as watched for recommendations.</p>}
      {!entries.length ? (
        <Empty icon={HistoryIcon} title={q ? 'No matches in your history' : 'No watch history'} action={!q && <a className="btn btn-accent btn-sm" href="#/">Start watching</a>}>
          {q ? 'Try a different word.' : 'Videos you watch show up here, newest first.'}
        </Empty>
      ) : (
        groups.map(([label, list]) => (
          <section key={label} className="hist-group">
            <h2 className="hist-label">
              {label} <span className="muted">· {list.length}</span>
            </h2>
            <ul className="hist-list">
              {list.map(({ h, v }) => (
                <li key={v.id} className="hist-row">
                  <VideoCard
                    video={v}
                    layout="row"
                    onOpen={open}
                    sub={
                      <>
                        <span className="hist-bar" aria-label={`Watched ${Math.round(h.progress * 100)}%`}>
                          <i style={{ width: `${Math.round(h.progress * 100)}%` }} />
                        </span>
                        {h.completions > 0 ? `Watched${h.completions > 1 ? ` ${h.completions}×` : ''}` : `${Math.round(h.progress * 100)}% watched`} · {ago(h.at, now)}
                      </>
                    }
                  />
                  <button type="button" className="icon-btn xs" onClick={() => removeHistory(v.id)} aria-label={`Remove ${v.title} from history`} title="Remove from history">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </PageShell>
  );
}
