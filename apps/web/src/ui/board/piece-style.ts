import type { PieceStyleSetting } from '@chess-kids/core';
import type { Position } from '@chess-kids/core/chess';
import { toFen } from '@chess-kids/core/chess';

/** World 5's id (`packages/content/tracks.yaml`, order 5, "Full Rules"): its lessons always show
 * classic pieces, no animal badge (docs/app-structure.md "Piece look on board"). */
const WORLD_FIVE_ID = 'rules';

/** Standard chess start position's board part of its FEN, duplicated from `app/minigames.ts`'s own
 * (private) comparison since this is a UI-only display decision. */
const STANDARD_START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

export function isWorldFive(worldId: string): boolean {
  return worldId === WORLD_FIVE_ID;
}

function isStandardStartPosition(position: Position): boolean {
  return toFen(position).split(' ')[0] === STANDARD_START_BOARD;
}

/** "World 5 lessons and full games show classic pieces only" (docs/app-structure.md): a "full
 * game" is a standard chess game (kings, standard start position). */
export function isClassicOnlyContext(input: {
  readonly worldId?: string;
  readonly kings?: boolean;
  readonly position?: Position;
}): boolean {
  if (input.worldId !== undefined && isWorldFive(input.worldId)) return true;
  if (input.kings === true && input.position !== undefined) {
    return isStandardStartPosition(input.position);
  }
  return false;
}

/** Effective board piece look (docs/app-structure.md): `'classic'` forces classic pieces
 * everywhere; `'animal'` (default) shows the badge except in a classic-only context. */
export function showPieceBadges(pieceStyle: PieceStyleSetting, classicOnly: boolean): boolean {
  return pieceStyle === 'animal' && !classicOnly;
}
