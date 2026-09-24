import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

function FlameIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M12 2c1 3-3 4-3 7.5A3.5 3.5 0 0 0 12 13a2 2 0 0 0 2-2c1.5 1.5 2.5 3 2.5 5a4.5 4.5 0 0 1-9 0C7.5 12 9 9 9 7c1.5 1 1.5-1 3-5z"
        fill="#B8561A"
      />
    </svg>
  );
}

/** Orange pill: flame + current streak days. Home's top bar (>= 2 days) and My Den both use it. */
export function StreakPill({ days }: { readonly days: number }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      role="img"
      className="flex h-14 items-center gap-2 rounded-full bg-[#FCEEE3] px-4 font-display text-lg font-semibold text-[#7A3A0F]"
      aria-label={t('streak.pill', { count: days })}
    >
      <FlameIcon />
      <span aria-hidden="true">{days}</span>
    </div>
  );
}
