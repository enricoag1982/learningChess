import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../core/chess/chessjs-rules.ts';
import { parseDiagram } from '../../core/chess/diagram.ts';
import { createVariantRules } from '../../core/variant/rules.ts';
import { exerciseMoves, requestHint, starsFor } from '../index.ts';
import { initState } from '../../core/exercise/state.ts';
import type { ExerciseState, ExerciseStateOf } from '../../core/exercise/state.ts';
import { playMove, undo } from '../static-move.ts';
import type { CollectStarsDef } from '../../core/exercise/types.ts';
import { collectStarsKind } from './kind.ts';

const rules = createVariantRules(chessJsRules);

/** `requestHint` dispatches generically; this test drives one exercise type throughout, so it
 * narrows the result back to call the type-specific helpers below. */
function narrow(state: ExerciseState): ExerciseStateOf<CollectStarsDef> {
  return state as ExerciseStateOf<CollectStarsDef>;
}

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
    let state = initState(def);
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
    let state = initState(def);
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
    let state = initState(def);
    state = playMove(state, rules, { from: 'a1', to: 'a8' }).state;
    expect(state.moves).toBe(1);
    expect(state.position.markers.stars).not.toContain('a8');

    state = undo(state);

    expect(state.moves).toBe(0);
    expect(state.position.markers.stars).toContain('a8');
    expect(state.position).toEqual(position);
  });

  it('is a no-op when there is nothing to undo', () => {
    const state = initState(def);
    expect(undo(state)).toEqual(state);
  });

  it('kind.act(undo) matches the engine facade (C2: UndoAction outcome is "undone")', () => {
    const played = collectStarsKind.act(
      collectStarsKind.init(def),
      { type: 'move', move: { from: 'a1', to: 'a8' } },
      rules,
    );
    const undone = collectStarsKind.act(played.state, { type: 'undo' }, rules);
    expect(undone.outcome).toEqual({ kind: 'undone' });
    expect(undone.state).toEqual(undo(played.state));
  });

  it('counts an illegal attempt as an error without touching stars or moves', () => {
    let state = initState(def);
    const result = playMove(state, rules, { from: 'a1', to: 'b2' }); // rook cannot move diagonally

    expect(result.outcome).toEqual({ kind: 'illegal' });
    state = result.state;
    expect(state.errors).toBe(1);
    expect(state.moves).toBe(0);
    expect(state.position.markers.stars).toEqual(['a8', 'h8']);
  });

  it('walks the hint ladder from piece to target to move', () => {
    let state = initState(def);

    const hint1 = requestHint(state, rules);
    state = narrow(hint1.state);
    expect(hint1.hint).toEqual({ kind: 'squares', level: 1, squares: ['a1'] });

    const hint2 = requestHint(state, rules);
    state = narrow(hint2.state);
    expect(hint2.hint).toEqual({ kind: 'squares', level: 2, squares: ['a8'] });

    const hint3 = requestHint(state, rules);
    state = narrow(hint3.state);
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
    let state = initState(def);
    state = narrow(requestHint(state, rules).state);
    state = narrow(requestHint(state, rules).state);
    state = narrow(requestHint(state, rules).state);
    expect(state.hintLevel).toBe(3);

    state = playMove(state, rules, { from: 'a1', to: 'a8' }).state;
    state = playMove(state, rules, { from: 'a8', to: 'h8' }).state;

    expect(state.moves).toBe(2);
    expect(starsFor(state)).toBe(1);
  });

  it('caps stars at 2 after a level-1 hint even with an optimal solve', () => {
    let state = initState(def);
    state = narrow(requestHint(state, rules).state);
    expect(state.hintLevel).toBe(1);

    state = playMove(state, rules, { from: 'a1', to: 'a8' }).state;
    state = playMove(state, rules, { from: 'a8', to: 'h8' }).state;

    expect(starsFor(state)).toBe(2);
  });

  it('exposes legal kid moves and none once solved', () => {
    let state = initState(def);
    expect(exerciseMoves(state, rules, 'a1')).toHaveLength(14);

    state = playMove(state, rules, { from: 'a1', to: 'a8' }).state;
    state = playMove(state, rules, { from: 'a8', to: 'h8' }).state;
    expect(exerciseMoves(state, rules)).toEqual([]);
  });
});
