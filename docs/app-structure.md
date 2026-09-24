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
- First run: welcome → set parent password (≥ 4 characters, numeric PIN allowed) → recovery code shown once (write it down) → first child profile.
- Asked for: parent area, unlock lessons, change limits, extra time, reset / delete, external links.
- 5 wrong attempts → 1-minute wait.
- Forgotten: enter recovery code → set new password. Code also lost: reset app (backup file can be imported).

## 3. Profiles

- App start: profile picker (animal avatar + nickname, no password).
- New profile: nickname → avatar → "New to chess?"
  - Yes → start at World 1.
  - No → placement test → start at first non-mastered world.
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
      ├─ Lesson (one concept)
      │  ├─ Story card (animal + rule)
      │  ├─ Demo
      │  ├─ Guided tries (hints on)
      │  ├─ Exercises (5–10 stages, 1–3 stars)
      │  └─ Boss = mini-game
      └─ World test (test-out / final check)
```

Exercise definition: position + task type + goal + answer check + hints + star criteria.

## 6. Flows

- **Session:** warm-up (3 review tasks) → next lesson → mini-game → rewards → stop at time limit.
- **Lesson:** story → demo → guided → exercises → boss → stars → unlock next.
- **Error:** undo + spoken explanation → hint ladder (piece → target squares → move) → after 2 failures easier variant + concept to review. Never blocked.
- **Skip (kid):** tap locked lesson/world → "Show you know it" test (5–8 mixed tasks) → ≥80% = mastered, unlocked; <80% = back to path, no penalty.
- **Skip (parent):** unlock any lesson/world directly.
- Skipped concepts enter the review pool like completed ones.
- **Play vs Friend (same device):** Play → vs Friend → second player (other profile or guest) → game (full game, Pawn Wars, Win the Queen) → board mode → play → result saved to each profile involved.
  - Board modes: pass-and-play (board turns each move) / face-to-face (tablet flat, pieces upright for both).
  - Options: takeback by agreement, legal-move highlights on/off.
  - Availability: same as vs computer (full game after World 4, mini-games after their lesson); parent can unlock earlier.
  - No effect on mastery or stars.

## 7. Progression rules

- Lesson complete = all stages done. Mastered = ≥80% of max stars or test-out passed.
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
| Assessment | Placement test, test-out, world test |
| Mastery tracker | Accuracy per concept |
| Review scheduler | Selects old-topic tasks for warm-up |
| Rewards | Stars, badges, rank, collection ([rewards.md](rewards.md)) |
| Narration | Voice + subtitles for every text |
| Content library | Worlds/lessons/exercises as data; new content without code changes |
| Parent module | Reports, limits, settings, unlocks |

## 10. Task types

Tap square(s) · Move piece to goal · Collect stars · Capture target · Safe? (yes/no) · Find all (attacked squares / escapes) · Best move · Mate in 1 · Set up board.

## 11. Parent area

- Overview of all profiles.
- Per profile: progress by track/world/concept, weak concepts, time per day.
- Settings per profile: session limit, voice/sound, hints on/off, computer level, unlock lessons/worlds, reset.
- Profile management: add, rename, delete.
- Backup: export / import progress file (data is only on the device).

## 12. Data per profile

Nickname, avatar, lesson status + stars, per-concept accuracy, review queue, test results, game history, rewards, settings. No personal data beyond nickname.

## 13. MVP

- **In:** profiles, placement test + test-out, Basics (worlds 1–5), Today session + warm-up, 6 mini-games + computer, vs Friend (same device), My Den (basic), parent progress + limits + unlock. Guest only, data on device.
- **Next:** tracks Openings, Tactics, Checkmates & Endgames; puzzle library. Later: Strategy track.
- **v2 (online):** parent login, cloud sync, online play with friends (invite code, no chat, preset emojis).
- **v2 (time controls):** explore detailed time log, limits and exceptions (below).

### Time controls
| Feature | v1 | v2 (explore) |
|---|---|---|
| Time log | Minutes per day per profile (parent report, streaks) | Sessions: start, end, activity (lesson / practice / play); week and month views |
| Limits | One daily limit per profile | Per weekday; allowed hours (e.g. not after 20:00); separate limits for Play vs Learning |
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
| Piece look on board | Animal pieces / classic pieces / classic + animal badge | Classic + animal badge in Worlds 1–4, classic only from World 5 (transfer to real boards); parent toggle |
| "Win the Queen" (World 3, before check) | King capturable / kings removed | Kings removed |
