// Chess's board surfaces (`SubjectWeb.surface`) and character badge, part of the chess pack.
import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameRecord } from '@learn/platform-core';
import { CHARACTER_PIECES, chessCore } from '../core/chess-core.ts';
import { friendGamesPlayed } from '../core/app/friend-play.ts';
import type { Lesson } from '../core/chess/lesson.ts';
import type { Position, Square } from '../core/chess/types.ts';
import { useAppStore } from '@learn/platform-web/app/store.ts';
import { characterName, tContent } from '@learn/platform-web/content-text.ts';
import { Board } from './ui/board/Board.tsx';
import { MiniBoard } from './ui/board/MiniBoard.tsx';
import { isClassicOnlyContext, showPieceBadges } from './ui/board/piece-style.ts';
import { PieceIcon } from './ui/board/pieces.tsx';
import { InfoPill } from '@learn/platform-web/ui/ds/primitives.tsx';

/** The piece-icon pill under a character's portrait; nothing for a narrator-taught character (Owl). */
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

/** Story board: the demo position with its highlighted squares, sized for a phone column (`compact`) or a side-by-side row. */
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
