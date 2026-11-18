const { chromium, devices } = require('playwright');
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
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto('http://localhost:8765/test.html');
  await p.waitForTimeout(600);
  await p.keyboard.press('Space');
  await p.waitForFunction(() => !document.getElementById('sirsc-intro'), null, { timeout: 15000 });
  await p.click('.corner-l .pill:has-text("Sign in")');
  await p.fill('#wc-user', 'PartyHost');
  await p.fill('#wc-pass', 'password1234');
  await p.click('.sheet .btn:has-text("Sign in")');
  await p.waitForSelector('.corner-l .acct-name', { timeout: 8000 });
  await p.click('.type-btn[data-tab="party"]');
  await p.waitForTimeout(700);
  await shot(p, '10-party-tab');
  await p.click('.mode-card:has-text("Friends")');
  await p.waitForSelector('.sheet .fr-row');
  await p.waitForTimeout(500);
  // accept mia-r's request
  await p.click('.sheet .fr-row:has-text("mia-r") .btn:has-text("Accept")');
  await p.waitForTimeout(900);
  await shot(p, '11-friends');
  // race Atlas_Reads: hosts a Warden Chat party and invites
  await p.click('.sheet .fr-row:has-text("Atlas_Reads") .btn:has-text("Race")');
  await p.waitForSelector('.lobby', { timeout: 10000 });
  await p.click('.players-card .btn:has-text("Invite friends")');
  await p.waitForSelector('.sheet .fr-row:has-text("Quill.Fox")');
  await p.click('.sheet .fr-row:has-text("Quill.Fox") .btn:has-text("Invite")');
  await p.waitForTimeout(400);
  await p.click('.sheet-x');
  await p.waitForFunction(() => document.querySelectorAll('.plist .prow').length >= 3, null, { timeout: 15000 });
  console.log('players', await p.$$eval('.plist .pname', e => e.map(x => x.textContent)));
  await p.click('text=Random route');
  await p.waitForFunction(() => document.querySelectorAll('.page-card:not(.empty)').length === 2, null, { timeout: 15000 });
  await p.waitForTimeout(600);
  await shot(p, '12-party-lobby');
  const titles = await p.$$eval('.pc-title', els => els.map(e => e.textContent));
  await p.click('.startbar .btn.primary');
  await p.waitForSelector('.racebar', { timeout: 10000 });
  await p.waitForTimeout(9000);
  await shot(p, '13-party-race');
  console.log('board', await p.$$eval('.blist .brow', e => e.map(x => x.textContent.replace(/\s+/g, ' '))));
  // the host plays a slow 2-step detour so a bot can win sometimes; then go straight
  const steps = path(byT.get(titles[0]), byT.get(titles[1]));
  for (const step of steps.slice(1)) {
    const st = await p.evaluate(() => !!document.querySelector('.res-card'));
    if (st) break;
    await p.waitForFunction((t) => !!document.querySelector(`.article a.wl[data-to="${CSS.escape(t)}"]`) || !!document.querySelector('.res-card'), step, { timeout: 20000 });
    if (await p.evaluate(() => !!document.querySelector('.res-card'))) break;
    await p.$eval(`.article a.wl[data-to="${step.replace(/"/g, '\\"')}"]`, a => a.click());
    await p.waitForTimeout(2500);
  }
  await p.waitForSelector('.res-card', { timeout: 30000 });
  await p.waitForTimeout(3500);
  await shot(p, '14-party-results');
  console.log('headline', await p.textContent('.res-head h2'));
  console.log('errors', errs);
  // phone home
  const ph = await b.newPage({ ...devices['iPhone 13'] });
  ph.on('pageerror', e => errs.push('phone ' + e.message));
  await ph.goto('http://localhost:8765/test.html');
  await ph.waitForTimeout(600);
  await ph.tap('body').catch(() => {});
  await ph.waitForFunction(() => !document.getElementById('sirsc-intro'), null, { timeout: 15000 });
  await ph.waitForTimeout(1500);
  await shot(ph, '15-phone-home');
  await ph.evaluate(() => document.querySelector('.corner-l .pill:last-child').click());
  await ph.waitForTimeout(1200);
  await shot(ph, '16-phone-shop');
  console.log('phone overflow', await ph.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  console.log('errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
