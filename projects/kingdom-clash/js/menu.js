/* Kingdom Clash: the lobby. A top bar (name, level and experience, coins and diamonds, sound,
   settings), the tabs (Shop, Cards, Battle, Clan, Trophy Road) and a bottom navigation bar.

   All progress and its rules live in KCProgress (progress.js); this file only shows them.

   Battle tab: the arena centerpiece (img/training-grounds.webp, transparent) with its empty bar filled
   from progress: trainers beaten in the Training Grounds, trophies toward the next arena once the
   Trophy Road is open. Under it: the opponent (trophy battle or a trainer, picked from a panel), the
   Battle button and four chest slots. Cards tab: the deck (swap cards in), the collection with levels
   and copies, and a details window with Upgrade. Trophy Road tab: the road's rewards to claim. */
'use strict';

const KCMenu = (() => {
  const $ = q => document.querySelector(q), $$ = q => document.querySelectorAll(q);
  const G = KCProgress;
  const CENTERPIECE = 'img/training-grounds.webp';
  const TABS = ['shop', 'cards', 'battle', 'clan', 'road'];
  const imgs = {};
  let opts = {}, tabNow = 'battle', swapId = null, ticker = 0;
  const P = () => G.state;

  const cardImg = id => imgs[id] || (imgs[id] = KCArt.portrait(id, 200, 240).toDataURL());
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const recText = r => (r.w + r.l + r.d ? `${r.w}W · ${r.l}L${r.d ? ` · ${r.d}D` : ''}` : 'No matches yet');
  const dur = sec => (sec >= 3600 ? `${Math.round(sec / 3600)}h` : sec >= 60 ? `${Math.round(sec / 60)}m` : `${sec}s`);
  const clock = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };

  /* ---------- what the Battle button plays ---------- */
  function nextFoe(kind) {
    if ((kind || G.mode()) === 'trophy') return G.trophyFoe();
    return G.trainer();
  }
  // Called by the game when a match ends; returns what changed, for the result screen.
  function recordResult(foe, winner) {
    const r = foe.kind === 'trophy' ? G.recordTrophy(winner) : G.recordTrainer(foe.id, winner);
    return r;
  }

  /* ---------- small messages ---------- */
  let toastT = 0;
  function toast(text) {
    const t = $('#lobbyToast');
    t.textContent = text; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- tabs and popovers ---------- */
  function tab(name) {
    if (!TABS.includes(name)) return;
    tabNow = name;
    closePops();
    if (name !== 'cards') endSwap();
    for (const b of $$('.nb')) { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); }
    for (const s of $$('.lobby-main .tab')) s.hidden = s.id !== 'tab-' + name;
    if (name === 'road' && G.roadOpen() && !P().roadSeen) { P().roadSeen = true; G.save(); }
    refresh();
    if (name === 'road') requestAnimationFrame(scrollRoad);
  }
  function closePops() {
    $('#oppPanel').hidden = true; $('#oppChange').setAttribute('aria-expanded', 'false');
    $('#settings').hidden = true; $('#settingsBtn').setAttribute('aria-expanded', 'false');
  }
  function toggle(panel, btn) {
    const open = $(panel).hidden;
    closePops();
    $(panel).hidden = !open;
    $(btn).setAttribute('aria-expanded', String(open));
    return open;
  }

  /* ---------- chests ---------- */
  const CHEST_COL = { wooden: ['#b26b30', '#8a4f20', '#e3a14a'], silver: ['#9aa6b8', '#6f7b8e', '#e6ecf5'], gold: ['#f2b51f', '#c98806', '#fff0a0'] };
  function chestSvg(type) {
    const [a, b, trim] = CHEST_COL[type] || CHEST_COL.wooden;
    return `<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M6 22h52v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="${b}" stroke="#1c1530" stroke-width="3"/><path d="M6 22c0-11 8-18 26-18s26 7 26 18z" fill="${a}" stroke="#1c1530" stroke-width="3"/><path d="M6 22h52v6H6z" fill="${trim}" stroke="#1c1530" stroke-width="3"/><path d="M14 8v38M50 8v38" stroke="${trim}" stroke-width="3" opacity=".7"/><rect x="27" y="22" width="10" height="13" rx="2" fill="#ffcf3f" stroke="#1c1530" stroke-width="3"/></svg>`;
  }
  function renderChests() {
    const open = G.roadOpen(), now = Date.now();
    const busy = G.unlockingSlot(now) >= 0;
    $('#chests').innerHTML = P().chests.map((c, i) => {
      if (!open) return `<div class="slot locked" aria-label="Chest slot ${i + 1}: locked"><span class="slot-lock" aria-hidden="true"></span><small>Locked</small></div>`;
      const st = G.chestState(i, now);
      if (st === 'empty') return `<div class="slot empty" aria-label="Chest slot ${i + 1}: empty"><small>Empty</small></div>`;
      const C = G.CHESTS[c.type];
      const label = st === 'ready' ? 'Open!' : st === 'unlocking' ? clock(c.ends - now) : busy ? `${C.name.split(' ')[0]} · ${dur(C.seconds)}` : `Unlock ${dur(C.seconds)}`;
      const cls = st === 'ready' ? 'ready' : st === 'unlocking' ? 'unlocking' : 'chest';
      return `<button type="button" class="slot ${cls} ${c.type}" data-slot="${i}" aria-label="${C.name}: ${label}">${chestSvg(c.type)}<small>${label}</small></button>`;
    }).join('') + `<p class="chest-note">${open ? (P().chests.some(Boolean) ? 'One chest unlocks at a time. Skipping the wait with diamonds arrives with the SirSC wallet.' : 'Win trophy battles to earn chests') : 'Chests unlock with the Trophy Road'}</p>`;
    for (const b of $$('#chests button.slot')) b.addEventListener('click', () => chestClick(+b.dataset.slot));
  }
  function chestClick(i) {
    const st = G.chestState(i), c = P().chests[i];
    if (st === 'ready') { const got = G.openChest(i); if (got) showChest(got.chest, got); }
    else if (st === 'locked') {
      const r = G.startUnlock(i);
      if (r === 'busy') toast('Another chest is unlocking. One at a time!');
      else if (r === 'ok') { toast(`${G.CHESTS[c.type].name} is unlocking`); KCSound.play('select'); }
    } else if (st === 'unlocking') toast(`Opens in ${clock(c.ends - Date.now())}. Diamonds will be able to skip the wait once the wallet connects.`);
    refresh();
  }

  // The chest opening scene: the chest, then coins, then each card, then a summary.
  let co = null;
  function showChest(type, got) {
    const steps = [];
    if (got.coins) steps.push({ coins: got.coins });
    for (const c of got.cards) steps.push(c);
    co = { type, got, steps, i: -1 };
    $('#coTitle').textContent = type ? G.CHESTS[type].name : 'Reward';
    $('#coChest').innerHTML = type ? chestSvg(type) : '';
    $('#coChest').hidden = !type;
    $('#coChest').className = 'co-chest shake';
    $('#coReward').hidden = true; $('#coSummary').hidden = true; $('#coDone').hidden = true;
    $('#coHint').hidden = false; $('#coHint').textContent = type ? 'Click to open' : 'Click to continue';
    $('#chestOpen').hidden = false;
    if (!type) advance();
  }
  function advance() {
    if (!co) return;
    co.i++;
    if (co.i === 0 && co.type) { $('#coChest').className = 'co-chest burst'; KCSound.play('crown'); }
    if (co.i >= co.steps.length) return summary();
    const st = co.steps[co.i], box = $('#coReward');
    box.hidden = false;
    box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    if (st.coins) box.innerHTML = `<span class="co-coin" aria-hidden="true"></span><b>+${fmt(st.coins)}</b><small>Coins</small>`;
    else {
      const c = KC_CARDS[st.id], u = G.upgradeInfo(st.id);
      box.innerHTML = `<img src="${cardImg(st.id)}" alt=""><b>${esc(c.name)}</b><span class="co-n">×${st.n}</span>${st.isNew ? '<em>New card!</em>' : ''}
        <small>${u.max ? 'Max level' : `Level ${u.level} · ${u.count} / ${u.need}${u.count >= u.need ? ' · upgrade ready' : ''}`}</small>`;
    }
    KCSound.play('select');
    $('#coHint').textContent = co.i < co.steps.length - 1 ? `${co.steps.length - co.i - 1} more` : 'Click to finish';
  }
  function summary() {
    $('#coReward').hidden = true; $('#coChest').hidden = true; $('#coHint').hidden = true;
    const g = co.got;
    $('#coSummary').innerHTML = (g.coins ? `<div class="cs-item"><span class="co-coin" aria-hidden="true"></span><b>+${fmt(g.coins)}</b></div>` : '') +
      g.cards.map(c => `<div class="cs-item"><img src="${cardImg(c.id)}" alt="${esc(KC_CARDS[c.id].name)}"><b>×${c.n}</b>${c.isNew ? '<em>New</em>' : ''}</div>`).join('');
    $('#coSummary').hidden = false; $('#coDone').hidden = false; $('#coDone').focus();
    co.done = true;
  }
  function closeChest() { $('#chestOpen').hidden = true; co = null; refresh(); }

  /* ---------- the Trophy Road ---------- */
  function rewardHtml(m) {
    if (m.kind === 'coins') return `<span class="rw-coins"><span class="co-coin" aria-hidden="true"></span><b>${fmt(m.amount)}</b></span><small>Coins</small>`;
    if (m.kind === 'chest') return `<span class="rw-chest">${chestSvg(m.chest)}</span><small>${G.CHESTS[m.chest].name}</small>`;
    if (m.kind === 'card') return `<img class="rw-card" src="${cardImg(m.card)}" alt=""><small>${esc(KC_CARDS[m.card].name)} ×${m.copies}</small>`;
    const a = G.ARENAS.find(x => x.id === m.arena);
    return `<span class="rw-arena"><b>${a.number}</b></span><small>${a.soon ? `Arena ${a.number} · coming soon` : `Arena ${a.number}: ${esc(a.name)}`}</small>`;
  }
  function renderRoad() {
    const p = P(), road = G.ROAD;
    $('#rhTrophies').textContent = fmt(p.trophies);
    const a = G.arena();
    $('#rhArenaNo').textContent = `Arena ${a.number}`;
    $('#rhArena').textContent = a.name;
    $('#rhBest').textContent = `Best ${fmt(p.best)}`;
    const r = p.trophyRecord;
    $('#rhRecord').innerHTML = `<b>${r.w}</b><small>wins</small><b>${r.l}</b><small>losses</small>`;
    $('#roadTrack').innerHTML = road.map((m, i) => {
      const st = G.roadState(m), nextAt = road[i + 1] ? road[i + 1].at : m.at + 50;
      const fill = Math.max(0, Math.min(1, (p.trophies - m.at) / (nextAt - m.at)));
      return `<li class="rn ${st}" data-at="${m.at}">
        <div class="rn-card">${rewardHtml(m)}
          ${st === 'ready' ? `<button class="claim-btn" type="button" data-at="${m.at}">Claim</button>` : st === 'claimed' ? '<span class="rn-done" aria-label="Claimed"></span>' : st === 'soon' ? '<span class="rn-soon">Soon</span>' : '<span class="rn-lock" aria-label="Locked"></span>'}
        </div>
        <div class="rn-at"><i class="trophy-i" aria-hidden="true"></i>${m.at}</div>
        ${i < road.length - 1 ? `<div class="rn-line"><i style="width:${(fill * 100).toFixed(1)}%"></i></div>` : ''}
      </li>`;
    }).join('');
    for (const b of $$('#roadTrack .claim-btn')) b.addEventListener('click', () => claimAt(+b.dataset.at));
  }
  function scrollRoad() {
    const box = $('#roadScroll'), here = $('#roadTrack .rn.ready') || [...$$('#roadTrack .rn')].reverse().find(n => +n.dataset.at <= P().trophies);
    if (box && here) box.scrollLeft = Math.max(0, here.offsetLeft - box.clientWidth / 2 + here.clientWidth / 2);
  }
  function claimAt(at) {
    const got = G.claim(at);
    if (!got) return;
    KCSound.play('crown');
    if (got.kind === 'chest') showChest(got.chest, got);
    else if (got.kind === 'card') showChest(null, got);
    else if (got.kind === 'coins') toast(`+${fmt(got.coins)} coins`);
    refresh();
  }

  /* ---------- the Cards tab ---------- */
  function buildCards() {
    const p = P(), deck = p.deck;
    const avg = deck.reduce((a, id) => a + KC_CARDS[id].cost, 0) / deck.length;
    $('#avgCost').textContent = avg.toFixed(1);
    const lvlStrip = id => {
      const u = G.upgradeInfo(id);
      if (!u.found) return `<span class="lvl-strip locked">${G.unlockAt(id) !== null ? `Trophy Road · ${G.unlockAt(id)}` : 'Locked'}</span>`;
      if (u.max) return `<span class="lvl-strip max">Level ${u.level} · Max</span>`;
      const pct = Math.min(100, u.count / u.need * 100);
      return `<span class="lvl-strip"><span>Level ${u.level}</span><span class="cprog${u.count >= u.need ? ' full' : ''}"><i style="width:${pct.toFixed(0)}%"></i><em>${u.count}/${u.need}</em></span></span>`;
    };
    $('#deckRow').innerHTML = deck.map((id, i) => {
      const c = KC_CARDS[id], u = G.upgradeInfo(id);
      return `<button type="button" class="mini-card ${c.rarity}${u.can ? ' can-up' : ''}" data-id="${id}" data-slot="${i}" title="${esc(c.name)}"><img src="${cardImg(id)}" alt="${esc(c.name)}"><span class="cost">${c.cost}</span>${u.can ? '<span class="up-arrow" aria-label="Upgrade ready"></span>' : ''}${lvlStrip(id)}</button>`;
    }).join('');
    const found = p.found.length, all = KC_ALL_CARDS.length;
    $('#foundCount').textContent = `${found} / ${all} found`;
    $('#collGrid').innerHTML = KC_ALL_CARDS.map(id => {
      const c = KC_CARDS[id], u = G.upgradeInfo(id);
      return `<button type="button" class="coll-card ${c.rarity}${u.found ? '' : ' not-found'}${u.can ? ' can-up' : ''}" data-id="${id}">
        <span class="cc-art"><img src="${cardImg(id)}" alt=""><span class="cost">${c.cost}</span>${deck.includes(id) ? '<span class="in-deck" title="In your deck">In deck</span>' : ''}${u.can ? '<span class="up-arrow" aria-label="Upgrade ready"></span>' : ''}</span>
        <b>${esc(c.name)}</b><span class="rar">${c.rarity}</span>${lvlStrip(id)}</button>`;
    }).join('');
    for (const b of $$('#deckRow .mini-card')) b.addEventListener('click', () => (swapId ? doSwap(+b.dataset.slot) : openCard(b.dataset.id)));
    for (const b of $$('#collGrid .coll-card')) b.addEventListener('click', () => openCard(b.dataset.id));
  }
  function startSwap(id) {
    swapId = id;
    closeCard();
    $('#swapBar').hidden = false;
    $('#swapText').textContent = `Pick a card in your deck to swap out for ${KC_CARDS[id].name}`;
    $('#deckRow').classList.add('swapping');
  }
  function endSwap() { swapId = null; $('#swapBar').hidden = true; $('#deckRow').classList.remove('swapping'); }
  function doSwap(slot) {
    const id = swapId;
    endSwap();
    if (G.setDeck(slot, id)) { toast(`${KC_CARDS[id].name} is in your deck`); KCSound.play('select'); }
    refresh();
  }

  let lastFocus = null, modalId = null;
  function openCard(id) {
    const c = KC_CARDS[id];
    if (!$('#cardModal').hidden && modalId === id) return;
    lastFocus = lastFocus || document.activeElement;
    modalId = id;
    $('#mImg').src = cardImg(id);
    $('#mCost').textContent = c.cost;
    $('#mName').textContent = c.name;
    const u = G.upgradeInfo(id);
    $('#mTags').innerHTML = [`<span class="rar ${c.rarity}">${c.rarity}</span>`, `<span>${esc(c.role)}</span>`,
      `<span>${c.kind === 'spell' ? 'Spell' : c.kind === 'building' ? 'Building' : c.air ? 'Flying troop' : 'Troop'}</span>`].join('');
    $('#mBlurb').textContent = c.blurb;
    const lvl = u.found ? u.level : 1, m = KCSim.levelMult(lvl), v = x => Math.round(x * m);
    const tgt = { buildings: 'Towers & buildings', ground: 'Ground', both: 'Air & ground' }[c.targets];
    const sp = s => (s >= 1.8 ? 'Very fast' : s >= 1.4 ? 'Fast' : s >= 1 ? 'Medium' : 'Slow');
    const stats = c.kind === 'spell'
      ? [['Damage', v(c.dmg)], ['Tower damage', Math.round(v(c.dmg) * c.towerPct)], ['Radius', c.area + ' tiles'], ['Energy', c.cost]]
      : c.kind === 'building'
        ? [['Health', v(c.hp)], ['Damage', v(c.dmg)], ['Hit speed', c.hit + ' s'], ['Range', c.range + ' tiles'], ['Lifetime', c.lifetime + ' s'], ['Targets', tgt], ['Energy', c.cost]]
        : [['Health', v(c.hp)], ['Damage', v(c.dmg)], ['Hit speed', c.hit + ' s'], ['Range', c.range < 1 ? 'Melee' : c.range + ' tiles'],
          ['Speed', sp(c.speed)], ['Targets', tgt], ['Energy', c.cost]].concat(c.count > 1 ? [['Count', '×' + c.count]] : []);
    const next = u.found && !u.max ? KCSim.levelMult(lvl + 1) : null;
    $('#mStats').innerHTML = stats.map(([k, val]) => {
      const up = next && (k === 'Health' || k === 'Damage') ? `<em>+${Math.round((k === 'Health' ? c.hp : c.dmg) * next) - val}</em>` : '';
      return `<div><small>${k}</small><b>${val}${up}</b></div>`;
    }).join('');
    $('#mEvo').textContent = c.evo;
    // level, copies and the buttons
    $('#mLevel').textContent = u.found ? (u.max ? `Level ${u.level} · Max` : `Level ${u.level}`) : 'Not found yet';
    const pct = u.found && !u.max ? Math.min(100, u.count / u.need * 100) : u.max ? 100 : 0;
    $('#mProgFill').style.width = pct + '%';
    $('#mProgFill').parentElement.classList.toggle('full', !!u.can || (u.found && !u.max && u.count >= u.need));
    $('#mProgText').textContent = !u.found ? `Trophy Road · ${G.unlockAt(id)} trophies` : u.max ? 'Max level' : `${u.count} / ${u.need} cards`;
    const upBtn = $('#mUpgrade');
    upBtn.hidden = !u.found || u.max;
    upBtn.disabled = !u.can;
    $('#mUpCost').innerHTML = `<i class="coin-i" aria-hidden="true"></i>${fmt(u.cost || 0)}`;
    const inDeck = P().deck.includes(id);
    $('#mUse').hidden = !u.found || inDeck;
    $('#mNote').textContent = !u.found ? 'Reach it on the Trophy Road to add it to your collection.'
      : u.max ? '' : u.reason === 'copies' ? `Needs ${u.need - u.count} more card${u.need - u.count === 1 ? '' : 's'} from chests.`
        : u.reason === 'coins' ? `Needs ${fmt(u.cost - P().coins)} more coins.` : inDeck ? 'In your deck.' : '';
    $('#cardModal').hidden = false;
    (upBtn.hidden || upBtn.disabled ? $('#modalX') : upBtn).focus();
  }
  function closeCard() {
    if ($('#cardModal').hidden) return;
    $('#cardModal').hidden = true;
    modalId = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }
  function upgradeCard() {
    const id = modalId, r = G.upgrade(id);
    if (!r) return;
    KCSound.play('double');
    toast(`${KC_CARDS[id].name} reached level ${r.level}!${r.levelUp ? ` You are now level ${r.levelUp}.` : ''}`);
    const card = $('.modal-card');
    card.classList.remove('leveled'); void card.offsetWidth; card.classList.add('leveled');
    refresh();
    modalId = null; openCard(id);
  }

  /* ---------- the opponent ---------- */
  const BOT_LOOK_ID = 'bot';
  function renderOpp() {
    const p = P(), open = G.roadOpen(), mode = G.mode(), T = G.trainer(), next = G.nextTrainer();
    const pic = $('#oppPic');
    if (mode === 'trophy') {
      const a = G.arena();
      $('#oppLabel').textContent = 'Trophy Battle';
      $('#oppName').textContent = `${a.name}`;
      $('#oppMeta').textContent = `${fmt(p.trophies)} trophies · win +${G.TROPHIES.win} / loss −${G.TROPHIES.loss}`;
      if (pic.dataset.id !== BOT_LOOK_ID) { pic.dataset.id = BOT_LOOK_ID; KCArt.trainer(pic, G.trophyFoe(() => 0).look); }
      $('#battleSub').textContent = `Trophy battle · ${a.name}`;
    } else {
      $('#oppLabel').textContent = open ? 'Trainer rematch · starter deck · no trophies' : next && T.id === next.id ? 'Next Opponent' : 'Rematch';
      $('#oppName').textContent = T.name;
      $('#oppMeta').textContent = `Level ${T.level} · ${T.tier} · ${recText(p.records[T.id])}`;
      if (pic.dataset.id !== T.id) { pic.dataset.id = T.id; KCArt.trainer(pic, T.look); }
      $('#battleSub').textContent = `vs ${T.name}`;
    }
    const items = [];
    if (open) items.push(`<li><button type="button" class="opp-item${mode === 'trophy' ? ' on' : ''}" data-mode="trophy"><canvas width="88" height="88" data-look="${BOT_LOOK_ID}" aria-hidden="true"></canvas>
      <span class="oi-text"><b>Trophy Battle</b><small>${esc(G.arena().name)} · ${fmt(p.trophies)} trophies</small><small>${esc(recText(p.trophyRecord))}</small></span></button></li>`);
    items.push(...KC_TRAINERS.map(t => {
      const lock = !G.unlocked(t.id), st = lock ? 'Locked' : p.beaten[t.id] ? 'Beaten' : 'Not beaten yet';
      return `<li><button type="button" class="opp-item${mode === 'trainer' && t.id === T.id ? ' on' : ''}${lock ? ' locked' : ''}" data-id="${t.id}" ${lock ? 'aria-disabled="true"' : ''}>
        <canvas width="88" height="88" data-look="${t.id}" aria-hidden="true"></canvas>
        <span class="oi-text"><b>${esc(t.name)}</b><small>Level ${t.level} · ${esc(t.tier)} · ${st}</small><small>${lock ? esc(`Beat ${KC_TRAINERS[KC_TRAINERS.indexOf(t) - 1].name} to unlock`) : esc(recText(p.records[t.id]))}</small></span>
        ${p.beaten[t.id] ? '<span class="oi-check" aria-hidden="true"></span>' : lock ? '<span class="oi-lock" aria-hidden="true"></span>' : ''}</button></li>`;
    }));
    $('#oppList').innerHTML = items.join('');
    for (const cvs of $$('#oppList canvas')) {
      const id = cvs.dataset.look;
      KCArt.trainer(cvs, id === BOT_LOOK_ID ? G.trophyFoe(() => 0).look : KC_TRAINER[id].look, id !== BOT_LOOK_ID && !G.unlocked(id));
    }
    for (const b of $$('#oppList .opp-item')) b.addEventListener('click', () => {
      if (b.dataset.mode === 'trophy') G.setMode('trophy');
      else if (G.unlocked(b.dataset.id)) G.setMode('trainer', b.dataset.id);
      else return;
      closePops(); refresh();
    });
  }

  /* ---------- side plaques ---------- */
  function renderSides() {
    const p = P(), open = G.roadOpen(), next = G.nextTrainer();
    $('#passText').innerHTML = open ? '<span class="tag-lock">Soon</span> The Kingdom Pass arrives in a later update. Members will get the premium track.'
      : '<span class="tag-lock">Locked</span> Opens with the Trophy Road. Members get the premium track.';
    if (!open) {
      $('#leftTitle').textContent = 'Coming Up';
      const ups = [
        next ? [`Trainer ${next.short}`, 'Ready now'] : null,
        ...KC_TRAINERS.filter(t => !G.unlocked(t.id)).map(t => [t.name, `Beat ${KC_TRAINERS[KC_TRAINERS.indexOf(t) - 1].short}`]),
        ['Trophy Road', 'Beat all 3 trainers'], ['Arena 1: Cinder Keep', 'On the Trophy Road'], ['Chests & card levels', 'On the Trophy Road'],
      ].filter(Boolean);
      $('#unlocks').innerHTML = ups.map(([a, b]) => `<li><b>${esc(a)}</b><small>${esc(b)}</small></li>`).join('');
      $('#rightTitle').textContent = 'Training Rewards';
      $('#rightNote').textContent = 'First win against each trainer gives a 30 XP bonus.';
      $('#rewards').innerHTML = KC_TRAINERS.map((t, i) => {
        const prize = KC_TRAINERS[i + 1] ? `Unlocks ${KC_TRAINERS[i + 1].short}` : 'Opens the Trophy Road';
        return `<li class="${p.beaten[t.id] ? 'done' : G.unlocked(t.id) ? 'now' : 'later'}"><span class="rw-mark" aria-hidden="true"></span><span><b>Beat ${esc(t.short)}</b><small>${prize} · +30 XP</small></span></li>`;
      }).join('');
      return;
    }
    const a = G.arena();
    $('#leftTitle').textContent = `Arena ${a.number} Cards`;
    $('#unlocks').innerHTML = (a.cards || []).map(id => {
      const found = p.found.includes(id);
      return `<li class="card-li${found ? '' : ' dim-li'}"><img src="${cardImg(id)}" alt=""><span><b>${esc(KC_CARDS[id].name)}</b><small>${found ? `Found · level ${p.cards[id].level}` : `Trophy Road · ${G.unlockAt(id)} trophies`}</small></span></li>`;
    }).join('');
    $('#rightTitle').textContent = 'Next Rewards';
    const nxt = G.ROAD.filter(m => G.roadState(m) === 'ready' || G.roadState(m) === 'locked' || G.roadState(m) === 'soon').slice(0, 3);
    $('#rewards').innerHTML = nxt.map(m => {
      const st = G.roadState(m), what = m.kind === 'coins' ? `${fmt(m.amount)} coins` : m.kind === 'chest' ? G.CHESTS[m.chest].name : m.kind === 'card' ? `${KC_CARDS[m.card].name} ×${m.copies}` : `Arena ${G.ARENAS.find(x => x.id === m.arena).number}`;
      return `<li class="${st === 'ready' ? 'now' : 'later'}"><span class="rw-mark" aria-hidden="true"></span><span><b>${esc(what)}</b><small>${st === 'ready' ? 'Ready to claim' : st === 'soon' ? `${m.at} trophies · coming soon` : `At ${m.at} trophies`}</small></span></li>`;
    }).join('') || '<li class="done"><span class="rw-mark" aria-hidden="true"></span><span><b>All claimed</b><small>More arenas are on the way</small></span></li>';
    $('#rightNote').textContent = G.claimable().length ? 'Claim rewards on the Trophy Road tab.' : 'Win trophy battles to reach the next reward.';
  }

  /* ---------- keeping everything current ---------- */
  function refresh() {
    const p = P();
    if (!p) return;
    const total = KC_TRAINERS.length, n = G.beatenCount(), open = G.roadOpen();
    // top bar
    $('#playerName').textContent = p.name;
    const lv = G.level(), into = p.xp % G.XP_PER_LEVEL;
    $('#lvlNum').textContent = lv;
    $('#xpFill').style.width = (into / G.XP_PER_LEVEL * 100).toFixed(1) + '%';
    $('#xpText').textContent = `${into} / ${G.XP_PER_LEVEL}`;
    $('#coinVal').textContent = fmt(p.coins);
    $('#soundBtn').setAttribute('aria-label', KCSound.on ? 'Sound on' : 'Sound off');
    $('#soundBtn').classList.toggle('off', !KCSound.on);
    $('#soundToggle').checked = KCSound.on;
    $('.who-text small').textContent = open ? `Arena ${G.arena().number} · ${G.arena().name}` : 'Training Grounds';
    // centerpiece: trainers beaten, then trophies toward the next arena
    const cp = $('#cp'), bar = $('#cpBar');
    cp.classList.toggle('arena-cinder', open);
    $('#cpName').hidden = !open;
    if (open) {
      const a = G.arena(), na = G.nextArena(), lo = a.min, hi = na ? na.min : a.min + 300;
      $('#cpNameText').textContent = a.name;
      $('#cpImg').alt = `${a.name} arena`;
      $('#cpFill').style.width = (Math.max(0, Math.min(1, (p.trophies - lo) / (hi - lo))) * 100).toFixed(1) + '%';
      $('#cpText').textContent = `${fmt(p.trophies)} / ${fmt(hi)} Trophies`;
      bar.setAttribute('aria-label', 'Trophies toward the next arena');
      bar.setAttribute('aria-valuenow', String(p.trophies)); bar.setAttribute('aria-valuemax', String(hi));
      bar.classList.toggle('full', p.trophies >= hi);
    } else {
      $('#cpImg').alt = 'Training Grounds arena';
      $('#cpFill').style.width = (n / total * 100).toFixed(1) + '%';
      $('#cpText').textContent = `${n} / ${total} Trainers Defeated`;
      bar.setAttribute('aria-label', 'Trainers defeated');
      bar.setAttribute('aria-valuenow', String(n)); bar.setAttribute('aria-valuemax', String(total));
      bar.classList.remove('full');
    }
    $('#opp').classList.toggle('done', false);
    renderOpp();
    renderChests();
    renderSides();
    buildCards();
    // the nav tags
    const ups = G.upgradable().length, ct = $('#cardsTag');
    ct.hidden = !ups; ct.textContent = ups;
    const claims = G.claimable().length, tag = $('#roadTag');
    tag.textContent = !open ? 'Locked' : claims ? `${claims} reward${claims === 1 ? '' : 's'}` : (p.roadSeen ? 'Open' : 'New!');
    tag.className = 'nb-tag' + (!open ? ' lock' : claims || !p.roadSeen ? ' new' : ' open');
    // Trophy Road tab
    $('#roadView').hidden = !open;
    $('#roadLocked').hidden = open;
    if (open) renderRoad();
    else {
      const next = G.nextTrainer();
      $('#roadTitle').textContent = 'Trophy Road is locked';
      $('#roadText').textContent = `Beat all three Training Grounds trainers to open it.${next ? ` Next up: ${next.name}.` : ''}`;
      $('#roadList').innerHTML = KC_TRAINERS.map(t => `<li class="${p.beaten[t.id] ? 'done' : ''}"><span>${esc(t.name)}</span><b>${p.beaten[t.id] ? 'Beaten' : G.unlocked(t.id) ? 'Not yet' : 'Locked'}</b></li>`).join('');
    }
  }

  function init(o) {
    opts = o || {};
    G.load();
    $('#cpImg').src = CENTERPIECE;
    for (const b of $$('[data-tab]')) b.addEventListener('click', () => tab(b.dataset.tab));
    $('#battleBtn').addEventListener('click', () => opts.onBattle && opts.onBattle(nextFoe()));
    $('#oppChange').addEventListener('click', e => { e.stopPropagation(); toggle('#oppPanel', '#oppChange'); });
    $('#settingsBtn').addEventListener('click', e => {
      e.stopPropagation();
      if (toggle('#settings', '#settingsBtn')) $('#nameInput').value = P().name;
    });
    $('#whoBtn').addEventListener('click', e => {
      e.stopPropagation();
      if ($('#settings').hidden) toggle('#settings', '#settingsBtn');
      const i = $('#nameInput'); i.value = P().name; i.focus(); i.select();
    });
    for (const el of ['#settings', '#oppPanel']) $(el).addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => closePops());
    $('#soundBtn').addEventListener('click', () => { KCSound.on = !KCSound.on; refresh(); });
    $('#soundToggle').addEventListener('change', e => { KCSound.on = e.target.checked; refresh(); });
    $('#nameForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 16);
      if (v) { P().name = v; G.save(); }
      closePops(); refresh();
    });
    $('#modalX').addEventListener('click', closeCard);
    $('#cardModal').addEventListener('click', e => { if (e.target.id === 'cardModal') closeCard(); });
    $('#mUpgrade').addEventListener('click', upgradeCard);
    $('#mUse').addEventListener('click', () => startSwap(modalId));
    $('#swapCancel').addEventListener('click', endSwap);
    $('#chestOpen').addEventListener('click', e => { if (e.target.id !== 'coDone' && !(co && co.done)) advance(); });
    $('#coDone').addEventListener('click', closeChest);
    window.addEventListener('keydown', e => {
      if ($('#home').hidden || e.repeat) return;
      if (!$('#chestOpen').hidden) {
        if (e.key === 'Escape' || (co && co.done && e.key === 'Enter')) { if (co && !co.done) summary(); else closeChest(); e.preventDefault(); }
        else if (e.key === ' ' || e.key === 'Enter') { if (co && !co.done) advance(); e.preventDefault(); }
        return;
      }
      if (e.key === 'Escape') { closeCard(); closePops(); endSwap(); return; }
      if (!$('#cardModal').hidden || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
      const n = '12345'.indexOf(e.key);
      if (n >= 0) { tab(TABS[n]); e.preventDefault(); }
      else if (e.key === 'Enter' && tabNow === 'battle' && (document.activeElement === document.body || !document.activeElement)) { opts.onBattle && opts.onBattle(nextFoe()); e.preventDefault(); }
    });
    // chest timers tick while the lobby is showing
    clearInterval(ticker);
    ticker = setInterval(() => { if (!$('#home').hidden && G.roadOpen() && P().chests.some(Boolean)) { renderChests(); } }, 1000);
    refresh();
  }

  return {
    init, refresh, recordResult, nextFoe, cardImg, tab,
    get name() { return P() ? P().name : 'Player'; },
    show() { refresh(); },
  };
})();
