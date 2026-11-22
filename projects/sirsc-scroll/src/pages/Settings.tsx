import { useEffect, type ReactNode } from 'react';
import { Check, Database, Eye, Keyboard, LayoutGrid, MonitorPlay, Palette, RotateCcw, SlidersHorizontal } from 'lucide-react';
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
            <Toggle label="Autoplay simulated videos" hint="Start each clip as soon as it’s on screen" checked={s.autoplay} onChange={(v) => set({ autoplay: v })} />
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
