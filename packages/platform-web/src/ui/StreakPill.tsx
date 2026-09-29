import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoPill } from './ds/primitives.tsx';
import { FlameIcon } from './ds/icons.tsx';

/** Info pill (docs/screens.md §1): flame + streak days, no background or border; Home's top bar (>= 2 days) and My Den. */
export function StreakPill({ days }: { readonly days: number }): JSX.Element {
  const { t } = useTranslation();
  return (
    <InfoPill
      role="img"
      data-testid="streak-pill"
      className="h-14 font-display text-lg font-semibold text-[#7A3A0F]"
      aria-label={t('streak.pill', { count: days })}
    >
      <FlameIcon />
      <span aria-hidden="true">{days}</span>
    </InfoPill>
  );
}
