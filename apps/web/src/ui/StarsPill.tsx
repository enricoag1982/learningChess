import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { StarIcon } from './board/pieces.tsx';

/** Gold pill showing a star total, used in the Home and Lesson top bars. */
export function StarsPill({ count }: { readonly count: number }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      role="img"
      className="flex h-14 items-center gap-2 rounded-full bg-[#FBEFD3] px-4 font-display text-lg font-semibold text-[#6E4A07]"
      aria-label={t('stars-count', { count })}
    >
      <span className="h-6 w-6" aria-hidden="true">
        <StarIcon />
      </span>
      <span aria-hidden="true">{count}</span>
    </div>
  );
}
