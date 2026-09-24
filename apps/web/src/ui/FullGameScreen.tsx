import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson, VersusMiniGame, VersusState } from '@chess-kids/core';
import {
  bot,
  parseFen,
  recordGame,
  versusGameRecordResult,
  versusGameState,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { VersusStep } from './lesson/VersusStep.tsx';
import type { BossPlaySession } from './lesson/BossStep.tsx';

function CloseIcon(): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Standard starting position, castling rights included (same as content's `first-game.yaml`). */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Kid-move cap and 3-star threshold, matching World 4's own full game (`first-game.yaml`). */
const FULL_GAME_MOVE_LIMIT = 100;
const FULL_GAME_PAR = 60;

/**
 * `VersusStep` requires a `lesson` prop, but never reads it once `session` is set (its only use is
 * `recordBossResult`, in the lesson-boss branch this screen never takes) — a harmless stand-in, not
 * a real lesson. `demo`/`guided`/`exercises` are unused for the same reason.
 */
const FULL_GAME_LESSON: Lesson = {
  id: 'full-game',
  world: 'check',
  order: 0,
  concept: 'full-game',
  character: 'lion',
  titleKey: 'play.full-game-title',
  storyKey: 'play.full-game-title',
  demo: {
    position: parseFen(START_FEN),
    textKey: 'play.full-game-title',
    highlight: { squares: [] },
  },
  guided: [],
  exercises: [],
};

/** A full game vs `level` (1 Mouse .. 5 Bear): the same rules/position as World 4's `first-game`
 * boss, built at runtime instead of from content so any unlocked level can play it (M3.5). */
function fullGameDef(level: number): VersusMiniGame {
  return {
    mode: 'versus',
    id: 'full-game',
    concept: 'full-game',
    position: parseFen(START_FEN),
    rules: {
      kings: true,
      checkRules: true,
      noMoves: 'draw',
      win: { w: [{ kind: 'checkmate' }], b: [{ kind: 'checkmate' }] },
      moveLimit: FULL_GAME_MOVE_LIMIT,
    },
    opponentLevel: level as 1 | 2 | 3 | 4 | 5,
    kidColor: 'w',
    par: FULL_GAME_PAR,
    titleKey: 'play.full-game-title',
    goalKey: 'play.full-game-goal',
    unlockAfter: 'stalemate',
  };
}

/**
 * Play's "Full game" button (M3.5): the same versus UI World 4's `first-game` boss uses
 * (`VersusStep`, reused as-is), at a level the kid picked on the Play screen. Unlike a lesson's
 * boss or a standalone mini-game session, a full game keeps no `MiniGameProgress`/`Attempt` — only
 * a `GameRecord` (`domain-model.md` §2), whether finished normally or left mid-game.
 */
export function FullGameScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const level = useAppStore((state) => state.fullGameLevel);
  const exitFullGame = useAppStore((state) => state.exitFullGame);

  const [current, setCurrent] = useState<VersusState | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const botLevel = bot.BOT_LEVELS.find((entry) => entry.level === level);
  const botName = t(`boss.versus.bot-name.${botLevel?.name ?? 'mouse'}`);

  if (!profile) {
    return <main className="min-h-screen bg-cream" />;
  }

  const game = fullGameDef(level);

  function requestLeave(): void {
    if (current && current.status === 'playing') {
      setConfirmLeave(true);
      return;
    }
    exitFullGame();
  }

  function confirmedLeave(): void {
    setConfirmLeave(false);
    if (profile && current && current.status === 'playing') {
      void recordGame(services.deps, {
        profileId: profile.id,
        game: 'full',
        opponentLevel: level,
        result: 'abandoned',
        reason: 'left',
        moves: versusGameState(current).history.map((move) => move.san),
      }).then(() => {
        exitFullGame();
      });
      return;
    }
    exitFullGame();
  }

  const session: BossPlaySession = {
    save: (state) => {
      if (state.mode !== 'versus') {
        return Promise.resolve();
      }
      const { result, reason } = versusGameRecordResult(state);
      return recordGame(services.deps, {
        profileId: profile.id,
        game: 'full',
        opponentLevel: level,
        result,
        reason,
        moves: versusGameState(state).history.map((move) => move.san),
      }).then(() => undefined);
    },
    primaryLabel: t('play.back-to-play'),
    onPrimary: exitFullGame,
  };

  return (
    <main className="flex h-dvh flex-col gap-3 overflow-y-auto bg-cream px-3 py-3 sm:px-8 sm:py-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={t('play.close')}
          onClick={requestLeave}
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-line bg-card text-ink"
        >
          <CloseIcon />
        </button>
        <span className="min-w-0 flex-1 truncate font-display text-xl text-ink sm:text-2xl">
          {t('play.full-game-vs', { name: botName })}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <VersusStep
          lesson={FULL_GAME_LESSON}
          game={game}
          nextStepIndex={0}
          session={session}
          onStateChange={setCurrent}
        />
      </div>

      {confirmLeave && (
        <div
          role="alertdialog"
          aria-label={t('boss.versus.stop-game-title')}
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-line bg-card p-6 text-center">
            <p className="font-display text-xl text-ink">{t('boss.versus.stop-game-title')}</p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmLeave(false);
                }}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl border-2 border-line bg-card font-display text-lg font-semibold text-ink"
              >
                {t('boss.versus.stop-game-cancel')}
              </button>
              <button
                type="button"
                onClick={confirmedLeave}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-today font-display text-lg font-semibold text-white"
              >
                {t('boss.versus.stop-game-confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
