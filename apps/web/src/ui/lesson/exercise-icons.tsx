import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { StarsRow } from '../StarsRow.tsx';
import { InfoPanel } from '../primitives.tsx';

export function HintIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export function UndoIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export interface MovesCardProps {
  readonly t: TFunction;
  readonly current: number;
  readonly target: number;
}

/** Moves-so-far counter for a move-counted exercise (collect-stars / capture) — info, flat
 * (docs/screens.md §1): read-only, never a button. `t` passed in since this isn't a hook. */
export function MovesCard({ t, current, target }: MovesCardProps): JSX.Element {
  return (
    <InfoPanel className="flex flex-col gap-2 rounded-3xl px-5 py-4">
      <span className="text-xs font-extrabold uppercase tracking-wide text-muted sm:text-sm">
        {t('exercise.moves-label')}
      </span>
      <span className="font-display text-3xl font-semibold text-ink">
        {t('exercise.moves-of', { current, total: target })}
      </span>
      <div className="flex items-center gap-2 text-sm font-bold text-muted">
        <StarsRow earned={3} max={3} size="1.1rem" />
        {t('exercise.moves-target', { count: target })}
      </div>
    </InfoPanel>
  );
}
