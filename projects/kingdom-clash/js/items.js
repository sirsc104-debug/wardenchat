/* Kingdom Clash: magic item art, drawn in SVG. Every item is built from separate parts (a card's
   body, its star, its banner and corner gems; a book's covers, pages, spine, clasps and medallion; the
   hammer's handle, head, bands and the book set in its face). Each part is its own <g class="ip">
   carrying where it flies in from (--dx, --dy, --r) and its turn (--i), so when a chest gives an item
   the parts fly in from all sides and snap together (css/style.css, .forming). Anywhere else the
   parts just sit in place.

   The Hammer of Books has a living texture: its head shifts colour, arcane runes scroll across it, a
   sheen sweeps over it and the book in its face glows. These are SVG animations, so they run wherever
   the hammer is shown. Every item has a gentle sheen. With reduced motion, nothing moves. */
'use strict';

const KCItems = (() => {
  const O = '#1c1530';
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // light, mid, dark, gem
  const PAL = {
    common: ['#c9e8ff', '#5aa6ec', '#2a5ca8', '#8fdcff'],
    rare: ['#ffe6a8', '#ffa53a', '#c25a14', '#ffc65a'],
    epic: ['#f3d6ff', '#b56cf2', '#6326b0', '#ec9bff'],
    legendary: ['#b8fff2', '#ff8fe0', '#6a3cf0', '#8ff6e6'],
    any: ['#fff4b8', '#ffc93c', '#b8700c', '#fff0a0'],
  };
  let uid = 0;

  // A part: where it flies in from, picked round a circle so the pieces arrive from every side.
  function part(i, body, far) {
    const a = i * 2.39996 + 0.6, R = (far || 1) * (120 + (i % 3) * 22);
    const dx = Math.round(Math.cos(a) * R), dy = Math.round(Math.sin(a) * R), r = (i % 2 ? 1 : -1) * (140 + i * 23);
    return `<g class="ip" style="--i:${i};--dx:${dx}px;--dy:${dy}px;--r:${r}deg">${body}</g>`;
  }
  const anim = s => (calm ? '' : s);
  // a five-point star
  function star(cx, cy, R, r) {
    let d = '';
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r : R;
      d += (k ? 'L' : 'M') + (cx + Math.cos(a) * q).toFixed(1) + ' ' + (cy + Math.sin(a) * q).toFixed(1);
    }
    return d + 'Z';
  }
  // a four-point sparkle
  const twinkle = (x, y, s) => `M${x} ${y - s}Q${x + s * 0.2} ${y - s * 0.2} ${x + s} ${y}Q${x + s * 0.2} ${y + s * 0.2} ${x} ${y + s}Q${x - s * 0.2} ${y + s * 0.2} ${x - s} ${y}Q${x - s * 0.2} ${y - s * 0.2} ${x} ${y - s}Z`;
  // the gem on a book's medallion: a shape for each rarity
  function gem(rarity, cx, cy, s, fill) {
    const st = `fill="${fill}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"`;
    if (rarity === 'common') return `<circle cx="${cx}" cy="${cy}" r="${s * 0.85}" ${st}/><circle cx="${cx - s * 0.3}" cy="${cy - s * 0.3}" r="${s * 0.25}" fill="#fff" opacity=".8"/>`;
    if (rarity === 'rare') return `<path d="M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z" ${st}/><path d="M${cx} ${cy - s}L${cx + s * 0.35} ${cy}L${cx} ${cy + s}" fill="rgba(0,0,0,.18)"/><path d="M${cx - s * 0.45} ${cy - s * 0.1}l${s * 0.3} -${s * 0.3}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
    if (rarity === 'epic') {
      let d = '';
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; d += (k ? 'L' : 'M') + (cx + Math.cos(a) * s).toFixed(1) + ' ' + (cy + Math.sin(a) * s).toFixed(1); }
      return `<path d="${d}Z" ${st}/><path d="M${cx} ${cy - s}L${cx} ${cy + s}M${cx - s * 0.87} ${cy - s * 0.5}L${cx + s * 0.87} ${cy + s * 0.5}" stroke="rgba(255,255,255,.45)" stroke-width="1.4"/>`;
    }
    return `<path d="${star(cx, cy, s * 1.15, s * 0.5)}" ${st}/><circle cx="${cx}" cy="${cy}" r="${s * 0.25}" fill="#fff" opacity=".85"/>`;
  }
  // a gradient: legendary items get a rainbow, the rest light to dark
  function grad(id, rarity, dir) {
    const [l, m, d] = PAL[rarity] || PAL.any, xy = dir === 'v' ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="1"';
    if (rarity === 'legendary') return `<linearGradient id="${id}" ${xy}><stop offset="0" stop-color="#9ffff0"/><stop offset=".35" stop-color="#7fb8ff"/><stop offset=".65" stop-color="#d98cff"/><stop offset="1" stop-color="#ff7fc8"/></linearGradient>`;
    return `<linearGradient id="${id}" ${xy}><stop offset="0" stop-color="${l}"/><stop offset=".45" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></linearGradient>`;
  }
  // a white band that sweeps across a shape now and then
  const sheenGrad = (id, dur, delay) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.4">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset=".58" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    ${anim(`<animateTransform attributeName="gradientTransform" type="translate" values="-1.2 0;-1.2 0;1.2 0" keyTimes="0;${(delay).toFixed(2)};1" dur="${dur}s" repeatCount="indefinite"/>`)}</linearGradient>`;
  const GOLD = u => `<linearGradient id="au${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".5" stop-color="#ffc93c"/><stop offset="1" stop-color="#c47a10"/></linearGradient>`;

  /* ---------- wild cards ---------- */
  function wild(rarity, u) {
    const p = PAL[rarity], card = 'M28 10h40a8 8 0 0 1 8 8v62a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8V18a8 8 0 0 1 8-8z';
    const defs = `${grad('b' + u, rarity)}${GOLD(u)}${sheenGrad('sh' + u, 3.6, 0.55)}
      <radialGradient id="w${u}" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".5" stop-color="${p[3]}" stop-opacity=".45"/><stop offset="1" stop-color="${p[2]}" stop-opacity="0"/></radialGradient>
      <clipPath id="c${u}"><path d="${card}"/></clipPath>`;
    const corner = (i, x, y) => part(i, `<path d="M${x} ${y - 4.5}l4.5 4.5-4.5 4.5-4.5-4.5z" fill="url(#au${u})" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>`, 0.8);
    return `<defs>${defs}</defs>
      ${part(0, `<path d="M34 14h38a8 8 0 0 1 8 8v60a8 8 0 0 1-8 8H34z" transform="rotate(9 56 52)" fill="${p[2]}" stroke="${O}" stroke-width="3" opacity=".85"/>`)}
      ${part(1, `<path d="${card}" fill="url(#b${u})" stroke="${O}" stroke-width="3.4"/><path d="M28 14h40a4 4 0 0 1 4 4v62a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.8"/>`)}
      ${part(2, `<rect x="28" y="19" width="40" height="46" rx="6" fill="rgba(16,8,44,.5)" stroke="${O}" stroke-width="2"/><rect x="28" y="19" width="40" height="46" rx="6" fill="url(#w${u})"/>`)}
      ${part(3, `<path d="${star(48, 41, 16, 7)}" fill="#fffbe8" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="${star(48, 41, 9, 4)}" fill="${p[3]}" opacity=".55"/><path d="M42 33l3-3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`)}
      ${part(4, `<path d="${twinkle(35, 27, 4.5)}" fill="#fff"/><path d="${twinkle(62, 56, 3.5)}" fill="#fff"/><path d="${twinkle(63, 26, 2.6)}" fill="#fff" opacity=".8"/>`)}
      ${part(5, `<path d="M12 68h72l-5 7 5 7H12l5-7z" fill="url(#au${u})" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><path d="M20 70h56" stroke="#fff6c8" stroke-width="1.6" opacity=".8"/>
        <text x="48" y="79.4" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="11" letter-spacing=".5" fill="#fff" stroke="${O}" stroke-width="2.6" paint-order="stroke">WILD</text>`)}
      ${corner(6, 28, 18)}${corner(7, 68, 18)}${corner(8, 28, 84.5)}${corner(9, 68, 84.5)}
      <path d="${card}" fill="url(#sh${u})" clip-path="url(#c${u})" pointer-events="none"/>`;
  }

  /* ---------- books ---------- */
  function book(rarity, u, ofBooks) {
    const p = PAL[rarity] || PAL.any, cover = 'M24 10h40a6 6 0 0 1 6 6v62a6 6 0 0 1-6 6H24z';
    const coverFill = ofBooks ? `url(#rb${u})` : `url(#b${u})`;
    const defs = `${grad('b' + u, rarity)}${GOLD(u)}${sheenGrad('sh' + u, 4.2, 0.6)}
      <linearGradient id="rb${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ff0e0"/><stop offset=".33" stop-color="#7fa8ff"/><stop offset=".66" stop-color="#d48cff"/><stop offset="1" stop-color="#ffab4a"/>
        ${anim('<animateTransform attributeName="gradientTransform" type="rotate" values="0 .5 .5;360 .5 .5" dur="9s" repeatCount="indefinite"/>')}</linearGradient>
      <linearGradient id="pg${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#e6d6b4"/></linearGradient>
      <clipPath id="c${u}"><path d="${cover}"/></clipPath>`;
    let i = 0;
    const parts = [
      // the back cover
      `<path d="M30 15h40a6 6 0 0 1 6 6v62a6 6 0 0 1-6 6H30z" fill="${ofBooks ? '#3a2470' : p[2]}" stroke="${O}" stroke-width="3"/>`,
      // the page block, its edges ruled
      `<path d="M27 13h42a3 3 0 0 1 3 3v66a3 3 0 0 1-3 3H27z" fill="url(#pg${u})" stroke="${O}" stroke-width="2.4"/>
       <path d="M71 20v58M73.5 22v56M67 82.5h-40M67 80h-40" stroke="#b9a37c" stroke-width="1" opacity=".9"/>`,
      // the front cover, with a raised edge
      `<path d="${cover}" fill="${coverFill}" stroke="${O}" stroke-width="3.4"/><path d="M33 15h29a3 3 0 0 1 3 3v58a3 3 0 0 1-3 3H33" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.8"/>`,
      // the spine, with gold bands
      `<path d="M24 10h8v74h-8a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5z" fill="rgba(0,0,0,.28)" stroke="${O}" stroke-width="2.4"/>
       <rect x="19.5" y="20" width="12.5" height="4" fill="url(#au${u})" stroke="${O}" stroke-width="1.4"/><rect x="19.5" y="70" width="12.5" height="4" fill="url(#au${u})" stroke="${O}" stroke-width="1.4"/>`,
      // the clasps on the corners
      `<path d="M57 10h7a6 6 0 0 1 6 6v7z" fill="url(#au${u})" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`,
      `<path d="M57 84h7a6 6 0 0 0 6-6v-7z" fill="url(#au${u})" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`,
      // the medallion and its gem
      `<circle cx="47" cy="42" r="14" fill="url(#au${u})" stroke="${O}" stroke-width="2.6"/><circle cx="47" cy="42" r="10" fill="rgba(20,10,40,.55)" stroke="#8a5a10" stroke-width="1.2"/>
       ${ofBooks ? `<path d="M39.5 37.5q3.75-2 7.5 0v9q-3.75-2-7.5 0z" fill="#fffaf0" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/><path d="M47 37.5q3.75-2 7.5 0v9q-3.75-2-7.5 0z" fill="#f0e2c0" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>` : gem(rarity, 47, 42, 7, p[3])}`,
      // the title plate
      `<rect x="34" y="62" width="26" height="6" rx="2" fill="url(#au${u})" stroke="${O}" stroke-width="1.8"/><path d="M38 65h18" stroke="#8a5a10" stroke-width="1.2"/>`,
      // the bookmark ribbon
      `<path d="M52 82h8v15l-4-3.5-4 3.5z" fill="${ofBooks ? '#e8455a' : p[2]}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`,
    ];
    if (ofBooks) {
      // a gem of each rarity round the medallion, and a crown on top
      [['common', 47, 24], ['rare', 65, 42], ['epic', 47, 60], ['legendary', 29, 42]].forEach(([r, x, y]) => parts.push(gem(r, x, y, 4.2, PAL[r][3])));
      parts.push(`<path d="M33 13l2.5-11 6 5.5L47 -1l5.5 8.5 6-5.5L61 13z" fill="url(#au${u})" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
        <circle cx="47" cy="7" r="2" fill="#ff5a78" stroke="${O}" stroke-width="1.2"/><circle cx="37.5" cy="9" r="1.4" fill="#7fd8ff"/><circle cx="56.5" cy="9" r="1.4" fill="#7fd8ff"/>`);
    }
    return `<defs>${defs}</defs>${parts.map(b => part(i++, b)).join('')}
      <path d="${cover}" fill="url(#sh${u})" clip-path="url(#c${u})" pointer-events="none"/>`;
  }

  /* ---------- the Hammer of Books, with its living texture ---------- */
  function hammer(u) {
    const head = 'M22 16h56a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z';
    const defs = `${GOLD(u)}
      <linearGradient id="hh${u}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#7ff0e0">${anim('<animate attributeName="stop-color" values="#7ff0e0;#9a7cff;#ff8fd8;#ffc35a;#7ff0e0" dur="5s" repeatCount="indefinite"/>')}</stop>
        <stop offset=".5" stop-color="#6a4be0">${anim('<animate attributeName="stop-color" values="#6a4be0;#b04ad0;#4a6ae0;#6a4be0" dur="5s" repeatCount="indefinite"/>')}</stop>
        <stop offset="1" stop-color="#2a1a70"/>
      </linearGradient>
      <pattern id="rn${u}" width="13" height="13" patternUnits="userSpaceOnUse">
        <path d="M1 6.5h3M9 6.5h3M6.5 1v3M6.5 9v3" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/>
        <circle cx="6.5" cy="6.5" r="1.5" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="1"/>
        ${anim('<animateTransform attributeName="patternTransform" type="translate" from="0 0" to="13 -13" dur="2.2s" repeatCount="indefinite"/>')}
      </pattern>
      ${sheenGrad('sh' + u, 2.6, 0.35)}
      <linearGradient id="wd${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c98a4c"/><stop offset=".5" stop-color="#a8683a"/><stop offset="1" stop-color="#6e3f1e"/></linearGradient>
      <radialGradient id="gl${u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c8"/><stop offset=".55" stop-color="#ffd860" stop-opacity=".7"/><stop offset="1" stop-color="#ffb030" stop-opacity="0"/></radialGradient>
      <clipPath id="c${u}"><path d="${head}"/></clipPath>`;
    const parts = [
      // the handle, wrapped for grip
      `<rect x="44.5" y="44" width="11" height="44" rx="4" fill="url(#wd${u})" stroke="${O}" stroke-width="3"/>
       <path d="M45 62l10-4M45 69l10-4M45 76l10-4M45 83l10-4" stroke="#4a2a14" stroke-width="2.2" stroke-linecap="round"/>`,
      // the pommel gem
      `<circle cx="50" cy="91" r="6.5" fill="url(#au${u})" stroke="${O}" stroke-width="2.4"/><circle cx="50" cy="91" r="3" fill="#ff5a8a" stroke="${O}" stroke-width="1.2"/>`,
      // the head, its colour shifting, runes scrolling over it
      `<path d="${head}" fill="url(#hh${u})" stroke="${O}" stroke-width="3.4"/><path d="${head}" fill="url(#rn${u})" clip-path="url(#c${u})"/>
       <path d="M22 20h56" stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-linecap="round"/>`,
      // the gold bands at each end
      `<rect x="10" y="12" width="11" height="40" rx="3.5" fill="url(#au${u})" stroke="${O}" stroke-width="2.6"/><path d="M13 18v28" stroke="#fff6c8" stroke-width="1.6" opacity=".8"/>`,
      `<rect x="79" y="12" width="11" height="40" rx="3.5" fill="url(#au${u})" stroke="${O}" stroke-width="2.6"/><path d="M82 18v28" stroke="#fff6c8" stroke-width="1.6" opacity=".8"/>`,
      // the collar where the handle meets the head
      `<rect x="40" y="45" width="20" height="8" rx="2.5" fill="url(#au${u})" stroke="${O}" stroke-width="2.2"/>`,
      // the open book set in the face, glowing
      `<ellipse cx="50" cy="32" rx="17" ry="12" fill="url(#gl${u})">${anim('<animate attributeName="opacity" values=".55;1;.55" dur="1.6s" repeatCount="indefinite"/>')}</ellipse>
       <path d="M35 24q7.5-3.5 15 0v15q-7.5-3.5-15 0z" fill="#fffaf0" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
       <path d="M50 24q7.5-3.5 15 0v15q-7.5-3.5-15 0z" fill="#f0e2c0" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
       <path d="M38 28.5q4.5-1.6 9 0M38 32.5q4.5-1.6 9 0M53 28.5q4.5-1.6 9 0M53 32.5q4.5-1.6 9 0" stroke="#a88a5a" stroke-width="1.1" fill="none"/>`,
    ];
    // motes of light rising off it
    const motes = calm ? '' : [[30, 2.2, 0], [70, 1.8, 0.7], [52, 1.5, 1.4]].map(([x, r, d]) =>
      `<circle cx="${x}" cy="14" r="${r}" fill="#fff6c8"><animate attributeName="cy" values="16;-4" dur="2.1s" begin="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="2.1s" begin="${d}s" repeatCount="indefinite"/></circle>`).join('');
    let i = 0;
    return `<defs>${defs}</defs><g transform="rotate(-28 50 52)">${parts.map(b => part(i++, b)).join('')}
      <path d="${head}" fill="url(#sh${u})" clip-path="url(#c${u})" pointer-events="none"/></g>${motes}`;
  }

  /* ---------- evolution shards ---------- */
  function shards(u) {
    const crystal = (x, y, h, w, c1, c2) => `<path d="M${x} ${y - h}L${x + w} ${y - h * 0.35}L${x + w * 0.6} ${y + h * 0.5}L${x} ${y + h * 0.7}L${x - w * 0.6} ${y + h * 0.5}L${x - w} ${y - h * 0.35}Z" fill="${c1}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M${x} ${y - h}L${x + w * 0.3} ${y - h * 0.2}L${x} ${y + h * 0.7}" fill="${c2}" opacity=".7"/><path d="M${x - w * 0.5} ${y - h * 0.3}l${w * 0.3} -${h * 0.35}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
    let i = 0;
    return [crystal(50, 46, 34, 15, '#b48cff', '#7a4ae0'), crystal(26, 66, 20, 10, '#8fd8ff', '#4a8ae0'), crystal(74, 64, 22, 11, '#ff9ad8', '#d04aa0'),
      `<path d="${twinkle(68, 22, 5)}" fill="#fff"/><path d="${twinkle(28, 34, 3.5)}" fill="#fff"/>`].map(b => part(i++, b)).join('');
  }

  // The SVG for an item. Pass { forming: true } in a chest reveal: the parts then fly in and snap
  // together, the gap between parts in --gap (css).
  function svg(id) {
    const M = KCProgress.MAGIC[id];
    if (!M) return '';
    const u = (++uid).toString(36) + id.length;
    const body = M.kind === 'wild' ? wild(M.rarity, u) : M.kind === 'book' ? book(M.rarity, u, id === 'book_books')
      : M.kind === 'hammer' ? hammer(u) : shards(u);
    return `<svg class="item-svg ${M.kind}" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
  }
  // How many parts an item is built from (so the reveal knows how long it takes to form).
  const partsOf = id => {
    const M = KCProgress.MAGIC[id];
    return !M ? 0 : M.kind === 'wild' ? 10 : M.kind === 'book' ? (id === 'book_books' ? 14 : 9) : M.kind === 'hammer' ? 7 : 4;
  };
  // A colour for an item's glow, trails and sparks.
  function colors(id) {
    const M = KCProgress.MAGIC[id];
    if (!M) return ['#ffffff'];
    if (M.rarity === 'any' || M.rarity === 'legendary') return ['#7ff0e0', '#d49bff', '#ffc35a', '#ff8fd8', '#ffffff'];
    const p = PAL[M.rarity];
    return [p[0], p[1], p[3], '#ffffff'];
  }
  return { svg, partsOf, colors, PAL };
})();
