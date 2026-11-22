import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { closeModal } from '../../state/actions';

interface Props {
  title: string;
  children: ReactNode;
  width?: number;
  onClose?: () => void;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ title, children, width = 440, onClose = closeModal, footer, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button:not(.modal-x)');
    first?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);

  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !box.current) return;
    const f = [...box.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute('disabled'));
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} style={{ width }} onKeyDown={trap}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn modal-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
