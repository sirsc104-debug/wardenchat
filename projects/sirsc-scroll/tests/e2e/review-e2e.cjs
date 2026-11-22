// The owner review page against a stand-in review API (statuses kept in memory). Nothing contacts Supabase or YouTube.
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const fs = require('fs');
const SP = __dirname;
const mock = fs.readFileSync(SP + '/ytmock/mock-iframe-api.js', 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
let REVIEW = 'b'.repeat(48);
const CATS = ['gaming', 'memes', 'comedy', 'sports', 'technology', 'animals', 'science', 'music', 'viral', 'internet_humor', 'trending_entertainment'];
const pad = (n, w) => String(n).padStart(w, '0');
const ALL = Array.from({ length: 130 }, (_, i) => ({
  video_id: 'vid' + pad(i, 8), title: `Real test video ${i} #shorts`, description: `Description ${i}`, channel_title: `Channel ${i % 23}`,
  channel_id: 'UC' + pad(i % 23, 22), thumbnail_url: `https://i.ytimg.com/vi/vid${pad(i, 8)}/hqdefault.jpg`, duration_seconds: 20 + (i % 40),
  published_at: new Date(Date.now() - i * 3600e3).toISOString(), view_count: 1e6 - i * 1000, category: CATS[i % 11], hashtags: ['shorts'],
  orientation: 'vertical', aspect_ratio: 0.5625, made_for_kids: i % 17 === 0,
}));
const st = new Map(ALL.map((v) => [v.video_id, { status: 'pending', at: 0 }]));
const calls = [];
const deny = (r) => r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'review key not accepted' }) });

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript({ path: require('path').join(__dirname, 'seed-signin.js') });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:4173' });
  await ctx.route(/^https?:\/\/([^/]*\.)?(youtube\.com|youtube-nocookie\.com|googlevideo\.com|google\.com|googleapis\.com)\//, (r) =>
    r.request().url() === 'https://www.youtube.com/iframe_api' ? r.fulfill({ status: 200, contentType: 'text/javascript', body: mock }) : r.fulfill({ status: 200, contentType: 'text/html', body: '<body style="background:#123">embed</body>' }));
  await ctx.route(/^https:\/\/i\.ytimg\.com\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.route(/^https:\/\/djmyvnaragfwoaljzexn\.supabase\.co\//, async (r) => {
    const url = r.request().url();
    const fn = url.split('/rpc/')[1];
    const body = JSON.parse(r.request().postData() || '{}');
    calls.push({ fn, body });
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    const okKey = body.p_key === REVIEW;
    if (fn === 'scroll_review_list') {
      if (!okKey) return deny(r);
      const q = (body.p_search || '').toLowerCase();
      let list = ALL.filter((v) => st.get(v.video_id).status === body.p_status && (!body.p_category || v.category === body.p_category) && (!q || v.title.toLowerCase().includes(q) || v.channel_title.toLowerCase().includes(q)));
      list = body.p_status === 'pending' ? list.sort((a, c) => c.view_count - a.view_count) : list.sort((a, c) => st.get(c.video_id).at - st.get(a.video_id).at);
      const counts = {};
      for (const s of st.values()) counts[s.status] = (counts[s.status] || 0) + 1;
      const cats = {};
      for (const v of ALL) if (st.get(v.video_id).status === body.p_status) cats[v.category] = (cats[v.category] || 0) + 1;
      return json({ status: body.p_status, total: list.length, offset: body.p_offset, counts, categories: Object.entries(cats).map(([category, videos]) => ({ category, videos })),
        items: list.slice(body.p_offset, body.p_offset + body.p_limit).map((v) => ({ ...v, review_status: st.get(v.video_id).status, reviewed_at: null, review_note: null, discovered_at: v.published_at })) });
    }
    if (fn === 'scroll_review_set') {
      if (!okKey) return deny(r);
      let n = 0;
      for (const id of body.p_ids) { const s = st.get(id); if (s && s.status !== body.p_status) { s.status = body.p_status; s.at = Date.now() + n; n++; } }
      return json(n);
    }
    if (fn === 'scroll_review_export') {
      if (!okKey) return deny(r);
      return json(ALL.filter((v) => st.get(v.video_id).status === body.p_status).sort((a, c) => a.category.localeCompare(c.category) || a.title.localeCompare(c.title))
        .map((v) => ({ video_id: v.video_id, title: v.title, channel_title: v.channel_title, category: v.category, duration_seconds: v.duration_seconds, view_count: v.view_count, made_for_kids: v.made_for_kids, url: 'https://www.youtube.com/watch?v=' + v.video_id })));
    }
    if (fn === 'scroll_feed' || fn === 'scroll_videos_lookup') {
      const preview = body.p_preview_key === REVIEW;
      const vis = ALL.filter((v) => { const s = st.get(v.video_id).status; return s === 'approved' || (preview && (s === 'pending' || s === 'shortlisted')); });
      if (fn === 'scroll_videos_lookup') return json({ preview, items: vis.filter((v) => body.p_ids.includes(v.video_id)) });
      const off = body.p_cursor ? Number(body.p_cursor) : 0;
      return json({ feed: body.p_feed, category: null, preview, items: vis.slice(off, off + body.p_limit), next_cursor: off + body.p_limit < vis.length ? String(off + body.p_limit) : null });
    }
    return r.fulfill({ status: 404, body: '{}' });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const count = async (label) => Number(((await p.locator(`.rv-tabs button:has-text("${label}") .rv-count`).textContent()) || '').replace(/,/g, ''));
  const cards = () => p.locator('.rv-card').count();

  // 1. Key gate.
  await p.goto('http://localhost:4173/#/review'); await p.waitForTimeout(800);
  ok(await p.locator('.rv-gate').count() === 1 && (await p.textContent('.rv-gate')).includes("scroll_review_key"), 'without a key: the review key form, with where to find it');
  await p.fill('.rv-gate input', 'c'.repeat(48)); await p.click('.rv-gate button'); await p.waitForTimeout(400);
  ok((await p.textContent('.rv-gate')).includes('wasn’t accepted'), 'a wrong key is refused');
  await p.fill('.rv-gate input', REVIEW); await p.click('.rv-gate button'); await p.waitForTimeout(900);
  ok(await p.locator('.rv-grid').count() === 1, 'the right key opens the review board');
  await p.waitForTimeout(400);
  const settings = await p.evaluate(() => JSON.parse(localStorage.getItem('sirsc-scroll:v1')).settings);
  ok(settings.catalogReviewKey === REVIEW && settings.catalogPreviewKey === REVIEW, 'review key saved, and used as the preview key too (none was set)');

  // 2. Lists, paging, filters.
  ok(await count('To review') === 130 && await cards() === 60, `To review: ${await count('To review')}, ${await cards()} cards shown`);
  await p.click('.rv-more button'); await p.waitForTimeout(500);
  ok(await cards() === 120, 'Show more loads the next 60');
  ok(await p.locator('.rv-card .rv-kids').count() >= 1, '"Made for kids" badge shown where YouTube says so');
  await p.click('.rv-cats .chip:has-text("Animals")'); await p.waitForTimeout(500);
  const subs = await p.locator('.rv-card .rv-sub:nth-of-type(3), .rv-card .rv-meta span:last-child').allTextContents();
  ok(await cards() > 0 && subs.every((t) => t.includes('Animals')), `category filter: ${await cards()} animal videos`);
  await p.click('.rv-cats .chip:has-text("All")'); await p.waitForTimeout(400);
  await p.fill('.rv-search input', 'video 12 '); await p.waitForTimeout(700);
  const titles = await p.locator('.rv-title').allTextContents();
  ok(titles.length >= 1 && titles.every((t) => t.includes('video 12')), 'search: ' + titles.join(', '));
  await p.fill('.rv-search input', ''); await p.waitForTimeout(700);

  // 3. Single action with Undo.
  const firstId = await p.locator('.rv-card').first().getAttribute('data-video');
  await p.locator('.rv-card').first().locator('button:has-text("Shortlist")').click(); await p.waitForTimeout(400);
  ok(await count('To review') === 129 && await count('Shortlisted') === 1 && st.get(firstId).status === 'shortlisted', 'Shortlist moves one video and saves it');
  await p.click('.toast button:has-text("Undo")'); await p.waitForTimeout(700);
  ok(st.get(firstId).status === 'pending' && await count('To review') === 130, 'Undo puts it back');

  // 4. Bulk selection.
  for (let i = 0; i < 3; i++) await p.locator('.rv-card .rv-check input').nth(i).check();
  ok((await p.textContent('.rv-bulk b')) === '3 selected', 'selecting 3 shows the bulk bar');
  await p.click('.rv-bulk button:has-text("Shortlist")'); await p.waitForTimeout(500);
  for (let i = 0; i < 2; i++) await p.locator('.rv-card .rv-check input').nth(i).check();
  await p.click('.rv-bulk button:has-text("Reject")'); await p.waitForTimeout(500);
  ok(await count('Shortlisted') === 3 && await count('Rejected') === 2 && await count('To review') === 125, 'bulk shortlist 3 and reject 2');

  // 5. One by one with the keyboard.
  await p.click('.rv-oneby'); await p.waitForTimeout(400);
  const src = await p.locator('.rv-frame iframe').getAttribute('src');
  ok(src.startsWith('https://www.youtube-nocookie.com/embed/vid') && src.includes('autoplay=1'), 'one-by-one player uses the configured embed address');
  const t1 = await p.textContent('.rv-side-title');
  await p.keyboard.press('a'); await p.waitForTimeout(400);
  const t2 = await p.textContent('.rv-side-title');
  ok(t2 !== t1 && await count('Shortlisted') === 4, `A shortlists and opens the next video (${t1} → ${t2})`);
  await p.keyboard.press('r'); await p.waitForTimeout(400);
  ok(await count('Rejected') === 3, 'R rejects');
  const t3 = await p.textContent('.rv-side-title');
  await p.keyboard.press('j'); await p.waitForTimeout(300);
  ok((await p.textContent('.rv-side-title')) !== t3 && await count('To review') === 123, 'J skips without changing anything');
  await p.keyboard.press('k'); await p.waitForTimeout(300);
  ok((await p.textContent('.rv-side-title')) === t3, 'K goes back');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.locator('.rv-player').count() === 0, 'Esc closes the player');

  // 6. Shortlist → list for the school → school approved.
  await p.click('.rv-tabs button:has-text("Shortlisted")'); await p.waitForTimeout(600);
  ok(await cards() === 4, 'Shortlisted tab shows the 4 picks');
  await p.click('button:has-text("List for the school")'); await p.waitForTimeout(600);
  const list = await p.inputValue('.rv-export textarea');
  ok(list.startsWith('Videos proposed for SirSC Scroll (4)') && (list.match(/https:\/\/www\.youtube\.com\/watch\?v=vid\d{8}/g) || []).length === 4, 'the list for the school has 4 videos with YouTube links');
  await p.click('.rv-export button:has-text("Copy")'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => navigator.clipboard.readText())) === list, 'Copy puts the list on the clipboard');
  await p.click('.rv-export button[aria-label="Close"]'); await p.waitForTimeout(200);
  await p.click('button:has-text("The school approved these")'); await p.waitForTimeout(300);
  ok((await p.locator('.modal').textContent()).includes('become public'), 'approving warns that approved videos become public');
  await p.click('.modal button:has-text("Approve 4 videos")'); await p.waitForTimeout(900);
  ok(await count('Approved') === 4 && await count('Shortlisted') === 0, 'the whole shortlist is approved');
  await p.click('.rv-tabs button:has-text("Approved")'); await p.waitForTimeout(500);
  await p.locator('.rv-card').first().locator('button:has-text("Unapprove")').click(); await p.waitForTimeout(500);
  ok(await count('Approved') === 3 && await count('Shortlisted') === 1, 'Unapprove sends one back to the shortlist');
  await p.click('.rv-tabs button:has-text("Rejected")'); await p.waitForTimeout(500);
  await p.locator('.rv-card').first().locator('button:has-text("Back to review")').click(); await p.waitForTimeout(500);
  ok(await count('Rejected') === 2, 'a rejected video can go back to review');

  // 7. Leaving reloads the feed so rejected videos leave it.
  const before = calls.filter((c) => c.fn === 'scroll_feed').length;
  await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(900);
  ok(calls.filter((c) => c.fn === 'scroll_feed').length > before, 'leaving the review page reloads the feed');
  const rejected = [...st].filter(([, s]) => s.status === 'rejected').map(([id]) => 'yt-' + id);
  const inFeed = await p.evaluate(() => [...document.querySelectorAll('.yt-screen')].map((e) => 'yt-' + e.getAttribute('data-video')));
  ok(!inFeed.some((id) => rejected.includes(id)), 'rejected videos are not in the feed');

  // 8. A replaced key: the saved one stops working and the form returns.
  REVIEW = 'd'.repeat(48);
  await p.goto('http://localhost:4173/#/review'); await p.waitForTimeout(900);
  ok(await p.locator('.rv-gate').count() === 1, 'if the key was replaced, the page asks for the new one');

  // 9. Settings link and phone layout.
  await p.goto('http://localhost:4173/#/settings/videos'); await p.waitForTimeout(400);
  ok(await p.locator('a[href="#/review"]').count() === 1, 'Settings › Videos links to the review page');
  await p.fill('.rv-gate input', REVIEW).catch(() => {});
  // The two expected 401s (wrong key, replaced key) are the browser's network log, not app errors.
  const real = errs.filter((e) => !/status of 401/.test(e));
  ok(real.length === 0 && errs.length === 2, 'no page errors (only the 2 expected 401 responses logged)' + (real.length ? ': ' + real.slice(0, 3).join(' | ') : ''));

  // Screenshots and phone width.
  REVIEW = 'b'.repeat(48);
  await p.evaluate((k) => { const d = JSON.parse(localStorage.getItem('sirsc-scroll:v1')); d.settings.catalogReviewKey = k; localStorage.setItem('sirsc-scroll:v1', JSON.stringify(d)); }, REVIEW);
  await p.goto('http://localhost:4173/#/review'); await p.reload(); await p.waitForTimeout(1200);
  await p.locator('.rv-card .rv-check input').nth(1).check(); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/review-board.png' });
  await p.locator('.rv-card').nth(20).scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const bar = await p.locator('.rv-selectbar').boundingBox();
  ok(bar && bar.y >= 0 && bar.y < 140 && await p.locator('.rv-bulk').isVisible(), 'after scrolling, the selection row and its actions stay in view (y=' + Math.round(bar?.y) + ')');
  await p.screenshot({ path: OUT + '/review-scrolled.png' });
  await p.locator('.rv-card .rv-check input').nth(1).uncheck();
  await p.click('.rv-oneby'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/review-player.png' });
  await p.keyboard.press('Escape');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, 'phone width: no horizontal overflow (' + over + 'px)');
  await p.click('.rv-oneby'); await p.waitForTimeout(500);
  const box = await p.locator('.rv-player-box').boundingBox();
  ok(box && box.width <= 390, 'phone width: the one-by-one player fits (' + Math.round(box?.width) + 'px)');
  await p.screenshot({ path: OUT + '/review-phone.png' });
  await b.close();
})();
