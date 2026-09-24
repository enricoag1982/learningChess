# Validation — Chess for Kids

Related: [roadmap.md](roadmap.md), [../CONTRIBUTING.md](../CONTRIBUTING.md).

Every merged iteration gets an annotated tag `m<N>.<i>` (milestone done: `m<N>`). Tag message = scope + checks run (IDs below) + result; details logged in §2.

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
