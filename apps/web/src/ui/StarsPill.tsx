import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { StarIcon } from './board/pieces.tsx';
import { InfoPill } from './primitives.tsx';

/** Info pill (docs/screens.md §1 "Pills" / "Info = no box"): a star total, used in the Home and
 * Lesson top bars — star icon + number, no pill background or border. */
export function StarsPill({ count }: { readonly count: number }): JSX.Element {
  const { t } = useTranslation();
  return (
    <InfoPill
      role="img"
      data-testid="stars-pill"
      className="h-14 font-display text-lg font-semibold text-[#6E4A07]"
      aria-label={t('stars-count', { count })}
    >
      <span className="h-6 w-6" aria-hidden="true">
        <StarIcon />
      </span>
      <span aria-hidden="true">{count}</span>
    </InfoPill>
  );
}
