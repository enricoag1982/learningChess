import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Svg } from '@learn/platform-web/ui/ds/icons.tsx';
import { SECONDARY_BUTTON } from '@learn/platform-web/ui/lesson/button-styles.ts';

const CheckIcon = (): JSX.Element => (
  <Svg size={26} strokeWidth={2.8}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
);

const CrossIcon = (): JSX.Element => (
  <Svg size={26} strokeWidth={2.8}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export interface YesNoButtonsProps {
  readonly wrongValue?: boolean;
  readonly onAnswer: (value: boolean) => void;
}

/** Yes/No answer buttons: both start identical and neutral (neither biased green); a wrong pick
 * turns that button orange and disables it. */
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
