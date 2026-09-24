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
| Lesson | `id`, `world`, `order`, `concept`, `character`, `storyKey`, `demo`, `guided[]`, `exercises[]`, `variants[]` (easier variants), `boss` (mini-game id) |
| Concept | `id`, `category` (`basics` / `openings` / `tactics` / `endgames` / `strategy`), `titleKey` (e.g. `rook-move`, `hanging-piece`, `check-escape`, `mate-in-1`) |
| Exercise | `id`, `concept`, `type`, `board`, `textKey`, type-specific fields, optional `easier` (id of a `variants` entry of the same lesson) |
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
| ParentLock | `password` (plain text; kid-gate only), `filePath`, `failedAttempts`, `lockedUntil` |
| Profile | `id`, `accountId`, `nickname`, `avatar`, `createdAt`, `locale`, `settings` |
| Settings | `sessionLimitMin`, `voice`, `sound`, `hints`, `botLevel` (`auto` or 1–5), `aids` (overrides), `pieceStyle` |
| LessonProgress | `lessonId`, `status` (`locked` / `available` / `complete` / `mastered`), `bestStars{exerciseId}`, `masteredVia` (`play` / `test-out` / `placement` / `parent`) |
| ConceptStats | `conceptId`, `recent[]` (last 10 first-try results), `box` (1–5, absent = not in review), `dueAt`, `lastExerciseId` (avoids repeating the last task shown) |
| Attempt | `exerciseId`, `conceptId`, `correct`, `hints`, `errors`, `durationMs`, `at` |
| Match | `id`, `mode` (`local` / `online`), `game` (`full` or mini-game id), `players[]` (profile id or guest + colour), `moves[]` (SAN), `status`, `result` |
| GameRecord | `id`, `profileId`, `game` (`full` or `versus` mini-game id — `first-game`, World 4's own full-game boss, also maps to `full`), `opponent` (`computer:<level>` in v1; `profile:<id>` / `guest` v2), `result` (`win` / `loss` / `draw` / `abandoned`), `reason` (draw reason, `checkmate`, or `left`), `moves[]` (SAN), `createdAt` |
| Badge | `badgeId`, `tier`, `at`, `seen` |
| Streak | `current`, `best`, `lastDay`, `skipsUsedThisWeek` |
| SessionLog | `date`, `minutes` |
| TimeEntry (v2) | `start`, `end`, `activity` (`lesson` / `practice` / `play`) |
| TimePolicy (v2) | `perWeekday` (minutes), `allowedHours`, `playLimit`, `learnLimit` |
| TimeException (v2) | `date`, `extraMinutes` or policy override, `note` |

- All stored records: UUID `id`, `createdAt`, `updatedAt` (sync-ready).
- Derived, not stored: total stars, rank, world status, weak concepts.

## 3. Rules

| Rule | Definition |
|---|---|
| Lesson complete | Every exercise ≥ 1 star |
| Lesson mastered | Σ best stars ≥ 80% of max, or test-out / placement / parent unlock |
| Lesson available | Previous lesson complete (first lesson: world available) |
| World boss (optional, `World.boss`) | Locked / available / won. Available once every authored lesson of the world is complete (or better) and the world itself is not locked; won once its `MiniGameProgress.wins ≥ 1` (any route: Journey node or Play screen) |
| World mastered | All lessons mastered (incl. every lesson's own boss `bossStars ≥ 2`) + its world boss won, if it has one |
| World available | Previous world in same track mastered (first world: track available), or unlocked by test-out / parent |
| Track mastered | All its worlds mastered |
| Track available | Main track: always. Branch tracks: main track mastered |
| Concept accuracy | First-try correct ratio over last 10 attempts |
| Weak concept | Accuracy < 60% |
| Easier variant | Scored exercise, unsolved, ≥ 2 errors, `easier` set → variant offered (§3.4) |
| Rank | Highest rank whose `after` is mastered |
| Full game vs computer | Available after World 4 mastered (Mouse); Rabbit after 3 full-game wins vs Mouse (`GameRecord`s, `opponent: computer:1`, `game: 'full'`) — Fox/Wolf/Bear locked with their own condition until M4. Kid plays White (M3); colour choice is M4 |
| Game record | Every full game and `versus` mini-game (standalone or a lesson's boss) saves a `GameRecord`; leaving mid-game (`versus` UI, "Stop game?" confirm) saves it `abandoned`, never a loss |
| Next step (Home "Today" / Journey highlight) | Next available lesson; once a world's lessons are all done and its world boss is available but unwon, the world boss |

### 3.1 Review scheduler (Leitner)
- Concept enters box 1, due in 1 day, when its lesson becomes complete (every exercise ≥ 1 star, incl. via an easier variant crediting the original).
- Concept enters (or re-enters) box 1, due **now**, the moment a scored exercise attempt reaches `errors ≥ EASIER_AFTER_ERRORS` (2) — the same threshold the easier-variant offer itself uses (§3.4): "the kid needed the easier variant / failed an exercise twice". Covers both the exercise left unsolved for its variant (`recordAttempt`, always ≥ 2 errors by construction) and one pushed through to a self-solve with 2+ errors along the way. A single stray error, or a hint used with none, still counts against accuracy (`recent`) but does not by itself schedule a review task. This "immediate" entry never gets pushed back out: a lesson completing afterwards (the non-immediate case above) leaves an already-due date alone.
- Intervals: box 1 = 1 day, 2 = 2, 3 = 4, 4 = 8, 5 = 16.
- A warm-up/practice review task's result moves the box: correct (first try, no hint) → box + 1 (max 5); else → box 1. Always reschedules `dueAt` and remembers `lastExerciseId`. Only these review-task results move boxes — a lesson exercise's own result only appends to `recent` and (on a wrong first try) triggers the immediate entry above, never a box move by itself.
- `recent`: every scored exercise attempt (lesson, warm-up, practice) appends its first-try `correct`; an easier variant's own attempt (`scored: false`) never counts.
- Warm-up: due concepts oldest `dueAt` first, max 1 task per concept, up to 3; short of 3, fills with the weakest concepts still in review (lowest accuracy, then oldest `dueAt`); no concept in review → no warm-up.
- Task source (`conceptPool`): a concept's scored exercises across every lesson that teaches it (not only the one that first taught it), never a guided try or a variant; picked via the seeded `Random` port, avoiding `lastExerciseId` when another candidate exists.
- Review tasks are scored for stats but never change a lesson's own `bestStars` (`recordReviewResult` logs a `review: true` `Attempt` against the task's own lesson id, separate from `recordExerciseResult`).

### 3.2 Assessments

| Kind | Content | Pass | Effect |
|---|---|---|---|
| Placement | 4 tasks per world, Basics worlds in order | ≥ 3/4 per world | Stops at first failed world; earlier worlds mastered (`placement`) |
| Test-out | 5–8 tasks from lesson/world concepts | ≥ 80% | Scope mastered (`test-out`), next unlocked |
| World test | Mixed tasks from all world concepts | ≥ 80% | Part of world mastery (optional per world) |

Failing any assessment: no penalty, no data lost.

### 3.3 Session
- Order: warm-up (if any concept is due; else skipped) → the Journey's next step (a lesson, resumed if in progress, or a pending world boss — same as `nextStep`, §3 table) → one mini-game → session summary (stars earned this session, new animal friends / rank, Owl's closing line) → Home.
- Mini-game pick (`pickSessionMiniGame`): the most recently unlocked one (world order, then lesson order) with best stars < 3, else the most recently unlocked one regardless of stars; excludes the world boss already playing as this session's lesson-step substitute, if any; `undefined` when nothing is unlocked.
- Home's **Start today** shows whenever the Journey has a next step (lesson or world boss) or any concept is due; hidden only once both are exhausted (a mini-game-only remainder with nothing else due is not offered from Home — a known gap, tracked for a later milestone).
- The kid can leave any time: closing mid-activity (warm-up, lesson, mini-game) abandons the whole session straight to Home, without a summary; finishing an activity normally advances to the next one; the summary's "Done" is the only way out of it.
- After Basics: next lesson from the least advanced track.
- Time limit checked between activities only; never interrupts an exercise.

**Practice screen** (reuses the exercise layout, `docs/screens.md`): a "Daily warm-up" card (due count; disabled "All done for today!" when none due — same `loadWarmUp`/`recordReviewResult` as the Today session's warm-up, just reachable on its own) + a topic list. One row per concept that any complete/mastered lesson teaches, using its earliest such lesson (world then lesson order) for the title/character; accuracy dots from `ConceptStats.recent` (last 10); a "Needs practice" tag when `isWeak`. Tapping a topic runs 5 tasks from `loadPracticeTasks`.

### 3.4 Easier variant

| Topic | Rule |
|---|---|
| Content | Lesson `variants[]`: same exercise schema; not stepped, not scored, not in exercise counts, completion or mastery. `easier` only on scored exercises, must name a variant of the same lesson; variants have no `easier`; every variant referenced (build fails otherwise) |
| Trigger | Scored exercise, unsolved, `errors` ≥ 2 (illegal / wrong moves, wrong answers, selections, placements; hints not counted). Guided tries: never |
| Offer | Owl note on the error: "This one is tricky. Want an easier one?" + button **Easier one** (next to "Say it again"). Not forced: kid may keep trying the original (normal stars) |
| Swap | Same lesson step (stage dots unchanged); failed original logged as `Attempt` (`scored`, `correct: false`) → review scheduler (`m3.4`) puts the concept in box 1 (= "concept added to review"); no separate queue |
| Result | Variant solved → original exercise credited 1 star (= "completed"); variant `Attempt` logged with `scored: false`. Replaying the lesson can raise the stars |
| Resume | App closed mid-variant → resumes at the original exercise |

## 4. Use cases (app layer)

| Area | Use cases |
|---|---|
| Profiles | `createProfile`, `selectProfile`, `updateSettings`, `deleteProfile` |
| Assessment | `startPlacement`, `startTestOut`, `submitAssessment` |
| Session (M3.4) | `loadTodaySession`/`planTodaySession` (§3.3 order), `loadWarmUp`, `loadPracticeTasks`, `recordReviewResult` (box move); `recordExerciseResult`/`recordAttempt` also fold into `ConceptStats` (§3.1) |
| Exercise | `startExercise`, `submitMove`, `submitAnswer`, `requestHint`, `completeExercise` |
| Games | `startMiniGame`, `playMove`, `finishGame` |
| Full game (M3.5) | `recordGame`, `loadGameRecords`, `computerLevelStatus` (per-level locked/condition or unlocked + wins/games); `mateHint` (domain, `domain/bot/hint.ts`) |
| Friend play | `startLocalMatch`, `playMatchMove`, `requestTakeback`, `finishMatch` |
| Parent | `getReport`, `unlock`, `resetProgress` |

## 5. Ports

| Port | Purpose |
|---|---|
| `ProfileRepository`, `ProgressRepository`, `SettingsRepository` | Persistence (async); `ProgressRepository` also holds `ConceptStats` (`getConceptStats`/`listConceptStats`/`saveConceptStats`) |
| `GameRecordRepository` (M3.5) | Persistence of `GameRecord` (`add`/`listByProfile`/`deleteProfileData`), separate from `ProgressRepository` |
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
