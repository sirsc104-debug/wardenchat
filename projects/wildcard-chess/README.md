# Wildcard Chess

Chess against the computer or a friend on the same device, with a twist: each army gets one or more **wildcards**, dealt at random from 55 custom pieces (5 of them rare legendaries), and each wildcard takes the place of one of its regular pieces (anything but the king). You know what your wildcard does. You can see your opponent's wildcard and its name, but not its rules; you find out by watching it, and it is revealed when the game ends.

Plain HTML, CSS and JavaScript with no build step and no dependencies. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

## Screens

| Screen | What's on it |
| --- | --- |
| Main menu | A letter-by-letter animated logo with a travelling glint, rising embers, floating wildcard cards that flip to new pieces, a tilted 3D board playing a live exhibition match, and three modes (Play, Draft, Pass & Play) plus Codex, Rules and a sound toggle that slide in. |
| Pick your opponent | vs Computer (Easy, Medium, Pro, Xtreme; play as White / Random / Black) or Pass & Play (privacy screen and board flipping on or off), with 1–3 wildcards each. |
| The deal | Your wildcard cards flip up with their rules and which of your pieces they replace; theirs show only the piece, its name, what it replaces and a question mark. One reroll of your own hand. In Pass & Play each player is dealt in private behind a pass-the-device screen. |
| Game | The wooden board with player bars (wildcard chips, captured pieces, material), a sidebar with your wildcard rules, their wildcards marked unknown, the move log, and Undo / Flip / Resign / Menu. |
| Codex | All 55 wildcards. One unlocks when you play with it or when a game against it ends; each shows a sample board of its moves from d4. A checkbox shows the undiscovered ones. |

## Difficulty

| Level | Search | Extras |
| --- | --- | --- |
| Easy | 1 move ahead, lots of noise, 20% random blunders | Take-backs |
| Medium | 2 moves ahead plus captures, light noise | Take-backs |
| Pro | 4 moves deep plus captures, 2.4 s | Take-backs |
| Xtreme | Iterative deepening up to 8 plies in 4 s | Gets **one extra wildcard**, no take-backs |

The AI runs in a Web Worker built from `ChessEngine.toString()`, so the page stays responsive while it thinks (it falls back to the main thread if workers are unavailable).

## The 55 wildcards

Each wildcard replaces a random regular piece from its own army: any pawn, knight, bishop, rook or the queen, but never the king (replacing a rook also gives up castling on that side). At the start of the game the board shows the normal setup, then each replaced piece bursts and its wildcard appears. Pawns can promote into your own wildcard types.

| Wildcard | Rules |
| --- | --- |
| Bomber | Steps 1. Capturing makes it explode, destroying every piece in the 3×3 around the target, itself included. Never blows up its own king. |
| Phantom | Rook lines of any length, passing through pieces. |
| Blink | Steps 1, or teleports to any empty square (no capture), then recharges for two turns. |
| Trickster | Steps 1, or swaps with any friendly piece within 2 squares. |
| Archer | Steps 1 without capturing; shoots an enemy exactly 2 or 3 squares away in a straight line without moving. |
| Necromancer | Up to 2 diagonally. Twice per game, raises your most recently lost piece on an adjacent empty square. |
| Frost Warden | Steps 1. Adjacent enemies (not kings) are frozen and can't move. |
| Wyvern | Knight jump, with an optional second jump if the first landing is empty. |
| Hopper | Hops over the first piece in any line, landing just beyond it. |
| Serpent | Up to 3 orthogonal steps through empty squares, turning corners. |
| Ricochet | Bishop that bounces off the board edge once. |
| Orbit | Rook whose lines wrap around the board edges. |
| Juggernaut | Charges 1–3 squares orthogonally, crushing every enemy in its path. |
| Cannon | Rook moves; captures by firing over exactly one screen piece. |
| Tempest | Steps 1, or blows every adjacent enemy one square away; off the board means destroyed (kings hold on). |
| Mimic | Steps 1, plus the moves of every adjacent piece. |
| Siren | Up to 2 diagonally. Once per game, charms an adjacent enemy (not king or queen) to your side. |
| Guardian | Steps 1. Adjacent friendly pieces can't be captured. |
| Golem | Steps 1 orthogonally. Only pawns and kings can capture it. |
| Phoenix | Up to 2 in any direction. Reborn once on its starting square when captured. |
| Viper | Knight jump. Whatever captures it by moving onto its square dies too. |
| Broodmother | Steps 1, or lays a pawn on an adjacent square (3-turn cooldown). |
| Chronomancer | Steps 1 or up to 3 diagonally. Its first capture grants an extra turn. |
| Mason | Steps 1, or raises a stone wall up to 2 away (blocks everything, lasts 4 turns, 2 at most). |
| Vampire | Steps 1. Gains knight moves after one kill, queen moves after two. |
| Marauder | Diagonal steps; captures by checkers-style jumps, chaining up to 4. |
| Hexer | Up to 2 orthogonally. Once per game, turns an enemy piece within 2 (not king or pawn) into a pawn. |
| Catapult | Steps 1, or flings an adjacent friendly piece 2 squares past it on the far side, capturing there. |
| Assassin | Knight jump; captures without moving (strike and return). |
| Void | Steps 1. Enemy pieces (not kings) that end their move next to it are destroyed. |
| Magnet | Steps 1, or pulls the nearest enemy (not a king) along each rank and file one square closer. |
| Berserker | Steps 1, and can chain up to 3 captures in one turn, each next to the last. |
| Comet | Flies any distance forward or diagonally forward over pieces; steps 1 sideways or back. |
| Kangaroo | Leaps exactly 2 squares in any straight line, over anything. |
| Tesla Coil | Steps 1, or destroys every adjacent enemy pawn. |
| Drummer | Steps 1, or every one of your pawns with a free square ahead advances at once (3-turn rest). |
| Sniper | Steps 1 orthogonally; every few turns shoots the first enemy along a diagonal, 2+ squares away. |
| Amoeba | Steps 1. Once per game, splits into two Amoebas. |
| Changeling | Steps 1 or knight jump; becomes whatever non-pawn piece it captures. |
| Monk | Up to 3 in any direction; never captures and can't be captured (blasts spare it too). |
| Alchemist | Steps 1. Twice per game, turns an adjacent friendly pawn into a knight or bishop. |
| Displacer | Steps 1, or swaps with an enemy (not a king) a knight's jump away. |
| Oracle | Steps 1. While it lives, you can read the rules of every enemy wildcard. |
| Zombie | Steps 1, or turns an adjacent enemy pawn, knight or bishop into your pawn (2-turn rest). |
| Chameleon | Rook moves from a light square, knight moves from a dark square. |
| Warlord | Steps 1. Your pawns next to it can also step or capture one square in any direction. |
| Cyclops | Steps 1; every few turns its forward eye-beam destroys the first piece on its file, either colour (never your king). |
| Gorgon | Steps 1; every few turns petrifies the first enemy (not a king) in any line for 3 turns. |
| Grappler | Steps 1, or hooks the first enemy 2–4 squares away in a line and drags it adjacent. |
| Echo | Up to 2 diagonally; its first three moves each leave a new pawn behind. |
| **Elder Dragon** (legendary) | Queen and knight moves; every capture also burns the enemy pawns next to the target. |
| **Archangel** (legendary) | Queen moves; only a king can capture it. |
| **Time Lord** (legendary) | Queen moves; every capture gives an extra turn (not chaining inside an extra turn). |
| **Black Hole** (legendary) | Up to 2 in any direction; devours every enemy (not a king) next to where it lands. |
| **Storm King** (legendary) | Steps 1; every other turn, lightning destroys the first enemy (not a king) in any line, at any range. |

Legendary wildcards are animated (flame, wings and halo, turning clock hands, a swirling disk, flickering lightning), wear a prismatic ring on the board and a Legendary tag on cards and in the Codex, and are rare: each wildcard dealt (classic deal, draft cards and online setups) is legendary with probability 0.05.

## The draft

Pick **Draft** on the main menu (or **Deal: Draft** on the setup screen; it works against the computer and in Pass & Play) to build both armies from nothing:

- There are 16 pairs of cards, mostly standard pieces: about one card in five is a wildcard (roughly 3 or 4 per army), the rest are pawns, knights, bishops, rooks and the odd queen. One pair, at a random point, is always **King vs King**, so each side ends with exactly one king.
- Each player chooses from 8 pairs. The card you take joins your army; the one you leave goes to your opponent. So each army is 16 pieces: your 8 picks plus the 8 your opponent passed over. Four bishops and a Cyclops where the pawns usually stand is entirely possible.
- **Both armies stay face down** while you draft, your own picks included: every card lands as a **?** tile. When the last pair is decided, you go straight to the board, where all 32 pieces are dealt face down on their squares and flip one at a time, alternating sides, over about 10 seconds (wildcards sparkle as they turn). Hover tips, the sidebar's wildcard list, the wildcard chips and the material count stay hidden until the reveal is done. *Skip* on the board jumps to the end, and the game begins.
- Against the computer you alternate picks (a coin flip decides who goes first) and never see the pairs it was offered. In Pass & Play, White makes 8 private picks, then the device goes to Black for theirs.
- Every card offered to you can be read, so you know the rules of each wildcard you passed to your opponent (marked *seen in draft*), but not the ones they picked for themselves.
- Armies are laid out automatically and **can't be rearranged**: king on its own square (e1 or e8), rooks in the corners, queen on d1, knights and bishops in their usual spots, pawns across the front, anything else where it fits. The game starts as soon as the reveal ends.
- Xtreme's extra wildcard applies to the classic deal only.

## Pass & Play

Two players on one device. The deal is done in private: White sees their own cards while Black looks away, then the device is passed and Black sees theirs. During the game the sidebar and tooltips only explain the wildcards of the player whose turn it is. After each move a **privacy screen** covers everything until the next player taps *Ready*, and the board can **flip** to face whoever is moving (both can be switched off in setup). Undo takes back one move. When the game ends, both sides' wildcards are revealed and added to the Codex.

## Fog Mode

Pick **Fog Mode** on the menu, or switch **Fog of war** on in setup (it works against the computer, in Pass & Play, with the draft and online). Each side sees only the squares its pieces stand on and the squares next to them; everything else is drifting fog, and enemy pieces fade out of sight as they enter it and back in as they leave it.

- **No check.** Nobody tells you your king is attacked; you win by capturing the enemy king (*King down!*). A move that would destroy your own king is the only illegal one (`fogMoves` in the engine).
- **Move hints only use what you can see**, so they never reveal a hidden piece. If something hidden blocks your move you're told and pick again; land on a hidden enemy and you capture it by surprise.
- **Nothing leaks:** the opponent's moves you couldn't see show in the log as *moved somewhere in the fog* or *captured your Knight from the fog*; effects, toasts and hover tips only appear for squares you can see; the material count is hidden. When the game ends the fog lifts.
- **The computer plays fair:** it searches the position as its own pieces see it, and its move is matched to the real board.
- In Pass & Play the privacy screen is always on in the fog, and each player sees their own fog.

## Online

**Online** on the menu: create a game and get a 5-letter code to send a friend, who joins with it (Warden Chat sign-in required). The server deals both sides' wildcards (no one picks their own, 5% legendary each) and keeps the moves in order; each device's engine checks every move it receives and stops the game if one doesn't fit. Moves travel by polling every 1.5 s. Wildcard rules stay private as against the computer, Fog Mode works online, a player gone for over two minutes can be claimed against, there are no take-backs, and online games don't earn coins yet.

The back end is specified in [`docs/ONLINE-WCC.md`](docs/ONLINE-WCC.md), with a self-contained Codex prompt in [`docs/CODEX-PROMPT-ONLINE-WCC.md`](docs/CODEX-PROMPT-ONLINE-WCC.md). Until it exists the Online screen says it isn't switched on yet. The `--wallet-demo` build includes a pretend server with a friend called Rook_Rival who joins your game a few seconds after you create it (or hosts one when you type any code) and plays back.

## Coins, diamonds, membership and the Shop

Wildcard Chess uses the **SirSC wallet** that Downhill Death Run already uses (`docs/ECONOMY-API.md` in `sirsc104-debug/claude`): the same Warden Chat accounts, 🪙 coins, 💎 diamonds (1 💎 = 5,000 coins) and 👑 SirSC Membership, through the same `sirsc_*` functions with `game = 'wcc'`. What this game adds on the server is in [`docs/ECONOMY-WCC.md`](docs/ECONOMY-WCC.md), with a ready-to-paste Codex prompt in [`docs/CODEX-PROMPT-WCC.md`](docs/CODEX-PROMPT-WCC.md): `wcc_ping`, `wcc_reward` and the `wcc` catalog rows.

**Earning coins** (games against the computer only; the server works every number out):

| | Easy | Medium | Pro | Xtreme |
|---|---|---|---|---|
| Win | 500 | 1,000 | 2,000 | 4,000 |
| Draw (30%) | 150 | 300 | 600 | 1,200 |
| Loss (10%) | 50 | 100 | 200 | 400 |

×1.25 for a drafted army, ×1.5 for members, +1,500 for the first win of each day, and +500 for every wildcard the account has never been paid for (lifetime, at most 25,000, outside the daily cap). **Daily limit: 25,000 coins** from Wildcard Chess (inside the wallet-wide 300,000). A game needs at least 12 plies and 30 seconds to pay; at most 20 paid games an hour. Pass & Play pays nothing, since one account would be playing both sides.

**The Shop** (menu → Shop, or the account chip) sells cosmetics only, never an advantage: 8 board themes (Club Walnut free; Marble Hall and Ebony & Ivory 15,000 🪙 / 4 💎; Emerald Felt and Frozen Lake 22,500 / 6; Neon Arcade 12 💎 and Haunted Manor 15 💎 only), 6 card backs (used by the deal, the draft tiles and the face-down reveal), and 5 checkmate finales (Fireworks, Inferno and Deep Freeze 30,000 / 8; Supernova 20 💎). Clicking an item previews it on the Shop's board; buying equips it. Equipping is remembered per device and only counts for things the account owns.

**Members** get 1.5× coins, 5 💎 a month, the SirSC Diamond badge by their name, that month's members' board to keep (November 2026: Royal Velvet) and the SirSC Diamond card back. The Diamonds tab sends SirSC a "please add my diamonds" request after paying in person, as in Downhill Death Run.

**Until the server has `wcc_ping`**, accounts stay hidden and the game works exactly as before. `python3 build-artifact.py OUT.html --wallet-demo` adds a pretend back end (`js/wallet-mock.js`, labelled "Demo wallet" in the game) so the whole thing can be tried now: any username and password, 40,000 coins and 10 diamonds to start, and a button to try membership.

## Check and checkmate

When a king is in check, every piece threatening it glows red, its square pulses, and a red arrow runs from it to the king; the status line names it ("Check by the Bomber on d5"). Indirect threats count too: a Bomber that could blow up a piece next to the king, or the piece a Catapult could fling onto it. A "Check!" stamp slams onto the board as the king shakes and the board's edges flash red.

Checkmate gets a finale before the result card: a deep gong, the board darkens around the losing king, the king topples over in a shockwave of sparks, and a "Checkmate" banner lands. A king destroyed outright gets "King down!", and draws get a quieter stamp. The log marks mate with #.

## Rules notes

- A game is won by checkmate or by destroying the enemy king outright (explosions, charges, arrows and so on). Your own move can never leave your king attackable or get it killed.
- Draws: stalemate, 50 moves without a capture or pawn move, threefold repetition, bare kings.

## Files

```
index.html          page shell and screens
css/style.css       all styling
js/art.js           SVG piece art, wildcard names, descriptions and accent colours
js/engine.js        rules for every piece, legality, evaluation and the alpha-beta AI (worker-safe)
js/fx.js            board particle effects and synthesized sound
js/board.js         the board view: procedural wood, piece sprites, highlights
js/game.js          screens, the deal, input, game flow, log, Codex, exhibition match
js/cosmetics.js     board themes, card backs, finales, the wcc catalog, and what this device has equipped
js/wallet.js        Warden Chat sign-in and the SirSC wallet (sirsc_* and wcc_* functions)
js/wallet-mock.js   a pretend wallet back end, only in --wallet-demo builds
js/shop.js          the account chip, sign-in, the Shop and the coins shown after a game
js/online.js        online play: creating and joining games by code, sending and receiving moves
docs/ECONOMY-WCC.md the back-end contract for Wildcard Chess on the SirSC wallet
docs/ONLINE-WCC.md  the back-end contract for online play
build-artifact.py   bundles everything into one HTML file
dist/               the single-file build
```

Rebuild the single file with `python3 build-artifact.py dist/wildcard-chess.html --standalone`.

Progress (Codex discoveries and your last settings) is kept in the browser's `localStorage`.
