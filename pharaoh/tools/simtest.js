globalThis.SOTP = {};
for (const f of ['util', 'data', 'battle', 'basegen']) require('../js/' + f + '.js');
const { D, U, BaseGen, BattleSim } = SOTP;
const t0 = Date.now();
for (let ph = 1; ph <= 11; ph++) {
  const row = [];
  for (let s = 1; s <= 6; s++) {
    const layout = BaseGen.generateBase(ph, s * 7919 + ph);
    const rng = U.makeRng(s * 31 + ph);
    const { army, levels } = BattleSim.planArmy(ph, rng);
    const b0 = new SOTP.Battle({ layout, seed: s, troopLevels: levels, loot: { gold: 1000, goop: 1000 } });
    const list = BattleSim.planDeploy(b0, army, rng);
    const b = BattleSim.simulate({ layout, seed: s, troopLevels: levels, loot: { gold: 1000, goop: 1000 } }, list);
    const r = b.result();
    row.push(`${r.stars}★${r.destruction}% ${Math.round(r.time)}s g${r.stolen.gold}`);
  }
  const L = BaseGen.generateBase(ph, 5);
  console.log('PH' + ph, 'bldgs', L.length, 'walls', L.filter(b => b.type === 'wall').length, '|', row.join(' | '));
}
console.log('ms', Date.now() - t0);
