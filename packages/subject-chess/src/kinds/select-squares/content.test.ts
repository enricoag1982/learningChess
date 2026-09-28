import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validAttackedByExercise,
  validCheckEscapesExercise,
  validSelectSquaresExercise,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../../testing/content-fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('select-squares', () => {
  it('reports an empty select-squares answer', () => {
    writeLesson({
      exercises: [
        {
          id: 'demo-01',
          type: 'select-squares',
          text: 'demo-01',
          board: diagram({ a1: 'R' }),
          answer: [],
        },
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.toLowerCase().includes('answer') && issue.includes('empty')),
    ).toBe(true);
  });
  it("reports a select-squares 'from' square with no kid piece", () => {
    writeLesson({
      exercises: [validSelectSquaresExercise({ from: 'h8' })],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('"from" square has no piece of the side to move')),
    ).toBe(true);
  });
  it('allows an empty board for select-squares with explicit squares (board geometry)', () => {
    writeLesson({
      exercises: [
        validSelectSquaresExercise({
          board: diagram({}),
          derive: undefined,
          from: undefined,
          answer: ['b1', 'd1', 'f1', 'h1'],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });
  describe('select-squares: attacked-by', () => {
    it('loads a valid attacked-by exercise with no issues', () => {
      writeLesson({ exercises: [validAttackedByExercise()] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('reports a "from" square with no piece at all (either colour is fine otherwise)', () => {
      writeLesson({ exercises: [validAttackedByExercise({ from: 'h1' })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('"from" square has no piece'))).toBe(true);
    });

    it('rejects "from" together with "derive: check-escapes"', () => {
      writeLesson({
        exercises: [validAttackedByExercise({ derive: 'check-escapes' })],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) => issue.includes('check-escapes') && issue.includes('must not set')),
      ).toBe(true);
    });
  });
  describe('select-squares: check-escapes', () => {
    it('loads a valid check-escapes exercise with no issues', () => {
      writeLesson({ exercises: [validCheckEscapesExercise()] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('reports a king that is not actually in check', () => {
      writeLesson({
        exercises: [validCheckEscapesExercise({ board: diagram({ g1: 'K', a8: 'k' }) })],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('king to be in check'))).toBe(true);
    });

    it('reports a checked king with no legal move of its own (a piece could still block)', () => {
      // King g1 fully boxed by its own pieces (f1/f2/h1/h2); g2 stays empty (still on the
      // checked g-file, so moving there would not escape check either) but the bishop on f1
      // could still block on g2 — the king itself simply has no legal move.
      writeLesson({
        exercises: [
          validCheckEscapesExercise({
            board: diagram({ g1: 'K', f1: 'B', h1: 'N', f2: 'P', h2: 'P', g8: 'r', a8: 'k' }),
          }),
        ],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('no legal king move'))).toBe(true);
    });

    it('requires "derive" when "from" is set without "answer"', () => {
      writeLesson({
        exercises: [
          {
            id: 'demo-01',
            type: 'select-squares',
            text: 'demo-01',
            board: diagram({ a1: 'R' }),
            from: 'a1',
          },
        ],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('"from" requires "derive"'))).toBe(true);
    });
  });
});
