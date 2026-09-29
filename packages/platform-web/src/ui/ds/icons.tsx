/* eslint-disable react-refresh/only-export-components -- every icon is a component built by `strokeIcon`. */
import type { JSX, ReactNode } from 'react';

export interface IconProps {
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
}

/** Shared stroke-icon base (viewBox 24, round caps/joins, `aria-hidden`); `fill` / `stroke` default to the two-tone look, some icons override one. */
export function Svg({
  size = 24,
  strokeWidth = 2,
  className,
  fill = 'none',
  stroke = 'currentColor',
  children,
}: IconProps & {
  readonly fill?: string;
  readonly stroke?: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

interface StrokeLook {
  readonly size: number;
  readonly strokeWidth: number;
  readonly className?: string;
  readonly stroke?: string;
}

function strokeIcon(look: StrokeLook, shapes: ReactNode): (props?: IconProps) => JSX.Element {
  return function StrokeIcon({
    size = look.size,
    strokeWidth = look.strokeWidth,
    className = look.className,
  }: IconProps = {}): JSX.Element {
    return (
      <Svg size={size} strokeWidth={strokeWidth} className={className} stroke={look.stroke}>
        {shapes}
      </Svg>
    );
  };
}

export const BackIcon = strokeIcon({ size: 30, strokeWidth: 2.4 }, <path d="M15 18l-6-6 6-6" />);

export const ChevronRightIcon = strokeIcon(
  { size: 20, strokeWidth: 2.5, className: 'flex-shrink-0 text-muted' },
  <path d="m9 6 6 6-6 6" />,
);

export const CloseIcon = strokeIcon(
  { size: 24, strokeWidth: 2.6 },
  <path d="M6 6l12 12M18 6L6 18" />,
);

export const LockIcon = strokeIcon(
  { size: 22, strokeWidth: 2 },
  <>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>,
);

export const CheckIcon = strokeIcon({ size: 20, strokeWidth: 3 }, <path d="M5 13l4 4L19 7" />);

export const SkipIcon = strokeIcon(
  { size: 22, strokeWidth: 2.6 },
  <>
    <path d="M5 5l8 7-8 7V5z" />
    <path d="M17 5v14" />
  </>,
);

export const PlusIcon = strokeIcon({ size: 40, strokeWidth: 2.4 }, <path d="M12 5v14M5 12h14" />);

export const ReplayIcon = strokeIcon(
  { size: 24, strokeWidth: 2 },
  <>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16 8.5a5 5 0 0 1 0 7" />
  </>,
);

/** Two-person silhouette: "Switch player" (Home, `currentColor`) and vs Friend (Play, orange). */
const twoPeople = (
  <>
    <circle cx={9} cy={8} r={3.5} />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
    <path d="M18 14a6 6 0 0 1 3.5 6" />
  </>
);

export const SwitchPlayerIcon = strokeIcon({ size: 28, strokeWidth: 2 }, twoPeople);

export const FriendIcon = strokeIcon({ size: 34, strokeWidth: 2, stroke: '#B8561A' }, twoPeople);

export const WarmUpIcon = strokeIcon(
  { size: 34, strokeWidth: 2, stroke: '#B8561A' },
  <>
    <path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18.9 5.6l-2.1 2.1M21 12h-3" />
    <circle cx={12} cy={16} r={5} />
  </>,
);

export const ComputerIcon = strokeIcon(
  { size: 34, strokeWidth: 2, stroke: '#2F5E9E' },
  <>
    <rect x={4} y={7} width={16} height={12} rx={3} />
    <path d="M12 3v4" />
    <circle cx={9} cy={13} r={1} fill="#2F5E9E" />
    <circle cx={15} cy={13} r={1} fill="#2F5E9E" />
  </>,
);

export const NewGameIcon = strokeIcon(
  { size: 32, strokeWidth: 2, stroke: '#2E7D5B' },
  <>
    <rect x={3} y={3} width={18} height={18} rx={3} />
    <path d="M3 12h18M12 3v18" />
  </>,
);

export interface CrownIconProps extends IconProps {
  /** Filled gold when a world boss is won (Journey node). */
  readonly filled?: boolean;
  /** Draws the crown's base line too (off for `RankCrownIcon`'s small badge use). */
  readonly bar?: boolean;
  readonly stroke?: string;
}

export function CrownIcon({
  size = 30,
  strokeWidth = 2,
  className,
  filled = false,
  bar = true,
  stroke = 'currentColor',
}: CrownIconProps = {}): JSX.Element {
  return (
    <Svg
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      stroke={stroke}
      fill={filled ? '#E9A92B' : 'none'}
    >
      <path d="M4 18h16l1-9-5 4-4-6-4 6-5-4z" />
      {bar && <path d="M4 18v2h16v-2" />}
    </Svg>
  );
}

export function RankCrownIcon({
  size = 18,
  className,
}: Pick<IconProps, 'size' | 'className'> = {}): JSX.Element {
  return <CrownIcon size={size} className={className} bar={false} stroke="#1F5A41" />;
}

/** Streak flame (StreakPill): filled shape, no stroke — its own base a plain stroke icon can't share. */
export function FlameIcon({
  className = 'h-6 w-6',
}: Pick<IconProps, 'className'> = {}): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2c1 3-3 4-3 7.5A3.5 3.5 0 0 0 12 13a2 2 0 0 0 2-2c1.5 1.5 2.5 3 2.5 5a4.5 4.5 0 0 1-9 0C7.5 12 9 9 9 7c1.5 1 1.5-1 3-5z"
        fill="#B8561A"
      />
    </svg>
  );
}

/** World-boss flag (Journey): two-tone pole + pennant, no stroke/fill uniform to share the base. */
export function FlagIcon({ size = 18 }: Pick<IconProps, 'size'> = {}): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3v18" stroke="#6E4A07" strokeWidth={2} strokeLinecap="round" />
      <path d="M6 4h13l-4 4 4 4H6z" fill="#E9A92B" />
    </svg>
  );
}

/** Home's big central "Start" play triangle: solid fill, no stroke. */
export function PlayIcon({ size = 32 }: Pick<IconProps, 'size'> = {}): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4l13 8-13 8z" fill="currentColor" />
    </svg>
  );
}

/** Gold five-point star (collectible board squares, star counters), filling its parent. */
export function StarIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 45 45" aria-hidden="true" className="pointer-events-none block h-full w-full">
      <path
        d="M22.5,5 L32.8,36.7 L5.9,17.1 L39.1,17.1 L12.2,36.7 Z"
        fill="#E9A92B"
        stroke="#8C5E08"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}
