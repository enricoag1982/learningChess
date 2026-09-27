import type { Position } from '../types.ts';
import { toFen } from '../fen.ts';

/** Board part of the standard chess starting position's FEN (any side to move / castling rights). */
const STANDARD_START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

/** True if `position`'s board is the standard starting array — "was this really a game from
 * scratch", shared by the versus-mini-game-vs-full-game classification and badge facts (was 3
 * separate copies of the same FEN literal). */
export function isStandardStart(position: Position): boolean {
  return toFen(position).split(' ')[0] === STANDARD_START_BOARD;
}
