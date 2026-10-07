/* Brain Rocket — Drill Challenge codes. An 8-character code holds everything a friend needs to
   get exactly the same questions in the same order: the difficulty, the drill time and a question
   seed, plus a check so a typo is caught instead of starting a different game.

   40 bits, written as 8 Crockford base-32 characters (no I, L, O or U, so nothing looks alike):
     difficulty 2 · time 2 · seed 31 · check 5 */
'use strict';

const Challenge = (function () {
  const ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const MODES = ['easy', 'medium', 'hard'];
  const LENS = [60, 30, 120];
  const SEEDS = 2 ** 31;

  // The check also covers the question bank, so a code made on an older or newer version of the
  // game (with different questions) is refused rather than quietly giving everyone different ones.
  const bank = () => Object.values(Quiz.TOPIC).reduce((s, t) => s + t.id + t.entities.length, '');
  function check(mode, len, seed) {
    let h = 2166136261;
    const s = `drill|${mode}|${len}|${seed}|${bank()}`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) % 32;
  }

  function encode({ mode, len = 60, seed }) {
    const m = MODES.indexOf(mode), l = LENS.indexOf(len);
    if (m < 0 || l < 0) throw new Error('bad challenge');
    seed = ((seed % SEEDS) + SEEDS) % SEEDS;
    let n = (m * 4 + l) * SEEDS + seed;
    n = n * 32 + check(m, l, seed);
    let out = '';
    for (let i = 0; i < 8; i++) { out = ABC[n % 32] + out; n = Math.floor(n / 32); }
    return out;
  }

  // Accepts lower case, spaces and dashes, and the letters people mix up (O for 0, I or L for 1).
  const tidy = s => String(s).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');

  /* Returns { type: 'drill', mode, len, seed, code } or { error }. */
  function decode(raw) {
    const s = tidy(raw);
    if (s.length !== 8) return { error: s.length < 8 ? 'Codes are 8 characters.' : 'That code is too long — codes are 8 characters.' };
    let n = 0;
    for (const c of s) n = n * 32 + ABC.indexOf(c);
    const chk = n % 32; n = Math.floor(n / 32);
    const seed = n % SEEDS; n = Math.floor(n / SEEDS);
    const l = n % 4, m = Math.floor(n / 4);
    if (!MODES[m] || !LENS[l] || check(m, l, seed) !== chk) {
      return { error: "That code doesn't work. Check for a typo — and make sure you're both on the same version of the game." };
    }
    return { type: 'drill', mode: MODES[m], len: LENS[l], seed, code: s };
  }

  const newSeed = () => Math.floor(Math.random() * SEEDS);

  // Same seed, same numbers, on every computer.
  function rng(seed) {
    let a = seed | 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { encode, decode, newSeed, rng, MODES };
})();
