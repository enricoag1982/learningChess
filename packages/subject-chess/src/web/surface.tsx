// Chess's board surfaces (`SubjectWeb.surface`) and games stats, part of the chess pack.
import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameRecord } from '@learn/platform-core';
import { chessCore } from '../core/chess-core.ts';
import { friendGamesPlayed } from '../core/app/friend-play.ts';
import type { Lesson } from '../core/chess/lesson.ts';
import type { Position, Square } from '../core/chess/types.ts';
import { characterName } from '@learn/platform-web/content-text.ts';
import { Board } from './ui/board/Board.tsx';
import { MiniBoard } from './ui/board/MiniBoard.tsx';
import { InfoPill } from '@learn/platform-web/ui/ds/primitives.tsx';

/** Story board: the demo position with its highlighted squares, sized for a phone column (`compact`) or a side-by-side row. */
export function SurfaceStory({
  lesson,
  compact,
}: {
  readonly lesson: Lesson;
  readonly compact: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const { demo } = lesson;
  const dots =
    'legalMovesFrom' in demo.highlight
      ? chessCore.context
          .legalMoves(demo.position, { staticOpponent: true }, demo.highlight.legalMovesFrom)
          .map((move) => move.to)
      : demo.highlight.squares;
  const board = (
    <MiniBoard position={demo.position} highlightSquares={dots} label={t('lesson.board-label')} />
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
  const [position, setPosition] = useState<Position>(lesson.demo.position);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);
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
