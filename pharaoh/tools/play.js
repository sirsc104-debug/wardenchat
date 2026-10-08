// Screenshot helper: node tools/play.js <out-prefix>  (needs Playwright)
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +process.env.W || 1280, height: +process.env.H || 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + process.cwd() + '/index.html');
  await p.waitForTimeout(500);
  await p.fill('#welcome-name', 'Nefertari'); await p.press('#welcome-name', 'Enter');
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + '-1-start.png' });
  await p.evaluate((PH) => {
    const { Game, D } = SOTP; const S = Game.get();
    S.res.gold = 5e6; S.res.goop = 5e6; S.res.gems = 500;
    S.buildings.find(b => b.type === 'pyramid').level = PH;
    const ph = Game.ph();
    for (const id of D.BUILDING_ORDER) {
      if (id === 'pyramid' || id === 'builderHut') continue;
      let n = 0;
      while (Game.countOf(id) < D.countAllowed(id, ph) && n++ < (id === 'wall' ? 0 : 99)) {
        const s = D.B[id].size; const spot = Game.findSpot(s + 0, 22, 22); if (!spot) break;
        S.buildings.push({ id: S.uid++, type: id, x: spot[0], y: spot[1], level: D.maxLevel(id, ph), upgrading: null, stored: D.B[id].produces ? 2000 : undefined });
      }
    }
    // a ring of walls around the core
    const cx = 22, cy = 22, R = 8;
    for (let i = -R; i <= R; i++) for (const [x, y] of [[cx + i, cy - R], [cx + i, cy + R], [cx - R, cy + i], [cx + R, cy + i]]) if (!Game.occupied(x, y, 1, 1)) S.buildings.push({ id: S.uid++, type: 'wall', x, y, level: D.maxLevel('wall', ph), upgrading: null });
    S.army = { spearman: 20, archer: 20, shieldBearer: 4, chariot: 4, sandMage: 4, warElephant: 1, phoenix: 1 };
    Game.save();
  }, +(process.env.PH || 7));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '-2-town.png' });
  await p.evaluate(() => { const r = SOTP.App.renderer; r.cam.z = 1.4; r.cam.x = 0; r.cam.y = 22 * 32; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + '-3-zoom.png' });
  await p.click('#btn-attack'); await p.waitForTimeout(600);
  await p.evaluate(() => { const A = SOTP.App, B = A.bt; let i = 0; for (const t of SOTP.D.TROOP_ORDER) while (B.left[t]) { B.pick = t; const s = A.renderer.toScreen(3 + (i % 8) * 0.6, 20 + Math.floor(i / 8) * 0.7); if (!A.deployAt(s[0], s[1], true)) B.left[t]--; i++; } });
  await p.waitForTimeout(7000);
  await p.screenshot({ path: out + '-4-battle.png' });
  await p.evaluate(() => { const r = SOTP.App.renderer; r.cam.z = 1.5; const u = SOTP.App.bt.battle.troops.find(t => !t.dead); if (u) { r.cam.x = SOTP.U.isoX(u.x, u.y); r.cam.y = SOTP.U.isoY(u.x, u.y); } });
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + '-5-battlezoom.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
