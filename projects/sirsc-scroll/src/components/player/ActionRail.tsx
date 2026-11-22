import { memo, useState } from 'react';
import { Bookmark, ChevronDown, ChevronUp, Ellipsis, Heart, MessageCircle, Plus, Check, Share2 } from 'lucide-react';
import type { Video } from '../../state/types';
import { Avatar } from '../common/Avatar';
import { Menu } from '../common/Menu';
import { videoMenuItems } from './videoMenu';
import { useAcct, usePersisted } from '../../state/store';
import { go, openModal, openSheet, setCommentsOpen, toggleFollow, toggleLike, toggleSave } from '../../state/actions';
import { commentCount, getUser, likeCount, saveCount, shareCount } from '../../lib/catalog';
import { compact } from '../../lib/format';
import { href } from '../../lib/router';

interface Props {
  video: Video;
  index: number;
  total: number;
  layout: 'desktop' | 'mobile';
}

export const ActionRail = memo(function ActionRail({ video, index, total, layout }: Props) {
  const p = usePersisted();
  const liked = useAcct((a) => a.liked.includes(video.id));
  const saved = useAcct((a) => a.saved.includes(video.id));
  const following = useAcct((a) => a.following.includes(video.creatorId));
  const creator = getUser(p, video.creatorId);
  const self = video.creatorId === p.activeId;
  const [pop, setPop] = useState(0);

  const openComments = () => (layout === 'mobile' ? openSheet('comments') : setCommentsOpen(true, true));

  return (
    <div className={`rail rail-${layout}`}>
      <div className="rail-creator">
        <a href={href.profile(creator?.handle ?? '')} className="rail-avatar" aria-label={`View @${creator?.handle}`} title={`@${creator?.handle}`}>
          <Avatar user={creator} size={layout === 'mobile' ? 44 : 42} ring />
        </a>
        {!self && (
          <button type="button" className={`rail-follow${following ? ' on' : ''}`} onClick={() => toggleFollow(video.creatorId)} aria-label={following ? `Unfollow @${creator?.handle} (F)` : `Follow @${creator?.handle} (F)`} title={following ? 'Following' : 'Follow (F)'}>
            {following ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
          </button>
        )}
      </div>
      <button
        type="button"
        className={`rail-btn like${liked ? ' on' : ''}`}
        onClick={() => {
          toggleLike(video.id);
          setPop((n) => n + 1);
        }}
        aria-pressed={liked}
        aria-label={`${liked ? 'Unlike' : 'Like'} (L), ${likeCount(p, video)} likes`}
        title="Like (L)"
      >
        <span className="rail-ico" key={liked ? `l${pop}` : 'u'}>
          <Heart size={24} fill={liked ? 'currentColor' : 'none'} />
        </span>
        <span className="rail-n">{compact(likeCount(p, video))}</span>
      </button>
      <button type="button" className="rail-btn" onClick={openComments} aria-label={`Comments (C), ${commentCount(p, video)}`} title="Comments (C)" disabled={video.allowComments === false}>
        <span className="rail-ico">
          <MessageCircle size={24} />
        </span>
        <span className="rail-n">{video.allowComments === false ? 'Off' : compact(commentCount(p, video))}</span>
      </button>
      <button type="button" className={`rail-btn save${saved ? ' on' : ''}`} onClick={() => toggleSave(video.id)} aria-pressed={saved} aria-label={`${saved ? 'Unsave' : 'Save'} (S)`} title="Save (S)">
        <span className="rail-ico">
          <Bookmark size={24} fill={saved ? 'currentColor' : 'none'} />
        </span>
        <span className="rail-n">{compact(saveCount(p, video))}</span>
      </button>
      <button type="button" className="rail-btn" onClick={() => openModal({ type: 'share', videoId: video.id })} aria-label="Share" title="Share">
        <span className="rail-ico">
          <Share2 size={23} />
        </span>
        <span className="rail-n">{compact(shareCount(p, video))}</span>
      </button>
      <Menu className="rail-btn rail-more" label="More options" items={videoMenuItems(video, p.activeId)} placement="left">
        <span className="rail-ico">
          <Ellipsis size={24} />
        </span>
      </Menu>
      {layout === 'desktop' && (
        <div className="rail-nav">
          <button type="button" className="rail-step" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous video (Up or K)" title="Previous (↑ / K)">
            <ChevronUp size={20} />
          </button>
          <span className="rail-pos" aria-label={`Video ${index + 1} of ${total}`}>
            {index + 1}
            <small>/{total}</small>
          </span>
          <button type="button" className="rail-step" onClick={() => go(1)} aria-label="Next video (Down or J)" title="Next (↓ / J)">
            <ChevronDown size={20} />
          </button>
        </div>
      )}
    </div>
  );
});
