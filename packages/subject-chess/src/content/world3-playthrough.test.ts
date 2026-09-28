import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompiledContent, ExerciseDef } from '../chess.ts';
import {
  completeRound,
  currentRound,
  seriesResult,
  seriesStars,
  startSeries,
} from '@learn/platform-core';
import { playExerciseToCompletion } from '../testing/index.ts';
import { describe, expect, it } from 'vitest';
import { chessContent } from './chess-content.ts';
import { loadLocales, mergeLocales } from '@learn/platform-content/load';
import { loadContent } from './lesson-load.ts';
import { EXERCISE_KINDS } from '../chess.ts';
import { PLATFORM_LOCALES_DIR } from '@learn/platform-content/paths';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
const locales = mergeLocales(
  loadLocales(PLATFORM_LOCALES_DIR),
  loadLocales(join(packageDir, 'locales')),
);
const content = loadContent<CompiledContent>(
  join(packageDir, 'lessons'),
  join(packageDir, 'minigames'),
  locales,
  chessContent,
);

const WORLD3_LESSON_IDS = ['attack', 'defend', 'safe-pieces', 'piece-values', 'trades'];

describe("World 3 lessons play to completion via the engine, using each exercise's own answer", () => {
  for (const lessonId of WORLD3_LESSON_IDS) {
    const lesson = content.lessons.find((candidate) => candidate.id === lessonId);
    if (lesson === undefined) {
      throw new Error(`${lessonId} lesson not found`);
    }

    it(`${lessonId}: every guided try and exercise solves cleanly (no errors) from its own definition`, () => {
      const all = [...lesson.guided, ...lesson.exercises];
      expect(all.length).toBeGreaterThan(0);

      for (const exercise of all) {
        const state = playExerciseToCompletion(exercise);
        expect(state.solved, `${lesson.id}/${exercise.id}: not solved by its own answer`).toBe(
          true,
        );
        expect(
          state.errors,
          `${lesson.id}/${exercise.id}: unexpected error replaying its own answer`,
        ).toBe(0);
      }
    });
  }
});

describe('safe-or-not (series) plays every round for 3 stars', () => {
  it('every round solves cleanly and the series finishes with 3 stars', () => {
    const minigame = content.minigames.find((candidate) => candidate.id === 'safe-or-not');
    if (minigame === undefined) {
      throw new Error('safe-or-not mini-game not found');
    }
    if (minigame.mode !== 'series') {
      throw new Error('safe-or-not mini-game is not a series');
    }

    let series = startSeries(minigame, EXERCISE_KINDS);
    for (const round of minigame.rounds) {
      expect(currentRound(series)).toBe(round);
      const solved = playExerciseToCompletion(round);
      expect(solved.solved, `${minigame.id}/${round.id}: not solved`).toBe(true);
      expect(solved.errors, `${minigame.id}/${round.id}: unexpected error`).toBe(0);
      series = completeRound(series, solved, EXERCISE_KINDS);
    }

    expect(seriesResult(series)).toBe('won');
    expect(seriesStars(series)).toBe(3);
  });
});

describe('World 3 exercise counts match docs/curriculum.md and the M3.2b spec', () => {
  const EXPECTED: readonly { readonly id: string; readonly exerciseCount: number }[] = [
    { id: 'attack', exerciseCount: 8 },
    { id: 'defend', exerciseCount: 8 },
    { id: 'safe-pieces', exerciseCount: 10 },
    { id: 'piece-values', exerciseCount: 6 },
    { id: 'trades', exerciseCount: 8 },
  ];

  it.each(EXPECTED)(
    '$id has $exerciseCount exercises and 2 guided tries',
    ({ id, exerciseCount }) => {
      const lesson = content.lessons.find((candidate) => candidate.id === id);
      if (lesson === undefined) {
        throw new Error(`${id} lesson not found`);
      }
      expect(lesson.world).toBe('attack');
      expect(lesson.character).toBe('owl');
      expect(lesson.guided).toHaveLength(2);
      expect(lesson.exercises).toHaveLength(exerciseCount);
    },
  );

  it('attack has >= 3 select-squares and >= 4 best-move exercises', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'attack');
    if (lesson === undefined) throw new Error('attack lesson not found');
    const types = lesson.exercises.map((exercise) => exercise.type);
    expect(types.filter((type) => type === 'select-squares').length).toBeGreaterThanOrEqual(3);
    expect(types.filter((type) => type === 'best-move').length).toBeGreaterThanOrEqual(4);
  });

  it('safe-pieces has >= 5 balanced yes-no and >= 4 best-move exercises', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'safe-pieces');
    if (lesson === undefined) throw new Error('safe-pieces lesson not found');
    const yesNo = lesson.exercises.filter((exercise) => exercise.type === 'yes-no');
    expect(yesNo.length).toBeGreaterThanOrEqual(5);
    const yes = yesNo.filter((exercise) => exercise.answer).length;
    const no = yesNo.length - yes;
    expect(Math.abs(yes - no)).toBeLessThanOrEqual(1);
    const bestMove = lesson.exercises.filter((exercise) => exercise.type === 'best-move');
    expect(bestMove.length).toBeGreaterThanOrEqual(4);
  });

  it('trades has good/equal/bad each at least twice among its choice exercises', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'trades');
    if (lesson === undefined) throw new Error('trades lesson not found');
    const choices = lesson.exercises.filter(
      (exercise): exercise is Extract<ExerciseDef, { type: 'choice' }> =>
        exercise.type === 'choice',
    );
    const counts = { good: 0, equal: 0, bad: 0 } as Record<string, number>;
    for (const choice of choices) {
      counts[choice.answer] = (counts[choice.answer] ?? 0) + 1;
    }
    expect(counts.good).toBeGreaterThanOrEqual(2);
    expect(counts.equal).toBeGreaterThanOrEqual(2);
    expect(counts.bad).toBeGreaterThanOrEqual(2);
  });

  it('defend has >= 5 best-move save exercises and >= 3 yes-no defended checks', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'defend');
    if (lesson === undefined) throw new Error('defend lesson not found');
    const types = lesson.exercises.map((exercise) => exercise.type);
    expect(types.filter((type) => type === 'best-move').length).toBeGreaterThanOrEqual(5);
    expect(types.filter((type) => type === 'yes-no').length).toBeGreaterThanOrEqual(3);
  });
});
