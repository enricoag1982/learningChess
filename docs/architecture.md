# Architecture — Chess for Kids

Related: [teaching-process.md](teaching-process.md), [app-structure.md](app-structure.md).

## 1. Requirements

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
| Computer opponent | Own engine (minimax depth 1–3 + controlled mistakes) | Weak human-like play for kids; no GPL |
| App state | Zustand | Minimal; logic stays in domain |
| Content | JSON + Zod schemas | Lessons as data, validated |
| i18n | i18next | English first, more languages without code changes |
| Narration | Port with 2 adapters: Web Speech API (prototype) → recorded audio (release) | Fast start; recorded voices for quality/consistency |
| Web delivery | PWA | Browser + home-screen install, offline |
| Mobile | Capacitor (Android + iPad) | Same web app packaged for stores |
| Package manager | pnpm workspaces | Shared core across apps |

## 3. Layers

```
ui (React screens, Board) ──> app (use cases, state) ──> domain (pure TS)
                                     │ ports
                                     ▼
                     adapters: storage, narration, platform
content (JSON lessons + schemas) ──> loaded by app, validated against domain
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
packages/content   lessons, schemas, i18n strings
apps/web           React UI + web adapters (PWA; Capacitor wraps it)
apps/native        only if a native UI is ever needed; reuses core
```

## 5. Ports

| Port | Adapter v1 | Later |
|---|---|---|
| `ProfileRepository` | localStorage | IndexedDB / native storage → cloud (Supabase, Firebase) |
| `ProgressRepository` | localStorage | same |
| `SettingsRepository` | localStorage | same |
| `Narrator` | Web Speech API | Recorded audio files per language |
| `Platform` | Web | Capacitor (haptics, native storage) |

- All repository methods async (cloud-ready).
- iOS Safari may evict website storage after 7 days without use; home-screen PWA / Capacitor avoid it.

## 6. Mobile path

| Option | Reuse | Pros | Cons |
|---|---|---|---|
| PWA | 100% | Zero work | No iOS App Store; iOS limits |
| **Capacitor** (chosen) | ~100% | Stores; native storage/audio | Web-view (fine for 2D board) |
| React Native | core only | Native feel | Second UI; only if web-view insufficient |

## 7. Tests

| Level | Tool | Scope |
|---|---|---|
| Domain | Vitest | Rules, variants, mastery, scheduler, bot |
| Content | Vitest | Every exercise: valid position, legal solution, solution reaches goal; all strings translated |
| Components | React Testing Library | Board interaction, lesson flow |
| End-to-end | Playwright | Create profile → lesson → mini-game → progress persisted |
| Static | `tsc --strict`, ESLint, Prettier | Every commit via GitHub Actions |

## 8. Rejected

| Option | Reason |
|---|---|
| Flutter | Heavy web build, few chess libraries, Dart-only |
| Unity / Godot | Overkill for 2D board; heavy web builds |
| chessground, Stockfish | GPL-3.0 (license would propagate); Stockfish too strong for target |
| React Native first | Slower browser start |

## 9. Decisions

| Topic | Decision |
|---|---|
| Languages | Multi-language via i18n; English first |
| Narration | Web Speech API for prototype → recorded voices for release |
| Mobile | PWA first → Capacitor |
