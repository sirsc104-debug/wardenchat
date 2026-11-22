import { memo, useState, type ReactNode } from 'react';
import { ArrowLeft, Music2, Volume2, VolumeX, X } from 'lucide-react';
import type { FeedKind, Video } from '../state/types';
import { FeedTrack } from '../components/player/FeedTrack';
import { Stage } from '../components/player/Stage';
import { ActionRail } from '../components/player/ActionRail';
import { Comments } from '../components/panel/Comments';
import { CreatorRow, ShareRow, VideoDetails } from '../components/panel/Sections';
import { VideoCard } from '../components/common/VideoCard';
import { Avatar } from '../components/common/Avatar';
import { RichText } from '../components/panel/Comments';
import { usePersisted, useS } from '../state/store';
import { openSheet, playInFeed, toggleMute, setActiveFeed } from '../state/actions';
import { commentCount, getUser, getVideo, videosBy } from '../lib/catalog';
import { full } from '../lib/format';
import { EmptyFeed, EndNote, useAutoplayRule, useFeedKeys } from './FeedView';
import { useEffect } from 'react';

const TABS: [FeedKind, string, string][] = [
  ['following', 'Following', '#/following'],
  ['foryou', 'For You', '#/'],
  ['trending', 'Trending', '#/trending'],
  ['friends', 'Friends', '#/friends'],
];

export function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  return (
    <div className="sheet-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet${tall ? ' tall' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

const Overlay = memo(function Overlay({ video }: { video: Video }) {
  const p = usePersisted();
  const creator = getUser(p, video.creatorId);
  const [more, setMore] = useState(false);
  return (
    <div className="m-info" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="m-handle" onClick={() => openSheet('creator')}>
        <Avatar user={creator} size={22} /> @{creator?.handle}
      </button>
      <p className="m-title">{video.title}</p>
      <p className={`m-desc${more ? '' : ' clamp'}`} onClick={() => setMore((m) => !m)}>
        <RichText text={video.description} /> {video.hashtags.map((t) => `#${t}`).join(' ')}
      </p>
      <p className="m-sound">
        <Music2 size={12} /> <span className="sound-track"><span>{video.sound}</span></span>
      </p>
    </div>
  );
});

export function MobileFeed({ kind }: { kind: FeedKind }) {
  const feed = useS((s) => s.feeds[kind]);
  const sheet = useS((s) => s.sheet);
  const muted = useS((s) => s.muted);
  const p = usePersisted();
  const item = feed.items[feed.index];
  const video = item ? getVideo(p, item.id) : undefined;
  useEffect(() => setActiveFeed(kind), [kind]);
  useFeedKeys(true, true);
  useAutoplayRule(video?.id);

  return (
    <div className="m-feed">
      <FeedTrack
        feed={feed}
        render={(v, active) => (
          <Stage video={v} active={active} chrome="mobile">
            <Overlay video={v} />
            <ActionRail video={v} index={feed.index} total={feed.items.length} layout="mobile" />
          </Stage>
        )}
        empty={<EmptyFeed kind={kind} />}
        endNote={<EndNote kind={kind} />}
      />
      <div className="m-top">
        {kind === 'list' ? (
          <a href={feed.back ?? '#/'} className="m-back">
            <ArrowLeft size={18} /> {feed.label}
          </a>
        ) : (
          <nav className="m-tabs" aria-label="Feeds">
            {TABS.map(([k, label, to]) => (
              <a key={k} href={to} className={k === kind ? 'on' : ''}>
                {label}
              </a>
            ))}
          </nav>
        )}
        <div className="m-top-actions">
          <button type="button" className="icon-btn glass" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>
      {video && sheet === 'comments' && (
        <Sheet title={`${full(commentCount(p, video))} comments`} onClose={() => openSheet(null)} tall>
          <Comments video={video} mode="full" />
        </Sheet>
      )}
      {video && sheet === 'creator' && (
        <Sheet title="About this video" onClose={() => openSheet(null)}>
          <CreatorRow video={video} />
          <VideoDetails video={video} reason={item?.reason} />
          <ShareRow video={video} />
          <h3 className="sheet-sub">More from @{getUser(p, video.creatorId)?.handle}</h3>
          <div className="tile-grid" style={{ '--cols': 3 } as React.CSSProperties}>
            {videosBy(p, video.creatorId)
              .filter((v) => v.id !== video.id)
              .slice(0, 6)
              .map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  layout="tile"
                  onOpen={() => {
                    openSheet(null);
                    playInFeed(v.id);
                  }}
                />
              ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
