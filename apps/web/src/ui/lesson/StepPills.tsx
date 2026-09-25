import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonPhase, SkippablePhase } from '@chess-kids/core';

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

/** Small skip icon for a `skipped` step — mirrors `SkipButton`'s own icon. */
function SkipIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 5l8 7-8 7V5z" />
      <path d="M17 5v14" />
    </svg>
  );
}

export interface StepPillsProps {
  readonly current: LessonPhase;
  /** Story/Demo/Try phases skipped so far this run (`LessonProgress.skippedPhases`). */
  readonly skippedPhases?: readonly SkippablePhase[];
}

/**
 * Story · Demo · Try · Exercises · Boss as a flat progress track (info, not tappable — F3,
 * docs/screens.md §1): label over a thin bar; current = orange bar, done = green bar + check,
 * skipped = skip icon + muted label over a dashed/striped bar (playtest 2 — never solid green or
 * orange, so it never reads as either "done" or "current"), rest muted. No pill box, so no step
 * reads as a button.
 */
export function StepPills({ current, skippedPhases = [] }: StepPillsProps): JSX.Element {
  const { t } = useTranslation();
  const currentIndex = PHASES.indexOf(current);

  return (
    <div className="flex items-end justify-center gap-3">
      {PHASES.map((phase, index) => {
        const skipped = skippedPhases.includes(phase as SkippablePhase);
        const done = index < currentIndex;
        const isCurrent = index === currentIndex;
        const text = skipped
          ? 'text-muted'
          : isCurrent
            ? 'text-ink'
            : done
              ? 'text-go'
              : 'text-muted';
        const bar = skipped
          ? // Diagonal stripe (muted on line, both existing tokens): distinct from every solid
            // state below, so "skipped" is never mistaken for "done" or "rest".
            'bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_4px,var(--color-line)_4px_8px)]'
          : isCurrent
            ? 'bg-today'
            : done
              ? 'bg-go'
              : 'bg-line';
        return (
          <span key={phase} className="flex min-w-14 flex-col items-center gap-1">
            <span className={`flex items-center gap-1 text-sm font-semibold sm:text-base ${text}`}>
              {skipped ? (
                <>
                  <SkipIcon />
                  <span aria-hidden="true">{t(`lesson.steps.${phase}`)}</span>
                  <span className="sr-only">
                    {t('lesson.steps.skipped', { step: t(`lesson.steps.${phase}`) })}
                  </span>
                </>
              ) : (
                <>
                  {done && <CheckIcon />}
                  {t(`lesson.steps.${phase}`)}
                </>
              )}
            </span>
            <span className={`h-1.5 w-full rounded-full ${bar}`} aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}
