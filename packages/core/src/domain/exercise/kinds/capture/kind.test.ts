import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../../chess/chessjs-rules.ts';
import { parseDiagram } from '../../../chess/diagram.ts';
import { createVariantRules } from '../../../variant/rules.ts';
import { starsFor } from '../index.ts';
import { initState } from '../../state.ts';
import { playMove, undo } from '../static-move.ts';
import type { CaptureDef } from '../../types.ts';
import { captureKind } from './kind.ts';

const rules = createVariantRules(chessJsRules);

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
    let state = initState(def);
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
    let solvedIn2 = initState(def);
    solvedIn2 = playMove(solvedIn2, rules, { from: 'd3', to: 'd4' }).state;
    solvedIn2 = playMove(solvedIn2, rules, { from: 'd4', to: 'd5' }).state;
    expect(starsFor(solvedIn2)).toBe(3);

    // Same captures, reached by going around instead of straight up the d-file: 4 moves.
    let solvedLate = initState(def);
    solvedLate = playMove(solvedLate, rules, { from: 'd3', to: 'a3' }).state; // wasted move
    solvedLate = playMove(solvedLate, rules, { from: 'a3', to: 'a5' }).state; // wasted move
    solvedLate = playMove(solvedLate, rules, { from: 'a5', to: 'd5' }).state; // captures d5
    solvedLate = playMove(solvedLate, rules, { from: 'd5', to: 'd4' }).state; // captures d4
    expect(solvedLate.moves).toBe(4);
    expect(starsFor(solvedLate)).toBe(1);
  });

  it('kind.act(undo) matches the engine facade (C2: UndoAction outcome is "undone")', () => {
    const played = captureKind.act(
      captureKind.init(def),
      { type: 'move', move: { from: 'd3', to: 'd4' } },
      rules,
    );
    const undone = captureKind.act(played.state, { type: 'undo' }, rules);
    expect(undone.outcome).toEqual({ kind: 'undone' });
    expect(undone.state).toEqual(undo(played.state));
  });
});
