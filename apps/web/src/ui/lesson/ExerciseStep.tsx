import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExerciseDefBase, Lesson, SkippablePhase } from '@chess-kids/core';
import {
  EASIER_VARIANT_STARS,
  easierVariant,
  recordAttempt,
  recordExerciseResult,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { ExercisePlay } from '../../kinds/ExercisePlay.tsx';
import { useExerciseSession } from '../../kinds/session.ts';
import { ReplayButton } from '../ds/ReplayButton.tsx';
import { SpeechBubble } from '../ds/SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { SECONDARY_BUTTON } from './button-styles.ts';
import { NextButton } from './NextButton.tsx';
import { SkipButton } from './SkipButton.tsx';

export interface ExerciseStepProps {
  readonly lesson: Lesson;
  readonly exercise: ExerciseDefBase;
  /** Guided tries: hint level 1 auto-shown, never scored. */
  readonly guided: boolean;
  readonly nextStepIndex: number;
  /** "Skip": only ever set for a guided try (`guided`) — Exercises/Boss never skip. */
  readonly onSkip?: () => void;
  /** Set when solving this leaves a skippable phase normally (Try's last guided step) — see
   * `RecordExerciseResultInput.completesPhase`. */
  readonly completesPhase?: SkippablePhase;
}

interface ExerciseAttemptProps extends ExerciseStepProps {
  /** The scored exercise's easier variant, if it has one — offered once errors pile up. */
  readonly easier?: ExerciseDefBase;
  /** Swaps the board to `easier`'s variant; only ever passed alongside `easier`. */
  readonly onTakeEasier?: () => void;
  /** Set when `exercise` is itself an easier variant: the original exercise id it stands in for. */
  readonly standsInFor?: string;
}

/** One attempt at a guided try, scored exercise, or its easier variant, of any exercise type. */
function ExerciseAttempt({
  lesson,
  exercise,
  guided,
  nextStepIndex,
  onSkip,
  completesPhase,
  easier,
  onTakeEasier,
  standsInFor,
}: ExerciseAttemptProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const hintsEnabled = useAppStore((state) => state.activeProfileSettings.hints);
  const goToStep = useAppStore((state) => state.goToStep);
  const refreshProgress = useAppStore((state) => state.refreshProgress);

  const session = useExerciseSession(exercise, {
    character: lesson.character,
    guided,
    easier: easier !== undefined,
    shownStars: standsInFor === undefined ? undefined : EASIER_VARIANT_STARS,
    save: (core, ms) =>
      profile
        ? recordExerciseResult(services.deps, {
            profileId: profile.id,
            lesson,
            state: core,
            scored: !guided && standsInFor === undefined,
            durationMs: ms,
            nextStep: nextStepIndex,
            ...(standsInFor === undefined ? {} : { standsInFor }),
            ...(completesPhase === undefined ? {} : { completesPhase }),
          }).then(() => {
            // Keeps the store's `progress` current through the lesson, not just when it's re-read
            // on exit: the Complete step reads it straight from the store to show stars earned.
            void refreshProgress();
          })
        : undefined,
  });
  const {
    state,
    dispatch,
    solved,
    stars: shownStars,
    saved,
    offerEasier,
    instruction: instructionText,
    note,
    replay,
  } = session;

  function handleTakeEasier(): void {
    if (profile) {
      void recordAttempt(services.deps, {
        profileId: profile.id,
        lesson,
        state: state.core,
        scored: true,
        durationMs: session.elapsedMs(),
      });
    }
    onTakeEasier?.();
  }

  const top = (
    <>
      <SpeechBubble text={instructionText} note={note} />
      {/* Easier-variant offer shares the replay row so Hint/Undo stay on screen; offered, never
          forced (teaching-process.md §3.3). */}
      <div className="flex gap-3">
        <ReplayButton onClick={replay} label={t('exercise.replay')} className="flex-1" />
        {/* Guided tries only: skips the rest of Try, straight to the first scored exercise. */}
        {guided && onSkip && <SkipButton onClick={onSkip} />}
        {offerEasier && (
          <button type="button" onClick={handleTakeEasier} className={SECONDARY_BUTTON}>
            {t('exercise.easier')}
          </button>
        )}
      </div>
    </>
  );

  const done = solved ? (
    <div className="mt-auto flex flex-col items-center gap-4">
      {/* Guided tries are never scored (teaching-process.md §3.3): praise + Next only. */}
      {!guided && <StarsRow earned={shownStars} animate />}
      {/* Autosave (recordExerciseResult) completes before the Next button appears. */}
      {saved && (
        <NextButton
          onClick={() => {
            goToStep(nextStepIndex);
          }}
          className="w-full"
        />
      )}
    </div>
  ) : null;

  return (
    <ExercisePlay
      def={exercise}
      state={state}
      dispatch={dispatch}
      // app-structure.md §11 "hints on/off": off hides the Hint button; guided tries keep their own
      // auto-hint (`useExerciseSession`'s mount effect, unaffected by this setting).
      showHint={hintsEnabled}
      showCheck
      surface={{ worldId: lesson.world }}
      top={top}
      done={done}
    />
  );
}

/** One lesson step's exercise: a guided try, a scored exercise, or — once the kid takes the offer —
 * its easier variant, credited back to the original on solve (teaching-process.md §3.3). */
export function ExerciseStep(props: ExerciseStepProps): JSX.Element {
  const { lesson, exercise, guided } = props;
  const variant = guided ? undefined : easierVariant(lesson, exercise);
  const [takenEasier, setTakenEasier] = useState(false);

  if (takenEasier && variant) {
    return (
      <ExerciseAttempt key={variant.id} {...props} exercise={variant} standsInFor={exercise.id} />
    );
  }
  return (
    <ExerciseAttempt
      key={exercise.id}
      {...props}
      easier={variant}
      onTakeEasier={() => {
        setTakenEasier(true);
      }}
    />
  );
}
