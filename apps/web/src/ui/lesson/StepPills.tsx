import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonPhase } from '@chess-kids/core';

const PHASES: readonly LessonPhase[] = ['story', 'demo', 'try', 'exercises', 'boss'];

function CheckIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Story · Demo · Try · Exercises · Boss as a flat progress track (info, not tappable — F3,
 * docs/screens.md §1): label over a thin bar; current = orange bar, done = green bar + check,
 * rest muted. No pill box, so no step reads as a button.
 */
export function StepPills({ current }: { readonly current: LessonPhase }): JSX.Element {
  const { t } = useTranslation();
  const currentIndex = PHASES.indexOf(current);

  return (
    <div className="flex items-end justify-center gap-3">
      {PHASES.map((phase, index) => {
        const done = index < currentIndex;
        const isCurrent = index === currentIndex;
        const text = isCurrent ? 'text-ink' : done ? 'text-go' : 'text-muted';
        const bar = isCurrent ? 'bg-today' : done ? 'bg-go' : 'bg-line';
        return (
          <span key={phase} className="flex min-w-14 flex-col items-center gap-1">
            <span className={`flex items-center gap-1 text-sm font-semibold sm:text-base ${text}`}>
              {done && <CheckIcon />}
              {t(`lesson.steps.${phase}`)}
            </span>
            <span className={`h-1.5 w-full rounded-full ${bar}`} aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}
