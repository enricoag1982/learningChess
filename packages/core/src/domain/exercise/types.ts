import type { Position, Square } from '../chess/types.ts';

/** Fields shared by every exercise definition. */
interface ExerciseBase {
  readonly id: string;
  /** Concept id (e.g. `rook-move`), used for mastery and review tracking. */
  readonly concept: string;
  /** i18n key for the exercise's instruction text. */
  readonly textKey: string;
  readonly position: Position;
  /** Id of an easier exercise, offered after 2 wrong attempts. */
  readonly easier?: string;
}

/** Move a piece over every star; 3/2-star move-count thresholds. Opponent, if any, is static. */
export interface CollectStarsDef extends ExerciseBase {
  readonly type: 'collect-stars';
  readonly stars3: number;
  readonly stars2: number;
}

/** Capture every opponent piece; opponent is static. 3/2-star move-count thresholds. */
export interface CaptureDef extends ExerciseBase {
  readonly type: 'capture';
  readonly stars3: number;
  readonly stars2: number;
}

/** Tap the correct set of squares. */
export interface SelectSquaresDef extends ExerciseBase {
  readonly type: 'select-squares';
  /** Explicit answer, or derived from the position. */
  readonly answer:
    | { readonly squares: readonly Square[] }
    | { readonly derive: 'legal-moves'; readonly from: Square };
}

/** All M1 exercise definitions. */
export type ExerciseDef = CollectStarsDef | SelectSquaresDef | CaptureDef;
