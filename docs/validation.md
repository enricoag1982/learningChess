# Validation — Chess for Kids

Related: [roadmap.md](roadmap.md), [../CONTRIBUTING.md](../CONTRIBUTING.md).

Every merged iteration gets an annotated tag `m<N>.<i>` (milestone done: also `m<N>`), created on merge by `.github/workflows/tag.yml`. Tag message = the tag's row in §2: scope, checks run (IDs below), notes.

## 1. Checks

| ID | Check | Verifies |
|---|---|---|
| F | Format | Prettier: code, YAML, JSON |
| L | Lint | ESLint `strictTypeChecked`; layer rules (domain pure, chess.js behind adapter) |
| T | Typecheck | `tsc` strict, every package |
| U | Unit + content tests | Vitest: rules, parsers, content files, adapters, components |
| B | Build | Content JSON + web bundle |
| E | E2E | Playwright on production build (Chromium) |
| CI | CI `quality` | F L T U B E on GitHub Actions, PR head |
| C | Clean install | Fresh clone → `pnpm install --frozen-lockfile` → all scripts pass |
| P | Perft | Move generator node counts vs published values |
| N | Negative | Deliberately broken input rejected with a clear message |
| S | Screenshot | App run in a browser, screens checked by eye (tablet 1024×768, phone 390×844) |
| O | Offline | Built app reloads with network off |
| Z | Size | Initial JS gzipped vs budget (≤ 300 KB) |
| D | Deploy | Pages URL serves the app |
| A | Accessibility | axe-core scan of every lesson screen (serious / critical = fail); kid targets ≥ 64 px on desktop, tablet, iPad portrait, phone |

## 2. Log

| Tag | Date | Scope | Checks | Notes |
|---|---|---|---|---|
| `m0.1` | 2026-09-24 | Workspace + tooling; core chess (diagram / FEN parser, `ChessRules` over chess.js); content locale pipeline | F L T U B CI C P N | U: 60 tests (core 42, content 18). P: 5 reference positions match published perft counts (kept as unit test). N: bad diagram, bad FEN, two white kings, empty text, bad key, duplicate key → rejected with file / row / key in message. C: fresh clone of branch green. Lint rules checked to fire (chess.js import, React in domain) |
| `m0.2` | 2026-09-24 | Web PWA shell (Vite, React 19, Tailwind tokens from sketches, self-hosted fonts, typed i18n); localStorage store (versioned, migrations) + profile repository; Playwright smoke + offline; CI e2e; Pages deploy + tag workflows | F L T U B E CI S O Z N | U: 72 tests (core 42, content 18, web 12). E: 4 (desktop + tablet 1024×768). S: shell at 1024×768 and 390×844 checked. O: offline reload passes; 8 font files precached. Z: initial JS 84 KB gz (budget 300). N: unknown i18n key fails typecheck. Tag workflow dry run: title → tag, backfill, missing row → error |
| `m0` | 2026-09-24 | M0 scaffold done | CI D | Exit: CI green; rules tests pass (incl. perft). D pending: repo setting Pages → Source = GitHub Actions (owner only); deploy runs on every push to `master` |
| `m1.2` | 2026-09-24 | Core exercise engine: variant rules (walls, static opponent), `collect-stars`, `select-squares`, `capture`, stars, hint ladder, BFS solver, piece-vs-static mini-game | F L T U CI N | U: 77 core tests. Manual: doc example `rook-02` → optimal 3 (a5, e5, e8) = doc `stars3`; hint ladder piece → target → move, level 3 caps at 1 star; 8 stars + walls solved (14 moves) in 243 ms. Review fix: solver replays castling through rules (test red before fix, green after) |
| `m1.3` | 2026-09-24 | Lesson content pipeline (lesson / exercise / mini-game YAML → Zod → semantic checks → `content.json`); Rook lesson (story, demo, 2 guided, 8 exercises) + Hungry Rook | F L T U B CI N | U: 131 tests (core 77, content 42, web 12). Content checks: boards valid, solvable, `stars3` = solver optimum (rook-01..08: 2, 3, —, 3, 1, —, 3, 5), Hungry Rook par 7 = optimum, keys present. N: `stars3` below optimum, walled-in star, unknown text key → all 3 reported in one build run. Review: lesson texts read for an 8-year-old; one text fix |
| `m1.1` | 2026-09-24 | Board UI: own SVG piece set, stars / rocks, tap-tap + drag, highlights (selection, hint, wrong, last move), move animation, screen-reader grid; also M1.4a (non-UI): progress domain, lesson steps, ports + use cases, localStorage progress, Web Speech narrator, bundled content | F L T U B E CI S | U: 203 tests (core 106, content 42, web 55). E: 4. S: piece gallery at 3× and board at 1024×768 reviewed → pieces redrawn (bigger, horse-head knight, single-slit bishop). Manual Playwright on dev playground: mouse drag d4→d7 capture, tap-tap select → target dots → move with mouse and touch. Z: initial JS 85 KB gz |
| `m1.4` | 2026-09-24 | Lesson flow UI: Home → Story → Demo → Try → Exercises → Boss → Complete; Zustand app store; narration on every text + replay; autosave after each step, resume at the unfinished step | F L T U B E CI S N | U: 214 tests (core 106, content 42, web 66). E: 8 (desktop + tablet): full Rook lesson played with solver lines incl. boss within par → "Lesson complete!" → Home stars; close mid-lesson + reload → resumes at exercise 3; offline reload. S: 7 screens × tablet / phone reviewed. Manual on production build: 0 external requests from the app; narration called for every step text; profile, progress, attempts in localStorage. Z: JS 112 KB gz. Found for m1.5: phone top bar / Story cramped; hint and feedback replace the instruction; guided tries show stars |
| `m1.5` | 2026-09-24 | Polish: phone top bar (phase chip), phone Story, instruction kept with hint / feedback notes, no stars on guided tries, board labels via i18n, iPad portrait layout, plural text keys; checks: axe scan, target sizes on 4 viewports, no external requests, offline lesson, reduced motion, size budget in CI | F L T U B E CI S A O Z N | U: 218 tests (core 106, content 44, web 68). E: 16 (desktop, tablet, iPad portrait, phone). A: 1 axe violation fixed (stars pill label). Review found "Say it again" squeezed to 27 px on stacked layouts → fixed (`shrink-0`); target check extended to hint state (red before fix, green after); Story content clipped on phone → safe centering. Z: 110.8 KB gz, now a CI step. O: lesson playable offline after first load |
| `m1` | 2026-09-24 | M1 vertical slice done | E CI A O | Exit: Rook lesson end to end (story → demo → guided → 8 exercises → Hungry Rook → complete) on tablet layout, progress saved + resume (e2e). Pending (user): playtest 1; Pages source = GitHub Actions |
| `m2.1` | 2026-09-24 | Profiles (picker, new player: nickname + 8 animal avatars), first run (welcome → parent password → file copy → first child), parent password screen (reminder of file location, 5 wrong → 1 min wait), parent area (children, rename, avatar, delete with confirm, add, change password) | F L T U B E CI S A Z | U: 273 tests (core 136, content 44, web 93). E: 22 (profiles flow incl. download + 60 s lockout via fake clock; all earlier specs through the new start flow; a11y on new screens). S: 13 screens × desktop / phone reviewed. Manual: real download `chess-for-kids-parent-password.txt` contains the password; M1 installs (profile, no lock) only asked for the password (unit test). Z: 117 KB gz |
| `m2.2` | 2026-09-24 | Exercise types `yes-no`, `choice`, `best-move`, `setup`: engine (answers, wrong moves bounce back, piece placement, stars, hint ladders), content schema + loader checks (legal solutions, setup start ⊆ target, option keys), UI (Yes / No, option tiles, bounce animation, setup tray); dev playground `/#exercises` | F L T U B E CI S N Z | U: 360 tests (core 190, content 63, web 107). E: 22. S: 4 types × initial / wrong / solved × desktop / phone. Review fixes: Yes was styled as primary (biased the answer) → both neutral, RTL guard; choice options 40 px → 96 px tiles, RTL guard; animated piece painted under later squares → z-index. Open (→ m2.4): setup tray below the fold on phone. Z: 120 KB gz |
