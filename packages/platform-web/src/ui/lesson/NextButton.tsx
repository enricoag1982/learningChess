import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon } from '../ds/icons.tsx';
import { tapClass } from '../ds/tap.ts';

export interface NextButtonProps {
  readonly onClick: () => void;
  readonly label?: string;
  readonly className?: string;
}

/** The lesson's one primary action: green, 64px tall, icon + label, always going forward. */
export function NextButton({ onClick, label, className = '' }: NextButtonProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} className={`${tapClass('next', 'go')} ${className}`}>
      {label ?? t('next')}
      <ChevronRightIcon size={26} strokeWidth={2.6} className="" />
    </button>
  );
}
