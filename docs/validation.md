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

## 2. Log

| Tag | Date | Scope | Checks | Notes |
|---|---|---|---|---|
| `m0.1` | 2026-09-24 | Workspace + tooling; core chess (diagram / FEN parser, `ChessRules` over chess.js); content locale pipeline | F L T U B CI C P N | U: 60 tests (core 42, content 18). P: 5 reference positions match published perft counts (kept as unit test). N: bad diagram, bad FEN, two white kings, empty text, bad key, duplicate key → rejected with file / row / key in message. C: fresh clone of branch green. Lint rules checked to fire (chess.js import, React in domain) |
