import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { starsToday } from '@chess-kids/core';
import type { TimeLimitReason } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { StarsPill } from './StarsPill.tsx';
import { tapClass } from './ds/tap.ts';
import { Screen } from './ds/Screen.tsx';

/** `TimeLimitStatus.reason` -> the title/body text this screen shows (M5.2 "limit"; M7.1
 * "late"/"early", app-structure.md §13 "Allowed hours"). Falls back to the daily-limit text for
 * `null` (should not normally happen — this screen only ever shows once the gate found a reason —
 * but keeps the component total). `playFrom` fills the "early" body's `{{time}}`. */
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

/**
 * "See you tomorrow" screen (M5.2, app-structure.md's time controls table; M7.1 widens it to
 * allowed hours): shown instead of the activity/Home the kid was headed to once the activity gate
 * finds them blocked (`store.ts`'s `gated`) — over the daily limit, or outside allowed hours.
 * Owl, spoken, today's stars; **Switch player** (back to the picker) or **Parent: more time** (the
 * existing password screen, `purpose: 'more-time'`) — a correct password grants more time
 * (`EXTRA_TIME_GRANT_MINUTES` for a daily-limit gate, an hours override for a late/early one,
 * `store.ts`'s `grantMoreTimeAndResume`) and resumes `pendingActivity` right where the kid left off.
 */
export function TimeLimitScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const timeLimitStatus = useAppStore((state) => state.timeLimitStatus);
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

  const { title: titleText, body: bubbleText } = timeLimitText(
    t,
    timeLimitStatus?.reason ?? null,
    timeLimitStatus?.playFrom ?? null,
  );
  return (
    <Screen kind="center" className="gap-8 px-4 py-8 sm:px-10">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">{titleText}</h1>

      {stars !== null && stars > 0 && (
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
