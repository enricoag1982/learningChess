# Chess for Kids — project guide

Offline chess learning app for an 8-year-old beginner. Released `v2.0.0` (M6 voice & art + M7 time controls & device sharing); v4 platform refactor under way (`docs/refactor-v4.md`; R0–R4 done).

## Working style (user preferences)

- Act as an experienced PM / tech lead. Be very compact: facts only, shortest wording that keeps full understanding, no editorial sentences.
- Tables and short bullets over prose.
- Record every decision in the relevant doc under `docs/`, commit and push.
- **Delegate coding and testing to simpler models** via the Agent tool when possible:
  - `model: "sonnet"`: implementation tasks with a clear spec (files, interfaces, tests to write).
  - `model: "haiku"`: running lint / typecheck / tests, mechanical edits, dependency checks.
  - Main agent: plans, writes precise task specs, reviews diffs, decides, commits.
- Git workflow: see `CONTRIBUTING.md`. `master` only via PR; required check `quality`; 0 approvals; squash merge. Claude opens the PR (template), waits for `quality` green, then squash-merges. Branches from `master` (one per milestone / iteration); commit and push after each step; ask the user before merging a milestone PR unless merging was delegated. Each merged iteration: log row in `docs/validation.md` (checks run, manual checks) + squash title `M<N>.<i>: …` → CI creates annotated tag `m<N>.<i>` (session cannot push tags: HTTP 403).

## Docs (read the relevant one before working on an area)

| Doc | Content |
|---|---|
| `docs/teaching-process.md` | Pedagogy: principles, learning loop, phases, mini-games |
| `docs/curriculum.md` | Lesson list: Basics (worlds 1–5) + 3 paths, mini-game catalogue |
| `docs/app-structure.md` | Modes, profiles, navigation, flows, progression, theme, parent code, time controls, MVP |
| `docs/domain-model.md` | Entities, exercise types, rules (mastery, review, unlocks), use cases, ports, content files |
| `docs/architecture.md` | Stack, layers, repo layout, ports, content format, tests, decisions |
| `docs/computer-opponent.md` | Bot levels (Mouse → Bear), move choice, aids, tests |
| `docs/rewards.md` | Reward rules, badge catalogue, badge engine |
| `docs/non-functional.md` | Offline, accessibility, privacy, performance, reliability |
| `docs/screens.md` | UI rules, screen list; sketches: https://claude.ai/artifact/HohYgZ3J9mqBrsamJnin5S |
| `docs/roadmap.md` | MVP scope, epics, milestones M0–M5, playtests, metrics, decisions |
| `docs/validation.md` | Check IDs, per-tag validation log |
| `docs/release.md` | Release checklist, tagging, rollback |
| `docs/retrospective.md` | M0–M5 retrospective: outcome, time spent, went well / wrong, learnings |
| `docs/refactor-v4.md` | v4 plan: learning-platform refactor (platform packages + chess subject pack), phases, targets |

## Key decisions

- Offline app: no server; all data on device. v2 = offline time controls + device sharing by file with merge (owner 2026-09-25). Online (login, remote play, automatic sync) parked, hooks only.
- TypeScript + React + Vite PWA; Capacitor later for Android / iPad. GitHub Pages hosts the static app.
- Packages (`packages/*`, `apps/*`): `@learn/platform-core` (pure TS: domain, use cases, ports); `@learn/platform-content` (YAML → Zod → JSON build); `@learn/platform-web` (React shell, adapters); `@learn/subject-chess` (chess pack: core, kinds, modes, content, web); app `@learn/chess-kids` (thin shell). Dependencies point only to earlier entries; platform never imports a subject (ESLint boundaries, `docs/architecture.md` §3).
- Animal theme; English first (i18n); narration = Web Speech API (device voices) up to v1.1, pre-generated audio (Kokoro) from M6.
- Parent code (UI term; not a real password) kept in a simple plain-text file; the code screen reminds where the file is (web: copy in Downloads, again via "Download parent code file" in the grown-ups area; store apps: editable file in app Documents). Daily time limit in v1.

## Status and next step

- Done: M0–M7 (`m0` … `m7`), releases `v1.0.0`, `v1.1.0` (owner playtest 2), `v1.1.1` (iPad mini 4 / iOS 15 fix), `v2.0.0` (generated voice, Fluent 3D art, parent code, time controls, device sharing); M8 = v4 refactor, `m8.1` … `m8.23` (R0–R4: platform / subject package split). Live: https://enricoag1982.github.io/learningChess/ (deploy on every push to `master`). Pending user action: playtests 1–4 (`docs/roadmap.md` §5), offline check on real tablets (`docs/release.md` §1).
- Next: v4 R4.5 trim, then R5 (math demo app, `v4.0.0`) (`docs/refactor-v4.md` §5); follow-up F4 (Bear strength); apply `docs/retrospective.md` §6 learnings. Release steps: `docs/release.md`.
- Local: `pnpm install` (also builds the content JSON) · `pnpm dev` · `pnpm test` (one package: `pnpm --filter @learn/<pkg> test`) · `pnpm test:slow` · `pnpm lint` · `pnpm typecheck` · `pnpm format:check` · `pnpm build && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e` (cloud sandbox browser path) · `pnpm size` · `pnpm compat` · `pnpm voice:check`.
- Dev playgrounds (dev builds only): `/#board`, `/#exercises`, `/#lesson=<id>&view=<story|demo|boss|exercise id>`.
- Content review rule: every select-squares / yes-no / choice / setup text is checked against its board so exactly one reading leads to the accepted answer (log it as check N). No distractor pieces: a piece the question is not about pulls the eye (playtest: "row closest to you" with a king in the middle was read as "squares closest to the king"); say "bottom row" / "top row", not "closest to you". Diagonals: every non-corner square sits on two; "tap the diagonal" only from a corner square, otherwise name which one ("from corner to corner", "the short one") (owner 2026-09-26).

Version notes (checked 2026-09-24):

| Package | Version | Note |
|---|---|---|
| typescript | 6.0.x | typescript-eslint 8.70 requires `<6.1`; do not use TS 7 |
| vite / @vitejs/plugin-react | 8.x / 6.x | |
| vitest | 5.x | |
| tailwindcss / @tailwindcss/vite | 4.x | |
| vite-plugin-pwa | 1.3.x | |
| chess.js | 1.4.x | BSD-2 |
| zod / yaml | 4.x / 2.x | |
| i18next / react-i18next | 26.x / 17.x | |
| zustand | 5.x | |
| @playwright/test | 1.63.x | Cloud sandbox: use `executablePath: /opt/pw-browsers/chromium` locally (preinstalled chromium-1194); CI installs its own browser |

GitHub Pages: free plan needs a public repo; Pages source = GitHub Actions (set 2026-09-24).
