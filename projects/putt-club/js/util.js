/* Putt Club: shared math and 2D geometry.
   Courses are designed on paper in (x, y): x to the right, y forward from the tee.
   The renderer maps that to three.js as (x, height, -y). Everything hangs off window.PC. */
(function (mod) { const PC = window.PC = window.PC || {}; mod(PC); (PC.SRC = PC.SRC || []).push(mod); })(function (PC) {
  'use strict';
  const U = PC.U = {};
  const TAU = U.TAU = Math.PI * 2;

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  U.ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.dEase = t => (t < 0.5 ? 4 * t : 4 * (1 - t));
  U.wrapAngle = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

  // Seeded random numbers (mulberry32), so decorations land in the same places every time.
  U.rng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  U.shuffle = (arr, rnd) => { const a = arr.slice(); rnd = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  U.inPoly = (x, y, P) => {
    let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  U.closestOnSeg = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return [ax + dx * t, ay + dy * t, t];
  };

  U.distToPoly = (x, y, P, closed = true) => {
    let best = Infinity;
    const n = closed ? P.length : P.length - 1;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const c = U.closestOnSeg(x, y, a[0], a[1], b[0], b[1]);
      const d = Math.hypot(x - c[0], y - c[1]);
      if (d < best) best = d;
    }
    return best;
  };

  // Nearest point on an open polyline, with the direction of travel there and the distance along it.
  U.polyInfo = (px, py, L) => {
    let best = Infinity, bx = 0, by = 0, tx = 0, ty = 1, acc = 0, along = 0;
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i], b = L[i + 1];
      const sl = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const c = U.closestOnSeg(px, py, a[0], a[1], b[0], b[1]);
      const d = Math.hypot(px - c[0], py - c[1]);
      if (d < best) { best = d; bx = c[0]; by = c[1]; tx = (b[0] - a[0]) / sl; ty = (b[1] - a[1]) / sl; along = acc + c[2] * sl; }
      acc += sl;
    }
    return { d: best, x: bx, y: by, tx, ty, along, total: acc };
  };

  U.area = P => { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return s / 2; };
  U.ccw = P => (U.area(P) > 0 ? P : P.slice().reverse());
  U.cw = P => (U.area(P) < 0 ? P : P.slice().reverse());
  U.centroid = P => { let x = 0, y = 0; P.forEach(p => { x += p[0]; y += p[1]; }); return [x / P.length, y / P.length]; };

  U.rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  U.arc = (cx, cy, r, a0, a1, n) => {
    n = n || Math.max(4, Math.ceil(Math.abs(a1 - a0) * r * 4));
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return out;
  };
  U.circle = (cx, cy, r, n) => { const P = U.arc(cx, cy, r, 0, TAU, n || Math.max(24, Math.ceil(r * 14))); P.pop(); return P; };
  U.blob = (cx, cy, r, seed, amp = 0.16, n = 30) => {
    const rnd = U.rng(seed), p1 = rnd() * TAU, p2 = rnd() * TAU, p3 = rnd() * TAU, P = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + amp * (0.55 * Math.sin(2 * a + p1) + 0.3 * Math.sin(3 * a + p2) + 0.15 * Math.sin(5 * a + p3));
      P.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * (1 + amp * 0.2)]);
    }
    return P;
  };

  // Round each corner of a polygon with an arc of radius r (a number, or one per vertex; 0 keeps the corner).
  U.roundPoly = (P, r) => {
    const out = [], n = P.length;
    for (let i = 0; i < n; i++) {
      const p = P[i], a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
      const rr = Array.isArray(r) ? r[i] : r;
      if (!rr) { out.push([p[0], p[1]]); continue; }
      const v1x = a[0] - p[0], v1y = a[1] - p[1], v2x = b[0] - p[0], v2y = b[1] - p[1];
      const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
      const u1x = v1x / l1, u1y = v1y / l1, u2x = v2x / l2, u2y = v2y / l2;
      const ang = Math.acos(U.clamp(u1x * u2x + u1y * u2y, -1, 1));
      if (ang > Math.PI - 0.02 || ang < 0.02) { out.push([p[0], p[1]]); continue; }
      let t = rr / Math.tan(ang / 2);
      t = Math.min(t, l1 * 0.49, l2 * 0.49);
      const rad = t * Math.tan(ang / 2);
      const p1 = [p[0] + u1x * t, p[1] + u1y * t], p2 = [p[0] + u2x * t, p[1] + u2y * t];
      const bx = u1x + u2x, by = u1y + u2y, bl = Math.hypot(bx, by);
      const dc = rad / Math.sin(ang / 2);
      const cx = p[0] + (bx / bl) * dc, cy = p[1] + (by / bl) * dc;
      const a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
      const da = U.wrapAngle(Math.atan2(p2[1] - cy, p2[0] - cx) - a1);
      const segs = Math.max(2, Math.ceil(Math.abs(da) * rad * 7));
      for (let k = 0; k <= segs; k++) { const aa = a1 + (da * k) / segs; out.push([cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad]); }
    }
    return out;
  };

  // Smooth open curve through the points (uniform Catmull-Rom).
  U.catmull = (pts, per = 10) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  };

  // A band of the given half-width around an open polyline, as a polygon.
  U.ribbon = (line, hw) => {
    const L = [], R = [];
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      L.push([line[i][0] + nx * hw, line[i][1] + ny * hw]);
      R.push([line[i][0] - nx * hw, line[i][1] - ny * hw]);
    }
    return U.ccw(R.concat(L.reverse()));
  };

  // Points spaced no more than `step` apart along a polyline.
  U.resample = (pts, step, closed) => {
    const out = [], n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    if (!closed) out.push(pts[pts.length - 1].slice());
    return out;
  };

  // Outward (right-hand) miter normals for a polyline walked with the inside on its left.
  U.normals = (pts, closed) => {
    const n = pts.length, N = [];
    for (let i = 0; i < n; i++) {
      const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
      const next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
      const cur = pts[i];
      const e1 = i === 0 && !closed ? null : [cur[0] - prev[0], cur[1] - prev[1]];
      const e2 = i === n - 1 && !closed ? null : [next[0] - cur[0], next[1] - cur[1]];
      const nrm = e => { const l = Math.hypot(e[0], e[1]) || 1; return [e[1] / l, -e[0] / l]; };
      let nx, ny;
      if (e1 && e2) {
        const a = nrm(e1), b = nrm(e2);
        nx = a[0] + b[0]; ny = a[1] + b[1];
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const cos = nx * a[0] + ny * a[1];
        const m = 1 / Math.max(cos, 0.4);
        nx *= m; ny *= m;
      } else { const a = nrm(e1 || e2); nx = a[0]; ny = a[1]; }
      N.push([nx, ny]);
    }
    return N;
  };

  U.bounds = polys => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    polys.forEach(P => P.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }));
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  };
});
