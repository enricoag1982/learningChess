import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ExerciseDef,
  ExerciseState,
  Lesson,
  Piece,
  SeriesGameState,
  SeriesMiniGame,
} from '@chess-kids/core';
import {
  completeRound,
  currentRound,
  recordBossResult,
  seriesResult,
  seriesStars,
  starsFor,
  startSeries,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { tContent } from '../../content-text.ts';
import { Board } from '../board/Board.tsx';
import { isClassicOnlyContext, showPieceBadges } from '../board/piece-style.ts';
import { ReplayButton } from '../ReplayButton.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { useIsStackedLayout } from '../useMediaQuery.ts';
import { useNarratedText, useNarratedTextSequence } from '../useNarratedText.ts';
import type { BossPlaySession } from './BossStep.tsx';
import { SECONDARY_BUTTON } from './button-styles.ts';
import { createExerciseReducer, initExerciseState } from './exercise-reducer.ts';
import { exerciseInstructionText, exerciseNote } from './exercise-text.ts';
import { buildExercisePlayArea } from './exercise-play-area.tsx';
import { GameLayout } from './GameLayout.tsx';
import { NextButton } from './NextButton.tsx';

export interface SeriesBossStepProps {
  readonly lesson: Lesson;
  readonly game: SeriesMiniGame;
  readonly nextStepIndex: number;
  readonly session?: BossPlaySession;
}

/** Round counter + mistakes-so-far card, shared by a round in progress and the result screen. */
function SeriesCounters({
  current,
  total,
  mistakes,
}: {
  readonly current: number;
  readonly total: number;
  readonly mistakes: number;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="info-flat flex flex-col gap-1 rounded-3xl bg-card px-5 py-4 font-display text-lg text-ink">
      <span>{t('boss.series.round-of', { current, total })}</span>
      <span>{t('boss.series.mistakes', { count: mistakes })}</span>
    </div>
  );
}

interface SeriesRoundProps {
  readonly character: string;
  readonly worldId: string;
  readonly exercise: ExerciseDef;
  readonly roundNumber: number;
  readonly totalRounds: number;
  /** Mistakes already folded in from every round completed before this one. */
  readonly priorMistakes: number;
  /** Called once, the moment the kid taps Next after solving this round. */
  readonly onNext: (roundState: ExerciseState) => void;
}

/**
 * One round of a series boss: the same exercise UI as `ExerciseStep` (any exercise type, hints
 * allowed), but scored only as part of the series' total mistakes — no per-round stars, and moving
 * on is an explicit "Next" tap (never a timed auto-advance) once it is solved.
 */
function SeriesRound({
  character,
  worldId,
  exercise,
  roundNumber,
  totalRounds,
  priorMistakes,
  onNext,
}: SeriesRoundProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const hintsEnabled = useAppStore((state) => state.activeProfileSettings.hints);
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const isStacked = useIsStackedLayout();
  const reducer = useMemo(() => createExerciseReducer(services.rules), [services.rules]);
  const [state, dispatch] = useReducer(reducer, exercise, initExerciseState);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

  const solved = state.core.solved;
  const stars = starsFor(state.core);
  const instructionText = exerciseInstructionText(t, exercise);
  const note = exerciseNote(t, state.feedback, character, stars);
  // Two utterances, not one concatenated string (M6.3 item 1) — see `ExerciseStep.tsx`.
  const spokenTexts = note ? [instructionText, note.text] : [instructionText];
  const replay = useNarratedTextSequence(services.narrator, spokenTexts);

  const { board, belowBoard, controls } = buildExercisePlayArea({
    t,
    rules: services.rules,
    exercise,
    state,
    dispatch,
    selectedPiece,
    onSelectPiece: setSelectedPiece,
    isStacked,
    showHint: hintsEnabled,
    pieceBadges: showPieceBadges(pieceStyle, isClassicOnlyContext({ worldId })),
  });

  // Live running total: mistakes already folded in from earlier rounds, plus this round's own
  // errors and hint level so far (folded in for real once it is solved — see `completeRound`).
  const liveMistakes = priorMistakes + state.core.errors + state.core.hintLevel;

  const panel = (
    <>
      <SpeechBubble text={instructionText} note={note} />
      <ReplayButton onClick={replay} label={t('exercise.replay')} />
      <SeriesCounters current={roundNumber} total={totalRounds} mistakes={liveMistakes} />
      {solved ? (
        <div className="mt-auto flex flex-col items-center gap-4">
          <NextButton
            onClick={() => {
              onNext(state.core);
            }}
            className="w-full"
          />
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-4">{controls}</div>
      )}
    </>
  );

  return (
    <GameLayout
      board={board}
      panel={panel}
      belowBoard={solved ? undefined : (belowBoard ?? undefined)}
    />
  );
}

/**
 * A `series` boss mini-game (Square Hunt, Setup Race, …): a fixed sequence of rounds, each played
 * through the normal exercise engine and reusing `ExerciseStep`'s own UI building blocks
 * (`buildExercisePlayArea`); scored on total mistakes (errors + hint levels) across every round,
 * not a single win condition.
 */
export function SeriesBossStep({
  lesson,
  game: minigame,
  nextStepIndex,
  session,
}: SeriesBossStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const goToStep = useAppStore((state) => state.goToStep);
  const refreshProgress = useAppStore((state) => state.refreshProgress);
  const pieceBadges = showPieceBadges(pieceStyle, isClassicOnlyContext({ worldId: lesson.world }));

  const [series, setSeries] = useState<SeriesGameState>(() => startSeries(minigame));
  // A lazy `useState` initializer (not a direct `Date.now()` call) keeps render pure; the ref
  // exists because "Play again" needs to reset the clock later, which `useState` can't do.
  const [initialStartedAt] = useState(() => Date.now());
  const startedAtRef = useRef(initialStartedAt);
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  const result = seriesResult(series);
  const stars = seriesStars(series);
  const goalText = tContent(t, minigame.goalKey);
  const replay = useNarratedText(services.narrator, goalText);

  useEffect(() => {
    if (result === 'playing' || savedRef.current || !profile) return;
    savedRef.current = true;
    const durationMs = Date.now() - startedAtRef.current;
    const persist = session
      ? session.save(series, durationMs)
      : recordBossResult(services.deps, {
          profileId: profile.id,
          lesson,
          state: series,
          durationMs,
          nextStep: nextStepIndex,
        }).then(() => {
          // Keeps the store's `progress` current: the Complete step reads it straight from the store.
          void refreshProgress();
        });
    void persist.then(() => {
      setSaved(true);
    });
  }, [result, profile, services.deps, lesson, nextStepIndex, series, refreshProgress, session]);

  function handleRoundNext(roundState: ExerciseState): void {
    setSeries((current) => completeRound(current, roundState));
  }

  /** Standalone-only: restarts the series at its first round (a lesson boss never restarts inline). */
  function handlePlayAgain(): void {
    setSeries(startSeries(minigame));
    startedAtRef.current = Date.now();
    savedRef.current = false;
    setSaved(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-4">
      <h2 className="text-center font-display text-xl text-ink sm:text-3xl">
        {tContent(t, minigame.titleKey)}
      </h2>
      {result === 'playing' ? (
        <SeriesRound
          key={series.roundIndex}
          character={lesson.character}
          worldId={lesson.world}
          exercise={currentRound(series)}
          roundNumber={series.roundIndex + 1}
          totalRounds={minigame.rounds.length}
          priorMistakes={series.mistakes}
          onNext={handleRoundNext}
        />
      ) : (
        <GameLayout
          board={
            <Board
              position={series.round.position}
              legalMoves={[]}
              label={t('lesson.board-label')}
              pieceBadges={pieceBadges}
            />
          }
          panel={
            <>
              <SpeechBubble text={goalText} />
              <ReplayButton onClick={replay} label={t('exercise.replay')} />
              <SeriesCounters
                current={minigame.rounds.length}
                total={minigame.rounds.length}
                mistakes={series.mistakes}
              />
              {/* Autosave (recordBossResult, or `session.save` standalone) completes before the
                  Next/primary button appears. A standalone session also offers "Play again". */}
              <div className="mt-auto flex flex-col items-center gap-4">
                <StarsRow earned={stars} animate />
                {saved &&
                  (session ? (
                    <div className="flex w-full gap-3">
                      <button type="button" onClick={handlePlayAgain} className={SECONDARY_BUTTON}>
                        {t('play-again')}
                      </button>
                      <NextButton
                        onClick={session.onPrimary}
                        label={session.primaryLabel}
                        className="flex-1"
                      />
                    </div>
                  ) : (
                    <NextButton
                      onClick={() => {
                        goToStep(nextStepIndex);
                      }}
                      className="w-full"
                    />
                  ))}
              </div>
            </>
          }
        />
      )}
    </div>
  );
}
