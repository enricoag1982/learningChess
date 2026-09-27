import type { Move } from '../../../chess/rules.ts';
import type { PieceType, Position } from '../../../chess/types.ts';
import type { ExerciseState } from '../../engine.ts';
import type { CaptureDef, CollectStarsDef } from '../../types.ts';

/**
 * Mini-game win condition: `capture-all` (Hungry Piece: capture every enemy) or `collect-stars`
 * (Knight Maze / King Walk: reach every star; a static enemy may still make some squares unsafe
 * for a king, enforced by normal move legality — see `VariantRules`).
 */
export type MiniGameGoal = 'capture-all' | 'collect-stars';

/** Static-opponent mini-game: kid piece(s) vs static enemies / rocks, win = reach `goal`. */
export interface StaticCaptureGameDef {
  readonly id: string;
  readonly concept: string;
  readonly position: Position;
  /** Win condition; defaults to `capture-all` (every mini-game before M2.3 was capture-only). */
  readonly goal?: MiniGameGoal;
  /** Move count within which a win earns 3 stars. */
  readonly par: number;
  /** Optional cap on kid moves; reaching it without winning ends the game. */
  readonly moveLimit?: number;
}

/** Immutable mini-game progress (`static` boss: Hungry Piece, Knight Maze, King Walk, …). */
export interface GameState {
  readonly mode: 'static';
  readonly def: StaticCaptureGameDef;
  readonly exercise: ExerciseState;
  readonly ended: boolean;
}

/** Result of a mini-game move attempt. */
export type GameOutcome =
  | { readonly kind: 'illegal' }
  | { readonly kind: 'playing'; readonly move: Move; readonly captured?: PieceType }
  | { readonly kind: 'won'; readonly move: Move; readonly captured?: PieceType }
  | { readonly kind: 'ended'; readonly move: Move; readonly captured?: PieceType };

/** Shape shared by anything that reduces to a static-opponent `capture` / `collect-stars` goal. */
export interface StaticGoalSource {
  readonly id: string;
  readonly concept: string;
  readonly textKey: string;
  readonly position: Position;
  /** Win condition; defaults to `capture-all` (every mini-game before M2.3 was capture-only). */
  readonly goal?: 'capture-all' | 'collect-stars';
  /** Move count within which the goal is met at "3-star" pace; also used as the solver's stars2. */
  readonly par: number;
}

/** Builds the `capture` / `collect-stars` exercise a static-opponent goal reduces to (solver input). */
export function staticGoalExercise(source: StaticGoalSource): CaptureDef | CollectStarsDef {
  const shared = {
    id: source.id,
    concept: source.concept,
    textKey: source.textKey,
    position: source.position,
    stars3: source.par,
    stars2: source.par,
  } as const;
  if ((source.goal ?? 'capture-all') === 'collect-stars') {
    return { ...shared, type: 'collect-stars' };
  }
  return { ...shared, type: 'capture' };
}
