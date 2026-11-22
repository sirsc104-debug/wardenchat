import { BadgeCheck } from 'lucide-react';

export function Verified({ size = 14 }: { size?: number }) {
  return <BadgeCheck className="verified" size={size} aria-label="Verified creator" />;
}
