import { useEffect, useRef } from 'react';
import { Compass, Filter, House, UsersRound } from 'lucide-react';
import type { FeedKind, Video } from '../state/types';
import { FeedTrack } from '../components/player/FeedTrack';
import { Stage, activeControls } from '../components/player/Stage';
import { ActionRail } from '../components/player/ActionRail';
import { SidePanel } from '../components/panel/SidePanel';
import { RecommendedCreators } from '../components/panel/Sections';
import { TopBar } from '../components/shell/TopBar';
import { FeedControls, FeedTabs, ListHeader } from '../components/shell/FeedControls';
import { Empty } from '../components/common/Empty';
import { getState, useP, usePersisted, useS } from '../state/store';
import { go, openSheet, setActiveFeed, setCategory, setCommentsOpen, setPlaying, toggleFollow, toggleLike, toggleMute, togglePlay, toggleSave } from '../state/actions';
import { getVideo } from '../lib/catalog';
import { isTyping, useSize } from '../lib/hooks';
import { categoryLabel } from '../data/categories';

const RAIL = 64;
const GAP = 12;
const PANEL_MIN = 330;

const FEED_NAMES: Record<FeedKind, string> = { foryou: 'For You', following: 'Following', trending: 'Trending', friends: 'Friends', list: 'this list' };

/** Shortcuts shared by the desktop and mobile feeds. */
export function useFeedKeys(enabled: boolean, mobile = false) {
  useEffect(() => {
    if (!enabled) return;
    let lastNav = 0;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      const st = getState();
      if (st.s.modal) return;
      const f = st.s.feeds[st.s.activeFeed];
      const v: Video | undefined = f.items[f.index] && getVideo(st.p, f.items[f.index].id);
      const nav = (d: number) => {
        e.preventDefault();
        const now = performance.now();
        if (e.repeat && now - lastNav < 220) return;
        lastNav = now;
        go(d);
      };
      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
        case 'j':
        case 'J':
          return nav(1);
        case 'ArrowUp':
        case 'PageUp':
        case 'k':
        case 'K':
          return nav(-1);
        case ' ':
          e.preventDefault();
          if (!e.repeat) togglePlay();
          return;
        case 'ArrowRight':
          e.preventDefault();
          return activeControls.current?.nudge(5);
        case 'ArrowLeft':
          e.preventDefault();
          return activeControls.current?.nudge(-5);
        case 'm':
        case 'M':
          return toggleMute();
      }
      if (!v || e.repeat) return;
      switch (e.key.toLowerCase()) {
        case 'l':
          return toggleLike(v.id);
        case 's':
          e.preventDefault();
          return toggleSave(v.id);
        case 'f':
          if (v.creatorId !== st.p.activeId) toggleFollow(v.creatorId);
          return;
        case 'c':
          e.preventDefault();
          if (mobile) return openSheet(st.s.sheet === 'comments' ? null : 'comments');
          return setCommentsOpen(!st.s.commentsOpen, !st.s.commentsOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, mobile]);
}

/** With autoplay off, each new clip waits for a click. */
export function useAutoplayRule(videoId: string | undefined) {
  const autoplay = useP((p) => p.settings.autoplay);
  useEffect(() => {
    if (videoId && !autoplay) setPlaying(false);
  }, [videoId, autoplay]);
}

export function EmptyFeed({ kind }: { kind: FeedKind }) {
  const category = useS((s) => s.category);
  if (category !== 'all')
    return (
      <Empty icon={Filter} title={`No ${categoryLabel(category)} videos in ${FEED_NAMES[kind]}`} action={<button type="button" className="btn btn-accent btn-sm" onClick={() => setCategory('all')}>Show all categories</button>}>
        Try another category, or clear the filter.
      </Empty>
    );
  if (kind === 'following')
    return (
      <div className="empty-wrap">
        <Empty icon={UsersRound} title="You’re not following anyone yet">
          Follow creators and their new videos show up here first.
        </Empty>
        <RecommendedCreators limit={5} />
      </div>
    );
  if (kind === 'friends')
    return (
      <Empty icon={UsersRound} title="No friend activity yet" action={<a className="btn btn-accent btn-sm" href="#/">Go to For You</a>}>
        When your friends like, share or post videos, they appear here.
      </Empty>
    );
  return (
    <Empty icon={Compass} title="Nothing to show here" action={<a className="btn btn-accent btn-sm" href="#/explore">Explore</a>}>
      Hidden creators and “Not interested” videos are left out. You can undo those in Settings.
    </Empty>
  );
}

export function EndNote({ kind }: { kind: FeedKind }) {
  if (kind === 'foryou') return null;
  return (
    <div className="endnote">
      <span>You’ve reached the end of {FEED_NAMES[kind]}.</span>
      <a href="#/" className="link-btn">
        <House size={12} /> For You
      </a>
      <a href="#/explore" className="link-btn">
        <Compass size={12} /> Explore
      </a>
    </div>
  );
}

export function FeedView({ kind }: { kind: FeedKind }) {
  const feed = useS((s) => s.feeds[kind]);
  const p = usePersisted();
  const layout = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(layout);
  const item = feed.items[feed.index];
  const video = item ? getVideo(p, item.id) : undefined;

  useEffect(() => setActiveFeed(kind), [kind]);
  useFeedKeys(true);
  useAutoplayRule(video?.id);

  // Height-first sizing: the 9:16 player takes the full height unless the panel would get too narrow.
  let sh = Math.max(0, h);
  let sw = Math.round((sh * 9) / 16);
  const maxW = w - RAIL - GAP * 2 - PANEL_MIN;
  if (w && sw > maxW) {
    sw = Math.max(200, maxW);
    sh = Math.round((sw * 16) / 9);
  }

  return (
    <div className="feed-layout" ref={layout}>
      <div className="player-col" style={{ width: sw + RAIL + GAP, visibility: w ? 'visible' : 'hidden' }}>
        <div className="stage-wrap" style={{ width: sw, height: sh }}>
          <FeedTrack feed={feed} render={(v, active) => <Stage video={v} active={active} chrome="desktop" />} empty={<EmptyFeed kind={kind} />} endNote={<EndNote kind={kind} />} />
        </div>
        {video && <ActionRail video={video} index={feed.index} total={feed.items.length} layout="desktop" />}
      </div>
      <div className="right-col">
        <TopBar>{kind === 'list' ? <ListHeader label={feed.label ?? 'Playlist'} back={feed.back ?? '#/'} /> : <FeedTabs active={kind} />}</TopBar>
        {kind !== 'list' && <FeedControls />}
        {video ? <SidePanel video={video} reason={item?.reason} feed={feed} /> : <div className="panel panel-empty"><RecommendedCreators limit={6} /></div>}
      </div>
    </div>
  );
}
