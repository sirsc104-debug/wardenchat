/* Brain Rocket – Evolved: the Daily Launch leaderboard. The server keeps every signed-in player's
 * first launch of each day (sent with bre_reward) and ranks them (bre_daily_board, docs/ECONOMY-BRE.md).
 * The board shows ranks, names, scores and each player's grid of tiers, never their answers, so
 * nothing is spoiled before midnight. Hidden until the server answers bre_ping, like the shop. */
'use strict';

const Board = (() => {
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const EPOCH = Date.UTC(2026, 10, 13);
  const today = () => (window.BREvolved ? BREvolved.dayNumber() : 1);
  const dateText = n => { const d = new Date(EPOCH + (n - 1) * 864e5); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); };
  const grid = tiers => (tiers || []).map(t => (t >= 0 ? Quiz.TIERS[t].emoji : Quiz.MISS.emoji)).join('');
  const medal = r => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r);
  let day = 1, scope = 'all', ask = 0, back = null;

  const available = () => Account.status !== 'unavailable' && Account.status !== 'checking';

  function open(d) {
    if (!available()) return;
    day = Math.max(1, Math.min(today(), d || today()));
    scope = 'all';
    back = document.activeElement;
    $('board').classList.remove('hidden');
    render();
    load();
    $('bdClose').focus({ preventScroll: true });
  }
  function close() {
    $('board').classList.add('hidden');
    if (back && back.focus) back.focus({ preventScroll: true });
  }

  function render() {
    $('bdDay').textContent = `#${day} · ${day === today() ? 'Today' : day === today() - 1 ? 'Yesterday' : dateText(day)}`;
    $('bdPrev').disabled = day <= 1;
    $('bdNext').disabled = day >= today();
    document.querySelectorAll('[data-bdscope]').forEach(b => b.classList.toggle('on', b.dataset.bdscope === scope));
  }

  function row(r, me) {
    return `<div class="bd-row${r.you ? ' you' : ''}">
      <span class="bd-rank">${medal(r.rank)}</span>
      <span class="bd-name">${esc(r.username)}${r.member ? SIRSC_BADGE_SVG : ''}${r.you ? '<i>you</i>' : ''}</span>
      <span class="bd-grid">${grid(r.tiers)}</span>
      <span class="bd-score">${fmt(r.score)}</span></div>`;
  }

  function load() {
    const at = ++ask, list = $('bdList');
    list.innerHTML = '<p class="bd-note">Loading the board…</p>';
    if (scope === 'friends' && Account.status !== 'signedIn') {
      list.innerHTML = '<p class="bd-note">Sign in to see how your friends did.</p><button type="button" class="go-btn small" data-shop="signin">Sign in</button>';
      $('bdFoot').textContent = '';
      return;
    }
    Wallet.board(day, scope).then(b => {
      if (at !== ask) return;
      const rows = (b && b.rows) || [];
      if (!rows.length) {
        list.innerHTML = `<p class="bd-note">${scope === 'friends' ? 'None of your friends has played this launch yet.' : day === today() ? 'Nobody has finished today’s launch yet. Be the first!' : 'Nobody played this launch.'}</p>`;
      } else {
        let html = rows.map(r => row(r)).join('');
        if (b.me && !rows.some(r => r.you)) html += `<div class="bd-gap">⋯</div>` + row({ ...b.me, you: true });
        list.innerHTML = html;
      }
      const n = b ? b.players || 0 : 0;
      const mine = b && b.me ? `You're #${fmt(b.me.rank)} of ${fmt(n)}. ` : '';
      const who = Account.status === 'signedIn' ? '' : 'Sign in with Warden Chat and finish the Daily Launch to be on the board. ';
      const count = !n ? '' : scope === 'friends' ? `${fmt(n)} of you and your friends played. ` : `${fmt(n)} players. `;
      $('bdFoot').textContent = `${mine}${count}${who}${day === today() ? 'Answers stay secret until midnight.' : ''}`;
    }, e => {
      if (at !== ask) return;
      list.innerHTML = `<p class="bd-note">${e && e.offline ? 'Can’t reach Warden Chat right now.' : 'The board didn’t load. Try again in a moment.'}</p>`;
      $('bdFoot').textContent = '';
    });
  }

  // the button on the home screen's Daily card and on the results, shown when accounts are on
  function paint() {
    document.querySelectorAll('[data-board]').forEach(el => el.classList.toggle('hidden', !available() || el.classList.contains('no-board')));
  }

  function init() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-board],[data-bdscope],#bdPrev,#bdNext,#bdClose');
      if (!t) { if (e.target.id === 'board') close(); return; }
      if (t.dataset.board !== undefined) { Sound.click(); open(+t.dataset.board || today()); return; }
      if (t.dataset.bdscope) { scope = t.dataset.bdscope; Sound.click(); render(); load(); return; }
      if (t.id === 'bdPrev' && day > 1) { day--; render(); load(); }
      if (t.id === 'bdNext' && day < today()) { day++; render(); load(); }
      if (t.id === 'bdClose') close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('board').classList.contains('hidden') && $('signin').classList.contains('hidden')) { close(); e.stopPropagation(); }
    }, true);
    Account.on(() => { paint(); if (!$('board').classList.contains('hidden')) load(); });
    paint();
  }
  return { init, open, paint, get day() { return day; } };
})();
