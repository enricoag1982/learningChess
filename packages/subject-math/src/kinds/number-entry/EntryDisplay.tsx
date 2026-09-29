import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

export interface EntryDisplayProps {
  /** The digits typed so far. */
  readonly entry: string;
  /** The last wrong answer: orange and struck through until the next digit. */
  readonly wrongValue?: number;
}

/** What the kid has typed, announced politely as it changes. */
export function EntryDisplay({ entry, wrongValue }: EntryDisplayProps): JSX.Element {
  const { t } = useTranslation();
  const showWrong = entry === '' && wrongValue !== undefined;
  const value = showWrong ? String(wrongValue) : entry === '' ? '?' : entry;
  return (
    <output
      aria-live="polite"
      className={`block text-center font-display text-3xl font-bold ${
        showWrong ? 'text-today line-through' : 'text-ink'
      }`}
    >
      {t('math.entry-label', { value })}
    </output>
  );
}
