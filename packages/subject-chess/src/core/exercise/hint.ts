import type { Piece, Square } from '../chess/types.ts';

/** One step of the hint ladder; shape depends on the exercise type. */
export type Hint =
  /** select-squares / collect-stars / capture / best-move: piece → target square(s) → the move. */
  | {
      readonly kind: 'squares';
      readonly level: 1 | 2 | 3;
      readonly squares: readonly Square[];
      readonly move?: { readonly from: Square; readonly to: Square };
    }
  | {
      readonly kind: 'yes-no';
      readonly level: 1 | 2 | 3;
      readonly squares: readonly Square[];
      /** Level 3 only: reveal the correct answer. */
      readonly reveal: boolean;
    }
  | {
      readonly kind: 'choice';
      readonly level: 1 | 2 | 3;
      /** Levels 1–2: one more wrong option ruled out, if any is left. */
      readonly removedOptionId?: string;
      /** Level 3 only: reveal the correct option. */
      readonly reveal: boolean;
    }
  | {
      readonly kind: 'setup';
      readonly level: 1 | 2 | 3;
      readonly piece?: Piece;
      readonly square?: Square;
      /** Level 3 only: the piece was placed for the kid. */
      readonly placed: boolean;
    };

/** The move kinds' hint ladder: the piece (level 1), then its target square (2), then the move
 * itself (3). Without a known move (`null` / `undefined`) the squares are empty. */
export function moveLadderHint(
  move: { readonly from: Square; readonly to: Square } | null | undefined,
  level: 1 | 2 | 3,
): Hint {
  const squares = !move
    ? []
    : level === 1
      ? [move.from]
      : level === 2
        ? [move.to]
        : [move.from, move.to];
  return {
    kind: 'squares',
    level,
    squares,
    ...(level === 3 && move ? { move: { from: move.from, to: move.to } } : {}),
  };
}
