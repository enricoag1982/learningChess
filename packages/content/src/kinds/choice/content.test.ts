import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validChoiceExercise,
  validChoiceHigherValueExercise,
  validChoiceTradeExercise,
  validChoiceWorthExercise,
  validDrawKindExercise,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../../testing/fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

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
    expect(issues.some((issue) => issue.includes('"answer" must reference one of "options"'))).toBe(
      true,
    );
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
describe('choice: verify worth', () => {
  it('loads a valid "worth" verify with no issues', () => {
    writeLesson({ exercises: [validChoiceWorthExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects a text-only option (no piece to value)', () => {
    writeLesson({
      exercises: [
        validChoiceWorthExercise({
          options: [
            { id: 'rook', piece: 'R' },
            { id: 'other', text: 'demo-01' },
          ],
          answer: 'rook',
          verify: 'worth 5',
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

  it('rejects a value with no unique matching option', () => {
    writeLesson({
      exercises: [
        validChoiceWorthExercise({
          options: [
            { id: 'bishop', piece: 'B' },
            { id: 'knight', piece: 'N' },
          ],
          answer: 'bishop',
          verify: 'worth 3',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('requires exactly one option worth 3'))).toBe(
      true,
    );
  });

  it('rejects an answer that is not the matching-value option', () => {
    writeLesson({ exercises: [validChoiceWorthExercise({ answer: 'rook' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('answer should be "queen"'))).toBe(true);
  });
});
describe('choice: verify trade', () => {
  it('loads a valid "good" trade verify with no issues', () => {
    writeLesson({ exercises: [validChoiceTradeExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('loads a valid "equal" trade verify with no issues', () => {
    writeLesson({
      exercises: [
        validChoiceTradeExercise({
          board: diagram({ a1: 'R', h1: 'r', g2: 'b' }),
          answer: 'equal',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('loads a valid "bad" trade verify with no issues', () => {
    writeLesson({
      exercises: [
        validChoiceTradeExercise({
          board: diagram({ a1: 'R', h1: 'p', g2: 'b' }),
          answer: 'bad',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects options that are not exactly "good"/"equal"/"bad"', () => {
    writeLesson({
      exercises: [
        validChoiceTradeExercise({
          options: [
            { id: 'good', text: 'demo-01' },
            { id: 'meh', text: 'demo-01' },
          ],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('requires options ids "good", "equal", "bad"')),
    ).toBe(true);
  });

  it('rejects a move that is not a legal capture', () => {
    writeLesson({
      exercises: [validChoiceTradeExercise({ board: diagram({ a1: 'R' }) })],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('verify "trade Rxh1" is not a legal capture')),
    ).toBe(true);
  });

  it('reports a mismatch between the classification and the authored answer', () => {
    writeLesson({ exercises: [validChoiceTradeExercise({ answer: 'bad' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "trade Rxh1" classifies as "good"') &&
          issue.includes('answer is "bad"'),
      ),
    ).toBe(true);
  });
});
describe('choice: verify draw-kind', () => {
  it('loads a valid "stalemate" draw-kind verify with no issues', () => {
    writeLesson({ exercises: [validDrawKindExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('loads a valid "insufficient-material" draw-kind verify with no issues', () => {
    writeLesson({
      exercises: [
        validDrawKindExercise({
          board: diagram({ e1: 'K', e8: 'k' }),
          toMove: undefined,
          answer: 'insufficient-material',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('loads a valid "not-a-draw" draw-kind verify with no issues', () => {
    writeLesson({
      exercises: [
        validDrawKindExercise({
          board: diagram({ a1: 'R', h2: 'P', a8: 'k', h8: 'K' }),
          toMove: undefined,
          answer: 'not-a-draw',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects options that are not exactly "stalemate"/"insufficient-material"/"not-a-draw"', () => {
    writeLesson({
      exercises: [
        validDrawKindExercise({
          options: [
            { id: 'stalemate', text: 'demo-01' },
            { id: 'meh', text: 'demo-01' },
          ],
          answer: 'stalemate',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) =>
        issue.includes(
          'verify "draw-kind" requires options ids "stalemate", "insufficient-material", "not-a-draw"',
        ),
      ),
    ).toBe(true);
  });

  it('reports a mismatch between the classification and the authored answer', () => {
    writeLesson({ exercises: [validDrawKindExercise({ answer: 'not-a-draw' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "draw-kind" classifies as "stalemate"') &&
          issue.includes('answer is "not-a-draw"'),
      ),
    ).toBe(true);
  });
});
