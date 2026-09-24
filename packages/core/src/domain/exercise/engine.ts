import type { Move, MoveInput } from '../chess/rules.ts';
import type { PieceType, Position, Square } from '../chess/types.ts';
import type { VariantRules } from '../variant/rules.ts';
import { applyKidMove } from './apply-move.ts';
import { solve } from './solver.ts';
import type { ExerciseDef, SelectSquaresDef } from './types.ts';

/** Immutable exercise progress. */
export interface ExerciseState {
  readonly def: ExerciseDef;
  /** Current position. */
  readonly position: Position;
  /** Positions before each played move, for `undo`. */
  readonly history: readonly Position[];
  /** Kid moves played (collect-stars / capture only). */
  readonly moves: number;
  /** Currently selected squares (select-squares only). */
  readonly selected: readonly Square[];
  /** Wrong submissions / illegal move attempts. */
  readonly errors: number;
  /** Highest hint level shown so far. */
  readonly hintLevel: 0 | 1 | 2 | 3;
  readonly solved: boolean;
}

/** Result of a piece move attempt (collect-stars / capture). */
export type MoveOutcome =
  | { readonly kind: 'illegal' }
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

/** Result of a select-squares submission. */
export interface SelectionResult {
  readonly correct: boolean;
  /** Count of answer squares not selected. */
  readonly missing: number;
  /** Selected squares that are not part of the answer. */
  readonly wrong: readonly Square[];
}

/** One step of the hint ladder: piece → target square(s) → the move / full answer. */
export type Hint =
  | { readonly level: 1; readonly squares: readonly Square[] }
  | { readonly level: 2; readonly squares: readonly Square[] }
  | {
      readonly level: 3;
      readonly move?: { readonly from: Square; readonly to: Square };
      readonly squares: readonly Square[];
    };

/** Starts a fresh exercise at its authored position. */
export function startExercise(def: ExerciseDef): ExerciseState {
  return {
    def,
    position: def.position,
    history: [],
    moves: 0,
    selected: [],
    errors: 0,
    hintLevel: 0,
    solved: false,
  };
}

/** Legal kid moves right now (collect-stars / capture only; `[]` for select-squares or once solved). */
export function exerciseMoves(state: ExerciseState, rules: VariantRules, from?: Square): Move[] {
  if (state.solved || state.def.type === 'select-squares') {
    return [];
  }
  return rules.legalMoves(state.position, { staticOpponent: true }, from);
}

function isCaptureSolved(position: Position, kidColor: Position['toMove']): boolean {
  return !Object.values(position.pieces).some((piece) => piece.color !== kidColor);
}

/** Plays a kid move for a collect-stars / capture exercise. */
export function playMove(
  state: ExerciseState,
  rules: VariantRules,
  move: MoveInput,
): { readonly state: ExerciseState; readonly outcome: MoveOutcome } {
  if (state.def.type === 'select-squares') {
    throw new Error('playMove: select-squares exercises use toggleSquare / submitSelection');
  }
  if (state.solved) {
    return { state, outcome: { kind: 'illegal' } };
  }

  const applied = applyKidMove(state.position, rules, move);
  if (applied === null) {
    return { state: { ...state, errors: state.errors + 1 }, outcome: { kind: 'illegal' } };
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

/** Adds or removes a square from the current selection (select-squares). No-op once solved. */
export function toggleSquare(state: ExerciseState, square: Square): ExerciseState {
  if (state.solved) {
    return state;
  }
  const selected = state.selected.includes(square)
    ? state.selected.filter((s) => s !== square)
    : [...state.selected, square];
  return { ...state, selected };
}

/** Resolves a select-squares exercise's answer squares. */
function answerSquares(def: SelectSquaresDef, rules: VariantRules): readonly Square[] {
  if ('squares' in def.answer) {
    return def.answer.squares;
  }
  return rules
    .legalMoves(def.position, { staticOpponent: true }, def.answer.from)
    .map((move) => move.to);
}

/** Checks the current selection against the answer (select-squares). */
export function submitSelection(
  state: ExerciseState,
  rules: VariantRules,
): { readonly state: ExerciseState; readonly result: SelectionResult } {
  if (state.def.type !== 'select-squares') {
    throw new Error('submitSelection: exercise is not select-squares');
  }
  const answer = answerSquares(state.def, rules);
  const wrong = state.selected.filter((square) => !answer.includes(square));
  const missing = answer.filter((square) => !state.selected.includes(square)).length;
  const correct = wrong.length === 0 && missing === 0;

  const nextState = correct ? { ...state, solved: true } : { ...state, errors: state.errors + 1 };
  return { state: nextState, result: { correct, missing, wrong } };
}

/** Undoes the last kid move (collect-stars / capture). No-op at the start of the exercise. */
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

function selectSquaresHint(
  state: ExerciseState,
  def: SelectSquaresDef,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const answer = answerSquares(def, rules);
  if (level === 1) {
    const from = 'derive' in def.answer ? [def.answer.from] : [];
    return { level: 1, squares: from };
  }
  if (level === 2) {
    const next = answer.find((square) => !state.selected.includes(square));
    return { level: 2, squares: next === undefined ? [] : [next] };
  }
  return { level: 3, squares: answer };
}

function moveHint(state: ExerciseState, rules: VariantRules, level: 1 | 2 | 3): Hint {
  const move = goalMove(state, rules);
  if (level === 1) {
    return { level: 1, squares: move === null ? [] : [move.from] };
  }
  if (level === 2) {
    return { level: 2, squares: move === null ? [] : [move.to] };
  }
  return {
    level: 3,
    squares: move === null ? [] : [move.from, move.to],
    ...(move === null ? {} : { move }),
  };
}

/** Advances the hint ladder by one level (capped at 3) and returns the hint for that level. */
export function requestHint(
  state: ExerciseState,
  rules: VariantRules,
): { readonly state: ExerciseState; readonly hint: Hint } {
  const level = (state.hintLevel < 3 ? state.hintLevel + 1 : 3) as 1 | 2 | 3;
  const hint =
    state.def.type === 'select-squares'
      ? selectSquaresHint(state, state.def, rules, level)
      : moveHint(state, rules, level);
  return { state: { ...state, hintLevel: level }, hint };
}

function capMoveStars(base: 1 | 2 | 3, hintLevel: 0 | 1 | 2 | 3): 1 | 2 | 3 {
  if (hintLevel === 3) {
    return 1;
  }
  if (hintLevel >= 1) {
    return base === 3 ? 2 : base;
  }
  return base;
}

function selectSquaresStars(hintLevel: 0 | 1 | 2 | 3, errors: number): 1 | 2 | 3 {
  if (hintLevel === 3) {
    return 1;
  }
  if (hintLevel === 0 && errors === 0) {
    return 3;
  }
  if (hintLevel <= 1 && errors <= 1) {
    return 2;
  }
  return 1;
}

/** Stars earned so far; `0` until solved. */
export function starsFor(state: ExerciseState): 0 | 1 | 2 | 3 {
  if (!state.solved) {
    return 0;
  }
  if (state.def.type === 'select-squares') {
    return selectSquaresStars(state.hintLevel, state.errors);
  }
  const base: 1 | 2 | 3 =
    state.moves <= state.def.stars3 ? 3 : state.moves <= state.def.stars2 ? 2 : 1;
  return capMoveStars(base, state.hintLevel);
}
