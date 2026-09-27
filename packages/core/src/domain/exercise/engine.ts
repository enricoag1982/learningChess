import type { ChessRules, Move, MoveInput } from '../chess/rules.ts';
import type { Square } from '../chess/types.ts';
import { findMoveBySan, sameSan } from '../chess/facts/san.ts';
import type { VariantRules } from '../variant/rules.ts';
import type { Hint } from './hint.ts';
import { bestMoveHint } from './kinds/best-move/engine.ts';
import { choiceHint } from './kinds/choice/engine.ts';
import { selectSquaresHint } from './kinds/select-squares/engine.ts';
import { setupHint, setupStars } from './kinds/setup/engine.ts';
import { capMoveStars, moveHint } from './kinds/static-move.ts';
import { yesNoHint } from './kinds/yes-no/engine.ts';
import type { ExerciseStateOf } from './state.ts';
import { errorHintStars } from './stars.ts';
import type { ExerciseDef, MateInNDef } from './types.ts';

/** Immutable exercise progress; public shape unchanged (`def`'s own type is `ExerciseDef` here). */
export type ExerciseState = ExerciseStateOf<ExerciseDef>;

/** Result of a kid move in a `mate-in-n` exercise. */
export type MateInNOutcome =
  | { readonly kind: 'illegal' }
  /** A legal move that neither mates nor matches the scripted line for this ply. Position unchanged. */
  | { readonly kind: 'wrong'; readonly move: Move }
  /** The scripted kid move was played and its scripted opponent reply was applied too. */
  | { readonly kind: 'moved'; readonly move: Move; readonly reply: Move }
  /** Delivered checkmate — any mating move, not only the scripted one. */
  | { readonly kind: 'solved'; readonly move: Move };

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

export { playMove } from './kinds/static-move.ts';

export {
  toggleSquare,
  selectSquaresAnswer,
  submitSelection,
} from './kinds/select-squares/engine.ts';
export { answerYesNo } from './kinds/yes-no/engine.ts';
export { answerChoice } from './kinds/choice/engine.ts';

export { placePiece, setupPalette } from './kinds/setup/engine.ts';

export { undo } from './kinds/static-move.ts';

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
