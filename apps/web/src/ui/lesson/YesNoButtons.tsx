import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from './button-styles.ts';

function CheckIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function CrossIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export interface YesNoButtonsProps {
  /** The value that was picked and was wrong, if any: that one turns orange and disables. */
  readonly wrongValue?: boolean;
  readonly onAnswer: (value: boolean) => void;
}

/**
 * Yes / No answer buttons for a yes-no exercise. Both start identical and neutral (neither is a
 * "primary" green action, which would bias the kid toward it) — icon + label, colour is never the
 * only signal. Once a wrong pick is made, only that button turns orange and disables.
 */
export function YesNoButtons({ wrongValue, onAnswer }: YesNoButtonsProps): JSX.Element {
  const { t } = useTranslation();
  const yesWrong = wrongValue === true;
  const noWrong = wrongValue === false;
  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={yesWrong}
        aria-disabled={yesWrong}
        onClick={() => {
          onAnswer(true);
        }}
        className={`${SECONDARY_BUTTON} ${yesWrong ? 'border-today text-today opacity-80' : ''}`}
      >
        <CheckIcon />
        {t('exercise.yes')}
      </button>
      <button
        type="button"
        disabled={noWrong}
        aria-disabled={noWrong}
        onClick={() => {
          onAnswer(false);
        }}
        className={`${SECONDARY_BUTTON} ${noWrong ? 'border-today text-today opacity-80' : ''}`}
      >
        <CrossIcon />
        {t('exercise.no')}
      </button>
    </div>
  );
}
