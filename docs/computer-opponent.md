# Computer Opponent — Chess for Kids

Related: [domain-model.md](domain-model.md), [architecture.md](architecture.md). Paths: `packages/subject-chess/` unless `packages/…`.

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
`content/bot-book.yaml` — e4/d4 main lines, ≤ 6 plies, both colours (a line is a shared
move sequence; whoever is to move at a given ply plays it, not "White's" or "Black's" book).
`src/core/bot/book.ts`'s `bookCandidates` matches the game's own SAN history so far against every
line's prefix, offers each matching line's next move (deduped, and only if it is still legal in the
current position — defensive, in case a non-standard start coincides with a prefix by pure text
accident), and `bookMove` picks uniformly among them with the seeded `Random`. `chooseMove` takes
the compiled book as an optional parameter (kept out of the bot's own dependencies — the bot worker/in-thread fallback in
`src/web/adapters/bot/` import `dist/bot-book.json` and pass it in) so a
forced mate-in-1 (`alwaysMateInOne`) still always wins outright, book or not. `pnpm build`
(`src/content/bot-book-load.ts`) checks every
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

All values in `src/core/bot/levels.ts` (`BOT_LEVELS`) — plain TS, not a content
file; `BotLevel` (`level`, `name`, `random`, `shallow`, `depth`, `searchShare`, `alwaysMateInOne`,
`queenHomeMoves`, `book`, `aids`) is domain-layer data.

**Unlock:** `computerLevelStatus(records, journey)` (`src/core/app/games.ts`) computes
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
`src/core/bot/levels.ts` — read by `src/modes/versus/Step.tsx`'s `aidsForLevel`), no parent
settings screen for it yet.

## 5. Automatic level

- Default parent setting: `Automatic`.
- After each game vs computer, look at the last 5 games at that level:
  - ≥ 4 wins → suggest next level (Owl: "Ready for the Fox?"), only if that level is unlocked.
  - ≤ 1 win → drop one level silently.
- Never skips more than one level at a time.
- Computed only once 5 full games have actually been played at that level (`nextSuggestedLevel`,
  `src/core/app/games.ts`) — a single early result cannot swing it either way.
- Stored per profile in `AppSettings.suggestedLevels` (device-wide settings, keyed by profile id);
  `suggestedLevel` (same module) is what the Play screen's chips actually default to: the stored
  suggestion if it still names an unlocked level, else the highest level already unlocked (a fresh
  profile, or one that has not played 5 games at any level yet, has no stored suggestion at all).

## 6. Game flow

- Move shown after 0.8–1.5 s (so the kid sees it; 0.3 s under reduced motion), with animation.
- Computer never resigns.
- No progress after 60 kid moves (e.g. kid can't finish the mate) → Owl offers a hint toward mate:
  a tap runs `mateHint(state, rules)` (`src/core/bot/hint.ts`) — a depth-2 search
  for the kid's own side, no randomness — and highlights the returned move's piece and target
  square on the board (`Board`'s existing `highlights.hint` ring). Cleared on the next move, take
  back, or "Play again".
- Draws (stalemate, insufficient material, threefold repetition, 50-move rule — all already
  detected in `src/core/game/rules.ts`'s `gameResult`) show a draw screen with Owl explaining which
  one (`VersusState.endReason`, a second line under the generic "It's a draw!" text).
- Leave (Play's full-game screen only): a "Stop game?" confirm; confirming ends the game
  without playing it out, saved as `abandoned` — never a loss.
- Result saved as a `GameRecord` (`id`, `game`: `'full'` for a full game — including World 4's own
  `first-game` boss, which *is* a full game — or a `versus` mini-game's own content id otherwise;
  `opponent: computer:<level>`; `result`: `win` / `loss` / `draw` / `abandoned`; `reason`: the draw
  reason above, `checkmate`, or `left`; `moves`: SAN). `recordGame`/`loadGameRecords`
  (`src/core/app/games.ts`) and the `GameRecordRepository` port persist it (localStorage
  adapter: `packages/platform-web/src/adapters/storage/local-game-record-repository.ts`, schema v3).

## 6.5 Bear speed

All in `src/core/bot/search.ts`, **Bear only**: a transposition table keyed by
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

**Measured, first attempt** (`calibrate 30 bear`, same seeds before/after): bear vs wolf **13.3% → 20.0%**
(6/30). Speed unaffected; `fox vs rabbit` / `wolf vs fox` unchanged.

**Why it stayed low (`m10.1` diagnosis, `calibrate` W/D/L + reasons + depth):**

| Fact (code before the fix, seeds 1–30) | Value |
|---|---|
| W / D / L | 7 / 1 / 22 (set 2, seeds 1001–1030: 8 / 1 / 21) |
| Non-wins | 22 × checkmate against Bear, 1 × threefold repetition; no 50-move, stalemate, insufficient-material or ply-cap result |
| Bear ahead | never: peak material lead ≤ 2 pawns in 19 of 23 non-wins; final lead mostly −8 to −33 |
| Search depth (Bear) | d1 11, d2 425, d3 389, d4 274 (median 3, p10 2); time cap cut 75% |
| Time cap lifted (always depth 4), seeds 1–12 | 1 / 1 / 10, no better |

Not a conversion problem (so mop-up, draw avoidance and passed-pawn levers do not apply) and not a
depth problem. Cause: `searchRoot` searched each sibling with window `(-∞, -alpha)`, so a refuted
move only returned a fail-low *bound*. A bound equal to `alpha` (first refutation = a capture of
the same value as the best line) passed the near-best test `best - score ≤ margin`, so the pool held
moves that lose at once: root scores for one position were `e1f2:-1.06` (best) and 17 other moves
at `-1.06`, of which `a2b2` allows `Bg3#` (true score −998); `preferSafe` / `pickUniform` then chose
among them.

**Lever (Bear only, `bear !== undefined` via `BearSearch.rootWindow`):** each root sibling is searched with
`beta = -alpha + 0.055` (`BEAR_ROOT_WINDOW` = `BEAR_NEAR_BEST_MARGIN` + 0.005), so every move inside
the pool has an exact score; the same position now gives `a2b2:-998` and a pool of `e1f2` only. One lever, so its own share is the whole gain:

| `calibrate 30 bear` (W / D / L, 3 × 10-game shards in parallel) | Before | After |
|---|---|---|
| Seeds 1–30 | 7 / 1 / 22 (23.3%) | **30 / 0 / 0** (100%) |
| Seeds 1001–1030 (`calibrate 10 bear 1000/1010/1020`) | 8 / 1 / 21 (26.7%) | **30 / 0 / 0** (100%) |
| `fox vs rabbit` (30) | 23 / 7 / 0 | 23 / 7 / 0 |
| `wolf vs fox` (30) | 27 / 2 / 1 | 27 / 2 / 1 |

Speed: the wider root window costs some pruning. Reference set (10 quiet middlegames, this machine, single
process): p50 ≈ 268 ms, p95 ≈ 277 ms (before: 270 / 288 ms); completed depth 1–2 on every position (before:
2, one 1); `search.slow.test.ts` green. Under 3 parallel self-play processes the share of d1 searches is 3–4%
(before 0.2–1%). Not tried, not needed for the target: mop-up eval, draw / repetition avoidance, passed-pawn
bonus, piece-square tables (§9).

**Same flaw at lower levels, left as is:** Rabbit, Fox and Wolf pick from the same bound-only pool (margin
0.3), which is part of why they blunder; changing it would re-calibrate every level below Bear.

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
| Calibration (manual, not in CI) | `pnpm --filter @learn/subject-chess calibrate [games] [level] [seed offset]` (default 40 games, every pairing): self-play, each level vs the previous, target ≥ 70% win rate. Prints W / D / L, the reason of every non-win (draw reason or checkmate), material lead at the end / peak, and the higher level's completed search depth (median, p10, histogram, share cut by the time cap). `calibrate 30 bear` filters to one pairing by its higher level's name; the 4th arg shifts the seeds (`calibrate 10 bear 1000` = seeds 1001–1010; keep it even so colours alternate the same way), e.g. a second seed set or one shard of a parallel run. Self-play has no opening book. Bear and Wolf depth depends on machine load (250 ms cap), so a run is only reproducible on the same load. Not a nightly job (no CI schedule wired up) |
| Bear root pool | `search.test.ts`: from a position where most moves allow mate in 1, no roll of the dice picks one (24 rolls over the whole pool); red without `BEAR_ROOT_WINDOW`, green with it |
| Mate hint | `mateHint` returns a legal move for the side to move; finds a mate-in-1 when one exists; `null` only with no legal move at all |

## 9. Later

- **Game review:** after a game, Owl shows up to 3 key moments (material swing ≥ 3), e.g. "Here the Knight could take the Rook".
- **Bear strength (§6.6, roadmap F4 — done in `m10.1`):** 100% bear vs wolf on two seed sets. Levers not
  needed so far, in order if Bear ever needs more: speed (profile: ≈ 27% GC, move-object creation in
  `searchBoard.moves()` ≈ 10%, `pieces()` ≈ 6%; faster nodes = deeper search under the 250 ms cap, also on
  slow tablets); piece-square tables / king safety (Bear's flat evaluation picks random pawn moves in quiet
  openings; the book hides this in the app); mop-up and draw avoidance (draws: 2 in 60 games before the fix, 0 after).
