import { join } from 'node:path';
import type { CompiledContent } from '../../chess.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chessContent } from '../../content/chess-content.ts';
import { loadLocales } from '@learn/platform-content/load';
import { loadContent } from '@learn/platform-content/lesson-load';
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
} from '../../testing/content-fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('capture', () => {
  it('defaults stars2 to stars3 + 1 when absent', () => {
    writeLesson({
      exercises: [
        validExercise({
          type: 'capture',
          board: diagram({ d1: 'R', d5: 'p' }),
          stars3: 1,
          stars2: undefined,
        }),
      ],
    });
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
    expect(exercise?.type === 'capture' && exercise.stars2).toBe(2);
  });
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
