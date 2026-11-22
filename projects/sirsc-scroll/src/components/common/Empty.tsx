import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Empty({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={22} />
      </span>
      <p className="empty-title">{title}</p>
      {children && <p className="empty-body">{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
