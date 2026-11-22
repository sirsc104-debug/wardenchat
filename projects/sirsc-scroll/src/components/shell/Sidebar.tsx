import { useRef, useState } from 'react';
import {
  Bell,
  Bookmark,
  ChevronsUpDown,
  Clapperboard,
  Compass,
  Flame,
  History,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  UserRound,
  Users,
  UsersRound,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { BrandMark, Wordmark } from '../common/Brand';
import { useAcct, useApp, usePersisted } from '../../state/store';
import { confirmAction, resetAll, switchAccount, updateSettings } from '../../state/actions';
import { getUser } from '../../lib/catalog';
import { useDismiss, useExit, isDue, useNow } from '../../lib/hooks';
import { withViewTransition } from '../../lib/motion';
import { href, type Route } from '../../lib/router';
import { DEMO_IDS } from '../../data/users';
import { categoryLabel } from '../../data/categories';
import { topInterests } from '../../lib/recommend';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  badge?: number;
}

function activeId(route: Route, me: string): string {
  const [a, b] = route.path;
  if (!a) return 'foryou';
  if (a === 'video' || a === 'watch') return 'watch';
  if (a === 'profile') return b === me ? 'profile' : 'creator';
  if (a === 'tag') return 'explore';
  return a;
}

export function Sidebar({ route, collapsed, narrow }: { route: Route; collapsed: boolean; narrow: boolean }) {
  const p = usePersisted();
  const now = useNow();
  const me = getUser(p, p.activeId)!;
  const unread = useAcct((a) => a.notifications.filter((n) => !n.read && isDue(n.at, now)).length);
  const saved = useAcct((a) => a.saved.length);
  const feed = useApp((st) => st.s.activeFeed);
  const current = activeId(route, me.handle);
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
    { id: 'friends', label: 'Friends', icon: Users, to: '#/friends' },
    { id: 'explore', label: 'Explore', icon: Compass, to: '#/explore' },
  ];
  const library: NavItem[] = [
    { id: 'saved', label: 'Saved', icon: Bookmark, to: '#/saved', badge: saved },
    { id: 'history', label: 'History', icon: History, to: '#/history' },
    { id: 'notifications', label: 'Notifications', icon: Bell, to: '#/notifications', badge: unread },
    { id: 'studio', label: 'Creator Studio', icon: Clapperboard, to: '#/studio' },
    { id: 'profile', label: 'Profile', icon: UserRound, to: href.profile(me.handle) },
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
  const me = getUser(p, p.activeId)!;
  return (
    <div className={`acct${open ? ' open' : ''}`}>
      <button ref={btn} type="button" className="acct-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Demo account: ${me.name}. Switch account`} data-tip={collapsed ? 'Switch demo account' : undefined}>
        <Avatar user={me} size={32} ring />
        <span className="acct-names">
          <span className="acct-name">{me.name}</span>
          <span className="acct-handle">@{me.handle} · demo</span>
        </span>
        <ChevronsUpDown size={15} className="acct-chev" />
      </button>
      {pres.mounted && (
        <div ref={pop} className={`acct-pop${upward ? ' up' : ''}${pres.closing ? ' closing' : ''}`} role="dialog" aria-label="Switch demo account">
          <p className="acct-pop-head">Demo accounts</p>
          <ul>
            {DEMO_IDS.map((id) => {
              const u = getUser(p, id)!;
              const top = topInterests(p.accounts[id]).slice(0, 3).map((x) => categoryLabel(x.category));
              const on = id === p.activeId;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`acct-row${on ? ' on' : ''}`}
                    onClick={() => {
                      setOpen(false);
                      if (id !== p.activeId) withViewTransition(() => switchAccount(id));
                    }}
                  >
                    <Avatar user={u} size={34} />
                    <span className="acct-names">
                      <span className="acct-name">{u.name}</span>
                      <span className="acct-handle">
                        @{u.handle} · {top.join(', ')}
                      </span>
                    </span>
                    {on && <Check size={16} className="acct-check" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="acct-pop-foot">
            <a href="#/settings/demo" className="link-btn" onClick={() => setOpen(false)}>
              Manage demo data
            </a>
            <button
              type="button"
              className="link-btn danger"
              onClick={() => {
                setOpen(false);
                confirmAction('Reset all demo data?', 'Likes, follows, comments, saves, uploads and history for all four demo accounts go back to how they started. Settings are kept.', 'Reset everything', () => withViewTransition(resetAll));
              }}
            >
              <RotateCcw size={12} /> Reset demo data
            </button>
          </div>
          <p className="acct-pop-note">No passwords. Everything stays in this browser.</p>
        </div>
      )}
    </div>
  );
}
