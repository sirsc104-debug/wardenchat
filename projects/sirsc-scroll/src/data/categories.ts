import type { Category, TemplateKind } from '../state/types';

export interface CategoryInfo {
  id: Category;
  label: string;
  /** Hue used for chips and tiles. */
  hue: number;
  template: TemplateKind;
  blurb: string;
  tags: string[];
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'gaming', label: 'Gaming', hue: 265, template: 'gaming', blurb: 'Clutches, speedruns and patch-day chaos', tags: ['gaming', 'clutch', 'speedrun', 'gamer', 'pcbuild', 'controller', 'patchnotes', 'ranked', 'indiegames'] },
  { id: 'memes', label: 'Memes', hue: 48, template: 'meme', blurb: 'The internet, condensed', tags: ['memes', 'relatable', 'meirl', 'funny', 'shitpost', 'reactions', 'mood', 'lol'] },
  { id: 'sports', label: 'Sports', hue: 140, template: 'sports', blurb: 'Highlights, trick shots and buzzer beaters', tags: ['sports', 'highlights', 'basketball', 'soccer', 'trickshot', 'buzzerbeater', 'gameday', 'athlete'] },
  { id: 'comedy', label: 'Comedy', hue: 350, template: 'comedy', blurb: 'Sketches, bits and stand-up', tags: ['comedy', 'sketch', 'standup', 'skit', 'pov', 'improv', 'funny', 'bit'] },
  { id: 'school', label: 'School', hue: 32, template: 'school', blurb: 'Hallway humor and study hacks', tags: ['school', 'studytok', 'teachersoftiktok', 'finals', 'homework', 'classroom', 'lunchbreak', 'groupproject'] },
  { id: 'technology', label: 'Technology', hue: 200, template: 'tech', blurb: 'Gadgets, code and setups', tags: ['tech', 'coding', 'gadgets', 'setup', 'ai', 'chromebook', 'keyboards', 'howto'] },
  { id: 'music', label: 'Music', hue: 315, template: 'music', blurb: 'Loops, covers and new sounds', tags: ['music', 'cover', 'producer', 'beats', 'piano', 'newmusic', 'bass', 'vocals'] },
  { id: 'animals', label: 'Animals', hue: 95, template: 'animals', blurb: 'Pets doing pet things', tags: ['animals', 'dogs', 'cats', 'pets', 'cute', 'wildlife', 'petsoftiktok', 'rescue'] },
  { id: 'science', label: 'Science', hue: 175, template: 'science', blurb: 'Experiments and explainers', tags: ['science', 'physics', 'chemistry', 'space', 'experiment', 'biology', 'stem', 'didyouknow'] },
  { id: 'trending', label: 'Trending', hue: 12, template: 'trend', blurb: 'Challenges everyone is doing', tags: ['trending', 'challenge', 'dance', 'fyp', 'viral', 'transition', 'trend', 'duet'] },
  { id: 'community', label: 'SirSC', hue: 188, template: 'sirsc', blurb: 'News from SirSC Games, Warden Chat and SirSC AI', tags: ['sirsc', 'sirscgames', 'wardenchat', 'sirscai', 'devlog', 'community', 'sirscscroll'] },
];

export const CATEGORY_IDS: Category[] = CATEGORIES.map((c) => c.id);

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryInfo(id: Category): CategoryInfo {
  return byId.get(id)!;
}

export function categoryLabel(id: Category): string {
  return byId.get(id)?.label ?? id;
}

export function emptyInterests(value = 1): Record<Category, number> {
  const out = {} as Record<Category, number>;
  for (const id of CATEGORY_IDS) out[id] = value;
  return out;
}
