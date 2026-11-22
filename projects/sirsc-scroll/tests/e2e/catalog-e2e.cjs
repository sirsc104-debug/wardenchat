// SirSC Scroll with real videos: a stand-in catalog API (same shape as scroll_feed / scroll_videos_lookup)
// and the stand-in YouTube IFrame API. Nothing contacts Supabase or YouTube.
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const fs = require('fs');
const SP = __dirname;
const mock = fs.readFileSync(SP + '/ytmock/mock-iframe-api.js', 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const KEY = 'f'.repeat(48);
const PUB = 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni';
const CATS = ['gaming', 'memes', 'comedy', 'sports', 'technology', 'animals', 'science', 'music', 'viral', 'internet_humor', 'trending_entertainment'];
const pad = (n, w) => String(n).padStart(w, '0');
const ALL = Array.from({ length: 130 }, (_, i) => ({
  video_id: 'vid' + pad(i, 8), title: `Real test video ${i} #shorts`, description: `Description ${i}`,
  channel_title: `Channel ${i % 23}`, channel_id: 'UC' + pad(i % 23, 22), thumbnail_url: `https://i.ytimg.com/vi/vid${pad(i, 8)}/hqdefault.jpg`,
  duration_seconds: 20, published_at: new Date(Date.now() - i * 3600e3).toISOString(), view_count: 1e6 - i * 1000,
  category: CATS[i % 11], hashtags: ['shorts', CATS[i % 11]], orientation: 'vertical', aspect_ratio: 0.5625, made_for_kids: false,
}));
const calls = [];
const outside = [];

async function setup(ctx) {
  await ctx.addInitScript({ path: require('path').join(__dirname, 'seed-signin.js') });
  await ctx.route(/^https?:\/\/([^/]*\.)?(youtube\.com|youtube-nocookie\.com|googlevideo\.com|google\.com|googleapis\.com)\//, (r) =>
    r.request().url() === 'https://www.youtube.com/iframe_api' ? r.fulfill({ status: 200, contentType: 'text/javascript', body: mock }) : r.abort());
  await ctx.route(/^https:\/\/i\.ytimg\.com\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.route(/^https:\/\/djmyvnaragfwoaljzexn\.supabase\.co\//, async (r) => {
    const req = r.request();
    const url = req.url();
    const body = JSON.parse(req.postData() || '{}');
    calls.push({ fn: url.split('/rpc/')[1], body, apikey: req.headers()['apikey'], auth: req.headers()['authorization'] || null });
    const preview = body.p_preview_key === KEY;
    const visible = preview ? ALL : [];
    if (url.endsWith('/rpc/scroll_feed')) {
      const list = visible.filter((v) => !(body.p_exclude || []).includes(v.video_id));
      const off = body.p_cursor ? Number(body.p_cursor) : 0;
      const lim = body.p_limit || 20;
      const items = list.slice(off, off + lim);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ feed: body.p_feed, category: body.p_category, preview, items, next_cursor: off + lim < list.length ? String(off + lim) : null }) });
    }
    if (url.endsWith('/rpc/scroll_videos_lookup')) {
      const items = visible.filter((v) => (body.p_ids || []).includes(v.video_id));
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preview, items }) });
    }
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"not mocked"}' });
  });
  ctx.on('request', (q) => { const u = q.url(); if (!/^(http:\/\/localhost|data:|blob:|about:)/.test(u)) outside.push(u.split('?')[0]); });
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await setup(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const active = (sel) => p.locator('.stage.is-active ' + sel).first();
  const iframeCount = () => p.locator('.yt-frame iframe').count();
  const activeId = () => p.evaluate(() => document.querySelector('.stage.is-active .yt-screen')?.getAttribute('data-video') ?? null);
  const waitPlaying = async () => { for (let i = 0; i < 40; i++) { if (await p.locator('.stage.is-active .yt-screen.yt-playing').count()) return true; await p.waitForTimeout(100); } return false; };

  // 1. No preview key: nothing approved, so demo clips with a notice.
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500);
  ok(calls.some((c) => c.fn === 'scroll_feed' && c.apikey === PUB && !c.auth), 'feed requested with the publishable key only (no Authorization header)');
  ok(await p.locator('.stage.is-active .ph').count() === 1 && await p.locator('.stage.is-active .yt-screen').count() === 0, 'no approved videos and no preview key: demo clips show');
  ok((await p.locator('.toast').allTextContents()).some((t) => t.includes('No approved real videos yet')), 'a notice explains why and points to Settings');

  // 2. Preview key through Settings › Videos.
  await p.goto('http://localhost:4173/#/settings/videos'); await p.waitForTimeout(600);
  ok((await p.locator('.catalog-status').textContent()).includes('No approved videos yet'), 'Settings shows the catalog status');
  await p.fill('#preview-key', KEY); await p.click('.preview-key button:has-text("Save")'); await p.waitForTimeout(800);
  const status = await p.locator('.catalog-status').textContent();
  ok(/real videos loaded/.test(status) && status.includes('Preview'), 'after saving the key: ' + status.trim().slice(0, 90));
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('sirsc-scroll:v1')).settings.catalogPreviewKey);
  ok(saved === KEY, 'the preview key is kept in this browser’s settings');

  // 3. The feed plays real videos with one player.
  await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(500);
  ok(await waitPlaying(), 'the first real video reaches PLAYING');
  ok(await iframeCount() === 1, 'exactly one YouTube player on the page');
  ok((await p.locator('.yt-frame iframe').getAttribute('data-host')) === 'https://www.youtube-nocookie.com', 'player address defaults to youtube-nocookie.com');
  ok(await p.locator('.stage.is-active .ph-tag').count() === 0, 'no "Simulated clip" tag on real videos');
  const first = await activeId();
  const cap = await active('.cap-title').textContent();
  const handle = await active('.cap-handle').textContent();
  ok(cap === ALL.find((v) => v.video_id === first).title && /^@channel\.\d+/.test(handle), `caption from the catalog: "${cap}" ${handle}`);
  await p.waitForTimeout(1300);
  ok(/^0:0[1-9] \/ 0:20$/.test((await active('.sc-time').textContent()).trim()), 'time and duration come from the player: ' + (await active('.sc-time').textContent()).trim());
  const mounted = await p.evaluate(() => window.__mockPlayers);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
  ok(await waitPlaying() && (await activeId()) !== first, 'next video plays: ' + (await activeId()));
  ok(await p.evaluate(() => window.__mockPlayers) === mounted + 1 && await iframeCount() === 1, 'a new player per video, old one removed');
  await p.keyboard.press('Space'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.querySelector('.stage.is-active .yt-frame iframe') && true) && (await p.locator('.stage.is-active .stage-paused').count()) === 1, 'Space pauses (paused overlay shown)');
  await p.keyboard.press('Space'); await p.waitForTimeout(250);
  await p.keyboard.press('l'); await p.waitForTimeout(150);
  const likedId = 'yt-' + (await activeId());
  const likeLabel = await p.locator('.rail-btn[aria-label^="Unlike"]').first().getAttribute('aria-label').catch(() => null);
  await p.waitForTimeout(1200);
  ok(!!likeLabel && await p.evaluate((id) => JSON.parse(localStorage.getItem('sirsc-scroll:v1')).accounts.alex.liked.includes(id), likedId), 'liking a real video works (L) and is saved: ' + likeLabel);
  ok((await active('.cap-title').count()) === 1 && (await p.locator('.rail-btn[aria-label^="Comments"]').first().getAttribute('aria-label')).includes(', 0'), 'real videos start with 0 comments (no invented ones)');
  const watchLink = await p.locator('.details-yt').first().getAttribute('href').catch(() => null);
  ok(!watchLink || /^https:\/\/www\.youtube\.com\/watch\?v=vid\d{8}$/.test(watchLink), 'Watch on YouTube link: ' + watchLink);

  // 4. A video YouTube refuses (150) is reported, skipped, and hidden afterwards.
  const nextId = await p.evaluate(() => [...document.querySelectorAll('.track-item')].find((el) => el.style.getPropertyValue('--o').trim() === '1')?.querySelector('.yt-screen')?.getAttribute('data-video'));
  await p.evaluate((id) => (window.__mockFailIds = { [id]: 150 }), nextId);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(500);
  const msg = await p.locator('.stage.is-active .yt-msg').textContent().catch(() => '');
  ok(msg.includes('can’t play here') && msg.includes('150') && msg.includes('Skipping'), 'error 150 shown: ' + msg.replace(/\s+/g, ' ').slice(0, 80));
  await p.waitForTimeout(1800);
  ok((await activeId()) !== nextId && await waitPlaying(), 'skipped to the next video automatically');
  await p.waitForTimeout(200);
  ok(await p.evaluate((id) => JSON.parse(localStorage.getItem('sirsc-scroll:yt-unplayable') || '[]').includes('yt-' + id), nextId), 'the refused video is hidden on this device');

  // 5. Environmental errors (152 for everything): skip 3, then stop and offer help; nothing hidden.
  await p.evaluate(() => (window.__mockFailAll = 152));
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(1600 * 3 + 1500);
  const stuck = await p.locator('.stage.is-active .yt-msg').textContent().catch(() => '');
  ok(stuck.includes('152') && !stuck.includes('Skipping') && stuck.includes('Next video'), 'after 3 skips it stops and offers Next / Try again / Settings');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('sirsc-scroll:yt-unplayable') || '[]').length) === 1, 'network-type errors (152) don’t hide videos');
  await p.evaluate(() => (window.__mockFailAll = 0));
  await p.click('.stage.is-active .yt-msg button:has-text("Next video")'); await p.waitForTimeout(300);
  ok(await waitPlaying(), 'Next video recovers once playback works');

  // 6. Top-up: watching most loaded videos fetches the next page with a cursor.
  for (let i = 0; i < 30; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(140); }
  await p.waitForTimeout(800);
  ok(calls.some((c) => c.fn === 'scroll_feed' && c.body.p_cursor), 'more videos fetched with a cursor: ' + JSON.stringify(calls.filter((c) => c.body.p_cursor).map((c) => [c.body.p_feed, c.body.p_cursor])));
  ok(await iframeCount() <= 1, 'still at most one player after 30 quick switches');
  await p.waitForTimeout(800);
  await p.keyboard.press('s'); await p.waitForTimeout(150);
  const savedLate = 'yt-' + (await activeId());

  // 7. Player address setting.
  await p.goto('http://localhost:4173/#/settings/videos'); await p.waitForTimeout(400);
  await p.click('.seg button:has-text("youtube.com")'); await p.waitForTimeout(200);
  await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(400);
  ok(await waitPlaying() && (await p.locator('.yt-frame iframe').getAttribute('data-host')) === 'https://www.youtube.com', 'switching the player address to youtube.com takes effect');

  // 8. Saved page and channel profile use real thumbnails and links.
  await p.goto('http://localhost:4173/#/saved'); await p.waitForTimeout(500);
  ok(await p.locator('.yt-art img').count() >= 1, 'Saved shows the real video with its YouTube thumbnail');
  const h = handle.trim().slice(1);
  await p.goto('http://localhost:4173/#/profile/' + h); await p.waitForTimeout(500);
  ok(await p.locator('a:has-text("Open the channel on YouTube")').count() === 1 && await p.locator('.yt-art img').count() >= 1, 'channel profile: YouTube link and video grid');

  // 9. Reload: a saved video from a later page is looked up by ID.
  const before = calls.length;
  await p.reload(); await p.waitForTimeout(1500);
  const look = calls.slice(before).find((c) => c.fn === 'scroll_videos_lookup');
  ok(!!look && look.body.p_ids.includes(savedLate.slice(3)), 'after reload, saved/liked videos outside the first pages are fetched by ID');
  await p.goto('http://localhost:4173/#/saved'); await p.waitForTimeout(500);
  ok(await p.locator(`[data-vid="${savedLate}"]`).count() >= 1, 'and the saved one shows on Saved: ' + savedLate);

  // 10. Demo clips switch, and back.
  await p.goto('http://localhost:4173/#/settings/videos'); await p.waitForTimeout(400);
  await p.click('.seg button:has-text("Demo clips")'); await p.waitForTimeout(300);
  await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(600);
  ok(await p.locator('.stage.is-active .ph').count() === 1 && await iframeCount() === 0, 'Demo clips: placeholders, no YouTube player');
  await p.goto('http://localhost:4173/#/settings/videos'); await p.waitForTimeout(300);
  await p.click('.seg button:has-text("Real videos")'); await p.waitForTimeout(800);
  await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(400);
  ok(await waitPlaying(), 'back to real videos');

  ok(!outside.some((u) => /googleapis\.com/.test(u)), 'the browser never calls the YouTube Data API');
  const real = errs.filter((e) => !/net::ERR_FAILED|Failed to load resource/.test(e));
  ok(real.length === 0, 'no page errors' + (real.length ? ': ' + real.slice(0, 3).join(' | ') : ''));
  await p.screenshot({ path: OUT + '/scroll-real.png' });
  await b.close();
})();
