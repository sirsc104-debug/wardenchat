// The owner's comment moderation page (#/review/comments) against a stand-in API.
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const KEY = 'r'.repeat(48);
const PUB = 'sb_publishable_cKmFKnmgDTlUNm9hGui2mQ_j_rs0oni';
const calls = [];
const items = [
  { id: 11, video_id: 'abcdefghijk', video_title: 'Funny cat', parent_id: null, author: { id: 'u-a', username: 'meanie' }, author_banned: false, body: 'you are all losers', created_at: new Date(Date.now() - 3600e3).toISOString(), deleted_at: null, deleted_by: null, likes: 0, reports: 2, reasons: { bullying: 2 } },
  { id: 12, video_id: 'abcdefghijk', video_title: 'Funny cat', parent_id: 11, author: { id: 'u-b', username: 'kindkid' }, author_banned: false, body: 'be nice', created_at: new Date().toISOString(), deleted_at: null, deleted_by: null, likes: 3, reports: 0, reasons: {} },
];
let banned = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript({ path: require('path').join(__dirname, 'seed-signin.js') });
  await ctx.addInitScript((k) => { const s = JSON.parse(localStorage.getItem('sirsc-scroll:v1') || '{}'); s.settings = { ...(s.settings || {}), catalogReviewKey: k, videoSource: 'demo' }; localStorage.setItem('sirsc-scroll:v1', JSON.stringify(s)); }, KEY);
  await ctx.route(/^https?:\/\/(?!localhost)(?!djmyvnaragfwoaljzexn)/, (r) => r.abort());
  await ctx.route(/^https:\/\/djmyvnaragfwoaljzexn\.supabase\.co\//, async (r) => {
    const req = r.request();
    const fn = new URL(req.url()).pathname.replace('/rest/v1/rpc/', '');
    const body = JSON.parse(req.postData() || '{}');
    calls.push({ fn, body, apikey: req.headers()['apikey'], auth: req.headers()['authorization'] || null });
    const j = (s, d) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
    if (fn === 'scroll_me') return j(200, { id: 'u-test', username: 'tester', banned: false, muted: false });
    if (fn.startsWith('scroll_mod_') && body.p_key !== KEY) return j(401, { code: '42501', message: 'Review key required' });
    if (fn === 'scroll_mod_comments') {
      const list = body.p_view === 'reported' ? items.filter((i) => !i.deleted_at && i.reports > 0) : body.p_view === 'removed' ? items.filter((i) => i.deleted_at) : items.filter((i) => !i.deleted_at);
      return j(200, { view: body.p_view, total: list.length, offset: 0, counts: { reported: items.filter((i) => !i.deleted_at && i.reports > 0).length, recent: items.filter((i) => !i.deleted_at).length, removed: items.filter((i) => i.deleted_at).length }, banned, items: list.map((i) => ({ ...i, author_banned: banned.some((x) => x.id === i.author.id) })) });
    }
    if (fn === 'scroll_mod_set') {
      for (const i of items) if (body.p_ids.includes(i.id)) {
        if (body.p_action === 'remove') { i.deleted_at = new Date().toISOString(); i.deleted_by = 'owner'; i.reports = 0; }
        if (body.p_action === 'restore' && i.deleted_by === 'owner') { i.deleted_at = null; i.deleted_by = null; }
        if (body.p_action === 'dismiss') i.reports = 0;
      }
      return j(200, 1);
    }
    if (fn === 'scroll_mod_ban') { banned = body.p_banned ? [...banned, { id: body.p_user, username: 'meanie', reason: body.p_reason, at: new Date().toISOString() }] : banned.filter((x) => x.id !== body.p_user); return j(200, body.p_banned); }
    return j(404, { code: 'PGRST202', message: 'not mocked' });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4173/#/review/comments'); await p.waitForTimeout(1500);
  const modCall = calls.find((c) => c.fn === 'scroll_mod_comments');
  ok(modCall && modCall.apikey === PUB && !modCall.auth && modCall.body.p_key === KEY && modCall.body.p_view === 'reported', 'moderation asks with the review key and the publishable key only');
  const first = await p.locator('.mod-item').first().textContent();
  ok(first.includes('meanie') && first.includes('2 reports') && first.includes('bullying ×2'), 'a reported comment shows its reports and reasons');
  await p.screenshot({ path: OUT + '/mod.png' });
  await p.click('.mod-item button:has-text("Remove")'); await p.waitForTimeout(800);
  ok(calls.some((c) => c.fn === 'scroll_mod_set' && c.body.p_action === 'remove' && c.body.p_ids[0] === 11), 'Remove sends scroll_mod_set remove');
  ok(await p.locator('.mod-item').count() === 0, 'the reported list is empty afterwards');
  await p.click('.rv-tabs button:has-text("Removed")'); await p.waitForTimeout(800);
  ok((await p.locator('.mod-item').first().textContent()).includes('removed by you'), 'the Removed tab shows who removed it');
  await p.click('.mod-item button:has-text("Restore")'); await p.waitForTimeout(800);
  ok(calls.some((c) => c.fn === 'scroll_mod_set' && c.body.p_action === 'restore'), 'Restore sends scroll_mod_set restore');
  await p.click('.rv-tabs button:has-text("All comments")'); await p.waitForTimeout(800);
  await p.click('.mod-item:has-text("meanie") button:has-text("Stop meanie")'); await p.waitForTimeout(300);
  await p.click('.modal-layer .btn-danger'); await p.waitForTimeout(900);
  ok(calls.some((c) => c.fn === 'scroll_mod_ban' && c.body.p_banned === true && c.body.p_user === 'u-a'), 'Stop account asks first, then sends scroll_mod_ban');
  ok((await p.locator('.mod-banned').textContent()).includes('meanie'), 'stopped accounts are listed with Allow again');
  await p.click('.mod-banned button:has-text("Allow again")'); await p.waitForTimeout(800);
  ok(calls.some((c) => c.fn === 'scroll_mod_ban' && c.body.p_banned === false), 'Allow again lifts it');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' / ') : ''));
  await b.close();
})();
