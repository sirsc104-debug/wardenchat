import { useRef, useState } from 'react';
import { Bell, Bookmark, ChevronsUpDown, Compass, ExternalLink, Flame, History, House, LogOut, PanelLeftClose, PanelLeftOpen, Settings, UserRound, UsersRound, type LucideIcon } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { BrandMark, Wordmark } from '../common/Brand';
import { useAcct, useApp, usePersisted } from '../../state/store';
import { updateSettings } from '../../state/actions';
import { getUser } from '../../lib/catalog';
import { useDismiss, useExit } from '../../lib/hooks';
import { href, type Route } from '../../lib/router';
import { useUnreadNotices } from '../../lib/social';
import { WARDEN_CHAT_URL } from '../../lib/warden';
import { signOutHere } from '../../lib/accounts';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  badge?: number;
}

function activeId(route: Route): string {
  const [a, b] = route.path;
  if (!a) return 'foryou';
  if (a === 'video' || a === 'watch') return 'watch';
  if (a === 'profile') return b === 'me' ? 'profile' : 'creator';
  if (a === 'tag') return 'explore';
  return a;
}

export function Sidebar({ route, collapsed, narrow }: { route: Route; collapsed: boolean; narrow: boolean }) {
  const unread = useUnreadNotices();
  const saved = useAcct((a) => a.saved.length);
  const feed = useApp((st) => st.s.activeFeed);
  const current = activeId(route);
  // Collapsed icons get a tooltip; it's position: fixed so the scrolling nav never clips it.
  const [tip, setTip] = useState<{ text: string; y: number } | null>(null);
  const showTip = (e: React.SyntheticEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!collapsed || !el) return setTip(null);
    const r = el.getBoundingClientRect();
    setTip({ text: el.dataset.tip!, y: r.top + r.height / 2 });
  };

  const main: NavItem[] = [
    { id: 'foryou', label: 'For You', icon: House, to: '#/' },
    { id: 'following', label: 'Following', icon: UsersRound, to: '#/following' },
    { id: 'trending', label: 'Trending', icon: Flame, to: '#/trending' },
    { id: 'explore', label: 'Explore', icon: Compass, to: '#/explore' },
  ];
  const library: NavItem[] = [
    { id: 'saved', label: 'Saved', icon: Bookmark, to: '#/saved', badge: saved },
    { id: 'history', label: 'History', icon: History, to: '#/history' },
    { id: 'notifications', label: 'Notifications', icon: Bell, to: '#/notifications', badge: unread },
    { id: 'profile', label: 'Profile', icon: UserRound, to: href.profile('me') },
    { id: 'settings', label: 'Settings', icon: Settings, to: '#/settings' },
  ];

  const item = (it: NavItem) => {
    const on = current === it.id || (current === 'watch' && it.id === feed);
    return (
      <li key={it.id}>
        <a href={it.to} className={`nav-item${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} data-tip={collapsed ? it.label : undefined}>
          <span className="nav-ico">
            <it.icon size={19} />
            {!!it.badge && it.id === 'notifications' && <span className="nav-dot" />}
          </span>
          <span className="nav-label">{it.label}</span>
          {!!it.badge && <span className={`nav-badge${it.id === 'notifications' ? ' hot' : ''}`}>{it.badge > 99 ? '99+' : it.badge}</span>}
        </a>
      </li>
    );
  };

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Main" onPointerOver={showTip} onPointerLeave={() => setTip(null)} onFocus={showTip} onBlur={() => setTip(null)} onClick={() => setTip(null)}>
      {tip && collapsed && (
        <span className="sb-tip" style={{ top: tip.y }} role="tooltip">
          {tip.text}
        </span>
      )}
      <div className="sb-head">
        <a href="#/" className="brand" aria-label="SirSC Scroll, For You">
          <BrandMark size={28} />
          <Wordmark />
        </a>
      </div>
      <div className="sb-scroll">
        <ul className="nav-list">{main.map(item)}</ul>
        <div className="nav-sep" />
        <ul className="nav-list">{library.map(item)}</ul>
      </div>
      <button
        type="button"
        className="nav-item sb-toggle"
        onClick={() => toggleSidebar(narrow, collapsed)}
        aria-label={collapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
        aria-expanded={!collapsed}
        data-tip={collapsed ? 'Expand sidebar' : undefined}
      >
        <span className="nav-ico">{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</span>
        <span className="nav-label">Collapse</span>
      </button>
      <AccountSwitcher collapsed={collapsed} />
    </nav>
  );
}

export function toggleSidebar(narrow: boolean, collapsed: boolean) {
  updateSettings(narrow ? { sidebarCollapsedNarrow: !collapsed } : { sidebarCollapsed: !collapsed });
}

export function AccountSwitcher({ collapsed, upward = true }: { collapsed: boolean; upward?: boolean }) {
  const p = usePersisted();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [btn, pop]);
  const pres = useExit(open, 150);
  const me = getUser(p, p.activeId);
  if (!me) return null;
  return (
    <div className={`acct${open ? ' open' : ''}`}>
      <button ref={btn} type="button" className="acct-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Signed in as ${me.name}. Account menu`} data-tip={collapsed ? me.name : undefined}>
        <Avatar user={me} size={32} ring />
        <span className="acct-names">
          <span className="acct-name">{me.name}</span>
          <span className="acct-handle">Warden Chat account</span>
        </span>
        <ChevronsUpDown size={15} className="acct-chev" />
      </button>
      {pres.mounted && (
        <div ref={pop} className={`acct-pop${upward ? ' up' : ''}${pres.closing ? ' closing' : ''}`} role="dialog" aria-label="Account">
          <div className="acct-pop-who">
            <Avatar user={me} size={38} />
            <span className="acct-names">
              <span className="acct-name">{me.name}</span>
              <span className="acct-handle">Signed in with Warden Chat</span>
            </span>
          </div>
          <ul className="acct-pop-list">
            <li>
              <a href={href.profile('me')} className="acct-row" onClick={() => setOpen(false)}>
                <UserRound size={16} /> Your profile
              </a>
            </li>
            <li>
              <a href="#/settings/account" className="acct-row" onClick={() => setOpen(false)}>
                <Settings size={16} /> Account settings
              </a>
            </li>
            <li>
              <a href={WARDEN_CHAT_URL} className="acct-row" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                <ExternalLink size={16} /> Manage on Warden Chat
              </a>
            </li>
          </ul>
          <div className="acct-pop-foot">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              onClick={() => {
                setOpen(false);
                void signOutHere();
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
          <p className="acct-pop-note">Your password, picture and account live on Warden Chat.</p>
        </div>
      )}
    </div>
  );
}
