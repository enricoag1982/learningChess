# App Structure — Chess for Kids

Platform/tech independent. Pedagogy in [teaching-process.md](teaching-process.md).

## 1. Decisions

| Topic | Decision |
|---|---|
| Path | Fixed order; skippable via test-out (kid) or unlock (parent) |
| Profiles | Multiple per device |
| Theme | Animals |
| Categories | Basics linear (worlds 1–5); then tracks: Openings, Tactics, Checkmates & Endgames (any order); Strategy later |
| Play vs person | Same device only in v1 |
| Login / online | Off in v1; hooks in place (see §13) |

## 2. Modes

- **Kid mode** (default): icons + voice, no reading required.
- **Parent mode**: behind parent password. All profiles, progress, settings.

### Parent password
- Simple kid-gate, not a security boundary: password kept in plain text in a simple file.
- First run: welcome → set parent password (≥ 4 characters, numeric PIN allowed) → file saved → app shows where it is → first child profile.
- Password screen always shows the reminder: "Forgot it? It is in the file `<path>`."
- Asked for: parent area, unlock lessons, change limits, extra time, reset / delete, external links.
- 5 wrong attempts → 1-minute wait.

| Platform | File | Change password |
|---|---|---|
| Web (v1) | Browser cannot read a file from a fixed path → app keeps the password; copy saved as `Downloads/chess-for-kids-parent-password.txt` at setup and at every change | In parent area; forgotten → read the file |
| Store apps (M6) | App reads the password from `parent-password.txt` in its own Documents folder (iPad: Files app → On My iPad → Chess for Kids) | Edit the file (needs a text editor app) or in parent area. Android location to verify at M6 |

## 3. Profiles

- App start: profile picker (animal avatar + nickname, no password).
- New profile: nickname → avatar → create → placement offer (M4.5, once, only right after creating a new player — not when a parent adds a child from the parent area): Owl "Already know some chess?"
  - No → start at World 1 (default, and always available from the offer screen).
  - Yes → placement test (domain-model.md §3.2): 4 tasks per Basics world in order, ≥3/4 passes it (`masteredVia: 'placement'`); stops at the first failed world; skippable any time, keeps whatever passed so far.
- Per profile: own progress, stars, review queue, settings.

## 4. Kid navigation

| Area | Purpose | Content |
|---|---|---|
| **Today** (home button) | One-tap guided session | Warm-up → next lesson → mini-game → rewards |
| **Journey** (map) | Main learning path | Main road (Basics) splitting into 3 tracks; habitat per world, node per lesson, next node highlighted |
| **Practice** | Review | Daily warm-up; puzzles by category on unlocked topics |
| **Play** | Application | Unlocked mini-games; full game vs computer; vs Friend (same device) |
| **My Den** | Motivation | Stars, badges, animal collection, rank |

## 5. Content hierarchy

```
Journey
└─ Track (Basics = main road; Openings / Tactics / Checkmates & Endgames)
   └─ World (one habitat)
      └─ Lesson (one concept)
         ├─ Story card (animal + rule)
         ├─ Demo
         ├─ Guided tries (hints on)
         ├─ Exercises (5–10 stages, 1–3 stars)
         └─ Boss = mini-game
```

Test-out/placement (M4.5) are not a content node: they're a Journey-level interaction over a locked lesson's or world's own exercises (§6 Skip (kid)), not authored content of their own.

Exercise definition: position + task type + goal + answer check + hints + star criteria.

## 6. Flows

- **Session:** warm-up (3 review tasks) → next lesson → mini-game → rewards → stop at time limit.
- **Lesson:** story → demo → guided → exercises → boss → stars → unlock next.
- **Error:** undo + spoken explanation → hint ladder (piece → target squares → move) → after 2 failures easier variant offered ("Easier one"; kid may keep trying) + concept to review. Never blocked.
- **Skip (kid), M4.5:** tap locked lesson/world → sheet, Owl "Want to show me you already know **X**?" → choose lesson (5 tasks) or whole world (8 tasks, ≥1 per lesson) from that scope's own scored exercises, no hints, no easier variant → ≥80% first try (rounded up: lesson 4/5, world 7/8) = every lesson in scope mastered (`masteredVia: 'test-out'`), unlocked, concepts to review; <80% = back to the path, no penalty, nothing lost. A test-out'd world's boss stays available — mastered without it, counts won once played later.
- **Skip (parent), M4.5:** Parent area → child → "Unlock lessons & worlds" → per still-locked lesson/world, one **Unlock**/**Unlock world** button — no test, `masteredVia: 'parent'`, no star floor.
- Skipped concepts enter the review pool like completed ones.
- **Play vs Friend (same device, M4.3):** Play → vs Friend → setup sheet (second player, game, board mode, legal-move dots, swap colours) → friend game screen → result → Play.
  - Availability: vs Friend card unlocked once the active profile has any game unlocked (full game after World 4; Pawn Wars after Promotion; Win the Queen after Trades); only games unlocked for the active profile are offered; parent unlock is a later milestone.
  - Second player: pick another profile (avatar list) or **Guest**; no password. Active profile plays White by default; **Swap colours** toggle.
  - Games: Full game, Pawn Wars, Win the Queen — their versus rules, a human instead of the bot on the other side.
  - Board modes: pass-and-play (board flips to face the mover after every move; default on phones) / face-to-face (tablet flat, fixed orientation; the top side's pieces, labels and controls rotated 180°; default on tablets ≥ 768 px wide).
  - Controls: per player, **Take back** (asks the player now to move: "Allow take back?" Yes / No) and **Stop** (confirms, same as leaving a vs-computer game); turn indicator (avatar + nickname); legal-move dots on by default, toggle in the setup sheet.
  - Result: win / loss / draw screen naming the winner by nickname ("Guest" for a guest); **Play again** (colours swapped) / **Back to Play**.
  - Records: one `GameRecord` per profile involved (`opponent`: `profile:<id>` or `guest`); a guest gets none. No stars, mastery or review effects.
  - `Match` entity not stored in v1 (only the `GameRecord`s); `MatchService` port stays a hook for v2 (online play).

## 7. Progression rules

- Lesson complete = all stages done. Mastered = ≥80% of max stars, or `masteredVia` set (test-out / placement / parent unlock, M4.5).
- Next lesson unlocks on completion; next world on mastery of all lessons + boss win.
- Tracks unlock when Basics is mastered; any order; worlds within a track in order.
- Today session after Basics: next lesson from the least advanced track.
- Mini-game appears in Play after its lesson.
- Full game vs computer unlocks after World 4 (Check & Mate).
- Rank: Pawn → Knight (World 2) → Bishop (World 3) → Rook (World 4) → Queen (Basics) → King (all tracks).
- Finished lessons always replayable.

## 8. Animal theme

| Piece | Animal | Story hook |
|---|---|---|
| Rook | Rhino | Charges straight, any distance |
| Bishop | Elephant | Walks diagonal paths. Historical: bishop = elephant (Arabic *al-fil* → Italian *alfiere*) |
| Queen | Lioness | Rhino + elephant moves; strongest hunter |
| King | Lion | Most important; one step at a time; must stay safe |
| Knight | Horse | Jumps in an L, over anyone |
| Pawn | Caterpillar | Only forward; at the last row transforms (promotion) |
| Guide | Owl | Narrates, gives hints |

- Journey map: one habitat per world.
- Profile avatars: animals.

## 9. Functional building blocks

| Block | Role |
|---|---|
| Profiles | Create/select/delete; per-profile data |
| Board | Display, tap-tap + drag, highlights, arrows, animations |
| Rules | Legal moves; check, mate, draw detection |
| Exercise engine | Runs task types, validates, assigns stars |
| Hints | 3-step ladder |
| Computer opponent | Levels; human-like mistakes at low levels; scripted moves for tasks |
| Mini-game engine | Custom setups + win conditions (promote, capture all, capture queen, reach square, move limit) |
| Assessment (M4.5) | Placement test (new player), test-out (locked lesson/world, kid-initiated), parent unlock |
| Mastery tracker | Accuracy per concept |
| Review scheduler | Selects old-topic tasks for warm-up |
| Rewards | Stars, badges, rank, collection ([rewards.md](rewards.md)) |
| Narration | Voice + subtitles for every text |
| Content library | Worlds/lessons/exercises as data; new content without code changes |
| Parent module | Reports, limits, settings, unlocks |

## 10. Task types

Tap square(s) · Move piece to goal · Collect stars · Capture target · Safe? (yes/no) · Find all (attacked squares / escapes) · Best move · Mate in 1 · Set up board.

## 11. Parent area (M5.1)

Behind the parent gate; three screens deep — **Overview → child report → child settings** — plus a **Backup** screen off the Overview. Adult style throughout (`docs/screens.md` §1): denser text, touch targets ≥ 44 px, WCAG 2.2 AA. Tappable rows (a child's Overview card, the Backup entry, Settings' own button) look like buttons/links — raised card, border, chevron — vs. flat info panels for read-only stats (roadmap F3 decided here for the parent area only; the app-wide audit is M5.3).

| Screen | Content |
|---|---|
| Overview | One card per child: avatar, nickname, rank, total stars, minutes today / last 7 days, streak (≥ 2 days). Tap → that child's report. Also: Add child, Backup, Change password |
| Child report | Progress by world (lessons complete/mastered, stars) — worlds with no authored lessons yet are skipped. Concept accuracy (last 10 results) with a "needs practice" summary + a tag on each weak row. Minutes per day, last 14 days (bar + the exact number as visible text, so it reads to a screen reader too). Games, last 10, newest first (opponent by name, result, date). Badges earned (name + tier). Assessments (test-out/placement: kind, score, pass/fail, date). A **Settings** button opens that child's settings |
| Child settings | Rename, change avatar (moved here from the old flat overview row — one settings screen per child, not one giant list). Daily limit (off / 15 / 20 / 30 / 45 / 60 min — stored now, enforced from M5.2). Voice / sound / hints toggles. Computer level (Automatic, or a fixed unlocked level — locked ones shown, disabled). Piece style (animal badge / classic — stored now, applied from M5.3). Unlock lessons & worlds (M4.5's panel, unchanged, now living here instead of a toggle on the old flat row). Export this child's data. Reset (clears progress/attempts/concept stats/mini-game progress/game records/badges/streak/session log; keeps nickname, avatar, settings, and any assessment/unlock rows; confirmed by re-entering the parent password). Delete (unchanged: removes the profile entirely) |
| Backup | Export: one JSON file for every child, or (from a child's own Settings) just that one — `chess-kids-backup-<date>.json` / `chess-kids-backup-<nickname>-<date>.json`. Import: pick a file → preview ("2 children, 1,234 stars") → confirm → replaces **all** local data on the device (children not in the file are gone too); an invalid or too-new file shows a clear error and changes nothing |

**Settings effect now**: voice / hints / computer level take effect the next time that profile is selected (not live mid-session — the parent area is reached through "Switch player", which always ends back at the picker); sound has nothing to gate yet (no sound-effect system exists in v1); daily limit and piece style are stored only until M5.2 / M5.3 read them.

**Backup scope**: never the parent password (`ParentLockRepository`) or the device's own `lastProfileId` / "Automatic level" suggestions — a restored backup starts fresh at the picker, like any newly-set-up device.

## 12. Data per profile

Nickname, avatar, lesson status + stars, per-concept accuracy, review queue, test results, game history, rewards, settings. No personal data beyond nickname.

## 13. MVP

- **In:** profiles, placement test + test-out, Basics (worlds 1–5), Today session + warm-up, 12 Basics mini-games (5 game modes) + computer, vs Friend (same device), My Den (basic), parent progress + limits + unlock. Guest only, data on device.
- **Next:** tracks Openings, Tactics, Checkmates & Endgames; puzzle library. Later: Strategy track.
- **v2 (online):** parent login, cloud sync, online play with friends (invite code, no chat, preset emojis).
- **v2 (time controls):** explore detailed time log, limits and exceptions (below).

### Time controls
| Feature | v1 | v2 (explore) |
|---|---|---|
| Time log | Minutes per day per profile (parent report, streaks) | Sessions: start, end, activity (lesson / practice / play); week and month views |
| Limits | One daily limit per profile (confirmed for v1) | Per weekday; allowed hours (e.g. not after 20:00); separate limits for Play vs Learning |
| Exceptions | — | One-off extra time ("+15 min today"); date overrides (holidays, weekends); kid "Ask for more time" → parent enters password |
| Limit reached | Current activity finishes → "See you tomorrow" screen; parent password to continue | Owl warns 2 min before; same end flow |
| Across devices | — | With login + sync: one limit across all devices |

### Online hooks in v1
| Hook | v1 | v2 |
|---|---|---|
| Login | Guest; implicit local account owns profiles | Parent account (email link / Google / Apple) |
| Sync | None | Device ↔ cloud |
| Matches | Same-device matches | Online matches via invite code |
| Feature flags | `login: false`, `online: false` → no online entries in UI | Flags on |

## 14. Open

| Topic | Options | Recommendation |
|---|---|---|
| Piece look on board | Animal pieces / classic pieces / classic + animal badge | Classic + animal badge in Worlds 1–4, classic only from World 5 (transfer to real boards); parent toggle (M5.1: `ProfileSettings.pieceStyle`, stored per child in the parent area's Settings screen — not yet applied to the board, M5.3) |
| "Win the Queen" (World 3, before check) | King capturable / kings removed | Kings removed |
