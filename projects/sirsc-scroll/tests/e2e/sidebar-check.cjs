const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.argv[2] || 'http://localhost:4174/'); await p.waitForTimeout(800);
  await p.fill('input[name=username]', 'sidebar'); await p.fill('input[name=password]', 'pass1234'); await p.click('.auth-submit'); await p.waitForTimeout(1500);
  if (await p.locator('.modal-layer button:has-text("Apply to feeds")').count()) await p.click('.modal-layer button:has-text("Apply to feeds")');
  await p.waitForTimeout(600);
  for (const label of ['Explore', 'Saved', 'History', 'Notifications', 'Profile', 'Settings', 'Trending', 'Following', 'For You']) {
    const before = await p.evaluate(() => location.hash);
    const el = p.locator('.sidebar .nav-item', { hasText: label }).first();
    let note = '';
    try { await el.click({ timeout: 3000 }); } catch (e) { note = 'CLICK FAILED: ' + e.message.split('\n').slice(0, 6).join(' | '); }
    await p.waitForTimeout(600);
    const after = await p.evaluate(() => location.hash);
    const top = await p.evaluate(() => { const r = document.querySelector('.sidebar .nav-item').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 20, r.top + r.height / 2); return e ? e.className + ' ' + e.tagName : null; });
    console.log(label.padEnd(14), before, '->', after, note, '| topmost at first nav item:', top);
  }
  console.log('errors', errs);
  await b.close();
})();
