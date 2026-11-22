import { memo, useState, type ReactNode } from 'react';
import { Eye, Heart, Play } from 'lucide-react';
import type { Video } from '../../state/types';
import { VideoArt } from './VideoArt';
import { usePersisted } from '../../state/store';
import { getUser, likeCount, viewCount } from '../../lib/catalog';
import { compact, duration } from '../../lib/format';

interface Props {
  video: Video;
  onOpen: (v: Video) => void;
  /** grid: thumbnail with text below. row: small thumbnail beside text. tile: thumbnail only. */
  layout?: 'grid' | 'row' | 'tile';
  sub?: ReactNode;
  badge?: ReactNode;
  showCreator?: boolean;
  stat?: 'views' | 'likes';
  active?: boolean;
  actions?: ReactNode;
  rank?: number;
  /** Position in its list, for the staggered entrance. */
  index?: number;
}

export const VideoCard = memo(function VideoCard({ video, onOpen, layout = 'grid', sub, badge, showCreator = true, stat = 'views', active, actions, rank, index }: Props) {
  const [hover, setHover] = useState(false);
  const p = usePersisted();
  const creator = getUser(p, video.creatorId);
  const statVal = stat === 'likes' ? likeCount(p, video) : viewCount(p, video);
  const StatIcon = stat === 'likes' ? Heart : Eye;
  return (
    <div className={`vcard vcard-${layout}${active ? ' is-active' : ''}`} data-vid={video.id} style={index !== undefined ? ({ '--n': index } as React.CSSProperties) : undefined} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" className="vcard-hit" onClick={() => onOpen(video)} aria-label={`Play ${video.title} by @${creator?.handle}`}>
        <span className="vthumb">
          <VideoArt video={video} running={hover && layout !== 'row'} handle={creator?.handle} />
          <span className="vthumb-shade" />
          {rank !== undefined && <span className="vthumb-rank">{rank}</span>}
          {badge && <span className="vthumb-badge">{badge}</span>}
          {layout !== 'row' && (
            <span className="vthumb-stat">
              <StatIcon size={12} />
              {compact(statVal)}
            </span>
          )}
          <span className="vthumb-dur">{duration(video.duration)}</span>
          {active && (
            <span className="vthumb-now">
              <Play size={11} fill="currentColor" /> Now
            </span>
          )}
          {layout === 'tile' && <span className="vthumb-title">{video.title}</span>}
        </span>
        {layout !== 'tile' && (
          <span className="vcard-meta">
            <span className="vcard-title">{video.title}</span>
            {showCreator && <span className="vcard-creator">@{creator?.handle}</span>}
            {layout === 'row' && (
              <span className="vcard-sub">
                {sub ?? (
                  <>
                    <StatIcon size={11} /> {compact(statVal)} · {duration(video.duration)}
                  </>
                )}
              </span>
            )}
            {layout === 'grid' && sub && <span className="vcard-sub">{sub}</span>}
          </span>
        )}
      </button>
      {actions && <div className="vcard-actions">{actions}</div>}
    </div>
  );
});
