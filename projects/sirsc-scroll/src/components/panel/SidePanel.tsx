import { memo, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { FeedState, Video } from '../../state/types';
import { Comments } from './Comments';
import { CreatorRow, FriendsActivity, MoreFromCreator, RecommendedCreators, Related, ShareRow, SuggestedCategories, TrendingTags, UpNext, VideoDetails } from './Sections';
import { useP, useS } from '../../state/store';
import { setCommentsOpen } from '../../state/actions';
import { useSize, useViewport } from '../../lib/hooks';
import { commentCount } from '../../lib/catalog';
import { usePersisted } from '../../state/store';
import { compact } from '../../lib/format';

interface Props {
  video: Video;
  reason?: string;
  feed: FeedState;
}

type Tab = 'overview' | 'comments' | 'next' | 'discover';

/** Everything beside the player: creator, details, comments and discovery, all tied to the current clip. */
export const SidePanel = memo(function SidePanel({ video, reason, feed }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const { w } = useSize(box);
  const showDiscovery = useP((p) => p.settings.showDiscovery);
  const commentsOpen = useS((s) => s.commentsOpen);
  const p = usePersisted();
  const wide = w >= 600 && showDiscovery;
  const [tab, setTab] = useState<Tab>('overview');
  const scrollA = useRef<HTMLDivElement>(null);
  // Taller screens show more of the conversation without expanding.
  const vh = useViewport().h;
  const preview = Math.max(3, Math.min(10, 3 + Math.floor((vh - 680) / 70)));

  useEffect(() => {
    if (commentsOpen) setTab('comments');
    else setTab((t) => (t === 'comments' ? 'overview' : t));
  }, [commentsOpen]);

  // New clip: back to the top of the panel.
  useEffect(() => {
    scrollA.current?.scrollTo({ top: 0 });
  }, [video.id]);

  const discoverW = wide ? w - Math.min(460, Math.max(320, w * 0.48)) : w;
  const cols = discoverW >= 540 ? 3 : 2;
  const expand = () => setCommentsOpen(true, true);

  if (wide) {
    return (
      <div ref={box} className="panel panel-wide">
        <div className={`pcol pcol-a${commentsOpen ? ' expanded' : ''}`}>
          <div className="pcol-scroll" ref={scrollA}>
            <CreatorRow video={video} />
            <VideoDetails video={video} reason={reason} compactMode={commentsOpen} />
            {!commentsOpen && <ShareRow video={video} />}
            <div className="pcol-comments">
              <button type="button" className="icon-btn comments-expand" onClick={() => setCommentsOpen(!commentsOpen, !commentsOpen)} aria-label={commentsOpen ? 'Collapse comments' : 'Expand comments'} title={commentsOpen ? 'Collapse (Esc)' : 'Expand comments (C)'}>
                {commentsOpen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <Comments video={video} mode={commentsOpen ? 'full' : 'preview'} onExpand={expand} autoFocus previewCount={preview} />
            </div>
          </div>
        </div>
        <div className="pcol pcol-b">
          <div className="pcol-scroll">
            <UpNext feed={feed} />
            <Related video={video} feed={feed} columns={cols} />
            <FriendsActivity />
            <MoreFromCreator video={video} />
            <TrendingTags />
            <RecommendedCreators focus={video.category} />
            <SuggestedCategories />
          </div>
        </div>
      </div>
    );
  }

  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['comments', `Comments ${compact(commentCount(p, video))}`],
    ['next', 'Up next'],
    ['discover', 'Discover'],
  ];
  return (
    <div ref={box} className="panel panel-narrow">
      <div className="panel-tabs seg" role="tablist" aria-label="Video panel">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setCommentsOpen(id === 'comments', id === 'comments');
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pcol-scroll" ref={scrollA}>
        {tab === 'overview' && (
          <>
            <CreatorRow video={video} />
            <VideoDetails video={video} reason={reason} />
            <ShareRow video={video} />
            <Comments video={video} mode="preview" onExpand={expand} />
            <FriendsActivity limit={4} />
          </>
        )}
        {tab === 'comments' && (
          <>
            <CreatorRow video={video} />
            <VideoDetails video={video} compactMode />
            <Comments video={video} mode="full" autoFocus />
          </>
        )}
        {tab === 'next' && (
          <>
            <UpNext feed={feed} count={8} />
            <Related video={video} feed={feed} columns={cols} />
          </>
        )}
        {tab === 'discover' && (
          <>
            <MoreFromCreator video={video} />
            <TrendingTags />
            <RecommendedCreators focus={video.category} />
            <SuggestedCategories />
          </>
        )}
      </div>
    </div>
  );
});
