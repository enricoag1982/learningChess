# Domain Model — Chess for Kids

Related: [teaching-process.md](teaching-process.md), [app-structure.md](app-structure.md), [architecture.md](architecture.md).

Two groups of entities:
- **Content** (static, authored in `packages/subject-chess/content`, read-only at runtime).
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
| BadgeDef | `id`, `category` (`milestone` / `skill` / `play` / `habit`), `nameKey`/`conditionKey` (derived from `id`: `rewards:badges.<id>.name`/`.condition`, not authored per badge), `condition` (`type` + `thresholds[]` (1 = single-tier, 3 = bronze/silver/gold) + type-specific params) — see [rewards.md](rewards.md) §4 |
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
| ParentLock | `password` (the parent code; plain text; kid-gate only), `filePath`, `failedAttempts`, `lockedUntil` |
| Profile | `id`, `accountId`, `nickname`, `avatar`, `createdAt`, `locale`, `settings` |
| Settings (`ProfileSettings`) | Per profile, keyed into `AppSettings.profileSettings`: `dailyLimitMinutes` (`null` = off, else 15/20/30/45/60), `weekendLimitMinutes?` (absent = same as `dailyLimitMinutes`; Sat/Sun device-local), `playUntil?`/`playFrom?` (`'HH:MM'` local or `null`/absent = that edge off; `playUntil` options 18:00–21:00 every 30 min, `playFrom` 07:00/08:00/09:00), `voice`, `sound`, `hints` (all `boolean`), `computerLevel` (`'auto'` or a `BotLevel.level` 1–5), `pieceStyle` (`'animal'` / `'classic'`), `updatedAt?` (ISO instant, set by every `updateProfileSettings` call — device-sharing merge's "newest wins", §3.5). No `aids` overrides in v1 — `BotLevel.aids` is per-level, not per-profile |
| LessonProgress | `lessonId`, `status` (`locked` / `available` / `complete` / `mastered`), `bestStars{exerciseId}`, `masteredVia` (`play` / `test-out` / `placement` / `parent`), `skippedPhases?` (`('story'\|'demo'\|'try')[]`, absent = none; set on a "Skip" tap, a phase removed once later played through normally — e.g. a replay) |
| ConceptStats | `conceptId`, `recent[]` (last 10 first-try results), `box` (1–5, absent = not in review), `dueAt`, `lastExerciseId` (avoids repeating the last task shown) |
| Attempt | `exerciseId`, `conceptId`, `correct`, `hints`, `errors`, `durationMs`, `at`; `reviewSource` (only alongside `review: true`): `'warmup'` (Today's inline warm-up, or Practice's own "Daily warm-up" card) vs `'practice'` (a Practice topic run) — what "Warm-up Champ" counts |
| Match | `id`, `mode` (`local` / `online`), `game` (`full` or mini-game id), `players[]` (profile id or guest + colour), `moves[]` (SAN), `status`, `result` — **not stored in v1**: only the `GameRecord`s below are saved; `MatchService` stays a hook for v2 online play |
| GameRecord | `id`, `profileId`, `game` (`full` or `versus` mini-game id — `first-game`, World 4's own full-game boss, also maps to `full`), `opponent` (`computer:<level>` vs the computer; `profile:<id>` / `guest` vs a friend, same device), `result` (`win` / `loss` / `draw` / `abandoned`), `reason` (draw reason, `checkmate`, or `left`), `moves[]` (SAN), `createdAt` |
| Badge (`EarnedBadge` in code — `Badge` is `BadgeDef`'s catalogue entry) | `badgeId`, `tier`, `at`, `seen`; one row per tier reached, so a tiered badge gets up to 3 |
| AssessmentResult | `id`, `profileId`, `kind` (`test-out` / `placement`), `scope`, `correct`, `total`, `passed`, `at` — one row per taken test-out/placement run, pass or fail (§3.2) |
| Unlock | `id`, `profileId`, `targetType` (`lesson` / `world`), `targetId`, `via` (`test-out` / `placement` / `parent`), `at` — feeds `journey.ts`'s `unlocked` id set (§3.2) |
| Streak | `current`, `best`, `lastDay` (local day, device time zone), `skipsUsedThisWeek` (tracked per ISO week of the day the skip is used, not the missed day) |
| SessionLog | `date`, `minutes`; one row per profile + local day *per device*, minutes summed across sessions on that device; `deviceId?` (absent = this device's own) — which device wrote this row, so an imported foreign row for the same profile + day sits alongside this device's own instead of overwriting it; `extraMinutes` (absent = 0) — parent "more time" grants for that day, on top of the daily limit; `hoursOverrideUntil?` (ISO instant) — parent "more time" for a late/early allowed-hours gate, allowed until this instant, reset (not summed) each grant; `warnedAt?` (ISO instant) — the 5-minute warning already shown today. `extraMinutes`/`hoursOverrideUntil`/`warnedAt` are always read/written on *this device's own* row only (never merged in from another device); the daily limit, the parent report, and the 5-minute warning's own "minutes used" instead read the **sum** of every device's row for that profile + day (`totalMinutesForDate`) |
| TimeEntry (v2) | `start`, `end`, `activity` (`lesson` / `practice` / `play`) |
| TimePolicy (v2) | `perWeekday` (minutes), `allowedHours`, `playLimit`, `learnLimit` |
| TimeException (v2) | `date`, `extraMinutes` or policy override, `note` |

- All stored records: UUID `id`, `createdAt`, `updatedAt` (sync-ready).
- Derived, not stored: total stars, rank, world status, weak concepts.

**Backup file**: `{ app: 'chess-kids', schemaVersion, exportedAt, profiles[], data }` — `data` is keyed by profile id, each entry holding that profile's own `settings`, `lessonProgress[]`, `attempts[]`, `miniGameProgress[]`, `conceptStats[]`, `gameRecords[]`, `earnedBadges[]`, `streak?`, `sessionLogs[]`, `assessmentResults[]`, `unlocks[]` — every entity above except `Account`/`ParentLock` (never exported) and the device-only `lastProfileId`/`suggestedLevels`/`storagePersisted`/`deviceId`. "Export" (every profile), "export this child" (`data`/`profiles` filtered to one id), and "Send to other device" (same JSON, a different filename — §3.5) are the same format. Import always **merges** this file into the device's own data — never the parent password, and the device-only `AppSettings` fields above are carried through unchanged, not blanked.

### 3.5 Device sharing

A parent shares a backup file between two devices the same child plays on (`docs/app-structure.md` §13); import always merges — nothing either device did is lost, and importing the same file twice changes nothing (`mergeProfileData` is idempotent). `AppSettings.deviceId` (random, lazily created) identifies this device's own data across a share.

**Profile matching** — same profile id as a local child → merges into it, no question. Else the import preview offers a choice, defaulting to "Merge into ‹local child›" on a nickname match (case-insensitive, trimmed) else "Add as new child"; the parent can override. Merging into a different local child re-keys that incoming child's records to the chosen local profile id (record ids themselves are left as-is — independently random per device, never colliding). Local nickname/avatar are always kept.

**Merge rules**, local vs. incoming, applied per matched profile:

| Entity | Rule |
|---|---|
| LessonProgress | Per lesson: `bestStars` max per exercise, `bossStars` max, `completedAt` earliest, `masteredVia` kept if either has it (local wins a real conflict), `resumeStep`/`skippedPhases` taken together (never mixed) from whichever side has the newer `updatedAt` |
| MiniGameProgress | Per mini-game: `bestStars`/`plays`/`wins` each the max of the two (never additive — avoids double-counting overlapping play already folded into each device's own count) |
| Attempt, GameRecord, AssessmentResult | Union by `id`; a same-id collision (should not happen — independently random per device) keeps the newer `updatedAt`; capped at the same `MAX_ATTEMPTS`/`MAX_GAME_RECORDS`/`MAX_ASSESSMENT_RESULTS` ordinary play already respects |
| EarnedBadge | Union by `badgeId` + `tier`; earliest `at`; `seen` true if either is seen (no second celebration for a badge the kid already saw) |
| ConceptStats | Per concept: the whole record with the newer `updatedAt` (no per-answer timestamps to merge `recent` itself) |
| Streak | `best` = max of both; `current`/`lastDay`/`skipsUsedThisWeek` taken together from whichever side has the later `lastDay` (a tie keeps the higher `current`) |
| Unlocks | Union by `targetType` + `targetId` |
| Settings | Newest wins by `ProfileSettings.updatedAt`; missing reads as oldest; both missing keeps local |
| SessionLog | Per (`date`, `deviceId`): a foreign device's row for a date this device also has a row for sits alongside it, never overwriting it; within one matched (date, device) pair, keeps the larger `minutes`/`extraMinutes` and the later `hoursOverrideUntil`/`warnedAt` |

**Send to other device**: Backup screen's primary button (per child, and "all children") builds the same backup JSON as Export, named `chess-for-kids-<nickname or all>-<date>.json`, offered through `navigator.share({ files })` when the browser can share files, else a same-origin download (every API feature-checked first — oldest supported browser, Safari 15.4, has neither). A share the parent cancels is silent; any other share failure falls back to the download.

**Import preview**: per incoming child, its choice control (skipped for an auto-merge) plus what would change — stars, badges, and minutes this week, the merge result vs. this device's own current data for the chosen target.

**Time limit across devices**: the daily limit, its remaining-minutes figure, and the parent report all read the *sum* of every device's `SessionLog` row for a profile + day, so combined play across devices counts toward one limit after a share ("per device between shares" until the later online sync, `docs/app-structure.md` §13).

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
| Full game vs computer | Available after World 4 mastered (Mouse); every level above unlocks per `computer-opponent.md` §3 (3 full-game wins vs the level below, or a direct win at that level). Kid always plays White (no colour choice) |
| Game record | Every full game and `versus` mini-game (standalone, a lesson's boss, or vs Friend) saves a `GameRecord` — one per profile involved for vs Friend, none for a guest; leaving mid-game ("Stop game?" confirm) saves it `abandoned`, never a loss |
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

| Kind | Trigger | Content | Pass | Effect |
|---|---|---|---|---|
| Test-out | Tap a locked lesson or locked world on the Journey → "Show you know it?" sheet (Owl) → choose lesson or whole world | Lesson: 5 tasks from that lesson's scored exercises. World: 8 tasks spread over the world's lessons, ≥ 1 per lesson. Seeded `Random`, no hints, no easier variants | ≥ 80% first try, rounded up (lesson 4/5, world 7/8) | Every lesson in scope: `masteredVia: 'test-out'`, every exercise floored to ≥ 1 best star (never lowers a higher one); world boss (if any) stays available, counts as won only once the kid wins it later — world reads mastered via test-out without it; scope's own id joins the `unlocked` set (`journey.ts`); each lesson's concept enters review box 1, due tomorrow (non-immediate `enterReview`) |
| Placement | Offered once, right after creating a new player ("Already know some chess?" → Yes: placement / No: start at World 1) | 4 tasks per Basics world, worlds in main-track order, from that world's lessons | ≥ 3/4 first try (rounded up) per world | Same lesson effect as test-out (`masteredVia: 'placement'`) for every lesson of a passed world; stops at the first failed world (later worlds untouched, still locked); can be skipped any time from the runner — worlds already passed keep their effect |
| Parent unlock | Parent area → child's "Unlock lessons & worlds" list (one row per still-locked lesson/world, "Unlock"/"Unlock world" button) | — (no test) | — | Every lesson in scope: `masteredVia: 'parent'`, **no star floor** (admin override, not a passed check); scope's own id joins the `unlocked` set |

Failing test-out or placement: no penalty, nothing lost — Owl encourages, back to the path; the failed run is still recorded (below).

Every run (pass or fail) and every parent unlock records one `AssessmentResult`: `id`, `profileId`, `kind` (`'test-out'` / `'placement'`), `scope` (`{type: 'lesson', lessonId, worldId}` or `{type: 'world', worldId}`), `correct`, `total`, `passed`, `at` — for the parent report. A pass or a parent unlock also runs `checkRewards` once, so a newly-mastered world's milestone badge fires immediately (same choke point as every other activity, `app/rewards.ts`).

A world mastered via test-out/placement, whose boss is later won directly (Journey or Play), is unaffected — `MiniGameProgress.wins` still increments normally; `masteredVia` only ever short-circuits `lessonStatus()`, never a `MiniGameProgress`.

Not built (future idea): a "world test" (mixed tasks from every concept of an already-in-progress world, an optional part of normal world mastery rather than a kid-initiated skip-ahead) — distinct from test-out.

### 3.3 Session
- Order: warm-up (if any concept is due; else skipped) → the Journey's next step (a lesson, resumed if in progress, or a pending world boss — same as `nextStep`, §3 table) → one mini-game → session summary (stars earned this session, new animal friends / rank, Owl's closing line) → Home.
- Mini-game pick (`pickSessionMiniGame`): the most recently unlocked one (world order, then lesson order) with best stars < 3, else the most recently unlocked one regardless of stars; excludes the world boss already playing as this session's lesson-step substitute, if any; `undefined` when nothing is unlocked.
- Home's **Start today** shows whenever the Journey has a next step (lesson or world boss) or any concept is due; hidden only once both are exhausted (a mini-game-only remainder with nothing else due is not offered from Home — a known gap, tracked for a later milestone).
- The kid can leave any time: closing mid-activity (warm-up, lesson, mini-game) abandons the whole session straight to Home, without a summary; finishing an activity normally advances to the next one; the summary's "Done" is the only way out of it.
- After Basics: next lesson from the least advanced track.
- Time limit checked between activities only; never interrupts an exercise: the activity gate
  (`checkActivityGate`, `app/time-limit.ts`) runs on entering a lesson / warm-up / practice run /
  game / mini-game, and on returning to Home — an activity already open always finishes. Over the
  limit → "See you tomorrow" screen (Owl, spoken, today's stars) instead of the activity/Home the
  kid was headed to; **Switch player** (picker) or **Parent: more time** (password →
  `grantExtraTime`, +`EXTRA_TIME_GRANT_MINUTES` (15) today, repeatable) resumes the exact activity
  the gate blocked, unchecked. What counts: foreground time with a kid profile active (lessons,
  practice, play, Home/Journey/Den browsing), tracked client-side (`packages/platform-web`'s `TimeTracker`) —
  paused while the page is hidden or idle > 2 min without input, added to `SessionLog.minutes` once
  per real minute. Resets at local midnight: `isOverLimit`/`timeUsedToday` read a stale (not-today)
  log as "nothing played yet", no explicit reset step needed.

**Practice screen** (reuses the exercise layout, `docs/screens.md`): a "Daily warm-up" card (due count; disabled "All done for today!" when none due — same `loadWarmUp`/`recordReviewResult` as the Today session's warm-up, just reachable on its own) + a topic list. One row per concept that any complete/mastered lesson teaches, using its earliest such lesson (world then lesson order) for the title/character; accuracy dots from `ConceptStats.recent` (last 10); a "Needs practice" tag when `isWeak`. Tapping a topic runs 5 tasks from `loadPracticeTasks`.

### 3.4 Easier variant

| Topic | Rule |
|---|---|
| Content | Lesson `variants[]`: same exercise schema; not stepped, not scored, not in exercise counts, completion or mastery. `easier` only on scored exercises, must name a variant of the same lesson; variants have no `easier`; every variant referenced (build fails otherwise) |
| Trigger | Scored exercise, unsolved, `errors` ≥ 2 (illegal / wrong moves, wrong answers, selections, placements; hints not counted). Guided tries: never |
| Offer | Owl note on the error: "This one is tricky. Want an easier one?" + button **Easier one** (next to "Say it again"). Not forced: kid may keep trying the original (normal stars) |
| Swap | Same lesson step (stage dots unchanged); failed original logged as `Attempt` (`scored`, `correct: false`) → review scheduler (§3.1) puts the concept in box 1 (= "concept added to review"); no separate queue |
| Result | Variant solved → original exercise credited 1 star (= "completed"); variant `Attempt` logged with `scored: false`. Replaying the lesson can raise the stars |
| Resume | App closed mid-variant → resumes at the original exercise |

## 4. Use cases (app layer)

`app/…`, `domain/…` = `packages/platform-core/src/`; `core/…` = `packages/subject-chess/src/`.

| Area | Use cases |
|---|---|
| Profiles | `createProfile`, `selectProfile`, `renameProfile`, `changeAvatar`, `deleteProfile`, `resetProfileData` (cascades progress/attempts/concept stats/mini-game progress/game records/rewards, keeps the profile itself) |
| Settings (`app/settings.ts`) | `getProfileSettings` (merged over `DEFAULT_PROFILE_SETTINGS`), `updateProfileSettings` (validates, merges a patch, persists) |
| Report (`app/report.ts`) | `buildChildOverview` (Overview card), `buildChildReport` (full per-child report incl. the minutes-per-day chart's limit line and the active time-controls rules); `minutesByDay` (`app/rewards.ts`) backs both |
| Time limit (`app/time-limit.ts`) | `checkActivityGate` (reads settings + today's `SessionLog`, reports `overLimit`/`usedMinutes`/`limitMinutes`/`extraMinutes`/`reason` (`'limit'`\|`'late'`\|`'early'`\|`null`)/`remainingMinutes`), `grantExtraTime` (+`EXTRA_TIME_GRANT_MINUTES`, repeatable), `grantHoursOverride` (allows `HOURS_OVERRIDE_MINUTES` from now, resets not sums), `markTimeWarning`; domain (`domain/session-log.ts`, `domain/time-policy.ts`): `limitForDay`, `timeUsedToday`, `isOverLimit`, `grantExtraMinutes`, `setHoursOverride`, `markWarned`, `allowedHoursReason`, `minutesUntilEnd`, `shouldWarn` (all pure, clock-driven); `starsToday` (`app/rewards.ts`) backs the "See you tomorrow" screen |
| Backup (`app/backup.ts`) | `buildBackupFile`/`exportBackup` (one profile or every profile), `parseBackupFile` (validate), `buildShareFile`/`shareFileName` ("Send to other device" — same JSON, a different filename, returned instead of written) |
| Device sharing (`app/merge.ts`, behind `@learn/platform-core/merge`; pure rules in `domain/merge.ts`) | `planImport` (per-child auto-merge/choice + default), `previewChildChange` (a choice's own stars/badges/minutes-this-week delta), `importMerged` (folds the chosen children into this device's full current data, writes atomically via `BackupImporter.writeMerged`); `getOrCreateDeviceId` (`app/device.ts`) |
| Assessment | `loadUnlocked`, `submitAssessment`, `parentUnlock` (`app/assessment.ts`); domain (`domain/assessment.ts`): `planTestOutLesson`, `planTestOutWorld`, `planPlacement`, `scoreTestOut`, `scorePlacementWorld` |
| Session | `loadTodaySession`/`planTodaySession` (§3.3 order), `loadWarmUp`, `loadPracticeTasks`, `recordReviewResult` (box move); `recordExerciseResult`/`recordAttempt` also fold into `ConceptStats` (§3.1) |
| Exercise | `startExercise`, `submitMove`, `submitAnswer`, `requestHint`, `completeExercise` |
| Games | `startMiniGame`, `playMove`, `finishGame` |
| Full game | `recordGame`, `loadGameRecords`, `computerLevelStatus` (per-level locked/condition or unlocked + wins/games); `mateHint` (`core/bot/hint.ts`) |
| Friend play | `friendGameOptions` (unlocked games for the setup sheet), `recordLocalMatch` (one `GameRecord` per profile involved, guest excluded); domain (`core/game`): `startLocalMatch`, `playLocalMove`, `canTakeBack`/`takeBack`, `localMatchResult` — the same variant rules a `versus` boss plays against the bot, minus every bot concern |
| Rewards | `checkRewards` (the one call every activity choke point makes: folds today into the streak, then evaluates + persists new badges — permissive no-op without `AppDeps.rewards`/`ContentSource.catalog()`); `evaluateAndRecordBadges`, `buildBadgeFacts`, `recordDailyActivity`, `recordSessionMinutes` (`app/rewards.ts`) |

## 5. Ports

| Port | Purpose |
|---|---|
| `ProfileRepository`, `ProgressRepository`, `SettingsRepository` | Persistence (async); `ProgressRepository` also holds `ConceptStats` (`getConceptStats`/`listConceptStats`/`saveConceptStats`); `SettingsRepository`'s `AppSettings` also carries `profileSettings` (keyed by profile id) alongside `lastProfileId`/`suggestedLevels` |
| `GameRecordRepository` | Persistence of `GameRecord` (`add`/`listByProfile`/`deleteProfileData`), separate from `ProgressRepository` |
| `RewardsRepository` | Persistence of `EarnedBadge`/`Streak`/`SessionLog` (`addEarnedBadge`/`listEarnedBadges`/`saveEarnedBadge`, `getStreak`/`saveStreak`, `getSessionLog`/`saveSessionLog`/`listSessionLogs`, `deleteProfileData`), separate from `ProgressRepository`; optional on `AppDeps` |
| `AssessmentRepository` | Persistence of `AssessmentResult`/`Unlock` (`addAssessmentResult`/`listAssessmentResults`, `addUnlock`/`listUnlocks`, `deleteProfileData`), separate from `ProgressRepository`; optional on `AppDeps` |
| `BackupFileWriter` / `BackupImporter` | Backup export's file destination (web: downloads it, mirrors `PasswordFileWriter`) / import's atomic write — `writeMerged` (writes this device's entire dataset after `app/merge.ts` has folded the chosen children in, keying session-log rows by device so a foreign one never overwrites this device's own, carrying device-only settings through unchanged); never the parent password; web: stages the full write, then swaps it in; optional on `AppDeps` |
| `ContentSource` | Loads compiled content |
| `Narrator` | Speaks text keys |
| `Clock` | Current time (deterministic tests for scheduler) |
| `Random` | Seeded randomness (deterministic tests for bot, task picking) |
| `AuthService` | v1 guest; parent login parked (later, maybe) |
| `SyncService` | v1 no-op; the file-share merge (§3.5) is `app/merge.ts` directly, no port of its own; this hook stays for a later family-code sync (same merge rules) |
| `MatchService` | v1 local matches; online parked (later, maybe) |
| `FeatureFlags` | `login`, `online` (false in v1) |

## 6. Content files

```
packages/subject-chess/content/
  tracks.yaml                  tracks, worlds, habitats, ranks
  bot-book.yaml                opening book (computer-opponent.md §2); bot levels are TS, not content
  badges.yaml                  badge catalogue
  lessons/<world>/<lesson>.yaml
  minigames/<id>.yaml
  locales/<lang>/*.yaml        text by key (chess); platform's own: packages/platform-content/locales/
```

Optional, default when absent: exercise `text` ← `id`; lesson `world` ← folder name; `title`/`story` ← `<id>.title`/`<id>.story`; demo `text` ← `<id>.demo`; mini-game `title`/`goal` ← `<id>.title`/`<id>.goal`; `stars2` ← `stars3 + 1`.

Lesson:
```yaml
id: rook
order: 1
concept: rook-move
character: rhino
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
  - id: rook-02
    type: collect-stars
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
    stars2: 5              # explicit: default (stars3 + 1 = 4) doesn't match the optimal solve
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
rook-02: Help Rhino collect all the stars.
```
