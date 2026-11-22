// Load the single file the way an embed does (srcdoc, or document.write into about:blank) and click the sidebar.
const { chromium } = require('playwright');
const mode = process.argv[2] || 'srcdoc';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  let tok = 0;
  await ctx.route(/^https:\/\/djmyvnaragfwoaljzexn\.supabase\.co\//, async (r) => {
    const u = new URL(r.request().url());
    const j = (d, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
    if (u.pathname === '/auth/v1/token') return j({ access_token: 't' + ++tok, refresh_token: 'r' + tok, expires_in: 3600, user: { id: 'u1', user_metadata: { username: 'Tester' } } });
    const fn = u.pathname.replace('/rest/v1/rpc/', '');
    if (fn === 'scroll_me') return j({ id: 'u1', username: 'Tester', banned: false, muted: false });
    if (fn === 'scroll_social_counts') return j([]);
    if (fn === 'scroll_my_likes') return j({ items: [] });
    if (fn === 'scroll_notifications') return j({ seen_at: null, items: [] });
    if (fn === 'scroll_feed') return j({ feed: 'x', category: null, preview: false, items: [], next_cursor: null });
    return j({ message: 'nope' }, 404);
  });
  await ctx.route(/^https?:\/\/(?!localhost|djmyvnaragfwoaljzexn)/, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4180/tests/e2e/embed-test.html#' + mode); await p.waitForTimeout(2000);
  const fr = p.frames().find((f) => f !== p.mainFrame());
  console.log('frame url:', fr.url(), '| baseURI:', await fr.evaluate(() => document.baseURI));
  await fr.fill('input[name=username]', 'Tester'); await fr.fill('input[name=password]', 'pass1234'); await fr.click('.auth-submit'); await p.waitForTimeout(1800);
  if (await fr.locator('.modal-layer button:has-text("Apply to feeds")').count()) await fr.click('.modal-layer button:has-text("Apply to feeds")');
  await p.waitForTimeout(500);
  for (const label of ['Explore', 'Saved', 'Settings', 'For You']) {
    const f = p.frames().find((x) => x !== p.mainFrame());
    let res;
    try {
      await f.locator('.sidebar .nav-item', { hasText: label }).first().click({ timeout: 3000 });
      await p.waitForTimeout(800);
      const f2 = p.frames().find((x) => x !== p.mainFrame());
      res = await f2.evaluate(() => ({ url: location.href.slice(0, 60), page: document.querySelector('.page-title, h1')?.textContent?.slice(0, 30) ?? null, sidebar: !!document.querySelector('.sidebar'), active: document.querySelector('.nav-item.on')?.textContent }));
    } catch (e) { res = 'ERROR ' + e.message.split('\n')[0]; }
    console.log(label.padEnd(9), JSON.stringify(res));
  }
  console.log('errors', errs);
  await b.close();
})();
