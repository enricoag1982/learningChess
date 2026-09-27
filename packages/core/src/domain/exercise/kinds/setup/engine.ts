import { SQUARES } from '../../../chess/types.ts';
import type { Piece, Position, Square } from '../../../chess/types.ts';
import { piecesEqual } from '../../../chess/facts/pieces.ts';
import type { ExerciseStateOf } from '../../state.ts';
import type { Hint } from '../../hint.ts';
import type { PalettePiece, PlaceOutcome, SetupDef } from './kind.ts';

/** Setup exercise: target squares still missing their piece, in board reading order. */
export function remainingSetupSquares(position: Position, target: Position): readonly Square[] {
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
  state: ExerciseStateOf<SetupDef>,
  square: Square,
  piece: Piece,
): { readonly state: ExerciseStateOf<SetupDef>; readonly outcome: PlaceOutcome } {
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
export function setupPalette(state: ExerciseStateOf<SetupDef>): readonly PalettePiece[] {
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

export function setupHint(
  state: ExerciseStateOf<SetupDef>,
  def: SetupDef,
  level: 1 | 2 | 3,
): { readonly state: ExerciseStateOf<SetupDef>; readonly hint: Hint } {
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

/** Stars for a `setup` exercise: more errors tolerated (placing many pieces invites slips). */
export function setupStars(hintLevel: 0 | 1 | 2 | 3, errors: number): 1 | 2 | 3 {
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
