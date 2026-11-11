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
      // the Shop's emotes
      love: `<path class="em-heart" d="M40 52c-6-4-8-8-5-11s6 0 5 2c-1-2 2-5 5-2s1 7-5 11z" fill="#ff4d6d" stroke="${O}" stroke-width="2"/><path class="em-heart t2" d="M60 52c-6-4-8-8-5-11s6 0 5 2c-1-2 2-5 5-2s1 7-5 11z" fill="#ff4d6d" stroke="${O}" stroke-width="2"/>`,
      cool: `<g class="em-shades"><path d="M28 43h44l-2 9q-1 5-7 5h-6q-5 0-6-6h-2q-1 6-6 6h-6q-6 0-7-5z" fill="#1c1530"/><path d="M33 45l5 0M53 45l5 0" stroke="#7fd0ff" stroke-width="2.4" stroke-linecap="round"/></g>`,
      party: `<path d="M34 49q5-7 10 0M56 49q5-7 10 0" stroke="${O}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      dizzy: `<path class="em-spiral" d="M40 48m-5 0a5 5 0 1 0 5-5a3 3 0 1 0 3 3" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path class="em-spiral t2" d="M60 48m-5 0a5 5 0 1 0 5-5a3 3 0 1 0 3 3" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      nervous: `<circle cx="40" cy="48" r="4.6" fill="#fff" stroke="${O}" stroke-width="2.2"/><circle cx="60" cy="48" r="4.6" fill="#fff" stroke="${O}" stroke-width="2.2"/><circle cx="41" cy="49" r="2" fill="${O}"/><circle cx="61" cy="49" r="2" fill="${O}"/><path d="M33 39l10 3M67 39l-10 3" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>`,
      facepalm: `<path d="M56 49h10" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>`,
      kiss: `<path d="M34 49q5 4 10 0" stroke="${O}" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="60" cy="48" r="3.6" fill="${O}"/><path d="M55 40q6-4 11 1" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      wave: `<circle cx="40" cy="48" r="3.6" fill="${O}"/><circle cx="60" cy="48" r="3.6" fill="${O}"/><path d="M34 41q6-4 11 0M55 41q6-4 11 0" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      clap: `<path d="M34 49q5-7 10 0M56 49q5-7 10 0" stroke="${O}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      shush: `<circle cx="44" cy="48" r="3.4" fill="${O}"/><circle cx="64" cy="48" r="3.4" fill="${O}"/><path d="M36 42q6-3 11 0M57 42q6-3 11 0" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      popcorn: `<circle cx="40" cy="47" r="6" fill="#fff" stroke="${O}" stroke-width="2.4"/><circle cx="60" cy="47" r="6" fill="#fff" stroke="${O}" stroke-width="2.4"/><circle cx="40" cy="48" r="3" fill="${O}"/><circle cx="60" cy="48" r="3" fill="${O}"/>`,
      trophy: `<path d="M34 49q5-6 10 0M56 49q5-6 10 0" stroke="${O}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      mindblown: `<circle cx="40" cy="47" r="7" fill="#fff" stroke="${O}" stroke-width="2.6"/><circle cx="60" cy="47" r="7" fill="#fff" stroke="${O}" stroke-width="2.6"/><circle cx="40" cy="47" r="2.4" fill="${O}"/><circle cx="60" cy="47" r="2.4" fill="${O}"/>`,
      smug: `<path d="M34 48h10M56 48h10" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/><path d="M34 45q5-3 10 0M56 45q5-3 10 0" stroke="${O}" stroke-width="2" fill="none"/><path d="M55 38q6-5 12-1" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
      salute: `<circle cx="40" cy="48" r="3.4" fill="${O}"/><circle cx="60" cy="48" r="3.4" fill="${O}"/><path d="M33 42l11 2M67 42l-11 2" stroke="${O}" stroke-width="2.8" stroke-linecap="round"/>`,
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
      love: `<path d="M38 68Q50 84 62 68Q50 73 38 68Z" fill="#6b1a2a" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`,
      cool: `<path d="M42 71q8 3 15-2" stroke="${O}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
      party: `<path d="M38 67Q50 84 62 67Q50 72 38 67Z" fill="#6b1a2a" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><g class="em-horn"><path d="M58 72l20 6-2 6-20-4z" fill="#ff5a8a" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/><path d="M78 78l8-4 0 14-8-4z" fill="#ffe27a" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/></g>`,
      dizzy: `<path d="M40 74q5-5 10 0t10 0" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      nervous: `<rect x="38" y="69" width="24" height="8" rx="3" fill="#fff" stroke="${O}" stroke-width="2.4"/><path d="M44 69v8M50 69v8M56 69v8" stroke="${O}" stroke-width="1.3"/>`,
      facepalm: `<path d="M40 76q10-6 20 0" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      kiss: `<circle cx="51" cy="72" r="4.6" fill="#ff6f8a" stroke="${O}" stroke-width="2.4"/><path d="M49 72h4" stroke="${O}" stroke-width="1.6"/>`,
      wave: `<path d="M39 68Q50 82 61 68Q50 73 39 68Z" fill="#6b1a2a" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`,
      clap: `<path d="M38 67Q50 84 62 67Q50 72 38 67Z" fill="#6b1a2a" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`,
      shush: `<ellipse cx="50" cy="72" rx="4" ry="3" fill="#6b1a2a" stroke="${O}" stroke-width="2.2"/>`,
      popcorn: `<ellipse class="em-chew" cx="50" cy="72" rx="6" ry="5" fill="#6b1a2a" stroke="${O}" stroke-width="2.4"/>`,
      trophy: `<path d="M39 69Q50 80 61 69" stroke="${O}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
      mindblown: `<ellipse cx="50" cy="73" rx="6" ry="8" fill="#6b1a2a" stroke="${O}" stroke-width="2.6"/>`,
      smug: `<path d="M42 72q8 1 16-5" stroke="${O}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
      salute: `<path d="M41 70q9 5 18 0" stroke="${O}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
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
      love: `<path class="em-float" d="M84 30c-5-3-7-7-4-9s5 0 4 2c-1-2 2-4 4-2s1 6-4 9z" fill="#ff4d6d" stroke="${O}" stroke-width="1.8"/><path class="em-float t2" d="M14 34c-4-3-6-6-3-8s4 0 3 2c-1-2 2-4 4-2s1 5-4 8z" fill="#ff8fa8" stroke="${O}" stroke-width="1.6"/>`,
      cool: `<path class="em-spark" d="M80 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" stroke="${O}" stroke-width="1.4"/>`,
      party: `<g class="em-confetti"><rect x="12" y="20" width="5" height="8" fill="#ff5a8a" transform="rotate(20 14 24)"/><rect x="84" y="16" width="5" height="8" fill="#7fd0ff" transform="rotate(-25 86 20)"/><rect x="20" y="8" width="4" height="7" fill="#ffe27a"/><rect x="76" y="34" width="4" height="7" fill="#9be07a" transform="rotate(35 78 37)"/><circle cx="88" cy="44" r="2.6" fill="#c9a8ff"/><circle cx="10" cy="40" r="2.6" fill="#ffb347"/></g>`,
      dizzy: `<g class="em-stars"><path d="M30 8l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#ffe27a" stroke="${O}" stroke-width="1.4"/><path d="M68 6l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#ffe27a" stroke="${O}" stroke-width="1.4"/></g>`,
      nervous: `<path class="em-sweat" d="M76 36q-5 7 0 10q5-3 0-10z" fill="#8fd8ff" stroke="${O}" stroke-width="1.8"/>`,
      facepalm: `<g class="em-hand"><path d="M26 56q-2-14 8-16h12q6 0 6 6v6q0 6-6 6H34q-8 0-8-2z" fill="#f7c6a0" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="M34 40v16M40 40v16M46 41v15" stroke="${O}" stroke-width="1.6"/></g>`,
      kiss: `<path class="em-float" d="M80 58c-5-3-7-7-4-9s5 0 4 2c-1-2 2-4 4-2s1 6-4 9z" fill="#ff4d6d" stroke="${O}" stroke-width="1.8"/>`,
      wave: `<g class="em-wave"><g transform="translate(84 58) rotate(-15)"><rect x="-8" y="-9" width="16" height="18" rx="6" fill="#f7c6a0" stroke="${O}" stroke-width="2.4"/><path d="M-4 -9v-5q0-3 2-3t2 3v5M1 -9v-6q0-3 2-3t2 3v6" fill="#f7c6a0" stroke="${O}" stroke-width="2.2"/></g></g>`,
      clap: `<g class="em-clapl"><g transform="translate(70 80) rotate(35)"><rect x="-8" y="-9" width="16" height="18" rx="6" fill="#f7c6a0" stroke="${O}" stroke-width="2.4"/><path d="M-4 -9v-5q0-3 2-3t2 3v5M1 -9v-6q0-3 2-3t2 3v6" fill="#f7c6a0" stroke="${O}" stroke-width="2.2"/></g></g><g class="em-clapr"><g transform="translate(88 78) rotate(-35)"><rect x="-8" y="-9" width="16" height="18" rx="6" fill="#f7c6a0" stroke="${O}" stroke-width="2.4"/><path d="M-4 -9v-5q0-3 2-3t2 3v5M1 -9v-6q0-3 2-3t2 3v6" fill="#f7c6a0" stroke="${O}" stroke-width="2.2"/></g></g>`,
      shush: `<g class="em-hand"><rect x="46" y="62" width="7" height="22" rx="3.5" fill="#f7c6a0" stroke="${O}" stroke-width="2.4"/><rect x="40" y="76" width="18" height="14" rx="5" fill="#f7c6a0" stroke="${O}" stroke-width="2.4"/></g><text class="em-q" x="74" y="34" font-family="Lilita One, Arial Black, sans-serif" font-size="13" fill="#fff" stroke="${O}" stroke-width="3" paint-order="stroke">shh</text>`,
      popcorn: `<g class="em-bucket"><path d="M64 70h26l-4 26H68z" fill="#fff" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M70 70l2 26M78 70v26M86 70l-2 26" stroke="#ff4d5d" stroke-width="3"/><circle cx="68" cy="68" r="4" fill="#fff6c8" stroke="${O}" stroke-width="1.6"/><circle cx="76" cy="66" r="4.4" fill="#fff6c8" stroke="${O}" stroke-width="1.6"/><circle cx="85" cy="68" r="4" fill="#fff6c8" stroke="${O}" stroke-width="1.6"/></g><circle class="em-kernel" cx="78" cy="58" r="3" fill="#fff6c8" stroke="${O}" stroke-width="1.4"/>`,
      trophy: `<g class="em-cup"><path d="M70 50h18v8q0 9-9 9t-9-9z" fill="#ffcd33" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M70 53h-4q0 6 5 7M88 53h4q0 6-5 7" fill="none" stroke="${O}" stroke-width="2.2"/><rect x="76" y="66" width="6" height="7" fill="#e09f12" stroke="${O}" stroke-width="2"/><rect x="72" y="72" width="14" height="5" rx="1.5" fill="#ffcd33" stroke="${O}" stroke-width="2"/><rect x="72" y="76" width="14" height="10" rx="4" fill="#f7c6a0" stroke="${O}" stroke-width="2.2"/></g><path class="em-spark" d="M64 40l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#fff" stroke="${O}" stroke-width="1.4"/>`,
      mindblown: `<g class="em-boom"><circle cx="30" cy="10" r="7" fill="#ffd27a" stroke="${O}" stroke-width="2"/><circle cx="50" cy="4" r="8" fill="#fff3c4" stroke="${O}" stroke-width="2"/><circle cx="70" cy="10" r="7" fill="#ffd27a" stroke="${O}" stroke-width="2"/></g>`,
      smug: `<path class="em-spark" d="M82 50l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#fff" stroke="${O}" stroke-width="1.4"/>`,
      salute: `<g class="em-salute"><rect x="80" y="38" width="10" height="30" rx="5" fill="${tc}" stroke="${O}" stroke-width="2.4" transform="rotate(12 85 53)"/><path d="M76 26l10-4 3 8-11 4z" fill="#f7c6a0" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M78 24l-6 2" stroke="${O}" stroke-width="2" stroke-linecap="round"/></g>`,
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
      <g class="em-crown"><path d="M27 30L30 9 40 19 50 4 60 19 70 9 73 30Z" fill="#ffcd33" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="26" y="25" width="48" height="8" rx="3" fill="#e09f12" stroke="${O}" stroke-width="2.6"/>
      <circle cx="50" cy="29" r="3.6" fill="${tc}" stroke="${O}" stroke-width="1.8"/><circle cx="36" cy="29" r="2.2" fill="#fff6c8"/><circle cx="64" cy="29" r="2.2" fill="#fff6c8"/></g>
      ${extra}</g></svg>`;
  }
  const SHOP_FACES = KCProgress.EMOTES.map(e => e.id);
  for (const e of KCProgress.EMOTES) LABEL[e.id] = e.name;
  const isFace = id => FACES.includes(id) || SHOP_FACES.includes(id);
  // the faces this player can send: everyone's eight, then the ones bought in the Shop
  const myFaces = () => FACES.concat(SHOP_FACES.filter(id => KCProgress.state && KCProgress.state.emotes.includes(id)));

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
    panel.innerHTML = `<div class="ep-row ep-faces" id="epFaces"></div>
      <div class="ep-row ep-phrases">${Object.entries(PHRASES).map(([k, v]) => `<button type="button" class="ep-phrase" data-em="${k}">${v}</button>`).join('')}</div>`;
    box.appendChild(panel); box.appendChild(btn);
    for (const t of [0, 1]) {
      const b = document.createElement('div');
      b.className = `emote-bub ${t ? 'foe' : 'you'}`; b.id = 'emBub' + t; b.hidden = true;
      box.appendChild(b);
    }
    btn.addEventListener('click', () => toggle());
    panel.addEventListener('pointerdown', e => e.stopPropagation());
    for (const b of panel.querySelectorAll('.ep-phrase')) b.addEventListener('click', () => { if (send(0, b.dataset.em)) toggle(false); });
    renderFaces();
    panel.querySelector('#epFaces').addEventListener('click', e => {
      const f = e.target.closest('.ep-face'), nx = e.target.closest('.ep-next');
      if (f && send(0, f.dataset.em)) toggle(false);
      if (nx) { S.page = (S.page + 1) % pages(); renderFaces(); }
    });
    panel.addEventListener('click', e => { if (!e.target.closest('#epMute')) return;
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
  // Eight faces a page, after the mute button; an arrow turns the page when there are more (bought
  // in the Shop).
  const PER_PAGE = 8;
  const pages = () => Math.max(1, Math.ceil(myFaces().length / PER_PAGE));
  function renderFaces() {
    const list = myFaces(), n = pages();
    S.page = Math.min(S.page || 0, n - 1);
    const shown = list.slice(S.page * PER_PAGE, S.page * PER_PAGE + PER_PAGE);
    panel.querySelector('#epFaces').innerHTML = `<button type="button" class="ep-mute${S.muted ? ' on' : ''}" id="epMute" title="Mute the opponent's emotes" aria-pressed="${S.muted}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="5"/><path d="M10 10l20 20" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg></button>
      ${shown.map(f => `<button type="button" class="ep-face" data-em="${f}" title="${LABEL[f]}" aria-label="${LABEL[f]}">${face(f, 0)}</button>`).join('')}
      ${n > 1 ? `<button type="button" class="ep-next" title="More emotes" aria-label="More emotes (page ${S.page + 1} of ${n})"><span>&#9654;</span><small>${S.page + 1}/${n}</small></button>` : ''}`;
  }
  function toggle(on) {
    const open = on == null ? panel.hidden : on;
    if (open && !opts.canEmote()) return;
    panel.hidden = !open;
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) { renderFaces(); restLook(); }
  }
  // a new battle: clear everything
  function reset() {
    S.token++; S.sent = []; S.restUntil = 0; S.lastReply = 0; S.muted = false; S.page = 0;
    // the opponent has a few of the Shop's emotes too
    S.foeExtra = SHOP_FACES.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    for (const t of S.timers) clearTimeout(t); S.timers = [];
    if (!panel) return;
    toggle(false); hideBub(0); hideBub(1);
    renderFaces();
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
    foeSoon(pick(REPLY[id] || ['laugh', 'thumbs', 'cheeky', 'wow'].concat(foeHas(['cool', 'smug', 'kiss', 'wave']))), 900, 2200);
  }
  const foeHas = ids => ids.filter(id => (S.foeExtra || []).includes(id));
  // The opponent just took one of your towers.
  function foeTookTower() { if (Math.random() < CHANCE.tower) foeSoon(pick(['laugh', 'cheeky', 'thumbs', 'wow'].concat(foeHas(['party', 'cool', 'smug', 'popcorn', 'dizzy']))), 700, 1500); }
  // The opponent won.
  function foeWon() { if (Math.random() < CHANCE.win) foeSoon(pick(['laugh', 'thumbs', 'gg', 'cheeky'].concat(foeHas(['trophy', 'party', 'salute', 'clap', 'smug']))), 350, 900); }

  return { mount, reset, send, toggle, foeTookTower, foeWon, face, FACES, SHOP_FACES, LABEL, PHRASES, CHANCE, get muted() { return S.muted; } };
})();
