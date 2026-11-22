import {
  Cpu,
  Drama,
  FlaskConical,
  Flame,
  Gamepad2,
  GraduationCap,
  Laugh,
  Music2,
  PawPrint,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '../../state/types';

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  gaming: Gamepad2,
  memes: Laugh,
  sports: Trophy,
  comedy: Drama,
  school: GraduationCap,
  technology: Cpu,
  music: Music2,
  animals: PawPrint,
  science: FlaskConical,
  trending: Flame,
  community: Sparkles,
};
