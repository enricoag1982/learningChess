# Retrospective — Chess for Kids v1.0.0

Owner request (2026-09-25): what went well / wrong in the whole process, learnings for a similar app, time spent by activity.
Sources: lead session transcript, 40 agent transcripts, git history, GitHub PRs / Actions, `validation.md`. Times UTC.

## 1. Outcome

| Item | Value |
|---|---|
| Product | Offline PWA, live at https://enricoag1982.github.io/learningChess/; 5 worlds, 23 lessons, 17 mini-games, 5 bot levels, vs Friend, badges / streak, Today session + review, placement / test-out, parent area (report, settings, backup, privacy), daily time limit |
| Releases | 29 iteration tags (`m0.1` … `m5.5`), milestone tags `m0`–`m5`, `v1.0.0` |
| Code | 28.4 k lines TS / TSX (source), 23.0 k unit-test lines, 4.0 k e2e lines, 5.7 k lines content YAML |
| Tests (end) | core 602, content 287, web 302, e2e 86 (4 browser projects, incl. a11y walk, offline, CSP, cold start) |
| Performance | initial JS 180.6 KB gz (budget 300); cold start 0.4–0.5 s (4× CPU throttle, tablet) |
| Delivery | 35 PRs merged, ≈ 146 CI / deploy / tag runs, 0 reverts |

## 2. Timeline

| Phase | Window (UTC) | Wall clock | Owner |
|---|---|---|---|
| Design (11 docs) | 09-24 03:09–04:43 | 1.6 h | present (Q&A, decisions) |
| M0 scaffold, CI, Pages | 04:43–05:34 | 0.9 h | present until 05:05 ("go by iteration… continue alone") |
| M1 vertical slice | 05:34–08:13 | 2.7 h | offline |
| M2 Worlds 1–2, bot, Play | 08:13–14:59 | 6.8 h | offline |
| M3 Worlds 3–4, review, full game | 14:59–20:19 | 5.3 h | offline |
| M4 World 5, levels, friend, badges, placement | 20:19–09-25 02:09 | 5.8 h | 21:00–21:55: Pages setting, first playtest, 3 findings |
| M5 parent, limit, design, offline, release | 02:09–07:01 | 4.9 h | 02:49: retrospective request |
| **Total to v1.0.0** | 09-24 03:09 → 09-25 07:01 | **27.9 h** | active ≈ 2.0 h |
| v1.1.0 owner playtest 2 (skip, buttons, app update) | 09-25 14:38–16:10 | 1.5 h | phone playtest + 2 follow-ups |

## 3. Time spent (estimate)

| Activity | Hours | Method |
|---|---|---|
| Design with the owner (pre-code) | 1.6 | first message → first coding agent |
| Active collaboration with the owner | 2.0 | per message: wait + first reply, ≤ 15 min each, 32 messages |
| Lead: planning, specs, review, integration, CI follow-up, merges | ≈ 14 | lead transcript, gaps < 10 min summed |
| Coding + testing by agents (wall clock) | 23.2 | union of 39 agent run intervals (≤ 2 in parallel) |
| Coding + testing by agents (agent-hours) | 34.3 | sum of agent run durations |
| CI pipeline (compute) | ≈ 6.7 | sum of run durations; overlaps other work |
| Waiting on CI before merge (critical path) | ≈ 4.9 | sum PR open → merge |
| Idle (nothing running) | ≈ 0.4 | one 22 min gap (lead running local repro tests between M5.1 fixes) |

Mean M5 iteration: agent 0.8–1.6 h + lead review / integration / CI ≈ 0.7 h → 1.2–2.6 h from spec to merge.
Models, tokens and CI minutes: §8.

## 4. What went well

| Topic | Evidence |
|---|---|
| Design first, in docs | 1.6 h of owner Q&A → 11 docs; every spec pointed at doc sections; decisions logged, rarely re-opened |
| Owner time | ≈ 2 h of owner time for a 27.9 h build; the owner was offline for ~16 h and work continued |
| Lead + agents split | Lead: specs, review, integration, merges. Agents: code + tests. ≤ 2 agents in parallel on disjoint files; something was running ~99 % of the span |
| Layers | Pure `domain` + `app` use cases: most logic unit-tested without UI; bot in a Web Worker; storage behind ports (migrations v1–v5, atomic backup import) |
| Rule-verified content | YAML → Zod → build checks (solvable, optimal star counts, `verify` rules for yes/no and choice answers, winnability sims) caught wrong answers before a person saw them |
| Quality gate | One required check (format, lint, typecheck, unit, build, size, e2e, a11y) + a validation row per tag + tags created by CI: every merged iteration green, 0 reverts |
| Lead review | Found something in every M-iteration, e.g. zod pulled into the main bundle and bot worker (16 → 42 KB), CSP blocking zod's eval probe, non-square friend board, badge assuming the child plays White, full game keyed on one lesson id, Fox strength changed by a Bear-only change, time tracker losing minutes on each screen change, 20+ ambiguous or wrong exercises |
| Fast playtest loop | Owner found the squares-04 ambiguity at 21:17 → fix, new review rule, missed-square highlight merged by ~22:00 |

## 5. What went wrong

| Problem | Cost | Root cause | Fix / rule now |
|---|---|---|---|
| Ambiguous exercises: one reached the owner; lead audits found more in every world (M2.4: 4, M3.2: 5, M3.3: 7, M4.1: 5, M5.5: 4 of 9) | owner playtest blocked; audit time each world | agents write content that is correct for the engine but readable two ways; distractor pieces; "closest to you" wording | review rule in `CLAUDE.md` (one reading, no distractors, "bottom row"); lead audit = check N on every content iteration |
| No visual difference tappable vs info | M5.3 retrofit of ~45 files | the design phase had no interaction-style rule | `screens.md` §1 rule (raised vs flat) + shared primitives + e2e check |
| Red CI from latent test defects | 4 red CI runs, ~1.5 h in M5.1 | e2e matched exercises by text only (rook-07 / queen-07 share a text, since M4.5); friend board measured before its first resize callback (since M4.3); time budgets too tight under load | match by text + board; size before paint; no wall-clock asserts; repeat suspicious specs (`--repeat-each`) before merge |
| Deploy red 22× | noise, hid real signals | Pages source needed an owner setting | one owner setup checklist on day 0 |
| Parallel agents share one machine | e2e port collisions, CPU-contention flakes, one risky broad `pkill` | one e2e port for all; no process rules at first | `PW_PORT` per agent; kill by PID only; ≤ 2 agents |
| Environment interruptions | ~0.5 h + re-planning | container restart stopped 2 agents; context compactions; another session merged into the same repo (PR #21) | agents resume in worktrees; commit early; one session per repo |
| Integration of parallel iterations | ≈ 0.7 h lead time per M5 iteration | shared files (`validation.md` adjacent rows, `ports.ts`, settings whitelist) | boundary lists in specs; integrate sequentially; append-only log rows |
| Specs left gaps | rework after review | `pieceStyle` semantics, minute counting across screens, lesson step pills not listed | acceptance examples + "screens in scope" list in each spec |
| Agent drift | lead re-commits, long docs, one agent stopped before committing | own trailers, verbose validation rows vs "compact" preference | exact trailers, word limits and finish steps in every spec |
| Bear target missed (≥ 70 % vs Wolf, got 20 %) | F4 still open | target set without a feasibility spike | spike + calibration before committing to a number |
| Owner's phone ran a 7-hour-old build (v1.1.0) | playtest 2 judged the pre-M5.3 design | service worker `prompt` mode with no update UI: a new version waited until every tab closed | update applied at Home / picker, checked on load and on return (v1.1.0) |
| Buttons still unclear after M5.3 (v1.1.0) | second design pass | "raised" rule had no measurable threshold; beige edge ≈ 1.2:1 on cream | edge contrast ≥ 3:1 (WCAG 1.4.11), asserted in e2e |
| Phone Story: primary button below the fold | found only in lead review of v1.1.0 | screenshots checked at 390×844, real phones show less height | check 390×660 too; primary pinned to the bottom |

## 6. Learnings for a similar app

| Area | Do next time |
|---|---|
| Day 0 | Owner checklist: repo settings (Pages, branch rules), playtest slots, device list; design-system basics (tokens, tappable vs info, touch targets, contrast) before the first screen |
| Playtests | Real child after the first playable slice (M1), then after every world, not only at the end |
| Iterations | 1 spec = 1 agent = 1 PR = 1 tag = 1 validation row; ≤ 2 parallel agents on disjoint files; fixed integration order |
| Specs | Files, interfaces, decisions table, acceptance examples, screens in scope, tests, visual check, finish commands (ports, trailers, PID-only kills), doc word limits |
| Lead review checklist | bundle diff, CSP / security, domain assumptions (colour, time zone, locale), 390 px layout, content one-reading, test helpers' matching |
| Content | Machine-check everything checkable; unique instruction text or stable id per exercise; second-person review (not the author) of text vs board |
| Tests | e2e by stable ids / roles, not visible text; `expect.poll` for layout; no wall-clock thresholds in CI; configurable ports from day 1 |
| Performance / security | Size budget and CSP from M0; lazy-load rare screens; keep validation libs out of the main entry |
| AI opponent | Self-play calibration early; set strength targets after a spike |
| Owner collaboration | Short approvals ("ok, go") worked; ask for pending owner actions up front; send one status line per merged milestone |
| PWA updates | Decide the update strategy on day 1 (when a new build applies), not after a stale-build playtest |
| Token accounting | Transcripts hold the start-of-stream usage snapshot, so output tokens need an estimate; read final usage from the API / console when exact figures matter |
| Agent context | Cache reads are 99 % of token volume and grow with each tool call: prefer shorter, well-scoped agent tasks over 500+-call runs |

## 7. Open after v1.0.0

| Item | Owner |
|---|---|
| Playtests 1–4 with the child (`roadmap.md` §5) | user |
| Offline check on an iPad and an Android tablet (`release.md` §1) | user |
| F4: Bear vs Wolf 20 % (target 70 %) | next iteration |
| Capacitor apps (v1.x), online features (v2), narration upgrade (v3) | roadmap §4 |

## 8. Models, tokens, CI minutes (added after v1.1.0)

Model names stay out of the repository (session rule); roles:

| Role | Model | Turns | Cache writes |
|---|---|---|---|
| Lead (plans, specs, review, integration, merges) | one larger model, every turn | 1,352 | 1-hour |
| Implementation agents (40 runs) | one smaller model (CLAUDE.md delegation tier), every turn | 11,262 | 5-minute |
| Data agent (retrospective numbers) | same as implementation agents | 88 | 5-minute |

Tokens, design → v1.1.0 (per message, duplicates removed):

| Role | Fresh input | Cache writes | Cache reads | Output, visible (estimate) | Output, recorded snapshot |
|---|---|---|---|---|---|
| Lead | 2.9 K | 5.0 M | 539 M | 0.32 M | 1.00 M |
| Agents (implementation + data) | 22.7 K | 28.2 M | 3.92 B | 1.82 M | 0.30 M |
| **Total** | **25.6 K** | **33.2 M** | **4.46 B** | **2.13 M** | **1.30 M** |

| Reading | Value |
|---|---|
| Cache reads / all input-side tokens | 99.3 % (every tool call re-reads the growing context) |
| Agent share of visible output | ≈ 85 % (code and tests written through tool calls); lead ≈ 15 % |
| Visible output per merged PR | ≈ 59 K tokens |
| Visible output by phase (K tokens) | design 63 · M0 73 · M1 229 · M2 476 · M3 400 · M4 397 · M5 360 · v1.1 95 |
| Measurement | Input side exact. Output: transcripts store the usage snapshot taken when a response starts streaming, so "recorded" undercounts tool-heavy turns; "visible" = logged text + tool input characters ÷ 4, a lower bound (thinking text not stored). No cost estimate (owner decision) |

| CI (to the v1.1.0 PR) | Runs | Compute |
|---|---|---|
| `quality` (format, lint, typecheck, unit, build, size, e2e) | 80 | 402 min |
| Deploy (Pages) | 35 | 25 min (22 failures before Pages was enabled) |
| Tag | 36 | 6 min |
| **Total** | **151** | **433 min (7.2 h)**; 4 real CI failures, all fixed at root cause |
