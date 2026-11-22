// App-wide motion layer. One delegated pointer listener and one MutationObserver give every
// control feedback without each component wiring it up:
//  - tap: anything clickable squishes and springs back when pressed;
//  - swap: a toggle pops when its state (aria-pressed) or its icon changes;
//  - tick: counters roll when their number changes;
//  - gliders: selection highlights slide between tabs, chips, nav items and options.
// Everything uses the Web Animations API on the independent `scale`/`translate` properties or on
// a dedicated glider element, so it never fights a component's own transforms or transitions.
import { flushSync } from 'react-dom';

export const EASE = 'cubic-bezier(0.25, 0.8, 0.25, 1)';
export const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export function reducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/* ---------------------------------------------------------------- tap */

const TAPPABLE = 'button, a[href], [role="tab"], [role="menuitem"], [role="option"], label.check-row, label.toggle-row, label.wctl-row, select, summary, input[type="checkbox"], input[type="radio"]';

function tapScale(el: Element): number {
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  if (size < 60) return 0.86;
  if (size < 140) return 0.93;
  if (size < 320) return 0.97;
  return 0.985;
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || reducedMotion()) return;
  const el = (e.target as Element | null)?.closest?.(TAPPABLE) as HTMLElement | null;
  if (!el || el.closest('[data-no-tap], .timeline') || (el as HTMLButtonElement).disabled) return;
  const s = tapScale(el);
  el.animate([{ scale: '1' }, { scale: String(s), offset: 0.35 }, { scale: '1' }], { duration: 340, easing: 'ease-out' });
  // The icon inside reacts to what it means: refresh spins, send flies, arrows nudge, hearts pop.
  const icon = el.querySelector('svg');
  if (!icon) return;
  const cls = icon.getAttribute('class') ?? '';
  const has = (...names: string[]) => names.some((n) => cls.includes(`lucide-${n} `) || cls.endsWith(`lucide-${n}`));
  const nudge = (x: number, y: number) => icon.animate([{ translate: '0 0' }, { translate: `${x}px ${y}px`, offset: 0.4 }, { translate: '0 0' }], { duration: 360, easing: EASE });
  if (el.dataset.tap === 'spin' || has('rotate-ccw', 'refresh-cw', 'undo-2', 'shuffle', 'rotate-cw', 'settings')) icon.animate([{ rotate: '0deg' }, { rotate: has('rotate-ccw', 'undo-2') ? '-360deg' : '360deg' }], { duration: 640, easing: EASE });
  else if (has('send')) nudge(5, -5);
  else if (has('arrow-left', 'chevron-left')) nudge(-4, 0);
  else if (has('chevron-right', 'arrow-right')) nudge(4, 0);
  else if (has('chevron-up', 'arrow-up')) nudge(0, -4);
  else if (has('chevron-down', 'arrow-down')) nudge(0, 4);
  else if (has('heart', 'bookmark', 'plus', 'check', 'copy', 'link-2', 'link', 'flag', 'thumbs-down', 'eye-off', 'trash-2', 'x', 'bell', 'search', 'upload', 'cloud-upload', 'focus', 'layout-grid', 'maximize-2', 'minimize-2', 'pencil', 'play', 'pause'))
    icon.animate([{ scale: '1' }, { scale: '1.3', offset: 0.4 }, { scale: '1' }], { duration: 380, easing: SPRING });
  else icon.animate([{ rotate: '0deg' }, { rotate: '-8deg', offset: 0.3 }, { rotate: '6deg', offset: 0.65 }, { rotate: '0deg' }], { duration: 420, easing: EASE });
}

/* ---------------------------------------------------------------- swap & tick */

function swap(el: Element) {
  if (reducedMotion()) return;
  el.animate([{ scale: '0.8', opacity: 0.55 }, { scale: '1.08', opacity: 1, offset: 0.6 }, { scale: '1', opacity: 1 }], { duration: 360, easing: EASE });
}

const TICK = '.rail-n, .stat b, .seg-n, .nav-badge, .top-bell-n, .m-badge, .comment-like span, .stat-value, .interest-pct, .w-extra, .sc-speed, .cw-count, .rail-pos, .pill-hot, .profile-stats b, .mini-stats b, .barlist-val, .comments-head h3 span, .vthumb-stat';

const ticking = new WeakSet<Element>();
function tick(el: Element) {
  if (reducedMotion() || ticking.has(el)) return;
  ticking.add(el);
  const a = el.animate([{ translate: '0 45%', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 300, easing: SPRING });
  a.onfinish = a.oncancel = () => ticking.delete(el);
}

/* ---------------------------------------------------------------- gliders */

interface GliderSpec {
  container: string;
  active: string;
  kind: string;
}

const GLIDERS: GliderSpec[] = [
  { container: '.seg', active: ':scope > [aria-selected="true"], :scope > [aria-checked="true"], :scope > [aria-pressed="true"]', kind: 'pill' },
  { container: '.tabs-line', active: ':scope > .on', kind: 'line' },
  { container: '.m-tabs', active: ':scope > .on', kind: 'line' },
  { container: '.sb-scroll', active: '.nav-item.on', kind: 'nav' },
  { container: '.saved-nav', active: ':scope > .on', kind: 'soft' },
  { container: '.settings-nav', active: ':scope > .on', kind: 'soft' },
  { container: '.chips', active: ':scope > .chip.on', kind: 'chip' },
  { container: '.radio-cards', active: ':scope > .on', kind: 'ring' },
  { container: '.cover-grid', active: ':scope > .on', kind: 'ring' },
  { container: '.tpl-grid', active: ':scope > .on .tpl-thumb', kind: 'ring' },
  { container: '.glyphs', active: ':scope > .on', kind: 'ring' },
  { container: '.swatches', active: ':scope > [aria-checked="true"]', kind: 'ring-round' },
  { container: '.steps', active: 'li.on button', kind: 'pill' },
  { container: '.m-nav', active: ':scope > a.on', kind: 'dot' },
];

const gliderOf = new WeakMap<HTMLElement, HTMLElement>();
const observed = new WeakSet<HTMLElement>();
let ro: ResizeObserver | null = null;

function place(container: HTMLElement, spec: GliderSpec) {
  let g = gliderOf.get(container);
  if (!g || !g.isConnected || g.parentElement !== container) {
    g = document.createElement('span');
    g.className = `glider g-${spec.kind}`;
    g.setAttribute('aria-hidden', 'true');
    container.appendChild(g);
    container.classList.add('has-glider');
    gliderOf.set(container, g);
  }
  if (!observed.has(container)) {
    observed.add(container);
    ro?.observe(container);
  }
  const target = container.querySelector<HTMLElement>(spec.active);
  if (!target) {
    g.style.opacity = '0';
    return;
  }
  const c = container.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  if (!t.width) return;
  const x = t.left - c.left - container.clientLeft + container.scrollLeft;
  const y = t.top - c.top - container.clientTop + container.scrollTop;
  const first = !g.dataset.ready;
  if (first || reducedMotion()) g.style.transition = 'none';
  g.style.width = `${t.width}px`;
  g.style.height = `${t.height}px`;
  g.style.transform = `translate(${x}px, ${y}px)`;
  g.style.opacity = '1';
  if (first || reducedMotion()) {
    void g.offsetWidth;
    g.style.transition = '';
    g.dataset.ready = '1';
  }
}

let raf = 0;
function scheduleGliders() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    for (const spec of GLIDERS) document.querySelectorAll<HTMLElement>(spec.container).forEach((c) => place(c, spec));
  });
}

/* ---------------------------------------------------------------- observer */

function onMutations(list: MutationRecord[]) {
  let gliders = false;
  for (const m of list) {
    if (m.type === 'characterData') {
      const host = m.target.parentElement?.closest(TICK);
      if (host) tick(host);
      continue;
    }
    const t = m.target as HTMLElement;
    if (m.type === 'attributes') {
      gliders = true;
      if (m.attributeName === 'aria-pressed' && t.matches('button, [role="button"]') && !t.matches('.rail-btn.like') && t.isConnected) swap(t);
      continue;
    }
    // childList
    if (m.addedNodes.length) {
      gliders = true;
      for (const n of m.addedNodes) {
        if (n.nodeType === 3) {
          const host = t.closest?.(TICK);
          if (host) tick(host);
        } else if ((n as Element).tagName === 'svg' && t.matches?.('button, a')) {
          // An icon was swapped (play/pause, mute, expand, chevrons...): pop the new one in.
          swap(n as Element);
        }
      }
    }
  }
  if (gliders) scheduleGliders();
}

let started = false;
export function initMotion() {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  const mo = new MutationObserver(onMutations);
  mo.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'aria-pressed', 'aria-selected', 'aria-checked'],
  });
  ro = new ResizeObserver(scheduleGliders);
  window.addEventListener('resize', scheduleGliders);
  scheduleGliders();
}

/* ---------------------------------------------------------------- helpers for components */

/** Animate an element away (fade, shrink, fold its height), then run the state change. */
export function exitThen(el: Element | null | undefined, then: () => void) {
  if (!el || reducedMotion()) return then();
  const h = (el as HTMLElement).getBoundingClientRect().height;
  (el as HTMLElement).style.overflow = 'hidden';
  const a = el.animate(
    [
      { opacity: 1, scale: '1', height: `${h}px` },
      { opacity: 0, scale: '0.96', height: `${h}px`, offset: 0.55 },
      { opacity: 0, scale: '0.96', height: '0px', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' },
    ],
    { duration: 300, easing: EASE, fill: 'forwards' },
  );
  a.onfinish = () => {
    then();
    // If the element survived the change (nothing removed it), put it back.
    requestAnimationFrame(() => {
      if (el.isConnected) {
        a.cancel();
        (el as HTMLElement).style.overflow = '';
      }
    });
  };
}

/** FLIP: run a state change, then slide every child of `container` from where it was. */
export function flipChildren(container: Element | null | undefined, change: () => void) {
  if (!container || reducedMotion()) return change();
  const before = new Map<Element, DOMRect>();
  for (const c of container.querySelectorAll(':scope > *')) before.set(c, c.getBoundingClientRect());
  flushSync(change);
  for (const c of container.querySelectorAll(':scope > *')) {
    const b = before.get(c);
    const a = c.getBoundingClientRect();
    if (!b) {
      c.animate([{ opacity: 0, scale: '0.94' }, { opacity: 1, scale: '1' }], { duration: 280, easing: EASE });
      continue;
    }
    const dx = b.left - a.left;
    const dy = b.top - a.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) c.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 320, easing: EASE });
  }
}

/** Cross-fade the whole app through a big change (account switch, theme), where supported. */
export function withViewTransition(change: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || reducedMotion()) return change();
  doc.startViewTransition(() => flushSync(change));
}

/** Smoothly animate an element's height between renders (show more, replies...). */
export function tweenHeight(el: HTMLElement | null, from: number | null) {
  if (!el || from === null || reducedMotion()) return;
  const to = el.getBoundingClientRect().height;
  if (Math.abs(to - from) < 2) return;
  el.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${to}px`, overflow: 'hidden' }], { duration: 300, easing: EASE });
}
