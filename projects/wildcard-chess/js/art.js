/* Wildcard Chess: piece artwork and wildcard catalogue.
   Every piece is drawn in a 100x100 box in the flat, thick-outlined style of a wooden club set:
   a light body with a soft shade down its right side. Wildcards share one pedestal and carry a
   coloured accent so they stand out from the standard army. */
'use strict';

const INK = { w: '#3b3a38', b: '#222120' };

/* Tokens inside the art strings:
   {B} body shape, {D} outline-only detail, {K} solid ink, {A} accent fill, {S} accent stroke,
   {C} body-coloured stroke (for coils and tubes), {O} thick ink stroke under a {C}. */
function tokens(color, accent) {
  const ink = INK[color];
  const grad = color === 'w' ? 'url(#gW)' : 'url(#gB)';
  return {
    B: `fill="${grad}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round"`,
    D: `fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`,
    K: `fill="${ink}"`,
    A: `fill="${accent}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"`,
    S: `fill="none" stroke="${accent}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"`,
    C: `fill="none" stroke="${grad}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`,
    O: `fill="none" stroke="${ink}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"`,
    L: `fill="none" stroke="${ink}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"`,
  };
}

const PED = '<rect {B} x="22" y="81" width="56" height="11" rx="5.5"/>' +
  '<path {B} d="M35 82 C37 72 41 66 42 61 H58 C59 66 63 72 65 82 Z"/>' +
  '<rect {B} x="33" y="54" width="34" height="8" rx="4"/>';

const STD_ART = {
  P: '<rect {B} x="22" y="80" width="56" height="12" rx="6"/>' +
     '<path {B} d="M34 81 C36 68 41 60 43 54 H57 C59 60 64 68 66 81 Z"/>' +
     '<rect {B} x="35" y="47" width="30" height="9" rx="4.5"/>' +
     '<circle {B} cx="50" cy="33" r="13"/>',
  R: '<rect {B} x="18" y="81" width="64" height="11" rx="5.5"/>' +
     '<rect {B} x="25" y="72" width="50" height="10" rx="3"/>' +
     '<path {B} d="M31 72 L34 44 H66 L69 72 Z"/>' +
     '<path {B} d="M27 40 V19 H37 V26 H45 V19 H55 V26 H63 V19 H73 V40 Z"/>' +
     '<rect {B} x="26" y="37" width="48" height="8" rx="2"/>',
  N: '<rect {B} x="20" y="81" width="62" height="11" rx="5.5"/>' +
     '<rect {B} x="28" y="73" width="48" height="9" rx="3"/>' +
     '<path {B} d="M71 74 C74 60 77 44 71 31 C67 24 61 20 57 19 L59 8 L50 15 C42 15 34 21 30 29 L20 47 C18 52 20 57 25 58 C30 59 34 56 38 54 C42 54 44 57 45 60 C40 65 34 69 33 74 Z"/>' +
     '<path {D} d="M63 25 C70 36 71 52 67 68"/>' +
     '<circle {K} cx="41" cy="31" r="3.4"/>' +
     '<circle {K} cx="24.5" cy="51.5" r="2"/>',
  B: '<rect {B} x="22" y="80" width="56" height="12" rx="6"/>' +
     '<path {B} d="M36 81 C38 74 42 70 43 66 H57 C58 70 62 74 64 81 Z"/>' +
     '<rect {B} x="34" y="59" width="32" height="8" rx="4"/>' +
     '<path {B} d="M50 11 C36 22 30 37 34 49 C36 56 42 60 50 60 C58 60 64 56 66 49 C69 39 65 30 59 23 L51 37 L47 34 L55 19 C53 16 52 13 50 11 Z"/>',
  Q: '<rect {B} x="18" y="81" width="64" height="11" rx="5.5"/>' +
     '<rect {B} x="26" y="71" width="48" height="10" rx="4"/>' +
     '<path {B} d="M28 72 L18 37 L32 55 L34 30 L43 52 L50 25 L57 52 L66 30 L68 55 L82 37 L72 72 Z"/>' +
     '<circle {B} cx="18" cy="33" r="5.5"/><circle {B} cx="34" cy="26" r="5.5"/><circle {B} cx="50" cy="20" r="5.5"/>' +
     '<circle {B} cx="66" cy="26" r="5.5"/><circle {B} cx="82" cy="33" r="5.5"/>',
  K: '<rect {B} x="18" y="81" width="64" height="11" rx="5.5"/>' +
     '<rect {B} x="26" y="71" width="48" height="10" rx="4"/>' +
     '<path {B} d="M28 72 C15 60 16 43 30 40 C40 38 47 45 50 53 C53 45 60 38 70 40 C84 43 85 60 72 72 Z"/>' +
     '<path {B} d="M50 54 C45 45 45 37 50 32 C55 37 55 45 50 54 Z"/>' +
     '<path {B} d="M46 9 H54 V15 H60 V22 H54 V32 H46 V22 H40 V15 H46 Z"/>',
  WALL: '',
};

/* The 30 wildcards. `desc` is what the owner sees; the opponent only ever sees the icon and name. */
const WILD = {
  bomber: { name: 'Bomber', accent: '#ff9a2e', moves: 'Steps 1 square',
    desc: 'Steps one square in any direction. When it captures, it explodes: every piece in the 3×3 blast around the target is destroyed, friend or foe, the Bomber included. Kings are not safe, but it will never blow up its own.',
    art: '<circle {B} cx="50" cy="37" r="17"/><rect {B} x="43" y="15" width="14" height="8" rx="2"/>' +
         '<path {D} d="M50 15 C50 9 56 6 61 9"/><path {D} d="M40 32 C41 28 44 25 47 24" opacity=".5"/>' +
         '<path {A} d="M65 2 L67 7 L72 7 L68 10.5 L70 15.5 L65 12.5 L60 15.5 L62 10.5 L58 7 L63 7 Z"/>' },
  phantom: { name: 'Phantom', accent: '#5fe0ff', moves: 'Any distance along ranks and files',
    desc: 'Glides any distance along ranks and files, passing straight through every piece in its way. Captures wherever it lands.',
    art: '<path {B} d="M33 57 V31 C33 11 67 11 67 31 V57 L61 51 L55.5 57 L50 51 L44.5 57 L39 51 Z"/>' +
         '<ellipse {A} cx="43" cy="31" rx="4.2" ry="6.2"/><ellipse {A} cx="57" cy="31" rx="4.2" ry="6.2"/>' +
         '<path {D} d="M45 43 C48 45 52 45 55 43"/>' },
  blink: { name: 'Blink', accent: '#b57bff', moves: 'Steps 1, or teleports',
    desc: 'Steps one square, or teleports to any empty square on the board. After a teleport it needs two turns to recharge. It cannot capture by teleporting.',
    art: '<circle {B} cx="50" cy="34" r="19"/>' +
         '<path {S} d="M50 34 C50 30 55 30 55 34 C55 40 44 40 44 34 C44 26 60 26 60 34 C60 44 39 44 39 33 C39 23 48 18 56 19"/>' },
  trickster: { name: 'Trickster', accent: '#ffcf3f', moves: 'Steps 1, or swaps',
    desc: 'Steps one square, or swaps places with any friendly piece up to two squares away, the king included.',
    art: '<path {B} d="M31 56 C31 46 34 40 38 36 C32 31 26 28 19 28 C27 21 36 23 42 29 C42 21 46 14 50 10 C54 14 58 21 58 29 C64 23 73 21 81 28 C74 28 68 31 62 36 C66 40 69 46 69 56 Z"/>' +
         '<path {D} d="M35 47 H65"/>' +
         '<circle {A} cx="18" cy="28" r="5"/><circle {A} cx="50" cy="9" r="5"/><circle {A} cx="82" cy="28" r="5"/>' },
  archer: { name: 'Archer', accent: '#ff5a4a', moves: 'Steps 1, shoots 2–3 away',
    desc: 'Steps one square but never captures by moving. Instead it shoots: it removes an enemy exactly 2 or 3 squares away in a straight line, firing over anything in between, without moving.',
    art: '<path {B} d="M38 10 C66 16 66 52 38 58 L40 53 C58 47 58 21 40 15 Z"/>' +
         '<path {D} d="M39 12.5 V55.5"/>' +
         '<path {L} d="M24 34 H66"/><path {D} d="M25 34 L20 29 M25 34 L20 39 M29 34 L24 29 M29 34 L24 39"/>' +
         '<path {A} d="M64 27 L76 34 L64 41 Z"/>' },
  necro: { name: 'Necromancer', accent: '#6dff8a', moves: 'Up to 2 diagonally',
    desc: 'Moves up to two squares diagonally. Twice per game, instead of moving, it raises your most recently lost piece back to life on an adjacent empty square.',
    art: '<path {B} d="M32 33 C32 17 40 9 50 9 C60 9 68 17 68 33 C68 41 65 45 62 47 V56 H38 V47 C35 45 32 41 32 33 Z"/>' +
         '<circle {A} cx="42" cy="32" r="5.6"/><circle {A} cx="58" cy="32" r="5.6"/>' +
         '<path {K} d="M50 38 L46.5 45 H53.5 Z"/><path {D} d="M44 49 V56 M50 49 V56 M56 49 V56"/>' },
  frost: { name: 'Frost Warden', accent: '#9fe6ff', moves: 'Steps 1 square',
    desc: 'Steps one square in any direction. Enemy pieces standing next to it are frozen solid and cannot move or capture. Kings are immune.',
    art: '<path {B} d="M41 32 L29 26 L27 47 L38 56 Z"/><path {B} d="M59 32 L71 26 L73 47 L62 56 Z"/>' +
         '<path {A} d="M50 5 L62 21 L59 50 L50 57 L41 50 L38 21 Z"/><path {D} d="M50 5 V57 M38 21 L50 29 L62 21"/>' },
  wyvern: { name: 'Wyvern', accent: '#ff4a3d', moves: 'Knight jump, twice',
    desc: 'Jumps like a knight, and can jump a second time in the same turn if its first landing square is empty.',
    art: '<path {B} d="M64 57 C69 45 71 34 67 26 L78 11 L62 19 C58 15 52 13 46 15 L39 8 L39 18 C33 21 27 27 21 31 L19 38 C25 40 31 39 36 38 L26 46 C32 48 40 47 46 43 C46 49 42 53 38 57 Z"/>' +
         '<circle {A} cx="48" cy="26" r="3.8"/><circle {K} cx="24.5" cy="33" r="1.8"/>' +
         '<path {D} d="M67 35 L74 37 M67 43 L74 46 M66 51 L72 54"/>' },
  hopper: { name: 'Hopper', accent: '#8ee34a', moves: 'Hops over pieces',
    desc: 'Moves along any straight line, but only by hopping over the first piece in its way and landing right behind it. Captures if it lands on an enemy.',
    art: '<path {O} d="M37 53 L63 47 L37 40 L63 34 L37 27"/><path {C} d="M37 53 L63 47 L37 40 L63 34 L37 27"/>' +
         '<ellipse {B} cx="50" cy="20" rx="19" ry="7.5"/><circle {A} cx="50" cy="13" r="6"/>' },
  serpent: { name: 'Serpent', accent: '#ff4d6d', moves: 'Up to 3 steps, turning',
    desc: 'Slithers up to three steps along ranks and files, turning corners as it goes, through empty squares. Captures at the end of its path.',
    art: '<path {O} d="M30 54 C20 50 26 40 42 40 C60 40 66 31 58 24 C53 20 46 21 43 25"/><path {C} d="M30 54 C20 50 26 40 42 40 C60 40 66 31 58 24 C53 20 46 21 43 25"/>' +
         '<ellipse {B} cx="38" cy="22" rx="11" ry="8"/><circle {K} cx="35" cy="20" r="2.2"/>' +
         '<path d="M27 24 L20 25 M20 25 L16 22 M20 25 L16 28" fill="none" stroke="{acc}" stroke-width="2.6" stroke-linecap="round"/>' },
  ricochet: { name: 'Ricochet', accent: '#ffd23f', moves: 'Diagonals that bounce',
    desc: 'Slides diagonally like a bishop and bounces off the edge of the board once, carrying on at a new angle.',
    art: '<path {B} d="M50 7 L73 32 L50 57 L27 32 Z"/>' +
         '<path {S} d="M36 42 L45 25 L54 39 L61 26"/><path {A} d="M57 23 L66 19 L65 29 Z"/>' },
  orbit: { name: 'Orbit', accent: '#5fa8ff', moves: 'Rook lines that wrap around',
    desc: 'Slides like a rook, but the board wraps around: leave one edge and it comes back in on the opposite side.',
    art: '<path d="M24 41.4 A27 8.5 -16 0 1 76 26.6" {L}/><path d="M24 41.4 A27 8.5 -16 0 1 76 26.6" {S}/>' +
         '<circle {B} cx="50" cy="33" r="15"/>' +
         '<path d="M24 41.4 A27 8.5 -16 0 0 76 26.6" {L}/><path d="M24 41.4 A27 8.5 -16 0 0 76 26.6" {S}/>' },
  juggernaut: { name: 'Juggernaut', accent: '#e07b39', moves: 'Charges 1–3 straight',
    desc: 'Charges one to three squares along a rank or file, flattening every enemy piece in its path. It stops in front of friendly pieces.',
    art: '<path {B} d="M31 31 C20 29 14 19 16 8 C22 16 28 18 35 20 Z"/><path {B} d="M69 31 C80 29 86 19 84 8 C78 16 72 18 65 20 Z"/>' +
         '<path {B} d="M30 56 V32 C30 18 40 12 50 12 C60 12 70 18 70 32 V56 Z"/>' +
         '<rect {A} x="30" y="25" width="40" height="6" rx="1"/>' +
         '<path {K} d="M36 35 H64 V41 H54 V53 H46 V41 H36 Z"/>' },
  cannon: { name: 'Cannon', accent: '#ff6b3d', moves: 'Rook moves, fires over a screen',
    desc: 'Moves like a rook without capturing. It captures by firing over exactly one piece of either colour to hit the first enemy beyond it, at any range.',
    art: '<path {B} d="M33 49 L59 15 C62 11 69 15 66 20 L45 54 Z"/><path {D} d="M56 19 L64 25"/>' +
         '<circle {B} cx="40" cy="47" r="11"/><path {D} d="M40 38 V56 M31 47 H49"/><circle {K} cx="40" cy="47" r="3"/>' +
         '<path {A} d="M70 6 L72 11 L77 11 L73 14 L75 19 L70 16 L65 19 L67 14 L63 11 L68 11 Z"/>' },
  tempest: { name: 'Tempest', accent: '#8fd3ff', moves: 'Steps 1, or blows a gust',
    desc: 'Steps one square. Or, instead of moving, it unleashes a gust that blows every adjacent enemy one square away. Enemies blown off the board are destroyed; kings just hold on.',
    art: '<path {B} d="M23 13 H77 C75 20 69 24 62 26 C66 30 62 36 56 38 C58 43 54 48 50 50 C48 54 46 56 44 57 C46 53 46 49 44 47 C40 45 40 41 42 38 C36 34 36 30 40 28 C30 24 25 20 23 13 Z"/>' +
         '<path {S} d="M30 17 C44 22 60 22 70 17"/><path {S} d="M39 29 C46 32 55 32 61 29"/><path {S} d="M45 39 C48 41 51 41 54 39"/>' },
  mimic: { name: 'Mimic', accent: '#c77dff', moves: 'Borrows its neighbours’ moves',
    desc: 'Steps one square, and also borrows the moves of every piece standing next to it, friend or foe.',
    art: '<path {B} d="M29 13 C40 8 60 8 71 13 C73 34 65 52 50 57 C35 52 27 34 29 13 Z"/>' +
         '<path {K} d="M36 27 C39 23 45 23 47 27 C45 31 39 31 36 27 Z"/><path {K} d="M64 27 C61 23 55 23 53 27 C55 31 61 31 64 27 Z"/>' +
         '<path {K} d="M39 41 C45 48 55 48 61 41 C56 45 44 45 39 41 Z"/>' +
         '<path {A} d="M34 35 L37.5 31 L41 35 L37.5 39 Z"/><path {A} d="M59 35 L62.5 31 L66 35 L62.5 39 Z"/>' },
  siren: { name: 'Siren', accent: '#ff8fc8', moves: 'Up to 2 diagonally',
    desc: 'Moves up to two squares diagonally. Once per game, it sings to an adjacent enemy that isn’t a king or queen and turns it to your side.',
    art: '<path {B} d="M50 56 L23 30 C25 18 37 9 50 9 C63 9 75 18 77 30 Z"/>' +
         '<path {D} d="M50 54 L32 21 M50 54 L41 13 M50 54 V10 M50 54 L59 13 M50 54 L68 21"/>' +
         '<circle {A} cx="50" cy="44" r="6"/>' },
  guardian: { name: 'Guardian', accent: '#ffcc4d', moves: 'Steps 1 square',
    desc: 'Steps one square in any direction. Friendly pieces next to it cannot be captured. The Guardian itself can.',
    art: '<path {B} d="M29 11 H71 V30 C71 44 63 52 50 58 C37 52 29 44 29 30 Z"/>' +
         '<path {A} d="M46 17 H54 V27 H63 V35 H54 V49 H46 V35 H37 V27 H46 Z"/>' },
  golem: { name: 'Golem', accent: '#ffb020', moves: 'Steps 1 along ranks and files',
    desc: 'Steps one square along a rank or file. It is made of stone: only pawns and kings can capture it.',
    art: '<path {B} d="M29 56 V20 L36 11 H64 L71 20 V56 Z"/><path {D} d="M29 26 H71"/>' +
         '<rect {A} x="36" y="30" width="10" height="6"/><rect {A} x="54" y="30" width="10" height="6"/>' +
         '<path {D} d="M42 47 H58 M61 11 L56 19 L60 23 M35 44 L41 48 L39 56"/>' },
  phoenix: { name: 'Phoenix', accent: '#ff7a1a', moves: 'Up to 2 in any direction',
    desc: 'Moves up to two squares in any direction. The first time it is captured, it is reborn on its starting square, if that square is empty.',
    art: '<path {B} d="M50 57 C33 55 23 42 25 25 C29 31 33 33 38 33 C34 23 36 13 44 7 C44 17 48 23 50 25 C52 23 56 17 56 7 C64 13 66 23 62 33 C67 33 71 31 75 25 C77 42 67 55 50 57 Z"/>' +
         '<path {A} d="M50 52 C42 50 38 44 40 36 C44 40 46 40 48 38 C46 32 48 26 50 21 C52 26 54 32 52 38 C54 40 56 40 60 36 C62 44 58 50 50 52 Z"/>' },
  viper: { name: 'Viper', accent: '#7dff6a', moves: 'Knight jump',
    desc: 'Jumps like a knight. Its venom is lethal: any piece that captures it by moving onto its square dies too. Kings won’t touch it.',
    art: '<path {B} d="M38 57 C40 48 30 42 28 30 C26 17 38 9 50 9 C62 9 74 17 72 30 C70 42 60 48 62 57 Z"/>' +
         '<path {A} d="M50 29 C44 33 44 41 50 46 C56 41 56 33 50 29 Z"/>' +
         '<path {K} d="M38 23 C41 20 45 21 46 24 C43 25 40 25 38 23 Z"/><path {K} d="M62 23 C59 20 55 21 54 24 C57 25 60 25 62 23 Z"/>' },
  brood: { name: 'Broodmother', accent: '#ff3b3b', moves: 'Steps 1, lays pawns',
    desc: 'Steps one square. Instead of moving, it can lay a new pawn on an adjacent empty square, then needs three turns to recover.',
    art: '<path {L} d="M42 31 L28 20 L21 30 M42 37 L24 36 L17 46 M43 43 L29 49 L26 57 M58 31 L72 20 L79 30 M58 37 L76 36 L83 46 M57 43 L71 49 L74 57"/>' +
         '<ellipse {B} cx="50" cy="41" rx="13" ry="15"/><circle {B} cx="50" cy="20" r="8.5"/>' +
         '<path {A} d="M45.5 34 H54.5 L50 41 L54.5 48 H45.5 L50 41 Z"/>' },
  chrono: { name: 'Chronomancer', accent: '#ffc94a', moves: 'Steps 1, or up to 3 diagonally',
    desc: 'Steps one square, or slides up to three squares diagonally. The first time it captures, time bends and you immediately take another turn.',
    art: '<path {B} d="M35 14 H65 C65 28 54 30 54 34 C54 38 65 40 65 53 H35 C35 40 46 38 46 34 C46 30 35 28 35 14 Z"/>' +
         '<path {A} d="M40 19 H60 C58 25 52 28 50 31 C48 28 42 25 40 19 Z"/><path {A} d="M38 51 C40 44 46 42 50 40 C54 42 60 44 62 51 Z"/>' +
         '<rect {B} x="29" y="8" width="42" height="7" rx="3"/><rect {B} x="29" y="51" width="42" height="7" rx="3"/>' },
  mason: { name: 'Mason', accent: '#e2774a', moves: 'Steps 1, builds walls',
    desc: 'Steps one square. Instead of moving, it raises a stone wall on an empty square up to two away in a straight line. Walls block everything, cannot be captured, and crumble after four turns. Two walls at most.',
    art: '<rect {B} x="25" y="42" width="24" height="13" rx="1.5"/><rect {B} x="51" y="42" width="24" height="13" rx="1.5"/>' +
         '<rect {B} x="37" y="28" width="26" height="13" rx="1.5"/><rect {A} x="41" y="14" width="18" height="13" rx="1.5"/>' },
  vampire: { name: 'Vampire', accent: '#ff3048', moves: 'Steps 1, grows with kills',
    desc: 'Steps one square. It grows stronger with every kill: after its first capture it can also jump like a knight, and after its second it can also slide like a queen.',
    art: '<path {B} d="M50 25 C40 22 30 18 15 22 C19 26 22 31 22 37 C26 34 30 34 34 39 C36 35 40 35 44 39 C46 35 48 33 50 33 C52 33 54 35 56 39 C60 35 64 35 66 39 C70 34 74 34 78 37 C78 31 81 26 85 22 C70 18 60 22 50 25 Z"/>' +
         '<ellipse {B} cx="50" cy="42" rx="7.5" ry="13"/>' +
         '<path {B} d="M50 27 C45 27 43 23 43 19 L45 11 L48 16.5 H52 L55 11 L57 19 C57 23 55 27 50 27 Z"/>' +
         '<circle fill="{acc}" cx="47.2" cy="20" r="1.9"/><circle fill="{acc}" cx="52.8" cy="20" r="1.9"/>' },
  marauder: { name: 'Marauder', accent: '#ffd84a', moves: 'Diagonal steps, checker jumps',
    desc: 'Steps one square diagonally but captures like a checker: it jumps over an adjacent enemy diagonally to the empty square beyond, and can chain several jumps in one turn.',
    art: '<path {B} d="M30 46 V52 A20 7 0 0 0 70 52 V46"/><ellipse {B} cx="50" cy="46" rx="20" ry="7"/>' +
         '<path {B} d="M30 34 V40 A20 7 0 0 0 70 40 V34"/><ellipse {B} cx="50" cy="34" rx="20" ry="7"/><ellipse {D} cx="50" cy="34" rx="12" ry="3.8"/>' +
         '<path {A} d="M38 29 L35 12 L44 19 L50 8 L56 19 L65 12 L62 29 Z"/>' },
  hexer: { name: 'Hexer', accent: '#a96bff', moves: 'Up to 2 along ranks and files',
    desc: 'Moves up to two squares along ranks and files. Once per game, it curses an enemy piece within two squares (not a king or pawn) and turns it into a pawn.',
    art: '<path {B} d="M36 57 C36 48 40 45 44 45 H56 C60 45 64 48 64 57 Z"/>' +
         '<circle {A} cx="50" cy="28" r="17"/>' +
         '<path d="M41 20 C43 16 47 14.5 51 14.5 C47 16.5 45 18.5 44 22 Z" fill="#fff" opacity=".7"/>' +
         '<path {B} d="M37 48 C34 42 34 37 37 32 C39 38 42 42 46 45 Z"/><path {B} d="M63 48 C66 42 66 37 63 32 C61 38 58 42 54 45 Z"/>' },
  catapult: { name: 'Catapult', accent: '#c9a27a', moves: 'Steps 1, flings friends',
    desc: 'Steps one square. Or it flings an adjacent friendly piece over itself, landing two squares out on the far side and capturing any enemy that is there.',
    art: '<path {B} d="M40 46 L50 22 L60 46 H54 L50 35 L46 46 Z"/>' +
         '<path {B} d="M27 42 L68 15 L72 20 L31 47 Z"/><path {B} d="M62 13 C62 5 79 3 81 11 Z"/>' +
         '<rect {B} x="22" y="45" width="56" height="10" rx="2"/><circle {A} cx="71" cy="5.5" r="5"/>' },
  assassin: { name: 'Assassin', accent: '#ff2d55', moves: 'Knight jump, hit and run',
    desc: 'Jumps like a knight. When it captures, it strikes and returns: the target is removed but the Assassin stays where it was.',
    art: '<path {B} d="M50 6 C38 14 30 28 30 44 C30 50 32 54 34 57 H66 C68 54 70 50 70 44 C70 28 62 14 50 6 Z"/>' +
         '<path {K} d="M38 44 C38 32 44 24 50 24 C56 24 62 32 62 44 C58 48 42 48 38 44 Z"/>' +
         '<path fill="{acc}" d="M41 35 L48 37.5 L41 39 Z"/><path fill="{acc}" d="M59 35 L52 37.5 L59 39 Z"/>' },
  void: { name: 'Void', accent: '#c084fc', moves: 'Steps 1 square',
    desc: 'Steps one square in any direction. Enemy pieces that end their move next to it are pulled in and destroyed. Kings are immune.',
    art: '<path d="M22 33 A28 9 -14 0 1 78 31" {L}/><path d="M22 33 A28 9 -14 0 1 78 31" {S}/>' +
         '<circle {B} cx="50" cy="32" r="16"/><circle cx="50" cy="32" r="10" fill="#0c0a10"/>' +
         '<circle cx="50" cy="32" r="10" fill="none" stroke="{acc}" stroke-width="1.6" opacity=".9"/>' +
         '<path d="M22 33 A28 9 -14 0 0 78 31" {L}/><path d="M22 33 A28 9 -14 0 0 78 31" {S}/>' },
};

const WILD_IDS = Object.keys(WILD);

const STD_NAMES = { P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King', WALL: 'Stone wall' };
const STD_DESC = {
  P: 'Moves forward one square (two from its starting square) and captures diagonally. Promotes on the last rank, including into your wildcard.',
  N: 'Jumps in an L: two squares one way, one square to the side.',
  B: 'Slides any distance diagonally.',
  R: 'Slides any distance along ranks and files.',
  Q: 'Slides any distance in any direction.',
  K: 'Steps one square in any direction. Lose it and you lose the game, whether it is checkmated, blown up or flattened.',
  WALL: 'A stone wall raised by a Mason. It blocks every piece and crumbles after four turns.',
};

function pieceName(t) { return WILD[t] ? WILD[t].name : STD_NAMES[t]; }

const WALL_ART = '<rect x="12" y="20" width="76" height="70" rx="5" fill="#8d8476" stroke="#2c2925" stroke-width="3.2"/>' +
  '<path d="M12 43 H88 M12 66 H88 M38 20 V43 M64 20 V43 M26 43 V66 M52 43 V66 M76 43 V66 M38 66 V90 M64 66 V90" stroke="#2c2925" stroke-width="2.6" fill="none"/>' +
  '<path d="M14 22 H86" stroke="#b3aa9b" stroke-width="2" opacity=".8"/><path d="M58 47 L54 55 L58 60" stroke="#2c2925" stroke-width="2" fill="none"/>';

const SVG_CACHE = new Map();
function pieceSVG(type, color) {
  const key = type + color;
  if (SVG_CACHE.has(key)) return SVG_CACHE.get(key);
  let body;
  if (type === 'WALL') body = WALL_ART;
  else {
    const w = WILD[type];
    const acc = w ? w.accent : '#fff';
    const tk = tokens(color, acc);
    const src = w ? PED + w.art : STD_ART[type];
    body = src.replace(/\{([BDKASCOL])\}/g, (_, k) => tk[k]).replace(/\{acc\}/g, acc);
  }
  const svg = `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
  SVG_CACHE.set(key, svg);
  return svg;
}

/* Gradient definitions the pieces fill with. Injected once into the document. */
function installPieceDefs() {
  if (document.getElementById('piece-defs')) return;
  const d = document.createElement('div');
  d.innerHTML = '<svg id="piece-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<linearGradient id="gW" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".58" stop-color="#f3f2f0"/><stop offset=".58" stop-color="#dcdad6"/><stop offset="1" stop-color="#cfccc7"/></linearGradient>' +
    '<linearGradient id="gB" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#6d6b68"/><stop offset=".58" stop-color="#5d5b58"/><stop offset=".58" stop-color="#4b4946"/><stop offset="1" stop-color="#42403d"/></linearGradient>' +
    '</defs></svg>';
  document.body.appendChild(d.firstChild);
}
