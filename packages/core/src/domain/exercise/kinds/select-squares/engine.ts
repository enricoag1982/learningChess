import { SQUARES } from '../../../chess/types.ts';
import type { Square } from '../../../chess/types.ts';
import { kingSquare } from '../../../chess/facts/pieces.ts';
import type { VariantRules } from '../../../variant/rules.ts';
import type { ExerciseStateOf } from '../../state.ts';
import type { Hint } from '../../hint.ts';
import type { SelectionResult, SelectSquaresDef } from './kind.ts';

/** Adds or removes a square from the current selection (select-squares). No-op once solved. */
export function toggleSquare(
  state: ExerciseStateOf<SelectSquaresDef>,
  square: Square,
): ExerciseStateOf<SelectSquaresDef> {
  if (state.solved) {
    return state;
  }
  const selected = state.selected.includes(square)
    ? state.selected.filter((s) => s !== square)
    : [...state.selected, square];
  return { ...state, selected };
}

/** Resolves a select-squares exercise's answer squares. */
export function selectSquaresAnswer(def: SelectSquaresDef, rules: VariantRules): readonly Square[] {
  if ('squares' in def.answer) {
    return def.answer.squares;
  }
  if (def.answer.derive === 'legal-moves') {
    // A promoting pawn's legal moves include one entry per promotion piece, all sharing the same
    // `to` (e.g. 4 pushes to d8): de-duplicated, or toggling that square an even number of times
    // would end it unselected instead of selected.
    const targets = rules
      .legalMoves(def.position, { staticOpponent: true }, def.answer.from)
      .map((move) => move.to);
    return [...new Set(targets)];
  }
  if (def.answer.derive === 'attacked-by') {
    const { from } = def.answer;
    const piece = def.position.pieces[from];
    if (piece === undefined) return [];
    return SQUARES.filter((square) =>
      rules.attackers(def.position, square, piece.color).includes(from),
    );
  }
  // check-escapes: every square the side to move's king can legally move to.
  const king = kingSquare(def.position, def.position.toMove);
  if (king === undefined) return [];
  const targets = rules
    .legalMoves(def.position, { staticOpponent: true }, king)
    .map((move) => move.to);
  return [...new Set(targets)];
}

/** Checks the current selection against the answer (select-squares). */
export function submitSelection(
  state: ExerciseStateOf<SelectSquaresDef>,
  rules: VariantRules,
): { readonly state: ExerciseStateOf<SelectSquaresDef>; readonly result: SelectionResult } {
  const answer = selectSquaresAnswer(state.def, rules);
  const wrong = state.selected.filter((square) => !answer.includes(square));
  const missingSquares = answer.filter((square) => !state.selected.includes(square));
  const missing = missingSquares.length;
  const correct = wrong.length === 0 && missing === 0;

  const nextState = correct ? { ...state, solved: true } : { ...state, errors: state.errors + 1 };
  return { state: nextState, result: { correct, missing, missingSquares, wrong } };
}

export function selectSquaresHint(
  state: ExerciseStateOf<SelectSquaresDef>,
  def: SelectSquaresDef,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const answer = selectSquaresAnswer(def, rules);
  if (level === 1) {
    const from =
      'derive' in def.answer
        ? def.answer.derive === 'check-escapes'
          ? kingSquare(def.position, def.position.toMove)
          : def.answer.from
        : undefined;
    return { kind: 'squares', level: 1, squares: from === undefined ? [] : [from] };
  }
  if (level === 2) {
    const next = answer.find((square) => !state.selected.includes(square));
    return { kind: 'squares', level: 2, squares: next === undefined ? [] : [next] };
  }
  return { kind: 'squares', level: 3, squares: answer };
}
