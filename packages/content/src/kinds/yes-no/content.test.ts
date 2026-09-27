import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validCanCastleVerifyExercise,
  validCanEnPassantVerifyExercise,
  validInsufficientMaterialVerifyExercise,
  validYesNoExercise,
  validYesNoHangingExercise,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../../testing/fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('yes-no', () => {
  it('loads a valid yes-no exercise with no issues', () => {
    writeLesson({ exercises: [validYesNoExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects a focus square that is not a valid square', () => {
    writeLesson({ exercises: [validYesNoExercise({ focus: 'z9' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('exercises.0.focus'))).toBe(true);
  });

  it('rejects an answer that is not "yes" or "no"', () => {
    writeLesson({ exercises: [validYesNoExercise({ answer: 'maybe' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('exercises.0.answer'))).toBe(true);
  });
});
describe('yes-no: verify', () => {
  it('loads a valid "hanging" verify with no issues', () => {
    writeLesson({ exercises: [validYesNoHangingExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects an answer contradicting the computed fact', () => {
    writeLesson({ exercises: [validYesNoHangingExercise({ answer: 'no' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) => issue.includes('verify "hanging e4"') && issue.includes('answer is "no"'),
      ),
    ).toBe(true);
  });

  it('rejects "not hanging" on a defended piece attacked by a cheaper piece', () => {
    // Black queen e4, defended by the rook e8, attacked by the white pawn d3: not hanging, but
    // not safe either (pawn takes queen).
    writeLesson({
      exercises: [
        validYesNoHangingExercise({
          board: diagram({ e4: 'q', e8: 'r', d3: 'P', a1: 'K', h8: 'k' }),
          answer: 'no',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('attacked by a cheaper piece'))).toBe(true);
  });

  it('accepts "not hanging" on a defended piece attacked by an equal or dearer piece', () => {
    // White knight d4 attacked by the black queen d8, defended by the pawn c3: safe.
    writeLesson({
      exercises: [
        validYesNoHangingExercise({
          board: diagram({ d4: 'N', d8: 'q', c3: 'P', a1: 'K', h8: 'k' }),
          answer: 'no',
          focus: 'd4',
          verify: 'hanging d4',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('accepts "in-check" with no square', () => {
    writeLesson({
      exercises: [
        validYesNoHangingExercise({
          board: diagram({ g1: 'K', f2: 'P', h2: 'P', g8: 'r', a8: 'k' }),
          focus: undefined,
          verify: 'in-check',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('loads a valid "can-castle kingside" verify with no issues', () => {
    writeLesson({ exercises: [validCanCastleVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('loads a valid "can-castle queenside" verify with no issues', () => {
    writeLesson({
      exercises: [
        validCanCastleVerifyExercise({ focus: undefined, verify: 'can-castle queenside' }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('accepts "can-castle kingside" answer "no" once the right is gone', () => {
    writeLesson({
      exercises: [
        validCanCastleVerifyExercise({
          fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1',
          answer: 'no',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects an answer contradicting "can-castle kingside"', () => {
    writeLesson({ exercises: [validCanCastleVerifyExercise({ answer: 'no' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "can-castle kingside" is true') &&
          issue.includes('answer is "no"'),
      ),
    ).toBe(true);
  });

  it('loads a valid "can-en-passant" verify (right after the double step) with no issues', () => {
    writeLesson({ exercises: [validCanEnPassantVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('accepts "can-en-passant" answer "no" once the double step was not the last move', () => {
    writeLesson({
      exercises: [
        validCanEnPassantVerifyExercise({
          fen: '4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1',
          answer: 'no',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects an answer contradicting "can-en-passant"', () => {
    writeLesson({ exercises: [validCanEnPassantVerifyExercise({ answer: 'no' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "can-en-passant" is true') && issue.includes('answer is "no"'),
      ),
    ).toBe(true);
  });

  it('loads a valid "insufficient-material" verify with no issues', () => {
    writeLesson({ exercises: [validInsufficientMaterialVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects an answer contradicting "insufficient-material"', () => {
    writeLesson({
      exercises: [
        validInsufficientMaterialVerifyExercise({
          board: diagram({ e1: 'K', e8: 'k', a1: 'R' }),
          answer: 'yes',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "insufficient-material" is false') &&
          issue.includes('answer is "yes"'),
      ),
    ).toBe(true);
  });
});
