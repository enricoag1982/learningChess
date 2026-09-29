import type { LessonPhase, SkippablePhase } from '@learn/platform-core';

export const PHASES: readonly LessonPhase[] = ['story', 'demo', 'try', 'exercises', 'boss'];

export type PhaseState = 'done' | 'current' | 'skipped' | 'rest';

/** Skipped wins over done. */
export function phaseState(
  phase: LessonPhase,
  current: LessonPhase,
  skippedPhases: readonly SkippablePhase[],
): PhaseState {
  if (skippedPhases.includes(phase as SkippablePhase)) return 'skipped';
  const index = PHASES.indexOf(phase);
  const currentIndex = PHASES.indexOf(current);
  if (index === currentIndex) return 'current';
  return index < currentIndex ? 'done' : 'rest';
}

/** Bar fill per state. Skipped = diagonal stripe (muted on line): never mistaken for a solid state. */
export const PHASE_BAR: Readonly<Record<PhaseState, string>> = {
  skipped:
    'bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_4px,var(--color-line)_4px_8px)]',
  current: 'bg-today',
  done: 'bg-go',
  rest: 'bg-line',
};
