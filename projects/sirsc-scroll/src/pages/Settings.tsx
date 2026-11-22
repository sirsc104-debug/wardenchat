import { useEffect, useState, type ReactNode } from 'react';
import { Check, Clapperboard, Database, Eye, Keyboard, KeyRound, LayoutGrid, ListChecks, MonitorPlay, Palette, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { clearUnplayable, retryCatalog, unplayableCount, useCatalog } from '../lib/remoteCatalog';
import { WidgetControls } from '../components/widgets/CustomizeWidgets';
import { exitThen, withViewTransition } from '../lib/motion';
import type { Density, Settings as SettingsT, ThemeName } from '../state/types';
import { PageShell, Panel } from './PageShell';
import { InterestEditor } from '../components/modals/InterestEditor';
import { Avatar } from '../components/common/Avatar';
import { useAcct, usePersisted } from '../state/store';
import { applyInterestChanges, clearHistory, confirmAction, openModal, resetAccount, resetAll, resetRecommendations, setHistoryPaused, setMuted, switchAccount, unhideCreator, updateSettings } from '../state/actions';
import { getUser, getVideo } from '../lib/catalog';
import { categoryLabel } from '../data/categories';
import { DEMO_IDS } from '../data/users';
import { topInterests } from '../lib/recommend';
import { SHORTCUTS } from '../lib/shortcuts';
import { useLayout } from '../lib/hooks';
import type { Route } from '../lib/router';

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>
        <b>{label}</b>
        {hint && <em>{hint}</em>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string, string?][]; onChange: (v: T) => void }) {
  return (
    <div className="choice-row">
      <b>{label}</b>
      <div className="seg seg-sm" role="radiogroup" aria-label={label}>
        {options.map(([v, l, hint]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} title={hint}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof Eye; children: ReactNode }) {
  return (
    <Panel
      className="settings-sec"
      title={
        <span id={`set-${id}`}>
          <Icon size={16} /> {title}
        </span>
      }
    >
      {children}
    </Panel>
  );
}

/** Where the real videos stand: loading, how many, preview or approved-only, or why demo clips are showing. */
function CatalogStatus({ interests }: { interests: Parameters<typeof retryCatalog>[0] }) {
  const c = useCatalog();
  let text: string;
  if (c.status === 'loading') text = 'Loading the catalog…';
  else if (c.status === 'ready') text = `${c.count.toLocaleString()} real videos loaded${c.exhausted ? ' (all of them)' : ', more load as you scroll'}. ${c.preview ? 'Preview: includes videos not yet approved for students.' : 'Approved videos only.'}`;
  else if (c.status === 'empty') text = 'No approved videos yet, so the demo clips are showing. Add the preview key below to see the videos waiting for review.';
  else if (c.status === 'error') text = `Couldn’t reach the catalog (${c.error ?? 'network error'}), so the demo clips are showing.`;
  else text = 'Off.';
  return (
    <div className="catalog-status" role="status">
      <span>{text}</span>
      {c.keyRejected && <span className="warn-text">The preview key wasn’t accepted. Check it and save it again.</span>}
      {c.status === 'error' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => retryCatalog(interests)}>
          <RotateCcw size={14} /> Try again
        </button>
      )}
    </div>
  );
}

/** The owner's preview key. Kept in this browser's saved settings only; never in the site's code. */
function PreviewKey({ value, onSave }: { value: string; onSave: (k: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const changed = draft.trim() !== value;
  return (
    <div className="preview-key">
      <label htmlFor="preview-key">
        <KeyRound size={14} /> <b>Preview key</b>
      </label>
      <p className="muted small">
        Lets this browser also see videos that are still waiting for review. Get it in the Supabase SQL editor with{' '}
        <code>select decrypted_secret from vault.decrypted_secrets where name = 'scroll_preview_key';</code> It’s saved in this browser only.
      </p>
      <div className="btn-row">
        <input
          id="preview-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the preview key"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && changed) onSave(draft.trim());
          }}
        />
        <button type="button" className="btn btn-accent btn-sm" disabled={!changed} onClick={() => onSave(draft.trim())}>
          Save
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSave('')}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/** Videos YouTube said can't be embedded (or are gone) are hidden on this device; this brings them back. */
function HiddenVideos() {
  const c = useCatalog();
  const n = c.version >= 0 ? unplayableCount() : 0;
  if (!n) return null;
  return (
    <div className="btn-row">
      <span className="muted small">{n} video{n === 1 ? '' : 's'} hidden on this device because YouTube wouldn’t play them.</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={clearUnplayable}>
        Show them again
      </button>
    </div>
  );
}

export function ShortcutTable() {
  return (
    <table className="shortcut-table">
      <tbody>
        {SHORTCUTS.map(([keys, action]) => (
          <tr key={action}>
            <td>
              {keys.map((k, i) => (
                <span key={k}>
                  {i > 0 && <span className="muted"> or </span>}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </td>
            <td>{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Settings({ route }: { route: Route }) {
  const p = usePersisted();
  const layout = useLayout();
  const s = p.settings;
  const set = (patch: Partial<SettingsT>) => updateSettings(patch);
  const hidden = useAcct((a) => a.hiddenCreators);
  const notInt = useAcct((a) => a.notInterested);
  const paused = useAcct((a) => a.historyPaused);
  const historyLen = useAcct((a) => a.history.length);
  const section = route.path[1];

  useEffect(() => {
    if (section) document.getElementById(`set-${section}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [section]);

  const nav: [string, string, typeof Eye][] = [
    ['playback', 'Playback', MonitorPlay],
    ['videos', 'Videos', Clapperboard],
    ['appearance', 'Appearance', Palette],
    ['widgets', 'Widgets', LayoutGrid],
    ['feed', 'Feed', SlidersHorizontal],
    ['demo', 'Demo data', Database],
    ['keys', 'Keyboard shortcuts', Keyboard],
  ];

  return (
    <PageShell title="Settings" className="settings">
      <div className="settings-layout">
        {layout === 'desktop' && (
          <nav className="settings-nav" aria-label="Settings sections">
            {nav.map(([id, label, Icon]) => (
              <a key={id} href={`#/settings/${id}`} className={section === id ? 'on' : ''}>
                <Icon size={15} /> {label}
              </a>
            ))}
          </nav>
        )}
        <div className="settings-body">
          <Section id="playback" title="Playback" icon={MonitorPlay}>
            <Toggle label="Autoplay" hint="Start each video as soon as it’s on screen" checked={s.autoplay} onChange={(v) => set({ autoplay: v })} />
            <Toggle label="Auto-advance" hint="Go to the next video when one ends (takes priority over loop)" checked={s.autoAdvance} onChange={(v) => set({ autoAdvance: v })} />
            <Toggle label="Loop current video" hint={s.autoAdvance ? 'Off while auto-advance is on' : 'Replay a clip when it ends'} checked={s.loop} onChange={(v) => set({ loop: v })} />
            <Toggle label="Start muted" hint="Clips open with the generated soundtrack off" checked={s.startMuted} onChange={(v) => (set({ startMuted: v }), setMuted(v))} />
            <div className="choice-row">
              <b>Playback speed</b>
              <div className="seg seg-sm" role="radiogroup" aria-label="Playback speed">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={s.speed === v} onClick={() => set({ speed: v })}>
                    {v}×
                  </button>
                ))}
              </div>
            </div>
            <label className="choice-row">
              <b>Volume</b>
              <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} aria-label="Volume" />
            </label>
            <Toggle label="Reduced animations" hint="Freeze placeholder animations and use quick fades instead of slides" checked={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
          </Section>

          <Section id="videos" title="Videos" icon={Clapperboard}>
            <Choice
              label="Video source"
              value={s.videoSource}
              options={[
                ['catalog', 'Real videos', 'From the SirSC Scroll catalog, played with YouTube’s own player'],
                ['demo', 'Demo clips', 'The animated placeholder videos'],
              ]}
              onChange={(v) => set({ videoSource: v })}
            />
            {s.videoSource === 'catalog' && <CatalogStatus interests={topInterests(p.accounts[p.activeId]).slice(0, 3).map((x) => x.category)} />}
            <Choice
              label="Player address"
              value={s.playerHost}
              options={[
                ['nocookie', 'youtube-nocookie.com', 'YouTube’s privacy-enhanced embeds. Played on school Chromebooks in the playback test; needs the school’s approval before the site is public.'],
                ['youtube', 'youtube.com', 'Standard embeds. Failed with error 152-4 on school Chromebooks.'],
              ]}
              onChange={(v) => set({ playerHost: v })}
            />
            <p className="muted small">
              {s.playerHost === 'nocookie'
                ? 'youtube-nocookie.com is YouTube’s own privacy-enhanced embed address. It doesn’t use your YouTube sign-in, so YouTube restrictions tied to a school account may not apply in it. The school reviews this before the site goes public.'
                : 'Standard youtube.com embeds. On the school Chromebooks these failed with error 152-4 in the playback test.'}
            </p>
            <PreviewKey value={s.catalogPreviewKey} onSave={(k) => set({ catalogPreviewKey: k })} />
            <div className="btn-row">
              <a className="btn btn-ghost btn-sm" href="#/review">
                <ListChecks size={14} /> Review videos
              </a>
              <span className="muted small">Shortlist, reject and approve videos, and export the list for the school. Needs the review key.</span>
            </div>
            <HiddenVideos />
          </Section>

          <Section id="appearance" title="Appearance" icon={Palette}>
            <Choice<ThemeName>
              label="Theme"
              value={s.theme}
              onChange={(v) => withViewTransition(() => set({ theme: v }))}
              options={[
                ['dark', 'Dark'],
                ['dim', 'Dim'],
                ['contrast', 'High contrast'],
              ]}
            />
            <Choice<Density>
              label="Layout density"
              value={s.density}
              onChange={(v) => withViewTransition(() => set({ density: v }))}
              options={[
                ['compact', 'Compact', 'Smaller text and spacing'],
                ['standard', 'Standard'],
                ['expanded', 'Expanded', 'Larger text and spacing'],
              ]}
            />
            <Toggle label="Collapsed sidebar" hint="Icons only on wide screens ([ toggles it anywhere)" checked={s.sidebarCollapsed} onChange={(v) => set({ sidebarCollapsed: v })} />
            <Toggle label="Collapsed sidebar on small screens" hint="Under 1100px wide, where it starts collapsed" checked={s.sidebarCollapsedNarrow} onChange={(v) => set({ sidebarCollapsedNarrow: v })} />
          </Section>

          <Section id="widgets" title="Widgets" icon={LayoutGrid}>
            <p className="muted small">Choose what sits beside the video on desktop. Close a widget with its X; the others take its space. Hide everything for video-only Focus Mode (V).</p>
            <WidgetControls />
          </Section>

          <Section id="feed" title="Feed" icon={SlidersHorizontal}>
            <h3 className="sub">Category preferences</h3>
            <InterestEditor />
            <div className="btn-row">
              <button type="button" className="btn btn-accent btn-sm" onClick={applyInterestChanges}>
                <Check size={14} /> Apply to feeds
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => confirmAction('Reset recommendations?', 'Category weights go back to this account’s starting interests, learned hashtags are forgotten and “Not interested” videos come back.', 'Reset', resetRecommendations, false)}>
                <RotateCcw size={14} /> Reset recommendations
              </button>
            </div>
            <h3 className="sub">Hidden creators</h3>
            {hidden.length ? (
              <ul className="people">
                {hidden.map((id) => {
                  const u = getUser(p, id)!;
                  return (
                    <li key={id} className="person">
                      <span className="person-link">
                        <Avatar user={u} size={30} />
                        <span>
                          <span className="person-name">{u.name}</span>
                          <span className="person-sub">@{u.handle}</span>
                        </span>
                      </span>
                      <button type="button" className="btn btn-xs btn-outline" onClick={(e) => exitThen(e.currentTarget.closest('.person'), () => unhideCreator(id))}>
                        Unhide
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small">None. Use “Hide creator” from any video’s ••• menu.</p>
            )}
            <h3 className="sub">Not interested</h3>
            <p className="muted small">
              {notInt.length ? `${notInt.length} video${notInt.length === 1 ? '' : 's'} hidden: ${notInt.slice(0, 3).map((id) => `“${getVideo(p, id)?.title}”`).join(', ')}${notInt.length > 3 ? '…' : ''}` : 'Nothing marked yet.'}
            </p>
            <h3 className="sub">Viewing history</h3>
            <Toggle label="Pause watch history" hint={`${historyLen} videos in history`} checked={paused} onChange={(v) => setHistoryPaused(v)} />
            <div className="btn-row">
              <a href="#/history" className="btn btn-ghost btn-sm">
                Open history
              </a>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!historyLen} onClick={() => confirmAction('Clear watch history?', 'Removes every video from this account’s history.', 'Clear history', clearHistory)}>
                Clear history
              </button>
            </div>
          </Section>

          <Section id="demo" title="Demo data" icon={Database}>
            <p className="muted small">SirSC Scroll V1 runs on four fictional demo accounts. There are no passwords and nothing leaves this browser; it’s all kept in localStorage.</p>
            <div className="acct-cards">
              {DEMO_IDS.map((id) => {
                const u = getUser(p, id)!;
                const a = p.accounts[id];
                const on = id === p.activeId;
                return (
                  <div key={id} className={`acct-card${on ? ' on' : ''}`}>
                    <Avatar user={u} size={40} />
                    <div>
                      <b>{u.name}</b>
                      <span className="muted small">
                        @{u.handle} · {topInterests(a).slice(0, 3).map((x) => categoryLabel(x.category)).join(', ')}
                      </span>
                      <span className="muted small">
                        {a.liked.length} liked · {a.saved.length} saved · {a.following.length} following
                      </span>
                    </div>
                    {on ? (
                      <span className="pill pill-you">Active</span>
                    ) : (
                      <button type="button" className="btn btn-xs btn-outline" onClick={() => withViewTransition(() => switchAccount(id))}>
                        Switch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => confirmAction(`Reset ${getUser(p, p.activeId)?.name}?`, 'This account’s likes, follows, saves, collections, comments, uploads, drafts, history and notifications go back to how they started.', 'Reset account', () => withViewTransition(() => resetAccount()))}>
                <RotateCcw size={14} /> Reset this account
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => confirmAction('Reset all demo data?', 'All four demo accounts go back to how they started. Settings are kept.', 'Reset everything', () => withViewTransition(resetAll))}>
                <RotateCcw size={14} /> Reset all demo data
              </button>
            </div>
          </Section>

          <Section id="keys" title="Keyboard shortcuts" icon={Keyboard}>
            <ShortcutTable />
            <p className="muted small">Shortcuts pause while you type in a search box or comment.</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openModal({ type: 'shortcuts' })}>
              Open as overlay <kbd>?</kbd>
            </button>
          </Section>
        </div>
      </div>
    </PageShell>
  );
}
