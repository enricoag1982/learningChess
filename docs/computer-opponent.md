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

**Opening book (M4.2):** before the mode roll, a level with `book: true` (Fox/Wolf/Bear) checks
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

All values in `packages/core/src/domain/bot/levels.ts` (`BOT_LEVELS`) — plain TS, not
`bot-levels.yaml`: no such content file exists in this codebase; `BotLevel` (`level`, `name`,
`random`, `shallow`, `depth`, `searchShare`, `alwaysMateInOne`, `queenHomeMoves`, `book`, `aids`) is
domain-layer data, and this doc's own §1 goal ("Testable") is met the same way either way — this
note replaces the earlier, inaccurate "content, tunable without code changes" one.

**Unlock (M3.5 + M4.2):** `computerLevelStatus(records, journey)` (`packages/core/src/app/games.ts`)
computes each level's lock state for the Play screen's vs Computer card. Mouse: unlocked once
World 4 ("check") is mastered (same rule the pre-M3.5 "Full game" button already used,
`app-structure.md` §7). Every level above it unlocks with 3 full-game wins vs the level right below
(Rabbit vs Mouse, Fox vs Rabbit, Wolf vs Fox, Bear vs Wolf) — *or*, once there is already any
recorded full-game win directly against that level itself, it stays unlocked regardless of that
count. That second path exists so a level fought directly before the strict tally catches up (a
world boss pitting the kid against it, or Fox's own Openings-world boss alternative once that
content exists — both content, not yet authored for Fox/Wolf/Bear as of M4.2) never shows "locked"
again afterwards — winning World 4's own `first-game` boss already works this way for Mouse/Rabbit
(it is a full-game win vs Mouse, one of Rabbit's 3).

## 4. Kid aids per level

| Aid | Mouse / Rabbit | Fox | Wolf / Bear |
|---|---|---|---|
| Take back | Unlimited | 3 per game | None |
| Danger highlight (own unprotected attacked pieces) | On | Off by default (optional) | Off |
| Legal-move dots | On | On | On (default; parent override later) |

Parent settings can override each aid; only the default is implemented as of M4.2 (`BotLevel.aids`,
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
- Leave (Play's full-game screen only, M3.5): a "Stop game?" confirm; confirming ends the game
  without playing it out, saved as `abandoned` — never a loss.
- Result saved as a `GameRecord` (`id`, `game`: `'full'` for a full game — including World 4's own
  `first-game` boss, which *is* a full game — or a `versus` mini-game's own content id otherwise;
  `opponent: computer:<level>`; `result`: `win` / `loss` / `draw` / `abandoned`; `reason`: the draw
  reason above, `checkmate`, or `left`; `moves`: SAN). `recordGame`/`loadGameRecords`
  (`packages/core/src/app/games.ts`) and the `GameRecordRepository` port persist it (localStorage
  adapter: `apps/web/src/adapters/storage/local-game-record-repository.ts`, schema v3).

## 6.5 Bear speed (M4.2)

`architecture.md` §11 flagged Bear (depth 4) at ≈ 0.5-1 s in Node vs the 300 ms target. Fixed by,
all in `packages/core/src/domain/bot/search.ts`, **Bear only** (see below for why): a
transposition table keyed by `SearchBoard.hash()` (chess.js's own incrementally-maintained Zobrist
hash — O(1) per `play`/`undo`, no FEN ever built in the hot loop), with the standard mate-score
ply adjustment on store/probe so a mate found through one transposition is not misapplied through
another; killer moves (quiet moves that caused a beta cutoff at the same ply, tried early); MVV
capture ordering; quiescence (captures only, depth-capped at 4 plies) at the leaves in place of a
single static evaluation, so a trade started right at the horizon is judged by where it settles;
and iterative deepening with a 250 ms budget, checked roughly every 256 visited nodes (not only
between depths — a single depth-4 pass can itself run for seconds) via a `SearchAborted` throw that
unwinds cleanly (every `board.play` is undone on the way out) back to the last depth that fully
completed. Every depth actually *used* is therefore a complete, exact alpha-beta pass — the move
picked stays a deterministic function of the position and seed; only *how many* depths a given
call completes can vary with machine load.

**Scoped to Bear only:** the transposition table and killer moves also reorder equally-scored quiet
moves at Rabbit/Fox/Wolf's own (unhurried, never over budget) depths — the *value* alpha-beta
returns is unaffected, but *which* tied move ends up in the near-best pool can shift, and doing so
measurably (if narrowly) changed Fox's own endgame conversion rate in `packages/content`'s
`first-game` winnability check (80% → 75% over 40 seeds) for no offsetting benefit, since those
levels were never the ones flagged as slow. Reverted for them; `chooseMove`/`chooseBySearch` gate
all three (`tt`, `killers`, `quiesce`) on `level.level === 5` (`negamax`'s own `useTt`). Bear's own
near-best margin (`nearBestMargin`) is also tighter than the other levels' (0.05 vs 0.3): calibration
(below) showed the shared 0.3 was far too loose once real Bear self-play was fast enough to test for
the first time — in one measured quiet position it swept in 25 of ~29 legal moves as "near-best",
outright bad ones included.

Measured (this machine; CI/real devices vary): before, p50 ≈ 1.85 s / p95 ≈ 4.1 s on a 10-position
middlegame reference set; after, p50 ≈ 270-295 ms / p95 ≈ 300-330 ms — the ≤ 300 ms(local) /
≤ 600 ms (CI) test bounds (`search.test.ts`, "Bear on the reference set") hold comfortably on that
set. **Known limitation:** those reference positions are past the opening; a wide-open, still-quiet
position (few captures, most legal moves scoring near-identically under this deliberately simple
`staticEval`) is the worst case for alpha-beta's branching factor, and Bear's 250 ms budget often
does not reach a genuinely complete depth 4 there — falling back gracefully to whatever depth (2-3)
did complete, by design, but weaker than intended in exactly that phase. The calibration script
(below) surfaced this as a real self-play weakness: `bear vs wolf`, 15 seeded games alternating
colours — 4/15 (26.7%, 11 losses, 0 draws) — well short of the ≥ 70% target, even after tightening
`nearBestMargin` for Bear. `fox vs rabbit` (93.3%) and `wolf vs fox` (86.7%) meet it comfortably;
`rabbit vs mouse` (40.0%, 0 losses, 9 draws) does not either, but for a different, lower-stakes
reason — Rabbit never *loses*, it just does not always convert a won position to checkmate within
the self-play move limit (150 full moves) against Mouse's wandering king, and a kid's own real games
never run anywhere near that long. Bear's shortfall is the real one: a bigger algorithmic change
(null-move pruning, a richer evaluation, or wider opening-book coverage so fewer games leave it)
would address it; out of scope for M4.2, left for a later iteration.

## 6.6 Bear strength (M5.4, roadmap F4)

Tried, in the order the roadmap's F4 entry suggested, all in `packages/core/src/domain/bot/search.ts`,
**Bear only** (`bear !== undefined` gates every one of them — see §6.5 above for why that scoping
matters: the same value-preserving-but-order-shifting effect that changed Fox's own conversion rate
in M4.2 applies to a new technique exactly the same way):

1. **Null-move pruning** — before searching a node's own moves, asks whether the opponent would
   still reach `beta` even after a free pass, at a reduced depth; a `no` prunes the whole subtree.
   Standard `R = 2` reduction (`negamax`'s `tryNullMove`). A first, small-sample self-play check
   (N = 10) looked like a regression next to a same-seed baseline run at the same N, which turned
   out to be small-sample noise: a further same-seed baseline check at that N came back identical
   (§6.5's own "worse than chance" `NEAR_BEST_MARGIN` finding was reached the same way, at a larger
   N — a reminder to size the sample before trusting a small one either way here). Kept.
2. **Late move reductions** — a quiet move ordered late in a node's own move list (`orderMoves` — TT
   move, captures, killers, then history score, next) is searched one ply shallower first,
   re-searched at full depth only if that still beats `alpha`. Kept: `LMR_MIN_DEPTH = 3`,
   `LMR_FULL_MOVE_COUNT = 3`, `LMR_REDUCTION = 1` (`negamax`).
3. **History heuristic** — a quiet move that caused a beta cutoff anywhere in one `chooseBySearch`
   call is remembered (`HistoryTable`, keyed by colour + from + to, weighted by `depth²`) and reused
   as `orderMoves`'s tiebreak below captures/TT/killers, at any ply, not only the one it cut off at
   (killer moves are ply-scoped; history is not). Kept.
4. **Richer eval** (mobility, king safety, passed pawns): not reached — 1-3 together already measured
   a real gain (below), and isolating each technique's own individual share of it would have cost
   another full N = 30 self-play run per technique (≈ 7 minutes each, this machine) on top of the
   ones already spent chasing the small-sample false alarm above; the milestone's time budget
   favoured a solid combined measurement over that. Left as the next thing to try if a later
   iteration revisits this (`§9`).

**Measured** (`pnpm --filter @chess-kids/core calibrate 30 bear`, this machine, 1-3 together vs a
same-seed baseline run of the unmodified pre-M5.4 code — taken purposely on identical seeds rather
than trust the older, smaller-sample M4.2 figure (§6.5's 26.7% over 15 seeds) at face value): bear
vs wolf **13.3% → 20.0%** (4/30 → 6/30 wins, 0 draws → 2 draws) — a real, roughly 1.5× improvement
over this same-seed baseline, still below M4.2's own 26.7%/15-seed figure and well short of the 70%
target either way. Per this milestone's own instructions, stopping here and reporting the numbers
rather than pushing further within this iteration's time budget. Speed is unaffected: `search.test.ts`'s
reference-set p50/p95 stay in the same range §6.5 already measured (this run: p50 ≈ 277 ms,
p95 ≈ 307 ms — the ≤ 300 ms(local) / ≤ 600 ms (CI) test bounds still hold within their own existing
noise margin, same as §6.5's own 300-330 ms range). `fox vs rabbit`/`wolf vs fox` are unaffected
(`winnability.test.ts`, `search.test.ts`'s own tactics/determinism suite: unchanged, green) — every
one of these three techniques is gated on `level.level === 5`, same as §6.5's own `tt`/`killers`/
`quiesce`.

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
| Calibration (manual, not in CI) | `pnpm --filter @chess-kids/core calibrate [games] [level]` (default 40 games, every pairing): self-play, each level vs the previous, target ≥ 70% win rate; the optional 3rd arg filters to one pairing by its higher level's name (`calibrate 30 bear`, M5.4's own quick smoke check while tuning one level). Run for M4.2 (§6.5's numbers) and M5.4 (§6.6's); not a nightly job (no CI schedule wired up) |
| Mate hint (M3.5) | `mateHint` returns a legal move for the side to move; finds a mate-in-1 when one exists; `null` only with no legal move at all |

## 9. Later

- **Game review:** after a game, Owl shows up to 3 key moments (material swing ≥ 3), e.g. "Here the Horse could take the Rook".
- **Bear strength (M5.4, §6.6, roadmap F4 — still open):** 13.3% → 20.0% bear-vs-wolf, still well
  short of 70%. Likely next levers, in order of expected payoff for the effort: a richer
  `staticEval` for Bear only (mobility, king safety, passed pawns — the one option from F4's own
  list not yet tried); isolating each of null-move/LMR/history's own individual contribution (§6.6
  measured them together only, for time); wider opening-book coverage so fewer games ever leave it
  in the first place. The calibration script (§8, `calibrate 30 bear` for a faster read on this one
  pairing) is how to check progress on any of them.
