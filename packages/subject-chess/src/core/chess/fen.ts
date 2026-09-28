import type { Color, Piece, Position, Square } from './types.ts';
import { PIECE_BY_LETTER, pieceLetter, squareAt } from './notation.ts';
import { isSquare } from './types.ts';

/** Thrown when a FEN string is malformed. */
export class FenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FenError';
  }
}

const CASTLING_PATTERN = /^(-|K?Q?k?q?)$/;

function parsePlacement(placement: string): Partial<Record<Square, Piece>> {
  const ranks = placement.split('/');
  if (ranks.length !== 8) {
    throw new FenError(`piece placement: expected 8 ranks, got ${String(ranks.length)}`);
  }

  const pieces: Partial<Record<Square, Piece>> = {};
  ranks.forEach((rankStr, rankIndex) => {
    let col = 0;
    for (const char of rankStr) {
      if (char >= '1' && char <= '8') {
        col += Number(char);
        continue;
      }
      const piece = PIECE_BY_LETTER[char];
      if (piece === undefined) {
        throw new FenError(`rank ${String(rankIndex + 1)}: unknown symbol "${char}"`);
      }
      if (col >= 8) {
        throw new FenError(`rank ${String(rankIndex + 1)}: expected 8 squares, got more than 8`);
      }
      pieces[squareAt(rankIndex, col)] = piece;
      col += 1;
    }
    if (col !== 8) {
      throw new FenError(`rank ${String(rankIndex + 1)}: expected 8 squares, got ${String(col)}`);
    }
  });
  return pieces;
}

function field(fields: readonly string[], index: number, name: string): string {
  const value = fields[index];
  if (value === undefined) {
    throw new FenError(`missing ${name} field`);
  }
  return value;
}

/** Parses a FEN string (4 to 6 space-separated fields; clocks, if present, are ignored). */
export function parseFen(fen: string): Position {
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 4 || fields.length > 6) {
    throw new FenError(`expected 4 to 6 fields, got ${String(fields.length)}`);
  }

  const pieces = parsePlacement(field(fields, 0, 'piece placement'));

  const active = field(fields, 1, 'active color');
  if (active !== 'w' && active !== 'b') {
    throw new FenError(`active color: expected "w" or "b", got "${active}"`);
  }
  const toMove: Color = active;

  const castling = field(fields, 2, 'castling availability');
  if (!CASTLING_PATTERN.test(castling) || castling.length === 0) {
    throw new FenError(`castling availability: invalid value "${castling}"`);
  }

  const enPassantField = field(fields, 3, 'en passant target');
  let enPassant: Square | null = null;
  if (enPassantField !== '-') {
    if (!isSquare(enPassantField) || (enPassantField[1] !== '3' && enPassantField[1] !== '6')) {
      throw new FenError(`en passant target: invalid value "${enPassantField}"`);
    }
    enPassant = enPassantField;
  }

  return {
    pieces,
    markers: { stars: [], blocked: [] },
    toMove,
    castling,
    enPassant,
  };
}

/** Serialises a `Position` to a 6-field FEN string. Markers are not part of FEN; clocks are `0 1`. */
export function toFen(position: Position): string {
  const rows: string[] = [];
  for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
    let row = '';
    let empty = 0;
    for (let colIndex = 0; colIndex < 8; colIndex += 1) {
      const piece = position.pieces[squareAt(rowIndex, colIndex)];
      if (piece === undefined) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      row += pieceLetter(piece);
    }
    if (empty > 0) {
      row += String(empty);
    }
    rows.push(row);
  }

  const enPassant = position.enPassant ?? '-';
  return `${rows.join('/')} ${position.toMove} ${position.castling} ${enPassant} 0 1`;
}
