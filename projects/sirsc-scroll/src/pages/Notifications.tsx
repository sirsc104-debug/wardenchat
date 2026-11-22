import { useMemo, useState } from 'react';
import { AtSign, Bell, BellOff, CheckCheck, Flame, Heart, MessageSquareText, Send, Sparkles, UserPlus, Circle, CircleDot } from 'lucide-react';
import type { ActivityEntry, AppNotification, NotificationType } from '../state/types';
import { PageShell, Panel } from './PageShell';
import { Avatar } from '../components/common/Avatar';
import { VideoArt } from '../components/common/VideoArt';
import { Empty } from '../components/common/Empty';
import { useAcct, usePersisted } from '../state/store';
import { markAllRead, markRead, openVideo, toggleRead } from '../state/actions';
import { getUser, getVideo } from '../lib/catalog';
import { ago, agoLong, dayBucket } from '../lib/format';
import { href, navigate } from '../lib/router';
import { useLayout, isDue, useNow } from '../lib/hooks';

type Filter = 'all' | 'unread' | 'follow' | 'like' | 'comment' | 'mention' | 'share' | 'updates';

const FILTERS: [Filter, string, NotificationType[]][] = [
  ['all', 'All', []],
  ['unread', 'Unread', []],
  ['follow', 'Followers', ['follow']],
  ['like', 'Likes', ['like']],
  ['comment', 'Comments', ['comment', 'reply']],
  ['mention', 'Mentions', ['mention']],
  ['share', 'Shares', ['share']],
  ['updates', 'Trending & updates', ['trending', 'post', 'system']],
];

const ICON: Record<NotificationType, typeof Heart> = {
  follow: UserPlus,
  like: Heart,
  reply: MessageSquareText,
  comment: MessageSquareText,
  mention: AtSign,
  share: Send,
  trending: Flame,
  post: Sparkles,
  system: Bell,
};

function NoteRow({ n, index }: { n: AppNotification; index: number }) {
  const p = usePersisted();
  const now = useNow();
  const actor = n.actorId ? getUser(p, n.actorId) : undefined;
  const video = n.videoId ? getVideo(p, n.videoId) : undefined;
  const Icon = ICON[n.type];
  const open = () => {
    markRead(n.id);
    if (video) {
      openVideo(video.id);
      navigate('#/watch');
    } else if (actor) navigate(href.profile(actor.handle));
  };
  const selfActor = n.type === 'trending' && n.actorId === p.activeId;
  return (
    <li className={`note${n.read ? '' : ' unread'}`} style={{ '--n': index } as React.CSSProperties}>
      <button type="button" className="note-hit" onClick={open}>
        <span className="note-av">
          {actor && !selfActor ? <Avatar user={actor} size={40} /> : <span className="note-sys"><Icon size={18} /></span>}
          <span className={`note-type t-${n.type}`}>
            <Icon size={11} />
          </span>
        </span>
        <span className="note-text">
          <span>
            {actor && !selfActor && n.type !== 'system' && <b>{actor.name}</b>} {n.text}
          </span>
          {n.quote && <span className="note-quote">“{n.quote}”</span>}
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
      <button type="button" className="icon-btn xs note-read" onClick={() => toggleRead(n.id)} aria-label={n.read ? 'Mark as unread' : 'Mark as read'} title={n.read ? 'Mark as unread' : 'Mark as read'}>
        {n.read ? <Circle size={12} /> : <CircleDot size={12} />}
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
  share: 'You shared',
  publish: 'You published',
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
                  {a.type === 'share' && a.detail && !u && <span className="muted"> via {a.detail === 'link' ? 'link' : a.detail === 'warden' ? 'Warden Chat' : a.detail}</span>}
                </span>
                <span className="act-time">{ago(a.at, now)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">Likes, follows, comments and shares you make show up here.</p>
      )}
    </Panel>
  );
}

export function Notifications() {
  const now = useNow();
  const layout = useLayout();
  const all = useAcct((a) => a.notifications);
  const [filter, setFilter] = useState<Filter>('all');
  const due = useMemo(() => all.filter((n) => isDue(n.at, now)).sort((a, b) => b.at - a.at), [all, now]);
  const counts = useMemo(() => {
    const m = new Map<Filter, number>();
    for (const [f, , types] of FILTERS) m.set(f, f === 'all' ? due.length : f === 'unread' ? due.filter((n) => !n.read).length : due.filter((n) => types.includes(n.type)).length);
    return m;
  }, [due]);
  const shown = useMemo(() => {
    const def = FILTERS.find((f) => f[0] === filter)!;
    if (filter === 'all') return due;
    if (filter === 'unread') return due.filter((n) => !n.read);
    return due.filter((n) => def[2].includes(n.type));
  }, [due, filter]);
  const groups = useMemo(() => {
    const m = new Map<string, AppNotification[]>();
    for (const n of shown) {
      const b = dayBucket(n.at, now);
      m.set(b, [...(m.get(b) ?? []), n]);
    }
    return [...m.entries()];
  }, [shown, now]);
  const unread = counts.get('unread') ?? 0;
  const week = due.filter((n) => now - n.at < 7 * 86_400_000);

  const aside = (
    <>
      <Panel title="This week">
        <div className="mini-stats">
          <div>
            <b>{week.filter((n) => n.type === 'follow').length}</b>
            <span>new followers</span>
          </div>
          <div>
            <b>{week.filter((n) => n.type === 'like').length}</b>
            <span>likes</span>
          </div>
          <div>
            <b>{week.filter((n) => n.type === 'comment' || n.type === 'reply' || n.type === 'mention').length}</b>
            <span>comments</span>
          </div>
          <div>
            <b>{week.filter((n) => n.type === 'share').length}</b>
            <span>videos sent</span>
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
          Notifications {unread > 0 && <span className="pill pill-hot">{unread} new</span>}
        </>
      }
      actions={
        <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead} disabled={!unread}>
          <CheckCheck size={14} /> Mark all as read
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
      {groups.length ? (
        groups.map(([label, list]) => (
          <section key={label} className="note-group">
            <h2 className="hist-label">{label}</h2>
            <ul className="notes" key={filter}>
              {list.map((n, i) => (
                <NoteRow key={n.id} n={n} index={i} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <Empty icon={BellOff} title={filter === 'unread' ? 'You’re all caught up' : 'Nothing here yet'}>
          {filter === 'all' ? 'Follows, likes, replies and shares from other accounts appear here.' : 'Try another filter.'}
        </Empty>
      )}
      {layout !== 'desktop' && aside}
    </PageShell>
  );
}
