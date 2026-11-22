const { chromium } = require('playwright');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto('http://localhost:4174/'); await p.waitForTimeout(700);
  await p.fill('input[name=username]', 'seedcheck'); await p.fill('input[name=password]', 'pass1234'); await p.click('.auth-submit'); await p.waitForTimeout(1500);
  await p.click('.modal-layer button:has-text("Apply to feeds")'); await p.waitForTimeout(500);
  const counts = [];
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(700);
    counts.push(Number((await p.locator('.cw-count').textContent()).replace(/\D/g, '')));
    await p.keyboard.press('j');
  }
  ok(counts.every((n) => n >= 7 && n <= 20), 'every video shows 7–20 comments: ' + counts.join(', '));
  await p.click('.comments-widget .seg button:has-text("Top")'); await p.waitForTimeout(500);
  const box = p.locator('textarea[aria-label="Write a comment"]').first();
  await box.click(); await box.fill('real comment goes first'); await box.press('Enter'); await p.waitForTimeout(900);
  // Reload the thread from the server (switch sort away and back) so the order is the server's.
  await p.click('.comments-widget .seg button:has-text("Newest")'); await p.waitForTimeout(600);
  ok((await p.locator('.comments-widget .comment-list > li').first().textContent()).includes('real comment goes first'), 'Newest: your comment is first');
  await p.reload(); await p.waitForTimeout(1500);
  await b.close();
})();
