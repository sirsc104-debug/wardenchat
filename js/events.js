'use strict';
/* Claude Code Clicker: random events and seasons.
   - Pull Request pop-ups: approve or reject within 5 seconds.
   - Rate Limited (bad): the sparkle ignores clicks for 10 seconds.
   - Memory leaks: blobs that cling to the sparkle and soak up 5% of production each; pop one for 110% back.
   - Seasons: Hackathon Week and Launch Week rotate by calendar week, with themed tokens and limited upgrades. */

GLYPH.pizza = [
  { d: 'M5 6L27 8.5L13.5 29Z', f: '#F2C57C', s: '#C69C6D', w: 1.2 },
  { d: 'M5 6L27 8.5', s: '#B9853A', w: 3.2 },
  { d: C(12, 12, 2.2) + C(18, 13.5, 2) + C(14, 19.5, 1.9), f: '#E0645C' },
];
GLYPH.rocket = [
  { d: 'M13 22L16 29.5L19 22Z', f: '#FFB347' },
  { d: 'M12 17L6.5 24L12 22.5ZM20 17L25.5 24L20 22.5Z', f: '#E0645C' },
  { d: 'M16 2.5C21.5 8 22.5 15 20.5 22.5H11.5C9.5 15 10.5 8 16 2.5Z', f: '#E9E6E1', s: '#6F86AE', w: 1 },
  { d: C(16, 12, 2.6), f: '#5EC8FF', s: '#2A2230', w: 0.8 },
];

const SEASONS = {
  hackathon: { name: 'Hackathon Week', glyph: 'pizza', item: 'pizza slice', text: 'Catch the flying pizza for bonus tokens. Two limited-time upgrades are on sale.' },
  launch: { name: 'Launch Week', glyph: 'rocket', item: 'launch rocket', text: 'Catch the rockets for bonus tokens. Two limited-time upgrades are on sale.' },
};
// Seasons rotate by ISO week: Hackathon Week, then Launch Week, then a normal week.
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
function currentSeason() {
  if (G.dev.on && G.dev.season && G.dev.season !== 'auto') return G.dev.season === 'none' ? null : G.dev.season;
  return [/* 0 */ 'hackathon', /* 1 */ 'launch', /* 2 */ null][isoWeek() % 3];
}

const PR_GOOD = ['Fix typo in README', 'Add tests for the login flow', 'Bump lodash to 4.17.21', 'Extract a helper for date parsing',
  'Improve error messages on failed uploads', 'Add dark mode to the settings page', 'Cache the user list query', 'Document the deploy script',
  'Fix off-by-one in pagination', 'Remove an unused dependency'];
const PR_BAD = ['Delete prod database', 'rm -rf / (cleanup)', 'Disable all tests so CI goes green', 'Hardcode the API key in the frontend',
  'Force-push to main', "Replace auth check with 'return true'", 'Drop the users table (it was slow)', 'Commit node_modules (all 2 GB)',
  'Set every timeout to 0', 'Turn off backups to save money'];
const PR_AUTHORS = ['intern-42', 'dependabot', 'subagent-7', 'night-shift-dev', 'mystery-contributor', 'rubber-duck', 'staff-eng'];

const LEAK_DRAIN = 0.05, MAX_LEAKS = 6;

const Events = {
  key: 'leaks',
  fresh: () => ({ list: [], next: Date.now() + rand(150, 300) * 1000 }),
  load(o) {
    return {
      list: (Array.isArray(o.list) ? o.list : []).filter(l => l && Number.isFinite(l.a)).slice(0, MAX_LEAKS)
        .map(l => ({ a: l.a, ate: Math.max(0, +l.ate || 0), born: 0 })),
      next: +o.next || Date.now() + 150000,
    };
  },
  next: rand(150, 330), seasonT: rand(20, 50), items: [], season: null,
  // Each grown leak soaks up 5% of production.
  drain() { return G.leaks.list.filter(l => l.born >= 1).length * LEAK_DRAIN; },
  tick(dt) {
    const L = G.leaks;
    let grew = false;
    for (const l of L.list) {
      if (l.born < 1) { l.born = Math.min(1, l.born + dt / 2); if (l.born >= 1) grew = true; continue; }
      l.ate += D.tpsGross * LEAK_DRAIN * dt;
    }
    if (grew) recompute();
    if (Date.now() >= L.next) {
      L.next = Date.now() + rand(150, 330) * 1000;
      if (L.list.length < MAX_LEAKS && D.tpsGross > 0 && !document.hidden) L.list.push({ a: rand(0, Math.PI * 2), ate: 0, born: 0 });
    }
    // Random events (only while someone is watching).
    if ((this.next -= dt) <= 0) {
      this.next = rand(150, 330);
      if (!document.hidden && D.tpsGross > 0 && !(typeof BlackHole !== 'undefined' && BlackHole.running) && !(typeof Supernova !== 'undefined' && Supernova.running) && !this.pr) {
        Math.random() < 0.3 ? this.rateLimit() : this.pullRequest();
      }
    }
    // Seasons.
    const s = currentSeason();
    if (s !== this.season) { this.season = s; this.decorate(); }
    if (s && (this.seasonT -= dt) <= 0) { this.seasonT = rand(40, 80); this.spawnItem(); }
    if (this.pr) this.prTick(dt);
  },

  // ---------- memory leaks and seasonal items, drawn on the sparkle canvas ----------
  leakPos(l, st, t) {
    const wob = Math.sin(t * 2 + l.a * 3) * 0.04;
    return { x: st.cx + Math.cos(l.a + wob) * st.R * 1.0, y: st.cy + Math.sin(l.a + wob) * st.R * 1.0, r: st.R * (0.1 + 0.05 * Math.min(1, Math.log10(1 + l.ate) / 12)) * l.born };
  },
  draw(c, st, dt, t) {
    for (const l of G.leaks.list) {
      const p = this.leakPos(l, st, t);
      if (p.r <= 0.5) continue;
      c.save();
      c.translate(p.x, p.y);
      c.beginPath();
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2, rr = p.r * (1 + Math.sin(a * 3 + t * 3 + l.a) * 0.12);
        k ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      const g = c.createRadialGradient(-p.r * 0.3, -p.r * 0.3, p.r * 0.1, 0, 0, p.r * 1.1);
      g.addColorStop(0, 'rgba(200,170,255,.95)');
      g.addColorStop(0.6, 'rgba(120,70,220,.85)');
      g.addColorStop(1, 'rgba(60,20,120,.85)');
      c.fillStyle = g;
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(-p.r * 0.3, -p.r * 0.1, p.r * 0.16, 0, Math.PI * 2);
      c.arc(p.r * 0.3, -p.r * 0.1, p.r * 0.16, 0, Math.PI * 2);
      c.fill();
      if (st.hoverLeak === l) {
        c.font = "600 11px 'Martian Mono', monospace";
        c.textAlign = 'center';
        c.fillStyle = '#E2D4FF';
        c.fillText(`holds ${fmt(l.ate)} · pop for ${fmt(l.ate * 1.1)}`, 0, -p.r - 8);
      }
      c.restore();
    }
    // Seasonal items drift across the panel.
    this.items = this.items.filter(it => (it.t += dt) < it.dur);
    for (const it of this.items) {
      const p = this.itemPos(it, st);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(Math.sin(it.t * 2) * 0.3);
      c.drawImage(it.spr, -it.size / 2, -it.size / 2, it.size, it.size);
      c.restore();
    }
    // Rate limited: grey out the sparkle.
    if (rateLimited()) {
      c.fillStyle = 'rgba(30,30,34,.55)';
      c.beginPath();
      c.arc(st.cx, st.cy, st.R * 1.05, 0, Math.PI * 2);
      c.fill();
    }
  },
  itemPos(it, st) {
    const p = it.t / it.dur;
    return { x: it.dir > 0 ? -30 + (st.w + 60) * p : st.w + 30 - (st.w + 60) * p, y: it.y * st.h + Math.sin(it.t * 2.2) * 18 };
  },
  hit(x, y, st) {
    const t = st.t;
    for (const it of this.items) {
      const p = this.itemPos(it, st);
      if (Math.hypot(x - p.x, y - p.y) < it.size * 0.65) {
        this.items.splice(this.items.indexOf(it), 1);
        const g = Math.max(D.tpsGross * 120, 100);
        earn(g);
        st.floats.push({ x: p.x, y: p.y - 10, text: '+' + fmt(g), life: 0, max: 1.3, col: '#F2C57C' });
        Sound.ach();
        return true;
      }
    }
    for (const l of G.leaks.list) {
      const p = this.leakPos(l, st, t);
      if (Math.hypot(x - p.x, y - p.y) < p.r + 6) {
        G.leaks.list.splice(G.leaks.list.indexOf(l), 1);
        const back = l.ate * 1.1;
        G.tokens += l.ate;
        earn(l.ate * 0.1);
        st.floats.push({ x: p.x, y: p.y - 10, text: '+' + fmt(back), life: 0, max: 1.3, col: '#C9A9FF' });
        Sound.pop();
        recompute();
        return true;
      }
    }
    return false;
  },
  hover(x, y, st) {
    st.hoverLeak = G.leaks.list.find(l => { const p = this.leakPos(l, st, st.t); return Math.hypot(x - p.x, y - p.y) < p.r + 6; }) || null;
    return !!st.hoverLeak || this.items.some(it => { const p = this.itemPos(it, st); return Math.hypot(x - p.x, y - p.y) < it.size * 0.65; });
  },
  spawnItem() {
    const s = SEASONS[this.season];
    if (!s || !Stage.cv || !Stage.cv.clientWidth) return;
    this.sprites = this.sprites || {};
    const spr = this.sprites[s.glyph] || (this.sprites[s.glyph] = makeSprite(GLYPH[s.glyph], 44));
    this.items.push({ spr, size: 44, t: 0, dur: rand(8, 11), dir: Math.random() < 0.5 ? 1 : -1, y: rand(0.25, 0.75) });
  },
  decorate() {
    document.body.classList.toggle('season-hackathon', this.season === 'hackathon');
    document.body.classList.toggle('season-launch', this.season === 'launch');
    const pill = document.getElementById('seasonPill');
    if (!pill) return;
    const s = SEASONS[this.season];
    pill.hidden = !s;
    if (s) pill.innerHTML = `${svgIcon(GLYPH[s.glyph])}<span>${esc(s.name)}</span>`;
  },
  seasonTip() {
    const s = SEASONS[this.season];
    if (!s) return '';
    return tipHead(svgIcon(GLYPH[s.glyph]), s.name, 'Seasonal event') + `<div class="tip-desc">${esc(s.text)}</div>` +
      `<div class="tip-stats">Each ${esc(s.item)} you catch is worth <b>2 minutes</b> of production. Seasons rotate every week: Hackathon Week, Launch Week, then a normal week.</div>`;
  },

  // ---------- Rate Limited ----------
  rateLimit() {
    clickBlockedUntil = performance.now() + 10000;
    addBuff('ratelimit', 'Rate Limited', 10, { bad: true, desc: '429 Too Many Requests: the sparkle ignores clicks until this runs out.' });
    Sound.fail();
    const box = document.createElement('div');
    box.className = 'err429';
    box.innerHTML = '<div class="err-title">429 Too Many Requests</div><div class="err-body">You have exceeded your rate limit. Retry-After: <b>10</b>s</div>';
    document.body.appendChild(box);
    this.errBox = box;
    const place = () => {
      if (!box.isConnected) return;
      const r = Stage.cv.getBoundingClientRect();
      const visible = Stage.cv.clientWidth > 0;
      box.style.left = (visible ? r.left + Stage.cx : innerWidth / 2) + 'px';
      box.style.top = (visible ? r.top + Stage.cy : innerHeight / 2) + 'px';
      const left = Math.max(0, Math.ceil((clickBlockedUntil - performance.now()) / 1000));
      box.querySelector('b').textContent = left;
      if (left <= 0) { box.classList.add('gone'); setTimeout(() => box.remove(), 300); return; }
      requestAnimationFrame(place);
    };
    place();
  },
  shakeError() {
    const b = this.errBox;
    if (!b || !b.isConnected) return;
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
  },

  // ---------- Pull Request pop-ups ----------
  pullRequest() {
    const bad = Math.random() < 0.45;
    const card = document.createElement('div');
    card.className = 'pr-card';
    card.innerHTML =
      `<div class="pr-top"><span class="pr-badge">Open</span><span class="pr-num">Pull request #${Math.floor(rand(1000, 9999))}</span></div>` +
      `<div class="pr-title">${esc(pick(bad ? PR_BAD : PR_GOOD))}</div>` +
      `<div class="pr-meta">opened by <b>${pick(PR_AUTHORS)}</b> · <span class="add">+${Math.floor(rand(2, 400))}</span> <span class="del">−${Math.floor(rand(1, 200))}</span></div>` +
      `<div class="pr-btns"><button type="button" class="btn pr-ok" data-pr="approve">Approve</button><button type="button" class="btn pr-no" data-pr="reject">Request changes</button></div>` +
      `<div class="pr-timer"><span></span></div>`;
    document.body.appendChild(card);
    this.pr = { card, bad, left: 5 };
    card.addEventListener('click', e => { const b = e.target.closest('[data-pr]'); if (b) this.prDecide(b.dataset.pr); });
    Sound.tone(880, 0.12, { vol: 0.03 });
  },
  prTick(dt) {
    const pr = this.pr;
    pr.left -= dt;
    pr.card.querySelector('.pr-timer span').style.width = `${clamp(pr.left / 5, 0, 1) * 100}%`;
    if (pr.left <= 0) this.prDecide('timeout');
  },
  prDecide(choice) {
    const pr = this.pr;
    if (!pr) return;
    this.pr = null;
    pr.card.classList.add('gone');
    setTimeout(() => pr.card.remove(), 300);
    const reward = () => { const g = Math.max(D.tpsGross * 180, 50); earn(g); return fmt(g); };
    if (choice === 'timeout') return toast({ icon: GLYPH.clock, kicker: 'Pull request', title: 'The PR went stale', text: 'Nobody reviewed it in time.', life: 3000 });
    if (choice === 'approve' && !pr.bad) { Sound.ach(); return toast({ icon: GLYPH.up, kicker: 'Merged', title: `+${reward()} tokens`, text: 'Clean change, happy contributor.', kind: 'mint' }); }
    if (choice === 'reject' && pr.bad) { Sound.ach(); return toast({ icon: GLYPH.up, kicker: 'Good catch', title: `+${reward()} tokens`, text: 'That one would have been a very bad day.', kind: 'mint' }); }
    if (choice === 'reject') return toast({ icon: GLYPH.clock, kicker: 'Changes requested', title: 'That PR was fine', text: 'The contributor is a little sad. No reward.', life: 3500 });
    // Approved a disaster.
    const loss = G.tokens * 0.05;
    G.tokens -= loss;
    addBuff('incident', 'Production Incident', 30, { prod: 0.5, desc: 'You approved a disastrous pull request. Production is halved while everyone cleans up.' });
    Sound.fail();
    toast({ icon: GLYPH.bug, kicker: 'Production incident', title: `−${fmt(loss)} tokens`, text: 'That PR should never have been merged. Production halved for 30 seconds.', kind: 'bad', life: 6000 });
  },
};
registerSystem(Events);
on('blockedClick', () => Events.shakeError());
