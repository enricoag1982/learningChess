import { describe, expect, it } from 'vitest';

import { parseFen } from '../fen.ts';
import { kingSquare } from './pieces.ts';

describe('kingSquare', () => {
  const position = parseFen('6k1/8/8/8/8/8/8/4K3 w - - 0 1');

  it("finds each side's king", () => {
    expect(kingSquare(position, 'w')).toBe('e1');
    expect(kingSquare(position, 'b')).toBe('g8');
  });

  it('is undefined when that side has no king', () => {
    const noBlackKing = parseFen('8/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(kingSquare(noBlackKing, 'b')).toBeUndefined();
  });
});
