/* Putt Club: the cosmetics you can own (ball designs, trails, hole-out celebrations, flags, scenery
   and avatars), what each one is called, and which ones this device has equipped. Owning things is
   the SirSC wallet's job (wallet.js, docs/ECONOMY-PUTT.md); equipping is a per-device choice among
   what you own. How each one looks is drawn in vis-cosmetics.js. Nothing here changes how a putt
   plays: the shop sells looks only, never an advantage. */
'use strict';

/* Prices follow the SirSC wallet: 1 💎 is 5,000 coins, and things bought with coins cost 75% of that.
   The server's catalog (sirsc_me) is the real price list; this copy is what the shop shows before it
   loads, and what the back end is seeded with. member_only: claimed by SirSC Members, not bought. */
const PUTT_CATALOG = [
  { item_id: 'ball:sunny', coins: 7500, diamonds: 2 },
  { item_id: 'ball:ruby', coins: 7500, diamonds: 2 },
  { item_id: 'ball:mint', coins: 7500, diamonds: 2 },
  { item_id: 'ball:beach', coins: 15000, diamonds: 4 },
  { item_id: 'ball:soccer', coins: 15000, diamonds: 4 },
  { item_id: 'ball:moon', coins: 22500, diamonds: 6 },
  { item_id: 'ball:gold', coins: 30000, diamonds: 8 },
  { item_id: 'ball:disco', coins: null, diamonds: 10 },
  { item_id: 'ball:galaxy', coins: null, diamonds: 12 },
  { item_id: 'ball:diamond', coins: null, diamonds: null, member_only: true, claim_from: null, claim_until: null },
  { item_id: 'trail:sparkle', coins: 15000, diamonds: 4 },
  { item_id: 'trail:bubbles', coins: 15000, diamonds: 4 },
  { item_id: 'trail:petals', coins: 22500, diamonds: 6 },
  { item_id: 'trail:rainbow', coins: 22500, diamonds: 6 },
  { item_id: 'trail:fire', coins: null, diamonds: 10 },
  { item_id: 'trail:stardust', coins: null, diamonds: 12 },
  { item_id: 'trail:diamond', coins: null, diamonds: null, member_only: true, claim_from: null, claim_until: null },
  { item_id: 'sink:balloons', coins: 15000, diamonds: 4 },
  { item_id: 'sink:bubbles', coins: 15000, diamonds: 4 },
  { item_id: 'sink:fireworks', coins: 22500, diamonds: 6 },
  { item_id: 'sink:snow', coins: 22500, diamonds: 6 },
  { item_id: 'sink:lightning', coins: null, diamonds: 10 },
  { item_id: 'sink:goldrush', coins: null, diamonds: 15 },
  { item_id: 'flag:checkered', coins: 7500, diamonds: 2 },
  { item_id: 'flag:pirate', coins: 7500, diamonds: 2 },
  { item_id: 'flag:usa', coins: 7500, diamonds: 2 },
  { item_id: 'flag:dragon', coins: 15000, diamonds: 4 },
  { item_id: 'flag:sirsc', coins: null, diamonds: null, member_only: true, claim_from: null, claim_until: null },
  { item_id: 'scene:sunset', coins: 30000, diamonds: 8 },
  { item_id: 'scene:blossom', coins: 30000, diamonds: 8 },
  { item_id: 'scene:night', coins: 30000, diamonds: 8 },
  { item_id: 'scene:aurora', coins: null, diamonds: 15 },
  { item_id: 'scene:fireworks', coins: null, diamonds: 20 },
  { item_id: 'scene:harvest', coins: null, diamonds: null, member_only: true, claim_from: '2026-11-01T00:00:00Z', claim_until: '2026-12-01T00:00:00Z' },
  { item_id: 'avatar:penguin', coins: 7500, diamonds: 2 },
  { item_id: 'avatar:cactus', coins: 7500, diamonds: 2 },
  { item_id: 'avatar:snowman', coins: 15000, diamonds: 4 },
  { item_id: 'avatar:fox', coins: 15000, diamonds: 4 },
  { item_id: 'avatar:dragon', coins: 30000, diamonds: 8 },
  { item_id: 'avatar:imp', coins: null, diamonds: 10 },
  { item_id: 'avatar:unicorn', coins: null, diamonds: 12 },
  { item_id: 'avatar:crown', coins: null, diamonds: null, member_only: true, claim_from: null, claim_until: null },
];

/* What everyone has without buying anything. These are not catalog rows. */
const DEFAULT_LOOK = { ball: 'classic', trail: 'plain', sink: 'confetti', flag: 'classic', scene: 'standard', avatar: 'golfer' };
const KINDS = ['ball', 'trail', 'sink', 'flag', 'scene', 'avatar'];
const KIND_NAMES = { ball: 'Ball', trail: 'Trail', sink: 'Hole-out', flag: 'Flag', scene: 'Scenery', avatar: 'Avatar' };

/* Names, descriptions and a few drawing hints for every cosmetic (defaults included). */
const COSMETICS = {
  ball: {
    classic: { name: 'Club White', desc: 'The dimpled white ball every club hands out.' },
    sunny: { name: 'Sunny Yellow', desc: 'Bright as a buttercup, easy to spot anywhere.', color: '#ffd23f' },
    ruby: { name: 'Ruby Red', desc: 'Glossy red with a candy shine.', color: '#e0283a' },
    mint: { name: 'Mint', desc: 'Cool pastel green.', color: '#6fe0b0' },
    beach: { name: 'Beach Ball', desc: 'Red, yellow, blue and white panels that spin as it rolls.' },
    soccer: { name: 'Little Striker', desc: 'Black and white patches, like a tiny football.' },
    moon: { name: 'Moon Rock', desc: 'Grey and cratered, straight from the Sea of Tranquility.' },
    gold: { name: 'Solid Gold', desc: 'Polished gold that catches every light.', color: '#ffcc33' },
    disco: { name: 'Disco Ball', desc: 'A mirrored ball that throws sparkles as it rolls.' },
    galaxy: { name: 'Galaxy', desc: 'A swirl of nebula and stars that glows in the dark.' },
    diamond: { name: 'SirSC Diamond', desc: 'Cut crystal with a blue glow. For SirSC Members.' },
  },
  trail: {
    plain: { name: 'Breeze', desc: 'A faint white wisp when the ball really moves.' },
    sparkle: { name: 'Sparkle', desc: 'Gold and white glitter twinkles behind the ball.' },
    bubbles: { name: 'Bubbles', desc: 'Soap bubbles float up from its path.' },
    petals: { name: 'Petals', desc: 'Pink blossom petals drift down where it rolls.' },
    rainbow: { name: 'Rainbow', desc: 'A ribbon that runs through every colour.' },
    fire: { name: 'Fire Trail', desc: 'Flames and embers lick up behind the ball.' },
    stardust: { name: 'Stardust', desc: 'Violet and blue stars that slowly fade.' },
    diamond: { name: 'Diamond Dust', desc: 'Glinting blue crystal shards. For SirSC Members.' },
  },
  sink: {
    confetti: { name: 'Confetti', desc: 'A pop of confetti in the course colours.' },
    balloons: { name: 'Balloons', desc: 'A bunch of balloons floats up out of the cup.' },
    bubbles: { name: 'Bubble Burst', desc: 'A fountain of soap bubbles.' },
    fireworks: { name: 'Fireworks', desc: 'Rockets burst in colour above the cup.' },
    snow: { name: 'Snow Globe', desc: 'A flurry of snowflakes swirls down.' },
    lightning: { name: 'Thunderstrike', desc: 'A bolt of lightning hits the flag with a crack.' },
    goldrush: { name: 'Gold Rush', desc: 'Gold coins spray out and bounce around the cup.' },
  },
  flag: {
    classic: { name: 'Club Flag', desc: 'The course colour with the hole number.' },
    checkered: { name: 'Chequered', desc: 'Black and white, like the end of a race.' },
    pirate: { name: 'Jolly Roger', desc: 'Skull and crossbones on black.' },
    usa: { name: 'Stars and Stripes', desc: 'The USA flag, with the hole number on the blue instead of the stars.' },
    dragon: { name: 'Dragon Banner', desc: 'A red dragon on forest green.' },
    sirsc: { name: 'SirSC Standard', desc: 'The SirSC Diamond on royal blue. For SirSC Members.' },
  },
  scene: {
    standard: { name: 'Course Weather', desc: 'Each course in its own light: garden day, desert afternoon, winter sun.' },
    sunset: { name: 'Golden Sunset', desc: 'Low sun, long shadows and a peach sky on every course.' },
    blossom: { name: 'Cherry Blossom', desc: 'Pastel skies and pink petals drifting over every course.' },
    night: { name: 'Starry Night', desc: 'Night falls: stars, a full moon and warm lanterns round the green.' },
    aurora: { name: 'Northern Lights', desc: 'Night with green and violet aurora curtains rippling overhead.' },
    fireworks: { name: 'Fireworks Night', desc: 'Night skies full of fireworks bursting over the course.' },
    harvest: { name: 'Harvest Moon', desc: 'A huge orange moon at dusk and autumn leaves on the wind. November 2026’s members’ scenery.' },
  },
  avatar: {
    golfer: { name: 'Golfer', desc: 'Your name tag online, and on your scorecard.', icon: '🏌️' },
    penguin: { name: 'Penguin', desc: 'Belly-slides into every round.', icon: '🐧' },
    cactus: { name: 'Cactus', desc: 'Prickly, but friendly.', icon: '🌵' },
    snowman: { name: 'Snowman', desc: 'Cool under pressure.', icon: '⛄' },
    fox: { name: 'Fox', desc: 'Sly angles off every rail.', icon: '🦊' },
    dragon: { name: 'Dragon', desc: 'Breathes fire on the leaderboard.', icon: '🐉' },
    imp: { name: 'Imp', desc: 'Straight up from the Abyss.', icon: '😈' },
    unicorn: { name: 'Unicorn', desc: 'Rare, magical and very smug.', icon: '🦄' },
    crown: { name: 'SirSC Royalty', desc: 'A crown for SirSC Members.', icon: '👑' },
  },
};
const cosmeticOf = item => { const [kind, id] = item.split(':'); const c = COSMETICS[kind] && COSMETICS[kind][id]; return c ? Object.assign({ kind, id, item }, c) : null; };
const avatarIcon = id => (COSMETICS.avatar[id] || COSMETICS.avatar.golfer).icon;

/* Which cosmetics this device wears. Only things the signed-in account owns count; everything else
   (and everything while signed out) falls back to the defaults. The shop can preview one thing on top. */
const Look = (() => {
  const KEY = 'puttclub.look';
  const listeners = new Set();
  let chosen = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } })();
  let preview = null;
  const owns = (kind, id) => id === DEFAULT_LOOK[kind] || (typeof Wallet !== 'undefined' && Wallet.owns(kind + ':' + id));
  // What you wear (owned things only), and the same with the shop's preview on top.
  function worn() {
    const out = {};
    for (const k of KINDS) { const id = chosen[k]; out[k] = id && COSMETICS[k][id] && owns(k, id) ? id : DEFAULT_LOOK[k]; }
    return out;
  }
  function current() { const out = worn(); if (preview) out[preview.kind] = preview.id; return out; }
  const emit = () => listeners.forEach(fn => { try { fn(current()); } catch (e) { console.error(e); } });
  return {
    current, worn,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    choose(kind, id) { chosen[kind] = id; try { localStorage.setItem(KEY, JSON.stringify(chosen)); } catch (e) { /* storage blocked */ } emit(); },
    preview(kind, id) { preview = kind ? { kind, id } : null; emit(); },
    get previewing() { return preview; },
    apply: emit,
  };
})();
