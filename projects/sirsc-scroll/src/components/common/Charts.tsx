import { useId, useMemo, useRef, useState } from 'react';
import { useSize } from '../../lib/hooks';

export interface Point {
  label: string;
  value: number;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
function tick(v: number, max: number): string {
  return max >= 10000 ? compactFmt.format(v) : Math.round(v).toLocaleString('en-US');
}

interface LineProps {
  data: Point[];
  height?: number;
  /** Formats the value in the tooltip, table and end label. */
  format?: (v: number) => string;
  /** Fixed top of the y-axis (e.g. 1 for percentages). */
  max?: number;
  yFormat?: (v: number) => string;
  title: string;
  xLabelEvery?: number;
}

/** Single-series line with a 10% area wash, hairline grid, crosshair tooltip and a table view. */
export function LineChart({ data, height = 180, format = (v) => v.toLocaleString('en-US'), max, yFormat, title, xLabelEvery }: LineProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const { w } = useSize(wrap);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const gid = useId();
  const padL = 44;
  const padR = 14;
  const padT = 12;
  const padB = 24;
  const top = max ?? niceMax(Math.max(...data.map((d) => d.value), 1));
  const iw = Math.max(10, w - padL - padR);
  const ih = height - padT - padB;
  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * iw);
  const y = (v: number) => padT + ih - (v / top) * ih;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('');
  const area = `${path}L${x(data.length - 1).toFixed(1)},${padT + ih}L${padL},${padT + ih}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const every = xLabelEvery ?? Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 70))));
  const last = data.length - 1;
  const active = hover ?? null;

  const pick = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const rel = clientX - r.left - padL;
    const i = Math.round((rel / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(last, i)));
  };

  return (
    <div className="chart">
      {table ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Point</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td>{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={wrap}
          className="chart-plot"
          style={{ height }}
          tabIndex={0}
          role="img"
          aria-label={`${title}. ${data.length} points, latest ${format(data[last]?.value ?? 0)}. Use arrow keys to read values.`}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              e.stopPropagation();
              setHover((h) => Math.max(0, Math.min(last, (h ?? last) + (e.key === 'ArrowRight' ? 1 : -1))));
            }
          }}
        >
          {w > 0 && (
            <svg width={w} height={height} aria-hidden="true">
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--viz-1)" stopOpacity="0.14" />
                  <stop offset="1" stopColor="var(--viz-1)" stopOpacity="0.04" />
                </linearGradient>
              </defs>
              {ticks.map((t, i) => (
                <g key={i}>
                  <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} className="grid" />
                  <text x={padL - 8} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
                    {yFormat ? yFormat(t) : tick(t, top)}
                  </text>
                </g>
              ))}
              {data.map((d, i) =>
                i % every === 0 || i === last ? (
                  <text key={d.label} x={x(i)} y={height - 6} className="axis" textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>
                    {d.label}
                  </text>
                ) : null,
              )}
              <path d={area} fill={`url(#${gid})`} />
              <path d={path} className="line" />
              <circle cx={x(last)} cy={y(data[last]?.value ?? 0)} r={4} className="dot" />
              {active !== null && (
                <>
                  <line x1={x(active)} x2={x(active)} y1={padT} y2={padT + ih} className="cross" />
                  <circle cx={x(active)} cy={y(data[active].value)} r={4.5} className="dot" />
                </>
              )}
            </svg>
          )}
          {w > 0 && active === null && data[last] && (
            <span className="chart-end" style={{ right: padR, top: Math.max(0, y(data[last].value) - 26) }}>
              {format(data[last].value)}
            </span>
          )}
          {active !== null && (
            <div className="tip" style={{ left: Math.min(w - 130, Math.max(0, x(active) - 60)), top: 0 }}>
              <b>{format(data[active].value)}</b>
              <span>{data[active].label}</span>
            </div>
          )}
        </div>
      )}
      <div className="chart-tools">
        <button type="button" className="link-btn" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>
    </div>
  );
}

interface Bar {
  label: string;
  value: number;
  display?: string;
}

/** Ranked horizontal bars, one hue, value at the tip, hover lifts the bar. */
export function BarList({ data, format = (v) => v.toLocaleString('en-US'), title }: { data: Bar[]; format?: (v: number) => string; title: string }) {
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);
  return (
    <ul className="barlist" aria-label={title}>
      {data.map((d) => (
        <li key={d.label} tabIndex={0} title={`${d.label}: ${d.display ?? format(d.value)}`}>
          <span className="barlist-label">{d.label}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${Math.max(1.5, (d.value / max) * 100)}%` }} />
            <span className="barlist-val">{d.display ?? format(d.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 12-ish point sparkline: de-emphasis ink, latest point in the accent. */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 6);
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg className="spark" width={width} height={height} aria-hidden="true">
      <path d={d} />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} />
    </svg>
  );
}

export function StatTile({ label, value, delta, trend, upIsGood = true }: { label: string; value: string; delta?: number; trend?: number[]; upIsGood?: boolean }) {
  const dir = delta === undefined || Math.abs(delta) < 0.005 ? 0 : delta > 0 ? 1 : -1;
  const good = dir === 0 ? null : (dir > 0) === upIsGood;
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-foot">
        {delta !== undefined && (
          <span className={`stat-delta${good === null ? '' : good ? ' good' : ' bad'}`}>
            {dir > 0 ? '▲' : dir < 0 ? '▼' : '•'} {Math.abs(Math.round(delta * 100))}% <span className="muted">vs previous</span>
          </span>
        )}
        {trend && <Sparkline values={trend} />}
      </span>
    </div>
  );
}
