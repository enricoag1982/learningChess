# New subjects — ideas

Owner request (2026-10-04): ideas for new versions of the app on the v4 platform (math, logic, programming, others). Status: proposal, nothing decided. Target: same child profile (age 7–10, beginner), offline, tablet, 10–15 min sessions, animal theme.

## 1. What a subject gets from the platform today

| Platform piece | Reused as is |
|---|---|
| Profiles, parent code, time controls, backup / device sharing | yes |
| Journey (worlds, unlocks), mastery ≥ 80 %, test-out, placement | yes |
| Lesson loop (story → demo → try → exercises → boss), hint ladder, 1–3 stars, easier variants | yes |
| Review (Leitner), Today session, streak, badges, Den | yes |
| Narration (Kokoro audio + device-voice fallback), i18n | yes |
| Kind `choice`, mode `series` | yes (generic) |
| Kind `number-entry` | in `subject-math` (move to platform if reused) |
| Grid board (walls, stars, select squares), bot in a worker, `versus` mode, game records | in `subject-chess`; generalisable |

New subject = `packages/subject-<x>` (kinds, content YAML, web pack) + `apps/<x>` shell (as `math-demo`).

## 2. Candidates

★ = new exercise kind.

| # | Subject | Skills (age 7–10) | Kinds | Mini-games / bosses | Inspiration |
|---|---|---|---|---|---|
| 1 | Coding ("animal robot") | Sequence, loops, conditions (if wall), own blocks (functions), debugging, predicting | ★program (arrange command tiles → run → animal walks; stars = fewest blocks), ★predict (tap end square), ★debug (tap the wrong block), ★fill the gap | Star Collector with commands, Maze race, Two robots | ScratchJr, Lightbot, code.org, Kodable |
| 2 | Math (extend the demo) | Numbers to 100 / 1000, + − with carrying, times tables, sharing (÷), fractions (½ ¼), clock, money (€), shapes, measures | `choice`, `number-entry`, ★number line, ★compare (< = >), ★array (rows × columns = times tables), ★clock (set hands), ★coins (place) | Times-table series, Make 10, Number-line jump, Race to 20 (Nim) vs bot | DragonBox, Khan Academy Kids |
| 3 | Logic & puzzles | Patterns, odd one out, sorting (groups), mini sudoku 4×4 / 6×6, nonogram 5×5, mazes, Tower of Hanoi, river crossing, small logic grids, symmetry | `choice`, ★grid fill (digits / colours in cells), ★order (drag sequence), ★sort (drag into groups), ★move puzzle (Hanoi, sliding tiles) | Sudoku series, Maze race, Hanoi tower | Smart Games, Brain It On, kids' puzzle books |
| 4 | Strategy games ("game club") | Thinking ahead, threats, safe moves (= chess habits) | ★real-move on N × M grid, best-move puzzles ("win in 1", "block the threat") | Tic-tac-toe, Connect 4, dots and boxes, Nim, checkers (Italian dama), Reversi, capture Go 9 × 9; bot levels Mouse → Bear, vs friend | Chess app's Play tab |
| 5 | Languages | Second language (e.g. English ↔ Italian): vocabulary by theme, listening, first reading, spelling, short sentences | ★listen and tap (hear word → tap picture), `choice`, ★letter tiles (spell), ★word order, ★match pairs | Memory pairs, Word rain series | Duolingo ABC, Lingokids |
| 6 | Geography & nature | Continents, oceans, European countries, flags, capitals; animals and habitats; planets | ★map select (tap regions = select-squares on a map), `choice`, ★match (flag ↔ country), ★place label | Map Hunt (like Square Hunt), Flag series | Stack the Countries, Seterra |
| 7 | Music | Notes on staff, piano keys, high / low, rhythm, ear training | ★piano tap (sequence), ★listen and choose, ★rhythm tap (timing), ★staff note select | Simon (melody memory), Rhythm echo | Simply Piano, Chrome Music Lab |

Not recommended now: science facts (mostly `choice`, little interaction), native-language reading (phonics needs much audio + school covers it), drawing, typing (tablet). Time and money fit as math worlds, not a separate subject.

## 3. Comparison

| Subject | Platform reuse | Main new UI | Content generated + machine-checked | Art / audio cost | Effort | Rank |
|---|---|---|---|---|---|---|
| Coding | High (grid, walls, stars, BFS solver as in collect-stars) | Block editor + run animation | Yes (solver: fewest blocks) | Low | M–L | 1 |
| Math | Very high (pack exists) | Small widgets (number line, clock, coins) | Yes (parametric problems) | Low | M | 2 |
| Logic | High (grid, select, place) | Grid fill, drag order / groups | Yes (solver checks one solution) | Low | M | 3 |
| Strategy games | Very high (board, bot worker, versus, records, time limits) | Board per game | Positions via bot search | Low | M per game family | 4 |
| Languages | Medium (narration, `choice`, `series`) | Small | No (authored; content review per word) | High (≈ 300 pictures + audio per word, 2 languages; Kokoro has Italian voices, quality to check) | L | 5 |
| Geography & nature | Medium-high (select on map) | SVG map (Natural Earth, public domain) | Partly (facts authored) | Medium | M | 6 |
| Music | Low-medium | Keyboard, timing input (new `KindInput`), Web Audio synth | Partly | Medium | L | 7 |

Offline limits: no speech or pitch recognition → no speaking / singing exercises.

## 4. Product shape (decide before the second real subject)

| Option | Pros | Cons |
|---|---|---|
| A. One app per subject (today: `chess-kids`, `math-demo`) | No platform change; separate store listings | Profiles, daily limit, parent code per app; limit not shared across apps |
| B. One "learning kids" app with a subject picker | Shared profiles, one daily limit, rewards across subjects, one install | Platform hosts N packs (today 1 `SubjectWeb`); lazy-load packs to keep the size budget |
| C. Add-on inside chess (e.g. strategy games in Play) | Cheapest for #4 | Chess app grows; no fit for other subjects |

## 5. Platform changes the candidates need

| Change | Needed by |
|---|---|
| Generic grid surface (N × M cells, walls, stars, tokens) from `subject-chess` into the platform | Coding, Logic, Strategy games, Math arrays |
| Generic drag kinds (order, group, place) like `choice` | Logic, Languages, Coding, Geography |
| Generated exercises (seeded parameters + solver check at build time) | Math, Logic, Coding |
| Generic 2-player `versus` + bot worker in the platform | Strategy games, Math (Nim) |
| Audio stimulus (sound / word as the question) | Languages, Music |
| Multi-subject host | Option B |

## 6. Decisions for the owner

| # | Question | Recommendation | Status |
|---|---|---|---|
| 1 | Next subject(s) | Coding (unique, highest reuse of the grid), then Math (demo → real curriculum) | Open |
| 2 | Product shape | Pilot as its own app (A); move to one app (B) once 2 subjects are real | Open |
| 3 | Content language | English first, as chess; Italian as 2nd locale | Open |

Next step after a pick: research + curriculum doc (as `teaching-process.md` / `curriculum.md`), then 1-world vertical slice + playtest (`retrospective.md` §6).
