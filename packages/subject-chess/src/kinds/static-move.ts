import type { Move, MoveInput } from '../core/chess/rules.ts';
import type { PieceType, Position, Square } from '../core/chess/types.ts';
import { enemyCount } from '../core/chess/facts/goals.ts';
import { sameSan } from '../core/chess/facts/san.ts';
import type { VariantRules } from '../core/variant/rules.ts';
import { applyKidMove } from '../core/exercise/apply-move.ts';
import type { Hint } from '../core/exercise/hint.ts';
import { moveLadderHint } from '../core/exercise/hint.ts';
import { solve } from '../core/exercise/solver.ts';
import type { ExerciseStateOf } from '../core/exercise/state.ts';
import type { BestMoveDef, CaptureDef, CollectStarsDef } from '../core/exercise/types.ts';
import { initState } from '../core/exercise/state.ts';
import type { MoveAction } from './base.ts';
import type { ChessKind } from './index.ts';

/** Result of a piece move attempt (collect-stars / capture / best-move). */
export type MoveOutcome =
  | { readonly kind: 'illegal' }
  /** best-move only: a legal move that is not one of `solutions`. Position is unchanged. */
  | { readonly kind: 'wrong'; readonly move: Move }
  | {
      readonly kind: 'moved';
      readonly move: Move;
      readonly collected: readonly Square[];
      readonly captured?: PieceType;
    }
  | {
      readonly kind: 'solved';
      readonly move: Move;
      readonly collected: readonly Square[];
      readonly captured?: PieceType;
    };

/** Reverts the last kid move (collect-stars / capture only). */
export interface UndoAction {
  readonly type: 'undo';
}

/** Result of an `UndoAction`. */
export type UndoOutcome = { readonly kind: 'undone' };

function isCaptureSolved(position: Position, kidColor: Position['toMove']): boolean {
  return enemyCount(position, kidColor) === 0;
}

function isSolutionMove(solutions: readonly string[], san: string): boolean {
  return solutions.some((solution) => sameSan(solution, san));
}

/** Plays a kid move for a collect-stars / capture / best-move exercise. */
export function playMove<D extends CollectStarsDef | CaptureDef | BestMoveDef>(
  state: ExerciseStateOf<D>,
  rules: VariantRules,
  move: MoveInput,
): { readonly state: ExerciseStateOf<D>; readonly outcome: MoveOutcome } {
  if (state.solved) {
    return { state, outcome: { kind: 'illegal' } };
  }

  const applied = applyKidMove(state.position, rules, move);
  if (applied === null) {
    return { state: { ...state, errors: state.errors + 1 }, outcome: { kind: 'illegal' } };
  }

  if (state.def.type === 'best-move') {
    if (!isSolutionMove(state.def.solutions, applied.move.san)) {
      return {
        state: { ...state, errors: state.errors + 1 },
        outcome: { kind: 'wrong', move: applied.move },
      };
    }
    const nextState: ExerciseStateOf<D> = {
      ...state,
      position: applied.position,
      history: [...state.history, state.position],
      moves: state.moves + 1,
      solved: true,
    };
    const outcome: MoveOutcome = {
      kind: 'solved',
      move: applied.move,
      collected: applied.collected,
      ...(applied.move.captured === undefined ? {} : { captured: applied.move.captured }),
    };
    return { state: nextState, outcome };
  }

  const kidColor = state.def.position.toMove;
  const solved =
    state.def.type === 'collect-stars'
      ? applied.position.markers.stars.length === 0
      : isCaptureSolved(applied.position, kidColor);

  const nextState: ExerciseStateOf<D> = {
    ...state,
    position: applied.position,
    history: [...state.history, state.position],
    moves: state.moves + 1,
    solved,
  };
  const outcome: MoveOutcome = {
    kind: solved ? 'solved' : 'moved',
    move: applied.move,
    collected: applied.collected,
    ...(applied.move.captured === undefined ? {} : { captured: applied.move.captured }),
  };
  return { state: nextState, outcome };
}

/** Undoes the last kid move (collect-stars / capture). No-op at the start of the exercise. */
export function undo<D extends CollectStarsDef | CaptureDef>(
  state: ExerciseStateOf<D>,
): ExerciseStateOf<D> {
  const previous = state.history[state.history.length - 1];
  if (previous === undefined) {
    return state;
  }
  return {
    ...state,
    position: previous,
    history: state.history.slice(0, -1),
    moves: state.moves - 1,
    solved: false,
  };
}

function goalMove<D extends CollectStarsDef | CaptureDef>(
  state: ExerciseStateOf<D>,
  rules: VariantRules,
): { from: Square; to: Square } | null {
  const goal = state.def.type === 'collect-stars' ? 'collect-stars' : 'capture';
  const line = solve(state.position, rules, goal);
  return line?.[0] ?? null;
}

/** collect-stars / capture hint: piece → target square → the move, from the solver's shortest line. */
export function moveHint<D extends CollectStarsDef | CaptureDef>(
  state: ExerciseStateOf<D>,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  return moveLadderHint(goalMove(state, rules), level);
}

/** Caps move-count stars by hint level used (collect-stars / capture only). */
export function capMoveStars(base: 1 | 2 | 3, hintLevel: 0 | 1 | 2 | 3): 1 | 2 | 3 {
  if (hintLevel === 3) {
    return 1;
  }
  if (hintLevel >= 1) {
    return base === 3 ? 2 : base;
  }
  return base;
}

/** Stars for collect-stars / capture: fewer moves than `stars3`/`stars2` is better, capped by hints. */
export function moveCountStars(
  moves: number,
  stars3: number,
  stars2: number,
  hintLevel: 0 | 1 | 2 | 3,
): 1 | 2 | 3 {
  const base: 1 | 2 | 3 = moves <= stars3 ? 3 : moves <= stars2 ? 2 : 1;
  return capMoveStars(base, hintLevel);
}

/** collect-stars / capture kind: the kid's moves are counted against `stars3` / `stars2`, undo allowed. */
export function moveCountedKind<D extends CollectStarsDef | CaptureDef>(
  type: D['type'],
): ChessKind<D, MoveAction | UndoAction, MoveOutcome | UndoOutcome> {
  return {
    type,
    input: 'static-move',
    init: initState,
    act(state, action, ctx) {
      if (action.type === 'undo') {
        return { state: undo(state), outcome: { kind: 'undone' } };
      }
      return playMove(state, ctx, action.move);
    },
    hint(state, level, ctx) {
      const bumped = { ...state, hintLevel: level };
      return { state: bumped, hint: moveHint(bumped, ctx, level) };
    },
    stars(state) {
      return moveCountStars(state.moves, state.def.stars3, state.def.stars2, state.hintLevel);
    },
  };
}

/** collect-stars / capture solution: the solver's shortest line, as move actions. */
export function goalSolution<D extends CollectStarsDef | CaptureDef>(
  type: D['type'],
): (def: D, ctx: VariantRules) => readonly MoveAction[] {
  return (def, ctx) => {
    const line = solve(def.position, ctx, type);
    if (line === null) {
      throw new Error(`${type} "${def.id}": no solution found`);
    }
    return line.map((move) => ({ type: 'move', move: { from: move.from, to: move.to } }));
  };
}
