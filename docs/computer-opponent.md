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

## 3. Levels

| Level | Name | `random` | `shallow` | `search` depth | Always plays mate in 1 | Opening | Unlock |
|---|---|---|---|---|---|---|---|
| 1 | Mouse | 50% | 50% | — | No | No book; queen stays home first 5 moves | World 4 boss |
| 2 | Rabbit | 25% | 50% | 2 (25%) | Yes | Same as Mouse | World 5 boss |
| 3 | Fox | 10% | 20% | 2 (70%) | Yes | Small book (e4/d4 main lines); queen stays home first 5 moves | Openings boss, or beat Rabbit 3× |
| 4 | Wolf | 5% | 5% | 3 (90%) | Yes | Small book | Beat Fox 3× |
| 5 | Bear | 0% | 0% | 4 + capture check | Yes | Small book | Beat Wolf 3× |

All values in `bot-levels.yaml` (content), tunable without code changes.

**Unlock, M3 scope (M3.5):** `computerLevelStatus(records, journey)` (`packages/core/src/app/games.ts`) computes each level's lock state for the Play screen's vs Computer card. Mouse: unlocked once World 4 ("check") is mastered (same rule the pre-M3.5 "Full game" button already used, `app-structure.md` §7). Rabbit: unlocked once the kid has 3 full-game (`GameRecord.game === 'full'`) wins vs Mouse — winning World 4's own `first-game` boss counts (it maps to `game: 'full'` too, §6 below), so mastering World 4 (which requires winning it once) is already 1 of the 3. Fox / Wolf / Bear stay **locked in M3** regardless of record count — their real unlock rule (the Openings-world alternative for Fox; "beat the previous level 3×" for all three, using the table's `Unlock` column above) is M4 work, once World 5 and the Openings track exist — but are shown on the card with that condition text, greyed, so the kid can see what is coming.

## 4. Kid aids per level

| Aid | Mouse / Rabbit | Fox | Wolf / Bear |
|---|---|---|---|
| Take back | Unlimited | 3 per game | None |
| Danger highlight (own unprotected attacked pieces) | On | Optional | Off |
| Legal-move dots | On | On | Optional |

Parent settings can override each aid.

## 5. Automatic level

- Default parent setting: `Automatic`.
- After each game vs computer, look at the last 5 games at that level:
  - ≥ 4 wins → suggest next level (Owl: "Ready for the Fox?").
  - ≤ 1 win → drop one level silently.
- Never skips more than one level at a time.

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
| Determinism | Same position + seed → same move |
| Performance | Bear ≤ 300 ms per move on reference position set |
| Calibration (nightly) | Self-play: each level beats the previous ≥ 70% over 200 games |
| Mate hint (M3.5) | `mateHint` returns a legal move for the side to move; finds a mate-in-1 when one exists; `null` only with no legal move at all |

## 9. Later

- **Game review:** after a game, Owl shows up to 3 key moments (material swing ≥ 3), e.g. "Here the Horse could take the Rook".
