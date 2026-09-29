import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validBestMoveExercise,
  validChoiceExercise,
  validEnPassantVerifyExercise,
  validExercise,
  validSetupExercise,
  validYesNoExercise,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../testing/content-fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('loadContent', () => {
  it('reports an invalid board diagram', () => {
    writeLesson({ exercises: [validExercise({ board: 'not a board' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('exercises[0].board'))).toBe(true);
    expect(issues.some((issue) => issue.includes('expected 8 rows'))).toBe(true);
  });
  it('reports a position with no piece for the side to move', () => {
    writeLesson({ exercises: [validExercise({ board: diagram({ d5: '*' }) })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('side to move has no piece'))).toBe(true);
  });
  describe('lastMove field', () => {
    it('loads a valid lastMove (piece on "to") with no issues', () => {
      writeLesson({ exercises: [validBestMoveExercise({ lastMove: 'a2a1' })] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('rejects a lastMove with no piece on "to"', () => {
      writeLesson({ exercises: [validBestMoveExercise({ lastMove: 'a2a3' })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('lastMove "a2a3": no piece on a3'))).toBe(true);
    });

    it('loads a valid lastMove matching the en passant double step with no issues', () => {
      writeLesson({ exercises: [validEnPassantVerifyExercise({ lastMove: 'd7d5' })] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('rejects a lastMove that is not the double step matching the en passant square', () => {
      writeLesson({ exercises: [validEnPassantVerifyExercise({ lastMove: 'c7d5' })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) =>
          issue.includes('lastMove "c7d5" is not the double step matching en passant square d6'),
        ),
      ).toBe(true);
    });
  });
  it('loads a fixture lesson using all four new exercise types with no issues', () => {
    writeLesson({
      guided: [],
      exercises: [
        validYesNoExercise({ id: 'yn-01' }),
        validChoiceExercise({ id: 'ch-01' }),
        validBestMoveExercise({ id: 'bm-01' }),
        validSetupExercise({ id: 'su-01' }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports a choice option referencing a missing text key (kind content textKeys)', () => {
    writeLesson({
      exercises: [
        validChoiceExercise({
          options: [
            { id: 'rook', text: 'no-such-option-key' },
            { id: 'pawn', piece: 'P' },
          ],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('missing text key "lessons:no-such-option-key"') &&
          issue.includes('option "rook"'),
      ),
    ).toBe(true);
  });
});
