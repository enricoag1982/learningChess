import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonPhase, SkippablePhase } from '@chess-kids/core';
import { PHASE_BAR, PHASES, phaseState } from './phase-track.ts';
import { CheckIcon, SkipIcon } from '../ds/icons.tsx';

export interface StepPillsProps {
  readonly current: LessonPhase;
  /** Story/Demo/Try phases skipped so far this run (`LessonProgress.skippedPhases`). */
  readonly skippedPhases?: readonly SkippablePhase[];
}

/** Story · Demo · Try · Exercises · Boss as a flat progress track (docs/screens.md §1, info not
 * tappable): current = orange bar, done = green + check, skipped = skip icon over a dashed bar. */
export function StepPills({ current, skippedPhases = [] }: StepPillsProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex items-end justify-center gap-3">
      {PHASES.map((phase) => {
        const state = phaseState(phase, current, skippedPhases);
        const skipped = state === 'skipped';
        const done = state === 'done';
        const text = state === 'current' ? 'text-ink' : state === 'done' ? 'text-go' : 'text-muted';
        const bar = PHASE_BAR[state];
        return (
          <span key={phase} className="flex min-w-14 flex-col items-center gap-1">
            <span className={`flex items-center gap-1 text-sm font-semibold sm:text-base ${text}`}>
              {skipped ? (
                <>
                  <SkipIcon size={14} strokeWidth={3} />
                  <span aria-hidden="true">{t(`lesson.steps.${phase}`)}</span>
                  <span className="sr-only">
                    {t('lesson.steps.skipped', { step: t(`lesson.steps.${phase}`) })}
                  </span>
                </>
              ) : (
                <>
                  {done && <CheckIcon size={16} />}
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
