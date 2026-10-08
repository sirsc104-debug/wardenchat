// HTML interface: the HUD, menus, building actions and battle overlays.
(function (G) {
  'use strict';
  const { D, U, Game, Sprites, Draw, Sound, Net } = G;
  const $ = (id) => document.getElementById(id);
  const fmt = U.fmt;

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
  }
  const ico = (kind, sm = true) => el('i', { class: 'ico ' + kind + (sm ? ' sm' : '') });
  const price = (res, amt) => el('span', { class: 'price' + (Game.get().res[res] < amt ? ' cant' : '') }, ico(res), fmt(amt));

  // Small canvas previews of buildings and troops.
  function buildingCanvas(type, level, w = 120, h = 96) {
    const c = el('canvas', { width: w * 2, height: h * 2, 'aria-hidden': 'true' });
    const ctx = c.getContext('2d');
    const sp = Sprites.sprite(type, Math.max(1, level), type === 'wall' ? 3 : 0.6);
    const scale = Math.min((w * 2 - 8) / sp.w, (h * 2 - 8) / (sp.h - 10));
    const dx = (w * 2 - sp.w * scale) / 2, dy = h * 2 - 4 - (sp.ay + sp.s * 32) * scale;
    ctx.drawImage(sp.img, dx, dy, sp.w * scale, sp.h * scale);
    return c;
  }
  function troopCanvas(type, level, w = 60, h = 56) {
    const c = el('canvas', { width: w * 2, height: h * 2, 'aria-hidden': 'true' });
    const ctx = c.getContext('2d');
    const T = D.T[type];
    // rough figure height at scale 1, so every troop fills its card
    const figH = { warElephant: 38, phoenix: 34, skyBarge: 32, priestess: 26, champion: 40, sobekBrute: 40, anubisWarrior: 40, camelArcher: 32, chariot: 27, falcon: 12, ramCrew: 18, shieldBearer: 32, mummy: 34 }[type] || 27;
    const figW = { warElephant: 50, phoenix: 50, skyBarge: 34, priestess: 34, chariot: 36, camelArcher: 26, falcon: 22, ramCrew: 24 }[type] || 20;
    const sc = Math.min((h * 2 * 0.82) / figH, (w * 2 * 0.85) / figW);
    const air = T && T.air;
    Draw.drawTroopFigure(ctx, type, w + (type === 'chariot' ? -6 * sc : 0), h * 2 - 6 + (air ? -6 * sc + figH * 0 : 0) + (type === 'falcon' ? -10 : 0), sc, 1, 0, false, level || 1, false);
    return c;
  }

  // ----------------------------------------------------------------- toast
  function toast(msg, kind) {
    const t = el('div', { class: 'toast' + (kind ? ' ' + kind : '') }, msg);
    $('toast').append(t);
    setTimeout(() => t.remove(), 2600);
    while ($('toast').children.length > 3) $('toast').firstChild.remove();
    if (kind === 'bad') Sound.play('error');
  }
  function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

  // ----------------------------------------------------------------- modal
  let modalClose = null;
  function modal(title, build, opts = {}) {
    closeModal();
    Sound.play('open');
    const body = el('div', { class: 'body' });
    const close = el('button', { class: 'close', 'aria-label': 'Close', onclick: () => closeModal() }, '✕');
    const box = el('div', { class: 'modal' + (opts.narrow ? ' narrow' : ''), role: 'dialog', 'aria-label': title },
      el('header', {}, el('h2', { text: title }), opts.noClose ? null : close));
    if (opts.tabs) box.append(opts.tabs);
    box.append(body);
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back && !opts.noClose) closeModal(); } }, box);
    $('modal-root').append(back);
    const refresh = () => { const top = body.scrollTop; body.replaceChildren(); build(body, refresh); body.scrollTop = top; };
    refresh();
    modalClose = () => { back.remove(); modalClose = null; if (opts.onClose) opts.onClose(); };
    UI.modalRefresh = opts.sig ? { refresh, sig: opts.sig, last: opts.sig() } : null;
    return { body, refresh, box };
  }
  function closeModal() { if (modalClose) modalClose(); UI.modalRefresh = null; }
  // Called twice a second: rebuild a live menu only when its contents changed,
  // and count down timers in place so buttons are never swapped mid-click.
  function liveTick() {
    const m = UI.modalRefresh;
    if (m) { const sig = m.sig(); if (sig !== m.last) { m.last = sig; m.refresh(); } }
    const now = Date.now();
    for (const e of document.querySelectorAll('[data-end]')) e.textContent = U.fmtTime((+e.dataset.end - now) / 1000) + (e.dataset.suffix || '');
  }
  const timer = (end, suffix) => el('span', { 'data-end': end, 'data-suffix': suffix || '' }, U.fmtTime((end - Date.now()) / 1000) + (suffix || ''));
  function modalOpen() { return !!modalClose; }

  // ------------------------------------------------------------------- HUD
  function hud() {
    const S = Game.get();
    if (!S) return;
    const ph = Game.ph();
    $('hud-ph').textContent = ph;
    $('hud-name').textContent = S.name;
    $('hud-trophies').textContent = fmt(S.trophies);
    $('hud-league').textContent = D.leagueOf(S.trophies);
    $('hud-builders-n').textContent = Game.freeBuilders() + '/' + Game.buildersTotal();
    for (const r of ['gold', 'goop']) {
      const cap = Game.capacity(r);
      $('hud-' + r).textContent = fmt(S.res[r]);
      $('cap-' + r).textContent = 'Max ' + fmt(cap);
      $('bar-' + r).style.width = (cap ? Math.min(100, 100 * S.res[r] / cap) : 0) + '%';
    }
    $('hud-gems').textContent = fmt(S.res.gems);
    const unseen = S.log.filter((e) => !e.seen).length;
    $('log-badge').hidden = !unseen; $('log-badge').textContent = unseen;
    const ready = Game.achievementState().filter((a) => a.ready).length;
    $('ach-badge').hidden = !ready; $('ach-badge').textContent = ready;
    goal();
  }

  function goal() {
    const S = Game.get(), g = $('goal');
    const has = (t) => Game.byType(t).length > 0;
    let text = null, sub = null;
    if (!has('goldMine')) { text = 'Build a Gold Mine'; sub = 'Open the Shop, then Resources.'; }
    else if (!has('goopWell')) { text = 'Build a Goop Well'; sub = 'Goop pays for troops.'; }
    else if (!has('ballista')) { text = 'Build a Ballista'; sub = 'Shop, then Defenses. Rivals will attack you!'; }
    else if (!has('barracks')) { text = 'Build a Barracks'; sub = 'Shop, then Army.'; }
    else if (!has('armyCamp')) { text = 'Build an Army Camp'; sub = 'Your troops wait there.'; }
    else if (!Object.keys(S.army).length && !S.queue.length && !S.stats.wins) { text = 'Train some troops'; sub = 'Tap Army.'; }
    else if (!S.stats.wins && !S.stats.losses) { text = 'Raid a rival town'; sub = 'Tap Attack! Win to earn gold, goop and gems.'; }
    else if (Game.ph() === 1) { text = 'Upgrade your Pyramid'; sub = 'It unlocks new buildings and troops.'; }
    g.hidden = !text || G.App.mode !== 'village';
    if (text) { g.replaceChildren(text, el('small', { text: sub })); }
  }

  // ------------------------------------------------------------- selection
  let selSig = '';
  function selection(target) {
    const box = $('sel'), acts = $('sel-actions');
    if (!target) { box.hidden = true; selSig = ''; return; }
    const S = Game.get();
    const o0 = target.obstacle || target;
    const sig = JSON.stringify([o0.id, o0.level, o0.upgrading && o0.upgrading.end, o0.clearing && o0.clearing.end, Math.floor(o0.stored || 0), S.res, Game.freeBuilders(), Game.ph(), Game.buildersTotal()]);
    if (sig === selSig && !box.hidden) return;
    selSig = sig;
    box.hidden = false;
    acts.replaceChildren();
    if (target.obstacle) {
      const o = target.obstacle;
      $('sel-name').textContent = { palm: 'Palm Trees', rock: 'Rocks', ruin: 'Old Ruins', bush: 'Dry Bush' }[o.type];
      $('sel-level').textContent = 'May hide gems';
      if (o.clearing) {
        acts.append(el('div', { class: 'act' }, ico('clock', false), timer(o.clearing.end)));
      } else {
        const [res, cost] = Game.obstacleCost(o);
        acts.append(el('button', { class: 'act up' + (S.res[res] < cost ? ' bad' : ''), onclick: () => G.App.clearObstacle(o) }, 'Remove', el('span', { class: 'cost' }, ico(res), fmt(cost))));
      }
      return;
    }
    const b = target;
    const def = D.B[b.type];
    $('sel-name').textContent = def.name;
    $('sel-level').textContent = b.level ? 'Level ' + b.level : 'Under construction';
    acts.append(el('button', { class: 'act', onclick: () => info(b) }, el('b', { style: 'font-size:20px' }, 'i'), 'Info'));
    if (def.produces && b.level) {
      const amt = Math.floor(b.stored || 0);
      acts.append(el('button', { class: 'act' + (amt < 1 ? ' bad' : ''), onclick: () => G.App.collect(b) }, ico(def.produces, false), 'Collect ' + fmt(amt)));
    }
    if (b.upgrading) {
      const left = (b.upgrading.end - Date.now()) / 1000;
      const g = Game.gemsToFinish(left);
      acts.append(el('button', { class: 'act gemb' + (S.res.gems < g ? ' bad' : ''), onclick: () => G.App.finishNow(b) }, 'Finish now', el('span', { class: 'cost' }, ico('gems'), g)));
      acts.append(el('button', { class: 'act', onclick: () => confirmBox('Cancel this upgrade?', 'You get half the cost back.', () => { Game.cancelUpgrade(b); G.App.select(null); hud(); }) }, '✕', 'Cancel'));
    } else {
      const to = b.level + 1;
      const max = b.type === 'pyramid' ? D.MAX_PH : D.maxLevel(b.type, Game.ph());
      if (to <= max) {
        const cost = D.upgradeCost(b.type, to);
        acts.append(el('button', { class: 'act up' + (S.res[def.costRes] < cost ? ' bad' : ''), onclick: () => upgradeBox(b) }, '▲ Upgrade', el('span', { class: 'cost' }, ico(def.costRes), fmt(cost))));
      } else if (b.type !== 'pyramid' && to <= 11) {
        acts.append(el('div', { class: 'act bad' }, '▲', `Pyramid ${D.pyramidFor(b.type, to)}`));
      }
    }
    if (b.type === 'barracks' || b.type === 'armyCamp') acts.append(el('button', { class: 'act', onclick: () => army() }, ico('troops', false), 'Train'));
    if (b.type === 'temple') acts.append(el('button', { class: 'act', onclick: () => temple() }, ico('clock', false), 'Research'));
    if (b.type === 'builderHut' && Game.buildersTotal() < 5) acts.append(el('button', { class: 'act gemb', onclick: () => builderBox() }, '+ Builder', el('span', { class: 'cost' }, ico('gems'), D.BUILDER_GEM_COST[Game.buildersTotal()])));
    acts.append(el('button', { class: 'act', onclick: () => G.App.startMove(b) }, '✥', 'Move'));
    if (def.isWall || def.isTrap) acts.append(el('button', { class: 'act', onclick: () => confirmBox('Remove this ' + def.name + '?', 'You will not get the cost back.', () => { Game.sell(b); G.App.select(null); G.App.layoutChanged(); }) }, '✕', 'Remove'));
  }

  function statRows(type, level, nextLevel) {
    const def = D.B[type];
    const rows = [];
    const add = (label, a, b) => rows.push([label, a, b]);
    if (def.hp) add('Hitpoints', D.buildingHp(type, level), nextLevel && D.buildingHp(type, nextLevel));
    if (def.isDefense || def.isTrap) {
      add(def.ramp ? 'Starting damage' : 'Damage per hit', Math.round(D.defenseDmg(type, level)), nextLevel && Math.round(D.defenseDmg(type, nextLevel)));
      if (def.range) add('Range', def.range + ' tiles');
      if (def.trigger) add('Trigger radius', def.trigger + ' tiles');
      add('Targets', def.ground && def.air ? 'Ground and air' : def.air ? 'Air only' : 'Ground only');
    }
    if (def.produces) {
      add('Makes per hour', D.rateOf(type, level), nextLevel && D.rateOf(type, nextLevel));
      add('Holds', D.mineCap(type, level), nextLevel && D.mineCap(type, nextLevel));
    }
    if (def.storage) add('Storage', D.storageOf(type, level), nextLevel && D.storageOf(type, nextLevel));
    if (def.housing) add('Troop space', def.housing[level - 1], nextLevel && def.housing[nextLevel - 1]);
    if (def.guards) add('Guard space', def.guards[level - 1], nextLevel && def.guards[nextLevel - 1]);
    if (type === 'barracks') { const un = D.TROOP_ORDER.filter((t) => D.T[t].barracks === (nextLevel || level)); if (un.length) add(nextLevel ? 'Unlocks' : 'Newest troop', un.map((t) => D.T[t].name).join(', ')); }
    if (type === 'temple') add('Max troop level', D.troopMaxLevel(level), nextLevel && D.troopMaxLevel(nextLevel));
    add('Material', D.MATERIALS[level].name, nextLevel && D.MATERIALS[nextLevel].name);
    return el('div', { class: 'stats' }, rows.map(([l, a, b]) => el('div', {}, el('span', { text: l }),
      el('b', {}, typeof a === 'number' ? fmt(a) : a, b != null && b !== a ? el('span', { class: 'up' }, ' → ' + (typeof b === 'number' ? fmt(b) : b)) : null))));
  }

  function info(b) {
    const def = D.B[b.type];
    modal(def.name, (body) => {
      body.append(el('div', { class: 'row' }, buildingCanvas(b.type, b.level || 1, 160, 130), el('div', { style: 'flex:1 1 240px;min-width:0' },
        el('p', { text: def.desc }), el('p', { class: 'muted', text: `Level ${b.level || 0} of ${b.type === 'pyramid' ? 11 : D.maxLevel(b.type, Game.ph())} at your Pyramid level.` }))));
      body.append(statRows(b.type, Math.max(1, b.level)));
      if (b.type === 'pyramid') body.append(pyramidUnlocks(b.level + 1));
    }, { narrow: true });
  }
  function pyramidUnlocks(ph) {
    if (ph > D.MAX_PH) return null;
    const newB = D.BUILDING_ORDER.filter((t) => D.B[t].unlock === ph && !D.B[t].noShop);
    const more = D.BUILDING_ORDER.filter((t) => D.B[t].unlock < ph && D.countAllowed(t, ph) > D.countAllowed(t, ph - 1));
    return el('div', {}, el('p', {}, el('b', { text: `Pyramid ${ph} unlocks: ` }),
      [...newB.map((t) => D.B[t].name), ...more.map((t) => `+${D.countAllowed(t, ph) - D.countAllowed(t, ph - 1)} ${D.B[t].name}`)].join(', ') || 'higher levels for everything'),
      el('p', { class: 'muted', text: 'Every building also gets a new level (and a new look) with each Pyramid level.' }));
  }

  function upgradeBox(b) {
    const def = D.B[b.type], to = b.level + 1;
    const cost = D.upgradeCost(b.type, to), time = D.upgradeTime(b.type, to);
    modal(`Upgrade to level ${to}`, (body) => {
      body.append(el('div', { class: 'row', style: 'justify-content:center' }, buildingCanvas(b.type, b.level, 140, 120), el('b', { style: 'font-size:28px' }, '→'), buildingCanvas(b.type, to, 140, 120)));
      body.append(statRows(b.type, b.level, to));
      if (b.type === 'pyramid') body.append(pyramidUnlocks(to));
      body.append(el('div', { class: 'row', style: 'justify-content:center;margin-top:8px' },
        el('span', { class: 'row' }, ico('clock', false), time ? U.fmtTime(time) : 'Instant'),
        el('button', { class: 'btn green', onclick: () => { closeModal(); G.App.upgrade(b); } }, 'Upgrade ', ico(def.costRes), fmt(cost))));
    }, { narrow: true });
  }

  function builderBox() {
    const n = Game.buildersTotal(), cost = D.BUILDER_GEM_COST[n];
    modal('Hire a builder', (body) => {
      body.append(el('p', { text: `You have ${n} builders. Hire builder number ${n + 1} for ${cost} gems. Win battles against rival players, clear obstacles and finish goals to earn gems.` }));
      body.append(el('button', { class: 'btn gem', onclick: () => { const r = Game.buyBuilder(); if (!r.ok) toast(r.why, 'bad'); else { toast('A new builder moved in!', 'good'); Sound.play('done'); closeModal(); G.App.focus(r.b); } hud(); } }, 'Hire for ', ico('gems'), cost));
    }, { narrow: true });
  }

  function confirmBox(title, text, yes) {
    modal(title, (body) => {
      body.append(el('p', { text }));
      body.append(el('div', { class: 'row' }, el('button', { class: 'btn red', onclick: () => { closeModal(); yes(); } }, 'Yes'), el('button', { class: 'btn', onclick: () => closeModal() }, 'No')));
    }, { narrow: true });
  }

  // ------------------------------------------------------------------- shop
  let shopTab = 'resource';
  function shop() {
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    const m = modal('Shop', (body, refresh) => {
      tabs.replaceChildren(...D.SHOP_CATS.map((c) => el('button', { class: 'tab' + (shopTab === c.id ? ' on' : ''), role: 'tab', 'aria-selected': String(shopTab === c.id), onclick: () => { shopTab = c.id; refresh(); } }, c.name)));
      const S = Game.get(), ph = Game.ph();
      const grid = el('div', { class: 'grid' });
      for (const id of D.BUILDING_ORDER) {
        const def = D.B[id];
        if (def.cat !== shopTab || def.noShop) continue;
        const have = Game.countOf(id), allowed = D.countAllowed(id, ph);
        const cost = D.upgradeCost(id, 1);
        const locked = allowed === 0, full = have >= allowed && !locked;
        const item = el('div', { class: 'item' + (locked || full ? ' locked' : '') },
          el('span', { class: 'count', text: `${have}/${allowed}` }),
          buildingCanvas(id, 1),
          el('span', { class: 'nm', text: def.name }),
          locked ? el('span', { class: 'lock', text: `Pyramid ${def.unlock}` }) : full ? el('span', { class: 'lock', text: ph < D.MAX_PH ? 'Upgrade Pyramid for more' : 'All built' }) : price(def.costRes, cost),
          el('span', { class: 'meta' }, ico('clock'), D.upgradeTime(id, 1) ? U.fmtTime(D.upgradeTime(id, 1)) : 'Instant'));
        if (!locked && !full) item.append(el('button', { class: 'item-hit', 'aria-label': 'Build ' + def.name, onclick: () => { closeModal(); G.App.startPlace(id); } }));
        grid.append(item);
      }
      body.append(grid);
    }, { tabs });
    return m;
  }

  // ------------------------------------------------------------------- army
  function army() {
    modal('Army', (body, refresh) => {
      const S = Game.get();
      const cap = Game.housingCap(), used = Game.housingUsed(), q = Game.queuedHousing();
      body.append(el('div', { class: 'army-top' },
        el('div', { class: 'capbar' }, el('span', { style: `width:${cap ? Math.min(100, 100 * used / cap) : 0}%` }), el('b', { text: `Army ${used}/${cap}` + (q ? ` (+${q} training)` : '') })),
        S.queue.length ? el('button', { class: 'btn gem small', onclick: () => { const r = Game.finishTraining(); if (!r.ok) toast(r.why, 'bad'); else Sound.play('done'); refresh(); hud(); } }, 'Finish ', ico('gems'), Game.gemsToFinish(Game.queueSeconds() * 4)) : null));
      if (!cap) body.append(el('p', { class: 'muted', text: 'Build an Army Camp to hold troops.' }));
      if (!Game.barracksLevel()) body.append(el('p', { class: 'muted', text: 'Build a Barracks to train troops.' }));
      // ready troops
      const ready = el('div', { class: 'queue', 'aria-label': 'Ready troops' });
      for (const t of D.TROOP_ORDER) if (S.army[t]) ready.append(el('div', { class: 'q', title: D.T[t].name }, troopCanvas(t, S.troopLevels[t], 48, 48), el('em', { text: '×' + S.army[t] })));
      if (!ready.children.length) ready.append(el('span', { class: 'muted', text: 'No troops ready yet.' }));
      body.append(el('b', { text: 'Ready to fight' }), ready);
      // training queue
      const queue = el('div', { class: 'queue' });
      S.queue.forEach((it, i) => {
        const prog = i === 0 && S.trainLeft ? 1 - S.trainLeft / D.T[it.type].train : 0;
        queue.append(el('div', { class: 'q', title: D.T[it.type].name }, troopCanvas(it.type, S.troopLevels[it.type], 48, 48), el('em', { text: '×' + it.n }),
          el('button', { class: 'x', 'aria-label': 'Remove one', onclick: () => { Game.untrain(it.type); refresh(); hud(); } }, '−'),
          i === 0 ? el('span', { class: 'prog' }, el('i', { style: `width:${prog * 100}%` })) : null));
      });
      if (S.queue.length) queue.append(el('span', { class: 'muted' }, 'Done in ', timer(Date.now() + Game.queueSeconds() * 1000)));
      else queue.append(el('span', { class: 'muted', text: 'Tap a troop below to train it.' }));
      body.append(el('b', { text: 'Training' }), queue);
      const grid = el('div', { class: 'grid' });
      for (const t of D.TROOP_ORDER) {
        const T = D.T[t], lv = S.troopLevels[t], unlocked = Game.troopUnlocked(t);
        const cost = D.troopCost(t, lv);
        const item = el('div', { class: 'item' + (unlocked ? '' : ' locked') },
          el('span', { class: 'lvl', text: 'Lv ' + lv }), el('span', { class: 'count', text: T.housing }),
          troopCanvas(t, lv, 100, 80), el('span', { class: 'nm', text: T.name }),
          unlocked ? price('goop', cost) : el('span', { class: 'lock', text: `Barracks ${T.barracks}` }),
          el('span', { class: 'meta' }, ico('clock'), U.fmtTime(T.train), ' · ', T.air ? 'Flies' : 'Ground'));
        if (unlocked) {
          item.append(el('button', { class: 'item-hit', 'aria-label': 'Train ' + T.name, onclick: () => { const r = Game.train(t, 1); if (!r.ok) toast(r.why, 'bad'); else Sound.play('tap'); refresh(); hud(); } }));
          item.append(el('span', { class: 'sub' },
            el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); let n = 0; for (let i = 0; i < 5; i++) if (Game.train(t, 1).ok) n++; if (!n) toast('Not enough room or goop.', 'bad'); refresh(); hud(); } }, '+5'),
            el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); troopInfo(t); } }, 'i')));
        }
        grid.append(item);
      }
      body.append(grid);
    }, { sig: () => { const S = Game.get(); return JSON.stringify([S.army, S.queue, S.res.goop, S.res.gems, Game.housingCap(), Game.barracksLevel()]); } });
  }

  function troopInfo(t) {
    const T = D.T[t], lv = Game.get().troopLevels[t];
    modal(T.name, (body) => {
      body.append(el('div', { class: 'row' }, troopCanvas(t, lv, 120, 110), el('p', { style: 'flex:1 1 220px', text: T.desc })));
      const row = (l, v) => el('div', {}, el('span', { text: l }), el('b', { text: v }));
      body.append(el('div', { class: 'stats' },
        row('Level', lv), row('Hitpoints', fmt(D.troopStat(t, lv, 'hp'))),
        T.heal ? row('Heals per second', fmt(D.troopStat(t, lv, 'heal'))) : row('Damage per hit', fmt(D.troopStat(t, lv, 'dmg'))),
        row('Housing', T.housing), row('Speed', T.speed >= 2.3 ? 'Very fast' : T.speed >= 1.6 ? 'Fast' : T.speed >= 1.2 ? 'Medium' : 'Slow'),
        row('Favourite target', { any: 'Anything', defense: 'Defenses', resource: 'Gold and goop', wall: 'Walls', heal: 'Heals troops' }[T.target]),
        row('Moves', T.air ? 'Flies' : T.jumpsWalls ? 'Jumps walls' : 'On foot')));
    }, { narrow: true });
  }

  // ---------------------------------------------------------------- temple
  function temple() {
    modal('Temple of Ra', (body, refresh) => {
      const S = Game.get(), tl = Game.templeLevel();
      if (!tl) { body.append(el('p', { text: 'Build a Temple of Ra (Pyramid 3) to research stronger troops.' })); return; }
      body.append(el('p', { text: `Temple level ${tl}: troops can be researched up to level ${D.troopMaxLevel(tl)}. Each level adds 15% hitpoints and damage, and gives the troop shinier armour.` }));
      if (S.research) {
        const r = S.research, left = (r.end - Date.now()) / 1000, g = Game.gemsToFinish(left);
        body.append(el('div', { class: 'entry' }, troopCanvas(r.type, r.to, 60, 56),
          el('div', { class: 'who' }, el('b', { text: `${D.T[r.type].name} → level ${r.to}` }), el('small', {}, timer(r.end, ' left'))),
          el('button', { class: 'btn gem small', onclick: () => { const x = Game.finishResearch(); if (!x.ok) toast(x.why, 'bad'); else Sound.play('done'); refresh(); hud(); } }, 'Finish ', ico('gems'), g)));
      }
      const grid = el('div', { class: 'grid', style: 'margin-top:12px' });
      for (const t of D.TROOP_ORDER) {
        const lv = S.troopLevels[t], to = lv + 1, unlocked = Game.troopUnlocked(t);
        const max = Game.troopMax(t);
        const can = unlocked && to <= max;
        const item = el('div', { class: 'item' + (can ? '' : ' locked') }, el('span', { class: 'lvl', text: 'Lv ' + lv }), troopCanvas(t, can ? to : lv, 100, 80), el('span', { class: 'nm', text: D.T[t].name }),
          !unlocked ? el('span', { class: 'lock', text: `Barracks ${D.T[t].barracks}` }) : lv >= 11 ? el('span', { class: 'lock', text: 'Max level' }) : to > max ? el('span', { class: 'lock', text: `Temple ${to - 1}` }) : price('goop', D.researchCost(t, to)),
          can ? el('span', { class: 'meta' }, ico('clock'), U.fmtTime(D.researchTime(t, to))) : null);
        if (can) item.append(el('button', { class: 'item-hit', 'aria-label': `Research ${D.T[t].name} level ${to}`, onclick: () => { const r = Game.startResearch(t); if (!r.ok) toast(r.why, 'bad'); else { toast(`The priests begin studying ${D.T[t].name} level ${to}.`, 'good'); Sound.play('build'); } refresh(); hud(); } }));
        grid.append(item);
      }
      body.append(grid);
    }, { sig: () => { const S = Game.get(); return JSON.stringify([S.research, S.troopLevels, S.res.goop, S.res.gems, Game.templeLevel()]); } });
  }

  // --------------------------------------------------------------- friends
  function friends() {
    modal('Friends', (body, refresh) => {
      const S = Game.get();
      body.append(el('p', { text: 'Share your town code with friends. They type it in to attack your town, and you can attack theirs. Friendly battles win gold and goop (no gems), and nobody loses anything.' }));
      const copy = el('button', { class: 'btn small', onclick: () => {
        const txt = S.code;
        const done = () => toast('Code copied', 'good');
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => toast('Select the code and copy it.'));
        else toast('Select the code and copy it.');
      } }, 'Copy');
      body.append(el('div', { class: 'row', style: 'margin-bottom:6px' }, el('b', { text: 'Your code' })));
      body.append(el('div', { class: 'row' }, el('span', { class: 'code', text: U.prettyCode(S.code) }), copy));
      body.append(el('p', { class: 'muted', style: 'margin-top:8px', text: Net.online
        ? (Net.readOnly ? 'You can attack friends, but your town can only be shared once the game owner gives you edit access.' : 'Your town is shared online. Friends who open this same game link can find it with your code.')
        : 'Friend codes work across devices when the game is opened from its shared Claude link. Here they only work for towns played in this browser.' }));
      const input = el('input', { type: 'text', class: 'code-in', id: 'friend-code', placeholder: 'ABCDE-12345', maxlength: '11', autocomplete: 'off', 'aria-label': 'Friend code' });
      const go = async () => {
        const code = U.normalizeCode(input.value);
        if (code === S.code) { toast("That's your own town!", 'bad'); return; }
        const r = await Net.find(code);
        if (r.error) { toast(r.error, 'bad'); return; }
        if (!S.friends.find((f) => f.code === code)) S.friends.unshift({ code, name: r.base.name });
        S.friends = S.friends.slice(0, 20); Game.save();
        closeModal();
        G.App.attackFriend(r.base);
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      body.append(el('div', { class: 'row', style: 'margin:16px 0 6px' }, el('b', { text: "Attack a friend's town" })));
      body.append(el('div', { class: 'row' }, input, el('button', { class: 'btn gold', onclick: go }, 'Attack')));
      if (S.friends.length) {
        body.append(el('div', { class: 'row', style: 'margin:16px 0 6px' }, el('b', { text: 'Recent friends' })));
        body.append(el('div', { class: 'list' }, S.friends.map((f) => el('div', { class: 'entry' },
          el('div', { class: 'who' }, el('b', { text: f.name }), el('small', { text: U.prettyCode(f.code) })),
          el('button', { class: 'btn small gold', onclick: async () => { const r = await Net.find(f.code); if (r.error) toast(r.error, 'bad'); else { closeModal(); G.App.attackFriend(r.base); } } }, 'Attack'),
          el('button', { class: 'btn small red', 'aria-label': 'Forget friend', onclick: () => { S.friends = S.friends.filter((x) => x !== f); Game.save(); refresh(); } }, '✕')))));
      }
    }, { narrow: true });
  }

  // -------------------------------------------------------------------- log
  function log() {
    const S = Game.get();
    modal('Raids on your town', (body) => {
      if (!S.log.length) { body.append(el('p', { text: 'No one has attacked you yet. Rival players raid every half hour or so, even while you are away.' })); return; }
      body.append(el('div', { class: 'list' }, S.log.map((e) => {
        const won = e.stars > 0;
        return el('div', { class: 'entry ' + (won ? 'lost' : 'won') },
          el('div', { class: 'who' }, el('b', { text: e.name }), el('small', { text: `${e.clan ? e.clan + ' · ' : ''}Pyramid ${e.ph} · ${ago(e.at)}` })),
          el('span', { class: 'mini-stars' }, [0, 1, 2].map((i) => el('i', { class: i < e.stars ? 'on' : '' }))),
          el('b', { text: e.destruction + '%' }),
          el('span', { class: 'row', style: 'gap:6px' }, won ? [el('span', { class: 'price cant' }, ico('gold'), '−' + fmt(e.lost.gold)), el('span', { class: 'price cant' }, ico('goop'), '−' + fmt(e.lost.goop))] : el('b', { style: 'color:#2f7f1e', text: 'Defended!' })),
          el('span', { class: 'row', style: 'gap:6px' },
            e.replay ? el('button', { class: 'btn small', onclick: () => { closeModal(); G.App.replay(e); } }, 'Replay') : null,
            !e.revenged ? el('button', { class: 'btn small gold', onclick: () => { closeModal(); G.App.revenge(e); } }, 'Revenge') : el('small', { class: 'muted', text: 'Avenged' })));
      })));
      for (const e of S.log) e.seen = true;
      Game.save(); hud();
    });
  }
  function ago(t) { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : U.fmtTime(s).split(' ')[0] + ' ago'; }

  // ---------------------------------------------------------- achievements
  function achievements() {
    modal('Goals', (body, refresh) => {
      body.append(el('p', { text: 'Finish goals to earn gems. Gems hire builders and speed things up.' }));
      body.append(el('div', { class: 'list' }, Game.achievementState().map((a) => el('div', { class: 'ach' },
        el('div', { class: 'who' }, el('b', { text: `${a.name} ${a.done ? '' : '(' + (a.tier + 1) + '/' + a.goals.length + ')'}` }),
          el('div', { class: 'muted', text: a.done ? 'Completed!' : a.desc.replace('{n}', fmt(a.goal)) }),
          a.done ? null : el('div', { class: 'pbar' }, el('i', { style: `width:${Math.min(100, 100 * a.have / a.goal)}%` }))),
        a.ready ? el('button', { class: 'btn gem small', onclick: () => { const g = Game.claim(a.id); toast(`+${g} gems!`, 'good'); Sound.play('coin'); refresh(); hud(); } }, 'Claim ', ico('gems'), a.gemsNow)
          : a.done ? null : el('span', { class: 'price' }, ico('gems'), a.gemsNow)))));
    }, { narrow: true });
  }

  // -------------------------------------------------------------- settings
  function settings() {
    modal('Options', (body, refresh) => {
      const S = Game.get();
      const name = el('input', { type: 'text', id: 'opt-name', value: S.name, maxlength: '24', 'aria-label': 'Town name' });
      body.append(el('div', { class: 'row', style: 'margin-bottom:12px' }, name, el('button', { class: 'btn small', onclick: () => { const v = name.value.trim(); if (v) { S.name = v.slice(0, 24); Game.save(); hud(); G.App.layoutChanged(); toast('Name saved', 'good'); } } }, 'Rename')));
      body.append(el('div', { class: 'row', style: 'margin-bottom:12px' },
        el('button', { class: 'btn small', onclick: () => { Sound.on = !Sound.on; S.sound = Sound.on; Game.save(); refresh(); } }, Sound.on ? 'Sound: on' : 'Sound: off'),
        el('button', { class: 'btn small', onclick: () => { closeModal(); G.App.renderer.fit(); } }, 'Zoom to fit')));
      body.append(el('p', { class: 'muted', text: `Town code ${U.prettyCode(S.code)} · Friends: ${Net.status}` }));
      body.append(el('p', { class: 'muted', text: 'Controls: drag to look around, scroll or pinch to zoom, tap a building to select it. In battle, pick a troop card and tap (or hold) on the sand to send troops in.' }));
      body.append(el('button', { class: 'btn red small', onclick: () => confirmBox('Start a new town?', 'This deletes your town, army and gems for good.', () => { Game.wipe(); location.reload(); }) }, 'Start over'));
    }, { narrow: true });
  }

  function welcome(done) {
    modal('Sands of the Pharaoh', (body) => {
      body.append(el('p', { text: 'Build your town around a great Pyramid on the banks of the Nile. Mine gold, pump goop, train an army and raid rival towns. Win battles to earn gems, hire more builders and raise your Pyramid all the way to level 11.' }));
      const name = el('input', { type: 'text', id: 'welcome-name', placeholder: 'Your name', maxlength: '24', 'aria-label': 'Your name' });
      const go = () => { closeModal(); done(name.value.trim()); };
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      body.append(el('div', { class: 'row' }, name, el('button', { class: 'btn gold', onclick: go }, 'Start building')));
    }, { narrow: true, noClose: true });
    setTimeout(() => { const n = $('welcome-name'); if (n) n.focus(); }, 50);
  }

  // ----------------------------------------------------------------- battle
  function battleHud(app) {
    const B = app.bt;
    if (!B) return;
    const b = B.battle;
    $('b-name').textContent = B.title;
    $('b-sub').textContent = B.sub;
    const remainGold = Math.max(0, B.info.loot.gold - b.stolen.gold), remainGoop = Math.max(0, B.info.loot.goop - b.stolen.goop);
    $('b-lgold').textContent = fmt(B.replay ? b.stolen.gold : remainGold);
    $('b-lgoop').textContent = fmt(B.replay ? b.stolen.goop : remainGoop);
    $('b-lgems-wrap').hidden = !B.info.loot.gems;
    $('b-lgems').textContent = B.info.loot.gems || 0;
    $('b-stolen').textContent = B.replay ? 'Stolen so far' : (b.stolen.gold || b.stolen.goop) ? `Grabbed ${fmt(b.stolen.gold)} gold, ${fmt(b.stolen.goop)} goop` : 'Available loot';
    const t = B.phase === 'scout' ? B.scoutLeft : G.BattleSim.BATTLE_TIME - b.time;
    const m = Math.floor(Math.max(0, t) / 60), s = Math.floor(Math.max(0, t) % 60);
    $('b-time').textContent = m + ':' + String(s).padStart(2, '0');
    $('b-phase').textContent = B.replay ? 'Replay' : B.phase === 'scout' ? 'Battle starts in' : 'Time left';
    $('b-pct').textContent = b.destruction + '%';
    const stars = $('b-stars').children;
    for (let i = 0; i < 3; i++) {
      const on = i < b.stars;
      if (on && !stars[i].classList.contains('on')) { stars[i].classList.add('on'); Sound.play('star'); }
      if (!on) stars[i].classList.remove('on');
    }
    $('b-next').hidden = !(B.phase === 'scout' && B.canNext);
    $('b-next-cost').textContent = fmt(D.NEXT_COST[Game.ph() - 1]);
    $('b-end').textContent = B.replay ? 'Back home' : B.phase === 'scout' ? 'Go home' : 'End battle';
    $('b-speed').hidden = !B.replay;
    $('b-speed').textContent = 'Speed ' + B.speed + '×';
  }

  function battleCards(app) {
    const B = app.bt, wrap = $('b-cards');
    wrap.replaceChildren();
    if (B.replay) return;
    const S = Game.get();
    const types = D.TROOP_ORDER.filter((t) => B.used[t] || B.left[t]);
    if (!types.length) wrap.append(el('div', { class: 'toast bad', text: 'You have no troops! Go home and train some in the Army menu.' }));
    for (const t of types) {
      const n = B.left[t] || 0;
      const card = el('button', { class: 'card' + (B.pick === t ? ' on' : '') + (n ? '' : ' empty'), 'aria-label': `${D.T[t].name}, ${n} left`, onclick: () => { if (n) { B.pick = t; Sound.play('tap'); battleCards(app); } } },
        el('b', { text: '×' + n }), troopCanvas(t, S.troopLevels[t]), el('span', { class: 'lv', text: 'Lv ' + S.troopLevels[t] }));
      wrap.append(card);
    }
  }

  function result(app, r, gained) {
    const B = app.bt;
    const won = r.stars > 0;
    Sound.play(won ? 'win' : 'lose');
    modal(B.replay ? 'Replay over' : won ? 'Victory!' : 'Defeat', (body) => {
      const box = el('div', { class: 'result' });
      box.append(el('div', { class: 'banner' },
        el('h2', { class: won ? '' : 'lose', text: B.replay ? (won ? `${B.title} won` : 'Your town held!') : won ? 'Victory!' : 'Defeat' }),
        el('div', { class: 'stars' }, [0, 1, 2].map((i) => el('i', { class: i < r.stars ? 'on' : '' }))),
        el('b', { style: 'color:#fff;font:400 22px var(--display)', text: r.destruction + '% destroyed' })));
      if (gained) {
        const g = el('div', { class: 'gains' });
        if (gained.gold) g.append(el('span', {}, ico('gold', false), '+' + fmt(gained.gold)));
        if (gained.goop) g.append(el('span', {}, ico('goop', false), '+' + fmt(gained.goop)));
        if (gained.gems) g.append(el('span', {}, ico('gems', false), '+' + gained.gems));
        if (gained.trophies) g.append(el('span', {}, ico('trophy', false), (gained.trophies > 0 ? '+' : '') + gained.trophies));
        if (!g.children.length) g.append(el('span', { text: 'No loot this time' }));
        box.append(g);
        if (B.info.friendly) box.append(el('p', { class: 'muted', text: won ? 'Friendly battle: gold and goop only, and your friend loses nothing.' : 'Friendly battle: no loot unless you win. Your friend loses nothing either way.' }));
        else if (won) box.append(el('p', { class: 'muted', text: 'You won the whole loot pile, plus gems for beating a rival.' }));
        else box.append(el('p', { class: 'muted', text: 'You keep what your troops grabbed. Win at least one star to take the full loot and gems.' }));
      }
      box.append(el('button', { class: 'btn gold', onclick: () => { closeModal(); app.goHome(); } }, 'Return home'));
      body.append(box);
    }, { narrow: true, noClose: true });
  }

  const UI = { el, toast, flash, modal, closeModal, modalOpen, hud, selection, info, shop, army, temple, friends, log, achievements, settings, welcome, battleHud, battleCards, result, buildingCanvas, troopCanvas, confirmBox, modalRefresh: null, liveTick };
  G.UI = UI;
})(globalThis.SOTP = globalThis.SOTP || {});
