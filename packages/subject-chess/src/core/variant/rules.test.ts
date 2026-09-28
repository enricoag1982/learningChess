import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseDiagram } from '../chess/diagram.ts';
import type { Position } from '../chess/types.ts';
import { createVariantRules } from './rules.ts';

const rules = createVariantRules(chessJsRules);
const STATIC = { staticOpponent: true };

function squares(moves: readonly { readonly to: string }[]): string[] {
  return moves.map((m) => m.to).sort();
}

describe('walls', () => {
  it('stop a sliding rook and cannot be landed on', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'x . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'R . . . . . . .',
      ].join('\n'),
    );

    const moves = rules.legalMoves(position, STATIC, 'a1');

    expect(squares(moves)).toEqual(['a2', 'a3', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'].sort());
  });

  it('let a knight jump over walls that are not its destination', () => {
    // Knight on d4, walls on all 8 surrounding squares (none of them a knight move destination).
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . x x x . . .',
        '. . x N x . . .',
        '. . x x x . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ].join('\n'),
    );

    const moves = rules.legalMoves(position, STATIC, 'd4');

    expect(squares(moves)).toEqual(['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'].sort());
  });

  it('exclude a wall square that is otherwise a legal knight destination', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. x . . . . . .',
        '. . . . . . . .',
        'N . . . . . . .',
      ].join('\n'),
    );

    const moves = rules.legalMoves(position, STATIC, 'a1');

    expect(squares(moves)).toEqual(['c2']);
  });

  it('are absent from the resulting position', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'x . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'R . . . . . . .',
      ].join('\n'),
    );

    const result = rules.play(position, STATIC, { from: 'a1', to: 'a3' });

    expect(result).not.toBeNull();
    expect(result?.position.pieces.a4).toBeUndefined();
  });

  it('keep the position markers unchanged', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'x . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'R . . . . . . .',
      ].join('\n'),
    );

    const result = rules.play(position, STATIC, { from: 'a1', to: 'a3' });

    expect(result?.position.markers).toEqual(position.markers);
  });
});

describe('stars', () => {
  it('never block movement', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '* . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'R . . . . . . .',
      ].join('\n'),
    );

    const moves = rules.legalMoves(position, STATIC, 'a1');

    expect(squares(moves)).toContain('a8');
    expect(moves).toHaveLength(14);
  });
});

describe('attackers', () => {
  it('reports real board geometry, ignoring whose turn it is', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . r . . .',
        '. . . . R . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ].join('\n'),
      { toMove: 'b' }, // black to move; the white rook's attack does not depend on that
    );

    expect(rules.attackers(position, 'e5', 'w')).toEqual(['e4']);
    expect(rules.attackers(position, 'e4', 'b')).toEqual(['e5']);
  });

  it('blocks a sliding attacker behind a wall', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . x . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . R . . . .',
      ].join('\n'),
    );

    expect(rules.attackers(position, 'd8', 'w')).toEqual([]);
  });
});

describe('staticOpponent', () => {
  // A black pawn on d4 gives chess.js an actual en passant capture to report after e2-e4.
  const position: Position = {
    pieces: {
      e2: { color: 'w', type: 'p' },
      d4: { color: 'b', type: 'p' },
      e8: { color: 'b', type: 'k' },
    },
    markers: { stars: [], blocked: [] },
    toMove: 'w',
    castling: '-',
    enPassant: null,
  };

  it('returns the turn to the kid and clears en passant', () => {
    const result = rules.play(position, STATIC, { from: 'e2', to: 'e4' });

    expect(result).not.toBeNull();
    expect(result?.position.toMove).toBe('w');
    expect(result?.position.enPassant).toBeNull();
  });

  it('lets the opponent turn stand when staticOpponent is off', () => {
    const result = rules.play(position, { staticOpponent: false }, { from: 'e2', to: 'e4' });

    expect(result?.position.toMove).toBe('b');
    expect(result?.position.enPassant).toBe('e3');
  });
});
