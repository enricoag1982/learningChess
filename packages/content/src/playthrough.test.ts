import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaptureDef, CollectStarsDef } from '@chess-kids/core';
import {
  chessJsRules,
  createVariantRules,
  gameResult,
  gameStars,
  playGameMove,
  playMove,
  solve,
  startExercise,
  startStaticCaptureGame,
} from '@chess-kids/core';
import { describe, expect, it } from 'vitest';
import { loadLocales } from './load.ts';
import { loadContent } from './lesson-load.ts';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = loadLocales(join(packageDir, 'locales'));
const content = loadContent(join(packageDir, 'lessons'), join(packageDir, 'minigames'), locales);
const rules = createVariantRules(chessJsRules);

const NEW_LESSON_IDS = ['bishop', 'queen', 'king', 'knight'];

/**
 * Content-only (no UI, no e2e) proof that a lesson's movement exercises are actually completable
 * end to end through the real exercise engine, not just that a solution exists (`lessons.test.ts`
 * already checks the solver finds one at `stars3`). Every solver move is replayed through
 * `playMove`; the resulting state must end up `solved`.
 */
describe('World 2 lessons play to completion via the engine, using solver lines', () => {
  for (const lessonId of NEW_LESSON_IDS) {
    const lesson = content.lessons.find((candidate) => candidate.id === lessonId);
    if (lesson === undefined) {
      throw new Error(`${lessonId} lesson not found`);
    }

    it(`${lessonId}: every collect-stars / capture guided try and exercise solves via its solver line`, () => {
      const movable = [...lesson.guided, ...lesson.exercises].filter(
        (exercise): exercise is CollectStarsDef | CaptureDef =>
          exercise.type === 'collect-stars' || exercise.type === 'capture',
      );
      expect(movable.length).toBeGreaterThan(0);

      for (const exercise of movable) {
        const line = solve(exercise.position, rules, exercise.type);
        expect(line, `${lesson.id}/${exercise.id}: solver found no line`).not.toBeNull();

        let state = startExercise(exercise);
        for (const move of line ?? []) {
          const result = playMove(state, rules, move);
          expect(
            result.outcome.kind,
            `${lesson.id}/${exercise.id}: move ${move.from}-${move.to} was rejected`,
          ).not.toBe('illegal');
          state = result.state;
        }
        expect(state.solved, `${lesson.id}/${exercise.id}: not solved after its solver line`).toBe(
          true,
        );
        expect(state.moves, `${lesson.id}/${exercise.id}: move count vs. stars3`).toBe(
          exercise.stars3,
        );
      }
    });

    it(`${lessonId}: its boss mini-game is winnable within par via a solver line`, () => {
      if (lesson.boss === undefined) {
        throw new Error(`${lessonId}: no boss configured`);
      }
      const minigame = content.minigames.find((candidate) => candidate.id === lesson.boss);
      if (minigame === undefined) {
        throw new Error(`${lesson.boss} mini-game not found`);
      }
      if (minigame.mode !== 'static') {
        throw new Error(`${lesson.boss} mini-game is not static`);
      }

      const goal = minigame.goal === 'collect-stars' ? 'collect-stars' : 'capture';
      const line = solve(minigame.position, rules, goal);
      expect(line, `${minigame.id}: solver found no line`).not.toBeNull();

      let game = startStaticCaptureGame(minigame);
      for (const move of line ?? []) {
        const { state, outcome } = playGameMove(game, rules, move);
        expect(outcome.kind, `${minigame.id}: move ${move.from}-${move.to} was rejected`).not.toBe(
          'illegal',
        );
        game = state;
      }
      expect(gameResult(game)).toBe('won');
      expect(gameStars(game)).toBe(3);
    });
  }
});
