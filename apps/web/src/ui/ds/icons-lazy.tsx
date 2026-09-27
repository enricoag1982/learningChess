import type { JSX } from 'react';
import { Svg } from './icons.tsx';
import type { IconProps } from './icons.tsx';

/**
 * Icons used only by parent-area/friend-play (lazy-loaded) screens: kept out of `icons.tsx` so
 * they never reach the initial bundle (refactor-v4.md §4 "Initial JS must not grow").
 * `ChevronLeftIcon`'s 4 callers must all be genuinely lazy-only for that to hold — `PrivacyScreen`
 * (parent area) lives in its own file, not `PrivacyPolicy.tsx`, precisely so it is (lead review
 * 2026-09-27: `PrivacyPolicy.tsx` is also reachable eagerly, via `FirstRunScreen.tsx`, which was
 * pulling this whole module — `GuestIcon` included — into the initial bundle too).
 */

/** Parent-area back chevron (ChildSettings, BackupPanel, ChildReport, PrivacyScreen). */
export function ChevronLeftIcon({
  size = 20,
  strokeWidth = 2.5,
  className,
}: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

/** Guest player silhouette (vs Friend setup/game, no profile picked). */
export function GuestIcon({
  className = 'h-full w-full',
}: Pick<IconProps, 'className'> = {}): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <circle cx={50} cy={38} r={20} fill="#B7C2CB" />
      <path d="M18 88c0-20 14-32 32-32s32 12 32 32Z" fill="#B7C2CB" />
    </svg>
  );
}
