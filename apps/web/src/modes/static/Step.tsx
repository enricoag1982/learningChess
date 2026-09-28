import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Square } from '@chess-kids/core/chess';
import {
  enemyCount,
  gameResult,
  playGameMove,
  startStaticCaptureGame,
} from '@chess-kids/core/chess';
import type { GameState, StaticMiniGame } from '@chess-kids/core/chess';
import { useAppStore, useServices } from '../../app/store.ts';
import { chessWeb } from '../../chess-pack.ts';
import { tContent } from '../../content-text.ts';
import { Board } from '../../ui/board/Board.tsx';
import { isClassicOnlyContext, showPieceBadges } from '../../ui/board/piece-style.ts';
import { ReplayButton } from '../../ui/ds/ReplayButton.tsx';
import { SpeechBubble } from '../../ui/ds/SpeechBubble.tsx';
import { useNarratedText } from '../../ui/ds/useNarratedText.ts';
import { GameLayout } from '../../ui/lesson/GameLayout.tsx';
import { BossResultPanel, useBossRun } from '../boss-run.tsx';
import type { BossStepProps } from '../mode-ui.ts';

/** A `static` boss mini-game: capture every enemy piece (or collect every star) before the move
 * limit, no hints (`MINI_GAME_MODE_UI.static`). */
export function Step({
  lesson,
  game: minigame,
  nextStepIndex,
  session,
}: BossStepProps<StaticMiniGame>): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const goToStep = useAppStore((state) => state.goToStep);
  const pieceBadges = showPieceBadges(pieceStyle, isClassicOnlyContext({ worldId: lesson.world }));

  const [game, setGame] = useState<GameState>(() => startStaticCaptureGame(minigame));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);

  const run = useBossRun(game, { lesson, nextStepIndex, session });
  const result = gameResult(game);
  const goalText = tContent(t, minigame.goalKey);
  const replay = useNarratedText(services.narrator, goalText);
  const kidColor = minigame.position.toMove;
  const isCollectStars = minigame.goal === 'collect-stars';
  const totalEnemies = enemyCount(minigame.position, kidColor);
  const captured = totalEnemies - enemyCount(game.exercise.position, kidColor);
  const totalStars = minigame.position.markers.stars.length;
  const starsCollected = totalStars - game.exercise.position.markers.stars.length;

  function handleMove(move: { from: Square; to: Square }): void {
    const { state: next, outcome } = playGameMove(game, chessWeb.core.context, move);
    setGame(next);
    if (outcome.kind !== 'illegal') setLastMove(move);
  }

  function handlePlayAgain(): void {
    setGame(startStaticCaptureGame(minigame));
    setLastMove(undefined);
    run.restart();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-4">
      <h2 className="text-center font-display text-xl text-ink sm:text-3xl">
        {tContent(t, minigame.titleKey)}
      </h2>
      <GameLayout
        board={
          <Board
            position={game.exercise.position}
            legalMoves={
              result === 'playing'
                ? chessWeb.core.context.legalMoves(game.exercise.position, { staticOpponent: true })
                : []
            }
            onMove={handleMove}
            highlights={lastMove ? { lastMove } : undefined}
            label={t('lesson.board-label')}
            pieceBadges={pieceBadges}
          />
        }
        panel={
          <>
            <SpeechBubble text={goalText} />
            <ReplayButton onClick={replay} label={t('exercise.replay')} />
            <div className="info-flat flex flex-col gap-1 rounded-3xl bg-card px-5 py-4 font-display text-lg text-ink">
              <span>
                {isCollectStars
                  ? t('boss.stars-of', { current: starsCollected, total: totalStars })
                  : t('boss.captured-of', { current: captured, total: totalEnemies })}
              </span>
              <span>{t('boss.moves-par', { moves: game.exercise.moves, par: minigame.par })}</span>
            </div>
            {result !== 'playing' && (
              <BossResultPanel
                stars={run.stars}
                saved={run.saved}
                alwaysPlayAgain={result === 'ended'}
                note={
                  result === 'ended' ? (
                    <p className="font-display text-2xl text-ink">{t('boss.ended')}</p>
                  ) : undefined
                }
                session={session}
                onPlayAgain={handlePlayAgain}
                onNext={() => {
                  goToStep(nextStepIndex);
                }}
              />
            )}
          </>
        }
      />
    </div>
  );
}
