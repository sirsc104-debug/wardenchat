# Wildcard Chess

Chess against the computer or a friend on the same device, with a twist: each army gets one or more **wildcards**, dealt at random from 50 custom pieces, and each wildcard takes the place of one of its regular pieces (anything but the king). You know what your wildcard does. You can see your opponent's wildcard and its name, but not its rules; you find out by watching it, and it is revealed when the game ends.

Plain HTML, CSS and JavaScript with no build step and no dependencies. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

## Screens

| Screen | What's on it |
| --- | --- |
| Main menu | A letter-by-letter animated logo with a travelling glint, rising embers, floating wildcard cards that flip to new pieces, a tilted 3D board playing a live exhibition match, and three modes (Play, Draft, Pass & Play) plus Codex, Rules and a sound toggle that slide in. |
| Pick your opponent | vs Computer (Easy, Medium, Pro, Xtreme; play as White / Random / Black) or Pass & Play (privacy screen and board flipping on or off), with 1–3 wildcards each. |
| The deal | Your wildcard cards flip up with their rules and which of your pieces they replace; theirs show only the piece, its name, what it replaces and a question mark. One reroll of your own hand. In Pass & Play each player is dealt in private behind a pass-the-device screen. |
| Game | The wooden board with player bars (wildcard chips, captured pieces, material), a sidebar with your wildcard rules, their wildcards marked unknown, the move log, and Undo / Flip / Resign / Menu. |
| Codex | All 50 wildcards. One unlocks when you play with it or when a game against it ends; each shows a sample board of its moves from d4. A checkbox shows the undiscovered ones. |

## Difficulty

| Level | Search | Extras |
| --- | --- | --- |
| Easy | 1 move ahead, lots of noise, 20% random blunders | Take-backs |
| Medium | 2 moves ahead plus captures, light noise | Take-backs |
| Pro | 4 moves deep plus captures, 2.4 s | Take-backs |
| Xtreme | Iterative deepening up to 8 plies in 4 s | Gets **one extra wildcard**, no take-backs |

The AI runs in a Web Worker built from `ChessEngine.toString()`, so the page stays responsive while it thinks (it falls back to the main thread if workers are unavailable).

## The 50 wildcards

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

## The draft

Pick **Draft** on the main menu (or **Deal: Draft** on the setup screen; it works against the computer and in Pass & Play) to build both armies from nothing:

- There are 16 pairs of cards, drawn from the standard pieces and the 50 wildcards. One pair, at a random point, is always **King vs King**, so each side ends with exactly one king.
- Each player chooses from 8 pairs. The card you take joins your army; the one you leave goes to your opponent. So each army is 16 pieces: your 8 picks plus the 8 your opponent passed over. Four bishops and a Cyclops where the pawns usually stand is entirely possible.
- The cards your opponent passes to you arrive **face down**: you can't see what you were given until the draft ends, when they flip over just before the game starts.
- Against the computer you alternate picks (a coin flip decides who goes first) and never see the pairs it was offered. In Pass & Play, White makes 8 private picks, then the device goes to Black for theirs.
- Every card offered to you can be read, so you know the rules of each wildcard you passed to your opponent (marked *seen in draft*), but not the ones they picked for themselves.
- Armies are laid out automatically (king on e1, rooks in the corners, queen on d1, knights and bishops in their usual spots, pawns across the front, anything else where it fits). Before the game, each player taps two of their pieces to swap them, as often as they like, then taps **Ready**. The king always starts on its own square (e1 or e8) and can't be swapped.
- Xtreme's extra wildcard applies to the classic deal only.

## Pass & Play

Two players on one device. The deal is done in private: White sees their own cards while Black looks away, then the device is passed and Black sees theirs. During the game the sidebar and tooltips only explain the wildcards of the player whose turn it is. After each move a **privacy screen** covers everything until the next player taps *Ready*, and the board can **flip** to face whoever is moving (both can be switched off in setup). Undo takes back one move. When the game ends, both sides' wildcards are revealed and added to the Codex.

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
build-artifact.py   bundles everything into one HTML file
dist/               the single-file build
```

Rebuild the single file with `python3 build-artifact.py dist/wildcard-chess.html --standalone`.

Progress (Codex discoveries and your last settings) is kept in the browser's `localStorage`.
