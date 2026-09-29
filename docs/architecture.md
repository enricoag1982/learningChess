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
| Game rules | `subject-chess` `core/game`: variant rules (kings on/off, no-moves lose / draw, win conditions per side: checkmate, promote, capture-all, capture piece, reach, survive; move limit) + standard draws (stalemate, insufficient material, threefold, 50-move) |
| Bot engine | `subject-chess` `core/bot`: level mix of random / shallow / alpha-beta search (computer-opponent.md §3), seeded `Random` (mulberry32) for determinism; search runs on `SearchBoard` (chess.js internal move functions + its own incremental Zobrist hash) → chess.js pinned to an exact version. Bear only: transposition table + killer moves + quiescence + 250 ms iterative-deepening cap (computer-opponent.md §6.5); meets 300 ms (p50) / 600 ms (p95, CI) on the reference set; short of true depth 4 in a wide-open opening (known limitation) |
| Web delivery | PWA (vite-plugin-pwa / Workbox) | Browser + home-screen install; everything precached, fully offline ([non-functional.md](non-functional.md)) |
| Fonts | Self-hosted | Offline, no third-party requests |
| Mobile | Capacitor (Android + iPad) | Same web app packaged for stores |
| Package manager | pnpm workspaces | Packages shared across apps |

## 3. Layers

Workspace `packages/*` + `apps/*`. Direction: app → `subject-*` → `platform-web` / `platform-content` → `platform-core`. Inside a package: `domain` (pure TS) → `app` (use cases, ports) → adapters / `ui`.

| Package | Contains | Depends on |
|---|---|---|
| `@learn/platform-core` | Pure TS: `domain/` (profiles, progress, journey, rewards, time policy, merge, seam types), `app/` (use cases, ports, backup), `testing/` | zod |
| `@learn/platform-content` | YAML → Zod → JSON pipeline, platform locales, voice-text inventory, `createChoiceContent`, `createSeriesContent`, `testing/` fixture subject | platform-core, zod, yaml |
| `@learn/platform-web` | React: `App`, `mountApp`, routes + store slices, screens, design system, adapters, i18n, generic `choice` UI, `testing/` (incl. `dispatchGuard`); outside `src`: `build/` (Vite / Vitest / Playwright config factories), `theme.css`, `e2e/` (page flows, texts) | platform-core |
| `@learn/subject-chess` | Chess pack: `src/{core,kinds,modes,content,web}`, `content/` (YAML), `scripts/` | platform-core, platform-content, platform-web, chess.js |
| `@learn/subject-math` | Math demo pack: `src/{core,kinds,content,web}`, `content/` (YAML) | platform-core, platform-content, platform-web |
| `@learn/chess-kids` | Shell (`apps/chess-kids`): `src/main.tsx` passes `chessWeb` + `CHESS_APP_CONFIG` to `mountApp` (platform-web `src/mount.tsx`); configs via platform-web `build/`, e2e | platform-core, platform-web, subject-chess |
| `@learn/math-demo` | Shell (`apps/math-demo`), same shape with `mathWeb` + `MATH_APP_CONFIG`; dev / test only, not deployed | platform-web, subject-math |

| Seam | Defined in | Provides |
|---|---|---|
| `SubjectCore` | platform-core `domain/subject.ts` | `id`, `context`, `kinds`, `modes`, `characters`, `settings` slot, `notes`, `noteVars`, `rewards?`, `gameRecordOf?`; `createSubjectRuntime(core)` (`domain/runtime.ts`, called by `createServices`) builds the kind + mode registries plus the platform `series` mode |
| `SubjectContent` | platform-content `subject.ts` | `kinds`, `modes`, `defaultMode?`, `stimulus`, `demo`, `badges`, `characters`, `voiceTemplates`, `extraOutputs?`; `buildContent({ subject, root, out })` writes `dist/` |
| `SubjectWeb` | platform-web `app/subject.ts` | `core`, `createServices`, kind / mode UIs, `surface`, `CharacterBadge?`, `art`, `den`, `routes`, `homeTiles?`, `createSlice?`, `loadParent?`, `dev?` |
| `AppConfig` | platform-core `domain/subject.ts` | `storagePrefix`, `backupAppId`, file prefixes, `version` |

Chess: `chessCore` (`src/core/chess-core.ts`), `chessContent` (`src/content/chess-content.ts`), `chessWeb` (`src/web/chess-pack.ts`), `CHESS_APP_CONFIG`. Dispatch on exercise `type` / mini-game `mode` only through registries: `EXERCISE_KINDS` (`src/kinds/index.ts`), `MINI_GAME_MODES` (`src/modes/index.ts`), `EXERCISE_SOLUTIONS` (`src/kinds/solutions.ts`, tests only), `EXERCISE_KIND_UI` / `MINI_GAME_MODE_UI` (`src/web/{kinds,modes}/ui-registry.ts`); `dispatch-registries.test.ts` (`platform-web/src`, `subject-chess/src/web`, `subject-math/src/web`, all via `dispatchGuard`) guards it. Math: `mathCore`, `mathContent`, `mathWeb`, `MATH_APP_CONFIG` (prefix `math-demo:`), same registry layout.

**Boundary lint** (`eslint.config.js`, errors):

- Platform packages never import `@learn/subject-*`; core < content < web; core and content are React-free.
- Every subject's `src/core`, `src/content`, kind `kind` / `engine` / `solution` / `content` / `verify` files: no React, no `web/`.
- Pure TS (no `app`, adapters, React): platform-core `domain/`, subject `core/{chess,bot,game,variant,exercise}`, `kinds/`, `modes/` (non-`.tsx`).
- Apps use a package only through its `exports`; `chess.js` only in `core/chess/chessjs-rules.ts`; no `e2e.ts` / `sample.ts` / Playwright import outside the e2e registries.

## 4. Repository layout

- `packages/*` (§3): `src/`, plus `platform-content/locales/`, `platform-web/{build,e2e,theme.css}`, `subject-*/{content,scripts,dist}` (YAML, build scripts, content build output: git-ignored).
- `apps/chess-kids`: `index.html`, `vite.config.ts`, `src/`, `e2e/`, `test-fixtures/`, `scripts/`, `public/`. `apps/math-demo`: same shell, no `test-fixtures/` / `scripts/`. `tools/`: `voice/` (Kokoro), `art/`.
- One line per folder: [refactor-v4.md](refactor-v4.md) §3. A native UI, if ever needed: a new `apps/*`.

## 5. Ports

| Port | Adapter v1 | Later |
|---|---|---|
| `ProfileRepository` | localStorage | IndexedDB / native storage → cloud (Supabase, Firebase) |
| `ProgressRepository` | localStorage | same |
| `SettingsRepository` | localStorage | same |
| `Narrator` | Pre-generated audio (Kokoro), Web Speech API (`localService`) fallback for texts without audio | More languages' audio |
| `Platform`, `AuthService`, `SyncService`, `MatchService`, `FeatureFlags` | Not in code (parked; online off in v1) | Capacitor (haptics, native storage); parent login; cloud sync; online play; remote config |

- All repository methods async (cloud-ready).
- All records: UUID ids, `createdAt` / `updatedAt` (sync-ready).
- Interfaces: `packages/platform-core/src/app/ports.ts`; web adapters: `packages/platform-web/src/adapters/`.
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
| Unit | Vitest per package (`pnpm test` = `pnpm -r test`) | Platform packages run without a subject (`testSubject`, fixture subject); `subject-chess`: rules, variants, bot, kinds, modes |
| Content | Vitest | Every exercise: schema valid, valid position, legal solution, solution reaches goal within star limits; all text keys present in every locale |
| Components | React Testing Library | Board, screens (`subject-chess/src/web`); full-app flows (`apps/chess-kids/src`) |
| End-to-end | Playwright, `apps/chess-kids/e2e/` (`kit/`) | Create profile → lesson → mini-game → progress persisted |
| Static | `tsc` strict, ESLint (typescript-eslint `strictTypeChecked` + layer rules), Prettier | Every PR via CI |
| Slow unit (M8.2) | Vitest, `*.slow.test.ts`, `pnpm test:slow` | Bot self-play / strength / timing, winnability, deep perft; excluded from `pnpm test` |
| CI (M8.2) | GitHub Actions `ci.yml` | Parallel jobs `checks` (format, lint, typecheck, unit, build, size, compat, voice), `slow`, `e2e` × 3 shards; `quality` = the one required check, green only if all succeed. Full a11y curriculum walk on chromium; tablet / tablet-portrait / phone reach the same 21 scan points by seeded progress |
| Content snapshot (M8.1) | Vitest `toMatchFileSnapshot` | Every `dist/` output of the content build (`compileAll`), pretty JSON in `packages/subject-chess/src/content/__snapshots__/content/`. Changes only with a deliberate content change: `pnpm --filter @learn/subject-chess exec vitest run -u`, review the diff |
| Storage compat (M8.1) | Vitest + Playwright | `apps/chess-kids/test-fixtures/storage/<tag>/`: localStorage + backup files recorded with real `v1.0.0`, `v1.1.0`, `v2.0.0` builds; load and merge snapshots must stay equal; add a fixture per release (folder README) |
| Test kits (M8.4, R4) | `@learn/platform-core/testing`, `@learn/subject-chess/testing`, `src/testing/` of `platform-content` / `platform-web`, `subject-chess/src/web/testing/`, `apps/chess-kids/e2e/kit/` | Builders, port fakes, `makeDeps`, `testSubject` (non-chess `SubjectCore`), fixture `SubjectContent`, `renderApp`, `solutionOf`; never in the app bundle |

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
| Packages | 3 platform packages + `subject-chess` / `subject-math` + apps `@learn/chess-kids` / `@learn/math-demo`, one repo, not published ([refactor-v4.md](refactor-v4.md) §8, §12); Pages deploys chess only |
| Web hosting | GitHub Pages (static files only: install + update checks) |
| Illustrations | Microsoft Fluent Emoji 3D (MIT), bundled WebP |

## 11. Implementation notes

| Topic | Note |
|---|---|
| Tooling | pnpm workspace; TypeScript 6.0 (`strict`, `noUncheckedIndexedAccess`, erasable syntax only); Vitest; Playwright |
| Internal packages | Export TS source (`exports` in each `package.json`); relative imports carry `.ts` → same files run in Vite, Vitest, `tsc` and Node. `defineAppConfig` (platform-web `build/app-config.ts`, used by every app's `vite.config.ts`): `resolve.dedupe` for react(-dom), zustand, i18next(-react), zod; Tailwind `@source` per package (each app's `src/index.css`, which imports platform-web `theme.css`) |
| Lint layer rules | §3 Boundary lint |
| Formatting | Prettier for code, YAML, JSON; Markdown excluded (hand-formatted) |
| Position | Plain JSON: pieces, markers (stars, blocked), side to move, castling, en passant; no move clocks (50-move / repetition come from game history) |
| Rules | `ChessRules` interface over chess.js; positions without kings allowed (lessons, Pawn Wars); missing promotion piece → queen; variant layer (blocked squares, custom win conditions) |
| Content build | Runs on `pnpm install` (`prepare`) and `pnpm build`; `pnpm --filter @learn/subject-chess build` (`buildContent`), output `packages/subject-chess/dist/` (git-ignored); fails on invalid board, unsolvable exercise, `stars3` ≠ solver optimum, mini-game `par` ≠ optimum, unknown id reference, missing text key, bad `verify`/`derive` answer |
| Locale files | `locales/<lang>/<namespace>.yaml` in `platform-content` + `subject-chess/content`, deep-merged per namespace (duplicate key = build error); keys lowercase kebab; `en` = reference; missing / extra keys fail build and tests; i18next keys type-checked |
| Storage | localStorage keys `chess-kids:<name>`; stored schema version + ordered migrations; newer-schema data refused, never overwritten; an additive optional field needs no version bump (reads back as absent on old data); repositories (`packages/platform-web/src/adapters/storage/`) sit on 3 generic collections (`collections.ts`: `keyedCollection`, `cappedList`, `singleton`), key names in one table (`storage-keys.ts`, shared with the backup importer) |
| Optional ports | Rarely-needed `AppDeps` ports (`rewards`, `assessment`, `backup`, …) are optional and permissive: every use case no-ops cleanly without one, so older test fixtures keep working unchanged |
| Core subpath exports | `@learn/platform-core`'s main entry stays light (domain, use cases); heavy or rare modules (backup / merge validation) sit behind `./backup`, `./merge`, out of the main bundle and the bot worker; that `zod` runs `jitless` (no `new Function` probe) so CSP can stay `script-src 'self'` |
| Exercise engine | Pure immutable state + transitions in `subject-chess/src/kinds/` (`startExercise`, `playMove`, `toggleSquare`, `submitSelection`, `undo`, `requestHint`, `starsFor`) |
| Solver | `subject-chess/src/core/exercise/solver.ts`: BFS over kid moves (state = placement + castling + en passant + stars); used for hints and the content build's own `stars3 = optimum` check |
| Rule-verified content | `subject-chess/src/core/chess/facts/position.ts` (`isAttacked`, `isDefended`, `isHanging`, `isInCheck`, `isCheckmate`, `isStalemate`, `isInsufficientMaterial`, `canCastle`, `canEnPassant`): yes-no / choice / best-move `verify` is checked against real rules at build time, failing the build on a contradiction; select-squares `derive` (`legal-moves` / `attacked-by` / `check-escapes`) is computed at runtime, shared by engine, loader and e2e |
| Full game / versus mode | Play's "Full game" button and a world's own full-game boss both reuse the `versus` mode step (`subject-chess/src/modes/versus/Step.tsx`) over a standard-start def (`kings: true`, win by checkmate, game rules' own draws, a move limit and par); a content winnability test plays a seeded kid-stand-in bot against the mini-game's own bot over N seeds and asserts a target win rate (a documented, lower bar where the target proved unreachable, e.g. `full-game-rabbit` ≥ 60%) |
| Board | `subject-chess/src/web/ui/board/Board.tsx`: legality only from a `legalMoves` prop; tap-tap + drag (pointer events, 6 px tap threshold); `role="grid"` with one labelled button per square; own SVG piece set; dev playground at `/#board` (dev builds only) |
| Backup / merge | `BackupFile` is a hand-written domain type validated by a parallel, lighter zod schema (not `z.infer`'d directly, so the schema can't silently drift from the real field types) and trusted after a successful parse; import writes every replaced record to staging keys first and only swaps them over the real ones once every write succeeds (atomic replace); merge/import live behind the `@learn/platform-core/merge` subpath |
| Test layers (web) | Vitest + jsdom + Testing Library (components, adapters; own config per package); Playwright on the production build |
| App version | `packages/platform-web/src/app-version.d.ts` declares `__APP_VERSION__: string`, set by `defineAppConfig` / `defineAppTestConfig`'s `define` (each reads the calling app's `package.json` `version`) — compile-time only; shown as a small line under the parent-area overview |

Offline, PWA update, CSP and lazy-loading details: [non-functional.md](non-functional.md) §1. Bear's search techniques and their Bear-only scoping: [computer-opponent.md](computer-opponent.md) §6.5–6.6. Parent area, backup screen and device-sharing merge rules: [app-structure.md](app-structure.md) §11, [domain-model.md](domain-model.md) §3.5.
