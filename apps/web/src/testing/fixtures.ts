import type { ContentSource, ExerciseDef, Lesson, MiniGame } from '@chess-kids/core';
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

/** `ContentSource` serving exactly one lesson (and its mini-games, if any). */
export function fixtureContentSource(
  lesson: Lesson,
  minigames: readonly MiniGame[] = [],
): ContentSource {
  return {
    lessons: () => [lesson],
    lesson: (id) => (id === lesson.id ? lesson : undefined),
    minigames: () => minigames,
    minigame: (id) => minigames.find((game) => game.id === id),
  };
}
