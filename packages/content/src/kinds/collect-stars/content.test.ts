import { join } from 'node:path';
import type { CompiledContent } from '@learn/subject-chess';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chessContent } from '../../chess-content.ts';
import { loadLocales } from '../../load.ts';
import { loadContent } from '../../lesson-load.ts';
import {
  diagram,
  dir,
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

describe('collect-stars', () => {
  it('reports an unsolvable collect-stars exercise (star sealed behind rocks)', () => {
    writeLesson({
      exercises: [
        validExercise({
          board: diagram({ a1: 'R', d5: 'x', c4: 'x', e4: 'x', d3: 'x', d4: '*' }),
          stars3: 1,
          stars2: 1,
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('no solution found'))).toBe(true);
  });
  it('reports stars3 not matching the optimal solve', () => {
    writeLesson({ exercises: [validExercise({ stars3: 3, stars2: 3 })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('stars3 is 3') && issue.includes('optimal solve is 1')),
    ).toBe(true);
  });
  it('reports stars2 below stars3', () => {
    // R a1, stars a8 + h8: optimal is 2 moves.
    writeLesson({
      exercises: [
        validExercise({ board: diagram({ a1: 'R', a8: '*', h8: '*' }), stars3: 2, stars2: 1 }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('stars2 (1) is below stars3 (2)'))).toBe(true);
  });
  it('reports a collect-stars exercise with no star', () => {
    writeLesson({ exercises: [validExercise({ board: diagram({ a1: 'R' }) })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('collect-stars exercise has no star'))).toBe(true);
  });
  it('defaults stars2 to stars3 + 1 when absent', () => {
    writeLesson({ exercises: [validExercise({ stars2: undefined })] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
    const locales = loadLocales(join(dir, 'locales'));
    const content = loadContent<CompiledContent>(
      join(dir, 'lessons'),
      join(dir, 'minigames'),
      locales,
      chessContent,
    );
    const exercise = content.lessons[0]?.exercises[0];
    expect(exercise?.type === 'collect-stars' && exercise.stars2).toBe(2);
  });
});
