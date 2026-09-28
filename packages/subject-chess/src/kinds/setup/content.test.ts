import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validSetupExercise,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../../testing/content-fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('setup', () => {
  it('loads a valid setup exercise with no issues', () => {
    writeLesson({ exercises: [validSetupExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports a start piece that is not part of the target', () => {
    writeLesson({
      exercises: [
        validSetupExercise({
          board: diagram({ h8: 'r' }), // not in the target (a1 rook only)
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('start piece at h8 is not part of the target')),
    ).toBe(true);
  });

  it('reports a target that is the same as the start position', () => {
    writeLesson({
      exercises: [
        validSetupExercise({
          board: diagram({ a1: 'R' }),
          target: { board: diagram({ a1: 'R' }) },
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('setup target is the same as the start position')),
    ).toBe(true);
  });

  it('reports star/blocked markers on the target', () => {
    writeLesson({
      exercises: [validSetupExercise({ target: { board: diagram({ a1: 'R', h8: '*' }) } })],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('setup target must not use star or blocked markers')),
    ).toBe(true);
  });

  it('requires exactly one of "board" or "fen" on the target', () => {
    writeLesson({ exercises: [validSetupExercise({ target: {} })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('exercises.0.target'))).toBe(true);
  });
});
