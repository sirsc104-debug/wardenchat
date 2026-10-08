// Generates the towns of rival (fake) players.
(function (G) {
  'use strict';
  const { D, U } = G;
  const N = D.MAP, E = D.EDGE;

  function makeGrid() { return new Uint8Array(N * N); }
  function free(grid, x, y, s, gap) {
    for (let yy = y - gap; yy < y + s + gap; yy++)
      for (let xx = x - gap; xx < x + s + gap; xx++) {
        if (xx < E || yy < E || xx >= N - E || yy >= N - E) { if (yy >= y && yy < y + s && xx >= x && xx < x + s) return false; continue; }
        if (grid[yy * N + xx]) return false;
      }
    return true;
  }
  function mark(grid, x, y, s, v) {
    for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) grid[yy * N + xx] = v;
  }

  // Place a building as close to (cx, cy) as possible, with a little randomness.
  function placeNear(grid, s, cx, cy, rng, gap, minR) {
    const cands = [];
    for (let y = E; y <= N - E - s; y++)
      for (let x = E; x <= N - E - s; x++) {
        const d = U.dist(x + s / 2, y + s / 2, cx, cy);
        if (minR && d < minR) continue;
        cands.push([d + rng() * 2.5, x, y]);
      }
    cands.sort((a, b) => a[0] - b[0]);
    for (const [, x, y] of cands) if (free(grid, x, y, s, gap)) return [x, y];
    for (const [, x, y] of cands) if (free(grid, x, y, s, 0)) return [x, y];
    return null;
  }

  function levelFor(id, ph, rng, quality) {
    const max = D.maxLevel(id, ph);
    if (max <= 0) return 0;
    const drop = quality > 0.7 ? rng.int(0, 1) : quality > 0.35 ? rng.int(0, 2) : rng.int(1, 3);
    return Math.max(1, max - drop);
  }

  function generateBase(ph, seed) {
    const rng = U.makeRng(seed);
    const grid = makeGrid();
    const out = [];
    const quality = rng();
    const C = N / 2;
    const add = (type, x, y, level) => { out.push({ type, x, y, level }); mark(grid, x, y, D.B[type].size, 1); };

    // 1. Pyramid in the middle, slightly off-centre for variety.
    const px = C - 2 + rng.int(-2, 2), py = C - 2 + rng.int(-2, 2);
    add('pyramid', px, py, ph);
    const pcx = px + 2, pcy = py + 2;

    const list = [];
    for (const id of D.BUILDING_ORDER) {
      if (id === 'pyramid' || id === 'wall' || D.B[id].isTrap) continue;
      let n = id === 'builderHut' ? Math.min(5, 2 + Math.floor(ph / 3)) : D.countAllowed(id, ph);
      if (n > 1 && quality < 0.3 && rng.chance(0.4)) n--; // weaker players skip a building now and then
      for (let i = 0; i < n; i++) list.push(id);
    }
    const inner = list.filter((id) => D.B[id].stores || ['royalHall', 'eyeHorus', 'obelisk', 'sphinx', 'sunDisk', 'catapult', 'temple'].includes(id));
    const middle = list.filter((id) => !inner.includes(id) && (D.B[id].isDefense));
    const outer = list.filter((id) => !inner.includes(id) && !middle.includes(id));

    // shuffle for variety
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    shuffle(inner); shuffle(middle); shuffle(outer);

    for (const id of inner) {
      const s = D.B[id].size;
      const p = placeNear(grid, s, pcx, pcy, rng, 1);
      if (p) add(id, p[0], p[1], levelFor(id, ph, rng, quality));
    }

    let walls = D.countAllowed('wall', ph);
    const wallLevel = () => levelFor('wall', ph, rng, quality);
    const placeWall = (x, y) => {
      if (walls <= 0 || x < E || y < E || x >= N - E || y >= N - E || grid[y * N + x]) return false;
      add('wall', x, y, wallLevel()); walls--; return true;
    };
    const ring = (x0, y0, x1, y1) => {
      const per = 2 * (x1 - x0 + y1 - y0);
      if (per > walls) return false;
      for (let x = x0; x <= x1; x++) { placeWall(x, y0); placeWall(x, y1); }
      for (let y = y0 + 1; y < y1; y++) { placeWall(x0, y); placeWall(x1, y); }
      return true;
    };
    const bbox = (items) => {
      let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
      for (const b of items) { const s = D.B[b.type].size; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + s - 1); y1 = Math.max(y1, b.y + s - 1); }
      return [x0, y0, x1, y1];
    };

    // 2. Wall around the core, or at least around the Pyramid.
    let [x0, y0, x1, y1] = bbox(out);
    if (!ring(x0 - 1, y0 - 1, x1 + 1, y1 + 1)) ring(px - 1, py - 1, px + 4, py + 4);

    // 3. Defenses around the core.
    for (const id of middle) {
      const s = D.B[id].size;
      const p = placeNear(grid, s, pcx, pcy, rng, 1);
      if (p) add(id, p[0], p[1], levelFor(id, ph, rng, quality));
    }
    // 4. Outer wall if there are enough walls left.
    [x0, y0, x1, y1] = bbox(out);
    ring(x0 - 1, y0 - 1, x1 + 1, y1 + 1);

    // 5. Farms, camps and huts outside.
    for (const id of outer) {
      const s = D.B[id].size;
      const p = placeNear(grid, s, pcx, pcy, rng, 1);
      if (p) add(id, p[0], p[1], levelFor(id, ph, rng, quality));
    }
    // 6. Leftover walls become short spurs between buildings.
    let tries = 0;
    while (walls > 0 && tries++ < 400) {
      const x = rng.int(E, N - E - 1), y = rng.int(E, N - E - 1);
      if (U.dist(x, y, pcx, pcy) > 14) continue;
      const horiz = rng.chance(0.5), len = rng.int(2, 5);
      for (let i = 0; i < len; i++) if (!placeWall(horiz ? x + i : x, horiz ? y : y + i)) break;
    }
    // 7. Hidden traps in gaps near the middle.
    for (const id of D.BUILDING_ORDER.filter((i) => D.B[i].isTrap)) {
      const n = D.countAllowed(id, ph);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 60; k++) {
          const x = Math.round(pcx + (rng() - 0.5) * 24), y = Math.round(pcy + (rng() - 0.5) * 24);
          if (x < E || y < E || x >= N - E || y >= N - E || grid[y * N + x]) continue;
          add(id, x, y, levelFor(id, ph, rng, quality));
          break;
        }
      }
    }
    return out;
  }

  // A rival player: name, clan, trophies, layout and the loot on offer.
  function makeRival(myPh, myTrophies, seed, forcePh) {
    const rng = U.makeRng(seed);
    let ph = forcePh || U.clamp(myPh + (rng.chance(0.65) ? 0 : rng.chance(0.5) ? 1 : -1), 1, D.MAX_PH);
    const name = rng.pick(D.NAMES);
    return {
      seed, ph, name,
      clan: rng.chance(0.85) ? rng.pick(D.CLAN_NAMES) : '',
      trophies: Math.max(0, Math.round(myTrophies + (rng() - 0.5) * 120)),
      layout: generateBase(ph, seed ^ 0x9e3779b9),
    };
  }

  G.BaseGen = { generateBase, makeRival };
})(globalThis.SOTP = globalThis.SOTP || {});
