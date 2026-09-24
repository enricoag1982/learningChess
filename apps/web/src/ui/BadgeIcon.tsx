import type { JSX } from 'react';
import type { BadgeTier } from '@chess-kids/core';

/** Fill colour per tier (`docs/screens.md` §1.1 tokens where they fit; gold reuses the star token). */
const TIER_COLOR: Readonly<Record<BadgeTier | 'none', string>> = {
  bronze: '#C97C43',
  silver: '#ADB5BD',
  gold: '#E9A92B',
  none: '#2E7D5B', // untiered earned badge: "go" (done/earned), same role as a completed rank.
};

export interface BadgeIconProps {
  readonly tier?: BadgeTier;
  /** Grey outline instead of a filled medal (My Den: locked). */
  readonly locked?: boolean;
  readonly className?: string;
}

/**
 * A round medal/rosette (docs/screens.md §1 "grey + lock = locked"): earned shows a checkmark
 * filled by tier colour; locked shows a plain grey outline with a small lock glyph instead (never
 * the checkmark — a locked badge must never read as "done").
 */
export function BadgeIcon({ tier, locked = false, className }: BadgeIconProps): JSX.Element {
  const color = locked ? '#8C8C8C' : TIER_COLOR[tier ?? 'none'];
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke={color}
      strokeWidth={locked ? 2 : 0}
    >
      <circle cx="24" cy="19" r="13" fill={locked ? 'none' : color} />
      <path
        d="M15 29 L11 43 L24 37 L37 43 L33 29"
        fill={locked ? 'none' : color}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {locked ? (
        <g stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="19" y="18" width="10" height="8" rx="1.5" />
          <path d="M21 18v-2.5a3 3 0 0 1 6 0V18" fill="none" />
        </g>
      ) : (
        <path
          d="M18 19l4 4 8-8"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </svg>
  );
}
