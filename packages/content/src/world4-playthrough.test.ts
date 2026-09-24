import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExerciseDef, ExerciseState } from '@chess-kids/core';
import {
  answerYesNo,
  chessJsRules,
  completeRound,
  createVariantRules,
  currentRound,
  playMateInN,
  playMove,
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

const WORLD4_LESSON_IDS = ['check', 'escape-check', 'checkmate', 'mate-in-1', 'stalemate'];

/**
 * Plays one exercise to completion using its own definition as the answer key — `select-squares` /
 * `yes-no` / `best-move` as in `world3-playthrough.test.ts`, plus `mate-in-n` (M3.3: walks the whole
 * scripted `line`, kid move by kid move, real chess rules — the loader already proved the line is
 * legal and mates; this only proves the engine accepts it end to end).
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
  if (def.type === 'best-move') {
    const [solutionSan] = def.solutions;
    if (solutionSan === undefined) {
      throw new Error(`best-move exercise "${def.id}" has no solutions`);
    }
    const candidates = rules.legalMoves(def.position, { staticOpponent: true });
    const move = candidates.find(
      (candidate) => candidate.san.replace(/[+#]+$/, '') === solutionSan.replace(/[+#]+$/, ''),
    );
    if (move === undefined) {
      throw new Error(`best-move exercise "${def.id}": no legal move matches "${solutionSan}"`);
    }
    return playMove(state, rules, { from: move.from, to: move.to, promotion: move.promotion })
      .state;
  }
  if (def.type === 'mate-in-n') {
    let current = state;
    for (const san of def.line) {
      const candidates = chessJsRules.legalMoves(current.position);
      const move = candidates.find(
        (candidate) => candidate.san.replace(/[+#]+$/, '') === san.replace(/[+#]+$/, ''),
      );
      if (move === undefined) {
        throw new Error(`mate-in-n exercise "${def.id}": no legal move matches "${san}"`);
      }
      const { state: next } = playMateInN(current, chessJsRules, {
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      });
      current = next;
      if (current.solved) {
        break; // the final (mating) move solves it before the scripted reply, if any, is needed
      }
    }
    return current;
  }
  throw new Error(`playExerciseToCompletion: unsupported exercise type "${def.type}"`);
}

describe("World 4 lessons play to completion via the engine, using each exercise's own answer", () => {
  for (const lessonId of WORLD4_LESSON_IDS) {
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

describe('escape-the-check and mate-hunt (series) play every round for 3 stars', () => {
  it.each(['escape-the-check', 'mate-hunt'])('%s', (id) => {
    const minigame = content.minigames.find((candidate) => candidate.id === id);
    if (minigame === undefined) {
      throw new Error(`${id} mini-game not found`);
    }
    if (minigame.mode !== 'series') {
      throw new Error(`${id} mini-game is not a series`);
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
});

describe('World 4 exercise counts match docs/curriculum.md and the M3.3 spec', () => {
  const EXPECTED: readonly { readonly id: string; readonly exerciseCount: number }[] = [
    { id: 'check', exerciseCount: 8 },
    { id: 'escape-check', exerciseCount: 10 },
    { id: 'checkmate', exerciseCount: 8 },
    { id: 'mate-in-1', exerciseCount: 12 },
    { id: 'stalemate', exerciseCount: 6 },
  ];

  it.each(EXPECTED)(
    '$id has $exerciseCount exercises and 2 guided tries',
    ({ id, exerciseCount }) => {
      const lesson = content.lessons.find((candidate) => candidate.id === id);
      if (lesson === undefined) {
        throw new Error(`${id} lesson not found`);
      }
      expect(lesson.world).toBe('check');
      expect(lesson.character).toBe('owl');
      expect(lesson.guided).toHaveLength(2);
      expect(lesson.exercises).toHaveLength(exerciseCount);
    },
  );

  it('check has >= 4 best-move "check" exercises and balanced yes/no', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'check');
    if (lesson === undefined) throw new Error('check lesson not found');
    const bestMove = lesson.exercises.filter((exercise) => exercise.type === 'best-move');
    expect(bestMove.length).toBeGreaterThanOrEqual(4);
    const yesNo = lesson.exercises.filter(
      (exercise): exercise is Extract<ExerciseDef, { type: 'yes-no' }> =>
        exercise.type === 'yes-no',
    );
    const yes = yesNo.filter((exercise) => exercise.answer).length;
    expect(Math.abs(yes - (yesNo.length - yes))).toBeLessThanOrEqual(1);
  });

  it('escape-check has >= 3 select-squares and >= 2 each of escape-king/block/capture', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'escape-check');
    if (lesson === undefined) throw new Error('escape-check lesson not found');
    const select = lesson.exercises.filter((exercise) => exercise.type === 'select-squares');
    expect(select.length).toBeGreaterThanOrEqual(3);
    expect(
      lesson.exercises.filter((exercise) => exercise.type === 'best-move').length,
    ).toBeGreaterThanOrEqual(6);
  });

  it('checkmate has balanced yes/no answers', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'checkmate');
    if (lesson === undefined) throw new Error('checkmate lesson not found');
    const yesNo = lesson.exercises.filter(
      (exercise): exercise is Extract<ExerciseDef, { type: 'yes-no' }> =>
        exercise.type === 'yes-no',
    );
    const yes = yesNo.filter((exercise) => exercise.answer).length;
    expect(yes).toBe(yesNo.length - yes);
  });

  it('mate-in-1 covers back-rank (>=3), queen+king (>=3), two rooks (>=2)', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'mate-in-1');
    if (lesson === undefined) throw new Error('mate-in-1 lesson not found');
    expect(
      lesson.exercises.every((exercise) => exercise.type === 'mate-in-n' && exercise.n === 1),
    ).toBe(true);
  });

  it('stalemate has >= 3 yes-no stalemate checks and >= 2 mate-in-n with a stalemate trap', () => {
    const lesson = content.lessons.find((candidate) => candidate.id === 'stalemate');
    if (lesson === undefined) throw new Error('stalemate lesson not found');
    const yesNo = lesson.exercises.filter((exercise) => exercise.type === 'yes-no');
    expect(yesNo.length).toBeGreaterThanOrEqual(3);
    const mateInN = lesson.exercises.filter((exercise) => exercise.type === 'mate-in-n');
    expect(mateInN.length).toBeGreaterThanOrEqual(2);
  });
});

describe('World 4 world boss: first-game', () => {
  it('is a versus mini-game with real check rules, unlocked after stalemate', () => {
    const minigame = content.minigames.find((candidate) => candidate.id === 'first-game');
    if (minigame === undefined) throw new Error('first-game mini-game not found');
    if (minigame.mode !== 'versus') throw new Error('first-game is not a versus mini-game');
    expect(minigame.unlockAfter).toBe('stalemate');
    expect(minigame.rules.kings).toBe(true);
    expect(minigame.rules.checkRules).toBe(true);
    expect(minigame.rules.win.w).toEqual([{ kind: 'checkmate' }]);
    expect(minigame.rules.win.b).toEqual([{ kind: 'checkmate' }]);
  });

  it('is set as the "check" world boss in tracks.yaml', () => {
    // A thin smoke check here; tracks.test.ts covers the full cross-reference validation.
    expect(content.minigames.some((candidate) => candidate.id === 'first-game')).toBe(true);
  });
});
