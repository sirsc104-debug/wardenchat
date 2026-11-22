import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { EASE, reducedMotion } from '../lib/motion';
import { useRoute } from '../lib/router';
import { Bell, Flame } from 'lucide-react';
import { TopBar } from '../components/shell/TopBar';
import { useLayout, isDue, useNow } from '../lib/hooks';
import { useAcct, usePersisted } from '../state/store';
import { trendingHashtags } from '../lib/recommend';
import { href } from '../lib/router';

/** Fills the top bar beside the search box with live trends and the notification count. */
function TopStrip() {
  const p = usePersisted();
  const now = useNow();
  const unread = useAcct((a) => a.notifications.filter((n) => !n.read && isDue(n.at, now)).length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tags = useMemo(() => trendingHashtags(p, 6), [p.userVideos]);
  return (
    <div className="top-strip">
      <span className="top-strip-label">
        <Flame size={14} /> Trending
      </span>
      <div className="top-strip-tags">
        {tags.map((t) => (
          <a key={t.tag} href={href.tag(t.tag)} className="chip chip-xs">
            #{t.tag}
          </a>
        ))}
      </div>
      <a href="#/notifications" className="icon-btn top-bell" aria-label={`Notifications, ${unread} unread`} title="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="top-bell-n">{unread > 9 ? '9+' : unread}</span>}
      </a>
    </div>
  );
}

/** Non-feed pages: top bar plus a scrolling content area. */
export function PageShell({ title, actions, children, aside, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  const layout = useLayout();
  const route = useRoute();
  const grid = useRef<HTMLDivElement>(null);
  // Every page (and every tab or filter that changes the address) eases in.
  useLayoutEffect(() => {
    if (!reducedMotion()) grid.current?.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 320, easing: EASE });
  }, [route.hash]);
  return (
    <div className={`page ${className}`}>
      {layout !== 'mobile' && (
        <TopBar>
          <TopStrip />
        </TopBar>
      )}
      <div className="page-scroll">
        <div ref={grid} className={`page-grid${aside ? ' has-aside' : ''}`}>
          <main className="page-main">
            {(title || actions) && (
              <div className="page-head">
                {title && <h1>{title}</h1>}
                {actions && <div className="page-actions">{actions}</div>}
              </div>
            )}
            {children}
          </main>
          {aside && <aside className="page-aside">{aside}</aside>}
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, children, action, className = '' }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
