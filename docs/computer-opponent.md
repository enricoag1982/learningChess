# Computer Opponent — Chess for Kids

Related: [domain-model.md](domain-model.md), [architecture.md](architecture.md).

## 1. Goals

| Goal | Measure |
|---|---|
| Kid wins often, not always | Kid win rate 60–70% at the suggested level |
| Human-like mistakes | Low levels leave pieces unprotected and miss captures, so the kid practises taking them |
| No frustration | No early queen raids at low levels; no resignation (kid practises mating) |
| Smooth on tablets | Move computed ≤ 300 ms, in a background worker |
| Testable | Seeded randomness → same position + seed = same move |

## 2. How a move is chosen

For every move, the level's profile picks one of three modes:

| Mode | Behaviour | Effect |
|---|---|---|
| `random` | Any legal move | Misses captures, wanders |
| `shallow` | Best move looking 1 move ahead, ignoring kid's reply | Takes free pieces but leaves its own unprotected |
| `search` | Minimax (alpha-beta) at level depth; picks among top moves with some randomness | Plays sensibly |

Evaluation: material (P1 N3 B3 R5 Q9) + simple bonuses (centre, development, king safety, pawn advance). Level 5 adds a capture-sequence check at the end of the search.

**Opening book:** before the mode roll, a level with `book: true` (Fox/Wolf/Bear) checks
`packages/content/bot-book.yaml` — e4/d4 main lines, ≤ 6 plies, both colours (a line is a shared
move sequence; whoever is to move at a given ply plays it, not "White's" or "Black's" book).
`domain/bot/book.ts`'s `bookCandidates` matches the game's own SAN history so far against every
line's prefix, offers each matching line's next move (deduped, and only if it is still legal in the
current position — defensive, in case a non-standard start coincides with a prefix by pure text
accident), and `bookMove` picks uniformly among them with the seeded `Random`. `chooseMove` takes
the compiled book as an optional parameter (kept out of `domain`'s own dependencies — `apps/web`'s
bot worker/in-thread fallback import `@chess-kids/content/bot-book.json` and pass it in) so a
forced mate-in-1 (`alwaysMateInOne`) still always wins outright, book or not. `pnpm build`
(`packages/content/src/bot-book-load.ts`, its own module — not `lesson-load.ts`) checks every
line is legal, ≤ 6 plies, and that its authored SAN matches chess.js's own SAN, failing the build
otherwise.

## 3. Levels

| Level | Name | `random` | `shallow` | `search` depth | Always plays mate in 1 | Opening | Unlock |
|---|---|---|---|---|---|---|---|
| 1 | Mouse | 50% | 50% | — | No | No book; queen stays home first 5 moves | World 4 boss |
| 2 | Rabbit | 25% | 50% | 2 (25%) | Yes | Same as Mouse | World 5 boss |
| 3 | Fox | 10% | 20% | 2 (70%) | Yes | Small book (e4/d4 main lines); queen stays home first 5 moves | Openings boss, or beat Rabbit 3× |
| 4 | Wolf | 5% | 5% | 3 (90%) | Yes | Small book | Beat Fox 3× |
| 5 | Bear | 0% | 0% | 4 + capture check | Yes | Small book | Beat Wolf 3× |

All values in `packages/core/src/domain/bot/levels.ts` (`BOT_LEVELS`) — plain TS, not a content
file; `BotLevel` (`level`, `name`, `random`, `shallow`, `depth`, `searchShare`, `alwaysMateInOne`,
`queenHomeMoves`, `book`, `aids`) is domain-layer data.

**Unlock:** `computerLevelStatus(records, journey)` (`packages/core/src/app/games.ts`) computes
each level's lock state for the Play screen's vs Computer card. Mouse: unlocked once World 4
("check") is mastered (`app-structure.md` §7). Every level above it unlocks with 3 full-game wins
vs the level right below (Rabbit vs Mouse, Fox vs Rabbit, Wolf vs Fox, Bear vs Wolf) — *or*, once
there is already any recorded full-game win directly against that level itself, it stays unlocked
regardless of that count (covers a world boss fought directly at a level before the tally catches
up) — winning World 4's own `first-game` boss already works this way for Mouse/Rabbit (it is a
full-game win vs Mouse, one of Rabbit's 3).

## 4. Kid aids per level

| Aid | Mouse / Rabbit | Fox | Wolf / Bear |
|---|---|---|---|
| Take back | Unlimited | 3 per game | None |
| Danger highlight (own unprotected attacked pieces) | On | Off by default (optional) | Off |
| Legal-move dots | On | On | On (default; parent override later) |

Parent settings can override each aid; only the default is implemented (`BotLevel.aids`,
`packages/core/src/domain/bot/levels.ts` — read by `VersusStep.tsx`'s `aidsForLevel`), no parent
settings screen for it yet.

## 5. Automatic level

- Default parent setting: `Automatic`.
- After each game vs computer, look at the last 5 games at that level:
  - ≥ 4 wins → suggest next level (Owl: "Ready for the Fox?"), only if that level is unlocked.
  - ≤ 1 win → drop one level silently.
- Never skips more than one level at a time.
- Computed only once 5 full games have actually been played at that level (`nextSuggestedLevel`,
  `packages/core/src/app/games.ts`) — a single early result cannot swing it either way.
- Stored per profile in `AppSettings.suggestedLevels` (device-wide settings, keyed by profile id);
  `suggestedLevel` (same module) is what the Play screen's chips actually default to: the stored
  suggestion if it still names an unlocked level, else the highest level already unlocked (a fresh
  profile, or one that has not played 5 games at any level yet, has no stored suggestion at all).

## 6. Game flow

- Move shown after 0.8–1.5 s (so the kid sees it; 0.3 s under reduced motion), with animation.
- Computer never resigns.
- No progress after 60 kid moves (e.g. kid can't finish the mate) → Owl offers a hint toward mate:
  a tap runs `mateHint(state, rules)` (`packages/core/src/domain/bot/hint.ts`) — a depth-2 search
  for the kid's own side, no randomness — and highlights the returned move's piece and target
  square on the board (`Board`'s existing `highlights.hint` ring). Cleared on the next move, take
  back, or "Play again".
- Draws (stalemate, insufficient material, threefold repetition, 50-move rule — all already
  detected in `domain/game/rules.ts`'s `gameResult`) show a draw screen with Owl explaining which
  one (`VersusState.endReason`, a second line under the generic "It's a draw!" text).
- Leave (Play's full-game screen only): a "Stop game?" confirm; confirming ends the game
  without playing it out, saved as `abandoned` — never a loss.
- Result saved as a `GameRecord` (`id`, `game`: `'full'` for a full game — including World 4's own
  `first-game` boss, which *is* a full game — or a `versus` mini-game's own content id otherwise;
  `opponent: computer:<level>`; `result`: `win` / `loss` / `draw` / `abandoned`; `reason`: the draw
  reason above, `checkmate`, or `left`; `moves`: SAN). `recordGame`/`loadGameRecords`
  (`packages/core/src/app/games.ts`) and the `GameRecordRepository` port persist it (localStorage
  adapter: `apps/web/src/adapters/storage/local-game-record-repository.ts`, schema v3).

## 6.5 Bear speed

All in `packages/core/src/domain/bot/search.ts`, **Bear only**: a transposition table keyed by
`SearchBoard.hash()` (chess.js's own incrementally-maintained Zobrist hash), with the standard
mate-score ply adjustment on store/probe; killer moves (quiet moves that caused a beta cutoff at
the same ply, tried early); MVV capture ordering; quiescence (captures only, depth-capped at 4
plies) at the leaves in place of a single static evaluation; iterative deepening with a 250 ms
budget, checked roughly every 256 visited nodes, unwinding cleanly back to the last depth that
fully completed. Every depth actually *used* is a complete, exact alpha-beta pass, so the move
stays a deterministic function of the position and seed; only *how many* depths complete can vary
with machine load.

**Scoped to Bear only** (`chooseMove`/`chooseBySearch` gate `tt`/`killers`/`quiesce` on
`level.level === 5`): the transposition table and killer moves also reorder equally-scored quiet
moves at the other levels' own (unhurried) depths without changing alpha-beta's returned value,
which measurably shifted Fox's own endgame conversion rate for no benefit — reverted for every
level but Bear. Bear's own near-best margin (`nearBestMargin`) is tighter than the other levels'
(0.05 vs 0.3).

Measured (this machine; CI/real devices vary): p50 ≈ 270-295 ms / p95 ≈ 300-330 ms on a
10-position middlegame reference set — within the ≤ 300 ms (local) / ≤ 600 ms (CI) test bounds
(`search.test.ts`). **Known limitation:** a wide-open, still-quiet position (few captures, most
legal moves scoring near-identically under this deliberately simple `staticEval`) is the worst
case for alpha-beta's branching factor; Bear's 250 ms budget often falls back to depth 2-3 there
instead of a genuinely complete depth 4, weaker than intended in exactly that phase.

## 6.6 Bear strength (roadmap F4)

Also Bear only (`bear !== undefined` gates each, same reasoning as §6.5's `tt`/`killers`/`quiesce`):
null-move pruning (`negamax`'s `tryNullMove`, standard `R = 2` reduction), late move reductions (a
quiet move ordered late in `orderMoves` is searched one ply shallower first, re-searched at full
depth only if that still beats `alpha`: `LMR_MIN_DEPTH = 3`, `LMR_FULL_MOVE_COUNT = 3`,
`LMR_REDUCTION = 1`), and a history heuristic (`HistoryTable`, keyed by colour + from + to,
weighted by `depth²`, reused as `orderMoves`'s tiebreak below captures/TT/killers at any ply).

**Measured** (`pnpm --filter @chess-kids/core calibrate 30 bear`, same seeds before/after): bear vs
wolf **13.3% → 20.0%** (6/30 wins) — a real ≈ 1.5× gain, still well short of the ≥ 70% target
(§8). Speed unaffected (p50/p95 stay in §6.5's range); `fox vs rabbit`/`wolf vs fox` unchanged.
Richer eval (mobility, king safety, passed pawns) is the next lever not yet tried (§9).

## 7. Mini-games and exercises

| Use | Opponent |
|---|---|
| Mini-games with `opponent: { bot: n }` | Same engine, variant rules (no kings, custom win) |
| Mini-games with `static` enemies | No moves |
| Exercises (`mate-in-n`, scripted lines) | Fixed replies from content, no engine |

## 8. Tests

| Test | Check |
|---|---|
| Legality | 10,000 random positions: every move legal (standard + variants) |
| Tactics | Fox+: takes a free queen; Rabbit+: plays mate in 1; Fox+: stops kid's mate in 1 |
| Determinism | Same position + seed → same move (Bear's own case, `search.test.ts`, given §6.5's mid-search time cap) |
| Performance | Bear ≤ 300 ms per move (p50) / ≤ 600 ms (p95, CI) on a 10-position reference set |
| Book | `bookCandidates`/`bookMove` (`book.test.ts`): prefix matching, ply cap, dedup, determinism; `chooseMove` wiring (`search.test.ts`) |
| Calibration (manual, not in CI) | `pnpm --filter @chess-kids/core calibrate [games] [level]` (default 40 games, every pairing): self-play, each level vs the previous, target ≥ 70% win rate; the optional 3rd arg filters to one pairing by its higher level's name (`calibrate 30 bear`, a quick smoke check while tuning one level). Not a nightly job (no CI schedule wired up) |
| Mate hint | `mateHint` returns a legal move for the side to move; finds a mate-in-1 when one exists; `null` only with no legal move at all |

## 9. Later

- **Game review:** after a game, Owl shows up to 3 key moments (material swing ≥ 3), e.g. "Here the Horse could take the Rook".
- **Bear strength (§6.6, roadmap F4 — still open):** 13.3% → 20.0% bear-vs-wolf, still well
  short of 70%. Likely next levers, in order of expected payoff for the effort: a richer
  `staticEval` for Bear only (mobility, king safety, passed pawns — the one option from F4's own
  list not yet tried); isolating each of null-move/LMR/history's own individual contribution (§6.6
  measured them together only, for time); wider opening-book coverage so fewer games ever leave it
  in the first place. The calibration script (§8, `calibrate 30 bear` for a faster read on this one
  pairing) is how to check progress on any of them.
