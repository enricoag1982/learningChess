import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '../ds/icons.tsx';

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
      <ChevronRightIcon size={26} strokeWidth={2.6} className="" />
    </button>
  );
}
