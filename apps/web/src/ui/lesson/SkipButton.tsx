import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from './button-styles.ts';

function SkipIcon(): JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 5l8 7-8 7V5z" />
      <path d="M17 5v14" />
    </svg>
  );
}

export interface SkipButtonProps {
  readonly onClick: () => void;
  readonly className?: string;
}

/**
 * "Skip" (playtest 2, teaching-process.md §2): Story/Demo/Try only, never Exercises/Boss. One tap
 * skips the rest of the current phase and marks it in the progress track (`StepPills`). Built on
 * `SECONDARY_BUTTON` (already ≥64px tall) — a shared primitive this task does not restyle.
 */
export function SkipButton({ onClick, className = '' }: SkipButtonProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} className={`${SECONDARY_BUTTON} ${className}`}>
      <SkipIcon />
      {t('lesson.skip')}
    </button>
  );
}
