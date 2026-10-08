// Shared helpers: seeded random numbers, number formatting, colour maths and iso maths.
(function (G) {
  'use strict';

  // Mulberry32: small, fast, deterministic. Battles must replay identically.
  function makeRng(seed) {
    let a = seed >>> 0;
    const rng = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    return rng;
  }

  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function fmt(n) {
    n = Math.floor(n);
    if (n < 10000) return n.toLocaleString('en-US');
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'K';
    if (n < 1e9) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + 's';
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (d) return d + 'd ' + (h ? h + 'h' : '');
    if (h) return h + 'h ' + (m ? m + 'm' : '');
    return m + 'm' + (s ? ' ' + s + 's' : '');
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  // Distance from a point to the nearest edge of a square footprint (0 when inside).
  function distToRect(px, py, x, y, w, h) {
    const dx = Math.max(x - px, 0, px - (x + w));
    const dy = Math.max(y - py, 0, py - (y + h));
    return Math.sqrt(dx * dx + dy * dy);
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  // amt in -1..1: negative darkens, positive lightens.
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
  }
  function rgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Isometric projection. Tiles are TW x TH pixels at zoom 1.
  const TW = 64, TH = 32;
  function isoX(x, y) { return (x - y) * TW / 2; }
  function isoY(x, y) { return (x + y) * TH / 2; }

  // Ten-symbol base codes, no look-alike characters (0/O, 1/I/L).
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function makeBaseCode() {
    let s = '';
    const buf = new Uint32Array(10);
    (globalThis.crypto || { getRandomValues: (b) => b.map(() => Math.random() * 2 ** 32) }).getRandomValues(buf);
    for (let i = 0; i < 10; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return s;
  }
  function normalizeCode(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function prettyCode(c) { return c.slice(0, 5) + '-' + c.slice(5); }

  G.U = {
    makeRng, hashString, fmt, fmtTime, clamp, lerp, dist, distToRect,
    shade, mix, rgba, hexToRgb, TW, TH, isoX, isoY,
    CODE_ALPHABET, makeBaseCode, normalizeCode, prettyCode,
  };
})(globalThis.SOTP = globalThis.SOTP || {});
