// The chess `SubjectWeb` pack (docs/refactor-v4.md §11) — temporary home until m8.18 moves it to
// `subject-chess/src/web`. Every platform-bound module reaches chess only through this file.
import { chessCore, isInCheck, kingSquare } from '@chess-kids/core/chess';
import type { BotPlayer, Position, Square } from '@chess-kids/core/chess';
import { createWorkerBotPlayer } from './adapters/bot/worker-bot-player.ts';
import { useAppStore } from './app/store.ts';
import type { SubjectServices, SubjectWeb, SurfaceContext } from './app/subject.ts';
import { EXERCISE_KIND_UI } from './kinds/ui-registry.ts';
import { CharacterBadge, SurfaceDemo, SurfaceStory } from './surface.tsx';
import { isClassicOnlyContext, showPieceBadges } from './ui/board/piece-style.ts';

declare module './app/subject.ts' {
  interface SubjectServices {
    readonly botPlayer: BotPlayer;
  }
}

function createChessServices(): SubjectServices {
  return { botPlayer: createWorkerBotPlayer() };
}

export const chessWeb = {
  core: chessCore,
  createServices: createChessServices,
  kinds: EXERCISE_KIND_UI,
  surface: { Story: SurfaceStory, Demo: SurfaceDemo },
  CharacterBadge,
} satisfies SubjectWeb;

/** The checked king's square right now, if any (Board's check ring, every exercise kind). */
export function checkSquareFor(position: Position): Square | undefined {
  return isInCheck(position, chessCore.context.chess)
    ? kingSquare(position, position.toMove)
    : undefined;
}

/** Animal-badge piece look (`board/piece-style.ts`) for a surface: `null` (a review task) is
 * always plain; otherwise the active profile's piece-style setting, minus classic-only contexts
 * (World 5, a full game). */
export function useSurfacePieceBadges(surface: SurfaceContext): boolean {
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  if (surface.worldId === null) return false;
  return showPieceBadges(pieceStyle, isClassicOnlyContext({ worldId: surface.worldId }));
}
