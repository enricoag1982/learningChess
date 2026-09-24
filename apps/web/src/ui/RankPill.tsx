import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { RankDef } from '@chess-kids/core';
import { tContent } from '../content-text.ts';

/** Green pill showing the current rank name, next to the Home/Journey stars pill. */
export function RankPill({ rank }: { readonly rank: RankDef | undefined }): JSX.Element | null {
  const { t } = useTranslation();
  if (!rank) return null;
  const name = tContent(t, `journey:ranks.${rank.id}`);
  return (
    <div className="flex h-14 items-center rounded-full bg-[#DCEFE3] px-4 font-display text-lg font-semibold text-[#1F5A41]">
      {tContent(t, 'journey:ui.rank-pill', { rank: name })}
    </div>
  );
}
