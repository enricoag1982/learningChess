import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../../testing/fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

it('reports a mini-game moveLimit that does not exceed par', () => {
  writeLesson();
  writeMiniGame({ moveLimit: 1 });
  writeDefaultLocales();

  const issues = issuesOf();
  expect(issues.some((issue) => issue.includes('moveLimit (1) must be greater than par (1)'))).toBe(
    true,
  );
});
describe('mini-game goal', () => {
  it('loads a valid collect-stars mini-game with no issues', () => {
    writeLesson();
    // Rook a1, star d1: 1 move.
    writeMiniGame({ type: 'collect-stars', board: diagram({ a1: 'R', d1: '*' }), par: 1 });
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports a collect-stars mini-game par not matching the optimal solve', () => {
    writeLesson();
    writeMiniGame({ type: 'collect-stars', board: diagram({ a1: 'R', d1: '*' }), par: 2 });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('par is 2') && issue.includes('optimal solve is 1')),
    ).toBe(true);
  });

  it('reports a collect-stars mini-game with no star', () => {
    writeLesson();
    writeMiniGame({ type: 'collect-stars', board: diagram({ a1: 'R' }) });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('collect-stars mini-game has no star'))).toBe(
      true,
    );
  });

  it('rejects an unknown goal type', () => {
    writeLesson();
    writeMiniGame({ type: 'reach-all' });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('type'))).toBe(true);
  });
});
