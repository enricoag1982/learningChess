# Curriculum — Lesson List

Related: [teaching-process.md](teaching-process.md), [domain-model.md](domain-model.md).

- Each lesson: story → demo → 2 guided tries → exercises → boss.
- Exercise counts exclude guided tries and easier variants.
- Source: **A** = authored, **L** = imported from Lichess puzzle database (CC0) by theme.
- Structure: **Basics** (main road, worlds 1–5, fixed order) → 3 **tracks** (Openings, Tactics, Checkmates & Endgames), unlocked after Basics, any order. Strategy track later.
- Exercise types: `sel` select-squares · `star` collect-stars · `cap` capture · `yn` yes-no · `ch` choice · `best` best-move · `mate` mate-in-n · `set` setup.

## Basics (main road)

### World 1 — Board (Meadow)

| # | Lesson | Concept | Content | Types | Ex. | Src | Boss |
|---|---|---|---|---|---|---|---|
| 1 | Squares | `board-squares` | Light/dark squares; light square bottom-right | sel, yn | 5 | A | — |
| 2 | Lines | `board-lines` | Rows, columns, diagonals | sel | 6 | A | Square Hunt |
| 3 | Setup | `board-setup` | Starting position; queen on her colour | set | 5 | A | Setup Race |

### World 2 — Pieces (Savannah)

| # | Lesson | Concept | Content | Types | Ex. | Src | Boss |
|---|---|---|---|---|---|---|---|
| 4 | Rook (Rhino) | `rook-move` | Straight lines, any distance; capture | star, sel, cap | 8 | A | Hungry Rook |
| 5 | Bishop (Elephant) | `bishop-move` | Diagonals; stays on one colour; capture | star, sel, cap | 8 | A | Hungry Bishop |
| 6 | Queen (Lioness) | `queen-move` | Rook + bishop moves; capture | star, sel, cap | 8 | A | Hungry Queen |
| 7 | King (Lion) | `king-move` | One step; cannot go where it can be captured | star, sel | 6 | A | King Walk |
| 8 | Knight (Horse) | `knight-move` | L jump; jumps over pieces; capture | star, sel, cap | 8 | A | Knight Maze |
| 9 | Pawn (Caterpillar) | `pawn-move` | Forward only; double first step; diagonal capture; blocked | star, sel, cap | 8 | A | Pawn Wars (4 pawns) |
| 10 | Promotion | `promotion` | Last row → transform; choose piece | best, ch | 5 | A | Pawn Wars (8 pawns) |

### World 3 — Attack & Defence (Jungle)

| # | Lesson | Concept | Content | Types | Ex. | Src | Boss |
|---|---|---|---|---|---|---|---|
| 11 | Attack | `attack` | What a piece attacks; attack a piece with a move | sel, best | 8 | A | Queen vs Pawns |
| 12 | Defend | `defend` | Protect an attacked piece: move away, defend, block | best, yn | 8 | A | — |
| 13 | Safe or not? | `hanging-piece` | Spot unprotected attacked pieces; take free pieces | yn, best | 10 | A+L | Safe or Not? |
| 14 | Piece values | `piece-value` | P1 N3 B3 R5 Q9 | ch | 6 | A | — |
| 15 | Trades | `exchange` | Good / equal / bad trade | ch, best | 8 | A | Army Battle |
| — | World boss | — | — | — | — | — | Win the Queen |

### World 4 — Check & Mate (Mountains)

| # | Lesson | Concept | Content | Types | Ex. | Src | Boss |
|---|---|---|---|---|---|---|---|
| 16 | Check | `check` | Recognise check; give check | yn, best | 8 | A | — |
| 17 | Escape check | `check-escape` | Move king, block, capture attacker | sel, best | 10 | A | Escape the Check |
| 18 | Checkmate | `checkmate` | Check vs checkmate | yn | 8 | A | — |
| 19 | Mate in 1 | `mate-in-1` | Back rank, queen + king, two rooks | mate | 12 | A+L | Mate in 1 |
| 20 | Stalemate | `stalemate` | Recognise; avoid giving stalemate | yn, best | 6 | A | — |
| — | World boss | — | — | — | — | — | First full game vs computer L1 |

### World 5 — Full Rules (River)

| # | Lesson | Concept | Content | Types | Ex. | Src | Boss |
|---|---|---|---|---|---|---|---|
| 21 | Castling | `castling` | Conditions: pieces not moved, not in check, path free and not attacked | yn, best | 8 | A | — |
| 22 | En passant | `en-passant` | Capture right after double step | best, yn | 5 | A | — |
| 23 | Draws | `draw` | Stalemate recap, repetition, insufficient material; 50-move rule mentioned | yn, ch | 5 | A | — |
| — | World boss | — | — | — | — | — | Full game vs computer L2 |

## Tracks (after Basics)

### Openings (Forest)

| # | Lesson | Concept | Content | Types | Ex. | Src | Boss |
|---|---|---|---|---|---|---|---|
| 24 | Opening rules | `opening` | Centre pawns; develop knights and bishops; queen not early | best, ch | 8 | A | — |
| 25 | King safety | `king-safety` | Castle early; keep pawns in front of king | best, yn | 6 | A | — |
| 26 | Scholar's mate defence | `scholars-mate` | Queen + bishop attack on f7; defend it | best, yn | 6 | A | Full game vs computer L3 |

### Tactics (Ocean)

| # | Lesson | Concept | Content | Types | Ex. | Src | Boss |
|---|---|---|---|---|---|---|---|
| 27 | Safety check | `blunder-check` | Before moving: checks, captures, threats | best, yn | 8 | A+L | — |
| 28 | Fork | `fork` | Double attack; knight fork | best | 10 | L | — |
| 29 | Pin | `pin` | Piece cannot move without exposing a bigger one | best | 10 | L | — |
| 30 | Skewer | `skewer` | Attack through a big piece to the one behind | best | 8 | L | — |
| 31 | Discovered attack | `discovered-attack` | Moving one piece opens another's attack | best | 8 | L | Tactic streak |

### Checkmates & Endgames (Arctic)

| # | Lesson | Concept | Content | Types | Ex. | Src | Boss |
|---|---|---|---|---|---|---|---|
| 32 | Rook ladder | `mate-2r` | K + 2R vs K | best, mate | 6 | A | Lonely King (2R) |
| 33 | Queen mate | `mate-q` | K + Q vs K | best, mate | 6 | A | Lonely King (Q) |
| 34 | Rook mate | `mate-r` | K + R vs K | best, mate | 6 | A | Lonely King (R) |

Later: king + pawn endgames.

### Strategy (later)

Piece activity, pawn structure.

## Totals

| Scope | Content | Lessons | Exercises | Authored (approx.) |
|---|---|---|---|---|
| MVP | Basics (worlds 1–5) | 23 | 169 | ~160 |
| Full | Basics + 3 tracks | 34 | 251 | ~200 |

Guided tries (~2 per lesson) and easier variants add ~30% authoring.

## Mini-game catalogue

| Mini-game | Where | Setup | Win (kid) | Opponent |
|---|---|---|---|---|
| Square Hunt | 1 | Empty board | Tap all target squares | — |
| Setup Race | 1 | Pieces off board | Correct setup | — |
| Hungry Rook / Bishop / Queen | 2 | 1 piece vs enemy pieces | Capture all | static |
| King Walk | 2 | King + enemy pieces | Reach square without being capturable | static |
| Knight Maze | 2 | Knight + blocked squares | Reach target | — |
| Pawn Wars (4 / 8 pawns) | 2 | Pawns only | Promote or capture all | bot 1 |
| Queen vs Pawns | 3 | Q vs 8 pawns | Capture all pawns | bot 1 |
| Safe or Not? | 3 | Series of positions | 10 correct answers | — |
| Army Battle | 3 | Pawns + 1 piece type each, no kings | Capture all | bot 1 |
| Win the Queen | 3 | Full set, no kings | Capture the queen | bot 1 |
| Escape the Check | 4 | Series of check positions | 10 escapes | — |
| Mate in 1 | 4 | Series of positions | 10 mates | — |
| Lonely King | Endgames | K + Q / 2R / R vs K | Mate within move limit | bot |
| Tactic streak | Tactics | Series of tactic puzzles | 10 in a row | — |
