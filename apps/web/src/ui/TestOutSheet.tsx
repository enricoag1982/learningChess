import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../app/store.ts';
import { tContent } from '../content-text.ts';
import { ReplayButton } from './ReplayButton.tsx';
import { SpeechBubble } from './SpeechBubble.tsx';

export interface TestOutSheetProps {
  /** The offer question, already resolved (e.g. "Want to show me you already know Rhino?"). */
  readonly bodyText: string;
  readonly onYes: () => void;
  readonly onNo: () => void;
}

/**
 * "Show you know it?" sheet (domain-model.md §3.2, app-structure.md §6 "Skip (kid)"): shown after
 * tapping a locked lesson or locked world on the Journey. A dialog, so the Owl row is always
 * stacked (docs/screens.md §1), unlike the side-by-side layout an in-flow speech bubble gets from
 * `sm` up.
 */
export function TestOutSheet({ bodyText, onYes, onNo }: TestOutSheetProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();

  function replay(): void {
    services.narrator.cancel();
    void services.narrator.speak(bodyText);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tContent(t, 'journey:ui.show-you-know-it')}
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0"
    >
      <div className="flex w-full max-w-md flex-col gap-5 rounded-[2rem] border-2 border-line bg-card p-6">
        <div className="flex w-full flex-col items-stretch gap-3">
          <SpeechBubble text={bodyText} />
          <ReplayButton onClick={replay} label={t('exercise.replay')} />
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onYes}
            className="flex h-16 items-center justify-center rounded-2xl bg-go font-display text-lg font-semibold text-white"
          >
            {tContent(t, 'journey:ui.test-out-yes')}
          </button>
          <button
            type="button"
            onClick={onNo}
            className="flex h-16 items-center justify-center rounded-2xl border-2 border-line bg-card font-display text-lg font-semibold text-ink"
          >
            {tContent(t, 'journey:ui.test-out-no')}
          </button>
        </div>
      </div>
    </div>
  );
}
