# Rewards — Chess for Kids

Related: [app-structure.md](app-structure.md), [domain-model.md](domain-model.md).

## 1. Rules

| Rule | Detail |
|---|---|
| Reward mastery and effort | Not time spent |
| Clear goals | Locked badges show their condition, spoken ("Win Pawn Wars 3 times") |
| Nothing lost | Stars, badges, rank never taken away |
| No comparison | No leaderboards, no comparison between profiles |
| No money, no luck | No purchases, no random rewards |
| Rare celebrations | Max 2 badge celebrations per session; extras appear in My Den with a "new" dot |
| Forgiving streaks | Day counts with ≥ 1 completed activity; 1 free skip per week; broken streak restarts silently |

## 2. Reward types

| Type | Earned by | Shown in |
|---|---|---|
| Stars | Exercises and mini-games (1–3 each) | Top bar, Journey nodes, My Den |
| Rank | Worlds and paths (Pawn → King) | Home, My Den |
| Animal friends | Piece lessons in World 2 (Rhino, Elephant, Lioness, Lion, Horse, Caterpillar) | My Den |
| Badges | Catalogue below | Lesson complete screen, My Den |

## 3. Badge catalogue

Tiers: bronze / silver / gold where 3 values are given.

### Milestones

| Badge | Condition |
|---|---|
| Board Explorer | World 1 mastered |
| Piece Master | World 2 mastered |
| Guardian | World 3 mastered |
| Checkmate Champion | World 4 mastered |
| Rule Master | World 5 mastered |
| Basics Graduate | Basics mastered |
| Opening Explorer | Openings path mastered |
| Tactics Tiger | Tactics path mastered |
| Endgame Hero | Checkmates & Endgames path mastered |

### Skills

| Badge | Condition |
|---|---|
| Perfect Lesson | Lesson with 3 stars on every exercise: 1 / 5 / 15 lessons |
| Star Collector | Total stars: 50 / 150 / 400 |
| Sharp Eyes | 10 correct "Safe or not?" answers in a row |
| Escape Artist | 10 check escapes without hints |
| Mate Master | Mates in 1 solved: 10 / 25 / 50 |
| Butterfly Maker | Promote 10 pawns in games |
| Castle Builder | Castle in 5 games |
| Fork Finder | 10 forks found |

### Play

| Badge | Condition |
|---|---|
| First Win | First win vs computer |
| Mouse Tamer · Rabbit Catcher · Fox Outsmarter · Wolf Tamer · Bear Buddy | First win vs each level |
| Queen Keeper | Win a game without losing the queen |
| Pawn Wars Winner | Win Pawn Wars 3 times |
| Friendly Match | First game vs a friend (any result) |

### Habits

| Badge | Condition |
|---|---|
| Daily Player | Streak: 3 / 7 / 30 days |
| Warm-up Champ | Warm-ups completed: 10 / 30 |
| Never Give Up | Finish an exercise after 2+ wrong tries: 1 / 10 / 25 |

**Totals:** 29 badges (6 with tiers). MVP: 25 (without the 3 path milestones and Fork Finder).

## 4. Badge engine

- Evaluated on events: `ExerciseCompleted`, `LessonCompleted`, `WorldMastered`, `GameFinished`, `SessionEnded`.
- Badges defined in `badges.yaml` (content): condition type + parameters + tiers.

| Condition type | Parameters |
|---|---|
| `mastered` | world or track id |
| `stars-total` | thresholds |
| `perfect-lessons` | thresholds |
| `concept-correct` | concept, count, `inARow`, `noHints` |
| `game-win` | opponent (level / mini-game), count, extra (`queenKept`) |
| `game-event` | event (`promotion`, `castling`), count |
| `game-played` | mode (`local`), count |
| `streak-days` | thresholds |
| `warmups` | thresholds |
| `comeback` | thresholds |

## 5. Later

| Idea | Note |
|---|---|
| Den decorations bought with stars | Stars as soft currency, no money; decide after MVP feedback |
| Habitat friends | New animal friends per world / path |
