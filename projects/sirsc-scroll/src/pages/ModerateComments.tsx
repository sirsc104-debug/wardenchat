// The owner's comment moderation (#/review/comments), with the same review key as the video review page.
// Reported comments first; remove or restore comments, close reports, and stop an account from liking
// and commenting on SirSC Scroll. Everything is logged in the database (scroll_private.mod_log).
import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, ExternalLink, EyeOff, Flag, RotateCcw, Undo2 } from 'lucide-react';
import { PageShell } from './PageShell';
import { Empty } from '../components/common/Empty';
import { confirmAction, toast, updateSettings } from '../state/actions';
import { anonRpc, ApiError } from '../lib/warden';
import { youtubeWatchUrl } from '../lib/videoSource';
import { ago } from '../lib/format';
import { useNow } from '../lib/hooks';

type View = 'reported' | 'recent' | 'removed';

interface ModItem {
  id: number;
  video_id: string;
  video_title: string | null;
  parent_id: number | null;
  author: { id: string; username: string };
  author_banned: boolean;
  body: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: 'author' | 'owner' | null;
  likes: number;
  reports: number;
  reasons: Record<string, number>;
}

interface ModPage {
  total: number;
  counts: Record<View, number>;
  banned: { id: string; username: string; reason: string | null; at: string }[];
  items: ModItem[];
}

const VIEWS: [View, string][] = [
  ['reported', 'Reported'],
  ['recent', 'All comments'],
  ['removed', 'Removed'],
];
const REASON: Record<string, string> = { bullying: 'bullying', hate: 'hateful', inappropriate: 'not for school', spam: 'spam', other: 'other' };
const PAGE = 50;

function keyRejected(e: unknown) {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

export function ModerateComments({ reviewKey }: { reviewKey: string }) {
  const now = useNow();
  const [view, setView] = useState<View>('reported');
  const [page, setPage] = useState<ModPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (more = false) => {
      setBusy(true);
      setError('');
      try {
        const r = await anonRpc<ModPage>('scroll_mod_comments', { p_key: reviewKey, p_view: view, p_offset: more && page ? page.items.length : 0, p_limit: PAGE });
        setPage((prev) => (more && prev ? { ...r, items: [...prev.items, ...r.items.filter((x) => !prev.items.some((p) => p.id === x.id))] } : r));
      } catch (e) {
        if (keyRejected(e)) {
          updateSettings({ catalogReviewKey: '' });
          toast('The review key wasn’t accepted. Paste it again.');
          return;
        }
        setError(e instanceof ApiError && e.code === 'offline' ? 'Couldn’t reach the database. Check your connection.' : 'Couldn’t load comments.');
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviewKey, view, page?.items.length],
  );

  useEffect(() => {
    setPage(null);
    void loadFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, reviewKey]);
  const loadFresh = () => load(false);

  const act = async (ids: number[], action: 'remove' | 'restore' | 'dismiss', done: string) => {
    try {
      await anonRpc<number>('scroll_mod_set', { p_key: reviewKey, p_ids: ids, p_action: action });
      toast(done);
      void load(false);
    } catch {
      toast('That didn’t go through. Try again.');
    }
  };

  const ban = (userId: string, username: string, banned: boolean) => {
    const go = async () => {
      try {
        await anonRpc<boolean>('scroll_mod_ban', { p_key: reviewKey, p_user: userId, p_banned: banned, p_reason: banned ? 'Stopped from the moderation page' : null });
        toast(banned ? `${username} can’t like or comment anymore` : `${username} can like and comment again`);
        void load(false);
      } catch {
        toast('That didn’t go through. Try again.');
      }
    };
    if (banned)
      confirmAction(`Stop ${username}?`, `${username} won’t be able to like or comment on SirSC Scroll, and their comments are hidden from everyone until you allow them again. Their Warden Chat account isn’t affected.`, 'Stop account', () => void go());
    else void go();
  };

  return (
    <PageShell
      title="Moderate comments"
      className="review-page"
      actions={
        <>
          <a className="btn btn-ghost btn-sm" href="#/review">
            Videos
          </a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load(false)} disabled={busy}>
            <RotateCcw size={14} /> Refresh
          </button>
        </>
      }
    >
      <p className="muted small rv-intro">
        People report comments from the comment’s Report button; reported ones show here first. Removing a comment hides it from everyone (you can restore it). Stopping an account
        hides all its comments and blocks new likes and comments on SirSC Scroll only. Comments from accounts suspended or banned on Warden Chat are already hidden.
      </p>
      <div className="seg rv-tabs" role="tablist" aria-label="Which comments">
        {VIEWS.map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
            {label} <span className="rv-count">{(page?.counts?.[v] ?? 0).toLocaleString()}</span>
          </button>
        ))}
      </div>

      {error && (
        <Empty icon={Flag} title={error} action={<button type="button" className="btn btn-accent btn-sm" onClick={() => void load(false)}>Try again</button>}>
          {''}
        </Empty>
      )}
      {!page && busy && <p className="muted small">Loading…</p>}
      {page && !page.items.length && (
        <Empty icon={Check} title={view === 'reported' ? 'No open reports' : view === 'removed' ? 'Nothing removed' : 'No comments yet'}>
          {view === 'reported' ? 'Reported comments show up here.' : ''}
        </Empty>
      )}

      <ul className="mod-list">
        {page?.items.map((c) => (
          <li key={c.id} className={`mod-item${c.deleted_at ? ' removed' : ''}`}>
            <div className="mod-top">
              <b>{c.author.username}</b>
              {c.author_banned && <span className="pill pill-hot">stopped</span>}
              {c.parent_id != null && <span className="pill">reply</span>}
              <span className="muted small">{ago(Date.parse(c.created_at), now)}</span>
              <span className="muted small">· {c.likes} likes</span>
              {c.reports > 0 && (
                <span className="mod-reports">
                  <Flag size={12} /> {c.reports} {c.reports === 1 ? 'report' : 'reports'}:{' '}
                  {Object.entries(c.reasons)
                    .map(([r, n]) => `${REASON[r] ?? r}${n > 1 ? ` ×${n}` : ''}`)
                    .join(', ')}
                </span>
              )}
            </div>
            <p className="mod-body">{c.body}</p>
            <p className="muted small mod-video">
              On{' '}
              <a href={youtubeWatchUrl(c.video_id)} target="_blank" rel="noopener noreferrer">
                {c.video_title ?? c.video_id} <ExternalLink size={11} />
              </a>
              {c.deleted_at && <> · removed by {c.deleted_by === 'owner' ? 'you' : 'its author'} {ago(Date.parse(c.deleted_at), now)}</>}
            </p>
            <div className="btn-row mod-acts">
              {!c.deleted_at && (
                <button type="button" className="btn btn-danger btn-xs" onClick={() => void act([c.id], 'remove', 'Comment removed')}>
                  <EyeOff size={12} /> Remove
                </button>
              )}
              {c.deleted_by === 'owner' && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => void act([c.id], 'restore', 'Comment restored')}>
                  <Undo2 size={12} /> Restore
                </button>
              )}
              {c.reports > 0 && !c.deleted_at && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => void act([c.id], 'dismiss', 'Reports closed; the comment stays')}>
                  <Check size={12} /> Keep it (close reports)
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => ban(c.author.id, c.author.username, !c.author_banned)}>
                <Ban size={12} /> {c.author_banned ? `Allow ${c.author.username} again` : `Stop ${c.author.username}`}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {page && page.items.length < page.total && (
        <button type="button" className="btn btn-ghost btn-block btn-sm" disabled={busy} onClick={() => void load(true)}>
          {busy ? 'Loading…' : 'Show more'}
        </button>
      )}

      {page && page.banned.length > 0 && (
        <section className="mod-banned">
          <h2 className="hist-label">Stopped accounts</h2>
          <ul>
            {page.banned.map((b) => (
              <li key={b.id}>
                <b>{b.username}</b> <span className="muted small">since {new Date(b.at).toLocaleDateString()}</span>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => ban(b.id, b.username, false)}>
                  Allow again
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
