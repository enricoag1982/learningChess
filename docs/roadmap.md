# Roadmap — Chess for Kids

Related: [app-structure.md](app-structure.md), [curriculum.md](curriculum.md), [architecture.md](architecture.md).

Sizes: S ≈ days, M ≈ 1–2 weeks, L ≈ 3–4 weeks (one developer + AI assistance; content in parallel).

## 1. MVP scope

Basics (worlds 1–5, 23 lessons, 169 exercises), 12 mini-games on 5 game modes, computer levels 1–5, vs Friend on same device, rewards, profiles, parent area (password, report, daily limit, backup), offline web app (PWA). English.

### Mini-game modes

| Mode | Games |
|---|---|
| Tap squares | Square Hunt |
| Setup | Setup Race |
| Piece vs static board | Hungry Rook / Bishop / Queen, King Walk, Knight Maze |
| Variant vs computer | Pawn Wars, Queen vs Pawns, Army Battle, Win the Queen |
| Position series | Safe or Not?, Escape the Check, Mate in 1 |

## 2. Epics

| # | Epic | Content |
|---|---|---|
| E1 | Foundation | Workspace, tooling, CI, PWA shell, i18n, storage adapters, design tokens |
| E2 | Chess core | chess.js adapter, variant rules, board diagram / FEN parser |
| E3 | Board UI | SVG board, tap + drag, highlights, markers, animations, face-to-face mode |
| E4 | Content pipeline | YAML → Zod → JSON, content tests (solvable, keys present), locale files, board editor tool |
| E5 | Exercise engine | 8 task types, stars, hint ladder, easier variants |
| E6 | Lesson & session | Story, demo, guided, exercises, boss; Today session; review scheduler; warm-up |
| E7 | Progression | Mastery, unlocks, Journey map, test-out, placement test |
| E8 | Mini-games | 5 modes, 12 games |
| E9 | Computer opponent | Engine in worker, 5 levels, aids, automatic level, calibration test |
| E10 | Play | vs Computer, vs Friend (local match), game records |
| E11 | Rewards | Stars, rank, animal friends, badge engine + 25 badges, streak, My Den |
| E12 | Profiles & parent | Profiles, first-run setup, parent password + recovery file, parent area, daily limit + "See you tomorrow", backup export / import |
| E13 | Narration | Web Speech adapter (on-device voices), voice picker in parent area |
| E14 | Release quality | Offline hardening, persistent storage, update flow, accessibility, performance budget, privacy policy, hosting |
| C | Content (parallel) | 23 lessons YAML, stories, texts, basic AI illustrations (animals, Owl, habitats) |

## 3. Milestones

| # | Milestone | Size | Scope | Exit criteria |
|---|---|---|---|---|
| M0 | Scaffold | S | E1, E2 base | CI green; empty PWA deployed; rules tests pass |
| M1 | Vertical slice | M | E3, E4, E5 (3 types), E6 basic, 1 profile | Rook lesson end to end (story → exercises → Hungry Rook) on a tablet; progress saved; **playtest 1** |
| M2 | Worlds 1–2 | L | Remaining board / piece lessons, 7 task types, game modes 1–4, Mouse level, Journey map, profiles, parent password, stars + animal friends | Kid completes Worlds 1–2 unaided; **playtest 2** |
| M3 | Worlds 3–4 | L | Mate-in-n (8th task type), position series, review scheduler + Today, mastery / unlocks, Rabbit level, full game vs Mouse | Kid gives first checkmate; **playtest 3** |
| M4 | World 5 + Play | M | World 5, vs Friend, Fox–Bear levels, automatic level, badges, streak, My Den, test-out, placement | Full legal game incl. castling; siblings play each other |
| M5 | MVP release | M | Parent area complete, daily limit, backup, offline hardening, accessibility, performance, privacy policy | Works in flight mode on iPad + Android tablet; performance targets met; **playtest 4** |

Content track: Worlds 1–2 ready by M2, 3–4 by M3, 5 by M4, illustrations by M5.

### 3.1 Iterations (each merged + tagged `m<N>.<i>`, see [validation.md](validation.md))

| Tag | Scope |
|---|---|
| `m0.1` | Workspace + tooling; core chess (diagram / FEN, `ChessRules`); content locale pipeline |
| `m0.2` | Web PWA shell (Vite, React, Tailwind tokens, fonts, i18n), localStorage adapter, Playwright smoke + offline, Pages deploy, tag workflow |
| `m1.1` | Board UI: own SVG piece set, stars / blocked squares, tap-tap + drag, highlights, move animation, screen-reader grid |
| `m1.2` | Core exercise engine: variant rules (walls, static opponent), `collect-stars`, `select-squares`, `capture`, stars, hint ladder, solver, piece-vs-static mini-game |
| `m1.3` | Content: lesson / exercise / mini-game schemas; Rook lesson + Hungry Rook; content tests (valid, solvable within star limits, keys present) |
| `m1.4` | Lesson flow: Home → Story → Demo → Try → Exercises → Boss → Complete; narration (Web Speech + subtitles); 1 local profile; progress saved + resume |
| `m1.5` | Tablet polish, accessibility and performance checks, offline lesson e2e → `m1` |
| `m2.1` | Profiles (picker, new player: nickname + avatar), first run, parent password (file copy, reminder, 5 tries → 1 min), basic parent area (children, rename, delete, add, change password) |
| `m2.2` | Task types `yes-no`, `choice`, `best-move`, `setup`: engine, content schema, UI |
| `m2.3` | World 2 lessons: Bishop, Queen, King, Knight + bosses (Hungry Bishop / Queen, King Walk, Knight Maze: reach-the-star wins) |
| `m2.4` | World 1 lessons: Squares, Lines, Setup + Square Hunt, Setup Race |
| `m2.5` | Journey map (Worlds 1–2, habitats, lesson nodes done / current / locked), availability rules, Home: next lesson + tiles (Journey, Play) |
| `m2.6` | Mouse bot (level 1) in a worker; variant vs computer mode; Pawn + Promotion lessons; Pawn Wars |
| `m2.7` | Animal friends, stars totals, basic My Den; Play screen (unlocked mini-games) → `m2` (playtest 2 by user) |

### 3.2 Follow-ups (not yet scheduled in an iteration)

| # | Item | Scope | Notes |
|---|---|---|---|
| F1 | Readable documentation | Short, nice-to-read overview: root `README.md` (what the app is, who it is for, how a lesson works, screenshots, run / build) + links into `docs/` | No README yet; `docs/` are compact specs, not for casual readers |
| F2 | Easier variants content | `variants` for the hardest exercises of every lesson (Worlds 1–2) | Engine + UI + Rook variants: E5 follow-up PR; see domain-model.md §3 |

## 4. After MVP

| # | Milestone | Scope |
|---|---|---|
| M6 | Store apps | Capacitor Android + iPad, native storage, store listings |
| M7 | Paths | Openings, Tactics, Checkmates & Endgames; Lichess puzzle import; path badges |
| v2 | Online & time | Parent login, sync, online friends; detailed time log, limits, exceptions |
| v3 | Nicer media | Generated voice audio files per language; nicer illustrations |

## 5. Playtests

- With 1–3 kids aged 7–9, 20 min each, parent present, no help unless stuck > 1 min.
- Observe: starts alone? understands voice instructions? where stuck or bored? taps that miss?
- Record: lesson completion, first-try accuracy, hints used, wants to continue (yes / no).

## 6. MVP success metrics (on device, parent report)

| Metric | Target |
|---|---|
| Lesson completion (started → complete) | ≥ 80% |
| Sessions per week per child | ≥ 3 |
| Basics finished | Within 8 weeks of regular use |
| Kid plays full legal game unaided | At M4 playtest |

## 7. Decisions

| Topic | Decision |
|---|---|
| Illustrations | Very basic AI-generated images; one style prompt for consistency; tool terms must allow commercial use; stored in the app (offline) |
| Web hosting | GitHub Pages: delivers the app files only (first install + update checks); no user data sent |
| Voice | Browser / device voices (Web Speech API) in v1–v2; generated audio files in v3 |
