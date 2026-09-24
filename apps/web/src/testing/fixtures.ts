import type {
  ContentSource,
  ExerciseDef,
  Lesson,
  MiniGame,
  Track,
  TracksCatalog,
  World,
} from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';

/** A tiny collect-stars exercise: rook at a1, one star at h1 (solved in exactly one move). */
export function fixtureExercise(id = 'fixture-ex'): ExerciseDef {
  return {
    id,
    concept: 'fixture-move',
    textKey: `fixtures:${id}`,
    position: parseDiagram(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . *
    `),
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
  };
}

/** A second tiny collect-stars exercise (rook a1, star a8): an easier variant of `fixtureExercise`. */
export function fixtureVariantExercise(id = 'fixture-ex-easy'): ExerciseDef {
  return {
    id,
    concept: 'fixture-move',
    textKey: `fixtures:${id}`,
    position: parseDiagram(`
      * . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . .
    `),
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
  };
}

/** A minimal, otherwise-content-shaped lesson for tests that don't need the real Rook content. */
export function fixtureLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'fixture',
    world: 'test',
    order: 1,
    concept: 'fixture-move',
    character: 'rhino',
    titleKey: 'fixtures:title',
    storyKey: 'fixtures:story',
    demo: {
      position: parseDiagram(`
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . R . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
      `),
      textKey: 'fixtures:demo',
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: [fixtureExercise()],
    ...overrides,
  };
}

/** One-world, one-track catalog matching `fixtureLesson()`'s default `world: 'test'`, `order: 1`. */
const FIXTURE_WORLD: World = {
  id: 'test',
  track: 'test',
  order: 1,
  habitat: 'meadow',
  titleKey: 'fixtures:world',
};
const FIXTURE_TRACK: Track = {
  id: 'test',
  kind: 'main',
  titleKey: 'fixtures:track',
  worlds: [FIXTURE_WORLD],
};
export const fixtureCatalog: TracksCatalog = {
  tracks: [FIXTURE_TRACK],
  ranks: [{ id: 'pawn', after: 'start' }],
};

/**
 * `ContentSource` serving exactly one lesson (and its mini-games, if any), plus a matching
 * one-world `catalog()` so `loadJourney` (called on every profile select) has something to work
 * with — tests that need a different worlds/tracks shape build their own `ContentSource`.
 */
export function fixtureContentSource(
  lesson: Lesson,
  minigames: readonly MiniGame[] = [],
): ContentSource {
  return {
    lessons: () => [lesson],
    lesson: (id) => (id === lesson.id ? lesson : undefined),
    minigames: () => minigames,
    minigame: (id) => minigames.find((game) => game.id === id),
    catalog: () => fixtureCatalog,
    badges: () => [],
  };
}
