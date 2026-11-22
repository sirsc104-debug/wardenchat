import { useMemo } from 'react';
import { Bookmark, CalendarDays, Clapperboard, ExternalLink, FolderOpen, Grid3x3, Heart, History, MapPin, Settings as SettingsIcon, UserRoundX } from 'lucide-react';
import { youtubeChannelUrl } from '../lib/videoSource';
import { PageShell, Panel } from './PageShell';
import { VideoGrid } from './Explore';
import { Avatar } from '../components/common/Avatar';
import { Verified } from '../components/common/Verified';
import { Empty } from '../components/common/Empty';
import { RecommendedCreators } from '../components/panel/Sections';
import { AccountSwitcher } from '../components/shell/Sidebar';
import { useAcct, usePersisted } from '../state/store';
import { openModal, toggleFollow } from '../state/actions';
import { followerCount, followingCount, getVideo, totalLikes, userByHandle, videosBy } from '../lib/catalog';
import { full } from '../lib/format';
import { href, type Route } from '../lib/router';
import { useLayout } from '../lib/hooks';
import { categoryLabel } from '../data/categories';
import { topInterests } from '../lib/recommend';
import { signedInUser } from '../data/users';
import { WARDEN_CHAT_URL } from '../lib/warden';

type Tab = 'videos' | 'liked' | 'collections';

export function Profile({ route }: { route: Route }) {
  const p = usePersisted();
  const layout = useLayout();
  const handle = route.path[1] ?? '';
  // Your own profile is #/profile/me (a creator could share your Warden Chat username).
  const user = handle === 'me' ? (signedInUser() ?? undefined) : userByHandle(p, handle);
  const own = !!user && user.id === p.activeId;
  const base = own ? 'me' : (user?.handle ?? handle);
  const tabParam = (route.path[2] as Tab) ?? (own ? 'liked' : 'videos');
  const following = useAcct((a) => (user ? a.following.includes(user.id) : false));
  const hidden = useAcct((a) => (user ? a.hiddenCreators.includes(user.id) : false));

  const videos = useMemo(() => (user && !own ? videosBy(p, user.id) : []), [p, user, own]);
  const liked = useMemo(() => (own ? p.accounts[p.activeId].liked.map((id) => getVideo(p, id)!).filter(Boolean) : []), [p, own]);
  const collections = own ? p.accounts[p.activeId].collections : [];

  if (!user)
    return (
      <PageShell>
        <Empty icon={UserRoundX} title="That account doesn’t exist" action={<a className="btn btn-accent btn-sm" href="#/explore">Find creators</a>}>
          @{handle} isn’t on SirSC Scroll (yet).
        </Empty>
      </PageShell>
    );

  const tabs: [Tab, string, number | null, typeof Grid3x3][] = own
    ? [
        ['liked', 'Liked', liked.length, Heart],
        ['collections', 'Collections', collections.length, FolderOpen],
      ]
    : [['videos', 'Videos', videos.length, Grid3x3]];
  const tab = tabs.some((t) => t[0] === tabParam) ? tabParam : tabs[0][0];

  const aside = (
    <>
      <Panel title="About">
        <ul className="about">
          {own ? (
            <li>
              <ExternalLink size={14} />{' '}
              <a href={WARDEN_CHAT_URL} target="_blank" rel="noopener noreferrer">
                Your Warden Chat account
              </a>
            </li>
          ) : user.id.startsWith('yt:') ? (
            <li>
              <ExternalLink size={14} />{' '}
              <a href={youtubeChannelUrl(user.id.slice(3))} target="_blank" rel="noopener noreferrer">
                Open the channel on YouTube
              </a>
            </li>
          ) : (
            <li>
              <CalendarDays size={14} /> Joined {new Date(user.joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </li>
          )}
          {user.location && (
            <li>
              <MapPin size={14} /> {user.location}
            </li>
          )}
          {user.categories.length > 0 && (
          <li>
            <span>
              Posts about{' '}
              {user.categories.map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <a href={href.category(c)}>{categoryLabel(c)}</a>
                </span>
              ))}
            </span>
          </li>
          )}
        </ul>
      </Panel>
      {own && (
        <Panel title="Your top interests" action={<button type="button" className="link-btn" onClick={() => openModal({ type: 'interests' })}>Tune</button>}>
          <ul className="bars">
            {topInterests(p.accounts[p.activeId])
              .slice(0, 5)
              .map((x) => (
                <li key={x.category}>
                  <span>{categoryLabel(x.category)}</span>
                  <i style={{ '--w': `${Math.round(x.share * 100 * 3.2)}%` } as React.CSSProperties} />
                  <b>{Math.round(x.share * 100)}%</b>
                </li>
              ))}
          </ul>
        </Panel>
      )}
      <RecommendedCreators focus={user.categories[0]} limit={4} />
    </>
  );

  return (
    <PageShell aside={layout === 'desktop' ? aside : undefined} className="profile">
      <div className="profile-head">
        <Avatar user={user} size={layout === 'mobile' ? 76 : 96} ring />
        <div className="profile-info">
          <h1>
            {user.name} {user.verified && <Verified size={18} />}
            {own && <span className="pill pill-you">You</span>}
          </h1>
          <p className="profile-handle">{own ? 'Warden Chat account' : `@${user.handle}`}</p>
          <ul className="profile-stats">
            <li>
              <b>{full(followingCount(p, user))}</b> Following
            </li>
            {own ? (
              <li>
                <b>{full(liked.length)}</b> Liked
              </li>
            ) : (
              <>
                <li>
                  <b>{full(followerCount(p, user))}</b> Followers
                </li>
                <li>
                  <b>{full(totalLikes(p, user))}</b> Likes
                </li>
              </>
            )}
          </ul>
          {user.bio && <p className="profile-bio">{user.bio}</p>}
          <div className="profile-actions">
            {own ? (
              <>
                <a className="btn btn-ghost btn-sm" href={WARDEN_CHAT_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} /> Picture and password on Warden Chat
                </a>
                <a className="btn btn-ghost btn-sm" href="#/settings/account">
                  <SettingsIcon size={14} /> Account settings
                </a>
              </>
            ) : (
              <button type="button" className={`btn btn-sm ${following ? 'btn-ghost' : 'btn-accent'}`} onClick={() => toggleFollow(user.id)}>
                {following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          {hidden && <p className="notice">You’ve hidden @{user.handle} from your feeds. Unhide them in Settings → Feed.</p>}
        </div>
      </div>
      {own && layout === 'mobile' && (
        <div className="quick-links">
          <a href="#/saved">
            <Bookmark size={18} /> Saved
          </a>
          <a href="#/history">
            <History size={18} /> History
          </a>
          <a href="#/settings">
            <SettingsIcon size={18} /> Settings
          </a>
          <AccountSwitcher collapsed={false} upward={false} />
        </div>
      )}
      <div className="tabs-line" role="tablist" aria-label="Profile sections">
        {tabs.map(([id, label, n, Icon]) => (
          <a key={id} href={href.profile(base, id === tabs[0][0] ? undefined : id)} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''}>
            <Icon size={15} /> {label} {n !== null && <span className="seg-n">{n}</span>}
          </a>
        ))}
      </div>
      {tab === 'videos' &&
        (videos.length ? (
          <VideoGrid videos={videos} label={`@${user.handle} · Videos`} />
        ) : (
          <Empty icon={Clapperboard} title="No videos to show">
            Nothing from @{user.handle} is in the feed right now.
          </Empty>
        ))}
      {tab === 'liked' &&
        (liked.length ? (
          <VideoGrid videos={liked} label="Videos you liked" stat="likes" />
        ) : (
          <Empty icon={Heart} title="No liked videos yet">
            Double-click a video or press L to like it.
          </Empty>
        ))}
      {tab === 'collections' && (
        <div className="col-grid">
          <a href="#/saved" className="col-card">
            <span className="col-stack">
              <Bookmark size={22} />
            </span>
            <b>All saved</b>
            <span>{p.accounts[p.activeId].saved.length} videos</span>
          </a>
          {collections.map((c) => (
            <a key={c.id} href={href.saved(c.id)} className="col-card">
              <span className="col-stack">
                <FolderOpen size={22} />
              </span>
              <b>{c.name}</b>
              <span>{c.videoIds.length} videos</span>
            </a>
          ))}
          <button type="button" className="col-card add" onClick={() => openModal({ type: 'new-collection' })}>
            <span className="col-stack">+</span>
            <b>New collection</b>
          </button>
        </div>
      )}
    </PageShell>
  );
}
