import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Color, GameState, Lesson, MiniGame, Position, Square } from '@chess-kids/core';
import {
  gameResult,
  gameStars,
  playGameMove,
  recordBossResult,
  startStaticCaptureGame,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { tContent } from '../../content-text.ts';
import { Board } from '../board/Board.tsx';
import { ReplayButton } from '../ReplayButton.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { useNarratedText } from '../useNarratedText.ts';
import { SECONDARY_BUTTON } from './button-styles.ts';
import { GameLayout } from './GameLayout.tsx';
import { NextButton } from './NextButton.tsx';

export interface BossStepProps {
  readonly lesson: Lesson;
  readonly game: MiniGame;
  readonly nextStepIndex: number;
}

/** Pieces on `position` that are not `kidColor`. */
function enemyCount(position: Position, kidColor: Color): number {
  return Object.values(position.pieces).filter((piece) => piece.color !== kidColor).length;
}

/** The lesson's boss mini-game: capture every enemy piece before the move limit, no hints. */
export function BossStep({ lesson, game: minigame, nextStepIndex }: BossStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const goToStep = useAppStore((state) => state.goToStep);
  const refreshProgress = useAppStore((state) => state.refreshProgress);

  const [game, setGame] = useState<GameState>(() => startStaticCaptureGame(minigame));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);
  // A lazy `useState` initializer (not a direct `Date.now()` call) keeps render pure; the ref
  // exists because "Play again" needs to reset the clock later, which `useState` can't do.
  const [initialStartedAt] = useState(() => Date.now());
  const startedAtRef = useRef(initialStartedAt);
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  const result = gameResult(game);
  const stars = gameStars(game);
  const goalText = tContent(t, minigame.goalKey);
  const replay = useNarratedText(services.narrator, goalText);
  const kidColor = minigame.position.toMove;
  const totalEnemies = enemyCount(minigame.position, kidColor);
  const captured = totalEnemies - enemyCount(game.exercise.position, kidColor);

  useEffect(() => {
    if (result === 'playing' || savedRef.current || !profile) return;
    savedRef.current = true;
    void recordBossResult(services.deps, {
      profileId: profile.id,
      lesson,
      state: game,
      durationMs: Date.now() - startedAtRef.current,
      nextStep: nextStepIndex,
    }).then(() => {
      setSaved(true);
      // Keeps the store's `progress` current: the Complete step reads it straight from the store.
      void refreshProgress();
    });
  }, [result, profile, services.deps, lesson, nextStepIndex, game, refreshProgress]);

  function handleMove(move: { from: Square; to: Square }): void {
    const { state: next, outcome } = playGameMove(game, services.rules, move);
    setGame(next);
    if (outcome.kind !== 'illegal') setLastMove(move);
  }

  function handlePlayAgain(): void {
    setGame(startStaticCaptureGame(minigame));
    setLastMove(undefined);
    startedAtRef.current = Date.now();
    savedRef.current = false;
    setSaved(false);
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
                ? services.rules.legalMoves(game.exercise.position, { staticOpponent: true })
                : []
            }
            onMove={handleMove}
            highlights={lastMove ? { lastMove } : undefined}
            label={t('lesson.board-label')}
          />
        }
        panel={
          <>
            <SpeechBubble text={goalText} />
            <ReplayButton onClick={replay} label={t('exercise.replay')} />
            <div className="flex flex-col gap-1 rounded-3xl border-2 border-line bg-card px-5 py-4 font-display text-lg text-ink">
              <span>{t('boss.captured-of', { current: captured, total: totalEnemies })}</span>
              <span>{t('boss.moves-par', { moves: game.exercise.moves, par: minigame.par })}</span>
            </div>
            {/* Autosave (recordBossResult) completes before either Next button appears. */}
            {result === 'won' && (
              <div className="mt-auto flex flex-col items-center gap-4">
                <StarsRow earned={stars} animate />
                {saved && (
                  <NextButton
                    onClick={() => {
                      goToStep(nextStepIndex);
                    }}
                    className="w-full"
                  />
                )}
              </div>
            )}
            {result === 'ended' && (
              <div className="mt-auto flex flex-col items-center gap-4">
                <p className="font-display text-2xl text-ink">{t('boss.ended')}</p>
                <StarsRow earned={1} animate />
                {saved && (
                  <div className="flex w-full gap-3">
                    <button type="button" onClick={handlePlayAgain} className={SECONDARY_BUTTON}>
                      {t('play-again')}
                    </button>
                    <NextButton
                      onClick={() => {
                        goToStep(nextStepIndex);
                      }}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
