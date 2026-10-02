'use strict';
/* Claude Code Clicker: the Token Exchange. Goods whose prices swing every minute; buy low, sell high.
   Prices are in dollars, and $1 is worth one second of your best-ever base production, so trading stays
   meaningful at every stage of the game. */

const GOODS = [
  { id: 'gpu', name: 'GPU Hours', fair: 60, vol: 0.06 },
  { id: 'api', name: 'API Credits', fair: 25, vol: 0.05 },
  { id: 'stars', name: 'GitHub Stars', fair: 15, vol: 0.08 },
  { id: 'ducks', name: 'Rubber Duck Futures', fair: 35, vol: 0.07 },
  { id: 'coffee', name: 'Coffee Beans', fair: 6, vol: 0.05 },
  { id: 'memes', name: 'Memes', fair: 9, vol: 0.14 },
];
const MARKET_TICK = 60; // seconds between price updates
const MODES = ['stable', 'rising', 'falling', 'volatile', 'boom', 'crash'];

const Market = {
  key: 'market',
  fresh() {
    const goods = {};
    for (const g of GOODS) {
      const p = +(g.fair * rand(0.7, 1.3)).toFixed(2);
      goods[g.id] = { p, hist: [p], held: 0, spent: 0, mode: 'stable', modeLeft: 8 };
    }
    const m = { goods, next: Date.now() + MARKET_TICK * 1000, rate: 1, profit: 0 };
    // Start with some history so the charts have something to show.
    const keep = typeof G !== 'undefined' && G.market;
    G.market = m;
    for (let k = 0; k < 24; k++) this.step();
    if (keep) G.market = keep;
    return m;
  },
  load(o) {
    const m = this.fresh();
    for (const g of GOODS) {
      const s = (o.goods || {})[g.id];
      if (!s) continue;
      const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
      Object.assign(m.goods[g.id], {
        p: Math.max(1, num(s.p) || g.fair), hist: (Array.isArray(s.hist) ? s.hist : []).filter(Number.isFinite).slice(-40),
        held: Math.max(0, Math.floor(num(s.held))), spent: Math.max(0, num(s.spent)),
        mode: MODES.includes(s.mode) ? s.mode : 'stable', modeLeft: num(s.modeLeft) || 5,
      });
      if (!m.goods[g.id].hist.length) m.goods[g.id].hist = [m.goods[g.id].p];
    }
    m.next = typeof o.next === 'number' ? o.next : m.next;
    m.rate = Math.max(1, +o.rate || 1);
    m.profit = +o.profit || 0;
    return m;
  },
  rate() { return Math.max(G.market.rate, D.tpsBase, 1); },
  maxHeld: () => 20 + 5 * G.owned[4],
  tick() {
    G.market.rate = Math.max(G.market.rate, D.tpsBase);
    let ticks = 0;
    while (Date.now() >= G.market.next && ticks < 60) { this.step(); G.market.next += MARKET_TICK * 1000; ticks++; }
    if (ticks >= 60) G.market.next = Date.now() + MARKET_TICK * 1000;
  },
  step() {
    for (const g of GOODS) {
      const s = G.market.goods[g.id];
      if (--s.modeLeft <= 0) {
        s.mode = pick(['stable', 'stable', 'rising', 'falling', 'volatile', 'volatile', 'boom', 'crash']);
        s.modeLeft = Math.floor(rand(4, 14));
      }
      const drift = { stable: 0, rising: 0.025, falling: -0.025, volatile: 0, boom: 0.07, crash: -0.08 }[s.mode];
      const vol = g.vol * (s.mode === 'volatile' ? 2.5 : 1);
      const pull = ((g.fair - s.p) / g.fair) * 0.04; // slowly drifts back toward a fair price
      s.p = Math.max(1, +(s.p * (1 + drift + pull + (Math.random() * 2 - 1) * vol)).toFixed(2));
      s.hist.push(s.p);
      if (s.hist.length > 40) s.hist.shift();
    }
  },
  buy(id, n) {
    const s = G.market.goods[id], room = this.maxHeld() - s.held;
    n = Math.min(n, room, Math.floor(G.tokens / (s.p * this.rate())));
    if (n <= 0) return 0;
    G.tokens -= n * s.p * this.rate();
    s.held += n;
    s.spent += n * s.p;
    return n;
  },
  sell(id, n) {
    const s = G.market.goods[id];
    n = Math.min(n, s.held);
    if (n <= 0) return 0;
    const avg = s.spent / s.held;
    G.tokens += n * s.p * this.rate();
    G.market.profit += n * (s.p - avg);
    s.spent -= n * avg;
    s.held -= n;
    return n;
  },
};
registerSystem(Market);

function sparkline(hist, w = 120, h = 30) {
  const lo = Math.min(...hist), hi = Math.max(...hist), span = hi - lo || 1;
  const pts = hist.map((v, k) => `${((k / Math.max(1, hist.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`).join(' ');
  const up = hist[hist.length - 1] >= hist[0];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${up ? 'var(--mint)' : 'var(--no)'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

const MarketUI = {
  id: 'market', name: 'Exchange', need: [4, 1],
  blurb: 'A stock market for developer goods. Prices swing every minute. Buy low, sell high.',
  render(body) {
    body.innerHTML =
      `<div class="tb-head"><h3 class="sec">Token Exchange</h3><span class="chip" id="mkClock"></span></div>` +
      `<p class="tb-note">Prices are in dollars, and $1 is worth one second of your best base production (now <b id="mkRate"></b> tokens). ` +
      `You can hold up to <b id="mkMax"></b> of each good; every CI Pipeline you own adds 5 more.</p>` +
      `<div class="mk-profit" id="mkProfit"></div><div class="mk-list" id="mkList"></div>`;
    body.querySelector('#mkList').innerHTML = GOODS.map(g => `<div class="mk-row tb-card" data-good="${g.id}">` +
      `<div class="mk-name"><b>${esc(g.name)}</b><span class="mk-mode chip"></span></div><div class="mk-chart"></div>` +
      `<div class="mk-price"><b class="mk-p"></b><span class="mk-chg"></span></div><div class="mk-held"></div>` +
      `<div class="mk-btns"><button type="button" class="btn tiny" data-buy="1">Buy 1</button><button type="button" class="btn tiny" data-buy="10">Buy 10</button><button type="button" class="btn tiny" data-buy="1e9">Buy max</button>` +
      `<button type="button" class="btn tiny" data-sell="1">Sell 1</button><button type="button" class="btn tiny" data-sell="10">Sell 10</button><button type="button" class="btn tiny" data-sell="1e9">Sell all</button></div></div>`).join('');
    body.querySelector('#mkList').addEventListener('click', e => {
      const b = e.target.closest('[data-buy],[data-sell]'), row = e.target.closest('[data-good]');
      if (!b || !row) return;
      const id = row.dataset.good;
      const n = b.dataset.buy ? Market.buy(id, +b.dataset.buy) : Market.sell(id, +b.dataset.sell);
      if (n) Sound.buy();
      this.update(body);
    });
  },
  update(body) {
    const rate = Market.rate();
    body.querySelector('#mkRate').textContent = fmt(rate);
    body.querySelector('#mkMax').textContent = Market.maxHeld();
    const pr = G.market.profit;
    body.querySelector('#mkProfit').innerHTML = `All-time trading profit: <b class="${pr >= 0 ? 'good' : 'bad'}">${pr >= 0 ? '+' : '−'}$${Math.abs(pr).toFixed(2)}</b> (about ${fmt(Math.abs(pr) * rate)} tokens at today's rate)`;
    for (const row of body.querySelectorAll('[data-good]')) {
      const s = G.market.goods[row.dataset.good], h = s.hist, prev = h.length > 1 ? h[h.length - 2] : s.p;
      const chg = ((s.p - prev) / prev) * 100;
      row.querySelector('.mk-p').textContent = `$${s.p.toFixed(2)}`;
      const ce = row.querySelector('.mk-chg');
      ce.textContent = `${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(1)}%`;
      ce.className = `mk-chg ${chg >= 0 ? 'good' : 'bad'}`;
      row.querySelector('.mk-mode').textContent = s.mode;
      const sig = h.join();
      const chart = row.querySelector('.mk-chart');
      if (chart.dataset.sig !== sig) { chart.dataset.sig = sig; chart.innerHTML = sparkline(h); }
      const avg = s.held ? s.spent / s.held : 0;
      row.querySelector('.mk-held').innerHTML = s.held
        ? `Holding <b>${s.held}</b> · avg $${avg.toFixed(2)} · <span class="${s.p >= avg ? 'good' : 'bad'}">${s.p >= avg ? '+' : '−'}$${Math.abs((s.p - avg) * s.held).toFixed(2)}</span>`
        : `Holding 0 · one costs ${fmt(s.p * rate)} tokens`;
      row.querySelectorAll('[data-buy]').forEach(b => { b.disabled = s.held >= Market.maxHeld() || G.tokens < s.p * rate; });
      row.querySelectorAll('[data-sell]').forEach(b => { b.disabled = !s.held; });
    }
  },
  fast(body) { body.querySelector('#mkClock').textContent = `Prices update in ${Math.max(0, Math.ceil((G.market.next - Date.now()) / 1000))}s`; },
};
Toolbox.add(MarketUI);
