import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseDiagram } from '../chess/diagram.ts';
import type { Position } from '../chess/types.ts';
import { createVariantRules } from '../variant/rules.ts';
import {
  answerChoice,
  answerYesNo,
  exerciseMoves,
  placePiece,
  playMateInN,
  playMove,
  requestHint,
  setupPalette,
  starsFor,
  startExercise,
  submitSelection,
  toggleSquare,
  undo,
} from './engine.ts';
import type {
  BestMoveDef,
  CaptureDef,
  ChoiceDef,
  CollectStarsDef,
  MateInNDef,
  SelectSquaresDef,
  SetupDef,
  YesNoDef,
} from './types.ts';

const rules = createVariantRules(chessJsRules);

describe('collect-stars', () => {
  const position = parseDiagram(
    [
      '* . . . . . . *',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      'R . . . . . . .',
    ].join('\n'),
  );
  const def: CollectStarsDef = {
    id: 'ex1',
    concept: 'rook-move',
    textKey: 'ex1.text',
    type: 'collect-stars',
    position,
    stars3: 2,
    stars2: 4,
  };

  it('solves optimally in 2 moves for 3 stars', () => {
    let state = startExercise(def);
    const first = playMove(state, rules, { from: 'a1', to: 'a8' });
    state = first.state;
    expect(first.outcome).toMatchObject({ kind: 'moved', collected: ['a8'] });

    const second = playMove(state, rules, { from: 'a8', to: 'h8' });
    state = second.state;
    expect(second.outcome).toMatchObject({ kind: 'solved', collected: ['h8'] });

    expect(state.solved).toBe(true);
    expect(state.moves).toBe(2);
    expect(starsFor(state)).toBe(3);
  });

  it('gives 2 stars for a 4-move (sub-optimal) solve', () => {
    let state = startExercise(def);
    state = playMove(state, rules, { from: 'a1', to: 'a2' }).state; // wasted move
    state = playMove(state, rules, { from: 'a2', to: 'a8' }).state; // collects a8
    state = playMove(state, rules, { from: 'a8', to: 'b8' }).state; // wasted move
    const last = playMove(state, rules, { from: 'b8', to: 'h8' }); // collects h8
    state = last.state;

    expect(state.solved).toBe(true);
    expect(state.moves).toBe(4);
    expect(starsFor(state)).toBe(2);
  });

  it('restores the star and move count on undo', () => {
    let state = startExercise(def);
    state = playMove(state, rules, { from: 'a1', to: 'a8' }).state;
    expect(state.moves).toBe(1);
    expect(state.position.markers.stars).not.toContain('a8');

    state = undo(state);

    expect(state.moves).toBe(0);
    expect(state.position.markers.stars).toContain('a8');
    expect(state.position).toEqual(position);
  });

  it('is a no-op when there is nothing to undo', () => {
    const state = startExercise(def);
    expect(undo(state)).toEqual(state);
  });

  it('counts an illegal attempt as an error without touching stars or moves', () => {
    let state = startExercise(def);
    const result = playMove(state, rules, { from: 'a1', to: 'b2' }); // rook cannot move diagonally

    expect(result.outcome).toEqual({ kind: 'illegal' });
    state = result.state;
    expect(state.errors).toBe(1);
    expect(state.moves).toBe(0);
    expect(state.position.markers.stars).toEqual(['a8', 'h8']);
  });

  it('walks the hint ladder from piece to target to move', () => {
    let state = startExercise(def);

    const hint1 = requestHint(state, rules);
    state = hint1.state;
    expect(hint1.hint).toEqual({ kind: 'squares', level: 1, squares: ['a1'] });

    const hint2 = requestHint(state, rules);
    state = hint2.state;
    expect(hint2.hint).toEqual({ kind: 'squares', level: 2, squares: ['a8'] });

    const hint3 = requestHint(state, rules);
    state = hint3.state;
    expect(hint3.hint).toEqual({
      kind: 'squares',
      level: 3,
      move: { from: 'a1', to: 'a8' },
      squares: ['a1', 'a8'],
    });

    expect(state.hintLevel).toBe(3);
    // A further request stays capped at level 3.
    expect(requestHint(state, rules).state.hintLevel).toBe(3);
  });

  it('caps stars at 1 after a level-3 hint even with an optimal solve', () => {
    let state = startExercise(def);
    state = requestHint(state, rules).state;
    state = requestHint(state, rules).state;
    state = requestHint(state, rules).state;
    expect(state.hintLevel).toBe(3);

    state = playMove(state, rules, { from: 'a1', to: 'a8' }).state;
    state = playMove(state, rules, { from: 'a8', to: 'h8' }).state;

    expect(state.moves).toBe(2);
    expect(starsFor(state)).toBe(1);
  });

  it('caps stars at 2 after a level-1 hint even with an optimal solve', () => {
    let state = startExercise(def);
    state = requestHint(state, rules).state;
    expect(state.hintLevel).toBe(1);

    state = playMove(state, rules, { from: 'a1', to: 'a8' }).state;
    state = playMove(state, rules, { from: 'a8', to: 'h8' }).state;

    expect(starsFor(state)).toBe(2);
  });

  it('exposes legal kid moves and none once solved', () => {
    let state = startExercise(def);
    expect(exerciseMoves(state, rules, 'a1')).toHaveLength(14);

    state = playMove(state, rules, { from: 'a1', to: 'a8' }).state;
    state = playMove(state, rules, { from: 'a8', to: 'h8' }).state;
    expect(exerciseMoves(state, rules)).toEqual([]);
  });
});

describe('capture', () => {
  const position = parseDiagram(
    [
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . p . . . .',
      '. . . p . . . .',
      '. . . R . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
    ].join('\n'),
  );
  const def: CaptureDef = {
    id: 'ex2',
    concept: 'rook-move',
    textKey: 'ex2.text',
    type: 'capture',
    position,
    stars3: 2,
    stars2: 3,
  };

  it('is solved once every opponent piece is captured', () => {
    let state = startExercise(def);
    expect(state.solved).toBe(false);

    const first = playMove(state, rules, { from: 'd3', to: 'd4' });
    state = first.state;
    expect(first.outcome).toMatchObject({ kind: 'moved', captured: 'p' });
    expect(state.solved).toBe(false);

    const second = playMove(state, rules, { from: 'd4', to: 'd5' });
    state = second.state;
    expect(second.outcome).toMatchObject({ kind: 'solved', captured: 'p' });
    expect(state.solved).toBe(true);
  });

  it('grades stars by move count', () => {
    let solvedIn2 = startExercise(def);
    solvedIn2 = playMove(solvedIn2, rules, { from: 'd3', to: 'd4' }).state;
    solvedIn2 = playMove(solvedIn2, rules, { from: 'd4', to: 'd5' }).state;
    expect(starsFor(solvedIn2)).toBe(3);

    // Same captures, reached by going around instead of straight up the d-file: 4 moves.
    let solvedLate = startExercise(def);
    solvedLate = playMove(solvedLate, rules, { from: 'd3', to: 'a3' }).state; // wasted move
    solvedLate = playMove(solvedLate, rules, { from: 'a3', to: 'a5' }).state; // wasted move
    solvedLate = playMove(solvedLate, rules, { from: 'a5', to: 'd5' }).state; // captures d5
    solvedLate = playMove(solvedLate, rules, { from: 'd5', to: 'd4' }).state; // captures d4
    expect(solvedLate.moves).toBe(4);
    expect(starsFor(solvedLate)).toBe(1);
  });
});

describe('select-squares', () => {
  it('derives 14 legal-move squares for a rook on d4', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . R . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex3',
      concept: 'rook-move',
      textKey: 'ex3.text',
      type: 'select-squares',
      position,
      answer: { derive: 'legal-moves', from: 'd4' },
    };

    let state = startExercise(def);
    for (const square of [
      'd5',
      'd6',
      'd7',
      'd8',
      'd3',
      'd2',
      'd1',
      'a4',
      'b4',
      'c4',
      'e4',
      'f4',
      'g4',
      'h4',
    ] as const) {
      state = toggleSquare(state, square);
    }
    const { result, state: submitted } = submitSelection(state, rules);

    expect(result).toEqual({ correct: true, missing: 0, wrong: [] });
    expect(submitted.solved).toBe(true);
  });

  it('excludes squares beyond a wall', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . x . . . .',
        '. . . . . . . .',
        '. . . R . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex4',
      concept: 'rook-move',
      textKey: 'ex4.text',
      type: 'select-squares',
      position,
      answer: { derive: 'legal-moves', from: 'd4' },
    };

    const state = startExercise(def);
    const { result } = submitSelection(toggleSquare(state, 'd5'), rules);

    expect(result.missing).toBe(10); // 11 legal squares total, 1 selected
    expect(result.wrong).toEqual([]);
  });

  it('reports wrong squares and missing count on a bad submission', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . R . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex5',
      concept: 'rook-move',
      textKey: 'ex5.text',
      type: 'select-squares',
      position,
      answer: { derive: 'legal-moves', from: 'd4' },
    };

    let state = startExercise(def);
    state = toggleSquare(state, 'd5');
    state = toggleSquare(state, 'e5'); // not a legal rook move

    const { state: submitted, result } = submitSelection(state, rules);

    expect(result.correct).toBe(false);
    expect(result.wrong).toEqual(['e5']);
    expect(result.missing).toBe(13);
    expect(submitted.errors).toBe(1);
    expect(submitted.solved).toBe(false);
  });

  it('gives no from-square hint for an explicit answer', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . R . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex6',
      concept: 'rook-move',
      textKey: 'ex6.text',
      type: 'select-squares',
      position,
      answer: { squares: ['d5', 'd6'] },
    };

    const state = startExercise(def);
    const { hint } = requestHint(state, rules);
    expect(hint).toEqual({ kind: 'squares', level: 1, squares: [] });
  });

  it('grades stars: 3 clean, 2 with one hint/error, 1 otherwise', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . R . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex7',
      concept: 'rook-move',
      textKey: 'ex7.text',
      type: 'select-squares',
      position,
      answer: { squares: ['d5'] },
    };

    const clean = submitSelection(toggleSquare(startExercise(def), 'd5'), rules).state;
    expect(starsFor(clean)).toBe(3);

    let oneHint = startExercise(def);
    oneHint = requestHint(oneHint, rules).state;
    oneHint = submitSelection(toggleSquare(oneHint, 'd5'), rules).state;
    expect(starsFor(oneHint)).toBe(2);

    let twoErrors = startExercise(def);
    twoErrors = submitSelection(toggleSquare(twoErrors, 'e5'), rules).state; // wrong, error 1
    twoErrors = toggleSquare(twoErrors, 'e5'); // undo the wrong pick
    twoErrors = submitSelection(toggleSquare(twoErrors, 'f5'), rules).state; // wrong again, error 2
    twoErrors = toggleSquare(twoErrors, 'f5');
    twoErrors = submitSelection(toggleSquare(twoErrors, 'd5'), rules).state; // now correct
    expect(twoErrors.errors).toBe(2);
    expect(starsFor(twoErrors)).toBe(1);
  });

  it('derives attacked-by squares: a pawn attacks diagonally only, own or enemy piece included', () => {
    const position = parseDiagram(
      [
        '. . . . . . k .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . P . p . .',
        '. . . . P . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . K . . .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex-attacked-by',
      concept: 'attack',
      textKey: 'ex-attacked-by.text',
      type: 'select-squares',
      position,
      answer: { derive: 'attacked-by', from: 'e4' },
    };

    let state = startExercise(def);
    state = toggleSquare(state, 'd5');
    state = toggleSquare(state, 'f5');
    const { result, state: submitted } = submitSelection(state, rules);

    expect(result).toEqual({ correct: true, missing: 0, wrong: [] });
    expect(submitted.solved).toBe(true);
  });

  it('attacked-by never includes the forward (non-capturing) square', () => {
    const position = parseDiagram(
      [
        '. . . . . . k .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . P . p . .',
        '. . . . P . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . K . . .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex-attacked-by-2',
      concept: 'attack',
      textKey: 'ex-attacked-by-2.text',
      type: 'select-squares',
      position,
      answer: { derive: 'attacked-by', from: 'e4' },
    };

    const state = startExercise(def);
    const { result } = submitSelection(toggleSquare(toggleSquare(state, 'd5'), 'e5'), rules);

    expect(result.wrong).toEqual(['e5']);
  });

  it('derives check-escapes: every square the checked king can legally move to', () => {
    const position = parseDiagram(
      [
        'k . . . . . r .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . P . P',
        '. . . . . . K .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex-check-escapes',
      concept: 'check-escape',
      textKey: 'ex-check-escapes.text',
      type: 'select-squares',
      position,
      answer: { derive: 'check-escapes' },
    };

    let state = startExercise(def);
    state = toggleSquare(state, 'f1');
    state = toggleSquare(state, 'h1');
    const { result, state: submitted } = submitSelection(state, rules);

    expect(result).toEqual({ correct: true, missing: 0, wrong: [] });
    expect(submitted.solved).toBe(true);
  });

  it('check-escapes hint level 1 highlights the checked king, not a from-square', () => {
    const position = parseDiagram(
      [
        'k . . . . . r .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . P . P',
        '. . . . . . K .',
      ].join('\n'),
    );
    const def: SelectSquaresDef = {
      id: 'ex-check-escapes-hint',
      concept: 'check-escape',
      textKey: 'ex-check-escapes-hint.text',
      type: 'select-squares',
      position,
      answer: { derive: 'check-escapes' },
    };

    const { hint } = requestHint(startExercise(def), rules);
    expect(hint).toEqual({ kind: 'squares', level: 1, squares: ['g1'] });
  });
});

describe('mate-in-n', () => {
  // Black king h8 alone; two white rooks (b1, d1) can each independently deliver back-rank mate
  // once Ra7 has cut off the 7th rank — Rb8# and Rd8# are both legal mating moves.
  const mateIn1Position = parseDiagram(
    [
      '. . . . . . . k',
      'R . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . K .',
      '. R . R . . . .',
    ].join('\n'),
  );
  const mateIn1: MateInNDef = {
    id: 'mate1',
    concept: 'mate-in-1',
    textKey: 'mate1.text',
    type: 'mate-in-n',
    position: mateIn1Position,
    n: 1,
    line: ['Rb8#'],
  };

  it('a mating move solves it even when it is not the scripted one', () => {
    const state = startExercise(mateIn1);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'd1', to: 'd8' });

    expect(outcome).toMatchObject({ kind: 'solved' });
    expect(next.solved).toBe(true);
    expect(starsFor(next)).toBe(3);
  });

  it('a legal but non-mating, non-scripted move counts an error and leaves the position unchanged', () => {
    const state = startExercise(mateIn1);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'b1', to: 'b2' });

    expect(outcome).toMatchObject({ kind: 'wrong' });
    expect(next.errors).toBe(1);
    expect(next.solved).toBe(false);
    expect(next.position).toEqual(mateIn1Position);
  });

  it('an illegal move counts an error without touching the position', () => {
    const state = startExercise(mateIn1);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'g2', to: 'g5' });

    expect(outcome).toEqual({ kind: 'illegal' });
    expect(next.errors).toBe(1);
  });

  it('is a no-op once solved', () => {
    let state = startExercise(mateIn1);
    state = playMateInN(state, chessJsRules, { from: 'b1', to: 'b8' }).state;
    expect(state.solved).toBe(true);

    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'g2', to: 'g3' });
    expect(outcome).toEqual({ kind: 'illegal' });
    expect(next).toBe(state);
  });

  it('playMove refuses a mate-in-n exercise', () => {
    const state = startExercise(mateIn1);
    expect(() => playMove(state, rules, { from: 'b1', to: 'b8' })).toThrow();
  });

  // Fool's-mate-shaped mate-in-2 (kid = White): 1.Ne7+ Kh8 2.Qa8# — Kf8 is also legal but the
  // line scripts Kh8.
  const mateIn2Position = parseDiagram(
    [
      '. . . . . . k .',
      '. . . . . p p p',
      '. . N . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      'Q K . . . . . .',
    ].join('\n'),
  );
  const mateIn2: MateInNDef = {
    id: 'mate2',
    concept: 'mate-in-2',
    textKey: 'mate2.text',
    type: 'mate-in-n',
    position: mateIn2Position,
    n: 2,
    line: ['Ne7+', 'Kh8', 'Qa8#'],
  };

  it('the scripted kid move applies the scripted opponent reply too', () => {
    const state = startExercise(mateIn2);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'c6', to: 'e7' });

    expect(outcome).toMatchObject({
      kind: 'moved',
      move: { from: 'c6', to: 'e7' },
      reply: { from: 'g8', to: 'h8' },
    });
    expect(next.solved).toBe(false);
    expect(next.position.pieces.h8).toEqual({ color: 'b', type: 'k' });
    expect(next.position.toMove).toBe('w');
  });

  it('finishes with the final kid move after the scripted reply', () => {
    let state = startExercise(mateIn2);
    state = playMateInN(state, chessJsRules, { from: 'c6', to: 'e7' }).state;
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'a1', to: 'a8' });

    expect(outcome).toMatchObject({ kind: 'solved' });
    expect(next.solved).toBe(true);
  });

  it('a move that neither mates nor matches the scripted line is wrong', () => {
    const state = startExercise(mateIn2);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'b1', to: 'b2' });

    expect(outcome).toMatchObject({ kind: 'wrong' });
    expect(next.errors).toBe(1);
    expect(next.position).toEqual(mateIn2Position);
  });

  it('hint ladder: piece, then target square, then the scripted move', () => {
    const state = startExercise(mateIn2);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toEqual({ kind: 'squares', level: 1, squares: ['c6'] });

    const hint2 = requestHint(hint1.state, rules);
    expect(hint2.hint).toEqual({ kind: 'squares', level: 2, squares: ['e7'] });

    const hint3 = requestHint(hint2.state, rules);
    expect(hint3.hint).toEqual({
      kind: 'squares',
      level: 3,
      squares: ['c6', 'e7'],
      move: { from: 'c6', to: 'e7' },
    });
  });

  it('hints the second kid move once the first ply has been played', () => {
    let state = startExercise(mateIn2);
    state = playMateInN(state, chessJsRules, { from: 'c6', to: 'e7' }).state;

    const { hint } = requestHint(state, rules);
    expect(hint).toEqual({ kind: 'squares', level: 1, squares: ['a1'] });
  });

  it('grades stars like best-move: 3 clean, capped by errors/hints', () => {
    let clean = startExercise(mateIn1);
    clean = playMateInN(clean, chessJsRules, { from: 'b1', to: 'b8' }).state;
    expect(starsFor(clean)).toBe(3);

    let oneError = startExercise(mateIn1);
    oneError = playMateInN(oneError, chessJsRules, { from: 'b1', to: 'b2' }).state; // wrong
    oneError = playMateInN(oneError, chessJsRules, { from: 'b1', to: 'b8' }).state; // mates
    expect(oneError.errors).toBe(1);
    expect(starsFor(oneError)).toBe(2);
  });
});

describe('yes-no', () => {
  const position = parseDiagram(
    [
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . p . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
    ].join('\n'),
  );
  const def: YesNoDef = {
    id: 'yn1',
    concept: 'hanging-piece',
    textKey: 'yn1.text',
    type: 'yes-no',
    position,
    answer: true,
    focus: 'e4',
  };

  it('solves on the correct answer', () => {
    const state = answerYesNo(startExercise(def), true);
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(3);
  });

  it('a wrong answer counts an error and can be retried', () => {
    let state = answerYesNo(startExercise(def), false);
    expect(state.errors).toBe(1);
    expect(state.solved).toBe(false);

    state = answerYesNo(state, true);
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(2);
  });

  it('is a no-op once solved', () => {
    const solved = answerYesNo(startExercise(def), true);
    expect(answerYesNo(solved, false)).toEqual(solved);
  });

  it('hint ladder: focus square, then a nudge, then reveal', () => {
    let state = startExercise(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toEqual({ kind: 'yes-no', level: 1, squares: ['e4'], reveal: false });
    state = hint1.state;

    const hint2 = requestHint(state, rules);
    expect(hint2.hint).toEqual({ kind: 'yes-no', level: 2, squares: [], reveal: false });
    state = hint2.state;

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({ kind: 'yes-no', level: 3, squares: ['e4'], reveal: true });
  });

  it('has no focus squares to highlight when the exercise sets none', () => {
    const noFocus: YesNoDef = { ...def, focus: undefined };
    const hint = requestHint(startExercise(noFocus), rules).hint;
    expect(hint).toEqual({ kind: 'yes-no', level: 1, squares: [], reveal: false });
  });
});

describe('choice', () => {
  const position = parseDiagram(
    [
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
    ].join('\n'),
  );
  const def: ChoiceDef = {
    id: 'ch1',
    concept: 'exchange',
    textKey: 'ch1.text',
    type: 'choice',
    position,
    showBoard: false,
    options: [
      { id: 'queen', textKey: 'ch1.queen' },
      { id: 'rook', textKey: 'ch1.rook' },
      { id: 'bishop', textKey: 'ch1.bishop' },
    ],
    answer: 'queen',
  };

  it('solves on the correct option', () => {
    const state = answerChoice(startExercise(def), 'queen');
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(3);
  });

  it('a wrong pick counts an error and disables that option', () => {
    let state = answerChoice(startExercise(def), 'rook');
    expect(state.errors).toBe(1);
    expect(state.wrongOptions).toEqual(['rook']);
    expect(state.solved).toBe(false);

    state = answerChoice(state, 'queen');
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(2);
  });

  it('picking the same wrong option twice only disables it once', () => {
    let state = answerChoice(startExercise(def), 'rook');
    state = answerChoice(state, 'rook');
    expect(state.errors).toBe(2);
    expect(state.wrongOptions).toEqual(['rook']);
  });

  it('is a no-op once solved', () => {
    const solved = answerChoice(startExercise(def), 'queen');
    expect(answerChoice(solved, 'rook')).toEqual(solved);
  });

  it('hint ladder removes one wrong option per level, then reveals', () => {
    let state = startExercise(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toMatchObject({ kind: 'choice', level: 1, reveal: false });
    state = hint1.state;
    expect(state.wrongOptions).toHaveLength(1);
    expect(state.wrongOptions?.[0]).not.toBe('queen');

    const hint2 = requestHint(state, rules);
    state = hint2.state;
    expect(state.wrongOptions).toHaveLength(2);
    expect(state.wrongOptions).toEqual(expect.arrayContaining(['rook', 'bishop']));

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({ kind: 'choice', level: 3, reveal: true });
  });

  it('caps stars at 1 after a level-3 hint even with no errors', () => {
    let state = startExercise(def);
    state = requestHint(state, rules).state;
    state = requestHint(state, rules).state;
    state = requestHint(state, rules).state;
    state = answerChoice(state, 'queen');
    expect(starsFor(state)).toBe(1);
  });
});

describe('best-move', () => {
  const position = parseDiagram(
    [
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      'R . . . . . . .',
    ].join('\n'),
  );
  const def: BestMoveDef = {
    id: 'bm1',
    concept: 'rook-move',
    textKey: 'bm1.text',
    type: 'best-move',
    position,
    solutions: ['Ra8'],
  };

  it('solves with a listed solution move', () => {
    const result = playMove(startExercise(def), rules, { from: 'a1', to: 'a8' });
    expect(result.outcome).toMatchObject({ kind: 'solved' });
    expect(result.state.solved).toBe(true);
    expect(starsFor(result.state)).toBe(3);
  });

  it('a legal but wrong move counts an error and leaves the position unchanged', () => {
    let state = startExercise(def);
    const result = playMove(state, rules, { from: 'a1', to: 'h1' });
    expect(result.outcome).toMatchObject({ kind: 'wrong' });
    expect(result.outcome).toMatchObject({ move: { from: 'a1', to: 'h1' } });
    state = result.state;
    expect(state.errors).toBe(1);
    expect(state.solved).toBe(false);
    expect(state.position).toEqual(position);

    const solved = playMove(state, rules, { from: 'a1', to: 'a8' });
    expect(solved.outcome.kind).toBe('solved');
    expect(starsFor(solved.state)).toBe(2); // one earlier error caps the solve at 2 stars
  });

  it('an illegal move behaves as usual (not a "wrong" outcome)', () => {
    const result = playMove(startExercise(def), rules, { from: 'a1', to: 'b2' });
    expect(result.outcome).toEqual({ kind: 'illegal' });
    expect(result.state.errors).toBe(1);
  });

  it('matches a solution regardless of a trailing check/mate mark', () => {
    const checkDef: BestMoveDef = { ...def, solutions: ['Ra8+'] };
    const result = playMove(startExercise(checkDef), rules, { from: 'a1', to: 'a8' });
    expect(result.outcome.kind).toBe('solved');
  });

  it('hint ladder: piece, target square, then the move (from the first solution)', () => {
    let state = startExercise(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toEqual({ kind: 'squares', level: 1, squares: ['a1'] });
    state = hint1.state;

    const hint2 = requestHint(state, rules);
    expect(hint2.hint).toEqual({ kind: 'squares', level: 2, squares: ['a8'] });
    state = hint2.state;

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({
      kind: 'squares',
      level: 3,
      move: { from: 'a1', to: 'a8' },
      squares: ['a1', 'a8'],
    });
  });
});

describe('setup', () => {
  const emptyPosition: Position = {
    pieces: {},
    markers: { stars: [], blocked: [] },
    toMove: 'w',
    castling: '-',
    enPassant: null,
  };
  const target = parseDiagram(
    [
      '. . . . . . . r',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      'R . . . . . . .',
    ].join('\n'),
  );
  const def: SetupDef = {
    id: 'su1',
    concept: 'board-setup',
    textKey: 'su1.text',
    type: 'setup',
    position: emptyPosition,
    target,
  };

  it('lists remaining target pieces in board reading order, grouped with counts', () => {
    expect(setupPalette(startExercise(def))).toEqual([
      { color: 'b', type: 'r', count: 1 },
      { color: 'w', type: 'r', count: 1 },
    ]);
  });

  it('places a piece on its correct, free target square', () => {
    const result = placePiece(startExercise(def), 'h8', { color: 'b', type: 'r' });
    expect(result.outcome).toEqual({
      kind: 'placed',
      square: 'h8',
      piece: { color: 'b', type: 'r' },
    });
    expect(result.state.position.pieces.h8).toEqual({ color: 'b', type: 'r' });
    expect(result.state.solved).toBe(false);
  });

  it('is solved once every target piece is placed', () => {
    let state = startExercise(def);
    state = placePiece(state, 'h8', { color: 'b', type: 'r' }).state;
    const result = placePiece(state, 'a1', { color: 'w', type: 'r' });
    expect(result.outcome.kind).toBe('solved');
    expect(result.state.solved).toBe(true);
    expect(starsFor(result.state)).toBe(3);
  });

  it('a wrong piece for the square counts an error and places nothing', () => {
    const result = placePiece(startExercise(def), 'a1', { color: 'b', type: 'r' });
    expect(result.outcome).toEqual({
      kind: 'wrong',
      square: 'a1',
      piece: { color: 'b', type: 'r' },
    });
    expect(result.state.errors).toBe(1);
    expect(result.state.position.pieces.a1).toBeUndefined();
  });

  it('placing on an already-occupied square counts an error', () => {
    let state = startExercise(def);
    state = placePiece(state, 'h8', { color: 'b', type: 'r' }).state;
    const result = placePiece(state, 'h8', { color: 'b', type: 'r' });
    expect(result.outcome.kind).toBe('wrong');
    expect(result.state.errors).toBe(1);
  });

  it('hint ladder: next palette piece, then its square, then places it', () => {
    let state = startExercise(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toEqual({
      kind: 'setup',
      level: 1,
      piece: { color: 'b', type: 'r' },
      placed: false,
    });
    state = hint1.state;

    const hint2 = requestHint(state, rules);
    expect(hint2.hint).toEqual({
      kind: 'setup',
      level: 2,
      piece: { color: 'b', type: 'r' },
      square: 'h8',
      placed: false,
    });
    state = hint2.state;

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({
      kind: 'setup',
      level: 3,
      piece: { color: 'b', type: 'r' },
      square: 'h8',
      placed: true,
    });
    state = hint3.state;
    expect(state.position.pieces.h8).toEqual({ color: 'b', type: 'r' });
    expect(setupPalette(state)).toEqual([{ color: 'w', type: 'r', count: 1 }]);
  });

  it('grades stars: allows up to 2 errors for 2 stars (placing many pieces invites slips)', () => {
    let state = startExercise(def);
    state = placePiece(state, 'a1', { color: 'b', type: 'r' }).state; // wrong, error 1
    state = placePiece(state, 'h8', { color: 'w', type: 'r' }).state; // wrong, error 2
    state = placePiece(state, 'h8', { color: 'b', type: 'r' }).state; // correct
    state = placePiece(state, 'a1', { color: 'w', type: 'r' }).state; // correct, solved
    expect(state.errors).toBe(2);
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(2);
  });
});
