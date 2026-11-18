// Browser storage that never throws. Private windows and previews can refuse it.

export function get(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getJSON(key, fallback = null) {
  try {
    const v = get(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export const setJSON = (key, value) => set(key, JSON.stringify(value));
