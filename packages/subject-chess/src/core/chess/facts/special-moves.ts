import type { Move } from '../rules.ts';
import type { Position, Square } from '../types.ts';
import { normalizeSan } from './san.ts';

export function castlingMoves(candidates: readonly Move[]): readonly Move[] {
  return candidates.filter((move) => {
    const san = normalizeSan(move.san);
    return san === 'O-O' || san === 'O-O-O';
  });
}

/** A pawn move landing on `position`'s en passant square is always an en passant capture (that square is otherwise empty, so
 * no ordinary pawn move ends there). */
export function enPassantMoves(candidates: readonly Move[], position: Position): readonly Move[] {
  return candidates.filter(
    (move) => move.piece === 'p' && move.captured !== undefined && move.to === position.enPassant,
  );
}

export function doubleStepBefore(ep: Square): { readonly from: Square; readonly to: Square } {
  const file = ep.charAt(0);
  const fromRank = ep.charAt(1) === '6' ? '7' : '2';
  const toRank = ep.charAt(1) === '6' ? '5' : '4';
  return { from: `${file}${fromRank}` as Square, to: `${file}${toRank}` as Square };
}
