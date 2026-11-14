/* Brain Rocket – Evolved: a pretend Warden Chat back end, for the demo build only
 * (tools/build_page.py --wallet-demo). It answers the same Supabase Auth and database calls the real
 * one will (docs/ECONOMY-BRE.md and the SirSC wallet's docs/ECONOMY-API.md), keeps everything in this
 * browser's storage, and starts every new demo account with some coins and diamonds to spend.
 * Nothing here touches a real account. Ported from Wildcard Chess's js/wallet-mock.js. */
'use strict';
(() => {
  window.BRE_DEMO = true;
  const KEY = 'brEvolved.demo-db';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  let mem = load() || { users: {}, wallets: {}, owned: {}, equipped: {}, requests: [], rewards: [], dailies: {} };
  mem.boards = mem.boards || {};
  const TIER_PTS = [500, 750, 1500, 3000, 4250, 5000];

  // Pretend rivals for the leaderboard: the same 40 players every day, with scores seeded by the day.
  const RIVALS = ['Rook_Rival', 'luna', 'Sam_W', 'NovaKid', 'pixelpanda', 'Captain_Q', 'mossy', 'zed.exe', 'Juniper', 'OrbitOwl',
    'marmalade', 'Tycho', 'beanbag', 'Quasar_Q', 'kestrel', 'Pip', 'Ada_L', 'snowcone', 'Vega', 'Rocket_Rae', 'Bramble', 'ollie.b',
    'Comet_Kai', 'fizz', 'Hollis', 'nebulynn', 'Wren', 'otto_matic', 'Saffron', 'Dex', 'Moonpie', 'Ilsa', 'Gizmo', 'tinsel',
    'Rhea_S', 'Banjo', 'Mira', 'clementine', 'Atlas_J', 'zuzu'];
  const FRIENDS = ['luna', 'Sam_W', 'Rook_Rival', 'marmalade', 'Wren'];
  function seeded(n) { let a = n >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function rivals(day) {
    const r = seeded(day * 7919 + 17), out = [];
    for (const name of RIVALS) {
      if (r() < 0.25) continue;   // not everyone plays every day
      const skill = r(), tiers = Array.from({ length: 10 }, () => { const x = r(); return x < 0.12 - skill * 0.08 ? -1 : x < 0.4 - skill * 0.2 ? 0 : x < 0.5 ? 1 : x < 0.75 - skill * 0.1 ? 2 : x < 0.9 - skill * 0.05 ? 3 : x < 0.985 ? 4 : 5; });
      out.push({ user_id: 'bot-' + name, username: name, member: r() < 0.2, tiers, score: tiers.reduce((t, k) => t + (k >= 0 ? TIER_PTS[k] : 0), 0), at: Date.now() - Math.floor(r() * 8e7) });
    }
    return out;
  }
  function ranked(day) {
    const all = rivals(day).concat(mem.boards[day] || []);
    all.sort((a, b) => b.score - a.score || a.at - b.at);
    return all.map(e => ({ ...e, rank: 1 + all.filter(x => x.score > e.score).length }));
  }
  function board(b, u) {
    const day = b.day | 0, scope = b.scope === 'friends' ? 'friends' : 'all';
    if (day < 1 || day > utcDay() + 1) return fail('sirsc_bad_request');
    if (scope === 'friends' && !u) return fail('sirsc_not_signed_in');
    let all = ranked(day);
    if (scope === 'friends') {
      all = all.filter(e => FRIENDS.includes(e.username) || (u && e.user_id === u.id));
      all = all.map(e => ({ ...e, rank: 1 + all.filter(x => x.score > e.score).length }));
    }
    const show = e => ({ rank: e.rank, username: e.username, member: e.member, score: e.score, tiers: e.tiers, you: !!(u && e.user_id === u.id) });
    const me = u && all.find(e => e.user_id === u.id);
    return R(200, { day, scope, players: all.length, me: me ? show(me) : null, rows: all.slice(0, 50).map(show) });
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* storage blocked: in memory only */ } };
  const R = (status, data) => Promise.resolve({ status, data });
  const fail = code => R(400, { code: 'P0001', message: code });
  const uid = name => 'demo-' + name.toLowerCase();
  const today = () => new Date().toISOString().slice(0, 10);
  const EPOCH = Date.UTC(2026, 10, 13);
  const utcDay = () => Math.floor((Date.now() - EPOCH) / 864e5) + 1;
  const ENDLESS_CAP = 80000;

  function tokenFor(u) {
    return { access_token: 'demo.' + u.id + '.' + Date.now(), refresh_token: 'demo-refresh.' + u.id, expires_in: 3600,
      user: { id: u.id, email: u.name + '@warden.invalid', user_metadata: { username: u.name } } };
  }
  function userOf(headers) {
    const m = /^Bearer demo\.(demo-[^.]+)\./.exec(headers.Authorization || '');
    return m && mem.users[m[1]] ? mem.users[m[1]] : null;
  }
  function wallet(id) {
    if (!mem.wallets[id]) mem.wallets[id] = { coins: 40000, diamonds: 10, member_until: null, member_month: null };
    return mem.wallets[id];
  }
  const isMember = w => !!(w.member_until && Date.parse(w.member_until) > Date.now());
  function meOf(id) {
    const w = wallet(id);
    return { coins: w.coins, diamonds: w.diamonds, member: isMember(w), member_until: w.member_until, admin: false,
      owned: (mem.owned[id] || []).map(item_id => ({ item_id, target: '' })), equipped: mem.equipped[id] || {},
      catalog: BRE_CATALOG.map(c => ({ ...c, slot: String(c.item_id).split(':')[0] })),
      requests: mem.requests.filter(r => r.user_id === id).slice(-10).reverse(), server_now: new Date().toISOString() };
  }
  const owns = (id, item) => (mem.owned[id] || []).includes(item);
  const give = (id, item) => { (mem.owned[id] = mem.owned[id] || []).push(item); };

  function reward(b, id, w) {
    const memberM = isMember(w) ? 1.5 : 1;
    if (b.mode === 'daily') {
      const okDay = Math.abs((b.day | 0) - utcDay()) <= 1;
      if (!okDay || b.prompts !== 10 || b.answers < 0 || b.answers > 10 || b.score < b.answers * 500 || b.score > b.answers * 5000 || b.score % 250
        || b.duration_ms < 10000 || b.duration_ms > 10800000) return fail('sirsc_bad_reward');
      const tiers = b.tiers;
      if (!Array.isArray(tiers) || tiers.length !== 10 || tiers.some(t => !Number.isInteger(t) || t < -1 || t > 5)
        || tiers.reduce((t, k) => t + (k >= 0 ? TIER_PTS[k] : 0), 0) !== b.score || tiers.filter(t => t >= 0).length !== b.answers) return fail('sirsc_bad_reward');
      const paidKey = id + ':' + b.day, already = !!mem.dailies[paidKey];
      if (!already) {
        const list = (mem.boards[b.day] = mem.boards[b.day] || []);
        list.push({ user_id: id, username: (mem.users[id] || {}).name || 'you', member: isMember(w), tiers, score: b.score, at: Date.now() });
      }
      const base = 10000, bonus = Math.floor(0.6 * b.score), coins = already ? 0 : Math.floor((base + bonus) * memberM);
      if (!already) { mem.dailies[paidKey] = true; w.coins += coins; save(); }
      const mine = ranked(b.day).find(e => e.user_id === id);
      return R(200, { coins, base, score_bonus: bonus, member_mult: memberM, already_paid: already, rank: mine ? mine.rank : null, players: ranked(b.day).length, me: meOf(id) });
    }
    if (b.mode === 'endless') {
      if (!['easy', 'medium', 'hard', 'ultra'].includes(b.diff) || b.prompts < 1 || b.prompts > 2000 || b.answers < 0 || b.answers > b.prompts
        || b.score < 0 || b.score > b.answers * 7500 || b.duration_ms < b.prompts * 1500 || b.duration_ms > 14400000) return fail('sirsc_bad_reward');
      const hour = mem.rewards.filter(r => r.user_id === id && Date.now() - r.at < 3600e3).length;
      if (hour >= 20) return fail('sirsc_rate_limited');
      const day = today(), earned = mem.rewards.filter(r => r.user_id === id && r.day === day).reduce((t, r) => t + r.coins, 0);
      const scoreCoins = Math.floor(Math.min(20000, 0.4 * b.score));
      let coins = Math.floor(scoreCoins * memberM);
      const left = Math.max(0, ENDLESS_CAP - earned), capped = coins > left;
      coins = Math.min(coins, left);
      w.coins += coins;
      mem.rewards.push({ user_id: id, day, at: Date.now(), coins });
      save();
      return R(200, { coins, score_coins: scoreCoins, member_mult: memberM, capped, today: earned + coins, daily_cap: ENDLESS_CAP, me: meOf(id) });
    }
    return fail('sirsc_bad_reward');
  }

  function rpc(fn, b, u) {
    if (fn === 'bre_ping') return R(200, true);
    if (fn === 'my_account_state') return R(200, { active: true });
    if (fn === 'bre_daily_board') return board(b, u);
    if (!u) return fail('sirsc_not_signed_in');
    const id = u.id, w = wallet(id);
    if (fn === 'sirsc_me') return R(200, meOf(id));
    if (fn === 'sirsc_member_claim') {
      const out = { diamonds_added: 0, claimed: [] };
      if (isMember(w)) {
        const month = new Date().toISOString().slice(0, 7);
        if (w.member_month !== month) { w.member_month = month; w.diamonds += 5; out.diamonds_added = 5; }
        const t = Date.now();
        for (const c of BRE_CATALOG) {
          if (!c.member_only || owns(id, c.item_id)) continue;
          if (c.claim_from && !(Date.parse(c.claim_from) <= t && t < Date.parse(c.claim_until))) continue;
          give(id, c.item_id); out.claimed.push(c.item_id);
        }
        save();
      }
      out.me = meOf(id);
      return R(200, out);
    }
    if (fn === 'sirsc_buy') {
      const c = BRE_CATALOG.find(x => x.item_id === b.item_id);
      if (!c || b.game !== 'bre') return fail('sirsc_unknown_item');
      if (c.member_only) return fail('sirsc_member_only');
      const cost = b.currency === 'coins' ? c.coins : b.currency === 'diamonds' ? c.diamonds : null;
      if (!cost) return fail('sirsc_wrong_currency');
      if (owns(id, c.item_id)) return fail('sirsc_owned');
      if ((b.currency === 'coins' ? w.coins : w.diamonds) < cost) return fail('sirsc_not_enough');
      if (b.currency === 'coins') w.coins -= cost; else w.diamonds -= cost;
      give(id, c.item_id); save();
      return R(200, meOf(id));
    }
    if (fn === 'sirsc_equip') {
      if (b.game !== 'bre') return fail('sirsc_unknown_item');
      const mine = (mem.equipped[id] = mem.equipped[id] || {});
      if (b.item_id == null) { delete mine[b.slot]; save(); return R(200, meOf(id)); }
      const c = BRE_CATALOG.find(x => x.item_id === b.item_id);
      if (!c) return fail('sirsc_unknown_item');
      if (!owns(id, c.item_id)) return fail('sirsc_not_owned');
      if (String(c.item_id).split(':')[0] !== b.slot) return fail('sirsc_wrong_slot');
      mine[b.slot] = c.item_id; save();
      return R(200, meOf(id));
    }
    if (fn === 'sirsc_request_diamonds') {
      const n = b.diamonds | 0;
      if (n < 5 || n > 500 || n % 5) return fail('sirsc_bad_request');
      if (mem.requests.filter(r => r.user_id === id && r.status === 'pending').length >= 3) return fail('sirsc_too_many_requests');
      mem.requests.push({ id: 'req-' + Date.now(), user_id: id, diamonds: n, note: b.note || '', status: 'pending', created_at: new Date().toISOString() });
      save(); return R(200, meOf(id));
    }
    if (fn === 'sirsc_cancel_request') {
      const r = mem.requests.find(x => x.id === b.request_id && x.user_id === id);
      if (!r || r.status !== 'pending') return fail('sirsc_request_closed');
      r.status = 'cancelled'; save(); return R(200, meOf(id));
    }
    // demo only: pretend an admin gave this account a month of membership
    if (fn === 'demo_membership') { w.member_until = new Date(Date.now() + 30 * 864e5).toISOString(); save(); return R(200, meOf(id)); }
    if (fn === 'bre_reward') return reward(b, id, w);
    return R(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  }

  function transport(method, url, headers, body) {
    const path = url.replace(BRE_CONFIG.supabaseUrl, '');
    return new Promise(r => setTimeout(r, 120)).then(() => {
      if (path.startsWith('/auth/v1/signup')) {
        const name = String(body.data && body.data.username || '').trim(), id = uid(name);
        if (mem.users[id]) return R(422, { error_code: 'user_already_exists', msg: 'User already registered' });
        mem.users[id] = { id, name, password: body.password }; save();
        return R(200, tokenFor(mem.users[id]));
      }
      if (path.startsWith('/auth/v1/token?grant_type=password')) {
        const name = String(body.email).split('@')[0], u = Object.values(mem.users).find(x => x.name.toLowerCase() === name);
        // demo: any username and password work; a new name makes a new demo account
        const user = u || (mem.users[uid(name)] = { id: uid(name), name, password: body.password });
        save();
        return R(200, tokenFor(user));
      }
      if (path.startsWith('/auth/v1/token?grant_type=refresh_token')) {
        const m = /^demo-refresh\.(.+)$/.exec(body.refresh_token || ''), u = m && mem.users[m[1]];
        return u ? R(200, tokenFor(u)) : R(400, { error_code: 'refresh_token_not_found' });
      }
      if (path.startsWith('/auth/v1/logout')) return R(204, null);
      const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
      if (m) return rpc(m[1], body || {}, userOf(headers));
      return R(404, { message: 'not found' });
    });
  }
  Account.useTransport(transport);
})();
