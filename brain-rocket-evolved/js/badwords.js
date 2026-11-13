/* Brain Rocket — rude-word check. Type one of these as an answer and you crash (see game.js).
   Only checked after an answer is rejected, so real answers that contain a rude-looking word
   (Moby Dick, Blue Tit, Cock-a-Leekie…) still score normally.
   The lists are ROT13 so this file doesn't read like a wall of swearing. */
'use strict';

const BadWords = (function () {
  const rot = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
  const set = s => new Set(rot(s).split(' '));
  // Bad anywhere, even inside another word ("xfuckx").
  const STRONG = rot('shpx avttre avttn snttbg').split(' ');
  // Bad as a word anywhere in the answer.
  const WORDS = set('shx spx shpxre shpxref shpxvat shpxva zbgureshpxre zbgureshpxref shpxsnpr shpxjvg shpxurnq fuvg fuvgf fuvggl fuvgurnq fuvgubyr ohyyfuvg ubefrfuvg qvcfuvg ovgpu ovgpurf ovgpul fbabsnovgpu onfgneq onfgneqf nffubyr nffubyrf nefrubyr nefrubyrf nffung phag phagf gjng gjngf jnaxre jnaxref jnax jnaxvat gbffre oryyraq fyhg fyhgf fyhggl juber juberf fxnax qvpxurnq qvpxurnqf qvpxsnpr qbhpur qbhpuront wnpxnff qhzonff fznegnff sngnff onqnff cvff cvffrq cvffre obyybpxf ohttre ergneq ergneqf ergneqrq fcnm fcnfgvp puvax puvaxf xvxr xvxrf fcvp fcvpf jrgonpx jrgonpxf tbbx tbbxf genaal genaavrf ornare ornaref enturnq gbjryurnq fnaqavttre snt sntf phzfubg wvmm cbea cbeab qvyqb oybjwbo unaqwbo evzwbo obare');
  // Bad when that's (more or less) all you typed. These also turn up inside real answers.
  const ALONE = set('phz nff nffrf nefr qvpx qvpxf pbpx pbpxf cevpx cevpxf chffl chffvrf gvgf gvggvrf obbo obbof obbovrf xabo xabof pbba pbbaf abo ohggubyr');
  // Words that can sit around a rude word without making it okay ("you ass", "big fat dick").
  const FILLER = new Set('you u ya ur your youre yo my a an the big fat stupid dumb little lil is are am i im such ok okay lol haha what eat suck sucks my mine his her'.split(' '));

  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't' };
  // Number swaps only count in words with real letters in them, so "sh1t" is caught but "45s" isn't.
  const unleet = w => ((w.match(/[a-z]/g) || []).length >= 2 ? w.replace(/[!|](?![a-z])/g, '').replace(/[0134578@$!|+]/g, c => LEET[c]) : w);
  const clean = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/).map(unleet).join(' ').replace(/[^a-z*]+/g, ' ').trim();
  const squash = w => w.replace(/(.)\1+/g, '$1');
  const ALL = [...STRONG, ...WORDS, ...ALONE];

  // "fuuuuck", "shiiit": a run of three or more of a letter means someone is stretching a word.
  function same(w, list) {
    if (list.has(w)) return true;
    if (/(.)\1\1/.test(w)) { const s = squash(w); for (const x of list) if (squash(x) === s) return true; }
    return false;
  }
  // "f*ck", "sh*t": stars stand in for letters.
  function starred(w, list) {
    if (!w.includes('*') || w.replace(/\*/g, '').length < 2) return false;
    const re = new RegExp('^' + w.replace(/\*/g, '[a-z]') + '$');
    return list.some(x => re.test(x));
  }

  function test(input) {
    const text = clean(input);
    if (!text) return false;
    const joined = text.replace(/[^a-z]/g, '');
    if (STRONG.some(x => joined.includes(x))) return true;
    if (/(.)\1\1/.test(joined) && STRONG.some(x => squash(joined).includes(squash(x)))) return true;
    const words = text.split(' ').filter(Boolean);
    const wordList = [...WORDS];
    for (const w of words) {
      if (same(w, WORDS) || starred(w, wordList) || starred(w, STRONG)) return true;
    }
    // spelled out one letter at a time: "s h i t"
    if (words.length > 1 && words.every(w => w.length <= 2) && (same(joined, WORDS) || same(joined, ALONE))) return true;
    const core = words.filter(w => !FILLER.has(w));
    if (core.length && core.length <= 2 && core.every(w => same(w, ALONE) || same(w, WORDS) || starred(w, ALL))) return true;
    return false;
  }

  return { test };
})();
