import type { Move, MoveInput } from '../chess/rules.ts';
import type { PieceType, Position } from '../chess/types.ts';
import type { VariantRules } from '../variant/rules.ts';
import { playMove, startExercise } from './engine.ts';
import type { ExerciseState } from './engine.ts';
import type { CaptureDef, CollectStarsDef, ExerciseDef } from './types.ts';

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
  return { mode: 'static', def, exercise: startExercise(toGoalDef(def)), ended: false };
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

/**
 * A `series` mini-game's content (Square Hunt, Setup Race, and M3's Safe or Not? / Escape the
 * Check / Mate in 1): a fixed sequence of exercise rounds, of any exercise type, scored on total
 * mistakes across all rounds rather than a single win condition.
 */
export interface SeriesGameDef {
  readonly id: string;
  readonly concept: string;
  readonly rounds: readonly ExerciseDef[];
  /** Total mistakes (errors + hint levels, summed across every round) at/under which 3 stars are earned. */
  readonly errors3: number;
  /** …2 stars threshold; `errors2 >= errors3`. Above it, still 1 star once every round is done. */
  readonly errors2: number;
}

/** Immutable series mini-game progress: one round played at a time via the normal exercise engine. */
export interface SeriesGameState {
  readonly mode: 'series';
  readonly def: SeriesGameDef;
  readonly roundIndex: number;
  /** Current (or, once `done`, last) round's exercise state. */
  readonly round: ExerciseState;
  /** Mistakes (errors + hint level) folded in from every round completed so far. */
  readonly mistakes: number;
  readonly done: boolean;
}

/** Starts a fresh series at its first round. */
export function startSeries(def: SeriesGameDef): SeriesGameState {
  const firstRound = def.rounds[0];
  if (firstRound === undefined) {
    throw new Error('startSeries: def.rounds is empty');
  }
  return {
    mode: 'series',
    def,
    roundIndex: 0,
    round: startExercise(firstRound),
    mistakes: 0,
    done: false,
  };
}

/** The exercise definition for the round currently (or, once `done`, last) in play. */
export function currentRound(state: SeriesGameState): ExerciseDef {
  return state.def.rounds[state.roundIndex] ?? state.round.def;
}

/**
 * Folds a solved round's mistakes (errors + hint level; hints are allowed but count as mistakes,
 * same as a wrong try) into the series total, then advances to the next round, or marks the series
 * `done` after the last one. `roundState` must be the current round's `solved` exercise state.
 */
export function completeRound(state: SeriesGameState, roundState: ExerciseState): SeriesGameState {
  const mistakes = state.mistakes + roundState.errors + roundState.hintLevel;
  const nextIndex = state.roundIndex + 1;
  const nextDef = state.def.rounds[nextIndex];
  if (nextDef === undefined) {
    return { ...state, round: roundState, mistakes, done: true };
  }
  return { ...state, roundIndex: nextIndex, round: startExercise(nextDef), mistakes, done: false };
}

/** Current series status: `playing` until every round is complete. */
export function seriesResult(state: SeriesGameState): 'playing' | 'won' {
  return state.done ? 'won' : 'playing';
}

/** Stars for a finished series: total mistakes ≤ `errors3` → 3, ≤ `errors2` → 2, else 1 (finished). */
export function seriesStars(state: SeriesGameState): 0 | 1 | 2 | 3 {
  if (!state.done) {
    return 0;
  }
  if (state.mistakes <= state.def.errors3) {
    return 3;
  }
  if (state.mistakes <= state.def.errors2) {
    return 2;
  }
  return 1;
}
