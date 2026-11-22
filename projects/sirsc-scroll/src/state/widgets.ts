// The widget manager: one place that decides which information widgets are on screen.
// Preferences live in Persisted.widgets (device-level, separate from demo-account data).
import type { WidgetId, WidgetPrefs, WidgetSnapshot } from './types';
import { getState, setP, setS } from './store';
import { DEFAULT_WIDGETS, WIDGET_IDS, allVisible } from './widgetDefaults';

export { DEFAULT_WIDGETS, WIDGET_FILL, WIDGET_IDS, WIDGET_LABEL, normalizeWidgets } from './widgetDefaults';

function snap(w: WidgetPrefs): WidgetSnapshot {
  return { visible: { ...w.visible }, expanded: w.expanded };
}

function same(a: WidgetSnapshot, b: WidgetSnapshot): boolean {
  return a.expanded === b.expanded && WIDGET_IDS.every((id) => a.visible[id] === b.visible[id]);
}

function setW(fn: (w: WidgetPrefs) => WidgetPrefs) {
  setP((p) => {
    const next = fn(p.widgets);
    return next === p.widgets ? p : { ...p, widgets: next };
  });
}

/** Replace the visible set, remembering the current one so it can be restored in one click. */
function replaceWith(next: WidgetSnapshot) {
  setW((w) => (same(w, next) ? w : { ...w, ...next, previous: snap(w) }));
}

export function visibleWidgets(w: WidgetPrefs): WidgetId[] {
  return w.order.filter((id) => w.visible[id]);
}

export function showWidget(id: WidgetId) {
  setW((w) => (w.visible[id] ? w : { ...w, visible: { ...w.visible, [id]: true } }));
}

export function hideWidget(id: WidgetId) {
  setW((w) => (!w.visible[id] ? w : { ...w, visible: { ...w.visible, [id]: false }, expanded: w.expanded === id ? null : w.expanded }));
}

export function toggleWidget(id: WidgetId) {
  if (getState().p.widgets.visible[id]) hideWidget(id);
  else showWidget(id);
}

/** Give one widget extra room (toggle). */
export function expandWidget(id: WidgetId) {
  setW((w) => ({ ...w, visible: { ...w.visible, [id]: true }, expanded: w.expanded === id ? null : id }));
}

/** Bring a widget into view: show it if hidden, then highlight it (and focus its input if asked). */
export function focusWidget(id: WidgetId, input = false) {
  showWidget(id);
  setS((s) => ({ ...s, widgetFocus: { id, n: (s.widgetFocus?.n ?? 0) + 1, input } }));
}

/** Focus Mode: hide every optional widget, keeping the old layout for Restore. */
export function hideAllWidgets() {
  replaceWith({ visible: allVisible(false), expanded: null });
}

export function showAllWidgets() {
  replaceWith({ visible: allVisible(true), expanded: null });
}

export function restoreDefaultLayout() {
  setW((w) => {
    const next = { ...w, ...snap(DEFAULT_WIDGETS), order: DEFAULT_WIDGETS.order.slice() };
    return same(w, next) && w.order.join() === next.order.join() ? w : { ...next, previous: snap(w) };
  });
}

/** Swap back to the layout saved by the last Focus Mode / Show all / Default (and keep this one). */
export function restorePreviousLayout() {
  setW((w) => (w.previous ? { ...w, ...w.previous, previous: snap(w) } : w));
}

export function isFocusMode(w: WidgetPrefs): boolean {
  return WIDGET_IDS.every((id) => !w.visible[id]);
}

export function toggleFocusMode() {
  const w = getState().p.widgets;
  if (!isFocusMode(w)) hideAllWidgets();
  else if (w.previous && WIDGET_IDS.some((id) => w.previous!.visible[id])) restorePreviousLayout();
  else restoreDefaultLayout();
}

export function moveWidget(id: WidgetId, dir: -1 | 1) {
  setW((w) => {
    const vis = visibleWidgets(w);
    const at = vis.indexOf(id);
    const swapWith = vis[at + dir];
    if (at < 0 || !swapWith) return w;
    const order = w.order.slice();
    const a = order.indexOf(id);
    const b = order.indexOf(swapWith);
    [order[a], order[b]] = [order[b], order[a]];
    return { ...w, order };
  });
}

export function setCustomizeOpen(open: boolean) {
  setS((s) => (s.customizeOpen === open ? s : { ...s, customizeOpen: open }));
}
