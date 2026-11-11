/* Kingdom Clash: emotes in battle.

   A speech-bubble button at the bottom left of the arena (or the E key) opens the emote panel over
   the bottom of the arena: eight picture emotes of the game's own King (laughing, crying, angry,
   thumbs up, amazed, yawning, cheeky, thinking), a mute button for the opponent's emotes, and six
   phrases. An emote shows as a bubble beside its player's King Tower, animated, with its own sound.

   Three emotes in a row and the panel rests for a few seconds, so nobody can spam. The opponent
   emotes back now and then, and about 40% of the time after taking one of your towers or winning.
   send(team, id) is the one way an emote goes up, for the player, the opponent, and later an online
   opponent. Nothing here is recorded. */
'use strict';

const KCEmotes = (() => {
  const O = '#1c1530';
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FACES = ['laugh', 'cry', 'angry', 'thumbs', 'wow', 'yawn', 'cheeky', 'think'];
  const LABEL = { laugh: 'Laughing King', cry: 'Crying King', angry: 'Angry King', thumbs: 'Thumbs up', wow: 'Amazed King', yawn: 'Yawning King', cheeky: 'Cheeky King', think: 'Thinking King' };
  const PHRASES = { luck: 'Good luck!', nice: 'Nice play!', whoa: 'Whoa!', thanks: 'Thanks!', gg: 'Good game!', oops: 'Oops!' };
  // What the opponent might send back to each emote
  const REPLY = {
    laugh: ['laugh', 'cheeky', 'angry'], cry: ['laugh', 'cheeky', 'thumbs'], angry: ['cheeky', 'laugh', 'think'], thumbs: ['thumbs', 'thanks'],
    wow: ['cheeky', 'thumbs', 'wow'], yawn: ['angry', 'yawn', 'wow'], cheeky: ['angry', 'cheeky', 'laugh'], think: ['think', 'yawn', 'cheeky'],
    luck: ['luck', 'thanks'], nice: ['thanks', 'thumbs'], whoa: ['cheeky', 'thanks'], thanks: ['thumbs', 'nice'], gg: ['gg', 'thumbs'], oops: ['laugh', 'cheeky'],
  };
  const CHANCE = { reply: 0.35, tower: 0.4, win: 0.4 };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- the King's faces, in SVG ---------- */
  const TEAMC = ['#2f6fe4', '#dc3640'];
  function face(expr, team) {
    const tc = TEAMC[team] || TEAMC[0];
    const eyes = {
      laugh: `<path d="M34 49q5-7 10 0M56 49q5-7 10 0" stroke="${O}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      cry: `<path d="M34 47q5 5 10 0M56 47q5 5 10 0" stroke="${O}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M33 40l10-4M67 40l-10-4" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`,
      angry: `<circle cx="40" cy="49" r="3.6" fill="${O}"/><circle cx="60" cy="49" r="3.6" fill="${O}"/><path d="M32 39l14 6M68 39l-14 6" stroke="${O}" stroke-width="4.4" stroke-linecap="round"/>`,
      thumbs: `<circle cx="40" cy="48" r="3.6" fill="${O}"/><circle cx="60" cy="48" r="3.6" fill="${O}"/><path d="M34 41q6-4 11 0M55 41q6-4 11 0" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
      wow: `<circle cx="40" cy="47" r="7" fill="#fff" stroke="${O}" stroke-width="2.6"/><circle cx="60" cy="47" r="7" fill="#fff" stroke="${O}" stroke-width="2.6"/><circle cx="40" cy="47" r="3" fill="${O}"/><circle cx="60" cy="47" r="3" fill="${O}"/><path d="M32 35q8-6 15-1M53 34q7-5 15 1" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
      yawn: `<path d="M34 49h10M56 49h10" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/><path d="M33 46q6-3 12 0M55 46q6-3 12 0" stroke="${O}" stroke-width="2" fill="none" opacity=".6"/>`,
      cheeky: `<path d="M34 49q5-6 10 0" stroke="${O}" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="60" cy="48" r="3.8" fill="${O}"/><path d="M55 40q6-4 11 1" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
      think: `<circle cx="38" cy="46" r="3.4" fill="${O}"/><circle cx="58" cy="46" r="3.4" fill="${O}"/><path d="M33 41l11-1M54 36q6-5 12 0" stroke="${O}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
    }[expr];
    const mouth = {
      laugh: `<path d="M36 67Q50 90 64 67Q50 72 36 67Z" fill="#6b1a2a" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="M43 78q7 6 14 0q-7-5-14 0z" fill="#ff7a8a"/>`,
      cry: `<path d="M38 79Q50 64 62 79Q50 75 38 79Z" fill="#6b1a2a" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`,
      angry: `<rect x="38" y="68" width="24" height="10" rx="2.5" fill="#fff" stroke="${O}" stroke-width="2.6"/><path d="M44 68v10M50 68v10M56 68v10M38 73h24" stroke="${O}" stroke-width="1.4"/>`,
      thumbs: `<path d="M39 69Q50 81 61 69" stroke="${O}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
      wow: `<ellipse cx="50" cy="73" rx="5.5" ry="7.5" fill="#6b1a2a" stroke="${O}" stroke-width="2.6"/>`,
      yawn: `<ellipse cx="50" cy="73" rx="8" ry="10" fill="#6b1a2a" stroke="${O}" stroke-width="2.6"/><ellipse cx="50" cy="78" rx="5" ry="3.4" fill="#ff7a8a"/>`,
      cheeky: `<path d="M41 70Q50 77 59 70" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/><path class="em-tongue" d="M47 72q0 11 6 11t5-11z" fill="#ff7a8a" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>`,
      think: `<path d="M44 72q5 2 12-1" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    }[expr];
    const extra = {
      laugh: `<path class="em-tear" d="M27 52q-4 6 0 8q4-2 0-8z" fill="#8fd8ff" stroke="${O}" stroke-width="1.6"/><path class="em-tear t2" d="M73 52q-4 6 0 8q4-2 0-8z" fill="#8fd8ff" stroke="${O}" stroke-width="1.6"/>`,
      cry: `<path class="em-stream" d="M37 52v34M63 52v34" stroke="#7fd0ff" stroke-width="5" stroke-linecap="round" stroke-dasharray="6 5"/><path class="em-drop" d="M30 58q-5 7 0 10q5-3 0-10z" fill="#8fd8ff" stroke="${O}" stroke-width="1.6"/><path class="em-drop t2" d="M70 58q-5 7 0 10q5-3 0-10z" fill="#8fd8ff" stroke="${O}" stroke-width="1.6"/>`,
      angry: `<circle cx="50" cy="52" r="28" fill="#ff3040" opacity=".28"/><g class="em-steam"><circle cx="14" cy="32" r="5" fill="#fff" stroke="${O}" stroke-width="2"/><circle cx="8" cy="24" r="3.4" fill="#fff" stroke="${O}" stroke-width="2"/></g><g class="em-steam t2"><circle cx="86" cy="32" r="5" fill="#fff" stroke="${O}" stroke-width="2"/><circle cx="92" cy="24" r="3.4" fill="#fff" stroke="${O}" stroke-width="2"/></g>`,
      thumbs: `<g class="em-hand"><rect x="66" y="70" width="20" height="18" rx="6" fill="#f7c6a0" stroke="${O}" stroke-width="2.6"/><path d="M70 71q-1-12 5-16q4 0 3 6l-1 10z" fill="#f7c6a0" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="M70 76h12M70 81h12" stroke="${O}" stroke-width="1.6"/><rect x="64" y="84" width="24" height="7" rx="2" fill="${tc}" stroke="${O}" stroke-width="2.2"/></g>`,
      wow: `<path class="em-spark" d="M15 30l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#ffe27a" stroke="${O}" stroke-width="1.6"/><path class="em-spark t2" d="M86 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffe27a" stroke="${O}" stroke-width="1.6"/>`,
      yawn: `<text class="em-z" x="78" y="30" font-family="Lilita One, Arial Black, sans-serif" font-size="16" fill="#fff" stroke="${O}" stroke-width="3" paint-order="stroke">z</text><text class="em-z t2" x="86" y="20" font-family="Lilita One, Arial Black, sans-serif" font-size="12" fill="#fff" stroke="${O}" stroke-width="3" paint-order="stroke">z</text>`,
      cheeky: '',
      think: `<g class="em-hand"><path d="M56 92q-2-10 6-12l6-1q4 0 4 4l-1 9z" fill="#f7c6a0" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="M60 81q-1-6 3-7q3 0 3 4v4" fill="#f7c6a0" stroke="${O}" stroke-width="2.4"/></g><text class="em-q" x="80" y="30" font-family="Lilita One, Arial Black, sans-serif" font-size="22" fill="#ffe27a" stroke="${O}" stroke-width="3.4" paint-order="stroke">?</text>`,
    }[expr];
    return `<svg class="em-face em-${expr}" viewBox="0 0 100 100" aria-hidden="true"><g class="em-body">
      <circle cx="22" cy="55" r="6.5" fill="#f7c6a0" stroke="${O}" stroke-width="2.6"/><circle cx="78" cy="55" r="6.5" fill="#f7c6a0" stroke="${O}" stroke-width="2.6"/>
      <circle cx="50" cy="53" r="29" fill="#f7c6a0" stroke="${O}" stroke-width="3.4"/>
      <ellipse cx="33" cy="60" rx="5" ry="3" fill="#ff9aa0" opacity=".55"/><ellipse cx="67" cy="60" rx="5" ry="3" fill="#ff9aa0" opacity=".55"/>
      <path d="M23 58Q25 94 50 96Q75 94 77 58Q72 76 62 78Q50 66 38 78Q28 76 23 58Z" fill="#f7f5f0" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      ${mouth}
      <path d="M50 66q-9-7-20-1q6 7 20 3zM50 66q9-7 20-1q-6 7-20 3z" fill="#f7f5f0" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <circle cx="50" cy="60" r="4.6" fill="#f0b18a" stroke="${O}" stroke-width="2"/>
      ${eyes}
      <path d="M27 30L30 9 40 19 50 4 60 19 70 9 73 30Z" fill="#ffcd33" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="26" y="25" width="48" height="8" rx="3" fill="#e09f12" stroke="${O}" stroke-width="2.6"/>
      <circle cx="50" cy="29" r="3.6" fill="${tc}" stroke="${O}" stroke-width="1.8"/><circle cx="36" cy="29" r="2.2" fill="#fff6c8"/><circle cx="64" cy="29" r="2.2" fill="#fff6c8"/>
      ${extra}</g></svg>`;
  }
  const isFace = id => FACES.includes(id);

  /* ---------- the panel, the button and the two bubbles ---------- */
  let box = null, opts = null, panel = null, btn = null;
  const S = { muted: false, sent: [], restUntil: 0, lastReply: 0, token: 0, timers: [], bubT: [0, 0] };
  function mount(arenaBox, o) {
    box = arenaBox; opts = o;
    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'emote-btn'; btn.id = 'emoteBtn';
    btn.title = 'Emotes (E)'; btn.setAttribute('aria-label', 'Emotes'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="eb-dots"><i></i><i></i><i></i></span><span class="eb-x">&#x2715;</span>';
    panel = document.createElement('div');
    panel.className = 'emote-panel'; panel.id = 'emotePanel'; panel.hidden = true;
    panel.innerHTML = `<div class="ep-row ep-faces">
        <button type="button" class="ep-mute" id="epMute" title="Mute the opponent's emotes" aria-pressed="false"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="5"/><path d="M10 10l20 20" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg></button>
        ${FACES.map(f => `<button type="button" class="ep-face" data-em="${f}" title="${LABEL[f]}">${face(f, 0)}</button>`).join('')}
      </div>
      <div class="ep-row ep-phrases">${Object.entries(PHRASES).map(([k, v]) => `<button type="button" class="ep-phrase" data-em="${k}">${v}</button>`).join('')}</div>`;
    box.appendChild(panel); box.appendChild(btn);
    for (const t of [0, 1]) {
      const b = document.createElement('div');
      b.className = `emote-bub ${t ? 'foe' : 'you'}`; b.id = 'emBub' + t; b.hidden = true;
      box.appendChild(b);
    }
    btn.addEventListener('click', () => toggle());
    panel.addEventListener('pointerdown', e => e.stopPropagation());
    for (const b of panel.querySelectorAll('[data-em]')) b.addEventListener('click', () => { if (send(0, b.dataset.em)) toggle(false); });
    panel.querySelector('#epMute').addEventListener('click', () => {
      S.muted = !S.muted;
      panel.querySelector('#epMute').setAttribute('aria-pressed', String(S.muted));
      panel.querySelector('#epMute').classList.toggle('on', S.muted);
      if (S.muted) hideBub(1);
      if (opts.toast) opts.toast(S.muted ? 'Opponent emotes muted' : 'Opponent emotes on');
    });
    window.addEventListener('keydown', e => {
      if (!box || box.closest('[hidden]') || e.repeat || !opts.canEmote()) return;
      if (e.key === 'e' || e.key === 'E') { toggle(); e.preventDefault(); }
      else if (e.key === 'Escape' && !panel.hidden) { toggle(false); e.stopImmediatePropagation(); }
    }, true);
  }
  function toggle(on) {
    const open = on == null ? panel.hidden : on;
    if (open && !opts.canEmote()) return;
    panel.hidden = !open;
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) restLook();
  }
  // a new battle: clear everything
  function reset() {
    S.token++; S.sent = []; S.restUntil = 0; S.lastReply = 0; S.muted = false;
    for (const t of S.timers) clearTimeout(t); S.timers = [];
    if (!panel) return;
    toggle(false); hideBub(0); hideBub(1);
    panel.querySelector('#epMute').classList.remove('on');
    panel.querySelector('#epMute').setAttribute('aria-pressed', 'false');
  }
  function later(fn, ms) { const tok = S.token; S.timers.push(setTimeout(() => { if (tok === S.token) fn(); }, ms)); }
  function restLook() {
    const resting = Date.now() < S.restUntil;
    panel.classList.toggle('resting', resting);
    if (resting) later(restLook, S.restUntil - Date.now() + 20);
  }

  // Sends an emote from a team (0 you, 1 the opponent). Returns false if it can't go yet.
  function send(team, id) {
    if (!(isFace(id) || PHRASES[id])) return false;
    if (team === 0) {
      const now = Date.now();
      if (now < S.restUntil) return false;
      S.sent = S.sent.filter(t => now - t < 6000).concat(now);
      if (S.sent.length >= 3) { S.restUntil = now + 3500; S.sent = []; }
      show(0, id);
      maybeReply(id);
      return true;
    }
    if (!S.muted) show(1, id);
    return true;
  }
  function show(team, id) {
    const b = document.getElementById('emBub' + team), p = opts.spot(team);
    b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
    b.className = `emote-bub ${team ? 'foe' : 'you'} ${isFace(id) ? 'is-face' : 'is-text'}`;
    b.innerHTML = isFace(id) ? face(id, team) : `<span>${PHRASES[id]}</span>`;
    b.setAttribute('aria-label', (team ? 'Opponent: ' : 'You: ') + (isFace(id) ? LABEL[id] : PHRASES[id]));
    b.hidden = false;
    // keep it inside the arena: a long phrase on a narrow screen moves left and drops its tail
    const room = box.clientWidth - 6 - b.offsetWidth;
    if (p.x > room) { b.style.left = Math.max(6, room) + 'px'; b.classList.add('no-tail'); }
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    KCSound.play(isFace(id) ? 'em_' + id : 'emPhrase');
    clearTimeout(S.bubT[team]);
    S.bubT[team] = setTimeout(() => hideBub(team), calm ? 2400 : 2700);
  }
  function hideBub(team) {
    const b = document.getElementById('emBub' + team);
    if (b) b.hidden = true;
  }

  /* ---------- the opponent ---------- */
  function foeSoon(id, lo, hi) { later(() => { if (opts.foeCanEmote()) send(1, id); }, lo + Math.random() * (hi - lo)); }
  function maybeReply(id) {
    const now = Date.now();
    if (now - S.lastReply < 3000 || !opts.foeCanEmote()) return;
    const chance = id === 'gg' && opts.ended() ? 0.6 : CHANCE.reply;
    if (Math.random() >= chance) return;
    S.lastReply = now;
    foeSoon(pick(REPLY[id]), 900, 2200);
  }
  // The opponent just took one of your towers.
  function foeTookTower() { if (Math.random() < CHANCE.tower) foeSoon(pick(['laugh', 'cheeky', 'thumbs', 'wow']), 700, 1500); }
  // The opponent won.
  function foeWon() { if (Math.random() < CHANCE.win) foeSoon(pick(['laugh', 'thumbs', 'gg', 'cheeky']), 350, 900); }

  return { mount, reset, send, toggle, foeTookTower, foeWon, face, FACES, PHRASES, CHANCE, get muted() { return S.muted; } };
})();
