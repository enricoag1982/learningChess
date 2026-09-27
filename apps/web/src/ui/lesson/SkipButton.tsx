import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from './button-styles.ts';
import { SkipIcon } from '../ds/icons.tsx';

export interface SkipButtonProps {
  readonly onClick: () => void;
  readonly className?: string;
}

/** "Skip" (teaching-process.md §2): Story/Demo/Try only, never Exercises/Boss. One tap skips the
 * rest of the current phase and marks it in `StepPills`. */
export function SkipButton({ onClick, className = '' }: SkipButtonProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} className={`${SECONDARY_BUTTON} ${className}`}>
      <SkipIcon />
      {t('lesson.skip')}
    </button>
  );
}
