import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BarChart3, Compass, Info, ListVideo, MessageCircle, Shapes, UserRound, Users } from 'lucide-react';
import type { FeedState, Video, WidgetId } from '../../state/types';
import { Widget, type Phase } from './Widget';
import { Verified } from '../common/Verified';
import { Comments } from '../panel/Comments';
import { CreatorRow, FriendsActivity, MoreFromCreator, RecommendedCreators, Related, ShareRow, StatTiles, SuggestedCategories, TrendingTags, UpNext, VideoDetails } from '../panel/Sections';
import { useP, usePersisted, useS } from '../../state/store';
import { visibleWidgets } from '../../state/widgets';
import { commentCount, getUser, totalLikes, videosBy } from '../../lib/catalog';
import { maxColumnsFor, planColumns } from '../../lib/widgetLayout';
import { compact, full } from '../../lib/format';
import { href } from '../../lib/router';

const ICON = { creator: UserRound, info: Info, stats: BarChart3, comments: MessageCircle, upnext: ListVideo, related: Shapes, friends: Users, discovery: Compass } as const;
const MIN: Record<WidgetId, number> = { creator: 96, info: 120, stats: 96, comments: 250, upnext: 150, related: 180, friends: 150, discovery: 180 };
const LEAVE_MS = 280;

interface Rendered {
  id: WidgetId;
  phase: Phase;
}

/** Keeps a closed widget mounted while it folds away, and lets a new one unfold. */
function usePresence(ids: WidgetId[], order: WidgetId[], reduced: boolean): Rendered[] {
  const [rendered, setRendered] = useState<Rendered[]>(() => ids.map((id) => ({ id, phase: 'shown' })));
  const key = ids.join();
  useEffect(() => {
    setRendered((prev) => {
      const next: Rendered[] = prev.map((r) => (ids.includes(r.id) ? (r.phase === 'leaving' ? { id: r.id, phase: 'shown' } : r) : r.phase === 'leaving' ? r : { id: r.id, phase: 'leaving' }));
      for (const id of ids) if (!next.some((r) => r.id === id)) next.push({ id, phase: reduced ? 'shown' : 'entering' });
      return reduced ? next.filter((r) => r.phase !== 'leaving') : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);
  useEffect(() => {
    if (!rendered.some((r) => r.phase === 'entering')) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRendered((p) => p.map((r) => (r.phase === 'entering' ? { ...r, phase: 'shown' } : r))));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [rendered]);
  useEffect(() => {
    if (!rendered.some((r) => r.phase === 'leaving')) return;
    const t = window.setTimeout(() => setRendered((p) => p.filter((r) => r.phase !== 'leaving')), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [rendered]);
  return useMemo(() => rendered.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)), [rendered, order]);
}

/* ---------------------------------------------------------------- widget bodies */

const CreatorBody = memo(function CreatorBody({ video }: { video: Video }) {
  const p = usePersisted();
  const u = getUser(p, video.creatorId);
  if (!u) return null;
  const n = videosBy(p, u.id).length;
  return (
    <div className="wb-creator">
      <CreatorRow video={video} />
      <p className="wb-bio">{u.bio}</p>
      <p className="wb-line">
        <span>
          <b>{full(n)}</b> videos
        </span>
        <span>
          <b>{compact(totalLikes(p, u))}</b> likes
        </span>
        <a className="link-btn" href={href.profile(u.handle)}>
          View profile
        </a>
      </p>
    </div>
  );
});

const InfoBody = memo(function InfoBody({ video, reason }: { video: Video; reason?: string }) {
  const focus = useS((s) => s.widgetFocus);
  const openMore = focus?.id === 'info' ? focus.n : 0;
  return (
    <div className="wb-info">
      <VideoDetails video={video} reason={reason} hideStats openMore={openMore} />
      <ShareRow video={video} />
    </div>
  );
});

const RelatedBody = memo(function RelatedBody({ video, feed }: { video: Video; feed: FeedState }) {
  return (
    <div className="wb-related">
      <Related video={video} feed={feed} columns={3} bare />
      <MoreFromCreator video={video} />
    </div>
  );
});

const DiscoveryBody = memo(function DiscoveryBody({ video }: { video: Video }) {
  return (
    <div className="wb-discovery">
      <TrendingTags limit={10} />
      <SuggestedCategories />
      <RecommendedCreators focus={video.category} limit={4} />
    </div>
  );
});

/* ---------------------------------------------------------------- area */

interface Props {
  video: Video | undefined;
  reason?: string;
  feed: FeedState;
  /** Width the area has been given (0 in Focus Mode). */
  width: number;
}

/** The flexible workspace beside the player: visible widgets laid out in columns that share the space. */
export const WidgetArea = memo(function WidgetArea({ video, reason, feed, width }: Props) {
  const p = usePersisted();
  const prefs = useP((pp) => pp.widgets);
  const reduced = useP((pp) => pp.settings.reducedMotion);
  const visible = useMemo(() => visibleWidgets(prefs), [prefs]);
  const rendered = usePresence(visible, prefs.order, reduced);
  const live = useMemo(() => new Set(rendered.filter((r) => r.phase === 'shown').map((r) => r.id)), [rendered]);
  const cols = planColumns(
    rendered.map((r) => r.id),
    live,
    maxColumnsFor(width),
    prefs.expanded,
  );
  const phaseOf = (id: WidgetId) => rendered.find((r) => r.id === id)?.phase ?? 'shown';
  const lastWidth = useRef(width);
  if (width > 0) lastWidth.current = width;

  if (!video) {
    return (
      <div className="wcols" style={{ width: lastWidth.current }}>
        <div className="wcol" style={{ flexGrow: 1 }}>
          <section className="widget fill shown" style={{ '--grow': 1, '--wmin': '200px' } as CSSProperties}>
            <div className="w-body">
              <RecommendedCreators limit={6} />
            </div>
          </section>
        </div>
      </div>
    );
  }

  const body = (id: WidgetId) => {
    switch (id) {
      case 'creator':
        return <CreatorBody video={video} />;
      case 'info':
        return <InfoBody video={video} reason={reason} />;
      case 'stats':
        return <StatTiles video={video} withViews />;
      case 'comments':
        return <Comments video={video} mode="full" variant="widget" />;
      case 'upnext':
        return <UpNext feed={feed} count={14} bare />;
      case 'related':
        return <RelatedBody video={video} feed={feed} />;
      case 'friends':
        return <FriendsActivity limit={14} bare />;
      case 'discovery':
        return <DiscoveryBody video={video} />;
    }
  };
  const extra = (id: WidgetId) => {
    if (id === 'comments') return video.allowComments === false ? 'off' : compact(commentCount(p, video));
    if (id === 'upnext') return `${feed.index + 1} of ${feed.items.length}`;
    if (id === 'creator') {
      const u = getUser(p, video.creatorId);
      return u?.verified ? <Verified size={12} /> : undefined;
    }
    return undefined;
  };
  const shownIds = rendered.filter((r) => r.phase !== 'leaving').map((r) => r.id);

  return (
    <div className="wcols" style={{ width: lastWidth.current }}>
      {cols.map((c) => (
        <div key={c.key} className={`wcol${c.weight ? '' : ' collapsing'}${c.expanded ? ' has-expanded' : ''}`} style={{ flexGrow: c.weight, minWidth: c.min }}>
          {c.ids.map((id) => (
            <Widget
              key={id}
              id={id}
              icon={ICON[id]}
              phase={phaseOf(id)}
              expanded={prefs.expanded === id}
              extra={extra(id)}
              selfScroll={id === 'comments'}
              min={MIN[id]}
              contentKey={video.id}
              first={shownIds[0] === id}
              last={shownIds[shownIds.length - 1] === id}
            >
              {body(id)}
            </Widget>
          ))}
        </div>
      ))}
    </div>
  );
});

