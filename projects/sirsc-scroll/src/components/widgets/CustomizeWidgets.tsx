import { useRef } from 'react';
import { Eye, EyeOff, LayoutGrid, RotateCcw, Undo2 } from 'lucide-react';
import { useP } from '../../state/store';
import { WIDGET_IDS, WIDGET_LABEL, hideAllWidgets, isFocusMode, restoreDefaultLayout, restorePreviousLayout, setCustomizeOpen, showAllWidgets, toggleWidget } from '../../state/widgets';
import { useDismiss } from '../../lib/hooks';

/** Checklist of every widget plus the layout presets. Used in the popover and in Settings. */
export function WidgetControls({ compact }: { compact?: boolean }) {
  const w = useP((p) => p.widgets);
  const focus = isFocusMode(w);
  return (
    <div className={`wctl${compact ? ' compact' : ''}`}>
      <ul className="wctl-list">
        {w.order.map((id) => (
          <li key={id}>
            <label className="wctl-row">
              <span>{WIDGET_LABEL[id]}</span>
              <input type="checkbox" className="switch" checked={w.visible[id]} onChange={() => toggleWidget(id)} aria-label={`Show ${WIDGET_LABEL[id]}`} />
            </label>
          </li>
        ))}
      </ul>
      <div className="wctl-actions">
        <button type="button" className="btn btn-ghost btn-xs" onClick={showAllWidgets} disabled={WIDGET_IDS.every((id) => w.visible[id])}>
          <Eye size={13} /> Show all
        </button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={hideAllWidgets} disabled={focus}>
          <EyeOff size={13} /> Hide all
        </button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={restorePreviousLayout} disabled={!w.previous} title="Go back to the layout before the last Focus Mode, Show all or Default">
          <Undo2 size={13} /> Previous layout
        </button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={restoreDefaultLayout}>
          <RotateCcw size={13} /> Default layout
        </button>
      </div>
    </div>
  );
}

/** The "Customize widgets" button and its popover, beside the feed bar. */
export function CustomizeWidgets({ open }: { open: boolean }) {
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setCustomizeOpen(false), [btn, pop]);
  return (
    <div className="customize">
      <button ref={btn} type="button" className={`fbar-btn${open ? ' on' : ''}`} onClick={() => setCustomizeOpen(!open)} aria-haspopup="dialog" aria-expanded={open} aria-label="Customize widgets" title="Customize widgets">
        <LayoutGrid size={16} />
      </button>
      {open && (
        <div ref={pop} className="customize-pop" role="dialog" aria-label="Customize widgets">
          <p className="customize-head">Widgets beside the video</p>
          <WidgetControls compact />
          <p className="customize-note">Layout is saved in this browser. Press V for video-only Focus Mode.</p>
        </div>
      )}
    </div>
  );
}
