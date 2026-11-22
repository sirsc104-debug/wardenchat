import { memo } from 'react';
import type { User } from '../../state/types';

interface Props {
  user: Pick<User, 'name' | 'avatar'> | undefined;
  size?: number;
  className?: string;
  ring?: boolean;
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Generated avatar: a two-hue gradient disc with initials. */
export const Avatar = memo(function Avatar({ user, size = 36, className = '', ring }: Props) {
  const h1 = user?.avatar.h1 ?? 200;
  const h2 = user?.avatar.h2 ?? 240;
  return (
    <span
      className={`avatar${ring ? ' ring' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: `radial-gradient(circle at 30% 25%, hsl(${h1} 85% 68%), transparent 60%), linear-gradient(135deg, hsl(${h1} 70% 46%), hsl(${h2} 70% 34%))`,
      }}
      aria-hidden="true"
    >
      {initials(user?.name ?? '?')}
    </span>
  );
});
