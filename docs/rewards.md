# Rewards — Chess for Kids

Related: [app-structure.md](app-structure.md), [domain-model.md](domain-model.md).

## 1. Rules

| Rule | Detail |
|---|---|
| Reward mastery and effort | Not time spent |
| Clear goals | Locked badges show their condition, spoken ("Win Pawn Wars 3 times") |
| Nothing lost | Stars, badges, rank never taken away |
| No comparison | No leaderboards, no comparison between profiles |
| No money, no luck | No purchases, no random rewards |
| Rare celebrations | Max 2 badge celebrations per session; extras appear in My Den with a "new" dot |
| Forgiving streaks | Day counts with ≥ 1 completed activity (exercise solved, game finished, warm-up task); 1 free skip per ISO week (charged against the week of the day the gap is *noticed*, not the missed day itself — the same week except right at a boundary); a 2nd gap in the same week is not bridged; broken streak restarts at 1 silently; local calendar day, device time zone (`domain/streak.ts`) |

## 2. Reward types

| Type | Earned by | Shown in |
|---|---|---|
| Stars | Exercises and mini-games (1–3 each) | Top bar, Journey nodes, My Den |
| Rank | Worlds and paths (Pawn → King) | Home, My Den |
| Animal friends | Piece lessons in World 2 (Rhino, Elephant, Lioness, Lion, Horse, Caterpillar) | My Den |
| Badges | Catalogue below | Lesson complete screen, My Den |

## 3. Badge catalogue

Tiers: bronze / silver / gold where 3 values are given.

### Milestones

| Badge | Condition |
|---|---|
| Board Explorer | World 1 mastered |
| Piece Master | World 2 mastered |
| Guardian | World 3 mastered |
| Checkmate Champion | World 4 mastered |
| Rule Master | World 5 mastered |
| Basics Graduate | Basics mastered |
| Opening Explorer | Openings path mastered |
| Tactics Tiger | Tactics path mastered |
| Endgame Hero | Checkmates & Endgames path mastered |

### Skills

| Badge | Condition |
|---|---|
| Perfect Lesson | Lesson with 3 stars on every exercise: 1 / 5 / 15 lessons |
| Star Collector | Total stars: 50 / 150 / 400 |
| Sharp Eyes | 10 correct "Safe or not?" answers in a row |
| Escape Artist | 10 check escapes without hints |
| Mate Master | Mates in 1 solved: 10 / 25 / 50 |
| Butterfly Maker | Promote 10 pawns in games |
| Castle Builder | Castle in 5 games |
| Fork Finder | 10 forks found |

### Play

| Badge | Condition |
|---|---|
| First Win | First win vs computer |
| Mouse Tamer · Rabbit Catcher · Fox Outsmarter · Wolf Tamer · Bear Buddy | First win vs each level |
| Queen Keeper | Win a game without losing the queen |
| Pawn Wars Winner | Win Pawn Wars 3 times |
| Friendly Match | First game vs a friend (any result) |

### Habits

| Badge | Condition |
|---|---|
| Daily Player | Streak: 3 / 7 / 30 days |
| Warm-up Champ | Warm-ups completed: 10 / 30 |
| Never Give Up | Finish an exercise after 2+ wrong tries: 1 / 10 / 25 |

**Totals:** 29 badges (6 with tiers). MVP: 25 (without the 3 path milestones and Fork Finder).

## 4. Badge engine (implemented M4.4)

- `domain/badges.ts`'s `evaluateBadges(defs, facts, earned)` is pure: for every `BadgeDef`, compares
  `condition.thresholds` (ascending, 1 entry = single-tier, 3 = bronze/silver/gold) against one
  number read off `BadgeFacts`, returning every tier newly crossed not already in `earned`. `earned`
  is never edited by this function — a fact dropping later (a reset streak) never unearns a tier
  already granted ("nothing lost", §1).
- `BadgeFacts` is derived fresh from stored data by `app/rewards.ts`'s `buildBadgeFacts` (never
  cached, never itself a stored counter — "no separate counters where derivable" except where noted).
- `checkRewards(deps, profileId)` (`app/rewards.ts`) is the one call every choke point makes: folds
  today into the `Streak`, then runs `evaluateAndRecordBadges` and persists any newly earned
  `EarnedBadge` row (`seen: false`). Wired into `recordExerciseResult`/`recordBossResult`/
  `recordReviewResult` (use-cases.ts), `recordGame` (games.ts, non-abandoned only) and
  `saveMiniGamePlay` (minigames.ts) — covering exercise/lesson/game/warm-up completion; the web
  store also calls it once more when a Today session ends, after logging the session's own minutes
  (`recordSessionMinutes`). Permissive no-op without `AppDeps.rewards` or `ContentSource.catalog()`
  wired up, so every pre-M4.4 test fixture keeps working unchanged.

| Condition type | Parameters | Fact read |
|---|---|---|
| `mastered` | `scope: 'world:<id>'` / `'track:<id>'` | `masteredScopes.has(scope)` (from the current `Journey`) |
| `stars-total` | thresholds | `totalStars(progresses)` |
| `perfect-lessons` | thresholds | count of lessons with 3★ on every exercise (boss excluded) |
| `concept-correct` | `concept`, thresholds, `inARow?`, `noHints?` | lifetime correct count, or the current correct-in-a-row / hint-free-in-a-row streak, from every scored `Attempt` (lesson or review alike) for that concept |
| `game-win` | `opponent: 'any'` / `'computer:<n>'` / a mini-game id, thresholds, `extra: 'queen-kept'` | win count from `GameRecord`s; `any`/`computer:<n>` count full games (`game: 'full'`) only, a mini-game id counts its own wins only (never toward `any`) |
| `game-event` | `event: 'promotion'` / `'castling'`, thresholds | `promotion`: total promotion-move count (SAN `=`) across every non-abandoned game, both sides' moves — a deliberate MVP simplification (no per-side move ownership tracked yet); `castling`: count of *games* (not moves) with >= 1 castling move (SAN `O-O`/`O-O-O`) |
| `game-played` | `mode: 'local'`, thresholds | count of non-abandoned `GameRecord`s whose `opponent` is `guest` or `profile:<id>` (M4.3 adds these records) |
| `streak-days` | thresholds | `Streak.current`, after folding in today |
| `warmups` | thresholds | count of `Attempt`s with `review: true, reviewSource: 'warmup'` — individual tasks, not sessions; `reviewSource` distinguishes Today's inline warm-up / Practice's "Daily warm-up" card from a Practice topic run (both otherwise indistinguishable review tasks) |
| `comeback` | thresholds | count of scored `Attempt`s with `stars > 0 && errors >= 2` (any wrong-tries count >= 2, not just "exactly 2") |

`queen-kept` (Queen Keeper) replays a full game's moves via `chessJsRules` from the standard start,
counting it kept when the opponent's own moves never capture a queen (`Move.captured === 'q'`) —
only meaningful for `game: 'full'` (guaranteed standard start with both queens), and assumes the kid
is White (true for every full game this app can record today; a friend game's colour choice is
M4.3, out of this scope for now).

**Celebrations** (§1 "Rare celebrations"): `checkForCelebrations` (web store) re-reads earned
badges/streak and queues the oldest unseen badge as `activeCelebration` when nothing is already
showing and this app sitting (reset per profile select) is still under 2. `dismissCelebration`
marks it seen, counts it, and queues the next one if any. Triggered at exactly 3 moments: lesson
complete (`LessonScreen`'s own effect once its Complete step renders), a full game's result
(`FullGameScreen`, after `recordGame` resolves) and the Today session summary (store, on entering
it). A badge earned elsewhere (a standalone mini-game, a friend game) surfaces at the next of these
3 moments instead — no celebration of its own, only a "new" dot in My Den until then.

## 5. Later

| Idea | Note |
|---|---|
| Den decorations bought with stars | Stars as soft currency, no money; decide after MVP feedback |
| Habitat friends | New animal friends per world / path |
