import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { recordMiniGameResult } from '@chess-kids/core';
import { useAppStore, useRoute, useServices } from '../app/store.ts';
import { BossStep } from '../chess-pack.ts';
import { tContent } from '../content-text.ts';
import type { BossPlaySession } from '../modes/mode-ui.ts';
import { BlankScreen, Screen, ScreenHeader } from './ds/Screen.tsx';

/** A mini-game played standalone from the Play screen: the same `BossStep` a lesson uses, in a
 * simple top bar instead of the lesson chrome, saved via `recordMiniGameResult`. */
export function MiniGameSessionScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const route = useRoute('minigame');
  const miniGameId = route?.miniGameId ?? null;
  // Exit target/label read straight off the stack: a standalone session sits directly on whatever
  // opened it.
  const below = useAppStore((state) => state.stack[state.stack.length - 2]);
  const exitMiniGame = useAppStore((state) => state.exitMiniGame);
  const advanceToday = useAppStore((state) => state.advanceToday);

  const minigame = miniGameId ? services.deps.content.minigame(miniGameId) : undefined;
  const lesson = minigame ? services.deps.content.lesson(minigame.unlockAfter) : undefined;

  if (!profile || !minigame || !lesson) {
    return <BlankScreen />;
  }

  const primaryLabel = route?.today
    ? t('continue')
    : below?.name === 'journey'
      ? t('play.back-to-journey')
      : below?.name === 'home'
        ? t('play.back-to-home')
        : t('play.back-to-play');

  const session: BossPlaySession = {
    save: (state, durationMs) =>
      recordMiniGameResult(services.deps, {
        profileId: profile.id,
        game: minigame,
        state,
        durationMs,
      }).then(() => undefined),
    primaryLabel,
    onPrimary: route?.today ? () => void advanceToday() : exitMiniGame,
  };

  return (
    <Screen kind="game">
      <ScreenHeader
        look="game"
        action="close"
        actionLabel={t('play.close')}
        onAction={exitMiniGame}
      >
        <span className="min-w-0 flex-1 truncate font-display text-xl text-ink sm:text-2xl">
          {tContent(t, minigame.titleKey)}
        </span>
      </ScreenHeader>

      <div className="flex min-h-0 flex-1 flex-col">
        <BossStep lesson={lesson} game={minigame} nextStepIndex={0} session={session} />
      </div>
    </Screen>
  );
}
