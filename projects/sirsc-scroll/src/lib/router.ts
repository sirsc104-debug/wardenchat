// Minimal router over "#/path/segments?query" strings.
// Normal pages keep the route in location.hash (works from file:// and offline).
// It's kept in memory instead, with in-app "#/..." links routed here, in two cases:
// - the claude.ai Artifact build (__MEMORY_ROUTER__): the artifact frame only passes plain "#name"
//   hashes; it still reads a plain "#name" on load;
// - a frame with no address of its own, like a Google Sites embed (about:srcdoc or about:blank). Its
//   links resolve against the host page's address, so clicking href="#/explore" would navigate the
//   frame to the host page (which Google Sites refuses to show in a frame) instead of changing the hash.
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string[];
  query: URLSearchParams;
  hash: string;
}

/** True in a document whose links don't resolve against its own address (about:srcdoc, about:blank embeds). */
function borrowedAddress(): boolean {
  if (typeof location === 'undefined' || typeof document === 'undefined') return false;
  if (location.protocol === 'about:') return true;
  try {
    return document.baseURI.split('#')[0] !== location.href.split('#')[0];
  } catch {
    return false;
  }
}

const MEMORY = (typeof __MEMORY_ROUTER__ !== 'undefined' && __MEMORY_ROUTER__) || borrowedAddress();
const PLAIN_ROUTES = ['explore', 'following', 'trending', 'notifications', 'history', 'saved'];

/** "#video-v010" → "#/video/v010", "#explore" → "#/explore". */
function fromPlainHash(h: string): string {
  if (h.startsWith('#/')) return h;
  const name = h.replace(/^#/, '');
  const video = name.match(/^video-([a-z0-9]+)$/i);
  if (video) return `#/video/${video[1]}`;
  if (PLAIN_ROUTES.includes(name)) return `#/${name}`;
  return '#/';
}

let memHash = MEMORY ? fromPlainHash(typeof location !== 'undefined' ? location.hash : '') : '';
const memListeners = new Set<() => void>();

function currentHash(): string {
  return MEMORY ? memHash : location.hash;
}

let cachedHash = '\0';
let cached: Route = { path: [], query: new URLSearchParams(), hash: '' };

function read(): Route {
  const hash = currentHash();
  if (hash === cachedHash) return cached;
  cachedHash = hash;
  const raw = hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  cached = {
    path: p
      .split('/')
      .filter(Boolean)
      .map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      }),
    query: new URLSearchParams(q),
    hash,
  };
  return cached;
}

function subscribe(cb: () => void) {
  if (MEMORY) {
    memListeners.add(cb);
    return () => {
      memListeners.delete(cb);
    };
  }
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, read, read);
}

export function getRoute(): Route {
  return read();
}

export function navigate(to: string, replace = false) {
  const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
  if (MEMORY) {
    if (memHash === target) return;
    memHash = target;
    memListeners.forEach((l) => l());
    return;
  }
  if (replace) {
    try {
      history.replaceState(null, '', target);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch {
      location.replace(target);
    }
  } else if (location.hash !== target) {
    location.hash = target;
  }
}

// In memory mode, in-app links (<a href="#/...">) are routed here instead of changing the URL.
if (MEMORY && typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    navigate(a.getAttribute('href') || '#/');
  });
}

export const isMemoryRouter = MEMORY;

export const href = {
  feed: (kind: string) => (kind === 'foryou' ? '#/' : `#/${kind}`),
  video: (id: string) => `#/video/${id}`,
  profile: (handle: string, tab?: string) => `#/profile/${encodeURIComponent(handle)}${tab ? `/${tab}` : ''}`,
  explore: (q?: string) => (q ? `#/explore?q=${encodeURIComponent(q)}` : '#/explore'),
  category: (cat: string) => `#/explore?cat=${cat}`,
  tag: (tag: string) => `#/tag/${encodeURIComponent(tag)}`,
  saved: (col?: string) => (col ? `#/saved/${col}` : '#/saved'),
};
