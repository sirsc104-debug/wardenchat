import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, ChevronDown, ChevronUp, Ellipsis, Eye, Hash, Heart, MessageCircle, Music2, Plus, Sparkles, UserPlus, ExternalLink } from 'lucide-react';
import type { FeedState, Video } from '../../state/types';
import { Avatar } from '../common/Avatar';
import { Verified } from '../common/Verified';
import { Menu } from '../common/Menu';
import { VideoCard } from '../common/VideoCard';
import { CATEGORY_ICON } from '../common/icons';
import { videoMenuItems } from '../player/videoMenu';
import { RichText } from './Comments';
import { useAcct, usePersisted } from '../../state/store';
import { goTo, openModal, playInFeed, setCategory, toggleFollow, toggleLike, toggleSave } from '../../state/actions';
import { commentCount, followerCount, getUser, getVideo, likeCount, saveCount, videosBy, viewCount } from '../../lib/catalog';
import { useVideoSocial } from '../../lib/social';
import { recommendedCreators, relatedTo, trendingHashtags, topInterests } from '../../lib/recommend';
import { agoLong, compact, full } from '../../lib/format';
import { href } from '../../lib/router';
import { youtubeWatchUrl } from '../../lib/videoSource';
import { categoryLabel } from '../../data/categories';
import { useHeightTween } from '../../lib/hooks';

/* ---------------------------------------------------------------- now playing */

export const CreatorRow = memo(function CreatorRow({ video }: { video: Video }) {
  const p = usePersisted();
  const creator = getUser(p, video.creatorId);
  const following = useAcct((a) => a.following.includes(video.creatorId));
  const self = video.creatorId === p.activeId;
  if (!creator) return null;
  return (
    <div className="creator-row">
      <a href={href.profile(creator.handle)} className="creator-link">
        <Avatar user={creator} size={40} />
        <span className="creator-names">
          <span className="creator-name">
            {creator.name} {creator.verified && <Verified />}
          </span>
          <span className="creator-handle">
            @{creator.handle} · {compact(followerCount(p, creator))} followers
          </span>
        </span>
      </a>
      {self ? (
        <a className="btn btn-ghost btn-sm" href={href.profile(creator.handle)}>
          Your profile
        </a>
      ) : (
        <button type="button" className={`btn btn-sm ${following ? 'btn-ghost' : 'btn-accent'}`} onClick={() => toggleFollow(creator.id)} aria-pressed={following} title="Follow (F)">
          {following ? (
            <>
              <Check size={14} /> Following
            </>
          ) : (
            <>
              <Plus size={14} /> Follow
            </>
          )}
        </button>
      )}
      <Menu className="icon-btn" label="More options" items={videoMenuItems(video, p.activeId, { includeSave: true })}>
        <Ellipsis size={18} />
      </Menu>
    </div>
  );
});

/** Likes, comments and saves as exact numbers (like and save are toggles). */
export const StatTiles = memo(function StatTiles({ video, withViews }: { video: Video; withViews?: boolean }) {
  const p = usePersisted();
  const social = useVideoSocial(video.id);
  const localLiked = useAcct((a) => a.liked.includes(video.id));
  const liked = social && social !== 'closed' ? social.liked : localLiked;
  const saved = useAcct((a) => a.saved.includes(video.id));
  const views = viewCount(p, video);
  const likes = likeCount(p, video);
  const comments = commentCount(p, video);
  return (
    <div className={`stats${withViews ? ' stats-6' : ''}`}>
      {withViews && (
        <span className="stat">
          <Eye size={15} />
          <b>{full(views)}</b>
          <span>views</span>
        </span>
      )}
      <button type="button" className={`stat like${liked ? ' on' : ''}`} onClick={() => toggleLike(video.id)} aria-pressed={liked}>
        <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
        <b>{full(likes)}</b>
        <span>likes</span>
      </button>
      <span className="stat">
        <MessageCircle size={15} />
        <b>{full(comments)}</b>
        <span>comments</span>
      </span>
      <button type="button" className={`stat save${saved ? ' on' : ''}`} onClick={() => toggleSave(video.id)} aria-pressed={saved}>
        <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
        <b>{full(saveCount(p, video))}</b>
        <span>saves</span>
      </button>
      {withViews && (
        <span className="stat" title="Likes and comments per view">
          <Sparkles size={15} />
          <b>{views ? ((100 * (likes + comments)) / views).toFixed(2) : '0.00'}%</b>
          <span>engagement</span>
        </span>
      )}
    </div>
  );
});

export const VideoDetails = memo(function VideoDetails({ video, reason, compactMode, hideStats, openMore }: { video: Video; reason?: string; compactMode?: boolean; hideStats?: boolean; openMore?: number }) {
  const p = usePersisted();
  const [more, setMore] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  useHeightTween(descRef, more);
  const long = video.description.length > 120;
  // Clicking the title on the video asks for the full description.
  useEffect(() => {
    if (openMore) setMore(true);
  }, [openMore]);
  if (compactMode) {
    return (
      <div className="details details-compact">
        <h2 className="details-title one-line">{video.title}</h2>
      </div>
    );
  }
  return (
    <div className="details">
      <h2 className="details-title">{video.title}</h2>
      <p ref={descRef} className={`details-desc${!more && long ? ' clamp' : ''}`}>
        <RichText text={video.description} />
      </p>
      {long && (
        <button type="button" className="link-btn" onClick={() => setMore((m) => !m)}>
          {more ? (
            <>
              Less <ChevronUp size={12} />
            </>
          ) : (
            <>
              More <ChevronDown size={12} />
            </>
          )}
        </button>
      )}
      <div className="tags">
        {video.hashtags.map((t) => (
          <a key={t} className="tag" href={href.tag(t)}>
            #{t}
          </a>
        ))}
      </div>
      <div className="details-meta">
        <span>
          <Eye size={13} /> {full(viewCount(p, video))} views
        </span>
        <span>{agoLong(video.uploadedAt)}</span>
        <a href={href.category(video.category)} className="details-cat">
          {categoryLabel(video.category)}
        </a>
      </div>
      {video.source && (
        <a className="details-yt" href={youtubeWatchUrl(video.source.youtubeId)} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={13} /> Watch on YouTube{video.source.channelTitle ? ` · ${video.source.channelTitle}` : ''}
        </a>
      )}
      <div className="sound">
        <Music2 size={13} />
        <span className="sound-track">
          <span>{video.sound}</span>
        </span>
      </div>
      {!hideStats && <StatTiles video={video} />}
      {reason && (
        <p className="reason">
          <Sparkles size={13} /> <span>{reason}</span>
          <button type="button" className="link-btn" onClick={() => openModal({ type: 'interests' })}>
            Tune
          </button>
        </p>
      )}
    </div>
  );
});

/* ---------------------------------------------------------------- discovery */

function Section({ title, children, action, icon: Icon, bare }: { title: string; children: React.ReactNode; action?: React.ReactNode; icon?: typeof Hash; bare?: boolean }) {
  if (bare) return <div className="psec bare">{children}</div>;
  return (
    <section className="psec">
      <header className="psec-head">
        <h3>
          {Icon && <Icon size={14} />} {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export const UpNext = memo(function UpNext({ feed, count = 5, bare }: { feed: FeedState; count?: number; bare?: boolean }) {
  const p = usePersisted();
  const next = feed.items.slice(feed.index + 1, feed.index + 1 + count);
  if (!next.length) return null;
  return (
    <Section bare={bare} title="Up next" action={<span className="psec-note">{feed.items.length - feed.index - 1 > 50 ? 'endless' : `${feed.items.length - feed.index - 1} more`}</span>}>
      <div className="upnext">
        {next.map((it, i) => {
          const v = getVideo(p, it.id);
          return v ? <VideoCard key={it.id} video={v} layout="row" onOpen={() => goTo(feed.index + 1 + i)} sub={it.reason} index={i} /> : null;
        })}
      </div>
    </Section>
  );
});

export const Related = memo(function Related({ video, feed, columns, bare }: { video: Video; feed: FeedState; columns: number; bare?: boolean }) {
  const p = usePersisted();
  const list = useMemo(() => {
    const exclude = new Set(feed.items.slice(feed.index, feed.index + 6).map((i) => i.id));
    return relatedTo(p, video, columns >= 3 ? 9 : 6, exclude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.activeId, p.accounts[p.activeId].hiddenCreators, video.id, columns]);
  if (!list.length) return null;
  return (
    <Section bare={bare} title="Related videos">
      <div className={`tile-grid${bare ? ' auto' : ''}`} style={{ '--cols': columns } as React.CSSProperties}>
        {list.map((v) => (
          <VideoCard key={v.id} video={v} layout="tile" onOpen={() => playInFeed(v.id)} />
        ))}
      </div>
    </Section>
  );
});

export const MoreFromCreator = memo(function MoreFromCreator({ video }: { video: Video }) {
  const p = usePersisted();
  const creator = getUser(p, video.creatorId);
  const list = videosBy(p, video.creatorId).filter((v) => v.id !== video.id).slice(0, 3);
  if (!list.length || !creator) return null;
  return (
    <Section title={`More from @${creator.handle}`} action={<a className="link-btn" href={href.profile(creator.handle)}>View all</a>}>
      <div className="tile-grid" style={{ '--cols': 3 } as React.CSSProperties}>
        {list.map((v) => (
          <VideoCard key={v.id} video={v} layout="tile" onOpen={() => playInFeed(v.id)} />
        ))}
      </div>
    </Section>
  );
});

export const TrendingTags = memo(function TrendingTags({ limit = 8 }: { limit?: number }) {
  const p = usePersisted();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tags = useMemo(() => trendingHashtags(p, limit), [p.settings.videoSource, limit]);
  return (
    <Section title="Trending hashtags" icon={Hash} action={<a className="link-btn" href="#/explore">Explore</a>}>
      <div className="tag-cloud">
        {tags.map((t, i) => (
          <a key={t.tag} className="tag tag-lg" href={href.tag(t.tag)}>
            <span className="tag-rank">{i + 1}</span>#{t.tag}
            <small>{compact(t.views)}</small>
          </a>
        ))}
      </div>
    </Section>
  );
});

export const RecommendedCreators = memo(function RecommendedCreators({ focus, limit = 4 }: { focus?: Video['category']; limit?: number }) {
  const p = usePersisted();
  const following = useAcct((a) => a.following);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ids = useMemo(() => recommendedCreators(p, limit, focus), [p.activeId, following, focus, limit]);
  if (!ids.length) return null;
  return (
    <Section title="Creators you might like" icon={UserPlus}>
      <ul className="people">
        {ids.map((id) => {
          const u = getUser(p, id)!;
          const on = following.includes(id);
          return (
            <li key={id} className="person">
              <a href={href.profile(u.handle)} className="person-link">
                <Avatar user={u} size={34} />
                <span>
                  <span className="person-name">
                    {u.name} {u.verified && <Verified size={12} />}
                  </span>
                  <span className="person-sub">
                    {categoryLabel(u.categories[0])} · {compact(followerCount(p, u))}
                  </span>
                </span>
              </a>
              <button type="button" className={`btn btn-xs ${on ? 'btn-ghost' : 'btn-outline'}`} onClick={() => toggleFollow(id)}>
                {on ? 'Following' : 'Follow'}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
});

export const SuggestedCategories = memo(function SuggestedCategories() {
  const acct = useAcct((a) => a);
  const list = topInterests(acct);
  return (
    <Section title="Browse categories">
      <div className="cat-chips">
        {list.map((c) => {
          const Icon = CATEGORY_ICON[c.category];
          return (
            <button key={c.category} type="button" className="cat-chip" onClick={() => setCategory(c.category)} title={`Only show ${categoryLabel(c.category)} in this feed`}>
              <Icon size={13} /> {categoryLabel(c.category)}
              <span className="cat-chip-bar" style={{ '--w': `${Math.round(c.share * 100 * 4)}%` } as React.CSSProperties} />
            </button>
          );
        })}
      </div>
    </Section>
  );
});
