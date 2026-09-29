import type { Color, Piece, Position, Square } from './types.ts';
import { PIECE_BY_LETTER, squareAt } from './notation.ts';

export class DiagramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagramError';
  }
}

/** Parses a diagram (8 rows of 8 whitespace-separated tokens, rank 8 first) into a `Position`; tolerates indentation and blank lines. */
export function parseDiagram(diagram: string, options?: { toMove?: Color }): Position {
  const rows = diagram
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rows.length !== 8) {
    throw new DiagramError(`expected 8 rows, got ${String(rows.length)}`);
  }

  const pieces: Partial<Record<Square, Piece>> = {};
  const stars: Square[] = [];
  const blocked: Square[] = [];

  rows.forEach((row, rowIndex) => {
    const tokens = row.split(/\s+/);
    if (tokens.length !== 8) {
      throw new DiagramError(
        `row ${String(rowIndex + 1)}: expected 8 squares, got ${String(tokens.length)}`,
      );
    }

    tokens.forEach((token, colIndex) => {
      if (token === '.') {
        return;
      }
      const square = squareAt(rowIndex, colIndex);
      if (token === '*') {
        stars.push(square);
        return;
      }
      if (token === 'x') {
        blocked.push(square);
        return;
      }
      const piece = PIECE_BY_LETTER[token];
      if (piece === undefined) {
        throw new DiagramError(
          `row ${String(rowIndex + 1)}, column ${String(colIndex + 1)}: unknown symbol "${token}"`,
        );
      }
      pieces[square] = piece;
    });
  });

  return {
    pieces,
    // Traversal above follows SQUARES order, so both arrays are already sorted that way.
    markers: { stars, blocked },
    toMove: options?.toMove ?? 'w',
    castling: '-',
    enPassant: null,
  };
}
