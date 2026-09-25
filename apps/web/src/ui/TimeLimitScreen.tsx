import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { starsToday } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { ReplayButton } from './ReplayButton.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { StarsPill } from './StarsPill.tsx';
import { useNarratedText } from './useNarratedText.ts';

/**
 * "See you tomorrow" screen (M5.2, app-structure.md's time controls table): shown instead of the
 * activity/Home the kid was headed to once the activity gate finds them over their daily limit
 * (`store.ts`'s `gated`). Owl, spoken, today's stars; **Switch player** (back to the picker) or
 * **Parent: more time** (the existing password screen, `purpose: 'more-time'`) — a correct
 * password grants `EXTRA_TIME_GRANT_MINUTES` (core) more and resumes `pendingActivity` right where
 * the kid left off.
 */
export function TimeLimitScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const goToPasswordScreen = useAppStore((state) => state.goToPasswordScreen);
  const switchPlayerFromTimeLimit = useAppStore((state) => state.switchPlayerFromTimeLimit);
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void starsToday(services.deps, profile.id, services.deps.clock.now()).then((count) => {
      if (!cancelled) setStars(count);
    });
    return () => {
      cancelled = true;
    };
  }, [services, profile]);

  const bubbleText = t('time-limit.body');
  const replay = useNarratedText(services.narrator, bubbleText);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-cream px-4 py-8 text-center sm:px-10">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">{t('time-limit.title')}</h1>

      {stars !== null && stars > 0 && (
        <div className="flex items-center gap-2">
          <StarsPill count={stars} />
          <span className="text-sm font-bold text-muted">{t('time-limit.stars-today')}</span>
        </div>
      )}

      <div className="flex w-full max-w-md flex-col items-stretch gap-3">
        <SpeechBubble text={bubbleText} />
        <ReplayButton onClick={replay} label={t('exercise.replay')} />
      </div>

      <div className="flex w-full max-w-md flex-col gap-4">
        <button
          type="button"
          onClick={() => {
            void switchPlayerFromTimeLimit();
          }}
          className="h-20 rounded-[2rem] bg-go font-display text-xl font-semibold text-white sm:text-2xl"
        >
          {t('home.switch-player')}
        </button>
        <button
          type="button"
          onClick={() => {
            goToPasswordScreen('more-time');
          }}
          className="h-20 rounded-[2rem] border-2 border-line bg-card font-display text-xl font-semibold text-ink sm:text-2xl"
        >
          {t('time-limit.more-time')}
        </button>
      </div>
    </main>
  );
}
