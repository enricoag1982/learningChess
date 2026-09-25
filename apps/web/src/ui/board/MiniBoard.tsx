import type { JSX } from 'react';
import type { Color, Position, Square } from '@chess-kids/core';
import { PieceBadge, PieceIcon } from './pieces.tsx';
import { cellToSquare } from './geometry.ts';

const CELLS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

function isLightSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);
  return (file + rank) % 2 === 0;
}

export interface MiniBoardProps {
  readonly position: Position;
  /** Squares to mark with a green dot (e.g. a demo's legal moves). Purely decorative. */
  readonly highlightSquares?: readonly Square[];
  readonly orientation?: Color;
  /** Accessible label; the board itself is a static illustration, not a control. */
  readonly label: string;
  /** Animal-badge piece look (`board/piece-style.ts`), default `false` (classic only). */
  readonly pieceBadges?: boolean;
}

/**
 * A small, non-interactive board diagram: the Story step's "here's how I move" illustration.
 * Unlike `Board`, nothing here responds to taps or drags — it only ever shows a fixed position
 * plus optional dot markers, so the lesson can pre-render legal-move dots without a kid's tap.
 */
export function MiniBoard({
  position,
  highlightSquares = [],
  orientation = 'w',
  label,
  pieceBadges = false,
}: MiniBoardProps): JSX.Element {
  return (
    <div
      role="img"
      aria-label={label}
      className="aspect-square h-full max-h-full w-full max-w-full"
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-2xl border-4 border-board-frame">
        {CELLS.map((row) =>
          CELLS.map((col) => {
            const square = cellToSquare(row, col, orientation);
            if (square === null) return null;
            const piece = position.pieces[square];
            const light = isLightSquare(square);
            const isDot = highlightSquares.includes(square) && piece === undefined;
            return (
              <div
                key={square}
                className={`relative flex items-center justify-center ${light ? 'bg-board-light' : 'bg-board-dark'}`}
              >
                {piece && (
                  <span className="absolute inset-[6%]">
                    <PieceIcon piece={piece} />
                    {pieceBadges && <PieceBadge type={piece.type} />}
                  </span>
                )}
                {isDot && <span className="h-[28%] w-[28%] rounded-full bg-go/60" />}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
