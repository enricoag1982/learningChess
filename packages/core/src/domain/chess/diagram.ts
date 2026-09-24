import type { Color, Piece, Position, Square } from './types.ts';
import { PIECE_BY_LETTER, pieceLetter, squareAt } from './notation.ts';

/** Thrown when a board diagram string is malformed. */
export class DiagramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagramError';
  }
}

/**
 * Parses a board diagram (8 rows of 8 whitespace-separated tokens, rank 8 first) into a
 * `Position`. Tolerates indentation and leading/trailing/blank lines.
 */
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

/** Inverse of `parseDiagram`: 8 lines, tokens single-space-joined, no trailing newline. */
export function toDiagram(position: Position): string {
  const lines: string[] = [];
  for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
    const tokens: string[] = [];
    for (let colIndex = 0; colIndex < 8; colIndex += 1) {
      const square = squareAt(rowIndex, colIndex);
      const piece = position.pieces[square];
      if (piece !== undefined) {
        tokens.push(pieceLetter(piece));
      } else if (position.markers.stars.includes(square)) {
        tokens.push('*');
      } else if (position.markers.blocked.includes(square)) {
        tokens.push('x');
      } else {
        tokens.push('.');
      }
    }
    lines.push(tokens.join(' '));
  }
  return lines.join('\n');
}
