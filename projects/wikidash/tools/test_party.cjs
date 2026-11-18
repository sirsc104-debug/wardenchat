const { chromium } = require('playwright');
const fs = require('fs');
const idx = JSON.parse(fs.readFileSync(__dirname + '/../dist/data/index.json'));
const byT = new Map(idx.t.map((t, i) => [t, i]));
function path(a, b) {
  const prev = new Map([[a, -1]]); let fr = [a];
  while (fr.length) { const nx = []; for (const x of fr) for (const y of idx.l[x]) if (!prev.has(y)) { prev.set(y, x); nx.push(y); } fr = nx; if (prev.has(b)) break; }
  const out = []; let c = b; while (c !== -1) { out.unshift(c); c = prev.get(c); } return out.map(i => idx.t[i]);
}
const mock = fs.readFileSync(__dirname + '/mock_claude.js', 'utf8');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await c.addInitScript(mock);
  const errs = [];
  const mk = async (tag) => { const p = await c.newPage(); p.on('pageerror', e => errs.push(tag + ' pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' console ' + m.text()); }); await p.goto('http://localhost:8765/test.html'); await p.waitForSelector('.landing'); return p; };
  const host = await mk('host');
  await host.fill('#name', 'Hosty');
  await host.waitForFunction(() => !document.querySelector('.start-row .btn.primary').disabled);
  await host.click('text=Create a party');
  await host.waitForSelector('.lobby', { timeout: 15000 });
  const code = (await host.textContent('.topbar .rc-code')).trim();
  console.log('party code', code);
  const guest = await mk('guest');
  await guest.fill('#name', 'Guesty');
  await guest.fill('#code', code);
  await guest.click('.join-row .btn');
  await guest.waitForSelector('.lobby', { timeout: 15000 });
  await host.waitForFunction(() => document.querySelectorAll('.plist .prow').length === 2, null, { timeout: 10000 });
  console.log('host sees players', await host.$$eval('.plist .pname', e => e.map(x => x.textContent)));
  // guest suggests a page
  await guest.fill('.sugg input', 'Moon');
  await guest.waitForSelector('.sugg .suggest.open li[role=option]');
  await guest.press('.sugg input', 'ArrowDown');
  await guest.press('.sugg input', 'Enter');
  await host.waitForSelector('.sug-row', { timeout: 8000 });
  console.log('host sees suggestion', await host.textContent('.sug-row b'));
  await host.click('text=Random route');
  await guest.waitForFunction(() => document.querySelectorAll('.page-card:not(.empty)').length === 2, null, { timeout: 15000 });
  const titles = await guest.$$eval('.pc-title', els => els.map(e => e.textContent));
  console.log('guest sees route', titles);
  await host.click('.startbar .btn.primary');
  await guest.waitForSelector('.racebar', { timeout: 10000 });
  await guest.waitForTimeout(4200);
  const route = path(byT.get(titles[0]), byT.get(titles[1]));
  console.log('guest path', route);
  for (const step of route.slice(1)) {
    await guest.waitForFunction((t) => !!document.querySelector(`.article a.wl[data-to="${CSS.escape(t)}"]`), step, { timeout: 15000 });
    await guest.$eval(`.article a.wl[data-to="${step.replace(/"/g, '\\"')}"]`, a => a.click());
    await guest.waitForTimeout(500);
  }
  await host.waitForSelector('.res-card', { timeout: 15000 });
  await guest.waitForSelector('.res-card', { timeout: 15000 });
  console.log('host headline:', await host.textContent('.res-head h2'), '| guest headline:', await guest.textContent('.res-head h2'));
  await guest.screenshot({ path: __dirname + '/../shots/party_results.png' });
  // host leaves, guest should take over
  await host.close();
  await guest.waitForTimeout(10500);
  const v = await guest.evaluate(() => document.querySelector('.res-actions')?.textContent);
  console.log('guest actions after host left:', v);
  console.log('errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
