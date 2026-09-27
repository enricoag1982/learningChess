import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { starsToday } from '@chess-kids/core';
import type { TimeLimitReason } from '@chess-kids/core';
import { useAppStore, useRoute, useServices } from '../app/store.ts';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { StarsPill } from './StarsPill.tsx';
import { tapClass } from './ds/tap.ts';
import { Screen } from './ds/Screen.tsx';
import { useAsync } from './ds/useAsync.ts';

/** `TimeLimitStatus.reason` -> title/body text ("limit"; "late"/"early", app-structure.md §13);
 * falls back to the daily-limit text for `null` (should not normally happen). */
function timeLimitText(
  t: TFunction,
  reason: TimeLimitReason | null,
  playFrom: string | null,
): { readonly title: string; readonly body: string } {
  switch (reason) {
    case 'late':
      return { title: t('time-limit.late-title'), body: t('time-limit.late-body') };
    case 'early':
      return {
        title: t('time-limit.early-title'),
        body: t('time-limit.early-body', { time: playFrom ?? '' }),
      };
    case 'limit':
    case null:
      return { title: t('time-limit.title'), body: t('time-limit.body') };
  }
}

/** "See you tomorrow" screen, shown once the gate finds the kid blocked. **Switch player** or
 * **Parent: more time**, which resumes the blocked navigation. */
export function TimeLimitScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const timeLimitStatus = useRoute('time-limit')?.status ?? null;
  const goToPasswordScreen = useAppStore((state) => state.goToPasswordScreen);
  const switchPlayerFromTimeLimit = useAppStore((state) => state.switchPlayerFromTimeLimit);
  const { value: stars } = useAsync(
    () => starsToday(services.deps, profile?.id ?? '', services.deps.clock.now()),
    [services, profile],
    !!profile,
  );

  const { title: titleText, body: bubbleText } = timeLimitText(
    t,
    timeLimitStatus?.reason ?? null,
    timeLimitStatus?.playFrom ?? null,
  );
  return (
    <Screen kind="center" className="gap-8 px-4 py-8 sm:px-10">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">{titleText}</h1>

      {stars !== undefined && stars > 0 && (
        <div className="flex items-center gap-2">
          <StarsPill count={stars} />
          <span className="text-sm font-bold text-muted">{t('time-limit.stars-today')}</span>
        </div>
      )}

      <NarratedBubble text={bubbleText} layout="stack" />

      <div className="flex w-full max-w-md flex-col gap-4">
        <button
          type="button"
          onClick={() => {
            void switchPlayerFromTimeLimit();
          }}
          className={tapClass('block', 'go')}
        >
          {t('home.switch-player')}
        </button>
        <button
          type="button"
          onClick={() => {
            goToPasswordScreen('more-time');
          }}
          className={tapClass('block')}
        >
          {t('time-limit.more-time')}
        </button>
      </div>
    </Screen>
  );
}
