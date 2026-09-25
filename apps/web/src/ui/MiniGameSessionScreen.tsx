import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { recordMiniGameResult } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { tContent } from '../content-text.ts';
import type { BossPlaySession } from './lesson/BossStep.tsx';
import { BossStep } from './lesson/BossStep.tsx';

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

/**
 * A mini-game played standalone from the Play screen (app-structure.md §4 Play): the same boss
 * step components a lesson uses (`BossStep`, any of the 3 modes), inside a simple top bar (close +
 * title) instead of the lesson chrome, saved via `recordMiniGameResult` rather than a lesson's own
 * boss slot — see `BossPlaySession`.
 */
export function MiniGameSessionScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const miniGameId = useAppStore((state) => state.miniGameId);
  const miniGameOrigin = useAppStore((state) => state.miniGameOrigin);
  const exitMiniGame = useAppStore((state) => state.exitMiniGame);
  const advanceToday = useAppStore((state) => state.advanceToday);

  const minigame = miniGameId ? services.deps.content.minigame(miniGameId) : undefined;
  const lesson = minigame ? services.deps.content.lesson(minigame.unlockAfter) : undefined;

  if (!profile || !minigame || !lesson) {
    return <main className="min-h-screen bg-cream" />;
  }

  const primaryLabel =
    miniGameOrigin === 'today'
      ? t('continue')
      : miniGameOrigin === 'journey'
        ? t('play.back-to-journey')
        : miniGameOrigin === 'home'
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
    onPrimary: miniGameOrigin === 'today' ? () => void advanceToday() : exitMiniGame,
  };

  return (
    <main className="flex h-dvh flex-col gap-3 overflow-y-auto bg-cream px-3 py-3 sm:px-8 sm:py-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={t('play.close')}
          onClick={exitMiniGame}
          className="tap-raised flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-card text-ink"
        >
          <CloseIcon />
        </button>
        <span className="min-w-0 flex-1 truncate font-display text-xl text-ink sm:text-2xl">
          {tContent(t, minigame.titleKey)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <BossStep lesson={lesson} game={minigame} nextStepIndex={0} session={session} />
      </div>
    </main>
  );
}
