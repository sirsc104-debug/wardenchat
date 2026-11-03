/* Wildcard Chess: the cosmetics you can own (board themes, card backs, checkmate finales), how each is
   drawn, and which ones this device has equipped. Owning things is the SirSC wallet's job
   (wallet.js, docs/ECONOMY-WCC.md); equipping is a per-device choice among what you own. */
'use strict';

/* Prices follow the SirSC wallet: 1 💎 is 5,000 coins, and things bought with coins cost 75% of that.
   The server's catalog (sirsc_me) is the real price list; this copy is what the shop shows before it
   loads, and what the back end is seeded with. member: claimed by SirSC Members, not bought. */
const WCC_CATALOG = [
  { item_id: 'board:marble', coins: 15000, diamonds: 4 },
  { item_id: 'board:ebony', coins: 15000, diamonds: 4 },
  { item_id: 'board:emerald', coins: 22500, diamonds: 6 },
  { item_id: 'board:ice', coins: 22500, diamonds: 6 },
  { item_id: 'board:neon', coins: null, diamonds: 12 },
  { item_id: 'board:haunted', coins: null, diamonds: 15 },
  { item_id: 'board:royal', coins: null, diamonds: null, member_only: true, claim_from: '2026-11-01T00:00:00Z', claim_until: '2026-12-01T00:00:00Z' },
  { item_id: 'back:crimson', coins: 7500, diamonds: 2 },
  { item_id: 'back:midnight', coins: 7500, diamonds: 2 },
  { item_id: 'back:jade', coins: 7500, diamonds: 2 },
  { item_id: 'back:gold', coins: 15000, diamonds: 4 },
  { item_id: 'back:diamond', coins: null, diamonds: null, member_only: true, claim_from: null, claim_until: null },
  { item_id: 'finale:fireworks', coins: 30000, diamonds: 8 },
  { item_id: 'finale:inferno', coins: 30000, diamonds: 8 },
  { item_id: 'finale:frost', coins: 30000, diamonds: 8 },
  { item_id: 'finale:supernova', coins: null, diamonds: 20 },
  { item_id: 'pieces:marble', coins: 22500, diamonds: 6 },
  { item_id: 'pieces:carved', coins: 22500, diamonds: 6 },
  { item_id: 'pieces:gilded', coins: 30000, diamonds: 8 },
  { item_id: 'pieces:glass', coins: null, diamonds: 12 },
  { item_id: 'pieces:neon', coins: null, diamonds: 15 },
  { item_id: 'pieces:royal', coins: null, diamonds: null, member_only: true, claim_from: '2026-11-01T00:00:00Z', claim_until: '2026-12-01T00:00:00Z' },
  { item_id: 'capture:confetti', coins: 15000, diamonds: 4 },
  { item_id: 'capture:petals', coins: 15000, diamonds: 4 },
  { item_id: 'capture:pixel', coins: 22500, diamonds: 6 },
  { item_id: 'capture:shadow', coins: 22500, diamonds: 6 },
  { item_id: 'capture:lightning', coins: null, diamonds: 10 },
  { item_id: 'capture:goldrush', coins: null, diamonds: 15 },
  { item_id: 'capture:diamond', coins: null, diamonds: null, member_only: true, claim_from: null, claim_until: null },
  { item_id: 'avatar:knight', coins: 7500, diamonds: 2 },
  { item_id: 'avatar:bomber', coins: 7500, diamonds: 2 },
  { item_id: 'avatar:phantom', coins: 15000, diamonds: 4 },
  { item_id: 'avatar:vampire', coins: 15000, diamonds: 4 },
  { item_id: 'avatar:archangel', coins: 30000, diamonds: 8 },
  { item_id: 'avatar:dragon', coins: null, diamonds: 10 },
  { item_id: 'avatar:zeus', coins: null, diamonds: 12 },
  { item_id: 'avatar:crown', coins: null, diamonds: null, member_only: true, claim_from: null, claim_until: null },
];
/* Kinds added in the latest update, marked New in the Shop. */
const NEW_KINDS = ['pieces', 'capture', 'avatar'];

const BOARD_THEMES = {
  walnut: { name: 'Club Walnut', desc: 'Warm walnut and maple, the set every club owns.', light: [225, 197, 150], dark: [157, 109, 66], style: 'wood', ink: ['#9c6c41', '#ead4ad'] },
  marble: { name: 'Marble Hall', desc: 'Cool grey and white marble tiles with soft veins.', light: [236, 233, 226], dark: [146, 150, 158], style: 'marble', ink: ['#868b94', '#eeece6'] },
  ebony: { name: 'Ebony & Ivory', desc: 'Near-black ebony against pale ivory.', light: [226, 214, 190], dark: [64, 51, 45], style: 'wood', grain: ['150,128,96', '24,16,12'], ink: ['#6b5a4a', '#d9cbb2'] },
  emerald: { name: 'Emerald Felt', desc: 'Card-room green felt and cream baize.', light: [228, 223, 196], dark: [40, 104, 78], style: 'cloth', ink: ['#2f7a5c', '#e6e1c8'] },
  ice: { name: 'Frozen Lake', desc: 'Pale ice and deep blue water, cracked and frosted.', light: [226, 241, 250], dark: [112, 164, 202], style: 'frost', ink: ['#5f93ba', '#e8f4fb'] },
  neon: { name: 'Neon Arcade', desc: 'A midnight grid that glows cyan and magenta.', light: [40, 34, 70], dark: [19, 16, 36], style: 'neon', ink: ['#2ef2ff', '#ff4df0'] },
  haunted: { name: 'Haunted Manor', desc: 'Dusty violet stone, cobwebs in the corners.', light: [138, 127, 152], dark: [52, 42, 62], style: 'haunted', ink: ['#3a2f45', '#cfc5dc'] },
  royal: { name: 'Royal Velvet', desc: 'Gold leaf and crimson velvet. November 2026’s members-only board.', light: [238, 214, 150], dark: [112, 28, 48], style: 'velvet', ink: ['#8a2236', '#f3dfa6'] },
};

const CARD_BACKS = {
  classic: { name: 'Club Back', desc: 'The house deck: walnut checks and a gold W.', a: '#3a2a1c', b: '#2a1f15', ink: '#e8b450', border: '#5b4129' },
  crimson: { name: 'Crimson', desc: 'Deep red checks with a peach W.', a: '#5a1620', b: '#3d0e15', ink: '#ffc9a0', border: '#8a2a35' },
  midnight: { name: 'Midnight', desc: 'Navy checks with an ice-blue W.', a: '#1c2446', b: '#121833', ink: '#9fc3ff', border: '#33407a' },
  jade: { name: 'Jade', desc: 'Dark jade checks with a mint W.', a: '#163d33', b: '#0e2a23', ink: '#9ff0c8', border: '#2b6b58' },
  gold: { name: 'Gilded', desc: 'Bronze checks with a bright gold W.', a: '#7a5a1c', b: '#5a3f10', ink: '#fff1c0', border: '#d9a640' },
  diamond: { name: 'SirSC Diamond', desc: 'Frosted steel with a glinting W. Every member gets it.', a: '#3a4a66', b: '#25324a', ink: '#e6f6ff', border: '#9fd8ff' },
};

const FINALES = {
  classic: { name: 'Golden Fall', desc: 'The king topples in a shower of gold sparks.', colors: ['#ffd98e', '#ff9a3c', '#ffffff'], ring: '#ffcf6b', flash: 'gold' },
  fireworks: { name: 'Fireworks', desc: 'Rockets burst all over the board in every colour.', colors: ['#ff4d6d', '#ffd23f', '#5fe0ff', '#9cff6e', '#c77dff'], ring: '#ffd23f', flash: 'gold' },
  inferno: { name: 'Inferno', desc: 'Flames roar up from the back ranks and swallow the king.', colors: ['#fff3b0', '#ffb347', '#ff6a1a', '#ff3b1a'], ring: '#ff6a1a', flash: 'red' },
  frost: { name: 'Deep Freeze', desc: 'A blizzard sweeps the board and the king shatters like ice.', colors: ['#ffffff', '#cfeeff', '#8fd3ff', '#5fa8ff'], ring: '#9fe6ff', flash: 'frost' },
  supernova: { name: 'Supernova', desc: 'The board collapses into a blinding star, then explodes.', colors: ['#ffffff', '#e5d2ff', '#a5b4fc', '#5fe0ff', '#ffd98e'], ring: '#ffffff', flash: 'nova' },
};

/* What happens on the captured piece's square when one of your pieces takes it. */
const CAPTURE_FX = {
  splinters: { name: 'Splinters', desc: 'The captured piece shatters into chips. The house style.', colors: ['#ffffff', '#cfccc7', '#6d6b68'],
    play: (b, q, p) => b.burstAt(q, { n: 22, color: p && p.c === 'b' ? ['#6d6b68', '#4b4946', '#2a2826'] : ['#ffffff', '#e8e6e2', '#cfccc7'], kind: 'chip', speed: 1.2, size: 0.07, life: 38 }) },
  confetti: { name: 'Confetti', desc: 'A party popper of paper streamers on every capture.', colors: ['#ff4d6d', '#ffd23f', '#5fe0ff', '#9cff6e', '#c77dff'],
  },
  petals: { name: 'Petals', desc: 'The piece dissolves into drifting cherry blossom.', colors: ['#ffc2e2', '#ff8fc8', '#ffe6f2'] },
  pixel: { name: 'Pixel Pop', desc: 'An 8-bit explosion of chunky pixels.', colors: ['#2ef2ff', '#ff4df0', '#ffd23f', '#9cff6e'] },
  shadow: { name: 'Shadow', desc: 'The piece is dragged down into a swirl of shadow.', colors: ['#c084fc', '#2a1840', '#000000'] },
  lightning: { name: 'Lightning', desc: 'A bolt from the sky strikes the captured piece.', colors: ['#ffffff', '#7df9ff', '#ffe14d'] },
  goldrush: { name: 'Gold Rush', desc: 'The piece bursts into a fountain of gold coins, with a ka-ching.', colors: ['#ffe08a', '#f3c955', '#c9952c'] },
  diamond: { name: 'Diamond Shards', desc: 'It shatters into glittering diamonds. Every member gets it.', colors: ['#e9fbff', '#7fd8ff', '#3b82f6'] },
};
const CAPTURE_PLAY = {
  confetti: (b, q) => { b.burstAt(q, { n: 46, color: CAPTURE_FX.confetti.colors, kind: 'chip', speed: 1.8, size: 0.08, life: 70, gravity: 0.08, drag: 0.95, lift: 1.5 }); Sound.play('select'); },
  petals: (b, q) => b.burstAt(q, { n: 30, color: CAPTURE_FX.petals.colors, kind: 'heart', speed: 0.9, size: 0.1, life: 90, gravity: 0.015, drag: 0.97 }),
  pixel: (b, q) => { b.burstAt(q, { n: 36, color: CAPTURE_FX.pixel.colors, kind: 'pixel', speed: 1.5, size: 0.09, life: 46, gravity: 0.1 }); Sound.play('zap'); },
  shadow: (b, q) => { b.ringAt(q, '#c084fc', 0.9, 8, 22); b.burstAt(q, { n: 30, color: CAPTURE_FX.shadow.colors, kind: 'smoke', speed: 0.7, size: 0.13, life: 50, gravity: 0, drag: 0.86 }); },
  lightning: (b, q) => { b.beam(q < 32 ? q + 32 : q - 32, q, '#ffffff', 14); b.burstAt(q, { n: 30, color: CAPTURE_FX.lightning.colors, kind: 'spark', speed: 1.8, life: 34 }); b.flash('gold'); Sound.play('zap'); },
  goldrush: (b, q) => { b.burstAt(q, { n: 34, color: CAPTURE_FX.goldrush.colors, kind: 'coin', speed: 1.6, size: 0.11, life: 70, gravity: 0.12, lift: 2.2 }); Sound.play('coin'); },
  diamond: (b, q) => { b.burstAt(q, { n: 30, color: CAPTURE_FX.diamond.colors, kind: 'gem', speed: 1.6, size: 0.1, life: 56, gravity: 0.08, lift: 1 }); b.burstAt(q, { n: 16, color: ['#ffffff'], kind: 'spark', speed: 1, gravity: 0 }); },
};
function playCapture(id, b, q, p) { (CAPTURE_PLAY[id] || CAPTURE_FX.splinters.play)(b, q, p); }

/* Avatars: a framed portrait and a title shown in your player bar (and to your opponent online). */
const AVATARS = {
  king: { name: 'The Challenger', emblem: 'K', frame: 'wood', desc: 'Every player’s first portrait.' },
  knight: { name: 'Knight Errant', emblem: 'N', frame: 'silver', desc: 'A silver-framed knight, always on the move.' },
  bomber: { name: 'The Mad Bomber', emblem: 'bomber', frame: 'silver', desc: 'For players who like things loud.' },
  phantom: { name: 'Phantom of the Board', emblem: 'phantom', frame: 'gold', desc: 'A gold frame and a ghost that walks through walls.' },
  vampire: { name: 'Count of the Night', emblem: 'vampire', frame: 'gold', desc: 'Gold frame, red eyes, no mercy.' },
  archangel: { name: 'Holy Terror', emblem: 'archangel', frame: 'gold', desc: 'The Archangel in a gilded frame.' },
  dragon: { name: 'Dragonlord', emblem: 'dragon', frame: 'prism', desc: 'An animated prismatic frame around the Elder Dragon.' },
  zeus: { name: 'Storm Caller', emblem: 'zeus', frame: 'prism', desc: 'The Storm King in a crackling prismatic frame.' },
  crown: { name: 'SirSC Royalty', emblem: 'K', frame: 'diamond', desc: 'The diamond frame and crown of a SirSC Member.' },
};
function avatarHTML(id, color) {
  const a = AVATARS[id] || AVATARS.king;
  return `<div class="avatar av-${a.frame}">${pieceSVG(a.emblem, color || 'w')}${a.frame === 'diamond' ? '<span class="av-crown" aria-hidden="true">♛</span>' : ''}</div>`;
}

const COSMETIC_KINDS = { board: BOARD_THEMES, pieces: PIECE_SETS, back: CARD_BACKS, capture: CAPTURE_FX, finale: FINALES, avatar: AVATARS };
const DEFAULT_LOOK = { board: 'walnut', pieces: 'classic', back: 'classic', capture: 'splinters', finale: 'classic', avatar: 'king' };
const cosmeticOf = item => { const [k, id] = String(item).split(':'); return COSMETIC_KINDS[k] && COSMETIC_KINDS[k][id] ? { kind: k, id, ...COSMETIC_KINDS[k][id] } : null; };

/* ---------- painting a board theme ---------- */
function paintBoard(c, S, themeId, seed, dpr) {
  const th = BOARD_THEMES[themeId] || BOARD_THEMES.walnut, s = S / 8, rnd = mulberry32(seed || 11), px = s / 90;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const light = (x + y) % 2 === 0, base = light ? th.light : th.dark, v = (rnd() - 0.5) * 14;
    const x0 = x * s, y0 = y * s;
    c.save();
    c.beginPath(); c.rect(x0, y0, s, s); c.clip();
    c.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.9},${base[2] + v * 0.7})`;
    c.fillRect(x0, y0, s, s);
    c.translate(x0, y0);
    (SQUARE_PAINTERS[th.style] || SQUARE_PAINTERS.wood)(c, s, light, rnd, th, px);
    c.restore();
  }
}
const SQUARE_PAINTERS = {
  wood(c, s, light, rnd, th, px) {
    const grain = th.grain || ['120,72,30', '70,38,14'];
    if (rnd() >= 0.72) { c.translate(s / 2, s / 2); c.rotate(Math.PI / 2); c.translate(-s / 2, -s / 2); }
    for (let i = 0; i < 5; i++) {
      c.fillStyle = rnd() < 0.5 ? `rgba(110,60,20,${0.03 + rnd() * 0.05})` : `rgba(255,240,205,${0.03 + rnd() * 0.05})`;
      c.fillRect(rnd() * s, 0, s * (0.08 + rnd() * 0.22), s);
    }
    const lines = 22 + Math.floor(rnd() * 14);
    for (let i = 0; i < lines; i++) {
      const p = rnd() * s, amp = s * (0.004 + rnd() * 0.02), k = 0.6 + rnd() * 1.8, ph = rnd() * 6.28, dark = rnd() < 0.7;
      c.strokeStyle = dark ? `rgba(${light ? grain[0] : grain[1]},${0.05 + rnd() * 0.14})` : `rgba(255,236,200,${0.04 + rnd() * 0.08})`;
      c.lineWidth = (0.4 + rnd() * 1.5) * px;
      c.beginPath();
      for (let t = 0; t <= 12; t++) { const yy = (t / 12) * s, xx = p + Math.sin((t / 12) * Math.PI * k + ph) * amp; t ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.stroke();
    }
    if (rnd() < 0.07) {
      const kx = s * (0.2 + rnd() * 0.6), ky = s * (0.2 + rnd() * 0.6);
      for (let r = 1; r <= 4; r++) { c.strokeStyle = `rgba(90,50,20,${0.16 - r * 0.03})`; c.lineWidth = px; c.beginPath(); c.ellipse(kx, ky, s * 0.02 * r, s * 0.06 * r, 0, 0, Math.PI * 2); c.stroke(); }
    }
  },
  marble(c, s, light, rnd, th, px) {
    for (let i = 0; i < 4; i++) {
      const g = c.createRadialGradient(rnd() * s, rnd() * s, 0, rnd() * s, rnd() * s, s * (0.3 + rnd() * 0.5));
      g.addColorStop(0, `rgba(255,255,255,${0.06 + rnd() * 0.08})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
    const veins = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < veins; i++) {
      c.strokeStyle = light ? `rgba(110,112,122,${0.12 + rnd() * 0.22})` : `rgba(230,232,238,${0.1 + rnd() * 0.2})`;
      c.lineWidth = (0.5 + rnd() * 1.8) * px;
      c.beginPath();
      const sx = rnd() * s, sy = -2, ex = rnd() * s, ey = s + 2;
      c.moveTo(sx, sy);
      c.bezierCurveTo(rnd() * s, s * 0.33, rnd() * s, s * 0.66, ex, ey);
      c.stroke();
    }
    c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = px; c.strokeRect(0.5 * px, 0.5 * px, s - px, s - px);
  },
  cloth(c, s, light, rnd, th, px) {
    c.strokeStyle = light ? 'rgba(90,80,50,.06)' : 'rgba(0,0,0,.12)'; c.lineWidth = 0.6 * px;
    for (let i = 0; i <= 26; i++) { const t = (i / 26) * s; c.beginPath(); c.moveTo(t, 0); c.lineTo(t, s); c.stroke(); c.beginPath(); c.moveTo(0, t); c.lineTo(s, t); c.stroke(); }
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`; c.fillRect(rnd() * s, rnd() * s, px * 1.2, px * 1.2); }
    const g = c.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.1)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  },
  frost(c, s, light, rnd, th, px) {
    const g = c.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.1 + rnd() * 0.35})`; c.beginPath(); c.arc(rnd() * s, rnd() * s, (0.4 + rnd()) * px, 0, 6.29); c.fill(); }
    if (rnd() < 0.6) {
      c.strokeStyle = `rgba(255,255,255,${0.3 + rnd() * 0.3})`; c.lineWidth = 0.8 * px;
      const ox = rnd() * s, oy = rnd() * s;
      for (let k = 0; k < 3 + Math.floor(rnd() * 3); k++) {
        let x = ox, y = oy; c.beginPath(); c.moveTo(x, y);
        const a = rnd() * 6.28;
        for (let j = 0; j < 4; j++) { x += Math.cos(a + (rnd() - 0.5)) * s * 0.18; y += Math.sin(a + (rnd() - 0.5)) * s * 0.18; c.lineTo(x, y); }
        c.stroke();
      }
    }
  },
  neon(c, s, light, rnd, th, px) {
    c.strokeStyle = 'rgba(120,100,200,.12)'; c.lineWidth = 0.6 * px;
    for (let i = 1; i < 6; i++) { const t = (i / 6) * s; c.beginPath(); c.moveTo(t, 0); c.lineTo(t, s); c.moveTo(0, t); c.lineTo(s, t); c.stroke(); }
    if (light) {
      c.shadowColor = '#2ef2ff'; c.shadowBlur = 10 * px; c.strokeStyle = 'rgba(46,242,255,.85)'; c.lineWidth = 2 * px;
      c.strokeRect(5 * px, 5 * px, s - 10 * px, s - 10 * px);
    } else {
      c.shadowColor = '#ff4df0'; c.shadowBlur = 8 * px; c.fillStyle = 'rgba(255,77,240,.7)';
      c.beginPath(); c.arc(s / 2, s / 2, 2.2 * px, 0, 6.29); c.fill();
    }
    c.shadowBlur = 0;
  },
  haunted(c, s, light, rnd, th, px) {
    for (let i = 0; i < 3; i++) {
      const g = c.createRadialGradient(rnd() * s, rnd() * s, 0, rnd() * s, rnd() * s, s * 0.6);
      g.addColorStop(0, `rgba(200,180,230,${0.06 + rnd() * 0.08})`); g.addColorStop(1, 'rgba(200,180,230,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.8 * px;
    if (rnd() < 0.5) { c.beginPath(); let x = rnd() * s, y = 0; c.moveTo(x, y); while (y < s) { x += (rnd() - 0.5) * s * 0.25; y += s * 0.15; c.lineTo(x, y); } c.stroke(); }
    if (rnd() < 0.22) {
      const corner = Math.floor(rnd() * 4), cx = corner % 2 ? s : 0, cy = corner > 1 ? s : 0, sx = cx ? -1 : 1, sy = cy ? -1 : 1;
      c.strokeStyle = 'rgba(240,235,250,.35)'; c.lineWidth = 0.6 * px;
      for (let k = 0; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + sx * Math.cos(a) * s * 0.5, cy + sy * Math.sin(a) * s * 0.5); c.stroke(); }
      for (let r = 1; r <= 3; r++) {
        c.beginPath();
        for (let k = 0; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2), rr = r * s * 0.13; const xx = cx + sx * Math.cos(a) * rr, yy = cy + sy * Math.sin(a) * rr; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
        c.stroke();
      }
    }
  },
  velvet(c, s, light, rnd, th, px) {
    if (light) {
      const g = c.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, 'rgba(255,250,220,.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(160,110,30,.25)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(255,255,240,${rnd() * 0.5})`; c.fillRect(rnd() * s, rnd() * s, px * 1.4, px * 1.4); }
    } else {
      const g = c.createRadialGradient(s * 0.45, s * 0.4, s * 0.05, s / 2, s / 2, s * 0.8);
      g.addColorStop(0, 'rgba(255,120,150,.18)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
    c.strokeStyle = 'rgba(214,166,64,.55)'; c.lineWidth = 1.2 * px; c.strokeRect(2 * px, 2 * px, s - 4 * px, s - 4 * px);
  },
};

/* ---------- what this device wears ---------- */
const Look = {
  key: 'wildcard-chess:look',
  chosen() { try { return Object.assign({}, DEFAULT_LOOK, JSON.parse(localStorage.getItem(this.key) || '{}')); } catch (e) { return { ...DEFAULT_LOOK }; } },
  choose(kind, id) { const c = this.chosen(); c[kind] = id; try { localStorage.setItem(this.key, JSON.stringify(c)); } catch (e) { /* storage blocked */ } this.apply(); },
  /* An equipped item only counts while the wallet says you own it (or it's a free default). */
  current() {
    const c = this.chosen(), out = {};
    for (const k of Object.keys(DEFAULT_LOOK)) out[k] = c[k] === DEFAULT_LOOK[k] || (typeof Wallet !== 'undefined' && Wallet.owns(k + ':' + c[k])) ? c[k] : DEFAULT_LOOK[k];
    return out;
  },
  apply() {
    const cur = this.current(), back = CARD_BACKS[cur.back], root = document.documentElement.style;
    root.setProperty('--back-a', back.a); root.setProperty('--back-b', back.b);
    root.setProperty('--back-ink', back.ink); root.setProperty('--back-border', back.border);
    document.documentElement.dataset.back = cur.back;
    for (const b of BoardView.all || []) b.setTheme(cur.board);
    if (PIECE_SET !== cur.pieces) {
      PIECE_SET = cur.pieces;
      for (const b of BoardView.all || []) b.repaint();
      if (typeof G !== 'undefined' && G.s && typeof renderLog === 'function') { renderLog(); G.render(); }
    }
  },
};
