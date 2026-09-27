import type { JSX, ReactNode } from 'react';
import { BackIcon, CloseIcon } from './icons.tsx';
import { tapClass } from './tap.ts';

/**
 * Screen shells (refactor-v4.md §2 finding 6): every screen's own top-level `<main>` was one of a
 * handful of repeated shapes (17 blank, page x5, game x4, centred/form x7), and every header row
 * repeated the same back/close round button (round 64px x10, round 44px x4). Consolidated here so
 * a screen states its kind/header once instead of the raw classes.
 */

export type ScreenKind = 'page' | 'game' | 'center' | 'form';

const SCREEN_BASE: Readonly<Record<ScreenKind, string>> = {
  page: 'flex min-h-dvh flex-col gap-4 bg-cream px-4 py-5 sm:px-8 sm:py-6',
  game: 'flex h-dvh flex-col gap-3 overflow-y-auto bg-cream px-3 py-3 sm:px-8 sm:py-6',
  center: 'flex min-h-dvh flex-col items-center justify-center bg-cream text-center',
  form: 'flex min-h-dvh flex-col items-center justify-center bg-cream',
};

export function Screen({
  kind,
  className = '',
  children,
}: {
  readonly kind: ScreenKind;
  /** Anything `kind`'s own base doesn't already cover (gap/padding for `center`/`form`, one-off). */
  readonly className?: string;
  readonly children: ReactNode;
}): JSX.Element {
  return <main className={`${SCREEN_BASE[kind]} ${className}`.trim()}>{children}</main>;
}

/** A screen with nothing to show yet (still loading its data) — the one `<main>` shape every
 * screen falls back to rather than flashing unstyled content. */
export function BlankScreen(): JSX.Element {
  return <main className="min-h-dvh bg-cream" />;
}

export interface RoundIconButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  /** `kid` = 64px (touch target, non-functional.md §2), `parent` = 44px. */
  readonly size?: 'kid' | 'parent';
  readonly children: ReactNode;
}

/** A round, icon-only tappable (header back/close, parent-area chevron-back). */
export function RoundIconButton({
  label,
  onClick,
  size = 'kid',
  children,
}: RoundIconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={tapClass(size === 'kid' ? 'round' : 'round-sm')}
    >
      {children}
    </button>
  );
}

const HEADER_GAP: Readonly<Record<'page' | 'game' | 'parent', string>> = {
  page: 'flex items-center gap-4',
  game: 'flex items-center gap-3 sm:gap-4',
  parent: 'flex items-center gap-3',
};

export interface ScreenHeaderProps {
  readonly look?: 'page' | 'game' | 'parent';
  readonly action: 'back' | 'close';
  readonly actionLabel: string;
  readonly onAction: () => void;
  /** Overrides the default action icon (`BackIcon`/`CloseIcon`, both eager) — the parent area's own
   * `ChevronLeftIcon` (lazy-only, `icons-lazy.tsx`) is passed this way, so this shared module never
   * imports it itself and never pulls it into the initial bundle. */
  readonly icon?: ReactNode;
  /** A simple truncating title (kid: `<h1>`, parent: `<h2>`) — a screen with a richer header
   * (avatar, trailing pill, a custom two-line block) passes it all via `children` instead. */
  readonly title?: string;
  readonly children?: ReactNode;
}

/** The back/close round button + title row every screen's header repeats. */
export function ScreenHeader({
  look = 'page',
  action,
  actionLabel,
  onAction,
  icon,
  title,
  children,
}: ScreenHeaderProps): JSX.Element {
  return (
    <div className={HEADER_GAP[look]}>
      <RoundIconButton
        label={actionLabel}
        onClick={onAction}
        size={look === 'parent' ? 'parent' : 'kid'}
      >
        {icon ?? (action === 'back' ? <BackIcon /> : <CloseIcon />)}
      </RoundIconButton>
      {title !== undefined &&
        (look === 'parent' ? (
          <h2 className="flex-1 text-base font-extrabold text-ink">{title}</h2>
        ) : (
          <h1 className="flex-grow truncate font-display text-2xl text-ink sm:text-3xl">{title}</h1>
        ))}
      {children}
    </div>
  );
}
