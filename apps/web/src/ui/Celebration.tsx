import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useServices } from '../app/store.ts';
import { tContent } from '../content-text.ts';
import { BadgeIcon } from './BadgeIcon.tsx';
import { ReplayButton } from './ReplayButton.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { useNarratedText } from './useNarratedText.ts';

/**
 * Full-screen badge celebration (rewards.md §1 "Rare celebrations"), shown over whichever screen
 * is current (`App.tsx` renders it alongside `<Screens />`) whenever the store's `activeCelebration`
 * is set — `checkForCelebrations` only ever sets it right after lesson complete, a game's result,
 * or the Today session summary, and caps at 2 per app sitting; every other newly earned badge shows
 * as a "new" dot in My Den instead. Animation is CSS-only (`celebration-pop`, `index.css`), so
 * `prefers-reduced-motion` is already handled globally.
 */
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
  const replay = useNarratedText(services.narrator, activeCelebration ? bubbleText : '');

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

        <div className="flex w-full flex-col items-stretch gap-3">
          <SpeechBubble text={bubbleText} avatarClassName="h-12 w-12" bubbleClassName="text-lg" />
          <ReplayButton onClick={replay} label={t('exercise.replay')} />
        </div>

        <button
          type="button"
          onClick={() => {
            void dismissCelebration();
          }}
          className="mt-2 h-16 w-full max-w-xs rounded-3xl bg-go font-display text-xl font-semibold text-white"
        >
          {t('celebration.continue')}
        </button>
      </div>
    </div>
  );
}
