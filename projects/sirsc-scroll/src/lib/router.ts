// Minimal hash router: #/path/segments?query. Works from file://, inside embeds, and offline.
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string[];
  query: URLSearchParams;
  hash: string;
}

let cachedHash = '\0';
let cached: Route = { path: [], query: new URLSearchParams(), hash: '' };

function read(): Route {
  const hash = location.hash;
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
  if (replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (location.hash !== target) {
    location.hash = target;
  }
}

export const href = {
  feed: (kind: string) => (kind === 'foryou' ? '#/' : `#/${kind}`),
  video: (id: string) => `#/video/${id}`,
  profile: (handle: string, tab?: string) => `#/profile/${encodeURIComponent(handle)}${tab ? `/${tab}` : ''}`,
  explore: (q?: string) => (q ? `#/explore?q=${encodeURIComponent(q)}` : '#/explore'),
  category: (cat: string) => `#/explore?cat=${cat}`,
  tag: (tag: string) => `#/tag/${encodeURIComponent(tag)}`,
  saved: (col?: string) => (col ? `#/saved/${col}` : '#/saved'),
};
