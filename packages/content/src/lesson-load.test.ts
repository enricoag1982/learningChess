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

/** Rook on a1: a yes-no exercise, answer "yes". */
function validYesNoExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'yes-no',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    answer: 'yes',
    focus: 'a1',
    ...overrides,
  };
}

/** Rook + pawn on the board: a choice exercise between the two pieces, piece-only options. */
function validChoiceExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'choice',
    text: 'demo-01',
    board: diagram({ a1: 'R', h1: 'P' }),
    options: [
      { id: 'rook', piece: 'R' },
      { id: 'pawn', piece: 'P' },
    ],
    answer: 'rook',
    ...overrides,
  };
}

/** Rook on a1: a best-move exercise solved by moving the rook to a8. */
function validBestMoveExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    solutions: ['Ra8'],
    ...overrides,
  };
}

/** Empty board: a setup exercise placing one rook on a1. */
function validSetupExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'setup',
    text: 'demo-01',
    board: diagram({}),
    target: { board: diagram({ a1: 'R' }) },
    ...overrides,
  };
}

/** Pawn on e4 (own pawn on d5, enemy pawn on f5): a select-squares exercise deriving attacked-by. */
function validAttackedByExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'select-squares',
    text: 'demo-01',
    board: diagram({ e4: 'P', d5: 'P', f5: 'p', g8: 'k', e1: 'K' }),
    derive: 'attacked-by',
    from: 'e4',
    ...overrides,
  };
}

/** White king g1 in check from the black rook on g8, escaping to f1 or h1. */
function validCheckEscapesExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'select-squares',
    text: 'demo-01',
    board: diagram({ g1: 'K', f2: 'P', h2: 'P', g8: 'r', a8: 'k' }),
    derive: 'check-escapes',
    ...overrides,
  };
}

/** Two rooks (b1, d1) plus Ra7 cutting off the 7th rank: either rook mates the lone black king. */
function validMateInOneExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'mate-in-n',
    text: 'demo-01',
    board: diagram({ h8: 'k', a7: 'R', b1: 'R', d1: 'R', g2: 'K' }),
    n: 1,
    line: ['Rb8#'],
    ...overrides,
  };
}

/** 1.Ne7+ Kh8 2.Qa8# — a mate-in-2 with a scripted opponent reply. */
function validMateInTwoExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'mate-in-n',
    text: 'demo-01',
    board: diagram({ g8: 'k', f7: 'p', g7: 'p', h7: 'p', c6: 'N', a1: 'Q', b1: 'K' }),
    n: 2,
    line: ['Ne7+', 'Kh8', 'Qa8#'],
    ...overrides,
  };
}

/** A black pawn on e4, attacked by the white pawn on d3 and undefended: a "hanging" yes-no exercise. */
function validYesNoHangingExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'yes-no',
    text: 'demo-01',
    board: diagram({ e4: 'p', d3: 'P', a1: 'K', h8: 'k' }),
    answer: 'yes',
    focus: 'e4',
    verify: 'hanging e4',
    ...overrides,
  };
}

/** Rook vs. queen options: a "higher-value" choice exercise (queen is worth more). */
function validChoiceHigherValueExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'choice',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    options: [
      { id: 'rook', piece: 'R' },
      { id: 'queen', piece: 'Q' },
    ],
    answer: 'queen',
    verify: 'higher-value',
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

/** Kingless 2-pawns-each `versus` mini-game vs. Mouse: not already over, kid to move, white. */
function validVersusMiniGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'vg1',
    concept: 'c1',
    unlockAfter: 'demo-lesson',
    mode: 'versus',
    title: 'vg1.title',
    goal: 'vg1.goal',
    board: diagram({ a2: 'P', h2: 'P', a7: 'p', h7: 'p' }),
    rules: {
      kings: false,
      noMoves: 'lose',
      win: { kid: ['promote', 'capture-all'], opponent: ['promote', 'capture-all'] },
    },
    opponent: { bot: 1 },
    par: 6,
    ...overrides,
  };
}

function writeVersusMiniGame(overrides: Record<string, unknown> = {}): void {
  write('minigames/vg1.yaml', stringify(validVersusMiniGame(overrides)));
}

function writeDefaultLocales(): void {
  write(
    'locales/en/lessons.yaml',
    stringify({
      'demo-lesson': { title: 'Title', story: 'Story' },
      'demo-demo': 'Demo',
      'demo-01': 'Exercise',
      'choice-opt-a': 'Option A',
      mg1: { title: 'Title', goal: 'Goal' },
      vg1: { title: 'VTitle', goal: 'VGoal' },
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

  it('reports multiple issues across files together', () => {
    writeLesson({ boss: 'no-such-minigame', exercises: [validExercise({ text: 'missing-key' })] });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((issue) => issue.includes('unknown mini-game'))).toBe(true);
    expect(issues.some((issue) => issue.includes('missing text key'))).toBe(true);
  });

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

  describe('choice', () => {
    it('loads a valid choice exercise with no issues', () => {
      writeLesson({ exercises: [validChoiceExercise()] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('rejects fewer than 2 options', () => {
      writeLesson({ exercises: [validChoiceExercise({ options: [{ id: 'rook', piece: 'R' }] })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('exercises.0.options'))).toBe(true);
    });

    it('reports duplicate option ids', () => {
      writeLesson({
        exercises: [
          validChoiceExercise({
            options: [
              { id: 'rook', piece: 'R' },
              { id: 'rook', piece: 'P' },
            ],
          }),
        ],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('duplicate option id "rook"'))).toBe(true);
    });

    it('reports an answer that is not among its options', () => {
      writeLesson({ exercises: [validChoiceExercise({ answer: 'no-such-option' })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) => issue.includes('"answer" must reference one of "options"')),
      ).toBe(true);
    });

    it('reports an option with neither text nor piece', () => {
      writeLesson({
        exercises: [validChoiceExercise({ options: [{ id: 'rook' }, { id: 'pawn', piece: 'P' }] })],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('option needs "text" or "piece"'))).toBe(true);
    });

    it('loads a valid choice exercise with a text option', () => {
      writeLesson({
        exercises: [
          validChoiceExercise({
            options: [
              { id: 'rook', text: 'choice-opt-a' },
              { id: 'pawn', piece: 'P' },
            ],
          }),
        ],
      });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it("reports a missing text key for an option's text", () => {
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
        issues.some((issue) => issue.includes('missing text key "lessons:no-such-option-key"')),
      ).toBe(true);
    });
  });

  describe('best-move', () => {
    it('loads a valid best-move exercise with no issues', () => {
      writeLesson({ exercises: [validBestMoveExercise()] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('rejects an empty solutions list', () => {
      writeLesson({ exercises: [validBestMoveExercise({ solutions: [] })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('exercises.0.solutions'))).toBe(true);
    });

    it('reports a solution that is not a legal move in the position', () => {
      writeLesson({ exercises: [validBestMoveExercise({ solutions: ['Qh5'] })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) =>
          issue.includes('solution "Qh5" is not a legal move in the position'),
        ),
      ).toBe(true);
    });
  });

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
  });

  describe('choice: verify higher-value', () => {
    it('loads a valid higher-value verify with no issues', () => {
      writeLesson({ exercises: [validChoiceHigherValueExercise()] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('rejects an answer that is not the higher-value option', () => {
      writeLesson({ exercises: [validChoiceHigherValueExercise({ answer: 'rook' })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('answer should be "queen"'))).toBe(true);
    });

    it('rejects a text-only option (no piece to value)', () => {
      writeLesson({
        exercises: [
          validChoiceHigherValueExercise({
            options: [
              { id: 'rook', piece: 'R' },
              { id: 'other', text: 'demo-01' },
            ],
            answer: 'rook',
          }),
        ],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('requires every option to be a piece'))).toBe(
        true,
      );
    });

    it('rejects a tie for the highest value', () => {
      writeLesson({
        exercises: [
          validChoiceHigherValueExercise({
            options: [
              { id: 'bishop', piece: 'B' },
              { id: 'knight', piece: 'N' },
            ],
            answer: 'bishop',
          }),
        ],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('requires a unique highest-value option'))).toBe(
        true,
      );
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

  describe('versus mini-game', () => {
    function compiledVersusGame() {
      writeLesson();
      writeVersusMiniGame();
      writeDefaultLocales();
      const locales = loadLocales(join(dir, 'locales'));
      const content = loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
      const game = content.minigames.find((entry) => entry.id === 'vg1');
      if (game === undefined || game.mode !== 'versus') {
        throw new Error('expected a compiled versus mini-game');
      }
      return game;
    }

    it('loads with no issues and compiles win conditions by kid colour (default white)', () => {
      const game = compiledVersusGame();
      expect(game.kidColor).toBe('w');
      expect(game.opponentLevel).toBe(1);
      expect(game.par).toBe(6);
      expect(game.rules).toEqual({
        kings: false,
        checkRules: false,
        noMoves: 'lose',
        win: {
          w: [{ kind: 'promote' }, { kind: 'capture-all' }],
          b: [{ kind: 'promote' }, { kind: 'capture-all' }],
        },
      });
    });

    it('maps "kid"/"opponent" win lists to the opposite w/b sides when kidColor is black', () => {
      writeLesson();
      writeVersusMiniGame({
        kidColor: 'b',
        board: diagram({ a2: 'P', h2: 'P', a7: 'p', h7: 'p' }),
        rules: {
          kings: false,
          noMoves: 'lose',
          win: { kid: ['capture-all'], opponent: ['promote'] },
        },
      });
      writeDefaultLocales();
      const issues = issuesOf();
      expect(issues).toEqual([]);

      const locales = loadLocales(join(dir, 'locales'));
      const content = loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
      const game = content.minigames.find((entry) => entry.id === 'vg1');
      if (game === undefined || game.mode !== 'versus') {
        throw new Error('expected a compiled versus mini-game');
      }
      expect(game.rules.win.b).toEqual([{ kind: 'capture-all' }]);
      expect(game.rules.win.w).toEqual([{ kind: 'promote' }]);
    });

    it('rejects a bot level out of 1-5', () => {
      writeLesson();
      writeVersusMiniGame({ opponent: { bot: 6 } });
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.length).toBeGreaterThan(0);
    });

    it('reports a start position missing a king when rules.kings is true', () => {
      writeLesson();
      writeVersusMiniGame({
        board: diagram({ a2: 'P', h2: 'P', a7: 'p', h7: 'p' }),
        rules: {
          kings: true,
          noMoves: 'draw',
          win: { kid: ['checkmate'], opponent: ['checkmate'] },
        },
      });
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) =>
          issue.includes('rules.kings is true but the start position is missing a king'),
        ),
      ).toBe(true);
    });

    it('reports a king on the board when rules.kings is false', () => {
      writeLesson();
      writeVersusMiniGame({ board: diagram({ a2: 'P', h2: 'P', a7: 'p', h7: 'p', e1: 'K' }) });
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) =>
          issue.includes('rules.kings is false but the start position has a king'),
        ),
      ).toBe(true);
    });

    it('reports a game already over at its start position (no opponent piece: instant capture-all win)', () => {
      writeLesson();
      writeVersusMiniGame({ board: diagram({ a2: 'P' }) });
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) => issue.includes('the game is already over at its start position')),
      ).toBe(true);
    });
  });
});
