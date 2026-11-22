import { useEffect, useLayoutEffect, useRef } from 'react';
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
import { applyInterestChanges, closeModal, focusSearch, openModal, openSheet, openVideo, rebuildFeeds, toast } from './state/actions';
import { toggleSidebar } from './components/shell/Sidebar';
import { navigate, useRoute, type Route } from './lib/router';
import { isTyping, useLayout, type LayoutMode } from './lib/hooks';
import { getVideo, videoMode, type VideoMode } from './lib/catalog';
import { configureCatalog, lookupCatalogIds, useCatalog } from './lib/remoteCatalog';
import { topInterests } from './lib/recommend';
import type { AccountState } from './state/types';

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
  const collapsedWide = useP((p) => p.settings.sidebarCollapsed);
  const collapsedNarrow = useP((p) => p.settings.sidebarCollapsedNarrow);
  const listEmpty = useS((s) => s.feeds.list.items.length === 0);
  const videoSource = useP((p) => p.settings.videoSource);
  const previewKey = useP((p) => p.settings.catalogPreviewKey);
  const activeId = useP((p) => p.activeId);
  const catalog = useCatalog();
  const lastMode = useRef<VideoMode | null>(null);
  const triedLinks = useRef(new Set<string>());

  useLayoutEffect(() => {
    const r = document.documentElement;
    // data-look, not data-theme: the Artifact host owns data-theme on the root element.
    r.dataset.look = theme;
    r.dataset.density = density;
    r.dataset.motion = reduced ? 'reduced' : 'full';
  }, [theme, density, reduced]);

  // Real videos: switch the catalog on or off, or apply a new preview key, from Settings.
  useEffect(() => {
    const { p } = getState();
    const interests = topInterests(p.accounts[p.activeId]).slice(0, 3).map((x) => x.category);
    configureCatalog({ enabled: videoSource === 'catalog', previewKey, interests });
  }, [videoSource, previewKey]);

  // Build every feed on boot, and again whenever the set of videos changes (catalog loaded, more pages,
  // a video hidden as unplayable). Within the same mode, what's on screen stays put.
  useEffect(() => {
    const mode = videoMode(getState().p);
    rebuildFeeds(lastMode.current === mode);
    lastMode.current = mode;
  }, [catalog.version, catalog.status]);

  // Say once per visit why demo clips are showing, or that the feed includes unreviewed videos.
  const noticed = useRef('');
  useEffect(() => {
    if (videoSource !== 'catalog') return;
    let note = '';
    if (catalog.status === 'empty') note = 'No approved real videos yet, so demo clips are showing. Add your preview key in Settings › Videos.';
    else if (catalog.status === 'error') note = 'Couldn’t reach the video catalog, so demo clips are showing.';
    else if (catalog.status === 'ready' && catalog.preview) note = 'Preview: your feed includes videos not yet approved for students.';
    if (note && noticed.current !== note) {
      noticed.current = note;
      toast(note, 'Settings', () => navigate('#/settings/videos'));
    }
  }, [catalog.status, catalog.preview, videoSource]);

  // Saved, liked and watched real videos that aren't in the loaded pages yet: fetch their details.
  useEffect(() => {
    if (catalog.status !== 'ready' && catalog.status !== 'empty') return;
    const a: AccountState = getState().p.accounts[activeId];
    void lookupCatalogIds([
      ...a.liked,
      ...a.saved,
      ...a.collections.flatMap((c) => c.videoIds),
      ...a.history.map((h) => h.videoId),
      ...a.shares.map((x) => x.videoId),
    ]);
  }, [catalog.status, activeId]);

  // Deep links (#/video/:id) open the clip, then For You continues after it. A real video that isn't
  // loaded yet is looked up first.
  useEffect(() => {
    if (route.path[0] === 'video' && route.path[1]) {
      const id = route.path[1];
      const { p } = getState();
      if (getVideo(p, id)) {
        openVideo(id);
        navigate('#/watch', true);
      } else if (id.startsWith('yt-') && catalog.status === 'loading') {
        // Wait for the catalog.
      } else if (id.startsWith('yt-') && catalog.status === 'ready' && !triedLinks.current.has(id)) {
        triedLinks.current.add(id);
        void lookupCatalogIds([id]).then(() => {
          if (!getVideo(getState().p, id)) navigate('#/', true);
        });
      } else {
        navigate('#/', true);
      }
    } else if (route.path[0] === 'watch' && listEmpty) {
      navigate('#/', true);
    }
  }, [route.hash, listEmpty, route.path, catalog.status, catalog.version]);

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
      } else if (e.key === '[' && layout !== 'mobile') {
        e.preventDefault();
        const narrow = layout === 'tablet';
        toggleSidebar(narrow, narrow ? st.p.settings.sidebarCollapsedNarrow : st.p.settings.sidebarCollapsed);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout]);

  const narrow = layout === 'tablet';
  const collapsed = narrow ? collapsedNarrow : collapsedWide;

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
      <Sidebar route={route} collapsed={collapsed} narrow={narrow} />
      <div className="main">
        <Page route={route} layout={layout} />
      </div>
      <ModalHost />
      <Toasts />
    </div>
  );
}
