import type { JSX } from 'react';
import type { ConceptTask, ExerciseStateBase } from '@learn/platform-core';
import { recordReviewResult } from '@learn/platform-core';
import { useAppStore, useServices } from '../../app/store.ts';
import { ExercisePlay } from '../../kinds/ExercisePlay.tsx';
import { useExerciseSession } from '../../kinds/session.ts';
import { SpeechBubble } from '../ds/SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { NextButton } from '../lesson/NextButton.tsx';

export interface ReviewExerciseStepProps {
  readonly task: ConceptTask;
  /** Threaded into `recordReviewResult` (rewards.md §4 "Warm-up Champ"). Ignored when `onRecord` is
   * given (an assessment task never touches the Leitner review scheduler this way). */
  readonly reviewSource: 'warmup' | 'practice';
  /** Called once the solved attempt is saved (`recordReviewResult`, or `onRecord`) and Next is tapped. */
  readonly onNext: () => void;
  readonly showHint?: boolean;
  /** Overrides the default `recordReviewResult` save (assessment tasks: scoring is per-run, not a
   * per-task Leitner box move); must resolve before Next appears. */
  readonly onRecord?: (state: ExerciseStateBase, correct: boolean) => Promise<void>;
}

/** One warm-up / Practice review task (domain-model.md §3.1): a lesson exercise's board + controls minus the easier-variant machinery. */
export function ReviewExerciseStep({
  task,
  reviewSource,
  onNext,
  showHint = true,
  onRecord,
}: ReviewExerciseStepProps): JSX.Element {
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const exercise = task.exercise;
  const lesson = services.deps.content.lesson(task.lessonId);
  const character = lesson?.character ?? 'owl';

  const {
    state,
    dispatch,
    solved,
    stars,
    saved,
    instruction: instructionText,
    note,
    replay,
  } = useExerciseSession(exercise, {
    character,
    save: (core, ms) => {
      if (!profile) return undefined;
      const correct = core.errors === 0 && core.hintLevel === 0;
      return onRecord
        ? onRecord(core, correct)
        : recordReviewResult(services.deps, {
            profileId: profile.id,
            task,
            state: core,
            durationMs: ms,
            reviewSource,
          }).then(() => undefined);
    },
  });

  const top = <SpeechBubble text={instructionText} note={note} onReplay={replay} />;

  const done = solved ? (
    <div className="mt-auto flex flex-col items-center gap-4">
      <StarsRow earned={stars} animate />
      {saved && <NextButton onClick={onNext} className="w-full" />}
    </div>
  ) : null;

  return (
    <ExercisePlay
      def={exercise}
      state={state}
      dispatch={dispatch}
      showHint={showHint}
      showCheck
      top={top}
      done={done}
    />
  );
}
