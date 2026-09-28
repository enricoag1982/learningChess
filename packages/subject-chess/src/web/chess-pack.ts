// The chess `SubjectWeb` pack (docs/refactor-v4.md §11): everything the platform reaches of chess.
import { createElement, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { chessCore, isInCheck, kingSquare } from '../chess.ts';
import type { BotPlayer, ExerciseState, Position, Square } from '../chess.ts';
import { createWorkerBotPlayer } from './adapters/bot/worker-bot-player.ts';
import { createBundledContentSource } from './adapters/content/bundled-content-source.ts';
import { useAppStore } from '@learn/platform-web/app/store.ts';
import type {
  SubjectRouteEntry,
  SubjectWeb,
  SurfaceContext,
} from '@learn/platform-web/app/subject.ts';
import { createPlaySlice, type PlaySlice } from './slices/play.ts';
import { HOME_TILES } from './home-tiles.ts';
import { EXERCISE_KIND_UI } from './kinds/ui-registry.ts';
import { MINI_GAME_MODE_UI } from './modes/ui-registry.ts';
import { CharacterBadge, Stats, SurfaceDemo, SurfaceStory } from './surface.tsx';
import { ANIMAL_IMAGES } from '@learn/platform-web/ui/art/animal-images.ts';
import { Board } from './ui/board/Board.tsx';
import { isClassicOnlyContext, showPieceBadges } from './ui/board/piece-style.ts';
import { PlayScreen } from './ui/PlayScreen.tsx';
import { FullGameScreen } from './ui/FullGameScreen.tsx';

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

declare module '@learn/platform-web/app/subject.ts' {
  interface SubjectServices {
    readonly botPlayer: BotPlayer;
    /** Chess's own concrete `ContentSource`; chess code reads content only through this. */
    readonly content: ReturnType<typeof createBundledContentSource>;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmentation via `extends`, not a type alias, so declaration merging still applies
  interface SubjectState extends PlaySlice {}
}

declare module '@learn/platform-web/app/routes.ts' {
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

function createChessServices() {
  const content = createBundledContentSource();
  return { content, subject: { botPlayer: createWorkerBotPlayer(), content } };
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
  modes: MINI_GAME_MODE_UI,
  surface: { Story: SurfaceStory, Demo: SurfaceDemo, View: SurfaceView },
  CharacterBadge,
  art: ANIMAL_IMAGES,
  homeTiles: HOME_TILES,
  den: { rankGlyph: (rankId) => RANK_GLYPH[rankId] ?? '?', Stats },
  loadParent: () => import('./parent-panels.tsx'),
  routes: CHESS_ROUTES,
  createSlice: createPlaySlice,
  homeReset: { levelUpSuggestion: null },
  // Gated on the compile-time DEV flag (not just main.tsx's own check) so Rollup drops the whole
  // dev-playground subtree from the production graph — an ungated `dev` field, even unread, keeps
  // its two `import()` calls as live split points and grows the initial bundle.
  dev: import.meta.env.DEV
    ? {
        '#board': () => import('./dev/BoardPlayground.tsx').then((m) => m.BoardPlayground),
        '#exercises': () =>
          import('./dev/ExercisePlayground.tsx').then((m) => m.ExercisePlayground),
      }
    : undefined,
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

/** A finished round's final board, plain (a `series` boss's closing screen). */
function SurfaceView({ state, surface }: { state: ExerciseState; surface: SurfaceContext }) {
  const { t } = useTranslation();
  return createElement(Board, {
    position: state.position,
    legalMoves: [],
    label: t('lesson.board-label'),
    pieceBadges: useSurfacePieceBadges(surface),
  });
}
