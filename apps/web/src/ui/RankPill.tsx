import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { RankDef } from '@learn/platform-core';
import { tContent } from '../content-text.ts';
import { InfoPill } from './ds/primitives.tsx';
import { RankCrownIcon } from './ds/icons.tsx';

/** Info pill (docs/screens.md §1): the current rank name — crown icon + text, no background or
 * border, so it never reads as a tappable chip. */
export function RankPill({
  rank,
  compact = false,
}: {
  readonly rank: RankDef | undefined;
  /** Parent area: text-sized, next to a nickname in a list row (kid screens keep the 56 px pill). */
  readonly compact?: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (!rank) return null;
  const name = tContent(t, `journey:ranks.${rank.id}`);
  return (
    <InfoPill
      data-testid="rank-pill"
      className={
        compact
          ? 'h-7 self-start text-xs font-bold text-[#1F5A41]'
          : 'h-14 font-display text-lg font-semibold text-[#1F5A41]'
      }
    >
      <RankCrownIcon />
      {tContent(t, 'journey:ui.rank-pill', { rank: name })}
    </InfoPill>
  );
}
