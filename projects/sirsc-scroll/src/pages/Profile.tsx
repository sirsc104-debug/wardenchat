import { useMemo, useState } from 'react';
import { Bookmark, CalendarDays, Clapperboard, FolderOpen, Grid3x3, Heart, History, Link2, MapPin, Pencil, Settings as SettingsIcon, UserRoundX } from 'lucide-react';
import type { User } from '../state/types';
import { PageShell, Panel } from './PageShell';
import { VideoGrid } from './Explore';
import { Avatar } from '../components/common/Avatar';
import { Verified } from '../components/common/Verified';
import { Empty } from '../components/common/Empty';
import { RecommendedCreators } from '../components/panel/Sections';
import { AccountSwitcher } from '../components/shell/Sidebar';
import { useAcct, usePersisted } from '../state/store';
import { openModal, toast, toggleFollow, updateProfile } from '../state/actions';
import { followerCount, followingCount, getVideo, profileLink, totalLikes, userByHandle, videosBy } from '../lib/catalog';
import { full } from '../lib/format';
import { href, type Route } from '../lib/router';
import { useLayout } from '../lib/hooks';
import { categoryLabel } from '../data/categories';
import { topInterests } from '../lib/recommend';
import { FRIENDS_OF } from '../data/users';

type Tab = 'videos' | 'liked' | 'collections' | 'settings';

export function ProfileEditor({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [h1, setH1] = useState(user.avatar.h1);
  const [h2, setH2] = useState(user.avatar.h2);
  const presets: [number, number][] = [
    [188, 230],
    [265, 205],
    [140, 25],
    [315, 265],
    [175, 45],
    [20, 330],
    [48, 10],
    [95, 170],
  ];
  const dirty = name !== user.name || bio !== user.bio || h1 !== user.avatar.h1 || h2 !== user.avatar.h2;
  return (
    <form
      className="form profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        updateProfile({ name, bio, avatar: { h1, h2 } });
        toast('Profile saved');
      }}
    >
      <div className="profile-form-av">
        <Avatar user={{ name: name || user.name, avatar: { h1, h2 } }} size={72} ring />
        <div className="swatches" role="radiogroup" aria-label="Avatar color">
          {presets.map(([a, b]) => (
            <button
              key={`${a}-${b}`}
              type="button"
              role="radio"
              aria-checked={h1 === a && h2 === b}
              className="swatch"
              style={{ background: `linear-gradient(135deg, hsl(${a} 70% 50%), hsl(${b} 70% 36%))` }}
              onClick={() => (setH1(a), setH2(b))}
              aria-label={`Color preset ${a}`}
            />
          ))}
        </div>
      </div>
      <label className="field">
        <span>Display name</span>
        <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>
          Bio <em>{bio.length}/160</em>
        </span>
        <textarea rows={3} value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Avatar hue</span>
          <input type="range" min={0} max={359} value={h1} onChange={(e) => setH1(Number(e.target.value))} style={{ '--track': `linear-gradient(90deg, hsl(0 70% 50%), hsl(60 70% 50%), hsl(120 70% 50%), hsl(180 70% 50%), hsl(240 70% 50%), hsl(300 70% 50%), hsl(359 70% 50%))` } as React.CSSProperties} className="hue" />
        </label>
        <label className="field">
          <span>Gradient hue</span>
          <input type="range" min={0} max={359} value={h2} onChange={(e) => setH2(Number(e.target.value))} className="hue" />
        </label>
      </div>
      <p className="muted small">Your @handle stays @{user.handle}. Changes are stored in this browser only.</p>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty} onClick={() => (setName(user.name), setBio(user.bio), setH1(user.avatar.h1), setH2(user.avatar.h2))}>
          Discard
        </button>
        <button type="submit" className="btn btn-accent btn-sm" disabled={!dirty || !name.trim()}>
          Save profile
        </button>
      </div>
    </form>
  );
}

export function Profile({ route }: { route: Route }) {
  const p = usePersisted();
  const layout = useLayout();
  const handle = route.path[1] ?? '';
  const user = userByHandle(p, handle);
  const tabParam = (route.path[2] as Tab) ?? 'videos';
  const following = useAcct((a) => (user ? a.following.includes(user.id) : false));
  const hidden = useAcct((a) => (user ? a.hiddenCreators.includes(user.id) : false));
  const own = user?.id === p.activeId;
  const demo = user ? !!p.accounts[user.id] : false;

  const videos = useMemo(() => (user ? videosBy(p, user.id) : []), [p, user]);
  const liked = useMemo(() => (user && p.accounts[user.id] ? p.accounts[user.id].liked.map((id) => getVideo(p, id)!).filter(Boolean) : []), [p, user]);
  const collections = own ? p.accounts[p.activeId].collections : [];

  if (!user)
    return (
      <PageShell>
        <Empty icon={UserRoundX} title="That account doesn’t exist" action={<a className="btn btn-accent btn-sm" href="#/explore">Find creators</a>}>
          @{handle} isn’t on SirSC Scroll (yet).
        </Empty>
      </PageShell>
    );

  const tabs: [Tab, string, number | null, typeof Grid3x3][] = [['videos', 'Videos', videos.length, Grid3x3]];
  if (demo) tabs.push(['liked', 'Liked', liked.length, Heart]);
  if (own) tabs.push(['collections', 'Collections', collections.length, FolderOpen], ['settings', 'Profile settings', null, SettingsIcon]);
  const tab = tabs.some((t) => t[0] === tabParam) ? tabParam : 'videos';
  const friends = FRIENDS_OF[p.activeId]?.includes(user.id);

  const aside = (
    <>
      <Panel title="About">
        <ul className="about">
          <li>
            <CalendarDays size={14} /> Joined {new Date(user.joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </li>
          {user.location && (
            <li>
              <MapPin size={14} /> {user.location}
            </li>
          )}
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
            {own && <span className="pill pill-you">You · demo account</span>}
            {!own && friends && <span className="pill">Friend</span>}
          </h1>
          <p className="profile-handle">@{user.handle}</p>
          <ul className="profile-stats">
            <li>
              <b>{full(followingCount(p, user))}</b> Following
            </li>
            <li>
              <b>{full(followerCount(p, user))}</b> Followers
            </li>
            <li>
              <b>{full(totalLikes(p, user))}</b> Likes
            </li>
          </ul>
          <p className="profile-bio">{user.bio}</p>
          <div className="profile-actions">
            {own ? (
              <>
                <a className="btn btn-accent btn-sm" href={href.profile(user.handle, 'settings')}>
                  <Pencil size={14} /> Edit profile
                </a>
                <a className="btn btn-ghost btn-sm" href="#/studio">
                  <Clapperboard size={14} /> Creator Studio
                </a>
              </>
            ) : (
              <button type="button" className={`btn btn-sm ${following ? 'btn-ghost' : 'btn-accent'}`} onClick={() => toggleFollow(user.id)}>
                {following ? 'Following' : 'Follow'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const link = profileLink(user.handle);
                navigator.clipboard?.writeText(link).then(
                  () => toast('Profile link copied'),
                  () => toast(link),
                );
              }}
            >
              <Link2 size={14} /> Share profile
            </button>
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
          <a href="#/studio">
            <Clapperboard size={18} /> Studio
          </a>
          <a href="#/settings">
            <SettingsIcon size={18} /> Settings
          </a>
          <AccountSwitcher collapsed={false} upward={false} />
        </div>
      )}
      <div className="tabs-line" role="tablist" aria-label="Profile sections">
        {tabs.map(([id, label, n, Icon]) => (
          <a key={id} href={href.profile(user.handle, id === 'videos' ? undefined : id)} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''}>
            <Icon size={15} /> {label} {n !== null && <span className="seg-n">{n}</span>}
          </a>
        ))}
      </div>
      {tab === 'videos' &&
        (videos.length ? (
          <VideoGrid videos={videos} label={`@${user.handle} · Videos`} />
        ) : (
          <Empty icon={Clapperboard} title={own ? 'You haven’t posted yet' : 'No videos yet'} action={own && <button type="button" className="btn btn-accent btn-sm" onClick={() => openModal({ type: 'upload' })}>Upload a simulated video</button>}>
            {own ? 'Publish one from Creator Studio and it appears here and in your followers’ feeds.' : `@${user.handle} hasn’t posted anything.`}
          </Empty>
        ))}
      {tab === 'liked' &&
        (liked.length ? (
          <VideoGrid videos={liked} label={`Liked by @${user.handle}`} stat="likes" />
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
      {tab === 'settings' && own && (
        <Panel title="Profile settings">
          <ProfileEditor key={p.activeId} user={user} />
        </Panel>
      )}
    </PageShell>
  );
}
