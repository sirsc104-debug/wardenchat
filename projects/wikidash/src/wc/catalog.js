// WikiDash's shop: every cosmetic, what it looks like, and the catalog rows the server is seeded with
// (docs/ECONOMY-WKD.md). Priced like the other SirSC games: 1 💎 is worth 5,000 coins and a coin price
// is 75% of that. The server's catalog (sirsc_me().catalog) wins over this copy whenever it answers.

export const KINDS = [
  ["paper", "Pages", "How articles look while you race"],
  ["links", "Links", "How the links you can click look"],
  ["avatar", "Avatars", "Shown by your name, to everyone in your party"],
  ["finale", "Finishes", "What plays when you reach the target"],
  ["spark", "Clicks", "What bursts out of a link when you click it"],
];
export const KIND_NAMES = { paper: "Page", links: "Link style", avatar: "Avatar", finale: "Finish", spark: "Click effect" };
export const NEW_KINDS = [];

/** Everyone has these. They aren't catalog rows. */
export const DEFAULT_LOOK = { paper: "classic", links: "classic", avatar: "reader", finale: "confetti", spark: "ring" };

const D = (n) => ({ coins: Math.round(n * 5000 * 0.75), diamonds: n });
const DIA = (n) => ({ coins: null, diamonds: n });
const MEMBER = (claim) => ({ coins: null, diamonds: null, member_only: true, ...(claim || {}) });
const NOV = { claim_from: "2026-11-01T00:00:00Z", claim_until: "2026-12-01T00:00:00Z" };

/** Every cosmetic. `p` holds what the look needs (colours for pages and links, a glyph for avatars). */
export const COSMETICS = {
  // ── pages ──
  "paper:classic": { name: "Encyclopedia", desc: "The everyday page: follows light or dark mode.", p: null },
  "paper:newsprint": { name: "Newsprint", desc: "Grey morning paper and black ink.", price: D(4), p: { bg: "#e9e6de", fg: "#1b1b1b", muted: "#5d5a52", line: "#c9c4b8", card: "#f2efe8", link: "#1b1b1b", soft: "#d9d5ca", head: "#111" } },
  "paper:parchment": { name: "Parchment", desc: "Old library vellum, brown ink.", price: D(4), p: { bg: "#efe0bd", fg: "#3a2a16", muted: "#7a6243", line: "#d3bd8e", card: "#f6ead0", link: "#8a3b12", soft: "#e4cf9f", head: "#2c1d0b" } },
  "paper:blueprint": { name: "Blueprint", desc: "White lines on drafting blue.", price: D(6), p: { bg: "#123a73", fg: "#e8f1ff", muted: "#a9c2e6", line: "#3a63a0", card: "#16447f", link: "#ffe27a", soft: "#21528f", head: "#ffffff" } },
  "paper:midnight": { name: "Midnight", desc: "A dark reading room with cyan links.", price: D(6), p: { bg: "#0d1117", fg: "#dfe6ee", muted: "#8b98a8", line: "#263040", card: "#121924", link: "#19f5e4", soft: "#0f2a2e", head: "#ffffff" } },
  "paper:botanical": { name: "Botanical", desc: "Pressed-leaf greens from a field guide.", price: D(6), p: { bg: "#e4ecdc", fg: "#1f2d1c", muted: "#5c6b55", line: "#bccbb0", card: "#eef3e8", link: "#2f6b2a", soft: "#cfdcc2", head: "#16220f" } },
  "paper:galactica": { name: "Galactica", desc: "Starlight on deep violet. Diamonds only.", price: DIA(12), p: { bg: "#160d2e", fg: "#ece6ff", muted: "#a99ad6", line: "#33245e", card: "#1d1240", link: "#ff9ee8", soft: "#2c1b57", head: "#ffffff", stars: true } },
  "paper:gilded": { name: "Gilded", desc: "Black lacquer and gold leaf. Diamonds only.", price: DIA(15), p: { bg: "#111010", fg: "#efe6cf", muted: "#a8987a", line: "#3a3220", card: "#181612", link: "#f2c14e", soft: "#2a2414", head: "#f8e7b0" } },
  "paper:royal": { name: "Royal Archive", desc: "November 2026's members' page: crimson and gold, yours forever.", price: MEMBER(NOV), p: { bg: "#3b0d16", fg: "#f6e8dc", muted: "#d2a99a", line: "#5e1d29", card: "#45111c", link: "#ffcf5a", soft: "#5a1a26", head: "#ffe3a1" } },
  // ── links ──
  "links:classic": { name: "Blue ink", desc: "Plain encyclopedia blue.", p: null },
  "links:highlighter": { name: "Highlighter", desc: "Every link marked in yellow.", price: D(2), p: { style: "highlighter" } },
  "links:redpen": { name: "Red pen", desc: "Teacher's red, underlined twice.", price: D(2), p: { style: "redpen" } },
  "links:mint": { name: "Mint", desc: "Cool green with a soft underline.", price: D(2), p: { style: "mint" } },
  "links:neon": { name: "Neon", desc: "Links that glow.", price: D(4), p: { style: "neon" } },
  "links:rainbow": { name: "Rainbow", desc: "A moving rainbow through every link. Diamonds only.", price: DIA(10), p: { style: "rainbow" } },
  "links:diamond": { name: "Diamond", desc: "Icy links with a shimmer, while you're a member.", price: MEMBER(), p: { style: "diamond" } },
  // ── avatars ──
  "avatar:reader": { name: "Reader", desc: "Your first letter.", p: { glyph: "", bg: "" } },
  "avatar:owl": { name: "Night Owl", desc: "For late-night reading.", price: D(2), p: { glyph: "🦉", bg: "#5b4a8a" } },
  "avatar:fox": { name: "Quick Fox", desc: "Jumps over lazy dogs.", price: D(2), p: { glyph: "🦊", bg: "#d9692a" } },
  "avatar:octopus": { name: "Octopus", desc: "Eight arms, eight tabs.", price: D(4), p: { glyph: "🐙", bg: "#c4416b" } },
  "avatar:rocket": { name: "Rocket", desc: "Straight to the target.", price: D(4), p: { glyph: "🚀", bg: "#1d3fd0" } },
  "avatar:wizard": { name: "Archivist", desc: "Knows every page.", price: D(8), p: { glyph: "🧙", bg: "#3a2a6e" } },
  "avatar:dragon": { name: "Dragon", desc: "Hoards facts. Diamonds only.", price: DIA(10), p: { glyph: "🐉", bg: "#128a4f" } },
  "avatar:unicorn": { name: "Unicorn", desc: "Rare as a two-click route. Diamonds only.", price: DIA(12), p: { glyph: "🦄", bg: "#b04ad1" } },
  "avatar:crown": { name: "SirSC Royalty", desc: "The members' crown, while you're a member.", price: MEMBER(), p: { glyph: "👑", bg: "#1e3a8a" } },
  // ── finishes ──
  "finale:confetti": { name: "Confetti", desc: "The classic paper burst.", p: { fx: "confetti" } },
  "finale:inkburst": { name: "Ink burst", desc: "Splashes of ink across the page.", price: D(6), p: { fx: "ink" } },
  "finale:paperplanes": { name: "Paper planes", desc: "A flock of folded pages.", price: D(6), p: { fx: "planes" } },
  "finale:fireworks": { name: "Fireworks", desc: "Rockets over the article.", price: D(8), p: { fx: "fireworks" } },
  "finale:stars": { name: "Shooting stars", desc: "Gold stars falling all over.", price: D(8), p: { fx: "stars" } },
  "finale:supernova": { name: "Supernova", desc: "The page explodes in light. Diamonds only.", price: DIA(20), p: { fx: "supernova" } },
  "finale:diamond": { name: "Diamond rain", desc: "SirSC Diamonds pour down, while you're a member.", price: MEMBER(), p: { fx: "diamond" } },
  // ── clicks ──
  "spark:ring": { name: "Ring", desc: "A quiet ring where you click.", p: { fx: "ring", c: ["#1d3fd0"] } },
  "spark:ink": { name: "Ink drop", desc: "A little splash of ink.", price: D(2), p: { fx: "dots", c: ["#14130f", "#1d3fd0"] } },
  "spark:confetti": { name: "Pop", desc: "A pinch of confetti on every click.", price: D(2), p: { fx: "dots", c: ["#ffd23f", "#e4472b", "#1d3fd0"] } },
  "spark:stars": { name: "Stars", desc: "Tiny gold stars.", price: D(4), p: { fx: "stars", c: ["#ffd23f", "#f59e0b"] } },
  "spark:bubbles": { name: "Bubbles", desc: "Soap bubbles that float up.", price: D(4), p: { fx: "bubbles", c: ["#7fd8ff", "#c4b5fd"] } },
  "spark:lightning": { name: "Lightning", desc: "A crack of electric blue. Diamonds only.", price: DIA(10), p: { fx: "bolts", c: ["#19f5e4", "#7fd8ff"] } },
  "spark:goldleaf": { name: "Gold leaf", desc: "Flakes of gold. Diamonds only.", price: DIA(12), p: { fx: "flakes", c: ["#f2c14e", "#ffe7a3", "#c98a12"] } },
};

/** The catalog rows (the server's copy wins when it answers). */
export const WKD_CATALOG = Object.entries(COSMETICS)
  .filter(([, c]) => c.price)
  .map(([item_id, c]) => ({ item_id, coins: c.price.coins || null, diamonds: c.price.diamonds || null, member_only: Boolean(c.price.member_only), claim_from: c.price.claim_from || null, claim_until: c.price.claim_until || null }));

export function cosmeticOf(item) {
  const c = COSMETICS[item];
  const [kind, id] = item.split(":");
  return c ? { item, kind, id, ...c } : { item, kind, id, name: id, desc: "", p: null };
}

export const isFree = (item) => {
  const [kind, id] = item.split(":");
  return DEFAULT_LOOK[kind] === id;
};

/** Items of one kind, the free one first. */
export function itemsOf(kind) {
  return [`${kind}:${DEFAULT_LOOK[kind]}`, ...WKD_CATALOG.filter((c) => c.item_id.startsWith(kind + ":")).map((c) => c.item_id)];
}
