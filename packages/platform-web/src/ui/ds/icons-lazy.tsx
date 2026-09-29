import type { JSX } from 'react';
import { Svg } from './icons.tsx';
import type { IconProps } from './icons.tsx';

/** Icons used only by parent-area/friend-play (lazy-loaded) screens: kept out of `icons.tsx` so
 * they never reach the initial bundle. Every caller here must stay genuinely lazy-only. */

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
