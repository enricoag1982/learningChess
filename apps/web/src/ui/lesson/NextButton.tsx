import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

function ArrowIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export interface NextButtonProps {
  readonly onClick: () => void;
  /** Overrides the default "Next" label, e.g. Story's "Let me try". */
  readonly label?: string;
  readonly className?: string;
}

/** The lesson's one primary action: green, ≥64px tall, icon + label, always going forward. */
export function NextButton({ onClick, label, className = '' }: NextButtonProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap-raised tap-go flex h-20 items-center justify-center gap-3 rounded-3xl bg-go px-6 font-display text-2xl font-semibold text-white ${className}`}
    >
      {label ?? t('next')}
      <ArrowIcon />
    </button>
  );
}
