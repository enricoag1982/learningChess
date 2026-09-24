# Chess for Kids — project guide

Offline chess learning app for an 8-year-old beginner. Design is complete; implementation starts at milestone M0.

## Working style (user preferences)

- Act as an experienced PM / tech lead. Be very compact: facts only, shortest wording that keeps full understanding, no editorial sentences.
- Tables and short bullets over prose.
- Record every decision in the relevant doc under `docs/`, commit and push.
- **Delegate coding and testing to simpler models** via the Agent tool when possible:
  - `model: "sonnet"`: implementation tasks with a clear spec (files, interfaces, tests to write).
  - `model: "haiku"`: running lint / typecheck / tests, mechanical edits, dependency checks.
  - Main agent: plans, writes precise task specs, reviews diffs, decides, commits.
- Git workflow: see `CONTRIBUTING.md`. `master` only via PR; required check `quality`; 0 approvals; squash merge. Claude opens the PR (template), waits for `quality` green, then squash-merges. Milestone branches from `master` (current: `m0-scaffold`); commit and push after each step; ask the user before merging a milestone PR unless merging was delegated. Each merged iteration: log row in `docs/validation.md` (checks run, manual checks) + squash title `M<N>.<i>: …` → CI creates annotated tag `m<N>.<i>` (session cannot push tags: HTTP 403).

## Docs (read the relevant one before working on an area)

| Doc | Content |
|---|---|
| `docs/teaching-process.md` | Pedagogy: principles, learning loop, phases, mini-games |
| `docs/curriculum.md` | Lesson list: Basics (worlds 1–5) + 3 paths, mini-game catalogue |
| `docs/app-structure.md` | Modes, profiles, navigation, flows, progression, theme, parent password, time controls, MVP |
| `docs/domain-model.md` | Entities, exercise types, rules (mastery, review, unlocks), use cases, ports, content files |
| `docs/architecture.md` | Stack, layers, repo layout, ports, content format, tests, decisions |
| `docs/computer-opponent.md` | Bot levels (Mouse → Bear), move choice, aids, tests |
| `docs/rewards.md` | Reward rules, badge catalogue, badge engine |
| `docs/non-functional.md` | Offline, accessibility, privacy, performance, reliability |
| `docs/screens.md` | UI rules, screen list; sketches: https://claude.ai/artifact/HohYgZ3J9mqBrsamJnin5S |
| `docs/roadmap.md` | MVP scope, epics, milestones M0–M5, playtests, metrics, decisions |
| `docs/validation.md` | Check IDs, per-tag validation log |

## Key decisions

- Offline app: v1 has no server; all data on device. Online (login, sync, remote play) = v2, hooks only.
- TypeScript + React + Vite PWA; Capacitor later for Android / iPad. GitHub Pages hosts the static app.
- Layers: `domain` (pure TS) → `app` (use cases, ports) → adapters / `ui`. Content in YAML → Zod → JSON.
- Animal theme; English first (i18n); narration = Web Speech API (device voices) until v3.
- Parent password kept in a simple plain-text file; password screen reminds where the file is (web: copy in Downloads; store apps: editable file in app Documents). Daily time limit in v1.

## Status and next step

- M0 done (tags `m0.1`, `m0.2`, `m0`). Pending user action: Settings → Pages → Source = GitHub Actions (then `deploy.yml` publishes `master`).
- Next: M1 vertical slice, iterations `m1.1`–`m1.5` in `docs/roadmap.md` §3.1. Branch `m1-vertical-slice`.
- Local: `pnpm install` · `pnpm dev` · `pnpm test` · `pnpm build && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e` (cloud sandbox browser path).

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

GitHub Pages: free plan needs a public repo; user must set Pages source to "GitHub Actions" in repo settings.
