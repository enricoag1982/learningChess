import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseDiagram } from '../chess/diagram.ts';
import { createVariantRules } from '../variant/rules.ts';
import {
  exerciseMoves,
  playMove,
  requestHint,
  starsFor,
  startExercise,
  submitSelection,
  toggleSquare,
  undo,
} from './engine.ts';
import type { CaptureDef, CollectStarsDef, SelectSquaresDef } from './types.ts';

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
    expect(hint1.hint).toEqual({ level: 1, squares: ['a1'] });

    const hint2 = requestHint(state, rules);
    state = hint2.state;
    expect(hint2.hint).toEqual({ level: 2, squares: ['a8'] });

    const hint3 = requestHint(state, rules);
    state = hint3.state;
    expect(hint3.hint).toEqual({ level: 3, move: { from: 'a1', to: 'a8' }, squares: ['a1', 'a8'] });

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
    expect(hint).toEqual({ level: 1, squares: [] });
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
});
