// SirSC Scroll demo build: sign in with the pretend Warden Chat, likes, comments, notifications, sign out.
const { chromium, devices } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const URL = 'http://localhost:4174/';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  const toastText = async () => (await p.locator('.toast').allTextContents()).join(' | ');

  // 1. Sign-in screen first; nothing of the app behind it.
  await p.goto(URL); await p.waitForTimeout(900);
  ok(await p.locator('.auth-card').count() === 1, 'the sign-in screen shows first');
  ok(await p.locator('.sidebar, .m-nav, .stage').count() === 0, 'no sidebar, feed or player before signing in');
  ok(await p.locator('.auth-card img.brand-mark').count() === 1, 'the SirSC logo is on the sign-in screen');
  const href = await p.getAttribute('.auth-alt a', 'href');
  ok(href === 'https://chat.sirsc104.com/', 'create-account link goes to Warden Chat: ' + href);

  // 2. Errors.
  await p.click('.auth-submit'); await p.waitForTimeout(200);
  ok((await p.locator('.auth-error').textContent()).includes('Enter your Warden Chat username'), 'empty username is explained');
  await p.fill('input[name=username]', 'no spaces allowed'); await p.fill('input[name=password]', 'whatever'); await p.click('.auth-submit'); await p.waitForTimeout(200);
  ok((await p.locator('.auth-error').textContent()).includes('3 to 24 letters'), 'bad username format is explained');
  await p.fill('input[name=username]', 'demo'); await p.fill('input[name=password]', 'abc'); await p.click('.auth-submit'); await p.waitForTimeout(600);
  ok((await p.locator('.auth-error').textContent()).includes('don’t match'), 'wrong password is explained');
  ok(await p.inputValue('input[name=password]') === '', 'the password box is cleared after a failed try');

  // 3. Sign in.
  await p.fill('input[name=password]', 'pass1234'); await p.click('.auth-submit'); await p.waitForTimeout(1500);
  ok(await p.locator('.sidebar').count() === 1, 'signed in: the app shows');
  ok((await p.locator('.modal-layer .modal').textContent()).includes('Welcome to SirSC Scroll'), 'a first sign-in on this browser asks for interests');
  await p.click('.modal-layer button:has-text("Apply to feeds")'); await p.waitForTimeout(500);
  ok((await p.locator('.acct-name').first().textContent()).trim() === 'demo', 'the account button shows the Warden Chat username');
  ok(await p.locator('.sidebar img.brand-mark').count() === 1, 'the SirSC logo is in the sidebar');
  const sess = await p.evaluate(() => JSON.parse(localStorage.getItem('sirsc-scroll:session')));
  ok(sess && sess.user.username === 'demo' && sess.refresh_token, 'the sign-in is kept in this browser');

  // 4. Removed features.
  const navText = await p.locator('.sidebar').textContent();
  ok(!/Friends|Creator Studio/.test(navText), 'no Friends feed and no Creator Studio in the sidebar');
  ok(await p.locator('.topbar-upload, .m-create').count() === 0, 'no Upload button');
  ok(await p.locator('.rail [aria-label="Share"], .share-row').count() === 0, 'no Share button or share row');
  ok(!(await p.locator('.feed-tabs, .feednav').first().textContent().catch(() => '')).includes('Friends'), 'no Friends tab above the player');

  // 5. Like.
  const like = p.locator('.stage.is-active .rail-btn.like, .rail-desktop .rail-btn.like').first();
  await p.waitForTimeout(600);
  const before = Number((await like.locator('.rail-n').textContent()).replace(/\D/g, '')) || 0;
  await like.click(); await p.waitForTimeout(700);
  const after = Number((await like.locator('.rail-n').textContent()).replace(/\D/g, '')) || 0;
  ok(await like.getAttribute('aria-pressed') === 'true' && after === before + 1, `liking adds one (${before} → ${after})`);

  // 6. Comment, then reply, delete, report. Move to a video with classmates' comments first.
  for (let i = 0; i < 10 && !(await p.locator('.comments-widget .comment').count()); i++) { await p.keyboard.press('j'); await p.waitForTimeout(700); }
  ok(await p.locator('.comments-widget .comment').count() > 0, 'found a video with other people’s comments');
  const box = p.locator('textarea[aria-label="Write a comment"]').first();
  await box.click(); await box.fill('first real comment @maya_k #science'); await box.press('Enter'); await p.waitForTimeout(900);
  const mine = p.locator('.comment.mine').first();
  ok(await mine.count() === 1 && (await mine.textContent()).includes('first real comment'), 'the comment appears, marked as yours');
  ok(await p.locator('.comment.mine .mention').count() >= 2, '@mentions and #tags are highlighted');
  await box.fill('first real comment @maya_k #science'); await box.press('Enter'); await p.waitForTimeout(700);
  ok((await toastText()).includes('You just posted that'), 'posting the same comment twice is refused with a clear message');
  const otherReply = p.locator('.comment:not(.mine) button:has-text("Reply")').first();
  ok(await otherReply.count() > 0, 'other people’s comments have Reply');
  if (await otherReply.count()) {
    await otherReply.click(); await p.waitForTimeout(200);
    ok((await p.locator('.composer-reply').textContent()).includes('Replying to'), 'Reply shows who you are answering');
    await box.fill('replying here'); await box.press('Enter'); await p.waitForTimeout(900);
    ok(await p.locator('.replies .comment.mine').count() >= 1, 'the reply appears in the thread');
  }
  const report = p.locator('.comment:not(.mine) button[aria-label^="Report comment"]').first();
  ok(await report.count() > 0, 'other people’s comments have Report');
  if (await report.count()) {
    await report.click(); await p.waitForTimeout(300);
    await p.click('.modal-layer label:has-text("Spam")'); await p.click('.modal-layer button:has-text("Send report")'); await p.waitForTimeout(500);
    ok((await toastText()).includes('owner will look at it'), 'reporting a comment confirms it went to the owner');
  }

  // 6b. Delete own comment (the reply; the first comment stays for the classmates to answer).
  const del = p.locator('.replies .comment.mine button[aria-label="Delete comment"]').first();
  if (await del.count()) {
    const n0 = await p.locator('.comment.mine').count();
    await del.click(); await p.waitForTimeout(300);
    await p.click('.modal-layer .btn-danger'); await p.waitForTimeout(800);
    ok(await p.locator('.comment.mine').count() < n0 && (await toastText()).includes('Comment deleted'), 'deleting your own comment removes it');
  } else ok(false, 'own reply visible to delete');
  // 7. Classmates react: notification badge after loading notifications.
  await p.waitForTimeout(7600);
  await p.goto(URL + '#/notifications'); await p.waitForTimeout(1500);
  const notes = await p.locator('.note').allTextContents();
  ok(notes.some((t) => t.includes('liked your comment')) && notes.some((t) => t.includes('replied to your comment')), `notifications show a like and a reply (${notes.length})`);
  await p.waitForTimeout(600);
  ok(await p.locator('.nav-badge.hot').count() === 0, 'opening notifications clears the unread badge');

  // 8. Reload: still signed in, still liked, comment still there.
  await p.goto(URL); await p.reload(); await p.waitForTimeout(1800);
  ok(await p.locator('.sidebar').count() === 1, 'still signed in after a reload');
  ok(await p.locator('.modal-layer').count() === 0, 'the welcome dialog only shows once');

  // 9. Profile.
  await p.goto(URL + '#/profile/me'); await p.waitForTimeout(600);
  ok((await p.locator('.profile-head').textContent()).includes('demo'), 'your profile is at #/profile/me');
  ok((await p.locator('.tabs-line').textContent()).includes('Liked'), 'your profile has a Liked tab');
  ok(await p.locator('.profile-actions:has-text("Edit profile"), .profile-actions:has-text("Creator Studio")').count() === 0, 'no profile editing or studio on your profile');

  // 10. Sign out.
  await p.click('.acct-btn'); await p.waitForTimeout(250);
  await p.click('.acct-pop button:has-text("Sign out")'); await p.waitForTimeout(800);
  ok(await p.locator('.auth-card').count() === 1 && await p.locator('.sidebar').count() === 0, 'signing out goes back to the sign-in screen');
  ok(await p.evaluate(() => localStorage.getItem('sirsc-scroll:session')) === null, 'the saved sign-in is removed');

  // 11. A banned Warden Chat account.
  await p.fill('input[name=username]', 'banned'); await p.fill('input[name=password]', 'pass1234'); await p.click('.auth-submit'); await p.waitForTimeout(1500);
  const r = await p.locator('.restricted').textContent().catch(() => '');
  ok(r.includes('banned') && r.includes('pretend ban'), 'a banned account sees the banned screen with the reason');
  ok(await p.locator('.sidebar').count() === 0, 'nothing of the app shows for a banned account');
  await p.click('.restricted button:has-text("Sign out")'); await p.waitForTimeout(600);
  ok(await p.locator('input[name=username]').count() === 1, 'Sign out from the banned screen returns to sign-in');

  // 12. Phone layout.
  const m = await b.newContext({ ...devices['Pixel 7'] });
  await m.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errs.push('mobile pageerror ' + e.message));
  await mp.goto(URL); await mp.waitForTimeout(800);
  await mp.screenshot({ path: OUT + '/m-signin.png' });
  await mp.fill('input[name=username]', 'phoneuser'); await mp.fill('input[name=password]', 'pass1234'); await mp.click('.auth-submit'); await mp.waitForTimeout(1500);
  await mp.click('.modal-layer button:has-text("Apply to feeds")'); await mp.waitForTimeout(400);
  ok(await mp.locator('.m-nav').count() === 1 && await mp.locator('.m-create').count() === 0, 'phone: bottom nav without an upload button');
  await mp.locator('.stage.is-active .rail-btn:has(.lucide-message-circle)').first().click(); await mp.waitForTimeout(800);
  ok(await mp.locator('.sheet textarea[aria-label="Write a comment"]').count() === 1, 'phone: the comments sheet has a composer');
  await mp.screenshot({ path: OUT + '/m-comments.png' });

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' / ') : ''));
  await b.close();
})();
