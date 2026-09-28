// Chess's board surfaces (`SubjectWeb.surface`) and character badge — part of the pack
// (`chess-pack.ts`), temporary home until m8.18 moves it to `subject-chess/src/web`.
import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameRecord } from '@learn/platform-core';
import { CHARACTER_PIECES, chessCore, friendGamesPlayed } from '@learn/subject-chess';
import type { Lesson, Position, Square } from '@learn/subject-chess';
import { useAppStore } from './app/store.ts';
import { characterName, tContent } from '@learn/platform-web/content-text.ts';
import { Board } from '@learn/subject-chess/web/ui/board/Board.tsx';
import { MiniBoard } from '@learn/subject-chess/web/ui/board/MiniBoard.tsx';
import {
  isClassicOnlyContext,
  showPieceBadges,
} from '@learn/subject-chess/web/ui/board/piece-style.ts';
import { PieceIcon } from '@learn/subject-chess/web/ui/board/pieces.tsx';
import { InfoPill } from '@learn/platform-web/ui/ds/primitives.tsx';

/** The piece-icon pill under a character's portrait, naming the piece it stands for; nothing for
 * a narrator-taught character (Owl — no `core.characters` entry). */
export function CharacterBadge({ character }: { readonly character: string }): JSX.Element | null {
  const { t } = useTranslation();
  const topicKey = chessCore.characters[character]?.topicKey;
  if (topicKey === undefined) return null;
  const piece = CHARACTER_PIECES[character] ?? 'r';
  return (
    <div className="info-flat ml-auto flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 font-bold text-ink sm:ml-0 sm:px-4 sm:py-2">
      <span className="h-6 w-6 sm:h-7 sm:w-7">
        <PieceIcon piece={{ color: 'w', type: piece }} />
      </span>
      {tContent(t, topicKey)}
    </div>
  );
}

/** Story step's board: the demo position with its highlighted squares, sized for a phone-width
 * column (`compact`) or a side-by-side row. */
export function SurfaceStory({
  lesson,
  compact,
}: {
  readonly lesson: Lesson;
  readonly compact: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const { demo } = lesson;
  const dots =
    'legalMovesFrom' in demo.highlight
      ? chessCore.context
          .legalMoves(demo.position, { staticOpponent: true }, demo.highlight.legalMovesFrom)
          .map((move) => move.to)
      : demo.highlight.squares;
  const pieceBadges = showPieceBadges(pieceStyle, isClassicOnlyContext({ worldId: lesson.world }));
  const board = (
    <MiniBoard
      position={demo.position}
      highlightSquares={dots}
      label={t('lesson.board-label')}
      pieceBadges={pieceBadges}
    />
  );
  return compact ? (
    <div className="mx-auto w-full max-w-[240px]">
      <div className="aspect-square w-full">{board}</div>
    </div>
  ) : (
    <div className="h-36 w-36 flex-shrink-0 sm:h-52 sm:w-52">{board}</div>
  );
}

/** Demo step's board: free play with the lesson's own piece, every legal move open. */
export function SurfaceDemo({ lesson }: { readonly lesson: Lesson }): JSX.Element {
  const { t } = useTranslation();
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const [position, setPosition] = useState<Position>(lesson.demo.position);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);
  const pieceBadges = showPieceBadges(pieceStyle, isClassicOnlyContext({ worldId: lesson.world }));
  const legalMoves = chessCore.context.legalMoves(position, { staticOpponent: true });

  function handleMove(move: { from: Square; to: Square }): void {
    const played = chessCore.context.play(position, { staticOpponent: true }, move);
    if (!played) return;
    setPosition(played.position);
    setLastMove(move);
  }

  return (
    <Board
      position={position}
      legalMoves={legalMoves}
      onMove={handleMove}
      highlights={lastMove ? { lastMove } : undefined}
      label={t('demo.board-label', { name: characterName(t, lesson.character) })}
      pieceBadges={pieceBadges}
    />
  );
}

/** My Den's own stats row: games won, games played with a friend. */
export function Stats({
  gameRecords,
}: {
  readonly gameRecords: readonly GameRecord[];
}): JSX.Element {
  const { t } = useTranslation();
  const gamesWon = gameRecords.filter((record) => record.result === 'win').length;
  const friendGames = friendGamesPlayed(gameRecords);
  return (
    <div className="flex flex-wrap gap-2">
      <InfoPill
        role="img"
        aria-label={t('den.games-won', { count: gamesWon })}
        className="h-10 w-fit text-sm font-extrabold text-ink"
      >
        <span aria-hidden="true">{t('den.games-won', { count: gamesWon })}</span>
      </InfoPill>
      <InfoPill
        role="img"
        aria-label={t('den.games-with-friends', { count: friendGames })}
        className="h-10 w-fit text-sm font-extrabold text-ink"
      >
        <span aria-hidden="true">{t('den.games-with-friends', { count: friendGames })}</span>
      </InfoPill>
    </div>
  );
}
