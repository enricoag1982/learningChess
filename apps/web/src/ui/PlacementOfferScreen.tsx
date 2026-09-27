import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useServices } from '../app/store.ts';
import { ReplayButton } from './ds/ReplayButton.tsx';
import { SpeechBubble } from './ds/SpeechBubble.tsx';
import { useNarratedText } from './ds/useNarratedText.ts';
import { tapClass } from './ds/tap.ts';
import { Screen } from './ds/Screen.tsx';

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
    <Screen kind="center" className="gap-8 px-4 py-8 sm:px-10">
      <div className="flex w-full max-w-md flex-col items-stretch gap-3">
        <SpeechBubble text={bubbleText} />
        <ReplayButton onClick={replay} label={t('exercise.replay')} />
      </div>
      <div className="flex w-full max-w-md flex-col gap-4">
        <button type="button" onClick={acceptPlacement} className={tapClass('block', 'go')}>
          {t('placement.offer-yes')}
        </button>
        <button type="button" onClick={declinePlacement} className={tapClass('block')}>
          {t('placement.offer-no')}
        </button>
      </div>
    </Screen>
  );
}
