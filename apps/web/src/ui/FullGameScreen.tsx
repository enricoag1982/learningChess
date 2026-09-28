import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { MiniGameStateBase } from '@chess-kids/core';
import type { Lesson, VersusMiniGame, VersusState } from '@chess-kids/core/chess';
import {
  bot,
  parseFen,
  recordGame,
  versusGameRecordResult,
  versusGameState,
} from '@chess-kids/core/chess';
import { useAppStore, useRoute, useServices } from '../app/store.ts';
import type { BossPlaySession } from '../modes/mode-ui.ts';
import { Step as VersusStep } from '../modes/versus/Step.tsx';
import { animalImage } from './art/animal-images.ts';
import { BlankScreen, Screen, ScreenHeader } from './ds/Screen.tsx';
import { ConfirmDialog } from './ds/ConfirmDialog.tsx';

/** Standard starting position, castling rights included (same as content's `first-game.yaml`). */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Kid-move cap and 3-star threshold, matching World 4's own full game (`first-game.yaml`). */
const FULL_GAME_MOVE_LIMIT = 100;
const FULL_GAME_PAR = 60;

/** Narrows `BossPlaySession.save`'s base state back to `VersusState` (this screen is always `versus`). */
function isVersusState(state: MiniGameStateBase): state is VersusState {
  return state.mode === 'versus';
}

/** `VersusStep` requires a `lesson` prop but never reads it once `session` is set — a harmless
 * stand-in, not a real lesson. */
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
 * boss, built at runtime instead of from content so any unlocked level can play it. */
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

/** Play's "Full game" button: `VersusStep` at a level the kid picked. Unlike a lesson boss or
 * standalone mini-game, keeps no `MiniGameProgress`/`Attempt`, only a `GameRecord`. */
export function FullGameScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const route = useRoute('full-game');
  const exitFullGame = useAppStore((state) => state.exitFullGame);
  const updateAutomaticLevel = useAppStore((state) => state.updateAutomaticLevel);
  const checkForCelebrations = useAppStore((state) => state.checkForCelebrations);

  const [current, setCurrent] = useState<VersusState | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!profile || !route) {
    return <BlankScreen />;
  }
  const level = route.level;

  const botLevel = bot.BOT_LEVELS.find((entry) => entry.level === level);
  const botName = t(`boss.versus.bot-name.${botLevel?.name ?? 'mouse'}`);

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
        opponent: `computer:${String(level)}`,
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
      if (!isVersusState(state)) {
        return Promise.resolve();
      }
      const { result, reason } = versusGameRecordResult(state);
      return (
        recordGame(services.deps, {
          profileId: profile.id,
          game: 'full',
          opponent: `computer:${String(level)}`,
          result,
          reason,
          moves: versusGameState(state).history.map((move) => move.san),
        })
          .then(() => updateAutomaticLevel(level))
          // rewards.md §4 "game result" celebration moment: `recordGame` (app layer) already ran
          // `checkRewards` for a non-abandoned finish, so this just picks up anything newly earned.
          .then(() => checkForCelebrations())
          .then(() => undefined)
      );
    },
    primaryLabel: t('play.back-to-play'),
    onPrimary: exitFullGame,
  };

  return (
    <Screen kind="game">
      <ScreenHeader
        look="game"
        action="close"
        actionLabel={t('play.close')}
        onAction={requestLeave}
      >
        <img
          src={animalImage(botLevel?.name ?? 'mouse')}
          alt=""
          draggable={false}
          className="h-9 w-9 flex-shrink-0 rounded-full object-contain sm:h-10 sm:w-10"
        />
        <span className="min-w-0 flex-1 truncate font-display text-xl text-ink sm:text-2xl">
          {t('play.full-game-vs', { name: botName })}
        </span>
      </ScreenHeader>

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
        <ConfirmDialog
          title={t('boss.versus.stop-game-title')}
          cancelLabel={t('boss.versus.stop-game-cancel')}
          confirmLabel={t('boss.versus.stop-game-confirm')}
          confirmTone="today"
          onCancel={() => {
            setConfirmLeave(false);
          }}
          onConfirm={confirmedLeave}
        />
      )}
    </Screen>
  );
}
