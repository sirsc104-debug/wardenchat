import { memo, useState } from 'react';
import { BarChart3, Bookmark, ChevronDown, ChevronUp, Ellipsis, Heart, LayoutGrid, ListVideo, MessageCircle, Plus, Check, Shapes } from 'lucide-react';
import type { Video } from '../../state/types';
import { Avatar } from '../common/Avatar';
import { Menu } from '../common/Menu';
import { videoMenuItems } from './videoMenu';
import { useAcct, usePersisted } from '../../state/store';
import { go, openSheet, toggleFollow, toggleLike, toggleSave } from '../../state/actions';
import { focusWidget, setCustomizeOpen } from '../../state/widgets';
import { commentCount, getUser, likeCount, saveCount, viewCount } from '../../lib/catalog';
import { useVideoSocial } from '../../lib/social';
import { compact } from '../../lib/format';

interface Props {
  video: Video;
  index: number;
  total: number;
  layout: 'desktop' | 'mobile';
}

export const ActionRail = memo(function ActionRail({ video, index, total, layout }: Props) {
  const p = usePersisted();
  const social = useVideoSocial(video.id);
  const localLiked = useAcct((a) => a.liked.includes(video.id));
  const liked = social && social !== 'closed' ? social.liked : localLiked;
  const saved = useAcct((a) => a.saved.includes(video.id));
  const following = useAcct((a) => a.following.includes(video.creatorId));
  const creator = getUser(p, video.creatorId);
  const self = video.creatorId === p.activeId;
  const [pop, setPop] = useState(0);

  const desktop = layout === 'desktop';
  // On desktop these controls open (or highlight) the matching widget; on phones they open sheets.
  const openComments = () => (desktop ? focusWidget('comments', true) : openSheet('comments'));
  const openCreator = () => (desktop ? focusWidget('creator') : openSheet('creator'));
  const menu = desktop
    ? [
        ...videoMenuItems(video, p.activeId),
        { label: 'Show up next', icon: ListVideo, onSelect: () => focusWidget('upnext'), divider: true },
        { label: 'Show related videos', icon: Shapes, onSelect: () => focusWidget('related') },
        { label: 'Customize widgets…', icon: LayoutGrid, onSelect: () => setCustomizeOpen(true) },
      ]
    : videoMenuItems(video, p.activeId);

  return (
    <div className={`rail rail-${layout}`}>
      <div className="rail-creator">
        <button type="button" className="rail-avatar" onClick={openCreator} aria-label={`About @${creator?.handle}`} title={`About @${creator?.handle}`}>
          <Avatar user={creator} size={layout === 'mobile' ? 44 : 42} ring />
        </button>
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
      <button type="button" className="rail-btn" onClick={openComments} aria-label={`Comments (C), ${commentCount(p, video)}`} title="Comments (C)">
        <span className="rail-ico">
          <MessageCircle size={24} />
        </span>
        <span className="rail-n">{compact(commentCount(p, video))}</span>
      </button>
      <button type="button" className={`rail-btn save${saved ? ' on' : ''}`} onClick={() => toggleSave(video.id)} aria-pressed={saved} aria-label={`${saved ? 'Unsave' : 'Save'} (S)`} title="Save (S)">
        <span className="rail-ico">
          <Bookmark size={24} fill={saved ? 'currentColor' : 'none'} />
        </span>
        <span className="rail-n">{compact(saveCount(p, video))}</span>
      </button>
      {desktop && (
        <button type="button" className="rail-btn" onClick={() => focusWidget('stats')} aria-label={`Video statistics, ${viewCount(p, video)} views`} title="Statistics">
          <span className="rail-ico">
            <BarChart3 size={22} />
          </span>
          <span className="rail-n">{compact(viewCount(p, video))}</span>
        </button>
      )}
      <Menu className="rail-btn rail-more" label="More options" items={menu} placement="left">
        <span className="rail-ico">
          <Ellipsis size={24} />
        </span>
      </Menu>
      {layout === 'desktop' && (
        <div className="rail-nav">
          <button type="button" className="rail-step" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous video (Up or K)" title="Previous (↑ / K)">
            <ChevronUp size={20} />
          </button>
          <button type="button" className="rail-pos" onClick={() => focusWidget('upnext')} aria-label={`Video ${index + 1} of ${total}. Show up next`} title="Up next">
            {index + 1}
            <small>/{total}</small>
          </button>
          <button type="button" className="rail-step" onClick={() => go(1)} aria-label="Next video (Down or J)" title="Next (↓ / J)">
            <ChevronDown size={20} />
          </button>
        </div>
      )}
    </div>
  );
});
