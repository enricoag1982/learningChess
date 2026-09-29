import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../app/store.ts';
import { NarratedBubble } from './ds/NarratedBubble.tsx';
import { tapClass } from './ds/tap.ts';
import { Screen } from './ds/Screen.tsx';

/** "Already know some chess?" (domain-model.md §3.2), once after creating a new player: Yes starts placement, No goes Home at World 1. */
export function PlacementOfferScreen(): JSX.Element {
  const { t } = useTranslation();
  const acceptPlacement = useAppStore((state) => state.acceptPlacement);
  const declinePlacement = useAppStore((state) => state.declinePlacement);

  const bubbleText = t('placement.offer-question');

  return (
    <Screen kind="center" className="gap-8 px-4 py-8 sm:px-10">
      <NarratedBubble text={bubbleText} layout="stack" />
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
