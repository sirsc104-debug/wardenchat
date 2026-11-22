// SirSC Scroll (real build) against a stand-in Supabase: the exact requests sign-in, refresh, likes and
// comments send, an expired sign-in, a suspended account and offline start. Nothing reaches Supabase.
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const mock = fs.readFileSync(SP + '/ytmock/mock-iframe-api.js', 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const PUB = 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni';
const URL = 'http://localhost:4173/';
const pad = (n) => String(n).padStart(8, '0');
const ALL = Array.from({ length: 40 }, (_, i) => ({
  video_id: 'vid' + pad(i), title: `Real test video ${i}`, description: `Description ${i}`, channel_title: `Channel ${i % 5}`, channel_id: 'UC' + String(i % 5).padStart(22, '0'),
  thumbnail_url: null, duration_seconds: 20, published_at: new Date(Date.now() - i * 3600e3).toISOString(), view_count: 1e6 - i * 1000,
  category: 'gaming', hashtags: ['shorts'], orientation: 'vertical', aspect_ratio: 0.5625, made_for_kids: false,
}));
const CLOSED = 'vid00000007';
const calls = [];
const mode = { restricted: false, expired: false, offline: false };
let tokenN = 1;
let valid = new Set();
let refresh = null;
const likes = {};
const comments = [];
let nextId = 100;

const json = (r, status, data) => r.fulfill({ status, contentType: 'application/json', body: data === undefined ? '' : JSON.stringify(data) });
function newSession() {
  const t = 'tok-' + tokenN, rf = 'ref-' + tokenN; tokenN++;
  valid.add(t); refresh = rf;
  return { access_token: t, refresh_token: rf, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u-1', email: 'owner1@warden.invalid', user_metadata: { username: 'Owner1' } } };
}

async function setup(ctx) {
  await ctx.route(/^https?:\/\/([^/]*\.)?(youtube\.com|youtube-nocookie\.com|googlevideo\.com|google\.com|googleapis\.com)\//, (r) =>
    r.request().url() === 'https://www.youtube.com/iframe_api' ? r.fulfill({ status: 200, contentType: 'text/javascript', body: mock }) : r.abort());
  await ctx.route(/^https:\/\/i\.ytimg\.com\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.route(/^https:\/\/djmyvnaragfwoaljzexn\.supabase\.co\//, async (r) => {
    if (mode.offline) return r.abort();
    const req = r.request();
    const u = new globalThis.URL(req.url());
    const h = req.headers();
    const body = JSON.parse(req.postData() || '{}');
    const auth = h['authorization'] || null;
    const fn = u.pathname.startsWith('/rest/v1/rpc/') ? u.pathname.slice(13) : u.pathname + '?' + u.searchParams.get('grant_type');
    calls.push({ fn, body, apikey: h['apikey'], auth, t: Date.now() });
    if (u.pathname === '/auth/v1/token') {
      if (u.searchParams.get('grant_type') === 'password') {
        if (body.email === 'owner1@warden.invalid' && body.password === 'correct-horse') return json(r, 200, newSession());
        return json(r, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      if (body.refresh_token === refresh) return json(r, 200, newSession());
      return json(r, 400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
    }
    if (u.pathname === '/auth/v1/logout') { if (auth) valid.delete(auth.slice(7)); return r.fulfill({ status: 204, body: '' }); }
    if (fn === 'scroll_feed') return json(r, 200, { feed: body.p_feed, category: null, preview: false, items: ALL, next_cursor: null });
    if (fn === 'scroll_videos_lookup') return json(r, 200, { preview: false, items: ALL.filter((v) => (body.p_ids || []).includes(v.video_id)) });
    const tok = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (fn === 'my_account_state') {
      if (!tok || !valid.has(tok)) return json(r, 401, { code: 'PGRST301', message: 'JWT expired' });
      return json(r, 200, mode.restricted ? { active: false, status: 'suspended', reason: 'Spamming the chat', restrictedUntil: new Date(Date.now() + 86400e3).toISOString() } : { active: true, status: 'active' });
    }
    if (!tok || !valid.has(tok) || mode.restricted || mode.expired) return json(r, 400, { code: 'P0001', message: 'scroll_not_signed_in' });
    switch (fn) {
      case 'scroll_me': return json(r, 200, { id: 'u-1', username: 'Owner1', banned: false, ban_reason: null, muted: false, notices_seen_at: null });
      case 'scroll_social_counts': return json(r, 200, (body.p_ids || []).filter((id) => id !== CLOSED && ALL.some((v) => v.video_id === id)).map((id) => ({ video_id: id, likes: (likes[id] || []).length + 3, comments: comments.filter((c) => c.video_id === id).length, liked: (likes[id] || []).includes('u-1') })));
      case 'scroll_my_likes': return json(r, 200, { items: Object.keys(likes).filter((k) => likes[k].includes('u-1')).map((video_id) => ({ video_id, at: new Date().toISOString() })) });
      case 'scroll_like_set': {
        if (body.p_video === CLOSED) return json(r, 400, { code: 'P0001', message: 'scroll_video_unavailable' });
        likes[body.p_video] = (likes[body.p_video] || []).filter((x) => x !== 'u-1');
        if (body.p_liked) likes[body.p_video].push('u-1');
        return json(r, 200, { video_id: body.p_video, liked: body.p_liked, likes: likes[body.p_video].length + 3 });
      }
      case 'scroll_comments_list': {
        const top = comments.filter((c) => c.video_id === body.p_video && !c.parent_id);
        return json(r, 200, { video_id: body.p_video, sort: body.p_sort, offset: 0, top_level: top.length, total: comments.filter((c) => c.video_id === body.p_video).length, items: top });
      }
      case 'scroll_comment_post': {
        if (String(body.p_body).includes('ratelimit')) return json(r, 400, { code: 'P0001', message: 'scroll_rate_limited' });
        const c = { id: nextId++, video_id: body.p_video, parent_id: body.p_parent, author: { id: 'u-1', username: 'Owner1' }, reply_to: null, body: String(body.p_body).trim(), created_at: new Date().toISOString(), likes: 0, liked: false, replies: 0, mine: true };
        comments.push(c);
        return json(r, 200, c);
      }
      case 'scroll_notifications': return json(r, 200, { seen_at: null, items: [] });
      case 'scroll_notifications_seen': return json(r, 200, new Date().toISOString());
    }
    return json(r, 404, { code: 'PGRST202', message: 'not mocked: ' + fn });
  });
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await setup(ctx);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const toastText = async () => (await p.locator('.toast').allTextContents()).join(' | ');
  const last = (fn) => [...calls].reverse().find((c) => c.fn === fn);

  // 1. Sign in.
  await p.goto(URL); await p.waitForTimeout(1000);
  ok(await p.locator('.auth-card').count() === 1, 'sign-in screen first');
  ok(!calls.some((c) => c.fn.startsWith('scroll_') && c.fn !== 'scroll_feed' && c.fn !== 'scroll_videos_lookup'), 'no likes or comments are asked for before signing in');
  await p.fill('input[name=username]', 'Owner1'); await p.fill('input[name=password]', 'nope-nope'); await p.click('.auth-submit'); await p.waitForTimeout(600);
  ok((await p.locator('.auth-error').textContent()).includes('don’t match'), 'wrong password from Supabase: explained');
  await p.fill('input[name=password]', 'correct-horse'); await p.click('.auth-submit'); await p.waitForTimeout(1800);
  const tokCall = last('/auth/v1/token?password');
  ok(tokCall && tokCall.body.email === 'owner1@warden.invalid' && tokCall.apikey === PUB && !tokCall.auth, 'sign-in: <lowercased username>@warden.invalid, publishable key in apikey, no Authorization');
  const me = last('scroll_me');
  ok(me && me.auth === 'Bearer tok-1', 'scroll_me is called with the person’s own token');
  ok(await p.locator('.sidebar').count() === 1, 'signed in: the app shows');
  if (await p.locator('.modal-layer button:has-text("Apply to feeds")').count()) await p.click('.modal-layer button:has-text("Apply to feeds")');
  await p.waitForTimeout(800);
  const counts = last('scroll_social_counts');
  ok(counts && counts.auth === 'Bearer tok-1' && counts.body.p_ids.length > 0 && counts.body.p_ids.every((id) => !id.startsWith('yt-')), 'counts are asked for with YouTube ids (no yt- prefix) and the token');
  ok(!!last('scroll_my_likes'), 'your likes are loaded at sign-in');

  // 2. Like.
  const like = p.locator('.rail-desktop .rail-btn.like').first();
  await like.click(); await p.waitForTimeout(700);
  const ls = last('scroll_like_set');
  ok(ls && ls.body.p_liked === true && /^vid\d{8}$/.test(ls.body.p_video), 'liking sends scroll_like_set with the YouTube id: ' + (ls && ls.body.p_video));
  ok(await like.getAttribute('aria-pressed') === 'true' && (await like.locator('.rail-n').textContent()).trim() === '4', 'the count shows the server’s number (3 + you)');

  // 3. A video that isn't open for likes and comments.
  await p.goto(URL + '#/video/yt-' + CLOSED); await p.waitForTimeout(1400);
  const n0 = calls.filter((c) => c.fn === 'scroll_like_set').length;
  await p.keyboard.press('l'); await p.waitForTimeout(600);
  ok((await toastText()).includes('open once this video is approved') && calls.filter((c) => c.fn === 'scroll_like_set').length === n0, 'a video that isn’t approved: liking explains why, and nothing is sent');
  ok((await p.locator('.comments-widget').textContent()).includes('open once this video is approved'), 'its comments say they open once the video is approved');

  // 4. Comment errors are explained.
  await p.goto(URL); await p.waitForTimeout(1200);
  const box = p.locator('textarea[aria-label="Write a comment"]').first();
  await box.click(); await box.fill('ratelimit me'); await box.press('Enter'); await p.waitForTimeout(700);
  ok((await toastText()).includes('going a bit fast'), 'rate limited: “You’re going a bit fast”');
  await box.fill('  a real comment  '); await box.press('Enter'); await p.waitForTimeout(800);
  const post = last('scroll_comment_post');
  ok(post && /^vid\d{8}$/.test(post.body.p_video) && post.body.p_parent === null && post.auth?.startsWith('Bearer '), 'posting sends the YouTube id, no parent, and the token');
  ok(await p.locator('.comment.mine').count() === 1, 'the posted comment shows');

  // 5. An expired access token is refreshed first.
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('sirsc-scroll:session')); s.expires_at = Math.floor(Date.now() / 1000) - 30; localStorage.setItem('sirsc-scroll:session', JSON.stringify(s)); });
  const since = Date.now();
  await p.reload(); await p.waitForTimeout(1800);
  const after = calls.filter((c) => c.t >= since);
  const ri = after.findIndex((c) => c.fn === '/auth/v1/token?refresh_token');
  const mi = after.findIndex((c) => c.fn === 'scroll_me');
  ok(ri >= 0 && mi > ri && after[mi].auth !== 'Bearer tok-1', 'an expired token is refreshed before scroll_me, which then uses the new token');
  ok(await p.locator('.sidebar').count() === 1, 'still signed in after the refresh');

  // 6. Suspended on Warden Chat while signed in.
  mode.restricted = true;
  await p.locator('.rail-desktop .rail-btn.like').first().click(); await p.waitForTimeout(1500);
  const rs = await p.locator('.restricted').textContent().catch(() => '');
  ok(rs.includes('suspended') && rs.includes('Spamming the chat') && rs.includes('Until'), 'suspended: the suspended screen with the reason and the end date');
  ok(await p.locator('.sidebar').count() === 0, 'nothing of the app shows while suspended');
  await p.click('.restricted button:has-text("Check again")'); await p.waitForTimeout(1200);
  ok((await p.locator('.restricted').textContent()).includes('Still suspended'), 'Check again while still suspended says so');
  mode.restricted = false;
  await p.click('.restricted button:has-text("Check again")'); await p.waitForTimeout(1800);
  ok(await p.locator('.sidebar').count() === 1, 'once lifted, Check again lets you back in');

  // 7. A sign-in Supabase no longer accepts: signed out with a note.
  mode.expired = true;
  await p.reload(); await p.waitForTimeout(2000);
  ok((await p.locator('.auth-note').textContent().catch(() => '')).includes('sign-in expired'), 'an expired sign-in returns to the sign-in screen with a note');
  ok(await p.evaluate(() => localStorage.getItem('sirsc-scroll:session')) === null, 'and the saved sign-in is removed');
  mode.expired = false;

  // 8. Offline when the page opens, with a saved sign-in: the app still opens.
  await p.fill('input[name=username]', 'owner1'); await p.fill('input[name=password]', 'correct-horse'); await p.click('.auth-submit'); await p.waitForTimeout(1500);
  mode.offline = true;
  await p.reload(); await p.waitForTimeout(2500);
  ok(await p.locator('.sidebar').count() === 1, 'offline with a saved sign-in: the app still opens');
  mode.offline = false;

  // 9. Sign out tells Supabase (this browser only).
  await p.reload(); await p.waitForTimeout(1500);
  await p.click('.acct-btn'); await p.waitForTimeout(250);
  await p.click('.acct-pop button:has-text("Sign out")'); await p.waitForTimeout(900);
  const lo = calls.find((c) => c.fn.startsWith('/auth/v1/logout'));
  ok(lo && lo.auth && lo.auth.startsWith('Bearer tok-'), 'sign out calls /auth/v1/logout?scope=local with the token');
  ok(await p.locator('.auth-card').count() === 1, 'and the sign-in screen is back');

  // 10. No Supabase request ever carries anything but the publishable key as apikey.
  ok(calls.every((c) => c.apikey === PUB), 'every request uses the publishable key');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' / ') : ''));
  await b.close();
})();
