import type { ExerciseProgress } from './kind.ts';

export type AnswerOutcome = { readonly kind: 'solved' | 'wrong' | 'ignored' };

/** The outcome of one answer step, read off the progress before and after it. */
export function deriveAnswerOutcome(
  before: ExerciseProgress,
  after: ExerciseProgress,
): AnswerOutcome {
  if (after.solved && !before.solved) return { kind: 'solved' };
  if (after.errors > before.errors) return { kind: 'wrong' };
  return { kind: 'ignored' };
}
