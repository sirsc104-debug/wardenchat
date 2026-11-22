import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Ellipsis, EyeOff, Maximize2, Minimize2, SlidersHorizontal, X, type LucideIcon } from 'lucide-react';
import type { WidgetId } from '../../state/types';
import { Menu, type MenuItem } from '../common/Menu';
import { useS } from '../../state/store';
import { WIDGET_FILL, WIDGET_LABEL, expandWidget, hideWidget, moveWidget, setCustomizeOpen } from '../../state/widgets';

export type Phase = 'entering' | 'shown' | 'leaving';

interface Props {
  id: WidgetId;
  icon: LucideIcon;
  phase: Phase;
  expanded: boolean;
  /** Small text or controls beside the title. */
  extra?: ReactNode;
  /** The body manages its own scrolling (comments). */
  selfScroll?: boolean;
  /** Smallest useful height in px. */
  min: number;
  /** Re-run the fade when this changes (the current video). */
  contentKey: string;
  children: ReactNode;
  first: boolean;
  last: boolean;
}

/** One closable, expandable widget. Layout (columns, sizes) comes from WidgetArea. */
export function Widget({ id, icon: Icon, phase, expanded, extra, selfScroll, min, contentKey, children, first, last }: Props) {
  const box = useRef<HTMLElement>(null);
  const focus = useS((s) => s.widgetFocus);
  const [pulse, setPulse] = useState(false);
  const seen = useRef(focus?.n ?? 0);
  const fill = WIDGET_FILL[id];
  const label = WIDGET_LABEL[id];

  // A video control asked for this widget: bring it into view, highlight it, maybe focus its input.
  useEffect(() => {
    if (!focus || focus.n === seen.current) return;
    seen.current = focus.n;
    if (focus.id !== id) return;
    const wait = phase === 'shown' ? 30 : 300;
    const t = window.setTimeout(() => {
      const el = box.current;
      if (!el) return;
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setPulse(true);
      if (focus.input) el.querySelector<HTMLElement>('textarea, input')?.focus({ preventScroll: true });
    }, wait);
    const off = window.setTimeout(() => setPulse(false), wait + 900);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(off);
    };
  }, [focus, id, phase]);

  const items: MenuItem[] = [
    { label: expanded ? 'Default size' : 'Give it more room', icon: expanded ? Minimize2 : Maximize2, onSelect: () => expandWidget(id) },
    ...(!first ? [{ label: 'Move up', icon: ArrowUp, onSelect: () => moveWidget(id, -1) }] : []),
    ...(!last ? [{ label: 'Move down', icon: ArrowDown, onSelect: () => moveWidget(id, 1) }] : []),
    { label: 'Customize widgets…', icon: SlidersHorizontal, onSelect: () => setCustomizeOpen(true), divider: true },
    { label: `Hide ${label.toLowerCase()}`, icon: EyeOff, onSelect: () => hideWidget(id) },
  ];

  const style = { '--wmin': `${min}px`, '--grow': fill ? (expanded ? fill * 4 : fill) : expanded ? 3 : 0 } as CSSProperties;
  return (
    <section ref={box} className={`widget w-${id} ${fill ? 'fill' : 'fit'} ${phase}${expanded ? ' expanded' : ''}${pulse ? ' pulse' : ''}`} style={style} aria-label={label} data-widget={id}>
      <header className="w-head">
        <span className="w-ico">
          <Icon size={14} />
        </span>
        <h2 className="w-title">{label}</h2>
        {extra && <span className="w-extra">{extra}</span>}
        <span className="w-tools">
          <button type="button" className="w-btn" onClick={() => expandWidget(id)} aria-label={expanded ? `Shrink ${label}` : `Expand ${label}`} title={expanded ? 'Default size' : 'More room'} aria-pressed={expanded}>
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <Menu className="w-btn" label={`${label} options`} items={items}>
            <Ellipsis size={14} />
          </Menu>
          <button type="button" className="w-btn w-close" onClick={() => hideWidget(id)} aria-label={`Close ${label}`} title="Close">
            <X size={14} />
          </button>
        </span>
      </header>
      <div className={`w-body${selfScroll ? ' self' : ''}`}>
        <div className="w-fade" key={contentKey}>
          {children}
        </div>
      </div>
    </section>
  );
}
