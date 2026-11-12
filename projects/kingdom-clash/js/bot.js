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
    // The first tutorial opponent: slow, waits between cards, barely defends, never uses Fireball.
    tutorial: { react: [2.6, 4.2], sloppy: 0.6, attackAt: 10, idle: 0.6, fireballValue: 99, defend: 0.3, gap: [4, 7] },
    // Trainer Romeo, the second trainer: reacts in good time, defends most pushes, backs up his own.
    romeo: { react: [1.7, 2.9], sloppy: 0.35, attackAt: 9.6, idle: 0.3, fireballValue: 7.5, defend: 0.55, gap: [2.0, 3.4] },
    // Trainer Luc, the last trainer before the Trophy Road: quick, accurate, fireballs clumps.
    luc: { react: [1.4, 2.5], sloppy: 0.28, attackAt: 9.3, idle: 0.2, fireballValue: 6.5, defend: 0.62, gap: [1.7, 2.9] },
    normal: { react: [0.7, 1.4], sloppy: 0.15, attackAt: 8, idle: 0.1, fireballValue: 5, defend: 1 },
  };
  const ROLE = {
    tank: ['conductor', 'griffin', 'wraiths', 'cage', 'harpoon', 'coil', 'cannon', 'scarabshrine', 'dreadknight', 'footmen', 'gorilla', 'shardguards', 'dockraiders', 'bees', 'skeletons', 'wolves', 'prism', 'broadside', 'sparkbots',
      'gladiator', 'guardian', 'flail', 'archers', 'hawks', 'frostsprite', 'bramblenest', 'magmaturret'],
    air: ['conductor', 'bramblenest', 'archers', 'prism', 'drake', 'owl', 'phoenix', 'bees', 'wintersage', 'sparkbots', 'dockraiders', 'coil', 'snowman', 'hawks', 'griffin', 'frostsprite', 'spears', 'fireball'],
    // a building-chaser in the air (the Thunder Cloud): only air-hitters stop it
    airwin: ['conductor', 'griffin', 'phoenix', 'prism', 'archers', 'owl', 'drake', 'bees', 'coil', 'sparkbots', 'hawks', 'dockraiders', 'wintersage', 'snowman'],
    swarm: ['magmaturret', 'flail', 'drake', 'wintersage', 'arccannon', 'dreadknight', 'snowman', 'pots', 'archers', 'guardian', 'gladiator', 'spears', 'fireball', 'hawks', 'owl', 'frostsprite'],
    ranged: ['harpoon', 'cage', 'gladiator', 'dockraiders', 'bees', 'skeletons', 'shardguards', 'wolves', 'hawks', 'flail', 'footmen', 'gorilla', 'dreadknight', 'frostsprite', 'rhino'],
    melee: ['skeletons', 'pots', 'wintersage', 'bees', 'wolves', 'prism', 'gladiator', 'flail', 'coil', 'cannon', 'drake', 'hawks', 'sparkbots', 'footmen', 'guardian', 'gorilla', 'broadside',
      'owl', 'archers', 'dockraiders', 'shardguards', 'phoenix', 'arccannon', 'magmaturret', 'cage', 'bramblenest', 'scarabshrine', 'barracks'],
  };
  const MELEE = { wolves: 1, gladiator: 1, gorilla: 1, rhino: 1, skeletons: 1, footmen: 1, flail: 1, bees: 1, griffin: 1,
    frostsprite: 1, sunsprite: 1, dockraiders: 1, shardguards: 1, harpoon: 1, guardian: 1, phoenix: 1, wraiths: 1, dreadknight: 1, icegiant: 1 };
  // cards that go for towers: they start pushes, they don't defend
  const WIN = ['rhino', 'ramcart', 'camel', 'thundercloud', 'titan', 'icegiant', 'titanling', 'smelter'];
  const NO_DEFEND = { rhino: 1, ramcart: 1, camel: 1, mole: 1, thundercloud: 1, titan: 1, icegiant: 1, drill: 1, sunsprite: 1, smelter: 1,
    dunemortar: 1, ballista: 1, foundry: 1, barracks: 1 };
  // what a unit is worth, for the units cards bring with them (they cost nothing themselves)
  const WORTH = { raider: 1, raidergun: 0.8, imp: 1.2, wraith: 0.45, titanling: 2.5, phoenixegg: 2.5, ramsoldier: 1.2,
    thornling: 0.8, scarab: 0.35, frostbrute: 2.5, buccaneer: 1.6, sentinel: 2, emberling: 0.8 };
  const worth = id => WORTH[id] !== undefined ? WORTH[id] : KC_CARDS[id].cost / KC_CARDS[id].count;
  // the spells it casts on clumps: how many energy's worth of enemies a cast must hit (above the skill's
  // Fireball setting), and whether it only counts what it would finish off
  const SPELLS = [
    ['meteor', 3.5, false], ['judgment', 2, false], ['collapse', 1, false], ['fireball', 0, false], ['ashfall', 0.5, false], ['flashfreeze', 1.5, false],
    ['spears', -1, true], ['gemflash', -2, true], ['glacierslam', -1.5, true], ['sandstorm', -0.5, false], ['magmaquake', -0.5, false], ['soulblight', -1.5, true],
    ['cyclone', 0, false], ['thornroller', -2, true], ['powderkeg', -2, true],
  ];
  // spells that don't touch flying troops, and the ones placed on your own side (they roll forward)
  const GROUND = { magmaquake: 1, thornroller: 1, powderkeg: 1 }, ROLLS = { thornroller: 1, powderkeg: 1 };

  function create(team, opts) {
    opts = opts || {};
    // A skill is a name from SKILLS or a settings object of the same shape (the trophy bots build one).
    const skill = typeof opts.skill === 'object' ? opts.skill : SKILLS[opts.skill || 'trainer'];
    return { team, skill, rand: S.mulberry(opts.seed || 99), plan: null, wait: 2.5, lastAttack: 0, lastPlay: null };
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
      if (s.energy[b.team] >= S.costOf(s, b.team, b.plan.card)) {
        const p = fit(b, s, b.plan.card, b.plan.x, b.plan.y);
        if (p && S.play(s, b.team, slot, p.x, p.y) === 'ok' && !KC_CARDS[b.plan.card].mirror) b.lastPlay = { card: b.plan.card, x: b.plan.x, y: b.plan.y, at: s.time };
        if (b.plan.attack) b.lastAttack = s.time;
        b.plan = null;
        const gap = b.skill.gap || [0.5, 1.2];
        b.wait = gap[0] + b.rand() * (gap[1] - gap[0]);
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
    // a 1-health copy (Prism Echo) is worth little
    const val = e => (e.clone ? 0.2 : worth(e.card));
    const foes = troops.filter(e => e.team !== me).map(e => ({ e, x: e.x, y: my(b, e.y), v: val(e) }));
    const mine = troops.filter(e => e.team === me).map(e => ({ e, x: e.x, y: my(b, e.y), v: val(e) }));
    const has = id => hand.includes(id);
    const afford = id => S.costOf(s, me, id) <= E + 0.5;
    const lvlOf = id => KCSim.levelMult(s.cardLevels[me] && s.cardLevels[me][id] || s.levels[me] || 1);

    // 1. A spell on a big clump, or on troops hitting a tower. Fireball counts everything it hits;
    //    Spears only counts what it would finish off (swarms, flyers, ranged troops).
    for (const [spell, extra, finishOnly] of SPELLS) {
      if (!has(spell) || !afford(spell)) continue;
      const c = KC_CARDS[spell], reach = (ROLLS[spell] ? 1.4 : c.area) - 0.2, dmg = c.dmg * lvlOf(spell);
      let best = null, bv = 0;
      for (const f of foes) {
        // a rolling spell goes down from your side: only what is on (or near) your side
        if (ROLLS[spell] && (f.y < 16 || f.e.air)) continue;
        if (GROUND[spell] && f.e.air) continue;
        let v = 0;
        for (const g of foes) {
          if (GROUND[spell] && g.e.air) continue;
          if (Math.hypot(g.x - f.x, g.y - f.y) >= reach && !(ROLLS[spell] && Math.abs(g.x - f.x) < c.area && g.y <= f.y && f.y - g.y < 8)) continue;
          if (!finishOnly || g.e.hp <= dmg) v += g.v * (spell === 'sandstorm' ? 0.8 : 1);
          // a stun is worth more on something charging up (the Arc Cannon, the Griffin's beam)
          if (c.stun && (g.e.chargeT > 2 || g.e.beamTime > 1.5)) v += 3;
        }
        if (f.y > 20) v += 1;
        if (v > bv) { bv = v; best = f; }
      }
      const need = spell === 'fireball' ? K.fireballValue : Math.max(spell === 'gemflash' ? 2.5 : 3.5, K.fireballValue + extra);
      if (best && bv >= need) {
        // a roll starts just behind them on your side; a cyclone pulls them toward your King Tower
        if (ROLLS[spell]) return { card: spell, x: best.x, y: Math.min(30.5, Math.max(17.5, best.y + 1.2)), exact: true, quick: true };
        const lead = best.e.moving && !c.instant ? 0.8 : 0;
        return { card: spell, x: best.x, y: best.y + lead + (spell === 'cyclone' ? 1.5 : 0), exact: true, quick: true };
      }
    }
    // Judgment Bolt or Abyssal Collapse onto a tower they would bring down
    for (const id of ['judgment', 'collapse']) if (has(id) && afford(id)) {
      const td = KC_CARDS[id].dmg * KC_CARDS[id].towerPct * lvlOf(id) * (id === 'collapse' ? 3 : 1);
      const low = s.ents.find(e => e.kind === 'tower' && e.team !== me && !e.dead && e.hp <= td);
      if (low) return { card: id, x: low.x, y: my(b, low.y), exact: true, quick: true };
    }
    // a Doom Meteor finishes off a tower it would bring down
    if (has('meteor') && afford('meteor')) {
      const md = KC_CARDS.meteor.dmg * KC_CARDS.meteor.towerPct * KCSim.levelMult(s.cardLevels[me] && s.cardLevels[me].meteor || 1);
      const low = s.ents.find(e => e.kind === 'tower' && e.team !== me && !e.dead && e.hp <= md);
      if (low) return { card: 'meteor', x: low.x, y: my(b, low.y), exact: true, quick: true };
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
      const guards = mine.filter(m => Math.hypot(m.x - cx, m.y - lead.y) < 5.5), guard = guards.reduce((a, m) => a + m.v, 0);
      // defenders already fighting and hurt: a Sun Sprite onto the attackers heals them
      const hurt = guards.filter(m => m.e.hp < m.e.maxHp * 0.65).reduce((a, m) => a + m.v, 0);
      if (hurt >= 2 && has('sunsprite') && afford('sunsprite')) return { card: 'sunsprite', x: lead.x, y: Math.min(30.5, Math.max(17.5, lead.y + 2)), quick: true };
      // Briar Bind holds a big attacker (or drags a flier down) near our tower
      const big = group.reduce((a, t) => (t.v > a.v ? t : a), group[0]);
      if (has('briarbind') && afford('briarbind') && big.v >= 3 && big.y > 17) return { card: 'briarbind', x: big.x, y: big.y, exact: true, quick: true };
      // Heaven's Guard lands on attackers already on our side
      if (has('heavensguard') && afford('heavensguard') && lead.y >= 18 && guard < value * K.defend) return { card: 'heavensguard', x: lead.x, y: Math.min(30.5, lead.y + 0.5), exact: true, quick: true };
      if (guard < value * K.defend) {
        const cards = group.map(t => t.e.card);
        const role = cards.includes('thundercloud') ? 'airwin' : cards.some(c => WIN.includes(c)) ? 'tank'
          : group.some(t => t.e.air) ? 'air'
          : cards.filter(c => c === 'wolves').length >= 3 ? 'swarm'
          : cards.some(c => c === 'archers' || c === 'snowman') ? 'ranged' : 'melee';
        const pick = ROLE[role].find(id => has(id) && afford(id) && KC_CARDS[id].kind !== 'spell' && !NO_DEFEND[id])
          || hand.find(id => afford(id) && KC_CARDS[id].kind !== 'spell' && !NO_DEFEND[id]);
        if (pick && KC_CARDS[pick].kind === 'building') {
          // a building goes in the middle of our side, a little toward the threatened lane, to pull it in
          return { card: pick, x: lead.x < 9 ? 7.5 : 10.5, y: 22.5, quick: lead.y > 21 };
        }
        if (pick) {
          const ahead = Math.max(17.5, lead.y + (MELEE[pick] ? 2.2 : pick === 'hawks' || pick === 'owl' ? 2.5 : 5));
          const tx = MELEE[pick] ? lead.x : (lead.x + (lead.x < 9 ? 3.5 : 14.5)) / 2;
          return { card: pick, x: tx, y: Math.min(30.5, ahead), quick: lead.y > 22 };
        }
        return null;
      }
    }

    // a big push of ours near their towers: Overclock speeds it up, Prism Echo doubles it
    const front = mine.filter(m => m.y < 15 && !m.e.clone);
    if (front.length) {
      const c0 = front.reduce((a, m) => (m.y < a.y ? m : a), front[0]);
      const near = front.filter(m => Math.hypot(m.x - c0.x, m.y - c0.y) < 3);
      const nv = near.reduce((a, m) => a + m.v, 0);
      if (has('prismecho') && afford('prismecho') && nv >= 5) return { card: 'prismecho', x: c0.x, y: c0.y + 0.6, exact: true, quick: true, attack: true };
      if (has('overclock') && afford('overclock') && nv >= 4 && near.length >= 2) return { card: 'overclock', x: c0.x, y: c0.y, exact: true, quick: true, attack: true };
    }
    // Divine Reflection: copy a card worth copying, where it went, while it is still useful
    if (has('reflection') && b.lastPlay && s.last[me] && afford('reflection') && E >= S.costOf(s, me, 'reflection') + 0.5) {
      const L = b.lastPlay, lc = KC_CARDS[L.card];
      if (L.card === s.last[me] && s.time - L.at < 3 && lc.cost >= 3 && !['foundry', 'reflection'].includes(L.card)) return { card: 'reflection', x: L.x, y: L.y, exact: true, quick: true };
    }
    // 3. Back up a push that is already crossing.
    const push = mine.find(m => WIN.includes(m.e.card) && m.y < 19.5 && m.y > 11);
    if (push && E >= 4 && s.time - b.lastAttack > 2) {
      const pick = ['arccannon', 'wintersage', 'snowman', 'drake', 'owl', 'pots', 'prism', 'sparkbots', 'archers', 'hawks', 'griffin', 'phoenix', 'guardian', 'bees', 'flail', 'dockraiders', 'gladiator', 'wolves']
        .find(id => has(id) && afford(id));
      if (pick) return { card: pick, x: push.x, y: Math.max(17.5, push.y + 2.5), attack: true };
      // a Sun Sprite right behind the push, to heal it when it bursts
      if (has('sunsprite') && afford('sunsprite') && push.e.hp < push.e.maxHp * 0.8) return { card: 'sunsprite', x: push.x, y: Math.max(17.5, push.y + 1.5), attack: true };
    }

    // an Energy Foundry behind a tower while nothing is attacking
    if (has('foundry') && afford('foundry') && !foes.some(f => f.y > 13) && E >= 7) return { card: 'foundry', x: b.rand() < 0.5 ? 3.5 : 14.5, y: 28.5 };
    // cheap spawners and traps while it is quiet, to have something ready
    if (!foes.some(f => f.y > 14) && E >= 8) for (const id of ['scarabshrine', 'bramblenest']) if (has(id) && afford(id)) return { card: id, x: b.rand() < 0.5 ? 7.5 : 10.5, y: 24.5 };
    // 4. Start a push once energy is high enough (a trainer sometimes just waits).
    if (E >= K.attackAt || (E >= 9.9 && b.rand() > K.idle)) {
      const enemy = 1 - me;
      const weak = ['L', 'R'].map(l => S.tower(s, enemy, l)).filter(t => !t.dead).sort((a, c) => a.hp - c.hp)[0];
      const lx = weak ? weak.x : (b.rand() < 0.5 ? 3.5 : 14.5);
      // the Mole tunnels to just behind the weakest tower (sometimes before anything else)
      const moleAt = weak && { card: 'mole', x: weak.x + (weak.x < 9 ? -0.5 : 0.5), y: my(b, weak.y) - 2.4, attack: true, exact: true };
      if (moleAt && has('mole') && afford('mole') && b.rand() < 0.45) return moleAt;
      // cards that go straight to a tower from anywhere: the barrel and the portal on it, the drill beside it
      if (weak) {
        const ty = my(b, weak.y);
        if (has('barrel') && afford('barrel') && b.rand() < 0.7) return { card: 'barrel', x: weak.x, y: ty + 1.6, attack: true, exact: true };
        if (has('abyss') && afford('abyss') && b.rand() < 0.7) return { card: 'abyss', x: weak.x + (weak.x < 9 ? 0.8 : -0.8), y: ty + 1.2, attack: true, exact: true };
        if (has('drill') && afford('drill') && b.rand() < 0.7) return { card: 'drill', x: weak.x + (weak.x < 9 ? 2.6 : -2.6), y: ty - 0.5, attack: true, exact: true };
      }
      // siege: the Dune Mortar or the Golden Ballista at the bridge facing the weaker tower
      for (const id of ['ballista', 'dunemortar']) if (has(id) && afford(id) && weak) return { card: id, x: lx < 9 ? 3.5 : 14.5, y: 18.6, attack: true };
      // spawners from the back; the Walking Smelter on the weak lane
      if (has('barracks') && afford('barracks')) return { card: 'barracks', x: lx < 9 ? 6.5 : 11.5, y: 24.5, attack: true };
      if (has('smelter') && afford('smelter')) return { card: 'smelter', x: lx, y: 22.5, attack: true };
      // the Steel Titan walks from behind the King Tower; the Icebound Giant leads at the bridge
      if (has('titan') && afford('titan')) return { card: 'titan', x: lx < 9 ? 6.5 : 11.5, y: 30.5, attack: true };
      if (has('rhino') && afford('rhino')) return { card: 'rhino', x: lx < 9 ? 5.5 : 12.5, y: 30.5, attack: true };
      if (has('icegiant') && afford('icegiant')) return { card: 'icegiant', x: lx, y: 18.5, attack: true };
      // a Camel Jockey from the back, a Ram Cart right at the bridge for a fast hit
      if (has('camel') && afford('camel')) return { card: 'camel', x: lx < 9 ? 4.5 : 13.5, y: 29.5, attack: true };
      // the Thunder Cloud drifts in from behind the King Tower's side, on the weak lane
      if (has('thundercloud') && afford('thundercloud')) return { card: 'thundercloud', x: lx < 9 ? 3.5 : 14.5, y: 27.5, attack: true };
      if (has('ramcart') && afford('ramcart')) return { card: 'ramcart', x: lx, y: 18.5, attack: true };
      if (moleAt && has('mole') && afford('mole')) return moleAt;
      const pick = ['dreadknight', 'broadside', 'gladiator', 'flail', 'phoenix', 'drake', 'hawks', 'owl', 'guardian', 'harpoon', 'archers', 'prism', 'sparkbots', 'footmen', 'dockraiders',
        'shardguards', 'wraiths', 'wolves', 'gorilla', 'wintersage', 'arccannon'].find(id => has(id) && afford(id));
      if (pick) return { card: pick, x: lx, y: 18.5, attack: true };
      // nothing else to start with: the anywhere cards anyway
      if (weak) for (const id of ['barrel', 'abyss', 'drill']) if (has(id) && afford(id)) return { card: id, x: weak.x, y: my(b, weak.y) + (id === 'drill' ? -0.5 : 1.4), attack: true, exact: true };
    }
    return null;
  }

  return { create, update };
})();
