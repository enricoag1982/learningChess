import type { Piece, Position, Square } from '../chess/types.ts';

interface ExerciseBase {
  readonly id: string;
  readonly concept: string;
  readonly textKey: string;
  readonly position: Position;
  /** Id of an entry in the lesson's `variants`, offered after `EASIER_AFTER_ERRORS` errors on this (scored) exercise. */
  readonly easier?: string;
  /** The opponent's last move, display only: the board highlights `from`/`to` from the start —
   * needed for en passant, so the kid sees the double step that makes the capture legal. */
  readonly lastMove?: { readonly from: Square; readonly to: Square };
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

export interface SelectSquaresDef extends ExerciseBase {
  readonly type: 'select-squares';
  /** Explicit answer, or derived: every legal destination of the piece on `from` (`legal-moves`), every square it attacks
   * (`attacked-by`), or every escape square with the king in check (`check-escapes`). */
  readonly answer:
    | { readonly squares: readonly Square[] }
    | { readonly derive: 'legal-moves'; readonly from: Square }
    | { readonly derive: 'attacked-by'; readonly from: Square }
    | { readonly derive: 'check-escapes' };
}

/** Answer a yes/no question about the position; `focus`, if given, is the square the question is about. */
export interface YesNoDef extends ExerciseBase {
  readonly type: 'yes-no';
  readonly answer: boolean;
  readonly focus?: Square;
}

/** One pickable option: at least one of `textKey` / `piece` is set (schema-enforced). */
export interface ChoiceOption {
  readonly id: string;
  readonly textKey?: string;
  readonly piece?: Piece;
}

/** Pick the correct option (e.g. "which piece is worth more?"). */
export interface ChoiceDef extends ExerciseBase {
  readonly type: 'choice';
  readonly options: readonly ChoiceOption[];
  readonly answer: string;
  readonly showBoard: boolean;
}

/** Play the right move; any SAN in `solutions` solves it. Opponent, if any, is static. */
export interface BestMoveDef extends ExerciseBase {
  readonly type: 'best-move';
  readonly solutions: readonly string[];
}

/** Place pieces from a palette to match `target`; `position` is the (often empty) starting board. */
export interface SetupDef extends ExerciseBase {
  readonly type: 'setup';
  readonly target: Position;
}

/** Deliver checkmate under real chess rules (both kings, real turn alternation). `line` is the full
 * scripted SAN sequence: kid, opponent, kid, …, final kid move that mates (`length === 2*n - 1`). */
export interface MateInNDef extends ExerciseBase {
  readonly type: 'mate-in-n';
  readonly n: number;
  readonly line: readonly string[];
}

export type ExerciseDef =
  | CollectStarsDef
  | SelectSquaresDef
  | CaptureDef
  | YesNoDef
  | ChoiceDef
  | BestMoveDef
  | SetupDef
  | MateInNDef;
