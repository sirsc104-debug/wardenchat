/* Wildcard Chess: a pretend Warden Chat back end, for the demo build only (build-artifact.py
   --wallet-demo). It answers the same Supabase Auth and database calls the real one will
   (docs/ECONOMY-WCC.md and the SirSC wallet's docs/ECONOMY-API.md), keeps everything in this
   browser's storage, and starts every new demo account with some coins and diamonds to spend.
   Nothing here touches a real account. */
'use strict';
(() => {
  const KEY = 'wcc-demo-db';
  const VALID = WILD_IDS;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  let mem = load() || { users: {}, wallets: {}, owned: {}, requests: [], rewards: [], codex: {} };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* storage blocked: in memory only */ } };
  const R = (status, data) => Promise.resolve({ status, data });
  const fail = code => R(400, { code: 'P0001', message: code });
  const uid = name => 'demo-' + name.toLowerCase();
  const today = () => new Date().toISOString().slice(0, 10);

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
      owned: (mem.owned[id] || []).map(item_id => ({ item_id, target: '' })), catalog: WCC_CATALOG,
      requests: mem.requests.filter(r => r.user_id === id).slice(-10).reverse(), server_now: new Date().toISOString() };
  }
  const owns = (id, item) => (mem.owned[id] || []).includes(item);
  const give = (id, item) => { (mem.owned[id] = mem.owned[id] || []).push(item); };

  function rpc(fn, b, u) {
    if (fn === 'wcc_ping') return R(200, true);
    if (fn === 'my_account_state') return R(200, { active: true });
    if (!u) return fail('sirsc_not_signed_in');
    const id = u.id, w = wallet(id);
    if (fn === 'sirsc_me') return R(200, meOf(id));
    if (fn === 'sirsc_member_claim') {
      const out = { diamonds_added: 0, claimed: [] };
      if (isMember(w)) {
        const month = new Date().toISOString().slice(0, 7);
        if (w.member_month !== month) { w.member_month = month; w.diamonds += 5; out.diamonds_added = 5; }
        const t = Date.now();
        for (const c of WCC_CATALOG) {
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
      const c = WCC_CATALOG.find(x => x.item_id === b.item_id);
      if (!c || b.game !== 'wcc') return fail('sirsc_unknown_item');
      if (c.member_only) return fail('sirsc_member_only');
      const cost = b.currency === 'coins' ? c.coins : b.currency === 'diamonds' ? c.diamonds : null;
      if (!cost) return fail('sirsc_wrong_currency');
      if (owns(id, c.item_id)) return fail('sirsc_owned');
      if ((b.currency === 'coins' ? w.coins : w.diamonds) < cost) return fail('sirsc_not_enough');
      if (b.currency === 'coins') w.coins -= cost; else w.diamonds -= cost;
      give(id, c.item_id); save();
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
    if (fn === 'wcc_reward') {
      const base = { easy: 500, medium: 1000, pro: 2000, xtreme: 4000 }[b.level], rm = { win: 1, draw: 0.3, loss: 0.1 }[b.result];
      if (!base || rm == null || b.plies < 12 || b.plies > 1000 || b.duration_ms < 30000 || b.duration_ms > 14400000) return fail('sirsc_bad_reward');
      const hour = mem.rewards.filter(r => r.user_id === id && Date.now() - r.at < 3600e3).length;
      if (hour >= 20) return fail('sirsc_rate_limited');
      const day = today(), mine = mem.rewards.filter(r => r.user_id === id && r.day === day);
      const draftM = b.draft ? 1.25 : 1, memberM = isMember(w) ? 1.5 : 1;
      const firstWin = b.result === 'win' && !mine.some(r => r.win) ? 1500 : 0;
      let coins = Math.floor(base * rm * draftM * memberM) + firstWin;
      const earned = mine.reduce((t, r) => t + r.coins, 0), left = Math.max(0, 25000 - earned), capped = coins > left;
      coins = Math.min(coins, left);
      const paid = mem.codex[id] = mem.codex[id] || [];
      const fresh = [...new Set(b.codex || [])].filter(t => VALID.includes(t) && !paid.includes(t));
      paid.push(...fresh);
      const codexBonus = fresh.length * 500;
      w.coins += coins + codexBonus;
      mem.rewards.push({ user_id: id, day, at: Date.now(), coins, win: b.result === 'win' });
      save();
      return R(200, { coins: coins + codexBonus, base, result_mult: rm, draft_mult: draftM, member_mult: memberM, first_win_bonus: firstWin,
        codex_bonus: codexBonus, codex_new: fresh, capped, today: earned + coins, daily_cap: 25000, me: meOf(id) });
    }
    return R(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn });
  }

  function handle(method, url, headers, body) {
    const path = url.replace(WCC_CONFIG.supabaseUrl, '');
    if (path.startsWith('/auth/v1/token?grant_type=password') || path === '/auth/v1/signup') {
      const name = String((body.data && body.data.username) || body.email.split('@')[0]).trim();
      if (!Account.RULES.nameRe.test(name) || name.length < 3) return R(400, { msg: 'Database error saving new user' });
      const id = uid(name);
      if (!mem.users[id]) { mem.users[id] = { id, name }; save(); }
      return R(200, tokenFor(mem.users[id]));
    }
    if (path.startsWith('/auth/v1/token?grant_type=refresh_token')) {
      const id = String(body.refresh_token || '').replace('demo-refresh.', '');
      return mem.users[id] ? R(200, tokenFor(mem.users[id])) : R(400, { error_code: 'refresh_token_not_found' });
    }
    if (path.startsWith('/auth/v1/logout')) return R(204, null);
    const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
    if (m) return rpc(m[1], body || {}, userOf(headers));
    return R(404, { message: 'not found' });
  }

  window.WCC_DEMO = true;
  // the sign-in dialog says so too
  document.addEventListener('DOMContentLoaded', () => {});
  setTimeout(() => { const w = document.querySelector('#signin .why'); if (w) w.textContent = 'Demo build: any username and password work, and every new account starts with 🪙 40,000 and 💎 10 to try the Shop. Nothing here touches a real Warden Chat account.'; }, 0);
  Account.useTransport((method, url, headers, body) => new Promise(res => setTimeout(() => res(handle(method, url, headers, body)), 120)));
})();
