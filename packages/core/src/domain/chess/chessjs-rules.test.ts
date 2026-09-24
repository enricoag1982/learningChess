import { describe, expect, it } from 'vitest';

import { chessJsRules } from './chessjs-rules.ts';
import { parseDiagram } from './diagram.ts';
import { parseFen } from './fen.ts';
import { InvalidPositionError } from './rules.ts';
import type { Move } from './rules.ts';
import type { Position } from './types.ts';

const START = parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

function play(position: Position, ...moves: readonly string[]): Position {
  return moves.reduce((pos, san) => {
    const result = chessJsRules.play(pos, san);
    if (result === null) {
      throw new Error(`test setup error: illegal move ${san}`);
    }
    return result.position;
  }, position);
}

function sanOf(moves: readonly Move[]): string[] {
  return moves.map((m) => m.san).sort();
}

describe('legalMoves', () => {
  it('lists 20 moves from the start position', () => {
    expect(chessJsRules.legalMoves(START)).toHaveLength(20);
  });

  it('restricts to one square', () => {
    expect(sanOf(chessJsRules.legalMoves(START, 'g1'))).toEqual(['Nf3', 'Nh3']);
  });

  it('lists 14 moves for a lone rook on an empty board', () => {
    const position: Position = {
      pieces: { a1: { color: 'w', type: 'r' } },
      markers: { stars: [], blocked: [] },
      toMove: 'w',
      castling: '-',
      enPassant: null,
    };
    expect(chessJsRules.legalMoves(position)).toHaveLength(14);
  });

  it('lists 16 moves for Pawn Wars (no kings)', () => {
    const diagram = [
      '. . . . . . . .',
      'p p p p p p p p',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      'P P P P P P P P',
      '. . . . . . . .',
    ].join('\n');
    expect(chessJsRules.legalMoves(parseDiagram(diagram))).toHaveLength(16);
  });
});

describe('play', () => {
  it('keeps markers on a lone rook position', () => {
    const diagram = [
      '. . . . * . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '* . . . * . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      'R . . . . . . .',
    ].join('\n');
    const position = parseDiagram(diagram);

    const result = chessJsRules.play(position, { from: 'a1', to: 'a4' });

    expect(result).not.toBeNull();
    expect(result?.position.markers).toEqual(position.markers);
    expect(result?.move).toMatchObject({ from: 'a1', to: 'a4', piece: 'r', color: 'w' });
  });

  it('reaches checkmate via the scholar’s mate sequence', () => {
    const mated = play(START, 'e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#');
    expect(chessJsRules.status(mated)).toEqual({
      check: true,
      checkmate: true,
      stalemate: false,
      insufficientMaterial: false,
    });
  });

  it('reports captured pieces on a capture', () => {
    const afterExchange = play(START, 'e4', 'd5');
    const result = chessJsRules.play(afterExchange, 'exd5');
    expect(result?.move.captured).toBe('p');
  });

  it('plays en passant from a FEN position', () => {
    const position = parseFen('rnbqkbnr/pp2pppp/8/2ppP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');

    const result = chessJsRules.play(position, { from: 'e5', to: 'd6' });

    expect(result).not.toBeNull();
    expect(result?.move.captured).toBe('p');
    expect(result?.position.pieces.d5).toBeUndefined();
    expect(result?.position.pieces.d6).toEqual({ color: 'w', type: 'p' });
  });

  it('castles when rights allow it', () => {
    const position = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const result = chessJsRules.play(position, 'O-O');
    expect(result).not.toBeNull();
    expect(result?.position.pieces.g1).toEqual({ color: 'w', type: 'k' });
    expect(result?.position.pieces.f1).toEqual({ color: 'w', type: 'r' });
  });

  it('refuses castling without rights', () => {
    const position = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1');
    expect(chessJsRules.play(position, 'O-O')).toBeNull();
  });

  it('promotes via SAN, including underpromotion', () => {
    const position = parseFen('k7/4P3/8/8/8/8/8/4K3 w - - 0 1');
    const result = chessJsRules.play(position, 'e8=N');
    expect(result?.move.promotion).toBe('n');
    expect(result?.position.pieces.e8).toEqual({ color: 'w', type: 'n' });
  });

  it('defaults promotion to queen for a from/to move', () => {
    const position = parseFen('k7/4P3/8/8/8/8/8/4K3 w - - 0 1');
    const result = chessJsRules.play(position, { from: 'e7', to: 'e8' });
    expect(result?.move.promotion).toBe('q');
    expect(result?.position.pieces.e8).toEqual({ color: 'w', type: 'q' });
  });

  it('returns null for an illegal move', () => {
    expect(chessJsRules.play(START, { from: 'e2', to: 'e5' })).toBeNull();
  });
});

describe('status', () => {
  it('reports stalemate', () => {
    const position = parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(chessJsRules.status(position)).toEqual({
      check: false,
      checkmate: false,
      stalemate: true,
      insufficientMaterial: false,
    });
  });
});

describe('attackers', () => {
  it('lists attackers of a square', () => {
    expect(chessJsRules.attackers(START, 'f3', 'w').sort()).toEqual(['e2', 'g1', 'g2']);
  });
});

describe('invalid positions', () => {
  it('rejects two white kings', () => {
    const position: Position = {
      pieces: {
        a1: { color: 'w', type: 'k' },
        h1: { color: 'w', type: 'k' },
        e8: { color: 'b', type: 'k' },
      },
      markers: { stars: [], blocked: [] },
      toMove: 'w',
      castling: '-',
      enPassant: null,
    };
    expect(() => chessJsRules.status(position)).toThrow(InvalidPositionError);
  });
});
