import { useMemo, useState } from 'react';
import { BarChart3, Clapperboard, Eye, FileText, Pencil, Play, Plus, Trash2, Upload } from 'lucide-react';
import type { Video, Visibility } from '../state/types';
import { PageShell, Panel } from './PageShell';
import { useOpenList } from './Explore';
import { BarList, LineChart, StatTile } from '../components/common/Charts';
import { Placeholder } from '../components/placeholders/Placeholder';
import { Empty } from '../components/common/Empty';
import { useAcct, usePersisted } from '../state/store';
import { confirmAction, deleteDraft, deleteUserVideo, openModal, setVideoVisibility } from '../state/actions';
import { audienceInterests, avgWatch, dailySeries, engagement, retention, trafficSources } from '../lib/analytics';
import { commentCount, likeCount, videosBy, viewCount } from '../lib/catalog';
import { ago, compact, duration, full } from '../lib/format';
import { categoryLabel } from '../data/categories';
import { useNow } from '../lib/hooks';
import type { Route } from '../lib/router';

type Tab = 'overview' | 'content' | 'drafts';
const RANGES = [7, 28, 90];

function pctDelta(cur: number, prev: number): number {
  return prev > 0 ? (cur - prev) / prev : cur > 0 ? 1 : 0;
}

function Overview({ videos }: { videos: Video[] }) {
  const p = usePersisted();
  const [days, setDays] = useState(28);
  const [retId, setRetId] = useState<string>(videos[0]?.id ?? '');
  const now = useNow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const series = useMemo(() => dailySeries(p, p.activeId, days), [p, days, now]);
  const sum = (list: { views: number; likes: number; followers: number }[], k: 'views' | 'likes' | 'followers') => list.reduce((s, x) => s + x[k], 0);
  const views = sum(series.cur, 'views');
  const likes = sum(series.cur, 'likes');
  const followers = sum(series.cur, 'followers');
  const watch = videos.length ? videos.reduce((s, v) => s + avgWatch(v), 0) / videos.length : 0;
  const bucket = (k: 'views' | 'likes' | 'followers') => {
    const n = 12;
    const size = Math.max(1, Math.floor(series.cur.length / n));
    const out: number[] = [];
    for (let i = 0; i < series.cur.length; i += size) out.push(sum(series.cur.slice(i, i + size), k));
    return out;
  };
  const eng = engagement(p, p.activeId);
  const retVideo = videos.find((v) => v.id === retId) ?? videos[0];
  const fmtDay = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const top = [...videos].sort((a, b) => viewCount(p, b) - viewCount(p, a)).slice(0, 6);
  const open = useOpenList(top, 'Your top videos');

  return (
    <>
      <div className="filter-row" role="toolbar" aria-label="Date range">
        <div className="seg seg-sm">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={days === r} aria-selected={days === r} onClick={() => setDays(r)}>
              Last {r} days
            </button>
          ))}
        </div>
        <span className="pill pill-sim">Simulated statistics</span>
      </div>
      <div className="stat-grid">
        <StatTile label="Views" value={compact(views)} delta={pctDelta(views, sum(series.prev, 'views'))} trend={bucket('views')} />
        <StatTile label="Likes" value={compact(likes)} delta={pctDelta(likes, sum(series.prev, 'likes'))} trend={bucket('likes')} />
        <StatTile label="New followers" value={compact(followers)} delta={pctDelta(followers, sum(series.prev, 'followers'))} trend={bucket('followers')} />
        <StatTile label="Average watched" value={`${Math.round(watch * 100)}%`} />
      </div>
      <div className="studio-grid">
        <Panel title="Views per day" className="span-2">
          <LineChart title="Views per day" data={series.cur.map((d) => ({ label: fmtDay(d.t), value: d.views }))} format={(v) => `${full(v)} views`} />
        </Panel>
        <Panel
          title="Audience retention"
          action={
            videos.length > 1 && (
              <label className="select-wrap sm">
                <span className="sr-only">Video</span>
                <select value={retVideo?.id} onChange={(e) => setRetId(e.target.value)}>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title.slice(0, 34)}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
        >
          {retVideo && (
            <>
              <LineChart title={`Retention for ${retVideo.title}`} data={retention(retVideo).map((r) => ({ label: duration(r.t), value: r.pct }))} max={1} yFormat={(v) => `${Math.round(v * 100)}%`} format={(v) => `${Math.round(v * 100)}% still watching`} height={160} />
              <p className="muted small">Share of viewers still watching at each moment of “{retVideo.title}”.</p>
            </>
          )}
        </Panel>
        <Panel title="Engagement">
          <BarList
            title="Engagement totals"
            data={[
              { label: 'Likes', value: eng.likes },
              { label: 'Saves', value: eng.saves },
              { label: 'Shares', value: eng.shares },
              { label: 'Comments', value: eng.comments },
            ].sort((a, b) => b.value - a.value)}
            format={full}
          />
        </Panel>
        <Panel title="Where views come from">
          <BarList title="Traffic sources" data={trafficSources(p.activeId).map((t) => ({ label: t.label, value: t.share, display: `${Math.round(t.share * 100)}%` }))} />
        </Panel>
        <Panel title="What your audience watches">
          <BarList title="Audience interests" data={audienceInterests(p.activeId).map((a) => ({ label: categoryLabel(a.category), value: a.share, display: `${Math.round(a.share * 100)}%` }))} />
        </Panel>
        <Panel title="Top videos" className="span-2">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Video</th>
                  <th scope="col" className="num">
                    Views
                  </th>
                  <th scope="col" className="num">
                    Likes
                  </th>
                  <th scope="col" className="num">
                    Comments
                  </th>
                  <th scope="col" className="num">
                    Avg watched
                  </th>
                  <th scope="col">Posted</th>
                </tr>
              </thead>
              <tbody>
                {top.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <button type="button" className="row-video" onClick={() => open(v)}>
                        <span className="mini-thumb">
                          <Placeholder video={v} running={false} />
                        </span>
                        <span className="row-title">{v.title}</span>
                      </button>
                    </td>
                    <td className="num">{full(viewCount(p, v))}</td>
                    <td className="num">{full(likeCount(p, v))}</td>
                    <td className="num">{full(commentCount(p, v))}</td>
                    <td className="num">{Math.round(avgWatch(v) * 100)}%</td>
                    <td>{ago(v.uploadedAt, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Content({ videos }: { videos: Video[] }) {
  const p = usePersisted();
  const now = useNow();
  const open = useOpenList(videos, 'Your videos');
  if (!videos.length)
    return (
      <Empty icon={Clapperboard} title="No videos yet" action={<button type="button" className="btn btn-accent btn-sm" onClick={() => openModal({ type: 'upload' })}>Upload a simulated video</button>}>
        Published videos appear here with their stats.
      </Empty>
    );
  return (
    <div className="table-wrap card">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Video</th>
            <th scope="col">Visibility</th>
            <th scope="col" className="num">
              Views
            </th>
            <th scope="col" className="num">
              Likes
            </th>
            <th scope="col" className="num">
              Comments
            </th>
            <th scope="col">Posted</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => (
            <tr key={v.id}>
              <td>
                <button type="button" className="row-video" onClick={() => open(v)}>
                  <span className="mini-thumb">
                    <Placeholder video={v} running={false} />
                  </span>
                  <span className="row-title">
                    {v.title}
                    <small>
                      {categoryLabel(v.category)} · {duration(v.duration)} {v.local && '· made in Studio'}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                {v.local ? (
                  <label className="select-wrap sm">
                    <span className="sr-only">Visibility</span>
                    <select value={v.visibility ?? 'public'} onChange={(e) => setVideoVisibility(v.id, e.target.value as Visibility)}>
                      <option value="public">Everyone</option>
                      <option value="friends">Friends</option>
                      <option value="private">Only me</option>
                    </select>
                  </label>
                ) : (
                  'Everyone'
                )}
              </td>
              <td className="num">{full(viewCount(p, v))}</td>
              <td className="num">{full(likeCount(p, v))}</td>
              <td className="num">{full(commentCount(p, v))}</td>
              <td>{ago(v.uploadedAt, now)}</td>
              <td className="row-actions">
                <button type="button" className="icon-btn xs" onClick={() => open(v)} aria-label={`Watch ${v.title}`} title="Watch">
                  <Play size={14} />
                </button>
                {v.local && (
                  <button type="button" className="icon-btn xs" onClick={() => confirmAction('Delete this video?', `“${v.title}” will be removed everywhere on this device.`, 'Delete', () => deleteUserVideo(v.id))} aria-label={`Delete ${v.title}`} title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Drafts() {
  const drafts = useAcct((a) => a.drafts);
  const now = useNow();
  if (!drafts.length)
    return (
      <Empty icon={FileText} title="No drafts" action={<button type="button" className="btn btn-accent btn-sm" onClick={() => openModal({ type: 'upload' })}>Start a video</button>}>
        Use “Save draft” in the upload dialog to finish a video later.
      </Empty>
    );
  return (
    <ul className="drafts">
      {drafts.map((d) => (
        <li key={d.id} className="draft card">
          <span className="mini-thumb lg">
            <Placeholder video={{ template: d.template, palette: d.palette, caption: (d.title || 'DRAFT').toUpperCase(), glyph: d.glyph, variant: d.variant }} running={false} />
          </span>
          <div className="draft-info">
            <b>{d.title || 'Untitled draft'}</b>
            <span className="muted small">
              {categoryLabel(d.category)} · {duration(d.duration)} · edited {ago(d.updatedAt, now)}
            </span>
            {d.hashtags.length > 0 && <span className="muted small">{d.hashtags.map((t) => `#${t}`).join(' ')}</span>}
          </div>
          <div className="draft-actions">
            <button type="button" className="btn btn-accent btn-sm" onClick={() => openModal({ type: 'upload', draftId: d.id })}>
              <Pencil size={14} /> Continue
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => confirmAction('Delete draft?', `“${d.title || 'Untitled draft'}” will be deleted.`, 'Delete draft', () => deleteDraft(d.id))}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Studio({ route }: { route: Route }) {
  const p = usePersisted();
  const tab = (['overview', 'content', 'drafts'].includes(route.path[1]) ? route.path[1] : 'overview') as Tab;
  const videos = useMemo(() => videosBy(p, p.activeId), [p]);
  const draftCount = useAcct((a) => a.drafts.length);
  const tabs: [Tab, string, typeof Eye, number | null][] = [
    ['overview', 'Analytics', BarChart3, null],
    ['content', 'Content', Clapperboard, videos.length],
    ['drafts', 'Drafts', FileText, draftCount],
  ];
  return (
    <PageShell
      title={
        <>
          Creator Studio <span className="pill pill-sim">Demo</span>
        </>
      }
      actions={
        <button type="button" className="btn btn-accent btn-sm" onClick={() => openModal({ type: 'upload' })}>
          <Upload size={14} /> Upload
        </button>
      }
      className="studio"
    >
      <div className="tabs-line" role="tablist" aria-label="Studio sections">
        {tabs.map(([id, label, Icon, n]) => (
          <a key={id} href={`#/studio/${id}`} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''}>
            <Icon size={15} /> {label} {n !== null && <span className="seg-n">{n}</span>}
          </a>
        ))}
      </div>
      {tab === 'overview' &&
        (videos.length ? (
          <Overview videos={videos} />
        ) : (
          <Empty icon={Plus} title="Publish your first video to see analytics" action={<button type="button" className="btn btn-accent btn-sm" onClick={() => openModal({ type: 'upload' })}>Upload a simulated video</button>} />
        ))}
      {tab === 'content' && <Content videos={videos} />}
      {tab === 'drafts' && <Drafts />}
    </PageShell>
  );
}
