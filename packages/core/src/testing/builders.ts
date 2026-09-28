/**
 * Fixture builders shared by `packages/core`, `packages/content` and `apps/web/src/adapters`
 * tests. `@chess-kids/core/testing` only (`package.json`'s `exports`) — never re-exported from
 * `index.ts`, so none of this reaches the app bundle. Each builder returns sensible defaults;
 * pass `overrides` to change just the fields a test cares about.
 */
import type { ExerciseDef, Lesson, Position, StaticMiniGame } from '../chess.ts';
import type { Profile } from '../domain/profile.ts';
import type { Attempt, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { ConceptStats } from '../domain/review.ts';

/** Empty board: no pieces, white to move, no castling/en passant. Its content is never exercised
 * by a test that leaves it at the default — override `position`/`demo.position`/`target` for
 * anything that actually plays a move on the board. */
export const EMPTY_POSITION: Position = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
};

/** `ExerciseDef` fixture: a one/two-star `collect-stars` exercise. `id` (default `exercise-1`)
 * drives the default `textKey` unless that is overridden too. Cast through `ExerciseDef` like
 * every copy this replaces — a test overriding `type` also supplies that type's own fields. */
export function makeExercise(overrides: Partial<ExerciseDef> = {}): ExerciseDef {
  const id = overrides.id ?? 'exercise-1';
  return {
    id,
    concept: 'rook-move',
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
    ...overrides,
  } as ExerciseDef;
}

/** `Lesson` fixture: a 2-exercise "rook" lesson, no guided tries or boss. `id` (default `rook`)
 * drives `titleKey`/`storyKey`/`demo.textKey` and the default exercises' ids. */
export function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  const id = overrides.id ?? 'rook';
  return {
    id,
    world: 'pieces',
    order: 1,
    concept: 'rook-move',
    character: 'rhino',
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: {
      position: EMPTY_POSITION,
      textKey: `lessons:${id}.demo`,
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: [makeExercise({ id: `${id}-01` }), makeExercise({ id: `${id}-02` })],
    ...overrides,
  };
}

/** `StaticMiniGame` fixture (Hungry Piece-shaped): par 3, unlocked after the "rook" lesson. `id`
 * (default `hungry-rook`) drives the default `titleKey`/`goalKey`. */
export function makeMiniGame(overrides: Partial<StaticMiniGame> = {}): StaticMiniGame {
  const id = overrides.id ?? 'hungry-rook';
  return {
    mode: 'static',
    id,
    concept: 'rook-move',
    position: EMPTY_POSITION,
    par: 3,
    titleKey: `minigames:${id}.title`,
    goalKey: `minigames:${id}.goal`,
    unlockAfter: 'rook',
    ...overrides,
  };
}

/** `LessonProgress` fixture: fresh progress for profile `profile-1` on lesson `rook`. */
export function makeProgress(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    id: 'lesson-progress-1',
    profileId: 'profile-1',
    lessonId: 'rook',
    bestStars: {},
    bossStars: 0,
    resumeStep: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `MiniGameProgress` fixture for profile `profile-1` on mini-game `hungry-rook`. */
export function makeMiniGameProgress(overrides: Partial<MiniGameProgress> = {}): MiniGameProgress {
  return {
    id: 'minigame-progress-1',
    profileId: 'profile-1',
    miniGameId: 'hungry-rook',
    bestStars: 3,
    plays: 1,
    wins: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `ConceptStats` fixture for profile `profile-1` on concept `rook-move`, no attempts yet. */
export function makeConceptStats(overrides: Partial<ConceptStats> = {}): ConceptStats {
  return {
    id: 'concept-stats-1',
    profileId: 'profile-1',
    conceptId: 'rook-move',
    recent: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `Attempt` fixture: a correct, 3-star, unhinted try at `rook-01` for profile `profile-1`. */
export function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'attempt-1',
    profileId: 'profile-1',
    lessonId: 'rook',
    exerciseId: 'rook-01',
    conceptId: 'rook-move',
    scored: true,
    correct: true,
    stars: 3,
    hints: 0,
    errors: 0,
    moves: 1,
    durationMs: 1000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `Profile` fixture: "Rex" the fox, account "local". */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    accountId: 'local',
    nickname: 'Rex',
    avatar: 'fox',
    locale: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
