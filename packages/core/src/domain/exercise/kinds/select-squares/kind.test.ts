import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../../chess/chessjs-rules.ts';
import { parseDiagram } from '../../../chess/diagram.ts';
import { createVariantRules } from '../../../variant/rules.ts';
import {
  requestHint,
  starsFor,
  startExercise,
  submitSelection,
  toggleSquare,
} from '../../engine.ts';
import type { SelectSquaresDef } from '../../types.ts';

const rules = createVariantRules(chessJsRules);

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

    expect(result).toEqual({ correct: true, missing: 0, missingSquares: [], wrong: [] });
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
    expect(result.missingSquares).toHaveLength(13);
    expect(result.missingSquares).not.toContain('d5');
    expect(result.missingSquares).toContain('d8');
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

    expect(result).toEqual({ correct: true, missing: 0, missingSquares: [], wrong: [] });
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

    expect(result).toEqual({ correct: true, missing: 0, missingSquares: [], wrong: [] });
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
