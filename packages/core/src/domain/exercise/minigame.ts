import type { Move, MoveInput } from '../chess/rules.ts';
import type { PieceType, Position } from '../chess/types.ts';
import type { VariantRules } from '../variant/rules.ts';
import { playMove, startExercise } from './engine.ts';
import type { ExerciseState } from './engine.ts';
import type { CaptureDef, CollectStarsDef } from './types.ts';

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

/** Immutable mini-game progress. */
export interface GameState {
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

function toGoalDef(def: StaticCaptureGameDef): CaptureDef | CollectStarsDef {
  const shared = {
    id: def.id,
    concept: def.concept,
    textKey: def.id,
    position: def.position,
    stars3: def.par,
    stars2: def.par,
  } as const;
  if ((def.goal ?? 'capture-all') === 'collect-stars') {
    return { ...shared, type: 'collect-stars' };
  }
  return { ...shared, type: 'capture' };
}

/** Starts a fresh mini-game at its authored position. */
export function startStaticCaptureGame(def: StaticCaptureGameDef): GameState {
  return { def, exercise: startExercise(toGoalDef(def)), ended: false };
}

/** Plays one kid move. Reuses the capture exercise engine for legality and win detection. */
export function playGameMove(
  state: GameState,
  rules: VariantRules,
  move: MoveInput,
): { readonly state: GameState; readonly outcome: GameOutcome } {
  if (state.ended || state.exercise.solved) {
    return { state, outcome: { kind: 'illegal' } };
  }

  const { state: exercise, outcome } = playMove(state.exercise, rules, move);
  if (outcome.kind === 'illegal') {
    return { state: { ...state, exercise }, outcome: { kind: 'illegal' } };
  }
  if (outcome.kind === 'wrong') {
    // Mini-games are always `capture` or `collect-stars` exercises (see `toGoalDef`): `playMove`
    // never produces this outcome for them (best-move only). Handled for exhaustiveness, not
    // reachability.
    return { state: { ...state, exercise }, outcome: { kind: 'illegal' } };
  }

  const captured = outcome.captured === undefined ? {} : { captured: outcome.captured };
  if (outcome.kind === 'solved') {
    return {
      state: { ...state, exercise },
      outcome: { kind: 'won', move: outcome.move, ...captured },
    };
  }

  const limitReached = state.def.moveLimit !== undefined && exercise.moves >= state.def.moveLimit;
  if (limitReached) {
    return {
      state: { ...state, exercise, ended: true },
      outcome: { kind: 'ended', move: outcome.move, ...captured },
    };
  }
  return {
    state: { ...state, exercise },
    outcome: { kind: 'playing', move: outcome.move, ...captured },
  };
}

/** Current mini-game status. */
export function gameResult(state: GameState): 'playing' | 'won' | 'ended' {
  if (state.exercise.solved) {
    return 'won';
  }
  return state.ended ? 'ended' : 'playing';
}

/** Stars for the mini-game: 3 = win within par, 2 = win, 1 = played to the move limit. */
export function gameStars(state: GameState): 0 | 1 | 2 | 3 {
  const result = gameResult(state);
  if (result === 'playing') {
    return 0;
  }
  if (result === 'ended') {
    return 1;
  }
  return state.exercise.moves <= state.def.par ? 3 : 2;
}
