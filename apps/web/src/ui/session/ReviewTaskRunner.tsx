import { useState } from 'react';
import type { JSX } from 'react';
import type { ConceptTask } from '@chess-kids/core';
import { ReviewExerciseStep } from './ReviewExerciseStep.tsx';

function CloseIcon(): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Dots mirroring the lesson's `StageDots`, sized for a short (3–5 task) review run. */
function TaskDots({
  current,
  total,
}: {
  readonly current: number;
  readonly total: number;
}): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        return (
          <span
            key={index}
            className={`h-3 w-3 rounded-full border-2 ${
              state === 'done'
                ? 'border-go bg-go'
                : state === 'current'
                  ? 'border-today bg-white'
                  : 'border-[#E8DFC9] bg-[#E8DFC9]'
            }`}
          />
        );
      })}
    </div>
  );
}

export interface ReviewTaskRunnerProps {
  readonly tasks: readonly ConceptTask[];
  /** e.g. "Warm-up {{current}}/{{total}}" (warm-up) or "Practice {{current}}/{{total}}" (Practice). */
  readonly headerText: (current: number, total: number) => string;
  readonly closeAriaLabel: string;
  /** Threaded into every `recordReviewResult` call (rewards.md §4 "Warm-up Champ"). */
  readonly reviewSource: 'warmup' | 'practice';
  /** Called once every task is solved and its result saved. */
  readonly onDone: () => void;
  /** Top-bar Close: leaves the run early (kid can leave any time). */
  readonly onClose: () => void;
}

/**
 * Steps through a fixed list of review tasks (warm-up or a Practice topic run), one at a time,
 * each played with `ReviewExerciseStep` and recorded via `recordReviewResult` (M3.4). Shares the
 * lesson screen's chrome shape (close + progress + board/panel) without the lesson's own state.
 */
export function ReviewTaskRunner({
  tasks,
  headerText,
  closeAriaLabel,
  reviewSource,
  onDone,
  onClose,
}: ReviewTaskRunnerProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const task = tasks[index];

  if (!task) {
    return <main className="min-h-screen bg-cream" />;
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
    <main className="flex h-dvh flex-col gap-3 overflow-y-auto bg-cream px-3 py-3 sm:px-8 sm:py-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={closeAriaLabel}
          onClick={onClose}
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-line bg-card text-ink"
        >
          <CloseIcon />
        </button>
        <div className="min-w-0 flex-1 truncate text-center font-display text-lg font-semibold text-ink sm:text-xl">
          {headerText(index + 1, tasks.length)}
        </div>
        <div className="h-16 w-16 flex-shrink-0" aria-hidden="true" />
      </div>

      <TaskDots current={index} total={tasks.length} />

      <div className="flex min-h-0 flex-1 flex-col">
        <ReviewExerciseStep
          key={task.exercise.id}
          task={task}
          reviewSource={reviewSource}
          onNext={advance}
        />
      </div>
    </main>
  );
}
