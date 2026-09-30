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
| `m6.1` | Version text on Home (also kept in the parent area); M6 plan; Store apps → M7, Paths → M8 |
| `m6.2` | Generated voice: narrated-text inventory (static + finite template expansions), Kokoro TTS script (offline, incremental, content-hash file names), audio narrator (Web Audio, unlocked on first tap) with device-voice fallback for texts without audio, full English audio, precache |
| `m6.3` | Voice hardening: coverage check in CI (inventory = manifest), feedback note spoken on its own (no device voice mid-lesson), missed-text report from the e2e run, resume timeout before the first tap, offline size check, owner check on phone / tablet |
| `m6.4` | Illustrations (Fluent 3D): piece characters (incl. lioness), Owl, bot levels, avatars; same look on Home / Journey / Play / picker |
| `m6.5` | Owner request: "parent code" instead of "password" everywhere in the UI; first-run "Download again" removed; "Download code file" in the grown-ups area (after the code) |
| `m6.6` | Release prep (README screenshots, validation) → `m6`; shipped in `v2.0.0` together with M7 |
| `m7.1` | Time controls: Mon–Fri / Sat–Sun limits, allowed hours ("Play until" / "Not before", parent +15 min window), 5-minute warning (app-level notice on calm screens, once per child per day, spoken) |
| `m7.2` | Device sharing: merge rules, per-device session logs, "Send to other device" (share sheet), merge import with "Merge into …" / "Add as new child" |
| `m7.3` | Release `v2.0.0` (M6 + M7) → `m7` |
| `m8.1` | v4 R0a: golden snapshot of compiled content; storage / backup fixtures recorded with real `v1.0.0`, `v1.1.0`, `v2.0.0` builds, compat unit + e2e tests |
| `m8.2` | v4 R0b: faster CI (slow tests in a parallel job, sharded e2e, a11y walk once, unused font subsets out of the precache) |
| `m8.3`… | v4 R1–R5 (`docs/refactor-v4.md` §5) |

M5 run order (2026-09-25): `m5.1` ∥ `m5.4` → `m5.2` ∥ `m5.5` → `m5.3` last (design pass covers the new M5.2 / M5.5 screens and refreshes the README screenshots) → `m5`.

### 3.2 Follow-ups (not yet scheduled in an iteration)

| # | Item | Scope | Notes |
|---|---|---|---|
| F1 | Readable documentation | Short, nice-to-read overview: root `README.md` (what the app is, who it is for, how a lesson works, screenshots, run / build) + links into `docs/` | Done (`m5.5`) |
| F2 | Easier variants content | `variants` for the hardest exercise of every lesson (Worlds 1–2, `domain-model.md` §3.4) | Done (`m5.5`): one per remaining lesson |
| F3 | Tappable vs not tappable (owner, playtest) | Info boxes looked like buttons | Done (`m5.3`): `.tap-raised`/`.info-flat` tokens, shared primitives (`ui/primitives.tsx`), `screens.md` §1 |
| F4 | Bear stronger than Wolf | `computer-opponent.md` §6.6: null-move pruning + LMR + history heuristic; bear vs wolf 13.3% → 20.0% (N = 30), still short of ≥ 70% | Open. Next: richer `staticEval` for Bear, isolating each technique's own share, wider opening-book coverage |
| F5 | Mate-in-2+ outside a lesson step | Scripted-reply timer lived only in `ExerciseStep.tsx`; a mate-in-2+ in a series boss round or review task froze | Done (`m8.13`): the reply timer is part of the shared `useExerciseSession`; regression tests for a series round and a review task |
| F6 | Check ring in series boss rounds | "Escape the Check" series rounds show no check ring (lessons do); the ring is part of each square's accessible name, so changing it is a visible + a11y change | Found in the v4 R3b design (2026-09-27); kept as is in v4 (same behaviour); owner decision |
| F7 | Chess art in platform-web | Chess bot art and character colours sit in `platform-web/src/ui/art/animal-images.ts` (piece characters are drawn by the pack since `m9.1`); the math demo precaches 7 unused WebP files (≈ 35 KB) | Found in v4 R5 design (2026-09-29); moving them changes chess JS; after `v4.0.0` |
| F8 | Chess-named narrator keys | `audio-narrator.ts` still writes `chess-kids:voice-report` and sets `__chessKidsVoiceMisses` (a dev flag chess e2e reads) for every app | Found in v4 R5 design; key from `AppConfig.storagePrefix` needs a storage-compat check; after `v4.0.0` |

## 4. After MVP

| # | Milestone | Scope |
|---|---|---|
| v1.1 | Owner playtest 2 (done 2026-09-25) | Skip for Story / Demo / Try (marked skipped in the track); unmistakable buttons (≥ 3:1 edge contrast, 6 px ledge, dashed locked, info without boxes); app update applied at Home / picker, checked on load and on return (no polling) |
| M6 | Voice & art (v3 scope, pulled forward 2026-09-25) | Generated voice audio (English first), nicer illustrations, version on Home; iterations §3 `m6.x`; ships in `v2.0.0` (with M7, 2026-09-25: M6.3 merged after M7.1, no M6-only release point) |
| M8 | v4 learning-platform refactor | `docs/refactor-v4.md`; iterations §3 `m8.x`; released as `v4.0.0` |
| M9 | Store apps | Capacitor Android + iPad, native storage, store listings |
| M10 | Paths | Openings, Tactics, Checkmates & Endgames; Lichess puzzle import; path badges |
| v2 → M7 | Time controls + device sharing (offline, no server; owner 2026-09-25; iterations §3 `m7.x`; ships as `v2.0.0`) | Do: 5-min warning (app-level notice, calm screens only), limits per weekday, allowed hours; optional: Play vs Learning limits, holiday overrides, detailed time log. Sharing: merge rules + "Send to other device" file (share sheet) → import merges |
| Later, maybe | Online | Parent login, online play with friends, automatic sync ("family code": end-to-end encrypted blob on a tiny free store, same merge rules) — only if file sharing proves annoying; hooks stay in code |
| v3 | Nicer media | → M6; later languages reuse the M6 audio pipeline |
| v4 | Learning platform refactor (owner 2026-09-25) | Same features; one folder per exercise type (incl. tests) behind registries; platform packages (core, content, web) + `subject-chess` pack, reusable for other learning apps (math, programming); −12 % source, −40 % docs, CI ≈ 5 min; proof of reuse `apps/math-demo`. Plan: `docs/refactor-v4.md`; → M8 (started 2026-09-26) |

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
| Illustrations | Microsoft Fluent Emoji 3D (MIT, 256 px WebP, 3–6 KB each, bundled, license file shipped) for Owl, avatars and bot levels. Piece characters were animals (lioness = lion image, mane masked out) until 2026-09-30; now classic piece icons (row below) |
| Web hosting | GitHub Pages: delivers the app files only (first install + update checks); no user data sent |
| v2 scope | Offline only: time controls + file-based device sharing with merge; online (login, remote play, cloud sync) parked — server, child-consent law (COPPA / GDPR Art. 8), moderation, for little gain with one child at home |
| 5-min warning | App-level notice (reusable for later notices), calm screens only, never mid-exercise/game; once per child per day, spoken, info style (not tappable) |
| Device sharing | Chosen over QR / parent's cloud drive / family-code sync: share a backup file, merge on import (`domain-model.md` §3.5) + "Send to other device" via the Web Share API, download fallback. Time limit is per device between shares |
| Voice | Pre-generated audio: Kokoro-82M int8, `af_heart` voice, speed 0.92, MP3 mono 32 kbps (Apache-2.0, generated offline, no cloud TTS, no cost); one narrator voice (Owl, third-person); Web Speech API fallback for texts without audio |
| v4 numbering | v4 refactor = M8 (`m8.x` tags); Store apps → M9, Paths → M10 |
| Real piece names (owner 2026-09-30) | To make the app simpler: no animal per piece, no animal badge on boards, no "Piece style" setting. Lesson characters are the pieces (`rook` … `pawn`, art = classic piece icon); My Den shows "Your pieces". Owl, avatars, Journey habitats, bot levels (Mouse → Bear) and the Den stay. Old `pieceStyle` data still loads and is dropped on the next save. Run A (`m9.1`): code and content ids; run B: lesson texts and voice audio (~200 texts say Rhino / Elephant / …) |
| v4 size target | Production TS: no growth vs `v2.0.0` (31.6 k), trim pass before `v4.0.0` (owner 2026-09-28) |
