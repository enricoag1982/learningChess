import type { Position } from '../types.ts';
import { toFen } from '../fen.ts';

export const STANDARD_START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

/** True if `position`'s board is the standard starting array ("a game from scratch"), shared by the versus / full-game classification and badge facts. */
export function isStandardStart(position: Position): boolean {
  return toFen(position).split(' ')[0] === STANDARD_START_BOARD;
}
