import type { Move } from '../../core/chess/rules.ts';
import type { PieceType, Position } from '../../core/chess/types.ts';
import type { ExerciseStateOf } from '../../core/exercise/state.ts';
import type { CaptureDef, CollectStarsDef } from '../../core/exercise/types.ts';

/** `capture-all` (Hungry Piece) or `collect-stars` (Knight Maze / King Walk: reach every star). */
export type MiniGameGoal = 'capture-all' | 'collect-stars';

export interface StaticCaptureGameDef {
  readonly id: string;
  readonly concept: string;
  readonly position: Position;
  readonly goal?: MiniGameGoal;
  /** Move count within which a win earns 3 stars. */
  readonly par: number;
  /** Optional cap on kid moves; reaching it without winning ends the game. */
  readonly moveLimit?: number;
}

export interface GameState {
  readonly mode: 'static';
  readonly def: StaticCaptureGameDef;
  readonly exercise: ExerciseStateOf<CaptureDef | CollectStarsDef>;
  readonly ended: boolean;
}

export type GameOutcome =
  | { readonly kind: 'illegal' }
  | { readonly kind: 'playing'; readonly move: Move; readonly captured?: PieceType }
  | { readonly kind: 'won'; readonly move: Move; readonly captured?: PieceType }
  | { readonly kind: 'ended'; readonly move: Move; readonly captured?: PieceType };

export interface StaticGoalSource {
  readonly id: string;
  readonly concept: string;
  readonly textKey: string;
  readonly position: Position;
  readonly goal?: 'capture-all' | 'collect-stars';
  /** Move count within which the goal is met at "3-star" pace; also used as the solver's stars2. */
  readonly par: number;
}

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
