/* Kingdom Clash: the computer opponent. It reads the same state the player sees (its own hand and
   energy, every troop on the field) and plays cards through KCSim.play, like a person would.

   It thinks in its own frame, where its side is the bottom (y >= 17), so the same code can play
   either team. Skill sets how fast it reacts, how often it misplaces a card and how long it waits
   before attacking. Trainer Owen is the gentlest setting. */
'use strict';

const KCBot = (() => {
  const S = KCSim;
  const SKILLS = {
    trainer: { react: [1.8, 3.2], sloppy: 0.45, attackAt: 9.8, idle: 0.35, fireballValue: 7, defend: 0.45 },
    normal: { react: [0.7, 1.4], sloppy: 0.15, attackAt: 8, idle: 0.1, fireballValue: 5, defend: 1 },
  };
  const ROLE = {
    tank: ['gorilla', 'wolves', 'gladiator', 'archers', 'hawks'],
    air: ['archers', 'snowman', 'hawks', 'fireball'],
    swarm: ['snowman', 'archers', 'gladiator', 'fireball', 'hawks'],
    ranged: ['gladiator', 'wolves', 'hawks', 'gorilla', 'rhino'],
    melee: ['wolves', 'gladiator', 'hawks', 'gorilla', 'archers'],
  };
  const MELEE = { wolves: 1, gladiator: 1, gorilla: 1, rhino: 1 };

  function create(team, opts) {
    opts = opts || {};
    return { team, skill: SKILLS[opts.skill || 'trainer'], rand: S.mulberry(opts.seed || 99), plan: null, wait: 2.5, lastAttack: 0 };
  }

  const my = (b, y) => S.own(b.team, y);
  const world = my; // the mirror is its own inverse

  function fit(b, s, card, x, y) {
    for (let i = 0; i < 14; i++) {
      const tx = Math.max(0.5, Math.min(S.W - 0.5, x + (i % 2 ? 1 : -1) * Math.floor(i / 4) * 0.8));
      const ty = Math.min(S.H - 0.5, y + Math.floor(i / 2) * 0.6);
      const px = Math.floor(tx) + 0.5, py = Math.floor(ty) + 0.5;
      if (S.canDeploy(s, b.team, card, px, world(b, py))) return { x: px, y: world(b, py) };
    }
    return null;
  }

  function update(b, s) {
    if (s.result) return;
    if (b.plan) {
      if (s.time < b.plan.at) return;
      const slot = s.hands[b.team].indexOf(b.plan.card);
      if (slot < 0) { b.plan = null; return; }
      if (s.energy[b.team] >= KC_CARDS[b.plan.card].cost) {
        const p = fit(b, s, b.plan.card, b.plan.x, b.plan.y);
        if (p) S.play(s, b.team, slot, p.x, p.y);
        if (b.plan.attack) b.lastAttack = s.time;
        b.plan = null;
        b.wait = 0.5 + b.rand() * 0.7;
      } else if (s.time > b.plan.at + 4) b.plan = null;
      return;
    }
    b.wait -= S.DT;
    if (b.wait > 0) return;
    b.wait = 0.3;
    const plan = decide(b, s);
    if (!plan) return;
    const K = b.skill;
    if (b.rand() < K.sloppy && !plan.exact) { plan.x += (b.rand() - 0.5) * 3; plan.y += (b.rand() - 0.5) * 2; }
    plan.at = s.time + (plan.quick ? 0.4 : K.react[0] + b.rand() * (K.react[1] - K.react[0]));
    b.plan = plan;
  }

  function decide(b, s) {
    const K = b.skill, me = b.team, E = s.energy[me], hand = s.hands[me];
    const troops = s.ents.filter(e => e.kind === 'troop' && !e.dead);
    const foes = troops.filter(e => e.team !== me).map(e => ({ e, x: e.x, y: my(b, e.y), v: KC_CARDS[e.card].cost / KC_CARDS[e.card].count }));
    const mine = troops.filter(e => e.team === me).map(e => ({ e, x: e.x, y: my(b, e.y), v: KC_CARDS[e.card].cost / KC_CARDS[e.card].count }));
    const has = id => hand.includes(id);
    const afford = id => KC_CARDS[id].cost <= E + 0.5;

    // 1. Fireball a big clump, or troops hitting a tower.
    if (has('fireball') && afford('fireball')) {
      let best = null, bv = 0;
      for (const f of foes) {
        let v = 0;
        for (const g of foes) if (Math.hypot(g.x - f.x, g.y - f.y) < 2.3) v += g.v;
        if (f.y > 20) v += 1;
        if (v > bv) { bv = v; best = f; }
      }
      if (best && bv >= K.fireballValue) {
        const lead = best.e.moving ? 0.8 : 0;
        return { card: 'fireball', x: best.x, y: best.y + lead, exact: true, quick: true };
      }
    }

    // 2. Defend the lane under the most pressure.
    const threats = foes.filter(f => f.y > 12.5);
    if (threats.length) {
      const lanes = { L: [], R: [] };
      for (const t of threats) lanes[S.laneOf(t.x)].push(t);
      const key = lanes.L.reduce((a, t) => a + t.v, 0) >= lanes.R.reduce((a, t) => a + t.v, 0) ? 'L' : 'R';
      const group = lanes[key].length ? lanes[key] : threats;
      const lead = group.reduce((a, t) => (t.y > a.y ? t : a), group[0]);
      const cx = group.reduce((a, t) => a + t.x, 0) / group.length;
      const value = group.reduce((a, t) => a + t.v, 0);
      const guard = mine.filter(m => Math.hypot(m.x - cx, m.y - lead.y) < 5.5).reduce((a, m) => a + m.v, 0);
      if (guard < value * K.defend) {
        const cards = group.map(t => t.e.card);
        const role = cards.includes('rhino') ? 'tank'
          : group.some(t => t.e.air) ? 'air'
          : cards.filter(c => c === 'wolves').length >= 3 ? 'swarm'
          : cards.some(c => c === 'archers' || c === 'snowman') ? 'ranged' : 'melee';
        const pick = ROLE[role].find(id => has(id) && afford(id) && id !== 'fireball' && id !== 'rhino')
          || hand.find(id => afford(id) && KC_CARDS[id].kind === 'troop' && id !== 'rhino');
        if (pick) {
          const ahead = Math.max(17.5, lead.y + (MELEE[pick] ? 2.2 : pick === 'hawks' ? 1.5 : 5));
          const tx = MELEE[pick] ? lead.x : (lead.x + (lead.x < 9 ? 3.5 : 14.5)) / 2;
          return { card: pick, x: tx, y: Math.min(30.5, ahead), quick: lead.y > 22 };
        }
        return null;
      }
    }

    // 3. Back up a push that is already crossing.
    const push = mine.find(m => m.e.card === 'rhino' && m.y < 19.5 && m.y > 11);
    if (push && E >= 4 && s.time - b.lastAttack > 2) {
      const pick = ['snowman', 'archers', 'hawks', 'gladiator', 'wolves'].find(id => has(id) && afford(id));
      if (pick) return { card: pick, x: push.x, y: Math.max(17.5, push.y + 2.5), attack: true };
    }

    // 4. Start a push once energy is high enough (a trainer sometimes just waits).
    if (E >= K.attackAt || (E >= 9.9 && b.rand() > K.idle)) {
      const enemy = 1 - me;
      const weak = ['L', 'R'].map(l => S.tower(s, enemy, l)).filter(t => !t.dead).sort((a, c) => a.hp - c.hp)[0];
      const lx = weak ? weak.x : (b.rand() < 0.5 ? 3.5 : 14.5);
      if (has('rhino') && afford('rhino')) return { card: 'rhino', x: lx < 9 ? 5.5 : 12.5, y: 30.5, attack: true };
      const pick = ['gladiator', 'hawks', 'archers', 'wolves', 'gorilla'].find(id => has(id) && afford(id));
      if (pick) return { card: pick, x: lx, y: 18.5, attack: true };
    }
    return null;
  }

  return { create, update };
})();
