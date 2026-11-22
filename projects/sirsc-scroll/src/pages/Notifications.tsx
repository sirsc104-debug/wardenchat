import { useEffect, useMemo, useRef, useState } from 'react';
import { AtSign, BellOff, CheckCheck, Heart, MessageSquareText, RotateCcw } from 'lucide-react';
import type { ActivityEntry } from '../state/types';
import { PageShell, Panel } from './PageShell';
import { Avatar } from '../components/common/Avatar';
import { VideoArt } from '../components/common/VideoArt';
import { Empty } from '../components/common/Empty';
import { useAcct, usePersisted } from '../state/store';
import { openSheet, openVideo, toast } from '../state/actions';
import { focusWidget } from '../state/widgets';
import { getUser, getVideo } from '../lib/catalog';
import { lookupCatalogIds } from '../lib/remoteCatalog';
import { ago, agoLong, dayBucket } from '../lib/format';
import { href, navigate } from '../lib/router';
import { useLayout, useNow } from '../lib/hooks';
import { memberUser } from '../data/users';
import { loadNotices, markNoticesSeen, noticesSnapshot, useSocialVersion, type Notice } from '../lib/social';

type Filter = 'all' | 'reply' | 'mention' | 'comment_like';

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['reply', 'Replies'],
  ['mention', 'Mentions'],
  ['comment_like', 'Likes on your comments'],
];

const ICON: Record<Notice['kind'], typeof Heart> = { reply: MessageSquareText, mention: AtSign, comment_like: Heart };
const TEXT: Record<Notice['kind'], string> = { reply: 'replied to your comment', mention: 'mentioned you in a comment', comment_like: 'liked your comment' };
const TYPE_CLASS: Record<Notice['kind'], string> = { reply: 'reply', mention: 'mention', comment_like: 'like' };

function NoteRow({ n, index, unread }: { n: Notice; index: number; unread: boolean }) {
  const p = usePersisted();
  const now = useNow();
  const layout = useLayout();
  const actor = memberUser(n.actor.id, n.actor.username);
  const video = getVideo(p, n.videoId);
  const Icon = ICON[n.kind];
  const open = async () => {
    if (!getVideo(p, n.videoId)) await lookupCatalogIds([n.videoId]);
    if (!getVideo(p, n.videoId)) {
      toast('That video isn’t available anymore.');
      return;
    }
    openVideo(n.videoId);
    navigate('#/watch');
    // The comments, where the reply or like happened.
    window.setTimeout(() => (layout === 'mobile' ? openSheet('comments') : focusWidget('comments')), 350);
  };
  return (
    <li className={`note${unread ? ' unread' : ''}`} style={{ '--n': index } as React.CSSProperties}>
      <button type="button" className="note-hit" onClick={() => void open()}>
        <span className="note-av">
          <Avatar user={actor} size={40} />
          <span className={`note-type t-${TYPE_CLASS[n.kind]}`}>
            <Icon size={11} />
          </span>
        </span>
        <span className="note-text">
          <span>
            <b>{n.actor.username}</b> {TEXT[n.kind]}
          </span>
          <span className="note-quote">“{n.text}”</span>
          <span className="note-time" title={agoLong(n.at, now)}>
            {ago(n.at, now)}
          </span>
        </span>
        {video && (
          <span className="note-thumb">
            <VideoArt video={video} running={false} />
          </span>
        )}
      </button>
    </li>
  );
}

const ACT_TEXT: Record<ActivityEntry['type'], string> = {
  like: 'You liked',
  unlike: 'You unliked',
  save: 'You saved',
  comment: 'You commented on',
  reply: 'You replied on',
  follow: 'You followed',
  unfollow: 'You unfollowed',
  'not-interested': 'Not interested:',
  'hide-creator': 'You hid',
  report: 'You reported',
  collection: 'You created a collection',
};

function ActivityLog() {
  const p = usePersisted();
  const now = useNow();
  const acts = useAcct((a) => a.activity);
  return (
    <Panel title="Your activity" action={<span className="muted small">{acts.length} actions</span>}>
      {acts.length ? (
        <ul className="act-log">
          {acts.slice(0, 30).map((a) => {
            const v = a.videoId ? getVideo(p, a.videoId) : undefined;
            const u = a.userId ? getUser(p, a.userId) : undefined;
            return (
              <li key={a.id}>
                <span className="act-text">
                  {ACT_TEXT[a.type]}{' '}
                  {u ? <a href={href.profile(u.handle)}>@{u.handle}</a> : v ? <b>{v.title}</b> : a.detail ? <b>“{a.detail}”</b> : null}
                </span>
                <span className="act-time">{ago(a.at, now)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">Likes, follows, saves and comments you make show up here.</p>
      )}
    </Panel>
  );
}

export function Notifications() {
  useSocialVersion();
  const now = useNow();
  const layout = useLayout();
  const st = noticesSnapshot();
  const [filter, setFilter] = useState<Filter>('all');
  // What was new when the page opened stays highlighted while you're here.
  const newSince = useRef<number | null>(null);
  if (newSince.current === null && st.status === 'ready') newSince.current = st.seenAt;

  useEffect(() => {
    void loadNotices();
  }, []);
  // Opening the inbox counts as seeing everything in it.
  useEffect(() => {
    if (st.status === 'ready') void markNoticesSeen();
  }, [st.status, st.items.length]);

  const counts = useMemo(() => {
    const m = new Map<Filter, number>();
    for (const [f] of FILTERS) m.set(f, f === 'all' ? st.items.length : st.items.filter((n) => n.kind === f).length);
    return m;
  }, [st.items]);
  const shown = useMemo(() => (filter === 'all' ? st.items : st.items.filter((n) => n.kind === filter)), [st.items, filter]);
  const groups = useMemo(() => {
    const m = new Map<string, Notice[]>();
    for (const n of shown) {
      const b = dayBucket(n.at, now);
      m.set(b, [...(m.get(b) ?? []), n]);
    }
    return [...m.entries()];
  }, [shown, now]);
  const fresh = st.items.filter((n) => n.at > (newSince.current ?? st.seenAt)).length;
  const week = st.items.filter((n) => now - n.at < 7 * 86_400_000);

  const aside = (
    <>
      <Panel title="This week">
        <div className="mini-stats">
          <div>
            <b>{week.filter((n) => n.kind === 'reply').length}</b>
            <span>replies</span>
          </div>
          <div>
            <b>{week.filter((n) => n.kind === 'mention').length}</b>
            <span>mentions</span>
          </div>
          <div>
            <b>{week.filter((n) => n.kind === 'comment_like').length}</b>
            <span>comment likes</span>
          </div>
        </div>
      </Panel>
      <ActivityLog />
    </>
  );

  return (
    <PageShell
      title={
        <>
          Notifications {fresh > 0 && <span className="pill pill-hot">{fresh} new</span>}
        </>
      }
      actions={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadNotices()} disabled={st.status === 'loading'}>
          <RotateCcw size={14} /> Refresh
        </button>
      }
      aside={layout === 'desktop' ? aside : undefined}
    >
      <div className="chips wrap" role="toolbar" aria-label="Filter notifications">
        {FILTERS.map(([f, label]) => (
          <button key={f} type="button" className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {label} <span className="seg-n">{counts.get(f)}</span>
          </button>
        ))}
      </div>
      {st.status === 'loading' && !st.items.length && <p className="muted small">Loading…</p>}
      {st.status === 'error' && (
        <Empty icon={BellOff} title="Couldn’t load notifications" action={<button type="button" className="btn btn-accent btn-sm" onClick={() => void loadNotices()}>Try again</button>}>
          Check your connection.
        </Empty>
      )}
      {groups.length > 0 &&
        groups.map(([label, list]) => (
          <section key={label} className="note-group">
            <h2 className="hist-label">{label}</h2>
            <ul className="notes" key={filter}>
              {list.map((n, i) => (
                <NoteRow key={`${n.kind}${n.commentId}${n.actor.id}${n.at}`} n={n} index={i} unread={n.at > (newSince.current ?? st.seenAt)} />
              ))}
            </ul>
          </section>
        ))}
      {st.status === 'ready' && !groups.length && (
        <Empty icon={BellOff} title="Nothing here yet">
          {filter === 'all' ? 'When someone replies to your comments, mentions you with @ or likes one of your comments, it shows up here. Notifications from the last 30 days are kept.' : 'Try another filter.'}
        </Empty>
      )}
      <p className="muted small note-foot">
        <CheckCheck size={12} /> Opening this page marks everything as seen.
      </p>
      {layout !== 'desktop' && aside}
    </PageShell>
  );
}
