import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExerciseDef, ExerciseState, Square } from '@chess-kids/core';
import {
  answerYesNo,
  chessJsRules,
  completeRound,
  createVariantRules,
  currentRound,
  placePiece,
  selectSquaresAnswer,
  seriesResult,
  seriesStars,
  startExercise,
  startSeries,
  submitSelection,
  toggleSquare,
} from '@chess-kids/core';
import { describe, expect, it } from 'vitest';
import { loadLocales } from './load.ts';
import { loadContent } from './lesson-load.ts';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = loadLocales(join(packageDir, 'locales'));
const content = loadContent(join(packageDir, 'lessons'), join(packageDir, 'minigames'), locales);
const rules = createVariantRules(chessJsRules);

const WORLD1_LESSON_IDS = ['squares', 'lines', 'setup'];

/**
 * Plays one `select-squares` / `yes-no` / `setup` exercise to completion using its own definition
 * as the answer key (the World 1 exercise types have no solver: the answer is authored directly).
 */
function playExerciseToCompletion(def: ExerciseDef): ExerciseState {
  const state = startExercise(def);
  if (def.type === 'select-squares') {
    const answer = selectSquaresAnswer(def, rules);
    const selected = answer.reduce((s, square) => toggleSquare(s, square), state);
    return submitSelection(selected, rules).state;
  }
  if (def.type === 'yes-no') {
    return answerYesNo(state, def.answer);
  }
  if (def.type === 'setup') {
    // Only the squares the exercise actually adds: `target` also repeats whatever `position`
    // already has placed (checkSetupShape requires `position` ⊆ `target`), and placing an
    // already-filled square again is a wrong try (engine.ts: `placePiece`), not a no-op.
    return Object.entries(def.target.pieces).reduce((s, [square, piece]) => {
      if (def.position.pieces[square as Square] !== undefined) {
        return s;
      }
      return placePiece(s, square as Square, piece).state;
    }, state);
  }
  throw new Error(`playExerciseToCompletion: unsupported exercise type "${def.type}"`);
}

describe("World 1 lessons play to completion via the engine, using each exercise's own answer", () => {
  for (const lessonId of WORLD1_LESSON_IDS) {
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

describe('World 1 series bosses (Square Hunt, Setup Race) play to completion for 3 stars', () => {
  for (const lessonId of WORLD1_LESSON_IDS) {
    const lesson = content.lessons.find((candidate) => candidate.id === lessonId);
    if (lesson === undefined || lesson.boss === undefined) {
      continue; // Squares has no boss (docs/curriculum.md World 1 table).
    }
    const bossId = lesson.boss;

    it(`${bossId}: every round solves cleanly and the series finishes with 3 stars`, () => {
      const minigame = content.minigames.find((candidate) => candidate.id === bossId);
      if (minigame === undefined) {
        throw new Error(`${bossId} mini-game not found`);
      }
      if (minigame.mode !== 'series') {
        throw new Error(`${bossId} mini-game is not a series`);
      }

      let series = startSeries(minigame);
      for (const round of minigame.rounds) {
        expect(currentRound(series)).toBe(round);
        const solved = playExerciseToCompletion(round);
        expect(solved.solved, `${minigame.id}/${round.id}: not solved`).toBe(true);
        expect(solved.errors, `${minigame.id}/${round.id}: unexpected error`).toBe(0);
        series = completeRound(series, solved);
      }

      expect(seriesResult(series)).toBe('won');
      expect(seriesStars(series)).toBe(3);
    });
  }
});
