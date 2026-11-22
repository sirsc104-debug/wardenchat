import { memo, type CSSProperties, type ReactNode } from 'react';
import type { Video } from '../../state/types';

export type PlaceholderVideo = Pick<Video, 'template' | 'palette' | 'caption' | 'glyph' | 'variant'>;

interface Props {
  video: PlaceholderVideo;
  /** Animations run only for the clip that is on screen and playing. */
  running: boolean;
  /** Show the "Simulated clip" tag (the player does; thumbnails don't). */
  tag?: boolean;
  handle?: string;
  speed?: number;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function split(caption: string): [string, string] {
  const [a, b] = caption.split('|');
  return [a ?? '', b ?? ''];
}

function Gaming({ v }: { v: PlaceholderVideo }) {
  const names = ['Raven', 'Bolt', 'Quill', 'Moss'];
  return (
    <>
      <div className="g-sky" />
      <div className="g-sun" />
      <div className="g-floor">
        <div className="g-grid" />
      </div>
      <div className="g-target">
        <i className="g-hp" />
      </div>
      <div className="g-hits">
        <b>-48</b>
        <b>-112</b>
      </div>
      <div className="g-cross" />
      <div className="g-hud">
        <span className="g-name">YOU</span>
        <span className="g-bar hp" />
        <span className="g-bar sh" />
      </div>
      <div className="g-mini">
        <i />
        <i />
        <i />
      </div>
      <ul className="g-feed">
        {names.slice(0, 3).map((n) => (
          <li key={n}>
            YOU <em>✕</em> {n}
          </li>
        ))}
      </ul>
      <div className="g-ammo">
        24<small>/90</small>
      </div>
      <div className="g-abil">
        <i />
        <i />
        <i className="cd" />
      </div>
      <div className="g-banner">{v.caption}</div>
    </>
  );
}

function Meme({ v, handle }: { v: PlaceholderVideo; handle?: string }) {
  const [top, bottom] = split(v.caption);
  return (
    <>
      <div className="m-bg" />
      <div className="m-subject">
        <span>{v.glyph}</span>
      </div>
      {v.variant % 2 === 1 ? (
        <div className="m-band">{[top, bottom].filter(Boolean).join(' ')}</div>
      ) : (
        <>
          <div className="m-top">{top}</div>
          {bottom && <div className="m-bottom">{bottom}</div>}
        </>
      )}
      <div className="m-react">
        <span>😂</span>
        <span>💀</span>
        <span>😭</span>
        <span>🔥</span>
      </div>
      {handle && <div className="m-mark">@{handle}</div>}
    </>
  );
}

function Sports({ v }: { v: PlaceholderVideo }) {
  return (
    <>
      <div className="s-field" />
      <div className="s-lines" />
      <div className="s-goal" />
      <div className="s-players">
        {range(6).map((i) => (
          <i key={i} className={i % 2 ? 'b' : 'a'} />
        ))}
      </div>
      <div className="s-ball">
        <span>{v.glyph}</span>
      </div>
      <div className="s-board">
        <span className="t a">HOME</span>
        <span className="sc">
          <b className="s-flip">
            <i>2</i>
            <i>3</i>
          </b>
          <em>–</em>
          <b>2</b>
        </span>
        <span className="t b">AWAY</span>
        <span className="clk">Q4 · 0:0<b className="s-tick" /></span>
      </div>
      <div className="s-pop">{v.caption}</div>
      <div className="s-replay">REPLAY</div>
    </>
  );
}

function Science({ v }: { v: PlaceholderVideo }) {
  return (
    <>
      <div className="sc-grid" />
      <div className="sc-atom">
        <div className="sc-nuc" />
        {range(3).map((i) => (
          <div key={i} className={`sc-orbit o${i}`}>
            <div className="sc-spin">
              <i />
            </div>
          </div>
        ))}
      </div>
      <svg className="sc-graph" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
        <path className="ax" d="M4 4 V56 H96" />
        <path className="ln" pathLength={100} d="M4 52 C 20 50, 26 20, 40 24 S 60 48, 70 30 S 86 6, 96 8" />
      </svg>
      <div className="sc-flask">
        <i />
        <i />
        <i />
      </div>
      <div className="sc-label l1">fig. {v.variant + 1}</div>
      <div className="sc-label l2">λ = {520 + v.variant * 40} nm</div>
      <div className="sc-cap">{v.caption}</div>
    </>
  );
}

function School({ v }: { v: PlaceholderVideo }) {
  return (
    <>
      <div className="sch-wall" />
      <div className="sch-board">
        <div className="sch-text">{v.caption}</div>
        <div className="sch-math">2 + 2 = ?</div>
        <div className="sch-chalk" />
      </div>
      <div className="sch-clock">
        <i className="h" />
        <i className="m" />
      </div>
      <div className="sch-note">{v.glyph}</div>
      <div className="sch-plane" />
      <div className="sch-desks">
        <i />
        <i />
        <i />
      </div>
      <div className="sch-stamp">A+</div>
    </>
  );
}

function Music({ v }: { v: PlaceholderVideo }) {
  return (
    <>
      <div className="mu-bg" />
      <div className="mu-vinyl">
        <div className="mu-label">{v.glyph}</div>
      </div>
      <div className="mu-wave">
        {range(22).map((i) => (
          <i key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <div className="mu-title">{v.caption}</div>
      <div className="mu-lyric">
        <span>♪ oh-oh, here we go ♪</span>
        <span className="hi" aria-hidden="true">
          ♪ oh-oh, here we go ♪
        </span>
      </div>
      <div className="mu-notes">
        <span>♪</span>
        <span>♫</span>
        <span>♪</span>
      </div>
    </>
  );
}

function Tech({ v }: { v: PlaceholderVideo }) {
  const widths = [62, 44, 78, 36, 58, 70, 28];
  return (
    <>
      <div className="t-bg" />
      <div className="t-win">
        <div className="t-bar">
          <i />
          <i />
          <i />
          <span>main.ts</span>
        </div>
        <div className="t-code">
          {widths.map((w, i) => (
            <p key={i} style={{ '--w': `${w}%`, '--i': i } as CSSProperties}>
              <span />
            </p>
          ))}
          <b className="t-caret" />
        </div>
      </div>
      <div className="t-phone">
        <div className="t-toast">✓ Build passed</div>
        <div className="t-toast t2">{v.glyph} New message</div>
      </div>
      <div className="t-gauge">
        <i />
        <span>CPU</span>
      </div>
      <div className="t-cap">{v.caption}</div>
    </>
  );
}

function Animals({ v }: { v: PlaceholderVideo }) {
  return (
    <>
      <div className="an-sky" />
      <div className="an-sun" />
      <div className="an-cloud c1" />
      <div className="an-cloud c2" />
      <div className="an-hill h1" />
      <div className="an-hill h2" />
      <div className="an-shadow" />
      <div className="an-pet">
        <span>{v.glyph}</span>
      </div>
      <div className="an-paws">
        {range(5).map((i) => (
          <i key={i}>🐾</i>
        ))}
      </div>
      <div className="an-hearts">
        <span>❤</span>
        <span>❤</span>
        <span>❤</span>
      </div>
      <div className="an-cap">{v.caption}</div>
    </>
  );
}

function Comedy({ v }: { v: PlaceholderVideo }) {
  return (
    <>
      <div className="c-wall" />
      <div className="c-spot" />
      <div className="c-curtain l" />
      <div className="c-curtain r" />
      <div className="c-stage" />
      <div className="c-mic">
        <i />
      </div>
      <div className="c-bubble">{v.caption}</div>
      <div className="c-ha">
        <span>HA</span>
        <span>HA!</span>
        <span>HAHA</span>
      </div>
      <div className="c-meter">
        <span>LAUGH METER</span>
        <i />
      </div>
    </>
  );
}

function Trend({ v }: { v: PlaceholderVideo }) {
  return (
    <>
      <div className="tr-bg" />
      <div className="tr-beam b1" />
      <div className="tr-beam b2" />
      <div className="tr-rings">
        <i />
        <i />
        <i />
      </div>
      <div className="tr-dancer">
        <span>{v.glyph}</span>
      </div>
      <div className="tr-count">
        {range(4).map((i) => (
          <i key={i} style={{ '--i': i } as CSSProperties}>
            {i + 1}
          </i>
        ))}
      </div>
      <div className="tr-tag">{v.caption}</div>
      <div className="tr-spark">
        <span>✦</span>
        <span>✦</span>
        <span>✦</span>
      </div>
    </>
  );
}

function Sirsc({ v }: { v: PlaceholderVideo }) {
  const tiles = ['Games', 'Warden Chat', 'SirSC AI', 'Scroll'];
  return (
    <>
      <div className="ss-bg" />
      <div className="ss-scan" />
      <div className="ss-orbit">
        {tiles.map((t, i) => (
          <span key={t} style={{ '--i': i } as CSSProperties}>
            <b>{t}</b>
          </span>
        ))}
      </div>
      <div className="ss-logo">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" />
          <path className="s" d="M40 22c-2-3-5-4-8.5-4-4.5 0-7.5 2.4-7.5 5.8 0 8 16 4.6 16 12.6 0 3.6-3.3 6-8 6-4 0-7-1.6-9-4.6" />
        </svg>
        <i className="ss-ring" />
      </div>
      <div className="ss-glyph">{v.glyph}</div>
      <div className="ss-cap">{v.caption}</div>
      <div className="ss-tag">SirSC ecosystem</div>
    </>
  );
}

function body(v: PlaceholderVideo, handle?: string): ReactNode {
  switch (v.template) {
    case 'gaming':
      return <Gaming v={v} />;
    case 'meme':
      return <Meme v={v} handle={handle} />;
    case 'sports':
      return <Sports v={v} />;
    case 'science':
      return <Science v={v} />;
    case 'school':
      return <School v={v} />;
    case 'music':
      return <Music v={v} />;
    case 'tech':
      return <Tech v={v} />;
    case 'animals':
      return <Animals v={v} />;
    case 'comedy':
      return <Comedy v={v} />;
    case 'trend':
      return <Trend v={v} />;
    case 'sirsc':
      return <Sirsc v={v} />;
  }
}

/** A lightweight animated stand-in for real video footage. */
export const Placeholder = memo(function Placeholder({ video, running, tag, handle, speed = 1 }: Props) {
  const style = {
    '--h1': video.palette.h1,
    '--h2': video.palette.h2,
    '--ac': video.palette.ac,
    '--spd': speed,
  } as CSSProperties;
  return (
    <div className={`ph ph-${video.template} pv${video.variant}`} style={style} data-run={running ? '1' : '0'} aria-hidden="true">
      {body(video, handle)}
      {tag && <span className="ph-tag">Simulated clip</span>}
    </div>
  );
});
