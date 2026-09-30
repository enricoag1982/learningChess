import { describe, expect, it } from 'vitest';

import { parseFen } from '../../core/chess/fen.ts';
import type { Square } from '../../core/chess/types.ts';
import type { MoveAction } from '../../kinds/base.ts';
import { moveToUi } from './move-ui.ts';

const POSITION = parseFen('4k3/8/8/8/8/8/8/N3K3 w - - 0 1');

function move(from: Square, to: Square): MoveAction {
  return { type: 'move', move: { from, to } };
}

describe('moveToUi: an illegal move', () => {
  it('names the piece that was dragged (the knight on a1)', () => {
    const patch = moveToUi({ kind: 'illegal' }, move('a1', 'b2'), { position: POSITION });
    expect(patch.feedback).toEqual({ kind: 'illegal', piece: 'n' });
  });

  it('names no piece when the from-square is empty', () => {
    const patch = moveToUi({ kind: 'illegal' }, move('d4', 'd5'), { position: POSITION });
    expect(patch.feedback).toEqual({ kind: 'illegal' });
  });

  it('names no piece for a SAN move', () => {
    const san: MoveAction = { type: 'move', move: 'Nb2' };
    const patch = moveToUi({ kind: 'illegal' }, san, { position: POSITION });
    expect(patch.feedback).toEqual({ kind: 'illegal' });
  });
});
