// Widget ids, labels and default layout. No store imports, so persist.ts can use it safely.
import type { WidgetId, WidgetPrefs } from './types';

export const WIDGET_IDS: WidgetId[] = ['creator', 'info', 'comments', 'stats', 'upnext', 'related', 'friends', 'discovery'];

export const WIDGET_LABEL: Record<WidgetId, string> = {
  creator: 'Creator',
  info: 'Video information',
  stats: 'Video statistics',
  comments: 'Comments',
  upnext: 'Up next',
  related: 'Related videos',
  friends: 'Friends’ activity',
  discovery: 'Discovery',
};

/** Content widgets size to what they hold; fill widgets share whatever height is left. */
export const WIDGET_FILL: Record<WidgetId, number> = {
  creator: 0,
  info: 0,
  stats: 0,
  comments: 3,
  upnext: 1.2,
  related: 1.5,
  friends: 1,
  discovery: 1.2,
};

export function allVisible(v: boolean): Record<WidgetId, boolean> {
  return Object.fromEntries(WIDGET_IDS.map((id) => [id, v])) as Record<WidgetId, boolean>;
}

export const DEFAULT_WIDGETS: WidgetPrefs = {
  order: WIDGET_IDS.slice(),
  visible: { ...allVisible(true), stats: false, friends: false, discovery: false },
  expanded: null,
  previous: null,
};

/** Fill in anything missing from a saved layout (new widgets, older saves). */
export function normalizeWidgets(w: Partial<WidgetPrefs> | undefined): WidgetPrefs {
  const order = (w?.order ?? []).filter((id) => WIDGET_IDS.includes(id));
  for (const id of WIDGET_IDS) if (!order.includes(id)) order.push(id);
  const visible = { ...DEFAULT_WIDGETS.visible, ...(w?.visible ?? {}) };
  const expanded = w?.expanded && WIDGET_IDS.includes(w.expanded) ? w.expanded : null;
  return { order, visible, expanded, previous: w?.previous ?? null };
}

