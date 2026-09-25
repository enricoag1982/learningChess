import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConceptTask, ExerciseState, Piece } from '@chess-kids/core';
import {
  chessJsRules,
  isInCheck,
  kingSquare,
  recordReviewResult,
  starsFor,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { ReplayButton } from '../ReplayButton.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { useIsStackedLayout } from '../useMediaQuery.ts';
import { useNarratedText } from '../useNarratedText.ts';
import { createExerciseReducer, initExerciseState } from '../lesson/exercise-reducer.ts';
import { exerciseInstructionText, exerciseNote } from '../lesson/exercise-text.ts';
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
  /**
   * Overrides the default `recordReviewResult` save (assessment tasks, M4.5: scoring is per-run, not
   * a per-task Leitner box move). Receives the solved core exercise state and whether it was solved
   * first-try with no hint/error; must resolve before the Next button appears.
   */
  readonly onRecord?: (state: ExerciseState, correct: boolean) => Promise<void>;
}

/**
 * One warm-up / Practice review task (domain-model.md §3.1): the same board + input controls a
 * lesson's scored exercise uses, minus the easier-variant machinery (never offered on a review
 * task) and never touching the task's own lesson's `bestStars` — see `recordReviewResult`.
 */
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

  const reducer = useMemo(() => createExerciseReducer(services.rules), [services.rules]);
  const [state, dispatch] = useReducer(reducer, exercise, initExerciseState);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

  // A lazy `useState` initializer (not a direct `Date.now()` call) keeps render pure.
  const [startedAt] = useState(() => Date.now());
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  const solved = state.core.solved;
  const stars = starsFor(state.core);

  const displayedPosition = state.pendingReply ? state.pendingReply.position : state.core.position;
  const checkSquare = isInCheck(displayedPosition, chessJsRules)
    ? kingSquare(displayedPosition, displayedPosition.toMove)
    : undefined;

  useEffect(() => {
    if (!solved || savedRef.current || !profile) return;
    savedRef.current = true;
    const correct = state.core.errors === 0 && state.core.hintLevel === 0;
    const save = onRecord
      ? onRecord(state.core, correct)
      : recordReviewResult(services.deps, {
          profileId: profile.id,
          task,
          state: state.core,
          durationMs: Date.now() - startedAt,
          reviewSource,
        }).then(() => undefined);
    void save.then(() => {
      setSaved(true);
    });
  }, [solved, profile, services.deps, task, state.core, startedAt, reviewSource, onRecord]);

  const character = lesson?.character ?? 'owl';
  const instructionText = exerciseInstructionText(t, exercise);
  const note = exerciseNote(t, state.feedback, character, stars);
  const spokenText = note ? `${instructionText} ${note.text}` : instructionText;
  const replay = useNarratedText(services.narrator, spokenText);

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
