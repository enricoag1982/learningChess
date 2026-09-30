/**
 * Chess fixture builders (`ExerciseDef`, `Lesson`, `StaticMiniGame`) for tests; pass `overrides` to
 * change just the fields a test cares about.
 */
import type { ExerciseDef } from '../core/exercise/types.ts';
import type { Lesson, StaticMiniGame } from '../core/chess/lesson.ts';
import type { Position } from '../core/chess/types.ts';

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
    character: 'rook',
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
