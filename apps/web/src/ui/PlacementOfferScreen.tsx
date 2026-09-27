import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useServices } from '../app/store.ts';
import { ReplayButton } from './ReplayButton.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';
import { useNarratedText } from './useNarratedText.ts';

/**
 * "Already know some chess?" offer (app-structure.md §3, domain-model.md §3.2), shown once right
 * after creating a new player. Yes starts the placement test; No goes straight to Home at World 1.
 */
export function PlacementOfferScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const acceptPlacement = useAppStore((state) => state.acceptPlacement);
  const declinePlacement = useAppStore((state) => state.declinePlacement);

  const bubbleText = t('placement.offer-question');
  const replay = useNarratedText(services.narrator, bubbleText);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-cream px-4 py-8 text-center sm:px-10">
      <div className="flex w-full max-w-md flex-col items-stretch gap-3">
        <SpeechBubble text={bubbleText} />
        <ReplayButton onClick={replay} label={t('exercise.replay')} />
      </div>
      <div className="flex w-full max-w-md flex-col gap-4">
        <button
          type="button"
          onClick={acceptPlacement}
          className="tap-raised tap-go h-20 rounded-[2rem] bg-go font-display text-xl font-semibold text-white sm:text-2xl"
        >
          {t('placement.offer-yes')}
        </button>
        <button
          type="button"
          onClick={declinePlacement}
          className="tap-raised h-20 rounded-[2rem] bg-card font-display text-xl font-semibold text-ink sm:text-2xl"
        >
          {t('placement.offer-no')}
        </button>
      </div>
    </main>
  );
}
