import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Toast } from '../../state/types';
import { useS } from '../../state/store';
import { dismissToast } from '../../state/actions';

function ToastItem({ t }: { t: Toast }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const leave = useCallback(() => {
    setLeaving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => dismissToast(t.id), 210);
  }, [t.id]);
  useEffect(() => {
    const id = window.setTimeout(leave, t.action ? 5200 : 3200);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(timer.current);
    };
  }, [t, leave]);
  return (
    <div className={`toast${leaving ? ' leaving' : ''}`} role="status">
      <span>{t.text}</span>
      {t.action && (
        <button
          type="button"
          className="toast-act"
          onClick={() => {
            t.action?.();
            leave();
          }}
        >
          {t.actionLabel}
        </button>
      )}
      <button type="button" className="toast-x" onClick={leave} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useS((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
