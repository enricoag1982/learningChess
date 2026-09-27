import type { Move, MoveInput } from '../../chess/rules.ts';
import type { PieceType, Position, Square } from '../../chess/types.ts';
import { enemyCount } from '../../chess/facts/goals.ts';
import { sameSan } from '../../chess/facts/san.ts';
import type { VariantRules } from '../../variant/rules.ts';
import { applyKidMove } from '../apply-move.ts';
import type { Hint } from '../hint.ts';
import { solve } from '../solver.ts';
import type { ExerciseState } from '../engine.ts';
import type { ExerciseDef } from '../types.ts';

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

const NON_MOVE_TYPES = new Set<ExerciseDef['type']>([
  'select-squares',
  'yes-no',
  'choice',
  'setup',
]);

function isCaptureSolved(position: Position, kidColor: Position['toMove']): boolean {
  return enemyCount(position, kidColor) === 0;
}

function isSolutionMove(solutions: readonly string[], san: string): boolean {
  return solutions.some((solution) => sameSan(solution, san));
}

/** Plays a kid move for a collect-stars / capture / best-move exercise. */
export function playMove(
  state: ExerciseState,
  rules: VariantRules,
  move: MoveInput,
): { readonly state: ExerciseState; readonly outcome: MoveOutcome } {
  if (NON_MOVE_TYPES.has(state.def.type)) {
    throw new Error(`playMove: ${state.def.type} exercises use a different action`);
  }
  if (state.def.type === 'mate-in-n') {
    throw new Error(`playMove: ${state.def.type} exercises use a different action`);
  }
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
    const nextState: ExerciseState = {
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

  const nextState: ExerciseState = {
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

/** Undoes the last kid move (collect-stars / capture / best-move). No-op at the start of the exercise. */
export function undo(state: ExerciseState): ExerciseState {
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

function goalMove(state: ExerciseState, rules: VariantRules): { from: Square; to: Square } | null {
  const goal = state.def.type === 'collect-stars' ? 'collect-stars' : 'capture';
  const line = solve(state.position, rules, goal);
  return line?.[0] ?? null;
}

/** collect-stars / capture hint: piece → target square → the move, from the solver's shortest line. */
export function moveHint(state: ExerciseState, rules: VariantRules, level: 1 | 2 | 3): Hint {
  const move = goalMove(state, rules);
  if (level === 1) {
    return { kind: 'squares', level: 1, squares: move === null ? [] : [move.from] };
  }
  if (level === 2) {
    return { kind: 'squares', level: 2, squares: move === null ? [] : [move.to] };
  }
  return {
    kind: 'squares',
    level: 3,
    squares: move === null ? [] : [move.from, move.to],
    ...(move === null ? {} : { move }),
  };
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
