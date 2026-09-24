# App Structure — Chess for Kids

Platform/tech independent. Pedagogy in [teaching-process.md](teaching-process.md).

## 1. Decisions

| Topic | Decision |
|---|---|
| Path | Fixed order; skippable via test-out (kid) or unlock (parent) |
| Profiles | Multiple per device |
| Theme | Animals |

## 2. Modes

- **Kid mode** (default): icons + voice, no reading required.
- **Parent mode**: behind adult check. All profiles, progress, settings.

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
| **Journey** (map) | Main learning path | Habitat per world, node per lesson, next node highlighted |
| **Practice** | Review | Daily warm-up; puzzles on unlocked topics |
| **Play** | Application | Unlocked mini-games; full game vs computer |
| **My Den** | Motivation | Stars, badges, animal collection, rank |

## 5. Content hierarchy

```
Journey
└─ World (phase, one habitat)
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

## 7. Progression rules

- Lesson complete = all stages done. Mastered = ≥80% of max stars or test-out passed.
- Next lesson unlocks on completion; next world on mastery of all lessons + boss win.
- Mini-game appears in Play after its lesson.
- Full game vs computer unlocks after World 4 (Check & Mate).
- Rank per world: Pawn → Knight → Bishop → Rook → Queen → King.
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
| Rewards | Stars, badges, rank, collection |
| Narration | Voice + subtitles for every text |
| Content library | Worlds/lessons/exercises as data; new content without code changes |
| Parent module | Reports, limits, settings, unlocks |

## 10. Task types

Tap square(s) · Move piece to goal · Collect stars · Capture target · Safe? (yes/no) · Find all (attacked squares / escapes) · Best move · Mate in 1 · Set up board.

## 11. Parent area

- Overview of all profiles.
- Per profile: progress by world/concept, weak concepts, time per day.
- Settings per profile: session limit, voice/sound, hints on/off, computer level, unlock lessons/worlds, reset.
- Profile management: add, rename, delete.

## 12. Data per profile

Nickname, avatar, lesson status + stars, per-concept accuracy, review queue, test results, game history, rewards, settings. No personal data beyond nickname.

## 13. MVP

- **In:** profiles, placement test + test-out, Worlds 1–5, Today session + warm-up, 6 mini-games + computer, My Den (basic), parent progress + limits + unlock.
- **Next:** Worlds 6–7, puzzle library, pass-and-play between profiles, online play, sync.

## 14. Open

| Topic | Options | Recommendation |
|---|---|---|
| Piece look on board | Animal pieces / classic pieces / classic + animal badge | Classic + animal badge in Worlds 1–4, classic only from World 5 (transfer to real boards); parent toggle |
| "Win the Queen" (World 3, before check) | King capturable / kings removed | Kings removed |
