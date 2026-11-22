import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Toast } from '../../state/types';
import { useS } from '../../state/store';
import { dismissToast } from '../../state/actions';

function ToastItem({ t }: { t: Toast }) {
  useEffect(() => {
    const id = window.setTimeout(() => dismissToast(t.id), t.action ? 5200 : 3200);
    return () => window.clearTimeout(id);
  }, [t]);
  return (
    <div className="toast" role="status">
      <span>{t.text}</span>
      {t.action && (
        <button
          type="button"
          className="toast-act"
          onClick={() => {
            t.action?.();
            dismissToast(t.id);
          }}
        >
          {t.actionLabel}
        </button>
      )}
      <button type="button" className="toast-x" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
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
