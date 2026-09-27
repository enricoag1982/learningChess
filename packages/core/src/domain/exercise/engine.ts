import type { ChessRules, Move, MoveInput } from '../chess/rules.ts';
import { SQUARES } from '../chess/types.ts';
import type { Color, Piece, PieceType, Position, Square } from '../chess/types.ts';
import { enemyCount } from '../chess/facts/goals.ts';
import { piecesEqual } from '../chess/facts/pieces.ts';
import { findMoveBySan, sameSan } from '../chess/facts/san.ts';
import type { VariantRules } from '../variant/rules.ts';
import { applyKidMove } from './apply-move.ts';
import type { Hint } from './hint.ts';
import { choiceHint } from './kinds/choice/engine.ts';
import { selectSquaresHint } from './kinds/select-squares/engine.ts';
import { yesNoHint } from './kinds/yes-no/engine.ts';
import { solve } from './solver.ts';
import type { ExerciseStateOf } from './state.ts';
import { errorHintStars } from './stars.ts';
import type { BestMoveDef, ExerciseDef, MateInNDef, SetupDef } from './types.ts';

/** Immutable exercise progress; public shape unchanged (`def`'s own type is `ExerciseDef` here). */
export type ExerciseState = ExerciseStateOf<ExerciseDef>;

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

/** Result of a `setup` placement attempt. */
export interface PlaceOutcome {
  readonly kind: 'placed' | 'wrong' | 'solved';
  readonly square: Square;
  readonly piece: Piece;
}

/** Result of a kid move in a `mate-in-n` exercise. */
export type MateInNOutcome =
  | { readonly kind: 'illegal' }
  /** A legal move that neither mates nor matches the scripted line for this ply. Position unchanged. */
  | { readonly kind: 'wrong'; readonly move: Move }
  /** The scripted kid move was played and its scripted opponent reply was applied too. */
  | { readonly kind: 'moved'; readonly move: Move; readonly reply: Move }
  /** Delivered checkmate — any mating move, not only the scripted one. */
  | { readonly kind: 'solved'; readonly move: Move };

/** One remaining piece in a `setup` exercise's palette. */
export interface PalettePiece {
  readonly color: Color;
  readonly type: PieceType;
  readonly count: number;
}

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

/** Legal kid moves right now (collect-stars / capture / best-move / mate-in-n only; `[]` otherwise or once solved). */
export function exerciseMoves(state: ExerciseState, rules: VariantRules, from?: Square): Move[] {
  if (state.solved || NON_MOVE_TYPES.has(state.def.type)) {
    return [];
  }
  return rules.legalMoves(state.position, { staticOpponent: true }, from);
}

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

export {
  toggleSquare,
  selectSquaresAnswer,
  submitSelection,
} from './kinds/select-squares/engine.ts';
export { answerYesNo } from './kinds/yes-no/engine.ts';
export { answerChoice } from './kinds/choice/engine.ts';

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
  const solved = piecesEqual(pieces, state.def.target.pieces);
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

/**
 * Plays a kid move for a `mate-in-n` exercise, under real chess rules (both kings, real turn
 * alternation — never a static opponent, unlike every other move-playing exercise type). A move
 * that delivers checkmate always solves it, even when it is not the scripted one; otherwise the
 * move must match the scripted line for this ply, and its scripted opponent reply (if any) is
 * applied automatically so the kid's turn comes right back around. `undo` is not offered for this
 * type (like `best-move`).
 */
export function playMateInN(
  state: ExerciseState,
  rules: ChessRules,
  move: MoveInput,
): { readonly state: ExerciseState; readonly outcome: MateInNOutcome } {
  if (state.def.type !== 'mate-in-n') {
    throw new Error('playMateInN: exercise is not mate-in-n');
  }
  if (state.solved) {
    return { state, outcome: { kind: 'illegal' } };
  }
  const def = state.def;

  const played = rules.play(state.position, move);
  if (played === null) {
    return { state: { ...state, errors: state.errors + 1 }, outcome: { kind: 'illegal' } };
  }

  if (rules.status(played.position).checkmate) {
    const nextState: ExerciseState = {
      ...state,
      position: played.position,
      history: [...state.history, state.position],
      moves: state.moves + 1,
      solved: true,
    };
    return { state: nextState, outcome: { kind: 'solved', move: played.move } };
  }

  const plyIndex = state.history.length;
  const scriptedSan = def.line[plyIndex];
  if (scriptedSan === undefined || !sameSan(played.move.san, scriptedSan)) {
    return {
      state: { ...state, errors: state.errors + 1 },
      outcome: { kind: 'wrong', move: played.move },
    };
  }

  const replySan = def.line[plyIndex + 1];
  if (replySan === undefined) {
    // The content loader guarantees the line's last move always delivers checkmate; reaching here
    // means it did not, which is a content bug, not a kid error.
    throw new Error(`playMateInN: scripted final move "${scriptedSan}" did not deliver checkmate`);
  }
  const repliedPlay = rules.play(played.position, replySan);
  if (repliedPlay === null) {
    throw new Error(`playMateInN: scripted reply "${replySan}" is illegal`);
  }
  const nextState: ExerciseState = {
    ...state,
    position: repliedPlay.position,
    history: [...state.history, state.position, played.position],
    moves: state.moves + 2,
  };
  return {
    state: nextState,
    outcome: { kind: 'moved', move: played.move, reply: repliedPlay.move },
  };
}

function goalMove(state: ExerciseState, rules: VariantRules): { from: Square; to: Square } | null {
  const goal = state.def.type === 'collect-stars' ? 'collect-stars' : 'capture';
  const line = solve(state.position, rules, goal);
  return line?.[0] ?? null;
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
  const move = solutionSan === undefined ? undefined : findMoveBySan(candidates, solutionSan);
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

/** mate-in-n hint: piece → target square → the move, from the scripted line's move for this ply. */
function mateInNHint(
  state: ExerciseState,
  def: MateInNDef,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const san = def.line[state.history.length];
  const candidates = rules.legalMoves(state.position, { staticOpponent: true });
  const move = san === undefined ? undefined : findMoveBySan(candidates, san);
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
  if (bumped.def.type === 'mate-in-n') {
    return { state: bumped, hint: mateInNHint(state, bumped.def, rules, level) };
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
    state.def.type === 'best-move' ||
    state.def.type === 'mate-in-n'
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
