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
| App state | Zustand | Minimal; logic stays in domain |
| Content | YAML (authoring) → Zod validation → JSON (runtime) | Readable, commentable lessons; app loads plain JSON |
| i18n | i18next | English first, more languages without code changes |
| Narration | `Narrator` port: Web Speech API (v1, device voices) → generated audio files (v3) | No audio production in v1; nicer voices later without code changes elsewhere |
| App state | Zustand store: screen, profile, progress, current lesson + step; exercise / game state local to the step component (reducer over core engine functions); services injected (`createServices`) for tests |
| Content text keys | Content ids are plain strings in core; UI resolves them through one helper (`tContent`); all other UI keys are type-checked |
| Plural text | i18next plural suffixes (`_one`, `_other`, …) allowed on text leaves; languages compared by base key |
| Layout | Tablet landscape: board left, panel right; below 1024 px wide: board on top, panel below; phone: one-row top bar with phase chip |
| Profiles | App start: first run while no parent lock exists, else profile picker (last used first); avatars = 8 fixed animal ids; nickname 1–12 characters |
| Parent lock | Plain-text password (kid-gate) in localStorage + downloaded copy `chess-for-kids-parent-password.txt`; lockout state persisted; `PasswordFileWriter` port (store apps: Documents file, M6) |
| Game rules | `domain/game`: variant rules (kings on/off, no-moves lose / draw, win conditions per side: checkmate, promote, capture-all, capture piece, reach, survive; move limit) + standard draws (stalemate, insufficient material, threefold, 50-move) |
| Bot engine | `domain/bot`: level mix of random / shallow / alpha-beta search (computer-opponent.md §3), seeded `Random` (mulberry32) for determinism; search runs on `SearchBoard`, which uses chess.js internal move functions (40× faster than the public API) → chess.js pinned to an exact version, perft through `SearchBoard` guards upgrades. Known: Bear depth 4 ≈ 0.5–1 s in Node vs 300 ms target → M4 (own move generator or deeper optimisation, worker) |
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
packages/core      domain + ports
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
| `Narrator` | Web Speech API (prefers on-device voices: `localService`) | v3: generated audio files per language |
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

Example:
```yaml
id: rook-02
concept: rook-move
type: collect-stars
text: rook-02          # key in locales/<lang>/lessons.yaml
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
stars2: 5
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
| Static | `tsc` strict, ESLint (typescript-eslint `strictTypeChecked` + layer rules), Prettier | Every PR via CI `quality` job |

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
| Narration | Web Speech API (browser / device voices) in v1 and v2; generated audio files in v3 |
| Mobile | PWA first → Capacitor |
| Online (login, sync, remote play) | Off in v1; ports + local adapters only |
| Content format | YAML authoring → JSON runtime; locale files; board diagram or FEN; SAN moves |
| Web hosting | GitHub Pages (static files only: install + update checks) |
| Illustrations | Very basic AI-generated images, bundled in the app |

## 11. Implementation decisions (M0)

| Topic | Decision |
|---|---|
| Tooling | pnpm 10 workspace; TypeScript 6.0 (`strict`, `noUncheckedIndexedAccess`, erasable syntax only); Vitest; Playwright (Chromium smoke test) |
| Internal packages | Export TS source, no package build; relative imports carry `.ts` → same files run in Vite, Vitest, `tsc` and Node (native type stripping) |
| Lint layer rules | `domain` imports no app / adapters / React; `chess.js` only in `chessjs-rules.ts` |
| Formatting | Prettier for code, YAML, JSON; Markdown excluded (docs hand-formatted) |
| Position | Plain JSON data: pieces, markers (stars, blocked), side to move, castling, en passant; no move clocks (50-move / repetition from game history, M4) |
| Rules | `ChessRules` interface; chess.js adapter; positions without kings allowed (lessons, Pawn Wars); from/to promotion without piece → queen; variant layer (blocked squares, custom wins) in M1 |
| Content build | Runs on `pnpm install` (`prepare`) and `pnpm build`; output `packages/content/dist/` (git-ignored) |
| Locale files | `locales/<lang>/<namespace>.yaml`; keys lowercase kebab; `en` = reference; missing / extra keys fail build and tests; i18next keys type-checked |
| Storage | localStorage keys `chess-kids:<name>`; stored schema version + ordered migrations; data from a newer version → refused, never overwritten |
| PWA updates | Service worker without skip-waiting: new version activates at next app start |
| Hosting | `deploy.yml`: push to `master` → build with base `/<repo>/` → GitHub Pages |
| Ports in adapters | Synchronous storage adapters return promises (port contract async) without `async` bodies |
| Animations | CSS transitions in M1; Motion library only if CSS is not enough |
| Variant rules | Walls = blocked squares occupied by a piece of the side to move during move generation (sliders stop, knights jump over, nothing lands); static opponent = turn returns to kid after each move |
| Exercise engine | Pure immutable state + transitions (`startExercise`, `playMove`, `toggleSquare`, `submitSelection`, `undo`, `requestHint`, `starsFor`); stars only when landing on a star |
| Solver | BFS over kid moves, state = placement + castling + en passant + stars; fast replay of known-legal moves except castling; used for hints, content checks (`stars3` = optimal) |
| Lesson content | `lessons/<world>/<id>.yaml`, `minigames/<id>.yaml`; build compiles boards to `Position` and fails on: invalid board, unsolvable exercise, `stars3` ≠ solver optimum, `stars2` < `stars3`, mini-game `par` ≠ optimum, unknown id reference, missing text key; output `dist/content.json` (`CompiledContent`) |
| Text namespaces | `common` (UI), `lessons` (lesson, exercise, mini-game texts), `characters` (`<id>.name`) |
| Board | `Board` component: legality only from `legalMoves` prop; tap-tap + drag (pointer events, 6 px tap threshold); `role="grid"` with one labelled button per square; own SVG piece set (classic shapes, chunky, knight = horse head); dev playground at `/#board` (dev builds only) |
| Progress | `LessonProgress` (best stars per exercise, boss stars, `resumeStep`, `completedAt`) + `Attempt` per try (first-try correct, hints, errors, moves, duration) for later mastery / review; resume at the start of the unfinished step |
| Narration | `Narrator` port; Web Speech adapter prefers an on-device English voice, silent no-op when unavailable (subtitles always shown) |
| Test layers (web) | Vitest + jsdom + Testing Library (components, adapters); Playwright on the production build (desktop + tablet 1024×768 touch) |
