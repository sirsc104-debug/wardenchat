const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const tick = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)); };
function server() {
  const users = {}, calls = []; let failure = null, hold = null;
  const state = id => users[id] ||= { coins: 40000, owned: ['board:marble', 'board:ebony', 'back:jade'].map(item_id => ({ item_id, target: '' })), equipped: {}, catalog: [] };
  return { state, calls, fail: code => failure = code, hold: fn => hold = fn,
    async transport(method, url, headers, body) {
      if (url.includes('/auth/v1/token')) { const id = body.email.split('@')[0]; return { status: 200, data: { access_token: id, refresh_token: id, expires_in: 3600, user: { id, email: body.email } } }; }
      if (url.includes('/logout')) return { status: 204 };
      const fn = url.split('/').pop(), id = headers.Authorization?.slice(7);
      calls.push({ fn, id, body });
      if (fn === 'wcc_ping') return { status: 200, data: true };
      if (failure && fn === 'sirsc_equip') { if (failure === 'offline') throw Error('network'); return { status: 400, data: { message: failure, code: 'P0001' } }; }
      if (hold) { const h = hold; hold = null; return h(fn, id, body); }
      const m = state(id);
      if (fn === 'sirsc_buy') { m.coins -= 15000; m.owned.push({ item_id: body.item_id, target: '' }); }
      if (fn === 'sirsc_equip') { if (body.item_id === null) delete m.equipped[body.slot]; else m.equipped[body.slot] = body.item_id; }
      return { status: 200, data: structuredClone(m) };
    }
  };
}
function client(s, storage = new Map(), blocked = false) {
  const events = {};
  const c = vm.createContext({ console, setTimeout, clearTimeout, AbortController, fetch, BoardView: { all: [] }, PIECE_SET: 'classic',
    window: { addEventListener: (k, f) => (events[k] ||= []).push(f) },
    document: { documentElement: { style: { setProperty() {} }, dataset: {} } },
    localStorage: { getItem(k) { if (blocked) throw Error('blocked'); return storage.get(k) || null; }, setItem(k, v) { if (blocked) throw Error('blocked'); storage.set(k, v); }, removeItem(k) { if (blocked) throw Error('blocked'); storage.delete(k); } } });
  for (const file of ['art.js', 'cosmetics.js', 'wallet.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), c);
  const api = vm.runInContext('({ Account, Wallet, Look })', c); api.Account.useTransport(s.transport);
  return { ...api, storage, online: () => (events.online || []).forEach(f => f()), login: async (name = 'alice') => { await api.Account.signIn(name, 'password123'); await tick(); } };
}
test('equip survives reload and an independent client; server beats device preferences', async () => {
  const s = server(), a = client(s); await a.login();
  s.state('alice').owned = s.state('alice').owned.filter(o => o.item_id !== 'board:marble');
  await a.Wallet.load(); await a.Wallet.buy('board:marble', 'coins');
  a.Look.choose('board', 'marble'); assert.equal(a.Look.current().board, 'marble'); await tick();
  const b = client(s); await b.login(); assert.equal(b.Look.current().board, 'marble');
  const reload = client(s, a.storage); await reload.login(); assert.equal(reload.Look.current().board, 'marble');
  b.Look.choose('back', 'jade'); await tick(); b.Look.choose('board', 'walnut'); await tick();
  await a.Wallet.load(); assert.equal(a.Look.current().board, 'walnut'); assert.equal(a.Look.current().back, 'jade');
});
test('offline pending changes survive reload, retry on wallet answer, and coalesce per slot', async () => {
  const s = server(), a = client(s); await a.login(); s.fail('offline');
  a.Look.choose('board', 'marble'); await tick(); a.Look.choose('board', 'ebony'); await tick();
  const b = client(s, a.storage); await b.login(); assert.equal(b.Look.current().board, 'ebony');
  const count = s.calls.length; await tick(); assert.equal(s.calls.length, count);
  s.fail(null); await b.Wallet.load(); await tick(); assert.equal(s.state('alice').equipped.board, 'board:ebony');
});
test('non-offline error discards pending choice and refreshes server state', async () => {
  for (const error of ['sirsc_wrong_slot', 'sirsc_not_owned', 'sirsc_unknown_item', 'rate_limited']) {
    const s = server(), a = client(s); s.state('alice').equipped.board = 'board:marble'; await a.login();
    s.fail(error); a.Look.choose('board', 'ebony'); await tick(); assert.equal(a.Look.current().board, 'marble');
    s.fail(null); await a.Wallet.load(); await tick(); assert.equal(s.state('alice').equipped.board, 'board:marble');
  }
});
test('account switches isolate pending choices and ignore an old in-flight response', async () => {
  const s = server(), a = client(s); await a.login(); let finish;
  s.hold(() => new Promise(r => finish = r)); a.Look.choose('board', 'marble'); await tick();
  await a.Account.signOut(); await a.login('bobby');
  finish({ status: 200, data: { ...s.state('alice'), equipped: { board: 'board:marble' } } }); await tick();
  assert.equal(a.Look.current().board, 'walnut'); assert.equal(a.Wallet.me.equipped.board, undefined);
  assert.ok(!s.calls.some(c => c.id === 'bobby' && c.fn === 'sirsc_equip'));
});
test('rapid choices stay optimistic while earlier response arrives', async () => {
  const s = server(), a = client(s); await a.login(); let finish;
  s.hold(() => new Promise(r => finish = r)); a.Look.choose('board', 'marble'); await tick(); a.Look.choose('board', 'ebony');
  finish({ status: 200, data: { ...s.state('alice'), equipped: { board: 'board:marble' } } }); await tick();
  assert.equal(a.Look.current().board, 'ebony'); assert.equal(s.state('alice').equipped.board, 'board:ebony');
});
test('blocked browser storage still permits signed-in equip and signed-out play', async () => {
  const s = server(), a = client(s, new Map(), true); a.Look.choose('board', 'walnut'); await a.login();
  a.Look.choose('board', 'marble'); await tick(); assert.equal(a.Look.current().board, 'marble');
  await a.Account.signOut(); assert.equal(a.Look.current().board, 'walnut');
});
test('wallet read during an equip cannot roll back the committed choice', async () => {
  const s = server(), a = client(s); await a.login(); let finish;
  s.hold(() => new Promise(r => finish = r)); a.Look.choose('board', 'marble'); await tick();
  await a.Wallet.load(); s.state('alice').equipped.board = 'board:marble';
  finish({ status: 200, data: structuredClone(s.state('alice')) }); await tick();
  assert.equal(a.Look.current().board, 'marble');
});
test('reconnect retries only the signed-in user queue; returning user recovers their pending choice', async () => {
  const s = server(), a = client(s); await a.login(); s.fail('offline'); a.Look.choose('board', 'ebony'); await tick();
  await a.login('bobby'); assert.equal(a.Look.current().board, 'walnut');
  s.fail(null); a.online(); await tick(); assert.equal(s.state('bobby').equipped.board, undefined);
  await a.login(); await tick(); assert.equal(a.Look.current().board, 'ebony'); assert.equal(s.state('alice').equipped.board, 'board:ebony');
});
test('late wallet read cannot overwrite a more recent equip', async () => {
  const s = server(), a = client(s); await a.login(); let finish;
  const stale = structuredClone(s.state('alice'));
  s.hold(() => new Promise(r => finish = r)); const read = a.Wallet.load(); await tick();
  a.Look.choose('board', 'marble'); await tick(); finish({ status: 200, data: stale }); await read;
  assert.equal(a.Look.current().board, 'marble');
});
test('demo contract exposes slots, equip/replace/unequip and exact errors', async () => {
  const s = server(), a = client(s);
  // Run the actual demo transport in a second VM with its real engine dependencies.
  const c = vm.createContext({ console, setTimeout, clearTimeout, AbortController, fetch, window: { addEventListener() {} },
    document: { addEventListener() {}, querySelector() {} }, localStorage: { getItem() {}, setItem() {}, removeItem() {} } });
  for (const f of ['art.js', 'engine.js', 'cosmetics.js', 'wallet.js', 'wallet-mock.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), c);
  const { Account, Wallet } = vm.runInContext('({ Account, Wallet })', c);
  await Account.signIn('demo', 'password123'); await Wallet.load();
  assert.ok(Wallet.me.catalog.every(c => c.slot === c.item_id.split(':')[0]));
  await Wallet.buy('board:marble', 'coins'); await Wallet.buy('back:jade', 'coins');
  const rpc = (slot, item_id, target = '') => Account.rpc('sirsc_equip', { game: 'wcc', slot, item_id, target });
  let m = await rpc('board', 'board:marble'); assert.equal(m.equipped.board, 'board:marble');
  m = await rpc('back', 'back:jade'); assert.equal(m.equipped.board, 'board:marble');
  await assert.rejects(rpc('board', 'board:missing'), e => e.code === 'sirsc_unknown_item');
  await assert.rejects(rpc('board', 'board:ebony'), e => e.code === 'sirsc_not_owned');
  await assert.rejects(rpc('pieces', 'board:marble'), e => e.code === 'sirsc_wrong_slot');
  await assert.rejects(rpc('board', 'board:marble', 'other'), e => e.code === 'sirsc_not_owned');
  m = await rpc('board', null); assert.equal(m.equipped.board, undefined); assert.equal(m.equipped.back, 'back:jade');
  for (let i = 0; i < 23; i++) await rpc('board', null);
  await assert.rejects(rpc('board', null), e => e.code === 'rate_limited');
});


test('diamond request responses for DDR preserve the Chess wallet view', async () => {
  const s = server(), a = client(s); s.state('alice').equipped.board = 'board:marble'; await a.login();
  s.hold(() => ({ status: 200, data: { coins: 40000, owned: [], catalog: [], equipped: {}, requests: [{ id: 'request' }] } }));
  await a.Wallet.requestDiamonds(5, 'paid');
  assert.equal(a.Look.current().board, 'marble');
  assert.equal(a.Wallet.me.requests[0].id, 'request');
});
