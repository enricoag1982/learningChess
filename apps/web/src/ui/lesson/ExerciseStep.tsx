import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExerciseDef, Lesson, MoveInput } from '@chess-kids/core';
import { exerciseMoves, recordExerciseResult, starsFor } from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { Board } from '../board/Board.tsx';
import { ReplayButton } from '../ReplayButton.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { useNarratedText } from '../useNarratedText.ts';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './button-styles.ts';
import { createExerciseReducer, initExerciseState } from './exercise-reducer.ts';
import { exerciseInstructionText, exerciseNote } from './exercise-text.ts';
import { GameLayout } from './GameLayout.tsx';
import { NextButton } from './NextButton.tsx';

export interface ExerciseStepProps {
  readonly lesson: Lesson;
  readonly exercise: ExerciseDef;
  /** Guided tries: hint level 1 auto-shown, never scored. */
  readonly guided: boolean;
  readonly nextStepIndex: number;
}

function HintIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </svg>
  );
}

function UndoIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

function MovesCard({
  current,
  target,
}: {
  readonly current: number;
  readonly target: number;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 rounded-3xl border-2 border-line bg-card px-5 py-4">
      <span className="text-xs font-extrabold uppercase tracking-wide text-muted sm:text-sm">
        {t('exercise.moves-label')}
      </span>
      <span className="font-display text-3xl font-semibold text-ink">
        {t('exercise.moves-of', { current, total: target })}
      </span>
      <div className="flex items-center gap-2 text-sm font-bold text-muted">
        <StarsRow earned={3} max={3} size="1.1rem" />
        {t('exercise.moves-target', { count: target })}
      </div>
    </div>
  );
}

/** One guided try or scored exercise: collect-stars, capture, or select-squares. */
export function ExerciseStep({
  lesson,
  exercise,
  guided,
  nextStepIndex,
}: ExerciseStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const goToStep = useAppStore((state) => state.goToStep);
  const refreshProgress = useAppStore((state) => state.refreshProgress);

  const reducer = useMemo(() => createExerciseReducer(services.rules), [services.rules]);
  const [state, dispatch] = useReducer(reducer, exercise, initExerciseState);

  // A lazy `useState` initializer (not a direct `Date.now()` call) keeps render pure.
  const [startedAt] = useState(() => Date.now());
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (guided) dispatch({ type: 'auto-hint' });
    // Runs once for this mounted exercise; the parent remounts a fresh instance per exercise id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const solved = state.core.solved;
  const stars = starsFor(state.core);

  useEffect(() => {
    if (!solved || savedRef.current || !profile) return;
    savedRef.current = true;
    void recordExerciseResult(services.deps, {
      profileId: profile.id,
      lesson,
      state: state.core,
      scored: !guided,
      durationMs: Date.now() - startedAt,
      nextStep: nextStepIndex,
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
    nextStepIndex,
    state.core,
    startedAt,
    refreshProgress,
  ]);

  const instructionText = exerciseInstructionText(t, exercise);
  const note = exerciseNote(t, state.feedback, lesson.character, stars);
  const spokenText = note ? `${instructionText} ${note.text}` : instructionText;
  const replay = useNarratedText(services.narrator, spokenText);
  const isSelectSquares = exercise.type === 'select-squares';

  function handleMove(move: MoveInput): void {
    dispatch({ type: 'move', move });
  }

  const board = isSelectSquares ? (
    <Board
      position={state.core.position}
      legalMoves={[]}
      onSquareTap={(square) => {
        dispatch({ type: 'toggle', square });
      }}
      highlights={{
        selectedSquares: state.core.selected,
        wrong: state.wrongSquares,
        ...(state.hint ? { hint: state.hint.squares } : {}),
      }}
      label={t('lesson.board-label')}
    />
  ) : (
    <Board
      position={state.core.position}
      legalMoves={exerciseMoves(state.core, services.rules)}
      onMove={({ from, to }) => {
        handleMove({ from, to });
      }}
      onIllegal={(attempt) => {
        if (attempt.from === null) {
          dispatch({ type: 'tap-first' });
        } else {
          handleMove({ from: attempt.from, to: attempt.to });
        }
      }}
      highlights={{
        ...(state.hint ? { hint: state.hint.squares } : {}),
        ...(state.lastMove ? { lastMove: state.lastMove } : {}),
      }}
      label={t('lesson.board-label')}
    />
  );

  return (
    <GameLayout
      board={board}
      panel={
        <>
          <SpeechBubble text={instructionText} note={note} />
          <ReplayButton onClick={replay} label={t('exercise.replay')} />
          {solved ? (
            <div className="mt-auto flex flex-col items-center gap-4">
              {/* Guided tries are never scored (teaching-process.md §3.3): praise + Next only. */}
              {!guided && <StarsRow earned={stars} animate />}
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
            <div className="mt-auto flex flex-col gap-4">
              {exercise.type !== 'select-squares' && (
                <MovesCard current={state.core.moves} target={exercise.stars3} />
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'hint' });
                  }}
                  className={SECONDARY_BUTTON}
                >
                  <HintIcon />
                  {t('exercise.hint')}
                </button>
                {isSelectSquares ? (
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'submit' });
                    }}
                    className={PRIMARY_BUTTON}
                  >
                    {t('exercise.check')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'undo' });
                    }}
                    className={SECONDARY_BUTTON}
                  >
                    <UndoIcon />
                    {t('exercise.undo')}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
