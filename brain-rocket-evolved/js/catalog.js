/* Brain Rocket – Evolved: what the SirSC Shop sells (cosmetics only, never an advantage) and how each
 * item looks. Prices follow Wildcard Chess and Downhill Death Run: 1 💎 = 5,000 coins, and a coin price
 * is 75% of that. The server keeps its own copy of the prices (docs/ECONOMY-BRE.md); this list is
 * what the shop shows until the wallet answers.
 *
 * Three kinds, one equipped of each: rocket (the body), flame (the engine's colours) and trail (what
 * streams out behind). The free defaults (rocket:classic, flame:classic, trail:classic) aren't sold. */
'use strict';

const BRE_LOOKS = {
  rocket: {
    classic:  { name: 'Classic', desc: 'The original: white, with red bands.', body: ['#b9c1d4', '#ffffff', '#a7b0c4'], band: '#e8364f', fin: '#e8364f', finDark: '#b8243b', glass: ['#7fd3ff', '#173a8a'] },
    midnight: { name: 'Midnight', desc: 'Navy and gold, for night launches.', body: ['#1e2550', '#4a5899', '#1a2046'], band: '#ffd84d', fin: '#ffd84d', finDark: '#c9a227', glass: ['#ffe9a8', '#7a5a10'] },
    sunset:   { name: 'Sunset', desc: 'Peach to pink, with violet bands.', body: ['#ff9a6a', '#ffd3b5', '#ff6f91'], band: '#7a2a8f', fin: '#7a2a8f', finDark: '#4f1a5e', glass: ['#ffe27a', '#ff5fb0'] },
    mint:     { name: 'Mint', desc: 'Cool mint with teal stripes.', body: ['#9fe8c8', '#e8fff5', '#7fd3b0'], band: '#1f8f8a', fin: '#1f8f8a', finDark: '#136660', glass: ['#c9fff6', '#1f6f9e'] },
    retro:    { name: 'Retro', desc: 'Cream, teal and orange, straight out of 1962.', body: ['#e8dcc0', '#fff8e8', '#d8c8a8'], band: '#2a9d8f', fin: '#f4a261', finDark: '#c97b3a', glass: ['#a8e6ff', '#2a4f8a'] },
    gold:     { name: 'Solid Gold', desc: 'Every panel polished gold.', body: ['#b8860b', '#ffe58a', '#a87808'], band: '#fff3c4', fin: '#d4a017', finDark: '#8a6508', glass: ['#fff8dc', '#b8860b'] },
    chrome:   { name: 'Chrome', desc: 'A mirror finish with a cyan stripe.', body: ['#6b7280', '#f5f7fa', '#5a616e'], band: '#22d3ee', fin: '#9ca3af', finDark: '#4b5563', glass: ['#e0fbff', '#0e7490'], shine: true },
    galaxy:   { name: 'Galaxy', desc: 'Deep violet, full of stars.', body: ['#2a0f5c', '#6b2fb5', '#1e0a44'], band: '#ff5fb0', fin: '#a04dff', finDark: '#5a1e9e', glass: ['#ffd1f0', '#5a1e9e'], stars: true },
    diamond:  { name: 'SirSC Diamond', desc: 'Icy facets that catch the light. For SirSC Members.', body: ['#7fd8ff', '#e9fbff', '#3b82f6'], band: '#1e3a8a', fin: '#7fd8ff', finDark: '#3b82f6', glass: ['#ffffff', '#3b82f6'], facets: true },
    royal:    { name: 'Royal Velvet', desc: 'Purple velvet trimmed with gold. November 2026\'s members\' rocket.', body: ['#4a1a6e', '#8a3fbf', '#3a1258'], band: '#ffd84d', fin: '#ffd84d', finDark: '#b8860b', glass: ['#ffe9a8', '#7a2a8f'] }
  },
  flame: {
    classic: { name: 'Classic', desc: 'Orange, hotter with a streak.', colors: null },
    plasma:  { name: 'Plasma', desc: 'Blue-white, all the time.', colors: ['#2f7bff', '#9fe6ff'] },
    toxic:   { name: 'Toxic', desc: 'A green you shouldn\'t touch.', colors: ['#2fbf4a', '#c8ff7a'] },
    candy:   { name: 'Candy', desc: 'Pink and sugary.', colors: ['#ff3d9e', '#ffc2e6'] },
    inferno: { name: 'Inferno', desc: 'Bigger, white-hot and roaring.', colors: ['#ff3d00', '#fff1a8'], big: 1.3 },
    rainbow: { name: 'Rainbow', desc: 'Every colour, cycling.', colors: 'rainbow' },
    diamond: { name: 'Diamond Fire', desc: 'Cold blue fire with sparkles. For SirSC Members.', colors: ['#3b82f6', '#e9fbff'], sparkle: true }
  },
  trail: {
    classic:  { name: 'Smoke', desc: 'Just the exhaust.', shape: null },
    stardust: { name: 'Stardust', desc: 'Little stars stream out behind.', shape: 'star', colors: ['#ffd84d', '#ffffff', '#ffe9a8'] },
    hearts:   { name: 'Hearts', desc: 'A trail of hearts.', shape: 'heart', colors: ['#ff5fb0', '#ff8fc8', '#ff3d6e'] },
    notes:    { name: 'Music', desc: 'Music notes, in time with the tune.', shape: 'note', colors: ['#5fe8ff', '#c58bff', '#ffffff'] },
    bubbles:  { name: 'Bubbles', desc: 'Soap bubbles, somehow, in space.', shape: 'bubble', colors: ['#a8e6ff', '#ffd1f0', '#c9fff6'] },
    coins:    { name: 'Gold Rush', desc: 'A fountain of SirSC coins.', shape: 'coin', colors: ['#ffd84d', '#ffb300'] },
    shards:   { name: 'Diamond Shards', desc: 'Glittering shards. For SirSC Members.', shape: 'shard', colors: ['#e9fbff', '#7fd8ff', '#3b82f6'] }
  }
};
const BRE_KINDS = { rocket: 'Rockets', flame: 'Flames', trail: 'Trails' };
const BRE_DEFAULT = { rocket: 'classic', flame: 'classic', trail: 'classic' };

const BRE_CATALOG = [
  { item_id: 'rocket:midnight', coins: 15000, diamonds: 4 },
  { item_id: 'rocket:sunset', coins: 15000, diamonds: 4 },
  { item_id: 'rocket:mint', coins: 15000, diamonds: 4 },
  { item_id: 'rocket:retro', coins: 22500, diamonds: 6 },
  { item_id: 'rocket:gold', coins: 30000, diamonds: 8 },
  { item_id: 'rocket:chrome', coins: null, diamonds: 12 },
  { item_id: 'rocket:galaxy', coins: null, diamonds: 15 },
  { item_id: 'rocket:diamond', member_only: true },
  { item_id: 'rocket:royal', member_only: true, claim_from: '2026-11-01T00:00:00Z', claim_until: '2026-12-01T00:00:00Z' },
  { item_id: 'flame:plasma', coins: 7500, diamonds: 2 },
  { item_id: 'flame:toxic', coins: 7500, diamonds: 2 },
  { item_id: 'flame:candy', coins: 15000, diamonds: 4 },
  { item_id: 'flame:inferno', coins: 22500, diamonds: 6 },
  { item_id: 'flame:rainbow', coins: null, diamonds: 10 },
  { item_id: 'flame:diamond', member_only: true },
  { item_id: 'trail:stardust', coins: 7500, diamonds: 2 },
  { item_id: 'trail:hearts', coins: 15000, diamonds: 4 },
  { item_id: 'trail:notes', coins: 15000, diamonds: 4 },
  { item_id: 'trail:bubbles', coins: 15000, diamonds: 4 },
  { item_id: 'trail:coins', coins: null, diamonds: 12 },
  { item_id: 'trail:shards', member_only: true }
];
const lookOf = item => { const [kind, id] = String(item).split(':'); const L = BRE_LOOKS[kind] && BRE_LOOKS[kind][id]; return L ? { ...L, kind, id } : null; };
