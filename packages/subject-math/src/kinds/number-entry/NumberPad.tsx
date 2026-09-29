import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { tapClass } from '@learn/platform-web/ui/ds/tap.ts';
import type { Digit } from './kind.ts';

const KEY_SHAPE =
  'flex h-16 min-w-16 items-center justify-center rounded-2xl font-display text-2xl font-semibold';
const KEY = tapClass('custom', 'neutral', KEY_SHAPE);
const WORD_KEY = tapClass('custom', 'neutral', `${KEY_SHAPE} text-lg`);
const CHECK_KEY = tapClass('custom', 'go', `${KEY_SHAPE} text-lg disabled:opacity-40`);

const TOP_DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface NumberPadProps {
  readonly onDigit: (digit: Digit) => void;
  readonly onErase: () => void;
  readonly onCheck: () => void;
  /** False while nothing is typed: Check has nothing to check. */
  readonly canCheck: boolean;
}

/** 1-9, then Delete, 0 and Check: a 3 × 4 grid of big keys. */
export function NumberPad({ onDigit, onErase, onCheck, canCheck }: NumberPadProps): JSX.Element {
  const { t } = useTranslation();
  const digitKey = (digit: Digit): JSX.Element => (
    <button
      key={digit}
      type="button"
      className={KEY}
      onClick={() => {
        onDigit(digit);
      }}
    >
      {digit}
    </button>
  );
  return (
    <div
      role="group"
      aria-label={t('math.pad-label')}
      className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3"
    >
      {TOP_DIGITS.map(digitKey)}
      <button type="button" className={WORD_KEY} onClick={onErase}>
        {t('math.erase')}
      </button>
      {digitKey(0)}
      <button type="button" className={CHECK_KEY} disabled={!canCheck} onClick={onCheck}>
        {t('exercise.check')}
      </button>
    </div>
  );
}
