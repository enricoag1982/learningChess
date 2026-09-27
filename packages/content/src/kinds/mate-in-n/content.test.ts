import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validMateInOneExercise,
  validMateInOneWithStalemateTrapExercise,
  validMateInTwoExercise,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../../testing/fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('mate-in-n', () => {
  it('loads a valid mate-in-1 exercise with no issues', () => {
    writeLesson({ exercises: [validMateInOneExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('loads a valid mate-in-2 exercise (kid move, scripted reply, mating move) with no issues', () => {
    writeLesson({ exercises: [validMateInTwoExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects a line whose length does not match 2*n-1', () => {
    writeLesson({ exercises: [validMateInOneExercise({ n: 2 })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('line') && issue.includes('2*n-1'))).toBe(true);
  });

  it('reports an illegal move in the line', () => {
    writeLesson({ exercises: [validMateInTwoExercise({ line: ['Ne7+', 'Kh8', 'Qc2'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('line[2]') && issue.includes('not a legal move')),
    ).toBe(true);
  });

  it('reports a final move that does not deliver checkmate', () => {
    writeLesson({ exercises: [validMateInOneExercise({ line: ['Rb2'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('does not deliver checkmate'))).toBe(true);
  });

  it('requires both kings on the board', () => {
    writeLesson({
      exercises: [
        validMateInOneExercise({ board: diagram({ a7: 'R', b1: 'R', d1: 'R', g2: 'K' }) }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('requires both kings'))).toBe(true);
  });
});
describe('mate-in-n: trap stalemate', () => {
  it('loads a valid "trap: stalemate" with no issues', () => {
    writeLesson({ exercises: [validMateInOneWithStalemateTrapExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects "trap: stalemate" when no legal kid move stalemates', () => {
    writeLesson({ exercises: [validMateInOneExercise({ trap: 'stalemate' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('trap "stalemate"') && issue.includes('requires >= 1')),
    ).toBe(true);
  });
});
