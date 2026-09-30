# Screens — Chess for Kids

Related: [app-structure.md](app-structure.md). Visual sketches: [canvas](https://claude.ai/artifact/HohYgZ3J9mqBrsamJnin5S) (private until shared).

## 1. UI rules

| Topic | Rule |
|---|---|
| Target | Tablet landscape (1024×768) first; phone portrait: board on top, panel below |
| Touch targets | Game screens ≥ 56 px (owner 2026-09-30): lesson steps (Story, Demo, Try, Exercise), boss / series rounds, review tasks, vs Computer / vs Friend games, assessment tasks, and their header's close X. Other kid screens (Home, Journey, Den, picker, first run, results) ≥ 64 px. Parent area ≥ 44 px. Looks in `ds/tap.ts`: `compact` (56 px action), `round-md` (56 px round), `next` (64 px forward action); `round`, `cta`, `block`, `hero` keep 64–80 px |
| Text | Short; every text also spoken (replay button); icon + label on every action |
| Actions | One primary action per screen |
| Board | The largest square the panel leaves. Measured (Chromium, lesson 1 guided try, hint shown; M8.35): iPad portrait 768×954 537 px (was 395), iPad landscape 1024×690 566 (was 542), Android portrait 800×1216 712 (width-bound), phone 390×844 342 (was 295, width-bound); game `Screen` padding 16 px vertical from `sm` up; same case with a moves chip, yes-no, palette, choice at 768×954: 605 / 569 / 505 / 569 (was 336 / 428 / 331 / 396) |
| Heights | Game screens never scroll: Check / Next always on screen; the board takes the height the panel leaves (floor 240 px, shrink-only within an exercise). `dvh`, never `vh` / `min-h-screen` (owner report, iPad mini 4, 2026-09-26). Checked by `e2e/fit.spec.ts` |
| Colour roles | Cream background · green = go / done · orange = today / current · gold = stars · blue = computer / info · grey + lock = locked |
| Errors | Never red; orange + spoken explanation |
| Type | Fredoka (display) + Nunito (body), self-hosted via Fontsource (SIL OFL) |
| Parent area | Adult style (smaller text, denser); behind parent password |
| Owl row | Speech bubble + "Say it again". Game screens (owner 2026-09-30): an icon-only 56 px round speaker button: at the right end of the owl row in stacked layouts (portrait, phone), under the owl avatar in the side column (`lg`, board left / panel right) so the bubble gets the whole remaining width; the accessible name stays "Say it again" (Story: "Listen again"). Other screens keep the labelled button: side by side from `sm` up, stacked on phones (bubble full width, button below); always stacked inside dialogs (celebration) |
| One message area | The hint / error / praise note sits inside the owl bubble under the instruction: a thin divider, then the note (orange text for hints and errors, green for praise; `text-base` semibold), no separate banner box; the instruction is never replaced (owner 2026-09-30). One action row under it: Hint, the kind's Undo / Check, Skip (guided tries) and Easier one, each a 56 px `compact` button (icon + short label); the moves counter is a flat inline chip in that row (≤ 40 px, never a button; own line on narrow rows); answer buttons (Yes / No, choice tiles, palette tiles) 56 px; the forward action (Next, Let me try) 64 px. Panel at its natural height, the board takes the rest |
| Tappable vs info (v1.1.0 part B, roadmap F3; was M5.3) | Measurable rule: every tappable's boundary (its border, or its fill if it has no border) ≥ 3:1 contrast against the surface around it (WCAG 2.2 SC 1.4.11 non-text contrast) — disabled/locked exempt. Raised: 2 px border + 6 px solid bottom "ledge" shadow, both a darker shade of the fill (`--color-edge-*` tokens for the border, `--color-ledge-*` darker still for the ledge); white/neutral buttons share one dark taupe tone for both, `--color-edge-neutral`/`--color-ledge-neutral` (no coloured fill to shade); pressed = move down 4 px + ledge 2 px (reduced motion: no movement, darker fill instead); focus ring 3 px `info`; labels bold; icon or label (existing rule); a tappable tile/row shows a chevron or play icon when the action is navigation. Info: flat — no border, no shadow, no pill box: rank = crown icon + text, stars = star icon + number, streak same, counters plain text; never a bold centred single word alone. Owl bubble: flat tint + tail (no border); "Say it again" is raised. Disabled / locked (owner playtest 2): dashed border in a light taupe (`--color-edge-locked`), no ledge, muted text, lock icon when locked — reads as neither raised nor info. Cards that wrap raised buttons/tiles (e.g. Play's "vs Computer" card, My Den's badges, the setup exercise's piece tray): flat, no border, soft tint — so only the controls inside look raised; a read-only section (no buttons inside) keeps its bordered "card" framing. Shared primitives: `TapButton` / `InfoPanel` / `InfoPill` (`packages/platform-web/src/ui/ds/primitives.tsx`), `.tap-raised` / `.info-flat` (`packages/platform-web/theme.css`) |

### 1.1 Design tokens (from sketches; Tailwind `@theme` in `packages/platform-web/theme.css`)

| Token | Hex | Use |
|---|---|---|
| `cream` | `#FBF6EC` | Background |
| `ink` | `#22313A` | Text |
| `muted` | `#55636B` | Secondary text |
| `line` | `#E6DCC8` | Card borders (2 px) |
| `card` | `#FFFFFF` | Cards (radius 24–28 px) |
| `go` | `#2E7D5B` | Go / done; primary buttons (white text) |
| `today` | `#B8561A` | Today / current, errors (white text) |
| `star` | `#E9A92B` | Stars |
| `info` | `#2F5E9E` | Computer / info |
| `locked` | `#8C8C8C` | Locked (always with lock icon) |
| `board-light` / `board-dark` / `board-frame` | `#F1E4C8` / `#C49A6C` / `#8A6A48` | Board squares, frame |
| `edge-neutral` / `ledge-neutral` | `#8C7B61` (both) | Neutral (white) button border + ledge (v1.1.0 part B) — 3.81:1 on `cream`, 4.10:1 on `card` |
| `edge-go` / `edge-today` / `edge-info` | `#1F5A41` / `#8C4012` / `#1F3F6D` | Coloured-button border, darker shade of its fill (v1.1.0 part B) — 6.8–9.8:1 on `cream`/`card` |
| `ledge-go` / `ledge-today` / `ledge-info` | `#163F2E` / `#622D0D` / `#162C4C` | Coloured-button ledge, darker still (v1.1.0 part B) — 10.3–13.0:1 on `cream`/`card` |

## 2. Screen list

| # | Screen | Purpose | Key elements | Goes to |
|---|---|---|---|---|
| 1 | Profile picker | Choose player | Avatar tiles, New player, Grown-ups (password); small version line at the bottom (M8.34) | Home, Parent area |
| 2 | Home | Start | Rank, stars, Owl message, **Start today**, tiles: Journey, Practice, Play, My Den; small version line at the bottom (M6.1) | Lesson story (session), Journey, Practice, Play, My Den, Profile picker |
| 3 | Journey map | Path | World list + paths, lesson nodes (done / current / locked), **Show you know it** | Lesson story, test-out |
| 4 | Lesson story | Introduce concept | Step pills (Story → Demo → Try → Exercises → Boss; a skipped step: skip icon, muted, striped bar; phone: phase chip + 5-segment mini track, same states), character, speech bubble with the Listen again icon at its end, mini demo board, one bottom row: **Skip** (Story/Demo/Try only, playtest 2; 56 px, auto width, left) + **Let me try** (64 px, takes the rest; phone: pinned to the bottom) | Exercise |
| 5 | Exercise | Practise | Board, stage dots, instruction bubble with the replay icon and its hint / error note inside, then one action row: moves chip + star target, Hint, Undo / Check; after 2 errors: **Easier one** (same row, so Hint / Undo stay on screen); a guided try also shows **Skip** there (never on a scored exercise or the boss) | Lesson complete |
| 6 | Lesson complete | Reward | Stars, new badge, next lesson, new mini-game, Play again / **Continue** | Journey, Exercise |
| 7 | Play | Apply | vs Computer (levels), vs Friend, mini-game grid (locked ones greyed) | Game screens |
| 8 | vs Friend | Same-device game | Face-to-face board (black pieces rotated), take back + exit per player, turn indicator | Play |
| 9 | My Den | Motivation | Rank ladder, badges, your pieces | Home |
| 10 | Parent area (M5.1) | Control | Overview (child cards, app version, **Reload latest version** button + hint; M8.34) → child report (progress by world, concept accuracy, weak concepts, minutes per day, games, badges, assessments) → child settings (daily limit, voice/sound/hints, computer level, unlock, reset, delete); separate Backup (export / import) and Privacy (M5.5, same text as the first-run password step's own link) | Profile picker |

## 3. Not sketched yet

Reuse the Exercise / board layout: Practice warm-up, placement test, test-out, game vs computer, mini-game screens. Separate: first-run setup (parent password + file location), new-player creation, password screen (with "Forgot it? It is in the file `<path>`"), "See you tomorrow" screen.

## 4. New proposals in sketches

| Proposal | Detail |
|---|---|
| Computer levels as animals | Mouse (L1) → Rabbit → Fox → Wolf → Bear (L5) |
| Owl as instruction channel | Speech bubble + voice on every screen |
