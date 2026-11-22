import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { useDismiss } from '../../lib/hooks';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  hint?: string;
  checked?: boolean;
  divider?: boolean;
}

interface Props {
  items: MenuItem[];
  label: string;
  children: ReactNode;
  className?: string;
  /** Preferred side to open towards. */
  placement?: 'below' | 'above' | 'left';
  title?: string;
}

/** Accessible popover menu rendered in a portal so it never gets clipped by scroll containers. */
export function Menu({ items, label, children, className = '', placement = 'below', title }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [btn, pop]);

  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return;
    const r = btn.current.getBoundingClientRect();
    const m = pop.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top: number;
    let left: number;
    if (placement === 'left') {
      left = r.left - m.width - 8;
      top = Math.min(vh - m.height - 8, Math.max(8, r.top + r.height / 2 - m.height / 2));
      if (left < 8) left = Math.min(vw - m.width - 8, r.right + 8);
    } else {
      left = Math.min(vw - m.width - 8, Math.max(8, r.right - m.width));
      const below = r.bottom + 6;
      const above = r.top - m.height - 6;
      top = placement === 'above' ? (above > 8 ? above : below) : below + m.height < vh - 8 ? below : Math.max(8, above);
    }
    setPos({ top, left });
    pop.current.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [open, placement]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...(pop.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={title ?? label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          setPos(null);
        }}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div ref={pop} className="menu" role="menu" aria-label={label} style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }} onKeyDown={onKey}>
            {items.map((it, i) => (
              <div key={i} role="none">
                {it.divider && <hr className="menu-div" />}
                <button
                  type="button"
                  role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                  aria-checked={it.checked}
                  className={`menu-item${it.danger ? ' danger' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    it.onSelect();
                  }}
                >
                  {it.icon && <it.icon size={16} />}
                  <span>{it.label}</span>
                  {it.checked && <span className="menu-check">✓</span>}
                  {it.hint && <kbd>{it.hint}</kbd>}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
