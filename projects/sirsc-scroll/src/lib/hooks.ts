import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';

/* ---------- viewport (one shared resize listener) */
let vp = { w: typeof window !== 'undefined' ? window.innerWidth : 1366, h: typeof window !== 'undefined' ? window.innerHeight : 768 };
const vpListeners = new Set<() => void>();
let vpRaf = 0;
function onResize() {
  cancelAnimationFrame(vpRaf);
  vpRaf = requestAnimationFrame(() => {
    if (vp.w === window.innerWidth && vp.h === window.innerHeight) return;
    vp = { w: window.innerWidth, h: window.innerHeight };
    vpListeners.forEach((l) => l());
  });
}
function subscribeVp(l: () => void) {
  if (!vpListeners.size) window.addEventListener('resize', onResize);
  vpListeners.add(l);
  return () => {
    vpListeners.delete(l);
    if (!vpListeners.size) window.removeEventListener('resize', onResize);
  };
}
export function useViewport() {
  return useSyncExternalStore(subscribeVp, () => vp, () => vp);
}

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';
export function layoutFor(w: number, h: number): LayoutMode {
  if (w < 720 || (w < 900 && h > w * 1.15)) return 'mobile';
  if (w < 1100) return 'tablet';
  return 'desktop';
}
export function useLayout(): LayoutMode {
  const { w, h } = useViewport();
  return layoutFor(w, h);
}

/* ---------- a shared clock for relative times and scheduled notifications */
let nowVal = Date.now();
const nowListeners = new Set<() => void>();
let nowTimer: number | undefined;
function subscribeNow(l: () => void) {
  if (!nowListeners.size) {
    nowTimer = window.setInterval(() => {
      nowVal = Date.now();
      nowListeners.forEach((x) => x());
    }, 15_000);
  }
  nowListeners.add(l);
  return () => {
    nowListeners.delete(l);
    if (!nowListeners.size) window.clearInterval(nowTimer);
  };
}
export function useNow(): number {
  return useSyncExternalStore(subscribeNow, () => nowVal, () => nowVal);
}

/* ---------- element size via ResizeObserver */
export function useSize<T extends HTMLElement>(ref: RefObject<T | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/* ---------- close popovers on outside click / Escape */
export function useDismiss(open: boolean, close: () => void, refs: RefObject<HTMLElement | null>[]) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
    // refs are stable objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** True when keyboard shortcuts should be ignored because the user is typing. */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
