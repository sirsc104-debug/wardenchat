import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { EASE, reducedMotion } from '../lib/motion';
import { Compass, Filter, House, UsersRound } from 'lucide-react';
import type { FeedKind, Video } from '../state/types';
import { FeedStack } from '../components/player/FeedStack';
import { Stage, activeControls } from '../components/player/Stage';
import { ActionRail } from '../components/player/ActionRail';
import { RecommendedCreators } from '../components/panel/Sections';
import { WidgetArea } from '../components/widgets/WidgetArea';
import { TopBar } from '../components/shell/TopBar';
import { FeedNav } from '../components/shell/FeedNav';
import { FeedControls, ListHeader } from '../components/shell/FeedControls';
import { Empty } from '../components/common/Empty';
import { getState, useP, usePersisted, useS } from '../state/store';
import { go, openSheet, setActiveFeed, setCategory, setPlaying, toggleFollow, toggleLike, toggleMute, togglePlay, toggleSave } from '../state/actions';
import { focusWidget, toggleFocusMode, visibleWidgets } from '../state/widgets';
import { getVideo } from '../lib/catalog';
import { useCatalog } from '../lib/remoteCatalog';
import { isTyping, useSize } from '../lib/hooks';
import { preferredRegionWidth } from '../lib/widgetLayout';
import { categoryLabel } from '../data/categories';

const RAIL = 64;
const GAP = 12;
/** Feed bar height plus the gap under it. */
const BAR = 44;
const REGION_MIN = 320;

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
          return focusWidget('comments', true);
        case 'v':
          if (!mobile) toggleFocusMode();
          return;
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
  const catalogOn = useP((p) => p.settings.videoSource === 'catalog');
  const catalog = useCatalog();
  if (catalogOn && catalog.status === 'loading')
    return (
      <Empty icon={Compass} title="Loading videos…">
        Getting videos from the SirSC Scroll catalog.
      </Empty>
    );
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
  const prefs = useP((pp) => pp.widgets);
  const layout = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(layout);
  const item = feed.items[feed.index];
  const video = item ? getVideo(p, item.id) : undefined;
  const visible = useMemo(() => visibleWidgets(prefs), [prefs]);

  useEffect(() => setActiveFeed(kind), [kind]);
  useLayoutEffect(() => {
    if (!reducedMotion()) layout.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: EASE });
  }, []);
  useFeedKeys(true);
  useAutoplayRule(video?.id);

  // Height-first sizing: the 9:16 player fills the height under the feed bar. The widget area
  // takes the rest, up to what its columns can use; leftover space centers the whole group.
  let sh = Math.max(0, h - BAR);
  let sw = Math.round((sh * 9) / 16);
  let rw = 0;
  if (w && visible.length) {
    const avail = w - (sw + GAP + RAIL) - GAP;
    if (avail < REGION_MIN) {
      sw = Math.max(200, w - RAIL - GAP * 2 - REGION_MIN);
      sh = Math.min(sh, Math.round((sw * 16) / 9));
      rw = Math.max(0, w - (sw + GAP + RAIL) - GAP);
    } else {
      rw = Math.min(avail, preferredRegionWidth(visible));
    }
  }
  const pcw = sw + GAP + RAIL;
  const group = pcw + (rw ? GAP + rw : 0);
  const offset = Math.max(0, Math.floor((w - group) / 2));

  // Follow window/sidebar resizes instantly; animate only changes the user makes (widgets, Focus Mode).
  const last = useRef({ w, h });
  const resizing = last.current.w !== w || last.current.h !== h;
  useEffect(() => {
    last.current = { w, h };
  });
  const lastRw = useRef(rw || 600);
  if (rw) lastRw.current = rw;

  const renderStage = useCallback((v: Video, active: boolean) => <Stage video={v} active={active} chrome="desktop" />, []);
  const emptyFor = useCallback((k: FeedKind) => <EmptyFeed kind={k} />, []);
  const endFor = useCallback((k: FeedKind) => <EndNote kind={k} />, []);

  return (
    <div className={`feed-layout${resizing ? ' no-anim' : ''}`} ref={layout}>
      <div className="player-col" style={{ marginLeft: offset, width: pcw, visibility: w ? 'visible' : 'hidden' }}>
        <FeedNav kind={kind} back={feed.back} label={feed.label} />
        <div className="stage-row" style={{ height: sh }}>
          <div className="stage-wrap" style={{ width: sw, height: sh }}>
            <FeedStack kind={kind} render={renderStage} empty={emptyFor} endNote={endFor} />
          </div>
          {video && <ActionRail video={video} index={feed.index} total={feed.items.length} layout="desktop" />}
        </div>
      </div>
      <div className={`wregion${rw ? '' : ' closed'}`} style={{ width: rw, marginLeft: rw ? GAP : 0 }} inert={!rw}>
        <div className="wregion-inner" style={{ width: lastRw.current }}>
          <TopBar>{kind === 'list' && <ListHeader label={feed.label ?? 'Playlist'} back={feed.back ?? '#/'} />}</TopBar>
          {kind !== 'list' && <FeedControls />}
          {video ? (
            <WidgetArea video={video} reason={item?.reason} feed={feed} width={rw ? rw : lastRw.current} />
          ) : (
            <div className="panel-empty">
              <RecommendedCreators limit={6} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
