import { SQUARES } from '../../../chess/types.ts';
import type { PlaceAction, SetupDef } from './def.ts';

/** Every target piece still missing from `position`, placed in board reading order. */
export function setupSolution(def: SetupDef): readonly PlaceAction[] {
  const actions: PlaceAction[] = [];
  for (const square of SQUARES) {
    const piece = def.target.pieces[square];
    if (piece === undefined || def.position.pieces[square] !== undefined) {
      continue;
    }
    actions.push({ type: 'place', square, piece });
  }
  return actions;
}

/**
 * The first needed piece, placed on a square the target leaves empty: always wrong (a chess
 * position never fills all 64 squares), for exactly 1 error, nothing placed.
 */
export function setupWrongAction(def: SetupDef): readonly PlaceAction[] {
  const solution = setupSolution(def);
  const first = solution[0];
  if (first === undefined) {
    throw new Error(`setup "${def.id}": no piece to place`);
  }
  const emptySquare = SQUARES.find(
    (square) =>
      def.target.pieces[square] === undefined && def.position.pieces[square] === undefined,
  );
  if (emptySquare === undefined) {
    throw new Error(`setup "${def.id}": no square available for a wrong placement`);
  }
  return [{ type: 'place', square: emptySquare, piece: first.piece }];
}
