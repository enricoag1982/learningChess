import { useState } from 'react';
import type { JSX } from 'react';
import type { ConceptTask, ExerciseStateBase } from '@learn/platform-core';
import { ReviewExerciseStep } from './ReviewExerciseStep.tsx';
import { ProgressDots } from '../ds/ProgressDots.tsx';
import { BlankScreen, Screen, ScreenHeader } from '../ds/Screen.tsx';

export interface ReviewTaskRunnerProps {
  readonly tasks: readonly ConceptTask[];
  /** e.g. "Warm-up {{current}}/{{total}}" (warm-up) or "Practice {{current}}/{{total}}" (Practice). */
  readonly headerText: (current: number, total: number) => string;
  readonly closeAriaLabel: string;
  /** Threaded into every `recordReviewResult` call (rewards.md §4 "Warm-up Champ"). Ignored when
   * `onRecord` is given. */
  readonly reviewSource: 'warmup' | 'practice';
  /** Called once every task is solved and its result saved. */
  readonly onDone: () => void;
  /** Top-bar Close: leaves the run early (kid can leave any time). */
  readonly onClose: () => void;
  /** Hides every task's Hint control (assessment runs, domain-model.md §3.2). Default `true`. */
  readonly showHint?: boolean;
  /** Overrides the default per-task `recordReviewResult` save; see
   * `ReviewExerciseStepProps.onRecord`. */
  readonly onRecord?: (
    task: ConceptTask,
    state: ExerciseStateBase,
    correct: boolean,
  ) => Promise<void>;
}

/** Steps through a fixed list of review tasks, one at a time, each played with
 * `ReviewExerciseStep`. Shares the lesson screen's chrome shape, without its state. */
export function ReviewTaskRunner({
  tasks,
  headerText,
  closeAriaLabel,
  reviewSource,
  onDone,
  onClose,
  showHint = true,
  onRecord,
}: ReviewTaskRunnerProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const task = tasks[index];

  if (!task) {
    return <BlankScreen />;
  }

  function advance(): void {
    const next = index + 1;
    if (next >= tasks.length) {
      onDone();
      return;
    }
    setIndex(next);
  }

  return (
    <Screen kind="game">
      <ScreenHeader look="game" action="close" actionLabel={closeAriaLabel} onAction={onClose}>
        <div className="min-w-0 flex-1 truncate text-center font-display text-lg font-semibold text-ink sm:text-xl">
          {headerText(index + 1, tasks.length)}
        </div>
        <div className="h-16 w-16 flex-shrink-0" aria-hidden="true" />
      </ScreenHeader>

      <ProgressDots current={index} total={tasks.length} hidden />

      <div className="flex min-h-0 flex-1 flex-col">
        <ReviewExerciseStep
          key={task.exercise.id}
          task={task}
          reviewSource={reviewSource}
          onNext={advance}
          showHint={showHint}
          onRecord={onRecord ? (state, correct) => onRecord(task, state, correct) : undefined}
        />
      </div>
    </Screen>
  );
}
