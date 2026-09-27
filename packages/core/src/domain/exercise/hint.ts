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
