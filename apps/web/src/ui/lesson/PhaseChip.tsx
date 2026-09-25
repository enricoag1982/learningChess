import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonPhase, SkippablePhase } from '@chess-kids/core';
import { PHASE_BAR, PHASES, phaseState } from './phase-track.ts';

export interface PhaseChipProps {
  readonly phase: LessonPhase;
  /** Position within the phase (e.g. guided try 1 of 2); omitted where there is only one step. */
  readonly current?: number;
  readonly total?: number;
  /** Story/Demo/Try skipped so far (playtest 2), shown in the mini track under the label. */
  readonly skippedPhases?: readonly SkippablePhase[];
}

/**
 * Phone top bar (< 640px, docs/screens.md §1): one compact label naming the current phase,
 * replacing the full `StepPills` track that would wrap there. Info, not tappable (F3): flat tint,
 * small radius, `StepPills`' orange "current" bar as a left edge.
 */
export function PhaseChip({
  phase,
  current,
  total,
  skippedPhases = [],
}: PhaseChipProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border-l-4 border-today bg-today/10 px-3 py-1.5 text-sm font-semibold text-ink">
        {t(`lesson.steps.${phase}`)}
        {current !== undefined && total !== undefined && (
          <> · {t('lesson.stage-of', { current, total })}</>
        )}
      </span>
      {/* Mini track (same states as `StepPills`): the phone's only view of done / skipped. */}
      <span className="flex gap-1" aria-hidden="true">
        {PHASES.map((p) => (
          <span
            key={p}
            className={`h-2 w-7 rounded-full ${PHASE_BAR[phaseState(p, phase, skippedPhases)]}`}
          />
        ))}
      </span>
      {skippedPhases.length > 0 && (
        <span className="sr-only">
          {skippedPhases
            .map((p) => t('lesson.steps.skipped', { step: t(`lesson.steps.${p}`) }))
            .join(', ')}
        </span>
      )}
    </span>
  );
}
