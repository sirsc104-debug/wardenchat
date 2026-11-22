import { Bell, Bookmark, Compass, House } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { usePersisted } from '../../state/store';
import { getUser } from '../../lib/catalog';
import { useUnreadNotices } from '../../lib/social';
import { href, type Route } from '../../lib/router';

export function MobileNav({ route }: { route: Route }) {
  const p = usePersisted();
  const me = getUser(p, p.activeId);
  const unread = useUnreadNotices();
  const a = route.path[0] ?? '';
  const feed = ['', 'following', 'trending', 'watch', 'video'].includes(a);
  return (
    <nav className="m-nav" aria-label="Main">
      <a href="#/" className={feed ? 'on' : ''} aria-current={feed ? 'page' : undefined}>
        <House size={22} />
        <span>Home</span>
      </a>
      <a href="#/explore" className={a === 'explore' || a === 'tag' ? 'on' : ''}>
        <Compass size={22} />
        <span>Explore</span>
      </a>
      <a href="#/saved" className={a === 'saved' ? 'on' : ''}>
        <Bookmark size={22} />
        <span>Saved</span>
      </a>
      <a href="#/notifications" className={a === 'notifications' ? 'on' : ''}>
        <span className="m-nav-ico">
          <Bell size={22} />
          {unread > 0 && <span className="m-badge">{unread > 9 ? '9+' : unread}</span>}
        </span>
        <span>Inbox</span>
      </a>
      <a href={href.profile('me')} className={a === 'profile' && route.path[1] === 'me' ? 'on' : ''}>
        <Avatar user={me} size={24} />
        <span>Profile</span>
      </a>
    </nav>
  );
}
