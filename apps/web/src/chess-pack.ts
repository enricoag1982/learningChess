// The chess `SubjectWeb` pack (docs/refactor-v4.md §11) — temporary home until m8.18 moves it to
// `subject-chess/src/web`. Every platform-bound module reaches chess only through this file.
import { lazy } from 'react';
import { CHESS_APP_CONFIG, chessCore, isInCheck, kingSquare } from '@chess-kids/core/chess';
import type { BotPlayer, Position, Square } from '@chess-kids/core/chess';
import { createWorkerBotPlayer } from './adapters/bot/worker-bot-player.ts';
import { useAppStore } from './app/store.ts';
import type {
  SubjectRouteEntry,
  SubjectServices,
  SubjectWeb,
  SurfaceContext,
} from './app/subject.ts';
import { createPlaySlice, type PlaySlice } from './app/slices/play.ts';
import { HOME_TILES } from './home-tiles.ts';
import { EXERCISE_KIND_UI } from './kinds/ui-registry.ts';
import { CharacterBadge, Stats, SurfaceDemo, SurfaceStory } from './surface.tsx';
import { isClassicOnlyContext, showPieceBadges } from './ui/board/piece-style.ts';
import { PlayScreen } from './ui/PlayScreen.tsx';
import { FullGameScreen } from './ui/FullGameScreen.tsx';

export { CHESS_APP_CONFIG };

const FriendSetupScreen = lazy(() =>
  import('./ui/FriendSetupScreen.tsx').then((module) => ({ default: module.FriendSetupScreen })),
);
const FriendGameScreen = lazy(() =>
  import('./ui/FriendGameScreen.tsx').then((module) => ({ default: module.FriendGameScreen })),
);

/** Unicode glyph per rank id (they are exactly the six piece words: pawn .. king). */
const RANK_GLYPH: Readonly<Record<string, string>> = {
  pawn: '♙',
  knight: '♘',
  bishop: '♗',
  rook: '♖',
  queen: '♕',
  king: '♔',
};

declare module './app/subject.ts' {
  interface SubjectServices {
    readonly botPlayer: BotPlayer;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmentation via `extends`, not a type alias, so declaration merging still applies
  interface SubjectState extends PlaySlice {}
}

declare module './app/routes.ts' {
  interface SubjectRoutes {
    // eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type -- deliberately empty: no extra route params
    play: Record<never, never>;
    'full-game': { readonly level: 1 | 2 | 3 | 4 | 5 };
    // eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type -- deliberately empty: no extra route params
    'friend-setup': Record<never, never>;
    // eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type -- deliberately empty: no extra route params
    'friend-game': Record<never, never>;
  }
}

function createChessServices(): SubjectServices {
  return { botPlayer: createWorkerBotPlayer() };
}

const CHESS_ROUTES: Readonly<Record<string, SubjectRouteEntry>> = {
  play: { screen: PlayScreen, meta: { tracked: true, calm: true } },
  'full-game': {
    screen: FullGameScreen,
    meta: { tracked: true, gated: true },
    // Clears a stale "Ready for the Fox?" suggestion from an earlier full game.
    onEnter: (set) => {
      set({ levelUpSuggestion: null });
    },
  },
  'friend-setup': { screen: FriendSetupScreen, meta: { tracked: true } },
  'friend-game': { screen: FriendGameScreen, meta: { tracked: true, gated: true } },
};

export const chessWeb = {
  core: chessCore,
  createServices: createChessServices,
  kinds: EXERCISE_KIND_UI,
  surface: { Story: SurfaceStory, Demo: SurfaceDemo },
  CharacterBadge,
  homeTiles: HOME_TILES,
  den: { rankGlyph: (rankId) => RANK_GLYPH[rankId] ?? '?', Stats },
  loadParent: () => import('./parent-panels.tsx'),
  routes: CHESS_ROUTES,
  createSlice: createPlaySlice,
  homeReset: { levelUpSuggestion: null },
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
