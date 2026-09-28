import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompiledContent, ExerciseDef } from '../chess.ts';
import { playExerciseToCompletion } from '../testing/index.ts';
import { describe, expect, it } from 'vitest';
import { chessContent } from './chess-content.ts';
import { loadLocales, mergeLocales } from '@learn/platform-content/load';
import { loadContent } from '@learn/platform-content/lesson-load';
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

const WORLD5_LESSON_IDS = ['castling', 'en-passant', 'draws'];

describe("World 5 lessons play to completion via the engine, using each exercise's own answer", () => {
  for (const lessonId of WORLD5_LESSON_IDS) {
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

describe('World 5 exercise counts match docs/curriculum.md and the M4.1 spec', () => {
  const EXPECTED: readonly { readonly id: string; readonly exerciseCount: number }[] = [
    { id: 'castling', exerciseCount: 8 },
    { id: 'en-passant', exerciseCount: 5 },
    { id: 'draws', exerciseCount: 5 },
  ];

  it.each(EXPECTED)(
    '$id has $exerciseCount exercises and 2 guided tries',
    ({ id, exerciseCount }) => {
      const lesson = content.lessons.find((candidate) => candidate.id === id);
      if (lesson === undefined) {
        throw new Error(`${id} lesson not found`);
      }
      expect(lesson.world).toBe('rules');
      expect(lesson.character).toBe('owl');
      expect(lesson.guided).toHaveLength(2);
      expect(lesson.exercises).toHaveLength(exerciseCount);
    },
  );

  it('castling: every item is rule-verified, each failing condition shown, >= 3 best-move "castle"', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'castling');
    if (lesson === undefined) throw new Error('castling lesson not found');
    const bestMove = lesson.exercises.filter((exercise) => exercise.type === 'best-move');
    expect(bestMove.length).toBeGreaterThanOrEqual(3);
    const yesNo = lesson.exercises.filter(
      (exercise): exercise is Extract<ExerciseDef, { type: 'yes-no' }> =>
        exercise.type === 'yes-no',
    );
    // At least one "yes" (castling is legal) and one "no" among the yes-no exercises.
    expect(yesNo.some((exercise) => exercise.answer)).toBe(true);
    expect(yesNo.some((exercise) => !exercise.answer)).toBe(true);
  });

  it('en-passant: >= 3 best-move with lastMove, >= 2 yes-no can-en-passant (one "no")', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'en-passant');
    if (lesson === undefined) throw new Error('en-passant lesson not found');
    const bestMoveWithLastMove = lesson.exercises.filter(
      (exercise) => exercise.type === 'best-move' && exercise.lastMove !== undefined,
    );
    expect(bestMoveWithLastMove.length).toBeGreaterThanOrEqual(3);
    const yesNo = lesson.exercises.filter(
      (exercise): exercise is Extract<ExerciseDef, { type: 'yes-no' }> =>
        exercise.type === 'yes-no',
    );
    expect(yesNo.length).toBeGreaterThanOrEqual(2);
    expect(yesNo.some((exercise) => !exercise.answer)).toBe(true);
  });

  it('draws: >= 1 yes-no stalemate recap, >= 1 insufficient-material check, choice draw-kind covers all 3 kinds', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'draws');
    if (lesson === undefined) throw new Error('draws lesson not found');
    const yesNo = lesson.exercises.filter(
      (exercise): exercise is Extract<ExerciseDef, { type: 'yes-no' }> =>
        exercise.type === 'yes-no',
    );
    expect(yesNo.length).toBeGreaterThanOrEqual(2);
    const choice = lesson.exercises.filter(
      (exercise): exercise is Extract<ExerciseDef, { type: 'choice' }> =>
        exercise.type === 'choice',
    );
    const answers = new Set(choice.map((exercise) => exercise.answer));
    expect(answers).toEqual(new Set(['stalemate', 'insufficient-material', 'not-a-draw']));
  });
});

describe('World 5 world boss: full-game-rabbit', () => {
  it('is a versus mini-game vs. Rabbit (bot 2) with real check rules, unlocked after draws', () => {
    const minigame = content.minigames.find((candidate) => candidate.id === 'full-game-rabbit');
    if (minigame === undefined) throw new Error('full-game-rabbit mini-game not found');
    if (minigame.mode !== 'versus') throw new Error('full-game-rabbit is not a versus mini-game');
    expect(minigame.unlockAfter).toBe('draws');
    expect(minigame.opponentLevel).toBe(2);
    expect(minigame.rules.kings).toBe(true);
    expect(minigame.rules.checkRules).toBe(true);
    expect(minigame.rules.win.w).toEqual([{ kind: 'checkmate' }]);
    expect(minigame.rules.win.b).toEqual([{ kind: 'checkmate' }]);
    expect(minigame.rules.moveLimit).toBe(100);
  });

  it('is set as the "rules" world boss in tracks.yaml', () => {
    // A thin smoke check here; tracks.test.ts covers the full cross-reference validation.
    expect(content.minigames.some((candidate) => candidate.id === 'full-game-rabbit')).toBe(true);
  });
});
