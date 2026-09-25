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
| `m3.1` | `mate-in-n` type, select-squares `attacked-by` / `check-escapes`, rule-verified yes-no / choice answers, check highlight |
| `m3.2` | World 3 lessons (Attack, Defend, Safe or not?, Piece values, Trades) + Queen vs Pawns, Safe or Not?, Army Battle; world boss Win the Queen (world-level boss in the catalog) |
| `m3.3` | World 4 lessons (Check, Escape check, Checkmate, Mate in 1, Stalemate) + Escape the Check, Mate in 1; world boss: first full game vs Mouse |
| `m3.4` | Mastery + review: concept stats, Leitner scheduler, warm-up, Today session (warm-up → lesson → mini-game → rewards), Practice screen |
| `m3.5` | Full game vs computer in Play (after World 4), game records, Rabbit level (beat Mouse 3×), draw rules (repetition, 50 moves), mate hint, polish → `m3` (playtest 3 by user) |
| `m4.1` | World 5 lessons (Castling, En passant, Draws) with rule-verified answers; world boss: full game vs Rabbit |
| `m4.2` | Fox, Wolf, Bear playable (unlock: beat previous level 3×), aids per level, automatic level, small opening book, Bear ≤ 300 ms |
| `m4.3` | vs Friend (same device): second player (profile or guest), face-to-face board, take back per player; full game, Pawn Wars, Win the Queen; records to each profile |
| `m4.4` | Badges (`badges.yaml`, badge engine on events, max 2 celebrations per session, My Den badges), streak (1 free skip per week), session log |
| `m4.5` | Test-out ("Show you know it") on locked lessons / worlds, placement test at first run → `m4` |
| `m5.1` | Parent area complete: overview of profiles, report per profile (progress by world / concept, weak concepts, time per day, games, badges), settings per profile (session limit, voice / sound, hints, computer level auto / fixed, piece style), reset profile; backup export / import (JSON, versioned) |
| `m5.2` | Daily time limit: minutes per profile from the session log, checked between activities only (never mid-exercise), "See you tomorrow" screen, parent password → +15 min; warning before the limit = v2 |
| `m5.3` | Design + accessibility pass: tappable vs info look (F3) on every screen, WCAG 2.2 AA parent area, contrast / reduced motion / screen-reader audit, classic pieces from World 5 (app-structure.md piece look) |
| `m5.4` | Offline + performance hardening: persistent storage request, iPad "Add to Home Screen" prompt, lazy-load parent area and later worlds, cold start ≤ 3 s, CSP, offline e2e over all worlds, Bear strength (F4) |
| `m5.5` | Release: privacy policy page, readable README (F1), easier variants for the hardest Worlds 1–2 exercises (F2), release checklist → `m5` (playtest 4 by user) |
| `retro` | After `m5` (owner request): deep retrospective of the whole process — what went well, what went wrong, learnings for a similar app, time estimate (coding, design, active collaboration with the owner, CI / pipeline, agent runs) from git history, CI runs, agent run logs and session transcripts → `docs/retrospective.md` (done 2026-09-25) |

M5 run order (2026-09-25): `m5.1` ∥ `m5.4` → `m5.2` ∥ `m5.5` → `m5.3` last (design pass covers the new M5.2 / M5.5 screens and refreshes the README screenshots) → `m5`.

### 3.2 Follow-ups (not yet scheduled in an iteration)

| # | Item | Scope | Notes |
|---|---|---|---|
| F1 | Readable documentation | Short, nice-to-read overview: root `README.md` (what the app is, who it is for, how a lesson works, screenshots, run / build) + links into `docs/` | Done (`m5.5`) |
| F2 | Easier variants content | `variants` for the hardest exercises of every lesson (Worlds 1–2) + content audit | Done (`m5.5`): every remaining World 1–2 lesson (Rook already had `rook-04-easy`/`rook-08-easy`) now has one, on its hardest scored exercise; rules: domain-model.md §3.4 |
| F3 | Tappable vs not tappable (owner, playtest) | Today info boxes (e.g. "Your moves: 48", stars pill, Owl bubble) look like buttons (same card, border). Proposal: tappable = raised card (border + bottom shadow, pressed state, icon or chevron); info = flat tinted panel, no border, no shadow; audit every screen | Done (`m5.3`): `.tap-raised`/`.info-flat` (`index.css`), shared primitives (`ui/primitives.tsx`), screens.md §1 |
| F4 | Bear stronger than Wolf | M5.4: tried null-move pruning + late move reductions + history-heuristic ordering (`docs/computer-opponent.md` §6.6); bear vs wolf 13.3% → 20.0% (N = 30, same-seed baseline vs after), still well short of ≥ 70% | Still open. Next: richer `staticEval` for Bear (mobility, king safety, passed pawns — the one M4.2 option not yet tried), isolating each of the 3 techniques' own share (measured together only, for time), wider opening-book coverage |

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
