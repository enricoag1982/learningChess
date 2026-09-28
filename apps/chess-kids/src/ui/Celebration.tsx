import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useServices } from '../app/store.ts';
import { tContent } from '../content-text.ts';
import { BadgeIcon } from './BadgeIcon.tsx';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { tapClass } from './ds/tap.ts';

/** Full-screen badge celebration (rewards.md §1), shown over the current screen whenever
 * `activeCelebration` is set, capped per app sitting; other badges show as a My Den "new" dot. */
export function Celebration(): JSX.Element | null {
  const { t } = useTranslation();
  const services = useServices();
  const activeCelebration = useAppStore((state) => state.activeCelebration);
  const dismissCelebration = useAppStore((state) => state.dismissCelebration);

  const badgeDef = activeCelebration
    ? services.deps.content.badges?.().find((def) => def.id === activeCelebration.badgeId)
    : undefined;

  const badgeName = badgeDef ? tContent(t, badgeDef.nameKey) : '';
  const tierLabel = activeCelebration?.tier ? t(`tier.${activeCelebration.tier}`) : undefined;

  const bubbleText = t('celebration.owl-line', { name: badgeName });

  if (!activeCelebration || !badgeDef) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-label={t('celebration.heading')}
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="celebration-pop flex w-full max-w-md flex-col items-center gap-5 rounded-[2rem] border-2 border-line bg-card p-6 text-center sm:p-8">
        <h1 className="font-display text-2xl text-ink sm:text-3xl">{t('celebration.heading')}</h1>
        <BadgeIcon tier={activeCelebration.tier} className="h-24 w-24" />
        <div className="flex flex-col items-center gap-1">
          <span className="font-display text-xl text-ink sm:text-2xl">{badgeName}</span>
          {tierLabel && (
            <span className="rounded-full bg-[#FBEFD3] px-4 py-1 font-display text-sm font-bold text-[#6E4A07]">
              {tierLabel}
            </span>
          )}
        </div>

        <NarratedBubble
          text={bubbleText}
          layout="column"
          avatarClassName="h-12 w-12"
          bubbleClassName="text-lg"
        />

        <button
          type="button"
          onClick={() => {
            void dismissCelebration();
          }}
          className={tapClass(
            'custom',
            'go',
            'mt-2 h-16 w-full max-w-xs rounded-3xl font-display text-xl font-semibold',
          )}
        >
          {t('celebration.continue')}
        </button>
      </div>
    </div>
  );
}
