import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../core/chess/chessjs-rules.ts';
import { parseDiagram } from '../../core/chess/diagram.ts';
import type { Position } from '../../core/chess/types.ts';
import { createVariantRules } from '../../core/variant/rules.ts';
import { requestHint, starsFor } from '../index.ts';
import { initState } from '../../core/exercise/state.ts';
import type { ExerciseState, ExerciseStateOf } from '../../core/exercise/state.ts';
import { placePiece, setupPalette } from './engine.ts';
import type { SetupDef } from '../../core/exercise/types.ts';

const rules = createVariantRules(chessJsRules);

/** `requestHint` dispatches generically; this test drives one exercise type throughout, so it
 * narrows the result back to call the type-specific helpers below. */
function narrow(state: ExerciseState): ExerciseStateOf<SetupDef> {
  return state as ExerciseStateOf<SetupDef>;
}

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
    expect(setupPalette(initState(def))).toEqual([
      { color: 'b', type: 'r', count: 1 },
      { color: 'w', type: 'r', count: 1 },
    ]);
  });

  it('places a piece on its correct, free target square', () => {
    const result = placePiece(initState(def), 'h8', { color: 'b', type: 'r' });
    expect(result.outcome).toEqual({
      kind: 'placed',
      square: 'h8',
      piece: { color: 'b', type: 'r' },
    });
    expect(result.state.position.pieces.h8).toEqual({ color: 'b', type: 'r' });
    expect(result.state.solved).toBe(false);
  });

  it('is solved once every target piece is placed', () => {
    let state = initState(def);
    state = placePiece(state, 'h8', { color: 'b', type: 'r' }).state;
    const result = placePiece(state, 'a1', { color: 'w', type: 'r' });
    expect(result.outcome.kind).toBe('solved');
    expect(result.state.solved).toBe(true);
    expect(starsFor(result.state)).toBe(3);
  });

  it('a wrong piece for the square counts an error and places nothing', () => {
    const result = placePiece(initState(def), 'a1', { color: 'b', type: 'r' });
    expect(result.outcome).toEqual({
      kind: 'wrong',
      square: 'a1',
      piece: { color: 'b', type: 'r' },
    });
    expect(result.state.errors).toBe(1);
    expect(result.state.position.pieces.a1).toBeUndefined();
  });

  it('placing on an already-occupied square counts an error', () => {
    let state = initState(def);
    state = placePiece(state, 'h8', { color: 'b', type: 'r' }).state;
    const result = placePiece(state, 'h8', { color: 'b', type: 'r' });
    expect(result.outcome.kind).toBe('wrong');
    expect(result.state.errors).toBe(1);
  });

  it('hint ladder: next palette piece, then its square, then places it', () => {
    let state = initState(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toEqual({
      kind: 'setup',
      level: 1,
      piece: { color: 'b', type: 'r' },
      placed: false,
    });
    state = narrow(hint1.state);

    const hint2 = requestHint(state, rules);
    expect(hint2.hint).toEqual({
      kind: 'setup',
      level: 2,
      piece: { color: 'b', type: 'r' },
      square: 'h8',
      placed: false,
    });
    state = narrow(hint2.state);

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({
      kind: 'setup',
      level: 3,
      piece: { color: 'b', type: 'r' },
      square: 'h8',
      placed: true,
    });
    state = narrow(hint3.state);
    expect(state.position.pieces.h8).toEqual({ color: 'b', type: 'r' });
    expect(setupPalette(state)).toEqual([{ color: 'w', type: 'r', count: 1 }]);
  });

  it('grades stars: allows up to 2 errors for 2 stars (placing many pieces invites slips)', () => {
    let state = initState(def);
    state = placePiece(state, 'a1', { color: 'b', type: 'r' }).state; // wrong, error 1
    state = placePiece(state, 'h8', { color: 'w', type: 'r' }).state; // wrong, error 2
    state = placePiece(state, 'h8', { color: 'b', type: 'r' }).state; // correct
    state = placePiece(state, 'a1', { color: 'w', type: 'r' }).state; // correct, solved
    expect(state.errors).toBe(2);
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(2);
  });
});
