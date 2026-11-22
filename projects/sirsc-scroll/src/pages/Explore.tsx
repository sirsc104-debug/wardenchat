import { useMemo, useState } from 'react';
import { Clock, Flame, Hash, Search, Sparkles, TrendingUp, Users, X } from 'lucide-react';
import type { Category, Video } from '../state/types';
import { PageShell, Panel } from './PageShell';
import { VideoCard } from '../components/common/VideoCard';
import { Avatar } from '../components/common/Avatar';
import { Verified } from '../components/common/Verified';
import { Empty } from '../components/common/Empty';
import { CATEGORY_ICON } from '../components/common/icons';
import { SearchBox } from '../components/shell/TopBar';
import { useAcct, usePersisted } from '../state/store';
import { addRecentSearch, clearRecentSearches, openList, removeRecentSearch, toggleFollow } from '../state/actions';
import { search } from '../lib/search';
import { followerCount, getUser, visibleVideos } from '../lib/catalog';
import { rankForYou, trendingHashtags, trendingScore } from '../lib/recommend';
import { compact } from '../lib/format';
import { getRoute, href, navigate, type Route } from '../lib/router';
import { useLayout } from '../lib/hooks';
import { exitThen } from '../lib/motion';
import { CATEGORIES, categoryInfo } from '../data/categories';
import { USERS } from '../data/users';

/** Open a grid's videos as a swipeable list, starting at the one clicked. */
export function useOpenList(videos: Video[], label: string) {
  return (v: Video) => {
    openList(
      videos.map((x) => x.id),
      v.id,
      label,
      getRoute().hash || '#/',
    );
    navigate('#/watch');
  };
}

export function VideoGrid({ videos, label, stat, limit, rankStart }: { videos: Video[]; label: string; stat?: 'views' | 'likes'; limit?: number; rankStart?: number }) {
  const open = useOpenList(videos, label);
  const list = limit ? videos.slice(0, limit) : videos;
  if (!list.length) return null;
  return (
    <div className="vgrid">
      {list.map((v, i) => (
        <VideoCard key={v.id} video={v} onOpen={open} stat={stat} rank={rankStart !== undefined ? rankStart + i : undefined} index={i} />
      ))}
    </div>
  );
}

function CreatorCards({ ids }: { ids: string[] }) {
  const p = usePersisted();
  const following = useAcct((a) => a.following);
  return (
    <div className="ccards">
      {ids.map((id) => {
        const u = getUser(p, id)!;
        const on = following.includes(id);
        const self = id === p.activeId;
        return (
          <div key={id} className="ccard">
            <a href={href.profile(u.handle)} className="ccard-link">
              <Avatar user={u} size={52} />
              <span className="ccard-name">
                {u.name} {u.verified && <Verified size={12} />}
              </span>
              <span className="ccard-handle">@{u.handle}</span>
              <span className="ccard-sub">{compact(followerCount(p, u))} followers</span>
            </a>
            {!self && (
              <button type="button" className={`btn btn-xs btn-block ${on ? 'btn-ghost' : 'btn-accent'}`} onClick={() => toggleFollow(id)}>
                {on ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CategoryTiles() {
  const p = usePersisted();
  const counts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const v of visibleVideos(p)) m.set(v.category, (m.get(v.category) ?? 0) + 1);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.settings.videoSource]);
  return (
    <div className="cat-tiles">
      {CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICON[c.id];
        return (
          <a key={c.id} href={href.category(c.id)} className="cat-tile" style={{ '--hue': c.hue } as React.CSSProperties}>
            <span className="cat-tile-ico">
              <Icon size={18} />
            </span>
            <span className="cat-tile-label">{c.label}</span>
            <span className="cat-tile-count">{counts.get(c.id) ?? 0} videos</span>
          </a>
        );
      })}
    </div>
  );
}

function TagChips({ limit = 14 }: { limit?: number }) {
  const p = usePersisted();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tags = useMemo(() => trendingHashtags(p, limit), [p.settings.videoSource, limit]);
  return (
    <div className="tag-cloud">
      {tags.map((t, i) => (
        <a key={t.tag} className="tag tag-lg" href={href.tag(t.tag)}>
          <span className="tag-rank">{i + 1}</span>#{t.tag}
          <small>{compact(t.views)} views</small>
        </a>
      ))}
    </div>
  );
}

function ExploreAside() {
  const p = usePersisted();
  const recent = useAcct((a) => a.recentSearches);
  const top = useMemo(
    () =>
      visibleVideos(p)
        .map((v) => ({ v, s: trendingScore(p, v) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 10)
        .map((x) => x.v),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.settings.videoSource],
  );
  const open = useOpenList(top, 'Top 10 today');
  return (
    <>
      <Panel
        title={
          <>
            <Clock size={15} /> Recent searches
          </>
        }
        action={recent.length > 0 && <button type="button" className="link-btn" onClick={clearRecentSearches}>Clear</button>}
      >
        {recent.length ? (
          <ul className="recent">
            {recent.map((r) => (
              <li key={r}>
                <a href={r.startsWith('#') ? href.tag(r.slice(1)) : r.startsWith('@') ? href.profile(r.slice(1)) : href.explore(r)}>
                  <Search size={13} /> {r}
                </a>
                <button type="button" className="icon-btn xs" onClick={(e) => exitThen(e.currentTarget.closest('li'), () => removeRecentSearch(r))} aria-label={`Remove ${r}`}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Your searches show up here.</p>
        )}
      </Panel>
      <Panel
        title={
          <>
            <TrendingUp size={15} /> Top 10 today
          </>
        }
      >
        <ol className="top10">
          {top.map((v, i) => (
            <li key={v.id}>
              <VideoCard video={v} layout="row" onOpen={open} rank={i + 1} />
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}

function Results({ q }: { q: string }) {
  const p = usePersisted();
  const [tab, setTab] = useState<'top' | 'videos' | 'creators' | 'tags'>('top');
  const r = useMemo(() => search(p, q), [p, q]);
  const total = r.videos.length + r.creators.length + r.tags.length;
  if (!total)
    return (
      <Empty icon={Search} title={`No results for “${q}”`}>
        Try a creator’s @handle, a #hashtag, or a topic like “piano” or “space”.
      </Empty>
    );
  const tabs: [typeof tab, string, number][] = [
    ['top', 'Top', total],
    ['videos', 'Videos', r.videos.length],
    ['creators', 'Creators', r.creators.length],
    ['tags', 'Hashtags', r.tags.length],
  ];
  return (
    <>
      <div className="seg" role="tablist" aria-label="Result type">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label} <span className="seg-n">{n}</span>
          </button>
        ))}
      </div>
      {(tab === 'top' || tab === 'creators') && r.creators.length > 0 && (
        <Panel title="Creators">
          <CreatorCards ids={(tab === 'top' ? r.creators.slice(0, 6) : r.creators).map((u) => u.id)} />
        </Panel>
      )}
      {(tab === 'top' || tab === 'tags') && r.tags.length > 0 && (
        <Panel title="Hashtags">
          <div className="tag-cloud">
            {(tab === 'top' ? r.tags.slice(0, 8) : r.tags).map((t) => (
              <a key={t.tag} className="tag tag-lg" href={href.tag(t.tag)}>
                #{t.tag} <small>{t.count} videos · {compact(t.views)} views</small>
              </a>
            ))}
          </div>
        </Panel>
      )}
      {(tab === 'top' || tab === 'videos') && r.videos.length > 0 && (
        <Panel title={`Videos · ${r.videos.length}`}>
          <VideoGrid videos={tab === 'top' ? r.videos.slice(0, 24) : r.videos} label={`Search: ${q}`} />
        </Panel>
      )}
    </>
  );
}

function CategoryView({ cat }: { cat: Category }) {
  const p = usePersisted();
  const info = categoryInfo(cat);
  const Icon = CATEGORY_ICON[cat];
  const [sort, setSort] = useState<'trending' | 'new' | 'liked'>('trending');
  const vids = useMemo(() => {
    const list = visibleVideos(p).filter((v) => v.category === cat);
    if (sort === 'new') return list.sort((a, b) => b.uploadedAt - a.uploadedAt);
    if (sort === 'liked') return list.sort((a, b) => b.likes - a.likes);
    return list.map((v) => ({ v, s: trendingScore(p, v) })).sort((a, b) => b.s - a.s).map((x) => x.v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.settings.videoSource, cat, sort]);
  const creators = USERS.filter((u) => u.kind === 'creator' && u.categories.includes(cat)).map((u) => u.id);
  return (
    <>
      <div className="hero-strip" style={{ '--hue': info.hue } as React.CSSProperties}>
        <span className="hero-ico">
          <Icon size={22} />
        </span>
        <div>
          <h1>{info.label}</h1>
          <p>
            {info.blurb} · {vids.length} videos
          </p>
        </div>
        <div className="seg seg-sm hero-sort" role="tablist" aria-label="Sort">
          {(['trending', 'new', 'liked'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={sort === k} onClick={() => setSort(k)}>
              {k === 'trending' ? 'Trending' : k === 'new' ? 'Newest' : 'Most liked'}
            </button>
          ))}
        </div>
      </div>
      {creators.length > 0 && (
        <Panel title="Top creators">
          <CreatorCards ids={creators} />
        </Panel>
      )}
      <Panel title="Videos">
        <VideoGrid videos={vids} label={info.label} />
      </Panel>
    </>
  );
}

export function TagView({ tag }: { tag: string }) {
  const p = usePersisted();
  const vids = useMemo(
    () => visibleVideos(p).filter((v) => v.hashtags.includes(tag)).sort((a, b) => trendingScore(p, b) - trendingScore(p, a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.settings.videoSource, tag],
  );
  const views = vids.reduce((s, v) => s + v.views, 0);
  return (
    <PageShell aside={<ExploreAside />}>
      <div className="hero-strip" style={{ '--hue': 188 } as React.CSSProperties}>
        <span className="hero-ico">
          <Hash size={22} />
        </span>
        <div>
          <h1>#{tag}</h1>
          <p>
            {vids.length} videos · {compact(views)} views
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm hero-sort" onClick={() => addRecentSearch(`#${tag}`)}>
          Save to recent
        </button>
      </div>
      {vids.length ? (
        <VideoGrid videos={vids} label={`#${tag}`} />
      ) : (
        <Empty icon={Hash} title={`No videos with #${tag} yet`}>
          No video uses it right now.
        </Empty>
      )}
    </PageShell>
  );
}

export function Explore({ route }: { route: Route }) {
  const p = usePersisted();
  const layout = useLayout();
  const q = route.query.get('q') ?? '';
  const cat = route.query.get('cat') as Category | null;
  const forYou = useMemo(() => {
    const ids = rankForYou(p).slice(0, 12).map((i) => i.id);
    return visibleVideos(p).filter((v) => ids.includes(v.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.activeId, p.accounts[p.activeId].nonce, p.accounts[p.activeId].hiddenCreators]);
  const popular = useMemo(
    () => visibleVideos(p).slice().sort((a, b) => b.views - a.views).slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.settings.videoSource],
  );
  const creators = useMemo(
    () =>
      USERS.filter((u) => u.kind === 'creator' && !p.accounts[p.activeId].hiddenCreators.includes(u.id))
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 8)
        .map((u) => u.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.activeId],
  );
  const me = getUser(p, p.activeId);

  return (
    <PageShell aside={layout === 'desktop' ? <ExploreAside /> : undefined} className="explore">
      {layout === 'mobile' && (
        <div className="m-search">
          <SearchBox />
        </div>
      )}
      {q ? (
        <>
          <div className="page-head">
            <h1>
              Results for <span className="accent">“{q}”</span>
            </h1>
          </div>
          <Results q={q} />
        </>
      ) : cat && categoryInfo(cat) ? (
        <CategoryView cat={cat} />
      ) : (
        <>
          <div className="page-head">
            <h1>Explore</h1>
            <span className="muted small">Browsing as @{me?.handle}</span>
          </div>
          <CategoryTiles />
          <Panel
            title={
              <>
                <Flame size={15} /> Trending hashtags
              </>
            }
          >
            <TagChips />
          </Panel>
          <Panel
            title={
              <>
                <Sparkles size={15} /> Recommended for you
              </>
            }
            action={<a className="link-btn" href="#/">Open For You</a>}
          >
            <VideoGrid videos={forYou} label="Recommended for you" />
          </Panel>
          <Panel
            title={
              <>
                <Users size={15} /> Popular creators
              </>
            }
          >
            <CreatorCards ids={creators} />
          </Panel>
          <Panel
            title={
              <>
                <TrendingUp size={15} /> Popular videos
              </>
            }
          >
            <VideoGrid videos={popular} label="Popular videos" rankStart={1} />
          </Panel>
          {layout !== 'desktop' && <ExploreAside />}
        </>
      )}
    </PageShell>
  );
}

