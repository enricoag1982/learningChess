import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validExercise,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../../testing/fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('capture', () => {
  it('reports a capture exercise with no opponent piece', () => {
    writeLesson({
      exercises: [
        validExercise({ type: 'capture', board: diagram({ a1: 'R' }), stars3: 1, stars2: 1 }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('capture exercise has no opponent piece'))).toBe(
      true,
    );
  });
});
