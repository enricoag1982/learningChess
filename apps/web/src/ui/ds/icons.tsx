import type { JSX, ReactNode } from 'react';

export interface IconProps {
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
}

/**
 * Shared stroke-icon base (viewBox 24, round caps/joins, `aria-hidden`) behind every icon below —
 * replaces 44 one-off inline icon functions (refactor-v4.md §2 finding 6). `fill`/`stroke` default
 * to the plain two-tone look (`none`/`currentColor`); a few icons override one to carry their own
 * fixed colour instead (docs/screens.md colour roles).
 */
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

/** Kid-style "Back" chevron (JourneyScreen, PracticeScreen, DenScreen, FriendSetupScreen, PlayScreen). */
export function BackIcon({ size = 30, strokeWidth = 2.4, className }: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

/** Forward chevron: lesson "Next" (kid-sized) and parent-area row/pagination links (smaller, muted). */
export function ChevronRightIcon({
  size = 20,
  strokeWidth = 2.5,
  className = 'flex-shrink-0 text-muted',
}: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

/** "X" close button (mini-game/full-game/review/lesson exit). */
export function CloseIcon({
  size = 24,
  strokeWidth = 2.6,
  className,
}: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

/** Locked padlock (Journey nodes, password/parent screens, Play's locked tiles). */
export function LockIcon({ size = 22, strokeWidth = 2, className }: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

/** Check mark (Journey's mastered node, StepPills' done marker). */
export function CheckIcon({ size = 20, strokeWidth = 3, className }: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M5 13l4 4L19 7" />
    </Svg>
  );
}

/** Skip-ahead glyph (guided-try SkipButton, StepPills' skipped marker). */
export function SkipIcon({ size = 22, strokeWidth = 2.6, className }: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M5 5l8 7-8 7V5z" />
      <path d="M17 5v14" />
    </Svg>
  );
}

/** "Add child" plus (ProfilePickerScreen). */
export function PlusIcon({ size = 40, strokeWidth = 2.4, className }: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** "Listen again" / "Say it again" (ReplayButton). */
export function ReplayIcon({ size = 24, strokeWidth = 2, className }: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16 8.5a5 5 0 0 1 0 7" />
    </Svg>
  );
}

/** Two-person silhouette: "Switch player" (Home, `currentColor`) and vs Friend (Play, orange). */
function twoPeople(props: IconProps & { readonly stroke?: string }): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx={9} cy={8} r={3.5} />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18 14a6 6 0 0 1 3.5 6" />
    </Svg>
  );
}

export function SwitchPlayerIcon({
  size = 28,
  strokeWidth = 2,
  className,
}: IconProps = {}): JSX.Element {
  return twoPeople({ size, strokeWidth, className });
}

export function FriendIcon({ size = 34, strokeWidth = 2, className }: IconProps = {}): JSX.Element {
  return twoPeople({ size, strokeWidth, className, stroke: '#B8561A' });
}

/** Sun/timer glyph: Practice's warm-up entry. */
export function WarmUpIcon({ size = 34, strokeWidth = 2, className }: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className} stroke="#B8561A">
      <path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18.9 5.6l-2.1 2.1M21 12h-3" />
      <circle cx={12} cy={16} r={5} />
    </Svg>
  );
}

/** Computer/monitor glyph: Play's vs Computer card. */
export function ComputerIcon({
  size = 34,
  strokeWidth = 2,
  className,
}: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className} stroke="#2F5E9E">
      <rect x={4} y={7} width={16} height={12} rx={3} />
      <path d="M12 3v4" />
      <circle cx={9} cy={13} r={1} fill="#2F5E9E" />
      <circle cx={15} cy={13} r={1} fill="#2F5E9E" />
    </Svg>
  );
}

/** Board/frame glyph: lesson Complete's "Play again". */
export function NewGameIcon({
  size = 32,
  strokeWidth = 2,
  className,
}: IconProps = {}): JSX.Element {
  return (
    <Svg size={size} strokeWidth={strokeWidth} className={className} stroke="#2E7D5B">
      <rect x={3} y={3} width={18} height={18} rx={3} />
      <path d="M3 12h18M12 3v18" />
    </Svg>
  );
}

export interface CrownIconProps extends IconProps {
  /** Filled gold when a world boss is won (Journey node). */
  readonly filled?: boolean;
  /** Draws the crown's base line too (off for `RankCrownIcon`'s small badge use). */
  readonly bar?: boolean;
  readonly stroke?: string;
}

/** Crown: Journey's world-boss node marker (filled on win). */
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

/** Small green crown badge: RankPill's rank icon. */
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
