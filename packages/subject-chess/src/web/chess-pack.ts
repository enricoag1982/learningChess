// The chess `SubjectWeb` pack (docs/refactor-v4.md §11): everything the platform reaches of chess.
import { createElement, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { CHARACTER_PIECES, chessCore } from '../core/chess-core.ts';
import { isInCheck } from '../core/chess/facts/position.ts';
import { kingSquare } from '../core/chess/facts/pieces.ts';
import type { BotPlayer } from '../core/app/bot-player.ts';
import type { ExerciseState } from '../core/exercise/state.ts';
import type { Position, Square } from '../core/chess/types.ts';
import { createWorkerBotPlayer } from './adapters/bot/worker-bot-player.ts';
import { createBundledContentSource } from './adapters/content/bundled-content-source.ts';
import type { SubjectRouteEntry, SubjectWeb } from '@learn/platform-web/app/subject.ts';
import { createPlaySlice, type PlaySlice } from './slices/play.ts';
import { HOME_TILES } from './home-tiles.ts';
import { EXERCISE_KIND_UI } from './kinds/ui-registry.ts';
import { MINI_GAME_MODE_UI } from './modes/ui-registry.ts';
import { Stats, SurfaceDemo, SurfaceStory } from './surface.tsx';
import { CHESS_ART, characterColor } from './art/chess-art.ts';
import { Board } from './ui/board/Board.tsx';
import { PieceIcon } from './ui/board/pieces.tsx';
import { PlayScreen } from './ui/PlayScreen.tsx';
import { FullGameScreen } from './ui/FullGameScreen.tsx';

const FriendSetupScreen = lazy(() =>
  import('./ui/FriendSetupScreen.tsx').then((module) => ({ default: module.FriendSetupScreen })),
);
const FriendGameScreen = lazy(() =>
  import('./ui/FriendGameScreen.tsx').then((module) => ({ default: module.FriendGameScreen })),
);

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

/** A piece character's portrait is its own classic (white) piece icon; `null` for the narrator (Owl), which keeps its image. */
function characterArt(character: string) {
  const type = CHARACTER_PIECES[character];
  return type === undefined ? null : createElement(PieceIcon, { piece: { color: 'w', type } });
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
  characterArt,
  art: CHESS_ART,
  characterColor,
  homeTiles: HOME_TILES,
  den: { rankGlyph: (rankId) => RANK_GLYPH[rankId] ?? '?', Stats },
  loadParent: () => import('./parent-panels.tsx'),
  routes: CHESS_ROUTES,
  createSlice: createPlaySlice,
  homeReset: { levelUpSuggestion: null },
  // Gated on the compile-time DEV flag so Rollup drops the dev-playground subtree: an ungated `dev`
  // field keeps its `import()` calls as live split points and grows the initial bundle.
  dev: import.meta.env.DEV
    ? {
        '#board': () => import('./dev/BoardPlayground.tsx').then((m) => m.BoardPlayground),
        '#exercises': () =>
          import('./dev/ExercisePlayground.tsx').then((m) => m.ExercisePlayground),
        '#lesson=': () => import('./dev/LessonPreview.tsx').then((m) => m.LessonPreview),
      }
    : undefined,
} satisfies SubjectWeb;

export function checkSquareFor(position: Position): Square | undefined {
  return isInCheck(position, chessCore.context.chess)
    ? kingSquare(position, position.toMove)
    : undefined;
}

function SurfaceView({ state }: { state: ExerciseState }) {
  const { t } = useTranslation();
  return createElement(Board, {
    position: state.position,
    legalMoves: [],
    label: t('lesson.board-label'),
  });
}
