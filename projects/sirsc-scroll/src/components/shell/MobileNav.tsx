import { Bell, Compass, House, Plus } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { useAcct, usePersisted } from '../../state/store';
import { openModal } from '../../state/actions';
import { getUser } from '../../lib/catalog';
import { isDue, useNow } from '../../lib/hooks';
import { href, type Route } from '../../lib/router';

export function MobileNav({ route }: { route: Route }) {
  const p = usePersisted();
  const now = useNow();
  const me = getUser(p, p.activeId)!;
  const unread = useAcct((a) => a.notifications.filter((n) => !n.read && isDue(n.at, now)).length);
  const a = route.path[0] ?? '';
  const feed = ['', 'following', 'trending', 'friends', 'watch', 'video'].includes(a);
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
      <button type="button" className="m-create" onClick={() => openModal({ type: 'upload' })} aria-label="Upload a simulated video">
        <Plus size={22} strokeWidth={2.6} />
      </button>
      <a href="#/notifications" className={a === 'notifications' ? 'on' : ''}>
        <span className="m-nav-ico">
          <Bell size={22} />
          {unread > 0 && <span className="m-badge">{unread > 9 ? '9+' : unread}</span>}
        </span>
        <span>Inbox</span>
      </a>
      <a href={href.profile(me.handle)} className={a === 'profile' && route.path[1] === me.handle ? 'on' : ''}>
        <Avatar user={me} size={24} />
        <span>Profile</span>
      </a>
    </nav>
  );
}
