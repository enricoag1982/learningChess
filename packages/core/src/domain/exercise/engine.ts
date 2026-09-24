import type { Move, MoveInput } from '../chess/rules.ts';
import { SQUARES } from '../chess/types.ts';
import type { Color, Piece, PieceType, Position, Square } from '../chess/types.ts';
import type { VariantRules } from '../variant/rules.ts';
import { applyKidMove } from './apply-move.ts';
import { solve } from './solver.ts';
import type { BestMoveDef, ChoiceDef, ExerciseDef, SelectSquaresDef, SetupDef } from './types.ts';

/** Immutable exercise progress. */
export interface ExerciseState {
  readonly def: ExerciseDef;
  /** Current position. */
  readonly position: Position;
  /** Positions before each played move, for `undo`. */
  readonly history: readonly Position[];
  /** Kid moves played (collect-stars / capture / best-move only). */
  readonly moves: number;
  /** Currently selected squares (select-squares only). */
  readonly selected: readonly Square[];
  /** Wrong submissions / illegal move attempts / wrong answers. */
  readonly errors: number;
  readonly hintLevel: 0 | 1 | 2 | 3;
  readonly solved: boolean;
  /**
   * Option ids ruled out for a `choice` exercise (wrong pick or hint-removed); disabled in UI.
   * Optional (defaults to none) so existing `ExerciseState` literals elsewhere stay valid.
   */
  readonly wrongOptions?: readonly string[];
}

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

/** Result of a select-squares submission. */
export interface SelectionResult {
  readonly correct: boolean;
  /** Count of answer squares not selected. */
  readonly missing: number;
  /** Selected squares that are not part of the answer. */
  readonly wrong: readonly Square[];
}

/** Result of a `setup` placement attempt. */
export interface PlaceOutcome {
  readonly kind: 'placed' | 'wrong' | 'solved';
  readonly square: Square;
  readonly piece: Piece;
}

/** One remaining piece in a `setup` exercise's palette. */
export interface PalettePiece {
  readonly color: Color;
  readonly type: PieceType;
  readonly count: number;
}

/** One step of the hint ladder; shape depends on the exercise type. */
export type Hint =
  /** select-squares / collect-stars / capture / best-move: piece → target square(s) → the move. */
  | {
      readonly kind: 'squares';
      readonly level: 1 | 2 | 3;
      readonly squares: readonly Square[];
      readonly move?: { readonly from: Square; readonly to: Square };
    }
  | {
      readonly kind: 'yes-no';
      readonly level: 1 | 2 | 3;
      readonly squares: readonly Square[];
      /** Level 3 only: reveal the correct answer. */
      readonly reveal: boolean;
    }
  | {
      readonly kind: 'choice';
      readonly level: 1 | 2 | 3;
      /** Levels 1–2: one more wrong option ruled out, if any is left. */
      readonly removedOptionId?: string;
      /** Level 3 only: reveal the correct option. */
      readonly reveal: boolean;
    }
  | {
      readonly kind: 'setup';
      readonly level: 1 | 2 | 3;
      readonly piece?: Piece;
      readonly square?: Square;
      /** Level 3 only: the piece was placed for the kid. */
      readonly placed: boolean;
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
    wrongOptions: [],
  };
}

const NON_MOVE_TYPES = new Set<ExerciseDef['type']>([
  'select-squares',
  'yes-no',
  'choice',
  'setup',
]);

/** Legal kid moves right now (collect-stars / capture / best-move only; `[]` otherwise or once solved). */
export function exerciseMoves(state: ExerciseState, rules: VariantRules, from?: Square): Move[] {
  if (state.solved || NON_MOVE_TYPES.has(state.def.type)) {
    return [];
  }
  return rules.legalMoves(state.position, { staticOpponent: true }, from);
}

function isCaptureSolved(position: Position, kidColor: Position['toMove']): boolean {
  return !Object.values(position.pieces).some((piece) => piece.color !== kidColor);
}

/** Strips a trailing check/mate mark so SAN comparisons ignore it (`Qh5+` vs `Qh5`). */
function normalizeSan(san: string): string {
  return san.replace(/[+#]+$/, '');
}

function isSolutionMove(solutions: readonly string[], san: string): boolean {
  const normalized = normalizeSan(san);
  return solutions.some((solution) => normalizeSan(solution) === normalized);
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

/** Answers a yes-no exercise. Correct → solved; wrong → errors + 1. No-op once solved. */
export function answerYesNo(state: ExerciseState, value: boolean): ExerciseState {
  if (state.def.type !== 'yes-no') {
    throw new Error('answerYesNo: exercise is not yes-no');
  }
  if (state.solved) {
    return state;
  }
  if (value === state.def.answer) {
    return { ...state, solved: true };
  }
  return { ...state, errors: state.errors + 1 };
}

/**
 * Picks an option for a choice exercise. Correct → solved; wrong → errors + 1 and the option is
 * added to `wrongOptions` (disabled in the UI). No-op once solved.
 */
export function answerChoice(state: ExerciseState, optionId: string): ExerciseState {
  if (state.def.type !== 'choice') {
    throw new Error('answerChoice: exercise is not choice');
  }
  if (state.solved) {
    return state;
  }
  if (optionId === state.def.answer) {
    return { ...state, solved: true };
  }
  const current = state.wrongOptions ?? [];
  const wrongOptions = current.includes(optionId) ? current : [...current, optionId];
  return { ...state, errors: state.errors + 1, wrongOptions };
}

/** True when both piece maps hold exactly the same pieces on the same squares. */
function piecesMatch(a: Position['pieces'], b: Position['pieces']): boolean {
  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);
  if (aEntries.length !== bEntries.length) {
    return false;
  }
  return aEntries.every(([square, piece]) => {
    const other = b[square as Square];
    return other !== undefined && other.color === piece.color && other.type === piece.type;
  });
}

/** Setup exercise: target squares still missing their piece, in board reading order. */
function remainingSetupSquares(position: Position, target: Position): readonly Square[] {
  return SQUARES.filter(
    (square) => target.pieces[square] !== undefined && position.pieces[square] === undefined,
  );
}

/**
 * Places `piece` on `square` for a setup exercise: correct when `square` holds that exact piece in
 * `target` and is still free. Wrong → errors + 1, nothing placed. Solved once every target piece is
 * on the board. No-op (outcome `wrong`) once solved.
 */
export function placePiece(
  state: ExerciseState,
  square: Square,
  piece: Piece,
): { readonly state: ExerciseState; readonly outcome: PlaceOutcome } {
  if (state.def.type !== 'setup') {
    throw new Error('placePiece: exercise is not setup');
  }
  if (state.solved) {
    return { state, outcome: { kind: 'wrong', square, piece } };
  }

  const targetPiece = state.def.target.pieces[square];
  const isCorrect =
    targetPiece !== undefined &&
    targetPiece.color === piece.color &&
    targetPiece.type === piece.type &&
    state.position.pieces[square] === undefined;

  if (!isCorrect) {
    return {
      state: { ...state, errors: state.errors + 1 },
      outcome: { kind: 'wrong', square, piece },
    };
  }

  const pieces = { ...state.position.pieces, [square]: piece };
  const position: Position = { ...state.position, pieces };
  const solved = piecesMatch(pieces, state.def.target.pieces);
  return {
    state: { ...state, position, solved },
    outcome: { kind: solved ? 'solved' : 'placed', square, piece },
  };
}

/** Remaining setup pieces, grouped by colour + type with counts, in board reading order. */
export function setupPalette(state: ExerciseState): readonly PalettePiece[] {
  if (state.def.type !== 'setup') {
    throw new Error('setupPalette: exercise is not setup');
  }
  const def = state.def;
  const counts = new Map<string, PalettePiece>();
  for (const square of remainingSetupSquares(state.position, def.target)) {
    const piece = def.target.pieces[square];
    if (piece === undefined) {
      continue;
    }
    const key = `${piece.color}${piece.type}`;
    const existing = counts.get(key);
    counts.set(key, { color: piece.color, type: piece.type, count: (existing?.count ?? 0) + 1 });
  }
  return [...counts.values()];
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

function selectSquaresHint(
  state: ExerciseState,
  def: SelectSquaresDef,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const answer = answerSquares(def, rules);
  if (level === 1) {
    const from = 'derive' in def.answer ? [def.answer.from] : [];
    return { kind: 'squares', level: 1, squares: from };
  }
  if (level === 2) {
    const next = answer.find((square) => !state.selected.includes(square));
    return { kind: 'squares', level: 2, squares: next === undefined ? [] : [next] };
  }
  return { kind: 'squares', level: 3, squares: answer };
}

function moveHint(state: ExerciseState, rules: VariantRules, level: 1 | 2 | 3): Hint {
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

/** Best-move hint: piece → target square → the move, all from the first listed solution. */
function bestMoveHint(
  def: BestMoveDef,
  position: Position,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const solutionSan = def.solutions[0];
  const candidates = rules.legalMoves(position, { staticOpponent: true });
  const move =
    solutionSan === undefined
      ? undefined
      : candidates.find((candidate) => normalizeSan(candidate.san) === normalizeSan(solutionSan));
  if (level === 1) {
    return { kind: 'squares', level: 1, squares: move === undefined ? [] : [move.from] };
  }
  if (level === 2) {
    return { kind: 'squares', level: 2, squares: move === undefined ? [] : [move.to] };
  }
  return {
    kind: 'squares',
    level: 3,
    squares: move === undefined ? [] : [move.from, move.to],
    ...(move === undefined ? {} : { move: { from: move.from, to: move.to } }),
  };
}

function yesNoHint(def: { readonly focus?: Square }, level: 1 | 2 | 3): Hint {
  const squares = def.focus === undefined ? [] : [def.focus];
  if (level === 1) {
    return { kind: 'yes-no', level: 1, squares, reveal: false };
  }
  if (level === 2) {
    return { kind: 'yes-no', level: 2, squares: [], reveal: false };
  }
  return { kind: 'yes-no', level: 3, squares, reveal: true };
}

function choiceHint(
  state: ExerciseState,
  def: ChoiceDef,
  level: 1 | 2 | 3,
): { readonly state: ExerciseState; readonly hint: Hint } {
  if (level === 3) {
    return { state, hint: { kind: 'choice', level: 3, reveal: true } };
  }
  const current = state.wrongOptions ?? [];
  const removedOptionId = def.options
    .map((option) => option.id)
    .find((id) => id !== def.answer && !current.includes(id));
  const nextState =
    removedOptionId === undefined
      ? state
      : { ...state, wrongOptions: [...current, removedOptionId] };
  return {
    state: nextState,
    hint: {
      kind: 'choice',
      level,
      reveal: false,
      ...(removedOptionId === undefined ? {} : { removedOptionId }),
    },
  };
}

function setupHint(
  state: ExerciseState,
  def: SetupDef,
  level: 1 | 2 | 3,
): { readonly state: ExerciseState; readonly hint: Hint } {
  const square = remainingSetupSquares(state.position, def.target)[0];
  const piece = square === undefined ? undefined : def.target.pieces[square];

  if (level === 1 || piece === undefined || square === undefined) {
    return {
      state,
      hint: { kind: 'setup', level, placed: false, ...(piece === undefined ? {} : { piece }) },
    };
  }
  if (level === 2) {
    return { state, hint: { kind: 'setup', level: 2, piece, square, placed: false } };
  }
  const placed = placePiece(state, square, piece);
  return { state: placed.state, hint: { kind: 'setup', level: 3, piece, square, placed: true } };
}

/** Advances the hint ladder by one level (capped at 3) and returns the hint for that level. */
export function requestHint(
  state: ExerciseState,
  rules: VariantRules,
): { readonly state: ExerciseState; readonly hint: Hint } {
  const level = (state.hintLevel < 3 ? state.hintLevel + 1 : 3) as 1 | 2 | 3;
  const bumped: ExerciseState = { ...state, hintLevel: level };

  if (bumped.def.type === 'select-squares') {
    return { state: bumped, hint: selectSquaresHint(state, bumped.def, rules, level) };
  }
  if (bumped.def.type === 'best-move') {
    return { state: bumped, hint: bestMoveHint(bumped.def, bumped.position, rules, level) };
  }
  if (bumped.def.type === 'yes-no') {
    return { state: bumped, hint: yesNoHint(bumped.def, level) };
  }
  if (bumped.def.type === 'choice') {
    return choiceHint(bumped, bumped.def, level);
  }
  if (bumped.def.type === 'setup') {
    return setupHint(bumped, bumped.def, level);
  }
  return { state: bumped, hint: moveHint(state, rules, level) };
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

/** Stars from errors + hint level: 3 clean, 2 with ≤1 error or ≤1 hint level, else 1. */
function errorHintStars(hintLevel: 0 | 1 | 2 | 3, errors: number): 1 | 2 | 3 {
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

/** Stars for a `setup` exercise: more errors tolerated (placing many pieces invites slips). */
function setupStars(hintLevel: 0 | 1 | 2 | 3, errors: number): 1 | 2 | 3 {
  if (hintLevel === 3) {
    return 1;
  }
  if (hintLevel === 0 && errors === 0) {
    return 3;
  }
  if (hintLevel <= 1 && errors <= 2) {
    return 2;
  }
  return 1;
}

/** Stars earned so far; `0` until solved. */
export function starsFor(state: ExerciseState): 0 | 1 | 2 | 3 {
  if (!state.solved) {
    return 0;
  }
  if (
    state.def.type === 'select-squares' ||
    state.def.type === 'yes-no' ||
    state.def.type === 'choice' ||
    state.def.type === 'best-move'
  ) {
    return errorHintStars(state.hintLevel, state.errors);
  }
  if (state.def.type === 'setup') {
    return setupStars(state.hintLevel, state.errors);
  }
  const base: 1 | 2 | 3 =
    state.moves <= state.def.stars3 ? 3 : state.moves <= state.def.stars2 ? 2 : 1;
  return capMoveStars(base, state.hintLevel);
}
