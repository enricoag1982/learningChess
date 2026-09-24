# Domain Model — Chess for Kids

Related: [teaching-process.md](teaching-process.md), [app-structure.md](app-structure.md), [architecture.md](architecture.md).

Two groups of entities:
- **Content** (static, authored in `packages/content`, read-only at runtime).
- **Profile data** (per child, stored via repositories).

## 1. Content entities

```
Track 1─* World 1─* Lesson 1─* Exercise
            │         │
            │         └─1 Boss (MiniGame)
            ├─1 Assessment (world test / test-out)
            └─ habitat
Concept *─* Exercise, MiniGame     (unit of mastery and review; has a category)
Character 1─1 piece type
```

| Entity | Fields |
|---|---|
| Track | `id`, `kind` (`main` / `branch`), `category`, `order`, `titleKey`, `worlds[]` |
| World | `id`, `track`, `order`, `habitat`, `titleKey`, `lessons[]`, `test` (assessment id) |
| Lesson | `id`, `world`, `order`, `concept`, `character`, `storyKey`, `demo`, `guided[]`, `exercises[]`, `boss` (mini-game id) |
| Concept | `id`, `category` (`basics` / `openings` / `tactics` / `endgames` / `strategy`), `titleKey` (e.g. `rook-move`, `hanging-piece`, `check-escape`, `mate-in-1`) |
| Exercise | `id`, `concept`, `type`, `board`, `textKey`, type-specific fields, optional `easier` (exercise id) |
| MiniGame | `id`, `concept`, `unlockAfter` (lesson id), `board`, `rules`, `win`, `opponent`, `moveLimit`, `kidColor` |
| Assessment | `id`, `kind` (`placement` / `test-out` / `world-test`), `scope`, `tasksPerConcept`, `pass` (default 0.8) |
| Character | `id` (`rhino`, …), `piece`, `nameKey`, `storyKey` |
| Rank | `id` (`pawn` … `king`), `after` (world id, track id, or `all-tracks`) |
| BadgeDef | `id`, `category` (`milestone` / `skill` / `play` / `habit`), `nameKey`, `condition` (type + params), `tiers[]` — see [rewards.md](rewards.md) |
| BotLevel | `level` (1–5), `name` (`mouse` … `bear`), `random`, `shallow`, `depth`, `book`, `queenHomeMoves`, `aids` — see [computer-opponent.md](computer-opponent.md) |

### 1.1 Position
- Authored as board diagram or FEN; parsed to `Position { pieces, markers { stars, blocked }, toMove }`.
- Diagram symbols: FEN letters (`KQRBNP` white, `kqrbnp` black), `.` empty, `*` star, `x` blocked. Rank 8 on top.
- Kid plays white unless `kidColor: black`.

### 1.2 Exercise types

| Type | Task | Specific fields | Success |
|---|---|---|---|
| `select-squares` | Tap squares (legal moves, attacked squares, escapes) | `answer` (squares) or `derive` (`legal-moves`, `attacked-by`, `check-escapes`) + `from` | Exact set selected |
| `collect-stars` | Move piece(s) over all stars | `stars3`, `stars2` (move counts), `avoidAttacked` | All stars collected |
| `capture` | Capture target pieces | `targets`, `staticEnemies` | All targets captured |
| `yes-no` | Answer a question on the position (e.g. "Is it safe?") | `focus` (square), `answer` | Correct answer |
| `choice` | Pick one option (e.g. "Which is worth more?") | `options[]`, `answer` | Correct option |
| `best-move` | Play the right move | `solutions[]` (SAN) | Move in solutions |
| `mate-in-n` | Deliver mate | `n`, `line` (SAN, opponent replies included) | Mate reached |
| `setup` | Place pieces to match a target | `target` (position) | Position matches |

### 1.3 Stars (per exercise)
- Default: 3 = no hint, no error · 2 = ≤ 1 hint or ≤ 1 error · 1 = completed.
- `collect-stars`: by move count (`stars3`, `stars2`).
- Hint level 3 (move shown) = 1 star, concept result = wrong.

### 1.4 Mini-game definition

| Field | Values |
|---|---|
| `rules` | `kings: true/false`, `checkRules: true/false`, `noMoves: lose/draw` |
| `win` | Per side, any of: `checkmate`, `promote`, `capture-all`, `capture: <piece>`, `reach: <squares>`, `survive: <n>` |
| `opponent` | `static` (never moves), `scripted` (fixed moves), `bot: <level 1–5>` |
| `moveLimit` | Optional; kid loses / draws when reached |
| Stars | 3 = win within par, 2 = win, 1 = played to end |

## 2. Profile data

| Entity | Fields |
|---|---|
| Account | `id`, `kind` (`guest` in v1 / `parent` in v2), `profiles[]` |
| Profile | `id`, `accountId`, `nickname`, `avatar`, `createdAt`, `locale`, `settings` |
| Settings | `sessionLimitMin`, `voice`, `sound`, `hints`, `botLevel` (`auto` or 1–5), `aids` (overrides), `pieceStyle` |
| LessonProgress | `lessonId`, `status` (`locked` / `available` / `complete` / `mastered`), `bestStars{exerciseId}`, `masteredVia` (`play` / `test-out` / `placement` / `parent`) |
| ConceptStats | `conceptId`, `recent[]` (last 10 results), `box` (1–5), `dueAt` |
| Attempt | `exerciseId`, `conceptId`, `correct`, `hints`, `errors`, `durationMs`, `at` |
| Match | `id`, `mode` (`local` / `online`), `game` (`full` or mini-game id), `players[]` (profile id or guest + colour), `moves[]` (SAN), `status`, `result` |
| GameRecord | `miniGameId` or `full`, `opponent` (`computer:<level>` / `profile:<id>` / `guest`), `matchId`, `result`, `moves[]` (SAN), `at` |
| Badge | `badgeId`, `tier`, `at`, `seen` |
| Streak | `current`, `best`, `lastDay`, `skipsUsedThisWeek` |
| SessionLog | `date`, `minutes` |

- All stored records: UUID `id`, `createdAt`, `updatedAt` (sync-ready).
- Derived, not stored: total stars, rank, world status, weak concepts.

## 3. Rules

| Rule | Definition |
|---|---|
| Lesson complete | Every exercise ≥ 1 star |
| Lesson mastered | Σ best stars ≥ 80% of max, or test-out / placement / parent unlock |
| Lesson available | Previous lesson complete (first lesson: world available) |
| World mastered | All lessons mastered + boss won |
| World available | Previous world in same track mastered (first world: track available), or unlocked by test-out / parent |
| Track mastered | All its worlds mastered |
| Track available | Main track: always. Branch tracks: main track mastered |
| Concept accuracy | First-try correct ratio over last 10 attempts |
| Weak concept | Accuracy < 60% |
| Easier variant | 2 wrong attempts on one exercise → its `easier` exercise, if defined |
| Rank | Highest rank whose `after` is mastered |
| Full game vs computer | Available after World 4 mastered |

### 3.1 Review scheduler (Leitner)
- Concept enters box 1 when its lesson is complete.
- Intervals: box 1 = 1 day, 2 = 2, 3 = 4, 4 = 8, 5 = 16.
- Correct → box + 1; wrong → box 1. `dueAt = now + interval`.
- Warm-up: 3 tasks, oldest due first, max 1 per concept; none due → weakest concepts.
- Task source: concept's exercise pool (lesson exercises + puzzles), avoiding the last one shown.

### 3.2 Assessments

| Kind | Content | Pass | Effect |
|---|---|---|---|
| Placement | 4 tasks per world, Basics worlds in order | ≥ 3/4 per world | Stops at first failed world; earlier worlds mastered (`placement`) |
| Test-out | 5–8 tasks from lesson/world concepts | ≥ 80% | Scope mastered (`test-out`), next unlocked |
| World test | Mixed tasks from all world concepts | ≥ 80% | Part of world mastery (optional per world) |

Failing any assessment: no penalty, no data lost.

### 3.3 Session
- Order: warm-up → next available lesson (resume if in progress) → mini-game → rewards.
- After Basics: next lesson from the least advanced track.
- Time limit checked between activities only; never interrupts an exercise.

## 4. Use cases (app layer)

| Area | Use cases |
|---|---|
| Profiles | `createProfile`, `selectProfile`, `updateSettings`, `deleteProfile` |
| Assessment | `startPlacement`, `startTestOut`, `submitAssessment` |
| Session | `startSession`, `nextActivity`, `endSession` |
| Exercise | `startExercise`, `submitMove`, `submitAnswer`, `requestHint`, `completeExercise` |
| Games | `startMiniGame`, `playMove`, `finishGame` |
| Friend play | `startLocalMatch`, `playMatchMove`, `requestTakeback`, `finishMatch` |
| Parent | `getReport`, `unlock`, `resetProgress` |

## 5. Ports

| Port | Purpose |
|---|---|
| `ProfileRepository`, `ProgressRepository`, `SettingsRepository` | Persistence (async) |
| `ContentSource` | Loads compiled content |
| `Narrator` | Speaks text keys |
| `Clock` | Current time (deterministic tests for scheduler) |
| `Random` | Seeded randomness (deterministic tests for bot, task picking) |
| `AuthService` | v1 guest; v2 parent login |
| `SyncService` | v1 no-op; v2 cloud sync |
| `MatchService` | v1 local matches; v2 online |
| `FeatureFlags` | `login`, `online` (false in v1) |

## 6. Content files

```
packages/content/
  tracks.yaml                  tracks, worlds, habitats, ranks
  characters.yaml
  bot-levels.yaml              computer opponent levels
  badges.yaml                  badge catalogue
  assessments.yaml
  lessons/<world>/<lesson>.yaml
  minigames/<id>.yaml
  locales/<lang>/*.yaml        text by key
```

Lesson:
```yaml
id: rook
world: pieces
order: 1
concept: rook-move
character: rhino
story: rook.story
demo:
  board: |
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . R . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
  highlight: legal-moves d4
exercises:
  - id: rook-01
    type: collect-stars
    text: rook-01
    board: |
      . . . . * . . .
      . . . . . . . .
      . . . . . . . .
      * . . . * . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . .
    stars3: 3
    stars2: 5
boss: hungry-rook
```

Mini-game:
```yaml
id: pawn-wars
concept: pawn-move
unlockAfter: pawn
board: |
  . . . . . . . .
  p p p p p p p p
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  P P P P P P P P
  . . . . . . . .
rules: { kings: false, noMoves: lose }
win:
  kid: [promote, capture-all]
  opponent: [promote, capture-all]
opponent: { bot: 1 }
```

Locale (`locales/en/lessons.yaml`):
```yaml
rook:
  story: Rhino charges straight ahead, as far as he wants!
rook-01: Help Rhino collect all the stars.
```
