const { chromium } = require('playwright');
const fs = require('fs');
const idx = JSON.parse(fs.readFileSync(__dirname + '/../dist/data/index.json'));
const byT = new Map(idx.t.map((t, i) => [t, i]));
function path(a, b) {
  const prev = new Map([[a, -1]]); let fr = [a];
  while (fr.length) { const nx = []; for (const x of fr) for (const y of idx.l[x]) if (!prev.has(y)) { prev.set(y, x); nx.push(y); } fr = nx; if (prev.has(b)) break; }
  const out = []; let c = b; while (c !== -1) { out.unshift(c); c = prev.get(c); } return out.map(i => idx.t[i]);
}
const shot = (p, n) => p.screenshot({ path: __dirname + '/../shots/' + n + '.png' });
(async () => {
  fs.mkdirSync(__dirname + '/shots', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto('http://localhost:8765/test.html');
  await p.waitForTimeout(800);
  await shot(p, '01-intro-gate');
  await p.keyboard.press('Space');
  await p.waitForTimeout(3600);
  await shot(p, '02-intro-mid');
  await p.waitForFunction(() => !document.getElementById('sirsc-intro'), null, { timeout: 15000 });
  await p.waitForSelector('.home .mode-card');
  await p.waitForTimeout(1500);
  await shot(p, '03-home');
  // sign in (demo)
  await p.click('.corner-l .pill:has-text("Sign in")');
  await p.fill('#wc-user', 'SirTester');
  await p.fill('#wc-pass', 'password1234');
  await p.click('.sheet .btn.alt:has-text("Create account")');
  await p.waitForSelector('.corner-l .acct-name', { timeout: 8000 });
  await p.waitForTimeout(1500);
  await shot(p, '04-home-signed-in');
  // shop: buy a page with coins, an avatar with diamonds
  await p.click('.corner-l .pill:has-text("Shop")');
  await p.waitForSelector('.shop-screen .item');
  await p.waitForTimeout(600);
  await p.click('.shop-grid .item[data-preview="paper:midnight"] [data-buy="paper:midnight|coins"]');
  await p.click('.shop-grid .item[data-preview="paper:midnight"] [data-buy="paper:midnight|coins"]');
  await p.waitForSelector('.shop-grid .item[data-preview="paper:midnight"] .equipped', { timeout: 5000 });
  await p.click('.shop-tabs button[data-tab="avatar"]');
  await p.click('[data-buy="avatar:dragon|diamonds"]');
  await p.click('[data-buy="avatar:dragon|diamonds"]');
  await p.waitForSelector('.item[data-preview="avatar:dragon"] .equipped', { timeout: 5000 });
  await p.click('.shop-tabs button[data-tab="links"]');
  await p.click('[data-buy="links:neon|coins"]'); await p.click('[data-buy="links:neon|coins"]');
  await p.waitForSelector('.item[data-preview="links:neon"] .equipped', { timeout: 5000 });
  await p.click('.shop-tabs button[data-tab="finale"]');
  await p.click('[data-buy="finale:fireworks|coins"]'); await p.click('[data-buy="finale:fireworks|coins"]');
  await p.waitForTimeout(900);
  await shot(p, '05-shop');
  await p.click('.shop-tabs button[data-tab="member"]');
  await p.click('[data-shop="demo-member"]');
  await p.waitForTimeout(1200);
  await shot(p, '06-shop-member');
  console.log('wallet', await p.textContent('.shop-wallet'));
  await p.click('.shop-back');
  await p.waitForTimeout(500);
  // quick medium solo race
  await p.click('.mode-card:has-text("Medium")');
  await p.waitForSelector('.racebar', { timeout: 15000 });
  await p.waitForTimeout(4300);
  const route = await p.$$eval('.rb-route .rchip', e => e.map(x => x.textContent.trim()));
  console.log('route', route);
  const steps = path(byT.get(route[0]), byT.get(route[1]));
  for (const step of steps.slice(1)) {
    await p.waitForFunction((t) => !!document.querySelector(`.article a.wl[data-to="${CSS.escape(t)}"]`), step, { timeout: 15000 });
    if (step === steps[1]) await shot(p, '07-race-midnight');
    await p.$eval(`.article a.wl[data-to="${step.replace(/"/g, '\\"')}"]`, a => a.click());
    await p.waitForTimeout(1300);
  }
  await p.waitForSelector('.res-card .rw-total', { timeout: 15000 });
  await p.waitForTimeout(2200);
  await shot(p, '08-results-coins');
  console.log('reward', (await p.textContent('.rw-box')).replace(/\s+/g, ' '));
  console.log('errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
