import type { Piece, Position, Square } from '../chess/types.ts';

/** Fields shared by every exercise definition. */
interface ExerciseBase {
  readonly id: string;
  /** Concept id (e.g. `rook-move`), used for mastery and review tracking. */
  readonly concept: string;
  /** i18n key for the exercise's instruction text. */
  readonly textKey: string;
  readonly position: Position;
  /** Id of an entry in the lesson's `variants`, offered after `EASIER_AFTER_ERRORS` errors on this (scored) exercise. */
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
  /**
   * Explicit answer, or derived from the position: every legal destination of the piece on `from`
   * (`legal-moves`), every square the piece on `from` attacks, own or enemy pieces included
   * (`attacked-by`), or every square the side to move's king can legally move to, position must
   * have that king in check (`check-escapes`).
   */
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

/**
 * Deliver checkmate under real chess rules (both kings, real turn alternation — never a static
 * opponent). `line` is the full scripted sequence in SAN — kid move, opponent reply, kid move, …,
 * final kid move (which mates) — so `line.length === 2 * n - 1`.
 */
export interface MateInNDef extends ExerciseBase {
  readonly type: 'mate-in-n';
  readonly n: number;
  readonly line: readonly string[];
}

/** All exercise definitions. */
export type ExerciseDef =
  | CollectStarsDef
  | SelectSquaresDef
  | CaptureDef
  | YesNoDef
  | ChoiceDef
  | BestMoveDef
  | SetupDef
  | MateInNDef;
