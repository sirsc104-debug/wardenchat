import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CloudUpload, Eye, Globe, Lock, Shuffle, Sparkles, Users, X } from 'lucide-react';
import type { Category, Draft, TemplateKind, Video, Visibility } from '../../state/types';
import { Modal } from '../common/Modal';
import { Placeholder } from '../placeholders/Placeholder';
import { CATEGORY_ICON } from '../common/icons';
import { CATEGORIES, categoryInfo } from '../../data/categories';
import { getState, useAcct, usePersisted } from '../../state/store';
import { closeModal, openList, publishDraft, saveDraft, toast } from '../../state/actions';
import { topInterests, trendingHashtags } from '../../lib/recommend';
import { duration } from '../../lib/format';
import { uid } from '../../lib/rng';
import { href, navigate } from '../../lib/router';
import { getUser } from '../../lib/catalog';
import { exitThen } from '../../lib/motion';

type Step = 'clip' | 'details' | 'cover' | 'publish' | 'processing' | 'done';
const STEPS: [Step, string][] = [
  ['clip', 'Clip'],
  ['details', 'Details'],
  ['cover', 'Cover'],
  ['publish', 'Publish'],
];

const TEMPLATES: [TemplateKind, string][] = [
  ['gaming', 'Gameplay HUD'],
  ['meme', 'Meme captions'],
  ['sports', 'Highlight'],
  ['comedy', 'Stage bit'],
  ['school', 'Classroom'],
  ['tech', 'Screen demo'],
  ['music', 'Waveform'],
  ['animals', 'Pet cam'],
  ['science', 'Diagram'],
  ['trend', 'Dance trend'],
  ['sirsc', 'SirSC'],
];

const GLYPHS = ['✨', '🎮', '😂', '🏀', '🎸', '🐶', '🧪', '📚', '💻', '🔥', '🌈', '🚀'];

function newDraft(): Draft {
  const { p } = getState();
  const top = topInterests(p.accounts[p.activeId])[0]?.category ?? 'memes';
  const info = categoryInfo(top);
  const h = (info.hue + Math.round(Math.random() * 40) - 20 + 360) % 360;
  return {
    id: uid('d'),
    title: '',
    caption: '',
    category: top,
    hashtags: [],
    template: info.template,
    palette: { h1: h, h2: (h + 50) % 360, ac: (h + 180) % 360 },
    glyph: '✨',
    variant: 0,
    frame: 0.5,
    duration: 24,
    visibility: 'public',
    allowComments: true,
    updatedAt: Date.now(),
  };
}

function cleanTag(s: string): string {
  return s.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9]/g, '').slice(0, 24);
}

function preview(d: Draft): Pick<Video, 'template' | 'palette' | 'caption' | 'glyph' | 'variant'> {
  const cap = d.template === 'meme' ? (d.title || 'YOUR CAPTION|GOES HERE').toUpperCase() : (d.title || 'YOUR TITLE').toUpperCase().slice(0, 28);
  return { template: d.template, palette: d.palette, caption: cap, glyph: d.glyph, variant: d.variant };
}

export function UploadDialog({ draftId }: { draftId?: string }) {
  const p = usePersisted();
  const drafts = useAcct((a) => a.drafts);
  const existing = draftId ? drafts.find((d) => d.id === draftId) : undefined;
  const [d, setD] = useState<Draft>(() => existing ?? newDraft());
  const [step, setStep] = useState<Step>('clip');
  const [tagInput, setTagInput] = useState('');
  const [progress, setProgress] = useState(0);
  const [published, setPublished] = useState<Video | null>(null);
  const timers = useRef<number[]>([]);
  const me = getUser(p, p.activeId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hot = useMemo(() => trendingHashtags(p, 6).map((t) => t.tag), [p.userVideos]);
  const suggestedTags = Array.from(new Set([...categoryInfo(d.category).tags, ...hot])).filter((t) => !d.hashtags.includes(t)).slice(0, 10);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const addTag = (raw: string) => {
    const t = cleanTag(raw);
    if (!t || d.hashtags.includes(t) || d.hashtags.length >= 8) return;
    set('hashtags', [...d.hashtags, t]);
  };
  const stepIdx = STEPS.findIndex((s) => s[0] === step);
  const canNext = step !== 'details' || d.title.trim().length > 0;

  const shuffle = () => {
    const h = Math.floor(Math.random() * 360);
    setD((x) => ({ ...x, palette: { h1: h, h2: (h + 30 + Math.floor(Math.random() * 60)) % 360, ac: (h + 160 + Math.floor(Math.random() * 40)) % 360 }, variant: Math.floor(Math.random() * 4) }));
  };

  const doSaveDraft = () => {
    saveDraft({ ...d, title: d.title || 'Untitled draft' });
    toast('Draft saved to Creator Studio');
    closeModal();
  };

  const publish = () => {
    setStep('processing');
    setProgress(0);
    const stages = [18, 44, 71, 92, 100];
    stages.forEach((val, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setProgress(val);
          if (val === 100) {
            const v = publishDraft(d);
            setPublished(v);
            setStep('done');
          }
        }, 320 * (i + 1)),
      );
    });
  };

  const covers = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => ({
        variant: i % 4,
        palette: { h1: (d.palette.h1 + (i >= 4 ? 30 * (i - 3) : 0)) % 360, h2: d.palette.h2, ac: (d.palette.ac + i * 25) % 360 },
      })),
    [d.palette],
  );

  if (step === 'processing' || step === 'done') {
    return (
      <Modal title={step === 'done' ? 'Your video is live' : 'Publishing…'} width={520} onClose={step === 'done' ? closeModal : () => {}}>
        <div className="publish-state">
          <div className="publish-thumb">
            <Placeholder video={preview(d)} running={step === 'done'} />
          </div>
          <div className="publish-info">
            {step === 'processing' ? (
              <>
                <p className="publish-step">{progress < 40 ? 'Uploading (simulated, nothing leaves your browser)…' : progress < 80 ? 'Generating the placeholder clip…' : 'Adding it to feeds…'}</p>
                <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <i style={{ transform: `scaleX(${progress / 100})` }} />
                </div>
                <p className="muted small">{progress}%</p>
              </>
            ) : (
              <>
                <p className="publish-ok">
                  <Check size={16} /> “{published?.title}” is on your profile
                  {d.visibility === 'public' ? ', in Explore and in your followers’ feeds.' : d.visibility === 'friends' ? ' and visible to your friends.' : ' (only you can see it).'}
                </p>
                <p className="muted small">Views and likes are simulated and arrive over the next few minutes. Check Notifications and Studio analytics.</p>
                <div className="publish-actions">
                  <button
                    type="button"
                    className="btn btn-accent btn-sm"
                    onClick={() => {
                      if (!published) return;
                      openList([published.id], published.id, 'Your new video', href.profile(me?.handle ?? ''));
                      closeModal();
                      navigate('#/watch');
                    }}
                  >
                    <Eye size={14} /> Watch it
                  </button>
                  <a className="btn btn-ghost btn-sm" href="#/studio/content" onClick={closeModal}>
                    Open Studio
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setD(newDraft());
                      setPublished(null);
                      setStep('clip');
                    }}
                  >
                    Upload another
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={existing ? 'Edit draft' : 'Upload a video'}
      width={900}
      className="upload"
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={doSaveDraft}>
            Save draft
          </button>
          <span className="foot-spacer" />
          {stepIdx > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(STEPS[stepIdx - 1][0])}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
          {step !== 'publish' ? (
            <button type="button" className="btn btn-accent btn-sm" disabled={!canNext} onClick={() => setStep(STEPS[stepIdx + 1][0])} title={!canNext ? 'Add a title first' : undefined}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" className="btn btn-accent btn-sm" onClick={publish} disabled={!d.title.trim()}>
              <CloudUpload size={14} /> Publish
            </button>
          )}
        </>
      }
    >
      <div className="upload-grid">
        <div className="upload-preview">
          <div className="upload-screen">
            <Placeholder video={preview(d)} running tag handle={me?.handle} />
          </div>
          <p className="upload-cap">
            <b>{d.title || 'Untitled'}</b>
            <span>
              @{me?.handle} · {duration(d.duration)} · {categoryInfo(d.category).label}
            </span>
          </p>
        </div>
        <div className="upload-form">
          <ol className="steps" aria-label="Upload steps">
            {STEPS.map(([id, label], i) => (
              <li key={id} className={i < stepIdx ? 'done' : i === stepIdx ? 'on' : ''}>
                <button type="button" onClick={() => (i <= stepIdx || d.title.trim()) && setStep(id)} disabled={i > stepIdx && !d.title.trim()}>
                  <span>{i < stepIdx ? <Check size={11} /> : i + 1}</span> {label}
                </button>
              </li>
            ))}
          </ol>

          {step === 'clip' && (
            <div className="form">
              <div className="dropzone">
                <CloudUpload size={22} />
                <div>
                  <b>Real video uploads are off in this demo.</b>
                  <span>Pick a generated clip style instead. Nothing is uploaded anywhere.</span>
                </div>
              </div>
              <div className="field">
                <span>Clip style</span>
                <div className="tpl-grid" role="radiogroup" aria-label="Clip style">
                  {TEMPLATES.map(([t, label]) => (
                    <button key={t} type="button" role="radio" aria-checked={d.template === t} className={`tpl${d.template === t ? ' on' : ''}`} onClick={() => set('template', t)}>
                      <span className="tpl-thumb">
                        <Placeholder video={{ ...preview(d), template: t, caption: label.toUpperCase() }} running={false} />
                      </span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <span>Sticker</span>
                  <div className="glyphs" role="radiogroup" aria-label="Sticker">
                    {GLYPHS.map((g) => (
                      <button key={g} type="button" role="radio" aria-checked={d.glyph === g} className={`glyph${d.glyph === g ? ' on' : ''}`} onClick={() => set('glyph', g)}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>
                    Color <em>hue {d.palette.h1}</em>
                  </span>
                  <input type="range" className="hue" min={0} max={359} value={d.palette.h1} onChange={(e) => set('palette', { ...d.palette, h1: Number(e.target.value), h2: (Number(e.target.value) + 50) % 360 })} />
                </label>
                <label className="field">
                  <span>
                    Length <em>{duration(d.duration)}</em>
                  </span>
                  <input type="range" min={5} max={90} value={d.duration} onChange={(e) => set('duration', Number(e.target.value))} />
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={shuffle} data-tap="spin">
                  <Shuffle size={14} /> Shuffle look
                </button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="form">
              <label className="field">
                <span>
                  Title <em>{d.title.length}/80</em>
                </span>
                <input value={d.title} maxLength={80} placeholder="What's this clip about?" onChange={(e) => set('title', e.target.value)} data-autofocus />
              </label>
              <label className="field">
                <span>
                  Caption <em>{d.caption.length}/300</em>
                </span>
                <textarea rows={3} value={d.caption} maxLength={300} placeholder="Add a description. Mention friends with @handle." onChange={(e) => set('caption', e.target.value)} />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  value={d.category}
                  onChange={(e) => {
                    const c = e.target.value as Category;
                    set('category', c);
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>
                  Hashtags <em>{d.hashtags.length}/8</em>
                </span>
                <div className="tag-editor">
                  {d.hashtags.map((t) => (
                    <span key={t} className="tag-chip">
                      #{t}
                      <button type="button" onClick={(e) => exitThen(e.currentTarget.closest('.tag-chip'), () => set('hashtags', d.hashtags.filter((x) => x !== t)))} aria-label={`Remove #${t}`}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    placeholder={d.hashtags.length >= 8 ? 'Limit reached' : 'Add a tag, press Enter'}
                    disabled={d.hashtags.length >= 8}
                    aria-label="Add hashtag"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/[\s,]$/.test(v)) {
                        addTag(v);
                        setTagInput('');
                      } else setTagInput(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(tagInput);
                        setTagInput('');
                      } else if (e.key === 'Backspace' && !tagInput && d.hashtags.length) set('hashtags', d.hashtags.slice(0, -1));
                    }}
                  />
                </div>
                <div className="tag-suggest">
                  {suggestedTags.map((t) => (
                    <button key={t} type="button" className="chip chip-xs" onClick={() => addTag(t)} disabled={d.hashtags.length >= 8}>
                      #{t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'cover' && (
            <div className="form">
              <p className="muted small">Pick the frame people see in grids and Up Next.</p>
              <div className="cover-grid" role="radiogroup" aria-label="Cover frame">
                {covers.map((c, i) => {
                  const on = d.variant === c.variant && d.palette.ac === c.palette.ac && d.palette.h1 === c.palette.h1;
                  return (
                    <button key={i} type="button" role="radio" aria-checked={on} className={`cover${on ? ' on' : ''}`} onClick={() => setD((x) => ({ ...x, variant: c.variant, palette: c.palette, frame: i / 5 }))}>
                      <Placeholder video={{ ...preview(d), variant: c.variant, palette: c.palette }} running={false} />
                      {on && (
                        <span className="cover-check">
                          <Check size={14} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'publish' && (
            <div className="form">
              <div className="field">
                <span>Who can watch</span>
                <div className="radio-cards" role="radiogroup" aria-label="Visibility">
                  {(
                    [
                      ['public', 'Everyone', 'Profile, Explore, For You and your followers’ feeds', Globe],
                      ['friends', 'Friends', 'Only your demo friends', Users],
                      ['private', 'Only me', 'Visible on your profile to you', Lock],
                    ] as [Visibility, string, string, typeof Globe][]
                  ).map(([v, label, sub, Icon]) => (
                    <button key={v} type="button" role="radio" aria-checked={d.visibility === v} className={`radio-card${d.visibility === v ? ' on' : ''}`} onClick={() => set('visibility', v)}>
                      <Icon size={16} />
                      <b>{label}</b>
                      <span>{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="toggle-row">
                <span>
                  <b>Allow comments</b>
                  <em>Viewers can comment and reply</em>
                </span>
                <input type="checkbox" className="switch" checked={d.allowComments} onChange={(e) => set('allowComments', e.target.checked)} />
              </label>
              <div className="summary">
                <p>
                  <Sparkles size={14} /> <b>{d.title || 'Untitled'}</b>
                </p>
                <p className="muted small">
                  {(() => {
                    const Icon = CATEGORY_ICON[d.category];
                    return <Icon size={12} />;
                  })()}{' '}
                  {categoryInfo(d.category).label} · {duration(d.duration)} · {d.hashtags.length ? d.hashtags.map((t) => `#${t}`).join(' ') : 'no hashtags'}
                </p>
                {d.caption && <p className="small">{d.caption}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
