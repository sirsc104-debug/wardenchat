globalThis.SOTP = {};
for (const f of ['util', 'data', 'battle', 'basegen']) require('../js/' + f + '.js');
const { D, U, BaseGen, BattleSim } = SOTP;
const ph = +process.argv[2] || 11, s = +process.argv[3] || 1;
const layout = BaseGen.generateBase(ph, s * 7919 + ph);
const rng = U.makeRng(s * 31 + ph);
const { army, levels } = BattleSim.planArmy(ph, rng);
console.log('army', JSON.stringify(army), JSON.stringify(levels));
const b0 = new SOTP.Battle({ layout, seed: s, troopLevels: levels });
const list = BattleSim.planDeploy(b0, army, rng);
const b = new SOTP.Battle({ layout, seed: s, troopLevels: levels });
let i = 0; b.reserve = list.length;
const dmgBy = {}; const orig = b.damageUnit.bind(b);
let curSrc = null;
const ud = b.updateDefense.bind(b); b.updateDefense = (x) => { curSrc = x.type; ud(x); curSrc = null; };
const up = b.updateProjectiles.bind(b); b.updateProjectiles = () => { curSrc = 'proj'; up(); curSrc = null; };
const ut = b.updateTraps.bind(b); b.updateTraps = () => { curSrc = 'trap'; ut(); curSrc = null; };
const uz = b.updateZones.bind(b); b.updateZones = () => { curSrc = 'zone'; uz(); curSrc = null; };
b.damageUnit = (u, a) => { const k = (curSrc || 'unit'); dmgBy[k] = (dmgBy[k] || 0) + Math.min(a, Math.max(0,u.hp)); orig(u, a); };
const projSrc = {};
while (!b.ended) {
  while (i < list.length && list[i].tick <= b.tick) { const d = list[i++]; b.reserve--; b.deploy(d.type, levels[d.type] || 1, d.x, d.y); }
  for (const p of b.projectiles) if (p.from != null && !p._c) { p._c = 1; projSrc[b.buildings[p.from].type] = (projSrc[b.buildings[p.from].type] || 0) + p.dmg; }
  b.step(); b.fx.length = 0;
  if (b.tick % 300 === 0) console.log('t', b.time, 'alive', b.troops.filter(u => !u.dead && u.side === 'att').map(u => u.type[0] + u.type[1]).join(''), b.destruction + '%');
}
console.log(b.result(), 'deployed', b.deployed, 'of', list.length);
console.log('dmg to troops', dmgBy, 'proj fired by', projSrc);
const defs = b.buildings.filter(x => x.def.isDefense);
console.log('defenses destroyed', defs.filter(x => x.destroyed).length, '/', defs.length, 'walls', b.buildings.filter(x => x.def.isWall && x.destroyed).length);
