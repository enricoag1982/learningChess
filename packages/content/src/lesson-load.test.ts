import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { ContentError, loadLocales } from './load.ts';
import { loadContent } from './lesson-load.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chess-kids-lessons-'));
  mkdirSync(join(dir, 'minigames'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(relPath: string, content: string): void {
  const filePath = join(dir, relPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/** Board diagram from a square → symbol map; every other square is empty. */
function diagram(pieces: Record<string, string>): string {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  return ranks
    .map((rank) => files.map((file) => pieces[`${file}${rank}`] ?? '.').join(' '))
    .join('\n');
}

/** Rook on d1, one star on d5: solvable in exactly 1 move. */
function validExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'collect-stars',
    text: 'demo-01',
    board: diagram({ d1: 'R', d5: '*' }),
    stars3: 1,
    stars2: 1,
    ...overrides,
  };
}

/** Rook on d4, no stars3/stars2: a select-squares exercise deriving from `from`. */
function validSelectSquaresExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'select-squares',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    derive: 'legal-moves',
    from: 'a1',
    ...overrides,
  };
}

function validLesson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-lesson',
    world: 'w1',
    order: 1,
    concept: 'c1',
    character: 'char1',
    title: 'demo-lesson.title',
    story: 'demo-lesson.story',
    demo: {
      board: diagram({ d4: 'R' }),
      text: 'demo-demo',
      highlight: 'legal-moves d4',
    },
    guided: [],
    exercises: [validExercise()],
    ...overrides,
  };
}

/** Rook on a1, one pawn on f1: capture solvable in exactly 1 move. */
function validMiniGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mg1',
    concept: 'c1',
    unlockAfter: 'demo-lesson',
    title: 'mg1.title',
    goal: 'mg1.goal',
    board: diagram({ a1: 'R', f1: 'p' }),
    par: 1,
    moveLimit: 5,
    ...overrides,
  };
}

function writeLesson(overrides: Record<string, unknown> = {}): void {
  write('lessons/w1/demo-lesson.yaml', stringify(validLesson(overrides)));
}

function writeMiniGame(overrides: Record<string, unknown> = {}): void {
  write('minigames/mg1.yaml', stringify(validMiniGame(overrides)));
}

function writeDefaultLocales(): void {
  write(
    'locales/en/lessons.yaml',
    stringify({
      'demo-lesson': { title: 'Title', story: 'Story' },
      'demo-demo': 'Demo',
      'demo-01': 'Exercise',
      mg1: { title: 'Title', goal: 'Goal' },
    }),
  );
  write('locales/en/characters.yaml', stringify({ char1: { name: 'Char' } }));
}

function load(): void {
  const locales = loadLocales(join(dir, 'locales'));
  loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
}

function issuesOf(): string[] {
  try {
    load();
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.issues];
    throw error;
  }
}

describe('loadContent', () => {
  it('loads a valid lesson and mini-game with no issues', () => {
    writeLesson();
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports an invalid board diagram', () => {
    writeLesson({ exercises: [validExercise({ board: 'not a board' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('exercises[0].board'))).toBe(true);
    expect(issues.some((issue) => issue.includes('expected 8 rows'))).toBe(true);
  });

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

  it('reports a missing text key', () => {
    writeLesson({ exercises: [validExercise({ text: 'no-such-key' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('missing text key "lessons:no-such-key"'))).toBe(
      true,
    );
  });

  it('reports a duplicate id', () => {
    writeLesson({ exercises: [validExercise(), validExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('duplicate id "demo-01"'))).toBe(true);
  });

  it('reports an unknown boss reference', () => {
    writeLesson({ boss: 'no-such-minigame' });
    writeDefaultLocales();
    // No mini-game file at all.

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('unknown mini-game "no-such-minigame"'))).toBe(
      true,
    );
  });

  it('reports an unrecognized YAML key', () => {
    writeLesson({ notAField: true });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain('demo-lesson.yaml');
  });

  it('reports an unknown easier reference', () => {
    writeLesson({ exercises: [validExercise({ easier: 'no-such-exercise' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('unknown exercise "no-such-exercise"'))).toBe(
      true,
    );
  });

  it('reports an unknown unlockAfter reference', () => {
    writeLesson();
    writeMiniGame({ unlockAfter: 'no-such-lesson' });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('unknown lesson "no-such-lesson"'))).toBe(true);
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

  it('reports a collect-stars exercise with no star', () => {
    writeLesson({ exercises: [validExercise({ board: diagram({ a1: 'R' }) })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('collect-stars exercise has no star'))).toBe(true);
  });

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

  it('reports a position with no piece for the side to move', () => {
    writeLesson({ exercises: [validExercise({ board: diagram({ d5: '*' }) })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('side to move has no piece'))).toBe(true);
  });

  it('reports a mini-game moveLimit that does not exceed par', () => {
    writeLesson();
    writeMiniGame({ moveLimit: 1 });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('moveLimit (1) must be greater than par (1)')),
    ).toBe(true);
  });

  it('reports multiple issues across files together', () => {
    writeLesson({ boss: 'no-such-minigame', exercises: [validExercise({ text: 'missing-key' })] });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((issue) => issue.includes('unknown mini-game'))).toBe(true);
    expect(issues.some((issue) => issue.includes('missing text key'))).toBe(true);
  });
});
