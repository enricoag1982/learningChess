import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConceptTask, ExerciseState, Piece } from '@chess-kids/core';
import { recordReviewResult } from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { useExerciseSession } from '../../kinds/session.ts';
import { ReplayButton } from '../ds/ReplayButton.tsx';
import { SpeechBubble } from '../ds/SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { useIsStackedLayout } from '../useMediaQuery.ts';
import { buildExercisePlayArea } from '../lesson/exercise-play-area.tsx';
import { GameLayout } from '../lesson/GameLayout.tsx';
import { NextButton } from '../lesson/NextButton.tsx';

export interface ReviewExerciseStepProps {
  readonly task: ConceptTask;
  /** Threaded into `recordReviewResult` (rewards.md §4 "Warm-up Champ"). Ignored when `onRecord` is
   * given (an assessment task never touches the Leitner review scheduler this way). */
  readonly reviewSource: 'warmup' | 'practice';
  /** Called once the solved attempt is saved (`recordReviewResult`, or `onRecord` when given) and
   * Next is tapped. */
  readonly onNext: () => void;
  /** Hides the Hint control (domain-model.md §3.2: an assessment task offers no hints). Default `true`. */
  readonly showHint?: boolean;
  /** Overrides the default `recordReviewResult` save (assessment tasks: scoring is per-run, not a
   * per-task Leitner box move); must resolve before Next appears. */
  readonly onRecord?: (state: ExerciseState, correct: boolean) => Promise<void>;
}

/** One warm-up/Practice review task (domain-model.md §3.1): the same board + controls a lesson's
 * scored exercise uses, minus the easier-variant machinery. */
export function ReviewExerciseStep({
  task,
  reviewSource,
  onNext,
  showHint = true,
  onRecord,
}: ReviewExerciseStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const isStacked = useIsStackedLayout();
  const exercise = task.exercise;
  const lesson = services.deps.content.lesson(task.lessonId);
  const character = lesson?.character ?? 'owl';

  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

  const {
    state,
    dispatch,
    solved,
    stars,
    saved,
    instruction: instructionText,
    note,
    replay,
    checkSquare,
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

  const { board, belowBoard, controls } = buildExercisePlayArea({
    t,
    rules: services.rules,
    exercise,
    state,
    dispatch,
    selectedPiece,
    onSelectPiece: setSelectedPiece,
    isStacked,
    checkSquare,
    showHint,
  });

  const panel = (
    <>
      <SpeechBubble text={instructionText} note={note} />
      <ReplayButton onClick={replay} label={t('exercise.replay')} className="w-full" />
      {solved ? (
        <div className="mt-auto flex flex-col items-center gap-4">
          <StarsRow earned={stars} animate />
          {saved && <NextButton onClick={onNext} className="w-full" />}
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-4">{controls}</div>
      )}
    </>
  );

  if (exercise.type === 'choice' && !exercise.showBoard) {
    return <div className="flex min-h-0 flex-1 flex-col gap-4">{panel}</div>;
  }
  return (
    <GameLayout
      board={board}
      panel={panel}
      belowBoard={solved ? undefined : (belowBoard ?? undefined)}
    />
  );
}
