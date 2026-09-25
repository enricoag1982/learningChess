import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { RankDef } from '@chess-kids/core';
import { tContent } from '../content-text.ts';
import { InfoPill } from './primitives.tsx';

function CrownIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 18h16l1-9-5 4-4-6-4 6-5-4z"
        fill="none"
        stroke="#1F5A41"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Info pill (docs/screens.md §1 "Pills" / "Info = no box"): the current rank name, next to the
 * Home/Journey stars pill — crown icon + text, no pill background or border, so it never reads as
 * a bare button label or a tappable chip. */
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
      <CrownIcon />
      {tContent(t, 'journey:ui.rank-pill', { rank: name })}
    </InfoPill>
  );
}
