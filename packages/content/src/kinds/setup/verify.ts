import { piecesEqual, type SetupDef, type Square } from '@chess-kids/core';

/** The start position's every piece is part of the target, the target uses no markers, and the
 * target actually differs from the start (otherwise there is nothing to place). */
export function verify(exercise: SetupDef, where: string, issues: string[]): void {
  const { position, target } = exercise;
  if (target.markers.stars.length > 0 || target.markers.blocked.length > 0) {
    issues.push(`${where}: setup target must not use star or blocked markers`);
  }
  for (const [square, piece] of Object.entries(position.pieces)) {
    const targetPiece = target.pieces[square as Square];
    if (
      targetPiece === undefined ||
      targetPiece.color !== piece.color ||
      targetPiece.type !== piece.type
    ) {
      issues.push(`${where}: start piece at ${square} is not part of the target`);
    }
  }
  if (piecesEqual(position.pieces, target.pieces)) {
    issues.push(`${where}: setup target is the same as the start position`);
  }
}
