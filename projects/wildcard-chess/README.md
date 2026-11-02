# Wildcard Chess

Chess against the computer, with a twist: both armies start with the normal sixteen pieces **plus one or more wildcards**, dealt at random from 30 custom pieces. You know what your wildcard does. You can see your opponent's wildcard and its name, but not its rules; you find out by watching it, and it is revealed when the game ends.

Plain HTML, CSS and JavaScript with no build step and no dependencies. Open `index.html` in a browser, or serve the folder with `python3 -m http.server`.

## Screens

| Screen | What's on it |
| --- | --- |
| Main menu | The logo, a tilted 3D board playing a live exhibition match between two random wildcards, and Play, Codex, How it works and a sound toggle. |
| Pick your opponent | Easy, Medium, Pro and Xtreme, plus play as White / Random / Black and 1–3 wildcards each. |
| The deal | Your wildcard cards flip up with their rules; theirs flip up showing only the piece, its name and a question mark. One reroll of your own hand. |
| Game | The wooden board with player bars (wildcard chips, captured pieces, material), a sidebar with your wildcard rules, their wildcards marked unknown, the move log, and Undo / Flip / Resign / Menu. |
| Codex | All 30 wildcards. One unlocks when you play with it or when a game against it ends; each shows a sample board of its moves from d4. A checkbox shows the undiscovered ones. |

## Difficulty

| Level | Search | Extras |
| --- | --- | --- |
| Easy | 1 move ahead, lots of noise, 20% random blunders | Take-backs |
| Medium | 2 moves ahead plus captures, light noise | Take-backs |
| Pro | 4 moves deep plus captures, 2.4 s | Take-backs |
| Xtreme | Iterative deepening up to 8 plies in 4 s | Gets **one extra wildcard**, no take-backs |

The AI runs in a Web Worker built from `ChessEngine.toString()`, so the page stays responsive while it thinks (it falls back to the main thread if workers are unavailable).

## The 30 wildcards

Each side's wildcards start on its third rank (White's rank 3, Black's rank 6). Pawns can promote into your own wildcard types.

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
