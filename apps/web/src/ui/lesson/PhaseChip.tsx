import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonPhase } from '@chess-kids/core';

export interface PhaseChipProps {
  readonly phase: LessonPhase;
  /** Position within the phase (e.g. guided try 1 of 2); omitted where there is only one step. */
  readonly current?: number;
  readonly total?: number;
}

/**
 * Phone top bar (< 640px, docs/screens.md §1): one compact pill naming the current phase, in the
 * same "current" colour as `StepPills`, replacing the full five-pill row that would wrap there.
 */
export function PhaseChip({ phase, current, total }: PhaseChipProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-today px-4 py-2 text-sm font-extrabold text-white">
      {t(`lesson.steps.${phase}`)}
      {current !== undefined && total !== undefined && (
        <> · {t('lesson.stage-of', { current, total })}</>
      )}
    </span>
  );
}
