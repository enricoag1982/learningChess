import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  diagram,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validAttackVerifyExercise,
  validBestMoveExercise,
  validCastleVerifyExercise,
  validCheckVerifyExercise,
  validEnPassantVerifyExercise,
  validEscapeCheckVerifyExercise,
  validGoodTradeVerifyExercise,
  validSaveVerifyExercise,
  validTakeFreeVerifyExercise,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from '../../testing/fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

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
      issues.some((issue) => issue.includes('solution "Qh5" is not a legal move in the position')),
    ).toBe(true);
  });
});
describe('best-move: verify attack', () => {
  it('loads a valid "attack" verify with no issues', () => {
    writeLesson({ exercises: [validAttackVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects a target square that is not an enemy piece', () => {
    writeLesson({
      exercises: [validAttackVerifyExercise({ board: diagram({ g1: 'N' }) })],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('verify "attack e5" requires an enemy piece on e5')),
    ).toBe(true);
  });

  it('reports an empty computed set when no legal move attacks the target', () => {
    writeLesson({
      exercises: [
        validAttackVerifyExercise({
          board: diagram({ g1: 'N', a8: 'r' }),
          verify: 'attack a8',
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('verify "attack a8" computed no matching move')),
    ).toBe(true);
  });

  it('reports a mismatch between the computed set and the authored solutions', () => {
    writeLesson({ exercises: [validAttackVerifyExercise({ solutions: ['Nh3'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "attack e5"') &&
          issue.includes('solutions should be [Nf3]') &&
          issue.includes('authored [Nh3]'),
      ),
    ).toBe(true);
  });
});
describe('best-move: verify save', () => {
  it('loads a valid "save" verify with no issues', () => {
    writeLesson({ exercises: [validSaveVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it("rejects a target square that is not the kid's own piece", () => {
    writeLesson({
      exercises: [
        validSaveVerifyExercise({ board: diagram({ a1: 'n', h1: 'P' }), solutions: ['h2'] }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) =>
        issue.includes('verify "save a1" requires the kid\'s own piece on a1'),
      ),
    ).toBe(true);
  });

  it('rejects a piece that is already safe', () => {
    writeLesson({
      exercises: [validSaveVerifyExercise({ board: diagram({ a1: 'N', a8: 'r', b2: 'Q' }) })],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) =>
        issue.includes('verify "save a1" requires that piece to not be safe yet'),
      ),
    ).toBe(true);
  });

  it('reports a mismatch between the computed set and the authored solutions', () => {
    writeLesson({ exercises: [validSaveVerifyExercise({ solutions: ['Nb3'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "save a1"') &&
          issue.includes('solutions should be [Nb3, Nc2]') &&
          issue.includes('authored [Nb3]'),
      ),
    ).toBe(true);
  });
});
describe('best-move: verify take-free', () => {
  it('loads a valid "take-free" verify with no issues', () => {
    writeLesson({ exercises: [validTakeFreeVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports an empty computed set when every capture is defended', () => {
    writeLesson({
      exercises: [
        validTakeFreeVerifyExercise({
          board: diagram({ a1: 'R', h1: 'r', g2: 'b' }),
          solutions: ['Rxh1'],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('verify "take-free" computed no matching move')),
    ).toBe(true);
  });

  it('reports a mismatch between the computed set and the authored solutions', () => {
    writeLesson({ exercises: [validTakeFreeVerifyExercise({ solutions: ['Rxh1'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "take-free"') &&
          issue.includes('solutions should be [Rxa8]') &&
          issue.includes('authored [Rxh1]'),
      ),
    ).toBe(true);
  });
});
describe('best-move: verify good-trade', () => {
  it('loads a valid "good-trade" verify with no issues', () => {
    writeLesson({ exercises: [validGoodTradeVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports a mismatch between the computed set and the authored solutions', () => {
    writeLesson({ exercises: [validGoodTradeVerifyExercise({ solutions: ['Rxh1'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "good-trade"') &&
          issue.includes('solutions should be [Rxa8]') &&
          issue.includes('authored [Rxh1]'),
      ),
    ).toBe(true);
  });
});
describe('best-move: verify check', () => {
  it('loads a valid "check" verify with no issues', () => {
    writeLesson({ exercises: [validCheckVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports an empty computed set when no legal move gives check', () => {
    writeLesson({
      exercises: [validCheckVerifyExercise({ board: diagram({ a1: 'R' }), solutions: ['Ra8'] })],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('verify "check" computed no matching move'))).toBe(
      true,
    );
  });

  it('reports a mismatch between the computed set and the authored solutions', () => {
    writeLesson({ exercises: [validCheckVerifyExercise({ solutions: ['Ra7'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "check"') &&
          issue.includes('solutions should be [Ra7, Re1]') &&
          issue.includes('authored [Ra7]'),
      ),
    ).toBe(true);
  });
});
describe('best-move: verify escape-king', () => {
  it('loads a valid "escape-king" verify with no issues', () => {
    writeLesson({ exercises: [validEscapeCheckVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it("requires the kid's king to be in check", () => {
    writeLesson({
      exercises: [
        validEscapeCheckVerifyExercise({
          board: diagram({ e1: 'K', b4: 'R', d6: 'N', a8: 'k' }),
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes("requires the kid's king to be in check"))).toBe(
      true,
    );
  });

  it('reports a mismatch between the computed set and the authored solutions', () => {
    writeLesson({ exercises: [validEscapeCheckVerifyExercise({ solutions: ['Kd1'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "escape-king"') &&
          issue.includes('solutions should be [Kd1, Kd2, Kf1, Kf2]') &&
          issue.includes('authored [Kd1]'),
      ),
    ).toBe(true);
  });
});
describe('best-move: verify escape-block', () => {
  it('loads a valid "escape-block" verify with no issues', () => {
    writeLesson({
      exercises: [
        validEscapeCheckVerifyExercise({ verify: 'escape-block', solutions: ['Ne4', 'Re4'] }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports an empty computed set when no legal move blocks the check', () => {
    writeLesson({
      exercises: [
        validEscapeCheckVerifyExercise({
          board: diagram({ e1: 'K', e8: 'r', a8: 'k' }),
          verify: 'escape-block',
          solutions: ['Ke2'],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('verify "escape-block" computed no matching move')),
    ).toBe(true);
  });
});
describe('best-move: verify escape-capture', () => {
  it('loads a valid "escape-capture" verify with no issues', () => {
    writeLesson({
      exercises: [
        validEscapeCheckVerifyExercise({ verify: 'escape-capture', solutions: ['Nxe8'] }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports an empty computed set when no legal move captures the checker', () => {
    writeLesson({
      exercises: [
        validEscapeCheckVerifyExercise({
          board: diagram({ e1: 'K', e8: 'r', a8: 'k' }),
          verify: 'escape-capture',
          solutions: ['Ke2'],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('verify "escape-capture" computed no matching move')),
    ).toBe(true);
  });
});
describe('best-move: verify castle', () => {
  it('loads a valid "castle" verify (both directions legal) with no issues', () => {
    writeLesson({ exercises: [validCastleVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects a solutions set missing one of the legal castling moves', () => {
    writeLesson({ exercises: [validCastleVerifyExercise({ solutions: ['O-O'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "castle"') && issue.includes('solutions should be [O-O, O-O-O]'),
      ),
    ).toBe(true);
  });

  it('reports an empty computed set when neither castling move is legal', () => {
    writeLesson({
      exercises: [
        validCastleVerifyExercise({
          fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1',
          solutions: ['Ke2'],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('verify "castle" computed no matching move')),
    ).toBe(true);
  });
});
describe('best-move: verify en-passant', () => {
  it('loads a valid "en-passant" verify with no issues', () => {
    writeLesson({ exercises: [validEnPassantVerifyExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('rejects a solutions set that is not the legal en passant capture', () => {
    writeLesson({ exercises: [validEnPassantVerifyExercise({ solutions: ['Ke2'] })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('verify "en-passant"') && issue.includes('solutions should be [exd6]'),
      ),
    ).toBe(true);
  });

  it('reports an empty computed set when no en passant capture is legal', () => {
    writeLesson({
      exercises: [
        validEnPassantVerifyExercise({
          fen: '4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1',
          solutions: ['Ke2'],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('verify "en-passant" computed no matching move')),
    ).toBe(true);
  });
});
