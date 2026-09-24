import { describe, expect, it } from 'vitest';

import { parseDiagram } from './diagram.ts';
import { FenError, parseFen, toFen } from './fen.ts';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('parseFen / toFen', () => {
  it('round trips the start position', () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN);
  });

  it('parses castling rights and en passant', () => {
    const fen = 'r3k2r/8/8/8/4P3/8/8/R3K2R b Qk e3 0 10';
    const position = parseFen(fen);
    expect(position.toMove).toBe('b');
    expect(position.castling).toBe('Qk');
    expect(position.enPassant).toBe('e3');
    expect(position.pieces.e1).toEqual({ color: 'w', type: 'k' });
    expect(position.pieces.a8).toEqual({ color: 'b', type: 'r' });
    expect(position.markers).toEqual({ stars: [], blocked: [] });
  });

  it('accepts a 4-field FEN, defaulting clocks', () => {
    const position = parseFen('8/8/8/8/8/8/8/8 w - -');
    expect(position.pieces).toEqual({});
    expect(position.toMove).toBe('w');
    expect(position.castling).toBe('-');
    expect(position.enPassant).toBeNull();
  });

  it('rejects fewer than 4 fields', () => {
    expect(() => parseFen('8/8/8/8/8/8/8/8 w -')).toThrow(FenError);
  });

  it('rejects more than 6 fields', () => {
    expect(() => parseFen('8/8/8/8/8/8/8/8 w - - 0 1 extra')).toThrow(FenError);
  });

  it('rejects the wrong number of ranks', () => {
    expect(() => parseFen('8/8/8/8/8/8/8 w - - 0 1')).toThrow(FenError);
  });

  it('rejects a rank that does not sum to 8 squares', () => {
    expect(() => parseFen('ppppppp/8/8/8/8/8/8/8 w - - 0 1')).toThrow(FenError);
  });

  it('rejects an unknown piece letter', () => {
    expect(() => parseFen('pppppppz/8/8/8/8/8/8/8 w - - 0 1')).toThrow(FenError);
  });

  it('rejects an invalid side to move', () => {
    expect(() => parseFen('8/8/8/8/8/8/8/8 x - - 0 1')).toThrow(FenError);
  });

  it('rejects invalid castling availability', () => {
    expect(() => parseFen('8/8/8/8/8/8/8/8 w XYZ - 0 1')).toThrow(FenError);
  });

  it('rejects an en passant square not on rank 3 or 6', () => {
    expect(() => parseFen('8/8/8/8/8/8/8/8 w - e5 0 1')).toThrow(FenError);
  });

  it('rejects a malformed en passant square', () => {
    expect(() => parseFen('8/8/8/8/8/8/8/8 w - z9 0 1')).toThrow(FenError);
  });

  it('converts a parsed diagram to its known FEN', () => {
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

    expect(toFen(parseDiagram(diagram))).toBe('8/8/8/8/8/8/8/R7 w - - 0 1');
  });
});
