# v4 — Learning platform refactor

Owner request (2026-09-25): same features, better structure (e.g. one folder per exercise type incl. its tests), easier to extend, less size and duplication, and a structure reusable for other learning apps (learn math, learn programming). Sources: 3 read-only code reviews (exercise pipeline, web app, tests / content / docs), `docs/retrospective.md` §5–6. Baseline: `master` after M6.4.

## 1. Baseline

| Area | Source lines | Test lines | Note |
|---|---|---|---|
| `packages/core` | 9.1 k (≈ 4.6 k generic, 4.5 k chess) | 11.6 k | `index.ts` exports 348 names, 106 never imported |
| `packages/content` | 2.9 k + 4.5 k YAML | 4.8 k | `lesson-load.ts` 1.5 k lines, 66 % per exercise type |
| `apps/web` | 17.0 k | 7.6 k unit + 4.1 k e2e | `store.ts` 1.1 k lines, 23 screens |
| Docs | 245 KB | — | `architecture.md` 68 KB, of which 50 KB milestone history |
| CI (`quality`) | ≈ 10 min | unit ≈ 2 min, e2e 92 tests ≈ 9 min | a11y curriculum walk ≈ 3 min × 4 browser projects |

## 2. What makes change expensive today

| # | Finding | Evidence |
|---|---|---|
| 1 | A new exercise type touches ≈ 15 files in 4 packages (≈ 800 lines incl. tests) | `select-squares`: types, engine, schema, loader, reducer, play area, texts, step, e2e helpers, playground, 5 test files |
| 2 | ≈ 30 `switch` / if-chains on exercise type or mini-game mode in production code, ≈ 15 more in tests | engine, solver, loader (8), reducer, play area, boss steps, e2e helpers |
| 3 | Same logic written 2–6 times | SAN normalising ×6, piece-map equality ×3, "capture goal reached" ×4, mate-line replay ×4, castling / en passant ×2, static-goal → exercise ×2; ≈ 250 lines of chess facts live in the content loader |
| 4 | Chess wired into generic modules | `Lesson` carries a chess `position`; rewards replay SAN (lost queen, promotion, castling); badges / settings / journey habitats / Den glyphs / report name chess things; web: 10 leak sites (Home, Journey, Den, summary, parent settings / report, services type) |
| 5 | Navigation state spread over 5 fields | `lessonOrigin`, `miniGameOrigin`, `newPlayerReturnsToParent`, `passwordPurpose`, `pendingActivity` (a function in state); `screen` set in 40 places |
| 6 | UI repeated by hand | 44 inline icon components (727 lines, back ×5, close ×4, lock ×6), `tap-raised` class strings ×63 (30 variants), 5 confirm dialogs, 14 header buttons, 7 hand-written loading effects, `useNarratedText` + bubble + replay trio ×20 |
| 7 | Storage adapters | 7 repositories (886 lines) in only 3 shapes (keyed map, capped list, single record); `toPromise` ×8 |
| 8 | Test scaffolding copied | core builders up to 14 copies (`makeExercise` 14, `makeLesson` 13, `makeDeps` 12, ≈ 2.2 k lines); `playExerciseToCompletion` ×4; e2e helpers re-implement i18n interpolation, journey order, SAN, versus play |
| 9 | Content boilerplate | `text: <id>` in 264 / 264 exercises, `title` / `story` / `goal` keys always `<id>.<field>`, `world` = folder, `stars2 = stars3 + 1` in 48 / 52 (≈ 470 derivable YAML lines) |
| 10 | Docs and comments carry history | architecture decision rows up to 7.9 k characters; comments = 23 % of web source characters, some now wrong (`DenScreen.tsx:102`, `persistent-storage.ts:3-11`) |
| 11 | Latent bug | mate-in-n reply timer only in `ExerciseStep`: a mate-in-2+ inside a boss series or review task would freeze (today all 27 are mate-in-1) |

## 3. Target structure

```
packages/
  platform-core/          pure TS: profiles, lesson flow (story → demo → try → exercises → boss),
                          progress / mastery / stars, spaced review, assessment / placement, journey,
                          rewards + badge engine (events, not chess rules), streak, time policy,
                          settings (+ subject settings slot), backup / merge, ports,
                          exercise-kind registry + generic kinds: choice, yes-no, multi-select;
                          mini-game mode: series; testing/ (shared builders + fakes)
  platform-content/       YAML → Zod → JSON pipeline, kind registry for schema / compile / verify,
                          default text keys, locale checks, voice-text inventory
  platform-web/           app shell: route stack + store slices; screens: picker, Home, Journey, Today,
                          Practice, My Den, parent area, time limit; notice layer, error boundary;
                          design system (primitives, icons, ScreenHeader, ConfirmDialog, NarratedBubble);
                          storage collections; narration (audio + device voice); PWA update; i18n;
                          testing/ (setup, render-app, e2e page objects driven by kind solutions)
  subject-chess/
    pack.ts               the SubjectPack below
    core/                 rules (chess.js adapter), variants, facts (SAN, pieces, goals, castling …),
                          bot, games / friend play, chess reward events + badge conditions
    kinds/<type>/         def.ts · engine.ts · schema.ts · compile.ts · verify.ts · PlayArea.tsx ·
                          solution.ts · sample.ts · *.test.ts      (collect-stars, capture, best-move,
                          mate-in-n, setup; select-squares = multi-select on the board surface)
    modes/<mode>/         static, versus (same file set)
    web/                  board + pieces (Surface), Play tab (routes + slice + screens), parent panels,
                          Den stats, art map, rank glyphs
    content/              lessons/, minigames/, tracks, badges, locales, art, audio
apps/
  chess-kids/             thin shell: vite config, index.html, manifest, pack wiring, e2e specs
  math-demo/              proof of reuse (R5), dev / test only
tools/                    voice, art, compat, size, content snapshot
```

**Extension points** (only what chess + the math demo need; no speculative hooks):

| Interface | Provides |
|---|---|
| `ExerciseKind` (core) | `schema`, `compile`, `textKeys`, `verify?` (build-time answer check), `init`, `act` (check answer → feedback), `hint`, `stars?`, `solution(def)` + `wrongAction?(def)` — one solution drives content tests, loader solvability, e2e |
| `ExerciseKindUI` (web) | `PlayArea`, feedback text, `sample` (dev playground), e2e `perform(page, action)` |
| `MiniGameMode` | same pattern for series / static / versus: schema, compile, check, summarise, `isWin`, Step component, e2e play |
| `SubjectPack` | `stimulus` schema (chess: position + last move; math: expression / number line), `Surface` component, kinds, modes, facts, Home tiles + routes + store slice (chess: Play), parent settings panels, report formatters, Den stats, reward events + badge conditions, character art, rank glyphs, locales, services (rules, bot) |

## 4. Rules for v4 code

| Rule | Why (finding / retro) |
|---|---|
| One exercise type = one folder; the registries are the only dispatch on `type` / `mode` (review grep in CI) | 1, 2 |
| One helper per fact (SAN, pieces, goals) in `subject-chess/core/facts`; content and e2e import it | 3 |
| Platform code never imports `subject-*`; enforced by an ESLint import boundary | 4 |
| Navigation = typed `Route` stack (`navigate`, `back`, gated routes); no origin fields | 5 |
| UI through the design system only (icons, `TapButton`, `ScreenHeader`, `ConfirmDialog`, `NarratedBubble`, `useAsync`) | 6 |
| Storage = 3 generic collections (`keyed`, `cappedList`, `singleton`); keys and backup format unchanged | 7 |
| Tests use the shared kits; e2e by stable ids / roles and kind solutions, not visible text | 8, retro §6 |
| YAML defaults: text / title keys from ids, world from folder, `stars2` from `stars3`, versus rule presets | 9 |
| Comments state intent only; history lives in `validation.md` / retrospective; decision rows ≤ 2 lines | 10 |

## 5. Phases (milestone M8; each iteration = PR + tag `m8.<i>`; the app ships after every one)

| Phase | Scope | Exit check |
|---|---|---|
| R0 Safety net | Golden snapshot of compiled `content.json`; storage-compat fixtures (localStorage dumps + backup files from v1.0–v2.0 load unchanged); split slow tests (`*.slow.test.ts`: winnability, bot self-play / timing, perft, build) into a parallel CI job; a11y curriculum walk on chromium only, seeded scans elsewhere; skip unused font subsets in the precache (−72 KB) | CI ≈ 5 min; snapshot + fixtures green. Done: `m8.1` snapshots + fixtures, `m8.2` CI speed (3.7 min). R1: `m8.3` docs trim (279 → 172 KB), `m8.4` core test kit (−2.2 k test lines) + 146 dead exports removed; web test kit, e2e helper reuse, comment trim after the other session's UI fixes merge |
| R1 Kits + trim | `platform` testing kits (builders, fakes, vitest setup file, e2e page objects reusing core), dead exports / `FeatureFlags` removed, docs trimmed (decision rows → 1–2 lines, validation log compacted), stale comments removed | −1.5 k test lines, −95 KB docs, no behaviour change |
| R2 Web platform pieces | Design-system components + icon set, storage collections, route stack + store slices, one profile-load path | −1.8 k web lines; 92 e2e green. Done: `m8.5` storage collections (−146 lines). Rest after the other session's UI fixes merge |
| R3 Exercise-kind registry | `ExerciseKind` / `ExerciseKindUI` / `MiniGameMode`; move each type and mode into its folder (core + content + web + e2e together); shared `useExerciseSession` (fixes finding 11) and boss result panel; chess facts out of the loader; YAML defaults | new type = 1 folder + 1 registry line; content snapshot equal. Iterations: `m8.6` core (facts, kinds, modes) done; `m8.7` content kinds done (loader 1 459 → 376 lines); `m8.8` YAML defaults done; `m8.13` web kinds done; `m8.14` web modes + e2e via core solutions done — R3 done |
| R4 Platform / subject split | Seams first (in place), then package moves; packages `platform-*` + `subject-chess`; decouple rewards, badges, settings, Den, report, services; import boundary lint (design §11) | platform builds and tests without `subject-chess`. Iterations: `m8.15` core seams done (ratchet 28 → 12); `m8.16` content seams + settings slot + locale split done (ratchet → 4); `m8.17` web seams; `m8.18` package moves; `m8.19` docs |
| R4.5 Trim | Production TS back to ≤ 31.6 k (`v2.0.0`): remove the R4 content-boundary casts, merge thin seam files, cut stale comments; bundle analysis (initial JS ≤ 186.2 KB) | size check green, no behaviour change |
| R5 Proof of reuse + release | `apps/math-demo`: 1 world, 3 lessons, kinds choice + number-entry, series boss, own locales / art; e2e: complete a lesson, parent area, backup. Chess app released as `v4.0.0` (same features) | both apps green in CI |

Started 2026-09-26 (owner), after `v2.0.0`. While another session fixes v2 bugs in `apps/web/src/ui/**`, R0–R1 stay out of those files; web test kit, e2e helper reuse and comment trim follow once those fixes merge.

## 6. Targets

| Metric | Now | v4 target |
|---|---|---|
| Files to add an exercise type | ≈ 15 in 4 packages | 1 folder + 1 registry line |
| Type / mode dispatch sites | ≈ 45 | registries only (≤ 4) — web: 0 outside the 4 registries at `m8.14` (a vitest grep test enforces it), down from 2 (`BossStep.tsx`'s mode if-chain) at `m8.13` |
| Production TS lines | ≈ 29 k | No growth vs `v2.0.0` (31.6 k); trim pass before `v4.0.0` (owner 2026-09-28; was −12 %) (tracked: `v2.0.0` 31.6 k → `m8.7` 33.1 k → `m8.9` 32.0 k (core / content compaction) → `m8.11` 32.0 k → `m8.12` 31.3 k (web compaction) → `m8.13` 31.6 k (web kinds: per-kind files outweigh the deleted switches) → `m8.14` 31.6 k (web modes + e2e via core solutions: boss-panel dedup ≈ cancels the new sample.ts fixtures). → `m8.15` 32.0 k (seam types: `SubjectCore`, `AppConfig`, base types). → `m8.16` 32.5 k (content seams, generic pipeline). Initial JS 187.1 KB at `m8.16` vs 186.2 at `v2.0.0`: bundle analysis before `v4.0.0`) |
| Test lines | ≈ 28 k | −2.5 k, faster |
| Lesson YAML | 4.5 k lines | −470 |
| Docs | 245 KB | ≈ 150 KB (`m8.3`: 172 KB) |
| CI `quality` | ≈ 10 min | ≈ 5 min (+ slow job in parallel) (`m8.2`: 3.7 min) |
| Initial JS | 181.5 KB gz | ≤ now |
| Features | — | identical: 92 e2e green, content snapshot equal, old storage and backup files load |

Effort: ≈ 10 iterations (R2–R4 two each); at the M5 rate (1.2–2.6 h spec → merge) ≈ 15–25 h, mostly agent time.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Behaviour drift during moves | R0 snapshot + storage fixtures + full e2e on every phase; moves and logic changes in separate commits |
| Over-abstraction for one subject | Interfaces limited to what chess + math demo use; R5 is the acceptance test |
| Users lose progress | Storage keys, schema version and backup format unchanged (fixtures) |
| Conflicts with feature work | Feature freeze during R3–R4; one agent per package at a time |
| Long-lived branches | One phase per PR, merged within a day |

## 8. Decisions for the owner

| # | Question | Recommendation | Status |
|---|---|---|---|
| 1 | Package split | 3 platform packages + 1 subject package, one repo | Applied (R4 start 2026-09-27; no objection) |
| 2 | Proof of reuse | `apps/math-demo` in the repo (dev / test only, not deployed) | Same, before R5 |
| 3 | Timing | After `v2.0.0`; R0–R1 may start earlier (no behaviour change) | Decided: start now (owner 2026-09-26) |
| 4 | Separate platform repo / npm package | Later, when a second real app starts | Later |
| 5 | Size target | "No growth" vs `v2.0.0` instead of −12 % | Decided (owner 2026-09-28) |

## 9. R3 design (2026-09-27)

| Piece | Decision |
|---|---|
| `ExerciseKind<Def, State, Action, Outcome, Hint, Ctx>` | `type`, `input` (static-move / real-move / select / answer / place), `init`, `act → {state, outcome}`, `hint`, `stars`, `textKeys?`; method signatures so precise kinds widen without casts |
| Registries | `EXERCISE_KINDS` (+ `kindOf`) = the only dispatch on exercise type; `EXERCISE_SOLUTIONS` (`solution`, `wrongAction`) kept out of the app bundle, used by tests / content checks / e2e; `MINI_GAME_MODES` (+ `modeOf`) |
| Core layout | `domain/chess/facts/` (SAN, pieces, goals, special moves, line replay: one helper per fact) · `domain/exercise/kinds/<type>/` (def, engine, solution, kind, tests) · `domain/exercise/modes/<mode>/`; `engine.ts` = legacy facade (735 → 73 lines) until R3b, then deleted (`m8.13`) |
| Content layout (`m8.7`) | `src/kinds/<type>/` schema · compile · verify; `src/modes/<mode>/`; loader generic. File names match core so R4 merges both halves into `subject-chess/kinds/<type>/` by move |
| Context | `VariantRules` + `chess: ChessRules` (additive) |
| Web kinds (`m8.13`) | `apps/web/src/kinds/<type>/` (`ui.ts` = core outcome → UI patch, `PlayArea.tsx`) behind `EXERCISE_KIND_UI`; `useExerciseSession` shared by lesson step, series round and review task (reply timer → F5 fixed); note texts as data in core (`EXERCISE_NOTES`, also feeds the voice inventory); legacy `engine.ts`, `adapt.ts`, `minigame.ts`, `versus.ts`, `boss-result.ts` deleted |
| Web modes + e2e (`m8.14`) | `apps/web/src/modes/<mode>/Step.tsx` behind `MINI_GAME_MODE_UI`, shared `useBossRun` + `BossResultPanel`; `Board`'s grid carries `data-fen`; e2e driven by each kind's/mode's own `EXERCISE_KIND_E2E`/`MINI_GAME_MODE_E2E` (`kinds|modes/e2e-registry.ts`), folded over `solutionOf(def)` — replaces the fixed mate wait, SAN normalizing and FEN-vs-aria-label comparisons; `kinds/<type>/sample.ts` (`import.meta.glob`) replace the playground's inline fixtures; ESLint + a vitest grep test keep type/mode dispatch inside the 4 registries. R3b done |

## 10. R2 web design (2026-09-27)

| PR | Scope | Key decisions |
|---|---|---|
| A test kits (`m8.8`) | vitest `setupFiles`; `src/testing/` (`renderApp`, `createTestServices`, fixtures, board, bot, fake narrator, seeds); `e2e/kit/` (content + journey via core `mainTrackLessons` / `findWorld`, i18n via the app's own options, `withAppStorage` over the real repositories, page flows); `e2e/helpers.ts` = barrel | e2e reuses app / core code instead of re-implementing i18n, journey order, storage shapes |
| B design system (`m8.10`) | `ui/ds/`: icon set (44 inline icons → one base), `TapButton` looks + `tone` (was `role`, clashed with ARIA), `Screen`, `ScreenHeader`, `RoundIconButton`, `ConfirmDialog`, `NarratedBubble`, `useSpeak`, `useAsync`, `AvatarBadge`; parent-only pieces lazy | Same DOM, roles, labels, class sets; built CSS byte-identical |
| C navigation (`m8.11`) | Typed `Route` union + stack (`navigate`, `replace`, `back`, `reset`), `ROUTE_META` (tracked / calm / gated), gate resume as data (`NavOp`, no closure); store slices (nav, profile, rewards, time, learn, today, play); one profile-load path; comment trim (≈ −820 lines) | Removes the 5 origin fields; screens read params via `useRoute` |
| R3b web kinds | `ExerciseKindUI` per kind, `useExerciseSession` (fixes F5), mode UI registry, e2e solving via core `solution()` | Done (`m8.13`, `m8.14`) |

## 11. R4 design (2026-09-27)

| Piece | Decision |
|---|---|
| Packages | `@learn/platform-core` (pure TS), `@learn/platform-content` (Node, zod), `@learn/platform-web` (React), `@learn/subject-chess`, app `@learn/chess-kids`; not published (§8 #4) |
| Order | Seams in today's packages under an ESLint ratchet (leaky files listed, count → 0), then `git mv` commits with an import codemod only (no logic) |
| `SubjectCore` | `id`, `context` (kind ctx = rules), `kinds`, `modes` (platform adds `series`), `notes` + `noteVars`, `characters` (`{topicKey}`; absent = narrator), `settings` slot (defaults, validation, lazy backup shape), `rewards?` (facts from game records → badge condition values), `gameRecordOf?`; `createSubjectRuntime(core)` builds the registries |
| `AppConfig` | Storage prefix, backup app id, file prefixes, version; chess values unchanged (`chess-kids:`, `chess-kids`) |
| `SubjectContent` | Stimulus head / tail compile, demo schema, badge fields, extra outputs (`bot-book.json`), voice templates |
| `SubjectWeb` | Services, locales, kind / mode UIs, surface (Story, Demo, View), character badge, routes + slice + Home tiles (augmentable interfaces), art, Den glyphs / stats, lazy parent panels, dev playgrounds; e2e drivers in `subject-chess/e2e` |
| Stimulus | Type-level only: chess `position` / `lastMove` stay flat in defs and demo → content JSON byte-equal |
| Stays platform | Journey habitats (animal theme), `GameRecord` (generic 2-player log), storage keys, schema version, backup format |
| Locales | Platform + subject roots deep-merged per namespace (duplicate key = build error); snapshot sorted once (order-only diff) |
| Boundaries | ESLint: platform never imports subject; platform-core / -content no React; subject core / content no web; apps only via package `exports`; `chess.js` only in the rules adapter |
| Build | Packages export TS source; `resolve.dedupe` for react / i18next / zustand / zod; Tailwind `@source` per package; CI job names unchanged; Pages uploads `apps/chess-kids/dist` (same URL, same `sw.js`) |
| R5 needs | Generic `choice` kind in platform, `number-entry` kind, math stimulus + surface, Home grid columns from tile count, `defineAppConfig` + `mountApp` (m8.17) |

