import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExerciseDef, Lesson, Piece } from '@chess-kids/core';
import {
  EASIER_VARIANT_STARS,
  chessJsRules,
  easierVariant,
  isInCheck,
  kingSquare,
  recordAttempt,
  recordExerciseResult,
  shouldOfferEasier,
  starsFor,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { ReplayButton } from '../ReplayButton.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { isClassicOnlyContext, showPieceBadges } from '../board/piece-style.ts';
import { useIsStackedLayout } from '../useMediaQuery.ts';
import { useNarratedText } from '../useNarratedText.ts';
import { SECONDARY_BUTTON } from './button-styles.ts';
import { createExerciseReducer, initExerciseState } from './exercise-reducer.ts';
import { exerciseInstructionText, exerciseNote, withEasierOffer } from './exercise-text.ts';
import { buildExercisePlayArea } from './exercise-play-area.tsx';
import { GameLayout } from './GameLayout.tsx';
import { NextButton } from './NextButton.tsx';

export interface ExerciseStepProps {
  readonly lesson: Lesson;
  readonly exercise: ExerciseDef;
  /** Guided tries: hint level 1 auto-shown, never scored. */
  readonly guided: boolean;
  readonly nextStepIndex: number;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** mate-in-n: how long the scripted opponent reply stays hidden before it is shown and narrated. */
const REPLY_DELAY_MS = 600;
const REPLY_DELAY_REDUCED_MS = 150;

interface ExerciseAttemptProps extends ExerciseStepProps {
  /** The scored exercise's easier variant, if it has one — offered once errors pile up. */
  readonly easier?: ExerciseDef;
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
  easier,
  onTakeEasier,
  standsInFor,
}: ExerciseAttemptProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const hintsEnabled = useAppStore((state) => state.activeProfileSettings.hints);
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const goToStep = useAppStore((state) => state.goToStep);
  const refreshProgress = useAppStore((state) => state.refreshProgress);
  const isStacked = useIsStackedLayout();

  const reducer = useMemo(() => createExerciseReducer(services.rules), [services.rules]);
  const [state, dispatch] = useReducer(reducer, exercise, initExerciseState);
  /** setup only: the palette piece currently selected, waiting for a square tap. */
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

  // A lazy `useState` initializer (not a direct `Date.now()` call) keeps render pure.
  const [startedAt] = useState(() => Date.now());
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (guided) dispatch({ type: 'auto-hint' });
    // Runs once for this mounted exercise; the parent remounts a fresh instance per exercise id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mate-in-n: reveals the scripted opponent reply — held back in `state.pendingReply` — after a
  // short delay, so the kid sees their own move complete first (teaching-process.md §3.3).
  useEffect(() => {
    if (!state.pendingReply) return;
    const delay = prefersReducedMotion() ? REPLY_DELAY_REDUCED_MS : REPLY_DELAY_MS;
    const timer = setTimeout(() => {
      dispatch({ type: 'reveal-reply' });
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [state.pendingReply, dispatch]);

  const solved = state.core.solved;
  const stars = starsFor(state.core);
  const shownStars = standsInFor === undefined ? stars : EASIER_VARIANT_STARS;
  const offerEasier = easier !== undefined && shouldOfferEasier(state.core);

  // The board's own displayed position (mate-in-n stages the reply behind `pendingReply`; every
  // other type always shows `state.core.position`), for the check ring — "all exercise types".
  const displayedPosition = state.pendingReply ? state.pendingReply.position : state.core.position;
  const checkSquare = isInCheck(displayedPosition, chessJsRules)
    ? kingSquare(displayedPosition, displayedPosition.toMove)
    : undefined;

  useEffect(() => {
    if (!solved || savedRef.current || !profile) return;
    savedRef.current = true;
    void recordExerciseResult(services.deps, {
      profileId: profile.id,
      lesson,
      state: state.core,
      scored: !guided && standsInFor === undefined,
      durationMs: Date.now() - startedAt,
      nextStep: nextStepIndex,
      ...(standsInFor === undefined ? {} : { standsInFor }),
    }).then(() => {
      setSaved(true);
      // Keeps the store's `progress` current through the lesson, not just when it's re-read on
      // exit: the Complete step reads it straight from the store to show stars earned.
      void refreshProgress();
    });
  }, [
    solved,
    profile,
    services.deps,
    lesson,
    guided,
    standsInFor,
    nextStepIndex,
    state.core,
    startedAt,
    refreshProgress,
  ]);

  function handleTakeEasier(): void {
    if (profile) {
      void recordAttempt(services.deps, {
        profileId: profile.id,
        lesson,
        state: state.core,
        scored: true,
        durationMs: Date.now() - startedAt,
      });
    }
    onTakeEasier?.();
  }

  const instructionText = exerciseInstructionText(t, exercise);
  const baseNote = exerciseNote(t, state.feedback, lesson.character, shownStars);
  const note = offerEasier ? withEasierOffer(t, baseNote, state.feedback) : baseNote;
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
    // app-structure.md §11 "hints on/off": off hides the Hint button; guided tries keep their own
    // auto-hint (the `dispatch({ type: 'auto-hint' })` effect above, unaffected by this setting).
    showHint: hintsEnabled,
    pieceBadges: showPieceBadges(pieceStyle, isClassicOnlyContext({ worldId: lesson.world })),
  });

  const panel = (
    <>
      <SpeechBubble text={instructionText} note={note} />
      {/* The easier-variant offer shares the replay row (not a row of its own) so Hint / Undo stay
          on screen for the kid who is stuck (tablet 1024×768, desktop 1280×720). Offered, never
          forced (teaching-process.md §3.3): the kid may keep trying the original. */}
      <div className="flex gap-3">
        <ReplayButton onClick={replay} label={t('exercise.replay')} className="flex-1" />
        {offerEasier && (
          <button type="button" onClick={handleTakeEasier} className={SECONDARY_BUTTON}>
            {t('exercise.easier')}
          </button>
        )}
      </div>
      {solved ? (
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
      ) : (
        <div className="mt-auto flex flex-col gap-4">{controls}</div>
      )}
    </>
  );

  // A choice exercise with its board hidden gets the panel's full width instead of GameLayout's
  // board+panel split, which would otherwise leave an empty board-shaped gap.
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

/**
 * One lesson step's exercise: a guided try, a scored exercise, or — once the kid takes the offer —
 * its easier variant, credited back to the original on solve (teaching-process.md §3.3).
 */
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
