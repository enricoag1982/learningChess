import type { PieceStyleSetting, Position } from '@chess-kids/core';
import { toFen } from '@chess-kids/core';

/** World 5's id (`packages/content/tracks.yaml`, order 5, "Full Rules"): its lessons always show
 * classic pieces, no animal badge (docs/app-structure.md "Piece look on board", M5.3). */
const WORLD_FIVE_ID = 'rules';

/** Standard chess start position's board part of its FEN — the same shape `app/minigames.ts`'s
 * own (private) `gameRecordId` compares against to tell a full game from a variant mini-game;
 * duplicated here since this is a UI-only display decision, not worth a core export for. */
const STANDARD_START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

export function isWorldFive(worldId: string): boolean {
  return worldId === WORLD_FIVE_ID;
}

function isStandardStartPosition(position: Position): boolean {
  return toFen(position).split(' ')[0] === STANDARD_START_BOARD;
}

/**
 * "World 5 lessons and full games show classic pieces only" (docs/app-structure.md): a lesson's
 * own `world` id, and/or a `versus` game's rules/position — a "full game" is a standard chess game
 * (kings on the board, standard start position), the same test `app/minigames.ts` uses to tell one
 * from a variant mini-game (Pawn Wars, Win the Queen, …) for `GameRecord.game`.
 */
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

/**
 * Effective board piece look (docs/app-structure.md "Piece look on board"; M5.1's `pieceStyle`
 * parent setting, applied here from M5.3): `'classic'` forces classic pieces everywhere, even in
 * Worlds 1-4 — an explicit parent override always wins. `'animal'` (the default) shows the animal
 * badge wherever content allows it, i.e. everywhere except a classic-only context (World 5, a full
 * game) — it does not force badges into those, since the "transfer to a real board" moment they
 * mark is a fixed design decision, not something the piece-style toggle should undo.
 */
export function showPieceBadges(pieceStyle: PieceStyleSetting, classicOnly: boolean): boolean {
  return pieceStyle === 'animal' && !classicOnly;
}
