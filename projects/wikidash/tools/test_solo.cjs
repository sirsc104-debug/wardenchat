const { chromium } = require('playwright');
const fs = require('fs');
const idx = JSON.parse(fs.readFileSync(__dirname + '/../dist/data/index.json'));
const byT = new Map(idx.t.map((t, i) => [t, i]));
function path(a, b) {
  const prev = new Map([[a, -1]]); let fr = [a];
  while (fr.length) { const nx = []; for (const x of fr) for (const y of idx.l[x]) if (!prev.has(y)) { prev.set(y, x); nx.push(y); } fr = nx; if (prev.has(b)) break; }
  const out = []; let c = b; while (c !== -1) { out.unshift(c); c = prev.get(c); } return out.map(i => idx.t[i]);
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto('http://localhost:8765/test.html');
  await p.waitForSelector('.landing');
  await p.waitForTimeout(3500);
  await p.screenshot({ path: __dirname + '/../shots/landing.png' });
  await p.fill('#name', 'Tester');
  await p.click('text=Race solo');
  await p.waitForSelector('.lobby', { timeout: 15000 });
  await p.click('text=Random route');
  await p.waitForFunction(() => document.querySelectorAll('.page-card:not(.empty)').length === 2, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: __dirname + '/../shots/lobby.png', fullPage: false });
  const titles = await p.$$eval('.pc-title', els => els.map(e => e.textContent));
  console.log('route', titles, await p.textContent('.route-hint'));
  await p.click('.startbar .btn.primary');
  await p.waitForSelector('.racebar');
  await p.waitForTimeout(4200);
  const route = path(byT.get(titles[0]), byT.get(titles[1]));
  console.log('path', route);
  for (const step of route.slice(1)) {
    await p.waitForFunction((t) => !!document.querySelector(`.article a.wl[data-to="${CSS.escape(t)}"]`), step, { timeout: 15000 });
    if (step === route[1]) await p.screenshot({ path: __dirname + '/../shots/race.png' });
    await p.$eval(`.article a.wl[data-to="${step.replace(/"/g, '\\"')}"]`, a => a.click());
    await p.waitForTimeout(700);
  }
  await p.waitForSelector('.res-card', { timeout: 15000 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: __dirname + '/../shots/results.png' });
  console.log('headline', await p.textContent('.res-head h2'), '|', await p.textContent('.res-sub'));
  console.log('errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
