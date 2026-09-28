import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../core/chess/chessjs-rules.ts';
import { parseDiagram } from '../../core/chess/diagram.ts';
import { createVariantRules } from '../../core/variant/rules.ts';
import { requestHint, starsFor } from '../index.ts';
import { initState } from '../../core/exercise/state.ts';
import type { ExerciseState, ExerciseStateOf } from '../../core/exercise/state.ts';
import { playMove } from '../static-move.ts';
import type { BestMoveDef } from '../../core/exercise/types.ts';

const rules = createVariantRules(chessJsRules);

/** `requestHint` dispatches generically; this test drives one exercise type throughout, so it
 * narrows the result back to call the type-specific helpers below. */
function narrow(state: ExerciseState): ExerciseStateOf<BestMoveDef> {
  return state as ExerciseStateOf<BestMoveDef>;
}

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
    const result = playMove(initState(def), rules, { from: 'a1', to: 'a8' });
    expect(result.outcome).toMatchObject({ kind: 'solved' });
    expect(result.state.solved).toBe(true);
    expect(starsFor(result.state)).toBe(3);
  });

  it('a legal but wrong move counts an error and leaves the position unchanged', () => {
    let state = initState(def);
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
    const result = playMove(initState(def), rules, { from: 'a1', to: 'b2' });
    expect(result.outcome).toEqual({ kind: 'illegal' });
    expect(result.state.errors).toBe(1);
  });

  it('matches a solution regardless of a trailing check/mate mark', () => {
    const checkDef: BestMoveDef = { ...def, solutions: ['Ra8+'] };
    const result = playMove(initState(checkDef), rules, { from: 'a1', to: 'a8' });
    expect(result.outcome.kind).toBe('solved');
  });

  it('hint ladder: piece, target square, then the move (from the first solution)', () => {
    let state = initState(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toEqual({ kind: 'squares', level: 1, squares: ['a1'] });
    state = narrow(hint1.state);

    const hint2 = requestHint(state, rules);
    expect(hint2.hint).toEqual({ kind: 'squares', level: 2, squares: ['a8'] });
    state = narrow(hint2.state);

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({
      kind: 'squares',
      level: 3,
      move: { from: 'a1', to: 'a8' },
      squares: ['a1', 'a8'],
    });
  });
});
