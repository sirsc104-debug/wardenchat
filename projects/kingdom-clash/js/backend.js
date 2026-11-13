/* Kingdom Clash: where the backend plugs in. The game runs on its own without it: progress is saved in
   this browser (localStorage), and the WardenChat account, cloud saves, friends, battles with friends and
   the SirSC wallet show as "coming soon". js/account.js connects all of them to Warden Chat's Supabase
   project (the contract is BACKEND_HANDOFF.md) with one call, once the backend answers:

     KCBackend.connect({
       status()            -> 'signedOut' | 'signedIn' | 'restricted'
       account()           -> { id, name } of the signed-in WardenChat user, or null
       restriction()       -> { status, reason, until } when an admin suspended or banned the account
       login(name, password, create) -> Promise (sign in, or create an account; rejects with { code })
       signOut()           -> Promise
       save(progress)      -> Promise (store this copy of the player's progress in their account)
       friends             -> the provider for KCNet.connectFriends (js/net.js), or null when signed out
       transport           -> a lobby for battles with friends (js/net.js: emit, on, presence, peers,
                              onPeers, join), or null when signed out
       wallet              -> the SirSC wallet, or null when signed out:
                                spend(kind, diamonds, ref) -> Promise of { me } (the server takes the diamonds)
                                exchange(coins)            -> Promise of { coins, rubies, me }
       ranked()            -> true when the server keeps the player's trophies (trophy battles are checked)
       battles             -> start() -> Promise of { battle_id, seed, bot_seed, foe, setup, trophies }
                              finish(battleId, plays, end, claimed) -> Promise of { trophies, ... }
       rules, chatUrl      -> Warden Chat's name and password rules, and its address
     })

   and then KCBackend.changed() whenever the account signs in or out (the lobby redraws), and
   KCBackend.restore(data) to load a progress object from the cloud into the game (checked and upgraded
   like any save, then shown). The game calls KCBackend.saved(progress) after every change (sent on to
   save() two seconds after the last one), and KCBackend.pay / KCBackend.exchange before anything that
   costs diamonds or coins. */
'use strict';

const KCBackend = (() => {
  let impl = null, timer = 0, pending = null;
  const listeners = [];
  function connect(x) {
    impl = x || null;
    changed();
  }
  // accounts are switched on (the backend answered), whether or not anyone is signed in
  const connected = () => !!impl;
  const status = () => (impl ? impl.status() : 'off');
  function account() { try { return impl && impl.account ? impl.account() : null; } catch (e) { return null; } }
  const restriction = () => (impl && impl.restriction ? impl.restriction() : null);
  async function login(name, password, create) {
    if (!impl) throw Object.assign(new Error('off'), { code: 'off' });
    await impl.login(name, password, !!create);
    changed();
  }
  async function signOut() { if (impl && impl.signOut) await impl.signOut(); changed(); }
  // the account signed in or out: battles with friends start over with the new account
  function changed() {
    if (typeof KCNet !== 'undefined') {
      KCNet.cancel().catch(() => {});
      KCNet.connectFriends(friends());
      KCNet.reinit();
    }
    for (const fn of listeners.slice()) try { fn(); } catch (e) { console.error(e); }
  }
  // every save of the game's progress: a copy goes to the account, two seconds after the last change
  function saved(progress) {
    if (!impl || !impl.save || !account()) return;
    pending = progress;
    clearTimeout(timer);
    timer = setTimeout(flush, 2000);
  }
  function flush() {
    clearTimeout(timer);
    if (!pending || !impl || !impl.save) return;
    const copy = JSON.parse(JSON.stringify(pending)); pending = null;
    Promise.resolve(impl.save(copy)).catch(e => console.error('cloud save', e));
  }
  // a save from the account: into this browser's storage, loaded (checked and upgraded), then shown
  function restore(data) {
    if (!data || typeof data !== 'object') return false;
    try { localStorage.setItem('kc.progress', JSON.stringify(data)); } catch (e) { return false; }
    pending = null; clearTimeout(timer);
    if (typeof KCProgress !== 'undefined') KCProgress.load();
    if (typeof KCMenu !== 'undefined' && KCMenu.refresh) KCMenu.refresh();
    return true;
  }
  const transport = () => (impl && account() && impl.transport) || null;
  const friends = () => (impl && account() && impl.friends) || null;
  const wallet = () => (impl && account() && impl.wallet) || null;
  /* Diamonds for something: with the SirSC wallet connected the server takes them first (kind: 'pass',
     'skip', 'offer', 'deal', 'magic', 'cards' or 'emote'); then the purchase itself runs here and takes
     them off the balance shown, which lands on what the server says is left. Without the wallet the
     diamonds are this device's, as before. Resolves to { ok } or { error }. */
  async function pay(kind, diamonds, ref) {
    const W = wallet();
    if (!W || !(diamonds > 0)) return { ok: true, local: !W };
    try {
      const r = await W.spend(kind, diamonds, ref || newRef());
      const P = KCProgress.state;
      P.diamonds = Math.max(0, (r && r.me ? r.me.diamonds | 0 : P.diamonds - diamonds)) + diamonds;
      return { ok: true };
    } catch (e) {
      return { error: e && e.code === 'kc_not_enough_diamonds' ? 'diamonds' : e && e.offline ? 'offline' : 'wallet', code: e && e.code };
    }
  }
  /* Coins to Rubies: with the wallet connected the server takes the coins (and checks the daily limit);
     the Rubies are then added here. Without it, the coins on this device, as before. */
  async function exchange(coins) {
    const W = wallet();
    if (!W) return KCProgress.exchange(coins);
    const n = Math.floor(+coins);
    const x = KCProgress.exchangeInfo();
    if (!Number.isFinite(n) || n <= 0) return { error: 'amount' };
    if (n > x.left) return { error: 'cap', left: x.left };
    if (n > x.coins) return { error: 'coins', have: x.coins };
    try {
      const r = await W.exchange(n);
      return KCProgress.exchangePaid(n, r.rubies, r.me ? r.me.coins | 0 : null);
    } catch (e) {
      return { error: e && e.code === 'kc_exchange_cap' ? 'cap' : e && e.code === 'kc_not_enough_coins' ? 'coins' : e && e.offline ? 'offline' : 'wallet', code: e && e.code };
    }
  }
  /* Trophy battles checked by the server. ranked(): signed in, and the server keeps the trophies. Then a
     trophy battle starts with battleStart (the server's opponent, seeds and the player's cards) and ends
     with battleFinish (the player's plays; the server replays the battle and says what the trophies are).
     battleStart resolves to { ok, foe } (the foe carries battleId, seed, botSeed and setup), { local }
     when the server can't check battles (play as before), or { error }. */
  const ranked = () => !!(impl && account() && impl.ranked && impl.battles && impl.ranked());
  async function battleStart() {
    const B = impl && account() && impl.battles;
    if (!B || !ranked()) return { local: true };
    try {
      const r = await B.start(KCProgress.RULES);
      if (!r || !r.foe || !r.setup) return { error: 'error' };
      return { ok: true, foe: Object.assign(r.foe, { battleId: r.battle_id, seed: r.seed >>> 0, botSeed: r.bot_seed >>> 0, setup: r.setup }) };
    } catch (e) {
      if (e && e.code === 'not_deployed') return { local: true };
      return { error: e && e.offline ? 'offline' : (e && e.code) || 'error' };
    }
  }
  async function battleFinish(battleId, plays, end, claimed) {
    const B = impl && impl.battles;
    if (!B) return { error: 'off' };
    try { const r = await B.finish(battleId, plays, end, claimed); return Object.assign({ ok: true }, r); }
    catch (e) { return { error: e && e.offline ? 'offline' : (e && e.code) || 'error' }; }
  }
  const newRef = () => 'kc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  return {
    connect, connected, status, account, restriction, login, signOut, changed, saved, flush, restore, transport, friends, wallet, pay, exchange,
    ranked, battleStart, battleFinish,
    get rules() { return (impl && impl.rules) || { nameMin: 3, nameMax: 24, nameRe: /^[a-zA-Z0-9_.-]+$/, passwordMin: 10 }; },
    get chatUrl() { return (impl && impl.chatUrl) || 'https://chat.sirsc104.com/'; },
    onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
  };
})();
