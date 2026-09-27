# Architecture — Chess for Kids

Related: [teaching-process.md](teaching-process.md), [app-structure.md](app-structure.md).

## 1. Requirements

- **Offline app**: v1 has no server; everything runs and stores on the device. Network only to install / update the app.
- Browser first; Android / iPad later.
- Storage abstracted; simplest implementation first, cloud later.
- Rich interaction, polished UI; per-platform variants possible.
- Strong separation of concerns; automated tests to iterate safely.
- Multi-language; English first.

## 2. Stack

| Layer | Pick | Reason |
|---|---|---|
| Language | TypeScript (strict) | Types enforce layer boundaries; one language end to end |
| UI | React + Vite | Mature ecosystem, fast builds |
| Styling / motion | Tailwind CSS + Motion | Consistent design, smooth animations |
| Board | Own SVG component | Full control: stars, blocked squares, animal badges, arrows, tap-tap; crisp on tablets |
| Chess rules | chess.js (BSD-2) + own variant layer | Standard rules from chess.js; variants (no kings, custom win conditions) in own layer |
| Computer opponent | Own engine (minimax depth 1–4 + controlled mistakes) in a Web Worker | Weak human-like play for kids; no GPL; UI stays smooth. Details: [computer-opponent.md](computer-opponent.md) |
| Content | YAML (authoring) → Zod validation → JSON (runtime) | Readable, commentable lessons; app loads plain JSON |
| i18n | i18next | English first, more languages without code changes |
| Narration | `Narrator` port: pre-generated audio files primary, Web Speech API (device voices) fallback | One port; swapping the underlying voice needs no caller changes |
| App state | Zustand (minimal; logic stays in domain): screen, profile, progress, current lesson + step; exercise / game state local to the step component (reducer over core engine functions); services injected (`createServices`) for tests |
| Content text keys | Content ids are plain strings in core; UI resolves them through one helper (`tContent`); all other UI keys are type-checked |
| Plural text | i18next plural suffixes (`_one`, `_other`, …) allowed on text leaves; languages compared by base key |
| Layout | Tablet landscape: board left, panel right; below 1024 px wide: board on top, panel below; phone: one-row top bar with phase chip |
| Profiles | App start: first run while no parent lock exists, else profile picker (last used first); avatars = 8 fixed animal ids; nickname 1–12 characters |
| Parent lock | Plain-text parent code (kid-gate; UI says "parent code") in localStorage + downloaded copy `chess-for-kids-parent-code.txt`; lockout state persisted; `PasswordFileWriter` port (store apps: Documents file, M8) |
| Mini-games | Union by `mode`: `static` (goal capture-all / collect-stars, par, move limit), `series` (rounds of any exercise type, stars by total mistakes = errors + hint levels), `versus` (bot) |
| Journey rules | Catalog in `tracks.yaml` (tracks, worlds, habitats, ranks) → `tracks.json`; statuses derived (never stored): lesson locked / available / complete / mastered, world locked / available / mastered / coming-soon (no authored lessons; never blocks later worlds), next lesson, rank; parent / test-out unlocks as an id set. World boss: optional `boss: <mini-game id>` per world, compiled to `World.boss?`; status locked / available (every lesson of the world complete or better, world not locked) / won (`MiniGameProgress.wins >= 1`, any route) / none; gates world mastery alongside lesson mastery; "next step" (Home / Journey highlight) is the world boss once its world's lessons are all done and it is unwon; build fails if `boss` names an unknown mini-game or one whose `unlockAfter` lesson is outside that world |
| Game rules | `domain/game`: variant rules (kings on/off, no-moves lose / draw, win conditions per side: checkmate, promote, capture-all, capture piece, reach, survive; move limit) + standard draws (stalemate, insufficient material, threefold, 50-move) |
| Bot engine | `domain/bot`: level mix of random / shallow / alpha-beta search (computer-opponent.md §3), seeded `Random` (mulberry32) for determinism; search runs on `SearchBoard` (chess.js internal move functions + its own incremental Zobrist hash) → chess.js pinned to an exact version. Bear only: transposition table + killer moves + quiescence + 250 ms iterative-deepening cap (computer-opponent.md §6.5); meets 300 ms (p50) / 600 ms (p95, CI) on the reference set; short of true depth 4 in a wide-open opening (known limitation) |
| Web delivery | PWA (vite-plugin-pwa / Workbox) | Browser + home-screen install; everything precached, fully offline ([non-functional.md](non-functional.md)) |
| Fonts | Self-hosted | Offline, no third-party requests |
| Mobile | Capacitor (Android + iPad) | Same web app packaged for stores |
| Package manager | pnpm workspaces | Shared core across apps |

## 3. Layers

```
ui (React screens, Board) ──> app (use cases, state) ──> domain (pure TS)
                                     │ ports
                                     ▼
                     adapters: storage, narration, platform
content (YAML lessons ─build─> JSON) ──> loaded by app, validated against domain
```

| Layer | Contains | Depends on |
|---|---|---|
| domain | Rules, variants, exercises, mastery, review scheduler, bot, assessment | Nothing (no React, storage, browser) |
| app | Use cases (`startSession`, `submitMove`, `completeLesson`, `testOut`, `createProfile`); port interfaces | domain |
| adapters | Storage, narration, platform implementations | app ports |
| ui | Screens, Board, components | app |
| content | Lessons, exercises, stories, translations | domain schemas |

## 4. Repository layout

```
packages/core      domain + ports; exercise types in domain/exercise/kinds/<type>/ (registry: kinds/index.ts), mini-game modes in modes/<mode>/, chess facts in domain/chess/facts/
packages/content   lessons (YAML), schemas, locales, build + import scripts
apps/web           React UI + web adapters (PWA; Capacitor wraps it)
apps/native        only if a native UI is ever needed; reuses core
```

## 5. Ports

| Port | Adapter v1 | Later |
|---|---|---|
| `ProfileRepository` | localStorage | IndexedDB / native storage → cloud (Supabase, Firebase) |
| `ProgressRepository` | localStorage | same |
| `SettingsRepository` | localStorage | same |
| `Narrator` | Pre-generated audio (Kokoro), Web Speech API (`localService`) fallback for texts without audio | More languages' audio |
| `Platform` | Web | Capacitor (haptics, native storage) |
| `AuthService` | Guest (local account) | Parent login (e.g. Supabase Auth) |
| `SyncService` | No-op | Device ↔ cloud |
| `MatchService` | Local (same device) | Online realtime (e.g. Supabase Realtime) |
| `FeatureFlags` | Static config (`login`, `online` = false) | Remote config |

- All repository methods async (cloud-ready).
- All records: UUID ids, `createdAt` / `updatedAt` (sync-ready).
- Online disabled in v1: ports exist, only local adapters implemented.
- iOS Safari may evict website storage after 7 days without use; home-screen PWA / Capacitor avoid it.

## 6. Content format

| Element | Format |
|---|---|
| Lesson | YAML, one file per lesson |
| Build | Zod schema validation → compiled JSON; no YAML parser at runtime |
| Text | Per-language locale files, referenced by key; translators never edit lesson structure |
| Position | Board diagram (`*` star, `x` blocked) or FEN |
| Moves | SAN (e.g. `Rxa8#`) |
| Bulk puzzles | Import script from Lichess puzzle database (CSV, CC0), filtered by theme/rating |

Example (`text` and `stars2` default — see domain-model.md §6 — shown here explicit-only where they differ):
```yaml
id: rook-02
concept: rook-move
type: collect-stars
board: |               # rank 8 on top; * = star, x = blocked
  . . . . * . . .
  . . . . . . . .
  . . . . . . . .
  * . . . * . . .
  . . . . . . . .
  . . . . . . . .
  . . . . . . . .
  R . . . . . . .
stars3: 3              # moves for 3 stars
stars2: 5              # explicit: default (stars3 + 1) doesn't match the optimal solve
```

## 7. Mobile path

| Option | Reuse | Pros | Cons |
|---|---|---|---|
| PWA | 100% | Zero work | No iOS App Store; iOS limits |
| **Capacitor** (chosen) | ~100% | Stores; native storage/audio | Web-view (fine for 2D board) |
| React Native | core only | Native feel | Second UI; only if web-view insufficient |

## 8. Tests

| Level | Tool | Scope |
|---|---|---|
| Domain | Vitest | Rules, variants, mastery, scheduler, bot |
| Content | Vitest | Every exercise: schema valid, valid position, legal solution, solution reaches goal within star limits; all text keys present in every locale |
| Components | React Testing Library | Board interaction, lesson flow |
| End-to-end | Playwright | Create profile → lesson → mini-game → progress persisted |
| Static | `tsc` strict, ESLint (typescript-eslint `strictTypeChecked` + layer rules), Prettier | Every PR via CI |
| Slow unit (M8.2) | Vitest, `*.slow.test.ts`, `pnpm test:slow` | Bot self-play / strength / timing, winnability, deep perft; excluded from `pnpm test` |
| CI (M8.2) | GitHub Actions `ci.yml` | Parallel jobs `checks` (format, lint, typecheck, unit, build, size, compat, voice), `slow`, `e2e` × 3 shards; `quality` = the one required check, green only if all succeed. Full a11y curriculum walk on chromium; tablet / tablet-portrait / phone reach the same 21 scan points by seeded progress |
| Content snapshot (M8.1) | Vitest `toMatchFileSnapshot` | Every `dist/` output of the content build (`compileAll`), pretty JSON in `packages/content/src/__snapshots__/content/`. Changes only with a deliberate content change: `pnpm --filter @chess-kids/content exec vitest run -u`, review the diff |
| Storage compat (M8.1) | Vitest + Playwright | `apps/web/test-fixtures/storage/<tag>/`: localStorage + backup files recorded with real `v1.0.0`, `v1.1.0`, `v2.0.0` builds; load and merge snapshots must stay equal; add a fixture per release (folder README) |
| Test kit (M8.4) | `@chess-kids/core/testing` | Builders (`makeExercise`, `makeLesson`, …), in-memory fakes of every port + `makeDeps`, `playExerciseToCompletion`; subpath only, never in the app bundle. Core, content and web adapter tests use it instead of local copies |

## 9. Rejected

| Option | Reason |
|---|---|
| JSON for authoring | No comments, no multi-line text, error-prone by hand |
| Flutter | Heavy web build, few chess libraries, Dart-only |
| Unity / Godot | Overkill for 2D board; heavy web builds |
| chessground, Stockfish | GPL-3.0 (license would propagate); Stockfish too strong for target |
| React Native first | Slower browser start |

## 10. Decisions

| Topic | Decision |
|---|---|
| Languages | Multi-language via i18n; English first |
| Narration | Pre-generated audio (Kokoro, `voice.md`) primary; Web Speech API (device voices) fallback for texts without audio |
| Mobile | PWA first → Capacitor |
| Online (login, sync, remote play) | Off in v1; ports + local adapters only |
| Content format | YAML authoring → JSON runtime; locale files; board diagram or FEN; SAN moves |
| Web hosting | GitHub Pages (static files only: install + update checks) |
| Illustrations | Microsoft Fluent Emoji 3D (MIT), bundled WebP |

## 11. Implementation notes

| Topic | Note |
|---|---|
| Tooling | pnpm workspace; TypeScript 6.0 (`strict`, `noUncheckedIndexedAccess`, erasable syntax only); Vitest; Playwright |
| Internal packages | Export TS source, no package build; relative imports carry `.ts` → same files run in Vite, Vitest, `tsc` and Node |
| Lint layer rules | `domain` imports no app / adapters / React; `chess.js` only behind `chessjs-rules.ts` |
| Formatting | Prettier for code, YAML, JSON; Markdown excluded (hand-formatted) |
| Position | Plain JSON: pieces, markers (stars, blocked), side to move, castling, en passant; no move clocks (50-move / repetition come from game history) |
| Rules | `ChessRules` interface over chess.js; positions without kings allowed (lessons, Pawn Wars); missing promotion piece → queen; variant layer (blocked squares, custom win conditions) |
| Content build | Runs on `pnpm install` (`prepare`) and `pnpm build`; output `packages/content/dist/` (git-ignored); fails on invalid board, unsolvable exercise, `stars3` ≠ solver optimum, mini-game `par` ≠ optimum, unknown id reference, missing text key, bad `verify`/`derive` answer |
| Locale files | `locales/<lang>/<namespace>.yaml`; keys lowercase kebab; `en` = reference; missing / extra keys fail build and tests; i18next keys type-checked |
| Storage | localStorage keys `chess-kids:<name>`; stored schema version + ordered migrations; newer-schema data refused, never overwritten; an additive optional field needs no version bump (reads back as absent on old data); repositories sit on 3 generic collections (`collections.ts`: `keyedCollection`, `cappedList`, `singleton`), key names in one table (`storage-keys.ts`, shared with the backup importer) |
| Optional ports | Rarely-needed `AppDeps` ports (`rewards`, `assessment`, `backup`, …) are optional and permissive: every use case no-ops cleanly without one, so older test fixtures keep working unchanged |
| Core subpath exports | `@chess-kids/core`'s main entry stays light (domain, app use cases); heavy or rare modules (backup/merge validation) live behind a subpath (e.g. `@chess-kids/core/backup`) so they stay out of the main bundle and the bot worker; that validation's `zod` runs `jitless` (no `new Function` probe) so CSP can stay `script-src 'self'` |
| Exercise engine | Pure immutable state + transitions (`startExercise`, `playMove`, `toggleSquare`, `submitSelection`, `undo`, `requestHint`, `starsFor`) |
| Solver | BFS over kid moves (state = placement + castling + en passant + stars); used for hints and the content build's own `stars3 = optimum` check |
| Rule-verified content | `domain/exercise/facts.ts` (`isAttacked`, `isDefended`, `isHanging`, `isInCheck`, `isCheckmate`, `isStalemate`, `isInsufficientMaterial`, `canCastle`, `canEnPassant`): yes-no / choice / best-move `verify` is checked against real rules at build time, failing the build on a contradiction; select-squares `derive` (`legal-moves` / `attacked-by` / `check-escapes`) is computed at runtime, shared by engine, loader and e2e |
| Full game / versus mode | Play's "Full game" button and a world's own full-game boss both reuse `VersusStep` over a standard-start def (`kings: true`, win by checkmate, game rules' own draws, a move limit and par); a content winnability test plays a seeded kid-stand-in bot against the mini-game's own bot over N seeds and asserts a target win rate (a documented, lower bar where the target proved unreachable, e.g. `full-game-rabbit` ≥ 60%) |
| Board | `Board`: legality only from a `legalMoves` prop; tap-tap + drag (pointer events, 6 px tap threshold); `role="grid"` with one labelled button per square; own SVG piece set; dev playground at `/#board` (dev builds only) |
| Backup / merge | `BackupFile` is a hand-written domain type validated by a parallel, lighter zod schema (not `z.infer`'d directly, so the schema can't silently drift from the real field types) and trusted after a successful parse; import writes every replaced record to staging keys first and only swaps them over the real ones once every write succeeds (atomic replace); merge/import live behind the `@chess-kids/core/merge` subpath |
| Test layers (web) | Vitest + jsdom + Testing Library (components, adapters); Playwright on the production build |
| App version | `apps/web/src/app-version.d.ts` declares `__APP_VERSION__: string`, set by `vite.config.ts`'s and `vitest.config.ts`'s own `define` (each reads `apps/web/package.json`'s `version`) — compile-time only; shown as a small line under the parent-area overview |

Offline, PWA update, CSP and lazy-loading details: [non-functional.md](non-functional.md) §1. Bear's search techniques and their Bear-only scoping: [computer-opponent.md](computer-opponent.md) §6.5–6.6. Parent area, backup screen and device-sharing merge rules: [app-structure.md](app-structure.md) §11, [domain-model.md](domain-model.md) §3.5.
