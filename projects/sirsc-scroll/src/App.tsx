import { useEffect } from 'react';
import type { FeedKind } from './state/types';
import { Sidebar } from './components/shell/Sidebar';
import { MobileNav } from './components/shell/MobileNav';
import { ModalHost } from './components/modals/ModalHost';
import { Toasts } from './components/common/Toasts';
import { FeedView } from './pages/FeedView';
import { MobileFeed } from './pages/MobileFeed';
import { Explore, TagView } from './pages/Explore';
import { Profile } from './pages/Profile';
import { Saved } from './pages/Saved';
import { History } from './pages/History';
import { Notifications } from './pages/Notifications';
import { Studio } from './pages/Studio';
import { Settings } from './pages/Settings';
import { getState, useP, useS } from './state/store';
import { applyInterestChanges, closeModal, focusSearch, openModal, openSheet, openVideo, rebuildFeeds, setCommentsOpen } from './state/actions';
import { navigate, useRoute, type Route } from './lib/router';
import { isTyping, useLayout, type LayoutMode } from './lib/hooks';
import { getVideo } from './lib/catalog';

const FEEDS: Record<string, FeedKind> = { '': 'foryou', following: 'following', trending: 'trending', friends: 'friends', watch: 'list' };

function feedKind(route: Route): FeedKind | null {
  const k = FEEDS[route.path[0] ?? ''];
  return k ?? null;
}

function Page({ route, layout }: { route: Route; layout: LayoutMode }) {
  const kind = feedKind(route);
  if (kind) return layout === 'mobile' ? <MobileFeed kind={kind} /> : <FeedView kind={kind} />;
  switch (route.path[0]) {
    case 'explore':
      return <Explore route={route} />;
    case 'tag':
      return <TagView tag={(route.path[1] ?? '').toLowerCase()} />;
    case 'profile':
      return <Profile route={route} />;
    case 'saved':
      return <Saved route={route} />;
    case 'history':
      return <History />;
    case 'notifications':
      return <Notifications />;
    case 'studio':
      return <Studio route={route} />;
    case 'settings':
      return <Settings route={route} />;
    default:
      return layout === 'mobile' ? <MobileFeed kind="foryou" /> : <FeedView kind="foryou" />;
  }
}

export function App() {
  const route = useRoute();
  const layout = useLayout();
  const theme = useP((p) => p.settings.theme);
  const density = useP((p) => p.settings.density);
  const reduced = useP((p) => p.settings.reducedMotion);
  const collapsedSetting = useP((p) => p.settings.sidebarCollapsed);
  const listEmpty = useS((s) => s.feeds.list.items.length === 0);

  useEffect(() => {
    const r = document.documentElement;
    // data-look, not data-theme: the Artifact host owns data-theme on the root element.
    r.dataset.look = theme;
    r.dataset.density = density;
    r.dataset.motion = reduced ? 'reduced' : 'full';
  }, [theme, density, reduced]);

  // Build every feed once on boot.
  useEffect(() => {
    rebuildFeeds();
  }, []);

  // Deep links (#/video/:id) open the clip, then For You continues after it.
  useEffect(() => {
    if (route.path[0] === 'video' && route.path[1]) {
      const { p } = getState();
      if (getVideo(p, route.path[1])) openVideo(route.path[1]);
      navigate(getVideo(p, route.path[1]) ? '#/watch' : '#/', true);
    } else if (route.path[0] === 'watch' && listEmpty) {
      navigate('#/', true);
    }
  }, [route.hash, listEmpty, route.path]);

  // Page changes scroll the new page to the top and close any sheet.
  useEffect(() => {
    openSheet(null);
  }, [route.hash]);

  // Global shortcuts: / search, ? help, Esc closes the top-most thing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = getState();
      if (e.key === 'Escape') {
        if (st.s.modal) {
          if (st.s.modal.type === 'interests') applyInterestChanges();
          closeModal();
        } else if (st.s.sheet) openSheet(null);
        else if (st.s.commentsOpen) setCommentsOpen(false);
        else if (isTyping(e)) (e.target as HTMLElement).blur();
        return;
      }
      if (isTyping(e) || st.s.modal || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        if (layout === 'mobile') navigate('#/explore');
        focusSearch();
      } else if (e.key === '?') {
        e.preventDefault();
        openModal({ type: 'shortcuts' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout]);

  const forced = layout === 'tablet';
  const collapsed = forced || collapsedSetting;

  if (layout === 'mobile') {
    const feed = !!feedKind(route);
    return (
      <div className={`app app-mobile${feed ? ' on-feed' : ''}`}>
        <div className="m-main">
          <Page route={route} layout={layout} />
        </div>
        <MobileNav route={route} />
        <ModalHost />
        <Toasts />
      </div>
    );
  }

  return (
    <div className={`app app-${layout}${collapsed ? ' sb-collapsed' : ''}`}>
      <Sidebar route={route} collapsed={collapsed} forced={forced} />
      <div className="main">
        <Page route={route} layout={layout} />
      </div>
      <ModalHost />
      <Toasts />
    </div>
  );
}
