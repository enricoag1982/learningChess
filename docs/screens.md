# Screens — Chess for Kids

Related: [app-structure.md](app-structure.md). Visual sketches: [canvas](https://claude.ai/artifact/HohYgZ3J9mqBrsamJnin5S) (private until shared).

## 1. UI rules

| Topic | Rule |
|---|---|
| Target | Tablet landscape (1024×768) first; phone portrait: board on top, panel below |
| Touch targets | ≥ 64 px on kid screens; ≥ 44 px in parent area |
| Text | Short; every text also spoken (replay button); icon + label on every action |
| Actions | One primary action per screen |
| Board | ≥ 75% of screen height on game screens |
| Colour roles | Cream background · green = go / done · orange = today / current · gold = stars · blue = computer / info · grey + lock = locked |
| Errors | Never red; orange + spoken explanation |
| Type | Fredoka (display) + Nunito (body), self-hosted via Fontsource (SIL OFL) |
| Parent area | Adult style (smaller text, denser); behind parent password |

### 1.1 Design tokens (from sketches; Tailwind `@theme` in `apps/web/src/index.css`)

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

## 2. Screen list

| # | Screen | Purpose | Key elements | Goes to |
|---|---|---|---|---|
| 1 | Profile picker | Choose player | Avatar tiles, New player, Grown-ups (password) | Home, Parent area |
| 2 | Home | Start | Rank, stars, Owl message, **Start today**, tiles: Journey, Practice, Play, My Den | Lesson story (session), Journey, Practice, Play, My Den, Profile picker |
| 3 | Journey map | Path | World list + paths, lesson nodes (done / current / locked), **Show you know it** | Lesson story, test-out |
| 4 | Lesson story | Introduce concept | Step pills (Story → Demo → Try → Exercises → Boss), character, speech bubble, mini demo board, Listen again, **Let me try** | Exercise |
| 5 | Exercise | Practise | Board, stage dots, instruction + replay, move counter + star target, Hint, Undo | Lesson complete |
| 6 | Lesson complete | Reward | Stars, new badge, next lesson, new mini-game, Play again / **Continue** | Journey, Exercise |
| 7 | Play | Apply | vs Computer (levels), vs Friend, mini-game grid (locked ones greyed) | Game screens |
| 8 | vs Friend | Same-device game | Face-to-face board (black pieces rotated), take back + exit per player, turn indicator | Play |
| 9 | My Den | Motivation | Rank ladder, badges, animal friends | Home |
| 10 | Parent area | Control | Children list, progress by world, weak concepts, time per week vs limit, settings | Profile picker |

## 3. Not sketched yet

Reuse the Exercise / board layout: Practice warm-up, placement test, test-out, game vs computer, mini-game screens. Separate: first-run setup (parent password + file location), new-player creation, password screen (with "Forgot it? It is in the file `<path>`"), "See you tomorrow" screen.

## 4. New proposals in sketches

| Proposal | Detail |
|---|---|
| Computer levels as animals | Mouse (L1) → Rabbit → Fox → Wolf → Bear (L5) |
| Owl as instruction channel | Speech bubble + voice on every screen |
