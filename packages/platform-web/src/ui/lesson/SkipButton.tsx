import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from './button-styles.ts';
import { SkipIcon } from '../ds/icons.tsx';

export interface SkipButtonProps {
  readonly onClick: () => void;
  /** Story / Demo: a narrow button in a row of its own, above the primary (never beside it). */
  readonly alone?: boolean;
}

/** "Skip" (teaching-process.md §2): Story/Demo/Try only, never Exercises/Boss. One tap skips the
 * rest of the current phase and marks it in `StepPills`. */
export function SkipButton({ onClick, alone = false }: SkipButtonProps): JSX.Element {
  const { t } = useTranslation();
  const button = (
    <button
      type="button"
      onClick={onClick}
      className={alone ? `${SECONDARY_BUTTON} max-w-48` : SECONDARY_BUTTON}
    >
      <SkipIcon />
      {t('lesson.skip')}
    </button>
  );
  return alone ? <div className="flex">{button}</div> : button;
}
