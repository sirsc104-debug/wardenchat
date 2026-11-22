// Turns the widgets on screen into columns. Pure functions, no DOM: FeedView and WidgetArea
// call these with the space they have.
import type { WidgetId } from '../state/types';
import { WIDGET_FILL } from '../state/widgetDefaults';

export type ColumnKey = 'ctx' | 'next' | 'disc';

export interface PlannedColumn {
  key: ColumnKey;
  ids: WidgetId[];
  /** Relative width (flex-grow). 0 while every widget in it is leaving or arriving. */
  weight: number;
  /** Minimum width in px (0 while collapsing). */
  min: number;
  expanded: boolean;
}

// Which column a widget prefers for each column count. Column keys stay stable so a widget that
// stays in its column is never remounted (comments always live in "ctx").
const HOME: Record<1 | 2 | 3, Record<WidgetId, ColumnKey>> = {
  1: { creator: 'ctx', info: 'ctx', stats: 'ctx', comments: 'ctx', upnext: 'ctx', related: 'ctx', friends: 'ctx', discovery: 'ctx' },
  2: { info: 'ctx', comments: 'ctx', creator: 'next', stats: 'next', upnext: 'next', related: 'next', friends: 'next', discovery: 'next' },
  3: { creator: 'ctx', info: 'ctx', comments: 'ctx', stats: 'next', upnext: 'next', friends: 'next', related: 'disc', discovery: 'disc' },
};

const KEYS: ColumnKey[] = ['ctx', 'next', 'disc'];
const BASE: Record<ColumnKey, { weight: number; min: number }> = {
  ctx: { weight: 1.1, min: 300 },
  next: { weight: 1, min: 250 },
  disc: { weight: 1, min: 250 },
};

export const COLUMN_MAX = 500;

export function maxColumnsFor(width: number): 1 | 2 | 3 {
  if (width >= 1000) return 3;
  if (width >= 610) return 2;
  return 1;
}

/**
 * Plan the columns for the widgets being rendered (`ids`, in display order). `live` holds the ones
 * that are fully on screen; the rest are arriving or leaving and take no space yet.
 * A column whose live widgets all size to their content (no fill widget) merges into a neighbour,
 * so no column is left with empty space under a couple of small cards.
 */
export function planColumns(ids: WidgetId[], live: Set<WidgetId>, maxCols: 1 | 2 | 3, expanded: WidgetId | null): PlannedColumn[] {
  const home = HOME[maxCols];
  let cols = KEYS.map((key) => ({ key, ids: ids.filter((id) => home[id] === key) })).filter((c) => c.ids.length);

  // A fill widget that is still arriving or leaving keeps its column, so nothing jumps mid-animation.
  const fills = (c: { ids: WidgetId[] }) => c.ids.some((id) => WIDGET_FILL[id] > 0);
  const lives = (c: { ids: WidgetId[] }) => c.ids.some((id) => live.has(id));
  if (cols.length > 1 && cols.some(fills)) {
    // Merge live columns with no fill widget into the nearest column that has one.
    let changed = true;
    while (changed) {
      changed = false;
      const i = cols.findIndex((c) => lives(c) && !fills(c));
      if (i >= 0 && cols.length > 1) {
        const target = cols[i + 1] && fills(cols[i + 1]) ? i + 1 : cols[i - 1] ? i - 1 : i + 1;
        const t = cols[target];
        t.ids = target > i ? [...cols[i].ids, ...t.ids] : [...t.ids, ...cols[i].ids];
        cols = cols.filter((_, j) => j !== i);
        changed = true;
      }
    }
  } else if (cols.length > 1) {
    // Only small widgets on screen: one column.
    cols = [{ key: cols[0].key, ids: cols.flatMap((c) => c.ids) }];
  }

  return cols.map((c) => {
    const on = lives(c);
    const isExp = !!expanded && c.ids.includes(expanded) && live.has(expanded);
    return {
      key: c.key,
      ids: c.ids,
      weight: on ? BASE[c.key].weight * (isExp && cols.length > 1 ? 1.8 : 1) : 0,
      min: on ? BASE[c.key].min : 0,
      expanded: isExp,
    };
  });
}

/** How wide the widget area wants to be: enough for its columns, never stretched past readability. */
export function preferredRegionWidth(ids: WidgetId[]): number {
  if (!ids.length) return 0;
  const n = planColumns(ids, new Set(ids), 3, null).length;
  return n * COLUMN_MAX + (n - 1) * 10;
}
