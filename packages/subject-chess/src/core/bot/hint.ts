import type { ChessRules } from '../chess/rules.ts';
import type { Square } from '../chess/types.ts';
import type { GameState } from '../game/types.ts';
import { searchBestMove } from './search.ts';

/** Kid moves with no result before Owl offers a mate hint (docs/computer-opponent.md §6). */
export const MATE_HINT_AFTER_MOVES = 60;

/** The piece square and target square of the hinted move (Board's `highlights.hint`). */
export interface MateHint {
  readonly from: Square;
  readonly to: Square;
}

export function shouldOfferMateHint(kidMoveCount: number): boolean {
  return kidMoveCount >= MATE_HINT_AFTER_MOVES;
}

/** Search depth for the mate hint (docs/computer-opponent.md §6): shallow — a nudge, not a solver. */
const MATE_HINT_DEPTH = 2;

/** Owl's mate hint: the best move for the side to move (the kid; offered only on their turn) by a depth-2 search; `null`
 * only with no legal move. */
export function mateHint(state: GameState, rules: ChessRules): MateHint | null {
  const move = searchBestMove(state, rules, MATE_HINT_DEPTH);
  return move === null ? null : { from: move.from, to: move.to };
}
