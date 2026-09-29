import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playExerciseToCompletion } from '../testing/index.ts';
import {
  completeRound,
  currentRound,
  seriesResult,
  seriesStars,
  startSeries,
} from '@learn/platform-core';
import { describe, expect, it } from 'vitest';
import { chessContent } from './chess-content.ts';
import { loadLocales, mergeLocales } from '@learn/platform-content/load';
import { loadContent } from '@learn/platform-content/lesson-load';
import { EXERCISE_KINDS } from '../kinds/index.ts';
import type { CompiledContent } from '../core/chess/lesson.ts';
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

const WORLD1_LESSON_IDS = ['squares', 'lines', 'setup'];

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
  }
});
