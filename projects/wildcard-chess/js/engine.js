/* Wildcard Chess engine: the rules for the standard pieces and all 30 wildcards, plus the
   computer opponent. Everything lives inside one function with no outside references so the
   same source can be started inside a Web Worker (see game.js).

   Squares are 0..63, rank * 8 + file, with rank 0 = White's back rank.
   A piece is { t: type, c: 'w' | 'b' | 'n' (neutral wall), id, m: has moved, d: per-piece data }.
   A move is { o: square the player clicks, f: piece that moves, t: target, k: kind, x: squares destroyed }. */
function ChessEngine() {
  'use strict';
  const F = q => q & 7, R = q => q >> 3, SQ = (f, r) => r * 8 + f;
  const on = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const D4 = D8.slice(0, 4), DG = D8.slice(4);
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const opp = c => (c === 'w' ? 'b' : 'w');
  const ci = c => (c === 'w' ? 0 : 1);
  const cheb = (a, b) => Math.max(Math.abs(F(a) - F(b)), Math.abs(R(a) - R(b)));

  const ADJ = [], RING2 = [];
  for (let q = 0; q < 64; q++) {
    ADJ[q] = []; RING2[q] = [];
    for (let t = 0; t < 64; t++) {
      if (t === q) continue;
      const d = cheb(q, t);
      if (d === 1) ADJ[q].push(t);
      if (d <= 2) RING2[q].push(t);
    }
  }

  // Passive auras (Frost Warden freezes, Guardian shields), rebuilt for each position we generate in.
  const FRZ = [new Uint8Array(64), new Uint8Array(64)];
  const GRD = [new Uint8Array(64), new Uint8Array(64)];
  const HAS_FRZ = [false, false], HAS_GRD = [false, false];
  function setCtx(s) {
    FRZ[0].fill(0); FRZ[1].fill(0); GRD[0].fill(0); GRD[1].fill(0);
    HAS_FRZ[0] = HAS_FRZ[1] = HAS_GRD[0] = HAS_GRD[1] = false;
    for (let q = 0; q < 64; q++) {
      const p = s.b[q];
      if (!p) continue;
      if (p.t === 'frost') { const v = ci(opp(p.c)); HAS_FRZ[v] = true; for (const a of ADJ[q]) FRZ[v][a] = 1; }
      else if (p.t === 'guardian') { const v = ci(p.c); HAS_GRD[v] = true; for (const a of ADJ[q]) GRD[v][a] = 1; }
    }
  }

  function capOK(s, a, t) {
    const p = s.b[t];
    if (!p || p.c === a.c || p.c === 'n') return false;
    if (p.t === 'golem' && a.t !== 'P' && a.t !== 'K') return false;
    if (p.t === 'viper' && a.t === 'K') return false;
    const v = ci(p.c);
    if (HAS_GRD[v] && GRD[v][t]) return false;
    return true;
  }

  const mv = (o, f, t, k, x) => ({ o, f, t, k, x });

  function step(s, q, p, out, dirs, capture = true) {
    const f = F(q), r = R(q);
    for (const [dx, dy] of dirs) {
      const nf = f + dx, nr = r + dy;
      if (!on(nf, nr)) continue;
      const t = SQ(nf, nr);
      if (!s.b[t]) out.push(mv(q, q, t, 'n', null));
      else if (capture && capOK(s, p, t)) out.push(mv(q, q, t, 'n', [t]));
    }
  }
  function slide(s, q, p, out, dirs, max = 7) {
    const f = F(q), r = R(q);
    for (const [dx, dy] of dirs) {
      for (let k = 1; k <= max; k++) {
        const nf = f + dx * k, nr = r + dy * k;
        if (!on(nf, nr)) break;
        const t = SQ(nf, nr);
        if (!s.b[t]) { out.push(mv(q, q, t, 'n', null)); continue; }
        if (capOK(s, p, t)) out.push(mv(q, q, t, 'n', [t]));
        break;
      }
    }
  }
  function uniq(list, out) {
    const seen = new Set();
    for (const m of list) { const key = m.t * 32 + (m.x ? 1 : 0); if (!seen.has(key)) { seen.add(key); out.push(m); } }
  }

  /* ---------- standard pieces ---------- */
  function pawn(s, q, p, out) {
    const dir = p.c === 'w' ? 1 : -1, f = F(q), r = R(q), start = p.c === 'w' ? 1 : 6, last = p.c === 'w' ? 7 : 0;
    const nr = r + dir;
    if (!on(f, nr)) return;
    const add = (t, x, k) => {
      if (R(t) === last) {
        for (const pr of ['Q', 'R', 'B', 'N'].concat(s.wild[p.c] || [])) out.push({ o: q, f: q, t, k: k || 'n', x, promo: pr });
      } else out.push(mv(q, q, t, k || 'n', x));
    };
    const t1 = SQ(f, nr);
    if (!s.b[t1]) {
      add(t1, null);
      if (r === start) { const t2 = SQ(f, r + 2 * dir); if (!s.b[t2]) out.push({ o: q, f: q, t: t2, k: 'n', x: null, dbl: 1 }); }
    }
    for (const dx of [-1, 1]) {
      const nf = f + dx;
      if (!on(nf, nr)) continue;
      const t = SQ(nf, nr);
      if (s.b[t]) { if (capOK(s, p, t)) add(t, [t]); }
      else if (t === s.ep) {
        const vq = SQ(nf, r), v = s.b[vq];
        if (v && v.t === 'P' && v.c !== p.c && capOK(s, p, vq)) out.push(mv(q, q, t, 'ep', [vq]));
      }
    }
  }
  function king(s, q, p, out, noCastle) {
    step(s, q, p, out, D8);
    if (noCastle || p.m) return;
    const r = p.c === 'w' ? 0 : 7;
    if (q !== SQ(4, r)) return;
    const rk = s.b[SQ(7, r)];
    if (rk && rk.t === 'R' && rk.c === p.c && !rk.m && !s.b[SQ(5, r)] && !s.b[SQ(6, r)])
      out.push({ o: q, f: q, t: SQ(6, r), k: 'castle', x: null, rf: SQ(7, r), rt: SQ(5, r), pass: SQ(5, r) });
    const rq = s.b[SQ(0, r)];
    if (rq && rq.t === 'R' && rq.c === p.c && !rq.m && !s.b[SQ(1, r)] && !s.b[SQ(2, r)] && !s.b[SQ(3, r)])
      out.push({ o: q, f: q, t: SQ(2, r), k: 'castle', x: null, rf: SQ(0, r), rt: SQ(3, r), pass: SQ(3, r) });
  }

  const STD = {
    P: pawn,
    N: (s, q, p, out) => step(s, q, p, out, KN),
    B: (s, q, p, out) => slide(s, q, p, out, DG),
    R: (s, q, p, out) => slide(s, q, p, out, D4),
    Q: (s, q, p, out) => slide(s, q, p, out, D8),
    K: king,
  };
  const STD_VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0, WALL: 0 };

  /* ---------- the 30 wildcards ---------- */
  const W = {
    bomber: { v: 400, gen(s, q, p, out) {
      const f = F(q), r = R(q);
      for (const [dx, dy] of D8) {
        const nf = f + dx, nr = r + dy;
        if (!on(nf, nr)) continue;
        const t = SQ(nf, nr);
        if (!s.b[t]) { out.push(mv(q, q, t, 'n', null)); continue; }
        if (!capOK(s, p, t)) continue;
        const x = [t]; let bad = false;
        for (const a of ADJ[t]) {
          const ap = s.b[a];
          if (!ap || ap.c === 'n') continue;
          if (ap.t === 'K' && ap.c === p.c) { bad = true; break; }
          x.push(a);
        }
        if (!bad) out.push(mv(q, q, t, 'boom', x));
      }
    } },
    phantom: { v: 600, gen(s, q, p, out) {
      const f = F(q), r = R(q);
      for (const [dx, dy] of D4) {
        for (let k = 1; k < 8; k++) {
          const nf = f + dx * k, nr = r + dy * k;
          if (!on(nf, nr)) break;
          const t = SQ(nf, nr);
          if (!s.b[t]) out.push(mv(q, q, t, 'n', null));
          else if (capOK(s, p, t)) out.push(mv(q, q, t, 'n', [t]));
        }
      }
    } },
    blink: { v: 360, init: () => ({ cd: 0 }), gen(s, q, p, out) {
      step(s, q, p, out, D8);
      if (s.ply < p.d.cd) return;
      for (let t = 0; t < 64; t++) if (!s.b[t] && cheb(q, t) > 1) out.push({ o: q, f: q, t, k: 'n', x: null, tele: 1 });
    } },
    trickster: { v: 320, gen(s, q, p, out) {
      step(s, q, p, out, D8);
      for (const t of RING2[q]) { const tp = s.b[t]; if (tp && tp.c === p.c) out.push(mv(q, q, t, 'swap', null)); }
    } },
    archer: { v: 450, gen(s, q, p, out) {
      step(s, q, p, out, D8, false);
      const f = F(q), r = R(q);
      for (const [dx, dy] of D8) for (const k of [2, 3]) {
        const nf = f + dx * k, nr = r + dy * k;
        if (!on(nf, nr)) continue;
        const t = SQ(nf, nr);
        if (capOK(s, p, t)) out.push(mv(q, q, t, 'shoot', [t]));
      }
    } },
    necro: { v: 420, init: () => ({ ch: 2 }), gen(s, q, p, out) {
      slide(s, q, p, out, DG, 2);
      if (p.d.ch <= 0) return;
      const rt = lastLost(s, p.c);
      if (!rt) return;
      for (const t of ADJ[q]) {
        if (s.b[t]) continue;
        if (rt === 'P' && (R(t) === 0 || R(t) === 7)) continue;
        out.push({ o: q, f: q, t, k: 'raise', x: null, rt });
      }
    } },
    frost: { v: 400, gen: (s, q, p, out) => step(s, q, p, out, D8) },
    wyvern: { v: 560, gen(s, q, p, out) {
      const seen = new Uint8Array(64); seen[q] = 1;
      const f = F(q), r = R(q);
      for (const [dx, dy] of KN) {
        const nf = f + dx, nr = r + dy;
        if (!on(nf, nr)) continue;
        const t1 = SQ(nf, nr);
        if (s.b[t1]) { if (!seen[t1] && capOK(s, p, t1)) { seen[t1] = 1; out.push(mv(q, q, t1, 'n', [t1])); } continue; }
        if (!seen[t1]) { seen[t1] = 1; out.push(mv(q, q, t1, 'n', null)); }
        for (const [ex, ey] of KN) {
          const f2 = nf + ex, r2 = nr + ey;
          if (!on(f2, r2)) continue;
          const t2 = SQ(f2, r2);
          if (seen[t2]) continue;
          if (!s.b[t2]) { seen[t2] = 1; out.push(mv(q, q, t2, 'n', null)); }
          else if (capOK(s, p, t2)) { seen[t2] = 1; out.push(mv(q, q, t2, 'n', [t2])); }
        }
      }
    } },
    hopper: { v: 260, gen(s, q, p, out) {
      const f = F(q), r = R(q);
      for (const [dx, dy] of D8) {
        let k = 1;
        while (on(f + dx * k, r + dy * k) && !s.b[SQ(f + dx * k, r + dy * k)]) k++;
        const lf = f + dx * (k + 1), lr = r + dy * (k + 1);
        if (!on(f + dx * k, r + dy * k) || !on(lf, lr)) continue;
        const t = SQ(lf, lr);
        if (!s.b[t]) out.push(mv(q, q, t, 'n', null));
        else if (capOK(s, p, t)) out.push(mv(q, q, t, 'n', [t]));
      }
    } },
    serpent: { v: 420, gen(s, q, p, out) {
      const seen = new Uint8Array(64); seen[q] = 1;
      let front = [q];
      for (let stepN = 1; stepN <= 3; stepN++) {
        const next = [];
        for (const c of front) for (const [dx, dy] of D4) {
          const nf = F(c) + dx, nr = R(c) + dy;
          if (!on(nf, nr)) continue;
          const t = SQ(nf, nr);
          if (seen[t]) continue;
          seen[t] = 1;
          if (!s.b[t]) { next.push(t); out.push(mv(q, q, t, 'n', null)); }
          else if (capOK(s, p, t)) out.push(mv(q, q, t, 'n', [t]));
        }
        front = next;
      }
    } },
    ricochet: { v: 400, gen(s, q, p, out) {
      const seen = new Uint8Array(64);
      for (const [dx0, dy0] of DG) {
        let x = F(q), y = R(q), dx = dx0, dy = dy0, bounced = false;
        for (let i = 0; i < 16; i++) {
          let nx = x + dx, ny = y + dy;
          if (!on(nx, ny)) {
            if (bounced) break;
            bounced = true;
            if (nx < 0 || nx > 7) dx = -dx;
            if (ny < 0 || ny > 7) dy = -dy;
            nx = x + dx; ny = y + dy;
            if (!on(nx, ny)) break;
          }
          const t = SQ(nx, ny);
          if (t === q) break;
          if (!s.b[t]) { if (!seen[t]) { seen[t] = 1; out.push(mv(q, q, t, 'n', null)); } }
          else { if (!seen[t] && capOK(s, p, t)) { seen[t] = 1; out.push(mv(q, q, t, 'n', [t])); } break; }
          x = nx; y = ny;
        }
      }
    } },
    orbit: { v: 560, gen(s, q, p, out) {
      const seen = new Uint8Array(64);
      for (const [dx, dy] of D4) {
        let x = F(q), y = R(q);
        for (let i = 0; i < 7; i++) {
          x = (x + dx + 8) & 7; y = (y + dy + 8) & 7;
          const t = SQ(x, y);
          if (t === q) break;
          if (!s.b[t]) { if (!seen[t]) { seen[t] = 1; out.push(mv(q, q, t, 'n', null)); } continue; }
          if (!seen[t] && capOK(s, p, t)) { seen[t] = 1; out.push(mv(q, q, t, 'n', [t])); }
          break;
        }
      }
    } },
    juggernaut: { v: 600, gen(s, q, p, out) {
      const f = F(q), r = R(q);
      for (const [dx, dy] of D4) {
        let x = [];
        for (let k = 1; k <= 3; k++) {
          const nf = f + dx * k, nr = r + dy * k;
          if (!on(nf, nr)) break;
          const t = SQ(nf, nr);
          if (s.b[t]) {
            if (!capOK(s, p, t)) break;
            x = x.concat(t);
            out.push(mv(q, q, t, 'crush', x));
          } else out.push(x.length ? mv(q, q, t, 'crush', x) : mv(q, q, t, 'n', null));
        }
      }
    } },
    cannon: { v: 450, gen(s, q, p, out) {
      const f = F(q), r = R(q);
      for (const [dx, dy] of D4) {
        let screen = false;
        for (let k = 1; k < 8; k++) {
          const nf = f + dx * k, nr = r + dy * k;
          if (!on(nf, nr)) break;
          const t = SQ(nf, nr), tp = s.b[t];
          if (!screen) { if (!tp) out.push(mv(q, q, t, 'n', null)); else screen = true; }
          else if (tp) { if (capOK(s, p, t)) out.push(mv(q, q, t, 'n', [t])); break; }
        }
      }
    } },
    tempest: { v: 400, gen(s, q, p, out) {
      step(s, q, p, out, D8);
      const f = F(q), r = R(q), x = [], pushes = [];
      for (const [dx, dy] of D8) {
        const nf = f + dx, nr = r + dy;
        if (!on(nf, nr)) continue;
        const a = SQ(nf, nr), ap = s.b[a];
        if (!ap || ap.c === p.c || ap.c === 'n') continue;
        const f2 = nf + dx, r2 = nr + dy;
        if (!on(f2, r2)) { if (ap.t !== 'K') x.push(a); }
        else { const d = SQ(f2, r2); if (!s.b[d]) pushes.push(a, d); }
      }
      if (x.length || pushes.length) out.push({ o: q, f: q, t: q, k: 'gust', x: x.length ? x : null, pushes });
    } },
    mimic: { v: 400, gen(s, q, p, out) {
      const tmp = [];
      step(s, q, p, tmp, D8);
      const ty = new Set();
      for (const a of ADJ[q]) { const ap = s.b[a]; if (ap && ap.c !== 'n') ty.add(ap.t); }
      if (ty.has('N')) step(s, q, p, tmp, KN);
      if (ty.has('B') || ty.has('Q')) slide(s, q, p, tmp, DG);
      if (ty.has('R') || ty.has('Q')) slide(s, q, p, tmp, D4);
      if (ty.has('P')) {
        const dir = p.c === 'w' ? 1 : -1, f = F(q), nr = R(q) + dir;
        if (on(f, nr) && !s.b[SQ(f, nr)]) tmp.push(mv(q, q, SQ(f, nr), 'n', null));
        for (const dx of [-1, 1]) if (on(f + dx, nr) && capOK(s, p, SQ(f + dx, nr))) tmp.push(mv(q, q, SQ(f + dx, nr), 'n', [SQ(f + dx, nr)]));
      }
      uniq(tmp, out);
    } },
    siren: { v: 400, init: () => ({ ch: 1 }), gen(s, q, p, out) {
      slide(s, q, p, out, DG, 2);
      if (p.d.ch <= 0) return;
      for (const a of ADJ[q]) {
        const ap = s.b[a];
        if (!ap || ap.c === p.c || ap.c === 'n' || ap.t === 'K' || ap.t === 'Q') continue;
        if (ap.t === 'P' && (R(a) === 0 || R(a) === 7)) continue;
        out.push(mv(q, q, a, 'charm', null));
      }
    } },
    guardian: { v: 420, gen: (s, q, p, out) => step(s, q, p, out, D8) },
    golem: { v: 400, gen: (s, q, p, out) => step(s, q, p, out, D4) },
    phoenix: { v: 520, init: q => ({ home: q, reborn: false }), gen: (s, q, p, out) => slide(s, q, p, out, D8, 2) },
    viper: { v: 360, gen: (s, q, p, out) => step(s, q, p, out, KN) },
    brood: { v: 400, init: () => ({ cd: 0 }), gen(s, q, p, out) {
      step(s, q, p, out, D8);
      if (s.ply < p.d.cd) return;
      for (const a of ADJ[q]) if (!s.b[a] && R(a) !== 0 && R(a) !== 7) out.push(mv(q, q, a, 'spawn', null));
    } },
    chrono: { v: 400, init: () => ({ ch: 1 }), gen(s, q, p, out) { step(s, q, p, out, D4); slide(s, q, p, out, DG, 3); } },
    mason: { v: 340, gen(s, q, p, out) {
      step(s, q, p, out, D8);
      if (s.walls) { let n = 0; for (const w of s.b) if (w && w.t === 'WALL' && w.d.o === p.c) n++; if (n >= 2) return; }
      const f = F(q), r = R(q);
      for (const [dx, dy] of D8) for (let k = 1; k <= 2; k++) {
        const nf = f + dx * k, nr = r + dy * k;
        if (on(nf, nr) && !s.b[SQ(nf, nr)]) out.push(mv(q, q, SQ(nf, nr), 'wall', null));
      }
    } },
    vampire: { v: 330, init: () => ({ k: 0 }), gen(s, q, p, out) {
      const tmp = [];
      step(s, q, p, tmp, D8);
      if (p.d.k >= 1) step(s, q, p, tmp, KN);
      if (p.d.k >= 2) slide(s, q, p, tmp, D8);
      uniq(tmp, out);
    } },
    marauder: { v: 400, gen(s, q, p, out) {
      step(s, q, p, out, DG, false);
      const best = new Map(), jumped = [];
      const dfs = (cur, depth) => {
        if (depth >= 4) return;
        for (const [dx, dy] of DG) {
          const lf = F(cur) + 2 * dx, lr = R(cur) + 2 * dy;
          if (!on(lf, lr)) continue;
          const over = SQ(F(cur) + dx, R(cur) + dy), land = SQ(lf, lr);
          if (jumped.includes(over) || !capOK(s, p, over)) continue;
          if (s.b[land] && land !== q) continue;
          jumped.push(over);
          const prev = best.get(land);
          if (land !== q && (!prev || prev.x.length < jumped.length)) best.set(land, mv(q, q, land, 'jump', jumped.slice()));
          dfs(land, depth + 1);
          jumped.pop();
        }
      };
      dfs(q, 0);
      for (const m of best.values()) out.push(m);
    } },
    hexer: { v: 400, init: () => ({ ch: 1 }), gen(s, q, p, out) {
      slide(s, q, p, out, D4, 2);
      if (p.d.ch <= 0) return;
      for (const t of RING2[q]) {
        const tp = s.b[t];
        if (!tp || tp.c === p.c || tp.c === 'n' || tp.t === 'K' || tp.t === 'P') continue;
        if ((tp.c === 'w' && R(t) === 7) || (tp.c === 'b' && R(t) === 0)) continue;
        out.push(mv(q, q, t, 'hex', null));
      }
    } },
    catapult: { v: 340, gen(s, q, p, out) {
      step(s, q, p, out, D8);
      const f = F(q), r = R(q);
      for (const [dx, dy] of D8) {
        if (!on(f + dx, r + dy)) continue;
        const a = SQ(f + dx, r + dy), ap = s.b[a];
        if (!ap || ap.c !== p.c) continue;
        const lf = f - 2 * dx, lr = r - 2 * dy;
        if (!on(lf, lr)) continue;
        if (ap.t === 'P' && (lr === 0 || lr === 7)) continue;
        const L = SQ(lf, lr);
        if (!s.b[L]) out.push(mv(q, a, L, 'launch', null));
        else if (capOK(s, ap, L)) out.push(mv(q, a, L, 'launch', [L]));
      }
    } },
    assassin: { v: 360, gen(s, q, p, out) {
      const f = F(q), r = R(q);
      for (const [dx, dy] of KN) {
        const nf = f + dx, nr = r + dy;
        if (!on(nf, nr)) continue;
        const t = SQ(nf, nr);
        if (!s.b[t]) out.push(mv(q, q, t, 'n', null));
        else if (capOK(s, p, t)) out.push(mv(q, q, t, 'strike', [t]));
      }
    } },
    void: { v: 420, gen: (s, q, p, out) => step(s, q, p, out, D8) },
  };
  const WILD_IDS = Object.keys(W);

  function value(p) {
    if (p.t in STD_VAL) return STD_VAL[p.t];
    if (p.t === 'vampire') return 330 + 220 * Math.min(p.d.k, 2);
    const w = W[p.t];
    let v = w.v;
    if ((p.t === 'necro' || p.t === 'siren' || p.t === 'hexer' || p.t === 'chrono') && p.d.ch <= 0) v -= 60;
    if (p.t === 'phoenix' && p.d.reborn) v -= 80;
    return v;
  }
  function initData(t, q) { const w = W[t]; return w && w.init ? w.init(q) : null; }
  function lastLost(s, c) {
    const L = s.lost[c];
    for (let i = L.length - 1; i >= 0; i--) if (L[i] !== 'K' && L[i] !== 'WALL') return L[i];
    return null;
  }

  function genAll(s, c, noCastle) {
    setCtx(s);
    const out = [], fz = HAS_FRZ[ci(c)] ? FRZ[ci(c)] : null;
    for (let q = 0; q < 64; q++) {
      const p = s.b[q];
      if (!p || p.c !== c) continue;
      if (fz && fz[q] && p.t !== 'K') continue;
      if (p.t === 'K') king(s, q, p, out, noCastle);
      else if (STD[p.t]) STD[p.t](s, q, p, out);
      else W[p.t].gen(s, q, p, out);
    }
    return out;
  }

  /* ---------- making moves ---------- */
  function newPiece(ns, t, c, q) { return { t, c, id: ns.nid++, m: false, d: initData(t, q) }; }

  function makeMove(s, m) {
    const b = s.b.slice();
    const c = s.turn;
    const ns = { b, turn: c, ep: -1, ply: s.ply + 1, half: s.half + 1, lost: s.lost, nid: s.nid, dead: s.dead,
      walls: s.walls, wild: s.wild, last: m, extra: false, events: null };
    const pend = [];
    const ev = e => { (ns.events || (ns.events = [])).push(e); };
    const kills = [];
    const kill = q => {
      const p = b[q];
      if (!p || p.c === 'n') return null;
      b[q] = null;
      if (p.t === 'K' && !ns.dead) ns.dead = p.c;
      ns.lost = { w: ns.lost.w, b: ns.lost.b, [p.c]: ns.lost[p.c].concat(p.t) };
      if (p.t === 'phoenix' && p.d && !p.d.reborn) pend.push(p);
      ns.half = 0;
      return p;
    };
    const moveTo = (f, t) => { const p = b[f]; b[f] = null; b[t] = p.m ? p : { ...p, m: true }; return b[t]; };
    const setD = (q, d) => { b[q] = { ...b[q], d: { ...b[q].d, ...d } }; };
    let actor = -1, mover = -1;

    switch (m.k) {
      case 'n': case 'launch': case 'ep': case 'crush': case 'jump': {
        const pc = b[m.f];
        if (m.x) for (const q of m.x) { const k = kill(q); if (k) kills.push([q, k]); }
        moveTo(m.f, m.t);
        actor = mover = m.t;
        if (pc.t === 'P') {
          ns.half = 0;
          if (m.dbl) ns.ep = (m.f + m.t) >> 1;
          if (m.promo) b[m.t] = { ...b[m.t], t: m.promo, d: initData(m.promo, m.t) };
        }
        if (m.tele) setD(m.t, { cd: s.ply + 5 });
        break;
      }
      case 'castle': moveTo(m.f, m.t); moveTo(m.rf, m.rt); break;
      case 'boom': for (const q of m.x) kill(q); ev({ k: 'boom', q: m.t }); break;
      case 'swap': { const a = b[m.f], t = b[m.t]; b[m.f] = { ...t, m: true }; b[m.t] = { ...a, m: true }; mover = m.t; break; }
      case 'shoot': case 'strike':
        for (const q of m.x) { const k = kill(q); if (k) kills.push([q, k]); }
        actor = m.o; break;
      case 'raise': {
        setD(m.o, { ch: b[m.o].d.ch - 1 });
        const L = ns.lost[c].slice(), i = L.lastIndexOf(m.rt);
        if (i >= 0) L.splice(i, 1);
        ns.lost = { ...ns.lost, [c]: L };
        b[m.t] = newPiece(ns, m.rt, c, m.t); b[m.t].m = true;
        break;
      }
      case 'gust':
        if (m.x) for (const q of m.x) kill(q);
        for (let i = 0; i < m.pushes.length; i += 2) moveTo(m.pushes[i], m.pushes[i + 1]);
        break;
      case 'charm': b[m.t] = { ...b[m.t], c, m: true }; setD(m.o, { ch: 0 }); break;
      case 'spawn': b[m.t] = newPiece(ns, 'P', c, m.t); setD(m.o, { cd: s.ply + 6 }); break;
      case 'wall': b[m.t] = { t: 'WALL', c: 'n', id: ns.nid++, m: true, d: { exp: s.ply + 8, o: c } }; ns.walls++; break;
      case 'hex': b[m.t] = { ...b[m.t], t: 'P', d: null, m: true }; setD(m.o, { ch: 0 }); break;
    }

    // Venom: whatever lands on a Viper's square dies with it.
    if (mover >= 0 && b[mover] && kills.some(([q, k]) => q === mover && k.t === 'viper')) {
      kill(mover); ev({ k: 'venom', q: mover }); actor = -1; mover = -1;
    }
    if (actor >= 0 && kills.length && b[actor]) {
      const a = b[actor];
      if (a.t === 'vampire') { setD(actor, { k: a.d.k + kills.length }); if (a.d.k < 2) ev({ k: 'grow', q: actor }); }
      else if (a.t === 'chrono' && a.d.ch > 0) { setD(actor, { ch: 0 }); ns.extra = true; ev({ k: 'extra', q: actor }); }
    }
    // The Void swallows enemy pieces that finish their move beside it.
    if (mover >= 0 && b[mover] && b[mover].t !== 'K' && b[mover].c === c) {
      for (const a of ADJ[mover]) { const ap = b[a]; if (ap && ap.t === 'void' && ap.c !== c) { kill(mover); ev({ k: 'void', q: mover, by: a }); break; } }
    }
    for (const p of pend) {
      const h = p.d.home;
      if (!b[h]) {
        b[h] = { ...p, id: ns.nid++, m: true, d: { ...p.d, reborn: true } };
        const L = ns.lost[p.c].slice(), i = L.lastIndexOf('phoenix');
        if (i >= 0) L.splice(i, 1);
        ns.lost = { ...ns.lost, [p.c]: L };
        ev({ k: 'reborn', q: h });
      }
    }
    if (ns.walls > 0) {
      for (let q = 0; q < 64; q++) { const w = b[q]; if (w && w.t === 'WALL' && w.d.exp <= ns.ply) { b[q] = null; ns.walls--; ev({ k: 'crumble', q }); } }
    }
    ns.turn = ns.extra ? c : opp(c);
    return ns;
  }

  /* ---------- legality and game status ---------- */
  function findKing(s, c) { for (let q = 0; q < 64; q++) { const p = s.b[q]; if (p && p.t === 'K' && p.c === c) return q; } return -1; }
  function attacked(s, q, by) {
    for (const m of genAll(s, by, true)) if (m.x && m.x.includes(q)) return true;
    return false;
  }
  function inCheck(s, c) { const k = findKing(s, c); return k < 0 || attacked(s, k, opp(c)); }

  function legalMoves(s) {
    if (s.dead) return [];
    const c = s.turn, out = [];
    for (const m of genAll(s, c, false)) {
      const ns = makeMove(s, m);
      if (ns.dead === c) continue;
      if (ns.dead === opp(c)) { out.push(m); continue; }
      if (inCheck(ns, c)) continue;
      if (m.k === 'castle') {
        if (inCheck(s, c)) continue;
        if (inCheck(makeMove(s, mv(m.f, m.f, m.pass, 'n', null)), c)) continue;
      }
      out.push(m);
    }
    return out;
  }

  function status(s, legal) {
    if (s.dead) return { over: true, winner: opp(s.dead), reason: 'king' };
    legal = legal || legalMoves(s);
    if (!legal.length) {
      if (inCheck(s, s.turn)) return { over: true, winner: opp(s.turn), reason: 'mate' };
      return { over: true, winner: null, reason: 'stalemate' };
    }
    if (s.half >= 100) return { over: true, winner: null, reason: 'fifty' };
    let others = 0;
    for (const p of s.b) if (p && p.t !== 'K' && p.c !== 'n') others++;
    if (!others) return { over: true, winner: null, reason: 'material' };
    return { over: false };
  }

  function newGame(o) {
    const b = new Array(64).fill(null);
    const s = { b, turn: 'w', ep: -1, ply: 0, half: 0, lost: { w: [], b: [] }, nid: 1, dead: null, walls: 0,
      wild: o.wild, last: null, extra: false, events: null };
    const back = 'RNBQKBNR';
    for (let f = 0; f < 8; f++) {
      b[SQ(f, 0)] = newPiece(s, back[f], 'w', SQ(f, 0));
      b[SQ(f, 1)] = newPiece(s, 'P', 'w', SQ(f, 1));
      b[SQ(f, 6)] = newPiece(s, 'P', 'b', SQ(f, 6));
      b[SQ(f, 7)] = newPiece(s, back[f], 'b', SQ(f, 7));
    }
    // Each wildcard takes the place of one regular piece (never the king), given as o.slots.
    for (const c of ['w', 'b']) (o.wild[c] || []).forEach((t, i) => {
      const q = o.slots ? o.slots[c][i] : SQ(o.files[c][i], c === 'w' ? 2 : 5);
      b[q] = newPiece(s, t, c, q);
    });
    return s;
  }

  /* Random squares of regular pieces (not the king) for a side's wildcards to replace. */
  function pickSlots(c, n) {
    const base = c === 'w' ? 0 : 48, king = c === 'w' ? 4 : 60, sq = [];
    for (let q = base; q < base + 16; q++) if (q !== king) sq.push(q);
    for (let i = sq.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sq[i], sq[j]] = [sq[j], sq[i]]; }
    return sq.slice(0, n);
  }
  function startType(q) { const r = R(q); return r === 1 || r === 6 ? 'P' : 'RNBQKBNR'[F(q)];
  }

  /* ---------- evaluation ---------- */
  const T = a => a; // tables are written rank 8 first, from White's side
  const PST = {
    P: T([0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0]),
    N: T([-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50]),
    B: T([-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20]),
    R: T([0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0]),
    Q: T([-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20]),
    K: T([-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]),
    KE: T([-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]),
  };
  const CENT = [];
  for (let q = 0; q < 64; q++) CENT[q] = Math.round((3.5 - Math.max(Math.abs(F(q) - 3.5), Math.abs(R(q) - 3.5))) * 7);

  function evaluate(s) {
    let sc = 0, heavy = 0;
    for (const p of s.b) if (p && p.c !== 'n' && p.t !== 'K' && p.t !== 'P') heavy += value(p);
    const endgame = heavy < 2600;
    for (let q = 0; q < 64; q++) {
      const p = s.b[q];
      if (!p || p.c === 'n') continue;
      const idx = p.c === 'w' ? (7 - R(q)) * 8 + F(q) : R(q) * 8 + F(q);
      let v = value(p);
      if (p.t === 'K') v += (endgame ? PST.KE : PST.K)[idx];
      else if (PST[p.t]) v += PST[p.t][idx];
      else v += CENT[q] + (p.c === 'w' ? R(q) : 7 - R(q)) * 3;
      sc += p.c === 'w' ? v : -v;
    }
    return (s.turn === 'w' ? sc : -sc) + 10;
  }

  /* ---------- search ---------- */
  const MATE = 100000, INF = 1e9;
  let nodes = 0, deadline = 0, aborted = false, QMAX = 4;

  function orderScore(s, m, c) {
    let sc = 0;
    if (m.x) for (const q of m.x) {
      const p = s.b[q];
      if (!p) continue;
      const v = p.t === 'K' ? 50000 : value(p);
      sc += p.c === c ? -v : v;
    }
    if (m.x && sc > 0) sc += 1000;
    if (m.promo) sc += m.promo === 'Q' ? 900 : 100;
    if (m.k !== 'n' && m.k !== 'castle') sc += 30;
    return sc;
  }
  function ordered(s, ms) {
    const c = s.turn;
    for (const m of ms) m._s = orderScore(s, m, c);
    return ms.sort((a, b) => b._s - a._s);
  }
  function hitsKing(ms, k) { if (k < 0) return false; for (const m of ms) if (m.x && m.x.includes(k)) return true; return false; }

  function qs(s, alpha, beta, ply, qd) {
    if (s.dead) return s.dead === s.turn ? -(MATE - ply) : MATE - ply;
    const stand = evaluate(s);
    if (qd >= QMAX) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if ((++nodes & 1023) === 0 && Date.now() > deadline) aborted = true;
    if (aborted) return alpha;
    const c = s.turn, ms = genAll(s, c, true);
    if (hitsKing(ms, findKing(s, opp(c)))) return MATE - ply;
    const caps = [];
    for (const m of ms) if (m.x || m.promo === 'Q') { m._s = orderScore(s, m, c); if (m._s > 0) caps.push(m); }
    caps.sort((a, b) => b._s - a._s);
    for (const m of caps) {
      const ns = makeMove(s, m);
      if (ns.dead === c) continue;
      const v = ns.turn === c ? qs(ns, alpha, beta, ply + 1, qd + 1) : -qs(ns, -beta, -alpha, ply + 1, qd + 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function ab(s, depth, alpha, beta, ply) {
    if (s.dead) return s.dead === s.turn ? -(MATE - ply) : MATE - ply;
    if (depth <= 0) return qs(s, alpha, beta, ply, 0);
    if ((++nodes & 1023) === 0 && Date.now() > deadline) aborted = true;
    if (aborted) return 0;
    const c = s.turn, ms = genAll(s, c, false);
    if (hitsKing(ms, findKing(s, opp(c)))) return MATE - ply;
    if (!ms.length) return 0;
    ordered(s, ms);
    let best = -INF;
    for (const m of ms) {
      const ns = makeMove(s, m);
      if (ns.dead === c) continue;
      const v = ns.turn === c ? ab(ns, depth - 1, alpha, beta, ply + 1) : -ab(ns, depth - 1, -beta, -alpha, ply + 1);
      if (aborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best === -INF ? evaluate(s) : best;
  }

  const LEVELS = {
    easy: { depth: 1, q: 0, noise: 170, blunder: 0.2, time: 600 },
    medium: { depth: 2, q: 3, noise: 40, blunder: 0.04, time: 1500 },
    pro: { depth: 4, q: 5, noise: 6, blunder: 0, time: 2400 },
    xtreme: { depth: 8, q: 8, noise: 0, blunder: 0, time: 4000 },
  };

  /* Returns the index of the chosen move in legalMoves(s). */
  function think(s, level) {
    const L = LEVELS[level] || LEVELS.medium;
    const legal = legalMoves(s);
    if (!legal.length) return -1;
    if (legal.length === 1) return 0;
    const c = s.turn;
    if (L.blunder && Math.random() < L.blunder) return Math.floor(Math.random() * legal.length);
    deadline = Date.now() + L.time; aborted = false; nodes = 0; QMAX = L.q;
    const root = legal.map((m, i) => ({ m, i, v: orderScore(s, m, c) })).sort((a, b) => b.v - a.v);
    let bestIdx = root[0].i;
    for (let d = 1; d <= L.depth; d++) {
      let alpha = -INF, bestV = -INF, bi = -1;
      for (const r of root) {
        const ns = makeMove(s, r.m);
        let v;
        if (ns.dead === opp(c)) v = MATE;
        else v = ns.turn === c ? ab(ns, d - 1, alpha, INF, 1) : -ab(ns, d - 1, -INF, -alpha, 1);
        if (aborted) break;
        if (L.noise) v += (Math.random() * 2 - 1) * L.noise;
        r.v = v;
        if (v > bestV) { bestV = v; bi = r.i; }
        if (!L.noise && v > alpha) alpha = v;
      }
      if (aborted) break;
      bestIdx = bi;
      root.sort((a, b) => b.v - a.v);
      if (bestV >= MATE - 100) break;
    }
    return bestIdx;
  }

  /* Cheap move picker for the menu's background exhibition game. */
  function quickPick(s) {
    const legal = legalMoves(s);
    if (!legal.length) return -1;
    let best = 0, bv = -INF;
    legal.forEach((m, i) => {
      const ns = makeMove(s, m);
      const v = (ns.dead ? MATE : -evaluate(ns)) + Math.random() * 90 + (m.k !== 'n' ? 25 : 0);
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }

  /* A small sample position for the Codex: the wildcard on d4 surrounded by a few pieces. */
  function demo(type) {
    const b = new Array(64).fill(null);
    const s = { b, turn: 'w', ep: -1, ply: 10, half: 0, lost: { w: ['N'], b: [] }, nid: 1, dead: null, walls: 0,
      wild: { w: [type], b: [] }, last: null, extra: false };
    const put = (f, r, t, c) => { b[SQ(f, r)] = newPiece(s, t, c, SQ(f, r)); };
    put(3, 3, type, 'w'); put(2, 2, 'N', 'w');
    put(4, 4, 'P', 'b'); put(3, 5, 'P', 'b'); put(1, 5, 'B', 'b'); put(3, 7, 'R', 'b'); put(6, 6, 'N', 'b');
    setCtx(s);
    const out = [];
    W[type].gen(s, 27, b[27], out);
    return { s, moves: out };
  }

  return { newGame, pickSlots, startType, legalMoves, makeMove, status, inCheck, findKing, think, quickPick, demo, value, evaluate,
    WILD_IDS, LEVELS, sqName: q => 'abcdefgh'[F(q)] + (R(q) + 1), F, R, SQ, stats: () => nodes };
}
if (typeof module !== 'undefined') module.exports = ChessEngine;
